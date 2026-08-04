import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { DataStorage } from '../../electron/services/database.js';

const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');

const LEGACY_DDL = `
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
`;

async function createLegacyV15Data(directory) {
  const databasePath = path.join(directory, 'toefl-data.sqlite');
  const recordingsPath = path.join(directory, 'recordings');
  const database = new DatabaseSync(databasePath);
  database.exec(LEGACY_DDL);
  database
    .prepare('INSERT INTO settings(key,value,updated_at) VALUES (?,?,?)')
    .run('theme', JSON.stringify({ dark: true }), 1);
  database
    .prepare('INSERT INTO exam_sessions(id,tpo_id,section,status,value,updated_at) VALUES (?,?,?,?,?,?)')
    .run(
      'tpo-01-speaking',
      '01',
      'speaking',
      'completed',
      JSON.stringify({ tpoId: '01', section: 'speaking', status: 'completed', answers: { q1: 'recorded' } }),
      100
    );
  database
    .prepare('INSERT INTO exam_sessions(id,tpo_id,section,status,value,updated_at) VALUES (?,?,?,?,?,?)')
    .run(
      'tpo-01-reading',
      '01',
      'reading',
      'in-progress',
      JSON.stringify({ tpoId: '01', section: 'reading', status: 'in-progress', answers: { r1: 'A' } }),
      90
    );
  database
    .prepare('INSERT INTO recordings(session_id,question_id,relative_path,mime,size,updated_at) VALUES (?,?,?,?,?,?)')
    .run('tpo-01-speaking', 'q1', 'legacy.webm', 'audio/webm', 3, 100);
  database
    .prepare('INSERT INTO vocabulary_progress(subject,set_id,word_id,value,next_review,last_q,updated_at) VALUES (?,?,?,?,?,?,?)')
    .run('reading', 'set-1', 'word-1', JSON.stringify({}), null, 0, 1);
  database
    .prepare('INSERT INTO typing_history(id,article_id,completed_at,value) VALUES (?,?,?,?)')
    .run('t1', 'art-1', '2026-01-01', JSON.stringify({}));
  database.close();
  await fs.mkdir(recordingsPath, { recursive: true });
  await fs.writeFile(path.join(recordingsPath, 'legacy.webm'), Uint8Array.from([1, 2, 3]));
  return { databasePath, recordingsPath };
}

test('phase A acceptance: a v1.5.2 user upgrades, re-practices and keeps every attempt', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'toefl-acceptance-'));
  const { databasePath, recordingsPath } = await createLegacyV15Data(directory);
  const storage = new DataStorage(directory);
  try {
    const boot = await storage.dispatch('bootstrap', {});
    assert.deepEqual(boot.settings.theme, { dark: true });
    assert.equal(boot.storageState, undefined);

    const migratedSpeaking = boot.examSessions.find(
      session => session.tpoId === '01' && session.section === 'speaking'
    );
    assert.equal(migratedSpeaking.status, 'completed');
    assert.equal(migratedSpeaking.answers.q1, 'recorded');
    assert.equal(migratedSpeaking.contentVersionInferred, 1);
    const firstAttemptId = migratedSpeaking.clientAttemptId;
    assert.match(firstAttemptId, /^[0-9A-HJKMNP-TV-Z]{26}$/);

    const migratedReading = boot.examSessions.find(
      session => session.tpoId === '01' && session.section === 'reading'
    );
    assert.equal(migratedReading.status, 'in-progress');
    assert.equal(migratedReading.answers.r1, 'A');

    const migratedRecording = await storage.loadRecording({
      clientAttemptId: firstAttemptId,
      questionKey: 'q1'
    });
    assert.deepEqual([...migratedRecording.bytes], [1, 2, 3]);
    assert.equal(migratedRecording.sha256, sha256(Buffer.from([1, 2, 3])));

    const files = await fs.readdir(recordingsPath);
    assert.equal(files.length, 1);
    assert.match(files[0], /^[a-f0-9]{64}\.webm$/);

    const upgraded = new DatabaseSync(databasePath);
    try {
      const applied = upgraded
        .prepare('SELECT version FROM schema_migrations ORDER BY version')
        .all()
        .map(row => row.version);
      assert.deepEqual(applied, [1, 2]);
      const tables = upgraded
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .all()
        .map(row => row.name);
      assert.ok(!tables.includes('exam_sessions'));
      assert.ok(!tables.includes('recordings'));
      assert.equal(upgraded.prepare('SELECT COUNT(*) AS c FROM vocabulary_progress').get().c, 1);
      assert.equal(upgraded.prepare('SELECT COUNT(*) AS c FROM typing_history').get().c, 1);
    } finally {
      upgraded.close();
    }

    const secondAttemptId = '02ABCDEFGHJKLMNPQRSTVWXYZ';
    await storage.dispatch('exam:save', {
      tpoId: '01',
      section: 'speaking',
      status: 'in-progress',
      clientAttemptId: secondAttemptId,
      documentKey: 'tpo-01-speaking',
      documentHash: 'a'.repeat(64),
      contentSchemaVersion: 1,
      answers: {},
      createdAt: 200,
      updatedAt: 200
    });
    await storage.dispatch('attempt:finalize', {
      session: {
        tpoId: '01',
        section: 'speaking',
        clientAttemptId: secondAttemptId,
        documentKey: 'tpo-01-speaking',
        documentHash: 'a'.repeat(64),
        contentSchemaVersion: 1,
        status: 'completed',
        answers: {},
        completedAt: 300,
        updatedAt: 300
      }
    });
    await storage.dispatch('exam:delete', { id: 'tpo-01-speaking' });

    const attempts = await storage.request('attempt:list');
    assert.equal(attempts.length, 2);
    const secondAttempt = attempts.find(attempt => attempt.clientAttemptId === secondAttemptId);
    assert.equal(secondAttempt.status, 'pending-upload');

    await storage.saveRecording({
      clientAttemptId: secondAttemptId,
      questionKey: 'q1',
      mime: 'audio/webm',
      bytes: Uint8Array.from([9, 9, 9])
    });
    const oldRecording = await storage.loadRecording({
      clientAttemptId: firstAttemptId,
      questionKey: 'q1'
    });
    const freshRecording = await storage.loadRecording({
      clientAttemptId: secondAttemptId,
      questionKey: 'q1'
    });
    assert.deepEqual([...oldRecording.bytes], [1, 2, 3]);
    assert.deepEqual([...freshRecording.bytes], [9, 9, 9]);

    const finalBoot = await storage.dispatch('bootstrap', {});
    assert.equal(
      finalBoot.examSessions.some(
        session =>
          session.tpoId === '01' &&
          session.section === 'speaking' &&
          session.status === 'completed' &&
          session.clientAttemptId === secondAttemptId
      ),
      true
    );
  } finally {
    await storage.close();
    await fs.rm(directory, { recursive: true, force: true });
  }
});
