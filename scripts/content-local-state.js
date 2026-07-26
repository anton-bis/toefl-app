import fs from 'node:fs';
import path from 'node:path';

export const CONTENT_LOCAL_STATE_FILE = '.content-media-state.json';

export function readContentLocalState(rootDir) {
  try {
    const value = JSON.parse(fs.readFileSync(path.join(rootDir, CONTENT_LOCAL_STATE_FILE), 'utf8'));
    return value && typeof value.manifestId === 'string' && value.packs ? value : null;
  } catch {
    return null;
  }
}

export function writeContentLocalState(rootDir, manifest) {
  const state = {
    manifestId: manifest.manifestId,
    packs: Object.fromEntries(manifest.packs.map(pack => [pack.id, pack.contentHash]))
  };
  fs.writeFileSync(
    path.join(rootDir, CONTENT_LOCAL_STATE_FILE),
    `${JSON.stringify(state, null, 2)}\n`,
    { mode: 0o600 }
  );
}
