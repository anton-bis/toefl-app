import { createPinia, setActivePinia } from 'pinia';
import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import SkillPageHeader from '../../src/vue/components/SkillPageHeader.vue';
import TypingView from '../../src/vue/views/TypingView.vue';
import VocabularyView from '../../src/vue/views/VocabularyView.vue';
import ArticleList from '../../src/vue/skills/typing/ArticleList.vue';
import TypingPractice from '../../src/vue/skills/typing/TypingPractice.vue';
import WordDetail from '../../src/vue/skills/vocabulary/WordDetail.vue';
import { classifyError, computeMetrics } from '../../src/vue/skills/typing/logic.js';
import { TYPING_SESSION_KEY, useTypingStore } from '../../src/vue/skills/typing/store.js';
import {
  loadTypingHistory,
  loadVocabularyProgress,
  openDataDatabase,
  replaceTypingHistory
} from '../../src/vue/platform/dataRepository.js';
import {
  buildRootCategories,
  dueWordIds,
  makeOptions,
  scheduleReview,
  dateKey,
  wordMeaning
} from '../../src/vue/skills/vocabulary/logic.js';
import { VOCAB_SESSION_KEY } from '../../src/vue/skills/vocabulary/storage.js';
import { useVocabularyStore } from '../../src/vue/skills/vocabulary/store.js';
import { installMemoryStorage } from './helpers/storage.js';

const article = {
  id: 'typing-b-1',
  title: 'Test',
  difficulty: 'beginner',
  wordCount: 1,
  content: 'Ab '
};

async function clearSkillData() {
  await replaceTypingHistory([]);
  const database = await openDataDatabase();
  await new Promise((resolve, reject) => {
    const transaction = database.transaction(['vocabularyProgress', 'recordings'], 'readwrite');
    transaction.objectStore('vocabularyProgress').clear();
    transaction.objectStore('recordings').clear();
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
}

describe('Shared skill workspace', () => {
  it('renders its action slot and emits a single back action', async () => {
    const wrapper = mount(SkillPageHeader, {
      props: { title: 'Focused Practice', backLabel: 'Back to Home' },
      slots: { actions: '<button class="test-action">History</button>' }
    });

    expect(wrapper.get('.skill-page-header__title').text()).toBe('Focused Practice');
    expect(wrapper.get('.test-action').text()).toBe('History');
    await wrapper.get('.skill-back-button').trigger('click');
    expect(wrapper.emitted('back')).toHaveLength(1);
  });

  it.each([
    ['/skills/typing', TypingView],
    ['/skills/vocabulary', VocabularyView]
  ])('returns %s to the named home route', async (path, component) => {
    installMemoryStorage();
    await clearSkillData();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async url => ({
      ok: true,
      json: async () => (String(url).includes('corpus.json') ? [] : {})
    }));
    const pinia = createPinia();
    setActivePinia(pinia);
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', name: 'home', component: { template: '<div>Home</div>' } },
        { path, component }
      ]
    });
    await router.push(path);
    await router.isReady();
    const wrapper = mount(component, { global: { plugins: [pinia, router] } });

    await wrapper.get('.skill-back-button').trigger('click');
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('home'));
  });
});

describe('Vue typing skill', () => {
  beforeEach(async () => {
    installMemoryStorage();
    await clearSkillData();
    setActivePinia(createPinia());
  });

  it('classifies errors and computes typing metrics', () => {
    expect(classifyError('a', 'A')).toBe('capitalization');
    expect(classifyError('x', '.')).toBe('punctuation');
    expect(classifyError(' ', 'x')).toBe('spacing');
    const metrics = computeMetrics({
      chars: [
        { expected: 'A', input: 'A', status: 'correct' },
        { expected: 'b', input: 'x', status: 'incorrect' }
      ],
      timeSpent: 6000
    });
    expect(metrics).toMatchObject({ rawWpm: 4, netWpm: 2, accuracy: 50, incorrectCount: 1 });
  });

  it('serializes a paused character-level session', () => {
    const store = useTypingStore();
    store.startArticle(article);
    store.processKey('A', 1000);
    store.pause(2500);
    expect(JSON.parse(localStorage.getItem(TYPING_SESSION_KEY))).toEqual({
      articleId: article.id,
      input: 'A',
      elapsedMs: 1500
    });
  });

  it('debounces rapid typing session writes and stores compact characters', () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    const setItem = vi.spyOn(localStorage, 'setItem');
    const store = useTypingStore();
    store.startArticle(article);
    setItem.mockClear();
    store.processKey('A', 1000);
    store.processKey('b', 1100);
    expect(setItem).not.toHaveBeenCalled();
    vi.advanceTimersByTime(500);
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(JSON.parse(localStorage.getItem(TYPING_SESSION_KEY)).input).toBe('Ab');
  });

  it('keeps a long partial typing snapshot below 2 KB', () => {
    vi.useFakeTimers();
    const store = useTypingStore();
    store.startArticle({ ...article, content: 'a'.repeat(784) });
    for (let index = 0; index < 700; index += 1) store.processKey('a', 1000 + index);
    vi.advanceTimersByTime(500);
    expect(localStorage.getItem(TYPING_SESSION_KEY).length).toBeLessThan(2_000);
  });

  it('records completion in IndexedDB and derives best values', async () => {
    const store = useTypingStore();
    store.startArticle({ ...article, content: 'A' });
    store.processKey('A', 1000);
    store.complete(61_000);
    expect(store.page).toBe('result');
    await vi.waitFor(async () => expect(await loadTypingHistory()).toHaveLength(1));
    expect(store.best.beginner).toMatchObject({ historyCount: 1, bestAccuracy: 100 });
    expect(localStorage.getItem(TYPING_SESSION_KEY)).toBeNull();
  });

  it('releases the typing corpus and working session outside the route', () => {
    const store = useTypingStore();
    store.articles = [article];
    store.startArticle(article);

    store.releaseWorkset();

    expect(store.initialized).toBe(false);
    expect(store.articles).toEqual([]);
    expect(store.session).toBeNull();
  });

  it('renders grouped, collapsible article cards and emits selection', async () => {
    const wrapper = mount(ArticleList, {
      props: {
        articles: [article],
        collapsed: { beginner: false, intermediate: false, advanced: false }
      }
    });
    await wrapper.get('.typing-section-header').trigger('click');
    await wrapper.get('.typing-article-card').trigger('click');
    expect(wrapper.emitted('toggle')[0]).toEqual(['beginner']);
    expect(wrapper.emitted('select')[0]).toEqual([article]);
  });

  it('does not capture keyboard input intended for practice controls', async () => {
    const store = {
      article,
      session: { chars: [] },
      isPaused: false,
      remaining: () => 60_000,
      timeSpent: () => 0,
      processKey: vi.fn(),
      retry: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn()
    };
    const wrapper = mount(TypingPractice, { props: { store } });

    await wrapper.get('.typing-retry-btn').trigger('keydown', { key: 'Enter' });

    expect(store.processKey).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('restores typing input after restarting from the toolbar', async () => {
    const store = {
      article,
      session: { chars: [] },
      isPaused: false,
      remaining: () => 60_000,
      timeSpent: () => 0,
      processKey: vi.fn(),
      retry: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn()
    };
    const wrapper = mount(TypingPractice, { props: { store }, attachTo: document.body });
    const retry = wrapper.get('.typing-retry-btn');
    retry.element.focus();

    await retry.trigger('click');
    expect(document.activeElement).not.toBe(retry.element);
    document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'A', bubbles: true }));

    expect(store.retry).toHaveBeenCalledOnce();
    expect(store.processKey).toHaveBeenCalledWith('A', expect.any(Number));
    wrapper.unmount();
  });
});

describe('Vue vocabulary skill', () => {
  beforeEach(async () => {
    installMemoryStorage();
    await clearSkillData();
    setActivePinia(createPinia());
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(new Date('2026-07-13T00:00:00Z'));
  });

  it('implements the SM-2 sequence and failure reset', () => {
    expect(dateKey(new Date('2026-07-13T12:00:00Z'))).toBe('2026-07-13');
    const first = scheduleReview(5, {}, new Date('2026-07-13T00:00:00Z'));
    const second = scheduleReview(5, first, new Date('2026-07-14T00:00:00Z'));
    const failed = scheduleReview(1, second, new Date('2026-07-20T00:00:00Z'));
    expect(first).toMatchObject({ interval: 1, repetitions: 1, nextReview: '2026-07-14' });
    expect(second).toMatchObject({ interval: 6, repetitions: 2, nextReview: '2026-07-20' });
    expect(failed).toMatchObject({ interval: 1, repetitions: 0, nextReview: '2026-07-21' });
  });

  it('releases loaded word banks and progress outside the route', () => {
    const store = useVocabularyStore();
    store.wordData = { reading: [{ id: 'word-1' }] };
    store.progress = { reading: { 'set-1': { words: {} } } };
    store.queue = [{ id: 'word-1' }];

    store.releaseWorkset();

    expect(store.initialized).toBe(false);
    expect(store.wordData).toEqual({});
    expect(store.progress).toEqual({});
    expect(store.queue).toEqual([]);
  });

  it('groups repeated etymology parts and finds unique due words', () => {
    const words = [
      { id: 'a', etymology: { root: { form: 'struct' } } },
      { id: 'b', etymology: { root: 'struct' } },
      { id: 'c', etymology: null }
    ];
    const roots = buildRootCategories(words).find(category => category.id === 'root');
    expect(roots.groups[0]).toMatchObject({ title: 'struct' });
    expect(roots.groups[0].words).toHaveLength(2);
    const progress = {
      reading: {
        'set-1': { words: { a: { nextReview: '2026-07-12', lastQ: 3 } } },
        'set-2': {
          words: {
            a: { nextReview: '2026-07-10', lastQ: 1 },
            b: { nextReview: '2026-07-14', lastQ: 1 }
          }
        }
      }
    };
    expect(dueWordIds(progress, 'reading', ['a', 'b'], '2026-07-13')).toEqual(['a']);
  });

  it('builds four unique answer options with a single correct answer', () => {
    const words = [1, 2, 3, 4].map(id => ({
      id: String(id),
      word: `w${id}`,
      pos: [{ translation: `meaning ${id}` }]
    }));
    const options = makeOptions(words[0], words, words, 'meaning', () => 0.5);
    expect(options).toHaveLength(4);
    expect(new Set(options.map(option => option.id)).size).toBe(4);
    expect(options.filter(option => option.correct)).toHaveLength(1);
  });

  it('keeps Chinese vocabulary fields available as learning content', () => {
    const word = {
      word: 'ability',
      pos: [{ type: 'n', translation: '能力；才能' }],
      example: 'She has the ability to adapt.',
      example_cn: '她有适应能力。'
    };

    expect(wordMeaning(word)).toBe('能力；才能');
    const wrapper = mount(WordDetail, {
      props: { word },
      global: { stubs: { Teleport: true } }
    });
    expect(wrapper.text()).toContain('能力；才能');
    expect(wrapper.text()).toContain('她有适应能力。');
    wrapper.unmount();
  });

  it('saves evaluation progress and a compact resumable session', async () => {
    const store = useVocabularyStore();
    store.subject = 'reading';
    store.setId = 1;
    store.currentSetIndex = 0;
    store.wordData.reading = [{ id: 'a', word: 'ability', pos: [{ translation: 'skill' }] }];
    store.startQueue(store.wordData.reading, 'card-learning');
    store.evaluate(3);
    await vi.waitFor(async () => {
      expect((await loadVocabularyProgress()).reading['set-1'].words.a.lastQ).toBe(3);
    });
    await vi.advanceTimersByTimeAsync(300);
    const session = JSON.parse(localStorage.getItem(VOCAB_SESSION_KEY));
    expect(session.queueIds).toEqual(['a']);
    expect(JSON.stringify(session)).not.toContain('skill');
  });

  it('loads only the vocabulary manifest until a subject is selected', async () => {
    const bank = [{ id: 'a', word: 'ability', pos: [{ translation: 'skill' }] }];
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({ ok: true, json: async () => ({ reading: 1 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => bank });
    const store = useVocabularyStore();
    await store.initialize();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenLastCalledWith('assets/questions/vocabulary/manifest.json');
    await store.selectSubject('reading');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenLastCalledWith('assets/questions/vocabulary/reading-words.json');
  });

  it('preserves review set mappings when restoring a cross-set queue', () => {
    const store = useVocabularyStore();
    store.wordData.reading = [
      { id: 'a', word: 'ability' },
      { id: 'b', word: 'benefit' }
    ];
    store.restoreSession({
      subject: 'reading',
      mode: 'random',
      page: 'review',
      currentSetIndex: 0,
      queueIds: [
        ['a', 'set-1'],
        ['b', 'set-2']
      ],
      currentIndex: 1,
      isGlobalReview: true,
      unknownIds: []
    });
    expect(store.queue.map(word => word._reviewSetId)).toEqual(['set-1', 'set-2']);
    expect(store.currentWord.id).toBe('b');
  });

  it('returns root-group learning to its group list without rebuilding the hierarchy', () => {
    const store = useVocabularyStore();
    const groups = [{ title: 'struct', words: [{ id: 'a', word: 'construct' }] }];
    store.mode = 'root';
    store.subject = 'reading';
    store.page = 'card-learning';
    store.rootCategory = 'root';
    store.rootGroups = groups;
    store.rootGroupTitle = 'struct';

    store.backFromLearning();

    expect(store.page).toBe('set-list');
    expect(store.rootCategory).toBe('root');
    expect(store.rootGroups).toStrictEqual(groups);

    store.page = 'card-learning';
    store.finishQueue();
    expect(store.page).toBe('set-list');
    expect(store.rootCategory).toBe('root');
    expect(store.rootGroups).toStrictEqual(groups);
  });
});
