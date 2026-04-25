// Per-question correctness rendering for Reading tests (v2)
// This module augments the results UI by applying per-question
// correctness indicators and showing precise blanks for Fill-in-the-Blank items.
//
// Storage convention:
//  - toefl_<moduleKey>_<questionId>_correct -> '1' (correct) | '0' (wrong)
//  - toefl_<moduleKey>_<questionId>_blank_indices -> comma-separated indices
// Module key mapping follows existing patterns:
//  - Module 1: reading_M1_Task1
//  - Module 2: reading_M2_Task2

(function(){
  // Helpers
  function _getModuleKeyForQuestion(qid) {
    var end = (typeof CONFIG !== 'undefined' && CONFIG.module1 && CONFIG.module1.endQuestion) ? CONFIG.module1.endQuestion : 0;
    return (parseInt(qid, 10) <= end) ? 'reading_M1_Task1' : 'reading_M2_Task2';
  }
  function _getPerQuestionCorrectness(qid) {
    var moduleKey = _getModuleKeyForQuestion(qid);
    var key = 'toefl_' + moduleKey + '_' + qid + '_correct';
    var v = null;
    try { v = localStorage.getItem(key); } catch(e) { /* ignore */ }
    if (v === '1') return 'correct';
    if (v === '0') return 'wrong';
    return null;
  }
  function _getQuestionBlanks(qid) {
    var moduleKey = _getModuleKeyForQuestion(qid);
    var key = 'toefl_' + moduleKey + '_' + qid + '_blank_indices';
    var v = null;
    try { v = localStorage.getItem(key); } catch(e) { /* ignore */ }
    if (!v) return null;
    var parts = v.split(',');
    var arr = parts.map(function(n){ var x = parseInt(n, 10); return isNaN(x) ? null : x; }).filter(function(n){ return n !== null; });
    return arr.length ? arr : null;
  }

  // Apply enhancements after DOM is loaded
  document.addEventListener('DOMContentLoaded', function(){
    var qs = document.querySelectorAll('.q-cell');
    Array.prototype.forEach.call(qs, function(el){
      var qid = el.dataset.questionId;
      if (!qid) return;
      var correctness = _getPerQuestionCorrectness(qid);
      if (correctness) {
        el.classList.add(correctness);
      }
      var blanks = _getQuestionBlanks(qid);
      if (blanks && blanks.length) {
        var span = document.createElement('span');
        span.className = 'q-blank-indicator';
        span.textContent = 'BLANKS: ' + blanks.map(function(n){return (n+1);}).join(',');
        el.appendChild(span);
      }
    });
  });
})();
