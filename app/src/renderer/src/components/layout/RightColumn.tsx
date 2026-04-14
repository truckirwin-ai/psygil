import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import type { Tab } from '../../types/ui'
import type { CaseRow, AgentStatusResult } from '../../../../shared/types/ipc'
import HSplitter from './HSplitter'

export interface RightColumnProps {
  readonly activeCaseId: number | null
  readonly onOpenTab: (tab: Tab) => void
  readonly onCycleTheme: () => void
  readonly cases: CaseRow[]
  readonly activeTabType: string | null
  readonly hideHeader?: boolean
}

interface AgentStatus {
  readonly ingestor: AgentStatusResult
  readonly diagnostician: AgentStatusResult
  readonly writer: AgentStatusResult
  readonly editor: AgentStatusResult
}

type AgentName = 'ingestor' | 'diagnostician' | 'writer' | 'editor'

/** Which prior agents must have results before this agent can run */
const AGENT_PREREQUISITES: Record<AgentName, AgentName[]> = {
  ingestor: [],
  diagnostician: ['ingestor'],
  writer: ['ingestor', 'diagnostician'],
  editor: ['ingestor', 'diagnostician', 'writer'],
}

export default function RightColumn({
  activeCaseId,
  onOpenTab,
  onCycleTheme,
  cases,
  activeTabType,
  hideHeader,
}: RightColumnProps): React.JSX.Element {
  const isDashboard = activeTabType === 'dashboard'
  // Split ratio: 0..1, proportion of space given to the upper context panel. Default 50/50.
  const [splitRatio, setSplitRatio] = useState(0.5)
  const columnRef = useRef<HTMLDivElement>(null)
  const [chatMessages, setChatMessages] = useState<
    Array<{ type: 'assistant' | 'user'; text: string }>
  >([{ type: 'assistant', text: 'How can I help with your evaluation? I can draft sections, suggest language, check citations, or review for Daubert compliance.' }])
  const [chatInput, setChatInput] = useState('')
  const [agentStatuses, setAgentStatuses] = useState<AgentStatus>({
    ingestor: { operationId: null, agentType: null, caseId: null, status: 'idle', elapsedMs: 0 },
    diagnostician: { operationId: null, agentType: null, caseId: null, status: 'idle', elapsedMs: 0 },
    writer: { operationId: null, agentType: null, caseId: null, status: 'idle', elapsedMs: 0 },
    editor: { operationId: null, agentType: null, caseId: null, status: 'idle', elapsedMs: 0 },
  })
  /** Tracks which agents have persisted results for the active case */
  const [agentResults, setAgentResults] = useState<Record<AgentName, boolean>>({
    ingestor: false,
    diagnostician: false,
    writer: false,
    editor: false,
  })
  /** Tracks which agent is currently being invoked (prevents double-click) */
  const [runningAgent, setRunningAgent] = useState<AgentName | null>(null)

  // -------------------------------------------------------------------------
  // Check which agents have persisted results for the active case
  // -------------------------------------------------------------------------

  const refreshAgentResults = useCallback(async () => {
    if (activeCaseId === null) {
      setAgentResults({ ingestor: false, diagnostician: false, writer: false, editor: false })
      return
    }
    try {
      const [ing, diag, wrt, edt] = await Promise.all([
        window.psygil.ingestor.getResult({ caseId: activeCaseId }),
        window.psygil.diagnostician.getResult({ caseId: activeCaseId }),
        window.psygil.writer.getResult({ caseId: activeCaseId }),
        window.psygil.editor.getResult({ caseId: activeCaseId }),
      ])
      setAgentResults({
        ingestor: ing.status === 'success',
        diagnostician: diag.status === 'success',
        writer: wrt.status === 'success',
        editor: edt.status === 'success',
      })
    } catch {
      // Swallow, results just stay false
    }
  }, [activeCaseId])

  // Re-check results whenever the active case changes
  useEffect(() => {
    refreshAgentResults()
  }, [refreshAgentResults])

  const handleResize = useCallback((delta: number) => {
    const container = columnRef.current
    if (!container) return
    const totalHeight = container.clientHeight
    if (totalHeight <= 0) return
    setSplitRatio((prev) => {
      const newRatio = prev + delta / totalHeight
      return Math.max(0.15, Math.min(0.85, newRatio))
    })
  }, [])

  // Build a summary of all cases for the Admin Assistant context
  const casesSummary = useMemo(() => {
    if (!cases.length) return 'No cases in the system.'
    const stageCounts: Record<string, number> = {}
    const typeCounts: Record<string, number> = {}
    const lines: string[] = []
    for (const c of cases) {
      const stage = c.workflow_current_stage ?? 'onboarding'
      stageCounts[stage] = (stageCounts[stage] ?? 0) + 1
      const etype = c.evaluation_type ?? 'Untyped'
      typeCounts[etype] = (typeCounts[etype] ?? 0) + 1
      const name = `${c.examinee_last_name ?? '?'}, ${(c.examinee_first_name ?? '?').charAt(0)}.`
      const created = c.created_at ? c.created_at.split('T')[0] : ','
      lines.push(`- Case ${c.case_number}: ${name} | Type: ${etype} | Stage: ${stage} | Created: ${created}`)
    }
    const overview = [
      `Total cases: ${cases.length}`,
      `By stage: ${Object.entries(stageCounts).map(([s, n]) => `${s} (${n})`).join(', ')}`,
      `By type: ${Object.entries(typeCounts).map(([t, n]) => `${t} (${n})`).join(', ')}`,
      '',
      'Case list:',
      ...lines,
    ]
    return overview.join('\n')
  }, [cases])

  const adminSystemPrompt = useMemo(() => [
    'You are the Admin Assistant for Psygil, a forensic psychology practice management platform.',
    'You have read access to all case files in the system. Use the case data below to answer questions about caseload, scheduling, priorities, and analytics.',
    '',
    'CAPABILITIES:',
    '- Caseload analysis: which cases need attention, overdue items, bottlenecks',
    '- Schedule guidance: what to focus on this week (testing, interviews, report writing)',
    '- Pipeline analytics: stage distribution, throughput, average time per stage',
    '- Case prioritization: urgency based on deadlines, stage, and evaluation type',
    '- Practice metrics: case volume, completion rates, type distribution',
    '',
    'RULES:',
    '- Be concise and actionable. Use bullet points.',
    '- When recommending priorities, explain the reasoning.',
    '- Reference specific cases by name and case number.',
    '- Today\'s date is ' + new Date().toISOString().split('T')[0],
    '',
    '=== CURRENT CASELOAD ===',
    casesSummary,
  ].join('\n'), [casesSummary])

  const writingSystemPrompt = 'You are a writing assistant for forensic psychology evaluation reports. Help draft sections, check citations, suggest language, and review for Daubert compliance. Provide concise, professional responses.'

  const adminWelcome = 'Good morning. I have access to your full caseload. Ask me which cases need attention, what to focus on this week, or for practice analytics.'
  const writingWelcome = 'How can I help with your evaluation? I can draft sections, suggest language, check citations, or review for Daubert compliance.'

  const assistantLabel = isDashboard ? 'ADMIN ASSISTANT' : 'WRITING ASSISTANT'
  const assistantPlaceholder = isDashboard
    ? 'e.g. "Which cases need attention?" or "What should I focus on this week?"'
    : 'Ask the writing assistant...'

  const handleClearChat = useCallback(() => {
    setChatMessages([
      {
        type: 'assistant',
        text: isDashboard ? adminWelcome : writingWelcome,
      },
    ])
  }, [isDashboard])

  const handleSendChat = useCallback(async () => {
    if (!chatInput.trim()) return

    const userMessage = chatInput.trim()
    setChatInput('')
    setChatMessages((prev) => [...prev, { type: 'user', text: userMessage }])

    try {
      const systemPrompt = isDashboard ? adminSystemPrompt : writingSystemPrompt

      const response = await window.psygil.ai.complete({
        systemPrompt,
        userMessage,
      })

      if (response.status === 'success') {
        setChatMessages((prev) => [...prev, { type: 'assistant', text: response.data.content }])
      } else {
        setChatMessages((prev) => [
          ...prev,
          { type: 'assistant', text: `Error: ${response.message}` },
        ])
      }
    } catch {
      setChatMessages((prev) => [
        ...prev,
        {
          type: 'assistant',
          text: 'Error communicating with AI. Check your API key configuration in Settings.',
        },
      ])
    }
  }, [chatInput, isDashboard, adminSystemPrompt])

  // Poll agent status every 2 seconds
  useEffect(() => {
    const pollInterval = setInterval(async () => {
      try {
        const resp = await window.psygil.agent.status()
        if (resp.status === 'success') {
          const s = resp.data
          // Map the global status to the correct agent slot
          if (s.agentType) {
            setAgentStatuses((prev) => ({ ...prev, [s.agentType as AgentName]: s }))
          }
          // If it just finished, refresh persisted results
          if (s.status === 'done' || s.status === 'error') {
            setRunningAgent(null)
            refreshAgentResults()
          } else if (s.status === 'running' || s.status === 'queued') {
            setRunningAgent((s.agentType as AgentName) ?? null)
          } else {
            setRunningAgent(null)
          }
        }
      } catch {
        // Swallow polling errors
      }
    }, 2000)

    return () => clearInterval(pollInterval)
  }, [refreshAgentResults])

  // -------------------------------------------------------------------------
  // Generic agent runner, cascade-aware
  // -------------------------------------------------------------------------

  const handleRunAgent = useCallback(async (agent: AgentName) => {
    if (activeCaseId === null) return

    // Check prerequisites
    const prereqs = AGENT_PREREQUISITES[agent]
    for (const prereq of prereqs) {
      if (!agentResults[prereq]) {
        console.warn(`Cannot run ${agent}: prerequisite ${prereq} has no results`)
        return
      }
    }

    setRunningAgent(agent)
    try {
      let response: { status: string; message?: string }
      switch (agent) {
        case 'ingestor':
          response = await window.psygil.ingestor.run({ caseId: activeCaseId })
          break
        case 'diagnostician':
          response = await window.psygil.diagnostician.run({ caseId: activeCaseId })
          break
        case 'writer':
          response = await window.psygil.writer.run({ caseId: activeCaseId })
          break
        case 'editor':
          response = await window.psygil.editor.run({ caseId: activeCaseId })
          break
      }
      if (response.status === 'error') {
        console.error(`${agent} run failed:`, (response as { message?: string }).message)
      }
      // Result polling will pick up completion and refresh
    } catch (error) {
      console.error(`Failed to run ${agent}:`, error)
      setRunningAgent(null)
    }
  }, [activeCaseId, agentResults])

  return (
    <div
      ref={columnRef}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--bg)',
        overflow: 'hidden',
      }}
    >
      {/* Context panel, upper, uses splitRatio of available space */}
      <div
        style={{
          flex: `${splitRatio} 0 0`,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          minHeight: 0,
        }}
      >
        {!hideHeader && (
          <div className="panel-header" style={{ justifyContent: 'flex-end', gap: 10 }}>
            <button
              aria-label="Settings"
              style={{
                width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer',
                fontSize: 18, padding: 0,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)' }}
            >
              &#9881;
            </button>
            <button
              aria-label="Theme"
              onClick={onCycleTheme}
              style={{
                width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer',
                fontSize: 18, padding: 0,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)' }}
            >
              &#9728;
            </button>
            <div style={{
              width: 24, height: 24, borderRadius: '50%', background: 'var(--accent)',
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 600, flexShrink: 0,
            }}>
              TI
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
              Dr. Irwin
            </span>
          </div>
        )}
        <div style={{ flex: 1, overflowY: 'auto', padding: 0 }}>
          {/* Case Notes */}
          <ContextSection title="Case Notes">
            {activeCaseId !== null ? (
              <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }}>
                <p style={{ marginBottom: 6, fontSize: 12 }}>
                  <strong>Session 1 (Mar 8):</strong> Initial interview, 2.5 hrs. Patient reported
                  persecutory concerns, mild disorganization.
                </p>
                <p style={{ marginBottom: 6, fontSize: 12 }}>
                  <strong>Session 2 (Mar 10):</strong> Psychological testing (MMPI-3, PAI). Patient
                  cooperative.
                </p>
                <p style={{ marginBottom: 6, fontSize: 12 }}>
                  <strong>Session 3 (Mar 12):</strong> Cognitive testing (WAIS-V, TOMM, SIRS-2).
                  Effort adequate.
                </p>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                No case selected
              </div>
            )}
          </ContextSection>

          {/* AI Agent Status */}
          <ContextSection title="AI Agent Status">
            <AgentStatusPanel
              agentStatuses={agentStatuses}
              agentResults={agentResults}
              runningAgent={runningAgent}
              activeCaseId={activeCaseId}
              onRunAgent={handleRunAgent}
            />
          </ContextSection>

          {/* Deadlines */}
          <ContextSection title="Deadlines">
            {activeCaseId !== null ? (
              <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }}>
                <p style={{ marginBottom: 6, fontSize: 12 }}>
                  <strong>Court Deadline:</strong> Apr 15, 2026 (26 days)
                </p>
                <p style={{ marginBottom: 6, fontSize: 12 }}>
                  <strong>Next Action:</strong> Complete Diagnostics, clinical formulation
                </p>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                No active deadlines
              </div>
            )}
          </ContextSection>

          {/* Quick Actions */}
          <ContextSection title="Quick Actions">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button
                onClick={() =>
                  onOpenTab({
                    id: `report:${activeCaseId ?? 0}`,
                    title: 'Evaluation Report',
                    type: 'report',
                    caseId: activeCaseId ?? undefined,
                  })
                }
                style={{
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: 500,
                  border: 'none',
                  borderRadius: 4,
                  background: 'var(--accent)',
                  color: '#ffffff',
                  cursor: 'pointer',
                }}
              >
                Open Evaluation Report
              </button>
              <button
                onClick={() =>
                  onOpenTab({
                    id: `diagnostics:${activeCaseId ?? 0}`,
                    title: 'Diagnostics',
                    type: 'diagnostics',
                    caseId: activeCaseId ?? undefined,
                  })
                }
                style={{
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: 500,
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  background: 'var(--panel)',
                  color: 'var(--text)',
                  cursor: 'pointer',
                }}
              >
                Go to Diagnostics
              </button>
            </div>
          </ContextSection>
        </div>
      </div>

      {/* Horizontal splitter */}
      <HSplitter onResize={handleResize} />

      {/* Admin / Writing Assistant, lower, uses remaining space */}
      <div
        style={{
          flex: `${1 - splitRatio} 0 0`,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          minHeight: 0,
        }}
      >
        <div
          className="panel-header"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{assistantLabel}</span>
          <button
            onClick={handleClearChat}
            className="panel-hdr-btn"
            aria-label="Clear chat"
            style={{
              width: 20,
              height: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 3,
              cursor: 'pointer',
              fontSize: 13,
              color: 'var(--text-secondary)',
              border: 'none',
              background: 'none',
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            ✕
          </button>
        </div>

        {/* Chat messages area */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '8px 10px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {chatMessages.map((msg, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                justifyContent: msg.type === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              <div
                style={{
                  maxWidth: '88%',
                  padding: '8px 10px',
                  fontSize: 12,
                  lineHeight: 1.5,
                  borderRadius: '8px',
                  background:
                    msg.type === 'assistant' ? 'var(--panel)' : 'var(--accent)',
                  color: msg.type === 'assistant' ? 'var(--text)' : '#ffffff',
                  borderBottomLeftRadius: msg.type === 'user' ? '8px' : '2px',
                  borderBottomRightRadius: msg.type === 'assistant' ? '8px' : '2px',
                }}
              >
                {msg.text}
              </div>
            </div>
          ))}
        </div>

        {/* Input area */}
        <div
          style={{
            padding: '8px 10px',
            borderTop: '1px solid var(--border)',
            background: 'var(--panel)',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 4,
            }}
          >
            <span
              style={{
                fontSize: 10,
                textTransform: 'uppercase',
                color: 'var(--text-secondary)',
                letterSpacing: 0.5,
                fontWeight: 600,
              }}
            >
              {isDashboard ? 'Admin Assistant' : 'Writing Assistant'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
            <textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSendChat()
                }
              }}
              placeholder={assistantPlaceholder}
              rows={3}
              style={{
                flex: 1,
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                padding: '6px 10px',
                fontSize: 12,
                color: 'var(--text)',
                resize: 'none',
                fontFamily: 'inherit',
                outline: 'none',
                lineHeight: 1.5,
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent)'
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)'
              }}
            />
            <button
              onClick={handleSendChat}
              aria-label="Send"
              style={{
                width: 32,
                height: 32,
                background: 'var(--accent)',
                color: '#ffffff',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 14,
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ➤
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ContextSection({
  title,
  children,
}: {
  readonly title: string
  readonly children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="context-section">
      <div className="context-title">{title}</div>
      <div className="context-content">{children}</div>
    </div>
  )
}

function getStatusColor(status: AgentStatusResult['status']): string {
  switch (status) {
    case 'idle':
    case 'done':
      return '#4caf50' // green
    case 'queued':
      return '#9e9e9e' // gray
    case 'running':
      return '#ff9800' // orange
    case 'error':
      return '#f44336' // red
    default:
      return '#9e9e9e'
  }
}

function formatElapsedTime(elapsedMs: number): string {
  const seconds = Math.floor(elapsedMs / 1000)
  return `${seconds}s`
}

const AGENT_LABELS: Record<AgentName, string> = {
  ingestor: 'Ingestor',
  diagnostician: 'Diagnostician',
  writer: 'Writer',
  editor: 'Editor',
}

const AGENT_ORDER: AgentName[] = ['ingestor', 'diagnostician', 'writer', 'editor']

function AgentStatusPanel({
  agentStatuses,
  agentResults,
  runningAgent,
  activeCaseId,
  onRunAgent,
}: {
  readonly agentStatuses: AgentStatus
  readonly agentResults: Record<AgentName, boolean>
  readonly runningAgent: AgentName | null
  readonly activeCaseId: number | null
  readonly onRunAgent: (agent: AgentName) => void
}): React.JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {AGENT_ORDER.map((agent) => {
        const prereqs = AGENT_PREREQUISITES[agent]
        const prereqsMet = prereqs.every((p) => agentResults[p])
        const hasResult = agentResults[agent]
        const isThisRunning = runningAgent === agent
        const anyRunning = runningAgent !== null
        const canRun = activeCaseId !== null && prereqsMet && !anyRunning
        const status = agentStatuses[agent]

        return (
          <div key={agent} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <AgentStatusRow
              name={AGENT_LABELS[agent]}
              agentStatus={status}
              hasResult={hasResult}
            />
            <button
              onClick={() => onRunAgent(agent)}
              disabled={!canRun}
              title={
                activeCaseId === null
                  ? 'Select a case first'
                  : anyRunning
                    ? `Waiting for ${AGENT_LABELS[runningAgent!]} to finish`
                    : !prereqsMet
                      ? `Requires: ${prereqs.map((p) => AGENT_LABELS[p]).join(', ')}`
                      : hasResult
                        ? `Re-run ${AGENT_LABELS[agent]}`
                        : `Run ${AGENT_LABELS[agent]}`
              }
              style={{
                padding: '4px 10px',
                fontSize: 11,
                fontWeight: 500,
                border: '1px solid var(--border)',
                borderRadius: 4,
                background: canRun ? 'var(--accent)' : 'var(--panel)',
                color: canRun ? '#ffffff' : 'var(--text-secondary)',
                cursor: canRun ? 'pointer' : 'not-allowed',
                opacity: canRun ? 1 : 0.5,
                transition: 'all 0.2s',
                marginLeft: 14,
              }}
            >
              {isThisRunning
                ? 'Running\u2026'
                : hasResult
                  ? `Re-run ${AGENT_LABELS[agent]}`
                  : `Run ${AGENT_LABELS[agent]}`}
            </button>
          </div>
        )
      })}
    </div>
  )
}

function AgentStatusRow({
  name,
  agentStatus,
  hasResult,
}: {
  readonly name: string
  readonly agentStatus: AgentStatusResult
  readonly hasResult: boolean
}): React.JSX.Element {
  // If the agent has a persisted result but status is idle, show as "complete"
  const effectiveStatus = hasResult && agentStatus.status === 'idle' ? 'done' : agentStatus.status
  const color = getStatusColor(effectiveStatus)
  const statusText = effectiveStatus.charAt(0).toUpperCase() + effectiveStatus.slice(1)
  const elapsedTime = formatElapsedTime(agentStatus.elapsedMs)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, marginBottom: 2 }}>
      {/* Status dot */}
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: color,
          display: 'inline-block',
          flexShrink: 0,
        }}
      />
      {/* Agent name */}
      <span style={{ color: 'var(--text)', flex: 1, minWidth: 0 }}>{name}</span>
      {/* Status details, right-aligned */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-secondary)' }}>
        {agentStatus.status === 'running' && (
          <span>{elapsedTime}</span>
        )}
        {agentStatus.status === 'done' && agentStatus.tokenUsage && (
          <span>
            {agentStatus.tokenUsage.input}↓ {agentStatus.tokenUsage.output}↑
          </span>
        )}
        {agentStatus.status === 'error' && agentStatus.operationId && (
          <span style={{ color: '#f44336' }} title="Error">
            Error
          </span>
        )}
        <span>{statusText}</span>
      </div>
    </div>
  )
}
