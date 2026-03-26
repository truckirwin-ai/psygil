import { useCallback, useRef } from 'react'

interface VSplitterProps {
  readonly onResize: (delta: number) => void
  readonly onResizeEnd?: () => void
}

export default function VSplitter({ onResize, onResizeEnd }: VSplitterProps): React.JSX.Element {
  const startX = useRef(0)

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      startX.current = e.clientX
      document.body.classList.add('col-resizing')

      const handleMouseMove = (ev: MouseEvent): void => {
        const delta = ev.clientX - startX.current
        startX.current = ev.clientX
        onResize(delta)
      }

      const handleMouseUp = (): void => {
        document.body.classList.remove('col-resizing')
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        onResizeEnd?.()
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [onResize, onResizeEnd]
  )

  return (
    <div
      className="v-splitter"
      onMouseDown={handleMouseDown}
      style={{
        width: 2,
        minWidth: 2,
        maxWidth: 2,
        cursor: 'col-resize',
        background: 'var(--border)',
        transition: 'background 0.15s',
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--accent)'
      }}
      onMouseLeave={(e) => {
        if (!document.body.classList.contains('col-resizing')) {
          e.currentTarget.style.background = 'var(--border)'
        }
      }}
    />
  )
}
