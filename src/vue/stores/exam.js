import { defineStore } from 'pinia';
import { recordingRepository } from '../platform/dataRepository.js';
import {
  cancelLocalWrite,
  flushLocalWrites,
  isPlainObject,
  removeLocalValue,
  scheduleLocalJson,
  writeLocalJson
} from '../platform/localPersistence.js';

const EXAM_STORAGE_PREFIX = 'toefl:exam';

const hasStorage = () => typeof localStorage !== 'undefined';
const asId = value =>
  String(value ?? '')
    .trim()
    .toLowerCase();
function boundedData(value) {
  let nodes = 0;
  const visit = (item, depth) => {
    if (depth > 10 || ++nodes > 50_000) return false;
    if (typeof item === 'string') return item.length <= 500_000;
    if (Array.isArray(item))
      return item.length <= 10_000 && item.every(child => visit(child, depth + 1));
    if (isPlainObject(item)) {
      const entries = Object.entries(item);
      return entries.length <= 10_000 && entries.every(([, child]) => visit(child, depth + 1));
    }
    return item == null || ['boolean', 'number'].includes(typeof item);
  };
  return visit(value, 0);
}

export function examSessionId(tpoId, section) {
  return `${asId(tpoId)}:${asId(section)}`;
}

export function examStorageKey(tpoId, section) {
  return `${EXAM_STORAGE_PREFIX}:${encodeURIComponent(asId(tpoId))}:${encodeURIComponent(asId(section))}`;
}

export function createExamSession({
  tpoId,
  section,
  pageId = 'start',
  durationSeconds = null,
  now = Date.now()
}) {
  const finiteDuration = Number.isFinite(durationSeconds) && durationSeconds >= 0;
  return {
    tpoId: asId(tpoId),
    section: asId(section),
    pageId: String(pageId || 'start'),
    answers: {},
    marks: {},
    check: { revealed: false, revealedScopes: {}, checkedAt: null },
    lockedQuestionIds: {},
    timer: {
      mode: finiteDuration ? 'countdown' : 'unlimited',
      durationSeconds: finiteDuration ? Math.floor(durationSeconds) : null,
      startedAt: null,
      deadlineAt: null,
      hidden: false,
      expiredAt: null,
      scopeType: null,
      scopeId: null
    },
    status: 'not-started',
    startedAt: null,
    completedAt: null,
    updatedAt: now
  };
}

function normalizeSession(value, expected) {
  if (!isPlainObject(value) || !boundedData(value)) return null;
  if (
    asId(value.tpoId) !== asId(expected.tpoId) ||
    asId(value.section) !== asId(expected.section)
  ) {
    return null;
  }
  const fresh = createExamSession(expected);
  return {
    ...fresh,
    ...value,
    tpoId: fresh.tpoId,
    section: fresh.section,
    pageId: typeof value.pageId === 'string' && value.pageId.length <= 200 ? value.pageId : 'start',
    status: ['not-started', 'in-progress', 'completed'].includes(value.status)
      ? value.status
      : 'not-started',
    answers: isPlainObject(value.answers) ? value.answers : {},
    marks: isPlainObject(value.marks) ? value.marks : {},
    check: {
      revealed: Boolean(value.check?.revealed),
      revealedScopes: isPlainObject(value.check?.revealedScopes) ? value.check.revealedScopes : {},
      checkedAt: Number.isFinite(value.check?.checkedAt) ? value.check.checkedAt : null
    },
    timer: { ...fresh.timer, ...(isPlainObject(value.timer) ? value.timer : {}) },
    lockedQuestionIds: isPlainObject(value.lockedQuestionIds) ? value.lockedQuestionIds : {}
  };
}

export function readExamSession(tpoId, section) {
  if (!hasStorage()) return null;
  const options = { tpoId, section };
  try {
    const serialized = localStorage.getItem(examStorageKey(options.tpoId, options.section));
    if (!serialized || serialized.length > 2_000_000) return null;
    const value = JSON.parse(serialized);
    return normalizeSession(value, options);
  } catch {
    return null;
  }
}

export function removeExamSession(tpoId, section) {
  removeLocalValue(examStorageKey(tpoId, section));
}

function compactSession(session) {
  const compact = {
    tpoId: session.tpoId,
    section: session.section,
    pageId: session.pageId,
    status: session.status,
    updatedAt: session.updatedAt
  };
  if (Object.keys(session.answers).length) compact.answers = session.answers;
  if (Object.keys(session.marks).length) compact.marks = session.marks;
  if (Object.keys(session.lockedQuestionIds).length)
    compact.lockedQuestionIds = session.lockedQuestionIds;
  if (
    session.check.revealed ||
    session.check.checkedAt != null ||
    Object.keys(session.check.revealedScopes).length
  ) {
    compact.check = session.check;
  }
  if (session.status !== 'not-started') {
    compact.startedAt = session.startedAt;
    compact.completedAt = session.completedAt;
    compact.timer = session.timer;
  }
  return compact;
}

function persistSession(session, delayed = false) {
  if (!session || !hasStorage()) return;
  const key = examStorageKey(session.tpoId, session.section);
  if (session.status === 'not-started') {
    removeLocalValue(key);
    return;
  }
  const snapshot = compactSession(session);
  if (delayed) scheduleLocalJson(key, snapshot, 300);
  else writeLocalJson(key, snapshot);
}

export async function pruneCompletedExamHistory(
  storage = globalThis.localStorage,
  repository,
  limit = 20
) {
  if (!storage || !Number.isFinite(storage.length)) return [];
  const completed = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key?.startsWith(`${EXAM_STORAGE_PREFIX}:`)) continue;
    try {
      const session = JSON.parse(storage.getItem(key));
      if (session?.status === 'completed' && session.tpoId) {
        completed.push({ key, session, time: session.completedAt || session.updatedAt || 0 });
      }
    } catch {
      // Invalid records are ignored here and rejected by readExamSession.
    }
  }
  const latestByTpo = new Map();
  completed.forEach(({ session, time }) => {
    latestByTpo.set(session.tpoId, Math.max(latestByTpo.get(session.tpoId) || 0, time));
  });
  const expired = new Set(
    [...latestByTpo.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(Math.max(0, limit))
      .map(([tpoId]) => tpoId)
  );
  const removed = completed.filter(({ session }) => expired.has(session.tpoId));
  if (repository) {
    await Promise.all(
      removed
        .filter(({ session }) => session.section === 'speaking')
        .map(({ session }) => repository.removeSession(`tpo-${session.tpoId}-speaking`))
    );
  }
  removed.forEach(({ key }) => {
    cancelLocalWrite(key);
    storage.removeItem(key);
  });
  return [...expired];
}

export const useExamStore = defineStore('exam', {
  state: () => ({
    activeId: '',
    sessions: {}
  }),
  getters: {
    activeSession: state => state.sessions[state.activeId] || null,
    session: state => (tpoId, section) => state.sessions[examSessionId(tpoId, section)] || null,
    answer: state => questionId => state.sessions[state.activeId]?.answers[String(questionId)],
    isMarked: state => questionId =>
      Boolean(state.sessions[state.activeId]?.marks[String(questionId)])
  },
  actions: {
    openSession(options) {
      this.flushPersist();
      const id = examSessionId(options.tpoId, options.section);
      let session = options.restart
        ? null
        : this.sessions[id] || readExamSession(options.tpoId, options.section);
      if (!session) session = createExamSession(options);
      this.sessions[id] = session;
      this.activeId = id;
      return session;
    },
    start({ durationSeconds, pageId, scopeType = null, scopeId = null, now = Date.now() } = {}) {
      const session = this.requireActive();
      const duration = durationSeconds ?? session.timer.durationSeconds;
      const finiteDuration = Number.isFinite(duration) && duration >= 0;
      session.status = 'in-progress';
      session.startedAt ||= now;
      if (pageId) session.pageId = String(pageId);
      session.timer.mode = finiteDuration ? 'countdown' : 'unlimited';
      session.timer.durationSeconds = finiteDuration ? Math.floor(duration) : null;
      session.timer.startedAt = now;
      session.timer.deadlineAt = finiteDuration ? now + Math.floor(duration) * 1000 : null;
      session.timer.expiredAt = null;
      session.timer.scopeType = scopeType;
      session.timer.scopeId = scopeId;
      this.touch(now);
    },
    setPage(pageId) {
      this.requireActive().pageId = String(pageId);
      this.touch();
    },
    saveAnswer(questionId, answer) {
      const session = this.requireActive();
      if (session.status === 'completed' || session.lockedQuestionIds[String(questionId)]) return;
      const answers = session.answers;
      const id = String(questionId);
      if (answer === undefined || answer === null || answer === '') delete answers[id];
      else answers[id] = answer;
      session.updatedAt = Date.now();
      this.schedulePersist();
    },
    toggleMark(questionId, force) {
      const marks = this.requireActive().marks;
      const id = String(questionId);
      const marked = force ?? !marks[id];
      if (marked) marks[id] = true;
      else delete marks[id];
      this.touch();
      return marked;
    },
    setAllMarks(questionIds, marked) {
      const session = this.requireActive();
      for (const questionId of questionIds) {
        if (marked) session.marks[String(questionId)] = true;
        else delete session.marks[String(questionId)];
      }
      this.touch();
    },
    setCheck({ revealed, checkedAt } = {}) {
      const check = this.requireActive().check;
      if (revealed !== undefined) check.revealed = Boolean(revealed);
      if (checkedAt !== undefined) check.checkedAt = Number.isFinite(checkedAt) ? checkedAt : null;
      this.touch();
    },
    revealScope(scopeId, revealed = true) {
      const check = this.requireActive().check;
      if (revealed) check.revealedScopes[String(scopeId)] = true;
      else delete check.revealedScopes[String(scopeId)];
      check.revealed = Object.keys(check.revealedScopes).length > 0;
      check.checkedAt = revealed ? Date.now() : null;
      this.touch();
    },
    lockQuestions(questionIds) {
      const session = this.requireActive();
      for (const questionId of questionIds) session.lockedQuestionIds[String(questionId)] = true;
      this.touch();
    },
    setTimerHidden(hidden) {
      this.requireActive().timer.hidden = Boolean(hidden);
      this.touch();
    },
    continueUnlimited() {
      const session = this.requireActive();
      session.timer.mode = 'unlimited';
      session.timer.durationSeconds = null;
      session.timer.startedAt = null;
      session.timer.deadlineAt = null;
      session.timer.expiredAt = null;
      session.timer.scopeType = null;
      session.timer.scopeId = null;
      this.touch();
    },
    clearAnswers(questionIds, scopeId = null) {
      const session = this.requireActive();
      for (const questionId of questionIds) {
        delete session.answers[String(questionId)];
        delete session.lockedQuestionIds[String(questionId)];
      }
      if (scopeId) delete session.check.revealedScopes[String(scopeId)];
      else session.check.revealedScopes = {};
      session.check.revealed = Object.keys(session.check.revealedScopes).length > 0;
      session.check.checkedAt = null;
      this.touch();
    },
    expire(now = Date.now()) {
      const session = this.requireActive();
      if (!session.timer.expiredAt) {
        session.timer.expiredAt = now;
        this.touch(now);
      }
    },
    complete(now = Date.now()) {
      const session = this.requireActive();
      session.status = 'completed';
      session.completedAt = now;
      session.timer.mode = 'unlimited';
      session.timer.deadlineAt = null;
      session.timer.expiredAt = null;
      session.timer.scopeType = null;
      session.timer.scopeId = null;
      this.touch(now);
      pruneCompletedExamHistory(globalThis.localStorage, recordingRepository).catch(() => {});
    },
    reset(tpoId, section, options = {}) {
      const id = examSessionId(tpoId, section);
      const session = createExamSession({ tpoId, section, ...options });
      this.sessions[id] = session;
      this.activeId = id;
      removeExamSession(tpoId, section);
      return session;
    },
    remove(tpoId, section) {
      const id = examSessionId(tpoId, section);
      delete this.sessions[id];
      if (this.activeId === id) this.activeId = '';
      removeExamSession(tpoId, section);
    },
    requireActive() {
      const session = this.activeSession;
      if (!session) throw new Error('No active exam session');
      return session;
    },
    touch(now = Date.now()) {
      this.requireActive().updatedAt = now;
      this.persist();
    },
    schedulePersist() {
      const session = this.requireActive();
      persistSession(session, true);
    },
    flushPersist() {
      flushLocalWrites();
    },
    persist() {
      const session = this.activeSession;
      if (!session) return;
      persistSession(session);
    }
  }
});
