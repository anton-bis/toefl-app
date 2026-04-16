/**
 * MultipleChoice - 选择题交互组件
 * 处理选项点击、保存答案、标记功能。
 */
export class MultipleChoice {
  constructor(containerId, questionNum, store) {
    this.container = document.getElementById(containerId);
    this.questionNum = questionNum;
    this.store = store;
    this.options = this.container.querySelectorAll('.option-item-apple');
    this.currentAnswer = null;
    this.init();
  }

  init() {
    // 加载已保存的答案
    const saved = this.store.getAnswer(this.questionNum);
    if (saved) {
      this.setAnswer(saved, false);
    }

    this.options.forEach(opt => {
      opt.addEventListener('click', () => {
        const selected = opt.dataset.option;
        this.setAnswer(selected, true);
      });
    });
  }

  setAnswer(option, save = true) {
    this.currentAnswer = option;
    this.options.forEach(opt => {
      opt.classList.toggle('selected', opt.dataset.option === option);
    });
    if (save) this.store.saveAnswer(this.questionNum, option);
  }

  getAnswer() {
    return this.currentAnswer;
  }
}
