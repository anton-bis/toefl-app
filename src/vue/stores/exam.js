import { defineStore } from 'pinia';
import { createClientAttemptId } from '../../../electron/services/attempt-id.js';
import {
  cancelLocalWrite,
  flushLocalWrites,
  isPlainObject,
  readLocalJson,
  removeLocalValue,
  scheduleLocalJson,
  trackDesktopWrite,
  writeLocalJson
} from '../platform/localPersistence.js';

const EXAM_STORAGE_PREFIX = 'toefl:exam';

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

function examSessionId(tpoId, section) {
  return `${asId(tpoId)}:${asId(section)}`;
}

export function examStorageKey(tpoId, section) {
  return `${EXAM_STORAGE_PREFIX}:${encodeURIComponent(asId(tpoId))}:${encodeURIComponent(asId(section))}`;
}

function createExamSession({
  tpoId,
  section,
  pageId = 'start',
  durationSeconds = null,
  now = Date.now(),
  content = {}
}) {
  const finiteDuration = Number.isFinite(durationSeconds) && durationSeconds >= 0;
  return {
    tpoId: asId(tpoId),
    section: asId(section),
    pageId: String(pageId || 'start'),
    clientAttemptId: createClientAttemptId(now),
    documentKey: String(content.documentKey || `tpo-${asId(tpoId)}-${asId(section)}`),
    documentHash: String(content.documentHash || ''),
    contentManifestId: String(content.contentManifestId || ''),
    contentSchemaVersion:
      Number.isInteger(content.contentSchemaVersion) ? content.contentSchemaVersion : null,
    contentVersionInferred: content.contentVersionInferred
      ? 1
      : content.documentHash
        ? 0
        : 1,
    answers: {},
    marks: {},
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
    createdAt: now,
    updatedAt: now
  };
}

function matchesSession(value, expected) {
  return (
    asId(value.tpoId) === asId(expected.tpoId) && asId(value.section) === asId(expected.section)
  );
}

function plainObject(value) {
  return isPlainObject(value) ? value : {};
}

function contentVersionFields(value, fallback = {}) {
  return {
    clientAttemptId: String(
      value.clientAttemptId || fallback.clientAttemptId || createClientAttemptId()
    ),
    documentKey: String(value.documentKey || fallback.documentKey || ''),
    documentHash: String(value.documentHash || fallback.documentHash || ''),
    contentManifestId: String(value.contentManifestId || fallback.contentManifestId || ''),
    contentSchemaVersion: Number.isInteger(value.contentSchemaVersion)
      ? value.contentSchemaVersion
      : Number.isInteger(fallback.contentSchemaVersion)
        ? fallback.contentSchemaVersion
        : null,
    contentVersionInferred: value.contentVersionInferred ? 1 : value.documentHash ? 0 : 1
  };
}

function normalizeSession(value, expected) {
  if (!isPlainObject(value)) return null;
  if (!boundedData(value)) return null;
  if (!matchesSession(value, expected)) return null;
  const fresh = createExamSession(expected);
  return {
    ...fresh,
    ...value,
    tpoId: fresh.tpoId,
    section: fresh.section,
    ...contentVersionFields(value, fresh),
    pageId: typeof value.pageId === 'string' && value.pageId.length <= 200 ? value.pageId : 'start',
    status: ['not-started', 'in-progress', 'completed'].includes(value.status)
      ? value.status
      : 'not-started',
    answers: plainObject(value.answers),
    marks: plainObject(value.marks),
    timer: { ...fresh.timer, ...plainObject(value.timer) },
    lockedQuestionIds: plainObject(value.lockedQuestionIds),
    createdAt: Number.isFinite(value.createdAt) ? value.createdAt : fresh.createdAt
  };
}

export function readExamSession(tpoId, section) {
  const options = { tpoId, section };
  const value = readLocalJson(examStorageKey(options.tpoId, options.section), null);
  return value ? normalizeSession(value, options) : null;
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
    updatedAt: session.updatedAt,
    ...contentVersionFields(session)
  };
  if (Object.keys(session.answers).length) compact.answers = session.answers;
  if (Object.keys(session.marks).length) compact.marks = session.marks;
  if (Object.keys(session.lockedQuestionIds).length)
    compact.lockedQuestionIds = session.lockedQuestionIds;
  if (session.status !== 'not-started') {
    compact.startedAt = session.startedAt;
    compact.completedAt = session.completedAt;
    compact.timer = session.timer;
    compact.createdAt = session.createdAt;
  }
  return compact;
}

function persistSession(session, delayed = false) {
  if (!session) return;
  const key = examStorageKey(session.tpoId, session.section);
  if (session.status === 'not-started') {
    removeLocalValue(key);
    return;
  }
  const snapshot = compactSession(session);
  if (delayed) scheduleLocalJson(key, snapshot, 300);
  else writeLocalJson(key, snapshot);
}

async function finalizeAttempt(session) {
  const api = window.electronAPI?.data?.attempt;
  if (!api) return;
  const promise = api.finalize(session);
  trackDesktopWrite(promise);
  await promise;
}

function pruneStaleBrowserKeys(storage) {
  if (!storage || !Number.isFinite(storage.length)) return [];
  const removed = [];
  for (let index = storage.length - 1; index >= 0; index -= 1) {
    const key = storage.key(index);
    if (!key?.startsWith(`${EXAM_STORAGE_PREFIX}:`)) continue;
    try {
      const session = JSON.parse(storage.getItem(key));
      if (session?.status === 'not-started') {
        cancelLocalWrite(key);
        storage.removeItem(key);
        removed.push(key);
      }
    } catch {
      // Invalid records are ignored here and rejected by readExamSession.
    }
  }
  return removed;
}

// Completed attempts and their recordings are never deleted. Only stale
// not-started keys left behind by older versions are cleaned up.
export function pruneCompletedExamHistory(storage = globalThis.localStorage) {
  if (globalThis.window?.electronAPI?.data) return Promise.resolve([]);
  return Promise.resolve(pruneStaleBrowserKeys(storage));
}

export const useExamStore = defineStore('exam', {
  state: () => ({
    activeId: '',
    sessions: {}
  }),
  getters: {
    activeSession: state => state.sessions[state.activeId] || null,
    session: state => (tpoId, section) => state.sessions[examSessionId(tpoId, section)] || null,
    answer: state => questionId => state.sessions[state.activeId]?.answers[String(questionId)]
  },
  actions: {
    openSession(options) {
      flushLocalWrites();
      const id = examSessionId(options.tpoId, options.section);
      let session = options.restart
        ? null
        : this.sessions[id] || readExamSession(options.tpoId, options.section);
      if (!session) {
        session = createExamSession(options);
      } else {
        Object.assign(session, contentVersionFields(session, { ...options.content }));
        if (!session.createdAt) session.createdAt = session.updatedAt;
      }
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
      persistSession(session, true);
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
    lockQuestions(questionIds) {
      const session = this.requireActive();
      for (const questionId of questionIds) {
        session.lockedQuestionIds[String(questionId)] = true;
      }
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
    expire(now = Date.now()) {
      const session = this.requireActive();
      if (!session.timer.expiredAt) {
        session.timer.expiredAt = now;
        this.touch(now);
      }
    },
    async complete(now = Date.now()) {
      const session = this.requireActive();
      session.status = 'completed';
      session.completedAt = now;
      session.timer.mode = 'unlimited';
      session.timer.deadlineAt = null;
      session.timer.expiredAt = null;
      session.timer.scopeType = null;
      session.timer.scopeId = null;
      const desktop = Boolean(globalThis.window?.electronAPI?.data);
      if (desktop) {
        session.updatedAt = now;
      } else {
        // The browser path keeps the completed session in local storage.
        this.touch(now);
      }
      try {
        await finalizeAttempt(session);
        if (desktop) {
          removeExamSession(session.tpoId, session.section);
        }
      } catch (error) {
        console.warn('Could not finalize the completed attempt:', error?.message);
      }
      pruneCompletedExamHistory(globalThis.localStorage).catch(() => {});
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
    persist() {
      const session = this.activeSession;
      if (!session) return;
      persistSession(session);
    }
  }
});
