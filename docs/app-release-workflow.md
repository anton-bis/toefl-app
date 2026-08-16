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
