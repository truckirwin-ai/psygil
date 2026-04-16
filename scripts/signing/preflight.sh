#!/usr/bin/env bash
# Verify every input needed to sign and notarize Psygil for macOS is present.
# Prints a single green checkmark per item that is ready and a red cross with
# actionable remediation per item that is not.
#
# Usage:
#   scripts/signing/preflight.sh           # Check only
#   scripts/signing/preflight.sh --strict  # Exit non-zero on any missing item

set -uo pipefail

HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
REPO_ROOT="$( cd "$HERE/../.." && pwd )"
CRED_FILE="$HERE/credentials.env"
CRED_TEMPLATE="$HERE/credentials.env.example"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
DIM='\033[2m'
NC='\033[0m'

MISSING=0
WARN=0

ok()   { printf "${GREEN}[ ok ]${NC}  %s\n" "$1"; }
miss() { printf "${RED}[miss]${NC}  %s\n" "$1"; [ -n "${2:-}" ] && printf "        ${DIM}%s${NC}\n" "$2"; MISSING=$((MISSING + 1)); }
warn() { printf "${YELLOW}[warn]${NC}  %s\n" "$1"; [ -n "${2:-}" ] && printf "        ${DIM}%s${NC}\n" "$2"; WARN=$((WARN + 1)); }

echo ""
echo "Psygil macOS signing preflight"
echo "==============================="
echo ""

# ---------------------------------------------------------------------------
# 1. credentials.env exists
# ---------------------------------------------------------------------------
if [ -f "$CRED_FILE" ]; then
  ok "credentials.env present at $CRED_FILE"
  # shellcheck disable=SC1090
  source "$CRED_FILE"
else
  miss "credentials.env missing" "Run: cp $CRED_TEMPLATE $CRED_FILE, then edit the four values."
fi

# ---------------------------------------------------------------------------
# 2. Individual credential fields
# ---------------------------------------------------------------------------
check_not_placeholder() {
  local name="$1"
  local value="${2:-}"
  local placeholder_pattern="$3"
  if [ -z "$value" ]; then
    miss "$name is empty"
    return
  fi
  if echo "$value" | grep -qi "$placeholder_pattern"; then
    miss "$name is still the placeholder value" "Edit credentials.env and replace the placeholder with your real value."
    return
  fi
  ok "$name is set"
}

check_not_placeholder "APPLE_DEVELOPER_ID" "${APPLE_DEVELOPER_ID:-}" "REPLACE_WITH_TEAM_ID"
check_not_placeholder "APPLE_TEAM_ID" "${APPLE_TEAM_ID:-}" "REPLACE_WITH_TEAM_ID"
check_not_placeholder "APPLE_ID" "${APPLE_ID:-}" "REPLACE_WITH"
check_not_placeholder "APPLE_APP_SPECIFIC_PASSWORD" "${APPLE_APP_SPECIFIC_PASSWORD:-}" "xxxx-xxxx"

# ---------------------------------------------------------------------------
# 3. Team ID format check (10 alphanumeric)
# ---------------------------------------------------------------------------
if [ -n "${APPLE_TEAM_ID:-}" ] && ! echo "$APPLE_TEAM_ID" | grep -qi "REPLACE"; then
  if echo "$APPLE_TEAM_ID" | grep -qE '^[A-Z0-9]{10}$'; then
    ok "APPLE_TEAM_ID format looks valid"
  else
    warn "APPLE_TEAM_ID does not match the 10-char alphanumeric format" "Team IDs are always exactly 10 uppercase letters and digits."
  fi
fi

# ---------------------------------------------------------------------------
# 4. App-specific password format
# ---------------------------------------------------------------------------
if [ -n "${APPLE_APP_SPECIFIC_PASSWORD:-}" ] && [ "${APPLE_APP_SPECIFIC_PASSWORD:-}" != "xxxx-xxxx-xxxx-xxxx" ]; then
  if echo "$APPLE_APP_SPECIFIC_PASSWORD" | grep -qE '^[a-z]{4}-[a-z]{4}-[a-z]{4}-[a-z]{4}$'; then
    ok "APPLE_APP_SPECIFIC_PASSWORD format looks valid"
  else
    warn "APPLE_APP_SPECIFIC_PASSWORD is not in the standard xxxx-xxxx-xxxx-xxxx format" "Double-check you copied the app-specific password, not your Apple ID password."
  fi
fi

# ---------------------------------------------------------------------------
# 5. Developer ID cert installed in keychain
# ---------------------------------------------------------------------------
if command -v security >/dev/null 2>&1; then
  IDENTITIES="$( security find-identity -v -p codesigning 2>/dev/null || true )"
  if echo "$IDENTITIES" | grep -q "Developer ID Application"; then
    CERT_LINE="$( echo "$IDENTITIES" | grep "Developer ID Application" | head -1 )"
    ok "Developer ID Application certificate found in keychain"
    printf "        ${DIM}%s${NC}\n" "$( echo "$CERT_LINE" | sed 's/^[[:space:]]*//' )"
    # Cross-check against APPLE_DEVELOPER_ID if set
    if [ -n "${APPLE_DEVELOPER_ID:-}" ] && ! echo "$APPLE_DEVELOPER_ID" | grep -qi "REPLACE"; then
      if echo "$CERT_LINE" | grep -qF "$APPLE_DEVELOPER_ID"; then
        ok "Keychain cert matches APPLE_DEVELOPER_ID"
      else
        warn "Keychain cert does NOT match APPLE_DEVELOPER_ID in credentials.env" "Copy the exact string in quotes from 'security find-identity -v -p codesigning'."
      fi
    fi
  else
    miss "No 'Developer ID Application' certificate found in keychain" "Generate a CSR via Keychain Access, upload at https://developer.apple.com/account/resources/certificates/list, download the .cer and double-click to install."
  fi
else
  warn "security command not found (not running on macOS?)" "Signing requires macOS."
fi

# ---------------------------------------------------------------------------
# 6. Sidecar binary staged
# ---------------------------------------------------------------------------
SIDECAR_BIN="$REPO_ROOT/app/resources/sidecar/darwin/psygil-sidecar/psygil-sidecar"
if [ -x "$SIDECAR_BIN" ]; then
  ok "Sidecar binary staged at app/resources/sidecar/darwin/"
  SIZE_MB="$( du -sm "$( dirname "$SIDECAR_BIN" )" | awk '{print $1}' )"
  printf "        ${DIM}bundle size: %s MB${NC}\n" "$SIZE_MB"
else
  miss "Sidecar binary missing" "Run: PYTHON=/opt/homebrew/bin/python3.11 sidecar/build.sh --clean"
fi

# ---------------------------------------------------------------------------
# 7. electron-builder.yml is configured to sign
# ---------------------------------------------------------------------------
BUILDER_YML="$REPO_ROOT/app/electron-builder.yml"
if [ -f "$BUILDER_YML" ]; then
  if grep -qE "^\s*identity:\s*null" "$BUILDER_YML"; then
    warn "electron-builder.yml still has 'identity: null' hardcoded" "The sign-and-package.sh helper will handle this via CLI override, but for a clean setup remove the line."
  else
    ok "electron-builder.yml identity is dynamic"
  fi
  if grep -qE "^\s*notarize:\s*false" "$BUILDER_YML"; then
    warn "electron-builder.yml still has 'notarize: false' hardcoded" "The sign-and-package.sh helper will override this, but a clean setup removes the line."
  else
    ok "electron-builder.yml notarize is dynamic"
  fi
fi

# ---------------------------------------------------------------------------
# 8. node_modules present
# ---------------------------------------------------------------------------
if [ -d "$REPO_ROOT/app/node_modules/electron-builder" ]; then
  ok "electron-builder installed"
else
  miss "electron-builder not installed" "Run: cd app && npm ci --legacy-peer-deps"
fi

# ---------------------------------------------------------------------------
# 9. notarytool available (comes with Xcode command line tools)
# ---------------------------------------------------------------------------
if command -v xcrun >/dev/null 2>&1 && xcrun notarytool --help >/dev/null 2>&1; then
  ok "xcrun notarytool is available"
else
  miss "xcrun notarytool not available" "Install Xcode command line tools: xcode-select --install"
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
echo "==============================="
if [ "$MISSING" -eq 0 ] && [ "$WARN" -eq 0 ]; then
  printf "${GREEN}Ready to sign and package.${NC}\n"
  echo "Next: scripts/signing/sign-and-package.sh"
  exit 0
elif [ "$MISSING" -eq 0 ]; then
  printf "${YELLOW}Ready with %d warning(s).${NC} Review above and proceed if the warnings are acceptable.\n" "$WARN"
  echo "Next: scripts/signing/sign-and-package.sh"
  exit 0
else
  printf "${RED}%d item(s) missing, %d warning(s).${NC} Fix the items above, then re-run this script.\n" "$MISSING" "$WARN"
  [ "${1:-}" = "--strict" ] && exit 1
  exit 1
fi
