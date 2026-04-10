/**
 * Diagnostic Decision Persistence, Sprint 7.3
 *
 * ██ DOCTOR ALWAYS DIAGNOSES ██
 * These are the clinician's diagnostic decisions, NOT AI recommendations.
 * The AI presents evidence; the clinician decides.
 *
 * Table: diagnostic_decisions
 * Columns: decision_id, case_id, diagnosis_key, icd_code, diagnosis_name,
 *          decision (render/rule_out/defer), clinician_notes, decided_at, updated_at
 */

import { getSqlite } from '../db/connection'

export interface DiagnosticDecisionRow {
  readonly decision_id: number
  readonly case_id: number
  readonly diagnosis_key: string
  readonly icd_code: string
  readonly diagnosis_name: string
  readonly decision: 'render' | 'rule_out' | 'defer'
  readonly clinician_notes: string
  readonly decided_at: string
  readonly updated_at: string
}

export interface SaveDecisionParams {
  readonly case_id: number
  readonly diagnosis_key: string
  readonly icd_code: string
  readonly diagnosis_name: string
  readonly decision: 'render' | 'rule_out' | 'defer'
  readonly clinician_notes?: string
}

function ensureTable(): void {
  const sqlite = getSqlite()
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS diagnostic_decisions (
      decision_id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id INTEGER NOT NULL REFERENCES cases(case_id),
      diagnosis_key TEXT NOT NULL,
      icd_code TEXT NOT NULL DEFAULT '',
      diagnosis_name TEXT NOT NULL,
      decision TEXT NOT NULL CHECK(decision IN ('render', 'rule_out', 'defer')),
      clinician_notes TEXT NOT NULL DEFAULT '',
      decided_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(case_id, diagnosis_key)
    )
  `)
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_diag_decisions_case
      ON diagnostic_decisions(case_id)
  `)
}

/**
 * Save (upsert) a diagnostic decision for a case.
 * If a decision already exists for this case + diagnosis_key, update it.
 */
export function saveDecision(params: SaveDecisionParams): DiagnosticDecisionRow {
  ensureTable()
  const sqlite = getSqlite()

  sqlite.prepare(`
    INSERT INTO diagnostic_decisions (case_id, diagnosis_key, icd_code, diagnosis_name, decision, clinician_notes)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(case_id, diagnosis_key) DO UPDATE SET
      icd_code = excluded.icd_code,
      diagnosis_name = excluded.diagnosis_name,
      decision = excluded.decision,
      clinician_notes = excluded.clinician_notes,
      updated_at = datetime('now')
  `).run(
    params.case_id,
    params.diagnosis_key,
    params.icd_code,
    params.diagnosis_name,
    params.decision,
    params.clinician_notes || '',
  )

  // Return the saved row
  return sqlite.prepare(`
    SELECT * FROM diagnostic_decisions
    WHERE case_id = ? AND diagnosis_key = ?
  `).get(params.case_id, params.diagnosis_key) as DiagnosticDecisionRow
}

/**
 * List all diagnostic decisions for a case.
 */
export function listDecisions(caseId: number): DiagnosticDecisionRow[] {
  ensureTable()
  const sqlite = getSqlite()
  return sqlite.prepare(`
    SELECT * FROM diagnostic_decisions
    WHERE case_id = ?
    ORDER BY decided_at ASC
  `).all(caseId) as DiagnosticDecisionRow[]
}

/**
 * Delete a diagnostic decision.
 */
export function deleteDecision(caseId: number, diagnosisKey: string): boolean {
  ensureTable()
  const sqlite = getSqlite()
  const result = sqlite.prepare(`
    DELETE FROM diagnostic_decisions
    WHERE case_id = ? AND diagnosis_key = ?
  `).run(caseId, diagnosisKey)
  return result.changes > 0
}

// ---------------------------------------------------------------------------
// Clinical Formulation, one free-text narrative per case
// ---------------------------------------------------------------------------

export interface ClinicalFormulationRow {
  readonly formulation_id: number
  readonly case_id: number
  readonly formulation_text: string
  readonly updated_at: string
}

export interface SaveFormulationParams {
  readonly case_id: number
  readonly formulation_text: string
}

function ensureFormulationTable(): void {
  const sqlite = getSqlite()
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS clinical_formulations (
      formulation_id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id INTEGER NOT NULL REFERENCES cases(case_id),
      formulation_text TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(case_id)
    )
  `)
}

/**
 * Upsert the clinical formulation for a case.
 */
export function saveFormulation(params: SaveFormulationParams): ClinicalFormulationRow {
  ensureFormulationTable()
  const sqlite = getSqlite()

  sqlite.prepare(`
    INSERT INTO clinical_formulations (case_id, formulation_text)
    VALUES (?, ?)
    ON CONFLICT(case_id) DO UPDATE SET
      formulation_text = excluded.formulation_text,
      updated_at = datetime('now')
  `).run(params.case_id, params.formulation_text)

  return sqlite.prepare(`
    SELECT * FROM clinical_formulations WHERE case_id = ?
  `).get(params.case_id) as ClinicalFormulationRow
}

/**
 * Get the clinical formulation for a case. Returns null if not yet saved.
 */
export function getFormulation(caseId: number): ClinicalFormulationRow | null {
  ensureFormulationTable()
  const sqlite = getSqlite()
  const row = sqlite.prepare(`
    SELECT * FROM clinical_formulations WHERE case_id = ?
  `).get(caseId)
  return (row as ClinicalFormulationRow) ?? null
}
