import scheduler from '../utils/scheduler.js';
import { loadProgress } from '../utils/storage.js';

export function renderDailyReminder(container, state, callbacks) {
  var overlay = document.createElement('div');
  overlay.className = 'reminder-overlay';

  var subjectLabels = { reading: 'Reading', listening: 'Listening', speaking: 'Speaking', writing: 'Writing' };
  var pending = state.pendingReminder || [];

  var progress = loadProgress();
  var reviewCount = scheduler.getTodayReviewCount(progress);

  overlay.innerHTML = [
    '<div class="reminder-card">',
    '<div class="reminder-title">\u6BCF\u65E5\u5355\u8BCD\u63D0\u9192</div>',
    pending.length > 0 ? '<div class="reminder-section-label">\u4ECA\u65E5\u65B0\u8BCD</div>' : '',
    '<div class="reminder-list">',
    pending.map(function (p) {
      return '<div class="reminder-item">' +
        '<span class="reminder-icon"><i class="fas fa-book-open"></i></span>' +
        '<span class="reminder-subject">' + (subjectLabels[p.subject] || p.subject) + '</span>' +
        '<span class="reminder-set">Set ' + p.setId + '</span>' +
        '</div>';
    }).join(''),
    '</div>',
    reviewCount > 0 ? '<div class="reminder-section-label">\u4ECA\u65E5\u5F85\u590D\u4E60</div>' : '',
    reviewCount > 0 ? '<div class="reminder-review-info">\u5171 ' + reviewCount + ' \u4E2A\u5355\u8BCD\u9700\u8981\u590D\u4E60</div>' : '',
    reviewCount > 0 ? '<div class="reminder-review-hint">\u8FDB\u5165\u5404\u79D1\u76EE Set \u5217\u8868\u67E5\u770B\u5FAE\u590D\u4E60\u5355\u8BCD</div>' : '',
    '</div>',
    '<div class="reminder-actions">',
    pending.length > 0 ? '<button class="reminder-btn primary" id="reminder-start">\u5F00\u59CB\u80CC\u8BF5</button>' : '',
    '<button class="reminder-btn ghost" id="reminder-dismiss">\u4ECA\u65E5\u4E0D\u63D0\u9192</button>',
    '</div>',
    '</div>'
  ].join('');

  container.appendChild(overlay);

  if (pending.length > 0) {
    overlay.querySelector('#reminder-start').addEventListener('click', function () {
      overlay.remove();
      callbacks.onStart(pending[0]);
    });
  }

  overlay.querySelector('#reminder-dismiss').addEventListener('click', function () {
    overlay.remove();
    callbacks.onDismiss();
  });
}
