import path from 'node:path';
import { createDeviceFingerprint } from './device-fingerprint.js';
import { resolveApiBaseUrl } from './license-config.js';
import { createLicenseClient, LicenseError } from './license-client.js';
import { createLicenseStore } from './license-store.js';

/**
 * License orchestration (license-protocol-v1), running in the main process.
 *
 * Responsibilities:
 * - serial activation, renewal and unbind against the Web license server
 * - local persistence of deviceId + activationToken (safeStorage)
 * - periodic renewal (≥7 days) with a 30-day offline grace
 * - lock the device when expired so the renderer can prompt re-activation
 */

export const REFRESH_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
export const BACKGROUND_CHECK_MS = 6 * 60 * 60 * 1000;
export const OFFLINE_GRACE_MS = 30 * 24 * 60 * 60 * 1000;

const SERIAL_PATTERN = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

const FRIENDLY_MESSAGES = {
  'LICENSE:INVALID': '序列号无效或已作废，请核对后重试',
  'LICENSE:DEVICE_LIMIT': '该序列号已达到 2 台设备上限',
  'LICENSE:DEVICE_INVALID': '许可证失效，请联网重新激活'
};

const EMPTY_STATE = {
  status: 'none', // 'none' | 'active' | 'locked'
  code: '',
  deviceId: '',
  activationToken: '',
  expiresAt: null,
  lastRefreshAt: null,
  activatedAt: null,
  devices: [],
  deviceCount: 0,
  error: null
};

export function normalizeSerialCode(value) {
  const compact = String(value || '').toUpperCase().replace(/[\s-]/g, '');
  if (/^[A-Z0-9]{16}$/.test(compact)) {
    return `${compact.slice(0, 4)}-${compact.slice(4, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}`;
  }
  return String(value || '').toUpperCase().trim();
}

function toTimestamp(value, fallback) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export function createLicenseService({
  userDataPath,
  safeStorage,
  fetchImplementation,
  emitState = () => {},
  now = Date.now,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  fingerprintFactory,
  baseUrl
} = {}) {
  const store = createLicenseStore({
    filePath: path.join(userDataPath, 'license-state.json'),
    safeStorage
  });
  const client = createLicenseClient({
    baseUrl: baseUrl !== undefined ? baseUrl : resolveApiBaseUrl({ userDataPath }),
    fetchImplementation
  });
  const fingerprintFactoryFn =
    fingerprintFactory || (() => createDeviceFingerprint({ userDataPath }));

  const loaded = store.load();
  let state = loaded
    ? { ...EMPTY_STATE, ...loaded, status: 'active', error: null }
    : { ...EMPTY_STATE };
  let checkTimer;
  let fingerprintCache;
  let refreshing = false;

  const publicState = () => ({
    status: state.status,
    deviceId: state.deviceId,
    expiresAt: state.expiresAt,
    lastRefreshAt: state.lastRefreshAt,
    activatedAt: state.activatedAt,
    devices: state.devices,
    deviceCount: state.deviceCount,
    error: state.error
  });

  const emit = () => emitState(publicState());

  const fingerprint = () => {
    fingerprintCache ??= String(fingerprintFactoryFn());
    return fingerprintCache;
  };

  const friendlyError = error => {
    if (error instanceof LicenseError) {
      const message = FRIENDLY_MESSAGES[error.code];
      if (message) {
        return new LicenseError({
          code: error.code,
          status: error.status,
          message,
          requestId: error.requestId
        });
      }
      return error;
    }
    return new LicenseError({ code: 'LICENSE:NETWORK', message: '无法连接服务器，请检查网络后重试' });
  };

  async function refreshDevice() {
    if (!state.deviceId || !state.activationToken || refreshing) return;
    refreshing = true;
    try {
      const result = await client.refresh({
        deviceId: state.deviceId,
        deviceFingerprint: fingerprint(),
        activationToken: state.activationToken
      });
      state = {
        ...state,
        status: 'active',
        error: null,
        expiresAt: toTimestamp(result.expiresAt, now() + OFFLINE_GRACE_MS),
        lastRefreshAt: now(),
        devices: Array.isArray(result.devices) ? result.devices : state.devices,
        deviceCount: Number.isFinite(result.deviceCount) ? result.deviceCount : state.deviceCount
      };
      store.save(state);
      emit();
    } catch (error) {
      const expired = state.expiresAt ? now() >= state.expiresAt : true;
      const invalid = error instanceof LicenseError && error.code === 'LICENSE:DEVICE_INVALID';
      if (expired || invalid) {
        state = {
          ...state,
          status: 'locked',
          error: { code: 'LICENSE:EXPIRED', message: '许可证已过期，请联网重新激活' }
        };
        emit();
      }
    } finally {
      refreshing = false;
    }
  }

  async function renewCheck() {
    if (!state.deviceId || !state.activationToken) return publicState();
    const timestamp = now();
    const expired = state.expiresAt ? timestamp >= state.expiresAt : false;
    const due = state.lastRefreshAt !== null && state.lastRefreshAt !== undefined
      ? timestamp - state.lastRefreshAt >= REFRESH_INTERVAL_MS
      : true;
    if (expired || due) await refreshDevice();
    return publicState();
  }

  async function activate({ code }) {
    const normalized = normalizeSerialCode(code);
    if (!SERIAL_PATTERN.test(normalized)) {
      throw new LicenseError({
        code: 'LICENSE:FORMAT',
        status: 400,
        message: '请输入正确的序列号（XXXX-XXXX-XXXX-XXXX）'
      });
    }
    try {
      const result = await client.activate({
        code: normalized,
        deviceFingerprint: fingerprint()
      });
      state = {
        ...EMPTY_STATE,
        status: 'active',
        code: normalized,
        deviceId: String(result.deviceId || ''),
        activationToken: String(result.activationToken || ''),
        expiresAt: toTimestamp(result.expiresAt, now() + OFFLINE_GRACE_MS),
        lastRefreshAt: now(),
        activatedAt: now(),
        devices: Array.isArray(result.devices) ? result.devices : [],
        deviceCount: Number.isFinite(result.deviceCount) ? result.deviceCount : 0
      };
      store.save(state);
      emit();
      return publicState();
    } catch (error) {
      throw friendlyError(error);
    }
  }

  async function unbind() {
    if (!state.deviceId || !state.activationToken || !state.code) {
      throw new LicenseError({ code: 'LICENSE:NOT_ACTIVATED', message: '本机尚未激活' });
    }
    try {
      await client.unbind({
        deviceId: state.deviceId,
        code: state.code,
        activationToken: state.activationToken
      });
    } catch (error) {
      throw friendlyError(error);
    }
    store.clear();
    state = { ...EMPTY_STATE };
    emit();
    return publicState();
  }

  function start() {
    if (checkTimer) return;
    renewCheck().catch(() => {});
    checkTimer = setTimer(() => {
      renewCheck().catch(() => {});
    }, BACKGROUND_CHECK_MS);
    checkTimer.unref?.();
  }

  function stop() {
    if (checkTimer) {
      clearTimer(checkTimer);
      checkTimer = undefined;
    }
  }

  return {
    getState: publicState,
    renewCheck,
    checkNow: renewCheck,
    activate,
    unbind,
    start,
    stop
  };
}

export function registerLicenseIpc({ ipcMain, isTrustedRenderer, ...serviceOptions }) {
  const service = createLicenseService(serviceOptions);

  const handle = operation => async event => {
    if (!isTrustedRenderer(event)) {
      return { ok: false, error: { code: 'LICENSE:UNTRUSTED', message: 'Unauthorized license request.' } };
    }
    try {
      return { ok: true, state: await operation(event) };
    } catch (error) {
      return {
        ok: false,
        error: { code: error?.code || 'LICENSE:NETWORK', message: error?.message || '许可证服务请求失败' }
      };
    }
  };

  ipcMain.handle('license:get-state', handle(() => service.getState()));
  ipcMain.handle('license:activate', handle((event, code) => service.activate({ code })));
  ipcMain.handle('license:refresh', handle(() => service.renewCheck()));
  ipcMain.handle('license:unbind', handle(() => service.unbind()));

  return service;
}
