#!/usr/bin/env bash
# Pre-commit hook: scan staged content for secrets with gitleaks
# Installed via scripts/install-hooks.sh

set -e

if ! command -v gitleaks &>/dev/null; then
  echo "⚠️  gitleaks not found — skipping secret scan."
  echo "   Install: brew install gitleaks"
  exit 0
fi

echo "🔍 Scanning staged files for secrets..."
gitleaks git --pre-commit --staged --config .gitleaks.toml --redact 2>&1
STATUS=$?

if [ $STATUS -ne 0 ]; then
  echo ""
  echo "❌ gitleaks detected a potential secret in your staged changes."
  echo "   Remove or move the secret to an env var, then re-stage."
  echo "   To bypass (emergencies only): git commit --no-verify"
  exit 1
fi

echo "✅ No secrets detected."
exit 0
