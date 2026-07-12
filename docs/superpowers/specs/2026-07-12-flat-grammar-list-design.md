# Flat Grammar List Design

日期: 2026-07-12
状态: 已完成

## 目标

精简 Mokuro 分析面板的语法区域，移除占用空间的 JLPT 目标等级选择器和等级分组，使语法与词汇一样按选中文本中的出现顺序直接列出。

## 范围

- 从 `MokuroAnalysisPanel` 移除 `JLPTTargetSelector`。
- 不再调用 `groupGrammarByTarget`，也不显示重点、超纲、未定级和基础四个语法分组。
- 按 `analysisResult.sentences` 顺序遍历，并保持每句 `grammar` 数组的原顺序。
- 继续使用 `filterLearningGrammar` 过滤空构式，保持当前实际行为不变。
- 每张语法卡继续显示构式、解释、例句、JLPT 徽标和收藏按钮。
- 不修改全局默认 N4 设置、缓存结构、分析接口或独立生词本页面。

## 实现

在 `src/lib/analysis-order.ts` 增加纯函数，将句子中的语法按原顺序展平后应用现有空构式过滤。`MokuroAnalysisPanel` 直接渲染返回的平铺数组，并删除仅供等级分组使用的组件、文案和依赖。

## 验证

- 单元测试证明跨句和句内语法顺序保持不变。
- 单元测试证明现有空构式过滤仍生效。
- 运行 `npm test`、`npm run lint -- --quiet`、`npm run build` 和 `git diff --check`。
- 浏览器检查语法区域无目标等级选择器、无等级标题，并且卡片按原文顺序显示。

## 交付记录

2026-07-12 完成实现与验收：

- `getLearningGrammarInTextOrder` 按跨句和句内原顺序展平语法，并继续过滤空构式。
- 语法区已移除目标等级选择器、四个等级分组标题和对应的折叠区；保留语法卡的解释、例句、JLPT 徽标和收藏功能。
- 全量 Vitest 为 31 个测试文件、222 项测试通过；`npm run lint -- --quiet`、`npm run build` 与 `git diff --check` 通过。
- 生产首页浏览器检查未出现 React 或业务运行时错误；控制台仅有既有的 `/favicon.ico` 404。仓库没有可直接加载的 Mokuro 示例数据，因此实际分析面板通过源码无残留引用检查和顺序单测验收。
