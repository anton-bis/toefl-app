import { store } from '@core/store.js';
import { renderSubjectSelect } from './renderers/SubjectSelect.js';
import { renderSetList } from './renderers/SetList.js';
import { renderNineGrid } from './renderers/NineGrid.js';
import { renderCardLearning } from './renderers/CardLearning.js';
import { renderAudioLearning } from './renderers/AudioLearning.js';
import { renderReviewSession } from './renderers/ReviewSession.js';
import { renderWordDetail } from './renderers/WordDetail.js';
import { renderDailyReminder } from './renderers/DailyReminder.js';
import { loadProgress, saveProgress, loadSettings, saveSettings,
  loadSession, saveSession, clearSession, getWordRecord, saveWordRecord, markSetCompleted } from './utils/storage.js';
import scheduler from './utils/scheduler.js';
import './styles.css';

var SUBJECT_LABELS = {
  reading: 'Reading', listening: 'Listening', speaking: 'Speaking', writing: 'Writing'
};

var RECOMMENDED_ROOTS = [
  'struct', 'aud', 'rupt', 'spect', 'grad', 'mut', 'facere', 'videre',
  'cord', 'habilis', 'tenere', 'lect', 'vertere', 'pict', 'duct',
  'port', 'cap', 'fer', 'press', 'form', 'sign', 'ven', 'spir', 'tract', 'dare'
];

export default {
  name: 'vocabulary',

  state: {
    page: 'subject-select',
    mode: 'random',
    subjects: ['reading', 'listening', 'speaking', 'writing'],
    subject: null,
    subjectLabel: '',
    setCounts: { reading: 0, listening: 0, speaking: 0, writing: 0 },
    wordData: {},       // cached word data per subject
    sets: [],           // current subject's sets
    currentSetIndex: 0,
    words: [],          // current set's words
    queue: [],          // current learning/review queue
    currentIndex: 0,
    currentWord: null,
    currentQuizType: null,
    nineGridPage: 0,
    setId: 0,
    queueLength: 0,
    preferredAccent: 'us',
    showReminder: false,
    pendingReminder: [],
    subjectWordCounts: {},
    globalDueCount: 0,
    isGlobalReview: false,
    rootCategory: null,
    rootGroups: []
  },

  async init() {
    store.registerModule(this.name, {
      name: '\u771F\u9898\u5355\u8BCD\u80CC\u8BF5',
      description: '\u4ECE\u771F\u9898\u4E2D\u63D0\u53D6\u6838\u5FC3\u8BCD\u6C47\uFF0C\u914D\u5408\u79D1\u5B66\u8BB0\u5FC6\u66F2\u7EBF\u5B9A\u671F\u590D\u4E60',
      icon: '\uD83D\uDCD6'
    });
    store.activateModule(this.name);

    var settings = loadSettings();
    this.state.mode = settings.mode || 'random';
    this.state.preferredAccent = settings.preferredAccent || 'us';

    // Check for saved session
    var session = loadSession();
    if (session) {
      this.state = Object.assign(this.state, session);
    }

    await this._loadWordData();
    this._checkDailyReminder();
    this.state.page = this.state.page || 'subject-select';
    this.render();
  },

  async _loadWordData() {
    var subjects = this.state.subjects;
    var setCounts = {};
    var wordData = {};
    var subjectWordCounts = {};

    for (var i = 0; i < subjects.length; i++) {
      var s = subjects[i];
      try {
        var resp = await fetch('assets/questions/vocabulary/' + s + '-words.json');
        var words = await resp.json();
        wordData[s] = words;
        var totalSets = Math.ceil(words.length / 25);
        setCounts[s] = totalSets;
        subjectWordCounts[s] = words.length;
      } catch (e) {
        console.warn('[vocab] Failed to load word data for ' + s);
        wordData[s] = [];
        setCounts[s] = 0;
        subjectWordCounts[s] = 0;
      }
    }

    this.state.setCounts = setCounts;
    this.state.wordData = wordData;
    this.state.subjectWordCounts = subjectWordCounts;
  },

  _checkDailyReminder() {
    var settings = loadSettings();
    if (!settings.reminderEnabled) return;

    var today = new Date().toISOString().split('T')[0];
    if (settings.reminderDate === today) return;

    var progress = loadProgress();
    var pending = [];

    for (var s in this.state.setCounts) {
      var totalSets = this.state.setCounts[s];
      var subjectProgress = progress[s] || {};
      var completedCount = 0;
      for (var setId in subjectProgress) {
        if (subjectProgress[setId].status === 'completed') completedCount++;
      }
      if (completedCount < totalSets) {
        var nextSet = completedCount + 1;
        pending.push({ subject: s, setId: nextSet });
      }
    }

    if (pending.length > 0) {
      this.state.showReminder = true;
      this.state.pendingReminder = pending;
    }
  },

  render() {
    var app = document.getElementById('panel-vocabulary') || document.getElementById('app');
    if (!app) return;
    var self = this;

    if (this.state.showReminder) {
      renderDailyReminder(app, this.state, {
        onStart: function (p) {
          self.state.showReminder = false;
          self.state.subject = p.subject;
          self.state.subjectLabel = SUBJECT_LABELS[p.subject] || p.subject;
          self.state.currentSetIndex = p.setId - 1;
          self._loadSet(p.subject, p.setId - 1);
        },
        onDismiss: function () {
          var settings = loadSettings();
          settings.reminderDate = new Date().toISOString().split('T')[0];
          saveSettings(settings);
          self.state.showReminder = false;
          self.render();
        }
      });
      return;
    }

    switch (this.state.page) {
    case 'subject-select':
      renderSubjectSelect(app, this.state, {
        onSubjectSelect: function (subject) {
          self.state.subject = subject;
          self.state.subjectLabel = SUBJECT_LABELS[subject] || subject;
          self.state.page = 'set-list';
          self._buildSets(subject);
          self.render();
        },
        onModeToggle: function (newMode) {
          self.state.mode = newMode;
          var settings = loadSettings();
          settings.mode = newMode;
          saveSettings(settings);
          self.render();
        }
      });
      break;

    case 'set-list':
      renderSetList(app, this.state, {
        onBack: function () {
          if (self.state.mode === 'root' && self.state.rootCategory) {
            self.state.rootCategory = null;
            self.state.rootGroups = [];
            self._buildSets(self.state.subject);
          } else {
            self.state.page = 'subject-select';
          }
          self.render();
        },
        onSetSelect: function (index) {
          if (self.state.mode === 'root') {
            if (self.state.rootCategory) {
              self._loadRootGroup(index);
            } else {
              self._loadRootSet(index);
            }
          } else {
            self.state.currentSetIndex = index;
            self._loadSet(self.state.subject, index);
          }
        },
        onGlobalReview: function () {
          self._buildGlobalReviewQueue();
        }
      });
      break;

    case 'nine-grid':
      renderNineGrid(app, this.state, {
        onBack: function () {
          self.state.page = 'set-list';
          self._buildSets(self.state.subject);
          self.render();
        },
        onPageChange: function (page) {
          self.state.nineGridPage = page;
          saveSession(self.state);
          self.render();
        },
        onAssemble: function (studyWords) {
          self.state.queue = studyWords;
          self.state.queueLength = studyWords.length;
          self.state.currentIndex = 0;
          self.state.currentWord = studyWords[0];
          self.state.currentQuizType = null; // will be picked per word
          self.state.page = 'card-learning';
          self.render();
        }
      });
      break;

      case 'card-learning':
      renderCardLearning(app, this.state, {
        onBack: function () {
          if (self.state.mode === 'root') {
            self.state.page = 'set-list';
            self._buildSets(self.state.subject);
          } else {
            self.state.page = 'nine-grid';
          }
          self.render();
        },
        onComplete: function () {
          if (self.state.mode === 'root') {
            self.state.page = 'set-list';
            self._buildSets(self.state.subject);
            self.render();
          } else {
            self.state.page = 'review';
            self._buildReviewQueue();
            self.render();
          }
        }
      });
      // Listen for eval event
      app.addEventListener('word-eval', function handler(e) {
        app.removeEventListener('word-eval', handler);
        self._handleEval(e.detail.q);
      });
      break;

    case 'audio-learning':
      renderAudioLearning(app, this.state, {
        onBack: function () {
          self.state.page = 'set-list';
          self._buildSets(self.state.subject);
          self.render();
        },
        onComplete: function () {
          if (self.state.mode === 'root') {
            self.state.page = 'set-list';
            self._buildSets(self.state.subject);
            self.render();
          } else {
            self.state.page = 'review';
            self._buildReviewQueue();
            self.render();
          }
        }
      });
      app.addEventListener('word-eval', function handler(e) {
        app.removeEventListener('word-eval', handler);
        self._handleEval(e.detail.q);
      });
      break;

    case 'review':
      renderReviewSession(app, self.state, {
        onBack: function () { self._goToSetList(); },
        onComplete: function () { self._finishSet(); }
      });
      app.addEventListener('word-eval', function handler(e) {
        app.removeEventListener('word-eval', handler);
        self._handleEval(e.detail.q);
      });
      break;

    case 'word-detail':
      renderWordDetail(null, this.state.currentWord, {
        onClose: function () {
          // overlay closes itself, no state change needed
        }
      });
      break;
    }
  },

  _buildSets(subject) {
    var words = this.state.wordData[subject] || [];

    if (this.state.mode === 'root') {
      this._buildRootSets(subject, words);
      return;
    }

    // Random mode: 25 words per set
    var sets = [];
    for (var i = 0; i < words.length; i += 25) {
      var setWords = words.slice(i, i + 25);
      sets.push({
        id: (sets.length + 1),
        wordCount: setWords.length,
        status: 'pending',
        words: setWords
      });
    }

    this.state.sets = sets;
    this.state.rootCategory = null;
    this.state.rootGroups = [];

    // Load progress status
    var progress = loadProgress();
    var subjectProgress = progress[subject] || {};
    this.state.sets.forEach(function (set) {
      var key = 'set-' + set.id;
      if (subjectProgress[key] && subjectProgress[key].status) {
        set.status = subjectProgress[key].status;
      }
    });

    this._computeDueCounts();
  },

  _extractEtyPart(etymology, key) {
    if (!etymology || typeof etymology === 'string') return null;
    var part = etymology[key];
    if (!part) return null;
    if (typeof part === 'string') return part.trim();
    if (typeof part === 'object') return (part.form || part.text || '').trim() || null;
    return null;
  },

  _buildRootSets(subject, words) {
    var self = this;
    var prefixGroups = {};
    var suffixGroups = {};
    var rootGroups = {};
    var otherWords = [];

    words.forEach(function (w) {
      var ety = w.etymology;
      if (!ety || typeof ety === 'string') { otherWords.push(w); return; }

      var prefix = self._extractEtyPart(ety, 'prefix');
      var root = self._extractEtyPart(ety, 'root');
      var suffix = self._extractEtyPart(ety, 'suffix');

      var hasAny = prefix || root || suffix;
      if (!hasAny) { otherWords.push(w); return; }

      if (prefix) {
        if (!prefixGroups[prefix]) prefixGroups[prefix] = { title: prefix, words: [] };
        prefixGroups[prefix].words.push(w);
      }
      if (root) {
        if (!rootGroups[root]) rootGroups[root] = { title: root, words: [] };
        rootGroups[root].words.push(w);
      }
      if (suffix) {
        if (!suffixGroups[suffix]) suffixGroups[suffix] = { title: suffix, words: [] };
        suffixGroups[suffix].words.push(w);
      }
    });

    function toSortedArray(groups, minSize) {
      return Object.values(groups)
        .filter(function (g) { return g.words.length >= minSize; })
        .sort(function (a, b) { return b.words.length - a.words.length; });
    }

    var prefixArr = toSortedArray(prefixGroups, 2);
    var suffixArr = toSortedArray(suffixGroups, 2);
    var rootArr = toSortedArray(rootGroups, 2);

    // Separate recommended vs more for roots
    var recommendedRoots = [];
    var moreRoots = [];
    rootArr.forEach(function (g) {
      if (RECOMMENDED_ROOTS.indexOf(g.title) >= 0 && recommendedRoots.length < 25) {
        recommendedRoots.push(g);
      } else {
        moreRoots.push(g);
      }
    });

    this.state.sets = [
      {
        id: 'prefix', type: 'category', title: '\u524D\u7F00',
        groupCount: prefixArr.length, wordCount: prefixArr.reduce(function (s, g) { return s + g.words.length; }, 0),
        groups: prefixArr
      },
      {
        id: 'suffix', type: 'category', title: '\u540E\u7F00',
        groupCount: suffixArr.length, wordCount: suffixArr.reduce(function (s, g) { return s + g.words.length; }, 0),
        groups: suffixArr
      },
      {
        id: 'root', type: 'category', title: '\u8BCD\u6839',
        groupCount: rootArr.length, wordCount: rootArr.reduce(function (s, g) { return s + g.words.length; }, 0),
        groups: rootArr, recommendedGroups: recommendedRoots, moreGroups: moreRoots
      },
      {
        id: 'other', type: 'category', title: '\u5176\u4ED6',
        wordCount: otherWords.length, words: otherWords
      }
    ];

    this.state.rootCategory = null;
    this.state.rootGroups = [];
    this._computeDueCounts();
  },

  _loadRootSet(index) {
    var category = this.state.sets[index];
    if (!category) return;
    if (category.id === 'other') {
      // Other: chunk into 25-word groups and start learning
      var chunks = [];
      for (var i = 0; i < category.words.length; i += 25) {
        chunks.push(category.words.slice(i, i + 25));
      }
      this.state.words = chunks[0] || [];
      this.state.queue = chunks[0] || [];
      this.state.queueLength = (chunks[0] || []).length;
      this.state.currentIndex = 0;
      this.state.currentWord = (chunks[0] || [])[0] || null;
      this.state.currentQuizType = null;
      var subj = this.state.subject;
      this.state.page = (subj === 'reading' || subj === 'writing') ? 'card-learning' : 'audio-learning';
      this.render();
      return;
    }

    // Store groups in rootGroups, set rootCategory
    this.state.rootCategory = category.id;
    if (category.id === 'root' && category.recommendedGroups) {
      this.state.rootGroups = [].concat(category.recommendedGroups).concat({ type: 'separator', label: '\u5176\u4ED6\u8BCD\u6839\uFF08' + (category.moreGroups || []).length + '\u7EC4\uFF09' }).concat(category.moreGroups || []);
    } else {
      this.state.rootGroups = category.groups || [];
    }
    this.state.page = 'set-list';
    this.render();
  },

  _loadRootGroup(index) {
    var group = this.state.rootGroups[index];
    if (!group || group.type === 'separator') return;
    var groupSetId = 'root-' + (group.title || '').toLowerCase().replace(/[^a-z0-9]/g, '-');
    (group.words || []).forEach(function (w) { w._reviewSetId = groupSetId; });
    this.state.words = group.words || [];
    this.state.queue = group.words || [];
    this.state.queueLength = (group.words || []).length;
    this.state.currentIndex = 0;
    this.state.currentWord = (group.words || [])[0] || null;
    this.state.currentQuizType = null;
    var subj = this.state.subject;
    this.state.page = (subj === 'reading' || subj === 'writing') ? 'card-learning' : 'audio-learning';
    this.render();
  },

  _computeDueCounts() {
    var subject = this.state.subject;
    var progress = loadProgress();
    var subjectProgress = progress[subject] || {};
    var today = new Date().toISOString().split('T')[0];
    var totalDue = 0;

    if (this.state.mode === 'root') {
      // Root mode: scan ALL word records in this subject (across all setIds)
      var allWords = this.state.wordData[subject] || [];
      var wordMap = {};
      allWords.forEach(function (w) { wordMap[w.id] = true; });
      var seen = {};
      for (var setId in subjectProgress) {
        var ws = subjectProgress[setId].words || {};
        for (var wordId in ws) {
          if (seen[wordId]) continue;
          if (!wordMap[wordId]) continue;
          var rec = ws[wordId];
          if (rec.nextReview && rec.nextReview <= today && rec.lastQ < 5) {
            totalDue++;
          }
          seen[wordId] = true;
        }
      }
    } else {
      // Random mode: scan only completed sets
      var self = this;
      this.state.sets.forEach(function (set) {
        if (set.status !== 'completed') return;
        var key = 'set-' + set.id;
        set.words.forEach(function (w) {
          var rec = getWordRecord(subject, key, w.id);
          if (rec && rec.nextReview && rec.nextReview <= today && rec.lastQ < 5) {
            totalDue++;
          }
        });
      });
    }

    this.state.globalDueCount = Math.min(totalDue, 50);
  },

  _loadSet(subject, index) {
    var set = this.state.sets[index];
    if (!set) return;
    this.state.words = set.words.map(function (w) {
      return Object.assign({}, w, { gridStatus: 'unmarked' });
    });
    this.state.currentSetIndex = index;
    this.state.nineGridPage = 0;
    this.state.setId = index + 1;

    // Reading & Writing -> NineGrid, Listening & Speaking -> AudioLearning
    var isReadingWriting = subject === 'reading' || subject === 'writing';
    if (isReadingWriting) {
      this.state.page = 'nine-grid';
    } else {
      var queueWords = set.words.slice();
      this.state.queue = queueWords;
      this.state.queueLength = queueWords.length;
      this.state.currentIndex = 0;
      this.state.currentWord = queueWords[0];
      this.state.currentQuizType = 'audio-zh';
      this.state.page = 'audio-learning';
    }
    this.render();
  },

  _buildReviewQueue() {
    // Build review queue from words that were marked as not "remembered"
    var progress = loadProgress();
    var subject = this.state.subject;
    var setId = 'set-' + (this.state.currentSetIndex + 1);
    var self = this;

    var reviewWords = this.state.queue.filter(function (w) {
      var rec = getWordRecord(subject, setId, w.id);
      return !rec || rec.lastQ < 5;
    });

    this.state.queue = reviewWords.length > 0 ? reviewWords : this.state.queue.slice();
    this.state.queueLength = this.state.queue.length;
    this.state.currentIndex = 0;
    this.state.currentWord = this.state.queue[0] || null;
    this.state.currentQuizType = null;
    this.state.page = 'review';
    this.render();
  },

  _buildGlobalReviewQueue() {
    var subject = this.state.subject;
    var today = new Date().toISOString().split('T')[0];
    var allWords = this.state.wordData[subject] || [];

    // Build word ID → word object map
    var wordMap = {};
    allWords.forEach(function (w) { wordMap[w.id] = w; });

    // Scan ALL progress records in this subject
    var progress = loadProgress();
    var subjectProgress = progress[subject] || {};
    var dueWords = [];
    var seenIds = {};

    for (var setId in subjectProgress) {
      var ws = subjectProgress[setId].words || {};
      for (var wordId in ws) {
        if (seenIds[wordId]) continue;
        var rec = ws[wordId];
        if (rec.nextReview && rec.nextReview <= today && rec.lastQ < 5) {
          var w = wordMap[wordId];
          if (w) {
            w._reviewSetId = setId;
            w._reviewNextReview = rec.nextReview;
            dueWords.push(w);
          }
        }
        seenIds[wordId] = true;
      }
    }

    dueWords.sort(function (a, b) {
      return (a._reviewNextReview || '') > (b._reviewNextReview || '') ? 1 : -1;
    });

    this.state.queue = dueWords.slice(0, 50);
    this.state.queueLength = this.state.queue.length;
    this.state.currentIndex = 0;
    this.state.currentWord = this.state.queue[0] || null;
    this.state.currentQuizType = null;
    this.state.isGlobalReview = true;
    this.state.page = 'review';
    this.render();
  },

  _handleEval(q) {
    var word = this.state.currentWord;
    if (!word) return;

    var subject = this.state.subject;
    var setId = word._reviewSetId || 'set-' + (this.state.currentSetIndex + 1);

    var rec = getWordRecord(subject, setId, word.id) || {};
    var updated = scheduler.record(word.id, q, rec);
    saveWordRecord(subject, setId, word.id, updated);

    this.state.currentIndex++;
    if (this.state.currentIndex >= this.state.queue.length) {
      if (this.state.page === 'review') {
        if (this.state.isGlobalReview) {
          this.state.isGlobalReview = false;
          this._goToSetList();
        } else if (this.state.mode === 'root') {
          this.state.page = 'set-list';
          this._buildSets(this.state.subject);
          this.render();
        } else {
          this._finishSet();
        }
      } else {
        if (this.state.mode === 'root') {
          this.state.page = 'set-list';
          this._buildSets(this.state.subject);
          this.render();
        } else {
          this._buildReviewQueue();
        }
      }
      return;
    }

    this.state.currentWord = this.state.queue[this.state.currentIndex];
    this.state.currentQuizType = null;
    saveSession(this.state);
    this.render();
  },

  _finishSet() {
    var subject = this.state.subject;
    var setId = 'set-' + (this.state.currentSetIndex + 1);
    markSetCompleted(subject, setId);

    clearSession();
    this.state.page = 'set-list';
    // Reload set status
    this._buildSets(subject);
    this.render();
  },

  _goToSetList() {
    clearSession();
    this.state.page = 'set-list';
    this._buildSets(this.state.subject);
    this.render();
  },

  destroy() {
    saveSession(this.state);
  }
};
