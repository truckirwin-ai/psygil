/**
 * Step 6: Appearance preferences.
 *
 * Lightweight step. Theme + font size + sidebar default. Theme is applied
 * to the wizard immediately so the user previews their choice.
 */

import { useEffect, useState } from 'react'
import type { StepProps } from '../shared'
import { styles } from '../shared'
import type {
  AppearanceConfig,
  Theme,
  FontSize,
} from '../../../../../shared/types/setup'

const THEMES: { value: Theme; label: string; sample: string }[] = [
  { value: 'light', label: 'Light', sample: '#ffffff' },
  { value: 'medium', label: 'Warm Parchment', sample: '#faf8f4' },
  { value: 'dark', label: 'Dark', sample: '#0d1117' },
]

const FONT_SIZES: { value: FontSize; label: string; px: number }[] = [
  { value: 'small', label: 'Small', px: 12 },
  { value: 'medium', label: 'Medium', px: 13 },
  { value: 'large', label: 'Large', px: 14 },
]

function defaultAppearance(): AppearanceConfig {
  return {
    theme: 'light',
    fontSize: 'medium',
    editorFont: 'system',
    sidebarDefault: 'expanded',
  }
}

export default function StepAppearance({
  config,
  onConfigUpdate,
  onAdvance,
}: StepProps): React.JSX.Element {
  const [appearance, setAppearance] = useState<AppearanceConfig>(
    config.appearance ?? defaultAppearance(),
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Live-preview the theme on the document while the user clicks
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', appearance.theme)
  }, [appearance.theme])

  const update = <K extends keyof AppearanceConfig>(key: K, value: AppearanceConfig[K]): void => {
    setAppearance((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async (): Promise<void> => {
    setError(null)
    setSaving(true)
    try {
      const resp = await window.psygil.setup.saveAppearance({ appearance })
      if (resp.status !== 'success') {
        setError(resp.message)
        setSaving(false)
        return
      }
      // Persist to localStorage so the main app picks up the same theme
      try {
        localStorage.setItem('psygil-theme', appearance.theme)
      } catch {
        // best effort
      }
      onConfigUpdate(resp.data.config)
      setSaving(false)
      onAdvance()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setSaving(false)
    }
  }

  return (
    <div>
      <h2 style={styles.heading}>Make it look the way you like</h2>
      <p style={styles.subheading}>
        Pick a theme and font size. You can change these any time from
        Settings.
      </p>

      {error !== null && <div style={styles.errorBox}>{error}</div>}

      <div style={styles.fieldRow}>
        <label style={styles.fieldLabel}>Theme</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {THEMES.map((t) => {
            const selected = appearance.theme === t.value
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => update('theme', t.value)}
                style={{
                  border: selected ? '2px solid var(--accent)' : '1px solid var(--border)',
                  borderRadius: 6,
                  padding: 16,
                  background: t.sample,
                  color: t.value === 'dark' ? '#c9d1d9' : '#1e1e1e',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                  textAlign: 'left',
                }}
              >
                <div>{t.label}</div>
                <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>{t.sample}</div>
              </button>
            )
          })}
        </div>
      </div>

      <div style={styles.fieldRow}>
        <label style={styles.fieldLabel}>Font size</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {FONT_SIZES.map((f) => {
            const selected = appearance.fontSize === f.value
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => update('fontSize', f.value)}
                style={{
                  flex: 1,
                  padding: 10,
                  border: selected ? '2px solid var(--accent)' : '1px solid var(--border)',
                  borderRadius: 4,
                  background: selected ? 'var(--highlight)' : 'var(--bg)',
                  color: 'var(--text)',
                  cursor: 'pointer',
                  fontSize: f.px,
                }}
              >
                {f.label}
              </button>
            )
          })}
        </div>
      </div>

      <div style={styles.fieldGrid2}>
        <div>
          <label style={styles.fieldLabel}>Editor font</label>
          <select
            style={styles.input}
            value={appearance.editorFont}
            onChange={(e) => update('editorFont', e.target.value as 'system' | 'monospace')}
          >
            <option value="system">System default</option>
            <option value="monospace">Monospace</option>
          </select>
        </div>
        <div>
          <label style={styles.fieldLabel}>Sidebar default</label>
          <select
            style={styles.input}
            value={appearance.sidebarDefault}
            onChange={(e) => update('sidebarDefault', e.target.value as 'expanded' | 'collapsed')}
          >
            <option value="expanded">Expanded</option>
            <option value="collapsed">Collapsed</option>
          </select>
        </div>
      </div>

      <div style={styles.footerActions}>
        <button
          type="button"
          style={styles.primaryButton}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save and continue'}
        </button>
      </div>
    </div>
  )
}
