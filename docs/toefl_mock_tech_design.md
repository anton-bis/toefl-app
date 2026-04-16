# TOEFL 练习软件 — 技术设计文档

| 字段 | 内容 |
|------|------|
| **版本** | 3.0（修正版） |
| **日期** | 2026-04-13 |
| **状态** | 最终 |

---

## 1. 引言

本文档定义了 TOEFL 练习软件的技术架构，分为两个阶段：

- **阶段1（验证版）**：静态 HTML 生成方案，用于快速验证核心交互逻辑（填空题输入、计时器、Review面板、自动保存）是否可行。
- **阶段2（正式版）**：动态应用架构，在验证通过的基础上升级为全栈应用，支持听说读写全模块、账号系统、云端同步和题库管理。

**核心原则**：验证版不追求"做得对"，追求"做得快"；正式版在验证版的基础上保留交互设计精髓，升级技术架构。

---

## 2. 整体架构

### 2.1 系统架构图

```
┌──────────────────────────────────────────────────────────────────┐
│                        阶段1：验证版                              │
│                                                                  │
│  Markdown题库 → generate_toefl_pages.js → 静态HTML页面            │
│                                          ↓                       │
│                                       浏览器                     │
│                                          ↓                       │
│                                    localStorage                  │
└──────────────────────────────────────────────────────────────────┘
                              ↓ 验证通过后
┌──────────────────────────────────────────────────────────────────┐
│                        阶段2：正式版                              │
│                                                                  │
│  ┌──────────┐    REST API    ┌──────────────┐                    │
│  │  Vue3    │ ←────────────→ │ Node.js      │                    │
│  │  前端    │                │ Express      │                    │
│  └────┬─────┘                └──────┬───────┘                    │
│       ↓                             ↓                            │
│  localStorage              MongoDB                               │
│  (离线缓存)                (云端数据)                             │
│                                                                  │
│  ┌──────────────────────────────────────────────┐                │
│  │  功能：全模块、账号、同步、题库管理、错题本     │                │
│  └──────────────────────────────────────────────┘                │
└──────────────────────────────────────────────────────────────────┘
```

---

## 3. 阶段1：静态HTML验证版

### 3.1 架构说明

| 组件 | 职责 |
|------|------|
| `generate_toefl_pages.js` | Node.js 脚本，解析 Markdown → 替换模板占位符 → 输出 HTML |
| HTML 模板 | 位于 `templates/` 目录，含 4 种题型模板 + 通用页面模板 |
| `styles.css` | 统一 CSS 设计令牌（CSS Variables） |
| `localStorage` | 答题记录、标记状态、计时器数据 |

### 3.2 生成管线（7步流水线）

```
步骤1：读取 Markdown 题库文件
步骤2：按 ## Module 分割为模块
步骤3：按 ### Task 分割为任务
步骤4：识别题型（fill/email/textchain/academic）
步骤5：解析 [ANSWER] 块 → 构建答案键
步骤6：计算导航关系（backPage/nextPage）
步骤7：遍历模板，替换占位符 → 输出 HTML 文件
```

### 3.3 数据模型

| 存储键 | 类型 | 示例 |
|--------|------|------|
| `toefl_answers` | `{题号: 答案}` | `{"21": "C", "29": "B"}` |
| `toefl_marked_questions` | `[题号数组]` | `[22, 29]` |
| `toefl_timer_remaining` | `数字(秒)` | `420` |
| `toefl_timer_started` | `"true"/"false"` | `"true"` |

### 3.4 核心功能实现状态

| 功能 | 实现状态 | 说明 |
|------|---------|------|
| 填空题逐字母输入 | ✅ 已实现 | 自动跳转、智能删除、粘贴支持 |
| 跨页计时器 | ✅ 已实现 | localStorage 持久化 |
| 自动保存 | ✅ 已实现 | 每3秒自动保存 |
| Review面板 | ⚠️ 部分实现 | CSS/结构完整，跳转逻辑需完善 |
| 核对答案 | ⚠️ 部分实现 | 有比对骨架，核心逻辑是 demo 状态 |
| 结果页统计 | ⚠️ 部分实现 | 占位符数据，真实数据流未完全打通 |

### 3.5 已知问题与修复方向

| 问题 | 修复方向 |
|------|---------|
| `{{PARAGRAPH_WITH_FILL_BLOCKS}}` 占位符未正确替换 | 修复 `generateFillBlocks()` 函数逻辑 |
| 核对答案仅显示 demo 数据 | 接入 `data-answer` 属性比对真实答案 |
| 结果页统计显示 "--" | 从 localStorage 读取答题数据计算真实统计 |

---

## 4. 阶段2：正式软件（动态应用架构）

### 4.1 技术选型

| 层级 | 选型 | 理由 | 备选 |
|------|------|------|------|
| **前端框架** | Vue 3 + Vite | 学习曲线平缓，轻量，组件化 | React + Next.js |
| **后端框架** | Node.js + Express | 与前端同语言，开发效率高 | Java Spring Boot |
| **数据库** | MongoDB | JSON 原生支持，灵活题库结构 | MySQL/PostgreSQL |
| **离线缓存** | Service Worker + IndexedDB | 大容量，支持结构化数据 | localStorage |
| **部署** | Vercel（前端）+ Railway（后端） | 低成本启动，自动 CI/CD | 自建服务器 |

### 4.2 前端架构

```
src/
├── components/           # 可复用组件
│   ├── FillInput.vue        # 填空字母方框
│   ├── ReviewPanel.vue      # 复查面板
│   ├── Timer.vue            # 计时器
│   ├── OptionList.vue       # 选择题选项
│   └── ResultsCard.vue      # 结果统计卡片
├── views/                # 页面级组件
│   ├── StartPage.vue          # 开始页
│   ├── ModuleIntro.vue        # 模块介绍页
│   ├── QuestionPage.vue       # 题目页（动态加载）
│   ├── ResultsPage.vue        # 结果页
│   ├── Login.vue              # 登录页
│   ├── Dashboard.vue          # 仪表盘
│   ├── QuestionBank.vue       # 题库管理
│   └── WrongBook.vue          # 错题本
├── stores/               # Pinia 状态管理
│   ├── user.js              # 用户状态
│   ├── exam.js              # 答题状态
│   └── timer.js             # 计时器
├── api/                  # API 调用封装
│   ├── auth.js                # 认证
│   ├── exam.js                # 练习
│   └── questions.js           # 题库
└── utils/                # 工具函数
    ├── storage.js             # 本地/云端存储桥接
    └── timer.js               # 计时器逻辑
```

### 4.3 后端 API 设计

```javascript
// 认证
POST   /api/auth/register      // 注册
POST   /api/auth/login         // 登录
POST   /api/auth/logout        // 登出

// 题库
GET    /api/questions/:module  // 获取某模块题库
GET    /api/questions/:id      // 获取单套题详情
POST   /api/questions          // 添加题库（教师权限）

// 练习
POST   /api/exams/start        // 开始练习
POST   /api/exams/submit       // 提交答案
GET    /api/exams/history       // 历史记录
GET    /api/exams/:id/analysis  // 练习分析

// 同步
GET    /api/sync               // 拉取云端最新数据
POST   /api/sync               // 推送本地修改到云端

// 错题本
GET    /api/wrong-questions    // 获取错题列表
POST   /api/wrong-questions/:id/retry  // 重做某题
```

### 4.4 云端数据模型

**用户表** `users`
```javascript
{
  _id: ObjectId,
  email: String,           // 邮箱（唯一）
  passwordHash: String,    // bcrypt 加密
  displayName: String,
  targetScore: Number,     // 目标分数
  examDate: Date,          // 考试日期
  createdAt: Date,
  lastSyncAt: Date
}
```

**练习记录表** `exam_records`
```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  moduleId: String,        // 模块: reading/listening/speaking/writing
  testId: String,          // 题库版本号
  answers: Object,         // {题号: 答案}
  markedQuestions: Array,  // 标记题号
  timeSpent: Number,       // 实际用时(秒)
  accuracy: Number,        // 正确率(0-100)
  startedAt: Date,
  completedAt: Date,
  createdAt: Date
}
```

**题库表** `questions`
```javascript
{
  _id: ObjectId,
  module: String,          // reading/listening/speaking/writing
  version: String,         // "2026-test-01"
  tasks: [{
    type: String,          // fill/email/textchain/academic/audio/...
    content: Object,       // 题目内容
    answers: Object        // 正确答案
  }],
  createdAt: Date,
  updatedAt: Date
}
```

### 4.5 离线同步策略

```
离线状态：
  1. 做题数据存入 IndexedDB
  2. 提示用户"离线模式"

联网恢复：
  1. 检测网络连接恢复
  2. 读取 IndexedDB 中的待同步数据
  3. POST /api/sync 提交修改
  4. GET /api/sync 拉取最新云端数据
  5. 冲突时以服务端数据为准
```

---

## 5. 核心组件详细设计

### 5.1 填空题组件（FillInput）

**核心交互**：
- 每个缺失字母一个 `<input maxlength="1">`
- 输入字母后自动跳转到下一个输入框
- 按 Backspace 在空框时删除并聚焦前一个
- 支持批量粘贴（自动分配到连续方框）

**数据流**：
```
用户输入 → onChange → 更新本地 state → 防抖500ms → 保存到 localStorage/IndexedDB
核对答案 → 比对 data-answer → 添加 CSS 类(correct/incorrect/empty)
```

### 5.2 计时器组件（Timer）

**核心逻辑**：
```javascript
// 验证版：简单倒计时
let remaining = parseInt(localStorage.getItem('toefl_timer_remaining'));
setInterval(() => { remaining--; save(); }, 1000);

// 正式版：基于时间戳的精确计算
const startTime = Date.now();
const durationMs = moduleConfig.duration * 1000;
const remaining = () => durationMs - (Date.now() - startTime);
```

### 5.3 复查面板（ReviewPanel）

**状态计算**：
```javascript
// 已答：题号在 toefl_answers 中
// 标记：题号在 toefl_marked_questions 中
// 当前：当前页面 URL 包含该题号
function getQuestionStatus(questionId) {
  const isAnswered = !!toefl_answers[questionId];
  const isMarked = toefl_marked_questions.includes(questionId);
  return { isAnswered, isMarked };
}
```

### 5.4 答案核对（CheckAnswers）

**填空题比对**：
```javascript
function checkFillAnswers() {
  const containers = document.querySelectorAll('.word-fill-container');
  containers.forEach(container => {
    const correctAnswer = container.querySelector('.letter-box-container').dataset.answer;
    const userAnswer = [...container.querySelectorAll('.letter-box')]
      .map(box => box.value)
      .join('');
    return userAnswer.toLowerCase() === correctAnswer.toLowerCase();
  });
}
```

**选择题比对**：
```javascript
function checkMCQAnswer(questionId, selectedOption) {
  const correctAnswer = correctAnswers[questionId]; // 从题库或注入的答案键获取
  return selectedOption === correctAnswer;
}
```

---

## 6. 从验证版到正式版的迁移路径

### 6.1 迁移原则

1. **验证版只做验证**：不写业务逻辑，只验证交互是否流畅
2. **不重复造轮子**：验证版的 CSS 设计令牌直接复用
3. **数据格式兼容**：正式版的 localStorage 键名与验证版保持一致
4. **渐进式替换**：先搭框架，再逐个功能迁移

### 6.2 迁移步骤

| 步骤 | 动作 | 产出 |
|------|------|------|
| 1 | 完成验证版所有 P0/P1 功能验收 | 确认交互设计通过 |
| 2 | 基于验证版输出交互规范文档 | FillInput/Timer/ReviewPanel 交互细节文档 |
| 3 | 搭建 Vue3 项目脚手架 | 前端基础项目 |
| 4 | 搭建 Node.js Express 项目 | 后端基础服务 |
| 5 | 实现用户认证（注册/登录/JWT） | 账号系统 |
| 6 | 导入验证版题库（Markdown → MongoDB） | 云端题库 |
| 7 | 用 Vue 组件重写阅读模块 | 阅读模块上线 |
| 8 | 添加离线同步逻辑 | Service Worker + IndexedDB |
| 9 | 扩展听力/口语/写作模块 | 全模块上线 |
| 10 | 添加错题本、薄弱分析 | 进阶功能 |

### 6.3 风险点

| 风险 | 缓解方案 |
|------|---------|
| 验证版交互与正式版差异大 | 验证阶段输出详细交互文档，确保可复用 |
| Markdown 题库格式需调整 | 在导入 MongoDB 前增加格式转换脚本 |
| localStorage 数据量限制 | 验证阶段数据量小，不影响；正式版用 IndexedDB |
| 用户习惯改变 | 保持与验证版一致的 UI/UX，降低学习成本 |

---

## 7. 性能约束

| 指标 | 验证版目标 | 正式版目标 |
|------|----------|----------|
| 页面加载 | < 100ms | < 500ms（含网络请求） |
| JS 解析时间 | < 50ms | < 200ms |
| 页面大小 | < 100KB/页 | < 500KB/页 |
| 计时器精度 | < 1秒偏差 | < 0.5秒偏差 |
| 答案持久化 | 100% 存活 | 100% 存活 + 同步延迟 < 1秒 |

---

## 8. 范围外事项

| 阶段 | 不做 |
|------|------|
| 验证版 | 后端服务、用户账号、听力/口语/写作、云端同步、PDF 导出 |
| 正式版 | AI 自动出题、实时视频监考、付费订阅、社交功能 |

---

## 9. 附录

### 9.1 关键文件清单

| 文件 | 用途 |
|------|------|
| `generate_toefl_pages.js` | 页面生成主脚本 |
| `templates/` | 所有 HTML 模板 |
| `templates/general/styles.css` | 全局设计系统 |
| `assets/questions/reading/` | 题库源文件（Markdown） |
| `docs/toefl_mock_PRD.md` | 产品需求文档 |
| `docs/toefl_mock_research.md` | 调研报告 |

### 9.2 模板占位符清单

| 占位符 | 适用题型 | 说明 |
|--------|---------|------|
| `{{QUESTION_NUMBER}}` | 全部 | 当前题号 |
| `{{BACK_PAGE}}` / `{{NEXT_PAGE}}` | 全部 | 导航链接 |
| `{{TIMER_SECONDS}}` | 全部 | 计时器初始秒数 |
| `{{PARAGRAPH_WITH_FILL_BLOCKS}}` | 填空题 | 带输入框的段落 |
| `{{EMAIL_DATE}}` / `{{EMAIL_SUBJECT}}` / `{{EMAIL_BODY}}` / `{{EMAIL_SENDER}}` | Email | 邮件元数据 |
| `{{TEXT_CHAIN_CONTENT}}` | 文本链 | 对话内容 |
| `{{PASSAGE_TITLE}}` / `{{PASSAGE_CONTENT}}` | 学术文章 | 文章内容 |
| `{{QUESTION_TEXT}}` | 阅读类 | 题目文本 |
| `{{OPTION_A}}` ~ `{{OPTION_D}}` | 阅读类 | 选项内容 |
| `{{CORRECT_A}}` ~ `{{CORRECT_D}}` | 阅读类 | 选项是否正确 |
