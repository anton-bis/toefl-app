import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Rewrite electron-builder update metadata (latest*.yml) so that every
 * `url:` / `path:` entry points at an Aliyun OSS base URL instead of the
 * GitHub download (or v6 proxy) URL. Used by the oss-mirror workflow before
 * uploading the manifests to OSS.
 *
 * Target base comes from the OSS_UPDATE_BASE_URL environment variable and
 * defaults to the production justtofu-downloads bucket:
 *   https://justtofu-downloads.oss-cn-hangzhou.aliyuncs.com/releases/latest/
 *
 * sha512/size/version fields are preserved untouched; only url/path lines
 * are rewritten, resolving each entry to its file name (a plain relative
 * file name stays as-is; an absolute URL is reduced to its basename).
 */

export const DEFAULT_OSS_UPDATE_BASE_URL =
  'https://justtofu-downloads.oss-cn-hangzhou.aliyuncs.com/releases/latest/';

function unquote(value) {
  const trimmed = value.trim();
  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith("'") && trimmed.endsWith("'")) ||
      (trimmed.startsWith('"') && trimmed.endsWith('"')))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function ossAssetFileName(value) {
  const trimmed = unquote(value);
  const basename = trimmed.includes('/') ? trimmed.split('/').at(-1) : trimmed;
  if (!basename || basename.includes('/') || /[?#]/.test(basename)) {
    throw new Error(`Invalid update metadata asset: ${trimmed || 'empty'}`);
  }
  return decodeURIComponent(basename);
}

export function ossUpdateAssetUrl(value, baseUrl = DEFAULT_OSS_UPDATE_BASE_URL) {
  const normalized = String(baseUrl || '').replace(/\/+$/, '');
  if (!/^https?:\/\//.test(normalized)) throw new Error(`Invalid OSS base URL: ${baseUrl}`);
  return `${normalized}/${encodeURIComponent(ossAssetFileName(value))}`;
}

export async function rewriteUpdateMetadata(filePath, baseUrl = process.env.OSS_UPDATE_BASE_URL || DEFAULT_OSS_UPDATE_BASE_URL) {
  const source = await fs.promises.readFile(filePath, 'utf8');
  const output = source
    .split('\n')
    .map(line => {
      const match = /^(\s*(?:-\s+)?(?:url|path):\s*)(.+?)\s*$/.exec(line);
      if (!match) return line;
      return `${match[1]}${ossUpdateAssetUrl(match[2], baseUrl)}`;
    })
    .join('\n');
  await fs.promises.writeFile(filePath, output);
  return filePath;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  Promise.all(process.argv.slice(2).map(file => rewriteUpdateMetadata(path.resolve(file))))
    .then(files => console.log(`Rewrote ${files.length} update metadata file(s) for OSS.`))
    .catch(error => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
