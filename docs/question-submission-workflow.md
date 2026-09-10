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
- 同一天多场次：文件夹与文件名追加 ` (N)` 场次后缀，如 `2026-02-01 (2)` / `reading-2026-02-01 (2).md`；
  `tpoId` 取完整文件夹名，首页显示 `TPO 02-01 (2)`
- 首页显示：日期 ID 显示为 `TPO 01-27`，Description 为 `2026 TOEFL Official Exam`
- 真题只在 **Official Tests** 面板（`panel === 'real'`），不进 Practice Tests

### 1.2 音频方案（原始音频 + 时间戳，优先）

> **推荐路线（2026-01-28 起）**：源音频质量好时，直接用**原始音频 + `>> play:` 时间戳**，
> 不再默认用 AI 复读。仅当原始音频被切割/有人声干扰（如听力 M2 Q6-7）才用 AI 补录。

- **Listening**：整段原始音频放同级目录（`listening-part1.m4a` / `listening-part2.m4a`），
  LCAR 每题 `>> play: 0:20 - 0:24`，对话/通知/讲座任务级 `>> play: 3:29 - 3:56`
- **Speaking**：降噪增强后整段 `speaking-2026-01-28.m4a` + 每题 `>> play:`
- AI 补录命名：`listening-convN.m4a`（Edge TTS 多角色合成）
- 音频与 markdown 同级目录，`collectDocumentAssets` 自动收集进内容包

### 1.3 音频后处理（人声增强）

- 原始音频 → **DeepFilterNet 降噪**（压键盘声等背景）→ **EQ + 响度归一 + 软限幅**
- 脚本参考：`C:\Users\lj115\AppData\Local\Temp\opencode\enhance-voice.py`（说话段 RMS 目标 -18.5dB，峰值 ≤ -1.5dB）
- 处理只改振幅不改时长，`>> play:` 时间戳不受影响
- 角色音色（AI 补录时）：Woman=`en-US-JennyNeural`，Man=`en-US-GuyNeural`，Professor=`en-US-ChristopherNeural`

---

## 2. 启动 / 预览（重要）

### 2.1 正确的 Electron 启动方式

> ⚠️ **预览前必须先构建 dist，且必须 `ELECTRON=true`（否则白屏）**：
> ```bash
> $env:ELECTRON = "true"
> npm run build
> ```
> `vite.config.js` 的 `base` 依赖该变量（`ELECTRON=true` → `'./'` 相对路径；否则 → `'/'` 绝对路径）。
> 裸跑 `npm run build`（无 ELECTRON）会产出绝对路径 `/assets/...` 的 `dist/index.html`，
> Electron `loadFile`（`file://`）把它解析成磁盘根目录 → JS/CSS 全 404 → **窗口白屏且"关不掉"**
> （渲染进程崩了，主进程 `close` 会一直等 `flushRendererData()`，超时弹 "Could Not Save Changes" 对话框）。
> 判断方法：打开 `dist/index.html`，资源引用必须是 `./assets/...`（相对），不是 `/assets/...`。

```bash
# 生产模式（加载 dist + 工作区内容），必须设置隔离 userData 才能看到工作区新题
$env:ELECTRON = "true"
$env:NODE_ENV = "production"
$env:TOEFL_PERF_USER_DATA = "C:\Users\lj115\AppData\Local\Temp\opencode\toefl-preview-userdata"
npx electron .
```

> 若预览窗口白屏/卡死：`Stop-Process -Name electron -Force` 杀干净，
> 并把隔离 userData 目录（`TOEFL_PERF_USER_DATA`）改名备份后清空重建（坏缓存也会导致白屏）。

> ⚠️ **必须带 `TOEFL_PERF_USER_DATA`**：
> - 不带 → Electron 用真实 userData，读**已安装的内容包**（旧版，无新题）
> - 带 → 用全新隔离目录，回退到**工作区内容**（能看到新题）
> - 重启后"真题消失"基本都是因为启动时漏了这个环境变量

> ⚠️ **必须用 `electron .`，不要用 `electron electron/main.js`**：
> - `electron .` 时 `app.getAppPath()` = 仓库根 → 内容协议候选命中 `assets/questions/compiled/manifest.json`
> - `electron electron/main.js` 时 `app.getAppPath()` = `electron/` 目录 → 清单 404
>   → 窗口显示 "Question bank unavailable / Could not read installed content (404)"
>   （2026-08-26 已把 `electron:dev` 脚本改为 `electron .`，见 package.json）

### 2.2 带 mock license server 的联调启动（序列号激活测试）

> 前提：先起 mock server（内存态，模拟真实 Web license 服务）。

```bash
# 一键方式（推荐）：起 mock(3002) + 隔离 userData + electron
.\scripts\dev-license.ps1

# 手动方式：
$env:PORT = "3002"
node scripts/mock-license-server.js          # 终端 1，常驻
# 终端 2：
$env:ELECTRON = "true"
$env:NODE_ENV = "production"
$env:TOEFL_PERF_USER_DATA = "C:\Users\lj115\AppData\Local\Temp\opencode\toefl-preview-userdata"
$env:TOEFL_API_BASE_URL = "http://localhost:3002"
npm run electron:dev
```

- **端口用 3002**，不用 3001（3001 常被 toefl-web 开发服务器占用，会造成 mock 启动失败）。
- mock server 内置测试序列号：`TEST-0000-0000-0001` / `TEST-0000-0000-0004`。
- 应用内点被锁定的官方真题 → 输入序列号 → 解锁。
- 检测完恢复未激活：设置页 →「解绑本机」。

### 2.3 更新真题后拉起测试窗口 — 常见问题排查

> 每次在别的窗口更新真题后，拉起测试窗口最容易踩的坑（均有实际发生记录）。

| 症状 | 根因 | 解决 |
| --- | --- | --- |
| build 报 `Unsupported reading task type in title: "..."` | 工作区有**另一窗口未提交的新真题**含 parser 不支持的题型（如 `Read a Sign`），`content-core/parsers/reading.js` 的 `TYPES` 未加 | 临时把 `assets/questions/` 下未提交的 `2026-xx-xx` 目录移到备份（build 后放回），或先给 `TYPES` 加该题型 |
| 窗口白屏 / JS/CSS 全 404 | 没用 `ELECTRON=true` 构建（`dist/index.html` 里是绝对路径） | 必须 `ELECTRON=true` + `npm run build` |
| "Question bank unavailable — Could not read installed content (404)" | 用 `electron electron/main.js` 启动，`app.getAppPath()` 指向 `electron/` 目录 | **必须 `electron .`**（见 §2.1） |
| 读到旧题库、新真题不显示 | 没设隔离 userData，读到已安装内容包 | 设 `TOEFL_PERF_USER_DATA` 隔离目录（见 §2.1） |
| 激活报 `Cannot POST /v1/licenses/devices/...` | **端口被占用**（常被 toefl-web / 其他服务），Electron 连到错误服务 | 先查端口：`Get-NetTCPConnection -LocalPort <port> -State Listen`；被占则换端口（如 `PORT=3010`）+ `TOEFL_API_BASE_URL` 对应 |
| 激活报「序列号无效或已作废」 | 用了 mock 码去打真实服务端，或连错地址 | 确认 `TOEFL_API_BASE_URL` 指向 mock（3002/3010），用 `TEST-0000-0000-0001` |
| 激活报「该序列号已达到 2 台设备上限」 | 旧 mock 进程残留、已绑满 2 台 | 杀干净端口监听者，重启 mock（`node scripts/mock-license-server.js`） |

**一键拉起（推荐）**：`.\scripts\dev-license.ps1`（自动：起 mock → 重置隔离 userData → ELECTRON=true build → `electron .`）。

**排查端口是否被占**：
```powershell
Get-NetTCPConnection -LocalPort 3002 -State Listen
Get-CimInstance Win32_Process -Filter "ProcessId=<上面拿到的 pid>" | Select-Object CommandLine
```

### 2.4 Electron 版本

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
- [ ] Electron 预览用的 dist 是 `ELECTRON=true` 构建的（`dist/index.html` 资源为 `./assets/...`）

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

> ⚠️ **发布后必须验证 manifest URL 可下载**（`curl -sI <pack.url>` 应返回 200）。
> 教训（2026-08-26）：pack id 曾含空格/括号（同一天多场次 `(2)`），GitHub 把上传资产名
> `tpo-2026-02-01 (2)-<hash>.zip` 自动改成 `tpo-2026-02-01.2.-<hash>.zip`，manifest 里 URL 仍是旧名
> → App 下载报 HTTP 404。`src/content/packs.js` 已通过 `sanitizePackId` 将 pack id 限定为
> `[a-z0-9-]`（`tpo-2026-02-01-2`），发布管线自动规避。详见 `docs/content-publishing.md`。

### 5.1 改回真实路线（测自动更新）

预览用隔离 userData 后，要测**真实用户自动拉取**：
- 停掉带 `TOEFL_PERF_USER_DATA` 的实例
- 用真实 userData 启动（不设该环境变量）→ Electron 从 GitHub `content` 分支拉新 manifest

---

## 5.5 发布安装包（重要教训）

> **⚠️ 发布应用版本必须走 CI，禁止本地手动 `electron:build` + `gh release create`。**
> 本地打包只能产 Windows，会丢失 macOS / Linux 全平台资产（v1.6.0 / v1.7.0 曾因此出错）。

### 5.5.1 正确流程（三平台全自动）

1. 代码先合并到 **`develop`** 分支（release.yml 的触发分支）
2. 打**注解 tag** `vX.Y.Z`（必须 = `package.json` 的 version，且 CHANGELOG 有对应条目）
3. `git push origin vX.Y.Z` → 触发 GitHub Actions `release.yml`
4. CI 自动：verify（tag 校验 + lint + test）→ package-windows / package-linux / package-macos 三平台并行构建 → publish 汇总（含 `hashes.sha256` + 各平台 `latest*.yml`，URL 自动代理到 `v6.gh-proxy.org`）

```bash
# 正确发布
git checkout develop
git merge --ff-only <feature-branch>   # 合并功能
git push origin develop                 # 会先触发一个 dev 预发布（正常）
git tag -a vX.Y.Z -m "release: vX.Y.Z"
git push origin vX.Y.Z                  # 触发正式三平台构建
```

### 5.5.2 已踩过的坑（勿重犯）

| 坑 | 现象 | 修复 |
|---|---|---|
| 本地手动打包 | 只产 Windows，release 缺 mac/linux | 走 CI tag 发布 |
| tag 指向旧 commit | CI verify 失败（tag ≠ package version 对应提交） | 用 `git tag -a` 打注解 tag 且指向最新合并提交 |
| `fs.cpSync` ESM 崩溃 | obfuscate 崩 `0xC0000409`（Windows） | 已改手动递归复制 `copyDirectory` |
| `electronDist` 覆盖 | CI 报 electronDist 不存在（CI 的 npm ci 未下载 dist） | 移除该配置，让 electron-builder 默认下载 |

### 5.5.3 回滚/修正已误发的 release

```bash
# 删除错误 release + 远端 tag
gh release delete vX.Y.Z --repo anton-bis/toefl-app --yes
git push origin --delete refs/tags/vX.Y.Z
git tag -d vX.Y.Z   # 仅本地有时
```

---

## 5.6 内容投递通道与分支对齐（防坑）

> **⚠️ 核心教训（2026-08-31，2026-02-02 "失踪"事件）：** "提交到 git 分支" ≠ "发布内容"。
> App 题库只认 `content` 分支的 `manifest.json`，与 git 的 develop / release 分支无关；
> content 清单是每次 `content:publish` **全量重建覆盖的快照**，只反映跑 publish 那个工作区的内容，不是各分支的并集。

### 5.6.1 认清两条投递通道（同一仓库，不同分支 + 两种通道）

| 通道 | 流程 | 消费端 |
| --- | --- | --- |
| App 更新 | develop / release → tag（v1.7.x）→ GitHub release 安装包 | electron-updater → App 二进制 |
| 内容更新 | `content:publish` → 编译当前工作区 markdown 成内容包 → 推 `manifest.json` 到 `content` 分支 | App 的 content-updater 拉清单 → 下载题库 |

> **让某套题上线 = 在该套题所属的那个分支上跑一次 `content:publish`。**
> 反例（2026-02-02）：题目只提交在 `develop`（commit 9c2bf3a，两套四科），但最后一次 publish 是在不含该 commit 的发布线上跑的（那条线只有 02-04+），`02-02` 便从清单里"消失"——表现为"这次整理丢了"。

### 5.6.2 判断"丢了"还是"在别的分支"（仓库根目录，只读）

```bash
# 历史上是否存在过（区分"丢失"与"在别的分支"）
git log --all --name-only | Select-String "<日期>"

# 现在在哪个分支
git ls-tree -r --name-only <分支> | Select-String "<日期>"

# 确认某 commit 是否属于当前分支（0=包含，1=不包含）
git merge-base --is-ancestor <commit> HEAD; echo $LASTEXITCODE

# 对比同一日期两场次是否一致（用 blob 哈希，最可靠）
git rev-parse "<分支>:<路径>"
```

**正确做法（不要重复整理，避免重复劳动与偏差）：**
从有内容的正确分支恢复文件进工作区，然后新建一次提交（题库 `.md` 是 git 跟踪的源文件，`content:publish` 强制要求先提交）：

```bash
git restore --source=<正确分支> --staged --worktree <路径>
# 恢复文件 → 更新 tests/content/content.test.js 的计数 → 重新生成 manifest
npm run content:manifest
npm test                 # 全绿
git add -A && git commit # 提交
npm run content:publish
```

### 5.6.3 多场次文件夹（`(N)`）与分支对齐要点

- **两场共享科目**：阅读 / 听力 / 口语同内容，**写作分套一 / 套二**。
  `2026-02-02` 与 `2026-02-02 (2)` 两个文件夹各放对应 md，content 按文件夹分组各自成包。
- **发布代码基线必须含 `sanitizePackId`**（`src/content/packs.js` 已实现）：pack id 自动变 `tpo-2026-02-02-2`（无空格无括号），否则 GitHub 资产名会 404（见 §5 教训）。
- **谁整理、谁发布要对齐分支**：题目 commit 到哪个分支，后续就在那个分支跑 `content:publish`；换分支跑会"漏"，甚至把已发布的内容从清单里剔除。

### 5.6.4 发布前预检 / 发布后验证

- 发布前：`npm run content:manifest` + pack 发现（`scripts/content-packages.js`），提前暴露"媒体缺失 / 解析失败"，避免发布中途失败。
- 发布后：`curl -sI <pack.url>` 应返回 200；确认远端 content 清单出现对应 `tpo-YYYY-MM-DD` 包，且包可完整下载。

### 5.6.5 自检判定（Writing 专项）

- **空格数 = 需填入的答案块数**（如 7 空格 → 答案用 7 块）。
- **Candidates 允许多于答案**：因存在**干扰项**（候选 ⊇ 答案），候选多于答案是正常、非错误；勿把"候选数 > 空格数"误判为问题。

---

## 6. 回滚预案

| 场景 | 回滚方式 |
|---|---|
| 代码/题目出错 | `git revert` / 切回旧 commit |
| 内容包发布失败 | 保留旧 manifest；重新 `content:publish` |
| 音频音质不满意 | 备份在 `D:\托福真题word版\2026.1.27\原始备份\`（含原始 + EQ 版） |
| parser 改坏 | 恢复 git 中旧 parser |

---

## 7. 音频处理工作流

### 7.1 原始音频增强（优先）

1. 源音频转 48kHz mono wav（`m4a2wav.py` / PyAV resampler）
2. **DeepFilterNet 降噪**（`df_enhance.py`）：压制键盘声等背景噪声
3. **人声增强**（`enhance-voice.py`）：EQ 提亮（2.8k/5.2k/8k）+ 说话段 RMS 归一（-18.5dB）+ 软限幅（峰值 ≤ -1.5dB）
4. 转回 m4a（`wav2m4a.py`），保持原时长

### 7.2 AI 补录（仅在原始音频不可用时）

```bash
pip install edge-tts   # 清华镜像
# 多角色对话用 PyAV 逐句合成 + 拼接（参考 listening-conv11 生成方式）
```

### 7.3 角色映射

| 角色 | 音色 |
|---|---|
| Woman / trainer | `en-US-JennyNeural` |
| Man / researcher | `en-US-GuyNeural` |
| Professor | `en-US-ChristopherNeural` |

### 7.4 质量要求

- 原始音频优先，增强只改振幅不改时长（时间戳不受影响）
- 说话段 RMS 达 -17~-19dB、峰值 ≤ -1.5dB，无失真/电流声
- 输出前先出**小样**给用户试听，确认响度/清晰度后再全量应用
