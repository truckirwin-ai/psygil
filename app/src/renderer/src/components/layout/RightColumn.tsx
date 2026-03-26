import { useState, useCallback } from 'react'
import HSplitter from './HSplitter'

export default function RightColumn(): React.JSX.Element {
  const [contextHeight, setContextHeight] = useState<number | null>(null)

  const handleResize = useCallback((delta: number) => {
    setContextHeight((prev) => {
      const current = prev ?? 280
      return Math.max(100, current + delta)
    })
  }, [])

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
          <span className="panel-header-title">Context</span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
          {/* Case Notes */}
          <ContextSection title="Case Notes">
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
              No case selected
            </div>
          </ContextSection>

          {/* AI Agent Status */}
          <ContextSection title="AI Agent Status">
            <AgentStatus name="Documenter" status="Idle" color="#4caf50" />
            <AgentStatus name="Diagnostician" status="Idle" color="#4caf50" />
            <AgentStatus name="Editor" status="Idle" color="#4caf50" />
            <AgentStatus name="Legal" status="Idle" color="#4caf50" />
          </ContextSection>

          {/* Deadlines */}
          <ContextSection title="Deadlines">
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
              No active deadlines
            </div>
          </ContextSection>

          {/* Quick Actions */}
          <ContextSection title="Quick Actions">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button
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

      {/* Writing Assistant — lower, 280px */}
      <div
        style={{
          height: 280,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div className="panel-header">
          <span className="panel-header-title">Writing Assistant</span>
          <button className="panel-hdr-btn" aria-label="Clear chat">
            &#10005;
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
          <div
            style={{
              alignSelf: 'flex-start',
              maxWidth: '88%',
              padding: '8px 10px',
              fontSize: 12,
              lineHeight: 1.5,
              background: 'var(--panel)',
              color: 'var(--text)',
              borderRadius: '8px 8px 8px 2px',
            }}
          >
            How can I help you draft sections, check citations, or review for compliance?
          </div>
        </div>

        {/* Input area */}
        <div
          style={{
            padding: '8px 10px',
            borderTop: '1px solid var(--border)',
            background: 'var(--panel)',
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
              }}
            >
              Writing Assistant
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <textarea
              rows={3}
              placeholder="Ask about drafting, citations, or compliance..."
              style={{
                flex: 1,
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                padding: '6px 8px',
                fontSize: 12,
                color: 'var(--text)',
                resize: 'none',
                fontFamily: 'inherit',
                outline: 'none',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent)'
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)'
              }}
            />
            <button
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
                alignSelf: 'flex-end',
              }}
            >
              &#9654;
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
    <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12, marginBottom: 12 }}>
      <div
        style={{
          fontSize: 11,
          textTransform: 'uppercase',
          fontWeight: 600,
          color: 'var(--text-secondary)',
          letterSpacing: 0.3,
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  )
}

function AgentStatus({
  name,
  status,
  color,
}: {
  readonly name: string
  readonly status: string
  readonly color: string
}): React.JSX.Element {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, marginBottom: 4 }}>
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: color,
          display: 'inline-block',
        }}
      />
      <span style={{ color: 'var(--text)' }}>{name}</span>
      <span style={{ color: 'var(--text-secondary)', marginLeft: 'auto' }}>{status}</span>
    </div>
  )
}
