import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ReadingPage from '../../src/vue/exam/sections/reading/ReadingPage.vue';
import ListeningPage from '../../src/vue/exam/sections/listening/ListeningPage.vue';
import AudioSegment from '../../src/vue/exam/sections/listening/AudioSegment.vue';
import QuestionNavigator from '../../src/vue/exam/shared/QuestionNavigator.vue';
import {
  academicMode,
  fillTokens,
  insertionSentence,
  parseDailyPassage,
  parseTextChain
} from '../../src/vue/exam/sections/reading/helpers.js';
import AcademicPassage from '../../src/vue/exam/sections/reading/AcademicPassage.vue';
import {
  listeningResponseSeconds,
  segmentDuration
} from '../../src/vue/exam/sections/listening/helpers.js';

const document = {
  id: 'tpo-03-reading',
  sourcePath: 'assets/questions/reading/TPO-03/reading-TPO-03.md'
};
const question = {
  id: 'q11',
  number: 11,
  type: 'notice',
  prompt: 'What is this?',
  options: [
    { id: 'A', label: 'A', text: 'A notice' },
    { id: 'B', label: 'B', text: 'An email' }
  ],
  answer: 'A'
};

describe('reading section helpers', () => {
  it('turns escaped underscores into ordered complete-word groups', () => {
    const questions = [
      { id: 'q1', answer: 'might' },
      { id: 'q2', answer: 'that' }
    ];
    const blanks = fillTokens('We mi\\_\\_\\_ think th\\_\\_ is true.', questions).filter(
      token => token.type === 'blank'
    );
    expect(blanks.map(({ prefix, length, question: item }) => [prefix, length, item.id])).toEqual([
      ['mi', 3, 'q1'],
      ['th', 2, 'q2']
    ]);
  });

  it('extracts daily-life metadata and text-chain messages without HTML', () => {
    expect(
      parseDailyPassage('Date: May 1\nSubject: Visit\nDear Pat,\nSee you.\nRegards,\nSam', 'email')
    ).toMatchObject({
      date: 'May 1',
      subject: 'Visit',
      body: 'Dear Pat,\n\nSee you.',
      signature: 'Regards,\nSam'
    });
    expect(parseTextChain('Alex (9:00 A.M.) Hello\nBea(9:01 A.M.) Hi')).toEqual([
      { sender: 'Alex', time: '9:00 A.M.', text: 'Hello' },
      { sender: 'Bea', time: '9:01 A.M.', text: 'Hi' }
    ]);
  });

  it('detects academic point-sentence and insertion interactions', () => {
    expect(academicMode({ prompt: 'Click on the sentence in paragraph 3 that explains it.' })).toBe(
      'point-sentence'
    );
    expect(academicMode({ prompt: 'Insert the sentence into the passage.' })).toBe(
      'insert-sentence'
    );
    expect(
      insertionSentence(
        'There are four locations where the following sentence could be added: Few performances occurred around this time.\nWhere would the sentence best fit?'
      )
    ).toBe('Few performances occurred around this time.');
  });
});

describe('QuestionNavigator', () => {
  it('shows compact question tiles and only one current item for a grouped page', () => {
    const groupedQuestions = ['q1', 'q2', 'q3'].map((id, index) => ({
      id,
      prompt: `A long repeated complete-words prompt ${index + 1}`,
      options: []
    }));
    mount(QuestionNavigator, {
      props: {
        open: true,
        document: {
          pages: [{ id: 'complete-words', questionIds: groupedQuestions.map(item => item.id) }],
          modules: [{ id: 'module-1', tasks: [{ id: 'task-1', questions: groupedQuestions }] }]
        },
        pageId: 'complete-words',
        answers: {},
        marks: {}
      }
    });
    const navigator = globalThis.document.querySelector('.question-navigator');
    expect(navigator.querySelectorAll('.question-navigator__item')).toHaveLength(3);
    expect(navigator.querySelectorAll('.question-navigator__item.current')).toHaveLength(1);
    expect(navigator.textContent).not.toContain('A long repeated complete-words prompt');
    expect(navigator.querySelector('.question-navigator__question').title).toContain(
      'complete-words prompt'
    );
  });
});

describe('ReadingPage', () => {
  it('renders daily-life layout and emits an answer', async () => {
    const wrapper = mount(ReadingPage, {
      props: {
        document,
        page: { id: 'q11' },
        task: { type: 'notice', title: 'Notice', passage: 'Title: Campus News\nClosed today.' },
        question,
        answers: {},
        checked: false,
        volume: 0.8
      }
    });
    expect(wrapper.classes()).toContain('exam-content-pane');
    expect(wrapper.find('.left-column').classes()).toContain('exam-scroll-region');
    expect(wrapper.find('.left-column').attributes()).toMatchObject({
      'aria-label': 'Reading passage',
      role: 'region',
      tabindex: '0'
    });
    expect(wrapper.find('.apple-noticeboard-container').text()).toContain('Campus News');
    expect(wrapper.find('.apple-noticeboard-container').classes()).toContain('daily-passage-card');
    await wrapper.find('[data-option="A"]').trigger('click');
    expect(wrapper.emitted('answer')).toEqual([['q11', 'A']]);
  });

  it('renders all complete-word inputs together and emits reconstructed words', async () => {
    const fillQuestion = {
      id: 'q1',
      number: 1,
      type: 'complete-words',
      prompt: 'We mi\\_\\_\\_ know.',
      answer: 'might'
    };
    const wrapper = mount(ReadingPage, {
      props: {
        document,
        page: { id: 'q1' },
        task: { type: 'complete-words', passage: fillQuestion.prompt, questions: [fillQuestion] },
        question: fillQuestion,
        answers: {},
        checked: false,
        volume: 0.8
      }
    });
    expect(wrapper.find('.question-instruction').text()).toBe('Fill in the missing letters');
    expect(wrapper.find('.question-paragraph').attributes()).toMatchObject({
      'aria-label': 'Fill in the missing letters passage',
      tabindex: '0'
    });
    expect(wrapper.findAll('.letter-box')).toHaveLength(3);
    await wrapper.findAll('.letter-box')[0].setValue('g');
    expect(wrapper.emitted('answer').at(-1)).toEqual(['q1', 'mig']);
  });

  it('supports academic point-sentence and insertion-marker answers', async () => {
    const pointQuestion = {
      id: 'academic-point',
      prompt: 'Click on the sentence in paragraph 2 that gives the example.',
      options: [],
      answer: 'The second example is here.'
    };
    const task = {
      type: 'academic-passage',
      title: 'Read an Academic Passage – Examples',
      passage: 'The introduction is here.\n\nThe first idea is here. The second example is here.',
      questions: [pointQuestion]
    };
    const point = mount(ReadingPage, {
      props: {
        document,
        page: { id: pointQuestion.id },
        task,
        question: pointQuestion,
        answers: {},
        checked: false
      }
    });
    expect(point.classes()).toContain('exam-content-pane');
    expect(point.find('.academic-passage-container').classes()).toContain('exam-scroll-region');
    expect(point.find('.academic-passage-container').attributes()).toMatchObject({
      'aria-label': 'Academic passage',
      tabindex: '0'
    });
    expect(point.find('.right-column').attributes()).toMatchObject({
      'aria-label': 'Question and answer choices',
      role: 'region',
      tabindex: '0'
    });
    expect(point.findAll('.sentence-option-row')).toHaveLength(2);
    await point.findAll('.sentence-option-row')[1].trigger('click');
    expect(point.emitted('answer').at(-1)).toEqual([
      pointQuestion.id,
      'The second example is here.'
    ]);

    const insertQuestion = {
      id: 'academic-insert',
      prompt: 'Insert the sentence into the passage. Insert this sentence: "A bridge sentence."',
      options: ['A', 'B', 'C', 'D'].map(id => ({ id, label: id, text: `Option ${id}` })),
      answer: 'B'
    };
    await point.setProps({
      page: { id: insertQuestion.id },
      task: {
        ...task,
        passage: '[A] First. [B] Second. [C] Third. [D]',
        questions: [insertQuestion]
      },
      question: insertQuestion
    });
    await point.findAll('.insertion-marker')[1].trigger('click');
    expect(point.emitted('answer').at(-1)).toEqual([insertQuestion.id, 'B']);
  });

  it('highlights any quoted phrase as the marked vocabulary', async () => {
    const passage = 'Music shapes emotions. The mechanism behind it is quantum mechanics for now.';
    const wrapper = mount(AcademicPassage, {
      props: {
        document,
        page: { id: 'q34' },
        task: {
          type: 'academic-passage',
          title: 'Read an Academic Passage – Music',
          passage,
          questions: [{ id: 'q34', prompt: 'Why does the author discuss "quantum mechanics"?' }]
        },
        question: {
          id: 'q34',
          prompt: 'Why does the author discuss "quantum mechanics"?',
          options: [{ id: 'A', label: 'A', text: 'Option A' }]
        },
        answers: {},
        checked: false,
        locked: false
      }
    });
    expect(wrapper.find('mark').text()).toBe('quantum mechanics');
  });
});

describe('listening section', () => {
  beforeEach(() => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  });
  it('calculates segment and response duration', () => {
    expect(segmentDuration({ start: 6, end: 12 }, 99)).toBe(6);
    expect(segmentDuration({ start: 6 }, Number.POSITIVE_INFINITY)).toBe(0);
    expect(listeningResponseSeconds({ type: 'listen-response' })).toBe(20);
    expect(listeningResponseSeconds({ type: 'academic-talk' })).toBe(30);
  });

  it('renders LCAR audio/options and emits answer and media state', async () => {
    const listenQuestion = {
      ...question,
      id: 'lq1',
      type: 'listen-response',
      prompt: '',
      transcript: 'Where is it?',
      media: { file: 'audio.mp3', start: 2, end: 8 }
    };
    const task = {
      type: 'listen-response',
      title: 'Listen and Choose a Response',
      media: listenQuestion.media,
      questions: [listenQuestion]
    };
    const wrapper = mount(ListeningPage, {
      props: {
        document: { sourcePath: 'assets/questions/listening/TPO-03/listening-TPO-03.md' },
        page: { id: 'lq1', type: 'question' },
        task,
        question: listenQuestion,
        answers: {},
        checked: false,
        volume: 0.5
      }
    });
    await wrapper.find('.audio-play-btn').trigger('click');
    await wrapper.find('[data-option="A"]').trigger('click');
    expect(wrapper.emitted('answer')).toEqual([['lq1', 'A']]);
    expect(wrapper.emitted('media-state').some(([state]) => state.state === 'playing')).toBe(true);

    await wrapper.setProps({ checked: {}, locked: { lq1: true } });
    expect(
      wrapper.findAll('.option-item-apple').every(option => option.attributes('disabled') === '')
    ).toBe(true);
    expect(wrapper.find('.option-item-apple.correct').exists()).toBe(false);
    expect(wrapper.find('.option-item-apple.incorrect').exists()).toBe(false);
  });

  it('renders a question-level image for listen-response questions', async () => {
    const imageQuestion = {
      ...question,
      id: 'lq-img',
      type: 'listen-response',
      prompt: '',
      transcript: 'How are you?',
      image: 'q1.png',
      media: { file: 'audio.mp3', start: 0, end: 4 }
    };
    const wrapper = mount(ListeningPage, {
      props: {
        document: { sourcePath: 'assets/questions/listening/TPO-03/listening-TPO-03.md' },
        page: { id: 'lq-img', type: 'question' },
        task: { type: 'listen-response', title: 'Listen and Choose a Response', questions: [imageQuestion] },
        question: imageQuestion,
        answers: {},
        checked: false,
        volume: 0.5
      }
    });
    const image = wrapper.find('.listening-visual-image');
    expect(image.exists()).toBe(true);
    expect(image.attributes('src')).toContain('listening/TPO-03/q1.png');
  });

  it('renders a task-level image for conversation stimulus pages', async () => {
    const wrapper = mount(ListeningPage, {
      props: {
        document: { sourcePath: 'assets/questions/listening/TPO-03/listening-TPO-03.md' },
        page: { id: 'conv-stimulus', type: 'stimulus' },
        task: {
          type: 'conversation',
          title: 'Listen to a Conversation',
          image: 'scene.png',
          media: { file: 'a.mp3', start: 0, end: 10 },
          questions: []
        },
        question: null,
        answers: {},
        checked: false,
        volume: 0.5
      }
    });
    expect(wrapper.find('.listening-visual-image').attributes('src')).toContain(
      'listening/TPO-03/scene.png'
    );
  });

  it('renders a separate stimulus and gives academic questions 30 seconds', async () => {
    const media = { file: 'talk.ogg', start: 0, end: 30 };
    const talkQuestion = { ...question, id: 'talk-q1', prompt: 'What is the main idea?', media };
    const task = {
      type: 'academic-talk',
      title: 'Listen to an Academic Talk – Questions 15-18',
      media,
      transcript: 'A lecture transcript.',
      questions: [talkQuestion]
    };
    const wrapper = mount(ListeningPage, {
      props: {
        document: { sourcePath: '/assets/questions/listening/TPO-03/listening-TPO-03.md' },
        page: { id: 'talk-stimulus', type: 'stimulus' },
        task,
        question: null,
        answers: {},
        checked: false
      }
    });
    expect(wrapper.find('.listening-stimulus').exists()).toBe(true);
    expect(wrapper.find('.listening-stimulus-card').classes()).toContain('listening-surface');
    expect(wrapper.find('audio').attributes('src')).toContain('talk.ogg');
    await wrapper.setProps({
      page: { id: talkQuestion.id, type: 'question' },
      question: talkQuestion
    });
    expect(wrapper.find('.question-text-apple').text()).toBe('What is the main idea?');
    expect(wrapper.find('.right-column').attributes()).toMatchObject({
      'aria-label': 'Question and answer choices',
      role: 'region',
      tabindex: '0'
    });
    expect(wrapper.find('.audio-inline-player').exists()).toBe(false);
  });

  it('stops and detaches segment media when unmounted', () => {
    const wrapper = mount(AudioSegment, {
      props: {
        document: { assetBase: '/content' },
        media: { file: 'talk.ogg', start: 0, end: 10 },
        volume: 0.8
      }
    });
    const element = wrapper.find('audio').element;
    const removeAttribute = vi.spyOn(element, 'removeAttribute');
    wrapper.unmount();
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
    expect(removeAttribute).toHaveBeenCalledWith('src');
    expect(wrapper.emitted('media-state').at(-1)[0].state).toBe('stopped');
  });

  it('shows finite native audio duration and rejects streaming infinity', async () => {
    const wrapper = mount(AudioSegment, {
      props: {
        document: { sourcePath: 'assets/questions/listening/TPO-03/listening-TPO-03.md' },
        media: { file: 'talk.mp3' }
      }
    });
    const element = wrapper.find('audio').element;
    Object.defineProperty(element, 'duration', { configurable: true, value: 83.9 });
    await wrapper.find('audio').trigger('loadedmetadata');
    expect(wrapper.find('.audio-time').text()).toBe('00:00 / 01:23');

    Object.defineProperty(element, 'duration', {
      configurable: true,
      value: Number.POSITIVE_INFINITY
    });
    await wrapper.find('audio').trigger('loadedmetadata');
    expect(wrapper.find('.audio-time').text()).toBe('00:00 / 00:00');
  });
});
