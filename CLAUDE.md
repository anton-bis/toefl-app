# 托福模考系统 AI 开发指令

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

## 项目结构

```
├── assets/
│   └── questions/          # 题库文件 (Markdown)
│       └── reading/
├── components/             # 页面组件
├── docs/                  # 需求文档
├── electron/              # Electron 主进程
├── scripts/               # 构建脚本
├── src/                   # 核心代码
│   ├── core/             # 核心模块 (loader, parser, store, utils)
│   └── modules/           # 业务模块
├── styles.css            # 全局样式
├── templates/            # HTML 模板
├── generate_toefl_pages.js  # 题目生成脚本
└── vite.config.js        # Vite 配置
```

## 题库格式

Markdown 格式，答案使用 `[ANSWER]...[/ANSWER]` 包裹：

- 完形填空: `field:field`（旧格式）或 `1:field`（新格式）
- 选择题: `A/B/C/D`

### 特殊题型解析约定

- **文本链 (Text Chain)**: 必须遵循 `姓名 (时间)\n消息内容` 的交替格式。解析器依赖括号识别头部。
- **填空题 (Complete the Words)**: 题目中使用 `prefix\_+`（转义下划线）表示挖空，下划线数量不代表实际长度，长度由 `[ANSWER]` 块决定。
- **邮件 (Email)**: 包含 `Date:`, `Subject:`, `Dear ...`, `Regards,` 等关键标记。正文内容位于 `Dear` 与签名之间。

## 开发规范

### 核心原则

- 使用 ES Module（`type: "module"`）
- 组件使用函数式编程
- **保持代码简洁，避免过度设计**
- 所有数据存储在 LocalStorage
- **优先实现核心功能（P0级），延后次要功能（P2/P3级）**

### 文件命名

- HTML 文件名使用 kebab-case（如 `reading-question1.html`、`generate-toefl-pages.js`）
- JS 模块/函数名使用 camelCase（如 `saveAnswer()`、`timerLeft`）
- 常量使用 UPPER_SNAKE_CASE（如 `STORAGE_KEY_ANSWERS`）

### 注释要求

- 核心函数添加中文注释，说明功能、入参、出参
- 复杂逻辑必须注释，避免后续维护困难

## 代码风格

- 组件名/文件名使用 PascalCase 或 kebab-case（根据上下文）
- 函数名使用 camelCase
- 常量使用 UPPER_SNAKE_CASE
- 使用 ESLint + Prettier 格式化

## 开发命令

```bash
npm run dev          # 开发模式
npm run build        # 构建 Web 版本
npm run electron:dev # Electron 开发模式
npm run electron:build # 构建 Electron 安装包
```

## 测试要求

### 必测项

1. **计时器**：跨页面生效，剩余 60 秒变红，时间到触发提示
2. **补全单词**：逐字母输入、自动跳格，对错精准标注（红错绿对）
3. **数据持久化**：关闭/刷新浏览器后，答案/标记状态不丢失
4. **复查面板**：颜色标注正确（绿=已答、黄=标记、灰=未答），点击题号跳转正确

### 边界测试

- 空输入、超长输入的处理
- 不同屏幕尺寸下界面无重叠/遮挡
- 无网络环境下所有功能正常运行（静态版天然支持）

## 功能优先级

### P0（核心，必须实现）

- 计时器（倒计时、暂停、隐藏、到时提示）
- 答题交互（选择题、完形填空）
- 答案保存（LocalStorage）
- 复查面板（状态显示、跳转）

### P1（重要）

- 题目导航（上一题/下一题）
- 结果页统计

### P2/P3（延后）

- 深色模式
- 个性化设置
- 云端同步（第二阶段）

## 页面生成

修改题库后运行：

```bash
node generate_toefl_pages.js
```

## 注意事项

### 静态版专属

- 生成的 HTML 文件在项目根目录，文件体积需 < 100KB
- Electron 使用相对路径（`base: './'`）
- 题库路径：`assets/questions/reading/reading-2026-test-01.md`

### 通用要求

- 界面贴合托福真实考试场景，避免冗余设计
- 代码简洁可维护，禁止引入复杂依赖
- 保留「离线可用」核心优势
