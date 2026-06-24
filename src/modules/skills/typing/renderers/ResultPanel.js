export function renderResultPanel(container, ctx) {
  var scores = ctx.scores;
  var onRetry = ctx.onRetry;
  var onBack = ctx.onBack;
  var metrics = ctx.metrics;

  var wrapper = document.createElement('div');
  wrapper.className = 'typing-result';

  var timeStr = formatDuration(scores.timeSpent);

  wrapper.innerHTML = [
    '<div class="typing-result-article">',
    escapeHtml(scores.article.title),
    '</div>',
    '<div class="typing-result-sub">',
    scores.article.difficulty.charAt(0).toUpperCase() + scores.article.difficulty.slice(1),
    ' \u00B7 ',
    scores.article.wordCount,
    ' words</div>',
    '<div class="typing-result-metrics">',
    '<div class="typing-metrics-cards">',
    buildMetricCard(metrics.rawWpm.toFixed(1), 'Raw WPM'),
    buildMetricCard(metrics.accuracy.toFixed(1) + '%', 'Accuracy'),
    buildMetricCard(timeStr, 'Time'),
    '</div>',
    '<div class="typing-metrics-net">',
    '<div class="typing-metrics-net-label">Net WPM</div>',
    '<div class="typing-metrics-net-value">',
    metrics.netWpm.toFixed(1),
    '</div>',
    '</div>',
    '</div>',
    buildErrorDistribution(metrics.errors, metrics.totalChars),
    '<div class="typing-result-actions">',
    '<button class="typing-result-btn typing-result-btn-primary">\u21BB Try Again</button>',
    '<button class="typing-result-btn typing-result-btn-ghost">\u2190 Back to List</button>',
    '</div>'
  ].join('');

  wrapper.querySelector('.typing-result-btn-primary').addEventListener('click', onRetry);
  wrapper.querySelector('.typing-result-btn-ghost').addEventListener('click', onBack);

  container.appendChild(wrapper);
}

function buildMetricCard(value, label) {
  return [
    '<div class="typing-metric-card">',
    '<div class="typing-metric-value">',
    value,
    '</div>',
    '<div class="typing-metric-label">',
    label,
    '</div>',
    '</div>'
  ].join('');
}

function buildErrorDistribution(errors, totalChars) {
  var categories = [
    { key: 'spacing', label: 'Spacing / \u7A7A\u683C', color: '#FF9500' },
    { key: 'capitalization', label: 'Capitalization / \u5927\u5C0F\u5199', color: '#007AFF' },
    { key: 'spelling', label: 'Spelling / \u62FC\u5199', color: '#FF3B30' },
    { key: 'punctuation', label: 'Punctuation / \u6807\u70B9', color: '#AF52DE' }
  ];

  var totalErrors = 0;
  for (var i = 0; i < categories.length; i++) {
    totalErrors += errors[categories[i].key];
  }

  if (totalErrors === 0) {
    return '<div class="typing-error-dist"><div class="typing-error-none">No errors \u2014 perfect!</div></div>';
  }

  var maxCount = Math.max(errors.spacing, errors.capitalization, errors.spelling, errors.punctuation, 1);
  var errorRate = (totalErrors / totalChars * 100).toFixed(1);

  var rows = [];
  rows.push('<div class="typing-error-dist"><div class="typing-error-dist-title">Error Distribution / \u9519\u8BEF\u5206\u5E03</div>');

  for (var j = 0; j < categories.length; j++) {
    var cat = categories[j];
    var count = errors[cat.key];
    var width = count / maxCount * 100;
    rows.push([
      '<div class="typing-error-row">',
      '<span class="typing-error-label">', cat.label, '</span>',
      '<div class="typing-error-bar-wrap">',
      '<div class="typing-error-bar" style="width:', width.toFixed(0), '%; background:', cat.color, ';"></div>',
      '</div>',
      '<span class="typing-error-count">', count, '</span>',
      '</div>'
    ].join(''));
  }

  rows.push('<div class="typing-error-total">Total: ' + totalErrors + ' error' + (totalErrors !== 1 ? 's' : '') + ' (' + errorRate + '%)</div>');
  rows.push('</div>');

  return rows.join('');
}

function formatDuration(ms) {
  var totalSeconds = Math.floor(ms / 1000);
  var m = Math.floor(totalSeconds / 60);
  var s = totalSeconds % 60;
  return m + ':' + (s < 10 ? '0' : '') + s;
}

function escapeHtml(str) {
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
