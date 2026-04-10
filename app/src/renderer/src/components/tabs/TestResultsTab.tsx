import React, { useState, useEffect } from 'react'
import styles from './TestResultsTab.module.css'

interface TestResultsTabProps {
  caseId: number
  onImportScores?: (caseId: number) => void
}

interface TestScore {
  scale: string
  abbrev?: string
  tScore?: number
  score?: string | number
  interpretation: string
  isElevated?: boolean
}

interface InstrumentData {
  name: string
  abbrev: string
  date: string
  scores: TestScore[][]
  clinical?: string
}

// Shape returned by window.psygil.testScores.list()
interface DbScoreRow {
  score_id: number
  case_id: number
  instrument_name: string
  instrument_abbrev: string
  administration_date: string
  data_entry_method: string
  scores_json: string
  validity_scores_json: string
  clinical_narrative: string
  notes: string
}

interface DbScoreEntry {
  scale_name: string
  raw_score?: number | string
  t_score?: number
  percentile?: number | string
  scaled_score?: number | string
  interpretation?: string
  is_elevated?: boolean
}

// Transform a DB row into the InstrumentData shape used for rendering
function transformDbRow(row: DbScoreRow): InstrumentData {
  const parseEntries = (json: string): DbScoreEntry[] => {
    try {
      return JSON.parse(json) as DbScoreEntry[]
    } catch {
      return []
    }
  }

  const validityEntries = parseEntries(row.validity_scores_json)
  const scoreEntries = parseEntries(row.scores_json)

  const toTestScore = (e: DbScoreEntry): TestScore => ({
    scale: e.scale_name,
    tScore: e.t_score,
    score: e.scaled_score ?? e.raw_score,
    interpretation: e.interpretation ?? '',
    isElevated: e.is_elevated ?? false,
  })

  const sections: TestScore[][] = []
  if (validityEntries.length > 0) {
    sections.push(validityEntries.map(toTestScore))
  }
  if (scoreEntries.length > 0) {
    sections.push(scoreEntries.map(toTestScore))
  }

  const dateStr = row.administration_date
    ? new Date(row.administration_date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Unknown date'

  return {
    name: row.instrument_name,
    abbrev: row.instrument_abbrev,
    date: dateStr,
    scores: sections,
    clinical: row.clinical_narrative || undefined,
  }
}

// Demo test data for Johnson case (c001)
const JOHNSON_TESTS: Record<string, InstrumentData> = {
  'mmpi3': {
    name: 'MMPI-3',
    abbrev: 'Minnesota Multiphasic Personality Inventory-3',
    date: 'Mar 10, 2026',
    scores: [
      // Validity scales
      [
        { scale: 'Cannot Say', abbrev: 'CNS', tScore: 2, interpretation: 'Acceptable (≤15)' },
        { scale: 'Variable Response Inconsistency', abbrev: 'VRIN-r', tScore: 52, interpretation: 'Consistent responding' },
        { scale: 'True Response Inconsistency', abbrev: 'TRIN-r', tScore: 55, interpretation: 'Acceptable' },
        { scale: 'Infrequent Responses', abbrev: 'F-r', tScore: 62, interpretation: 'Within normal limits' },
        { scale: 'Infrequent Psychopathology', abbrev: 'Fp-r', tScore: 55, interpretation: 'No feigned psychopathology' },
        { scale: 'Infrequent Somatic', abbrev: 'Fs-r', tScore: 48, interpretation: 'No somatic over-reporting' },
        { scale: 'Symptom Validity', abbrev: 'FBS-r', tScore: 52, interpretation: 'No symptom exaggeration' },
        { scale: 'Response Bias Scale', abbrev: 'RBS', tScore: 58, interpretation: 'No over-reporting' },
        { scale: 'Uncommonly Virtuous', abbrev: 'L-r', tScore: 48, interpretation: 'No positive impression management' },
        { scale: 'Adjustment Validity', abbrev: 'K-r', tScore: 44, interpretation: 'No defensiveness' },
      ],
      // Higher-order scales
      [
        { scale: 'Emotional/Internalizing', abbrev: 'EID', tScore: 65, interpretation: 'Moderate emotional distress' },
        { scale: 'Thought Dysfunction', abbrev: 'THD', tScore: 75, interpretation: 'Significant thought disturbance', isElevated: true },
        { scale: 'Behavioral/Externalizing', abbrev: 'BXD', tScore: 58, interpretation: 'Within normal limits' },
      ],
      // Restructured clinical scales
      [
        { scale: 'Demoralization', abbrev: 'RCd', tScore: 62, interpretation: 'Mild distress' },
        { scale: 'Somatic Complaints', abbrev: 'RC1', tScore: 48, interpretation: 'No somatic concerns' },
        { scale: 'Low Positive Emotions', abbrev: 'RC2', tScore: 55, interpretation: 'Mildly reduced positive affect' },
        { scale: 'Cynicism', abbrev: 'RC3', tScore: 52, interpretation: 'Average interpersonal trust' },
        { scale: 'Antisocial Behavior', abbrev: 'RC4', tScore: 58, interpretation: 'Slightly elevated rule-breaking' },
        { scale: 'Ideas of Persecution', abbrev: 'RC6', tScore: 72, interpretation: 'Persecutory ideation endorsed', isElevated: true },
        { scale: 'Dysfunctional Negative Emotions', abbrev: 'RC7', tScore: 60, interpretation: 'Some anxiety/irritability' },
        { scale: 'Aberrant Experiences', abbrev: 'RC8', tScore: 78, interpretation: 'Unusual perceptual experiences', isElevated: true },
        { scale: 'Hypomanic Activation', abbrev: 'RC9', tScore: 52, interpretation: 'Average energy/activation' },
      ],
    ],
    clinical: 'Schizophrenia-consistent profile with significant elevations on THD (75T), RC6 (72T), and RC8 (78T), indicating thought disturbance, persecutory ideation, and unusual perceptual experiences. Validity scales are acceptable.',
  },
  'pai': {
    name: 'PAI',
    abbrev: 'Personality Assessment Inventory',
    date: 'Mar 10, 2026',
    scores: [
      // Validity scales
      [
        { scale: 'Inconsistency', abbrev: 'INC', tScore: 52, interpretation: 'Consistent' },
        { scale: 'Infrequency', abbrev: 'INF', tScore: 48, interpretation: 'Acceptable' },
        { scale: 'Negative Impression', abbrev: 'NIM', tScore: 58, interpretation: 'No over-reporting' },
        { scale: 'Positive Impression', abbrev: 'PIM', tScore: 45, interpretation: 'No defensiveness' },
      ],
      // Clinical scales
      [
        { scale: 'Somatic Complaints', abbrev: 'SOM', tScore: 52, interpretation: 'Normal' },
        { scale: 'Anxiety', abbrev: 'ANX', tScore: 62, interpretation: 'Mild anxiety' },
        { scale: 'Anxiety-Related Disorders', abbrev: 'ARD', tScore: 58, interpretation: 'Normal' },
        { scale: 'Depression', abbrev: 'DEP', tScore: 60, interpretation: 'Mild depressive features' },
        { scale: 'Mania', abbrev: 'MAN', tScore: 55, interpretation: 'Normal' },
        { scale: 'Paranoia', abbrev: 'PAR', tScore: 68, interpretation: 'Persecutory ideation', isElevated: true },
        { scale: 'Schizophrenia', abbrev: 'SCZ', tScore: 72, interpretation: 'Thought disturbance', isElevated: true },
        { scale: 'Borderline Features', abbrev: 'BOR', tScore: 55, interpretation: 'Normal' },
        { scale: 'Antisocial Features', abbrev: 'ANT', tScore: 58, interpretation: 'Normal' },
        { scale: 'Alcohol Problems', abbrev: 'ALC', tScore: 48, interpretation: 'No concerns' },
        { scale: 'Drug Problems', abbrev: 'DRG', tScore: 45, interpretation: 'No concerns' },
      ],
      // Treatment scales
      [
        { scale: 'Aggression', tScore: 55, interpretation: 'Normal' },
        { scale: 'Suicidal Ideation', tScore: 48, interpretation: 'No current SI' },
        { scale: 'Stress', tScore: 62, interpretation: 'Moderate stress' },
        { scale: 'Nonsupport', tScore: 58, interpretation: 'Some perceived lack of support' },
        { scale: 'Treatment Rejection', tScore: 42, interpretation: 'Open to treatment' },
      ],
    ],
    clinical: 'PAI profile corroborates MMPI-3 findings. SCZ (72T) and PAR (68T) elevations consistent with schizophrenia spectrum disorder. Treatment scales favorable.',
  },
  'waisv': {
    name: 'WAIS-V',
    abbrev: 'Wechsler Adult Intelligence Scale, Fifth Edition',
    date: 'Mar 11, 2026',
    scores: [
      // Composite scores
      [
        { scale: 'Full Scale IQ', score: '82', tScore: 82, interpretation: 'Low Average (12th percentile)' },
        { scale: 'Verbal Comprehension', score: '78', tScore: 78, interpretation: 'Borderline (7th percentile)' },
        { scale: 'Visual Spatial', score: '88', tScore: 88, interpretation: 'Low Average (21st percentile)' },
        { scale: 'Fluid Reasoning', score: '85', tScore: 85, interpretation: 'Low Average (16th percentile)' },
        { scale: 'Working Memory', score: '80', tScore: 80, interpretation: 'Low Average (9th percentile)' },
        { scale: 'Processing Speed', score: '86', tScore: 86, interpretation: 'Low Average (18th percentile)' },
      ],
      // Subtests
      [
        { scale: 'Similarities', score: '6', interpretation: '9th percentile' },
        { scale: 'Vocabulary', score: '5', interpretation: '5th percentile' },
        { scale: 'Block Design', score: '8', interpretation: '25th percentile' },
        { scale: 'Visual Puzzles', score: '7', interpretation: '16th percentile' },
        { scale: 'Matrix Reasoning', score: '7', interpretation: '16th percentile' },
        { scale: 'Figure Weights', score: '8', interpretation: '25th percentile' },
        { scale: 'Digit Span', score: '6', interpretation: '9th percentile' },
        { scale: 'Arithmetic', score: '7', interpretation: '16th percentile' },
        { scale: 'Symbol Search', score: '7', interpretation: '16th percentile' },
        { scale: 'Coding', score: '8', interpretation: '25th percentile' },
      ],
    ],
    clinical: 'Low-average intellectual functioning with notable verbal weakness relative to visual-spatial skills. Working memory impairment may reflect attention difficulties in active psychosis.',
  },
  'tomm': {
    name: 'TOMM',
    abbrev: 'Test of Memory Malingering',
    date: 'Mar 11, 2026',
    scores: [
      [
        { scale: 'Trial 1', score: '42/50', interpretation: 'Adequate performance' },
        { scale: 'Trial 2', score: '48/50', interpretation: 'PASS, Above cut score', isElevated: true },
      ],
    ],
    clinical: 'No indication of feigned memory impairment. Performance well above cut score (45) indicates genuine memory functioning and adequate effort.',
  },
  'sirs2': {
    name: 'SIRS-2',
    abbrev: 'Structured Interview of Reported Symptoms, 2nd Edition',
    date: 'Mar 12, 2026',
    scores: [
      [
        { scale: 'Reported Cognition Problems', abbrev: 'RC', score: '3', interpretation: 'Honest' },
        { scale: 'Reported Affective Problems', abbrev: 'RA', score: '2', interpretation: 'Honest' },
        { scale: 'Reported Neurological Symptoms', abbrev: 'RN', score: '4', interpretation: 'Honest' },
        { scale: 'Reported Low Awareness', abbrev: 'RLA', score: '1', interpretation: 'Honest' },
        { scale: 'Unusual Symptom Combinations', abbrev: 'USC', score: '2', interpretation: 'Honest' },
        { scale: 'Rare Symptoms', abbrev: 'RS', score: '1', interpretation: 'Honest' },
        { scale: 'Symptom Combinations', abbrev: 'SC', score: '0', interpretation: 'Honest' },
        { scale: 'Inconsistency of Symptoms', abbrev: 'IS', score: '1', interpretation: 'Honest' },
      ],
    ],
    clinical: 'All primary scales in "Honest" classification range. No evidence of symptom fabrication or malingering.',
  },
}

const TestResultsTab: React.FC<TestResultsTabProps> = ({ caseId, onImportScores }) => {
  const [activeInstrument, setActiveInstrument] = useState<string>('summary')
  const [dbInstruments, setDbInstruments] = useState<InstrumentData[] | null>(null)
  const [loading, setLoading] = useState(false)

  const isJohnson = caseId === 1 || caseId === 0

  // Load real test scores from the database
  useEffect(() => {
    if (isJohnson) return // demo case uses hardcoded data

    let cancelled = false
    setLoading(true)
    setDbInstruments(null)

    void (async () => {
      try {
        const resp = await window.psygil?.testScores?.list?.({ case_id: caseId })
        if (cancelled) return
        const rows = resp?.status === 'success' && Array.isArray(resp.data) ? resp.data : null
        if (rows && rows.length > 0) {
          setDbInstruments((rows as DbScoreRow[]).map(transformDbRow))
        } else {
          setDbInstruments([])
        }
      } catch {
        if (!cancelled) setDbInstruments([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [caseId, isJohnson])

  // Build instrument list for sub-tabs
  const instrumentKeys: string[] = isJohnson
    ? Object.keys(JOHNSON_TESTS)
    : (dbInstruments ?? []).map((_, i) => String(i))

  const hasRealData = !isJohnson && dbInstruments != null && dbInstruments.length > 0

  return (
    <div className={styles.testResultsTab}>
      {/* Sub-tabs for instruments */}
      <div className={styles.subTabBar}>
        <button
          className={`${styles.subTab} ${activeInstrument === 'summary' ? styles.active : ''}`}
          onClick={() => setActiveInstrument('summary')}
        >
          Summary
        </button>
        {isJohnson && (
          <>
            <button
              className={`${styles.subTab} ${activeInstrument === 'mmpi3' ? styles.active : ''}`}
              onClick={() => setActiveInstrument('mmpi3')}
            >
              MMPI-3
            </button>
            <button
              className={`${styles.subTab} ${activeInstrument === 'pai' ? styles.active : ''}`}
              onClick={() => setActiveInstrument('pai')}
            >
              PAI
            </button>
            <button
              className={`${styles.subTab} ${activeInstrument === 'waisv' ? styles.active : ''}`}
              onClick={() => setActiveInstrument('waisv')}
            >
              WAIS-V
            </button>
            <button
              className={`${styles.subTab} ${activeInstrument === 'tomm' ? styles.active : ''}`}
              onClick={() => setActiveInstrument('tomm')}
            >
              TOMM
            </button>
            <button
              className={`${styles.subTab} ${activeInstrument === 'sirs2' ? styles.active : ''}`}
              onClick={() => setActiveInstrument('sirs2')}
            >
              SIRS-2
            </button>
          </>
        )}
        {hasRealData && instrumentKeys.map((key, idx) => (
          <button
            key={key}
            className={`${styles.subTab} ${activeInstrument === key ? styles.active : ''}`}
            onClick={() => setActiveInstrument(key)}
          >
            {dbInstruments![idx].name}
          </button>
        ))}
      </div>

      {/* Summary tab */}
      {activeInstrument === 'summary' && (
        <SummaryPane
          isJohnson={isJohnson}
          loading={loading}
          dbInstruments={dbInstruments}
          caseId={caseId}
          onImportScores={onImportScores}
        />
      )}

      {/* Demo case: per-instrument tabs */}
      {isJohnson && activeInstrument in JOHNSON_TESTS && (
        <InstrumentPane data={JOHNSON_TESTS[activeInstrument]} />
      )}

      {/* Real data: per-instrument tabs */}
      {hasRealData && activeInstrument !== 'summary' && (() => {
        const idx = instrumentKeys.indexOf(activeInstrument)
        return idx >= 0 ? <InstrumentPane data={dbInstruments![idx]} /> : null
      })()}
    </div>
  )
}

interface SummaryPaneProps {
  isJohnson: boolean
  loading: boolean
  dbInstruments: InstrumentData[] | null
  caseId: number
  onImportScores?: (caseId: number) => void
}

const SummaryPane: React.FC<SummaryPaneProps> = ({
  isJohnson,
  loading,
  dbInstruments,
  caseId,
  onImportScores,
}) => {
  if (isJohnson) {
    return (
      <div className={styles.pane}>
        <h2>Test Results Summary</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '16px' }}>
          Johnson, Marcus D., CST Evaluation
        </p>

        <table className={styles.table}>
          <thead>
            <tr>
              <th>Instrument</th>
              <th>Status</th>
              <th>Validity</th>
              <th>Key Findings</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>MMPI-3</td>
              <td>Complete</td>
              <td className={styles.valid}>Valid</td>
              <td>Schizophrenia-consistent profile (THD=75T, RC6=72T, RC8=78T)</td>
            </tr>
            <tr>
              <td>PAI</td>
              <td>Complete</td>
              <td className={styles.valid}>Valid</td>
              <td>Elevated SCZ (72T) and PAR (68T)</td>
            </tr>
            <tr>
              <td>WAIS-V</td>
              <td>Complete</td>
              <td className={styles.valid}>Valid</td>
              <td>Low-average IQ (FSIQ=82), verbal weakness (VCI=78)</td>
            </tr>
            <tr className={styles.elevatedRow}>
              <td>TOMM</td>
              <td>Complete</td>
              <td className={styles.valid}>Valid Effort</td>
              <td>No malingering (Trial 2: 48/50, pass)</td>
            </tr>
            <tr>
              <td>SIRS-2</td>
              <td>Complete</td>
              <td className={styles.valid}>Honest</td>
              <td>All scales in honest range, no symptom fabrication</td>
            </tr>
          </tbody>
        </table>

        <h2 style={{ marginTop: '24px' }}>Interpretation</h2>
        <div className={styles.card}>
          <p>
            All test instruments converge on a diagnosis of <strong>Schizophrenia, First Episode, Currently in Acute Episode</strong>.
            Personality testing (MMPI-3, PAI) shows prominent thought disturbance and persecutory ideation. Cognitive testing (WAIS-V)
            shows low-average functioning with particular weakness in verbal comprehension. Validity and effort measures confirm genuine
            responding and adequate effort across all instruments.
          </p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className={styles.placeholder}>
        <p>Loading test results...</p>
      </div>
    )
  }

  // No data yet, show empty state with import prompt
  if (dbInstruments == null || dbInstruments.length === 0) {
    return (
      <div className={styles.placeholder}>
        <div>
          <p style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '8px' }}>
            No test results recorded yet
          </p>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Import scores from publisher PDFs or enter manually
          </p>
          {onImportScores && (
            <button
              onClick={() => onImportScores(caseId)}
              style={{
                padding: '6px 16px',
                background: 'var(--accent)',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '13px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontWeight: 500,
              }}
            >
              Import Scores
            </button>
          )}
        </div>
      </div>
    )
  }

  // Real data summary table
  return (
    <div className={styles.pane}>
      <h2>Test Results Summary</h2>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Instrument</th>
            <th>Administered</th>
            <th>Scales</th>
          </tr>
        </thead>
        <tbody>
          {dbInstruments.map((inst, idx) => (
            <tr key={idx}>
              <td>{inst.name}</td>
              <td>{inst.date}</td>
              <td>{inst.scores.reduce((sum, section) => sum + section.length, 0)} scales</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

interface InstrumentPaneProps {
  data: InstrumentData
}

const InstrumentPane: React.FC<InstrumentPaneProps> = ({ data }) => {
  return (
    <div className={styles.pane}>
      <h1>{data.name}</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '16px' }}>
        {data.abbrev} | Administered: {data.date}
      </p>

      {data.scores.map((section, sectionIdx) => {
        // Determine section title
        let sectionTitle = ''
        if (data.name === 'MMPI-3') {
          if (sectionIdx === 0) sectionTitle = 'Validity Scales'
          else if (sectionIdx === 1) sectionTitle = 'Higher-Order Scales'
          else if (sectionIdx === 2) sectionTitle = 'Restructured Clinical Scales (RC)'
        } else if (data.name === 'PAI') {
          if (sectionIdx === 0) sectionTitle = 'Validity Scales'
          else if (sectionIdx === 1) sectionTitle = 'Clinical Scales'
          else if (sectionIdx === 2) sectionTitle = 'Treatment Scales'
        } else if (data.name === 'WAIS-V') {
          if (sectionIdx === 0) sectionTitle = 'Composite Scores'
          else if (sectionIdx === 1) sectionTitle = 'Primary Subtests (Scaled Scores)'
        } else if (sectionIdx === 0 && section.length > 0) {
          // For DB-loaded instruments: first section is validity if it came from validity_scores_json
          sectionTitle = 'Validity Scales'
        } else if (sectionIdx === 1) {
          sectionTitle = 'Clinical Scales'
        }

        if (section.length === 0) return null

        return (
          <div key={sectionIdx}>
            {sectionTitle && <h2>{sectionTitle}</h2>}
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Scale</th>
                  {section[0].abbrev !== undefined && <th>Abbrev</th>}
                  {section[0].tScore !== undefined && <th>T-Score</th>}
                  {section[0].score !== undefined && <th>Score</th>}
                  <th>Interpretation</th>
                </tr>
              </thead>
              <tbody>
                {section.map((row, rowIdx) => (
                  <tr key={rowIdx} className={row.isElevated ? styles.elevatedRow : ''}>
                    <td>{row.scale}</td>
                    {section[0].abbrev !== undefined && <td>{row.abbrev ?? ''}</td>}
                    {section[0].tScore !== undefined && <td>{row.tScore ?? ''}</td>}
                    {section[0].score !== undefined && <td>{row.score ?? ''}</td>}
                    <td>{row.interpretation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })}

      {data.clinical && (
        <>
          <h2>Clinical Interpretation</h2>
          <div className={styles.card}>
            <p>{data.clinical}</p>
          </div>
        </>
      )}
    </div>
  )
}

export default TestResultsTab
