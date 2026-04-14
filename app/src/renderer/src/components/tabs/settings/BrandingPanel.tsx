/**
 * BrandingPanel, white-label branding configuration for Psygil.
 * Rendered inside the Practice section of the Settings tab.
 * Calls branding:get, branding:save, branding:saveLogo IPC channels.
 * After save, main broadcasts 'branding:changed' so the Column 1 header
 * and window title update live via the BrandingProvider context.
 * Matches Psygil dark theme: #0D1117 bg, #161B22 panels, #2E75B6 accent, Inter font.
 */

import { useState, useEffect, useCallback, useRef } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface PracticeBranding {
  practiceName: string
  logoPath?: string
  logoData?: string
  primaryColor: string
  tagline?: string
  showAttribution: boolean
}

export interface BrandingPanelProps {
  onSave?: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared style tokens (match Psygil dark theme)
// ─────────────────────────────────────────────────────────────────────────────

const panelStyle: React.CSSProperties = {
  background: 'var(--panel)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: '16px 18px',
  marginBottom: 14,
}

const fieldLabelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--text-secondary)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  marginBottom: 5,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '7px 10px',
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  fontSize: 12.5,
  color: 'var(--text)',
  fontFamily: 'inherit',
  outline: 'none',
}

const btnPrimaryStyle: React.CSSProperties = {
  padding: '7px 16px',
  background: 'var(--accent)',
  color: '#fff',
  border: 'none',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 600,
  fontFamily: 'inherit',
}

const btnSecondaryStyle: React.CSSProperties = {
  padding: '7px 14px',
  background: 'var(--panel)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 500,
  fontFamily: 'inherit',
}

// ─────────────────────────────────────────────────────────────────────────────
// Default branding
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_BRANDING: PracticeBranding = {
  practiceName: '',
  logoPath: undefined,
  logoData: undefined,
  primaryColor: '#2E75B6',
  tagline: undefined,
  showAttribution: true,
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function BrandingPanel({ onSave }: BrandingPanelProps): React.JSX.Element {
  const [branding, setBranding] = useState<PracticeBranding>(DEFAULT_BRANDING)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [logoPreviewSrc, setLogoPreviewSrc] = useState<string | null>(null)
  const statusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Load branding on mount ────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        // ASSUMPTION: branding:get is exposed via window.psygil.branding.get()
        // @ts-ignore — branding namespace added in preload after PsygilApi base type
        const resp = await window.psygil.branding.get()
        if (!cancelled && resp.status === 'success') {
          const data = resp.data as PracticeBranding
          setBranding(data)
          if (data.logoData) {
            const ext = data.logoPath?.endsWith('.png') ? 'png'
              : data.logoPath?.endsWith('.jpg') || data.logoPath?.endsWith('.jpeg') ? 'jpeg'
              : 'png'
            setLogoPreviewSrc(`data:image/${ext};base64,${data.logoData}`)
          }
        }
      } catch (e) {
        console.error('[BrandingPanel] Failed to load branding:', e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  // ── Update field helper ───────────────────────────────────────────────────
  const updateField = useCallback(<K extends keyof PracticeBranding>(key: K, value: PracticeBranding[K]) => {
    setBranding((prev) => ({ ...prev, [key]: value }))
    setSaveStatus('idle')
  }, [])

  // ── Logo upload ───────────────────────────────────────────────────────────
  const handleLogoUpload = useCallback(async () => {
    try {
      // Use documents:pickFilesFrom with image extensions
      // ASSUMPTION: window.psygil.branding.saveLogo() handles file dialog + copy internally
      // @ts-ignore
      const resp = await window.psygil.branding.saveLogo()
      if (resp.status === 'success') {
        const data = resp.data as { logoPath: string; logoData: string }
        setBranding((prev) => ({ ...prev, logoPath: data.logoPath, logoData: data.logoData }))
        const ext = data.logoPath.endsWith('.png') ? 'png' : 'jpeg'
        setLogoPreviewSrc(`data:image/${ext};base64,${data.logoData}`)
        setSaveStatus('idle')
      }
    } catch (e) {
      console.error('[BrandingPanel] Logo upload failed:', e)
    }
  }, [])

  // ── Remove logo ───────────────────────────────────────────────────────────
  const handleLogoRemove = useCallback(() => {
    setBranding((prev) => ({ ...prev, logoPath: undefined, logoData: undefined }))
    setLogoPreviewSrc(null)
    setSaveStatus('idle')
  }, [])

  // ── Save branding ─────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    setSaving(true)
    setSaveStatus('idle')
    setSaveError(null)
    try {
      // @ts-ignore
      const resp = await window.psygil.branding.save(branding)
      if (resp.status === 'success') {
        setSaveStatus('saved')
        onSave?.()
        statusTimeoutRef.current = setTimeout(() => setSaveStatus('idle'), 2500)
      } else {
        setSaveStatus('error')
        setSaveError((resp as { message?: string }).message ?? 'Save failed')
      }
    } catch (e) {
      setSaveStatus('error')
      setSaveError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }, [branding, onSave])

  // ── Reset to defaults ─────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    if (!window.confirm('Reset branding to Psygil defaults? This will clear your practice name, logo, and color settings.')) return
    setBranding(DEFAULT_BRANDING)
    setLogoPreviewSrc(null)
    setSaveStatus('idle')
  }, [])

  // ── Cleanup timeout on unmount ────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current)
    }
  }, [])

  // ── Live preview ──────────────────────────────────────────────────────────
  const previewName = branding.practiceName || 'Your Practice Name'
  const previewColor = branding.primaryColor || '#2E75B6'

  if (loading) {
    return (
      <div style={panelStyle}>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '8px 0' }}>Loading branding settings...</div>
      </div>
    )
  }

  return (
    <div>
      {/* Panel header */}
      <div style={{ ...panelStyle, marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
          White-Label Branding
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Customize reports with your practice name, logo, and brand color. These appear on exported Word documents and PDF reports.
        </div>
      </div>

      {/* Practice name */}
      <div style={panelStyle}>
        <div style={{ marginBottom: 14 }}>
          <label style={fieldLabelStyle}>Practice Name</label>
          <input
            type="text"
            value={branding.practiceName}
            onChange={(e) => updateField('practiceName', e.target.value)}
            placeholder="e.g. Smith Forensic Psychology, PLLC"
            style={inputStyle}
          />
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
            Appears on report headers and footers. Leave blank to use Psygil attribution.
          </div>
        </div>

        {/* Tagline */}
        <div style={{ marginBottom: 0 }}>
          <label style={fieldLabelStyle}>Tagline <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
          <input
            type="text"
            value={branding.tagline ?? ''}
            onChange={(e) => updateField('tagline', e.target.value || undefined)}
            placeholder="e.g. Forensic & Clinical Psychology Services"
            style={inputStyle}
          />
        </div>
      </div>

      {/* Logo upload */}
      <div style={panelStyle}>
        <label style={fieldLabelStyle}>Practice Logo</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* 32×32 preview thumbnail */}
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 6,
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            {logoPreviewSrc ? (
              <img
                src={logoPreviewSrc}
                alt="Practice logo"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            ) : (
              <span style={{ fontSize: 24, opacity: 0.3 }}>🖼</span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button onClick={handleLogoUpload} style={btnSecondaryStyle}>
              {logoPreviewSrc ? 'Replace Logo' : 'Upload Logo'}
            </button>
            {logoPreviewSrc && (
              <button
                onClick={handleLogoRemove}
                style={{ ...btnSecondaryStyle, color: '#e54040', borderColor: 'rgba(229,64,64,0.3)', fontSize: 11, padding: '4px 10px' }}
              >
                Remove
              </button>
            )}
            <div style={{ fontSize: 10.5, color: 'var(--text-secondary)' }}>
              PNG or JPG recommended
            </div>
          </div>
        </div>
      </div>

      {/* Primary color */}
      <div style={panelStyle}>
        <label style={fieldLabelStyle}>Brand Color</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            type="color"
            value={branding.primaryColor}
            onChange={(e) => updateField('primaryColor', e.target.value)}
            style={{
              width: 40,
              height: 32,
              border: '1px solid var(--border)',
              borderRadius: 4,
              cursor: 'pointer',
              padding: 2,
              background: 'var(--bg)',
            }}
          />
          <input
            type="text"
            value={branding.primaryColor}
            onChange={(e) => {
              const val = e.target.value
              if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) updateField('primaryColor', val)
            }}
            placeholder="#2E75B6"
            style={{ ...inputStyle, width: 100, fontFamily: 'monospace' }}
          />
          <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
            Used for report headers and accents
          </span>
        </div>
      </div>

      {/* Attribution toggle */}
      <div style={panelStyle}>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 12.5,
            color: 'var(--text)',
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={branding.showAttribution}
            onChange={(e) => updateField('showAttribution', e.target.checked)}
            style={{ accentColor: 'var(--accent)', width: 14, height: 14 }}
          />
          Show "psygil.com | a Foundry SMB product" attribution in report footers
        </label>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6, paddingLeft: 24 }}>
          When unchecked and a practice name is set, footers show "[Practice Name] | Confidential" instead.
        </div>
      </div>

      {/* Live preview */}
      <div style={panelStyle}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>
          Report Header Preview
        </div>
        <div
          style={{
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          {/* Logo thumbnail */}
          {logoPreviewSrc ? (
            <img
              src={logoPreviewSrc}
              alt="Logo preview"
              style={{ width: 32, height: 32, objectFit: 'contain', borderRadius: 2, flexShrink: 0 }}
            />
          ) : (
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 2,
                background: previewColor,
                opacity: 0.25,
                flexShrink: 0,
              }}
            />
          )}

          {/* Practice name + tagline */}
          <div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: previewColor,
                lineHeight: 1.3,
              }}
            >
              {previewName}
            </div>
            {branding.tagline && (
              <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 1 }}>
                {branding.tagline}
              </div>
            )}
          </div>

          {/* Separator + case info */}
          <div style={{ marginLeft: 'auto', fontSize: 10.5, color: 'var(--text-secondary)', textAlign: 'right' }}>
            <div>Case #2026-0001</div>
            <div style={{ marginTop: 2, color: previewColor, fontWeight: 600 }}>
              Confidential
            </div>
          </div>
        </div>
      </div>

      {/* Save / Reset actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{ ...btnPrimaryStyle, opacity: saving ? 0.6 : 1 }}
        >
          {saving ? 'Saving...' : 'Save Branding'}
        </button>

        {saveStatus === 'saved' && (
          <span style={{ fontSize: 11.5, color: '#4caf50', fontWeight: 600 }}>
            ✓ Saved
          </span>
        )}
        {saveStatus === 'error' && saveError && (
          <span style={{ fontSize: 11.5, color: '#e54040' }}>
            Error: {saveError}
          </span>
        )}

        <button
          onClick={handleReset}
          style={{
            marginLeft: 'auto',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            fontSize: 11.5,
            cursor: 'pointer',
            textDecoration: 'underline',
            fontFamily: 'inherit',
            padding: 0,
          }}
        >
          Reset to Psygil defaults
        </button>
      </div>
    </div>
  )
}
