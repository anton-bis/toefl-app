/**
 * 写作批改组件 - 重构为双标签页：Write an Email / Academic Discussion
 * 参考新 API：scoreWriteEmail, scoreAcademicDiscussion, convertTotal05_to_final30_final6_for_writing
 */

import { scoreWriteEmail, scoreAcademicDiscussion, convertTotal05_to_final30_final6_for_writing } from '../services/ai.js';
import { DOM } from '../core/utils.js';

let apiKey = null;

// 简单的英文单词统计
function countWordsEnglish(text = '') {
  return text.trim().length ? text.trim().split(/\s+/).filter((w) => w).length : 0;
}

function clearAllInputs() {
  const app = document.getElementById('app');
  if (!app) return;
  // 清空输入区与结果区
  const emailPanel = document.getElementById('email-panel');
  const discussionPanel = document.getElementById('discussion-panel');
  if (emailPanel) {
    const subj = emailPanel.querySelector('[data-role="email-subject"]');
    const body = emailPanel.querySelector('[data-role="email-body"]');
    if (subj) subj.value = '';
    if (body) body.value = '';
    const wc = emailPanel.querySelector('[data-role="email-body-wordcount"]');
    if (wc) wc.textContent = 'Words: 0';
  }
  if (discussionPanel) {
    const topic = discussionPanel.querySelector('[data-role="discussion-topic"]');
    const body = discussionPanel.querySelector('[data-role="discussion-body"]');
    if (topic) topic.value = '';
    if (body) body.value = '';
    const wc = discussionPanel.querySelector('[data-role="discussion-body-wordcount"]');
    if (wc) wc.textContent = 'Words: 0';
  }
  // 结果区
  const finalEmail = document.getElementById('final-writing-email');
  const finalDiscuss = document.getElementById('final-writing-discussion');
  if (finalEmail) finalEmail.textContent = '';
  if (finalDiscuss) finalDiscuss.textContent = '';
}

// 初始化入口
export function initWritingModule(config = {}) {
  apiKey = config.apiKey || localStorage.getItem('toefl_api_key') || '';
  if (!apiKey) {
    showApiKeyInput();
    return;
  }
  showWritingInterface();
}

/** 显示 API Key 输入（保留原样，以免影响现有配置） */
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

/** 组装写作界面：包含两个标签页、并实现切换清空行为 */
function showWritingInterface() {
  const app = document.getElementById('app');
  if (!app) return;
  DOM.clear(app);

  const wrapper = DOM.create('div', {
    className: 'writing-wrapper',
    style: { maxWidth: '980px', margin: '0 auto', padding: '16px' }
  });

  // 顶部 Tab 导航
  const tabBar = DOM.create('div', {
    className: 'writing-tabs',
    style: {
      display: 'flex',
      gap: '8px',
      marginBottom: '12px'
    }
  });

  const tabEmail = DOM.create('button', {
    textContent: 'Write an Email',
    style: {
      padding: '10px 14px',
      border: '1px solid #ddd',
      borderRadius: '6px',
      backgroundColor: '#fff',
      cursor: 'pointer'
    },
    id: 'tab-email'
  });
  const tabDiscuss = DOM.create('button', {
    textContent: 'Academic Discussion',
    style: {
      padding: '10px 14px',
      border: '1px solid #ddd',
      borderRadius: '6px',
      backgroundColor: '#fff',
      cursor: 'pointer'
    },
    id: 'tab-discussion'
  });

  tabBar.appendChild(tabEmail);
  tabBar.appendChild(tabDiscuss);
  wrapper.appendChild(tabBar);

  // Email 面板
  const emailPanel = DOM.create('section', {
    id: 'email-panel',
    style: { display: 'block' }
  });

  const emailTitle = DOM.create('h3', {
    textContent: 'Write an Email',
    style: { color: '#007A66', marginBottom: '8px' }
  });
  emailPanel.appendChild(emailTitle);

  const emailSubjectLabel = DOM.create('label', {
    textContent: 'Subject:',
    style: { display: 'block', fontWeight: 'bold', marginTop: '8px' }
  });
  const emailSubject = DOM.create('textarea', {
    placeholder: 'Enter email subject...',
    style: {
      width: '100%', height: '60px', padding: '8px', fontSize: '14px', border: '1px solid #ddd', borderRadius: '4px', resize: 'vertical'
    },
    'data-role': 'email-subject'
  });

  const emailBodyLabel = DOM.create('label', {
    textContent: 'Body:',
    style: { display: 'block', fontWeight: 'bold', marginTop: '12px' }
  });
  const emailBody = DOM.create('textarea', {
    placeholder: 'Write your essay here...',
    style: {
      width: '100%', height: '180px', padding: '8px', fontSize: '14px', border: '1px solid #ddd', borderRadius: '4px', resize: 'vertical'
    },
    'data-role': 'email-body',
  });
  const emailWordCount = DOM.create('div', {
    'data-role': 'email-body-wordcount',
    textContent: 'Words: 0',
    style: { textAlign: 'right', marginTop: '6px', color: '#666' }
  });

  const emailSubmit = DOM.create('button', {
    textContent: '提交批改',
    style: {
      width: '100%', padding: '12px', backgroundColor: '#007A66', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', marginTop: '12px'
    }
  });

  const emailResult = DOM.create('div', {
    id: 'final-writing-email',
    style: { marginTop: '14px', fontSize: '22px', fontWeight: 'bold', textAlign: 'center', color: '#333' }
  });

  emailPanel.appendChild(emailSubjectLabel);
  emailPanel.appendChild(emailSubject);
  emailPanel.appendChild(emailBodyLabel);
  emailPanel.appendChild(emailBody);
  emailPanel.appendChild(emailWordCount);
  emailPanel.appendChild(emailSubmit);
  emailPanel.appendChild(emailResult);
  wrapper.appendChild(emailPanel);

  // Discussion 面板
  const discussionPanel = DOM.create('section', {
    id: 'discussion-panel',
    style: { display: 'none' }
  });

  const discTitle = DOM.create('h3', {
    textContent: 'Academic Discussion',
    style: { color: '#007A66', marginBottom: '8px' }
  });
  discussionPanel.appendChild(discTitle);

  const discTopicLabel = DOM.create('label', {
    textContent: 'Discussion Topic:',
    style: { display: 'block', fontWeight: 'bold', marginTop: '6px' }
  });
  const discTopic = DOM.create('textarea', {
    placeholder: 'Enter discussion topic...',
    style: {
      width: '100%', height: '60px', padding: '8px', fontSize: '14px', border: '1px solid #ddd', borderRadius: '4px', resize: 'vertical'
    },
    'data-role': 'discussion-topic'
  });

  const discBodyLabel = DOM.create('label', {
    textContent: 'Response:',
    style: { display: 'block', fontWeight: 'bold', marginTop: '12px' }
  });
  const discBody = DOM.create('textarea', {
    placeholder: 'Write your discussion response...',
    style: {
      width: '100%', height: '180px', padding: '8px', fontSize: '14px', border: '1px solid #ddd', borderRadius: '4px', resize: 'vertical'
    },
    'data-role': 'discussion-body'
  });
  const discWordCount = DOM.create('div', {
    'data-role': 'discussion-body-wordcount',
    textContent: 'Words: 0',
    style: { textAlign: 'right', marginTop: '6px', color: '#666' }
  });

  const discResult = DOM.create('div', {
    id: 'final-writing-discussion',
    style: { marginTop: '14px', fontSize: '22px', fontWeight: 'bold', textAlign: 'center', color: '#333' }
  });

  const discSubmit = DOM.create('button', {
    textContent: '提交批改',
    style: {
      width: '100%', padding: '12px', backgroundColor: '#007A66', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', marginTop: '10px'
    }
  });

  discussionPanel.appendChild(discTopicLabel);
  discussionPanel.appendChild(discTopic);
  discussionPanel.appendChild(discBodyLabel);
  discussionPanel.appendChild(discBody);
  discussionPanel.appendChild(discWordCount);
  discussionPanel.appendChild(discSubmit);
  discussionPanel.appendChild(discResult);
  wrapper.appendChild(discussionPanel);

  app.appendChild(wrapper);

  // 事件：切换标签时清空状态
  tabEmail.addEventListener('click', () => switchToEmail(emailPanel, discussionPanel));
  tabDiscuss.addEventListener('click', () => switchToDiscussion(emailPanel, discussionPanel));
  // 初始激活 email 标签
  tabEmail.click();

  // 实时字数统计
  emailBody.addEventListener('input', () => {
    const words = countWordsEnglish(emailBody.value);
    emailWordCount.textContent = `Words: ${words}`;
  });
  discBody.addEventListener('input', () => {
    const words = countWordsEnglish(discBody.value);
    discWordCount.textContent = `Words: ${words}`;
  });

  // 提交 Email
  emailSubmit.addEventListener('click', async () => {
    const subject = emailSubject.value?.trim() ?? '';
    const body = emailBody.value?.trim() ?? '';
    if (!subject) { alert('请输入邮件主题'); return; }
    if (!body) { alert('请输入作文内容'); return; }
    // 两个子任务评分：W1 与 W2，均以相同文本触发，确保逻辑符合“两个子任务”的要求
    try {
      const r1 = await scoreWriteEmail(apiKey, subject, body);
      const r2 = await scoreWriteEmail(apiKey, subject, body);
      const total05 = (r1?.score05 ?? 0) + (r2?.score05 ?? 0);
      const { final30_writing, final6_writing } = convertTotal05_to_final30_final6_for_writing(total05);
      // 显示最终分数
      emailResult.textContent = `Final30_writing: ${final30_writing} | Final6_writing: ${final6_writing}`;
      // 隐藏输入区域以聚焦结果（可按需调整，这里保持简单）
      // 清空输入区以符合“切换 tab 时清空输入与结果”的要求仍然允许再次提交
    } catch (err) {
      alert('评分失败: ' + (err?.message || err));
    }
  });

  // 提交 Academic Discussion
  discSubmit.addEventListener('click', async () => {
    const topic = (discussionPanel.querySelector('[data-role="discussion-topic"]')?.value ?? '').trim();
    const body = (discussionPanel.querySelector('[data-role="discussion-body"]')?.value ?? '').trim();
    if (!topic) { alert('请输入讨论主题'); return; }
    if (!body) { alert('请输入讨论内容'); return; }
    try {
      const r1 = await scoreAcademicDiscussion(apiKey, topic, body);
      const r2 = await scoreAcademicDiscussion(apiKey, topic, body);
      const total05 = (r1?.score05 ?? 0) + (r2?.score05 ?? 0);
      const { final30_writing, final6_writing } = convertTotal05_to_final30_final6_for_writing(total05);
      discResult.textContent = `Final30_writing: ${final30_writing} | Final6_writing: ${final6_writing}`;
    } catch (err) {
      alert('评分失败: ' + (err?.message || err));
    }
  });
}

function switchToEmail(emailPanel, discussionPanel) {
  // 显示 Email 面板，隐藏 Discussion
  if (emailPanel) emailPanel.style.display = 'block';
  if (discussionPanel) discussionPanel.style.display = 'none';
  // 清空状态
  clearAllInputs();
}

function switchToDiscussion(emailPanel, discussionPanel) {
  // 显示 Discussion 面板，隐藏 Email
  if (discussionPanel) discussionPanel.style.display = 'block';
  if (emailPanel) emailPanel.style.display = 'none';
  // 清空状态
  clearAllInputs();
}

export default { initWritingModule };
