/**
 * Writer deterministic template fallback.
 *
 * When Claude returns an empty-sections or malformed WriterOutput, this
 * module builds a minimal WriterOutput from structured case data so the
 * DOCX generator never produces an empty file. Every section is marked
 * `content_type: 'draft_requiring_revision'` and given low confidence so
 * the clinician knows the content was assembled, not narrated.
 *
 * The 6 required sections cover the same ground as Claude's prompt, but
 * with placeholder prose drawn from patient_intake, patient_onboarding,
 * diagnoses, and test_results. Where a datum is missing, the section
 * contains a bracketed `[needs review]` marker rather than a blank.
 *
 * Callers:
 *   src/main/agents/writer.ts, after Zod validation fails against Claude
 *   output, call buildTemplateOutput() to produce a safe fallback.
 */

import type { WriterOutput, WriterSection } from './writer'
import type { IngestorOutput } from './ingestor'

interface TemplateInputs {
  readonly caseId: string
  readonly evaluationType?: string
  readonly ingestor: IngestorOutput | null
  readonly selectedDiagnoses: readonly { readonly diagnosis_name: string; readonly icd_code?: string; readonly clinician_notes?: string }[]
  readonly ruledOutDiagnoses: readonly Record<string, unknown>[]
  readonly functionalImpairmentLevel?: string
  readonly forensicConclusions: Record<string, unknown>
}

const NEEDS_REVIEW = '[needs review]'

function safe(value: unknown, fallback: string = NEEDS_REVIEW): string {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'string') return value.trim() || fallback
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return fallback
}

function joinList(items: readonly unknown[], fallback: string = NEEDS_REVIEW): string {
  const strs = items.map((i) => safe(i, '')).filter((s) => s.length > 0)
  return strs.length > 0 ? strs.join(', ') : fallback
}

function makeSection(
  sectionNumber: number,
  sectionName: string,
  content: string,
  sources: readonly string[] = [],
): WriterSection {
  return {
    section_name: sectionName,
    section_number: sectionNumber,
    content,
    content_type: 'draft_requiring_revision',
    revision_notes:
      'Assembled from structured case data because the AI narrative pass failed validation. Review every paragraph and rewrite in your voice before using this draft.',
    sources,
    confidence: 0.35,
  }
}

/**
 * Build a deterministic WriterOutput from structured case inputs.
 */
export function buildTemplateOutput(inputs: TemplateInputs): WriterOutput {
  const now = new Date().toISOString()
  const sections: WriterSection[] = []

  // Section 1: Background History, drawn from ingestor demographics + referral
  const demographics = inputs.ingestor?.demographics as Record<string, unknown> | undefined
  const referralQuestions = (inputs.ingestor?.referral_questions ?? []) as readonly Record<string, unknown>[]
  sections.push(
    makeSection(
      1,
      'Background History',
      [
        `Age: ${safe(demographics?.age)}.`,
        `Sex: ${safe(demographics?.sex)}.`,
        `Education: ${safe(demographics?.education)}.`,
        `Occupation: ${safe(demographics?.occupation)}.`,
        `Referral questions: ${
          referralQuestions.length > 0
            ? joinList(referralQuestions.map((q) => safe(q.question, '')))
            : NEEDS_REVIEW
        }.`,
      ].join(' '),
      ['patient_intake', 'patient_onboarding', 'ingestor:demographics'],
    ),
  )

  // Section 2: Behavioral Observations, drawn from ingestor behavioral_observations_from_transcripts
  const behavioral = inputs.ingestor?.behavioral_observations_from_transcripts as
    | Record<string, unknown>
    | undefined
  const behavioralValues = behavioral ? Object.values(behavioral) : []
  const behavioralText =
    behavioralValues.length > 0
      ? behavioralValues.map((o) => safe(o, '')).filter((s) => s.length > 0).join(' ') || NEEDS_REVIEW
      : NEEDS_REVIEW
  sections.push(
    makeSection(
      2,
      'Behavioral Observations',
      behavioralText,
      ['ingestor:behavioral_observations'],
    ),
  )

  // Section 3: Test Results, drawn from ingestor test_administrations
  const tests = inputs.ingestor?.test_administrations as readonly Record<string, unknown>[] | undefined
  const testLines =
    tests && tests.length > 0
      ? tests.map((t) => {
          const name = safe(t.instrument)
          const date = safe(t.administration_date, 'date unknown')
          const validity = safe(t.validity_status, 'validity pending')
          return `${name} (${date}): ${validity}.`
        })
      : [NEEDS_REVIEW]
  sections.push(
    makeSection(
      3,
      'Test Results',
      testLines.join(' '),
      ['ingestor:test_administrations', 'test_scores'],
    ),
  )

  // Section 4: Diagnostic Impressions, drawn from confirmed diagnoses
  const dxLines = inputs.selectedDiagnoses.map((d) => {
    const code = d.icd_code ? ` (${d.icd_code})` : ''
    const notes = d.clinician_notes ? ` Clinician notes: ${d.clinician_notes}` : ''
    return `${d.diagnosis_name}${code}.${notes}`
  })
  const ruledOutCount = inputs.ruledOutDiagnoses.length
  const dxText = [
    dxLines.length > 0 ? `Confirmed diagnoses: ${dxLines.join(' ')}` : 'No diagnoses confirmed.',
    ruledOutCount > 0 ? `Ruled-out diagnoses: ${ruledOutCount} entries on file.` : 'No diagnoses ruled out.',
    `Functional impairment level: ${safe(inputs.functionalImpairmentLevel)}.`,
  ].join(' ')
  sections.push(
    makeSection(4, 'Diagnostic Impressions', dxText, ['diagnostic_decisions', 'diagnoses']),
  )

  // Section 5: Forensic / Functional Analysis, drawn from forensic conclusions
  const forensicEntries = Object.entries(inputs.forensicConclusions)
  const forensicText =
    forensicEntries.length > 0
      ? forensicEntries.map(([k, v]) => `${k.replace(/_/g, ' ')}: ${safe(v)}.`).join(' ')
      : NEEDS_REVIEW
  sections.push(
    makeSection(
      5,
      'Forensic and Functional Analysis',
      forensicText,
      ['diagnostician:forensic_conclusions'],
    ),
  )

  // Section 6: Recommendations, placeholder until clinician supplies them
  sections.push(
    makeSection(
      6,
      'Recommendations',
      `${NEEDS_REVIEW} Recommendations must be entered by the clinician based on the confirmed diagnoses and functional impairment level noted above.`,
      [],
    ),
  )

  return {
    case_id: inputs.caseId,
    version: '1.0-template-fallback',
    generated_at: now,
    sections,
    report_summary: {
      patient_name: typeof demographics?.name === 'string' ? demographics.name : undefined,
      evaluation_type: inputs.evaluationType,
      selected_diagnoses: inputs.selectedDiagnoses.map((d) => d.diagnosis_name),
      total_sections: sections.length,
      sections_requiring_revision: sections.length,
      estimated_revision_time_minutes: 45,
    },
  }
}
