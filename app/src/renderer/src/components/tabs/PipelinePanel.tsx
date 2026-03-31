import React, { useState, useCallback } from 'react'

/**
 * PipelinePanel
 *
 * Renders the bottom panel of the center column showing the 6-stage evaluation pipeline.
 * - Completed stages shown in their color at 0.5 opacity with ✓ prefix
 * - Current stage in full color with ● prefix and bold styling
 * - Future stages outlined with ○ prefix
 * - "Advance" button at the end — calls pipeline:check, confirms, then pipeline:advance
 */

interface PipelinePanelProps {
  readonly currentStage: string | null
  /** Must be provided for the advance button to appear */
  readonly caseId?: number | null
  /** Called after a successful stage advance so the parent can refresh case data */
  readonly onStageAdvanced?: () => void
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

export const PipelinePanel: React.FC<PipelinePanelProps> = ({
  currentStage,
  caseId,
  onStageAdvanced,
}) => {
  // Normalize current stage
  const normalizedStage = currentStage?.toLowerCase() || null
  const currentStageIdx = normalizedStage ? STAGE_IDX[normalizedStage] ?? -1 : -1
  const nextStageIdx = currentStageIdx + 1
  const nextStageLabel = nextStageIdx < STAGES.length ? STAGES[nextStageIdx] : null
  const isComplete = normalizedStage === 'complete'

  // Advance state
  const [advancing, setAdvancing] = useState(false)
  const [advanceError, setAdvanceError] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)

  const handleAdvanceClick = useCallback(async () => {
    if (caseId == null) return
    setAdvanceError(null)

    try {
      // First check if we can advance
      const checkResp = await window.psygil.pipeline.check({ caseId })
      if (checkResp.status === 'error') {
        setAdvanceError(checkResp.message)
        return
      }
      if (!checkResp.data.canAdvance) {
        setAdvanceError(checkResp.data.reason)
        return
      }
      // Show confirmation
      setShowConfirm(true)
    } catch {
      setAdvanceError('Failed to check pipeline conditions')
    }
  }, [caseId])

  const handleConfirmAdvance = useCallback(async () => {
    if (caseId == null) return
    setShowConfirm(false)
    setAdvancing(true)
    setAdvanceError(null)

    try {
      const resp = await window.psygil.pipeline.advance({ caseId })
      if (resp.status === 'error') {
        setAdvanceError(resp.message)
      } else {
        // Success — notify parent
        onStageAdvanced?.()
      }
    } catch {
      setAdvanceError('Failed to advance pipeline')
    } finally {
      setAdvancing(false)
    }
  }, [caseId, onStageAdvanced])

  const handleCancelAdvance = useCallback(() => {
    setShowConfirm(false)
  }, [])

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
          justifyContent: 'space-between',
          fontSize: '11px',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          color: 'var(--text-secondary)',
          userSelect: 'none',
          flexShrink: 0,
        }}
      >
        <span>EVALUATION PIPELINE</span>
        {/* Advance error shown inline in the header */}
        {advanceError && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 400,
              textTransform: 'none',
              letterSpacing: 0,
              color: '#f44336',
              maxWidth: 300,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={advanceError}
          >
            {advanceError}
          </span>
        )}
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

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Advance / Confirm buttons */}
        {caseId != null && !isComplete && nextStageLabel != null && (
          showConfirm ? (
            <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 11, color: 'var(--text)', whiteSpace: 'nowrap' }}>
                Advance to {nextStageLabel}?
              </span>
              <button
                onClick={handleConfirmAdvance}
                disabled={advancing}
                style={{
                  padding: '2px 10px',
                  fontSize: 11,
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: 3,
                  background: '#4caf50',
                  color: '#fff',
                  cursor: advancing ? 'wait' : 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {advancing ? 'Advancing\u2026' : 'Confirm'}
              </button>
              <button
                onClick={handleCancelAdvance}
                style={{
                  padding: '2px 10px',
                  fontSize: 11,
                  fontWeight: 500,
                  border: '1px solid var(--border)',
                  borderRadius: 3,
                  background: 'var(--panel)',
                  color: 'var(--text)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={handleAdvanceClick}
              disabled={advancing}
              style={{
                padding: '2px 10px',
                fontSize: 11,
                fontWeight: 500,
                border: '1px solid var(--border)',
                borderRadius: 3,
                background: 'var(--accent)',
                color: '#fff',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                transition: 'all 0.2s',
              }}
            >
              Advance to {nextStageLabel} →
            </button>
          )
        )}
      </div>
    </div>
  )
}

export default PipelinePanel
