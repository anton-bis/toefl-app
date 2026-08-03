# 阶段 A — 本地数据安全改造（toefl-app）

## 0. 一句话背景

toefl-app 是托福模考 Electron 桌面端（Vue 3 + Vite + Electron + SQLite）。
我们正在建设云端 Web 平台（toefl-web，另开新仓库），但云端上线前，
必须先修好桌面端的本地数据安全问题。阶段 A 只动 toefl-app 仓库，不碰 Web 端。

## 1. 仓库状态

- 路径：D:\托福阅读模拟软件
- 当前版本：v1.5.2（已与 GitHub origin/master 同步）
- 技术栈：Vue 3 + Vite + Pinia + Vue Router + Electron + better-sqlite3
- 内容系统：Markdown（assets/questions/）→ parser 编译 → 运行时渲染
- 本地数据库：Electron 进程内 SQLite（electron/services/database.js / database-worker.js）

## 2. 当前已知的 4 个数据安全问题（阶段 A 要解决）

1. **删库重建**：SQLite 发现表结构不完全匹配时，会删除整个数据库和 recordings 目录
   ——用户练习数据直接丢失。这是最严重的问题。
2. **session 覆盖**：exam_sessions 以 tpoId+section 为唯一键，多次练习覆盖同一逻辑位置，
   无法保存"每一次"练习。
3. **录音覆盖**：录音主键是 session_id+question_id，同题重练会覆盖旧录音。
4. **无内容版本信息**：session 没保存 documentHash/manifestId，题目更新后历史答案无法对应正确版本。

## 3. 阶段 A 的 7 项任务（来自 database-design-v2 第 22 节）

| # | 任务 | 说明 |
|---|------|------|
| 1 | 引入 SQLite migration 框架 | 结构变更走脚本管理，逐版本迁移 |
| 2 | 禁止结构不一致时删库 | 迁移前备份 sqlite/wal/shm/recordings，失败恢复 |
| 3 | session 增加 clientAttemptId | 每次练习独立 ULID，可永久追溯 |
| 4 | 完成时固化不可变 pending attempt | 做完的练习存成不可变快照，不覆盖 |
| 5 | 录音改为按 attempt 绑定 | 键改为 client_attempt_id + question_key |
| 6 | 内容 schema 显式携带版本 | 记录 documentHash/manifestId/schemaVersion |
| 7 | 解析器抽到共享 content-core | 为 Web 端复用做准备（可后置） |

## 4. 目标数据库结构（新）

参考文件：docs/sqlite-local-schema-v2.sql（已写好，直接作为建表目标）

包含表：
- schema_migrations（版本记录）
- settings
- active_exam_sessions（草稿，保留一个可恢复草稿）
- pending_attempts（不可变快照，待同步）
- recordings_v2（按 attempt 绑定）
- sync_queue（同步队列）
- vocabulary_progress / typing_history（现有保留）
- content_installations（内容安装状态）

STRICT 模式 + 外键约束 + WAL 日志。

## 5. 关键约束（不可违反）

- 任何情况不得删库重建；结构升级必须走 migration + 备份 + 回滚。
- 已提交的 attempt 不可原地修改；重做产生新 attempt。
- 录音不能以题目为键；必须绑定到一次 attempt。
- 旧数据迁移：旧 session 没有 document hash → 用迁移时本地安装内容的 hash，
  并标记 content_version_inferred=1，历史页面注明"版本为迁移时推定"。
- 录音迁移：生成 client_attempt_id → 重命名到 attemptId/questionKey → 算 SHA-256
  → 写 recordings_v2 → 校验成功后再删旧路径。

## 6. 相关代码位置（改动会涉及）

- electron/services/database.js —— 数据库连接与表结构判断
- electron/services/database-worker.js —— SQLite 工作线程
- electron/main.js —— 应用生命周期
- src/vue/platform/localPersistence.js —— 本地持久化
- src/vue/platform/storageLifecycle.js —— 存储生命周期（含删库逻辑，重点改）
- src/vue/stores/exam.js —— 考试会话状态
- 录音相关：src/vue/exam/composables/useRecorder.js

## 7. 完成标准（验收）

- [ ] 升级后旧数据完整保留（跑真实迁移测试，不删库）
- [ ] 同一套题可做多次，历史完整保存
- [ ] 同题重练不覆盖旧录音
- [ ] session 携带内容版本信息
- [ ] 断网可作答，联网后可同步（同步功能可在阶段 B 再接）

## 8. 提醒

- 改的是 toefl-app 仓库，注意和 watalioy 协调，避免他同时改动同一文件。
- 解析器抽 content-core（任务7）可以最后做，先解决 1-6 的数据安全问题。
- 改动前先 git 提交当前干净状态，每完成一项单独提交。
