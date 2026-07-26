import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { proxyGitHubDownloadUrl } from '../electron/services/github-download.js';

const REPOSITORY = 'anton-bis/toefl-app';

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

export function proxiedReleaseAssetUrl(version, value) {
  const fileName = unquote(value);
  if (path.basename(fileName) !== fileName || !fileName) {
    throw new Error(`Invalid release metadata asset: ${fileName || 'empty'}`);
  }
  return proxyGitHubDownloadUrl(
    `https://github.com/${REPOSITORY}/releases/download/v${version}/${encodeURIComponent(fileName)}`
  );
}

export async function proxyUpdateMetadata(filePath) {
  const source = await fs.promises.readFile(filePath, 'utf8');
  const version = /^version:\s*['"]?([^'"\s]+)['"]?\s*$/m.exec(source)?.[1];
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version || '')) {
    throw new Error(`Invalid update metadata version in ${path.basename(filePath)}.`);
  }

  const output = source
    .split('\n')
    .map(line => {
      const match = /^(\s*(?:-\s+)?(?:url|path):\s*)(.+?)\s*$/.exec(line);
      if (!match) return line;
      const value = unquote(match[2]);
      if (/^https:\/\/(?:v6\.)?gh-proxy\.org\/https:\/\//.test(value)) {
        return `${match[1]}${proxyGitHubDownloadUrl(value)}`;
      }
      return `${match[1]}${proxiedReleaseAssetUrl(version, value)}`;
    })
    .join('\n');
  await fs.promises.writeFile(filePath, output);
  return filePath;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  Promise.all(process.argv.slice(2).map(file => proxyUpdateMetadata(path.resolve(file))))
    .then(files => console.log(`Proxied ${files.length} update metadata file(s).`))
    .catch(error => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
