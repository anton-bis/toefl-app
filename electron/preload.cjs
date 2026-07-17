const { contextBridge, ipcRenderer } = require('electron');

function subscribe(channel, callback) {
  const handler = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

// Expose a minimal, restricted API to the renderer.
contextBridge.exposeInMainWorld('electronAPI', {
  // App updates
  downloadUpdate: () => ipcRenderer.invoke('update:download'),
  quitAndInstall: () => ipcRenderer.invoke('update:quit-and-install'),

  // Data import and export
  writeUserData: (filePath, payload) => ipcRenderer.invoke('user-data:write', filePath, payload),
  readUserData: filePath => ipcRenderer.invoke('user-data:read', filePath),

  // Runtime content updates
  applyContentUpdate: () => ipcRenderer.invoke('content:apply'),
  readContentFile: relativePath => ipcRenderer.invoke('content:read', relativePath),
  getContentAssetUrl: relativePath =>
    `toefl-content://content/${String(relativePath)
      .replace(/^\/+/, '')
      .split('/')
      .map(encodeURIComponent)
      .join('/')}`,

  // Event listeners
  onUpdateAvailable: callback => subscribe('update:available', callback),
  onUpdateError: callback => subscribe('update:error', callback),
  onUpdateProgress: callback => subscribe('update:progress', callback),
  onUpdateDownloaded: callback => subscribe('update:downloaded', callback),
  onContentUpdateAvailable: callback => subscribe('content:update-available', callback)
});

// Forward import and export requests from the main process.
ipcRenderer.on('export-user-data', (_event, filePath) => {
  // Ask the renderer to export its data.
  window.dispatchEvent(new CustomEvent('electron-export-data', { detail: { filePath } }));
});

ipcRenderer.on('import-user-data', (_event, filePath) => {
  // Ask the renderer to import data.
  window.dispatchEvent(new CustomEvent('electron-import-data', { detail: { filePath } }));
});
