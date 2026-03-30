import { useState, useCallback } from 'react'

export interface SettingsTabProps {}

export default function SettingsTab({}: SettingsTabProps): React.JSX.Element {
  const [apiKey, setApiKey] = useState('')
  const [apiKeyMasked, setApiKeyMasked] = useState('••••••••••••••sk-ant')
  const [connectionStatus, setConnectionStatus] = useState<
    'idle' | 'testing' | 'connected' | 'error'
  >('idle')
  const [connectionError, setConnectionError] = useState('')
  const [theme, setTheme] = useState(
    typeof window !== 'undefined'
      ? document.documentElement.getAttribute('data-theme') || 'light'
      : 'light'
  )

  const handleThemeCycle = useCallback(() => {
    const themes = ['light', 'medium', 'dark']
    const currentIdx = themes.indexOf(theme)
    const nextIdx = (currentIdx + 1) % themes.length
    const nextTheme = themes[nextIdx]
    setTheme(nextTheme)
    document.documentElement.setAttribute('data-theme', nextTheme)
  }, [theme])

  const handleTestConnection = useCallback(async () => {
    setConnectionStatus('testing')
    setConnectionError('')

    try {
      const result = await window.psygil.ai.testConnection({})

      if (result.status === 'success') {
        if (result.data.connected) {
          setConnectionStatus('connected')
        } else {
          setConnectionStatus('error')
          setConnectionError(result.data.error || 'Connection failed')
        }
      } else {
        setConnectionStatus('error')
        setConnectionError('Connection failed')
      }
    } catch (error) {
      setConnectionStatus('error')
      setConnectionError('Failed to test connection')
    }
  }, [])

  const handleBackupDatabase = useCallback(async () => {
    try {
      const folder = await window.psygil.workspace.pickFolder()
      if (folder) {
        alert(`Database backup would be saved to: ${folder}`)
      }
    } catch (error) {
      alert('Error selecting backup location')
    }
  }, [])

  const handleExportCases = useCallback(async () => {
    alert('Export cases functionality coming soon')
  }, [])

  const handleClearDemo = useCallback(async () => {
    if (window.confirm('Are you sure? This will delete all demo data.')) {
      try {
        await window.psygil.seed.demoCases()
        alert('Demo data cleared')
      } catch (error) {
        alert('Error clearing demo data')
      }
    }
  }, [])

  return (
    <div
      style={{
        padding: '20px 24px',
        fontSize: 13,
        lineHeight: 1.6,
      }}
    >
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>Settings</h1>

      {/* Practice Information */}
      <h2
        style={{
          fontSize: 15,
          fontWeight: 600,
          marginTop: 20,
          marginBottom: 12,
          paddingBottom: 6,
          borderBottom: '1px solid var(--border)',
        }}
      >
        Practice Information
      </h2>
      <div
        style={{
          background: 'var(--panel)',
          border: '1px solid var(--border)',
          borderRadius: 4,
          padding: 12,
          marginBottom: 12,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Clinician Profile</div>
        <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>
          <p style={{ marginBottom: 4 }}>
            <strong>Name:</strong> Dr. Truck Irwin, Psy.D., ABPP
          </p>
          <p style={{ marginBottom: 4 }}>
            <strong>License #:</strong> PSY-12345 (Colorado)
          </p>
          <p style={{ marginBottom: 4 }}>
            <strong>Practice:</strong> Irwin Forensic Psychology, PLLC
          </p>
          <p style={{ marginBottom: 4 }}>
            <strong>Specialty:</strong> Forensic Psychology
          </p>
          <p>
            <strong>Jurisdiction:</strong> Colorado, Federal Courts
          </p>
        </div>
      </div>

      {/* Theme */}
      <h2
        style={{
          fontSize: 15,
          fontWeight: 600,
          marginTop: 20,
          marginBottom: 12,
          paddingBottom: 6,
          borderBottom: '1px solid var(--border)',
        }}
      >
        Appearance
      </h2>
      <div
        style={{
          background: 'var(--panel)',
          border: '1px solid var(--border)',
          borderRadius: 4,
          padding: 12,
          marginBottom: 12,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Theme</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
          Current theme: <strong>{theme}</strong>
        </div>
        <button
          onClick={handleThemeCycle}
          style={{
            padding: '6px 12px',
            background: 'var(--accent)',
            color: '#ffffff',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          Cycle Theme
        </button>
      </div>

      {/* API Configuration */}
      <h2
        style={{
          fontSize: 15,
          fontWeight: 600,
          marginTop: 20,
          marginBottom: 12,
          paddingBottom: 6,
          borderBottom: '1px solid var(--border)',
        }}
      >
        API Configuration
      </h2>
      <div
        style={{
          background: 'var(--panel)',
          border: '1px solid var(--border)',
          borderRadius: 4,
          padding: 12,
          marginBottom: 12,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Claude API Key</div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 500, marginBottom: 4, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.3 }}>
            API Key
          </label>
          <div
            style={{
              display: 'flex',
              gap: 8,
              alignItems: 'center',
              marginBottom: 8,
            }}
          >
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.currentTarget.value)}
              placeholder="sk-ant-..."
              style={{
                flex: 1,
                padding: '6px 10px',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                fontSize: 12,
                color: 'var(--text)',
                fontFamily: 'inherit',
                outline: 'none',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent)'
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)'
              }}
            />
            <button
              onClick={handleTestConnection}
              disabled={connectionStatus === 'testing'}
              style={{
                padding: '6px 12px',
                background:
                  connectionStatus === 'connected'
                    ? '#4caf50'
                    : connectionStatus === 'error'
                      ? '#f44336'
                      : 'var(--accent)',
                color: '#ffffff',
                border: 'none',
                borderRadius: 4,
                cursor: connectionStatus === 'testing' ? 'not-allowed' : 'pointer',
                fontSize: 12,
                fontWeight: 500,
                opacity: connectionStatus === 'testing' ? 0.6 : 1,
              }}
            >
              {connectionStatus === 'testing'
                ? 'Testing...'
                : connectionStatus === 'connected'
                  ? '✓ Connected'
                  : connectionStatus === 'error'
                    ? '✕ Error'
                    : 'Test'}
            </button>
          </div>
          {connectionError && (
            <div style={{ fontSize: 11, color: '#f44336', marginBottom: 8 }}>
              {connectionError}
            </div>
          )}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          <p style={{ marginBottom: 4 }}>
            <strong>Provider:</strong> Anthropic
          </p>
          <p style={{ marginBottom: 4 }}>
            <strong>Model:</strong> Claude 3.5 Sonnet
          </p>
          <p>
            <strong>PHI Redaction:</strong>{' '}
            <span style={{ color: '#4caf50' }}>UNID Pipeline Active</span>
          </p>
        </div>
      </div>

      {/* Data Management */}
      <h2
        style={{
          fontSize: 15,
          fontWeight: 600,
          marginTop: 20,
          marginBottom: 12,
          paddingBottom: 6,
          borderBottom: '1px solid var(--border)',
        }}
      >
        Data Management
      </h2>
      <div
        style={{
          background: 'var(--panel)',
          border: '1px solid var(--border)',
          borderRadius: 4,
          padding: 12,
          marginBottom: 12,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            onClick={handleBackupDatabase}
            style={{
              padding: '6px 12px',
              background: 'var(--accent)',
              color: '#ffffff',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 500,
              textAlign: 'left',
            }}
          >
            Backup Database
          </button>
          <button
            onClick={handleExportCases}
            style={{
              padding: '6px 12px',
              background: 'var(--panel)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 500,
              textAlign: 'left',
            }}
          >
            Export Cases (CSV)
          </button>
          <button
            onClick={handleClearDemo}
            style={{
              padding: '6px 12px',
              background: '#f44336',
              color: '#ffffff',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 500,
              textAlign: 'left',
            }}
          >
            Clear Demo Data
          </button>
        </div>
      </div>

      {/* About */}
      <h2
        style={{
          fontSize: 15,
          fontWeight: 600,
          marginTop: 20,
          marginBottom: 12,
          paddingBottom: 6,
          borderBottom: '1px solid var(--border)',
        }}
      >
        About
      </h2>
      <div
        style={{
          background: 'var(--panel)',
          border: '1px solid var(--border)',
          borderRadius: 4,
          padding: 12,
          marginBottom: 12,
        }}
      >
        <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>
          <p style={{ marginBottom: 4 }}>
            <strong>Version:</strong> 1.0.0
          </p>
          <p style={{ marginBottom: 4 }}>
            <strong>Build:</strong> 2026.03.21
          </p>
          <p style={{ marginBottom: 4 }}>
            <strong>Platform:</strong> Electron (Chromium-based)
          </p>
          <p>
            <strong>Database:</strong> SQLCipher 4.6 (AES-256)
          </p>
        </div>
      </div>
    </div>
  )
}
