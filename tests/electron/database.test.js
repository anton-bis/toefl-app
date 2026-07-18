import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { DataStorage } from '../../electron/services/database.js';

async function withStorage(operation, options) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'toefl-data-test-'));
  const storage = new DataStorage(directory, options);
  try {
    await operation(storage, directory);
  } finally {
    await storage.close();
    await fs.rm(directory, { recursive: true, force: true });
  }
}

test('SQLite worker persists structured learning data and restarts after idle', async () => {
  await withStorage(
    async storage => {
      await storage.request('settings:set', { key: 'theme', value: { dark: true } });
      await storage.request('vocabulary:save', {
        subject: 'reading',
        setId: 'set-1',
        wordId: 'word-1',
        value: { nextReview: '2026-07-18', lastQ: 2 }
      });
      await new Promise(resolve => setTimeout(resolve, 40));
      assert.deepEqual((await storage.request('bootstrap')).settings.theme, { dark: true });
      assert.deepEqual((await storage.dispatch('vocabulary:overview', { date: '2026-07-18' })).due, [
        { subject: 'reading', count: 1 }
      ]);
    },
    { idleTimeout: 10 }
  );
});

test('recordings stay outside SQLite and identifiers cannot become paths', async () => {
  await withStorage(async (storage, directory) => {
    const bytes = Uint8Array.from([1, 2, 3, 4]);
    await storage.saveRecording({
      sessionId: 'tpo-01-speaking',
      questionId: 'task-1',
      mime: 'audio/webm',
      bytes
    });
    const stored = await storage.loadRecording({
      sessionId: 'tpo-01-speaking',
      questionId: 'task-1'
    });
    assert.deepEqual([...stored.bytes], [...bytes]);
    assert.equal(stored.mime, 'audio/webm');
    await storage.saveRecording({
      sessionId: 'tpo-01-speaking',
      questionId: 'opus-task',
      mime: 'audio/webm;codecs=opus',
      bytes
    });
    assert.equal(
      (await storage.loadRecording({ sessionId: 'tpo-01-speaking', questionId: 'opus-task' })).mime,
      'audio/webm;codecs=opus'
    );
    await storage.removeRecording({
      sessionId: 'tpo-01-speaking',
      questionId: 'opus-task'
    });
    const playback = await storage.resolveRecordingFile({
      sessionId: 'tpo-01-speaking',
      questionId: 'task-1'
    });
    assert.equal(playback.mime, 'audio/webm');
    assert.equal(path.dirname(playback.filePath), path.join(directory, 'recordings'));
    let files = await fs.readdir(path.join(directory, 'recordings'));
    assert.match(files[0], /^[a-f0-9]{64}\.webm$/);
    await storage.saveRecording({
      sessionId: 'tpo-01-speaking',
      questionId: 'task-1',
      mime: 'audio/ogg',
      bytes: Uint8Array.from([5, 6])
    });
    files = await fs.readdir(path.join(directory, 'recordings'));
    assert.equal(files.length, 1);
    assert.match(files[0], /^[a-f0-9]{64}\.ogg$/);
    await assert.rejects(
      storage.saveRecording({
        sessionId: '../escape',
        questionId: 'task-2',
        mime: 'text/html',
        bytes
      }),
      /Unsupported recording type/
    );
    await storage.removeRecording({ sessionId: 'tpo-01-speaking' });
    assert.equal(
      await storage.loadRecording({ sessionId: 'tpo-01-speaking', questionId: 'task-1' }),
      null
    );
  });
});

test('public dispatch rejects unknown and oversized renderer requests', async () => {
  await withStorage(async storage => {
    await assert.rejects(storage.dispatch('sql', { query: 'DROP TABLE settings' }), /Unsupported/);
    await assert.rejects(
      storage.dispatch('settings:set', { key: 'large', value: 'x'.repeat(2 * 1024 * 1024) }),
      /too large/
    );
    await assert.rejects(
      storage.dispatch('recording:load', { sessionId: '', questionId: '../bad' }),
      /Invalid sessionId/
    );
  });
});

test('v2 SQLite archives round-trip settings, exams and external recordings', async () => {
  await withStorage(async (storage, directory) => {
    await storage.dispatch('settings:set', { key: 'toefl:settings', value: { volume: 0.5 } });
    await storage.dispatch('exam:save', {
      id: 'tpo-01-reading',
      tpoId: '01',
      section: 'reading',
      status: 'completed',
      pageId: 'results',
      value: { tpoId: '01', section: 'reading', status: 'completed' },
      answerChanges: { q1: 'A' },
      removedAnswerIds: []
    });
    await storage.saveRecording({
      sessionId: 'tpo-01-speaking',
      questionId: 'q1',
      mime: 'audio/webm',
      bytes: Uint8Array.from([7, 8, 9])
    });
    const archive = path.join(directory, 'backup.toefldata');
    await storage.exportArchive(archive);
    await storage.importArchive(archive);

    assert.deepEqual((await storage.request('bootstrap')).settings['toefl:settings'], {
      volume: 0.5
    });
    const restored = (await storage.dispatch('bootstrap', {})).examSessions;
    assert.equal(restored.find(session => session.id === 'tpo-01-reading').answers.q1, 'A');
    const recording = await storage.loadRecording({
      sessionId: 'tpo-01-speaking',
      questionId: 'q1'
    });
    assert.deepEqual([...recording.bytes], [7, 8, 9]);
  });
});

test('archives cannot overwrite the live database or recording directory', async () => {
  await withStorage(async (storage, directory) => {
    await assert.rejects(
      storage.exportArchive(path.join(directory, 'toefl-data.sqlite')),
      /overlaps live application data/
    );
    await assert.rejects(
      storage.importArchive(path.join(directory, 'recordings', 'backup.toefldata')),
      /overlaps live application data/
    );
  });
});
