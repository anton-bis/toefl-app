import { defineStore } from 'pinia';

export const useUpdatesStore = defineStore('updates', {
  state: () => ({
    initialized: false,
    status: 'idle',
    version: '',
    description: '',
    progress: 0,
    error: '',
    contentUpdate: null,
    cleanups: []
  }),
  getters: {
    hasUpdate: state => ['available', 'downloading', 'downloaded'].includes(state.status)
  },
  actions: {
    initialize() {
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
        this.error = String(error || '更新失败');
      });
      listen('onContentUpdateAvailable', info => {
        this.contentUpdate = info;
      });
    },
    async download() {
      this.status = 'downloading';
      this.error = '';
      try {
        await window.electronAPI?.downloadUpdate();
      } catch (error) {
        this.status = 'error';
        this.error = error?.message || '更新下载失败';
      }
    },
    install() {
      window.electronAPI?.quitAndInstall();
    },
    async applyContent() {
      if (!window.electronAPI) return;
      this.status = 'downloading';
      try {
        await window.electronAPI.applyContentUpdate();
        this.contentUpdate = null;
        window.location.reload();
      } catch (error) {
        this.status = 'error';
        this.error = error.message;
      }
    },
    dispose() {
      this.cleanups.forEach(cleanup => cleanup());
      this.cleanups = [];
      this.initialized = false;
    }
  }
});
