/**
 * Ephemeral workspace builder for integration and unit tests.
 *
 * Creates a tmp folder under os.tmpdir(), provisions the expected
 * workspace subdirectory layout (cases/, Archive/, _Resources/), and
 * returns a cleanup handle. Every test that touches the filesystem should
 * use this rather than hardcoding paths.
 *
 * If opts.seed is true the function also creates a minimal SQLite DB file
 * at dbPath so callers that need a pre-migrated schema can wire in the
 * migration manifest. The actual migration is left as a TODO placeholder
 * because the main-process DB modules are not importable from the test
 * environment without a full Electron mock; mark integration tests that
 * need it with describe.todo() and wire them in Phase F.2.
 */

import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

export interface TmpWorkspace {
  /** Absolute path to the workspace root. */
  readonly path: string
  /** Path to the SQLCipher / SQLite file inside the workspace. */
  readonly dbPath: string
  /** Removes the entire workspace tree. Safe to call multiple times. */
  readonly cleanup: () => void
}

export interface TmpWorkspaceOptions {
  /** When true, creates an empty DB file at dbPath (schema migration is a Phase F.2 TODO). */
  readonly seed?: boolean
}

export function createTmpWorkspace(opts?: TmpWorkspaceOptions): TmpWorkspace {
  const path = mkdtempSync(join(tmpdir(), 'psygil-test-'))

  // Provision the expected top-level workspace layout.
  mkdirSync(join(path, 'cases'), { recursive: true })
  mkdirSync(join(path, 'Archive'), { recursive: true })
  mkdirSync(join(path, '_Resources'), { recursive: true })

  const dbPath = join(path, 'psygil.db')

  if (opts?.seed) {
    // Create an empty file as a placeholder. Wiring the migration manifest
    // against this DB requires importing main-process modules (which need a
    // full Electron mock). That wiring lands in Phase F.2 integration tests.
    writeFileSync(dbPath, '')
  }

  const cleanup = (): void => {
    if (existsSync(path)) {
      try {
        rmSync(path, { recursive: true, force: true })
      } catch {
        // Non-fatal: the OS may clean up the tmp dir on its own.
      }
    }
  }

  return { path, dbPath, cleanup }
}

// ---------------------------------------------------------------------------
// Legacy alias for files written before the rename (caseCreate.test.ts, etc.)
// ---------------------------------------------------------------------------

/** @deprecated Use createTmpWorkspace instead. */
export function makeTmpWorkspace(): TmpWorkspace {
  return createTmpWorkspace()
}
