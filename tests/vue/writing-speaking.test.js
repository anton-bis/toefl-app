import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const repository = vi.hoisted(() => ({
  playbackUrl: vi.fn(() => null),
  load: vi.fn().mockResolvedValue(null),
  save: vi.fn().mockResolvedValue(undefined),
  remove: vi.fn().mockResolvedValue(undefined)
}));
vi.mock('../../src/vue/platform/dataRepository.js', () => ({
  recordingRepository: repository
}));

import BuildSentence from '../../src/vue/exam/sections/writing/BuildSentence.vue';
import ResponseEditor from '../../src/vue/exam/sections/writing/ResponseEditor.vue';
import WritingPage from '../../src/vue/exam/sections/writing/WritingPage.vue';
import SpeakingPage from '../../src/vue/exam/sections/speaking/SpeakingPage.vue';
import ResultsPage from '../../src/vue/exam/shared/ResultsPage.vue';
import {
  countWords,
  renderSentence,
  sentenceParts,
  solveAnswerOrder,
  stripCjk
} from '../../src/vue/exam/sections/writing/writingLogic.js';
import {
  selectRecordingMimeType,
  useRecorder
} from '../../src/vue/exam/composables/useRecorder.js';

const sentenceQuestion = {
  id: 'writing-build-q1',
  number: 1,
  type: 'build-sentence',
  speakerA: 'Your presentation was impressive.',
  prompt: '____ ____ ____ ____ ____ ____ ____ ?',
  candidates: ['you', 'want', 'of it', 'me', 'you', 'to send', 'do', 'a copy'],
  answer: 'Do you want me to send you a copy?'
};

describe('writing logic', () => {
  it('preserves fixed text and solves blank order even with duplicate candidates', () => {
    expect(sentenceParts('____ you ____?').map(part => part.type)).toEqual([
      'blank',
      'text',
      'blank',
      'text'
    ]);
    const order = solveAnswerOrder(sentenceQuestion);
    expect(
      renderSentence(sentenceQuestion.prompt, order).replace(/\s+\?/g, '?').toLowerCase()
    ).toBe(sentenceQuestion.answer.toLowerCase());
    expect(order.filter(word => word === 'you')).toHaveLength(2);
  });

  it('counts English words and strips CJK input', () => {
    expect(stripCjk('Hello，世界 test')).toBe('Hello test');
    expect(countWords('  A complete English sentence.  ')).toBe(4);
    expect(countWords('中文 only English')).toBe(2);
  });

  it('chooses a supported MediaRecorder type without assuming opus support', () => {
    const Recorder = { isTypeSupported: vi.fn(type => type === 'audio/webm') };
    expect(selectRecordingMimeType(Recorder)).toBe('audio/webm');
  });
});

describe('writing components', () => {
  it('places, removes, restores and locks Build a Sentence answers', async () => {
    const wrapper = mount(BuildSentence, {
      props: { question: sentenceQuestion, answer: null, checked: false }
    });
    const candidates = wrapper.findAll('.candidate-chip');
    await candidates[6].trigger('click');
    await candidates[0].trigger('click');
    expect(wrapper.emitted('answer').at(-1)[0].slots.slice(0, 2)).toEqual([6, 0]);
    await wrapper.findAll('.blank-slot')[1].trigger('click');
    expect(wrapper.emitted('answer').at(-1)[0].slots[1]).toBeNull();

    await wrapper.setProps({ answer: { slots: [6, 0, 1, 3, 5, 4, 7] }, checked: true });
    expect(wrapper.findAll('.blank-slot.correct')).toHaveLength(7);
  });

  it('filters CJK, reports words and supports toolbar undo/redo', async () => {
    const wrapper = mount(ResponseEditor, { props: { modelValue: '' } });
    const textarea = wrapper.find('textarea');
    await textarea.setValue('Hello 世界 test');
    expect(wrapper.emitted('update:modelValue').at(-1)).toEqual(['Hello  test']);
    expect(wrapper.text()).toContain('Words: 2');
    expect(wrapper.text()).toContain('Chinese characters');
    await wrapper.findAll('.toolbar button')[2].trigger('click');
    expect(wrapper.emitted('update:modelValue').at(-1)).toEqual(['']);
    await wrapper.findAll('.toolbar button')[3].trigger('click');
    expect(wrapper.emitted('update:modelValue').at(-1)).toEqual(['Hello  test']);
  });

  it('exposes independently scrollable writing prompt and discussion context regions', () => {
    const wrapper = mount(WritingPage, {
      props: {
        document: { section: 'writing' },
        page: { id: 'discussion-q1', type: 'question' },
        task: { type: 'academic-discussion' },
        question: {
          id: 'discussion-q1',
          type: 'academic-discussion',
          subject: 'city planning',
          instructor: 'Which approach is better?',
          professor: 'Explain your position.',
          students: [{ name: 'Alex', text: 'Public transit should be improved.' }]
        },
        answers: {}
      }
    });
    expect(wrapper.find('.prompt-card').attributes()).toMatchObject({
      'aria-label': 'Writing prompt',
      role: 'region',
      tabindex: '0'
    });
    expect(wrapper.find('.prompt-card').classes()).toContain('exam-scroll-region');
    expect(wrapper.find('.discussion-context').attributes()).toMatchObject({
      'aria-label': 'Student responses',
      tabindex: '0'
    });
    expect(wrapper.find('.discussion-context').classes()).toContain('exam-scroll-region');
  });
});

describe('SpeakingPage', () => {
  let tracks;
  class MockMediaRecorder {
    static isTypeSupported(type) {
      return type === 'audio/webm';
    }
    constructor() {
      this.state = 'inactive';
      this.mimeType = 'audio/webm';
    }
    start() {
      this.state = 'recording';
    }
    stop() {
      this.state = 'inactive';
      this.ondataavailable?.({ data: new Blob(['voice'], { type: this.mimeType }) });
      this.onstop?.();
    }
  }

  beforeEach(() => {
    repository.load.mockReset().mockResolvedValue(null);
    repository.save.mockReset().mockResolvedValue(undefined);
    repository.remove.mockReset().mockResolvedValue(undefined);
    tracks = [{ readyState: 'live', stop: vi.fn() }];
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getAudioTracks: () => tracks,
          getTracks: () => tracks
        })
      }
    });
    vi.stubGlobal('MediaRecorder', MockMediaRecorder);
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const document = {
    id: 'tpo-03-speaking',
    sourcePath: 'assets/questions/speaking/TPO-03/speaking-TPO-03.md',
    modules: [
      { tasks: [{ questions: Array.from({ length: 11 }, (_, index) => ({ id: `q${index}` })) }] }
    ]
  };
  const task = {
    type: 'listen-repeat',
    media: { file: 'speaking.mp3' },
    scenario: { title: 'Welcome visitors.', image: '0.png' }
  };
  const question = {
    id: 'q1',
    number: 1,
    type: 'listen-repeat',
    image: '1.png',
    responseTime: 8,
    media: { file: 'speaking.mp3', start: 10, end: 14 },
    transcript: 'Welcome.'
  };

  it('renders scenario content without requesting microphone permission', () => {
    const wrapper = mount(SpeakingPage, {
      props: {
        document,
        page: { type: 'scenario', scenario: task.scenario },
        task,
        question: null,
        answers: {},
        checked: false,
        volume: 0.8
      }
    });
    expect(wrapper.text()).toContain('Welcome visitors.');
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
  });

  it('plays segments once, reuses one session stream, and releases it on unmount', async () => {
    const wrapper = mount(SpeakingPage, {
      props: {
        document,
        page: { type: 'question' },
        task,
        question,
        answers: {},
        checked: false,
        volume: 0.8
      }
    });
    await flushPromises();
    expect(wrapper.text()).toContain('00:00:08');
    const play = wrapper.find('[aria-label="Play question audio"]');
    await play.trigger('click');
    expect(play.attributes('disabled')).toBeDefined();
    await wrapper.find('audio').trigger('ended');
    await flushPromises();
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain('Recording...');

    const nextQuestion = { ...question, id: 'q2', number: 2 };
    await wrapper.setProps({ question: nextQuestion });
    await flushPromises();
    await wrapper.find('[aria-label="Play question audio"]').trigger('click');
    await wrapper.find('audio').trigger('ended');
    await flushPromises();
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
    wrapper.unmount();
    await flushPromises();
    expect(tracks[0].stop).toHaveBeenCalledTimes(1);
    expect(repository.save).toHaveBeenCalledWith(document.id, question.id, expect.any(Blob));
  });

  it('enforces the recording deadline while the page is hidden', async () => {
    vi.useFakeTimers();
    const wrapper = mount(SpeakingPage, {
      props: {
        document,
        page: { type: 'question' },
        task,
        question,
        answers: {},
        checked: false,
        volume: 0.8
      }
    });
    await flushPromises();
    await wrapper.find('[aria-label="Play question audio"]').trigger('click');
    await wrapper.find('audio').trigger('ended');
    await flushPromises();
    Object.defineProperty(globalThis.document, 'hidden', { configurable: true, value: true });
    globalThis.document.dispatchEvent(new Event('visibilitychange'));

    await vi.advanceTimersByTimeAsync(8000);
    await flushPromises();

    expect(repository.save).toHaveBeenCalledOnce();
    expect(wrapper.text()).toContain('Response recorded');
    wrapper.unmount();
    Object.defineProperty(globalThis.document, 'hidden', { configurable: true, value: false });
    vi.useRealTimers();
  });

  it('shows a useful permission failure and does not enter recording state', async () => {
    const denied = Object.assign(new Error('denied'), { name: 'NotAllowedError' });
    navigator.mediaDevices.getUserMedia.mockRejectedValueOnce(denied);
    const wrapper = mount(SpeakingPage, {
      props: {
        document,
        page: { type: 'question' },
        task,
        question,
        answers: {},
        checked: false,
        volume: 0.8
      }
    });
    await flushPromises();
    await wrapper.find('[aria-label="Play question audio"]').trigger('click');
    await wrapper.find('audio').trigger('ended');
    await flushPromises();
    expect(wrapper.text()).toContain('Microphone permission was denied');
    expect(wrapper.text()).not.toContain('Recording...');
  });

  it('does not report a recorded answer when saving the audio fails', async () => {
    vi.useFakeTimers();
    repository.save.mockRejectedValueOnce(new Error('disk full'));
    const wrapper = mount(SpeakingPage, {
      props: {
        document,
        page: { type: 'question' },
        task,
        question,
        answers: {},
        checked: false,
        volume: 0.8
      }
    });
    await flushPromises();
    await wrapper.find('[aria-label="Play question audio"]').trigger('click');
    await wrapper.find('audio').trigger('ended');
    await vi.advanceTimersByTimeAsync(8000);
    await flushPromises();

    expect(wrapper.text()).toContain('disk full');
    expect(wrapper.emitted('answer')).toBeUndefined();
    wrapper.unmount();
    vi.useRealTimers();
  });

  it('stops a late microphone stream instead of recording after unmount', async () => {
    let resolveStream;
    let constructed = 0;
    navigator.mediaDevices.getUserMedia.mockReturnValueOnce(
      new Promise(resolve => {
        resolveStream = resolve;
      })
    );
    class DeferredRecorder extends MockMediaRecorder {
      constructor(...args) {
        super(...args);
        constructed += 1;
      }
    }
    vi.stubGlobal('MediaRecorder', DeferredRecorder);
    const Harness = defineComponent({
      setup() {
        return useRecorder({ sessionId: 'late-session', repository });
      },
      template: '<div />'
    });
    const wrapper = mount(Harness);
    const started = wrapper.vm.start('q1');
    wrapper.unmount();
    resolveStream({ getAudioTracks: () => tracks, getTracks: () => tracks });
    await expect(started).resolves.toBe(false);
    expect(constructed).toBe(0);
    expect(tracks[0].stop).toHaveBeenCalledTimes(1);
  });

  it('ignores a recording load that resolves after switching questions', async () => {
    const resolvers = new Map();
    repository.load.mockImplementation(
      (_sessionId, questionId) =>
        new Promise(resolve => {
          resolvers.set(questionId, resolve);
        })
    );
    const wrapper = mount(SpeakingPage, {
      props: {
        document,
        page: { type: 'question' },
        task,
        question,
        answers: {},
        checked: false,
        volume: 0.8
      }
    });
    await Promise.resolve();
    const nextQuestion = { ...question, id: 'q2', number: 2 };
    await wrapper.setProps({ question: nextQuestion });
    await Promise.resolve();
    resolvers.get('q2')(new Blob(['second'], { type: 'audio/webm' }));
    await flushPromises();
    resolvers.get('q1')(new Blob(['first'], { type: 'audio/webm' }));
    await flushPromises();
    expect(wrapper.emitted('answer').at(-1)[0]).toBe('q2');
    expect(wrapper.emitted('answer').at(-1)[1].size).toBe(6);
  });
});

describe('speaking results recordings', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads a response only after the user asks to play it', async () => {
    repository.load.mockReset().mockResolvedValue(new Blob(['answer'], { type: 'audio/webm' }));
    const createObjectURL = vi.fn(() => 'blob:answer');
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL: vi.fn() });
    const wrapper = mount(ResultsPage, {
      props: {
        document: {
          id: 'tpo-03-speaking',
          section: 'speaking',
          modules: [
            {
              id: 'module-1',
              tasks: [{ id: 'task-1', questions: [{ id: 'q1', number: 1, type: 'interview' }] }]
            }
          ]
        },
        session: {
          answers: { q1: { recordingKey: 'tpo-03-speaking:q1' } },
          marks: {},
          updatedAt: 1
        }
      }
    });

    expect(repository.load).not.toHaveBeenCalled();
    await wrapper.get('.speaking-results-list article > button:last-child').trigger('click');
    await flushPromises();

    expect(repository.load).toHaveBeenCalledWith('tpo-03-speaking', 'q1');
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(wrapper.get('audio[src="blob:answer"]').attributes('preload')).toBe('none');
    wrapper.unmount();
  });

  it('does not create a blob URL when a recording load finishes after unmount', async () => {
    let resolveLoad;
    repository.load.mockReset().mockReturnValue(
      new Promise(resolve => {
        resolveLoad = resolve;
      })
    );
    const createObjectURL = vi.fn(() => 'blob:late');
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL: vi.fn() });
    const wrapper = mount(ResultsPage, {
      props: {
        document: {
          id: 'tpo-03-speaking',
          section: 'speaking',
          sourcePath: 'assets/questions/speaking/TPO-03/speaking-TPO-03.md',
          modules: [
            {
              id: 'module-1',
              tasks: [{ id: 'task-1', questions: [{ id: 'q1', number: 1, type: 'interview' }] }]
            }
          ]
        },
        page: { type: 'results', title: 'Speaking Section Completed' },
        session: {
          answers: { q1: { recordingKey: 'tpo-03-speaking:q1' } },
          marks: {},
          updatedAt: 1
        }
      }
    });
    await wrapper.get('.speaking-results-list article > button:last-child').trigger('click');
    wrapper.unmount();
    resolveLoad(new Blob(['late'], { type: 'audio/webm' }));
    await flushPromises();
    expect(createObjectURL).not.toHaveBeenCalled();
  });
});
