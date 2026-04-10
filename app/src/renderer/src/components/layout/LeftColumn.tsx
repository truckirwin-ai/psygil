// =============================================================================
// LeftColumn.tsx, File Tree Panel (Column 1)
// =============================================================================
//
// ██████████████████████████████████████████████████████████████████████████████
// ██  CRITICAL RULE: TREE MUST MIRROR FILESYSTEM, NEVER HARDCODE CONTENTS  ██
// ██████████████████████████████████████████████████████████████████████████████
//
// The directory tree in Column 1 maps 1:1 to real folders on the user's hard
// drive.  If a file or folder exists in Finder/Explorer, it MUST appear in this
// tree.  If it does NOT exist on disk, it MUST NOT appear.
//
// HOW THIS WORKS:
//   1. On mount (and on every refresh), we call window.psygil.workspace.getTree()
//      which invokes the main-process getWorkspaceTree() in workspace/index.ts.
//      That function does a recursive readdirSync of the workspace folder and
//      returns the raw FolderNode[] tree.
//   2. We ALSO load the DB case list (window.psygil.cases.list()) to get metadata
//      like stage colors, evaluation types, and workflow status.  This metadata is
//      used ONLY for visual badges/colors, it does NOT affect which nodes appear.
//   3. The chokidar file watcher in the main process broadcasts
//      'workspace:file-changed' events whenever files are added, changed, or
//      deleted.  We listen for those events and re-fetch the tree automatically.
//
// DO NOT:
//   - Build tree nodes from DB records
//   - Use hardcoded stage logic to decide which folders to show
//   - Add "virtual" nodes that don't correspond to filesystem entries
//   - Filter out filesystem entries based on pipeline stage
//
// The DB is a METADATA OVERLAY, not the source of truth for tree structure.
// The FILESYSTEM is the source of truth.  Always.
//
// See: docs/engineering/26_Workspace_Folder_Architecture.md
// =============================================================================

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type { CaseRow, FolderNode, ResourceItem, ResourceCategory } from '../../../../shared/types'
import type { Tab } from '../../types/tabs'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TreeNode {
  readonly id: string
  readonly label: string
  readonly icon: string
  readonly badge?: string
  readonly stageColor?: string
  readonly expanded?: boolean
  readonly children?: readonly TreeNode[]
  readonly caseId?: number
  /** If set, clicking this node opens a tab of this type */
  readonly tabType?: Tab['type']
  /** Absolute path on disk (for document nodes) */
  readonly filePath?: string
}

interface LeftColumnProps {
  readonly onOpenTab: (tab: Tab) => void
  readonly onNewCase: () => void
  readonly refreshRef: React.MutableRefObject<(() => void) | null>
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STAGE_COLORS: Record<string, string> = {
  onboarding: '#2196f3',
  testing: '#9c27b0',
  interview: '#e91e63',
  diagnostics: '#ff9800',
  review: '#ff5722',
  complete: '#4caf50',
}

// Map subfolder names → icons for known case subfolders
const SUBFOLDER_ICONS: Record<string, string> = {
  intake: '📋',
  referral: '📄',
  collateral: '📁',
  testing: '📊',
  interviews: '🎙',
  diagnostics: '⚖',
  reports: '📝',
  archive: '📦',
}

// Map file extensions → icons
function fileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  switch (ext) {
    case 'pdf': return '📕'
    case 'doc': case 'docx': return '📄'
    case 'xls': case 'xlsx': return '📊'
    case 'txt': return '📝'
    case 'png': case 'jpg': case 'jpeg': case 'gif': case 'webp': return '🖼'
    case 'mp3': case 'wav': case 'ogg': case 'm4a': return '🎵'
    case 'mp4': case 'mov': case 'avi': return '🎬'
    case 'json': return '{ }'
    case 'csv': return '📊'
    default: return '📄'
  }
}

// Case folder naming pattern: "2026-0147 Johnson, Marcus D."
const CASE_FOLDER_PATTERN = /^(\d{4}-\d{4})\s+([^,]+),\s+(.+)$/

// ---------------------------------------------------------------------------
// Tree Building, from FILESYSTEM with DB metadata overlay
// ---------------------------------------------------------------------------
// ██  This function converts FolderNode[] (from disk) into TreeNode[]       ██
// ██  for rendering.  The DB cases list is used ONLY for color/badge data.  ██
// ██  If a folder exists on disk but has no DB record, it still appears.    ██
// ---------------------------------------------------------------------------

function buildTreeFromFilesystem(
  fsTree: readonly FolderNode[],
  casesByNumber: ReadonlyMap<string, CaseRow>,
): TreeNode[] {
  const tree: TreeNode[] = []

  // Dashboard at top (virtual, not a filesystem entry)
  tree.push({
    id: 'dashboard',
    label: 'Dashboard',
    icon: '📊',
    tabType: 'dashboard',
  })

  // Case folders live under /cases/, hoist that folder's children up as
  // top-level case nodes. Everything else (Workspace, etc.) stays where
  // it is. Legacy workspaces with cases at the root still work.
  // Legacy _-prefixed system folders (_Inbox, _Templates, etc.) are
  // silently skipped; the canonical structure uses Workspace/<Category>.
  const caseFolders: FolderNode[] = []
  const otherEntries: FolderNode[] = []

  for (const node of fsTree) {
    // Skip legacy _-prefixed system folders (no longer part of the layout)
    if (node.name.startsWith('_')) continue

    if (node.isDirectory && node.name === 'cases') {
      for (const child of node.children ?? []) {
        if (child.isDirectory && CASE_FOLDER_PATTERN.test(child.name)) {
          caseFolders.push(child)
        }
      }
      continue
    }
    if (node.isDirectory && CASE_FOLDER_PATTERN.test(node.name)) {
      // Legacy workspaces with cases at the root
      caseFolders.push(node)
    } else {
      otherEntries.push(node)
    }
  }

  // Case folders, with DB metadata overlay for colors. Nest them under
  // a virtual "cases" parent node so the tree mirrors the on-disk layout
  // (projectRoot/cases/<case-folder>). Legacy workspaces with cases at the
  // root still nest under the same parent node for visual consistency.
  const caseChildren: TreeNode[] = []
  for (const folder of caseFolders) {
    const match = CASE_FOLDER_PATTERN.exec(folder.name)
    const caseNumber = match?.[1] ?? ''
    const dbCase = casesByNumber.get(caseNumber)

    const stageKey = dbCase?.workflow_current_stage ?? 'onboarding'
    const stageColor = STAGE_COLORS[stageKey] ?? '#999'
    const evalType = dbCase?.evaluation_type ?? ''
    const caseId = dbCase?.case_id

    // Build label: "Johnson, M., CST" or folder name if no DB match
    const label = dbCase
      ? `${dbCase.examinee_last_name}, ${(dbCase.examinee_first_name ?? '').charAt(0).toUpperCase()}.${evalType ? `, ${evalType}` : ''}`
      : folder.name

    const children = convertFolderChildren(folder.children ?? [], caseId)

    // Add Clinical Overview as first child (virtual node, opens the overview tab)
    if (caseId != null) {
      children.unshift({
        id: `${caseId}-overview`,
        label: 'Clinical Overview',
        icon: '📋',
        tabType: 'clinical-overview',
        caseId,
      })
    }

    caseChildren.push({
      id: `case-folder:${folder.path}`,
      label,
      icon: '📁',
      stageColor,
      children,
      caseId,
    })
  }

  // Always show the cases parent, even when empty, so the user knows
  // where new cases will land.
  tree.push({
    id: 'cases-folder',
    label: 'Cases',
    icon: '📁',
    children: caseChildren,
  })

  // Other top-level files/folders (Workspace, etc.)
  for (const entry of otherEntries) {
    tree.push(convertFolderNode(entry, undefined))
  }

  // Settings at bottom (virtual, not a filesystem entry)
  tree.push({
    id: 'settings',
    label: 'Settings',
    icon: '⚙',
    tabType: 'settings',
  })

  return tree
}

/**
 * Convert the children of a case folder into TreeNodes.
 * Known subdirectories (intake, referral, etc.) get appropriate icons.
 */
function convertFolderChildren(
  children: readonly FolderNode[],
  caseId: number | undefined,
): TreeNode[] {
  return children.map((child) => convertFolderNode(child, caseId))
}

/**
 * Recursively convert a FolderNode (filesystem) into a TreeNode (UI).
 * This is a pure transform, it does NOT filter or add nodes.
 * What's on disk is what you see.
 */
function convertFolderNode(node: FolderNode, caseId: number | undefined): TreeNode {
  const lowerName = node.name.toLowerCase()

  if (node.isDirectory) {
    const icon = SUBFOLDER_ICONS[lowerName] ?? '📁'
    const children = (node.children ?? []).map((c) => convertFolderNode(c, caseId))
    return {
      id: `fs:${node.path}`,
      label: node.name,
      icon,
      children,
      caseId,
      filePath: node.path,
    }
  }

  // File node
  return {
    id: `fs:${node.path}`,
    label: node.name,
    icon: fileIcon(node.name),
    caseId,
    filePath: node.path,
    tabType: 'document-viewer',
  }
}

// ---------------------------------------------------------------------------
// Tree Node Component
// ---------------------------------------------------------------------------

interface TreeNodeProps {
  readonly node: TreeNode
  readonly depth: number
  readonly onOpenTab: (tab: Tab) => void
  readonly activeNodeId: string | null
  readonly onSetActive: (id: string) => void
  readonly onNodeClick: (node: TreeNode) => void
}

function TreeNodeComponent({
  node,
  depth,
  onOpenTab,
  activeNodeId,
  onSetActive,
  onNodeClick,
}: TreeNodeProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(node.expanded ?? false)
  const hasChildren = (node.children?.length ?? 0) > 0

  const handleChevronClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      setExpanded((p) => !p)
    },
    [],
  )

  const handleNodeClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.detail === 1 && !e.currentTarget.className.includes('tree-chevron')) {
        onSetActive(node.id)
        onNodeClick(node)
      }
    },
    [node, onSetActive, onNodeClick],
  )

  const indent = 8 + depth * 16
  const isActive = activeNodeId === node.id

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '3px 0',
          paddingLeft: `${indent}px`,
          gap: 4,
          fontSize: 13,
          color: isActive ? 'white' : 'var(--text)',
          cursor: 'pointer',
          userSelect: 'none',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          transition: 'background 0.1s',
          background: isActive ? 'var(--accent)' : 'transparent',
        }}
        onMouseEnter={(e) => {
          if (!isActive) {
            e.currentTarget.style.background = 'var(--highlight)'
          }
        }}
        onMouseLeave={(e) => {
          if (!isActive) {
            e.currentTarget.style.background = 'transparent'
          }
        }}
        onClick={handleNodeClick}
      >
        {/* Chevron */}
        {hasChildren ? (
          <span
            className="tree-chevron"
            style={{
              width: 20,
              height: 20,
              fontSize: 14,
              color: isActive ? 'white' : 'var(--text-secondary)',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              borderRadius: 3,
            }}
            onClick={handleChevronClick}
            title={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? '▾' : '▸'}
          </span>
        ) : (
          <span
            style={{
              width: 20,
              flexShrink: 0,
              visibility: 'hidden',
            }}
          />
        )}

        {/* Icon */}
        <span
          style={{
            width: 16,
            height: 16,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14,
            color: isActive ? 'white' : 'var(--text-secondary)',
          }}
        >
          {node.icon}
        </span>

        {/* Label */}
        <span
          style={{
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {node.label}
        </span>

        {/* Stage color circle, only on case folder nodes */}
        {node.stageColor && (
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: node.stageColor,
              flexShrink: 0,
              marginLeft: 'auto',
              marginRight: 4,
              boxShadow: isActive ? '0 0 0 1px rgba(255,255,255,0.5)' : 'none',
            }}
            title={`Stage: ${Object.entries(STAGE_COLORS).find(([, c]) => c === node.stageColor)?.[0] ?? ''}`}
          />
        )}
      </div>

      {/* Children */}
      {hasChildren && expanded && (
        <div>
          {node.children!.map((child) => (
            <TreeNodeComponent
              key={child.id}
              node={child}
              depth={depth + 1}
              onOpenTab={onOpenTab}
              activeNodeId={activeNodeId}
              onSetActive={onSetActive}
              onNodeClick={onNodeClick}
            />
          ))}
        </div>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Main LeftColumn Component
// ---------------------------------------------------------------------------

export default function LeftColumn({
  onOpenTab,
  onNewCase,
  refreshRef,
}: LeftColumnProps): React.JSX.Element {
  // =========================================================================
  // STATE
  // =========================================================================

  // DB case metadata, used for color/badge overlay ONLY
  const [cases, setCases] = useState<readonly CaseRow[]>([])
  // Filesystem tree, the ACTUAL source of truth for what appears in the tree
  const [fsTree, setFsTree] = useState<readonly FolderNode[]>([])
  const [loading, setLoading] = useState(true)
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null)

  // Filters
  const [stageFilter, setStageFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [showFilterMenu, setShowFilterMenu] = useState(false)
  const filterRef = useRef<HTMLDivElement>(null)

  // Draggable splitter between tree and resources
  const SPLIT_STORAGE_KEY = 'psygil:left-column-split'
  const DEFAULT_SPLIT = 0.6 // 60% tree, 40% resources
  const [splitRatio, setSplitRatio] = useState<number>(() => {
    try {
      const stored = globalThis.sessionStorage?.getItem?.(SPLIT_STORAGE_KEY)
        ?? globalThis.localStorage?.getItem?.(SPLIT_STORAGE_KEY)
      if (stored) {
        const val = parseFloat(stored)
        if (!isNaN(val) && val >= 0.2 && val <= 0.85) return val
      }
    } catch { /* ignore */ }
    return DEFAULT_SPLIT
  })
  const [isDraggingSplit, setIsDraggingSplit] = useState(false)
  const columnRef = useRef<HTMLDivElement>(null)

  // Close filter dropdown when clicking outside
  useEffect(() => {
    if (!showFilterMenu) return
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setShowFilterMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showFilterMenu])

  // Splitter drag logic, persists position on release
  useEffect(() => {
    if (!isDraggingSplit) return
    const onMove = (e: MouseEvent) => {
      const col = columnRef.current
      if (!col) return
      const rect = col.getBoundingClientRect()
      // Subtract the 32px CASES header from the available space
      const headerHeight = 32
      const available = rect.height - headerHeight
      const y = e.clientY - rect.top - headerHeight
      const ratio = Math.min(0.85, Math.max(0.2, y / available))
      setSplitRatio(ratio)
    }
    const onUp = () => {
      setIsDraggingSplit(false)
      // Persist to both session and local storage
      try {
        const val = splitRatio.toFixed(4)
        globalThis.sessionStorage?.setItem?.(SPLIT_STORAGE_KEY, val)
        globalThis.localStorage?.setItem?.(SPLIT_STORAGE_KEY, val)
      } catch { /* ignore */ }
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    // Prevent text selection while dragging
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'row-resize'
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
  }, [isDraggingSplit, splitRatio])

  // =========================================================================
  // DATA LOADING
  // =========================================================================

  /**
   * Load BOTH the filesystem tree AND the DB case list.
   * The filesystem tree is the source of truth for structure.
   * The DB case list provides metadata overlay (stage, eval type, colors).
   */
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      // Fetch filesystem tree and DB cases in parallel
      const [treeResp, casesResp] = await Promise.all([
        window.psygil?.workspace?.getTree?.(),
        window.psygil?.cases?.list?.(),
      ])

      if (treeResp?.status === 'success') {
        setFsTree(treeResp.data)
      }
      if (casesResp?.status === 'success') {
        setCases(casesResp.data.cases)
      }
    } catch (err) {
      console.error('[LeftColumn] Error loading data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Expose loadData via refreshRef so parent can trigger refresh
  const loadDataRef = useRef(loadData)
  loadDataRef.current = loadData
  useEffect(() => {
    refreshRef.current = () => {
      void loadDataRef.current()
    }
  }, [refreshRef])

  // Load on mount
  useEffect(() => {
    void loadData()
  }, [loadData])

  // =========================================================================
  // FILESYSTEM WATCHER, auto-refresh tree when files change on disk
  // =========================================================================
  // When chokidar detects a change, we re-fetch the full tree.
  // This keeps the UI in perfect sync with the filesystem at all times.

  useEffect(() => {
    const handler = (): void => {
      // Re-fetch tree on any filesystem change
      void loadDataRef.current()
    }

    const wrapped = window.psygil?.workspace?.onFileChanged?.(handler)

    return () => {
      window.psygil?.workspace?.offFileChanged?.(wrapped)
    }
  }, [])

  // =========================================================================
  // DB METADATA INDEX, map case_number → CaseRow for O(1) lookups
  // =========================================================================

  const casesByNumber = useMemo(() => {
    const map = new Map<string, CaseRow>()
    for (const c of cases) {
      if (c.case_number) {
        map.set(c.case_number, c)
      }
    }
    return map
  }, [cases])

  // =========================================================================
  // TREE CONSTRUCTION, filesystem + metadata overlay
  // =========================================================================
  // buildTreeFromFilesystem() takes the raw filesystem tree and the DB case
  // index, and returns TreeNode[] for rendering.  The DB data adds colors and
  // labels but NEVER determines which nodes appear.  If it's on disk, it shows.

  const treeData = useMemo(() => {
    let tree = buildTreeFromFilesystem(fsTree, casesByNumber)

    // Apply filters, these filter CASE FOLDERS by DB metadata, but
    // non-case entries (system folders, loose files) always show
    if (stageFilter !== 'all' || typeFilter !== 'all') {
      tree = tree.filter((node) => {
        // Always show non-case nodes (dashboard, settings, system, loose files)
        if (!node.id.startsWith('case-folder:')) return true

        const caseId = node.caseId
        if (caseId == null) return true // No DB match, show it anyway

        const dbCase = cases.find((c) => c.case_id === caseId)
        if (!dbCase) return true

        if (stageFilter !== 'all') {
          const stage = dbCase.workflow_current_stage ?? 'onboarding'
          if (stage !== stageFilter) return false
        }
        if (typeFilter !== 'all') {
          const evalType = dbCase.evaluation_type ?? ''
          if (evalType !== typeFilter) return false
        }
        return true
      })
    }

    return tree
  }, [fsTree, casesByNumber, cases, stageFilter, typeFilter])

  // Unique eval types for filter dropdown
  const evalTypes = useMemo(() => {
    const types = new Set<string>()
    for (const c of cases) {
      if (c.evaluation_type) types.add(c.evaluation_type)
    }
    return Array.from(types).sort()
  }, [cases])

  const activeFilterCount = (stageFilter !== 'all' ? 1 : 0) + (typeFilter !== 'all' ? 1 : 0)

  // =========================================================================
  // NODE CLICK HANDLER, opens appropriate tab based on node type
  // =========================================================================

  const handleNodeClick = useCallback(
    (node: TreeNode) => {
      // If node has an explicit tabType, use it
      if (node.tabType === 'dashboard') {
        onOpenTab({ id: 'dashboard', title: 'Dashboard', type: 'dashboard' })
        return
      }
      if (node.tabType === 'settings') {
        onOpenTab({ id: 'settings', title: 'Settings', type: 'settings' })
        return
      }
      if (node.tabType === 'clinical-overview' && node.caseId != null) {
        const dbCase = cases.find((c) => c.case_id === node.caseId)
        const title = dbCase
          ? `${dbCase.examinee_last_name}, ${dbCase.examinee_first_name}`
          : 'Clinical Overview'
        onOpenTab({
          id: `overview:${node.caseId}`,
          title,
          type: 'clinical-overview',
          caseId: node.caseId,
        })
        return
      }
      if (node.tabType === 'document-viewer' && node.filePath) {
        onOpenTab({
          id: `doc:${node.filePath}`,
          title: node.label,
          type: 'document-viewer',
          filePath: node.filePath,
          caseId: node.caseId,
        })
        return
      }

      // Case folder, clicking the label opens the Clinical Overview tab
      if (node.id.startsWith('case-folder:') && node.caseId != null) {
        const dbCase = cases.find((c) => c.case_id === node.caseId)
        const title = dbCase
          ? `${dbCase.examinee_last_name}, ${dbCase.examinee_first_name}`
          : 'Clinical Overview'
        onOpenTab({
          id: `overview:${node.caseId}`,
          title,
          type: 'clinical-overview',
          caseId: node.caseId,
        })
        return
      }

      // For other folder nodes with children, just toggle expand (handled by chevron)
    },
    [cases, onOpenTab],
  )

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <div
      ref={columnRef}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--bg)',
        overflow: 'hidden',
      }}
    >
      {/* Panel header, logo + title + actions */}
      <div
        className="panel-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          height: 32,
          padding: '0 8px',
          background: 'var(--panel)',
          borderBottom: '1px solid var(--border)',
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          color: 'var(--text-secondary)',
          userSelect: 'none',
          flexShrink: 0,
          gap: 6,
        }}
      >
        {/* Psygil logo */}
        <svg width="18" height="18" viewBox="0 0 100 100" style={{ flexShrink: 0 }}>
          <polygon points="50,5 15,30 15,75 50,95 85,75 85,30" fill="#E8650A" />
          <polygon points="50,5 15,30 50,50 85,30" fill="#F5A623" />
          <polygon points="15,30 15,75 50,50" fill="#D45A00" />
          <polygon points="85,30 85,75 50,50" fill="#D45A00" />
          <polygon points="35,38 35,52 45,48 45,34" fill="#1a1a2e" />
          <polygon points="55,34 55,48 65,52 65,38" fill="#1a1a2e" />
          <circle cx="40" cy="42" r="2" fill="#ffffff" />
          <circle cx="60" cy="42" r="2" fill="#ffffff" />
        </svg>
        <span style={{
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: 2,
          color: 'var(--text)',
          marginRight: 4,
        }}>PSYGIL</span>
        <span style={{ color: 'var(--border)', fontSize: 14, lineHeight: 1 }}>|</span>
        {/* Filter button */}
        <div ref={filterRef} style={{ position: 'relative', marginLeft: 'auto' }}>
          <button
            onClick={() => setShowFilterMenu((p) => !p)}
            style={{
              background: activeFilterCount > 0 ? 'var(--accent)' : 'none',
              border: 'none',
              color: activeFilterCount > 0 ? '#fff' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: 10,
              padding: activeFilterCount > 0 ? '1px 5px' : 0,
              borderRadius: 3,
              width: activeFilterCount > 0 ? 'auto' : 20,
              height: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
            }}
            title="Filter cases"
          >
            <span style={{ fontSize: 12 }}>&#9776;</span>
            {activeFilterCount > 0 && <span>{activeFilterCount}</span>}
          </button>
          {showFilterMenu && (
            <div
              style={{
                position: 'absolute',
                top: 24,
                right: 0,
                width: 200,
                background: 'var(--panel)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                zIndex: 100,
                padding: '8px 0',
              }}
            >
              {/* Stage filter */}
              <div style={{ padding: '4px 12px' }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                  Stage
                </div>
                <select
                  value={stageFilter}
                  onChange={(e) => setStageFilter(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '4px 6px',
                    fontSize: 12,
                    background: 'var(--bg)',
                    color: 'var(--text)',
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                    fontFamily: 'inherit',
                  }}
                >
                  <option value="all">All Stages</option>
                  <option value="onboarding">Onboarding</option>
                  <option value="testing">Testing</option>
                  <option value="interview">Interview</option>
                  <option value="diagnostics">Diagnostics</option>
                  <option value="review">Review</option>
                  <option value="complete">Complete</option>
                </select>
              </div>
              {/* Type filter */}
              <div style={{ padding: '4px 12px' }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                  Eval Type
                </div>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '4px 6px',
                    fontSize: 12,
                    background: 'var(--bg)',
                    color: 'var(--text)',
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                    fontFamily: 'inherit',
                  }}
                >
                  <option value="all">All Types</option>
                  {evalTypes.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              {/* Clear button */}
              {activeFilterCount > 0 && (
                <div style={{ padding: '6px 12px 2px', borderTop: '1px solid var(--border)', marginTop: 4 }}>
                  <button
                    onClick={() => {
                      setStageFilter('all')
                      setTypeFilter('all')
                    }}
                    style={{
                      width: '100%',
                      padding: '4px 0',
                      fontSize: 11,
                      fontWeight: 500,
                      background: 'none',
                      border: 'none',
                      color: 'var(--accent)',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    Clear Filters
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        <button
          onClick={onNewCase}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: 14,
            padding: 0,
            width: 20,
            height: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title="New Case"
        >
          +
        </button>
        <button
          onClick={() => {
            void loadData()
          }}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: 14,
            padding: 0,
            width: 20,
            height: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title="Refresh"
        >
          ↻
        </button>
      </div>

      {/* Splittable area: tree (top) + resources (bottom) */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
        {/* Tree container, takes splitRatio of available space */}
        <div
          style={{
            flex: `0 0 ${splitRatio * 100}%`,
            overflowY: 'auto',
            padding: '4px 0',
            minHeight: 0,
          }}
        >
          {loading ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: 'var(--text-secondary)',
                fontSize: 13,
              }}
            >
              Loading...
            </div>
          ) : (
            <div>
              {treeData.map((node) => (
                <TreeNodeComponent
                  key={node.id}
                  node={node}
                  depth={0}
                  onOpenTab={onOpenTab}
                  activeNodeId={activeNodeId}
                  onSetActive={setActiveNodeId}
                  onNodeClick={handleNodeClick}
                />
              ))}
            </div>
          )}
        </div>

        {/* Draggable splitter handle */}
        <div
          onMouseDown={(e) => { e.preventDefault(); setIsDraggingSplit(true) }}
          style={{
            flexShrink: 0,
            height: 5,
            cursor: 'row-resize',
            background: isDraggingSplit ? 'var(--accent)' : 'var(--border)',
            transition: isDraggingSplit ? 'none' : 'background 0.15s',
            position: 'relative',
            zIndex: 10,
          }}
          onMouseEnter={(e) => { if (!isDraggingSplit) e.currentTarget.style.background = 'var(--accent)' }}
          onMouseLeave={(e) => { if (!isDraggingSplit) e.currentTarget.style.background = 'var(--border)' }}
        />

        {/* Resources panel, takes remaining space */}
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <ResourcesPanel onOpenTab={onOpenTab} />
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// ResourcesPanel, Upload dropdown + categorized file list
// =============================================================================

const RESOURCE_CATEGORIES: { key: ResourceCategory; label: string; icon: string; desc: string }[] = [
  { key: 'writing-samples', label: 'Writing Samples', icon: '✍', desc: 'Your own writing for voice & style analysis' },
  { key: 'templates', label: 'Templates', icon: '📋', desc: 'Report templates, court reports, company docs' },
  { key: 'documentation', label: 'Documentation', icon: '📚', desc: 'DSM, state guidelines, testing manuals' },
]

function ResourcesPanel({ onOpenTab }: { readonly onOpenTab: (tab: Tab) => void }): React.JSX.Element {
  const [resources, setResources] = useState<readonly ResourceItem[]>([])
  const [showUploadMenu, setShowUploadMenu] = useState(false)
  const [expandedCategory, setExpandedCategory] = useState<ResourceCategory | null>(null)
  const [uploading, setUploading] = useState(false)
  const uploadMenuRef = useRef<HTMLDivElement>(null)

  // Load resources on mount
  const loadResources = useCallback(async () => {
    try {
      const resp = await window.psygil?.resources?.list?.({})
      if (resp?.status === 'success') {
        setResources(resp.data)
      }
    } catch (err) {
      console.error('[ResourcesPanel] Failed to load resources:', err)
    }
  }, [])

  useEffect(() => { loadResources() }, [loadResources])

  // Close upload dropdown on outside click
  useEffect(() => {
    if (!showUploadMenu) return
    const handler = (e: MouseEvent) => {
      if (uploadMenuRef.current && !uploadMenuRef.current.contains(e.target as Node)) {
        setShowUploadMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showUploadMenu])

  const handleUpload = useCallback(async (category: ResourceCategory) => {
    setShowUploadMenu(false)
    setUploading(true)
    try {
      // Writing samples: open Settings tab where the staged upload modal lives
      if (category === 'writing-samples') {
        onOpenTab({
          id: 'settings',
          title: 'Settings',
          type: 'settings',
        })
        setUploading(false)
        return
      } else {
        const resp = await window.psygil?.resources?.upload?.({ category })
        if (resp?.status === 'success') {
          const { imported, phiStripped } = resp.data
          if (imported.length > 0) {
            console.log(`[Resources] Uploaded ${imported.length} files to ${category}, stripped ${phiStripped} PHI instances`)
            setExpandedCategory(category)
            await loadResources()
          }
        }
      }
    } catch (err) {
      console.error('[Resources] Upload failed:', err)
    } finally {
      setUploading(false)
    }
  }, [loadResources])

  const handleDelete = useCallback(async (item: ResourceItem) => {
    try {
      await window.psygil?.resources?.delete?.({ id: item.id, storedPath: item.storedPath })
      await loadResources()
    } catch (err) {
      console.error('[Resources] Delete failed:', err)
    }
  }, [loadResources])

  const handleOpen = useCallback((item: ResourceItem) => {
    const tabId = `resource:${item.storedPath}`
    onOpenTab({
      id: tabId,
      title: item.originalFilename,
      type: 'resource',
      filePath: item.storedPath,
    })
  }, [onOpenTab])

  // Group resources by category
  const grouped = useMemo(() => {
    const map: Record<string, ResourceItem[]> = { 'writing-samples': [], 'templates': [], 'documentation': [] }
    for (const r of resources) {
      if (map[r.category]) map[r.category].push(r)
    }
    return map
  }, [resources])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header with upload button */}
      <div
        className="panel-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 32,
          padding: '0 12px',
          background: 'var(--panel)',
          borderBottom: '1px solid var(--border)',
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          color: 'var(--text-secondary)',
          userSelect: 'none',
        }}
      >
        <span>RESOURCES</span>
        <div ref={uploadMenuRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setShowUploadMenu(!showUploadMenu)}
            disabled={uploading}
            style={{
              background: 'none',
              border: 'none',
              color: uploading ? 'var(--text-tertiary)' : 'var(--text-secondary)',
              cursor: uploading ? 'wait' : 'pointer',
              fontSize: 14,
              lineHeight: 1,
              padding: '2px 4px',
              borderRadius: 3,
              transition: 'color 0.15s, background 0.15s',
            }}
            onMouseEnter={(e) => { if (!uploading) { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.background = 'var(--hover)' } }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'none' }}
            title="Upload resource document"
          >
            {uploading ? '↻' : '+'}
          </button>

          {/* Upload category dropdown */}
          {showUploadMenu && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: 4,
                width: 260,
                background: 'var(--panel)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                zIndex: 1000,
                overflow: 'hidden',
              }}
            >
              <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', fontSize: 11, color: 'var(--text-secondary)', textTransform: 'none', fontWeight: 500, letterSpacing: 0 }}>
                Upload as...
              </div>
              {RESOURCE_CATEGORIES.map((cat) => (
                <div
                  key={cat.key}
                  onClick={() => handleUpload(cat.key)}
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                    borderBottom: '1px solid var(--border)',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--hover)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                >
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', textTransform: 'none', letterSpacing: 0 }}>
                    {cat.icon} {cat.label}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2, textTransform: 'none', letterSpacing: 0 }}>
                    {cat.desc}
                  </div>
                </div>
              ))}
              <div style={{ padding: '6px 12px', fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'none', letterSpacing: 0, fontStyle: 'italic' }}>
                PHI is automatically stripped before AI processing
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Category sections with file lists */}
      <div style={{ flex: 1, overflowY: 'auto', fontSize: 12, minHeight: 0 }}>
        {RESOURCE_CATEGORIES.map((cat) => {
          const items = grouped[cat.key] || []
          const isExpanded = expandedCategory === cat.key
          return (
            <div key={cat.key}>
              {/* Category header, clickable to expand/collapse */}
              <div
                onClick={() => setExpandedCategory(isExpanded ? null : cat.key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 12px',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                  transition: 'color 0.15s, background 0.15s',
                  userSelect: 'none',
                  borderBottom: '1px solid var(--border)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--hover)'; e.currentTarget.style.color = 'var(--text-primary)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)' }}
              >
                <span style={{ fontSize: 14, fontFamily: 'monospace', width: 18, textAlign: 'center', lineHeight: 1 }}>
                  {isExpanded ? '▾' : '▸'}
                </span>
                <span>{cat.icon}</span>
                <span style={{ flex: 1, fontWeight: 500 }}>{cat.label}</span>
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)', minWidth: 16, textAlign: 'right' }}>
                  {items.length > 0 ? items.length : ''}
                </span>
              </div>

              {/* Expanded file list */}
              {isExpanded && (
                <div style={{ background: 'var(--surface-1, var(--bg))' }}>
                  {items.length === 0 ? (
                    <div style={{ padding: '8px 12px 8px 36px', color: 'var(--text-tertiary)', fontSize: 11, fontStyle: 'italic' }}>
                      No files uploaded
                    </div>
                  ) : (
                    items.map((item) => (
                      <div
                        key={item.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '4px 8px 4px 36px',
                          fontSize: 11,
                          color: 'var(--text-secondary)',
                          transition: 'background 0.15s',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--hover)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                        onClick={() => handleOpen(item)}
                        title={`${item.originalFilename}\n${item.phiStripped ? '⚕ PHI stripped' : ''}\nClick to open`}
                      >
                        <span style={{ fontSize: 11 }}>
                          {item.originalFilename.endsWith('.pdf') ? '📕' :
                           item.originalFilename.endsWith('.docx') || item.originalFilename.endsWith('.doc') ? '📄' :
                           item.originalFilename.endsWith('.txt') ? '📝' : '📎'}
                        </span>
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.originalFilename}
                        </span>
                        {item.phiStripped && (
                          <span title="PHI was stripped" style={{ fontSize: 9, color: '#4caf50' }}>⚕</span>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(item) }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-tertiary)',
                            cursor: 'pointer',
                            fontSize: 11,
                            padding: '0 2px',
                            opacity: 0.5,
                            transition: 'opacity 0.15s, color 0.15s',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = '#ef5350' }}
                          onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.5'; e.currentTarget.style.color = 'var(--text-tertiary)' }}
                          title="Remove"
                        >
                          ✕
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
