/**
 * Runtime content updates for the Electron main process.
 * Fetch the GitHub manifest, compare versions, and download changed files.
 */
import { app, net } from 'electron';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  assertCompiledMetadata,
  assertQuestionManifest,
  canonicalQuestionEntries,
  RUNTIME_CONTENT_EXTENSIONS
} from './runtime-content.js';
import { normalizeContentPath, resolveContentFile } from './content-paths.js';

const MANIFEST_URL =
  'https://raw.githubusercontent.com/anton-bis/toefl-content/master/manifest.json';
const CONTENT_DIR_NAME = 'tpo-content';
const MAX_MANIFEST_BYTES = 2 * 1024 * 1024;
const MAX_CONTENT_BYTES = 50 * 1024 * 1024;
const { access, cp, mkdir, readFile, rename, rm, writeFile } = fs.promises;
const CONTENT_SECTIONS = new Set(['reading', 'listening', 'writing', 'speaking']);

function getContentDir() {
  return path.join(app.getPath('userData'), CONTENT_DIR_NAME);
}

async function getLocalVersion() {
  const versionFile = path.join(getContentDir(), '.version');
  try {
    const raw = (await readFile(versionFile, 'utf-8')).trim();
    return parseInt(raw) || 0;
  } catch {
    return 0;
  }
}

async function saveLocalVersion(version) {
  const dir = getContentDir();
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, '.version'), String(version), { mode: 0o600 });
}

function validateRemoteUrl(value) {
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    !['github.com', 'raw.githubusercontent.com'].includes(url.hostname)
  ) {
    throw new Error(`Untrusted content host: ${url.hostname}`);
  }
  return url;
}

function validateUpdateItem(item) {
  if (!item || typeof item !== 'object') throw new Error('Invalid content update entry.');
  const relativePath = normalizeUpdatePath(item.path);
  if (!RUNTIME_CONTENT_EXTENSIONS.has(path.extname(relativePath).toLowerCase())) {
    throw new Error(`Unsupported content type: ${item.path}`);
  }
  const url = validateRemoteUrl(item.url).toString();
  if (item.sha256 && !/^[a-f\d]{64}$/i.test(item.sha256)) {
    throw new Error('Invalid SHA-256 checksum.');
  }
  return { ...item, relativePath, url };
}

function normalizeUpdatePath(value) {
  const pathValue = normalizeContentPath(value);
  if (pathValue.startsWith('assets/')) return pathValue;
  if (pathValue.startsWith('questions/')) return `assets/${pathValue}`;
  const [section] = pathValue.split('/');
  return CONTENT_SECTIONS.has(section) ? `assets/questions/${pathValue}` : pathValue;
}

function validateManifest(manifest) {
  if (
    !manifest ||
    !Number.isSafeInteger(manifest.content_version) ||
    manifest.content_version < 0
  ) {
    throw new Error('Invalid content manifest version.');
  }
  if (!Array.isArray(manifest.updates) || manifest.updates.length > 500) {
    throw new Error('Invalid content manifest update list.');
  }
  return { ...manifest, updates: manifest.updates.map(validateUpdateItem) };
}

function fetchUrl(value, { maxBytes, expectedHash = '', redirectCount = 0 }) {
  if (redirectCount > 5) return Promise.reject(new Error('Too many redirects.'));
  const url = validateRemoteUrl(value).toString();
  return new Promise((resolve, reject) => {
    const request = net.request({ url, method: 'GET' });
    let settled = false;
    const fail = error => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    request.on('response', response => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        settled = true;
        const loc = response.headers.location;
        const redirected = new URL(Array.isArray(loc) ? loc[0] : loc, url).toString();
        Promise.resolve()
          .then(() =>
            fetchUrl(redirected, {
              maxBytes,
              expectedHash,
              redirectCount: redirectCount + 1
            })
          )
          .then(resolve)
          .catch(reject);
        return;
      }
      if (response.statusCode !== 200) {
        fail(new Error(`HTTP ${response.statusCode}: ${url}`));
        return;
      }
      const chunks = [];
      let total = 0;
      response.on('data', chunk => {
        total += chunk.length;
        if (total > maxBytes) {
          request.abort();
          fail(new Error(`The download exceeds the ${maxBytes}-byte limit.`));
          return;
        }
        chunks.push(Buffer.from(chunk));
      });
      response.on('error', fail);
      response.on('end', () => {
        if (settled) return;
        const data = Buffer.concat(chunks);
        const actualHash = crypto.createHash('sha256').update(data).digest('hex');
        if (expectedHash && actualHash.toLowerCase() !== expectedHash.toLowerCase()) {
          fail(new Error(`SHA-256 mismatch: ${url}`));
          return;
        }
        settled = true;
        resolve(data);
      });
    });
    request.on('error', fail);
    request.end();
  });
}

async function fetchManifest() {
  const data = await fetchUrl(MANIFEST_URL, { maxBytes: MAX_MANIFEST_BYTES });
  return validateManifest(JSON.parse(data.toString('utf-8')));
}

async function downloadContent(url, target, expectedHash) {
  const data = await fetchUrl(url, { maxBytes: MAX_CONTENT_BYTES, expectedHash });
  await writeFile(target, data, { mode: 0o600 });
}

export async function checkForContentUpdates() {
  try {
    const manifest = await fetchManifest();
    const localVer = await getLocalVersion();
    const remoteVer = manifest.content_version;
    if (remoteVer <= localVer) {
      return { hasUpdate: false, localVersion: localVer, remoteVersion: remoteVer };
    }
    return {
      hasUpdate: true,
      localVersion: localVer,
      remoteVersion: remoteVer,
      updates: manifest.updates.map(({ path: updatePath, url, sha256 }) => ({
        path: updatePath,
        url,
        ...(sha256 ? { sha256 } : {})
      })),
      updateCount: manifest.updates.length
    };
  } catch (error) {
    console.error('Content update check failed:', error.message);
    return { hasUpdate: false, error: error.message };
  }
}

async function stageUpdates(items, stagingRoot) {
  const contentRoot = getContentDir();
  if (await exists(contentRoot)) await cp(contentRoot, stagingRoot, { recursive: true });
  await mkdir(stagingRoot, { recursive: true });
  for (const item of items) {
    const staged = resolveContentFile(stagingRoot, item.relativePath);
    await mkdir(path.dirname(staged), { recursive: true });
    await downloadContent(item.url, staged, item.sha256);
  }
  const compiledManifest = 'assets/questions/compiled/manifest.json';
  const updatesCompiledContent = items.some(item =>
    item.relativePath.startsWith('assets/questions/compiled/')
  );
  const includesCompiledManifest = items.some(item => item.relativePath === compiledManifest);
  if (updatesCompiledContent && !includesCompiledManifest) {
    throw new Error('Compiled content updates must include their manifest.');
  }
  if (includesCompiledManifest) await validateCompiledRelease(stagingRoot);
}

async function commitStagedRelease(state) {
  if (await exists(state.contentRoot)) {
    await rename(state.contentRoot, state.backupRoot);
    state.backedUp = true;
  }
  await rename(state.stagingRoot, state.contentRoot);
  state.committed = true;
  if (state.backedUp) {
    await rm(state.backupRoot, { recursive: true, force: true }).catch(error =>
      console.warn('Old content backup cleanup failed:', error.message)
    );
  }
}

async function rollbackRelease(state, originalError) {
  let failure = originalError;
  if (state.committed && (await exists(state.contentRoot))) {
    await rm(state.contentRoot, { recursive: true, force: true });
  }
  if (!state.backedUp || !(await exists(state.backupRoot))) return failure;
  try {
    await rename(state.backupRoot, state.contentRoot);
  } catch (rollbackError) {
    state.preserveBackup = true;
    failure = new Error(
      `${originalError.message} Recovery copy preserved at ${state.backupRoot}: ${rollbackError.message}`
    );
  }
  return failure;
}

async function cleanupRelease(state) {
  await rm(state.stagingRoot, { recursive: true, force: true }).catch(() => {});
  if (!state.preserveBackup) {
    await rm(state.backupRoot, { recursive: true, force: true }).catch(() => {});
  }
}

async function applyContentUpdates(updates) {
  const items = updates;
  const contentRoot = getContentDir();
  const parent = path.dirname(contentRoot);
  const suffix = `${process.pid}-${Date.now()}`;
  const state = {
    contentRoot,
    stagingRoot: path.join(parent, `.tpo-content-staging-${suffix}`),
    backupRoot: path.join(parent, `.tpo-content-backup-${suffix}`),
    backedUp: false,
    committed: false,
    preserveBackup: false
  };
  try {
    await stageUpdates(items, state.stagingRoot);
    await commitStagedRelease(state);
    return items.map(item => ({ path: item.path, success: true }));
  } catch (error) {
    const failure = await rollbackRelease(state, error);
    return items.map(item => ({ path: item.path, success: false, error: failure.message }));
  } finally {
    await cleanupRelease(state);
  }
}

export async function runContentUpdate() {
  const manifest = await fetchManifest();
  const results = await applyContentUpdates(manifest.updates);
  const failures = results.filter(result => !result.success);
  if (failures.length > 0) {
    throw new Error(`Content update failed for ${failures.length} file(s).`);
  }
  await saveLocalVersion(manifest.content_version);
  return { version: manifest.content_version, results };
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function validateCompiledRelease(root) {
  const manifestPath = resolveContentFile(root, 'assets/questions/compiled/manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  try {
    assertQuestionManifest(manifest);
  } catch {
    throw new Error('The content release has an invalid compiled manifest.');
  }
  const referencedMedia = new Set();
  for (const entry of manifest.entries) {
    const documentPath = resolveContentFile(root, normalizeContentPath(entry.documentPath));
    const serialized = await readFile(documentPath);
    const actualHash = crypto.createHash('sha256').update(serialized).digest('hex');
    if (actualHash.toLowerCase() !== entry.documentHash.toLowerCase()) {
      throw new Error(`Compiled content hash mismatch: ${entry.documentPath}`);
    }
    const compiled = JSON.parse(serialized);
    assertCompiledMetadata(compiled, entry);
    const sourceDirectory = path.dirname(normalizeContentPath(compiled?.source?.path));
    collectMediaFiles(compiled?.document, referencedMedia, sourceDirectory);
  }
  const contentHash = crypto
    .createHash('sha256')
    .update(canonicalQuestionEntries(manifest.entries))
    .digest('hex');
  if (contentHash !== manifest.contentHash) {
    throw new Error('The compiled content manifest hash is invalid.');
  }
  for (const relativePath of referencedMedia) {
    const mediaPath = resolveContentFile(root, relativePath);
    if (!(await exists(mediaPath))) throw new Error(`Referenced media is missing: ${relativePath}`);
  }
}

function collectMediaFiles(value, files, sourceDirectory) {
  if (Array.isArray(value)) {
    value.forEach(item => collectMediaFiles(item, files, sourceDirectory));
    return;
  }
  if (!value || typeof value !== 'object') return;
  if (typeof value.media?.file === 'string') {
    files.add(normalizeContentPath(path.posix.join(sourceDirectory, value.media.file)));
  }
  if (typeof value.image === 'string' && value.image) {
    files.add(normalizeContentPath(path.posix.join(sourceDirectory, value.image)));
  }
  Object.values(value).forEach(item => collectMediaFiles(item, files, sourceDirectory));
}
