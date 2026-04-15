/**
 * NotesPanel, single clinician-notes panel for stage-level tabs.
 *
 * Drop-in right-rail component that persists a free-form notes block to the
 * onboarding row under a caller-provided section key. Auto-saves on blur and
 * registers a flush handler so the stage-advance button forces a save before
 * navigating.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { registerFlushHandler, notesRightCellStyle, railBlockLabel } from './NotesPrimitives'

interface NotesPanelProps {
  readonly caseId: string | number
  /** Section key under which to persist (e.g., 'testing_notes', 'diagnostics_notes'). */
  readonly sectionKey: string
  /** Header label shown above the textarea. */
  readonly title: string
  readonly placeholder?: string
  /** Optional assistant hint shown below the notes box. */
  readonly assistantHint?: string
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

const textareaStyle: React.CSSProperties = {
  flex: 1,
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
  minHeight: 200,
}

const assistantHintStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--text-secondary)',
  fontStyle: 'italic',
  lineHeight: 1.55,
  padding: '8px 10px',
  background: 'var(--bg)',
  border: '1px dashed var(--border)',
  borderRadius: 4,
  marginTop: 10,
}

export function NotesPanel({
  caseId,
  sectionKey,
  title,
  placeholder = 'Add clinician observations for this stage...',
  assistantHint,
}: NotesPanelProps): React.JSX.Element {
  const [value, setValue] = useState<string>('')
  const loaded = useRef(false)

  // Load existing notes once.
  useEffect(() => {
    if (loaded.current) return
    loaded.current = true
    ;(async () => {
      try {
        const resp = await window.psygil.onboarding.get({ case_id: Number(caseId) as never })
        // resp shape can differ by surface; guard broadly.
        const rows: readonly { section: string; content?: string }[] =
          (resp as { status?: string; data?: readonly { section: string; content?: string }[] })?.data ?? []
        const row = rows.find((r) => r.section === sectionKey)
        if (row?.content) setValue(row.content)
      } catch {
        // fine, empty state
      }
    })()
  }, [caseId, sectionKey])

  const save = useCallback(async () => {
    try {
      await window.psygil.onboarding.save({
        case_id: Number(caseId),
        section: sectionKey as never,
        data: { content: value, status: 'draft' },
      })
    } catch (err) {
      console.error('[NotesPanel] Failed to save', sectionKey, err)
    }
  }, [caseId, sectionKey, value])

  // Register with global flush registry.
  useEffect(() => registerFlushHandler(save), [save])

  return (
    <div style={{ ...notesRightCellStyle, display: 'flex', flexDirection: 'column', padding: '0 22px 32px', height: '100%' }}>
      <div style={sectionNoteHeaderStyle}>{title}</div>
      <textarea
        style={textareaStyle}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => void save()}
        placeholder={placeholder}
      />
      {assistantHint && (
        <>
          <div style={{ ...railBlockLabel, marginTop: 16 }}>Writing Assistant</div>
          <div style={assistantHintStyle}>{assistantHint}</div>
        </>
      )}
    </div>
  )
}
