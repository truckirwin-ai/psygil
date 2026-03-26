import { useState, useCallback, useEffect } from 'react'
import Titlebar from './components/layout/Titlebar'
import Statusbar from './components/layout/Statusbar'
import LeftColumn from './components/layout/LeftColumn'
import CenterColumn from './components/layout/CenterColumn'
import RightColumn from './components/layout/RightColumn'
import VSplitter from './components/layout/VSplitter'

const THEMES = ['light', 'medium', 'dark'] as const
type Theme = (typeof THEMES)[number]

const STORAGE_KEY_THEME = 'psygil-theme'
const STORAGE_KEY_LEFT_W = 'psygil-left-width'
const STORAGE_KEY_RIGHT_W = 'psygil-right-width'

const DEFAULT_LEFT = 280
const DEFAULT_RIGHT = 320
const MIN_COL = 200

function loadTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY_THEME)
  if (stored === 'light' || stored === 'medium' || stored === 'dark') return stored
  return 'light'
}

function loadWidth(key: string, fallback: number): number {
  const stored = localStorage.getItem(key)
  if (stored != null) {
    const n = parseInt(stored, 10)
    if (!Number.isNaN(n) && n >= MIN_COL) return n
  }
  return fallback
}

export default function App(): React.JSX.Element {
  const [theme, setTheme] = useState<Theme>(loadTheme)
  const [leftWidth, setLeftWidth] = useState(() => loadWidth(STORAGE_KEY_LEFT_W, DEFAULT_LEFT))
  const [rightWidth, setRightWidth] = useState(() => loadWidth(STORAGE_KEY_RIGHT_W, DEFAULT_RIGHT))

  // Apply theme to <html>
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(STORAGE_KEY_THEME, theme)
  }, [theme])

  const cycleTheme = useCallback(() => {
    setTheme((prev) => {
      const idx = THEMES.indexOf(prev)
      return THEMES[(idx + 1) % THEMES.length]
    })
  }, [])

  // Left splitter
  const handleLeftResize = useCallback((delta: number) => {
    setLeftWidth((prev) => Math.max(MIN_COL, prev + delta))
  }, [])

  const handleLeftResizeEnd = useCallback(() => {
    setLeftWidth((w) => {
      localStorage.setItem(STORAGE_KEY_LEFT_W, String(w))
      return w
    })
  }, [])

  // Right splitter
  const handleRightResize = useCallback((delta: number) => {
    setRightWidth((prev) => Math.max(MIN_COL, prev - delta))
  }, [])

  const handleRightResizeEnd = useCallback(() => {
    setRightWidth((w) => {
      localStorage.setItem(STORAGE_KEY_RIGHT_W, String(w))
      return w
    })
  }, [])

  return (
    <div
      className="app"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
      }}
    >
      <Titlebar onCycleTheme={cycleTheme} />

      <div
        className="main-layout"
        style={{
          display: 'flex',
          flex: 1,
          overflow: 'hidden',
        }}
      >
        {/* Left column */}
        <div
          className="left-column"
          style={{
            width: leftWidth,
            minWidth: MIN_COL,
            flexShrink: 0,
            overflow: 'hidden',
          }}
        >
          <LeftColumn />
        </div>

        <VSplitter onResize={handleLeftResize} onResizeEnd={handleLeftResizeEnd} />

        {/* Center column */}
        <div
          className="center-column"
          style={{
            flex: 1,
            overflow: 'hidden',
            minWidth: 0,
          }}
        >
          <CenterColumn />
        </div>

        <VSplitter onResize={handleRightResize} onResizeEnd={handleRightResizeEnd} />

        {/* Right column */}
        <div
          className="right-column"
          style={{
            width: rightWidth,
            minWidth: MIN_COL,
            flexShrink: 0,
            overflow: 'hidden',
          }}
        >
          <RightColumn />
        </div>
      </div>

      <Statusbar />
    </div>
  )
}
