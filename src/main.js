/**
 * 应用主入口
 * 初始化核心框架，加载模块
 */

import { store } from './core/store.js';
import { loader } from './core/loader.js';
import { parser } from './core/parser.js';
import { DOM, ErrorHandler } from './core/utils.js';

// 模块注册表
const moduleRegistry = new Map();

// 当前活动模块
let currentModule = null;

/**
 * 初始化应用
 */
async function initApp() {
  console.log('托福模考系统初始化...');

  try {
    // 显示加载状态
    showLoading();

    // 从存储加载保存的状态
    await store.loadFromStorage();

    // 注册模块
    await registerModules();

    // 初始化默认模块（阅读模块）
    await initDefaultModule();

    // 隐藏加载状态
    hideLoading();

    // 启动计时器循环
    startTimerLoop();

    // 导出全局API
    exportGlobalAPI();

    console.log('应用初始化完成');
  } catch (error) {
    console.error('应用初始化失败:', error);
    showError('应用初始化失败，请刷新页面重试。');
  }
}

/**
 * 显示加载状态
 */
function showLoading() {
  const appContainer = document.getElementById('app');
  if (!appContainer) return;

  DOM.clear(appContainer);

  const loadingContainer = DOM.create('div', {
    id: 'loading-container',
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      backgroundColor: '#f5f5f5'
    }
  });

  const loadingSpinner = DOM.create('div', {
    className: 'loading-spinner',
    style: {
      width: '50px',
      height: '50px',
      border: '5px solid #f3f3f3',
      borderTop: '5px solid #007A66',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite'
    }
  });

  const loadingText = DOM.create('div', {
    textContent: '加载托福模考系统...',
    style: {
      marginTop: '20px',
      fontSize: '16px',
      color: '#666666'
    }
  });

  // 添加CSS动画
  const style = document.createElement('style');
  style.textContent = `
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `;
  document.head.appendChild(style);

  loadingContainer.appendChild(loadingSpinner);
  loadingContainer.appendChild(loadingText);
  appContainer.appendChild(loadingContainer);
}

/**
 * 隐藏加载状态
 */
function hideLoading() {
  const loadingContainer = document.getElementById('loading-container');
  if (loadingContainer && loadingContainer.parentNode) {
    loadingContainer.parentNode.removeChild(loadingContainer);
  }
}

/**
 * 显示错误信息
 */
function showError(message) {
  const appContainer = document.getElementById('app');
  if (!appContainer) return;

  DOM.clear(appContainer);

  const errorContainer = DOM.create('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      backgroundColor: '#f5f5f5',
      padding: '20px',
      textAlign: 'center'
    }
  });

  const errorIcon = DOM.create('div', {
    innerHTML: '❌',
    style: {
      fontSize: '48px',
      marginBottom: '20px'
    }
  });

  const errorTitle = DOM.create('h2', {
    textContent: '系统错误',
    style: {
      color: '#F44336',
      marginBottom: '10px'
    }
  });

  const errorMessage = DOM.create('p', {
    textContent: message,
    style: {
      color: '#666666',
      marginBottom: '20px',
      maxWidth: '500px'
    }
  });

  const retryButton = DOM.create('button', {
    textContent: '重试',
    style: {
      backgroundColor: '#007A66',
      color: 'white',
      border: 'none',
      borderRadius: '5px',
      padding: '10px 20px',
      fontSize: '14px',
      cursor: 'pointer'
    },
    onClick: () => location.reload()
  });

  errorContainer.appendChild(errorIcon);
  errorContainer.appendChild(errorTitle);
  errorContainer.appendChild(errorMessage);
  errorContainer.appendChild(retryButton);
  appContainer.appendChild(errorContainer);
}

/**
 * 注册模块
 */
async function registerModules() {
  console.log('注册模块...');

  try {
    // 动态导入阅读模块
    const readingModule = await import('./modules/reading/index.js');
    moduleRegistry.set('reading', readingModule.default);
    console.log('模块注册: reading');

    // 这里可以添加其他模块的注册
    // const listeningModule = await import('./modules/listening/index.js');
    // moduleRegistry.set('listening', listeningModule.default);
  } catch (error) {
    console.error('模块注册失败:', error);
    throw new Error('无法加载模块，请检查模块文件是否存在。');
  }
}

/**
 * 初始化默认模块
 */
async function initDefaultModule() {
  console.log('初始化默认模块...');

  // 默认激活阅读模块
  await activateModule('reading');
}

/**
 * 激活模块
 */
async function activateModule(moduleName) {
  console.log(`激活模块: ${moduleName}`);

  try {
    // 停用当前模块
    if (currentModule && currentModule.destroy) {
      await ErrorHandler.wrapAsync(() => currentModule.destroy(), '停用当前模块失败');
    }

    // 获取新模块
    const moduleClass = moduleRegistry.get(moduleName);
    if (!moduleClass) {
      throw new Error(`模块未找到: ${moduleName}`);
    }

    // 创建模块实例
    currentModule = moduleClass;

    // 初始化模块
    await ErrorHandler.wrapAsync(() => currentModule.init(), `初始化模块 ${moduleName} 失败`);

    console.log(`模块激活成功: ${moduleName}`);
  } catch (error) {
    console.error(`激活模块失败: ${moduleName}`, error);
    throw error;
  }
}

/**
 * 启动计时器循环
 */
function startTimerLoop() {
  console.log('启动计时器循环...');

  // 每秒更新一次计时器
  setInterval(() => {
    store.updateTimer();
  }, 1000);
}

/**
 * 创建模块选择器
 */
function createModuleSelector() {
  const selectorContainer = DOM.create('div', {
    id: 'module-selector',
    style: {
      position: 'fixed',
      top: '20px',
      right: '20px',
      zIndex: '1000'
    }
  });

  const select = DOM.create('select', {
    style: {
      padding: '8px 12px',
      borderRadius: '5px',
      border: '1px solid #ddd',
      backgroundColor: 'white',
      fontSize: '14px',
      cursor: 'pointer'
    },
    onChange: e => {
      const selectedModule = e.target.value;
      if (selectedModule) {
        activateModule(selectedModule);
      }
    }
  });

  // 默认选项
  const defaultOption = DOM.create('option', {
    value: '',
    textContent: '选择模块',
    selected: true,
    disabled: true
  });

  // 添加模块选项
  const readingOption = DOM.create('option', {
    value: 'reading',
    textContent: '📚 阅读模块'
  });

  // 这里可以添加其他模块选项
  // const listeningOption = DOM.create('option', {
  //     value: 'listening',
  //     textContent: '🎧 听力模块'
  // });

  select.appendChild(defaultOption);
  select.appendChild(readingOption);

  selectorContainer.appendChild(select);

  return selectorContainer;
}

/**
 * 创建全局样式
 */
function createGlobalStyles() {
  const style = document.createElement('style');
  style.textContent = `
        /* 全局样式重置 */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #222222;
            background-color: #f5f5f5;
        }
        
        #app {
            min-height: 100vh;
        }
        
        /* 修复文本折叠核心样式 */
        .question-text, .fill-blank, .option-text {
            min-height: 1.5em;
            line-height: 1.6;
            overflow: visible;
            white-space: pre-wrap;
            word-break: break-all;
            font-size: 16px;
        }
        
        /* 填空输入框样式 */
        .fill-blank-input {
            border: none;
            border-bottom: 2px solid #007A66;
            background: transparent;
            text-align: center;
            font-size: 17px;
            color: #222222;
            outline: none;
            padding: 0;
            margin: 0 1px;
            min-width: 20px;
            max-width: none;
            box-sizing: content-box;
            vertical-align: middle;
            overflow: visible;
            white-space: nowrap;
        }
        
        .fill-blank-input:focus {
            border-bottom-color: #4CAF50;
            border-bottom-width: 3px;
        }
        
        /* 按钮样式 */
        button {
            cursor: pointer;
            transition: all 0.2s ease;
        }
        
        button:hover {
            opacity: 0.9;
            transform: translateY(-1px);
        }
        
        button:active {
            transform: translateY(0);
        }
        
        /* 响应式设计 */
        @media (max-width: 768px) {
            .module-container {
                padding: 10px !important;
            }
            
            .fill-blank-input {
                font-size: 16px;
            }
        }
        
        @media (max-width: 480px) {
            .controls-container {
                flex-direction: column;
                gap: 10px;
            }
            
            .left-buttons, .right-buttons {
                width: 100%;
                justify-content: center;
            }
        }
    `;

  document.head.appendChild(style);
}

/**
 * 页面加载完成后初始化
 */
document.addEventListener('DOMContentLoaded', async () => {
  console.log('DOM加载完成，开始初始化应用...');

  // 创建全局样式
  createGlobalStyles();

  // 创建模块选择器
  const moduleSelector = createModuleSelector();
  document.body.appendChild(moduleSelector);

  // 初始化应用
  await initApp();

  // 添加页面卸载时的清理
  window.addEventListener('beforeunload', () => {
    if (currentModule && currentModule.destroy) {
      currentModule.destroy();
    }
    store.saveToStorage();
  });
});

// 应用初始化状态
let isAppInitialized = false;

// 立即创建全局API对象（应用加载时即可访问，但标记为未初始化）
window.ToeflApp = {
  store,
  loader,
  parser,
  activateModule: moduleName => activateModule(moduleName),
  getCurrentModule: () => currentModule,
  getModuleRegistry: () => moduleRegistry,
  isInitialized: () => isAppInitialized
};

console.log('托福模考系统全局API已创建（等待初始化）');

// 导出全局API的函数（在应用初始化完成后调用）
function exportGlobalAPI() {
  isAppInitialized = true;
  console.log('托福模考系统全局API已完全初始化');
}

console.log('托福模考系统主入口加载完成');
