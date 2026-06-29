# GitHub 提交准则 v1.0

> 适用于 TOEFL iBT Practice System 的 App 更新与 Content 更新发布流程。

---

## 一、CI 构建流程

### 触发条件

- `git push` tag 匹配 `v*` → 自动触发构建
- GitHub Actions → `workflow_dispatch` → 手动触发（仅出包，不发 Release）

### 构建流水线

```
git tag v1.2.5 → push
  ├── build-windows (windows-latest)
  │     ├─ npm ci
  │     ├─ 生成四大 TPO 页面
  │     │   ├─ node generate_toefl_pages.js     → index.html + Reading 页面
  │     │   ├─ node generate_listening_pages.js  → Listening 页面
  │     │   ├─ node generate_speaking_pages.js   → Speaking 页面
  │     │   └─ node generate_writing_pages.js    → Writing 页面
  │     ├─ vite build (ELECTRON=true, base='./')
  │     ├─ node scripts/obfuscate.js
  │     └─ electron-builder --win → release/*.exe + latest.yml
  │
  ├── build-mac (macos-latest)
  │     └─ 同上流程 → release/*.dmg + release/*.zip + latest-mac.yml
  │
  └── publish-release (needs: [build-windows, build-mac])
        ├─ 下载两端 artifact → 合并到 release-files/
        └─ softprops/action-gh-release → 创建 GitHub Release (Published)
```

### 关键产物

| 文件 | 用途 |
|------|------|
| `release/latest.yml` | Windows 端 `electron-updater` 检测版本号 |
| `release/latest-mac.yml` | macOS 端同上 |
| `release/*.exe` | Windows 安装包 |
| `release/*.dmg` | macOS 首次安装 |
| `release/*.zip` | macOS 自动更新用（解压替换 .app 包） |
| `release/*.blockmap` | 增量更新映射 |

---

## 二、必须同步更新的三个文件

每次发布一个新版本，**以下三个文件的版本号和更新日志必须完全一致**：

### 1. `package.json`

```json
{
  "version": "1.2.5",
  ...
}
```

- `electron-builder` 读取此字段生成 `latest.yml` 中的 `version` 行
- `electron-updater` 对比此字段判断是否有新版本
- 忘记改这里 → `latest.yml` 版本号错误 → 用户收不到更新

### 2. `generate_toefl_pages.js`

```
第 1780 行附近：<div class="log-version">V1.X.Y</div>
```

- CI 构建时此脚本会**完整重写** `index.html`
- 此文件的 changelog 是打包版本的最终更新日志
- 修改 index.html 的 changelog 时必须同步修改此文件

### 3. `index.html`

```
第 830 行附近：<div class="log-version">V1.X.Y</div>
```

- 本地 `npm run dev` 使用的版本
- changelog 格式需与 `generate_toefl_pages.js` 保持一致

### Changelog 格式规范

```html
<div class="log-entry">
  <div class="log-version">V1.2.5</div>
  <div class="log-date">2026-06-24</div>
  <div class="log-detail">一句话概述新版本内容。</div>
</div>
```

按版本**从新到旧**排列，最新条目放在 `V1.1.7` 之前。

---

## 三、发布检查清单

### 发布前（每次必须逐项确认）

- [ ] **`package.json`** — `version` 已更新为新版本号
- [ ] **`generate_toefl_pages.js`** — changelog 已添加新条目
- [ ] **`index.html`** — changelog 已添加新条目（内容与上条一致）
- [ ] **Git 状态** — 无未提交的修改（`git status`）

### 提交与推送

```bash
git add -A
git commit -m "chore: bump to v1.2.5 with changelog"
git tag v1.2.5
git push origin master
git push origin v1.2.5
```

注意：`git push v1.2.5` 必须和推送 master 分开执行，否则 tag 可能没推上去。

### 发布后验证

- [ ] GitHub Actions 两个 build jobs 均显示绿色
- [ ] Release 状态为 **Published**（非 Draft）
- [ ] Release Assets 包含：`latest.yml` + `latest-mac.yml` + `.exe` + `.dmg` + `.zip`
- [ ] 安装包文件名中的版本号与 `package.json` 一致（如 `toefl-practice-system-setup-1.2.5.exe`）
- [ ] 打开旧版本 App → 等待 5 秒或菜单 **帮助 → 检查更新** → 弹窗提示新版本

---

## 四、Auto-Update 机制

### 工作流程

```
用户 App（v1.2.0）
  → autoUpdater.checkForUpdates()
    → GET https://github.com/OWNER/REPO/releases/latest/download/latest.yml
      → 读取 version 字段
        → version > 当前 App version → 弹出更新通知
        → version == 当前 App version → 无更新
```

### `latest.yml` 文件内容示例

```yaml
version: 1.2.5
files:
  - url: toefl-practice-system-setup-1.2.5.exe
    sha512: abc123...
    size: 148484506
path: toefl-practice-system-setup-1.2.5.exe
releaseDate: 2026-06-24T13:19:33Z
```

此文件由 `electron-builder` 在 CI 构建时自动生成，**无需手动编辑**。

### 更新检查频率

| 版本 | 检查方式 |
|------|---------|
| < v1.2.2 | 仅在启动 5 秒后检查一次 |
| >= v1.2.2 | 启动 5 秒后首次检查，之后每 10 分钟轮询 |

用户也可通过菜单栏 **帮助 → 检查更新** 手动触发。

### macOS 自动更新特殊要求

`electron-updater` 在 macOS 上执行原地更新时**必须使用 zip 文件**，DMG 仅适用于首次安装：

| 格式 | 用途 | 更新流程 |
|------|------|---------|
| `.dmg` | 首次安装（用户双击挂载） | 手动拖拽 `.app` 到 `/Applications` |
| `.zip` | 自动更新（electron-updater） | 下载 → 解压 → 原地替换 `.app` → 重启 |

因此 `electron-builder` 的 `mac.target` 必须配置为 `["dmg", "zip"]`，**两种缺一不可**。

> **常见报错**：若只构建 DMG，`latest-mac.yml` 中无 zip 引用，`electron-updater`（MacUpdater）将抛出
> `"ZIP file not provided"`，导致用户更新失败。

---

## 五、特殊情况处理

### 场景 A：同 tag 重发（覆盖旧 Release）

如果发现已发布的版本有问题，需要重新构建同一版本号：

1. 在 https://github.com/OWNER/REPO/releases 手动删除旧 Release
2. `git push origin --delete v1.2.X`（删除远程 tag）
3. `git tag -d v1.2.X`（删除本地 tag）
4. 修复问题，重新 commit
5. `git tag v1.2.X`（重建 tag 指向新 commit）
6. `git push origin master && git push origin v1.2.X`
7. CI 重新构建 → 新 Release 创建

仅在 `package.json` 版本号不变时使用。如果改了版本号，必须发新版号。

### 场景 B：删除过时的 Release

旧 Release 会干扰 `electron-updater` 的 `latest.yml` 检测。发布新版本后，建议删除过时 Release：
- 打开 https://github.com/OWNER/REPO/releases
- 找到旧版本 → 右侧 `...` → Delete

### 场景 C：仅改 changelog 不换版本号

**不可行。** `electron-updater` 靠版本号判断更新，内容变了但版本号不变 → 用户收不到推送。必须发新版号。

---

## 六、常见错误速查

| 症状 | 根因 | 修复 |
|------|------|------|
| 用户收不到更新通知 | `package.json` version 没改 | 改版本号 → 重新发版 |
| 更新日志缺失或不对 | 忘了同步 `generate_toefl_pages.js` | 同步修改 → 重新发版 |
| CI 没有触发 | 只 push 了 master，忘了 push tag | `git push origin vX.Y.Z` |
| Typing 侧边栏打包后消失 | `generate_toefl_pages.js` 模板缺少 Skills 区域 | 确保模板中包含 sidebar Skills 分区 |
| TPO Writing/Speaking 打包后空白 | 生成脚本只支持 TPO 01 | 确保脚本有 `tpoMode = 'all'` 自动发现逻辑 |
| Typing 语料打包后空白 | `loader.js` 在 Electron file:// 下路径不对 | `if (file:) fullPath = '../' + fullPath` |
| Release 变成 Draft | 删了远程 tag 但没删 Release | 先删除旧 Release 再重推 tag |
| `latest.yml` 下载次数很高 | **正常现象**，是 App 轮询检查更新 | 无需处理 |
| macOS 更新报错 `ZIP file not provided` | 只构建了 dmg，缺 zip | `package.json` 中 `mac.target` 改为 `["dmg", "zip"]` |

---

## 七、本地 Dev 模式注意事项

- `npm run dev` → Vite 开发服务器（`localhost:3000`）
- 不会加载 `electron/preload.cjs` → `window.electronAPI === undefined`（正常现象）
- `generate_toefl_pages.js` 不会覆盖本地的 `index.html`（仅在 CI 中运行）
- 如需生成本地 TPO 页面测试：`node generate_toefl_pages.js`（会覆盖本地 `index.html`！）

---

## 八、快速命令参考

```bash
# 发布新版本（标准流程）
git add -A
git commit -m "chore: release vX.Y.Z"
git tag vX.Y.Z
git push origin master
git push origin vX.Y.Z

# 删除远程 tag
git push origin --delete vX.Y.Z

# 删除本地 tag
git tag -d vX.Y.Z

# 检查当前 tag 指向哪个 commit
git log --oneline --decorate -5

# 查看本地 package.json 版本
node -e "console.log(require('./package.json').version)"
```
