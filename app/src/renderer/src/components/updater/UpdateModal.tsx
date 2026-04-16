/**
 * UpdateModal
 *
 * Displays when the main process fires updater:updateAvailable.
 * Shows version, release notes (rendered from Markdown), and Install Now / Later buttons.
 * On Install Now: calls updater.download() and shows a progress bar.
 *
 * Usage:
 *   Mount <UpdateModal /> once near the root of the app tree. It manages its
 *   own visibility state by listening for the updater:updateAvailable event.
 *
 *   Optionally pass onClose to be notified when the modal is dismissed.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { marked } from 'marked'
import type { UpdateAvailableEvent, UpdateDownloadProgressEvent } from '../../../../shared/types/ipc'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Phase = 'idle' | 'downloading' | 'ready' | 'error'

interface DownloadState {
  readonly percent: number
  readonly bytesDownloaded: number
  readonly totalBytes: number
}

interface UpdateModalProps {
  readonly onClose?: () => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
}

function renderMarkdown(md: string): string {
  const result = marked.parse(md)
  if (typeof result === 'string') return result
  return md
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function UpdateModal({ onClose }: UpdateModalProps): React.ReactElement | null {
  const [visible, setVisible] = useState(false)
  const [event, setEvent] = useState<UpdateAvailableEvent | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [download, setDownload] = useState<DownloadState>({ percent: 0, bytesDownloaded: 0, totalBytes: 0 })
  const [errorMessage, setErrorMessage] = useState<string>('')

  const cleanupRef = useRef<Array<() => void>>([])

  const handleClose = useCallback(() => {
    setVisible(false)
    setPhase('idle')
    onClose?.()
  }, [onClose])

  useEffect(() => {
    const removeUpdate = window.psygil.updater.onUpdateAvailable((data) => {
      setEvent(data)
      setVisible(true)
      setPhase('idle')
    })

    const removeProgress = window.psygil.updater.onDownloadProgress((data: UpdateDownloadProgressEvent) => {
      setDownload({
        percent: data.percent,
        bytesDownloaded: data.bytesDownloaded,
        totalBytes: data.totalBytes,
      })
    })

    cleanupRef.current = [removeUpdate, removeProgress]
    return () => {
      cleanupRef.current.forEach((fn) => fn())
    }
  }, [])

  const handleInstall = useCallback(async () => {
    if (event === null) return
    setPhase('downloading')
    setDownload({ percent: 0, bytesDownloaded: 0, totalBytes: 0 })
    try {
      const result = await window.psygil.updater.download({ version: event.version })
      if (!result.ok) {
        setPhase('error')
        setErrorMessage(result.message)
        return
      }
      setPhase('ready')
    } catch (err) {
      setPhase('error')
      setErrorMessage(err instanceof Error ? err.message : 'Download failed')
    }
  }, [event])

  if (!visible || event === null) return null

  const notesHtml = event.releaseNotes.length > 0
    ? renderMarkdown(event.releaseNotes)
    : '<p>No release notes available.</p>'

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.65)', /* themed:skip - modal scrim */
        backdropFilter: 'blur(4px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose()
      }}
    >
      <div
        style={{
          background: 'var(--panel)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          width: '480px',
          maxWidth: '90vw',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)', /* themed:skip - shadow */
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text)' }}>
                Update Available
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Version {event.version}
                {event.downloadSize > 0 && (
                  <span style={{ marginLeft: '8px', color: 'var(--accent)' }}>
                    ({formatBytes(event.downloadSize)})
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={handleClose}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '18px',
                lineHeight: 1,
                padding: '4px',
              }}
            >
              x
            </button>
          </div>
        </div>

        {/* Release notes */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 24px',
            fontSize: '13px',
            color: 'var(--text)',
            lineHeight: 1.6,
          }}
          dangerouslySetInnerHTML={{ __html: notesHtml }}
        />

        {/* Progress bar (downloading phase) */}
        {phase === 'downloading' && (
          <div style={{ padding: '0 24px 8px' }}>
            <div style={{
              height: '4px',
              background: 'var(--border)',
              borderRadius: '2px',
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                background: 'var(--accent)',
                borderRadius: '2px',
                width: `${download.percent}%`,
                transition: 'width 0.2s ease',
              }} />
            </div>
            <div style={{ fontSize: '12px', color: '#8b949e', marginTop: '4px', textAlign: 'center' }}>
              {download.percent}%
              {download.totalBytes > 0 && (
                <span>
                  {' '}({formatBytes(download.bytesDownloaded)} / {formatBytes(download.totalBytes)})
                </span>
              )}
            </div>
          </div>
        )}

        {/* Error message */}
        {phase === 'error' && (
          <div style={{
            margin: '0 24px 12px',
            padding: '10px 14px',
            background: 'color-mix(in srgb, var(--danger) 12%, transparent)',
            border: '1px solid color-mix(in srgb, var(--danger) 30%, transparent)',
            borderRadius: '6px',
            fontSize: '13px',
            color: 'var(--danger)',
          }}>
            {errorMessage}
          </div>
        )}

        {/* Ready to install */}
        {phase === 'ready' && (
          <div style={{
            margin: '0 24px 12px',
            padding: '10px 14px',
            background: 'color-mix(in srgb, var(--success) 12%, transparent)',
            border: '1px solid color-mix(in srgb, var(--success) 30%, transparent)',
            borderRadius: '6px',
            fontSize: '13px',
            color: 'var(--success)',
          }}>
            Download complete. The installer will launch and the app will close.
          </div>
        )}

        {/* Footer buttons */}
        <div style={{
          padding: '12px 24px 20px',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '8px',
          borderTop: '1px solid var(--border)',
        }}>
          <button
            onClick={handleClose}
            disabled={phase === 'downloading'}
            style={{
              padding: '8px 16px',
              background: 'var(--panel)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              color: 'var(--text)',
              cursor: phase === 'downloading' ? 'not-allowed' : 'pointer',
              fontSize: '13px',
              opacity: phase === 'downloading' ? 0.5 : 1,
            }}
          >
            Later
          </button>
          <button
            onClick={handleInstall}
            disabled={phase === 'downloading' || phase === 'ready'}
            style={{
              padding: '8px 16px',
              background: 'var(--success)',
              border: 'none',
              borderRadius: '6px',
              color: 'var(--field-bg)',
              cursor: phase === 'downloading' || phase === 'ready' ? 'not-allowed' : 'pointer',
              fontSize: '13px',
              fontWeight: 500,
              opacity: phase === 'downloading' || phase === 'ready' ? 0.7 : 1,
            }}
          >
            {phase === 'downloading' ? 'Downloading...' : phase === 'ready' ? 'Installing...' : 'Install Now'}
          </button>
        </div>
      </div>
    </div>
  )
}
