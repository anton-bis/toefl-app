const { contextBridge, ipcRenderer } = require('electron');

// 安全地暴露受限制的API给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 许可证相关
  checkLicense: () => ipcRenderer.invoke('license:check'),
  activateLicense: licenseKey => ipcRenderer.invoke('license:activate', licenseKey),

  // 应用信息
  getAppInfo: () => ipcRenderer.invoke('app:getInfo'),

  // 开发者工具
  openDevTools: () => ipcRenderer.send('devtools:open'),

  // 应用控制
  restartApp: () => ipcRenderer.send('app:restart'),

  // 更新相关
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  downloadUpdate: () => ipcRenderer.invoke('update:download'),
  quitAndInstall: () => ipcRenderer.invoke('update:quit-and-install'),

  // 导出/导入数据
  exportUserData: filePath => ipcRenderer.invoke('export:user-data', filePath),
  importUserData: filePath => ipcRenderer.invoke('import:user-data', filePath),

  // 内容热更新
  checkContentUpdate: () => ipcRenderer.invoke('content:check'),
  applyContentUpdate: () => ipcRenderer.invoke('content:apply'),
  getContentPath: subPath => ipcRenderer.invoke('content:get-path', subPath),
  listContentFiles: relDir => ipcRenderer.invoke('content:list', relDir),

  // 事件监听器
  onUpdateAvailable: callback =>
    ipcRenderer.on('update:available', (_event, info) => callback(info)),
  onUpdateNotAvailable: callback =>
    ipcRenderer.on('update:not-available', (_event, info) => callback(info)),
  onUpdateError: callback => ipcRenderer.on('update:error', (_event, error) => callback(error)),
  onUpdateProgress: callback =>
    ipcRenderer.on('update:progress', (_event, progress) => callback(progress)),
  onUpdateDownloaded: callback =>
    ipcRenderer.on('update:downloaded', (_event, info) => callback(info)),
  onContentUpdateAvailable: callback =>
    ipcRenderer.on('content:update-available', (_event, info) => callback(info)),

  // 清理事件监听器
  removeAllListeners: channel => ipcRenderer.removeAllListeners(channel)
});

// 监听来自主进程的导出/导入数据请求
ipcRenderer.on('export-user-data', (_event, filePath) => {
  // 触发渲染进程中的数据导出
  window.dispatchEvent(new CustomEvent('electron-export-data', { detail: { filePath } }));
});

ipcRenderer.on('import-user-data', (_event, filePath) => {
  // 触发渲染进程中的数据导入
  window.dispatchEvent(new CustomEvent('electron-import-data', { detail: { filePath } }));
});
