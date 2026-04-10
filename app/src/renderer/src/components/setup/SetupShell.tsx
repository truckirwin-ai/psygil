/**
 * SetupShell, chrome around the active wizard step.
 *
 * Renders the Psygil logo, an 8-step progress rail, the active step's body,
 * and a footer with a Back button. The Next/Save button is owned by each
 * step component since each step has different validation requirements.
 */

import type { ReactNode } from 'react'

interface SetupShellProps {
  readonly stepLabels: readonly string[]
  readonly activeStep: number
  readonly furthestStep: number
  readonly onJumpToStep: (idx: number) => void
  readonly onBack: () => void
  readonly children: ReactNode
}

export default function SetupShell({
  stepLabels,
  activeStep,
  furthestStep,
  onJumpToStep,
  onBack,
  children,
}: SetupShellProps): React.JSX.Element {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Psygil Setup"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--bg)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        color: 'var(--text)',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Header */}
      <header
        style={{
          padding: '20px 32px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--panel)',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.5 }}>
          Psygil Setup
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          Step {activeStep + 1} of {stepLabels.length}: {stepLabels[activeStep]}
        </div>
      </header>

      {/* Progress rail */}
      <nav
        aria-label="Setup steps"
        style={{
          padding: '16px 32px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          overflowX: 'auto',
        }}
      >
        {stepLabels.map((label, idx) => {
          const isActive = idx === activeStep
          const isReached = idx <= furthestStep
          const isClickable = idx <= furthestStep
          return (
            <button
              key={label}
              type="button"
              onClick={() => isClickable && onJumpToStep(idx)}
              disabled={!isClickable}
              aria-current={isActive ? 'step' : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 12px',
                border: '1px solid var(--border)',
                borderRadius: 4,
                background: isActive
                  ? 'var(--accent)'
                  : isReached
                    ? 'var(--highlight)'
                    : 'var(--bg)',
                color: isActive ? '#fff' : 'var(--text)',
                fontSize: 12,
                fontWeight: isActive ? 600 : 400,
                cursor: isClickable ? 'pointer' : 'not-allowed',
                opacity: isClickable ? 1 : 0.5,
                whiteSpace: 'nowrap',
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  border: '1px solid currentColor',
                  fontSize: 10,
                  fontWeight: 600,
                }}
              >
                {idx + 1}
              </span>
              {label}
            </button>
          )
        })}
      </nav>

      {/* Body */}
      <main
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '32px 48px',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <div style={{ width: '100%', maxWidth: 720 }}>{children}</div>
      </main>

      {/* Footer */}
      <footer
        style={{
          padding: '12px 32px',
          borderTop: '1px solid var(--border)',
          background: 'var(--panel)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <button
          type="button"
          onClick={onBack}
          disabled={activeStep === 0}
          style={{
            padding: '8px 16px',
            background: 'transparent',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            cursor: activeStep === 0 ? 'not-allowed' : 'pointer',
            opacity: activeStep === 0 ? 0.4 : 1,
            fontSize: 13,
          }}
        >
          ← Back
        </button>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
          Your information stays on this machine. No data is sent anywhere
          during setup except an API key test if you choose to enable AI.
        </div>
      </footer>
    </div>
  )
}
