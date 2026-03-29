import { useState, useEffect, useCallback, useRef } from 'react'
import type { CaseRow, FolderNode } from '../../../../shared/types'
import type { Tab } from '../../types/tabs'

// ---------------------------------------------------------------------------
// Context menu — shown on right-click of file/folder nodes
// ---------------------------------------------------------------------------

interface CtxMenu {
  readonly x: number
  readonly y: number
  readonly path: string
  readonly isDirectory: boolean
}

function ContextMenu({
  menu,
  onClose,
}: {
  readonly menu: CtxMenu
  readonly onClose: () => void
}): React.JSX.Element {
  const handleFinderClick = useCallback(() => {
    void window.psygil?.workspace?.openInFinder?.(menu.path)
    onClose()
  }, [menu.path, onClose])

  const handleNativeClick = useCallback(() => {
    if (!menu.isDirectory) {
      void window.psygil?.workspace?.openNative?.(menu.path)
    }
    onClose()
  }, [menu.path, menu.isDirectory, onClose])

  return (
    <div
      style={{
        position: 'fixed',
        top: menu.y,
        left: menu.x,
        zIndex: 9000,
        background: 'var(--panel)',
        border: '1px solid var(--border)',
        borderRadius: 4,
        boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
        minWidth: 180,
        padding: '4px 0',
        fontSize: 12,
      }}
    >
      <div
        style={{ padding: '6px 14px', cursor: 'pointer', color: 'var(--text)' }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--highlight)' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
        onClick={handleFinderClick}
      >
        📂 Reveal in Finder
      </div>
      {!menu.isDirectory && (
        <div
          style={{ padding: '6px 14px', cursor: 'pointer', color: 'var(--text)' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--highlight)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          onClick={handleNativeClick}
        >
          ↗ Open with Default App
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STAGE_COLORS: Record<string, string> = {
  onboarding: '#2196f3',
  gate_1: '#2196f3',
  testing: '#9c27b0',
  gate_2: '#9c27b0',
  interview: '#e91e63',
  diagnostics: '#ff9800',
  gate_3: '#ff9800',
  review: '#ff5722',
  complete: '#4caf50',
  finalized: '#4caf50',
  intake: '#2196f3',
}

const STAGE_LABELS: Record<string, string> = {
  onboarding: 'Onboarding',
  gate_1: 'Onboarding',
  testing: 'Testing',
  gate_2: 'Testing',
  interview: 'Interview',
  diagnostics: 'Diagnostics',
  gate_3: 'Diagnostics',
  review: 'Review',
  complete: 'Complete',
  finalized: 'Complete',
  intake: 'Intake',
}

const CASE_SUBFOLDERS = [
  '_Inbox',
  'Collateral',
  'Testing',
  'Interviews',
  'Diagnostics',
  'Reports',
  'Archive',
] as const

type WorkspaceStatus = 'loading' | 'no-workspace' | 'ready'

interface LeftColumnProps {
  readonly onOpenTab: (tab: Tab) => void
  readonly onNewCase: () => void
  readonly onEditIntake: (caseId: number) => void
  /** Parent passes a ref so it can trigger case list refresh from outside. */
  readonly refreshRef: React.MutableRefObject<(() => void) | null>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a flat lookup map keyed by path from a recursive FolderNode tree. */
function buildTreeLookup(nodes: readonly FolderNode[]): Map<string, FolderNode> {
  const map = new Map<string, FolderNode>()
  function walk(node: FolderNode): void {
    map.set(node.path, node)
    if (node.children) {
      for (const child of node.children) {
        walk(child)
      }
    }
  }
  for (const n of nodes) {
    walk(n)
  }
  return map
}

// ---------------------------------------------------------------------------
// LeftColumn
// ---------------------------------------------------------------------------

export default function LeftColumn({
  onOpenTab,
  onNewCase,
  refreshRef,
}: LeftColumnProps): React.JSX.Element {
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null)
  const [wsStatus, setWsStatus] = useState<WorkspaceStatus>('loading')
  const [cases, setCases] = useState<readonly CaseRow[]>([])
  const [wsTree, setWsTree] = useState<readonly FolderNode[]>([])
  const [treeLookup, setTreeLookup] = useState<Map<string, FolderNode>>(new Map())

  // Rebuild lookup whenever tree changes (used to locate case folders in the disk tree)
  useEffect(() => {
    setTreeLookup(buildTreeLookup(wsTree))
  }, [wsTree])

  const loadTree = useCallback(async () => {
    const resp = await window.psygil?.workspace?.getTree?.()
    if (resp?.status === 'success') {
      setWsTree(resp.data)
    }
  }, [])

  const loadCases = useCallback(async () => {
    console.log('[LeftColumn] calling cases.list...')
    const resp = await window.psygil?.cases?.list?.()
    console.log('[LeftColumn] cases.list response:', resp)
    if (resp?.status === 'success') {
      console.log('[LeftColumn] setting cases:', resp.data.cases.length)
      setCases(resp.data.cases)
    }
  }, [])

  // Expose loadCases via refreshRef so parent can trigger it after case creation
  const loadCasesRef = useRef(loadCases)
  loadCasesRef.current = loadCases
  useEffect(() => {
    refreshRef.current = () => { void loadCasesRef.current() }
  }, [refreshRef])

  // On mount: check workspace → load tree + cases
  // Retry once after 1.5s to handle the sync race condition on first launch
  useEffect(() => {
    let cancelled = false
    async function init(isRetry = false): Promise<void> {
      const resp = await window.psygil?.workspace?.getPath?.()
      console.log('[LeftColumn] workspace.getPath:', resp)
      if (cancelled) return
      if (resp?.status === 'success' && resp.data !== null) {
        setWsStatus('ready')
        await Promise.all([loadTree(), loadCases()])
        // If no cases on first load, retry once after sync may have completed
        if (!isRetry) {
          setTimeout(() => { if (!cancelled) void init(true) }, 1500)
        }
      } else {
        setWsStatus('no-workspace')
      }
    }
    void init()
    return () => { cancelled = true }
  }, [loadTree, loadCases])

  // File-change watcher
  useEffect(() => {
    if (wsStatus !== 'ready') return
    window.psygil?.workspace?.onFileChanged?.(() => { void loadTree() })
    return () => { window.psygil?.workspace?.offFileChanged?.() }
  }, [wsStatus, loadTree])

  // Workspace folder pickers (first-launch)
  const handleChooseFolder = useCallback(async () => {
    const pickResp = await window.psygil?.workspace?.pickFolder?.()
    if (pickResp?.status !== 'success' || pickResp.data === null) return
    const setResp = await window.psygil?.workspace?.setPath?.(pickResp.data)
    if (setResp?.status === 'success') {
      setWsStatus('ready')
      await Promise.all([loadTree(), loadCases()])
    }
  }, [loadTree, loadCases])

  const handleUseDefault = useCallback(async () => {
    const defaultResp = await window.psygil?.workspace?.getDefaultPath?.()
    if (defaultResp?.status !== 'success') return
    const setResp = await window.psygil?.workspace?.setPath?.(defaultResp.data)
    if (setResp?.status === 'success') {
      setWsStatus('ready')
      await Promise.all([loadTree(), loadCases()])
    }
  }, [loadTree, loadCases])

  const handleRefresh = useCallback(() => {
    void Promise.all([loadTree(), loadCases()])
  }, [loadTree, loadCases])

  // Always render the shell with header — only the body content changes by status
  const bodyContent = (): React.JSX.Element => {
    if (wsStatus === 'no-workspace') {
      return <WelcomeOverlay onChoose={() => { void handleChooseFolder() }} onUseDefault={() => { void handleUseDefault() }} />
    }
    if (wsStatus === 'loading') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)', fontSize: 13 }}>
          Loading…
        </div>
      )
    }
    return <CasesView cases={cases} treeLookup={treeLookup} onOpenTab={onOpenTab} onContextMenu={setCtxMenu} />
  }

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)', overflow: 'hidden' }}
      onClick={() => setCtxMenu(null)}
    >
      {/* Context menu */}
      {ctxMenu !== null && (
        <ContextMenu menu={ctxMenu} onClose={() => setCtxMenu(null)} />
      )}

      {/* Panel header — always visible */}
      <div className="panel-header">
        <span className="panel-header-title">Cases</span>
        <button
          className="panel-hdr-btn"
          aria-label="New Case"
          title="New Case"
          onClick={onNewCase}
        >
          &#65291;
        </button>
        <button className="panel-hdr-btn" aria-label="Refresh" title="Refresh" onClick={handleRefresh}>
          &#8635;
        </button>
      </div>

      {/* Tree area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {bodyContent()}
      </div>

      {/* Resources panel */}
      <div style={{ borderTop: '1px solid var(--border)', flexShrink: 0 }}>
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

// ---------------------------------------------------------------------------
// Cases View
// ---------------------------------------------------------------------------

function CasesView({
  cases,
  treeLookup,
  onOpenTab,
  onContextMenu,
}: {
  readonly cases: readonly CaseRow[]
  readonly treeLookup: Map<string, FolderNode>
  readonly onOpenTab: (tab: Tab) => void
  readonly onContextMenu: (menu: CtxMenu) => void
}): React.JSX.Element {
  if (cases.length === 0) {
    return (
      <div style={{ padding: '16px 12px', fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center' }}>
        No cases yet. Click + to create one.
      </div>
    )
  }

  return (
    <>
      {cases.map((c) => (
        <CaseNode key={c.case_id} caseRow={c} treeLookup={treeLookup} onOpenTab={onOpenTab} onContextMenu={onContextMenu} />
      ))}
    </>
  )
}

// ---------------------------------------------------------------------------
// CaseNode — expandable case with subfolders
// ---------------------------------------------------------------------------

function CaseNode({
  caseRow,
  treeLookup,
  onOpenTab,
  onContextMenu,
}: {
  readonly caseRow: CaseRow
  readonly treeLookup: Map<string, FolderNode>
  readonly onOpenTab: (tab: Tab) => void
  readonly onContextMenu: (menu: CtxMenu) => void
}): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)

  const stage = caseRow.workflow_current_stage ?? 'onboarding'
  const stageColor = STAGE_COLORS[stage] ?? '#9e9e9e'
  const stageLabel = STAGE_LABELS[stage] ?? stage

  const caseName = `${caseRow.examinee_last_name}, ${caseRow.examinee_first_name}`
  const evalType = caseRow.evaluation_type ?? ''

  const caseFolder = caseRow.folder_path ? treeLookup.get(caseRow.folder_path) : undefined

  const handleChevronClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      setExpanded((p) => !p)
    },
    [],
  )

  const handleNameClick = useCallback(() => {
    onOpenTab({
      id: `overview:${caseRow.case_id}`,
      title: caseName,
      type: 'clinical-overview',
      caseId: caseRow.case_id,
    })
  }, [caseRow.case_id, caseName, onOpenTab])

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '3px 8px',
          gap: 4,
          fontSize: 13,
          color: 'var(--text)',
          cursor: 'default',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--highlight)' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
      >
        {/* Chevron — expand/collapse only */}
        <span
          style={{ width: 16, fontSize: 10, color: 'var(--text-secondary)', flexShrink: 0, textAlign: 'center', cursor: 'pointer' }}
          onClick={handleChevronClick}
          title={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? '\u25BE' : '\u25B8'}
        </span>

        {/* Name + eval type — opens tab */}
        <span
          style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, cursor: 'pointer' }}
          onClick={handleNameClick}
          title={`Open ${caseName}`}
        >
          <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' }}>{caseName}</span>
          {evalType !== '' && (
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', flexShrink: 0 }}>{evalType}</span>
          )}
        </span>

        {/* Pipeline stage pill */}
        <span
          style={{
            background: stageColor,
            color: '#ffffff',
            fontSize: 10,
            fontWeight: 600,
            borderRadius: 3,
            padding: '2px 6px',
            flexShrink: 0,
            whiteSpace: 'nowrap',
          }}
        >
          {stageLabel}
        </span>
      </div>

      {expanded &&
        CASE_SUBFOLDERS.map((sub) => {
          const subNode = caseFolder?.children?.find((c) => c.name === sub)
          return (
            <FolderSubNode key={sub} name={sub} folderNode={subNode} depth={1} onOpenTab={onOpenTab} onContextMenu={onContextMenu} />
          )
        })}
    </>
  )
}

// ---------------------------------------------------------------------------
// FolderSubNode — subfolder within a case (Collateral, Testing, etc.)
// ---------------------------------------------------------------------------

function FolderSubNode({
  name,
  folderNode,
  depth,
  onOpenTab,
  onContextMenu,
}: {
  readonly name: string
  readonly folderNode: FolderNode | undefined
  readonly depth: number
  readonly onOpenTab: (tab: Tab) => void
  readonly onContextMenu: (menu: CtxMenu) => void
}): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)

  const children = folderNode?.children ?? []
  const fileCount = children.filter((c) => !c.isDirectory).length

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (folderNode?.path) {
        e.preventDefault()
        e.stopPropagation()
        onContextMenu({ x: e.clientX, y: e.clientY, path: folderNode.path, isDirectory: true })
      }
    },
    [folderNode?.path, onContextMenu],
  )

  return (
    <>
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
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--highlight)' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
        onClick={() => setExpanded((p) => !p)}
        onContextMenu={handleContextMenu}
      >
        <span style={{ width: 16, fontSize: 10, color: 'var(--text-secondary)', flexShrink: 0, textAlign: 'center' }}>
          {expanded ? '\u25BE' : '\u25B8'}
        </span>
        <span style={{ width: 16, height: 16, fontSize: 14, flexShrink: 0, color: 'var(--text-secondary)' }}>
          {'\u{1F4C1}'}
        </span>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {name}
        </span>
        {fileCount > 0 && (
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
            {fileCount}
          </span>
        )}
      </div>

      {expanded &&
        children.map((child) =>
          child.isDirectory ? (
            <FolderSubNode key={child.path} name={child.name} folderNode={child} depth={depth + 1} onOpenTab={onOpenTab} onContextMenu={onContextMenu} />
          ) : (
            <FileLeafNode key={child.path} node={child} depth={depth + 1} onOpenTab={onOpenTab} onContextMenu={onContextMenu} />
          ),
        )}
    </>
  )
}

// ---------------------------------------------------------------------------
// FileLeafNode — clickable file that opens a tab
// ---------------------------------------------------------------------------

function FileLeafNode({
  node,
  depth,
  onOpenTab,
  onContextMenu,
}: {
  readonly node: FolderNode
  readonly depth: number
  readonly onOpenTab: (tab: Tab) => void
  readonly onContextMenu: (menu: CtxMenu) => void
}): React.JSX.Element {
  const handleClick = useCallback(() => {
    onOpenTab({ id: `doc:${node.path}`, title: node.name, type: 'document', filePath: node.path })
  }, [node.path, node.name, onOpenTab])

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      onContextMenu({ x: e.clientX, y: e.clientY, path: node.path, isDirectory: false })
    },
    [node.path, onContextMenu],
  )

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
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--highlight)' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    >
      <span style={{ width: 16, flexShrink: 0 }} />
      <span style={{ width: 16, height: 16, fontSize: 14, flexShrink: 0, color: 'var(--text-secondary)' }}>
        {'\u{1F4C4}'}
      </span>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {node.name}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// WelcomeOverlay — first-launch workspace picker
// ---------------------------------------------------------------------------

function WelcomeOverlay({
  onChoose,
  onUseDefault,
}: {
  readonly onChoose: () => void
  readonly onUseDefault: () => void
}): React.JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        background: 'var(--bg)',
        padding: '24px 16px',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 32, marginBottom: 12 }}>{'\u{1F4C2}'}</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
        Welcome to Psygil
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.5, maxWidth: 220 }}>
        Choose a folder to store your case files. This folder will contain all your cases, documents, and reports.
      </div>
      <button
        onClick={onChoose}
        style={{
          background: 'var(--accent)',
          color: '#ffffff',
          border: 'none',
          borderRadius: 4,
          padding: '8px 20px',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          marginBottom: 8,
          width: '100%',
          maxWidth: 200,
        }}
      >
        Choose Folder
      </button>
      <button
        onClick={onUseDefault}
        style={{
          background: 'transparent',
          color: 'var(--text-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 4,
          padding: '8px 20px',
          fontSize: 13,
          cursor: 'pointer',
          width: '100%',
          maxWidth: 200,
        }}
      >
        Use Default
      </button>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 12, opacity: 0.7 }}>
        Default: ~/Documents/Psygil Cases/
      </div>
    </div>
  )
}
