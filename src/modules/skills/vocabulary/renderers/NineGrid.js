import { renderWordDetail } from './WordDetail.js';

export function renderNineGrid(container, state, callbacks) {
  container.innerHTML = '';

  var pages = [];
  for (var i = 0; i < state.words.length; i += 9) {
    pages.push(state.words.slice(i, i + 9));
  }
  var currentPage = state.nineGridPage || 0;
  var markedCount = state.words.filter(function (w) { return w.gridStatus === 'unknown'; }).length;

  var wrapper = document.createElement('div');
  wrapper.className = 'vocab-nine-grid';

  wrapper.innerHTML = [
    '<div class="grid-header">',
    '<button class="vocab-back-btn" id="grid-back"><i class="fas fa-arrow-left"></i> \u8FD4\u56DE</button>',
    '<span class="grid-title">' + state.subjectLabel + ' \u00B7 Set ' + state.setId + '</span>',
    '<span class="grid-page">' + (currentPage + 1) + '/' + pages.length + '</span>',
    '</div>',
    '<div class="grid-container" data-page="' + currentPage + '">',
    pages[currentPage].map(function (w) {
      return '<div class="grid-cell' + (w.gridStatus === 'unknown' ? ' grid-cell-unknown' : '') + '" data-word-id="' + w.id + '">' +
        '<span class="grid-word">' + w.word + '</span></div>';
    }).join(''),
    '</div>',
    '<div class="grid-footer">',
    '<span class="grid-counter">\u5DF2\u6807\u8BB0: ' + markedCount + ' \u4E2A\u4E0D\u8BA4\u8BC6</span>',
    '<div class="grid-nav">',
    currentPage > 0 ? '<button class="grid-nav-btn" id="grid-prev"><i class="fas fa-chevron-left"></i></button>' : '',
    currentPage < pages.length - 1 ? '<button class="grid-nav-btn" id="grid-next"><i class="fas fa-chevron-right"></i></button>' : '',
    '</div>',
    '</div>',
    '<button class="grid-assemble-btn" id="grid-assemble">\u5F00\u59CB\u5B66\u4E60 \u2192</button>'
  ].join('');

  container.appendChild(wrapper);

  // Back button
  var backBtn = wrapper.querySelector('#grid-back');
  if (backBtn) backBtn.addEventListener('click', callbacks.onBack);

  // Cell click — toggle mark
  wrapper.querySelectorAll('.grid-cell').forEach(function (cell) {
    var wordId = cell.dataset.wordId;
    var word = state.words.find(function (w) { return w.id === wordId; });

    cell.addEventListener('click', function () {
      if (!word) return;
      word.gridStatus = word.gridStatus === 'unknown' ? 'unmarked' : 'unknown';
      cell.classList.toggle('grid-cell-unknown');
      var counter = wrapper.querySelector('.grid-counter');
      var newCount = state.words.filter(function (w) { return w.gridStatus === 'unknown'; }).length;
      counter.textContent = '\u5DF2\u6807\u8BB0: ' + newCount + ' \u4E2A\u4E0D\u8BA4\u8BC6';
    });

    cell.addEventListener('dblclick', function () {
      if (!word) return;
      renderWordDetail(null, word, {});
    });
  });

  // Pagination
  var prevBtn = wrapper.querySelector('#grid-prev');
  var nextBtn = wrapper.querySelector('#grid-next');
  if (prevBtn) {
    prevBtn.addEventListener('click', function () {
      state.nineGridPage = Math.max(0, currentPage - 1);
      callbacks.onPageChange(state.nineGridPage);
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener('click', function () {
      state.nineGridPage = Math.min(pages.length - 1, currentPage + 1);
      callbacks.onPageChange(state.nineGridPage);
    });
  }

  // Assemble
  wrapper.querySelector('#grid-assemble').addEventListener('click', function () {
    var unknownWords = state.words.filter(function (w) { return w.gridStatus === 'unknown'; });
    var studyWords = unknownWords.length > 0 ? unknownWords : state.words.slice();
    callbacks.onAssemble(studyWords);
  });
}
