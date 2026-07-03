import { playWord } from '../utils/speech.js';

export function renderWordDetail(container, word, callbacks) {
  var existing = document.querySelector('.vocab-detail-overlay');
  if (existing) existing.remove();

  var overlay = document.createElement('div');
  overlay.className = 'vocab-detail-overlay';

  var w = normalizeWordData(word);

  var hasPos = (w.pos || []).length > 0;
  var hasInfl = hasInflections(w);
  var hasEty = hasEtymology(w);
  var hasExample = w.example || (w.altExamples && w.altExamples.length);

  overlay.innerHTML = [
    '<div class="detail-overlay-backdrop"></div>',
    '<div class="detail-overlay-card">',
    '<div class="detail-card-header">',
    '<button class="detail-close-btn" id="detail-close"><i class="fas fa-times"></i></button>',
    '</div>',
    '<div class="detail-word">' + (w.word || '') + '</div>',
    '<div class="detail-pronunciation">',
    '<span class="detail-ipa">US ' + (w.pronunciation && w.pronunciation.us || '') + '</span>' +
    '<button class="detail-speak-btn" data-accent="us"><i class="fas fa-volume-up"></i></button>',
    '<span class="detail-ipa">UK ' + (w.pronunciation && w.pronunciation.uk || '') + '</span>' +
    '<button class="detail-speak-btn" data-accent="uk"><i class="fas fa-volume-up"></i></button>',
    '</div>',
    hasPos ? '<div class="detail-separator"></div><div class="detail-pos">' +
      (w.pos || []).map(function (p) {
        var type = p.type || '';
        var label = type === 'adj' ? 'adj.' : type === 'v' ? 'v.' : type === 'n' ? 'n.' :
          type === 'adv' ? 'adv.' : type === 'prep' ? 'prep.' : (type ? type + '.' : '');
        return '<div class="detail-pos-item"><span class="pos-type">' + label + '</span> ' + (p.translation || '') + '</div>';
      }).join('') + '</div>' : '',
    hasInfl ? '<div class="detail-separator"></div><div class="detail-inflections">' +
      '<h4>\u8BCD\u5F62\u53D8\u5316</h4>' +
      renderInflections(w.inflections) + '</div>' : '',
    hasEty ? '<div class="detail-separator"></div><div class="detail-etymology">' +
      '<h4>\u8BCD\u6839\u8BCD\u7F00\u62C6\u89E3</h4>' +
      renderEtymology(w.etymology) + '</div>' : '',
    hasExample ?
      '<div class="detail-separator"></div><div class="detail-example"><h4>\u4F8B\u53E5</h4>' +
      renderExample(w.example, w.example_cn) +
      (w.altExamples || []).map(function (ex, i) {
        var cn = w.altExamples_cn && w.altExamples_cn[i] ? w.altExamples_cn[i] : '';
        return renderExample(ex, cn);
      }).join('') +
      (w.source ? '<span class="detail-source">' + w.source + '</span>' : '') + '</div>' : ''
  ].join('');

  document.body.appendChild(overlay);

  function closeOverlay() {
    overlay.remove();
    if (callbacks && callbacks.onClose) callbacks.onClose();
  }

  overlay.querySelector('#detail-close').addEventListener('click', closeOverlay);
  overlay.querySelector('.detail-overlay-backdrop').addEventListener('click', closeOverlay);

  overlay.querySelectorAll('.detail-speak-btn').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      playWord(w.word, btn.dataset.accent);
    });
  });
}

function normalizeWordData(word) {
  var w = {};
  for (var k in word) w[k] = word[k];

  if (w.pos) {
    w.pos = w.pos.map(function (p) {
      return { type: p.type || '', translation: p.translation || p.chinese || p.meaning || '' };
    });
  }

  if (typeof w.etymology === 'string') {
    w.etymology = { prefix: null, root: null, suffix: null, summary: w.etymology };
  }
  if (w.etymology && typeof w.etymology === 'object') {
    var e = w.etymology;
    ['prefix', 'root', 'suffix'].forEach(function (key) {
      if (e[key]) {
        if (typeof e[key] === 'string') {
          e[key] = { form: e[key], meaning: '' };
        } else if (typeof e[key] === 'object') {
          var item = e[key];
          item.form = item.form || item.text || '';
          item.meaning = item.meaning || item.origin || '';
        }
      }
    });
    e.summary = e.summary || e.summary_cn || '';
  }

  return w;
}

function hasInflections(word) {
  if (!word.inflections) return false;
  if (Array.isArray(word.inflections)) {
    return word.inflections.length > 0;
  }
  var keys = Object.keys(word.inflections);
  for (var i = 0; i < keys.length; i++) {
    var v = word.inflections[keys[i]];
    if (v && typeof v === 'string' && v.trim()) return true;
  }
  return false;
}

function renderInflections(inflections) {
  if (!inflections) return '';
  if (Array.isArray(inflections)) {
    var labels = ['\u57FA\u672C\u5F62', '\u7B2C\u4E09\u4EBA\u79F0', '\u8FC7\u53BB\u5F0F', '\u73B0\u5728\u5206\u8BCD'];
    return inflections.map(function (v, i) {
      var label = i < labels.length ? labels[i] : '\u5F62\u5F0F';
      return inf(v, label);
    }).join('');
  }

  var ordered = [
    { key: 'base', label: '\u57FA\u672C\u5F62' },
    { key: 'singular', label: '\u5355\u6570' },
    { key: 'plural', label: '\u590D\u6570' },
    { key: 'third', label: '\u7B2C\u4E09\u4EBA\u79F0' },
    { key: 'past', label: '\u8FC7\u53BB\u5F0F' },
    { key: 'present', label: '\u73B0\u5728\u5206\u8BCD' },
    { key: 'pastParticiple', label: '\u8FC7\u53BB\u5206\u8BCD' },
    { key: 'comparative', label: '\u6BD4\u8F83\u7EA7' },
    { key: 'superlative', label: '\u6700\u9AD8\u7EA7' },
    { key: 'adverb', label: '\u526F\u8BCD' },
    { key: 'noun', label: '\u540D\u8BCD' },
    { key: 'adjective', label: '\u5F62\u5BB9\u8BCD' }
  ];

  var parts = [];
  for (var i = 0; i < ordered.length; i++) {
    var val = inflections[ordered[i].key];
    if (val && typeof val === 'string' && val.trim()) {
      parts.push(inf(val, ordered[i].label));
    }
  }
  return parts.join('');
}

function inf(value, label) {
  return '<div class="inflection-item"><span class="inflection-label">' + label + '</span> ' + value + '</div>';
}

function renderExample(en, cn) {
  var parts = [];
  if (en) parts.push('<p class="detail-example-en">' + en + '</p>');
  if (cn) parts.push('<p class="detail-example-cn">' + cn + '</p>');
  return parts.join('');
}

function hasEtymology(word) {
  if (!word.etymology) return false;
  if (typeof word.etymology === 'string') return word.etymology.trim() !== '';
  var e = word.etymology;
  return !!(e.prefix || e.root || e.suffix || e.summary || e.summary_cn);
}

function renderEtymology(etymology) {
  var parts = [];
  var items = [
    { key: 'prefix', label: '\u524D\u7F00' },
    { key: 'root', label: '\u8BCD\u6839' },
    { key: 'suffix', label: '\u540E\u7F00' }
  ];

  for (var i = 0; i < items.length; i++) {
    var item = etymology[items[i].key];
    if (item && typeof item === 'object') {
      var form = item.form || item.text || '';
      var meaning = item.meaning || item.origin || '';
      parts.push('<div class="etymology-item"><span class="etymo-form">' + form + '</span> <span class="etymo-type">[' + items[i].label + ']</span> <span class="etymo-meaning">' + meaning + '</span></div>');
    }
  }

  if (typeof etymology === 'string') {
    parts.push('<div class="etymology-summary">' + etymology + '</div>');
  } else {
    var summary = etymology.summary || etymology.summary_cn || '';
    if (summary) {
      parts.push('<div class="etymology-summary">' + summary + '</div>');
    }
  }

  return parts.join('');
}
