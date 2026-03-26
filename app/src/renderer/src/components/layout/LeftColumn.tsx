export default function LeftColumn(): React.JSX.Element {
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
      {/* CASES panel header */}
      <div className="panel-header">
        <span className="panel-header-title">Cases</span>
        <button className="panel-hdr-btn" aria-label="New Case" title="New Case">
          &#65291;
        </button>
        <button className="panel-hdr-btn" aria-label="Browse Cases" title="Browse Cases">
          &#8862;
        </button>
        <button className="panel-hdr-btn" aria-label="Import Case" title="Import Case">
          &#8593;
        </button>
      </div>

      {/* Tree area — placeholder */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '4px 0',
        }}
      >
        <TreeNodePlaceholder icon="&#128202;" label="Dashboard" depth={0} />
        <TreeNodePlaceholder icon="&#128193;" label="Johnson, Marcus D. — CST" depth={0} badge="#2026-0147" />
        <TreeNodePlaceholder icon="&#128193;" label="Williams, Kesha R. — Custody" depth={0} badge="#2026-0152" />
        <TreeNodePlaceholder icon="&#128193;" label="Chen, David L. — Risk" depth={0} badge="#2026-0160" />
      </div>

      {/* RESOURCES panel */}
      <div
        style={{
          borderTop: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        <div className="panel-header">
          <span className="panel-header-title">Resources</span>
        </div>
        <div style={{ padding: '8px 12px' }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px 0' }}>
            DSM-5-TR Reference
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px 0' }}>
            State Statutes
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px 0' }}>
            APA Guidelines
          </div>
        </div>
      </div>
    </div>
  )
}

function TreeNodePlaceholder({
  icon,
  label,
  depth,
  badge,
}: {
  readonly icon: string
  readonly label: string
  readonly depth: number
  readonly badge?: string
}): React.JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '3px 8px',
        paddingLeft: 8 + depth * 16,
        gap: 4,
        cursor: 'pointer',
        fontSize: 13,
        color: 'var(--text)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--highlight)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
      }}
    >
      <span style={{ width: 16, fontSize: 10, color: 'var(--text-secondary)', flexShrink: 0 }}>
        &#9656;
      </span>
      <span style={{ width: 16, height: 16, fontSize: 14, flexShrink: 0 }}>{icon}</span>
      <span
        style={{
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
      {badge != null && (
        <span
          style={{
            background: 'var(--accent)',
            color: '#ffffff',
            fontSize: 10,
            fontWeight: 600,
            borderRadius: 3,
            padding: '1px 5px',
            flexShrink: 0,
          }}
        >
          {badge}
        </span>
      )}
    </div>
  )
}
