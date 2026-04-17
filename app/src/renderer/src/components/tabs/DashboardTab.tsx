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

// themed:skip - eval-type categorical colors, each is a distinct semantic marker not a theme token
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

/** Stage card colors - themed:skip: pipeline-stage identity colors, each maps to a distinct clinical workflow phase */
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
  const [analyticsOpen, setAnalyticsOpen] = useState(false)
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
    if (!PIPELINE_STAGES.some((s) => s.key === targetStage)) return

    // Attempt to advance via pipeline.advance (server-side gate check).
    // If the gate conditions are not met, the server returns an error
    // which we surface as a brief alert so the user knows why the card
    // snapped back instead of silently swallowing the drop.
    try {
      const resp = await window.psygil?.pipeline?.advance?.({ caseId })
      if (resp && resp.status !== 'success' && 'message' in resp) {
        const msg = (resp as { message?: string }).message ?? ''
        if (msg) window.alert(`Cannot advance: ${msg}`)
      }
      onRefresh?.()
    } catch {
      onRefresh?.()
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

  const toggleAnalytics = useCallback(() => {
    setAnalyticsOpen((prev) => !prev)
    // Analytics takes full height; no need to change kanban/table state
  }, [])

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
        <span style={{ fontSize: '12px', color: 'var(--text)', fontWeight: 600 }}>{cases.length} Total</span>
        <span style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 600 }}>{stats.active} Active</span>
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

      {/* ── Stage cards + Kanban + Case List: hidden when Analytics is expanded ── */}
      {!analyticsOpen && (<>
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
                const color = EVAL_TYPE_COLORS[type] || 'var(--text-secondary)'
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
                  <span style={{ background: sc?.accent || 'var(--text-secondary)', color: '#fff', padding: '1px 6px', borderRadius: '3px', fontSize: '10px' }}>
                    {mapStageLabel(c.workflow_current_stage)}
                  </span>
                </td>
                <td style={{ ...TD, fontSize: '10px', color: isComplete ? 'var(--success)' : 'var(--text-secondary)' }}>
                  {isComplete ? 'Done' : referredDate}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      </div>
      </div>

      </>)}

      {/* ── Analytics Dashboard, collapsible third pane ── */}
      <div style={{
        flex: analyticsOpen ? 1 : '0 0 auto',
        minHeight: analyticsOpen ? 0 : undefined,
        maxHeight: analyticsOpen ? undefined : '28px',
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        paddingTop: '6px',
        borderTop: '1px solid var(--border)',
      }}>
        {/* Header bar with pipeline stage indicators */}
        <div
          style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', cursor: 'pointer', userSelect: 'none', flexShrink: 0 }}
          onClick={toggleAnalytics}
        >
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}>
            Analytics {analyticsOpen ? '\u25B4' : '\u25BE'}
          </span>

          {/* Pipeline stage pills */}
          <div style={{ display: 'flex', gap: '4px', marginLeft: '12px' }} onClick={(e) => e.stopPropagation()}>
            {PIPELINE_STAGES.map((stage) => {
              const count = stats.stageCounts[stage.key as keyof typeof stats.stageCounts] ?? 0
              const sc = STAGE_CARD_STYLES[stage.key]
              return (
                <span key={stage.key} style={{
                  fontSize: '10px',
                  padding: '1px 7px',
                  borderRadius: '3px',
                  border: `1px solid ${sc?.accent ?? 'var(--border)'}`,
                  background: count > 0 ? (sc?.accent ?? 'var(--accent)') : 'transparent',
                  color: count > 0 ? '#fff' : 'var(--text-secondary)',
                  fontWeight: count > 0 ? 600 : 400,
                  whiteSpace: 'nowrap',
                }}>
                  {count} {stage.label}
                </span>
              )
            })}
          </div>

          <span style={{ fontSize: '10px', color: 'var(--text-secondary)', marginLeft: 'auto' }}>
            {cases.length} cases analyzed
          </span>
        </div>

        {analyticsOpen && (
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 0' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>

              {/* ── Pipeline Stage Distribution (Horizontal Bar Chart) ── */}
              <ChartCard title="Pipeline Stage Distribution">
                {PIPELINE_STAGES.map((stage) => {
                  const count = stats.stageCounts[stage.key as keyof typeof stats.stageCounts] ?? 0
                  const pct = cases.length > 0 ? (count / cases.length) * 100 : 0
                  const sc = STAGE_CARD_STYLES[stage.key]
                  return (
                    <div key={stage.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <span style={{ width: '80px', fontSize: '10px', color: 'var(--text-secondary)', textAlign: 'right', flexShrink: 0 }}>
                        {stage.label}
                      </span>
                      <div style={{ flex: 1, height: '16px', background: 'var(--highlight)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{
                          width: `${pct}%`, height: '100%', background: sc?.accent || 'var(--accent)',
                          borderRadius: '3px', transition: 'width 0.3s',
                          minWidth: count > 0 ? '4px' : '0px',
                        }} />
                      </div>
                      <span style={{ width: '30px', fontSize: '11px', fontWeight: 600, color: 'var(--text)', textAlign: 'right' }}>
                        {count}
                      </span>
                    </div>
                  )
                })}
              </ChartCard>

              {/* ── Evaluation Type Distribution (Pie Chart via SVG) ── */}
              <ChartCard title="Evaluation Types">
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <PieChart data={evalTypeStats} size={120} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {Object.entries(evalTypeStats).sort((a, b) => b[1] - a[1]).map(([type, count], i) => {
                      const color = PIE_COLORS[i % PIE_COLORS.length]
                      return (
                        <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                          <span style={{ color: 'var(--text)' }}>{type}</span>
                          <span style={{ fontWeight: 700, color: 'var(--text-secondary)', marginLeft: 'auto' }}>{count}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </ChartCard>

              {/* ── Case Status (Donut: active vs complete) ── */}
              <ChartCard title="Active vs Complete">
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <PieChart
                    data={{ Active: stats.active, Complete: cases.length - stats.active }}
                    size={120}
                    colors={['var(--accent)', 'var(--success)']}
                    donut
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--accent)' }}>
                      {stats.active}
                      <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--text-secondary)', marginLeft: '4px' }}>active</span>
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--success)' }}>
                      {cases.length - stats.active}
                      <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--text-secondary)', marginLeft: '4px' }}>complete</span>
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                      {cases.length > 0 ? Math.round(((cases.length - stats.active) / cases.length) * 100) : 0}% completion rate
                    </div>
                  </div>
                </div>
              </ChartCard>

              {/* ── Stage Radar / Spider Chart ── */}
              <ChartCard title="Workload Distribution">
                <SpiderChart
                  labels={PIPELINE_STAGES.map((s) => s.label)}
                  values={PIPELINE_STAGES.map((s) => stats.stageCounts[s.key as keyof typeof stats.stageCounts] ?? 0)}
                  maxValue={Math.max(...Object.values(stats.stageCounts), 1)}
                  size={160}
                />
              </ChartCard>

              {/* ── Monthly Case Volume (vertical bars) ── */}
              <ChartCard title="Cases by Month">
                <MonthlyBarChart cases={cases} />
              </ChartCard>

              {/* ── Average Time in Stage (horizontal bars) ── */}
              <ChartCard title="Stage Throughput">
                <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  Cases per stage (higher = more cases awaiting progression)
                </div>
                {PIPELINE_STAGES.filter((s) => s.key !== 'complete').map((stage) => {
                  const count = stats.stageCounts[stage.key as keyof typeof stats.stageCounts] ?? 0
                  const maxCount = Math.max(...PIPELINE_STAGES.filter((s) => s.key !== 'complete').map((s) => stats.stageCounts[s.key as keyof typeof stats.stageCounts] ?? 0), 1)
                  const pct = (count / maxCount) * 100
                  const sc = STAGE_CARD_STYLES[stage.key]
                  const isBottleneck = count === maxCount && count > 0
                  return (
                    <div key={stage.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px' }}>
                      <span style={{ width: '70px', fontSize: '10px', color: 'var(--text-secondary)', textAlign: 'right', flexShrink: 0 }}>{stage.label}</span>
                      <div style={{ flex: 1, height: '12px', background: 'var(--highlight)', borderRadius: '2px', overflow: 'hidden', position: 'relative' }}>
                        <div style={{
                          width: `${pct}%`, height: '100%',
                          background: isBottleneck ? 'var(--warn)' : (sc?.accent || 'var(--accent)'),
                          borderRadius: '2px', transition: 'width 0.3s',
                        }} />
                      </div>
                      <span style={{ width: '20px', fontSize: '10px', fontWeight: 600, color: isBottleneck ? 'var(--warn)' : 'var(--text)', textAlign: 'right' }}>{count}</span>
                      {isBottleneck && <span style={{ fontSize: '9px', color: 'var(--warn)', fontWeight: 600 }}>bottleneck</span>}
                    </div>
                  )
                })}
              </ChartCard>

            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ──────────────────────────────────────────────
   Analytics Chart Components (pure SVG, no deps)
   ────────────────────────────────────────────── */

const PIE_COLORS = [
  '#2196f3', '#9c27b0', '#4caf50', '#ff9800', '#e91e63',
  '#00bcd4', '#ff5722', '#3f51b5', '#8bc34a', '#795548',
]

function ChartCard({ title, children }: { readonly title: string; readonly children: React.ReactNode }): React.JSX.Element {
  return (
    <div style={{
      background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: '6px',
      padding: '12px', minHeight: '120px',
    }}>
      <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text)', marginBottom: '10px' }}>{title}</div>
      {children}
    </div>
  )
}

function PieChart({ data, size = 120, colors, donut = false }: {
  readonly data: Record<string, number>
  readonly size?: number
  readonly colors?: readonly string[]
  readonly donut?: boolean
}): React.JSX.Element {
  const entries = Object.entries(data).filter(([, v]) => v > 0)
  const total = entries.reduce((sum, [, v]) => sum + v, 0)
  const palette = colors ?? PIE_COLORS
  const r = size / 2
  const cx = r
  const cy = r
  const outerR = r - 2
  const innerR = donut ? outerR * 0.55 : 0

  if (total === 0) {
    return (
      <svg width={size} height={size}>
        <circle cx={cx} cy={cy} r={outerR} fill="var(--highlight)" />
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize="11" fill="var(--text-secondary)">No data</text>
      </svg>
    )
  }

  let startAngle = -Math.PI / 2
  const paths: React.JSX.Element[] = []

  entries.forEach(([key, value], i) => {
    const sliceAngle = (value / total) * Math.PI * 2
    const endAngle = startAngle + sliceAngle
    const largeArc = sliceAngle > Math.PI ? 1 : 0

    const x1Outer = cx + outerR * Math.cos(startAngle)
    const y1Outer = cy + outerR * Math.sin(startAngle)
    const x2Outer = cx + outerR * Math.cos(endAngle)
    const y2Outer = cy + outerR * Math.sin(endAngle)

    let d: string
    if (donut) {
      const x1Inner = cx + innerR * Math.cos(startAngle)
      const y1Inner = cy + innerR * Math.sin(startAngle)
      const x2Inner = cx + innerR * Math.cos(endAngle)
      const y2Inner = cy + innerR * Math.sin(endAngle)
      d = [
        `M ${x1Outer} ${y1Outer}`,
        `A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2Outer} ${y2Outer}`,
        `L ${x2Inner} ${y2Inner}`,
        `A ${innerR} ${innerR} 0 ${largeArc} 0 ${x1Inner} ${y1Inner}`,
        'Z',
      ].join(' ')
    } else {
      d = [
        `M ${cx} ${cy}`,
        `L ${x1Outer} ${y1Outer}`,
        `A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2Outer} ${y2Outer}`,
        'Z',
      ].join(' ')
    }

    paths.push(
      <path key={key} d={d} fill={palette[i % palette.length]} opacity={0.85}>
        <title>{key}: {value} ({Math.round((value / total) * 100)}%)</title>
      </path>
    )
    startAngle = endAngle
  })

  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      {paths}
      {donut && (
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize="18" fontWeight="700" fill="var(--text)">
          {total}
        </text>
      )}
    </svg>
  )
}

function SpiderChart({ labels, values, maxValue, size = 160 }: {
  readonly labels: readonly string[]
  readonly values: readonly number[]
  readonly maxValue: number
  readonly size?: number
}): React.JSX.Element {
  const cx = size / 2
  const cy = size / 2
  const r = size / 2 - 20
  const n = labels.length
  const angleStep = (Math.PI * 2) / n

  function polarToXY(angle: number, radius: number): { x: number; y: number } {
    return {
      x: cx + radius * Math.cos(angle - Math.PI / 2),
      y: cy + radius * Math.sin(angle - Math.PI / 2),
    }
  }

  // Grid rings
  const rings = [0.25, 0.5, 0.75, 1.0]
  const gridElements = rings.map((frac) => {
    const points = Array.from({ length: n }, (_, i) => {
      const p = polarToXY(i * angleStep, r * frac)
      return `${p.x},${p.y}`
    }).join(' ')
    return <polygon key={frac} points={points} fill="none" stroke="var(--border)" strokeWidth="0.5" />
  })

  // Axis lines
  const axisLines = Array.from({ length: n }, (_, i) => {
    const p = polarToXY(i * angleStep, r)
    return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="var(--border)" strokeWidth="0.5" />
  })

  // Data polygon
  const dataPoints = values.map((v, i) => {
    const normR = maxValue > 0 ? (v / maxValue) * r : 0
    const p = polarToXY(i * angleStep, normR)
    return `${p.x},${p.y}`
  }).join(' ')

  // Labels
  const labelElements = labels.map((label, i) => {
    const p = polarToXY(i * angleStep, r + 14)
    return (
      <text key={i} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central"
        fontSize="9" fill="var(--text-secondary)">
        {label}
      </text>
    )
  })

  // Value dots
  const dots = values.map((v, i) => {
    const normR = maxValue > 0 ? (v / maxValue) * r : 0
    const p = polarToXY(i * angleStep, normR)
    return <circle key={i} cx={p.x} cy={p.y} r="3" fill="var(--accent)" />
  })

  return (
    <svg width={size} height={size} style={{ display: 'block', margin: '0 auto' }}>
      {gridElements}
      {axisLines}
      <polygon points={dataPoints} fill="color-mix(in srgb, var(--accent) 20%, transparent)" stroke="var(--accent)" strokeWidth="1.5" />
      {dots}
      {labelElements}
    </svg>
  )
}

function MonthlyBarChart({ cases: allCases }: { readonly cases: readonly CaseRow[] }): React.JSX.Element {
  // Group by YYYY-MM
  const monthly: Record<string, number> = {}
  allCases.forEach((c) => {
    const d = c.created_at ? c.created_at.substring(0, 7) : 'Unknown'
    monthly[d] = (monthly[d] || 0) + 1
  })

  const sortedMonths = Object.entries(monthly).sort((a, b) => a[0].localeCompare(b[0]))
  const maxCount = Math.max(...sortedMonths.map(([, v]) => v), 1)

  if (sortedMonths.length === 0) {
    return <div style={{ fontSize: '10px', color: 'var(--text-secondary)', textAlign: 'center', padding: '20px' }}>No case date data</div>
  }

  const barWidth = Math.max(16, Math.min(40, Math.floor(260 / sortedMonths.length) - 4))
  const chartHeight = 80

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: chartHeight + 20 }}>
      {sortedMonths.map(([month, count]) => {
        const barH = (count / maxCount) * chartHeight
        const label = month.length >= 7 ? month.substring(5, 7) : month
        return (
          <div key={month} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
            <span style={{ fontSize: '9px', fontWeight: 600, color: 'var(--text)' }}>{count}</span>
            <div
              title={`${month}: ${count} cases`}
              style={{
                width: barWidth, height: barH, background: 'var(--accent)',
                borderRadius: '2px 2px 0 0', transition: 'height 0.3s',
                opacity: 0.75,
              }}
            />
            <span style={{ fontSize: '8px', color: 'var(--text-secondary)' }}>{label}</span>
          </div>
        )
      })}
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
        background: isOver ? 'var(--highlight)' : 'var(--panel)',
        border: `1px solid ${isOver ? 'var(--border)' : 'var(--border)'}`,
        borderTop: 'none', borderRadius: '0 0 4px 4px',
        padding: '4px', overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '5px',
        transition: 'background 0.15s, border-color 0.15s',
        boxShadow: isOver ? 'inset 0 0 8px color-mix(in srgb, var(--text) 8%, transparent)' : 'none',
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
      color: 'var(--text-secondary)', marginBottom: '1px',
    }
    const VALUE: React.CSSProperties = {
      fontSize: '12px', color: 'var(--text)', marginBottom: '6px',
    }

    return (
      <div
        style={{
          background: 'var(--bg)', border: `1px solid ${sc.border}`,
          borderLeft: `4px solid ${sc.accent}`,
          borderRadius: '4px', padding: '10px 12px',
          cursor: isDragging ? 'grabbing' : 'grab',
          lineHeight: '1.4',
          userSelect: 'none',
          boxShadow: isDragging ? '0 4px 12px color-mix(in srgb, var(--text) 20%, transparent)' : undefined,
          minWidth: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ fontWeight: 700, color: 'var(--text)', fontSize: '14px' }}>
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
              color: isUrgent ? 'var(--danger)' : 'var(--text)',
              marginBottom: 0,
            }}>
              {deadline}
              {isUrgent && daysUntil != null && (
                <span style={{ fontSize: '10px', color: 'var(--danger)', marginLeft: '6px' }}>
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
        background: 'var(--bg)', border: `1px solid ${sc.border}`,
        borderLeft: `3px solid ${sc.accent}`,
        borderRadius: '3px', padding: '6px 8px',
        cursor: isDragging ? 'grabbing' : 'grab',
        lineHeight: '1.4',
        fontSize: '11px',
        userSelect: 'none',
        boxShadow: isDragging ? '0 4px 12px color-mix(in srgb, var(--text) 20%, transparent)' : undefined,
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
      }}
    >
      {/* Name + Type badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '3px', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, color: 'var(--text)', fontSize: '12px' }}>
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
      <div style={{ color: 'var(--text-secondary)', fontSize: '10px', marginBottom: '2px' }}>
        {c.case_number}
      </div>

      {/* Referral source */}
      {referral && (
        <div style={{ color: 'var(--text-secondary)', fontSize: '10px', marginBottom: '2px' }}>
          {referral}
        </div>
      )}

      {/* Deadline */}
      {deadline && (
        <div style={{
          fontSize: '10px', fontWeight: isUrgent ? 800 : 600,
          color: isUrgent ? 'var(--danger)' : 'var(--text-secondary)',
          marginTop: '2px',
        }}>
          {deadline}
          {isUrgent && daysUntil != null && (
            <span style={{ fontSize: '9px', color: 'var(--danger)', marginLeft: '4px' }}>
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
