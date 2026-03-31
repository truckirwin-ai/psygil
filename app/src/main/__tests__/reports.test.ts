/**
 * Report finalization tests.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { getTestDb, resetTestDb } from './test-db'
import { getReportStatus, verifyIntegrity } from '../reports'

/**
 * Helper to create test user
 */
function createTestUser(db: ReturnType<typeof getTestDb>, userId = 1): number {
  if (!db.prepare('SELECT user_id FROM users WHERE user_id = ?').get(userId)) {
    db.prepare(
      'INSERT INTO users (user_id, email, full_name, role, is_active) VALUES (?, ?, ?, ?, ?)',
    ).run(userId, `user${userId}@test.com`, `Test User ${userId}`, 'psychologist', 1)
  }
  return userId
}

/**
 * Helper to create test case
 */
function createTestCase(db: ReturnType<typeof getTestDb>, caseId = 1): number {
  const userId = createTestUser(db, 1)
  db.prepare(
    `INSERT INTO cases
     (case_id, case_number, primary_clinician_user_id, examinee_first_name, examinee_last_name, case_status)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(caseId, `CASE-${caseId}`, userId, 'John', 'Doe', 'in_progress')
  return caseId
}

/**
 * Helper to create a report
 */
function createReport(
  db: ReturnType<typeof getTestDb>,
  caseId: number,
  reportId = 1,
  status = 'draft',
): number {
  const userId = createTestUser(db, 1)
  db.prepare(
    `INSERT INTO reports
     (report_id, case_id, generated_by_user_id, file_path, status)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(reportId, caseId, userId, '/tmp/report.docx', status)
  return reportId
}

describe('Report Status', () => {
  let db: ReturnType<typeof getTestDb>

  beforeEach(() => {
    resetTestDb()
    db = getTestDb()
  })

  describe('getReportStatus', () => {
    it('should return no report for fresh case', () => {
      createTestCase(db, 1)
      const status = getReportStatus(1)
      expect(status.hasReport).toBe(false)
      expect(status.status).toBeNull()
    })

    it('should return report data after insertion', () => {
      createTestCase(db, 1)
      createReport(db, 1, 1, 'draft')
      const status = getReportStatus(1)
      expect(status.hasReport).toBe(true)
      expect(status.status).toBe('draft')
    })

    it('should return latest report version', () => {
      createTestCase(db, 1)
      createReport(db, 1, 1, 'draft')
      const userId = createTestUser(db, 1)
      // Insert second report with higher report_id (sql.js may use insertion order)
      db.prepare(
        `INSERT INTO reports
         (report_id, case_id, generated_by_user_id, file_path, status, report_version, created_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now', '+1 second'))`,
      ).run(2, 1, userId, '/tmp/report-v2.docx', 'in_review', 2)
      const status = getReportStatus(1)
      // The function should return the one with highest report_version or latest created_at
      expect(status.version).toBe(2)
    })

    it('should return locked status', () => {
      createTestCase(db, 1)
      const userId = createTestUser(db, 1)
      db.prepare(
        `INSERT INTO reports
         (report_id, case_id, generated_by_user_id, file_path, status, is_locked)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(1, 1, userId, '/tmp/report.docx', 'approved', 1)
      const status = getReportStatus(1)
      expect(status.isLocked).toBe(true)
    })

    it('should return integrity hash', () => {
      createTestCase(db, 1)
      const userId = createTestUser(db, 1)
      const hash = 'abc123def456'
      db.prepare(
        `INSERT INTO reports
         (report_id, case_id, generated_by_user_id, file_path, status, integrity_hash)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(1, 1, userId, '/tmp/report.docx', 'finalized', hash)
      const status = getReportStatus(1)
      expect(status.integrityHash).toBe(hash)
    })

    it('should return PDF and DOCX paths', () => {
      createTestCase(db, 1)
      const userId = createTestUser(db, 1)
      db.prepare(
        `INSERT INTO reports
         (report_id, case_id, generated_by_user_id, file_path, status, sealed_pdf_path)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(1, 1, userId, '/tmp/report.docx', 'finalized', '/tmp/report.pdf')
      const status = getReportStatus(1)
      expect(status.docxPath).toBe('/tmp/report.docx')
      expect(status.pdfPath).toBe('/tmp/report.pdf')
    })
  })

  describe('verifyIntegrity', () => {
    it('should handle missing report', () => {
      createTestCase(db, 1)
      const verification = verifyIntegrity(1)
      expect(verification.valid).toBe(false)
      expect(verification.storedHash).toBeNull()
    })
  })

  describe('Report status transitions', () => {
    it('should track draft -> in_review -> approved -> finalized', () => {
      createTestCase(db, 1)
      const userId = createTestUser(db, 1)

      // Draft
      db.prepare(
        `INSERT INTO reports
         (report_id, case_id, generated_by_user_id, file_path, status)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(1, 1, userId, '/tmp/report.docx', 'draft')
      let status = getReportStatus(1)
      expect(status.status).toBe('draft')

      // In review
      db.prepare('UPDATE reports SET status = ? WHERE case_id = ?').run('in_review', 1)
      status = getReportStatus(1)
      expect(status.status).toBe('in_review')

      // Approved
      db.prepare('UPDATE reports SET status = ? WHERE case_id = ?').run('approved', 1)
      status = getReportStatus(1)
      expect(status.status).toBe('approved')

      // Finalized
      db.prepare('UPDATE reports SET status = ?, is_locked = ? WHERE case_id = ?').run('finalized', 1, 1)
      status = getReportStatus(1)
      expect(status.status).toBe('finalized')
      expect(status.isLocked).toBe(true)
    })

    it('should handle revisions_needed status', () => {
      createTestCase(db, 1)
      const userId = createTestUser(db, 1)
      db.prepare(
        `INSERT INTO reports
         (report_id, case_id, generated_by_user_id, file_path, status)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(1, 1, userId, '/tmp/report.docx', 'revisions_needed')
      const status = getReportStatus(1)
      expect(status.status).toBe('revisions_needed')
    })
  })

  describe('Report versions', () => {
    it('should distinguish between report versions', () => {
      createTestCase(db, 1)
      const userId = createTestUser(db, 1)

      // V1
      db.prepare(
        `INSERT INTO reports
         (report_id, case_id, generated_by_user_id, file_path, status, report_version, created_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      ).run(1, 1, userId, '/tmp/report-v1.docx', 'draft', 1)

      // V2 - ensure it's created after V1
      db.prepare(
        `INSERT INTO reports
         (report_id, case_id, generated_by_user_id, file_path, status, report_version, created_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now', '+1 second'))`,
      ).run(2, 1, userId, '/tmp/report-v2.docx', 'approved', 2)

      const status = getReportStatus(1)
      // Should return the one with highest report_version
      expect(status.version).toBe(2)
    })
  })
})
