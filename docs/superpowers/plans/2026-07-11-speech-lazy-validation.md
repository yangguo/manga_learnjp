# Web Speech Lazy Validation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 移除全量手动音色验证，让首次朗读和单个音色选择按需验证并自动回退。

**Architecture:** `src/lib/speech.ts` 提供可测试的候选/优先顺序纯函数；`useSpeech` 保留 utterance 事件处理，但把全量 `verifyVoices` 改为 `validateVoice(uri)` 和正式朗读中的候选循环；`MokuroReader` 删除刷新按钮并在 select onChange 中单项验证。

**Tech Stack:** React 19、TypeScript、Web Speech API、Vitest、Playwright。

## Task 1: 候选与优先顺序纯函数

**Files:**
- Modify: `src/lib/speech.ts`
- Modify: `src/lib/speech.test.ts`

1. 写失败测试：`getCandidateVoices` 保留日语、排除 unavailable、无需 verified；`orderSpeechCandidates` 依次优先指定 URI、已验证 URI、其余候选且不重复。
2. Run: `npm test -- src/lib/speech.test.ts`，确认因导出缺失失败。
3. 实现两个纯函数，保留 `isSpeechFailure`。
4. Run 同一测试，确认 PASS。
5. Commit: `test(speech): define lazy voice candidate order`。

## Task 2: Hook 改为懒验证

**Files:**
- Modify: `src/components/useSpeech.ts`

1. 返回契约改为 `candidateVoices`、`validatingVoiceURI`、`validateVoice(uri)`、`speak`、`cancel`；移除 `verifiedVoices`、`isVerifying`、`verifyVoices`。
2. `validateVoice` 只静音验证目标 URI，成功加入 verified，失败加入 unavailable。
3. `speak` 用 `orderSpeechCandidates` 逐项真实朗读；`onstart` 成功即加入 verified，失败项移除后继续下一个。
4. 保留 5 秒单项启动超时以及 canceled/interrupted 例外；删除全量 for-loop。
5. Run: `npm test -- src/lib/speech.test.ts && npm run lint -- --quiet`。
6. Commit: `fix(speech): validate voices lazily`。

## Task 3: Reader 删除手动刷新

**Files:**
- Modify: `src/components/MokuroReader.tsx`

1. 删除 `RefreshCw` 和 `verifyVoices` 文案。
2. select 直接渲染 `candidateVoices`；仅在单项验证中禁用。
3. onChange 选择“自动”时立即清空 URI；选择具体 URI 时调用 `validateVoice`，成功后提交，失败时保持/回退并提示。
4. current URI 不再是候选时回退到 null。
5. Run: `npm test -- src/lib/speech.test.ts && npm run lint -- --quiet && npm run build`。
6. Commit: `fix(mokuro): use lazy voice validation`。

## Task 4: 完整验证与浏览器回归

1. Run: `npm test`、`npm run lint`、`npm run build`、`git diff --check`。
2. 按 @playwright 验证无刷新按钮、select 加载候选、首次朗读无需预操作，记录浏览器实际语音能力限制。
3. 按 @superpowers:requesting-code-review 审查完整 diff。
4. 按 @superpowers:finishing-a-development-branch 选择集成方式。
