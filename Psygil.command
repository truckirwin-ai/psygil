#!/bin/bash
# ─────────────────────────────────────────────────────
# Psygil — Forensic Psychology IDE
# Double-click to launch, or drag to Dock
# ─────────────────────────────────────────────────────

cd "$(dirname "$0")/app" || exit 1

# Install deps if needed (first launch)
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies (first time only)..."
  npm install
fi

echo "🧠 Starting Psygil..."
npm run dev
