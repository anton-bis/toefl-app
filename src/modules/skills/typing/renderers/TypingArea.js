import { createTimer } from '../utils/timer.js';

export function renderTypingArea(container, ctx) {
  var article = ctx.article;
  var onComplete = ctx.onComplete;
  var onBack = ctx.onBack;
  var maxSeconds = ctx.maxSeconds;

  var chars = initChars(article.content);
  var currentIndex = 0;
  var disposed = false;
  var paused = false;

  var wrapper = document.createElement('div');
  wrapper.className = 'typing-area';

  var header = document.createElement('div');
  header.className = 'typing-area-header';

  var headerHTML = [
    '<div class="typing-header-top">',
    '<button class="typing-back-btn">\u2190 Back</button>',
    '<div class="typing-header-controls">',
    '<button class="typing-control-btn typing-retry-btn">\u21BB Retry</button>',
    '<button class="typing-control-btn typing-pause-btn">\u23F8 Pause</button>',
    '<span class="typing-timer"></span>',
    '</div>',
    '</div>',
    '<div class="typing-header-sub">',
    escapeHtml(article.title),
    '</div>'
  ];
  header.innerHTML = headerHTML.join('');

  var timerEl = header.querySelector('.typing-timer');
  var pauseBtn = header.querySelector('.typing-pause-btn');
  var retryBtn = header.querySelector('.typing-retry-btn');

  var textDisplay = document.createElement('div');
  textDisplay.className = 'typing-text-display';
  renderChars(textDisplay, chars, currentIndex);

  var timer = createTimer(
    function (timeStr) {
      timerEl.textContent = timeStr;
    },
    function () {
      if (disposed) return;
      finishTyping();
    },
    maxSeconds
  );

  timerEl.textContent = timer.getInitialDisplay();

  function updateCharSpan(index) {
    var span = document.querySelector('.typing-text-display [data-index="' + index + '"]');
    if (!span) return;
    span.className = 'char char-' + chars[index].status;
  }

  function updateCurrentCursor(prevIndex, newIndex) {
    var prevSpan = document.querySelector('.typing-text-display [data-index="' + prevIndex + '"]');
    if (prevSpan) prevSpan.classList.remove('char-current');
    var newSpan = document.querySelector('.typing-text-display [data-index="' + newIndex + '"]');
    if (newSpan) newSpan.classList.add('char-current');
  }

  function finishTyping() {
    cleanup();
    var correctCount = chars.filter(function (c) { return c.status === 'correct'; }).length;
    var incorrectCount = chars.filter(function (c) { return c.status === 'incorrect'; }).length;
    onComplete({
      article: article,
      chars: chars,
      correctCount: correctCount,
      incorrectCount: incorrectCount,
      totalChars: chars.length,
      timeSpent: timer.getElapsed()
    });
  }

  function checkComplete() {
    if (currentIndex >= chars.length) {
      finishTyping();
    }
  }

  function processChar(key) {
    if (currentIndex >= chars.length) return;
    if (!timer.isStarted()) timer.start();
    chars[currentIndex].status = (key === chars[currentIndex].expected) ? 'correct' : 'incorrect';
    var prevI = currentIndex;
    currentIndex++;
    updateCharSpan(prevI);
    updateCurrentCursor(prevI, currentIndex);
    checkComplete();
  }

  function shouldIgnoreKey(e) {
    if (e.ctrlKey || e.altKey || e.metaKey) return true;
    if (e.key === 'Shift' || e.key === 'Tab' || e.key === 'CapsLock' || e.key === 'Escape') return true;
    return false;
  }

  function onKeydown(e) {
    if (disposed) return;
    if (shouldIgnoreKey(e)) return;
    if (paused) return;

    e.preventDefault();

    if (e.key === 'Backspace') {
      if (currentIndex > 0) {
        currentIndex--;
        chars[currentIndex].status = 'untouched';
        updateCharSpan(currentIndex);
        updateCurrentCursor(currentIndex + 1, currentIndex);
      }
      return;
    }

    if (e.key === 'Enter') {
      processChar('\n');
      return;
    }

    if (e.key.length === 1) {
      processChar(e.key);
    }
  }

  function handlePause() {
    paused = !paused;
    if (paused) {
      textDisplay.classList.add('paused');
      pauseBtn.textContent = '\u25B6 Resume';
      timer.pause();
    } else {
      textDisplay.classList.remove('paused');
      pauseBtn.textContent = '\u23F8 Pause';
      timer.resume();
    }
  }

  function handleRetry() {
    if (paused) handlePause();
    for (var i = 0; i < chars.length; i++) {
      chars[i].status = 'untouched';
    }
    currentIndex = 0;
    timer.reset();
    timerEl.textContent = '00:00';
    renderChars(textDisplay, chars, currentIndex);
  }

  function cleanup() {
    disposed = true;
    timer.stop();
    document.removeEventListener('keydown', onKeydown);
  }

  document.addEventListener('keydown', onKeydown);
  header.querySelector('.typing-back-btn').addEventListener('click', function () {
    cleanup();
    onBack();
  });
  pauseBtn.addEventListener('click', handlePause);
  retryBtn.addEventListener('click', handleRetry);

  wrapper.appendChild(header);
  wrapper.appendChild(textDisplay);
  container.appendChild(wrapper);

  return cleanup;
}

function initChars(content) {
  return content.split('').map(function (ch) {
    return { char: ch, expected: ch, status: 'untouched' };
  });
}

function renderChars(container, chars, currentIndex) {
  container.innerHTML = chars.map(function (c, i) {
    var classes = 'char char-' + c.status;
    if (i === currentIndex) classes += ' char-current';
    return '<span class="' + classes + '" data-index="' + i + '">' + escapeHtml(c.char) + '</span>';
  }).join('');
}

function escapeHtml(str) {
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
