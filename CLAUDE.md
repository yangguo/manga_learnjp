# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Next.js dev server with HMR at http://localhost:3000.
- `npm run build` — Production build (uses `next build --webpack`). Run before shipping.
- `npm run start` — Serve the production build.
- `npm run lint` — `next lint` (ESLint 9 flat config in `eslint.config.mjs`).
There is **no test runner wired up**. `npm test` does not exist. Lint + a successful TypeScript build are the current guardrails.

## Architecture

### Two deployment targets, one product

This repo ships the same UI through **two parallel backends**, and that duality is the single most important thing to understand before editing:

1. **Next.js App Router** (`src/app/`) — local dev (`npm run dev`) and any direct Next.js deploy. Server logic lives in `src/app/api/*/route.ts`.
2. **Netlify Functions** (`netlify/functions/*.ts`) — production on Netlify. `netlify/netlify.toml` rewrites every `/api/*` path to `/.netlify/functions/*`.

The Netlify functions import from `netlify/src/lib/`, which is a **partial mirror** of `src/lib/`. Files actively used by functions: `ai-service.ts`, `types.ts`, `client-panel-segmentation.ts`, `image-compression.ts`, `image-utils.ts`, `improved-text-detection.ts`. Only `netlify/functions/` and `netlify/src/lib/` are live; the rest of `netlify/src/` has been removed.

**Practical rule:** any change to an `src/lib/` file that's mirrored in `netlify/src/lib/` must be made in **both** places, or the Netlify build will drift from local. `tsconfig.json` excludes `netlify/` from the root TS project, so type errors in the mirror won't surface during `npm run build`.

### AI provider abstraction

`src/lib/ai-service.ts` (and its netlify mirror) is the single entry point for all vision/text analysis. It dispatches across three providers via the `AIProvider` type (`'openai' | 'gemini' | 'openai-format'`):

- **openai** — GPT-4 Vision / GPT-4o family, via the `openai` SDK.
- **gemini** — Google `@google/generative-ai`.
- **openai-format** — Any OpenAI-compatible endpoint (Ollama, LM Studio, vLLM, custom). Endpoint, model, and optional API key are user-configurable from the UI.

Provider selection and settings persist client-side via the Zustand store in `src/lib/store.ts` (`useAIProviderStore`, `persist` middleware → localStorage). The store hydrates `openaiFormatSettings` from `process.env.OPENAI_FORMAT_API_URL` / `_MODEL` / `_API_KEY` on first load — env vars are defaults, not overrides.

### Image → text → analysis pipeline

1. **Upload** (`src/components/ImageUploader.tsx`) — drag/drop, multi-format (PNG/JPG/WebP/BMP).
2. **Panel segmentation** — classical CV (Canny + Probabilistic Hough), not ML. Runs client-side via `client-panel-segmentation.ts` using OpenCV.js (`opencv-ts`) in the browser.
3. **Reading-order sort** — applied to bounding boxes to produce right-to-left, top-to-bottom manga order.
4. **Per-panel vision OCR + analysis** — each panel sent to the selected AI provider with the `ANALYSIS_PROMPT` template in `ai-service.ts`. Response is forced into a JSON schema (see `AnalysisResult` / `SentenceLocation` / `ReadingModeResult` in `src/lib/types.ts`).
5. **Render** — `MangaAnalyzer.tsx`, `ReadingModeViewer.tsx`, `PanelImageViewer.tsx`, etc.

### Shared types

`src/lib/types.ts` is the contract between the UI, the AI service, and the API route handlers. When changing response shapes (vocabulary, grammar patterns, panel metadata, reading mode), update this file first — both `src/lib/ai-service.ts` and `netlify/src/lib/ai-service.ts` parse against these types.

## Project conventions

These come from `AGENTS.md` and the existing code — follow them when editing:

- TypeScript, two-space indent, single quotes, no trailing semicolons.
- Functional React components; `'use client'` on client components.
- PascalCase for components/files (`MangaAnalyzer.tsx`), camelCase for functions/hooks, SCREAMING_SNAKE_CASE for constants.
- Import via the `@/` alias (`@/lib/...`, `@/components/...`).
- Conventional Commits (`type(scope): summary`), e.g. `fix(netlify): guard provider detection when no env vars`.
- `.env.local` for secrets; refresh `.env.example` when adding env vars. Don't hard-code provider endpoints — drive them through env or the settings store.
