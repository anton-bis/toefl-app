# Database Design — TOEFL AI 批改平台

> ⚠️ **已作废（deprecated）**：本文件为 v1 五表设计，已被 `docs/database-design-v2.md`（v2 企业级设计）取代。仅保留作为演进记录参考。

| 字段 | 内容 |
|------|------|
| **版本** | v1.0 |
| **日期** | 2026-07-29 |
| **状态** | ❌ 已废弃 |
| **数据库** | MySQL |
| **表数量** | 5 张 |

---

## 1. users — 用户表

存储用户账号信息与权限。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INT | PRIMARY KEY AUTO_INCREMENT | 用户编号 |
| email | VARCHAR(255) | UNIQUE NOT NULL | 登录邮箱 |
| password_hash | VARCHAR(255) | NOT NULL | 加密后的密码 |
| nickname | VARCHAR(100) | | 用户昵称 |
| role | ENUM('user','admin') | NOT NULL DEFAULT 'user' | 角色。预留 admin 给管理后台 |
| credits | INT | NOT NULL DEFAULT 0 | 剩余按次批改次数 |
| created_at | DATETIME | NOT NULL DEFAULT CURRENT_TIMESTAMP | 注册时间 |
| updated_at | DATETIME | NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP | 更新时间 |

---

## 2. questions — 题目表

存储所有题目的元数据与原文。每一行对应一个独立的练习项目（一道题或一组关联题）。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INT | PRIMARY KEY AUTO_INCREMENT | 题目编号 |
| tpo_id | VARCHAR(10) | NOT NULL | 所属 TPO，如 "01"、"05" |
| section | ENUM('reading','listening','speaking','writing') | NOT NULL | 所属科目 |
| type | VARCHAR(50) | NOT NULL | 具体题型（见题型对照表） |
| topic | VARCHAR(100) | | 分类标签，用于归类与筛选（见填充规则） |
| title | VARCHAR(255) | | 原文标题，有则直接复用，无则留空 |
| subtitle | VARCHAR(255) | | 内容概括，按题型规则决定是否需要总结 |
| content | TEXT | NOT NULL | 题目原文 Markdown |
| source_path | VARCHAR(255) | NOT NULL | 对应 assets/questions/ 下的文件路径 |
| created_at | DATETIME | NOT NULL DEFAULT CURRENT_TIMESTAMP | 录入时间 |

**索引：**
- `INDEX idx_section (section)`
- `INDEX idx_type (type)`
- `INDEX idx_topic (topic)`
- `INDEX idx_tpo (tpo_id)`
- `FULLTEXT INDEX ft_search (title, subtitle, content)` — 全文检索

### 题型对照表（type 字段取值）

| section | type 取值 | 中文说明 |
|---------|-----------|---------|
| reading | complete-the-words | 完形填空（Fill in the missing letters） |
| reading | read-in-daily-life | 日常阅读（Email / Notice / Text Chain / Post / Ad） |
| reading | read-academic-passage | 学术文章阅读 |
| listening | listen-and-choose | 听选回答（Listen and Choose a Response） |
| listening | listen-conversation | 听对话（Listen to a Conversation） |
| listening | listen-announcement | 听通知（Listen to an Announcement） |
| listening | listen-academic-talk | 听学术讲座（Listen to an Academic Talk） |
| speaking | listen-repeat | 复述（Listen and Repeat） |
| speaking | interview | 面试回答（Take an Interview） |
| writing | build-sentence | 造句（Build a Sentence） |
| writing | write-email | 写邮件（Write an Email） |
| writing | academic-discussion | 学术讨论（Write for an Academic Discussion） |

---

## 3. answers — 作答记录表

存储用户的每次作答原文、录音路径、AI 评分结果和状态。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INT | PRIMARY KEY AUTO_INCREMENT | 记录编号 |
| user_id | INT | NOT NULL | 用户 ID，关联 users.id |
| question_id | INT | NOT NULL | 题目 ID，关联 questions.id |
| content | TEXT | | 用户写的作文原文（写作用） |
| audio_url | VARCHAR(500) | | 录音文件路径（口语用） |
| status | ENUM('pending','graded','failed') | NOT NULL DEFAULT 'pending' | AI 批改状态 |
| ai_score_raw | DECIMAL(3,1) | | 0-5 原始分，仅后台使用，不展示 |
| ai_score_30 | DECIMAL(4,1) | | 30 分制，仅后台换算用，不展示 |
| ai_score_6 | DECIMAL(3,1) | | 6 分制，唯一向用户展示的分数 |
| ai_detail | JSON | | AI 详细反馈：各维度分项分数 + 改进建议 + 润色版全文 |
| error_msg | VARCHAR(500) | | API 失败时的错误信息 |
| created_at | DATETIME | NOT NULL DEFAULT CURRENT_TIMESTAMP | 提交时间 |
| graded_at | DATETIME | | 评分完成时间 |

**索引：**
- `INDEX idx_user (user_id)`
- `INDEX idx_user_status (user_id, status)`
- `INDEX idx_question (question_id)`

---

## 4. orders — 订单表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INT | PRIMARY KEY AUTO_INCREMENT | 订单编号 |
| user_id | INT | NOT NULL | 用户 ID，关联 users.id |
| type | ENUM('credits','monthly') | NOT NULL | 订单类型：购买次数 / 包月 |
| amount | DECIMAL(10,2) | NOT NULL | 支付金额（元） |
| credits_added | INT | | 购买的批改次数（按次时使用） |
| payment_method | VARCHAR(50) | | 支付方式，如 "alipay"、"wechat" |
| trade_no | VARCHAR(100) | | 支付平台交易号 |
| status | ENUM('pending','paid','failed','refunded') | NOT NULL DEFAULT 'pending' | 订单状态 |
| created_at | DATETIME | NOT NULL DEFAULT CURRENT_TIMESTAMP | 下单时间 |
| paid_at | DATETIME | | 支付完成时间 |

**索引：**
- `INDEX idx_user_order (user_id)`
- `INDEX idx_trade_no (trade_no)`

---

## 5. subscriptions — 包月订阅表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INT | PRIMARY KEY AUTO_INCREMENT | 订阅编号 |
| user_id | INT | NOT NULL | 用户 ID，关联 users.id |
| order_id | INT | NOT NULL | 关联的订单 ID，关联 orders.id |
| start_date | DATE | NOT NULL | 生效日期 |
| end_date | DATE | NOT NULL | 到期日期 |
| status | ENUM('active','expired','cancelled') | NOT NULL DEFAULT 'active' | 状态 |
| created_at | DATETIME | NOT NULL DEFAULT CURRENT_TIMESTAMP | 创建时间 |

**索引：**
- `INDEX idx_user_sub (user_id)`
- `INDEX idx_status (status)`

---

## 6. 表关系一览

```
users ── 作答 ──→ answers ── 对应 ──→ questions
  │                                      │
  ├── 购买 ──→ orders                    ├── (tpo_id) → TPO 套题分组
  │              │                       ├── (section) → 科目筛选
  │              └── 产生 ──→ subscriptions    │
  │                                     ├── (type) → 题型筛选
  └── (credits) 控制可用次数            └── (topic) → 话题分类
                                          └── (title + subtitle + content) → 全文检索
```

---

## 7. Title / Subtitle / Topic 填充规则

| 模块 | 题型 | title | subtitle | topic |
|------|------|-------|----------|-------|
| **Reading** | Complete the Words | ❌ | ✅ 段落内容概括 | ✅ 学科大类（如：古生物、生物、地理、宇宙等） |
| | Read in Daily Life | ❌ 搁置 | ❌ 搁置 | ❌ 搁置，按 type 区分即可 |
| | Read an Academic Passage | ✅ 原文标题，直接复用 | ❌ 不补充 | ✅ 学科大类（如：艺术、人文社科、自然科学等） |
| **Listening** | Listen and Choose a Response | ❌ | ❌ | ❌，type 足够 |
| | Listen to a Conversation | ✅ 提取场景标题（如 "Conversation: Library Service"） | ❌ | ✅ 场景大类（如：校园生活） |
| | Listen to an Announcement | ✅ 提取标题（如 "Announcement: Dormitory Rules"） | ❌ | ✅ 场景大类（如：校园活动、校园通知） |
| | Listen to an Academic Talk | ✅ 原文标题（如 "Sociology: Urban Development"） | ❌ | ✅ 学科大类（如：人文社科、自然科学） |
| **Speaking** | Listen and Repeat | ❌ | ✅ 7 句话整体主题概括（如 "Museum Volunteer"） | ✅ 场景分类（如：工作、校园服务） |
| | Take an Interview | ✅ 原文标题（如 "Outdoor Activities"） | ❌ | ✅ 话题大类（如：生活、科技、社会） |
| **Writing** | Write an Email | ❌ | ✅ 信件类型_内容概括（如 "投诉信_公园维护问题"） | ✅ 信件类型（投诉信、赞扬信、沟通信、通知信等） |
| | Academic Discussion | ✅ **总结话题关键词**（如 "Social Mobility"） | ✅ **总结具体讨论问题**（如 "教育背景与人脉关系，哪个对社会阶层流动影响更大？"） | ✅ 学科大类（如：人文社科、科技与生活、环境） |

---

## 8. 完整打标流程

每次导入新题目时，AI 按以下步骤处理：

| 步骤 | 处理内容 |
|------|---------|
| 1 | 读取 Markdown 文件，识别 section 和 type |
| 2 | 填写 tpo_id（从文件路径提取） |
| 3 | 按填充规则提取或总结 title |
| 4 | 按填充规则总结 subtitle |
| 5 | 按填充规则标注 topic |
| 6 | 原样读取 content |
| 7 | 填写 source_path（文件路径） |
| 8 | 生成 created_at 时间戳 |
| 9 | 写入 questions 表 |
| 10 | 更新全文检索索引 |

现有 TPO 01-09 全部按此标准重新打标。

---

## 9. 评分字段展示规则

| 字段 | 存储 | 向用户展示 |
|------|------|-----------|
| ai_score_raw（0-5 分） | ✅ | ❌ 不展示 |
| ai_score_30（30 分制） | ✅ | ❌ 不展示 |
| ai_score_6（6 分制） | ✅ | ✅ 唯一展示的分数 |

评分流程：

```
用户提交 → 存入 answers（status=pending）
  → 调 AI API → 存入 ai_score_raw（0-5）
  → 换算 ai_score_30（raw × 6）
  → 换算 ai_score_6（规则映射）
  → 更新 status=graded
  → 向用户展示 ai_score_6 + ai_detail
```

若 API 失败，status 标记为 failed，用户原文不丢失，可重试。

---

## 10. AI 批改处理流程详解

### 10.1 通用流程

```
用户提交（作文原文或口语录音）
  → 先存入 answers 表（status=pending）
     content 或 audio_url 不丢失
  → 调 AI API（附带对应题型的 ETS 评分标准 rubrics）
     ├─ 成功 → 评分结果写入对应字段，status=graded
     └─ 失败 → status=failed，记录 error_msg
                → 用户看到原文/录音仍在
                → 提示："AI 暂时忙不过来了，稍后重试 🙏"
                → 提供重试按钮
```

### 10.2 Writing — Write an Email 评分流程

```
用户提交邮件正文
  → 保存到 answers 表（status=pending）
  → 调 AI API（附带 ETS 评分标准 rubrics）
  → AI 返回：
      ① 0-5 原始分（存 ai_score_raw，不展示）
      ② 换算 6 分制（存 ai_score_6，展示）
      ③ 各维度分项评分
         - communicative purpose（交际目的达成度）
         - development（内容展开）
         - organization（结构组织）
         - tone（语气恰当性）
         - grammar（语法）
         - vocabulary（词汇）
      ④ 逐条改进建议
      ⑤ AI 润色版——基于用户原文逐句优化
  → 更新 status=graded
  → 展示 ai_score_6 + 分项反馈 + 润色版
```

### 10.3 Writing — Academic Discussion 评分流程

```
用户提交讨论回复
  → 保存到 answers 表（status=pending）
  → 调 AI API（附带 ETS 评分标准 rubrics）
  → AI 返回：
      ① 0-5 原始分（不展示）
      ② 换算 6 分制（展示）
      ③ 各维度分项评分
         - relevance（相关性）
         - development（论证展开）
         - clarity（清晰度）
         - syntactic range（句式多样性）
         - vocabulary（词汇）
         - language accuracy（语言准确性）
      ④ 逐条改进建议
      ⑤ AI 润色版——教用户如何更清晰有力地表达观点
  → 更新 status=graded
  → 展示 ai_score_6 + 分项反馈 + 润色版
```

### 10.4 Speaking — Listen and Repeat 评分流程

```
用户提交复述录音
  → 保存录音到 answers 表（status=pending）
  → 调 AI API（附带 rubrics）
  → AI 返回：
      ① 0-5 原始分（不展示）
      ② 换算 6 分制（展示）
      ③ 各维度分项评分
         - accuracy（准确度）
         - completeness（完整度）
         - intelligibility（清晰度）
      ④ 逐条改进建议
         - 发音检测
         - 连读检测
         - 口误检测
         - 语调检测
      ⑤ ❌ 不提供润色版（复述无润色意义）
  → 更新 status=graded
  → 展示 ai_score_6 + 发音/连读/口误反馈
```

> 注意：Listen and Repeat 的反馈虽然用户不一定能立刻改掉几十年的口语习惯，但详细的发音检测展示了 AI 的专业态度——让用户知道 AI 确实在认真听、仔细分析。

### 10.5 Speaking — Take an Interview 评分流程

```
用户提交回答录音
  → 保存录音到 answers 表（status=pending）
  → 调 AI API（附带 rubrics）
  → AI 返回：
      ① 0-5 原始分（不展示）
      ② 换算 6 分制（展示）
      ③ 各维度分项评分
         - relevance（切题度）
         - development（内容展开）
         - fluency（流利度）
         - intelligibility（清晰度）
         - grammar（语法）
         - vocabulary（词汇）
      ④ 逐条改进建议——教用户如何改进表达
      ⑤ AI 润色版——基于用户回答输出优化版本
         （Interview 本质是简化版的口语写作，
          润色版帮助用户看到"同样的话怎么说更好"）
  → 更新 status=graded
  → 展示 ai_score_6 + 分项反馈 + 润色版
```

---

## 11. 各题型润色版规则汇总

| 题型 | 需要润色版？ | 润色版的定位 |
|------|------------|------------|
| Write an Email | ✅ | 基于用户原文逐句优化 |
| Academic Discussion | ✅ | 教用户如何更清晰有力地表达观点 |
| Take an Interview | ✅ | 基于用户回答输出优化版本（口语版的润色） |
| Listen and Repeat | ❌ | 复述无润色意义，展示专业评分态度即可 |
| Complete the Words | ❌ | 客观题，不涉及 AI 批改 |
| Read in Daily Life | ❌ | 客观题，不涉及 AI 批改 |
| Read an Academic Passage | ❌ | 客观题，不涉及 AI 批改 |
| Listen and Choose a Response | ❌ | 客观题，不涉及 AI 批改 |
| Listen to a Conversation | ❌ | 客观题，不涉及 AI 批改 |
| Listen to an Announcement | ❌ | 客观题，不涉及 AI 批改 |
| Listen to an Academic Talk | ❌ | 客观题，不涉及 AI 批改 |
| Build a Sentence | ❌ | 客观题，不涉及 AI 批改 |
