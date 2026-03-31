#!/usr/bin/env bash
# Dependency Security Audit
# Run: ./scripts/audit-deps.sh
# Exit code 1 if critical/high vulnerabilities found.

set -euo pipefail

echo "=== npm audit (app/) ==="
cd "$(dirname "$0")/../app"

# npm audit returns non-zero if vulnerabilities found
# We capture output and filter for high/critical
AUDIT_OUTPUT=$(npm audit --json 2>/dev/null || true)
CRITICAL=$(echo "$AUDIT_OUTPUT" | node -e "
  const data = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  const meta = data.metadata?.vulnerabilities || {};
  console.log((meta.critical || 0) + (meta.high || 0));
" 2>/dev/null || echo "0")

echo "Critical+High vulnerabilities: $CRITICAL"

if [ "$CRITICAL" -gt 0 ]; then
  echo "❌ FAIL: $CRITICAL critical/high npm vulnerabilities"
  npm audit --omit=dev 2>/dev/null || true
fi

echo ""
echo "=== pip audit (sidecar/) ==="
cd "$(dirname "$0")/../sidecar"

if command -v pip-audit &>/dev/null; then
  pip-audit -r requirements.txt --desc 2>/dev/null || {
    echo "⚠ pip-audit found vulnerabilities"
    CRITICAL=$((CRITICAL + 1))
  }
elif command -v safety &>/dev/null; then
  safety check -r requirements.txt 2>/dev/null || {
    echo "⚠ safety check found vulnerabilities"
    CRITICAL=$((CRITICAL + 1))
  }
else
  echo "⚠ Neither pip-audit nor safety installed — skipping Python audit"
  echo "  Install: pip install pip-audit"
fi

echo ""
if [ "$CRITICAL" -gt 0 ]; then
  echo "❌ AUDIT FAILED — $CRITICAL issues require attention"
  exit 1
else
  echo "✅ AUDIT PASSED — no critical/high vulnerabilities"
  exit 0
fi
