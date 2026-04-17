import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import Statusbar from './components/layout/Statusbar'
import LeftColumn from './components/layout/LeftColumn'
import CenterColumn, { TabButton } from './components/layout/CenterColumn'
import RightColumn from './components/layout/RightColumn'
import VSplitter from './components/layout/VSplitter'
import IntakeOnboardingModal from './components/modals/IntakeOnboardingModal'
import SetupModal from './components/modals/SetupModal'
import DocumentUploadModal from './components/modals/DocumentUploadModal'
import ScoreImportModal from './components/modals/ScoreImportModal'
import SetupWizard from './components/setup/SetupWizard'
import FirstRunModal from './components/setup/FirstRunModal'
import TrialExpiredModal from './components/setup/TrialExpiredModal'
import type { Tab, TabState } from './types/tabs'
import type { CaseRow } from '../../shared/types/ipc'
import { setTheme as applyTheme, getTheme } from './app/theme'
import type { ThemeKey } from './app/theme'

const THEMES: readonly ThemeKey[] = ['light', 'warm', 'medium', 'dark'] as const
type Theme = ThemeKey

const STORAGE_KEY_THEME = 'psygil_theme'
const STORAGE_KEY_LEFT_W = 'psygil-left-width'
const STORAGE_KEY_RIGHT_W = 'psygil-right-width'

const DEFAULT_LEFT = 280
const DEFAULT_RIGHT = 320
const MIN_COL = 200
const COLLAPSED_W = 0
const STORAGE_KEY_LEFT_COLLAPSED = 'psygil-left-collapsed'
const STORAGE_KEY_RIGHT_COLLAPSED = 'psygil-right-collapsed'

// Feature flag, Column 3 (Case Notes + AI Admin chat) is hidden in the
// current UI. The component, IPC wiring, and state are all preserved so
// flipping this back to `true` restores the previous behavior. The
// titlebar buttons (Settings, Theme, avatar) are unaffected.
const RIGHT_COLUMN_ENABLED = false

function loadTheme(): Theme {
  return getTheme()
}

function loadWidth(key: string, fallback: number): number {
  const stored = localStorage.getItem(key)
  if (stored != null) {
    const n = parseInt(stored, 10)
    if (!Number.isNaN(n) && n >= MIN_COL) return n
  }
  return fallback
}

type SetupGateState = 'unknown' | 'first-run' | 'expired' | 'app'

export default function App(): React.JSX.Element {
  // Setup gate: load the persisted setup state on mount and decide whether
  // to show the FirstRunModal, the TrialExpiredModal, or the main app.
  const [setupGate, setSetupGate] = useState<SetupGateState>('unknown')
  const [trialExpiresAt, setTrialExpiresAt] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const resp = await window.psygil.setup.getConfig()
        if (cancelled) return

        if (resp.status !== 'success' || resp.data.config.setupState !== 'complete') {
          setSetupGate('first-run')
          return
        }

        // Setup is complete. Check trial expiry before allowing access.
        try {
          const expiryResp = await window.psygil.setup.checkLicenseExpiry()
          if (cancelled) return
          if (
            expiryResp.status === 'success' &&
            expiryResp.data.expiry !== null &&
            expiryResp.data.expiry.expired
          ) {
            setTrialExpiresAt(expiryResp.data.expiry.expiresAt)
            setSetupGate('expired')
            return
          }
        } catch {
          // Expiry check failure is non-fatal; let the user in.
        }

        setSetupGate('app')
      } catch {
        // If the setup IPC is unreachable, fall through to the app rather
        // than blocking the user. The app's existing fallbacks handle
        // missing config gracefully.
        if (!cancelled) setSetupGate('app')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const handleSetupComplete = useCallback(() => {
    setSetupGate('app')
  }, [])

  // Defers an action to run after the main app has rendered. The setup
  // wizard uses this to ask the host to open the intake modal once it
  // has unmounted.
  const [pendingPostSetup, setPendingPostSetup] = useState<'create-case' | null>(null)
  const handleCreateFirstCase = useCallback(() => {
    setPendingPostSetup('create-case')
  }, [])

  // Run the pending post-setup action once the app shell is showing
  useEffect(() => {
    if (setupGate !== 'app' || pendingPostSetup === null) return
    if (pendingPostSetup === 'create-case') {
      setIntakeEditCaseId(undefined)
      setShowIntake(true)
    }
    setPendingPostSetup(null)
  }, [setupGate, pendingPostSetup])

  const [theme, setTheme] = useState<Theme>(loadTheme)
  const [leftWidth, setLeftWidth] = useState(() => loadWidth(STORAGE_KEY_LEFT_W, DEFAULT_LEFT))
  const [rightWidth, setRightWidth] = useState(() => loadWidth(STORAGE_KEY_RIGHT_W, DEFAULT_RIGHT))
  const [leftCollapsed, setLeftCollapsed] = useState(() => localStorage.getItem(STORAGE_KEY_LEFT_COLLAPSED) === 'true')
  const [rightCollapsed, setRightCollapsed] = useState(() => localStorage.getItem(STORAGE_KEY_RIGHT_COLLAPSED) === 'true')
  const [showIntake, setShowIntake] = useState(false)
  const [showSetup, setShowSetup] = useState(false)
  const [showDocUpload, setShowDocUpload] = useState(false)
  const [docUploadCaseId, setDocUploadCaseId] = useState<number | null>(null)
  const [showScoreImport, setShowScoreImport] = useState(false)
  const [scoreImportCaseId, setScoreImportCaseId] = useState<number | null>(null)

  // When showIntake is open in "new case" mode, no caseId. When editing, pass one.
  const [intakeEditCaseId, setIntakeEditCaseId] = useState<number | undefined>(undefined)

  // Tab state, managed here, passed down to LeftColumn + CenterColumn
  // Dashboard is always present and pinned as the first tab
  const DASHBOARD_TAB: Tab = { id: 'dashboard', title: 'Dashboard', type: 'dashboard' }
  const [tabState, setTabState] = useState<TabState>({
    tabs: [DASHBOARD_TAB],
    activeId: 'dashboard',
  })

  // Ref to allow LeftColumn to refresh its case list imperatively
  const refreshCasesRef = useRef<(() => void) | null>(null)

  // Cases list, shared between LeftColumn and CenterColumn (Dashboard)
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

  // Re-fetch cases when filesystem changes so Dashboard stays in sync
  useEffect(() => {
    const handler = (): void => {
      void loadCases()
    }
    const wrapped = window.psygil?.workspace?.onFileChanged?.(handler)
    return () => {
      window.psygil?.workspace?.offFileChanged?.(wrapped)
    }
  }, [loadCases])

  // Re-fetch cases when pipeline stage changes so kanban reflects new stage
  useEffect(() => {
    const handler = (): void => {
      void loadCases()
    }
    const wrapped = window.psygil?.cases?.onChanged?.(handler)
    return () => {
      window.psygil?.cases?.offChanged?.(wrapped)
    }
  }, [loadCases])

  // Derive active case ID and tab type from active tab
  const activeTab = useMemo(() => {
    return tabState.tabs.find((t) => t.id === tabState.activeId) ?? null
  }, [tabState])

  const activeCaseId = activeTab?.caseId ?? null
  const activeTabType = activeTab?.type ?? null

  const openTab = useCallback((tab: Tab) => {
    setTabState((prev) => {
      if (prev.tabs.some((t) => t.id === tab.id)) {
        return { ...prev, activeId: tab.id }
      }
      return { tabs: [...prev.tabs, tab], activeId: tab.id }
    })
  }, [])

  const closeTab = useCallback((id: string) => {
    // Dashboard is pinned, cannot be closed
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
    applyTheme(theme)
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

  // Column collapse toggles
  const toggleLeftCollapsed = useCallback(() => {
    setLeftCollapsed((prev) => {
      const next = !prev
      localStorage.setItem(STORAGE_KEY_LEFT_COLLAPSED, String(next))
      return next
    })
  }, [])

  const toggleRightCollapsed = useCallback(() => {
    setRightCollapsed((prev) => {
      const next = !prev
      localStorage.setItem(STORAGE_KEY_RIGHT_COLLAPSED, String(next))
      return next
    })
  }, [])

  // Open new case modal (create mode)
  const handleNewCase = useCallback(() => {
    setIntakeEditCaseId(undefined)
    setShowIntake(true)
  }, [])

  // Open document upload modal for a case
  const handleUploadDocuments = useCallback((caseId: number) => {
    setDocUploadCaseId(caseId)
    setShowDocUpload(true)
  }, [])

  // Open score import modal for a case
  const handleImportScores = useCallback((caseId: number) => {
    setScoreImportCaseId(caseId)
    setShowScoreImport(true)
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

  // Gate: show FirstRunModal on cold start until setup completes. While we
  // are still resolving the setup state on first paint, show a blank screen
  // to avoid flashing the main UI for a frame.
  if (setupGate === 'unknown') {
    return (
      <div
        style={{
          height: '100vh',
          background: 'var(--bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-secondary)',
          fontSize: 14,
        }}
      >
        Loading...
      </div>
    )
  }

  if (setupGate === 'first-run') {
    return <FirstRunModal onComplete={handleSetupComplete} />
  }

  if (setupGate === 'expired' && trialExpiresAt !== null) {
    return (
      <TrialExpiredModal
        expiresAt={trialExpiresAt}
        onUnlocked={() => setSetupGate('app')}
      />
    )
  }

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
      <div
        className="main-layout"
        style={{
          display: 'flex',
          flex: 1,
          overflow: 'hidden',
        }}
      >
        {/* Left column */}
        {!leftCollapsed && (
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
        )}

        {/* Left collapse/expand rail */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: leftCollapsed ? 24 : undefined,
            flexShrink: 0,
          }}
        >
          <button
            onClick={toggleLeftCollapsed}
            title={leftCollapsed ? 'Show sidebar' : 'Hide sidebar'}
            style={{
              background: 'var(--panel)',
              border: '1px solid var(--border)',
              borderRadius: leftCollapsed ? '0 4px 4px 0' : '4px 0 0 4px',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: 11,
              padding: '6px 3px',
              marginTop: 8,
              lineHeight: 1,
              transition: 'color 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)' }}
          >
            {leftCollapsed ? '▶' : '◀'}
          </button>
        </div>

        {!leftCollapsed && (
          <VSplitter onResize={handleLeftResize} onResizeEnd={handleLeftResizeEnd} />
        )}

        {/* Center + Right area, shared title bar */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

          {/* ── Merged title bar: tabs (left) + settings/avatar (right) ── */}
          <div
            style={{
              height: 32,
              display: 'flex',
              alignItems: 'stretch',
              background: 'var(--panel)',
              borderBottom: '1px solid var(--border)',
              flexShrink: 0,
            }}
          >
            {/* Tab buttons, flex to fill */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'stretch', overflowX: 'auto', minWidth: 0 }}>
              {tabState.tabs.length === 0 ? (
                <span style={{ padding: '0 16px', fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic', display: 'flex', alignItems: 'center' }}>
                  No open tabs
                </span>
              ) : (
                tabState.tabs.map((tab) => (
                  <TabButton
                    key={tab.id}
                    tab={tab}
                    isActive={tab.id === tabState.activeId}
                    onActivate={() => setActiveTab(tab.id)}
                    onClose={() => closeTab(tab.id)}
                  />
                ))
              )}
            </div>

            {/* Right header buttons, settings, theme, avatar */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
              gap: 10, padding: '0 12px', flexShrink: 0,
              borderLeft: '1px solid var(--border)',
            }}>
              <button
                aria-label="Settings"
                onClick={() => openTab({ id: 'settings', title: 'Settings', type: 'settings' })}
                style={{
                  width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer',
                  fontSize: 22, padding: 0, borderRadius: 4,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.background = 'color-mix(in srgb, var(--accent) 10%, transparent)' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'none' }}
              >
                &#9881;
              </button>
              <button
                aria-label="Theme"
                onClick={cycleTheme}
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
                color: 'var(--field-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 600, flexShrink: 0,
              }}>
                TI
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                Dr. Irwin
              </span>
            </div>
          </div>

          {/* ── Content row: center + splitter + rail + right ── */}
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
            {/* Center column content */}
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
                onRefreshCases={loadCases}
                onUploadDocuments={handleUploadDocuments}
                onImportScores={handleImportScores}
                hideTabBar
              />
            </div>

            {/* Column 3, Case Notes + AI Admin chat. Hidden behind a
                feature flag at the top of this file. The titlebar buttons
                (Settings, Theme, avatar) are above this block and are
                unaffected. */}
            {RIGHT_COLUMN_ENABLED && (
              <>
                {!rightCollapsed && (
                  <VSplitter onResize={handleRightResize} onResizeEnd={handleRightResizeEnd} />
                )}

                {/* Right collapse/expand rail */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    width: rightCollapsed ? 24 : undefined,
                    flexShrink: 0,
                  }}
                >
                  <button
                    onClick={toggleRightCollapsed}
                    title={rightCollapsed ? 'Show panel' : 'Hide panel'}
                    style={{
                      background: 'var(--panel)',
                      border: '1px solid var(--border)',
                      borderRadius: rightCollapsed ? '4px 0 0 4px' : '0 4px 4px 0',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontSize: 11,
                      padding: '6px 3px',
                      marginTop: 8,
                      lineHeight: 1,
                      transition: 'color 0.15s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)' }}
                  >
                    {rightCollapsed ? '◀' : '▶'}
                  </button>
                </div>

                {/* Right column content */}
                {!rightCollapsed && (
                  <div
                    className="right-column"
                    style={{
                      width: rightWidth,
                      minWidth: MIN_COL,
                      flexShrink: 0,
                      overflow: 'hidden',
                    }}
                  >
                    <RightColumn activeCaseId={activeCaseId} onOpenTab={openTab} onCycleTheme={cycleTheme} cases={cases} activeTabType={activeTabType} hideHeader />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <Statusbar />

      <IntakeOnboardingModal
        isOpen={showIntake}
        onClose={() => setShowIntake(false)}
        caseId={intakeEditCaseId}
        onSaved={handleCaseSaved}
      />
      <SetupModal
        isOpen={showSetup}
        onClose={() => setShowSetup(false)}
        onWorkspaceSet={() => { refreshCasesRef.current?.() }}
      />

      {showDocUpload && docUploadCaseId != null && (
        <DocumentUploadModal
          caseId={docUploadCaseId}
          onClose={() => setShowDocUpload(false)}
          onUploadComplete={() => {
            refreshCasesRef.current?.()
          }}
        />
      )}

      {showScoreImport && scoreImportCaseId != null && (
        <ScoreImportModal
          caseId={scoreImportCaseId}
          onClose={() => setShowScoreImport(false)}
          onImportComplete={() => {
            refreshCasesRef.current?.()
          }}
        />
      )}
    </div>
  )
}
