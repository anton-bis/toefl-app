import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
import WritingResults from '../../src/vue/exam/results/WritingResults.vue';
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
const trailingPromptQuestion = {
  id: 'writing-build-q-trailing',
  number: 2,
  type: 'build-sentence',
  speakerA: 'Tickets sold out quickly.',
  prompt: 'Unfortunately, ____ ____ ____ ____ ____ ____ ____.',
  candidates: ['the', 'tickets', 'were', 'no', 'longer', 'available', 'online'],
  answer: 'Unfortunately, the tickets were no longer available online.'
};
const correctSlots = [6, 0, 1, 3, 5, 4, 7];
const wrongSlots = [0, 1, 2, 3, 5, 4, 7];
const speakingDocument = {
  id: 'tpo-03-speaking',
  sourcePath: 'assets/questions/speaking/TPO-03/speaking-TPO-03.md',
  modules: [
    { tasks: [{ questions: Array.from({ length: 11 }, (_, index) => ({ id: `q${index}` })) }] }
  ]
};
const speakingTask = {
  type: 'listen-repeat',
  media: { file: 'speaking.mp3' },
  scenario: { title: 'Welcome visitors.', image: '0.png' }
};
const speakingQuestion = {
  id: 'q1',
  number: 1,
  type: 'listen-repeat',
  image: '1.png',
  responseTime: 8,
  media: { file: 'speaking.mp3', start: 10, end: 14 },
  transcript: 'Welcome.'
};
const speakingResultsDocument = {
  ...speakingDocument,
  section: 'speaking',
  modules: [
    {
      id: 'module-1',
      tasks: [
        {
          id: 'task-1',
          title: 'Take an Interview',
          questions: [
            {
              id: 'q1',
              number: 1,
              type: 'interview',
              transcript: 'Tell me about your hometown.',
              media: { file: 'speaking.mp3', start: 12, end: 18 }
            }
          ]
        }
      ]
    }
  ]
};
const speakingResultsSession = {
  answers: { q1: { recordingKey: 'tpo-03-speaking:q1' } },
  marks: {},
  updatedAt: 1
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
      props: { question: sentenceQuestion, answer: null }
    });
    const candidates = wrapper.findAll('.candidate-chip');
    await candidates[6].trigger('click');
    await candidates[0].trigger('click');
    expect(wrapper.emitted('answer').at(-1)[0].slots.slice(0, 2)).toEqual([6, 0]);
    await wrapper.findAll('.blank-slot')[1].trigger('click');
    expect(wrapper.emitted('answer').at(-1)[0].slots[1]).toBeNull();

    await wrapper.setProps({
      answer: { slots: [6, 0, 1, 3, 5, 4, 7] },
      locked: { [sentenceQuestion.id]: true }
    });
    expect(wrapper.findAll('.blank-slot').every(slot => slot.attributes('disabled') === '')).toBe(
      true
    );
  });

  it('renders Build a Sentence as a folded in-page answer review', () => {
    const answer = { slots: [6, 0, 1, 3, 5, 4, 7] };
    const wrapper = mount(WritingResults, {
      props: {
        tasks: [
          {
            id: 'build-sentence',
            title: 'Build a Sentence',
            type: 'build-sentence',
            questions: [sentenceQuestion]
          }
        ],
        answers: { [sentenceQuestion.id]: answer }
      }
    });
    expect(wrapper.find('.answer-review-card').attributes('open')).toBeUndefined();
    expect(wrapper.find('.answer-review-card__state').exists()).toBe(false);
    expect(wrapper.text().split(sentenceQuestion.speakerA)).toHaveLength(2);
    expect(wrapper.text().split(sentenceQuestion.prompt)).toHaveLength(2);
    expect(wrapper.text()).toContain('Your answer');
    expect(wrapper.text()).toContain('Correct answer');
    expect(wrapper.text()).toContain(sentenceQuestion.answer);
  });

  it('capitalizes the first word only when the sentence starts with a blank', () => {
    const leading = mount(BuildSentence, {
      props: { question: sentenceQuestion, answer: { slots: correctSlots } }
    });
    expect(leading.findAll('.blank-slot')[0].text()).toBe('Do');

    const trailing = mount(BuildSentence, {
      props: {
        question: trailingPromptQuestion,
        answer: { slots: [0, 1, 2, 3, 4, 5, 6] }
      }
    });
    expect(trailing.findAll('.blank-slot')[0].text()).toBe('the');
  });

  it('shows a build-sentence status grid with correct, incorrect and unanswered cells', async () => {
    const questions = [
      { ...sentenceQuestion, id: 'bs-correct', number: 1 },
      { ...sentenceQuestion, id: 'bs-wrong', number: 2 },
      { ...sentenceQuestion, id: 'bs-blank', number: 3 }
    ];
    const wrapper = mount(WritingResults, {
      props: {
        tasks: [{ id: 'build-sentence', title: 'Build a Sentence', type: 'build-sentence', questions }],
        answers: { 'bs-correct': correctSlots, 'bs-wrong': wrongSlots }
      }
    });
    const cells = wrapper.findAll('.results-question-grid__cell');
    expect(cells).toHaveLength(3);
    expect(cells[0].classes()).toContain('is-correct');
    expect(cells[1].classes()).toContain('is-incorrect');
    expect(cells[2].classes()).toContain('is-unanswered');

    await cells[2].trigger('click');
    const card = wrapper.find('#review-card-bs-blank');
    expect(card.attributes('open')).toBeDefined();
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
    expect(wrapper.find('.discussion-left').attributes()).toMatchObject({
      'aria-label': 'Writing prompt',
      role: 'region',
      tabindex: '0'
    });
    expect(wrapper.find('.discussion-left').classes()).toContain('exam-scroll-region');
    expect(wrapper.find('.discussion-context').attributes()).toMatchObject({
      'aria-label': 'Student responses',
      tabindex: '0'
    });
    expect(wrapper.find('.discussion-context').classes()).toContain('exam-scroll-region');
  });

  it('renders speaker avatars for build-sentence questions', async () => {
    const avatarQuestion = {
      ...sentenceQuestion,
      id: 'writing-build-q-avatar',
      speakerAImage: 'avatar-1.png',
      speakerBImage: 'avatar-2.png'
    };
    const wrapper = mount(BuildSentence, {
      props: {
        question: avatarQuestion,
        document: { sourcePath: 'assets/questions/writing/TPO-03/writing-TPO-03.md' },
        answer: null
      }
    });
    const avatars = wrapper.findAll('.avatar img');
    expect(avatars).toHaveLength(2);
    expect(avatars[0].attributes('src')).toContain('writing/TPO-03/avatar-1.png');
    expect(avatars[1].attributes('src')).toContain('writing/TPO-03/avatar-2.png');
  });

  it('renders professor and student avatars for academic discussions', async () => {
    const wrapper = mount(WritingPage, {
      props: {
        document: { sourcePath: 'assets/questions/writing/TPO-03/writing-TPO-03.md' },
        page: { id: 'discussion-q2', type: 'question' },
        task: { type: 'academic-discussion' },
        question: {
          id: 'discussion-q2',
          type: 'academic-discussion',
          subject: 'city planning',
          instructor: 'Dr. Smith',
          professor: 'Explain your position.',
          professorImage: 'professor.png',
          students: [
            { name: 'Kelly', text: 'Transit is good.', image: 'kelly.png' },
            { name: 'Andrew', text: 'Roads matter.', image: 'andrew.png' }
          ]
        },
        answers: {}
      }
    });
    const professor = wrapper.find('.discussion-professor img');
    expect(professor.exists()).toBe(true);
    expect(professor.attributes('src')).toContain('writing/TPO-03/professor.png');
    const studentImages = wrapper.findAll('.discussion-context .student img.mini-avatar');
    expect(studentImages).toHaveLength(2);
    expect(studentImages[0].attributes('src')).toContain('writing/TPO-03/kelly.png');
    expect(studentImages[1].attributes('src')).toContain('writing/TPO-03/andrew.png');
    expect(wrapper.find('.discussion-left').text()).toContain(
      'In your response, you should do the following:'
    );
    expect(wrapper.find('.discussion-left').text()).toContain('city planning');
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
    setActivePinia(createPinia());
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
  const mountSpeaking = (props = {}) =>
    mount(SpeakingPage, {
      props: {
        document: speakingDocument,
        page: { type: 'question' },
        task: speakingTask,
        question: speakingQuestion,
        answers: {},
        volume: 0.8,
        ...props
      }
    });

  it('renders scenario content without requesting microphone permission', () => {
    const wrapper = mountSpeaking({
      page: { type: 'scenario', scenario: speakingTask.scenario },
      question: null
    });
    expect(wrapper.text()).toContain('Welcome visitors.');
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
  });

  it('never exposes an infinite native prompt duration', async () => {
    const wrapper = mountSpeaking({
      question: { ...speakingQuestion, media: { file: 'speaking.mp3' } }
    });
    await flushPromises();
    const element = wrapper.find('audio').element;
    Object.defineProperty(element, 'duration', {
      configurable: true,
      value: Number.POSITIVE_INFINITY
    });
    await wrapper.find('audio').trigger('loadedmetadata');

    expect(wrapper.find('.audio-player > span').text()).toBe('00:00 / 00:00');
    expect(wrapper.text()).not.toContain('Infinity');
  });

  it('plays segments once, reuses one session stream, and releases it on unmount', async () => {
    const wrapper = mountSpeaking();
    await flushPromises();
    expect(wrapper.text()).toContain('00:00:08');
    const play = wrapper.find('[aria-label="Play question audio"]');
    await play.trigger('click');
    expect(play.attributes('disabled')).toBeDefined();
    await wrapper.find('audio').trigger('ended');
    await flushPromises();
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain('Recording...');

    const nextQuestion = { ...speakingQuestion, id: 'q2', number: 2 };
    await wrapper.setProps({ question: nextQuestion });
    await flushPromises();
    await wrapper.find('[aria-label="Play question audio"]').trigger('click');
    await wrapper.find('audio').trigger('ended');
    await flushPromises();
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
    wrapper.unmount();
    await flushPromises();
    expect(tracks[0].stop).toHaveBeenCalledTimes(1);
    expect(repository.save).toHaveBeenCalledWith(
      speakingDocument.id,
      speakingQuestion.id,
      expect.any(Blob)
    );
  });

  it('enforces the recording deadline while the page is hidden', async () => {
    vi.useFakeTimers();
    const wrapper = mountSpeaking();
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
  });

  it('shows a useful permission failure and does not enter recording state', async () => {
    const denied = Object.assign(new Error('denied'), { name: 'NotAllowedError' });
    navigator.mediaDevices.getUserMedia.mockRejectedValueOnce(denied);
    const wrapper = mountSpeaking();
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
    const wrapper = mountSpeaking();
    await flushPromises();
    await wrapper.find('[aria-label="Play question audio"]').trigger('click');
    await wrapper.find('audio').trigger('ended');
    await vi.advanceTimersByTimeAsync(8000);
    await flushPromises();

    expect(wrapper.text()).toContain('disk full');
    expect(wrapper.emitted('answer')).toBeUndefined();
    wrapper.unmount();
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
    const wrapper = mountSpeaking();
    await Promise.resolve();
    const nextQuestion = { ...speakingQuestion, id: 'q2', number: 2 };
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
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  });
  const mountResults = () =>
    mount(ResultsPage, {
      props: { document: speakingResultsDocument, session: speakingResultsSession }
    });

  it('loads a response only after the user asks to play it', async () => {
    repository.load.mockReset().mockResolvedValue(new Blob(['answer'], { type: 'audio/webm' }));
    const createObjectURL = vi.fn(() => 'blob:answer');
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL: vi.fn() });
    const wrapper = mountResults();

    expect(repository.load).not.toHaveBeenCalled();
    expect(wrapper.find('.answer-review-card').attributes('open')).toBeUndefined();
    expect(wrapper.text()).toContain('Tell me about your hometown.');
    expect(wrapper.text().split('Tell me about your hometown.')).toHaveLength(2);
    expect(wrapper.find('.audio-inline-player').exists()).toBe(true);
    await wrapper.get('.speaking-load-response').trigger('click');
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
    const wrapper = mountResults();
    await wrapper.get('.speaking-load-response').trigger('click');
    wrapper.unmount();
    resolveLoad(new Blob(['late'], { type: 'audio/webm' }));
    await flushPromises();
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it('resolves the recording attempt from the answer recording key, not the document id', async () => {
    repository.load.mockReset().mockResolvedValue(new Blob(['answer'], { type: 'audio/webm' }));
    const createObjectURL = vi.fn(() => 'blob:answer');
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL: vi.fn() });
    const wrapper = mount(ResultsPage, {
      props: {
        document: speakingResultsDocument,
        session: {
          ...speakingResultsSession,
          answers: { q1: { recordingKey: 'attempt-9xz7:q1' } }
        }
      }
    });
    await wrapper.get('.speaking-load-response').trigger('click');
    await flushPromises();
    expect(repository.load).toHaveBeenCalledWith('attempt-9xz7', 'q1');
    wrapper.unmount();
  });
});
