# Dependabot Security-Only Updates Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Prevent routine dependency upgrades from being mislabeled and combined as security updates while preserving grouped Dependabot security fixes.

**Architecture:** Keep the existing npm update jobs for the root app and Netlify runtime, but disable scheduled version-update pull requests with `open-pull-requests-limit: 0`. Apply each `security` group explicitly to `security-updates` and match all vulnerable dependencies. Major upgrades remain manual migrations with their own verification.

**Tech Stack:** GitHub Dependabot v2 configuration, npm, GitHub Actions.

### Task 1: Correct both npm update jobs

**Files:**

- Modify: `.github/dependabot.yml`

1. Run a read-only Node assertion that requires both npm jobs to disable version PRs and declare an all-dependency security group; confirm it fails.
2. Set `open-pull-requests-limit: 0` for `/` and `/netlify`.
3. Set `applies-to: security-updates` and `patterns: ['*']` on both `security` groups.
4. Remove misleading `update-types` and `allow` rules.
5. Rerun the assertion and confirm it passes.

### Task 2: Verify and publish

**Files:**

- Modify: `docs/superpowers/README.md`
- Create: `docs/superpowers/plans/2026-07-21-dependabot-security-only.md`

1. Run `npm run check:docs`, `npm test`, `npm run lint`, and `npm run build`.
2. Run `git diff --check` and inspect the complete diff.
3. Commit and push `codex/fix-dependabot-security-updates`.
4. Open a ready pull request and close obsolete dependency PR #23 with the verified root cause.
