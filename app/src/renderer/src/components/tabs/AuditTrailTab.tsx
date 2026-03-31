import React, { useState, useEffect } from 'react'
import { IpcResponse, AuditEntry } from '@shared/types/ipc'

/**
 * AuditTrailTab
 *
 * Complete audit trail of all case actions for forensic documentation and compliance.
 *
 * Features:
 * - Real-time audit trail from database
 * - Actor identification (Clinician vs AI Agent vs System)
 * - Action type and details with timestamps
 * - Status indicators with color coding
 * - CSV and JSON export
 * - Auto-refresh every 10 seconds
 * - Integrity verification
 */

export interface AuditTrailTabProps {
  caseId: number
}

export type AuditStatus = 'complete' | 'in_progress' | 'error'

export const AuditTrailTab: React.FC<AuditTrailTabProps> = ({ caseId }) => {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isExporting, setIsExporting] = useState<'csv' | 'json' | null>(null)
  const [isVerifying, setIsVerifying] = useState(false)
  const [verifyResult, setVerifyResult] = useState<{ valid: boolean; message: string } | null>(null)

  // Load audit trail on mount and set up auto-refresh
  useEffect(() => {
    const loadAuditTrail = async () => {
      try {
        setError('')
        if (!window.psygil?.audit?.getTrail) {
          console.warn('window.psygil.audit.getTrail not available yet')
          setLoading(false)
          return
        }

        const response = (await window.psygil.audit.getTrail({ caseId })) as IpcResponse<{
          entries: readonly AuditEntry[]
          total: number
        }>

        if (response.status === 'success') {
          setEntries(response.data.entries as AuditEntry[])
        } else if (response.status === 'error') {
          setError((response as any).message || 'Failed to load audit trail')
        }
      } catch (err) {
        console.error('Error loading audit trail:', err)
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    loadAuditTrail()

    // Set up auto-refresh every 10 seconds
    const interval = setInterval(loadAuditTrail, 10000)
    return () => clearInterval(interval)
  }, [caseId])

  const getStatusColor = (status: string): string => {
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

  const getStatusLabel = (status: string): string => {
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
        return '#9c27b0'
      case 'system':
        return '#9e9e9e'
      default:
        return 'var(--text-secondary)'
    }
  }

  const getActorLabel = (actorType: string): string => {
    switch (actorType) {
      case 'clinician':
        return 'Clinician'
      case 'agent':
        return 'AI Agent'
      case 'system':
        return 'System'
      default:
        return 'Unknown'
    }
  }

  const handleExport = async (format: 'csv' | 'json') => {
    setIsExporting(format)
    try {
      if (!window.psygil?.audit?.export) {
        throw new Error('window.psygil.audit.export not available')
      }

      const response = (await window.psygil.audit.export({ caseId, format })) as IpcResponse<{
        data: string
        mimeType: string
      }>

      if (response.status === 'success') {
        const blob = new Blob([response.data.data], { type: response.data.mimeType })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `audit-trail-${caseId}.${format}`
        link.click()
        URL.revokeObjectURL(url)
      } else {
        setError((response as any).message || `Failed to export audit trail as ${format.toUpperCase()}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsExporting(null)
    }
  }

  const handleVerifyIntegrity = async () => {
    setIsVerifying(true)
    try {
      if (!window.psygil?.report?.verifyIntegrity) {
        throw new Error('window.psygil.report.verifyIntegrity not available')
      }

      const response = (await window.psygil.report.verifyIntegrity({ caseId })) as IpcResponse<{
        valid: boolean
        integrityHash: string
        expectedHash: string
      }>

      if (response.status === 'success') {
        setVerifyResult({
          valid: response.data.valid,
          message: response.data.valid
            ? 'Integrity verified: Audit trail has not been modified'
            : 'Integrity check failed: Audit trail may have been altered',
        })
      } else {
        setVerifyResult({
          valid: false,
          message: (response as any).message || 'Failed to verify integrity',
        })
      }
    } catch (err) {
      setVerifyResult({
        valid: false,
        message: err instanceof Error ? err.message : 'Unknown error',
      })
    } finally {
      setIsVerifying(false)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '20px 24px' }}>
        <h1>Audit Trail — Case #{caseId}</h1>
        <div
          style={{
            background: 'var(--highlight)',
            padding: '20px',
            borderRadius: '4px',
            textAlign: 'center',
            color: 'var(--text-secondary)',
          }}
        >
          Loading audit trail...
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '20px 24px' }}>
      <h1>Audit Trail — Case #{caseId}</h1>

      {/* ERROR BANNER */}
      {error && (
        <div
          style={{
            background: '#ffebee',
            color: '#c62828',
            padding: '12px',
            borderRadius: '4px',
            marginBottom: '20px',
            fontSize: '12px',
            border: '1px solid #ef5350',
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}

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
          This audit trail captures all actions taken on this case, including clinician decisions, AI agent operations, and system events. All timestamps are recorded. All PII operations are logged with operation references for audit purposes.
        </p>
      </div>

      {/* EMPTY STATE */}
      {entries.length === 0 ? (
        <div
          style={{
            background: 'var(--highlight)',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            padding: '24px',
            textAlign: 'center',
            color: 'var(--text-secondary)',
          }}
        >
          <p style={{ margin: '0 0 8px 0', fontSize: '13px' }}>
            No audit entries yet for this case.
          </p>
          <p style={{ margin: '0', fontSize: '12px' }}>
            Audit entries will appear here as the evaluation progresses through stages (Onboarding, Testing, Interview, Diagnostics, Review).
          </p>
        </div>
      ) : (
        <>
          {/* AUDIT TRAIL TABLE */}
          <div style={{ overflowX: 'auto', marginBottom: '20px' }}>
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
                    <td style={{ padding: '10px', color: getActorColor(entry.actorType), fontWeight: 500, fontSize: '12px' }}>
                      {entry.actorName || getActorLabel(entry.actorType)}
                    </td>

                    {/* Action + Details */}
                    <td style={{ padding: '10px', color: 'var(--text)' }}>
                      <div style={{ fontWeight: 500, marginBottom: '4px' }}>
                        {entry.actionType}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                        {entry.details}
                      </div>
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
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '12px',
              marginBottom: '20px',
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
              <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--accent)' }}>
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
              <div style={{ fontSize: '20px', fontWeight: 700, color: '#9c27b0' }}>
                {entries.filter((e) => e.actorType === 'agent').length}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                AI Agent Operations
              </div>
            </div>
          </div>
        </>
      )}

      {/* EXPORT/VERIFY BUTTONS */}
      <div style={{ marginTop: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <button
          disabled={isExporting === 'csv' || entries.length === 0}
          onClick={() => handleExport('csv')}
          style={{
            padding: '8px 16px',
            background: isExporting === 'csv' || entries.length === 0 ? 'var(--border)' : 'var(--accent)',
            color: isExporting === 'csv' || entries.length === 0 ? 'var(--text-secondary)' : 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: isExporting === 'csv' || entries.length === 0 ? 'not-allowed' : 'pointer',
            opacity: isExporting === 'csv' || entries.length === 0 ? 0.5 : 1,
          }}
        >
          {isExporting === 'csv' ? 'Exporting CSV...' : 'Export Audit Trail (CSV)'}
        </button>

        <button
          disabled={isExporting === 'json' || entries.length === 0}
          onClick={() => handleExport('json')}
          style={{
            padding: '8px 16px',
            background: 'var(--panel)',
            color: isExporting === 'json' || entries.length === 0 ? 'var(--text-secondary)' : 'var(--text)',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: 500,
            cursor: isExporting === 'json' || entries.length === 0 ? 'not-allowed' : 'pointer',
            opacity: isExporting === 'json' || entries.length === 0 ? 0.5 : 1,
          }}
        >
          {isExporting === 'json' ? 'Exporting JSON...' : 'Export Audit Trail (JSON)'}
        </button>

        <button
          disabled={isVerifying}
          onClick={handleVerifyIntegrity}
          style={{
            padding: '8px 16px',
            background: 'var(--panel)',
            color: isVerifying ? 'var(--text-secondary)' : 'var(--text)',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: 500,
            cursor: isVerifying ? 'not-allowed' : 'pointer',
            opacity: isVerifying ? 0.5 : 1,
          }}
        >
          {isVerifying ? 'Verifying...' : 'Verify Integrity'}
        </button>
      </div>

      {/* VERIFY RESULT */}
      {verifyResult && (
        <div
          style={{
            marginTop: '16px',
            padding: '12px',
            background: verifyResult.valid ? '#c8e6c9' : '#ffcdd2',
            color: verifyResult.valid ? '#1b5e20' : '#b71c1c',
            border: `1px solid ${verifyResult.valid ? '#4caf50' : '#f44336'}`,
            borderRadius: '4px',
            fontSize: '12px',
          }}
        >
          {verifyResult.valid ? '✓' : '✗'} {verifyResult.message}
        </div>
      )}

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
            <strong>Forensic Compliance:</strong> This audit trail satisfies forensic documentation requirements and supports discoverability in legal proceedings.
          </li>
          <li>
            <strong>Auto-Refresh:</strong> Audit entries update automatically every 10 seconds as the evaluation progresses.
          </li>
          <li>
            <strong>Agent Transparency:</strong> All AI agent operations are clearly marked and timestamped, with clinician actions separated for evidentiary clarity.
          </li>
          <li>
            <strong>Export & Verification:</strong> Export the audit trail as CSV or JSON for documentation. Verify integrity to confirm no unauthorized modifications.
          </li>
        </ul>
      </div>
    </div>
  )
}
