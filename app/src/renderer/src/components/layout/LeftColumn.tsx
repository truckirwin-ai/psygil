// =============================================================================
// LeftColumn.tsx — File Tree Panel (Column 1)
// =============================================================================
//
// ██████████████████████████████████████████████████████████████████████████████
// ██  CRITICAL RULE: TREE MUST MIRROR FILESYSTEM — NEVER HARDCODE CONTENTS  ██
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
//      used ONLY for visual badges/colors — it does NOT affect which nodes appear.
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
import type { CaseRow, FolderNode } from '../../../../shared/types'
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
// Tree Building — from FILESYSTEM with DB metadata overlay
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

  // Dashboard at top (virtual — not a filesystem entry)
  tree.push({
    id: 'dashboard',
    label: 'Dashboard',
    icon: '📊',
    tabType: 'dashboard',
  })

  // System folders (start with _) go into a separate section
  const systemFolders: FolderNode[] = []
  const caseFolders: FolderNode[] = []
  const otherEntries: FolderNode[] = []

  for (const node of fsTree) {
    if (node.name.startsWith('_')) {
      systemFolders.push(node)
    } else if (node.isDirectory && CASE_FOLDER_PATTERN.test(node.name)) {
      caseFolders.push(node)
    } else {
      otherEntries.push(node)
    }
  }

  // Case folders — with DB metadata overlay for colors
  for (const folder of caseFolders) {
    const match = CASE_FOLDER_PATTERN.exec(folder.name)
    const caseNumber = match?.[1] ?? ''
    const dbCase = casesByNumber.get(caseNumber)

    const stageKey = dbCase?.workflow_current_stage ?? 'onboarding'
    const stageColor = STAGE_COLORS[stageKey] ?? '#999'
    const evalType = dbCase?.evaluation_type ?? ''
    const caseId = dbCase?.case_id

    // Build label: "Johnson, M. — CST" or folder name if no DB match
    const label = dbCase
      ? `${dbCase.examinee_last_name}, ${(dbCase.examinee_first_name ?? '').charAt(0).toUpperCase()}.${evalType ? ` — ${evalType}` : ''}`
      : folder.name

    const children = convertFolderChildren(folder.children ?? [], caseId)

    // Add Clinical Overview as first child (virtual node — opens the overview tab)
    if (caseId != null) {
      children.unshift({
        id: `${caseId}-overview`,
        label: 'Clinical Overview',
        icon: '📋',
        tabType: 'clinical-overview',
        caseId,
      })
    }

    tree.push({
      id: `case-folder:${folder.path}`,
      label,
      icon: '📁',
      stageColor,
      children,
      caseId,
    })
  }

  // Other top-level files/folders (not cases, not system)
  for (const entry of otherEntries) {
    tree.push(convertFolderNode(entry, undefined))
  }

  // System folders (_Inbox, _Templates, etc.)
  if (systemFolders.length > 0) {
    const sysChildren = systemFolders.map((f) => convertFolderNode(f, undefined))
    tree.push({
      id: 'system-folders',
      label: 'Workspace',
      icon: '📂',
      children: sysChildren,
    })
  }

  // Settings at bottom (virtual — not a filesystem entry)
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
 * This is a pure transform — it does NOT filter or add nodes.
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
              width: 16,
              fontSize: 10,
              color: isActive ? 'white' : 'var(--text-secondary)',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
            onClick={handleChevronClick}
            title={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? '▾' : '▸'}
          </span>
        ) : (
          <span
            style={{
              width: 16,
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

        {/* Stage color circle — only on case folder nodes */}
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

  // DB case metadata — used for color/badge overlay ONLY
  const [cases, setCases] = useState<readonly CaseRow[]>([])
  // Filesystem tree — the ACTUAL source of truth for what appears in the tree
  const [fsTree, setFsTree] = useState<readonly FolderNode[]>([])
  const [loading, setLoading] = useState(true)
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null)

  // Filters
  const [stageFilter, setStageFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [showFilterMenu, setShowFilterMenu] = useState(false)
  const filterRef = useRef<HTMLDivElement>(null)

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
  // FILESYSTEM WATCHER — auto-refresh tree when files change on disk
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
  // DB METADATA INDEX — map case_number → CaseRow for O(1) lookups
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
  // TREE CONSTRUCTION — filesystem + metadata overlay
  // =========================================================================
  // buildTreeFromFilesystem() takes the raw filesystem tree and the DB case
  // index, and returns TreeNode[] for rendering.  The DB data adds colors and
  // labels but NEVER determines which nodes appear.  If it's on disk, it shows.

  const treeData = useMemo(() => {
    let tree = buildTreeFromFilesystem(fsTree, casesByNumber)

    // Apply filters — these filter CASE FOLDERS by DB metadata, but
    // non-case entries (system folders, loose files) always show
    if (stageFilter !== 'all' || typeFilter !== 'all') {
      tree = tree.filter((node) => {
        // Always show non-case nodes (dashboard, settings, system, loose files)
        if (!node.id.startsWith('case-folder:')) return true

        const caseId = node.caseId
        if (caseId == null) return true // No DB match — show it anyway

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
  // NODE CLICK HANDLER — opens appropriate tab based on node type
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

      // For folder nodes with children, just toggle expand (handled by chevron)
      // No-op for folders clicked on the label — they just expand/activate
    },
    [cases, onOpenTab],
  )

  // =========================================================================
  // RENDER
  // =========================================================================

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
      {/* Panel header */}
      <div
        className="panel-header"
        style={{
          display: 'flex',
          alignItems: 'center',
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
          flexShrink: 0,
          gap: 6,
        }}
      >
        <span>CASES</span>
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

      {/* Tree container */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '4px 0',
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
            Loading…
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

      {/* Resources panel */}
      <div
        style={{
          borderTop: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        <div
          className="panel-header"
          style={{
            display: 'flex',
            alignItems: 'center',
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
          RESOURCES
        </div>
        <div
          style={{
            padding: '8px 12px',
            fontSize: 12,
            color: 'var(--text-secondary)',
          }}
        >
          <div
            style={{
              cursor: 'pointer',
              padding: '4px 0',
              transition: 'color 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--accent)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-secondary)'
            }}
          >
            DSM-5-TR Reference
          </div>
          <div
            style={{
              cursor: 'pointer',
              padding: '4px 0',
              transition: 'color 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--accent)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-secondary)'
            }}
          >
            Colorado CST Statute
          </div>
          <div
            style={{
              cursor: 'pointer',
              padding: '4px 0',
              transition: 'color 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--accent)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-secondary)'
            }}
          >
            Dusky Standard
          </div>
        </div>
      </div>
    </div>
  )
}
