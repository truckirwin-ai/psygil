/**
 * Step 8: Completion summary.
 *
 * Displays a configuration summary, calls setup:complete to mark the
 * wizard as finished, and gives the user two ways to enter the app:
 * Open Psygil (Dashboard) or Create First Case.
 *
 * Phase E.2 additions:
 *  - Template preview: each provisioned template has a "Preview" button
 *    that opens it in the OS default viewer via window.psygil.templates.open.
 *  - "Reveal in Finder" button for the workspace storage path.
 */

import { useEffect, useState } from 'react'
import type { StepProps } from '../shared'
import { styles } from '../shared'

interface StepCompleteProps extends StepProps {
  readonly onComplete: () => void
  readonly onCreateFirstCase?: () => void
}

interface TemplateRow {
  readonly id: string
  readonly evalType: string
  readonly title: string
}

// ---------------------------------------------------------------------------
// Platform label for the reveal-in-finder button
// ---------------------------------------------------------------------------

function revealButtonLabel(): string {
  const platform =
    typeof window !== 'undefined' && 'psygil' in window && typeof (window.psygil as { platform?: string }).platform === 'string'
      ? (window.psygil as { platform: string }).platform
      : navigator.platform.toLowerCase()

  if (platform.startsWith('win')) return 'Show in File Explorer'
  if (platform === 'darwin' || platform.startsWith('mac')) return 'Reveal in Finder'
  return 'Open folder'
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function StepComplete({
  config,
  onConfigUpdate,
  onComplete,
  onCreateFirstCase,
}: StepCompleteProps): React.JSX.Element {
  const [finishing, setFinishing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [templates, setTemplates] = useState<readonly TemplateRow[]>([])

  // Load provisioned templates for the preview list
  useEffect(() => {
    void window.psygil.setup.getSupportedEvalTypes().then((resp) => {
      if (resp.status === 'success') {
        setTemplates(resp.data.templates)
      }
    })
  }, [])

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

  const handleRevealStorage = (): void => {
    const path = config.storage?.projectRoot
    if (path !== undefined && path.length > 0) {
      void window.psygil.workspace.openInFinder(path)
    }
  }

  const handlePreviewTemplate = (templateId: string): void => {
    void window.psygil.templates.open({ id: templateId })
  }

  const workspacePath = config.storage?.projectRoot ?? null

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
      value: workspacePath ?? '-',
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
              alignItems: 'center',
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

        {workspacePath !== null && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: 8,
              marginTop: 4,
            }}
          >
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {workspacePath}
            </span>
            <button
              type="button"
              style={{ ...styles.secondaryButton, fontSize: 12, padding: '4px 10px' }}
              onClick={handleRevealStorage}
            >
              {revealButtonLabel()}
            </button>
          </div>
        )}
      </div>

      {templates.length > 0 && (
        <div style={styles.card}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
            Provisioned templates
          </div>
          {templates.map((t) => (
            <div
              key={t.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '6px 0',
                borderBottom: '1px solid var(--border)',
                fontSize: 13,
              }}
            >
              <div>
                <span style={{ color: 'var(--text)', fontWeight: 500 }}>{t.title}</span>
                <span
                  style={{
                    fontSize: 11,
                    color: 'var(--text-secondary)',
                    marginLeft: 8,
                    background: 'var(--panel)',
                    padding: '1px 6px',
                    borderRadius: 3,
                    border: '1px solid var(--border)',
                  }}
                >
                  {t.evalType}
                </span>
              </div>
              <button
                type="button"
                style={{ ...styles.secondaryButton, fontSize: 12, padding: '4px 10px' }}
                onClick={() => handlePreviewTemplate(t.id)}
              >
                Preview
              </button>
            </div>
          ))}
        </div>
      )}

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
