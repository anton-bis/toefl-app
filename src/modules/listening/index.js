/**
 * 听力模块
 * 实现模块接口规范，接入核心框架
 */

import { store } from '../../core/store.js';
import { loader } from '../../core/loader.js';
import { parser } from '../../core/parser.js';
import ListeningPlayer from '../../components/ListeningPlayer.js';
import ListeningQuestion from '../../components/ListeningQuestion.js';
import { DOM } from '../../core/utils.js';

export default {
  // 模块标识
  name: 'listening',
  type: 'listening',

  // 模块状态
  state: {
    currentTask: null,
    currentQuestion: 1,
    questions: [],
    userAnswers: {},
    isInitialized: false,
    audioPlayers: {} // 存储每个题目的音频播放器实例
  },

  /**
   * 初始化模块
   */
  async init() {
    console.log('听力模块初始化...');

    try {
      // 注册模块到全局状态
      store.registerModule(this.name, {
        name: 'Listening',
        description: '托福听力练习模块',
        icon: '🎧'
      });

      // 激活模块
      store.activateModule(this.name);

      // 加载题库
      await this.loadQuestionBank();

      // 渲染UI
      this.render();

      this.state.isInitialized = true;
      console.log('听力模块初始化完成');
    } catch (error) {
      console.error('听力模块初始化失败:', error);
      throw error;
    }
  },

  /**
   * 加载题库
   */
  async loadQuestionBank() {
    console.log('加载听力题库...');

    try {
      // 扫描题库文件
      const questionFiles = await loader.scanQuestionBank('listening');

      if (questionFiles.length === 0) {
        console.warn('未找到听力题库文件，使用示例数据');
        await this.loadExampleData();
        return;
      }

      // 加载第一个题库文件
      const markdown = await loader.load(questionFiles[0], 'markdown');

      // 解析Markdown
      const parsedData = parser.parse(markdown, 'listening');

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
        type: 'listening',
        taskType: 'listen_to_conversation',
        taskTitle: 'Listen to a Conversation',
        audio: 'conversation1.mp3',
        question: 'What is the main topic of the conversation?',
        options: [
          "The student's homework assignment",
          "The professor's office hours",
          'A campus event this weekend',
          "The library's new resources"
        ],
        answer: 'C',
        mode: 'practice' // 示例使用练习模式
      },
      {
        id: 2,
        type: 'listening',
        taskType: 'listen_to_academic_talk',
        taskTitle: 'Listen to an Academic Talk',
        audio: 'lecture1.mp3',
        question: 'What does the professor say about the research method?',
        options: [
          'It is outdated and unreliable',
          'It requires specialized equipment',
          'It has been widely accepted',
          'It is controversial but effective'
        ],
        answer: 'D',
        mode: 'practice'
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
            type: task.type, // listening
            taskTitle: task.title,
            taskType: this.detectTaskTypeFromTitle(task.title),
            audio: task.audio || '', // 音频文件路径
            transcript: task.transcript || '', // 对话原文
            dialogue: task.dialogue || [], // 结构化对话
            answer: question.answer || '',
            mode: 'practice' // 默认练习模式，实际中可根据配置调整
          };

          // 听力题都是选择题
          if (question.type === 'multiple-choice') {
            questions.push({
              ...baseQuestion,
              question: question.question || '',
              options: question.options || [],
              correctAnswer: question.answer || ''
            });
          } else {
            // 其他题型，保留原始数据
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
   * 从任务标题检测任务类型
   */
  detectTaskTypeFromTitle(title) {
    const lowerTitle = title.toLowerCase();

    if (lowerTitle.includes('listen and choose a response')) {
      return 'listen_and_choose';
    } else if (lowerTitle.includes('listen to a conversation')) {
      return 'listen_to_conversation';
    } else if (lowerTitle.includes('listen to an announcement')) {
      return 'listen_to_announcement';
    } else if (lowerTitle.includes('listen to an academic talk')) {
      return 'listen_to_academic_talk';
    }

    return 'listen_to_conversation'; // 默认
  },

  /**
   * 渲染模块UI
   */
  render() {
    console.log('渲染听力模块UI...');

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
      id: 'listening-module',
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
      textContent: 'TOEFL Listening Practice',
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
      id: 'listening-questions',
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
      innerHTML: '<i class="fas fa-eye-slash"></i> Hide Time',
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
      onClick: () => this.adjustVolume()
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
      onClick: () => this.showReview()
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
      textContent:
        currentQuestion.taskTitle || this.getTaskTypeDisplayName(currentQuestion.taskType),
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

    // 渲染听力题目
    this.renderListeningQuestion(currentQuestion, questionContainer);

    container.appendChild(questionContainer);
  },

  /**
   * 清理当前组件
   */
  cleanupCurrentComponent() {
    // 清理音频播放器
    if (this.currentAudioPlayer) {
      this.currentAudioPlayer.destroy();
      this.currentAudioPlayer = null;
    }

    // 清理题目组件
    if (this.currentQuestionComponent) {
      this.currentQuestionComponent.destroy();
      this.currentQuestionComponent = null;
    }
  },

  /**
   * 获取题型显示名称
   */
  getTaskTypeDisplayName(taskType) {
    const names = {
      listen_and_choose: 'Listen and Choose a Response',
      listen_to_conversation: 'Listen to a Conversation',
      listen_to_announcement: 'Listen to an Announcement',
      listen_to_academic_talk: 'Listen to an Academic Talk'
    };
    return names[taskType] || taskType;
  },

  /**
   * 渲染听力题目
   */
  renderListeningQuestion(question, container) {
    // 创建音频播放器容器
    const playerContainer = DOM.create('div', {
      className: 'audio-player-container',
      style: {
        marginBottom: '25px'
      }
    });

    // 构建音频URL（相对于题库文件）
    const audioUrl = question.audio ? `assets/questions/listening/${question.audio}` : '';

    // 创建音频播放器
    if (audioUrl) {
      this.currentAudioPlayer = new ListeningPlayer({
        audioUrl: audioUrl,
        mode: question.mode || 'practice',
        onEnded: () => {
          console.log(`音频播放结束，题目ID: ${question.id}`);
          // 音频播放结束后，可以自动标记为已播放
          if (this.currentQuestionComponent) {
            this.currentQuestionComponent.setAudioPlayed(true);
          }
        },
        onError: error => {
          console.error(`音频加载失败: ${error}`);
          alert(`无法加载音频文件: ${audioUrl}`);
        }
      });

      this.currentAudioPlayer.render(playerContainer, DOM);
    } else {
      playerContainer.textContent = '无音频文件';
      playerContainer.style.color = '#999';
      playerContainer.style.fontStyle = 'italic';
    }

    container.appendChild(playerContainer);

    // 创建题目组件
    this.currentQuestionComponent = new ListeningQuestion({
      taskType: question.taskType,
      questionId: question.id,
      mode: question.mode || 'practice',
      audioPlayed: false, // 初始状态为未播放
      audioUrl: audioUrl,
      question: question.question,
      options: question.options,
      answer: question.answer,
      transcript: question.transcript || '', // 传递原文对话
      dialogue: question.dialogue || [], // 传递结构化对话
      onSelect: (letter, questionId) => {
        store.saveAnswer(questionId, letter);
      },
      onComplete: (letter, isCorrect, questionId) => {
        console.log(`题目 ${questionId} 完成: ${letter}, 正确: ${isCorrect}`);
        // 在练习模式下，答题后显示重播按钮和原文
      },
      onReplayRequest: questionId => {
        console.log(`重播请求: 问题 ${questionId}`);
        if (this.currentAudioPlayer) {
          this.currentAudioPlayer.seek(0);
          this.currentAudioPlayer.play();
        }
      }
    });

    const questionElement = this.currentQuestionComponent.render();
    container.appendChild(questionElement);
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
   * 调整音量
   */
  adjustVolume() {
    alert('音量控制功能将在完整版中实现');
  },

  /**
   * 显示帮助
   */
  showHelp() {
    alert(
      '听力题目帮助：\n\n1. 点击播放按钮开始听音频\n2. 在考试模式下，音频只能播放一次\n3. 在练习模式下，可以暂停、重播音频\n4. 选择你认为正确的答案\n5. 在练习模式下，答题后可以查看答案并重播音频'
    );
  },

  /**
   * 显示复习
   */
  showReview() {
    alert('复习功能将在完整版中实现');
  },

  /**
   * 上一题
   */
  goBack() {
    if (this.state.currentQuestion > 1) {
      this.state.currentQuestion--;
      store.setState({ currentQuestion: this.state.currentQuestion });
      this.renderQuestions(document.getElementById('listening-questions'));
    }
  },

  /**
   * 下一题
   */
  goNext() {
    if (this.state.currentQuestion < this.state.questions.length) {
      this.state.currentQuestion++;
      store.setState({ currentQuestion: this.state.currentQuestion });
      this.renderQuestions(document.getElementById('listening-questions'));
    } else {
      alert('已经是最后一题了！');
    }
  },

  /**
   * 销毁模块
   */
  destroy() {
    console.log('销毁听力模块...');

    // 清理组件
    this.cleanupCurrentComponent();

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
      isInitialized: false,
      audioPlayers: {}
    };

    console.log('听力模块已销毁');
  }
};
