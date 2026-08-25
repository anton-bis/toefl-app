# 真题整理 — 题库 Markdown 维护指南

## 0. 一句话背景

题库源文件是 Markdown，存放在 toefl-app 仓库 assets/questions/ 下，按 TPO 分文件夹。
整理形式**没有改变**：继续用 Markdown + TPO 文件夹。数据库不存题目正文，
题目在导入时被编译成索引，title/subtitle/topic 标签由 AI 导入时自动生成。

## 1. 题库现状（已完成的覆盖）

- Reading：TPO 01-09
- Listening：TPO 01-07
- Speaking：TPO 01-07
- Writing：TPO 01-09

路径结构：
  assets/questions/reading/TPO-XX/reading-TPO-XX.md
  assets/questions/listening/TPO-XX/listening-TPO-XX.md
  assets/questions/speaking/TPO-XX/speaking-TPO-XX.md
  assets/questions/writing/TPO-XX/writing-TPO-XX.md

## 2. ⚠️ 最重要的事项：TPO 7/8/9 是样题不是真 TPO

- TPO 01-06：真 TPO 真题
- TPO 07/08/09：用的是 ETS 官方样题（不是真 TPO）
- 这是曾经被用户指出的硬伤。整理或宣传时**必须区分标注**，
  不能把样题写成"真 TPO"。

## 3. 12 种题型（type 取值固定）

| section | type | 中文 |
|---------|------|------|
| reading | complete-the-words | 完形填空 |
| reading | read-in-daily-life | 日常阅读 |
| reading | read-academic-passage | 学术文章 |
| listening | listen-and-choose | 听选回答 |
| listening | listen-conversation | 听对话 |
| listening | listen-announcement | 听通知 |
| listening | listen-academic-talk | 听学术讲座 |
| speaking | listen-repeat | 复述 |
| speaking | interview | 面试回答 |
| writing | build-sentence | 造句 |
| writing | write-email | 写邮件 |
| writing | academic-discussion | 学术讨论 |

> **Parser 内部子类型（不进 DB type 维度，仅用于解析与渲染区分）**：
> reading 的 `read-in-daily-life` 下含 email / notice / announcement / advertisement / text-chain /
> social-media 等子类型。标题里出现 "Announcement" 会解析为 `announcement`（渲染为通知公告卡片，
> 指令文案 "Read an announcement"）；出现 "Notice" 解析为 `notice`。DB 层不做新增题型。

## 4. 打标规则（title / subtitle / topic 怎么填）

| 题型 | title | subtitle | topic |
|------|-------|----------|-------|
| complete-the-words | 无 | ✅ 概括段落内容 | ✅ 学科大类（生物/地理/天文等） |
| read-in-daily-life | 无 | 无 | 无（靠 type 区分） |
| read-academic-passage | ✅ 原文标题 | 无 | ✅ 学科大类 |
| listen-and-choose | 无 | 无 | 无 |
| listen-conversation | ✅ 场景标题 | 无 | ✅ 场景大类（校园生活等） |
| listen-announcement | ✅ 标题 | 无 | ✅ 场景大类 |
| listen-academic-talk | ✅ 原文标题 | 无 | ✅ 学科大类 |
| listen-repeat | 无 | ✅ 7句话主题概括 | ✅ 场景分类（工作等） |
| interview | ✅ 原文标题 | 无 | ✅ 话题大类 |
| build-sentence | 无 | 无 | 无 |
| write-email | 无 | ✅ 信件类型_内容概括 | ✅ 信件类型（投诉/沟通/赞扬等） |
| academic-discussion | ✅ 话题关键词 | ✅ 具体讨论问题 | ✅ 学科大类 |

打标由 AI 在导入时自动完成，按此表为准则。

## 5. 内容组织要求

- 每套 TPO 的 Markdown 保持现有结构（Module/Task/Question 分层）不变。
- 阅读、听力、写作、口语四科各自独立文件。
- 学术文章的标题（如 "The Power of Music"）要在 Markdown 中可被识别，
  AI 才能自动提取成 title。
- 话题标签最终会进入 topics 表（按 namespace 分类：
  subject 生物/地理/历史/艺术；scene 校园生活/工作/服务；
  letter_type 投诉/沟通/通知/赞扬；skill 发音/组织/语法/词汇）。

### 5.1 图片与头像字段约定

题目中可引用图片 / 头像文件，文件名需与 Markdown 同目录存放，编译时由
`collectDocumentAssets` 自动收集进内容包（`.png/.jpg/.jpeg/.gif/.webp` 等）。

| 字段（Markdown） | 作用范围 | 编译后字段 | 说明 |
|---|---|---|---|
| `image: xxx.png` | listening 题目 / task 级 | `question.image` / `task.image` | 题目行之后出现 → 该题图片；题目区之前出现 → 整段共用场景图 |
| `scenario_image:` | speaking 场景 | `task.scenario.image` | speaking 场景图（已有） |
| `speaker_a_image:` / `speaker_b_image:` | writing build-sentence | `question.speakerAImage` / `speakerBImage` | 造句两位发言人头像，无图时渲染图标兜底 |
| `professor_image:` | writing academic-discussion | `question.professorImage` | 教授头像，居中于左侧发言区 |
| `student_a_image:` / `student_b_image:` | writing academic-discussion | `students[0].image` / `students[1].image` | 按出现顺序绑定到对应学生发言 |
| `image:`（speaking 每题） | speaking 题目 | `question.image` | speaking 每题图片（已有） |

命名约定：Markdown 用 snake_case（`speaker_a_image`），编译产物用 camelCase（`speakerAImage`）。
write-email 不使用头像。

#### Writing 头像库

Writing 头像统一存放于 `assets/questions/writing/avatars/`（详见该目录 README.md），
按题型区分两套：

- **Build Sentence（白底）**：`avatar-bs-1.png` … `avatar-bs-16.png`
- **Academic Discussion（场景底）**：`avatar-d-1.png` … `avatar-d-7.png`

头像与引用它的 Markdown 同级目录存放（收集管线按 `sourceDirectory + 文件名` 解析，
路径不允许 `..`，故不用子目录；统一 400×400 透明底 PNG）。
分配规则：各题型从对应子集随机抽取、同一题内不重复、不同题可复用、无图时图标兜底。

### 5.2 Reading daily-life 卡片标题与页面主标题（防复发规则）

- **页面主标题** = parser 生成的 `task.title`（题型名，如 `Read a Poster`）。前端直接渲染 `task.title`，
  不要走指令文案的 fallback（早期用 `instructionFor`，漏配类型时退化成 "Read the passage"）。
- **卡片标题（左侧内容区主标题）** = 正文第一行（如 `Join the Mechanicsburg Clean-Up Day!` /
  `Downtown School of Data Skills`）。由 `parseDailyPassage` 对**所有非 email 子类型统一提取**
  （除非 passage 带显式 `Title:` 元数据），**不依赖手写类型枚举**。
- **新增 daily-life 子类型时无需改前端/helpers**：只需在 `content-core/parsers/reading.js` 的 TYPES 加映射。
  标题、指令、渲染全部由通用规则自动覆盖。
- 已踩坑（两处均根治，勿回退）：
  1. 早期用 `FIRST_LINE_TITLE` 手写枚举，漏了 notice/announcement → 卡片标题退化成题型名；
  2. 改完代码未用 `ELECTRON=true` 重建 dist → 页面主标题显示旧的 fallback 文案。



## 6. 日常工作流程

1. 新题以 Markdown 写入 assets/questions/ 对应 TPO 文件夹（格式与现有一致）。
2. 完成后来一段"导入指令"，AI 会：读 Markdown → 编译校验 → 生成不可变版本
   → 自动打标 title/subtitle/topic → 写入索引。
3. 打标结果可人工复核（AI 标注会带 source=ai + confidence）。

### 6.1 真真题（日期文件夹）索引

- 真真题（非 ETS 官方 TPO 样题）以日期文件夹命名：`assets/questions/<section>/2026-01-27/`。
- 同一天有多场考试时，用 `YYYY-MM-DD (N)` 后缀区分场次（如 `2026-02-01 (2)` 表示当天第二场，
  `tpoId` 取完整文件夹名，首页显示 `TPO 02-01 (2)`），仍归 Official Tests 面板。
- `content-core/manifest.js` 同时支持 `TPO-\d+`、`YYYY-MM-DD` 与 `YYYY-MM-DD (N)` 三类文件夹，
  `tpoId` 对日期文件夹取文件夹名（如 `2026-01-27`）。
- 文件名需与文件夹一致：`<section>-2026-01-27.md`（含后缀时 `<section>-2026-02-01 (2).md`）。
- 排序：TPO 数字在前，日期文件夹按字符串序在后（localeCompare）。
- 标题 warning 校验只针对 TPO 数字文件夹，日期文件夹跳过。

## 7. 参考文件

- docs/database-design-v2.md（第 8 节：内容与题库域）
- docs/mysql-schema-v2.sql（content_tasks / content_questions / topics 表）
- 现有题库：assets/questions/ 下各 TPO 文件
