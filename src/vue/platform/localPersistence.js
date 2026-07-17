const pendingWrites = new Map();
const lastValues = new Map();
let suspended = false;
let listenersInstalled = false;

const available = () => typeof localStorage !== 'undefined';

export function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function isSafeStorageKey(value) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 200 &&
    !Object.prototype.hasOwnProperty.call(Object.prototype, value)
  );
}

function commit(key, serialized) {
  if (!available() || suspended) return false;
  if (lastValues.get(key) === serialized || localStorage.getItem(key) === serialized) {
    lastValues.set(key, serialized);
    return true;
  }
  try {
    localStorage.setItem(key, serialized);
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
  if (!available()) return fallback;
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

export function writeLocalJson(key, value) {
  cancelLocalWrite(key);
  return commitJson(key, value);
}

export function scheduleLocalJson(key, value, delay = 300) {
  if (!available() || suspended) return;
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
  if (available()) localStorage.removeItem(key);
}

export function flushLocalWrites() {
  const writes = [...pendingWrites.entries()];
  pendingWrites.clear();
  writes.forEach(([key, pending]) => {
    clearTimeout(pending.timer);
    commitJson(key, pending.value);
  });
}

export function suspendLocalWrites() {
  pendingWrites.forEach(pending => clearTimeout(pending.timer));
  pendingWrites.clear();
  suspended = true;
}

export function resumeLocalWrites() {
  suspended = false;
  lastValues.clear();
}

export function installPersistenceListeners(target = globalThis.window) {
  if (listenersInstalled || !target?.addEventListener) return;
  const flushWhenHidden = () => {
    if (globalThis.document?.visibilityState === 'hidden') flushLocalWrites();
  };
  target.addEventListener('pagehide', flushLocalWrites);
  globalThis.document?.addEventListener?.('visibilitychange', flushWhenHidden);
  listenersInstalled = true;
}

export function resetLocalPersistenceForTests() {
  suspendLocalWrites();
  resumeLocalWrites();
}
