import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import Titlebar from './components/layout/Titlebar'
import Statusbar from './components/layout/Statusbar'
import LeftColumn from './components/layout/LeftColumn'
import CenterColumn from './components/layout/CenterColumn'
import RightColumn from './components/layout/RightColumn'
import VSplitter from './components/layout/VSplitter'
import IntakeModal from './components/modals/IntakeModal'
import OnboardingModal from './components/modals/OnboardingModal'
import SetupModal from './components/modals/SetupModal'
import type { Tab, TabState } from './types/tabs'
import type { CaseRow } from '../../shared/types/ipc'

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
  const [showIntake, setShowIntake] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showSetup, setShowSetup] = useState(false)

  // When showIntake is open in "new case" mode, no caseId. When editing, pass one.
  const [intakeEditCaseId, setIntakeEditCaseId] = useState<number | undefined>(undefined)

  // Tab state — managed here, passed down to LeftColumn + CenterColumn
  // Dashboard is always present and pinned as the first tab
  const DASHBOARD_TAB: Tab = { id: 'dashboard', title: 'Dashboard', type: 'dashboard' }
  const [tabState, setTabState] = useState<TabState>({
    tabs: [DASHBOARD_TAB],
    activeId: 'dashboard',
  })

  // Ref to allow LeftColumn to refresh its case list imperatively
  const refreshCasesRef = useRef<(() => void) | null>(null)

  // Cases list — shared between LeftColumn and CenterColumn (Dashboard)
  const [cases, setCases] = useState<CaseRow[]>([])

  // Load cases on mount + when refreshed
  const loadCases = useCallback(async () => {
    try {
      const resp = await window.psygil.cases.list()
      if (resp.status === 'success') {
        setCases(resp.data.cases as CaseRow[])
      }
    } catch {
      // silent
    }
  }, [])

  useEffect(() => {
    void loadCases()
  }, [loadCases])

  // Derive active case ID from active tab
  const activeCaseId = useMemo(() => {
    const activeTab = tabState.tabs.find((t) => t.id === tabState.activeId)
    return activeTab?.caseId ?? null
  }, [tabState])

  const openTab = useCallback((tab: Tab) => {
    setTabState((prev) => {
      if (prev.tabs.some((t) => t.id === tab.id)) {
        return { ...prev, activeId: tab.id }
      }
      return { tabs: [...prev.tabs, tab], activeId: tab.id }
    })
  }, [])

  const closeTab = useCallback((id: string) => {
    // Dashboard is pinned — cannot be closed
    if (id === 'dashboard') return
    setTabState((prev) => {
      const idx = prev.tabs.findIndex((t) => t.id === id)
      if (idx === -1) return prev
      const next = [...prev.tabs.slice(0, idx), ...prev.tabs.slice(idx + 1)]
      let activeId = prev.activeId
      if (activeId === id) {
        // Fall back to dashboard when closing the active tab
        activeId = next.length === 0 ? null : next[Math.min(idx, next.length - 1)].id
      }
      return { tabs: next, activeId }
    })
  }, [])

  const setActiveTab = useCallback((id: string) => {
    setTabState((prev) => ({ ...prev, activeId: id }))
  }, [])

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

  // Open new case modal (create mode)
  const handleNewCase = useCallback(() => {
    setIntakeEditCaseId(undefined)
    setShowIntake(true)
  }, [])

  // Open intake modal for editing existing case
  const handleEditIntake = useCallback((caseId: number) => {
    setIntakeEditCaseId(caseId)
    setShowIntake(true)
  }, [])

  // Called after a new case is created successfully
  const handleCaseSaved = useCallback((caseRow: CaseRow) => {
    // Refresh the case list in LeftColumn + global cases state
    refreshCasesRef.current?.()
    void loadCases()

    // Open the new case's Clinical Overview tab
    const title = `${caseRow.examinee_last_name}, ${caseRow.examinee_first_name}`
    openTab({
      id: `overview:${caseRow.case_id}`,
      title,
      type: 'clinical-overview',
      caseId: caseRow.case_id,
    })
  }, [openTab])

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
      <Titlebar
        onCycleTheme={cycleTheme}
        onOpenIntake={handleNewCase}
        onOpenOnboarding={() => setShowOnboarding(true)}
        onSetup={() => setShowSetup(true)}
      />

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
          <LeftColumn
            onOpenTab={openTab}
            onNewCase={handleNewCase}
            refreshRef={refreshCasesRef}
          />
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
          <CenterColumn
            tabs={tabState.tabs}
            activeTabId={tabState.activeId}
            onCloseTab={closeTab}
            onSetActiveTab={setActiveTab}
            onEditIntake={handleEditIntake}
            onOpenTab={openTab}
            cases={cases}
          />
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
          <RightColumn activeCaseId={activeCaseId} onOpenTab={openTab} />
        </div>
      </div>

      <Statusbar />

      <IntakeModal
        isOpen={showIntake}
        onClose={() => setShowIntake(false)}
        caseId={intakeEditCaseId}
        onSaved={handleCaseSaved}
      />
      <OnboardingModal isOpen={showOnboarding} onClose={() => setShowOnboarding(false)} />
      <SetupModal
        isOpen={showSetup}
        onClose={() => setShowSetup(false)}
        onWorkspaceSet={() => { refreshCasesRef.current?.() }}
      />
    </div>
  )
}
