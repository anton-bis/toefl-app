import { defineComponent, ref } from 'vue';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  examStorageKey,
  pruneCompletedExamHistory,
  useExamStore
} from '../../src/vue/stores/exam.js';
import { SETTINGS_STORAGE_KEY, useSettingsStore } from '../../src/vue/stores/settings.js';
import {
  formatExamTime,
  getRemainingSeconds,
  useExamTimer
} from '../../src/vue/exam/composables/useExamTimer.js';
import { examQuestions, isCorrectAnswer } from '../../src/vue/exam/shared/model.js';
import { installMemoryStorage } from './helpers/storage.js';

describe('exam sessions', () => {
  beforeEach(() => {
    installMemoryStorage();
    setActivePinia(createPinia());
  });

  it('isolates answers, marks and page state by TPO and section', () => {
    const store = useExamStore();
    store.openSession({ tpoId: '01', section: 'reading', pageId: 'r-start' });
    store.start({ pageId: 'r-start' });
    store.setPage('r-q1');
    store.saveAnswer('r1', 'B');
    store.toggleMark('r1');

    store.openSession({ tpoId: '01', section: 'listening', pageId: 'l-start' });
    store.start({ pageId: 'l-start' });
    expect(store.activeSession.answers).toEqual({});
    store.saveAnswer('l1', 'C');

    store.openSession({ tpoId: '01', section: 'reading' });
    expect(store.activeSession).toMatchObject({
      pageId: 'r-q1',
      answers: { r1: 'B' },
      marks: { r1: true }
    });
    expect(JSON.parse(localStorage.getItem(examStorageKey('01', 'listening'))).answers).toEqual({
      l1: 'C'
    });
  });

  it('ignores stored sessions belonging to another exam', () => {
    const key = examStorageKey('02', 'writing');
    localStorage.setItem(
      key,
      JSON.stringify({ tpoId: '03', section: 'writing', answers: { old: true } })
    );
    const store = useExamStore();
    const session = store.openSession({ tpoId: '02', section: 'writing' });
    expect(session.answers).toEqual({});
  });

  it('drops obsolete answer-reveal state from restored sessions', () => {
    const key = examStorageKey('02', 'reading');
    localStorage.setItem(
      key,
      JSON.stringify({
        tpoId: '02',
        section: 'reading',
        status: 'in-progress',
        check: { revealed: true, revealedScopes: { q1: true }, checkedAt: 100 }
      })
    );
    const store = useExamStore();
    const session = store.openSession({ tpoId: '02', section: 'reading' });
    expect(session).not.toHaveProperty('check');
  });

  it('does not persist a blank session opened only for report inspection', () => {
    const store = useExamStore();
    store.openSession({ tpoId: '02', section: 'reading' });
    expect(localStorage.getItem(examStorageKey('02', 'reading'))).toBeNull();
  });

  it('uses an absolute deadline and persists timer visibility', () => {
    const store = useExamStore();
    store.openSession({ tpoId: '03', section: 'listening', durationSeconds: 90, now: 1_000 });
    store.start({ now: 5_000 });
    store.setTimerHidden(true);
    expect(store.activeSession.timer).toMatchObject({
      mode: 'countdown',
      deadlineAt: 95_000,
      hidden: true
    });
    expect(getRemainingSeconds(store.activeSession.timer, 35_001)).toBe(60);
  });

  it('locks timed listening answers and freezes completed sessions', () => {
    const store = useExamStore();
    store.openSession({ tpoId: '03', section: 'listening' });
    store.start({ durationSeconds: 20, pageId: 'q1', scopeType: 'question', scopeId: 'q1' });
    store.saveAnswer('q1', 'A');
    store.lockQuestions(['q1']);
    store.saveAnswer('q1', 'B');
    expect(store.activeSession.answers.q1).toBe('A');
    expect(store.activeSession.lockedQuestionIds.q1).toBe(true);

    store.complete(10_000);
    store.saveAnswer('q2', 'C');
    expect(store.activeSession.answers.q2).toBeUndefined();
    expect(store.activeSession.timer).toMatchObject({
      mode: 'unlimited',
      deadlineAt: null,
      scopeId: null
    });
  });

  it('batches rapid answer persistence and flushes before switching sessions', () => {
    vi.useFakeTimers();
    const setItem = vi.spyOn(localStorage, 'setItem');
    const store = useExamStore();
    store.openSession({ tpoId: '04', section: 'writing' });
    store.start();
    setItem.mockClear();
    store.saveAnswer('essay', 'a');
    store.saveAnswer('essay', 'ab');
    store.saveAnswer('essay', 'abc');
    expect(setItem).not.toHaveBeenCalled();
    store.openSession({ tpoId: '04', section: 'reading' });
    expect(JSON.parse(localStorage.getItem(examStorageKey('04', 'writing'))).answers.essay).toBe(
      'abc'
    );
  });

  it('normalizes and persists section volume settings', () => {
    const settings = useSettingsStore();
    settings.setVolume('speaking', 2);
    settings.setVolume('listening', 0.35);
    expect(settings.volume('speaking')).toBe(1);
    expect(settings.volume('listening')).toBe(0.35);
    expect(JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY)).volumes.listening).toBe(0.35);
  });
});

describe('exam timer', () => {
  it('formats countdown and unlimited states', () => {
    expect(formatExamTime(70)).toBe('01:10');
    expect(formatExamTime(3_670)).toBe('01:01:10');
    expect(formatExamTime(null)).toBe('--:--');
    expect(getRemainingSeconds({ mode: 'unlimited', deadlineAt: null }, 10)).toBeNull();
  });

  it('marks urgent, emits expiry once and clears its interval on unmount', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    const expired = vi.fn();
    let exposed;
    const TimerHarness = defineComponent({
      setup() {
        const timer = ref({ mode: 'countdown', deadlineAt: 11_500, hidden: false });
        exposed = useExamTimer(timer, { interval: 100, urgentAt: 60, onExpired: expired });
        return () => null;
      }
    });
    const wrapper = mount(TimerHarness);
    expect(exposed.urgent.value).toBe(true);
    await vi.advanceTimersByTimeAsync(1_600);
    expect(exposed.expired.value).toBe(true);
    expect(expired).toHaveBeenCalledTimes(1);
    wrapper.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('stops background ticking and catches up from the absolute deadline when visible', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    let exposed;
    const TimerHarness = defineComponent({
      setup() {
        exposed = useExamTimer(ref({ mode: 'countdown', deadlineAt: 20_000 }), {
          interval: 100
        });
        return () => null;
      }
    });
    const wrapper = mount(TimerHarness);
    const hidden = vi.spyOn(document, 'hidden', 'get');
    hidden.mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(vi.getTimerCount()).toBe(0);

    vi.setSystemTime(15_000);
    hidden.mockReturnValue(false);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(exposed.remainingSeconds.value).toBe(5);
    expect(vi.getTimerCount()).toBe(1);

    wrapper.unmount();
    hidden.mockRestore();
  });
});

describe('exam retention', () => {
  it('keeps recent and unfinished TPOs while removing expired recordings', async () => {
    const storage = installMemoryStorage();
    for (let index = 1; index <= 22; index += 1) {
      const tpoId = String(index).padStart(2, '0');
      storage.setItem(
        examStorageKey(tpoId, 'reading'),
        JSON.stringify({
          tpoId,
          section: 'reading',
          status: 'completed',
          completedAt: index
        })
      );
    }
    storage.setItem(
      examStorageKey('01', 'speaking'),
      JSON.stringify({ tpoId: '01', section: 'speaking', status: 'completed', completedAt: 1 })
    );
    storage.setItem(
      examStorageKey('02', 'speaking'),
      JSON.stringify({ tpoId: '02', section: 'speaking', status: 'in-progress', updatedAt: 2 })
    );
    storage.setItem(
      examStorageKey('00', 'reading'),
      JSON.stringify({ tpoId: '00', section: 'reading', status: 'in-progress', updatedAt: 0 })
    );
    const repository = { removeSession: vi.fn().mockResolvedValue() };

    await expect(pruneCompletedExamHistory(storage, repository)).resolves.toEqual(['02', '01']);
    expect(storage.getItem(examStorageKey('01', 'reading'))).toBeNull();
    expect(storage.getItem(examStorageKey('02', 'reading'))).toBeNull();
    expect(storage.getItem(examStorageKey('02', 'speaking'))).not.toBeNull();
    expect(storage.getItem(examStorageKey('00', 'reading'))).not.toBeNull();
    expect(repository.removeSession).toHaveBeenCalledWith('tpo-01-speaking');
    expect(repository.removeSession).not.toHaveBeenCalledWith('tpo-02-speaking');
  });

  it('keeps completed sessions when recording cleanup fails', async () => {
    const storage = installMemoryStorage({
      [examStorageKey('01', 'speaking')]: JSON.stringify({
        tpoId: '01',
        section: 'speaking',
        status: 'completed',
        completedAt: 1
      }),
      [examStorageKey('01', 'reading')]: JSON.stringify({
        tpoId: '01',
        section: 'reading',
        status: 'completed',
        completedAt: 1
      }),
      [examStorageKey('02', 'reading')]: JSON.stringify({
        tpoId: '02',
        section: 'reading',
        status: 'completed',
        completedAt: 2
      })
    });
    const repository = { removeSession: vi.fn().mockRejectedValue(new Error('disk error')) };

    await expect(pruneCompletedExamHistory(storage, repository, 1)).rejects.toThrow('disk error');
    expect(storage.getItem(examStorageKey('01', 'speaking'))).not.toBeNull();
    expect(storage.getItem(examStorageKey('01', 'reading'))).not.toBeNull();
  });
});

describe('generic answer comparison', () => {
  it('compares strings case-insensitively and arrays order-insensitively', () => {
    expect(isCorrectAnswer(' B ', { correctAnswer: 'b' })).toBe(true);
    expect(isCorrectAnswer(['B', 'A'], { correctAnswers: ['a', 'b'] })).toBe(true);
    expect(isCorrectAnswer('', { correctAnswer: 'A' })).toBe(false);
    expect(
      isCorrectAnswer(
        { slots: [0, 1] },
        {
          type: 'build-sentence',
          prompt: '____ you ____?',
          candidates: ['Do', 'agree'],
          answer: 'Do you agree?'
        }
      )
    ).toBe(true);
  });

  it('maps grouped questions back to their shared page', () => {
    const document = {
      modules: [{ id: 'm1', tasks: [{ id: 't1', questions: [{ id: 'q1' }, { id: 'q2' }] }] }],
      pages: [{ id: 'complete-words', questionIds: ['q1', 'q2'] }]
    };
    expect(examQuestions(document).map(question => question.pageId)).toEqual([
      'complete-words',
      'complete-words'
    ]);
  });
});
