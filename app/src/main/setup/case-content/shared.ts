// =============================================================================
// Realistic case seeding, shared types and helpers
// =============================================================================
//
// Each case module exports a CaseRecord. The seeder walks an array of these
// and writes both DB records and disk files. All content is synthetic. No
// real patient data.
//
// Content-quality rules enforced:
//   - No generic AI names; varied ethnic pairings for a Colorado practice
//   - No em dashes (commas, semicolons, parentheses instead)
//   - No banned words (delve, leverage, utilize, robust, etc.)
//   - DSM-5-TR codes and names are accurate
//   - Test scores are psychometrically valid
//   - Timelines are internally consistent
// =============================================================================

export type Stage =
  | 'onboarding'
  | 'testing'
  | 'interview'
  | 'diagnostics'
  | 'review'
  | 'complete'

export type Subfolder =
  | '_Inbox'
  | 'Collateral'
  | 'Testing'
  | 'Interviews'
  | 'Diagnostics'
  | 'Reports'
  | 'Archive'

/**
 * One document to write for a case. The seeder places it at
 * {case_folder}/{subfolder}/{filename} and inserts a documents table row
 * with the content as indexed_content for future full-text search.
 */
export interface CaseDocument {
  readonly subfolder: Subfolder
  readonly filename: string
  readonly documentType: string // 'pdf' | 'docx' | 'other' per schema CHECK
  readonly content: string
  readonly description: string | null
}

/**
 * Minimal intake payload, mirroring the patient_intake table.
 */
export interface IntakePayload {
  readonly referral_type: 'court' | 'attorney' | 'self' | 'walk-in'
  readonly referral_source: string
  readonly eval_type: string
  readonly presenting_complaint: string
  readonly jurisdiction: string | null
  readonly charges: string | null
  readonly attorney_name: string | null
  readonly report_deadline: string | null
  readonly status: 'draft' | 'complete'
}

/**
 * One onboarding section (content goes into patient_onboarding.content).
 */
export interface OnboardingEntry {
  readonly section:
    | 'contact'
    | 'complaints'
    | 'family'
    | 'education'
    | 'health'
    | 'mental'
    | 'substance'
    | 'legal'
    | 'recent'
  readonly content: string
  readonly clinician_notes?: string
  readonly status: 'draft' | 'complete'
}

export interface CaseRecord {
  // Case metadata
  readonly caseNumber: string
  readonly firstName: string
  readonly lastName: string
  readonly dob: string
  readonly gender: 'M' | 'F' | 'NB'
  readonly evaluationType: string
  readonly referralSource: string
  readonly evaluationQuestions: string
  readonly stage: Stage
  readonly caseStatus: 'intake' | 'in_progress' | 'completed' | 'archived'
  readonly notes: string
  readonly complexity: 'simple' | 'moderate' | 'complex' | 'very-complex'

  /**
   * Wall-clock date the case was opened, in ISO YYYY-MM-DD format.
   * Should correspond to the earliest document referenced in the case
   * (usually the referral letter or court order). The seeder writes
   * this directly into cases.created_at.
   */
  readonly createdAt: string

  /**
   * Most recent activity date in ISO YYYY-MM-DD. For complete cases this
   * is the final report date. For in-progress cases it is close to the
   * current clock. Written to cases.last_modified.
   */
  readonly lastModified: string

  // Structured metadata for reports and UI summaries
  readonly summary: string
  readonly diagnoses: readonly string[]

  // Content to write
  readonly intake: IntakePayload
  readonly onboarding: readonly OnboardingEntry[]
  readonly documents: readonly CaseDocument[]
}

// ---------------------------------------------------------------------------
// Shared helpers for boilerplate headers and signatures
// ---------------------------------------------------------------------------

export const SYNTHETIC_BANNER =
  '[SYNTHETIC CASE DATA. All names, dates, charges, and facts in this ' +
  'document are fictitious and exist only for Psygil development and ' +
  'demonstration. Nothing here reflects a real patient or a real case.]'

export function clinicianSignature(): string {
  return (
    '\n\n' +
    'Respectfully submitted,\n\n' +
    'Jordan Whitfield, Psy.D., ABPP\n' +
    'Licensed Psychologist, Colorado #PSY-4312\n' +
    'Pike Forensics\n' +
    '1420 Larimer Street, Suite 410\n' +
    'Denver, CO 80202\n'
  )
}

export function reportHeader(
  caseNumber: string,
  examinee: string,
  dob: string,
  reportTitle: string,
  court: string,
): string {
  return (
    `${SYNTHETIC_BANNER}\n\n` +
    `PIKE FORENSICS\n` +
    `Forensic Psychology Services\n\n` +
    `${reportTitle.toUpperCase()}\n\n` +
    `Examinee: ${examinee}\n` +
    `Date of Birth: ${dob}\n` +
    `Case Number: ${caseNumber}\n` +
    `Court: ${court}\n` +
    `Date of Report: ${new Date().toISOString().slice(0, 10)}\n` +
    `Examiner: Jordan Whitfield, Psy.D., ABPP\n\n`
  )
}
