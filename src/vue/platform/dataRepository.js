import { isSafeStorageKey } from './localPersistence.js';

export const DATA_DB_NAME = 'toefl-data';
export const LEGACY_RECORDING_DB_NAME = 'toefl-recordings';
const DATA_DB_VERSION = 1;

const STORES = {
  recordings: 'recordings',
  vocabularyProgress: 'vocabularyProgress',
  typingHistory: 'typingHistory'
};

let databasePromise;
const pendingWrites = new Set();
let writesSuspended = false;

function requestResult(request, message) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error(message));
  });
}

export function openDataDatabase() {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('当前环境不支持 IndexedDB，无法保存学习数据'));
  }
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATA_DB_NAME, DATA_DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      Object.values(STORES).forEach(name => {
        if (!database.objectStoreNames.contains(name)) {
          database.createObjectStore(name, { keyPath: 'key' });
        }
      });
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => {
        database.close();
        databasePromise = undefined;
      };
      resolve(database);
    };
    request.onerror = () => reject(request.error || new Error('无法打开学习数据存储'));
    request.onblocked = () => reject(new Error('学习数据存储被其他窗口占用'));
  });
  databasePromise.catch(() => {
    databasePromise = undefined;
  });
  return databasePromise;
}

async function runTransaction(storeNames, mode, operation) {
  const database = await openDataDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeNames, mode);
    let result;
    let settled = false;
    const fail = error => {
      if (settled) return;
      settled = true;
      reject(error || new Error('学习数据事务失败'));
    };
    transaction.oncomplete = () => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    transaction.onerror = () => fail(transaction.error);
    transaction.onabort = () => fail(transaction.error || new Error('学习数据事务已中止'));
    try {
      result = operation(transaction);
    } catch (error) {
      transaction.abort();
      fail(error);
    }
  });
}

async function getAll(storeName) {
  const database = await openDataDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readonly');
    const request = transaction.objectStore(storeName).getAll();
    let result = [];
    request.onsuccess = () => {
      result = request.result;
    };
    request.onerror = () => reject(request.error || new Error('无法读取学习数据'));
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error || new Error('无法读取学习数据'));
    transaction.onabort = () => reject(transaction.error || new Error('读取学习数据已中止'));
  });
}

function writeOperation(operation) {
  if (writesSuspended) return Promise.reject(new Error('学习数据写入已暂停'));
  const promise = Promise.resolve().then(operation);
  pendingWrites.add(promise);
  promise.finally(() => pendingWrites.delete(promise)).catch(() => {});
  return promise;
}

export async function flushDataWrites() {
  await Promise.all([...pendingWrites]);
}

export function suspendDataWrites() {
  writesSuspended = true;
}

export function resumeDataWrites() {
  writesSuspended = false;
}

async function put(storeName, record) {
  await writeOperation(() =>
    runTransaction(storeName, 'readwrite', transaction => {
      transaction.objectStore(storeName).put(record);
    })
  );
  return record;
}

async function remove(storeName, key) {
  await writeOperation(() =>
    runTransaction(storeName, 'readwrite', transaction => {
      transaction.objectStore(storeName).delete(key);
    })
  );
}

function recordingKey(sessionId, questionId) {
  return `${String(sessionId || 'speaking')}:${String(questionId)}`;
}

function vocabularyKey(subject, setId, wordId = '$set') {
  return `${subject}:${setId}:${wordId}`;
}

function plainRecord(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeDatabaseRecords(records = {}) {
  return Object.fromEntries(
    Object.values(STORES).map(name => [name, Array.isArray(records[name]) ? records[name] : []])
  );
}

export async function replaceAllData(records) {
  const normalized = normalizeDatabaseRecords(records);
  await runTransaction(Object.values(STORES), 'readwrite', transaction => {
    Object.entries(normalized).forEach(([name, values]) => {
      const store = transaction.objectStore(name);
      store.clear();
      values.forEach(value => store.put(value));
    });
  });
}

export async function exportAllData() {
  const [recordings, vocabularyProgress, typingHistory] = await Promise.all([
    getAll(STORES.recordings),
    getAll(STORES.vocabularyProgress),
    getAll(STORES.typingHistory)
  ]);
  return { recordings, vocabularyProgress, typingHistory };
}

export async function loadVocabularyProgress() {
  const records = await getAll(STORES.vocabularyProgress);
  const progress = {};
  records.forEach(({ subject, setId, wordId, value }) => {
    if (!isSafeStorageKey(subject) || !isSafeStorageKey(setId) || !value) return;
    if (wordId !== undefined && !isSafeStorageKey(wordId)) return;
    const set = ((progress[subject] ||= {})[setId] ||= { words: {} });
    if (wordId) set.words[wordId] = value;
    else Object.assign(set, value, { words: set.words });
  });
  return progress;
}

export function saveVocabularyWord(subject, setId, wordId, value) {
  return put(STORES.vocabularyProgress, {
    key: vocabularyKey(subject, setId, wordId),
    subject,
    setId,
    wordId,
    value: plainRecord(value)
  });
}

export function saveVocabularySet(subject, setId, value) {
  const metadata = { ...(value || {}) };
  delete metadata.words;
  return put(STORES.vocabularyProgress, {
    key: vocabularyKey(subject, setId),
    subject,
    setId,
    value: plainRecord(metadata)
  });
}

export async function loadTypingHistory() {
  const records = await getAll(STORES.typingHistory);
  return records
    .map(record => record.value)
    .filter(Boolean)
    .sort((a, b) => String(a.completedAt).localeCompare(String(b.completedAt)));
}

export async function replaceTypingHistory(history) {
  const values = history.slice(-100).map(plainRecord);
  await writeOperation(() =>
    runTransaction(STORES.typingHistory, 'readwrite', transaction => {
      const store = transaction.objectStore(STORES.typingHistory);
      store.clear();
      values.forEach((value, index) => {
        store.put({ key: `${value.completedAt || ''}:${value.articleId || ''}:${index}`, value });
      });
    })
  );
}

export function closeDataRepository() {
  if (!databasePromise) return;
  databasePromise.then(database => database.close()).catch(() => {});
  databasePromise = undefined;
}

export function deleteDatabase(name) {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB 不可用'));
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error(`无法删除数据库 ${name}`));
    request.onblocked = () => reject(new Error(`数据库 ${name} 正被占用`));
  });
}

export const recordingRepository = {
  async save(sessionId, questionId, blob) {
    if (!(blob instanceof Blob)) throw new TypeError('Recording must be a Blob');
    return put(STORES.recordings, {
      key: recordingKey(sessionId, questionId),
      sessionId,
      questionId: String(questionId),
      blob,
      updatedAt: Date.now()
    });
  },
  async load(sessionId, questionId) {
    const database = await openDataDatabase();
    const transaction = database.transaction(STORES.recordings, 'readonly');
    const record = await requestResult(
      transaction.objectStore(STORES.recordings).get(recordingKey(sessionId, questionId)),
      '无法读取录音'
    );
    return record?.blob instanceof Blob ? record.blob : null;
  },
  remove(sessionId, questionId) {
    return remove(STORES.recordings, recordingKey(sessionId, questionId));
  },
  async removeSession(sessionId) {
    await writeOperation(async () => {
      const records = await getAll(STORES.recordings);
      await runTransaction(STORES.recordings, 'readwrite', transaction => {
        const store = transaction.objectStore(STORES.recordings);
        records
          .filter(record => record.sessionId === sessionId)
          .forEach(record => store.delete(record.key));
      });
    });
  },
  listAll() {
    return getAll(STORES.recordings);
  },
  async clearAll() {
    await writeOperation(() =>
      runTransaction(STORES.recordings, 'readwrite', transaction => {
        transaction.objectStore(STORES.recordings).clear();
      })
    );
  }
};

export const dataRepository = {
  exportAll: exportAllData,
  replaceAll: replaceAllData,
  flushWrites: flushDataWrites,
  suspendWrites: suspendDataWrites,
  resumeWrites: resumeDataWrites
};
