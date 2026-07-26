import { defineStore } from 'pinia';
import { markRaw } from 'vue';
import { computeMetrics, createCharacters, maxSecondsFor } from './logic.js';
import { loadTypingHistory, replaceTypingHistory } from '../../platform/dataRepository.js';
import {
  isPlainObject,
  removeLocalValue,
  readLocalJson,
  scheduleLocalJson,
  writeLocalJson
} from '../../platform/localPersistence.js';
import { readText } from '../../platform/contentRepository.js';

export const TYPING_SESSION_KEY = 'toefl:typing:session';
const MAX_HISTORY = 100;

function serializedSession(session, now = Date.now()) {
  return {
    articleId: session.articleId,
    input: session.chars
      .slice(0, session.currentIndex)
      .map(char => char.input)
      .join(''),
    elapsedMs: Math.floor(elapsed(session, now))
  };
}

function restoredSession(saved, article) {
  if (!isPlainObject(saved) || typeof saved.input !== 'string') return null;
  const chars = createCharacters(article.content);
  const input = [...saved.input];
  if (input.length > chars.length) return null;
  input.forEach((character, index) => {
    chars[index].input = character;
    chars[index].status = chars[index].input === chars[index].expected ? 'correct' : 'incorrect';
  });
  return {
    articleId: article.id,
    chars,
    currentIndex: input.length,
    elapsedMs: Math.max(0, Number(saved.elapsedMs) || 0),
    runningSince: null,
    paused: true
  };
}

function deriveTypingBest(history) {
  return history.reduce((best, record) => {
    const difficulty = record.difficulty;
    if (!difficulty) return best;
    const current = best[difficulty] || {
      bestNetWpm: 0,
      bestAccuracy: 0,
      bestNetWpmArticleId: '',
      bestAccuracyArticleId: '',
      historyCount: 0
    };
    const next = { ...current, historyCount: current.historyCount + 1 };
    if (Number(record.netWpm) > current.bestNetWpm) {
      next.bestNetWpm = Number(record.netWpm);
      next.bestNetWpmArticleId = record.articleId;
    }
    if (Number(record.accuracy) > current.bestAccuracy) {
      next.bestAccuracy = Number(record.accuracy);
      next.bestAccuracyArticleId = record.articleId;
    }
    best[difficulty] = next;
    return best;
  }, {});
}

function elapsed(session, now = Date.now()) {
  if (!session) return 0;
  return session.elapsedMs + (session.runningSince ? Math.max(0, now - session.runningSince) : 0);
}

function typingState() {
  return {
    initialized: false,
    lifecycleGeneration: 0,
    page: 'list',
    articles: [],
    loading: false,
    error: '',
    collapsed: { beginner: false, intermediate: false, advanced: false },
    article: null,
    session: null,
    result: null,
    history: [],
    best: {}
  };
}

function validHistoryRecord(record) {
  return (
    isPlainObject(record) &&
    Number(record.netWpm) < 200 &&
    Number(record.timeSpent) > 0 &&
    Number(record.totalChars) > 0
  );
}

async function loadArticles() {
  const corpus = JSON.parse(await readText('assets/questions/typing/corpus.json'));
  return corpus.filter(article => article.content?.trim());
}

function restoreTypingSession(store) {
  const saved = readLocalJson(TYPING_SESSION_KEY, null);
  const article = store.articles.find(item => item.id === saved?.articleId);
  const session = article ? restoredSession(saved, article) : null;
  if (!session) return;
  store.article = article;
  store.session = session;
  store.page = 'typing';
}

function removeCharacter(store, session, now) {
  if (session.currentIndex <= 0) return;
  session.currentIndex -= 1;
  Object.assign(session.chars[session.currentIndex], { status: 'untouched', input: '' });
  store.scheduleSessionPersist(500, now);
}

function addCharacter(store, session, input, now) {
  if (!session.runningSince) session.runningSince = now;
  const char = session.chars[session.currentIndex];
  char.input = input;
  char.status = input === char.expected ? 'correct' : 'incorrect';
  session.currentIndex += 1;
  store.scheduleSessionPersist(500, now);
  if (session.currentIndex >= session.chars.length) store.complete(now);
}

export const useTypingStore = defineStore('typing', {
  state: typingState,
  getters: {
    currentIndex: state => state.session?.currentIndex || 0,
    isPaused: state => Boolean(state.session?.paused)
  },
  actions: {
    async initialize() {
      if (this.initialized || this.loading) return;
      const generation = this.lifecycleGeneration;
      this.loading = true;
      this.error = '';
      try {
        const history = await loadTypingHistory();
        if (generation !== this.lifecycleGeneration) return;
        this.history = (Array.isArray(history) ? history : []).filter(validHistoryRecord);
        this.best = deriveTypingBest(this.history);
        const corpus = await loadArticles();
        if (generation !== this.lifecycleGeneration) return;
        this.articles = markRaw(corpus);
        restoreTypingSession(this);
        this.initialized = true;
      } catch (error) {
        this.error = `Unable to load typing articles: ${error.message}`;
      } finally {
        if (generation === this.lifecycleGeneration) this.loading = false;
      }
    },
    toggleDifficulty(difficulty) {
      this.collapsed[difficulty] = !this.collapsed[difficulty];
    },
    startArticle(article) {
      this.article = article;
      this.result = null;
      this.session = {
        articleId: article.id,
        chars: createCharacters(article.content),
        currentIndex: 0,
        elapsedMs: 0,
        runningSince: null,
        paused: false
      };
      this.page = 'typing';
      this.persistSession();
    },
    processKey(key, now = Date.now()) {
      const session = this.session;
      if (!session || session.paused || session.currentIndex >= session.chars.length) return false;
      if (key === 'Backspace') {
        removeCharacter(this, session, now);
        return false;
      }
      const input = key === 'Enter' ? '\n' : key;
      if (input.length !== 1) return false;
      addCharacter(this, session, input, now);
      return true;
    },
    pause(now = Date.now()) {
      if (!this.session || this.session.paused) return;
      this.session.elapsedMs = elapsed(this.session, now);
      this.session.runningSince = null;
      this.session.paused = true;
      this.persistSession();
    },
    resume(now = Date.now()) {
      if (!this.session?.paused) return;
      this.session.paused = false;
      if (this.session.currentIndex > 0) this.session.runningSince = now;
      this.persistSession();
    },
    retry() {
      if (this.article) this.startArticle(this.article);
    },
    timeSpent(now = Date.now()) {
      return elapsed(this.session, now);
    },
    remaining(now = Date.now()) {
      const max = maxSecondsFor(this.article);
      return max ? Math.max(0, max * 1000 - this.timeSpent(now)) : this.timeSpent(now);
    },
    complete(now = Date.now()) {
      if (!this.session || !this.article) return;
      const timeSpent = Math.max(1, elapsed(this.session, now));
      const chars = this.session.chars.map(char => ({ ...char }));
      this.result = { article: this.article, chars, timeSpent, totalChars: chars.length };
      const metrics = computeMetrics(this.result);
      const record = {
        articleId: this.article.id,
        title: this.article.title,
        difficulty: this.article.difficulty,
        ...metrics,
        timeSpent: Math.floor(timeSpent / 1000),
        completedAt: new Date(now).toISOString()
      };
      this.history = [...this.history, record].slice(-MAX_HISTORY);
      this.best = deriveTypingBest(this.history);
      replaceTypingHistory(this.history).catch(error => {
        this.error = `Unable to save typing history: ${error.message}`;
      });
      removeLocalValue(TYPING_SESSION_KEY);
      this.session = null;
      this.page = 'result';
    },
    persistSession() {
      if (this.session) writeLocalJson(TYPING_SESSION_KEY, serializedSession(this.session));
    },
    scheduleSessionPersist(delay = 500, now = Date.now()) {
      if (this.session)
        scheduleLocalJson(TYPING_SESSION_KEY, serializedSession(this.session, now), delay);
    },
    releaseWorkset() {
      const generation = this.lifecycleGeneration + 1;
      const collapsed = { ...this.collapsed };
      this.$reset();
      this.lifecycleGeneration = generation;
      this.collapsed = collapsed;
    },
    backToList() {
      this.page = 'list';
      this.article = null;
      this.session = null;
      this.result = null;
      removeLocalValue(TYPING_SESSION_KEY);
    }
  }
});
