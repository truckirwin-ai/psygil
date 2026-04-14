#!/usr/bin/env bash
# Build the dev-mode venv used by `app/src/main/sidecar/index.ts` when it
# falls back to running `python sidecar/server.py` directly (no bundled
# PyInstaller binary). Production builds use `build.sh` instead.
#
# Recovery note (2026-04-13): the pre-rm-rf venv was built from the
# /Applications/Xcode.app bundled Python 3.9.6, which is too old for
# modern spaCy/Presidio. Rebuild with 3.11 or 3.12.
#
# Usage:
#   sidecar/setup-dev-venv.sh                 # uses $(which python3.11)
#   PYTHON=/opt/homebrew/bin/python3.12 \
#     sidecar/setup-dev-venv.sh               # pin a specific interpreter

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE"

VENV=".venv"

# ---- Pick an interpreter ----------------------------------------------------
HOST_PYTHON="${PYTHON:-}"
if [ -z "$HOST_PYTHON" ]; then
  for candidate in python3.12 python3.11 python3.10; do
    if command -v "$candidate" >/dev/null 2>&1; then
      HOST_PYTHON="$candidate"
      break
    fi
  done
fi
if [ -z "$HOST_PYTHON" ]; then
  cat >&2 <<EOF
ERROR: no Python 3.10+ interpreter found.

Install one:
  brew install python@3.12

Then re-run this script, or set PYTHON=/path/to/python3.12 first.
EOF
  exit 1
fi

PYVER=$("$HOST_PYTHON" -c "import sys; print('{}.{}'.format(sys.version_info[0], sys.version_info[1]))")
PY_MAJOR=$(echo "$PYVER" | cut -d. -f1)
PY_MINOR=$(echo "$PYVER" | cut -d. -f2)
if [ "$PY_MAJOR" -lt 3 ] || { [ "$PY_MAJOR" -eq 3 ] && [ "$PY_MINOR" -lt 10 ]; }; then
  echo "ERROR: Python $PYVER is too old. Need 3.10+." >&2
  echo "Fix: brew install python@3.12 && PYTHON=\$(brew --prefix python@3.12)/bin/python3.12 $0" >&2
  exit 1
fi

# ---- Burn the old venv ------------------------------------------------------
if [ -d "$VENV" ]; then
  OLD_VER=""
  if [ -f "$VENV/pyvenv.cfg" ]; then
    OLD_VER=$(grep '^version' "$VENV/pyvenv.cfg" | awk -F= '{print $2}' | tr -d ' ')
  fi
  echo "Removing old venv at $VENV (was Python ${OLD_VER:-unknown})"
  rm -rf "$VENV"
fi

# ---- Build the new venv -----------------------------------------------------
echo "Creating venv at $VENV using $(command -v "$HOST_PYTHON") ($PYVER)..."
"$HOST_PYTHON" -m venv "$VENV"

# shellcheck disable=SC1091
source "$VENV/bin/activate"
PYTHON="$VENV/bin/python"

echo "Upgrading pip/wheel..."
"$PYTHON" -m pip install --upgrade pip wheel >/dev/null

echo "Installing requirements.txt..."
"$PYTHON" -m pip install -r requirements.txt

echo "Downloading en_core_web_lg spaCy model..."
if ! "$PYTHON" -c "import en_core_web_lg" 2>/dev/null; then
  "$PYTHON" -m spacy download en_core_web_lg
fi

echo ""
echo "DONE. Venv ready at $HERE/$VENV"
echo "Smoke test: $PYTHON server.py --help 2>&1 | head -5"
