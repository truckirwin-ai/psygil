import React, { useEffect, useRef, useState } from 'react'

/**
 * OnlyOfficeEditor, Sprint 10
 *
 * Reusable component that embeds OnlyOffice Document Editor via iframe.
 *
 * Features:
 * - Loads OnlyOffice API and initializes editor in an iframe
 * - Shows status message if OnlyOffice server is not running
 * - Supports read-only mode
 * - Callbacks for document ready, saved, and errors
 * - Proper cleanup on unmount
 */

export interface OnlyOfficeEditorProps {
  readonly caseId: number
  readonly filePath: string
  readonly readOnly?: boolean
  readonly onDocumentReady?: () => void
  readonly onDocumentSaved?: () => void
  readonly onError?: (message: string) => void
}

interface EditorState {
  serverUrl: string | null
  serverRunning: boolean
  loading: boolean
  error: string | null
}

export default function OnlyOfficeEditor({
  caseId,
  filePath,
  readOnly = false,
  onDocumentReady,
  onDocumentSaved,
  onError,
}: OnlyOfficeEditorProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<any>(null)
  const [state, setState] = useState<EditorState>({
    serverUrl: null,
    serverRunning: false,
    loading: true,
    error: null,
  })

  // Check OnlyOffice server status and initialize editor
  useEffect(() => {
    let cancelled = false

    const initialize = async () => {
      try {
        // Get server URL
        const urlRes = await window.psygil.onlyoffice.getUrl()
        if (cancelled) return

        if (urlRes.status === 'error') {
          setState((prev) => ({
            ...prev,
            serverRunning: false,
            loading: false,
            error: 'OnlyOffice server is not running',
          }))
          return
        }

        const serverUrl = urlRes.data
        if (!serverUrl) {
          setState((prev) => ({
            ...prev,
            serverRunning: false,
            loading: false,
            error: 'OnlyOffice server is not available',
          }))
          return
        }

        setState((prev) => ({
          ...prev,
          serverUrl,
          serverRunning: true,
        }))

        // Get document configuration
        const docRes = await window.psygil.onlyoffice.openDocument({
          caseId,
          filePath,
          readOnly,
        })

        if (cancelled) return

        if (docRes.status === 'error') {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: docRes.message || 'Failed to open document',
          }))
          onError?.(docRes.message || 'Failed to open document')
          return
        }

        const { documentUrl, jwtToken } = docRes.data

        // Load OnlyOffice API script
        const script = document.createElement('script')
        script.src = `${serverUrl}/web-apps/apps/api/documents/api.js`
        script.async = true

        script.onload = () => {
          if (cancelled || !containerRef.current) return

          try {
            // Create editor configuration
            const config = {
              document: {
                fileType: 'docx',
                key: `psygil_${caseId}_${Date.now()}`,
                title: 'Report Draft',
                url: documentUrl,
                permissions: {
                  edit: !readOnly,
                  download: true,
                  print: true,
                  review: !readOnly,
                  comment: !readOnly,
                },
              },
              documentType: 'word' as const,
              editorConfig: {
                mode: readOnly ? 'view' : 'edit',
                callbackUrl: docRes.data.callbackUrl || undefined,
                customization: {
                  autosave: true,
                  chat: false,
                  comments: !readOnly,
                  compactHeader: false,
                  compactToolbar: false,
                  feedback: false,
                  forcesave: true,
                  help: false,
                  hideRightMenu: false,
                  toolbarNoTabs: false,
                  macros: false,
                  macrosMode: 'disable',
                  plugins: false,
                },
                permissions: {
                  fillForms: false,
                  modifyContentControl: false,
                  modifyFilter: false,
                },
                user: {
                  id: 'clinician',
                  name: 'Clinician',
                },
              },
              token: jwtToken,
              type: 'desktop' as const,
              events: {
                onDocumentReady: () => {
                  setState((prev) => ({ ...prev, loading: false }))
                  onDocumentReady?.()
                },
                onError: (event: any) => {
                  const errorMsg = event?.data?.message ?? 'Unknown error'
                  setState((prev) => ({ ...prev, error: errorMsg }))
                  onError?.(errorMsg)
                },
                onDocumentStateChange: (event: any) => {
                  // Called when document is modified/saved
                  if (event?.data?.isSaved === false) {
                    onDocumentSaved?.()
                  }
                },
              },
            }

            // Initialize the DocsAPI editor
            const DocsAPI = (window as any).DocsAPI
            if (!DocsAPI) {
              throw new Error('DocsAPI not available')
            }

            editorRef.current = new DocsAPI.DocEditor(containerRef.current.id, config)
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to initialize editor'
            setState((prev) => ({ ...prev, loading: false, error: message }))
            onError?.(message)
          }
        }

        script.onerror = () => {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: 'Failed to load OnlyOffice API',
          }))
          onError?.('Failed to load OnlyOffice API')
        }

        document.head.appendChild(script)

        return () => {
          document.head.removeChild(script)
        }
      } catch (err) {
        if (cancelled) return
        const message = err instanceof Error ? err.message : 'Initialization error'
        setState((prev) => ({ ...prev, loading: false, error: message }))
        onError?.(message)
      }
    }

    initialize()

    return () => {
      cancelled = true
    }
  }, [caseId, filePath, readOnly, onDocumentReady, onDocumentSaved, onError])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (editorRef.current && typeof editorRef.current.destroyEditor === 'function') {
        try {
          editorRef.current.destroyEditor()
        } catch (err) {
          console.error('[OnlyOfficeEditor] Failed to destroy editor:', err)
        }
      }
    }
  }, [])

  // Loading state
  if (state.loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          backgroundColor: 'var(--bg)',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: '13px',
              color: 'var(--text)',
              marginBottom: '12px',
            }}
          >
            Loading document editor...
          </div>
          <div
            style={{
              width: '24px',
              height: '24px',
              margin: '0 auto',
              border: '2px solid var(--border)',
              borderTop: '2px solid var(--accent)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
        </div>
      </div>
    )
  }

  // Server not running
  if (!state.serverRunning) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          backgroundColor: 'var(--bg)',
          padding: '20px',
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: '400px' }}>
          <div
            style={{
              fontSize: '13px',
              color: 'var(--text)',
              marginBottom: '12px',
            }}
          >
            OnlyOffice Document Server is not running
          </div>
          <div
            style={{
              fontSize: '12px',
              color: 'var(--text-secondary)',
              marginBottom: '16px',
            }}
          >
            The server needs to be started to edit documents.
          </div>
          <button
            onClick={async () => {
              setState((prev) => ({ ...prev, loading: true }))
              try {
                const res = await window.psygil.onlyoffice.start()
                if (res.status === 'success') {
                  // Reload the page to reinitialize
                  window.location.reload()
                } else {
                  setState((prev) => ({
                    ...prev,
                    loading: false,
                    error: res.message || 'Failed to start server',
                  }))
                }
              } catch (err) {
                setState((prev) => ({
                  ...prev,
                  loading: false,
                  error: err instanceof Error ? err.message : 'Failed to start server',
                }))
              }
            }}
            style={{
              padding: '6px 16px',
              fontSize: '12px',
              backgroundColor: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Start OnlyOffice Server
          </button>
        </div>
      </div>
    )
  }

  // Error state
  if (state.error) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          backgroundColor: 'var(--bg)',
          padding: '20px',
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: '400px' }}>
          <div
            style={{
              fontSize: '13px',
              color: '#d32f2f',
              marginBottom: '8px',
            }}
          >
            Error loading document
          </div>
          <div
            style={{
              fontSize: '12px',
              color: 'var(--text-secondary)',
              marginBottom: '12px',
              whiteSpace: 'pre-wrap',
            }}
          >
            {state.error}
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '6px 16px',
              fontSize: '12px',
              backgroundColor: 'var(--border)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  // Editor container
  return (
    <div
      ref={containerRef}
      id={`onlyoffice-editor-${caseId}`}
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
      }}
    />
  )
}
