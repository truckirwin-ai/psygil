/**
 * Audit Trail Module
 *
 * Comprehensive logging of all case actions for litigation defensibility.
 * Every action logged with timestamp, actor, and context for forensic reproducibility.
 *
 * Hash chain: each INSERT computes row_hash = SHA-256(canonical JSON of row fields + prev_hash).
 * prev_hash is the row_hash of the most recent prior row (global order by audit_log_id DESC).
 * If the migration has not yet been applied (columns absent), hash computation is skipped silently.
 */

import { createHash } from 'crypto'
import { getSqlite } from '../db/connection'

// ============================================================================
// Types
// ============================================================================

export interface AuditEntry {
  caseId: number
  actionType: string       // 'report_signed' | 'report_locked' | 'stage_advanced' | 'agent_run' | 'diagnosis_decision' | etc.
  actorType: 'clinician' | 'ai_agent' | 'system'
  actorId?: string
  details: Record<string, unknown>
  relatedEntityType?: string
  relatedEntityId?: number
}

export interface AuditLogRow {
  audit_log_id: number
  case_id: number
  action_type: string
  actor_user_id: number
  action_date: string
  details: string | null
  related_entity_type: string | null
  related_entity_id: number | null
  granularity: string
  prev_hash: string | null
  row_hash: string | null
}

// Fields that enter the hash computation for a given row.
// Changing this set is a breaking change to existing chains.
export interface HashableFields {
  readonly case_id: number
  readonly action_type: string
  readonly actor_user_id: number
  readonly action_date: string
  readonly details: string | null
  readonly related_entity_type: string | null
  readonly related_entity_id: number | null
  readonly granularity: string
  readonly prev_hash: string | null
}

// ============================================================================
// Pure helpers
// ============================================================================

/**
 * Produces a deterministic canonical string for the given fields, then returns
 * the hex-encoded SHA-256 digest.
 *
 * Keys are sorted alphabetically before JSON.stringify so field insertion order
 * does not affect the output.
 */
export function computeRowHash(fields: HashableFields): string {
  const sortedKeys = Object.keys(fields).sort() as Array<keyof HashableFields>
  const canonical: Record<string, unknown> = {}
  for (const k of sortedKeys) {
    canonical[k] = fields[k]
  }
  const payload = JSON.stringify(canonical)
  return createHash('sha256').update(payload, 'utf8').digest('hex')
}

// ============================================================================
// Internal: detect whether the hash chain columns exist
// ============================================================================

function hasHashColumns(sqlite: ReturnType<typeof getSqlite>): boolean {
  const cols = (sqlite.pragma('table_info(audit_log)') as Array<{ name: string }>)
    .map(c => c.name)
  return cols.includes('prev_hash') && cols.includes('row_hash')
}

// ============================================================================
// Public API: logAuditEntry
// ============================================================================

export function logAuditEntry(params: AuditEntry): number {
  const sqlite = getSqlite()

  // Map actorType + actorId to a user_id (for now, use 0 for system)
  let actorUserId = 0
  if (params.actorType === 'clinician' && params.actorId) {
    const parsed = parseInt(params.actorId, 10)
    if (!isNaN(parsed)) {
      actorUserId = parsed
    }
  } else if (params.actorType === 'ai_agent') {
    actorUserId = -1
  }

  const detailsJson = JSON.stringify(params.details)
  const actionDate = new Date().toISOString()
  const relatedEntityType = params.relatedEntityType ?? null
  const relatedEntityId = params.relatedEntityId ?? null

  const hashReady = hasHashColumns(sqlite)

  let auditLogId: number

  if (hashReady) {
    // Run inside a transaction: SELECT last hash, then INSERT with both hashes.
    const tx = sqlite.transaction((): number => {
      const lastRow = sqlite
        .prepare(
          `SELECT row_hash FROM audit_log ORDER BY audit_log_id DESC LIMIT 1`
        )
        .get() as { row_hash: string | null } | undefined

      const prevHash: string | null = lastRow?.row_hash ?? null

      const fields: HashableFields = {
        case_id: params.caseId,
        action_type: params.actionType,
        actor_user_id: actorUserId,
        action_date: actionDate,
        details: detailsJson,
        related_entity_type: relatedEntityType,
        related_entity_id: relatedEntityId,
        granularity: 'decision_record_only',
        prev_hash: prevHash,
      }
      const rowHash = computeRowHash(fields)

      const result = sqlite
        .prepare(
          `INSERT INTO audit_log
           (case_id, action_type, actor_user_id, action_date, details,
            related_entity_type, related_entity_id, granularity, prev_hash, row_hash)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'decision_record_only', ?, ?)`
        )
        .run(
          params.caseId,
          params.actionType,
          actorUserId,
          actionDate,
          detailsJson,
          relatedEntityType,
          relatedEntityId,
          prevHash,
          rowHash,
        ) as { lastInsertRowid?: number }

      return (result.lastInsertRowid ?? 0) as number
    })

    auditLogId = tx()
  } else {
    // Migration not yet applied: fall back to plain insert without hashes.
    const result = sqlite
      .prepare(
        `INSERT INTO audit_log
         (case_id, action_type, actor_user_id, action_date, details,
          related_entity_type, related_entity_id, granularity)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'decision_record_only')`
      )
      .run(
        params.caseId,
        params.actionType,
        actorUserId,
        actionDate,
        detailsJson,
        relatedEntityType,
        relatedEntityId,
      ) as { lastInsertRowid?: number }

    auditLogId = (result.lastInsertRowid ?? 0) as number
  }

  return auditLogId
}

// ============================================================================
// Public API: getAuditTrail
// ============================================================================

export function getAuditTrail(caseId: number): AuditLogRow[] {
  const sqlite = getSqlite()

  // Only select hash columns when the migration has been applied. Tests and
  // older databases run without them and the SELECT would throw otherwise.
  const hashReady = hasHashColumns(sqlite)
  const columns = hashReady
    ? `audit_log_id, case_id, action_type, actor_user_id, action_date, details,
       related_entity_type, related_entity_id, granularity, prev_hash, row_hash`
    : `audit_log_id, case_id, action_type, actor_user_id, action_date, details,
       related_entity_type, related_entity_id, granularity`

  const raw = sqlite
    .prepare(
      `SELECT ${columns}
       FROM audit_log
       WHERE case_id = ?
       ORDER BY action_date DESC`
    )
    .all(caseId) as Array<Omit<AuditLogRow, 'prev_hash' | 'row_hash'> & Partial<Pick<AuditLogRow, 'prev_hash' | 'row_hash'>>>

  // Normalize the shape so callers can rely on prev_hash/row_hash being
  // present (null when the migration is not yet applied).
  const rows: AuditLogRow[] = raw.map((r) => ({
    audit_log_id: r.audit_log_id,
    case_id: r.case_id,
    action_type: r.action_type,
    actor_user_id: r.actor_user_id,
    action_date: r.action_date,
    details: r.details,
    related_entity_type: r.related_entity_type,
    related_entity_id: r.related_entity_id,
    granularity: r.granularity,
    prev_hash: r.prev_hash ?? null,
    row_hash: r.row_hash ?? null,
  }))

  return rows
}

// ============================================================================
// Public API: exportAuditTrail
// ============================================================================

export function exportAuditTrail(caseId: number, format: 'csv' | 'json' = 'csv'): string {
  const trail = getAuditTrail(caseId)

  if (format === 'json') {
    return JSON.stringify(trail, null, 2)
  }

  // CSV format
  const headers = ['Timestamp', 'Action', 'Actor ID', 'Details', 'Related Entity']
  const rows = trail.map((entry) => [
    entry.action_date,
    entry.action_type,
    String(entry.actor_user_id),
    entry.details ? JSON.stringify(JSON.parse(entry.details)).substring(0, 100) : '',
    entry.related_entity_type ? `${entry.related_entity_type}#${entry.related_entity_id}` : '',
  ])

  const csv =
    [headers, ...rows]
      .map((row) =>
        row
          .map((cell) => {
            const str = String(cell)
            return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str
          })
          .join(',')
      )
      .join('\n') + '\n'

  return csv
}
