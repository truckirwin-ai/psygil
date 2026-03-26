import { useState, useEffect, useCallback } from 'react'
import type { FolderNode } from '../../../../shared/types'

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

type WorkspaceState =
  | { readonly status: 'loading' }
  | { readonly status: 'no-workspace' }
  | { readonly status: 'ready'; readonly tree: readonly FolderNode[] }

// ---------------------------------------------------------------------------
// LeftColumn
// ---------------------------------------------------------------------------

export default function LeftColumn(): React.JSX.Element {
  const [wsState, setWsState] = useState<WorkspaceState>({ status: 'loading' })

  const loadTree = useCallback(async () => {
    const treeResp = await window.psygil.workspace.getTree()
    if (treeResp.status === 'success') {
      setWsState({ status: 'ready', tree: treeResp.data })
    }
  }, [])

  // On mount: check if workspace is configured
  useEffect(() => {
    let cancelled = false

    async function init(): Promise<void> {
      const resp = await window.psygil.workspace.getPath()
      if (cancelled) return

      if (resp.status === 'success' && resp.data !== null) {
        await loadTree()
      } else {
        setWsState({ status: 'no-workspace' })
      }
    }

    init()
    return () => { cancelled = true }
  }, [loadTree])

  // Listen for file-changed events and refresh tree
  useEffect(() => {
    if (wsState.status !== 'ready') return

    window.psygil.workspace.onFileChanged(() => {
      loadTree()
    })

    return () => {
      window.psygil.workspace.offFileChanged()
    }
  }, [wsState.status, loadTree])

  // Handle folder selection (shared by overlay and "Change" action)
  const handleChooseFolder = useCallback(async () => {
    const pickResp = await window.psygil.workspace.pickFolder()
    if (pickResp.status !== 'success' || pickResp.data === null) return

    const setResp = await window.psygil.workspace.setPath(pickResp.data)
    if (setResp.status === 'success') {
      await loadTree()
    }
  }, [loadTree])

  const handleUseDefault = useCallback(async () => {
    const defaultResp = await window.psygil.workspace.getDefaultPath()
    if (defaultResp.status !== 'success') return

    const setResp = await window.psygil.workspace.setPath(defaultResp.data)
    if (setResp.status === 'success') {
      await loadTree()
    }
  }, [loadTree])

  // First-launch overlay
  if (wsState.status === 'no-workspace') {
    return <WelcomeOverlay onChoose={handleChooseFolder} onUseDefault={handleUseDefault} />
  }

  // Loading state
  if (wsState.status === 'loading') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)', fontSize: 13 }}>
        Loading…
      </div>
    )
  }

  // Ready — render workspace tree
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)', overflow: 'hidden' }}>
      {/* WORKSPACE panel header */}
      <div className="panel-header">
        <span className="panel-header-title">Workspace</span>
        <button className="panel-hdr-btn" aria-label="Refresh" title="Refresh" onClick={loadTree}>
          &#8635;
        </button>
        <button className="panel-hdr-btn" aria-label="Open in Finder" title="Open in Finder" onClick={async () => {
          const resp = await window.psygil.workspace.getPath()
          if (resp.status === 'success' && resp.data !== null) {
            window.psygil.workspace.openInFinder(resp.data)
          }
        }}>
          &#8599;
        </button>
      </div>

      {/* Tree area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {wsState.tree.length === 0 ? (
          <div style={{ padding: '16px 12px', fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center' }}>
            Workspace is empty.
            <br />
            Drop files into this folder to get started.
          </div>
        ) : (
          wsState.tree.map((node) => (
            <TreeNode key={node.path} node={node} depth={0} />
          ))
        )}
      </div>

      {/* RESOURCES panel */}
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
// TreeNode — recursive folder/file renderer
// ---------------------------------------------------------------------------

function TreeNode({
  node,
  depth,
}: {
  readonly node: FolderNode
  readonly depth: number
}): React.JSX.Element {
  const [expanded, setExpanded] = useState(depth < 1) // auto-expand top level

  const handleClick = useCallback(() => {
    if (node.isDirectory) {
      setExpanded((prev) => !prev)
    } else {
      window.psygil.workspace.openInFinder(node.path)
    }
  }, [node.isDirectory, node.path])

  const icon = node.isDirectory ? '\u{1F4C1}' : '\u{1F4C4}'
  const arrow = node.isDirectory ? (expanded ? '\u25BE' : '\u25B8') : ''

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
        onClick={handleClick}
      >
        <span style={{ width: 16, fontSize: 10, color: 'var(--text-secondary)', flexShrink: 0, textAlign: 'center' }}>
          {arrow}
        </span>
        <span style={{ width: 16, height: 16, fontSize: 14, flexShrink: 0 }}>
          {icon}
        </span>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {node.name}
        </span>
      </div>
      {node.isDirectory && expanded && node.children != null && node.children.map((child) => (
        <TreeNode key={child.path} node={child} depth={depth + 1} />
      ))}
    </>
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
      <div style={{ fontSize: 32, marginBottom: 12 }}>
        {'\u{1F4C2}'}
      </div>
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
