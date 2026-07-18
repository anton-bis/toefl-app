export const RUNTIME_CONTENT_EXTENSIONS = new Set([
  '.gif',
  '.ico',
  '.jpeg',
  '.jpg',
  '.json',
  '.m4a',
  '.mp3',
  '.mp4',
  '.ogg',
  '.png',
  '.svg',
  '.wav',
  '.webp'
]);

const HASH_PATTERN = /^[a-f\d]{64}$/i;
const QUESTION_SECTIONS = new Set(['reading', 'listening', 'writing', 'speaking']);

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requireString(value, label) {
  if (typeof value !== 'string' || !value) throw new Error(`Invalid ${label}.`);
}

function requireHash(value, label) {
  if (!HASH_PATTERN.test(value || '')) throw new Error(`Invalid ${label}.`);
}

function validateManifestEntry(entry) {
  if (!isRecord(entry)) throw new Error('Invalid question content entry.');
  requireString(entry.id, 'question content id');
  requireString(entry.tpoId, 'question content TPO id');
  if (!QUESTION_SECTIONS.has(entry.section)) throw new Error('Invalid question content section.');
  requireString(entry.sourcePath, 'question content source path');
  requireString(entry.documentPath, 'question content document path');
  requireHash(entry.sourceHash, 'question content source hash');
  requireHash(entry.documentHash, 'question content document hash');
}

function assertUniqueEntries(entries) {
  const ids = new Set();
  const sourcePaths = new Set();
  const documentPaths = new Set();
  for (const entry of entries) {
    validateManifestEntry(entry);
    if (
      ids.has(entry.id) ||
      sourcePaths.has(entry.sourcePath) ||
      documentPaths.has(entry.documentPath)
    ) {
      throw new Error('Duplicate question content entry.');
    }
    ids.add(entry.id);
    sourcePaths.add(entry.sourcePath);
    documentPaths.add(entry.documentPath);
  }
}

export function canonicalQuestionEntries(entries) {
  return JSON.stringify(
    entries.map(entry => [
      entry.id,
      entry.tpoId,
      entry.section,
      entry.sourcePath,
      entry.documentPath,
      entry.sourceHash,
      entry.documentHash
    ])
  );
}

export function assertQuestionManifest(manifest) {
  if (!isRecord(manifest) || !Array.isArray(manifest.entries)) {
    throw new Error('Invalid question content manifest.');
  }
  assertUniqueEntries(manifest.entries);
  requireHash(manifest.contentHash, 'question content manifest hash');
  return manifest;
}

export function assertCompiledMetadata(compiled, entry) {
  if (
    !isRecord(compiled) ||
    !isRecord(compiled.source) ||
    !isRecord(compiled.document) ||
    compiled.source.path !== entry.sourcePath ||
    compiled.source.sha256 !== entry.sourceHash ||
    compiled.document.id !== entry.id ||
    compiled.document.tpoId !== entry.tpoId ||
    compiled.document.section !== entry.section
  ) {
    throw new Error(`Compiled content metadata mismatch: ${entry.documentPath}`);
  }
  return compiled;
}
