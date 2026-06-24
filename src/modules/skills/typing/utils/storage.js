var HISTORY_KEY = 'skills_typing_history';
var BEST_KEY = 'skills_typing_best';
var MAX_HISTORY = 100;

export function loadHistory() {
  try {
    var raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    var all = JSON.parse(raw);
    return all.filter(function (r) {
      return r.netWpm < 200 && r.timeSpent > 0 && r.totalChars > 0;
    });
  } catch (e) {
    return [];
  }
}

export function saveRecord(record) {
  var history = loadHistory();
  history.push(record);
  if (history.length > MAX_HISTORY) {
    history = history.slice(history.length - MAX_HISTORY);
  }
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (e) {
    // localStorage full, discard oldest half
    history = history.slice(Math.floor(history.length / 2));
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }
}

export function loadBest() {
  try {
    var raw = localStorage.getItem(BEST_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

export function updateBest(difficulty, netWpm, accuracy, articleId) {
  var best = loadBest();
  if (!best[difficulty]) {
    best[difficulty] = {
      bestNetWpm: 0,
      bestAccuracy: 0,
      bestNetWpmArticleId: '',
      bestAccuracyArticleId: '',
      historyCount: 0
    };
  }

  var entry = best[difficulty];
  entry.historyCount++;

  if (netWpm > entry.bestNetWpm) {
    entry.bestNetWpm = Math.round(netWpm * 10) / 10;
    entry.bestNetWpmArticleId = articleId;
  }
  if (accuracy > entry.bestAccuracy) {
    entry.bestAccuracy = Math.round(accuracy * 10) / 10;
    entry.bestAccuracyArticleId = articleId;
  }

  try {
    localStorage.setItem(BEST_KEY, JSON.stringify(best));
  } catch (e) {
    // silently fail
  }
}
