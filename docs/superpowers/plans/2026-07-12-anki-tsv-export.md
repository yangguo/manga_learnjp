# M3 Anki TSV Export Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为生词本增加全部词汇一键导出的 Anki 兼容 UTF-8 TSV 文件。

**Architecture:** 纯函数模块负责字段清理、标签、文件名和 TSV 序列化；小型可注入下载函数负责浏览器 Blob/URL/链接生命周期；`WordBank` 只在点击事件中调用这些函数并显示 toast。

**Tech Stack:** TypeScript、React 19、Next.js App Router、Vitest、react-hot-toast、lucide-react。

**Validated design:** `docs/superpowers/specs/2026-07-12-anki-tsv-export-design.md`

### Task 1: Anki TSV serialization

**Files:**
- Create: `src/lib/anki-export.test.ts`
- Create: `src/lib/anki-export.ts`

1. 写失败测试，覆盖固定四行 header、八列顺序、N4/未定级标签、Unicode、tab/CR/LF 清理、空字段、输入不变和稳定输出。
2. Run: `npm test -- src/lib/anki-export.test.ts`。Expected: FAIL，模块不存在。
3. 实现 `sanitizeAnkiField`、`getAnkiTags` 和 `serializeWordsForAnki`，不使用第三方 CSV 库。
4. Run: `npm test -- src/lib/anki-export.test.ts`。Expected: PASS。
5. Commit: `feat(anki): serialize word bank as TSV`。

### Task 2: Filename and browser download

**Files:**
- Modify: `src/lib/anki-export.test.ts`
- Modify: `src/lib/anki-export.ts`

1. 写失败测试验证本地日期文件名，以及下载环境收到 `text/tab-separated-values;charset=utf-8` Blob、正确文件名、一次点击、链接移除和 URL 释放。
2. Run: `npm test -- src/lib/anki-export.test.ts`。Expected: FAIL，导出函数不存在。
3. 实现 `createAnkiExportFilename(date)` 和可注入最小 `downloadTextFile` 环境；默认环境使用 `document`、`URL` 和 `Blob`。
4. Run: `npm test -- src/lib/anki-export.test.ts`。Expected: PASS。
5. Commit: `feat(anki): add TSV download helper`。

### Task 3: Word bank export UI

**Files:**
- Modify: `src/components/WordBank.tsx`

1. 按 @react-best-practices 在事件处理器中读取已有 `words`，不新增派生 state。
2. 增加中英文导出、成功和失败文案；引入 `Download` 图标、toast 和 Anki 导出函数。
3. 在可换行标题栏中增加固定高度“导出 Anki”按钮；hydration 未完成或无词时禁用。
4. 点击时生成 TSV、下载并显示数量；异常时显示失败 toast，生词数据不变。
5. Run: `npm test -- src/lib/anki-export.test.ts && npm run lint -- --quiet && npm run build`。Expected: PASS。
6. Commit: `feat(word-bank): export Anki TSV`。

### Task 4: Roadmap and acceptance

**Files:**
- Modify: `docs/superpowers/2026-07-10-jlpt-prep-assessment.md`
- Modify: `docs/superpowers/specs/2026-07-12-anki-tsv-export-design.md`

1. 浏览器验证 `/words` 空状态按钮禁用；注入测试词后下载按钮可用、toast 正确、下载文件包含八列且无布局溢出。
2. 更新路线图为 M3 已完成、M4 下一步，并将设计状态改为已实现。
3. Run: `npm test`、`npm run lint`、`npm run build`、`git diff --check`。Expected: 全部通过。
4. 使用 @superpowers:requesting-code-review 审查完整 diff并修复问题。
5. Commit: `docs(jlpt): record Anki export delivery`。
6. 使用 @superpowers:finishing-a-development-branch 完成集成选择。
