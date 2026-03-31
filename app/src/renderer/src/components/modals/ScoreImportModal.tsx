/**
 * ScoreImportModal
 *
 * Two-pathway score import for the Testing stage:
 *   Pathway A: Publisher PDF import (Q-Global, PARiConnect, etc.)
 *              → file picked/dropped → ingested to Testing subfolder → Ingestor parses
 *   Pathway B: Manual score entry form
 *              → clinician enters raw/T/scaled/percentile scores per instrument
 *
 * Spec reference: docs/engineering/20_Stage_1_Testing.md (Step 1.3)
 */

import { useState, useCallback } from 'react'
import type { DocumentRow } from '../../../../shared/types/ipc'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ScoreImportModalProps {
  readonly caseId: number
  readonly onClose: () => void
  readonly onImportComplete?: () => void
}

type ImportPathway = 'publisher' | 'manual'

interface ScaleScore {
  scaleName: string
  rawScore: string
  tScore: string
  percentile: string
  classification: string
}

// ---------------------------------------------------------------------------
// Instrument definitions for manual entry
// ---------------------------------------------------------------------------

const INSTRUMENTS = [
  { id: 'mmpi3', name: 'MMPI-3', publisher: 'Pearson (Q-Global)', scoringMethod: 'publisher' },
  { id: 'pai', name: 'PAI', publisher: 'PAR (PARiConnect)', scoringMethod: 'publisher' },
  { id: 'waisv', name: 'WAIS-V', publisher: 'Pearson', scoringMethod: 'manual' },
  { id: 'tomm', name: 'TOMM', publisher: 'PAR', scoringMethod: 'manual' },
  { id: 'sirs2', name: 'SIRS-2', publisher: 'PAR', scoringMethod: 'manual' },
  { id: 'mcmi4', name: 'MCMI-IV', publisher: 'Pearson', scoringMethod: 'publisher' },
  { id: 'pcl5', name: 'PCL-5', publisher: 'NCS Pearson', scoringMethod: 'manual' },
  { id: 'caps5', name: 'CAPS-5', publisher: 'NCS Pearson', scoringMethod: 'manual' },
  { id: 'other', name: 'Other Instrument', publisher: '', scoringMethod: 'manual' },
] as const

const ACCEPTED_EXTENSIONS = ['.pdf']

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ScoreImportModal({
  caseId,
  onClose,
  onImportComplete,
}: ScoreImportModalProps): React.JSX.Element {
  const [pathway, setPathway] = useState<ImportPathway>('publisher')

  // Publisher pathway state
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [selectedFileName, setSelectedFileName] = useState<string>('')
  const [isUploading, setIsUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<DocumentRow | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  // Manual pathway state
  const [selectedInstrument, setSelectedInstrument] = useState(INSTRUMENTS[0].id)
  const [customInstrumentName, setCustomInstrumentName] = useState('')
  const [administrationDate, setAdministrationDate] = useState(
    new Date().toISOString().split('T')[0]
  )
  const [scores, setScores] = useState<ScaleScore[]>([
    { scaleName: '', rawScore: '', tScore: '', percentile: '', classification: '' },
  ])
  const [validityScores, setValidityScores] = useState<ScaleScore[]>([
    { scaleName: '', rawScore: '', tScore: '', percentile: '', classification: '' },
  ])
  const [notes, setNotes] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // -----------------------------------------------------------------------
  // Publisher pathway: pick file
  // -----------------------------------------------------------------------

  const handlePickFile = useCallback(async () => {
    try {
      const resp = await window.psygil.documents.pickFile()
      if (resp.status === 'success' && resp.data != null) {
        const path = resp.data as string
        const name = path.split('/').pop() ?? 'unknown.pdf'
        const ext = '.' + name.split('.').pop()?.toLowerCase()
        if (!ACCEPTED_EXTENSIONS.includes(ext)) {
          setUploadError('Only PDF files are supported for publisher score import')
          return
        }
        setSelectedFile(path)
        setSelectedFileName(name)
        setUploadError(null)
      }
    } catch {
      setUploadError('Failed to pick file')
    }
  }, [])

  // -----------------------------------------------------------------------
  // Publisher pathway: upload + ingest
  // -----------------------------------------------------------------------

  const handlePublisherImport = useCallback(async () => {
    if (selectedFile == null) return

    setIsUploading(true)
    setUploadError(null)

    try {
      const resp = await window.psygil.documents.ingest({
        case_id: caseId,
        file_path: selectedFile,
        subfolder: 'Testing',
      })

      if (resp.status === 'success') {
        setUploadResult(resp.data as DocumentRow)
        onImportComplete?.()
      } else {
        setUploadError((resp as { message?: string }).message ?? 'Import failed')
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setIsUploading(false)
    }
  }, [selectedFile, caseId, onImportComplete])

  // -----------------------------------------------------------------------
  // Manual pathway: add/remove score rows
  // -----------------------------------------------------------------------

  const updateScore = useCallback(
    (index: number, field: keyof ScaleScore, value: string, isValidity: boolean) => {
      const setter = isValidity ? setValidityScores : setScores
      setter((prev) =>
        prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))
      )
    },
    []
  )

  const addScoreRow = useCallback((isValidity: boolean) => {
    const setter = isValidity ? setValidityScores : setScores
    setter((prev) => [
      ...prev,
      { scaleName: '', rawScore: '', tScore: '', percentile: '', classification: '' },
    ])
  }, [])

  const removeScoreRow = useCallback((index: number, isValidity: boolean) => {
    const setter = isValidity ? setValidityScores : setScores
    setter((prev) => prev.filter((_, i) => i !== index))
  }, [])

  // -----------------------------------------------------------------------
  // Manual pathway: save scores as JSON document
  // -----------------------------------------------------------------------

  const handleManualSave = useCallback(async () => {
    const instrument = INSTRUMENTS.find((i) => i.id === selectedInstrument)
    const instrumentName =
      selectedInstrument === 'other'
        ? customInstrumentName || 'Unknown Instrument'
        : instrument?.name ?? selectedInstrument

    // Build the score JSON
    const clinicalScales: Record<string, Record<string, string | number>> = {}
    for (const s of scores) {
      if (!s.scaleName.trim()) continue
      clinicalScales[s.scaleName.trim()] = {
        rawScore: s.rawScore ? parseFloat(s.rawScore) : 0,
        tScore: s.tScore ? parseFloat(s.tScore) : 0,
        percentile: s.percentile ? parseInt(s.percentile, 10) : 0,
        classification: s.classification,
      }
    }

    const validityIndicators: Record<string, Record<string, string | number>> = {}
    for (const s of validityScores) {
      if (!s.scaleName.trim()) continue
      validityIndicators[s.scaleName.trim()] = {
        rawScore: s.rawScore ? parseFloat(s.rawScore) : 0,
        tScore: s.tScore ? parseFloat(s.tScore) : 0,
        percentile: s.percentile ? parseInt(s.percentile, 10) : 0,
        interpretation: s.classification,
      }
    }

    const scoreData = {
      instrumentId: selectedInstrument,
      instrumentName,
      publisher: instrument?.publisher ?? '',
      administrationDate,
      importDate: new Date().toISOString(),
      importMethod: 'manual',
      clinicalScales,
      validityIndicators,
      notes,
      status: 'Scored',
      clinicianReviewStatus: 'NotReviewed',
      completeness:
        Object.keys(clinicalScales).length > 0 ? 'complete' : 'partial',
      flagsForReview: [] as string[],
    }

    setIsSaving(true)
    setSaveError(null)

    try {
      // Write score JSON to a temp file via blob, then ingest
      // For now, we'll use a simple approach: create a JSON blob and save via the ingest pipeline
      // The main process will receive the file and store it
      const jsonBlob = JSON.stringify(scoreData, null, 2)
      const fileName = `${selectedInstrument}_scores_${administrationDate}.json`

      // We need to write this to a temp location. Use the workspace config path.
      // Actually, the simplest approach: save directly via a new IPC method.
      // For MVP, we'll log the data and use the existing ingest path with a temp file.

      // Store the score data in the agent_results table as a manual score entry
      // This keeps it accessible to the Ingestor/Diagnostician agents
      const resp = await window.psygil.documents.ingest({
        case_id: caseId,
        file_path: `__manual_score__:${fileName}:${btoa(jsonBlob)}`,
        subfolder: 'Testing',
      })

      // Note: The above uses a sentinel prefix that the main process will need to handle.
      // For Sprint 8, we'll accept that manual scores are stored as JSON documents.
      // A proper approach would be to write to the testAdministrations table directly.

      if (resp.status === 'success') {
        onImportComplete?.()
        onClose()
      } else {
        setSaveError((resp as { message?: string }).message ?? 'Save failed')
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setIsSaving(false)
    }
  }, [
    caseId,
    selectedInstrument,
    customInstrumentName,
    administrationDate,
    scores,
    validityScores,
    notes,
    onImportComplete,
    onClose,
  ])

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isUploading && !isSaving) onClose()
      }}
    >
      <div
        style={{
          width: 680,
          maxHeight: '85vh',
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>
            Import Test Scores
          </h2>
          <button
            onClick={onClose}
            disabled={isUploading || isSaving}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 18,
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        {/* Pathway selector */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--border)',
            background: 'var(--panel)',
          }}
        >
          <button
            onClick={() => setPathway('publisher')}
            style={{
              flex: 1,
              padding: '10px 16px',
              fontSize: 13,
              fontWeight: pathway === 'publisher' ? 600 : 400,
              color: pathway === 'publisher' ? 'var(--accent)' : 'var(--text-secondary)',
              background: 'transparent',
              border: 'none',
              borderBottom: pathway === 'publisher' ? '2px solid var(--accent)' : '2px solid transparent',
              cursor: 'pointer',
            }}
          >
            From Publisher PDF
          </button>
          <button
            onClick={() => setPathway('manual')}
            style={{
              flex: 1,
              padding: '10px 16px',
              fontSize: 13,
              fontWeight: pathway === 'manual' ? 600 : 400,
              color: pathway === 'manual' ? 'var(--accent)' : 'var(--text-secondary)',
              background: 'transparent',
              border: 'none',
              borderBottom: pathway === 'manual' ? '2px solid var(--accent)' : '2px solid transparent',
              cursor: 'pointer',
            }}
          >
            Manual Entry
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {pathway === 'publisher' ? (
            <PublisherPathway
              selectedFile={selectedFile}
              selectedFileName={selectedFileName}
              isUploading={isUploading}
              uploadResult={uploadResult}
              uploadError={uploadError}
              onPickFile={handlePickFile}
              onImport={handlePublisherImport}
            />
          ) : (
            <ManualPathway
              selectedInstrument={selectedInstrument}
              onSelectInstrument={setSelectedInstrument}
              customInstrumentName={customInstrumentName}
              onSetCustomName={setCustomInstrumentName}
              administrationDate={administrationDate}
              onSetDate={setAdministrationDate}
              scores={scores}
              validityScores={validityScores}
              onUpdateScore={updateScore}
              onAddRow={addScoreRow}
              onRemoveRow={removeScoreRow}
              notes={notes}
              onSetNotes={setNotes}
              isSaving={isSaving}
              saveError={saveError}
              onSave={handleManualSave}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Publisher Pathway sub-component
// ---------------------------------------------------------------------------

function PublisherPathway({
  selectedFile,
  selectedFileName,
  isUploading,
  uploadResult,
  uploadError,
  onPickFile,
  onImport,
}: {
  readonly selectedFile: string | null
  readonly selectedFileName: string
  readonly isUploading: boolean
  readonly uploadResult: DocumentRow | null
  readonly uploadError: string | null
  readonly onPickFile: () => void
  readonly onImport: () => void
}): React.JSX.Element {
  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--text)', marginBottom: 16, lineHeight: 1.5 }}>
        Import a score report PDF from your publisher platform (Q-Global, PARiConnect, CNS Vital
        Signs, etc.). The file will be ingested into the Testing folder and the Ingestor Agent
        will extract scores automatically.
      </p>

      {/* File selection */}
      <div
        onClick={onPickFile}
        style={{
          border: '2px dashed var(--border)',
          borderRadius: 8,
          padding: '24px 20px',
          textAlign: 'center',
          background: 'var(--panel)',
          cursor: 'pointer',
          marginBottom: 16,
        }}
      >
        {selectedFile == null ? (
          <>
            <div style={{ fontSize: 24, marginBottom: 8, opacity: 0.5 }}>📄</div>
            <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>
              Click to select publisher score report PDF
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
              Supports Q-Global, PARiConnect, and other publisher exports
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500 }}>
              {selectedFileName}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
              Click to change file
            </div>
          </>
        )}
      </div>

      {/* Upload result */}
      {uploadResult && (
        <div
          style={{
            padding: '10px 14px',
            background: 'rgba(76,175,80,0.1)',
            border: '1px solid #4caf50',
            borderRadius: 4,
            fontSize: 13,
            color: '#4caf50',
            marginBottom: 16,
          }}
        >
          Score report imported successfully. Run the Ingestor Agent to extract scores.
        </div>
      )}

      {/* Error */}
      {uploadError && (
        <div
          style={{
            padding: '10px 14px',
            background: 'rgba(244,67,54,0.1)',
            border: '1px solid #f44336',
            borderRadius: 4,
            fontSize: 13,
            color: '#f44336',
            marginBottom: 16,
          }}
        >
          {uploadError}
        </div>
      )}

      {/* Import button */}
      {selectedFile != null && !uploadResult && (
        <button
          onClick={onImport}
          disabled={isUploading}
          style={{
            padding: '10px 20px',
            fontSize: 13,
            fontWeight: 600,
            border: 'none',
            borderRadius: 4,
            background: 'var(--accent)',
            color: '#ffffff',
            cursor: isUploading ? 'wait' : 'pointer',
            width: '100%',
          }}
        >
          {isUploading ? 'Importing\u2026' : 'Import Score Report'}
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Manual Pathway sub-component
// ---------------------------------------------------------------------------

function ManualPathway({
  selectedInstrument,
  onSelectInstrument,
  customInstrumentName,
  onSetCustomName,
  administrationDate,
  onSetDate,
  scores,
  validityScores,
  onUpdateScore,
  onAddRow,
  onRemoveRow,
  notes,
  onSetNotes,
  isSaving,
  saveError,
  onSave,
}: {
  readonly selectedInstrument: string
  readonly onSelectInstrument: (id: string) => void
  readonly customInstrumentName: string
  readonly onSetCustomName: (name: string) => void
  readonly administrationDate: string
  readonly onSetDate: (date: string) => void
  readonly scores: readonly ScaleScore[]
  readonly validityScores: readonly ScaleScore[]
  readonly onUpdateScore: (index: number, field: keyof ScaleScore, value: string, isValidity: boolean) => void
  readonly onAddRow: (isValidity: boolean) => void
  readonly onRemoveRow: (index: number, isValidity: boolean) => void
  readonly notes: string
  readonly onSetNotes: (notes: string) => void
  readonly isSaving: boolean
  readonly saveError: string | null
  readonly onSave: () => void
}): React.JSX.Element {
  const inputStyle: React.CSSProperties = {
    padding: '6px 8px',
    fontSize: 12,
    background: 'var(--bg)',
    color: 'var(--text)',
    border: '1px solid var(--border)',
    borderRadius: 3,
  }

  return (
    <div>
      {/* Instrument selector */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Instrument
          </label>
          <select
            value={selectedInstrument}
            onChange={(e) => onSelectInstrument(e.currentTarget.value)}
            style={{ ...inputStyle, width: '100%' }}
          >
            {INSTRUMENTS.map((inst) => (
              <option key={inst.id} value={inst.id}>
                {inst.name}
              </option>
            ))}
          </select>
        </div>

        {selectedInstrument === 'other' && (
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Instrument Name
            </label>
            <input
              type="text"
              value={customInstrumentName}
              onChange={(e) => onSetCustomName(e.currentTarget.value)}
              placeholder="Enter instrument name"
              style={{ ...inputStyle, width: '100%' }}
            />
          </div>
        )}

        <div style={{ width: 150 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Admin Date
          </label>
          <input
            type="date"
            value={administrationDate}
            onChange={(e) => onSetDate(e.currentTarget.value)}
            style={{ ...inputStyle, width: '100%' }}
          />
        </div>
      </div>

      {/* Clinical Scales */}
      <ScoreTable
        title="Clinical Scales"
        scores={scores}
        isValidity={false}
        onUpdate={onUpdateScore}
        onAddRow={onAddRow}
        onRemoveRow={onRemoveRow}
      />

      {/* Validity Indicators */}
      <ScoreTable
        title="Validity Indicators"
        scores={validityScores}
        isValidity={true}
        onUpdate={onUpdateScore}
        onAddRow={onAddRow}
        onRemoveRow={onRemoveRow}
      />

      {/* Notes */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => onSetNotes(e.currentTarget.value)}
          placeholder="Administration notes, behavioral observations during testing..."
          rows={3}
          style={{
            ...inputStyle,
            width: '100%',
            resize: 'vertical',
            fontFamily: 'inherit',
          }}
        />
      </div>

      {/* Error */}
      {saveError && (
        <div
          style={{
            padding: '8px 12px',
            background: 'rgba(244,67,54,0.1)',
            border: '1px solid #f44336',
            borderRadius: 4,
            fontSize: 12,
            color: '#f44336',
            marginBottom: 12,
          }}
        >
          {saveError}
        </div>
      )}

      {/* Save button */}
      <button
        onClick={onSave}
        disabled={isSaving}
        style={{
          padding: '10px 20px',
          fontSize: 13,
          fontWeight: 600,
          border: 'none',
          borderRadius: 4,
          background: 'var(--accent)',
          color: '#ffffff',
          cursor: isSaving ? 'wait' : 'pointer',
          width: '100%',
        }}
      >
        {isSaving ? 'Saving\u2026' : 'Save Scores'}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Score Table sub-component
// ---------------------------------------------------------------------------

function ScoreTable({
  title,
  scores,
  isValidity,
  onUpdate,
  onAddRow,
  onRemoveRow,
}: {
  readonly title: string
  readonly scores: readonly ScaleScore[]
  readonly isValidity: boolean
  readonly onUpdate: (index: number, field: keyof ScaleScore, value: string, isValidity: boolean) => void
  readonly onAddRow: (isValidity: boolean) => void
  readonly onRemoveRow: (index: number, isValidity: boolean) => void
}): React.JSX.Element {
  const cellStyle: React.CSSProperties = {
    padding: '4px 6px',
    fontSize: 12,
    background: 'var(--bg)',
    color: 'var(--text)',
    border: '1px solid var(--border)',
    borderRadius: 2,
    width: '100%',
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {title}
        </span>
        <button
          onClick={() => onAddRow(isValidity)}
          style={{
            padding: '2px 8px',
            fontSize: 11,
            border: '1px solid var(--border)',
            borderRadius: 3,
            background: 'var(--panel)',
            color: 'var(--text)',
            cursor: 'pointer',
          }}
        >
          + Add Row
        </button>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 4, fontSize: 10, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
        <span style={{ width: 120 }}>Scale</span>
        <span style={{ width: 60 }}>Raw</span>
        <span style={{ width: 60 }}>T-Score</span>
        <span style={{ width: 60 }}>%ile</span>
        <span style={{ flex: 1 }}>{isValidity ? 'Interpretation' : 'Classification'}</span>
        <span style={{ width: 24 }} />
      </div>

      {scores.map((score, idx) => (
        <div key={idx} style={{ display: 'flex', gap: 4, marginBottom: 4, alignItems: 'center' }}>
          <input
            type="text"
            value={score.scaleName}
            onChange={(e) => onUpdate(idx, 'scaleName', e.currentTarget.value, isValidity)}
            placeholder="Scale"
            style={{ ...cellStyle, width: 120 }}
          />
          <input
            type="text"
            value={score.rawScore}
            onChange={(e) => onUpdate(idx, 'rawScore', e.currentTarget.value, isValidity)}
            placeholder="—"
            style={{ ...cellStyle, width: 60, textAlign: 'center' }}
          />
          <input
            type="text"
            value={score.tScore}
            onChange={(e) => onUpdate(idx, 'tScore', e.currentTarget.value, isValidity)}
            placeholder="—"
            style={{ ...cellStyle, width: 60, textAlign: 'center' }}
          />
          <input
            type="text"
            value={score.percentile}
            onChange={(e) => onUpdate(idx, 'percentile', e.currentTarget.value, isValidity)}
            placeholder="—"
            style={{ ...cellStyle, width: 60, textAlign: 'center' }}
          />
          <input
            type="text"
            value={score.classification}
            onChange={(e) => onUpdate(idx, 'classification', e.currentTarget.value, isValidity)}
            placeholder={isValidity ? 'Valid/Invalid' : 'Average/Elevated/etc.'}
            style={{ ...cellStyle, flex: 1 }}
          />
          <button
            onClick={() => onRemoveRow(idx, isValidity)}
            style={{
              width: 24,
              height: 24,
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: 13,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
