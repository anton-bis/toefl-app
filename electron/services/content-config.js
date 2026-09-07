import crypto from 'node:crypto';
import { assertContentManifest, canonicalContentPacks } from './runtime-content.js';
import {
  proxyGitHubDownloadUrl,
  resolveContentDownloadUrl,
  validateContentDownloadUrl
} from './github-download.js';

export const DEFAULT_CONTENT_REPOSITORY = 'anton-bis/toefl-app';
export const DEFAULT_CONTENT_BRANCH = 'content';
export const DEFAULT_CONTENT_OSS_BASE =
  'https://justtofu-downloads.oss-cn-hangzhou.aliyuncs.com/releases/content/';

export function contentManifestUrl(
  repository = DEFAULT_CONTENT_REPOSITORY,
  branch = DEFAULT_CONTENT_BRANCH
) {
  return proxyGitHubDownloadUrl(
    `https://raw.githubusercontent.com/${repository}/${branch}/manifest.json`
  );
}

export function contentOssBase() {
  const override = process.env.TOEFL_CONTENT_OSS_BASE;
  return override && override.trim()
    ? `${String(override).trim().replace(/\/+$/, '')}/`
    : DEFAULT_CONTENT_OSS_BASE;
}

export function contentOssManifestUrl() {
  return `${contentOssBase()}manifest.json`;
}

export function contentOssPackUrl(manifestShortId, fileName) {
  return `${contentOssBase()}${manifestShortId}/${fileName}`;
}

export function contentManifestSources() {
  const override = process.env.TOEFL_CONTENT_MANIFEST_URL;
  if (override && override.trim()) return [override.trim()];
  return [contentOssManifestUrl(), contentManifestUrl()];
}

export function validateContentUrl(value) {
  return validateContentDownloadUrl(value);
}

export function contentDownloadUrl(value) {
  return resolveContentDownloadUrl(value);
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
