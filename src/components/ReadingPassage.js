/**
 * 阅读段落组件
 * 渲染学术段落及其相关的选择题
 */

import { DOM } from '../core/utils.js';
import MultipleChoice from './MultipleChoice.js';

export class ReadingPassage {
  constructor(options = {}) {
    this.options = {
      passageTitle: '',
      passageText: '',
      questions: [], // 数组：每个元素包含 {id, question, options, answer}
      userAnswers: {}, // questionId -> 用户答案
      showAnswers: false,
      onQuestionSelect: () => {},
      onQuestionComplete: () => {},
      ...options
    };

    this.element = null;
    this.questionComponents = new Map();
  }

  /**
   * 渲染组件
   */
  render() {
    // 创建容器
    this.element = DOM.create('div', {
      className: 'reading-passage-container',
      style: {
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '25px',
        boxShadow: '0 2px 15px rgba(0, 0, 0, 0.1)',
        marginBottom: '30px'
      }
    });

    // 添加段落标题
    if (this.options.passageTitle) {
      const titleElement = DOM.create('div', {
        className: 'passage-title',
        textContent: this.options.passageTitle,
        style: {
          fontSize: '18px',
          fontWeight: 'bold',
          color: '#007A66',
          marginBottom: '15px',
          textAlign: 'center'
        }
      });
      this.element.appendChild(titleElement);
    }

    // 添加段落文本
    const passageElement = DOM.create('div', {
      className: 'passage-text',
      style: {
        fontSize: '16px',
        lineHeight: '1.8',
        color: '#333333',
        marginBottom: '30px',
        padding: '20px',
        backgroundColor: '#f9f9f9',
        borderRadius: '6px',
        borderLeft: '4px solid #007A66'
      }
    });
    passageElement.innerHTML = this.formatPassageText(this.options.passageText);
    this.element.appendChild(passageElement);

    // 添加题目容器
    const questionsContainer = DOM.create('div', {
      className: 'passage-questions-container',
      style: {
        marginTop: '30px',
        borderTop: '1px solid #eee',
        paddingTop: '25px'
      }
    });

    // 渲染每个题目
    this.options.questions.forEach(questionData => {
      const questionElement = this.createQuestionElement(questionData);
      questionsContainer.appendChild(questionElement);
    });

    this.element.appendChild(questionsContainer);

    return this.element;
  }

  /**
   * 格式化段落文本（处理加粗、词汇高亮等格式）
   */
  formatPassageText(text) {
    if (!text) return '';

    let formatted = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // 将 **加粗** 转换为 <strong>加粗</strong>
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // 词汇题目标词高亮
    const targetWords = this.collectTargetWords();
    for (const word of targetWords) {
      const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b(${escapedWord})\\b`, 'gi');
      formatted = formatted.replace(
        regex,
        '<span style="background-color:#008080;color:white;font-weight:bold;padding:1px 4px;border-radius:3px;">$1</span>'
      );
    }

    // 保留换行
    formatted = formatted.replace(/\n/g, '<br>');

    return formatted;
  }

  /**
   * 收集所有词汇题的目标词
   */
  collectTargetWords() {
    const words = [];
    if (!this.options.questions) return words;

    for (const q of this.options.questions) {
      const match = q.question?.match(/The word\s+[^a-zA-Z]*([a-zA-Z-]+)[^a-zA-Z]*/);
      if (match) {
        words.push(match[1]);
      }
    }
    return words;
  }

  /**
   * 创建题目元素
   */
  createQuestionElement(questionData) {
    const questionContainer = DOM.create('div', {
      className: 'passage-question-container',
      style: {
        marginBottom: '25px',
        padding: '20px',
        backgroundColor: '#f5f5f5',
        borderRadius: '6px'
      }
    });

    // 创建选择题组件
    const mcOptions = {
      questionId: questionData.id,
      question: questionData.question,
      options: questionData.options,
      answer: questionData.answer,
      userAnswer: this.options.userAnswers[questionData.id] || '',
      showAnswer: this.options.showAnswers,
      onSelect: (letter, questionId) => {
        this.options.userAnswers[questionId] = letter;
        if (this.options.onQuestionSelect) {
          this.options.onQuestionSelect(questionId, letter);
        }
      },
      onComplete: (letter, isCorrect, questionId) => {
        if (this.options.onQuestionComplete) {
          this.options.onQuestionComplete(questionId, letter, isCorrect);
        }
      }
    };

    const mcComponent = new MultipleChoice(mcOptions);
    const mcElement = mcComponent.render();

    // 保存组件引用
    this.questionComponents.set(questionData.id, mcComponent);

    questionContainer.appendChild(mcElement);
    return questionContainer;
  }

  /**
   * 设置用户答案
   */
  setUserAnswer(questionId, answer) {
    this.options.userAnswers[questionId] = answer;
    const component = this.questionComponents.get(questionId);
    if (component) {
      component.setUserAnswer(answer);
    }
  }

  /**
   * 获取用户答案
   */
  getUserAnswers() {
    const answers = {};
    this.questionComponents.forEach((component, questionId) => {
      answers[questionId] = component.getUserAnswer();
    });
    return answers;
  }

  /**
   * 显示答案
   */
  showAnswers() {
    this.options.showAnswers = true;
    this.questionComponents.forEach(component => {
      component.showAnswer();
    });
  }

  /**
   * 隐藏答案
   */
  hideAnswers() {
    this.options.showAnswers = false;
    this.questionComponents.forEach(component => {
      component.hideAnswer();
    });
  }

  /**
   * 重置所有题目
   */
  reset() {
    this.options.userAnswers = {};
    this.questionComponents.forEach(component => {
      component.reset();
    });
  }

  /**
   * 销毁组件
   */
  destroy() {
    // 销毁所有子组件
    this.questionComponents.forEach(component => {
      component.destroy();
    });
    this.questionComponents.clear();

    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    this.element = null;
  }
}

// 导出组件
export default ReadingPassage;
