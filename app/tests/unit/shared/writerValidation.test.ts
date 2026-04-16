import { describe, it, expect } from 'vitest'
import { validateWriterOutput } from '../../../src/shared/types/writer'
import { buildTemplateOutput } from '../../../src/main/agents/writer-templates'

describe('validateWriterOutput', () => {
  it('accepts a valid minimum WriterOutput', () => {
    const raw = {
      case_id: 'CASE-001',
      version: '1.0',
      generated_at: '2026-04-16T00:00:00Z',
      report_summary: {
        selected_diagnoses: ['F33.1'],
        total_sections: 1,
        sections_requiring_revision: 0,
      },
      sections: [
        {
          section_name: 'Background',
          content: 'Client is a 34-year-old man referred by the court.',
          content_type: 'fully_generated',
          sources: [],
          confidence: 0.9,
        },
      ],
    }
    const result = validateWriterOutput(raw)
    expect(result.ok).toBe(true)
  })

  it('rejects empty sections array with reason empty_sections', () => {
    const raw = {
      case_id: 'CASE-001',
      version: '1.0',
      generated_at: '2026-04-16T00:00:00Z',
      report_summary: {
        selected_diagnoses: [],
        total_sections: 0,
        sections_requiring_revision: 0,
      },
      sections: [],
    }
    const result = validateWriterOutput(raw)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('empty_sections')
    }
  })

  it('rejects non-object input with reason not_object', () => {
    expect(validateWriterOutput(null).ok).toBe(false)
    expect(validateWriterOutput('some string').ok).toBe(false)
    expect(validateWriterOutput([]).ok).toBe(false)
  })

  it('rejects malformed section with reason schema', () => {
    const raw = {
      case_id: 'CASE-001',
      version: '1.0',
      generated_at: '2026-04-16T00:00:00Z',
      report_summary: {
        selected_diagnoses: [],
        total_sections: 1,
        sections_requiring_revision: 0,
      },
      sections: [
        {
          section_name: '',
          content: '',
          content_type: 'invalid_type',
          sources: [],
          confidence: 99,
        },
      ],
    }
    const result = validateWriterOutput(raw)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('schema')
      expect(result.issues.length).toBeGreaterThan(0)
    }
  })
})

describe('buildTemplateOutput', () => {
  it('produces a valid WriterOutput with 6 sections from minimal inputs', () => {
    const output = buildTemplateOutput({
      caseId: 'CASE-001',
      evaluationType: 'competency',
      ingestor: null,
      selectedDiagnoses: [{ diagnosis_name: 'Major Depressive Disorder', icd_code: 'F33.1' }],
      ruledOutDiagnoses: [],
      functionalImpairmentLevel: 'moderate',
      forensicConclusions: {},
    })

    expect(output.case_id).toBe('CASE-001')
    expect(output.sections.length).toBe(6)
    expect(output.report_summary.selected_diagnoses).toEqual(['Major Depressive Disorder'])

    // Every section must be flagged as requiring revision
    for (const s of output.sections) {
      expect(s.content_type).toBe('draft_requiring_revision')
      expect(s.content.length).toBeGreaterThan(0)
    }
  })

  it('template output passes its own WriterOutput schema', () => {
    const output = buildTemplateOutput({
      caseId: 'CASE-002',
      ingestor: null,
      selectedDiagnoses: [],
      ruledOutDiagnoses: [],
      forensicConclusions: {},
    })
    const validation = validateWriterOutput(output)
    expect(validation.ok).toBe(true)
  })
})
