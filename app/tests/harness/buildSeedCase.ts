/**
 * Builds a seeded case at a given stage index with configurable gate state.
 * Returns case id and a cleanup handle. Used by ipc and integration tests.
 */

import { makeTmpWorkspace, type TmpWorkspace } from './tmpWorkspace'

export interface SeedOptions {
  readonly stageIndex?: 0 | 1 | 2 | 3 | 4 | 5
  readonly gate1TestingComplete?: boolean
  readonly gate2Approved?: boolean
  readonly attested?: boolean
}

export interface SeededCase {
  readonly workspace: TmpWorkspace
  readonly caseId: number
  readonly caseNumber: string
  readonly cleanup: () => void
}

export async function buildSeedCase(opts: SeedOptions = {}): Promise<SeededCase> {
  const workspace = makeTmpWorkspace()

  // TODO wire once main/db/connection and main/cases are importable from tests.
  // const { initDb } = await import('@/main/db/connection')
  // const { setWorkspacePath } = await import('@/main/workspace')
  // const { createCase } = await import('@/main/cases')
  // setWorkspacePath(workspace.path)
  // await initDb()
  // const c = await createCase({ lastName: 'Test', firstName: 'Case', dob: '1990-01-01' })
  // await advanceTo(c.case_id, opts.stageIndex ?? 0)

  return {
    workspace,
    caseId: 1,
    caseNumber: '2026-9999',
    cleanup: workspace.cleanup,
  }
}
