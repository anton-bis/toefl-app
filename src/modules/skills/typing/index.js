import { store } from '@core/store.js';
import { loader } from '@core/loader.js';
import { renderArticleList } from './renderers/ArticleList.js';
import { renderTypingArea } from './renderers/TypingArea.js';
import { renderResultPanel } from './renderers/ResultPanel.js';
import { renderProgressPanel } from './renderers/ProgressPanel.js';
import { saveRecord, updateBest } from './utils/storage.js';
import { computeMetrics } from './utils/metrics.js';
import './styles.css';

export default {
  name: 'typing',

  state: {
    page: 'list',
    articles: [],
    currentArticle: null,
    collapsed: { beginner: false, intermediate: false, advanced: false }
  },

  async init() {
    store.registerModule(this.name, {
      name: '英文打字练习',
      description: '提升英文打字速度和格式规范',
      icon: '\u2328'
    });
    store.activateModule(this.name);

    await this._loadCorpus();
    this.render();
  },

  async _loadCorpus() {
    try {
      const jsonText = await loader.load('typing/corpus.json', 'text');
      const data = JSON.parse(jsonText);
      this.state.articles = data.filter(a => a.content && a.content.trim());
    } catch (err) {
      console.error('[typing] _loadCorpus FAILED:', err);
      this.state.articles = [];
    }
  },

  render() {
    const app = document.getElementById('panel-typing') || document.getElementById('app');
    if (!app) return;
    app.innerHTML = '';

    const self = this;

    switch (this.state.page) {
    case 'list': {
      const header = document.createElement('div');
      header.className = 'typing-panel-header';
      header.innerHTML = [
        '<div class="typing-panel-header-row">',
        '<div class="typing-panel-header-titles">',
        '<h1 class="typing-panel-title">English Typing Practice</h1>',
        '<p class="typing-panel-subtitle">Choose an article, time your typing, and improve your speed and accuracy. Typing like a pro ~</p>',
        '</div>',
        '<a class="typing-history-link" href="#">History \u2192</a>',
        '</div>'
      ].join('');
      app.appendChild(header);

      header.querySelector('.typing-history-link').addEventListener('click', function (e) {
        e.preventDefault();
        self.state.page = 'progress';
        self.render();
      });

      renderArticleList(app, {
        articles: this.state.articles,
        collapsed: this.state.collapsed,
        onSelect(articleId) {
          const article = self.state.articles.find(a => a.id === articleId);
          if (!article) return;
          self.state.currentArticle = article;
          self.state.page = 'typing';
          self.render();
        },
        onToggle(difficulty) {
          self.state.collapsed[difficulty] = !self.state.collapsed[difficulty];
        }
      });
      break;
    }
    case 'typing': {
      if (this._typingCleanup) {
        this._typingCleanup();
        this._typingCleanup = null;
      }
      const article = this.state.currentArticle;
      const rateMap = { beginner: 20, intermediate: 35, advanced: 45 };
      const rate = rateMap[article.difficulty];
      const maxSeconds = Math.ceil(article.wordCount / rate * 60);
      this._typingCleanup = renderTypingArea(app, {
        article: article,
        maxSeconds: maxSeconds,
        onComplete(result) {
          self.state.scores = result;
          self._typingCleanup = null;
          var metrics = computeMetrics(result);
          saveRecord({
            articleId: result.article.id,
            title: result.article.title,
            difficulty: result.article.difficulty,
            rawWpm: metrics.rawWpm,
            netWpm: metrics.netWpm,
            accuracy: metrics.accuracy,
            errors: metrics.errors,
            correctCount: metrics.correctCount,
            incorrectCount: metrics.incorrectCount,
            totalChars: metrics.totalChars,
            timeSpent: Math.floor(result.timeSpent / 1000),
            completedAt: new Date().toISOString()
          });
          updateBest(result.article.difficulty, metrics.netWpm, metrics.accuracy, result.article.id);
          self.state.page = 'result';
          self.render();
        },
        onBack() {
          self.state.page = 'list';
          self._typingCleanup = null;
          self.render();
        }
      });
      break;
    }
    case 'result':
      renderResultPanel(app, {
        scores: this.state.scores,
        metrics: computeMetrics(this.state.scores),
        onRetry() {
          self.state.page = 'typing';
          self.render();
        },
        onBack() {
          self.state.currentArticle = null;
          self.state.scores = null;
          self.state.page = 'list';
          self.render();
        }
      });
      break;
    case 'progress':
      renderProgressPanel(app, {
        onBack() {
          self.state.page = 'list';
          self.render();
        }
      });
      break;
    }
  },

  _renderPlaceholder(container, text) {
    const el = document.createElement('div');
    el.style.cssText = 'display:flex;align-items:center;justify-content:center;height:60vh;color:#86868b;font-size:18px;';
    el.textContent = text;
    container.appendChild(el);
  },

  destroy() {
    // CSS is managed by Vite via import, no manual cleanup needed
  }
};
