/**
 * Case management service — CRUD operations + workspace folder creation.
 * Source of truth: docs/engineering/26_Workspace_Folder_Architecture.md
 *
 * Each case maps to a real folder on disk:
 *   {workspace_root}/{case_number} {last}, {first}/
 *     _Inbox/ Collateral/ Testing/ Interviews/ Diagnostics/ Reports/ Archive/
 */

import { join } from 'path'
import { existsSync, mkdirSync, renameSync } from 'fs'
import { getSqlite } from '../db/connection'
import { loadWorkspacePath } from '../workspace'
import type {
  CaseRow,
  CreateCaseParams,
  PatientIntakeRow,
  PatientOnboardingRow,
  OnboardingSection,
} from '../../shared/types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CASE_SUBFOLDERS = [
  '_Inbox',
  'Collateral',
  'Testing',
  'Interviews',
  'Diagnostics',
  'Reports',
  'Archive',
] as const

// ---------------------------------------------------------------------------
// Case CRUD
// ---------------------------------------------------------------------------

/**
 * Create a new case: insert DB record + create folder structure on disk.
 */
export function createCase(params: CreateCaseParams): CaseRow {
  const sqlite = getSqlite()
  const wsPath = loadWorkspacePath()
  if (wsPath === null) {
    throw new Error('No workspace path configured — set workspace before creating cases')
  }

  const folderName = `${params.case_number} ${params.examinee_last_name}, ${params.examinee_first_name}`
  const folderPath = join(wsPath, folderName)

  // Create folder structure on disk
  if (!existsSync(folderPath)) {
    mkdirSync(folderPath, { recursive: true })
  }
  for (const sub of CASE_SUBFOLDERS) {
    const subPath = join(folderPath, sub)
    if (!existsSync(subPath)) {
      mkdirSync(subPath, { recursive: true })
    }
  }

  // Insert DB record
  const stmt = sqlite.prepare(`
    INSERT INTO cases (
      case_number, primary_clinician_user_id,
      examinee_first_name, examinee_last_name, examinee_dob, examinee_gender,
      evaluation_type, referral_source, evaluation_questions,
      case_status, workflow_current_stage, folder_path, notes
    ) VALUES (
      @case_number, @primary_clinician_user_id,
      @examinee_first_name, @examinee_last_name, @examinee_dob, @examinee_gender,
      @evaluation_type, @referral_source, @evaluation_questions,
      'intake', 'gate_1', @folder_path, @notes
    )
  `)

  const result = stmt.run({
    case_number: params.case_number,
    primary_clinician_user_id: params.primary_clinician_user_id,
    examinee_first_name: params.examinee_first_name,
    examinee_last_name: params.examinee_last_name,
    examinee_dob: params.examinee_dob ?? null,
    examinee_gender: params.examinee_gender ?? null,
    evaluation_type: params.evaluation_type ?? null,
    referral_source: params.referral_source ?? null,
    evaluation_questions: params.evaluation_questions ?? null,
    folder_path: folderPath,
    notes: params.notes ?? null,
  })

  const caseId = Number(result.lastInsertRowid)
  return getCaseById(caseId)!
}

/**
 * List all active (non-archived) cases.
 */
export function listCases(): readonly CaseRow[] {
  const sqlite = getSqlite()
  // Check if deleted_at column exists (added in a later migration)
  const cols = (sqlite.pragma('table_info(cases)') as Array<{ name: string }>).map(c => c.name)
  const hasDeletedAt = cols.includes('deleted_at')
  const query = hasDeletedAt
    ? 'SELECT * FROM cases WHERE deleted_at IS NULL AND case_status != ? ORDER BY created_at DESC'
    : 'SELECT * FROM cases WHERE case_status != ? ORDER BY created_at DESC'
  const rows = sqlite.prepare(query).all('archived') as CaseRow[]
  return rows
}

/**
 * Get a single case by ID.
 */
export function getCaseById(caseId: number): CaseRow | null {
  const sqlite = getSqlite()
  const row = sqlite
    .prepare('SELECT * FROM cases WHERE case_id = ?')
    .get(caseId) as CaseRow | undefined
  return row ?? null
}

/**
 * Archive a case: set deleted_at + move folder to workspace Archive/.
 */
export function archiveCase(caseId: number): CaseRow {
  const sqlite = getSqlite()
  const existing = getCaseById(caseId)
  if (existing === null) {
    throw new Error(`Case ${caseId} not found`)
  }

  const now = new Date().toISOString()
  const archCols = (sqlite.pragma('table_info(cases)') as Array<{ name: string }>).map(c => c.name)
  if (archCols.includes('deleted_at') && archCols.includes('last_modified')) {
    sqlite.prepare("UPDATE cases SET case_status = 'archived', deleted_at = ?, last_modified = ? WHERE case_id = ?").run(now, now, caseId)
  } else {
    sqlite.prepare("UPDATE cases SET case_status = 'archived' WHERE case_id = ?").run(caseId)
  }

  // Move folder to workspace Archive/ if it exists
  if (existing.folder_path && existsSync(existing.folder_path)) {
    const wsPath = loadWorkspacePath()
    if (wsPath !== null) {
      const archiveRoot = join(wsPath, 'Archive')
      if (!existsSync(archiveRoot)) {
        mkdirSync(archiveRoot, { recursive: true })
      }
      const folderName = existing.folder_path.split('/').pop()!
      const archiveDest = join(archiveRoot, folderName)
      try {
        renameSync(existing.folder_path, archiveDest)
        sqlite
          .prepare('UPDATE cases SET folder_path = ? WHERE case_id = ?')
          .run(archiveDest, caseId)
      } catch (err) {
        console.error(`[cases] Failed to move folder to archive: ${err}`)
        // DB update still succeeds — folder move is best-effort
      }
    }
  }

  return getCaseById(caseId)!
}

/**
 * Look up a case by its folder path.
 */
export function getCaseByFolder(folderPath: string): CaseRow | null {
  const sqlite = getSqlite()
  const row = sqlite
    .prepare('SELECT * FROM cases WHERE folder_path = ?')
    .get(folderPath) as CaseRow | undefined
  return row ?? null
}

// ---------------------------------------------------------------------------
// Patient Intake
// ---------------------------------------------------------------------------

/**
 * Upsert patient intake data for a case.
 * Uses INSERT OR REPLACE on the UNIQUE(case_id) constraint.
 */
export function saveIntake(caseId: number, data: Omit<PatientIntakeRow, 'intake_id' | 'case_id' | 'created_at' | 'updated_at'>): PatientIntakeRow {
  const sqlite = getSqlite()

  sqlite.prepare(`
    INSERT INTO patient_intake (
      case_id, referral_type, referral_source, eval_type,
      presenting_complaint, jurisdiction, charges,
      attorney_name, report_deadline, status
    ) VALUES (
      @case_id, @referral_type, @referral_source, @eval_type,
      @presenting_complaint, @jurisdiction, @charges,
      @attorney_name, @report_deadline, @status
    )
    ON CONFLICT (case_id) DO UPDATE SET
      referral_type = excluded.referral_type,
      referral_source = excluded.referral_source,
      eval_type = excluded.eval_type,
      presenting_complaint = excluded.presenting_complaint,
      jurisdiction = excluded.jurisdiction,
      charges = excluded.charges,
      attorney_name = excluded.attorney_name,
      report_deadline = excluded.report_deadline,
      status = excluded.status
  `).run({
    case_id: caseId,
    referral_type: data.referral_type ?? 'court',
    referral_source: data.referral_source ?? null,
    eval_type: data.eval_type ?? null,
    presenting_complaint: data.presenting_complaint ?? null,
    jurisdiction: data.jurisdiction ?? null,
    charges: data.charges ?? null,
    attorney_name: data.attorney_name ?? null,
    report_deadline: data.report_deadline ?? null,
    status: data.status ?? 'draft',
  })

  return getIntake(caseId)!
}

/**
 * Get patient intake for a case.
 */
export function getIntake(caseId: number): PatientIntakeRow | null {
  const sqlite = getSqlite()
  const row = sqlite
    .prepare('SELECT * FROM patient_intake WHERE case_id = ?')
    .get(caseId) as PatientIntakeRow | undefined
  return row ?? null
}

// ---------------------------------------------------------------------------
// Patient Onboarding
// ---------------------------------------------------------------------------

/**
 * Upsert a single onboarding section for a case.
 * Uses INSERT OR REPLACE on the UNIQUE(case_id, section) constraint.
 */
export function saveOnboardingSection(
  caseId: number,
  section: OnboardingSection,
  data: { readonly content: string; readonly clinician_notes?: string; readonly verified?: boolean; readonly status?: 'draft' | 'complete' },
): PatientOnboardingRow {
  const sqlite = getSqlite()

  sqlite.prepare(`
    INSERT INTO patient_onboarding (
      case_id, section, content, clinician_notes, verified, status
    ) VALUES (
      @case_id, @section, @content, @clinician_notes, @verified, @status
    )
    ON CONFLICT (case_id, section) DO UPDATE SET
      content = excluded.content,
      clinician_notes = excluded.clinician_notes,
      verified = excluded.verified,
      status = excluded.status
  `).run({
    case_id: caseId,
    section,
    content: data.content,
    clinician_notes: data.clinician_notes ?? null,
    verified: data.verified ? 1 : 0,
    status: data.status ?? 'draft',
  })

  const row = sqlite
    .prepare('SELECT * FROM patient_onboarding WHERE case_id = ? AND section = ?')
    .get(caseId, section) as PatientOnboardingRow
  return row
}

/**
 * Get all onboarding sections for a case.
 */
export function getOnboardingSections(caseId: number): readonly PatientOnboardingRow[] {
  const sqlite = getSqlite()
  const rows = sqlite
    .prepare('SELECT * FROM patient_onboarding WHERE case_id = ? ORDER BY section')
    .all(caseId) as PatientOnboardingRow[]
  return rows
}
