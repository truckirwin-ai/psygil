const PIPELINE_STAGES = [
  { label: 'Onboarding', color: '#2196f3' },
  { label: 'Testing', color: '#9c27b0' },
  { label: 'Interview', color: '#e91e63' },
  { label: 'Diagnostics', color: '#ff9800' },
  { label: 'Review', color: '#ff5722' },
  { label: 'Complete', color: '#4caf50' },
] as const

export default function CenterColumn(): React.JSX.Element {
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
      {/* Tab bar */}
      <div
        style={{
          height: 32,
          display: 'flex',
          alignItems: 'center',
          background: 'var(--panel)',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
          overflowX: 'auto',
        }}
      >
        <span
          style={{
            padding: '0 16px',
            fontSize: 12,
            color: 'var(--text-secondary)',
            fontStyle: 'italic',
          }}
        >
          No open tabs
        </span>
      </div>

      {/* Content area */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'auto',
        }}
      >
        <div
          style={{
            textAlign: 'center',
            color: 'var(--text-secondary)',
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.3 }}>&#128203;</div>
          <div style={{ fontSize: 14, fontWeight: 500 }}>Open a case to begin</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>
            Select a case from the tree or create a new one
          </div>
        </div>
      </div>

      {/* Pipeline bar — spec §8.4, 80px */}
      <div
        style={{
          height: 80,
          flexShrink: 0,
          borderTop: '1px solid var(--border)',
          background: 'var(--panel)',
        }}
      >
        <div className="panel-header" style={{ borderBottom: 'none' }}>
          <span className="panel-header-title">Evaluation Pipeline</span>
        </div>
        <div
          style={{
            display: 'flex',
            gap: 4,
            padding: '8px 12px',
            flexWrap: 'wrap',
          }}
        >
          {PIPELINE_STAGES.map((stage) => (
            <span
              key={stage.label}
              style={{
                padding: '4px 12px',
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 500,
                border: '1px solid var(--border)',
                color: 'var(--text-secondary)',
                background: 'var(--panel)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = stage.color
                e.currentTarget.style.color = '#ffffff'
                e.currentTarget.style.borderColor = stage.color
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--panel)'
                e.currentTarget.style.color = 'var(--text-secondary)'
                e.currentTarget.style.borderColor = 'var(--border)'
              }}
            >
              <span style={{ fontSize: 10 }}>&#9675;</span>
              {stage.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
