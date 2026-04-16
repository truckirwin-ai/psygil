import React, { useEffect, useState } from 'react'
import OnlyOfficeEditor from '../editors/OnlyOfficeEditor'

/**
 * EvalReportTab, Sprint 10
 *
 * Displays the Writer Agent's draft report sections with Editor Agent annotations.
 * Supports both HTML preview mode (existing) and OnlyOffice editor mode (new).
 *
 * DATA FLOW:
 *   window.psygil.writer.getResult({ caseId }) → WriterOutput (sections)
 *   window.psygil.editor.getResult({ caseId }) → EditorOutput (annotations)
 *   window.psygil.onlyoffice.generateDocx({ caseId }) → DOCX file
 *
 * Features:
 * - Report sections from Writer Agent, each tagged with content_type
 * - Orange dashed border on AI-drafted sections requiring revision
 * - Editor annotations displayed as inline flags with severity colors
 * - Accept/dismiss per annotation
 * - Section navigation sidebar
 * - Mode toggle: Preview (HTML) ↔ Editor (OnlyOffice)
 * - Generate DOCX button to create editable document
 * - Falls back to static mock report when no agent data available
 */

export interface EvalReportTabProps {
  readonly caseId: number
}

// ---------------------------------------------------------------------------
// Writer/Editor output shapes (mirrors main/agents/*.ts)
// ---------------------------------------------------------------------------

interface WriterSection {
  section_name: string
  section_number?: number
  content: string
  content_type: 'fully_generated' | 'draft_requiring_revision'
  revision_notes?: string
  sources: string[]
  confidence: number
}

interface WriterOutput {
  case_id: string
  version: string
  generated_at: string
  sections: WriterSection[]
  report_summary: {
    patient_name?: string
    evaluation_dates?: string
    evaluation_type?: string
    selected_diagnoses: string[]
    total_sections: number
    sections_requiring_revision: number
    estimated_revision_time_minutes?: number
  }
}

interface EditorAnnotation {
  flag_id: string
  location: {
    section_name: string
    paragraph_reference?: string
    sentence_or_quote?: string
  }
  flag_type: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  description: string
  suggestion: string
}

interface EditorOutput {
  case_id: string
  version: string
  generated_at: string
  review_summary: {
    total_flags: number
    critical_flags: number
    high_flags: number
    medium_flags: number
    low_flags: number
    overall_assessment: string
  }
  annotations: EditorAnnotation[]
  revision_priorities?: Array<{
    priority_order: number
    section: string
    key_issues: string[]
  }>
}

// ---------------------------------------------------------------------------
// Severity colors
// ---------------------------------------------------------------------------

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#d32f2f',
  high: '#f44336',
  medium: '#ff9800',
  low: '#2196f3',
}

const SEVERITY_BG: Record<string, string> = {
  critical: '#ffebee',
  high: '#ffebee',
  medium: '#fff3e0',
  low: '#e3f2fd',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface TemplateSummary {
  id: string
  name: string
  evalType: string
  source: 'builtin' | 'custom'
  sectionCount: number
}

interface TemplateProfileSection {
  heading: string
  contentType: string
  exampleProse: string
  estimatedLength: string
  order: number
}

interface TemplateProfileData {
  id: string
  name: string
  evalType: string
  sections: TemplateProfileSection[]
}

export default function EvalReportTab({ caseId }: EvalReportTabProps): React.JSX.Element {
  const [writerOutput, setWriterOutput] = useState<WriterOutput | null>(null)
  const [editorOutput, setEditorOutput] = useState<EditorOutput | null>(null)
  const [dismissedFlags, setDismissedFlags] = useState<Set<string>>(new Set())
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [toolbarTab, setToolbarTab] = useState('Home')
  const [mode, setMode] = useState<'preview' | 'editor'>('preview')
  const [docxPath, setDocxPath] = useState<string | null>(null)
  const [docxVersion, setDocxVersion] = useState<number>(0)
  const [generating, setGenerating] = useState(false)
  const [ooStatus, setOoStatus] = useState<{ running: boolean; healthy: boolean } | null>(null)
  const [templates, setTemplates] = useState<TemplateSummary[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [evalType, setEvalType] = useState<string>('')
  const [templateProfile, setTemplateProfile] = useState<TemplateProfileData | null>(null)

  // Load writer and editor outputs
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const [writerRes, editorRes] = await Promise.all([
          window.psygil.writer.getResult({ caseId }),
          window.psygil.editor.getResult({ caseId }),
        ])
        if (cancelled) return

        if (writerRes.status === 'success' && writerRes.data) {
          setWriterOutput(writerRes.data as WriterOutput)
        }
        if (editorRes.status === 'success' && editorRes.data) {
          setEditorOutput(editorRes.data as EditorOutput)
        }
      } catch (err) {
        console.error('[EvalReportTab] Failed to load agent results:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [caseId])

  // Check OnlyOffice status on mount
  useEffect(() => {
    let cancelled = false
    const checkStatus = async () => {
      try {
        const res = await window.psygil.onlyoffice.status()
        if (!cancelled && res.status === 'success') {
          setOoStatus({ running: res.data.running, healthy: res.data.healthy })
        }
      } catch (err) {
        console.error('[EvalReportTab] Failed to check OnlyOffice status:', err)
      }
    }
    checkStatus()
    return () => { cancelled = true }
  }, [])

  // Load case eval type and matching templates
  useEffect(() => {
    let cancelled = false
    const loadTemplates = async () => {
      try {
        // Get case eval type
        const caseRes = await window.psygil.cases.get({ case_id: caseId })
        if (cancelled) return
        const caseEvalType = caseRes.status === 'success' ? (caseRes.data as { evaluation_type?: string }).evaluation_type || '' : ''
        setEvalType(caseEvalType)

        // Load templates filtered by eval type
        const tplRes = await window.psygil.templates.list(caseEvalType ? { evalType: caseEvalType } : undefined)
        if (cancelled) return
        if (tplRes.status === 'success') {
          setTemplates(tplRes.data as unknown as TemplateSummary[])
        }

        // Get last used template for this eval type
        if (caseEvalType) {
          const lastUsedRes = await window.psygil.templates.getLastUsed({ evalType: caseEvalType })
          if (cancelled) return
          if (lastUsedRes.status === 'success' && lastUsedRes.data) {
            setSelectedTemplateId(lastUsedRes.data as string)
          } else if (tplRes.status === 'success' && (tplRes.data as unknown as TemplateSummary[]).length > 0) {
            // Default to first template
            setSelectedTemplateId((tplRes.data as unknown as TemplateSummary[])[0].id)
          }
        }
      } catch (err) {
        console.error('[EvalReportTab] Failed to load templates:', err)
      }
    }
    loadTemplates()
    return () => { cancelled = true }
  }, [caseId])

  // When template selection changes, persist it and load the profile
  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId)
    if (evalType) {
      void window.psygil.templates.setLastUsed({ evalType, templateId })
    }
    if (templateId) {
      void (async () => {
        try {
          const res = await window.psygil.templates.get({ id: templateId })
          if (res.status === 'success') {
            setTemplateProfile(res.data as unknown as TemplateProfileData)
          }
        } catch (err) {
          console.error('[EvalReportTab] Failed to load template profile:', err)
        }
      })()
    } else {
      setTemplateProfile(null)
    }
  }

  // Load initial template profile when selectedTemplateId is set from last-used
  useEffect(() => {
    if (!selectedTemplateId) return
    let cancelled = false
    const loadProfile = async () => {
      try {
        const res = await window.psygil.templates.get({ id: selectedTemplateId })
        if (!cancelled && res.status === 'success') {
          setTemplateProfile(res.data as unknown as TemplateProfileData)
        }
      } catch (err) {
        console.error('[EvalReportTab] Failed to load initial template profile:', err)
      }
    }
    loadProfile()
    return () => { cancelled = true }
  }, [selectedTemplateId])

  const hasWriter = !!writerOutput
  const hasEditor = !!editorOutput
  const canEditMode = hasWriter && ooStatus?.running && docxPath

  // Get annotations for a section
  const getAnnotationsForSection = (sectionName: string): EditorAnnotation[] => {
    if (!editorOutput) return []
    return editorOutput.annotations.filter(
      (a) => a.location.section_name.toLowerCase() === sectionName.toLowerCase() && !dismissedFlags.has(a.flag_id)
    )
  }

  // All non-dismissed annotations count
  const activeAnnotationCount = editorOutput
    ? editorOutput.annotations.filter((a) => !dismissedFlags.has(a.flag_id)).length
    : 0

  // -------------------------------------------------------------------------
  // If we have Writer output, render the live report
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <div style={{ padding: '20px', fontSize: '13px', color: 'var(--text-secondary)' }}>
        Loading report...
      </div>
    )
  }

  // Build the template selector shared by both views
  const templateSelector = templates.length > 0 ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Template:</span>
      <select
        value={selectedTemplateId}
        onChange={(e) => handleTemplateChange(e.target.value)}
        style={{
          padding: '3px 8px', fontSize: 11,
          border: '1px solid var(--border)', borderRadius: 4,
          background: 'var(--bg)', color: 'var(--text)',
          maxWidth: 220,
        }}
      >
        <option value="">Select Template</option>
        {templates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}{t.source === 'custom' ? ' (custom)' : ''}
          </option>
        ))}
      </select>
    </div>
  ) : null

  // -------------------------------------------------------------------------
  // No writer output: show template-driven preview
  // -------------------------------------------------------------------------

  if (!hasWriter) {
    return (
      <div style={{ display: 'flex', height: '100%', overflow: 'hidden', flexDirection: 'column' }}>
        {/* Top toolbar with template selector */}
        <div
          style={{
            padding: '8px 16px',
            background: 'var(--panel)',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            gap: '12px',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          <span style={{ flex: 1 }} />
          {templateSelector}
          <span style={{
            padding: '2px 8px', fontSize: 10, fontWeight: 600, borderRadius: 3,
            background: 'rgba(0,120,212,0.08)', color: 'var(--text-secondary)',
          }}>
            Draft
          </span>
        </div>

        <WordToolbar activeTab={toolbarTab} setActiveTab={setToolbarTab} />

        {/* Template-based report preview */}
        <div style={{ flex: 1, overflowY: 'auto', background: 'var(--panel)' }}>
          <div style={{ maxWidth: 860, margin: '0 auto', padding: '24px 60px' }}>
            {templateProfile ? (
              <TemplateReportPreview profile={templateProfile} />
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
                <div style={{ fontSize: 14, marginBottom: 8, color: 'var(--text)' }}>
                  Select a template to preview the report structure.
                </div>
                <div style={{ fontSize: 12 }}>
                  Choose a template from the dropdown above, then run the Writer Agent to generate a draft evaluation report.
                </div>
                <div style={{ fontSize: 11, marginTop: 12, color: 'var(--text-secondary)' }}>
                  Case ID: {caseId}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  const summary = writerOutput.report_summary

  // -------------------------------------------------------------------------
  // Main layout: split view with editor/preview + sidebar
  // -------------------------------------------------------------------------

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', flexDirection: 'column' }}>
      {/* Top toolbar */}
      <div
        style={{
          padding: '8px 16px',
          background: 'var(--panel)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <button
          onClick={async () => {
            setGenerating(true)
            try {
              const res = await window.psygil.onlyoffice.generateDocx({ caseId })
              if (res.status === 'success') {
                setDocxPath(res.data.filePath)
                setDocxVersion(res.data.version)
                setMode('editor')
              } else {
                console.error('[EvalReportTab] Failed to generate DOCX:', res.message)
              }
            } catch (err) {
              console.error('[EvalReportTab] Error generating DOCX:', err)
            } finally {
              setGenerating(false)
            }
          }}
          disabled={generating}
          style={{
            padding: '4px 12px',
            fontSize: '11px',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            backgroundColor: 'var(--bg)',
            color: 'var(--text)',
            cursor: generating ? 'not-allowed' : 'pointer',
            opacity: generating ? 0.6 : 1,
          }}
        >
          {generating ? 'Generating...' : 'Generate DOCX'}
        </button>

        {canEditMode && (
          <>
            <button
              onClick={() => setMode(mode === 'preview' ? 'editor' : 'preview')}
              style={{
                padding: '4px 12px',
                fontSize: '11px',
                border: '1px solid var(--border)',
                borderRadius: '4px',
                backgroundColor: mode === 'editor' ? 'var(--accent)' : 'var(--bg)',
                color: mode === 'editor' ? '#fff' : 'var(--text)',
                cursor: 'pointer',
              }}
            >
              {mode === 'preview' ? 'Open in Editor' : 'Show Preview'}
            </button>
            <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
              v{docxVersion}
            </span>
          </>
        )}

        <span style={{ flex: 1 }} />
        {templateSelector}

        <span style={{
          padding: '2px 8px', fontSize: 10, fontWeight: 600, borderRadius: 3,
          background: 'rgba(0,120,212,0.08)', color: 'var(--text-secondary)',
        }}>
          Draft
        </span>
      </div>

      {/* Main content area */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Editor or Preview */}
        {mode === 'editor' && canEditMode && docxPath ? (
          <OnlyOfficeEditor
            caseId={caseId}
            filePath={docxPath}
            readOnly={false}
            onDocumentReady={() => {
              // Document loaded
            }}
            onDocumentSaved={() => {
              // Document saved
            }}
            onError={(msg) => {
              console.error('[EvalReportTab] Editor error:', msg)
            }}
          />
        ) : (
          <ReportPreview
            writerOutput={writerOutput}
            editorOutput={editorOutput}
            dismissedFlags={dismissedFlags}
            setDismissedFlags={setDismissedFlags}
            activeSection={activeSection}
            setActiveSection={setActiveSection}
            toolbarTab={toolbarTab}
            setToolbarTab={setToolbarTab}
            getAnnotationsForSection={getAnnotationsForSection}
          />
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ReportPreview, extracted HTML preview component
// ---------------------------------------------------------------------------

interface ReportPreviewProps {
  readonly writerOutput: WriterOutput
  readonly editorOutput: EditorOutput | null
  readonly dismissedFlags: Set<string>
  readonly setDismissedFlags: (setter: (prev: Set<string>) => Set<string>) => void
  readonly activeSection: string | null
  readonly setActiveSection: (name: string | null) => void
  readonly toolbarTab: string
  readonly setToolbarTab: (tab: string) => void
  readonly getAnnotationsForSection: (sectionName: string) => EditorAnnotation[]
}

function ReportPreview({
  writerOutput,
  editorOutput,
  dismissedFlags,
  setDismissedFlags,
  activeSection,
  setActiveSection,
  toolbarTab,
  setToolbarTab,
  getAnnotationsForSection,
}: ReportPreviewProps): React.JSX.Element {
  const summary = writerOutput.report_summary
  const hasEditor = !!editorOutput

  const activeAnnotationCount = editorOutput
    ? editorOutput.annotations.filter((a) => !dismissedFlags.has(a.flag_id)).length
    : 0

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', flex: 1 }}>
      {/* Section navigation sidebar (right side, 25%) */}
      <div
        style={{
          width: 'calc(25% - 0.5px)',
          flexShrink: 0,
          borderLeft: '1px solid var(--border)',
          overflowY: 'auto',
          padding: '8px 0',
          background: 'var(--bg)',
          order: 2,
        }}
      >
        <div
          style={{
            padding: '4px 12px',
            fontSize: '10px',
            color: 'var(--text-secondary)',
            fontWeight: 600,
            textTransform: 'uppercase',
            marginBottom: '4px',
          }}
        >
          Sections
        </div>
        {writerOutput.sections.map((s, i) => {
          const sectionAnnotations = getAnnotationsForSection(s.section_name)
          const isActive = activeSection === s.section_name
          return (
            <div
              key={i}
              onClick={() => {
                setActiveSection(s.section_name)
                document.getElementById(`section-${i}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
              style={{
                padding: '6px 12px',
                fontSize: '11px',
                cursor: 'pointer',
                color: isActive ? 'var(--accent)' : 'var(--text)',
                background: isActive ? 'var(--highlight)' : 'transparent',
                borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {s.section_name}
              </span>
              <span style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0 }}>
                {s.content_type === 'draft_requiring_revision' && (
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ff9800' }} />
                )}
                {sectionAnnotations.length > 0 && (
                  <span
                    style={{
                      fontSize: '9px',
                      background: '#f44336',
                      color: '#fff',
                      borderRadius: '8px',
                      padding: '0 4px',
                      minWidth: '14px',
                      textAlign: 'center',
                    }}
                  >
                    {sectionAnnotations.length}
                  </span>
                )}
              </span>
            </div>
          )
        })}

        {/* Report summary at bottom of sidebar */}
        <div
          style={{
            margin: '12px 8px',
            padding: '8px',
            background: 'var(--panel)',
            borderRadius: '4px',
            fontSize: '10px',
          }}
        >
          <div style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>Report Summary</div>
          <div style={{ color: 'var(--text)' }}>{summary.total_sections} sections</div>
          {summary.sections_requiring_revision > 0 && (
            <div style={{ color: '#ff9800' }}>{summary.sections_requiring_revision} need revision</div>
          )}
          {hasEditor && (
            <div style={{ color: activeAnnotationCount > 0 ? '#f44336' : '#4caf50' }}>
              {activeAnnotationCount} active flags
            </div>
          )}
          {summary.selected_diagnoses.length > 0 && (
            <div style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
              Dx: {summary.selected_diagnoses.join(', ')}
            </div>
          )}
        </div>
      </div>

      {/* Main report content (left side, 75%) */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', order: 1 }}>
        {/* Editor review banner */}
        {hasEditor && (
          <div
            style={{
              padding: '8px 16px',
              fontSize: '12px',
              display: 'flex',
              gap: '12px',
              alignItems: 'center',
              borderBottom: '1px solid var(--border)',
              flexShrink: 0,
              background:
                editorOutput.review_summary.overall_assessment === 'ready_for_clinician_review'
                  ? '#e8f5e9'
                  : '#fff3e0',
            }}
          >
            <strong>Editor Review:</strong>
            <span>{editorOutput.review_summary.overall_assessment.replace(/_/g, ' ')}</span>
            <span style={{ color: 'var(--text-secondary)' }}>|</span>
            {editorOutput.review_summary.critical_flags > 0 && (
              <span style={{ color: '#d32f2f', fontWeight: 600 }}>
                {editorOutput.review_summary.critical_flags} critical
              </span>
            )}
            {editorOutput.review_summary.high_flags > 0 && (
              <span style={{ color: '#f44336' }}>{editorOutput.review_summary.high_flags} high</span>
            )}
            {editorOutput.review_summary.medium_flags > 0 && (
              <span style={{ color: '#ff9800' }}>{editorOutput.review_summary.medium_flags} medium</span>
            )}
            {editorOutput.review_summary.low_flags > 0 && (
              <span style={{ color: '#2196f3' }}>{editorOutput.review_summary.low_flags} low</span>
            )}
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
              Editor v{editorOutput.version}
            </span>
          </div>
        )}

        {/* Word-style toolbar */}
        <WordToolbar activeTab={toolbarTab} setActiveTab={setToolbarTab} />

        {/* Document body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0' }}>
          <div
            className="document-editor"
            style={{ maxWidth: 860, margin: '0 auto', padding: '24px 60px', minHeight: '100%' }}
          >
            {/* Report header */}
            {summary.evaluation_type && (
              <>
                <p
                  style={{
                    textAlign: 'center',
                    textTransform: 'uppercase',
                    fontWeight: 'bold',
                    fontSize: 14,
                    marginBottom: 8,
                  }}
                >
                  CONFIDENTIAL FORENSIC EVALUATION REPORT
                </p>
                <p
                  style={{
                    textAlign: 'center',
                    textTransform: 'uppercase',
                    fontWeight: 'bold',
                    fontSize: 14,
                    marginBottom: 30,
                  }}
                >
                  {summary.evaluation_type.toUpperCase()} EVALUATION
                </p>
              </>
            )}

            {/* Render each section */}
            {writerOutput.sections.map((section, i) => {
              const annotations = getAnnotationsForSection(section.section_name)
              const isDraft = section.content_type === 'draft_requiring_revision'

              return (
                <div key={i} id={`section-${i}`} style={{ marginBottom: '24px' }}>
                  {/* Section content */}
                  {isDraft ? (
                    <div
                      style={{
                        border: '2px dashed #ff9800',
                        background: '#fff8e1',
                        borderRadius: 4,
                        padding: 16,
                        position: 'relative',
                      }}
                    >
                      <div
                        style={{
                          display: 'inline-block',
                          background: '#ff9800',
                          color: 'white',
                          fontSize: 10,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: 0.5,
                          padding: '2px 8px',
                          borderRadius: 3,
                          marginBottom: 10,
                        }}
                      >
                        AI DRAFT, CLINICIAN REVIEW REQUIRED
                      </div>
                      {section.revision_notes && (
                        <div
                          style={{
                            fontSize: '11px',
                            color: '#e65100',
                            marginBottom: '8px',
                            fontStyle: 'italic',
                          }}
                        >
                          Note: {section.revision_notes}
                        </div>
                      )}
                      <div
                        style={{
                          color: '#333',
                          whiteSpace: 'pre-wrap',
                          lineHeight: '1.7',
                          fontSize: '13px',
                        }}
                      >
                        <p style={{ marginBottom: 8 }}>
                          <strong>{section.section_name.toUpperCase()}</strong>
                        </p>
                        {section.content}
                      </div>
                    </div>
                  ) : (
                    <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.7', fontSize: '13px' }}>
                      <p style={{ marginBottom: 8 }}>
                        <strong>{section.section_name.toUpperCase()}</strong>
                      </p>
                      {section.content}
                    </div>
                  )}

                  {/* Sources */}
                  {section.sources.length > 0 && (
                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      Sources: {section.sources.join(', ')}
                    </div>
                  )}

                  {/* Confidence */}
                  {section.confidence < 0.8 && (
                    <div style={{ fontSize: '10px', color: '#ff9800', marginTop: '2px' }}>
                      Confidence: {Math.round(section.confidence * 100)}%, review carefully
                    </div>
                  )}

                  {/* Editor annotations for this section */}
                  {annotations.length > 0 && (
                    <div style={{ marginTop: '8px' }}>
                      {annotations.map((ann) => (
                        <div
                          key={ann.flag_id}
                          style={{
                            padding: '8px 12px',
                            background: SEVERITY_BG[ann.severity] || '#f5f5f5',
                            borderLeft: `4px solid ${SEVERITY_COLORS[ann.severity] || '#999'}`,
                            borderRadius: '0 4px 4px 0',
                            marginBottom: '6px',
                            fontSize: '12px',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: '4px',
                            }}
                          >
                            <span>
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '1px 6px',
                                  borderRadius: '3px',
                                  fontSize: '10px',
                                  fontWeight: 600,
                                  color: '#fff',
                                  background: SEVERITY_COLORS[ann.severity] || '#999',
                                  marginRight: '6px',
                                }}
                              >
                                {ann.severity.toUpperCase()}
                              </span>
                              <span style={{ color: 'var(--text-secondary)', fontSize: '10px' }}>
                                {ann.flag_type.replace(/_/g, ' ')}
                              </span>
                            </span>
                            <button
                              onClick={() =>
                                setDismissedFlags((prev) => new Set([...prev, ann.flag_id]))
                              }
                              style={{
                                padding: '2px 8px',
                                fontSize: '10px',
                                cursor: 'pointer',
                                background: 'transparent',
                                border: '1px solid var(--border)',
                                borderRadius: '3px',
                                color: 'var(--text-secondary)',
                              }}
                            >
                              Dismiss
                            </button>
                          </div>
                          <div style={{ color: 'var(--text)', marginBottom: '4px' }}>
                            {ann.description}
                          </div>
                          {ann.suggestion && (
                            <div
                              style={{
                                color: 'var(--text-secondary)',
                                fontStyle: 'italic',
                                fontSize: '11px',
                              }}
                            >
                              Suggestion: {ann.suggestion}
                            </div>
                          )}
                          {ann.location.sentence_or_quote && (
                            <div
                              style={{
                                color: 'var(--text-secondary)',
                                fontSize: '10px',
                                marginTop: '4px',
                              }}
                            >
                              "{ann.location.sentence_or_quote}"
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Revision priorities */}
            {hasEditor && editorOutput.revision_priorities && editorOutput.revision_priorities.length > 0 && (
              <div style={{ marginTop: '32px', padding: '16px', background: 'var(--bg)', borderRadius: '4px' }}>
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    marginBottom: '12px',
                    color: 'var(--text)',
                  }}
                >
                  Revision Priorities
                </div>
                {editorOutput.revision_priorities.map((rp, i) => (
                  <div
                    key={i}
                    style={{
                      marginBottom: '8px',
                      display: 'flex',
                      gap: '8px',
                      fontSize: '12px',
                    }}
                  >
                    <span
                      style={{
                        width: '22px',
                        height: '22px',
                        borderRadius: '50%',
                        background: 'var(--accent)',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '10px',
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {rp.priority_order}
                    </span>
                    <div>
                      <strong>{rp.section}</strong>
                      {rp.key_issues.map((issue, ii) => (
                        <div key={ii} style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>
                          • {issue}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Generation metadata */}
            <div
              style={{
                fontSize: '10px',
                color: 'var(--text-secondary)',
                marginTop: '32px',
                borderTop: '1px solid var(--border)',
                paddingTop: '8px',
              }}
            >
              Writer v{writerOutput.version} | Generated: {writerOutput.generated_at}
              {hasEditor && <> | Editor v{editorOutput.version}</>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// TemplateReportPreview: shows template section structure as a report layout
// ---------------------------------------------------------------------------

function TemplateReportPreview({ profile }: { readonly profile: TemplateProfileData }): React.JSX.Element {
  // Filter out Header and Identifying Info sections (those are metadata, not body)
  const bodySections = profile.sections.filter(
    (s) => !['Header', 'Identifying Information', 'Signature'].includes(s.heading)
  )

  return (
    <div style={{ fontFamily: "'Times New Roman', 'Georgia', serif", fontSize: 12, lineHeight: 1.8, color: 'var(--text)' }}>
      {/* Report title */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
          {profile.name}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
          {profile.evalType} Template
        </div>
      </div>

      {/* Identifying info placeholder */}
      <div style={{ marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
          Patient Name: _______________{'    '}DOB: _______________{'    '}Case #: _______________
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
          Referring Party: _______________{'    '}Date of Report: _______________
        </div>
      </div>

      {/* Sections */}
      {bodySections.map((s, i) => (
        <div key={i} style={{ marginBottom: 20 }}>
          <div style={{
            fontSize: 13, fontWeight: 700, marginBottom: 6,
            textTransform: 'uppercase', letterSpacing: 0.5,
            borderBottom: '1px solid var(--border)', paddingBottom: 4,
          }}>
            {s.heading}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
            {s.exampleProse
              ? s.exampleProse.slice(0, 600) + (s.exampleProse.length > 600 ? '...' : '')
              : 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.'}
          </div>
          <div style={{ fontSize: 9, color: 'var(--text-secondary)', marginTop: 4, fontStyle: 'italic' }}>
            [{s.contentType} / {s.estimatedLength}]
          </div>
        </div>
      ))}

      {/* Signature block placeholder */}
      <div style={{ marginTop: 40, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          Respectfully submitted,
        </div>
        <div style={{ marginTop: 30, fontSize: 11, color: 'var(--text-secondary)' }}>
          _______________________________
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
          Examiner Name, Credentials
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// WordToolbar component
// ---------------------------------------------------------------------------

function WordToolbar({
  activeTab,
  setActiveTab,
}: {
  activeTab: string
  setActiveTab: (tab: string) => void
}): React.JSX.Element {
  return (
    <div
      style={{
        background: 'var(--panel)',
        borderBottom: '1px solid var(--border)',
        padding: '4px 8px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: 0,
          fontSize: 11,
          borderBottom: '1px solid var(--border)',
          paddingBottom: 4,
        }}
      >
        {['File', 'Home', 'Insert', 'Layout', 'References', 'Review', 'View'].map((tab) => (
          <div
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '4px 10px',
              cursor: 'pointer',
              color: activeTab === tab ? 'var(--accent)' : 'var(--text-secondary)',
              borderBottom: activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
              fontWeight: activeTab === tab ? 600 : 400,
            }}
          >
            {tab}
          </div>
        ))}
      </div>
      {activeTab === 'Home' && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', padding: '4px 0' }}>
          <select
            style={{
              padding: '2px 4px',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 3,
              fontSize: 11,
              color: 'var(--text)',
            }}
            defaultValue="Times New Roman"
          >
            <option>Times New Roman</option>
            <option>Arial</option>
            <option>Calibri</option>
          </select>
          <select
            style={{
              padding: '2px 4px',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 3,
              fontSize: 11,
              color: 'var(--text)',
            }}
            defaultValue="12"
          >
            <option>10</option>
            <option>11</option>
            <option>12</option>
            <option>14</option>
          </select>
          <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />
          {['B', 'I', 'U'].map((btn) => (
            <button
              key={btn}
              style={{
                padding: '3px 6px',
                background: 'none',
                border: '1px solid transparent',
                borderRadius: 3,
                cursor: 'pointer',
                fontSize: 12,
                color: 'var(--text)',
                fontWeight: btn === 'B' ? 700 : 400,
                fontStyle: btn === 'I' ? 'italic' : 'normal',
                textDecoration: btn === 'U' ? 'underline' : 'none',
              }}
            >
              {btn}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
