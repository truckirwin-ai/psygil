#!/usr/bin/env bash
# =============================================================================
# Psygil Python Sidecar, macOS codesigning + entitlements
# =============================================================================
#
# Usage:   sidecar/sign-macos.sh "Developer ID Application: Foundry SMB (TEAMID)"
#
# Why this exists:
#   PyInstaller produces a directory full of dylibs, .so files, and a launcher
#   binary. macOS Gatekeeper requires every executable Mach-O object inside
#   the bundle to be signed with the same Developer ID, and the launcher must
#   carry runtime entitlements that match the parent Electron app's
#   notarization profile. If even one .dylib is unsigned, the parent app's
#   notarization is rejected when it ships.
#
# What it does:
#   1. Locates the staged sidecar at app/resources/sidecar/darwin/psygil-sidecar/
#   2. Recursively signs every executable Mach-O file inside it
#   3. Signs the launcher last with --options runtime + entitlements
#   4. Verifies the signature with codesign --verify --deep --strict
#   5. Optionally runs spctl --assess for an early Gatekeeper preview
# =============================================================================

set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: $0 \"Developer ID Application: <Name> (<TEAMID>)\"" >&2
  exit 2
fi

IDENTITY="$1"
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
REPO_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"
SIDECAR_DIR="$REPO_ROOT/app/resources/sidecar/darwin/psygil-sidecar"
ENTITLEMENTS="$REPO_ROOT/app/entitlements.mac.plist"

if [ ! -d "$SIDECAR_DIR" ]; then
  echo "ERROR: $SIDECAR_DIR not found. Run sidecar/build.sh first." >&2
  exit 1
fi

if [ ! -f "$ENTITLEMENTS" ]; then
  echo "ERROR: entitlements file not found at $ENTITLEMENTS" >&2
  exit 1
fi

echo "Signing identity: $IDENTITY"
echo "Bundle:           $SIDECAR_DIR"
echo "Entitlements:     $ENTITLEMENTS"

# 1. Sign every dylib, so, and Mach-O object first (depth-first inside-out)
echo "Signing inner Mach-O objects..."
COUNT=0
while IFS= read -r -d '' file; do
  # Skip the launcher itself; we sign it last
  if [ "$( basename "$file" )" = "psygil-sidecar" ]; then
    continue
  fi
  # Only sign actual Mach-O files
  if file "$file" | grep -q "Mach-O"; then
    codesign --force --options runtime --timestamp --sign "$IDENTITY" "$file" >/dev/null
    COUNT=$((COUNT + 1))
  fi
done < <( find "$SIDECAR_DIR" -type f \( -name "*.dylib" -o -name "*.so" -o -perm +111 \) -print0 )

echo "  Signed $COUNT inner objects."

# 2. Sign the launcher with runtime entitlements
echo "Signing launcher..."
codesign \
  --force \
  --options runtime \
  --timestamp \
  --entitlements "$ENTITLEMENTS" \
  --sign "$IDENTITY" \
  "$SIDECAR_DIR/psygil-sidecar"

# 3. Verify
echo "Verifying signature..."
codesign --verify --deep --strict --verbose=2 "$SIDECAR_DIR/psygil-sidecar"

# 4. Optional Gatekeeper preview
echo "Running spctl assessment..."
if spctl --assess --type execute --verbose=4 "$SIDECAR_DIR/psygil-sidecar"; then
  echo "  Gatekeeper accepts the binary."
else
  echo "  spctl assessment failed. Notarization will be required."
fi

echo ""
echo "Done. Sidecar is signed and ready for inclusion in the Electron build."
