# Skills — 英文打字练习 · 技术设计文档（TDD）

| 字段 | 内容 |
|------|------|
| **版本** | 1.0 |
| **日期** | 2026-06-23 |
| **状态** | 初稿 |
| **前置文档** | `docs/skills-typing-research.md` → `docs/typing-prd.md` |
| **下一阶段** | Agent 指令 → Build |

---

## 1. 技术栈

| 层面 | 方案 | 理由 |
|------|------|------|
| 渲染引擎 | 原生 JS + DOM 操作 | 与现有四大模块一致，无框架依赖 |
| 路由 | 复用 `src/core/router.js`，注册 `/skills/typing` | HashRouter 统一管理 |
| 模块入口 | `src/modules/skills/typing/index.js` | 与 reading/listening/writing/speaking 同层 |
| 语料加载 | `fetch('assets/questions/typing/corpus.json')` | 60 篇约 30-50KB，一次性加载到内存 |
| 持久化 | localStorage | 第一阶段统一方案，`skills_typing_*` 前缀 |
| 图标 | Font Awesome `fa-keyboard`（侧边栏） | 复用现有 CDN |
| CSS 体系 | 沿用 `index.html` 的 `:root` 变量 | 保证视觉统一，零新增全局样式 |

---

## 2. 项目架构

```
src/modules/skills/typing/
├── index.js              ← 模块入口
│   导出: { name, state, init, render, destroy }
│   state: { page, articles[], currentArticle, chars[], ... }
│   页面调度: switch(page) → 调用对应 render
│
├── renders/              ← 页面渲染（纯函数，返回 DOM 片段）
│   ├── ArticleList.js    ← 三区可折叠卡片网格
│   ├── TypingArea.js     ← 打字交互核心（灰色原文 + 击键比对 + 颜色变换）
│   └── ResultPanel.js    ← 结果展示（指标 + 错误分布 + 重试/返回）
│
└── utils/
    ├── metrics.js        ← RawWpm / NetWpm / Accuracy / ErrorDist 计算
    ├── storage.js        ← localStorage 三层读写封装
    └── timer.js          ← requestAnimationFrame 驱动计时器
```

### 2.1 模块生命周期

```
init()
  ├─ store.registerModule('typing', ...)
  ├─ fetch(corpus.json) → this.state.articles
  └─ render()

render()
  └─ 清空 #app
  └─ switch(state.page)
       ├─ 'list'    → ArticleList.render(state.articles, onSelect, onCollapse)
       ├─ 'typing'  → TypingArea.render(state.currentArticle, chars, callbacks)
       └─ 'result'  → ResultPanel.render(metrics, onRetry, onBack)

destroy()
  ├─ timer.stop()
  ├─ remove event listeners
  ├─ save session snapshot
  └─ clear state
```

### 2.2 页面状态机

```
IDLE → 'list'
         └─ (click card) → 'typing'  [timer auto-start]
                              ├─ (all chars done) → 'result'
                              ├─ (timeout)        → 'result'
                              ├─ [pause]   → timer frozen, content readonly
                              │   └─ [resume] → timer resumes, editable
                              ├─ [retry]   → chars.reset(), timer.reset(), stay 'typing'
                              └─ [back]    → 'list'  [if unfinished → confirm]
         'result'
              ├─ [retry]  → 'typing' (same article)
              └─ [back]   → 'list'
```

---

## 3. 核心打字引擎设计

### 3.1 字符数组结构

```javascript
// 由 content 字符串初始化
chars = [
  { char: 'T', expected: 'T', status: 'untouched' },
  { char: 'h', expected: 'h', status: 'untouched' },
  { char: 'e', expected: 'e', status: 'untouched' },
  { char: ' ', expected: ' ', status: 'untouched' },
  ...
]
// status: 'untouched' | 'correct' | 'incorrect'
```

- `currentIndex` 跟踪当前输入位置（从 0 开始）
- 每个字符渲染为 `<span data-index="n" class="char-{status}">`
- DOM 已存在，每次击键只改对应 `<span>` 的 className（不重建 DOM）

### 3.2 击键事件流

```
keydown
  ├─ 忽略: Ctrl/Alt/Meta/Shift/Tab/箭头/Fn 等修饰键
  ├─ Backspace:
  │     if currentIndex > 0
  │       currentIndex--
  │       chars[currentIndex].status = 'untouched'
  │       更新对应 <span> className
  │
  └─ 可打印字符:
        if currentIndex < chars.length
          inputChar = event.key
          expectedChar = chars[currentIndex].expected

          if inputChar === expectedChar
            chars[currentIndex].status = 'correct'
          else
            chars[currentIndex].status = 'incorrect'

          currentIndex++
          更新对应 <span> className

          if currentIndex === chars.length → 全部完成 → 跳转结果
```

### 3.3 光标高亮

当前待输入字符（`chars[currentIndex]`）额外添加 `char-current` class：

```css
.char-current {
  border-left: 2px solid var(--teal);  /* 左侧竖线光标 */
  animation: blink 1s step-end infinite;
}
@keyframes blink {
  50% { border-color: transparent; }
}
```

### 3.4 颜色映射

| Status | CSS Class | 颜色 |
|--------|-----------|------|
| `untouched` | `.char-untouched` | `#c0c0c4`（浅灰） |
| `correct` | `.char-correct` | `#1d1d1f`（黑色） |
| `incorrect` | `.char-incorrect` | `#ff3b30`（红色，带删除线） |
| 当前光标 | `.char-current` | 额外闪烁竖线 |

### 3.5 错误不阻塞

- 错误字符标红后，`currentIndex` 正常前进
- 用户可随时 Backspace 回退到红色位置重新输入
- 回退后 `status` 恢复为 `untouched`，重新输入后重新判断

---

## 4. 数据模型

### 4.1 localStorage Key 规划

| Key | 类型 | 用途 | 示例 |
|-----|------|------|------|
| `skills_typing_history` | `PracticeRecord[]` | 全部练习记录 | `[...]` |
| `skills_typing_best` | `BestRecord` | 各难度最高成绩缓存 | `{ beginner: {...} }` |
| `skills_typing_session` | `SessionState \| null` | 未完成练习的快照（崩溃恢复） | `{ articleId, ... }` |

### 4.2 PracticeRecord

```javascript
{
  articleId: "typing-b-001",
  title: "The Solar System",
  difficulty: "beginner",

  // 速度指标
  rawWpm: 46.2,       // 总字符 ÷ 5 ÷ 分钟
  netWpm: 42.1,       // (总字符 − 错误字符) ÷ 5 ÷ 分钟

  // 质量指标
  accuracy: 91.3,     // 正确字符 ÷ 总字符 × 100

  // 错误分类
  errors: {
    spacing: 4,         // 空格相关错误
    capitalization: 1,  // 大小写错误
    spelling: 3,        // 拼写错误（字母错位或错键）
    punctuation: 2      // 标点符号错误
  },

  // 原始数据
  correctCount: 230,
  incorrectCount: 22,
  totalChars: 252,
  timeSpent: 92,        // 秒（不含暂停时间）

  completedAt: "2026-06-23T12:00:00.000Z"  // ISO 字符串
}
```

### 4.3 BestRecord

```javascript
{
  beginner: {
    bestNetWpm: 48.5,
    bestAccuracy: 97.5,
    bestNetWpmArticleId: "typing-b-005",
    bestAccuracyArticleId: "typing-b-002",
    historyCount: 15       // 该难度练习次数
  },
  intermediate: { ... },
  advanced: { ... }
}
```

### 4.4 SessionState（崩溃恢复）

```javascript
{
  articleId: "typing-i-003",
  currentIndex: 87,
  chars: [
    { char: "T", expected: "T", status: "correct" },
    ...
  ],
  remainingSeconds: 142,
  isPaused: false
}
```

- 每次 `render()` 开始时检查 `skills_typing_session`
- 若存在且 `articleId` 在 corpus 中，弹窗提示"恢复上次未完成的练习？"
- 练习正常完成或放弃时清除该 key

### 4.5 错误分类算法

在 `utils/metrics.js` 中实现：

```javascript
function classifyError(inputChar, expectedChar, prevExpectedChar) {
  // 1. 空格类: expected 是空格 或 input 是空格但 expected 不是
  if (expectedChar === ' ' || inputChar === ' ') return 'spacing'

  // 2. 大小写类: 字母相同但大小写不同
  if (expectedChar.toLowerCase() === inputChar.toLowerCase()) return 'capitalization'

  // 3. 标点类: expected 或 input 是非字母数字字符
  if (/[^\w\s]/.test(expectedChar) || /[^\w\s]/.test(inputChar)) return 'punctuation'

  // 4. 其余归为拼写错误
  return 'spelling'
}
```

---

## 5. 计时器设计 (`utils/timer.js`)

### 5.1 requestAnimationFrame 驱动

```javascript
export function createTimer(totalSeconds, onTick, onEnd) {
  let startTimestamp = null
  let remaining = totalSeconds
  let pausedAt = null
  let rafId = null

  function tick(timestamp) {
    if (!startTimestamp) startTimestamp = timestamp
    const elapsed = (timestamp - startTimestamp) / 1000
    const current = Math.max(0, remaining - elapsed)
    onTick(Math.ceil(current))
    if (current <= 0) { onEnd(); return }
    rafId = requestAnimationFrame(tick)
  }

  return {
    start() { rafId = requestAnimationFrame(tick) },
    pause() { pausedAt = performance.now(); cancelAnimationFrame(rafId) },
    resume() { /* 扣减暂停期间的时间差 */ start() },
    stop() { cancelAnimationFrame(rafId) },
    getRemaining() { return remaining }
  }
}
```

### 5.2 时长计算公式

| 难度 | 基准 | 公式 |
|------|------|------|
| `beginner` | 不限速 | `Math.min(wordCount * 2, 300)` 秒（硬上限 5 分钟） |
| `intermediate` | 35 WPM | `Math.ceil(wordCount / 35 * 60)` 秒 |
| `advanced` | 45 WPM | `Math.ceil(wordCount / 45 * 60)` 秒 |

---

## 6. 渲染器设计

### 6.1 ArticleList.js

```
功能: 渲染三区可折叠卡片网格
参数: articles[], collapsed: { beginner: bool, ... }, onSelect(id), onToggle(difficulty)

结构:
  <div class="typing-article-list">
    <!-- Beginner 区 -->
    <div class="difficulty-section">
      <div class="section-header" data-difficulty="beginner">
        <span class="collapse-icon">▼</span>
        <span class="section-title">Beginner</span>
        <span class="section-count">20 篇</span>
      </div>
      <div class="card-grid">
        <div class="article-card" data-id="typing-b-001">
          <div class="card-title">The Solar System</div>
          <div class="card-meta">68 词 · ~2min</div>
          <div class="card-badge completed">✅</div>
        </div>
        ...
      </div>
    </div>
    ...
  </div>
```

### 6.2 TypingArea.js

```
功能: 渲染打字交互区域
参数: article { title, content }, chars[], timer, callbacks

结构:
  <div class="typing-area">
    <div class="typing-header">
      <span class="typing-title">{article.title}</span>
      <span class="typing-timer">MM:SS</span>
    </div>
    <div class="typing-text" id="typing-text">
      <span class="char-untouched char-current" data-index="0">T</span>
      <span class="char-untouched" data-index="1">h</span>
      ...
    </div>
    <div class="typing-footer">
      <button class="typing-btn" id="btn-pause">暂停</button>
      <button class="typing-btn" id="btn-retry">重试</button>
    </div>
  </div>
```

样式要点：
- `.typing-text`：`font-size: 20px, line-height: 2, letter-spacing: 1px`
- `.char-untouched`：`color: #c0c0c4`
- `.char-correct`：`color: #1d1d1f`
- `.char-incorrect`：`color: #ff3b30, text-decoration: line-through`
- `.char-current`：`border-left: 2px solid #008080`

### 6.3 ResultPanel.js

```
功能: 渲染结果页面
参数: metrics: { rawWpm, netWpm, accuracy, errors: {...} }, callbacks

结构:
  <div class="typing-result">
    <div class="result-header">练习完成</div>
    <div class="result-metrics">
      <div class="metric-card">
        <span class="metric-value">46</span>
        <span class="metric-label">Raw WPM</span>
      </div>
      <div class="metric-card">
        <span class="metric-value">42</span>
        <span class="metric-label">Net WPM</span>
      </div>
      <div class="metric-card">
        <span class="metric-value">91%</span>
        <span class="metric-label">准确率</span>
      </div>
    </div>
    <div class="result-errors">
      <h3>错误分布</h3>
      <div class="error-bar">
        <span class="error-label">空格</span>
        <div class="error-bar-fill" style="width: 40%"></div>
        <span class="error-count">4</span>
      </div>
      ...
    </div>
    <div class="result-actions">
      <button class="typing-btn primary" id="btn-retry">再来一次</button>
      <button class="typing-btn" id="btn-back">返回列表</button>
    </div>
  </div>
```

---

## 7. 路由与侧边栏集成

### 7.1 路由注册（`src/main.js`）

```javascript
router.register('/skills/typing', async () => {
  const module = await import('@modules/skills/typing/index.js')
  await module.default.init()
})
```

### 7.2 侧边栏（`index.html`）

在"真题"和"其他"之间插入：

```html
<div class="sidebar-section">
  <div class="sidebar-section-header"><i class="fas fa-tools"></i> Skills</div>
  <div class="sidebar-nav-item" data-route="/skills/typing">
    <span class="nav-icon"><i class="fas fa-keyboard"></i></span> 英文打字练习
  </div>
</div>
```

同步修改 `index.html` 中侧边栏的 JS 事件绑定，新增 `data-route` 属性支持，点击时调用 `router.navigate('/skills/typing')`。

### 7.3 CSS 样式文件

`src/modules/skills/typing/styles.css`——打字模块专属样式，通过 `init()` 动态注入 `<link>` 或 `<style>` 到 `<head>`，`destroy()` 时移除。

---

## 8. 非功能性需求

| 需求 | 指标 | 实现方式 |
|------|------|---------|
| 输入响应延迟 | < 16ms | 直接 DOM 操作，无虚拟 DOM 开销 |
| corpus.json 体积 | < 50KB | 纯文本语料，不包含富媒体 |
| 页面切换 | < 200ms | 全部 DOM 片段由 JS 即时构建 |
| localStorage 占用 | < 200KB | 按 500 条历史记录 + 3 条 best + 1 条 session 估算 |
| 计时器精度 | < 100ms 漂移 | requestAnimationFrame 驱动，不与 setInterval |

---

## 9. 错误边界与异常处理

| 场景 | 处理方式 |
|------|---------|
| corpus.json 加载失败 | 显示"语料加载失败，请检查网络或重新打开"提示 |
| localStorage 满 | `try-catch` 写入，失败时 `trimHistory()` 删除最旧记录后重试 |
| 浏览器不支持 localStorage | 功能降级：仅当前 session 有效，提示"数据不会被保存" |
| 用户在打字中刷新页面 | 从 `skills_typing_session` 恢复，弹出确认框 |
| 键盘事件被浏览器拦截 | 全局 `keydown` 监听，不依赖 `input`/`textarea` |
