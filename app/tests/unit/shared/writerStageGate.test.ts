import { describe, it, expect } from 'vitest'
import { applyStageGate } from '../../../src/main/agents/writer-stage-gate'
import { buildTemplateOutput } from '../../../src/main/agents/writer-templates'

const buildFixture = () =>
  buildTemplateOutput({
    caseId: 'CASE-001',
    evaluationType: 'competency',
    ingestor: null,
    selectedDiagnoses: [{ diagnosis_name: 'F33.1' }],
    ruledOutDiagnoses: [],
    functionalImpairmentLevel: 'moderate',
    forensicConclusions: {},
  })

describe('applyStageGate', () => {
  it('gates all non-onboarding sections when current stage is testing', () => {
    const base = buildFixture()
    const gated = applyStageGate(base, 'testing')

    // Section 1 Background History, requires onboarding -> Background should NOT be gated
    // Section 2 Behavioral Observations, requires interview -> should be gated
    // Section 3 Test Results, requires testing -> should be gated (not yet complete)
    // Section 4 Diagnostic Impressions, requires diagnostics -> should be gated
    const background = gated.sections.find((s) => s.section_name.includes('Background'))
    expect(background?.content.startsWith('Pending')).toBe(false)

    const behavioral = gated.sections.find((s) => s.section_name.includes('Behavioral'))
    expect(behavioral?.content.startsWith('Pending')).toBe(true)

    const testResults = gated.sections.find((s) => s.section_name.includes('Test Results'))
    expect(testResults?.content.startsWith('Pending')).toBe(true)

    const dx = gated.sections.find((s) => s.section_name.includes('Diagnostic'))
    expect(dx?.content.startsWith('Pending')).toBe(true)
  })

  it('releases every section when stage is review', () => {
    const base = buildFixture()
    const gated = applyStageGate(base, 'review')

    for (const s of gated.sections) {
      expect(s.content.startsWith('Pending')).toBe(false)
    }
  })

  it('updates sections_requiring_revision to reflect gated count', () => {
    const base = buildFixture()
    const gated = applyStageGate(base, 'onboarding')
    // Only the Background section survives at onboarding stage
    const pending = gated.sections.filter((s) => s.content.startsWith('Pending')).length
    expect(gated.report_summary.sections_requiring_revision).toBeGreaterThanOrEqual(pending)
  })
})
