/**
 * Data Confirmation Persistence Module
 *
 * Provides functions to save and retrieve data confirmation state for cases.
 * The data_confirmation table tracks which data categories have been reviewed
 * and confirmed by the clinician, blocking stage advancement until required
 * categories are marked complete.
 */

import { getSqlite } from './db/connection'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DataConfirmationRow {
  readonly id: number
  readonly case_id: number
  readonly category_id: string
  readonly status: 'unreviewed' | 'confirmed' | 'corrected' | 'flagged'
  readonly notes: string
  readonly updated_at: string
}

// ---------------------------------------------------------------------------
// Initialization: Create table if not exists
// ---------------------------------------------------------------------------

function ensureTable(): void {
  const sqlite = getSqlite()
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS data_confirmation (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id INTEGER NOT NULL REFERENCES cases(case_id),
      category_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('unreviewed', 'confirmed', 'corrected', 'flagged')),
      notes TEXT DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(case_id, category_id)
    )
  `)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Save or update data confirmation state for a category.
 *
 * @param caseId - The case ID
 * @param categoryId - The data category ID (e.g., 'demographics', 'referral_questions')
 * @param status - Confirmation status ('unreviewed', 'confirmed', 'corrected', 'flagged')
 * @param notes - Optional clinician notes
 */
export function saveDataConfirmation(
  caseId: number,
  categoryId: string,
  status: string,
  notes: string = ''
): void {
  ensureTable()
  const sqlite = getSqlite()
  const now = new Date().toISOString()

  // Validate status
  const validStatuses = ['unreviewed', 'confirmed', 'corrected', 'flagged']
  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid confirmation status: ${status}`)
  }

  sqlite
    .prepare(
      `INSERT INTO data_confirmation (case_id, category_id, status, notes, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(case_id, category_id) DO UPDATE SET
         status = excluded.status,
         notes = excluded.notes,
         updated_at = excluded.updated_at`,
    )
    .run(caseId, categoryId, status, notes, now)
}

/**
 * Get all data confirmation states for a case.
 *
 * @param caseId - The case ID
 * @returns Array of confirmation rows for all categories in the case
 */
export function getDataConfirmation(caseId: number): readonly DataConfirmationRow[] {
  ensureTable()
  const sqlite = getSqlite()

  const rows = sqlite
    .prepare(
      `SELECT id, case_id, category_id, status, notes, updated_at
       FROM data_confirmation
       WHERE case_id = ?
       ORDER BY updated_at DESC`,
    )
    .all(caseId) as DataConfirmationRow[]

  return rows
}

/**
 * Check if data confirmation is complete for a case.
 *
 * Returns true if both required categories ('demographics' and 'referral_questions')
 * have status 'confirmed' or 'corrected'.
 *
 * This is the gate check that blocks advancement from Onboarding → Testing.
 *
 * @param caseId - The case ID
 * @returns True if completion is satisfied, false otherwise
 */
export function isDataConfirmationComplete(caseId: number): boolean {
  ensureTable()
  const sqlite = getSqlite()

  // Check for the two required categories
  const requiredCategories = ['demographics', 'referral_questions']
  const confirmationStates = getDataConfirmation(caseId)

  // Build a map of category_id → status for quick lookup
  const stateMap = new Map<string, string>()
  for (const row of confirmationStates) {
    stateMap.set(row.category_id, row.status)
  }

  // All required categories must be either 'confirmed' or 'corrected'
  for (const catId of requiredCategories) {
    const status = stateMap.get(catId)
    if (status !== 'confirmed' && status !== 'corrected') {
      return false
    }
  }

  return true
}
