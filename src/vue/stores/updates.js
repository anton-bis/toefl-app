import { defineStore } from 'pinia';

export const useUpdatesStore = defineStore('updates', {
  state: () => ({
    initialized: false,
    status: 'idle',
    version: '',
    description: '',
    progress: 0,
    error: '',
    contentReady: !window.electronAPI,
    contentStatus: window.electronAPI ? 'idle' : 'ready',
    contentProgress: window.electronAPI ? 0 : 100,
    contentError: '',
    contentActivation: 0,
    cleanups: []
  }),
  getters: {
    hasUpdate: state => ['available', 'downloading', 'downloaded'].includes(state.status)
  },
  actions: {
    async initialize() {
      if (this.initialized || !window.electronAPI) return;
      this.initialized = true;
      const listen = (method, callback) => {
        const cleanup = window.electronAPI[method]?.(callback);
        if (typeof cleanup === 'function') this.cleanups.push(cleanup);
      };
      listen('onUpdateAvailable', info => {
        this.status = 'available';
        this.version = info?.version || '';
        this.description = info?.releaseNotes || '';
      });
      listen('onUpdateProgress', progress => {
        this.status = 'downloading';
        this.progress = Math.round(progress?.percent || 0);
      });
      listen('onUpdateDownloaded', info => {
        this.status = 'downloaded';
        this.version = info?.version || this.version;
      });
      listen('onUpdateError', error => {
        this.status = 'error';
        this.error = String(error || 'Update failed.');
      });
      listen('onContentState', state => {
        this.applyContentState(state);
      });
      listen('onContentActivated', () => {
        this.contentActivation += 1;
      });
      this.applyContentState(await window.electronAPI.initializeContent());
    },
    async download() {
      this.status = 'downloading';
      this.error = '';
      try {
        await window.electronAPI?.downloadUpdate();
      } catch (error) {
        this.status = 'error';
        this.error = error?.message || 'Unable to download the update.';
      }
    },
    install() {
      window.electronAPI?.quitAndInstall();
    },
    applyContentState(state = {}) {
      this.contentStatus = state.status || this.contentStatus;
      this.contentReady = Boolean(state.ready);
      this.contentProgress = Number.isFinite(state.progress)
        ? state.progress
        : this.contentProgress;
      this.contentError = state.error || '';
    },
    async retryContent() {
      if (!window.electronAPI) return;
      this.contentStatus = 'checking';
      this.contentError = '';
      try {
        this.applyContentState(await window.electronAPI.retryContent());
      } catch (error) {
        this.contentStatus = 'error';
        this.contentError = error.message;
      }
    },
    dispose() {
      this.cleanups.forEach(cleanup => cleanup());
      this.cleanups = [];
      this.initialized = false;
    }
  }
});
