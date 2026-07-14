import {
  DATA_DB_NAME,
  LEGACY_RECORDING_DB_NAME,
  closeDataRepository,
  deleteDatabase,
  openDataDatabase
} from './dataRepository.js';
import { installPersistenceListeners } from './localPersistence.js';

export const STORAGE_READY_KEY = 'toefl:storage-ready';

function clearToeflEntries(storage) {
  const keys = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key?.startsWith('toefl:')) keys.push(key);
  }
  keys.forEach(key => storage.removeItem(key));
}

export async function initializeDataStorage(
  storage = globalThis.localStorage,
  services = {
    close: closeDataRepository,
    removeDatabase: deleteDatabase,
    open: openDataDatabase
  }
) {
  if (!storage) throw new Error('LocalStorage 不可用，无法初始化用户数据');
  if (storage.getItem(STORAGE_READY_KEY) === '1') {
    await services.open();
    installPersistenceListeners();
    return;
  }

  services.close();
  clearToeflEntries(storage);
  await Promise.all([
    services.removeDatabase(DATA_DB_NAME),
    services.removeDatabase(LEGACY_RECORDING_DB_NAME)
  ]);
  await services.open();
  storage.setItem(STORAGE_READY_KEY, '1');
  installPersistenceListeners();
}
