# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` - Next.js dev server with HMR at http://localhost:3000.
- `npm run build` - Production build using `next build --webpack`; run before shipping.
- `npm run start` - Serve the production build.
- `npm run lint` - ESLint 9 flat config in `eslint.config.mjs`.
- `npm test` - Vitest unit tests, currently focused under `src/lib`.
- `scripts/process-mokuro-colab.sh INPUT.pdf [OUTPUT.zip]` - Convert a PDF to Mokuro output remotely through Google Colab. Requires `google-colab-cli`.

## Architecture

### Current product shape

The app has two user-facing modes:

1. **Image Analyzer** - upload one manga image and let the app choose the analysis strategy automatically.
2. **Mokuro Reader** - load an existing Mokuro output directory and analyze OCR text blocks on demand or in batch.

Mode configuration lives in `src/lib/analysis-modes.ts`. The public `AnalysisMode` union in `src/lib/types.ts` is currently:

```ts
type AnalysisMode = 'image' | 'mokuro'
```

Do not reintroduce separate `panel`, `simple`, or `reading` UI choices. Image Analyzer is a single-page workflow, not a panel-by-panel workflow.

### Image analysis pipeline

`src/components/ImageUploader.tsx` owns upload and orchestration. In `Image Analyzer`, it tries the following sequence:

1. Reading-location detection through `analyzeImageForReading`, which returns clickable sentence boxes for `ReadingModeViewer`.
2. General full-page image analysis through `/api/analyze` with no special image mode flags.

Both branches pass `analysisLanguage` and request simplified N4+ learner content where applicable. Chinese is the default language for Image Analyzer.

`src/app/page.tsx` renders the result by returned data shape:

- `ReadingModeResult` -> `ReadingModeViewer`, a Mokuro-style layout with image on the left and concise analysis on the right.
- `AnalysisResult` -> `ImagePageAnalysisViewer`, a full-page image plus concise analysis panel.

### Mokuro Reader

`src/components/MokuroReader.tsx` is the directory-based reader for Mokuro output. It expects a selected folder containing a `.mokuro` file and page images.

Important behavior:

- The reader overlays clickable OCR boxes, not visible OCR text, on top of the page image.
- Clicking a block analyzes it and displays details in `MokuroAnalysisPanel`.
- Batch analysis processes every text block on the current page.
- Cached results are keyed by provider, language, page, and block index.
- Cache is written to `mokuro-analysis-cache.json` when File System Access write support is available.
- localStorage is the fallback cache when directory write access is unavailable.
- Analysis language supports Chinese and English; Chinese is the default.
- `analyzeText` defaults to `excludeN5: true`, so basic N5 vocabulary and grammar are not shown.

Core Mokuro helpers live in `src/lib/mokuro.ts`; cache and import behavior have Vitest coverage in `src/lib/mokuro.test.ts`.

### AI provider abstraction

`src/lib/ai-service.ts` is the main entry point for text and image analysis. The current main-app provider contract is:

```ts
type AIProvider = 'openai' | 'openai-format'
```

Supported configuration:

- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `OPENAI_FORMAT_API_URL`
- `OPENAI_FORMAT_API_KEY`
- `OPENAI_FORMAT_MODEL`

`src/app/api/analyze/route.ts` builds provider settings from environment variables and falls back across available providers. `src/app/api/providers/route.ts` exposes available providers and a smart default.

The OpenAI-format path is used for Ollama, LM Studio, vLLM, hosted compatible APIs, and similar `/v1` endpoints.

### PDF to Mokuro conversion

`scripts/process-mokuro-colab.sh` automates remote conversion:

1. Creates or reuses a Colab session.
2. Uploads the source PDF.
3. Installs `poppler-utils` and `mokuro` remotely.
4. Renders pages with `pdftoppm`.
5. Runs `mokuro`.
6. Downloads a zip containing `<volume>.mokuro`, page images, and `_ocr` JSON.

Useful env overrides:

- `COLAB_GPU`
- `COLAB_DPI`
- `COLAB_SESSION_NAME`
- `COLAB_KEEP_SESSION`

### Deployment targets

This repo includes both a Next.js App Router backend and a Netlify functions backend:

1. **Next.js App Router** - `src/app/api/*/route.ts`, used by local dev and direct Next.js deployment.
2. **Netlify Functions** - `netlify/functions/*.ts`, using mirrored runtime files in `netlify/src/lib/`.

The Netlify mirror can drift because `tsconfig.json` excludes `netlify/` from the root TypeScript project. When editing files in `src/lib` that also exist under `netlify/src/lib`, check whether the Netlify mirror needs the same update.

## Shared Types

`src/lib/types.ts` is the contract between the UI, API routes, and AI service. Update it before changing response shapes such as:

- `AnalysisResult`
- `MangaAnalysisResult`
- `ReadingModeResult`
- `MokuroFile`
- `MokuroAnalysisCacheFile`
- `AnalysisMode`
- `AIProvider`

Tests that lock shared behavior should live beside the library module, for example `src/lib/analysis-modes.test.ts`, `src/lib/mokuro.test.ts`, and `src/lib/client-api.test.ts`.

## Project Conventions

- TypeScript, two-space indentation, single quotes, no trailing semicolons.
- Functional React components; use `'use client'` for client components.
- PascalCase for components/files such as `MangaAnalyzer.tsx`.
- camelCase for functions/hooks.
- SCREAMING_SNAKE_CASE for constants.
- Import via the `@/` alias for app code.
- Keep secrets in `.env.local` or deployment environment variables.
- Refresh `.env.example` when adding env vars.
- Non-trivial changes follow the spec-driven flow: write a design doc under `docs/superpowers/specs/`, then a plan under `docs/superpowers/plans/`, before implementing. Register every new spec/plan in `docs/superpowers/README.md` - CI (`npm run check:docs`) fails if a doc file is missing from the index.
- Run `npm test`, `npm run lint`, and `npm run build` before handing off.
