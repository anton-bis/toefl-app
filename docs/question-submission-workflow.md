# 真题提交工作流（Question Submission Workflow）

> 本文档规范"真题整理 → 音频处理 → 验证 → 提交 → 发布 → 自动更新"全流程。
> 每次提交真题都必须按此流程执行，确保可复现、不出错。
> 配套：`docs/question-organization-notes.md`（打标规则）、`docs/database-design-v2.md`（数据层）。

---

## 1. 概念与命名约定

### 1.1 目录结构

真真题（非 ETS 官方 TPO）用**日期文件夹**命名：

```
assets/questions/reading/2026-01-27/reading-2026-01-27.md
assets/questions/listening/2026-01-27/listening-2026-01-27.md
assets/questions/speaking/2026-01-27/speaking-2026-01-27.md
assets/questions/writing/2026-01-27/writing-2026-01-27.md
```

- 文件与文件夹同名：`<section>-<YYYY-MM-DD>.md`
- 首页显示：日期 ID 显示为 `TPO 01-27`，Description 为 `2026 TOEFL Official Exam`
- 真题只在 **Official Tests** 面板（`panel === 'real'`），不进 Practice Tests

### 1.2 音频命名（AI 复读版，每问独立）

- **Speaking**：每题一个 `speaking-qN.m4a`（N=1..n）
- **Listening LCAR**：每题一个 `listening-qN.m4a`（M2 用 `listening-m2qN.m4a`）
- **Listening 对话/通知/讲座**：每任务一个 `listening-convN.m4a` / `listening-annN.m4a` / `listening-talkN.m4a`
- 音频与 markdown 同级目录，`collectDocumentAssets` 自动收集进内容包

### 1.3 AI 版音频特性

- **每问独立音频，无时间戳**：markdown 里每题 `audio: xxx.m4a`，不加 `>> play:`
- **兼容两种模式**：parser 同时支持"整体音频 + `>> play:` 时间戳"和"每题独立 audio"
- 角色音色：Woman=`en-US-JennyNeural`，Man=`en-US-GuyNeural`，Professor=`en-US-ChristopherNeural`

---

## 2. 启动 / 预览（重要）

### 2.1 正确的 Electron 启动方式

```bash
# 生产模式（加载 dist + 工作区内容），必须设置隔离 userData 才能看到工作区新题
$env:ELECTRON = "true"
$env:NODE_ENV = "production"
$env:TOEFL_PERF_USER_DATA = "C:\Users\lj115\AppData\Local\Temp\opencode\toefl-preview-userdata"
npx electron .
```

> ⚠️ **必须带 `TOEFL_PERF_USER_DATA`**：
> - 不带 → Electron 用真实 userData，读**已安装的内容包**（旧版，无新题）
> - 带 → 用全新隔离目录，回退到**工作区内容**（能看到新题）
> - 重启后"真题消失"基本都是因为启动时漏了这个环境变量

### 2.2 Electron 版本

- 必须用 **Electron 43.x**（`package.json` 声明 `^43.1.0`）
- `node_modules/electron/dist` 里必须是 43（内置 Node 24，支持 `node:sqlite`）
- 若二进制缺失，用镜像安装：
  ```bash
  $env:ELECTRON_MIRROR = "https://npmmirror.com/mirrors/electron/"
  node node_modules/electron/install.js
  ```

---

## 3. 提交前检查清单

### 3.1 必跑命令（全绿才提交）

```bash
npm test          # node:test + vitest 全量
npm run lint      # eslint，--max-warnings=0
node scripts/generate-question-manifest.js   # 输出 "Question manifest: N documents"
```

### 3.2 内容校验

- manifest 文档数 = TPO 文档数 + 日期文档数（如 32 + 4 = 36）
- 四科 markdown 用 content-core parser 解析无报错
- 音频文件与 markdown 引用一一对应（`resolveQuestionAsset` 能找到）

### 3.3 已知问题检查项

- [ ] 无 `recordingRepository.removeSession` 残留（应为 `removeAttempt`）——此前已修复
- [ ] Electron 43 下 `content-protocol-integration` 测试自动 skip（已知，不阻塞）
- [ ] 完形填空框数 = 答案需填字母数（转义下划线 `\_` 样式）
- [ ] Announcement/Notice 正文编号列表不被误判为题目

---

## 4. 提交规范

### 4.1 哪些文件提交（进 git）

| 文件 | 说明 |
|---|---|
| `assets/questions/<section>/<日期>/*.md` | 四科题目 Markdown |
| `content-core/parsers/*.js` | parser 改动（如每题独立 audio） |
| `src/vue/...` | 前端渲染改动 |
| `docs/*.md` | 文档同步 |
| `tests/**` | 测试 |

### 4.2 哪些文件不提交（不进 git）

| 文件 | 说明 |
|---|---|
| `assets/questions/**/*.png` | 图片（`.gitignore` 已忽略，属内容包发布物） |
| `assets/questions/**/*.m4a` | 音频（同图片，属内容包发布物） |
| `assets/questions/compiled/` | 编译产物（可重建） |

### 4.3 提交顺序

1. 代码/文档改动（parser、前端、docs）一笔
2. 题目 Markdown 内容一笔
3. 测试更新一笔（如有）

commit message 参考：
```
feat(content): support per-question audio for listening/speaking
feat(questions): add 2026-01-27 real exam four-section question bank (AI audio)
```

---

## 5. 发布到 GitHub（内容包）

```bash
# 前置：gh CLI 已登录、当前分支已 commit + push
npm run content:publish
```

- 生成 content pack → GitHub release（`content-<hash>` tag）→ 更新 `content` 分支 manifest
- `gh` 需登录（`anton-bis`，scope 含 `repo`）

### 5.1 改回真实路线（测自动更新）

预览用隔离 userData 后，要测**真实用户自动拉取**：
- 停掉带 `TOEFL_PERF_USER_DATA` 的实例
- 用真实 userData 启动（不设该环境变量）→ Electron 从 GitHub `content` 分支拉新 manifest

---

## 6. 回滚预案

| 场景 | 回滚方式 |
|---|---|
| 代码/题目出错 | `git revert` / 切回旧 commit |
| 内容包发布失败 | 保留旧 manifest；重新 `content:publish` |
| 音频音质不满意 | 备份在 `D:\托福真题word版\2026.1.27\原始备份\`（含原始 + EQ 版） |
| parser 改坏 | 恢复 git 中旧 parser |

---

## 7. 音频处理（AI 复读版）工作流

### 7.1 生成

```bash
# edge-tts 环境
pip install edge-tts   # 清华镜像
python scripts/ai-audio/generate.py   # 或项目对应脚本
```

### 7.2 角色映射

| 角色 | 音色 |
|---|---|
| Woman / trainer | `en-US-JennyNeural` |
| Man / researcher | `en-US-GuyNeural` |
| Professor | `en-US-ChristopherNeural` |

### 7.3 质量要求

- 每问独立 m4a，时长正确，无"电流声"伪影
- 若 AI 版音质不达标，可回退 EQ 版（备份中）或调整后处理
