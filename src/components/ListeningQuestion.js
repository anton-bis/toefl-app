/**
 * 听力题目组件
 * 复用选择题功能，增加听力特定的UI和交互
 * 支持考试/练习模式、音频状态显示和重播功能
 */

import MultipleChoice from './MultipleChoice.js';
import { DOM } from '../core/utils.js';

export default class ListeningQuestion {
  constructor(options = {}) {
    // 听力特定属性
    this.taskType = options.taskType || 'listen_and_choose'; // 任务类型
    this.questionId = options.questionId || 1;
    this.mode = options.mode || 'exam'; // 'exam' 或 'practice'
    this.audioPlayed = options.audioPlayed || false; // 音频是否已播放
    this.audioUrl = options.audioUrl || ''; // 音频文件路径（用于显示）
    this.transcript = options.transcript || ''; // 原文对话文本（用于review模式）
    this.showTranscript = options.showTranscript || false; // 是否显示原文
    
    // 回调函数
    this.onReplayRequest = options.onReplayRequest || (() => {}); // 重播请求回调
    this.onSelect = options.onSelect || (() => {});
    this.onComplete = options.onComplete || (() => {});
    
    // 确定是否隐藏问题文本（对于Listen and Choose a Response题型）
    const hideQuestion = this.taskType === 'listen_and_choose';
    
    // 多选题选项
    this.multipleChoice = new MultipleChoice({
      questionId: this.questionId,
      question: options.question || '',
      options: options.options || [],
      answer: options.answer || '',
      userAnswer: options.userAnswer || '',
      showAnswer: options.showAnswer || false,
      hideQuestion: hideQuestion, // 对于题型1隐藏问题文本
      onSelect: (letter, questionId) => {
        this.onSelect(letter, questionId);
      },
      onComplete: (letter, isCorrect, questionId) => {
        this.onComplete(letter, isCorrect, questionId);
        // 答题完成后，在练习模式下显示重播按钮和原文
        if (this.mode === 'practice') {
          this.showReplayButton();
          this.showTranscriptPanel();
        }
      }
    });
    
    this.element = null;
    this.replayButton = null;
    this.statusIndicator = null;
    this.element = null;
    this.replayButton = null;
    this.statusIndicator = null;
    this.transcriptPanel = null;
    this.showTranscriptButton = null;
  }
  
  /**
   * 渲染组件
   */
  render() {
    // 创建主容器
    this.element = DOM.create('div', {
      className: 'listening-question-container',
      style: {
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '20px',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
        marginBottom: '20px'
      }
    });
    
    // 顶部状态栏
    const statusBar = this.createStatusBar();
    this.element.appendChild(statusBar);
    
    // 任务类型标识
    const taskTypeBadge = this.createTaskTypeBadge();
    this.element.appendChild(taskTypeBadge);
    
    // 题号
    const questionNumber = DOM.create('div', {
      className: 'question-number',
      textContent: `Question ${this.questionId}`,
      style: {
        fontSize: '14px',
        color: '#666666',
        marginBottom: '8px',
        fontWeight: 'bold'
      }
    });
    this.element.appendChild(questionNumber);
    
    // 问题文本
    const questionText = DOM.create('div', {
      className: 'question-text',
      textContent: this.multipleChoice.options.question,
      style: {
        fontSize: '17px',
        color: '#222222',
        lineHeight: '1.6',
        marginBottom: '24px'
      }
    });
    this.element.appendChild(questionText);
    
    // 多选题内容
    const mcElement = this.multipleChoice.render();
    this.element.appendChild(mcElement);
    
    // 控制栏（重播按钮）
    const controlBar = this.createControlBar();
    this.element.appendChild(controlBar);
    
    // 原文面板（仅在练习模式下且有transcript时）
    if (this.mode === 'practice' && this.transcript) {
      this.transcriptPanel = this.createTranscriptPanel();
      if (this.transcriptPanel) {
        this.element.appendChild(this.transcriptPanel);
      }
    }
    
    return this.element;
  }
  
  /**
   * 创建状态栏
   */
  createStatusBar() {
    const statusBar = DOM.create('div', {
      className: 'listening-status-bar',
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '15px',
        paddingBottom: '10px',
        borderBottom: '1px solid #eee'
      }
    });
    
    // 模式标签
    const modeLabel = DOM.create('span', {
      className: 'mode-label',
      textContent: this.mode === 'exam' ? '考试模式' : '练习模式',
      style: {
        fontSize: '12px',
        fontWeight: 'bold',
        color: this.mode === 'exam' ? '#ff6b6b' : '#4ecdc4',
        backgroundColor: this.mode === 'exam' ? '#ffeaea' : '#e0f7f5',
        padding: '2px 8px',
        borderRadius: '10px'
      }
    });
    
    // 音频状态指示器
    this.statusIndicator = DOM.create('span', {
      className: 'audio-status-indicator',
      textContent: this.getAudioStatusText(),
      style: {
        fontSize: '12px',
        color: this.audioPlayed ? '#4CAF50' : '#666',
        backgroundColor: this.audioPlayed ? '#e8f5e9' : '#f5f5f5',
        padding: '2px 8px',
        borderRadius: '10px',
        display: 'flex',
        alignItems: 'center',
        gap: '4px'
      }
    });
    
    // 如果音频已播放，添加图标
    if (this.audioPlayed) {
      const icon = DOM.create('span', {
        innerHTML: '🎧',
        style: { fontSize: '10px' }
      });
      this.statusIndicator.prepend(icon);
    }
    
    // 如果提供了音频URL，显示音频标识
    if (this.audioUrl) {
      const audioInfo = DOM.create('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          fontSize: '12px',
          color: '#666'
        }
      });
      const audioIcon = DOM.create('span', { innerHTML: '🔊', style: { fontSize: '10px' } });
      const fileName = this.audioUrl.split('/').pop() || 'audio.mp3';
      const nameText = DOM.create('span', { 
        textContent: fileName.length > 15 ? fileName.substring(0, 12) + '...' : fileName,
        title: fileName
      });
      audioInfo.appendChild(audioIcon);
      audioInfo.appendChild(nameText);
      statusBar.appendChild(audioInfo);
    }
    
    statusBar.appendChild(modeLabel);
    statusBar.appendChild(this.statusIndicator);
    
    return statusBar;
  }
  
  /**
   * 创建原文面板（用于Review模式）
   */
  createTranscriptPanel() {
    if (!this.transcript || !this.element) return null;
    
    const transcriptContainer = DOM.create('div', {
      className: 'transcript-container',
      style: {
        marginTop: '20px',
        padding: '15px',
        backgroundColor: '#f9f9f9',
        borderRadius: '6px',
        border: '1px solid #e0e0e0'
      }
    });
    
    const transcriptHeader = DOM.create('div', {
      className: 'transcript-header',
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '10px'
      }
    });
    
    const transcriptTitle = DOM.create('div', {
      className: 'transcript-title',
      innerHTML: '<i class="fas fa-scroll"></i> 原文对话',
      style: {
        fontSize: '15px',
        fontWeight: 'bold',
        color: '#666'
      }
    });
    
    const transcriptToggle = DOM.create('button', {
      className: 'transcript-toggle-btn',
      innerHTML: '<i class="fas fa-eye"></i> 显示原文',
      style: {
        padding: '4px 10px',
        fontSize: '12px',
        backgroundColor: '#e0f7f5',
        border: '1px solid #4ecdc4',
        borderRadius: '4px',
        color: '#007A66',
        cursor: 'pointer',
        transition: 'background-color 0.2s'
      },
      onClick: () => this.toggleTranscriptDisplay()
    });
    
    transcriptHeader.appendChild(transcriptTitle);
    transcriptHeader.appendChild(transcriptToggle);
    
    const transcriptContent = DOM.create('div', {
      className: 'transcript-content',
      innerHTML: `<div style="font-size:14px; color:#333; line-height:1.6; padding-top:10px; border-top:1px solid #eee; margin-top:10px;">${this.transcript}</div>`,
      style: {
        display: 'none'
      }
    });
    
    transcriptContainer.appendChild(transcriptHeader);
    transcriptContainer.appendChild(transcriptContent);
    
    return transcriptContainer;
  }
  
  /**
   * 切换原文显示
   */
  toggleTranscriptDisplay() {
    if (!this.transcriptPanel) return;
    
    const content = this.transcriptPanel.querySelector('.transcript-content');
    const toggleBtn = this.transcriptPanel.querySelector('.transcript-toggle-btn');
    
    if (!content || !toggleBtn) return;
    
    const isVisible = content.style.display !== 'none';
    
    if (isVisible) {
      content.style.display = 'none';
      toggleBtn.innerHTML = '<i class="fas fa-eye"></i> 显示原文';
      toggleBtn.style.backgroundColor = '#e0f7f5';
    } else {
      content.style.display = 'block';
      toggleBtn.innerHTML = '<i class="fas fa-eye-slash"></i> 隐藏原文';
      toggleBtn.style.backgroundColor = '#b2ebf2';
    }
}

  /**
   * 创建任务类型徽章
   */
  createTaskTypeBadge() {
    const taskTypeMap = {
      'listen_and_choose': 'Listen and Choose a Response',
      'listen_to_conversation': 'Listen to a Conversation',
      'listen_to_announcement': 'Listen to an Announcement',
      'listen_to_academic_talk': 'Listen to an Academic Talk'
    };
    
    const taskTypeText = taskTypeMap[this.taskType] || this.taskType;
    
    return DOM.create('div', {
      className: 'task-type-badge',
      textContent: taskTypeText,
      style: {
        display: 'inline-block',
        backgroundColor: '#e3f2fd',
        color: '#1976d2',
        padding: '4px 12px',
        borderRadius: '12px',
        fontSize: '13px',
        fontWeight: '500',
        marginBottom: '16px'
      }
    });
  }
  
  /**
   * 创建控制栏
   */
  createControlBar() {
    const controlBar = DOM.create('div', {
      className: 'listening-control-bar',
      style: {
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        marginTop: '15px',
        paddingTop: '10px',
        borderTop: '1px solid #eee',
        minHeight: '40px'
      }
    });
    
    // 重播按钮（仅在练习模式下且音频已播放后显示）
    this.replayButton = DOM.create('button', {
      className: 'replay-audio-btn',
      innerHTML: '🔁 重播音频',
      style: {
        display: this.mode === 'practice' && this.audioPlayed ? 'flex' : 'none',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 12px',
        fontSize: '12px',
        fontWeight: 'bold',
        color: '#007A66',
        backgroundColor: '#e0f7f5',
        border: '1px solid #4ecdc4',
        borderRadius: '4px',
        cursor: 'pointer',
        transition: 'all 0.2s'
      },
      onClick: () => this.handleReplayRequest()
    });
    
    this.replayButton.addEventListener('mouseenter', () => {
      this.replayButton.style.backgroundColor = '#b2ebf2';
    });
    this.replayButton.addEventListener('mouseleave', () => {
      this.replayButton.style.backgroundColor = '#e0f7f5';
    });
    
    controlBar.appendChild(this.replayButton);
    
    return controlBar;
  }
  
  /**
   * 获取音频状态文本
   */
  getAudioStatusText() {
    if (this.audioPlayed) {
      return '音频已播放';
    }
    return this.mode === 'exam' ? '等待播放音频' : '点击播放音频';
  }
  
  /**
   * 更新状态指示器
   */
  updateStatusIndicator() {
    if (this.statusIndicator) {
      this.statusIndicator.textContent = this.getAudioStatusText();
      this.statusIndicator.style.color = this.audioPlayed ? '#4CAF50' : '#666';
      this.statusIndicator.style.backgroundColor = this.audioPlayed ? '#e8f5e9' : '#f5f5f5';
      
      // 更新图标
      const existingIcon = this.statusIndicator.querySelector('span');
      if (this.audioPlayed && !existingIcon) {
        const icon = DOM.create('span', { innerHTML: '🎧', style: { fontSize: '10px' } });
        this.statusIndicator.prepend(icon);
      } else if (!this.audioPlayed && existingIcon) {
        existingIcon.remove();
      }
    }
  }
  
  /**
   * 设置音频播放状态
   */
  setAudioPlayed(isPlayed) {
    this.audioPlayed = isPlayed;
    this.updateStatusIndicator();
    
    // 练习模式下，音频播放后显示重播按钮
    if (this.mode === 'practice' && this.replayButton) {
      this.replayButton.style.display = isPlayed ? 'flex' : 'none';
    }
  }
  
  /**
   * 显示重播按钮
   */
  showReplayButton() {
    if (this.replayButton && this.mode === 'practice') {
      this.replayButton.style.display = 'flex';
    }
  }
  
  /**
   * 显示原文面板
   */
  showTranscriptPanel() {
    if (!this.transcriptPanel || !this.mode === 'practice') return;
    
    // 如果transcript面板已存在，确保它显示
    if (this.transcriptPanel.parentNode) {
      this.transcriptPanel.style.display = 'block';
    }
    
    // 自动展开原文内容
    const content = this.transcriptPanel.querySelector('.transcript-content');
    const toggleBtn = this.transcriptPanel.querySelector('.transcript-toggle-btn');
    
    if (content && toggleBtn) {
      content.style.display = 'block';
      toggleBtn.innerHTML = '<i class="fas fa-eye-slash"></i> 隐藏原文';
      toggleBtn.style.backgroundColor = '#b2ebf2';
    }
  }
  
  /**
   * 隐藏重播按钮
   */
  hideReplayButton() {
    if (this.replayButton) {
      this.replayButton.style.display = 'none';
    }
  }
  
  /**
   * 隐藏原文面板
   */
  hideTranscriptPanel() {
    if (!this.transcriptPanel) return;
    
    if (this.transcriptPanel.parentNode) {
      this.transcriptPanel.style.display = 'none';
    }
  }
  
  /**
   * 处理重播请求
   */
  handleReplayRequest() {
    this.onReplayRequest(this.questionId);
  }
  
  /**
   * 处理选项选择（委托给内部的MultipleChoice）
   */
  handleOptionSelect(letter) {
    this.multipleChoice.handleOptionSelect(letter);
  }
  
  /**
   * 设置用户答案
   */
  setUserAnswer(letter) {
    this.multipleChoice.setUserAnswer(letter);
  }
  
  /**
   * 获取用户答案
   */
  getUserAnswer() {
    return this.multipleChoice.getUserAnswer();
  }
  
  /**
   * 显示答案
   */
  showAnswer() {
    this.multipleChoice.showAnswer();
  }
  
  /**
   * 隐藏答案
   */
  hideAnswer() {
    this.multipleChoice.hideAnswer();
  }
  
  /**
   * 重置选择
   */
  reset() {
    this.multipleChoice.reset();
    this.audioPlayed = false;
    this.updateStatusIndicator();
    this.hideReplayButton();
  }
  
  /**
   * 更新题目内容
   */
  update(options = {}) {
    if (options.question !== undefined) {
      this.multipleChoice.options.question = options.question;
    }
    if (options.options !== undefined) {
      this.multipleChoice.options.options = options.options;
    }
    if (options.answer !== undefined) {
      this.multipleChoice.options.answer = options.answer;
    }
    if (options.userAnswer !== undefined) {
      this.multipleChoice.options.userAnswer = options.userAnswer;
    }
    if (options.showAnswer !== undefined) {
      this.multipleChoice.options.showAnswer = options.showAnswer;
    }
    if (options.hideQuestion !== undefined) {
      this.multipleChoice.options.hideQuestion = options.hideQuestion;
    }
    if (options.taskType !== undefined) {
      this.taskType = options.taskType;
    }
    if (options.mode !== undefined) {
      this.mode = options.mode;
    }
    if (options.audioPlayed !== undefined) {
      this.setAudioPlayed(options.audioPlayed);
    }
    if (options.audioUrl !== undefined) {
      this.audioUrl = options.audioUrl;
    }
    if (options.transcript !== undefined) {
      this.transcript = options.transcript;
    }
    if (options.showTranscript !== undefined) {
      this.showTranscript = options.showTranscript;
    }
  }
  
  /**
   * 销毁组件
   */
  destroy() {
    this.multipleChoice.destroy();
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    this.element = null;
    this.replayButton = null;
    this.statusIndicator = null;
  }
}