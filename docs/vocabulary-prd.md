# Skills — 真题单词背诵 · 产品需求文档（PRD）

| 字段 | 内容 |
|------|------|
| **版本** | 1.0 |
| **日期** | 2026-06-30 |
| **状态** | 初稿 |
| **前置文档** | `docs/v1.0.1-plan.md` |
| **下一阶段** | TDD（技术设计文档） |

---

## 1. 产品概述与目标用户

### 1.1 功能定位

真题单词背诵是托福模考系统 Skills 子功能，旨在帮助考生**系统性地积累托福真题核心词汇**，通过科学记忆曲线和针对性题型训练，提升词汇掌握的效率与深度。

### 1.2 解决的问题

- 托福真题中生词分散在各套 TPO 中，缺乏统一的积累和管理机制
- 考生背词往往脱离真题语境，记住释义但无法在考试中快速反应
- 听说读写四科对词汇的要求不同（阅读需快速识别、听力需听音辨义、写作需拼写运用），单一背词模式无法满足差异化需求
- 缺少科学的间隔复习机制，背了忘、忘了背

### 1.3 目标用户

| 类型 | 特征 | 与单词功能的关系 |
|------|------|----------------|
| 自学型考生 | 预算有限，独立备考 | 做完 TPO 后没有系统方式积累生词 |
| 词汇薄弱者 | 阅读看不懂、听力听不懂 | 需要针对性词汇训练，而非泛泛背词表 |
| 考前冲刺者 | 时间紧张，需要高效复习 | 需要 SM-2 间隔重复，只复习快忘的词 |

---

## 2. 用户流程

```
侧边栏 Skills → 选择「真题单词背诵」
  └→ 四科选择页（右上角乱序/词根模式切换开关）
       │
        ├— [Reading] ─── Step 1: 九宫格扫读（排查已知词）
        │                    └→ Step 2: 组装卡片学习（三种题型轮换）
        │                         ├→ 看英文选中文（50%）
        │                         ├→ 看中文选英文（30%）
        │                         └→ 原句拼写（20%）
        │                         └→ 记住/模糊/不认识 → SM-2
        │
        ├— [Writing] ─── Step 1: 九宫格扫读（排查已知词）
        │                    └→ Step 2: 组装卡片学习（三种题型轮换）
        │                         ├→ 原句拼写（45%）
        │                         ├→ 看中文选英文（30%）
        │                         └→ 看英文选中文（25%）
        │                         └→ 记住/模糊/不认识 → SM-2
       │
       ├— [Listening] ─ 听音选义学习（不展示拼写）
       │                    └→ 选对→模糊 / 选错→不认识
       │
       └— [Speaking] ── 听音选义学习（不展示拼写）
                           └→ 选对→模糊 / 选错→不认识

每日首次打开 → 弹窗提醒今日待背 Set
                    └→ 开始背诵 / 今日不提醒
```

---

## 3. 核心功能 & 优先级

### P0 — MVP 必须实现

| ID | 功能 | 描述 | 验收标准 |
|----|------|------|---------|
| F-01 | 侧边栏 Skills 分区入口 | 在 Skills 分区新增"真题单词背诵"，图标 `fa-book` | ① 点击切换到单词功能页面 ② 视觉风格与现有侧边栏一致 |
| F-02 | 四科选择页 | 展示 Reading / Listening / Speaking / Writing 四个卡片，右上角有乱序/词根模式切换开关 | ① 四个卡片可点击 ② 开关切换后进入科目可见不同 Set 分组 |
| F-03 | 乱序/词根模式切换 | iOS 滑块样式，默认"乱序"，点击切换到"词根" | ① 滑块左右滑动 ② 切换后下方四科卡片不重新渲染 ③ 进入科目后 Set 列表按当前模式呈现 |
| F-04 | 九宫格扫读（Reading & Writing） | 3×3 网格展示 9 个单词，点击方块标记为不认识（变灰），再点击恢复黑色 | ① 黑色展示正常 ② 点击变灰标记为不认识 ③ 不限标记数量 ④ 25 词分 3 页（9+9+7） |
| F-05 | 组装卡片学习（Reading 主力） | 九宫格标记不认识的词进入卡片学习，三种题型动态轮换：看英文选中文（50%）、看中文选英文（30%）、原句拼写（20%） | ① 每种题型交互正确 ② 无 ABCD 标签 ③ 比例可动态调整 ④ 结束后三态评价 |
| F-06 | 组装卡片学习（Writing 主力） | 与 Reading 共享三种题型，比例不同：原句拼写（45%）、看中文选英文（30%）、看英文选中文（25%） | ① 原句拼写不离语境 ② 字母实时比对 ③ 兼顾时态语法 ④ 结束后三态评价 |
| F-07 | 听音选义学习（Listening & Speaking） | 页面居中播放按钮，点击播放单词发音，下方四选一（无 ABCD 标签，直接"词性 + 中文"） | ① 点击播放 ② 选对→模糊 ③ 选错→不认识→优先复习队列 |
| F-08 | SM-2 间隔重复 | 每个单词按 SM-2 算法计算下次复习时间 | ① 记住 q=5，模糊 q=3，不认识 q=1 ② 间隔按公式动态计算 ③ 到期自动出现在复习队列 |
| F-09 | 复习题型轮换 | 所有科目复习时自动轮换三种题型：看英文选中文、看中文选英文、原句拼写。Listening & Speaking 额外增加听音选义 | ① Reading/Writing 三题型轮换 ② Listening/Speaking 以听音选义为主，穿插看中文选英文 |
| F-10 | 每日提醒弹窗 | 首次打开软件弹窗显示今日待背 Set | ① 显示四科各待背 Set 编号 ② "开始背诵"按钮 ③ "今日不提醒"按钮 ④ 完成某科 25 词后该科不再显示 |
| F-11 | 单词详情页 | 展示单词全信息：音标（英+美+播放）、词性+中文释义、派生词、词根词缀拆解、原句例句 | ① 每个字段按布局展示 ② 发音按钮可播放美音和英音 |
| F-12 | localStorage 持久化 | 所有学习记录、复习计划、用户偏好存入 localStorage | ① 刷新不丢失 ② 跨 session 恢复 |

### P1 — 重要功能

| ID | 功能 | 描述 | 验收标准 |
|----|------|------|---------|
| F-13 | 词根词缀模式 Set 浏览 | 词根模式下，Set 按词根分组（如 ab- 组、bene- 组），每组大小不固定 | ① 每组标题显示词根名 + 释义 ② 组内单词数量不定 |
| F-14 | 已完成 Set 标识 | 已完成全部 25 词学习的 Set 在列表上显示 ✅ | ① 完成标识清晰 ② 已完成 Set 可重新进入复习 |
| F-15 | 音选中 / 中选音穿插 | Listening & Speaking 复习时穿插少量反向题型 | ① 偶尔出现 ② 无拼写环节 |

---

## 4. 界面设计

### 4.1 侧边栏布局

```
题目
├── 模考
├── 真题
Skills
├── 英文打字练习
├── 真题单词背诵         ← 新增（fa-book 图标）
其他
├── 托福动态
├── 关注/合作
├── 日志
```

### 4.2 四科选择页

```
┌──────────────────────────────────────┐
│  真题单词背诵                        │
│                         ┌──────────┐│
│                         │ ●   乱序 ││  ← iOS 滑块切换
│                         └──────────┘│
│                                      │
│  ┌────────┐  ┌────────┐             │
│  │ Reading│  │Listening│             │
│  │  60 Set│  │  32 Set │             │
│  └────────┘  └────────┘             │
│  ┌────────┐  ┌────────┐             │
│  │Speaking│  │ Writing │             │
│  │  16 Set│  │  20 Set │             │
│  └────────┘  └────────┘             │
└──────────────────────────────────────┘
```

### 4.3 九宫格扫读页（Reading & Writing）

```
┌──────────────────────────────────────┐
│  Reading · Set 1        3/3 页       │
│                                      │
│  ┌────────┬────────┬────────┐        │
│  │abundant│  bene- │  mal-  │        │  ← 点击变灰标记不认识
│  │        │  volent│  iceous│        │
│  ├────────┼────────┼────────┤        │
│  │  de-   │  ex-   │  pro-  │        │
│  │  ficient│  plicit│  found │        │
│  ├────────┼────────┼────────┤        │
│  │  sub-  │  trans-│  un-   │        │
│  │  stant │  parent│  known │        │
│  └────────┴────────┴────────┘        │
│                                      │
│        [组装卡片学习 →]              │
└──────────────────────────────────────┘
```

### 4.4 听音选义学习页（Listening & Speaking）

```
┌──────────────────────────────────────┐
│  Listening · Set 1                2/25│
│                                      │
│              ▶                       │  ← 居中播放按钮，大小适中
│                                      │
│  丰富的，充裕的   adj.                │
│  缺席的，不在的   adj.                │  ← 点击选项，无 ABCD 标签
│  充足的，足够的   adj.                │
│  大量的，巨大的   adj.                │
│                                      │
│  ← 返回                  进度 ████░░ │
└──────────────────────────────────────┘
```

### 4.5 单词详情页

```
┌──────────────────────────────────────┐
│                                      │
│   abundant                           │  ← 大号加粗
│   /əˈbʌndənt/   🔊US   🔊UK         │  ← 音标 + 播放按钮
│                                      │
│   adj. 丰富的，充裕的                 │
│   adv. abundantly                    │  ← 派生词
│   n. abundance                       │
│                                      │
│   词根词缀拆解：                      │
│   ab-  [前缀] 离开，脱离              │
│   und- [词根] wave，涌动             │
│   -ant [后缀] ...的（形容词后缀）      │
│                                      │
│   例句：                              │
│   "The region has abundant natural   │
│    resources." (TPO-01 Reading)      │
│                                      │
└──────────────────────────────────────┘
```

### 4.6 每日提醒弹窗

```
┌──────────────────────────────────────┐
│  每日单词提醒                         │
│                                      │
│  📖 Reading  Set 3  待背诵           │
│  📖 Listening Set 2  待背诵          │
│  📖 Speaking  Set 1  待背诵          │
│  📖 Writing   Set 4  待背诵          │
│                                      │
│    [开始背诵]   [今日不提醒]          │
└──────────────────────────────────────┘
```

---

## 5. 交互规范

### 5.1 九宫格扫读

| 规则 | 说明 |
|------|------|
| 初始状态 | 9 个方块，每个方块内显示单词，黑色字体 |
| 点击方块 | 单词变灰，标记为"不认识" |
| 再次点击 | 恢复黑色，取消"不认识"标记 |
| 底部按钮 | 点击"组装卡片学习"进入 Step 2 |
| 分页 | 25 词分 3 页（9+9+7），底部有页码指示 |

### 5.2 听音选义学习

| 规则 | 说明 |
|------|------|
| 初始状态 | 页面中心播放按钮，下方 4 个选项（无 ABCD 标签） |
| 点击播放 | Audio 播放单词发音（美音或英音可设置） |
| 选择选项 | 点击选项即提交答案 |
| 选对 | 标记为模糊（q=3），进入下一词 |
| 选错 | 标记为不认识（q=1），进入优先复习队列，展示正确释义后自动跳转 |

### 5.3 组装卡片学习三种题型

| 题型 | 展示内容 | 用户操作 | 出题比例（Reading / Writing） |
|------|---------|---------|---------------------------|
| 看英文选中文 | 英文单词 + 音标 + 发音按钮 | 从 4 个中文选项中点击选择 | 50% / 25% |
| 看中文选英文 | 中文释义 + 词性 | 从 4 个英文选项中点击选择 | 30% / 30% |
| 原句拼写 | 原句（目标词 `____`），兼顾时态语法 | 逐字母拼出完整单词，字符实时比对 | 20% / 45% |

三种题型在同一个学习会话中动态轮换，无 ABCD 标签，选项直接展示"词性 + 文本"。

### 5.4 三态评价

每种题型完成后，用户对当前单词进行状态评价：

| 状态 | 操作 | SM-2 q值 | 行为 |
|------|------|---------|------|
| 记住 | 点击绿色按钮或按快捷键 | 5 | 跳过，正常间隔递进 |
| 模糊 | 点击黄色按钮或按快捷键 | 3 | 间隔减半，不归零 |
| 不认识 | 点击红色按钮或按快捷键 | 1 | 间隔归零，入优先复习队列 |

### 5.5 原句拼写

| 规则 | 说明 |
|------|------|
| 展示 | 原文句子，目标词替换为 `____` |
| 输入 | 用户逐字母输入目标词，实时比对 |
| 正确完成 | 标记为模糊（q=3） |
| 错误或跳过 | 标记为不认识（q=1），展示正确拼写后进入复习队列 |
| 语境要求 | 拼写必须出现在原句中，不单独拼写孤立的单词 |

### 5.6 每日提醒

| 规则 | 说明 |
|------|------|
| 触发时机 | 每天首次打开软件（以 localStorage 记录日期为准） |
| 显示内容 | 四科各自的待背 Set（当日未完成的） |
| 开始背诵 | 跳转到该科 Set 学习页 |
| 今日不提醒 | 关闭当日弹窗，次日恢复 |
| 永久关闭 | 在设置中可关闭全局提醒（P2） |

---

## 6. 数据模型

### 6.1 词库 JSON 结构

文件：`assets/questions/vocabulary/{subject}-words.json`

```json
[
  {
    "id": "vocab-reading-001",
    "word": "abundant",
    "subject": "reading",
    "pos": [
      { "type": "adj", "translation": "丰富的，充裕的" }
    ],
    "pronunciation": {
      "us": "/əˈbʌndənt/",
      "uk": "/əˈbʌndənt/"
    },
    "inflections": {
      "comparative": "more abundant",
      "superlative": "most abundant",
      "adverb": "abundantly",
      "noun": "abundance"
    },
    "etymology": {
      "prefix": { "form": "ab", "meaning": "离开，脱离" },
      "root": { "form": "und", "meaning": "wave，涌动" },
      "suffix": { "form": "ant", "meaning": "形容词后缀，...的" },
      "summary": "ab-(离开) + und-(涌动) + -ant(的) → 大量涌出的 → 丰富的"
    },
    "rootGroup": "ab-",
    "example": "The region has abundant natural resources.",
    "source": "TPO-01 Reading"
  }
]
```

### 6.2 词根词缀映射 JSON

文件：`assets/questions/vocabulary/word-roots.json`

```json
{
  "ab-": {
    "meaning": "离开，脱离",
    "type": "prefix",
    "words": ["abundant", "abandon", "abnormal", "absorb", "abstract"]
  },
  "bene-": {
    "meaning": "好，善",
    "type": "prefix",
    "words": ["benevolent", "benefit", "beneficial", "benediction"]
  },
  "und-": {
    "meaning": "wave，涌动",
    "type": "root",
    "words": ["abundant", "inundate", "undulate", "redundant"]
  }
}
```

### 6.3 localStorage Schema

Key: `skills_vocab_progress`

```javascript
{
  "reading": {
    "set-1": {
      "status": "completed",      // "pending" | "learning" | "completed"
      "completedAt": "2026-06-30T10:00:00.000Z",
      "words": {
        "vocab-reading-001": {
          "ef": 2.5,              // 易度因子
          "interval": 1,          // 当前间隔（天）
          "repetitions": 1,       // 连续正确次数
          "nextReview": "2026-07-01T10:00:00.000Z",
          "lastQ": 5              // 上次 q 值
        }
      }
    }
  },
  "listening": { ... },
  "speaking": { ... },
  "writing": { ... }
}
```

Key: `skills_vocab_settings`

```javascript
{
  "mode": "random",              // "random" | "root"
  "reminderEnabled": true,       // 全局提醒开关
  "lastReminderDate": "2026-06-29"
}
```

---

## 7. 技术栈

| 层面 | 方案 | 理由 |
|------|------|------|
| 模块架构 | `src/modules/skills/vocabulary/index.js` | 与 typing 模块一致，统一路由注册 |
| 页面渲染 | 原生 JS + DOM 操作 | 项目无框架，沿用现有模式 |
| 路由 | `src/core/router.js` 注册 `/skills/vocabulary` | 复用现有 HashRouter |
| 词库加载 | `fetch('assets/questions/vocabulary/{subject}-words.json')` | 按科目按需加载 |
| 数据持久化 | localStorage | 第一阶段统一方案 |
| 发音 | 预生成 MP3 文件，通过 `<audio>` 播放 | 离线可靠，不依赖网络 |
| 图标 | Font Awesome `fa-book`（侧边栏） | 复用现有 CDN |
| CSS 设计令牌 | 沿用 `index.html` 的 `:root` 变量 | 保证视觉统一 |

### 7.1 文件清单（新增/修改）

| 文件 | 说明 |
|------|------|
| `src/modules/skills/vocabulary/index.js` | 模块主入口（新增） |
| `src/modules/skills/vocabulary/styles.css` | 专有样式（新增） |
| `src/modules/skills/vocabulary/renderers/SubjectSelect.js` | 四科选择页渲染（新增） |
| `src/modules/skills/vocabulary/renderers/SetList.js` | Set 列表渲染（新增） |
| `src/modules/skills/vocabulary/renderers/NineGrid.js` | 九宫格扫读渲染（新增） |
| `src/modules/skills/vocabulary/renderers/CardLearning.js` | 卡片学习渲染（新增） |
| `src/modules/skills/vocabulary/renderers/AudioLearning.js` | 听音学习渲染（新增） |
| `src/modules/skills/vocabulary/renderers/ReviewSession.js` | 复习轮换渲染（新增） |
| `src/modules/skills/vocabulary/renderers/WordDetail.js` | 单词详情页渲染（新增） |
| `src/modules/skills/vocabulary/utils/storage.js` | localStorage 封装（新增） |
| `src/modules/skills/vocabulary/utils/scheduler.js` | SM-2 算法实现（新增） |
| `src/modules/skills/vocabulary/utils/speech.js` | MP3 播放封装（新增） |
| `assets/questions/vocabulary/reading-words.json` | 阅读词汇库（新增） |
| `assets/questions/vocabulary/listening-words.json` | 听力词汇库（新增） |
| `assets/questions/vocabulary/speaking-words.json` | 口语词汇库（新增） |
| `assets/questions/vocabulary/writing-words.json` | 写作词汇库（新增） |
| `assets/questions/vocabulary/word-roots.json` | 词根映射库（新增） |
| `assets/audio/vocab/` | 发音 MP3 目录（新增） |
| `index.html` | 侧边栏新增 Skills 分区 + vocabulary 面板（修改） |
| `src/main.js` | 注册 `/skills/vocabulary` 路由（修改） |

---

## 8. 非功能性需求

| 需求 | 指标 |
|------|------|
| 词库加载 | < 300ms（按科目加载约 30-50KB JSON） |
| 发音播放延迟 | < 100ms（本地 MP3，无需网络） |
| 九宫格交互响应 | < 16ms（纯 DOM className 切换） |
| localStorage 占用 | < 500KB（4000 词 × 10 次复习记录估算） |
| 外部依赖 | 无新增（Font Awesome 复用已有） |
| SM-2 计算耗时 | < 1ms（纯数学运算） |

---

## 9. 范围外事项

| 事项 | 原因 |
|------|------|
| 云端同步 | 第二阶段整体规划 |
| 自定义导入词表 | 保持词库质量可控 |
| AI 自动生成例句 | 所有例句来自真题，保证权威性 |
| 语音打分（口语词汇） | 不涉及口语发音评估 |
| 排行榜/社交功能 | 单机备考工具定位 |
| 离线语音包下载进度条 | MP3 已随项目打包，无需下载 |

---

## 10. 词源数据生成方案

### 10.1 数据来源

使用 LLM（GPT-4o-mini）批量生成，4000 词预估费用 ~$1-2。

### 10.2 Prompt 模板

```
请为以下托福词汇生成词源拆解信息：
单词: {word}
科目: {subject}
原文例句: {example}

要求输出 JSON 格式：
{
  "pronunciation": { "us": "美音音标", "uk": "英音音标" },
  "pos": [{ "type": "词性缩写", "translation": "中文释义" }],
  "inflections": { "comparative": "", "superlative": "", "adverb": "", "noun": "" },
  "etymology": {
    "prefix": { "form": "", "meaning": "" },
    "root": { "form": "", "meaning": "" },
    "suffix": { "form": "", "meaning": "" },
    "summary": "简要拆解说明"
  }
}
```

### 10.3 后续扩展

新增 TPO 题库后，提取新词 → 重复 LLM 生成 → 补充到对应科目词表 → 若存在新词根则追加到 word-roots.json 中对应词根组。
