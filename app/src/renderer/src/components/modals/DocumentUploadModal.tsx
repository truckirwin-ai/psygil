/**
 * DocumentUploadModal
 *
 * Drag-and-drop file upload with subfolder selection, progress tracking,
 * and batch ingestion. Supports both drop zone and native file picker.
 *
 * Usage:
 *   <DocumentUploadModal
 *     caseId={42}
 *     onClose={() => setShow(false)}
 *     onUploadComplete={() => refreshDocList()}
 *   />
 */

import { useState, useCallback, useRef } from 'react'
import type { DocumentRow } from '../../../../shared/types/ipc'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CaseSubfolder = '_Inbox' | 'Collateral' | 'Testing' | 'Interviews' | 'Diagnostics' | 'Reports' | 'Archive'

interface QueuedFile {
  readonly id: string
  readonly name: string
  readonly path: string
  readonly size: number
  readonly subfolder: CaseSubfolder
  status: 'pending' | 'uploading' | 'done' | 'error'
  error?: string
  result?: DocumentRow
}

interface DocumentUploadModalProps {
  readonly caseId: number
  /** Pre-select a subfolder (e.g. "Testing" when uploading score reports) */
  readonly defaultSubfolder?: CaseSubfolder
  readonly onClose: () => void
  readonly onUploadComplete?: () => void
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUBFOLDERS: { value: CaseSubfolder; label: string }[] = [
  { value: '_Inbox', label: 'Inbox (Unsorted)' },
  { value: 'Collateral', label: 'Collateral Records' },
  { value: 'Testing', label: 'Testing / Score Reports' },
  { value: 'Interviews', label: 'Interview Notes' },
  { value: 'Diagnostics', label: 'Diagnostics' },
  { value: 'Reports', label: 'Reports' },
  { value: 'Archive', label: 'Archive' },
]

const ACCEPTED_EXTENSIONS = ['.pdf', '.docx', '.doc', '.txt', '.csv', '.rtf', '.vtt', '.json']

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

let nextId = 0

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DocumentUploadModal({
  caseId,
  defaultSubfolder = '_Inbox',
  onClose,
  onUploadComplete,
}: DocumentUploadModalProps): React.JSX.Element {
  const [queue, setQueue] = useState<QueuedFile[]>([])
  const [subfolder, setSubfolder] = useState<CaseSubfolder>(defaultSubfolder)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const dropRef = useRef<HTMLDivElement>(null)

  // -----------------------------------------------------------------------
  // Add files to queue
  // -----------------------------------------------------------------------

  const addFiles = useCallback((paths: string[], names: string[], sizes: number[]) => {
    const newFiles: QueuedFile[] = paths.map((path, i) => ({
      id: `file-${++nextId}`,
      name: names[i] ?? path.split('/').pop() ?? 'unknown',
      path,
      size: sizes[i] ?? 0,
      subfolder,
      status: 'pending' as const,
    }))
    setQueue((prev) => [...prev, ...newFiles])
  }, [subfolder])

  // -----------------------------------------------------------------------
  // Drop handler
  // -----------------------------------------------------------------------

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    const files = Array.from(e.dataTransfer.files)
    if (files.length === 0) return

    const paths: string[] = []
    const names: string[] = []
    const sizes: number[] = []

    for (const file of files) {
      const ext = '.' + file.name.split('.').pop()?.toLowerCase()
      if (!ACCEPTED_EXTENSIONS.includes(ext)) continue
      const filePath = window.psygil.documents.getDroppedFilePath(file)
      if (!filePath) continue
      paths.push(filePath)
      names.push(file.name)
      sizes.push(file.size)
    }

    if (paths.length > 0) {
      addFiles(paths, names, sizes)
    }
  }, [addFiles])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // Only leave if actually leaving the drop zone
    if (dropRef.current && !dropRef.current.contains(e.relatedTarget as Node)) {
      setIsDragOver(false)
    }
  }, [])

  // -----------------------------------------------------------------------
  // File picker handler
  // -----------------------------------------------------------------------

  const handlePickFiles = useCallback(async () => {
    try {
      const resp = await window.psygil.documents.pickFiles()
      if (resp.status === 'success' && resp.data.filePaths.length > 0) {
        const paths = resp.data.filePaths as string[]
        const names = paths.map((p) => p.split('/').pop() ?? 'unknown')
        const sizes = paths.map(() => 0) // size will be determined during ingest
        addFiles(paths, names, sizes)
      }
    } catch {
      // User cancelled or error
    }
  }, [addFiles])

  // -----------------------------------------------------------------------
  // Remove file from queue
  // -----------------------------------------------------------------------

  const removeFile = useCallback((fileId: string) => {
    setQueue((prev) => prev.filter((f) => f.id !== fileId))
  }, [])

  // -----------------------------------------------------------------------
  // Change subfolder for a queued file
  // -----------------------------------------------------------------------

  const changeFileSubfolder = useCallback((fileId: string, newSubfolder: CaseSubfolder) => {
    setQueue((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, subfolder: newSubfolder } : f))
    )
  }, [])

  // -----------------------------------------------------------------------
  // Upload all pending files
  // -----------------------------------------------------------------------

  const handleUploadAll = useCallback(async () => {
    const pending = queue.filter((f) => f.status === 'pending')
    if (pending.length === 0) return

    setIsUploading(true)

    for (const file of pending) {
      // Mark as uploading
      setQueue((prev) =>
        prev.map((f) => (f.id === file.id ? { ...f, status: 'uploading' as const } : f))
      )

      try {
        const resp = await window.psygil.documents.ingest({
          case_id: caseId,
          file_path: file.path,
          subfolder: file.subfolder,
        })

        if (resp.status === 'success') {
          setQueue((prev) =>
            prev.map((f) =>
              f.id === file.id
                ? { ...f, status: 'done' as const, result: resp.data as DocumentRow }
                : f
            )
          )
        } else {
          setQueue((prev) =>
            prev.map((f) =>
              f.id === file.id
                ? { ...f, status: 'error' as const, error: (resp as { message?: string }).message ?? 'Upload failed' }
                : f
            )
          )
        }
      } catch (err) {
        setQueue((prev) =>
          prev.map((f) =>
            f.id === file.id
              ? { ...f, status: 'error' as const, error: err instanceof Error ? err.message : 'Upload failed' }
              : f
          )
        )
      }
    }

    setIsUploading(false)
    onUploadComplete?.()
  }, [queue, caseId, onUploadComplete])

  // -----------------------------------------------------------------------
  // Derived state
  // -----------------------------------------------------------------------

  const pendingCount = queue.filter((f) => f.status === 'pending').length
  const doneCount = queue.filter((f) => f.status === 'done').length
  const errorCount = queue.filter((f) => f.status === 'error').length
  const uploadingCount = queue.filter((f) => f.status === 'uploading').length

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isUploading) onClose()
      }}
    >
      <div
        style={{
          width: 600,
          maxHeight: '80vh',
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>
            Upload Documents
          </h2>
          <button
            onClick={onClose}
            disabled={isUploading}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 18,
              color: 'var(--text-secondary)',
              cursor: isUploading ? 'not-allowed' : 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {/* Default subfolder selector */}
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: 'block',
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--text-secondary)',
                marginBottom: 6,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              Default Destination Folder
            </label>
            <select
              value={subfolder}
              onChange={(e) => setSubfolder(e.currentTarget.value as CaseSubfolder)}
              style={{
                width: '100%',
                padding: '8px 10px',
                fontSize: 13,
                background: 'var(--panel)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: 4,
              }}
            >
              {SUBFOLDERS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {/* Drop zone */}
          <div
            ref={dropRef}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            style={{
              border: `2px dashed ${isDragOver ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 8,
              padding: '32px 20px',
              textAlign: 'center',
              background: isDragOver ? 'rgba(33,150,243,0.08)' : 'var(--panel)',
              transition: 'all 0.2s',
              cursor: 'pointer',
              marginBottom: 16,
            }}
            onClick={handlePickFiles}
          >
            <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.5 }}>
              {isDragOver ? '⬇' : '📄'}
            </div>
            <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500, marginBottom: 4 }}>
              {isDragOver ? 'Drop files here' : 'Drag & drop files here'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              or click to browse, PDF, DOCX, TXT, CSV, RTF
            </div>
          </div>

          {/* File queue */}
          {queue.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  marginBottom: 4,
                }}
              >
                Files ({queue.length})
              </div>

              {queue.map((file) => (
                <div
                  key={file.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 10px',
                    background: 'var(--panel)',
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                    borderLeftWidth: 3,
                    borderLeftColor:
                      file.status === 'done'
                        ? '#4caf50'
                        : file.status === 'error'
                          ? '#f44336'
                          : file.status === 'uploading'
                            ? '#ff9800'
                            : 'var(--border)',
                  }}
                >
                  {/* Status indicator */}
                  <span style={{ fontSize: 14, flexShrink: 0, width: 18, textAlign: 'center' }}>
                    {file.status === 'done'
                      ? '✓'
                      : file.status === 'error'
                        ? '✗'
                        : file.status === 'uploading'
                          ? '↻'
                          : '○'}
                  </span>

                  {/* File info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        color: 'var(--text)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {file.name}
                    </div>
                    {file.error && (
                      <div style={{ fontSize: 11, color: '#f44336', marginTop: 2 }}>
                        {file.error}
                      </div>
                    )}
                  </div>

                  {/* Subfolder selector per file */}
                  {file.status === 'pending' && (
                    <select
                      value={file.subfolder}
                      onChange={(e) =>
                        changeFileSubfolder(file.id, e.currentTarget.value as CaseSubfolder)
                      }
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        padding: '2px 6px',
                        fontSize: 11,
                        background: 'var(--bg)',
                        color: 'var(--text)',
                        border: '1px solid var(--border)',
                        borderRadius: 3,
                        flexShrink: 0,
                      }}
                    >
                      {SUBFOLDERS.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  )}

                  {/* Size */}
                  {file.size > 0 && (
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)', flexShrink: 0 }}>
                      {formatBytes(file.size)}
                    </span>
                  )}

                  {/* Remove button */}
                  {file.status === 'pending' && (
                    <button
                      onClick={() => removeFile(file.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        fontSize: 14,
                        padding: '0 2px',
                        flexShrink: 0,
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--panel)',
          }}
        >
          {/* Status summary */}
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {isUploading
              ? `Uploading\u2026 ${uploadingCount} in progress`
              : queue.length > 0
                ? `${pendingCount} pending, ${doneCount} done${errorCount > 0 ? `, ${errorCount} failed` : ''}`
                : 'No files selected'}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onClose}
              disabled={isUploading}
              style={{
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 500,
                border: '1px solid var(--border)',
                borderRadius: 4,
                background: 'var(--panel)',
                color: 'var(--text)',
                cursor: isUploading ? 'not-allowed' : 'pointer',
              }}
            >
              {doneCount > 0 && pendingCount === 0 ? 'Done' : 'Cancel'}
            </button>

            {pendingCount > 0 && (
              <button
                onClick={handleUploadAll}
                disabled={isUploading}
                style={{
                  padding: '8px 16px',
                  fontSize: 13,
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: 4,
                  background: 'var(--accent)',
                  color: '#ffffff',
                  cursor: isUploading ? 'wait' : 'pointer',
                }}
              >
                {isUploading ? 'Uploading\u2026' : `Upload ${pendingCount} File${pendingCount > 1 ? 's' : ''}`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
