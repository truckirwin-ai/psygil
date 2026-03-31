import React, { useEffect, useState } from 'react'
import { CaseRow, PatientIntakeRow } from '../../../../shared/types/ipc'

/**
 * ClinicalOverviewTab — Sprint 7.1
 *
 * Displays the clinical overview for a case:
 * - Header with pipeline indicator, metadata
 * - Summary tabs with LIVE DATA from the Ingestor Agent (when available)
 * - Falls back to basic case/intake data when ingestor hasn't run yet
 *
 * DATA FLOW:
 *   window.psygil.ingestor.getResult({ caseId }) → IngestorOutput
 *   IngestorOutput fields → sub-tab panes (demographics, referral_questions,
 *     test_administrations, behavioral_observations, collateral_summary,
 *     timeline_events, completeness_flags)
 */

export interface Tab {
  id: string
  label: string
  contentFn?: string
  caseId?: string
}

interface ClinicalOverviewTabProps {
  caseId: number
  onOpenTab: (tab: Tab) => void
}

// ---------------------------------------------------------------------------
// Ingestor output shape (mirrors main/agents/ingestor.ts IngestorOutput)
// Kept as local interface to avoid importing from main process
// ---------------------------------------------------------------------------

interface IngestorOutput {
  case_id: string
  version: string
  generated_at: string
  demographics: Record<string, unknown>
  referral_questions: Record<string, unknown>[]
  test_administrations: Record<string, unknown>[]
  behavioral_observations_from_transcripts: Record<string, unknown>
  timeline_events: Record<string, unknown>[]
  collateral_summary: Record<string, unknown>[]
  completeness_flags: Record<string, unknown>
}

// Stage colors (from design system)
const STAGE_COLORS: Record<string, string> = {
  Onboarding: '#2196f3',
  Testing: '#9c27b0',
  Interview: '#e91e63',
  Diagnostics: '#ff9800',
  Review: '#ff5722',
  Complete: '#4caf50',
}

// Stage indices for determining progression
const STAGE_IDX: Record<string, number> = {
  onboarding: 0,
  testing: 1,
  interview: 2,
  diagnostics: 3,
  review: 4,
  complete: 5,
}

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------

const fieldLabelStyle: React.CSSProperties = {
  fontSize: '11px',
  color: 'var(--text-secondary)',
  marginBottom: '2px',
}

const fieldValueStyle: React.CSSProperties = {
  fontSize: '13px',
  color: 'var(--text)',
}

const fieldBoxStyle: React.CSSProperties = {
  marginBottom: '8px',
}

const sectionHeaderStyle: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: 600,
  color: 'var(--text)',
  marginBottom: '8px',
  marginTop: '12px',
  borderBottom: '1px solid var(--border)',
  paddingBottom: '4px',
}

const cardStyle: React.CSSProperties = {
  background: 'var(--panel)',
  border: '1px solid var(--border)',
  borderRadius: '4px',
  padding: '10px',
  marginBottom: '8px',
}

const badgeStyle = (color: string): React.CSSProperties => ({
  display: 'inline-block',
  padding: '1px 6px',
  borderRadius: '3px',
  fontSize: '10px',
  fontWeight: 600,
  color: '#fff',
  background: color,
  marginLeft: '6px',
})

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ClinicalOverviewTab: React.FC<ClinicalOverviewTabProps> = ({
  caseId,
  onOpenTab,
}) => {
  const [caseData, setCaseData] = useState<CaseRow | null>(null)
  const [intakeData, setIntakeData] = useState<PatientIntakeRow | null>(null)
  const [ingestorData, setIngestorData] = useState<IngestorOutput | null>(null)
  const [activeTab, setActiveTab] = useState<string>('intake')
  const [loading, setLoading] = useState(true)

  // Load case, intake, and ingestor data
  useEffect(() => {
    let cancelled = false
    const loadData = async () => {
      try {
        const [caseRes, intakeRes, ingestorRes] = await Promise.all([
          window.psygil.cases.get({ case_id: caseId }),
          window.psygil.intake.get({ case_id: caseId }),
          window.psygil.ingestor.getResult({ caseId }),
        ])

        if (cancelled) return

        if (caseRes.status === 'success') setCaseData(caseRes.data)
        if (intakeRes.status === 'success') setIntakeData(intakeRes.data)
        if (ingestorRes.status === 'success' && ingestorRes.data) {
          setIngestorData(ingestorRes.data as IngestorOutput)
        }
      } catch (err) {
        console.error('[ClinicalOverview] Failed to load data:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadData()
    return () => { cancelled = true }
  }, [caseId])

  if (loading || !caseData) {
    return (
      <div style={{ padding: '16px', fontSize: '13px', color: 'var(--text-secondary)' }}>
        Loading clinical overview...
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  const renderPill = (label: string, color: string) => (
    <span
      style={{
        background: color,
        color: '#fff',
        padding: '2px 8px',
        borderRadius: '3px',
        fontSize: '11px',
        whiteSpace: 'nowrap',
        display: 'inline-block',
      }}
    >
      {label}
    </span>
  )

  const renderPipeline = () => {
    const stages = ['Onboarding', 'Testing', 'Interview', 'Diagnostics', 'Review', 'Complete']
    const currentStageIdx = caseData.workflow_current_stage
      ? STAGE_IDX[caseData.workflow_current_stage.toLowerCase()] ?? 0
      : 0

    return (
      <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {stages.map((stage, i) => {
          const color = STAGE_COLORS[stage]
          if (i < currentStageIdx) {
            return (
              <span key={stage} style={{ opacity: 0.5, fontSize: '11px', padding: '2px 8px', borderRadius: '3px', background: color, color: '#fff' }}>
                ✓ {stage}
              </span>
            )
          } else if (i === currentStageIdx) {
            return (
              <span key={stage} style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '3px', background: color, color: '#fff', fontWeight: 600 }}>
                ● {stage}
              </span>
            )
          } else {
            return (
              <span key={stage} style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '3px', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                ○ {stage}
              </span>
            )
          }
        })}
      </div>
    )
  }

  const renderEditButton = (fnName: string) => (
    <button
      style={{
        float: 'right',
        fontSize: '11px',
        padding: '3px 10px',
        borderRadius: '3px',
        border: '1px solid var(--border)',
        background: 'var(--panel)',
        color: 'var(--text-secondary)',
        cursor: 'pointer',
      }}
      onClick={() => {
        const labels: Record<string, string> = {
          makeCaseIntake: 'Intake Form',
          makeCaseReferral: 'Referral Docs',
          makeCaseCollateral: 'Collateral Records',
          makeCaseTests: 'Test Battery',
          makeCaseInterviews: 'Interview Notes',
          makeCaseDiagnostics: 'Diagnostics',
          makeCaseReport: `${caseData.evaluation_type || 'Evaluation'} Report`,
        }
        onOpenTab({
          id: `case${caseId}-${fnName}`,
          label: labels[fnName] || fnName,
          contentFn: fnName,
          caseId: String(caseId),
        })
      }}
    >
      Edit
    </button>
  )

  // Helper: render a field row
  const Field = ({ label, value }: { label: string; value: string | null | undefined }) => (
    <div style={fieldBoxStyle}>
      <div style={fieldLabelStyle}>{label}</div>
      <div style={fieldValueStyle}>{value || '—'}</div>
    </div>
  )

  // Helper: completeness badge
  const CompletenessFlag = ({ status }: { status: string }) => {
    const colorMap: Record<string, string> = {
      complete: '#4caf50',
      partial: '#ff9800',
      missing: '#f44336',
    }
    return (
      <span style={badgeStyle(colorMap[status] || '#999')}>
        {status}
      </span>
    )
  }

  // -------------------------------------------------------------------------
  // Sub-tab panes
  // -------------------------------------------------------------------------

  const hasIngestor = !!ingestorData

  // --- Intake / Demographics Pane ---
  const IntakePane = () => {
    const demo = ingestorData?.demographics
    return (
      <div>
        {renderEditButton('makeCaseIntake')}

        {/* If ingestor has demographics, show enriched view */}
        {hasIngestor && demo ? (
          <>
            <div style={sectionHeaderStyle}>
              Demographics (Ingestor Extracted)
              {ingestorData?.completeness_flags &&
                <CompletenessFlag status={String((ingestorData.completeness_flags as Record<string, unknown>).demographics || 'unknown')} />
              }
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
              <Field label="Name" value={`${demo.first_name || caseData.examinee_first_name} ${demo.last_name || caseData.examinee_last_name}`} />
              <Field label="DOB" value={String(demo.dob || caseData.examinee_dob || '—')} />
              <Field label="Age" value={demo.age ? String(demo.age) : '—'} />
              <Field label="Sex / Gender" value={String(demo.gender || demo.sex || caseData.examinee_gender || '—')} />
              <Field label="Race / Ethnicity" value={String(demo.race_ethnicity || demo.race || '—')} />
              <Field label="Handedness" value={String(demo.handedness || '—')} />
              <Field label="Education" value={String(demo.education_level || demo.education || '—')} />
              <Field label="Occupation" value={String(demo.occupation || '—')} />
              <Field label="Referral Source" value={String(demo.referral_source || caseData.referral_source || '—')} />
              <Field label="Evaluation Dates" value={String(demo.evaluation_dates || '—')} />
            </div>
          </>
        ) : (
          <>
            <div style={sectionHeaderStyle}>Basic Info (from case record)</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
              <Field label="Name" value={`${caseData.examinee_first_name} ${caseData.examinee_last_name}`} />
              <Field label="Gender" value={caseData.examinee_gender} />
              <Field label="Case Number" value={`#${caseData.case_number}`} />
              <Field label="Eval Type" value={caseData.evaluation_type} />
              <Field label="Referred" value={caseData.created_at?.split('T')[0]} />
              <Field label="Referral Source" value={caseData.referral_source} />
            </div>
            {!hasIngestor && (
              <div style={{ marginTop: '12px', padding: '8px', background: 'var(--bg)', borderRadius: '4px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                Run the Ingestor Agent to extract detailed demographics from uploaded documents.
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  // --- Referral Questions Pane ---
  const ReferralPane = () => {
    const questions = ingestorData?.referral_questions
    return (
      <div>
        {renderEditButton('makeCaseReferral')}

        {hasIngestor && questions && questions.length > 0 ? (
          <>
            <div style={sectionHeaderStyle}>
              Referral Questions ({questions.length})
              {ingestorData?.completeness_flags &&
                <CompletenessFlag status={String((ingestorData.completeness_flags as Record<string, unknown>).referral_questions || 'unknown')} />
              }
            </div>
            {questions.map((q, i) => (
              <div key={i} style={cardStyle}>
                <div style={{ fontSize: '13px', color: 'var(--text)', marginBottom: '4px' }}>
                  {i + 1}. {String(q.question || q.text || JSON.stringify(q))}
                </div>
                {q.source_document && (
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                    Source: {String(q.source_document)}{q.page_number ? `, p. ${q.page_number}` : ''}
                  </div>
                )}
                {q.inferred && (
                  <span style={badgeStyle('#ff9800')}>inferred</span>
                )}
              </div>
            ))}
          </>
        ) : (
          <>
            <div style={sectionHeaderStyle}>Referral Information</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
              <Field label="Source Type" value={caseData.referral_source} />
              <Field label="Referring Party" value={intakeData?.attorney_name} />
              <Field label="Presenting Complaint" value={intakeData?.presenting_complaint} />
              <Field label="Jurisdiction" value={intakeData?.jurisdiction} />
            </div>
            {caseData.evaluation_questions && (
              <div style={{ marginTop: '8px' }}>
                <div style={fieldLabelStyle}>Evaluation Questions</div>
                <div style={{ ...fieldValueStyle, whiteSpace: 'pre-wrap' }}>{caseData.evaluation_questions}</div>
              </div>
            )}
            {!hasIngestor && (
              <div style={{ marginTop: '12px', padding: '8px', background: 'var(--bg)', borderRadius: '4px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                Run the Ingestor Agent to extract referral questions from uploaded documents.
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  // --- Testing Pane ---
  const TestingPane = () => {
    const tests = ingestorData?.test_administrations
    return (
      <div>
        {renderEditButton('makeCaseTests')}

        {hasIngestor && tests && tests.length > 0 ? (
          <>
            <div style={sectionHeaderStyle}>
              Test Administrations ({tests.length})
              {ingestorData?.completeness_flags &&
                <CompletenessFlag status={String((ingestorData.completeness_flags as Record<string, unknown>).test_administrations || 'unknown')} />
              }
            </div>
            {tests.map((t, i) => (
              <div key={i} style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <strong style={{ fontSize: '13px', color: 'var(--text)' }}>
                    {String(t.test_name || t.name || `Test ${i + 1}`)}
                  </strong>
                  {t.administration_date && (
                    <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                      {String(t.administration_date)}
                    </span>
                  )}
                </div>

                {/* Validity indicators */}
                {t.validity_indicators && (
                  <div style={{ marginBottom: '4px' }}>
                    <span style={fieldLabelStyle}>Validity: </span>
                    <span style={{ fontSize: '12px', color: 'var(--text)' }}>
                      {typeof t.validity_indicators === 'object'
                        ? Object.entries(t.validity_indicators as Record<string, unknown>)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(', ')
                        : String(t.validity_indicators)
                      }
                    </span>
                  </div>
                )}

                {/* Scores summary */}
                {(t.scaled_scores || t.t_scores || t.raw_scores || t.percentiles) && (
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    {t.scaled_scores && <div>Scaled: {JSON.stringify(t.scaled_scores)}</div>}
                    {t.t_scores && <div>T-scores: {JSON.stringify(t.t_scores)}</div>}
                    {t.percentiles && <div>Percentiles: {JSON.stringify(t.percentiles)}</div>}
                  </div>
                )}

                {/* Diagnostic classifications from publisher */}
                {t.diagnostic_classifications && (
                  <div style={{ marginTop: '4px', fontSize: '11px' }}>
                    <span style={fieldLabelStyle}>Classifications: </span>
                    <span style={{ color: 'var(--text)' }}>{String(t.diagnostic_classifications)}</span>
                  </div>
                )}

                {/* Source document */}
                {t.source_document && (
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Source: {String(t.source_document)}
                  </div>
                )}

                {/* Missing subtests flag */}
                {t.missing_subtests && (
                  <div style={{ marginTop: '4px' }}>
                    <span style={badgeStyle('#ff9800')}>incomplete</span>
                    <span style={{ fontSize: '10px', color: 'var(--text-secondary)', marginLeft: '4px' }}>
                      {String(t.missing_subtests)}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </>
        ) : (
          <>
            <div style={sectionHeaderStyle}>Testing</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              {currentStageIdx >= 1
                ? 'Testing in progress. Run the Ingestor Agent to extract test data from uploaded score reports.'
                : 'Testing data will appear here once the case reaches the Testing stage.'}
            </div>
          </>
        )}
      </div>
    )
  }

  // --- Behavioral Observations / Interviews Pane ---
  const InterviewsPane = () => {
    const obs = ingestorData?.behavioral_observations_from_transcripts
    return (
      <div>
        {renderEditButton('makeCaseInterviews')}

        {hasIngestor && obs && Object.keys(obs).length > 0 ? (
          <>
            <div style={sectionHeaderStyle}>
              Behavioral Observations (Transcript-Derived)
              {ingestorData?.completeness_flags &&
                <CompletenessFlag status={String((ingestorData.completeness_flags as Record<string, unknown>).behavioral_observations || 'unknown')} />
              }
            </div>

            {/* Render each observation category */}
            {Object.entries(obs).map(([key, value]) => (
              <div key={key} style={cardStyle}>
                <div style={{ ...fieldLabelStyle, textTransform: 'capitalize', marginBottom: '4px' }}>
                  {key.replace(/_/g, ' ')}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text)', whiteSpace: 'pre-wrap' }}>
                  {typeof value === 'string'
                    ? value
                    : Array.isArray(value)
                      ? (value as unknown[]).map((item, i) => (
                          <div key={i} style={{ marginBottom: '4px' }}>
                            {typeof item === 'object' && item !== null
                              ? JSON.stringify(item, null, 2)
                              : String(item)}
                          </div>
                        ))
                      : typeof value === 'object' && value !== null
                        ? Object.entries(value as Record<string, unknown>).map(([k, v]) => (
                            <div key={k} style={{ marginBottom: '2px' }}>
                              <span style={{ color: 'var(--text-secondary)' }}>{k}: </span>
                              {String(v)}
                            </div>
                          ))
                        : String(value)
                  }
                </div>
              </div>
            ))}

            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: '8px' }}>
              These observations were extracted from audio/video transcripts. They are NOT direct clinician observations. Review and revise before inclusion in the report.
            </div>
          </>
        ) : (
          <>
            <div style={sectionHeaderStyle}>Interviews</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              {currentStageIdx >= 2
                ? 'Interview data available. Run the Ingestor Agent to extract behavioral observations from transcripts.'
                : 'Interview data will appear here once the case reaches the Interview stage.'}
            </div>
          </>
        )}
      </div>
    )
  }

  // --- Collateral Summary Pane ---
  const CollateralPane = () => {
    const collateral = ingestorData?.collateral_summary
    return (
      <div>
        {renderEditButton('makeCaseCollateral')}

        {hasIngestor && collateral && collateral.length > 0 ? (
          <>
            <div style={sectionHeaderStyle}>
              Collateral Records ({collateral.length})
              {ingestorData?.completeness_flags &&
                <CompletenessFlag status={String((ingestorData.completeness_flags as Record<string, unknown>).collateral || 'unknown')} />
              }
            </div>
            {collateral.map((c, i) => (
              <div key={i} style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <strong style={{ fontSize: '12px', color: 'var(--text)' }}>
                    {String(c.source || c.source_type || `Record ${i + 1}`)}
                  </strong>
                  {c.date && (
                    <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                      {String(c.date)}
                    </span>
                  )}
                </div>
                {c.key_facts && (
                  <div style={{ fontSize: '12px', color: 'var(--text)', marginTop: '4px' }}>
                    {Array.isArray(c.key_facts)
                      ? (c.key_facts as unknown[]).map((fact, fi) => (
                          <div key={fi} style={{ marginBottom: '2px' }}>• {String(fact)}</div>
                        ))
                      : String(c.key_facts)
                    }
                  </div>
                )}
                {c.conflicting_information && (
                  <div style={{ marginTop: '6px', padding: '4px 8px', background: '#fff3e0', borderRadius: '3px', fontSize: '11px', color: '#e65100' }}>
                    Conflict: {String(c.conflicting_information)}
                  </div>
                )}
              </div>
            ))}
          </>
        ) : (
          <>
            <div style={sectionHeaderStyle}>Collateral Records</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              {hasIngestor
                ? 'No collateral records found in ingested documents.'
                : 'Run the Ingestor Agent to extract summaries from collateral records.'}
            </div>
          </>
        )}
      </div>
    )
  }

  // --- Timeline Pane ---
  const TimelinePane = () => {
    const events = ingestorData?.timeline_events
    return (
      <div>
        {hasIngestor && events && events.length > 0 ? (
          <>
            <div style={sectionHeaderStyle}>
              Timeline ({events.length} events)
            </div>
            <div style={{ borderLeft: '2px solid var(--border)', paddingLeft: '16px', marginLeft: '8px' }}>
              {events.map((e, i) => (
                <div key={i} style={{ marginBottom: '12px', position: 'relative' }}>
                  <div style={{
                    position: 'absolute', left: '-22px', top: '3px',
                    width: '10px', height: '10px', borderRadius: '50%',
                    background: 'var(--accent)', border: '2px solid var(--panel)',
                  }} />
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '2px' }}>
                    {String(e.date || e.timestamp || '—')}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text)' }}>
                    {String(e.event || e.description || JSON.stringify(e))}
                  </div>
                  {e.source_document && (
                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                      Source: {String(e.source_document)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div style={sectionHeaderStyle}>Timeline</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              {hasIngestor
                ? 'No timeline events extracted.'
                : 'Run the Ingestor Agent to extract a chronological timeline from case documents.'}
            </div>
          </>
        )}
      </div>
    )
  }

  // --- Completeness Pane ---
  const CompletenessPane = () => {
    const flags = ingestorData?.completeness_flags
    return (
      <div>
        {hasIngestor && flags ? (
          <>
            <div style={sectionHeaderStyle}>Data Completeness</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              {Object.entries(flags)
                .filter(([k]) => k !== 'summary_gaps')
                .map(([category, status]) => (
                  <div key={category} style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text)', textTransform: 'capitalize' }}>
                      {category.replace(/_/g, ' ')}
                    </span>
                    <CompletenessFlag status={String(status)} />
                  </div>
                ))
              }
            </div>
            {(flags as Record<string, unknown>).summary_gaps && (
              <div style={{ marginTop: '12px' }}>
                <div style={sectionHeaderStyle}>Gaps to Address</div>
                {Array.isArray((flags as Record<string, unknown>).summary_gaps)
                  ? ((flags as Record<string, unknown>).summary_gaps as string[]).map((gap, i) => (
                      <div key={i} style={{ fontSize: '12px', color: '#f44336', marginBottom: '4px' }}>
                        {i + 1}. {gap}
                      </div>
                    ))
                  : <div style={{ fontSize: '12px', color: 'var(--text)' }}>
                      {String((flags as Record<string, unknown>).summary_gaps)}
                    </div>
                }
              </div>
            )}
          </>
        ) : (
          <>
            <div style={sectionHeaderStyle}>Completeness</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Run the Ingestor Agent to generate a completeness assessment.
            </div>
          </>
        )}
      </div>
    )
  }

  // --- Diagnostics summary (from ingestor — NOT the diagnostician agent) ---
  const DiagnosticsPane = () => (
    <div>
      {renderEditButton('makeCaseDiagnostics')}
      <div style={sectionHeaderStyle}>Diagnostics</div>
      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
        Diagnostic analysis will be populated by the Diagnostician Agent. Open the Diagnostics tab for the full evidence map and decision interface.
      </div>
    </div>
  )

  // --- Report summary ---
  const ReportPane = () => (
    <div>
      {renderEditButton('makeCaseReport')}
      <div style={sectionHeaderStyle}>Evaluation Report</div>
      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
        The report will be drafted by the Writer Agent and reviewed by the Editor Agent. Open the Eval Report tab to view the full draft.
      </div>
    </div>
  )

  // --- Archive ---
  const ArchivePane = () => (
    <div>
      <div style={sectionHeaderStyle}>Archive</div>
      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
        Completed and filed materials, correspondence log, and billing records for this case.
      </div>
      {caseData.workflow_current_stage?.toLowerCase() === 'complete' ? (
        <div style={cardStyle}>
          <div style={{ fontSize: '12px', color: '#4caf50', fontWeight: 600, marginBottom: '6px' }}>
            ✓ Case Complete
          </div>
          <Field label="Completed" value={caseData.last_modified?.split('T')[0] || '—'} />
          <Field label="Evaluation Type" value={caseData.evaluation_type} />
          <Field label="Case Number" value={caseData.case_number} />
        </div>
      ) : (
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
          Case is still active. Materials will be archived once the evaluation reaches the Complete stage.
        </div>
      )}
    </div>
  )

  // -------------------------------------------------------------------------
  // Build tab definitions — all tabs always available, content adapts
  // -------------------------------------------------------------------------

  interface SubTab {
    id: string
    label: string
    component: React.FC
  }

  // Full clinical workflow — all tabs always visible.
  // This is the actual sequence a forensic psychologist works through.
  const visibleTabs: SubTab[] = [
    { id: 'intake', label: 'Intake', component: IntakePane },
    { id: 'referral', label: 'Referral', component: ReferralPane },
    { id: 'collateral', label: 'Collateral', component: CollateralPane },
    { id: 'testing', label: 'Testing', component: TestingPane },
    { id: 'interviews', label: 'Interviews', component: InterviewsPane },
    { id: 'diagnostics', label: 'Diagnostics', component: DiagnosticsPane },
    { id: 'report', label: 'Reports', component: ReportPane },
    { id: 'archive', label: 'Archive', component: ArchivePane },
  ]

  // Ensure activeTab is valid
  const resolvedActiveTab = visibleTabs.find((t) => t.id === activeTab) ? activeTab : visibleTabs[0]?.id || 'intake'
  const ActiveComponent = visibleTabs.find((t) => t.id === resolvedActiveTab)?.component || IntakePane

  const displayName = `${caseData.examinee_last_name}, ${caseData.examinee_first_name}`

  return (
    <div style={{ padding: '16px', fontSize: '13px', height: '100%', overflow: 'auto' }}>
      {/* Header Section */}
      <h1 style={{ fontSize: '16px', marginBottom: '8px', color: 'var(--text)' }}>
        Clinical Overview — {displayName}
      </h1>

      {/* Pipeline Indicator */}
      {renderPipeline()}

      {/* Metadata Row */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
        <span>Case <strong style={{ color: 'var(--text)' }}>#{caseData.case_number}</strong></span>
        <span>Type <strong style={{ color: 'var(--text)' }}>{caseData.evaluation_type || 'Unknown'}</strong></span>
        <span>
          Status{' '}
          {renderPill(
            caseData.case_status || 'Unknown',
            STAGE_COLORS[
              (caseData.workflow_current_stage || 'onboarding').charAt(0).toUpperCase() +
              (caseData.workflow_current_stage || 'onboarding').slice(1)
            ] || '#999'
          )}
        </span>
        {hasIngestor && (
          <span style={{ color: '#4caf50', fontWeight: 500 }}>
            ✓ Ingestor data available (v{ingestorData?.version})
          </span>
        )}
      </div>

      {/* Ingestor generation timestamp */}
      {hasIngestor && ingestorData?.generated_at && (
        <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
          Ingestor ran: {ingestorData.generated_at}
        </div>
      )}

      {/* Sub-Tab Bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '0', gap: '0' }}>
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '7px 14px',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              color: resolvedActiveTab === tab.id ? 'var(--accent)' : 'var(--text-secondary)',
              borderBottom: resolvedActiveTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
              background: 'none',
              border: 'none',
              borderBottomWidth: '2px',
              borderBottomStyle: 'solid',
              borderBottomColor: resolvedActiveTab === tab.id ? 'var(--accent)' : 'transparent',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Active Pane */}
      <div style={{ paddingTop: '12px' }}>
        <ActiveComponent />
      </div>
    </div>
  )
}

export default ClinicalOverviewTab
