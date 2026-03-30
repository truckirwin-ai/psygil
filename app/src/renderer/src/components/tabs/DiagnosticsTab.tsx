import React, { useState } from 'react'

/**
 * DiagnosticsTab (Gate 2)
 *
 * Forensic psychology diagnostic decision interface.
 * Core principle: DOCTOR ALWAYS DIAGNOSES — Never the AI.
 *
 * Features:
 * - Red warning banner emphasizing clinician authority
 * - AI-generated diagnostic suggestions (marked for reference only)
 * - Individual accept/reject buttons per diagnosis
 * - DSM-5-TR criteria display
 * - Clinical formulation text area
 * - Feigning/validity assessment summary
 */

export interface DiagnosticsTabProps {
  caseId: number
}

interface DiagnosticSuggestion {
  id: string
  code: string
  name: string
  reasoning: string
  criteria: string[]
  evidence: string[]
  accepted?: boolean
  rejected?: boolean
}

export const DiagnosticsTab: React.FC<DiagnosticsTabProps> = ({ caseId }) => {
  const [formulation, setFormulation] = useState('')
  const [feigningAssessment, setFeigningAssessment] = useState('')
  const [diagnostics, setDiagnostics] = useState<DiagnosticSuggestion[]>([
    {
      id: 'primary-schiz',
      code: 'F20.9',
      name: 'Schizophrenia, First Episode, Acute',
      reasoning:
        'Primary presentation: Thought disturbance, auditory hallucinations, persecutory delusions consistent with schizophrenia spectrum.',
      criteria: [
        'A. Criterion A requires ≥2 active-phase symptoms',
        'B. Duration: 8+ months meets duration requirement',
        'C. Functional decline evident in work/social functioning',
        'D. Exclusion of substance/medical causes confirmed',
      ],
      evidence: [
        'MMPI-3: THD=75T, RC6=72T, RC8=78T (schizophrenia-consistent)',
        'PAI: SCZ=72T, PAR=68T (schizophrenia-consistent)',
        'Clinical interview: Documented auditory hallucinations, persecutory delusions',
        'Collateral records: Hospital notes confirm psychotic presentation',
        'No substance abuse history; psychosis predates jail medications',
      ],
    },
    {
      id: 'secondary-brief',
      code: 'F23',
      name: 'Brief Psychotic Disorder',
      reasoning:
        'Differential diagnosis: Duration <1 month, but less likely given 8+ month history of psychotic symptoms.',
      criteria: [
        'A. Presence of one or more psychotic symptoms',
        'B. Duration between 1 day and 1 month',
        'C. Illness duration rules this out',
      ],
      evidence: [
        'History extends 8+ months (exceeds duration threshold)',
        'Clear onset predates hospitalization by months',
      ],
    },
    {
      id: 'secondary-schizoaff',
      code: 'F25',
      name: 'Schizoaffective Disorder',
      reasoning:
        'Differential: Requires prominent mood episode concurrent with psychosis; depressive features mild here.',
      criteria: [
        'A. Uninterrupted illness period with active psychotic symptoms',
        'B. A major depressive episode concurrent with psychosis',
      ],
      evidence: [
        'PAI DEP=60T; MMPI-3 RC2=55T (below depression threshold)',
        'Depressive features are mild and secondary to paranoia',
        'Interview: Minimal mood symptoms relative to psychotic features',
      ],
    },
  ])

  const handleAcceptDiagnosis = (id: string) => {
    setDiagnostics(diagnostics.map((d) => (d.id === id ? { ...d, accepted: true, rejected: false } : d)))
  }

  const handleRejectDiagnosis = (id: string) => {
    setDiagnostics(diagnostics.map((d) => (d.id === id ? { ...d, rejected: true, accepted: false } : d)))
  }

  const handleClearDiagnosis = (id: string) => {
    setDiagnostics(diagnostics.map((d) => (d.id === id ? { ...d, accepted: false, rejected: false } : d)))
  }

  return (
    <div style={{ padding: '20px 24px' }}>
      <h1>Diagnostics — Clinical Formulation</h1>

      {/* RED WARNING BANNER */}
      <div
        style={{
          background: '#f44336',
          color: 'white',
          padding: '16px',
          borderRadius: '4px',
          marginBottom: '20px',
          border: '4px solid #d32f2f',
        }}
      >
        <p style={{ fontWeight: 600, fontSize: '14px', margin: '0 0 8px 0' }}>
          ⚠ DOCTOR ALWAYS DIAGNOSES — Never the AI
        </p>
        <p style={{ fontSize: '13px', margin: '0', lineHeight: '1.5' }}>
          You are the clinician. All diagnostic decisions are your responsibility. The AI suggestions below are for reference only. You must
          individually review, accept, or reject each diagnosis. No "Accept All" option exists.
        </p>
      </div>

      {/* VALIDITY/FEIGNING SUMMARY */}
      <div
        style={{
          background: 'var(--panel)',
          border: '1px solid var(--border)',
          borderRadius: '4px',
          padding: '12px',
          marginBottom: '20px',
        }}
      >
        <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
          Validity & Effort Summary
        </div>
        <div style={{ fontSize: '13px', lineHeight: '1.6' }}>
          <p style={{ margin: '0 0 8px 0', color: '#4caf50', fontWeight: 600 }}>
            ✓ VALID EFFORT CONFIRMED
          </p>
          <p style={{ margin: '0', color: 'var(--text)' }}>
            <strong>TOMM Trial 2:</strong> 48/50 (pass) | <strong>SIRS-2:</strong> All scales honest |{' '}
            <strong>MMPI-3 Validity:</strong> All acceptable
          </p>
        </div>
      </div>

      {/* AI DIAGNOSTIC SUGGESTIONS */}
      <h2 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px', paddingBottom: '6px', borderBottom: '1px solid var(--border)' }}>
        AI Diagnostic Suggestions (For Reference Only)
      </h2>

      {diagnostics.map((diag) => (
        <div key={diag.id} style={{ marginBottom: '20px', border: '1px solid var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ background: 'var(--highlight)', padding: '12px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
              {diag.code} — {diag.name}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              {diag.reasoning}
            </div>
          </div>

          {/* Content */}
          <div style={{ padding: '12px' }}>
            {/* DSM-5-TR Criteria */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--text)' }}>
                DSM-5-TR Criteria:
              </div>
              <ul style={{ paddingLeft: '20px', margin: '0', fontSize: '12px' }}>
                {diag.criteria.map((crit, idx) => (
                  <li key={idx} style={{ marginBottom: '3px', color: 'var(--text)' }}>
                    {crit}
                  </li>
                ))}
              </ul>
            </div>

            {/* Evidence */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--text)' }}>
                Evidence Summary:
              </div>
              <ul style={{ paddingLeft: '20px', margin: '0', fontSize: '12px' }}>
                {diag.evidence.map((evid, idx) => (
                  <li key={idx} style={{ marginBottom: '3px', color: 'var(--text-secondary)' }}>
                    {evid}
                  </li>
                ))}
              </ul>
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                onClick={() => handleAcceptDiagnosis(diag.id)}
                style={{
                  padding: '6px 12px',
                  background: diag.accepted ? 'var(--accent)' : 'var(--panel)',
                  color: diag.accepted ? 'white' : 'var(--text)',
                  border: diag.accepted ? 'none' : '1px solid var(--border)',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                {diag.accepted ? '✓ Accepted' : 'Accept'}
              </button>
              <button
                onClick={() => handleRejectDiagnosis(diag.id)}
                style={{
                  padding: '6px 12px',
                  background: diag.rejected ? '#f44336' : 'var(--panel)',
                  color: diag.rejected ? 'white' : 'var(--text)',
                  border: diag.rejected ? 'none' : '1px solid var(--border)',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                {diag.rejected ? '✕ Rejected' : 'Reject'}
              </button>
              {(diag.accepted || diag.rejected) && (
                <button
                  onClick={() => handleClearDiagnosis(diag.id)}
                  style={{
                    padding: '4px 8px',
                    background: 'transparent',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border)',
                    borderRadius: '3px',
                    fontSize: '11px',
                    cursor: 'pointer',
                  }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* CLINICAL FORMULATION */}
      <h2 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px', paddingBottom: '6px', borderBottom: '1px solid var(--border)' }}>
        Clinical Formulation
      </h2>
      <div style={{ marginBottom: '20px' }}>
        <textarea
          value={formulation}
          onChange={(e) => setFormulation(e.target.value)}
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
          }}
        />
      </div>

      {/* FEIGNING ASSESSMENT */}
      <h2 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px', paddingBottom: '6px', borderBottom: '1px solid var(--border)' }}>
        Feigning Assessment
      </h2>
      <div style={{ marginBottom: '20px' }}>
        <textarea
          value={feigningAssessment}
          onChange={(e) => setFeigningAssessment(e.target.value)}
          placeholder="Summarize validity test results, malingering indicators, and your conclusions about honest responding."
          style={{
            width: '100%',
            minHeight: '120px',
            padding: '12px',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            background: 'var(--bg)',
            color: 'var(--text)',
            fontFamily: 'inherit',
            fontSize: '13px',
            lineHeight: '1.6',
          }}
        />
      </div>

      {/* ACTION BUTTONS */}
      <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
        <button
          style={{
            padding: '6px 12px',
            background: 'var(--accent)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Save Diagnostic Decisions
        </button>
        <button
          style={{
            padding: '6px 12px',
            background: 'var(--panel)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Preview Report
        </button>
      </div>
    </div>
  )
}
