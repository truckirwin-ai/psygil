import React, { useState } from 'react'
import styles from './EvidenceMapTab.module.css'

interface EvidenceMapTabProps {
  caseId: number
}

interface EvidenceRow {
  criterion: string
  mmpi3?: string
  pai?: string
  interview?: string
  medicalRecords?: string
  hospitalNotes?: string
}

interface DiagnosisEvidence {
  diagnosis: string
  status: 'primary' | 'secondary' | 'ruled_out'
  evidence: EvidenceRow[]
}

// Demo evidence map for Johnson case
const JOHNSON_EVIDENCE_MAP: DiagnosisEvidence[] = [
  {
    diagnosis: 'Schizophrenia (Primary Diagnosis)',
    status: 'primary',
    evidence: [
      {
        criterion: 'Auditory Hallucinations',
        mmpi3: 'RC8=78T',
        pai: 'SCZ=72T',
        interview: '✓ Endorsed',
        medicalRecords: '✓ Documented',
        hospitalNotes: '✓ Noted in 3 admissions',
      },
      {
        criterion: 'Persecutory Delusions',
        mmpi3: 'RC6=72T',
        pai: 'PAR=68T',
        interview: '✓ Endorsed',
        medicalRecords: '✓ Documented',
        hospitalNotes: '✓ Prominent in recent admission',
      },
      {
        criterion: 'Disorganized Thinking',
        mmpi3: 'THD=75T',
        pai: 'SCZ=72T',
        interview: '✓ Observed (tangential)',
        medicalRecords: '✓ Noted',
        hospitalNotes: '✓ Documented',
      },
      {
        criterion: 'Lack of Insight',
        interview: '✓ Absent insight into illness',
        medicalRecords: '✓ Noted',
        hospitalNotes: '✓ Prominent',
      },
      {
        criterion: 'Functional Impairment',
        mmpi3: 'EID=65T',
        pai: 'Multiple elevations',
        interview: '✓ Significant impairment',
        medicalRecords: '✓ Multiple hospitalizations',
        hospitalNotes: '✓ Cannot maintain stability',
      },
    ],
  },
  {
    diagnosis: 'Major Depressive Disorder (Ruled Out)',
    status: 'ruled_out',
    evidence: [
      {
        criterion: 'Depressed Mood',
        pai: 'DEP=60T (mild)',
        interview: 'Not primary complaint',
        medicalRecords: 'Minimal',
      },
      {
        criterion: 'Anhedonia',
        mmpi3: 'RC2=55T (mildly reduced)',
        interview: 'Not prominent',
        medicalRecords: 'Minimal',
      },
      {
        criterion: 'Guilt/Worthlessness',
        interview: 'Not endorsed',
        medicalRecords: 'Absent',
      },
      {
        criterion: 'Primary Presentation',
        interview: 'Psychotic symptoms predominate',
        medicalRecords: 'Depression secondary if present',
      },
    ],
  },
]

const EvidenceMapTab: React.FC<EvidenceMapTabProps> = ({ caseId }) => {
  const [expandedDiagnosis, setExpandedDiagnosis] = useState<string | null>(
    'Schizophrenia (Primary Diagnosis)'
  )

  const isJohnson = caseId === 1 || caseId === 0

  if (!isJohnson) {
    return (
      <div className={styles.placeholder}>
        <p>Evidence map will be generated after initial testing and interviews are complete.</p>
      </div>
    )
  }

  return (
    <div className={styles.evidenceMapTab}>
      <h1>Evidence Map, Diagnosis × Source</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '24px' }}>
        Visual convergence of test instruments, clinical interviews, and collateral records toward diagnostic impressions.
      </p>

      {JOHNSON_EVIDENCE_MAP.map((diagnosisGroup) => (
        <div key={diagnosisGroup.diagnosis} className={styles.diagnosisSection}>
          <div
            className={`${styles.diagnosisHeader} ${styles[diagnosisGroup.status]}`}
            onClick={() =>
              setExpandedDiagnosis(
                expandedDiagnosis === diagnosisGroup.diagnosis ? null : diagnosisGroup.diagnosis
              )
            }
          >
            <span className={styles.headerText}>
              {diagnosisGroup.status === 'primary' && '⊕ '}
              {diagnosisGroup.status === 'ruled_out' && '⊘ '}
              {diagnosisGroup.diagnosis}
            </span>
            <span className={styles.toggle}>
              {expandedDiagnosis === diagnosisGroup.diagnosis ? '▼' : '▶'}
            </span>
          </div>

          {expandedDiagnosis === diagnosisGroup.diagnosis && (
            <table className={styles.evidenceTable}>
              <thead>
                <tr>
                  <th>Criterion/Symptom</th>
                  <th>Test Instruments</th>
                  <th>Clinical Interview</th>
                  <th>Collateral Records</th>
                </tr>
              </thead>
              <tbody>
                {diagnosisGroup.evidence.map((row, idx) => (
                  <tr key={idx}>
                    <td className={styles.criterion}>{row.criterion}</td>
                    <td className={styles.testData}>
                      {row.mmpi3 && <div>{row.mmpi3}</div>}
                      {row.pai && <div>{row.pai}</div>}
                    </td>
                    <td>{row.interview || ','}</td>
                    <td className={styles.collateral}>
                      {row.medicalRecords && <div>{row.medicalRecords}</div>}
                      {row.hospitalNotes && <div>{row.hospitalNotes}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}

      {/* Coherence section */}
      <div className={styles.coherenceSection}>
        <h2>Cross-Test Coherence</h2>
        <div className={styles.coherenceCard}>
          <div className={styles.coherenceRow}>
            <span className={styles.coherenceLabel}>Test Pattern Consistency:</span>
            <span className={styles.coherenceValue}>
              MMPI-3 (THD=75T, RC6=72T, RC8=78T) ↔ PAI (SCZ=72T, PAR=68T), Both indicate schizophrenia spectrum
            </span>
          </div>
          <div className={styles.coherenceRow}>
            <span className={styles.coherenceLabel}>Clinical Interview Match:</span>
            <span className={styles.coherenceValue}>
              Endorsed auditory hallucinations and persecutory ideation align with elevated MMPI-3/PAI psychotic scales
            </span>
          </div>
          <div className={styles.coherenceRow}>
            <span className={styles.coherenceLabel}>Collateral Corroboration:</span>
            <span className={styles.coherenceValue}>
              Hospital records document 3 psychiatric admissions with psychotic presentations; jail medical notes confirm ongoing symptoms
            </span>
          </div>
          <div className={styles.coherenceRow}>
            <span className={styles.coherenceLabel}>Diagnostic Convergence:</span>
            <span className={styles.coherenceValue}>
              All evidence sources (psychological tests, clinical interview, medical records, hospital documentation) converge on Schizophrenia as primary diagnosis
            </span>
          </div>
          <div className={styles.coherenceRow}>
            <span className={styles.coherenceLabel}>Contradictions:</span>
            <span className={styles.coherenceValue}>
              No evidence contradicts the formulation. Alternative diagnoses adequately ruled out.
            </span>
          </div>
        </div>
      </div>

      {/* Confidence summary */}
      <div className={styles.confidenceSection}>
        <h2>Diagnostic Confidence Summary</h2>
        <div className={styles.confidenceGrid}>
          <div className={styles.confidenceCard}>
            <div className={styles.confidenceMetric}>
              <span className={styles.metricLabel}>Test Evidence Strength</span>
              <span className={styles.metricValue}>Very High</span>
              <div className={styles.confidenceBar}>
                <div className={styles.fill} style={{ width: '95%' }}></div>
              </div>
            </div>
          </div>
          <div className={styles.confidenceCard}>
            <div className={styles.confidenceMetric}>
              <span className={styles.metricLabel}>Clinical Consistency</span>
              <span className={styles.metricValue}>Very High</span>
              <div className={styles.confidenceBar}>
                <div className={styles.fill} style={{ width: '90%' }}></div>
              </div>
            </div>
          </div>
          <div className={styles.confidenceCard}>
            <div className={styles.confidenceMetric}>
              <span className={styles.metricLabel}>Collateral Corroboration</span>
              <span className={styles.metricValue}>Excellent</span>
              <div className={styles.confidenceBar}>
                <div className={styles.fill} style={{ width: '92%' }}></div>
              </div>
            </div>
          </div>
          <div className={styles.confidenceCard}>
            <div className={styles.confidenceMetric}>
              <span className={styles.metricLabel}>Overall Diagnostic Confidence</span>
              <span className={styles.metricValue}>Very High</span>
              <div className={styles.confidenceBar}>
                <div className={styles.fill} style={{ width: '94%' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EvidenceMapTab
