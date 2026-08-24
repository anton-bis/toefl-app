import fs from 'node:fs';
import path from 'node:path';

/**
 * License API base URL resolution (license-protocol-v1).
 *
 * Priority: TOEFL_API_BASE_URL env var > userData/web-config.json > DEFAULT_API_BASE_URL.
 * The dev default points at a local license server; the production value is
 * replaced before release (see README.md).
 */

export const DEFAULT_API_BASE_URL = 'http://localhost:3001';

export function normalizeApiBaseUrl(value) {
  const trimmed = String(value || '').trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  try {
    const url = new URL(trimmed);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    return `${url.origin}${url.pathname.replace(/\/+$/, '')}/`;
  } catch {
    return '';
  }
}

export function resolveApiBaseUrl({ env = process.env, userDataPath, fsModule = fs } = {}) {
  const fromEnv = normalizeApiBaseUrl(env?.TOEFL_API_BASE_URL);
  if (fromEnv) return fromEnv;

  if (userDataPath) {
    try {
      const config = JSON.parse(
        fsModule.readFileSync(path.join(userDataPath, 'web-config.json'), 'utf8')
      );
      const fromConfig = normalizeApiBaseUrl(config?.apiBaseUrl);
      if (fromConfig) return fromConfig;
    } catch {
      // A missing or invalid web-config.json simply falls back to the default.
    }
  }

  return normalizeApiBaseUrl(DEFAULT_API_BASE_URL);
}
