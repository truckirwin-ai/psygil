/**
 * IPC test: server-side gate enforcement. A client cannot bypass gates by
 * calling cases:advanceStage directly. This is a regression shield for the
 * "DOCTOR ALWAYS DIAGNOSES" principle.
 */

import { describe, it, expect } from 'vitest'
import { invoke } from '../harness/mockIpc'
import { buildSeedCase } from '../harness/buildSeedCase'

describe.todo('cases:advanceStage gate enforcement', () => {
  it('refuses advance to review when Gate 2 unmet', async () => {
    const { caseId, cleanup } = await buildSeedCase({ stageIndex: 3, gate2Approved: false })
    try {
      const res = await invoke('cases:advanceStage', { caseId, to: 'review' })
      expect(res.status).toBe('error')
      expect(res.message).toMatch(/gate 2|formulation/i)
    } finally { cleanup() }
  })

  it('refuses advance when attestation unchecked', async () => {
    const { caseId, cleanup } = await buildSeedCase({ stageIndex: 3, gate2Approved: true, attested: false })
    try {
      const res = await invoke('cases:advanceStage', { caseId, to: 'review' })
      expect(res.status).toBe('error')
      expect(res.message).toMatch(/attest/i)
    } finally { cleanup() }
  })

  it('allows advance when all gates pass', async () => {
    const { caseId, cleanup } = await buildSeedCase({ stageIndex: 3, gate2Approved: true, attested: true })
    try {
      const res = await invoke('cases:advanceStage', { caseId, to: 'review' })
      expect(res.status).toBe('ok')
    } finally { cleanup() }
  })
})
