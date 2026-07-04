# Repository Guidelines

## Project Structure & Module Organization
- `src/app`: App Router entry points, global styles, and `/api/analyze` plus `/api/providers` server routes.
- `src/components`: Client UI for the two top-level modes: `Image Analyzer` and `Mokuro Reader`. Keep upload, viewer, and panel presentation logic here.
- `src/lib`: Core services and contracts: AI adapters, shared types, Mokuro parsing/cache helpers, analysis filters, image utilities, and mode configuration.
- `src/hooks`: Reusable client hooks; some legacy image segmentation utilities may remain here even when not used by the current UI.
- `scripts`: Operational helpers, including `process-mokuro-colab.sh` for remote PDF to Mokuro conversion.
- `public` holds static assets, and `netlify/functions` plus `netlify/src/lib` mirror production handlers/runtime code.

## Build, Test, and Development Commands
- `npm install`: Install Node dependencies; rerun after SDK upgrades.
- `npm run dev`: Launch Next.js with HMR at `http://localhost:3000`.
- `npm run build`: Create the production bundle; run before shipping or updating Netlify artifacts.
- `npm run start`: Serve the production build to reproduce deployment issues.
- `npm run lint`: Execute ESLint through the flat config; resolve errors and avoid adding new warnings.
- `npm test`: Run Vitest unit tests in `src/lib`.
- `scripts/process-mokuro-colab.sh INPUT.pdf [OUTPUT.zip]`: Run Mokuro in Google Colab through `google-colab-cli`.

## Coding Style & Naming Conventions
- TypeScript first, two-space indentation, single quotes, and no trailing semicolons match the current code.
- Prefer functional React components; mark client components with `'use client'`.
- Use PascalCase for components/files (`MangaAnalyzer.tsx`) and camelCase for functions/hooks; reserve constants for SCREAMING_SNAKE_CASE.
- Compose styling with Tailwind utilities, centralize tokens in `tailwind.config.js`, and import via the `@/` alias.

## Testing Guidelines
- Linting, Vitest, and the production build are the present guardrails; run `npm test`, `npm run lint`, and `npm run build` before shipping changes.
- When introducing testable logic, add co-located `*.test.ts` files using Vitest and keep data-shape tests in `src/lib`.
- For image or Mokuro UI changes, document manual browser checks, including mode switching and directory import behavior.

## Product Behavior Notes
- The app has two user-facing modes only: `Image Analyzer` and `Mokuro Reader`. Do not reintroduce separate `panel`, `simple`, or `reading` choices in the UI.
- `Image Analyzer` should remain a single-page workflow: try reading-location detection first, then fall back to full-page OCR/analysis. Do not add panel-by-panel UI back.
- `Mokuro Reader` loads an output directory containing a `.mokuro` file and page images; analysis cache should use `mokuro-analysis-cache.json` when directory write access is available and localStorage as fallback.
- Mokuro explanations support Chinese and English; Chinese is the default.
- Basic JLPT N5 vocabulary and grammar should be filtered from learner-facing analysis unless a caller explicitly opts out.

## Commit & Pull Request Guidelines
- Follow the Conventional Commit pattern (`type(scope): imperative summary`), e.g., `fix(netlify): guard provider detection when no env vars`.
- Group related changes per commit and keep config or asset updates isolated when possible.
- PRs should capture purpose, setup steps, screenshots for UI shifts, linked issues, and the commands you ran; surface TODOs upfront.
- Confirm lint/build status before requesting review.

## Security & Configuration Tips
- Keep API keys and `auth.json` credentials out of git; use `.env.local` and refresh `.env.example` when adding variables.
- Supported providers in the main app are `openai` and `openai-format`; debug compatible endpoints via `.env.local` overrides instead of hard-coding endpoints in source files.
- When changing shared runtime code under `src/lib`, check whether the Netlify mirror in `netlify/src/lib` needs the same update.
