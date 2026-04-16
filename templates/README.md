# TOEFL iBT Reading Templates

## 概述

本文件夹包含TOEFL阅读模块的HTML模板，可用于快速创建新的阅读题目页面。

## 模板结构

```
templates/
├── read-an-email/
│   └── template.html          # Read in Daily Life - Email题型模板
├── fill-in-missing-letters/
│   └── template.html          # Complete the Words - 填空题型模板
└── general/
    ├── start-page-template.html    # 开始页面模板
    └── module-intro-template.html # Module介绍页面模板
```

## 模板使用说明

### 1. Read an Email 模板 (read-an-email/template.html)

适用于 "Read in Daily Life" 题型中的 Email 阅读题目。

#### 占位符替换

| 占位符                | 说明            | 示例                                              |
| --------------------- | --------------- | ------------------------------------------------- |
| `{{QUESTION_NUMBER}}` | 题号            | `25`                                              |
| `{{QUESTION_COUNT}}`  | 总题数          | `33`                                              |
| `{{TIMER_SECONDS}}`   | 计时器秒数      | `690` (11分30秒)                                  |
| `{{BACK_PAGE}}`       | 返回页面路径    | `reading_question4_2.html`                        |
| `{{NEXT_PAGE}}`       | 下一页面路径    | `reading_question5_1.html`                        |
| `{{INSTRUCTION}}`     | 题型说明        | `Read an email`                                   |
| `{{QUESTION_TEXT}}`   | 题目文本        | `The email suggests that...`                      |
| `{{EMAIL_DATE}}`      | 邮件日期        | `Next Tuesday/Wednesday`                          |
| `{{EMAIL_SUBJECT}}`   | 邮件主题        | `Training Webinar on Advanced Project Management` |
| `{{EMAIL_BODY}}`      | 邮件正文 (HTML) | `<p class="email-paragraph">...</p>`              |
| `{{EMAIL_SENDER}}`    | 发件人姓名      | `Maria Sanchez`                                   |
| `{{OPTIONS}}`         | 选项HTML        | 见下方选项示例                                    |

#### 选项HTML示例

```html
<div class="option-item-apple" data-question="25" data-option="A" data-correct="false">
  <div class="option-letter-apple">A</div>
  <div class="option-text-apple">contact Mr. Thompson</div>
</div>
```

#### 使用步骤

1. 复制 `template.html` 为新的题目文件，如 `reading_question25.html`
2. 替换所有占位符
3. 修改 `{{BACK_PAGE}}` 和 `{{NEXT_PAGE}}` 为正确的页面路径
4. 在 `{{OPTIONS}}` 处填入所有选项（确保正确答案的 `data-correct="true"`）

---

### 2. Fill in Missing Letters 模板 (fill-in-missing-letters/template.html)

适用于 "Complete the Words" 题型，填空补全单词题目。

#### 占位符替换

| 占位符                  | 说明            | 示例                                                       |
| ----------------------- | --------------- | ---------------------------------------------------------- |
| `{{QUESTION_NUMBER}}`   | 题号            | `1`                                                        |
| `{{QUESTION_COUNT}}`    | 总题数          | `33`                                                       |
| `{{TIMER_SECONDS}}`     | 计时器秒数      | `690`                                                      |
| `{{BACK_PAGE}}`         | 返回页面路径    | `reading_start_page.html`                                  |
| `{{NEXT_PAGE}}`         | 下一页面路径    | `reading_question2.html`                                   |
| `{{READING_TITLE}}`     | 阅读材料标题    | `Academic Reading`                                         |
| `{{PROGRESS_TEXT}}`     | 进度文本        | `Questions 1-5`                                            |
| `{{INSTRUCTION}}`       | 题型说明        | `Complete the word by typing in all the letters you hear.` |
| `{{PARAGRAPH_CONTENT}}` | 段落内容 (HTML) | 见下方示例                                                 |
| `{{TOTAL_BLANKS}}`      | 总填空数        | `5`                                                        |
| `{{BLANKS_CONFIG}}`     | 填空配置        | 见下方配置示例                                             |

#### 段落内容HTML示例

```html
<span class="word-container">
  <span class="word-prefix">c</span>
  <input type="text" class="part-input" data-question="1" maxlength="3" placeholder="___" />
</span>
<span class="word-container">
  <span class="word-prefix">an</span>
  <input type="text" class="part-input" data-question="2" maxlength="3" placeholder="___" />
</span>
<span class="word-container">
  <span class="word-prefix">bec</span>
  <input type="text" class="part-input" data-question="3" maxlength="2" placeholder="__" />
</span>
```

#### 填空配置示例

```javascript
const blanks = [
  { id: '1', answer: 'OM' },
  { id: '2', answer: 'PLE' },
  { id: '3', answer: 'TE' }
];
```

#### 填空属性说明

- `data-question`: 题号，用于标识答案
- `maxlength`: 最大输入字符数
- `placeholder`: 下划线数量（与maxlength对应）
  - `_` = 1个字符
  - `__` = 2个字符
  - `___` = 3个字符
  - `____` = 4个字符
  - `_____` = 5个字符

---

### 3. 开始页面模板 (general/start-page-template.html)

TOEFL阅读模块的入口页面。

#### 特点

- 无需修改，可直接使用
- 包含题型说明表格
- 提供 Begin 按钮跳转到 Module 介绍页面

#### 使用说明

1. 复制到项目根目录
2. 重命名为 `reading_start_page.html`
3. 确保 `module1-intro.html` 存在于同一目录

---

### 4. Module介绍页面模板 (general/module-intro-template.html)

Module开始前的介绍页面，显示计时器和导航说明。

#### 占位符替换

| 占位符                    | 说明           | 示例                     |
| ------------------------- | -------------- | ------------------------ |
| `{{MODULE_NUMBER}}`       | 模块编号       | `1` 或 `2`               |
| `{{TIMER_SECONDS}}`       | 计时器秒数     | `690`                    |
| `{{TIME_FORMAT}}`         | 时间显示格式   | `11:30`                  |
| `{{MODULE_DESCRIPTION}}`  | 模块描述       | 见下方示例               |
| `{{FIRST_QUESTION_PAGE}}` | 第一题页面路径 | `reading_question1.html` |

#### 模块描述示例

```html
<p class="description">
  The clock will show you how much time you have to complete Module 1. You can use
  <strong>Next</strong> and <strong>Back</strong> to move to the next question or return to previous
  questions within the same module. You WILL NOT be able to return to Module 1 once you have begun
  Module 2.
</p>
```

---

## 通用说明

### 样式依赖

所有模板依赖 `styles.css`，确保该文件存在且包含以下样式：

- `.header` - 顶部导航栏
- `.logo` - Logo样式
- `.nav-buttons` - 导航按钮容器
- `.nav-button` - 导航按钮基础样式
- `.nav-button.dark` / `.nav-button.light` - 按钮变体
- `.main-content` - 主内容区域
- `.section-title` - 章节标题
- `.page-header` - 页面标题区域
- `.page-title` - 页面标题
- `.title-underline` - 标题下划线
- `.description` - 描述文本
- `.task-table` - 任务表格

### 字体图标

模板使用 Font Awesome 6.4.0，通过 CDN 引入：

```html
<link
  rel="stylesheet"
  href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
/>
```

### localStorage 键

模板使用以下 localStorage 键存储数据：

| 键名                     | 说明                  |
| ------------------------ | --------------------- |
| `toefl_timer_remaining`  | 剩余计时器秒数        |
| `toefl_timer_started`    | 计时器是否已开始      |
| `toefl_answers`          | 用户答案 (JSON对象)   |
| `toefl_marked_questions` | 标记的题目 (JSON数组) |

---

## 快速开始流程

### 添加新的阅读真题

1. **准备通用页面**
   - 使用 `start-page-template.html` 作为 `reading_start_page.html`
   - 使用 `module-intro-template.html` 作为 `module1-intro.html`

2. **创建题目页面**
   - 根据题型选择模板：
     - Email题型 → `read-an-email/template.html`
     - 填空题型 → `fill-in-missing-letters/template.html`
3. **替换占位符**
   - 按表格说明替换所有 `{{PLACEHOLDER}}`
   - 确保页面路径正确连接

4. **测试**
   - 确保计时器正常
   - 确保导航按钮跳转正确
   - 确保答案保存功能正常

---

## 文件命名规范

- 开始页面: `reading_start_page.html`
- Module介绍: `module1-intro.html`, `module2-intro.html`
- 题目页面: `reading_question1.html`, `reading_question2.html`, ...
- 或按题型分组: `reading_module1_task1.html`, `reading_module1_task2.html`, ...

---

## 注意事项

1. **计时器设置**: 确保每个Module的计时器秒数与要求一致
2. **页面跳转**: 确保 `BACK_PAGE` 和 `NEXT_PAGE` 指向正确的文件
3. **答案验证**: 填空题需要正确配置 `BLANKS_CONFIG` 数组
4. **样式一致性**: 修改样式时请同步更新 `styles.css`
