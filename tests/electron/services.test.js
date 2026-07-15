import assert from 'node:assert/strict';
import test from 'node:test';
import {
  callAI,
  convertTotal05_to_final30_final6_for_speaking,
  convertTotal05_to_final30_final6_for_writing,
  scoreWriteEmail
} from '../../electron/services/ai.js';
import {
  externalContentPath,
  normalizeContentPath
} from '../../electron/services/content-paths.js';
import { RUNTIME_CONTENT_EXTENSIONS } from '../../electron/services/runtime-content.js';

test('reserved score conversions preserve boundary values', () => {
  assert.deepEqual(convertTotal05_to_final30_final6_for_speaking(0), {
    final30_speaking: 0,
    final6_speaking: 0
  });
  assert.deepEqual(convertTotal05_to_final30_final6_for_writing(5), {
    final30_writing: 30,
    final6_writing: 6
  });
});

test('AI extension rejects unsafe or misleading behavior while disabled', async () => {
  await assert.rejects(
    callAI('secret', 'prompt', { endpoint: 'https://example.com/chat' }),
    /不在允许列表/
  );
  await assert.rejects(scoreWriteEmail('secret', 'prompt', 'essay'), /尚未启用/);
});

test('content paths normalize relative assets and reject unsafe paths', () => {
  for (const unsafePath of ['../secret.txt', '/etc/passwd', '']) {
    assert.throws(() => normalizeContentPath(unsafePath));
  }
  assert.equal(
    normalizeContentPath('assets\\questions\\reading\\TPO-01\\test.md'),
    'assets/questions/reading/TPO-01/test.md'
  );
  assert.equal(
    externalContentPath('assets/questions/speaking/TPO-03/speaking-TPO-03.md'),
    'speaking/TPO-03/speaking-TPO-03.md'
  );
  assert.equal(
    externalContentPath('assets/audio/vocab/example_us.mp3'),
    'assets/audio/vocab/example_us.mp3'
  );
});

test('runtime content policy covers packaged and hot-update asset types', () => {
  for (const extension of ['.json', '.md', '.svg', '.ico', '.webp', '.gif', '.mp3', '.mp4']) {
    assert.equal(RUNTIME_CONTENT_EXTENSIONS.has(extension), true, extension);
  }
});
