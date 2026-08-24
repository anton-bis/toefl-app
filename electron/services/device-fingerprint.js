import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import machineId from 'node-machine-id';

/**
 * Device fingerprint for the license protocol (license-protocol-v1).
 *
 * deviceFingerprint = sha256(hostname + platform + arch + cpus[0].model + machineId)
 *
 * Only the 64-hex digest is ever sent to the server; the raw host details and
 * the machine id never leave this process.
 */

/**
 * Pure fingerprint computation. Inject osModule / cryptoModule / machineIdProvider
 * in tests; the module defaults are used in the real app.
 */
export function computeDeviceFingerprint({
  osModule = os,
  cryptoModule = crypto,
  machineIdProvider = () => machineId.machineIdSync()
} = {}) {
  const hostname = typeof osModule.hostname === 'function' ? osModule.hostname() : '';
  const platform = typeof osModule.platform === 'function' ? osModule.platform() : '';
  const arch = typeof osModule.arch === 'function' ? osModule.arch() : '';
  const cpus = typeof osModule.cpus === 'function' ? osModule.cpus() : [];
  const model = String(cpus?.[0]?.model || '');

  let machineIdValue = '';
  try {
    const value = machineIdProvider();
    if (typeof value === 'string' && value) machineIdValue = value;
  } catch {
    // A failing machine-id source still yields a deterministic host digest.
  }

  const raw = `${String(hostname || '')}${String(platform || '')}${String(arch || '')}${model}${machineIdValue}`;
  return cryptoModule.createHash('sha256').update(raw).digest('hex');
}

/**
 * Stable machine-id provider: a hardware-derived id (node-machine-id) with a
 * persisted random fallback so the fingerprint stays stable across provider
 * failures or empty results.
 */
export function createStableMachineIdProvider({
  filePath,
  hardwareMachineId = machineId.machineIdSync,
  fsModule = fs,
  cryptoModule = crypto
} = {}) {
  let persisted;
  const loadPersisted = () => {
    if (persisted !== undefined) return persisted;
    try {
      persisted = fsModule.readFileSync(filePath, 'utf8').trim();
    } catch {
      persisted = '';
    }
    return persisted;
  };

  return () => {
    try {
      const value = hardwareMachineId();
      if (typeof value === 'string' && value) return value;
    } catch {
      // Fall through to the persisted fallback below.
    }
    if (!loadPersisted()) {
      const generated = cryptoModule.randomUUID();
      try {
        fsModule.mkdirSync(path.dirname(filePath), { recursive: true });
        fsModule.writeFileSync(filePath, generated, { mode: 0o600 });
        persisted = generated;
      } catch {
        // Best effort; an empty id still yields a deterministic host digest.
      }
    }
    return loadPersisted();
  };
}

/**
 * Convenience factory for the app: computes the fingerprint using the stable
 * machine-id provider, caching any fallback id under the given userData path.
 */
export function createDeviceFingerprint({
  userDataPath,
  osModule,
  cryptoModule,
  hardwareMachineId
} = {}) {
  const filePath = path.join(userDataPath, 'device-id.json');
  return computeDeviceFingerprint({
    osModule,
    cryptoModule,
    machineIdProvider: createStableMachineIdProvider({
      filePath,
      hardwareMachineId,
      cryptoModule
    })
  });
}
