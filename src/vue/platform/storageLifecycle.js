import { openDataDatabase } from './dataRepository.js';
import {
  configureDesktopPersistence,
  installPersistenceListeners
} from './localPersistence.js';

export async function initializeDataStorage() {
  const desktop = globalThis.window?.electronAPI?.data;
  if (desktop) configureDesktopPersistence(await desktop.bootstrap());
  else {
    if (!globalThis.localStorage) {
      throw new Error('Local storage isn\'t available, so your data can\'t be loaded');
    }
    await openDataDatabase();
  }
  installPersistenceListeners();
}
