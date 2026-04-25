(function(){
  // Centralized renderer for the Reading score cards on the results page
  // Support multiple modules and tasks by aggregating across all known keys.
  function readIntFlexible(keys){
    // Read the first existing key in the provided order, return as integer
    for (const k of keys){
      const v = localStorage.getItem(k);
      if (v != null) {
        const n = parseInt(v, 10);
        if (!isNaN(n)) return n;
      }
    }
    return 0;
  }

  function render(){
    // Consider possible keys across modules/prefixes
    const candidatesTotal = [
      'toefl_reading_M1_Task1_total',
      'toefl_reading_M2_Task2_total',
      'toefl_tpo01_reading_M1_Task1_total',
      'toefl_tpo01_reading_M2_Task2_total'
    ];
    const candidatesCorrect = [
      'toefl_reading_M1_Task1_correct',
      'toefl_reading_M2_Task2_correct',
      'toefl_tpo01_reading_M1_Task1_correct',
      'toefl_tpo01_reading_M2_Task2_correct'
    ];

    const m1Total = readIntFlexible(candidatesTotal);
    const m2Total = readIntFlexible(candidatesTotal.slice(2)); // prefer M1/M2 T1/T2 variants
    const m1Correct = readIntFlexible(candidatesCorrect);
    const m2Correct = readIntFlexible(candidatesCorrect.slice(2));

    // Fall back to explicit reads if flexible search misses values
    const totals = [m1Total, m2Total].filter(v => typeof v === 'number');
    const corrects = [m1Correct, m2Correct].filter(v => typeof v === 'number');
    const totalQuestions = totals.length ? totals.reduce((a,b)=>a+b,0) : 0;
    const correctCount = corrects.length ? corrects.reduce((a,b)=>a+b,0) : 0;

    const r1 = m1Total > 0 ? (m1Correct / m1Total) : 0;
    const r2 = m2Total > 0 ? (m2Correct / m2Total) : 0;
    const total_reading_30 = 30 * (r1 * 0.4 + r2 * 0.6);
    const reading_30 = Math.floor(total_reading_30);
    const six_score = Math.floor((total_reading_30 / 30 * 6) * 2 + 0.5) / 2;

    const elReading = document.getElementById('reading-score-display');
    const elTotal = document.getElementById('total-questions');
    const elCorrect = document.getElementById('correct-answers');

    if (elReading) elReading.textContent = reading_30 + ' / ' + six_score.toFixed(1);
    if (elTotal) elTotal.textContent = totalQuestions;
    if (elCorrect) elCorrect.textContent = correctCount;
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
  // Optional: keep in sync if localStorage changes during the session
  window.addEventListener('storage', render);
  // Expose a compatibility hook for templates that call renderReadingScoreForTask
  window.renderReadingScoreForTask = function(taskIndex, isCorrect){
    // Update the per-task totals/correct flags across multiple possible key schemes
    const totalKeys = [
      `toefl_reading_M1_Task${taskIndex}_total`,
      `toefl_reading_M2_Task${taskIndex}_total`,
      `toefl_tpo01_reading_M1_Task${taskIndex}_total`,
      `toefl_tpo01_reading_M2_Task${taskIndex}_total`
    ];
    let updated = false;
    for (const k of totalKeys){
      if (localStorage.getItem(k) != null){
        const cur = Number(localStorage.getItem(k) || 0);
        localStorage.setItem(k, String(cur + 1));
        updated = true;
        break;
      }
    }
    if (!updated){
      // initialize with M1 Task1 as a safe default
      localStorage.setItem('toefl_reading_M1_Task' + taskIndex + '_total', '1');
    }

    if (isCorrect){
      const correctKeys = [
        `toefl_reading_M1_Task${taskIndex}_correct`,
        `toefl_reading_M2_Task${taskIndex}_correct`,
        `toefl_tpo01_reading_M1_Task${taskIndex}_correct`,
        `toefl_tpo01_reading_M2_Task${taskIndex}_correct`
      ];
      let foundCorrect = false;
      for (const ck of correctKeys){
        if (localStorage.getItem(ck) != null){
          const curC = Number(localStorage.getItem(ck) || 0);
          localStorage.setItem(ck, String(curC + 1));
          foundCorrect = true;
          break;
        }
      }
      if (!foundCorrect){
        localStorage.setItem('toefl_reading_M1_Task' + taskIndex + '_correct', '1');
      }
    }

    render();
  };
})();
