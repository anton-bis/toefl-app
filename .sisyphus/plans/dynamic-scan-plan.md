# Plan: 动态扫描题库 + 听力模块路由集成

## TL;DR
> **Summary**: 修改 loader.js 实现动态扫描听力题库，验证 parser.js 兼容新格式，完成 Hash 路由集成
> **Deliverables**: 动态扫描功能、格式验证报告、路由功能验证
> **Effort**: Medium
> **Parallel**: NO - 顺序执行
> **Critical Path**: loader.js 修改 → parser.js 验证 → 路由集成验证

## Context
### Original Request
用户上传了 `listening-TPO-03.md` 题库文件，提出两个关键问题：
1. 预设文件列表需要每加一个文件就改代码，不合理
2. 新文件格式需要确认能否被正确解析

### Interview Summary
- 听力题库文件已添加音频地址
- 文件结构：`## Module` + `### Task` + `audio:` + `[ANSWER]`
- 需要实现动态扫描，避免手动维护文件列表

### Metis Review (gaps addressed)
- 确认 parser.js 已支持新格式（需验证）
- loader.js 需要改为动态扫描或维护可扩展列表
- 路由功能需要验证是否能正确加载新题库

## Work Objectives
### Core Objective
实现听力题库的动态扫描机制，验证新格式文件能被正确解析和加载。

### Deliverables
1. 动态扫描功能（替换硬编码列表）
2. 题库格式兼容性验证报告
3. 路由集成验证（loading-new-question-bank）

### Definition of Done
- [ ] loader.js 能自动发现 `assets/questions/listening/` 下所有 `.md` 文件
- [ ] `listening-TPO-03.md` 能被正确解析（无报错）
- [ ] 音频文件路径能被正确提取和加载
- [ ] Hash 路由能正确切换到听力模块并加载新题库

### Must Have
- 动态扫描功能（使用 Vite 的 `import.meta.glob`）
- 格式验证（确保 parser.js 能处理新格式）

### Must NOT Have
- 不修改 parser.js 的核心解析逻辑（如已兼容）
- 不破坏现有阅读模块的加载逻辑

## Verification Strategy
- Test decision: 手动测试 + 控制台日志验证
- QA policy: 每个文件能被扫描到，每个音频路径能被提取
- Evidence: 浏览器控制台日志、网络请求验证

## Execution Strategy
### Parallel Execution Waves
Wave 1: 修改 loader.js 实现动态扫描
Wave 2: 验证 parser.js 格式兼容性
Wave 3: 测试路由集成和新题库加载

### Dependency Matrix
| Task | Depends On | Blocks |
|------|------------|--------|
| loader.js 动态扫描 | - | 题库加载测试 |
| parser.js 格式验证 | - | - |
| 路由集成测试 | loader.js 修改完成 | - |

## TODOs

- [ ] 1. 修改 loader.js 实现动态扫描

  **What to do**: 替换 `scanQuestionBank()` 中的硬编码列表，使用 Vite 的 `import.meta.glob` 自动发现听力题库文件
  **Must NOT do**: 不直接修改 parser.js（除非发现不兼容）

  **Recommended Agent Profile**:
  - Category: `unspecified-low` - Reason: 简单的文件修改任务
  - Skills: [] - 不需要特殊技能
  - Omitted: [`visual-engineering`] - 不涉及前端样式

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: 题库加载测试 | Blocked By: -

  **References**:
  - Pattern: `src/core/loader.js:141-152` - 当前硬编码列表位置
  - API/Type: Vite `import.meta.glob` - 动态导入功能

  **Acceptance Criteria**:
  - [ ] `scanQuestionBank('listening')` 返回 `assets/questions/listening/` 下所有 `.md` 文件
  - [ ] 新增文件无需修改代码即可被发现
  - [ ] 控制台输出发现的文件列表

  **QA Scenarios**:
  ```
  Scenario: 动态扫描听力题库文件
    Tool: interactive_bash
    Steps: cd D:\托福阅读模拟软件 && npm run dev
    Expected: 控制台输出 "动态发现听力题库文件: [listening/listening-2026-test-01.md, listening/listening-TPO-03.md]"
    Evidence: .sisyphus/evidence/task-1-dynamic-scan.log
  ```

- [ ] 2. 验证 parser.js 格式兼容性

  **What to do**: 确认 parser.js 能正确解析 `listening-TPO-03.md` 的新格式，包括 Module、Task、audio、dialogue、answer 等
  **Must NOT do**: 不修改已兼容的解析逻辑

  **Recommended Agent Profile**:
  - Category: `unspecified-low` - Reason: 验证任务，可能涉及少量修改
  - Skills: [] - 不需要特殊技能

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: - | Blocked By: Task 1

  **References**:
  - Pattern: `src/core/parser.js:358-384` - `detectTaskType()` 函数
  - Pattern: `src/core/parser.js:92-95` - `parseAudioMetadata()` 调用
  - External: 用户上传的 `listening-TPO-03.md` 文件

  **Acceptance Criteria**:
  - [ ] `## Module 1` 能被正确解析
  - [ ] `### Listen and Choose a Response` 能被识别为 `listening-no-stem` 类型
  - [ ] `audio: xxx.mp3` 能被正确提取
  - [ ] `[ANSWER]...[/ANSWER]` 答案能被正确分配

  **QA Scenarios**:
  ```
  Scenario: 解析新格式题库文件
    Tool: interactive_bash
    Steps: 启动开发服务器，访问 /#/listening，打开浏览器控制台
    Expected: 无报错，题目正确显示，音频路径正确
    Evidence: .sisyphus/evidence/task-2-parse-validation.log
  ```

- [ ] 3. 测试路由集成和新题库加载

  **What to do**: 验证 Hash 路由能正确切换到听力模块，并加载新的 `listening-TPO-03.md` 题库
  **Must NOT do**: 不修改路由核心逻辑（已完成）

  **Recommended Agent Profile**:
  - Category: `unspecified-low` - Reason: 测试验证任务
  - Skills: [] - 不需要特殊技能

  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: - | Blocked By: Task 1, Task 2

  **References**:
  - Pattern: `src/core/router.js` - Hash 路由器
  - Pattern: `src/main.js` - 路由注册和初始化

  **Acceptance Criteria**:
  - [ ] 访问 `/#/listening` 能正确加载听力模块
  - [ ] 新题库的题目能正确显示
  - [ ] 音频文件能正确加载和播放

  **QA Scenarios**:
  ```
  Scenario: 路由切换到听力模块并加载新题库
    Tool: playwright
    Steps: 访问 http://localhost:3000/#/listening，等待模块加载，检查题目显示
    Expected: 听力模块加载成功，显示来自 listening-TPO-03.md 的题目
    Evidence: .sisyphus/evidence/task-3-router-test.png
  ```

## Final Verification Wave
- [ ] F1. Plan Compliance Audit — oracle
- [ ] F2. Code Quality Review — unspecified-high
- [ ] F3. Real Manual QA — unspecified-high (+ playwright if UI)
- [ ] F4. Scope Fidelity Check — deep

## Commit Strategy
- Commit: YES | Message: `feat(loader): 实现动态扫描题库 + 验证听力新格式` | Files: [src/core/loader.js]

## Success Criteria
- 动态扫描功能正常工作
- 新格式题库能被正确解析
- 路由集成验证通过
- 用户无需每次添加文件都修改代码