#!/usr/bin/env bash
#
# Psygil sidecar bootstrap (POSIX: macOS, Linux)
# ==============================================
#
# Run this once after installing Psygil. It creates a Python virtualenv
# inside the bundled sidecar/ directory and installs Presidio + spaCy +
# the en_core_web_lg model. Psygil's main process auto-detects this venv
# at startup (see src/main/sidecar/index.ts → resolvePythonExecutable).
#
# Requirements:
#   - Python 3.10 or newer on PATH (`python3 --version`)
#   - ~1.5 GB free disk for the venv + spaCy model
#   - Internet connection (for pip + spacy download)
#
# Usage:
#   In the installed app bundle on macOS:
#     /Applications/Psygil.app/Contents/Resources/bootstrap-sidecar.sh
#   On Linux (AppImage extracted):
#     ./squashfs-root/resources/bootstrap-sidecar.sh
#   In a dev checkout:
#     bash app/resources/bootstrap-sidecar.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# In a packaged app, this script lives at .../Resources/bootstrap-sidecar.sh
# and the sidecar lives at .../Resources/sidecar. In a dev checkout it lives
# at app/resources/bootstrap-sidecar.sh and the sidecar lives at ../sidecar.
if [[ -d "$SCRIPT_DIR/sidecar" ]]; then
  SIDECAR_DIR="$SCRIPT_DIR/sidecar"
elif [[ -d "$SCRIPT_DIR/../../sidecar" ]]; then
  SIDECAR_DIR="$(cd "$SCRIPT_DIR/../../sidecar" && pwd)"
else
  echo "ERROR: cannot locate sidecar/ directory relative to $SCRIPT_DIR" >&2
  exit 1
fi

VENV_DIR="$SIDECAR_DIR/venv"
REQ_FILE="$SIDECAR_DIR/requirements.txt"

if [[ ! -f "$REQ_FILE" ]]; then
  echo "ERROR: requirements.txt not found at $REQ_FILE" >&2
  exit 1
fi

# Find a Python 3.10+ interpreter. Honor PSYGIL_PYTHON if set, otherwise
# probe versioned binaries before falling back to plain `python3` (which on
# macOS is often the system Python 3.9, too old for Presidio).
PYTHON_BIN=""
if [[ -n "${PSYGIL_PYTHON:-}" ]] && command -v "$PSYGIL_PYTHON" >/dev/null 2>&1; then
  PYTHON_BIN="$PSYGIL_PYTHON"
else
  for candidate in python3.13 python3.12 python3.11 python3.10 python3; do
    if command -v "$candidate" >/dev/null 2>&1; then
      ver=$("$candidate" -c 'import sys; print("{}.{}".format(sys.version_info[0], sys.version_info[1]))' 2>/dev/null || echo "0.0")
      major=$(echo "$ver" | cut -d. -f1)
      minor=$(echo "$ver" | cut -d. -f2)
      if [[ "$major" -ge 3 ]] && [[ "$minor" -ge 10 ]]; then
        PYTHON_BIN="$candidate"
        break
      fi
    fi
  done
fi

if [[ -z "$PYTHON_BIN" ]]; then
  echo "ERROR: No Python 3.10+ interpreter found on PATH." >&2
  echo "  macOS:  brew install python@3.12" >&2
  echo "  Linux:  sudo apt install python3 python3-venv" >&2
  echo "  Or set PSYGIL_PYTHON=/path/to/python3.x and re-run." >&2
  exit 1
fi

PY_VERSION=$("$PYTHON_BIN" -c 'import sys; print("{}.{}".format(sys.version_info[0], sys.version_info[1]))')

echo "==> Sidecar dir:    $SIDECAR_DIR"
echo "==> Python:         $(command -v "$PYTHON_BIN") ($PY_VERSION)"
echo "==> Venv target:    $VENV_DIR"

if [[ -d "$VENV_DIR" ]]; then
  echo "==> Existing venv detected. Reusing."
else
  echo "==> Creating venv (this takes about 30 seconds)..."
  "$PYTHON_BIN" -m venv "$VENV_DIR"
fi

# shellcheck source=/dev/null
source "$VENV_DIR/bin/activate"

echo "==> Upgrading pip"
python -m pip install --quiet --upgrade pip

echo "==> Installing sidecar dependencies (Presidio + spaCy + jsonrpcserver)"
python -m pip install --quiet -r "$REQ_FILE"

echo "==> Downloading spaCy model en_core_web_lg (about 600 MB)"
if ! python -c 'import spacy; spacy.load("en_core_web_lg")' >/dev/null 2>&1; then
  python -m spacy download en_core_web_lg
else
  echo "    en_core_web_lg already installed."
fi

echo ""
echo "Bootstrap complete."
echo "You can now launch Psygil. The sidecar will start automatically."
