# AI 评分模块重构与口语写作 UI 升级

## TL;DR

> **核心目标**: 将 ai.js 的2个通用评分函数拆为4个题型专用函数（Listen and Repeat / Take an Interview / Write an Email / Academic Discussion），嵌入各自 ETS 官方 rubric，增加 0-5→30分/6分换算工具，同时升级 Speaking.js 和 Writing.js 支持题型切换与完整评分展示。
>
> **交付物**:
> - 重构后的 `src/services/ai.js`（4套 rubric + 4个评分函数 + 2个换算函数）
> - 重构后的 `src/components/Speaking.js`（题型选择 + Web Speech API + 正确分数展示）
> - 重构后的 `src/components/Writing.js`（题型选择 + 正确分数展示）
>
> **预计工作量**: Short
> **并行执行**: YES - 3 waves
> **关键路径**: Task 1 (ai.js) → Task 2+3 (Speaking/Writing UI) → Task F1-F4 (验证)

---

## Context

### 原始需求

用户要求修正口语和写作的评分体系，使其严格对齐 ETS 官方题型和评分标准：
- 口语拆为 "Listen and Repeat" + "Take an Interview" 两个独立模块
- 写作拆为 "Write an Email" + "Academic Discussion" 两个独立模块（"Build a Sentence" 有固定答案，不需 AI 评分）
- ETS rubric 是 0-5 分参考标准，需自动换算到托福 30 分制和 6 分制
- 当前口语评分硬编码上限为4分（错误），应为5分
- 口语和写作 UI 缺乏题型选择和核心交互

### 讨论摘要

**关键决策**:
- 口语2个独立题型 + 写作2个独立题型 = 4个评分函数，各自独立 rubric
- Build a Sentence 不纳入 AI 评分（固定答案）
- 分数换算: 0-5 → 30分制 (`score * 6`) + 6分制 (`score + 1`，0分除外)
- Web Speech API 用于 Listen and Repeat 语音转文字
- 不需要测试框架（纯前端验证版）

### Metis 审查

**已识别并处理的缺陷**:
- **向后兼容**: 旧函数名 `correctSpeaking`/`correctWriting` 完全替换为新函数名，不做兼容保留（用户未要求，且当前尚无其他调用方）
- **Web Speech API 回退**: 必须提供文本输入作为 fallback（浏览器不支持或麦克风权限被拒时）
- **题型切换中状态重置**: 用户切换题型时清空输入区域和评分结果
- **分数展示精确性**: 需同时展示 rubric 分 (0-5)、30分制、6分制三个数值

---

## Work Objectives

### 核心目标

将口语/写作的 AI 评分从2个通用函数重构为4个题型专用函数，评分标准严格对齐 ETS 官方 rubric，分数自动换算到30分制和6分制，UI 增加题型选择和完整评分展示。

### 具体交付物

- `src/services/ai.js` — 4套 rubric 常量 + 4个评分函数 + 2个换算函数 + 解析工具函数
- `src/components/Speaking.js` — 题型选择器 + Listen and Repeat 专用界面（含 Web Speech API）+ Take an Interview 专用界面 + 三级分数展示
- `src/components/Writing.js` — 题型选择器 + Write an Email 专用界面 + Academic Discussion 专用界面 + 三级分数展示

### 完成定义

- [ ] `npm run dev` 能正常启动，口语/写作模块可切换题型
- [ ] 4个评分函数各自返回 0-5 整数 + scaled30 + scaled6
- [ ] 口语分数不再显示 `/4`，显示 `/5` + 换算分
- [ ] Listen and Repeat 可使用 Web Speech API 语音输入，也有文本输入 fallback
- [ ] 切换题型时输入和结果区域正确重置

### Must Have

- 4个独立评分函数，各自内嵌完整 ETS 官方 rubric 原文
- 分数换算: `toScaled30(rubric)` → 30分制, `toScaled6(rubric)` → 6分制
- 口语评分上限从4修正为5
- Speaking.js 和 Writing.js 各有题型选择器（Listen and Repeat / Take an Interview; Write an Email / Academic Discussion）
- 评分结果区展示 rubric 分 + 30分制 + 6分制
- Listen and Repeat 界面集成 Web Speech API + 文本输入 fallback
- Take an Interview 界面保留录音 + 文本输入

### Must NOT Have (Guardrails)

- **不**新增 Build a Sentence 的 AI 评分（固定答案题型，不需要）
- **不**修改阅读模块 (`src/modules/reading/`) 的任何代码
- **不**修改 main.js 的模块注册逻辑（现有注册已足够）
- **不**引入新的 npm 依赖
- **不**保留旧的 `correctSpeaking`/`correctWriting` 函数名（完全替换，不做兼容层）
- **不**过度注释或添加冗余 JSDoc（保持代码简洁，核心函数加中文注释即可）
- **不**添加自动化测试框架（当前阶段为静态验证版）

---

## Verification Strategy

> **零人工干预** - 所有验证由 agent 执行

### Test Decision

- **Infrastructure exists**: NO
- **Automated tests**: None（当前阶段不需要）
- **Framework**: N/A

### QA Policy

每个任务包含 agent 执行的 QA 场景。证据保存到 `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`。

- **前端/UI**: Playwright — 导航、交互、断言 DOM、截图
- **API/逻辑**: Bash (node REPL) — 导入模块、调用函数、比较输出

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately - 核心服务层):
├── Task 1: 重构 ai.js 评分服务 [deep]

Wave 2 (After Wave 1 - UI 组件层, MAX PARALLEL):
├── Task 2: 重构 Speaking.js 口语界面 [unspecified-high]
├── Task 3: 重构 Writing.js 写作界面 [unspecified-high]

Wave FINAL (After ALL tasks — 4 parallel reviews):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real manual QA (unspecified-high)
├── Task F4: Scope fidelity check (deep)
→ Present results → Get explicit user okay

Critical Path: Task 1 → Task 2+3 → F1-F4 → user okay
Parallel Speedup: ~50% faster than sequential
Max Concurrent: 2 (Wave 2)
```

### Dependency Matrix

| Task | Depends On | Blocks |
|------|-----------|--------|
| 1    | -         | 2, 3   |
| 2    | 1         | F1-F4  |
| 3    | 1         | F1-F4  |
| F1   | 2, 3      | user okay |
| F2   | 2, 3      | user okay |
| F3   | 2, 3      | user okay |
| F4   | 2, 3      | user okay |

### Agent Dispatch Summary

- **Wave 1**: 1 — T1 → `deep`
- **Wave 2**: 2 — T2 → `unspecified-high`, T3 → `unspecified-high`
- **FINAL**: 4 — F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high`, F4 → `deep`

---

## TODOs

- [ ] 1. 重构 ai.js 评分服务（4套 rubric + 4个评分函数 + 换算工具）

  **What to do**:
  - 删除旧的 `WRITING_RUBRIC` 和 `SPEAKING_RUBRIC` 常量，替换为4套独立 rubric:
    - `RUBRIC_LISTEN_REPEAT`: Listen and Repeat 评分标准（0-5分，含 accuracy/intelligibility/completeness 3个维度）
    - `RUBRIC_TAKE_INTERVIEW`: Take an Interview 评分标准（0-5分，含 taskResponse/fluency/pronunciation/vocabulary/grammar 5个维度）
    - `RUBRIC_WRITE_EMAIL`: Write an Email 评分标准（0-5分，含 taskCompletion/elaboration/socialConventions/languageUse/grammar 5个维度）
    - `RUBRIC_ACADEMIC_DISCUSSION`: Academic Discussion 评分标准（0-5分，含 relevance/elaboration/languageUse/grammar/coherence 5个维度）
  - 每套 rubric 常量必须包含完整的 ETS 官方 0-5 分档描述（不能只写一句话概括）
  - 删除旧函数 `correctSpeaking()` 和 `correctWriting()`，替换为:
    - `scoreListenAndRepeat(apiKey, originalSentence, userResponse)` — 参数: 原句 + 用户跟读文本
    - `scoreTakeInterview(apiKey, question, userResponse, responseTime)` — 参数: 面试问题 + 用户回答 + 答题时间
    - `scoreWriteEmail(apiKey, emailPrompt, userEssay)` — 参数: 邮件题目 + 用户邮件
    - `scoreAcademicDiscussion(apiKey, discussionPrompt, userEssay)` — 参数: 学术讨论题目 + 用户贡献
  - 新增 `toScaled30(rubricScore)`: 0-5 → 0-30 换算（公式: `rubric * 6`）
  - 新增 `toScaled6(rubricScore)`: 0-5 → 0-6 换算（0→0, 1→2, 2→3, 3→4, 4→5, 5→6）
  - 新增 `parseAIResult(text, fallback)` 内部工具函数：解析 AI JSON 返回，自动附加 scaled30 和 scaled6
  - 所有4个评分函数内部调用 `parseAIResult`，返回对象自动包含 `score`(0-5) + `scaled30` + `scaled6`
  - 保留 `callAI()`、`explainQuestion()`、`explainMistake()` 不变
  - 更新 `export default` 导出列表：移除旧名，加入新名

  **Must NOT do**:
  - 不保留 `correctSpeaking`/`correctWriting` 旧函数
  - 不修改 `callAI()`、`explainQuestion()`、`explainMistake()`
  - 不修改 API_URL 或 DEFAULT_MODEL
  - 不添加 npm 依赖

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - Reason: 需要理解 ETS 官方 rubric 并完整翻译为中文常量，拆分函数逻辑需要深度思考
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `git-master`: 不涉及 git 操作

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 1 (solo)
  - **Blocks**: Task 2, Task 3
  - **Blocked By**: None

  **References**:

  **Pattern References** (existing code to follow):
  - `src/services/ai.js:1-64` — `callAI()` 函数结构和 API 调用模式（保持不变）
  - `src/services/ai.js:66-114` — `correctSpeaking()` 旧实现（评分 prompt 结构、JSON 解析逻辑、fallback 模式 — 新函数照此结构替换）
  - `src/services/ai.js:116-165` — `correctWriting()` 旧实现（同上）
  - `src/services/ai.js:94-100` — JSON 解析 + score cap 逻辑（新 `parseAIResult` 参照此模式，但 cap 改为5并附加 scaled 字段）

  **API/Type References**:
  - 评分函数返回值约定：每个函数返回 `{ score, scaled30, scaled6, ...dimensions, feedback, strengths, improvement }` + 可选 `wordCount`（写作专用）

  **External References**:
  - ETS 官方 rubric 原文已在用户对话中确认，各题型 0-5 分档描述需完整内嵌

  **WHY Each Reference Matters**:
  - `ai.js:66-114` — 新的 `scoreListenAndRepeat` 和 `scoreTakeInterview` 必须照此 prompt→callAI→parse→return 模式，但 rubric 和维度不同
  - `ai.js:94-100` — `parseAIResult` 需要复用 JSON 正则提取 + score cap 逻辑，但增加 scaled 字段注入

  **Acceptance Criteria**:
  - [ ] ai.js 中不存在 `correctSpeaking` 或 `correctWriting` 函数名
  - [ ] ai.js 中存在4套 rubric 常量: `RUBRIC_LISTEN_REPEAT`, `RUBRIC_TAKE_INTERVIEW`, `RUBRIC_WRITE_EMAIL`, `RUBRIC_ACADEMIC_DISCUSSION`
  - [ ] ai.js 中存在4个评分函数: `scoreListenAndRepeat`, `scoreTakeInterview`, `scoreWriteEmail`, `scoreAcademicDiscussion`
  - [ ] ai.js 中存在2个换算函数: `toScaled30`, `toScaled6`
  - [ ] `toScaled30(5) === 30`, `toScaled30(0) === 0`, `toScaled30(3) === 18`
  - [ ] `toScaled6(0) === 0`, `toScaled6(1) === 2`, `toScaled6(5) === 6`
  - [ ] `export default` 包含所有新函数名，不含旧函数名
  - [ ] `callAI`, `explainQuestion`, `explainMistake` 仍存在且未修改

  **QA Scenarios**:

  ```
  Scenario: 换算函数正确性验证
  Tool: Bash (node)
  Preconditions: ai.js 存在且语法正确
  Steps:
    1. node -e "import('./src/services/ai.js').then(m => { console.log(m.toScaled30(5), m.toScaled6(5), m.toScaled30(0), m.toScaled6(0), m.toScaled30(3), m.toScaled6(3)) })"
    2. 断言输出: "30 6 0 0 18 4"
  Expected Result: 输出 "30 6 0 0 18 4"
  Failure Indicators: 输出不匹配或 ReferenceError
  Evidence: .sisyphus/evidence/task-1-scale-functions.txt

  Scenario: 旧函数已移除
  Tool: Bash (grep)
  Steps:
    1. grep "correctSpeaking\|correctWriting" src/services/ai.js
    2. 断言: 无匹配结果
  Expected Result: 无输出（0 matches）
  Failure Indicators: 找到任何匹配行
  Evidence: .sisyphus/evidence/task-1-old-functions-removed.txt

  Scenario: 新函数导出存在
  Tool: Bash (node)
  Steps:
    1. node -e "import('./src/services/ai.js').then(m => { const fns = ['scoreListenAndRepeat','scoreTakeInterview','scoreWriteEmail','scoreAcademicDiscussion','toScaled30','toScaled6']; fns.forEach(f => console.log(f, typeof m[f])) })"
    2. 断言: 全部输出 "function"
  Expected Result: 6行输出，每行为 "functionName function"
  Failure Indicators: 任何 "undefined"
  Evidence: .sisyphus/evidence/task-1-new-exports.txt
  ```

  **Commit**: YES
  - Message: `refactor(ai): 拆分评分函数为4个题型专用函数，增加分数换算`
  - Files: `src/services/ai.js`

- [ ] 2. 重构 Speaking.js 口语界面（题型选择 + Web Speech API + 三级分数展示）

  **What to do**:
  - 将 import 从 `correctSpeaking` 改为 `scoreListenAndRepeat` 和 `scoreTakeInterview`
  - 在界面顶部添加题型选择器（两个 tab 按钮："Listen and Repeat" / "Take an Interview"）
  - **Listen and Repeat 界面**:
    - "原句" 输入区（textarea，placeholder: "请输入或粘贴需要跟读的原句..."）
    - "跟读" 区域: 一个 🎤 录音按钮 + Web Speech API 语音转文字 + 一个文本输入 textarea 作为 fallback
    - Web Speech API 实现: 使用 `new webkitSpeechRecognition()` / `new SpeechRecognition()`，设置 `lang='en-US'`，`continuous=false`，`interimResults=true`
    - 录音按钮逻辑: 点击开始识别 → 实时显示 interim results → 停止后写入 transcript textarea
    - 若浏览器不支持 SpeechRecognition: 隐藏录音按钮，显示提示 "您的浏览器不支持语音识别，请手动输入"
    - 提交批改时调用 `scoreListenAndRepeat(apiKey, originalSentence, userResponse)`
  - **Take an Interview 界面**:
    - "面试问题" 输入区（textarea）
    - "回答" 区域: 保留现有录音功能 + 文本输入 textarea
    - 答题时间输入（默认60秒）
    - 提交批改时调用 `scoreTakeInterview(apiKey, question, userResponse, responseTime)`
  - **评分结果区**（两种题型共用）:
    - Rubric 分: `X / 5` （大字号）
    - 30分制: `换算: XX / 30`
    - 6分制: `换算: X / 6`
    - 各维度进度条（根据题型显示不同维度）
    - feedback / strengths / improvement 文本区
  - 切换题型时: 清空所有输入和结果，重置 UI 状态
  - 移除旧的 `/4` 分数显示

  **Must NOT do**:
  - 不引入 npm 依赖（Web Speech API 是浏览器原生 API）
  - 不修改 main.js
  - 不修改 Writing.js
  - 不添加 Build a Sentence 题型

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - Reason: UI 组件重构涉及较多 DOM 操作和状态管理，需要中高投入
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 3)
  - **Blocks**: F1-F4
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `src/components/Speaking.js:1-362` — 当前完整实现（API Key 输入、录音逻辑、DOM 构建模式、事件绑定 — 保留结构，替换评分调用和增加题型选择）
  - `src/components/Speaking.js:102-284` — `showSpeakingInterface()` DOM 构建模式（参照此模式为两种题型分别构建界面）
  - `src/components/Speaking.js:291-325` — MediaRecorder 录音逻辑（保留用于 Take an Interview）
  - `src/components/Speaking.js:327-358` — 提交批改事件处理（参照此模式，但调用新函数名）

  **API/Type References**:
  - `src/services/ai.js` (Task 1 产出) — `scoreListenAndRepeat(apiKey, originalSentence, userResponse)` 和 `scoreTakeInterview(apiKey, question, userResponse, responseTime)` 的签名
  - 返回值: `{ score, scaled30, scaled6, ...dimensions, feedback, strengths, improvement }`

  **WHY Each Reference Matters**:
  - `Speaking.js:102-284` — 新界面需照此 DOM.create 模式构建，保持代码风格一致
  - `Speaking.js:327-358` — 提交逻辑需改为调用新函数名，但异步处理和错误捕获模式不变
  - `ai.js` 新函数签名 — import 和调用必须匹配 Task 1 的产出

  **Acceptance Criteria**:
  - [ ] 不存在 `correctSpeaking` 的 import 语句
  - [ ] 存在 `scoreListenAndRepeat` 和 `scoreTakeInterview` 的 import 语句
  - [ ] 界面有2个题型 tab: "Listen and Repeat" / "Take an Interview"
  - [ ] Listen and Repeat 界面有 "原句" 和 "跟读" 输入区
  - [ ] Take an Interview 界面有 "面试问题" 和 "回答" 输入区
  - [ ] 分数显示为 `/5` 而非 `/4`
  - [ ] 评分结果同时展示 rubric 分、30分制、6分制
  - [ ] Web Speech API 可用时显示录音按钮，不可用时隐藏并提示

  **QA Scenarios**:

  ```
  Scenario: 口语界面题型切换
  Tool: Playwright (+ playwright skill)
  Preconditions: npm run dev 已启动，已输入 API Key
  Steps:
    1. 导航到 http://localhost:5173
    2. 点击模块选择器，选择 "🎤 口语模块"
    3. 断言: 页面标题包含 "口语"
    4. 断言: 存在2个题型 tab，文字分别为 "Listen and Repeat" 和 "Take an Interview"
    5. 点击 "Listen and Repeat" tab
    6. 断言: 存在 "原句" 相关输入区
    7. 点击 "Take an Interview" tab
    8. 断言: 存在 "面试问题" 相关输入区
  Expected Result: 题型 tab 切换正确，各自输入区出现
  Failure Indicators: tab 不存在或点击后输入区不切换
  Evidence: .sisyphus/evidence/task-2-tab-switch.png

  Scenario: 分数展示包含三级换算
  Tool: Playwright
  Preconditions: 口语模块已打开，API Key 已输入
  Steps:
    1. 选择 "Take an Interview" tab
    2. 在面试问题输入: "Describe your favorite hobby and explain why you enjoy it."
    3. 在回答输入: "My favorite hobby is reading because it helps me learn new things and relax."
    4. 点击 "提交批改"
    5. 等待评分结果出现 (timeout: 30s)
    6. 断言: 分数显示包含 "/5"
    7. 断言: 分数显示包含 "30"（30分制）
    8. 断言: 分数显示包含 "6"（6分制）
  Expected Result: 评分结果同时展示 rubric/5、/30、/6 三种分值
  Failure Indicators: 仅展示单一分值或仍显示 /4
  Evidence: .sisyphus/evidence/task-2-score-display.png

  Scenario: Web Speech API 不可用时的 fallback
  Tool: Playwright
  Preconditions: 口语模块已打开
  Steps:
    1. 选择 "Listen and Repeat" tab
    2. 检查是否存在手动文本输入区（即使 SpeechRecognition 不可用）
    3. 断言: 存在 textarea 用于手动输入跟读内容
  Expected Result: 无论浏览器是否支持 Web Speech API，都有文本输入 fallback
  Failure Indicators: 没有 textarea fallback
  Evidence: .sisyphus/evidence/task-2-fallback.png
  ```

  **Commit**: YES
  - Message: `feat(speaking): 口语UI增加题型选择和Web Speech API集成`
  - Files: `src/components/Speaking.js`

- [ ] 3. 重构 Writing.js 写作界面（题型选择 + 三级分数展示）

  **What to do**:
  - 将 import 从 `correctWriting` 改为 `scoreWriteEmail` 和 `scoreAcademicDiscussion`
  - 在界面顶部添加题型选择器（两个 tab 按钮："Write an Email" / "Academic Discussion"）
  - **Write an Email 界面**:
    - "邮件题目" 输入区（textarea，placeholder 示例: "Write an email to your professor requesting an extension for your assignment...")
    - 作文输入区 + 字数统计（实时统计英文单词数，非字符数）
    - 提交批改时调用 `scoreWriteEmail(apiKey, emailPrompt, userEssay)`
  - **Academic Discussion 界面**:
    - "学术讨论题目" 输入区（textarea，placeholder 示例: "Professor: Today we discuss whether remote learning is as effective as in-person learning. Share your perspective.")
    - 作文输入区 + 字数统计
    - 提交批改时调用 `scoreAcademicDiscussion(apiKey, discussionPrompt, userEssay)`
  - **评分结果区**（两种题型共用）:
    - Rubric 分: `X / 5` （大字号）
    - 30分制: `换算: XX / 30`
    - 6分制: `换算: X / 6`
    - 字数统计
    - 各维度进度条（根据题型显示不同维度）
    - feedback / strengths / improvement 文本区
  - 切换题型时: 清空所有输入和结果，重置 UI 状态
  - 修复字数统计: 从 `essay.length`（字符数）改为 `essay.split(/\s+/).filter(w => w).length`（英文单词数）
  - 移除旧的 `issuesText` DOM 元素（AI 返回不包含 issues 字段）

  **Must NOT do**:
  - 不引入 npm 依赖
  - 不修改 main.js
  - 不修改 Speaking.js
  - 不添加 Build a Sentence 题型

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - Reason: UI 组件重构与 Speaking.js 类似，中高投入
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 2)
  - **Blocks**: F1-F4
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `src/components/Writing.js:1-331` — 当前完整实现（DOM 构建模式、字数统计、提交逻辑 — 保留结构，替换评分调用和增加题型选择）
  - `src/components/Writing.js:100-281` — `showWritingInterface()` DOM 构建模式（参照此模式为两种题型分别构建界面）
  - `src/components/Writing.js:283-287` — 字数统计逻辑（修改: `essay.length` → `essay.split(/\s+/).filter(w => w).length`）
  - `src/components/Writing.js:290-328` — 提交批改逻辑（参照此模式，调用新函数名）
  - `src/components/Speaking.js` (Task 2 产出) — 题型 tab 选择器的 DOM 实现模式（保持两个组件的 tab 风格一致）

  **API/Type References**:
  - `src/services/ai.js` (Task 1 产出) — `scoreWriteEmail(apiKey, emailPrompt, userEssay)` 和 `scoreAcademicDiscussion(apiKey, discussionPrompt, userEssay)` 的签名
  - 返回值: `{ score, scaled30, scaled6, ...dimensions, wordCount, feedback, strengths, improvement }`

  **WHY Each Reference Matters**:
  - `Writing.js:100-281` — 新界面照此 DOM.create 模式构建
  - `Writing.js:283-287` — 字数统计 bug 修复点
  - `Writing.js:254-263` — `issuesText` 需移除（AI 返回不含 issues 字段）
  - Task 2 产出 — tab 选择器实现保持风格统一

  **Acceptance Criteria**:
  - [ ] 不存在 `correctWriting` 的 import 语句
  - [ ] 存在 `scoreWriteEmail` 和 `scoreAcademicDiscussion` 的 import 语句
  - [ ] 界面有2个题型 tab: "Write an Email" / "Academic Discussion"
  - [ ] Write an Email 界面有 "邮件题目" 和作文输入区
  - [ ] Academic Discussion 界面有 "学术讨论题目" 和作文输入区
  - [ ] 分数显示包含 rubric/5 + 30分制 + 6分制
  - [ ] 字数统计使用英文单词数（非字符数）
  - [ ] 不存在 `issuesText` DOM 元素

  **QA Scenarios**:

  ```
  Scenario: 写作界面题型切换
  Tool: Playwright (+ playwright skill)
  Preconditions: npm run dev 已启动，已输入 API Key
  Steps:
    1. 导航到 http://localhost:5173
    2. 点击模块选择器，选择 "✍️ 写作模块"
    3. 断言: 页面标题包含 "写作"
    4. 断言: 存在2个题型 tab，文字分别为 "Write an Email" 和 "Academic Discussion"
    5. 点击 "Write an Email" tab
    6. 断言: 存在 "邮件" 相关输入区
    7. 点击 "Academic Discussion" tab
    8. 断言: 存在 "学术讨论" 相关输入区
  Expected Result: 题型 tab 切换正确
  Failure Indicators: tab 不存在或切换失败
  Evidence: .sisyphus/evidence/task-3-writing-tab-switch.png

  Scenario: 分数展示包含三级换算
  Tool: Playwright
  Preconditions: 写作模块已打开，API Key 已输入
  Steps:
    1. 选择 "Write an Email" tab
    2. 在邮件题目输入: "Write an email to your professor requesting an extension for your assignment due to illness."
    3. 在作文区输入一段50词以上的英文邮件
    4. 点击 "提交批改"
    5. 等待评分结果 (timeout: 30s)
    6. 断言: 分数显示包含 "/5"
    7. 断言: 分数显示包含 "30"（30分制）
    8. 断言: 分数显示包含 "6"（6分制）
  Expected Result: 评分结果同时展示三级分值
  Failure Indicators: 仅展示单一分值
  Evidence: .sisyphus/evidence/task-3-writing-score-display.png

  Scenario: 字数统计为英文单词数
  Tool: Playwright
  Preconditions: 写作模块已打开
  Steps:
    1. 在作文输入区输入 "Hello world this is a test"
    2. 断言: 字数显示为 "6"（6个单词）而非字符数
  Expected Result: 字数标签显示 "6"
  Failure Indicators: 显示字符数或0
  Evidence: .sisyphus/evidence/task-3-word-count.png

  Scenario: 切换题型时状态重置
  Tool: Playwright
  Preconditions: 写作模块已打开
  Steps:
    1. 选择 "Write an Email"
    2. 在题目和作文区各输入一些文本
    3. 切换到 "Academic Discussion"
    4. 断言: 所有输入区为空
    5. 切换回 "Write an Email"
    6. 断言: 所有输入区为空（状态不保留）
  Expected Result: 切换后输入区清空
  Failure Indicators: 切换后仍保留之前输入
  Evidence: .sisyphus/evidence/task-3-state-reset.png
  ```

  **Commit**: YES
  - Message: `feat(writing): 写作UI增加题型选择和三级分数展示`
  - Files: `src/components/Writing.js`

---

## Final Verification Wave

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, curl endpoint, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in .sisyphus/evidence/. Compare deliverables against plan. Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `npm run build`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names. Output: `Build [PASS/FAIL] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high` (+ `playwright` skill)
  Start dev server. Execute EVERY QA scenario from EVERY task. Test cross-task integration. Test edge cases: empty input, no API key, mic denied, browser without Web Speech API. Save to `.sisyphus/evidence/final-qa/`. Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff. Verify 1:1 — everything in spec was built, nothing beyond spec was built. Check "Must NOT do" compliance. Detect cross-task contamination. Flag unaccounted changes. Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

- **1**: `refactor(ai): 拆分评分函数为4个题型专用函数，增加分数换算` — src/services/ai.js
- **2**: `feat(speaking): 口语UI增加题型选择和Web Speech API集成` — src/components/Speaking.js
- **3**: `feat(writing): 写作UI增加题型选择和三级分数展示` — src/components/Writing.js

---

## Success Criteria

### Verification Commands

```bash
npm run dev   # Expected: dev server starts, no errors
npm run build # Expected: build succeeds, no errors
```

### Final Checklist

- [ ] All "Must Have" present
- [ ] All "Must NOT Have" absent
- [ ] 4个评分函数各自返回 0-5 + scaled30 + scaled6
- [ ] 口语分数显示 `/5` 而非 `/4`
- [ ] Listen and Repeat 有 Web Speech API + 文本 fallback
- [ ] 题型选择器在口语和写作界面均可用
