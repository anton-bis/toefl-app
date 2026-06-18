/**
 * 内容热更新服务（Electron 主进程）
 * 从 GitHub 拉取 manifest → 对比本地版本 → 下载新内容
 */
import { app, net } from 'electron';
import fs from 'fs';
import path from 'path';

const MANIFEST_URL = 'https://raw.githubusercontent.com/anton-bis/toefl-content/master/manifest.json';
const CONTENT_DIR_NAME = 'tpo-content';

function getContentDir() {
  return path.join(app.getPath('userData'), CONTENT_DIR_NAME);
}

export function getContentPath(subPath) {
  return path.join(getContentDir(), subPath);
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

function fetchUrl(url, redirectCount = 0) {
  if (redirectCount > 5) return Promise.reject(new Error('重定向次数过多'));
  return new Promise((resolve, reject) => {
    const request = net.request({ url, method: 'GET' });
    request.on('response', response => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        const loc = response.headers.location;
        return fetchUrl(Array.isArray(loc) ? loc[0] : loc, redirectCount + 1)
          .then(resolve)
          .catch(reject);
      }
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${url}`));
        return;
      }
      const chunks = [];
      response.on('data', c => chunks.push(Buffer.from(c)));
      response.on('end', () => resolve(Buffer.concat(chunks)));
    });
    request.on('error', reject);
    request.end();
  });
}

async function fetchManifest() {
  const data = await fetchUrl(MANIFEST_URL);
  return JSON.parse(data.toString('utf-8'));
}

async function downloadFile(url, destPath) {
  const dir = path.dirname(destPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const data = await fetchUrl(url);
  fs.writeFileSync(destPath, data);
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
      updates: manifest.updates || [],
      updateCount: (manifest.updates || []).length
    };
  } catch (error) {
    console.error('检查内容更新失败:', error.message);
    return { hasUpdate: false, error: error.message };
  }
}

export async function applyContentUpdates(updates) {
  const contentDir = getContentDir();
  const assetBase = path.join(app.getAppPath(), 'assets', 'questions');
  const results = [];
  for (const item of updates) {
    try {
      const dest = path.join(contentDir, item.path);
      const assetDest = path.join(assetBase, item.path);
      await downloadFile(item.url, dest);
      await downloadFile(item.url, assetDest);
      results.push({ path: item.path, success: true });
    } catch (error) {
      results.push({ path: item.path, success: false, error: error.message });
    }
  }
  return results;
}

export async function runContentUpdate() {
  const manifest = await fetchManifest();
  const results = await applyContentUpdates(manifest.updates || []);
  saveLocalVersion(manifest.content_version);
  return { version: manifest.content_version, results };
}

export function contentDirExists() {
  const dir = getContentDir();
  return fs.existsSync(dir) && fs.statSync(dir).isDirectory();
}

export function listContentFiles(relDir) {
  const dir = path.join(getContentDir(), relDir || '');
  if (!fs.existsSync(dir)) return [];
  const result = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const rel = relDir ? `${relDir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      result.push(...listContentFiles(rel));
    } else {
      result.push(rel);
    }
  }
  return result;
}
