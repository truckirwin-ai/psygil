/**
 * Integration test: chokidar watcher reconciles external filesystem changes.
 */

import { describe, it, expect } from 'vitest'
import { mkdirSync, renameSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { makeTmpWorkspace } from '../harness/tmpWorkspace'

describe.todo('workspace file watcher', () => {
  it('adds DB row when a new case folder appears on disk', async () => {
    const ws = makeTmpWorkspace()
    try {
      const casesDir = join(ws.path, 'cases')
      mkdirSync(casesDir, { recursive: true })
      mkdirSync(join(casesDir, '2026-0042 Smith, John'))
      // wait debounce, then assert DB
      // expect(await cases.count()).toBe(1)
    } finally { ws.cleanup() }
  })

  it('updates case_number when folder is renamed externally', async () => {
    // rename folder, assert DB.case_number == new value
  })

  it('marks case as orphaned when folder is deleted externally', async () => {
    // rm folder, assert DB row flagged orphan (policy TBD, see WF-3.9)
  })

  it('debounces rapid events to avoid duplicate document rows', async () => {
    // write same file 20x in 100ms, assert exactly 1 document row
  })
})
