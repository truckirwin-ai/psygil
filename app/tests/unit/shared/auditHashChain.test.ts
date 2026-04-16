import { describe, it, expect } from 'vitest'
import { computeRowHash, type HashableFields } from '../../../src/main/audit/index'
import { walkChain, type AuditLogVerifyRow } from '../../../src/main/audit/verify'

// ============================================================================
// Helper: build a valid chain row from minimal inputs
// ============================================================================

function buildRow(
  id: number,
  prevHash: string | null,
  overrides: Partial<Omit<AuditLogVerifyRow, 'audit_log_id' | 'prev_hash' | 'row_hash'>> = {}
): AuditLogVerifyRow {
  const base: Omit<AuditLogVerifyRow, 'row_hash'> = {
    audit_log_id: id,
    case_id: overrides.case_id ?? 1,
    action_type: overrides.action_type ?? 'test_action',
    actor_user_id: overrides.actor_user_id ?? 0,
    action_date: overrides.action_date ?? `2026-04-16T00:00:0${id}.000Z`,
    details: overrides.details ?? null,
    related_entity_type: overrides.related_entity_type ?? null,
    related_entity_id: overrides.related_entity_id ?? null,
    granularity: overrides.granularity ?? 'decision_record_only',
    prev_hash: prevHash,
  }

  const fields: HashableFields = {
    case_id: base.case_id,
    action_type: base.action_type,
    actor_user_id: base.actor_user_id,
    action_date: base.action_date,
    details: base.details,
    related_entity_type: base.related_entity_type,
    related_entity_id: base.related_entity_id,
    granularity: base.granularity,
    prev_hash: prevHash,
  }

  return { ...base, row_hash: computeRowHash(fields) }
}

/**
 * Build a chain of N rows where each row's prev_hash links to the previous
 * row's row_hash.
 */
function buildChain(length: number): AuditLogVerifyRow[] {
  const rows: AuditLogVerifyRow[] = []
  let prevHash: string | null = null
  for (let i = 1; i <= length; i++) {
    const row = buildRow(i, prevHash)
    rows.push(row)
    prevHash = row.row_hash
  }
  return rows
}

// ============================================================================
// Tests
// ============================================================================

describe('computeRowHash, pure hash function', () => {
  const sampleFields: HashableFields = {
    case_id: 42,
    action_type: 'report_signed',
    actor_user_id: 7,
    action_date: '2026-04-16T12:00:00.000Z',
    details: '{"note":"signed"}',
    related_entity_type: 'report',
    related_entity_id: 99,
    granularity: 'decision_record_only',
    prev_hash: null,
  }

  it('Test 1: is deterministic, same input produces same output', () => {
    const hash1 = computeRowHash(sampleFields)
    const hash2 = computeRowHash(sampleFields)
    expect(hash1).toBe(hash2)
    expect(hash1).toHaveLength(64) // 256-bit hex
  })

  it('Test 2: differs when any field differs', () => {
    const base = computeRowHash(sampleFields)

    expect(computeRowHash({ ...sampleFields, case_id: 43 })).not.toBe(base)
    expect(computeRowHash({ ...sampleFields, action_type: 'case_archived' })).not.toBe(base)
    expect(computeRowHash({ ...sampleFields, actor_user_id: 8 })).not.toBe(base)
    expect(computeRowHash({ ...sampleFields, action_date: '2026-04-17T00:00:00.000Z' })).not.toBe(base)
    expect(computeRowHash({ ...sampleFields, details: '{"note":"modified"}' })).not.toBe(base)
    expect(computeRowHash({ ...sampleFields, prev_hash: 'abc123' })).not.toBe(base)
  })
})

describe('walkChain, chain verification', () => {
  it('Test 3: returns valid for an empty audit_log (totalRows: 0)', () => {
    const result = walkChain([])
    expect(result.valid).toBe(true)
    expect(result.brokenAtId).toBeNull()
    expect(result.totalRows).toBe(0)
  })

  it('Test 4: detects tampering, brokenAtId equals the tampered row id', () => {
    // Build a clean 3-row chain
    const rows = buildChain(3)

    // Verify it passes before tampering
    expect(walkChain(rows).valid).toBe(true)

    // Tamper row 2: alter action_type but leave row_hash as the original
    const tampered = rows.map((row) => {
      if (row.audit_log_id === 2) {
        return { ...row, action_type: 'tampered_action' }
      }
      return row
    })

    const result = walkChain(tampered)
    expect(result.valid).toBe(false)
    expect(result.brokenAtId).toBe(2)
    expect(result.totalRows).toBe(3)
  })

  it('skips rows with null row_hash (pre-migration rows)', () => {
    const legacyRow: AuditLogVerifyRow = {
      audit_log_id: 1,
      case_id: 1,
      action_type: 'old_action',
      actor_user_id: 0,
      action_date: '2026-01-01T00:00:00.000Z',
      details: null,
      related_entity_type: null,
      related_entity_id: null,
      granularity: 'decision_record_only',
      prev_hash: null,
      row_hash: null,
    }

    const result = walkChain([legacyRow])
    expect(result.valid).toBe(true)
    expect(result.totalRows).toBe(1)
  })

  it('valid chain of 3 rows passes intact', () => {
    const rows = buildChain(3)
    const result = walkChain(rows)
    expect(result.valid).toBe(true)
    expect(result.brokenAtId).toBeNull()
    expect(result.totalRows).toBe(3)
  })
})
