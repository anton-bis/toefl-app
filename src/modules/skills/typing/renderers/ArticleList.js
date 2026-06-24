const DIFFICULTY_CONFIG = {
  beginner: {
    label: 'Beginner',
    desc: 'Short passages, no time limit',
    color: '#34C759',
    rate: null
  },
  intermediate: {
    label: 'Intermediate',
    desc: 'Medium length, target ~35 WPM',
    color: '#FF9500',
    rate: 35
  },
  advanced: {
    label: 'Advanced',
    desc: 'Long articles, target ~45 WPM',
    color: '#FF5252',
    rate: 45
  }
};

export function renderArticleList(container, ctx) {
  const { articles, collapsed, onSelect, onToggle } = ctx;

  const wrapper = document.createElement('div');
  wrapper.className = 'typing-article-list';

  const difficulties = ['beginner', 'intermediate', 'advanced'];

  difficulties.forEach(diff => {
    const filtered = articles.filter(a => a.difficulty === diff);
    if (filtered.length === 0) return;
    const section = buildSection(diff, filtered, collapsed[diff], onSelect, onToggle);
    wrapper.appendChild(section);
  });

  if (articles.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'typing-empty';
    empty.innerHTML = '<p>No articles available. Please add practice passages.</p>';
    wrapper.appendChild(empty);
  }

  container.appendChild(wrapper);
}

function buildSection(difficulty, articles, isCollapsed, onSelect, onToggle) {
  const config = DIFFICULTY_CONFIG[difficulty];
  const section = document.createElement('div');
  section.className = 'typing-difficulty-section';
  section.style.borderLeftColor = config.color;

  const header = document.createElement('div');
  header.className = 'typing-section-header';
  header.innerHTML = [
    '<span class="typing-collapse-icon">',
    isCollapsed ? '\u25B6' : '\u25BC',
    '</span>',
    '<span class="typing-section-title">',
    config.label,
    '</span>',
    '<span class="typing-section-dot" style="background:', config.color, ';"></span>',
    '<span class="typing-section-count">',
    articles.length,
    ' articles</span>'
  ].join('');

  const desc = document.createElement('div');
  desc.className = 'typing-section-desc';
  desc.textContent = config.desc;

  const grid = document.createElement('div');
  grid.className = 'typing-card-grid';

  articles.forEach(article => {
    const card = buildCard(article, config, onSelect);
    grid.appendChild(card);
  });

  const body = document.createElement('div');
  body.className = 'typing-section-body';
  if (isCollapsed) body.classList.add('collapsed');
  body.appendChild(desc);
  body.appendChild(grid);

  header.addEventListener('click', () => {
    body.classList.toggle('collapsed');
    const icon = header.querySelector('.typing-collapse-icon');
    icon.textContent = body.classList.contains('collapsed') ? '\u25B6' : '\u25BC';
    onToggle(difficulty);
  });

  section.appendChild(header);
  section.appendChild(body);
  return section;
}

function buildCard(article, config, onSelect) {
  const card = document.createElement('div');
  card.className = 'typing-article-card';
  card.setAttribute('data-id', article.id);

  let timeEstimate;
  if (config.rate) {
    timeEstimate = Math.ceil((article.wordCount / config.rate) * 60);
  } else {
    timeEstimate = Math.min(article.wordCount * 2, 300);
  }

  let timeStr;
  if (timeEstimate < 60) {
    timeStr = timeEstimate + 's';
  } else {
    const m = Math.floor(timeEstimate / 60);
    const s = timeEstimate % 60;
    timeStr = s > 0 ? m + 'm' + s + 's' : m + 'min';
  }

  card.innerHTML = [
    '<div class="typing-card-title">',
    '<span class="typing-card-dot" style="background:', config.color, ';"></span>',
    escapeHtml(article.title),
    '</div>',
    '<div class="typing-card-meta">',
    article.wordCount,
    ' words \u00B7 ~',
    timeStr,
    '</div>'
  ].join('');

  card.addEventListener('click', () => onSelect(article.id));
  return card;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
