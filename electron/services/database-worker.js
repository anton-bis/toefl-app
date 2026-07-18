import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { parentPort, workerData } from 'node:worker_threads';

const db = new DatabaseSync(workerData.databasePath);
let databaseClosed = false;
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA foreign_keys = ON;
  PRAGMA busy_timeout = 5000;
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  ) STRICT;
  CREATE TABLE IF NOT EXISTS exam_sessions (
    id TEXT PRIMARY KEY,
    tpo_id TEXT NOT NULL,
    section TEXT NOT NULL,
    status TEXT NOT NULL,
    page_id TEXT,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  ) STRICT;
  CREATE INDEX IF NOT EXISTS exam_sessions_status_date
    ON exam_sessions(status, updated_at DESC);
  CREATE TABLE IF NOT EXISTS exam_answers (
    session_id TEXT NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
    question_id TEXT NOT NULL,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY(session_id, question_id)
  ) STRICT;
  CREATE TABLE IF NOT EXISTS vocabulary_progress (
    subject TEXT NOT NULL,
    set_id TEXT NOT NULL,
    word_id TEXT NOT NULL,
    value TEXT NOT NULL,
    next_review TEXT,
    last_q INTEGER,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY(subject, set_id, word_id)
  ) STRICT;
  CREATE INDEX IF NOT EXISTS vocabulary_due
    ON vocabulary_progress(subject, next_review, last_q);
  CREATE TABLE IF NOT EXISTS typing_history (
    id TEXT PRIMARY KEY,
    article_id TEXT NOT NULL,
    completed_at TEXT NOT NULL,
    value TEXT NOT NULL
  ) STRICT;
  CREATE INDEX IF NOT EXISTS typing_history_date ON typing_history(completed_at DESC);
  CREATE TABLE IF NOT EXISTS recordings (
    session_id TEXT NOT NULL,
    question_id TEXT NOT NULL,
    relative_path TEXT NOT NULL UNIQUE,
    mime TEXT NOT NULL,
    size INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY(session_id, question_id)
  ) STRICT;
`);

const parse = value => JSON.parse(value);
const stringify = value => JSON.stringify(value ?? null);
const rows = (sql, ...params) => db.prepare(sql).all(...params);
const transaction = operation => {
  db.exec('BEGIN IMMEDIATE');
  try {
    const value = operation();
    db.exec('COMMIT');
    return value;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
};

function exportArchive(archivePath) {
  const archive = new DatabaseSync(archivePath);
  try {
    archive.exec(`
      PRAGMA journal_mode = DELETE;
      CREATE TABLE archive_metadata(key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT;
      CREATE TABLE archive_rows(kind TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL,
        PRIMARY KEY(kind,key)) STRICT;
      CREATE TABLE archive_recordings(session_id TEXT NOT NULL, question_id TEXT NOT NULL,
        relative_path TEXT NOT NULL, mime TEXT NOT NULL, updated_at INTEGER NOT NULL,
        bytes BLOB NOT NULL, PRIMARY KEY(session_id,question_id)) STRICT;
      INSERT INTO archive_metadata(key,value) VALUES ('format','toefl-user-data-v2');
    `);
    const insert = archive.prepare('INSERT INTO archive_rows(kind,key,value) VALUES (?,?,?)');
    for (const row of rows('SELECT key,value FROM settings')) insert.run('settings', row.key, row.value);
    for (const row of rows('SELECT * FROM exam_sessions')) insert.run('exam_sessions', row.id, stringify(row));
    for (const row of rows('SELECT * FROM exam_answers')) {
      insert.run('exam_answers', `${row.session_id}\0${row.question_id}`, stringify(row));
    }
    for (const row of rows('SELECT * FROM vocabulary_progress')) {
      insert.run('vocabulary_progress', `${row.subject}\0${row.set_id}\0${row.word_id}`, stringify(row));
    }
    for (const row of rows('SELECT * FROM typing_history')) insert.run('typing_history', row.id, stringify(row));
    const insertRecording = archive.prepare(`INSERT INTO archive_recordings
      (session_id,question_id,relative_path,mime,updated_at,bytes) VALUES (?,?,?,?,?,?)`);
    for (const row of rows('SELECT * FROM recordings')) {
      const filePath = path.join(workerData.recordingsPath, path.basename(row.relative_path));
      if (!fs.existsSync(filePath)) continue;
      insertRecording.run(
        row.session_id,
        row.question_id,
        row.relative_path,
        row.mime,
        row.updated_at,
        fs.readFileSync(filePath)
      );
    }
    return true;
  } finally {
    archive.close();
  }
}

function importArchive(archivePath) {
  const archive = new DatabaseSync(archivePath, { readOnly: true });
  const staging = `${workerData.recordingsPath}.import-${process.pid}`;
  const backup = `${workerData.recordingsPath}.backup-${process.pid}`;
  let swapped = false;
  try {
    const format = archive.prepare('SELECT value FROM archive_metadata WHERE key=\'format\'').get();
    if (format?.value !== 'toefl-user-data-v2') throw new Error('Unsupported data archive');
    const dataRows = archive.prepare('SELECT kind,key,value FROM archive_rows').all();
    const recordingRows = archive.prepare('SELECT * FROM archive_recordings').all();
    if (dataRows.length > 20_000 || recordingRows.length > 200) {
      throw new Error('The data archive contains too many records');
    }
    fs.rmSync(staging, { recursive: true, force: true });
    fs.mkdirSync(staging, { recursive: true, mode: 0o700 });
    for (const recording of recordingRows) {
      if (path.basename(recording.relative_path) !== recording.relative_path) {
        throw new Error('Invalid recording path in archive');
      }
      if (!ArrayBuffer.isView(recording.bytes) || recording.bytes.byteLength > 50 * 1024 * 1024) {
        throw new Error('Invalid recording in archive');
      }
      fs.writeFileSync(path.join(staging, recording.relative_path), recording.bytes, { mode: 0o600 });
    }
    try {
      fs.rmSync(backup, { recursive: true, force: true });
    } catch {
      // The imported database is already committed; stale backup cleanup is best effort.
    }
    if (fs.existsSync(workerData.recordingsPath)) fs.renameSync(workerData.recordingsPath, backup);
    fs.renameSync(staging, workerData.recordingsPath);
    swapped = true;
    transaction(() => {
      db.exec(`DELETE FROM exam_answers; DELETE FROM exam_sessions; DELETE FROM settings;
        DELETE FROM vocabulary_progress; DELETE FROM typing_history; DELETE FROM recordings;`);
      const statements = {
        settings: db.prepare('INSERT INTO settings(key,value,updated_at) VALUES (?,?,?)'),
        exam_sessions: db.prepare(`INSERT INTO exam_sessions
          (id,tpo_id,section,status,page_id,value,updated_at) VALUES (?,?,?,?,?,?,?)`),
        exam_answers: db.prepare(`INSERT INTO exam_answers
          (session_id,question_id,value,updated_at) VALUES (?,?,?,?)`),
        vocabulary_progress: db.prepare(`INSERT INTO vocabulary_progress
          (subject,set_id,word_id,value,next_review,last_q,updated_at) VALUES (?,?,?,?,?,?,?)`),
        typing_history: db.prepare(`INSERT INTO typing_history
          (id,article_id,completed_at,value) VALUES (?,?,?,?)`)
      };
      for (const record of dataRows) {
        const value = parse(record.value);
        if (record.kind === 'settings') statements.settings.run(record.key, record.value, Date.now());
        else if (record.kind === 'exam_sessions') statements.exam_sessions.run(
          value.id, value.tpo_id, value.section, value.status, value.page_id, value.value, value.updated_at
        );
        else if (record.kind === 'exam_answers') statements.exam_answers.run(
          value.session_id, value.question_id, value.value, value.updated_at
        );
        else if (record.kind === 'vocabulary_progress') statements.vocabulary_progress.run(
          value.subject, value.set_id, value.word_id, value.value, value.next_review, value.last_q,
          value.updated_at
        );
        else if (record.kind === 'typing_history') statements.typing_history.run(
          value.id, value.article_id, value.completed_at, value.value
        );
        else throw new Error('Unsupported record in data archive');
      }
      const insertRecording = db.prepare(`INSERT INTO recordings
        (session_id,question_id,relative_path,mime,size,updated_at) VALUES (?,?,?,?,?,?)`);
      for (const recording of recordingRows) insertRecording.run(
        recording.session_id,
        recording.question_id,
        recording.relative_path,
        recording.mime,
        recording.bytes.byteLength,
        recording.updated_at
      );
    });
    swapped = false;
    try {
      fs.rmSync(backup, { recursive: true, force: true });
    } catch {
      // The imported database and recording directory are already committed.
    }
    return true;
  } catch (error) {
    if (swapped) {
      fs.rmSync(workerData.recordingsPath, { recursive: true, force: true });
      if (fs.existsSync(backup)) fs.renameSync(backup, workerData.recordingsPath);
    }
    throw error;
  } finally {
    archive.close();
    try {
      fs.rmSync(staging, { recursive: true, force: true });
    } catch {
      // Temporary directory cleanup is best effort.
    }
    if (!swapped) {
      try {
        fs.rmSync(backup, { recursive: true, force: true });
      } catch {
        // A committed import must not fail because stale backup cleanup failed.
      }
    }
  }
}

function loadExam(id) {
  const session = db.prepare(`SELECT id,tpo_id AS tpoId,section,status,page_id AS pageId,
      value,updated_at AS updatedAt FROM exam_sessions WHERE id = ?`).get(id);
  if (!session) return null;
  const value = {
    ...parse(session.value),
    id: session.id,
    tpoId: session.tpoId,
    section: session.section,
    status: session.status,
    pageId: session.pageId,
    updatedAt: session.updatedAt
  };
  value.answers = Object.fromEntries(
    rows('SELECT question_id, value FROM exam_answers WHERE session_id = ?', id)
      .map(row => [row.question_id, parse(row.value)])
  );
  return value;
}

function vocabularyDueSummary(date) {
  return rows(`SELECT subject, COUNT(*) AS count FROM vocabulary_progress
      WHERE word_id <> '$set' AND next_review IS NOT NULL AND next_review <= ? AND COALESCE(last_q,0) < 5
      GROUP BY subject`, date);
}

function execute(operation, payload) {
  switch (operation) {
  case 'bootstrap':
  {
    const sessionIds = rows('SELECT id FROM exam_sessions ORDER BY updated_at DESC');
    return {
      settings: Object.fromEntries(rows('SELECT key, value FROM settings').map(row => [row.key, parse(row.value)])),
      examSessions: sessionIds.map(({ id }) => loadExam(id))
    };
  }
  case 'archive:export':
    return exportArchive(payload.archivePath);
  case 'archive:import':
    return importArchive(payload.archivePath);
  case 'settings:set':
    db.prepare(`INSERT INTO settings(key, value, updated_at) VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`)
      .run(payload.key, stringify(payload.value), Date.now());
    return true;
  case 'exam:save':
    return transaction(() => {
      db.prepare(`INSERT INTO exam_sessions(id,tpo_id,section,status,page_id,value,updated_at)
          VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,
          page_id=excluded.page_id,value=excluded.value,updated_at=excluded.updated_at`)
        .run(
          payload.id,
          payload.tpoId,
          payload.section,
          payload.status,
          payload.pageId || null,
          stringify(payload.value),
          Date.now()
        );
      const statement = db.prepare(`INSERT INTO exam_answers(session_id,question_id,value,updated_at)
          VALUES (?,?,?,?) ON CONFLICT(session_id,question_id) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at`);
      for (const [questionId, answer] of Object.entries(payload.answerChanges || {})) {
        statement.run(payload.id, questionId, stringify(answer), Date.now());
      }
      const remove = db.prepare('DELETE FROM exam_answers WHERE session_id=? AND question_id=?');
      for (const questionId of payload.removedAnswerIds || []) remove.run(payload.id, questionId);
      return true;
    });
  case 'exam:delete':
    db.prepare('DELETE FROM exam_sessions WHERE id = ?').run(payload.id);
    return true;
  case 'exam:listCompleted':
    return rows(`SELECT id,tpo_id AS tpoId,section,status,updated_at AS updatedAt
        FROM exam_sessions WHERE status='completed' ORDER BY updated_at DESC LIMIT ?`,
    Math.min(500, Math.max(1, Number(payload.limit) || 100)));
  case 'vocabulary:list':
    return rows(`SELECT subject,set_id AS setId,word_id AS wordId,value
        FROM vocabulary_progress ${payload.subject ? 'WHERE subject = ?' : ''}`,
    ...(payload.subject ? [payload.subject] : [])).map(row => ({ ...row, value: parse(row.value) }));
  case 'vocabulary:save': {
    const wordId = payload.wordId || '$set';
    db.prepare(`INSERT INTO vocabulary_progress(subject,set_id,word_id,value,next_review,last_q,updated_at)
        VALUES (?,?,?,?,?,?,?) ON CONFLICT(subject,set_id,word_id) DO UPDATE SET value=excluded.value,
        next_review=excluded.next_review,last_q=excluded.last_q,updated_at=excluded.updated_at`)
      .run(payload.subject, payload.setId, wordId, stringify(payload.value), payload.value?.nextReview || null,
        Number.isFinite(payload.value?.lastQ) ? payload.value.lastQ : null, Date.now());
    return true;
  }
  case 'vocabulary:overview':
    return {
      sets: rows(`SELECT subject,set_id AS setId,value FROM vocabulary_progress
        WHERE word_id='$set'`).map(row => ({ ...row, value: parse(row.value) })),
      due: vocabularyDueSummary(payload.date)
    };
  case 'typing:list':
    return rows('SELECT value FROM typing_history ORDER BY completed_at').map(row => parse(row.value));
  case 'typing:replace':
    return transaction(() => {
      db.exec('DELETE FROM typing_history');
      const statement = db.prepare('INSERT INTO typing_history(id,article_id,completed_at,value) VALUES (?,?,?,?)');
      payload.history.slice(-100).forEach((value, index) =>
        statement.run(`${value.completedAt || ''}:${value.articleId || ''}:${index}`, value.articleId || '', value.completedAt || '', stringify(value))
      );
      return true;
    });
  case 'recording:upsert':
    db.prepare(`INSERT INTO recordings(session_id,question_id,relative_path,mime,size,updated_at)
        VALUES (?,?,?,?,?,?) ON CONFLICT(session_id,question_id) DO UPDATE SET relative_path=excluded.relative_path,
        mime=excluded.mime,size=excluded.size,updated_at=excluded.updated_at`)
      .run(payload.sessionId, payload.questionId, payload.relativePath, payload.mime, payload.size, payload.updatedAt);
    return true;
  case 'recording:get':
    return db.prepare(`SELECT session_id AS sessionId,question_id AS questionId,relative_path AS relativePath,
        mime,size,updated_at AS updatedAt FROM recordings WHERE session_id=? AND question_id=?`)
      .get(payload.sessionId, payload.questionId) || null;
  case 'recording:delete': {
    const record = execute('recording:get', payload);
    db.prepare('DELETE FROM recordings WHERE session_id=? AND question_id=?').run(payload.sessionId, payload.questionId);
    return record ? [record] : [];
  }
  case 'recording:deleteSession': {
    const records = rows('SELECT relative_path AS relativePath FROM recordings WHERE session_id=?', payload.sessionId);
    db.prepare('DELETE FROM recordings WHERE session_id=?').run(payload.sessionId);
    return records;
  }
  default:
    throw new Error('Unsupported data storage operation');
  }
}

parentPort.on('message', ({ id, operation, payload }) => {
  try {
    if (operation === 'close') {
      db.close();
      databaseClosed = true;
      parentPort.postMessage({ id, ok: true, value: true });
      parentPort.close();
      return;
    }
    parentPort.postMessage({ id, ok: true, value: execute(operation, payload || {}) });
  } catch (error) {
    parentPort.postMessage({ id, ok: false, error: error?.message || 'Data storage request failed' });
  }
});

process.on('exit', () => {
  if (!databaseClosed) db.close();
});
