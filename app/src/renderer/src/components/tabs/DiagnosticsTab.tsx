import React, { useCallback, useEffect, useRef, useState } from 'react'

/**
 * DiagnosticsTab (Gate 2), Sprint 7.2
 *
 * ██ CRITICAL PRINCIPLE: DOCTOR ALWAYS DIAGNOSES, NEVER THE AI ██
 *
 * Loads DiagnosticianOutput from agent_results and displays:
 * - Validity assessment (always shown first)
 * - Diagnostic evidence map (each diagnosis as an expandable card)
 * - Differential comparisons
 * - Psycho-legal analysis (forensic) or functional impairment (clinical)
 * - Individual accept/reject/defer per diagnosis, NO "ACCEPT ALL"
 * - Clinical formulation text area
 *
 * DATA FLOW:
 *   window.psygil.diagnostician.getResult({ caseId }) → DiagnosticianOutput
 */

export interface DiagnosticsTabProps {
  caseId: number
}

// ---------------------------------------------------------------------------
// DiagnosticianOutput shape (mirrors main/agents/diagnostician.ts)
// ---------------------------------------------------------------------------

interface DiagnosticianOutput {
  case_id: string
  version: string
  generated_at: string
  validity_assessment: Record<string, unknown>
  diagnostic_evidence_map: Record<string, unknown>
  differential_comparisons?: Record<string, unknown>[]
  psycholegal_analysis?: Record<string, unknown>
  functional_impairment_summary?: Record<string, unknown>
}

// Local state for clinician decisions
interface DiagnosticDecision {
  diagnosisKey: string
  code: string
  name: string
  decision: 'render' | 'rule_out' | 'defer' | null
  clinicianNotes: string
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const sectionHeader: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: 600,
  marginBottom: '12px',
  paddingBottom: '6px',
  borderBottom: '1px solid var(--border)',
  color: 'var(--text)',
}

const cardStyle: React.CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: '4px',
  marginBottom: '16px',
  overflow: 'hidden',
}

const cardHeaderStyle: React.CSSProperties = {
  background: 'var(--highlight)',
  padding: '12px',
  borderBottom: '1px solid var(--border)',
}

const cardBodyStyle: React.CSSProperties = {
  padding: '12px',
}

const labelStyle: React.CSSProperties = {
  fontSize: '11px',
  color: 'var(--text-secondary)',
  marginBottom: '2px',
}

const btnBase: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: '4px',
  fontSize: '12px',
  fontWeight: 500,
  cursor: 'pointer',
  border: '1px solid var(--border)',
  background: 'var(--panel)',
  color: 'var(--text)',
}

// ---------------------------------------------------------------------------
// DSM-5-TR Reference Panel
// ---------------------------------------------------------------------------

interface CatalogRow {
  readonly diagnosis_id: number
  readonly code: string
  readonly dsm5tr_code: string
  readonly name: string
  readonly description: string
  readonly category: string
}

interface Dsm5TrReferencePanelProps {
  /** Called when the user clicks a result, inserts "[CODE] Name" at cursor */
  readonly onInsert?: (text: string) => void
}

const Dsm5TrReferencePanel: React.FC<Dsm5TrReferencePanelProps> = ({ onInsert }) => {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CatalogRow[]>([])
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([])
      return
    }
    setSearching(true)
    try {
      const res = await window.psygil.diagnosisCatalog.search({ query: q, limit: 25 })
      if (res.status === 'success') {
        setResults([...res.data] as CatalogRow[])
      } else {
        setResults([])
      }
    } catch {
      setResults([])
    } finally {
      setSearching(false)
    }
  }, [])

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value
    setQuery(q)
    if (debounceRef.current !== null) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { void search(q) }, 300)
  }

  const handleResultClick = (row: CatalogRow) => {
    const text = `${row.code} ${row.name}`
    if (onInsert) {
      onInsert(text)
    } else {
      void navigator.clipboard.writeText(text)
    }
  }

  return (
    <div style={{ marginBottom: '16px', border: '1px solid var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
      {/* Toggle header */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        style={{
          width: '100%',
          padding: '8px 12px',
          background: 'var(--highlight)',
          border: 'none',
          borderBottom: open ? '1px solid var(--border)' : 'none',
          textAlign: 'left',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          color: 'var(--text)',
          fontSize: '12px',
          fontWeight: 600,
        }}
      >
        <span>DSM-5-TR Reference</span>
        <span style={{ color: 'var(--text-secondary)' }}>{open ? '▾' : '▸'}</span>
      </button>

      {/* Collapsible body */}
      {open && (
        <div style={{ padding: '8px 12px 10px' }}>
          <input
            type="text"
            value={query}
            onChange={handleQueryChange}
            placeholder="Search by code, name, or DSM specifier..."
            style={{
              width: '100%',
              padding: '6px 8px',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              background: 'var(--bg)',
              color: 'var(--text)',
              fontFamily: 'inherit',
              fontSize: '12px',
              marginBottom: '6px',
            }}
          />
          {searching && (
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', padding: '4px 0' }}>
              Searching...
            </div>
          )}
          {!searching && results.length === 0 && query.trim().length > 0 && (
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', padding: '4px 0' }}>
              No results for &ldquo;{query}&rdquo;
            </div>
          )}
          {results.length > 0 && (
            <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
              {results.map((row) => (
                <button
                  key={row.diagnosis_id}
                  onClick={() => handleResultClick(row)}
                  title={row.description || row.name}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '5px 6px',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                    fontSize: '11px',
                    color: 'var(--text)',
                    lineHeight: '1.4',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--highlight)' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
                >
                  <span style={{ fontFamily: 'monospace', color: 'var(--accent)', marginRight: '6px' }}>{row.code}</span>
                  <span style={{ fontWeight: 500 }}>{row.name}</span>
                  <span style={{ color: 'var(--text-secondary)', marginLeft: '6px' }}>, {row.category}</span>
                </button>
              ))}
            </div>
          )}
          {results.length === 0 && !query.trim() && (
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', padding: '4px 0' }}>
              Type a code (F32, F43) or name to search the DSM-5-TR catalog. Click a result to insert.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const DiagnosticsTab: React.FC<DiagnosticsTabProps> = ({ caseId }) => {
  const [diagOutput, setDiagOutput] = useState<DiagnosticianOutput | null>(null)
  const [decisions, setDecisions] = useState<DiagnosticDecision[]>([])
  const [formulation, setFormulation] = useState('')
  const [formulationSaved, setFormulationSaved] = useState(false)
  const [expandedDiags, setExpandedDiags] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const formulationRef = useRef<HTMLTextAreaElement | null>(null)

  // Insert DSM-5-TR catalog text at cursor position in formulation textarea
  const handleInsertFromCatalog = useCallback((text: string) => {
    const ta = formulationRef.current
    if (!ta) {
      void navigator.clipboard.writeText(text)
      return
    }
    const start = ta.selectionStart ?? formulation.length
    const end = ta.selectionEnd ?? formulation.length
    const before = formulation.slice(0, start)
    const after = formulation.slice(end)
    const separator = before.length > 0 && !before.endsWith(' ') && !before.endsWith('\n') ? ' ' : ''
    const inserted = `${before}${separator}${text}${after}`
    setFormulation(inserted)
    setFormulationSaved(false)
    // Restore focus and cursor after state update
    requestAnimationFrame(() => {
      ta.focus()
      const newPos = start + separator.length + text.length
      ta.setSelectionRange(newPos, newPos)
    })
  }, [formulation])

  // Load diagnostician output AND any existing decisions
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const [diagRes, decisionsRes, formulationRes] = await Promise.all([
          window.psygil.diagnostician.getResult({ caseId }),
          window.psygil.diagnosticDecisions.list({ case_id: caseId }),
          window.psygil.clinicalFormulation.get({ case_id: caseId }),
        ])
        if (cancelled) return

        // Restore saved formulation text
        if (formulationRes.status === 'success' && formulationRes.data) {
          setFormulation(formulationRes.data.formulation_text)
        }

        // Build saved decisions lookup
        const savedMap = new Map<string, { decision: 'render' | 'rule_out' | 'defer'; notes: string }>()
        if (decisionsRes.status === 'success' && decisionsRes.data) {
          for (const row of decisionsRes.data) {
            savedMap.set(row.diagnosis_key, { decision: row.decision, notes: row.clinician_notes })
          }
        }

        if (diagRes.status === 'success' && diagRes.data) {
          const output = diagRes.data as DiagnosticianOutput
          setDiagOutput(output)

          // Build decisions from evidence map, merging with any saved decisions
          const diagMap = output.diagnostic_evidence_map || {}
          const initialDecisions: DiagnosticDecision[] = Object.entries(diagMap).map(([key, value]) => {
            const diag = value as Record<string, unknown>
            const saved = savedMap.get(key)
            return {
              diagnosisKey: key,
              code: String(diag.icd_code || ''),
              name: key.replace(/_/g, ' '),
              decision: saved?.decision || null,
              clinicianNotes: saved?.notes || '',
            }
          })
          setDecisions(initialDecisions)
          // Expand first diagnosis by default
          if (initialDecisions.length > 0) {
            setExpandedDiags(new Set([initialDecisions[0].diagnosisKey]))
          }
        }
      } catch (err) {
        console.error('[DiagnosticsTab] Failed to load diagnostician result:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [caseId])

  // Decision handlers
  const setDecision = (key: string, decision: 'render' | 'rule_out' | 'defer' | null) => {
    setDecisions((prev) =>
      prev.map((d) => (d.diagnosisKey === key ? { ...d, decision } : d))
    )
  }

  const setNotes = (key: string, notes: string) => {
    setDecisions((prev) =>
      prev.map((d) => (d.diagnosisKey === key ? { ...d, clinicianNotes: notes } : d))
    )
  }

  const toggleExpand = (key: string) => {
    setExpandedDiags((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // -------------------------------------------------------------------------
  // Render: No diagnostician output yet
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <div style={{ padding: '20px 24px', fontSize: '13px', color: 'var(--text-secondary)' }}>
        Loading diagnostics...
      </div>
    )
  }

  if (!diagOutput) {
    return (
      <div style={{ padding: '20px 24px' }}>
        <h1 style={{ fontSize: '16px', marginBottom: '16px' }}>Diagnostics, Clinical Formulation</h1>

        {/* RED WARNING BANNER */}
        <div style={{ background: '#f44336', color: 'white', padding: '16px', borderRadius: '4px', marginBottom: '20px', border: '4px solid #d32f2f' }}>
          <p style={{ fontWeight: 600, fontSize: '14px', margin: '0 0 8px 0' }}>
            ⚠ DOCTOR ALWAYS DIAGNOSES, Never the AI
          </p>
          <p style={{ fontSize: '13px', margin: '0', lineHeight: '1.5' }}>
            All diagnostic decisions are your responsibility. The AI presents evidence, you decide.
          </p>
        </div>

        <div style={{ padding: '24px', background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: '4px', textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ fontSize: '14px', color: 'var(--text)', marginBottom: '8px' }}>
            No diagnostic analysis available yet.
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Run the Diagnostician Agent from the agent panel (right column) to generate an evidence map.
            The Ingestor must be run first.
          </div>
        </div>

        {/* Reference panel is available even before agent runs */}
        <Dsm5TrReferencePanel />
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Render: Full diagnostics view with live agent output
  // -------------------------------------------------------------------------

  const diagMap = diagOutput.diagnostic_evidence_map || {}
  const validity = diagOutput.validity_assessment || {}
  const differentials = diagOutput.differential_comparisons || []
  const psycholegal = diagOutput.psycholegal_analysis
  const functional = diagOutput.functional_impairment_summary

  // Helper: render met status badge
  const MetBadge = ({ status }: { status: string }) => {
    const colors: Record<string, string> = {
      met: '#4caf50',
      not_met: '#f44336',
      insufficient_data: '#ff9800',
    }
    return (
      <span style={{
        display: 'inline-block', padding: '1px 6px', borderRadius: '3px',
        fontSize: '10px', fontWeight: 600, color: '#fff',
        background: colors[status] || '#999', marginLeft: '6px',
      }}>
        {status.replace(/_/g, ' ')}
      </span>
    )
  }

  // Decision count for summary
  const undecided = decisions.filter((d) => d.decision === null).length
  const rendered = decisions.filter((d) => d.decision === 'render').length
  const ruledOut = decisions.filter((d) => d.decision === 'rule_out').length
  const deferred = decisions.filter((d) => d.decision === 'defer').length

  return (
    <div style={{ padding: '20px 24px', height: '100%', overflow: 'auto' }}>
      <h1 style={{ fontSize: '16px', marginBottom: '16px' }}>Diagnostics, Clinical Formulation</h1>

      {/* ██ RED WARNING BANNER ██ */}
      <div style={{ background: '#f44336', color: 'white', padding: '16px', borderRadius: '4px', marginBottom: '20px', border: '4px solid #d32f2f' }}>
        <p style={{ fontWeight: 600, fontSize: '14px', margin: '0 0 8px 0' }}>
          ⚠ DOCTOR ALWAYS DIAGNOSES, Never the AI
        </p>
        <p style={{ fontSize: '13px', margin: '0', lineHeight: '1.5' }}>
          You are the clinician. All diagnostic decisions are your responsibility.
          The evidence map below is for reference only. You must individually review and decide each diagnosis.
          No "Accept All" option exists.
        </p>
      </div>

      {/* DECISION SUMMARY BAR */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', fontSize: '12px', flexWrap: 'wrap' }}>
        <span style={{ padding: '4px 10px', borderRadius: '3px', background: 'var(--panel)', border: '1px solid var(--border)' }}>
          {decisions.length} diagnoses presented
        </span>
        {undecided > 0 && (
          <span style={{ padding: '4px 10px', borderRadius: '3px', background: '#fff3e0', color: '#e65100', fontWeight: 600 }}>
            {undecided} undecided
          </span>
        )}
        {rendered > 0 && (
          <span style={{ padding: '4px 10px', borderRadius: '3px', background: '#e8f5e9', color: '#2e7d32' }}>
            {rendered} rendered
          </span>
        )}
        {ruledOut > 0 && (
          <span style={{ padding: '4px 10px', borderRadius: '3px', background: '#ffebee', color: '#c62828' }}>
            {ruledOut} ruled out
          </span>
        )}
        {deferred > 0 && (
          <span style={{ padding: '4px 10px', borderRadius: '3px', background: '#e3f2fd', color: '#1565c0' }}>
            {deferred} deferred
          </span>
        )}
      </div>

      {/* ===== SECTION 1: VALIDITY ASSESSMENT ===== */}
      <div style={{ ...cardStyle, borderColor: '#4caf50' }}>
        <div style={{ ...cardHeaderStyle, background: '#e8f5e9' }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#2e7d32' }}>
            Validity & Effort Assessment
          </div>
          <div style={{ fontSize: '11px', color: '#558b2f', marginTop: '4px' }}>
            Processed first, determines interpretability of all test data
          </div>
        </div>
        <div style={cardBodyStyle}>
          {/* Effort tests */}
          {!!validity.effort_tests && Array.isArray(validity.effort_tests) && (
            <div style={{ marginBottom: '12px' }}>
              <div style={{ ...labelStyle, fontWeight: 600 }}>Effort/Performance Validity Tests:</div>
              {(validity.effort_tests as Array<Record<string, unknown>>).map((test, i) => (
                <div key={i} style={{ display: 'flex', gap: '12px', fontSize: '12px', padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                  <strong style={{ minWidth: '100px' }}>{String(test.test_name)}</strong>
                  <span style={{ color: String(test.status) === 'pass' ? '#4caf50' : String(test.status) === 'fail' ? '#f44336' : '#999' }}>
                    {String(test.status).toUpperCase()}
                  </span>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {String(test.impact_on_interpretability || '')}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* MMPI-3 validity */}
          {!!validity.mmpi3_validity && (
            <div style={{ marginBottom: '12px' }}>
              <div style={{ ...labelStyle, fontWeight: 600 }}>MMPI-3 Validity:</div>
              <div style={{ fontSize: '12px', color: 'var(--text)' }}>
                Overall: <strong>{String((validity.mmpi3_validity as Record<string, unknown>).overall_validity)}</strong>
              </div>
              {!!(validity.mmpi3_validity as Record<string, unknown>).interpretation_impact && (
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  {String((validity.mmpi3_validity as Record<string, unknown>).interpretation_impact)}
                </div>
              )}
            </div>
          )}

          {/* PAI validity */}
          {!!validity.pai_validity && (
            <div style={{ marginBottom: '12px' }}>
              <div style={{ ...labelStyle, fontWeight: 600 }}>PAI Validity:</div>
              <div style={{ fontSize: '12px', color: 'var(--text)' }}>
                {JSON.stringify(validity.pai_validity, null, 2)}
              </div>
            </div>
          )}

          {/* Summary */}
          {!!validity.summary && (
            <div style={{ padding: '8px', background: 'var(--bg)', borderRadius: '4px', fontSize: '12px', color: 'var(--text)', lineHeight: '1.6' }}>
              <strong>Summary:</strong> {String(validity.summary)}
            </div>
          )}

          {/* If validity is just a flat object, render all keys */}
          {!validity.effort_tests && !validity.mmpi3_validity && !validity.summary && (
            <div style={{ fontSize: '12px', color: 'var(--text)', whiteSpace: 'pre-wrap' }}>
              {JSON.stringify(validity, null, 2)}
            </div>
          )}
        </div>
      </div>

      {/* ===== SECTION 2: DIAGNOSTIC EVIDENCE MAP ===== */}
      <h2 style={sectionHeader}>
        Diagnostic Evidence Map ({Object.keys(diagMap).length} diagnoses)
      </h2>

      {Object.entries(diagMap).map(([diagKey, diagData]) => {
        const diag = diagData as Record<string, unknown>
        const decision = decisions.find((d) => d.diagnosisKey === diagKey)
        const isExpanded = expandedDiags.has(diagKey)
        const criteria = diag.criteria_analysis as Record<string, Record<string, unknown>> | undefined

        // Decision border color
        let borderColor = 'var(--border)'
        if (decision?.decision === 'render') borderColor = '#4caf50'
        if (decision?.decision === 'rule_out') borderColor = '#f44336'
        if (decision?.decision === 'defer') borderColor = '#2196f3'

        return (
          <div key={diagKey} style={{ ...cardStyle, borderColor, borderWidth: decision?.decision ? '2px' : '1px' }}>
            {/* Diagnosis header, click to expand */}
            <div
              style={{ ...cardHeaderStyle, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              onClick={() => toggleExpand(diagKey)}
            >
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
                  {String(diag.icd_code || '')}, {diagKey.replace(/_/g, ' ')}
                </div>
                {!!diag.functional_impact && (
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    {String(diag.functional_impact)}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {decision?.decision && (
                  <span style={{
                    padding: '2px 8px', borderRadius: '3px', fontSize: '10px', fontWeight: 600, color: '#fff',
                    background: decision.decision === 'render' ? '#4caf50' : decision.decision === 'rule_out' ? '#f44336' : '#2196f3',
                  }}>
                    {decision.decision === 'render' ? 'RENDERED' : decision.decision === 'rule_out' ? 'RULED OUT' : 'DEFERRED'}
                  </span>
                )}
                <span style={{ fontSize: '16px', color: 'var(--text-secondary)' }}>
                  {isExpanded ? '▾' : '▸'}
                </span>
              </div>
            </div>

            {/* Expanded content */}
            {isExpanded && (
              <div style={cardBodyStyle}>
                {/* Criteria analysis */}
                {criteria != null && Object.keys(criteria).length > 0 ? (
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ ...labelStyle, fontWeight: 600, marginBottom: '8px' }}>DSM-5-TR Criteria Analysis:</div>
                    {Object.entries(criteria).map(([critKey, critData]) => (
                      <div key={critKey} style={{ marginBottom: '10px', paddingLeft: '12px', borderLeft: '3px solid var(--border)' }}>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>
                          {critKey.replace(/_/g, ' ').toUpperCase()}
                          <MetBadge status={String(critData.met_status || 'unknown')} />
                        </div>
                        {!!critData.description && (
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', fontStyle: 'italic' }}>
                            {String(critData.description)}
                          </div>
                        )}
                        {!!critData.supporting_evidence && Array.isArray(critData.supporting_evidence) && (critData.supporting_evidence as unknown[]).length > 0 ? (
                          <div style={{ marginBottom: '4px' }}>
                            <span style={{ fontSize: '10px', color: '#4caf50', fontWeight: 600 }}>Supporting:</span>
                            {(critData.supporting_evidence as Array<Record<string, unknown>>).map((ev, i) => (
                              <div key={i} style={{ fontSize: '11px', color: 'var(--text)', paddingLeft: '12px' }}>
                                • {typeof ev === 'object' ? String(ev.source || JSON.stringify(ev)) : String(ev)}
                                {typeof ev === 'object' && !!ev.strength && (
                                  <span style={{ color: 'var(--text-secondary)', marginLeft: '4px' }}>({String(ev.strength)})</span>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : null}
                        {!!critData.contradicting_evidence && Array.isArray(critData.contradicting_evidence) && (critData.contradicting_evidence as unknown[]).length > 0 ? (
                          <div>
                            <span style={{ fontSize: '10px', color: '#f44336', fontWeight: 600 }}>Contradicting:</span>
                            {(critData.contradicting_evidence as Array<Record<string, unknown>>).map((ev, i) => (
                              <div key={i} style={{ fontSize: '11px', color: 'var(--text)', paddingLeft: '12px' }}>
                                • {typeof ev === 'object' ? String(ev.source || JSON.stringify(ev)) : String(ev)}
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}

                {/* Onset and course */}
                {!!diag.onset_and_course && (
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ ...labelStyle, fontWeight: 600 }}>Onset & Course:</div>
                    <div style={{ fontSize: '12px', color: 'var(--text)', whiteSpace: 'pre-wrap' }}>
                      {typeof diag.onset_and_course === 'object'
                        ? Object.entries(diag.onset_and_course as Record<string, unknown>).map(([k, v]) => (
                            <div key={k} style={{ marginBottom: '2px' }}>
                              <span style={{ color: 'var(--text-secondary)' }}>{k.replace(/_/g, ' ')}: </span>
                              {String(v)}
                            </div>
                          ))
                        : String(diag.onset_and_course)
                      }
                    </div>
                  </div>
                )}

                {/* ██ DECISION CONTROLS, NO "ACCEPT ALL" ██ */}
                <div style={{ padding: '12px', background: 'var(--bg)', borderRadius: '4px', marginTop: '12px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)', marginBottom: '8px' }}>
                    Your Decision:
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => setDecision(diagKey, decision?.decision === 'render' ? null : 'render')}
                      style={{
                        ...btnBase,
                        background: decision?.decision === 'render' ? '#4caf50' : 'var(--panel)',
                        color: decision?.decision === 'render' ? '#fff' : 'var(--text)',
                        borderColor: decision?.decision === 'render' ? '#4caf50' : 'var(--border)',
                      }}
                    >
                      {decision?.decision === 'render' ? '✓ Render' : 'Render'}
                    </button>
                    <button
                      onClick={() => setDecision(diagKey, decision?.decision === 'rule_out' ? null : 'rule_out')}
                      style={{
                        ...btnBase,
                        background: decision?.decision === 'rule_out' ? '#f44336' : 'var(--panel)',
                        color: decision?.decision === 'rule_out' ? '#fff' : 'var(--text)',
                        borderColor: decision?.decision === 'rule_out' ? '#f44336' : 'var(--border)',
                      }}
                    >
                      {decision?.decision === 'rule_out' ? '✕ Rule Out' : 'Rule Out'}
                    </button>
                    <button
                      onClick={() => setDecision(diagKey, decision?.decision === 'defer' ? null : 'defer')}
                      style={{
                        ...btnBase,
                        background: decision?.decision === 'defer' ? '#2196f3' : 'var(--panel)',
                        color: decision?.decision === 'defer' ? '#fff' : 'var(--text)',
                        borderColor: decision?.decision === 'defer' ? '#2196f3' : 'var(--border)',
                      }}
                    >
                      {decision?.decision === 'defer' ? '⏸ Defer' : 'Defer'}
                    </button>
                  </div>
                  <textarea
                    value={decision?.clinicianNotes || ''}
                    onChange={(e) => setNotes(diagKey, e.target.value)}
                    placeholder="Clinical rationale for this decision..."
                    style={{
                      width: '100%',
                      minHeight: '60px',
                      padding: '8px',
                      border: '1px solid var(--border)',
                      borderRadius: '4px',
                      background: 'var(--panel)',
                      color: 'var(--text)',
                      fontFamily: 'inherit',
                      fontSize: '12px',
                      resize: 'vertical',
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* ===== SECTION 3: DIFFERENTIAL COMPARISONS ===== */}
      {differentials.length > 0 && (
        <>
          <h2 style={sectionHeader}>Differential Comparisons</h2>
          {differentials.map((diff, i) => {
            const d = diff as Record<string, unknown>
            return (
              <div key={i} style={cardStyle}>
                <div style={cardHeaderStyle}>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>
                    {String(d.diagnosis_pair || `Comparison ${i + 1}`)}
                  </div>
                </div>
                <div style={cardBodyStyle}>
                  {!!d.key_distinguishing_features && Array.isArray(d.key_distinguishing_features) && (
                    (d.key_distinguishing_features as Array<Record<string, unknown>>).map((feat, fi) => (
                      <div key={fi} style={{ marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>
                          {String(feat.feature)}
                        </div>
                        {!!feat.evidence_for_diagnosis_1 && (
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', paddingLeft: '12px' }}>
                            <span style={{ color: '#2196f3' }}>Dx 1:</span> {String(feat.evidence_for_diagnosis_1)}
                          </div>
                        )}
                        {!!feat.evidence_for_diagnosis_2 && (
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', paddingLeft: '12px' }}>
                            <span style={{ color: '#ff9800' }}>Dx 2:</span> {String(feat.evidence_for_diagnosis_2)}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                  {!!d.clinical_clarification && (
                    <div style={{ fontSize: '12px', color: 'var(--text)', fontStyle: 'italic', padding: '8px', background: 'var(--bg)', borderRadius: '4px' }}>
                      {String(d.clinical_clarification)}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </>
      )}

      {/* ===== SECTION 4: PSYCHO-LEGAL ANALYSIS (forensic) ===== */}
      {psycholegal && Object.keys(psycholegal).length > 0 && (
        <>
          <h2 style={sectionHeader}>Psycho-Legal Analysis</h2>
          <div style={cardStyle}>
            <div style={cardBodyStyle}>
              {!!psycholegal.legal_standard && (
                <div style={{ marginBottom: '8px' }}>
                  <span style={labelStyle}>Legal Standard: </span>
                  <strong style={{ fontSize: '13px' }}>{String(psycholegal.legal_standard)}</strong>
                  {!!psycholegal.jurisdiction && (
                    <span style={{ color: 'var(--text-secondary)', marginLeft: '8px', fontSize: '12px' }}>
                      ({String(psycholegal.jurisdiction)})
                    </span>
                  )}
                </div>
              )}
              {!!psycholegal.standard_elements && Array.isArray(psycholegal.standard_elements) && (
                (psycholegal.standard_elements as Array<Record<string, unknown>>).map((elem, i) => (
                  <div key={i} style={{ marginBottom: '8px', paddingLeft: '12px', borderLeft: '3px solid #ff9800' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}>
                      {String(elem.element)}
                    </div>
                    {!!elem.evidence_map && (
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        {Array.isArray(elem.evidence_map)
                          ? (elem.evidence_map as string[]).map((e, ei) => <div key={ei}>• {String(e)}</div>)
                          : String(elem.evidence_map)
                        }
                      </div>
                    )}
                  </div>
                ))
              )}
              {!!psycholegal.critical_gaps && (
                <div style={{ padding: '8px', background: '#fff3e0', borderRadius: '4px', fontSize: '12px', color: '#e65100', marginTop: '8px' }}>
                  <strong>Gaps:</strong> {String(psycholegal.critical_gaps)}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ===== SECTION 5: FUNCTIONAL IMPAIRMENT (clinical) ===== */}
      {functional && Object.keys(functional).length > 0 && (
        <>
          <h2 style={sectionHeader}>Functional Impairment Summary</h2>
          <div style={cardStyle}>
            <div style={cardBodyStyle}>
              {Object.entries(functional).map(([domain, desc]) => (
                <div key={domain} style={{ marginBottom: '8px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)', textTransform: 'capitalize' }}>
                    {domain.replace(/_/g, ' ')}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', paddingLeft: '12px' }}>
                    {String(desc)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ===== DSM-5-TR REFERENCE ===== */}
      <Dsm5TrReferencePanel onInsert={handleInsertFromCatalog} />

      {/* ===== CLINICAL FORMULATION ===== */}
      <h2 style={sectionHeader}>Clinical Formulation</h2>
      <textarea
        ref={formulationRef}
        value={formulation}
        onChange={(e) => { setFormulation(e.target.value); setFormulationSaved(false) }}
        placeholder="Enter your clinical formulation and rationale for diagnostic decisions. This is the clinician's authoritative narrative."
        style={{
          width: '100%',
          minHeight: '200px',
          padding: '12px',
          border: '1px solid var(--border)',
          borderRadius: '4px',
          background: 'var(--bg)',
          color: 'var(--text)',
          fontFamily: 'inherit',
          fontSize: '13px',
          lineHeight: '1.6',
          resize: 'vertical',
          marginBottom: '20px',
        }}
      />

      {/* ===== ACTION BUTTONS ===== */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '40px' }}>
        <button
          style={{ ...btnBase, background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' }}
          onClick={async () => {
            // Persist each decision that has been made
            const toSave = decisions.filter((d) => d.decision !== null)
            for (const d of toSave) {
              await window.psygil.diagnosticDecisions.save({
                case_id: caseId,
                diagnosis_key: d.diagnosisKey,
                icd_code: d.code,
                diagnosis_name: d.name,
                decision: d.decision!,
                clinician_notes: d.clinicianNotes,
              })
            }
            // Delete decisions that were cleared (had a decision, now null)
            const toDelete = decisions.filter((d) => d.decision === null)
            for (const d of toDelete) {
              await window.psygil.diagnosticDecisions.delete({
                case_id: caseId,
                diagnosis_key: d.diagnosisKey,
              })
            }
            // Persist clinical formulation
            await window.psygil.clinicalFormulation.save({
              case_id: caseId,
              formulation_text: formulation,
            })
            setFormulationSaved(true)
            setTimeout(() => setFormulationSaved(false), 3000)
          }}
        >
          Save Diagnostic Decisions
        </button>
        {formulationSaved && (
          <span style={{ fontSize: '12px', color: '#4caf50', alignSelf: 'center' }}>
            Saved
          </span>
        )}
        {undecided > 0 && (
          <span style={{ fontSize: '12px', color: '#e65100', alignSelf: 'center' }}>
            {undecided} diagnosis{undecided > 1 ? 'es' : ''} still undecided
          </span>
        )}
      </div>

      {/* Generation metadata */}
      <div style={{ fontSize: '10px', color: 'var(--text-secondary)', borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
        Diagnostician v{diagOutput.version} | Generated: {diagOutput.generated_at} | Case: {diagOutput.case_id}
      </div>
    </div>
  )
}
