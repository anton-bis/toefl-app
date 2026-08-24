import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Local license persistence (license-protocol-v1).
 *
 * The activation token and the serial code are encrypted with Electron
 * safeStorage (OS keychain) when available, falling back to plaintext on
 * systems without a keyring. The state is deliberately stored outside the
 * SQLite settings table so it is never exposed through renderer bootstrap.
 */

const SCHEMA_VERSION = 1;

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function createLicenseStore({
  filePath,
  safeStorage,
  fsModule = fs,
  cryptoModule = crypto
} = {}) {
  function encryptionAvailable() {
    try {
      return Boolean(safeStorage?.isEncryptionAvailable?.());
    } catch {
      return false;
    }
  }

  function readRaw() {
    try {
      return JSON.parse(fsModule.readFileSync(filePath, 'utf8'));
    } catch {
      return null;
    }
  }

  function writeRaw(payload) {
    fsModule.mkdirSync(path.dirname(filePath), { recursive: true });
    const temporary = `${filePath}.tmp-${process.pid}-${cryptoModule.randomUUID()}`;
    fsModule.writeFileSync(temporary, JSON.stringify(payload), { mode: 0o600 });
    fsModule.renameSync(temporary, filePath);
  }

  function encrypt(value) {
    if (typeof value !== 'string' || !value) return value;
    if (encryptionAvailable()) {
      return { enc: 'safeStorage', value: safeStorage.encryptString(value).toString('base64') };
    }
    return { enc: 'plain', value };
  }

  function decrypt(secret) {
    if (!isPlainObject(secret)) return null;
    if (secret.enc === 'plain') return String(secret.value ?? '');
    if (secret.enc === 'safeStorage' && safeStorage?.decryptString) {
      try {
        return safeStorage.decryptString(Buffer.from(String(secret.value), 'base64'));
      } catch {
        return null;
      }
    }
    return null;
  }

  function load() {
    const raw = readRaw();
    if (!raw || raw.schemaVersion !== SCHEMA_VERSION) return null;
    const activationToken = decrypt(raw.activationToken);
    const code = decrypt(raw.code);
    if (!raw.deviceId || !activationToken) return null;
    return {
      code: code || '',
      deviceId: String(raw.deviceId),
      activationToken,
      expiresAt: Number.isFinite(raw.expiresAt) ? raw.expiresAt : null,
      lastRefreshAt: Number.isFinite(raw.lastRefreshAt) ? raw.lastRefreshAt : null,
      activatedAt: Number.isFinite(raw.activatedAt) ? raw.activatedAt : null,
      devices: Array.isArray(raw.devices) ? raw.devices : [],
      deviceCount: Number.isFinite(raw.deviceCount) ? raw.deviceCount : 0
    };
  }

  function save(state) {
    writeRaw({
      schemaVersion: SCHEMA_VERSION,
      deviceId: state.deviceId,
      code: encrypt(state.code || ''),
      activationToken: encrypt(state.activationToken || ''),
      expiresAt: state.expiresAt ?? null,
      lastRefreshAt: state.lastRefreshAt ?? null,
      activatedAt: state.activatedAt ?? null,
      devices: Array.isArray(state.devices) ? state.devices : [],
      deviceCount: Number.isFinite(state.deviceCount) ? state.deviceCount : 0
    });
  }

  function clear() {
    try {
      fsModule.rmSync(filePath, { force: true });
    } catch {
      // Best effort.
    }
  }

  return { load, save, clear, encryptionAvailable };
}
