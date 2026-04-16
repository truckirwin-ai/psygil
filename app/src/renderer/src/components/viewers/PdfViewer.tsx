// PdfViewer: renders a PDF from base64 data using Mozilla pdf.js (canvas-based).
// No dependency on Chromium's built-in PDF plugin, works in sandboxed Electron.

import { useEffect, useRef, useState, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore Vite ?url import resolves the worker to a servable URL
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl

interface PdfViewerProps {
  /** Raw base64-encoded PDF bytes */
  readonly base64: string
}

export default function PdfViewer({ base64 }: PdfViewerProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const [pageCount, setPageCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [scale, setScale] = useState(1.2)
  const [rendering, setRendering] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null)
  const renderTaskRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load the PDF document
  useEffect(() => {
    let cancelled = false
    setRendering(true)
    setErr(null)

    const load = async (): Promise<void> => {
      try {
        // Decode base64 into Uint8Array
        const raw = atob(base64)
        const bytes = new Uint8Array(raw.length)
        for (let i = 0; i < raw.length; i++) {
          bytes[i] = raw.charCodeAt(i)
        }


        const loadingTask = pdfjsLib.getDocument({
          data: bytes.slice(0), // copy to avoid transfer issues
          useWorkerFetch: false,
          isEvalSupported: false,
          useSystemFonts: true,
        })

        const doc = await loadingTask.promise
        if (cancelled) {
          doc.destroy()
          return
        }
        pdfDocRef.current = doc
        setPageCount(doc.numPages)
        setCurrentPage(1)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        if (!cancelled) {
          setErr(msg)
        }
      } finally {
        if (!cancelled) setRendering(false)
      }
    }

    void load()
    return () => {
      cancelled = true
      if (pdfDocRef.current) {
        pdfDocRef.current.destroy()
        pdfDocRef.current = null
      }
    }
  }, [base64])

  // Render all pages into canvases
  const renderPages = useCallback(async () => {
    const doc = pdfDocRef.current
    const container = containerRef.current
    if (!doc || !container) return

    // Clear previous canvases
    container.innerHTML = ''
    setRendering(true)

    try {
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i)
        const viewport = page.getViewport({ scale })

        const canvas = document.createElement('canvas')
        canvas.width = viewport.width
        canvas.height = viewport.height
        canvas.style.display = 'block'
        canvas.style.marginBottom = '8px'
        canvas.style.boxShadow = '0 1px 4px rgba(0,0,0,0.15)' // themed:skip - shadow
        canvas.style.background = '#fff' // themed:skip - PDF pages are always white
        canvas.dataset.page = String(i)

        container.appendChild(canvas)

        const ctx = canvas.getContext('2d')!
        await page.render({ canvasContext: ctx, viewport }).promise
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setErr(msg)
    } finally {
      setRendering(false)
    }
  }, [scale])

  // Re-render when doc loads or scale changes
  useEffect(() => {
    if (!pdfDocRef.current || pageCount === 0) return
    if (renderTaskRef.current) clearTimeout(renderTaskRef.current)
    renderTaskRef.current = setTimeout(() => { void renderPages() }, 80)
    return () => {
      if (renderTaskRef.current) clearTimeout(renderTaskRef.current)
    }
  }, [pageCount, scale, renderPages])

  // Track which page is visible on scroll
  const handleScroll = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    const canvases = container.querySelectorAll('canvas')
    const scrollTop = container.scrollTop
    const containerMid = scrollTop + container.clientHeight / 3

    let closestPage = 1
    let closestDist = Infinity
    canvases.forEach((c) => {
      const pageMid = c.offsetTop + c.height / 2
      const dist = Math.abs(pageMid - containerMid)
      if (dist < closestDist) {
        closestDist = dist
        closestPage = Number(c.dataset.page ?? 1)
      }
    })
    setCurrentPage(closestPage)
  }, [])

  if (err) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--danger)', fontSize: 13 }}>
        <p>PDF load error: {err}</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '6px 16px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--panel)',
          fontSize: 12,
          color: 'var(--text-secondary)',
          flexShrink: 0,
        }}
      >
        <span>
          Page {currentPage} of {pageCount || '...'}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => setScale((s) => Math.max(0.5, s - 0.2))}
            style={zoomBtnStyle}
            title="Zoom out"
          >
            -
          </button>
          <span style={{ minWidth: 42, textAlign: 'center' }}>{Math.round(scale * 100)}%</span>
          <button
            onClick={() => setScale((s) => Math.min(3.0, s + 0.2))}
            style={zoomBtnStyle}
            title="Zoom in"
          >
            +
          </button>
          <button
            onClick={() => setScale(1.2)}
            style={{ ...zoomBtnStyle, padding: '2px 8px' }}
            title="Reset zoom"
          >
            Reset
          </button>
        </div>
        {rendering && <span style={{ color: 'var(--text-tertiary)' }}>Rendering...</span>}
      </div>

      {/* Pages container */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '16px',
          background: '#525659', /* themed:skip - intentional neutral gray viewer mat */
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      />
    </div>
  )
}

const zoomBtnStyle: React.CSSProperties = {
  padding: '2px 8px',
  fontSize: 13,
  fontWeight: 600,
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 3,
  color: 'var(--text)',
  cursor: 'pointer',
  lineHeight: '18px',
}
