import { renderCardLearning } from './CardLearning.js';
import { renderAudioLearning } from './AudioLearning.js';

var REVIEW_RATIOS = {
  reading: { 'lookup-zh': 0.40, 'lookup-en': 0.35, 'spell': 0.25 },
  writing: { 'spell': 0.40, 'lookup-en': 0.35, 'lookup-zh': 0.25 },
  listening: { 'audio-zh': 0.50, 'lookup-zh': 0.25, 'lookup-en': 0.25 },
  speaking: { 'audio-zh': 0.50, 'lookup-zh': 0.25, 'lookup-en': 0.25 }
};

function pickReviewType(subject) {
  var ratios = REVIEW_RATIOS[subject] || REVIEW_RATIOS.reading;
  var rand = Math.random();
  var cum = 0;
  for (var type in ratios) {
    cum += ratios[type];
    if (rand <= cum) return type;
  }
  return 'lookup-zh';
}

export function renderReviewSession(container, state, callbacks) {
  container.innerHTML = '';

  var header = document.createElement('div');
  header.className = 'vocab-review-header';
  header.innerHTML = [
    '<button class="vocab-back-btn" id="review-back"><i class="fas fa-arrow-left"></i> \u8FD4\u56DE</button>',
    '<h2>\u590D\u4E60 \u00B7 ' + state.subjectLabel + '</h2>',
    '<span>' + (state.currentIndex + 1) + '/' + state.queueLength + '</span>'
  ].join('');
  container.appendChild(header);

  header.querySelector('#review-back').addEventListener('click', callbacks.onBack);

  if (!state.currentWord) { callbacks.onComplete(); return; }

  var type = state.currentQuizType || pickReviewType(state.subject);

  if (type === 'audio-zh') {
    renderAudioLearning(container, state, callbacks);
  } else {
    // Reuse CardLearning for lookup and spell types
    state.currentQuizType = type;
    renderCardLearning(container, state, callbacks);
  }
}
