/**
 * SetupWizard, full-screen 8-step setup flow.
 *
 * Renders when SetupConfig.setupState !== 'complete'. Resumes at the
 * appropriate step based on the persisted state. Uses window.psygil.setup.*
 * for all backend operations.
 *
 * Architectural notes:
 *  - The wizard owns SetupConfig as React state. After every step save, the
 *    main process returns the updated config and we mirror it locally.
 *  - activeStepIndex is a UI-only cursor; persisted setupState only moves
 *    forward, but the user can navigate back to re-edit a completed step.
 *  - No PHI is collected here. The wizard handles license, storage, practice
 *    identity, AI provider metadata, appearance, and clinical preferences.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SetupConfig, SetupState } from '../../../../shared/types/setup'
import SetupShell from './SetupShell'
import StepSidecar from './steps/StepSidecar'
import StepLicense from './steps/StepLicense'
import StepStorage from './steps/StepStorage'
import StepPractice from './steps/StepPractice'
import StepAi from './steps/StepAi'
import StepAppearance from './steps/StepAppearance'
import StepClinical from './steps/StepClinical'
import StepComplete from './steps/StepComplete'

interface SetupWizardProps {
  /** Called once setupState transitions to 'complete'. */
  readonly onComplete: () => void
  /**
   * Called when the user clicks "Create First Case" on the completion step.
   * The host should open the intake modal after the wizard unmounts.
   */
  readonly onCreateFirstCase?: () => void
}

const STEP_LABELS: readonly string[] = [
  'Sidecar',
  'License',
  'Storage',
  'Practice',
  'AI Assistant',
  'Appearance',
  'Clinical',
  'Done',
]

const STATE_TO_STEP_INDEX: Record<SetupState, number> = {
  fresh: 0,
  sidecar_verified: 1,
  license_entered: 2,
  storage_ready: 3,
  profile_done: 4,
  ai_configured: 5,
  prefs_done: 6,
  clinical_done: 7,
  complete: 7,
}

export default function SetupWizard({
  onComplete,
  onCreateFirstCase,
}: SetupWizardProps): React.JSX.Element {
  const [config, setConfig] = useState<SetupConfig | null>(null)
  const [activeStep, setActiveStep] = useState<number>(0)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Initial load and resume to the appropriate step
  useEffect(() => {
    let cancelled = false
    const load = async (): Promise<void> => {
      try {
        const resp = await window.psygil.setup.getConfig()
        if (cancelled) return
        if (resp.status !== 'success') {
          setError(resp.message)
          setLoading(false)
          return
        }
        setConfig(resp.data.config)
        setActiveStep(STATE_TO_STEP_INDEX[resp.data.config.setupState] ?? 0)
        setLoading(false)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : String(err))
        setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const handleConfigUpdate = useCallback((updated: SetupConfig) => {
    setConfig(updated)
    if (updated.setupState === 'complete') {
      onComplete()
    }
  }, [onComplete])

  const goNext = useCallback(() => {
    setActiveStep((idx) => Math.min(idx + 1, STEP_LABELS.length - 1))
  }, [])

  const goBack = useCallback(() => {
    setActiveStep((idx) => Math.max(idx - 1, 0))
  }, [])

  const goToStep = useCallback((idx: number) => {
    if (config === null) return
    const maxAllowed = STATE_TO_STEP_INDEX[config.setupState] ?? 0
    // Allow jumping to any step at-or-before the furthest reached state
    if (idx <= maxAllowed) setActiveStep(idx)
  }, [config])

  const stepView = useMemo(() => {
    if (config === null) return null
    const shared = {
      config,
      onConfigUpdate: handleConfigUpdate,
      onAdvance: goNext,
    }
    switch (activeStep) {
      case 0: return <StepSidecar {...shared} />
      case 1: return <StepLicense {...shared} />
      case 2: return <StepStorage {...shared} />
      case 3: return <StepPractice {...shared} />
      case 4: return <StepAi {...shared} />
      case 5: return <StepAppearance {...shared} />
      case 6: return <StepClinical {...shared} />
      case 7: return (
        <StepComplete
          {...shared}
          onComplete={onComplete}
          onCreateFirstCase={onCreateFirstCase}
        />
      )
      default: return null
    }
  }, [activeStep, config, handleConfigUpdate, goNext, onComplete, onCreateFirstCase])

  if (loading) {
    return (
      <div style={fullScreenStyle}>
        <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Loading setup...</div>
      </div>
    )
  }

  if (error !== null || config === null) {
    return (
      <div style={fullScreenStyle}>
        <div style={{ color: 'var(--text)', maxWidth: 600, padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
            Setup could not start
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {error ?? 'Unknown error'}
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              marginTop: 16, padding: '8px 16px', background: 'var(--accent)',
              color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <SetupShell
      stepLabels={STEP_LABELS}
      activeStep={activeStep}
      furthestStep={STATE_TO_STEP_INDEX[config.setupState] ?? 0}
      onJumpToStep={goToStep}
      onBack={goBack}
    >
      {stepView}
    </SetupShell>
  )
}

const fullScreenStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'var(--bg)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9999,
}
