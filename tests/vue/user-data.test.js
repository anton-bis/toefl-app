import { describe, expect, it, vi } from 'vitest';
import {
  exportUserData,
  importUserData,
  readUserEntries,
  validateUserData
} from '../../src/vue/platform/userData.js';
import { createMemoryStorage } from './helpers/storage.js';

function repositoryMock(records = []) {
  let stored = {
    recordings: [...records],
    vocabularyProgress: [],
    typingHistory: []
  };
  let failNext = false;
  return {
    flushWrites: vi.fn().mockResolvedValue(),
    suspendWrites: vi.fn(),
    resumeWrites: vi.fn(),
    exportAll: vi.fn(async () => structuredClone(stored)),
    replaceAll: vi.fn(async recordsToStore => {
      if (failNext) {
        failNext = false;
        throw new Error('disk full');
      }
      stored = structuredClone(recordsToStore);
    }),
    failOnce() {
      failNext = true;
    },
    records: () => stored
  };
}

const audioData = 'data:audio/webm;base64,YQ==';

describe('user data import', () => {
  it('exports only current unversioned storage keys', () => {
    const storage = createMemoryStorage({
      'toefl:settings': '{}',
      'toefl:legacy:settings': '{}',
      'toefl:unknown': '{}'
    });
    expect(readUserEntries(storage)).toEqual({ 'toefl:settings': '{}' });
  });

  it('rejects unknown keys and malformed recording payloads before mutation', () => {
    expect(() =>
      validateUserData({
        format: 'toefl-user-data',
        entries: { 'toefl:unknown': '{}' },
        records: { vocabularyProgress: [], typingHistory: [] },
        recordings: []
      })
    ).toThrow(/未知字段/);
    expect(() =>
      validateUserData({
        format: 'toefl-user-data',
        entries: {},
        records: { vocabularyProgress: [], typingHistory: [] },
        recordings: [{ sessionId: 's', questionId: 'q', data: 'data:text/html;base64,YQ==' }]
      })
    ).toThrow(/录音数据无效/);
    expect(() =>
      validateUserData({
        format: 'toefl-user-data',
        entries: {},
        records: {
          vocabularyProgress: [
            {
              key: 'reading:__proto__:$set',
              subject: 'reading',
              setId: '__proto__',
              value: {}
            }
          ],
          typingHistory: []
        },
        recordings: []
      })
    ).toThrow(/词汇记录格式无效/);
  });

  it('exports a coordinated local and IndexedDB snapshot', async () => {
    const storage = createMemoryStorage({ 'toefl:settings': '{}' });
    const repository = repositoryMock();
    const payload = await exportUserData(repository, storage);
    expect(payload).toMatchObject({
      format: 'toefl-user-data',
      entries: { 'toefl:settings': '{}' },
      records: { vocabularyProgress: [], typingHistory: [] },
      recordings: []
    });
    expect(repository.suspendWrites).toHaveBeenCalledOnce();
    expect(repository.flushWrites).toHaveBeenCalledOnce();
    expect(repository.resumeWrites).toHaveBeenCalledOnce();
  });

  it('restores prior local and recording data when applying an import fails', async () => {
    const storage = createMemoryStorage({ 'toefl:settings': '{"old":true}' });
    const oldBlob = new Blob(['old'], { type: 'audio/webm' });
    const repository = repositoryMock([{ sessionId: 'old', questionId: 'old-q', blob: oldBlob }]);
    repository.failOnce();

    await expect(
      importUserData(
        {
          format: 'toefl-user-data',
          entries: { 'toefl:settings': '{"new":true}' },
          records: { vocabularyProgress: [], typingHistory: [] },
          recordings: [{ sessionId: 'new', questionId: 'new-q', data: audioData }]
        },
        repository,
        storage
      )
    ).rejects.toThrow('disk full');

    expect(storage.getItem('toefl:settings')).toBe('{"old":true}');
    expect(repository.flushWrites).toHaveBeenCalledOnce();
    expect(repository.suspendWrites).toHaveBeenCalledOnce();
    expect(repository.resumeWrites).toHaveBeenCalledOnce();
    expect(repository.records().recordings).toEqual([
      expect.objectContaining({ sessionId: 'old', questionId: 'old-q' })
    ]);
  });
});
