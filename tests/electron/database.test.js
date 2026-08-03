import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { DataStorage } from '../../electron/services/database.js';
import {
  appliedVersions,
  applyMigration,
  migrationChecksum,
  schemaMigrationTable
} from '../../electron/services/migrations.js';

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
      assert.deepEqual(
        (await storage.dispatch('vocabulary:overview', { date: '2026-07-18' })).due,
        [{ subject: 'reading', count: 1 }]
      );
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

test('SQLite archives round-trip settings, complete exam sessions and external recordings', async () => {
  await withStorage(async (storage, directory) => {
    await storage.dispatch('settings:set', { key: 'toefl:settings', value: { volume: 0.5 } });
    await storage.dispatch('exam:save', {
      id: 'tpo-01-reading',
      tpoId: '01',
      section: 'reading',
      status: 'completed',
      pageId: 'results',
      answers: { q1: 'A' },
      marks: {},
      updatedAt: 123
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

test('saving an exam replaces the complete session snapshot', async () => {
  await withStorage(async storage => {
    const session = {
      id: 'tpo-01-reading',
      tpoId: '01',
      section: 'reading',
      status: 'in-progress',
      pageId: 'question-1',
      answers: { q1: 'A', q2: 'B' },
      updatedAt: 100
    };
    await storage.dispatch('exam:save', session);
    await storage.dispatch('exam:save', {
      ...session,
      pageId: 'question-2',
      answers: { q2: 'C' },
      updatedAt: 200
    });

    const [restored] = (await storage.dispatch('bootstrap', {})).examSessions;
    assert.equal(restored.pageId, 'question-2');
    assert.deepEqual(restored.answers, { q2: 'C' });
    assert.equal(restored.updatedAt, 200);
  });
});

test('drafts persist into active_exam_sessions with a stable client attempt id', async () => {
  await withStorage(async storage => {
    await storage.dispatch('exam:save', {
      tpoId: '01',
      section: 'reading',
      status: 'in-progress',
      clientAttemptId: '01ABCDEFGHJKLMNPQRSTVWXYZ',
      documentKey: 'tpo-01-reading',
      documentHash: 'a'.repeat(64),
      contentManifestId: 'b'.repeat(64),
      contentSchemaVersion: 1,
      pageId: 'question-1',
      answers: { q1: 'A' },
      createdAt: 90,
      updatedAt: 100
    });
    let boot = await storage.dispatch('bootstrap', {});
    const draft = boot.examSessions.find(session => session.tpoId === '01' && session.section === 'reading');
    assert.equal(draft.status, 'in-progress');
    assert.equal(draft.clientAttemptId, '01ABCDEFGHJKLMNPQRSTVWXYZ');
    assert.equal(draft.answers.q1, 'A');
    assert.equal(draft.documentHash, 'a'.repeat(64));
    assert.equal(draft.contentManifestId, 'b'.repeat(64));
    assert.equal(draft.contentSchemaVersion, 1);

    await storage.dispatch('exam:save', {
      ...draft,
      pageId: 'question-2',
      answers: { q2: 'C' },
      updatedAt: 200
    });
    boot = await storage.dispatch('bootstrap', {});
    const updated = boot.examSessions.find(
      session => session.tpoId === '01' && session.section === 'reading'
    );
    assert.equal(updated.clientAttemptId, '01ABCDEFGHJKLMNPQRSTVWXYZ');
    assert.equal(updated.pageId, 'question-2');
    assert.deepEqual(updated.answers, { q2: 'C' });

    await storage.dispatch('exam:delete', { id: 'tpo-01-reading' });
    boot = await storage.dispatch('bootstrap', {});
    assert.equal(
      boot.examSessions.some(session => session.tpoId === '01' && session.section === 'reading'),
      false
    );
  });
});

test('completed sessions stay visible until finalized into pending_attempts', async () => {
  await withStorage(async storage => {
    await storage.dispatch('exam:save', {
      id: 'tpo-01-speaking',
      tpoId: '01',
      section: 'speaking',
      status: 'completed',
      clientAttemptId: '01XZZZZZZZZZZZZZZZZZZZZZZZ',
      answers: { q1: 'recorded' },
      updatedAt: 300
    });
    const boot = await storage.dispatch('bootstrap', {});
    const session = boot.examSessions.find(
      value => value.tpoId === '01' && value.section === 'speaking'
    );
    assert.equal(session.status, 'completed');
    assert.equal(session.clientAttemptId, '01XZZZZZZZZZZZZZZZZZZZZZZZ');
    assert.equal((await storage.dispatch('exam:listCompleted', { limit: 100 })).length, 1);
  });
});

test('a legacy v1 database is upgraded in place without losing data', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'toefl-data-test-'));
  const databasePath = path.join(directory, 'toefl-data.sqlite');
  const recordingsPath = path.join(directory, 'recordings');
  const database = new DatabaseSync(databasePath);
  database.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL) STRICT;
    CREATE TABLE exam_sessions (id TEXT PRIMARY KEY, tpo_id TEXT NOT NULL, section TEXT NOT NULL,
      status TEXT NOT NULL, value TEXT NOT NULL, updated_at INTEGER NOT NULL) STRICT;
    CREATE TABLE vocabulary_progress (subject TEXT NOT NULL, set_id TEXT NOT NULL, word_id TEXT NOT NULL,
      value TEXT NOT NULL, next_review TEXT, last_q INTEGER, updated_at INTEGER NOT NULL,
      PRIMARY KEY(subject,set_id,word_id)) STRICT;
    CREATE TABLE typing_history (id TEXT PRIMARY KEY, article_id TEXT NOT NULL, completed_at TEXT NOT NULL,
      value TEXT NOT NULL) STRICT;
    CREATE TABLE recordings (session_id TEXT NOT NULL, question_id TEXT NOT NULL,
      relative_path TEXT NOT NULL UNIQUE, mime TEXT NOT NULL, size INTEGER NOT NULL,
      updated_at INTEGER NOT NULL, PRIMARY KEY(session_id,question_id)) STRICT;
    INSERT INTO settings(key,value,updated_at) VALUES ('theme','{"dark":true}',1);
    INSERT INTO exam_sessions(id,tpo_id,section,status,value,updated_at) VALUES
      ('tpo-01-reading','01','reading','completed','{"tpoId":"01","section":"reading","status":"completed","answers":{"q1":"A"}}',2);
  `);
  database.close();
  await fs.mkdir(recordingsPath);
  await fs.writeFile(path.join(recordingsPath, 'abc.webm'), Uint8Array.from([1, 2, 3]));

  const storage = new DataStorage(directory);
  try {
    const boot = await storage.dispatch('bootstrap', {});
    assert.deepEqual(boot.settings.theme, { dark: true });
    assert.equal(boot.examSessions.find(session => session.id === 'tpo-01-reading').answers.q1, 'A');
    assert.equal(boot.storageState, undefined);

    const recording = await storage.loadRecording({
      sessionId: 'tpo-01-speaking',
      questionId: 'q1'
    });
    assert.equal(recording, null);
    await storage.saveRecording({
      sessionId: 'tpo-01-speaking',
      questionId: 'q1',
      mime: 'audio/webm',
      bytes: Uint8Array.from([9, 9])
    });
    assert.equal(
      [...(await storage.loadRecording({ sessionId: 'tpo-01-speaking', questionId: 'q1' })).bytes]
        .join(','),
      '9,9'
    );

    const migrated = new DatabaseSync(databasePath);
    try {
      const applied = migrated
        .prepare('SELECT version FROM schema_migrations ORDER BY version')
        .all()
        .map(row => row.version);
      assert.deepEqual(applied, [1]);
      const tables = migrated
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .all()
        .map(row => row.name);
      for (const expected of [
        'active_exam_sessions',
        'pending_attempts',
        'recordings_v2',
        'sync_queue',
        'content_installations'
      ]) {
        assert.ok(tables.includes(expected), `expected v2 table ${expected}`);
      }
      assert.equal(
        migrated.prepare('SELECT value FROM settings WHERE key=?').get('theme').value,
        '{"dark":true}'
      );
    } finally {
      migrated.close();
    }
  } finally {
    await storage.close();
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test('an unrecognized database is backed up and replaced with a fresh one', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'toefl-data-test-'));
  const databasePath = path.join(directory, 'toefl-data.sqlite');
  const recordingsPath = path.join(directory, 'recordings');
  const database = new DatabaseSync(databasePath);
  database.exec('CREATE TABLE unrelated(value TEXT)');
  database.close();
  await fs.mkdir(recordingsPath);
  await fs.writeFile(path.join(recordingsPath, 'kept.webm'), Uint8Array.from([7]));

  const storage = new DataStorage(directory);
  try {
    const boot = await storage.dispatch('bootstrap', {});
    assert.deepEqual(boot.settings, {});
    assert.deepEqual(boot.examSessions, []);
    assert.ok(boot.storageState?.recoveryBackupDir);
    assert.equal(boot.storageState.structureWasRecovered, true);

    const backups = await fs.readdir(path.join(directory, '.migrations'));
    assert.equal(backups.length, 1);
    const backupDir = path.join(directory, '.migrations', backups[0]);
    await assert.doesNotReject(fs.stat(path.join(backupDir, 'toefl-data.sqlite')));
    await assert.doesNotReject(fs.stat(path.join(backupDir, 'recordings', 'kept.webm')));

    const fresh = new DatabaseSync(databasePath);
    try {
      const tables = fresh
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .all()
        .map(row => row.name);
      assert.ok(!tables.includes('unrelated'));
      assert.ok(tables.includes('pending_attempts'));
    } finally {
      fresh.close();
    }
  } finally {
    await storage.close();
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test('migration records stay stable and a failed migration rolls back atomically', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'toefl-data-test-'));
  const databasePath = path.join(directory, 'migration.sqlite');
  const database = new DatabaseSync(databasePath);
  schemaMigrationTable(database);

  const good = {
    version: 2,
    name: 'test-migration',
    up(db) {
      db.exec('CREATE TABLE created_by_migration(value TEXT) STRICT;');
    }
  };
  applyMigration(database, good);
  assert.deepEqual(appliedVersions(database), [2]);
  assert.equal(
    migrationChecksum(good),
    migrationChecksum({ version: 2, name: 'test-migration', up: good.up })
  );
  assert.ok(!migrationChecksum(good).includes('other'));

  const bad = {
    version: 3,
    name: 'test-failing',
    up(db) {
      db.exec('CREATE TABLE partial_change(value TEXT) STRICT;');
      throw new Error('boom');
    }
  };
  assert.throws(() => applyMigration(database, bad), /boom/);
  assert.deepEqual(appliedVersions(database), [2]);
  const tables = database
    .prepare("SELECT name FROM sqlite_master WHERE type='table'")
    .all()
    .map(row => row.name);
  assert.ok(!tables.includes('partial_change'));

  database.close();
  await fs.rm(directory, { recursive: true, force: true });
});

test('archives with an unsupported structure are rejected', async () => {
  await withStorage(async (storage, directory) => {
    const archivePath = path.join(directory, 'invalid.toefldata');
    const archive = new DatabaseSync(archivePath);
    archive.exec('CREATE TABLE unrelated(value TEXT)');
    archive.close();
    await assert.rejects(storage.importArchive(archivePath), /Unsupported archive structure/);
  });
});

test('archives with invalid records are rejected before live data changes', async () => {
  await withStorage(async (storage, directory) => {
    await storage.dispatch('settings:set', { key: 'theme', value: 'before-export' });
    const archivePath = path.join(directory, 'invalid-record.toefldata');
    await storage.exportArchive(archivePath);
    const archive = new DatabaseSync(archivePath);
    archive
      .prepare('INSERT INTO archive_rows(kind,key,value) VALUES (?,?,?)')
      .run('unknown', 'bad', '{}');
    archive.close();
    await storage.dispatch('settings:set', { key: 'theme', value: 'current' });

    await assert.rejects(storage.importArchive(archivePath), /Unsupported archive structure/);
    assert.equal((await storage.dispatch('bootstrap', {})).settings.theme, 'current');
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
