# docs/superpowers 设计文档索引

本目录是 spec-driven 开发的设计文档库。每个非平凡改动遵循 **spec(设计)→ plan(实现计划)→ 代码** 流程:先在 `specs/` 写设计文档,批准后在 `plans/` 写实现计划,再执行。过程产物(task brief/report)在 `.superpowers/sdd/`,不进仓库。

CI 通过 `npm run check:docs`(`scripts/check-docs-index.mjs`)校验本索引列出了所有 spec/plan 文件,防止新文档漏登记。**新增 spec 或 plan 时,务必同步在下面登记一行,否则 CI 会失败。**

文档按主题分组,组内按日期排序。

## 顶层路线图

- **JLPT 备考能力评估与开发路线图** — 产品定位、能力基线、里程碑 M1–M5。 [文档](2026-07-10-jlpt-prep-assessment.md)

## Mokuro 阅读器

- **页范围批量分析** — 选起止页一次性批量分析该范围所有 OCR 块。 [spec](specs/2026-07-04-mokuro-page-range-batch-design.md) · [plan](plans/2026-07-04-mokuro-page-range-batch-plan.md)
- **每页缓存与批处理 UX** — 拆分单文件缓存为每页缓存,批处理运行时可翻页查看已分析结果。 [spec](specs/2026-07-04-mokuro-per-page-cache-design.md) · [plan](plans/2026-07-04-mokuro-per-page-cache-plan.md)
- **布局与分析展示简化** — 分析结果移到右侧栏,简化展示(翻译、非初阶词汇、语法)。 [spec](specs/2026-07-04-mokuro-reader-layout-design.md) · [plan](plans/2026-07-04-mokuro-reader-layout-plan.md)
- **批处理加固(retroactive)** — 页范围批处理 + 每页缓存之上的生产加固层,事后补写。 [spec](specs/2026-07-05-mokuro-batch-hardening-design.md)
- **键盘快捷键** — ↑↓ 选块、←→ 翻页(漫画右起)、Enter 分析、Esc/Home/End 跳转。 [spec](specs/2026-07-06-mokuro-keyboard-nav-design.md) · [plan](plans/2026-07-06-mokuro-keyboard-nav.md)
- **OCR 文本块网格化** — 文本块列表从右栏移到图片下方自适应网格,右侧只留聚焦卡 + 分析。 [plan](plans/2026-07-09-ocr-blocks-grid.md)
- **Yomitan 右侧取词区** — 右栏改造为 Yomitan 可取词区(顶部聚焦卡 / 中部分析 / 底部全文)。 [spec](specs/2026-07-09-yomitan-right-side-lookup-design.md) · [plan](plans/2026-07-09-yomitan-right-side-lookup.md)
- **音色与阅读连续性** — 会话内验证音色、打开生词本不卸载阅读器、重选目录恢复阅读位置。 [spec](specs/2026-07-11-mokuro-speech-and-reading-continuity-design.md) · [plan](plans/2026-07-11-mokuro-speech-and-reading-continuity.md)
- **Web Speech 懒验证** — 移除全量音色预验证,首次朗读与单音色按需验证并自动回退。 [spec](specs/2026-07-11-speech-lazy-validation-design.md) · [plan](plans/2026-07-11-speech-lazy-validation.md)

## JLPT 等级、词汇与语法

- **JLPT 词汇等级校准(M2A)** — 固定词表确定性校准;AI `difficulty` 不参与产品行为。 [spec](specs/2026-07-10-jlpt-level-calibration-design.md) · [plan](plans/2026-07-10-jlpt-level-calibration.md)
- **个人词汇本(M1)** — 生词收藏、查看、删除、清空与 localStorage 持久化。 [spec](specs/2026-07-10-word-bank-design.md) · [plan](plans/2026-07-10-word-bank.md)
- **目标等级体验(M2B)** — 共享持久化 JLPT 目标等级,词汇分基础/重点/超纲/未定级四类。 [spec](specs/2026-07-11-jlpt-target-experience-design.md) · [plan](plans/2026-07-11-jlpt-target-experience.md)
- **语法等级与收藏(M5)** — 同源 Tanos grammar list 固定等级、收藏与四分组交付。 [spec](specs/2026-07-12-grammar-level-and-bank-design.md) · [plan](plans/2026-07-12-grammar-level-upgrade.md)
- **语法收藏兜底** — Tanos 暂不可结构化提取时,交付独立可持久化语法收藏,不显示/写入未准入等级。 [plan](plans/2026-07-12-grammar-bank-fallback.md)
- **扁平语法列表** — Mokuro 语法渲染为单一紧凑、文本顺序列表,不分 JLPT 组。 [spec](specs/2026-07-12-flat-grammar-list-design.md) · [plan](plans/2026-07-12-flat-grammar-list.md)

## Anki 导出与 SRS 复习

- **Anki TSV 导出(M3)** — 生词本一键导出 Anki 兼容 UTF-8 TSV(带字段与标签声明)。 [spec](specs/2026-07-12-anki-tsv-export-design.md) · [plan](plans/2026-07-12-anki-tsv-export.md)
- **基础 SRS(M4)** — FSRS 四档评分、每日队列、本地持久化复习页。 [spec](specs/2026-07-12-basic-srs-design.md) · [plan](plans/2026-07-12-basic-srs.md)
- **复习返回与词汇顺序** — 进出复习保留阅读器状态,词汇按选中顺序渲染、不分 JLPT 组。 [spec](specs/2026-07-12-review-return-and-vocabulary-order-design.md) · [plan](plans/2026-07-12-review-return-and-vocabulary-order.md)

## 文本分析与 AI 服务

- **纯文本输入** — 支持粘贴纯文本直接分析,不依赖图片或 Mokuro。 [spec](specs/2026-07-13-text-input-design.md) · [plan](plans/2026-07-13-text-input.md)
- **OPENAI_BASE_URL 修复** — OpenAIService 尊重 `OPENAI_BASE_URL`(ARK 等兼容端点)+ 真实错误透传。 [plan](plans/2026-07-13-openai-base-url.md)
- **文本分析超时加固** — 修复超时重试放大、加有界批并发与逐批重试、超时 env 可调。 [spec](specs/2026-07-14-text-analysis-timeout-design.md) · [plan](plans/2026-07-14-text-analysis-timeout.md)
- **文本阅读逐句分栏** - 文本结果改左右分栏:左侧逐句列表点击切换,右侧显示选中句的翻译/词汇/语法,复用 MokuroAnalysisPanel。 [plan](plans/2026-07-14-text-sentence-viewer.md)
