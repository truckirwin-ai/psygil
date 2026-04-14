import { useCallback, useRef } from 'react'

interface HSplitterProps {
  readonly onResize: (delta: number) => void
  readonly onResizeEnd?: () => void
}

export default function HSplitter({ onResize, onResizeEnd }: HSplitterProps): React.JSX.Element {
  const startY = useRef(0)

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      startY.current = e.clientY
      document.body.classList.add('row-resizing')

      const handleMouseMove = (ev: MouseEvent): void => {
        const delta = ev.clientY - startY.current
        startY.current = ev.clientY
        onResize(delta)
      }

      const handleMouseUp = (): void => {
        document.body.classList.remove('row-resizing')
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
      className="h-splitter"
      onMouseDown={handleMouseDown}
      style={{
        height: 2,
        minHeight: 2,
        maxHeight: 2,
        cursor: 'row-resize',
        background: 'var(--border)',
        transition: 'background 0.15s',
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--accent)'
      }}
      onMouseLeave={(e) => {
        if (!document.body.classList.contains('row-resizing')) {
          e.currentTarget.style.background = 'var(--border)'
        }
      }}
    />
  )
}
