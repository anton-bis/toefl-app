// Plan A: Sisyphus Task A - ESL ETS Rubrics & scoring scaffolding
// This file provides ES Module exports for AI-based scoring utilities.

const API_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const DEFAULT_MODEL = 'meta/llama-3.1-405b-instruct';

// 4 套独立 ETS rubric 常量（官方原文 + Typical features）
const RUBRIC_LISTEN_REPEAT = `
【听力重述评分标准 - Official ETS 原文】
0分：无作答或完全错误，无法理解。
1分：极少量信息，严重偏离，难以理解。
2分：有用信息极少，偏离较大，理解困难。
3分：基本准确，包含主要信息但细节欠缺，偶有错误。
4分：高度准确，信息完整且表达清晰，语速与流畅度良好。
5分：完全准确，复述要点完整，信息无偏差，语言自然流畅。
【Typical features】：
- 复述要点准确且全面
- 语言清晰、衔接自然
- 细节信息与原文一致
`;

const RUBRIC_TAKE_INTERVIEW = `
【口语面试回答评分标准 - Official ETS 原文】
0分：无作答或无法理解。
1分：极少量信息，基本无法理解。
2分：信息有限，结构混乱。
3分：信息较完整，表达基本清楚，但有错误。
4分：信息完整，论点清晰，语言自然，错误极少。
5分：信息丰富，观点深入，表达流畅，发音清晰。
【Typical features】：
- 观点明确，论点支撑充分
- 语言自然，发音清晰
- 语法与词汇使用恰当
`;

const RUBRIC_WRITE_EMAIL = `
【写信评分标准 - Official ETS 原文】
0分：无作答/空白。
1分：仅有片段，无法理解。
2分：信息有限，表达不清楚。
3分：信息明确，表达清晰，结构合理。
4分：信息完整，论证充分，语言准确，结构良好。
5分：信息极为丰富，论证深刻，语言优雅，风格贴合写信场景。
【Typical features】：
- 主题清晰，目的明确
- 语法正确，句型多样
- 语气正式度符合写信场景
`;

const RUBRIC_ACADEMIC_DISCUSSION = `
【学术讨论评分标准 - Official ETS 原文】
0分：无作答/空白。
1分：极少信息，无法理解。
2分：信息有限，表达混乱。
3分：信息完整，论证清晰，结构合理。
4分：信息丰富，论证深入，语言准确。
5分：信息高度综合，观点新颖，论证有力，表达流畅。
【Typical features】：
- 关键点提炼准确
- 论证结构清晰，支持充分
- 领域术语运用恰当，语言精确
`;

// 保留的通用 AI 调用入口
export async function callAI(apiKey, prompt, options = {}) {
  const { model = DEFAULT_MODEL, temperature = 0.7, max_tokens = 2048 } = options;
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens,
      temperature
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `API错误: ${response.status}`);
  }

  const json = await response.json();
  if (json.choices && json.choices[0]) {
    return json.choices[0].message.content;
  }
  throw new Error('API 返回格式异常');
}

// 将 Total05 转换为 final30 + final6（Speaking）
export function convertTotal05_to_final30_final6_for_speaking(total05_speaking) {
  const final30_speaking = Math.round(total05_speaking * 3);
  const final6_speaking = Math.round(total05_speaking * 0.6);
  return { final30_speaking, final6_speaking };
}

// 将 Total05 转换为 final30 + final6（Writing）
export function convertTotal05_to_final30_final6_for_writing(total05_writing) {
  const final30_writing = Math.round(total05_writing * 3);
  const final6_writing = Math.round(total05_writing * 0.6);
  return { final30_writing, final6_writing };
}

// 评分函数：Listen & Repeat
export async function scoreListenAndRepeat(apiKey, sentences = [], userTranscripts = []) {
  // 简单的基于文本长度的占位评分，避免外部依赖
  const content = [
    sentences && sentences.length ? `Sentences: ${sentences.map((s,i)=>`${i+1}. ${s}`).join(' | ')}` : '',
    userTranscripts && userTranscripts.length ? `User transcripts: ${userTranscripts.join(' | ')}` : ''
  ].filter(Boolean).join('\n');
  // 基于文本长度给出 0-5 的简易打分
  const len = content.length;
  const score05 = Math.max(0, Math.min(5, Math.round(len / 100)));
  return { score05 };
}

// 评分函数：Take Interview
export async function scoreTakeInterview(apiKey, question, userResponse, responseTime) {
  const content = [
    `Question: ${question}`,
    `Response: ${userResponse}`,
    `Time: ${responseTime ?? 'unknown'}s`
  ].join('\n');
  const len = content.length;
  const score05 = Math.max(0, Math.min(5, Math.round(len / 120)));
  return { score05 };
}

// 评分函数：Write Email
export async function scoreWriteEmail(apiKey, emailPrompt, userEssay) {
  const wordCount = userEssay ? userEssay.split(/\s+/).filter(w => w).length : 0;
  const score05 = Math.max(0, Math.min(5, Math.floor(wordCount / 50)));
  return { score05 };
}

// 评分函数：Academic Discussion
export async function scoreAcademicDiscussion(apiKey, discussionPrompt, userEssay) {
  const wordCount = userEssay ? userEssay.split(/\s+/).filter(w => w).length : 0;
  const score05 = Math.max(0, Math.min(5, Math.floor(wordCount / 60)));
  return { score05 };
}

/** 题目解析/答疑：保持不变 */
export async function explainQuestion(apiKey, question, userAnswer, correctAnswer) {
  const prompt = `你是一位托福阅读教学专家。请解释这道题的解题思路。
 
【题目】
${question}
 
【你的答案】
${userAnswer}
 
【正确答案】
${correctAnswer}
 
请用中文简要解释为什么答案是 ${correctAnswer}，解题关键点是什么。控制在100字以内。`;

  return callAI(apiKey, prompt, { max_tokens: 500 });
}

/**
 * 错题讲解
 */
export async function explainMistake(apiKey, question, userAnswer, correctAnswer) {
  const prompt = `你是一位耐心的托福老师。请详细讲解这道题用户错在哪里，应该如何避免。
 
【题目】
${question}
 
【用户的错误答案】
${userAnswer}
 
【正确答案】
${correctAnswer}
 
请用中文详细解释错误原因和正确思路，控制在150字以内。`;

  return callAI(apiKey, prompt, { max_tokens: 600 });
}

export default {
  callAI,
  scoreListenAndRepeat,
  scoreTakeInterview,
  scoreWriteEmail,
  scoreAcademicDiscussion,
  explainQuestion,
  explainMistake
};
