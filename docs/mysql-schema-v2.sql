-- TOEFL AI 批改平台：云端 MySQL 8.0 参考结构
-- 文档版本：v2.0
-- 时间约定：所有 DATETIME(3) 均使用 UTC
-- ID 约定：BIGINT UNSIGNED 为内部主键；CHAR(26) 为对外 ULID

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- ============================================================
-- 1. 用户与权限域
-- ============================================================

CREATE TABLE users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  email VARCHAR(320) NOT NULL,
  email_normalized VARCHAR(320) NOT NULL,
  nickname VARCHAR(100) NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  email_verified_at DATETIME(3) NULL,
  last_login_at DATETIME(3) NULL,
  deleted_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_users_public_id (public_id),
  UNIQUE KEY uk_users_email_normalized (email_normalized),
  KEY idx_users_status_created (status, created_at),
  CONSTRAINT chk_users_status CHECK (status IN ('active','disabled','pending_verification','deleted'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE user_identities (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  provider VARCHAR(32) NOT NULL,
  provider_subject VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NULL,
  provider_email VARCHAR(320) NULL,
  metadata_json JSON NULL,
  last_used_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_identity_provider_subject (provider, provider_subject),
  KEY idx_identity_user (user_id),
  CONSTRAINT fk_identity_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE auth_sessions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  refresh_token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  device_name VARCHAR(120) NULL,
  ip_address VARBINARY(16) NULL,
  user_agent VARCHAR(500) NULL,
  expires_at DATETIME(3) NOT NULL,
  revoked_at DATETIME(3) NULL,
  last_seen_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_auth_session_public_id (public_id),
  UNIQUE KEY uk_auth_session_token_hash (token_hash),
  KEY idx_auth_session_user_active (user_id, revoked_at, expires_at),
  CONSTRAINT fk_auth_session_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE roles (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(500) NULL,
  policy_json JSON NULL,
  is_system TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_roles_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE user_roles (
  user_id BIGINT UNSIGNED NOT NULL,
  role_id BIGINT UNSIGNED NOT NULL,
  granted_by BIGINT UNSIGNED NULL,
  granted_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  expires_at DATETIME(3) NULL,
  PRIMARY KEY (user_id, role_id),
  KEY idx_user_roles_role (role_id, user_id),
  CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_user_roles_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT,
  CONSTRAINT fk_user_roles_granted_by FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================================
-- 2. 内容与题库域：复用仓库 Markdown -> compiled document -> pack -> release
-- ============================================================

CREATE TABLE content_documents (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  document_key VARCHAR(100) NOT NULL,
  tpo_id VARCHAR(20) NOT NULL,
  section VARCHAR(32) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_content_document_key (document_key),
  KEY idx_content_documents_tpo_section (tpo_id, section),
  CONSTRAINT chk_content_documents_section CHECK (section IN ('reading','listening','speaking','writing')),
  CONSTRAINT chk_content_documents_status CHECK (status IN ('active','archived'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE content_document_versions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  document_id BIGINT UNSIGNED NOT NULL,
  source_path VARCHAR(500) NOT NULL,
  document_path VARCHAR(500) NOT NULL,
  source_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  document_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  content_schema_version INT UNSIGNED NOT NULL,
  parser_version VARCHAR(50) NULL,
  question_count INT UNSIGNED NOT NULL DEFAULT 0,
  compiled_metadata_json JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_document_version_public_id (public_id),
  UNIQUE KEY uk_document_version_hash (document_hash),
  UNIQUE KEY uk_document_source_hash (document_id, source_hash),
  KEY idx_document_versions_document_created (document_id, created_at DESC),
  CONSTRAINT fk_document_version_document FOREIGN KEY (document_id) REFERENCES content_documents(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE content_packs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  pack_key VARCHAR(100) NOT NULL,
  content_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  archive_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  archive_url VARCHAR(1000) NOT NULL,
  archive_size_bytes BIGINT UNSIGNED NOT NULL,
  content_schema_version INT UNSIGNED NOT NULL,
  min_app_version VARCHAR(30) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_content_pack_public_id (public_id),
  UNIQUE KEY uk_content_pack_key_hash (pack_key, content_hash),
  UNIQUE KEY uk_content_pack_archive_hash (archive_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE content_pack_documents (
  pack_id BIGINT UNSIGNED NOT NULL,
  document_version_id BIGINT UNSIGNED NOT NULL,
  ordinal INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (pack_id, document_version_id),
  UNIQUE KEY uk_pack_document_ordinal (pack_id, ordinal),
  KEY idx_pack_documents_document (document_version_id),
  CONSTRAINT fk_pack_documents_pack FOREIGN KEY (pack_id) REFERENCES content_packs(id) ON DELETE RESTRICT,
  CONSTRAINT fk_pack_documents_version FOREIGN KEY (document_version_id) REFERENCES content_document_versions(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE content_releases (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  manifest_id CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  content_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  content_schema_version INT UNSIGNED NOT NULL,
  min_app_version VARCHAR(30) NOT NULL,
  git_commit_sha CHAR(40) CHARACTER SET ascii COLLATE ascii_bin NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'published',
  published_at DATETIME(3) NOT NULL,
  metadata_json JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_content_release_public_id (public_id),
  UNIQUE KEY uk_content_release_manifest_id (manifest_id),
  KEY idx_content_releases_status_published (status, published_at DESC),
  CONSTRAINT chk_content_release_status CHECK (status IN ('staging','published','superseded','revoked'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE content_release_packs (
  release_id BIGINT UNSIGNED NOT NULL,
  pack_id BIGINT UNSIGNED NOT NULL,
  ordinal INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (release_id, pack_id),
  UNIQUE KEY uk_release_pack_ordinal (release_id, ordinal),
  KEY idx_release_packs_pack (pack_id),
  CONSTRAINT fk_release_packs_release FOREIGN KEY (release_id) REFERENCES content_releases(id) ON DELETE RESTRICT,
  CONSTRAINT fk_release_packs_pack FOREIGN KEY (pack_id) REFERENCES content_packs(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE content_tasks (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  document_version_id BIGINT UNSIGNED NOT NULL,
  module_key VARCHAR(150) NULL,
  task_key VARCHAR(150) NOT NULL,
  task_type VARCHAR(80) NOT NULL,
  title VARCHAR(255) NULL,
  subtitle VARCHAR(500) NULL,
  ordinal INT UNSIGNED NOT NULL DEFAULT 0,
  search_text LONGTEXT NULL,
  metadata_json JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_content_task_public_id (public_id),
  UNIQUE KEY uk_content_task_key (document_version_id, task_key),
  KEY idx_content_tasks_type (task_type, document_version_id),
  KEY idx_content_tasks_document_order (document_version_id, ordinal),
  FULLTEXT KEY ft_content_task_search (title, subtitle, search_text),
  CONSTRAINT fk_content_task_version FOREIGN KEY (document_version_id) REFERENCES content_document_versions(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE content_questions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  document_version_id BIGINT UNSIGNED NOT NULL,
  task_id BIGINT UNSIGNED NOT NULL,
  question_key VARCHAR(180) NOT NULL,
  question_number VARCHAR(30) NULL,
  question_type VARCHAR(80) NOT NULL,
  ordinal INT UNSIGNED NOT NULL DEFAULT 0,
  objective_kind VARCHAR(40) NULL,
  max_score DECIMAL(8,3) NULL,
  answer_key_json JSON NULL,
  metadata_json JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_content_question_public_id (public_id),
  UNIQUE KEY uk_content_question_key (document_version_id, question_key),
  KEY idx_content_questions_task_order (task_id, ordinal),
  KEY idx_content_questions_type (question_type, document_version_id),
  CONSTRAINT fk_content_question_version FOREIGN KEY (document_version_id) REFERENCES content_document_versions(id) ON DELETE RESTRICT,
  CONSTRAINT fk_content_question_task FOREIGN KEY (task_id) REFERENCES content_tasks(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE topics (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  parent_id BIGINT UNSIGNED NULL,
  namespace VARCHAR(50) NOT NULL,
  code VARCHAR(100) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(500) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_topics_namespace_code (namespace, code),
  KEY idx_topics_parent_order (parent_id, sort_order),
  CONSTRAINT fk_topics_parent FOREIGN KEY (parent_id) REFERENCES topics(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE content_task_topics (
  task_id BIGINT UNSIGNED NOT NULL,
  topic_id BIGINT UNSIGNED NOT NULL,
  source VARCHAR(32) NOT NULL DEFAULT 'ai',
  confidence DECIMAL(5,4) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (task_id, topic_id),
  KEY idx_task_topics_topic (topic_id, task_id),
  CONSTRAINT fk_task_topics_task FOREIGN KEY (task_id) REFERENCES content_tasks(id) ON DELETE RESTRICT,
  CONSTRAINT fk_task_topics_topic FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE RESTRICT,
  CONSTRAINT chk_task_topics_source CHECK (source IN ('manual','ai','import'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================================
-- 3. 练习、离线同步与媒体域
-- ============================================================

CREATE TABLE client_devices (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  client_device_id VARCHAR(100) NOT NULL,
  platform VARCHAR(32) NOT NULL,
  app_version VARCHAR(30) NULL,
  device_name VARCHAR(120) NULL,
  last_sync_at DATETIME(3) NULL,
  last_seen_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_client_device_public_id (public_id),
  UNIQUE KEY uk_client_device_user_local (user_id, client_device_id),
  KEY idx_client_devices_user_seen (user_id, last_seen_at DESC),
  CONSTRAINT fk_client_device_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE media_objects (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  user_id BIGINT UNSIGNED NULL,
  storage_provider VARCHAR(32) NOT NULL,
  bucket_name VARCHAR(255) NOT NULL,
  object_key VARCHAR(700) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  size_bytes BIGINT UNSIGNED NOT NULL,
  sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  duration_ms INT UNSIGNED NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'ready',
  retention_until DATETIME(3) NULL,
  deleted_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_media_public_id (public_id),
  UNIQUE KEY uk_media_storage_object (storage_provider, bucket_name, object_key),
  KEY idx_media_user_created (user_id, created_at DESC),
  KEY idx_media_hash (sha256),
  CONSTRAINT fk_media_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT chk_media_status CHECK (status IN ('uploading','ready','quarantined','deleted'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE attempts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  client_attempt_id CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  client_device_id BIGINT UNSIGNED NULL,
  content_release_id BIGINT UNSIGNED NULL,
  document_version_id BIGINT UNSIGNED NOT NULL,
  mode VARCHAR(32) NOT NULL DEFAULT 'practice',
  section VARCHAR(32) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'in_progress',
  content_version_inferred TINYINT(1) NOT NULL DEFAULT 0,
  elapsed_seconds INT UNSIGNED NULL,
  result_summary_json JSON NULL,
  lock_version INT UNSIGNED NOT NULL DEFAULT 0,
  started_at DATETIME(3) NOT NULL,
  submitted_at DATETIME(3) NULL,
  completed_at DATETIME(3) NULL,
  abandoned_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_attempt_public_id (public_id),
  UNIQUE KEY uk_attempt_user_client_id (user_id, client_attempt_id),
  KEY idx_attempt_user_history (user_id, started_at DESC),
  KEY idx_attempt_user_status (user_id, status, updated_at DESC),
  KEY idx_attempt_document (document_version_id, status),
  CONSTRAINT fk_attempt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_attempt_device FOREIGN KEY (client_device_id) REFERENCES client_devices(id) ON DELETE SET NULL,
  CONSTRAINT fk_attempt_release FOREIGN KEY (content_release_id) REFERENCES content_releases(id) ON DELETE RESTRICT,
  CONSTRAINT fk_attempt_document_version FOREIGN KEY (document_version_id) REFERENCES content_document_versions(id) ON DELETE RESTRICT,
  CONSTRAINT chk_attempt_mode CHECK (mode IN ('practice','mock','review')),
  CONSTRAINT chk_attempt_section CHECK (section IN ('reading','listening','speaking','writing')),
  CONSTRAINT chk_attempt_status CHECK (status IN ('in_progress','submitted','grading','completed','failed','abandoned'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE attempt_responses (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  attempt_id BIGINT UNSIGNED NOT NULL,
  content_question_id BIGINT UNSIGNED NOT NULL,
  question_key_snapshot VARCHAR(180) NOT NULL,
  response_type VARCHAR(32) NOT NULL,
  response_text LONGTEXT NULL,
  response_json JSON NULL,
  response_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  is_correct TINYINT(1) NULL,
  score_awarded DECIMAL(8,3) NULL,
  max_score DECIMAL(8,3) NULL,
  evaluated_at DATETIME(3) NULL,
  client_updated_at DATETIME(3) NULL,
  submitted_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_attempt_response_public_id (public_id),
  UNIQUE KEY uk_attempt_response_question (attempt_id, content_question_id),
  KEY idx_attempt_responses_question (content_question_id, evaluated_at),
  KEY idx_attempt_responses_attempt (attempt_id, id),
  CONSTRAINT fk_attempt_response_attempt FOREIGN KEY (attempt_id) REFERENCES attempts(id) ON DELETE RESTRICT,
  CONSTRAINT fk_attempt_response_question FOREIGN KEY (content_question_id) REFERENCES content_questions(id) ON DELETE RESTRICT,
  CONSTRAINT chk_attempt_response_type CHECK (response_type IN ('choice','multi_choice','text','sentence','audio','mixed'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE response_media (
  attempt_response_id BIGINT UNSIGNED NOT NULL,
  media_object_id BIGINT UNSIGNED NOT NULL,
  media_role VARCHAR(32) NOT NULL DEFAULT 'answer_audio',
  ordinal INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (attempt_response_id, media_object_id),
  UNIQUE KEY uk_response_media_role_order (attempt_response_id, media_role, ordinal),
  KEY idx_response_media_object (media_object_id),
  CONSTRAINT fk_response_media_response FOREIGN KEY (attempt_response_id) REFERENCES attempt_responses(id) ON DELETE RESTRICT,
  CONSTRAINT fk_response_media_object FOREIGN KEY (media_object_id) REFERENCES media_objects(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================================
-- 4. AI 评分域
-- ============================================================

CREATE TABLE rubric_versions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  rubric_code VARCHAR(100) NOT NULL,
  version VARCHAR(50) NOT NULL,
  task_type VARCHAR(80) NOT NULL,
  rubric_json JSON NOT NULL,
  prompt_template LONGTEXT NULL,
  output_schema_json JSON NULL,
  checksum CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  created_by BIGINT UNSIGNED NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_rubric_public_id (public_id),
  UNIQUE KEY uk_rubric_code_version (rubric_code, version),
  UNIQUE KEY uk_rubric_checksum (checksum),
  KEY idx_rubric_task_status (task_type, status),
  CONSTRAINT fk_rubric_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_rubric_status CHECK (status IN ('draft','active','retired'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE grading_jobs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  attempt_response_id BIGINT UNSIGNED NOT NULL,
  rubric_version_id BIGINT UNSIGNED NOT NULL,
  job_type VARCHAR(50) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'queued',
  requested_provider VARCHAR(50) NOT NULL,
  requested_model VARCHAR(120) NOT NULL,
  prompt_version VARCHAR(50) NOT NULL,
  score_mapping_version VARCHAR(50) NOT NULL,
  input_snapshot_json JSON NOT NULL,
  idempotency_key VARCHAR(160) NOT NULL,
  priority SMALLINT NOT NULL DEFAULT 0,
  retry_count INT UNSIGNED NOT NULL DEFAULT 0,
  max_attempts INT UNSIGNED NOT NULL DEFAULT 3,
  available_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  locked_by VARCHAR(120) NULL,
  locked_until DATETIME(3) NULL,
  billing_source_type VARCHAR(32) NULL,
  billing_source_public_id CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NULL,
  error_code VARCHAR(80) NULL,
  error_detail VARCHAR(1000) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  started_at DATETIME(3) NULL,
  finished_at DATETIME(3) NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_grading_job_public_id (public_id),
  UNIQUE KEY uk_grading_job_idempotency (idempotency_key),
  KEY idx_grading_queue (status, available_at, priority, id),
  KEY idx_grading_response_created (attempt_response_id, created_at DESC),
  KEY idx_grading_lock (locked_until),
  CONSTRAINT fk_grading_job_response FOREIGN KEY (attempt_response_id) REFERENCES attempt_responses(id) ON DELETE RESTRICT,
  CONSTRAINT fk_grading_job_rubric FOREIGN KEY (rubric_version_id) REFERENCES rubric_versions(id) ON DELETE RESTRICT,
  CONSTRAINT chk_grading_job_status CHECK (status IN ('queued','processing','retry_waiting','succeeded','failed_terminal','cancelled'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE grading_job_runs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  grading_job_id BIGINT UNSIGNED NOT NULL,
  run_no INT UNSIGNED NOT NULL,
  provider VARCHAR(50) NOT NULL,
  model VARCHAR(120) NOT NULL,
  provider_request_id VARCHAR(255) NULL,
  status VARCHAR(32) NOT NULL,
  request_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  response_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  prompt_tokens INT UNSIGNED NULL,
  completion_tokens INT UNSIGNED NULL,
  total_tokens INT UNSIGNED NULL,
  cost_microunits BIGINT UNSIGNED NULL,
  latency_ms INT UNSIGNED NULL,
  error_code VARCHAR(80) NULL,
  error_detail VARCHAR(1000) NULL,
  started_at DATETIME(3) NOT NULL,
  finished_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_grading_run_number (grading_job_id, run_no),
  KEY idx_grading_run_provider_request (provider, provider_request_id),
  CONSTRAINT fk_grading_run_job FOREIGN KEY (grading_job_id) REFERENCES grading_jobs(id) ON DELETE RESTRICT,
  CONSTRAINT chk_grading_run_status CHECK (status IN ('processing','succeeded','failed','timed_out','cancelled'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE grading_results (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  grading_job_id BIGINT UNSIGNED NOT NULL,
  source_run_id BIGINT UNSIGNED NOT NULL,
  raw_score DECIMAL(8,3) NULL,
  raw_scale VARCHAR(32) NULL,
  display_score DECIMAL(8,3) NULL,
  display_scale VARCHAR(32) NULL,
  result_schema_version VARCHAR(50) NOT NULL,
  feedback_json JSON NOT NULL,
  polished_text LONGTEXT NULL,
  transcript LONGTEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_grading_result_public_id (public_id),
  UNIQUE KEY uk_grading_result_job (grading_job_id),
  UNIQUE KEY uk_grading_result_run (source_run_id),
  KEY idx_grading_results_created (created_at DESC),
  CONSTRAINT fk_grading_result_job FOREIGN KEY (grading_job_id) REFERENCES grading_jobs(id) ON DELETE RESTRICT,
  CONSTRAINT fk_grading_result_run FOREIGN KEY (source_run_id) REFERENCES grading_job_runs(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE grading_dimension_scores (
  grading_result_id BIGINT UNSIGNED NOT NULL,
  dimension_code VARCHAR(80) NOT NULL,
  score DECIMAL(8,3) NULL,
  scale VARCHAR(32) NULL,
  feedback TEXT NULL,
  ordinal INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (grading_result_id, dimension_code),
  KEY idx_dimension_analytics (dimension_code, score),
  CONSTRAINT fk_dimension_result FOREIGN KEY (grading_result_id) REFERENCES grading_results(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================================
-- 5. 商品、订单、支付、订阅与额度域
-- ============================================================

CREATE TABLE products (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  code VARCHAR(80) NOT NULL,
  name VARCHAR(150) NOT NULL,
  product_type VARCHAR(32) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  description TEXT NULL,
  metadata_json JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_product_public_id (public_id),
  UNIQUE KEY uk_product_code (code),
  CONSTRAINT chk_product_type CHECK (product_type IN ('credit_pack','subscription','digital_content')),
  CONSTRAINT chk_product_status CHECK (status IN ('draft','active','inactive','archived'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE product_prices (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  currency CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  amount_minor BIGINT UNSIGNED NOT NULL,
  billing_interval VARCHAR(20) NULL,
  interval_count INT UNSIGNED NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  starts_at DATETIME(3) NULL,
  ends_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_product_price_public_id (public_id),
  KEY idx_product_prices_product_active (product_id, status, currency),
  CONSTRAINT fk_product_price_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
  CONSTRAINT chk_price_interval CHECK (billing_interval IS NULL OR billing_interval IN ('day','month','year')),
  CONSTRAINT chk_price_status CHECK (status IN ('active','inactive','archived'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE product_benefits (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id BIGINT UNSIGNED NOT NULL,
  benefit_type VARCHAR(50) NOT NULL,
  quantity BIGINT UNSIGNED NULL,
  duration_days INT UNSIGNED NULL,
  metadata_json JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_product_benefit_type (product_id, benefit_type),
  CONSTRAINT fk_product_benefit_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
  CONSTRAINT chk_product_benefit_type CHECK (benefit_type IN ('ai_credits','unlimited_ai','content_access'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE orders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  order_no VARCHAR(64) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  currency CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  subtotal_minor BIGINT UNSIGNED NOT NULL,
  discount_minor BIGINT UNSIGNED NOT NULL DEFAULT 0,
  total_minor BIGINT UNSIGNED NOT NULL,
  idempotency_key VARCHAR(160) NOT NULL,
  metadata_json JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  paid_at DATETIME(3) NULL,
  closed_at DATETIME(3) NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_order_public_id (public_id),
  UNIQUE KEY uk_order_no (order_no),
  UNIQUE KEY uk_order_idempotency (user_id, idempotency_key),
  KEY idx_orders_user_created (user_id, created_at DESC),
  KEY idx_orders_status_created (status, created_at),
  CONSTRAINT fk_order_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT chk_order_status CHECK (status IN ('pending','paid','failed','cancelled','partially_refunded','refunded'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE order_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  order_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  price_id BIGINT UNSIGNED NOT NULL,
  quantity INT UNSIGNED NOT NULL DEFAULT 1,
  unit_amount_minor BIGINT UNSIGNED NOT NULL,
  total_amount_minor BIGINT UNSIGNED NOT NULL,
  product_code_snapshot VARCHAR(80) NOT NULL,
  product_name_snapshot VARCHAR(150) NOT NULL,
  benefit_snapshot_json JSON NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_order_item_public_id (public_id),
  KEY idx_order_items_order (order_id, id),
  CONSTRAINT fk_order_item_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT,
  CONSTRAINT fk_order_item_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
  CONSTRAINT fk_order_item_price FOREIGN KEY (price_id) REFERENCES product_prices(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE payments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  order_id BIGINT UNSIGNED NOT NULL,
  provider VARCHAR(32) NOT NULL,
  provider_payment_id VARCHAR(160) NULL,
  provider_trade_no VARCHAR(160) NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  currency CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  amount_minor BIGINT UNSIGNED NOT NULL,
  payment_method VARCHAR(50) NULL,
  provider_payload_json JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  paid_at DATETIME(3) NULL,
  failed_at DATETIME(3) NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_payment_public_id (public_id),
  UNIQUE KEY uk_payment_provider_id (provider, provider_payment_id),
  UNIQUE KEY uk_payment_trade_no (provider, provider_trade_no),
  KEY idx_payments_order_created (order_id, created_at DESC),
  KEY idx_payments_status_created (status, created_at),
  CONSTRAINT fk_payment_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT,
  CONSTRAINT chk_payment_status CHECK (status IN ('pending','processing','succeeded','failed','cancelled','partially_refunded','refunded'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE payment_webhook_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  provider VARCHAR(32) NOT NULL,
  provider_event_id VARCHAR(200) NOT NULL,
  event_type VARCHAR(100) NULL,
  payload_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  payload_json JSON NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'received',
  error_detail VARCHAR(1000) NULL,
  received_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  processed_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_payment_webhook_event (provider, provider_event_id),
  KEY idx_payment_webhook_status (status, received_at),
  CONSTRAINT chk_webhook_status CHECK (status IN ('received','processing','processed','ignored','failed'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE refunds (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  payment_id BIGINT UNSIGNED NOT NULL,
  provider_refund_id VARCHAR(160) NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  amount_minor BIGINT UNSIGNED NOT NULL,
  reason VARCHAR(500) NULL,
  metadata_json JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  succeeded_at DATETIME(3) NULL,
  failed_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_refund_public_id (public_id),
  UNIQUE KEY uk_refund_provider_id (payment_id, provider_refund_id),
  KEY idx_refunds_payment_created (payment_id, created_at DESC),
  CONSTRAINT fk_refund_payment FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE RESTRICT,
  CONSTRAINT chk_refund_status CHECK (status IN ('pending','processing','succeeded','failed','cancelled'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE subscriptions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  price_id BIGINT UNSIGNED NOT NULL,
  source_order_item_id BIGINT UNSIGNED NOT NULL,
  provider VARCHAR(32) NULL,
  provider_subscription_id VARCHAR(160) NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  current_period_start DATETIME(3) NOT NULL,
  current_period_end DATETIME(3) NOT NULL,
  cancel_at_period_end TINYINT(1) NOT NULL DEFAULT 0,
  cancelled_at DATETIME(3) NULL,
  ended_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_subscription_public_id (public_id),
  UNIQUE KEY uk_subscription_provider_id (provider, provider_subscription_id),
  KEY idx_subscription_user_period (user_id, status, current_period_end),
  CONSTRAINT fk_subscription_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_subscription_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
  CONSTRAINT fk_subscription_price FOREIGN KEY (price_id) REFERENCES product_prices(id) ON DELETE RESTRICT,
  CONSTRAINT fk_subscription_order_item FOREIGN KEY (source_order_item_id) REFERENCES order_items(id) ON DELETE RESTRICT,
  CONSTRAINT chk_subscription_status CHECK (status IN ('trialing','active','past_due','paused','cancelled','expired'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE credit_accounts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  available_balance BIGINT UNSIGNED NOT NULL DEFAULT 0,
  reserved_balance BIGINT UNSIGNED NOT NULL DEFAULT 0,
  lock_version BIGINT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_credit_account_public_id (public_id),
  UNIQUE KEY uk_credit_account_user (user_id),
  CONSTRAINT fk_credit_account_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE credit_reservations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  credit_account_id BIGINT UNSIGNED NOT NULL,
  grading_job_id BIGINT UNSIGNED NOT NULL,
  amount BIGINT UNSIGNED NOT NULL DEFAULT 1,
  status VARCHAR(32) NOT NULL DEFAULT 'reserved',
  expires_at DATETIME(3) NOT NULL,
  consumed_at DATETIME(3) NULL,
  released_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_credit_reservation_public_id (public_id),
  UNIQUE KEY uk_credit_reservation_job (grading_job_id),
  KEY idx_credit_reservation_expiry (status, expires_at),
  CONSTRAINT fk_credit_reservation_account FOREIGN KEY (credit_account_id) REFERENCES credit_accounts(id) ON DELETE RESTRICT,
  CONSTRAINT fk_credit_reservation_job FOREIGN KEY (grading_job_id) REFERENCES grading_jobs(id) ON DELETE RESTRICT,
  CONSTRAINT chk_credit_reservation_status CHECK (status IN ('reserved','consumed','released','expired'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE credit_ledger (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  credit_account_id BIGINT UNSIGNED NOT NULL,
  entry_type VARCHAR(40) NOT NULL,
  delta_available BIGINT NOT NULL DEFAULT 0,
  delta_reserved BIGINT NOT NULL DEFAULT 0,
  available_after BIGINT UNSIGNED NOT NULL,
  reserved_after BIGINT UNSIGNED NOT NULL,
  source_type VARCHAR(50) NOT NULL,
  source_public_id CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NULL,
  idempotency_key VARCHAR(180) NOT NULL,
  note VARCHAR(500) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_credit_ledger_public_id (public_id),
  UNIQUE KEY uk_credit_ledger_idempotency (credit_account_id, idempotency_key),
  KEY idx_credit_ledger_account_created (credit_account_id, created_at DESC, id DESC),
  KEY idx_credit_ledger_source (source_type, source_public_id),
  CONSTRAINT fk_credit_ledger_account FOREIGN KEY (credit_account_id) REFERENCES credit_accounts(id) ON DELETE RESTRICT,
  CONSTRAINT chk_credit_ledger_type CHECK (entry_type IN ('grant','reserve','consume','release','refund','adjustment','expire'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================================
-- 6. 审计、可靠消息与接口幂等域
-- ============================================================

CREATE TABLE audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  actor_user_id BIGINT UNSIGNED NULL,
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(80) NOT NULL,
  target_public_id VARCHAR(100) NULL,
  before_json JSON NULL,
  after_json JSON NULL,
  request_id VARCHAR(100) NULL,
  ip_address VARBINARY(16) NULL,
  user_agent VARCHAR(500) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_audit_target (target_type, target_public_id, created_at DESC),
  KEY idx_audit_actor (actor_user_id, created_at DESC),
  KEY idx_audit_created (created_at DESC),
  CONSTRAINT fk_audit_actor FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE outbox_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  aggregate_type VARCHAR(80) NOT NULL,
  aggregate_public_id VARCHAR(100) NOT NULL,
  event_type VARCHAR(120) NOT NULL,
  payload_json JSON NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  available_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  attempt_count INT UNSIGNED NOT NULL DEFAULT 0,
  locked_by VARCHAR(120) NULL,
  locked_until DATETIME(3) NULL,
  published_at DATETIME(3) NULL,
  last_error VARCHAR(1000) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_outbox_public_id (public_id),
  KEY idx_outbox_dispatch (status, available_at, id),
  KEY idx_outbox_aggregate (aggregate_type, aggregate_public_id, created_at),
  CONSTRAINT chk_outbox_status CHECK (status IN ('pending','processing','published','failed','cancelled'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE idempotency_records (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NULL,
  scope VARCHAR(80) NOT NULL,
  idempotency_key VARCHAR(180) NOT NULL,
  request_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'processing',
  response_status INT NULL,
  response_json JSON NULL,
  resource_type VARCHAR(80) NULL,
  resource_public_id VARCHAR(100) NULL,
  expires_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_idempotency_scope_key (scope, idempotency_key),
  KEY idx_idempotency_expiry (expires_at),
  CONSTRAINT fk_idempotency_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_idempotency_status CHECK (status IN ('processing','completed','failed'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
