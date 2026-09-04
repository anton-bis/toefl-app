# DEV-LOG — 项目连续开发日志（toefl-app / Electron 桌面端）

> 本文件是**贯穿整个项目的连续开发日志**（区别于 `CHANGELOG.md` 的按版本发布记录）。
> 用途：换窗口 / 换协作者 / 长时间后恢复时，先读本文即可快速接续上下文。
> 约定：**中文为主、中英夹杂**；每条会话尽量让下一个窗口的 AI 看懂"当时为什么这么做"。
>
> 配套文档：
> - 发布记录 → `CHANGELOG.md`（每版本 Added/Changed/Fixed）
> - 阶段专项 → `docs/phase-A-notes.md`、`docs/license-protocol-v1.md`
> - 工作流 → `docs/app-release-workflow.md`、`docs/question-submission-workflow.md`、`docs/content-publishing.md`
> - 工程准则 → `AGENTS.md`

---

## 0. 阅读指南（给下一个窗口的 AI）

1. 先看下面 **「最新状态速览」**——当前分支、版本、远端对齐情况、未完成事项。
2. 需要背景时翻 **「历史大事记」** 对应阶段。
3. **从 2026-09-02 起，每次会话按「会话记录」格式往下追加**（日期 + 主题），务必如实。
4. 任何"换窗口后继续推进"的任务，请先把本文读一遍再动手，避免重复劳动或误改。

---

## 1. 最新状态速览（最后更新：2026-09-02）

- **当前 checkout 分支**：`release/v1.7.5`（= 可发布线，无 license；package.json version = **1.7.8**）
- **develop（完整线，含 license/branding）**：HEAD `62d501d`，package.json version 仍为 **1.7.1**（一直未 bump，属正常）
- **GitHub 远端对齐**：`develop`、`release/v1.7.5`、`content` 均已 push（HEAD==远端）
- **最新正式版**：**v1.7.8**（2026-09-02，三平台已发布，latest.yml 走 v6 代理，用户可自动更新）
- **内容包 manifest**：`content-a3f17677d7bf`（含 7 套 2026-02 真题，minAppVersion 1.5.0）
- **重要状态**：**Web 端备案已通过**，Electron↔Web **license 激活互通已对齐**（首发范围=仅激活，不含 AI 批改/报告云存；Web 三端点已实现并回填确认）。重心正转回 Web 联动。
- **未完成事项 / 待办**：
  - [ ] 上线时切 Electron：`license-config.js` 的 `DEFAULT_API_BASE_URL` → 生产；`promoConfig.js` 的 `PROMO_JUMP_ENABLED` → true
  - [ ] 拿到真实序列号后做端到端联调（Web 兑换→Electron 激活→≤2 台→换机解绑→断网 30 天语义，可用 `LICENSE_DEVICE_GRACE_DAYS` 调小快速验证）；Web 已提供真实码 `V4Q8-4Q2V-KHNU-6GCS` / `UXSD-87NS-LXND-SF48`
  - [ ] 契约待统一项已同步：重复激活 token 以响应为准覆盖（见 `docs/license-protocol-v1.md` §2.1）；生产 API 基址待 Web 部署后回填

---

## 2. 历史大事记（按阶段/主题，补录）

> 说明：2026-09-02 之前为**按阶段/主题补录**（git log + 文档反推），粒度到"大事记"，精确到 commit 的记录从 2026-09-02 起才逐条展开。早期版本号与发布节奏以 git tag 为准，如需细节查 `CHANGELOG.md`。

### 2.1 项目诞生与早期架构（2026-04 ~ 2026-06）

- **2026-04-17**：初始化托福模考系统（`feat: 初始化托福模考系统`），同步 Git 行为准则。
- **2026-04 ~ 05**：HTML 静态页 + `generate_toefl_pages.js` 生成题目的旧架构；阅读评分系统、score cards、状态渲染、模板同步（Plan A-Next Fixes）。
- **2026-05-16 / v1.0.0**：4 合 1 脚本 merge 前备份点。
- **2026-06-18 ~ 06-24**：切换 `interceptFileProtocol` 内容回退、auto-update 流程、NSIS 打包；**v1.1.0 ~ v1.1.7** 反复打磨自动更新与 Windows/macOS 双平台 CI。
- **2026-06-24 / v1.2.0**：新增 **Typing 打字练习模块**（进度跟踪）。
- **2026-06-29 / v1.2.6**：加入 TPO 05–09 题库。

### 2.2 Vocabulary 模块与内容修补（2026-07 上旬）

- **v1.3.0（2026-07-03）**：新增 **Vocabulary 词汇模块**（sidebar/panels/switchPanel），修 file:// 下 vocab 路径。
- **v1.3.1 / v1.3.2（2026-07-06/13）**：LCAR 时间戳修复、Reading 格式修复。

### 2.3 Vue 3 / Vite 大迁移 + 架构精简（2026-07-14 ~ 07-18，v1.4.x）

- **2026-07-15**：PR `wtalioy/feat/vue3-vite-migration` → **迁移到 Vue 3 + Vite**；统一解析/持久化/技能助手；学术阅读可访问性；Windows 运行时资源复制。
- **2026-07-16 ~ 07-18**：统一练习工作区、锁定态组件；**big refactor**：剥离陈旧脚手架、引入**可扩展 AI 评分地基（electron/services/ai.js，NVIDIA completions）**、数据移入 **SQLite worker**、题目编译为运行时内容（`content-core` 雏形）、更新提醒/启动优化。
- **2026-07-17 / v1.4.1**：恢复保留的 ETS 评分 rubrics、稳定阅读排版、Reading 题号与 module 范围对齐。
- **2026-07-18 / v1.4.2**：runtime 内容出 ASAR、changelog 驱动 release notes、可选 macOS 签名。

### 2.4 内容独立发布 + 客观题评分抽取（2026-07-26，v1.5.x）

- **2026-07-26 / v1.5.0**：**题库内容独立发布**（`content-<hash>` release + `content` 分支 manifest，electron content-updater 拉取）；home 滚动收进内容区；catalog 保留编译元数据。
- **v1.5.1（同日）**：打包体积优化、develop 自动预发布（`-dev.N` prerelease）、prerelease 更新元数据稳定。
- **v1.5.2（2026-07-27）**：missing-letter 阅读任务刷新。

### 2.5 阶段 A：本地数据安全改造（2026-08-03 ~ 08-04，v1.6.0 前）

> 详见 `docs/phase-A-notes.md`（当时独立成阶段文档）。

- 引入 **版本化 SQLite migration**（替代"结构不对就删库重建"）。
- session 记录 client attempt id + 内容版本；完成作答固化为**不可变 pending snapshot**；录音绑定 attempt 并迁移旧录音。
- 抽取共享 `content-core`（parser/validator/scoring）。
- **2026-08-04**：merge 阶段 A 本地数据安全改造 → master。

### 2.6 真真题入库 + 音频体系 + 内容解析健壮化（2026-08-13 ~ 08-22，v1.6.0 ~ v1.7.1）

- **2026-08-13**：新增 **2026-01-27 四科真真题**；支持 announcement 题型、question/task 图片、speaker 头像。
- **2026-08-16 / v1.6.0**：2026-01-27 题库正式发布；听力/口语改**逐题 AI 音频**；date-folder 索引；reading/listening 修复。
- **2026-08-18 / v1.7.0**：Reading 渲染修复 + 音频增强 + **2026-01-28 题库**；修复 daily-life 渲染与 parser 类型（root-cause）。
- **2026-08-22 / v1.7.1**：结果网格、retake 修复、白屏守卫、writing 布局；**2026-02-01 四科真真题（AI 音频）**；daily-life 卡片标题泛化。

### 2.7 License 序列号激活体系 + develop/release 分叉（2026-08-24 起，重大）

> 详见 `docs/license-protocol-v1.md`（唯一契约，v1.0 定稿 2026-08-24）。

- **背景**：桌面端是付费商品（电商+微信销售），靠序列号激活（≤2 台设备）防安装包转发；license 接口**全部依赖 Web 服务端在线鉴权**，无 JWT，凭 code+设备指纹。
- **关键因果 → 分支分叉**：license 功能早已实现完成，但因 **Web 端网站备案未通过、不能上线**，license 无法真正生效，也一直**不能打包发布**。于是：
  - `develop` = 完整开发线，含 license E1-E7 / branding / 激活 UI 等全部代码（version 停在 1.7.1）。
  - `release/v1.7.x` = **无 license 的可发布线**，日常稳定功能从 release 打 tag 发布（1.7.2 → 1.7.5）。
  - 两条线**内容大量重复**（各自从早期分叉独立实现同功能），**不要直接 merge**；日常"同改两边、各自 commit"。
- **E1-E7（2026-08-24 ~ 08-25）**：E1 device fingerprint（node-machine-id）→ E3/E4 主进程激活 + safeStorage 持久化 + 周期续期 + IPC → E5 设置页设备列表/解绑 → E6 内容解锁 + 激活弹窗 + 路由守卫 → E7 mock license server + 集成测试 + 联调记录。
- **发布线进展（release/v1.7.2 ~ 1.7.5）**：
  - **v1.7.2（08-26）**：2026-02-01 (2) 题库、同日多场次 `(2)` 目录识别、录音修复、Tofu 品牌改名。
  - **v1.7.3（08-26）**：Reading module 计时改为按题型动态计算。
  - **v1.7.4（08-28）**：Writing build-sentence 修复 + 状态网格。
  - **v1.7.5（08-29）**：complete-words 结果卡按 module 作用域、daily-life 规范指令文案。

### 2.8 Reading 容器渲染体系演进（贯穿 08 月，多次迭代）

- daily-life 短语高亮（8-26）→ daily-life 卡片标题/页面标题泛化 → canonical instruction（"Read an email" 等，不再显示原始 task title）→ 结果页斜纹/方块等（见下）。
- 目的：日常阅读题（email / text-chain / social-media / label / receipt / sign / announcement / notice / advertisement / poster / review / instructions / form / web-page）各题型独立视觉容器 + 协调配色。

---

## 3. 会话记录

### 3.1 2026-09-02（周二）— Reading 渲染收尾 + 分支对齐 + 三个发布版 + 内容发布

> 这一天把「今天这批开发改动」落到 develop 与 release **两条线**，连发 v1.7.6 / v1.7.7 / v1.7.8 三版，并完成新真题内容包发布。请后续窗口务必先读 §2.7 理解分支模型。

**核心工作流决策（本日确立）**：
1. **双线同步提交**：发布走 release（无 license）；develop 保留 license 等 Web 上线。每次功能改动在**两条线各自 commit**（develop 为含 license 基底，release 为无 license 基底），**release 上的开发文件与 develop 对应版本尽量一致**。
2. **发布 = push tag `vX.Y.Z` 触发 CI**（release.yml 监听 develop push + `v*` tag push；实际发布靠 tag，develop push 只产 `-dev.N` 预发布）。
3. **内容（真题）走 content:publish**，与 App 代码更新独立；发布前必须 commit+push 当前分支且 HEAD==远端，且本地 content-state 与远端 manifest 一致。

**改动与提交**：

- **develop 4 笔**：
  - `d577e87` feat(reading): redesign 4 daily-life containers（sign/notice/advertisement/poster 配色：深绿/青蓝/暖橙/天蓝）+ fix phrase vocab 高亮 + hatch/slot results + **AcademicPassage vocab 高亮修复**
  - `43b5fab` feat(questions): 新增 2026-02-04/08/10/23/25/28 真题（reading & writing）
  - `a82f120` feat(home): 官方真题 ID 去掉 TPO 前缀（pending 卡同步）
  - `62d501d` feat(home): 题库列表分页（10 套/页，两模块独立）
- **release/v1.7.5 对应 + 发布版**：
  - `9121d26` 应用 reading 改动 → `4a2c6f2` **v1.7.6**（4 容器+高亮+斜纹/方块）
  - `f690738` 去 TPO 前缀 → `da70d35` **v1.7.7**
  - `3fd7085` 分页 → `263a5bb` **v1.7.8**
  - `aea699d` 真题同步、`c1c1bb7` sanitize pack id 修复

**v1.7.6 内容**（正式版）：4 容器重设计配色 + vocab 高亮修复（含撇号短语如 `what's in store` 完整高亮）+ AcademicPassage 高亮修复 + 结果页答错格斜纹 + complete-words 缺失字母方块。
**v1.7.7 内容**：Official Tests 表格 ID 去掉 "TPO" 前缀（显示 `01-27`/`02-01 (2)`），practice 保留。
**v1.7.8 内容**：Practice/Official 列表各 10 套/页分页，独立上一页/下一页 + `第 X / Y 页 · 共 N 套`，单页模块双按钮置灰。

**新真题内容包（7 套，reading+writing）**：
- 6 天 7 套：2026-02-04 / 02-08 / 02-08 (2) / 02-10 / 02-23 / 02-25 / 02-28。
- media：writing 每套 19 张 `avatar-*.png`（build-sentence 头像）；reading 2026-02-10 有 `sleep-chart.png`（chart_image）。
- 发布流程：release commit+push → `content:publish` → manifestId `a3f17677d7bf`，pack 数 23，minApp 1.5.0。

**本日踩坑（务必记住）**：
- **GitHub 会把 release 资产名里的 `(2)` 规范化成 `.2.`** → 首次发布时 `tpo-2026-02-08 (2)` 404。根因：release 的 `src/content/packs.js` 缺 `sanitizePackId` 调用（develop 早已修，release 是旧版）。已在 release `c1c1bb7` 修复后重新发布成功。→ **release 的分支版本文件可能落后 develop，做双线时注意比对这类内容管线文件。**
- develop 每次 push 会触发自动 `-dev.N` 预发布 CI，偶尔报 `no new commits since the last release`（--fail-on-no-commits）——**良性**，不影响真实 tag 发布。
- 双线同改时 **`HomeView.vue` 等文件两线内容不同**（develop 有 referral banner/license），**不能整文件复制**，要针对性编辑。

**其它**：新增单测 `tests/vue/home-pagination.test.js`（分页 4 项）、academic 撇号高亮用例等；lint + vitest + node:test 全绿后提交。

### 3.2 2026-09-02 — Web 端 license 激活互通回填与契约对齐

> 背景：Web 端备案已通过。我们发了一版「License 激活互通对齐 prompt」给 Web 窗口（见 §3.1 末尾的待办），Web 端回填了实现状态。本文记录回填结果与两端核对结论。

**Web 端回填（2026-09-02）**，详见 `docs/license-protocol-v1.md` §7.5/§8：

- **三端点均已实现**（activate / refresh / unbind），请求/响应形状与 Electron 客户端 `electron/services/license-client.js` **逐字一致**（已核对：activate body、refresh body、unbind path+body 全匹配）。
- **C-1（契约差异，关键）**：Web 端 DB 只存 token 的 SHA-256，**无法原样回吐旧明文 token** → 同设备重复 activate 会**旋转新 activationToken**（deviceId 不变、不新增、不误触上限）。契约 §2.1 原写"不重新签发 token"与 §7.4 已写"旋转新 token"**前后矛盾**，已统一为：**「重复激活返回原 deviceId + 新 token，客户端以响应为准覆盖持久化」**。Electron `activate()` 本就按响应覆盖并 `store.save`（license.js 184-196），**无代码改动**。若未来要「同设备恒同 token」，需两端改确定性 token 方案（暂不做）。
- **C-2（大小写）**：Electron `sha256(...).digest('hex')` 恒小写 → 服务端小写校验 `^[a-f0-9]{64}$` 兼容，无需改 Electron。
- **C-3（生产基址）**：开发 `http://localhost:3001` 一致；生产域名/路径**待 Web 部署后回填** → Electron 的 `DEFAULT_API_BASE_URL` 届时切生产。
- **序列号**：Web 脚本 `gen:licenses` 批发生成，DB 只存 sha256+tail，明文一次性输出；「支付成功自动发码」**未上线**（排下一轮），当前买 Web 权益不自动发 Electron 码。已提供真实码 `V4Q8-4Q2V-KHNU-6GCS` / `UXSD-87NS-LXND-SF48`（`TEST-0000-...` 无校验位会 404）。
- **范围确认**：本次仅激活互通，AI 批改/报告云存不在范围 ✅（与 Electron 现状一致：Electron 纯本地刷题 + 本地 SQLite，`electron/services/ai.js` 只是未被产品引用的 AI 地基脚手架）。
- **断网 30 天**：Web 已实现可配置宽限期环境变量 `LICENSE_DEVICE_GRACE_DAYS`（默认 30，支持小数如 0.01≈14 分钟，服务端 commit 4342fb0），客户端无需改动即可联调快速验证软过期+恢复。

**本日文档动作**：更新 `docs/license-protocol-v1.md`（§2.1 幂等语义统一、§7.5 联调状态、§8 待办与备案状态）+ 本文 DEV-LOG 快照与本节。

**下一步（等 Web 生产部署 + 真实联调）**：切 `DEFAULT_API_BASE_URL` 到生产、`PROMO_JUMP_ENABLED`→true → 用真实码做完整链路端到端。开发联调可用本地 mock（见 `question-submission-workflow.md` §2.2）。

---

## 4. 附：分支 / 版本 / 内容 速查

| 分支 | 定位 | package.json version | HEAD |
|---|---|---|---|
| `develop` | 完整开发线（含 license，未发布） | 1.7.1（一直未 bump） | 62d501d |
| `release/v1.7.5` | 可发布线（无 license） | 1.7.8 | 263a5bb |
| `content` | 内容 manifest（自动生成，勿手改） | — | a3f17677d7bf manifestId |

| tag | 日期 | 内容摘要 |
|---|---|---|
| v1.7.6 | 2026-09-02 | 4 容器配色 + vocab 高亮 + 斜纹/方块 |
| v1.7.7 | 2026-09-02 | Official ID 去 TPO 前缀 |
| v1.7.8 | 2026-09-02 | 题库分页 10 套/页 |
