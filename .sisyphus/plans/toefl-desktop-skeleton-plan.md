# TOEFL Reading Desktop Skeleton Plan (Ultra Worker, Desktop Skeleton)

目的：在不干扰当前网页端实现的前提下，提供一个最小可行的桌面端骨架，确保未来将网页应用打包成桌面应用（Electron）时，评分逻辑能无缝工作、可移植且可维护。

一、总体设计
- 核心思想：评分引擎作为前端可移植模块，与网页端使用同一份逻辑（src/score/reading_score_engine.js），在桌面端通过 Electron 的渲染进程运行，渲染进程读取同样的数据源（localStorage 或 Electron Store）并输出结果文本。
- UI 设计：桌面骨架提供一个容器，未来将网页应用的 UI 注入或通过一个 iframe/WebView 加载本地打包的网页资源。当前骨架以最小化的桌面界面为主，确保功能可验证性。
- 数据存储：浏览器端 localStorage 兼容性在桌面端通过 Electron Store 或本地存储映射实现。评分引擎不依赖服务器，完全离线可用。

二、最小可行的桌面骨架结构
- apps/desktop-skeleton/
  - package.json：包含 Electron 依赖与启动脚本
  - main.js：Electron 主进程，创建 BrowserWindow 加载本地前端应用
  - preload.js：暴露受控 API（如读取本地存储的简化接口）给渲染进程
  - index.html：桌面宿主页面，包含一个 iframe/容器用于加载网页端 UI（未来可替换为本地内嵌的网页应用资源）
  - webapp/（占位）: 未来将网页应用构建产物放入此目录，桌面端通过 file:// 路径加载

三、关键实现点（便于后续 Patch 与实现）
- 评分引擎复用：使用 src/score/reading_score_engine.js，确保在网页端和桌面端都可用
- 渲染进程的数据访问：在 preload.js 暴露一个简单的 API，用于读取/写入本地存储（如 electron-store），确保跨进程数据一致性
- UI 交互设计：index.html 作为宿主页，内部通过 iframe/内置容器展示网页应用的 UI，或直接加载网页端的静态资源（取决于你们的最终打包策略）
- 安全性：渲染进程禁用 Node 集成，Preload 脚本只暴露必要的 API，降低风险
- 打包与发布：以 Electron + Vite (或 Electron Forge/Builder) 方案为最佳实践，确保打包产物跨平台可用

四、离线打包清单（最小示例工程，确保日后本地验证有版本区分）
- 目录结构：apps/desktop-skeleton/，包含以下文件/目录：
  - package.json
  - main.js
  - preload.js
  - index.html
  - webapp/  (空目录，用于未来放置网页应用打包产物)
- 依赖安装：在 apps/desktop-skeleton/ 执行 npm install
- 启动命令：npm run start
- 验证步骤：
  1) 启动 Electron 应用，检查是否成功打开桌面窗口
  2) 进入结果页，检查 Reading 分数文本是否正确输出（来自评分引擎）
  3) 验证离线可用性：断网后仍能显示结果文本（依赖本地存储数据）
- 打包命令：
  - Windows/macOS/Linux：npm run build
- 版本区分：Plan 文档中记录版本号（如 desktop-skeleton-v1, desktop-skeleton-v1.1 等），确保后续合并和回退可追溯

五、Patch 清单（便于你在日后快速应用）
- Add: apps/desktop-skeleton/package.json
- Add: apps/desktop-skeleton/main.js
- Add: apps/desktop-skeleton/preload.js
- Add: apps/desktop-skeleton/index.html
- Add: apps/desktop-skeleton/webapp/  (空目录 / 备份示例)
- Add: .sisyphus/plans/toefl-desktop-skeleton-quickstart.md（快速开始说明）

六、验收标准（Desktop Skeleton）
- 桌面应用能成功启动，渲染进程能访问评评分引擎并输出 Reading 分数文本（Reading 分数 X / Y）
- 离线可用，加载本地存储数据并显示分数
- 与网页端保持统一的评分逻辑与取整规则
- UI 风格与网页端保持一致，文本显示简单明了

七、风险与对策
- 风险：与网页端的本地存储行为不一致（浏览器 vs Electron）。对策：建立一个本地存储适配层，在 Electron 中优先使用 electron-store，网页端保留 localStorage，评分引擎通过统一 API 访问数据。
- 风险：资源路径打包后访问困难。对策：使用相对路径，加载资源时通过 preload 暴露文件访问接口或将网页应用打包成静态资源直接在应用内嵌。
- 风险：跨平台兼容性。对策：尽量使用跨平台的 Electron 构建流程（如 electron-builder），避免平台特定 API。

如你确认，上述 Plan 将作为桌面骨架的正式执行入口。我将基于这个 Plan 进行 Patch 的提交、实现和验收，并在你要求的每一步给出验收证据与截图/日志。若你愿意，我也可以把 Plan 文档的 Patch 清单直接提交到代码库，以确保版本控制的可追溯性。 
