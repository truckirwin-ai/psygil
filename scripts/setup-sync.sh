#!/usr/bin/env bash
set -euo pipefail

# Setup script for Psygil Sync automation
# Installs/uninstalls launchd agents and git hooks

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
readonly LAUNCHD_DIR="${SCRIPT_DIR}/launchd"
readonly AGENTS_DIR="${HOME}/Library/LaunchAgents"
readonly PSYGIL_LOG_DIR="${HOME}/.psygil"

# Usage
usage() {
  cat <<EOF
Usage: $(basename "$0") <command>

Commands:
  install                      Install launchd agents and git hooks
  uninstall                    Uninstall launchd agents and restore git config

Examples:
  setup-sync.sh install
  setup-sync.sh uninstall
EOF
}

# Install launchd agents
install_agents() {
  echo "Installing Psygil Sync launchd agents..."

  mkdir -p "$AGENTS_DIR"
  mkdir -p "$PSYGIL_LOG_DIR"

  local plist_files=(
    "com.foundrysmb.psygil.periodic.plist"
    "com.foundrysmb.psygil.hourly-push.plist"
    "com.foundrysmb.psygil.afk.plist"
    "com.foundrysmb.psygil.sleep-push.plist"
  )

  for plist in "${plist_files[@]}"; do
    local src="${LAUNCHD_DIR}/${plist}"
    local dst="${AGENTS_DIR}/${plist}"
    local uid
    uid=$(id -u)

    if [[ ! -f "$src" ]]; then
      echo "ERROR: template not found: $src"
      return 1
    fi

    # Copy and substitute __REPO_ROOT__
    sed "s|__REPO_ROOT__|${REPO_ROOT}|g" "$src" > "$dst"
    chmod 644 "$dst"

    # Bootstrap or load the agent
    if [[ -n "$(command -v launchctl 2>/dev/null)" ]]; then
      # Check if already bootstrapped (macOS 11+)
      if launchctl list | grep -q "com.foundrysmb.psygil"; then
        echo "  $plist: already loaded, skipping"
      else
        if launchctl bootstrap "gui/$uid" "$dst" 2>/dev/null; then
          echo "  $plist: bootstrapped"
        else
          # Fall back to load for older macOS
          if launchctl load "$dst" 2>/dev/null; then
            echo "  $plist: loaded"
          else
            echo "  $plist: failed to load"
            return 1
          fi
        fi
      fi
    fi
  done

  echo "Launchd agents installed."
}

# Enable git hooks
enable_git_hooks() {
  echo "Enabling git hooks..."

  if [[ -d "${REPO_ROOT}/.git" ]]; then
    git -C "$REPO_ROOT" config core.hooksPath .githooks
    echo "Git hooks path set to: .githooks"
  else
    echo "ERROR: not a git repository: $REPO_ROOT"
    return 1
  fi
}

# Uninstall launchd agents
uninstall_agents() {
  echo "Uninstalling Psygil Sync launchd agents..."

  local uid
  uid=$(id -u)

  local plist_files=(
    "com.foundrysmb.psygil.periodic.plist"
    "com.foundrysmb.psygil.hourly-push.plist"
    "com.foundrysmb.psygil.afk.plist"
    "com.foundrysmb.psygil.sleep-push.plist"
  )

  for plist in "${plist_files[@]}"; do
    local dst="${AGENTS_DIR}/${plist}"
    local label="${plist%.plist}"

    if [[ -f "$dst" ]]; then
      # Bootout or unload the agent
      if [[ -n "$(command -v launchctl 2>/dev/null)" ]]; then
        if launchctl bootout "gui/$uid" "$dst" 2>/dev/null; then
          echo "  $plist: unloaded"
        else
          # Fall back to unload for older macOS
          if launchctl unload "$dst" 2>/dev/null; then
            echo "  $plist: unloaded"
          else
            echo "  $plist: already unloaded"
          fi
        fi
      fi

      rm -f "$dst"
      echo "  $plist: removed"
    fi
  done

  echo "Launchd agents uninstalled."
}

# Disable git hooks
disable_git_hooks() {
  echo "Disabling git hooks..."

  if [[ -d "${REPO_ROOT}/.git" ]]; then
    local current_hooks_path
    current_hooks_path=$(git -C "$REPO_ROOT" config core.hooksPath 2>/dev/null || echo "")

    if [[ "$current_hooks_path" == ".githooks" ]]; then
      git -C "$REPO_ROOT" config --unset core.hooksPath
      echo "Git hooks path unset."
    fi
  fi
}

# Main
main() {
  if [[ $# -eq 0 ]]; then
    usage
    exit 1
  fi

  case "$1" in
    install)
      install_agents || exit 1
      enable_git_hooks || exit 1
      echo ""
      echo "Psygil Sync installed successfully!"
      echo "Run: psygil-sync.sh status"
      ;;
    uninstall)
      uninstall_agents || exit 1
      disable_git_hooks || exit 1
      echo ""
      echo "Psygil Sync uninstalled."
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
