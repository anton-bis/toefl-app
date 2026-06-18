# 托福模考系统 - AGENTS.md

## 项目概述
托福模考软件，第一阶段为静态版（LocalStorage 存储），第二阶段计划前后端分离。

## 技术栈
- **构建**: Vite 5 + Electron 28
- **模板**: Handlebars（HTML 生成）
- **语言**: 原生 JS（ES Module，`type: "module"`）
- **代码规范**: ESLint + Prettier

## 项目结构
```
src/
  core/         # loader.js, parser.js, store.js, router.js, timer.js, utils.js
  modules/      # reading/, listening/（按模块划分）
  components/   # UI组件（函数式编程）
  services/     # database.js, license.js
  score/        # 评分模块
electron/       # main.js, preload.js
templates/      # Handlebars HTML模板
scripts/        # obfuscate.js（Electron代码混淆）
```

## 路径别名（vite.config.js）
- `@` → `src/`
- `@core` → `src/core`
- `@modules` → `src/modules`
- `@components` → `src/components`
- `@services` → `src/services`
- `@electron` → `electron`

## 关键命令
- `npm run dev` — Vite 开发服务器（端口 3000，局域网可访问）
- `npm run build` — 构建到 `dist/`（生成文件需 < 100KB）
- `npm run electron:dev` — `vite build && electron electron/main.js`
- `npm run electron:build` — 完整打包：`vite build → obfuscate.js → electron-builder`
- `npm run lint` — `eslint src --ext .js`
- `npm run format` — `prettier --write src/**/*.js`
- `npm run sisyphus` — 调用 Sisyphus 代理（需安装 oh-my-openagent 插件）

## 页面生成
根目录有多个生成脚本（ES Module 格式）：
- `generate_pages_esm.js` — 从 Markdown 生成 HTML（题库：`assets/questions/reading/reading-2026-test-01.md`）
- 生成的 HTML 文件输出到项目根目录

## Electron 注意事项
- **生产环境**：`base: './'`（相对路径），关闭 sourcemap，移除 console
- **入口**: `electron/main.js`（使用 `electron-store`, 可选 `better-sqlite3`）
- **构建输出**: `release/` 目录，使用 asar 打包
- **代码混淆**: `scripts/obfuscate.js`（构建前执行）
- **应用权限**：Electron 打包后需在 `electron/main.js` 中预授权以下权限，避免运行时弹窗：
  - **麦克风权限**：通过 `session.setPermissionRequestHandler` 对 `media` 类型自动放行
  - **音频输出**：无需额外权限，`<audio>` 标签默认可用
  - **本地存储**：`localStorage` / `electron-store` 默认可用，无需权限
  - 示例配置：
    ```js
    const { session } = require('electron');
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
      if (permission === 'media') return callback(true);
      callback(false);
    });
    ```
  - **语法说明**：`callback(true)` 是 Electron 旧版回调风格。若 IDE 报 `callback` 弃用警告，改用新版 Promise 风格：
    ```js
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
      if (permission === 'media') callback(true);
      else callback(false);
    });
    ```
    两种写法功能完全等价。

## Speaking 模块
- **生成脚本**: `generate_speaking_pages.js --tpo=XX`
- **题库位置**: `assets/questions/speaking/TPO-XX/speaking-TPO-XX.md`
- **图片命名**: 自由命名，Markdown 中 `image:` / `scenario_image:` 字段对齐即可
- **音频支持**: 单文件 + 时间戳（`>> play: MM:SS-MM:SS`，与 Listening 格式一致）
- **题型**: Listen and Repeat（7 题）+ Take an Interview（4 题），总计 11 题
- **Response Time**: LR: Q1-2=8s, Q3-5=10s, Q6-7=12s；Interview: Q8-11=45s
- **录音功能**: 使用 MediaRecorder API，stream 缓存复用避免重复弹窗
- **环形进度动画**: `requestAnimationFrame` 驱动，60fps 丝滑填充

## 开发须知
- 所有数据当前存储在 LocalStorage（第一阶段）
- 无测试配置（`npm test` 仅输出错误）
- Node >= 16，npm >= 8
- 函数式组件，无类组件