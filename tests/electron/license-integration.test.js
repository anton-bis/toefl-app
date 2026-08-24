import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { startMockLicenseServer } from '../../scripts/mock-license-server.js';
import { createLicenseService } from '../../electron/services/license.js';

/**
 * E7 integration: drives the real license service against an in-memory mock
 * of the Web license server, covering activate / refresh / unbind / limit /
 * invalid code / offline-expiry semantics.
 */

const DAY = 24 * 60 * 60 * 1000;

const fakeSafeStorage = {
  isEncryptionAvailable: () => true,
  encryptString: value => Buffer.from(`enc:${value}`),
  decryptString: buffer => buffer.toString('utf8').replace(/^enc:/, '')
};

function makeClock() {
  const clock = { value: 1_700_000_000_000 };
  clock.now = () => clock.value;
  return clock;
}

function createService(clock, fingerprint, directory, baseUrl) {
  return createLicenseService({
    userDataPath: directory,
    safeStorage: fakeSafeStorage,
    baseUrl,
    now: clock.now,
    fingerprintFactory: () => fingerprint,
    setTimer: () => {},
    clearTimer: () => {}
  });
}

function tempDir(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'toefl-license-integration-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

test('E7: activate, limit, refresh and unbind work end-to-end against the mock server', async t => {
  const clock = makeClock();
  const server = await startMockLicenseServer({
    now: clock.now,
    seedCodes: ['TEST-0000-0000-0001']
  });
  t.after(() => server.close());

  const directoryA = tempDir(t);
  const directoryB = tempDir(t);
  const directoryC = tempDir(t);

  // Device A activates the code.
  const serviceA = createService(clock, 'fp-device-a', directoryA, server.baseUrl);
  const active = await serviceA.activate({ code: 'TEST000000000001' });
  assert.equal(active.status, 'active');
  assert.equal(active.deviceCount, 1);
  const deviceIdA = active.deviceId;
  assert.ok(deviceIdA);

  // Device B activates the same code.
  const serviceB = createService(clock, 'fp-device-b', directoryB, server.baseUrl);
  const activeB = await serviceB.activate({ code: 'TEST-0000-0000-0001' });
  assert.equal(activeB.status, 'active');
  assert.equal(activeB.deviceCount, 2);

  // Device C is rejected once the 2-device limit is reached.
  const serviceC = createService(clock, 'fp-device-c', directoryC, server.baseUrl);
  await assert.rejects(
    () => serviceC.activate({ code: 'TEST-0000-0000-0001' }),
    error => {
      assert.equal(error.code, 'LICENSE:DEVICE_LIMIT');
      assert.equal(error.message, '该序列号已达到 2 台设备上限');
      return true;
    }
  );

  // A duplicated activate on the same device is idempotent.
  const again = await serviceA.activate({ code: 'TEST-0000-0000-0001' });
  assert.equal(again.deviceId, deviceIdA);
  assert.equal(again.deviceCount, 2);

  // Device A unbinds and frees a slot.
  const afterUnbind = await serviceA.unbind();
  assert.equal(afterUnbind.status, 'none');
  const serviceC2 = createService(clock, 'fp-device-c', directoryC, server.baseUrl);
  const activeC = await serviceC2.activate({ code: 'TEST-0000-0000-0001' });
  assert.equal(activeC.status, 'active');
  assert.equal(activeC.deviceCount, 2);
});

test('E7: an unknown or revoked code returns LICENSE:INVALID', async t => {
  const clock = makeClock();
  const server = await startMockLicenseServer({
    now: clock.now,
    seedCodes: ['TEST-0000-0000-0001']
  });
  t.after(() => server.close());
  server.state.revoke('TEST-0000-0000-0001');

  const service = createService(clock, 'fp-device-a', tempDir(t), server.baseUrl);
  await assert.rejects(
    () => service.activate({ code: 'TEST-0000-0000-0001' }),
    error => {
      assert.equal(error.code, 'LICENSE:INVALID');
      assert.equal(error.message, '序列号无效或已作废，请核对后重试');
      return true;
    }
  );
  await assert.rejects(
    () => service.activate({ code: 'TEST-9999-9999-9999' }),
    error => {
      assert.equal(error.code, 'LICENSE:INVALID');
      return true;
    }
  );
});

test('E7: offline beyond 30 days locks the device and re-activation recovers idempotently', async t => {
  const clock = makeClock();
  const server = await startMockLicenseServer({
    now: clock.now,
    seedCodes: ['TEST-0000-0000-0001']
  });
  t.after(() => server.close());

  const service = createService(clock, 'fp-device-a', tempDir(t), server.baseUrl);
  const active = await service.activate({ code: 'TEST-0000-0000-0001' });
  assert.equal(active.status, 'active');

  // Stay offline past the 30-day grace; the next check must lock.
  clock.value += 31 * DAY;
  const locked = await service.renewCheck();
  assert.equal(locked.status, 'locked');
  assert.equal(locked.error.code, 'LICENSE:EXPIRED');

  // Re-activating the same device recovers via the idempotent binding.
  const recovered = await service.activate({ code: 'TEST-0000-0000-0001' });
  assert.equal(recovered.status, 'active');
  assert.equal(recovered.deviceId, active.deviceId);
});

test('E7: unbind requires the matching code and token', async t => {
  const clock = makeClock();
  const server = await startMockLicenseServer({
    now: clock.now,
    seedCodes: ['TEST-0000-0000-0001']
  });
  t.after(() => server.close());

  const directoryA = tempDir(t);
  const directoryB = tempDir(t);
  const serviceA = createService(clock, 'fp-device-a', directoryA, server.baseUrl);
  const serviceB = createService(clock, 'fp-device-b', directoryB, server.baseUrl);
  const activeA = await serviceA.activate({ code: 'TEST-0000-0000-0001' });
  await serviceB.activate({ code: 'TEST-0000-0000-0001' });

  const code = 'TEST-0000-0000-0001';
  const deviceIdA = activeA.deviceId;
  const deviceA = server.state.codes.get(code).devices.get(deviceIdA);

  // A wrong token cannot unbind device A.
  const denied = server.state.handleUnbind(deviceIdA, { code, activationToken: 'wrong-token' });
  assert.equal(denied.status, 401);
  assert.equal(denied.body.error.code, 'LICENSE:DEVICE_INVALID');

  // The rightful owner unbinds cleanly.
  const result = server.state.handleUnbind(deviceIdA, {
    code,
    activationToken: deviceA.activationToken
  });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { data: { status: 'ok' } });
  assert.equal(server.state.codes.get(code).devices.size, 1);
});
