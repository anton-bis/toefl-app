import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import crypto from 'node:crypto';
import {
  computeDeviceFingerprint,
  createDeviceFingerprint,
  createStableMachineIdProvider
} from '../../electron/services/device-fingerprint.js';

function fakeOs(overrides = {}) {
  return {
    hostname: () => 'DESKTOP-ABC',
    platform: () => 'win32',
    arch: () => 'x64',
    cpus: () => [{ model: 'Intel Core i7' }],
    ...overrides
  };
}

function assertHex64(value) {
  assert.match(value, /^[0-9a-f]{64}$/);
}

test('fingerprint is a 64-hex digest', () => {
  assertHex64(computeDeviceFingerprint({ osModule: fakeOs() }));
});

test('fingerprint is deterministic for the same host inputs', () => {
  const first = computeDeviceFingerprint({ osModule: fakeOs() });
  const second = computeDeviceFingerprint({ osModule: fakeOs() });
  assert.equal(first, second);
});

test('fingerprint changes when the machine id changes', () => {
  const a = computeDeviceFingerprint({
    osModule: fakeOs(),
    machineIdProvider: () => 'machine-a'
  });
  const b = computeDeviceFingerprint({
    osModule: fakeOs(),
    machineIdProvider: () => 'machine-b'
  });
  assert.notEqual(a, b);
});

test('fingerprint changes when the host identity changes', () => {
  const a = computeDeviceFingerprint({
    osModule: fakeOs({ hostname: () => 'LAPTOP-A' })
  });
  const b = computeDeviceFingerprint({
    osModule: fakeOs({ hostname: () => 'LAPTOP-B' })
  });
  assert.notEqual(a, b);
});

test('fingerprint includes the cpu model', () => {
  const a = computeDeviceFingerprint({
    osModule: fakeOs({ cpus: () => [{ model: 'AMD Ryzen' }] })
  });
  const b = computeDeviceFingerprint({
    osModule: fakeOs({ cpus: () => [{ model: 'Intel Core' }] })
  });
  assert.notEqual(a, b);
});

test('a failing machine-id source still yields a deterministic host digest', () => {
  const a = computeDeviceFingerprint({
    osModule: fakeOs(),
    machineIdProvider: () => {
      throw new Error('unavailable');
    }
  });
  const b = computeDeviceFingerprint({
    osModule: fakeOs(),
    machineIdProvider: () => {
      throw new Error('unavailable');
    }
  });
  assertHex64(a);
  assert.equal(a, b);
});

test('empty and non-string machine ids are ignored', () => {
  const base = computeDeviceFingerprint({ osModule: fakeOs(), machineIdProvider: () => '' });
  const withNonString = computeDeviceFingerprint({
    osModule: fakeOs(),
    machineIdProvider: () => 42
  });
  assert.equal(withNonString, base);
});

test('the stable provider uses the hardware id when available', () => {
  const provider = createStableMachineIdProvider({
    filePath: '/unused/device-id.json',
    hardwareMachineId: () => 'hardware-id-123'
  });
  assert.equal(provider(), 'hardware-id-123');
});

test('the stable provider persists a random fallback id', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'toefl-device-id-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const filePath = path.join(directory, 'device-id.json');

  const failing = () => {
    throw new Error('no hardware id');
  };
  const provider = createStableMachineIdProvider({
    filePath,
    hardwareMachineId: failing,
    cryptoModule: {
      randomUUID: () => 'fixed-random-uuid'
    }
  });

  const first = provider();
  assert.equal(first, 'fixed-random-uuid');
  assert.equal(fs.readFileSync(filePath, 'utf8'), 'fixed-random-uuid');

  // A later call reuses the persisted id without regenerating.
  const secondProvider = createStableMachineIdProvider({
    filePath,
    hardwareMachineId: failing
  });
  assert.equal(secondProvider(), 'fixed-random-uuid');
});

test('the stable provider reuses an existing persisted fallback id', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'toefl-device-id-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const filePath = path.join(directory, 'device-id.json');
  fs.writeFileSync(filePath, 'persisted-id');

  const provider = createStableMachineIdProvider({
    filePath,
    hardwareMachineId: () => ''
  });
  assert.equal(provider(), 'persisted-id');
});

test('createDeviceFingerprint wires the stable fallback provider', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'toefl-device-fp-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));

  const first = createDeviceFingerprint({
    userDataPath: directory,
    osModule: fakeOs(),
    hardwareMachineId: () => {
      throw new Error('no hardware id');
    },
    cryptoModule: {
      createHash: crypto.createHash,
      randomUUID: () => 'fallback-uuid'
    }
  });
  const second = createDeviceFingerprint({
    userDataPath: directory,
    osModule: fakeOs(),
    hardwareMachineId: () => {
      throw new Error('no hardware id');
    }
  });
  assertHex64(first);
  assert.equal(first, second);
});
