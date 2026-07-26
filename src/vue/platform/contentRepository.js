import manifest from '../../content/question-manifest.json';
import {
  assertCompiledMetadata,
  assertQuestionManifest,
  canonicalQuestionEntries
} from '../../../electron/services/runtime-content.js';

function normalizeRelativePath(path) {
  const normalized = String(path || '')
    .replaceAll('\\', '/')
    .replace(/^\/+/, '');
  if (!normalized || normalized.includes('\0') || normalized.split('/').includes('..')) {
    throw new Error(`Invalid content path: ${path}`);
  }
  return normalized;
}

export function listCatalog(catalog = manifest) {
  const tests = new Map();
  for (const entry of catalog.entries) {
    if (!tests.has(entry.tpoId)) {
      tests.set(entry.tpoId, {
        tpoId: entry.tpoId,
        description: '2026 TOEFL Sample Test',
        sections: {}
      });
    }
    tests.get(entry.tpoId).sections[entry.section] = {
      id: entry.id,
      tpoId: entry.tpoId,
      section: entry.section,
      documentPath: entry.documentPath,
      sourcePath: entry.sourcePath,
      sourceHash: entry.sourceHash,
      documentHash: entry.documentHash
    };
  }
  return [...tests.values()].sort((a, b) => a.tpoId.localeCompare(b.tpoId));
}

export async function readText(path) {
  const relativePath = normalizeRelativePath(path);
  const response = await fetch(resolveAssetUrl(relativePath));
  if (!response.ok) throw new Error(`Content not found: ${relativePath}`);
  return response.text();
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function readCatalogManifest() {
  const catalog = JSON.parse(await readText('assets/questions/compiled/manifest.json'));
  assertQuestionManifest(catalog);
  if ((await sha256(canonicalQuestionEntries(catalog.entries))) !== catalog.contentHash)
    throw new Error('Invalid question content manifest.');
  return catalog;
}

export async function readQuestionDocument(entry) {
  const serialized = await readText(entry.documentPath);
  if ((await sha256(serialized)) !== entry.documentHash) {
    throw new Error(`Content integrity check failed: ${entry.documentPath}`);
  }
  let compiled;
  try {
    compiled = JSON.parse(serialized);
  } catch {
    throw new Error(`Invalid compiled content: ${entry.documentPath}`);
  }
  assertCompiledMetadata(compiled, entry);
  return compiled.document;
}

export function resolveAssetUrl(path) {
  const relativePath = normalizeRelativePath(path);
  if (window.electronAPI?.getContentAssetUrl) {
    return window.electronAPI.getContentAssetUrl(relativePath);
  }
  return `${import.meta.env.BASE_URL}${relativePath}`;
}

function questionAssetPath(documentPath, filename) {
  const directory = normalizeRelativePath(documentPath).split('/').slice(0, -1).join('/');
  return normalizeRelativePath(`${directory}/${filename}`);
}

export function resolveQuestionAsset(documentOrPath, filename) {
  if (!filename) return '';
  const sourcePath =
    typeof documentOrPath === 'string' ? documentOrPath : documentOrPath?.sourcePath;
  if (!sourcePath) return '';
  try {
    return resolveAssetUrl(questionAssetPath(sourcePath, filename));
  } catch {
    return '';
  }
}
