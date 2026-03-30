import React, { useState } from 'react'

/**
 * AttestationTab (Gate 3)
 *
 * Review & Attestation interface for finalizing a forensic psychology evaluation.
 *
 * Features:
 * - Completion checklist (blocks attestation if incomplete)
 * - Report preview section
 * - Digital attestation with typed signature
 * - Date stamp
 * - Submit button (enabled only when all checklist items complete)
 */

export interface AttestationTabProps {
  caseId: number
}

interface ChecklistItem {
  id: string
  label: string
  completed: boolean
}

export const AttestationTab: React.FC<AttestationTabProps> = ({ caseId }) => {
  const [checklist, setChecklist] = useState<ChecklistItem[]>([
    { id: 'testing-complete', label: 'All testing complete', completed: false },
    { id: 'interviews-documented', label: 'All interviews documented', completed: false },
    { id: 'diagnostic-decisions', label: 'Diagnostic decisions recorded', completed: false },
    { id: 'report-reviewed', label: 'Report draft reviewed', completed: false },
    { id: 'daubert-verified', label: 'Daubert compliance verified', completed: false },
    { id: 'pii-handled', label: 'All PII properly handled', completed: false },
  ])

  const [signature, setSignature] = useState('')
  const [attestationText] = useState(
    'I, Dr. Truck Irwin, a licensed forensic psychologist, do hereby attest that I have personally conducted a comprehensive evaluation of the examinee as detailed in this report. I have reviewed all relevant records, administered standardized psychological tests, and conducted clinical interviews. My opinions are based on reliable psychological data and methods. I have followed the Daubert standard for expert testimony and maintained appropriate professional boundaries throughout the evaluation. This report represents my best professional judgment.'
  )

  const handleToggleCheckitem = (id: string) => {
    setChecklist(checklist.map((item) => (item.id === id ? { ...item, completed: !item.completed } : item)))
  }

  const allCompleted = checklist.every((item) => item.completed)
  const completedCount = checklist.filter((item) => item.completed).length

  return (
    <div style={{ padding: '20px 24px' }}>
      <h1>Review & Attestation</h1>

      {/* STATUS BANNER */}
      {!allCompleted && (
        <div
          style={{
            background: '#fff3cd',
            color: '#856404',
            padding: '16px',
            borderRadius: '4px',
            marginBottom: '20px',
            border: '4px solid #ffc107',
          }}
        >
          <p style={{ fontWeight: 600, fontSize: '14px', margin: '0 0 8px 0' }}>
            ⏳ CHECKLIST INCOMPLETE
          </p>
          <p style={{ fontSize: '13px', margin: '0', lineHeight: '1.5' }}>
            {completedCount} of {checklist.length} items completed. Complete all checklist items before proceeding to attestation.
          </p>
        </div>
      )}

      {allCompleted && (
        <div
          style={{
            background: '#e8f5e9',
            color: '#2e7d32',
            padding: '16px',
            borderRadius: '4px',
            marginBottom: '20px',
            border: '4px solid #4caf50',
          }}
        >
          <p style={{ fontWeight: 600, fontSize: '14px', margin: '0' }}>
            ✓ ALL REQUIREMENTS MET — Ready for Attestation
          </p>
        </div>
      )}

      {/* COMPLETION CHECKLIST */}
      <h2 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px', paddingBottom: '6px', borderBottom: '1px solid var(--border)' }}>
        Completion Checklist
      </h2>
      <div
        style={{
          background: 'var(--highlight)',
          border: '1px solid var(--border)',
          borderRadius: '4px',
          padding: '16px',
          marginBottom: '20px',
        }}
      >
        {checklist.map((item) => (
          <div key={item.id} style={{ marginBottom: item.id === checklist[checklist.length - 1].id ? '0' : '12px' }}>
            <label style={{ display: 'flex', gap: '8px', alignItems: 'center', cursor: 'pointer', fontSize: '13px' }}>
              <input
                type="checkbox"
                checked={item.completed}
                onChange={() => handleToggleCheckitem(item.id)}
                style={{
                  width: '16px',
                  height: '16px',
                  cursor: 'pointer',
                  accentColor: 'var(--accent)',
                }}
              />
              <span style={{ color: item.completed ? 'var(--text)' : 'var(--text)' }}>
                {item.completed ? '✓' : '○'} {item.label}
              </span>
            </label>
          </div>
        ))}
      </div>

      {/* REPORT PREVIEW */}
      <h2 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px', paddingBottom: '6px', borderBottom: '1px solid var(--border)' }}>
        Report Preview
      </h2>
      <div
        style={{
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: '4px',
          padding: '16px',
          marginBottom: '20px',
          minHeight: '200px',
          maxHeight: '400px',
          overflowY: 'auto',
          fontSize: '12px',
          lineHeight: '1.6',
          fontFamily: "'Times New Roman', Times, serif",
        }}
      >
        <div style={{ color: 'var(--text)' }}>
          <p>
            <strong>FORENSIC PSYCHOLOGICAL EVALUATION</strong>
          </p>
          <p style={{ margin: '12px 0' }}>
            <strong>Examinee:</strong> Johnson, Marcus D. | <strong>DOB:</strong> 01/15/1988 | <strong>Age:</strong> 37
          </p>
          <p style={{ margin: '12px 0' }}>
            <strong>Evaluation Type:</strong> Competency to Stand Trial (CST) | <strong>Referral Source:</strong> Public Defender's Office
          </p>
          <p style={{ margin: '12px 0' }}>
            <strong>Evaluation Dates:</strong> March 8-12, 2026 | <strong>Report Date:</strong> March 19, 2026
          </p>

          <p style={{ margin: '20px 0 12px 0' }}>
            <strong>CLINICAL IMPRESSIONS</strong>
          </p>
          <p>
            The examinee presents with a primary diagnosis of Schizophrenia, First Episode, Acute (DSM-5-TR: F20.9). Clinical interview,
            standardized psychological testing, and collateral information converge on this diagnostic impression.
          </p>

          <p style={{ margin: '20px 0 12px 0' }}>
            <strong>COMPETENCY-TO-STAND-TRIAL OPINION</strong>
          </p>
          <p>
            Based on the Dusky standard (Dusky v. United States, 1960), the examinee is found to be <strong>NOT COMPETENT</strong> to stand
            trial. The examinee demonstrates significant impairment in both:
          </p>
          <ul style={{ margin: '12px 0', paddingLeft: '20px' }}>
            <li>Rational understanding of the legal proceedings</li>
            <li>Ability to assist counsel in his defense</li>
          </ul>

          <p style={{ margin: '20px 0 0 0', fontSize: '11px', color: 'var(--text-secondary)' }}>
            [Full report content truncated for display. See complete report for detailed findings and recommendations.]
          </p>
        </div>
      </div>

      {/* DIGITAL ATTESTATION */}
      <h2 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px', paddingBottom: '6px', borderBottom: '1px solid var(--border)' }}>
        Digital Attestation
      </h2>
      <div
        style={{
          background: 'var(--highlight)',
          border: '1px solid var(--border)',
          borderRadius: '4px',
          padding: '16px',
          marginBottom: '20px',
        }}
      >
        {/* Attestation Text */}
        <div style={{ marginBottom: '16px', fontSize: '13px', lineHeight: '1.6', color: 'var(--text)' }}>
          <p style={{ fontStyle: 'italic' }}>"{attestationText}"</p>
        </div>

        {/* Signature Field */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--text)' }}>
            Typed Signature
          </label>
          <input
            type="text"
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            placeholder="Enter your full name as signature"
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              background: 'var(--bg)',
              color: 'var(--text)',
              fontSize: '13px',
              fontFamily: 'inherit',
            }}
          />
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            This signature attests to the accuracy and completeness of this report.
          </div>
        </div>

        {/* Date Stamp */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--text)' }}>
            Date of Attestation
          </label>
          <input
            type="date"
            defaultValue={new Date().toISOString().split('T')[0]}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              background: 'var(--bg)',
              color: 'var(--text)',
              fontSize: '13px',
              fontFamily: 'inherit',
            }}
          />
        </div>

        {/* Attestation Summary */}
        {signature && allCompleted && (
          <div
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              padding: '12px',
              fontSize: '12px',
              lineHeight: '1.6',
            }}
          >
            <p style={{ margin: '0 0 8px 0', fontWeight: 600, color: 'var(--text)' }}>
              Attested by: {signature}
            </p>
            <p style={{ margin: '0', color: 'var(--text-secondary)' }}>
              Date: {new Date().toLocaleDateString()} | Integrity: SHA-256 hash will be generated upon submission
            </p>
          </div>
        )}
      </div>

      {/* ACTION BUTTONS */}
      <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
        <button
          disabled={!allCompleted || !signature}
          style={{
            padding: '8px 16px',
            background: allCompleted && signature ? 'var(--accent)' : 'var(--border)',
            color: allCompleted && signature ? 'white' : 'var(--text-secondary)',
            border: 'none',
            borderRadius: '4px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: allCompleted && signature ? 'pointer' : 'not-allowed',
            opacity: allCompleted && signature ? 1 : 0.5,
          }}
        >
          Submit Attestation & Lock Report
        </button>
        <button
          style={{
            padding: '8px 16px',
            background: 'var(--panel)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Save Draft
        </button>
        <button
          style={{
            padding: '8px 16px',
            background: 'var(--panel)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Return to Diagnostics
        </button>
      </div>

      {/* HELP TEXT */}
      <div style={{ marginTop: '24px', padding: '12px', background: 'var(--highlight)', borderRadius: '4px', fontSize: '12px', color: 'var(--text-secondary)' }}>
        <p style={{ margin: '0 0 8px 0', fontWeight: 600, color: 'var(--text)' }}>
          What happens next?
        </p>
        <ul style={{ margin: '0', paddingLeft: '20px' }}>
          <li>Your attestation generates a SHA-256 integrity hash of the final report</li>
          <li>The document is locked and cannot be edited (forensic requirement)</li>
          <li>An audit trail entry is created with your signature and timestamp</li>
          <li>You can then export the report for delivery to the referral source</li>
        </ul>
      </div>
    </div>
  )
}
