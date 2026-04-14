// =============================================================================
// case-content/seeder.ts, write realistic case records to DB + disk
// =============================================================================
//
// For each CaseRecord in REALISTIC_CASES:
//   1. Build the case folder on disk under {projectRoot}/cases/ with the
//      canonical 7 subfolders (_Inbox, Collateral, Testing, Interviews,
//      Diagnostics, Reports, Archive)
//   2. INSERT or UPDATE the cases row (including workflow_current_stage)
//   3. UPSERT patient_intake
//   4. UPSERT patient_onboarding sections
//   5. For each document, write the file and INSERT a documents row with
//      indexed_content populated for full-text search
//
// Idempotent: re-running the seeder UPDATEs existing rows and skips
// documents that already exist on disk. Pass overwrite=true to overwrite.
// =============================================================================

import { mkdirSync, existsSync, writeFileSync, statSync } from 'fs'
import { join } from 'path'

import { getSqlite } from '../../db/connection'
import { REALISTIC_CASES } from './index'
import type { CaseRecord, CaseDocument, Stage, Subfolder } from './shared'

const CASE_SUBFOLDERS: readonly Subfolder[] = [
  '_Inbox',
  'Collateral',
  'Testing',
  'Interviews',
  'Diagnostics',
  'Reports',
  'Archive',
]

/**
 * Days after case createdAt when a document in each subfolder would
 * realistically have been uploaded. A referral letter arrives on day 0;
 * a final report is the last thing produced. Offsets are clamped to
 * lastModified in writeDocument so they never exceed the case's last
 * activity.
 */
const SUBFOLDER_UPLOAD_OFFSET_DAYS: Record<Subfolder, number> = {
  _Inbox: 0,
  Collateral: 2,
  Testing: 14,
  Interviews: 21,
  Diagnostics: 35,
  Reports: 45,
  Archive: 50,
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function minIsoDate(a: string, b: string): string {
  return a <= b ? a : b
}

export interface SeedCaseResult {
  readonly caseNumber: string
  readonly caseId: number
  readonly documentsWritten: number
  readonly documentsSkipped: number
  readonly stage: Stage
}

export interface SeedRealisticCasesOptions {
  readonly projectRoot: string
  readonly clinicianUserId?: number
  readonly overwrite?: boolean
}

function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

function scaffoldCaseFolder(caseFolderPath: string): void {
  ensureDir(caseFolderPath)
  for (const sub of CASE_SUBFOLDERS) {
    ensureDir(join(caseFolderPath, sub))
  }
}

/**
 * Upsert a single case and return its integer case_id. Uses case_number
 * as the idempotency key.
 */
function upsertCase(
  record: CaseRecord,
  folderPath: string,
  clinicianUserId: number,
): number {
  const sqlite = getSqlite()

  const existing = sqlite
    .prepare('SELECT case_id FROM cases WHERE case_number = ?')
    .get(record.caseNumber) as { case_id: number } | undefined

  if (existing !== undefined) {
    sqlite.prepare(
      `UPDATE cases SET
        primary_clinician_user_id = ?,
        examinee_first_name = ?,
        examinee_last_name = ?,
        examinee_dob = ?,
        examinee_gender = ?,
        evaluation_type = ?,
        referral_source = ?,
        evaluation_questions = ?,
        case_status = ?,
        workflow_current_stage = ?,
        folder_path = ?,
        notes = ?,
        created_at = ?,
        last_modified = ?
      WHERE case_id = ?`,
    ).run(
      clinicianUserId,
      record.firstName,
      record.lastName,
      record.dob,
      record.gender,
      record.evaluationType,
      record.referralSource,
      record.evaluationQuestions,
      record.caseStatus,
      record.stage,
      folderPath,
      record.notes,
      record.createdAt,
      record.lastModified,
      existing.case_id,
    )
    return existing.case_id
  }

  const insert = sqlite.prepare(
    `INSERT INTO cases (
      case_number, primary_clinician_user_id,
      examinee_first_name, examinee_last_name, examinee_dob, examinee_gender,
      evaluation_type, referral_source, evaluation_questions,
      case_status, workflow_current_stage, folder_path, notes,
      created_at, last_modified
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  const result = insert.run(
    record.caseNumber,
    clinicianUserId,
    record.firstName,
    record.lastName,
    record.dob,
    record.gender,
    record.evaluationType,
    record.referralSource,
    record.evaluationQuestions,
    record.caseStatus,
    record.stage,
    folderPath,
    record.notes,
    record.createdAt,
    record.lastModified,
  )
  return Number(result.lastInsertRowid)
}

/**
 * Upsert patient_intake for a case.
 */
function upsertIntake(caseId: number, record: CaseRecord): void {
  const sqlite = getSqlite()
  sqlite.prepare(
    `INSERT INTO patient_intake (
      case_id, referral_type, referral_source, eval_type,
      presenting_complaint, jurisdiction, charges,
      attorney_name, report_deadline, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(case_id) DO UPDATE SET
      referral_type = excluded.referral_type,
      referral_source = excluded.referral_source,
      eval_type = excluded.eval_type,
      presenting_complaint = excluded.presenting_complaint,
      jurisdiction = excluded.jurisdiction,
      charges = excluded.charges,
      attorney_name = excluded.attorney_name,
      report_deadline = excluded.report_deadline,
      status = excluded.status`,
  ).run(
    caseId,
    record.intake.referral_type,
    record.intake.referral_source,
    record.intake.eval_type,
    record.intake.presenting_complaint,
    record.intake.jurisdiction,
    record.intake.charges,
    record.intake.attorney_name,
    record.intake.report_deadline,
    record.intake.status,
  )
}

/**
 * Upsert all onboarding sections for a case.
 */
function upsertOnboarding(caseId: number, record: CaseRecord): void {
  const sqlite = getSqlite()
  const stmt = sqlite.prepare(
    `INSERT INTO patient_onboarding (
      case_id, section, content, clinician_notes, verified, status
    ) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(case_id, section) DO UPDATE SET
      content = excluded.content,
      clinician_notes = excluded.clinician_notes,
      verified = excluded.verified,
      status = excluded.status`,
  )
  for (const entry of record.onboarding) {
    stmt.run(
      caseId,
      entry.section,
      entry.content,
      entry.clinician_notes ?? null,
      entry.status === 'complete' ? 1 : 0,
      entry.status,
    )
  }
}

/**
 * Write one document to disk and insert a documents row with
 * indexed_content populated.
 */
function writeDocument(
  caseId: number,
  caseFolder: string,
  doc: CaseDocument,
  clinicianUserId: number,
  overwrite: boolean,
  caseCreatedAt: string,
  caseLastModified: string,
): { written: boolean; skipped: boolean } {
  const sqlite = getSqlite()
  const destDir = join(caseFolder, doc.subfolder)
  ensureDir(destDir)
  const destPath = join(destDir, doc.filename)

  // Derive a realistic upload date for this document based on its
  // subfolder. Clamp so we never exceed the case's last_modified.
  const offset = SUBFOLDER_UPLOAD_OFFSET_DAYS[doc.subfolder]
  const uploadDate = minIsoDate(addDays(caseCreatedAt, offset), caseLastModified)

  // Skip if file exists and we're not overwriting
  if (existsSync(destPath) && !overwrite) {
    // Still ensure a DB row exists
    const existing = sqlite
      .prepare('SELECT document_id FROM documents WHERE case_id = ? AND file_path = ?')
      .get(caseId, destPath) as { document_id: number } | undefined
    if (existing === undefined) {
      insertDocumentRow(caseId, destPath, doc, clinicianUserId, uploadDate)
    }
    return { written: false, skipped: true }
  }

  writeFileSync(destPath, doc.content, 'utf-8')
  insertDocumentRow(caseId, destPath, doc, clinicianUserId, uploadDate)
  return { written: true, skipped: false }
}

function insertDocumentRow(
  caseId: number,
  destPath: string,
  doc: CaseDocument,
  clinicianUserId: number,
  uploadDate: string,
): void {
  const sqlite = getSqlite()
  let size = 0
  try {
    size = statSync(destPath).size
  } catch {
    size = Buffer.byteLength(doc.content, 'utf-8')
  }
  const mime =
    doc.documentType === 'pdf'
      ? 'application/pdf'
      : doc.documentType === 'docx'
        ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : 'text/plain'

  // Remove any prior row for this exact path to keep the insert idempotent
  sqlite
    .prepare('DELETE FROM documents WHERE case_id = ? AND file_path = ?')
    .run(caseId, destPath)

  sqlite.prepare(
    `INSERT INTO documents (
      case_id, document_type, original_filename, file_path,
      file_size_bytes, mime_type, uploaded_by_user_id,
      description, indexed_content, upload_date
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    caseId,
    doc.documentType,
    doc.filename,
    destPath,
    size,
    mime,
    clinicianUserId,
    doc.description,
    doc.content,
    uploadDate,
  )
}

/**
 * Main entry point: seed all 10 realistic cases into the current project
 * root. Uses the currently-open DB connection (call initDb first).
 */
export function seedRealisticCases(
  options: SeedRealisticCasesOptions,
): readonly SeedCaseResult[] {
  const { projectRoot } = options
  const clinicianUserId = options.clinicianUserId ?? 1
  const overwrite = options.overwrite === true
  const sqlite = getSqlite()

  // Ensure the cases/ parent exists
  const casesRoot = join(projectRoot, 'cases')
  ensureDir(casesRoot)

  // Ensure the default clinician user exists (user_id 1 by convention)
  sqlite
    .prepare(
      `INSERT OR IGNORE INTO users (user_id, email, full_name, role, is_active, created_at)
       VALUES (1, 'clinician@pikeforensics.example', 'Dr. Jordan Whitfield', 'psychologist', 1, date('now'))`,
    )
    .run()

  const results: SeedCaseResult[] = []

  for (const record of REALISTIC_CASES) {
    const folderName = `${record.caseNumber} ${record.lastName}, ${record.firstName}`
    const folderPath = join(casesRoot, folderName)
    scaffoldCaseFolder(folderPath)

    const caseId = upsertCase(record, folderPath, clinicianUserId)
    upsertIntake(caseId, record)
    upsertOnboarding(caseId, record)

    let written = 0
    let skipped = 0
    for (const doc of record.documents) {
      const outcome = writeDocument(
        caseId,
        folderPath,
        doc,
        clinicianUserId,
        overwrite,
        record.createdAt,
        record.lastModified,
      )
      if (outcome.written) written += 1
      if (outcome.skipped) skipped += 1
    }

    results.push({
      caseNumber: record.caseNumber,
      caseId,
      documentsWritten: written,
      documentsSkipped: skipped,
      stage: record.stage,
    })
  }

  return results
}
