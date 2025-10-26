# Repository Guidelines

## Project Structure & Module Organization
- `src/app`: App Router entry points, global styles, and the `/api/analyze` server route that orchestrates AI providers.
- `src/components`: Client UI for uploads, panel viewers, and reading mode; keep presentation logic here.
- `src/lib` & `src/hooks`: Core services (AI adapters, segmentation utilities, Zustand store) and reusable hooks; co-locate shared types in `src/lib/types.ts`.
- `public` holds static assets, `netlify/functions` mirrors production handlers, and panel-segmentation helpers live at the repo root (`setup_panel_segmentation.*`).

## Build, Test, and Development Commands
- `npm install`: Install Node dependencies; rerun after SDK upgrades.
- `npm run dev`: Launch Next.js with HMR at `http://localhost:3000`.
- `npm run build`: Create the production bundle; run before shipping or updating Netlify artifacts.
- `npm run start`: Serve the production build to reproduce deployment issues.
- `npm run lint`: Execute `next lint`; resolve all warnings.
- `./setup_panel_segmentation.sh` (or `.bat`/`.ps1`): Install OpenCV deps for local segmentation checks.

## Coding Style & Naming Conventions
- TypeScript first, two-space indentation, single quotes, and no trailing semicolons match the current code.
- Prefer functional React components; mark client components with `'use client'`.
- Use PascalCase for components/files (`MangaAnalyzer.tsx`) and camelCase for functions/hooks; reserve constants for SCREAMING_SNAKE_CASE.
- Compose styling with Tailwind utilities, centralize tokens in `tailwind.config.js`, and import via the `@/` alias.

## Testing Guidelines
- Linting and type checks are the present guardrails; run `npm run lint` and ensure TypeScript builds when modifying `src/lib`.
- When introducing testable logic, add co-located `*.test.ts` files (Vitest or Jest), wire the command into `package.json`, and document manual image checks in the PR.

## Commit & Pull Request Guidelines
- Follow the Conventional Commit pattern (`type(scope): imperative summary`), e.g., `fix(netlify): guard provider detection when no env vars`.
- Group related changes per commit and keep config or asset updates isolated when possible.
- PRs should capture purpose, setup steps, screenshots for UI shifts, linked issues, and the commands you ran; surface TODOs upfront.
- Confirm lint/build status before requesting review.

## Security & Configuration Tips
- Keep API keys and `auth.json` credentials out of git; use `.env.local` and refresh `.env.example` when adding variables.
- Debug third-party providers via `.env.local` overrides instead of hard-coding endpoints in source files.
