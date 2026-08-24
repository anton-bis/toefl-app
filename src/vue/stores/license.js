import { defineStore } from 'pinia';

/**
 * Renderer-side license store (license-protocol-v1).
 *
 * Wraps electronAPI.license and exposes only the sanitized public state. In
 * browser mode (no electronAPI) the store reports 'unavailable', which keeps
 * all content open for development.
 */

const EMPTY_STATE = {
  status: 'unavailable', // 'unavailable' | 'none' | 'active' | 'locked'
  deviceId: '',
  expiresAt: null,
  lastRefreshAt: null,
  activatedAt: null,
  devices: [],
  deviceCount: 0,
  error: null
};

const unsubscribeByStore = new WeakMap();

export const useLicenseStore = defineStore('license', {
  state: () => ({ ...EMPTY_STATE, ready: false }),
  getters: {
    isDesktop: state => state.status !== 'unavailable',
    activated: state => state.status === 'active',
    contentLocked: state => state.status === 'none' || state.status === 'locked'
  },
  actions: {
    applyState(state) {
      if (!state) return;
      this.status = state.status || 'none';
      this.deviceId = state.deviceId || '';
      this.expiresAt = state.expiresAt || null;
      this.lastRefreshAt = state.lastRefreshAt || null;
      this.activatedAt = state.activatedAt || null;
      this.devices = Array.isArray(state.devices) ? state.devices : [];
      this.deviceCount = Number.isFinite(state.deviceCount) ? state.deviceCount : 0;
      this.error = state.error || null;
      this.ready = true;
    },
    async initialize() {
      const api = window.electronAPI?.license;
      if (!api) {
        this.status = 'unavailable';
        this.ready = true;
        return;
      }
      unsubscribeByStore.get(this)?.();
      unsubscribeByStore.set(this, api.onState(state => this.applyState(state)));
      await this.refresh();
    },
    async refresh() {
      const api = window.electronAPI?.license;
      if (!api) {
        this.status = 'unavailable';
        this.ready = true;
        return;
      }
      const result = await api.getState();
      if (result?.ok) this.applyState(result.state);
      this.ready = true;
    },
    async activate(code) {
      const api = window.electronAPI?.license;
      if (!api) return { ok: false, error: { message: '当前环境不支持激活' } };
      const result = await api.activate(code);
      if (result?.ok) {
        this.applyState(result.state);
        return { ok: true, state: result.state };
      }
      return { ok: false, error: result?.error || { message: '激活失败，请重试' } };
    },
    async refreshNow() {
      const api = window.electronAPI?.license;
      if (!api) return { ok: false };
      const result = await api.refresh();
      if (result?.ok) this.applyState(result.state);
      return result || { ok: false };
    },
    async unbind() {
      const api = window.electronAPI?.license;
      if (!api) return { ok: false, error: { message: '当前环境不支持解绑' } };
      const result = await api.unbind();
      if (result?.ok) {
        this.applyState(result.state);
        return { ok: true };
      }
      return { ok: false, error: result?.error || { message: '解绑失败，请重试' } };
    },
    dispose() {
      unsubscribeByStore.get(this)?.();
      unsubscribeByStore.delete(this);
    }
  }
});
