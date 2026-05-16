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
    // Read module-level task scores via flexible key search
    let m1Correct = 0, m1TaskTotal = 0;
    for (let t = 1; t <= 6; t++) {
      m1Correct += readIntFlexible([
        'toefl_reading_M1_Task' + t + '_correct',
        'toefl_reading_M1_Task' + t + '_correct'
      ]);
      m1TaskTotal += readIntFlexible([
        'toefl_reading_M1_Task' + t + '_total',
        'toefl_reading_M1_Task' + t + '_total'
      ]);
    }
    let m2Correct = 0, m2TaskTotal = 0;
    for (let t = 1; t <= 2; t++) {
      m2Correct += readIntFlexible([
        'toefl_reading_M2_Task' + t + '_correct',
        'toefl_reading_M2_Task' + t + '_correct'
      ]);
      m2TaskTotal += readIntFlexible([
        'toefl_reading_M2_Task' + t + '_total',
        'toefl_reading_M2_Task' + t + '_total'
      ]);
    }

    const config = window.TOEFL_CONFIG;
    const m1TotalQ = config ? config.module1.totalQuestions : 33;
    const m2TotalQ = config ? config.module2.totalQuestions : 15;
    const totalQuestions = m1TotalQ + m2TotalQ;

    const r1 = m1TotalQ > 0 ? (m1Correct / m1TotalQ) : 0;
    const r2 = m2TotalQ > 0 ? (m2Correct / m2TotalQ) : 0;
    const totalReading30 = 30 * (r1 * 0.4 + r2 * 0.6);
    const reading30 = Math.round(totalReading30);
    const sixScore = Math.round((reading30 / 30 * 6) * 2) / 2;

    const elReading = document.getElementById('reading-score-display');
    const elTotal = document.getElementById('total-questions');
    const elCorrect = document.getElementById('correct-answers');

    if (elReading) elReading.textContent = reading30 + ' / ' + sixScore.toFixed(1);
    if (elTotal) elTotal.textContent = totalQuestions;
    if (elCorrect) elCorrect.textContent = m1Correct + m2Correct;
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
      `toefl_reading_M1_Task${taskIndex}_total`,
      `toefl_reading_M2_Task${taskIndex}_total`
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
        `toefl_reading_M1_Task${taskIndex}_correct`,
        `toefl_reading_M2_Task${taskIndex}_correct`
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
