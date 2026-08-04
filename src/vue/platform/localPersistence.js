const pendingWrites = new Map();
const lastValues = new Map();
const desktopWrites = new Set();
let suspended = false;
let desktopValues;

const available = () => typeof localStorage !== 'undefined';
const desktopData = () => globalThis.window?.electronAPI?.data;

export function configureDesktopPersistence({ settings = {}, examSessions = [] } = {}) {
  desktopValues = new Map(
    Object.entries(settings).map(([key, value]) => [key, JSON.stringify(value)])
  );
  examSessions.forEach(session => {
    const key = `toefl:exam:${encodeURIComponent(session.tpoId)}:${encodeURIComponent(session.section)}`;
    desktopValues.set(key, JSON.stringify(session));
  });
}

function trackDesktopWrite(promise) {
  desktopWrites.add(promise);
  promise.finally(() => desktopWrites.delete(promise)).catch(() => {});
}

export { trackDesktopWrite };

function desktopExamId(key) {
  const match = key.match(/^toefl:exam:([^:]+):([^:]+)$/);
  return match ? `tpo-${decodeURIComponent(match[1])}-${decodeURIComponent(match[2])}` : null;
}

function persistDesktop(key, value) {
  const api = desktopData();
  if (!api) return;
  const id = desktopExamId(key);
  if (!id) {
    trackDesktopWrite(api.settings.set(key, value));
    return;
  }
  const promise = api.exam.save({ ...value, id });
  trackDesktopWrite(promise);
}

function removeDesktop(key) {
  const id = desktopExamId(key);
  const promise = id ? desktopData().exam.delete(id) : desktopData().settings.set(key, null);
  trackDesktopWrite(promise);
}

export function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function commit(key, serialized) {
  if ((!available() && !desktopValues) || suspended) return false;
  const current = desktopValues ? desktopValues.get(key) : localStorage.getItem(key);
  if (lastValues.get(key) === serialized || current === serialized) {
    lastValues.set(key, serialized);
    return true;
  }
  try {
    if (desktopValues) {
      desktopValues.set(key, serialized);
      persistDesktop(key, JSON.parse(serialized));
    } else localStorage.setItem(key, serialized);
    lastValues.set(key, serialized);
    return true;
  } catch {
    return false;
  }
}

function commitJson(key, value) {
  return commit(key, JSON.stringify(value));
}

export function readLocalJson(key, fallback) {
  if (!available() && !desktopValues) return fallback;
  try {
    const serialized = desktopValues ? desktopValues.get(key) : localStorage.getItem(key);
    return JSON.parse(serialized) ?? fallback;
  } catch {
    return fallback;
  }
}

export function writeLocalJson(key, value) {
  cancelLocalWrite(key);
  return commitJson(key, value);
}

export function scheduleLocalJson(key, value, delay = 300) {
  if ((!available() && !desktopValues) || suspended) return;
  const pending = pendingWrites.get(key);
  if (pending) clearTimeout(pending.timer);
  pendingWrites.set(key, {
    value,
    timer: setTimeout(() => {
      pendingWrites.delete(key);
      commitJson(key, value);
    }, delay)
  });
}

export function cancelLocalWrite(key) {
  const pending = pendingWrites.get(key);
  if (pending) clearTimeout(pending.timer);
  pendingWrites.delete(key);
}

export function removeLocalValue(key) {
  cancelLocalWrite(key);
  lastValues.delete(key);
  if (desktopValues) {
    desktopValues.delete(key);
    removeDesktop(key);
  } else if (available()) localStorage.removeItem(key);
}

export async function flushLocalWrites() {
  do {
    const writes = [...pendingWrites.entries()];
    pendingWrites.clear();
    writes.forEach(([key, pending]) => {
      clearTimeout(pending.timer);
      commitJson(key, pending.value);
    });
    await Promise.all([...desktopWrites]);
  } while (pendingWrites.size || desktopWrites.size);
}

export function suspendLocalWrites() {
  pendingWrites.forEach(pending => clearTimeout(pending.timer));
  pendingWrites.clear();
  suspended = true;
}

export function resetLocalPersistenceForTests() {
  suspendLocalWrites();
  suspended = false;
  lastValues.clear();
  desktopValues = undefined;
  desktopWrites.clear();
}
