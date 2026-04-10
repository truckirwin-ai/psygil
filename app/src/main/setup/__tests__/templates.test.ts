// Unit tests for template registry and token substitution, no fs.
import { describe, it, expect } from 'vitest'
import {
  REPORT_TEMPLATES,
  SUPPORTED_EVAL_TYPES,
  templatesForEvalTypes,
} from '../templates/registry'
import {
  applyTokens,
  buildPracticeTokenMap,
  renderText,
} from '../templates/generator'
import type { PracticeInfo } from '../state'

const SAMPLE_PRACTICE: PracticeInfo = {
  fullName: 'Dr. Jordan Whitfield',
  credentials: 'Psy.D., ABPP',
  licenseNumber: 'PSY12345',
  licenseState: 'Colorado',
  specialty: 'forensic',
  practiceName: 'Forensic Psychology Services',
  npi: null,
  practiceAddress: '1234 Grant Street, Denver, CO 80203',
  phone: '(303) 555-0100',
  logoRelPath: null,
}

describe('template registry', () => {
  it('contains exactly seven templates, one per eval type', () => {
    expect(REPORT_TEMPLATES.length).toBe(7)
    expect(SUPPORTED_EVAL_TYPES.length).toBe(7)
    const evalTypes = REPORT_TEMPLATES.map((t) => t.evalType).sort()
    expect(evalTypes).toEqual(
      ['ADHD Dx', 'CST', 'Custody', 'Fitness for Duty', 'Malingering', 'PTSD Dx', 'Risk Assessment'],
    )
  })

  it('every template id is unique and slug-safe', () => {
    const ids = REPORT_TEMPLATES.map((t) => t.id)
    const unique = new Set(ids)
    expect(unique.size).toBe(ids.length)
    for (const id of ids) {
      expect(id).toMatch(/^report_[a-z0-9_]+$/)
    }
  })

  it('every template has at least six sections and all include Signature', () => {
    for (const t of REPORT_TEMPLATES) {
      expect(t.sections.length).toBeGreaterThanOrEqual(6)
      const hasSignature = t.sections.some((s) => s.heading === 'Signature')
      expect(hasSignature, `${t.id} must have a Signature section`).toBe(true)
    }
  })

  it('templatesForEvalTypes filters correctly', () => {
    const subset = templatesForEvalTypes(['CST', 'PTSD Dx'])
    expect(subset.length).toBe(2)
    expect(subset.map((t) => t.evalType).sort()).toEqual(['CST', 'PTSD Dx'])
  })

  it('templatesForEvalTypes returns empty for unknown selection', () => {
    const subset = templatesForEvalTypes(['Nonexistent'])
    expect(subset.length).toBe(0)
  })
})

describe('token substitution', () => {
  it('buildPracticeTokenMap populates all expected keys', () => {
    const tokens = buildPracticeTokenMap(SAMPLE_PRACTICE)
    expect(tokens.PRACTICE_NAME).toBe('Forensic Psychology Services')
    expect(tokens.CLINICIAN_FULL_NAME).toBe('Dr. Jordan Whitfield')
    expect(tokens.CLINICIAN_CREDENTIALS).toBe('Psy.D., ABPP')
    expect(tokens.CLINICIAN_LICENSE).toBe('PSY12345')
    expect(tokens.CLINICIAN_STATE).toBe('Colorado')
    expect(tokens.PRACTICE_ADDRESS).toBe('1234 Grant Street, Denver, CO 80203')
    expect(tokens.PRACTICE_PHONE).toBe('(303) 555-0100')
  })

  it('applyTokens replaces only known placeholders', () => {
    const tokens = { FOO: 'bar', BAZ: 'qux' }
    const result = applyTokens('{{FOO}} and {{UNKNOWN}} and {{BAZ}}', tokens)
    expect(result).toBe('bar and {{UNKNOWN}} and qux')
  })

  it('applyTokens falls back to practice name when practiceName null', () => {
    const solo: PracticeInfo = { ...SAMPLE_PRACTICE, practiceName: null }
    const tokens = buildPracticeTokenMap(solo)
    expect(tokens.PRACTICE_NAME).toBe('Independent Forensic Practice')
  })

  it('renderText leaves patient placeholders intact', () => {
    const tokens = buildPracticeTokenMap(SAMPLE_PRACTICE)
    const cst = REPORT_TEMPLATES.find((t) => t.id === 'report_cst')!
    const text = renderText(cst, tokens)
    expect(text).toContain('Dr. Jordan Whitfield')
    expect(text).toContain('Colorado')
    // Patient placeholders remain
    expect(text).toContain('{{PATIENT_NAME}}')
    expect(text).toContain('{{CASE_NUMBER}}')
  })
})
