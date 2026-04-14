export default function Statusbar(): React.JSX.Element {
  return (
    <div
      style={{
        height: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 12px',
        background: 'var(--panel)',
        borderTop: '1px solid var(--border)',
        fontSize: 11,
        color: 'var(--text-secondary)',
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#4caf50',
              display: 'inline-block',
            }}
          />
          Connected
        </span>
        <span>LLM: Claude Sonnet</span>
        <span>PHI: UNID Redaction &#10003;</span>
        <span>Storage: Local</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <span>12 active cases</span>
        <span>v0.1.0-alpha</span>
      </div>
    </div>
  )
}
