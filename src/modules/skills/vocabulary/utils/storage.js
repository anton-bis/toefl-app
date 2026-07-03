var PROGRESS_KEY = 'skills_vocab_progress';
var SETTINGS_KEY = 'skills_vocab_settings';
var SESSION_KEY = 'skills_vocab_session';

var DEFAULT_SETTINGS = {
  mode: 'random',
  reminderEnabled: true,
  reminderDate: '',
  preferredAccent: 'us',
  dailyCompleted: {},
  dailyDate: ''
};

export function loadProgress() {
  try {
    var raw = localStorage.getItem(PROGRESS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) { return {}; }
}

export function saveProgress(progress) {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch (e) {
    console.warn('[vocab-storage] saveProgress failed:', e);
  }
}

export function getWordRecord(subject, setId, wordId) {
  var progress = loadProgress();
  return progress[subject] && progress[subject][setId] &&
    progress[subject][setId].words[wordId] || null;
}

export function saveWordRecord(subject, setId, wordId, record) {
  var progress = loadProgress();
  if (!progress[subject]) progress[subject] = {};
  if (!progress[subject][setId]) {
    progress[subject][setId] = { status: 'learning', words: {} };
  }
  progress[subject][setId].words[wordId] = record;
  saveProgress(progress);
}

export function markSetCompleted(subject, setId) {
  var progress = loadProgress();
  if (progress[subject] && progress[subject][setId]) {
    progress[subject][setId].status = 'completed';
    progress[subject][setId].completedAt = new Date().toISOString();
    saveProgress(progress);
  }
}

export function loadSettings() {
  try {
    var raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? Object.assign({}, DEFAULT_SETTINGS, JSON.parse(raw)) : Object.assign({}, DEFAULT_SETTINGS);
  } catch (e) { return Object.assign({}, DEFAULT_SETTINGS); }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) { /* ignore */ }
}

export function loadSession() {
  try {
    var raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

export function saveSession(session) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch (e) { /* ignore */ }
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}
