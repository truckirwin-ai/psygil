/**
 * Psygil Settings Tab — Comprehensive configuration UI
 *
 * Left-sidebar tabbed navigation with these sections:
 *   Writing Samples, Style Guide, Templates, Documentation,
 *   Appearance, AI & Models, Practice, Data & Storage, About
 */

import { useState, useCallback, useEffect, useRef } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type SettingsSection =
  | 'writing-samples'
  | 'style-guide'
  | 'templates'
  | 'documentation'
  | 'appearance'
  | 'ai-models'
  | 'practice'
  | 'data-storage'
  | 'about'

interface ResourceFile {
  id: string
  category: string
  originalFilename: string
  storedPath: string
  fileSize: number
  mimeType: string
  uploadedAt: string
  phiStripped: boolean
}

interface SectionDef {
  id: SettingsSection
  label: string
  icon: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Section definitions
// ─────────────────────────────────────────────────────────────────────────────

const SECTIONS: SectionDef[] = [
  { id: 'writing-samples', label: 'Writing Samples', icon: '✍' },
  { id: 'style-guide', label: 'Style Guide', icon: '📐' },
  { id: 'templates', label: 'Templates', icon: '📋' },
  { id: 'documentation', label: 'Documentation', icon: '📖' },
  { id: 'appearance', label: 'Appearance', icon: '🎨' },
  { id: 'ai-models', label: 'AI & Models', icon: '🤖' },
  { id: 'practice', label: 'Practice', icon: '🏥' },
  { id: 'data-storage', label: 'Data & Storage', icon: '💾' },
  { id: 'about', label: 'About', icon: 'ℹ' },
]

// ─────────────────────────────────────────────────────────────────────────────
// Shared style helpers
// ─────────────────────────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: 'var(--panel)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: '16px 18px',
  marginBottom: 14,
}

const sectionTitle: React.CSSProperties = {
  fontSize: 17,
  fontWeight: 700,
  color: 'var(--text)',
  marginBottom: 4,
}

const sectionDesc: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--text-secondary)',
  marginBottom: 18,
  lineHeight: 1.5,
}

const fieldLabel: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--text-secondary)',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.04em',
  marginBottom: 5,
}

const textInput: React.CSSProperties = {
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

const btnPrimary: React.CSSProperties = {
  padding: '7px 14px',
  background: 'var(--accent)',
  color: '#fff',
  border: 'none',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 600,
  fontFamily: 'inherit',
}

const btnSecondary: React.CSSProperties = {
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

const btnDanger: React.CSSProperties = {
  padding: '7px 14px',
  background: '#e5404015',
  color: '#e54040',
  border: '1px solid #e5404040',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 600,
  fontFamily: 'inherit',
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ─────────────────────────────────────────────────────────────────────────────
// Resource list component (reused for Writing Samples, Templates, Docs)
// ─────────────────────────────────────────────────────────────────────────────

function ResourceListPanel({
  category,
  title,
  description,
  emptyMessage,
  uploadLabel,
}: {
  category: string
  title: string
  description: string
  emptyMessage: string
  uploadLabel: string
}): React.JSX.Element {
  const [files, setFiles] = useState<ResourceFile[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)

  const loadFiles = useCallback(async () => {
    try {
      const resp = await window.psygil.resources.list({ category })
      if (resp.status === 'success') {
        setFiles(resp.data as ResourceFile[])
      }
    } catch (err) {
      console.error(`[Settings] Failed to load ${category}:`, err)
    } finally {
      setLoading(false)
    }
  }, [category])

  useEffect(() => {
    void loadFiles()
  }, [loadFiles])

  const handleUpload = useCallback(async () => {
    setUploading(true)
    try {
      const resp = await window.psygil.resources.upload({ category })
      if (resp.status === 'success') {
        void loadFiles()
      }
    } catch (err) {
      console.error(`[Settings] Upload failed:`, err)
    } finally {
      setUploading(false)
    }
  }, [category, loadFiles])

  const handleDelete = useCallback(async (file: ResourceFile) => {
    if (!window.confirm(`Delete "${file.originalFilename}"? This cannot be undone.`)) return
    try {
      await window.psygil.resources.delete({ id: file.id, storedPath: file.storedPath })
      void loadFiles()
    } catch (err) {
      console.error(`[Settings] Delete failed:`, err)
    }
  }, [loadFiles])

  const handleOpen = useCallback(async (file: ResourceFile) => {
    try {
      await window.psygil.resources.open({ storedPath: file.storedPath })
    } catch (err) {
      console.error(`[Settings] Open failed:`, err)
    }
  }, [])

  return (
    <div>
      <div style={sectionTitle}>{title}</div>
      <div style={sectionDesc}>{description}</div>

      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
            {files.length} file{files.length !== 1 ? 's' : ''}
          </span>
          <button onClick={handleUpload} disabled={uploading} style={{ ...btnPrimary, opacity: uploading ? 0.6 : 1 }}>
            {uploading ? 'Importing…' : uploadLabel}
          </button>
        </div>

        {loading ? (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '12px 0' }}>Loading…</div>
        ) : files.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '20px 0', textAlign: 'center', lineHeight: 1.6 }}>
            {emptyMessage}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {files.map((f) => (
              <div
                key={f.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 10px',
                  borderRadius: 4,
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  marginBottom: 4,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }}
                    onClick={() => void handleOpen(f)}
                    title="Open file"
                  >
                    {f.originalFilename}
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {formatBytes(f.fileSize)}
                    {f.phiStripped && <span style={{ marginLeft: 8, color: '#4caf50', fontWeight: 600 }}>PHI stripped</span>}
                  </div>
                </div>
                <button
                  onClick={() => void handleOpen(f)}
                  style={{ ...btnSecondary, padding: '4px 8px', fontSize: 11 }}
                  title="Open"
                >
                  Open
                </button>
                <button
                  onClick={() => void handleDelete(f)}
                  style={{ ...btnDanger, padding: '4px 8px', fontSize: 11, background: 'transparent' }}
                  title="Delete"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Settings Tab
// ─────────────────────────────────────────────────────────────────────────────

export default function SettingsTab(): React.JSX.Element {
  const [activeSection, setActiveSection] = useState<SettingsSection>('writing-samples')

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* ── Left sidebar navigation ── */}
      <nav
        style={{
          width: 200,
          minWidth: 200,
          borderRight: '1px solid var(--border)',
          background: 'var(--panel)',
          padding: '12px 0',
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          overflowY: 'auto',
        }}
      >
        {SECTIONS.map((s) => {
          const active = s.id === activeSection
          return (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 16px',
                border: 'none',
                borderRadius: 0,
                background: active ? 'var(--highlight)' : 'transparent',
                color: active ? 'var(--accent)' : 'var(--text)',
                fontWeight: active ? 600 : 400,
                fontSize: 12.5,
                fontFamily: 'inherit',
                cursor: 'pointer',
                textAlign: 'left',
                width: '100%',
                borderLeft: active ? '3px solid var(--accent)' : '3px solid transparent',
              }}
            >
              <span style={{ fontSize: 14, width: 20, textAlign: 'center', flexShrink: 0 }}>{s.icon}</span>
              {s.label}
            </button>
          )
        })}
      </nav>

      {/* ── Right content area ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }}>
        {activeSection === 'writing-samples' && <WritingSamplesSection />}
        {activeSection === 'style-guide' && <StyleGuideSection />}
        {activeSection === 'templates' && <TemplatesSection />}
        {activeSection === 'documentation' && <DocumentationSection />}
        {activeSection === 'appearance' && <AppearanceSection />}
        {activeSection === 'ai-models' && <AiModelsSection />}
        {activeSection === 'practice' && <PracticeSection />}
        {activeSection === 'data-storage' && <DataStorageSection />}
        {activeSection === 'about' && <AboutSection />}
      </div>
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: Writing Samples
// ═══════════════════════════════════════════════════════════════════════════════

function WritingSamplesSection(): React.JSX.Element {
  return (
    <ResourceListPanel
      category="writing-samples"
      title="Writing Samples"
      description="Upload examples of your report writing. The AI agents will analyze these to learn your clinical voice, terminology preferences, and report structure. More samples = better style matching."
      emptyMessage="No writing samples uploaded yet. Add your best forensic reports, clinical letters, or court declarations to help the AI match your writing style."
      uploadLabel="+ Upload Samples"
    />
  )
}


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: Style Guide
// ═══════════════════════════════════════════════════════════════════════════════

function StyleGuideSection(): React.JSX.Element {
  const [styleRules, setStyleRules] = useState({
    personReference: 'third-person',      // 'first-person' | 'third-person'
    tensePreference: 'past',              // 'past' | 'present' | 'mixed'
    formalityLevel: 'formal-clinical',    // 'formal-clinical' | 'clinical-conversational'
    citationStyle: 'apa-7',              // 'apa-7' | 'none' | 'footnote'
    diagnosticTerminology: 'dsm-5-tr',   // 'dsm-5-tr' | 'icd-10'
    headerNumbering: true,
    includePageNumbers: true,
    signatureBlock: true,
  })

  const [customRules, setCustomRules] = useState('')

  return (
    <div>
      <div style={sectionTitle}>Style Guide</div>
      <div style={sectionDesc}>
        Configure report writing conventions. These rules are applied by the Writer and Editor agents when generating report prose. They will also be refined automatically as you upload more writing samples.
      </div>

      {/* Writing conventions */}
      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 14 }}>Writing Conventions</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px' }}>
          <div>
            <label style={fieldLabel}>Person Reference</label>
            <select
              value={styleRules.personReference}
              onChange={(e) => setStyleRules((p) => ({ ...p, personReference: e.target.value }))}
              style={{ ...textInput, cursor: 'pointer' }}
            >
              <option value="third-person">Third person ("The evaluee reported…")</option>
              <option value="first-person">First person ("I administered…")</option>
            </select>
          </div>

          <div>
            <label style={fieldLabel}>Verb Tense</label>
            <select
              value={styleRules.tensePreference}
              onChange={(e) => setStyleRules((p) => ({ ...p, tensePreference: e.target.value }))}
              style={{ ...textInput, cursor: 'pointer' }}
            >
              <option value="past">Past tense ("was administered")</option>
              <option value="present">Present tense ("is administered")</option>
              <option value="mixed">Mixed (present for findings, past for history)</option>
            </select>
          </div>

          <div>
            <label style={fieldLabel}>Formality Level</label>
            <select
              value={styleRules.formalityLevel}
              onChange={(e) => setStyleRules((p) => ({ ...p, formalityLevel: e.target.value }))}
              style={{ ...textInput, cursor: 'pointer' }}
            >
              <option value="formal-clinical">Formal clinical (court-ready)</option>
              <option value="clinical-conversational">Clinical conversational</option>
            </select>
          </div>

          <div>
            <label style={fieldLabel}>Citation Style</label>
            <select
              value={styleRules.citationStyle}
              onChange={(e) => setStyleRules((p) => ({ ...p, citationStyle: e.target.value }))}
              style={{ ...textInput, cursor: 'pointer' }}
            >
              <option value="apa-7">APA 7th Edition</option>
              <option value="none">No citations</option>
              <option value="footnote">Footnotes</option>
            </select>
          </div>

          <div>
            <label style={fieldLabel}>Diagnostic Terminology</label>
            <select
              value={styleRules.diagnosticTerminology}
              onChange={(e) => setStyleRules((p) => ({ ...p, diagnosticTerminology: e.target.value }))}
              style={{ ...textInput, cursor: 'pointer' }}
            >
              <option value="dsm-5-tr">DSM-5-TR</option>
              <option value="icd-10">ICD-10-CM</option>
            </select>
          </div>
        </div>
      </div>

      {/* Report formatting */}
      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 14 }}>Report Formatting</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {([
            ['headerNumbering', 'Number section headers (I, II, III…)'],
            ['includePageNumbers', 'Include page numbers in generated reports'],
            ['signatureBlock', 'Include signature block with credentials'],
          ] as const).map(([key, label]) => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, color: 'var(--text)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={styleRules[key] as boolean}
                onChange={(e) => setStyleRules((p) => ({ ...p, [key]: e.target.checked }))}
                style={{ accentColor: 'var(--accent)' }}
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      {/* Custom rules */}
      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Custom Style Rules</div>
        <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 10, lineHeight: 1.5 }}>
          Free-text instructions for the Writer agent. These are injected into the agent's system prompt.
        </div>
        <textarea
          value={customRules}
          onChange={(e) => setCustomRules(e.target.value)}
          placeholder={'Example rules:\n- Always refer to test results using the full instrument name on first mention\n- Use "evaluee" not "patient" or "client"\n- Begin the Impressions section with a diagnostic summary paragraph\n- Avoid passive voice where possible'}
          style={{
            ...textInput,
            minHeight: 120,
            resize: 'vertical',
            lineHeight: 1.6,
          }}
        />
      </div>
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: Templates
// ═══════════════════════════════════════════════════════════════════════════════

function TemplatesSection(): React.JSX.Element {
  return (
    <ResourceListPanel
      category="templates"
      title="Report Templates"
      description="Upload report templates and section outlines. These define the structure the Writer agent uses when generating report sections. Upload .docx or .txt files with your preferred section headings and ordering."
      emptyMessage="No templates uploaded. Add your standard forensic report templates to define the section structure the AI should follow when generating reports."
      uploadLabel="+ Upload Template"
    />
  )
}


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: Documentation
// ═══════════════════════════════════════════════════════════════════════════════

function DocumentationSection(): React.JSX.Element {
  return (
    <ResourceListPanel
      category="documentation"
      title="Reference Documentation"
      description="Upload reference materials — scoring manuals, legal guidelines, state statutes, clinical practice standards, or court requirements. These documents are used by the agents as reference context during report generation."
      emptyMessage="No reference documentation uploaded. Add scoring manuals, legal guidelines, or clinical standards that should inform report generation."
      uploadLabel="+ Upload Documentation"
    />
  )
}


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: Appearance
// ═══════════════════════════════════════════════════════════════════════════════

function AppearanceSection(): React.JSX.Element {
  const [theme, setTheme] = useState(
    document.documentElement.getAttribute('data-theme') || 'light'
  )
  const [fontSize, setFontSize] = useState(
    parseInt(localStorage.getItem('psygil-font-size') || '13', 10)
  )
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    localStorage.getItem('psygil-sidebar-collapsed') === 'true'
  )

  const themes: { id: string; label: string; preview: { bg: string; panel: string; accent: string; text: string } }[] = [
    { id: 'light', label: 'Light', preview: { bg: '#ffffff', panel: '#f3f3f3', accent: '#0078d4', text: '#1e1e1e' } },
    { id: 'medium', label: 'Warm', preview: { bg: '#faf8f4', panel: '#e6ddd0', accent: '#8b5e3c', text: '#2c2418' } },
    { id: 'dark', label: 'Dark', preview: { bg: '#0d1117', panel: '#161b22', accent: '#58a6ff', text: '#c9d1d9' } },
  ]

  const applyTheme = useCallback((id: string) => {
    setTheme(id)
    document.documentElement.setAttribute('data-theme', id)
    localStorage.setItem('psygil-theme', id)
  }, [])

  const applyFontSize = useCallback((size: number) => {
    setFontSize(size)
    document.documentElement.style.fontSize = `${size}px`
    localStorage.setItem('psygil-font-size', String(size))
  }, [])

  return (
    <div>
      <div style={sectionTitle}>Appearance</div>
      <div style={sectionDesc}>
        Customize the visual theme, font size, and layout density.
      </div>

      {/* Theme picker */}
      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 14 }}>Theme</div>
        <div style={{ display: 'flex', gap: 12 }}>
          {themes.map((t) => {
            const active = theme === t.id
            return (
              <button
                key={t.id}
                onClick={() => applyTheme(t.id)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                  padding: 12,
                  border: active ? `2px solid var(--accent)` : '2px solid var(--border)',
                  borderRadius: 8,
                  background: 'transparent',
                  cursor: 'pointer',
                  minWidth: 100,
                  fontFamily: 'inherit',
                }}
              >
                {/* Mini preview */}
                <div
                  style={{
                    width: 80,
                    height: 50,
                    borderRadius: 4,
                    background: t.preview.bg,
                    border: `1px solid ${t.preview.panel}`,
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ position: 'absolute', top: 0, left: 0, width: 22, height: '100%', background: t.preview.panel }} />
                  <div style={{ position: 'absolute', top: 6, left: 28, width: 30, height: 3, borderRadius: 1, background: t.preview.accent }} />
                  <div style={{ position: 'absolute', top: 14, left: 28, width: 44, height: 2, borderRadius: 1, background: t.preview.text, opacity: 0.3 }} />
                  <div style={{ position: 'absolute', top: 20, left: 28, width: 38, height: 2, borderRadius: 1, background: t.preview.text, opacity: 0.2 }} />
                  <div style={{ position: 'absolute', top: 26, left: 28, width: 42, height: 2, borderRadius: 1, background: t.preview.text, opacity: 0.15 }} />
                </div>
                <span style={{ fontSize: 11.5, fontWeight: active ? 700 : 500, color: active ? 'var(--accent)' : 'var(--text)' }}>
                  {t.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Font size */}
      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 14 }}>Interface Font Size</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <input
            type="range"
            min={11}
            max={16}
            step={1}
            value={fontSize}
            onChange={(e) => applyFontSize(parseInt(e.target.value, 10))}
            style={{ flex: 1, accentColor: 'var(--accent)' }}
          />
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', minWidth: 36, textAlign: 'center' }}>
            {fontSize}px
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-secondary)', marginTop: 4 }}>
          <span>Compact</span>
          <span>Default</span>
          <span>Large</span>
        </div>
      </div>
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: AI & Models
// ═══════════════════════════════════════════════════════════════════════════════

function AiModelsSection(): React.JSX.Element {
  // API key state
  const [apiKey, setApiKey] = useState('')
  const [hasKey, setHasKey] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'connected' | 'error'>('idle')
  const [connectionError, setConnectionError] = useState('')
  const [connectedModel, setConnectedModel] = useState('')
  const [saving, setSaving] = useState(false)

  // Model selection
  const [selectedModel, setSelectedModel] = useState('claude-sonnet-4-20250514')

  // Transcription
  const [whisperStatus, setWhisperStatus] = useState<{ available: boolean; model: string | null; sidecarReady: boolean } | null>(null)
  const [transcriptionLang, setTranscriptionLang] = useState('en')

  // Load existing state on mount
  useEffect(() => {
    void (async () => {
      try {
        const hasResp = await window.psygil.apiKey.has()
        if (hasResp.status === 'success') setHasKey(hasResp.data as boolean)
      } catch { /* ignore */ }

      try {
        const whisperResp = await window.psygil.whisper.status()
        if (whisperResp.status === 'success') setWhisperStatus(whisperResp.data as any)
      } catch { /* ignore */ }
    })()
  }, [])

  const handleSaveKey = useCallback(async () => {
    if (!apiKey.trim()) return
    setSaving(true)
    try {
      const resp = await window.psygil.apiKey.store({ key: apiKey.trim() })
      if (resp.status === 'success') {
        setHasKey(true)
        setApiKey('')
        setConnectionStatus('idle')
      }
    } catch (err) {
      console.error('[Settings] Failed to save API key:', err)
    } finally {
      setSaving(false)
    }
  }, [apiKey])

  const handleDeleteKey = useCallback(async () => {
    if (!window.confirm('Remove your Claude API key? AI features will stop working.')) return
    try {
      await window.psygil.apiKey.delete()
      setHasKey(false)
      setConnectionStatus('idle')
      setConnectedModel('')
    } catch (err) {
      console.error('[Settings] Failed to delete API key:', err)
    }
  }, [])

  const handleTestConnection = useCallback(async () => {
    setConnectionStatus('testing')
    setConnectionError('')
    try {
      const result = await window.psygil.ai.testConnection({})
      if (result.status === 'success' && result.data.connected) {
        setConnectionStatus('connected')
        setConnectedModel(result.data.model || '')
      } else {
        setConnectionStatus('error')
        setConnectionError(result.data?.error || 'Connection failed')
      }
    } catch {
      setConnectionStatus('error')
      setConnectionError('Failed to reach API')
    }
  }, [])

  return (
    <div>
      <div style={sectionTitle}>AI & Models</div>
      <div style={sectionDesc}>
        Configure the Claude API connection, model selection, and local transcription engine. These settings will eventually be bundled into your Psygil subscription.
      </div>

      {/* API Key */}
      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Claude API Key</div>
        <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>
          Your API key is encrypted using your operating system's secure keychain (macOS Keychain / Windows DPAPI). It never leaves this machine.
        </div>

        {hasKey ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{
              flex: 1,
              padding: '7px 10px',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              fontSize: 12.5,
              color: 'var(--text-secondary)',
              fontFamily: 'monospace',
            }}>
              sk-ant-••••••••••••••••
            </div>
            <button
              onClick={handleTestConnection}
              disabled={connectionStatus === 'testing'}
              style={{
                ...btnPrimary,
                background: connectionStatus === 'connected' ? '#4caf50'
                  : connectionStatus === 'error' ? '#e54040'
                  : undefined,
                opacity: connectionStatus === 'testing' ? 0.6 : 1,
              }}
            >
              {connectionStatus === 'testing' ? 'Testing…'
                : connectionStatus === 'connected' ? '✓ Connected'
                : connectionStatus === 'error' ? '✕ Failed'
                : 'Test Connection'}
            </button>
            <button onClick={handleDeleteKey} style={{ ...btnDanger, background: 'transparent' }}>Remove</button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-ant-api03-…"
              style={{ ...textInput, flex: 1, fontFamily: 'monospace' }}
              onKeyDown={(e) => e.key === 'Enter' && void handleSaveKey()}
            />
            <button onClick={handleSaveKey} disabled={saving || !apiKey.trim()} style={{ ...btnPrimary, opacity: saving || !apiKey.trim() ? 0.5 : 1 }}>
              {saving ? 'Saving…' : 'Save Key'}
            </button>
          </div>
        )}

        {connectionStatus === 'connected' && connectedModel && (
          <div style={{ fontSize: 11, color: '#4caf50', marginTop: 4 }}>
            Connected to {connectedModel}
          </div>
        )}
        {connectionError && (
          <div style={{ fontSize: 11, color: '#e54040', marginTop: 4 }}>{connectionError}</div>
        )}
      </div>

      {/* Model selection */}
      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>AI Model</div>
        <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>
          Select the Claude model used for all AI operations — report writing, diagnostics mapping, document ingestion, and interview summaries.
        </div>
        <select
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          style={{ ...textInput, cursor: 'pointer', maxWidth: 360 }}
        >
          <option value="claude-sonnet-4-20250514">Claude Sonnet 4 (Recommended — fast, accurate)</option>
          <option value="claude-opus-4-20250514">Claude Opus 4 (Highest quality — slower, higher cost)</option>
          <option value="claude-haiku-4-20250514">Claude Haiku 4 (Fastest — lower cost, lighter analysis)</option>
        </select>
      </div>

      {/* PHI Redaction */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>PHI Redaction Pipeline</div>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 3, background: '#4caf5018', color: '#4caf50' }}>ALWAYS ON</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          All patient data is redacted to anonymous UNIDs before being sent to the Claude API. PHI is rehydrated only after the response is received and stored locally. This pipeline cannot be disabled — it is a core HIPAA safeguard.
        </div>
      </div>

      {/* Transcription engine */}
      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Transcription Engine</div>
        <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>
          Live interview transcription runs entirely on this machine using faster-whisper. Audio never leaves your device.
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12, color: 'var(--text)' }}>
          <div>
            <span style={{ ...fieldLabel, marginBottom: 2 }}>Status</span>
            <div style={{ fontWeight: 600, color: whisperStatus?.sidecarReady ? '#4caf50' : '#e54040' }}>
              {whisperStatus?.sidecarReady ? 'Running' : 'Not available'}
            </div>
          </div>
          <div>
            <span style={{ ...fieldLabel, marginBottom: 2 }}>Model</span>
            <div>{whisperStatus?.model || 'base.en'}</div>
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <label style={fieldLabel}>Default Language</label>
          <select
            value={transcriptionLang}
            onChange={(e) => setTranscriptionLang(e.target.value)}
            style={{ ...textInput, cursor: 'pointer', maxWidth: 240 }}
          >
            <option value="en">English</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="de">German</option>
            <option value="pt">Portuguese</option>
            <option value="zh">Chinese</option>
            <option value="ja">Japanese</option>
            <option value="ko">Korean</option>
          </select>
        </div>
      </div>
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: Practice
// ═══════════════════════════════════════════════════════════════════════════════

function PracticeSection(): React.JSX.Element {
  const [profile, setProfile] = useState({
    clinicianName: '',
    credentials: '',
    licenseNumber: '',
    licenseState: '',
    practiceName: '',
    specialty: 'Forensic Psychology',
    jurisdictions: '',
    address: '',
    phone: '',
    email: '',
    npi: '',
  })

  const [saved, setSaved] = useState(false)

  const updateField = useCallback((field: string, value: string) => {
    setProfile((p) => ({ ...p, [field]: value }))
    setSaved(false)
  }, [])

  const handleSave = useCallback(() => {
    // TODO: persist via config:set IPC
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }, [])

  return (
    <div>
      <div style={sectionTitle}>Practice Information</div>
      <div style={sectionDesc}>
        Your clinician profile appears on generated reports, attestation pages, and expert declarations. This information is stored locally in the encrypted database.
      </div>

      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 14 }}>Clinician Profile</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 18px' }}>
          {([
            ['clinicianName', 'Full Name', 'Dr. Jane Smith, Psy.D., ABPP'],
            ['credentials', 'Credentials', 'Psy.D., ABPP (Forensic)'],
            ['licenseNumber', 'License Number', 'PSY-12345'],
            ['licenseState', 'License State', 'Colorado'],
            ['practiceName', 'Practice Name', 'Smith Forensic Psychology, PLLC'],
            ['specialty', 'Specialty', 'Forensic Psychology'],
            ['jurisdictions', 'Jurisdictions', 'Colorado, Federal Courts'],
            ['npi', 'NPI Number', '1234567890'],
            ['phone', 'Phone', '(303) 555-0100'],
            ['email', 'Email', 'dr.smith@example.com'],
          ] as [string, string, string][]).map(([key, label, placeholder]) => (
            <div key={key}>
              <label style={fieldLabel}>{label}</label>
              <input
                type="text"
                value={(profile as any)[key]}
                onChange={(e) => updateField(key, e.target.value)}
                placeholder={placeholder}
                style={textInput}
              />
            </div>
          ))}
        </div>

        <div style={{ marginTop: 12 }}>
          <label style={fieldLabel}>Office Address</label>
          <textarea
            value={profile.address}
            onChange={(e) => updateField('address', e.target.value)}
            placeholder="123 Professional Plaza, Suite 400&#10;Denver, CO 80203"
            style={{ ...textInput, minHeight: 56, resize: 'vertical' }}
          />
        </div>

        <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={handleSave} style={btnPrimary}>Save Profile</button>
          {saved && <span style={{ fontSize: 11, color: '#4caf50', fontWeight: 600 }}>Saved</span>}
        </div>
      </div>
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: Data & Storage
// ═══════════════════════════════════════════════════════════════════════════════

function DataStorageSection(): React.JSX.Element {
  const [workspacePath, setWorkspacePath] = useState('')
  const [dbHealth, setDbHealth] = useState<{ encrypted: boolean; version: string; sizeBytes: number } | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const pathResp = await window.psygil.workspace.getPath()
        if (pathResp.status === 'success' && pathResp.data) setWorkspacePath(pathResp.data as string)
      } catch { /* ignore */ }

      try {
        const healthResp = await window.psygil.db.health()
        if (healthResp.status === 'success') setDbHealth(healthResp.data as any)
      } catch { /* ignore */ }
    })()
  }, [])

  const handleChangeWorkspace = useCallback(async () => {
    try {
      const resp = await window.psygil.workspace.pickFolder()
      if (resp.status === 'success' && resp.data) {
        await window.psygil.workspace.setPath(resp.data)
        setWorkspacePath(resp.data)
      }
    } catch (err) {
      console.error('[Settings] Failed to change workspace:', err)
    }
  }, [])

  const handleBackup = useCallback(async () => {
    try {
      const resp = await window.psygil.workspace.pickFolder()
      if (resp.status === 'success' && resp.data) {
        alert(`Database backup would be saved to: ${resp.data}`)
      }
    } catch { /* ignore */ }
  }, [])

  const handleExportCases = useCallback(async () => {
    try {
      const resp = await window.psygil.audit.export({ format: 'csv' } as any)
      if (resp.status === 'success') {
        alert('Audit trail exported successfully.')
      }
    } catch {
      alert('Export not yet implemented.')
    }
  }, [])

  return (
    <div>
      <div style={sectionTitle}>Data & Storage</div>
      <div style={sectionDesc}>
        Manage your workspace location, database, and data exports. All case data is stored in an AES-256 encrypted SQLCipher database.
      </div>

      {/* Workspace */}
      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Workspace Folder</div>
        <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 10, lineHeight: 1.5 }}>
          This is where case folders, audio files, and uploaded documents are stored. The folder structure is the source of truth for case files.
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            flex: 1,
            padding: '7px 10px',
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            fontSize: 12,
            color: 'var(--text)',
            fontFamily: 'monospace',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {workspacePath || 'Not set'}
          </div>
          <button onClick={handleChangeWorkspace} style={btnSecondary}>Change</button>
        </div>
      </div>

      {/* Database info */}
      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 14 }}>Database</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, fontSize: 12 }}>
          <div>
            <span style={{ ...fieldLabel, marginBottom: 2 }}>Encryption</span>
            <div style={{ fontWeight: 600, color: dbHealth?.encrypted ? '#4caf50' : '#e54040' }}>
              {dbHealth?.encrypted ? 'AES-256 (SQLCipher)' : 'Unknown'}
            </div>
          </div>
          <div>
            <span style={{ ...fieldLabel, marginBottom: 2 }}>Version</span>
            <div>{dbHealth?.version || '—'}</div>
          </div>
          <div>
            <span style={{ ...fieldLabel, marginBottom: 2 }}>Size</span>
            <div>{dbHealth ? formatBytes(dbHealth.sizeBytes) : '—'}</div>
          </div>
        </div>

        <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
          <button onClick={handleBackup} style={btnPrimary}>Backup Database</button>
          <button onClick={handleExportCases} style={btnSecondary}>Export Audit Trail</button>
        </div>
      </div>

      {/* Danger zone */}
      <div style={{ ...card, borderColor: '#e5404040' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#e54040', marginBottom: 6 }}>Danger Zone</div>
        <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>
          These actions are destructive and cannot be undone.
        </div>
        <button
          onClick={() => {
            if (window.confirm('This will reset the demo database. All case data will be replaced with demo data. Are you sure?')) {
              void window.psygil.seed.demoCases()
            }
          }}
          style={btnDanger}
        >
          Reset to Demo Data
        </button>
      </div>
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: About
// ═══════════════════════════════════════════════════════════════════════════════

function AboutSection(): React.JSX.Element {
  return (
    <div>
      <div style={sectionTitle}>About Psygil</div>
      <div style={sectionDesc}>
        Forensic Psychology IDE by Foundry SMB
      </div>

      <div style={card}>
        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '8px 0', fontSize: 12.5, lineHeight: 1.6 }}>
          {([
            ['Version', '1.0.0-alpha'],
            ['Build', '2026.04.03'],
            ['Platform', `Electron 33 (${window.psygil?.platform || 'unknown'})`],
            ['Runtime', 'Chromium + Node.js'],
            ['Database', 'SQLCipher 4.6 (AES-256)'],
            ['AI Provider', 'Anthropic Claude API'],
            ['Transcription', 'faster-whisper (local, offline)'],
            ['PHI Protection', 'UNID redaction pipeline'],
          ] as [string, string][]).map(([label, value]) => (
            <div key={label} style={{ display: 'contents' }}>
              <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{label}</div>
              <div style={{ color: 'var(--text)' }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>Core Principles</div>
        <div style={{ fontSize: 12.5, color: 'var(--text)', lineHeight: 1.7 }}>
          <p style={{ marginBottom: 6 }}><strong>DOCTOR ALWAYS DIAGNOSES</strong> — The AI never makes diagnostic conclusions. Every clinical decision is made by the licensed clinician and recorded in the audit trail.</p>
          <p style={{ marginBottom: 6 }}><strong>PHI Never Leaves This Machine</strong> — Patient data is redacted before any API call. Audio transcription runs locally. The encrypted database stays on your device.</p>
          <p><strong>Audit Everything</strong> — Every action, decision, and AI interaction is logged with timestamps and attribution for expert testimony defensibility.</p>
        </div>
      </div>

      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 16, textAlign: 'center' }}>
        © 2026 Foundry SMB. All rights reserved.
      </div>
    </div>
  )
}
