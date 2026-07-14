import { normalizeSentence, renderSentence } from '../sections/writing/writingLogic.js';

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

export function correctAnswerFor(question) {
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
