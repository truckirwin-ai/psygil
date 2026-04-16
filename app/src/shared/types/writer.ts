/**
 * Writer agent output schemas and type guards.
 *
 * The Writer returns JSON that must be validated before it's persisted to
 * `agent_results` or handed to the DOCX generator. An empty-sections
 * output produces empty .docx files; a malformed output can crash the
 * document builder. Both are caught here at the Writer boundary.
 *
 * Callers:
 *   src/main/agents/writer.ts, validates the runAgent<WriterOutput> result
 *   and falls back to a deterministic template when validation fails.
 */

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Zod schemas matching the interfaces in src/main/agents/writer.ts
// ---------------------------------------------------------------------------

export const WriterSectionSchema = z.object({
  section_name: z.string().min(1, 'section_name is required'),
  section_number: z.number().int().nonnegative().optional(),
  content: z.string().min(1, 'content must not be empty'),
  content_type: z.enum(['fully_generated', 'draft_requiring_revision']),
  revision_notes: z.string().optional(),
  sources: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1),
})

export const WriterReportSummarySchema = z.object({
  patient_name: z.string().optional(),
  evaluation_dates: z.string().optional(),
  evaluation_type: z.string().optional(),
  selected_diagnoses: z.array(z.string()).default([]),
  total_sections: z.number().int().nonnegative(),
  sections_requiring_revision: z.number().int().nonnegative(),
  estimated_revision_time_minutes: z.number().nonnegative().optional(),
})

export const WriterOutputSchema = z.object({
  case_id: z.string().min(1),
  version: z.string().min(1),
  generated_at: z.string().min(1),
  sections: z.array(WriterSectionSchema).min(1, 'at least one section is required'),
  report_summary: WriterReportSummarySchema,
})

// ---------------------------------------------------------------------------
// Validation result
// ---------------------------------------------------------------------------

export interface WriterValidationOk {
  readonly ok: true
  readonly output: z.infer<typeof WriterOutputSchema>
}

export interface WriterValidationErr {
  readonly ok: false
  readonly reason: 'not_object' | 'schema' | 'empty_sections'
  readonly issues: readonly string[]
}

export type WriterValidationResult = WriterValidationOk | WriterValidationErr

/**
 * Validate a raw value (typically runAgent's parsed JSON) against the
 * Writer output schema. Non-throwing; returns a discriminated result.
 */
export function validateWriterOutput(raw: unknown): WriterValidationResult {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, reason: 'not_object', issues: ['writer output is not a JSON object'] }
  }

  const parsed = WriterOutputSchema.safeParse(raw)
  if (!parsed.success) {
    // Check for empty-sections specifically so the caller can log it
    // differently; all other structural problems get the generic reason.
    const issues = parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
    const emptySections = parsed.error.issues.some(
      (i) => i.path.join('.') === 'sections' && i.code === 'too_small',
    )
    return {
      ok: false,
      reason: emptySections ? 'empty_sections' : 'schema',
      issues,
    }
  }

  return { ok: true, output: parsed.data }
}
