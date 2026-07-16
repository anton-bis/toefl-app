// Reserved scoring extension. Rubrics below are product placeholders and must be
// validated against the applicable scoring guide before this service is enabled.

const API_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const DEFAULT_MODEL = 'meta/llama-3.1-405b-instruct';
const ALLOWED_ENDPOINTS = new Set([API_URL]);
const MAX_PROMPT_BYTES = 100 * 1024;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

// Concise, non-verbatim summaries of the 2025 ETS scoring guides. Keep these
// reserved rubrics aligned with the official guides before enabling AI scoring.
// Speaking: https://www.ets.org/content/dam/ets-org/pdfs/toefl/speaking-rubrics.pdf
// Writing: https://www.ets.org/content/dam/ets-org/pdfs/toefl/writing-rubrics.pdf
export const RUBRIC_LISTEN_REPEAT = `
Listen and Repeat — score guide summary
5: Repeats the full prompt accurately and is completely understandable.
4: Preserves the prompt's meaning with only small wording or grammar changes; speech remains clear.
3: Reproduces most of the sentence, but omissions or substitutions affect accuracy; some speech may require effort.
2: Omits or changes a substantial part of the prompt; the result is fragmentary and difficult to understand.
1: Produces only a few recognizable words or an attempt that is mostly unintelligible.
0: Gives no response, no English response, an unrelated response, or speech that cannot be understood.
Primary criteria: accuracy, completeness, and intelligibility.
`;

export const RUBRIC_TAKE_INTERVIEW = `
Take an Interview — score guide summary
5: Fully answers and develops the response with fluent, natural, readily intelligible speech and precise language.
4: Answers and develops the response clearly; minor pauses or language limitations do not impede meaning.
3: Addresses the question with limited development or clarity; delivery may be choppy and language control uneven.
2: Makes a relevant attempt but provides little support; limited language and intelligibility often obscure meaning.
1: Barely addresses the question through vague, isolated, or mostly unintelligible language.
0: Gives no response, no English response, an unrelated response, or speech that cannot be understood.
Primary criteria: relevance and development, fluency, intelligibility, grammar, and vocabulary.
`;

export const RUBRIC_WRITE_EMAIL = `
Write an Email — score guide summary
5: Clearly fulfills the purpose with strong development, precise language, suitable tone, and almost no errors.
4: Fulfills the purpose effectively with adequate development, appropriate language and conventions, and few errors.
3: Generally completes the task, though development, clarity, tone, or language control is inconsistent.
2: Attempts the task, but limited or irrelevant development and frequent language problems make the message ineffective.
1: Makes only a minimal, fragmented attempt with little original content and serious, frequent language problems.
0: Is blank, off topic, not in English, copied from the prompt, or otherwise unrelated to the task.
Primary criteria: communicative purpose, development, organization, tone, grammar, and vocabulary.
`;

export const RUBRIC_ACADEMIC_DISCUSSION = `
Write for an Academic Discussion — score guide summary
5: Makes a highly relevant, well-developed, and clear contribution with precise language and almost no errors.
4: Makes a relevant, adequately developed contribution that is easy to understand and contains few language errors.
3: Makes a mostly relevant contribution, but some support is unclear or missing and errors are noticeable.
2: Attempts to contribute, but weak or partly irrelevant ideas and accumulated errors hinder understanding.
1: Offers few coherent ideas, very limited original language, and serious, frequent errors.
0: Is blank, off topic, not in English, copied from the prompt, or otherwise unrelated to the discussion.
Primary criteria: relevance, development, clarity, syntactic range, vocabulary, and language accuracy.
`;

// Shared AI request helper for optional scoring extensions.
export async function callAI(apiKey, prompt, options = {}) {
  if (!apiKey || !prompt) throw new Error('An API key and prompt are required.');
  const {
    endpoint = API_URL,
    model = DEFAULT_MODEL,
    temperature = 0.7,
    maxTokens = 2048,
    signal: externalSignal
  } = options;
  if (!ALLOWED_ENDPOINTS.has(endpoint)) throw new Error('This AI endpoint is not allowed.');
  if (Buffer.byteLength(prompt, 'utf8') > MAX_PROMPT_BYTES) throw new Error('The prompt is too large.');
  if (!Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > 8192) {
    throw new Error('maxTokens must be an integer from 1 to 8192.');
  }
  if (!Number.isFinite(temperature) || temperature < 0 || temperature > 2) {
    throw new Error('temperature must be between 0 and 2.');
  }
  const timeoutSignal = AbortSignal.timeout(30_000);
  const signal = externalSignal
    ? AbortSignal.any([timeoutSignal, externalSignal])
    : timeoutSignal;
  const response = await fetch(endpoint, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature
    })
  });

  const body = await response.text();
  if (Buffer.byteLength(body, 'utf8') > MAX_RESPONSE_BYTES) {
    throw new Error('The AI response is too large.');
  }
  let json;
  try {
    json = JSON.parse(body);
  } catch {
    throw new Error(`The AI service returned invalid JSON (HTTP ${response.status}).`);
  }
  if (!response.ok) {
    const error = json || {};
    throw new Error(error.error?.message || error.message || `API error: ${response.status}`);
  }

  if (typeof json.choices?.[0]?.message?.content === 'string') {
    return json.choices[0].message.content;
  }
  throw new Error('The AI service returned an unexpected response.');
}

// Convert a 0–5 speaking score to the legacy 30-point and 6-point scales.
export function convertTotal05_to_final30_final6_for_speaking(total05_speaking) {
  const final30_speaking = Math.round(total05_speaking * 6);
  const final6_speaking = Math.round(total05_speaking * 1.2);
  return { final30_speaking, final6_speaking };
}

// Convert a 0–5 writing score to the legacy 30-point and 6-point scales.
export function convertTotal05_to_final30_final6_for_writing(total05_writing) {
  const final30_writing = Math.round(total05_writing * 6);
  const final6_writing = Math.round(total05_writing * 1.2);
  return { final30_writing, final6_writing };
}

// Listen and Repeat scoring extension
export async function scoreListenAndRepeat(_apiKey, _sentences = [], _userTranscripts = []) {
  throw new Error('AI scoring is not enabled.');
}

// Interview scoring extension
export async function scoreTakeInterview(_apiKey, _question, _userResponse, _responseTime) {
  throw new Error('AI scoring is not enabled.');
}

// Email scoring extension
export async function scoreWriteEmail(_apiKey, _emailPrompt, _userEssay) {
  throw new Error('AI scoring is not enabled.');
}

// Academic Discussion scoring extension
export async function scoreAcademicDiscussion(_apiKey, _discussionPrompt, _userEssay) {
  throw new Error('AI scoring is not enabled.');
}

export async function correctSpeaking(_apiKey, _response, _question, _time) {
  throw new Error('AI scoring is not enabled.');
}

/** Explain why an answer is correct. */
export async function explainQuestion(apiKey, question, userAnswer, correctAnswer) {
  const prompt = `You are an experienced TOEFL reading instructor. Explain how to solve this question.
 
Question:
${question}
 
Student answer:
${userAnswer}
 
Correct answer:
${correctAnswer}
 
In no more than 80 words, explain in clear, concise English why ${correctAnswer} is correct and identify the key clue.`;

  return callAI(apiKey, prompt, { maxTokens: 500 });
}

/**
 * Explain a mistake and how to avoid it.
 */
export async function explainMistake(apiKey, question, userAnswer, correctAnswer) {
  const prompt = `You are a patient TOEFL instructor. Explain the mistake and how to avoid it next time.
 
Question:
${question}
 
Student answer:
${userAnswer}
 
Correct answer:
${correctAnswer}
 
In no more than 120 words, respond in natural English with the source of the error and a better reasoning approach.`;

  return callAI(apiKey, prompt, { maxTokens: 600 });
}

export default {
  callAI,
  scoreListenAndRepeat,
  scoreTakeInterview,
  scoreWriteEmail,
  scoreAcademicDiscussion,
  correctSpeaking,
  explainQuestion,
  explainMistake
};
