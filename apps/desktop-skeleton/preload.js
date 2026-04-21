// Minimal preload to expose a safe IPC surface for future data access
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopAPI', {
  // Placeholder for future storage/read operations
  getStored: async (key) => {
    return ipcRenderer.invoke('storage-get', key);
  },
  setStored: async (key, value) => {
    return ipcRenderer.invoke('storage-set', key, value);
  }
});
