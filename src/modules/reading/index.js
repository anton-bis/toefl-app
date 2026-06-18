/**
 * 阅读模块
 * 实现模块接口规范，接入核心框架
 */

import { store } from '../../core/store.js';
import { loader } from '../../core/loader.js';
import { parser } from '../../core/parser.js';
import FillBlank from '../../components/FillBlank.js';
import MultipleChoice from '../../components/MultipleChoice.js';
import ReadingPassage from '../../components/ReadingPassage.js';
import { DOM } from '../../core/utils.js';

export default {
  // 模块标识
  name: 'reading',
  type: 'reading',

  // 模块状态
  state: {
    currentTask: null,
    currentQuestion: 1,
    questions: [],
    userAnswers: {},
    isInitialized: false
  },

  /**
   * 初始化模块
   */
  async init() {
    console.log('阅读模块初始化...');

    try {
      // 注册模块到全局状态
      store.registerModule(this.name, {
        name: 'Reading',
        description: '托福阅读练习模块',
        icon: '📚'
      });

      // 激活模块
      store.activateModule(this.name);

      // 加载题库
      await this.loadQuestionBank();

      // 渲染UI
      this.render();

      this.state.isInitialized = true;
      console.log('阅读模块初始化完成');
    } catch (error) {
      console.error('阅读模块初始化失败:', error);
      throw error;
    }
  },

  /**
   * 加载题库
   */
  async loadQuestionBank() {
    console.log('加载阅读题库...');

    try {
      // 扫描题库文件
      const questionFiles = await loader.scanQuestionBank('reading');

      if (questionFiles.length === 0) {
        console.warn('未找到阅读题库文件，使用示例数据');
        await this.loadExampleData();
        return;
      }

      // 加载第一个题库文件
      const markdown = await loader.load(questionFiles[0], 'markdown');

      // 解析Markdown
      const parsedData = parser.parse(markdown, 'reading');

      // 标准化数据结构
      const standardizedData = parser.generateStandardJSON(parsedData);

      // 保存到模块状态
      this.state.questions = this.extractQuestions(standardizedData);

      // 更新全局状态
      store.setModuleQuestions(this.name, this.state.questions);

      console.log(`题库加载完成，共 ${this.state.questions.length} 题`);
    } catch (error) {
      console.error('加载题库失败:', error);
      await this.loadExampleData();
    }
  },

  /**
   * 加载示例数据（备用）
   */
  async loadExampleData() {
    console.log('加载示例数据...');

    // 示例题目数据
    this.state.questions = [
      {
        id: 1,
        type: 'fill-blank',
        prefix: 'atm',
        answer: 'osphere',
        underlineCount: 6,
        passage:
          "Astronomy is the scientific study of celestial objects and phenomena that originate outside the Earth's atmosphere."
      },
      {
        id: 2,
        type: 'fill-blank',
        prefix: 'fi',
        answer: 'eld',
        underlineCount: 3,
        passage: "Geologists work in the fi___ to collect rock samples and study Earth's surface."
      },
      {
        id: 3,
        type: 'fill-blank',
        prefix: 're',
        answer: 'mains',
        underlineCount: 5,
        passage: 'Paleontologists study fossils—the re_____ of organisms preserved in rock.'
      }
    ];

    store.setModuleQuestions(this.name, this.state.questions);
  },

  /**
   * 从解析数据中提取题目
   */
  extractQuestions(parsedData) {
    const questions = [];

    parsedData.tasks.forEach(task => {
      if (task.questions && task.questions.length > 0) {
        task.questions.forEach(question => {
          const baseQuestion = {
            id: question.id,
            type: question.type,
            taskTitle: task.title,
            taskType: task.type,
            passage: task.passage || '', // 整个任务的段落
            answer: question.answer || ''
          };

          // 根据题型添加特定字段
          if (question.type === 'fill-blank') {
            questions.push({
              ...baseQuestion,
              prefix: question.prefix || '',
              underlineCount: question.underlineCount || question.answer?.length || 1,
              fullText: question.fullText || ''
            });
          } else if (question.type === 'multiple-choice') {
            questions.push({
              ...baseQuestion,
              question: question.question || '',
              options: question.options || [],
              correctAnswer: question.answer || ''
            });
          } else if (question.type === 'reading-passage') {
            // 阅读段落题实际上是选择题，但共享段落
            questions.push({
              ...baseQuestion,
              question: question.question || '',
              options: question.options || [],
              correctAnswer: question.answer || '',
              passageTitle: task.title.replace('Read an Academic Passage – ', '')
            });
          } else {
            // 未知题型，保留原始数据
            questions.push({
              ...baseQuestion,
              ...question
            });
          }
        });
      }
    });

    return questions;
  },

  /**
   * 渲染模块UI
   */
  render() {
    console.log('渲染阅读模块UI...');

    // 获取容器
    const appContainer = document.getElementById('app');
    if (!appContainer) {
      console.error('未找到应用容器 #app');
      return;
    }

    // 清空容器
    DOM.clear(appContainer);

    // 创建模块容器
    const moduleContainer = DOM.create('div', {
      id: 'reading-module',
      className: 'module-container',
      style: {
        maxWidth: '800px',
        margin: '0 auto',
        padding: '20px',
        fontFamily: 'Arial, sans-serif'
      }
    });

    // 添加标题
    const title = DOM.create('h1', {
      textContent: 'TOEFL Reading Practice',
      style: {
        color: '#007A66',
        textAlign: 'center',
        marginBottom: '30px'
      }
    });

    // 添加进度显示
    const progressContainer = this.createProgressContainer();

    // 添加题目容器
    const questionsContainer = DOM.create('div', {
      id: 'reading-questions',
      className: 'questions-container',
      style: {
        marginTop: '20px'
      }
    });

    // 添加控制按钮
    const controlsContainer = this.createControlsContainer();

    // 组装容器
    moduleContainer.appendChild(title);
    moduleContainer.appendChild(progressContainer);
    moduleContainer.appendChild(questionsContainer);
    moduleContainer.appendChild(controlsContainer);

    appContainer.appendChild(moduleContainer);

    // 渲染题目
    this.renderQuestions(questionsContainer);

    // 启动计时器
    store.startTimer();

    // 订阅状态变化
    this.unsubscribe = store.subscribe((oldState, newState) => {
      this.handleStateChange(oldState, newState);
    });
  },

  /**
   * 创建进度容器
   */
  createProgressContainer() {
    const container = DOM.create('div', {
      className: 'progress-container',
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px',
        backgroundColor: '#f5f5f5',
        borderRadius: '8px',
        marginBottom: '20px'
      }
    });

    // 题目进度
    const questionProgress = DOM.create('div', {
      id: 'question-progress',
      className: 'question-progress',
      textContent: `Question 1 of ${this.state.questions.length}`,
      style: {
        fontSize: '14px',
        color: '#666666'
      }
    });

    // 计时器
    const timerContainer = DOM.create('div', {
      className: 'timer-container',
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
      }
    });

    const timerDisplay = DOM.create('div', {
      id: 'timer-display',
      className: 'timer-display',
      textContent: '11:30',
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

    const hideTimeBtn = DOM.create('button', {
      id: 'hide-time-btn',
      className: 'hide-time-btn',
      style: {
        backgroundColor: '#f0f0f0',
        border: '1px solid #ddd',
        borderRadius: '4px',
        padding: '5px 10px',
        fontSize: '12px',
        color: '#666666',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '5px'
      },
      onClick: () => this.toggleTimerVisibility()
    });
    hideTimeBtn.innerHTML = '<i class="fas fa-eye-slash"></i> Hide Time';

    timerContainer.appendChild(timerDisplay);
    timerContainer.appendChild(hideTimeBtn);

    container.appendChild(questionProgress);
    container.appendChild(timerContainer);

    return container;
  },

  /**
   * 创建控制按钮容器
   */
  createControlsContainer() {
    const container = DOM.create('div', {
      className: 'controls-container',
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: '30px',
        paddingTop: '20px',
        borderTop: '1px solid #eee'
      }
    });

    // 左侧按钮组
    const leftButtons = DOM.create('div', {
      className: 'left-buttons',
      style: {
        display: 'flex',
        gap: '10px'
      }
    });

    const volumeBtn = DOM.create('button', {
      className: 'control-btn',
      textContent: 'Volume',
      style: this.getButtonStyle(),
      onClick: () => alert('音量控制将在完整版中实现')
    });

    const helpBtn = DOM.create('button', {
      className: 'control-btn',
      textContent: 'Help',
      style: this.getButtonStyle(),
      onClick: () => this.showHelp()
    });

    const reviewBtn = DOM.create('button', {
      className: 'control-btn',
      textContent: 'Review',
      style: this.getButtonStyle(),
      onClick: () => alert('复习功能将在完整版中实现')
    });

    leftButtons.appendChild(volumeBtn);
    leftButtons.appendChild(helpBtn);
    leftButtons.appendChild(reviewBtn);

    // 右侧按钮组
    const rightButtons = DOM.create('div', {
      className: 'right-buttons',
      style: {
        display: 'flex',
        gap: '10px'
      }
    });

    const backBtn = DOM.create('button', {
      id: 'back-btn',
      className: 'control-btn',
      textContent: 'Back',
      style: this.getButtonStyle('#666666'),
      onClick: () => this.goBack()
    });

    const nextBtn = DOM.create('button', {
      id: 'next-btn',
      className: 'control-btn',
      textContent: 'Next',
      style: this.getButtonStyle('#4CAF50'),
      onClick: () => this.goNext()
    });

    rightButtons.appendChild(backBtn);
    rightButtons.appendChild(nextBtn);

    container.appendChild(leftButtons);
    container.appendChild(rightButtons);

    return container;
  },

  /**
   * 获取按钮样式
   */
  getButtonStyle(backgroundColor = '#007A66') {
    return {
      backgroundColor,
      color: 'white',
      border: 'none',
      borderRadius: '5px',
      padding: '10px 20px',
      fontSize: '14px',
      cursor: 'pointer',
      transition: 'background-color 0.2s ease'
    };
  },

  /**
   * 渲染题目
   */
  renderQuestions(container) {
    DOM.clear(container);

    // 清理之前的组件
    this.cleanupCurrentComponent();

    if (this.state.questions.length === 0) {
      const noQuestions = DOM.create('div', {
        textContent: '暂无题目',
        style: {
          textAlign: 'center',
          color: '#666666',
          padding: '40px'
        }
      });
      container.appendChild(noQuestions);
      return;
    }

    // 渲染当前题目
    const currentQuestion = this.state.questions[this.state.currentQuestion - 1];
    if (!currentQuestion) return;

    console.log(
      '[DEBUG] 渲染题目 #' +
        this.state.currentQuestion +
        '/' +
        this.state.questions.length +
        ', type=' +
        currentQuestion.type +
        ', hasPassage=' +
        !!currentQuestion.passage
    );

    // 创建题目容器
    const questionContainer = DOM.create('div', {
      className: 'question-container',
      style: {
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '20px',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
        marginBottom: '20px'
      }
    });

    // 添加题目类型标题
    const questionType = DOM.create('div', {
      className: 'question-type',
      textContent: currentQuestion.taskTitle || this.getTaskTypeDisplayName(currentQuestion.type),
      style: {
        fontSize: '16px',
        fontWeight: 'bold',
        color: '#007A66',
        marginBottom: '15px',
        paddingBottom: '10px',
        borderBottom: '1px solid #eee'
      }
    });
    questionContainer.appendChild(questionType);

    // 根据题型渲染不同内容
    if (currentQuestion.type === 'fill-blank') {
      this.renderFillBlankQuestion(currentQuestion, questionContainer);
    } else if (currentQuestion.type === 'multiple-choice') {
      this.renderMultipleChoiceQuestion(currentQuestion, questionContainer);
    } else if (currentQuestion.type === 'reading-passage') {
      this.renderReadingPassageQuestion(currentQuestion, questionContainer);
    } else {
      this.renderUnknownQuestionType(currentQuestion, questionContainer);
    }

    container.appendChild(questionContainer);
  },

  /**
   * 清理当前组件
   */
  cleanupCurrentComponent() {
    if (this.currentFillBlank) {
      this.currentFillBlank.destroy();
      this.currentFillBlank = null;
    }
    if (this.currentMultipleChoice) {
      this.currentMultipleChoice.destroy();
      this.currentMultipleChoice = null;
    }
    if (this.currentReadingPassage) {
      this.currentReadingPassage.destroy();
      this.currentReadingPassage = null;
    }
  },

  /**
   * 获取题型显示名称
   */
  getTaskTypeDisplayName(type) {
    const names = {
      'fill-blank': 'Complete the Words',
      'multiple-choice': 'Multiple Choice',
      'reading-passage': 'Reading Passage'
    };
    return names[type] || type;
  },

  /**
   * 渲染填空题
   */
  renderFillBlankQuestion(question, container) {
    // 添加段落（如果有）
    if (question.passage) {
      const passage = DOM.create('div', {
        className: 'question-passage',
        textContent: question.passage,
        style: {
          fontSize: '16px',
          lineHeight: '1.6',
          color: '#333333',
          marginBottom: '20px',
          padding: '15px',
          backgroundColor: '#f9f9f9',
          borderRadius: '5px'
        }
      });
      container.appendChild(passage);
    }

    // 添加题目说明
    const instruction = DOM.create('div', {
      className: 'question-instruction',
      textContent: 'Fill in the missing letters in a paragraph below:',
      style: {
        fontSize: '14px',
        color: '#666666',
        marginBottom: '15px',
        fontStyle: 'italic'
      }
    });
    container.appendChild(instruction);

    // 创建填空组件
    const fillBlank = new FillBlank({
      prefix: question.prefix,
      answer: question.answer,
      underlineCount: question.underlineCount,
      questionId: question.id,
      maxLength: question.underlineCount,
      onInput: (value, questionId) => {
        store.saveAnswer(questionId, value);
      },
      onComplete: (value, isCorrect, questionId) => {
        console.log(`题目 ${questionId} 完成: ${value}, 正确: ${isCorrect}`);
      },
      onTab: direction => {
        if (direction === 'next') {
          this.goNext();
        } else if (direction === 'prev') {
          this.goBack();
        }
      }
    });

    const fillBlankElement = fillBlank.render();
    container.appendChild(fillBlankElement);

    // 保存组件引用
    this.currentFillBlank = fillBlank;
  },

  /**
   * 渲染选择题
   */
  renderMultipleChoiceQuestion(question, container) {
    console.log('[DEBUG] 步骤1 - renderMultipleChoiceQuestion 被调用');
    console.log('[DEBUG] 步骤1 - question.type:', question.type);
    console.log('[DEBUG] 步骤1 - 是否有passage字段:', !!question.passage);
    console.log(
      '[DEBUG] 步骤1 - passage前100字:',
      question.passage ? question.passage.substring(0, 100) : '无'
    );

    // 如果附带段落文本（如阅读段落题），先渲染段落
    if (question.passage) {
      let passageHTML = question.passage
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      console.log('[DEBUG] 步骤2 - question.question原文:', JSON.stringify(question.question));

      const vocabMatch = question.question?.match(/The word\s+[^a-zA-Z]*([a-zA-Z-]+)[^a-zA-Z]*/);
      console.log(
        '[DEBUG] 步骤3 - 正则匹配结果:',
        vocabMatch ? '成功，捕获词=' + vocabMatch[1] : '失败(null)'
      );
      if (vocabMatch) {
        const targetWord = vocabMatch[1];
        const escapedWord = targetWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b(${escapedWord})\\b`, 'gi');
        passageHTML = passageHTML.replace(
          regex,
          '<span style="background-color:#008080;color:white;font-weight:bold;padding:1px 4px;border-radius:3px;">$1</span>'
        );
      }

      console.log('[DEBUG] 步骤4 - passageHTML含<span>标签:', passageHTML.includes('<span'));
      console.log('[DEBUG] 步骤4 - passageHTML前200字:', passageHTML.substring(0, 200));

      const passage = DOM.create('div', {
        className: 'reading-passage-text',
        style: {
          fontSize: '16px',
          lineHeight: '1.8',
          color: '#333333',
          marginBottom: '20px',
          padding: '20px',
          backgroundColor: '#f9f9f9',
          borderRadius: '6px',
          borderLeft: '4px solid #007A66'
        }
      });
      passage.innerHTML = passageHTML;
      container.appendChild(passage);
      console.log(
        '[DEBUG] 步骤5 - passage已插入DOM, innerHTML前100字:',
        passage.innerHTML.substring(0, 100)
      );
      console.log('[DEBUG] 步骤5 - passage.offsetWidth:', passage.offsetWidth);
    }

    // 添加问题文本
    const questionText = DOM.create('div', {
      className: 'multiple-choice-question',
      textContent: question.question,
      style: {
        fontSize: '17px',
        color: '#222222',
        lineHeight: '1.6',
        marginBottom: '20px'
      }
    });
    container.appendChild(questionText);

    // 创建选择题组件
    const multipleChoice = new MultipleChoice({
      questionId: question.id,
      question: question.question,
      options: question.options,
      answer: question.answer,
      onSelect: (letter, questionId) => {
        store.saveAnswer(questionId, letter);
      },
      onComplete: (letter, isCorrect, questionId) => {
        console.log(`题目 ${questionId} 完成: ${letter}, 正确: ${isCorrect}`);
      }
    });

    const mcElement = multipleChoice.render();
    container.appendChild(mcElement);

    // 保存组件引用
    this.currentMultipleChoice = multipleChoice;
  },

  /**
   * 渲染阅读段落题
   */
  renderReadingPassageQuestion(question, container) {
    // 添加段落标题
    if (question.passageTitle) {
      const passageTitle = DOM.create('div', {
        className: 'passage-title',
        textContent: question.passageTitle,
        style: {
          fontSize: '18px',
          fontWeight: 'bold',
          color: '#333333',
          marginBottom: '15px',
          textAlign: 'center'
        }
      });
      container.appendChild(passageTitle);
    }

    // 添加段落文本
    if (question.passage) {
      let passageHTML = question.passage
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      // 词汇题高亮：从题目文本中提取目标词
      const vocabMatch = question.question?.match(/The word\s+[^a-zA-Z]*([a-zA-Z-]+)[^a-zA-Z]*/);
      if (vocabMatch) {
        const targetWord = vocabMatch[1];
        const escapedWord = targetWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b(${escapedWord})\\b`, 'gi');
        passageHTML = passageHTML.replace(
          regex,
          '<span style="background-color:#008080;color:white;font-weight:bold;padding:1px 4px;border-radius:3px;">$1</span>'
        );
      }

      const passage = DOM.create('div', {
        className: 'reading-passage-text',
        style: {
          fontSize: '16px',
          lineHeight: '1.8',
          color: '#333333',
          marginBottom: '25px',
          padding: '20px',
          backgroundColor: '#f9f9f9',
          borderRadius: '6px',
          borderLeft: '4px solid #007A66'
        }
      });
      passage.innerHTML = passageHTML;
      container.appendChild(passage);
    }

    // 添加问题文本
    const questionText = DOM.create('div', {
      className: 'reading-passage-question',
      textContent: question.question,
      style: {
        fontSize: '17px',
        color: '#222222',
        lineHeight: '1.6',
        marginBottom: '20px',
        fontWeight: 'bold'
      }
    });
    container.appendChild(questionText);

    // 创建选择题组件（阅读段落题的题目本质上是选择题）
    const multipleChoice = new MultipleChoice({
      questionId: question.id,
      question: question.question,
      options: question.options,
      answer: question.answer,
      onSelect: (letter, questionId) => {
        store.saveAnswer(questionId, letter);
      },
      onComplete: (letter, isCorrect, questionId) => {
        console.log(`题目 ${questionId} 完成: ${letter}, 正确: ${isCorrect}`);
      }
    });

    const mcElement = multipleChoice.render();
    container.appendChild(mcElement);

    // 保存组件引用
    this.currentMultipleChoice = multipleChoice;
  },

  /**
   * 渲染未知题型
   */
  renderUnknownQuestionType(question, container) {
    const warning = DOM.create('div', {
      className: 'unknown-question-warning',
      textContent: `未知题型: ${question.type}`,
      style: {
        color: '#F44336',
        padding: '20px',
        textAlign: 'center',
        backgroundColor: '#FFEBEE',
        borderRadius: '6px'
      }
    });
    container.appendChild(warning);
  },

  /**
   * 处理状态变化
   */
  handleStateChange(oldState, newState) {
    // 更新计时器显示
    if (newState.timer.remainingTime !== oldState.timer?.remainingTime) {
      this.updateTimerDisplay(newState.timer.remainingTime);
    }

    // 更新进度显示
    if (newState.currentQuestion !== oldState.currentQuestion) {
      this.updateProgressDisplay(newState.currentQuestion);
    }
  },

  /**
   * 更新计时器显示
   */
  updateTimerDisplay(remainingTime) {
    const timerDisplay = document.getElementById('timer-display');
    if (timerDisplay) {
      const minutes = Math.floor(remainingTime / 60);
      const seconds = remainingTime % 60;
      timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

      // 不足1分钟时变红
      if (remainingTime <= 60) {
        timerDisplay.style.color = '#F44336';
        timerDisplay.style.backgroundColor = '#FFEBEE';
      }
    }
  },

  /**
   * 更新进度显示
   */
  updateProgressDisplay(currentQuestion) {
    const progressDisplay = document.getElementById('question-progress');
    if (progressDisplay) {
      progressDisplay.textContent = `Question ${currentQuestion} of ${this.state.questions.length}`;
    }
  },

  /**
   * 切换计时器显示/隐藏
   */
  toggleTimerVisibility() {
    const timerDisplay = document.getElementById('timer-display');
    const hideTimeBtn = document.getElementById('hide-time-btn');

    if (timerDisplay && hideTimeBtn) {
      const isHidden = timerDisplay.style.visibility === 'hidden';

      timerDisplay.style.visibility = isHidden ? 'visible' : 'hidden';

      if (isHidden) {
        hideTimeBtn.innerHTML = '<i class="fas fa-eye-slash"></i> Hide Time';
      } else {
        hideTimeBtn.innerHTML = '<i class="fas fa-eye"></i> Show Time';
      }
    }
  },

  /**
   * 显示帮助
   */
  showHelp() {
    alert(
      '题目帮助：\n\n1. 在灰色方框中填写缺失的字母\n2. 每个方框代表一个缺失的字母\n3. 使用Tab键在方框间切换\n4. 方框下方的数字表示题目顺序'
    );
  },

  /**
   * 上一题
   */
  goBack() {
    if (this.state.currentQuestion > 1) {
      this.state.currentQuestion--;
      store.setState({ currentQuestion: this.state.currentQuestion });
      this.renderQuestions(document.getElementById('reading-questions'));
    }
  },

  /**
   * 下一题
   */
  goNext() {
    if (this.state.currentQuestion < this.state.questions.length) {
      this.state.currentQuestion++;
      store.setState({ currentQuestion: this.state.currentQuestion });
      this.renderQuestions(document.getElementById('reading-questions'));
    } else {
      alert('已经是最后一题了！');
    }
  },

  /**
   * 销毁模块
   */
  destroy() {
    console.log('销毁阅读模块...');

    // 清理组件
    if (this.currentFillBlank) {
      this.currentFillBlank.destroy();
      this.currentFillBlank = null;
    }

    // 取消订阅
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    // 清理状态
    this.state = {
      currentTask: null,
      currentQuestion: 1,
      questions: [],
      userAnswers: {},
      isInitialized: false
    };

    console.log('阅读模块已销毁');
  }
};
