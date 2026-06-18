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

  // Universal confirm modal shared by all templates
  window.showConfirm = function(title, message, buttons, showClose){
    var overlay = document.createElement('div');
    overlay.className = 'confirm-modal-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:10001;display:flex;justify-content:center;align-items:center';
    var box = document.createElement('div');
    box.className = 'confirm-modal-box';
    box.style.cssText = 'background:#fff;border-radius:12px;padding:24px 30px;max-width:420px;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,0.3);position:relative';
    if (showClose) {
      var xbtn = document.createElement('button');
      xbtn.textContent = '✕';
      xbtn.style.cssText = 'position:absolute;top:8px;right:12px;background:none;border:none;font-size:22px;color:#999;cursor:pointer';
      xbtn.onclick = function(){ overlay.remove(); };
      box.appendChild(xbtn);
    }
    var h2 = document.createElement('h2');
    h2.style.cssText = 'font-size:22px;font-weight:bold;color:#222;margin:0 0 10px';
    h2.textContent = title;
    box.appendChild(h2);
    var p = document.createElement('p');
    p.style.cssText = 'font-size:15px;color:#555;margin:0 0 20px;line-height:1.5;white-space:pre-line';
    p.textContent = message;
    box.appendChild(p);
    var btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:12px;justify-content:center';
    buttons.forEach(function(b){
      var btn = document.createElement('button');
      btn.textContent = b.text;
      btn.style.cssText = 'padding:10px 24px;font-size:14px;font-weight:600;border-radius:6px;border:none;cursor:pointer;' + (b.cls === 'primary' ? 'background:#008080;color:#fff' : b.cls === 'danger' ? 'background:#dc3545;color:#fff' : 'background:#e9e9ee;color:#1a1a1a');
      btn.onclick = function(){ overlay.remove(); if(b.onClick) b.onClick(); };
      btnRow.appendChild(btn);
    });
    box.appendChild(btnRow);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  };

  window.showHelp = function(title, message) {
    var overlay = document.createElement('div');
    overlay.style.cssText = 'display:flex;position:fixed;inset:0;background:rgba(0,0,0,0.35);z-index:2000;align-items:center;justify-content:center;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)';
    var card = document.createElement('div');
    card.style.cssText = 'background:#fff;border-radius:14px;width:480px;max-width:92vw;max-height:85vh;overflow-y:auto;box-shadow:0 20px 50px rgba(0,0,0,0.18)';
    var header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:18px 24px;border-bottom:1px solid #e5e5e7';
    var h3 = document.createElement('h3');
    h3.style.cssText = 'margin:0;font-size:17px;font-weight:700;color:#1d1d1f';
    h3.innerHTML = '<i class="fas fa-question-circle" style="margin-right:8px;color:#008080"></i>' + title;
    var closeBtn = document.createElement('button');
    closeBtn.style.cssText = 'width:32px;height:32px;border-radius:50%;border:none;background:#f0f0f2;cursor:pointer;font-size:14px;color:#86868b;display:flex;align-items:center;justify-content:center;transition:all 0.15s';
    closeBtn.innerHTML = '<i class="fas fa-times"></i>';
    closeBtn.onmouseenter = function(){ closeBtn.style.background = '#e0e0e2'; closeBtn.style.color = '#1d1d1f'; };
    closeBtn.onmouseleave = function(){ closeBtn.style.background = '#f0f0f2'; closeBtn.style.color = '#86868b'; };
    closeBtn.onclick = function(){ overlay.remove(); };
    header.appendChild(h3);
    header.appendChild(closeBtn);
    card.appendChild(header);
    var body = document.createElement('div');
    body.style.cssText = 'padding:24px;font-size:14px;line-height:1.7;color:#444;white-space:pre-line';
    body.textContent = message;
    card.appendChild(body);
    overlay.appendChild(card);
    overlay.addEventListener('click', function(e){ if(e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  };
})();
