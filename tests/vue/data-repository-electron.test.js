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
      removeSession: vi.fn().mockResolvedValue(true),
      playbackUrl: vi.fn(
        (sessionId, questionId) =>
          `toefl-recording://playback/audio?session=${sessionId}&question=${questionId}`
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
    await recordingRepository.save('session', 'question', new Blob(['hi'], { type: 'audio/webm' }));
    const loaded = await recordingRepository.load('session', 'question');
    expect(api.recording.save).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 'session', questionId: 'question' })
    );
    expect(loaded).toBeInstanceOf(Blob);
    expect(loaded.size).toBe(2);
    expect(recordingRepository.playbackUrl('session', 'question')).toContain('toefl-recording:');
  });
});
