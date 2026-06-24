# Skills — 英文打字练习 · AI 代理指令

| 字段 | 内容 |
|------|------|
| **版本** | 1.0 |
| **日期** | 2026-06-23 |
| **前置文档** | `docs/skills-typing-research.md` → `docs/typing-prd.md` → `docs/typing-tech-design.md` |
| **构建阶段** | 分批执行，每批完成后验证 |

---

## 1. 项目概述

在托福模考系统中新增一个子功能：**英文打字练习**。该功能位于侧边栏 Skills 分区下，用于帮助托福考生系统性地养成英文打字格式规范（空格、大小写、标点），并逐步提升打字速度。

### 核心交互

用户看到灰色原文，直接在原文上输入。正确字符变黑，错误字符变红（带删除线）。当前待输入字符有闪烁光标指示。错误不阻塞，用户可以继续往后输入，也可 Backspace 回退修正。

### 三层难度

- **Beginner**（20 篇，50-80 词，不限速）
- **Intermediate**（20 篇，80-120 词，~35 WPM 基准）
- **Advanced**（20 篇，120-180 词，~45 WPM 基准）

---

## 2. 构建顺序（5 批，每批验证后方可进入下一批）

### Batch 1：基础设施 + 文章列表

| 任务 | 文件 |
|------|------|
| 侧边栏新增 Skills 分区 | `index.html` |
| 路由注册 `/skills/typing` | `src/main.js` |
| 模块入口 | `src/modules/skills/typing/index.js` |
| 文章列表渲染（三区可折叠卡片网格） | `src/modules/skills/typing/renderers/ArticleList.js` |
| 语料加载 | `assets/questions/typing/corpus.json` |
| 样式文件 | `src/modules/skills/typing/styles.css` |

**验证：** 点击侧边栏"英文打字练习"→ 能看到三个难度区（默认展开），各 20 张卡片，折叠/展开正常。

### Batch 2：核心打字引擎

| 任务 | 文件 |
|------|------|
| 打字交互核心 | `src/modules/skills/typing/renderers/TypingArea.js` |
| 字符数组初始化 + DOM 构建 | `TypingArea.js` |
| 击键事件绑定 | `TypingArea.js` |
| 正确→黑、错误→红、光标闪烁 | `TypingArea.js` + `styles.css` |
| Backspace 回退 | `TypingArea.js` |

**验证：** 点击任意卡片 → 进入打字页 → 能正常打字，正确变黑，错误变红，Backspace 回退，换行正常。

### Batch 3：计时器 + 暂停/重试

| 任务 | 文件 |
|------|------|
| 计时器工具 | `src/modules/skills/typing/utils/timer.js` |
| 计时器 UI 集成到打字页 | `TypingArea.js` |
| 暂停/继续 | `TypingArea.js` |
| 重试 | `TypingArea.js` |
| 超时自动结束 | `index.js` 状态机 |

**验证：** 计时自动开始→暂停冻结→继续恢复→归零自动弹结果→重试清空重置。

### Batch 4：结果页 + 存储

| 任务 | 文件 |
|------|------|
| 结果页渲染 | `src/modules/skills/typing/renderers/ResultPanel.js` |
| 指标计算 | `src/modules/skills/typing/utils/metrics.js` |
| localStorage 读写 | `src/modules/skills/typing/utils/storage.js` |
| 历史记录存储 | `storage.js` |
| 个人最佳缓存 | `storage.js` |

**验证：** 完成一篇文章 → 展示 RawWpm / NetWpm / 准确率 → 刷新页面 → 历史记录保留。

### Batch 5：错误分布 + 优化

| 任务 | 文件 |
|------|------|
| 错误分类（空格/大小写/拼写/标点） | `metrics.js` |
| 错误分布 UI | `ResultPanel.js` |
| 边界处理（空状态、加载失败、localStorage 满） | `index.js` + `storage.js` |
| 全流程回归验证 | 全部文件 |

**验证：** 结果页面展示四个错误类别的数量和占比，边界情况有合理提示。

---

## 3. 代码规范

### 3.1 架构规范

```javascript
// 模块入口格式 — 与四大模块一致
export default {
  name: 'typing',
  state: {
    page: 'list',
    articles: [],
    currentArticle: null,
    chars: [],
    currentIndex: 0
  },

  async init() { /* 注册模块、加载语料、第一次 render */ },
  render() { /* state.page 驱动分支渲染 */ },
  destroy() { /* 清理计时器、事件监听、存储 session */ }
}
```

### 3.2 语法规范

- **纯函数式**，不使用 `class` 关键字
- 使用 `import/export` ES Module 语法
- DOM 引用使用 `const el = document.getElementById(...)`，不缓存全局 DOM 引用
- 事件监听使用 `addEventListener`，不使用 `onclick` 属性
- 所有回调函数在 `destroy()` 中通过 `removeEventListener` 清理

### 3.3 样式规范

- 所有打字相关样式写在 `src/modules/skills/typing/styles.css` 中
- 使用项目现有的 CSS 变量：

```css
--teal: #008080;
--text: #1d1d1f;
--muted: #86868b;
--surface: #ffffff;
--bg: #f5f5f7;
--border: #e5e5e7;
--radius: 12px;
--apple-font: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif;
```

- class 命名采用 `typing-*` 前缀，避免与全局样式冲突
- 不加多余渐变、动画抖动、弹窗特效

### 3.4 设计规范（Apple 风格）

| 原则 | 说明 |
|------|------|
| 颜色 | 主色 `#008080`（teal），正确黑 `#1d1d1f`，错误红 `#ff3b30`，未输入灰 `#c0c0c4` |
| 字体 | 系统字体栈 `-apple-system, BlinkMacSystemFont, ...` |
| 间距 | `padding: 20px 28px` 为主的舒适间距 |
| 圆角 | 卡片 `12px`，按钮 `8px`，计时器胶囊 `999px` |
| 阴影 | 柔和 `0 2px 8px rgba(0,0,0,0.06)` |
| 不做什么 | 不加纯装饰性元素、不加 AI 味渐变色、不加不必要的交互动画 |

### 3.5 注释规范

- 文件顶部写一行用途说明
- 复杂逻辑（如错误分类）写 1-2 行概要
- 其余不写注释（代码自说明）

---

## 4. 关键技术实现指引

### 4.1 字符数组 → DOM 映射

```javascript
// 初始化 chars
function initChars(content) {
  return content.split('').map(ch => ({
    char: ch,
    expected: ch,
    status: 'untouched'
  }))
}

// 渲染 DOM
function renderChars(container, chars) {
  container.innerHTML = chars.map((c, i) =>
    `<span class="char-${c.status}${i === currentIndex ? ' char-current' : ''}" data-index="${i}">${escapeHtml(c.expected)}</span>`
  ).join('')
}

// 击键后只更新受影响的 span
function updateChar(index, status) {
  const span = document.querySelector(`[data-index="${index}"]`)
  if (!span) return
  span.className = `char-${status}`
}
```

### 4.2 事件绑定

```javascript
function bindKeydown(handler) {
  this._onKeydown = (e) => {
    // 过滤修饰键
    if (e.ctrlKey || e.altKey || e.metaKey) return
    if (e.key === 'Shift' || e.key === 'Tab' || e.key.startsWith('F')) return
    if (e.key.startsWith('Arrow')) return

    e.preventDefault()

    if (e.key === 'Backspace') {
      handler.onBackspace()
      return
    }

    if (e.key.length === 1) {
      handler.onChar(e.key)
    }
  }
  document.addEventListener('keydown', this._onKeydown)
}

function unbindKeydown() {
  if (this._onKeydown) {
    document.removeEventListener('keydown', this._onKeydown)
    this._onKeydown = null
  }
}
```

### 4.3 暂停/继续

```javascript
function pause() {
  timer.pause()
  textContainer.style.pointerEvents = 'none'
  textContainer.style.opacity = '0.6'
  pauseBtn.textContent = '继续'
}

function resume() {
  timer.resume()
  textContainer.style.pointerEvents = 'auto'
  textContainer.style.opacity = '1'
  pauseBtn.textContent = '暂停'
}
```

### 4.4 错误分类

```javascript
export function classifyError(inputChar, expectedChar, prevExpectedChar) {
  if (expectedChar === ' ' || inputChar === ' ') return 'spacing'
  if (expectedChar.toLowerCase() === inputChar.toLowerCase()) return 'capitalization'
  if (/[^\w\s]/.test(expectedChar) || /[^\w\s]/.test(inputChar)) return 'punctuation'
  return 'spelling'
}
```

### 4.5 指标计算

```javascript
export function calculateMetrics(chars, timeSpentSeconds) {
  const total = chars.length
  const correct = chars.filter(c => c.status === 'correct').length
  const incorrect = chars.filter(c => c.status === 'incorrect').length
  const touched = correct + incorrect
  const minutes = timeSpentSeconds / 60

  const rawWpm = Math.round((touched / 5) / minutes)
  const netWpm = Math.round(((touched - incorrect) / 5) / minutes)
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0

  // 错误分类（仅统计 incorrect 的字符）
  const errors = { spacing: 0, capitalization: 0, spelling: 0, punctuation: 0 }
  chars.forEach((c, i) => {
    if (c.status === 'incorrect') {
      const prevChar = i > 0 ? chars[i - 1].expected : ''
      const type = classifyError(c.char, c.expected, prevChar)
      errors[type]++
    }
  })

  return { rawWpm, netWpm, accuracy, errors, correctCount: correct, incorrectCount: incorrect, totalChars: total }
}
```

---

## 5. 验证检查清单

每批完成后，逐项确认：

### Batch 1 验证

- [ ] 侧边栏出现 Skills 分区
- [ ] 点击"英文打字练习"进入文章列表页
- [ ] 三个难度区显示，各 20 篇卡片
- [ ] 折叠/展开正常
- [ ] 卡片显示标题、词数、预计用时
- [ ] 切换回其他模块再回来，页面正常

### Batch 2 验证

- [ ] 点击卡片进入打字页
- [ ] 原文灰色展示，第一个字符有光标
- [ ] 输入正确字符变黑，光标前进
- [ ] 输入错误字符变红（带删除线），光标前进
- [ ] Backspace 回退，字符恢复灰色
- [ ] 空格/大小写/标点均纳入检测
- [ ] 点击"返回"回到文章列表

### Batch 3 验证

- [ ] 进入打字页计时器自动开始
- [ ] 暂停冻结计时器，文字区域只读
- [ ] 继续恢复计时，文字区域可编辑
- [ ] 重试清空所有输入，计时重置
- [ ] 计时归零自动弹出结果

### Batch 4 验证

- [ ] 结果页显示 Raw WPM、Net WPM、准确率
- [ ] 结果页显示错误分布（条状图）
- [ ] 点击"再来一次"重新开始同一篇文章
- [ ] 点击"返回列表"回到文章列表
- [ ] 刷新页面后，历史记录在 localStorage 中存在
- [ ] 再次完成同一篇文章，历史记录追加

### Batch 5 验证

- [ ] 错误分类准确（空格/大小写/拼写/标点）
- [ ] corpus.json 加载失败时有提示
- [ ] 全部完成无报错
- [ ] destroy() 正确清理事件监听和计时器
