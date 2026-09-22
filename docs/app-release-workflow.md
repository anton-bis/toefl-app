# 新版发布工作流（App Release Workflow）

> 本文档规范"代码/前端改动 → 版本号 → 打包 → 发布安装包 → 自动更新"全流程。
> 与 `docs/question-submission-workflow.md`（内容发布）配套：
> **内容发布**更新题库（音频/图片/markdown），**应用发布**更新代码（app.asar / 前端逻辑）。
> 安装版通过两种独立机制更新：
> - 内容更新：electron content-updater 拉取 GitHub `content` 分支 manifest
> - 代码更新：electron-updater 拉取 GitHub release 安装包（本文档）

---

## 1. 概念：内容更新 ≠ 代码更新

| | 内容更新 | 代码更新 |
|---|---|---|
| 更新什么 | 题库 markdown / 图片 / 音频（content pack） | 前端逻辑 / parser / app.asar |
| 触发方式 | `npm run content:publish` → 安装版自动拉取 | 发布新版安装包 → electron-updater |
| 生效范围 | 已有安装版直接生效 | 需安装版下载新安装包重启 |

**教训**：改了前端代码（如 HomeView 归类、图片渲染）只发内容包，安装版不会变——必须**发布新版安装包**。

### 1.1 CI 行为（`.github/workflows/release.yml`）

- **push `develop`**：只跑 `verify`（lint + 全量测试）。**不打包、不发版、不创建 Release**。
- **push `v*` 标签**：跑完整流程 `verify → package-windows / package-linux / package-macos → publish`（建 GitHub Release + 自动 OSS 镜像）。发版靠 tag，见 §3。

> 背景（2026-09-13 修复）：旧版对 develop push 会额外尝试产出 `-dev.N` 预发布，且用 `gh release create --fail-on-no-commits` 判断“有无新提交”。该判断比较的是仓库**最近一个 release**，而频繁的内容发布会产生 `content-<hash>` 预发布（content 分支、历史独立）→ 每次都误报 `no new commits since the last release`，导致 develop push 的 Release run **publish 失败**、并白白跑完三平台打包。现改为 job 级 `if: startsWith(github.ref,'refs/tags/')` 门禁：develop push 只 verify。

> 补充（2026-09-21）：`oss-mirror.yml`（"Mirror desktop updates to Aliyun OSS"）**仅保留 `workflow_dispatch` 手动触发**。它曾被 `release: published` 触发，而内容发布会创建 `content-<hash>` 预发布 → 每次都跑去下桌面资产、报 `no assets match the file pattern` 失败并发失败邮件。桌面镜像由 release.yml 在正式 tag 时自动完成；只有需要手动补镜像某个 tag 时才跑 `oss-mirror.yml`（并会拒绝 `content-*` 标签）。

---

## 2. 发布前准备

### 2.1 版本号

```bash
# package.json 的 version，如 1.5.2 -> 1.6.0
# 规则：功能/内容改动 bump minor（x.y.z -> x.(y+1).0）
```

### 2.2 CHANGELOG.md

- 在 `## [Unreleased]` 下方新增 `## [X.Y.Z] - YYYY-MM-DD`
- 分 `### Added` / `### Changed` / `### Fixed` 记录

### 2.3 必跑命令（全绿）

```bash
npm test
npm run lint
npm run build
```

---

## 3. 打包（Windows）

```bash
# 方式一：完整打包（推荐，含 obfuscate）
npm run electron:build

# 方式二：仅 Windows NSIS
npm run release:windows
```

产物在 `release/`：
```
TOEFL-iBT-Practice-<version>-windows-x64-setup.exe
TOEFL-iBT-Practice-<version>-windows-x64-setup.exe.blockmap
latest.yml
```

> ⚠️ 前置：`node_modules/electron/dist` 必须是 Electron 43.x（支持 `node:sqlite`）。
> 若缺失：`$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"; node node_modules/electron/install.js`

---

## 4. 发布安装包到 GitHub

### 4.1 先提交 + 推送代码

```bash
git add package.json CHANGELOG.md <改动文件>
git commit -m "release: vX.Y.Z <摘要>"
git push origin <branch>
```

### 4.2 创建 GitHub release（Windows 安装包）

```bash
gh release create vX.Y.Z \
  "release/TOEFL-iBT-Practice-<version>-windows-x64-setup.exe" \
  "release/TOEFL-iBT-Practice-<version>-windows-x64-setup.exe.blockmap" \
  "release/latest.yml" \
  --repo anton-bis/toefl-app \
  --title "TOEFL iBT Practice vX.Y.Z" \
  --notes "来自 CHANGELOG 的摘要"
```

### 4.3 latest.yml 代理 URL

`latest.yml` 里的 `url` 指向 GitHub release 下载地址，需通过代理（`v6.gh-proxy.org`）保证安装版能下载：

```bash
node scripts/proxy-update-metadata.js release/latest.yml
```

---

## 5. 安装版自动更新

- 安装版 electron-updater 读取 `app-update.yml` 的 publish URL
- 检测到新版本 → 下载安装包 → 重启应用
- **验证**：安装版启动后应提示/自动更新到新版本

---

## 6. 回滚预案

| 场景 | 回滚 |
|---|---|
| 代码 bug | 发布上一版本安装包 |
| 内容包问题 | 重新 `content:publish`（内容与代码独立） |
| 打包失败 | 检查 Electron 二进制、node_modules、磁盘空间 |

---

## 7. 验收清单

- [ ] `npm test` / `lint` / `build` 全绿
- [ ] 版本号已 bump、CHANGELOG 已更新
- [ ] 开发版（隔离 userData + `electron .`）验证功能正常
- [ ] Windows 安装包生成成功
- [ ] GitHub release 创建成功（含 setup.exe + blockmap + latest.yml）
- [ ] latest.yml URL 已代理
- [ ] 安装版自动更新到新版本并验证功能
