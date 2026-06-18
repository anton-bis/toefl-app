(function () {
  'use strict';

  var qData = window.BS_QUESTION_DATA;
  if (!qData) return;

  var TOTAL_TIME = 347;
  var timerInterval = null;
  var timerVisible = true;
  var totalSeconds = TOTAL_TIME;
  var isLocked = false;
  var overtime = 0;
  var unlimitedMode = false;
  var filledSlots = new Array(qData.blankCount).fill(null);
  var shuffledCandidates = shuffleArr(qData.candidates.slice());
  var checked = false;

  function shuffleArr(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  var candidateArea = document.getElementById('candidates-area');
  var checkOverlay = document.getElementById('check-overlay');
  var timerDisp = document.getElementById('timer-display');
  var toggleBtn = document.getElementById('toggle-timer-btn');

  /* ---- Timer ---- */
  function updateTimerDisplay() {
    var m = Math.floor(totalSeconds / 60);
    var s = totalSeconds % 60;
    timerDisp.textContent = (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
    if (totalSeconds <= 60) timerDisp.classList.add('urgent');
  }

  function saveTimer() {
    localStorage.setItem('toefl_writing_timer_remaining', totalSeconds);
  }

  function loadTimer() {
    var saved = localStorage.getItem('toefl_writing_timer_remaining');
    if (saved !== null) totalSeconds = parseInt(saved) || TOTAL_TIME;
    updateTimerDisplay();
  }

  function lockAll() {
    if (isLocked) return;
    isLocked = true;
    localStorage.setItem('toefl_writing_timer_expired', 'true');
    totalSeconds = 0;
    timerDisp.textContent = '00:00';
    timerDisp.classList.add('urgent');
    clearInterval(timerInterval);
    showTimeUpModal();
  }

  function showTimeUpModal() {
    var modal = document.getElementById('timer-expired-modal');
    if (!modal) return;
    modal.classList.add('show');

    document.getElementById('timer-modal-continue').onclick = function () {
      modal.classList.remove('show');
      isLocked = false;
      unlimitedMode = true;
      timerDisp.textContent = '--:--';
      timerInterval = setInterval(function () {
        overtime++;
        localStorage.setItem('toefl_writing_overtime', String(overtime));
      }, 1000);
    };

    document.getElementById('timer-modal-exit').onclick = function () {
      modal.classList.remove('show');
      endTask('timeup');
    };
  }

  function endTask(dest) {
    localStorage.removeItem('toefl_writing_overtime');
    try {
      var allAnswers = JSON.parse(localStorage.getItem('toefl_writing_bs_answers') || '{}');
      var qn = String(qData.questionNumber || '1');
      allAnswers[qn] = { filled: filledSlots.filter(function(v) { return v !== null; }), blankCount: qData.blankCount };
      localStorage.setItem('toefl_writing_bs_answers', JSON.stringify(allAnswers));
    } catch(e) {}
    if (dest === 'next') {
      window.location.href = qData.nextPage;
    } else if (dest === 'timeup') {
      localStorage.removeItem('toefl_writing_timer_expired');
      localStorage.removeItem('toefl_writing_timer_remaining');
      window.location.href = qData.emailIntroPage || 'email-intro.html';
    } else if (dest === 'back') {
      window.location.href = qData.prevPage;
    } else if (dest === 'exit') {
      window.location.href = 'start.html';
    }
  }

  function startTimer() {
    loadTimer();
    var expired = localStorage.getItem('toefl_writing_timer_expired');
    if (expired === 'true') {
      lockAll();
      return;
    }
    timerInterval = setInterval(function () {
      if (totalSeconds <= 0) { lockAll(); return; }
      totalSeconds--;
      updateTimerDisplay();
      saveTimer();
    }, 1000);
  }

  toggleBtn.addEventListener('click', function () {
    timerVisible = !timerVisible;
    timerDisp.style.visibility = timerVisible ? 'visible' : 'hidden';
    toggleBtn.innerHTML = timerVisible
      ? '<i class="fas fa-eye-slash"></i><span>Hide Time</span>'
      : '<i class="fas fa-eye"></i><span>Show Time</span>';
  });

  /* ---- Build Slots & Candidates ---- */
  var speakerBLine = document.getElementById('speaker-b-line');
  var blankIndex = 0;

  qData.slots.forEach(function (slot, idx) {
    if (slot.type === 'text') {
      var span = document.createElement('span');
      span.className = 'text-segment';
      span.textContent = slot.value;
      speakerBLine.appendChild(span);
    } else {
      var el = createBlankSlot(blankIndex, idx);
      speakerBLine.appendChild(el);
      el._blankIdx = blankIndex;
      blankIndex++;
    }
  });

  shuffledCandidates.forEach(function (word) {
    var chip = createCandidateChip(word);
    candidateArea.appendChild(chip);
  });

  function createBlankSlot(bIdx, sIdx) {
    var el = document.createElement('div');
    el.className = 'blank-slot';
    el.setAttribute('data-blank', bIdx);
    el.draggable = true;

    el.addEventListener('dragstart', function (e) {
      if (isLocked || checked) { e.preventDefault(); return; }
      if (filledSlots[bIdx] === null) { e.preventDefault(); return; }
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', JSON.stringify({ source: 'slot', index: bIdx }));
    });

    el.addEventListener('dragover', function (e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });

    el.addEventListener('drop', function (e) {
      e.preventDefault();
      if (isLocked || checked) return;
      try {
        var data = JSON.parse(e.dataTransfer.getData('text/plain'));
        if (data.source === 'candidate') {
          var word = data.text;
          if (filledSlots[bIdx] !== null) {
            returnWordToCandidates(filledSlots[bIdx]);
          }
          filledSlots[bIdx] = word;
          markCandidateUsed(word);
        } else if (data.source === 'slot' && data.index !== bIdx) {
          var a = filledSlots[data.index];
          var b = filledSlots[bIdx];
          if (a !== null && b !== null) {
            filledSlots[bIdx] = a;
            filledSlots[data.index] = b;
          } else if (a !== null) {
            filledSlots[bIdx] = a;
            filledSlots[data.index] = null;
            returnWordToCandidates(b);
          }
        }
        rebuildSlots();
      } catch (_) {}
    });

    el.addEventListener('click', function () {
      if (isLocked || checked) return;
      if (filledSlots[bIdx] !== null) {
        returnWordToCandidates(filledSlots[bIdx]);
        filledSlots[bIdx] = null;
        rebuildSlots();
      }
    });

    return el;
  }

  function createCandidateChip(word) {
    var el = document.createElement('div');
    el.className = 'candidate-chip';
    el.textContent = word;
    el.draggable = true;
    el.setAttribute('data-word', word);

    el.addEventListener('dragstart', function (e) {
      if (isLocked || checked) { e.preventDefault(); return; }
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', JSON.stringify({ source: 'candidate', text: word }));
    });

    el.addEventListener('click', function () {
      if (isLocked || checked) return;
      if (el.classList.contains('used')) return;
      var idx = filledSlots.findIndex(function (v) { return v === null; });
      if (idx !== -1) {
        filledSlots[idx] = word;
        el.classList.add('used');
        rebuildSlots();
      }
    });

    return el;
  }

  function markCandidateUsed(word) {
    var chips = candidateArea.querySelectorAll('.candidate-chip:not(.used)');
    for (var i = 0; i < chips.length; i++) {
      if (chips[i].textContent === word) { chips[i].classList.add('used'); return; }
    }
  }

  function returnWordToCandidates(word) {
    if (word === null) return;
    var chips = candidateArea.querySelectorAll('.candidate-chip.used');
    for (var i = 0; i < chips.length; i++) {
      if (chips[i].textContent === word) { chips[i].classList.remove('used'); return; }
    }
  }

  function disableAllInteraction() {
    var blanks = document.querySelectorAll('.blank-slot');
    for (var i = 0; i < blanks.length; i++) {
      blanks[i].draggable = false;
      blanks[i].style.cursor = 'default';
    }
    var chips = document.querySelectorAll('.candidate-chip');
    for (var j = 0; j < chips.length; j++) {
      chips[j].draggable = false;
      chips[j].style.cursor = 'default';
      chips[j].style.backgroundColor = '#f5f5f5';
      chips[j].style.color = '#999';
      chips[j].style.pointerEvents = 'none';
    }
  }

  function rebuildSlots() {
    checked = false;
    var blanks = speakerBLine.querySelectorAll('.blank-slot');
    var bIdx = 0;
    blanks.forEach(function (el) {
      var val = filledSlots[bIdx];
      el.textContent = val !== null ? val : '';
      el.className = 'blank-slot';
      el.draggable = val !== null && !isLocked;
      bIdx++;
    });
  }

  /* ---- Check Answers ---- */
  document.getElementById('check-answers-btn').addEventListener('click', function () {
    checked = true;
    var blanks = speakerBLine.querySelectorAll('.blank-slot');
    var correctCount = 0;
    var totalBlanks = blanks.length;

    blanks.forEach(function (el, i) {
      var userVal = filledSlots[i];
      var correctVal = qData.answerOrder[i];
      el.className = 'blank-slot';
      if (userVal !== null && correctVal && userVal.toLowerCase() === correctVal.toLowerCase()) {
        el.classList.add('correct');
        correctCount++;
      } else if (userVal !== null) {
        el.classList.add('incorrect');
        el.textContent = el.textContent + ' (' + correctVal + ')';
      } else {
        el.classList.add('empty');
        el.textContent = '(' + correctVal + ')';
      }
      el.draggable = false;
    });

    document.getElementById('check-total').textContent = totalBlanks;
    document.getElementById('check-correct').textContent = correctCount;
    document.getElementById('check-incorrect').textContent = totalBlanks - correctCount;
    checkOverlay.classList.add('open');
  });

  document.getElementById('check-close-btn').addEventListener('click', function () {
    checkOverlay.classList.remove('open');
  });
  document.getElementById('close-check-btn').addEventListener('click', function () {
    checkOverlay.classList.remove('open');
  });
  checkOverlay.addEventListener('click', function (e) {
    if (e.target === checkOverlay) checkOverlay.classList.remove('open');
  });

  /* ---- Candidate area drop zone ---- */
  candidateArea.addEventListener('dragover', function (e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  });
  candidateArea.addEventListener('drop', function (e) {
    e.preventDefault();
    if (isLocked || checked) return;
    try {
      var data = JSON.parse(e.dataTransfer.getData('text/plain'));
      if (data.source === 'slot') {
        var word = filledSlots[data.index];
        if (word !== null) {
          filledSlots[data.index] = null;
          returnWordToCandidates(word);
          rebuildSlots();
        }
      }
    } catch (_) {}
  });

  /* ---- Navigation ---- */
  document.getElementById('next-btn').addEventListener('click', function () {
    endTask('next');
  });

  var backBtn = document.getElementById('back-btn');
  if (backBtn) {
    backBtn.addEventListener('click', function () {
      endTask('back');
    });
  }

  document.getElementById('exit-btn').addEventListener('click', function () {
    endTask('exit');
  });

  document.getElementById('review-btn').addEventListener('click', function () {
    alert('Review panel will be available after completing all questions.');
  });

  /* ---- Help ---- */
  document.getElementById('help-btn').addEventListener('click', function () {
    document.getElementById('help-modal-overlay').classList.add('open');
  });
  document.getElementById('help-modal-close').addEventListener('click', function () {
    document.getElementById('help-modal-overlay').classList.remove('open');
  });
  document.getElementById('help-modal-overlay').addEventListener('click', function (e) {
    if (e.target === this) this.classList.remove('open');
  });

  startTimer();
})();
