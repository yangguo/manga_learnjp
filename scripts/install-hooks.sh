#!/usr/bin/env bash
# Run once after cloning to wire up git hooks.
# Usage: bash scripts/install-hooks.sh

set -e

REPO_ROOT="$(git rev-parse --show-toplevel)"
HOOKS_DIR="$REPO_ROOT/.git/hooks"
SCRIPT_DIR="$REPO_ROOT/scripts"

echo "Installing git hooks..."

cp "$SCRIPT_DIR/pre-commit-hook.sh" "$HOOKS_DIR/pre-commit"
chmod +x "$HOOKS_DIR/pre-commit"

echo "✅ pre-commit hook installed (gitleaks secret scanner)."
echo ""
echo "Requires: gitleaks — install with: brew install gitleaks"
