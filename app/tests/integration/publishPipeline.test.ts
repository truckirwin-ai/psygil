/**
 * Integration test: publishing a final report.
 *   - all gates pass
 *   - DOCX and PDF written to Reports/final
 *   - SHA-256 hashes recorded in audit_log
 *   - prior drafts moved to Archive
 *   - files are read-only after publish
 */

import { describe, it, expect } from 'vitest'
import { buildSeedCase } from '../harness/buildSeedCase'

describe.todo('report:publish pipeline', () => {
  it('rejects publish when gates incomplete', async () => {
    const { caseId, cleanup } = await buildSeedCase({ stageIndex: 4, gate2Approved: false })
    try {
      // const res = await invoke('report:publish', { caseId })
      // expect(res.status).toBe('error')
      // expect(res.message).toMatch(/gate/i)
    } finally { cleanup() }
  })

  it('writes read-only DOCX and PDF on success', async () => {
    const { caseId, cleanup } = await buildSeedCase({ stageIndex: 4, gate2Approved: true, attested: true })
    try {
      // const res = await invoke('report:publish', { caseId })
      // expect(res.status).toBe('ok')
      // const docx = statSync(res.data.docxPath)
      // expect(docx.mode & 0o200).toBe(0) // owner write bit cleared
    } finally { cleanup() }
  })

  it('records SHA-256 in audit_log', async () => {
    // after publish, select latest audit_log row where action='report_published'
    // expect(row.metadata.docx_sha256).toMatch(/^[a-f0-9]{64}$/)
  })

  it('scans published content for HARD RULE violations', async () => {
    // inject U+2014 into a notes field, attempt publish, expect failure
  })
})
