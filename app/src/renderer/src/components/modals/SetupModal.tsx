/**
 * SetupModal — workspace folder picker.
 *
 * Opens a system file picker (via Electron dialog on main process),
 * persists the chosen path, and triggers a workspace reload.
 * Can also be triggered from the "Setup" titlebar nav link.
 */

import { useState, useEffect, useCallback } from 'react'

interface SetupModalProps {
  readonly isOpen: boolean
  readonly onClose: () => void
  /** Called after a workspace path is successfully set. */
  readonly onWorkspaceSet: () => void
}

export default function SetupModal({ isOpen, onClose, onWorkspaceSet }: SetupModalProps): React.JSX.Element | null {
  const [currentPath, setCurrentPath] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<{ kind: 'idle' | 'success' | 'error'; message?: string }>({ kind: 'idle' })

  // Load current workspace path when modal opens
  useEffect(() => {
    if (!isOpen) return
    setStatus({ kind: 'idle' })
    window.psygil?.workspace?.getPath?.().then((resp) => {
      if (resp?.status === 'success') setCurrentPath(resp.data)
    })
  }, [isOpen])

  const handlePickFolder = useCallback(async () => {
    setLoading(true)
    setStatus({ kind: 'idle' })
    try {
      const pickResp = await window.psygil?.workspace?.pickFolder?.()
      if (!pickResp || pickResp.status !== 'success' || pickResp.data === null) {
        // User cancelled — no-op
        setLoading(false)
        return
      }
      const chosenPath = pickResp.data
      const setResp = await window.psygil?.workspace?.setPath?.(chosenPath)
      if (setResp?.status === 'success') {
        setCurrentPath(chosenPath)
        setStatus({ kind: 'success', message: 'Workspace updated.' })
        onWorkspaceSet()
      } else {
        setStatus({ kind: 'error', message: setResp?.error?.message ?? 'Failed to set workspace.' })
      }
    } catch (e) {
      setStatus({ kind: 'error', message: e instanceof Error ? e.message : 'Unknown error' })
    } finally {
      setLoading(false)
    }
  }, [onWorkspaceSet])

  const handleUseDefault = useCallback(async () => {
    setLoading(true)
    setStatus({ kind: 'idle' })
    try {
      const defaultResp = await window.psygil?.workspace?.getDefaultPath?.()
      if (defaultResp?.status !== 'success') {
        setStatus({ kind: 'error', message: 'Could not get default path.' })
        setLoading(false)
        return
      }
      const setResp = await window.psygil?.workspace?.setPath?.(defaultResp.data)
      if (setResp?.status === 'success') {
        setCurrentPath(defaultResp.data)
        setStatus({ kind: 'success', message: 'Workspace set to default.' })
        onWorkspaceSet()
      } else {
        setStatus({ kind: 'error', message: setResp?.error?.message ?? 'Failed to set workspace.' })
      }
    } catch (e) {
      setStatus({ kind: 'error', message: e instanceof Error ? e.message : 'Unknown error' })
    } finally {
      setLoading(false)
    }
  }, [onWorkspaceSet])

  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Workspace Setup"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          background: 'var(--panel)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          width: 480,
          maxWidth: '90vw',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
            Workspace Setup
          </span>
          <button
            aria-label="Close"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: 18,
              lineHeight: 1,
              padding: '0 4px',
            }}
          >
            &#10005;
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px 20px' }}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.6 }}>
            Choose the root folder where Psygil stores your case files, documents, and reports.
            This folder will be created if it doesn&apos;t exist.
          </p>

          {/* Current path display */}
          <div
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              padding: '10px 14px',
              marginBottom: 20,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>
              Current Workspace
            </div>
            <div style={{ fontSize: 12, color: currentPath ? 'var(--text)' : 'var(--text-secondary)', fontFamily: 'monospace', wordBreak: 'break-all' }}>
              {currentPath ?? 'Not configured'}
            </div>
          </div>

          {/* Status message */}
          {status.kind !== 'idle' && (
            <div
              style={{
                padding: '8px 12px',
                borderRadius: 4,
                marginBottom: 16,
                fontSize: 12,
                background: status.kind === 'success' ? 'rgba(76,175,80,0.12)' : 'rgba(244,67,54,0.12)',
                color: status.kind === 'success' ? '#4caf50' : '#f44336',
                border: `1px solid ${status.kind === 'success' ? 'rgba(76,175,80,0.3)' : 'rgba(244,67,54,0.3)'}`,
              }}
            >
              {status.message}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              onClick={handlePickFolder}
              disabled={loading}
              style={{
                background: 'var(--accent)',
                color: '#ffffff',
                border: 'none',
                borderRadius: 4,
                padding: '10px 20px',
                fontSize: 13,
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <span style={{ fontSize: 16 }}>&#128193;</span>
              {loading ? 'Opening…' : 'Choose Folder…'}
            </button>

            <button
              onClick={handleUseDefault}
              disabled={loading}
              style={{
                background: 'transparent',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                padding: '10px 20px',
                fontSize: 13,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <span style={{ fontSize: 16 }}>&#127968;</span>
              Use Default (~/Documents/Psygil Cases/)
            </button>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            padding: '12px 20px',
            borderTop: '1px solid var(--border)',
            gap: 8,
          }}
        >
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              padding: '7px 18px',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
