/**
 * Audit Trail Module
 *
 * Comprehensive logging of all case actions for litigation defensibility.
 * Every action logged with timestamp, actor, and context for forensic reproducibility.
 */

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
}

// ============================================================================
// Public API: logAuditEntry
// ============================================================================

export function logAuditEntry(params: AuditEntry): number {
  const sqlite = getSqlite()

  // Map actorType + actorId to a user_id (for now, use 0 for system)
  let actorUserId = 0
  if (params.actorType === 'clinician' && params.actorId) {
    // Try to parse as number
    const parsed = parseInt(params.actorId, 10)
    if (!isNaN(parsed)) {
      actorUserId = parsed
    }
  } else if (params.actorType === 'ai_agent') {
    // Use a reserved user_id for AI agents (e.g., -1)
    actorUserId = -1
  }

  // Serialize details to JSON string
  const detailsJson = JSON.stringify(params.details)

  // Insert into audit_log table
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
      new Date().toISOString(),
      detailsJson,
      params.relatedEntityType ?? null,
      params.relatedEntityId ?? null
    ) as { lastInsertRowid?: number }

  const auditLogId = (result.lastInsertRowid ?? 0) as number

  return auditLogId
}

// ============================================================================
// Public API: getAuditTrail
// ============================================================================

export function getAuditTrail(caseId: number): AuditLogRow[] {
  const sqlite = getSqlite()

  const rows = sqlite
    .prepare(
      `SELECT audit_log_id, case_id, action_type, actor_user_id, action_date, details,
              related_entity_type, related_entity_id, granularity
       FROM audit_log
       WHERE case_id = ?
       ORDER BY action_date DESC`
    )
    .all(caseId) as AuditLogRow[]

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
            // Escape CSV cells
            const str = String(cell)
            return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str
          })
          .join(',')
      )
      .join('\n') + '\n'

  return csv
}
