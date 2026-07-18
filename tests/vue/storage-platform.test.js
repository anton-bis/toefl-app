import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  configureDesktopPersistence,
  flushLocalWrites,
  scheduleLocalJson,
  writeLocalJson
} from '../../src/vue/platform/localPersistence.js';
import {
  initializeDataStorage,
  installStorageLifecycleListeners
} from '../../src/vue/platform/storageLifecycle.js';
import { installMemoryStorage } from './helpers/storage.js';

describe('local persistence coordinator', () => {
  beforeEach(() => {
    installMemoryStorage();
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
    installStorageLifecycleListeners();
    scheduleLocalJson('toefl:test', { input: 'pending' }, 10_000);
    window.dispatchEvent(new Event('pagehide'));
    expect(JSON.parse(localStorage.getItem('toefl:test'))).toEqual({ input: 'pending' });
  });

  it('persists scalar desktop settings without treating them as exam sessions', async () => {
    const set = vi.fn().mockResolvedValue(true);
    window.electronAPI = { data: { settings: { set } } };
    configureDesktopPersistence({ settings: { volume: 1 } });
    writeLocalJson('volume', 0.5);
    await flushLocalWrites();
    expect(set).toHaveBeenCalledWith('volume', 0.5);
  });

  it('sends complete compact exam sessions to desktop storage', async () => {
    const save = vi.fn().mockResolvedValue(true);
    window.electronAPI = {
      data: {
        settings: { set: vi.fn().mockResolvedValue(true) },
        exam: { save }
      }
    };
    configureDesktopPersistence();
    writeLocalJson('toefl:exam:01:reading', {
      tpoId: '01',
      section: 'reading',
      status: 'in-progress',
      pageId: 'question-2',
      answers: { q2: 'C' },
      updatedAt: 200
    });
    await flushLocalWrites();

    expect(save).toHaveBeenCalledWith({
      id: 'tpo-01-reading',
      tpoId: '01',
      section: 'reading',
      status: 'in-progress',
      pageId: 'question-2',
      answers: { q2: 'C' },
      updatedAt: 200
    });
  });
});

describe('storage lifecycle', () => {
  it('hydrates desktop persistence directly from SQLite bootstrap data', async () => {
    installMemoryStorage();
    const data = {
      bootstrap: vi.fn().mockResolvedValue({
        settings: { theme: 'dark' },
        examSessions: []
      }),
      settings: { set: vi.fn().mockResolvedValue() },
      exam: { save: vi.fn().mockResolvedValue(), delete: vi.fn().mockResolvedValue() }
    };
    window.electronAPI = { data };
    await initializeDataStorage();

    expect(data.bootstrap).toHaveBeenCalledOnce();
  });
});
