import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { hasAbsoluteAssetPaths, validateProductionBundle } from '../../electron/services/bundle-validation.js';

function writeIndex(directory, body) {
  const indexPath = path.join(directory, 'dist', 'index.html');
  fs.mkdirSync(path.dirname(indexPath), { recursive: true });
  fs.writeFileSync(indexPath, body);
  return indexPath;
}

test('detects absolute /assets paths that break Electron file:// loading', () => {
  assert.equal(
    hasAbsoluteAssetPaths('<script type="module" src="/assets/index-abc.js"></script>'),
    true
  );
  assert.equal(
    hasAbsoluteAssetPaths('<link rel="stylesheet" href="/assets/index.css">'),
    true
  );
  assert.equal(
    hasAbsoluteAssetPaths('<script type="module" src="./assets/index-abc.js"></script>'),
    false
  );
  assert.equal(hasAbsoluteAssetPaths('<div>no assets here</div>'), false);
});

test('validates a relative-path bundle as ok', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'toefl-bundle-'));
  try {
    const indexPath = writeIndex(
      directory,
      '<html><head><script type="module" src="./assets/index.js"></script></head></html>'
    );
    const result = validateProductionBundle({ indexPath });
    assert.equal(result.ok, true);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('rejects an absolute-path bundle with the blank-screen cause', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'toefl-bundle-'));
  try {
    const indexPath = writeIndex(
      directory,
      '<html><head><script type="module" src="/assets/index.js"></script></head></html>'
    );
    const result = validateProductionBundle({ indexPath });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'absolute-assets');
    assert.match(result.message, /ELECTRON=true/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('reports a missing bundle with build instructions', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'toefl-bundle-'));
  try {
    const indexPath = path.join(directory, 'dist', 'index.html');
    const result = validateProductionBundle({ indexPath });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'missing');
    assert.match(result.message, /npm run electron:dev/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
