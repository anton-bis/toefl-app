/**
 * 工具函数库
 * 提供DOM操作、格式化、错误处理等通用功能
 */

/**
 * DOM操作工具
 */
export const DOM = {
    /**
     * 创建元素
     */
    create(tag, attributes = {}, children = []) {
        const element = document.createElement(tag);
        
        // 设置属性
        Object.entries(attributes).forEach(([key, value]) => {
            if (key === 'className') {
                element.className = value;
            } else if (key === 'style' && typeof value === 'object') {
                Object.assign(element.style, value);
            } else if (key.startsWith('on') && typeof value === 'function') {
                const eventName = key.substring(2).toLowerCase();
                element.addEventListener(eventName, value);
            } else {
                element.setAttribute(key, value);
            }
        });
        
        // 添加子元素
        children.forEach(child => {
            if (typeof child === 'string') {
                element.appendChild(document.createTextNode(child));
            } else if (child instanceof Node) {
                element.appendChild(child);
            }
        });
        
        return element;
    },
    
    /**
     * 清空元素
     */
    clear(element) {
        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }
    },
    
    /**
     * 显示/隐藏元素
     */
    toggleVisibility(element, show) {
        if (show === undefined) {
            show = element.style.display === 'none';
        }
        element.style.display = show ? '' : 'none';
    },
    
    /**
     * 添加CSS类
     */
    addClass(element, className) {
        if (!element.classList.contains(className)) {
            element.classList.add(className);
        }
    },
    
    /**
     * 移除CSS类
     */
    removeClass(element, className) {
        element.classList.remove(className);
    },
    
    /**
     * 切换CSS类
     */
    toggleClass(element, className) {
        element.classList.toggle(className);
    }
};

/**
 * 格式化工具
 */
export const Formatter = {
    /**
     * 格式化时间（秒 → MM:SS）
     */
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    },
    
    /**
     * 格式化日期
     */
    formatDate(date, format = 'YYYY-MM-DD HH:mm:ss') {
        const d = date instanceof Date ? date : new Date(date);
        
        const replacements = {
            'YYYY': d.getFullYear(),
            'MM': (d.getMonth() + 1).toString().padStart(2, '0'),
            'DD': d.getDate().toString().padStart(2, '0'),
            'HH': d.getHours().toString().padStart(2, '0'),
            'mm': d.getMinutes().toString().padStart(2, '0'),
            'ss': d.getSeconds().toString().padStart(2, '0')
        };
        
        return format.replace(/YYYY|MM|DD|HH|mm|ss/g, match => replacements[match]);
    },
    
    /**
     * 格式化分数
     */
    formatScore(score, total = 100) {
        return `${score}/${total} (${Math.round((score / total) * 100)}%)`;
    },
    
    /**
     * 截断文本
     */
    truncateText(text, maxLength = 100, suffix = '...') {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength - suffix.length) + suffix;
    }
};

/**
 * 验证工具
 */
export const Validator = {
    /**
     * 验证邮箱
     */
    isEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    },
    
    /**
     * 验证密码强度
     */
    isStrongPassword(password) {
        // 至少8位，包含大小写字母和数字
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
        return passwordRegex.test(password);
    },
    
    /**
     * 验证英文字母（用于填空输入）
     */
    isEnglishLetters(text) {
        const englishRegex = /^[a-zA-Z]*$/;
        return englishRegex.test(text);
    },
    
    /**
     * 清理非英文字母
     */
    cleanEnglishText(text) {
        return text.replace(/[^a-zA-Z]/g, '');
    }
};

/**
 * 错误处理工具
 */
export const ErrorHandler = {
    /**
     * 包装异步函数，提供错误处理
     */
    async wrapAsync(fn, errorMessage = '操作失败') {
        try {
            return await fn();
        } catch (error) {
            console.error(errorMessage, error);
            this.showError(errorMessage, error);
            throw error;
        }
    },
    
    /**
     * 显示错误信息
     */
    showError(message, error = null) {
        // 在实际应用中，这里可以显示模态框或通知
        console.error('错误:', message, error);
        
        // 简单的alert实现
        if (typeof window !== 'undefined' && window.alert) {
            const fullMessage = error ? `${message}\n\n错误详情: ${error.message}` : message;
            alert(fullMessage);
        }
    },
    
    /**
     * 重试函数
     */
    async retry(fn, maxRetries = 3, delay = 1000) {
        let lastError;
        
        for (let i = 0; i < maxRetries; i++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;
                console.log(`重试 ${i + 1}/${maxRetries}...`, error);
                
                if (i < maxRetries - 1) {
                    await this.sleep(delay);
                    delay *= 2; // 指数退避
                }
            }
        }
        
        throw lastError;
    },
    
    /**
     * 睡眠函数
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
};

/**
 * 本地存储工具
 */
export const Storage = {
    /**
     * 保存数据
     */
    save(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('保存到localStorage失败:', error);
            return false;
        }
    },
    
    /**
     * 加载数据
     */
    load(key, defaultValue = null) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : defaultValue;
        } catch (error) {
            console.error('从localStorage加载失败:', error);
            return defaultValue;
        }
    },
    
    /**
     * 删除数据
     */
    remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error('从localStorage删除失败:', error);
            return false;
        }
    },
    
    /**
     * 清空所有数据
     */
    clear() {
        try {
            localStorage.clear();
            return true;
        } catch (error) {
            console.error('清空localStorage失败:', error);
            return false;
        }
    }
};

/**
 * 性能监控工具
 */
export const Performance = {
    /**
     * 测量函数执行时间
     */
    measure(fn, label = 'Function') {
        const start = performance.now();
        const result = fn();
        const end = performance.now();
        
        console.log(`${label} 执行时间: ${(end - start).toFixed(2)}ms`);
        return result;
    },
    
    /**
     * 异步测量
     */
    async measureAsync(fn, label = 'Async Function') {
        const start = performance.now();
        const result = await fn();
        const end = performance.now();
        
        console.log(`${label} 执行时间: ${(end - start).toFixed(2)}ms`);
        return result;
    }
};

/**
 * 随机工具
 */
export const Random = {
    /**
     * 生成随机ID
     */
    generateId(length = 8) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    },
    
    /**
     * 随机选择数组元素
     */
    pick(array) {
        return array[Math.floor(Math.random() * array.length)];
    },
    
    /**
     * 打乱数组
     */
    shuffle(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }
};

// 导出所有工具
export default {
    DOM,
    Formatter,
    Validator,
    ErrorHandler,
    Storage,
    Performance,
    Random
};