# AGENTS.md — TOEFL AI 批改平台开发行为准则

> 本文件约束 AI 开发者（及协作者）在本仓库内的一切编码行为。
> 与 `docs/WEB-PRD.md`（做什么）、`docs/database-design-v2.md`（数据层）、
> `docs/tech-design.md`（应用层）配套使用。开发时三份文档必须同时对照，
> 任何改动不得与之冲突；若有冲突，先同步更新文档再改代码。

---

## 1. 项目概述

TOEFL AI 批改平台：面向托福考生的口语与写作专项练习 + AI 批改 Web 应用。
前端 Vue 3 + TypeScript，后端 NestJS + Fastify + TypeScript，数据库 MySQL 8.0（Prisma ORM）。
核心链路：用户提交作文/录音 → 服务端存库 → 异步调 AI 评分 → SSE 推送 → 展示 6 分制结果。

---

## 2. 技术栈约定

### 2.1 必须使用
- 前端：Vue 3（组合式 API）+ Vite + Pinia + Vue Router + Tailwind CSS
- 后端：NestJS（Fastify 引擎）+ TypeScript
- ORM：Prisma（schema 与 `docs/mysql-schema-v2.sql` 保持一致）
- 数据库：MySQL 8.0（utf8mb4 / InnoDB）

### 2.2 禁止
- 禁止引入与上述技术栈冲突的框架（如 Redux、jQuery、绕过 Prisma 手写 SQL）
- 禁止使用 `any` 绕过 TypeScript 类型（新代码必须严格类型）
- 禁止内联 style，样式统一走 Tailwind
- 禁止硬编码敏感信息（见第 6 节）

---

## 3. 数据与标识约定

- ID：内部 BIGINT；对外 / URL 一律 ULID（CHAR(26)）；内容哈希 SHA-256。
- 时间：UTC `DATETIME(3)`，展示时前端转用户时区。
- 金额：最小货币单位整数（`_minor`），禁止浮点数。
- 状态字段：`VARCHAR + CHECK`，状态跳转必须由领域服务控制，禁止任意 UPDATE。

---

## 4. 硬性工程约束（违反即错误）

1. **不可变历史**：已提交的 attempt、grading_result、credit_ledger、audit_logs 绝不原地修改；修正走新版本 / 重评 / 冲正。
2. **幂等**：所有写操作（提交、评分、支付、额度）必须幂等。支付 webhook 必须先按事件 ID 去重。
3. **用户内容先落库**：作文 / 录音引用必须先保存到数据库，再调用 AI；任何异常不得丢失用户数据。
4. **禁止删库**：本地 SQLite 结构升级走 migration + 备份 + 回滚，禁止"结构不对就删库重建"。
5. **外键**：默认 RESTRICT，仅非核心从属关系用 SET NULL；财务 / 评分 / 审计数据禁止物理删除。
6. **评分展示**：对外只展示 6 分制（display_score）；0-5 原始分与 30 分制绝不暴露给用户或前端。
7. **admin 专项（管理后台开发约束）**：
   - 所有后台写操作必须经 RolesGuard 校验角色（admin / content_editor / finance）。
   - 高危操作（额度调整、退款、禁用用户、撤销 release、修改商品价格）必须写 audit_logs。
   - 越权访问返回 403，禁止静默降级或放行。
   - 管理员账号仅通过 roles 表授予，禁止在代码中硬编码管理员判断。

---

## 5. AI 评分管线要求

1. prompt 必须注入对应 rubric 版本（`rubric_versions`），并携带输出 schema 约束。
2. AI 返回必须通过 schema 校验；校验失败记入该 run 为失败并走重试，不直接写结果。
3. 重试不重复扣费；永久失败必须释放额度预占。
4. 评分结果分层保存：job → runs → result → dimension_scores，不可合并或省略。
5. 分数映射：raw_score（0-5）→ display_score（0-6）由 `score_mapping_version` 记录。
6. 润色规则（对齐 PRD）：Write Email / Academic Discussion / Interview 提供润色版；
   Listen and Repeat 不提供润色版，仅评分 + 发音 / 连读 / 口误反馈。
7. 重评创建新 grading_job，绝不覆盖旧结果。

---

## 6. 安全与隐私

- API Key（AI / 支付 / 存储）只存在于服务端环境变量或 secret manager，前端不可见、禁止硬编码。
- 密码用 Argon2id / bcrypt；token 只存哈希。
- 用户内容（作文 / 录音）访问必须鉴权；对象存储私有 bucket + 短期签名 URL。
- 日志禁止记录：完整作文、录音 URL、token、密码、支付密钥。
- 支付 webhook 必须验签；payload 入库前脱敏。

---

## 7. 错误处理规范

- 错误码 `DOMAIN:CODE` 格式（如 `CREDIT:INSUFFICIENT`），错误码清单见 `docs/tech-design.md` 第 12 节。
- 成功响应 `{ data }`，失败 `{ error: { code, message, requestId, details? } }`。
- 幂等冲突（同 key 不同请求）返回 409，不复用旧结果。
- API 失败对用户提示必须人性化安抚，不得让用户自责。

---

## 8. SSE 推送要求

- SSE 只做通知渠道，不承载数据；数据始终可从 REST 获取。
- 前端 EventSource 断线自动重连；结果页保留"刷新 / 重试"兜底。
- 事件类型遵循 `docs/tech-design.md` 第 9 节（grading.pending / processing / completed / failed / ping）。

---

## 9. 代码风格与结构

- 后端按 NestJS 模块组织（modules/ 下每个域一个模块），控制器薄、服务层承载业务逻辑。
- 前端组件用组合式 API；API 调用统一走 `packages/api-client`。
- 类型：新代码严格 TS；API 出参用 zod schema 声明并导出类型。
- 命名：组件 PascalCase，函数 / 变量 camelCase，常量 SCREAMING_SNAKE，表字段 snake_case。
- 每次 commit 前跑 `npm run lint` 与 `npm test`，确保通过。

---

## 10. 测试要求

- 关键路径必须有测试：注册 / 登录 / 提交 / 评分 / 支付 / 额度。
- 评分管线：mock AI provider，覆盖输出校验、重试、失败释放预占。
- 并发：额度不足时并发提交只有允许数量成功。
- 重放：webhook 重复推送不重复发放权益。
- 数据库：迁移可在空库执行、可回滚；SQLite 升级不删用户数据。

---

## 11. 文档同步

- 三份主文档（WEB-PRD / database-design-v2 / tech-design）是唯一权威。
- 任何影响数据模型、API、评分规则的改动，必须先更新对应文档，再改代码。
- 新增功能必须在 PRD 有对应条目，否则视为未授权变更。

---

## 12. 验收红线（上线前必须全绿）

- [ ] 所有 schema 变更通过 migration，无删库
- [ ] 同一 client_attempt_id 重传只创建一次
- [ ] 重复 webhook 不重复发放权益
- [ ] 用户内容在 AI 调用前已落库
- [ ] 对外不出现 0-5 或 30 分制
- [ ] 管理员高风险操作有 audit log
- [ ] lint + test 全绿
