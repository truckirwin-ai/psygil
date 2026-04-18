/**
 * DangerZoneResources component - Phase E.6 stub.
 *
 * Renders a "Load demo resources" button that calls window.psygil.seed.demoCases()
 * if the IPC is available, otherwise shows a disabled button with a tooltip.
 *
 * Self-contained and ready to be wired into SettingsTab. Currently a stub
 * pending implementation of the backend seeding infrastructure.
 */

import { useCallback, useState } from 'react'

export interface DangerZoneResourcesProps {
  /** Called after demo resources load successfully. */
  onComplete?: () => void
}

const panelStyle: React.CSSProperties = {
  background: 'var(--panel)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: '16px 18px',
  marginBottom: 14,
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: 'var(--text-secondary)',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  marginBottom: 12,
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

const secondaryBtnStyle: React.CSSProperties = {
  ...btnBase,
  background: 'transparent',
  border: '1px solid var(--border)',
  color: 'var(--text-secondary)',
}

const disabledBtnStyle: React.CSSProperties = {
  ...secondaryBtnStyle,
  opacity: 0.5,
  cursor: 'not-allowed',
}

export default function DangerZoneResources({ onComplete }: DangerZoneResourcesProps): React.JSX.Element {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasSeedApi = typeof window !== 'undefined' && window.psygil?.seed?.demoCases !== undefined

  const handleLoadDemoResources = useCallback(async () => {
    if (!hasSeedApi || loading) return
    setLoading(true)
    setError(null)
    try {
      const resp = await window.psygil.seed.demoCases()
      if (resp.status !== 'success') {
        setError(resp.message)
        setLoading(false)
        return
      }
      onComplete?.()
      setLoading(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load demo resources'
      setError(msg)
      setLoading(false)
    }
  }, [hasSeedApi, loading, onComplete])

  return (
    <div style={panelStyle}>
      <div style={sectionTitleStyle}>Demo Resources</div>
      <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>
        Load sample writing samples and documentation into your workspace for testing or demonstration purposes.
      </p>
      {error !== null && (
        <p style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 12 }}>
          {error}
        </p>
      )}
      <button
        style={hasSeedApi && !loading ? secondaryBtnStyle : disabledBtnStyle}
        disabled={!hasSeedApi || loading}
        onClick={handleLoadDemoResources}
        title={hasSeedApi ? 'Load sample cases and resources' : 'Demo resource seeding is a future feature'}
      >
        {loading ? 'Loading...' : 'Load demo resources'}
      </button>
    </div>
  )
}
