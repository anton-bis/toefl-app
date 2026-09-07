import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { proxyGitHubDownloadUrl } from './github-download.js';

export const DEFAULT_APP_UPDATE_OSS_BASE =
  'https://justtofu-downloads.oss-cn-hangzhou.aliyuncs.com/releases/latest/';
const MAC_DOWNLOAD_ATTEMPTS = 2;

// electron-updater reports asset urls exactly as published: when the release
// metadata stores proxied absolute URLs (https://v6.gh-proxy.org/.../x.dmg)
// the update-available info carries that full URL, not a bare file name.
// Normalize both forms down to the plain .dmg file name before use.
export function assetFileName(asset) {
  const url = String(asset?.url || '');
  const fileName = /^https?:\/\//i.test(url)
    ? decodeURIComponent(new URL(url).pathname.split('/').filter(Boolean).pop() || '')
    : url;
  if (path.basename(fileName) !== fileName || !fileName.endsWith('.dmg')) {
    throw new Error('The macOS update does not contain a valid DMG.');
  }
  return fileName;
}

export function appUpdateOssBase() {
  const override = process.env.OSS_UPDATE_BASE_URL;
  return override && override.trim()
    ? `${String(override).trim().replace(/\/+$/, '')}/`
    : DEFAULT_APP_UPDATE_OSS_BASE;
}

export function macOssAssetUrl(fileName) {
  return `${appUpdateOssBase()}${encodeURIComponent(fileName)}`;
}

export function macInstallerSourceUrls(version, fileName) {
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error('The macOS update version is invalid.');
  }
  return [
    macOssAssetUrl(fileName),
    proxyGitHubDownloadUrl(
      `https://github.com/anton-bis/toefl-app/releases/download/v${version}/${encodeURIComponent(fileName)}`
    )
  ];
}

async function fileMatches(filePath, expectedSha512) {
  try {
    const hash = crypto.createHash('sha512');
    await pipeline(fs.createReadStream(filePath), hash);
    return hash.digest('base64') === expectedSha512;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

export async function downloadMacInstaller({
  version,
  asset,
  downloadsDirectory,
  fetchFile,
  onProgress
}) {
  const fileName = assetFileName(asset);
  const expectedSha512 = String(asset?.sha512 || '');
  if (!/^[A-Za-z0-9+/]{86}==$/.test(expectedSha512)) {
    throw new Error('The macOS update has no valid integrity hash.');
  }

  const target = path.join(downloadsDirectory, fileName);
  if (await fileMatches(target, expectedSha512)) {
    onProgress?.(100);
    return target;
  }

  const temporary = `${target}.download`;
  const sources = macInstallerSourceUrls(version, fileName);
  let lastError;
  for (const sourceUrl of sources) {
    for (let attempt = 0; attempt < MAC_DOWNLOAD_ATTEMPTS; attempt += 1) {
      try {
        await fs.promises.rm(temporary, { force: true });
        const response = await fetchFile(sourceUrl);
        if (!response.ok || !response.body) {
          throw new Error(`Could not download the macOS update (HTTP ${response.status}).`);
        }

        const expectedSize =
          Number(asset?.size) || Number(response.headers.get('content-length')) || 0;
        const hash = crypto.createHash('sha512');
        let received = 0;
        const progress = new Transform({
          transform(chunk, _encoding, callback) {
            received += chunk.length;
            hash.update(chunk);
            if (expectedSize > 0)
              onProgress?.(Math.min(100, Math.round((received / expectedSize) * 100)));
            callback(null, chunk);
          }
        });

        await pipeline(Readable.fromWeb(response.body), progress, fs.createWriteStream(temporary));
        if (hash.digest('base64') !== expectedSha512) {
          throw new Error('The downloaded macOS update failed its integrity check.');
        }
        await fs.promises.rename(temporary, target);
        onProgress?.(100);
        return target;
      } catch (error) {
        lastError = error;
        await fs.promises.rm(temporary, { force: true });
      }
    }
  }
  throw lastError;
}
