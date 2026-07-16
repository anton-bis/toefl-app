import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import {
  RUBRIC_ACADEMIC_DISCUSSION,
  RUBRIC_LISTEN_REPEAT,
  RUBRIC_TAKE_INTERVIEW,
  RUBRIC_WRITE_EMAIL,
  callAI,
  convertTotal05_to_final30_final6_for_speaking,
  convertTotal05_to_final30_final6_for_writing,
  scoreWriteEmail
} from '../../electron/services/ai.js';
import {
  externalContentPath,
  normalizeContentPath,
  resolveContentFile
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

test('reserved AI scoring rubrics retain all four task guides', () => {
  const rubrics = [
    RUBRIC_LISTEN_REPEAT,
    RUBRIC_TAKE_INTERVIEW,
    RUBRIC_WRITE_EMAIL,
    RUBRIC_ACADEMIC_DISCUSSION
  ];
  assert.equal(rubrics.length, 4);
  for (const rubric of rubrics) {
    for (let score = 0; score <= 5; score += 1) assert.match(rubric, new RegExp(`\\n${score}:`));
    assert.match(rubric, /Primary criteria:/);
  }
});

test('AI extension rejects unsafe or misleading behavior while disabled', async () => {
  await assert.rejects(
    callAI('secret', 'prompt', { endpoint: 'https://example.com/chat' }),
    /not allowed/
  );
  await assert.rejects(scoreWriteEmail('secret', 'prompt', 'essay'), /not enabled/);
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
  const contentRoot = path.resolve('tmp/toefl-content');
  assert.equal(
    resolveContentFile(contentRoot, 'reading/TPO-01/test.md'),
    path.join(contentRoot, 'reading/TPO-01/test.md')
  );
  assert.throws(() => resolveContentFile(contentRoot, '../secret.txt'));
});

test('runtime content policy covers packaged and hot-update asset types', () => {
  for (const extension of ['.json', '.md', '.svg', '.ico', '.webp', '.gif', '.mp3', '.mp4']) {
    assert.equal(RUNTIME_CONTENT_EXTENSIONS.has(extension), true, extension);
  }
});
