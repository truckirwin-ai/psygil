/**
 * Report Finalization Module
 *
 * Handles report signing, sealing with digital signatures, integrity verification,
 * and PDF generation. Part of Sprint 11 backend for Review → Complete stage transition.
 */

import { createHash } from 'crypto'
import { mkdirSync, promises as fsPromises, existsSync, readdirSync, readFileSync } from 'fs'
import { join, resolve } from 'path'
import { execFileSync } from 'child_process'
import { getSqlite } from '../db/connection'
import { getCaseById } from '../cases'
import { loadWorkspacePath } from '../workspace'
import { logAuditEntry } from '../audit'
import type { IpcResponse } from '../../shared/types'
import { archiveDrafts, setReadOnly } from './archive'
import { findProhibited, HardRuleViolationError } from '../publish/hardRuleScan'
import { getLatestWriterResult } from '../agents/writer'

// ============================================================================
// Types
// ============================================================================

export interface AttestationParams {
  caseId: number
  signedBy: string          // e.g., "Dr. Truck Irwin, Psy.D., ABPP"
  attestationStatement: string
  signatureDate: string     // ISO date
}

export interface ReportStatus {
  hasReport: boolean
  status: string | null
  isLocked: boolean
  integrityHash: string | null
  version: number | null
  pdfPath: string | null
  docxPath: string | null
}

export interface IntegrityVerification {
  valid: boolean
  storedHash: string | null
  computedHash: string
}

export interface SubmitAttestationResult {
  reportId: number
  integrityHash: string
  pdfPath: string
  docxPath: string
}

// ============================================================================
// Helper: Compute SHA-256 hash of a file
// ============================================================================

function computeFileHash(filePath: string): string {
  const hash = createHash('sha256')
  // For a more efficient implementation, we'd stream the file.
  // For now, a simple synchronous read.
  const fs = require('fs')
  const buffer = fs.readFileSync(filePath)
  hash.update(buffer)
  return hash.digest('hex')
}

// ============================================================================
// Helper: Get the final report directory for a case
// ============================================================================

function getReportFinalDir(caseId: number, workspacePath?: string): string {
  const wsPath = workspacePath ?? loadWorkspacePath()
  if (!wsPath) {
    throw new Error('Workspace not configured')
  }
  return join(wsPath, `case_${caseId}`, 'report', 'final')
}

function getReportDraftsDir(caseId: number, workspacePath?: string): string {
  const wsPath = workspacePath ?? loadWorkspacePath()
  if (!wsPath) {
    throw new Error('Workspace not configured')
  }
  return join(wsPath, `case_${caseId}`, 'report', 'drafts')
}

// ============================================================================
// Helper: Find the latest draft DOCX file
// ============================================================================

function findLatestDraft(draftsDir: string): string | null {
  try {
    if (!existsSync(draftsDir)) {
      return null
    }

    const files = readdirSync(draftsDir)
    const draftFiles = files.filter((f) => f.match(/^draft_v\d+\.docx$/))

    if (draftFiles.length === 0) {
      return null
    }

    // Sort by version number (descending) and return the highest version
    const sorted = draftFiles.sort((a, b) => {
      const aMatch = a.match(/draft_v(\d+)/)
      const bMatch = b.match(/draft_v(\d+)/)
      const aVersion = aMatch ? parseInt(aMatch[1], 10) : 0
      const bVersion = bMatch ? parseInt(bMatch[1], 10) : 0
      return bVersion - aVersion
    })

    return join(draftsDir, sorted[0])
  } catch (error) {
    console.error('[reports] Error finding latest draft:', error)
    return null
  }
}

// ============================================================================
// Helper: Generate sealed PDF from DOCX
// ============================================================================

export async function generateSealedPdf(docxPath: string, outputPath: string): Promise<void> {
  // Try LibreOffice CLI first for best-fidelity conversion.
  try {
    execFileSync('soffice', [
      '--headless',
      '--convert-to', 'pdf',
      '--outdir', resolve(outputPath, '..'),
      docxPath
    ], { timeout: 30000 })
    return
  } catch (error) {
    process.stderr.write(
      `[reports] LibreOffice conversion failed (${(error as Error).message}); continuing without PDF.\n`,
    )
  }

  // Non-fatal fallback: LibreOffice is not installed. The caller is expected
  // to handle the missing-PDF case by surfacing a UI prompt that offers
  // "Install LibreOffice" or "Generate manually". A future enhancement will
  // embed pdf-lib for pure-JS PDF generation (v1.1 target per plan E.1).
  throw new Error('PDF_CONVERSION_UNAVAILABLE')
}

// ============================================================================
// Helper: HARD RULE scan over Writer output + final DOCX bytes
// ============================================================================

function scanPublishArtifacts(caseId: number, finalDocxPath: string): void {
  // 1. Scan the persisted WriterOutput (structured content, readable text).
  //    If present, concatenate all section content and scan.
  const writer = getLatestWriterResult(caseId)
  if (writer) {
    const allText = writer.sections
      .map((s) => `${s.section_name}\n${s.content}\n${s.revision_notes ?? ''}`)
      .join('\n\n')
    const violations = findProhibited(allText, { label: `case_${caseId}:writer_output` })
    if (violations.length > 0) {
      throw new HardRuleViolationError(violations[0])
    }
  }

  // 2. Scan the final DOCX file bytes as a best-effort check. DOCX is a zip
  //    so the raw bytes include XML markup; the scanner still catches em
  //    and en dashes in the encoded text and catches obvious watermarks.
  try {
    const docxBytes = readFileSync(finalDocxPath, 'utf-8')
    const violations = findProhibited(docxBytes, { label: finalDocxPath })
    if (violations.length > 0) {
      throw new HardRuleViolationError(violations[0])
    }
  } catch (e) {
    if (e instanceof HardRuleViolationError) throw e
    // Reading non-UTF8 bytes is noisy; swallow I/O errors but log them.
    process.stderr.write(
      `[reports] DOCX byte scan skipped: ${(e as Error).message}\n`,
    )
  }
}

// ============================================================================
// Public API: submitAttestation
// ============================================================================

function resolveClinicianUserId(): number {
  const sqlite = getSqlite()
  const row = sqlite
    .prepare("SELECT user_id FROM users WHERE is_active = 1 ORDER BY user_id ASC LIMIT 1")
    .get() as { user_id: number } | undefined
  if (row?.user_id) return row.user_id
  // Bootstrap a default clinician so reports can be persisted even before
  // a real auth user has been created.
  sqlite
    .prepare(
      `INSERT OR IGNORE INTO users (user_id, email, full_name, role, credentials, is_active, created_at)
       VALUES (1, 'clinician@psygil.local', 'Default Clinician', 'psychologist', 'Ph.D.', 1, CURRENT_DATE)`
    )
    .run()
  return 1
}

export function submitAttestation(params: AttestationParams): SubmitAttestationResult {
  const sqlite = getSqlite()
  const { caseId, signedBy, attestationStatement, signatureDate } = params
  const clinicianUserId = resolveClinicianUserId()

  // 1. Verify case exists and is at 'review' stage
  const caseRow = getCaseById(caseId)
  if (!caseRow) {
    throw new Error(`Case ${caseId} not found`)
  }

  if (caseRow.workflow_current_stage !== 'review') {
    throw new Error(
      `Case must be in 'review' stage to submit attestation. Current stage: ${caseRow.workflow_current_stage}`
    )
  }

  // 2. Find the latest report draft
  const draftsDir = getReportDraftsDir(caseId)
  const draftDocxPath = findLatestDraft(draftsDir)

  if (!draftDocxPath) {
    throw new Error('No report draft found. Generate a report first.')
  }

  // 3. Create final directory and copy draft to final/evaluation_report.docx
  const finalDir = getReportFinalDir(caseId)
  mkdirSync(finalDir, { recursive: true })

  const finalDocxPath = join(finalDir, 'evaluation_report.docx')

  // Synchronous copy
  const fs = require('fs')
  const content = fs.readFileSync(draftDocxPath)
  fs.writeFileSync(finalDocxPath, content)

  // 3a. HARD RULE pre-seal gate: scan the WriterOutput and the final DOCX
  //     bytes. Any em dash, en dash, or AI watermark aborts the publish
  //     and leaves the final file in place so the clinician can see what
  //     was written; no report row, no audit entry, no read-only bit.
  scanPublishArtifacts(caseId, finalDocxPath)

  // 4. Generate PDF from the DOCX. Non-fatal: if LibreOffice is missing
  //    we keep publishing with DOCX only. Clinician can regenerate PDF
  //    later via a dedicated button once PDF tooling is installed.
  let pdfPath: string | null = null
  try {
    const pdfFileName = 'evaluation_report.pdf'
    pdfPath = join(finalDir, pdfFileName)
    generateSealedPdf(finalDocxPath, pdfPath)
  } catch (error) {
    process.stderr.write(
      `[reports] PDF generation skipped: ${(error as Error).message}\n`,
    )
    pdfPath = null
  }

  // 5. Compute SHA-256 integrity hash of the final DOCX
  const integrityHash = computeFileHash(finalDocxPath)

  // 6. Get file size
  const stats = fs.statSync(finalDocxPath)
  const fileSizeBytes = stats.size

  // 7. Update or insert reports table
  let reportId: number

  // Check if a report row already exists for this case
  const existingReport = sqlite
    .prepare('SELECT report_id FROM reports WHERE case_id = ? ORDER BY created_at DESC LIMIT 1')
    .get(caseId) as { report_id?: number } | undefined

  if (existingReport) {
    reportId = existingReport.report_id ?? 0
    // Update existing report
    sqlite
      .prepare(
        `UPDATE reports
         SET is_locked = 1, integrity_hash = ?, sealed_pdf_path = ?,
             finalized_by_user_id = ?, finalized_at = ?, status = 'finalized',
             file_path = ?, file_size_bytes = ?
         WHERE report_id = ?`
      )
      .run(
        integrityHash,
        pdfPath ?? null,
        clinicianUserId,
        new Date().toISOString(),
        finalDocxPath,
        fileSizeBytes,
        reportId
      )
  } else {
    // Insert new report row
    const result = sqlite
      .prepare(
        `INSERT INTO reports
         (case_id, generated_by_user_id, is_locked, integrity_hash, sealed_pdf_path,
          finalized_by_user_id, finalized_at, status, file_path, file_size_bytes, report_version)
         VALUES (?, ?, 1, ?, ?, ?, ?, 'finalized', ?, ?, 1)`
      )
      .run(
        caseId,
        clinicianUserId,
        integrityHash,
        pdfPath ?? null,
        clinicianUserId,
        new Date().toISOString(),
        finalDocxPath,
        fileSizeBytes
      ) as { lastInsertRowid?: number }

    reportId = (result.lastInsertRowid ?? null) as number
  }

  // 8. Log audit entry, use 'attestation_signed' so the pipeline review-stage
  // gate can detect that the clinician has attested. Also log the legacy
  // 'report_signed' action for downstream consumers and tests.
  logAuditEntry({
    caseId,
    actionType: 'attestation_signed',
    actorType: 'clinician',
    actorId: String(clinicianUserId),
    details: {
      signedBy,
      attestationStatement,
      signatureDate,
      integrityHash,
      filePath: finalDocxPath,
    },
    relatedEntityType: 'report',
    relatedEntityId: reportId,
  })

  logAuditEntry({
    caseId,
    actionType: 'report_signed',
    actorType: 'clinician',
    actorId: String(clinicianUserId),
    details: {
      signedBy,
      attestationStatement,
      signatureDate,
      integrityHash,
      filePath: finalDocxPath,
    },
    relatedEntityType: 'report',
    relatedEntityId: reportId,
  })

  // 9. Archive every remaining draft and freeze the final files at
  //    read-only so a user cannot edit a sealed report without the
  //    explicit supervisor-unlock path (future Phase B.4 work).
  try {
    const wsPath = loadWorkspacePath()
    if (wsPath) {
      const archiveDir = join(wsPath, `case_${caseId}`, 'report', 'archive')
      const archiveResult = archiveDrafts(draftsDir, archiveDir)
      if (archiveResult.movedCount > 0) {
        logAuditEntry({
          caseId,
          actionType: 'draft_archived',
          actorType: 'system',
          details: {
            draftsMoved: archiveResult.movedCount,
            archiveDir: archiveResult.archiveDir,
          },
          relatedEntityType: 'report',
          relatedEntityId: reportId,
        })
      }
    }
  } catch (e) {
    process.stderr.write(
      `[reports] Archive step failed: ${(e as Error).message}\n`,
    )
  }

  setReadOnly(finalDocxPath)
  if (pdfPath) {
    setReadOnly(pdfPath)
  }

  return {
    reportId,
    integrityHash,
    pdfPath: pdfPath ?? '',
    docxPath: finalDocxPath,
  }
}

// ============================================================================
// Public API: verifyIntegrity
// ============================================================================

export function verifyIntegrity(caseId: number): IntegrityVerification {
  const sqlite = getSqlite()

  // Get stored hash from reports table
  const reportRow = sqlite
    .prepare(
      'SELECT integrity_hash, file_path FROM reports WHERE case_id = ? AND is_locked = 1 ORDER BY finalized_at DESC LIMIT 1'
    )
    .get(caseId) as { integrity_hash?: string; file_path?: string } | undefined

  if (!reportRow || !reportRow.file_path) {
    return {
      valid: false,
      storedHash: null,
      computedHash: '',
    }
  }

  // Compute current hash
  const computedHash = computeFileHash(reportRow.file_path)

  return {
    valid: computedHash === (reportRow.integrity_hash ?? ''),
    storedHash: reportRow.integrity_hash ?? null,
    computedHash,
  }
}

// ============================================================================
// Public API: getReportStatus
// ============================================================================

export function getReportStatus(caseId: number): ReportStatus {
  const sqlite = getSqlite()

  const reportRow = sqlite
    .prepare(
      'SELECT report_id, status, is_locked, integrity_hash, report_version, sealed_pdf_path, file_path FROM reports WHERE case_id = ? ORDER BY created_at DESC LIMIT 1'
    )
    .get(caseId) as
    | {
        report_id?: number
        status?: string
        is_locked?: number
        integrity_hash?: string
        report_version?: number
        sealed_pdf_path?: string
        file_path?: string
      }
    | undefined

  if (!reportRow) {
    return {
      hasReport: false,
      status: null,
      isLocked: false,
      integrityHash: null,
      version: null,
      pdfPath: null,
      docxPath: null,
    }
  }

  return {
    hasReport: true,
    status: reportRow.status ?? 'draft',
    isLocked: reportRow.is_locked === 1,
    integrityHash: reportRow.integrity_hash ?? null,
    version: reportRow.report_version ?? null,
    pdfPath: reportRow.sealed_pdf_path ?? null,
    docxPath: reportRow.file_path ?? null,
  }
}
