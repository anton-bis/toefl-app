import { DOM } from '../core/utils.js';

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export class BuildSentence {
  constructor(options = {}) {
    this.options = {
      speakerA: { name: 'Speaker A', text: '' },
      speakerB: { name: 'Speaker B' },
      slots: [],
      candidates: [],
      onAnswerChange: null,
      ...options
    };

    this.filledValues = this.options.slots.filter(s => s.type === 'blank').map(() => null);

    this._remainingCandidates = shuffle([...this.options.candidates]);
    this._checked = false;
    this.element = null;
    this._slotEls = [];
    this._candidateEls = [];
  }

  render() {
    this.element = DOM.create('div', {
      className: 'build-sentence-container'
    });

    const rowContainer = DOM.create('div', {
      style: {
        display: 'flex',
        gap: '12px',
        alignItems: 'flex-start',
        marginBottom: '20px'
      }
    });

    const avatarColumn = DOM.create('div', {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        flexShrink: 0,
        width: '40px'
      }
    });

    avatarColumn.appendChild(this._createAvatar(this.options.speakerA.name));
    avatarColumn.appendChild(this._createAvatar(this.options.speakerB.name));

    const textColumn = DOM.create('div', {
      style: { flex: 1, minWidth: 0 }
    });

    const speakerAText = DOM.create('div', {
      textContent: `${this.options.speakerA.name}: ${this.options.speakerA.text}`,
      style: {
        fontSize: '15px',
        lineHeight: '1.5',
        color: '#333',
        marginBottom: '16px',
        padding: '8px 0'
      }
    });
    textColumn.appendChild(speakerAText);

    const speakerBLine = DOM.create('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '4px',
        fontSize: '15px',
        color: '#333',
        padding: '8px 0'
      }
    });

    const speakerBLabel = DOM.create('span', {
      textContent: `${this.options.speakerB.name}: `,
      style: { fontWeight: 500, whiteSpace: 'nowrap' }
    });
    speakerBLine.appendChild(speakerBLabel);

    this._slotEls = [];
    let blankIdx = 0;
    this.options.slots.forEach((slot, i) => {
      if (slot.type === 'text') {
        const textSpan = DOM.create('span', {
          textContent: slot.value,
          style: { whiteSpace: 'pre-wrap' }
        });
        this._slotEls.push({ type: 'text', el: textSpan });
        speakerBLine.appendChild(textSpan);
      } else {
        const blankEl = this._createBlankSlot(blankIdx, i);
        this._slotEls.push({ type: 'blank', el: blankEl, idx: blankIdx, slotIndex: i });
        blankIdx++;
        speakerBLine.appendChild(blankEl);
      }
    });
    textColumn.appendChild(speakerBLine);

    rowContainer.appendChild(avatarColumn);
    rowContainer.appendChild(textColumn);
    this.element.appendChild(rowContainer);

    const candidatesArea = this._createCandidatesArea();
    this.element.appendChild(candidatesArea);

    return this.element;
  }

  _createAvatar(name) {
    const avatar = DOM.create('div', {
      style: {
        width: '36px',
        height: '36px',
        borderRadius: '50%',
        backgroundColor: '#e0e0e0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }
    });
    avatar.innerHTML = '<i class="fas fa-user-circle" style="font-size:36px;color:#999;"></i>';
    return avatar;
  }

  _createBlankSlot(blankIdx, slotIndex) {
    const isFilled = this.filledValues[blankIdx] !== null;
    const isChecked = this._checked;

    let bg = '#fff';
    let bc = '#bbb';
    let content = '';

    if (this._checked && isFilled) {
      const correctAnswer = this.options.slots[slotIndex].answer;
      const userVal = this.filledValues[blankIdx];
      if (correctAnswer && userVal && userVal.toLowerCase() === correctAnswer.toLowerCase()) {
        bg = '#E8F5E9';
        bc = '#4CAF50';
      } else {
        bg = '#FFEBEE';
        bc = '#F44336';
      }
    } else if (isFilled) {
      bg = '#E3F2FD';
      bc = '#2196F3';
    }

    if (isFilled) {
      const userVal = this.filledValues[blankIdx];
      const displayVal = userVal.length > 12 ? userVal.substring(0, 12) + '...' : userVal;
      content = displayVal;
    } else if (this._checked) {
      content = '';
    }

    const el = DOM.create('div', {
      className: 'bs-blank',
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: content ? 'auto' : '40px',
        padding: content ? '4px 10px' : '4px 0',
        height: '32px',
        border: isFilled || this._checked ? `2px solid ${bc}` : '2px dashed #bbb',
        borderRadius: '6px',
        backgroundColor: bg,
        fontSize: '15px',
        color: '#222',
        cursor: isFilled ? 'pointer' : 'default',
        verticalAlign: 'middle',
        transition: 'all 0.15s'
      },
      textContent: content
    });

    el.draggable = isFilled;

    el.addEventListener('click', () => {
      if (this._checked) return;
      if (isFilled) {
        this._removeFromSlot(blankIdx);
      }
    });

    if (isFilled) {
      el.addEventListener('dragstart', e => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', JSON.stringify({ source: 'slot', index: blankIdx }));
        this._dragSource = { type: 'slot', index: blankIdx };
      });
      el.addEventListener('dragend', () => {
        this._dragSource = null;
        this._clearAllHighlights();
      });
    }

    el.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      el.style.borderColor = '#007A66';
      el.style.backgroundColor = 'rgba(0,122,102,0.08)';
    });

    el.addEventListener('dragleave', () => {
      el.style.borderColor = isFilled ? (this._checked ? bc : '#2196F3') : '#bbb';
      el.style.backgroundColor = bg;
    });

    el.addEventListener('drop', e => {
      e.preventDefault();
      el.style.borderColor = isFilled ? (this._checked ? bc : '#2196F3') : '#bbb';
      el.style.backgroundColor = bg;
      if (this._checked) return;
      try {
        const data = JSON.parse(e.dataTransfer.getData('text/plain'));
        if (data.source === 'candidate') {
          if (isFilled) {
            const oldWord = this.filledValues[blankIdx];
            this._removeFromSlot(blankIdx, true);
            this.filledValues[blankIdx] = data.text;
            this._remainingCandidates = this._remainingCandidates.filter(c => c !== data.text);
            if (oldWord && !this._remainingCandidates.includes(oldWord)) {
              this._remainingCandidates.push(oldWord);
            }
          } else {
            this.filledValues[blankIdx] = data.text;
            this._remainingCandidates = this._remainingCandidates.filter(c => c !== data.text);
          }
        } else if (data.source === 'slot' && data.index !== blankIdx) {
          const temp = this.filledValues[blankIdx];
          this.filledValues[blankIdx] = this.filledValues[data.index];
          this.filledValues[data.index] = temp;
        }
        this._rebuild();
      } catch (_) {}
    });

    return el;
  }

  _createCandidateChip(text) {
    const el = DOM.create('div', {
      textContent: text,
      draggable: 'true',
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        padding: '6px 16px',
        border: '1px solid #ccc',
        borderRadius: '20px',
        backgroundColor: '#fff',
        fontSize: '15px',
        color: '#333',
        cursor: 'pointer',
        transition: 'all 0.15s',
        userSelect: 'none'
      }
    });

    el.addEventListener('click', () => {
      if (this._checked) return;
      const idx = this.filledValues.findIndex(v => v === null);
      if (idx !== -1) {
        this.filledValues[idx] = text;
        this._remainingCandidates = this._remainingCandidates.filter(c => c !== text);
        this._rebuild();
      }
    });

    el.addEventListener('dragstart', e => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', JSON.stringify({ source: 'candidate', text }));
      this._dragSource = { type: 'candidate', text };
    });

    el.addEventListener('dragend', () => {
      this._dragSource = null;
      this._clearAllHighlights();
    });

    return el;
  }

  _removeFromSlot(blankIdx, silent = false) {
    const word = this.filledValues[blankIdx];
    if (word !== null) {
      this.filledValues[blankIdx] = null;
      if (!this._remainingCandidates.includes(word)) {
        this._remainingCandidates.push(word);
      }
      if (!silent) this._rebuild();
    }
  }

  _clearAllHighlights() {
    this._slotEls.forEach(s => {
      if (s.type === 'blank') {
        s.el.style.borderColor = '#bbb';
        s.el.style.backgroundColor = '#fff';
      }
    });
  }

  _createCandidatesArea() {
    const wrapper = DOM.create('div', {
      style: {
        display: 'flex',
        justifyContent: 'center',
        flexWrap: 'wrap',
        gap: '10px',
        padding: '12px 0',
        minHeight: '48px'
      }
    });

    wrapper.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });

    wrapper.addEventListener('drop', e => {
      e.preventDefault();
      if (this._checked) return;
      try {
        const data = JSON.parse(e.dataTransfer.getData('text/plain'));
        if (data.source === 'slot') {
          this._removeFromSlot(data.index);
        }
      } catch (_) {}
    });

    this._candidateEls = [];
    this._remainingCandidates.forEach(text => {
      const chip = this._createCandidateChip(text);
      this._candidateEls.push({ text, el: chip });
      wrapper.appendChild(chip);
    });

    return wrapper;
  }

  _rebuild() {
    if (!this.element) return;
    this._checked = false;
    this._slotEls = [];
    this._candidateEls = [];

    const container = this.element;

    DOM.clear(container);

    const rowContainer = DOM.create('div', {
      style: {
        display: 'flex',
        gap: '12px',
        alignItems: 'flex-start',
        marginBottom: '20px'
      }
    });

    const avatarColumn = DOM.create('div', {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        flexShrink: 0,
        width: '40px'
      }
    });
    avatarColumn.appendChild(this._createAvatar(this.options.speakerA.name));
    avatarColumn.appendChild(this._createAvatar(this.options.speakerB.name));

    const textColumn = DOM.create('div', { style: { flex: 1, minWidth: 0 } });

    const speakerAText = DOM.create('div', {
      textContent: `${this.options.speakerA.name}: ${this.options.speakerA.text}`,
      style: {
        fontSize: '15px',
        lineHeight: '1.5',
        color: '#333',
        marginBottom: '16px',
        padding: '8px 0'
      }
    });
    textColumn.appendChild(speakerAText);

    const speakerBLine = DOM.create('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '4px',
        fontSize: '15px',
        color: '#333',
        padding: '8px 0'
      }
    });

    const speakerBLabel = DOM.create('span', {
      textContent: `${this.options.speakerB.name}: `,
      style: { fontWeight: 500, whiteSpace: 'nowrap' }
    });
    speakerBLine.appendChild(speakerBLabel);

    let blankIdx = 0;
    this.options.slots.forEach((slot, i) => {
      if (slot.type === 'text') {
        const textSpan = DOM.create('span', {
          textContent: slot.value,
          style: { whiteSpace: 'pre-wrap' }
        });
        this._slotEls.push({ type: 'text', el: textSpan });
        speakerBLine.appendChild(textSpan);
      } else {
        const blankEl = this._createBlankSlot(blankIdx, i);
        this._slotEls.push({ type: 'blank', el: blankEl, idx: blankIdx, slotIndex: i });
        blankIdx++;
        speakerBLine.appendChild(blankEl);
      }
    });
    textColumn.appendChild(speakerBLine);

    rowContainer.appendChild(avatarColumn);
    rowContainer.appendChild(textColumn);
    container.appendChild(rowContainer);

    const candidatesArea = this._createCandidatesArea();
    container.appendChild(candidatesArea);

    if (this.options.onAnswerChange) {
      this.options.onAnswerChange([...this.filledValues]);
    }
  }

  checkAnswers() {
    this._checked = true;
    if (!this.element) return;

    const blankSlots = this._slotEls.filter(s => s.type === 'blank');
    blankSlots.forEach((s, idx) => {
      const el = s.el;
      const correctAnswer = this.options.slots[s.slotIndex].answer;
      const userVal = this.filledValues[idx];

      let bg, bc;
      if (
        userVal !== null &&
        correctAnswer &&
        userVal.toLowerCase() === correctAnswer.toLowerCase()
      ) {
        bg = '#E8F5E9';
        bc = '#4CAF50';
      } else {
        bg = '#FFEBEE';
        bc = '#F44336';
      }

      el.style.backgroundColor = bg;
      el.style.borderColor = bc;
      el.style.borderStyle = 'solid';
      el.style.borderWidth = '2px';

      if (correctAnswer && (!userVal || userVal.toLowerCase() !== correctAnswer.toLowerCase())) {
        el.textContent = userVal || '';
        const hint = DOM.create('span', {
          textContent: ` (${correctAnswer})`,
          style: { fontSize: '12px', color: '#999', marginLeft: '2px' }
        });
        el.appendChild(hint);
      }
    });

    return this.filledValues.every((v, idx) => {
      const answer = this.options.slots.filter(s => s.type === 'blank')[idx]?.answer;
      return v !== null && answer && v.toLowerCase() === answer.toLowerCase();
    });
  }

  getUserAnswers() {
    return [...this.filledValues];
  }

  destroy() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    this.element = null;
    this._slotEls = [];
    this._candidateEls = [];
  }
}

export default BuildSentence;
