import { listeningResponseSeconds } from '../sections/listening/helpers.js';

const REPORT_SECTION_ORDER = ['reading', 'listening', 'writing', 'speaking'];

/**
 * Reading seconds per question type. Academic passages and complete-words get
 * their own allowances; every other reading task type (text-chain and all
 * daily-life subtypes) plus unknown types fall back to 30 seconds.
 */
export function readingSecondsPerType(type) {
  if (type === 'complete-words') return 24;
  if (type === 'academic-passage') return 60;
  return 30;
}

export function readingModuleSeconds(questions) {
  return (questions || []).reduce((sum, question) => sum + readingSecondsPerType(question.type), 0);
}

export function pageDuration(section, page, task, moduleQuestions = []) {
  if (section === 'reading') return readingModuleSeconds(moduleQuestions) || null;
  if (section === 'writing') {
    return (
      {
        'build-sentence': 347,
        'write-email': 420,
        'academic-discussion': 600
      }[page.taskId] ?? null
    );
  }
  if (section === 'listening' && page.type === 'question') {
    return listeningResponseSeconds(task);
  }
  return null;
}

export function blocksListeningHistory(section, pages, targetPage, session) {
  if (section !== 'listening' || session?.status !== 'in-progress' || !targetPage) return false;
  const currentIndex = pages.findIndex(item => item.id === session.pageId);
  const targetIndex = pages.findIndex(item => item.id === targetPage.id);
  return currentIndex >= 0 && targetIndex >= 0 && targetIndex < currentIndex;
}

export function resolveExamEntry({ pages, requestedPageId, session, section, report, restart }) {
  const requested = pages.find(item => item.id === requestedPageId);
  const resultRedirect = redirectFromResults(pages, requested, session);
  if (resultRedirect) return resultRedirect;
  if (report && session.status !== 'completed') return { action: 'home' };
  if (!requested) return { action: 'redirect', pageId: 'start' };
  if (restart) return { action: 'restart', pageId: 'start' };
  if (session.status === 'completed' && requested.type !== 'results') {
    return { action: 'redirect', pageId: 'results' };
  }
  if (blocksListeningHistory(section, pages, requested, session)) {
    return { action: 'redirect', pageId: session.pageId };
  }
  const statusRedirect = redirectFromStatus(requestedPageId, requested, session);
  if (statusRedirect) return statusRedirect;
  return { action: 'enter', page: requested };
}

function redirectFromResults(pages, requested, session) {
  if (requested?.type !== 'results' || session.status === 'completed') return null;
  const saved = pages.find(item => item.id === session.pageId);
  const resumable = session.status === 'in-progress' && saved && saved.type !== 'results';
  return { action: 'redirect', pageId: resumable ? saved.id : 'start' };
}

function redirectFromStatus(requestedPageId, requested, session) {
  const resume =
    requestedPageId === 'start' && session.status === 'in-progress' && session.pageId !== 'start';
  if (resume) return { action: 'redirect', pageId: session.pageId };
  if (session.status === 'not-started' && requested.type !== 'start') {
    return { action: 'redirect', pageId: 'start' };
  }
  return null;
}

export function reportSections(test, completedSession) {
  return REPORT_SECTION_ORDER.filter(
    section => test?.sections[section] && completedSession(section)?.status === 'completed'
  );
}

export function questionDisplay({ section, page, task, moduleQuestions, questions }) {
  const pageQuestionId = page?.questionIds?.[0];
  const collection = ['reading', 'listening'].includes(section) ? moduleQuestions : questions;
  const index = collection.findIndex(item => item.id === pageQuestionId);
  const number = index < 0 ? 0 : index + 1;
  const total = questionTotal(section, task, moduleQuestions, questions);
  const label = questionLabel(section, page, task, moduleQuestions, number, total);
  return { number, total, label };
}

function questionTotal(section, task, moduleQuestions, questions) {
  if (['reading', 'listening'].includes(section)) return moduleQuestions.length;
  if (section !== 'writing') return questions.length;
  return task?.type === 'build-sentence' ? task.questions.length : 2;
}

function questionLabel(section, page, task, moduleQuestions, number, total) {
  if (page?.type !== 'question') return '';
  if (section === 'reading' && task?.type === 'complete-words') {
    const indexes = page.questionIds
      .map(id => moduleQuestions.findIndex(item => item.id === id) + 1)
      .filter(Boolean);
    const label = indexes.length
      ? `Question ${Math.min(...indexes)}–${Math.max(...indexes)} of ${moduleQuestions.length}`
      : '';
    return label;
  }
  if (section === 'writing' && task?.type !== 'build-sentence') {
    return `Question ${task?.type === 'write-email' ? 1 : 2} of 2`;
  }
  return number ? `Question ${number} of ${total}` : '';
}
