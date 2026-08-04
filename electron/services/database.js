import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Worker } from 'node:worker_threads';

const IDLE_TIMEOUT_MS = 30_000;
const MAX_RECORDING_BYTES = 50 * 1024 * 1024;
const MAX_REQUEST_BYTES = 2 * 1024 * 1024;
const PUBLIC_OPERATIONS = {
  bootstrap: {},
  'settings:set': { identifiers: ['key'] },
  'exam:save': {
    identifiers: ['tpoId', 'section', 'status'],
    validate(payload) {
      if (payload.id !== undefined) assertIdentifier(payload.id, 'id');
      if (payload.clientAttemptId !== undefined) {
        assertIdentifier(payload.clientAttemptId, 'clientAttemptId');
      }
      if (!['not-started', 'in-progress', 'completed'].includes(payload.status)) {
        throw new TypeError('Invalid exam status');
      }
      if (
        payload.answers !== undefined &&
        (!payload.answers || typeof payload.answers !== 'object' || Array.isArray(payload.answers))
      ) {
        throw new TypeError('Invalid exam answers');
      }
    }
  },
  'exam:delete': { identifiers: ['id'] },
  'exam:listCompleted': {},
  'attempt:finalize': {},
  'content:recordInstall': {},
  'vocabulary:list': {},
  'vocabulary:save': {
    identifiers: ['subject', 'setId'],
    validate(payload) {
      if (payload.wordId !== undefined) assertIdentifier(payload.wordId, 'wordId');
    }
  },
  'vocabulary:overview': {},
  'typing:list': {},
  'typing:replace': {
    validate(payload) {
      if (!Array.isArray(payload.history)) throw new TypeError('Invalid typing history');
    }
  },
  'recording:save': { handler: 'saveRecording', binary: true },
  'recording:load': {
    handler: 'loadRecording',
    identifiers: ['clientAttemptId', 'questionKey']
  },
  'recording:remove': {
    handler: 'removeRecording',
    identifiers: ['clientAttemptId', 'questionKey']
  },
  'recording:removeAttempt': {
    handler: 'removeRecording',
    identifiers: ['clientAttemptId']
  }
};
const MIME_EXTENSIONS = new Map([
  ['audio/webm', '.webm'],
  ['audio/ogg', '.ogg'],
  ['audio/mp4', '.m4a'],
  ['audio/mpeg', '.mp3'],
  ['audio/wav', '.wav']
]);

function assertIdentifier(value, label) {
  if (typeof value !== 'string' || !value || value.length > 200 || /[\0\r\n]/.test(value)) {
    throw new TypeError(`Invalid ${label}`);
  }
  return value;
}

function recordingName(clientAttemptId, questionKey, mime) {
  const digest = crypto
    .createHash('sha256')
    .update(clientAttemptId)
    .update('\0')
    .update(questionKey)
    .digest('hex');
  return `${digest}${MIME_EXTENSIONS.get(mime)}`;
}

function recordingMime(value) {
  if (typeof value !== 'string' || value.length > 100)
    throw new TypeError('Unsupported recording type');
  const base = value.split(';', 1)[0].trim().toLowerCase();
  if (!MIME_EXTENSIONS.has(base)) throw new TypeError('Unsupported recording type');
  return { base, value };
}

async function moveToBackup(source, backup) {
  try {
    await fs.rename(source, backup);
    return true;
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    return false;
  }
}

async function replaceRecordingFile({ temporary, destination, backup, commit }) {
  const backedUp = await moveToBackup(destination, backup);
  try {
    await fs.rename(temporary, destination);
    await commit();
    await fs.rm(backup, { force: true }).catch(() => {});
  } catch (error) {
    await fs.rm(temporary, { force: true }).catch(() => {});
    await fs.rm(destination, { force: true }).catch(() => {});
    if (backedUp) await fs.rename(backup, destination).catch(() => {});
    throw error;
  }
}

function validatePublicRequest(operation, payload) {
  if (!Object.hasOwn(PUBLIC_OPERATIONS, operation)) {
    throw new Error('Unsupported data storage operation');
  }
  const definition = PUBLIC_OPERATIONS[operation];
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new TypeError('Invalid data storage payload');
  }
  if (!definition.binary) {
    let serialized;
    try {
      serialized = JSON.stringify(payload);
    } catch {
      throw new TypeError('Invalid data storage payload');
    }
    if (Buffer.byteLength(serialized) > MAX_REQUEST_BYTES) {
      throw new RangeError('Data storage request is too large');
    }
  }
  for (const field of definition.identifiers || []) {
    assertIdentifier(payload[field], field);
  }
  definition.validate?.(payload);
  return definition;
}

export class DataStorage {
  #databasePath;
  #recordingsPath;
  #worker;
  #requests = new Map();
  #nextId = 1;
  #idleTimer;
  #closing = false;
  #drainResolvers = new Set();

  constructor(userDataPath, { idleTimeout = IDLE_TIMEOUT_MS } = {}) {
    if (!path.isAbsolute(userDataPath)) throw new TypeError('userDataPath must be absolute');
    this.#databasePath = path.join(userDataPath, 'toefl-data.sqlite');
    this.#recordingsPath = path.join(userDataPath, 'recordings');
    this.idleTimeout = idleTimeout;
  }

  #startWorker() {
    if (this.#worker) return this.#worker;
    const worker = new Worker(new URL('./database-worker.js', import.meta.url), {
      workerData: { databasePath: this.#databasePath, recordingsPath: this.#recordingsPath }
    });
    worker.on('message', message => {
      const request = this.#requests.get(message.id);
      if (!request) return;
      this.#requests.delete(message.id);
      if (message.ok) request.resolve(message.value);
      else request.reject(new Error(message.error || 'Data storage request failed'));
      if (!this.#requests.size) {
        for (const resolve of this.#drainResolvers) resolve();
        this.#drainResolvers.clear();
      }
      this.#scheduleIdle();
    });
    worker.on('error', error => this.#failWorker(error));
    worker.on('exit', code => {
      if (this.#worker !== worker) return;
      this.#worker = undefined;
      if (code) this.#failRequests(new Error(`Data storage worker stopped (${code})`));
    });
    this.#worker = worker;
    return worker;
  }

  #failRequests(error) {
    for (const request of this.#requests.values()) request.reject(error);
    this.#requests.clear();
    for (const resolve of this.#drainResolvers) resolve();
    this.#drainResolvers.clear();
  }

  #failWorker(error) {
    this.#failRequests(error);
    this.#worker = undefined;
  }

  #scheduleIdle() {
    clearTimeout(this.#idleTimer);
    if (!this.#worker || this.#requests.size || this.#closing) return;
    this.#idleTimer = setTimeout(() => this.close(), this.idleTimeout);
    this.#idleTimer.unref?.();
  }

  request(operation, payload = {}) {
    if (typeof operation !== 'string' || operation.length > 80) {
      return Promise.reject(new TypeError('Invalid data storage operation'));
    }
    if (this.#closing) return Promise.reject(new Error('Data storage is closing'));
    return this.#send(operation, payload);
  }

  #send(operation, payload) {
    clearTimeout(this.#idleTimer);
    const id = this.#nextId++;
    const worker = this.#startWorker();
    return new Promise((resolve, reject) => {
      this.#requests.set(id, { resolve, reject });
      worker.postMessage({ id, operation, payload });
    });
  }

  async saveRecording({ clientAttemptId, questionKey, mime, bytes }) {
    assertIdentifier(clientAttemptId, 'client attempt ID');
    assertIdentifier(questionKey, 'question key');
    const normalizedMime = recordingMime(mime);
    if (!ArrayBuffer.isView(bytes) && !(bytes instanceof ArrayBuffer)) {
      throw new TypeError('Invalid recording bytes');
    }
    const data = Buffer.from(bytes.buffer || bytes, bytes.byteOffset || 0, bytes.byteLength);
    if (!data.length || data.length > MAX_RECORDING_BYTES) {
      throw new RangeError('Invalid recording size');
    }
    await fs.mkdir(this.#recordingsPath, { recursive: true, mode: 0o700 });
    const name = recordingName(clientAttemptId, questionKey, normalizedMime.base);
    const destination = path.join(this.#recordingsPath, name);
    const temporary = `${destination}.tmp-${process.pid}-${crypto.randomUUID()}`;
    const backup = `${destination}.bak-${process.pid}-${crypto.randomUUID()}`;
    const previous = await this.request('recording:getV2', { clientAttemptId, questionKey });
    const updatedAt = Date.now();
    await fs.writeFile(temporary, data, { flag: 'wx', mode: 0o600 });
    const sha256 = crypto.createHash('sha256').update(data).digest('hex');
    await replaceRecordingFile({
      temporary,
      destination,
      backup,
      commit: () =>
        this.request('recording:upsertV2', {
          clientAttemptId,
          questionKey,
          relativePath: name,
          mime: normalizedMime.value,
          size: data.length,
          sha256,
          updatedAt
        })
    });
    if (previous?.relativePath && previous.relativePath !== name) {
      await fs
        .rm(path.join(this.#recordingsPath, path.basename(previous.relativePath)), {
          force: true
        })
        .catch(() => {});
    }
    return {
      clientAttemptId,
      questionKey,
      mime: normalizedMime.value,
      size: data.length,
      sha256,
      updatedAt
    };
  }

  async loadRecording({ clientAttemptId, questionKey }) {
    assertIdentifier(clientAttemptId, 'client attempt ID');
    assertIdentifier(questionKey, 'question key');
    const record = await this.request('recording:getV2', { clientAttemptId, questionKey });
    if (!record) return null;
    const filePath = this.#recordingFilePath(record.relativePath);
    try {
      const bytes = await fs.readFile(filePath);
      return { ...record, bytes };
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
      await this.request('recording:deleteV2', { clientAttemptId, questionKey });
      return null;
    }
  }

  async resolveRecordingFile({ clientAttemptId, questionKey }) {
    assertIdentifier(clientAttemptId, 'client attempt ID');
    assertIdentifier(questionKey, 'question key');
    const record = await this.request('recording:getV2', { clientAttemptId, questionKey });
    if (!record) return null;
    const filePath = this.#recordingFilePath(record.relativePath);
    try {
      const stats = await fs.stat(filePath);
      return stats.isFile() ? { filePath, mime: record.mime } : null;
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
      await this.request('recording:deleteV2', { clientAttemptId, questionKey });
      return null;
    }
  }

  async removeRecording(payload) {
    const records = await this.request(
      payload.questionKey ? 'recording:deleteV2' : 'recording:deleteAttemptV2',
      payload
    );
    await Promise.all(
      records.map(record =>
        fs.rm(path.join(this.#recordingsPath, path.basename(record.relativePath)), { force: true })
      )
    );
  }

  async dispatch(operation, payload) {
    const definition = validatePublicRequest(operation, payload || {});
    if (definition.handler) return this[definition.handler](payload);
    return this.request(operation, payload);
  }

  recordContentInstallation(payload) {
    return this.dispatch('content:recordInstall', payload);
  }

  async exportArchive(archivePath) {
    if (!path.isAbsolute(archivePath)) throw new TypeError('Archive path must be absolute');
    this.#assertExternalArchivePath(archivePath);
    const temporary = `${archivePath}.tmp-${process.pid}-${crypto.randomUUID()}`;
    const backup = `${archivePath}.bak-${process.pid}-${crypto.randomUUID()}`;
    let backedUp = false;
    try {
      await this.request('archive:export', { archivePath: temporary });
      try {
        await fs.rename(archivePath, backup);
        backedUp = true;
      } catch (error) {
        if (error?.code !== 'ENOENT') throw error;
      }
      await fs.rename(temporary, archivePath);
      await fs.rm(backup, { force: true }).catch(() => {});
      return true;
    } catch (error) {
      await fs.rm(temporary, { force: true }).catch(() => {});
      if (backedUp) await fs.rename(backup, archivePath).catch(() => {});
      throw error;
    }
  }

  async importArchive(archivePath) {
    if (!path.isAbsolute(archivePath)) throw new TypeError('Archive path must be absolute');
    this.#assertExternalArchivePath(archivePath);
    const stats = await fs.stat(archivePath);
    if (!stats.isFile() || stats.size > 250 * 1024 * 1024) {
      throw new RangeError('Invalid data archive');
    }
    return this.request('archive:import', { archivePath });
  }

  async close() {
    clearTimeout(this.#idleTimer);
    const worker = this.#worker;
    if (!worker) return;
    this.#closing = true;
    try {
      if (this.#requests.size) {
        await new Promise(resolve => this.#drainResolvers.add(resolve));
      }
      if (this.#worker === worker) await this.#send('close', {});
      this.#worker = undefined;
    } finally {
      this.#closing = false;
    }
  }

  #assertExternalArchivePath(archivePath) {
    const resolved = path.resolve(archivePath);
    const database = path.resolve(this.#databasePath);
    const recordings = path.resolve(this.#recordingsPath);
    if (
      [database, `${database}-wal`, `${database}-shm`].includes(resolved) ||
      resolved === recordings ||
      resolved.startsWith(`${recordings}${path.sep}`)
    ) {
      throw new Error('The archive path overlaps live application data');
    }
  }

  #recordingFilePath(relativePath) {
    const filePath = path.resolve(this.#recordingsPath, relativePath);
    if (path.dirname(filePath) !== path.resolve(this.#recordingsPath)) {
      throw new Error('Invalid recording path');
    }
    return filePath;
  }
}

export function registerDataStorageIpc({ ipcMain, userDataPath, isTrustedRenderer }) {
  const storage = new DataStorage(userDataPath);
  ipcMain.handle('data:request', (event, operation, payload) => {
    if (!isTrustedRenderer(event)) throw new Error('Untrusted data storage request');
    return storage.dispatch(operation, payload || {});
  });
  return storage;
}
