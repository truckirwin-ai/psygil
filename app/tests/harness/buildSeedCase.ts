/**
 * Creates a case at a specified pipeline stage with fixture documents.
 *
 * Designed for unit and component tests where a real DB is NOT available.
 * The function provisions the on-disk folder structure and returns a result
 * that mirrors what the main-process createCase handler returns.
 *
 * For tests that need a live DB row (e.g. a real SQLite insert), mark them
 * describe.todo() and wire them in Phase F.2 integration tests, where the
 * migration manifest is run against createTmpWorkspace({ seed: true }).
 */

import { mkdirSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import type { PipelineStage } from '../../src/shared/types/ipc'

export type { PipelineStage }

export interface SeedCaseOptions {
  /** Absolute path to the workspace root (from createTmpWorkspace). */
  readonly workspacePath: string
  /** Defaults to 'TEST-0001'. */
  readonly caseNumber?: string
  /** Defaults to 'onboarding'. */
  readonly stage?: PipelineStage
  /** When true, the DB row (if wired) includes diagnostic_decisions rows. */
  readonly gate2Approved?: boolean
  /** When true, the DB row (if wired) includes an audit attestation_signed row. */
  readonly attested?: boolean
}

export interface SeedCaseResult {
  /**
   * Numeric case id. In unit tests this is always 1 (no real DB).
   * Integration tests that wire a real DB will receive the actual insert id.
   */
  readonly caseId: number
  /** Absolute path to the case folder inside workspacePath/cases/. */
  readonly caseFolder: string
}

/**
 * The 7 standard subfolders every case folder must contain.
 * Mirrors the production scaffoldCaseSubfolders implementation.
 */
export const CASE_SUBFOLDERS = [
  '_Inbox',
  'Collateral',
  'Testing',
  'Interviews',
  'Diagnostics',
  'Reports',
  'Archive',
] as const

export type CaseSubfolder = (typeof CASE_SUBFOLDERS)[number]

const INTAKE_PLACEHOLDER = `# Intake Placeholder
case_number: {caseNumber}
stage: {stage}
`

export function buildSeedCase(opts: SeedCaseOptions): SeedCaseResult {
  const caseNumber = opts.caseNumber ?? 'TEST-0001'
  const stage = opts.stage ?? 'onboarding'
  const caseFolderName = `${caseNumber} Test, Examinee`
  const caseFolder = join(opts.workspacePath, 'cases', caseFolderName)

  // Create the case folder if it does not already exist.
  if (!existsSync(caseFolder)) {
    mkdirSync(caseFolder, { recursive: true })
  }

  // Provision all 7 subfolders.
  for (const sub of CASE_SUBFOLDERS) {
    const subPath = join(caseFolder, sub)
    mkdirSync(subPath, { recursive: true })
  }

  // Write a placeholder intake document.
  writeFileSync(
    join(caseFolder, '_Inbox', 'intake.md'),
    INTAKE_PLACEHOLDER
      .replace('{caseNumber}', caseNumber)
      .replace('{stage}', stage),
    'utf-8',
  )

  // --- DB-level operations (gate2Approved, attested) ---
  // These require the main-process DB modules and a real SQLite connection.
  // They are intentionally not implemented here; tests that need real DB rows
  // are marked .todo and land in Phase F.2 integration tests.
  // The opts fields are accepted now so call sites compile without changes.

  return {
    caseId: 1,
    caseFolder,
  }
}
