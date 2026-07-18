import { defineStore } from 'pinia';
import { markRaw } from 'vue';
import {
  SUBJECTS,
  SUBJECT_LABELS,
  buildRootCategories,
  dateKey,
  dueWordIds,
  pickQuizType,
  scheduleReview
} from './logic.js';
import { clearSession, loadSession, loadSettings, saveSession, saveSettings } from './storage.js';
import {
  loadVocabularyProgress,
  loadVocabularyOverview,
  saveVocabularySet,
  saveVocabularyWord
} from '../../platform/dataRepository.js';

function sessionSnapshot(state) {
  return {
    page: state.page,
    mode: state.mode,
    subject: state.subject,
    currentSetIndex: state.currentSetIndex,
    nineGridPage: state.nineGridPage,
    setId: state.setId,
    unknownIds: state.words.filter(word => word.gridStatus === 'unknown').map(word => word.id),
    queueIds: state.queue.map(word => (word._reviewSetId ? [word.id, word._reviewSetId] : word.id)),
    currentIndex: state.currentIndex,
    currentQuizType: state.currentQuizType,
    isGlobalReview: state.isGlobalReview,
    rootCategory: state.rootCategory,
    rootGroupTitle: state.rootGroupTitle
  };
}

function rootGroupsFor(category) {
  if (category.id !== 'root') return category.groups;
  return [
    ...category.recommendedGroups,
    { type: 'separator', label: `More roots (${category.moreGroups.length})` },
    ...category.moreGroups
  ];
}

function vocabularyState() {
  return {
    initialized: false,
    lifecycleGeneration: 0,
    loading: false,
    error: '',
    page: 'subject-select',
    mode: 'random',
    preferredAccent: 'us',
    subjects: SUBJECTS,
    subject: null,
    wordData: {},
    setCounts: {},
    sets: [],
    currentSetIndex: 0,
    setId: 0,
    words: [],
    queue: [],
    currentIndex: 0,
    currentQuizType: null,
    nineGridPage: 0,
    progress: {},
    globalDueCount: 0,
    dueCounts: {},
    isGlobalReview: false,
    rootCategory: null,
    rootGroups: [],
    rootGroupTitle: '',
    showReminder: false,
    pendingReminder: [],
    detailWord: null
  };
}

function restoreVocabularyWords(store, saved) {
  if (store.mode === 'root' && saved.rootCategory) {
    const categoryIndex = store.sets.findIndex(item => item.id === saved.rootCategory);
    store.selectRootItem(categoryIndex);
    const groupIndex = store.rootGroups.findIndex(group => group.title === saved.rootGroupTitle);
    if (groupIndex >= 0) store.selectRootItem(groupIndex);
    return;
  }
  const set = store.sets[store.currentSetIndex];
  const unknownIds = new Set(saved.unknownIds || []);
  store.words = (set?.words || []).map(word => ({
    ...word,
    gridStatus: unknownIds.has(word.id) ? 'unknown' : 'unmarked'
  }));
}

function restoreVocabularyQueue(store, saved) {
  const bank = store.wordData[store.subject] || [];
  const byId = new Map([...bank, ...store.words].map(word => [word.id, word]));
  store.queue = (saved.queueIds || [])
    .map(entry => {
      const [id, reviewSetId] = Array.isArray(entry) ? entry : [entry, null];
      const word = byId.get(id);
      return word && reviewSetId ? { ...word, _reviewSetId: reviewSetId } : word;
    })
    .filter(Boolean);
}

export const useVocabularyStore = defineStore('vocabulary', {
  state: vocabularyState,
  getters: {
    subjectLabel: state => SUBJECT_LABELS[state.subject] || state.subject || '',
    currentWord: state => state.queue[state.currentIndex] || null,
    queueLength: state => state.queue.length,
    todayReviewCount: state => {
      return Object.values(state.dueCounts).reduce((sum, count) => sum + count, 0);
    }
  },
  actions: {
    async initialize() {
      if (this.initialized) return;
      const generation = this.lifecycleGeneration;
      this.loading = true;
      const settings = loadSettings();
      this.mode = settings.mode;
      this.preferredAccent = settings.preferredAccent;
      try {
        const overview = await loadVocabularyOverview(dateKey());
        if (generation !== this.lifecycleGeneration) return;
        this.dueCounts = Object.fromEntries(
          overview.due.map(({ subject, count }) => [subject, Number(count)])
        );
        overview.sets.forEach(({ subject, setId, value }) => {
          (this.progress[subject] ||= {})[setId] ||= { words: {} };
          Object.assign(this.progress[subject][setId], value, { words: {} });
        });
        const response = await fetch('assets/questions/vocabulary/manifest.json');
        if (!response.ok) throw new Error(`HTTP ${response.status} for vocabulary manifest`);
        const counts = await response.json();
        if (generation !== this.lifecycleGeneration) return;
        SUBJECTS.forEach(subject => {
          this.setCounts[subject] = Math.ceil((Number(counts[subject]) || 0) / 25);
        });
        const saved = loadSession();
        if (saved && SUBJECTS.includes(saved.subject)) {
          await this.loadSubject(saved.subject, generation);
          if (generation !== this.lifecycleGeneration) return;
          this.restoreSession(saved);
        } else this.checkReminder();
        this.initialized = true;
      } catch (error) {
        this.error = `Couldn't load vocabulary: ${error.message}`;
      } finally {
        if (generation === this.lifecycleGeneration) this.loading = false;
      }
    },
    async loadSubject(subject, generation = this.lifecycleGeneration) {
      if (this.wordData[subject]) return this.wordData[subject];
      if (!SUBJECTS.includes(subject)) throw new Error('Unknown vocabulary subject');
      const [response, progress] = await Promise.all([
        fetch(`assets/questions/vocabulary/${subject}-words.json`),
        loadVocabularyProgress(subject)
      ]);
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${subject}`);
      const bank = await response.json();
      if (generation !== this.lifecycleGeneration) return null;
      if (!Array.isArray(bank)) throw new Error(`Invalid ${subject} vocabulary data`);
      this.progress[subject] = progress[subject] || {};
      this.wordData = { [subject]: markRaw(bank) };
      this.setCounts[subject] = Math.ceil(bank.length / 25);
      return bank;
    },
    setMode(mode) {
      this.mode = mode;
      saveSettings({ ...loadSettings(), mode });
    },
    async selectSubject(subject) {
      const generation = this.lifecycleGeneration;
      this.loading = true;
      this.error = '';
      try {
        const bank = await this.loadSubject(subject, generation);
        if (!bank || generation !== this.lifecycleGeneration) return;
        this.subject = subject;
        this.page = 'set-list';
        this.buildSets();
      } catch (error) {
        this.error = `Couldn't load vocabulary: ${error.message}`;
      } finally {
        if (generation === this.lifecycleGeneration) this.loading = false;
      }
    },
    buildSets() {
      const words = this.wordData[this.subject] || [];
      this.rootCategory = null;
      this.rootGroups = [];
      let sets;
      if (this.mode === 'root') {
        sets = buildRootCategories(words);
      } else {
        sets = [];
        for (let i = 0; i < words.length; i += 25) {
          const id = sets.length + 1;
          const setProgress = this.progress[this.subject]?.[`set-${id}`];
          sets.push({
            id,
            words: words.slice(i, i + 25),
            wordCount: Math.min(25, words.length - i),
            status: setProgress?.status || 'pending'
          });
        }
      }
      this.sets = markRaw(sets);
      this.computeDueCount();
    },
    backFromSetList() {
      if (this.mode === 'root' && this.rootCategory) {
        this.rootCategory = null;
        this.rootGroups = [];
      } else {
        this.page = 'subject-select';
        this.subject = null;
      }
    },
    selectSet(index) {
      if (this.mode === 'root') return this.selectRootItem(index);
      const set = this.sets[index];
      if (!set) return;
      this.currentSetIndex = index;
      this.setId = index + 1;
      this.words = set.words.map(word => ({ ...word, gridStatus: 'unmarked' }));
      this.nineGridPage = 0;
      if (['reading', 'writing'].includes(this.subject)) this.page = 'nine-grid';
      else this.startQueue(this.words, 'audio-learning');
      this.persist();
    },
    selectRootItem(index) {
      if (this.rootCategory) {
        const group = this.rootGroups[index];
        if (!group || group.type === 'separator') return;
        const setId = `root-${group.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
        const words = group.words.map(word => ({ ...word, _reviewSetId: setId }));
        this.rootGroupTitle = group.title;
        this.words = words;
        this.startQueue(
          words,
          ['reading', 'writing'].includes(this.subject) ? 'card-learning' : 'audio-learning'
        );
        return;
      }
      const category = this.sets[index];
      if (!category) return;
      if (category.id === 'other') {
        const words = category.words
          .slice(0, 25)
          .map(word => ({ ...word, _reviewSetId: 'root-other' }));
        this.rootGroupTitle = category.title;
        this.words = words;
        this.startQueue(
          words,
          ['reading', 'writing'].includes(this.subject) ? 'card-learning' : 'audio-learning'
        );
        return;
      }
      this.rootCategory = category.id;
      this.rootGroups = rootGroupsFor(category);
    },
    toggleGridWord(id) {
      const word = this.words.find(item => item.id === id);
      if (word) word.gridStatus = word.gridStatus === 'unknown' ? 'unmarked' : 'unknown';
      this.persist();
    },
    setGridPage(page) {
      this.nineGridPage = page;
      this.persist();
    },
    assembleGrid() {
      const unknown = this.words.filter(word => word.gridStatus === 'unknown');
      this.startQueue(unknown.length ? unknown : this.words, 'card-learning');
    },
    startQueue(words, page) {
      this.queue = [...words];
      this.currentIndex = 0;
      this.currentQuizType = page === 'audio-learning' ? 'audio-zh' : pickQuizType(this.subject);
      this.page = page;
      this.persist();
    },
    evaluate(quality) {
      const word = this.currentWord;
      if (!word) return;
      const setId = word._reviewSetId || `set-${this.currentSetIndex + 1}`;
      const subjectProgress = (this.progress[this.subject] ||= {});
      const setProgress = (subjectProgress[setId] ||= { status: 'learning', words: {} });
      setProgress.words[word.id] = scheduleReview(quality, setProgress.words[word.id]);
      this.computeDueCount();
      saveVocabularyWord(this.subject, setId, word.id, setProgress.words[word.id]).catch(error => {
        this.error = `Couldn't save your progress: ${error.message}`;
      });
      this.currentIndex += 1;
      if (this.currentIndex >= this.queue.length) return this.finishQueue();
      this.currentQuizType = pickQuizType(this.subject, this.page === 'review');
      this.persist();
    },
    finishQueue() {
      if (this.page === 'review') {
        if (this.isGlobalReview || this.mode === 'root') return this.goToSetList();
        return this.finishSet();
      }
      if (this.mode === 'root') return this.backFromLearning();
      const needsReview = this.queue.filter(word => {
        const record =
          this.progress[this.subject]?.[`set-${this.currentSetIndex + 1}`]?.words?.[word.id];
        return !record || record.lastQ < 5;
      });
      this.queue = needsReview.length ? needsReview : [...this.queue];
      this.currentIndex = 0;
      this.currentQuizType = pickQuizType(this.subject, true);
      this.page = 'review';
      this.persist();
    },
    finishSet() {
      const set = ((this.progress[this.subject] ||= {})[`set-${this.currentSetIndex + 1}`] ||= {
        words: {}
      });
      set.status = 'completed';
      set.completedAt = new Date().toISOString();
      saveVocabularySet(this.subject, `set-${this.currentSetIndex + 1}`, set).catch(error => {
        this.error = `Couldn't save this set: ${error.message}`;
      });
      this.goToSetList();
    },
    goToSetList() {
      clearSession();
      this.isGlobalReview = false;
      this.page = 'set-list';
      this.buildSets();
    },
    backFromLearning() {
      clearSession();
      const keepRootGroupList = this.mode === 'root' && this.rootCategory && !this.isGlobalReview;
      this.isGlobalReview = false;
      this.page = 'set-list';
      if (!keepRootGroupList) this.buildSets();
    },
    startGlobalReview() {
      const bank = this.wordData[this.subject] || [];
      const dueIds = new Set(
        dueWordIds(
          this.progress,
          this.subject,
          bank.map(word => word.id)
        )
      );
      const records = this.progress[this.subject] || {};
      const wordSet = new Map();
      Object.entries(records).forEach(([setId, set]) =>
        Object.keys(set.words || {}).forEach(id => {
          if (dueIds.has(id) && !wordSet.has(id)) wordSet.set(id, setId);
        })
      );
      this.queue = bank
        .filter(word => wordSet.has(word.id))
        .map(word => ({ ...word, _reviewSetId: wordSet.get(word.id) }))
        .slice(0, 50);
      this.currentIndex = 0;
      this.currentQuizType = pickQuizType(this.subject, true);
      this.isGlobalReview = true;
      this.page = 'review';
      this.persist();
    },
    computeDueCount() {
      const ids = (this.wordData[this.subject] || []).map(word => word.id);
      const dueCount = dueWordIds(this.progress, this.subject, ids).length;
      this.globalDueCount = Math.min(50, dueCount);
      if (this.subject) this.dueCounts[this.subject] = dueCount;
    },
    checkReminder() {
      const settings = loadSettings();
      const today = dateKey();
      if (!settings.reminderEnabled || settings.reminderDate === today) return;
      this.pendingReminder = SUBJECTS.flatMap(subject => {
        const completed = Object.values(this.progress[subject] || {}).filter(
          set => set.status === 'completed'
        ).length;
        return completed < this.setCounts[subject] ? [{ subject, setId: completed + 1 }] : [];
      });
      this.showReminder = this.pendingReminder.length > 0;
    },
    dismissReminder() {
      saveSettings({ ...loadSettings(), reminderDate: dateKey() });
      this.showReminder = false;
    },
    async startReminder() {
      const pending = this.pendingReminder[0];
      if (!pending) return;
      this.showReminder = false;
      await this.selectSubject(pending.subject);
      if (this.error) return;
      this.selectSet(pending.setId - 1);
    },
    setAccent(accent) {
      this.preferredAccent = accent;
      saveSettings({ ...loadSettings(), preferredAccent: accent });
    },
    openDetail(word) {
      this.detailWord = word;
    },
    closeDetail() {
      this.detailWord = null;
    },
    releaseWorkset() {
      const generation = this.lifecycleGeneration + 1;
      this.$reset();
      this.lifecycleGeneration = generation;
    },
    persist() {
      if (this.subject && this.page !== 'subject-select' && this.page !== 'set-list')
        saveSession(sessionSnapshot(this));
    },
    restoreSession(saved) {
      this.mode = saved.mode || this.mode;
      this.subject = saved.subject;
      this.buildSets();
      this.currentSetIndex = saved.currentSetIndex || 0;
      this.setId = saved.setId || this.currentSetIndex + 1;
      restoreVocabularyWords(this, saved);
      restoreVocabularyQueue(this, saved);
      this.currentIndex = Math.min(saved.currentIndex || 0, Math.max(0, this.queue.length - 1));
      this.currentQuizType = saved.currentQuizType || null;
      this.nineGridPage = saved.nineGridPage || 0;
      this.isGlobalReview = Boolean(saved.isGlobalReview);
      this.page = saved.page || 'set-list';
      this.persist();
    }
  }
});
