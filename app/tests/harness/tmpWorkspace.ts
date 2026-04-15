/**
 * Ephemeral workspace builder for integration tests.
 * Creates a tmp folder, initializes a SQLCipher DB inside it, and returns
 * a cleanup handle. Every test that touches the filesystem should use this.
 */

import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

export interface TmpWorkspace {
  readonly path: string
  readonly cleanup: () => void
}

export function makeTmpWorkspace(): TmpWorkspace {
  const path = mkdtempSync(join(tmpdir(), 'psygil-test-'))
  return {
    path,
    cleanup: () => {
      try {
        rmSync(path, { recursive: true, force: true })
      } catch {
        // non-fatal
      }
    },
  }
}
