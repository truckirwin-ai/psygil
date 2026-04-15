/**
 * MultiNotesPanel, right-rail notes column with multiple labeled sub-sections.
 *
 * Stores all sub-section values as a single JSON payload under `sectionKey`.
 * Each sub-section renders a uppercase mono label + textarea. Auto-saves on
 * blur and registers a flush handler so stage-advance navigation forces a
 * save. Pattern mirrors NotesPanel but supports multiple notes blocks in the
 * same rail (e.g., Battery Selection, Validity & Effort, Testing Observations).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { registerFlushHandler, notesRightCellStyle, railBlockLabel } from './NotesPrimitives'

export interface NotesSection {
  readonly key: string
  readonly label: string
  readonly placeholder?: string
}

interface MultiNotesPanelProps {
  readonly caseId: string | number
  /** Persistence bucket, e.g., 'testing_notes', 'diagnostics_notes'. */
  readonly sectionKey: string
  /** Top-level panel title, e.g., 'Testing Notes'. */
  readonly title: string
  readonly sections: readonly NotesSection[]
}

const headerStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--text-secondary)',
  margin: '20px 0 12px',
  paddingBottom: 6,
  borderBottom: '1px solid var(--border)',
}

const textareaStyle: React.CSSProperties = {
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
  resize: 'vertical',
  minHeight: 90,
}

const sublabelStyle: React.CSSProperties = {
  ...railBlockLabel,
  marginTop: 14,
  marginBottom: 6,
}

export function MultiNotesPanel({
  caseId,
  sectionKey,
  title,
  sections,
}: MultiNotesPanelProps): React.JSX.Element {
  const [values, setValues] = useState<Record<string, string>>({})
  const loaded = useRef(false)

  useEffect(() => {
    if (loaded.current) return
    loaded.current = true
    ;(async () => {
      try {
        const resp = await window.psygil.onboarding.get({ case_id: Number(caseId) as never })
        const rows: readonly { section: string; content?: string }[] =
          (resp as { status?: string; data?: readonly { section: string; content?: string }[] })?.data ?? []
        const row = rows.find((r) => r.section === sectionKey)
        if (row?.content) {
          try {
            const parsed = JSON.parse(row.content) as Record<string, string> | { notes?: Record<string, string> }
            const data = (parsed && typeof parsed === 'object' && 'notes' in parsed && parsed.notes)
              ? parsed.notes
              : (parsed as Record<string, string>)
            if (data && typeof data === 'object') setValues(data)
          } catch {
            // Legacy single-string content; stash under first section key.
            if (sections[0]) setValues({ [sections[0].key]: row.content as string })
          }
        }
      } catch {
        /* empty state */
      }
    })()
  }, [caseId, sectionKey, sections])

  const save = useCallback(async (override?: Record<string, string>) => {
    try {
      await window.psygil.onboarding.save({
        case_id: Number(caseId),
        section: sectionKey as never,
        data: { content: JSON.stringify({ notes: override ?? values }), status: 'draft' },
      })
    } catch (err) {
      console.error('[MultiNotesPanel] Failed to save', sectionKey, err)
    }
  }, [caseId, sectionKey, values])

  useEffect(() => registerFlushHandler(() => save()), [save])

  return (
    <div style={{ ...notesRightCellStyle, padding: '0 22px 32px', height: '100%', overflowY: 'auto' }}>
      <div style={headerStyle}>{title}</div>
      {sections.map((section, idx) => (
        <div key={section.key}>
          <div style={idx === 0 ? { ...sublabelStyle, marginTop: 0 } : sublabelStyle}>{section.label}</div>
          <textarea
            style={textareaStyle}
            value={values[section.key] ?? ''}
            onChange={(e) => setValues((p) => ({ ...p, [section.key]: e.target.value }))}
            onBlur={() => void save()}
            placeholder={section.placeholder}
          />
        </div>
      ))}
    </div>
  )
}
