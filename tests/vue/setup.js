import 'fake-indexeddb/auto';
import { enableAutoUnmount } from '@vue/test-utils';
import { afterEach, beforeEach, vi } from 'vitest';
import { resetLocalPersistenceForTests } from '../../src/vue/platform/localPersistence.js';

enableAutoUnmount(afterEach);
beforeEach(() => resetLocalPersistenceForTests());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete window.electronAPI;
});
