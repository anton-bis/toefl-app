import crypto from 'node:crypto';
import http from 'node:http';
import { pathToFileURL } from 'node:url';

/**
 * Mock license server for license-protocol-v1.
 *
 * An in-memory reference implementation of the Web license endpoints so the
 * Electron client can be exercised before the real Web API ships:
 *
 *   POST /v1/licenses/devices/activate          { code, deviceFingerprint }
 *   POST /v1/licenses/devices/refresh           { deviceId, deviceFingerprint, activationToken }
 *   POST /v1/licenses/devices/:deviceId/unbind  { code, activationToken }
 *
 * Contract semantics:
 *   - 404 LICENSE:INVALID          unknown / revoked code
 *   - 409 LICENSE:DEVICE_LIMIT     2 devices already bound to the code
 *   - 401 LICENSE:DEVICE_INVALID   device expired offline > 30 days, or bad credentials
 *   - idempotent activate          same code + fingerprint returns the original binding
 */

export const DEVICE_LIMIT = 2;
export const OFFLINE_GRACE_MS = 30 * 24 * 60 * 60 * 1000;

function errorBody(code) {
  return {
    error: {
      code,
      message: code,
      requestId: `req_${crypto.randomUUID()}`
    }
  };
}

export class MockLicenseServer {
  constructor({ now = Date.now, deviceLimit = DEVICE_LIMIT, graceMs = OFFLINE_GRACE_MS, seedCodes = [] } = {}) {
    this.now = now;
    this.deviceLimit = deviceLimit;
    this.graceMs = graceMs;
    this.codes = new Map(); // code -> { revoked, devices: Map<deviceId, device> }
    this.devicesById = new Map(); // deviceId -> code
    for (const code of seedCodes) this.ensureCode(code);
  }

  ensureCode(code) {
    if (!this.codes.has(code)) {
      this.codes.set(code, { revoked: false, devices: new Map() });
    }
  }

  revoke(code) {
    this.ensureCode(code);
    this.codes.get(code).revoked = true;
  }

  deviceList(code, currentDeviceId) {
    const record = this.codes.get(code);
    if (!record) return [];
    return [...record.devices.values()]
      .sort((a, b) => a.boundAt - b.boundAt)
      .map(device => ({
        deviceId: device.deviceId,
        boundAt: new Date(device.boundAt).toISOString(),
        current: device.deviceId === currentDeviceId
      }));
  }

  handleActivate(body) {
    const code = String(body?.code || '');
    const fingerprint = String(body?.deviceFingerprint || '');
    const record = this.codes.get(code);
    if (!record || record.revoked) {
      return { status: 404, body: errorBody('LICENSE:INVALID') };
    }
    const existing = [...record.devices.values()].find(
      device => device.fingerprint === fingerprint
    );
    if (existing) {
      existing.expiresAt = this.now() + this.graceMs;
      return {
        status: 200,
        body: {
          data: {
            deviceId: existing.deviceId,
            activationToken: existing.activationToken,
            expiresAt: new Date(existing.expiresAt).toISOString(),
            devices: this.deviceList(code, existing.deviceId),
            deviceCount: record.devices.size
          }
        }
      };
    }
    if (record.devices.size >= this.deviceLimit) {
      return { status: 409, body: errorBody('LICENSE:DEVICE_LIMIT') };
    }
    const deviceId = `dev_${crypto.randomUUID()}`;
    const device = {
      deviceId,
      fingerprint,
      activationToken: crypto.randomUUID(),
      expiresAt: this.now() + this.graceMs,
      boundAt: this.now()
    };
    record.devices.set(deviceId, device);
    this.devicesById.set(deviceId, code);
    return {
      status: 200,
      body: {
        data: {
          deviceId,
          activationToken: device.activationToken,
          expiresAt: new Date(device.expiresAt).toISOString(),
          devices: this.deviceList(code, deviceId),
          deviceCount: record.devices.size
        }
      }
    };
  }

  handleRefresh(body) {
    const deviceId = String(body?.deviceId || '');
    const fingerprint = String(body?.deviceFingerprint || '');
    const activationToken = String(body?.activationToken || '');
    const code = this.devicesById.get(deviceId);
    const device = code ? this.codes.get(code)?.devices.get(deviceId) : null;
    if (!device || device.activationToken !== activationToken || device.fingerprint !== fingerprint) {
      return { status: 401, body: errorBody('LICENSE:DEVICE_INVALID') };
    }
    if (this.now() > device.expiresAt) {
      // Offline longer than the 30-day grace invalidates the device.
      return { status: 401, body: errorBody('LICENSE:DEVICE_INVALID') };
    }
    device.expiresAt = this.now() + this.graceMs;
    return {
      status: 200,
      body: {
        data: {
          deviceId: device.deviceId,
          expiresAt: new Date(device.expiresAt).toISOString(),
          devices: this.deviceList(code, device.deviceId),
          deviceCount: this.codes.get(code).devices.size
        }
      }
    };
  }

  handleUnbind(deviceId, body) {
    const code = this.devicesById.get(deviceId);
    const device = code ? this.codes.get(code)?.devices.get(deviceId) : null;
    if (!device) return { status: 404, body: errorBody('LICENSE:INVALID') };
    if (String(body?.code) !== code || String(body?.activationToken) !== device.activationToken) {
      return { status: 401, body: errorBody('LICENSE:DEVICE_INVALID') };
    }
    this.codes.get(code).devices.delete(deviceId);
    this.devicesById.delete(deviceId);
    return { status: 200, body: { data: { status: 'ok' } } };
  }

  handle(req, res) {
    let raw = '';
    req.on('data', chunk => (raw += chunk));
    req.on('end', () => {
      let body = {};
      try {
        body = JSON.parse(raw || '{}');
      } catch {
        body = {};
      }
      const path = new URL(req.url, 'http://localhost').pathname;
      let result;
      if (req.method === 'POST' && path === '/v1/licenses/devices/activate') {
        result = this.handleActivate(body);
      } else if (req.method === 'POST' && path === '/v1/licenses/devices/refresh') {
        result = this.handleRefresh(body);
      } else {
        const match = path.match(/^\/v1\/licenses\/devices\/([^/]+)\/unbind$/);
        if (req.method === 'POST' && match) {
          result = this.handleUnbind(decodeURIComponent(match[1]), body);
        } else {
          result = { status: 404, body: errorBody('LICENSE:INVALID') };
        }
      }
      res.writeHead(result.status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result.body));
    });
  }
}

export function createMockLicenseServer(options = {}) {
  const state = new MockLicenseServer(options);
  const server = http.createServer((req, res) => state.handle(req, res));
  return { state, server };
}

export async function startMockLicenseServer({ port = 0, ...options } = {}) {
  const { state, server } = createMockLicenseServer(options);
  await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
  const address = server.address();
  const actualPort = typeof address === 'object' && address ? address.port : port;
  return {
    state,
    port: actualPort,
    baseUrl: `http://127.0.0.1:${actualPort}`,
    close: () => new Promise(resolve => server.close(resolve))
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT || 3002);
  const codes = ['TEST-0000-0000-0001', 'TEST-0000-0000-0004'];
  const instance = await startMockLicenseServer({ port, seedCodes: codes });
  console.log(`Mock license server listening on ${instance.baseUrl}`);
  console.log(`Valid codes: ${codes.join(', ')}`);
}
