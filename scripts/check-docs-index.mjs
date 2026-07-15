#!/usr/bin/env node
// Verify docs/superpowers/README.md indexes every spec/plan/assessment file.
// Run via `npm run check:docs` or in CI. Fails if any doc file is missing from
// the index, so a newly added spec/plan cannot silently go unregistered.
//
// Only the filename (basename, including .md) needs to appear in the README -
// the index uses markdown links like [spec](specs/2026-07-14-...-design.md),
// so the basename shows up verbatim. Basenames carry a date prefix and the
// .md suffix, making substring matches unambiguous.

import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { basename } from 'node:path'

const DOCS_DIR = fileURLToPath(new URL('../docs/superpowers/', import.meta.url))

const readme = readFileSync(DOCS_DIR + 'README.md', 'utf8')

// Files directly under docs/superpowers/ (e.g. the roadmap assessment).
// README.md itself is excluded - it is the index, not an indexed doc.
const top = readdirSync(DOCS_DIR)
  .filter((f) => f.endsWith('.md') && f !== 'README.md')
  .map((f) => f)

const specs = readdirSync(DOCS_DIR + 'specs/')
  .filter((f) => f.endsWith('.md'))
  .map((f) => 'specs/' + f)

const plans = readdirSync(DOCS_DIR + 'plans/')
  .filter((f) => f.endsWith('.md'))
  .map((f) => 'plans/' + f)

const files = [...top, ...specs, ...plans]

const missing = files.filter((f) => !readme.includes(basename(f)))

if (missing.length > 0) {
  console.error('docs-index: files not listed in docs/superpowers/README.md:')
  for (const f of missing) console.error('  - ' + f)
  console.error('\nAdd an entry for each new spec/plan in the index, then re-run.')
  process.exit(1)
}

console.log(`docs-index: OK (${files.length} spec/plan/assessment files indexed)`)
