# Email Question Template (`email-question.html`)

## 概述

这是一个标准化、完整的TOEFL阅读Email题型模板，包含所有必要的HTML结构、CSS样式和JavaScript功能。模板采用组件化设计，确保所有Email题目页面具有统一的结构、样式和功能。

## 功能特性

- ✅ 完整的Email阅读界面（苹果风格设计）
- ✅ 选择题交互界面
- ✅ 计时器功能（与question2相同）
- ✅ **Check Answers功能** - 检查答案、显示统计、答案详情、重做错题
- ✅ **Review功能** - 题目标记、进度跟踪、快速跳转
- ✅ 响应式设计（支持移动设备）
- ✅ 本地存储保存答案、计时器状态、标记题目
- ✅ 统一的导航栏（包含Check Answers和Review按钮）

## 模板参数

模板使用以下占位符，需要在渲染时替换为实际值：

| 参数                 | 类型      | 描述                           | 示例                         |
| -------------------- | --------- | ------------------------------ | ---------------------------- |
| `{{questionNumber}}` | 数字      | 题目编号（显示用）             | `21`                         |
| `{{questionId}}`     | 字符串    | 题目唯一标识符（用于数据存储） | `"21"`                       |
| `{{backUrl}}`        | URL字符串 | 返回上一题的页面URL            | `"reading_question2.html"`   |
| `{{nextUrl}}`        | URL字符串 | 跳转到下一题的页面URL          | `"reading_question3_2.html"` |

## 组件依赖

模板依赖以下组件文件（位于`components/`目录）：

| 组件文件                  | 用途          | 必需占位符                                                  |
| ------------------------- | ------------- | ----------------------------------------------------------- |
| `header.html`             | 导航栏        | 无                                                          |
| `progress.html`           | 进度信息      | `{{questionNumber}}`                                        |
| `email-container.html`    | Email内容容器 | `{{date}}`, `{{subject}}`, `{{bodyLines}}`, `{{signature}}` |
| `question-container.html` | 题目容器      | `{{questionText}}`, `{{questionId}}`, `{{options}}`数组     |
| `answers-check-area.html` | 答案检查区域  | 无（纯HTML）                                                |
| `review-panel.html`       | Review面板    | 无（纯HTML）                                                |

## 使用方法

### 1. 准备组件数据

确保所有组件文件已准备并包含正确的数据：

```javascript
// email-container.html 需要的数据
date: "October 15, 2024"
subject: "Course Registration Inquiry"
bodyLines: ["Dear Professor Johnson,", "I am writing to inquire about...", ...]
signature: "Sincerely,\nAlex Chen"

// question-container.html 需要的数据
questionText: "What is the main purpose of the email?"
questionId: "21"
options: [
  { letter: "A", text: "To request an extension", correct: false },
  { letter: "B", text: "To inquire about course availability", correct: true },
  // ...
]
```

### 2. 渲染模板

使用模板引擎（如Handlebars、Mustache或服务器端渲染）将参数注入模板：

```javascript
const templateData = {
  questionNumber: 21,
  questionId: '21',
  backUrl: 'reading_question2.html',
  nextUrl: 'reading_question3_2.html'
};
```

### 3. 生成完整页面

渲染后的页面将包含所有功能：

- 计时器自动启动并同步
- 选项选择自动保存到localStorage
- Check Answers和Review功能完整可用

## 关键功能说明

### Check Answers功能

- **触发**: 点击导航栏"Check Answers"按钮
- **功能**:
  1. 检查当前题目的答案
  2. 显示统计信息（正确/错误/未答/准确率）
  3. 显示详细答案分析
  4. 提供"重做错题"和"关闭"按钮
- **数据存储**: 使用localStorage存储答案

### Review功能

- **触发**: 点击导航栏"Review"按钮
- **功能**:
  1. 显示侧边面板，展示题目状态
  2. 标记/取消标记题目（黄色旗帜）
  3. 跳转到标记的题目
  4. 显示答题进度统计
- **数据存储**: 使用localStorage存储标记的题目

## 样式定制

模板包含两个主要样式部分：

1. **基础样式**（第13-162行）- Email和题目容器样式
2. **功能样式**（第164-758行）- Check Answers和Review功能样式

如需自定义样式，请直接修改CSS部分。

## 浏览器兼容性

- 现代浏览器（Chrome 80+, Firefox 75+, Safari 13+）
- 支持ES6 JavaScript
- 依赖Font Awesome 6图标库（CDN引入）

## 故障排除

### 常见问题

1. **Check Answers按钮不工作**
   - 检查`check-answers-btn`元素是否存在
   - 检查`checkAllAnswers`函数是否正确定义

2. **Review面板不显示**
   - 检查`review-panel`和`review-overlay`元素
   - 检查CSS中`.review-panel.active`样式

3. **答案未保存**
   - 检查localStorage是否可用（浏览器隐私模式可能禁用）
   - 检查`data-question`和`data-option`属性是否正确设置

4. **组件未加载**
   - 确保所有组件文件存在于`components/`目录
   - 检查模板引擎的部分包含语法

## 更新日志

- **2026-04-03**: 创建标准化模板，集成Check Answers和Review功能
- **2026-04-03**: 添加完整的CSS样式和JavaScript功能
- **2026-04-03**: 组件化设计，分离为独立组件文件

## 技术支持

如遇问题，请检查：

1. 浏览器控制台错误信息
2. localStorage权限
3. 网络连接（Font Awesome CDN）
4. 组件文件路径和权限
