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

export function solveAnswerOrder(question) {
  const blankCount = sentenceParts(question?.prompt).filter(part => part.type === 'blank').length;
  const candidates = question?.candidates || [];
  const target = normalizeSentence(question?.answer);
  if (!blankCount || !target) return Array(blankCount).fill(null);
  const selected = Array(blankCount).fill(null);
  const used = new Set();
  function visit(slot) {
    if (slot === blankCount)
      return normalizeSentence(renderSentence(question.prompt, selected)) === target;
    for (let index = 0; index < candidates.length; index += 1) {
      if (used.has(index)) continue;
      selected[slot] = candidates[index];
      used.add(index);
      if (visit(slot + 1)) return true;
      used.delete(index);
    }
    selected[slot] = null;
    return false;
  }
  return visit(0) ? selected : Array(blankCount).fill(null);
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
    return (
      normalizeSentence(renderSentence(question.prompt, chosen)) === normalizeSentence(expected)
    );
  }
  return JSON.stringify(comparable(answer)) === JSON.stringify(comparable(expected));
}
