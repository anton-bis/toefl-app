import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createClientAttemptId } from './attempt-id.js';

const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');

const MIME_EXTENSIONS = new Map([
  ['audio/webm', '.webm'],
  ['audio/ogg', '.ogg'],
  ['audio/mp4', '.m4a'],
  ['audio/mpeg', '.mp3'],
  ['audio/wav', '.wav']
]);

function tableExists(db, name) {
  return Boolean(
    db
      .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name = ?")
      .get(name)
  );
}

function recordingExtension(mime) {
  const base = String(mime || '').split(';', 1)[0].trim().toLowerCase();
  return MIME_EXTENSIONS.get(base) || '';
}

function jsonOrDefault(value) {
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

export const MIGRATIONS = [
  {
    version: 1,
    name: 'create-v2-storage-tables',
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        ) STRICT;

        -- Legacy v1 tables are kept alongside the v2 model until the storage
        -- handlers finish migrating to active_exam_sessions / recordings_v2.
        CREATE TABLE IF NOT EXISTS exam_sessions (
          id TEXT PRIMARY KEY,
          tpo_id TEXT NOT NULL,
          section TEXT NOT NULL,
          status TEXT NOT NULL,
          value TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        ) STRICT;

        CREATE INDEX IF NOT EXISTS exam_sessions_status_date
          ON exam_sessions(status, updated_at DESC);

        CREATE TABLE IF NOT EXISTS recordings (
          session_id TEXT NOT NULL,
          question_id TEXT NOT NULL,
          relative_path TEXT NOT NULL UNIQUE,
          mime TEXT NOT NULL,
          size INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          PRIMARY KEY(session_id, question_id)
        ) STRICT;

        CREATE TABLE IF NOT EXISTS active_exam_sessions (
          session_key TEXT PRIMARY KEY,
          client_attempt_id TEXT NOT NULL UNIQUE,
          tpo_id TEXT NOT NULL,
          section TEXT NOT NULL,
          document_key TEXT NOT NULL,
          document_hash TEXT,
          content_manifest_id TEXT,
          content_schema_version INTEGER,
          content_version_inferred INTEGER NOT NULL DEFAULT 0
            CHECK(content_version_inferred IN (0,1)),
          status TEXT NOT NULL CHECK(status IN ('not-started','in-progress')),
          value TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        ) STRICT;

        CREATE INDEX IF NOT EXISTS active_exam_sessions_updated
          ON active_exam_sessions(updated_at DESC);

        CREATE TABLE IF NOT EXISTS pending_attempts (
          client_attempt_id TEXT PRIMARY KEY,
          remote_attempt_id TEXT,
          tpo_id TEXT NOT NULL,
          section TEXT NOT NULL,
          document_key TEXT NOT NULL,
          document_hash TEXT,
          content_manifest_id TEXT,
          content_schema_version INTEGER,
          content_version_inferred INTEGER NOT NULL DEFAULT 0
            CHECK(content_version_inferred IN (0,1)),
          status TEXT NOT NULL CHECK(status IN
            ('pending-upload','uploading','synced','failed','conflict')),
          snapshot TEXT NOT NULL,
          retry_count INTEGER NOT NULL DEFAULT 0,
          next_retry_at INTEGER,
          last_error TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          synced_at INTEGER
        ) STRICT;

        CREATE INDEX IF NOT EXISTS pending_attempts_sync_queue
          ON pending_attempts(status, next_retry_at, created_at);
        CREATE INDEX IF NOT EXISTS pending_attempts_history
          ON pending_attempts(tpo_id, section, created_at DESC);

        CREATE TABLE IF NOT EXISTS recordings_v2 (
          client_attempt_id TEXT NOT NULL,
          question_key TEXT NOT NULL,
          relative_path TEXT NOT NULL UNIQUE,
          mime TEXT NOT NULL,
          size INTEGER NOT NULL,
          sha256 TEXT,
          duration_ms INTEGER,
          upload_status TEXT NOT NULL DEFAULT 'local'
            CHECK(upload_status IN ('local','queued','uploading','uploaded','failed')),
          remote_media_id TEXT,
          updated_at INTEGER NOT NULL,
          PRIMARY KEY(client_attempt_id, question_key)
        ) STRICT;

        CREATE INDEX IF NOT EXISTS recordings_v2_upload
          ON recordings_v2(upload_status, updated_at);

        CREATE TABLE IF NOT EXISTS sync_queue (
          operation_id TEXT PRIMARY KEY,
          entity_type TEXT NOT NULL,
          entity_key TEXT NOT NULL,
          operation_type TEXT NOT NULL,
          payload TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending'
            CHECK(status IN ('pending','processing','completed','failed','dead-letter')),
          attempt_count INTEGER NOT NULL DEFAULT 0,
          available_at INTEGER NOT NULL,
          locked_at INTEGER,
          last_error TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        ) STRICT;

        CREATE INDEX IF NOT EXISTS sync_queue_dispatch
          ON sync_queue(status, available_at, created_at);
        CREATE INDEX IF NOT EXISTS sync_queue_entity
          ON sync_queue(entity_type, entity_key, created_at);

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

        CREATE INDEX IF NOT EXISTS typing_history_date
          ON typing_history(completed_at DESC);

        CREATE TABLE IF NOT EXISTS content_installations (
          manifest_id TEXT PRIMARY KEY,
          content_hash TEXT NOT NULL,
          schema_version INTEGER NOT NULL,
          min_app_version TEXT NOT NULL,
          state TEXT NOT NULL
            CHECK(state IN ('downloading','verified','active','superseded','failed')),
          installed_at INTEGER,
          activated_at INTEGER,
          error_detail TEXT,
          value TEXT NOT NULL
        ) STRICT;

        CREATE INDEX IF NOT EXISTS content_installations_state
          ON content_installations(state, activated_at DESC);
      `);
    }
  },
  {
    version: 2,
    name: 'migrate-v1-sessions-and-recordings',
    up(db, context) {
      const hasLegacySessions = tableExists(db, 'exam_sessions');
      const hasLegacyRecordings = tableExists(db, 'recordings');
      if (!hasLegacySessions && !hasLegacyRecordings) return;

      const attemptIdBySession = new Map();
      const legacySessions = hasLegacySessions
        ? db.prepare('SELECT * FROM exam_sessions').all()
        : [];
      const insertPending = db.prepare(
        `INSERT INTO pending_attempts(
          client_attempt_id,tpo_id,section,document_key,document_hash,
          content_manifest_id,content_schema_version,content_version_inferred,
          status,snapshot,retry_count,created_at,updated_at)
          VALUES (?,?,?,?,?,?,?,?,'pending-upload',?,0,?,?)
          ON CONFLICT(client_attempt_id) DO NOTHING`
      );
      const insertDraft = db.prepare(
        `INSERT INTO active_exam_sessions(
          session_key,client_attempt_id,tpo_id,section,document_key,document_hash,
          content_manifest_id,content_schema_version,content_version_inferred,
          status,value,created_at,updated_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
          ON CONFLICT(session_key) DO UPDATE SET
            client_attempt_id=excluded.client_attempt_id,
            tpo_id=excluded.tpo_id, section=excluded.section,
            document_key=excluded.document_key, document_hash=excluded.document_hash,
            content_manifest_id=excluded.content_manifest_id,
            content_schema_version=excluded.content_schema_version,
            content_version_inferred=excluded.content_version_inferred,
            status=excluded.status, value=excluded.value, updated_at=excluded.updated_at`
      );

      for (const row of legacySessions) {
        const value = jsonOrDefault(row.value);
        const attemptId = String(value.clientAttemptId || createClientAttemptId());
        value.clientAttemptId = attemptId;
        const tpoId = String(row.tpo_id || '');
        const section = String(row.section || '');
        const documentKey = String(value.documentKey || row.id || `tpo-${tpoId}-${section}`);
        const documentHash = String(value.documentHash || '');
        const manifestId = String(value.contentManifestId || '');
        const schemaVersion = Number.isInteger(value.contentSchemaVersion)
          ? value.contentSchemaVersion
          : null;
        const inferred = value.contentVersionInferred ? 1 : documentHash ? 0 : 1;
        const now = Number.isFinite(row.updated_at) ? row.updated_at : Date.now();
        value.contentVersionInferred = inferred;
        value.documentKey = documentKey;
        value.documentHash = documentHash;
        value.contentManifestId = manifestId;
        value.contentSchemaVersion = schemaVersion;
        if (!Number.isFinite(value.createdAt)) value.createdAt = now;
        const snapshot = JSON.stringify(value);
        if (row.status === 'completed') {
          insertPending.run(
            attemptId,
            tpoId,
            section,
            documentKey,
            documentHash,
            manifestId,
            schemaVersion,
            inferred,
            snapshot,
            now,
            now
          );
        } else {
          insertDraft.run(
            `${tpoId}:${section}`,
            attemptId,
            tpoId,
            section,
            documentKey,
            documentHash,
            manifestId,
            schemaVersion,
            inferred,
            String(row.status || 'in-progress'),
            snapshot,
            now,
            now
          );
        }
        attemptIdBySession.set(row.id, attemptId);
      }

      const recordingsPath = context?.recordingsPath;
      if (hasLegacyRecordings && recordingsPath) {
        const legacyRecordings = db.prepare('SELECT * FROM recordings').all();
        const insertV2 = db.prepare(
          `INSERT INTO recordings_v2(
            client_attempt_id,question_key,relative_path,mime,size,sha256,duration_ms,
            upload_status,updated_at)
            VALUES (?,?,?,?,?,?,?, 'local', ?)`
        );
        const insertOrphanAttempt = db.prepare(
          `INSERT INTO pending_attempts(
            client_attempt_id,tpo_id,section,document_key,document_hash,
            content_manifest_id,content_schema_version,content_version_inferred,
            status,snapshot,retry_count,created_at,updated_at)
            VALUES (?,?,?,?,?,?,?,1,'pending-upload',?,0,?,?)
            ON CONFLICT(client_attempt_id) DO NOTHING`
        );
        const superseded = [];
        for (const record of legacyRecordings) {
          const sessionId = String(record.session_id || '');
          const questionKey = String(record.question_id || '');
          let attemptId = attemptIdBySession.get(sessionId);
          if (!attemptId) {
            attemptId = createClientAttemptId();
            const match = /^tpo-([^:]+)-([a-z]+)$/.exec(sessionId);
            const tpoId = match?.[1] || '';
            const section = match?.[2] || 'speaking';
            const now = Number.isFinite(record.updated_at) ? record.updated_at : Date.now();
            insertOrphanAttempt.run(
              attemptId,
              tpoId,
              section,
              sessionId,
              '',
              '',
              null,
              JSON.stringify({
                tpoId,
                section,
                status: 'completed',
                clientAttemptId: attemptId,
                documentKey: sessionId,
                documentHash: '',
                contentVersionInferred: 1,
                answers: {},
                updatedAt: now
              }),
              now,
              now
            );
          }
          const extension = recordingExtension(record.mime) || path.extname(record.relative_path);
          const relativePath = `${sha256(`${attemptId}\0${questionKey}`)}${extension}`;
          const oldPath = path.join(recordingsPath, path.basename(record.relative_path));
          const newPath = path.join(recordingsPath, relativePath);
          let fileSha = null;
          let size = Number(record.size) || 0;
          if (fs.existsSync(oldPath)) {
            fs.copyFileSync(oldPath, newPath);
            fileSha = sha256(fs.readFileSync(newPath));
            size = fs.statSync(newPath).size;
            if (oldPath !== newPath) superseded.push(oldPath);
          }
          insertV2.run(
            attemptId,
            questionKey,
            relativePath,
            record.mime,
            size,
            fileSha,
            null,
            Number.isFinite(record.updated_at) ? record.updated_at : Date.now()
          );
        }
        for (const oldPath of superseded) fs.rmSync(oldPath, { force: true });
      }

      if (hasLegacySessions) db.exec('DROP TABLE IF EXISTS exam_sessions');
      if (hasLegacyRecordings) db.exec('DROP TABLE IF EXISTS recordings');
    }
  }
];

export function schemaMigrationTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      checksum TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    ) STRICT;
  `);
}

export function appliedVersions(db) {
  return db
    .prepare('SELECT version FROM schema_migrations ORDER BY version')
    .all()
    .map(row => row.version);
}

export function pendingMigrations(db, migrations = MIGRATIONS) {
  const applied = new Set(appliedVersions(db));
  return migrations.filter(migration => !applied.has(migration.version));
}

export function migrationChecksum(migration) {
  return sha256(`${migration.version}:${migration.name}:${migration.up.toString()}`);
}

export function applyMigration(db, migration, context) {
  const checksum = migrationChecksum(migration);
  db.exec('BEGIN IMMEDIATE');
  try {
    migration.up(db, context);
    db.prepare(
      'INSERT INTO schema_migrations(version, name, checksum, applied_at) VALUES (?, ?, ?, ?)'
    ).run(migration.version, migration.name, checksum, Date.now());
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function runMigrations(db, { migrations = MIGRATIONS, context } = {}) {
  const pending = pendingMigrations(db, migrations);
  for (const migration of pending) applyMigration(db, migration, context);
  return pending;
}
