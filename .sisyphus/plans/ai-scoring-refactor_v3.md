# Plan: TOEFL Speaking & Writing 评分体系重构 - v3

## 范围

- **仅 Speaking 与 Writing**；对外分数仅显示 final30 与 final6，不显示 0-5 rubric
- Speaking = Listen and Repeat + Take an Interview（合并输出）
- Writing = Write an Email + Academic Discussion（合并输出）

---

## 分数计算规则（Plan A）

```
Speaking:
  Total05_speaking = L + T   // L = Listen and Repeat 总分(0-5), T = Take an Interview 总分(0-5)
  final30_speaking = round(Total05_speaking × 3)   // 0-30
  final6_speaking  = round(Total05_speaking × 0.6) // 0-6  整数

Writing:
  Total05_writing = W1 + W2  // W1 = Write an Email, W2 = Academic Discussion
  final30_writing = round(Total05_writing × 3)
  final6_writing  = round(Total05_writing × 0.6)
```

- 内部用 0-5 rubric 计算，外显仅 final30 + final6
- Never show 0-5 rubric externally

---

## Task A: ai.js 变更清单

### 函数签名

```javascript
// 换算函数（新增）
export function convertTotal05_to_final30_final6_for_speaking(total05_speaking) {
  // total05_speaking: number (0-10)
  // 返回: { final30_speaking: number, final6_speaking: number }
}

export function convertTotal05_to_final30_final6_for_writing(total05_writing) {
  // total05_writing: number (0-10)
  // 返回: { final30_writing: number, final6_writing: number }
}

// 评分函数（改造）
export async function scoreListenAndRepeat(apiKey, sentences[], userTranscripts[]) {
  // sentences: string[]  参考句子数组
  // userTranscripts: string[]  用户转写文本数组（已通过 Web Speech API 转写）
  // 返回: {
  //   score05: number,         // 本题 0-5 分
  //   scaled30: number,        // 不使用，保留兼容性
  //   scaled6: number,         // 不使用，保留兼容性
  //   feedback, strengths, improvement: string
  // }
}

export async function scoreTakeInterview(apiKey, question, userResponse, responseTime) {
  // question: string
  // userResponse: string  // 已转写的文本
  // responseTime: number
  // 返回: { score05, feedback, strengths, improvement }  (0-5)
}

export async function scoreWriteEmail(apiKey, emailPrompt, userEssay) {
  // 返回: { score05, wordCount, feedback, strengths, improvement } (0-5)
}

export async function scoreAcademicDiscussion(apiKey, discussionPrompt, userEssay) {
  // 返回: { score05, wordCount, feedback, strengths, improvement } (0-5)
}
```

### 内部评分汇总逻辑（Speaking 为例）

```javascript
// 在 Speaking.js 或 ai.js 中汇总
async function submitSpeaking() {
  // 1. 对每个子任务评分，得到 L 和 T（各自 0-5）
  const L = await scoreListenAndRepeat(apiKey, sentences, transcripts);
  const T = await scoreTakeInterview(apiKey, question, transcript, time);

  // 2. 聚合为 Total05
  const Total05_speaking = L.score05 + T.score05;

  // 3. 换算为 final30 / final6
  const { final30_speaking, final6_speaking } = convertTotal05_to_final30_final6_for_speaking(Total05_speaking);

  // 4. 仅外显 final30_speaking 和 final6_speaking
  displayResult(final30_speaking, final6_speaking);
}
```

### 验收测试用例

| Total05 | final30 | final6 |
|---------|---------|--------|
| 0       | 0       | 0      |
| 1       | 3       | 1      |
| 2       | 6       | 1      |
| 3       | 9       | 2      |
| 4       | 12      | 2      |
| 5       | 15      | 3      |
| 6       | 18      | 4      |
| 7       | 21      | 4      |
| 8       | 24      | 5      |
| 9       | 27      | 5      |
| 10      | 30      | 6      |

---

## Task B: Speaking.js 变更清单

### UI 结构

```
┌─────────────────────────────────────┐
│  🎤 Speaking                        │
│  [Listen and Repeat] [Take an Interview] │  ← tab 切换
├─────────────────────────────────────┤
│  （根据 tab 显示对应输入界面）         │
├─────────────────────────────────────┤
│  [提交评分]                          │
├─────────────────────────────────────┤
│  Speaking 总分:                      │
│  final30: XX / 30                   │  ← 仅显示这两个
│  final6:  X / 6                     │
│  反馈、优点、改进建议                  │
└─────────────────────────────────────┘
```

### 关键行为

- tab 切换 → 清空输入区 + 结果区
- 评分提交顺序：先评分所有子任务 → 汇总 Total05 → 换算 → 仅显示 final30 + final6
- **不显示** 0-5 rubric 分数

### Web Speech API 集成（Listen and Repeat）

```javascript
// 伪代码
function startRealtimeTranscription() {
  const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)({
    lang: 'en-US',
    continuous: false,
    interimResults: true
  });

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    // 实时显示 interim transcript
  };

  recognition.onend = () => {
    // 录音结束，final transcript 填入 textarea
  };

  recognition.start();
}
```

### 验收测试用例

1. 切换 tab → 输入区和结果区清空
2. Listen and Repeat：点击录音 → 转写文本 → 评分 → final30 + final6 显示
3. Take an Interview：录音回答 → 转写 → 评分 → final30 + final6 显示
4. 两个 tab 的分数合并为 Speaking 总分

---

## Task C: Writing.js 变更清单

### UI 结构

```
┌─────────────────────────────────────┐
│  ✍️ Writing                         │
│  [Write an Email] [Academic Discussion] │
├─────────────────────────────────────┤
│  （根据 tab 显示对应输入界面）         │
├─────────────────────────────────────┤
│  字数: XX 词                         │
│  [提交评分]                          │
├─────────────────────────────────────┤
│  Writing 总分:                       │
│  final30: XX / 30                   │
│  final6:  X / 6                     │
│  反馈、优点、改进建议                  │
└─────────────────────────────────────┘
```

### 关键行为

- tab 切换 → 清空输入区 + 结果区
- 字数统计：英文单词数（`split(/\s+/).filter(w => w).length`）
- 评分提交 → 汇总 Total05_writing → 换算 → 仅显示 final30 + final6
- **不显示** 0-5 rubric 分数

### 验收测试用例

1. Write an Email 评分 → final30_writing + final6_writing 显示
2. Academic Discussion 评分 → final30_writing + final6_writing 显示
3. tab 切换 → 状态清空
4. 字数统计正确（英文单词数，非字符数）

---

## Task D: UI/UX 统一规范

### 显示约束（Must Have）

- ✅ 只显示 final30 和 final6
- ✅ 带有清晰的单位标签（如 "/30" 和 "/6"）
- ✅ 不显示任何 0-5 rubric 的分数
- ✅ 不显示子任务的单独分数卡

### 切换行为

- 切换 tab → 清空输入 + 结果
- 模块切换（从 Speaking 切到 Writing）→ 清空所有

---

## Task E: QA 验收用例

### 换算函数验证

```javascript
// node -e 测试
import { convertTotal05_to_final30_final6_for_speaking } from './src/services/ai.js';
console.log(convertTotal05_to_final30_final6_for_speaking(0));  // {30: 0, 6: 0}
console.log(convertTotal05_to_final30_final6_for_speaking(10)); // {30: 30, 6: 6}
console.log(convertTotal05_to_final30_final6_for_speaking(5));  // {30: 15, 6: 3}
```

### UI 验证（Playwright）

1. 访问 Speaking → 切换 tab → 结果区为空
2. 评分完成 → 仅显示 final30 /30 和 final6 /6
3. 访问 Writing → 评分 → final30 /30 和 final6 /6
4. Build a Sentence 不受任何影响

---

## Commit 策略

1. `refactor(ai): 拆分评分函数 + 新增换算函数`
2. `feat(speaking): 口语UI增加题型选择和总分输出`
3. `feat(writing): 写作UI增加题型选择和总分输出`

---

## 变更日志

| 版本 | 日期 | 变更 |
|------|------|------|
| v1 | - | 初始草稿 |
| v2 | - | 细化评分维度 |
| v3 | - | 聚焦 Speaking/Writing，统一 final30/final6 输出，NeverShow05RubricExternally，Plan A 换算公式 |