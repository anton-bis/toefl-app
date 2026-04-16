/**
 * 填空组件
 * 修复文本折叠问题，确保完整显示
 */

import { DOM, Validator } from '../core/utils.js';

export class FillBlank {
    constructor(options = {}) {
        this.options = {
            prefix: '',
            answer: '',
            underlineCount: 1,
            questionId: 1,
            maxLength: 10,
            onInput: () => {},
            onComplete: () => {},
            ...options
        };
        
        this.element = null;
        this.input = null;
        this.underlineElement = null;
        
        // 状态
        this.value = '';
        this.isCorrect = null;
    }

    /**
     * 渲染组件
     */
    render() {
        // 创建容器
        this.element = DOM.create('div', {
            className: 'fill-blank-container',
            style: {
                display: 'inline-block',
                position: 'relative',
                verticalAlign: 'middle'
            }
        });

        // 创建前缀
        const prefixElement = DOM.create('span', {
            className: 'fill-blank-prefix',
            textContent: this.options.prefix,
            style: {
                fontSize: '17px',
                color: '#222222',
                verticalAlign: 'middle'
            }
        });

        // 创建下划线容器
        this.underlineElement = DOM.create('span', {
            className: 'fill-blank-underline',
            style: {
                display: 'inline-block',
                position: 'relative',
                verticalAlign: 'middle',
                minWidth: '20px'
            }
        });

        // 创建输入框
        this.input = DOM.create('input', {
            type: 'text',
            className: 'fill-blank-input',
            placeholder: '_'.repeat(this.options.underlineCount),
            maxLength: this.options.maxLength,
            style: this.getInputStyle(),
            onInput: (e) => this.handleInput(e),
            onFocus: () => this.handleFocus(),
            onBlur: () => this.handleBlur(),
            onKeyDown: (e) => this.handleKeyDown(e)
        });

        // 创建下划线显示
        const underlineDisplay = DOM.create('div', {
            className: 'fill-blank-underline-display',
            style: {
                position: 'absolute',
                bottom: '0',
                left: '0',
                right: '0',
                height: '2px',
                backgroundColor: '#007A66',
                transition: 'width 0.2s ease'
            }
        });

        // 创建题号标签
        const numberElement = DOM.create('span', {
            className: 'fill-blank-number',
            textContent: this.options.questionId.toString(),
            style: {
                display: 'block',
                fontSize: '10px',
                color: '#666666',
                textAlign: 'center',
                marginTop: '2px'
            }
        });

        // 组装元素
        this.underlineElement.appendChild(this.input);
        this.underlineElement.appendChild(underlineDisplay);
        
        this.element.appendChild(prefixElement);
        this.element.appendChild(this.underlineElement);
        this.element.appendChild(numberElement);

        // 初始调整宽度
        setTimeout(() => this.adjustInputWidth(), 10);

        return this.element;
    }

    /**
     * 获取输入框样式（修复文本折叠）
     */
    getInputStyle() {
        return {
            // 基础样式
            border: 'none',
            background: 'transparent',
            textAlign: 'center',
            fontSize: '17px',
            color: '#222222',
            outline: 'none',
            padding: '0', // 零padding，消除内部空白
            margin: '0 1px', // 使用margin保持间距
            
            // 修复文本折叠关键样式
            minHeight: '1.5em', // 最小行高，避免折叠
            lineHeight: '1.6', // 行高适配字体
            overflow: 'visible', // 禁止隐藏溢出内容
            whiteSpace: 'nowrap', // 防止文本换行
            wordBreak: 'normal', // 正常单词断行
            
            // 尺寸控制
            boxSizing: 'content-box', // 精确宽度计算
            minWidth: '20px', // 最小宽度
            maxWidth: 'none', // 无最大宽度限制
            
            // 定位
            display: 'inline-block',
            verticalAlign: 'middle',
            position: 'relative'
        };
    }

    /**
     * 处理输入
     */
    handleInput(event) {
        const input = event.target;
        const originalValue = input.value;
        
        // 验证输入：只允许英文字母
        const cleanedValue = Validator.cleanEnglishText(originalValue);
        
        if (cleanedValue !== originalValue) {
            input.value = cleanedValue;
        }
        
        this.value = cleanedValue;
        
        // 调整宽度
        this.adjustInputWidth();
        
        // 回调
        if (this.options.onInput) {
            this.options.onInput(this.value, this.options.questionId);
        }
        
        // 检查是否完成
        if (this.value.length >= this.options.underlineCount) {
            this.checkAnswer();
            
            if (this.options.onComplete) {
                this.options.onComplete(this.value, this.isCorrect, this.options.questionId);
            }
        }
    }

    /**
     * 处理焦点
     */
    handleFocus() {
        DOM.addClass(this.input, 'fill-blank-focused');
        this.adjustInputWidth();
    }

    /**
     * 处理失去焦点
     */
    handleBlur() {
        DOM.removeClass(this.input, 'fill-blank-focused');
        this.adjustInputWidth();
    }

    /**
     * 处理键盘事件
     */
    handleKeyDown(event) {
        // Tab键跳转
        if (event.key === 'Tab') {
            event.preventDefault();
            if (this.options.onTab) {
                this.options.onTab(event.shiftKey ? 'prev' : 'next');
            }
        }
        
        // Enter键跳转到下一个
        if (event.key === 'Enter') {
            event.preventDefault();
            if (this.options.onTab) {
                this.options.onTab('next');
            }
        }
        
        // 退格键删除
        if (event.key === 'Backspace' || event.key === 'Delete') {
            setTimeout(() => this.adjustInputWidth(), 10);
        }
    }

    /**
     * 调整输入框宽度（精确匹配文本）
     */
    adjustInputWidth() {
        if (!this.input) return;
        
        const value = this.input.value;
        const placeholder = this.input.placeholder;
        
        if (value.length === 0) {
            // 空状态：测量placeholder宽度
            const placeholderWidth = this.measureTextWidth(placeholder);
            this.input.style.width = `${Math.max(placeholderWidth + 4, 20)}px`;
        } else {
            // 有内容：测量实际文本宽度
            const textWidth = this.measureTextWidth(value);
            this.input.style.width = `${textWidth + 4}px`; // 加少量padding
        }
        
        // 更新下划线显示
        this.updateUnderlineDisplay();
    }

    /**
     * 测量文本宽度
     */
    measureTextWidth(text) {
        if (!text) return 0;
        
        // 创建临时元素测量
        const tempSpan = document.createElement('span');
        tempSpan.style.cssText = `
            position: absolute;
            visibility: hidden;
            white-space: nowrap;
            font-family: inherit;
            font-size: 17px;
            letter-spacing: normal;
        `;
        tempSpan.textContent = text;
        document.body.appendChild(tempSpan);
        const width = tempSpan.offsetWidth;
        document.body.removeChild(tempSpan);
        
        return width;
    }

    /**
     * 更新下划线显示
     */
    updateUnderlineDisplay() {
        if (!this.underlineElement) return;
        
        const underlineDisplay = this.underlineElement.querySelector('.fill-blank-underline-display');
        if (underlineDisplay) {
            const inputWidth = this.input.offsetWidth;
            underlineDisplay.style.width = `${inputWidth}px`;
            
            // 根据状态改变颜色
            if (this.isCorrect === true) {
                underlineDisplay.style.backgroundColor = '#4CAF50'; // 正确：绿色
            } else if (this.isCorrect === false) {
                underlineDisplay.style.backgroundColor = '#F44336'; // 错误：红色
            } else {
                underlineDisplay.style.backgroundColor = '#007A66'; // 默认：深绿色
            }
        }
    }

    /**
     * 检查答案
     */
    checkAnswer() {
        if (!this.value || !this.options.answer) {
            this.isCorrect = null;
            return;
        }
        
        this.isCorrect = this.value.toLowerCase() === this.options.answer.toLowerCase();
        this.updateUnderlineDisplay();
        
        return this.isCorrect;
    }

    /**
     * 设置值
     */
    setValue(value) {
        if (this.input) {
            this.input.value = Validator.cleanEnglishText(value);
            this.value = this.input.value;
            this.adjustInputWidth();
            this.checkAnswer();
        }
    }

    /**
     * 获取值
     */
    getValue() {
        return this.value;
    }

    /**
     * 获取是否正确
     */
    getIsCorrect() {
        return this.isCorrect;
    }

    /**
     * 重置
     */
    reset() {
        if (this.input) {
            this.input.value = '';
            this.value = '';
            this.isCorrect = null;
            this.adjustInputWidth();
            this.updateUnderlineDisplay();
        }
    }

    /**
     * 聚焦
     */
    focus() {
        if (this.input) {
            this.input.focus();
        }
    }

    /**
     * 销毁
     */
    destroy() {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        this.element = null;
        this.input = null;
        this.underlineElement = null;
    }
}

// 导出组件
export default FillBlank;