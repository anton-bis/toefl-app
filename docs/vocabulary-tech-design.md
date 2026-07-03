# Skills — 真题单词背诵 · 技术设计文档（TDD）

| 字段 | 内容 |
|------|------|
| **版本** | 1.0 |
| **日期** | 2026-06-30 |
| **状态** | 初稿 |
| **前置文档** | `docs/vocabulary-prd.md` |
| **下一阶段** | Agent 指令 → Build |

---

## 1. 技术栈

| 层面 | 方案 | 理由 |
|------|------|------|
| 渲染引擎 | 原生 JS + DOM 操作 | 与现有四大模块一致，无框架依赖 |
| 路由 | 复用 `src/core/router.js`，注册 `/skills/vocabulary` | HashRouter 统一管理 |
| 模块入口 | `src/modules/skills/vocabulary/index.js` | 与 typing 同层 |
| 词库加载 | `fetch('assets/questions/vocabulary/{subject}-words.json')` | 按科目按需加载 |
| 持久化 | localStorage，`skills_vocab_*` 前缀 | 第一阶段统一方案 |
| 发音 | 预生成 MP3 文件 + `<audio>` 标签 | 完全离线，零依赖 |
| 图标 | Font Awesome `fa-book`（侧边栏） | 复用现有 CDN |
| CSS 体系 | 沿用 `index.html` 的 `:root` 变量，Apple 风格统一设计 | 与 typing 视觉一致 |

---

## 2. 项目架构

```
src/modules/skills/vocabulary/
├── index.js                       ← 模块入口
│   导出: { name, state, init, render, destroy }
│   state: { subject, mode, page, set, words, ... }
│   页面调度: switch(page) → 调用对应 render
│
├── renderers/
│   ├── SubjectSelect.js           ← 四科选择卡片 + 右上角模式切换开关
│   ├── SetList.js                 ← Set 列表（乱序: 编号列表 / 词根: 词根组列表）
│   ├── NineGrid.js                ← 3×3 九宫格扫读（Reading & Writing Step 1）
│   ├── CardLearning.js            ← 卡片学习（看英文选中文 / 看中文选英文 / 原句拼写 三题型轮换）
│   ├── AudioLearning.js           ← 听音选义学习（Listening & Speaking）
│   ├── ReviewSession.js           ← 复习轮换（看英文选中文 / 看中文选英文 / 原句拼写 / 听音选义）
│   ├── WordDetail.js              ← 单词详情页（发音/释义/词源/例句）
│   └── DailyReminder.js           ← 每日提醒弹窗组件
│
└── utils/
    ├── storage.js                 ← localStorage 三层读写封装
    ├── scheduler.js               ← SM-2 间隔重复算法
    └── speech.js                  ← MP3 播放封装（美音/英音切换）
```

### 2.1 模块生命周期

```
init()
  ├─ store.registerModule('vocabulary', ...)
  ├─ load user settings from localStorage (mode, reminder)
  ├─ check daily reminder
  ├─ render() → SubjectSelect page
  └─

render()
  └─ switch(state.page)
       ├─ 'subject-select' → SubjectSelect.render(subjects, mode, callbacks)
       ├─ 'set-list'       → SetList.render(sets, mode, callbacks)
       ├─ 'nine-grid'      → NineGrid.render(words, callbacks)
       ├─ 'card-learning'  → CardLearning.render(word, callbacks)
       ├─ 'audio-learning' → AudioLearning.render(word, callbacks)
       ├─ 'review'         → ReviewSession.render(word, callbacks)
       └─ 'word-detail'    → WordDetail.render(word)

destroy()
  ├─ save session snapshot
  ├─ remove event listeners
  └─ clear state
```

### 2.2 页面状态机

```
IDLE → 'subject-select'
         └─ (click a subject card) → 'set-list'
              └─ (click a Set) → [根据 subject 和 mode 决定]
                   ├─ Reading/Writing → 'nine-grid'
                   │    └─ (complete grid mark) → 'card-learning'
                   │         └─ (all cards done) → 'review'
                   │              └─ (复习词全部完成) → 'set-list'
                   │
                   └─ Listening/Speaking → 'audio-learning'
                        └─ (all words done) → 'review'
                             └─ (复习词全部完成) → 'set-list'

'subject-select'
  └─ (mode toggle switch) → setState(mode) → re-render (四科卡片不变)
```

---

## 3. 学习引擎设计

### 3.1 九宫格扫读（Reading & Writing Step 1）

#### 数据结构

```javascript
// 一个 Set 的 25 个词初始化
const gridWords = words.map((w, i) => ({
  ...w,
  gridStatus: 'unmarked'  // 'unmarked' | 'unknown'
}));

// 分页：每页 9 格，25 词分 3 页 (9+9+7)
const pages = [];
for (let i = 0; i < gridWords.length; i += 9) {
  pages.push(gridWords.slice(i, i + 9));
}
let currentPage = 0;
```

#### DOM 结构

```html
<div class="vocab-nine-grid">
  <div class="grid-header">
    <span class="grid-subject">Reading · Set 1</span>
    <span class="grid-page">1/3</span>
  </div>
  <div class="grid-container" data-page="0">
    <div class="grid-cell" data-word-id="vocab-reading-001">
      <span class="grid-word">abundant</span>
    </div>
    <!-- 共 9 个 .grid-cell -->
  </div>
  <div class="grid-footer">
    <span class="grid-counter">已标记: 3 个不认识</span>
    <button class="grid-next-btn">组装卡片学习 →</button>
  </div>
</div>
```

#### 交互逻辑

```javascript
function onCellClick(wordId) {
  const word = gridWords.find(w => w.id === wordId);
  if (word.gridStatus === 'unmarked') {
    word.gridStatus = 'unknown';
    cell.classList.add('grid-cell-unknown');  // 变灰
  } else {
    word.gridStatus = 'unmarked';
    cell.classList.remove('grid-cell-unknown');  // 恢复黑色
  }
  updateCounter();  // 更新"已标记: N 个"
}

// 点击"组装卡片学习"
function onAssemble() {
  const unknownWords = gridWords.filter(w => w.gridStatus === 'unknown');
  // 如果没有标记任何词，默认全部标记为不认识
  const studyWords = unknownWords.length > 0 ? unknownWords : [...gridWords];
  // 进入卡片学习
  state.page = 'card-learning';
  state.learningQueue = studyWords;
  render();
}
```

#### CSS 样式

```css
.grid-cell {
  background: #fff;
  border: 1px solid var(--border, #e5e5e7);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 500;
  color: #1d1d1f;
}
.grid-cell:hover {
  transform: scale(1.02);
  box-shadow: 0 4px 12px rgba(0,0,0,0.06);
}
.grid-cell-unknown {
  background: #f5f5f7;
  color: #c0c0c4;
  text-decoration: line-through;
}
```

### 3.2 卡片学习（Reading & Writing Step 2）

卡片学习的核心是**三种题型动态轮换**。九宫格扫读中标记为不认识的词进入学习队列，每个词在被分配时随机抽取一种题型。

#### 题型比例控制

```javascript
const SUBJECT_QUIZ_RATIOS = {
  reading: {
    'lookup-zh': 0.50,   // 看英文选中文
    'lookup-en': 0.30,   // 看中文选英文
    'spell':     0.20    // 原句拼写
  },
  writing: {
    'spell':     0.45,   // 原句拼写
    'lookup-en': 0.30,   // 看中文选英文
    'lookup-zh': 0.25    // 看英文选中文
  }
};

function pickQuizType(subject, wordRecord) {
  const ratios = { ...SUBJECT_QUIZ_RATIOS[subject] };
  // 动态调整：某题型连续错误则权重升高
  if (wordRecord && wordRecord.wrongTypes) {
    wordRecord.wrongTypes.forEach(type => {
      if (ratios[type]) ratios[type] += 0.05;
    });
  }
  // 按权重随机选取
  const rand = Math.random();
  let cum = 0;
  for (const [type, ratio] of Object.entries(ratios)) {
    cum += ratio;
    if (rand <= cum) return type;
  }
  return 'lookup-zh';
}
```

#### 题型一：看英文选中文（`lookup-zh`）

```html
<div class="vocab-card">
  <div class="card-word">abundant</div>
  <div class="card-pronunciation">
    /əˈbʌndənt/ <button class="card-speak-btn" data-accent="us">US</button>
    <button class="card-speak-btn" data-accent="uk">UK</button>
  </div>
  <div class="card-options">
    <div class="card-option" data-index="0">丰富的，充裕的  adj.</div>
    <div class="card-option" data-index="1">缺席的，不在的  adj.</div>
    <div class="card-option" data-index="2">充足的，足够的  adj.</div>
    <div class="card-option" data-index="3">大量的，巨大的  adj.</div>
  </div>
</div>
```

- 展示英文单词 + 音标 + 发音按钮
- 下方 4 个中文选项（无 ABCD 标签，直接"词性 + 中文"）
- 点击选项即提交答案

#### 题型二：看中文选英文（`lookup-en`）

```html
<div class="vocab-card">
  <div class="card-hint">
    <span class="card-pos">adj.</span>
    <span class="card-meaning">丰富的，充裕的</span>
  </div>
  <div class="card-options">
    <div class="card-option" data-word-id="vocab-reading-001">abundant</div>
    <div class="card-option" data-word-id="vocab-reading-015">absent</div>
    <div class="card-option" data-word-id="vocab-reading-032">sufficient</div>
    <div class="card-option" data-word-id="vocab-reading-047">enormous</div>
  </div>
</div>
```

- 展示中文释义 + 词性
- 下方 4 个英文单词选项
- 点击选项即提交答案

#### 题型三：原句拼写（`spell`）

```html
<div class="vocab-spell">
  <div class="spell-context">The region has <span class="spell-blank">________</span> natural resources.</div>
  <div class="spell-input-area">
    <input type="text" class="spell-input" autocomplete="off" autocorrect="off" spellcheck="false">
  </div>
  <div class="spell-chars" id="spell-chars">
    <!-- 动态生成每个字母的 span，实时比对 -->
  </div>
</div>
```

拼写比对逻辑（参照 typing 的字符级比对）：

```javascript
let inputIndex = 0;
const wordChars = targetWord.split('');

function onSpellInput(e) {
  const inputChar = e.data;
  const expected = wordChars[inputIndex];
  if (inputChar === expected) {
    charSpans[inputIndex].className = 'char-correct';
  } else {
    charSpans[inputIndex].className = 'char-incorrect';
  }
  inputIndex++;
  if (inputIndex === wordChars.length) {
    onComplete('hazy');
  }
}
```

- 原文句子展示，目标词替换为下划线
- 用户逐字母输入，实时比对（正确变黑，错误变红）
- 拼写不离语境，兼顾时态语法

#### 三态评价（所有题型的公共出口）

每种题型完成后，展示三态评价按钮：

```html
<div class="card-evaluation">
  <div class="card-answer-feedback">
    <!-- 正确时显示绿色对勾，错误时显示正确答案 -->
  </div>
  <div class="eval-actions">
    <button class="eval-btn eval-btn-forgot" data-q="1">不认识</button>
    <button class="eval-btn eval-btn-hazy" data-q="3">模糊</button>
    <button class="eval-btn eval-btn-known" data-q="5">记住</button>
  </div>
</div>
```

### 3.3 听音选义学习（Listening & Speaking）

```html
<div class="vocab-audio-learn">
  <div class="audio-progress">2/25</div>
  <div class="audio-play-area">
    <button class="audio-play-btn" id="btn-play">
      <i class="fas fa-play"></i>
    </button>
  </div>
  <div class="audio-options">
    <div class="audio-option" data-word-id="vocab-listening-001">
      丰富的，充裕的  adj.
    </div>
    <div class="audio-option" data-word-id="vocab-listening-002">
      缺席的，不在的  adj.
    </div>
    <div class="audio-option" data-word-id="vocab-listening-003">
      充足的，足够的  adj.
    </div>
    <div class="audio-option" data-word-id="vocab-listening-004">
      大量的，巨大的  adj.
    </div>
  </div>
</div>
```

交互逻辑：

```javascript
let currentAudioWord = null;

function onPlay() {
  currentAudioWord = state.learningQueue[0];
  const audio = new Audio(`assets/audio/vocab/${currentAudioWord.word}_us.mp3`);
  audio.play();
}

function onOptionClick(wordId) {
  if (wordId === currentAudioWord.id) {
    // 选对了 → 模糊(q=3)
    scheduler.record(currentAudioWord.id, 3);
    nextWord();
  } else {
    // 选错了 → 不认识(q=1)，展示正确答案
    scheduler.record(currentAudioWord.id, 1);
    showCorrectAnswer(currentAudioWord);
    // 该词进入"优先复习队列"
    state.reviewQueue.unshift(currentAudioWord);
    nextWord();
  }
}
```

---

## 4. 复习引擎设计（ReviewSession）

### 4.1 题型轮换

复习阶段与学习阶段共享相同的三种题型，但题型比例略有调整以适应巩固需求：

```javascript
const REVIEW_RATIOS = {
  reading: {
    'lookup-zh': 0.40,   // 看英文选中文
    'lookup-en': 0.35,   // 看中文选英文（主动回忆比例略升）
    'spell':     0.25    // 原句拼写
  },
  writing: {
    'spell':     0.40,
    'lookup-en': 0.35,
    'lookup-zh': 0.25
  },
  listening: {
    'audio-zh':  0.50,   // 听音选义（主力）
    'lookup-zh': 0.25,   // 看英文选中文（穿插）
    'lookup-en': 0.25    // 看中文选英文（穿插）
  },
  speaking: {
    'audio-zh':  0.50,
    'lookup-zh': 0.25,
    'lookup-en': 0.25
  }
};

function getNextQuizType(word) {
  const ratios = REVIEW_RATIOS[word.subject];
  const rand = Math.random();
  let cum = 0;
  for (const [type, ratio] of Object.entries(ratios)) {
    cum += ratio;
    if (rand <= cum) return type;
  }
  return 'lookup-zh';
}
```

### 4.2 看英文选中文（复习）

与卡片学习中的 `lookup-zh` 一致，但**不展示音标和发音按钮**，只显示英文单词 + 四个中文选项，模拟快速识别。

### 4.3 看中文选英文（复习）

与卡片学习中的 `lookup-en` 一致，强化主动回想路径。

### 4.4 原句拼写（复习）

与卡片学习中的 `spell` 一致，但对于已多次正确拼写的词，可自动跳过拼写环节，直接展示句子确认。

### 4.5 听音选义（Listening & Speaking 复习主力）

与听音学习的交互一致，但增加难度：**播放发音后选项才出现**，迫使用户先听再辨。

---

## 5. SM-2 算法实现（`utils/scheduler.js`）

### 5.1 核心算法

```javascript
export function createScheduler() {
  return {
    /**
     * 记录一次复习结果
     * @param {string} wordId
     * @param {number} q - 质量评分: 5(记住) | 3(模糊) | 1(不认识)
     * @param {object} record - 当前单词的存储记录 { ef, interval, repetitions }
     * @returns {object} 更新后的记录 { ef, interval, nextReview, repetitions }
     */
    record(wordId, q, record) {
      let ef = record.ef || 2.5;
      let interval = record.interval || 0;
      let reps = record.repetitions || 0;

      if (q >= 3) {
        // 正确回答
        if (reps === 0) {
          interval = 1;     // 第1次正确 → 1天
        } else if (reps === 1) {
          interval = 6;     // 第2次正确 → 6天
        } else {
          interval = Math.round(interval * ef);  // 第3次起 ×EF
        }
        reps++;
      } else {
        // 错误回答 → 重置
        reps = 0;
        interval = 1;
      }

      // 更新 EF（易度因子）
      ef = ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
      if (ef < 1.3) ef = 1.3;  // EF 下限

      const nextReview = new Date();
      nextReview.setDate(nextReview.getDate() + interval);

      return {
        ef: Math.round(ef * 100) / 100,
        interval,
        repetitions: reps,
        nextReview: nextReview.toISOString().split('T')[0],
        lastQ: q
      };
    },

    /**
     * 获取今日需要复习的单词列表
     * @param {object} progress - 某科目的 progress 对象
     * @returns {string[]} wordId 列表
     */
    getDueWords(progress) {
      const today = new Date().toISOString().split('T')[0];
      const due = [];
      for (const [wordId, record] of Object.entries(progress)) {
        if (record.nextReview && record.nextReview <= today) {
          due.push(wordId);
        }
      }
      return due;
    },

    /**
     * 将 q 值映射为三态标签
     */
    qToLabel(q) {
      if (q >= 4) return 'remembered';
      if (q >= 2) return 'hazy';
      return 'forgotten';
    },

    labelToQ(label) {
      if (label === 'remembered') return 5;
      if (label === 'hazy') return 3;
      return 1;
    }
  };
}
```

### 5.2 "模糊"状态的会话内重出现逻辑

```javascript
// 在同一个学习会话中，模糊的词在 5-8 张卡片后再次出现
function scheduleReviewQueue(words) {
  const queue = [];
  const hazyBuffer = [];
  const forgottenBuffer = [];

  words.forEach(w => {
    const record = storage.getWordRecord(w.id);
    if (record.lastQ <= 1) {
      forgottenBuffer.push(w);  // 不认识 → 优先
    } else if (record.lastQ === 3) {
      hazyBuffer.push(w);       // 模糊 → 稍后
    }
  });

  // 每隔 5 张正常卡片，插入一张模糊词
  let hazyIndex = 0;
  let forgottenIndex = 0;
  for (let i = 0; i < words.length; i++) {
    if (forgottenIndex < forgottenBuffer.length) {
      queue.push({ word: forgottenBuffer[forgottenIndex++], type: 'review' });
    }
    queue.push({ word: words[i], type: 'new' });
    if (i % 5 === 4 && hazyIndex < hazyBuffer.length) {
      queue.push({ word: hazyBuffer[hazyIndex++], type: 'review' });
    }
  }
  return queue;
}
```

---

## 6. 词库 & 词源生成方案

### 6.1 TPO 文本提取 Pipeline

```
Step 1: 遍历 assets/questions/{subject}/TPO-{NN}/{subject}-TPO-{NN}.md
Step 2: 解析器提取纯文本内容（去除 Markdown 标记、题干、选项标签）
Step 3: 分词 (tokenize) + 小写 + 去重
Step 4: 对照 CEFR A1-A2 排除词表过滤
Step 5: 剩余词汇按科目分类，存入临时 JSON
Step 6: LLM 批量生成每个词的词源、音标、释义、派生词信息
Step 7: 人工快速审核（用户过目标注明显问题）
Step 8: 按每 Set 25 词切分，输出科目词汇 JSON
Step 9: 从词汇 JSON 提取词根-单词映射，生成 word-roots.json
```

### 6.2 提取脚本位置

`scripts/extract-vocabulary.js` — 独立运行，ES Module 格式：

```bash
node scripts/extract-vocabulary.js --tpo-dir=assets/questions --output=assets/questions/vocabulary
```

### 6.3 LLM 批处理 Prompt

```javascript
const BATCH_PROMPT = `你是一个托福词汇专家。请为以下每个词汇生成完整的词源和释义信息。

要求：
1. 音标使用 IPA 标准格式
2. 词性标注使用标准缩写 (adj/adv/n/v/prep/conj)
3. 中文释义准确，覆盖托福常考义项
4. 词根拆解包含前缀、词根、后缀三部分（如果有）
5. 派生词只包含同词根的常见形式
6. 输出严格的 JSON 数组格式

输入词汇（每行一个）：
{words}

输出格式：
[
  {
    "word": "...",
    "pronunciation": { "us": "...", "uk": "..." },
    "pos": [{ "type": "adj", "translation": "..." }],
    "inflections": { "comparative": "...", "superlative": "...", "adverb": "...", "noun": "..." },
    "etymology": {
      "prefix": { "form": "...", "meaning": "..." },
      "root": { "form": "...", "meaning": "..." },
      "suffix": { "form": "...", "meaning": "..." },
      "summary": "..."
    }
  }
]`;
```

### 6.4 发音文件生成

使用 `edge-tts`（Python）批量生成：

```bash
pip install edge-tts

# 生成美音
edge-tts --text "abundant" --voice en-US-JennyNeural --write-media assets/audio/vocab/abundant_us.mp3

# 生成英音
edge-tts --text "abundant" --voice en-GB-SoniaNeural --write-media assets/audio/vocab/abundant_uk.mp3
```

批量脚本 `scripts/generate-audio.js`（调用 Python 子进程）。

---

## 7. 数据模型

### 7.1 localStorage Key 规划

| Key | 类型 | 用途 | 示例 |
|-----|------|------|------|
| `skills_vocab_progress` | `ProgressData` | 所有单词的学习记录 | `{ reading: { "set-1": { ... } } }` |
| `skills_vocab_settings` | `Settings` | 用户偏好设置 | `{ mode: "random", reminderEnabled: true }` |
| `skills_vocab_session` | `SessionState` | 未完成会话的快照 | `{ subject, setIndex, currentWord, queue }` |

### 7.2 ProgressData

```javascript
{
  "reading": {
    "set-1": {
      "status": "completed",        // "pending" | "learning" | "completed"
      "completedAt": "2026-06-30T10:00:00.000Z",
      "words": {
        "vocab-reading-001": {
          "ef": 2.5,
          "interval": 1,
          "repetitions": 1,
          "nextReview": "2026-07-01",
          "lastQ": 5
        }
      }
    },
    // ... more sets
  },
  "listening": { ... },
  "speaking": { ... },
  "writing": { ... }
}
```

### 7.3 Settings

```javascript
{
  "mode": "random",                 // "random" | "root"
  "reminderEnabled": true,          // 全局提醒开关
  "reminderDate": "2026-06-29",     // 最后提醒日期
  "preferredAccent": "us",          // 偏好口音 "us" | "uk"
  "dailyCompleted": {               // 当日已完成科目
    "reading": true,
    "listening": false,
    "speaking": false,
    "writing": true
  },
  "dailyDate": "2026-06-30"        // 当日日期，用于判断跨天
}
```

### 7.4 SessionState（崩溃恢复）

```javascript
{
  "subject": "reading",
  "mode": "random",
  "setIndex": 3,
  "phase": "nine-grid",            // "nine-grid" | "card-learning" | "audio-learning" | "review"
  "currentWordIndex": 5,
  "learningQueue": ["vocab-reading-001", ...],
  "reviewQueue": ["vocab-reading-015", ...]
}
```

---

## 8. 路由与侧边栏集成

### 8.1 路由注册（`src/main.js`）

```javascript
const vocabModule = await import('./modules/skills/vocabulary/index.js');
moduleRegistry.set('vocabulary', vocabModule.default);
router.register('/skills/vocabulary', () => activateModule('vocabulary'));
console.log('模块注册: vocabulary');
```

### 8.2 侧边栏（`index.html`）

在 Skills 分区中新增：

```html
<div class="sidebar-nav-item" data-panel="vocabulary">
  <span class="nav-icon"><i class="fas fa-book"></i></span> 单词
</div>
```

在 `<main>` 中新增面板容器：

```html
<div class="panel" id="panel-vocabulary"></div>
```

在 `switchPanel()` 函数中新增：

```javascript
if (panelName === 'vocabulary') {
  const vocabPanel = document.getElementById('panel-vocabulary');
  if (vocabPanel && !vocabPanel.children.length) {
    const waitForInit = () => {
      if (window.ToeflApp && window.ToeflApp.initVocabPanel) {
        window.ToeflApp.initVocabPanel();
      } else {
        setTimeout(waitForInit, 200);
      }
    };
    waitForInit();
  }
}
```

在 `window.ToeflApp` 中新增：

```javascript
initVocabPanel: () => {
  const module = moduleRegistry.get('vocabulary');
  if (module && module.init) module.init();
}
```

### 8.3 CSS 样式文件

`src/modules/skills/vocabulary/styles.css` — 通过 `init()` 中 Vite `import './styles.css'` 注入。

---

## 9. 每日提醒实现

### 9.1 检查逻辑（`index.js` 的 `init()` 中）

```javascript
init() {
  store.registerModule('vocabulary', { ... });
  store.activateModule('vocabulary');

  await this._loadWordData();

  // 检查每日提醒
  const settings = storage.loadSettings();
  if (settings.reminderEnabled) {
    const today = new Date().toISOString().split('T')[0];
    if (settings.reminderDate !== today) {
      // 有未完成的 Set，弹窗提醒
      const pending = this._getPendingSets();
      if (pending.length > 0) {
        this.state.pendingReminder = pending;
        this.state.showReminder = true;
      }
    }
  }

  this.render();
}
```

### 9.2 弹窗组件（`DailyReminder.js`）

```javascript
export function renderDailyReminder(container, { pending, onStart, onDismiss }) {
  const overlay = document.createElement('div');
  overlay.className = 'reminder-overlay';

  overlay.innerHTML = `
    <div class="reminder-card">
      <div class="reminder-title">每日单词提醒</div>
      <div class="reminder-list">
        ${pending.map(p => `
          <div class="reminder-item">
            <span class="reminder-icon"><i class="fas fa-book ${p.subject}"></i></span>
            <span class="reminder-subject">${p.subjectLabel}</span>
            <span class="reminder-set">Set ${p.setIndex}</span>
          </div>
        `).join('')}
      </div>
      <div class="reminder-actions">
        <button class="reminder-btn primary" id="reminder-start">开始背诵</button>
        <button class="reminder-btn ghost" id="reminder-dismiss">今日不提醒</button>
      </div>
    </div>
  `;

  overlay.querySelector('#reminder-start').onclick = () => {
    overlay.remove();
    onStart(pending[0]);  // 跳转到第一个待背科目
  };

  overlay.querySelector('#reminder-dismiss').onclick = () => {
    overlay.remove();
    onDismiss();
    storage.saveSettings({ ...storage.loadSettings(), reminderDate: today });
  };

  container.appendChild(overlay);
}
```

Apple 风格弹窗 CSS 参照 `.modal-card` 的 `:root` 变量设计。

---

## 10. 错误边界与异常处理

| 场景 | 处理方式 |
|------|---------|
| 词库 JSON 加载失败 | 显示"词库加载失败，请检查网络或重新打开"提示 |
| localStorage 满 | `try-catch` 写入，失败时 `trimProgress()` 删除最早完成 Set 的记录后重试 |
| 发音 MP3 文件缺失 | 静默降级，隐藏该发音按钮，显示"发音文件缺失"tooltip |
| SM-2 记录数据损坏 | 重置该词记录为默认值（ef=2.5, interval=0, reps=0） |
| 用户在九宫格中刷新页面 | 从 `skills_vocab_session` 恢复，回到九宫格页保持已标记状态 |
| 同日重复提醒 | 通过 `reminderDate` 字段控制，一天只弹一次 |

---

## 11. 非功能性需求

| 需求 | 指标 | 实现方式 |
|------|------|---------|
| 词库加载 | < 300ms | 按科目按需加载，单文件 30-50KB |
| 发音播放延迟 | < 100ms | 本地 MP3 直接 `<audio>` 播放 |
| 九宫格交互 | < 16ms | 纯 className 切换，无重排开销 |
| localStorage 占用 | < 500KB | 4000 词 × 10 次记录估算 |
| SM-2 计算 | < 1ms | 纯数学运算，无 IO |
| 弹窗渲染 | < 50ms | 纯 DOM 构建，无外部请求 |
