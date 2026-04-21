# TOEFL Reading Scoring System Plan (V2 - Corrected)

## 目标与范围
- 在结果页（reading_results.html）展示 Reading 的双制分数显示
- 格式固定为："Reading 分数 X / Y"（例如 Reading 分数 27 / 5.5）
- X = 30分制的整数部分（0-30）
- Y = 6分制的半分档（0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6）
- 采用动态题量，题量在 35-48 题之间波动
- 移除 Time Spent 卡片（用 Reading 分数取代其位置）
- 评分公式：只作用于 Reading 模块，未来可扩展到其他模块

## 核心取整与显示规则

### 评分公式（方案 A）
```
r1 = correct1 / total1  (Module 1 正确率)
r2 = correct2 / total2  (Module 2 正确率)
total_reading_30 = 30 × (r1 × 0.4 + r2 × 0.6)
```

### 显示计算
- X（30分制整数）= floor(total_reading_30)
- value6 = total_reading_30 / 30 × 6
- Y（6分制半档）= round(value6 × 2) / 2
  - 计算方式：Math.floor(value6 * 2 + 0.5) / 2
  - 等距时向上取整（例如 5.25 → 5.5，5.45 → 5.5）

### 取整边界示例
- 5.45 → 5.5
- 5.25 → 5.5
- 5.1 / 5.2 → 5.0
- 6.0 → 6.0

## 数据存储键名

### 用户已确认的键名
- toefl_tpo01_reading_M1_Task1_correct
- toefl_tpo01_reading_M1_Task1_total
- toefl_tpo01_reading_M2_Task2_correct
- toefl_tpo01_reading_M2_Task2_total

### 读写逻辑
- 答题页在用户选择答案时，更新对应的 correct/total 键
- 结果页读取这四个键，执行上述公式计算

## 实现方案

### CSP 策略（用户确认）
- 通过 meta 标签注入 CSP
- 使用 nonce 机制允许内联脚本执行

### 结果页结构
- 固定容器：`<div id="reading-score-display"></div>`
- 位置：取代原来 Time Spent 卡片的位置
- 内联脚本（带 nonce）：读取 localStorage → 计算 → 渲染文本

### 内联脚本逻辑
```javascript
// 读取数据
var m1Correct = parseInt(localStorage.getItem('toefl_tpo01_reading_M1_Task1_correct') || '0', 10);
var m1Total = parseInt(localStorage.getItem('toefl_tpo01_reading_M1_Task1_total') || '0', 10);
var m2Correct = parseInt(localStorage.getItem('toefl_tpo01_reading_M2_Task2_correct') || '0', 10);
var m2Total = parseInt(localStorage.getItem('toefl_tpo01_reading_M2_Task2_total') || '0', 10);

// 计算
var r1 = (m1Total > 0) ? (m1Correct / m1Total) : 0;
var r2 = (m2Total > 0) ? (m2Correct / m2Total) : 0;
var total_reading_30 = 30 * (r1 * 0.4 + r2 * 0.6);
var reading_30 = Math.floor(total_reading_30);
var value6 = total_reading_30 / 30 * 6;
var six_score = Math.floor(value6 * 2 + 0.5) / 2;

// 渲染
var text = 'Reading 分数 ' + reading_30 + ' / ' + six_score.toFixed(1);
document.getElementById('reading-score-display').textContent = text;
```

## 修改点

### 1. generate_toefl_pages.js
- 在生成 reading_results.html 时注入：
  - CSP meta 标签（带 nonce）
  - 内联脚本块（带 nonce 属性）
  - 固定容器 reading-score-display
- 移除 Time Spent 卡片的生成代码

### 2. 答题页模板
- 在用户选择答案时，更新 localStorage 键：
  - toefl_tpo01_reading_M1_Task1_correct / _total（Module 1 题目）
  - toefl_tpo01_reading_M2_Task2_correct / _total（Module 2 题目）

### 3. 统一命名
- Module 1 文件名格式：reading_m1_task*.html
- Module 2 文件名格式：reading_m2_task*.html

## 验收标准

- [Must] 做题完成后进入结果页，自动显示 "Reading 分数 X / Y" 格式
- [Must] X 为 0-30 整数，Y 为 0-6 半分档
- [Must] Time Spent 卡片已移除
- [Must] 题量动态变化（35-48）不影响计算
- [Must] UI 风格与现有设计一致

## 交付物
- 修改后的 generate_toefl_pages.js
- 更新的结果页模板（含内联脚本）
- 更新的答题页模板（含 localStorage 写入逻辑）
- 本计划文档（V2）