import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { parentPort, workerData } from 'node:worker_threads';
import {
  MIGRATIONS,
  appliedVersions,
  pendingMigrations,
  runMigrations,
  schemaMigrationTable
} from './migrations.js';

const LEGACY_TABLES = {
  settings: ['key', 'value', 'updated_at'],
  exam_sessions: ['id', 'tpo_id', 'section', 'status', 'value', 'updated_at'],
  vocabulary_progress: [
    'subject',
    'set_id',
    'word_id',
    'value',
    'next_review',
    'last_q',
    'updated_at'
  ],
  typing_history: ['id', 'article_id', 'completed_at', 'value'],
  recordings: ['session_id', 'question_id', 'relative_path', 'mime', 'size', 'updated_at']
};
const ARCHIVE_TABLES = {
  archive_metadata: ['key', 'value'],
  archive_rows: ['kind', 'key', 'value'],
  archive_recordings: ['session_id', 'question_id', 'relative_path', 'mime', 'updated_at', 'bytes']
};
const RECORDING_MIME_TYPES = new Set([
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav'
]);

function tableColumns(database, name) {
  return database
    .prepare(`PRAGMA table_info(${name})`)
    .all()
    .map(column => column.name);
}

function hasLegacyStructure(database) {
  return hasStructure(database, LEGACY_TABLES);
}

function hasStructure(database, definition) {
  const tables = database
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    .all()
    .map(({ name }) => name)
    .sort();
  const expected = Object.keys(definition).sort();
  return (
    tables.length === expected.length &&
    tables.every((name, index) => name === expected[index]) &&
    expected.every(name => {
      const actual = tableColumns(database, name);
      return (
        actual.length === definition[name].length &&
        actual.every((column, index) => column === definition[name][index])
      );
    })
  );
}

function hasAnyTables(database) {
  return Boolean(
    database
      .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' LIMIT 1")
      .get()
  );
}

function sqlQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function copyDirectory(source, target) {
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    if (entry.isDirectory()) copyDirectory(sourcePath, targetPath);
    else if (entry.isFile()) fs.copyFileSync(sourcePath, targetPath);
  }
}

function migrationBackupDirectory() {
  return path.join(path.dirname(workerData.databasePath), '.migrations');
}

// Back up the SQLite database and the recordings directory before any
// structural upgrade. A VACUUM INTO snapshot contains every committed row,
// so sqlite/wal/shm are captured consistently in a single file.
function backupStorage(database) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(migrationBackupDirectory(), `backup-${stamp}`);
  fs.mkdirSync(backupDir, { recursive: true });
  database.exec(`VACUUM INTO ${sqlQuote(path.join(backupDir, 'toefl-data.sqlite'))}`);
  if (fs.existsSync(workerData.recordingsPath)) {
    copyDirectory(workerData.recordingsPath, path.join(backupDir, 'recordings'));
  }
  return backupDir;
}

function restoreStorage(database, backupDir) {
  database.close();
  for (const suffix of ['', '-wal', '-shm']) {
    fs.rmSync(`${workerData.databasePath}${suffix}`, { force: true });
  }
  fs.copyFileSync(path.join(backupDir, 'toefl-data.sqlite'), workerData.databasePath);
  fs.rmSync(workerData.recordingsPath, { recursive: true, force: true });
  const recordingsBackup = path.join(backupDir, 'recordings');
  if (fs.existsSync(recordingsBackup)) copyDirectory(recordingsBackup, workerData.recordingsPath);
}

let recoveryBackupDir = null;

function openDatabase() {
  let database = new DatabaseSync(workerData.databasePath);
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
  `);

  const empty = !hasAnyTables(database);
  const legacy = !empty && hasLegacyStructure(database);
  schemaMigrationTable(database);
  const applied = appliedVersions(database);

  let backupDir = null;
  if (!empty && !applied.length && !legacy) {
    // The structure matches neither the legacy schema nor any known
    // migration. Never delete user data: preserve everything in a backup,
    // then start from a fresh v2 database.
    backupDir = backupStorage(database);
    database.close();
    for (const suffix of ['', '-wal', '-shm']) {
      fs.rmSync(`${workerData.databasePath}${suffix}`, { force: true });
    }
    fs.rmSync(workerData.recordingsPath, { recursive: true, force: true });
    database = new DatabaseSync(workerData.databasePath);
    database.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA foreign_keys = ON;
      PRAGMA busy_timeout = 5000;
    `);
    schemaMigrationTable(database);
    recoveryBackupDir = backupDir;
    console.warn(
      `Storage structure was unrecognized. Data preserved in ${backupDir}; started a fresh database.`
    );
  }

  const pending = pendingMigrations(database, MIGRATIONS);
  if (pending.length) {
    const migrationBackup = backupDir || (empty ? null : backupStorage(database));
    try {
      runMigrations(database, { migrations: pending });
    } catch (error) {
      if (migrationBackup) {
        try {
          restoreStorage(database, migrationBackup);
        } catch (restoreError) {
          error.message = `${error.message} Restore of the pre-upgrade backup also failed: ${restoreError.message}`;
        }
      }
      throw error;
    }
  }
  return database;
}

const db = openDatabase();
let databaseClosed = false;

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
      INSERT INTO archive_metadata(key,value) VALUES ('format','toefl-user-data');
    `);
    const insert = archive.prepare('INSERT INTO archive_rows(kind,key,value) VALUES (?,?,?)');
    for (const row of rows('SELECT key,value FROM settings'))
      insert.run('settings', row.key, row.value);
    for (const row of rows('SELECT * FROM exam_sessions'))
      insert.run('exam_sessions', row.id, stringify(row));
    for (const row of rows('SELECT * FROM vocabulary_progress')) {
      insert.run(
        'vocabulary_progress',
        `${row.subject}\0${row.set_id}\0${row.word_id}`,
        stringify(row)
      );
    }
    for (const row of rows('SELECT * FROM typing_history'))
      insert.run('typing_history', row.id, stringify(row));
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

function unsupportedArchive() {
  throw new Error('Unsupported archive structure');
}

function archiveJson(value) {
  if (typeof value !== 'string') unsupportedArchive();
  try {
    return parse(value);
  } catch {
    return unsupportedArchive();
  }
}

function archiveText(value) {
  if (typeof value !== 'string' || !value || value.length > 200) unsupportedArchive();
  return value;
}

function archiveOptionalText(value) {
  if (typeof value !== 'string' || value.length > 200) unsupportedArchive();
  return value;
}

function archiveTimestamp(value) {
  if (!Number.isSafeInteger(value) || value < 0) unsupportedArchive();
  return value;
}

function archiveObject(value) {
  const object = archiveJson(value);
  if (!object || typeof object !== 'object' || Array.isArray(object)) unsupportedArchive();
  return object;
}

function parseArchiveRow(record) {
  archiveText(record.key);
  if (record.kind === 'settings') {
    archiveJson(record.value);
    return record;
  }
  const value = archiveObject(record.value);
  if (record.kind === 'exam_sessions') {
    for (const field of ['id', 'tpo_id', 'section', 'status']) archiveText(value[field]);
    const session = archiveObject(value.value);
    if (
      record.key !== value.id ||
      session.id !== value.id ||
      session.tpoId !== value.tpo_id ||
      session.section !== value.section ||
      session.status !== value.status
    ) {
      unsupportedArchive();
    }
    archiveTimestamp(value.updated_at);
  } else if (record.kind === 'vocabulary_progress') {
    for (const field of ['subject', 'set_id', 'word_id']) archiveText(value[field]);
    archiveObject(value.value);
    if (value.next_review !== null && typeof value.next_review !== 'string') unsupportedArchive();
    if (value.last_q !== null && !Number.isFinite(value.last_q)) unsupportedArchive();
    archiveTimestamp(value.updated_at);
  } else if (record.kind === 'typing_history') {
    archiveText(value.id);
    archiveOptionalText(value.article_id);
    archiveOptionalText(value.completed_at);
    archiveObject(value.value);
    if (record.key !== value.id) unsupportedArchive();
  } else unsupportedArchive();
  return { ...record, value };
}

function readArchive(archive) {
  if (!hasStructure(archive, ARCHIVE_TABLES)) {
    throw new Error('Unsupported archive structure');
  }
  const format = archive.prepare("SELECT value FROM archive_metadata WHERE key='format'").get();
  const metadataCount = archive.prepare('SELECT COUNT(*) AS count FROM archive_metadata').get();
  if (format?.value !== 'toefl-user-data' || metadataCount.count !== 1) unsupportedArchive();
  const dataRows = archive.prepare('SELECT kind,key,value FROM archive_rows').all();
  const recordingRows = archive.prepare('SELECT * FROM archive_recordings').all();
  if (dataRows.length > 20_000 || recordingRows.length > 200) {
    throw new Error('The data archive contains too many records');
  }
  return { dataRows: dataRows.map(parseArchiveRow), recordingRows };
}

function stageRecordings(recordingRows, staging) {
  fs.rmSync(staging, { recursive: true, force: true });
  fs.mkdirSync(staging, { recursive: true, mode: 0o700 });
  for (const recording of recordingRows) {
    archiveText(recording.session_id);
    archiveText(recording.question_id);
    archiveText(recording.mime);
    archiveTimestamp(recording.updated_at);
    archiveText(recording.relative_path);
    if (!RECORDING_MIME_TYPES.has(recording.mime.split(';', 1)[0].toLowerCase())) {
      unsupportedArchive();
    }
    if (path.basename(recording.relative_path) !== recording.relative_path) {
      throw new Error('Invalid recording path in archive');
    }
    if (
      !ArrayBuffer.isView(recording.bytes) ||
      !recording.bytes.byteLength ||
      recording.bytes.byteLength > 50 * 1024 * 1024
    ) {
      throw new Error('Invalid recording in archive');
    }
    fs.writeFileSync(path.join(staging, recording.relative_path), recording.bytes, {
      mode: 0o600
    });
  }
}

function replaceDatabaseRows(dataRows, recordingRows) {
  transaction(() => {
    db.exec(`DELETE FROM exam_sessions; DELETE FROM settings;
      DELETE FROM vocabulary_progress; DELETE FROM typing_history; DELETE FROM recordings;`);
    const statements = {
      settings: db.prepare('INSERT INTO settings(key,value,updated_at) VALUES (?,?,?)'),
      exam_sessions: db.prepare(`INSERT INTO exam_sessions
        (id,tpo_id,section,status,value,updated_at) VALUES (?,?,?,?,?,?)`),
      vocabulary_progress: db.prepare(`INSERT INTO vocabulary_progress
        (subject,set_id,word_id,value,next_review,last_q,updated_at) VALUES (?,?,?,?,?,?,?)`),
      typing_history: db.prepare(`INSERT INTO typing_history
        (id,article_id,completed_at,value) VALUES (?,?,?,?)`)
    };
    for (const record of dataRows) {
      const value = record.value;
      if (record.kind === 'settings') {
        statements.settings.run(record.key, record.value, Date.now());
      } else if (record.kind === 'exam_sessions') {
        statements.exam_sessions.run(
          value.id,
          value.tpo_id,
          value.section,
          value.status,
          value.value,
          value.updated_at
        );
      } else if (record.kind === 'vocabulary_progress') {
        statements.vocabulary_progress.run(
          value.subject,
          value.set_id,
          value.word_id,
          value.value,
          value.next_review,
          value.last_q,
          value.updated_at
        );
      } else {
        statements.typing_history.run(value.id, value.article_id, value.completed_at, value.value);
      }
    }
    const insertRecording = db.prepare(`INSERT INTO recordings
      (session_id,question_id,relative_path,mime,size,updated_at) VALUES (?,?,?,?,?,?)`);
    for (const recording of recordingRows) {
      insertRecording.run(
        recording.session_id,
        recording.question_id,
        recording.relative_path,
        recording.mime,
        recording.bytes.byteLength,
        recording.updated_at
      );
    }
  });
}

function openArchive(archivePath) {
  try {
    return new DatabaseSync(archivePath, { readOnly: true });
  } catch {
    throw new Error('Unsupported archive structure');
  }
}

function removeDirectory(directory) {
  try {
    fs.rmSync(directory, { recursive: true, force: true });
  } catch {
    // Temporary and stale backup cleanup is best effort.
  }
}

function installStagedRecordings(staging, backup) {
  removeDirectory(backup);
  const backupCreated = fs.existsSync(workerData.recordingsPath);
  if (backupCreated) fs.renameSync(workerData.recordingsPath, backup);
  try {
    fs.renameSync(staging, workerData.recordingsPath);
  } catch (error) {
    if (backupCreated) fs.renameSync(backup, workerData.recordingsPath);
    throw error;
  }
  return backupCreated;
}

function restoreRecordings(backup, backupCreated) {
  fs.rmSync(workerData.recordingsPath, { recursive: true, force: true });
  if (backupCreated) fs.renameSync(backup, workerData.recordingsPath);
}

function archiveImportError(error) {
  return /archive|no such table|file is not a database|malformed/i.test(error?.message || '')
    ? new Error('Unsupported archive structure')
    : error;
}

function importArchive(archivePath) {
  const archive = openArchive(archivePath);
  const staging = `${workerData.recordingsPath}.import-${process.pid}`;
  const backup = `${workerData.recordingsPath}.backup-${process.pid}`;
  let backupCreated = false;
  let installed = false;
  try {
    const { dataRows, recordingRows } = readArchive(archive);
    stageRecordings(recordingRows, staging);
    backupCreated = installStagedRecordings(staging, backup);
    installed = true;
    replaceDatabaseRows(dataRows, recordingRows);
    installed = false;
    removeDirectory(backup);
    return true;
  } catch (error) {
    if (installed) restoreRecordings(backup, backupCreated);
    throw archiveImportError(error);
  } finally {
    archive.close();
    removeDirectory(staging);
    if (!installed) removeDirectory(backup);
  }
}

function loadExam(id) {
  const session = db
    .prepare(
      `SELECT id,tpo_id AS tpoId,section,status,
      value,updated_at AS updatedAt FROM exam_sessions WHERE id = ?`
    )
    .get(id);
  if (!session) return null;
  return {
    ...parse(session.value),
    id: session.id,
    tpoId: session.tpoId,
    section: session.section,
    status: session.status,
    updatedAt: session.updatedAt
  };
}

function vocabularyDueSummary(date) {
  return rows(
    `SELECT subject, COUNT(*) AS count FROM vocabulary_progress
      WHERE word_id <> '$set' AND next_review IS NOT NULL AND next_review <= ? AND COALESCE(last_q,0) < 5
      GROUP BY subject`,
    date
  );
}

function getRecording(payload) {
  return (
    db
      .prepare(
        `SELECT session_id AS sessionId,question_id AS questionId,relative_path AS relativePath,
        mime,size,updated_at AS updatedAt FROM recordings WHERE session_id=? AND question_id=?`
      )
      .get(payload.sessionId, payload.questionId) || null
  );
}

const OPERATION_HANDLERS = {
  bootstrap() {
    const sessionIds = rows('SELECT id FROM exam_sessions ORDER BY updated_at DESC');
    return {
      settings: Object.fromEntries(
        rows('SELECT key, value FROM settings').map(row => [row.key, parse(row.value)])
      ),
      examSessions: sessionIds.map(({ id }) => loadExam(id)),
      storageState: recoveryBackupDir
        ? { recoveryBackupDir, structureWasRecovered: true }
        : undefined
    };
  },
  'archive:export'(payload) {
    return exportArchive(payload.archivePath);
  },
  'archive:import'(payload) {
    return importArchive(payload.archivePath);
  },
  'settings:set'(payload) {
    db.prepare(
      `INSERT INTO settings(key, value, updated_at) VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`
    ).run(payload.key, stringify(payload.value), Date.now());
    return true;
  },
  'exam:save'(payload) {
    db.prepare(
      `INSERT INTO exam_sessions(id,tpo_id,section,status,value,updated_at)
        VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET tpo_id=excluded.tpo_id,
        section=excluded.section,status=excluded.status,value=excluded.value,
        updated_at=excluded.updated_at`
    ).run(
      payload.id,
      payload.tpoId,
      payload.section,
      payload.status,
      stringify(payload),
      Number.isFinite(payload.updatedAt) ? payload.updatedAt : Date.now()
    );
    return true;
  },
  'exam:delete'(payload) {
    db.prepare('DELETE FROM exam_sessions WHERE id = ?').run(payload.id);
    return true;
  },
  'exam:listCompleted'(payload) {
    return rows(
      `SELECT id,tpo_id AS tpoId,section,status,updated_at AS updatedAt
        FROM exam_sessions WHERE status='completed' ORDER BY updated_at DESC LIMIT ?`,
      Math.min(500, Math.max(1, Number(payload.limit) || 100))
    );
  },
  'vocabulary:list'(payload) {
    return rows(
      `SELECT subject,set_id AS setId,word_id AS wordId,value
        FROM vocabulary_progress ${payload.subject ? 'WHERE subject = ?' : ''}`,
      ...(payload.subject ? [payload.subject] : [])
    ).map(row => ({ ...row, value: parse(row.value) }));
  },
  'vocabulary:save'(payload) {
    const wordId = payload.wordId || '$set';
    db.prepare(
      `INSERT INTO vocabulary_progress(subject,set_id,word_id,value,next_review,last_q,updated_at)
        VALUES (?,?,?,?,?,?,?) ON CONFLICT(subject,set_id,word_id) DO UPDATE SET value=excluded.value,
        next_review=excluded.next_review,last_q=excluded.last_q,updated_at=excluded.updated_at`
    ).run(
      payload.subject,
      payload.setId,
      wordId,
      stringify(payload.value),
      payload.value?.nextReview || null,
      Number.isFinite(payload.value?.lastQ) ? payload.value.lastQ : null,
      Date.now()
    );
    return true;
  },
  'vocabulary:overview'(payload) {
    return {
      sets: rows(`SELECT subject,set_id AS setId,value FROM vocabulary_progress
        WHERE word_id='$set'`).map(row => ({ ...row, value: parse(row.value) })),
      due: vocabularyDueSummary(payload.date)
    };
  },
  'typing:list'() {
    return rows('SELECT value FROM typing_history ORDER BY completed_at').map(row =>
      parse(row.value)
    );
  },
  'typing:replace'(payload) {
    return transaction(() => {
      db.exec('DELETE FROM typing_history');
      const statement = db.prepare(
        'INSERT INTO typing_history(id,article_id,completed_at,value) VALUES (?,?,?,?)'
      );
      payload.history
        .slice(-100)
        .forEach((value, index) =>
          statement.run(
            `${value.completedAt || ''}:${value.articleId || ''}:${index}`,
            value.articleId || '',
            value.completedAt || '',
            stringify(value)
          )
        );
      return true;
    });
  },
  'recording:upsert'(payload) {
    db.prepare(
      `INSERT INTO recordings(session_id,question_id,relative_path,mime,size,updated_at)
        VALUES (?,?,?,?,?,?) ON CONFLICT(session_id,question_id) DO UPDATE SET relative_path=excluded.relative_path,
        mime=excluded.mime,size=excluded.size,updated_at=excluded.updated_at`
    ).run(
      payload.sessionId,
      payload.questionId,
      payload.relativePath,
      payload.mime,
      payload.size,
      payload.updatedAt
    );
    return true;
  },
  'recording:get': getRecording,
  'recording:delete'(payload) {
    const record = getRecording(payload);
    db.prepare('DELETE FROM recordings WHERE session_id=? AND question_id=?').run(
      payload.sessionId,
      payload.questionId
    );
    return record ? [record] : [];
  },
  'recording:deleteSession'(payload) {
    const records = rows(
      'SELECT relative_path AS relativePath FROM recordings WHERE session_id=?',
      payload.sessionId
    );
    db.prepare('DELETE FROM recordings WHERE session_id=?').run(payload.sessionId);
    return records;
  }
};

function execute(operation, payload) {
  if (!Object.hasOwn(OPERATION_HANDLERS, operation)) {
    throw new Error('Unsupported data storage operation');
  }
  return OPERATION_HANDLERS[operation](payload);
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
    parentPort.postMessage({
      id,
      ok: false,
      error: error?.message || 'Data storage request failed'
    });
  }
});

process.on('exit', () => {
  if (!databaseClosed) db.close();
});
