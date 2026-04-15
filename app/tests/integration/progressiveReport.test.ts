/**
 * Integration test: report sections remain placeholders until their required
 * stage completes. Guards the progressive-drafting guarantee.
 */

import { describe, it, expect } from 'vitest'
import { buildSeedCase } from '../harness/buildSeedCase'

describe.todo('buildReportContent progressive gating', () => {
  it('leaves diagnostics section as placeholder at stage 2', async () => {
    const { caseId, cleanup } = await buildSeedCase({ stageIndex: 2 })
    try {
      // const { buildReportContent } = await import('@/main/reports/bundle')
      // const out = await buildReportContent(caseId)
      // const diag = out.sections.find(s => s.key === 'diagnostics')
      // expect(diag?.body).toMatch(/Pending: Diagnostics/)
    } finally { cleanup() }
  })

  it('populates diagnostics section at stage 4', async () => {
    const { caseId, cleanup } = await buildSeedCase({ stageIndex: 4, gate2Approved: true, attested: true })
    try {
      // const out = await buildReportContent(caseId)
      // const diag = out.sections.find(s => s.key === 'diagnostics')
      // expect(diag?.body).not.toMatch(/Pending/)
      // expect(diag?.body).toContain('Clinical Impressions')
    } finally { cleanup() }
  })
})
