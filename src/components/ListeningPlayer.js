/**
 * Listening Player Component
 * Handles audio playback with exam/practice modes
 */

export default class ListeningPlayer {
  constructor(options = {}) {
    this.audioUrl = options.audioUrl || '';
    this.mode = options.mode || 'exam'; // 'exam' or 'practice'
    this.onEnded = options.onEnded || (() => {});
    this.onTimeUpdate = options.onTimeUpdate || (() => {});
    this.onError = options.onError || (() => {});
    
    this.audioElement = null;
    this.isPlaying = false;
    this.duration = 0;
    this.currentTime = 0;
    
    this._initAudioElement();
  }
  
  _initAudioElement() {
    this.audioElement = new Audio();
    this.audioElement.preload = 'metadata';
    
    // 事件监听
    this.audioElement.addEventListener('loadedmetadata', () => {
      this.duration = this.audioElement.duration;
      this.onTimeUpdate({
        currentTime: this.audioElement.currentTime,
        duration: this.duration,
        isPlaying: this.isPlaying
      });
    });
    
    this.audioElement.addEventListener('timeupdate', () => {
      this.currentTime = this.audioElement.currentTime;
      this.onTimeUpdate({
        currentTime: this.audioElement.currentTime,
        duration: this.duration,
        isPlaying: this.isPlaying
      });
    });
    
    this.audioElement.addEventListener('ended', () => {
      this.isPlaying = false;
      this.onEnded();
    });
    
    this.audioElement.addEventListener('error', (e) => {
      this.onError(e);
    });
  }
  
  loadAudio(url) {
    this.audioUrl = url;
    this.audioElement.src = url;
    this.audioElement.load();
  }
  
  play() {
    if (!this.audioUrl) return;
    this.audioElement.play().catch(e => {
      console.warn('Audio play failed:', e);
      this.onError(e);
    });
    this.isPlaying = true;
  }
  
  pause() {
    this.audioElement.pause();
    this.isPlaying = false;
  }
  
  seek(time) {
    if (this.audioElement.readyState >= 2) { // HAVE_CURRENT_DATA or higher
      this.audioElement.currentTime = time;
    }
  }
  
  getCurrentTime() {
    return this.audioElement.currentTime;
  }
  
  getDuration() {
    return this.duration;
  }
  
  isPlayingState() {
    return this.isPlaying;
  }
  
  destroy() {
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.removeAttribute('src');
      this.audioElement.load();
      // 移除事件监听器以防内存泄漏
      this.audioElement.removeEventListener('loadedmetadata', null);
      this.audioElement.removeEventListener('timeupdate', null);
      this.audioElement.removeEventListener('ended', null);
      this.audioElement.removeEventListener('error', null);
    }
  }
  
  /**
   * 渲染播放器 UI
   * @param {HTMLElement} container - 容器元素
   * @param {Object} DOM - DOM 工具对象
   */
  render(container, DOM) {
    // 清空容器
    DOM.clear(container);
    
    // 创建播放器容器
    const playerContainer = DOM.create('div', {
      className: 'listening-player',
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '20px',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        marginBottom: '20px'
      }
    });
    
    // 音频信息区域
    const infoContainer = DOM.create('div', {
      className: 'player-info',
      style: {
        width: '100%',
        maxWidth: '500px',
        textAlign: 'center',
        marginBottom: '15px'
      }
    });
    
    const modeLabel = DOM.create('span', {
      textContent: this.mode === 'exam' ? '考试模式' : '练习模式',
      style: {
        fontSize: '14px',
        color: this.mode === 'exam' ? '#ff6b6b' : '#4ecdc4',
        fontWeight: 'bold'
      }
    });
    
    const timeDisplay = DOM.create('div', {
      className: 'time-display',
      style: {
        fontSize: '16px',
        fontWeight: 'bold',
        marginTop: '5px',
        minWidth: '80px',
        textAlign: 'center'
      }
    });
    
    // 更新时间显示
    const updateTimeDisplay = () => {
      const current = Math.floor(this.audioElement.currentTime);
      const duration = Math.floor(this.duration);
      const minutesCurrent = String(Math.floor(current / 60)).padStart(2, '0');
      const secondsCurrent = String(current % 60).padStart(2, '0');
      const minutesDuration = String(Math.floor(duration / 60)).padStart(2, '0');
      const secondsDuration = String(duration % 60).padStart(2, '0');
      timeDisplay.textContent = `${minutesCurrent}:${secondsCurrent} / ${minutesDuration}:${secondsDuration}`;
    };
    
    // 控制按钮区域
    const controlsContainer = DOM.create('div', {
      className: 'player-controls',
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '15px'
      }
    });
    
    const playPauseBtn = DOM.create('button', {
      className: 'play-pause-btn',
      innerHTML: '▶️',
      style: {
        width: '50px',
        height: '50px',
        borderRadius: '50%',
        border: 'none',
        backgroundColor: '#007A66',
        color: 'white',
        fontSize: '20px',
        cursor: this.mode === 'exam' && !this.isPlaying ? 'pointer' : 'not-allowed',
        opacity: this.mode === 'exam' && !this.isPlaying ? 1 : 0.6,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s'
      }
    });
    
    // 考试模式下只能播放一次
    if (this.mode === 'exam') {
      playPauseBtn.addEventListener('click', () => {
        if (!this.isPlaying) {
          this.play();
          playPauseBtn.innerHTML = '⏸️';
          playPauseBtn.style.backgroundColor = '#ff6b6b';
        }
      });
    } else {
      // 练习模式下可切换播放/暂停
      playPauseBtn.addEventListener('click', () => {
        if (this.isPlaying) {
          this.pause();
          playPauseBtn.innerHTML = '▶️';
          playPauseBtn.style.backgroundColor = '#007A66';
        } else {
          this.play();
          playPauseBtn.innerHTML = '⏸️';
          playPauseBtn.style.backgroundColor = '#ff6b6b';
        }
      });
    }
    
    // 重播按钮（仅在练习模式或音频结束后显示）
    const replayBtn = DOM.create('button', {
      className: 'replay-btn',
      innerHTML: '🔁',
      style: {
        width: '40px',
        height: '40px',
        borderRadius: '50%',
        border: 'none',
        backgroundColor: '#f0f0f0',
        color: '#666',
        fontSize: '16px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: '10px',
        visibility: this.mode === 'exam' ? 'hidden' : 'visible'
      }
    });
    
    replayBtn.addEventListener('click', () => {
      this.seek(0);
      this.play();
      if (this.mode === 'practice') {
        playPauseBtn.innerHTML = '⏸️';
        playPauseBtn.style.backgroundColor = '#ff6b6b';
      }
    });
    
    // 进度条容器
    const progressContainer = DOM.create('div', {
      className: 'progress-container',
      style: {
        width: '100%',
        maxWidth: '500px',
        height: '6px',
        backgroundColor: '#e0e0e0',
        borderRadius: '3px',
        margin: '15px 0',
        position: 'relative',
        cursor: this.mode === 'practice' ? 'pointer' : 'default'
      }
    });
    
    const progressBar = DOM.create('div', {
      className: 'progress-bar',
      style: {
        width: '0%',
        height: '100%',
        backgroundColor: '#007A66',
        borderRadius: '3px',
        transition: 'width 0.1s linear'
      }
    });
    
    // 进度条点击事件（仅练习模式）
    if (this.mode === 'practice') {
      progressContainer.addEventListener('click', (e) => {
        const rect = progressContainer.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        const seekTime = percent * this.duration;
        this.seek(seekTime);
      });
    }
    
    // 组装元素
    infoContainer.appendChild(modeLabel);
    infoContainer.appendChild(timeDisplay);
    
    controlsContainer.appendChild(playPauseBtn);
    if (this.mode === 'practice') {
      controlsContainer.appendChild(replayBtn);
    }
    
    progressContainer.appendChild(progressBar);
    
    playerContainer.appendChild(infoContainer);
    playerContainer.appendChild(controlsContainer);
    playerContainer.appendChild(progressContainer);
    
    container.appendChild(playerContainer);
    
    // 更新循环
    const updateLoop = () => {
      updateTimeDisplay();
      if (!isNaN(this.duration) && this.duration > 0) {
        const percent = (this.audioElement.currentTime / this.duration) * 100;
        progressBar.style.width = `${percent}%`;
      }
      
      // 继续更新直到音频结束或暂停
      if (this.isPlaying && !this.audioElement.ended) {
        requestAnimationFrame(updateLoop);
      }
    };
    
    // 启动更新循环
    requestAnimationFrame(updateLoop);
  }
}