import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  DEFAULT_API_BASE_URL,
  normalizeApiBaseUrl,
  resolveApiBaseUrl
} from '../../electron/services/license-config.js';
import { LicenseError, createLicenseClient } from '../../electron/services/license-client.js';
import { createLicenseStore } from '../../electron/services/license-store.js';
import {
  BACKGROUND_CHECK_MS,
  OFFLINE_GRACE_MS,
  REFRESH_INTERVAL_MS,
  createLicenseService,
  normalizeSerialCode,
  registerLicenseIpc
} from '../../electron/services/license.js';

const DAY = 24 * 60 * 60 * 1000;
const ACTIVATE_EXPIRES_AT = 10 * DAY; // mock server grants 10 days
const REFRESH_EXPIRES_AT = 40 * DAY;

const fakeSafeStorage = {
  isEncryptionAvailable: () => true,
  encryptString: value => Buffer.from(`enc:${value}`),
  decryptString: buffer => buffer.toString('utf8').replace(/^enc:/, '')
};

const plainSafeStorage = {
  isEncryptionAvailable: () => false,
  encryptString: () => {
    throw new Error('keyring unavailable');
  },
  decryptString: () => {
    throw new Error('keyring unavailable');
  }
};

function tempDir(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'toefl-license-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  };
}

function createFetch(handler) {
  return async (url, options) => handler(String(url), JSON.parse(options.body || '{}'));
}

function makeClock(initial = 0) {
  let value = initial;
  return { now: () => value, advance: ms => (value += ms) };
}

// ---------------------------------------------------------------- config

test('normalizeApiBaseUrl trims slashes and keeps http(s) only', () => {
  assert.equal(normalizeApiBaseUrl('http://localhost:3001'), 'http://localhost:3001/');
  assert.equal(normalizeApiBaseUrl('https://api.example.com/'), 'https://api.example.com/');
  assert.equal(normalizeApiBaseUrl('https://api.example.com/api'), 'https://api.example.com/api/');
  assert.equal(normalizeApiBaseUrl('ftp://x'), '');
  assert.equal(normalizeApiBaseUrl(''), '');
});

test('resolveApiBaseUrl prefers env, then config file, then default', t => {
  const directory = tempDir(t);

  assert.equal(
    resolveApiBaseUrl({ env: { TOEFL_API_BASE_URL: 'https://env.example.com/v1' }, userDataPath: directory }),
    'https://env.example.com/v1/'
  );

  fs.writeFileSync(
    path.join(directory, 'web-config.json'),
    JSON.stringify({ apiBaseUrl: 'https://config.example.com/' })
  );
  assert.equal(resolveApiBaseUrl({ env: {}, userDataPath: directory }), 'https://config.example.com/');

  fs.unlinkSync(path.join(directory, 'web-config.json'));
  assert.equal(resolveApiBaseUrl({ env: {}, userDataPath: directory }), `${DEFAULT_API_BASE_URL}/`);
});

// ---------------------------------------------------------------- serial

test('normalizeSerialCode groups a compact code and uppercases', () => {
  assert.equal(normalizeSerialCode('abcd1234efgh5678'), 'ABCD-1234-EFGH-5678');
  assert.equal(normalizeSerialCode(' ab12-cd34-ef56-gh78 '), 'AB12-CD34-EF56-GH78');
  assert.equal(normalizeSerialCode('AB12-CD34-EF56-GH78'), 'AB12-CD34-EF56-GH78');
  assert.equal(normalizeSerialCode('bad'), 'BAD');
});

// ---------------------------------------------------------------- store

test('license store round-trips an activated state with safeStorage', t => {
  const directory = tempDir(t);
  const filePath = path.join(directory, 'license-state.json');
  const store = createLicenseStore({ filePath, safeStorage: fakeSafeStorage });
  store.save({
    code: 'AB12-CD34-EF56-GH78',
    deviceId: 'device-1',
    activationToken: 'token-secret',
    expiresAt: 1234,
    lastRefreshAt: 5678,
    activatedAt: 900,
    devices: [{ deviceId: 'device-1', current: true }],
    deviceCount: 1
  });

  const loaded = store.load();
  assert.equal(loaded.deviceId, 'device-1');
  assert.equal(loaded.activationToken, 'token-secret');
  assert.equal(loaded.code, 'AB12-CD34-EF56-GH78');
  assert.equal(loaded.expiresAt, 1234);

  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  assert.equal(raw.activationToken.enc, 'safeStorage');
  assert.notEqual(raw.activationToken.value, 'token-secret');
});

test('license store falls back to plaintext when safeStorage is unavailable', t => {
  const directory = tempDir(t);
  const filePath = path.join(directory, 'license-state.json');
  const store = createLicenseStore({ filePath, safeStorage: plainSafeStorage });
  store.save({
    code: 'AB12-CD34-EF56-GH78',
    deviceId: 'device-1',
    activationToken: 'token-secret',
    expiresAt: null,
    lastRefreshAt: null,
    activatedAt: null,
    devices: [],
    deviceCount: 0
  });
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  assert.equal(raw.activationToken.enc, 'plain');
  assert.equal(store.load().activationToken, 'token-secret');
});

test('license store returns null for missing, corrupt or incomplete state', t => {
  const directory = tempDir(t);
  const filePath = path.join(directory, 'license-state.json');

  assert.equal(createLicenseStore({ filePath, safeStorage: fakeSafeStorage }).load(), null);

  fs.writeFileSync(filePath, '{not-json');
  assert.equal(createLicenseStore({ filePath, safeStorage: fakeSafeStorage }).load(), null);

  fs.writeFileSync(filePath, JSON.stringify({ schemaVersion: 1, deviceId: 'x' }));
  assert.equal(createLicenseStore({ filePath, safeStorage: fakeSafeStorage }).load(), null);
});

test('license store clear removes the file', t => {
  const directory = tempDir(t);
  const filePath = path.join(directory, 'license-state.json');
  const store = createLicenseStore({ filePath, safeStorage: fakeSafeStorage });
  store.save({ deviceId: 'd', activationToken: 't' });
  store.clear();
  assert.equal(fs.existsSync(filePath), false);
});

// ---------------------------------------------------------------- client

test('license client posts activate and parses the data payload', async () => {
  let captured;
  const client = createLicenseClient({
    baseUrl: 'https://api.example.com',
    fetchImplementation: createFetch((url, body) => {
      captured = { url, body };
      return response(200, {
        data: { deviceId: 'device-1', activationToken: 'token', expiresAt: '2099-01-01T00:00:00.000Z', deviceCount: 1 }
      });
    })
  });

  const result = await client.activate({ code: 'AB12-CD34-EF56-GH78', deviceFingerprint: 'fp' });
  assert.equal(result.deviceId, 'device-1');
  assert.equal(captured.url, 'https://api.example.com/v1/licenses/devices/activate');
  assert.deepEqual(captured.body, { code: 'AB12-CD34-EF56-GH78', deviceFingerprint: 'fp' });
});

test('license client posts refresh and unbind to the right paths', async () => {
  const paths = [];
  const client = createLicenseClient({
    baseUrl: 'https://api.example.com',
    fetchImplementation: async url => {
      paths.push(String(url));
      return response(200, { data: { status: 'ok' } });
    }
  });

  await client.refresh({ deviceId: 'd', deviceFingerprint: 'fp', activationToken: 't' });
  await client.unbind({ deviceId: 'd/1', code: 'AB12-CD34-EF56-GH78', activationToken: 't' });

  assert.equal(paths[0], 'https://api.example.com/v1/licenses/devices/refresh');
  assert.equal(paths[1], 'https://api.example.com/v1/licenses/devices/d%2F1/unbind');
});

test('license client maps server errors to LicenseError with the contract code', async () => {
  const client = createLicenseClient({
    baseUrl: 'https://api.example.com',
    fetchImplementation: async () =>
      response(409, { error: { code: 'LICENSE:DEVICE_LIMIT', message: 'limit', requestId: 'r1' } })
  });

  await assert.rejects(
    () => client.activate({ code: 'AB12-CD34-EF56-GH78', deviceFingerprint: 'fp' }),
    error => {
      assert.ok(error instanceof LicenseError);
      assert.equal(error.code, 'LICENSE:DEVICE_LIMIT');
      assert.equal(error.status, 409);
      assert.equal(error.requestId, 'r1');
      return true;
    }
  );
});

test('license client reports network failures as LICENSE:NETWORK', async () => {
  const client = createLicenseClient({
    baseUrl: 'https://api.example.com',
    fetchImplementation: async () => {
      throw new Error('offline');
    }
  });

  await assert.rejects(
    () => client.refresh({ deviceId: 'd', deviceFingerprint: 'fp', activationToken: 't' }),
    error => {
      assert.ok(error instanceof LicenseError);
      assert.equal(error.code, 'LICENSE:NETWORK');
      return true;
    }
  );
});

test('license client rejects an unconfigured base url', () => {
  assert.throws(() => createLicenseClient({ baseUrl: '', fetchImplementation: async () => response(200, {}) }));
});

// ---------------------------------------------------------------- service

function createService(t, options = {}) {
  const directory = tempDir(t);
  const clock = options.clock || makeClock();
  const fetchCalls = [];
  const states = [];
  const activateData = () => ({
    deviceId: 'device-1',
    activationToken: 'token-1',
    expiresAt: new Date(ACTIVATE_EXPIRES_AT).toISOString(),
    devices: [{ deviceId: 'device-1', current: true }],
    deviceCount: 1
  });
  const refreshData = () => ({
    deviceId: 'device-1',
    expiresAt: new Date(REFRESH_EXPIRES_AT).toISOString(),
    devices: [{ deviceId: 'device-1', current: true }],
    deviceCount: 1
  });
  const defaultFetch = createFetch((url, body) => {
    fetchCalls.push({ url, body });
    if (String(url).endsWith('/devices/activate')) return response(200, { data: activateData() });
    if (String(url).endsWith('/devices/refresh')) {
      return options.refreshHandler ? options.refreshHandler() : response(200, { data: refreshData() });
    }
    return response(200, { data: { status: 'ok' } });
  });

  const service = createLicenseService({
    userDataPath: directory,
    safeStorage: fakeSafeStorage,
    fetchImplementation: options.fetchImplementation || defaultFetch,
    emitState: state => states.push(state),
    now: clock.now,
    fingerprintFactory: () => 'fingerprint-hex',
    setTimer: () => {},
    clearTimer: () => {},
    baseUrl: 'https://api.example.com'
  });

  return { service, directory, fetchCalls, states, clock };
}

test('service starts unactivated', t => {
  const { service } = createService(t);
  const state = service.getState();
  assert.equal(state.status, 'none');
  assert.equal(state.deviceId, '');
});

test('activate persists state, keeps secrets out of the public state', async t => {
  const { service, states } = createService(t);
  const state = await service.activate({ code: 'AB12CD34EF56GH78' });
  assert.equal(state.status, 'active');
  assert.equal(state.deviceId, 'device-1');
  assert.equal(state.deviceCount, 1);
  assert.equal(state.activationToken, undefined);
  assert.equal(states.at(-1).status, 'active');
});

test('activate rejects an invalid serial format without calling the server', async t => {
  const { service, fetchCalls } = createService(t);
  await assert.rejects(
    () => service.activate({ code: 'not-a-code' }),
    error => {
      assert.ok(error instanceof LicenseError);
      assert.equal(error.code, 'LICENSE:FORMAT');
      return true;
    }
  );
  assert.equal(fetchCalls.length, 0);
});

test('activate maps server errors to friendly messages', async t => {
  const { service } = createService(t, {
    fetchImplementation: async () => response(404, { error: { code: 'LICENSE:INVALID', message: 'raw' } })
  });
  await assert.rejects(
    () => service.activate({ code: 'AB12-CD34-EF56-GH78' }),
    error => {
      assert.equal(error.code, 'LICENSE:INVALID');
      assert.equal(error.message, '序列号无效或已作废，请核对后重试');
      return true;
    }
  );
});

test('renewCheck does not refresh while valid and not yet due', async t => {
  const { service, fetchCalls } = createService(t);
  await service.activate({ code: 'AB12-CD34-EF56-GH78' });
  const state = await service.renewCheck();
  assert.equal(state.status, 'active');
  assert.equal(fetchCalls.filter(call => call.url.endsWith('/devices/refresh')).length, 0);
});

test('renewCheck refreshes once the last refresh is 7 days old', async t => {
  const { service, fetchCalls, clock } = createService(t);
  await service.activate({ code: 'AB12-CD34-EF56-GH78' });
  clock.advance(REFRESH_INTERVAL_MS + 1);
  const state = await service.renewCheck();
  assert.equal(state.status, 'active');
  assert.equal(fetchCalls.filter(call => call.url.endsWith('/devices/refresh')).length, 1);
});

test('renewCheck locks an expired device when refresh fails offline', async t => {
  const { service, clock } = createService(t, {
    refreshHandler: () => {
      throw new Error('offline');
    }
  });
  await service.activate({ code: 'AB12-CD34-EF56-GH78' });
  clock.advance(30 * DAY);
  const state = await service.renewCheck();
  assert.equal(state.status, 'locked');
  assert.equal(state.error.code, 'LICENSE:EXPIRED');
});

test('renewCheck keeps active on a network failure while still valid', async t => {
  const { service, clock } = createService(t, {
    refreshHandler: () => {
      throw new Error('flaky');
    }
  });
  await service.activate({ code: 'AB12-CD34-EF56-GH78' });
  clock.advance(REFRESH_INTERVAL_MS + 1);
  const state = await service.renewCheck();
  assert.equal(state.status, 'active');
});

test('renewCheck locks when the server rejects an invalid device', async t => {
  const { service, clock } = createService(t, {
    refreshHandler: () =>
      response(401, { error: { code: 'LICENSE:DEVICE_INVALID', message: 'expired' } })
  });
  await service.activate({ code: 'AB12-CD34-EF56-GH78' });
  clock.advance(30 * DAY);
  const state = await service.renewCheck();
  assert.equal(state.status, 'locked');
});

test('unbind clears the local state', async t => {
  const { service, fetchCalls } = createService(t);
  await service.activate({ code: 'AB12-CD34-EF56-GH78' });
  const state = await service.unbind();
  assert.equal(state.status, 'none');
  assert.equal(state.deviceId, '');
  assert.ok(fetchCalls.some(call => call.url.endsWith('/devices/device-1/unbind')));
});

test('unbind requires an activated device', async t => {
  const { service } = createService(t);
  await assert.rejects(
    () => service.unbind(),
    error => {
      assert.equal(error.code, 'LICENSE:NOT_ACTIVATED');
      return true;
    }
  );
});

test('state survives a service restart through the store', async t => {
  const { service, directory } = createService(t);
  await service.activate({ code: 'AB12-CD34-EF56-GH78' });

  const reloaded = createLicenseService({
    userDataPath: directory,
    safeStorage: fakeSafeStorage,
    fetchImplementation: async () => response(200, { data: {} }),
    now: () => 0,
    setTimer: () => {},
    clearTimer: () => {},
    baseUrl: 'https://api.example.com'
  });
  const state = reloaded.getState();
  assert.equal(state.status, 'active');
  assert.equal(state.deviceId, 'device-1');
});

test('background constants follow the contract cadence', () => {
  assert.equal(REFRESH_INTERVAL_MS, 7 * DAY);
  assert.equal(OFFLINE_GRACE_MS, 30 * DAY);
  assert.equal(BACKGROUND_CHECK_MS, 6 * 60 * 60 * 1000);
});

// ---------------------------------------------------------------- IPC layer

function createIpcHarness(t, options = {}) {
  const handlers = new Map();
  const ipcMain = {
    handle(channel, handler) {
      handlers.set(channel, handler);
    }
  };
  const fetchCalls = [];
  const defaultFetch = createFetch((url, body) => {
    fetchCalls.push({ url, body });
    if (String(url).endsWith('/devices/activate')) {
      return response(200, {
        data: {
          deviceId: 'device-1',
          activationToken: 'token-1',
          expiresAt: new Date(ACTIVATE_EXPIRES_AT).toISOString(),
          devices: [{ deviceId: 'device-1', current: true }],
          deviceCount: 1
        }
      });
    }
    return response(200, { data: { status: 'ok' } });
  });
  const service = registerLicenseIpc({
    ipcMain,
    isTrustedRenderer: () => true,
    userDataPath: tempDir(t),
    safeStorage: fakeSafeStorage,
    fetchImplementation: options.fetchImplementation || defaultFetch,
    emitState: () => {},
    now: options.now || (() => 0),
    fingerprintFactory: () => 'fingerprint-hex',
    setTimer: () => {},
    clearTimer: () => {},
    baseUrl: 'https://api.example.com'
  });
  const invoke = (channel, ...args) =>
    handlers.get(channel)({ sender: {}, senderFrame: {} }, ...args);
  return { service, handlers, invoke, fetchCalls };
}

test('IPC activate forwards the serial code to the license service', async t => {
  const { invoke, fetchCalls } = createIpcHarness(t);
  const result = await invoke('license:activate', 'TEST-0000-0000-0001');
  assert.equal(result.ok, true);
  assert.equal(result.state.status, 'active');
  assert.equal(result.state.deviceId, 'device-1');
  assert.equal(fetchCalls[0].body.code, 'TEST-0000-0000-0001');
});

test('IPC activate returns a friendly format error for an invalid code', async t => {
  const { invoke } = createIpcHarness(t);
  const result = await invoke('license:activate', 'not-a-code');
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'LICENSE:FORMAT');
});

test('IPC activate surfaces server errors without throwing', async t => {
  const { invoke } = createIpcHarness(t, {
    fetchImplementation: async () =>
      response(409, { error: { code: 'LICENSE:DEVICE_LIMIT', message: 'limit' } })
  });
  const result = await invoke('license:activate', 'TEST-0000-0000-0001');
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'LICENSE:DEVICE_LIMIT');
  assert.equal(result.error.message, '该序列号已达到 2 台设备上限');
});

test('IPC refresh and get-state report the current state', async t => {
  const { invoke } = createIpcHarness(t);
  const activated = await invoke('license:activate', 'TEST-0000-0000-0001');
  assert.equal(activated.ok, true);
  const refreshed = await invoke('license:refresh');
  assert.equal(refreshed.ok, true);
  assert.equal(refreshed.state.status, 'active');
  const current = await invoke('license:get-state');
  assert.equal(current.state.deviceId, 'device-1');
});

test('IPC unbind clears the activated state', async t => {
  const { invoke } = createIpcHarness(t);
  await invoke('license:activate', 'TEST-0000-0000-0001');
  const result = await invoke('license:unbind');
  assert.equal(result.ok, true);
  assert.equal(result.state.status, 'none');
});

test('IPC rejects requests from an untrusted renderer', async t => {
  const handlers = new Map();
  const ipcMain = {
    handle(channel, handler) {
      handlers.set(channel, handler);
    }
  };
  registerLicenseIpc({
    ipcMain,
    isTrustedRenderer: () => false,
    userDataPath: tempDir(t),
    safeStorage: fakeSafeStorage,
    fetchImplementation: async () => response(200, { data: {} }),
    emitState: () => {},
    now: () => 0,
    fingerprintFactory: () => 'fingerprint-hex',
    setTimer: () => {},
    clearTimer: () => {},
    baseUrl: 'https://api.example.com'
  });
  const result = await handlers.get('license:activate')(
    { sender: {}, senderFrame: {} },
    'TEST-0000-0000-0001'
  );
  assert.deepEqual(result, {
    ok: false,
    error: { code: 'LICENSE:UNTRUSTED', message: 'Unauthorized license request.' }
  });
});
