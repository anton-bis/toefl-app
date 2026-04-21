# TOEFL Reading Scoring System Plan (Ultra Worker, Final)

This is the finalized, single-best plan for implementing the TOEFL Reading scoring system in the project. It assumes the use of the fixed, robust scheme (方案 A) for 6 分制 rounding and the required dual display format (Reading 120 分制 integer and 6 分制 with half-point precision). All changes are designed to be additive and non-disruptive to the existing UI style.

## 1. 目标与范围
- 在结果页（reading_results.html）展示 Reading 的两个分制分数：120 分制的整数显示，以及 6 分制的 0.5 档显示，文本格式固定为 Reading 分数 27 / 5.5（示例）。
- 采用动态题量，边界检测优先通过题目文件名来识别 Module1/Module2 边界，必要时回退到 Intro/Index 的信号。
- 移除结果页中不再需要的 Time spend 时长显示。
- 评分计算仅作用于 Reading 模块（Module 1/Module 2 的合并 Reading 区分），未来如需要可扩展到 Listening/Speaking/Writing。
- 生成脚本与前端 UI 改动须稳定、向后兼容现有风格。

## 2. 核心取整与显示规则（方案 A，单一实现）
- 总分基线：total_reading_30 = 30 × (correct1/total1 × 0.4 + correct2/total2 × 0.6)
- 120 分制显示：reading_120 = floor(total_reading_30)
- 6 分制显示：value6 = total_reading_30 / 30 × 6; six_score = floor(value6 × 2 + 0.5) / 2
- 取整边界示例：5.45 → 5.5；5.25 → 5.5；5.1/5.2 → 5.0；6.0 → 6.0
- UI 文本输出格式：Reading 分数 27 / 5.5（示例）
- 120 分制取整逻辑直接映射为整数显示，6 分制则保留到最近的 0.5 档

## 3. 边界检测与题量处理
- 模块边界优先通过文件名识别：
  - Module 1：reading_question6_*.html
  - Module 2：reading_m2_task2_*.html
- 如未命中文件名边界，再通过 Intro/Index 页信号进行兜底识别
- total1 与 total2 动态变化时，正确率按实际题量计算，确保分数随题量变动自适应

## 4. 修改点（Plan 直接执行的改动清单）
- 修改 generate_toefl_pages.js
  - 实现动态边界检测（首选文件名识别，回退 Intro/Index）
  - 计算 total_reading_30，并产出用于 UI 的双制分数数据（reading_120、reading_6）
  - 将正确答案嵌入或暴露给前端以便比对（如 data-answer 形式）
- 修改 reading_results.html
  - 移除 Time spend 显示块
  - 在结果区以文本形式输出：Reading 分数 27 / 5.5
- 修改 UI 文案与样式以保持原有设计风格，确保文本输出清晰易读
- 将规则和示例写入草案/计划：.sisyphus/drafts/scoring-system.md 与 .sisyphus/plans/toefl-reading-score-plan-v1.md（作为历史版本）
- 编写 Agent-Executed QA 场景草案，覆盖典型场景与边界场景
- 提交变更到版本控制，确保可回溯与可审阅

## 5. 实施示例与公式回顾
- 示例数据：correct1=32, total1=33, correct2=13, total2=15
- total_reading_30 ≈ 27.235
- reading_120 = floor(27.235) = 27
- value6 = 27.235/30 × 6 ≈ 5.447; six_score ≈ 5.5
- 输出文本：Reading 分数 27 / 5.5

## 6. 验收标准（简短而明确）
- [Must] 读取 total_reading_30、reading_120、six_score 的计算公式，且与示例一致
- [Must] UI 显示文本为固定格式“Reading 分数 X / Y”，X 为 floor(total_reading_30)，Y 为最近的半分刻度（0.5 间隔）
- [Must] Time spend 字段在结果页被移除
- [Must] 边界检测优先通过文件名识别 Module；回退策略可工作
- [Must] 结果页风格与现有 UI 保持一致，文本输出简洁易读
- [Must] Plan.md / Drafts 记录全面，QA 场景覆盖常见与边界情况
- [Must] Plan 审核通过后进入实现执行阶段

## 7. 风险与缓解
- 风险：题量波动过大导致分配不均。缓解：使用动态 total1/total2 与正确率进行计算，避免硬编码。
- 风险：取整边界争议。缓解：按固定规则实现，文档中给出明确边界示例，避免歧义。
- 风险：UI 文案在不同语言/地区显示不一致。缓解：固定文本模板，易于本地化。

## 8. 交付物
- Plan：.sisyphus/plans/toefl-reading-score-plan-ultra.md（当前最终版）
- Script 修改：generate_toefl_pages.js
- 结果页修改：reading_results.html
- Drafts：.sisyphus/drafts/scoring-system.md

请确认上述 Plan 为最终可执行版本。如果你确认无误，我将推进以下执行阶段：
- 将 Plan.md 直接变成执行任务的工作流入口，触发 Sisyphus 的计划执行
- 开始实现生成脚本修改、结果页 UI 修改、以及 QA 测试设计与执行脚本编写
