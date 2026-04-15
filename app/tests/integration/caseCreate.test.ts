/**
 * Integration test: case creation scaffolds the 7 subfolders and stub documents.
 * Scaffolded, implementer must wire actual createCase import once test module
 * resolution is configured (vitest.config.ts paths).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { makeTmpWorkspace, type TmpWorkspace } from '../harness/tmpWorkspace'

const SUBFOLDERS = ['_Inbox', 'Collateral', 'Testing', 'Interviews', 'Diagnostics', 'Reports', 'Archive'] as const

describe.todo('createCase scaffolding', () => {
  let ws: TmpWorkspace

  beforeEach(() => { ws = makeTmpWorkspace() })
  afterEach(() => { ws.cleanup() })

  it('creates all 7 subfolders with README stubs', async () => {
    // const { setWorkspacePath } = await import('@/main/workspace')
    // const { initDb } = await import('@/main/db/connection')
    // const { createCase } = await import('@/main/cases')
    // setWorkspacePath(ws.path)
    // await initDb()
    // const c = await createCase({ lastName: 'Doe', firstName: 'Jane', dob: '1990-01-01' })
    // const folder = join(ws.path, 'cases', `${c.case_number} Doe, Jane`)
    const folder = join(ws.path, 'cases', '2026-0001 Doe, Jane') // placeholder

    for (const sub of SUBFOLDERS) {
      expect(existsSync(join(folder, sub)), `subfolder ${sub}`).toBe(true)
      expect(existsSync(join(folder, sub, 'README.txt')), `README in ${sub}`).toBe(true)
    }

    const diag = readFileSync(join(folder, 'Diagnostics', 'Diagnostic Formulation.txt'), 'utf-8')
    expect(diag).toContain('Clinical Impressions:')
    expect(diag).toContain('Ruled Out:')
    expect(diag).toContain('Validity & Effort:')
    expect(diag).toContain('Prognosis & Recommendations:')
  })

  it('is idempotent, second call does not overwrite stubs', async () => {
    // TODO: call scaffoldCaseSubfolders twice and assert mtime unchanged on the second run.
  })
})
