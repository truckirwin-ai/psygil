/**
 * DataConfirmationTab, Gate 1: Data Confirmation
 *
 * Split-view: original document text (left) + extracted data (right).
 * Clinician reviews each data category and marks it:
 *   - Confirmed: data is correct as extracted
 *   - Corrected: clinician edited the extracted data
 *   - Flagged: data is missing or needs attention
 *
 * Cannot advance past Onboarding until all required categories are confirmed.
 *
 * Spec reference: BUILD_MANIFEST Sprint 9, docs/engineering/19_Stage_0_Onboarding.md
 */

import { useState, useCallback, useEffect } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DataConfirmationTabProps {
  readonly caseId: number
}

type ConfirmationStatus = 'unreviewed' | 'confirmed' | 'corrected' | 'flagged'

interface DataCategory {
  readonly id: string
  readonly label: string
  readonly required: boolean
}

interface CategoryState {
  status: ConfirmationStatus
  notes: string
  /** Clinician-edited values override what the Ingestor extracted */
  corrections: Record<string, string>
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DATA_CATEGORIES: DataCategory[] = [
  { id: 'demographics', label: 'Demographics', required: true },
  { id: 'referral_questions', label: 'Referral Questions', required: true },
  { id: 'test_administrations', label: 'Test Administrations', required: false },
  { id: 'behavioral_observations', label: 'Behavioral Observations', required: false },
  { id: 'timeline_events', label: 'Timeline Events', required: false },
  { id: 'collateral_summary', label: 'Collateral Records', required: false },
]

const STATUS_COLORS: Record<ConfirmationStatus, string> = {
  unreviewed: 'var(--text-secondary)',
  confirmed: 'var(--stage-complete)',
  corrected: 'var(--stage-diagnostics)',
  flagged: 'var(--danger)',
}

const STATUS_LABELS: Record<ConfirmationStatus, string> = {
  unreviewed: 'Unreviewed',
  confirmed: 'Confirmed',
  corrected: 'Corrected',
  flagged: 'Needs Attention',
}

// ---------------------------------------------------------------------------
// Persistence key, stores confirmation state per case in localStorage
// (Will migrate to SQLite in a later sprint)
// ---------------------------------------------------------------------------

function getStorageKey(caseId: number): string {
  return `psygil-data-confirmation-${caseId}`
}

function loadConfirmationState(
  caseId: number
): Record<string, CategoryState> | null {
  try {
    const raw = localStorage.getItem(getStorageKey(caseId))
    return raw ? (JSON.parse(raw) as Record<string, CategoryState>) : null
  } catch {
    return null
  }
}

function saveConfirmationState(
  caseId: number,
  state: Record<string, CategoryState>
): void {
  try {
    localStorage.setItem(getStorageKey(caseId), JSON.stringify(state))
  } catch {
    // Swallow
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DataConfirmationTab({
  caseId,
}: DataConfirmationTabProps): React.JSX.Element {
  // Ingestor data
  const [ingestorData, setIngestorData] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)

  // Document list for left panel
  const [documents, setDocuments] = useState<
    Array<{ document_id: number; original_filename: string; indexed_content: string | null }>
  >([])
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null)

  // Confirmation state per category
  const [categoryStates, setCategoryStates] = useState<Record<string, CategoryState>>(() => {
    const saved = loadConfirmationState(caseId)
    if (saved) return saved
    const initial: Record<string, CategoryState> = {}
    for (const cat of DATA_CATEGORIES) {
      initial[cat.id] = { status: 'unreviewed', notes: '', corrections: {} }
    }
    return initial
  })

  // Active category in right panel
  const [activeCategory, setActiveCategory] = useState(DATA_CATEGORIES[0].id)

  // Manual behavioral observations
  const [manualObservations, setManualObservations] = useState('')

  // -----------------------------------------------------------------------
  // Load data
  // -----------------------------------------------------------------------

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    void (async () => {
      const [ingestorResp, docsResp, confirmationResp] = await Promise.all([
        window.psygil.ingestor.getResult({ caseId }),
        window.psygil.documents.list({ case_id: caseId }),
        window.psygil.dataConfirmation.get({ caseId }),
      ])

      if (cancelled) return

      if (ingestorResp.status === 'success') {
        setIngestorData(ingestorResp.data as Record<string, unknown>)
      }

      if (docsResp.status === 'success') {
        const docs = (docsResp.data as unknown as Array<{
          document_id: number
          original_filename: string
          indexed_content: string | null
        }>).filter((d) => d.indexed_content)
        setDocuments(docs)
        if (docs.length > 0) setSelectedDocId(docs[0].document_id)
      }

      // Load confirmation state from IPC, then fall back to localStorage as backup
      if (confirmationResp.status === 'success' && confirmationResp.data.data.length > 0) {
        const ipcStates: Record<string, CategoryState> = {}
        for (const row of confirmationResp.data.data) {
          ipcStates[row.category_id] = {
            status: row.status as ConfirmationStatus,
            notes: row.notes,
            corrections: {},
          }
        }
        // Merge with existing categories to ensure all categories exist
        const merged: Record<string, CategoryState> = {}
        for (const cat of DATA_CATEGORIES) {
          merged[cat.id] = ipcStates[cat.id] ?? { status: 'unreviewed', notes: '', corrections: {} }
        }
        setCategoryStates(merged)
      }

      setLoading(false)
    })()

    return () => { cancelled = true }
  }, [caseId])

  // -----------------------------------------------------------------------
  // Save confirmation state on change (both localStorage and IPC)
  // -----------------------------------------------------------------------

  useEffect(() => {
    // Save to localStorage as backup
    saveConfirmationState(caseId, categoryStates)

    // Save each category to IPC
    void (async () => {
      for (const [categoryId, state] of Object.entries(categoryStates)) {
        await window.psygil.dataConfirmation.save({
          caseId,
          categoryId,
          status: state.status,
          notes: state.notes,
        })
      }
    })()
  }, [caseId, categoryStates])

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  const updateCategoryStatus = useCallback((catId: string, status: ConfirmationStatus) => {
    setCategoryStates((prev) => ({
      ...prev,
      [catId]: { ...prev[catId], status },
    }))
  }, [])

  const updateCategoryNotes = useCallback((catId: string, notes: string) => {
    setCategoryStates((prev) => ({
      ...prev,
      [catId]: { ...prev[catId], notes },
    }))
  }, [])

  // -----------------------------------------------------------------------
  // Derived state
  // -----------------------------------------------------------------------

  const selectedDoc = documents.find((d) => d.document_id === selectedDocId)

  const requiredCategories = DATA_CATEGORIES.filter((c) => c.required)
  const allRequiredConfirmed = requiredCategories.every(
    (c) => categoryStates[c.id]?.status === 'confirmed' || categoryStates[c.id]?.status === 'corrected'
  )
  const reviewedCount = DATA_CATEGORIES.filter(
    (c) => categoryStates[c.id]?.status !== 'unreviewed'
  ).length

  const activeCategoryData = ingestorData
    ? (ingestorData[activeCategory] as unknown)
    : null

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)', fontSize: 13 }}>
        Loading confirmation data...
      </div>
    )
  }

  if (!ingestorData) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 14, color: 'var(--text)' }}>
          No Ingestor data available
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          Run the Ingestor Agent first to extract case data, then return here to confirm it.
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* ── Left panel: Original documents ── */}
      <div style={{ width: '40%', display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border)' }}>
        {/* Document selector */}
        <div style={{
          padding: '8px 12px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--panel)',
          flexShrink: 0,
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
            Source Documents
          </div>
          <select
            value={selectedDocId ?? ''}
            onChange={(e) => setSelectedDocId(parseInt(e.currentTarget.value, 10))}
            style={{
              width: '100%',
              padding: '6px 8px',
              fontSize: 12,
              background: 'var(--bg)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              borderRadius: 3,
            }}
          >
            {documents.map((d) => (
              <option key={d.document_id} value={d.document_id}>
                {d.original_filename}
              </option>
            ))}
          </select>
        </div>

        {/* Document content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
          {selectedDoc?.indexed_content ? (
            <pre style={{
              fontSize: 12,
              lineHeight: 1.6,
              color: 'var(--text)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontFamily: 'monospace',
              margin: 0,
            }}>
              {selectedDoc.indexed_content}
            </pre>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
              No text content available for this document.
            </div>
          )}
        </div>
      </div>

      {/* ── Right panel: Extracted data + confirmation ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Confirmation status bar */}
        <div style={{
          padding: '10px 16px',
          borderBottom: '1px solid var(--border)',
          background: allRequiredConfirmed ? 'rgba(76,175,80,0.08)' : 'var(--panel)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
            Data Confirmation, {reviewedCount}/{DATA_CATEGORIES.length} reviewed
          </div>
          <div style={{
            padding: '3px 10px',
            borderRadius: 4,
            fontSize: 11,
            fontWeight: 600,
            background: allRequiredConfirmed ? 'var(--stage-complete)' : 'var(--border)',
            color: allRequiredConfirmed ? '#fff' : 'var(--text-secondary)',
          }}>
            {allRequiredConfirmed ? 'Ready to Advance' : 'Review Required'}
          </div>
        </div>

        {/* Category tabs */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border)',
          overflowX: 'auto',
          flexShrink: 0,
        }}>
          {DATA_CATEGORIES.map((cat) => {
            const state = categoryStates[cat.id]
            const isActive = activeCategory === cat.id
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                style={{
                  padding: '8px 14px',
                  fontSize: 12,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  whiteSpace: 'nowrap',
                }}
              >
                <span style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: STATUS_COLORS[state?.status ?? 'unreviewed'],
                  flexShrink: 0,
                }} />
                {cat.label}
                {cat.required && (
                  <span style={{ fontSize: 9, color: 'var(--danger)' }}>*</span>
                )}
              </button>
            )
          })}
        </div>

        {/* Category content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {activeCategory === 'behavioral_observations' ? (
            <BehavioralObservationsPane
              extractedData={activeCategoryData}
              manualObservations={manualObservations}
              onSetManualObservations={setManualObservations}
              status={categoryStates[activeCategory]?.status ?? 'unreviewed'}
              notes={categoryStates[activeCategory]?.notes ?? ''}
              onSetStatus={(s) => updateCategoryStatus(activeCategory, s)}
              onSetNotes={(n) => updateCategoryNotes(activeCategory, n)}
            />
          ) : (
            <GenericCategoryPane
              categoryId={activeCategory}
              data={activeCategoryData}
              status={categoryStates[activeCategory]?.status ?? 'unreviewed'}
              notes={categoryStates[activeCategory]?.notes ?? ''}
              onSetStatus={(s) => updateCategoryStatus(activeCategory, s)}
              onSetNotes={(n) => updateCategoryNotes(activeCategory, n)}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Generic Category Pane
// ---------------------------------------------------------------------------

function GenericCategoryPane({
  categoryId,
  data,
  status,
  notes,
  onSetStatus,
  onSetNotes,
}: {
  readonly categoryId: string
  readonly data: unknown
  readonly status: ConfirmationStatus
  readonly notes: string
  readonly onSetStatus: (s: ConfirmationStatus) => void
  readonly onSetNotes: (n: string) => void
}): React.JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Extracted data display */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
          Extracted Data
        </div>
        {data != null ? (
          <ExtractedDataDisplay data={data} />
        ) : (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic', padding: '12px 0' }}>
            No data extracted for this category. If this is expected, mark as Confirmed. If data should exist, mark as Needs Attention.
          </div>
        )}
      </div>

      {/* Confirmation controls */}
      <ConfirmationControls
        status={status}
        notes={notes}
        onSetStatus={onSetStatus}
        onSetNotes={onSetNotes}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Behavioral Observations Pane (includes manual entry - Sprint 9.3)
// ---------------------------------------------------------------------------

function BehavioralObservationsPane({
  extractedData,
  manualObservations,
  onSetManualObservations,
  status,
  notes,
  onSetStatus,
  onSetNotes,
}: {
  readonly extractedData: unknown
  readonly manualObservations: string
  readonly onSetManualObservations: (v: string) => void
  readonly status: ConfirmationStatus
  readonly notes: string
  readonly onSetStatus: (s: ConfirmationStatus) => void
  readonly onSetNotes: (n: string) => void
}): React.JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Extracted observations */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
          AI-Extracted Behavioral Observations (from transcripts)
        </div>
        {extractedData != null ? (
          <ExtractedDataDisplay data={extractedData} />
        ) : (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic', padding: '8px 0' }}>
            No behavioral observations extracted from transcripts.
          </div>
        )}
      </div>

      {/* Manual observation entry */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
          Clinician Direct Observations
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, lineHeight: 1.5 }}>
          Record your own behavioral observations from the evaluation sessions. These are clinician-authored and distinct from AI-extracted transcript observations.
        </p>
        <textarea
          value={manualObservations}
          onChange={(e) => onSetManualObservations(e.currentTarget.value)}
          placeholder="Describe the examinee's appearance, demeanor, cooperation, affect, speech patterns, motor activity, and any notable behaviors observed during evaluation sessions..."
          rows={8}
          style={{
            width: '100%',
            padding: '10px 12px',
            fontSize: 13,
            lineHeight: 1.6,
            background: 'var(--bg)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            resize: 'vertical',
            fontFamily: 'inherit',
          }}
        />
      </div>

      {/* Confirmation controls */}
      <ConfirmationControls
        status={status}
        notes={notes}
        onSetStatus={onSetStatus}
        onSetNotes={onSetNotes}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Confirmation Controls
// ---------------------------------------------------------------------------

function ConfirmationControls({
  status,
  notes,
  onSetStatus,
  onSetNotes,
}: {
  readonly status: ConfirmationStatus
  readonly notes: string
  readonly onSetStatus: (s: ConfirmationStatus) => void
  readonly onSetNotes: (n: string) => void
}): React.JSX.Element {
  const statuses: ConfirmationStatus[] = ['confirmed', 'corrected', 'flagged']

  return (
    <div style={{
      padding: '12px 16px',
      background: 'var(--panel)',
      border: '1px solid var(--border)',
      borderRadius: 6,
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
        Clinician Review
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {statuses.map((s) => (
          <button
            key={s}
            onClick={() => onSetStatus(s)}
            style={{
              flex: 1,
              padding: '8px 12px',
              fontSize: 12,
              fontWeight: status === s ? 600 : 400,
              border: `2px solid ${status === s ? STATUS_COLORS[s] : 'var(--border)'}`,
              borderRadius: 4,
              background: status === s ? `${STATUS_COLORS[s]}18` : 'var(--bg)',
              color: status === s ? STATUS_COLORS[s] : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      <textarea
        value={notes}
        onChange={(e) => onSetNotes(e.currentTarget.value)}
        placeholder="Optional: notes about corrections, missing data, or concerns..."
        rows={2}
        style={{
          width: '100%',
          padding: '8px 10px',
          fontSize: 12,
          lineHeight: 1.5,
          background: 'var(--bg)',
          color: 'var(--text)',
          border: '1px solid var(--border)',
          borderRadius: 4,
          resize: 'vertical',
          fontFamily: 'inherit',
        }}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Extracted Data Display, renders structured JSON as readable cards
// ---------------------------------------------------------------------------

function ExtractedDataDisplay({ data }: { readonly data: unknown }): React.JSX.Element {
  if (data == null) {
    return (
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
        No data
      </div>
    )
  }

  // Array of items
  if (Array.isArray(data)) {
    if (data.length === 0) {
      return (
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
          Empty, no items extracted
        </div>
      )
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data.map((item, idx) => (
          <div
            key={idx}
            style={{
              padding: '10px 12px',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 4,
            }}
          >
            <ExtractedDataDisplay data={item} />
          </div>
        ))}
      </div>
    )
  }

  // Object, render as key-value pairs
  if (typeof data === 'object') {
    const entries = Object.entries(data as Record<string, unknown>)
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {entries.map(([key, value]) => (
          <div key={key} style={{ display: 'flex', gap: 8, fontSize: 12, lineHeight: 1.5 }}>
            <span style={{
              color: 'var(--text-secondary)',
              fontWeight: 500,
              minWidth: 140,
              flexShrink: 0,
            }}>
              {key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}:
            </span>
            <span style={{ color: 'var(--text)' }}>
              {typeof value === 'object' && value !== null
                ? JSON.stringify(value, null, 2)
                : String(value ?? ',')}
            </span>
          </div>
        ))}
      </div>
    )
  }

  // Primitive
  return (
    <div style={{ fontSize: 12, color: 'var(--text)' }}>
      {String(data)}
    </div>
  )
}
