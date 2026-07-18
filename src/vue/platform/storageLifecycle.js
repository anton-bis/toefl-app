import { flushDataWrites, openDataDatabase, suspendDataWrites } from './dataRepository.js';
import {
  configureDesktopPersistence,
  flushLocalWrites,
  suspendLocalWrites
} from './localPersistence.js';

let listenersInstalled = false;

export async function flushDataStorage() {
  await Promise.all([flushLocalWrites(), flushDataWrites()]);
}

export function suspendDataStorage() {
  suspendLocalWrites();
  suspendDataWrites();
}

export function installStorageLifecycleListeners(target = globalThis.window) {
  if (listenersInstalled || !target?.addEventListener) return;
  const flushSafely = () => flushDataStorage().catch(() => {});
  const flushWhenHidden = () => {
    if (globalThis.document?.visibilityState === 'hidden') flushSafely();
  };
  target.addEventListener('pagehide', flushSafely);
  globalThis.document?.addEventListener?.('visibilitychange', flushWhenHidden);
  listenersInstalled = true;
}

export async function initializeDataStorage() {
  const desktop = globalThis.window?.electronAPI?.data;
  if (desktop) configureDesktopPersistence(await desktop.bootstrap());
  else {
    if (!globalThis.localStorage) {
      throw new Error("Local storage isn't available, so your data can't be loaded");
    }
    await openDataDatabase();
  }
  installStorageLifecycleListeners();
}
