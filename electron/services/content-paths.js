import path from 'path';

export function normalizeContentPath(value) {
  const raw = String(value || '').replaceAll('\\', '/');
  const normalized = raw.replace(/^\/+/, '');
  if (
    !normalized ||
    raw.startsWith('/') ||
    /^[a-z]:\//i.test(raw) ||
    normalized.includes('\0') ||
    normalized.split('/').includes('..') ||
    path.isAbsolute(normalized)
  ) {
    throw new Error('Invalid content path');
  }
  return normalized;
}

export function externalContentPath(value) {
  return normalizeContentPath(value).replace(/^assets\/questions\//, '');
}

export function resolveContentFile(root, value) {
  const contentRoot = path.resolve(root);
  const resolved = path.resolve(contentRoot, normalizeContentPath(value));
  if (!resolved.startsWith(`${contentRoot}${path.sep}`)) {
    throw new Error('Content path escapes root');
  }
  return resolved;
}
