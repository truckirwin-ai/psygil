import React from 'react'

/**
 * PipelinePanel
 *
 * Renders the bottom panel of the center column showing the 6-stage evaluation pipeline.
 * - Completed stages shown in their color at 0.5 opacity with ✓ prefix
 * - Current stage in full color with ● prefix and bold styling
 * - Future stages outlined with ○ prefix
 */

interface PipelinePanelProps {
  currentStage: string | null
}

// Stage colors (from design system — these are MANDATORY)
const STAGE_COLORS: Record<string, string> = {
  onboarding: '#2196f3',
  testing: '#9c27b0',
  interview: '#e91e63',
  diagnostics: '#ff9800',
  review: '#ff5722',
  complete: '#4caf50',
}

// Stage indices for determining progression
const STAGE_IDX: Record<string, number> = {
  onboarding: 0,
  testing: 1,
  interview: 2,
  diagnostics: 3,
  review: 4,
  complete: 5,
}

const STAGES = ['Onboarding', 'Testing', 'Interview', 'Diagnostics', 'Review', 'Complete']
const STAGE_KEYS = ['onboarding', 'testing', 'interview', 'diagnostics', 'review', 'complete']

export const PipelinePanel: React.FC<PipelinePanelProps> = ({ currentStage }) => {
  // Normalize current stage
  const normalizedStage = currentStage?.toLowerCase() || null
  const currentStageIdx = normalizedStage ? STAGE_IDX[normalizedStage] ?? -1 : -1

  return (
    <div
      style={{
        height: '80px',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg)',
        borderTop: '1px solid var(--border)',
      }}
    >
      {/* Panel Header */}
      <div
        style={{
          height: '32px',
          padding: '0 12px',
          background: 'var(--panel)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          fontSize: '11px',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          color: 'var(--text-secondary)',
          userSelect: 'none',
          flexShrink: 0,
        }}
      >
        EVALUATION PIPELINE
      </div>

      {/* Pipeline Stages */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '0 12px',
          overflow: 'auto',
        }}
      >
        {STAGES.map((stageLabel, i) => {
          const stageKey = STAGE_KEYS[i]
          const color = STAGE_COLORS[stageKey]

          if (i < currentStageIdx) {
            // Completed stage — show with ✓ and reduced opacity
            return (
              <span
                key={stageKey}
                style={{
                  opacity: 0.5,
                  fontSize: '11px',
                  padding: '2px 8px',
                  borderRadius: '3px',
                  background: color,
                  color: '#fff',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                ✓ {stageLabel}
              </span>
            )
          } else if (i === currentStageIdx) {
            // Current stage — show with ● and bold, full color
            return (
              <span
                key={stageKey}
                style={{
                  fontSize: '11px',
                  padding: '2px 8px',
                  borderRadius: '3px',
                  background: color,
                  color: '#fff',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                ● {stageLabel}
              </span>
            )
          } else {
            // Future stage — show outlined with ○
            return (
              <span
                key={stageKey}
                style={{
                  fontSize: '11px',
                  padding: '2px 8px',
                  borderRadius: '3px',
                  border: '1px solid var(--border)',
                  color: 'var(--text-secondary)',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                ○ {stageLabel}
              </span>
            )
          }
        })}
      </div>
    </div>
  )
}

export default PipelinePanel
