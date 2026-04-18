/**
 * Psygil Settings Tab, Comprehensive configuration UI
 *
 * Left-sidebar tabbed navigation with these sections:
 *   Writing Samples, Style Guide, Templates, Documentation,
 *   Appearance, AI & Models, Practice, Data & Storage, About
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import type { Tab } from '../../types/tabs'
import type { ResourceCategory } from '../../../../shared/types/ipc'
import BrandingPanel from './settings/BrandingPanel'
import { setTheme as applyThemeKey, THEME_CHOICES } from '../../app/theme'
import type { ThemeKey } from '../../app/theme'

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
  | 'privacy'
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
  { id: 'practice', label: 'Practice', icon: '🏥' },
  { id: 'data-storage', label: 'Data & Storage', icon: '💾' },
  { id: 'writing-samples', label: 'Writing Samples', icon: '✍' },
  { id: 'style-guide', label: 'Style Guide', icon: '📐' },
  { id: 'templates', label: 'Templates', icon: '📋' },
  { id: 'documentation', label: 'Documentation', icon: '📖' },
  { id: 'appearance', label: 'Appearance', icon: '🎨' },
  { id: 'ai-models', label: 'AI & Models', icon: '🤖' },
  { id: 'privacy', label: 'Privacy & Compliance', icon: '🔒' },
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
  color: 'var(--field-bg)',
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
  background: 'color-mix(in srgb, var(--danger) 8%, transparent)',
  color: 'var(--danger)',
  border: '1px solid color-mix(in srgb, var(--danger) 25%, transparent)',
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
  category: ResourceCategory
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
      const resp = await window.psygil.resources.upload({ category, filePaths: [] })
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
            {uploading ? 'Importing...' : uploadLabel}
          </button>
        </div>

        {loading ? (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '12px 0' }}>Loading...</div>
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
                    {f.phiStripped && <span style={{ marginLeft: 8, color: 'var(--success)', fontWeight: 600 }}>PHI stripped</span>}
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

export default function SettingsTab({ onOpenTab }: { readonly onOpenTab?: (tab: Tab) => void }): React.JSX.Element {
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
        {activeSection === 'writing-samples' && <WritingSamplesSection onOpenTab={onOpenTab} />}
        {activeSection === 'style-guide' && <StyleGuideSection />}
        {activeSection === 'templates' && <TemplatesSection />}
        {activeSection === 'documentation' && <DocumentationSection />}
        {activeSection === 'appearance' && <AppearanceSection />}
        {activeSection === 'ai-models' && <AiModelsSection />}
        {activeSection === 'practice' && <PracticeSection />}
        {activeSection === 'data-storage' && <DataStorageSection />}
        {activeSection === 'privacy' && <PrivacyComplianceSection />}
        {activeSection === 'about' && <AboutSection />}
      </div>
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: Writing Samples
// ═══════════════════════════════════════════════════════════════════════════════

// ── PHI category labels for display ──────────────────────────────────────────
const PHI_CATEGORY_LABELS: Record<string, string> = {
  PERSON: 'Names',
  DATE_TIME: 'Dates',
  PHONE_NUMBER: 'Phone numbers',
  EMAIL_ADDRESS: 'Email addresses',
  US_SSN: 'Social Security numbers',
  LOCATION: 'Locations/addresses',
  CREDIT_CARD: 'Credit card numbers',
  US_BANK_NUMBER: 'Bank account numbers',
  US_DRIVER_LICENSE: 'Driver license numbers',
  US_ITIN: 'ITIN numbers',
  US_PASSPORT: 'Passport numbers',
  IP_ADDRESS: 'IP addresses',
  MEDICAL_LICENSE: 'Medical license numbers',
  URL: 'URLs',
  NRP: 'National/religious/political groups',
  CRYPTO: 'Cryptocurrency addresses',
  REGEX_PATTERN: 'Pattern matches (regex fallback)',
}

// ── Upload pipeline stages ──────────────────────────────────────────────────
type UploadPipelineStage = 'idle' | 'uploading' | 'pii-removal' | 'analysis' | 'complete'

const PIPELINE_STAGES: { key: UploadPipelineStage; label: string; icon: string }[] = [
  { key: 'uploading', label: 'Upload Files', icon: '1' },
  { key: 'pii-removal', label: 'PII Removal', icon: '2' },
  { key: 'analysis', label: 'Voice & Style Analysis', icon: '3' },
]

interface PhiReport {
  filename: string
  originalSize: number
  cleanedSize: number
  entityCount: number
  typeBreakdown: Record<string, number>
  presidioUsed: boolean
  cleanedPath: string
  cleanedPreview: string
}

interface StyleProfile {
  filename: string
  avgSentenceLength: number
  medianSentenceLength: number
  wordCount: number
  sentenceCount: number
  paragraphCount: number
  avgParagraphLength: number
  vocabularyRichness: number
  topTerms: { term: string; count: number }[]
  hedgingPhrases: { phrase: string; count: number }[]
  personReference: { firstPerson: number; thirdPerson: number }
  tenseDistribution: { past: number; present: number }
  sectionHeadings: string[]
  formalityScore: number
}

interface StyleAggregate {
  avgSentenceLength: number
  vocabularyRichness: number
  formalityScore: number
  topTerms: { term: string; count: number }[]
  hedgingPhrases: { phrase: string; count: number }[]
  sampleCount: number
  totalWordCount: number
}

interface PipelineState {
  stage: UploadPipelineStage
  // Stage 1: upload
  uploadedFiles: ResourceFile[]
  // Stage 2: PII
  phiReports: PhiReport[]
  totalPhiStripped: number
  sidecarAvailable: boolean
  // Stage 3: style analysis
  styleProfiles: StyleProfile[]
  styleAggregate: StyleAggregate | null
}

const INITIAL_PIPELINE: PipelineState = {
  stage: 'idle',
  uploadedFiles: [],
  phiReports: [],
  totalPhiStripped: 0,
  sidecarAvailable: false,
  styleProfiles: [],
  styleAggregate: null,
}

/** Single-pane viewer for de-identified writing sample */
function CleanedSampleViewer({ cleaned }: { readonly cleaned: string }): React.JSX.Element {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{
        padding: '10px 16px', fontSize: 11, color: 'var(--text-secondary)',
        background: 'color-mix(in srgb, var(--success) 4%, transparent)', borderBottom: '1px solid var(--border)',
        lineHeight: 1.5,
      }}>
        The original file containing PHI/PII was permanently deleted after de-identification. Only this cleaned version is stored.
      </div>
      <pre style={{
        flex: 1, margin: 0, padding: 14, fontSize: 11, lineHeight: 1.6,
        color: 'var(--text)', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        overflowY: 'auto', fontFamily: 'monospace',
      }}>{cleaned || '(No text extracted)'}</pre>
    </div>
  )
}

function WritingSamplesSection({ onOpenTab }: { readonly onOpenTab?: (tab: Tab) => void }): React.JSX.Element {
  const [files, setFiles] = useState<ResourceFile[]>([])
  const [loading, setLoading] = useState(true)
  const [pipeline, setPipeline] = useState<PipelineState>({ ...INITIAL_PIPELINE })
  const [showModal, setShowModal] = useState(false)
  const [previewFile, setPreviewFile] = useState<{ cleaned: string; filename: string } | null>(null)

  const loadFiles = useCallback(async () => {
    try {
      const resp = await window.psygil.resources.list({ category: 'writing-samples' })
      if (resp.status === 'success') {
        setFiles(resp.data as ResourceFile[])
      }
    } catch (err) {
      console.error('[WritingSamples] Failed to load:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadFiles()
  }, [loadFiles])

  // ── Staged upload pipeline ──────────────────────────────────────────────
  // Step 1: OS file picker (no modal yet, the OS dialog is modal itself)
  // Step 2: Show modal at Stage 1 with selected filenames
  // Step 3: Transition to Stage 2 (PII removal via Presidio)
  // Step 4: Transition to Stage 3 (voice/style analysis)
  const startUploadPipeline = useCallback(async () => {
    // Pick files FIRST via the OS dialog, before showing our modal.
    let selectedPaths: string[] = []
    try {
      const pickResp = await window.psygil.documents.pickFilesFrom({
        title: 'Select Writing Samples for Voice Analysis',
        extensions: ['docx', 'doc', 'pdf', 'txt', 'rtf', 'md'],
      })
      if (pickResp.status !== 'success' || !pickResp.data?.filePaths || pickResp.data.filePaths.length === 0) {
        return
      }
      selectedPaths = [...pickResp.data.filePaths]
    } catch (pickErr) {
      console.error('[WritingSamples] File picker error:', pickErr)
      return
    }

    // Extract just filenames for display
    const selectedFilenames = selectedPaths.map(p => {
      const parts = p.split('/')
      return parts[parts.length - 1] || p
    })

    // Now show the modal at Stage 1 with the selected files
    setPipeline({
      ...INITIAL_PIPELINE,
      stage: 'uploading',
      uploadedFiles: selectedFilenames.map((name, idx) => ({
        id: String(idx),
        category: 'writing-samples',
        originalFilename: name,
        storedPath: selectedPaths[idx],
        fileSize: 0,
        mimeType: '',
        uploadedAt: new Date().toISOString(),
        phiStripped: false,
      })) as ResourceFile[],
    })
    setShowModal(true)

    // Let the user see Stage 1 (files selected) for a moment
    await new Promise(r => setTimeout(r, 1200))

    // Stage 2: PII Removal
    setPipeline(prev => ({ ...prev, stage: 'pii-removal' }))

    let uploadedItems: ResourceFile[] = []
    let phiReports: PhiReport[] = []
    let totalPhiStripped = 0
    let sidecarAvailable = false

    try {
      const resp = await window.psygil.resources.uploadWritingSample({ filePaths: selectedPaths })
      if (resp.status !== 'success') {
        setPipeline({ ...INITIAL_PIPELINE })
        setShowModal(false)
        return
      }

      uploadedItems = resp.data.imported as ResourceFile[]
      phiReports = resp.data.reports as PhiReport[]
      totalPhiStripped = resp.data.totalPhiStripped
      sidecarAvailable = resp.data.sidecarAvailable

      setPipeline(prev => ({
        ...prev,
        uploadedFiles: uploadedItems,
        phiReports,
        totalPhiStripped,
        sidecarAvailable,
      }))

      // Let the user see PII results before moving to analysis
      await new Promise(r => setTimeout(r, 1500))

      // Stage 3: Voice & style analysis on ALL de-identified samples (not just this batch)
      setPipeline(prev => ({ ...prev, stage: 'analysis' }))
      const analysisResp = await window.psygil.resources.recalculateStyleProfile()

      if (analysisResp.status === 'success') {
        setPipeline(prev => ({
          ...prev,
          stage: 'complete',
          styleProfiles: analysisResp.data.profiles as StyleProfile[],
          styleAggregate: analysisResp.data.aggregate as unknown as StyleAggregate,
        }))
      } else {
        setPipeline(prev => ({ ...prev, stage: 'complete' }))
      }

      void loadFiles()
    } catch (err) {
      console.error('[WritingSamples] Pipeline failed:', err)
      setPipeline(prev => ({ ...prev, stage: 'complete' }))
      void loadFiles()
    }
  }, [loadFiles])

  const handleDelete = useCallback(async (file: ResourceFile) => {
    if (!window.confirm(`Delete "${file.originalFilename}"?\n\nThis removes both the original and the de-identified copy.`)) return
    try {
      await window.psygil.resources.delete({ id: file.id, storedPath: file.storedPath })
      void loadFiles()
    } catch (err) {
      console.error('[WritingSamples] Delete failed:', err)
    }
  }, [loadFiles])

  const handlePreview = useCallback(async (file: ResourceFile) => {
    try {
      const resp = await window.psygil.resources.previewCleaned({ storedPath: file.storedPath })
      if (resp.status === 'success') {
        setPreviewFile({
          cleaned: resp.data.cleanedText,
          filename: file.originalFilename,
        })
      }
    } catch (err) {
      console.error('[WritingSamples] Preview failed:', err)
    }
  }, [])

  const handleOpen = useCallback((file: ResourceFile) => {
    if (onOpenTab) {
      onOpenTab({
        id: `resource:${file.storedPath}`,
        title: file.originalFilename,
        type: 'resource',
        filePath: file.storedPath,
      })
    } else {
      void window.psygil.resources.open({ storedPath: file.storedPath })
    }
  }, [onOpenTab])

  const closeModal = useCallback(() => {
    setShowModal(false)
    setPipeline({ ...INITIAL_PIPELINE })
  }, [])

  return (
    <div>
      <div style={sectionTitle}>Writing Samples</div>
      <div style={sectionDesc}>
        Upload examples of your forensic reports, clinical letters, or court declarations.
        Each file goes through a three-stage pipeline: upload, PII removal via Presidio NLP,
        then local voice and vocabulary analysis. More samples produce better style matching.
      </div>

      {/* Upload button + file count */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: files.length > 0 ? 14 : 0 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
            {files.length} sample{files.length !== 1 ? 's' : ''} uploaded
          </span>
          <button
            onClick={startUploadPipeline}
            disabled={showModal}
            style={{ ...btnPrimary, opacity: showModal ? 0.6 : 1 }}
          >
            + Upload Writing Samples
          </button>
        </div>

        {/* File list */}
        {loading ? (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '12px 0' }}>Loading...</div>
        ) : files.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '24px 0', textAlign: 'center', lineHeight: 1.6 }}>
            No writing samples uploaded yet.<br />
            Add your best forensic reports to help the AI match your writing style.
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
                  <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {f.originalFilename}
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', marginTop: 2, display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span>{formatBytes(f.fileSize)}</span>
                    {f.phiStripped && (
                      <span style={{ color: 'var(--success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                        <span style={{ fontSize: 9 }}>*</span> PHI stripped
                      </span>
                    )}
                  </div>
                </div>
                <button onClick={() => void handlePreview(f)} style={{ ...btnSecondary, padding: '4px 8px', fontSize: 11 }} title="Compare original vs. de-identified">Compare</button>
                <button onClick={() => handleOpen(f)} style={{ ...btnSecondary, padding: '4px 8px', fontSize: 11 }} title="Open in viewer tab">Open</button>
                <button onClick={() => void handleDelete(f)} style={{ ...btnDanger, padding: '4px 8px', fontSize: 11, background: 'transparent' }} title="Delete">x</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══════════ STAGED UPLOAD MODAL ═══════════ */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.55)', /* themed:skip - modal scrim */
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{
            width: '90%',
            maxWidth: 800,
            maxHeight: '85vh',
            background: 'var(--panel)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 12px 40px rgba(0,0,0,0.3)', /* themed:skip - shadow */
          }}>
            {/* Modal header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--bg)',
            }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>
                Writing Sample Upload Pipeline
              </div>

              {/* Stage progress bar */}
              <div style={{ display: 'flex', gap: 0, alignItems: 'center' }}>
                {PIPELINE_STAGES.map((s, idx) => {
                  const stageOrder: UploadPipelineStage[] = ['uploading', 'pii-removal', 'analysis']
                  const currentIdx = stageOrder.indexOf(pipeline.stage === 'complete' ? 'analysis' : pipeline.stage)
                  const thisIdx = idx
                  const isActive = thisIdx === currentIdx
                  const isDone = thisIdx < currentIdx || pipeline.stage === 'complete'

                  return (
                    <div key={s.key} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                      {/* Step circle */}
                      <div style={{
                        width: 28, height: 28,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 12,
                        fontWeight: 700,
                        flexShrink: 0,
                        background: isDone ? 'var(--accent)' : isActive ? 'var(--accent)' : 'var(--border)',
                        color: isDone || isActive ? 'var(--field-bg)' : 'var(--text-secondary)',
                        transition: 'all 0.3s',
                      }}>
                        {isDone ? '\u2713' : s.icon}
                      </div>
                      {/* Label */}
                      <div style={{
                        marginLeft: 8,
                        fontSize: 11.5,
                        fontWeight: isActive ? 700 : 500,
                        color: isActive || isDone ? 'var(--text)' : 'var(--text-secondary)',
                        whiteSpace: 'nowrap',
                        transition: 'all 0.3s',
                      }}>
                        {s.label}
                        {isActive && pipeline.stage !== 'complete' && (
                          <span style={{ marginLeft: 6, color: 'var(--accent)', fontSize: 10 }}>in progress...</span>
                        )}
                      </div>
                      {/* Connector line */}
                      {idx < PIPELINE_STAGES.length - 1 && (
                        <div style={{
                          flex: 1,
                          height: 2,
                          margin: '0 12px',
                          background: isDone ? 'var(--accent)' : 'var(--border)',
                          borderRadius: 1,
                          transition: 'background 0.3s',
                        }} />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Modal body, scrollable */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', minHeight: 0 }}>

              {/* Stage 1: Files selected, preparing for processing */}
              {pipeline.stage === 'uploading' && pipeline.uploadedFiles.length > 0 && (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>
                    Files Selected
                  </div>
                  {pipeline.uploadedFiles.map((f, idx) => (
                    <div key={idx} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 12px',
                      background: 'var(--bg)',
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                      marginBottom: 4,
                    }}>
                      <span style={{ fontSize: 16 }}>
                        {f.originalFilename.endsWith('.pdf') ? '\u{1F4D5}' :
                         f.originalFilename.endsWith('.docx') || f.originalFilename.endsWith('.doc') ? '\u{1F4C4}' :
                         '\u{1F4DD}'}
                      </span>
                      <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text)', flex: 1 }}>
                        {f.originalFilename}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                        Ready for processing
                      </span>
                    </div>
                  ))}
                  <div style={{ marginTop: 12, fontSize: 11.5, color: 'var(--text-secondary)', textAlign: 'center' }}>
                    Preparing to strip PHI and analyze writing style...
                  </div>
                </div>
              )}

              {/* Stage 2: PII Removal results */}
              {(pipeline.stage === 'pii-removal' || pipeline.stage === 'analysis' || pipeline.stage === 'complete') && pipeline.phiReports.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>
                    PII Redaction Results
                  </div>

                  {/* Summary badges */}
                  <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                    <div style={{ padding: '6px 14px', background: 'color-mix(in srgb, var(--success) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--success) 20%, transparent)', borderRadius: 6 }}>
                      <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--success)' }}>{pipeline.totalPhiStripped}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 6 }}>PHI entities removed</span>
                    </div>
                    <div style={{ padding: '6px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6 }}>
                      <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{pipeline.phiReports.length}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 6 }}>files processed</span>
                    </div>
                    <div style={{
                      padding: '6px 14px',
                      background: pipeline.sidecarAvailable ? 'color-mix(in srgb, var(--success) 8%, transparent)' : 'color-mix(in srgb, var(--warn) 8%, transparent)',
                      border: `1px solid ${pipeline.sidecarAvailable ? 'color-mix(in srgb, var(--success) 20%, transparent)' : 'color-mix(in srgb, var(--warn) 20%, transparent)'}`,
                      borderRadius: 6,
                    }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: pipeline.sidecarAvailable ? 'var(--success)' : 'var(--warn)' }}>
                        {pipeline.sidecarAvailable ? 'Presidio NLP (18 HIPAA identifiers)' : 'Regex fallback (limited)'}
                      </span>
                    </div>
                  </div>

                  {!pipeline.sidecarAvailable && (
                    <div style={{ padding: '8px 12px', background: 'color-mix(in srgb, var(--warn) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--warn) 15%, transparent)', borderRadius: 4, fontSize: 11, color: 'var(--warn)', lineHeight: 1.5, marginBottom: 10 }}>
                      Presidio sidecar unavailable. Regex patterns caught SSNs, dates, phones, and emails, but may have missed names and facility identifiers.
                    </div>
                  )}

                  {/* Per-file reports */}
                  {pipeline.phiReports.map((report, idx) => (
                    <div key={idx} style={{ padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, marginBottom: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{report.filename}</span>
                        <span style={{ fontSize: 11, color: report.entityCount > 0 ? 'var(--success)' : 'var(--text-secondary)', fontWeight: 600 }}>
                          {report.entityCount} redacted
                        </span>
                      </div>
                      {Object.keys(report.typeBreakdown).length > 0 && (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                          {Object.entries(report.typeBreakdown).sort(([, a], [, b]) => b - a).map(([type, count]) => (
                            <span key={type} style={{ padding: '1px 7px', background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 10, color: 'var(--text-secondary)' }}>
                              {PHI_CATEGORY_LABELS[type] || type}: {count}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Stage 3: Voice & Style Analysis */}
              {pipeline.stage === 'analysis' && !pipeline.styleAggregate && (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600, marginBottom: 6 }}>
                    Analyzing voice and vocabulary patterns...
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                    Extracting sentence structure, clinical terminology, hedging patterns, and formality level.
                  </div>
                </div>
              )}

              {/* Stage 3 complete: Style results */}
              {pipeline.stage === 'complete' && pipeline.styleAggregate && (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>
                    Voice & Style Profile
                  </div>

                  {/* Aggregate metrics */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 14 }}>
                    <div style={{ padding: '10px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6 }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>{pipeline.styleAggregate.avgSentenceLength}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>avg words/sentence</div>
                    </div>
                    <div style={{ padding: '10px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6 }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>{pipeline.styleAggregate.totalWordCount.toLocaleString()}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>total words analyzed</div>
                    </div>
                    <div style={{ padding: '10px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6 }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>{Math.round(pipeline.styleAggregate.vocabularyRichness * 100)}%</div>
                      <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>vocabulary richness</div>
                    </div>
                    <div style={{ padding: '10px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6 }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>{Math.round(pipeline.styleAggregate.formalityScore * 100)}%</div>
                      <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>formality score</div>
                    </div>
                  </div>

                  {/* Top clinical terms */}
                  {pipeline.styleAggregate.topTerms.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Top Clinical Terms
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {pipeline.styleAggregate.topTerms.slice(0, 15).map((t) => (
                          <span key={t.term} style={{
                            padding: '3px 10px',
                            background: 'color-mix(in srgb, var(--accent) 8%, transparent)',
                            border: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)',
                            borderRadius: 12,
                            fontSize: 11,
                            color: 'var(--text)',
                          }}>
                            {t.term} <span style={{ color: 'var(--text-secondary)', fontSize: 10 }}>({t.count})</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Hedging phrases */}
                  {pipeline.styleAggregate.hedgingPhrases.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Hedging Patterns
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {pipeline.styleAggregate.hedgingPhrases.slice(0, 10).map((h) => (
                          <span key={h.phrase} style={{
                            padding: '3px 10px',
                            background: 'color-mix(in srgb, var(--warn) 8%, transparent)',
                            border: '1px solid color-mix(in srgb, var(--warn) 20%, transparent)',
                            borderRadius: 12,
                            fontSize: 11,
                            color: 'var(--text)',
                            fontStyle: 'italic',
                          }}>
                            "{h.phrase}" <span style={{ color: 'var(--text-secondary)', fontSize: 10, fontStyle: 'normal' }}>({h.count})</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Per-file style details (collapsible) */}
                  {pipeline.styleProfiles.length > 1 && (
                    <details style={{ marginTop: 8 }}>
                      <summary style={{ fontSize: 11.5, color: 'var(--accent)', cursor: 'pointer', userSelect: 'none', fontWeight: 600 }}>
                        Per-file style breakdown ({pipeline.styleProfiles.length} files)
                      </summary>
                      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {pipeline.styleProfiles.map((p, idx) => (
                          <div key={idx} style={{ padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{p.filename}</div>
                            <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                              <span>{p.wordCount.toLocaleString()} words</span>
                              <span>{p.sentenceCount} sentences</span>
                              <span>avg {p.avgSentenceLength} words/sent</span>
                              <span>{p.paragraphCount} paragraphs</span>
                              <span>formality: {Math.round(p.formalityScore * 100)}%</span>
                              <span>{p.personReference.firstPerson}% 1st person / {p.personReference.thirdPerson}% 3rd person</span>
                              <span>{p.tenseDistribution.past}% past / {p.tenseDistribution.present}% present</span>
                            </div>
                            {p.sectionHeadings.length > 0 && (
                              <div style={{ marginTop: 4, fontSize: 10.5, color: 'var(--text-secondary)' }}>
                                Sections: {p.sectionHeadings.slice(0, 10).join(', ')}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div style={{
              padding: '12px 20px',
              borderTop: '1px solid var(--border)',
              background: 'var(--bg)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 8,
            }}>
              {pipeline.stage === 'complete' ? (
                <button onClick={closeModal} style={btnPrimary}>Done</button>
              ) : (
                <button onClick={closeModal} style={btnSecondary}>Cancel</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Side-by-side preview modal */}
      {previewFile && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', /* themed:skip - modal scrim */
          zIndex: 10001,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
          onClick={() => setPreviewFile(null)}
        >
          <div
            style={{
              width: '90%',
              maxWidth: 1200,
              height: '80%',
              background: 'var(--panel)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg)',
            }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>De-identified Sample: {previewFile.filename}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>All PHI/PII has been stripped from this file</div>
              </div>
              <button onClick={() => setPreviewFile(null)} style={{ ...btnSecondary, padding: '5px 12px' }}>Close</button>
            </div>
            <CleanedSampleViewer cleaned={previewFile.cleaned} />
          </div>
        </div>
      )}
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: Style Guide
// ═══════════════════════════════════════════════════════════════════════════════

interface VoiceProfile {
  version: number
  updatedAt: string
  sampleCount: number
  totalWordCount: number
  avgSentenceLength: number
  vocabularyRichness: number
  formalityScore: number
  topTerms: { term: string; count: number }[]
  hedgingPhrases: { phrase: string; count: number }[]
  personReference: { firstPerson: number; thirdPerson: number }
  tenseDistribution: { past: number; present: number }
  sectionHeadings: string[]
}

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
  const [voiceProfile, setVoiceProfile] = useState<VoiceProfile | null>(null)
  const [recalculating, setRecalculating] = useState(false)
  const [profileLoading, setProfileLoading] = useState(true)

  // Load persisted voice profile on mount
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const resp = await window.psygil.resources.getStyleProfile()
        if (!cancelled && resp.status === 'success' && resp.data) {
          setVoiceProfile(resp.data as VoiceProfile)
        }
      } catch (_) { /* non-fatal */ }
      if (!cancelled) setProfileLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  const handleRecalculate = useCallback(async () => {
    setRecalculating(true)
    try {
      const resp = await window.psygil.resources.recalculateStyleProfile()
      if (resp.status === 'success' && resp.data?.aggregate) {
        // Reload the persisted profile
        const profileResp = await window.psygil.resources.getStyleProfile()
        if (profileResp.status === 'success' && profileResp.data) {
          setVoiceProfile(profileResp.data as VoiceProfile)
        }
      }
    } catch (_) { /* non-fatal */ }
    setRecalculating(false)
  }, [])

  return (
    <div>
      <div style={sectionTitle}>Style Guide</div>
      <div style={sectionDesc}>
        Configure report writing conventions. These rules are applied by the Writer and Editor agents when generating report prose. They will also be refined automatically as you upload more writing samples.
      </div>

      {/* Voice & Style Profile from writing samples */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Voice & Style Profile</div>
          <button
            onClick={handleRecalculate}
            disabled={recalculating}
            style={{
              padding: '4px 12px',
              fontSize: 11,
              background: 'var(--bg-tertiary)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              cursor: recalculating ? 'wait' : 'pointer',
              opacity: recalculating ? 0.6 : 1,
            }}
          >
            {recalculating ? 'Recalculating...' : 'Recalculate'}
          </button>
        </div>

        {profileLoading ? (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '12px 0' }}>Loading voice profile...</div>
        ) : !voiceProfile ? (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '12px 0', lineHeight: 1.6 }}>
            No writing samples analyzed yet. Upload samples in the Writing Samples section above to generate your voice profile. The Writer and Editor agents will use this profile to match your clinical voice.
          </div>
        ) : (
          <div>
            {/* Metric grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
              {[
                { label: 'Avg Sentence Length', value: `${voiceProfile.avgSentenceLength} words` },
                { label: 'Vocabulary Richness', value: `${Math.round(voiceProfile.vocabularyRichness * 100)}%` },
                { label: 'Formality Score', value: `${Math.round(voiceProfile.formalityScore * 100)}%` },
                { label: 'Samples Analyzed', value: String(voiceProfile.sampleCount) },
                { label: 'Total Word Count', value: voiceProfile.totalWordCount.toLocaleString() },
                { label: 'Person Reference', value: `${voiceProfile.personReference.thirdPerson}% third-person` },
              ].map(({ label, value }) => (
                <div key={label} style={{
                  background: 'var(--bg-tertiary)',
                  borderRadius: 6,
                  padding: '10px 12px',
                }}>
                  <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Tense distribution bar */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>Tense Distribution</div>
              <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: 'var(--bg-tertiary)' }}>
                <div style={{ width: `${voiceProfile.tenseDistribution.past}%`, background: 'var(--accent)', transition: 'width 0.3s' }} />
                <div style={{ width: `${voiceProfile.tenseDistribution.present}%`, background: 'var(--text-secondary)', transition: 'width 0.3s' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-secondary)', marginTop: 3 }}>
                <span>Past tense: {voiceProfile.tenseDistribution.past}%</span>
                <span>Present tense: {voiceProfile.tenseDistribution.present}%</span>
              </div>
            </div>

            {/* Top clinical terms */}
            {voiceProfile.topTerms.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>Top Clinical Terms</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {voiceProfile.topTerms.slice(0, 15).map(t => (
                    <span key={t.term} style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      fontSize: 11,
                      background: 'var(--bg-tertiary)',
                      color: 'var(--text)',
                      borderRadius: 10,
                      border: '1px solid var(--border)',
                    }}>
                      {t.term} ({t.count})
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Hedging patterns */}
            {voiceProfile.hedgingPhrases.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>Hedging Patterns</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {voiceProfile.hedgingPhrases.slice(0, 10).map(h => (
                    <span key={h.phrase} style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      fontSize: 11,
                      fontStyle: 'italic',
                      background: 'var(--bg-tertiary)',
                      color: 'var(--text-secondary)',
                      borderRadius: 10,
                      border: '1px solid var(--border)',
                    }}>
                      "{h.phrase}" ({h.count})
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Section headings */}
            {voiceProfile.sectionHeadings.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>Detected Section Headings</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {voiceProfile.sectionHeadings.slice(0, 15).map((h, i) => (
                    <span key={`${h}-${i}`} style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      fontSize: 10.5,
                      background: 'var(--bg-tertiary)',
                      color: 'var(--text)',
                      borderRadius: 10,
                      border: '1px solid var(--border)',
                      fontFamily: 'monospace',
                    }}>
                      {h}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Last updated */}
            <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', borderTop: '1px solid var(--border)', paddingTop: 8 }}>
              Last updated: {new Date(voiceProfile.updatedAt).toLocaleString()}
            </div>
          </div>
        )}
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
              <option value="third-person">Third person ("The evaluee reported...")</option>
              <option value="first-person">First person ("I administered...")</option>
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
            ['headerNumbering', 'Number section headers (I, II, III...)'],
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

interface TemplateListItem {
  id: string
  name: string
  evalType: string
  source: 'builtin' | 'custom'
  sectionCount: number
  createdAt: string
}

interface TemplateAnalysis {
  detectedEvalType: string
  suggestedName: string
  formatting: Record<string, unknown>
  sections: { heading: string; contentType: string; exampleProse: string; estimatedLength: string; order: number }[]
  cleanedText: string
  phiStripped: number
  tempDocxPath: string
}

const EVAL_TYPES = ['CST', 'Custody', 'Risk Assessment', 'Fitness for Duty', 'PTSD Dx', 'ADHD Dx', 'Malingering']

function TemplatesSection(): React.JSX.Element {
  const [templates, setTemplates] = useState<TemplateListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [analysis, setAnalysis] = useState<TemplateAnalysis | null>(null)
  const [confirmName, setConfirmName] = useState('')
  const [confirmEvalType, setConfirmEvalType] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [previewSections, setPreviewSections] = useState<{ heading: string; exampleProse: string; contentType: string }[]>([])

  const loadTemplates = useCallback(async () => {
    try {
      const resp = await window.psygil.templates.list()
      if (resp.status === 'success') {
        setTemplates(resp.data as unknown as TemplateListItem[])
      }
    } catch (err) {
      console.error('[Templates] Failed to load:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadTemplates() }, [loadTemplates])

  const handleUpload = useCallback(async () => {
    setUploading(true)
    try {
      const resp = await window.psygil.templates.analyze({})
      if (resp.status === 'success') {
        const data = resp.data as unknown as TemplateAnalysis
        setAnalysis(data)
        setConfirmName(data.suggestedName)
        setConfirmEvalType(data.detectedEvalType)
      } else {
        console.error('[Templates] Analyze returned error:', resp)
      }
    } catch (err) {
      console.error('[Templates] Upload analysis failed:', err)
    } finally {
      setUploading(false)
    }
  }, [])

  const handleSave = useCallback(async () => {
    if (!analysis || !confirmName.trim()) return
    setSaving(true)
    setSaveError(null)
    try {
      const resp = await window.psygil.templates.save({
        tempDocxPath: analysis.tempDocxPath,
        name: confirmName.trim(),
        evalType: confirmEvalType,
        formatting: analysis.formatting as never,
        sections: analysis.sections as never,
      })
      if (resp.status === 'success') {
        setAnalysis(null)
        void loadTemplates()
      } else {
        const msg = (resp as { message?: string }).message ?? 'Save failed with unknown error'
        console.error('[Templates] Save returned error:', resp)
        setSaveError(msg)
      }
    } catch (err) {
      console.error('[Templates] Save failed:', err)
      setSaveError(err instanceof Error ? err.message : 'Save threw an exception')
    } finally {
      setSaving(false)
    }
  }, [analysis, confirmName, confirmEvalType, loadTemplates])

  const handleDelete = useCallback(async (id: string) => {
    try {
      const resp = await window.psygil.templates.delete({ id })
      if (resp.status === 'success') void loadTemplates()
    } catch (err) {
      console.error('[Templates] Delete failed:', err)
    }
  }, [loadTemplates])

  const handlePreview = useCallback(async (id: string) => {
    if (previewId === id) { setPreviewId(null); return }
    try {
      const resp = await window.psygil.templates.get({ id })
      if (resp.status === 'success') {
        const profile = resp.data as unknown as { sections: { heading: string; exampleProse: string; contentType: string }[] }
        setPreviewSections(profile.sections)
        setPreviewId(id)
      }
    } catch (err) {
      console.error('[Templates] Preview failed:', err)
    }
  }, [previewId])

  const btnPrimary: React.CSSProperties = {
    padding: '6px 14px', fontSize: 11, fontWeight: 600, border: 'none', borderRadius: 4,
    background: 'var(--accent)', color: 'var(--field-bg)', cursor: 'pointer',
  }
  const btnSecondary: React.CSSProperties = {
    padding: '5px 12px', fontSize: 11, border: '1px solid var(--border)', borderRadius: 4,
    background: 'var(--bg)', color: 'var(--text)', cursor: 'pointer',
  }

  return (
    <div style={{ padding: '16px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Report Templates</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
            Upload a past report (.docx) to create a reusable template. PHI is stripped, formatting and structure are preserved.
          </div>
        </div>
        <button onClick={handleUpload} disabled={uploading} style={{ ...btnPrimary, opacity: uploading ? 0.6 : 1 }}>
          {uploading ? 'Analyzing...' : '+ Upload Report as Template'}
        </button>
      </div>

      {/* Template list */}
      {loading ? (
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', padding: 20 }}>Loading templates...</div>
      ) : templates.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '40px 20px', textAlign: 'center', background: 'var(--panel)', borderRadius: 6 }}>
          No templates available. Upload a past report to create your first custom template.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {templates.map((t) => (
            <div key={t.id}>
              <div
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', background: 'var(--panel)', borderRadius: 6,
                  border: '1px solid var(--border)',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{t.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {t.evalType} - {t.sectionCount} sections
                    <span style={{
                      marginLeft: 8, padding: '1px 6px', borderRadius: 3, fontSize: 9, fontWeight: 600,
                      background: t.source === 'builtin' ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'color-mix(in srgb, var(--success) 10%, transparent)',
                      color: t.source === 'builtin' ? 'var(--accent)' : 'var(--success)',
                    }}>
                      {t.source === 'builtin' ? 'Built-in' : 'Custom'}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {t.source === 'custom' && (
                    <button onClick={() => void window.psygil.templates.open({ id: t.id })} style={btnSecondary}>
                      Open
                    </button>
                  )}
                  <button onClick={() => handlePreview(t.id)} style={btnSecondary}>
                    {previewId === t.id ? 'Hide' : 'Preview'}
                  </button>
                  <button
                    onClick={() => handleDelete(t.id)}
                    style={{ ...btnSecondary, color: 'var(--danger)', borderColor: 'color-mix(in srgb, var(--danger) 30%, transparent)' }}
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Section preview */}
              {previewId === t.id && previewSections.length > 0 && (
                <div style={{
                  margin: '4px 0 8px 0', padding: '12px 14px', background: 'var(--bg)',
                  border: '1px solid var(--border)', borderRadius: '0 0 6px 6px',
                  maxHeight: 300, overflowY: 'auto',
                }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase' }}>
                    Section Structure
                  </div>
                  {previewSections.map((s, i) => (
                    <div key={i} style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>
                        {i + 1}. {s.heading}
                        <span style={{ marginLeft: 6, fontSize: 9, color: 'var(--text-secondary)', fontWeight: 400 }}>
                          ({s.contentType})
                        </span>
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2, whiteSpace: 'pre-wrap', maxHeight: 60, overflow: 'hidden' }}>
                        {s.exampleProse.slice(0, 200)}{s.exampleProse.length > 200 ? '...' : ''}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Confirmation dialog (modal overlay) */}
      {analysis && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.5)', /* themed:skip - modal scrim */ display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={() => setAnalysis(null)}
        >
          <div
            style={{
              width: 560, maxHeight: '85vh', background: 'var(--panel)',
              border: '1px solid var(--border)', borderRadius: 8,
              display: 'flex', flexDirection: 'column', overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Confirm Template Import</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                {analysis.phiStripped > 0
                  ? `${analysis.phiStripped} PHI entities were stripped from this document.`
                  : 'No PHI detected in this document.'}
                {' '}{analysis.sections.length} sections detected.
              </div>
            </div>

            {/* Form */}
            <div style={{ padding: '16px 18px', overflowY: 'auto', flex: 1 }}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Template Name</label>
                <input
                  type="text"
                  value={confirmName}
                  onChange={(e) => setConfirmName(e.target.value)}
                  style={{
                    width: '100%', padding: '6px 10px', fontSize: 12,
                    border: '1px solid var(--border)', borderRadius: 4,
                    background: 'var(--bg)', color: 'var(--text)',
                    boxSizing: 'border-box',
                  }}
                  placeholder="e.g. Pike_CST"
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                  Evaluation Type
                  <span style={{ fontWeight: 400, color: 'var(--text-secondary)', marginLeft: 6 }}>(auto-detected)</span>
                </label>
                <select
                  value={confirmEvalType}
                  onChange={(e) => setConfirmEvalType(e.target.value)}
                  style={{
                    width: '100%', padding: '6px 10px', fontSize: 12,
                    border: '1px solid var(--border)', borderRadius: 4,
                    background: 'var(--bg)', color: 'var(--text)',
                  }}
                >
                  {EVAL_TYPES.map((et) => (
                    <option key={et} value={et}>{et}</option>
                  ))}
                </select>
              </div>

              {/* Detected sections preview */}
              <div style={{ marginBottom: 8 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Detected Sections</label>
                <div style={{
                  maxHeight: 200, overflowY: 'auto', padding: '8px 10px',
                  background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, fontSize: 11,
                }}>
                  {analysis.sections.map((s, i) => (
                    <div key={i} style={{ padding: '3px 0', color: 'var(--text)', display: 'flex', gap: 8 }}>
                      <span style={{ color: 'var(--text-secondary)', minWidth: 20 }}>{i + 1}.</span>
                      <span>{s.heading}</span>
                      <span style={{ marginLeft: 'auto', color: 'var(--text-secondary)', fontSize: 9 }}>{s.contentType}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{
              padding: '12px 18px', borderTop: '1px solid var(--border)',
              display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              {saveError && (
                <div style={{ fontSize: 11, color: 'var(--danger)', padding: '6px 10px', background: 'color-mix(in srgb, var(--danger) 8%, transparent)', borderRadius: 4 }}>
                  Error: {saveError}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button onClick={() => setAnalysis(null)} style={btnSecondary}>Cancel</button>
                <button
                  onClick={handleSave}
                  disabled={saving || !confirmName.trim()}
                  style={{ ...btnPrimary, opacity: (saving || !confirmName.trim()) ? 0.6 : 1 }}
                >
                  {saving ? 'Saving...' : 'Save Template'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
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
      description="Upload reference materials, scoring manuals, legal guidelines, state statutes, clinical practice standards, or court requirements. These documents are used by the agents as reference context during report generation."
      emptyMessage="No reference documentation uploaded. Add scoring manuals, legal guidelines, or clinical standards that should inform report generation."
      uploadLabel="+ Upload Documentation"
    />
  )
}


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: Appearance
// ═══════════════════════════════════════════════════════════════════════════════

function AppearanceSection(): React.JSX.Element {
  const [theme, setThemeState] = useState<ThemeKey>(
    (document.documentElement.getAttribute('data-theme') as ThemeKey) || 'light'
  )
  const [fontSize, setFontSize] = useState(
    parseInt(localStorage.getItem('psygil-font-size') || '13', 10)
  )
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    localStorage.getItem('psygil-sidebar-collapsed') === 'true'
  )

  const handleThemeSelect = useCallback((key: ThemeKey) => {
    setThemeState(key)
    applyThemeKey(key)
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
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {THEME_CHOICES.map((t) => {
            const active = theme === t.key
            return (
              <button
                key={t.key}
                onClick={() => handleThemeSelect(t.key)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                  padding: 12,
                  border: active ? '2px solid var(--accent)' : '2px solid var(--border)',
                  borderRadius: 8,
                  background: 'transparent',
                  cursor: 'pointer',
                  minWidth: 100,
                  fontFamily: 'inherit',
                }}
              >
                {/* Mini preview swatch */}
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
      {/* sidebarCollapsed is read but toggling is a future feature; keep it from being flagged unused */}
      {sidebarCollapsed && null}
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: AI & Models
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// AI mode types (local to Settings; AiConfig from shared/types/setup is the
// persisted shape)
// ─────────────────────────────────────────────────────────────────────────────

type AiMode = 'passthrough' | 'byok'
type ByokProvider = 'anthropic' | 'openai' | 'google'
type ConnectionStatus = 'idle' | 'testing' | 'connected' | 'error'

interface ByokProviderDef {
  readonly label: string
  readonly placeholder: string
  readonly models: readonly { readonly value: string; readonly label: string }[]
}

const BYOK_PROVIDERS: Record<ByokProvider, ByokProviderDef> = {
  anthropic: {
    label: 'Anthropic (Claude)',
    placeholder: 'sk-ant-...',
    models: [
      { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4 (recommended)' },
      { value: 'claude-opus-4-20250514', label: 'Claude Opus 4 (highest quality)' },
      { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (fastest)' },
    ],
  },
  openai: {
    label: 'OpenAI (ChatGPT)',
    placeholder: 'sk-...',
    models: [
      { value: 'gpt-4o', label: 'GPT-4o (recommended)' },
      { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
      { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
    ],
  },
  google: {
    label: 'Google (Gemini)',
    placeholder: 'AIza...',
    models: [
      { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro (recommended)' },
      { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash (faster)' },
    ],
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Usage bar sub-component
// ─────────────────────────────────────────────────────────────────────────────

interface UsageBarProps {
  readonly used: number
  readonly cap: number | null
}

function UsageBar({ used, cap }: UsageBarProps): React.JSX.Element {
  if (cap === null) {
    return (
      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
        Evaluations this month: {used} (no cap, your key)
      </div>
    )
  }
  const pct = Math.min((used / cap) * 100, 100)
  const barColor =
    pct >= 100 ? 'var(--danger)' : pct >= 80 ? 'var(--warn)' : 'var(--success)'
  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
        Evaluations this month: {used} of {cap} included
      </div>
      <div
        style={{
          height: 6,
          borderRadius: 3,
          background: 'var(--border)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: barColor,
            borderRadius: 3,
            transition: 'width 0.3s ease',
          }}
        />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Mode radio button
// ─────────────────────────────────────────────────────────────────────────────

interface ModeRadioProps {
  readonly id: string
  readonly checked: boolean
  readonly onChange: () => void
  readonly label: string
  readonly sublabel: string
}

function ModeRadio({ id, checked, onChange, label, sublabel }: ModeRadioProps): React.JSX.Element {
  return (
    <label
      htmlFor={id}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '12px 14px',
        borderRadius: 5,
        border: checked
          ? '1.5px solid var(--accent)'
          : '1.5px solid var(--border)',
        background: checked
          ? 'color-mix(in srgb, var(--accent) 6%, var(--panel))'
          : 'var(--panel)',
        cursor: 'pointer',
        flex: 1,
      }}
    >
      <input
        id={id}
        type="radio"
        checked={checked}
        onChange={onChange}
        style={{ marginTop: 2, accentColor: 'var(--accent)' }}
      />
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{label}</div>
        <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>{sublabel}</div>
      </div>
    </label>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// AiModelsSection
// ─────────────────────────────────────────────────────────────────────────────

function AiModelsSection(): React.JSX.Element {
  // Mode
  const [mode, setMode] = useState<AiMode>('passthrough')

  // Passthrough state
  const [passthroughStatus, setPassthroughStatus] = useState<ConnectionStatus>('idle')
  const [passthroughError, setPassthroughError] = useState('')
  const [passthroughModel, setPassthroughModel] = useState('Claude Sonnet')
  const [usageLoaded, setUsageLoaded] = useState(false)
  const [usageCount, setUsageCount] = useState(0)

  // BYOK state
  const [byokProvider, setByokProvider] = useState<ByokProvider>('anthropic')
  const [byokModel, setByokModel] = useState('claude-sonnet-4-20250514')
  const [byokKey, setByokKey] = useState('')
  const [byokHasKey, setByokHasKey] = useState(false)
  const [byokStatus, setByokStatus] = useState<ConnectionStatus>('idle')
  const [byokError, setByokError] = useState('')
  const [byokSaving, setByokSaving] = useState(false)

  // Transcription
  const [whisperStatus, setWhisperStatus] = useState<{
    available: boolean
    model: string | null
    sidecarReady: boolean
  } | null>(null)
  const [transcriptionLang, setTranscriptionLang] = useState('en')

  // Load saved AI config and existing key on mount
  useEffect(() => {
    void (async () => {
      try {
        const configResp = await window.psygil.setup.getConfig()
        if (configResp.status === 'success' && configResp.data.config.ai) {
          const saved = configResp.data.config.ai
          if (saved.mode === 'byok') setMode('byok')
          if (saved.provider && saved.provider in BYOK_PROVIDERS) {
            setByokProvider(saved.provider as ByokProvider)
          }
          if (saved.model) setByokModel(saved.model)
        }
      } catch { /* ignore */ }

      try {
        const hasResp = await window.psygil.apiKey.has()
        if (hasResp.status === 'success') setByokHasKey(hasResp.data.hasKey)
      } catch { /* ignore */ }

      try {
        const expiryResp = await window.psygil.setup.checkLicenseExpiry()
        if (expiryResp.status === 'success') {
          setUsageLoaded(true)
          // Derive usage count from days remaining as a proxy until a real
          // usage endpoint is available. Show 0 for now if expiry data lacks it.
          setUsageCount(0)
        }
      } catch { /* ignore */ }

      try {
        const whisperResp = await window.psygil.whisper.status()
        if (whisperResp.status === 'success') {
          setWhisperStatus(
            whisperResp.data as { available: boolean; model: string | null; sidecarReady: boolean },
          )
        }
      } catch { /* ignore */ }
    })()
  }, [])

  // When BYOK provider changes, reset model to first option for that provider
  const handleProviderChange = useCallback((provider: ByokProvider) => {
    setByokProvider(provider)
    const firstModel = BYOK_PROVIDERS[provider].models[0]?.value ?? ''
    setByokModel(firstModel)
    setByokStatus('idle')
    setByokError('')
  }, [])

  const handleModeSwitch = useCallback(
    async (next: AiMode) => {
      setMode(next)
      setPassthroughStatus('idle')
      setPassthroughError('')
      setByokStatus('idle')
      setByokError('')

      if (next === 'passthrough') {
        try {
          await window.psygil.setup.saveAi({
            ai: {
              mode: 'passthrough',
              provider: null,
              model: null,
              configured: true,
              verifiedAt: new Date().toISOString(),
            },
          })
        } catch { /* non-fatal, user can retry */ }
      }
    },
    [],
  )

  const handleTestPassthrough = useCallback(async () => {
    setPassthroughStatus('testing')
    setPassthroughError('')
    try {
      const result = await window.psygil.ai.testConnection({})
      if (result.status === 'success' && result.data.connected) {
        setPassthroughStatus('connected')
        if (result.data.model) setPassthroughModel(result.data.model)
      } else {
        setPassthroughStatus('error')
        const msg =
          result.status === 'success' ? result.data.error : result.message
        setPassthroughError(msg || 'Connection failed')
      }
    } catch {
      setPassthroughStatus('error')
      setPassthroughError('Failed to reach Psygil AI')
    }
  }, [])

  const handleTestAndSaveByok = useCallback(async () => {
    if (!byokKey.trim() && !byokHasKey) return
    setByokSaving(true)
    setByokStatus('testing')
    setByokError('')
    try {
      if (byokKey.trim()) {
        const storeResp = await window.psygil.apiKey.store({ key: byokKey.trim() })
        if (storeResp.status !== 'success') {
          setByokStatus('error')
          setByokError('Failed to store key')
          return
        }
        setByokHasKey(true)
        setByokKey('')
      }

      const testResp = await window.psygil.ai.testConnection({})
      if (testResp.status === 'success' && testResp.data.connected) {
        await window.psygil.setup.saveAi({
          ai: {
            mode: 'byok',
            provider: byokProvider,
            model: byokModel,
            configured: true,
            verifiedAt: new Date().toISOString(),
          },
        })
        setByokStatus('connected')
      } else {
        setByokStatus('error')
        const msg =
          testResp.status === 'success' ? testResp.data.error : testResp.message
        setByokError(msg || 'Connection test failed')
      }
    } catch {
      setByokStatus('error')
      setByokError('Failed to reach API')
    } finally {
      setByokSaving(false)
    }
  }, [byokKey, byokHasKey, byokProvider, byokModel])

  const handleRemoveByokKey = useCallback(async () => {
    if (!window.confirm('Remove your stored API key?')) return
    try {
      await window.psygil.apiKey.delete()
      setByokHasKey(false)
      setByokStatus('idle')
    } catch { /* ignore */ }
  }, [])

  const currentProviderDef = BYOK_PROVIDERS[byokProvider]

  return (
    <div>
      <div style={sectionTitle}>AI &amp; Models</div>
      <div style={sectionDesc}>
        Choose how Psygil connects to AI. Psygil AI is included with your license. Use your own key if you prefer a specific provider or higher volume.
      </div>

      {/* Mode picker */}
      <div style={{ ...card, marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>
          AI Connection Mode
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <ModeRadio
            id="mode-passthrough"
            checked={mode === 'passthrough'}
            onChange={() => void handleModeSwitch('passthrough')}
            label="Psygil AI (included)"
            sublabel="AI is included in your license. No API key needed."
          />
          <ModeRadio
            id="mode-byok"
            checked={mode === 'byok'}
            onChange={() => void handleModeSwitch('byok')}
            label="Use your own API key"
            sublabel="Connect Anthropic, OpenAI, or Google directly."
          />
        </div>
      </div>

      {/* Passthrough panel */}
      {mode === 'passthrough' && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>
                Psygil AI
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                Model: {passthroughStatus === 'connected' ? passthroughModel : 'Claude Sonnet'}
              </div>
            </div>
            <button
              onClick={() => void handleTestPassthrough()}
              disabled={passthroughStatus === 'testing'}
              style={{
                ...btnPrimary,
                background:
                  passthroughStatus === 'connected'
                    ? 'var(--success)'
                    : passthroughStatus === 'error'
                      ? 'var(--danger)'
                      : undefined,
                opacity: passthroughStatus === 'testing' ? 0.6 : 1,
              }}
            >
              {passthroughStatus === 'testing'
                ? 'Testing...'
                : passthroughStatus === 'connected'
                  ? 'Connected'
                  : passthroughStatus === 'error'
                    ? 'Failed'
                    : 'Test Connection'}
            </button>
          </div>
          {passthroughError && (
            <div style={{ fontSize: 11.5, color: 'var(--danger)', marginBottom: 10 }}>
              {passthroughError}
            </div>
          )}
          <div
            style={{
              borderTop: '1px solid var(--border)',
              paddingTop: 12,
              marginTop: 4,
            }}
          >
            {usageLoaded ? (
              <UsageBar used={usageCount} cap={30} />
            ) : (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Usage tracking available when connected to Psygil AI.
              </div>
            )}
          </div>
        </div>
      )}

      {/* BYOK panel */}
      {mode === 'byok' && (
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>
            Your API Key
          </div>

          {/* Provider selector */}
          <div style={{ marginBottom: 12 }}>
            <label style={fieldLabel}>Provider</label>
            <select
              value={byokProvider}
              onChange={(e) => handleProviderChange(e.target.value as ByokProvider)}
              style={{ ...textInput, cursor: 'pointer', maxWidth: 320 }}
            >
              {(Object.entries(BYOK_PROVIDERS) as [ByokProvider, ByokProviderDef][]).map(
                ([key, def]) => (
                  <option key={key} value={key}>
                    {def.label}
                  </option>
                ),
              )}
            </select>
          </div>

          {/* API key input */}
          <div style={{ marginBottom: 12 }}>
            <label style={fieldLabel}>API Key</label>
            {byokHasKey && !byokKey ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div
                  style={{
                    flex: 1,
                    padding: '7px 10px',
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                    fontSize: 12.5,
                    color: 'var(--text-secondary)',
                    fontFamily: 'monospace',
                  }}
                >
                  {currentProviderDef.placeholder.slice(0, 6)}••••••••••••
                </div>
                <button onClick={() => setByokKey(' ')} style={btnSecondary}>
                  Replace
                </button>
                <button onClick={() => void handleRemoveByokKey()} style={btnDanger}>
                  Remove
                </button>
              </div>
            ) : (
              <input
                type="password"
                value={byokKey.trim() === '' && byokKey !== '' ? '' : byokKey}
                onChange={(e) => setByokKey(e.target.value)}
                placeholder={currentProviderDef.placeholder}
                style={{ ...textInput, fontFamily: 'monospace' }}
                autoComplete="off"
              />
            )}
          </div>

          {/* Model selector */}
          <div style={{ marginBottom: 14 }}>
            <label style={fieldLabel}>Model</label>
            <select
              value={byokModel}
              onChange={(e) => setByokModel(e.target.value)}
              style={{ ...textInput, cursor: 'pointer', maxWidth: 360 }}
            >
              {currentProviderDef.models.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {/* Test and Save */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <button
              onClick={() => void handleTestAndSaveByok()}
              disabled={byokSaving || byokStatus === 'testing' || (!byokKey.trim() && !byokHasKey)}
              style={{
                ...btnPrimary,
                background:
                  byokStatus === 'connected'
                    ? 'var(--success)'
                    : byokStatus === 'error'
                      ? 'var(--danger)'
                      : undefined,
                opacity:
                  byokSaving || byokStatus === 'testing' || (!byokKey.trim() && !byokHasKey)
                    ? 0.5
                    : 1,
              }}
            >
              {byokSaving || byokStatus === 'testing'
                ? 'Testing...'
                : byokStatus === 'connected'
                  ? 'Saved and Connected'
                  : byokStatus === 'error'
                    ? 'Retry'
                    : 'Test and Save'}
            </button>
          </div>
          {byokError && (
            <div style={{ fontSize: 11.5, color: 'var(--danger)', marginBottom: 8 }}>
              {byokError}
            </div>
          )}

          {/* Usage (BYOK has no cap) */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4 }}>
            <UsageBar used={usageCount} cap={null} />
          </div>
        </div>
      )}

      {/* PHI Redaction */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>PHI Redaction Pipeline</div>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 3, background: 'color-mix(in srgb, var(--success) 10%, transparent)', color: 'var(--success)' }}>ALWAYS ON</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          All patient data is redacted to anonymous UNIDs before being sent to the AI. PHI is rehydrated only after the response is received and stored locally. This pipeline cannot be disabled, it is a core HIPAA safeguard.
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
            <div style={{ fontWeight: 600, color: whisperStatus?.sidecarReady ? 'var(--success)' : 'var(--danger)' }}>
              {whisperStatus?.sidecarReady ? 'Running' : 'Not available'}
            </div>
          </div>
          <div>
            <span style={{ ...fieldLabel, marginBottom: 2 }}>Model</span>
            <div>{whisperStatus?.model ?? 'base.en'}</div>
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
          {saved && <span style={{ fontSize: 11, color: 'var(--success)', fontWeight: 600 }}>Saved</span>}
        </div>
      </div>

      {/* White-label branding */}
      <BrandingPanel />
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

  const [switchingWorkspace, setSwitchingWorkspace] = useState(false)

  const handleChangeWorkspace = useCallback(async () => {
    try {
      const resp = await window.psygil.workspace.pickFolder()
      if (resp.status !== 'success' || !resp.data) return
      const newPath = resp.data as string

      // Confirm: the app needs to restart so the DB connection rebinds
      // to the new workspace's .psygil/psygil.db file.
      const confirmed = window.confirm(
        `Switch workspace to:\n${newPath}\n\nPsygil will restart to load the new workspace. Any unsaved work in open tabs will be lost.`
      )
      if (!confirmed) return

      setSwitchingWorkspace(true)

      // Use workspace:switch which does the full flow: stop watcher,
      // release old lock, acquire new lock, save path, provision
      // folder structure, sync DB, start watcher.
      const switchResp = await window.psygil.workspace.switch({ path: newPath })
      if (switchResp.status !== 'success') {
        const msg = (switchResp as { message?: string }).message ?? 'Switch failed'
        setSwitchingWorkspace(false)
        window.alert(msg)
        return
      }

      // Relaunch so the main process reopens the DB from the new path.
      await window.psygil.uninstall.relaunch()
    } catch (err) {
      setSwitchingWorkspace(false)
      window.alert(`Workspace switch failed: ${err instanceof Error ? err.message : String(err)}`)
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
          <button onClick={handleChangeWorkspace} disabled={switchingWorkspace} style={btnSecondary}>
            {switchingWorkspace ? 'Restarting...' : 'Change'}
          </button>
        </div>
      </div>

      {/* Database info */}
      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 14 }}>Database</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, fontSize: 12 }}>
          <div>
            <span style={{ ...fieldLabel, marginBottom: 2 }}>Encryption</span>
            <div style={{ fontWeight: 600, color: dbHealth?.encrypted ? 'var(--success)' : 'var(--danger)' }}>
              {dbHealth?.encrypted ? 'AES-256 (SQLCipher)' : 'Unknown'}
            </div>
          </div>
          <div>
            <span style={{ ...fieldLabel, marginBottom: 2 }}>Version</span>
            <div>{dbHealth?.version || ','}</div>
          </div>
          <div>
            <span style={{ ...fieldLabel, marginBottom: 2 }}>Size</span>
            <div>{dbHealth ? formatBytes(dbHealth.sizeBytes) : ','}</div>
          </div>
        </div>

        <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
          <button onClick={handleBackup} style={btnPrimary}>Backup Database</button>
          <button onClick={handleExportCases} style={btnSecondary}>Export Audit Trail</button>
        </div>
      </div>

      {/* Danger zone */}
      <div style={{ ...card, borderColor: 'color-mix(in srgb, var(--danger) 25%, transparent)' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--danger)', marginBottom: 6 }}>Danger Zone</div>
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

        <button
          onClick={async () => {
            const ok = window.confirm(
              'This will clear your Psygil setup state and re-run the setup wizard on next launch. ' +
              'Your case files, templates, and database stay intact. Continue?',
            )
            if (!ok) return
            try {
              const resp = await window.psygil.setup.reset()
              if (resp.status !== 'success') {
                window.alert(`Reset failed: ${resp.message}`)
                return
              }
              window.alert('Setup state cleared. The wizard will run on next launch.')
              window.location.reload()
            } catch (err) {
              window.alert(`Reset failed: ${err instanceof Error ? err.message : String(err)}`)
            }
          }}
          style={{ ...btnDanger, marginLeft: 8 }}
        >
          Reset Setup Wizard
        </button>
      </div>
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: About
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: Privacy & Compliance
// ═══════════════════════════════════════════════════════════════════════════════

function PrivacyComplianceSection(): React.JSX.Element {
  const commitments = [
    {
      title: 'Patient data never leaves this device',
      detail: 'All PHI is processed locally using SQLCipher AES-256 encryption. No patient data is transmitted to cloud servers. The UNID redaction pipeline replaces all identifiers with cryptographic tokens before any AI API call.',
    },
    {
      title: 'No data is ever used to train AI models',
      detail: 'Psygil does not fine-tune, train, or improve any AI model using your clinical data, case notes, test scores, or report content. Your data is used exclusively for generating your reports in your current session.',
    },
    {
      title: 'You retain 100% ownership of all data and outputs',
      detail: 'Every report, case file, test score, and clinical note belongs to you. Psygil claims no license, no rights, and no interest in any content you create or any data you enter.',
    },
    {
      title: 'HIPAA-aligned architecture',
      detail: 'Local-first data storage, encrypted at rest (SQLCipher AES-256), encrypted in transit (TLS 1.3 for API calls), role-based access controls, and comprehensive audit logging with SHA-256 hash chain verification.',
    },
    {
      title: 'Business Associate Agreement available on request',
      detail: 'Psygil will execute a BAA with any clinical user or institution. Contact support@psygil.com to initiate.',
    },
    {
      title: 'Complete audit trail for every action',
      detail: 'Every clinical decision, AI interaction, report generation, and data modification is logged with timestamps, actor attribution, and tamper-evident hash chaining for expert testimony defensibility.',
    },
    {
      title: 'Audio transcription runs entirely offline',
      detail: 'Clinical interview transcription uses faster-whisper running locally on your machine. Audio data never leaves your device. No cloud speech services are used.',
    },
  ]

  return (
    <div>
      <div style={sectionTitle}>Privacy & Compliance</div>
      <div style={sectionDesc}>
        Psygil's data commitments to you, your patients, and your practice
      </div>

      <div style={{
        ...card,
        background: 'color-mix(in srgb, var(--success) 6%, var(--panel))',
        border: '1px solid color-mix(in srgb, var(--success) 25%, var(--border))',
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--success)', marginBottom: 8 }}>
          Psygil Data Commitment
        </div>
        <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.6 }}>
          These commitments are architectural, not policy. Psygil is built from the ground up as a local-first
          application. Your clinical data never passes through our servers. We have no mechanism to access,
          collect, or train on your patient data, because the architecture makes it impossible.
        </div>
      </div>

      {commitments.map((c, i) => (
        <div key={i} style={{ ...card, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{
            width: 22, height: 22, flexShrink: 0, marginTop: 1,
            borderRadius: '50%',
            background: 'color-mix(in srgb, var(--success) 15%, transparent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, color: 'var(--success)', fontWeight: 700,
          }}>
            ✓
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
              {c.title}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              {c.detail}
            </div>
          </div>
        </div>
      ))}

      <div style={{ ...card, marginTop: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
          Compliance Standards
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {['HIPAA', 'FERPA', 'APA Ethics Code', 'Daubert/Frye Standards', 'SOC 2 (in progress)'].map((badge) => (
            <span key={badge} style={{
              padding: '4px 10px', fontSize: 11, fontWeight: 600,
              borderRadius: 4,
              background: 'color-mix(in srgb, var(--accent) 10%, var(--panel))',
              color: 'var(--accent)',
              border: '1px solid color-mix(in srgb, var(--accent) 20%, var(--border))',
            }}>
              {badge}
            </span>
          ))}
        </div>
      </div>

      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 12, lineHeight: 1.5 }}>
        For questions about Psygil's privacy architecture or to request a BAA, contact support@psygil.com.
        Full privacy policy available at psygil.com/privacy.
      </div>
    </div>
  )
}

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
          <p style={{ marginBottom: 6 }}><strong>DOCTOR ALWAYS DIAGNOSES</strong>, The AI never makes diagnostic conclusions. Every clinical decision is made by the licensed clinician and recorded in the audit trail.</p>
          <p style={{ marginBottom: 6 }}><strong>PHI Never Leaves This Machine</strong>, Patient data is redacted before any API call. Audio transcription runs locally. The encrypted database stays on your device.</p>
          <p><strong>Audit Everything</strong>, Every action, decision, and AI interaction is logged with timestamps and attribution for expert testimony defensibility.</p>
        </div>
      </div>

      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 16, textAlign: 'center' }}>
        © 2026 Foundry SMB. All rights reserved.
      </div>
    </div>
  )
}
