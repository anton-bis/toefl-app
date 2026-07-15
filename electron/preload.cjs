const { contextBridge, ipcRenderer } = require('electron');

function subscribe(channel, callback) {
  const handler = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

// 安全地暴露受限制的API给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 更新相关
  downloadUpdate: () => ipcRenderer.invoke('update:download'),
  quitAndInstall: () => ipcRenderer.invoke('update:quit-and-install'),

  // 导出/导入数据
  writeUserData: (filePath, payload) => ipcRenderer.invoke('user-data:write', filePath, payload),
  readUserData: filePath => ipcRenderer.invoke('user-data:read', filePath),

  // 内容热更新
  applyContentUpdate: () => ipcRenderer.invoke('content:apply'),
  readContentFile: relativePath => ipcRenderer.invoke('content:read', relativePath),
  getContentAssetUrl: relativePath =>
    `toefl-content://content/${String(relativePath)
      .replace(/^\/+/, '')
      .split('/')
      .map(encodeURIComponent)
      .join('/')}`,

  // 事件监听器
  onUpdateAvailable: callback => subscribe('update:available', callback),
  onUpdateError: callback => subscribe('update:error', callback),
  onUpdateProgress: callback => subscribe('update:progress', callback),
  onUpdateDownloaded: callback => subscribe('update:downloaded', callback),
  onContentUpdateAvailable: callback => subscribe('content:update-available', callback)
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
