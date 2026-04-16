/**
 * Writer section to pipeline-stage prerequisite mapping.
 *
 * Each report section depends on a specific clinical pipeline stage being
 * complete. If Writer runs before a required stage finishes, the matching
 * section is rewritten as a placeholder so partial report exports never
 * contain fabricated or premature narrative.
 *
 * Stage ordering: onboarding < testing < interview < diagnostics < review < complete
 */

import type { PipelineStage } from '../../shared/types/ipc'
import type { WriterOutput, WriterSection } from './writer'

const STAGE_INDEX: Record<PipelineStage, number> = {
  onboarding: 0,
  testing: 1,
  interview: 2,
  diagnostics: 3,
  review: 4,
  complete: 5,
}

const STAGE_LABEL: Record<PipelineStage, string> = {
  onboarding: 'Onboarding',
  testing: 'Testing',
  interview: 'Interview',
  diagnostics: 'Diagnostics',
  review: 'Review',
  complete: 'Complete',
}

/**
 * Return the pipeline stage that must be complete for the named section
 * to include real content. Matching is case-insensitive and keyword-based
 * so variations in Claude's section names still resolve correctly.
 */
function requiredStageFor(sectionName: string): PipelineStage {
  const lower = sectionName.toLowerCase()
  if (lower.includes('background') || lower.includes('history') || lower.includes('demographic')) {
    return 'onboarding'
  }
  if (lower.includes('behavioral') || lower.includes('interview') || lower.includes('mental status')) {
    return 'interview'
  }
  if (lower.includes('test') || lower.includes('instrument') || lower.includes('psychometric')) {
    return 'testing'
  }
  if (
    lower.includes('diagnos') ||
    lower.includes('forensic') ||
    lower.includes('functional') ||
    lower.includes('recommend') ||
    lower.includes('impression') ||
    lower.includes('formulation')
  ) {
    return 'diagnostics'
  }
  // Conservative default: require diagnostics so unclassified sections
  // cannot slip into an early draft.
  return 'diagnostics'
}

function isStageComplete(current: PipelineStage, required: PipelineStage): boolean {
  return STAGE_INDEX[current] > STAGE_INDEX[required]
}

/**
 * Rewrite any section whose required stage is not yet complete with a
 * placeholder, preserving ordering and metadata.
 */
export function applyStageGate(
  output: WriterOutput,
  currentStage: PipelineStage,
): WriterOutput {
  const gatedSections: WriterSection[] = output.sections.map((section) => {
    const required = requiredStageFor(section.section_name)
    if (isStageComplete(currentStage, required)) {
      return section
    }
    return {
      ...section,
      content: `Pending, ${STAGE_LABEL[required]} stage must complete before this section can be generated. Current stage: ${STAGE_LABEL[currentStage]}.`,
      content_type: 'draft_requiring_revision',
      revision_notes: `Section blocked by progressive gating; run the ${STAGE_LABEL[required]} stage, then re-run the Writer Agent.`,
      confidence: 0,
    }
  })

  const pendingCount = gatedSections.filter(
    (s) => s.content.startsWith('Pending, '),
  ).length

  return {
    ...output,
    sections: gatedSections,
    report_summary: {
      ...output.report_summary,
      sections_requiring_revision: Math.max(
        output.report_summary.sections_requiring_revision,
        pendingCount,
      ),
    },
  }
}
