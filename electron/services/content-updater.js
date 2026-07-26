import { app, net } from 'electron';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  assertCompiledMetadata,
  assertQuestionManifest,
  canonicalQuestionEntries
} from './runtime-content.js';
import { normalizeContentPath, resolveContentFile } from './content-paths.js';
import {
  activateManifest,
  activePackRoots,
  getContentRoot,
  getPackDirectory,
  hasLegacyContent,
  isInstalledManifestReady,
  readInstalledManifest,
  readPendingManifest,
  removeUnusedPacks,
  savePendingManifest
} from './content-installation.js';
import {
  extractContentArchive,
  installExtractedPack,
  validateExtractedPack
} from './content-archive.js';
import { collectDocumentAssets } from './content-assets.js';
import {
  assertPublishedContentManifest,
  contentManifestUrl,
  validateContentUrl
} from './content-config.js';

const MAX_MANIFEST_BYTES = 2 * 1024 * 1024;
const MAX_PACK_BYTES = 512 * 1024 * 1024;
const RESPONSE_TIMEOUT_MS = 30_000;
const DOWNLOAD_IDLE_TIMEOUT_MS = 60_000;
const { access, mkdir, readFile, rm } = fs.promises;

let synchronization;
let contentBusy = false;
let synchronizeWhenIdle = false;
let eventSink = () => {};
let activatedSink = () => {};

function emit(state) {
  eventSink(state);
  return state;
}

export function configureContentUpdater({ onState, onActivated } = {}) {
  eventSink = typeof onState === 'function' ? onState : () => {};
  activatedSink = typeof onActivated === 'function' ? onActivated : () => {};
}

function manifestUrl() {
  return process.env.TOEFL_CONTENT_MANIFEST_URL || contentManifestUrl();
}

function requestResponse(value, { start = 0, redirectCount = 0 } = {}) {
  if (redirectCount > 5) return Promise.reject(new Error('Too many content redirects.'));
  const url = validateContentUrl(value).toString();
  return new Promise((resolve, reject) => {
    const request = net.request({ url, method: 'GET' });
    const timeout = setTimeout(() => {
      request.abort();
      reject(new Error(`Content request timed out: ${url}`));
    }, RESPONSE_TIMEOUT_MS);
    if (start > 0) request.setHeader('Range', `bytes=${start}-`);
    request.on('response', response => {
      clearTimeout(timeout);
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        const location = Array.isArray(response.headers.location)
          ? response.headers.location[0]
          : response.headers.location;
        const redirected = new URL(location, url).toString();
        response.resume();
        requestResponse(redirected, { start, redirectCount: redirectCount + 1 })
          .then(resolve)
          .catch(reject);
        return;
      }
      resolve({ response, url });
    });
    request.on('error', error => {
      clearTimeout(timeout);
      reject(error);
    });
    request.end();
  });
}

async function fetchBuffer(value, maxBytes) {
  const { response, url } = await requestResponse(value);
  if (response.statusCode !== 200) throw new Error(`HTTP ${response.statusCode}: ${url}`);
  const chunks = [];
  let total = 0;
  let idleTimeout;
  const resetTimeout = () => {
    clearTimeout(idleTimeout);
    idleTimeout = setTimeout(
      () => response.destroy(new Error('Content manifest download timed out.')),
      DOWNLOAD_IDLE_TIMEOUT_MS
    );
  };
  try {
    resetTimeout();
    for await (const chunk of response) {
      resetTimeout();
      total += chunk.length;
      if (total > maxBytes) throw new Error('The content manifest exceeds its size limit.');
      chunks.push(Buffer.from(chunk));
    }
  } finally {
    clearTimeout(idleTimeout);
  }
  return Buffer.concat(chunks);
}

export async function fetchContentManifest() {
  const data = await fetchBuffer(`${manifestUrl()}?t=${Date.now()}`, MAX_MANIFEST_BYTES);
  return assertPublishedContentManifest(JSON.parse(data.toString('utf8')));
}

async function hashExistingFile(filePath, bytes) {
  const hash = crypto.createHash('sha256');
  if (!bytes) return hash;
  await new Promise((resolve, reject) => {
    const input = fs.createReadStream(filePath);
    input.on('data', chunk => hash.update(chunk));
    input.on('error', reject);
    input.on('end', resolve);
  });
  return hash;
}

async function downloadPack(pack, target, reportProgress) {
  await mkdir(path.dirname(target), { recursive: true });
  let existing = 0;
  try {
    existing = (await fs.promises.stat(target)).size;
    if (existing === pack.size) {
      const completedHash = await hashExistingFile(target, existing);
      if (completedHash.digest('hex') === pack.archiveHash.toLowerCase()) {
        reportProgress(existing);
        return;
      }
      await rm(target, { force: true });
      existing = 0;
    } else if (existing > pack.size) {
      await rm(target, { force: true });
      existing = 0;
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }

  const { response, url } = await requestResponse(pack.url, { start: existing });
  const append = existing > 0 && response.statusCode === 206;
  if (![200, 206].includes(response.statusCode) || (response.statusCode === 206 && !existing)) {
    response.resume();
    throw new Error(`HTTP ${response.statusCode}: ${url}`);
  }
  if (!append) existing = 0;
  const hash = await hashExistingFile(target, existing);
  const output = fs.createWriteStream(target, {
    flags: append ? 'a' : 'w',
    mode: 0o600
  });
  let total = existing;
  reportProgress(total);

  try {
    await new Promise((resolve, reject) => {
      let settled = false;
      let idleTimeout;
      const resetTimeout = () => {
        clearTimeout(idleTimeout);
        idleTimeout = setTimeout(
          () => fail(new Error(`Content pack download timed out: ${pack.id}`)),
          DOWNLOAD_IDLE_TIMEOUT_MS
        );
      };
      const fail = error => {
        if (settled) return;
        settled = true;
        clearTimeout(idleTimeout);
        response.destroy();
        output.destroy();
        reject(error);
      };
      response.on('data', chunk => {
        resetTimeout();
        total += chunk.length;
        if (total > pack.size || total > MAX_PACK_BYTES) {
          fail(new Error(`Content pack exceeds its declared size: ${pack.id}`));
          return;
        }
        hash.update(chunk);
        if (!output.write(chunk)) {
          response.pause();
          output.once('drain', () => response.resume());
        }
        reportProgress(total);
      });
      response.on('error', fail);
      output.on('error', fail);
      response.on('end', () => {
        if (settled) return;
        clearTimeout(idleTimeout);
        output.end(() => {
          settled = true;
          resolve();
        });
      });
      resetTimeout();
    });
  } catch (error) {
    output.destroy();
    throw error;
  }
  if (total !== pack.size || hash.digest('hex') !== pack.archiveHash.toLowerCase()) {
    await rm(target, { force: true });
    throw new Error(`Content pack integrity check failed: ${pack.id}`);
  }
}

function parseVersion(value) {
  const match = String(value || '').match(/^(\d+)\.(\d+)\.(\d+)/);
  return match ? match.slice(1).map(Number) : [0, 0, 0];
}

function supportsManifest(manifest) {
  const installed = parseVersion(app.getVersion());
  const minimum = parseVersion(manifest.minAppVersion);
  for (let index = 0; index < installed.length; index += 1) {
    if (installed[index] !== minimum[index]) return installed[index] > minimum[index];
  }
  return true;
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function findInstalledFile(contentRoot, manifest, relativePath) {
  for (const root of activePackRoots(contentRoot, manifest)) {
    const candidate = resolveContentFile(root, relativePath);
    if (await exists(candidate)) return candidate;
  }
  return null;
}

async function validateInstalledContent(contentRoot, manifest) {
  const manifestPath = await findInstalledFile(
    contentRoot,
    manifest,
    'assets/questions/compiled/manifest.json'
  );
  if (!manifestPath) throw new Error('The installed content catalog is missing.');
  const catalog = assertQuestionManifest(JSON.parse(await readFile(manifestPath, 'utf8')));
  const catalogHash = crypto
    .createHash('sha256')
    .update(canonicalQuestionEntries(catalog.entries))
    .digest('hex');
  if (catalogHash !== catalog.contentHash) throw new Error('The installed catalog is invalid.');
  const referencedMedia = new Set();
  for (const entry of catalog.entries) {
    const documentPath = await findInstalledFile(contentRoot, manifest, entry.documentPath);
    if (!documentPath) throw new Error(`Compiled content is missing: ${entry.documentPath}`);
    const serialized = await readFile(documentPath);
    const documentHash = crypto.createHash('sha256').update(serialized).digest('hex');
    if (documentHash !== entry.documentHash) {
      throw new Error(`Compiled content hash mismatch: ${entry.documentPath}`);
    }
    const compiled = JSON.parse(serialized);
    assertCompiledMetadata(compiled, entry);
    collectDocumentAssets(
      compiled.document,
      referencedMedia,
      path.posix.dirname(normalizeContentPath(compiled.source.path))
    );
  }
  for (const relativePath of referencedMedia) {
    if (!(await findInstalledFile(contentRoot, manifest, relativePath))) {
      throw new Error(`Referenced media is missing: ${relativePath}`);
    }
  }
}

async function installPack(contentRoot, pack, progress) {
  const destination = getPackDirectory(contentRoot, pack);
  if (await exists(path.join(destination, 'pack.json'))) {
    try {
      await validateExtractedPack(destination, pack);
      progress(pack.size);
      return;
    } catch {
      await rm(destination, { recursive: true, force: true });
    }
  }
  const downloads = path.join(contentRoot, 'downloads');
  const stagingRoot = path.join(contentRoot, 'staging');
  const archivePath = path.join(downloads, `${pack.id}-${pack.contentHash}.zip.part`);
  const staging = path.join(stagingRoot, `${pack.id}-${pack.contentHash}-${process.pid}`);
  await downloadPack(pack, archivePath, progress);
  await extractContentArchive(archivePath, staging);
  await validateExtractedPack(staging, pack);
  await installExtractedPack(staging, destination);
  await rm(archivePath, { force: true });
}

async function installedPackIsUsable(contentRoot, pack) {
  const destination = getPackDirectory(contentRoot, pack);
  if (!(await exists(path.join(destination, 'pack.json')))) return false;
  try {
    await validateExtractedPack(destination, pack);
    return true;
  } catch {
    return false;
  }
}

async function installedManifestIsUsable(contentRoot, manifest) {
  if (!manifest) return false;
  try {
    for (const pack of manifest.packs) {
      if (!(await installedPackIsUsable(contentRoot, pack))) return false;
    }
    await validateInstalledContent(contentRoot, manifest);
    return true;
  } catch {
    return false;
  }
}

async function activate(contentRoot, manifest) {
  await activateManifest(contentRoot, manifest);
  await rm(path.join(contentRoot, '.version'), { force: true });
  await rm(path.join(contentRoot, 'assets'), { recursive: true, force: true });
  await removeUnusedPacks(contentRoot, [manifest]);
  activatedSink(manifest);
  return emit({ status: 'ready', ready: true, manifestId: manifest.manifestId, progress: 100 });
}

async function runSynchronization() {
  const contentRoot = getContentRoot(app.getPath('userData'));
  const local = await readInstalledManifest(contentRoot);
  const localReady =
    (await isInstalledManifestReady(contentRoot, local)) || (await hasLegacyContent(contentRoot));
  emit({ status: 'checking', ready: localReady, progress: 0 });
  try {
    const remote = await fetchContentManifest();
    if (!supportsManifest(remote)) {
      throw new Error(`Content requires app version ${remote.minAppVersion} or later.`);
    }
    const pending = await readPendingManifest(contentRoot);
    if (
      pending?.manifestId === remote.manifestId &&
      !contentBusy &&
      (await installedManifestIsUsable(contentRoot, pending))
    ) {
      return activate(contentRoot, pending);
    }

    const localPacks = new Map((local?.packs || []).map(pack => [pack.id, pack]));
    const changed = [];
    let deferredRepair = false;
    for (const pack of remote.packs) {
      const sameInstalledPack = localPacks.get(pack.id)?.contentHash === pack.contentHash;
      if (!sameInstalledPack) {
        changed.push(pack);
      } else if (!(await installedPackIsUsable(contentRoot, pack))) {
        if (contentBusy && localReady) deferredRepair = true;
        else changed.push(pack);
      }
    }
    const totalBytes = changed.reduce((sum, pack) => sum + pack.size, 0);
    let completedBytes = 0;
    for (const pack of changed) {
      let currentBytes = 0;
      await installPack(contentRoot, pack, bytes => {
        currentBytes = bytes;
        const downloadedBytes = completedBytes + currentBytes;
        emit({
          status: 'downloading',
          ready: localReady,
          packId: pack.id,
          downloadedBytes,
          totalBytes,
          progress: totalBytes
            ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100))
            : 100
        });
      });
      completedBytes += pack.size;
    }
    if (deferredRepair) {
      synchronizeWhenIdle = true;
      return emit({
        status: 'ready',
        ready: true,
        manifestId: local?.manifestId || '',
        progress: 100
      });
    }
    await validateInstalledContent(contentRoot, remote);
    if (!changed.length && localReady && local?.manifestId === remote.manifestId) {
      return emit({ status: 'ready', ready: true, manifestId: local.manifestId, progress: 100 });
    }
    if (contentBusy && localReady) {
      await savePendingManifest(contentRoot, remote);
      await removeUnusedPacks(contentRoot, [local, remote]);
      return emit({
        status: 'pending',
        ready: true,
        manifestId: local?.manifestId || '',
        pendingManifestId: remote.manifestId,
        progress: 100
      });
    }
    return activate(contentRoot, remote);
  } catch (error) {
    if (localReady) {
      return emit({
        status: 'ready',
        ready: true,
        manifestId: local?.manifestId || '',
        warning: error.message,
        progress: 100
      });
    }
    return emit({ status: 'error', ready: false, error: error.message, progress: 0 });
  }
}

export function synchronizeContent() {
  synchronization ||= runSynchronization().finally(() => {
    synchronization = null;
  });
  return synchronization;
}

export async function initializeContent() {
  const contentRoot = getContentRoot(app.getPath('userData'));
  const local = await readInstalledManifest(contentRoot);
  const ready =
    (await isInstalledManifestReady(contentRoot, local)) || (await hasLegacyContent(contentRoot));
  if (ready) {
    const pending = await readPendingManifest(contentRoot);
    if (pending && (await installedManifestIsUsable(contentRoot, pending))) {
      return activate(contentRoot, pending);
    }
    const state = emit({
      status: 'ready',
      ready: true,
      manifestId: local?.manifestId || '',
      progress: 100
    });
    void synchronizeContent().catch(() => {});
    return state;
  }
  return synchronizeContent();
}

export async function setContentBusy(value) {
  contentBusy = Boolean(value);
  if (contentBusy) return;
  const contentRoot = getContentRoot(app.getPath('userData'));
  const pending = await readPendingManifest(contentRoot);
  const shouldSynchronize = synchronizeWhenIdle;
  synchronizeWhenIdle = false;
  if (pending && (await installedManifestIsUsable(contentRoot, pending))) {
    await activate(contentRoot, pending);
    if (!shouldSynchronize) return;
  }
  if (pending || shouldSynchronize) await synchronizeContent();
}
