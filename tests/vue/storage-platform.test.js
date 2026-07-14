import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  dataRepository,
  exportAllData,
  replaceAllData
} from '../../src/vue/platform/dataRepository.js';
import {
  flushLocalWrites,
  installPersistenceListeners,
  resetLocalPersistenceForTests,
  scheduleLocalJson,
  writeLocalJson
} from '../../src/vue/platform/localPersistence.js';
import {
  initializeDataStorage,
  STORAGE_READY_KEY
} from '../../src/vue/platform/storageLifecycle.js';
import { installMemoryStorage } from './helpers/storage.js';

describe('local persistence coordinator', () => {
  beforeEach(() => {
    installMemoryStorage();
    resetLocalPersistenceForTests();
    vi.useFakeTimers();
  });

  it('coalesces rapid writes, skips identical snapshots and supports explicit flush', () => {
    const setItem = vi.spyOn(localStorage, 'setItem');
    for (let index = 0; index < 100; index += 1) {
      scheduleLocalJson('toefl:test', { input: 'x'.repeat(index) }, 300);
    }
    vi.advanceTimersByTime(300);
    expect(setItem).toHaveBeenCalledTimes(1);
    writeLocalJson('toefl:test', { input: 'x'.repeat(99) });
    expect(setItem).toHaveBeenCalledTimes(1);
    scheduleLocalJson('toefl:test', { input: 'final' }, 300);
    flushLocalWrites();
    expect(JSON.parse(localStorage.getItem('toefl:test'))).toEqual({ input: 'final' });
    expect(setItem).toHaveBeenCalledTimes(2);
  });

  it('flushes pending writes when the page is hidden', () => {
    installPersistenceListeners();
    scheduleLocalJson('toefl:test', { input: 'pending' }, 10_000);
    window.dispatchEvent(new Event('pagehide'));
    expect(JSON.parse(localStorage.getItem('toefl:test'))).toEqual({ input: 'pending' });
  });
});

describe('storage lifecycle', () => {
  it('resets legacy data once and preserves new data on later starts', async () => {
    const storage = installMemoryStorage({
      'toefl:settings': '{"old":true}',
      unrelated: 'keep'
    });
    await initializeDataStorage(storage);
    expect(storage.getItem('toefl:settings')).toBeNull();
    expect(storage.getItem('unrelated')).toBe('keep');
    expect(storage.getItem(STORAGE_READY_KEY)).toBe('1');

    storage.setItem('toefl:settings', '{"new":true}');
    await initializeDataStorage(storage);
    expect(storage.getItem('toefl:settings')).toBe('{"new":true}');
  });

  it('does not mark initialization complete when database setup fails', async () => {
    const storage = installMemoryStorage({ 'toefl:settings': '{"old":true}' });
    const services = {
      close: vi.fn(),
      removeDatabase: vi.fn().mockResolvedValue(),
      open: vi.fn().mockRejectedValue(new Error('blocked'))
    };
    await expect(initializeDataStorage(storage, services)).rejects.toThrow('blocked');
    expect(storage.getItem(STORAGE_READY_KEY)).toBeNull();
  });
});

describe('IndexedDB transactions', () => {
  it('aborts an invalid multi-store replacement without clearing prior data', async () => {
    await dataRepository.replaceAll({
      typingHistory: [{ key: 'old', value: { articleId: 'a', completedAt: '2026-01-01' } }]
    });
    await expect(
      replaceAllData({
        typingHistory: [
          { key: 'new', value: { articleId: 'b' } },
          { value: { articleId: 'missing-key' } }
        ]
      })
    ).rejects.toBeTruthy();
    expect((await exportAllData()).typingHistory).toEqual([
      { key: 'old', value: { articleId: 'a', completedAt: '2026-01-01' } }
    ]);
  });
});
