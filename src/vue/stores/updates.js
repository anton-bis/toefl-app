import { defineStore } from 'pinia';

const NOTICE_STATES = new Set([
  'checking',
  'up-to-date',
  'available',
  'downloading',
  'downloaded',
  'installing',
  'error'
]);

export const useUpdatesStore = defineStore('updates', {
  state: () => ({
    initialized: false,
    revision: -1,
    status: 'idle',
    version: '',
    description: '',
    progress: 0,
    error: '',
    retryAction: '',
    updateNotice: false,
    installBlocked: false,
    installMode: 'automatic',
    updateDismissed: false,
    contentReady: !window.electronAPI,
    contentStatus: window.electronAPI ? 'idle' : 'ready',
    contentProgress: window.electronAPI ? 0 : 100,
    contentError: '',
    contentActivation: 0,
    cleanups: []
  }),
  getters: {
    showUpdate: state =>
      !state.updateDismissed && state.updateNotice && NOTICE_STATES.has(state.status)
  },
  actions: {
    async initialize() {
      if (this.initialized || !window.electronAPI) return;
      this.initialized = true;
      const listen = (method, callback) => {
        const cleanup = window.electronAPI[method]?.(callback);
        if (typeof cleanup === 'function') this.cleanups.push(cleanup);
      };
      listen('onUpdateState', state => this.applyUpdateState(state));
      listen('onContentState', state => this.applyContentState(state));
      listen('onContentActivated', () => {
        this.contentActivation += 1;
      });
      const resumeChecks = () => window.electronAPI.resumeBackgroundChecks?.().catch(() => {});
      window.addEventListener('online', resumeChecks);
      this.cleanups.push(() => window.removeEventListener('online', resumeChecks));
      const [updateState, contentState] = await Promise.all([
        window.electronAPI.getUpdateState(),
        window.electronAPI.initializeContent()
      ]);
      this.applyUpdateState(updateState);
      this.applyContentState(contentState);
    },
    applyUpdateState(state = {}) {
      const revision = Number.isSafeInteger(state.revision) ? state.revision : this.revision + 1;
      if (revision < this.revision) return;
      const previousStatus = this.status;
      this.revision = revision;
      this.status = state.status || this.status;
      this.version = state.version ?? this.version;
      this.description = state.description ?? this.description;
      this.progress = Number.isFinite(state.progress) ? state.progress : this.progress;
      this.error = state.error || '';
      this.retryAction = state.retryAction || '';
      this.updateNotice = Boolean(state.notice);
      this.installBlocked = Boolean(state.installBlocked);
      this.installMode = state.installMode || this.installMode;
      if (
        this.status !== previousStatus &&
        ['available', 'downloaded', 'up-to-date', 'error'].includes(this.status)
      ) {
        this.updateDismissed = false;
      }
    },
    async runUpdateAction(method) {
      try {
        this.applyUpdateState(await window.electronAPI?.[method]?.());
      } catch (error) {
        this.revision += 1;
        this.status = 'error';
        this.error = error?.message || 'The update action failed.';
        this.retryAction = method === 'downloadUpdate' ? 'download' : 'check';
        this.updateNotice = true;
        this.updateDismissed = false;
      }
    },
    downloadUpdate() {
      return this.runUpdateAction('downloadUpdate');
    },
    retryUpdate() {
      return this.runUpdateAction('retryUpdate');
    },
    installUpdate() {
      return this.runUpdateAction('installUpdate');
    },
    dismissUpdate() {
      this.updateDismissed = true;
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
