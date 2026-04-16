/**
 * TOEFL Timer Core Logic
 * Handles countdown, persistence, and UI synchronization across pages.
 */
export class ToeflTimer {
  constructor(options = {}) {
    this.tpoNum = options.tpoNum || '01';
    this.totalSeconds = options.initialSeconds || 690;
    this.onTick = options.onTick || (() => {});
    this.onTimeUp = options.onTimeUp || (() => {});

    this.storageKeyRemaining = `toefl_tpo${this.tpoNum}_timer_remaining`;
    this.storageKeyStarted = `toefl_tpo${this.tpoNum}_timer_started`;
    this.storageKeyVisible = `toefl_tpo${this.tpoNum}_timer_visible`;

    this.timerInterval = null;
    this.isPaused = false;

    this.loadState();
  }

  loadState() {
    const savedTime = localStorage.getItem(this.storageKeyRemaining);
    const hasStarted = localStorage.getItem(this.storageKeyStarted);

    if (savedTime && hasStarted === 'true') {
      this.totalSeconds = parseInt(savedTime, 10);
    }
  }

  saveState() {
    localStorage.setItem(this.storageKeyRemaining, this.totalSeconds);
  }

  start() {
    if (this.timerInterval) return;

    localStorage.setItem(this.storageKeyStarted, 'true');
    this.timerInterval = setInterval(() => {
      if (this.isPaused) return;

      if (this.totalSeconds <= 0) {
        this.stop();
        this.onTimeUp();
        return;
      }

      this.totalSeconds--;
      this.saveState();
      this.onTick(this.totalSeconds);
    }, 1000);

    this.onTick(this.totalSeconds);
  }

  stop() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  pause() {
    this.isPaused = true;
  }

  resume() {
    this.isPaused = false;
  }

  getTimeFormatted() {
    const minutes = Math.floor(this.totalSeconds / 60);
    const seconds = this.totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  static isVisible(tpoNum) {
    return localStorage.getItem(`toefl_tpo${tpoNum}_timer_visible`) !== 'false';
  }

  static setVisible(tpoNum, visible) {
    localStorage.setItem(`toefl_tpo${tpoNum}_timer_visible`, visible);
  }
}
