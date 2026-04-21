/**
 * 题目问答组件 - 题目解析/答疑 + 错题讲解
 */

import { explainQuestion, explainMistake } from '../services/ai.js';
import { DOM } from '../core/utils.js';

let apiKey = null;

/**
 * 初始化问答模块
 */
export function initQNAModule(config = {}) {
  apiKey = config.apiKey || localStorage.getItem('toefl_api_key') || '';
  
  if (!apiKey) {
    showApiKeyInput();
    return;
  }
  
  showQNAInterface();
}

/**
 * 显示 API Key 输入
 */
function showApiKeyInput() {
  const app = document.getElementById('app');
  if (!app) return;
  
  DOM.clear(app);
  
  const container = DOM.create('div', {
    className: 'qna-config',
    style: {
      maxWidth: '500px',
      margin: '50px auto',
      padding: '30px',
      backgroundColor: 'white',
      borderRadius: '10px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
    }
  });
  
  const title = DOM.create('h2', {
    textContent: '配置 API Key',
    style: { marginBottom: '20px', color: '#007A66' }
  });
  
  const desc = DOM.create('p', {
    textContent: '请输入您的 NVIDIA API Key 以使用问答功能',
    style: { marginBottom: '20px', color: '#666' }
  });
  
  const input = DOM.create('input', {
    type: 'text',
    placeholder: 'nvapi-xxx',
    style: {
      width: '100%',
      padding: '12px',
      fontSize: '14px',
      border: '1px solid #ddd',
      borderRadius: '5px',
      marginBottom: '15px'
    }
  });
  
  const button = DOM.create('button', {
    textContent: '保存并开始',
    style: {
      width: '100%',
      padding: '12px',
      backgroundColor: '#007A66',
      color: 'white',
      border: 'none',
      borderRadius: '5px',
      fontSize: '16px',
      cursor: 'pointer'
    },
    onClick: () => {
      const key = input.value.trim();
      if (key) {
        localStorage.setItem('toefl_api_key', key);
        apiKey = key;
        showQNAInterface();
      }
    }
  });
  
  container.appendChild(title);
  container.appendChild(desc);
  container.appendChild(input);
  container.appendChild(button);
  app.appendChild(container);
}

/**
 * 显示问答界面
 */
function showQNAInterface() {
  const app = document.getElementById('app');
  if (!app) return;
  
  DOM.clear(app);
  
  const container = DOM.create('div', {
    className: 'qna-container',
    style: {
      maxWidth: '800px',
      margin: '0 auto',
      padding: '20px'
    }
  });
  
  const title = DOM.create('h2', {
    textContent: '题目问答',
    style: { color: '#007A66', marginBottom: '10px' }
  });
  
  const tabContainer = DOM.create('div', {
    style: {
      display: 'flex',
      gap: '10px',
      marginBottom: '20px'
    }
  });
  
  const explainTab = DOM.create('button', {
    id: 'explain-tab',
    textContent: '📖 题目解析',
    style: {
      padding: '10px 20px',
      backgroundColor: '#007A66',
      color: 'white',
      border: 'none',
      borderRadius: '5px 5px 0 0',
      cursor: 'pointer'
    }
  });
  
  const qaTab = DOM.create('button', {
    id: 'qa-tab',
    textContent: '❓ 提问答疑',
    style: {
      padding: '10px 20px',
      backgroundColor: '#ddd',
      color: '#333',
      border: 'none',
      borderRadius: '5px 5px 0 0',
      cursor: 'pointer'
    }
  });
  
  tabContainer.appendChild(explainTab);
  tabContainer.appendChild(qaTab);
  
  const contentArea = DOM.create('div', {
    id: 'qna-content',
    style: {
      padding: '20px',
      backgroundColor: 'white',
      borderRadius: '0 5px 5px 5px',
      minHeight: '400px'
    }
  });
  
  container.appendChild(title);
  container.appendChild(tabContainer);
  container.appendChild(contentArea);
  app.appendChild(container);
  
  // 题目解析界面
  showExplainPanel(contentArea);
  
  let currentMode = 'explain';
  
  explainTab.onclick = () => {
    if (currentMode !== 'explain') {
      currentMode = 'explain';
      explainTab.style.backgroundColor = '#007A66';
      explainTab.style.color = 'white';
      qaTab.style.backgroundColor = '#ddd';
      qaTab.style.color = '#333';
      showExplainPanel(contentArea);
    }
  };
  
  qaTab.onclick = () => {
    if (currentMode !== 'qa') {
      currentMode = 'qa';
      qaTab.style.backgroundColor = '#007A66';
      qaTab.style.color = 'white';
      explainTab.style.backgroundColor = '#ddd';
      explainTab.style.color = '#333';
      showQAPanel(contentArea);
    }
  };
}

/**
 * 题目解析面板
 */
function showExplainPanel(container) {
  DOM.clear(container);
  
  const title = DOM.create('h3', {
    textContent: '题目解析',
    style: { color: '#007A66', marginBottom: '15px' }
  });
  
  const desc = DOM.create('p', {
    textContent: '输入题目和答案，获取解题思路分析',
    style: { marginBottom: '20px', color: '#666' }
  });
  
  const questionLabel = DOM.create('label', {
    textContent: '题目内容：',
    style: { display: 'block', marginBottom: '8px', fontWeight: 'bold' }
  });
  
  const questionInput = DOM.create('textarea', {
    placeholder: '请粘贴题目内容...',
    style: {
      width: '100%',
      height: '120px',
      padding: '12px',
      fontSize: '14px',
      border: '1px solid #ddd',
      borderRadius: '5px',
      marginBottom: '15px',
      resize: 'vertical'
    }
  });
  
  const userAnswerLabel = DOM.create('label', {
    textContent: '你的答案：',
    style: { display: 'block', marginBottom: '8px', fontWeight: 'bold' }
  });
  
  const userAnswerInput = DOM.create('input', {
    type: 'text',
    placeholder: 'A / B / C / D',
    style: {
      width: '100%',
      padding: '12px',
      fontSize: '14px',
      border: '1px solid #ddd',
      borderRadius: '5px',
      marginBottom: '15px'
    }
  });
  
  const correctAnswerLabel = DOM.create('label', {
    textContent: '正确答案：',
    style: { display: 'block', marginBottom: '8px', fontWeight: 'bold' }
  });
  
  const correctAnswerInput = DOM.create('input', {
    type: 'text',
    placeholder: 'A / B / C / D',
    style: {
      width: '100%',
      padding: '12px',
      fontSize: '14px',
      border: '1px solid #ddd',
      borderRadius: '5px',
      marginBottom: '15px'
    }
  });
  
  const submitBtn = DOM.create('button', {
    textContent: '获取解析',
    style: {
      width: '100%',
      padding: '12px',
      backgroundColor: '#007A66',
      color: 'white',
      border: 'none',
      borderRadius: '5px',
      fontSize: '16px',
      cursor: 'pointer',
      marginBottom: '20px'
    }
  });
  
  const resultArea = DOM.create('div', {
    id: 'explain-result',
    style: { display: 'none' }
  });
  
  container.appendChild(title);
  container.appendChild(desc);
  container.appendChild(questionLabel);
  container.appendChild(questionInput);
  container.appendChild(userAnswerLabel);
  container.appendChild(userAnswerInput);
  container.appendChild(correctAnswerLabel);
  container.appendChild(correctAnswerInput);
  container.appendChild(submitBtn);
  container.appendChild(resultArea);
  
  submitBtn.onclick = async () => {
    const question = questionInput.value.trim();
    const userAnswer = userAnswerInput.value.trim().toUpperCase();
    const correctAnswer = correctAnswerInput.value.trim().toUpperCase();
    
    if (!question || !userAnswer || !correctAnswer) {
      alert('���填写完整信息');
      return;
    }
    
    submitBtn.disabled = true;
    submitBtn.textContent = '分析中...';
    
    try {
      // 判断是否答对
      const isCorrect = userAnswer === correctAnswer;
      
      let result;
      if (isCorrect) {
        result = await explainQuestion(apiKey, question, userAnswer, correctAnswer);
      } else {
        result = await explainMistake(apiKey, question, userAnswer, correctAnswer);
      }
      
      resultArea.innerHTML = `
        <div style="padding: 15px; backgroundColor: ${isCorrect ? '#e8f5e9' : '#ffebee'}; borderRadius: 5px; marginBottom: 15px;">
          <strong>${isCorrect ? '✅ 回答正确！' : '❌ 回答错误'}</strong>
        </div>
        <div style="padding: 15px; backgroundColor: #f5f5f5; borderRadius: 5px; whiteSpace: pre-wrap;">${result}</div>
      `;
      resultArea.style.display = 'block';
    } catch (err) {
      alert('解析失败: ' + err.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = '获取解析';
    }
  };
}

/**
 * 提问答疑面板
 */
function showQAPanel(container) {
  DOM.clear(container);
  
  const title = DOM.create('h3', {
    textContent: '提问答疑',
    style: { color: '#007A66', marginBottom: '15px' }
  });
  
  const desc = DOM.create('p', {
    textContent: '对任何题目有疑问都可以提问',
    style: { marginBottom: '20px', color: '#666' }
  });
  
  const questionLabel = DOM.create('label', {
    textContent: '题目原文/背景（可选）：',
    style: { display: 'block', marginBottom: '8px', fontWeight: 'bold' }
  });
  
  const questionInput = DOM.create('textarea', {
    placeholder: '可以粘贴题目原文或阅读文章...',
    style: {
      width: '100%',
      height: '100px',
      padding: '12px',
      fontSize: '14px',
      border: '1px solid #ddd',
      borderRadius: '5px',
      marginBottom: '15px',
      resize: 'vertical'
    }
  });
  
  const userQuestionLabel = DOM.create('label', {
    textContent: '你的问题：',
    style: { display: 'block', marginBottom: '8px', fontWeight: 'bold' }
  });
  
  const userQuestionInput = DOM.create('textarea', {
    placeholder: '请描述你的问题...',
    style: {
      width: '100%',
      height: '100px',
      padding: '12px',
      fontSize: '14px',
      border: '1px solid #ddd',
      borderRadius: '5px',
      marginBottom: '15px',
      resize: 'vertical'
    }
  });
  
  const submitBtn = DOM.create('button', {
    textContent: '提问',
    style: {
      width: '100%',
      padding: '12px',
      backgroundColor: '#007A66',
      color: 'white',
      border: 'none',
      borderRadius: '5px',
      fontSize: '16px',
      cursor: 'pointer',
      marginBottom: '20px'
    }
  });
  
  const resultArea = DOM.create('div', {
    id: 'qa-result',
    style: { display: 'none' }
  });
  
  container.appendChild(title);
  container.appendChild(desc);
  container.appendChild(questionLabel);
  container.appendChild(questionInput);
  container.appendChild(userQuestionLabel);
  container.appendChild(userQuestionInput);
  container.appendChild(submitBtn);
  container.appendChild(resultArea);
  
  // 通用问答功能
  const prompt = `你是一位托福阅读教学专家。请用中文回答学生的问题。

${questionInput.value ? '【题目背景】\n' + questionInput.value + '\n' : ''}
【学生问题】
${userQuestionInput.value}

请简洁明了地回答，控制在200字以内。`;

  submitBtn.onclick = async () => {
    const question = questionInput.value.trim();
    const userQ = userQuestionInput.value.trim();
    
    if (!userQ) {
      alert('请输入你的问题');
      return;
    }
    
    submitBtn.disabled = true;
    submitBtn.textContent = '回答中...';
    
    try {
      const result = await callAI(apiKey, question + '\n\n' + userQ);
      
      resultArea.innerHTML = `
        <div style="padding: 15px; backgroundColor: #f5f5f5; borderRadius: 5px; whiteSpace: pre-wrap;">${result}</div>
      `;
      resultArea.style.display = 'block';
    } catch (err) {
      alert('回答失败: ' + err.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = '提问';
    }
  };
}

async function callAI(key, content, options = {}) {
  const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    },
    body: JSON.stringify({
      model: 'meta/llama-3.1-405b-instruct',
      messages: [{ role: 'user', content: content }],
      max_tokens: options.max_tokens || 500,
      temperature: 0.7
    })
  });
  
  if (!response.ok) {
    throw new Error(`API错误: ${response.status}`);
  }
  
  const json = await response.json();
  if (json.choices && json.choices[0]) {
    return json.choices[0].message.content;
  }
  throw new Error('API返回异常');
}

export default { initQNAModule };