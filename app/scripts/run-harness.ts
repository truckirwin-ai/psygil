/**
 * CLI: Run a test harness manifest against the real Electron SQLCipher DB.
 *
 * Usage:
 *   cd app && npx tsx scripts/run-harness.ts [manifestId]
 *
 * Example:
 *   npx tsx scripts/run-harness.ts cst-riggins-001
 *
 * This bypasses the Electron IPC layer and calls runManifest() directly.
 * Useful for CI, headless verification, and debugging pipeline progression
 * without needing the renderer open.
 *
 * IMPORTANT: The Electron app MUST NOT be running — better-sqlite3 holds an
 * exclusive lock on the DB file.
 */

import { join, dirname } from 'path'
import os from 'os'
import { mkdirSync, existsSync } from 'fs'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)

// ---------------------------------------------------------------------------
// Bootstrap: open the real encrypted DB and install it as the singleton
// ---------------------------------------------------------------------------

const ELECTRON_DB_PATH = join(
  os.homedir(),
  'Library',
  'Application Support',
  'psygil-app',
  'psygil.db',
)

async function bootstrap(): Promise<void> {
  // Stub out Electron's `app` module so workspace/index.ts can resolve config path.
  // ELECTRON_RUN_AS_NODE=1 strips Electron APIs but leaves 'electron' importable as undefined.
  const userDataDir = join(
    os.homedir(),
    'Library',
    'Application Support',
    'psygil-app',
  )
  const Module = require('module')
  const originalResolve = Module._resolveFilename
  const originalLoad = Module._load
  Module._load = function (request: string, parent: any, ...rest: any[]): unknown {
    if (request === 'electron') {
      return {
        app: {
          getPath: (name: string) => {
            if (name === 'userData') return userDataDir
            if (name === 'temp') return os.tmpdir()
            if (name === 'home') return os.homedir()
            return os.tmpdir()
          },
          isReady: () => true,
          getAppPath: () => process.cwd(),
        },
        BrowserWindow: class {},
        ipcMain: { handle: () => {}, on: () => {}, emit: () => {} },
        dialog: { showOpenDialog: () => {}, showSaveDialog: () => {} },
        safeStorage: {
          isEncryptionAvailable: () => false,
          encryptString: (s: string) => Buffer.from(s),
          decryptString: (b: Buffer) => b.toString(),
        },
      }
    }
    return originalLoad.call(this, request, parent, ...rest)
  }

  // Call the real initDb() — since Electron is stubbed above, getDefaultDbPath()
  // will use our stub's userData path which IS the real Electron DB path.
  const { initDb } = await import('../src/main/db/connection')
  await initDb()
}

async function main(): Promise<void> {
  const manifestId = process.argv[2] ?? 'cst-riggins-001'

  console.log(`[harness] Bootstrapping DB at: ${ELECTRON_DB_PATH}`)
  await bootstrap()
  console.log('[harness] DB ready, loading manifest...')

  const { runManifestById, listManifests } = await import('../src/main/test-harness/index')

  console.log('[harness] Available manifests:')
  for (const m of listManifests()) {
    console.log(`  - ${m.id}: ${m.name} (${m.stepCount} steps)`)
  }

  console.log(`[harness] Running: ${manifestId}`)
  const result = await runManifestById(manifestId)

  console.log('\n========================================')
  console.log(`FINAL: ${result.passed}/${result.totalSteps} passed, ${result.failed} failed`)
  console.log(`Duration: ${result.durationMs}ms`)
  console.log('========================================\n')

  if (result.failed > 0) {
    console.log('FAILED STEPS:')
    for (const s of result.steps) {
      if (!s.success) {
        console.log(`  [${s.stepIndex}] ${s.description}`)
        console.log(`      -> ${s.error}`)
      }
    }
    process.exit(1)
  }

  process.exit(0)
}

main().catch((err) => {
  console.error('[harness] Fatal error:', err)
  process.exit(2)
})
