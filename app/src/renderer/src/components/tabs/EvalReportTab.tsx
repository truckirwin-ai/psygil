import React, { useEffect, useState } from 'react'
import OnlyOfficeEditor from '../editors/OnlyOfficeEditor'

/**
 * EvalReportTab — Sprint 10
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

  if (!hasWriter) {
    return <FallbackReport caseId={caseId} toolbarTab={toolbarTab} setToolbarTab={setToolbarTab} />
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
              console.log('[EvalReportTab] Document ready')
            }}
            onDocumentSaved={() => {
              console.log('[EvalReportTab] Document saved')
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
// ReportPreview — extracted HTML preview component
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
                        AI DRAFT — CLINICIAN REVIEW REQUIRED
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
                      Confidence: {Math.round(section.confidence * 100)}% — review carefully
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
// Fallback: Static mock report (preserved from original Sprint 5 code)
// ---------------------------------------------------------------------------

function FallbackReport({
  caseId,
  toolbarTab,
  setToolbarTab,
}: {
  caseId: number
  toolbarTab: string
  setToolbarTab: (tab: string) => void
}): React.JSX.Element {
  return (
    <div style={{ background: 'var(--panel)', minHeight: '100%', paddingBottom: 40, overflowY: 'auto' }}>
      {/* Ruler */}
      <div
        style={{
          maxWidth: 860,
          margin: '0 auto',
          height: 20,
          background: 'var(--panel)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'flex-end',
          padding: '0 22px',
          fontSize: 9,
          color: 'var(--text-secondary)',
          fontFamily: "'JetBrains Mono', monospace",
        }}
      >
        {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
          <span key={n} style={{ flex: 1, textAlign: 'center' }}>
            {n}
          </span>
        ))}
      </div>

      <WordToolbar activeTab={toolbarTab} setActiveTab={setToolbarTab} />

      <div className="document-editor" style={{ maxWidth: 860, margin: '0 auto', padding: '24px 60px' }}>
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: '14px', marginBottom: '8px', color: 'var(--text)' }}>
            No Writer Agent output available.
          </div>
          <div style={{ fontSize: '12px' }}>
            Run the Writer Agent from the agent panel to generate a draft evaluation report.
            The Ingestor and Diagnostician agents must be run first, and diagnostic decisions must be saved.
          </div>
          <div style={{ fontSize: '11px', marginTop: '12px', color: 'var(--text-secondary)' }}>
            Case ID: {caseId}
          </div>
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
