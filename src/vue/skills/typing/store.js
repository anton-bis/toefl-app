import { defineStore } from 'pinia';
import { computeMetrics, createCharacters, maxSecondsFor } from './logic.js';
import { loadTypingHistory, replaceTypingHistory } from '../../platform/dataRepository.js';
import {
  isPlainObject,
  removeLocalValue,
  readLocalJson,
  scheduleLocalJson,
  writeLocalJson
} from '../../platform/localPersistence.js';

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

export const useTypingStore = defineStore('typing', {
  state: () => ({
    initialized: false,
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
  }),
  getters: {
    canResume: state => Boolean(state.session && state.article),
    currentIndex: state => state.session?.currentIndex || 0,
    isPaused: state => Boolean(state.session?.paused)
  },
  actions: {
    async initialize() {
      if (this.initialized || this.loading) return;
      this.loading = true;
      this.error = '';
      try {
        const history = await loadTypingHistory();
        this.history = (Array.isArray(history) ? history : []).filter(
          record =>
            isPlainObject(record) &&
            Number(record.netWpm) < 200 &&
            Number(record.timeSpent) > 0 &&
            Number(record.totalChars) > 0
        );
        this.best = deriveTypingBest(this.history);
        const response = await fetch('assets/questions/typing/corpus.json');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const corpus = await response.json();
        this.articles = corpus.filter(article => article.content?.trim());
        const saved = readLocalJson(TYPING_SESSION_KEY, null);
        const article = this.articles.find(item => item.id === saved?.articleId);
        const restored = article ? restoredSession(saved, article) : null;
        if (article && restored) {
          this.article = article;
          this.session = restored;
          this.page = 'typing';
        }
        this.initialized = true;
      } catch (error) {
        this.error = `Unable to load typing articles: ${error.message}`;
      } finally {
        this.loading = false;
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
        if (session.currentIndex > 0) {
          session.currentIndex -= 1;
          Object.assign(session.chars[session.currentIndex], { status: 'untouched', input: '' });
          this.scheduleSessionPersist(500, now);
        }
        return false;
      }
      const input = key === 'Enter' ? '\n' : key;
      if (input.length !== 1) return false;
      if (!session.runningSince) session.runningSince = now;
      const char = session.chars[session.currentIndex];
      char.input = input;
      char.status = input === char.expected ? 'correct' : 'incorrect';
      session.currentIndex += 1;
      this.scheduleSessionPersist(500, now);
      if (session.currentIndex >= session.chars.length) this.complete(now);
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
      this.cancelSessionPersist();
      removeLocalValue(TYPING_SESSION_KEY);
      this.session = null;
      this.page = 'result';
    },
    persistSession() {
      this.cancelSessionPersist();
      if (this.session) writeLocalJson(TYPING_SESSION_KEY, serializedSession(this.session));
    },
    scheduleSessionPersist(delay = 500, now = Date.now()) {
      if (this.session)
        scheduleLocalJson(TYPING_SESSION_KEY, serializedSession(this.session, now), delay);
    },
    cancelSessionPersist() {
      // A following immediate write/removal cancels the shared pending entry.
    },
    backToList() {
      this.page = 'list';
      this.article = null;
      this.session = null;
      this.result = null;
      this.cancelSessionPersist();
      removeLocalValue(TYPING_SESSION_KEY);
    }
  }
});
