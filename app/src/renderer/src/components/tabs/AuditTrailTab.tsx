import React, { useState } from 'react'

/**
 * AuditTrailTab
 *
 * Complete audit trail of all case actions for forensic documentation and compliance.
 *
 * Features:
 * - Chronological table of all case events
 * - Actor identification (User/Clinician vs AI Agent)
 * - Action type and details
 * - Status indicators with color coding
 * - UNID redaction notation for PII operations
 */

export interface AuditTrailTabProps {
  caseId: number
}

export type AuditStatus = 'complete' | 'in_progress' | 'error'

interface AuditEntry {
  id: string
  timestamp: string
  actor: string
  actorType: 'clinician' | 'system' | 'agent'
  action: string
  details: string
  stage: string
  status: AuditStatus
}

export const AuditTrailTab: React.FC<AuditTrailTabProps> = ({ caseId }) => {
  const [entries] = useState<AuditEntry[]>([
    {
      id: 'evt-001',
      timestamp: '2026-03-19T14:45:00Z',
      actor: 'Editor Agent',
      actorType: 'agent',
      action: 'Report sections reviewed and formatted',
      details: 'Reviewed final report sections for consistency, formatting, and Daubert compliance. No changes required.',
      stage: 'Diagnostics',
      status: 'complete',
    },
    {
      id: 'evt-002',
      timestamp: '2026-03-19T14:30:00Z',
      actor: 'Dr. Irwin',
      actorType: 'clinician',
      action: 'Diagnostic decision recorded',
      details: 'Primary diagnosis: Schizophrenia, First Episode, Acute (F20.9). Secondary: None. Clinical formulation documented.',
      stage: 'Diagnostics',
      status: 'complete',
    },
    {
      id: 'evt-003',
      timestamp: '2026-03-19T14:15:00Z',
      actor: 'Diagnostician Agent',
      actorType: 'agent',
      action: 'Competency opinion drafted',
      details: 'AI-generated opinion draft: NOT COMPETENT to stand trial (Dusky standard). Awaiting clinician review and acceptance.',
      stage: 'Diagnostics',
      status: 'complete',
    },
    {
      id: 'evt-004',
      timestamp: '2026-03-12T16:00:00Z',
      actor: 'Dr. Irwin',
      actorType: 'clinician',
      action: 'Session 3 completed: Cognitive testing',
      details: 'Administered WAIS-V, TOMM, and SIRS-2. Patient cooperative, adequate effort. Results documented.',
      stage: 'Interview',
      status: 'complete',
    },
    {
      id: 'evt-005',
      timestamp: '2026-03-12T14:00:00Z',
      actor: 'Documenter Agent',
      actorType: 'agent',
      action: 'Interview transcripts uploaded and parsed',
      details: 'PII redacted (UNID: op-2026-0147-001). Full clinical content extracted and indexed. 3 interview transcripts processed.',
      stage: 'Interview',
      status: 'complete',
    },
    {
      id: 'evt-006',
      timestamp: '2026-03-10T17:30:00Z',
      actor: 'Dr. Irwin',
      actorType: 'clinician',
      action: 'Session 2 completed: Personality testing',
      details: 'Administered MMPI-3 and PAI. Patient cooperative. Scores within expected range. Raw data secured.',
      stage: 'Testing',
      status: 'complete',
    },
    {
      id: 'evt-007',
      timestamp: '2026-03-10T15:00:00Z',
      actor: 'Documenter Agent',
      actorType: 'agent',
      action: 'Test scores imported from Q-global and PARiConnect',
      details: 'Automated secure import from testing databases. Standard scores extracted and validated. 2 test batteries processed.',
      stage: 'Testing',
      status: 'complete',
    },
    {
      id: 'evt-008',
      timestamp: '2026-03-08T16:30:00Z',
      actor: 'Dr. Irwin',
      actorType: 'clinician',
      action: 'Session 1 completed: Clinical interview',
      details: 'Comprehensive clinical interview (2.5 hours). MSE administered. Patient reported persecutory concerns and auditory hallucinations.',
      stage: 'Interview',
      status: 'complete',
    },
    {
      id: 'evt-009',
      timestamp: '2026-03-08T09:00:00Z',
      actor: 'Dr. Irwin',
      actorType: 'clinician',
      action: 'Collateral records uploaded',
      details: 'PII redacted (UNID: op-2026-0147-002). 5 documents: court order, hospital records, police report, jail medical, prior evaluation.',
      stage: 'Onboarding',
      status: 'complete',
    },
    {
      id: 'evt-010',
      timestamp: '2026-02-28T14:00:00Z',
      actor: 'System',
      actorType: 'system',
      action: 'Case created from court order',
      details: 'Case #2026-0147 created. Examinee: Johnson, Marcus D. (DOB 01/15/1988). Referral: CST evaluation. Deadline: April 15, 2026.',
      stage: 'Onboarding',
      status: 'complete',
    },
  ])

  const getStatusColor = (status: AuditStatus): string => {
    switch (status) {
      case 'complete':
        return '#4caf50'
      case 'in_progress':
        return '#ff9800'
      case 'error':
        return '#f44336'
      default:
        return '#808080'
    }
  }

  const getStatusLabel = (status: AuditStatus): string => {
    switch (status) {
      case 'complete':
        return 'Complete'
      case 'in_progress':
        return 'In Progress'
      case 'error':
        return 'Error'
      default:
        return 'Unknown'
    }
  }

  const getActorColor = (actorType: string): string => {
    switch (actorType) {
      case 'clinician':
        return 'var(--accent)'
      case 'agent':
        return '#ff9800'
      case 'system':
        return '#9e9e9e'
      default:
        return 'var(--text-secondary)'
    }
  }

  const getActorLabel = (actorType: string): string => {
    switch (actorType) {
      case 'clinician':
        return '👤 Clinician'
      case 'agent':
        return '🤖 AI Agent'
      case 'system':
        return '⚙ System'
      default:
        return 'Unknown'
    }
  }

  return (
    <div style={{ padding: '20px 24px' }}>
      <h1>Audit Trail — Case #{caseId}</h1>

      {/* INFO BANNER */}
      <div
        style={{
          background: 'var(--highlight)',
          border: '1px solid var(--border)',
          borderRadius: '4px',
          padding: '12px',
          marginBottom: '20px',
          fontSize: '12px',
          lineHeight: '1.6',
          color: 'var(--text-secondary)',
        }}
      >
        <p style={{ margin: '0 0 8px 0', fontWeight: 600, color: 'var(--text)' }}>
          Complete Evaluation History
        </p>
        <p style={{ margin: '0' }}>
          This audit trail captures all actions taken on this case, including clinician decisions, AI agent operations, and system events. Timestamps are
          in UTC. All PII operations are logged with UNID references (Unique Identifier Numbers) for redaction tracking.
        </p>
      </div>

      {/* AUDIT TRAIL TABLE */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr style={{ background: 'var(--panel)', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '11px' }}>
                Timestamp
              </th>
              <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '11px' }}>
                Actor
              </th>
              <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '11px' }}>
                Action
              </th>
              <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '11px' }}>
                Pipeline Stage
              </th>
              <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '11px' }}>
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, idx) => (
              <tr
                key={entry.id}
                style={{
                  borderBottom: '1px solid var(--border)',
                  background: idx % 2 === 0 ? 'var(--bg)' : 'var(--highlight)',
                }}
              >
                {/* Timestamp */}
                <td style={{ padding: '10px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', fontSize: '11px' }}>
                  {new Date(entry.timestamp).toLocaleString(undefined, {
                    month: 'short',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </td>

                {/* Actor */}
                <td style={{ padding: '10px', color: getActorColor(entry.actorType), fontWeight: 500 }}>
                  <span title={getActorLabel(entry.actorType)}>{entry.actor}</span>
                </td>

                {/* Action + Details */}
                <td style={{ padding: '10px', color: 'var(--text)' }}>
                  <div style={{ fontWeight: 500, marginBottom: '4px' }}>
                    {entry.action}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                    {entry.details}
                  </div>
                </td>

                {/* Stage */}
                <td style={{ padding: '10px', color: 'var(--text)' }}>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '3px 8px',
                      background: 'var(--panel)',
                      borderRadius: '3px',
                      fontSize: '11px',
                      fontWeight: 500,
                    }}
                  >
                    {entry.stage}
                  </span>
                </td>

                {/* Status */}
                <td style={{ padding: '10px', textAlign: 'center' }}>
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 8px',
                      background: getStatusColor(entry.status),
                      color: 'white',
                      borderRadius: '3px',
                      fontSize: '11px',
                      fontWeight: 600,
                    }}
                  >
                    <span
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: 'white',
                      }}
                    />
                    {getStatusLabel(entry.status)}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* STATISTICS */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '12px',
          marginTop: '24px',
        }}
      >
        <div
          style={{
            background: 'var(--highlight)',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            padding: '12px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--accent)' }}>
            {entries.length}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Total Events
          </div>
        </div>

        <div
          style={{
            background: 'var(--highlight)',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            padding: '12px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#0078d4' }}>
            {entries.filter((e) => e.actorType === 'clinician').length}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Clinician Actions
          </div>
        </div>

        <div
          style={{
            background: 'var(--highlight)',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            padding: '12px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#ff9800' }}>
            {entries.filter((e) => e.actorType === 'agent').length}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            AI Agent Operations
          </div>
        </div>

        <div
          style={{
            background: 'var(--highlight)',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            padding: '12px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#4caf50' }}>
            {entries.filter((e) => e.status === 'complete').length}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Completed
          </div>
        </div>
      </div>

      {/* EXPORT/DOWNLOAD */}
      <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
        <button
          style={{
            padding: '8px 16px',
            background: 'var(--accent)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Export Audit Trail (CSV)
        </button>
        <button
          style={{
            padding: '8px 16px',
            background: 'var(--panel)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Export Audit Trail (PDF)
        </button>
        <button
          style={{
            padding: '8px 16px',
            background: 'var(--panel)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Verify Integrity Hash
        </button>
      </div>

      {/* HELP */}
      <div
        style={{
          marginTop: '24px',
          padding: '12px',
          background: 'var(--highlight)',
          borderRadius: '4px',
          fontSize: '12px',
          lineHeight: '1.6',
          color: 'var(--text-secondary)',
        }}
      >
        <p style={{ margin: '0 0 8px 0', fontWeight: 600, color: 'var(--text)' }}>
          About This Audit Trail
        </p>
        <ul style={{ margin: '0', paddingLeft: '20px' }}>
          <li>
            <strong>Forensic Compliance:</strong> This audit trail satisfies forensic documentation requirements and supports discoverability in
            legal proceedings.
          </li>
          <li>
            <strong>PII Tracking:</strong> All PII redaction operations are logged with UNID (Unique Identifier Number) references for audit purposes.
          </li>
          <li>
            <strong>Agent Transparency:</strong> All AI agent operations are clearly marked and timestamped, with clinician actions separated for
            evidentiary clarity.
          </li>
          <li>
            <strong>Integrity Verification:</strong> Export the audit trail as proof of proper case management and no unauthorized modifications.
          </li>
        </ul>
      </div>
    </div>
  )
}
