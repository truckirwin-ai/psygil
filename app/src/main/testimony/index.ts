/**
 * Testimony Preparation Module
 *
 * Prepares case files for courtroom testimony:
 * - Collects final report (DOCX + PDF)
 * - Includes all test scores and supporting documents
 * - Generates case summary
 * - Exports audit trail for cross-examination defense
 */

import { mkdirSync, promises as fsPromises, existsSync, readdirSync } from 'fs'
import { join, basename } from 'path'
import { getCaseById } from '../cases'
import { loadWorkspacePath } from '../workspace'
import { getAuditTrail, exportAuditTrail } from '../audit'
import type { CaseRow } from '../../shared/types'

// ============================================================================
// Types
// ============================================================================

export interface TestimonyPackage {
  exportDir: string
  files: string[]
}

// ============================================================================
// Helper: Get case folder path
// ============================================================================

function getCaseFolderPath(caseId: number, workspacePath?: string): string {
  const wsPath = workspacePath ?? loadWorkspacePath()
  if (!wsPath) {
    throw new Error('Workspace not configured')
  }
  return join(wsPath, `case_${caseId}`)
}

// ============================================================================
// Helper: Generate case summary markdown
// ============================================================================

function generateCaseSummary(caseRow: CaseRow, auditTrail: any[]): string {
  const summary = `# Case Summary, ${caseRow.case_number}

## Examinee Information
- **Name:** ${caseRow.examinee_first_name} ${caseRow.examinee_last_name}
- **Date of Birth:** ${caseRow.examinee_dob ?? 'Not provided'}
- **Gender:** ${caseRow.examinee_gender ?? 'Not provided'}

## Evaluation Details
- **Type:** ${caseRow.evaluation_type ?? 'General'}
- **Referral Source:** ${caseRow.referral_source ?? 'Not specified'}
- **Evaluation Questions:** ${caseRow.evaluation_questions ?? 'None specified'}
- **Created:** ${caseRow.created_at}
- **Current Stage:** ${caseRow.workflow_current_stage ?? 'Unknown'}

## Audit Trail Summary
- **Total Actions:** ${auditTrail.length}
- **Last Modified:** ${auditTrail[0]?.action_date ?? 'Unknown'}

### Key Actions
${auditTrail
  .slice(0, 10)
  .map((entry) => `- [${entry.action_date}] ${entry.action_type} (Actor: ${entry.actor_user_id})`)
  .join('\n')}

---

*This summary generated for testimony preparation purposes.*
*Complete audit trail available in \`audit_trail.csv\`.*
`

  return summary
}

// ============================================================================
// Helper: Copy directory recursively
// ============================================================================

async function copyDirRecursive(src: string, dest: string): Promise<string[]> {
  const files: string[] = []

  if (!existsSync(src)) {
    return files
  }

  mkdirSync(dest, { recursive: true })

  const entries = await fsPromises.readdir(src, { withFileTypes: true })

  for (const entry of entries) {
    const srcPath = join(src, entry.name)
    const destPath = join(dest, entry.name)

    if (entry.isDirectory()) {
      const subFiles = await copyDirRecursive(srcPath, destPath)
      files.push(...subFiles)
    } else {
      await fsPromises.copyFile(srcPath, destPath)
      files.push(basename(destPath))
    }
  }

  return files
}

// ============================================================================
// Public API: prepareTestimonyPackage
// ============================================================================

export async function prepareTestimonyPackage(caseId: number): Promise<TestimonyPackage> {
  // 1. Get case and validate
  const caseRow = getCaseById(caseId)
  if (!caseRow) {
    throw new Error(`Case ${caseId} not found`)
  }

  const caseFolder = getCaseFolderPath(caseId)
  const timestamp = new Date().toISOString().split('T')[0] // YYYY-MM-DD
  const exportDir = join(caseFolder, 'exports', `testimony_${timestamp}`)

  mkdirSync(exportDir, { recursive: true })

  const files: string[] = []

  // 2. Copy final report (DOCX + PDF)
  const reportDir = join(caseFolder, 'report', 'final')
  if (existsSync(reportDir)) {
    const reportFiles = await copyDirRecursive(reportDir, join(exportDir, 'report'))
    files.push(...reportFiles.map((f) => `report/${f}`))
  }

  // 3. Copy test score documents from Testing subfolder
  const testingDir = join(caseFolder, 'Testing')
  if (existsSync(testingDir)) {
    const testFiles = await copyDirRecursive(testingDir, join(exportDir, 'test_results'))
    files.push(...testFiles.map((f) => `test_results/${f}`))
  }

  // 4. Generate case summary
  const auditTrail = getAuditTrail(caseId)
  const caseSummary = generateCaseSummary(caseRow, auditTrail)
  const caseSummaryPath = join(exportDir, 'case_summary.md')
  await fsPromises.writeFile(caseSummaryPath, caseSummary, 'utf-8')
  files.push('case_summary.md')

  // 5. Export audit trail (CSV)
  const auditCsv = exportAuditTrail(caseId, 'csv')
  const auditPath = join(exportDir, 'audit_trail.csv')
  await fsPromises.writeFile(auditPath, auditCsv, 'utf-8')
  files.push('audit_trail.csv')

  console.log(`[testimony] Prepared package: ${exportDir}`)

  return {
    exportDir,
    files,
  }
}
