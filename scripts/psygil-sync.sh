#!/usr/bin/env bash
set -euo pipefail

# Psygil Sync: local <-> git <-> GitHub continuous sync automation
# Triggers: periodic (15m), AFK (5m idle), hourly-push, pre-sleep

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Source the library
source "${SCRIPT_DIR}/psygil-sync-lib.sh"

# Trap to release lock on exit
trap 'release_lock' EXIT

# Print usage
usage() {
  cat <<EOF
Usage: $(basename "$0") <command> [options]

Commands:
  commit [--message "<msg>"]   Stage tracked changes, run gates, create commit
  push                         Push current branch to origin (if ahead)
  status                       Print sync status
  install-agents               Install launchd agents (calls setup-sync.sh)
  uninstall-agents             Uninstall launchd agents (calls setup-sync.sh)

Options:
  --message "<msg>"            Custom commit message (default: wip: auto-sync <timestamp>)
  --if-idle <seconds>          Skip commit unless idle time exceeds threshold

Examples:
  psygil-sync.sh commit
  psygil-sync.sh commit --message "manual save"
  psygil-sync.sh commit --if-idle 300
  psygil-sync.sh push
  psygil-sync.sh status
EOF
}

# Commit command
cmd_commit() {
  local message=""
  local idle_threshold=0

  # Parse arguments
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --message)
        message="$2"
        shift 2
        ;;
      --if-idle)
        idle_threshold="$2"
        shift 2
        ;;
      *)
        echo "ERROR: unknown option: $1"
        usage
        exit 1
        ;;
    esac
  done

  # Check idle threshold if specified
  if [[ $idle_threshold -gt 0 ]]; then
    local idle
    idle=$(idle_seconds)
    if [[ $idle -lt $idle_threshold ]]; then
      append_log "commit" "skipped" "idle time (${idle}s) below threshold (${idle_threshold}s)"
      return 0
    fi
  fi

  # Acquire lock; if already held, exit silently
  if ! acquire_lock; then
    return 0
  fi

  # Generate default message if not provided
  if [[ -z "$message" ]]; then
    message="wip: auto-sync $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  fi

  # Create the commit (gates run inside create_commit)
  create_commit "$message"
}

# Push command
cmd_push() {
  if ! acquire_lock; then
    return 0
  fi

  push_to_origin
}

# Status command
cmd_status() {
  local sha
  local branch
  local idle
  local uncommitted
  local ahead
  local behind

  sha="$(current_sha)"
  branch="$(current_branch)"
  idle=$(idle_seconds)
  uncommitted=$(uncommitted_count)
  ahead=$(ahead_count)
  behind=$(behind_count)

  echo "=== Psygil Sync Status ==="
  echo "Repository: $REPO_ROOT"
  echo "Branch: $branch"
  echo "Commit: $sha"
  echo "Idle: $(format_duration "$idle")"
  echo "Uncommitted files: $uncommitted"
  echo "Ahead of origin: $ahead"
  echo "Behind origin: $behind"
  echo ""
  echo "Log file: $PSYGIL_LOG_FILE"

  if [[ -f "$PSYGIL_LOG_FILE" ]]; then
    echo "Last 5 sync events:"
    tail -5 "$PSYGIL_LOG_FILE" | while read -r line; do
      echo "  $line"
    done
  fi
}

# Install agents command
cmd_install_agents() {
  bash "${SCRIPT_DIR}/setup-sync.sh" install
}

# Uninstall agents command
cmd_uninstall_agents() {
  bash "${SCRIPT_DIR}/setup-sync.sh" uninstall
}

# Main dispatch
main() {
  cd "$REPO_ROOT"

  if [[ $# -eq 0 ]]; then
    usage
    exit 1
  fi

  case "$1" in
    commit)
      shift
      cmd_commit "$@"
      ;;
    push)
      shift
      cmd_push "$@"
      ;;
    status)
      cmd_status
      ;;
    install-agents)
      cmd_install_agents
      ;;
    uninstall-agents)
      cmd_uninstall_agents
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "ERROR: unknown command: $1"
      usage
      exit 1
      ;;
  esac
}

main "$@"
