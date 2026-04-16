#!/usr/bin/env bash
# Sign the sidecar, build the Electron app, and notarize the resulting .dmg.
#
# Reads credentials from scripts/signing/credentials.env (gitignored).
# Uses the existing sidecar/sign-macos.sh and electron-builder env var
# conventions (APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID).
#
# Usage:
#   scripts/signing/sign-and-package.sh           # signed + notarized .dmg
#   scripts/signing/sign-and-package.sh --skip-notarize  # sign only
#   scripts/signing/sign-and-package.sh --unsigned       # bypass everything

set -euo pipefail

HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
REPO_ROOT="$( cd "$HERE/../.." && pwd )"
CRED_FILE="$HERE/credentials.env"

SKIP_NOTARIZE=0
UNSIGNED=0
for arg in "$@"; do
  case "$arg" in
    --skip-notarize) SKIP_NOTARIZE=1 ;;
    --unsigned)      UNSIGNED=1 ;;
    -h|--help)
      echo "Usage: $0 [--skip-notarize | --unsigned]"
      echo ""
      echo "  --skip-notarize  Sign with Developer ID but do not submit to"
      echo "                   Apple for notarization. Useful for internal"
      echo "                   testing without waiting for the notarytool round trip."
      echo "  --unsigned       Build without any signing. Gatekeeper will reject"
      echo "                   the installer on other machines."
      exit 0
      ;;
  esac
done

cd "$REPO_ROOT"

if [ "$UNSIGNED" -eq 1 ]; then
  echo "==> Building UNSIGNED .dmg (CSC_IDENTITY_AUTO_DISCOVERY=false)"
  cd app
  CSC_IDENTITY_AUTO_DISCOVERY=false \
    npx electron-vite build && \
    npx electron-builder --mac --config electron-builder.yml \
      -c.mac.identity=null \
      -c.mac.notarize=false
  echo ""
  echo "Unsigned .dmg built at app/dist/"
  ls -la app/dist/*.dmg 2>/dev/null || true
  exit 0
fi

# --------------------------------------------------------------------------
# Load credentials and run preflight
# --------------------------------------------------------------------------
if [ ! -f "$CRED_FILE" ]; then
  echo "ERROR: credentials.env not found." >&2
  echo "  Run: cp $HERE/credentials.env.example $CRED_FILE" >&2
  echo "  Then edit the four values and try again." >&2
  echo "  Or pass --unsigned to skip signing entirely." >&2
  exit 2
fi

# shellcheck disable=SC1090
source "$CRED_FILE"

# Sanity check placeholders
if echo "${APPLE_DEVELOPER_ID:-}" | grep -qi "REPLACE_WITH_TEAM_ID"; then
  echo "ERROR: APPLE_DEVELOPER_ID in $CRED_FILE is still the placeholder." >&2
  echo "  Edit the file and fill in your real Developer ID Application string." >&2
  echo "  See: scripts/signing/preflight.sh" >&2
  exit 2
fi

echo "==> Running preflight"
if ! "$HERE/preflight.sh"; then
  echo ""
  echo "ERROR: preflight failed. See output above." >&2
  exit 2
fi

# --------------------------------------------------------------------------
# Sign the sidecar
# --------------------------------------------------------------------------
echo ""
echo "==> Signing sidecar binary with $APPLE_DEVELOPER_ID"
"$REPO_ROOT/sidecar/sign-macos.sh" "$APPLE_DEVELOPER_ID"

# --------------------------------------------------------------------------
# Build + sign the Electron app
# --------------------------------------------------------------------------
echo ""
echo "==> Building and signing app with electron-builder"

cd "$REPO_ROOT/app"

export APPLE_ID
export APPLE_APP_SPECIFIC_PASSWORD
export APPLE_TEAM_ID
export CSC_IDENTITY_AUTO_DISCOVERY=true

if [ "$SKIP_NOTARIZE" -eq 1 ]; then
  echo "    (--skip-notarize: signing only, no notarization round trip)"
  npx electron-vite build
  npx electron-builder --mac --config electron-builder.yml \
    -c.mac.identity="$APPLE_DEVELOPER_ID" \
    -c.mac.notarize=false
else
  echo "    (signing and notarizing via Apple notarytool)"
  npx electron-vite build
  # electron-builder reads APPLE_ID + APPLE_APP_SPECIFIC_PASSWORD +
  # APPLE_TEAM_ID from the environment and submits to notarytool
  # automatically when mac.notarize is not explicitly false.
  npx electron-builder --mac --config electron-builder.yml \
    -c.mac.identity="$APPLE_DEVELOPER_ID" \
    -c.mac.notarize=true
fi

# --------------------------------------------------------------------------
# Verify
# --------------------------------------------------------------------------
DMG="$( ls -t "$REPO_ROOT/app/dist"/*.dmg 2>/dev/null | head -1 )"

if [ -z "$DMG" ] || [ ! -f "$DMG" ]; then
  echo "ERROR: no .dmg produced." >&2
  exit 1
fi

echo ""
echo "==> Verifying signature"
codesign --verify --deep --strict --verbose=2 "$DMG" 2>&1 | head -8

if [ "$SKIP_NOTARIZE" -eq 0 ]; then
  echo ""
  echo "==> Verifying notarization"
  spctl -a -vvv -t install "$DMG" 2>&1 | head -8 || true
fi

echo ""
echo "==========================================="
echo "Signed .dmg:  $DMG"
SIZE_MB="$( du -m "$DMG" | cut -f1 )"
echo "Size:         ${SIZE_MB} MB"
echo "==========================================="
