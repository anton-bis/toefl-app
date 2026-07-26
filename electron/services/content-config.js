import crypto from 'node:crypto';
import { assertContentManifest, canonicalContentPacks } from './runtime-content.js';

export const DEFAULT_CONTENT_REPOSITORY = 'anton-bis/toefl-app';
export const DEFAULT_CONTENT_BRANCH = 'content';

const TRUSTED_CONTENT_HOSTS = new Set([
  'github.com',
  'raw.githubusercontent.com',
  'release-assets.githubusercontent.com',
  'objects.githubusercontent.com'
]);

export function contentManifestUrl(
  repository = DEFAULT_CONTENT_REPOSITORY,
  branch = DEFAULT_CONTENT_BRANCH
) {
  return `https://raw.githubusercontent.com/${repository}/${branch}/manifest.json`;
}

export function validateContentUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || !TRUSTED_CONTENT_HOSTS.has(url.hostname)) {
    throw new Error(`Untrusted content host: ${url.hostname}`);
  }
  return url;
}

export function assertPublishedContentManifest(value) {
  const manifest = assertContentManifest(value);
  const manifestId = crypto
    .createHash('sha256')
    .update(canonicalContentPacks(manifest.packs))
    .digest('hex');
  if (manifestId !== manifest.manifestId) throw new Error('Invalid runtime content manifest id.');
  manifest.packs.forEach(pack => validateContentUrl(pack.url));
  return manifest;
}
