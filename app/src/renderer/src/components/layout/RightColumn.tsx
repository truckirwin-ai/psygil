import { useState, useCallback, useEffect } from 'react'
import type { Tab } from '../../types/ui'
import type { AgentStatusResult } from '../../../../shared/types/ipc'
import HSplitter from './HSplitter'

export interface RightColumnProps {
  readonly activeCaseId: number | null
  readonly onOpenTab: (tab: Tab) => void
}

interface AgentStatus {
  readonly ingestor: AgentStatusResult
  readonly diagnostician: AgentStatusResult
  readonly writer: AgentStatusResult
  readonly editor: AgentStatusResult
}

export default function RightColumn({
  activeCaseId,
  onOpenTab,
}: RightColumnProps): React.JSX.Element {
  const [contextHeight, setContextHeight] = useState<number | null>(null)
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
  const [isRunningIngestor, setIsRunningIngestor] = useState(false)

  const handleResize = useCallback((delta: number) => {
    setContextHeight((prev) => {
      const current = prev ?? 280
      return Math.max(100, current + delta)
    })
  }, [])

  const handleClearChat = useCallback(() => {
    setChatMessages([
      {
        type: 'assistant',
        text: 'How can I help with your evaluation? I can draft sections, suggest language, check citations, or review for Daubert compliance.',
      },
    ])
  }, [])

  const handleSendChat = useCallback(async () => {
    if (!chatInput.trim()) return

    const userMessage = chatInput.trim()
    setChatInput('')
    setChatMessages((prev) => [...prev, { type: 'user', text: userMessage }])

    try {
      const response = await window.psygil.ai.complete({
        systemPrompt: 'You are a writing assistant for forensic psychology evaluation reports. Help draft sections, check citations, suggest language, and review for Daubert compliance. Provide concise, professional responses.',
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
    } catch (error) {
      setChatMessages((prev) => [
        ...prev,
        {
          type: 'assistant',
          text: 'Error communicating with AI. Check your API key configuration in Settings.',
        },
      ])
    }
  }, [chatInput])

  // Poll agent status every 2 seconds
  useEffect(() => {
    const pollInterval = setInterval(async () => {
      try {
        const ingestorResp = await window.psygil.agent.status()
        if (ingestorResp.status === 'success') {
          const ingestorStatus = ingestorResp.data
          setAgentStatuses((prev) => ({
            ...prev,
            ingestor: ingestorStatus,
          }))
          setIsRunningIngestor(ingestorStatus.status === 'running' || ingestorStatus.status === 'queued')
        }
      } catch (error) {
        console.error('Failed to poll agent status:', error)
      }
    }, 2000)

    return () => clearInterval(pollInterval)
  }, [])

  const handleRunIngestor = useCallback(async () => {
    if (activeCaseId === null) return

    try {
      setIsRunningIngestor(true)
      const response = await window.psygil.ingestor.run({ caseId: activeCaseId })
      if (response.status === 'error') {
        console.error('Ingestor run failed:', response.message)
      }
    } catch (error) {
      console.error('Failed to run ingestor:', error)
    }
  }, [activeCaseId])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--bg)',
        overflow: 'hidden',
      }}
    >
      {/* Context panel — upper, flex or explicit height */}
      <div
        style={{
          flex: contextHeight == null ? 1 : undefined,
          height: contextHeight ?? undefined,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div className="panel-header">
          <span>CONTEXT</span>
        </div>
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
            <AgentStatusPanel agentStatuses={agentStatuses} onRunIngestor={handleRunIngestor} isRunningIngestor={isRunningIngestor} activeCaseId={activeCaseId} />
          </ContextSection>

          {/* Deadlines */}
          <ContextSection title="Deadlines">
            {activeCaseId !== null ? (
              <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }}>
                <p style={{ marginBottom: 6, fontSize: 12 }}>
                  <strong>Court Deadline:</strong> Apr 15, 2026 (26 days)
                </p>
                <p style={{ marginBottom: 6, fontSize: 12 }}>
                  <strong>Next Action:</strong> Complete Diagnostics — clinical formulation
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

      {/* Writing Assistant — lower, flex: 0 0 280px */}
      <div
        style={{
          flex: '0 0 280px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
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
          <span>WRITING ASSISTANT</span>
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
              Writing Assistant
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
              placeholder="Ask the writing assistant..."
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

function AgentStatusPanel({
  agentStatuses,
  onRunIngestor,
  isRunningIngestor,
  activeCaseId,
}: {
  readonly agentStatuses: AgentStatus
  readonly onRunIngestor: () => void
  readonly isRunningIngestor: boolean
  readonly activeCaseId: number | null
}): React.JSX.Element {
  const anyRunning =
    agentStatuses.ingestor.status === 'running' ||
    agentStatuses.ingestor.status === 'queued' ||
    agentStatuses.diagnostician.status === 'running' ||
    agentStatuses.diagnostician.status === 'queued' ||
    agentStatuses.writer.status === 'running' ||
    agentStatuses.writer.status === 'queued' ||
    agentStatuses.editor.status === 'running' ||
    agentStatuses.editor.status === 'queued'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <AgentStatusRow
        name="Ingestor"
        agentStatus={agentStatuses.ingestor}
      />
      <AgentStatusRow
        name="Diagnostician"
        agentStatus={agentStatuses.diagnostician}
      />
      <AgentStatusRow
        name="Writer"
        agentStatus={agentStatuses.writer}
      />
      <AgentStatusRow
        name="Editor"
        agentStatus={agentStatuses.editor}
      />
      <button
        onClick={onRunIngestor}
        disabled={activeCaseId === null || anyRunning}
        style={{
          padding: '6px 12px',
          fontSize: 12,
          fontWeight: 500,
          border: '1px solid var(--border)',
          borderRadius: 4,
          background: activeCaseId === null || anyRunning ? 'var(--panel)' : 'var(--accent)',
          color: activeCaseId === null || anyRunning ? 'var(--text-secondary)' : '#ffffff',
          cursor: activeCaseId === null || anyRunning ? 'not-allowed' : 'pointer',
          opacity: activeCaseId === null || anyRunning ? 0.5 : 1,
          transition: 'all 0.2s',
        }}
      >
        {isRunningIngestor ? 'Running...' : 'Run Ingestor'}
      </button>
    </div>
  )
}

function AgentStatusRow({
  name,
  agentStatus,
}: {
  readonly name: string
  readonly agentStatus: AgentStatusResult
}): React.JSX.Element {
  const color = getStatusColor(agentStatus.status)
  const statusText = agentStatus.status.charAt(0).toUpperCase() + agentStatus.status.slice(1)
  const elapsedTime = formatElapsedTime(agentStatus.elapsedMs)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, marginBottom: 4 }}>
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
      {/* Status details — right-aligned */}
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
