/**
 * Listening Question Component
 * Extends MultipleChoice with audio playback integration for listening tasks
 */

import MultipleChoice from './MultipleChoice.js';
import ListeningPlayer from './ListeningPlayer.js';
import { DOM } from '../core/utils.js';

export default class ListeningQuestion extends MultipleChoice {
  constructor(options = {}) {
    // 先调用父类构造函数
    super(options);
    
    // 听力特有属性
    this.audioUrl = options.audioUrl || '';
    this.audioPlayer = null;
    this.mode = options.mode || 'exam'; // 'exam' or 'practice'
    this.onAudioEnded = options.onAudioEnded || (() => {});
    this.onAudioPlay = options.onAudioPlay || (() => {});
    this.isAudioPlayed = false; // 标记音频是否已经播放过（用于考试模式）
    
    // 听力特有状态
    this.audioPlayed = false;
    this.canAnswer = this.mode === 'practice'; // 练习模式下可直接答题，考试模式需先播放音频
  }
  
  /**
   * 初始化音频播放器
   */
  initAudioPlayer() {
    if (this.audioUrl) {
      this.audioPlayer = new ListeningPlayer({
        audioUrl: this.audioUrl,
        mode: this.mode,
        onEnded: () => {
          this.handleAudioEnded();
          if (this.onAudioEnded) this.onAudioEnded();
        },
        onTimeUpdate: (timeInfo) => {
          // 可以选择在这里更新UI或触发事件
          if (this.onAudioTimeUpdate) this.onAudioTimeUpdate(timeInfo);
        },
        onError: (error) => {
          console.error('Audio playback error:', error);
          if (this.onAudioError) this.onAudioError(error);
        }
      });
    }
  }
  
  /**
   * 处理音频播放结束
   */
  handleAudioEnded() {
    this.audioPlayed = true;
    // 在考试模式下，音频播放结束后允许答题
    if (this.mode === 'exam') {
      this.canAnswer = true;
      // 更新UI状态以反映可以答题了
      this.updateAnswerPermissionUI();
    }
  }
  
  /**
   * 更新答题权限的UI显示
   */
  updateAnswerPermissionUI() {
    // 可以在这里添加UI元素来显示"现在可以答题了"的提示
    // 或者修改选项的可点击状态
    if (this.element && this.mode === 'exam') {
      const optionElements = this.element.querySelectorAll('.option');
      optionElements.forEach(el => {
        if (this.canAnswer) {
          el.style.cursor = 'pointer';
          el.style.opacity = '1';
        } else {
          el.style.cursor = 'not-allowed';
          el.style.opacity = '0.6';
        }
      });
    }
  }
  
  /**
   * 渲染组件（扩展父类方法）
   */
  render() {
    // 首先渲染基础选择题组件
    const container = super.render();
    
    // 如果有音频URL且尚未初始化播放器，则初始化
    if (this.audioUrl && !this.audioPlayer) {
      this.initAudioPlayer();
    }
    
    // 在题目上方添加音频播放器
    if (this.audioPlayer) {
      // 创建音频播放器容器
      const audioContainer = DOM.create('div', {
        className: 'listening-audio-container',
        style: {
          marginBottom: '20px'
        }
      });
      
      // 渲染音频播放器
      this.audioPlayer.render(audioContainer, DOM);
      
      // 将音频播放器插入到容器开头
      container.insertBefore(audioContainer, container.firstChild);
    }
    
    // 添加答题状态提示（仅考试模式）
    if (this.mode === 'exam') {
      const statusContainer = DOM.create('div', {
        className: 'answer-status',
        style: {
          marginTop: '10px',
          padding: '10px',
          backgroundColor: this.canAnswer ? '#E8F5E9' : '#FFF3E0',
          borderRadius: '4px',
          textAlign: 'center',
          fontSize: '14px',
          color: this.canAnswer ? '#2E7D32' : '#EF6C00'
        }
      });
      
      statusContainer.textContent = this.canAnswer 
        ? '请根据所听内容选择答案' 
        : '请先听完音频再答题';
      
      // 将状态提示插入到音频播放器和题目之间（如果有音频）或题目之前（如果没有音频）
      if (this.audioPlayer) {
        // 插入到音频播放器之后
        const audioContainer = container.querySelector('.listening-audio-container');
        if (audioContainer) {
          container.insertBefore(statusContainer, audioContainer.nextSibling);
        }
      } else {
        // 插入到最前面
        container.insertBefore(statusContainer, container.firstChild);
      }
    }
    
    return container;
  }
  
  /**
   * 处理选项选择（扩展父类方法）
   */
  handleOptionSelect(letter) {
    // 检查是否允许答题
    if (!this.canAnswer) {
      // 在考试模式下，如果音频未播放完毕，不允许答题
      if (this.mode === 'exam' && !this.audioPlayed) {
        // 可以给出提示：请先听完音频
        alert('请先听完音频再选择答案');
        return;
      }
    }
    
    // 调用父类方法处理选项选择
    super.handleOptionSelect(letter);
  }
  
  /**
   * 播放音频
   */
  playAudio() {
    if (this.audioPlayer) {
      this.audioPlayer.play();
      this.isAudioPlayed = true;
      if (this.onAudioPlay) this.onAudioPlay();
    }
  }
  
  /**
   * 暂停音频
   */
  pauseAudio() {
    if (this.audioPlayer) {
      this.audioPlayer.pause();
    }
  }
  
  /**
   * 重播音频（仅练习模式可用）
   */
  replayAudio() {
    if (this.audioPlayer && this.mode === 'practice') {
      this.audioPlayer.seek(0);
      this.audioPlayer.play();
    }
  }
  
  /**
   * 重置组件（扩展父类方法）
   */
  reset() {
    // 调用父类重置方法
    super.reset();
    
    // 重置听力特有状态
    this.audioPlayed = false;
    this.isAudioPlayed = false;
    this.canAnswer = this.mode === 'practice';
    
    // 重置音频播放器
    if (this.audioPlayer) {
      this.audioPlayer.seek(0);
      this.audioPlayer.pause();
    }
    
    // 更新UI状态
    this.updateAnswerPermissionUI();
  }
  
  /**
   * 销毁组件（扩展父类方法）
   */
  destroy() {
    // 销毁音频播放器
    if (this.audioPlayer) {
      this.audioPlayer.destroy();
      this.audioPlayer = null;
    }
    
    // 调用父类销毁方法
    super.destroy();
  }
  
  /**
   * 设置模式（考试/练习）
   */
  setMode(mode) {
    this.mode = mode;
    if (this.audioPlayer) {
      this.audioPlayer.mode = mode;
    }
    
    // 根据模式更新答题权限
    this.canAnswer = mode === 'practice' || this.audioPlayed;
    this.updateAnswerPermissionUI();
    
    // 如果切换到考试模式且音频已播放，则允许答题
    if (mode === 'exam' && this.audioPlayed) {
      this.canAnswer = true;
    }
  }
  
  /**
   * 获取当前音频播放时间
   */
  getAudioCurrentTime() {
    return this.audioPlayer ? this.audioPlayer.getCurrentTime() : 0;
  }
  
  /**
   * 获取音频总时长
   */
  getAudioDuration() {
    return this.audioPlayer ? this.audioPlayer.getDuration() : 0;
  }
  
  /**
   * 检查音频是否正在播放
   */
  isAudioPlaying() {
    return this.audioPlayer ? this.audioPlayer.isPlayingState() : false;
  }
}

// 导出组件
export default ListeningQuestion;