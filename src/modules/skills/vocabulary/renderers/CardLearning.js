var QUIZ_RATIOS = {
  reading: { 'lookup-zh': 0.50, 'lookup-en': 0.30, 'spell': 0.20 },
  writing: { 'spell': 0.45, 'lookup-en': 0.30, 'lookup-zh': 0.25 }
};

import { renderWordDetail } from './WordDetail.js';

function pickQuizType(subject) {
  var ratios = QUIZ_RATIOS[subject] || QUIZ_RATIOS.reading;
  var rand = Math.random();
  var cum = 0;
  for (var type in ratios) {
    cum += ratios[type];
    if (rand <= cum) return type;
  }
  return 'lookup-zh';
}

function shuffleOptions(correct, allWords, fullBank) {
  var pool = allWords.filter(function (w) { return w.id !== correct.id; });
  var shuffled = [correct];
  for (var i = pool.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
  for (var k = 0; k < pool.length && shuffled.length < 4; k++) { shuffled.push(pool[k]); }
  // Fallback to full bank
  if (fullBank && shuffled.length < 4) {
    var bankPool = fullBank.filter(function (w) { return w.id !== correct.id && !pool.some(function (p) { return p.id === w.id; }); });
    for (var bi = bankPool.length - 1; bi > 0; bi--) { var bj = Math.floor(Math.random() * (bi + 1)); var bt = bankPool[bi]; bankPool[bi] = bankPool[bj]; bankPool[bj] = bt; }
    for (var bk = 0; bk < bankPool.length && shuffled.length < 4; bk++) { shuffled.push(bankPool[bk]); }
  }
  // Shuffle final
  for (var si = shuffled.length - 1; si > 0; si--) { var sj = Math.floor(Math.random() * (si + 1)); var st = shuffled[si]; shuffled[si] = shuffled[sj]; shuffled[sj] = st; }
  return shuffled;
}

function shuffleMeaningOptions(correctWord, queue, fullBank) {
  // Try queue first, then full bank for remaining slots
  var pool = queue.filter(function (w) { return w.id !== correctWord.id; });
  var correctText = formatWordMeaning(correctWord);
  var options = [{ id: correctWord.id, text: correctText, correct: true }];
  // Shuffle queue pool
  for (var i = pool.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
  for (var k = 0; k < pool.length && options.length < 4; k++) {
    options.push({ id: pool[k].id, text: formatWordMeaning(pool[k]), correct: false });
  }
  // Fallback to full bank
  if (fullBank && options.length < 4) {
    var bankPool = fullBank.filter(function (w) { return w.id !== correctWord.id && !pool.some(function (p) { return p.id === w.id; }); });
    for (var bi = bankPool.length - 1; bi > 0; bi--) { var bj = Math.floor(Math.random() * (bi + 1)); var bt = bankPool[bi]; bankPool[bi] = bankPool[bj]; bankPool[bj] = bt; }
    for (var bk = 0; bk < bankPool.length && options.length < 4; bk++) {
      options.push({ id: bankPool[bk].id, text: formatWordMeaning(bankPool[bk]), correct: false });
    }
  }
  // Shuffle final options
  for (var si = options.length - 1; si > 0; si--) { var sj = Math.floor(Math.random() * (si + 1)); var st = options[si]; options[si] = options[sj]; options[sj] = st; }
  return options;
}

function formatWordMeaning(word) {
  var meaning = word.pos && word.pos[0] ? word.pos[0].translation || word.pos[0].chinese : '';
  if (meaning) {
    var t = meaning;
    // Only take first 3 translations (separated by ；or ;)
    var parts = t.split(/[；;]/);
    return parts.slice(0, 2).join('；');
  }
  return word.word;
}

export function renderCardLearning(container, state, callbacks) {
  container.innerHTML = '';

  var word = state.currentWord;
  if (!word || !state.queue || state.queue.length === 0) { callbacks.onComplete(); return; }

  var subject = state.subject;
  var fullBank = state.wordData && state.wordData[subject] ? state.wordData[subject] : null;
  var quizType = state.currentQuizType || pickQuizType(subject);

  var wrapper = document.createElement('div');
  wrapper.className = 'vocab-card-learning';

  // Header row with back button
  var header = document.createElement('div');
  header.className = 'vocab-setlist-header';
  header.innerHTML = [
    callbacks.onBack ? '<button class="vocab-back-btn" id="card-back"><i class="fas fa-arrow-left"></i> \u8FD4\u56DE</button>' : '',
    '<span style="flex:1;font-size:16px;font-weight:600;">' + state.subjectLabel + ' \u00B7 Set ' + state.setId + '</span>',
    '<span style="font-size:14px;color:var(--muted,#86868b)">' + (state.currentIndex + 1) + '/' + state.queueLength + '</span>'
  ].join('');
  wrapper.appendChild(header);

  if (callbacks.onBack) {
    header.querySelector('#card-back').addEventListener('click', callbacks.onBack);
  }

  var card = document.createElement('div');
  card.className = 'vocab-card';

  if (quizType === 'lookup-zh') {
    renderLookupZh(card, word, state.queue, fullBank);
  } else if (quizType === 'lookup-en') {
    renderLookupEn(card, word, subject, state.queue, fullBank);
  } else if (quizType === 'spell') {
    renderSpell(card, word);
  }
  card._vocabWord = word;  // Store for detail button

  wrapper.appendChild(card);
  container.appendChild(wrapper);
}

function renderLookupZh(container, word, queue, fullBank) {
  var options = shuffleMeaningOptions(word, queue, fullBank);
  var ipa = word.pronunciation && word.pronunciation.us ? word.pronunciation.us : '';

  container.innerHTML = [
    '<div class="card-word-display">' + word.word + '</div>',
    ipa ? '<div class="card-pronunciation"><span class="card-ipa">' + ipa + '</span></div>' : '',
    '<div class="card-options" id="card-options">',
    options.map(function (opt) {
      return '<div class="card-option" data-word-id="' + opt.id + '" data-correct="' + (opt.correct ? 'true' : 'false') + '">' +
        opt.text + '</div>';
    }).join(''),
    '</div>'
  ].join('');

  container.querySelectorAll('.card-option').forEach(function (el) {
    el.addEventListener('click', function () {
      var correct = el.dataset.correct === 'true';
      container.querySelectorAll('.card-option').forEach(function (o) { o.style.pointerEvents = 'none'; });
      if (correct) {
        el.classList.add('correct');
      } else {
        el.classList.add('wrong');
        container.querySelector('.card-option[data-correct="true"]').classList.add('correct');
      }
      showEvalButtons(container, correct);
    });
  });
}

function renderLookupEn(container, word, subject, queue, fullBank) {
  var options = shuffleOptions(word, queue, fullBank);
  container.innerHTML = [
    '<div class="card-hint">',
    '<span class="card-pos">' + (word.pos && word.pos[0] ? word.pos[0].type : '') + '</span>',
    '<span class="card-meaning">' + (word.pos && word.pos[0] ? word.pos[0].translation || word.pos[0].chinese : '') + '</span>',
    '</div>',
    '<div class="card-options" id="card-options">',
    options.map(function (opt) {
      return '<div class="card-option" data-word-id="' + opt.id + '">' + opt.word + '</div>';
    }).join(''),
    '</div>'
  ].join('');

  container.querySelectorAll('.card-option').forEach(function (el) {
    el.addEventListener('click', function () {
      container.querySelectorAll('.card-option').forEach(function (o) { o.style.pointerEvents = 'none'; });
      if (el.dataset.wordId === word.id) {
        el.classList.add('correct');
        showEvalButtons(container, true);
      } else {
        el.classList.add('wrong');
        container.querySelector('.card-option[data-word-id="' + word.id + '"]').classList.add('correct');
        showEvalButtons(container, false);
      }
    });
  });
}

function renderSpell(container, word) {
  var posLabel = word.pos && word.pos[0] ? word.pos[0].type + '. ' : '';
  var meaning = word.pos && word.pos[0] ? word.pos[0].translation || word.pos[0].chinese : '';

  var allExamples = [word.example, ...(word.altExamples || [])].filter(Boolean);
  var allExamplesCn = [word.example_cn || '', ...(word.altExamples_cn || [])];
  var currentExampleIndex = 0;

  function splitSentence(sentence) {
    var escaped = word.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var regex = new RegExp('\\b' + escaped + '\\b', 'i');
    var match = sentence.match(regex);
    if (match) {
      return { before: sentence.substring(0, match.index), after: sentence.substring(match.index + match[0].length) };
    }
    return { before: '', after: sentence };
  }

  var prevEval = container.querySelector('.card-evaluation');
  if (prevEval) prevEval.remove();

  var target = word.word;
  var inputWidth = Math.max(target.length + 3, 5);

  container.innerHTML = [
    '<div class="spell-hints">',
    posLabel ? '<span class="spell-pos">' + posLabel + '</span>' : '',
    meaning ? '<span class="spell-meaning">' + meaning + '</span>' : '',
    allExamples.length > 1 ? '<button class="spell-sentence-toggle" id="sentence-toggle">\u4E0B\u4E00\u53E5</button>' : '',
    '</div>',
    '<div class="spell-sentence">',
    '<span class="spell-before" id="spell-before"></span>',
    '<input type="text" class="spell-input-inline" id="spell-inline" autocomplete="off" autocorrect="off" spellcheck="false" maxlength="30" placeholder="\u00B7\u00B7\u00B7" style="width:' + inputWidth + 'ch">',
    '<span class="spell-after" id="spell-after"></span>',
    '</div>',
    '<div class="spell-sentence-cn" id="spell-cn"></div>',
    '<div class="spell-result" id="spell-result" style="display:none"></div>',
    '<button class="spell-confirm-btn" id="spell-confirm">\u786E\u5B9A</button>'
  ].join('');

  var beforeSpan = container.querySelector('#spell-before');
  var afterSpan = container.querySelector('#spell-after');
  var cnSpan = container.querySelector('#spell-cn');

  function updateSentence(index) {
    var sentence = allExamples[index % allExamples.length];
    var parts = splitSentence(sentence);
    beforeSpan.textContent = parts.before;
    afterSpan.textContent = parts.after;
    cnSpan.textContent = allExamplesCn[index % allExamplesCn.length] || '';
  }

  updateSentence(0);

  var toggleBtn = container.querySelector('#sentence-toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', function () {
      currentExampleIndex = (currentExampleIndex + 1) % allExamples.length;
      updateSentence(currentExampleIndex);
    });
  }

  var input = container.querySelector('#spell-inline');
  var confirmBtn = container.querySelector('#spell-confirm');
  var resultDiv = container.querySelector('#spell-result');
  var answered = false;

  function submitAnswer() {
    if (answered) return;
    answered = true;
    input.disabled = true;
    confirmBtn.style.display = 'none';

    var userInput = input.value.trim();
    var isCorrect = userInput.toLowerCase() === target.toLowerCase();

    if (isCorrect) {
      input.style.background = '#e8f5e9';
      input.style.color = '#2e7d32';
      setTimeout(function () { showEvalButtons(container, true); }, 300);
    } else {
      input.style.background = '#fce4ec';
      input.style.color = '#c62828';
      renderCorrectAnswer(resultDiv, target, userInput);
      showEvalButtons(container, false);
    }
  }

  // Auto-submit on correct full word
  input.addEventListener('input', function () {
    if (answered) return;
    if (input.value.trim().toLowerCase() === target.toLowerCase()) {
      submitAnswer();
    }
  });

  // Confirm button
  confirmBtn.addEventListener('click', function () {
    if (answered) return;
    submitAnswer();
  });

  // Enter key also submits
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !answered) {
      e.preventDefault();
      submitAnswer();
    }
  });
}

function escapeHTML(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderCorrectAnswer(element, targetWord, userInput) {
  var maxLen = Math.max(targetWord.length, userInput.length);
  var html = '<div class="spell-answer-label">\u6B63\u786E\u7B54\u6848\uff1A</div><div class="spell-answer-letters">';
  for (var i = 0; i < maxLen; i++) {
    var tc = targetWord[i] || '';
    var uc = userInput[i] || '';
    var match = tc.toLowerCase() === uc.toLowerCase();
    html += '<span class="spell-letter ' + (match ? 'spell-letter-ok' : 'spell-letter-bad') + '">' + tc + '</span>';
  }
  html += '</div>';
  element.innerHTML = html;
  element.style.display = 'block';
}

function showEvalButtons(container, quizCorrect) {
  var evalDiv = document.createElement('div');
  evalDiv.className = 'card-evaluation';
  evalDiv.innerHTML = [
    '<div class="eval-actions">',
    '<button class="eval-btn eval-btn-forgot" data-q="1">\u4E0D\u8BA4\u8BC6</button>',
    '<button class="eval-btn eval-btn-hazy" data-q="3">\u6A21\u7CCA</button>',
    '<button class="eval-btn eval-btn-known" data-q="5">\u8BB0\u4F4F</button>',
    '</div>',
    '<button class="eval-detail-btn" id="eval-detail-btn">\u8BE6\u60C5</button>'
  ].join('');
  container.appendChild(evalDiv);

  // Get current word from card element (stored by render functions)
  var cardEl = container.closest('.vocab-card');
  var currentWord = cardEl && cardEl._vocabWord ? cardEl._vocabWord : null;

  // Detail button — open WordDetail overlay
  evalDiv.querySelector('#eval-detail-btn').addEventListener('click', function (e) {
    e.stopPropagation();
    if (currentWord) renderWordDetail(null, currentWord, {});
  });

  // Eval buttons
  var wordId = currentWord ? currentWord.id : null;
  evalDiv.querySelectorAll('.eval-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var q = parseInt(btn.dataset.q, 10);
      var evt = new CustomEvent('word-eval', {
        bubbles: true,
        detail: { wordId: wordId, q: q }
      });
      container.dispatchEvent(evt);
    });
  });
}
