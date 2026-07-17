import { app, BrowserWindow, ipcMain, shell, dialog, Menu, session, protocol, net } from 'electron';
import pkg from 'electron-updater';
const { autoUpdater } = pkg;
import path from 'path';
import fs from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { checkForContentUpdates, runContentUpdate } from './services/content-updater.js';
import { externalContentPath, normalizeContentPath } from './services/content-paths.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.commandLine.appendSwitch('lang', 'en-US');

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
  }
]);

function contentCandidates(relativePath) {
  const safePath = normalizeContentPath(relativePath);
  const externalPath = externalContentPath(safePath);
  return [
    path.join(app.getPath('userData'), 'tpo-content', externalPath),
    path.join(app.getAppPath(), 'dist', safePath),
    path.join(app.getAppPath(), safePath)
  ];
}

function resolveContentFile(relativePath) {
  return contentCandidates(relativePath).find(candidate => fs.existsSync(candidate)) || null;
}

function setupContentProtocol() {
  protocol.handle('toefl-content', request => {
    const requestUrl = new URL(request.url);
    const filePath = resolveContentFile(decodeURIComponent(requestUrl.pathname).replace(/^\/+/, ''));
    if (!filePath) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(filePath).toString(), { headers: request.headers });
  });
}

// Main window reference
let mainWindow = null;
const authorizedExports = new Set();
const authorizedImports = new Set();

function isTrustedRenderer(event) {
  return Boolean(mainWindow && event.sender === mainWindow.webContents);
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
      webSecurity: true
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
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Allow audio capture only for the trusted app URL.
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const mediaTypes = details?.mediaTypes || [];
    const audioOnly = mediaTypes.length === 0 || mediaTypes.every(type => type === 'audio');
    callback(permission === 'media' && audioOnly && isTrustedAppUrl(webContents.getURL()));
  });

  // Show the window once it is ready.
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();

    // Check once at startup, then every ten minutes.
    if (app.isPackaged) {
      setTimeout(() => {
        autoUpdater.checkForUpdates();
      }, 5000);

      setInterval(() => {
        autoUpdater.checkForUpdates();
      }, 10 * 60 * 1000);
    }
  });

  // Release the window reference after closing.
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Open external links in the default browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
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
          click: () => {
            autoUpdater.checkForUpdatesAndNotify();
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
              detail: 'Focused practice for the TOEFL iBT.\n\n© 2026 anton-bis. All rights reserved.',
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
    defaultPath: `toefl-data-${Date.now()}.json`,
    filters: [
      { name: 'JSON files', extensions: ['json'] },
      { name: 'All files', extensions: ['*'] }
    ]
  });

  if (filePath) {
    authorizedExports.add(path.resolve(filePath));
    mainWindow.webContents.send('export-user-data', filePath);
  }
}

// Import user data.
async function importUserData() {
  if (!mainWindow) return;

  const { filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Import Practice Data',
    filters: [
      { name: 'JSON files', extensions: ['json'] },
      { name: 'All files', extensions: ['*'] }
    ],
    properties: ['openFile']
  });

  if (filePaths.length > 0) {
    authorizedImports.add(path.resolve(filePaths[0]));
    mainWindow.webContents.send('import-user-data', filePaths[0]);
  }
}

// IPC handlers
function setupIpcHandlers() {
  ipcMain.handle('user-data:write', async (event, filePath, payload) => {
    const resolved = path.resolve(String(filePath || ''));
    if (!isTrustedRenderer(event) || !authorizedExports.delete(resolved)) {
      throw new Error('This export path is no longer authorized.');
    }
    const serialized = JSON.stringify(payload, null, 2);
    if (Buffer.byteLength(serialized) > 25 * 1024 * 1024) {
      throw new Error('The exported data exceeds the 25 MB limit.');
    }
    const temporary = `${resolved}.tmp-${process.pid}`;
    await fs.promises.writeFile(temporary, serialized, { encoding: 'utf8', mode: 0o600 });
    await fs.promises.rename(temporary, resolved);
    return true;
  });

  ipcMain.handle('user-data:read', async (event, filePath) => {
    const resolved = path.resolve(String(filePath || ''));
    if (!isTrustedRenderer(event) || !authorizedImports.delete(resolved)) {
      throw new Error('This import path is no longer authorized.');
    }
    const stats = await fs.promises.stat(resolved);
    if (stats.size > 25 * 1024 * 1024) {
      throw new Error('The selected file exceeds the 25 MB limit.');
    }
    return JSON.parse(await fs.promises.readFile(resolved, 'utf8'));
  });

  // Runtime content updates
  ipcMain.handle('content:apply', () => runContentUpdate());

  ipcMain.handle('content:read', (_event, relativePath) => {
    const filePath = resolveContentFile(relativePath);
    return filePath ? fs.readFileSync(filePath, 'utf8') : null;
  });

  ipcMain.handle('update:quit-and-install', () => {
    autoUpdater.quitAndInstall();
  });

  ipcMain.handle('update:download', () => {
    autoUpdater.downloadUpdate();
  });
}

// Automatic update events
function setupAutoUpdater() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on('checking-for-update', () => {
    console.log('Checking for updates...');
  });

  autoUpdater.on('update-available', info => {
    console.log('Update available:', info.version);
    if (mainWindow) {
      mainWindow.webContents.send('update:available', info);
    }
  });

  autoUpdater.on('update-not-available', () => {
    console.log('The app is up to date.');
  });

  autoUpdater.on('error', err => {
    console.error('Update check failed:', err);
    if (mainWindow) {
      mainWindow.webContents.send('update:error', err.message);
    }
  });

  autoUpdater.on('download-progress', progressObj => {
    if (mainWindow) {
      mainWindow.webContents.send('update:progress', progressObj);
    }
  });

  autoUpdater.on('update-downloaded', info => {
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

    // Enable automatic updates in packaged builds.
    if (app.isPackaged) {
      setupAutoUpdater();
      console.log('Automatic updates are ready.');
    }

    // Create the main window.
    createWindow();
    console.log('Main window created.');

    // Check for content updates in the background.
    checkForContentUpdates()
      .then(result => {
        if (result.hasUpdate) {
          console.log(`Content update available: v${result.localVersion} → v${result.remoteVersion}`);
          if (mainWindow) {
            mainWindow.webContents.send('content:update-available', result);
          }
        }
      })
      .catch(err => console.warn('Content update check failed:', err.message));
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
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

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
