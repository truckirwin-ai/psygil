/**
 * DangerZone component - Settings > Danger Zone panel.
 *
 * Provides a three-step confirmation flow for wiping all local Psygil data:
 *   Step 1: Informational warning panel with a red "Begin data removal" button.
 *   Step 2: Type the workspace folder name to enable the "Continue" button.
 *   Step 3: Final "Wipe now" button with a 5-second countdown.
 *
 * Also renders a secondary "Load demo resources" section (Phase E.6).
 * The wipe IPC calls window.psygil.uninstall.wipe({ confirmation }).
 * After success the component shows a "Restart app" prompt that calls
 * window.psygil.uninstall.relaunch().
 *
 * TODO: Wire DangerZone into SettingsTab (Phase C.3 leaves this for later
 * wiring; the component is exported and ready to use).
 *
 * Styling follows the Psygil dark theme: bg=#0D1117, panel=#161B22,
 * border=var(--border), accent=#2E75B6, danger=#C0392B.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import type { IpcResponse } from '../../../../shared/types/ipc'
import type { UninstallWipeResult } from '../../../../shared/types/ipc'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DangerZoneProps {
  /** Last path segment of the current workspace folder, shown in the prompt. */
  workspaceFolderName: string
  /** Called after a successful wipe AND after the user dismisses or relaunches. */
  onComplete?: () => void
}

// ---------------------------------------------------------------------------
// Style tokens
// ---------------------------------------------------------------------------

const panelStyle: React.CSSProperties = {
  background: 'var(--panel)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: '16px 18px',
  marginBottom: 14,
}

const dangerPanelStyle: React.CSSProperties = {
  ...panelStyle,
  borderColor: '#C0392B44',
  background: '#1a0a0a',
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: 'var(--text-secondary)',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  marginBottom: 12,
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--text-secondary)',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.04em',
  marginBottom: 5,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box' as const,
  padding: '7px 10px',
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  fontSize: 12.5,
  color: 'var(--text)',
  fontFamily: 'inherit',
  outline: 'none',
}

const btnBase: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: 4,
  fontSize: 12.5,
  fontWeight: 600,
  cursor: 'pointer',
  border: 'none',
  fontFamily: 'inherit',
}

const dangerBtnStyle: React.CSSProperties = {
  ...btnBase,
  background: '#C0392B',
  color: '#fff',
}

const disabledDangerBtnStyle: React.CSSProperties = {
  ...dangerBtnStyle,
  opacity: 0.4,
  cursor: 'not-allowed',
}

const secondaryBtnStyle: React.CSSProperties = {
  ...btnBase,
  background: 'transparent',
  border: '1px solid var(--border)',
  color: 'var(--text-secondary)',
}

const successPanelStyle: React.CSSProperties = {
  ...panelStyle,
  borderColor: '#27AE6044',
  background: '#0a1a0f',
  textAlign: 'center' as const,
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type Step = 'idle' | 'confirm-name' | 'countdown' | 'wiping' | 'done' | 'error'

export default function DangerZone({ workspaceFolderName, onComplete }: DangerZoneProps): React.JSX.Element {
  const [step, setStep] = useState<Step>('idle')
  const [nameInput, setNameInput] = useState('')
  const [countdown, setCountdown] = useState(5)
  const [errorMsg, setErrorMsg] = useState('')
  const [wipeLogPath, setWipeLogPath] = useState('')
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Start the 5-second countdown when we enter the countdown step
  useEffect(() => {
    if (step !== 'countdown') return
    setCountdown(5)
    countdownRef.current = setInterval(() => {
      setCountdown((n) => {
        if (n <= 1) {
          clearInterval(countdownRef.current!)
          countdownRef.current = null
          return 0
        }
        return n - 1
      })
    }, 1000)
    return () => {
      if (countdownRef.current !== null) {
        clearInterval(countdownRef.current)
        countdownRef.current = null
      }
    }
  }, [step])

  const handleBegin = useCallback(() => {
    setNameInput('')
    setErrorMsg('')
    setStep('confirm-name')
  }, [])

  const handleCancel = useCallback(() => {
    setStep('idle')
    setNameInput('')
    setErrorMsg('')
    setCountdown(5)
  }, [])

  const handleContinueToCountdown = useCallback(() => {
    if (nameInput.trim() !== workspaceFolderName) return
    setStep('countdown')
  }, [nameInput, workspaceFolderName])

  const handleWipeNow = useCallback(async () => {
    if (countdown > 0) return
    setStep('wiping')
    try {
      const resp: IpcResponse<UninstallWipeResult> = await window.psygil.uninstall.wipe({
        confirmation: workspaceFolderName,
      })
      if (resp.ok) {
        setWipeLogPath(resp.data.wipeLogPath)
        setStep('done')
      } else {
        setErrorMsg(resp.message)
        setStep('error')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Wipe failed'
      setErrorMsg(msg)
      setStep('error')
    }
  }, [countdown, workspaceFolderName])

  const handleRelaunch = useCallback(async () => {
    onComplete?.()
    await window.psygil.uninstall.relaunch()
  }, [onComplete])

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  function renderIdle(): React.JSX.Element {
    return (
      <div style={dangerPanelStyle}>
        <div style={sectionTitleStyle}>Danger Zone</div>
        <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>
          <strong style={{ color: '#E74C3C' }}>Remove all local data</strong> permanently deletes
          your encrypted database, API credentials, and configuration. Your case files on disk are
          not deleted automatically: you control those. This action cannot be undone.
        </p>
        <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.4 }}>
          A HIPAA accountability log entry is written before any data is removed and survives the
          wipe so administrators retain an accountability trail.
        </p>
        <button style={dangerBtnStyle} onClick={handleBegin}>
          Begin data removal
        </button>
      </div>
    )
  }

  function renderConfirmName(): React.JSX.Element {
    const matches = nameInput.trim() === workspaceFolderName
    return (
      <div style={dangerPanelStyle}>
        <div style={sectionTitleStyle}>Confirm: Type workspace folder name</div>
        <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 10, lineHeight: 1.5 }}>
          To continue, type the workspace folder name exactly:
          {' '}<code style={{ background: '#2a0a0a', padding: '1px 5px', borderRadius: 3, color: '#E74C3C' }}>
            {workspaceFolderName}
          </code>
        </p>
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Workspace folder name</label>
          <input
            style={{ ...inputStyle, borderColor: nameInput.length > 0 && !matches ? '#C0392B' : undefined }}
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder={workspaceFolderName}
            autoFocus
            spellCheck={false}
          />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            style={matches ? dangerBtnStyle : disabledDangerBtnStyle}
            disabled={!matches}
            onClick={handleContinueToCountdown}
          >
            Continue
          </button>
          <button style={secondaryBtnStyle} onClick={handleCancel}>
            Cancel
          </button>
        </div>
      </div>
    )
  }

  function renderCountdown(): React.JSX.Element {
    const ready = countdown === 0
    return (
      <div style={dangerPanelStyle}>
        <div style={sectionTitleStyle}>Final confirmation</div>
        <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.5 }}>
          This will permanently destroy all local Psygil data. There is no recovery.
        </p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            style={ready ? dangerBtnStyle : disabledDangerBtnStyle}
            disabled={!ready}
            onClick={handleWipeNow}
          >
            {ready ? 'Wipe now' : `Wipe now (${countdown})`}
          </button>
          <button style={secondaryBtnStyle} onClick={handleCancel}>
            Cancel
          </button>
        </div>
      </div>
    )
  }

  function renderWiping(): React.JSX.Element {
    return (
      <div style={dangerPanelStyle}>
        <div style={sectionTitleStyle}>Wiping data...</div>
        <p style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
          Removing encrypted database, credentials, and configuration. Please wait.
        </p>
      </div>
    )
  }

  function renderDone(): React.JSX.Element {
    return (
      <div style={successPanelStyle}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#27AE60', marginBottom: 10 }}>
          Data removed successfully
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, lineHeight: 1.5 }}>
          All local data has been wiped. The HIPAA accountability log has been preserved at:
        </p>
        <p style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-secondary)', marginBottom: 16, wordBreak: 'break-all' }}>
          {wipeLogPath}
        </p>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.5 }}>
          Restart the app to complete the process. Your case files on disk were not deleted.
        </p>
        <button style={dangerBtnStyle} onClick={handleRelaunch}>
          Restart app
        </button>
      </div>
    )
  }

  function renderError(): React.JSX.Element {
    return (
      <div style={dangerPanelStyle}>
        <div style={sectionTitleStyle}>Wipe failed</div>
        <p style={{ fontSize: 12.5, color: '#E74C3C', marginBottom: 14, lineHeight: 1.5 }}>
          {errorMsg}
        </p>
        <button style={secondaryBtnStyle} onClick={handleCancel}>
          Close
        </button>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Demo resources section (Phase E.6)
  // ---------------------------------------------------------------------------

  function renderDemoResources(): React.JSX.Element | null {
    // Do not show after a wipe (no data to load into)
    if (step === 'done') return null
    return (
      <div style={panelStyle}>
        <div style={sectionTitleStyle}>Demo Resources</div>
        <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>
          Load sample writing samples and documentation into your workspace for testing or
          demonstration purposes.
        </p>
        <button
          style={{ ...secondaryBtnStyle, opacity: 0.5, cursor: 'not-allowed' }}
          disabled
          title="Phase E.6 - Coming soon"
        >
          Load demo resources (coming soon)
        </button>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div>
      {step === 'idle' && renderIdle()}
      {step === 'confirm-name' && renderConfirmName()}
      {step === 'countdown' && renderCountdown()}
      {step === 'wiping' && renderWiping()}
      {step === 'done' && renderDone()}
      {step === 'error' && renderError()}
      {renderDemoResources()}
    </div>
  )
}
