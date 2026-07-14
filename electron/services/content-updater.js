/**
 * 内容热更新服务（Electron 主进程）
 * 从 GitHub 拉取 manifest → 对比本地版本 → 下载新内容
 */
import { app, net } from 'electron';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { RUNTIME_CONTENT_EXTENSIONS } from './runtime-content.js';

const MANIFEST_URL = 'https://raw.githubusercontent.com/anton-bis/toefl-content/master/manifest.json';
const CONTENT_DIR_NAME = 'tpo-content';
const MAX_MANIFEST_BYTES = 2 * 1024 * 1024;
const MAX_CONTENT_BYTES = 50 * 1024 * 1024;

function getContentDir() {
  return path.join(app.getPath('userData'), CONTENT_DIR_NAME);
}

function resolveContentPath(subPath = '') {
  const raw = String(subPath).replaceAll('\\', '/');
  const normalized = raw.replace(/^\/+/, '');
  if (
    raw.startsWith('/') ||
    /^[a-z]:\//i.test(raw) ||
    normalized.includes('\0') ||
    normalized.split('/').includes('..') ||
    path.isAbsolute(normalized)
  ) {
    throw new Error('Invalid content path');
  }
  const root = path.resolve(getContentDir());
  const resolved = path.resolve(root, normalized);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error('Content path escapes root');
  }
  return resolved;
}

function getLocalVersion() {
  const versionFile = path.join(getContentDir(), '.version');
  try {
    const raw = fs.readFileSync(versionFile, 'utf-8').trim();
    return parseInt(raw) || 0;
  } catch {
    return 0;
  }
}

function saveLocalVersion(version) {
  const dir = getContentDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(path.join(dir, '.version'), String(version));
}

function validateRemoteUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || !['github.com', 'raw.githubusercontent.com'].includes(url.hostname)) {
    throw new Error(`不受信任的内容地址: ${url.hostname}`);
  }
  return url;
}

function validateUpdateItem(item) {
  if (!item || typeof item !== 'object') throw new Error('内容更新项格式错误');
  const target = resolveContentPath(item.path);
  if (!RUNTIME_CONTENT_EXTENSIONS.has(path.extname(target).toLowerCase())) {
    throw new Error(`不支持的内容类型: ${item.path}`);
  }
  const url = validateRemoteUrl(item.url).toString();
  if (item.sha256 && !/^[a-f\d]{64}$/i.test(item.sha256)) throw new Error('SHA-256 格式错误');
  return { ...item, url, target };
}

function validateManifest(manifest) {
  if (!manifest || !Number.isSafeInteger(manifest.content_version) || manifest.content_version < 0) {
    throw new Error('内容清单版本无效');
  }
  if (!Array.isArray(manifest.updates) || manifest.updates.length > 500) {
    throw new Error('内容清单更新列表无效');
  }
  return { ...manifest, updates: manifest.updates.map(validateUpdateItem) };
}

function fetchUrl(value, maxBytes, redirectCount = 0) {
  if (redirectCount > 5) return Promise.reject(new Error('重定向次数过多'));
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
          reject(new Error(`下载内容超过 ${maxBytes} 字节限制`));
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

async function downloadContent(url, expectedHash = '') {
  const data = await fetchUrl(url, MAX_CONTENT_BYTES);
  if (expectedHash) {
    const actualHash = crypto.createHash('sha256').update(data).digest('hex');
    if (actualHash.toLowerCase() !== expectedHash.toLowerCase()) {
      throw new Error(`SHA-256 mismatch: ${url}`);
    }
  }
  return data;
}

export async function checkForContentUpdates() {
  try {
    const manifest = await fetchManifest();
    const localVer = getLocalVersion();
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
    console.error('检查内容更新失败:', error.message);
    return { hasUpdate: false, error: error.message };
  }
}

export async function applyContentUpdates(updates) {
  const items = updates.map(validateUpdateItem);
  const stagingRoot = resolveContentPath(`.staging-${process.pid}-${Date.now()}`);
  const backups = [];
  const committed = [];
  fs.mkdirSync(stagingRoot, { recursive: true });
  try {
    for (const item of items) {
      const data = await downloadContent(item.url, item.sha256 || '');
      const staged = path.join(stagingRoot, path.relative(getContentDir(), item.target));
      fs.mkdirSync(path.dirname(staged), { recursive: true });
      fs.writeFileSync(staged, data, { mode: 0o600 });
      item.staged = staged;
    }
    for (const item of items) {
      fs.mkdirSync(path.dirname(item.target), { recursive: true });
      const backup = `${item.target}.backup-${process.pid}`;
      if (fs.existsSync(item.target)) {
        fs.renameSync(item.target, backup);
        backups.push({ target: item.target, backup });
      }
      fs.renameSync(item.staged, item.target);
      committed.push(item.target);
    }
    backups.forEach(({ backup }) => fs.rmSync(backup, { force: true }));
    return items.map(item => ({ path: item.path, success: true }));
  } catch (error) {
    for (const target of committed.reverse()) {
      if (fs.existsSync(target)) fs.rmSync(target, { force: true });
    }
    for (const { target, backup } of backups.reverse()) {
      if (fs.existsSync(backup)) fs.renameSync(backup, target);
    }
    return items.map(item => ({ path: item.path, success: false, error: error.message }));
  } finally {
    fs.rmSync(stagingRoot, { recursive: true, force: true });
  }
}

export async function runContentUpdate() {
  const manifest = await fetchManifest();
  const results = await applyContentUpdates(manifest.updates || []);
  const failures = results.filter(result => !result.success);
  if (failures.length > 0) {
    throw new Error(`内容更新失败：${failures.length} 个文件未能写入`);
  }
  saveLocalVersion(manifest.content_version);
  return { version: manifest.content_version, results };
}
