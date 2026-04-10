type ElectronCSS = React.CSSProperties & Record<string, unknown>

interface TitlebarProps {
  readonly onCycleTheme: () => void
  readonly onOpenIntake: () => void
  readonly onSetup: () => void
  readonly leftWidth: number
  readonly rightWidth: number
  readonly leftCollapsed: boolean
  readonly rightCollapsed: boolean
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

export default function Titlebar({ onCycleTheme, onOpenIntake, onSetup, leftWidth, rightWidth, leftCollapsed, rightCollapsed }: TitlebarProps): React.JSX.Element {
  const navActions: Record<string, (() => void) | undefined> = {
    Setup: onSetup,
    'New Case': onOpenIntake,
  }

  // Below the titlebar the layout is:
  //   [leftCol (leftWidth)] [rail (~12px button)] [splitter (6px)] [center (flex)] [splitter (6px)] [rail (~12px)] [rightCol (rightWidth)]
  // When collapsed the rail is 24px and the column + splitter are hidden.
  // The titlebar left/right sections must span the same total width so the border aligns with the splitter.

  const RAIL_EXPANDED = 12   // approximate width of the collapse button when column is visible
  const RAIL_COLLAPSED = 24  // explicit width of the rail when column is hidden
  const SPLITTER_W = 6

  const leftTotalWidth = leftCollapsed
    ? RAIL_COLLAPSED
    : leftWidth + RAIL_EXPANDED + SPLITTER_W

  const rightTotalWidth = rightCollapsed
    ? RAIL_COLLAPSED
    : rightWidth + RAIL_EXPANDED + SPLITTER_W

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
      {/* Left column, empty drag region aligned to left column width */}
      <div
        style={{
          width: leftTotalWidth,
          minWidth: leftCollapsed ? RAIL_COLLAPSED : undefined,
          display: 'flex',
          alignItems: 'center',
          borderRight: '1px solid var(--border)',
          height: '100%',
          flexShrink: 0,
        }}
      />

      {/* Center column, nav links */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '0 16px',
          borderRight: '1px solid var(--border)',
          height: '100%',
          minWidth: 0,
        }}
      >
        {['Setup', 'New Case', 'Docs'].map((label) => (
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

      {/* Right column, empty drag region aligned to right column width */}
      <div
        style={{
          width: rightTotalWidth,
          minWidth: rightCollapsed ? RAIL_COLLAPSED : undefined,
          display: 'flex',
          alignItems: 'center',
          borderLeft: '1px solid var(--border)',
          height: '100%',
          flexShrink: 0,
        }}
      />
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
