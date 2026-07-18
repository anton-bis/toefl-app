/**
 * Runtime content updates for the Electron main process.
 * Fetch the GitHub manifest, compare versions, and download changed files.
 */
import { app, net } from 'electron';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { normalizeContentPath, resolveContentFile } from './content-paths.js';
import { RUNTIME_CONTENT_EXTENSIONS } from './runtime-content.js';

const MANIFEST_URL =
  'https://raw.githubusercontent.com/anton-bis/toefl-content/master/manifest.json';
const CONTENT_DIR_NAME = 'tpo-content';
const MAX_MANIFEST_BYTES = 2 * 1024 * 1024;
const MAX_CONTENT_BYTES = 50 * 1024 * 1024;
const { access, mkdir, readFile, rename, rm, writeFile } = fs.promises;

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
  const relativePath = normalizeContentPath(item.path);
  const target = resolveContentFile(getContentDir(), relativePath);
  if (!RUNTIME_CONTENT_EXTENSIONS.has(path.extname(target).toLowerCase())) {
    throw new Error(`Unsupported content type: ${item.path}`);
  }
  const url = validateRemoteUrl(item.url).toString();
  if (!/^[a-f\d]{64}$/i.test(item.sha256 || '')) throw new Error('Missing SHA-256 checksum.');
  return { ...item, relativePath, url, target };
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

function fetchUrl(value, maxBytes, redirectCount = 0) {
  if (redirectCount > 5) return Promise.reject(new Error('Too many redirects.'));
  const url = validateRemoteUrl(value).toString();
  return new Promise((resolve, reject) => {
    const request = net.request({ url, method: 'GET' });
    request.on('response', response => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        const loc = response.headers.location;
        const redirected = new URL(Array.isArray(loc) ? loc[0] : loc, url).toString();
        return fetchUrl(redirected, maxBytes, redirectCount + 1)
          .then(resolve)
          .catch(reject);
      }
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${url}`));
        return;
      }
      const chunks = [];
      let total = 0;
      response.on('data', chunk => {
        total += chunk.length;
        if (total > maxBytes) {
          request.abort();
          reject(new Error(`The download exceeds the ${maxBytes}-byte limit.`));
          return;
        }
        chunks.push(Buffer.from(chunk));
      });
      response.on('end', () => resolve(Buffer.concat(chunks)));
    });
    request.on('error', reject);
    request.end();
  });
}

async function fetchManifest() {
  const data = await fetchUrl(MANIFEST_URL, MAX_MANIFEST_BYTES);
  return validateManifest(JSON.parse(data.toString('utf-8')));
}

function downloadContent(url, target, expectedHash = '', redirectCount = 0) {
  if (redirectCount > 5) return Promise.reject(new Error('Too many redirects.'));
  const safeUrl = validateRemoteUrl(url).toString();
  return new Promise((resolve, reject) => {
    const request = net.request({ url: safeUrl, method: 'GET' });
    let settled = false;
    const fail = error => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    request.on('response', response => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        settled = true;
        const location = response.headers.location;
        const redirected = new URL(
          Array.isArray(location) ? location[0] : location,
          safeUrl
        ).toString();
        downloadContent(redirected, target, expectedHash, redirectCount + 1)
          .then(resolve)
          .catch(reject);
        return;
      }
      if (response.statusCode !== 200) {
        fail(new Error(`HTTP ${response.statusCode}: ${safeUrl}`));
        return;
      }
      const output = fs.createWriteStream(target, { mode: 0o600 });
      const hash = crypto.createHash('sha256');
      let total = 0;
      response.on('data', chunk => {
        total += chunk.length;
        if (total > MAX_CONTENT_BYTES) {
          request.abort();
          output.destroy();
          fail(new Error(`The download exceeds the ${MAX_CONTENT_BYTES}-byte limit.`));
          return;
        }
        hash.update(chunk);
        if (!output.write(chunk)) {
          response.pause();
          output.once('drain', () => response.resume());
        }
      });
      response.on('end', () => output.end());
      response.on('error', fail);
      output.on('error', fail);
      output.on('finish', () => {
        const actualHash = hash.digest('hex');
        if (expectedHash && actualHash.toLowerCase() !== expectedHash.toLowerCase()) {
          fail(new Error(`SHA-256 mismatch: ${safeUrl}`));
          return;
        }
        if (!settled) {
          settled = true;
          resolve();
        }
      });
    });
    request.on('error', fail);
    request.end();
  });
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
      updateCount: (manifest.updates || []).length
    };
  } catch (error) {
    console.error('Content update check failed:', error.message);
    return { hasUpdate: false, error: error.message };
  }
}

async function applyContentUpdates(updates) {
  const items = updates.map(validateUpdateItem);
  const contentRoot = getContentDir();
  const parent = path.dirname(contentRoot);
  const stagingRoot = path.join(parent, `.tpo-content-staging-${process.pid}-${Date.now()}`);
  const backupRoot = path.join(parent, `.tpo-content-backup-${process.pid}-${Date.now()}`);
  let backedUp = false;
  let committed = false;
  let preserveBackup = false;
  await mkdir(stagingRoot, { recursive: true });
  try {
    for (const item of items) {
      const staged = resolveContentFile(stagingRoot, item.relativePath);
      await mkdir(path.dirname(staged), { recursive: true });
      await downloadContent(item.url, staged, item.sha256);
      item.staged = staged;
    }
    await validateCompiledRelease(stagingRoot);
    if (await exists(contentRoot)) {
      await rename(contentRoot, backupRoot);
      backedUp = true;
    }
    await rename(stagingRoot, contentRoot);
    committed = true;
    if (backedUp) {
      await rm(backupRoot, { recursive: true, force: true }).catch(error =>
        console.warn('Old content backup cleanup failed:', error.message)
      );
    }
    return items.map(item => ({ path: item.path, success: true }));
  } catch (error) {
    let failure = error;
    if (committed && (await exists(contentRoot))) {
      await rm(contentRoot, { recursive: true, force: true });
    }
    if (backedUp && (await exists(backupRoot))) {
      try {
        await rename(backupRoot, contentRoot);
      } catch (rollbackError) {
        preserveBackup = true;
        failure = new Error(
          `${error.message} Recovery copy preserved at ${backupRoot}: ${rollbackError.message}`
        );
      }
    }
    return items.map(item => ({ path: item.path, success: false, error: failure.message }));
  } finally {
    await rm(stagingRoot, { recursive: true, force: true }).catch(() => {});
    if (!preserveBackup) await rm(backupRoot, { recursive: true, force: true }).catch(() => {});
  }
}

export async function runContentUpdate() {
  const manifest = await fetchManifest();
  const results = await applyContentUpdates(manifest.updates || []);
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
  if (manifest?.schemaVersion !== 2 || !Array.isArray(manifest.entries)) {
    throw new Error('The content release has an invalid compiled manifest.');
  }
  const referencedMedia = new Set();
  const entryKeys = new Set();
  for (const entry of manifest.entries) {
    if (!/^[a-f\d]{64}$/i.test(entry?.documentHash || '')) {
      throw new Error('The content release has an invalid document hash.');
    }
    const keys = [`id:${entry.id}`, `path:${entry.documentPath}`];
    if (keys.some(key => entryKeys.has(key))) {
      throw new Error('The content release has duplicate entries.');
    }
    keys.forEach(key => entryKeys.add(key));
    const documentPath = resolveContentFile(root, normalizeContentPath(entry.documentPath));
    const serialized = await readFile(documentPath);
    const actualHash = crypto.createHash('sha256').update(serialized).digest('hex');
    if (actualHash.toLowerCase() !== entry.documentHash.toLowerCase()) {
      throw new Error(`Compiled content hash mismatch: ${entry.documentPath}`);
    }
    const compiled = JSON.parse(serialized);
    if (
      compiled?.source?.path !== entry.sourcePath ||
      compiled?.source?.sha256 !== entry.sourceHash ||
      compiled?.document?.id !== entry.id
    ) {
      throw new Error(`Compiled content metadata mismatch: ${entry.documentPath}`);
    }
    const sourceDirectory = path.dirname(normalizeContentPath(compiled?.source?.path));
    collectMediaFiles(compiled?.document, referencedMedia, sourceDirectory);
  }
  const contentHash = crypto
    .createHash('sha256')
    .update(
      JSON.stringify(
        manifest.entries.map(entry => [
          entry.id,
          entry.tpoId,
          entry.section,
          entry.sourcePath,
          entry.documentPath,
          entry.sourceHash,
          entry.documentHash
        ])
      )
    )
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
  Object.values(value).forEach(item => collectMediaFiles(item, files, sourceDirectory));
}
