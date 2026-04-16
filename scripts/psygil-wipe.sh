#!/usr/bin/env bash
# psygil-wipe.sh - IT operator CLI for full local data wipe.
#
# Usage:
#   ./scripts/psygil-wipe.sh --workspace /path/to/workspace --yes
#
# Flags:
#   --workspace <path>   Absolute path to the Psygil workspace folder.
#                        Used for confirmation display and wipe_log entry.
#   --yes                Skip the interactive confirmation prompt.
#
# Exit codes:
#   0  Success
#   1  Error (filesystem operation failed, bad arguments, etc.)
#   2  Confirmation failure (--yes not passed and user declined)
#
# The HIPAA accountability log at {userData}/wipe_log.json is written BEFORE
# any destructive action and survives the wipe.
#
# userData locations:
#   macOS   ~/Library/Application Support/psygil-app
#   Linux   ~/.config/psygil-app
#   Windows %APPDATA%/psygil-app  (APPDATA env var)

set -euo pipefail

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

err() { printf '[psygil-wipe] ERROR: %s\n' "$*" >&2; }
info() { printf '[psygil-wipe] %s\n' "$*"; }

# Resolve the userData directory heuristically by platform.
resolve_userdata() {
  local platform
  platform="$(uname -s 2>/dev/null || echo 'Unknown')"
  case "$platform" in
    Darwin)
      echo "${HOME}/Library/Application Support/psygil-app"
      ;;
    Linux)
      echo "${XDG_CONFIG_HOME:-${HOME}/.config}/psygil-app"
      ;;
    MINGW*|MSYS*|CYGWIN*|Windows_NT)
      # Git Bash / MSYS2 on Windows
      echo "${APPDATA}/psygil-app"
      ;;
    *)
      # Fallback: try the Linux path
      echo "${HOME}/.config/psygil-app"
      ;;
  esac
}

# Zero-fill then delete a file (prevents encrypted residue recovery).
secure_delete() {
  local target="$1"
  if [[ ! -e "$target" ]]; then
    return 0
  fi
  local size
  size=$(wc -c < "$target" 2>/dev/null || echo 0)
  if [[ "$size" -gt 0 ]]; then
    dd if=/dev/zero of="$target" bs=1 count="$size" conv=notrunc 2>/dev/null || true
  fi
  rm -f "$target"
  info "Securely deleted: $target"
}

# Remove a file if it exists (no zero-fill needed for non-sensitive config).
remove_if_exists() {
  local target="$1"
  if [[ -e "$target" ]]; then
    rm -f "$target"
    info "Removed: $target"
  fi
}

# Write a JSON line to wipe_log.json (array of entries).
write_wipe_log() {
  local userdata="$1"
  local workspace_path="$2"
  local log_path="${userdata}/wipe_log.json"

  local ts
  ts="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  local hostname_val
  hostname_val="$(hostname 2>/dev/null || echo 'unknown')"
  local user_val
  user_val="$(id -un 2>/dev/null || echo 'unknown')"
  local pid_val="$$"

  local entry
  entry="{\"timestamp\":\"${ts}\",\"workspacePath\":\"${workspace_path}\",\"userId\":\"${user_val}\",\"hostname\":\"${hostname_val}\",\"pid\":${pid_val},\"source\":\"psygil-wipe.sh\"}"

  # Append to existing log array or create a new one.
  if [[ -f "$log_path" ]]; then
    local existing
    existing="$(cat "$log_path" 2>/dev/null || echo '[]')"
    # If existing content looks like an array, append. Otherwise reset.
    if [[ "$existing" == \[* ]]; then
      # Strip trailing ] and append the new entry
      local trimmed="${existing%]}"
      # Handle empty array case
      if [[ "$trimmed" == "[" ]]; then
        printf '[%s]\n' "$entry" > "$log_path"
      else
        printf '%s,%s]\n' "$trimmed" "$entry" > "$log_path"
      fi
    else
      printf '[%s]\n' "$entry" > "$log_path"
    fi
  else
    mkdir -p "$userdata"
    printf '[%s]\n' "$entry" > "$log_path"
  fi
  chmod 600 "$log_path" 2>/dev/null || true
  info "Wipe log written: $log_path"
}

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------

WORKSPACE_PATH=""
SKIP_CONFIRM=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --workspace)
      if [[ -z "${2:-}" ]]; then
        err "--workspace requires a path argument"
        exit 1
      fi
      WORKSPACE_PATH="$2"
      shift 2
      ;;
    --yes)
      SKIP_CONFIRM=true
      shift
      ;;
    -h|--help)
      grep '^#' "$0" | sed 's/^# \?//'
      exit 0
      ;;
    *)
      err "Unknown argument: $1"
      exit 1
      ;;
  esac
done

if [[ -z "$WORKSPACE_PATH" ]]; then
  err "--workspace <path> is required"
  exit 1
fi

WORKSPACE_NAME="$(basename "${WORKSPACE_PATH%/}")"
USERDATA="$(resolve_userdata)"

# ---------------------------------------------------------------------------
# Confirmation
# ---------------------------------------------------------------------------

if [[ "$SKIP_CONFIRM" == false ]]; then
  printf '\n'
  printf '  WARNING: This will permanently destroy all local Psygil data.\n'
  printf '  Workspace : %s\n' "$WORKSPACE_PATH"
  printf '  UserData  : %s\n' "$USERDATA"
  printf '\n'
  printf '  Type the workspace folder name to confirm: '
  read -r user_input
  if [[ "$user_input" != "$WORKSPACE_NAME" ]]; then
    err "Confirmation mismatch: expected \"${WORKSPACE_NAME}\", got \"${user_input}\". Aborting."
    exit 2
  fi
fi

# ---------------------------------------------------------------------------
# Wipe sequence
# ---------------------------------------------------------------------------

info "Starting wipe sequence for workspace: ${WORKSPACE_PATH}"
info "UserData directory: ${USERDATA}"

# 1. Write HIPAA accountability log (survives the wipe)
write_wipe_log "$USERDATA" "$WORKSPACE_PATH"

# 2. Secure-delete the SQLCipher database and sidecar files.
#    The DB may live inside the workspace (.psygil/psygil.db) or in userData.
DB_IN_WORKSPACE="${WORKSPACE_PATH}/.psygil/psygil.db"
DB_IN_USERDATA="${USERDATA}/psygil.db"

if [[ -f "$DB_IN_WORKSPACE" ]]; then
  secure_delete "$DB_IN_WORKSPACE"
  secure_delete "${DB_IN_WORKSPACE}-wal"
  secure_delete "${DB_IN_WORKSPACE}-shm"
fi
if [[ -f "$DB_IN_USERDATA" ]]; then
  secure_delete "$DB_IN_USERDATA"
  secure_delete "${DB_IN_USERDATA}-wal"
  secure_delete "${DB_IN_USERDATA}-shm"
fi

# 3. Remove safeStorage blobs.
remove_if_exists "${USERDATA}/psygil-api-key.enc"
remove_if_exists "${USERDATA}/auth/refresh.bin"

# 4. Remove config files (leave wipe_log.json intact).
remove_if_exists "${USERDATA}/psygil-setup.json"
remove_if_exists "${USERDATA}/config.json"
remove_if_exists "${USERDATA}/psygil-config.json"

info "Wipe complete."
info "Wipe log preserved at: ${USERDATA}/wipe_log.json"
info "Case files at ${WORKSPACE_PATH} were NOT deleted."
info "Restart Psygil to reinitialize."
exit 0
