import { useState, useMemo } from 'react'
import { CaseRow } from '../../../../shared/types/ipc'

interface DashboardTabProps {
  cases: CaseRow[]
  onCaseClick: (caseId: number) => void
}

const STAGE_COLORS: Record<string, string> = {
  onboarding: '#2196f3',
  testing: '#9c27b0',
  interview: '#e91e63',
  diagnostics: '#ff9800',
  review: '#ff5722',
  complete: '#4caf50',
}

const SEVERITY_COLORS: Record<string, string> = {
  Low: '#4caf50',
  Moderate: '#ff9800',
  High: '#f44336',
  'Very High': '#9c27b0',
}

const EVAL_TYPE_COLORS: Record<string, string> = {
  CST: '#2196f3',
  Custody: '#9c27b0',
  Risk: '#f44336',
  'PTSD Dx': '#ff9800',
  'ADHD Dx': '#4caf50',
  Malingering: '#795548',
  Fitness: '#607d8b',
  Capacity: '#00bcd4',
}

const PIPELINE_STAGES = [
  { key: 'onboarding', label: 'Onboarding' },
  { key: 'testing', label: 'Testing' },
  { key: 'interview', label: 'Interview' },
  { key: 'diagnostics', label: 'Diagnostics' },
  { key: 'review', label: 'Review' },
  { key: 'complete', label: 'Complete' },
]

// Helper to map workflow_current_stage to stage string
function mapStageToKey(stage: string | null): string {
  if (!stage) return 'onboarding'
  const s = stage.toLowerCase()
  if (s.includes('onboard')) return 'onboarding'
  if (s.includes('test')) return 'testing'
  if (s.includes('interview')) return 'interview'
  if (s.includes('diagnos')) return 'diagnostics'
  if (s.includes('review')) return 'review'
  if (s.includes('complete')) return 'complete'
  return 'onboarding'
}

// Helper to map case_status to readable status string
function mapCaseStatus(status: string | null): string {
  if (!status) return 'Onboarding'
  const s = status.toLowerCase()
  if (s.includes('onboard')) return 'Onboarding'
  if (s.includes('test')) return 'Testing'
  if (s.includes('interview')) return 'Interview'
  if (s.includes('diagnos')) return 'Diagnostics'
  if (s.includes('review')) return 'Review'
  if (s.includes('complete')) return 'Complete'
  if (s.includes('archived')) return 'Archived'
  return 'Onboarding'
}

function mapSeverity(severity: string | null): string {
  if (!severity) return 'Moderate'
  const s = severity.toLowerCase()
  if (s === 'low') return 'Low'
  if (s === 'moderate') return 'Moderate'
  if (s === 'high') return 'High'
  if (s === 'very high' || s === 'veryhigh') return 'Very High'
  return 'Moderate'
}

export default function DashboardTab({ cases, onCaseClick }: DashboardTabProps) {
  const [filterType, setFilterType] = useState('All')
  const [filterStatus, setFilterStatus] = useState('All')
  const [filterSeverity, setFilterSeverity] = useState('All')
  const [searchText, setSearchText] = useState('')

  // Compute KPI stats
  const stats = useMemo(() => {
    const stageCounts = {
      onboarding: 0,
      testing: 0,
      interview: 0,
      diagnostics: 0,
      review: 0,
      complete: 0,
    }

    let activeCount = 0
    let completedCount = 0
    let highSeverityCount = 0
    let totalHours = 0
    let hoursCount = 0

    cases.forEach((c) => {
      // Pipeline stage counts
      const stage = mapStageToKey(c.workflow_current_stage)
      stageCounts[stage as keyof typeof stageCounts]++

      // Active = not complete/archived
      const status = mapCaseStatus(c.case_status)
      if (status !== 'Complete' && status !== 'Archived') {
        activeCount++
      }
      if (status === 'Complete') {
        completedCount++
      }

      // High severity
      const sev = mapSeverity(c.case_status)
      if (sev === 'High' || sev === 'Very High') {
        highSeverityCount++
      }
    })

    const avgHours = hoursCount > 0 ? (totalHours / hoursCount).toFixed(1) : '0.0'

    return {
      active: activeCount,
      completed: completedCount,
      highSeverity: highSeverityCount,
      avgHours,
      stageCounts,
    }
  }, [cases])

  // Compute evaluation type breakdown
  const evalTypeStats = useMemo(() => {
    const counts: Record<string, number> = {}
    cases.forEach((c) => {
      const type = c.evaluation_type || 'Unknown'
      counts[type] = (counts[type] || 0) + 1
    })
    return counts
  }, [cases])

  // Compute severity breakdown
  const severityStats = useMemo(() => {
    const counts = { 'Very High': 0, High: 0, Moderate: 0, Low: 0 }
    cases.forEach((c) => {
      const sev = mapSeverity(c.case_status)
      counts[sev as keyof typeof counts]++
    })
    return counts
  }, [cases])

  // Get upcoming deadlines (within 30 days)
  const upcomingDeadlines = useMemo(() => {
    const now = new Date()
    return cases
      .filter((c) => {
        const status = mapCaseStatus(c.case_status)
        if (status === 'Complete' || status === 'Archived') return false
        if (!c.completed_at) {
          const deadline = c.created_at ? new Date(c.created_at) : now
          const diffDays = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          return diffDays >= 0 && diffDays <= 30
        }
        return false
      })
      .sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at) : new Date()
        const dateB = b.created_at ? new Date(b.created_at) : new Date()
        return dateA.getTime() - dateB.getTime()
      })
      .slice(0, 8)
  }, [cases])

  // Filter cases
  const filteredCases = useMemo(() => {
    let result = [...cases]

    if (filterType !== 'All') {
      result = result.filter((c) => c.evaluation_type === filterType)
    }

    if (filterStatus !== 'All') {
      result = result.filter((c) => mapCaseStatus(c.case_status) === filterStatus)
    }

    if (filterSeverity !== 'All') {
      result = result.filter((c) => mapSeverity(c.case_status) === filterSeverity)
    }

    if (searchText) {
      const q = searchText.toLowerCase()
      result = result.filter((c) => {
        const name = `${c.examinee_last_name} ${c.examinee_first_name}`.toLowerCase()
        const caseNum = c.case_number.toLowerCase()
        const evalType = (c.evaluation_type || '').toLowerCase()
        return name.includes(q) || caseNum.includes(q) || evalType.includes(q)
      })
    }

    // Sort by referral date (newest first)
    result.sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0
      return dateB - dateA
    })

    return result
  }, [cases, filterType, filterStatus, filterSeverity, searchText])

  // Get unique eval types for filter
  const evalTypes = useMemo(() => {
    return Array.from(new Set(cases.map((c) => c.evaluation_type).filter(Boolean)))
      .sort() as string[]
  }, [cases])

  const maxSeverity = Math.max(...Object.values(severityStats))

  return (
    <div style={{ padding: '16px', fontSize: '13px', overflow: 'auto', height: '100%' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
        }}
      >
        <h1 style={{ fontSize: '18px', margin: 0, fontWeight: 600 }}>Practice Dashboard</h1>
        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
          As of March 29, 2026 · {cases.length} total cases
        </span>
      </div>

      {/* KPI Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '12px' }}>
        <KpiCard title="Active Cases" value={stats.active} color="var(--accent)" subtitle="in progress" />
        <KpiCard title="Completed" value={stats.completed} color="#4caf50" subtitle="reports filed" />
        <KpiCard title="High Severity" value={stats.highSeverity} color="#f44336" subtitle="high + very high" />
        <KpiCard title="Avg Hours" value={stats.avgHours} color="var(--text)" subtitle="per evaluation" />
      </div>

      {/* Pipeline Breakdown Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px', marginBottom: '20px' }}>
        {PIPELINE_STAGES.map((stage) => (
          <div
            key={stage.key}
            style={{
              background: 'var(--panel)',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              padding: '8px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: '20px',
                fontWeight: 700,
                color: STAGE_COLORS[stage.key],
              }}
            >
              {stats.stageCounts[stage.key as keyof typeof stats.stageCounts]}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{stage.label}</div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
        {/* Severity Breakdown */}
        <div
          style={{
            background: 'var(--panel)',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            padding: '12px',
          }}
        >
          <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Severity Breakdown</div>
          <div style={{ paddingTop: '8px' }}>
            {['Very High', 'High', 'Moderate', 'Low'].map((sev) => {
              const count = severityStats[sev as keyof typeof severityStats]
              const pct = maxSeverity > 0 ? (count / maxSeverity) * 100 : 0
              const color = SEVERITY_COLORS[sev] || '#999'
              return (
                <div key={sev} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '11px', minWidth: '64px', color: 'var(--text-secondary)' }}>
                    {sev}
                  </span>
                  <div
                    style={{
                      flex: 1,
                      height: '16px',
                      background: 'var(--bg)',
                      borderRadius: '3px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${pct}%`,
                        height: '100%',
                        background: color,
                        borderRadius: '3px',
                        transition: 'width 0.3s',
                      }}
                    />
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 600, minWidth: '20px', textAlign: 'right' }}>
                    {count}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Cases by Type */}
        <div
          style={{
            background: 'var(--panel)',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            padding: '12px',
          }}
        >
          <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Cases by Type</div>
          <div style={{ paddingTop: '8px' }}>
            {Object.entries(evalTypeStats)
              .sort((a, b) => b[1] - a[1])
              .map(([type, count]) => (
                <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <span
                    style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: EVAL_TYPE_COLORS[type] || '#999',
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: '12px', flex: 1 }}>{type}</span>
                  <span style={{ fontSize: '12px', fontWeight: 600 }}>{count}</span>
                </div>
              ))}
          </div>
        </div>

        {/* Upcoming Deadlines */}
        <div
          style={{
            background: 'var(--panel)',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            padding: '12px',
          }}
        >
          <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Upcoming Deadlines</div>
          <div
            style={{
              paddingTop: '4px',
              maxHeight: '160px',
              overflowY: 'auto',
              fontSize: '12px',
            }}
          >
            {upcomingDeadlines.length > 0 ? (
              upcomingDeadlines.map((c, idx) => {
                const deadline = c.created_at ? new Date(c.created_at) : new Date()
                const now = new Date()
                const days = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                const isUrgent = days <= 7
                return (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '4px 0',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    <span>
                      {c.examinee_last_name}, {c.examinee_first_name} — {c.evaluation_type}
                    </span>
                    <span
                      style={{
                        fontWeight: 600,
                        color: isUrgent ? '#f44336' : 'var(--text-secondary)',
                      }}
                    >
                      {days}d
                    </span>
                  </div>
                )
              })
            ) : (
              <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>No upcoming deadlines</div>
            )}
          </div>
        </div>
      </div>

      {/* Filter Controls */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
          marginBottom: '12px',
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          Filter:
        </span>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          style={{
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            padding: '4px 8px',
            fontSize: '12px',
            color: 'var(--text)',
            fontFamily: 'inherit',
          }}
        >
          <option value="All">Type: All</option>
          {evalTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            padding: '4px 8px',
            fontSize: '12px',
            color: 'var(--text)',
            fontFamily: 'inherit',
          }}
        >
          <option value="All">Status: All</option>
          {['Onboarding', 'Testing', 'Interview', 'Diagnostics', 'Review', 'Complete'].map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>

        <select
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value)}
          style={{
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            padding: '4px 8px',
            fontSize: '12px',
            color: 'var(--text)',
            fontFamily: 'inherit',
          }}
        >
          <option value="All">Severity: All</option>
          {['Low', 'Moderate', 'High', 'Very High'].map((sev) => (
            <option key={sev} value={sev}>
              {sev}
            </option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Search name, case #, diagnosis..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            padding: '4px 8px',
            fontSize: '12px',
            color: 'var(--text)',
            fontFamily: 'inherit',
            width: '220px',
          }}
        />

        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginLeft: 'auto' }}>
          {filteredCases.length} of {cases.length} cases
        </span>
      </div>

      {/* Case Table */}
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          marginBottom: '16px',
          fontSize: '12px',
        }}
      >
        <thead>
          <tr>
            <th
              style={{
                background: 'var(--panel)',
                padding: '6px 10px',
                textAlign: 'left',
                fontWeight: 600,
                border: '1px solid var(--border)',
              }}
            >
              Case #
            </th>
            <th
              style={{
                background: 'var(--panel)',
                padding: '6px 10px',
                textAlign: 'left',
                fontWeight: 600,
                border: '1px solid var(--border)',
              }}
            >
              Client
            </th>
            <th
              style={{
                background: 'var(--panel)',
                padding: '6px 10px',
                textAlign: 'left',
                fontWeight: 600,
                border: '1px solid var(--border)',
              }}
            >
              Type
            </th>
            <th
              style={{
                background: 'var(--panel)',
                padding: '6px 10px',
                textAlign: 'left',
                fontWeight: 600,
                border: '1px solid var(--border)',
              }}
            >
              Severity
            </th>
            <th
              style={{
                background: 'var(--panel)',
                padding: '6px 10px',
                textAlign: 'left',
                fontWeight: 600,
                border: '1px solid var(--border)',
              }}
            >
              Deadline
            </th>
            <th
              style={{
                background: 'var(--panel)',
                padding: '6px 10px',
                textAlign: 'left',
                fontWeight: 600,
                border: '1px solid var(--border)',
              }}
            >
              Status
            </th>
            <th
              style={{
                background: 'var(--panel)',
                padding: '6px 10px',
                textAlign: 'left',
                fontWeight: 600,
                border: '1px solid var(--border)',
              }}
            >
              Diagnosis
            </th>
          </tr>
        </thead>
        <tbody>
          {filteredCases.map((c, idx) => {
            const name = `${c.examinee_last_name}, ${c.examinee_first_name}`
            const status = mapCaseStatus(c.case_status)
            const severity = mapSeverity(c.case_status)
            const sevColor = SEVERITY_COLORS[severity] || '#999'
            const statColor = STAGE_COLORS[mapStageToKey(c.workflow_current_stage)] || '#999'

            const now = new Date()
            const deadline = c.created_at ? new Date(c.created_at) : now
            const isOverdue = status !== 'Complete' && status !== 'Archived' && deadline < now
            const deadlineStr = deadline.toISOString().split('T')[0]

            return (
              <tr
                key={idx}
                style={{
                  cursor: 'pointer',
                  background: idx % 2 === 0 ? 'transparent' : 'var(--highlight)',
                }}
                onClick={() => onCaseClick(c.case_id)}
              >
                <td style={{ padding: '6px 10px', border: '1px solid var(--border)' }}>
                  #{c.case_number}
                </td>
                <td style={{ padding: '6px 10px', border: '1px solid var(--border)', fontWeight: 500 }}>
                  {name}
                </td>
                <td style={{ padding: '6px 10px', border: '1px solid var(--border)' }}>
                  {c.evaluation_type || '—'}
                </td>
                <td style={{ padding: '6px 10px', border: '1px solid var(--border)' }}>
                  <span
                    style={{
                      background: sevColor,
                      color: '#fff',
                      padding: '1px 6px',
                      borderRadius: '3px',
                      fontSize: '11px',
                    }}
                  >
                    {severity}
                  </span>
                </td>
                <td
                  style={{
                    padding: '6px 10px',
                    border: '1px solid var(--border)',
                    color: isOverdue ? '#f44336' : 'inherit',
                    fontWeight: isOverdue ? 600 : 'normal',
                  }}
                >
                  {isOverdue ? '⚠ ' : ''}{deadlineStr}
                </td>
                <td style={{ padding: '6px 10px', border: '1px solid var(--border)' }}>
                  <span
                    style={{
                      background: statColor,
                      color: '#fff',
                      padding: '2px 8px',
                      borderRadius: '3px',
                      fontSize: '11px',
                    }}
                  >
                    {status}
                  </span>
                </td>
                <td
                  style={{
                    padding: '6px 10px',
                    border: '1px solid var(--border)',
                    fontSize: '11px',
                    color: 'var(--text-secondary)',
                  }}
                >
                  —
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// Helper component for KPI cards
function KpiCard({
  title,
  value,
  color,
  subtitle,
}: {
  title: string
  value: number | string
  color: string
  subtitle: string
}) {
  return (
    <div
      style={{
        background: 'var(--panel)',
        border: '1px solid var(--border)',
        borderRadius: '4px',
        padding: '12px',
      }}
    >
      <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-secondary)' }}>
        {title}
      </div>
      <div style={{ fontSize: '26px', fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{subtitle}</div>
    </div>
  )
}
