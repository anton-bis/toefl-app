/**
 * 写作批改组件 - 文本输入 + AI 评分反馈
 */

import { correctWriting } from '../services/ai.js';
import { DOM } from '../core/utils.js';

let apiKey = null;

/**
 * 初始化写作模块
 */
export function initWritingModule(config = {}) {
  apiKey = config.apiKey || localStorage.getItem('toefl_api_key') || '';
  
  if (!apiKey) {
    showApiKeyInput();
    return;
  }
  
  showWritingInterface();
}

/**
 * 显示 API Key 输入（复用口语的配置）
 */
function showApiKeyInput() {
  const app = document.getElementById('app');
  if (!app) return;
  
  DOM.clear(app);
  
  const container = DOM.create('div', {
    className: 'writing-config',
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
    textContent: '请输入您的 NVIDIA API Key 以使用写作批改功能',
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
        showWritingInterface();
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
 * 显示写作界面
 */
function showWritingInterface() {
  const app = document.getElementById('app');
  if (!app) return;
  
  DOM.clear(app);
  
  const container = DOM.create('div', {
    className: 'writing-container',
    style: {
      maxWidth: '800px',
      margin: '0 auto',
      padding: '20px'
    }
  });
  
  const title = DOM.create('h2', {
    textContent: '写作练习',
    style: { color: '#007A66', marginBottom: '10px' }
  });
  
  // 题目要求
  const questionLabel = DOM.create('label', {
    textContent: '题目要求：',
    style: { display: 'block', marginBottom: '8px', fontWeight: 'bold' }
  });
  
  const questionInput = DOM.create('textarea', {
    placeholder: '请输入写作题目要求...\n\n例如：Do you agree or disagree with the following statement? Use specific reasons and details to support your answer.',
    style: {
      width: '100%',
      height: '100px',
      padding: '12px',
      fontSize: '14px',
      border: '1px solid #ddd',
      borderRadius: '5px',
      marginBottom: '20px',
      resize: 'vertical'
    }
  });
  
  // 作文字数统计
  const wordCountLabel = DOM.create('div', {
    id: 'word-count',
    textContent: '字数：0',
    style: {
      textAlign: 'right',
      marginBottom: '10px',
      color: '#666'
    }
  });
  
  // 作文输入区
  const essayLabel = DOM.create('label', {
    textContent: '请输入您的作文：',
    style: { display: 'block', marginBottom: '8px', fontWeight: 'bold' }
  });
  
  const essayArea = DOM.create('textarea', {
    id: 'essay-area',
    placeholder: '在此输入您的作文...',
    style: {
      width: '100%',
      height: '250px',
      padding: '12px',
      fontSize: '14px',
      border: '1px solid #ddd',
      borderRadius: '5px',
      marginBottom: '20px',
      resize: 'vertical',
      fontFamily: 'Arial, sans-serif',
      lineHeight: '1.8'
    }
  });
  
  // 提交按钮
  const submitBtn = DOM.create('button', {
    id: 'submit-btn',
    textContent: '提交批改',
    style: {
      width: '100%',
      padding: '15px',
      backgroundColor: '#007A66',
      color: 'white',
      border: 'none',
      borderRadius: '5px',
      fontSize: '16px',
      cursor: 'pointer',
      marginBottom: '20px'
    }
  });
  
  // 结果区域
  const resultSection = DOM.create('div', {
    id: 'result-section',
    style: { display: 'none' }
  });
  
  const resultTitle = DOM.create('h3', {
    textContent: '评分结果',
    style: { color: '#007A66', marginBottom: '15px' }
  });
  
  const scoreDisplay = DOM.create('div', {
    id: 'score-display',
    style: {
      fontSize: '48px',
      fontWeight: 'bold',
      textAlign: 'center',
      marginBottom: '20px'
    }
  });
  
  const wordCountResult = DOM.create('div', {
    id: 'word-count-result',
    style: {
      textAlign: 'center',
      marginBottom: '20px',
      color: '#666'
    }
  });
  
  const feedbackText = DOM.create('div', {
    id: 'feedback-text',
    style: {
      padding: '15px',
      backgroundColor: '#f5f5f5',
      borderRadius: '5px',
      marginBottom: '15px',
      whiteSpace: 'pre-wrap'
    }
  });
  
  const strengthsText = DOM.create('div', {
    id: 'strengths-text',
    style: {
      padding: '15px',
      backgroundColor: '#e8f5e9',
      borderRadius: '5px',
      marginBottom: '15px',
      whiteSpace: 'pre-wrap'
    }
  });
  
  const improvementText = DOM.create('div', {
    id: 'improvement-text',
    style: {
      padding: '15px',
      backgroundColor: '#fff3e0',
      borderRadius: '5px',
      marginBottom: '15px',
      whiteSpace: 'pre-wrap'
    }
  });
  
  const issuesText = DOM.create('div', {
    id: 'issues-text',
    style: {
      padding: '15px',
      backgroundColor: '#ffebee',
      borderRadius: '5px',
      marginBottom: '15px',
      whiteSpace: 'pre-wrap'
    }
  });
  
  resultSection.appendChild(resultTitle);
  resultSection.appendChild(scoreDisplay);
  resultSection.appendChild(wordCountResult);
  resultSection.appendChild(feedbackText);
  resultSection.appendChild(strengthsText);
  resultSection.appendChild(improvementText);
  resultSection.appendChild(issuesText);
  
  container.appendChild(title);
  container.appendChild(questionLabel);
  container.appendChild(questionInput);
  container.appendChild(wordCountLabel);
  container.appendChild(essayLabel);
  container.appendChild(essayArea);
  container.appendChild(submitBtn);
  container.appendChild(resultSection);
  app.appendChild(container);
  
  // 字数统计
  essayArea.oninput = () => {
    const count = essayArea.value.trim().length;
    wordCountLabel.textContent = `字数：${count}`;
  };
  
  // 提交批改
  submitBtn.onclick = async () => {
    const question = questionInput.value.trim();
    const essay = essayArea.value.trim();
    
    if (!question) {
      alert('请输入题目要求');
      return;
    }
    if (!essay) {
      alert('请输入您的作文');
      return;
    }
    if (essay.length < 50) {
      alert('作文字数不足，请至少输入50个字符');
      return;
    }
    
    submitBtn.disabled = true;
    submitBtn.textContent = '评分��...';
    
    try {
      const result = await correctWriting(apiKey, essay, question);
      
      scoreDisplay.textContent = `${result.score}/5`;
      scoreDisplay.style.color = result.score >= 4 ? '#4CAF50' : result.score >= 3 ? '#FF9800' : '#F44336';
      wordCountResult.textContent = `作文字数：${result.wordCount || essay.length}`;
      feedbackText.textContent = `📝 总评：${result.feedback}`;
      strengthsText.textContent = `✅ 优点：${result.strengths}`;
      improvementText.textContent = `💡 建议：${result.improvement}`;
      issuesText.textContent = `⚠️ 问题：${result.issues ? result.issues.join(', ') : '无'}`;
      
      resultSection.style.display = 'block';
    } catch (err) {
      alert('评分失败: ' + err.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = '提交批改';
    }
  };
}

export default { initWritingModule };