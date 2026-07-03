import { playWord } from '../utils/speech.js';
import { renderWordDetail } from './WordDetail.js';

export function renderAudioLearning(container, state, callbacks) {
  container.innerHTML = '';

  var word = state.currentWord;
  if (!word || !state.queue || state.queue.length === 0) { callbacks.onComplete(); return; }

  var options = getOptions(word, state.queue, state.wordData && state.wordData[state.subject] || null);

  var wrapper = document.createElement('div');
  wrapper.className = 'vocab-audio-learn';

  // Header with back button
  wrapper.innerHTML = [
    '<div class="vocab-setlist-header">',
    callbacks.onBack ? '<button class="vocab-back-btn" id="audio-back"><i class="fas fa-arrow-left"></i> \u8FD4\u56DE</button>' : '',
    '<span style="flex:1;font-size:16px;font-weight:600;">' + state.subjectLabel + ' \u00B7 Set ' + state.setId + '</span>',
    '<span style="font-size:14px;color:var(--muted,#86868b)">' + (state.currentIndex + 1) + '/' + state.queueLength + '</span>',
    '</div>',
    '<div class="audio-play-area">',
    '<button class="audio-play-btn" id="audio-play-btn">',
    '<i class="fas fa-play"></i>',
    '</button>',
    '<div class="audio-word-label">\u70B9\u51FB\u64AD\u653E\u6309\u94AE\u542C\u53D6\u53D1\u97F3</div>',
    '</div>',
    '<div class="audio-options" id="audio-options">',
    options.map(function (opt) {
      return '<div class="audio-option" data-word-id="' + opt.id + '" data-correct="' + (opt.correct ? 'true' : 'false') + '">' +
        opt.text + '</div>';
    }).join(''),
    '</div>'
  ].join('');

  container.appendChild(wrapper);

  // Back button
  if (callbacks.onBack) {
    var backBtn = wrapper.querySelector('#audio-back');
    if (backBtn) backBtn.addEventListener('click', callbacks.onBack);
  }

  var playBtn = wrapper.querySelector('#audio-play-btn');
  var played = false;

  playBtn.addEventListener('click', function () {
    playWord(word.word, state.preferredAccent || 'us');
    playBtn.querySelector('i').className = 'fas fa-volume-up';
    played = true;
  });

  wrapper._vocabWord = word;  // Store for detail button

  // Options area
  wrapper.querySelectorAll('.audio-option').forEach(function (el) {
    el.addEventListener('click', function () {
      wrapper.querySelectorAll('.audio-option').forEach(function (o) { o.style.pointerEvents = 'none'; });
      var correct = el.dataset.correct === 'true';
      if (correct) {
        el.classList.add('correct');
      } else {
        el.classList.add('wrong');
        wrapper.querySelector('.audio-option[data-correct="true"]').classList.add('correct');
      }
      showAudioEval(wrapper, correct);
    });
  });
}

function getOptions(correctWord, queue, fullBank) {
  var pool = queue.filter(function (w) { return w.id !== correctWord.id; });
  var shuffled = [{ id: correctWord.id, text: formatOption(correctWord), correct: true }];
  for (var i = pool.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
  for (var k = 0; k < pool.length && shuffled.length < 4; k++) {
    shuffled.push({ id: pool[k].id, text: formatOption(pool[k]), correct: false });
  }
  if (fullBank && shuffled.length < 4) {
    var bankPool = fullBank.filter(function (w) { return w.id !== correctWord.id && !pool.some(function (p) { return p.id === w.id; }); });
    for (var bi = bankPool.length - 1; bi > 0; bi--) { var bj = Math.floor(Math.random() * (bi + 1)); var bt = bankPool[bi]; bankPool[bi] = bankPool[bj]; bankPool[bj] = bt; }
    for (var bk = 0; bk < bankPool.length && shuffled.length < 4; bk++) {
      shuffled.push({ id: bankPool[bk].id, text: formatOption(bankPool[bk]), correct: false });
    }
  }
  for (var si = shuffled.length - 1; si > 0; si--) { var sj = Math.floor(Math.random() * (si + 1)); var st = shuffled[si]; shuffled[si] = shuffled[sj]; shuffled[sj] = st; }
  return shuffled;
}

function formatOption(word) {
  var pos = word.pos && word.pos[0] ? word.pos[0].type + '. ' : '';
  var meaning = word.pos && word.pos[0] ? (word.pos[0].translation || word.pos[0].chinese) : word.word;
  return meaning ? (pos + meaning) : ('\u2014 ' + word.word);
}

function showAudioEval(container, quizCorrect) {
  var evalDiv = document.createElement('div');
  evalDiv.className = 'card-evaluation';
  evalDiv.innerHTML = [
    '<div class="eval-actions">',
    '<button class="eval-btn eval-btn-forgot" data-q="1">\u4E0D\u8BA4\u8BC6</button>',
    '<button class="eval-btn eval-btn-hazy" data-q="3">\u6A21\u7CCA</button>',
    '<button class="eval-btn eval-btn-known" data-q="5">\u8BB0\u4F4F</button>',
    '</div>',
    '<button class="eval-detail-btn" id="audio-detail-btn">\u8BE6\u60C5</button>'
  ].join('');
  container.appendChild(evalDiv);

  // Detail button
  var currentWord = container._vocabWord;
  evalDiv.querySelector('#audio-detail-btn').addEventListener('click', function (e) {
    e.stopPropagation();
    if (currentWord) renderWordDetail(null, currentWord, {});
  });

  evalDiv.querySelectorAll('.eval-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var q = parseInt(btn.dataset.q, 10);
      var evt = new CustomEvent('word-eval', { bubbles: true, detail: { q: q } });
      container.dispatchEvent(evt);
    });
  });
}
