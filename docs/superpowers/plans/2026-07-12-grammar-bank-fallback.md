# M5 Grammar Bank Fallback Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在 Tanos N1–N5 页面暂时无法结构化提取时，交付独立、可持久化的语法收藏功能，同时明确不显示或写入未经准入的 JLPT 语法等级。

**Architecture:** 语法收藏使用独立 `grammar-bank-storage` 和规范化 pattern key，不触碰 M4 的词汇/SRS 事务存储。Mokuro 分析面板展示全部 AI 返回的教学语法点并允许收藏；WordBank 和 drawer 通过 tabs 展示词汇或语法。Tanos 许可快照与当前五级端点失败证据写入来源页和设计文档，但不把数据文件、等级或 AI 估级带入运行时。

**Tech Stack:** TypeScript、Zustand persist、React 19、Next.js App Router、Vitest、Tailwind、Playwright。

**Source-gate result (2026-07-12):** `https://www.tanos.co.uk/jlpt/sharing/` 返回 200，许可文本允许非售卖内容以 CC BY 使用并要求署名；N1–N5 的 `/jlpt/jlpt{1..5}/grammar/` 全部返回 HTTP 500（curl、浏览器和网页提取器均复现）。因此不满足 M5 设计的四项数据准入门槛，按已批准设计降级为语法收藏，不创建 `jlpt-grammar-v1` 数据、字典、等级 badge 或 provider prompt 改动。

### Task 1: Record the source-gate decision

**Files:**
- Modify: `docs/superpowers/specs/2026-07-12-grammar-level-and-bank-design.md`
- Modify: `docs/superpowers/2026-07-10-jlpt-prep-assessment.md`

1. 记录许可页的可审查文本、抓取日期、SHA-256，以及五个 grammar list URL 返回 HTTP 500 的事实。
2. 将 M5 状态改为“降级实施中：语法收藏；等级数据受上游准入阻塞”。
3. 明确运行时不得使用 AI `difficulty`、substring 或替代来源补齐语法等级。
4. Commit: `docs(jlpt): record grammar source gate fallback`。

### Task 2: Build the independent grammar-bank domain

**Files:**
- Modify: `src/lib/types.ts`
- Create: `src/lib/grammar-bank.ts`
- Create: `src/lib/grammar-bank.test.ts`
- Create: `src/lib/grammar-bank-store.ts`
- Create: `src/lib/grammar-bank-store.test.ts`

1. 写失败测试：NFKC/波浪/空白规范化 key，重复 pattern 去重，第一次收藏保留 explanation/example/language/sourceSentence/savedAt，删除/toggle/clear 不影响输入。
2. Run: `npm test -- src/lib/grammar-bank.test.ts src/lib/grammar-bank-store.test.ts`。Expected: FAIL，模块不存在。
3. 增加 `SavedGrammar`，实现 `normalizeGrammarPattern`、`savedGrammarKey`、纯 add/remove/toggle/isSaved。
4. 使用独立 `grammar-bank-storage` v1 持久化 store；写入失败抛错，组件据此不显示错误的收藏状态。不得引用 word-bank 或 SRS store。
5. Run targeted tests。Expected: PASS。
6. Commit: `feat(grammar-bank): persist saved grammar`。

### Task 3: Show every teaching grammar item in Mokuro and support saving

**Files:**
- Modify: `src/lib/analysis-filters.ts`
- Modify: `src/lib/analysis-filters.test.ts`
- Modify: `src/components/MokuroAnalysisPanel.tsx`

1. 写失败测试，证明 `filterLearningGrammar` 不再丢弃 N5/basic grammar；只有无效空 pattern 可以排除。
2. Run targeted filter test。Expected: FAIL。
3. 移除基于 AI 文案的 N5/basic 过滤；保留分析结果的原始 pattern、explanation 和 example。
4. 提取语法卡：显示 pattern、解释、例句，并用可访问的 Star 图标保存/删除。保存时记录当前 source sentence 与 UI language；异步写失败显示 toast，星标不乐观切换。
5. 不显示 JLPT 语法 badge、四分组或等级提示，避免暗示不存在的数据来源。
6. Run: `npm test -- src/lib/analysis-filters.test.ts src/lib/grammar-bank*.test.ts`。Expected: PASS。
7. Commit: `feat(grammar-bank): save grammar from Mokuro analysis`。

### Task 4: Add vocabulary/grammar tabs to the bank and drawer

**Files:**
- Modify: `src/components/WordBank.tsx`
- Modify: `src/components/WordBankDrawer.tsx`
- Modify: `src/components/Header.tsx`

1. 在 `WordBank` 内实现 tabs。词汇 tab 保持导出、复习和清空的现有行为；语法 tab 展示 pattern、解释、例句、原句、语言、保存时间，支持逐项删除和清空语法。
2. 当语法 tab 为空时提供与词汇相称的空状态；不显示 Anki 或 SRS 操作。
3. Header 徽标使用 `words.length + grammar.length`，复习徽标继续仅使用词汇卡。
4. Drawer 标题改为中性“收藏”，tabs 在页面与 drawer 共享同一组件状态和 store。
5. Run lint and focused tests。Expected: PASS。
6. Commit: `feat(grammar-bank): add grammar collection views`。

### Task 5: Make the fallback transparent on the sources page

**Files:**
- Modify: `src/app/sources/page.tsx`
- Create: `public/licenses/tanos-sharing-CC-BY.txt`

1. 添加 Tanos attribution：Jonathan Waller、sharing URL、CC BY（发布者未注明版本）、非官方语法参考免责声明。
2. 展示许可页内容 SHA-256、抓取日期和明确的“等级列表端点当前不可用；本版不显示语法等级”状态。
3. 仅提交许可页面文本快照；不提交任何列表、解释、例句、PDF 或商业内容。
4. Run build。Expected: PASS。
5. Commit: `docs(sources): disclose grammar data fallback`。

### Task 6: Acceptance and branch completion

**Files:**
- Modify: `docs/superpowers/specs/2026-07-12-grammar-level-and-bank-design.md`
- Modify: `docs/superpowers/2026-07-10-jlpt-prep-assessment.md`

1. 使用 @playwright：Mokuro 面板的 basic grammar 可见且可收藏；WordBank 和 drawer tabs 同步；刷新后保留；删除与清空语法不影响词汇/SRS；375px 无横向溢出。
2. 验证 `/sources` 的 Tanos attribution、哈希、降级说明；确认 UI 没有语法等级 badge 或“AI 估级”路径。
3. Run `npm test`、`npm run lint -- --quiet`、`npm run build`、`git diff --check`。
4. 使用 @superpowers:requesting-code-review 审查完整 diff，修复实际问题。
5. 更新 M5 状态为“降级完成：语法收藏；语法等级待上游准入恢复”。
6. Commit: `docs(jlpt): record grammar bank fallback delivery`。
7. 使用 @superpowers:finishing-a-development-branch 合并并清理。

## Upgrade path when Tanos recovers

恢复完整 M5 前必须重新执行数据准入：用结构化 HTML parser 抓取五级列表、提交许可快照及每页 SHA-256、生成静态 manifest 和冲突统计，再实现独立 grammar dictionary、三入口校准、缓存版本升级、provider/Netlify prompt parity 和四级语法分组。不得把此降级交付中的收藏记录重写或删除。
