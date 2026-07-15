import { app, BrowserWindow, ipcMain, shell, dialog, Menu, session, protocol, net } from 'electron';
import pkg from 'electron-updater';
const { autoUpdater } = pkg;
import path from 'path';
import fs from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { checkForContentUpdates, runContentUpdate } from './services/content-updater.js';
import { externalContentPath, normalizeContentPath } from './services/content-paths.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

// 全局窗口引用
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

// 创建主窗口
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

  // 加载应用
  if (process.env.NODE_ENV === 'development') {
    // 开发环境：加载Vite开发服务器
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    // 生产环境：加载构建后的文件
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // 预授权麦克风权限，避免录音时弹窗
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const mediaTypes = details?.mediaTypes || [];
    const audioOnly = mediaTypes.length === 0 || mediaTypes.every(type => type === 'audio');
    callback(permission === 'media' && audioOnly && isTrustedAppUrl(webContents.getURL()));
  });

  // 窗口准备就绪后显示
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();

    // 检查更新（首次 + 此后每 10 分钟轮询）
    if (app.isPackaged) {
      setTimeout(() => {
        autoUpdater.checkForUpdates();
      }, 5000);

      setInterval(() => {
        autoUpdater.checkForUpdates();
      }, 10 * 60 * 1000);
    }
  });

  // 处理窗口关闭
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 处理外部链接（在浏览器中打开）
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // 创建应用菜单
  createApplicationMenu();
}

// 创建应用菜单
function createApplicationMenu() {
  const isMac = process.platform === 'darwin';

  const template = [
    // 应用菜单 (macOS)
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
    // 文件菜单
    {
      label: '文件',
      submenu: [
        { role: 'close' },
        { type: 'separator' },
        {
          label: '导出数据',
          click: () => exportUserData()
        },
        {
          label: '导入数据',
          click: () => importUserData()
        },
        ...(!isMac ? [{ type: 'separator' }, { role: 'quit' }] : [])
      ]
    },
    // 编辑菜单
    {
      label: '编辑',
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
              label: '语音',
              submenu: [{ role: 'startSpeaking' }, { role: 'stopSpeaking' }]
            }
          ]
          : [{ role: 'delete' }, { type: 'separator' }, { role: 'selectAll' }])
      ]
    },
    // 视图菜单
    {
      label: '视图',
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
    // 帮助菜单
    {
      label: '帮助',
      submenu: [
        {
          label: '使用说明',
          click: () => {
            shell.openExternal('https://github.com/anton-bis/toefl-app#readme');
          }
        },
        {
          label: '检查更新',
          click: () => {
            autoUpdater.checkForUpdatesAndNotify();
          }
        },
        { type: 'separator' },
        {
          label: '关于托福模考系统',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: '关于托福模考系统',
              message: `托福模考系统 v${app.getVersion()}`,
              detail: '一款专业的托福考试模拟练习软件\n\n© 2026 下士小龙虾\n所有权利保留。',
              buttons: ['确定']
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// 导出用户数据
async function exportUserData() {
  if (!mainWindow) return;

  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    title: '导出用户数据',
    defaultPath: `toefl-data-${Date.now()}.json`,
    filters: [
      { name: 'JSON文件', extensions: ['json'] },
      { name: '所有文件', extensions: ['*'] }
    ]
  });

  if (filePath) {
    authorizedExports.add(path.resolve(filePath));
    mainWindow.webContents.send('export-user-data', filePath);
  }
}

// 导入用户数据
async function importUserData() {
  if (!mainWindow) return;

  const { filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: '导入用户数据',
    filters: [
      { name: 'JSON文件', extensions: ['json'] },
      { name: '所有文件', extensions: ['*'] }
    ],
    properties: ['openFile']
  });

  if (filePaths.length > 0) {
    authorizedImports.add(path.resolve(filePaths[0]));
    mainWindow.webContents.send('import-user-data', filePaths[0]);
  }
}

// IPC处理器
function setupIpcHandlers() {
  ipcMain.handle('user-data:write', async (event, filePath, payload) => {
    const resolved = path.resolve(String(filePath || ''));
    if (!isTrustedRenderer(event) || !authorizedExports.delete(resolved)) {
      throw new Error('未授权的导出路径');
    }
    const serialized = JSON.stringify(payload, null, 2);
    if (Buffer.byteLength(serialized) > 25 * 1024 * 1024) throw new Error('导出数据过大');
    const temporary = `${resolved}.tmp-${process.pid}`;
    await fs.promises.writeFile(temporary, serialized, { encoding: 'utf8', mode: 0o600 });
    await fs.promises.rename(temporary, resolved);
    return true;
  });

  ipcMain.handle('user-data:read', async (event, filePath) => {
    const resolved = path.resolve(String(filePath || ''));
    if (!isTrustedRenderer(event) || !authorizedImports.delete(resolved)) {
      throw new Error('未授权的导入路径');
    }
    const stats = await fs.promises.stat(resolved);
    if (stats.size > 25 * 1024 * 1024) throw new Error('导入数据过大');
    return JSON.parse(await fs.promises.readFile(resolved, 'utf8'));
  });

  // 内容热更新
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

// 自动更新事件处理器
function setupAutoUpdater() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on('checking-for-update', () => {
    console.log('正在检查更新...');
  });

  autoUpdater.on('update-available', info => {
    console.log('发现新版本:', info.version);
    if (mainWindow) {
      mainWindow.webContents.send('update:available', info);
    }
  });

  autoUpdater.on('update-not-available', () => {
    console.log('当前已是最新版本');
  });

  autoUpdater.on('error', err => {
    console.error('更新检查失败:', err);
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
    console.log('更新下载完成:', info.version);
    if (mainWindow) {
      mainWindow.webContents.send('update:downloaded', info);
    }
  });
}

// 初始化应用
function initializeApp() {
  try {
    console.log('初始化应用...');

    // 设置IPC处理器
    setupIpcHandlers();
    console.log('IPC处理器设置完成');

    setupContentProtocol();
    console.log('内容协议初始化完成');

    // 设置自动更新
    if (app.isPackaged) {
      setupAutoUpdater();
      console.log('自动更新设置完成');
    }

    // 创建窗口
    createWindow();
    console.log('主窗口创建完成');

    // 后台静默检查内容更新
    checkForContentUpdates()
      .then(result => {
        if (result.hasUpdate) {
          console.log(`发现内容更新：v${result.localVersion} → v${result.remoteVersion}`);
          if (mainWindow) {
            mainWindow.webContents.send('content:update-available', result);
          }
        }
      })
      .catch(err => console.warn('内容更新检查失败:', err.message));
  } catch (error) {
    console.error('应用初始化失败:', error);
    dialog.showErrorBox('应用初始化失败', error.message);
    app.quit();
  }
}

// 应用准备就绪
app.whenReady().then(initializeApp);

// 所有窗口关闭时退出应用（macOS除外）
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// macOS：点击dock图标时重新创建窗口
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// 处理未捕获的异常
process.on('uncaughtException', error => {
  console.error('未捕获的异常:', error);
  dialog.showErrorBox('应用错误', `未捕获的异常: ${error.message}`);
});

// 处理未处理的Promise拒绝
process.on('unhandledRejection', reason => {
  console.error('未处理的Promise拒绝:', reason);
});
