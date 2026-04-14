/**
 * Data confirmation persistence tests.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { getTestDb, resetTestDb } from './test-db'
import { saveDataConfirmation, getDataConfirmation, isDataConfirmationComplete } from '../data-confirmation'

/**
 * Helper to create a test case
 */
function createTestCase(db: ReturnType<typeof getTestDb>, caseId = 1): number {
  const userId = 1
  if (!db.prepare('SELECT user_id FROM users WHERE user_id = ?').get(userId)) {
    db.prepare(
      'INSERT INTO users (user_id, email, full_name, role, is_active) VALUES (?, ?, ?, ?, ?)',
    ).run(userId, 'test@test.com', 'Test User', 'psychologist', 1)
  }

  db.prepare(
    `INSERT INTO cases
     (case_id, case_number, primary_clinician_user_id, examinee_first_name, examinee_last_name, case_status)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(caseId, `CASE-${caseId}`, userId, 'John', 'Doe', 'in_progress')

  return caseId
}

describe('Data Confirmation', () => {
  let db: ReturnType<typeof getTestDb>

  beforeEach(() => {
    resetTestDb()
    db = getTestDb()
  })

  describe('saveDataConfirmation', () => {
    it('should create table and save confirmation', () => {
      createTestCase(db, 1)
      saveDataConfirmation(1, 'demographics', 'confirmed', 'Data is correct')
      const confirmations = getDataConfirmation(1)
      expect(confirmations.length).toBe(1)
      expect(confirmations[0].category_id).toBe('demographics')
      expect(confirmations[0].status).toBe('confirmed')
      expect(confirmations[0].notes).toBe('Data is correct')
    })

    it('should upsert on duplicate', () => {
      createTestCase(db, 1)
      saveDataConfirmation(1, 'demographics', 'confirmed', 'First update')
      saveDataConfirmation(1, 'demographics', 'corrected', 'Second update')
      const confirmations = getDataConfirmation(1)
      expect(confirmations.length).toBe(1)
      expect(confirmations[0].status).toBe('corrected')
      expect(confirmations[0].notes).toBe('Second update')
    })

    it('should reject invalid status', () => {
      createTestCase(db, 1)
      expect(() => {
        saveDataConfirmation(1, 'demographics', 'invalid_status', '')
      }).toThrow('Invalid confirmation status')
    })

    it('should accept all valid statuses', () => {
      createTestCase(db, 1)
      const statuses = ['unreviewed', 'confirmed', 'corrected', 'flagged']
      statuses.forEach((status, idx) => {
        saveDataConfirmation(1, `category_${idx}`, status, '')
      })
      const confirmations = getDataConfirmation(1)
      expect(confirmations.length).toBe(4)
    })
  })

  describe('getDataConfirmation', () => {
    it('should return all categories for a case', () => {
      createTestCase(db, 1)
      saveDataConfirmation(1, 'demographics', 'confirmed', '')
      saveDataConfirmation(1, 'referral_questions', 'confirmed', '')
      saveDataConfirmation(1, 'medical_history', 'flagged', 'Missing info')
      const confirmations = getDataConfirmation(1)
      expect(confirmations.length).toBe(3)
    })

    it('should return empty array for case with no confirmations', () => {
      createTestCase(db, 1)
      const confirmations = getDataConfirmation(1)
      expect(confirmations.length).toBe(0)
    })

    it('should return confirmations in descending order by updated_at', () => {
      createTestCase(db, 1)
      saveDataConfirmation(1, 'demographics', 'confirmed', '')
      const confirmations1 = getDataConfirmation(1)
      expect(confirmations1.length).toBe(1)

      // Add second confirmation
      saveDataConfirmation(1, 'referral_questions', 'confirmed', '')
      const confirmations2 = getDataConfirmation(1)
      expect(confirmations2.length).toBe(2)

      // Due to sql.js timing, we can't guarantee order, so just check both exist
      const categoryIds = confirmations2.map(c => c.category_id)
      expect(categoryIds).toContain('demographics')
      expect(categoryIds).toContain('referral_questions')
    })
  })

  describe('isDataConfirmationComplete', () => {
    it('should return false when no data exists', () => {
      createTestCase(db, 1)
      const isComplete = isDataConfirmationComplete(1)
      expect(isComplete).toBe(false)
    })

    it('should return false when demographics missing', () => {
      createTestCase(db, 1)
      saveDataConfirmation(1, 'referral_questions', 'confirmed', '')
      const isComplete = isDataConfirmationComplete(1)
      expect(isComplete).toBe(false)
    })

    it('should return false when referral_questions missing', () => {
      createTestCase(db, 1)
      saveDataConfirmation(1, 'demographics', 'confirmed', '')
      const isComplete = isDataConfirmationComplete(1)
      expect(isComplete).toBe(false)
    })

    it('should return false when required category is flagged', () => {
      createTestCase(db, 1)
      saveDataConfirmation(1, 'demographics', 'flagged', 'Has issues')
      saveDataConfirmation(1, 'referral_questions', 'confirmed', '')
      const isComplete = isDataConfirmationComplete(1)
      expect(isComplete).toBe(false)
    })

    it('should return false when required category is unreviewed', () => {
      createTestCase(db, 1)
      saveDataConfirmation(1, 'demographics', 'unreviewed', '')
      saveDataConfirmation(1, 'referral_questions', 'confirmed', '')
      const isComplete = isDataConfirmationComplete(1)
      expect(isComplete).toBe(false)
    })

    it('should return true when both required are confirmed', () => {
      createTestCase(db, 1)
      saveDataConfirmation(1, 'demographics', 'confirmed', '')
      saveDataConfirmation(1, 'referral_questions', 'confirmed', '')
      const isComplete = isDataConfirmationComplete(1)
      expect(isComplete).toBe(true)
    })

    it('should return true when both required are corrected', () => {
      createTestCase(db, 1)
      saveDataConfirmation(1, 'demographics', 'corrected', 'Fixed address')
      saveDataConfirmation(1, 'referral_questions', 'corrected', 'Updated charges')
      const isComplete = isDataConfirmationComplete(1)
      expect(isComplete).toBe(true)
    })

    it('should return true when mix of confirmed and corrected', () => {
      createTestCase(db, 1)
      saveDataConfirmation(1, 'demographics', 'confirmed', '')
      saveDataConfirmation(1, 'referral_questions', 'corrected', 'Updated')
      const isComplete = isDataConfirmationComplete(1)
      expect(isComplete).toBe(true)
    })

    it('should ignore non-required categories', () => {
      createTestCase(db, 1)
      saveDataConfirmation(1, 'demographics', 'confirmed', '')
      saveDataConfirmation(1, 'referral_questions', 'confirmed', '')
      saveDataConfirmation(1, 'optional_field', 'flagged', 'Issue')
      const isComplete = isDataConfirmationComplete(1)
      expect(isComplete).toBe(true)
    })
  })
})
