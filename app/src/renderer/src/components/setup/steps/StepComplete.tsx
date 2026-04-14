/**
 * Step 8: Completion summary.
 *
 * Displays a configuration summary, calls setup:complete to mark the
 * wizard as finished, and gives the user two ways to enter the app:
 * Open Psygil (Dashboard) or Create First Case.
 */

import { useState } from 'react'
import type { StepProps } from '../shared'
import { styles } from '../shared'

interface StepCompleteProps extends StepProps {
  readonly onComplete: () => void
  readonly onCreateFirstCase?: () => void
}

export default function StepComplete({
  config,
  onConfigUpdate,
  onComplete,
  onCreateFirstCase,
}: StepCompleteProps): React.JSX.Element {
  const [finishing, setFinishing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const finalize = async (createCase: boolean): Promise<void> => {
    setError(null)
    setFinishing(true)
    try {
      const resp = await window.psygil.setup.complete()
      if (resp.status !== 'success') {
        setError(resp.message)
        setFinishing(false)
        return
      }
      onConfigUpdate(resp.data.config)
      onComplete()
      if (createCase && onCreateFirstCase !== undefined) {
        // Defer one tick so the wizard unmounts before the modal opens
        setTimeout(onCreateFirstCase, 0)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setFinishing(false)
    }
  }

  const summary: { label: string; value: string }[] = [
    {
      label: 'License',
      value:
        config.license !== null
          ? `${config.license.tier} (${config.license.seats} seat${config.license.seats === 1 ? '' : 's'})`
          : ',',
    },
    {
      label: 'Storage',
      value: config.storage?.projectRoot ?? '-',
    },
    {
      label: 'Practitioner',
      value:
        config.practice !== null
          ? `${config.practice.fullName}, ${config.practice.credentials}`
          : ',',
    },
    {
      label: 'License #',
      value:
        config.practice !== null
          ? `${config.practice.licenseNumber} (${config.practice.licenseState})`
          : ',',
    },
    {
      label: 'AI assistant',
      value: config.ai?.configured === true
        ? `${config.ai.provider} ${config.ai.model ?? ''} (UNID verified)`
        : 'Not configured',
    },
    {
      label: 'Theme',
      value: config.appearance?.theme ?? '-',
    },
    {
      label: 'Eval types',
      value: `${config.clinical?.evalTypes.length ?? 0} configured`,
    },
    {
      label: 'Instruments',
      value: `${config.clinical?.instruments.length ?? 0} in library`,
    },
  ]

  return (
    <div>
      <h2 style={styles.heading}>You're ready to go</h2>
      <p style={styles.subheading}>
        Setup is complete. Here is what we configured. You can change any of
        these from Settings later.
      </p>

      {error !== null && <div style={styles.errorBox}>{error}</div>}

      <div style={styles.card}>
        {summary.map((row) => (
          <div
            key={row.label}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '6px 0',
              borderBottom: '1px solid var(--border)',
              fontSize: 13,
            }}
          >
            <span style={{ color: 'var(--text-secondary)' }}>{row.label}</span>
            <span style={{ color: 'var(--text)', fontWeight: 500, textAlign: 'right' }}>
              {row.value}
            </span>
          </div>
        ))}
      </div>

      <div style={styles.footerActions}>
        <button
          type="button"
          style={styles.secondaryButton}
          onClick={() => void finalize(false)}
          disabled={finishing}
        >
          Open Psygil
        </button>
        <button
          type="button"
          style={styles.primaryButton}
          onClick={() => void finalize(true)}
          disabled={finishing}
        >
          {finishing ? 'Finishing...' : 'Create first case'}
        </button>
      </div>
    </div>
  )
}
