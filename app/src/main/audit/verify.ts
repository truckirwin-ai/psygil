/**
 * Audit chain verification.
 *
 * Walks the audit_log oldest-to-newest and re-computes each row's expected
 * row_hash from its stored fields plus its stored prev_hash. A mismatch
 * indicates tampering.
 *
 * Optional caseId restricts the walk to one case. Without it, all rows are
 * verified in global insertion order (audit_log_id ASC).
 */

import { getSqlite } from '../db/connection'
import { computeRowHash, type HashableFields } from './index'

// ============================================================================
// Types
// ============================================================================

export interface VerifyChainResult {
  readonly valid: boolean
  readonly brokenAtId: number | null
  readonly totalRows: number
}

/** Minimal shape read back from the DB for verification. */
export interface AuditLogVerifyRow {
  readonly audit_log_id: number
  readonly case_id: number
  readonly action_type: string
  readonly actor_user_id: number
  readonly action_date: string
  readonly details: string | null
  readonly related_entity_type: string | null
  readonly related_entity_id: number | null
  readonly granularity: string
  readonly prev_hash: string | null
  readonly row_hash: string | null
}

// ============================================================================
// Pure chain walker (exported for testing)
// ============================================================================

/**
 * Walks an ordered array of audit log rows (oldest first) and verifies the
 * SHA-256 hash chain. Rows with null row_hash are skipped (pre-migration rows).
 *
 * Exported as a named function so tests can pass a fixture array without
 * requiring a database connection.
 */
export function walkChain(rows: readonly AuditLogVerifyRow[]): VerifyChainResult {
  for (const row of rows) {
    if (row.row_hash === null) continue

    const fields: HashableFields = {
      case_id: row.case_id,
      action_type: row.action_type,
      actor_user_id: row.actor_user_id,
      action_date: row.action_date,
      details: row.details,
      related_entity_type: row.related_entity_type,
      related_entity_id: row.related_entity_id,
      granularity: row.granularity,
      prev_hash: row.prev_hash,
    }

    const expectedHash = computeRowHash(fields)

    if (expectedHash !== row.row_hash) {
      return { valid: false, brokenAtId: row.audit_log_id, totalRows: rows.length }
    }
  }

  return { valid: true, brokenAtId: null, totalRows: rows.length }
}

// ============================================================================
// Public API: verifyChain
// ============================================================================

/**
 * Verify the SHA-256 hash chain for audit_log rows.
 *
 * For each row, re-computes expected_hash = computeRowHash(storedFields)
 * and compares it to the stored row_hash. Returns on first mismatch.
 *
 * Rows that have a NULL row_hash (pre-migration rows) are skipped: they
 * were written before tamper protection was active and cannot be verified.
 *
 * Parameters:
 *   caseId - if provided, only rows for that case are verified.
 *            if omitted, all rows in the table are verified.
 */
export function verifyChain(caseId?: number): VerifyChainResult {
  const sqlite = getSqlite()

  const query =
    caseId !== undefined
      ? `SELECT audit_log_id, case_id, action_type, actor_user_id, action_date, details,
                related_entity_type, related_entity_id, granularity, prev_hash, row_hash
         FROM audit_log
         WHERE case_id = ?
         ORDER BY audit_log_id ASC`
      : `SELECT audit_log_id, case_id, action_type, actor_user_id, action_date, details,
                related_entity_type, related_entity_id, granularity, prev_hash, row_hash
         FROM audit_log
         ORDER BY audit_log_id ASC`

  const rows =
    caseId !== undefined
      ? (sqlite.prepare(query).all(caseId) as AuditLogVerifyRow[])
      : (sqlite.prepare(query).all() as AuditLogVerifyRow[])

  return walkChain(rows)
}
