#!/usr/bin/env bash
# Run this ONCE, from the root of Psygil_v2/, on your Mac, after you have tested
# the app and are satisfied it works.
#
# This initializes git + LFS + creates the first two commits, but does NOT push.
# Pushing is a separate manual step so you can review first.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE"

# Safety: refuse to run if already a git repo.
if [ -d .git ]; then
  echo "ERROR: .git/ already exists. This script is for first-time init only." >&2
  exit 1
fi

# Safety: refuse to run if git-lfs missing.
if ! command -v git-lfs >/dev/null 2>&1; then
  echo "ERROR: git-lfs is not installed. Install with: brew install git-lfs" >&2
  exit 1
fi

# Safety: no file over 50 MB that would actually be committed.
# Prunes the common gitignored trees (node_modules, build output, venvs) so
# this check matches what git itself will see, not what's on disk.
OVERSIZED="$(find . \
  \( -path './.git' \
     -o -path '*/node_modules' \
     -o -path '*/.pnpm-store' \
     -o -path '*/dist' \
     -o -path '*/dist-electron' \
     -o -path '*/out' \
     -o -path '*/build' \
     -o -path '*/venv' \
     -o -path '*/.venv' \
     -o -path '*/__pycache__' \
     -o -path '*/.pytest_cache' \
     -o -path '*/coverage' \
     -o -path '*/sidecar/build' \
     -o -path '*/sidecar/dist' \
     -o -path '*/sidecar/dist-macos' \
  \) -prune -o -type f -size +50M -print 2>/dev/null || true)"
if [ -n "$OVERSIZED" ]; then
  echo "ERROR: files over 50 MB found (outside known ignored trees)." >&2
  echo "Review or LFS-track before init:" >&2
  echo "$OVERSIZED" >&2
  exit 1
fi

echo "[1/6] git init on branch main..."
git init -b main

echo "[2/6] git lfs install (local hooks)..."
git lfs install --local

echo "[3/6] First commit: LFS attributes + gitignore ONLY."
git add .gitattributes .gitignore
git commit -m "chore: initialize repo with LFS tracking and .gitignore"

echo "[4/6] Second commit: full recovered tree."
git add .
git commit -m "feat: recovery tree (Apr 10 GitHub HEAD ceb7e64 + Apr 13 Cole Day 1)

Source: ~/Desktop/Foundry SMB/Products/Psygil_RECOVERY_20260413/
Assembled: 2026-04-13. See RECOVERY_NOTES.md for provenance.

Fixes applied during recovery verification:
- app/src/main/db/migrate.ts: removed orphan \`);\\nEND;\` SQL
  fragment between tr_cases_update_last_modified and tr_diagnosis_audit
  triggers (caused SqliteError on first launch).
- app/src/renderer/src/components/tabs/SettingsTab.tsx: moved
  <BrandingPanel /> from Appearance section to Practice section per
  product direction.

White-label branding completed during recovery verification:
- app/src/main/branding/brandingManager.ts (pre-existing) now wired
  through IPC handlers ('branding:get', 'branding:save',
  'branding:saveLogo') in app/src/main/ipc/handlers.ts with a
  'branding:changed' broadcast to all renderer windows on save.
- app/src/preload/index.ts exposes window.psygil.branding.{get,save,
  saveLogo,onChanged}.
- app/src/renderer/src/hooks/useBranding.tsx provides a BrandingProvider
  context that loads on mount and re-renders on broadcast.
- app/src/renderer/src/components/layout/LeftColumn.tsx shows the
  practice logo + name in the column-1 header instead of the
  hardcoded Psygil mark when branding is set.
- app/src/main/index.ts sets the Electron window title from branding
  at startup; save handler re-sets it on change.
- app/src/shared/types/ipc.ts PsygilApi type extended with branding
  namespace."

echo "[5/6] git status:"
git status --short

echo "[6/6] Summary:"
git log --oneline
echo ""
echo "DONE. Next steps (manual):"
echo "  git remote add origin https://github.com/truckirwin-ai/psygil.git"
echo "  git checkout -b recovery/20260413"
echo "  git push --dry-run origin recovery/20260413    # inspect first"
echo "  git push -u origin recovery/20260413           # real push"
echo ""
echo "Then open a PR from recovery/20260413 to main. Do NOT force-push main."
