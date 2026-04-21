# 托福模考系统 - 代理配置

## 项目概述
托福阅读模拟考试软件，分两阶段开发：
- **第一阶段（当前）**：静态验证版，纯 HTML/JS，通过 Node.js 生成静态 HTML，答题数据存 LocalStorage
- **第二阶段**：正式版，前后端分离，支持全模块（阅读/听力/口语/写作）、账号登录、云端同步，保留离线可用

## 技术栈（第一阶段）
- **前端**: 原生 HTML + CSS + JavaScript（无框架依赖）
- **构建工具**: Vite
- **模板引擎**: Handlebars
- **桌面端**: Electron（可选）
- **代码规范**: ESLint + Prettier

## 核心模块
- `src/core/` - 核心模块 (loader, parser, store, utils)
- `src/modules/reading/` - 阅读模块
- `src/components/` - UI组件
- `templates/` - HTML模板

## 可用命令
- `npm run dev` - 开发服务器
- `npm run plan` - Sisyphus规划模式
- `npm run sisyphus` - Sisyphus超强工作模式
- `npm run build` - 构建生产版本
- `npm run preview` - 预览构建结果
- `npm run electron:dev` - Electron开发模式

## 开发规范
- 使用 ES Module (`type: "module"`)
- 组件使用函数式编程
- 所有数据存储在 LocalStorage
- 优先实现核心功能（P0级），延后次要功能（P2/P3级）

## 注意事项
- 生成的 HTML 文件在项目根目录，文件体积需 < 100KB
- Electron 使用相对路径 (`base: './'`)
- 题库路径：`assets/questions/reading/reading-2026-test-01.md`