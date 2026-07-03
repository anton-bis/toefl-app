export function renderSubjectSelect(container, state, callbacks) {
  container.innerHTML = '';

  var header = document.createElement('div');
  header.className = 'vocab-panel-header';
  header.innerHTML = [
    '<div class="vocab-header-row">',
    '<div class="vocab-header-titles">',
    '<h1 class="vocab-panel-title">\u771F\u9898\u5355\u8BCD\u80CC\u8BF5</h1>',
    '<p class="vocab-panel-subtitle">\u4ECE\u771F\u9898\u4E2D\u63D0\u53D6\u7684\u6838\u5FC3\u8BCD\u6C47\uFF0C\u914D\u5408\u79D1\u5B66\u8BB0\u5FC6\u66F2\u7EBF\u5B9A\u671F\u590D\u4E60</p>',
    '</div>',
    '<div class="vocab-mode-toggle" id="vocab-mode-toggle">',
    '<span class="toggle-track">',
    '<span class="toggle-knob ' + (state.mode === 'random' ? 'left' : 'right') + '"></span>',
    '<span class="toggle-label-left">\u4E71\u5E8F</span>',
    '<span class="toggle-label-right">\u8BCD\u6839</span>',
    '</span>',
    '</div>',
    '</div>'
  ].join('');
  container.appendChild(header);

  var grid = document.createElement('div');
  grid.className = 'vocab-subject-grid';

  var subjects = [
    { key: 'reading', label: 'Reading', icon: 'fa-book-open', setCount: state.setCounts.reading || 0 },
    { key: 'listening', label: 'Listening', icon: 'fa-headphones', setCount: state.setCounts.listening || 0 },
    { key: 'speaking', label: 'Speaking', icon: 'fa-microphone', setCount: state.setCounts.speaking || 0 },
    { key: 'writing', label: 'Writing', icon: 'fa-pen', setCount: state.setCounts.writing || 0 }
  ];

  subjects.forEach(function (s) {
    var card = document.createElement('div');
    card.className = 'vocab-subject-card';
    card.dataset.subject = s.key;
      card.innerHTML = [
      '<div class="subject-card-icon"><i class="fas ' + s.icon + '"></i></div>',
      '<div class="subject-card-label">' + s.label + '</div>',
      '<div class="subject-card-count">' + (state.mode === 'root' ? '\u8BCD\u6839\u8BCD\u7F00' : s.setCount + ' Set') + '</div>'
    ].join('');
    card.addEventListener('click', function () {
      callbacks.onSubjectSelect(s.key);
    });
    grid.appendChild(card);
  });

  container.appendChild(grid);

  // Mode toggle
  var toggle = container.querySelector('#vocab-mode-toggle');
  toggle.addEventListener('click', function () {
    var newMode = state.mode === 'random' ? 'root' : 'random';
    callbacks.onModeToggle(newMode);
  });
}
