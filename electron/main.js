import { app, BrowserWindow, ipcMain, shell, dialog, Menu, session } from 'electron';
import pkg from 'electron-updater';
const { autoUpdater } = pkg;
import path from 'path';
import { fileURLToPath } from 'url';
import { initDatabase, closeDatabase } from './services/database.js';
import { checkLicense, activateLicense } from './services/license.js';
import {
  checkForContentUpdates,
  runContentUpdate,
  getContentPath,
  listContentFiles
} from './services/content-updater.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 启用生产模式优化
if (process.env.NODE_ENV === 'production') {
  import('source-map-support').then(module => module.install());
}

// 全局窗口引用
let mainWindow = null;

// 创建主窗口
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    icon: path.join(__dirname, '../assets/icons/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: process.env.NODE_ENV === 'production'
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
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media') callback(true);
    else callback(false);
  });

  // 窗口准备就绪后显示
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();

    // 检查更新（生产环境）
    if (process.env.NODE_ENV === 'production') {
      setTimeout(() => {
        autoUpdater.checkForUpdatesAndNotify();
      }, 5000);
    }
  });

  // 处理窗口关闭
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 处理外部链接（在浏览器中打开）
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
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
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' }
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
            shell.openExternal('https://github.com/yourusername/toefl-practice-system/wiki');
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
              message: '托福模考系统 v1.0.0',
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
    mainWindow.webContents.send('import-user-data', filePaths[0]);
  }
}

// IPC处理器
function setupIpcHandlers() {
  // 检查许可证
  ipcMain.handle('license:check', async () => {
    return await checkLicense();
  });

  // 激活许可证
  ipcMain.handle('license:activate', async (event, licenseKey) => {
    return await activateLicense(licenseKey);
  });

  // 获取应用信息
  ipcMain.handle('app:getInfo', () => {
    return {
      version: app.getVersion(),
      name: app.name,
      platform: process.platform,
      arch: process.arch,
      isPackaged: app.isPackaged,
      userDataPath: app.getPath('userData')
    };
  });

  // 打开开发者工具
  ipcMain.on('devtools:open', () => {
    if (mainWindow) {
      mainWindow.webContents.openDevTools();
    }
  });

  // 重启应用
  ipcMain.on('app:restart', () => {
    app.relaunch();
    app.exit(0);
  });

  // 内容热更新
  ipcMain.handle('content:check', async () => {
    return await checkForContentUpdates();
  });

  ipcMain.handle('content:apply', async () => {
    return await runContentUpdate();
  });

  ipcMain.handle('content:get-path', (_event, subPath) => {
    return getContentPath(subPath);
  });

  ipcMain.handle('content:list', (_event, relDir) => {
    return listContentFiles(relDir || '');
  });
}

// 自动更新事件处理器
function setupAutoUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    console.log('正在检查更新...');
  });

  autoUpdater.on('update-available', info => {
    console.log('发现新版本:', info.version);
    if (mainWindow) {
      mainWindow.webContents.send('update:available', info);
    }
  });

  autoUpdater.on('update-not-available', info => {
    console.log('当前已是最新版本');
    if (mainWindow) {
      mainWindow.webContents.send('update:not-available', info);
    }
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
async function initializeApp() {
  try {
    console.log('初始化应用...');

    // 初始化数据库
    await initDatabase();
    console.log('数据库初始化完成');

    // 检查许可证
    const licenseStatus = await checkLicense();
    console.log('许可证状态:', licenseStatus);

    // 设置IPC处理器
    setupIpcHandlers();
    console.log('IPC处理器设置完成');

    // 设置自动更新（生产环境）
    if (process.env.NODE_ENV === 'production') {
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

// 应用即将退出
app.on('before-quit', async () => {
  console.log('应用正在退出，清理资源...');

  try {
    // 关闭数据库连接
    await closeDatabase();
    console.log('数据库连接已关闭');
  } catch (error) {
    console.error('关闭数据库连接失败:', error);
  }
});

// 处理未捕获的异常
process.on('uncaughtException', error => {
  console.error('未捕获的异常:', error);
  dialog.showErrorBox('应用错误', `未捕获的异常: ${error.message}`);
});

// 处理未处理的Promise拒绝
process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的Promise拒绝:', reason);
});
