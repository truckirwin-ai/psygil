type ElectronCSS = React.CSSProperties & Record<string, unknown>

interface TitlebarProps {
  readonly onCycleTheme: () => void
  readonly onOpenIntake: () => void
  readonly onOpenOnboarding: () => void
  readonly onSetup: () => void
}

const LOGO_SVG = (
  <svg width="22" height="22" viewBox="0 0 100 100" style={{ flexShrink: 0 }}>
    <polygon points="50,5 15,30 15,75 50,95 85,75 85,30" fill="#E8650A" />
    <polygon points="50,5 15,30 50,50 85,30" fill="#F5A623" />
    <polygon points="15,30 15,75 50,50" fill="#D45A00" />
    <polygon points="85,30 85,75 50,50" fill="#D45A00" />
    <polygon points="35,38 35,52 45,48 45,34" fill="#1a1a2e" />
    <polygon points="55,34 55,48 65,52 65,38" fill="#1a1a2e" />
    <circle cx="40" cy="42" r="2" fill="#ffffff" />
    <circle cx="60" cy="42" r="2" fill="#ffffff" />
  </svg>
)

export default function Titlebar({ onCycleTheme, onOpenIntake, onOpenOnboarding, onSetup }: TitlebarProps): React.JSX.Element {
  const navActions: Record<string, (() => void) | undefined> = {
    Setup: onSetup,
    Intake: onOpenIntake,
    Onboarding: onOpenOnboarding,
  }
  return (
    <div
      style={{
        height: 36,
        display: 'flex',
        alignItems: 'center',
        background: 'var(--panel)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
        WebkitAppRegion: 'drag',
      } as ElectronCSS}
    >
      {/* Left column — logo + nav */}
      <div
        style={{
          width: 280,
          minWidth: 280,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 12px',
          borderRight: '1px solid var(--border)',
          height: '100%',
        }}
      >
        {LOGO_SVG}
        <span
          style={{
            fontSize: 15,
            fontWeight: 600,
            letterSpacing: 2,
            color: 'var(--text)',
          }}
        >
          PSYGIL
        </span>
      </div>

      {/* Center column — nav links */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '0 16px',
          borderRight: '1px solid var(--border)',
          height: '100%',
        }}
      >
        {['Setup', 'Intake', 'Onboarding', 'Docs'].map((label) => (
          <span
            key={label}
            role="button"
            tabIndex={0}
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              WebkitAppRegion: 'no-drag',
            } as ElectronCSS}
            onClick={navActions[label]}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') navActions[label]?.()
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--accent)'
              e.currentTarget.style.textDecoration = 'underline'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-secondary)'
              e.currentTarget.style.textDecoration = 'none'
            }}
          >
            {label}
          </span>
        ))}
      </div>

      {/* Right column — settings, theme, avatar */}
      <div
        style={{
          width: 320,
          minWidth: 320,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 12,
          padding: '0 12px',
          height: '100%',
        }}
      >
        <TitlebarIcon label="Settings">&#9881;</TitlebarIcon>
        <TitlebarIcon label="Theme" onClick={onCycleTheme}>&#9728;</TitlebarIcon>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: 'var(--accent)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          TI
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
          Dr. Irwin
        </span>
      </div>
    </div>
  )
}

function TitlebarIcon({
  children,
  label,
  onClick,
}: {
  readonly children: React.ReactNode
  readonly label: string
  readonly onClick?: () => void
}): React.JSX.Element {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      style={{
        width: 18,
        height: 18,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'none',
        border: 'none',
        color: 'var(--text-secondary)',
        cursor: 'pointer',
        fontSize: 18,
        padding: 0,
        WebkitAppRegion: 'no-drag',
      } as ElectronCSS}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = 'var(--accent)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = 'var(--text-secondary)'
      }}
    >
      {children}
    </button>
  )
}
