const { contextBridge, ipcRenderer } = require('electron');

function subscribe(channel, callback) {
  const handler = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

const dataRequest = (operation, payload) => ipcRenderer.invoke('data:request', operation, payload);

// Expose a minimal, restricted API to the renderer.
contextBridge.exposeInMainWorld('electronAPI', {
  // App updates
  getUpdateState: () => ipcRenderer.invoke('update:get-state'),
  downloadUpdate: () => ipcRenderer.invoke('update:download'),
  retryUpdate: () => ipcRenderer.invoke('update:retry'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  resumeBackgroundChecks: () => ipcRenderer.invoke('background:resume-checks'),

  // Structured learning data. The renderer cannot issue SQL or access arbitrary paths.
    data: {
      bootstrap: () => dataRequest('bootstrap'),
      ready: () => ipcRenderer.send('data:renderer-ready'),
      settings: {
        set: (key, value) => dataRequest('settings:set', { key, value })
      },
    exam: {
      save: session => dataRequest('exam:save', session),
      delete: id => dataRequest('exam:delete', { id }),
      listCompleted: limit => dataRequest('exam:listCompleted', { limit })
    },
    attempt: {
      finalize: session => dataRequest('attempt:finalize', { session })
    },
    vocabulary: {
      list: subject => dataRequest('vocabulary:list', { subject }),
      save: payload => dataRequest('vocabulary:save', payload),
      overview: date => dataRequest('vocabulary:overview', { date })
    },
    typing: {
      list: () => dataRequest('typing:list'),
      replace: history => dataRequest('typing:replace', { history })
    },
    recording: {
      save: payload => dataRequest('recording:save', payload),
      load: payload => dataRequest('recording:load', payload),
      remove: payload => dataRequest('recording:remove', payload),
      removeAttempt: clientAttemptId => dataRequest('recording:removeAttempt', { clientAttemptId }),
      playbackUrl: (clientAttemptId, questionKey) => {
        const parameters = new URLSearchParams({
          attempt: clientAttemptId,
          question: String(questionKey)
        });
        return `toefl-recording://playback/audio?${parameters}`;
      }
    },
    onFlush: callback => subscribe('data:flush', callback),
    flushed: result => ipcRenderer.send('data:flushed', result)
  },

  // Runtime content updates
  initializeContent: () => ipcRenderer.invoke('content:initialize'),
  retryContent: () => ipcRenderer.invoke('content:retry'),
  getContentDescriptor: () => ipcRenderer.invoke('content:get-descriptor'),
  setContentBusy: busy => ipcRenderer.invoke('content:set-busy', Boolean(busy)),
  getContentAssetUrl: relativePath =>
    `toefl-content://content/${String(relativePath)
      .replace(/^\/+/, '')
      .split('/')
      .map(encodeURIComponent)
      .join('/')}`,

  // Event listeners
  onUpdateState: callback => subscribe('update:state', callback),
  onContentState: callback => subscribe('content:state', callback),
  onContentActivated: callback => subscribe('content:activated', callback)
});
