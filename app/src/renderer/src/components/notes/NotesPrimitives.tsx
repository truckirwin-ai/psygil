/**
 * Shared notes/mock-data primitives used across clinical tabs.
 *
 * Pattern origin: Intake > Background sub-tab.
 *   Left column, mono uppercase labels (captured data) + Inter values (human content).
 *   Right column, per-section clinician-notes textarea that auto-saves on blur
 *   and flushes on stage advance via the flush-handler registry.
 *
 * Consumers:
 *   - MockField, MockSection for data rows/sections
 *   - SectionPair for unified-scroll grid rows (left fields + right notes)
 *   - registerFlushHandler / flushAllPendingNotes for manual save wiring
 */

import React, { createContext, useContext, useState } from 'react'
import { createPortal } from 'react-dom'

// ---------------------------------------------------------------------------
// SuppressInlineNotesContext
//
// When true, SectionPair collapses to a single-column body (MockSection only,
// no per-section right-rail notes cell). Used when the tab is wrapped in a
// shared shell-level notes rail (withMultiNotesPanel) , we don't want two
// notes columns.
// ---------------------------------------------------------------------------

export const SuppressInlineNotesContext = createContext<boolean>(false)

/**
 * Wraps a body grid. When inline notes are suppressed (shell rail in use),
 * the grid collapses to a single-column block; otherwise it renders the
 * standard 70/30 notesGridStyle grid.
 */
export function NotesBodyGrid({ children, style }: { readonly children: React.ReactNode; readonly style?: React.CSSProperties }): React.JSX.Element {
  const suppress = useContext(SuppressInlineNotesContext)
  if (suppress) {
    // Block layout; left cells render full-width stacked. Individual left
    // cells keep their own horizontal padding via notesLeftCellStyle.
    return <div style={style}>{children}</div>
  }
  return <div style={{ ...notesBodyGridStyleInternal, ...(style ?? {}) }}>{children}</div>
}

// Declared below; forward reference stub to allow top-of-file export order.
const notesBodyGridStyleInternal: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '70% 30%',
  alignItems: 'stretch',
  minHeight: '100%',
}

/** Renders children only when inline notes are NOT suppressed (per-section notes/rail footers). */
export function InlineNotesOnly({ children }: { readonly children: React.ReactNode }): React.JSX.Element | null {
  const suppress = useContext(SuppressInlineNotesContext)
  return suppress ? null : <>{children}</>
}

// ---------------------------------------------------------------------------
// Pending-notes flush registry
//
// Clinical notes auto-save on blur, but the stage advance button (and any
// other cross-cutting navigation) must also flush pending edits. Tab-level
// components register a flush handler via registerFlushHandler(); callers
// invoke flushAllPendingNotes() before navigating.
// ---------------------------------------------------------------------------

export type FlushHandler = () => Promise<void> | void

const pendingFlushHandlers = new Set<FlushHandler>()

export function registerFlushHandler(fn: FlushHandler): () => void {
  pendingFlushHandlers.add(fn)
  return () => {
    pendingFlushHandlers.delete(fn)
  }
}

export async function flushAllPendingNotes(): Promise<void> {
  const handlers = Array.from(pendingFlushHandlers)
  await Promise.all(
    handlers.map(async (fn) => {
      try {
        await fn()
      } catch (err) {
        console.error('[flushAllPendingNotes] handler failed:', err)
      }
    }),
  )
}

// ---------------------------------------------------------------------------
// MockField, MockSection
// ---------------------------------------------------------------------------

export const mockSectionTitleStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--text-secondary)',
  paddingBottom: 6,
  borderBottom: '1px solid var(--border)',
  margin: '20px 0 4px',
}

const mockFieldRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '110px 1fr',
  gap: 6,
  padding: '5px 0',
  alignItems: 'baseline',
}

const mockFieldLabelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11.5,
  color: 'var(--text-secondary)',
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  fontWeight: 500,
}

const mockFieldValueStyle: React.CSSProperties = {
  fontSize: 13.5,
  fontWeight: 500,
  color: 'var(--text)',
  lineHeight: 1.5,
  whiteSpace: 'pre-wrap',
}

const mockFieldValueEmptyStyle: React.CSSProperties = {
  ...mockFieldValueStyle,
  fontStyle: 'italic',
  color: 'var(--text-secondary)',
  fontWeight: 400,
}

const mockSectionFieldsBlockStyle: React.CSSProperties = {
  paddingBottom: 8,
  borderBottom: '1px solid var(--border)',
}

const mockSectionFieldsTwoColStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  columnGap: 28,
  rowGap: 0,
  paddingBottom: 8,
  borderBottom: '1px solid var(--border)',
}

interface MockFieldProps {
  readonly label: string
  readonly value?: string | null
  readonly emptyText?: string
  /** Span both columns in a 2-col MockSection. Use for narrative / long values. */
  readonly wide?: boolean
  /** Tighter row padding for dense headers. */
  readonly dense?: boolean
}

export function MockField({
  label,
  value,
  emptyText = 'Clinician has not entered',
  wide = false,
  dense = false,
}: MockFieldProps): React.JSX.Element {
  const v = value?.trim()
  const base: React.CSSProperties = dense
    ? { ...mockFieldRowStyle, padding: '2px 0', gridTemplateColumns: '96px 1fr' }
    : mockFieldRowStyle
  const rowStyle: React.CSSProperties = wide
    ? { ...base, gridColumn: '1 / -1' }
    : base
  const valStyle = dense
    ? { ...(v ? mockFieldValueStyle : mockFieldValueEmptyStyle), fontSize: 12.5, lineHeight: 1.35 }
    : (v ? mockFieldValueStyle : mockFieldValueEmptyStyle)
  const labelStyle = dense
    ? { ...mockFieldLabelStyle, fontSize: 10.5 }
    : mockFieldLabelStyle
  return (
    <div style={rowStyle}>
      <div style={labelStyle}>{label}</div>
      <div style={valStyle}>{v || emptyText}</div>
    </div>
  )
}

interface MockSectionProps {
  readonly title: string
  readonly cols?: 1 | 2
  readonly children: React.ReactNode
  /** Optional node rendered inline at the right side of the section title bar. */
  readonly titleAction?: React.ReactNode
  /** Suppress the horizontal rule under the section title (used when the title
   *  sits next to a rail header whose own rule would visually extend across
   *  both columns). */
  readonly noTitleBorder?: boolean
  /** Compact variant: no top margin on title, tighter field padding. */
  readonly dense?: boolean
}

export function MockSection({ title, cols = 1, children, titleAction, noTitleBorder, dense }: MockSectionProps): React.JSX.Element {
  const baseTitle: React.CSSProperties = {
    ...mockSectionTitleStyle,
    ...(noTitleBorder ? { borderBottom: 'none' as const, paddingBottom: 0 } : {}),
    ...(dense ? { margin: '0 0 4px', paddingBottom: 4 } : {}),
  }
  const titleRowStyle: React.CSSProperties = titleAction
    ? { ...baseTitle, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }
    : baseTitle
  const fieldsBlock: React.CSSProperties = dense
    ? { ...(cols === 2 ? mockSectionFieldsTwoColStyle : mockSectionFieldsBlockStyle), paddingBottom: 4, columnGap: 18 }
    : (cols === 2 ? mockSectionFieldsTwoColStyle : mockSectionFieldsBlockStyle)
  return (
    <section>
      <h3 style={titleRowStyle}>
        <span>{title}</span>
        {titleAction ? <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{titleAction}</span> : null}
      </h3>
      <div style={fieldsBlock}>
        {children}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Section grid + SectionPair (left data, right per-section notes)
// ---------------------------------------------------------------------------

export const notesGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '70% 30%',
  alignItems: 'stretch',
  minHeight: '100%',
}

export const notesLeftCellStyle: React.CSSProperties = {
  padding: '0 28px',
}

export const notesRightCellStyle: React.CSSProperties = {
  padding: '0 22px 14px 22px',
  background: 'var(--bg-soft)',
  borderLeft: '1px solid var(--border)',
}

const sectionNoteHeaderStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--text-secondary)',
  margin: '20px 0 6px',
  paddingBottom: 6,
  borderBottom: '1px solid var(--border)',
}

const sectionNoteTextareaStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  padding: '8px 10px',
  fontSize: 12.5,
  color: 'var(--text)',
  fontFamily: 'inherit',
  lineHeight: 1.5,
  resize: 'none',
  minHeight: 80,
}

interface SectionPairProps {
  readonly title: string
  readonly noteKey: string
  readonly value: string
  readonly onChange: (key: string, value: string) => void
  readonly onBlur: () => void | Promise<void>
  readonly placeholder: string
  readonly cols?: 1 | 2
  readonly children: React.ReactNode
}

/**
 * Renders two sibling cells in a CSS grid row:
 *   left, MockSection wrapping the field block;
 *   right, clinician-notes textarea for this section.
 * The grid auto-aligns row heights so the notes column scrolls in unison
 * with the data column.
 */
export function SectionPair({
  title,
  noteKey,
  value,
  onChange,
  onBlur,
  placeholder,
  cols = 1,
  children,
}: SectionPairProps): React.JSX.Element {
  const suppress = useContext(SuppressInlineNotesContext)
  if (suppress) {
    // Shell-level rail is hosting notes; render body-only (no grid sibling).
    return (
      <div style={notesLeftCellStyle}>
        <MockSection title={title} cols={cols}>{children}</MockSection>
      </div>
    )
  }
  return (
    <>
      <div style={notesLeftCellStyle}>
        <MockSection title={title} cols={cols}>{children}</MockSection>
      </div>
      <div style={{ ...notesRightCellStyle, display: 'flex', flexDirection: 'column' }}>
        <div style={sectionNoteHeaderStyle}>{title}</div>
        <textarea
          style={{ ...sectionNoteTextareaStyle, flex: 1 }}
          value={value}
          onChange={(e) => onChange(noteKey, e.target.value)}
          onBlur={() => void onBlur()}
          placeholder={placeholder}
        />
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Right-rail style primitives (single-panel notes, not per-section)
// ---------------------------------------------------------------------------

export const railBlockLabel: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--text-secondary)',
  marginBottom: 8,
}

export const railAssistantBodyStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--text-secondary)',
  fontStyle: 'italic',
  lineHeight: 1.55,
  padding: '8px 10px',
  background: 'var(--bg)',
  border: '1px dashed var(--border)',
  borderRadius: 4,
}

// ---------------------------------------------------------------------------
// MockTable, canonical mockup table with uppercase mono headers and
// optional summary strip above. Used for Testing battery, Documents list,
// and other tabular clinical data displays.
// ---------------------------------------------------------------------------

export interface MockColumn {
  readonly key: string
  readonly label: string
  readonly width?: number | string
  readonly align?: 'left' | 'center' | 'right'
}

export interface MockRow {
  readonly key: string
  readonly cells: Record<string, React.ReactNode>
  /** Optional rich hover tooltip. String or ReactNode (for multi-line / styled content). */
  readonly tooltip?: React.ReactNode
}

interface MockTableProps {
  readonly columns: readonly MockColumn[]
  readonly rows: readonly MockRow[]
  /** Optional key/value strip rendered above the table. */
  readonly summary?: Record<string, string>
  readonly emptyMessage?: string
}

const mockTableHeaderStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 10.5,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--text-secondary)',
  padding: '8px 10px',
  textAlign: 'left',
  borderBottom: '1px solid var(--border)',
  background: 'var(--bg-soft, var(--gray-50))',
  whiteSpace: 'nowrap',
}

const mockTableCellStyle: React.CSSProperties = {
  fontSize: 12.5,
  color: 'var(--text)',
  padding: '8px 10px',
  borderBottom: '1px solid var(--border)',
  verticalAlign: 'top',
  lineHeight: 1.45,
}

const mockTableSummaryStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '4px 24px',
  padding: '8px 10px',
  marginBottom: 10,
  background: 'var(--bg-soft, var(--gray-50))',
  border: '1px solid var(--border)',
  borderRadius: 4,
}

const mockTableSummaryLabelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 10.5,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--text-secondary)',
  marginRight: 6,
}

const mockTableSummaryValueStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--text)',
  fontWeight: 500,
}

interface MockTableRowProps {
  readonly row: MockRow
  readonly columns: readonly MockColumn[]
}

/**
 * Table row with a custom hover tooltip. Uses mouse-tracked positioning so
 * the tooltip follows the cursor and appears instantly (unlike the native
 * `title` attribute which has a ~1.5s OS-level delay).
 */
function MockTableRow({ row, columns }: MockTableRowProps): React.JSX.Element {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const hasTip = Boolean(row.tooltip)
  const bgOnHover = hasTip ? 'var(--bg-soft, var(--gray-50))' : undefined
  return (
    <tr
      style={{ position: 'relative', background: pos ? bgOnHover : undefined }}
      onMouseMove={(e) => {
        if (!hasTip) return
        setPos({ x: e.clientX, y: e.clientY })
      }}
      onMouseLeave={() => setPos(null)}
    >
      {columns.map((c) => (
        <td
          key={c.key}
          style={{ ...mockTableCellStyle, textAlign: c.align ?? 'left', width: c.width }}
        >
          {row.cells[c.key] ?? ''}
        </td>
      ))}
      {pos && hasTip && createPortal(
        <div
          style={{
            position: 'fixed',
            left: pos.x + 14,
            top: pos.y + 16,
            zIndex: 9999,
            pointerEvents: 'none',
            background: 'color-mix(in srgb, var(--info) 12%, var(--field-bg))',
            color: 'var(--field-text)',
            fontSize: 13.5,
            lineHeight: 1.5,
            padding: '10px 14px',
            borderRadius: 6,
            maxWidth: 520,
            minWidth: 300,
            textAlign: 'left',
            whiteSpace: 'normal',
            border: '1px solid color-mix(in srgb, var(--info) 40%, transparent)',
            boxShadow: '0 4px 14px rgba(0,0,0,0.18)', /* themed:skip - shadow */
          }}
        >
          {row.tooltip}
        </div>,
        document.body,
      )}
    </tr>
  )
}

export function MockTable({ columns, rows, summary, emptyMessage }: MockTableProps): React.JSX.Element {
  return (
    <div>
      {summary && Object.keys(summary).length > 0 && (
        <div style={mockTableSummaryStyle}>
          {Object.entries(summary).map(([k, v]) => (
            <span key={k} style={{ display: 'inline-flex', alignItems: 'baseline' }}>
              <span style={mockTableSummaryLabelStyle}>{k}</span>
              <span style={mockTableSummaryValueStyle}>{v}</span>
            </span>
          ))}
        </div>
      )}
      <table style={{
        width: '100%', borderCollapse: 'collapse',
        border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden',
      }}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                style={{
                  ...mockTableHeaderStyle,
                  textAlign: c.align ?? 'left',
                  width: c.width,
                }}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                style={{ ...mockTableCellStyle, color: 'var(--text-secondary)', fontStyle: 'italic', textAlign: 'center' }}
              >
                {emptyMessage ?? 'No entries yet.'}
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <MockTableRow key={r.key} row={r} columns={columns} />
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

interface MockFlagProps {
  readonly label: string
  readonly color?: string
}

export function MockFlag({ label, color = 'var(--danger)' }: MockFlagProps): React.JSX.Element {
  return (
    <span
      style={{
        display: 'inline-block',
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color,
        border: `1px solid ${color}`,
        borderRadius: 3,
        padding: '1px 6px',
        background: 'transparent',
      }}
    >
      {label}
    </span>
  )
}
