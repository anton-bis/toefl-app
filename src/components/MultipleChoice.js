/**
 * 选择题组件
 * 渲染单选题（A、B、C、D）并处理用户选择
 */

import { DOM, Validator } from '../core/utils.js';

export class MultipleChoice {
  constructor(options = {}) {
    this.options = {
      questionId: 1,
      question: '',
      options: [],
      answer: '', // 正确答案，如 'A'
      userAnswer: '',
      showAnswer: false,
      hideQuestion: false, // 是否隐藏问题文本（用于听力题型1）
      onSelect: () => {},
      onComplete: () => {},
      ...options
    };

    this.element = null;
    this.optionElements = new Map(); // 选项字母 -> 元素
    this.selectedOption = this.options.userAnswer;
  }

  /**
   * 渲染组件
   */
  render() {
    // 创建容器
    this.element = DOM.create('div', {
      className: 'multiple-choice-container',
      style: {
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '20px',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
        marginBottom: '20px'
      }
    });

    // 添加题号
    const questionNumber = DOM.create('div', {
      className: 'question-number',
      textContent: `Question ${this.options.questionId}`,
      style: {
        fontSize: '14px',
        color: '#666666',
        marginBottom: '10px',
        fontWeight: 'bold'
      }
    });

    // 添加问题文本（除非隐藏）
    let questionText = null;
    if (!this.options.hideQuestion && this.options.question) {
      questionText = DOM.create('div', {
        className: 'question-text',
        textContent: this.options.question,
        style: {
          fontSize: '17px',
          color: '#222222',
          lineHeight: '1.6',
          marginBottom: '20px'
        }
      });
    }

    // 添加选项容器
    const optionsContainer = DOM.create('div', {
      className: 'options-container',
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }
    });

    // 渲染每个选项
    this.options.options.forEach((optionText, index) => {
      const optionLetter = String.fromCharCode(65 + index); // A, B, C, D
      const optionElement = this.createOptionElement(optionLetter, optionText);
      this.optionElements.set(optionLetter, optionElement);
      optionsContainer.appendChild(optionElement);
    });

    // 组装容器
    this.element.appendChild(questionNumber);
    if (questionText) {
      this.element.appendChild(questionText);
    }
    this.element.appendChild(optionsContainer);

    // 如果显示答案，标记正确/错误
    if (this.options.showAnswer && this.options.answer) {
      this.markCorrectAnswer();
    }

    return this.element;
  }

  /**
   * 创建选项元素
   */
  createOptionElement(letter, text) {
    const isSelected = this.selectedOption === letter;
    const isCorrect = this.options.answer === letter;

    // 确定背景颜色
    let backgroundColor = '#f5f5f5';
    let borderColor = '#ddd';

    if (isSelected) {
      backgroundColor = '#E3F2FD'; // 选中：浅蓝色
      borderColor = '#2196F3';
    }

    if (this.options.showAnswer) {
      if (isCorrect) {
        backgroundColor = '#E8F5E9'; // 正确：浅绿色
        borderColor = '#4CAF50';
      } else if (isSelected && !isCorrect) {
        backgroundColor = '#FFEBEE'; // 错误：浅红色
        borderColor = '#F44336';
      }
    }

    const optionElement = DOM.create('div', {
      className: `option option-${letter}`,
      style: {
        display: 'flex',
        alignItems: 'flex-start',
        padding: '15px',
        backgroundColor: backgroundColor,
        border: `1px solid ${borderColor}`,
        borderRadius: '6px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        position: 'relative'
      },
      onClick: () => this.handleOptionSelect(letter)
    });

    // 选项字母
    const letterElement = DOM.create('div', {
      className: 'option-letter',
      textContent: letter + '.',
      style: {
        fontSize: '16px',
        fontWeight: 'bold',
        color: isSelected ? '#2196F3' : '#666666',
        marginRight: '15px',
        minWidth: '24px',
        textAlign: 'center',
        lineHeight: '1.4'
      }
    });

    // 选项文本
    const textElement = DOM.create('div', {
      className: 'option-text',
      textContent: text,
      style: {
        fontSize: '16px',
        color: '#222222',
        lineHeight: '1.4',
        flex: 1
      }
    });

    // 选中指示器
    const checkIndicator = DOM.create('div', {
      className: 'option-check',
      style: {
        marginLeft: '10px',
        opacity: isSelected ? 1 : 0,
        transition: 'opacity 0.2s ease'
      }
    });

    if (isSelected) {
      checkIndicator.innerHTML =
        '<i class="fas fa-check" style="color: #2196F3; font-size: 14px;"></i>';
    }

    // 正确/错误指示器（仅在显示答案时）
    if (this.options.showAnswer) {
      const answerIndicator = DOM.create('div', {
        className: 'answer-indicator',
        style: {
          marginLeft: '10px',
          fontWeight: 'bold'
        }
      });

      if (isCorrect) {
        answerIndicator.textContent = '✓';
        answerIndicator.style.color = '#4CAF50';
      } else if (isSelected && !isCorrect) {
        answerIndicator.textContent = '✗';
        answerIndicator.style.color = '#F44336';
      }

      optionElement.appendChild(answerIndicator);
    }

    optionElement.appendChild(letterElement);
    optionElement.appendChild(textElement);
    optionElement.appendChild(checkIndicator);

    return optionElement;
  }

  /**
   * 处理选项选择
   */
  handleOptionSelect(letter) {
    // 如果已显示答案，不允许更改
    if (this.options.showAnswer) return;

    // 清除之前选中的样式
    if (this.selectedOption && this.selectedOption !== letter) {
      const prevElement = this.optionElements.get(this.selectedOption);
      if (prevElement) {
        prevElement.style.backgroundColor = '#f5f5f5';
        prevElement.style.borderColor = '#ddd';
        const prevCheck = prevElement.querySelector('.option-check');
        if (prevCheck) prevCheck.style.opacity = 0;
        const prevLetter = prevElement.querySelector('.option-letter');
        if (prevLetter) prevLetter.style.color = '#666666';
      }
    }

    // 设置新选中样式
    const currentElement = this.optionElements.get(letter);
    if (currentElement) {
      currentElement.style.backgroundColor = '#E3F2FD';
      currentElement.style.borderColor = '#2196F3';
      const currentCheck = currentElement.querySelector('.option-check');
      if (currentCheck) currentCheck.style.opacity = 1;
      const currentLetter = currentElement.querySelector('.option-letter');
      if (currentLetter) currentLetter.style.color = '#2196F3';
    }

    // 更新状态
    this.selectedOption = letter;

    // 回调
    if (this.options.onSelect) {
      this.options.onSelect(letter, this.options.questionId);
    }

    // 检查答案
    const isCorrect = letter === this.options.answer;
    if (this.options.onComplete) {
      this.options.onComplete(letter, isCorrect, this.options.questionId);
    }
  }

  /**
   * 标记正确答案
   */
  markCorrectAnswer() {
    const correctOption = this.optionElements.get(this.options.answer);
    if (correctOption) {
      correctOption.style.backgroundColor = '#E8F5E9';
      correctOption.style.borderColor = '#4CAF50';
      const correctLetter = correctOption.querySelector('.option-letter');
      if (correctLetter) correctLetter.style.color = '#4CAF50';

      // 添加正确标记
      let correctIndicator = correctOption.querySelector('.answer-indicator');
      if (!correctIndicator) {
        correctIndicator = DOM.create('div', {
          className: 'answer-indicator',
          style: {
            marginLeft: '10px',
            fontWeight: 'bold',
            color: '#4CAF50'
          }
        });
        correctIndicator.textContent = '✓';
        correctOption.appendChild(correctIndicator);
      }
    }

    // 如果用户选错了，标记错误选项
    if (this.selectedOption && this.selectedOption !== this.options.answer) {
      const wrongOption = this.optionElements.get(this.selectedOption);
      if (wrongOption) {
        wrongOption.style.backgroundColor = '#FFEBEE';
        wrongOption.style.borderColor = '#F44336';
        const wrongLetter = wrongOption.querySelector('.option-letter');
        if (wrongLetter) wrongLetter.style.color = '#F44336';

        // 添加错误标记
        let wrongIndicator = wrongOption.querySelector('.answer-indicator');
        if (!wrongIndicator) {
          wrongIndicator = DOM.create('div', {
            className: 'answer-indicator',
            style: {
              marginLeft: '10px',
              fontWeight: 'bold',
              color: '#F44336'
            }
          });
          wrongIndicator.textContent = '✗';
          wrongOption.appendChild(wrongIndicator);
        }
      }
    }
  }

  /**
   * 设置用户答案
   */
  setUserAnswer(letter) {
    this.selectedOption = letter;
    if (this.element) {
      // 重新渲染选项
      this.optionElements.forEach((optionElement, optionLetter) => {
        const isSelected = this.selectedOption === optionLetter;
        optionElement.style.backgroundColor = isSelected ? '#E3F2FD' : '#f5f5f5';
        optionElement.style.borderColor = isSelected ? '#2196F3' : '#ddd';
        const checkIndicator = optionElement.querySelector('.option-check');
        if (checkIndicator) {
          checkIndicator.style.opacity = isSelected ? 1 : 0;
        }
        const letterElement = optionElement.querySelector('.option-letter');
        if (letterElement) {
          letterElement.style.color = isSelected ? '#2196F3' : '#666666';
        }
      });
    }
  }

  /**
   * 获取用户答案
   */
  getUserAnswer() {
    return this.selectedOption;
  }

  /**
   * 显示答案
   */
  showAnswer() {
    this.options.showAnswer = true;
    this.markCorrectAnswer();
  }

  /**
   * 隐藏答案
   */
  hideAnswer() {
    this.options.showAnswer = false;
    // 重置样式（保留用户选择）
    this.optionElements.forEach((optionElement, optionLetter) => {
      const isSelected = this.selectedOption === optionLetter;
      optionElement.style.backgroundColor = isSelected ? '#E3F2FD' : '#f5f5f5';
      optionElement.style.borderColor = isSelected ? '#2196F3' : '#ddd';

      // 移除答案指示器
      const answerIndicator = optionElement.querySelector('.answer-indicator');
      if (answerIndicator) {
        answerIndicator.remove();
      }
    });
  }

  /**
   * 重置选择
   */
  reset() {
    this.selectedOption = '';
    this.options.showAnswer = false;

    if (this.element) {
      this.optionElements.forEach(optionElement => {
        optionElement.style.backgroundColor = '#f5f5f5';
        optionElement.style.borderColor = '#ddd';
        const checkIndicator = optionElement.querySelector('.option-check');
        if (checkIndicator) checkIndicator.style.opacity = 0;
        const letterElement = optionElement.querySelector('.option-letter');
        if (letterElement) letterElement.style.color = '#666666';

        // 移除答案指示器
        const answerIndicator = optionElement.querySelector('.answer-indicator');
        if (answerIndicator) {
          answerIndicator.remove();
        }
      });
    }
  }

  /**
   * 销毁组件
   */
  destroy() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    this.element = null;
    this.optionElements.clear();
  }
}

// 导出组件
export default MultipleChoice;
