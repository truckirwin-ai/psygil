import { useState, useMemo, useCallback, useRef } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  pointerWithin,
} from '@dnd-kit/core'
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core'
import { CaseRow } from '../../../../shared/types/ipc'

interface DashboardTabProps {
  cases: CaseRow[]
  onCaseClick: (caseId: number) => void
  onRefresh?: () => void
}

const EVAL_TYPE_COLORS: Record<string, string> = {
  CST: '#2196f3',
  Custody: '#9c27b0',
  Risk: '#f44336',
  'PTSD Dx': '#ff9800',
  'ADHD Dx': '#4caf50',
  Malingering: '#795548',
  Fitness: '#607d8b',
  Capacity: '#00bcd4',
}

const PIPELINE_STAGES = [
  { key: 'onboarding', label: 'Onboarding' },
  { key: 'testing', label: 'Testing' },
  { key: 'interview', label: 'Interview' },
  { key: 'diagnostics', label: 'Report' },
  { key: 'review', label: 'Review' },
  { key: 'complete', label: 'Complete' },
]

/** Stage card colors, light bg, darker text, border between */
const STAGE_CARD_STYLES: Record<string, { bg: string; border: string; text: string; accent: string }> = {
  onboarding:  { bg: '#e0f7fa', border: '#b2ebf2', text: '#00695c', accent: '#00897b' },
  testing:     { bg: '#f3e5f5', border: '#e1bee7', text: '#6a1b9a', accent: '#8e24aa' },
  interview:   { bg: '#fce4ec', border: '#f8bbd0', text: '#ad1457', accent: '#d81b60' },
  diagnostics: { bg: '#fff3e0', border: '#ffe0b2', text: '#e65100', accent: '#f57c00' },
  review:      { bg: '#fbe9e7', border: '#ffccbc', text: '#bf360c', accent: '#e64a19' },
  complete:    { bg: '#e8f5e9', border: '#c8e6c9', text: '#2e7d32', accent: '#43a047' },
}

function mapStageToKey(stage: string | null): string {
  if (!stage) return 'onboarding'
  const s = stage.toLowerCase()
  if (s.includes('onboard')) return 'onboarding'
  if (s.includes('test')) return 'testing'
  if (s.includes('interview')) return 'interview'
  if (s.includes('diagnos')) return 'diagnostics'
  if (s.includes('review')) return 'review'
  if (s.includes('complete')) return 'complete'
  return 'onboarding'
}

function mapStageLabel(stage: string | null): string {
  const key = mapStageToKey(stage)
  return PIPELINE_STAGES.find((s) => s.key === key)?.label ?? 'Onboarding'
}

function formatClientName(c: CaseRow): string {
  const first = c.examinee_first_name ?? ''
  const last = c.examinee_last_name ?? ''
  const initial = first.charAt(0).toUpperCase()
  const type = c.evaluation_type || ''
  return `${last}, ${initial}. ${type ? `, ${type}` : ''}`.trim()
}

export default function DashboardTab({ cases, onCaseClick, onRefresh }: DashboardTabProps) {
  const [filterType, setFilterType] = useState('All')
  const [filterStage, setFilterStage] = useState('All')
  const [searchText, setSearchText] = useState('')
  const [searchCase, setSearchCase] = useState('')
  const [dateSort, setDateSort] = useState<'desc' | 'asc'>('desc')
  const [kanbanOpen, setKanbanOpen] = useState(true)
  const [tableOpen, setTableOpen] = useState(false)
  const [activeDragId, setActiveDragId] = useState<number | null>(null)
  const [cardLayout, setCardLayout] = useState<'horizontal' | 'vertical'>(() => {
    return (localStorage.getItem('psygil-card-layout') as 'horizontal' | 'vertical') ?? 'horizontal'
  })

  /* ── Horizontal splitter between kanban and case list ── */
  const [kanbanHeight, setKanbanHeight] = useState(320)
  const splitterDragging = useRef(false)
  const splitterStartY = useRef(0)
  const splitterStartH = useRef(0)

  const onSplitterPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    splitterDragging.current = true
    splitterStartY.current = e.clientY
    splitterStartH.current = kanbanHeight
    // Ensure both panels are open when splitter is dragged
    setKanbanOpen(true)
    setTableOpen(true)
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, [kanbanHeight])

  const onSplitterPointerMove = useCallback((e: React.PointerEvent) => {
    if (!splitterDragging.current) return
    const delta = e.clientY - splitterStartY.current
    const newH = Math.max(120, Math.min(800, splitterStartH.current + delta))
    setKanbanHeight(newH)
  }, [])

  const onSplitterPointerUp = useCallback(() => {
    splitterDragging.current = false
  }, [])

  /* ── @dnd-kit setup ──
   *
   * PointerSensor with distance:5, movement below 5px is a click, above is drag.
   * pointerWithin collision, detects which droppable column the POINTER is inside.
   * Unlike closestCenter (which uses the draggable element rect), pointerWithin
   * uses the actual cursor coordinates, so it works perfectly with DragOverlay
   * where the original card stays in place.
   * DragOverlay, renders a visual clone following the cursor. The original card
   * fades out. DragOverlay does NOT affect collision detection.
   */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(event.active.id as number)
  }, [])

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setActiveDragId(null)
    const { active, over } = event
    if (!over) return
    const caseId = active.id as number
    const targetStage = over.id as string
    // Only update if dropped on a valid pipeline stage
    if (!PIPELINE_STAGES.some((s) => s.key === targetStage)) return

    // Phase B.4: setStage backdoor closed. Kanban drag-drop now only permits
    // forward, single-step transitions (current stage to the immediate next
    // stage) and only through pipeline.advance, which enforces gate
    // preconditions server-side. Drops onto earlier stages or skipping
    // multiple stages are refused silently; the case stays put and the UI
    // refreshes so the card snaps back.
    try {
      const check = await window.psygil?.pipeline?.check?.({ caseId })
      if (check && check.ok && check.data.nextStage === targetStage) {
        await window.psygil?.pipeline?.advance?.({ caseId })
      }
      onRefresh?.()
    } catch {
      // best-effort; UI will refresh on next poll
    }
  }, [onRefresh])

  const toggleKanban = useCallback(() => {
    if (kanbanOpen) {
      // Collapsing kanban → expand list
      setKanbanOpen(false)
      setTableOpen(true)
    } else {
      // Expanding kanban → collapse list
      setKanbanOpen(true)
      setTableOpen(false)
    }
  }, [kanbanOpen])

  const toggleTable = useCallback(() => {
    if (tableOpen) {
      // Collapsing list → expand kanban
      setTableOpen(false)
      setKanbanOpen(true)
    } else {
      // Expanding list → collapse kanban
      setTableOpen(true)
      setKanbanOpen(false)
    }
  }, [tableOpen])

  const stats = useMemo(() => {
    const stageCounts = { onboarding: 0, testing: 0, interview: 0, diagnostics: 0, review: 0, complete: 0 }
    let activeCount = 0
    cases.forEach((c) => {
      const stage = mapStageToKey(c.workflow_current_stage)
      stageCounts[stage as keyof typeof stageCounts]++
      if (stage !== 'complete') activeCount++
    })
    return { active: activeCount, stageCounts }
  }, [cases])

  const casesByStage = useMemo(() => {
    const grouped: Record<string, CaseRow[]> = {}
    for (const s of PIPELINE_STAGES) grouped[s.key] = []
    cases.forEach((c) => {
      const key = mapStageToKey(c.workflow_current_stage)
      grouped[key]?.push(c)
    })
    return grouped
  }, [cases])

  const evalTypeStats = useMemo(() => {
    const counts: Record<string, number> = {}
    cases.forEach((c) => {
      const type = c.evaluation_type || 'Untyped'
      counts[type] = (counts[type] || 0) + 1
    })
    return counts
  }, [cases])

  const evalTypes = useMemo(() => {
    return Array.from(new Set(cases.map((c) => c.evaluation_type).filter(Boolean))).sort() as string[]
  }, [cases])

  const filteredCases = useMemo(() => {
    let result = [...cases]
    if (filterType !== 'All') result = result.filter((c) => c.evaluation_type === filterType)
    if (filterStage !== 'All') result = result.filter((c) => mapStageToKey(c.workflow_current_stage) === filterStage)
    if (searchCase) {
      const q = searchCase.toLowerCase()
      result = result.filter((c) => c.case_number.toLowerCase().includes(q))
    }
    if (searchText) {
      const q = searchText.toLowerCase()
      result = result.filter((c) => {
        const name = `${c.examinee_last_name} ${c.examinee_first_name}`.toLowerCase()
        return name.includes(q)
      })
    }
    const dir = dateSort === 'asc' ? 1 : -1
    result.sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0
      return (dateA - dateB) * dir
    })
    return result
  }, [cases, filterType, filterStage, searchText, searchCase, dateSort])

  const isFiltered = filterType !== 'All' || filterStage !== 'All' || searchText !== '' || searchCase !== ''

  return (
    <div style={{ padding: '12px', fontSize: '12px', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '10px', flexShrink: 0 }}>
        <h1 style={{ fontSize: '16px', margin: 0, fontWeight: 600 }}>Practice Dashboard</h1>
        <span style={{ fontSize: '12px', color: '#283593', fontWeight: 600 }}>{cases.length} Total</span>
        <span style={{ fontSize: '12px', color: '#1565c0', fontWeight: 600 }}>{stats.active} Active</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '2px', background: 'var(--panel, #f0f0f0)', borderRadius: '4px', border: '1px solid var(--border, #ddd)', padding: '2px' }}>
          <button
            onClick={() => { setCardLayout('horizontal'); localStorage.setItem('psygil-card-layout', 'horizontal') }}
            title="Horizontal layout"
            style={{
              padding: '3px 8px', fontSize: '11px', fontWeight: 600, border: 'none', borderRadius: '3px', cursor: 'pointer',
              background: cardLayout === 'horizontal' ? 'var(--accent, #5b6abf)' : 'transparent',
              color: cardLayout === 'horizontal' ? '#fff' : 'var(--text-secondary, #888)',
            }}
          >
            ☰
          </button>
          <button
            onClick={() => { setCardLayout('vertical'); localStorage.setItem('psygil-card-layout', 'vertical') }}
            title="Vertical layout (iPad)"
            style={{
              padding: '3px 8px', fontSize: '11px', fontWeight: 600, border: 'none', borderRadius: '3px', cursor: 'pointer',
              background: cardLayout === 'vertical' ? 'var(--accent, #5b6abf)' : 'transparent',
              color: cardLayout === 'vertical' ? '#fff' : 'var(--text-secondary, #888)',
            }}
          >
            ☷
          </button>
        </div>
      </div>

      {/* ── Stage cards, click to toggle Kanban ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          gap: '6px',
          marginBottom: kanbanOpen ? '0' : '10px', cursor: 'pointer', userSelect: 'none', flexShrink: 0,
        }}
        onClick={toggleKanban}
        title={kanbanOpen ? 'Collapse Kanban board' : 'Expand Kanban board'}
      >
        {PIPELINE_STAGES.map((stage) => {
          const sc = STAGE_CARD_STYLES[stage.key]
          const count = stats.stageCounts[stage.key as keyof typeof stats.stageCounts] ?? 0
          return (
            <div key={stage.key} style={{
              background: sc.bg, border: `1px solid ${sc.border}`,
              borderRadius: kanbanOpen ? '4px 4px 0 0' : '4px',
              padding: '6px 8px', textAlign: 'center',
              display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '5px',
            }}>
              <span style={{ fontSize: '16px', fontWeight: 700, color: sc.text }}>{count}</span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: sc.text }}>
                {stage.label} {kanbanOpen ? '▴' : '▾'}
              </span>
            </div>
          )
        })}
      </div>

      {/* ── Kanban board ── */}
      {kanbanOpen && (
        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(6, 1fr)',
            gap: '6px',
            /* If list is collapsed, kanban fills all space. If both open, use fixed height. */
            ...(tableOpen
              ? { height: `${kanbanHeight}px`, minHeight: 0, flexShrink: 0 }
              : { flex: 1, minHeight: 0 }),
          }}>
            {PIPELINE_STAGES.map((stage) => (
              <KanbanColumn
                key={stage.key}
                stageKey={stage.key}
                cases={casesByStage[stage.key] ?? []}
                onCaseClick={onCaseClick}
                cardLayout={cardLayout}
              />
            ))}
          </div>

          {/* DragOverlay, always mounted, conditionally renders children.
              Provides the visual card that follows the cursor during drag.
              Does NOT affect collision detection (pointerWithin uses cursor pos). */}
          <DragOverlay dropAnimation={null}>
            {activeDragId != null ? (() => {
              const dragCase = cases.find((c) => c.case_id === activeDragId)
              if (!dragCase) return null
              const stageKey = mapStageToKey(dragCase.workflow_current_stage)
              const sc = STAGE_CARD_STYLES[stageKey]
              return <KanbanCardContent c={dragCase} sc={sc} isDragging cardLayout={cardLayout} />
            })() : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* ── Draggable horizontal splitter, visible when kanban is open ── */}
      {kanbanOpen && (
        <div
          onPointerDown={onSplitterPointerDown}
          onPointerMove={onSplitterPointerMove}
          onPointerUp={onSplitterPointerUp}
          style={{
            height: '6px', flexShrink: 0,
            cursor: 'row-resize', userSelect: 'none',
            background: splitterDragging.current ? 'var(--accent, #1565c0)' : 'transparent',
            borderTop: '1px solid var(--border)',
            borderBottom: '1px solid var(--border)',
            transition: 'background 0.1s',
            margin: '2px 0',
          }}
          onPointerEnter={(e) => { (e.target as HTMLElement).style.background = 'var(--border, #ccc)' }}
          onPointerLeave={(e) => { if (!splitterDragging.current) (e.target as HTMLElement).style.background = 'transparent' }}
        />
      )}

      {/* ── Case List, expandable section ── */}
      <div style={{
        flex: tableOpen ? 1 : '0 0 auto',
        minHeight: tableOpen ? 0 : undefined,
        maxHeight: tableOpen ? undefined : '28px',
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        paddingTop: '6px',
      }}>
        {/* Header bar, always visible */}
        <div
          style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', cursor: 'pointer', userSelect: 'none', flexShrink: 0 }}
          onClick={toggleTable}
        >
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}>
            Case List {tableOpen ? '▴' : '▾'}
          </span>
          {/* Type pills, compact summary */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', marginLeft: '4px' }} onClick={(e) => e.stopPropagation()}>
            {Object.entries(evalTypeStats)
              .sort((a, b) => b[1] - a[1])
              .map(([type, count]) => {
                const color = EVAL_TYPE_COLORS[type] || '#777'
                return (
                  <span key={type} style={{
                    display: 'inline-flex', alignItems: 'center', gap: '3px',
                    background: 'var(--panel)', border: '1px solid var(--border)',
                    borderRadius: '3px', padding: '1px 6px', fontSize: '10px',
                  }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                    <span style={{ color: 'var(--text)' }}>{type}</span>
                    <span style={{ fontWeight: 700, color }}>{count}</span>
                  </span>
                )
              })}
          </div>

          {isFiltered && (
            <button
              onClick={(e) => { e.stopPropagation(); setFilterType('All'); setFilterStage('All'); setSearchText(''); setSearchCase('') }}
              style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '11px', fontFamily: 'inherit', padding: 0, marginLeft: '4px' }}
            >
              Clear filters
            </button>
          )}

          <span style={{ fontSize: '10px', color: 'var(--text-secondary)', marginLeft: 'auto' }}>
            {filteredCases.length} of {cases.length} cases
          </span>
        </div>

          {/* Scrollable table */}
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
          <thead>
          <tr>
            <th style={TH}>
              <input
                type="text"
                placeholder="Case #"
                value={searchCase}
                onChange={(e) => setSearchCase(e.target.value)}
                style={{
                  background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '3px',
                  padding: '2px 5px', fontSize: '11px', color: 'var(--text)', fontFamily: 'inherit',
                  width: '100%', boxSizing: 'border-box', fontWeight: searchCase ? 600 : 400,
                }}
              />
            </th>
            <th style={TH}>
              <input
                type="text"
                placeholder="Client"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                style={{
                  background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '3px',
                  padding: '2px 5px', fontSize: '11px', color: 'var(--text)', fontFamily: 'inherit',
                  width: '100%', boxSizing: 'border-box', fontWeight: searchText ? 600 : 400,
                }}
              />
            </th>
            <th style={TH}>
              <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
                style={{ ...SEL, color: filterType !== 'All' ? 'var(--accent)' : 'var(--text)' }}>
                <option value="All">Type ▾</option>
                {evalTypes.map((t) => (<option key={t} value={t}>{t}</option>))}
              </select>
            </th>
            <th style={TH}>
              <select value={filterStage} onChange={(e) => setFilterStage(e.target.value)}
                style={{ ...SEL, color: filterStage !== 'All' ? 'var(--accent)' : 'var(--text)' }}>
                <option value="All">Stage ▾</option>
                {PIPELINE_STAGES.map((s) => (<option key={s.key} value={s.key}>{s.label}</option>))}
              </select>
            </th>
            <th style={{ ...TH, cursor: 'pointer', userSelect: 'none' }}
              onClick={() => setDateSort((p) => p === 'desc' ? 'asc' : 'desc')}
              title={`Sort ${dateSort === 'desc' ? 'oldest first' : 'newest first'}`}>
              Deadline {dateSort === 'desc' ? '▾' : '▴'}
            </th>
          </tr>
        </thead>
        <tbody>
          {filteredCases.map((c, idx) => {
            const stageKey = mapStageToKey(c.workflow_current_stage)
            const sc = STAGE_CARD_STYLES[stageKey]
            const referredDate = c.created_at ? c.created_at.split('T')[0] : ','
            const isComplete = stageKey === 'complete'
            return (
              <tr key={c.case_id ?? idx}
                style={{ cursor: 'pointer', background: idx % 2 === 0 ? 'transparent' : 'var(--highlight)' }}
                onClick={() => onCaseClick(c.case_id)}>
                <td style={{ ...TD, fontSize: '10px', color: 'var(--text-secondary)' }}>{c.case_number}</td>
                <td style={{ ...TD, fontWeight: 500 }}>{formatClientName(c)}</td>
                <td style={TD}>{c.evaluation_type || ','}</td>
                <td style={TD}>
                  <span style={{ background: sc?.accent || '#999', color: '#fff', padding: '1px 6px', borderRadius: '3px', fontSize: '10px' }}>
                    {mapStageLabel(c.workflow_current_stage)}
                  </span>
                </td>
                <td style={{ ...TD, fontSize: '10px', color: isComplete ? '#4caf50' : 'var(--text-secondary)' }}>
                  {isComplete ? 'Done' : referredDate}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      </div>
      </div>
    </div>
  )
}

/* ──────────────────────────────────────────────
   Kanban Column, droppable target
   ────────────────────────────────────────────── */

function KanbanColumn({ stageKey, cases: columnCases, onCaseClick, cardLayout = 'horizontal' }: {
  stageKey: string
  cases: CaseRow[]
  onCaseClick: (caseId: number) => void
  cardLayout?: 'horizontal' | 'vertical'
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stageKey })
  const sc = STAGE_CARD_STYLES[stageKey]

  return (
    <div
      ref={setNodeRef}
      style={{
        background: isOver ? '#e0e0e0' : '#f0f0f0',
        border: `1px solid ${isOver ? '#bbb' : '#ddd'}`,
        borderTop: 'none', borderRadius: '0 0 4px 4px',
        padding: '4px', overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '5px',
        transition: 'background 0.15s, border-color 0.15s',
        boxShadow: isOver ? 'inset 0 0 8px rgba(0,0,0,0.08)' : 'none',
      }}
    >
      {columnCases.length === 0 && (
        <div style={{ fontSize: '11px', color: sc.text, opacity: 0.35, textAlign: 'center', padding: '20px 0' }}>
          No cases
        </div>
      )}
      {columnCases.map((c) => (
        <KanbanCard
          key={c.case_id}
          c={c}
          sc={sc}
          onClick={() => onCaseClick(c.case_id)}
          cardLayout={cardLayout}
        />
      ))}
    </div>
  )
}

/* ──────────────────────────────────────────────
   Kanban Card, draggable item
   ────────────────────────────────────────────── */

function KanbanCard({ c, sc, onClick, cardLayout = 'horizontal' }: {
  c: CaseRow
  sc: { bg: string; border: string; text: string; accent: string }
  onClick: () => void
  cardLayout?: 'horizontal' | 'vertical'
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: c.case_id })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onClick}
      style={{
        opacity: isDragging ? 0.35 : 1,
        transition: isDragging ? 'none' : 'opacity 0.15s',
      }}
    >
      <KanbanCardContent c={c} sc={sc} isDragging={isDragging} cardLayout={cardLayout} />
    </div>
  )
}

/* ──────────────────────────────────────────────
   Kanban Card Content, shared between card and overlay
   ────────────────────────────────────────────── */

function KanbanCardContent({ c, sc, isDragging, cardLayout = 'horizontal' }: {
  c: CaseRow
  sc: { bg: string; border: string; text: string; accent: string }
  isDragging?: boolean
  cardLayout?: 'horizontal' | 'vertical'
}) {
  const complaint = c.evaluation_questions || null
  const referral = c.referral_source || null
  const evalType = c.evaluation_type || 'Untyped'
  const deadline = c.created_at ? c.created_at.split('T')[0] : null
  const daysUntil = deadline ? Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000) : null
  const isUrgent = daysUntil !== null && daysUntil <= 5

  if (cardLayout === 'vertical') {
    // Vertical layout, each field on its own line, optimized for narrow screens / iPad
    const LABEL: React.CSSProperties = {
      fontSize: '9px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px',
      color: '#888', marginBottom: '1px',
    }
    const VALUE: React.CSSProperties = {
      fontSize: '12px', color: '#222', marginBottom: '6px',
    }

    return (
      <div
        style={{
          background: '#fff', border: `1px solid ${sc.border}`,
          borderLeft: `4px solid ${sc.accent}`,
          borderRadius: '4px', padding: '10px 12px',
          cursor: isDragging ? 'grabbing' : 'grab',
          lineHeight: '1.4',
          userSelect: 'none',
          boxShadow: isDragging ? '0 4px 12px rgba(0,0,0,0.2)' : undefined,
          minWidth: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ fontWeight: 700, color: '#111', fontSize: '14px' }}>
            {c.examinee_last_name}, {(c.examinee_first_name ?? '').charAt(0)}.
          </span>
          <span style={{
            background: sc.accent, color: '#fff', padding: '2px 8px',
            borderRadius: '3px', fontSize: '10px', fontWeight: 600, flexShrink: 0,
          }}>
            {evalType}
          </span>
        </div>
        <div style={LABEL}>Case #</div>
        <div style={VALUE}>{c.case_number}</div>
        {complaint && (
          <>
            <div style={LABEL}>Complaint</div>
            <div style={{ ...VALUE, fontStyle: 'italic', color: '#444' }}>{complaint}</div>
          </>
        )}
        {referral && (
          <>
            <div style={LABEL}>Referral</div>
            <div style={VALUE}>{referral}</div>
          </>
        )}
        {deadline && (
          <>
            <div style={LABEL}>Deadline</div>
            <div style={{
              ...VALUE,
              fontWeight: isUrgent ? 800 : 600,
              color: isUrgent ? '#c62828' : '#333',
              marginBottom: 0,
            }}>
              {deadline}
              {isUrgent && daysUntil != null && (
                <span style={{ fontSize: '10px', color: '#c62828', marginLeft: '6px' }}>
                  ({daysUntil}d)
                </span>
              )}
            </div>
          </>
        )}
      </div>
    )
  }

  // Horizontal layout, stacked card, every field visible, word-wrap safe
  return (
    <div
      style={{
        background: '#fff', border: `1px solid ${sc.border}`,
        borderLeft: `3px solid ${sc.accent}`,
        borderRadius: '3px', padding: '6px 8px',
        cursor: isDragging ? 'grabbing' : 'grab',
        lineHeight: '1.4',
        fontSize: '11px',
        userSelect: 'none',
        boxShadow: isDragging ? '0 4px 12px rgba(0,0,0,0.2)' : undefined,
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
      }}
    >
      {/* Name + Type badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '3px', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, color: '#111', fontSize: '12px' }}>
          {c.examinee_last_name}, {(c.examinee_first_name ?? '').charAt(0)}.
        </span>
        <span style={{
          background: sc.accent, color: '#fff', padding: '1px 5px',
          borderRadius: '2px', fontSize: '9px', fontWeight: 600, flexShrink: 0,
        }}>
          {evalType}
        </span>
      </div>

      {/* Case number */}
      <div style={{ color: '#555', fontSize: '10px', marginBottom: '2px' }}>
        {c.case_number}
      </div>

      {/* Complaint, wraps naturally, 2-line clamp */}
      {complaint && (
        <div style={{
          color: '#444', fontSize: '10px', fontStyle: 'italic',
          marginBottom: '2px',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical' as const,
          overflow: 'hidden',
        }}>
          {complaint}
        </div>
      )}

      {/* Referral source */}
      {referral && (
        <div style={{ color: '#555', fontSize: '10px', marginBottom: '2px' }}>
          {referral}
        </div>
      )}

      {/* Deadline */}
      {deadline && (
        <div style={{
          fontSize: '10px', fontWeight: isUrgent ? 800 : 600,
          color: isUrgent ? '#c62828' : '#555',
          marginTop: '2px',
        }}>
          {deadline}
          {isUrgent && daysUntil != null && (
            <span style={{ fontSize: '9px', color: '#c62828', marginLeft: '4px' }}>
              ({daysUntil}d)
            </span>
          )}
        </div>
      )}
    </div>
  )
}

/* ──────────────────────────────────────────────
   Shared table styles
   ────────────────────────────────────────────── */

const TH: React.CSSProperties = {
  background: 'var(--panel)', padding: '5px 8px', textAlign: 'left',
  fontWeight: 600, fontSize: '11px', border: '1px solid var(--border)', whiteSpace: 'nowrap',
}

const SEL: React.CSSProperties = {
  background: 'transparent', border: 'none', fontWeight: 600, fontSize: '11px',
  color: 'var(--text)', fontFamily: 'inherit', cursor: 'pointer',
  padding: 0, margin: 0,
  WebkitAppearance: 'none', MozAppearance: 'none', appearance: 'none',
}

const TD: React.CSSProperties = {
  padding: '4px 8px', border: '1px solid var(--border)',
}
