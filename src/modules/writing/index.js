import { store } from '@core/store.js';
import { loader } from '@core/loader.js';
import { parser } from '@core/parser.js';
import BuildSentence from '@components/BuildSentence.js';
import { DOM } from '@core/utils.js';

const TOTAL_TIME = 347; // 5分47秒

export default {
  name: 'writing',
  type: 'writing',

  state: {
    page: 'start', // 'start' | 'intro' | 'questions' |
    // 'email-intro' | 'email-questions' |
    // 'discussion-intro' | 'discussion-questions' |
    // 'results'
    currentQuestion: 0,
    questions: [],
    emailQuestion: null,
    discussionQuestion: null,
    userAnswers: {},
    isInitialized: false
  },

  _timerInterval: null,
  _remainingSeconds: TOTAL_TIME,
  _timerHidden: false,
  _overtime: 0,
  _unlimitedMode: false,
  _currentComponent: null,

  async init() {
    store.registerModule(this.name, {
      name: 'Writing',
      description: '托福写作练习模块',
      icon: '✏️'
    });
    store.activateModule(this.name);

    await this.loadQuestionBank();
    this.render();

    this.state.isInitialized = true;
  },

  async loadQuestionBank() {
    try {
      const questionFiles = await loader.scanQuestionBank('writing');
      if (questionFiles.length === 0) {
        await this.loadExampleData();
        return;
      }
      const markdown = await loader.load(questionFiles[0], 'markdown');
      const parsedData = parser.parse(markdown, 'writing');
      const standardizedData = parser.generateStandardJSON(parsedData);
      this.state.questions = this.extractQuestions(standardizedData);
      this._parseDiscussionFromMarkdown(markdown);
      store.setModuleQuestions(this.name, this.state.questions);
    } catch (error) {
      console.error('加载写作题库失败:', error);
      await this.loadExampleData();
    }
  },

  async loadExampleData() {
    this.state.questions = [
      {
        id: 1,
        type: 'build-sentence',
        taskTitle: 'Build a Sentence – 1',
        speakerA: { name: 'Speaker A', text: 'Were you able to complete the project on time?' },
        speakerB: { name: 'Speaker B' },
        slots: [
          { type: 'text', value: 'Unfortunately, I' },
          { type: 'blank', answer: 'did' },
          { type: 'blank', answer: 'not' },
          { type: 'blank', answer: 'meet' },
          { type: 'blank', answer: 'the deadline' },
          { type: 'text', value: '.' }
        ],
        candidates: ['did', 'not', 'the deadline', 'meet', 'no']
      }
    ];
    this.state.emailQuestion = {
      type: 'write-email',
      identity: 'You are a student. Write an email.',
      to: 'Jake',
      subject: 'Need your contribution',
      requirements: ['Requirement 1', 'Requirement 2', 'Requirement 3']
    };
    this.state.discussionQuestion = {
      subject: 'Physics',
      instructor: 'Dr. Anton',
      professor:
        'Today we discussed whether artificial intelligence will ultimately benefit or harm society.',
      students: [
        { name: 'Kelly', text: 'I believe AI will be a net positive for society.' },
        { name: 'Andrew', text: 'I am more cautious about AI impact.' }
      ],
      requirements: [
        'Express and support your opinion.',
        'Make a contribution to the discussion in your own words.'
      ]
    };
    store.setModuleQuestions(this.name, this.state.questions);
  },

  extractQuestions(parsedData) {
    const questions = [];
    parsedData.tasks.forEach(task => {
      if (task.type === 'build-sentence') {
        const q = task.questions?.[0];
        const answerSentence = q?.answer || '';

        const speakerBText = task.speakerB || '';

        const segments = speakerBText.split('____');
        const slots = [];
        segments.forEach((seg, i) => {
          const trimmed = seg.replace(/\\\./g, '.');
          if (i > 0) {
            slots.push({ type: 'blank', answer: '' });
          }
          if (trimmed) {
            slots.push({ type: 'text', value: trimmed });
          }
        });

        if (segments.length === 1) {
          const hasBlanks = speakerBText.includes('____');
          let blankCount = 0;
          let idx = speakerBText.indexOf('____');
          while (idx !== -1) {
            blankCount++;
            idx = speakerBText.indexOf('____', idx + 1);
          }
          for (let b = 0; b < blankCount; b++) {
            slots.push({ type: 'blank', answer: '' });
          }
        }

        let preText = '';
        let postText = '';
        if (segments.length > 1) {
          preText = segments[0].replace(/\\\./g, '.').trim();
          postText = segments[segments.length - 1].replace(/\\\./g, '.').trim();
        }

        let remainingAnswer = answerSentence.replace(/\\\./g, '.').trim();

        if (preText && remainingAnswer.startsWith(preText)) {
          remainingAnswer = remainingAnswer.substring(preText.length).trim();
        }
        if (postText && remainingAnswer.endsWith(postText)) {
          remainingAnswer = remainingAnswer
            .substring(0, remainingAnswer.length - postText.length)
            .trim();
        }
        if (remainingAnswer.endsWith('.')) {
          remainingAnswer = remainingAnswer.substring(0, remainingAnswer.length - 1).trim();
        }

        const candidates = task.candidates || [];
        const sortedCandidates = [...candidates].sort((a, b) => b.length - a.length);
        const answerWords = [];
        let remaining = remainingAnswer;

        while (remaining.length > 0 && sortedCandidates.length > 0) {
          remaining = remaining.trim();
          let matched = null;
          for (const cand of sortedCandidates) {
            const regex = new RegExp(
              '^' + cand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b',
              'i'
            );
            if (regex.test(remaining)) {
              matched = cand;
              break;
            }
          }
          if (matched) {
            answerWords.push(matched);
            const idx = remaining.toLowerCase().indexOf(matched.toLowerCase());
            remaining = remaining.substring(idx + matched.length);
          } else {
            const spaceIdx = remaining.indexOf(' ');
            if (spaceIdx === -1) break;
            remaining = remaining.substring(spaceIdx + 1);
          }
        }

        const blankSlots = slots.filter(s => s.type === 'blank');
        blankSlots.forEach((s, i) => {
          s.answer = answerWords[i] || '';
        });

        questions.push({
          id: q?.id || questions.length + 1,
          type: 'build-sentence',
          taskTitle: task.title,
          speakerA: { name: 'Speaker A', text: task.speakerA || '' },
          speakerB: { name: 'Speaker B' },
          slots,
          candidates
        });
      } else if (task.type === 'write-email') {
        // Parse email question from task data
        this.state.emailQuestion = {
          type: 'write-email',
          identity: task.taskDescription || '',
          to: '',
          subject: '',
          requirements: []
        };

        // Try to extract structured data from paragraph
        const para = task.paragraph || task.passage || '';
        const lines = para.split('\n');
        for (const line of lines) {
          const t = line.trim();
          if (t.startsWith('To:')) {
            this.state.emailQuestion.to = t.replace(/^To:\s*/, '').trim();
          } else if (t.startsWith('Subject:')) {
            this.state.emailQuestion.subject = t.replace(/^Subject:\s*/, '').trim();
          } else if (t.startsWith('- ') && this.state.emailQuestion.requirements.length < 10) {
            this.state.emailQuestion.requirements.push(t.replace(/^-\s*/, '').trim());
          } else if (t && !t.startsWith('Requirements')) {
            // Assume identity text
            if (!this.state.emailQuestion.identity || this.state.emailQuestion.identity === '') {
              this.state.emailQuestion.identity = t;
            }
          }
        }

        questions.push({
          id: questions.length + 1,
          type: 'write-email',
          taskTitle: task.title
        });
      } else if (task.type === 'academic-discussion') {
        this.state.discussionQuestion = {
          type: 'academic-discussion',
          subject: '',
          instructor: '',
          professor: '',
          students: [],
          requirements: []
        };

        const para = task.paragraph || task.passage || '';
        const lines = para.split('\n');
        for (const line of lines) {
          const t = line.trim();
          const colonIdx = t.indexOf(':');
          if (t.startsWith('Subject:')) {
            this.state.discussionQuestion.subject = t.replace(/^Subject:\s*/, '').trim();
          } else if (t.startsWith('Instructor:')) {
            this.state.discussionQuestion.instructor = t.replace(/^Instructor:\s*/, '').trim();
          } else if (t.startsWith('Professor:') || (colonIdx > 0 && /^[A-Z][a-z]+:/.test(t))) {
            if (t.startsWith('Professor:')) {
              this.state.discussionQuestion.professor = t.replace(/^Professor:\s*/, '').trim();
            } else {
              const name = t.substring(0, colonIdx).trim();
              const text = t.substring(colonIdx + 1).trim();
              if (name !== 'Requirements' && name !== 'Hint' && text) {
                this.state.discussionQuestion.students.push({ name, text });
              }
            }
          } else if (t.startsWith('- ')) {
            this.state.discussionQuestion.requirements.push(t.replace(/^-\s*/, '').trim());
          }
        }

        questions.push({
          id: questions.length + 1,
          type: 'academic-discussion',
          taskTitle: task.title
        });
      }
    });
    return questions;
  },

  _parseDiscussionFromMarkdown(markdown) {
    const lines = markdown.split('\n');
    let inDiscussion = false;
    let current = null;

    for (const line of lines) {
      const t = line.trim();
      if (t === '## Write for an Academic Discussion') {
        inDiscussion = true;
        current = { subject: '', instructor: '', professor: '', students: [], requirements: [] };
        continue;
      }
      if (!inDiscussion || !current) continue;
      if (t.startsWith('## ')) break;

      if (t.startsWith('### Write for an Academic Discussion')) {
        continue;
      }
      if (t.startsWith('Subject:')) {
        current.subject = t.replace(/^Subject:\s*/, '').trim();
      } else if (t.startsWith('Instructor:')) {
        current.instructor = t.replace(/^Instructor:\s*/, '').trim();
      } else if (t.startsWith('Professor:')) {
        current.professor = t.replace(/^Professor:\s*/, '').trim();
      } else if (t.startsWith('Requirements:')) {
        // skip
      } else if (t.startsWith('- ')) {
        current.requirements.push(t.replace(/^-\s*/, '').trim());
      } else if (/^[A-Z][a-z]+:/.test(t) && !t.startsWith('Hint:')) {
        const idx = t.indexOf(':');
        const name = t.substring(0, idx).trim();
        const text = t.substring(idx + 1).trim();
        if (name && text) {
          current.students.push({ name, text });
        }
      }
    }

    if (current) {
      this.state.discussionQuestion = current;
    }
  },

  render() {
    const appContainer = document.getElementById('app');
    if (!appContainer) return;
    DOM.clear(appContainer);

    switch (this.state.page) {
      case 'start':
        this.renderStartPage(appContainer);
        break;
      case 'intro':
        this.renderIntroPage(appContainer);
        break;
      case 'questions':
        this.renderQuestionPage(appContainer);
        break;
      case 'email-intro':
        this.renderEmailIntroPage(appContainer);
        break;
      case 'email-questions':
        this.renderEmailQuestionPage(appContainer);
        break;
      case 'discussion-intro':
        this.renderDiscussionIntroPage(appContainer);
        break;
      case 'discussion-questions':
        this.renderDiscussionQuestionPage(appContainer);
        break;
      case 'results':
        this.renderResultsPage(appContainer);
        break;
    }
  },

  _makeModuleContainer() {
    return DOM.create('div', {
      id: 'writing-module',
      className: 'module-container',
      style: {
        maxWidth: '800px',
        margin: '0 auto',
        padding: '20px',
        fontFamily: 'Arial, sans-serif'
      }
    });
  },

  _makeTitle(text) {
    return DOM.create(
      'div',
      {
        style: { textAlign: 'center', marginBottom: '8px' }
      },
      [
        DOM.create('h1', {
          textContent: text,
          style: {
            fontSize: '22px',
            fontWeight: 'bold',
            color: '#1d1d1f',
            margin: 0
          }
        }),
        DOM.create('div', {
          style: {
            width: '60px',
            height: '3px',
            backgroundColor: '#1d1d1f',
            margin: '6px auto 0'
          }
        })
      ]
    );
  },

  _makeSectionTitle(text) {
    return DOM.create('div', {
      textContent: text,
      style: {
        fontSize: '12px',
        fontWeight: 600,
        textTransform: 'uppercase',
        color: '#86868b',
        marginBottom: '24px'
      }
    });
  },

  _makeProgressBar() {
    const isIntro =
      this.state.page === 'intro' ||
      this.state.page === 'email-intro' ||
      this.state.page === 'discussion-intro';
    const container = DOM.create('div', {
      className: 'progress-container',
      style: {
        display: 'flex',
        justifyContent: isIntro ? 'flex-end' : 'space-between',
        alignItems: 'center',
        padding: '10px 14px',
        backgroundColor: '#f5f5f5',
        borderRadius: '8px',
        marginBottom: '24px'
      }
    });

    if (!isIntro) {
      const qProgress = DOM.create('div', {
        id: 'question-progress',
        textContent: `Question ${this.state.currentQuestion} of ${this.state.questions.length}`,
        style: { fontSize: '14px', color: '#666' }
      });
      container.appendChild(qProgress);
    }

    const timerWrap = DOM.create('div', {
      style: { display: 'flex', alignItems: 'center', gap: '8px' }
    });

    const timerDisplay = DOM.create('div', {
      id: 'timer-display',
      textContent: this._formatTime(this._remainingSeconds),
      style: {
        fontFamily: "'Courier New', monospace",
        fontSize: '18px',
        fontWeight: 'bold',
        color: '#007A66',
        backgroundColor: 'white',
        padding: '5px 10px',
        borderRadius: '4px',
        border: '1px solid #ddd'
      }
    });

    const hideBtn = DOM.create('button', {
      id: 'hide-time-btn',
      innerHTML: '<i class="fas fa-eye-slash"></i> Hide Time',
      style: {
        backgroundColor: '#f0f0f0',
        border: '1px solid #ddd',
        borderRadius: '4px',
        padding: '5px 10px',
        fontSize: '12px',
        color: '#666',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '5px'
      },
      onClick: () => this._toggleTimer()
    });

    timerWrap.appendChild(timerDisplay);
    timerWrap.appendChild(hideBtn);
    container.appendChild(timerWrap);
    return container;
  },

  _makeControls(leftBtns, rightBtns) {
    const container = DOM.create('div', {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: '28px',
        paddingTop: '18px',
        borderTop: '1px solid #eee'
      }
    });

    const left = DOM.create('div', { style: { display: 'flex', gap: '8px' } });
    leftBtns.forEach(b =>
      left.appendChild(this._makeButton(b.text, b.onClick, b.color, b.highlight))
    );

    const right = DOM.create('div', { style: { display: 'flex', gap: '8px' } });
    rightBtns.forEach(b => right.appendChild(this._makeButton(b.text, b.onClick, b.color)));

    container.appendChild(left);
    container.appendChild(right);
    return container;
  },

  _makeButton(text, onClick, color = '#007A66', highlight = false) {
    const btn = DOM.create('button', {
      textContent: text,
      style: {
        backgroundColor: highlight ? color : color || '#007A66',
        color: 'white',
        border: 'none',
        borderRadius: '5px',
        padding: '9px 20px',
        fontSize: '13px',
        cursor: 'pointer',
        backgroundColor: color || '#007A66'
      },
      onClick
    });
    return btn;
  },

  renderStartPage(appContainer) {
    this._stopTimer();
    const mc = this._makeModuleContainer();

    mc.appendChild(this._makeTitle('Writing Section'));
    mc.appendChild(
      DOM.create('p', {
        textContent:
          'In the writing section, you will answer 12 questions to demonstrate how well you can write in English. There are three types of tasks.',
        style: {
          fontSize: '15px',
          color: '#333',
          textAlign: 'left',
          lineHeight: '1.7',
          marginBottom: '24px'
        }
      })
    );

    const table = DOM.create('table', {
      style: {
        width: '100%',
        borderCollapse: 'collapse',
        border: '1px solid #e5e5e7',
        borderRadius: '8px',
        overflow: 'hidden',
        fontSize: '14px'
      }
    });

    const thead = DOM.create('thead');
    const headerRow = DOM.create('tr', {
      style: { backgroundColor: '#FFA07A' }
    });
    headerRow.appendChild(
      DOM.create('th', {
        textContent: 'Type of Task',
        style: {
          color: 'white',
          padding: '12px 16px',
          textAlign: 'left',
          fontWeight: 600,
          fontSize: '13px'
        }
      })
    );
    headerRow.appendChild(
      DOM.create('th', {
        textContent: 'Description',
        style: {
          color: 'white',
          padding: '12px 16px',
          textAlign: 'left',
          fontWeight: 600,
          fontSize: '13px'
        }
      })
    );
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = DOM.create('tbody');
    const taskTypes = [
      { type: 'Build a Sentence', desc: 'Create a grammatical sentence.' },
      { type: 'Write an Email', desc: 'Write an email using information provided.' },
      {
        type: 'Write for an Academic Discussion',
        desc: 'Participate in online discussions.'
      }
    ];

    taskTypes.forEach((row, idx) => {
      const tr = DOM.create('tr', {
        style: {
          borderBottom: idx < taskTypes.length - 1 ? '1px solid #f0f0f2' : 'none'
        }
      });
      tr.appendChild(
        DOM.create('td', {
          textContent: row.type,
          style: { padding: '12px 16px', color: '#333' }
        })
      );
      tr.appendChild(
        DOM.create('td', {
          textContent: row.desc,
          style: { padding: '12px 16px', color: '#333' }
        })
      );
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    mc.appendChild(table);

    mc.appendChild(
      this._makeControls(
        [{ text: 'Help', onClick: () => this._showHelp(), color: '#666' }],
        [
          {
            text: 'Begin',
            onClick: () => {
              this.state.page = 'intro';
              this._remainingSeconds = TOTAL_TIME;
              this._timerHidden = false;
              this.render();
            },
            color: '#007A66'
          }
        ]
      )
    );

    appContainer.appendChild(mc);
  },

  renderIntroPage(appContainer) {
    this._stopTimer();
    const mc = this._makeModuleContainer();

    mc.appendChild(this._makeSectionTitle('Writing'));
    mc.appendChild(this._makeTitle('Build a Sentence'));

    mc.appendChild(this._makeProgressBar());

    mc.appendChild(
      DOM.create('p', {
        textContent: 'Move the words in the boxes to create a grammatical sentence.',
        style: {
          fontSize: '15px',
          color: '#333',
          textAlign: 'left',
          lineHeight: '1.7',
          marginBottom: '0'
        }
      })
    );
    mc.appendChild(
      DOM.create('p', {
        textContent: ' ',
        style: { height: '16px', margin: 0 }
      })
    );
    mc.appendChild(
      DOM.create('p', {
        textContent: 'A clock will show you how much time you have to complete this task.',
        style: {
          fontSize: '15px',
          color: '#333',
          textAlign: 'left',
          lineHeight: '1.7'
        }
      })
    );

    mc.appendChild(
      this._makeControls(
        [{ text: 'Help', onClick: () => this._showHelp(), color: '#666' }],
        [
          {
            text: 'Begin',
            onClick: () => {
              this.state.page = 'questions';
              this.state.currentQuestion = 1;
              this._startTimer();
              this.render();
            },
            color: '#007A66'
          }
        ]
      )
    );

    this._updateTimerDisplay();
    appContainer.appendChild(mc);
  },

  renderEmailIntroPage(appContainer) {
    this._stopTimer();
    const mc = this._makeModuleContainer();

    mc.appendChild(this._makeSectionTitle('Writing'));
    mc.appendChild(this._makeTitle('Write an Email'));

    mc.appendChild(this._makeProgressBar());

    mc.appendChild(
      DOM.create('p', {
        textContent: 'You will read some information and use the information to write an email.',
        style: {
          fontSize: '15px',
          color: '#333',
          textAlign: 'left',
          lineHeight: '1.7',
          marginBottom: '0'
        }
      })
    );
    mc.appendChild(DOM.create('p', { textContent: ' ', style: { height: '16px', margin: 0 } }));
    mc.appendChild(
      DOM.create('p', {
        textContent: 'You will have 7 minutes to write the email.',
        style: { fontSize: '15px', color: '#333', textAlign: 'left', lineHeight: '1.7' }
      })
    );

    mc.appendChild(
      this._makeControls(
        [{ text: 'Help', onClick: () => this._showHelp(), color: '#666' }],
        [
          {
            text: 'Begin',
            onClick: () => {
              this.state.page = 'email-questions';
              this._remainingSeconds = 420;
              this._startTimer();
              this.render();
            },
            color: '#007A66'
          }
        ]
      )
    );

    this._updateTimerDisplay();
    appContainer.appendChild(mc);
  },

  renderDiscussionIntroPage(appContainer) {
    this._stopTimer();
    const mc = this._makeModuleContainer();

    mc.appendChild(this._makeSectionTitle('Writing'));
    mc.appendChild(this._makeTitle('Write for an Academic Discussion'));

    mc.appendChild(this._makeProgressBar());

    mc.appendChild(
      DOM.create('p', {
        textContent:
          'A professor has posted a question about a topic and students have responded with their thoughts and ideas. Make a contribution to the discussion.',
        style: {
          fontSize: '15px',
          color: '#333',
          textAlign: 'left',
          lineHeight: '1.7',
          marginBottom: '0'
        }
      })
    );
    mc.appendChild(DOM.create('p', { textContent: ' ', style: { height: '16px', margin: 0 } }));
    mc.appendChild(
      DOM.create('p', {
        textContent: 'You will have 10 minutes to write.',
        style: { fontSize: '15px', color: '#333', textAlign: 'left', lineHeight: '1.7' }
      })
    );

    mc.appendChild(
      this._makeControls(
        [{ text: 'Help', onClick: () => this._showHelp(), color: '#666' }],
        [
          {
            text: 'Begin',
            onClick: () => {
              this.state.page = 'discussion-questions';
              this._remainingSeconds = 600;
              this._startTimer();
              this.render();
            },
            color: '#007A66'
          }
        ]
      )
    );

    this._updateTimerDisplay();
    appContainer.appendChild(mc);
  },

  renderEmailQuestionPage(appContainer) {
    const mc = this._makeModuleContainer();
    mc.style.maxWidth = '100%';
    mc.style.padding = '0';

    const eq = this.state.emailQuestion || {};
    const requirementsHtml = (eq.requirements || []).map(r => '<li>' + r + '</li>').join('');

    mc.innerHTML = `
      <div style="display:flex;align-items:center;margin-bottom:16px">
        <div style="text-align:center;font-size:20px;font-weight:bold;color:#1d1d1f;margin-right:auto">Question 1 of 2</div>
      </div>
      ${this._makeProgressBarDom()}
      <div style="display:flex;gap:20px;margin-top:8px">
        <div style="width:35%;min-width:0">
          <div style="border:1px solid #d1d1d6;border-radius:12px;padding:4px 24px 20px;font-size:18px;line-height:1.5;color:#333">
            <div style="margin-bottom:18px">${eq.identity || ''}</div>
            <div style="font-weight:700;margin-bottom:16px">Write an email to ${eq.to || ''}. In your email, do the following:</div>
            <ul style="list-style-type:disc;padding-left:20px;margin:0 0 18px 0"><li>${(eq.requirements || []).join('</li><li>')}</li></ul>
            <p style="font-style:italic;color:#666;margin:0;padding-top:8px;border-top:1px solid #e5e5e7">Write as much as you can and in complete sentences.</p>
          </div>
        </div>
        <div style="flex:1;min-width:0;display:flex;flex-direction:column">
          <h2 style="font-size:20px;font-weight:700;margin:0 0 24px 0">Your Response:</h2>
          <div style="font-size:18px;font-weight:700;margin-bottom:4px">To: ${eq.to || ''}</div>
          <div style="font-size:18px;font-weight:700;margin-bottom:8px">Subject: ${eq.subject || ''}</div>
          <div style="border:1px solid #d1d1d6;border-radius:8px;overflow:hidden;flex:1;display:flex;flex-direction:column;min-height:0">
            <div style="background:#f0f0f2;padding:8px 12px;display:flex;justify-content:space-between;align-items:center;flex-shrink:0">
              <div style="display:flex;gap:4px">
                <button id="email-cut-btn" style="padding:5px 10px;border:1px solid #ddd;border-radius:4px;background:#fff;font-size:14px;cursor:pointer"><i class="fas fa-cut"></i> Cut</button>
                <button id="email-paste-btn" style="padding:5px 10px;border:1px solid #ddd;border-radius:4px;background:#fff;font-size:14px;cursor:pointer"><i class="fas fa-paste"></i> Paste</button>
                <button id="email-undo-btn" style="padding:5px 10px;border:1px solid #ddd;border-radius:4px;background:#fff;font-size:14px;cursor:pointer"><i class="fas fa-undo"></i> Undo</button>
                <button id="email-redo-btn" style="padding:5px 10px;border:1px solid #ddd;border-radius:4px;background:#fff;font-size:14px;cursor:pointer"><i class="fas fa-redo"></i> Redo</button>
              </div>
              <div style="display:flex;align-items:center;gap:10px">
                <button id="email-hide-wc-btn" style="background:none;border:1px solid #ccc;border-radius:4px;padding:4px 10px;font-size:13px;cursor:pointer;color:#666"><i class="fas fa-eye-slash"></i> Hide Word Count</button>
                <span id="email-word-count" style="font-size:14px;color:#666;min-width:70px;text-align:right">Words: 0</span>
              </div>
            </div>
            <textarea id="email-textarea" placeholder="Enter your response here..." style="width:100%;flex:1;border:none;border-top:1px solid #d1d1d6;padding:12px 14px;font-size:18px;line-height:1.5;resize:none;overflow-y:auto;box-sizing:border-box;outline:none;font-family:Arial,sans-serif"></textarea>
          </div>
        </div>
      </div>
    `;

    mc.appendChild(
      this._makeControls(
        [
          {
            text: 'Exit',
            onClick: () => {
              this._stopTimer();
              this.state.page = 'start';
              this.render();
            },
            color: '#999'
          },
          { text: 'Help', onClick: () => this._showHelp(), color: '#666' }
        ],
        [
          { text: 'Back', onClick: () => this._goBack(), color: '#666' },
          { text: 'Next', onClick: () => this._goNext(), color: '#4CAF50' }
        ]
      )
    );

    appContainer.appendChild(mc);

    // Initialize email writing toolbar
    setTimeout(() => this._initEmailToolbar(), 50);
  },

  renderDiscussionQuestionPage(appContainer) {
    const mc = this._makeModuleContainer();
    mc.style.maxWidth = '100%';
    mc.style.padding = '0';

    const dq = this.state.discussionQuestion || {};
    const s1 = (dq.students || [])[0] || {};
    const s2 = (dq.students || [])[1] || {};
    const subject = dq.subject || '';
    const instructor = dq.instructor || '';

    mc.innerHTML = `
      <div style="display:flex;align-items:center;margin-bottom:16px">
        <div style="text-align:center;font-size:20px;font-weight:bold;color:#1d1d1f;margin-right:auto">Question 2 of 2</div>
      </div>
      ${this._makeProgressBarDom()}
      <div style="display:flex;gap:20px;margin-top:8px;flex:1;min-height:0">
        <div style="width:35%;min-width:0;display:flex;flex-direction:column">
          <div style="border:1px solid #d1d1d6;border-radius:12px;padding:4px 24px 20px;font-size:18px;line-height:1.5;color:#333;flex:1;min-height:0;overflow-y:auto">
            <div style="margin-bottom:18px">Your professor is teaching a class on ${subject}. Write a post responding to the professor's questions.</div>
            <div style="font-weight:700;margin-bottom:16px">In your response, you should do the following:</div>
            <ul style="list-style-type:disc;padding-left:20px;margin:0 0 18px 0">
              <li>Express and support your opinion.</li>
              <li>Make a contribution to the discussion in your own words.</li>
            </ul>
            <p style="font-style:italic;color:#666;margin:0 0 12px 0;padding-top:8px;border-top:1px solid #e5e5e7">An effective response will contain at least 100 words.</p>
            <div style="display:flex;flex-direction:column;align-items:center;margin-top:12px">
              <div style="width:108px;height:108px;border-radius:50%;background:#e8e8ed;display:flex;align-items:center;justify-content:center;color:#aaa;font-size:48px;flex-shrink:0"><i class="fas fa-user-circle"></i></div>
              <div style="font-size:14px;font-weight:600;color:#1d1d1f;margin-top:4px;text-align:center">${instructor}</div>
            </div>
            <div style="font-size:18px;line-height:1.5;color:#333;margin-top:12px">${dq.professor || ''}</div>
          </div>
        </div>
        <div style="flex:1;min-width:0;display:flex;flex-direction:column">
          <div style="margin-bottom:12px;flex-shrink:0">
            <div style="display:flex;gap:12px;align-items:flex-start;margin-bottom:16px">
              <div style="display:flex;flex-direction:column;align-items:center;min-width:72px">
                <div style="width:72px;height:72px;border-radius:50%;background:#e8e8ed;display:flex;align-items:center;justify-content:center;color:#aaa;font-size:32px;flex-shrink:0"><i class="fas fa-user-circle"></i></div>
                <div style="font-size:13px;font-weight:600;color:#1d1d1f;margin-top:4px;text-align:center">${s1.name || ''}</div>
              </div>
              <div style="flex:1;min-width:0;font-size:18px;line-height:1.5;color:#333;white-space:pre-wrap">${s1.text || ''}</div>
            </div>
            <div style="display:flex;gap:12px;align-items:flex-start;margin-bottom:16px">
              <div style="display:flex;flex-direction:column;align-items:center;min-width:72px">
                <div style="width:72px;height:72px;border-radius:50%;background:#e8e8ed;display:flex;align-items:center;justify-content:center;color:#aaa;font-size:32px;flex-shrink:0"><i class="fas fa-user-circle"></i></div>
                <div style="font-size:13px;font-weight:600;color:#1d1d1f;margin-top:4px;text-align:center">${s2.name || ''}</div>
              </div>
              <div style="flex:1;min-width:0;font-size:18px;line-height:1.5;color:#333;white-space:pre-wrap">${s2.text || ''}</div>
            </div>
          </div>
          <div style="border:1px solid #d1d1d6;border-radius:8px;overflow:hidden;flex:1;display:flex;flex-direction:column;min-height:0">
            <div style="background:#f0f0f2;padding:8px 12px;display:flex;justify-content:space-between;align-items:center;flex-shrink:0">
              <div style="display:flex;gap:4px">
                <button id="disc-cut-btn" style="padding:5px 10px;border:1px solid #ddd;border-radius:4px;background:#fff;font-size:14px;cursor:pointer"><i class="fas fa-cut"></i> Cut</button>
                <button id="disc-paste-btn" style="padding:5px 10px;border:1px solid #ddd;border-radius:4px;background:#fff;font-size:14px;cursor:pointer"><i class="fas fa-paste"></i> Paste</button>
                <button id="disc-undo-btn" style="padding:5px 10px;border:1px solid #ddd;border-radius:4px;background:#fff;font-size:14px;cursor:pointer"><i class="fas fa-undo"></i> Undo</button>
                <button id="disc-redo-btn" style="padding:5px 10px;border:1px solid #ddd;border-radius:4px;background:#fff;font-size:14px;cursor:pointer"><i class="fas fa-redo"></i> Redo</button>
              </div>
              <div style="display:flex;align-items:center;gap:10px">
                <button id="disc-hide-wc-btn" style="background:none;border:1px solid #ccc;border-radius:4px;padding:4px 10px;font-size:13px;cursor:pointer;color:#666"><i class="fas fa-eye-slash"></i> Hide Word Count</button>
                <span id="disc-word-count" style="font-size:14px;color:#666;min-width:70px;text-align:right">Words: 0</span>
              </div>
            </div>
            <textarea id="disc-textarea" placeholder="Enter your response here..." style="width:100%;flex:1;border:none;border-top:1px solid #d1d1d6;padding:12px 14px;font-size:18px;line-height:1.5;resize:none;overflow-y:auto;box-sizing:border-box;outline:none;font-family:Arial,sans-serif"></textarea>
          </div>
        </div>
      </div>
    `;

    mc.appendChild(
      this._makeControls(
        [
          {
            text: 'Exit',
            onClick: () => {
              this._stopTimer();
              this.state.page = 'start';
              this.render();
            },
            color: '#999'
          },
          { text: 'Help', onClick: () => this._showHelp(), color: '#666' }
        ],
        [
          { text: 'Back', onClick: () => this._goBack(), color: '#666' },
          { text: 'Next', onClick: () => this._goNext(), color: '#4CAF50' }
        ]
      )
    );

    appContainer.appendChild(mc);

    setTimeout(() => this._initDiscussionToolbar(), 50);
  },

  _makeProgressBarDom() {
    // Returns the progress bar as an HTML string for use with innerHTML
    const mins = Math.floor(this._remainingSeconds / 60);
    const secs = this._remainingSeconds % 60;
    const time = String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
    return (
      '<div style="display:flex;justify-content:flex-end;align-items:center;padding:10px 14px;background:#f5f5f5;border-radius:8px;margin-bottom:8px"><div style="display:flex;align-items:center;gap:8px"><div id="timer-display" style="font-family:\'Courier New\',monospace;font-size:16px;font-weight:bold;color:#222;background:white;padding:5px 10px;border-radius:4px;border:1px solid #ddd">' +
      time +
      '</div><button id="hide-time-btn" style="background:#f0f0f0;border:1px solid #ddd;border-radius:4px;padding:5px 10px;font-size:12px;color:#666;cursor:pointer;display:flex;align-items:center;gap:5px"><i class="fas fa-eye-slash"></i> Hide Time</button></div></div>'
    );
  },

  _initEmailToolbar() {
    const textarea = document.getElementById('email-textarea');
    if (!textarea) return;

    const wordCountEl = document.getElementById('email-word-count');
    const undoStack = [];
    const redoStack = [];
    const MAX_HISTORY = 50;

    function countWords(text) {
      if (!text || !text.trim()) return 0;
      return text
        .trim()
        .split(/\s+/)
        .filter(w => w.length > 0).length;
    }

    function pushUndo(text) {
      if (undoStack.length >= MAX_HISTORY) undoStack.shift();
      undoStack.push(text);
    }

    function updateWC() {
      wordCountEl.textContent = 'Words: ' + countWords(textarea.value);
    }

    textarea.addEventListener('beforeinput', function (e) {
      if (e.data && /[\u4e00-\u9fff\u3400-\u4dbf\u3000-\u303f\uff00-\uffef]/.test(e.data)) {
        e.preventDefault();
      }
    });

    textarea.addEventListener('input', function () {
      var filtered = textarea.value.replace(
        /[\u4e00-\u9fff\u3400-\u4dbf\u3000-\u303f\uff00-\uffef]/g,
        ''
      );
      if (filtered !== textarea.value) textarea.value = filtered;
      updateWC();
    });

    textarea.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === 'Backspace' || e.key === 'Delete' || e.key === ' ') {
        pushUndo(textarea.value);
        redoStack.length = 0;
      }
    });

    textarea.addEventListener('paste', function () {
      setTimeout(function () {
        pushUndo(textarea.value);
        redoStack.length = 0;
        updateWC();
      }, 0);
    });

    function cut() {
      var s = textarea.selectionStart,
        e2 = textarea.selectionEnd;
      if (s === e2) return;
      navigator.clipboard.writeText(textarea.value.substring(s, e2)).catch(function () {});
      pushUndo(textarea.value);
      redoStack.length = 0;
      textarea.value = textarea.value.substring(0, s) + textarea.value.substring(e2);
      textarea.selectionStart = textarea.selectionEnd = s;
      textarea.focus();
      updateWC();
    }

    function paste() {
      navigator.clipboard
        .readText()
        .then(function (t) {
          if (!t) return;
          var s = textarea.selectionStart,
            e2 = textarea.selectionEnd;
          pushUndo(textarea.value);
          redoStack.length = 0;
          textarea.value = textarea.value.substring(0, s) + t + textarea.value.substring(e2);
          var np = s + t.length;
          textarea.selectionStart = textarea.selectionEnd = np;
          textarea.focus();
          updateWC();
        })
        .catch(function () {});
    }

    function undo() {
      if (!undoStack.length) return;
      redoStack.push(textarea.value);
      textarea.value = undoStack.pop();
      textarea.focus();
      updateWC();
    }

    function redo() {
      if (!redoStack.length) return;
      pushUndo(textarea.value);
      textarea.value = redoStack.pop();
      textarea.focus();
      updateWC();
    }

    var cutBtn = document.getElementById('email-cut-btn');
    var pasteBtn = document.getElementById('email-paste-btn');
    var undoBtn = document.getElementById('email-undo-btn');
    var redoBtn = document.getElementById('email-redo-btn');
    var hideWcBtn = document.getElementById('email-hide-wc-btn');
    var wcVisible = true;

    if (cutBtn) cutBtn.addEventListener('click', cut);
    if (pasteBtn) pasteBtn.addEventListener('click', paste);
    if (undoBtn) undoBtn.addEventListener('click', undo);
    if (redoBtn) redoBtn.addEventListener('click', redo);
    if (hideWcBtn) {
      hideWcBtn.addEventListener('click', function () {
        wcVisible = !wcVisible;
        wordCountEl.style.visibility = wcVisible ? 'visible' : 'hidden';
        hideWcBtn.innerHTML = wcVisible
          ? '<i class="fas fa-eye-slash"></i> Hide Word Count'
          : '<i class="fas fa-eye"></i> Show Word Count';
      });
    }

    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    });

    updateWC();
  },

  _initDiscussionToolbar() {
    const textarea = document.getElementById('disc-textarea');
    if (!textarea) return;

    const wordCountEl = document.getElementById('disc-word-count');
    const undoStack = [];
    const redoStack = [];
    const MAX_HISTORY = 50;

    function countWords(text) {
      if (!text || !text.trim()) return 0;
      return text
        .trim()
        .split(/\s+/)
        .filter(w => w.length > 0).length;
    }

    function pushUndo(text) {
      if (undoStack.length >= MAX_HISTORY) undoStack.shift();
      undoStack.push(text);
    }

    function updateWC() {
      wordCountEl.textContent = 'Words: ' + countWords(textarea.value);
    }

    textarea.addEventListener('beforeinput', function (e) {
      if (e.data && /[\u4e00-\u9fff\u3400-\u4dbf\u3000-\u303f\uff00-\uffef]/.test(e.data)) {
        e.preventDefault();
      }
    });

    textarea.addEventListener('input', function () {
      var filtered = textarea.value.replace(
        /[\u4e00-\u9fff\u3400-\u4dbf\u3000-\u303f\uff00-\uffef]/g,
        ''
      );
      if (filtered !== textarea.value) textarea.value = filtered;
      updateWC();
    });

    textarea.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === 'Backspace' || e.key === 'Delete' || e.key === ' ') {
        pushUndo(textarea.value);
        redoStack.length = 0;
      }
    });

    textarea.addEventListener('paste', function () {
      setTimeout(function () {
        pushUndo(textarea.value);
        redoStack.length = 0;
        updateWC();
      }, 0);
    });

    function cut() {
      var s = textarea.selectionStart,
        e2 = textarea.selectionEnd;
      if (s === e2) return;
      navigator.clipboard.writeText(textarea.value.substring(s, e2)).catch(function () {});
      pushUndo(textarea.value);
      redoStack.length = 0;
      textarea.value = textarea.value.substring(0, s) + textarea.value.substring(e2);
      textarea.selectionStart = textarea.selectionEnd = s;
      textarea.focus();
      updateWC();
    }

    function paste() {
      navigator.clipboard
        .readText()
        .then(function (t) {
          if (!t) return;
          var s = textarea.selectionStart,
            e2 = textarea.selectionEnd;
          pushUndo(textarea.value);
          redoStack.length = 0;
          textarea.value = textarea.value.substring(0, s) + t + textarea.value.substring(e2);
          var np = s + t.length;
          textarea.selectionStart = textarea.selectionEnd = np;
          textarea.focus();
          updateWC();
        })
        .catch(function () {});
    }

    function undo() {
      if (!undoStack.length) return;
      redoStack.push(textarea.value);
      textarea.value = undoStack.pop();
      textarea.focus();
      updateWC();
    }

    function redo() {
      if (!redoStack.length) return;
      pushUndo(textarea.value);
      textarea.value = redoStack.pop();
      textarea.focus();
      updateWC();
    }

    var cutBtn = document.getElementById('disc-cut-btn');
    var pasteBtn = document.getElementById('disc-paste-btn');
    var undoBtn = document.getElementById('disc-undo-btn');
    var redoBtn = document.getElementById('disc-redo-btn');
    var hideWcBtn = document.getElementById('disc-hide-wc-btn');
    var wcVisible = true;

    if (cutBtn) cutBtn.addEventListener('click', cut);
    if (pasteBtn) pasteBtn.addEventListener('click', paste);
    if (undoBtn) undoBtn.addEventListener('click', undo);
    if (redoBtn) redoBtn.addEventListener('click', redo);
    if (hideWcBtn) {
      hideWcBtn.addEventListener('click', function () {
        wcVisible = !wcVisible;
        wordCountEl.style.visibility = wcVisible ? 'visible' : 'hidden';
        hideWcBtn.innerHTML = wcVisible
          ? '<i class="fas fa-eye-slash"></i> Hide Word Count'
          : '<i class="fas fa-eye"></i> Show Word Count';
      });
    }

    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    });

    updateWC();
  },

  renderQuestionPage(appContainer) {
    const mc = this._makeModuleContainer();

    mc.appendChild(
      DOM.create('div', {
        textContent: 'Make an appropriate sentence',
        style: {
          textAlign: 'center',
          fontSize: '20px',
          fontWeight: 'bold',
          color: '#1d1d1f',
          marginBottom: '24px'
        }
      })
    );

    mc.appendChild(this._makeProgressBar());

    const questionContainer = DOM.create('div', {
      id: 'writing-questions',
      style: { marginTop: '8px' }
    });
    mc.appendChild(questionContainer);

    const currentQuestion = this.state.questions[this.state.currentQuestion - 1];
    if (currentQuestion) {
      this._cleanupComponent();

      const savedAnswer = this.state.userAnswers[currentQuestion.id];
      const shuffledCandidates = savedAnswer
        ? this._rebuildRemainingCandidates(currentQuestion.candidates, savedAnswer.slots)
        : [...currentQuestion.candidates];

      this._currentComponent = new BuildSentence({
        speakerA: currentQuestion.speakerA,
        speakerB: currentQuestion.speakerB,
        slots: currentQuestion.slots,
        candidates: shuffledCandidates,
        onAnswerChange: filled => {
          this.state.userAnswers[currentQuestion.id] = {
            slots: [...filled]
          };
        }
      });

      const rendered = this._currentComponent.render();
      questionContainer.appendChild(rendered);

      if (savedAnswer) {
        this._currentComponent.filledValues = [...savedAnswer.slots];
        this._currentComponent._remainingCandidates = this._rebuildRemainingCandidates(
          currentQuestion.candidates,
          savedAnswer.slots
        );
        this._currentComponent._rebuild();
      }
    }

    mc.appendChild(
      this._makeControls(
        [
          {
            text: 'Exit',
            onClick: () => {
              this._stopTimer();
              this.state.page = 'start';
              this.render();
            },
            color: '#999'
          },
          { text: 'Help', onClick: () => this._showHelp(), color: '#666' },
          { text: 'Review', onClick: () => this._showReview(), color: '#666' },
          {
            text: 'Check Answers',
            onClick: () => this._checkAnswers(),
            color: '#FF9800',
            highlight: true
          }
        ],
        [
          {
            text: 'Back',
            onClick: () => this._goBack(),
            color: '#666'
          },
          {
            text: 'Next',
            onClick: () => this._goNext(),
            color: '#4CAF50'
          }
        ]
      )
    );

    this._updateTimerDisplay();
    appContainer.appendChild(mc);
  },

  _rebuildRemainingCandidates(allCandidates, filled) {
    const remaining = [...allCandidates];
    filled.forEach(v => {
      if (v !== null) {
        const idx = remaining.findIndex(c => c.toLowerCase() === v.toLowerCase());
        if (idx !== -1) remaining.splice(idx, 1);
      }
    });
    return remaining;
  },

  _cleanupComponent() {
    if (this._currentComponent) {
      if (this._currentComponent.getUserAnswers) {
        const currentQ = this.state.questions[this.state.currentQuestion - 1];
        if (currentQ) {
          const filled = this._currentComponent.getUserAnswers();
          this.state.userAnswers[currentQ.id] = { slots: [...filled] };
        }
      }
      this._currentComponent.destroy();
      this._currentComponent = null;
    }
  },

  _goBack() {
    if (this.state.page === 'email-questions') {
      this._saveElapsed();
      this._stopTimer();
      this.state.page = 'email-intro';
      this.render();
    } else if (this.state.page === 'email-intro') {
      this._stopTimer();
      this.state.page = 'questions';
      this.state.currentQuestion = this.state.questions.length;
      this.render();
    } else if (this.state.page === 'discussion-questions') {
      this._saveElapsed();
      this._stopTimer();
      this.state.page = 'discussion-intro';
      this.render();
    } else if (this.state.page === 'discussion-intro') {
      this._stopTimer();
      this.state.page = 'email-questions';
      this.render();
    } else if (this.state.currentQuestion > 1) {
      this.state.currentQuestion--;
      this.render();
    }
  },

  renderResultsPage(appContainer) {
    const elapsed = Number(localStorage.getItem('toefl_writing_elapsed') || '0');
    const emailResponse = localStorage.getItem('toefl_writing_email_response') || '';
    const discussionResponse = localStorage.getItem('toefl_writing_discussion_response') || '';

    const wordCount = text => {
      if (!text || !text.trim()) return 0;
      return text
        .trim()
        .split(/\s+/)
        .filter(w => w.length > 0).length;
    };
    const emailWC = wordCount(emailResponse);
    const discussionWC = wordCount(discussionResponse);

    const totalBlanks = { v: 0 };
    const correctBlanks = { v: 0 };
    const questionResults = [];

    (this.state.questions || []).forEach((q, qi) => {
      const userAnswer = this.state.userAnswers[q.id];
      const slots = q.slots || [];
      const blankSlots = slots.filter(s => s.type === 'blank');
      let qCorrect = 0;
      const slotResults = [];
      slots.forEach((slot, si) => {
        if (slot.type === 'blank') {
          const userVal = userAnswer ? userAnswer.slots[si] || '' : '';
          const isCorrect = userVal.toLowerCase().trim() === slot.answer.toLowerCase().trim();
          slotResults.push({
            type: 'blank',
            expected: slot.answer,
            userValue: userVal,
            correct: isCorrect
          });
          totalBlanks.v++;
          if (isCorrect) {
            qCorrect++;
            correctBlanks.v++;
          }
        } else {
          slotResults.push({ type: 'text', value: slot.value });
        }
      });
      questionResults.push({
        index: qi,
        title: q.taskTitle || 'Build a Sentence',
        speakerA: q.speakerA,
        slots: slotResults,
        correctCount: qCorrect,
        totalCount: blankSlots.length
      });
    });

    const T = '#008080';
    const D = '#1d1d1f';
    const M = '#86868b';
    const BG = '#f5f5f7';
    const CARD = '#ffffff';

    const pct = totalBlanks.v > 0 ? Math.round((correctBlanks.v / totalBlanks.v) * 100) : 0;
    const scoreColor = pct >= 90 ? '#27ae60' : pct >= 67 ? T : pct >= 33 ? '#f39c12' : '#e74c3c';

    const fmtTime = s => {
      const m = Math.floor(s / 60),
        sec = s % 60;
      return String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
    };

    const cardStyle = {
      background: CARD,
      borderRadius: '16px',
      boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
      padding: '28px',
      border: '1px solid rgba(0,0,0,0.04)'
    };
    const sectionStyle = { marginBottom: '24px' };

    const main = DOM.create('div', {
      style: {
        background: BG,
        minHeight: '100vh',
        fontFamily:
          "-apple-system, 'SF Pro Display', 'Avenir Next', 'Segoe UI', Roboto, Arial, sans-serif"
      }
    });

    const header = DOM.create('header', {
      className: 'header',
      style: {
        backgroundColor: T,
        color: 'white',
        padding: '15px 30px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        height: '60px'
      }
    });
    header.appendChild(
      DOM.create('div', {
        className: 'logo',
        textContent: 'toefl ibt',
        style: { fontSize: '36px', fontWeight: 'bold', color: 'white' }
      })
    );

    const navBtns = DOM.create('div', { style: { display: 'flex', gap: '12px' } });
    const navBtnStyle = {
      padding: '10px 20px',
      borderRadius: '8px',
      fontWeight: 600,
      fontSize: '14px',
      cursor: 'pointer',
      border: '2px solid rgba(255,255,255,0.3)',
      background: 'rgba(255,255,255,0.15)',
      color: 'white',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      transition: 'all 0.2s'
    };
    navBtns.appendChild(
      DOM.create('button', {
        innerHTML: '<i class="fas fa-question-circle"></i> Help',
        style: navBtnStyle,
        onClick: () =>
          window.showHelp(
            'Writing Results',
            'Review your performance across all three writing tasks.'
          )
      })
    );
    navBtns.appendChild(
      DOM.create('button', {
        innerHTML: '<i class="fas fa-home"></i> Home',
        style: navBtnStyle,
        onClick: () => {
          window.location.href = 'index.html';
        }
      })
    );
    header.appendChild(navBtns);
    main.appendChild(header);

    const wrapper = DOM.create('div', {
      style: { maxWidth: '820px', margin: '0 auto', padding: '40px 24px 60px' }
    });

    const hero = DOM.create('div', { style: { textAlign: 'center', marginBottom: '44px' } });
    hero.appendChild(
      DOM.create('i', {
        className: 'fas fa-check-circle',
        style: { fontSize: '44px', color: T, marginBottom: '10px', display: 'block' }
      })
    );
    hero.appendChild(
      DOM.create('h1', {
        textContent: 'Writing Section Completed',
        style: {
          fontSize: '32px',
          fontWeight: 700,
          color: D,
          margin: '0 0 4px',
          letterSpacing: '-0.3px'
        }
      })
    );
    hero.appendChild(
      DOM.create('p', {
        textContent: 'You have completed the TOEFL iBT Writing section.',
        style: { fontSize: '15px', color: M, margin: 0 }
      })
    );
    wrapper.appendChild(hero);

    const summaryRow = DOM.create('div', {
      style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '36px' }
    });

    const donutCard = DOM.create('div', {
      style: Object.assign({}, cardStyle, { textAlign: 'center', padding: '32px 20px' })
    });
    const circumference = 2 * Math.PI * 54;
    const donutHtml = DOM.create('div', {
      style: { position: 'relative', width: '140px', height: '140px', margin: '0 auto 8px' }
    });
    donutHtml.innerHTML =
      '<svg viewBox="0 0 140 140" style="width:100%;height:100%"><circle cx="70" cy="70" r="54" fill="none" stroke="#e9ecef" stroke-width="14" /><circle cx="70" cy="70" r="54" fill="none" stroke="' +
      scoreColor +
      '" stroke-width="14" stroke-linecap="round" class="donut-progress" style="transform:rotate(-90deg);transform-origin:50% 50%;stroke-dasharray:' +
      circumference +
      ';stroke-dashoffset:' +
      circumference +
      ';transition:stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)" /></svg><div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center"><div style="font-size:40px;font-weight:700;color:' +
      D +
      ';line-height:1">' +
      correctBlanks.v +
      '</div><div style="font-size:14px;color:' +
      M +
      '">/ ' +
      totalBlanks.v +
      '</div></div>';
    donutCard.appendChild(donutHtml);
    donutCard.appendChild(
      DOM.create('div', {
        textContent: 'Blanks Correct',
        style: {
          fontSize: '13px',
          color: M,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          fontWeight: 500
        }
      })
    );
    donutCard.appendChild(
      DOM.create('div', {
        textContent: correctBlanks.v + '/' + totalBlanks.v + ' blanks',
        style: { fontSize: '20px', fontWeight: 600, color: D, marginTop: '4px' }
      })
    );
    if (totalBlanks.v > 0) {
      donutCard.appendChild(
        DOM.create('div', {
          textContent: pct + '% accuracy',
          style: { fontSize: '14px', color: scoreColor, fontWeight: 600, marginTop: '2px' }
        })
      );
    }
    summaryRow.appendChild(donutCard);

    const statsCard = DOM.create('div', {
      style: Object.assign({}, cardStyle, {
        padding: '24px 28px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: '16px'
      })
    });
    const statRow = (icon, label, value) => {
      const r = DOM.create('div', {
        style: { display: 'flex', alignItems: 'center', gap: '12px' }
      });
      r.appendChild(
        DOM.create('i', {
          className: icon,
          style: { fontSize: '18px', color: T, width: '24px', textAlign: 'center' }
        })
      );
      r.appendChild(
        DOM.create('span', { textContent: label, style: { fontSize: '14px', color: M, flex: 1 } })
      );
      r.appendChild(
        DOM.create('span', {
          textContent: value,
          style: { fontSize: '16px', fontWeight: 600, color: D, fontVariantNumeric: 'tabular-nums' }
        })
      );
      return r;
    };
    statsCard.appendChild(
      statRow('fas fa-clock', 'Time Used', elapsed > 0 ? fmtTime(elapsed) : '--:--')
    );
    statsCard.appendChild(
      statRow('fas fa-envelope', 'Email Response', emailWC > 0 ? emailWC + ' words' : 'No response')
    );
    statsCard.appendChild(
      statRow(
        'fas fa-comments',
        'Discussion Response',
        discussionWC > 0 ? discussionWC + ' words' : 'No response'
      )
    );
    summaryRow.appendChild(statsCard);
    wrapper.appendChild(summaryRow);

    const sectionsContainer = DOM.create('div', { id: 'writing-results-sections', style: {} });

    const collapsibleSection = (title, icon, summaryLabel, contentFns, sectionId) => {
      const isBuildSentence = sectionId === 'build-sentence';
      const sec = DOM.create('div', {
        style: Object.assign({}, cardStyle, sectionStyle, { overflow: 'hidden', cursor: 'pointer' })
      });
      let expanded = false;
      const contentWrap = DOM.create('div', {
        style: {
          maxHeight: '0',
          overflow: 'hidden',
          transition: 'max-height 0.4s cubic-bezier(0.4,0,0.2,1), opacity 0.3s ease',
          opacity: '0'
        }
      });
      const contentInner = DOM.create('div', {
        style: { paddingTop: '20px', borderTop: '1px solid #e9ecef' }
      });
      if (isBuildSentence) {
        questionResults.forEach(qr => {
          const sentDiv = DOM.create('div', {
            style: { marginBottom: '20px', fontSize: '15px', lineHeight: '1.8', color: D }
          });
          let html = '';
          if (qr.speakerA) {
            html +=
              '<div style="font-size:13px;color:' +
              M +
              ';margin-bottom:4px;font-weight:500">' +
              (qr.speakerA.name || 'Speaker A') +
              ': ' +
              qr.speakerA.text +
              '</div>';
          }
          html += '<div style="font-size:15px;line-height:2">';
          qr.slots.forEach(s => {
            if (s.type === 'text') {
              html += '<span>' + s.value + '</span>';
            } else {
              const bg = s.correct ? '#d4edda' : '#f8d7da';
              const bc = s.correct ? '#28a745' : '#dc3545';
              const label = s.correct ? s.userValue : s.userValue || '(empty)';
              html +=
                '<span style="display:inline-block;background:' +
                bg +
                ';border:2px solid ' +
                bc +
                ';border-radius:6px;padding:2px 8px;margin:0 2px;font-weight:600;font-size:14px">' +
                label +
                '</span>';
              if (!s.correct) {
                html +=
                  '<span style="font-size:12px;color:' +
                  M +
                  ';margin-left:4px">→ ' +
                  s.expected +
                  '</span>';
              }
            }
          });
          html += '</div>';
          html +=
            '<div style="font-size:12px;color:' +
            M +
            ';margin-top:4px">' +
            qr.correctCount +
            '/' +
            qr.totalCount +
            ' correct</div>';
          sentDiv.innerHTML = html;
          contentInner.appendChild(sentDiv);
        });
      } else {
        contentFns.forEach(fn => fn(contentInner));
      }
      contentWrap.appendChild(contentInner);
      sec.appendChild(contentWrap);

      const headerRow = DOM.create('div', {
        style: { display: 'flex', alignItems: 'center', gap: '12px' }
      });
      const chevron = DOM.create('i', {
        className: 'fas fa-chevron-down',
        style: { fontSize: '14px', color: M, transition: 'transform 0.3s ease', flexShrink: 0 }
      });
      headerRow.appendChild(chevron);
      headerRow.appendChild(
        DOM.create('i', {
          className: icon,
          style: { fontSize: '18px', color: T, width: '22px', textAlign: 'center' }
        })
      );
      headerRow.appendChild(
        DOM.create('span', {
          textContent: title,
          style: { fontSize: '17px', fontWeight: 600, color: D, flex: 1 }
        })
      );
      if (summaryLabel) {
        headerRow.appendChild(
          DOM.create('span', {
            textContent: summaryLabel,
            style: {
              fontSize: '13px',
              fontWeight: 500,
              color: M,
              background: '#f1f3f5',
              padding: '4px 12px',
              borderRadius: '999px'
            }
          })
        );
      }
      sec.insertBefore(headerRow, contentWrap);

      sec.addEventListener('click', e => {
        if (e.target.closest('button')) return;
        expanded = !expanded;
        chevron.style.transform = expanded ? 'rotate(180deg)' : 'rotate(0deg)';
        contentWrap.style.maxHeight = expanded ? contentWrap.scrollHeight + 'px' : '0';
        contentWrap.style.opacity = expanded ? '1' : '0';
        requestAnimationFrame(() => {
          if (expanded) contentWrap.style.maxHeight = contentInner.scrollHeight + 80 + 'px';
        });
      });
      return {
        sec,
        contentWrap,
        toggle: () => {
          sec.click();
        },
        contentInner
      };
    };

    const bsCorrect = totalBlanks.v > 0 ? correctBlanks.v + '/' + totalBlanks.v + ' correct' : '';
    const bsSec = collapsibleSection(
      'Build a Sentence',
      'fas fa-puzzle-piece',
      bsCorrect,
      [],
      'build-sentence'
    );
    sectionsContainer.appendChild(bsSec.sec);

    const emSec = collapsibleSection(
      'Write an Email',
      'fas fa-envelope',
      emailWC > 0 ? emailWC + ' words' : 'No response',
      [
        ci => {
          if (emailResponse) {
            ci.appendChild(
              DOM.create('div', {
                textContent: emailResponse,
                style: {
                  fontSize: '15px',
                  lineHeight: '1.7',
                  color: D,
                  whiteSpace: 'pre-wrap',
                  background: '#f8f9fa',
                  borderRadius: '10px',
                  padding: '16px',
                  marginBottom: '12px'
                }
              })
            );
            ci.appendChild(
              DOM.create('div', {
                textContent: 'Word count: ' + emailWC,
                style: { fontSize: '13px', color: M }
              })
            );
          } else {
            ci.appendChild(
              DOM.create('div', {
                textContent: 'No response provided.',
                style: { fontSize: '15px', color: M, fontStyle: 'italic' }
              })
            );
          }
        }
      ],
      'email'
    );
    sectionsContainer.appendChild(emSec.sec);

    const discSec = collapsibleSection(
      'Academic Discussion',
      'fas fa-comments',
      discussionWC > 0 ? discussionWC + ' words' : 'No response',
      [
        ci => {
          if (discussionResponse) {
            ci.appendChild(
              DOM.create('div', {
                textContent: discussionResponse,
                style: {
                  fontSize: '15px',
                  lineHeight: '1.7',
                  color: D,
                  whiteSpace: 'pre-wrap',
                  background: '#f8f9fa',
                  borderRadius: '10px',
                  padding: '16px',
                  marginBottom: '12px'
                }
              })
            );
            const wcRow = DOM.create('div', {
              style: { display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px' }
            });
            wcRow.appendChild(
              DOM.create('span', {
                textContent: 'Word count: ' + discussionWC,
                style: { color: M }
              })
            );
            if (discussionWC < 100) {
              wcRow.appendChild(
                DOM.create('span', {
                  textContent: 'Try to write at least 100 words for an effective response.',
                  style: { color: '#e74c3c', fontStyle: 'italic' }
                })
              );
            }
            ci.appendChild(wcRow);
          } else {
            ci.appendChild(
              DOM.create('div', {
                textContent: 'No response provided.',
                style: { fontSize: '15px', color: M, fontStyle: 'italic' }
              })
            );
          }
        }
      ],
      'discussion'
    );
    sectionsContainer.appendChild(discSec.sec);

    wrapper.appendChild(sectionsContainer);

    const actions = DOM.create('div', {
      style: { display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '36px' }
    });
    const btnBase = {
      padding: '14px 32px',
      fontSize: '15px',
      fontWeight: 600,
      borderRadius: '10px',
      border: 'none',
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      transition: 'all 0.2s'
    };

    const allSections = [bsSec, emSec, discSec];

    actions.appendChild(
      DOM.create(
        'button',
        Object.assign(
          {},
          {
            textContent: 'Detailed Review',
            style: Object.assign({}, btnBase, { background: T, color: 'white' }),
            onClick: () => {
              let first = true;
              allSections.forEach(s => {
                s.toggle();
                if (first && s.contentInner.scrollHeight > 0) {
                  setTimeout(() => {
                    s.sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }, 100);
                  first = false;
                }
              });
            }
          }
        )
      )
    );

    actions.appendChild(
      DOM.create(
        'button',
        Object.assign(
          {},
          {
            textContent: 'Restart',
            style: Object.assign({}, btnBase, { background: '#e9e9ee', color: D }),
            onClick: () => {
              window.showConfirm(
                'Restart Test',
                'Are you sure you want to restart? Your writing responses will be cleared.',
                [
                  { text: 'Cancel', cls: 'cancel', onClick: () => {} },
                  {
                    text: 'Restart',
                    cls: 'primary',
                    onClick: () => {
                      [
                        'toefl_writing_elapsed',
                        'toefl_writing_email_response',
                        'toefl_writing_discussion_response',
                        'toefl_writing_overtime',
                        'toefl_writing_marked',
                        'toefl_writing_email_marked',
                        'toefl_writing_discussion_marked'
                      ].forEach(k => localStorage.removeItem(k));
                      [
                        'toefl_answers',
                        'toefl_marked_questions',
                        'toefl_timer_started',
                        'toefl_timer_remaining'
                      ].forEach(k => localStorage.removeItem(k));
                      this.state.page = 'start';
                      this.state.userAnswers = {};
                      this.state.currentQuestion = 0;
                      this.render();
                    }
                  }
                ],
                true
              );
            }
          }
        )
      )
    );

    wrapper.appendChild(actions);
    wrapper.appendChild(
      DOM.create('p', {
        textContent: 'Scoring based on TOEFL iBT Writing section rubric',
        style: { textAlign: 'center', color: '#bbb', fontSize: '12px', marginTop: '24px' }
      })
    );

    main.appendChild(wrapper);
    appContainer.appendChild(main);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const dp = document.querySelector('.donut-progress');
        if (dp)
          dp.style.strokeDashoffset =
            circumference * (1 - (totalBlanks.v > 0 ? correctBlanks.v / totalBlanks.v : 0));
      });
    });
  },

  _goNext() {
    if (this.state.currentQuestion < this.state.questions.length) {
      this.state.currentQuestion++;
      this.render();
    } else if (this.state.page === 'questions' && this.state.emailQuestion) {
      this._saveElapsed();
      this._stopTimer();
      this.state.page = 'email-intro';
      this.render();
    } else if (this.state.page === 'email-questions' && this.state.discussionQuestion) {
      this._saveElapsed();
      this._stopTimer();
      this.state.page = 'discussion-intro';
      this.render();
    } else if (this.state.page === 'discussion-questions') {
      this._saveElapsed();
      this._stopTimer();
      this.state.page = 'results';
      this.render();
    }
  },

  _checkAnswers() {
    if (this._currentComponent && this._currentComponent.checkAnswers) {
      this._currentComponent.checkAnswers();
    }
  },

  _startTimer() {
    if (this._timerInterval) return;
    var self = this;
    this._timerInterval = setInterval(() => {
      if (!this._unlimitedMode) {
        this._remainingSeconds = Math.max(0, this._remainingSeconds - 1);
        this._updateTimerDisplay();
        if (this._remainingSeconds <= 0) {
          this._stopTimer();
          this._showTimeUpModal();
        }
      } else {
        this._overtime++;
        localStorage.setItem('toefl_writing_overtime', String(this._overtime));
      }
    }, 1000);
  },

  _showTimeUpModal() {
    var self = this;
    var overlay = DOM.create('div', {
      style: {
        display: 'flex',
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0,0,0,0.6)',
        zIndex: 10000,
        justifyContent: 'center',
        alignItems: 'center'
      },
      id: 'timer-expired-modal'
    });

    var content = DOM.create('div', {
      style: {
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '30px 40px',
        maxWidth: '400px',
        textAlign: 'center',
        boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
      }
    });

    var title = DOM.create('div', {
      textContent: 'Time is Up!',
      style: { fontSize: '24px', fontWeight: 'bold', color: '#d32f2f', marginBottom: '15px' }
    });

    var text = DOM.create('div', {
      textContent:
        'Your time for this task has expired. You can continue working without time limit, or end this task to move on.',
      style: { fontSize: '16px', color: '#444', marginBottom: '25px', lineHeight: '1.5' }
    });

    var btnGroup = DOM.create('div', {
      style: { display: 'flex', gap: '15px', justifyContent: 'center' }
    });

    var continueBtn = DOM.create('button', {
      textContent: 'Continue',
      style: {
        padding: '12px 30px',
        fontSize: '15px',
        fontWeight: 600,
        borderRadius: '6px',
        cursor: 'pointer',
        border: 'none',
        backgroundColor: '#008080',
        color: 'white'
      },
      onClick: function () {
        overlay.remove();
        self._unlimitedMode = true;
        self._overtime = 0;
        var td = document.getElementById('timer-display');
        if (td) td.textContent = '--:--';
        self._timerInterval = setInterval(() => {
          self._overtime++;
          localStorage.setItem('toefl_writing_overtime', String(self._overtime));
        }, 1000);
      }
    });

    var endBtn = DOM.create('button', {
      textContent: 'End Task',
      style: {
        padding: '12px 30px',
        fontSize: '15px',
        fontWeight: 600,
        borderRadius: '6px',
        cursor: 'pointer',
        border: '1px solid #ccc',
        backgroundColor: '#f5f5f5',
        color: '#333'
      },
      onClick: function () {
        overlay.remove();
        self._saveElapsed();
      }
    });

    btnGroup.appendChild(continueBtn);
    btnGroup.appendChild(endBtn);
    content.appendChild(title);
    content.appendChild(text);
    content.appendChild(btnGroup);
    overlay.appendChild(content);
    document.body.appendChild(overlay);
  },

  _saveElapsed() {
    var dur = 0;
    if (this.state.page === 'email-questions') dur = 420;
    else if (this.state.page === 'discussion-questions') dur = 600;
    else dur = 347;
    var taskTime = dur + this._overtime;
    var elapsed = Number(localStorage.getItem('toefl_writing_elapsed') || '0');
    elapsed += taskTime;
    localStorage.setItem('toefl_writing_elapsed', String(elapsed));
    localStorage.removeItem('toefl_writing_overtime');
  },

  _stopTimer() {
    if (this._timerInterval) {
      clearInterval(this._timerInterval);
      this._timerInterval = null;
    }
  },

  _updateTimerDisplay() {
    const timerDisplay = document.getElementById('timer-display');
    if (!timerDisplay) return;
    const mins = Math.floor(this._remainingSeconds / 60);
    const secs = this._remainingSeconds % 60;
    timerDisplay.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    if (this._remainingSeconds <= 60) {
      timerDisplay.style.color = '#F44336';
      timerDisplay.style.backgroundColor = '#FFEBEE';
    }
  },

  _toggleTimer() {
    this._timerHidden = !this._timerHidden;
    const timerDisplay = document.getElementById('timer-display');
    const hideBtn = document.getElementById('hide-time-btn');
    if (timerDisplay) {
      timerDisplay.style.visibility = this._timerHidden ? 'hidden' : 'visible';
    }
    if (hideBtn) {
      hideBtn.innerHTML = this._timerHidden
        ? '<i class="fas fa-eye"></i> Show Time'
        : '<i class="fas fa-eye-slash"></i> Hide Time';
    }
  },

  _formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  },

  _showHelp() {
    alert(
      'Build a Sentence Help:\n\n1. Click a word in the word bank to place it into the first available blank.\n2. Click a filled blank to return the word to the bank.\n3. Drag and drop words to rearrange or swap positions.\n4. Click "Check Answers" to see which words are correct.'
    );
  },

  _showReview() {
    alert('Review will be available after completing all questions.');
  },

  destroy() {
    this._stopTimer();
    this._cleanupComponent();

    this.state = {
      page: 'start',
      currentQuestion: 0,
      questions: [],
      userAnswers: {},
      isInitialized: false
    };
  }
};
