import { describe, expect, it, vi } from 'vitest';

function installDesktopApi() {
  const data = {
    bootstrap: vi.fn().mockResolvedValue({
      settings: { appearance: { dark: true } },
      examSessions: []
    }),
    settings: { set: vi.fn().mockResolvedValue(true) },
    exam: {
      save: vi.fn().mockResolvedValue(true),
      delete: vi.fn().mockResolvedValue(true),
      listCompleted: vi.fn().mockResolvedValue([])
    },
    vocabulary: {
      list: vi.fn().mockResolvedValue([]),
      save: vi.fn().mockResolvedValue(true),
      overview: vi.fn().mockResolvedValue({ sets: [], due: [] })
    },
    typing: {
      list: vi.fn().mockResolvedValue([]),
      replace: vi.fn().mockResolvedValue(true)
    },
    recording: {
      save: vi.fn().mockResolvedValue(true),
      load: vi.fn().mockResolvedValue({ bytes: Uint8Array.from([1, 2]), mime: 'audio/webm' }),
      remove: vi.fn().mockResolvedValue(true),
      removeAttempt: vi.fn().mockResolvedValue(true),
      playbackUrl: vi.fn(
        (clientAttemptId, questionKey) =>
          `toefl-recording://playback/audio?attempt=${clientAttemptId}&question=${questionKey}`
      )
    }
  };
  Object.defineProperty(window, 'electronAPI', { configurable: true, value: { data } });
  return data;
}

describe('Electron data repository adapter', () => {
  it('moves recording bytes through the restricted recording API', async () => {
    const api = installDesktopApi();
    const { recordingRepository } = await import('../../src/vue/platform/dataRepository.js');
    await recordingRepository.save('attempt-1', 'question', new Blob(['hi'], { type: 'audio/webm' }));
    const loaded = await recordingRepository.load('attempt-1', 'question');
    expect(api.recording.save).toHaveBeenCalledWith(
      expect.objectContaining({ clientAttemptId: 'attempt-1', questionKey: 'question' })
    );
    expect(loaded).toBeInstanceOf(Blob);
    expect(loaded.size).toBe(2);
    expect(recordingRepository.playbackUrl('attempt-1', 'question')).toContain(
      'toefl-recording:'
    );
  });
});
