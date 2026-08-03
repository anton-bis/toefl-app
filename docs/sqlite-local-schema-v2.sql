-- TOEFL App 1.5.2 -> 本地 SQLite v2 参考结构
-- 目标：保留离线优先能力，并替换"结构不一致即删库"的现有机制。
-- 每次迁移前应备份 sqlite / wal / shm 与 recordings 目录。

PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  checksum TEXT NOT NULL,
  applied_at INTEGER NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
) STRICT;

-- 每个 TPO/科目仅保留一个可恢复草稿，但草稿拥有独立 client_attempt_id。
CREATE TABLE IF NOT EXISTS active_exam_sessions (
  session_key TEXT PRIMARY KEY,
  client_attempt_id TEXT NOT NULL UNIQUE,
  tpo_id TEXT NOT NULL,
  section TEXT NOT NULL,
  document_key TEXT NOT NULL,
  document_hash TEXT,
  content_manifest_id TEXT,
  content_schema_version INTEGER,
  content_version_inferred INTEGER NOT NULL DEFAULT 0 CHECK(content_version_inferred IN (0,1)),
  status TEXT NOT NULL CHECK(status IN ('not-started','in-progress')),
  value TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
) STRICT;

CREATE INDEX IF NOT EXISTS active_exam_sessions_updated
  ON active_exam_sessions(updated_at DESC);

-- 完成提交后固化的不可变本地快照；同步成功后仍可保留有限缓存。
CREATE TABLE IF NOT EXISTS pending_attempts (
  client_attempt_id TEXT PRIMARY KEY,
  remote_attempt_id TEXT,
  tpo_id TEXT NOT NULL,
  section TEXT NOT NULL,
  document_key TEXT NOT NULL,
  document_hash TEXT,
  content_manifest_id TEXT,
  content_schema_version INTEGER,
  content_version_inferred INTEGER NOT NULL DEFAULT 0 CHECK(content_version_inferred IN (0,1)),
  status TEXT NOT NULL CHECK(status IN ('pending-upload','uploading','synced','failed','conflict')),
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

-- 录音按一次 attempt 绑定，不再按 document/session 绑定。
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

-- 通用同步队列；operation_id 用于云端幂等。
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

-- 现有学习模块继续保留。
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

-- 内容安装状态与当前激活 manifest 分离，便于安全切换和故障恢复。
CREATE TABLE IF NOT EXISTS content_installations (
  manifest_id TEXT PRIMARY KEY,
  content_hash TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  min_app_version TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('downloading','verified','active','superseded','failed')),
  installed_at INTEGER,
  activated_at INTEGER,
  error_detail TEXT,
  value TEXT NOT NULL
) STRICT;

CREATE INDEX IF NOT EXISTS content_installations_state
  ON content_installations(state, activated_at DESC);

-- 示例：迁移完成后由迁移器写入，而不是由建表 SQL 直接假定成功。
-- INSERT INTO schema_migrations(version,name,checksum,applied_at)
-- VALUES (2,'attempt-and-sync-model','<migration-file-sha256>',unixepoch('subsec') * 1000);
