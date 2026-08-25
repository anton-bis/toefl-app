import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { normalizeContentPath } from '../../electron/services/content-paths.js';
import {
  canonicalContentPacks,
  CONTENT_SCHEMA_VERSION,
  RUNTIME_CONTENT_EXTENSIONS,
  RUNTIME_MEDIA_EXTENSIONS
} from '../../electron/services/runtime-content.js';
import { collectDocumentAssets } from '../../electron/services/content-assets.js';

export const CONTENT_MANIFEST_PATH = 'assets/questions/compiled/manifest.json';

export function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function listFiles(directory, rootDir) {
  if (!fs.existsSync(directory)) return [];
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) files.push(...listFiles(absolute, rootDir));
    else files.push(normalizeContentPath(path.relative(rootDir, absolute)));
  }
  return files;
}

function assertRuntimeFile(rootDir, relativePath) {
  const extension = path.extname(relativePath).toLowerCase();
  if (!RUNTIME_CONTENT_EXTENSIONS.has(extension)) {
    throw new Error(`Unsupported runtime content file: ${relativePath}`);
  }
  const absolute = path.join(rootDir, relativePath);
  if (!fs.statSync(absolute, { throwIfNoEntry: false })?.isFile()) {
    throw new Error(`Referenced content file is missing: ${relativePath}`);
  }
}

function pack(id, files) {
  return { id, files: [...new Set(files)].sort() };
}

export function discoverContentPacks(rootDir, questionManifest) {
  const packs = [pack('catalog', [CONTENT_MANIFEST_PATH])];
  const tpoFiles = new Map();

  for (const entry of questionManifest.entries) {
    if (!tpoFiles.has(entry.tpoId)) tpoFiles.set(entry.tpoId, new Set());
    const files = tpoFiles.get(entry.tpoId);
    files.add(normalizeContentPath(entry.documentPath));
    const compiled = JSON.parse(fs.readFileSync(path.join(rootDir, entry.documentPath), 'utf8'));
    const sourceDirectory = path.posix.dirname(normalizeContentPath(compiled.source.path));
    collectDocumentAssets(compiled.document, files, sourceDirectory);
  }

  for (const [tpoId, files] of [...tpoFiles].sort(([a], [b]) => a.localeCompare(b))) {
    packs.push(pack(`tpo-${tpoId}`, files));
  }

  const vocabularyFiles = listFiles(path.join(rootDir, 'assets/questions/vocabulary'), rootDir)
    .filter(file => path.extname(file).toLowerCase() === '.json')
    .concat(listFiles(path.join(rootDir, 'assets/audio/vocab'), rootDir));
  if (vocabularyFiles.length) packs.push(pack('vocabulary', vocabularyFiles));

  const typingPath = 'assets/questions/typing/corpus.json';
  if (fs.existsSync(path.join(rootDir, typingPath))) packs.push(pack('typing', [typingPath]));

  for (const current of packs) {
    if (!/^[a-z0-9() -]+$/.test(current.id)) throw new Error(`Invalid content pack id: ${current.id}`);
    if (!current.files.length) throw new Error(`Content pack is empty: ${current.id}`);
    current.files.forEach(file => assertRuntimeFile(rootDir, file));
  }
  return packs;
}

export function createPackManifest(rootDir, definition) {
  const files = definition.files.map(relativePath => {
    const data = fs.readFileSync(path.join(rootDir, relativePath));
    return { path: relativePath, size: data.length, sha256: sha256(data) };
  });
  const contentHash = sha256(
    JSON.stringify(files.map(file => [file.path, file.size, file.sha256]))
  );
  return {
    schemaVersion: CONTENT_SCHEMA_VERSION,
    id: definition.id,
    contentHash,
    files
  };
}

export function createManifestId(packs) {
  return sha256(canonicalContentPacks(packs));
}

export function isMediaPath(relativePath) {
  return RUNTIME_MEDIA_EXTENSIONS.has(path.extname(relativePath).toLowerCase());
}
