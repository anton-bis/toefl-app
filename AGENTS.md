# 托福模考系统

## 技术栈

- Vue 3 + Pinia + Vue Router
- Vite 7
- Electron 43
- Node Test Runner + Vitest
- ESLint + Prettier

## 目录

```text
src/
  ai/            平台无关的 AI 评分规则与领域模型
  content/       Markdown 题库解析、校验与统一内容模型
  vue/
    components/  通用 UI
    exam/        四科考试组件、组合式逻辑与共享组件
    platform/    内容、IndexedDB、LocalStorage、导入导出
    skills/      打字与词汇专项练习
    stores/      Pinia stores
    views/       路由页面
electron/
  main.js        主进程、IPC、更新与内容协议
  preload.cjs    最小化渲染进程 API
  services/      内容更新与安全路径处理
assets/questions/ Markdown 题库和运行时媒体
scripts/         内容维护、构建检查与 Electron 混淆脚本
tests/           Node 与 Vitest 测试
```

## 当前版本

v1.4.1（Vue 3 重构版），Node >= 24。

## 常用命令

- `npm run dev`：生成题库清单并启动 Vite 开发服务器
- `npm run build`：生产构建并检查每个 JS/CSS 文件不超过 100KB
- `npm test`：Node（54）+ Vitest（93）共 147 个测试
- `npm run lint`：检查 Vue、内容解析和 Electron 代码
- `npm run electron:dev`：构建后启动 Electron
- `npm run electron:build`：构建、混淆并打包 Electron

## 新工作流（与旧架构的关键区别）

| 旧架构（v1.3.x 之前） | 新架构（v1.4.0） |
|----------------------|-----------------|
| 改完题库 → 跑 `generate_*.js` 脚本 | **直接改 Markdown 文件即可**，`src/content` 运行时自动解析 |
| 修改 `src/core/`、`src/modules/` 下的 JS | 修改 `src/vue/` 下的 `.vue` 和 `.js` |
| `npm run dev` 用于开发前端 | `npm run dev` 生成清单后启动 Vite |
| 加新 TPO → 写 Markdown + 跑生成脚本 | 加新 TPO → 只写 Markdown（放到 `assets/questions/` 下） |
| 无正式测试 | `npm test` 覆盖全部 147 个测试 |

## 加新 TPO 题库步骤

1. 在 `assets/questions/` 下创建 `TPO-XX/` 目录
2. 放入 Markdown 文件（参考已有 TPO 格式）
3. 运行 `npm run dev` 验证是否能正常解析
4. 运行 `npm test` 确保内容测试通过
5. 提交到仓库

## 架构约束

- `index.html` 只加载 `src/vue/main.js`，不要恢复旧静态页面或原生 JS 前端。
- 题库 Markdown 由 `src/content` 在运行时解析；不要生成或提交逐页 HTML。
- UI、CSS 和交互行为需要保持稳定，内部实现优先复用小而清晰的 Vue 组件。
- LocalStorage 只保存设置与当前会话快照；增长型数据存入 `toefl-data` IndexedDB。
- Speaking 录音存入 IndexedDB，不得把 Blob 或 base64 写入 LocalStorage。
- Electron preload 只暴露当前渲染进程实际使用的 IPC；新增接口时同步验证主进程调用方。
- 生产环境使用相对 `base`、关闭 sourcemap，并通过 `toefl-content:` 协议读取可更新内容。
- 麦克风权限只对可信应用 URL 的 audio media 请求放行。

## 修改要求

- 使用 `rg` 查找引用，删除代码前确认入口、测试、脚本和 Electron 均无调用。
- 不保留无调用的兼容包装、重复存储实现或旧技术栈副本。
- 不修改无关的用户工作区改动。
- 修改后至少运行相关测试；跨模块改动运行 `npm test`、`npm run lint` 和 `npm run build`。
