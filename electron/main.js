import {
  app,
  BrowserWindow,
  ipcMain,
  shell,
  dialog,
  Menu,
  session,
  protocol,
  net,
  powerMonitor
} from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { getContentCandidates, normalizeContentPath } from './services/content-paths.js';
import { createAppUpdaterController, initialAppUpdateState } from './services/app-updater.js';
import { createBackgroundScheduler } from './services/background-scheduler.js';
import { downloadMacInstaller } from './services/manual-mac-update.js';
import {
  activePackRoots,
  getContentRoot,
  hasLegacyContent,
  readInstalledManifest
} from './services/content-installation.js';
import {
  configureContentUpdater,
  initializeContent,
  setContentBusy,
  synchronizeContent
} from './services/content-updater.js';
import { registerDataStorageIpc } from './services/database.js';
import { writePerformanceSnapshot } from './services/performance.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const startupStartedAt = performance.now();

app.commandLine.appendSwitch('lang', 'en-US');
if (process.env.TOEFL_PERF_USER_DATA) app.setPath('userData', process.env.TOEFL_PERF_USER_DATA);

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'toefl-content',
    privileges: {
      standard: true,
      secure: true,
      stream: true,
      supportFetchAPI: true,
      corsEnabled: true
    }
  },
  {
    scheme: 'toefl-recording',
    privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true }
  }
]);

const resolvedContentPaths = new Map();
let installedContentRoots = [];
let installedContentLoaded = false;

async function refreshInstalledContent(manifest) {
  const contentRoot = getContentRoot(app.getPath('userData'));
  const activeManifest = manifest || (await readInstalledManifest(contentRoot));
  installedContentRoots = activePackRoots(contentRoot, activeManifest);
  if (!manifest && (await hasLegacyContent(contentRoot))) installedContentRoots.push(contentRoot);
  installedContentLoaded = true;
  resolvedContentPaths.clear();
}

async function resolveContentFile(relativePath) {
  const safePath = normalizeContentPath(relativePath);
  if (resolvedContentPaths.has(safePath)) return resolvedContentPaths.get(safePath);
  if (!installedContentLoaded) await refreshInstalledContent();
  for (const candidate of getContentCandidates({
    relativePath: safePath,
    activeRoots: installedContentRoots,
    appPath: app.getAppPath()
  })) {
    try {
      const stats = await fs.promises.stat(candidate);
      if (stats.isFile()) {
        resolvedContentPaths.set(safePath, candidate);
        return candidate;
      }
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
  return null;
}

function setupContentProtocol() {
  protocol.handle('toefl-content', async request => {
    const requestUrl = new URL(request.url);
    const filePath = await resolveContentFile(
      decodeURIComponent(requestUrl.pathname).replace(/^\/+/, '')
    );
    if (!filePath) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(filePath).toString(), { headers: request.headers });
  });
  protocol.handle('toefl-recording', async request => {
    const requestUrl = new URL(request.url);
    if (requestUrl.hostname !== 'playback') return new Response('Not found', { status: 404 });
    const recording = await dataStorage.resolveRecordingFile({
      sessionId: requestUrl.searchParams.get('session'),
      questionId: requestUrl.searchParams.get('question')
    });
    if (!recording) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(recording.filePath).toString(), { headers: request.headers });
  });
}

// Main window reference
let mainWindow = null;
let appUpdaterController;
let appUpdaterControllerPromise;
let appInstallBlocked = false;
let backgroundScheduler;
let updateInstallPrepared = false;
let dataStorage;
const pendingRendererFlushes = new Map();
let nextFlushId = 1;
let quittingRequested = false;

function sendToRenderer(channel, payload) {
  if (!mainWindow || mainWindow.webContents.isDestroyed()) return;
  mainWindow.webContents.send(channel, payload);
}

async function getAppUpdaterController() {
  if (!app.isPackaged) return null;
  appUpdaterControllerPromise ??= import('electron-updater')
    .then(module => {
      appUpdaterController = createAppUpdaterController({
        updater: module.default.autoUpdater,
        emitState: state => {
          if (state.status === 'error') updateInstallPrepared = false;
          sendToRenderer('update:state', state);
        },
        prepareToInstall: async () => {
          await flushRendererData(5000);
          updateInstallPrepared = true;
        },
        downloadManualInstaller:
          process.platform === 'darwin'
            ? async options => {
                const installer = await downloadMacInstaller({
                  ...options,
                  downloadsDirectory: app.getPath('downloads'),
                  fetchFile: url => net.fetch(url)
                });
                const error = await shell.openPath(installer);
                if (error) throw new Error(error);
              }
            : undefined
      });
      appUpdaterController.setInstallBlocked(appInstallBlocked);
      return appUpdaterController;
    })
    .catch(error => {
      appUpdaterControllerPromise = null;
      throw error;
    });
  return appUpdaterControllerPromise;
}

function canRunBackgroundWork() {
  return Boolean(mainWindow?.isVisible() && !mainWindow.isMinimized() && net.isOnline());
}

function flushRendererData(timeout = 3000, suspend = false) {
  if (!mainWindow || mainWindow.webContents.isDestroyed()) return Promise.resolve();
  const id = nextFlushId++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingRendererFlushes.delete(id);
      reject(new Error('Timed out while saving the latest changes.'));
    }, timeout);
    pendingRendererFlushes.set(id, result => {
      clearTimeout(timer);
      if (result?.ok) resolve();
      else reject(new Error(result?.error || 'Could not save the latest changes.'));
    });
    mainWindow.webContents.send('data:flush', { id, suspend });
  });
}

async function checkAppUpdate() {
  const controller = await getAppUpdaterController();
  const state = await controller?.check();
  if (state?.status === 'error') throw new Error(state.error);
}

async function checkContentUpdate() {
  const state = await synchronizeContent();
  if (state?.status === 'error' || state?.warning) {
    throw new Error(state.error || state.warning);
  }
}

function isTrustedRenderer(event) {
  return Boolean(
    mainWindow &&
    event.sender === mainWindow.webContents &&
    event.senderFrame === mainWindow.webContents.mainFrame &&
    isTrustedAppUrl(event.senderFrame.url)
  );
}

function isTrustedAppUrl(value) {
  try {
    const url = new URL(value);
    if (process.env.NODE_ENV === 'development') return url.origin === 'http://localhost:3000';
    return url.protocol === 'file:' && url.pathname.endsWith('/dist/index.html');
  } catch {
    return false;
  }
}

// Create the main window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    icon: path.join(__dirname, '../dist/assets/icons/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      spellcheck: false
    },
    show: false,
    backgroundColor: '#f5f5f5',
    titleBarStyle: 'default',
    trafficLightPosition: { x: 16, y: 16 }
  });

  // Load the app
  if (process.env.NODE_ENV === 'development') {
    // Load the Vite development server.
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    // Load the production bundle.
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'), {
      hash: process.env.TOEFL_PERF_ROUTE || undefined
    });
  }

  // Allow audio capture only for the trusted app URL.
  session.defaultSession.setPermissionRequestHandler(
    (webContents, permission, callback, details) => {
      const mediaTypes = details?.mediaTypes || [];
      const audioOnly = mediaTypes.length === 0 || mediaTypes.every(type => type === 'audio');
      callback(permission === 'media' && audioOnly && isTrustedAppUrl(webContents.getURL()));
    }
  );

  // Show the window once it is ready.
  mainWindow.once('ready-to-show', () => {
    if (process.env.TOEFL_PERF_HIDDEN !== '1') mainWindow.show();
    writePerformanceSnapshot({
      app,
      window: mainWindow,
      readyToShowMs: performance.now() - startupStartedAt
    }).catch(error => console.warn('Performance snapshot failed:', error.message));

    backgroundScheduler?.restart();
  });

  // Release the window reference after closing.
  mainWindow.on('closed', () => {
    backgroundScheduler?.stop();
    mainWindow = null;
  });

  mainWindow.on('restore', () => backgroundScheduler?.restart(5000));

  let closeAllowed = false;
  let closePending = false;
  mainWindow.on('close', event => {
    if (closeAllowed || updateInstallPrepared) return;
    event.preventDefault();
    if (closePending) return;
    closePending = true;
    flushRendererData()
      .then(() => {
        closePending = false;
        closeAllowed = true;
        if (quittingRequested) app.quit();
        else mainWindow?.close();
      })
      .catch(async error => {
        closePending = false;
        const requestedQuit = quittingRequested;
        const { response } = await dialog.showMessageBox(mainWindow, {
          type: 'error',
          title: 'Could Not Save Changes',
          message: 'The latest practice data could not be saved.',
          detail: error.message,
          buttons: ['Retry', 'Cancel'],
          defaultId: 0,
          cancelId: 1
        });
        if (response === 0) {
          if (requestedQuit) app.quit();
          else mainWindow?.close();
        } else {
          quittingRequested = false;
        }
      });
  });

  // Open external links in the default browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      shell.openExternal(url).catch(() => {});
    }
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isTrustedAppUrl(url)) event.preventDefault();
  });

  // Create the application menu.
  createApplicationMenu();
}

// Create the application menu.
function createApplicationMenu() {
  const isMac = process.platform === 'darwin';

  const template = [
    // Application menu on macOS
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' }
            ]
          }
        ]
      : []),
    // File menu
    {
      label: 'File',
      submenu: [
        { role: 'close' },
        { type: 'separator' },
        {
          label: 'Export Data',
          click: () => exportUserData()
        },
        {
          label: 'Import Data',
          click: () => importUserData()
        },
        ...(!isMac ? [{ type: 'separator' }, { role: 'quit' }] : [])
      ]
    },
    // Edit menu
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(isMac
          ? [
              { role: 'pasteAndMatchStyle' },
              { role: 'delete' },
              { role: 'selectAll' },
              { type: 'separator' },
              {
                label: 'Speech',
                submenu: [{ role: 'startSpeaking' }, { role: 'stopSpeaking' }]
              }
            ]
          : [{ role: 'delete' }, { type: 'separator' }, { role: 'selectAll' }])
      ]
    },
    // View menu
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    // Help menu
    {
      label: 'Help',
      submenu: [
        {
          label: 'Check for Updates',
          click: async () => {
            try {
              const controller = await getAppUpdaterController();
              await controller?.check({ userInitiated: true });
            } catch (error) {
              dialog.showErrorBox('Update Check Failed', error.message);
            }
          }
        },
        { type: 'separator' },
        {
          label: 'About TOEFL iBT Practice',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About TOEFL iBT Practice',
              message: `TOEFL iBT Practice v${app.getVersion()}`,
              detail:
                'Focused practice for the TOEFL iBT.\n\n© 2026 anton-bis. All rights reserved.',
              buttons: ['OK']
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Export user data.
async function exportUserData() {
  if (!mainWindow) return;

  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Practice Data',
    defaultPath: `toefl-data-${Date.now()}.toefldata`,
    filters: [
      { name: 'TOEFL data archive', extensions: ['toefldata'] },
      { name: 'All files', extensions: ['*'] }
    ]
  });

  if (filePath) {
    try {
      await flushRendererData();
      await dataStorage.exportArchive(path.resolve(filePath));
      await dialog.showMessageBox(mainWindow, {
        type: 'info',
        message: 'Practice data exported successfully.'
      });
    } catch (error) {
      dialog.showErrorBox('Export Failed', error.message);
    }
  }
}

// Import user data.
async function importUserData() {
  if (!mainWindow) return;

  const { filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Import Practice Data',
    filters: [
      { name: 'TOEFL data archive', extensions: ['toefldata'] },
      { name: 'All files', extensions: ['*'] }
    ],
    properties: ['openFile']
  });

  if (filePaths.length > 0) {
    let suspended = false;
    try {
      await flushRendererData(3000, true);
      suspended = true;
      await dataStorage.importArchive(path.resolve(filePaths[0]));
      await dialog.showMessageBox(mainWindow, {
        type: 'info',
        message: 'Practice data imported successfully. The app will now reload.'
      });
      mainWindow.reload();
    } catch (error) {
      dialog.showErrorBox('Import Failed', error.message);
      if (suspended) mainWindow.reload();
    }
  }
}

// IPC handlers
function setupIpcHandlers() {
  dataStorage = registerDataStorageIpc({
    ipcMain,
    userDataPath: app.getPath('userData'),
    isTrustedRenderer
  });

  ipcMain.on('data:flushed', (event, result) => {
    if (!isTrustedRenderer(event)) return;
    const complete = pendingRendererFlushes.get(result?.id);
    pendingRendererFlushes.delete(result?.id);
    complete?.(result);
  });

  ipcMain.handle('content:initialize', async event => {
    if (!isTrustedRenderer(event)) throw new Error('Untrusted content initialization request.');
    if (!app.isPackaged) return { status: 'ready', ready: true, progress: 100 };
    return initializeContent();
  });

  ipcMain.handle('content:retry', async event => {
    if (!isTrustedRenderer(event)) throw new Error('Untrusted content update request.');
    return synchronizeContent();
  });

  ipcMain.handle('content:set-busy', async (event, busy) => {
    if (!isTrustedRenderer(event)) throw new Error('Untrusted content state request.');
    appInstallBlocked = Boolean(busy);
    if (appInstallBlocked) appUpdaterController?.setInstallBlocked(true);
    await setContentBusy(busy);
    if (!appInstallBlocked) appUpdaterController?.setInstallBlocked(false);
  });

  ipcMain.handle('background:resume-checks', event => {
    if (!isTrustedRenderer(event)) throw new Error('Untrusted background check request.');
    backgroundScheduler?.restart(5000);
  });

  ipcMain.handle('update:get-state', event => {
    if (!isTrustedRenderer(event)) throw new Error('Untrusted update request.');
    return appUpdaterController?.getState() || initialAppUpdateState();
  });

  for (const [channel, action] of [
    ['update:download', 'download'],
    ['update:retry', 'retry'],
    ['update:install', 'install']
  ]) {
    ipcMain.handle(channel, async event => {
      if (!isTrustedRenderer(event)) throw new Error('Untrusted update request.');
      const controller = await getAppUpdaterController();
      return controller?.[action]() || initialAppUpdateState();
    });
  }
}

// Initialize the app.
function initializeApp() {
  try {
    console.log('Initializing the app...');

    configureContentUpdater({
      onState: state => sendToRenderer('content:state', state),
      onActivated: manifest => {
        refreshInstalledContent(manifest).catch(error =>
          console.warn('Could not refresh installed content paths:', error.message)
        );
        sendToRenderer('content:activated', {
          manifestId: manifest.manifestId
        });
      }
    });

    // Register IPC handlers.
    setupIpcHandlers();
    console.log('IPC handlers are ready.');

    setupContentProtocol();
    console.log('Content protocol is ready.');

    if (app.isPackaged) {
      backgroundScheduler = createBackgroundScheduler({
        canRun: canRunBackgroundWork,
        runAppUpdate: checkAppUpdate,
        runContentUpdate: checkContentUpdate,
        onError: (kind, error) =>
          console.warn(`${kind === 'app' ? 'App' : 'Content'} update check failed:`, error.message)
      });
    }

    // Create the main window.
    createWindow();
    console.log('Main window created.');

    if (app.isPackaged) {
      powerMonitor.on('resume', () => backgroundScheduler?.restart(60_000));
    }
  } catch (error) {
    console.error('App initialization failed:', error);
    dialog.showErrorBox('Could Not Start the App', error.message);
    app.quit();
  }
}

// Start after Electron is ready.
app.whenReady().then(initializeApp);

// Quit when all windows close, except on macOS.
app.on('window-all-closed', () => {
  dataStorage?.close().catch(() => {});
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  quittingRequested = true;
  backgroundScheduler?.stop();
});

app.on('will-quit', () => dataStorage?.close().catch(() => {}));

// Recreate the window from the macOS Dock.
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Report uncaught exceptions.
process.on('uncaughtException', error => {
  console.error('Uncaught exception:', error);
  dialog.showErrorBox('Unexpected Application Error', error.message);
});

// Report unhandled promise rejections.
process.on('unhandledRejection', reason => {
  console.error('Unhandled promise rejection:', reason);
});
