export const CONTENT_SCHEMA_VERSION = 1;
export const CONTENT_SCHEMA_MIN_APP_VERSION = '1.5.0';

export const RUNTIME_MEDIA_EXTENSIONS = new Set([
  '.gif',
  '.jpeg',
  '.jpg',
  '.m4a',
  '.mp3',
  '.mp4',
  '.ogg',
  '.png',
  '.svg',
  '.wav',
  '.webp'
]);

export const RUNTIME_CONTENT_EXTENSIONS = new Set(['.ico', '.json', ...RUNTIME_MEDIA_EXTENSIONS]);

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

export function canonicalContentPacks(packs) {
  return JSON.stringify(
    packs
      .map(pack => [pack.id, pack.contentHash])
      .sort(([left], [right]) => left.localeCompare(right))
  );
}

export function assertContentManifest(manifest) {
  if (
    !isRecord(manifest) ||
    manifest.schemaVersion !== CONTENT_SCHEMA_VERSION ||
    !Array.isArray(manifest.packs) ||
    manifest.packs.length === 0 ||
    manifest.packs.length > 100
  ) {
    throw new Error('Invalid runtime content manifest.');
  }
  requireHash(manifest.manifestId, 'runtime content manifest id');
  requireString(manifest.publishedAt, 'runtime content publish date');
  requireString(manifest.minAppVersion, 'minimum app version');
  const ids = new Set();
  for (const pack of manifest.packs) {
    if (!isRecord(pack) || !/^[a-z0-9() -]+$/.test(pack.id || '') || ids.has(pack.id)) {
      throw new Error('Invalid or duplicate runtime content pack.');
    }
    ids.add(pack.id);
    requireHash(pack.contentHash, `${pack.id} content hash`);
    requireHash(pack.archiveHash, `${pack.id} archive hash`);
    requireString(pack.url, `${pack.id} URL`);
    if (!Number.isSafeInteger(pack.size) || pack.size <= 0) {
      throw new Error(`Invalid ${pack.id} archive size.`);
    }
  }
  return manifest;
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
