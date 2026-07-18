import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { normalizeContentPath, resolveContentFile } from '../../electron/services/content-paths.js';
import { RUNTIME_CONTENT_EXTENSIONS } from '../../electron/services/runtime-content.js';

test('content paths normalize relative assets and reject unsafe paths', () => {
  for (const unsafePath of ['../secret.txt', '/etc/passwd', '']) {
    assert.throws(() => normalizeContentPath(unsafePath));
  }
  assert.equal(
    normalizeContentPath('assets\\questions\\reading\\TPO-01\\test.md'),
    'assets/questions/reading/TPO-01/test.md'
  );
  const contentRoot = path.resolve('tmp/toefl-content');
  assert.equal(
    resolveContentFile(contentRoot, 'reading/TPO-01/test.md'),
    path.join(contentRoot, 'reading/TPO-01/test.md')
  );
  assert.throws(() => resolveContentFile(contentRoot, '../secret.txt'));
});

test('runtime content policy covers packaged and hot-update asset types', () => {
  for (const extension of ['.json', '.svg', '.ico', '.webp', '.gif', '.mp3', '.mp4']) {
    assert.equal(RUNTIME_CONTENT_EXTENSIONS.has(extension), true, extension);
  }
  assert.equal(RUNTIME_CONTENT_EXTENSIONS.has('.md'), false);
});
