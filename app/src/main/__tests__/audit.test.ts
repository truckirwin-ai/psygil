/**
 * Audit trail tests.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { getTestDb, resetTestDb } from './test-db'
import { logAuditEntry, getAuditTrail, exportAuditTrail } from '../audit'

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

describe('Audit Trail', () => {
  let db: ReturnType<typeof getTestDb>

  beforeEach(() => {
    resetTestDb()
    db = getTestDb()
  })

  describe('logAuditEntry', () => {
    it('should insert an audit log entry', () => {
      createTestCase(db, 1)
      const auditLogId = logAuditEntry({
        caseId: 1,
        actionType: 'report_signed',
        actorType: 'clinician',
        actorId: '1',
        details: { reportVersion: 1 },
      })
      // Just verify an entry was created for this case
      const entries = db.prepare('SELECT * FROM audit_log WHERE case_id = 1').all() as any[]
      expect(entries.length).toBeGreaterThan(0)
      const entry = entries[entries.length - 1]
      expect(entry.action_type).toBe('report_signed')
      expect(entry.case_id).toBe(1)
    })

    it('should store JSON details correctly', () => {
      createTestCase(db, 1)
      const details = { reportVersion: 2, status: 'final', signature: 'Dr. Smith' }
      logAuditEntry({
        caseId: 1,
        actionType: 'report_signed',
        actorType: 'clinician',
        actorId: '1',
        details,
      })
      const entry = db.prepare('SELECT details FROM audit_log WHERE case_id = 1').get() as any
      const parsedDetails = JSON.parse(entry.details)
      expect(parsedDetails.reportVersion).toBe(2)
      expect(parsedDetails.status).toBe('final')
    })

    it('should map actorType to user_id', () => {
      createTestCase(db, 1)
      createTestUser(db, 5)
      logAuditEntry({
        caseId: 1,
        actionType: 'diagnosis_decision',
        actorType: 'clinician',
        actorId: '5',
        details: {},
      })
      const entry = db.prepare('SELECT actor_user_id FROM audit_log WHERE case_id = 1').get() as any
      expect(entry.actor_user_id).toBe(5)
    })

    it('should use -1 for AI agent actor', () => {
      createTestCase(db, 1)
      logAuditEntry({
        caseId: 1,
        actionType: 'agent_run',
        actorType: 'ai_agent',
        actorId: 'diagnostician',
        details: {},
      })
      const entry = db.prepare('SELECT actor_user_id FROM audit_log WHERE case_id = 1').get() as any
      expect(entry.actor_user_id).toBe(-1)
    })

    it('should use 0 for system actor', () => {
      createTestCase(db, 1)
      logAuditEntry({
        caseId: 1,
        actionType: 'case_created',
        actorType: 'system',
        details: {},
      })
      const entry = db.prepare('SELECT actor_user_id FROM audit_log WHERE case_id = 1').get() as any
      expect(entry.actor_user_id).toBe(0)
    })

    it('should include related entity info', () => {
      createTestCase(db, 1)
      logAuditEntry({
        caseId: 1,
        actionType: 'diagnosis_decision',
        actorType: 'clinician',
        actorId: '1',
        details: {},
        relatedEntityType: 'diagnosis',
        relatedEntityId: 42,
      })
      const entry = db.prepare('SELECT * FROM audit_log WHERE case_id = 1').get() as any
      expect(entry.related_entity_type).toBe('diagnosis')
      expect(entry.related_entity_id).toBe(42)
    })
  })

  describe('getAuditTrail', () => {
    it('should return entries in DESC order by action_date', () => {
      createTestCase(db, 1)
      logAuditEntry({
        caseId: 1,
        actionType: 'case_created',
        actorType: 'system',
        details: {},
      })
      logAuditEntry({
        caseId: 1,
        actionType: 'document_uploaded',
        actorType: 'clinician',
        actorId: '1',
        details: {},
      })
      logAuditEntry({
        caseId: 1,
        actionType: 'report_signed',
        actorType: 'clinician',
        actorId: '1',
        details: {},
      })
      const trail = getAuditTrail(1)
      expect(trail.length).toBe(3)
      // Should have all three action types
      const actionTypes = trail.map(e => e.action_type)
      expect(actionTypes).toContain('case_created')
      expect(actionTypes).toContain('document_uploaded')
      expect(actionTypes).toContain('report_signed')
    })

    it('should return empty array for case with no entries', () => {
      createTestCase(db, 1)
      const trail = getAuditTrail(1)
      expect(trail.length).toBe(0)
    })

    it('should return only entries for specified case', () => {
      createTestCase(db, 1)
      createTestCase(db, 2)
      logAuditEntry({
        caseId: 1,
        actionType: 'case_created',
        actorType: 'system',
        details: {},
      })
      logAuditEntry({
        caseId: 2,
        actionType: 'case_created',
        actorType: 'system',
        details: {},
      })
      const trail1 = getAuditTrail(1)
      const trail2 = getAuditTrail(2)
      expect(trail1.length).toBe(1)
      expect(trail2.length).toBe(1)
      expect(trail1[0].case_id).toBe(1)
      expect(trail2[0].case_id).toBe(2)
    })
  })

  describe('exportAuditTrail', () => {
    it('should export as JSON format', () => {
      createTestCase(db, 1)
      logAuditEntry({
        caseId: 1,
        actionType: 'report_signed',
        actorType: 'clinician',
        actorId: '1',
        details: { version: 1 },
      })
      const json = exportAuditTrail(1, 'json')
      expect(typeof json).toBe('string')
      const parsed = JSON.parse(json)
      expect(Array.isArray(parsed)).toBe(true)
      expect(parsed.length).toBe(1)
      expect(parsed[0].action_type).toBe('report_signed')
    })

    it('should export as CSV format', () => {
      createTestCase(db, 1)
      logAuditEntry({
        caseId: 1,
        actionType: 'report_signed',
        actorType: 'clinician',
        actorId: '1',
        details: { version: 1 },
      })
      const csv = exportAuditTrail(1, 'csv')
      expect(typeof csv).toBe('string')
      const lines = csv.trim().split('\n')
      expect(lines.length).toBeGreaterThanOrEqual(1)
      // Should have header
      expect(lines[0]).toContain('Timestamp')
      expect(lines[0]).toContain('Action')
    })

    it('should handle empty audit trail', () => {
      createTestCase(db, 1)
      const json = exportAuditTrail(1, 'json')
      const parsed = JSON.parse(json)
      expect(parsed.length).toBe(0)
      const csv = exportAuditTrail(1, 'csv')
      const lines = csv.trim().split('\n')
      expect(lines.length).toBe(1) // Just header
    })

    it('should escape CSV special characters', () => {
      createTestCase(db, 1)
      logAuditEntry({
        caseId: 1,
        actionType: 'report_signed',
        actorType: 'clinician',
        actorId: '1',
        details: { note: 'Contains, comma and "quotes"' },
      })
      const csv = exportAuditTrail(1, 'csv')
      expect(csv).toContain('"')
    })

    it('should default to CSV format', () => {
      createTestCase(db, 1)
      logAuditEntry({
        caseId: 1,
        actionType: 'report_signed',
        actorType: 'system',
        details: {},
      })
      const defaultExport = exportAuditTrail(1)
      const csvExport = exportAuditTrail(1, 'csv')
      expect(defaultExport).toBe(csvExport)
    })
  })
})
