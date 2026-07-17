import { dataRepository } from './dataRepository.js';
import {
  flushLocalWrites,
  isPlainObject,
  isSafeStorageKey,
  resumeLocalWrites,
  suspendLocalWrites
} from './localPersistence.js';

const MAX_ENTRY_COUNT = 200;
const MAX_ENTRY_SIZE = 2_000_000;
const MAX_ENTRIES_SIZE = 4_000_000;
const MAX_RECORD_COUNT = 5_000;
const MAX_RECORDING_COUNT = 200;
const MAX_RECORDING_SIZE = 5 * 1024 * 1024;
const MAX_RECORDINGS_SIZE = 20 * 1024 * 1024;
const USER_DATA_KEY =
  /^toefl:(?:exam:[^:]+:[^:]+|settings|typing:session|vocabulary:(?:settings|session))$/;

function assertBoundedJson(value) {
  let nodes = 0;
  const visit = (item, depth) => {
    if (depth > 10 || ++nodes > 50_000) throw new Error('This data file is too complex');
    if (typeof item === 'string' && item.length > 500_000)
      throw new Error('This data file contains an oversized field');
    if (Array.isArray(item)) item.forEach(child => visit(child, depth + 1));
    else if (isPlainObject(item)) Object.values(item).forEach(child => visit(child, depth + 1));
  };
  visit(value, 0);
}

function validateEntry(key, serialized) {
  if (!USER_DATA_KEY.test(key) || typeof serialized !== 'string') {
    throw new Error('This data file contains unsupported fields');
  }
  if (serialized.length > MAX_ENTRY_SIZE) throw new Error('A data entry is too large');
  let value;
  try {
    value = JSON.parse(serialized);
  } catch {
    throw new Error('This data file contains invalid JSON');
  }
  assertBoundedJson(value);
  if (value !== null && !isPlainObject(value)) throw new Error('This data file is invalid');
  return serialized;
}

function blobDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('Couldn\'t read the recording'));
    reader.readAsDataURL(blob);
  });
}

function dataUrlBlob(value) {
  const match = String(value).match(/^data:(audio\/[a-z0-9.+-]+);base64,([a-z0-9+/=]+)$/i);
  if (!match) throw new Error('Invalid recording data');
  const estimatedSize = Math.floor((match[2].length * 3) / 4);
  if (estimatedSize > MAX_RECORDING_SIZE) throw new Error('A recording is too large');
  const decoded = atob(match[2]);
  const bytes = Uint8Array.from(decoded, character => character.charCodeAt(0));
  return new Blob([bytes], { type: match[1] });
}

export function readUserEntries(storage = localStorage) {
  const entries = {};
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (USER_DATA_KEY.test(key || '')) entries[key] = storage.getItem(key);
  }
  return entries;
}

function validateRecords(records) {
  if (
    !isPlainObject(records) ||
    !Array.isArray(records.vocabularyProgress) ||
    !Array.isArray(records.typingHistory)
  ) {
    throw new Error('Invalid learning history');
  }
  if (records.vocabularyProgress.length + records.typingHistory.length > MAX_RECORD_COUNT) {
    throw new Error('This file contains too many learning records');
  }
  const vocabularyProgress = records.vocabularyProgress.map(record => {
    if (
      !isPlainObject(record) ||
      !isSafeStorageKey(record.key) ||
      !['reading', 'listening', 'writing', 'speaking'].includes(record.subject) ||
      !isSafeStorageKey(record.setId) ||
      (record.wordId !== undefined && !isSafeStorageKey(record.wordId)) ||
      record.key !== `${record.subject}:${record.setId}:${record.wordId ?? '$set'}` ||
      !isPlainObject(record.value)
    ) {
      throw new Error('Invalid vocabulary progress');
    }
    assertBoundedJson(record);
    return record;
  });
  const typingHistory = records.typingHistory.map(record => {
    if (
      !isPlainObject(record) ||
      !isSafeStorageKey(record.key) ||
      !isPlainObject(record.value) ||
      !isSafeStorageKey(record.value.articleId) ||
      typeof record.value.completedAt !== 'string'
    ) {
      throw new Error('Invalid typing history');
    }
    assertBoundedJson(record);
    return record;
  });
  return {
    vocabularyProgress,
    typingHistory
  };
}

function validateRecordings(recordings) {
  if (!Array.isArray(recordings) || recordings.length > MAX_RECORDING_COUNT) {
    throw new Error('This file contains too many recordings');
  }
  let totalSize = 0;
  const values = recordings.map(record => {
    if (
      !isPlainObject(record) ||
      typeof record.sessionId !== 'string' ||
      !record.sessionId ||
      record.sessionId.length > 200 ||
      typeof record.questionId !== 'string' ||
      !record.questionId ||
      record.questionId.length > 200 ||
      typeof record.data !== 'string'
    ) {
      throw new Error('Invalid recording data');
    }
    const blob = dataUrlBlob(record.data);
    totalSize += blob.size;
    return {
      key: `${record.sessionId}:${record.questionId}`,
      sessionId: record.sessionId,
      questionId: record.questionId,
      updatedAt: Number(record.updatedAt) || Date.now(),
      blob
    };
  });
  if (totalSize > MAX_RECORDINGS_SIZE) throw new Error('The recordings are too large');
  return values;
}

export async function exportUserData(repository = dataRepository, storage = localStorage) {
  flushLocalWrites();
  suspendLocalWrites();
  repository.suspendWrites?.();
  let stored;
  let entries;
  try {
    await repository.flushWrites?.();
    stored = await repository.exportAll();
    entries = readUserEntries(storage);
  } finally {
    repository.resumeWrites?.();
    resumeLocalWrites();
  }
  const recordings = await Promise.all(
    stored.recordings.map(async record => ({
      sessionId: record.sessionId,
      questionId: record.questionId,
      updatedAt: record.updatedAt,
      data: await blobDataUrl(record.blob)
    }))
  );
  return {
    format: 'toefl-user-data',
    exportedAt: new Date().toISOString(),
    entries,
    records: {
      vocabularyProgress: stored.vocabularyProgress,
      typingHistory: stored.typingHistory
    },
    recordings
  };
}

export function validateUserData(payload) {
  if (
    payload?.format !== 'toefl-user-data' ||
    !isPlainObject(payload.entries) ||
    !isPlainObject(payload.records) ||
    !Array.isArray(payload.recordings)
  ) {
    throw new Error('Unsupported data file');
  }
  const rawEntries = Object.entries(payload.entries);
  if (rawEntries.length > MAX_ENTRY_COUNT) throw new Error('This file contains too many entries');
  let entriesSize = 0;
  const entries = rawEntries.map(([key, value]) => {
    entriesSize += key.length + (typeof value === 'string' ? value.length : 0);
    return [key, validateEntry(key, value)];
  });
  if (entriesSize > MAX_ENTRIES_SIZE) throw new Error('This data file is too large');
  return {
    entries,
    records: {
      ...validateRecords(payload.records),
      recordings: validateRecordings(payload.recordings)
    }
  };
}

function replaceEntries(entries, storage) {
  Object.keys(readUserEntries(storage)).forEach(key => storage.removeItem(key));
  entries.forEach(([key, value]) => storage.setItem(key, value));
}

export async function importUserData(payload, repository = dataRepository, storage = localStorage) {
  const incoming = validateUserData(payload);
  flushLocalWrites();
  suspendLocalWrites();
  repository.suspendWrites?.();
  try {
    await repository.flushWrites?.();
    const previousEntries = Object.entries(readUserEntries(storage));
    const previousRecords = await repository.exportAll();
    try {
      replaceEntries(incoming.entries, storage);
      await repository.replaceAll(incoming.records);
    } catch (error) {
      try {
        replaceEntries(previousEntries, storage);
        await repository.replaceAll(previousRecords);
      } catch {
        throw new Error(
          `Import failed, and some previous data could not be restored: ${error?.message || 'Unknown error'}`
        );
      }
      throw error;
    }
  } finally {
    repository.resumeWrites?.();
    resumeLocalWrites();
  }
}
