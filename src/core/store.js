/**
 * TOEFL Answer Store - 数据持久化模块
 * 处理答案和标记状态的保存与读取，支持跨页面持久化。
 */
export class ToeflStore {
  constructor(tpoNum = '01') {
    this.tpoNum = tpoNum;
    this.ANSWERS_KEY = `toefl_tpo${tpoNum}_answers`;
    this.MARKS_KEY = `toefl_tpo${tpoNum}_marked`;
    this.CURRENT_PAGE_KEY = `toefl_tpo${tpoNum}_current_page`;
  }

  saveAnswer(questionId, answer) {
    const answers = this.getAllAnswers();
    answers[questionId] = { value: answer, timestamp: new Date().toISOString() };
    this._setItem(this.ANSWERS_KEY, answers);
  }

  getAnswer(questionId) {
    const answers = this.getAllAnswers();
    return answers[questionId]?.value || null;
  }

  getAllAnswers() {
    return this._getItem(this.ANSWERS_KEY) || {};
  }

  getAnsweredCount() {
    const answers = this.getAllAnswers();
    return Object.values(answers).filter(a => a.value && a.value.trim() !== '').length;
  }

  saveMark(questionId, marked) {
    const marks = this.getAllMarks();
    if (marked) marks[questionId] = true;
    else delete marks[questionId];
    this._setItem(this.MARKS_KEY, marks);
  }

  getAllMarks() {
    return this._getItem(this.MARKS_KEY) || {};
  }

  isMarked(questionId) {
    return !!this.getAllMarks()[questionId];
  }

  saveCurrentPage(pageUrl) {
    this._setItem(this.CURRENT_PAGE_KEY, pageUrl);
  }

  getCurrentPage() {
    return this._getItem(this.CURRENT_PAGE_KEY);
  }

  clearAll() {
    localStorage.removeItem(this.ANSWERS_KEY);
    localStorage.removeItem(this.MARKS_KEY);
    localStorage.removeItem(this.CURRENT_PAGE_KEY);
    localStorage.removeItem(`toefl_tpo${this.tpoNum}_timer_remaining`);
    localStorage.removeItem(`toefl_tpo${this.tpoNum}_timer_started`);
  }

  _getItem(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
  }

  _setItem(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { console.error('保存失败:', e); }
  }
}
