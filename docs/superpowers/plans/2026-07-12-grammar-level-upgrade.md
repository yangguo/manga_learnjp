# M5 Grammar Level Upgrade Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 使用 Tanos 同源公开 grammar list 文档生成可追踪的静态 JLPT 语法字典，将已有语法收藏升级为确定性等级、四分组展示和缓存/入口一致校准。

**Architecture:** Tanos 的 HTML list 端点仍为 HTTP 500，但同一公开 grammar index 链接的 N1–N5 `.doc` grammar lists 返回 200，且仅含模式与等级。生成脚本使用 MIT 许可的 `word-extractor` 在 Node 内结构化读取文档正文，丢弃标题、说明和页脚；运行时只读取已提交 JSON/manifest。语法使用独立 classification、dictionary、dataset meta 和 grammar bank reclassification，不扩展词汇 source union，也不改变 M4 SRS。

**Tech Stack:** TypeScript、`word-extractor@1.0.4`、Zustand persist、Next.js、Vitest、Tailwind、Playwright。

**Validated source gate (2026-07-12):** Tanos sharing page HTTP 200, SHA-256 `ec041fa5ed97b59dd4d7d9749d4f3828049422a8da0404700ac12f64f32a8a56`; N1–N5 HTML pages HTTP 500; N1–N5 linked `.doc` grammar lists HTTP 200 with author metadata Jonathan Waller and patterns only. This remains the same Tanos source and CC BY attribution; no explanatory, example, audio, PDF, or paid content is imported.

### Task 1: Generate reviewable static grammar data

**Files:**
- Modify: `package.json`, `package-lock.json`
- Create: `scripts/update-jlpt-grammar.ts`
- Create: `scripts/update-jlpt-grammar.test.ts`
- Create: `public/data/jlpt-grammar.v1.json`
- Create: `public/data/jlpt-grammar.v1.manifest.json`
- Modify: `public/licenses/tanos-sharing-CC-BY.txt`

1. Write failing generator tests for document-body line extraction, title/footer removal, pattern-only output, NFKC/wave normalization, aliases, cross-level conflict resolution, missing list rejection, SHA-256 manifest and atomic output inputs.
2. Run targeted test. Expected: FAIL, module missing.
3. Install exact dev dependency `word-extractor@1.0.4` and implement pure `buildJLPTGrammarArtifacts` plus `extractGrammarPatterns`.
4. Fetch five linked `.doc` documents as buffers, parse with `WordExtractor`, reject empty/changed content, fetch the sharing page, verify its required CC BY wording, and atomically publish JSON/manifest/license snapshot.
5. Run `npm run update:jlpt-grammar` with a fixed generated timestamp; inspect counts, conflicts, response hashes, aliases and only pattern-level data before committing artifacts.
6. Run generator tests. Expected: PASS.
7. Commit: `feat(grammar-data): generate Tanos grammar dictionary`.

### Task 2: Add grammar contracts, dictionary, and deterministic calibration

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/jlpt-levels.ts`
- Create: `src/lib/jlpt-grammar-dictionary.ts`
- Create: `src/lib/jlpt-grammar-dictionary.test.ts`
- Modify: `src/lib/jlpt-calibration.ts`, `src/lib/jlpt-calibration.test.ts`
- Modify: `src/lib/grammar-bank.ts`, `src/lib/grammar-bank-store.ts`
- Modify: `src/lib/grammar-bank.test.ts`, `src/lib/grammar-bank-store.test.ts`

1. Write failing tests for grammar exact/normalized/alias/none matching, NFKC and wave normalization, no substring matching, earliest-level conflicts, no input mutation, data-load failure, and reclassification that preserves explanatory fields.
2. Run targeted tests. Expected: FAIL, dictionary APIs missing.
3. Define independent `GrammarJLPTClassification`, `GrammarCalibrationMeta`, and optional `GrammarPattern.jlpt` / `SavedGrammar.jlpt` snapshots.
4. Validate data/manifest hash and schema in a client-safe singleton loader; return unclassified classifications with `persistable:false` on any error.
5. Calibrate analysis grammar alongside vocabulary without affecting translation or explanations; update saved grammar only when grammar data is ready.
6. Run targeted tests. Expected: PASS.
7. Commit: `feat(grammar): calibrate deterministic JLPT levels`.

### Task 3: Integrate all analysis, cache, and provider paths

**Files:**
- Modify: `src/lib/ai-service.ts`, `netlify/src/lib/ai-service.ts`
- Modify: `src/lib/types.ts`, `netlify/src/lib/types.ts`
- Modify: `src/lib/mokuro.ts`, `src/lib/mokuro.test.ts`
- Modify: `src/components/MokuroReader.tsx`
- Modify: `src/lib/jlpt-provider-parity.test.ts`
- Add/modify calibration and cache tests as needed

1. Write failing parity tests requiring the same standard-pattern-only grammar prompt in root and Netlify mirrors, and calibration tests for image, reading/Mokuro, legacy cache and failure fallback.
2. Run targeted tests. Expected: FAIL due missing grammar calibration/meta/cache v3.
3. Update prompts to request standard grammar constructions and ignore isolated particles, never AI JLPT levels; keep root and Netlify text byte-equivalent where applicable.
4. Calibrate grammar after vocabulary in all result pathways. Upgrade Mokuro cache to v3 with grammar dataset version, retaining v1/v2 readability and reclassifying old analyses locally.
5. Persist grammar classifications only when both static datasets are ready; preserve existing trustworthy snapshots during temporary grammar data failure.
6. Run targeted tests. Expected: PASS.
7. Commit: `feat(grammar): calibrate analysis and Mokuro cache`.

### Task 4: Restore grammar target-level UI and collection metadata

**Files:**
- Modify: `src/lib/jlpt-target.ts`, `src/lib/jlpt-target.test.ts`
- Modify: `src/components/MokuroAnalysisPanel.tsx`
- Modify: `src/components/WordBank.tsx`
- Modify: `src/components/Header.tsx`
- Modify: `src/components/JLPTBadge.tsx` only if generic typing requires it

1. Write failing grouping tests for target N4: N5 foundation, N4 focus, N3–N1 stretch, none unclassified; include grammar input and immutable arrays.
2. Run targeted test. Expected: FAIL, grammar group helper missing.
3. Render grammar in four groups, foundation collapsed and the other groups expanded. Each card shows its deterministic grammar badge/tooltip plus save state; all nonempty grammar remains visible.
4. Reclassify grammar bank after hydration, show grammar badge/version in its tab, and preserve word total/review semantics.
5. Run target and grammar-bank tests, lint and build. Expected: PASS.
6. Commit: `feat(grammar): group calibrated grammar by target`.

### Task 5: Sources, acceptance, and completion audit

**Files:**
- Modify: `src/app/sources/page.tsx`
- Modify: `docs/superpowers/specs/2026-07-12-grammar-level-and-bank-design.md`
- Modify: `docs/superpowers/2026-07-10-jlpt-prep-assessment.md`

1. Present Tanos author, CC BY version caveat, source URLs, five document hashes, generator version, data hash, generated time, counts/conflicts/aliases and non-official disclaimer.
2. Use @playwright to validate image/reading/Mokuro entry consistency, N4 grammar grouping, save/delete/refresh, data failure fallback, source details, and 375px layout.
3. Run `npm test`, `npm run lint -- --quiet`, `npm run build`, `git diff --check`.
4. Use @superpowers:requesting-code-review and fix all validated issues.
5. Commit: `docs(jlpt): record grammar level delivery`.
6. Use @superpowers:finishing-a-development-branch to merge and clean up.
