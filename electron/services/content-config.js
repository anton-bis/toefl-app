import crypto from 'node:crypto';
import { assertContentManifest, canonicalContentPacks } from './runtime-content.js';
import { proxyGitHubDownloadUrl, validateGitHubDownloadUrl } from './github-download.js';

export const DEFAULT_CONTENT_REPOSITORY = 'anton-bis/toefl-app';
export const DEFAULT_CONTENT_BRANCH = 'content';

export function contentManifestUrl(
  repository = DEFAULT_CONTENT_REPOSITORY,
  branch = DEFAULT_CONTENT_BRANCH
) {
  return proxyGitHubDownloadUrl(
    `https://raw.githubusercontent.com/${repository}/${branch}/manifest.json`
  );
}

export function validateContentUrl(value) {
  return validateGitHubDownloadUrl(value);
}

export function contentDownloadUrl(value) {
  return proxyGitHubDownloadUrl(value);
}

export function assertPublishedContentManifest(value) {
  const manifest = assertContentManifest(value);
  const manifestId = crypto
    .createHash('sha256')
    .update(canonicalContentPacks(manifest.packs))
    .digest('hex');
  if (manifestId !== manifest.manifestId) throw new Error('Invalid runtime content manifest id.');
  return {
    ...manifest,
    packs: manifest.packs.map(pack => ({
      ...pack,
      url: contentDownloadUrl(pack.url)
    }))
  };
}
