const BLANK_PATTERN = /_{2,}/g;
const CJK_PATTERN = /[\p{Script=Han}\u3000-\u303f\uff00-\uffef]/gu;

export function sentenceParts(prompt = '') {
  const parts = [];
  let cursor = 0;
  for (const match of String(prompt).matchAll(BLANK_PATTERN)) {
    if (match.index > cursor)
      parts.push({ type: 'text', value: prompt.slice(cursor, match.index) });
    parts.push({ type: 'blank', index: parts.filter(part => part.type === 'blank').length });
    cursor = match.index + match[0].length;
  }
  if (cursor < prompt.length) parts.push({ type: 'text', value: prompt.slice(cursor) });
  return parts;
}

export function renderSentence(prompt, values = []) {
  let index = 0;
  return String(prompt || '').replace(BLANK_PATTERN, () => values[index++] || '');
}

export function normalizeSentence(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLocaleLowerCase('en-US')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 常见缩写归一（"I'm"→"i am"、"don't"→"do not"…），使缩写与拆写视为等价。 */
const CONTRACTIONS = [
  [/\bi'm\b/g, 'i am'],
  [/\byou're\b/g, 'you are'],
  [/\bwe're\b/g, 'we are'],
  [/\bthey're\b/g, 'they are'],
  [/\bhe's\b/g, 'he is'],
  [/\bshe's\b/g, 'she is'],
  [/\bit's\b/g, 'it is'],
  [/\bthat's\b/g, 'that is'],
  [/\bthere's\b/g, 'there is'],
  [/\bwhat's\b/g, 'what is'],
  [/\bwho's\b/g, 'who is'],
  [/\blet's\b/g, 'let us'],
  [/\bcan't\b/g, 'can not'],
  [/\bcannot\b/g, 'can not'],
  [/\bwon't\b/g, 'will not'],
  [/\bdon't\b/g, 'do not'],
  [/\bdoesn't\b/g, 'does not'],
  [/\bdidn't\b/g, 'did not'],
  [/\bisn't\b/g, 'is not'],
  [/\baren't\b/g, 'are not'],
  [/\bwasn't\b/g, 'was not'],
  [/\bweren't\b/g, 'were not'],
  [/\bhaven't\b/g, 'have not'],
  [/\bhasn't\b/g, 'has not'],
  [/\bhadn't\b/g, 'had not'],
  [/\bwouldn't\b/g, 'would not'],
  [/\bshouldn't\b/g, 'should not'],
  [/\bcouldn't\b/g, 'could not'],
  [/\bi've\b/g, 'i have'],
  [/\bi'll\b/g, 'i will'],
  [/\bi'd\b/g, 'i would']
];

/**
 * 词级归一（build-sentence 判分用）：NFKC + 小写 + 缩写展开 + 剔除标点 + 折叠空白。
 * 目的：不因句末 `.` vs `?`、缩写写法、大小写差异而误判。
 */
export function normalizeWords(value) {
  let text = String(value || '')
    .normalize('NFKC')
    .toLocaleLowerCase('en-US');
  for (const [pattern, replacement] of CONTRACTIONS) text = text.replace(pattern, replacement);
  return text.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** 题干里的「非空位文字」部分（固定词，如 why / like that），用于从答案中剥离。 */
function promptLiteralParts(question) {
  return sentenceParts(question?.prompt || '')
    .filter(part => part.type === 'text')
    .map(part => String(part.value || '').trim())
    .filter(literal => /[a-z]/i.test(literal));
}

/** 答案剔除题干固定词后的「候选词序列」（词级归一）。 */
function answerCandidateWords(question) {
  let text = String(correctAnswerFor(question) ?? '');
  for (const literal of promptLiteralParts(question)) {
    const pattern = new RegExp(literal.split(/\s+/).map(escapeRegExp).join('\\s+'), 'gi');
    text = text.replace(pattern, ' ');
  }
  return normalizeWords(text);
}

/**
 * build-sentence 是否匹配（容忍标点/缩写/题干固定词）：
 *  ① 整句渲染 == 答案（正确撰写的内容）；
 *  ② 用户所选候选词序列 == 答案剔除题干固定词后的序列（容错"答案漏写字面词"等历史内容）。
 */
function buildSentenceMatches(question, chosenWords) {
  const expected = correctAnswerFor(question);
  if (expected == null) return false;
  const full = normalizeWords(renderSentence(question.prompt, chosenWords));
  if (full && full === normalizeWords(expected)) return true;
  const words = normalizeWords(chosenWords.join(' '));
  return Boolean(words) && words === answerCandidateWords(question);
}

/** 求解候选词的「正确排列」（返回每空位的候选下标）；无解返回全 null。 */
export function solveAnswerOrder(question) {
  const blankCount = sentenceParts(question?.prompt).filter(part => part.type === 'blank').length;
  const candidates = question?.candidates || [];
  if (!blankCount || correctAnswerFor(question) == null) return Array(blankCount).fill(null);
  const selected = Array(blankCount).fill(null);
  const used = new Set();
  function visit(slot) {
    if (slot === blankCount) {
      const words = selected.map(index => candidates[index] ?? '');
      return buildSentenceMatches(question, words);
    }
    for (let index = 0; index < candidates.length; index += 1) {
      if (used.has(index)) continue;
      selected[slot] = index;
      used.add(index);
      if (visit(slot + 1)) return true;
      used.delete(index);
    }
    selected[slot] = null;
    return false;
  }
  return visit(0) ? selected : Array(blankCount).fill(null);
}

/** 由题干 + 候选词推导「完整正确句子」（供展示/校验）；无解返回 null。 */
export function canonicalBuildSentence(question) {
  const order = solveAnswerOrder(question);
  if (!order.length || order.every(value => value == null)) return null;
  const candidates = question?.candidates || [];
  return renderSentence(question.prompt, order.map(index => candidates[index] ?? ''));
}

export function stripCjk(value) {
  return String(value || '').replace(CJK_PATTERN, '');
}

export function countWords(value) {
  const text = stripCjk(value).trim();
  return text ? text.split(/\s+/u).filter(Boolean).length : 0;
}

export function examQuestions(document) {
  if (Array.isArray(document?.questions)) return document.questions;
  const pageByQuestion = new Map(
    (document?.pages || []).flatMap(page =>
      (page.questionIds || []).map(questionId => [questionId, page.id])
    )
  );
  return (document?.modules || []).flatMap(module =>
    (module.tasks || []).flatMap(task =>
      (task.questions || []).map(question => ({
        ...question,
        moduleId: question.moduleId || module.id,
        taskId: question.taskId || task.id,
        pageId: question.pageId || pageByQuestion.get(question.id) || question.id
      }))
    )
  );
}

export function questionPageId(question) {
  return question.pageId || question.id;
}

export function isAnswered(answer) {
  return (
    answer !== undefined &&
    answer !== null &&
    answer !== '' &&
    (!Array.isArray(answer) || answer.length > 0)
  );
}

function comparable(value) {
  if (Array.isArray(value)) return value.map(comparable).sort();
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, comparable(item)])
    );
  }
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}

function correctAnswerFor(question) {
  return (
    question.correctAnswer ?? question.correctAnswers ?? question.answer ?? question.answers ?? null
  );
}

export function isCorrectAnswer(answer, question) {
  const expected = correctAnswerFor(question);
  if (!isAnswered(answer) || expected == null) return false;
  if (question?.type === 'build-sentence') {
    const slots = Array.isArray(answer) ? answer : answer?.slots;
    if (!Array.isArray(slots)) return false;
    const chosen = slots.map(index => question.candidates?.[index] || '');
    return buildSentenceMatches(question, chosen);
  }
  return JSON.stringify(comparable(answer)) === JSON.stringify(comparable(expected));
}
