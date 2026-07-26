import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { proxyGitHubDownloadUrl } from './github-download.js';

function releaseAssetUrl(version, fileName) {
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error('The macOS update version is invalid.');
  }
  if (path.basename(fileName) !== fileName || !fileName.endsWith('.dmg')) {
    throw new Error('The macOS update does not contain a valid DMG.');
  }
  return proxyGitHubDownloadUrl(
    `https://github.com/anton-bis/toefl-app/releases/download/v${version}/${encodeURIComponent(fileName)}`
  );
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
  const fileName = String(asset?.url || '');
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
  await fs.promises.rm(temporary, { force: true });
  const response = await fetchFile(releaseAssetUrl(version, fileName));
  if (!response.ok || !response.body) {
    throw new Error(`Could not download the macOS update (HTTP ${response.status}).`);
  }

  const expectedSize = Number(asset?.size) || Number(response.headers.get('content-length')) || 0;
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

  try {
    await pipeline(Readable.fromWeb(response.body), progress, fs.createWriteStream(temporary));
    if (hash.digest('base64') !== expectedSha512) {
      throw new Error('The downloaded macOS update failed its integrity check.');
    }
    await fs.promises.rename(temporary, target);
    onProgress?.(100);
    return target;
  } catch (error) {
    await fs.promises.rm(temporary, { force: true });
    throw error;
  }
}
