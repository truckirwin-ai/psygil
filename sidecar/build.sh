#!/usr/bin/env bash
# =============================================================================
# Psygil Python Sidecar, PyInstaller build driver
# =============================================================================
#
# Usage:   sidecar/build.sh [--clean] [--no-venv]
#
# What it does:
#   1. Creates (or reuses) a clean Python venv at sidecar/.venv-build/
#   2. Installs requirements.txt, pyinstaller, and the en_core_web_lg model
#   3. Runs `pyinstaller --clean sidecar/psygil_sidecar.spec`
#   4. Copies the resulting onedir bundle to
#      app/resources/sidecar/<platform>/psygil-sidecar/
#   5. Smoke-tests the binary by running it with --version (the server
#      treats unknown args as a no-op and exits clean for this case)
#
# Flags:
#   --clean      remove .venv-build/, dist/, and build/ before starting
#   --no-venv    skip venv creation; use the system python that's on PATH
#                (only do this in CI containers or Docker images)
#
# Cross-platform notes:
#   - Run on macOS to produce a macOS binary; on Linux for Linux; on
#     Windows (with Git Bash or WSL) for Windows. PyInstaller cannot
#     cross-compile.
#   - The Electron build pipeline (electron-builder) picks up the binary
#     from app/resources/sidecar/<platform>/psygil-sidecar/ at packaging
#     time. The platform directory is darwin/, linux/, or win32/.
# =============================================================================

set -euo pipefail

CLEAN=0
USE_VENV=1
for arg in "$@"; do
  case "$arg" in
    --clean) CLEAN=1 ;;
    --no-venv) USE_VENV=0 ;;
    *) echo "Unknown flag: $arg" >&2; exit 2 ;;
  esac
done

# ---- Resolve paths ----------------------------------------------------------

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
REPO_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"
SIDECAR_DIR="$SCRIPT_DIR"
SPEC_FILE="$SIDECAR_DIR/psygil_sidecar.spec"
VENV_DIR="$SIDECAR_DIR/.venv-build"
DIST_DIR="$SIDECAR_DIR/dist"
BUILD_DIR="$SIDECAR_DIR/build"

# Detect platform for the destination directory
case "$( uname -s )" in
  Darwin) PLATFORM="darwin" ;;
  Linux)  PLATFORM="linux" ;;
  MINGW*|MSYS*|CYGWIN*) PLATFORM="win32" ;;
  *) echo "Unsupported platform: $( uname -s )"; exit 1 ;;
esac

DEST_DIR="$REPO_ROOT/app/resources/sidecar/$PLATFORM"

echo "Psygil sidecar build"
echo "  repo:     $REPO_ROOT"
echo "  spec:     $SPEC_FILE"
echo "  platform: $PLATFORM"
echo "  dest:     $DEST_DIR"

# ---- Optional clean ---------------------------------------------------------

if [ "$CLEAN" -eq 1 ]; then
  echo "Cleaning previous build artifacts..."
  rm -rf "$DIST_DIR" "$BUILD_DIR"
  if [ "$USE_VENV" -eq 1 ]; then
    rm -rf "$VENV_DIR"
  fi
fi

# ---- Resolve Python ---------------------------------------------------------

# ---- Locate a Python interpreter and check the version ---------------------
#
# We do this BEFORE creating the venv so we don't waste disk + time on a
# venv built from an unsupported interpreter.

# Caller may pin a specific interpreter via $PYTHON
HOST_PYTHON="${PYTHON:-python3}"
if ! command -v "$HOST_PYTHON" >/dev/null 2>&1; then
  echo "ERROR: $HOST_PYTHON not found on PATH." >&2
  exit 1
fi

PYVER=$("$HOST_PYTHON" -c "import sys; print('{}.{}'.format(sys.version_info[0], sys.version_info[1]))")
PY_MAJOR=$(echo "$PYVER" | cut -d. -f1)
PY_MINOR=$(echo "$PYVER" | cut -d. -f2)
if [ "$PY_MAJOR" -lt 3 ] || { [ "$PY_MAJOR" -eq 3 ] && [ "$PY_MINOR" -lt 10 ]; }; then
  cat >&2 <<EOF

ERROR: Python ${PYVER} is too old.

The Psygil sidecar requires Python 3.10 or newer because spaCy depends on
thinc>=8.3.12 which dropped Python 3.9 support.

Fix:
  - macOS:  brew install python@3.11   (then re-run sidecar/build.sh)
  - Linux:  use pyenv, asdf, or your distribution's python3.11 package
  - Or:     PYTHON=/path/to/python3.11 sidecar/build.sh --no-venv

EOF
  exit 1
fi

if [ "$USE_VENV" -eq 1 ]; then
  if [ ! -d "$VENV_DIR" ]; then
    echo "Creating venv at $VENV_DIR with $HOST_PYTHON ($PYVER)..."
    "$HOST_PYTHON" -m venv "$VENV_DIR"
  fi
  # shellcheck disable=SC1091
  source "$VENV_DIR/bin/activate"
  PYTHON="python"
else
  PYTHON="$HOST_PYTHON"
fi

echo "Using $($PYTHON --version) at $(command -v $PYTHON)"

# ---- Install dependencies ---------------------------------------------------

echo "Upgrading pip and wheel..."
$PYTHON -m pip install --upgrade pip wheel >/dev/null

echo "Installing sidecar requirements..."
$PYTHON -m pip install -r "$SIDECAR_DIR/requirements.txt"

echo "Installing PyInstaller..."
$PYTHON -m pip install pyinstaller

echo "Ensuring spaCy model en_core_web_lg is present..."
if ! $PYTHON -c "import en_core_web_lg" 2>/dev/null; then
  $PYTHON -m spacy download en_core_web_lg
else
  echo "  (already installed)"
fi

# ---- Run PyInstaller --------------------------------------------------------

echo "Running PyInstaller..."
cd "$REPO_ROOT"
$PYTHON -m PyInstaller --clean --distpath "$DIST_DIR" --workpath "$BUILD_DIR" "$SPEC_FILE"

if [ ! -d "$DIST_DIR/psygil-sidecar" ]; then
  echo "ERROR: PyInstaller did not produce $DIST_DIR/psygil-sidecar" >&2
  exit 1
fi

# ---- Smoke test -------------------------------------------------------------

echo "Smoke testing the binary..."
BINARY="$DIST_DIR/psygil-sidecar/psygil-sidecar"
if [ "$PLATFORM" = "win32" ]; then
  BINARY="${BINARY}.exe"
fi

if [ ! -x "$BINARY" ]; then
  echo "ERROR: binary not executable: $BINARY" >&2
  exit 1
fi

# Run the binary and poll for the ready signal for up to 30 seconds.
# First-run spaCy model load can take 8-15s on slower machines, so the
# previous fixed 5s sleep was too tight. Poll every 1s for ready OR an
# exit, whichever comes first.
SMOKE_LOG="$( mktemp )"
PYTHONUNBUFFERED=1 "$BINARY" >"$SMOKE_LOG" 2>&1 &
PID=$!
READY=0
for _ in $(seq 1 30); do
  if grep -q '"status":"ready"' "$SMOKE_LOG" 2>/dev/null; then
    READY=1
    break
  fi
  if ! kill -0 "$PID" 2>/dev/null; then
    break
  fi
  sleep 1
done
if kill -0 "$PID" 2>/dev/null; then
  kill "$PID" 2>/dev/null || true
fi
wait "$PID" 2>/dev/null || true

if [ "$READY" -eq 1 ]; then
  echo "  Smoke test PASSED."
else
  echo "  Smoke test FAILED. Output:"
  cat "$SMOKE_LOG"
  exit 1
fi
rm -f "$SMOKE_LOG"

# ---- Stage into Electron resources -----------------------------------------

echo "Staging binary into $DEST_DIR..."
mkdir -p "$DEST_DIR"
rm -rf "$DEST_DIR/psygil-sidecar"
cp -R "$DIST_DIR/psygil-sidecar" "$DEST_DIR/psygil-sidecar"

# ---- Done ------------------------------------------------------------------

DEST_BIN="$DEST_DIR/psygil-sidecar/psygil-sidecar"
[ "$PLATFORM" = "win32" ] && DEST_BIN="${DEST_BIN}.exe"

echo ""
echo "Build complete."
echo "  Binary:  $DEST_BIN"
SIZE=$(du -sh "$DEST_DIR/psygil-sidecar" 2>/dev/null | awk '{print $1}')
echo "  Size:    $SIZE"
echo ""
echo "Next steps for a release build on macOS:"
echo "  1. Sign the binary:    sidecar/sign-macos.sh \"\$DEVELOPER_ID_APP\""
echo "  2. Test launch:        \"$DEST_BIN\""
echo "  3. Run app build:      cd app && npm run dist:mac"
