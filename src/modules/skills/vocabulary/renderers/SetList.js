export function renderSetList(container, state, callbacks) {
  container.innerHTML = '';

  var header = document.createElement('div');
  header.className = 'vocab-setlist-header';
  header.innerHTML = [
    '<button class="vocab-back-btn" id="setlist-back"><i class="fas fa-arrow-left"></i> \u8FD4\u56DE</button>',
    '<h2 class="vocab-setlist-title">' + (state.mode === 'root' ? state.subjectLabel + ' \u00B7 \u8BCD\u6839\u8BCD\u7F00' : state.subjectLabel + ' \u00B7 \u4E71\u5E8F Set') + '</h2>',
    state.globalDueCount > 0 ? '<button class="global-review-btn" id="global-review-btn">\u5F00\u59CB\u590D\u4E60(\u5171' + state.globalDueCount + '\u4E2A\u5F85\u590D\u4E60\u5355\u8BCD)</button>' : ''
  ].join('');
  container.appendChild(header);

  header.querySelector('#setlist-back').addEventListener('click', callbacks.onBack);
  if (state.globalDueCount > 0) {
    header.querySelector('#global-review-btn').addEventListener('click', callbacks.onGlobalReview);
  }

  var grid = document.createElement('div');
  grid.className = 'vocab-set-grid';

  if (state.mode === 'root') {
    grid.classList.add('root-grid');

    if (state.rootCategory) {
      // Level 2: specific prefix/suffix/root groups
      var groups = state.rootGroups || [];
      groups.forEach(function (g, index) {
        if (g.type === 'separator') {
          var sep = document.createElement('div');
          sep.className = 'root-separator';
          sep.textContent = g.label || '';
          grid.appendChild(sep);
          return;
        }
        var item = document.createElement('div');
        item.className = 'root-group-card';
        item.innerHTML = [
          '<div class="root-group-title">' + g.title + '</div>',
          '<div class="root-group-count">' + g.words.length + ' \u8BCD</div>'
        ].join('');
        item.addEventListener('click', function () { callbacks.onSetSelect(index); });
        grid.appendChild(item);
      });
    } else {
      // Level 1: 4 category cards
      state.sets.forEach(function (cat, index) {
        var item = document.createElement('div');
        if (cat.type === 'category') {
          item.className = 'root-category-card';
          if (cat.id === 'prefix') item.innerHTML = [
            '<div class="root-cat-icon"><i class="fas fa-link"></i></div>',
            '<div class="root-cat-title">' + cat.title + '</div>',
            '<div class="root-cat-count">' + (cat.groupCount ? cat.groupCount + ' \u7EC4' : '') + '</div>',
            '<div class="root-cat-word-count">' + cat.wordCount + ' \u8BCD</div>'
          ].join('');
          else if (cat.id === 'suffix') item.innerHTML = [
            '<div class="root-cat-icon"><i class="fas fa-chain-broken"></i></div>',
            '<div class="root-cat-title">' + cat.title + '</div>',
            '<div class="root-cat-count">' + (cat.groupCount ? cat.groupCount + ' \u7EC4' : '') + '</div>',
            '<div class="root-cat-word-count">' + cat.wordCount + ' \u8BCD</div>'
          ].join('');
          else if (cat.id === 'root') item.innerHTML = [
            '<div class="root-cat-icon"><i class="fas fa-tree"></i></div>',
            '<div class="root-cat-title">' + cat.title + '</div>',
            '<div class="root-cat-count">' + (cat.groupCount ? cat.groupCount + ' \u7EC4' : '') + '</div>',
            '<div class="root-cat-word-count">' + cat.wordCount + ' \u8BCD</div>'
          ].join('');
          else if (cat.id === 'other') item.innerHTML = [
            '<div class="root-cat-icon"><i class="fas fa-ellipsis-h"></i></div>',
            '<div class="root-cat-title">' + cat.title + '</div>',
            '<div class="root-cat-word-count">' + cat.wordCount + ' \u8BCD</div>'
          ].join('');
        }
        item.addEventListener('click', function () { callbacks.onSetSelect(index); });
        grid.appendChild(item);
      });
    }
  } else {
    // Random mode: set cards
    state.sets.forEach(function (set, index) {
      var item = document.createElement('div');
      item.className = 'vocab-set-card' + (set.status === 'completed' ? ' completed' : '');
      item.innerHTML = [
        '<div class="set-card-name">Set ' + set.id + '</div>',
        '<div class="set-card-count">' + set.wordCount + ' \u8BCD</div>',
        '<div class="set-card-icon">',
        set.status === 'completed' ? '<i class="fas fa-check-circle"></i>' : '<i class="fas fa-chevron-right"></i>',
        '</div>'
      ].join('');
      item.addEventListener('click', function () { callbacks.onSetSelect(index); });
      grid.appendChild(item);
    });
  }

  container.appendChild(grid);
}
