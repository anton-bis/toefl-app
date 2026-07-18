const DATA_DB_NAME = 'toefl-data';
const DATA_DB_VERSION = 2;

const STORES = {
  recordings: 'recordings',
  vocabularyProgress: 'vocabularyProgress',
  typingHistory: 'typingHistory'
};

let databasePromise;
const pendingWrites = new Set();
let writesSuspended = false;
const desktopData = () => globalThis.window?.electronAPI?.data;

function isSafeStorageKey(value) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 200 &&
    !Object.prototype.hasOwnProperty.call(Object.prototype, value)
  );
}

function requestResult(request, message) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error(message));
  });
}

export function openDataDatabase() {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(
      new Error('Your browser can\'t save learning progress because IndexedDB is unavailable')
    );
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
      const transaction = request.transaction;
      const recordings = transaction.objectStore(STORES.recordings);
      const vocabulary = transaction.objectStore(STORES.vocabularyProgress);
      const typing = transaction.objectStore(STORES.typingHistory);
      if (!recordings.indexNames.contains('sessionId'))
        recordings.createIndex('sessionId', 'sessionId');
      if (!vocabulary.indexNames.contains('subject')) vocabulary.createIndex('subject', 'subject');
      if (!typing.indexNames.contains('completedAt')) {
        typing.createIndex('completedAt', 'value.completedAt');
      }
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => {
        database.close();
        databasePromise = undefined;
      };
      resolve(database);
    };
    request.onerror = () => reject(request.error || new Error('Couldn\'t open learning data'));
    request.onblocked = () =>
      reject(new Error('Learning data is open in another window. Close it and try again.'));
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
      reject(error || new Error('Couldn\'t update learning data'));
    };
    transaction.oncomplete = () => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    transaction.onerror = () => fail(transaction.error);
    transaction.onabort = () =>
      fail(transaction.error || new Error('The learning data update was canceled'));
    try {
      result = operation(transaction);
    } catch (error) {
      transaction.abort();
      fail(error);
    }
  });
}

async function getAll(storeName, indexName, query) {
  const database = await openDataDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = indexName ? store.index(indexName).getAll(query) : store.getAll();
    let result = [];
    request.onsuccess = () => {
      result = request.result;
    };
    request.onerror = () => reject(request.error || new Error('Couldn\'t read learning data'));
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () =>
      reject(transaction.error || new Error('Couldn\'t read learning data'));
    transaction.onabort = () =>
      reject(transaction.error || new Error('Reading learning data was canceled'));
  });
}

function writeOperation(operation) {
  if (writesSuspended) return Promise.reject(new Error('Saving learning data is paused'));
  const promise = Promise.resolve().then(operation);
  pendingWrites.add(promise);
  promise.finally(() => pendingWrites.delete(promise)).catch(() => {});
  return promise;
}

export async function flushDataWrites() {
  while (pendingWrites.size) await Promise.all([...pendingWrites]);
}

export function suspendDataWrites() {
  writesSuspended = true;
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

function blobBytes(blob) {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('Could not read recording'));
    reader.readAsArrayBuffer(blob);
  });
}

export async function loadVocabularyProgress(subject) {
  const api = desktopData();
  const records = api
    ? await api.vocabulary.list(subject)
    : await getAll(STORES.vocabularyProgress, subject ? 'subject' : undefined, subject);
  const progress = {};
  records.forEach(({ subject, setId, wordId: storedWordId, value }) => {
    const wordId = storedWordId === '$set' ? undefined : storedWordId;
    if (!isSafeStorageKey(subject) || !isSafeStorageKey(setId) || !value) return;
    if (wordId !== undefined && !isSafeStorageKey(wordId)) return;
    const set = ((progress[subject] ||= {})[setId] ||= { words: {} });
    if (wordId) set.words[wordId] = value;
    else Object.assign(set, value, { words: set.words });
  });
  return progress;
}

export async function loadVocabularyOverview(date) {
  const api = desktopData();
  if (api) return api.vocabulary.overview(date);
  const records = await getAll(STORES.vocabularyProgress);
  const due = new Map();
  const sets = [];
  records.forEach(record => {
    if (record.wordId) {
      if (record.value?.nextReview <= date && record.value?.lastQ < 5) {
        due.set(record.subject, (due.get(record.subject) || 0) + 1);
      }
    } else sets.push({ subject: record.subject, setId: record.setId, value: record.value });
  });
  return { sets, due: [...due].map(([subject, count]) => ({ subject, count })) };
}

function saveVocabularyProgress(subject, setId, wordId, value) {
  const api = desktopData();
  if (api) {
    return writeOperation(() =>
      api.vocabulary.save({ subject, setId, wordId, value: plainRecord(value) })
    );
  }
  return put(STORES.vocabularyProgress, {
    key: vocabularyKey(subject, setId, wordId),
    subject,
    setId,
    wordId,
    value: plainRecord(value)
  });
}

export function saveVocabularyWord(subject, setId, wordId, value) {
  return saveVocabularyProgress(subject, setId, wordId, value);
}

export function saveVocabularySet(subject, setId, value) {
  const metadata = { ...(value || {}) };
  delete metadata.words;
  return saveVocabularyProgress(subject, setId, undefined, metadata);
}

export async function loadTypingHistory() {
  const api = desktopData();
  if (api) return api.typing.list();
  const records = await getAll(STORES.typingHistory);
  return records
    .map(record => record.value)
    .filter(Boolean)
    .sort((a, b) => String(a.completedAt).localeCompare(String(b.completedAt)));
}

export async function replaceTypingHistory(history) {
  const values = history.slice(-100).map(plainRecord);
  const api = desktopData();
  if (api) {
    await writeOperation(() => api.typing.replace(values));
    return;
  }
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

export const recordingRepository = {
  playbackUrl(sessionId, questionId) {
    return desktopData()?.recording.playbackUrl?.(sessionId, String(questionId)) || null;
  },
  async save(sessionId, questionId, blob) {
    if (!(blob instanceof Blob)) throw new TypeError('Recording must be a Blob');
    if (desktopData()) {
      const api = desktopData();
      return writeOperation(async () =>
        api.recording.save({
          sessionId,
          questionId: String(questionId),
          mime: blob.type,
          bytes: new Uint8Array(await blobBytes(blob))
        })
      );
    }
    return put(STORES.recordings, {
      key: recordingKey(sessionId, questionId),
      sessionId,
      questionId: String(questionId),
      blob,
      updatedAt: Date.now()
    });
  },
  async load(sessionId, questionId) {
    if (desktopData()) {
      const record = await desktopData().recording.load({
        sessionId,
        questionId: String(questionId)
      });
      return record ? new Blob([record.bytes], { type: record.mime }) : null;
    }
    const database = await openDataDatabase();
    const transaction = database.transaction(STORES.recordings, 'readonly');
    const record = await requestResult(
      transaction.objectStore(STORES.recordings).get(recordingKey(sessionId, questionId)),
      'Couldn\'t read the recording'
    );
    return record?.blob instanceof Blob ? record.blob : null;
  },
  remove(sessionId, questionId) {
    if (desktopData()) {
      return writeOperation(() =>
        desktopData().recording.remove({ sessionId, questionId: String(questionId) })
      );
    }
    return remove(STORES.recordings, recordingKey(sessionId, questionId));
  },
  async removeSession(sessionId) {
    if (desktopData()) {
      await writeOperation(() => desktopData().recording.removeSession(sessionId));
      return;
    }
    await writeOperation(() =>
      runTransaction(STORES.recordings, 'readwrite', transaction => {
        const index = transaction.objectStore(STORES.recordings).index('sessionId');
        const cursor = index.openKeyCursor(IDBKeyRange.only(sessionId));
        cursor.onsuccess = () => {
          if (!cursor.result) return;
          transaction.objectStore(STORES.recordings).delete(cursor.result.primaryKey);
          cursor.result.continue();
        };
      })
    );
  }
};
