/**
 * 口语批改组件 - 录音输入 + AI 评分反馈
 */

import { correctSpeaking } from '../services/ai.js';
import { DOM } from '../core/utils.js';

let apiKey = null;
let currentQuestion = null;
let currentTranscript = '';

/**
 * 初始化组件
 */
export function initSpeakingModule(config = {}) {
  apiKey = config.apiKey || localStorage.getItem('toefl_api_key') || '';
  
  if (!apiKey) {
    showApiKeyInput();
    return;
  }
  
  showSpeakingInterface();
}

/**
 * 显示 API Key 输入界面
 */
function showApiKeyInput() {
  const app = document.getElementById('app');
  if (!app) return;
  
  DOM.clear(app);
  
  const container = DOM.create('div', {
    className: 'speaking-config',
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
    textContent: '请输入您的 NVIDIA API Key 以使用口语批改功能',
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
        showSpeakingInterface();
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
 * 显示口语界面
 */
function showSpeakingInterface() {
  const app = document.getElementById('app');
  if (!app) return;
  
  DOM.clear(app);
  
  const container = DOM.create('div', {
    className: 'speaking-container',
    style: {
      maxWidth: '700px',
      margin: '0 auto',
      padding: '20px'
    }
  });
  
  const title = DOM.create('h2', {
    textContent: '口语练习',
    style: { color: '#007A66', marginBottom: '10px' }
  });
  
  // 题目输入区
  const questionLabel = DOM.create('label', {
    textContent: '题目要求：',
    style: { display: 'block', marginBottom: '8px', fontWeight: 'bold' }
  });
  
  const questionInput = DOM.create('textarea', {
    placeholder: '请输入口语题目要求...',
    style: {
      width: '100%',
      height: '80px',
      padding: '12px',
      fontSize: '14px',
      border: '1px solid #ddd',
      borderRadius: '5px',
      marginBottom: '20px',
      resize: 'vertical'
    }
  });
  
  // 录音区域
  const recordSection = DOM.create('div', {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '15px',
      marginBottom: '20px',
      padding: '20px',
      backgroundColor: '#f9f9f9',
      borderRadius: '8px'
    }
  });
  
  const recordBtn = DOM.create('button', {
    id: 'record-btn',
    textContent: '🎤 开始录音',
    style: {
      padding: '15px 25px',
      backgroundColor: '#007A66',
      color: 'white',
      border: 'none',
      borderRadius: '50px',
      fontSize: '16px',
      cursor: 'pointer'
    }
  });
  
  const status = DOM.create('span', {
    id: 'record-status',
    textContent: '点击按钮开始录音',
    style: { color: '#666' }
  });
  
  recordSection.appendChild(recordBtn);
  recordSection.appendChild(status);
  
  // 转写结果
  const transcriptLabel = DOM.create('label', {
    textContent: '您的回答（自动转写）：',
    style: { display: 'block', marginBottom: '8px', fontWeight: 'bold' }
  });
  
  const transcriptArea = DOM.create('textarea', {
    id: 'transcript-area',
    placeholder: '录音内容将显示在这里，也可以直接输入...',
    style: {
      width: '100%',
      height: '120px',
      padding: '12px',
      fontSize: '14px',
      border: '1px solid #ddd',
      borderRadius: '5px',
      marginBottom: '20px',
      resize: 'vertical'
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
  
  resultSection.appendChild(resultTitle);
  resultSection.appendChild(scoreDisplay);
  resultSection.appendChild(feedbackText);
  resultSection.appendChild(strengthsText);
  resultSection.appendChild(improvementText);
  
  container.appendChild(title);
  container.appendChild(questionLabel);
  container.appendChild(questionInput);
  container.appendChild(recordSection);
  container.appendChild(transcriptLabel);
  container.appendChild(transcriptArea);
  container.appendChild(submitBtn);
  container.appendChild(resultSection);
  app.appendChild(container);
  
  // 绑定事件
  let mediaRecorder = null;
  let audioChunks = [];
  let isRecording = false;
  
  recordBtn.onclick = async () => {
    if (!isRecording) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        
        mediaRecorder.ondataavailable = e => {
          audioChunks.push(e.data);
        };
        
        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
          const audioUrl = URL.createObjectURL(audioBlob);
          transcriptArea.value += '\n[音频已录制，点击"提交批改"进行分析]';
          
          // 语音转文字（浏览器原生API不支持，提示用户）
          transcriptArea.placeholder = '请在上方手动输入您的回答，或使用第三方语音识别服务';
        };
        
        mediaRecorder.start();
        isRecording = true;
        recordBtn.textContent = '⏹ 停止录音';
        status.textContent = '录音中...';
        
      } catch (err) {
        alert('无法访问麦克风，请确保已授予权限');
      }
    } else {
      mediaRecorder.stop();
      isRecording = false;
      recordBtn.textContent = '🎤 重新录音';
      status.textContent = '录音完成';
    }
  };
  
  submitBtn.onclick = async () => {
    const question = questionInput.value.trim();
    const transcript = transcriptArea.value.trim();
    
    if (!question) {
      alert('请输入题目要求');
      return;
    }
    if (!transcript) {
      alert('请先录音或输入您的回答');
      return;
    }
    
    submitBtn.disabled = true;
    submitBtn.textContent = '评分中...';
    
    try {
      const result = await correctSpeaking(apiKey, transcript, question, 60);
      
      scoreDisplay.textContent = `${result.score}/4`;
      scoreDisplay.style.color = result.score >= 3 ? '#4CAF50' : '#FF9800';
      feedbackText.textContent = `📝 反馈：${result.feedback}`;
      strengthsText.textContent = `✅ 优点：${result.strengths}`;
      improvementText.textContent = `💡 建议：${result.improvement}`;
      
      resultSection.style.display = 'block';
    } catch (err) {
      alert('评分失败: ' + err.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = '提交批改';
    }
  };
}

export default { initSpeakingModule };
