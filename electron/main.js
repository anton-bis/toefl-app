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

async function resolveContentFile(relativePath) {
  const safePath = normalizeContentPath(relativePath);
  if (resolvedContentPaths.has(safePath)) return resolvedContentPaths.get(safePath);
  for (const candidate of getContentCandidates({
    relativePath: safePath,
    userDataPath: app.getPath('userData'),
    appPath: app.getAppPath(),
    resourcesPath: process.resourcesPath
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
let autoUpdaterPromise;
let updaterConfigured = false;
let appUpdateTimer;
let contentUpdateTimer;
let dataStorage;
const pendingRendererFlushes = new Map();
let nextFlushId = 1;
let quittingRequested = false;
const APP_UPDATE_INTERVAL = 6 * 60 * 60 * 1000;
const CONTENT_UPDATE_INTERVAL = 24 * 60 * 60 * 1000;

async function getAutoUpdater() {
  if (!app.isPackaged) return null;
  autoUpdaterPromise ??= import('electron-updater').then(module => module.default.autoUpdater);
  const updater = await autoUpdaterPromise;
  if (!updaterConfigured) {
    configureAutoUpdater(updater);
    updaterConfigured = true;
  }
  return updater;
}

function canRunBackgroundWork() {
  return Boolean(mainWindow?.isVisible() && !mainWindow.isMinimized() && net.isOnline());
}

function clearBackgroundTimers() {
  clearTimeout(appUpdateTimer);
  clearTimeout(contentUpdateTimer);
  appUpdateTimer = undefined;
  contentUpdateTimer = undefined;
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
  if (!canRunBackgroundWork()) return;
  const updater = await getAutoUpdater();
  await updater?.checkForUpdates();
}

async function checkContentUpdate() {
  if (!canRunBackgroundWork()) return;
  const { checkForContentUpdates } = await import('./services/content-updater.js');
  const result = await checkForContentUpdates();
  if (result.hasUpdate && mainWindow) {
    mainWindow.webContents.send('content:update-available', result);
  }
}

function scheduleBackgroundChecks(initialDelay = 30_000) {
  if (!app.isPackaged) return;
  clearBackgroundTimers();
  appUpdateTimer = setTimeout(async function runAppUpdate() {
    await checkAppUpdate().catch(error => console.warn('App update check failed:', error.message));
    appUpdateTimer = setTimeout(runAppUpdate, APP_UPDATE_INTERVAL);
  }, initialDelay);
  contentUpdateTimer = setTimeout(async function runContentUpdateCheck() {
    await checkContentUpdate().catch(error =>
      console.warn('Content update check failed:', error.message)
    );
    contentUpdateTimer = setTimeout(runContentUpdateCheck, CONTENT_UPDATE_INTERVAL);
  }, initialDelay + 15_000);
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

    scheduleBackgroundChecks();
  });

  // Release the window reference after closing.
  mainWindow.on('closed', () => {
    clearBackgroundTimers();
    mainWindow = null;
  });

  let closeAllowed = false;
  let closePending = false;
  mainWindow.on('close', event => {
    if (closeAllowed) return;
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
          label: 'User Guide',
          click: () => {
            shell.openExternal('https://github.com/anton-bis/toefl-app#readme');
          }
        },
        {
          label: 'Check for Updates',
          click: async () => {
            const updater = await getAutoUpdater();
            await updater?.checkForUpdatesAndNotify();
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

  // Runtime content updates
  ipcMain.handle('content:apply', async event => {
    if (!isTrustedRenderer(event)) throw new Error('Untrusted content update request.');
    const { runContentUpdate } = await import('./services/content-updater.js');
    const result = await runContentUpdate();
    resolvedContentPaths.clear();
    return result;
  });

  ipcMain.handle('update:quit-and-install', async event => {
    if (!isTrustedRenderer(event)) throw new Error('Untrusted update request.');
    const updater = await getAutoUpdater();
    updater?.quitAndInstall();
  });

  ipcMain.handle('update:download', async event => {
    if (!isTrustedRenderer(event)) throw new Error('Untrusted update request.');
    const updater = await getAutoUpdater();
    return updater?.downloadUpdate();
  });
}

// Automatic update events
function configureAutoUpdater(updater) {
  updater.autoDownload = false;
  updater.autoInstallOnAppQuit = false;

  updater.on('checking-for-update', () => {
    console.log('Checking for updates...');
  });

  updater.on('update-available', info => {
    console.log('Update available:', info.version);
    if (mainWindow) {
      mainWindow.webContents.send('update:available', info);
    }
  });

  updater.on('update-not-available', () => {
    console.log('The app is up to date.');
  });

  updater.on('error', err => {
    console.error('Update check failed:', err);
    if (mainWindow) {
      mainWindow.webContents.send('update:error', err.message);
    }
  });

  updater.on('download-progress', progressObj => {
    if (mainWindow) {
      mainWindow.webContents.send('update:progress', progressObj);
    }
  });

  updater.on('update-downloaded', info => {
    console.log('Update downloaded:', info.version);
    if (mainWindow) {
      mainWindow.webContents.send('update:downloaded', info);
    }
  });
}

// Initialize the app.
function initializeApp() {
  try {
    console.log('Initializing the app...');

    // Register IPC handlers.
    setupIpcHandlers();
    console.log('IPC handlers are ready.');

    setupContentProtocol();
    console.log('Content protocol is ready.');

    // Create the main window.
    createWindow();
    console.log('Main window created.');

    if (app.isPackaged) {
      powerMonitor.on('resume', () => scheduleBackgroundChecks(60_000));
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
  clearBackgroundTimers();
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
