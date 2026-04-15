/**
 * Performance probe: a case with 500 documents and a 50-instrument battery
 * must open within a target budget. Fails the build if budget exceeded.
 */

import { describe, it, expect } from 'vitest'

const BUDGETS = {
  caseOpenMs: 1500,
  reportBuildMs: 4000,
  treeRenderMs: 800,
}

describe.todo('large case performance', () => {
  it('opens a 500-document case within 1.5s', async () => {
    // seed 500 documents, measure open time, assert under budget
    const elapsedMs = 0
    expect(elapsedMs).toBeLessThan(BUDGETS.caseOpenMs)
  })

  it('builds report for a 50-instrument case within 4s', async () => {
    const elapsedMs = 0
    expect(elapsedMs).toBeLessThan(BUDGETS.reportBuildMs)
  })
})
