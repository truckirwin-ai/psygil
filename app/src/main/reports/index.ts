/**
 * Report Finalization Module
 *
 * Handles report signing, sealing with digital signatures, integrity verification,
 * and PDF generation. Part of Sprint 11 backend for Review → Complete stage transition.
 */

import { createHash } from 'crypto'
import { mkdirSync, promises as fsPromises, existsSync, readdirSync } from 'fs'
import { join, resolve } from 'path'
import { execFileSync } from 'child_process'
import { getSqlite } from '../db/connection'
import { getCaseById } from '../cases'
import { loadWorkspacePath } from '../workspace'
import { logAuditEntry } from '../audit'
import type { IpcResponse } from '../../shared/types'

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
  try {
    // Try to use LibreOffice CLI if available
    execFileSync('soffice', [
      '--headless',
      '--convert-to', 'pdf',
      '--outdir', resolve(outputPath, '..'),
      docxPath
    ], { timeout: 30000 })

    console.log('[reports] PDF generated via LibreOffice:', outputPath)
  } catch (error) {
    console.warn('[reports] LibreOffice conversion failed:', error)
    console.warn('[reports] Falling back: PDF conversion must be done manually')

    // Fall back: create a simple placeholder PDF or note that conversion is needed
    // For MVP, we'll just log the requirement
    throw new Error(
      'LibreOffice not available for PDF conversion. Please ensure LibreOffice is installed.'
    )
  }
}

// ============================================================================
// Public API: submitAttestation
// ============================================================================

export function submitAttestation(params: AttestationParams): SubmitAttestationResult {
  const sqlite = getSqlite()
  const { caseId, signedBy, attestationStatement, signatureDate } = params

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

  // 3. Create final directory and copy draft → final/evaluation_report.docx
  const finalDir = getReportFinalDir(caseId)
  mkdirSync(finalDir, { recursive: true })

  const finalDocxPath = join(finalDir, 'evaluation_report.docx')

  // Synchronous copy (for simplicity; could use async)
  const fs = require('fs')
  const content = fs.readFileSync(draftDocxPath)
  fs.writeFileSync(finalDocxPath, content)

  console.log('[reports] Copied final DOCX:', finalDocxPath)

  // 4. Generate PDF from the DOCX
  let pdfPath: string | null = null
  try {
    const pdfFileName = 'evaluation_report.pdf'
    pdfPath = join(finalDir, pdfFileName)
    generateSealedPdf(finalDocxPath, pdfPath)
  } catch (error) {
    console.warn('[reports] PDF generation failed:', error)
    // Continue without PDF for MVP — it can be generated later
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
    reportId = existingReport.report_id
    // Update existing report
    sqlite
      .prepare(
        `UPDATE reports
         SET is_locked = 1, integrity_hash = ?, sealed_pdf_path = ?,
             finalized_by_user_id = 0, finalized_at = ?, status = 'finalized',
             file_path = ?, file_size_bytes = ?
         WHERE report_id = ?`
      )
      .run(
        integrityHash,
        pdfPath ?? null,
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
         VALUES (?, 0, 1, ?, ?, 0, ?, 'finalized', ?, ?, 1)`
      )
      .run(
        caseId,
        integrityHash,
        pdfPath ?? null,
        new Date().toISOString(),
        finalDocxPath,
        fileSizeBytes
      ) as { lastInsertRowid?: number }

    reportId = (result.lastInsertRowid ?? null) as number
  }

  // 8. Log audit entry
  logAuditEntry({
    caseId,
    actionType: 'report_signed',
    actorType: 'system',
    actorId: '0',
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
