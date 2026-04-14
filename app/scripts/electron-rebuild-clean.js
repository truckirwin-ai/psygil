#!/usr/bin/env node
/**
 * electron-rebuild-clean.js
 *
 * Properly rebuilds native Node modules for Electron's ABI.
 *
 * WHY THIS EXISTS:
 * ─────────────────
 * When `npm install` runs, each native module's own install script
 * (e.g. `prebuild-install || node-gyp rebuild`) compiles against the
 * SYSTEM Node.js headers, baking the system ABI into build/config.gypi.
 *
 * `electron-rebuild` is supposed to fix this, but node-gyp's configure
 * step reuses the cached config.gypi if the build/ directory already
 * exists — so the system ABI persists even after electron-rebuild runs.
 *
 * THE FIX:
 * ────────
 * 1. Delete the entire build/ directory for each native module
 * 2. THEN run electron-rebuild, which does a clean configure + build
 *    against Electron's bundled Node headers (correct ABI)
 *
 * This script runs as the npm postinstall hook.
 */

const { execSync } = require('child_process')
const { rmSync, existsSync, lstatSync, mkdirSync, writeFileSync } = require('fs')
const { join } = require('path')

// drizzle-orm/better-sqlite3 hard-requires the literal package name
// `better-sqlite3` at runtime. We use the SQLCipher fork
// `better-sqlite3-multiple-ciphers`, so we install a tiny shim package at
// node_modules/better-sqlite3 that re-exports the fork. This must be a REAL
// directory (not a symlink) so it survives electron-builder's asar packaging.
function installBetterSqlite3Shim() {
  const root = join(__dirname, '..', 'node_modules')
  const shimDir = join(root, 'better-sqlite3')

  // Remove any pre-existing symlink or stale shim
  try {
    const stat = lstatSync(shimDir)
    if (stat.isSymbolicLink()) {
      console.log('[rebuild-clean] Removing better-sqlite3 symlink (will replace with shim package)')
      rmSync(shimDir, { force: true })
    } else if (stat.isDirectory()) {
      // Only remove if it looks like our shim (has marker file). Never blow
      // away a real install of better-sqlite3 if one snuck in.
      const marker = join(shimDir, '.psygil-shim')
      if (existsSync(marker)) {
        rmSync(shimDir, { recursive: true, force: true })
      } else {
        console.log('[rebuild-clean] better-sqlite3 already present and is not our shim — leaving alone')
        return
      }
    }
  } catch {
    // doesn't exist
  }

  mkdirSync(shimDir, { recursive: true })
  writeFileSync(
    join(shimDir, 'package.json'),
    JSON.stringify(
      {
        name: 'better-sqlite3',
        version: '0.0.0-psygil-shim',
        main: 'index.js',
        description: 'Shim that re-exports better-sqlite3-multiple-ciphers so drizzle-orm can resolve it.',
        license: 'MIT',
      },
      null,
      2,
    ) + '\n',
  )
  writeFileSync(
    join(shimDir, 'index.js'),
    "module.exports = require('better-sqlite3-multiple-ciphers')\n",
  )
  writeFileSync(join(shimDir, '.psygil-shim'), 'do not delete\n')
  console.log('[rebuild-clean] Installed better-sqlite3 shim package -> better-sqlite3-multiple-ciphers')
}

// pnpm with hoisted layout sometimes creates a self-referencing symlink
// inside better-sqlite3-multiple-ciphers (better-sqlite3-multiple-ciphers/
// better-sqlite3-multiple-ciphers -> better-sqlite3-multiple-ciphers).
// This causes ELOOP errors when electron-builder walks node_modules.
// Remove it preemptively before any build step touches the directory.
function removeSelfSymlinks() {
  const candidates = [
    'better-sqlite3-multiple-ciphers/better-sqlite3-multiple-ciphers',
  ]
  const root = join(__dirname, '..', 'node_modules')
  for (const rel of candidates) {
    const full = join(root, rel)
    try {
      const stat = lstatSync(full)
      if (stat.isSymbolicLink()) {
        console.log(`[rebuild-clean] Removing self-symlink ${rel}`)
        rmSync(full, { force: true })
      }
    } catch {
      // Doesn't exist — nothing to do
    }
  }
}

removeSelfSymlinks()
installBetterSqlite3Shim()

const NATIVE_MODULES = [
  'better-sqlite3-multiple-ciphers',
  'argon2',
]

const nodeModulesDir = join(__dirname, '..', 'node_modules')

// Step 1: Nuke stale build artifacts
for (const mod of NATIVE_MODULES) {
  const buildDir = join(nodeModulesDir, mod, 'build')
  if (existsSync(buildDir)) {
    console.log(`[rebuild-clean] Removing stale build/ for ${mod}`)
    rmSync(buildDir, { recursive: true, force: true })
  }

  // Also remove prebuilds — they may be for the wrong ABI
  const prebuildsDir = join(nodeModulesDir, mod, 'prebuilds')
  if (existsSync(prebuildsDir)) {
    console.log(`[rebuild-clean] Removing prebuilds/ for ${mod}`)
    rmSync(prebuildsDir, { recursive: true, force: true })
  }
}

// Step 2: Run electron-rebuild with force flag
console.log('[rebuild-clean] Running electron-rebuild (clean build)...')
try {
  execSync(
    'npx electron-rebuild -f -w better-sqlite3-multiple-ciphers,argon2',
    {
      cwd: join(__dirname, '..'),
      stdio: 'inherit',
      env: {
        ...process.env,
        // Ensure node-gyp doesn't reuse any cached config
        npm_config_node_gyp: '',
      },
    },
  )
  console.log('[rebuild-clean] electron-rebuild completed successfully.')
} catch (err) {
  console.error('[rebuild-clean] electron-rebuild FAILED:', err.message)
  process.exit(1)
}

// Step 3: Verify the ABI is correct
try {
  const configPath = join(
    nodeModulesDir,
    'better-sqlite3-multiple-ciphers',
    'build',
    'config.gypi',
  )
  if (existsSync(configPath)) {
    const config = require('fs').readFileSync(configPath, 'utf-8')
    const match = config.match(/"node_module_version":\s*(\d+)/)
    if (match) {
      const abi = parseInt(match[1], 10)
      console.log(`[rebuild-clean] Verified ABI in config.gypi: ${abi}`)
      // Electron 33 = ABI 130, Electron 34 = ABI 132
      if (abi > 135) {
        console.error(
          `[rebuild-clean] WARNING: ABI ${abi} looks like system Node, not Electron!`,
          'The rebuild may not have targeted Electron headers correctly.',
        )
        process.exit(1)
      }
    }
  }
} catch {
  // Verification is best-effort
}
