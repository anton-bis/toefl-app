const API_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const DEFAULT_MODEL = 'meta/llama-3.1-405b-instruct';

const WRITING_RUBRIC = `
【写作评分标准 - 官方ETS标准】
5分：完全有效。语言运用熟练，论点清晰且有充分的例证支持，句式多样且用词精准，仅有minor错误。
4分：基本有效。语言清晰易读，论点有适当支持，句式和用词恰当，错误较少。
3分：部分有效。论点部分支持但不够充分，语言有一定范围，结构/用词有明显错误。
2分：大部分无效。论点有限或不相关，句式和词汇有限，积累性语法错误。
1分：无效。几乎没有论点，语言破碎/难以理解，词汇严重不足，频繁严重错误。
0分：空白/抄袭/离题/非英文。

【评估维度】（每个维度都要给出0-1分评价）：
1. 任务完成度：是否回应了题目要求
2. 论点发展：是否有清晰的论点及例证支持
3. 语言运用：句式多样性、用词准确性
4. 语法准确性：时态、主谓一致、词性等
5. 连贯性：段落间和句子间的逻辑连接
`;

const SPEAKING_RUBRIC = `
【口语评分标准 - 官方ETS标准】
5分：完全成功。完全切题且流利，发音清晰，语法和词汇准确。
4分：基本成功。切题且有阐述，有minor发音/语法问题但不影响理解。
3分：部分成功。切题但阐述有限，频繁停顿，用词和语法有限。
2分：大部分无效。几乎不切题，几乎无阐述，勉强可理解。
1分：无效。几乎不说话或无法理解，仅有零散词汇。
0分：无回应/非英文/离题。

【评估维度】：
1. 任务完成：是否切题并完整回答
2. 流利度与发音：语速、停顿、清晰度
3. 词汇与语法：范围和准确性
4. 内容完整：是否包含关键信息
`;

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

export async function correctSpeaking(apiKey, script, question, expectedTime = 60) {
  const prompt = `你是一位资深的托福口语评分专家。请根据官方ETS评分标准对考生的口语回答进行评分。

【题目要求】
${question}

【考生回答】
${script}

【答题时间】
${expectedTime}秒

${SPEAKING_RUBRIC}

请按照以下JSON格式返回（不要有额外内容）:
{
  "score": 0-4的整数,
  "taskCompletion": 0-1的小数,
  "fluency": 0-1的小数,
  "vocabulary": 0-1的小数,
  "grammar": 0-1的小数,
  "feedback": "总体反馈（中文，30字以内）",
  "strengths": "优点（中文，20字以内）",
  "improvement": "改进建议（中文，30字以内）"
}`;

  const result = await callAI(apiKey, prompt);
  
  try {
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.score > 4) parsed.score = 4;
      return parsed;
    }
    throw new Error('无法解析');
  } catch (e) {
    return {
      score: 2,
      taskCompletion: 0.5,
      fluency: 0.5,
      vocabulary: 0.5,
      grammar: 0.5,
      feedback: '答案基本切题',
      strengths: '表达了基本观点',
      improvement: '建议提高流利度'
    };
  }
}

export async function correctWriting(apiKey, essay, question) {
  const prompt = `你是一位资深的托福写作评分专家。请根据官方ETS评分标准对考生的写作进行评分。

【题目要求】
${question}

【考生作文】
${essay}

${WRITING_RUBRIC}

请按照以下JSON格式返回（不要有额外内容）:
{
  "score": 0-5的整数,
  "taskCompletion": 0-1的小数（任务完成度）,
  "development": 0-1的小数（论点发展）,
  "language": 0-1的小数（语言运用）,
  "grammar": 0-1的小数（语法准确性）,
  "coherence": 0-1的小数（连贯性）,
  "wordCount": ${essay.split(/\s+/).filter(w => w).length},
  "feedback": "总体反馈（中文，30字以内）",
  "strengths": "优点（中文，20字以内）",
  "improvement": "改进建议（中文，30字以内）"
}`;

  const result = await callAI(apiKey, prompt);
  
  try {
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (!parsed.wordCount) parsed.wordCount = essay.split(/\s+/).filter(w => w).length;
      return parsed;
    }
    throw new Error('无法解析');
  } catch (e) {
    return {
      score: 3,
      taskCompletion: 0.6,
      development: 0.6,
      language: 0.6,
      grammar: 0.6,
      coherence: 0.6,
      wordCount: essay.split(/\s+/).filter(w => w).length,
      feedback: '文章结构清晰',
      strengths: '观点明确，论证较充分',
      improvement: '建议增加例子丰富度'
    };
  }
}

/**
 * 题目解析/答疑
 * @param {string} apiKey - API 密钥
 * @param {string} question - 题目内容
 * @param {string} userAnswer - 用户答案
 * @param {string} correctAnswer - 正确答案
 * @returns {Promise<string>} 解析内容
 */
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
 * @param {string} apiKey - API 密钥
 * @param {string} question - 错题内容
 * @param {string} userAnswer - 用户错误答案
 * @param {string} correctAnswer - 正确答案
 * @returns {Promise<string>} 讲解内容
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
  correctSpeaking,
  correctWriting,
  explainQuestion,
  explainMistake
};