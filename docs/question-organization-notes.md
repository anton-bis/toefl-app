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

## 6. 日常工作流程

1. 新题以 Markdown 写入 assets/questions/ 对应 TPO 文件夹（格式与现有一致）。
2. 完成后来一段"导入指令"，AI 会：读 Markdown → 编译校验 → 生成不可变版本
   → 自动打标 title/subtitle/topic → 写入索引。
3. 打标结果可人工复核（AI 标注会带 source=ai + confidence）。

## 7. 参考文件

- docs/database-design-v2.md（第 8 节：内容与题库域）
- docs/mysql-schema-v2.sql（content_tasks / content_questions / topics 表）
- 现有题库：assets/questions/ 下各 TPO 文件
