import { loadHistory, loadBest } from '../utils/storage.js';

var DIFFICULTIES = ['beginner', 'intermediate', 'advanced'];
var LABELS = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' };
var COLORS = { beginner: '#34C759', intermediate: '#FF9500', advanced: '#FF5252' };

export function renderProgressPanel(container, ctx) {
  var onBack = ctx.onBack;
  var history = loadHistory();
  var best = loadBest();
  var selected = 'beginner';

  var wrapper = document.createElement('div');
  wrapper.className = 'typing-progress';

  var header = document.createElement('div');
  header.className = 'typing-progress-header';
  header.innerHTML = '<button class="typing-back-btn">\u2190 Back</button>';
  wrapper.appendChild(header);

  var tabs = document.createElement('div');
  tabs.className = 'typing-progress-tabs';
  wrapper.appendChild(tabs);

  var chartWrap = document.createElement('div');
  chartWrap.className = 'typing-progress-chart';
  wrapper.appendChild(chartWrap);

  var tableWrap = document.createElement('div');
  tableWrap.className = 'typing-progress-table';
  wrapper.appendChild(tableWrap);

  container.appendChild(wrapper);

  header.querySelector('.typing-back-btn').addEventListener('click', onBack);

  function getRecords(diff) {
    return history.filter(function (r) { return r.difficulty === diff; });
  }

  function render() {
    var records = getRecords(selected);
    renderTabs(tabs, selected, best, function (diff) {
      selected = diff;
      render();
    });
    renderChart(chartWrap, records);
    renderTable(tableWrap, records);
  }

  render();
}

function renderTabs(container, selected, best, onSwitch) {
  container.innerHTML = '';
  DIFFICULTIES.forEach(function (diff) {
    var tab = document.createElement('div');
    tab.className = 'typing-progress-tab';
    if (diff === selected) tab.classList.add('active');
    tab.style.setProperty('--tab-color', COLORS[diff]);

    var dot = document.createElement('span');
    dot.className = 'typing-progress-tab-dot';
    dot.style.backgroundColor = COLORS[diff];

    var label = document.createElement('span');
    label.className = 'typing-progress-tab-label';
    label.textContent = LABELS[diff];

    var stats = document.createElement('div');
    stats.className = 'typing-progress-tab-stats';

    var entry = best[diff] || {};
    var wpmStr = entry.bestNetWpm ? entry.bestNetWpm.toFixed(1) + ' WPM' : '-- WPM';
    var accStr = entry.bestAccuracy ? entry.bestAccuracy.toFixed(1) + '%' : '--';
    var cntStr = (entry.historyCount || 0) + ' practice' + (entry.historyCount !== 1 ? 's' : '');

    stats.innerHTML = [
      '<span class="typing-progress-tab-stat typing-progress-tab-stat-main">' + wpmStr + '</span>',
      '<span class="typing-progress-tab-stat">' + accStr + '</span>',
      '<span class="typing-progress-tab-stat">' + cntStr + '</span>'
    ].join('');

    tab.appendChild(dot);
    tab.appendChild(label);
    tab.appendChild(stats);
    tab.addEventListener('click', function () { onSwitch(diff); });
    container.appendChild(tab);
  });
}

function renderChart(container, records) {
  if (records.length < 2) {
    container.innerHTML = '<div class="typing-progress-empty">' +
      (records.length === 0
        ? 'No data yet. Complete a practice to see your progress.'
        : 'Complete one more practice to see your progress chart.') +
      '</div>';
    return;
  }

  var wpmValues = records.map(function (r) { return r.netWpm; });
  var maxWpm = Math.max.apply(null, wpmValues) + 5;
  var minWpm = Math.max(0, Math.min.apply(null, wpmValues) - 5);
  var n = records.length;

  var W = 500;
  var H = 200;
  var padT = 20;
  var padB = 28;
  var padL = 44;
  var padR = 16;
  var pw = W - padL - padR;
  var ph = H - padT - padB;

  function xf(i) { return padL + (i / (n - 1)) * pw; }
  function yf(v) { return padT + (1 - (v - minWpm) / (maxWpm - minWpm)) * ph; }

  var svgParts = ['<svg viewBox="0 0 ' + W + ' ' + H + '" class="typing-chart-svg">'];

  for (var g = 0; g <= 3; g++) {
    var gy = padT + (g / 3) * ph;
    var val = Math.round(maxWpm - (g / 3) * (maxWpm - minWpm));
    svgParts.push('<line x1="' + padL + '" y1="' + gy + '" x2="' + (W - padR) + '" y2="' + gy + '" stroke="#e5e5e7" stroke-dasharray="4,4"/>');
    svgParts.push('<text x="' + (padL - 6) + '" y="' + (gy + 4) + '" class="typing-chart-label" text-anchor="end">' + val + '</text>');
  }

  var pts = [];
  for (var i = 0; i < n; i++) {
    pts.push(xf(i) + ',' + yf(records[i].netWpm));
  }
  var areaPts = pts.concat([xf(n - 1) + ',' + (padT + ph), xf(0) + ',' + (padT + ph)]);

  svgParts.push('<polygon points="' + areaPts.join(' ') + '" fill="rgba(0,128,128,0.08)"/>');
  svgParts.push('<polyline points="' + pts.join(' ') + '" fill="none" stroke="#008080" stroke-width="2" stroke-linejoin="round"/>');

  for (var j = 0; j < n; j++) {
    svgParts.push('<circle cx="' + xf(j) + '" cy="' + yf(records[j].netWpm) + '" r="4.5" fill="#fff" stroke="#008080" stroke-width="2"/>');
  }

  for (var k = 0; k < n; k++) {
    svgParts.push('<text x="' + xf(k) + '" y="' + (H - 8) + '" class="typing-chart-label" text-anchor="middle">' + (k + 1) + '</text>');
  }

  svgParts.push('</svg>');

  container.innerHTML = '<div class="typing-progress-chart-title">Net WPM Trend</div>' + svgParts.join('');
}

function renderTable(container, records) {
  container.innerHTML = '';

  if (records.length === 0) {
    var empty = document.createElement('div');
    empty.className = 'typing-progress-empty';
    empty.textContent = 'No records yet';
    container.appendChild(empty);
    return;
  }

  var title = document.createElement('div');
  title.className = 'typing-progress-table-title';
  title.textContent = 'Recent History';
  container.appendChild(title);

  var table = document.createElement('table');
  table.className = 'typing-history-table';
  table.innerHTML = [
    '<thead><tr>',
    '<th>Title</th><th>WPM</th><th>Accuracy</th><th>Time</th><th>Date</th>',
    '</tr></thead>',
    '<tbody></tbody>'
  ].join('');

  var tbody = table.querySelector('tbody');
  var recent = records.slice().reverse();
  for (var i = 0; i < recent.length; i++) {
    var r = recent[i];
    var row = document.createElement('tr');
    row.innerHTML = [
      '<td class="typing-history-title">' + escapeHtml(r.title) + '</td>',
      '<td>' + r.netWpm.toFixed(1) + '</td>',
      '<td>' + r.accuracy.toFixed(1) + '%</td>',
      '<td>' + formatTime(r.timeSpent) + '</td>',
      '<td class="typing-history-date">' + formatDate(r.completedAt) + '</td>'
    ].join('');
    tbody.appendChild(row);
  }

  container.appendChild(table);
}

function formatTime(sec) {
  var m = Math.floor(sec / 60);
  var s = sec % 60;
  return m + ':' + (s < 10 ? '0' : '') + s;
}

function formatDate(iso) {
  var d = new Date(iso);
  return d.getFullYear() + '-' +
    ('0' + (d.getMonth() + 1)).slice(-2) + '-' +
    ('0' + d.getDate()).slice(-2);
}

function escapeHtml(str) {
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
