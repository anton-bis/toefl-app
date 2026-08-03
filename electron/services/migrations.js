import crypto from 'node:crypto';

const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');

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

export function applyMigration(db, migration) {
  const checksum = migrationChecksum(migration);
  db.exec('BEGIN IMMEDIATE');
  try {
    migration.up(db);
    db.prepare(
      'INSERT INTO schema_migrations(version, name, checksum, applied_at) VALUES (?, ?, ?, ?)'
    ).run(migration.version, migration.name, checksum, Date.now());
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function runMigrations(db, { migrations = MIGRATIONS } = {}) {
  const pending = pendingMigrations(db, migrations);
  for (const migration of pending) applyMigration(db, migration);
  return pending;
}
