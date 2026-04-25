(function(){
  // Compute per-question status from localStorage keys:
  // toefl_tpo01_reading_M1_Task{N}_correct and _total
  function getQuestionStatus(qIndex){
    const cKey = `toefl_tpo01_reading_M1_Task${qIndex}_correct`;
    const tKey = `toefl_tpo01_reading_M1_Task${qIndex}_total`;
    const c = parseInt(localStorage.getItem(cKey), 10);
    const t = parseInt(localStorage.getItem(tKey), 10);
    if (Number.isNaN(t) || t <= 0){
      return 'unanswered';
    }
    if (Number.isNaN(c)){
      return 'wrong';
    }
    return (c >= t) ? 'correct' : 'wrong';
  }

  function renderStatusBar(total){
    // Ensure a container exists at the top of the results page
    let bar = document.getElementById('reading-status-bar');
    if (!bar){
      bar = document.createElement('div');
      bar.id = 'reading-status-bar';
      bar.style.display = 'flex';
      bar.style.flexWrap = 'wrap';
      bar.style.gap = '6px';
      // Try to place near a main container if present
      const anchor = document.getElementById('results-container') || document.body;
      anchor.insertBefore(bar, anchor.firstChild);
    }
    bar.innerHTML = '';
    for (let i = 1; i <= total; i++){
      const s = getQuestionStatus(i);
      const a = document.createElement('a');
      a.href = `#question-idx-${i}`;
      a.className = 'status-dot status-' + s;
      a.textContent = `Q${i}`;
      a.setAttribute('aria-label', `Question ${i} status: ${s}`);
      bar.appendChild(a);
    }
  }

  function assignQuestionAnchors(){
    // Ensure each question block has an id like question-idx-N
    const blocks = document.querySelectorAll('[data-question-id]');
    blocks.forEach((el, idx) => {
      const n = idx + 1;
      el.id = `question-idx-${n}`;
    });
  }

  function init(){
    // Try to determine total questions from DOM anchors or stored total
    let total = 0;
    // If there are existing anchors with id question-idx-*, count them
    const anchorList = document.querySelectorAll('[id^="question-idx-"]');
    anchorList.forEach(()=>{ total += 1; });
    if (total <= 0) {
      const totalFromStorage = parseInt(localStorage.getItem('toefl_tpo01_reading_M1_TotalQuestions'), 10);
      total = Number.isNaN(totalFromStorage) ? 0 : totalFromStorage;
    }
    if (total > 0){
      renderStatusBar(total);
      // Apply per-blank indicators if present
      document.querySelectorAll('[data-question-id]').forEach((el)=>{
        const qIndex = el.getAttribute('data-question-id');
        if (qIndex){
          assignBlankIndicatorsForQuestion(parseInt(qIndex,10));
        }
      });
    }
  }

  function assignBlankIndicatorsForQuestion(qIndex){
    // Fill-in-the-blank support: show a small indicator next to blanks
    const blanks = document.querySelectorAll(`[data-question-id='${qIndex}'] [data-blank-idx]`);
    blanks.forEach(b => {
      const idx = b.getAttribute('data-blank-idx');
      const key = `toefl_tpo01_reading_M1_Task${qIndex}_blank${idx}_correct`;
      const val = localStorage.getItem(key);
      if (val === '1' || val === 'true') {
        b.classList.add('blank-correct');
        b.setAttribute('aria-label','Blank correct');
      } else if (val === '0' || val === 'false') {
        b.classList.add('blank-wrong');
        b.setAttribute('aria-label','Blank unanswered');
      } else {
        // unknown - leave as-is
      }
    });
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
