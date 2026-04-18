/**
 * Step 7: Clinical configuration + template provisioning.
 *
 * Selects which evaluation types this clinician performs and which test
 * instruments they use. After saving, automatically calls
 * window.psygil.setup.provisionTemplates() to write the matching report
 * templates into {project_root}/templates/, with practice info already
 * substituted.
 */

import { useEffect, useState } from 'react'
import type { StepProps } from '../shared'
import { styles } from '../shared'
import type {
  ClinicalConfig,
  ProvisionTemplateResult,
  Specialty,
  WorkspaceSeedSummary,
} from '../../../../../shared/types/setup'
import { useLocale } from '../../../i18n/useLocale'

const INSTRUMENT_CATEGORIES: { name: string; instruments: string[] }[] = [
  { name: 'Personality / Psychopathology', instruments: ['MMPI-3', 'PAI', 'MCMI-IV'] },
  { name: 'Cognitive / Intelligence', instruments: ['WAIS-V', 'WMS-IV', 'WISC-V'] },
  { name: 'Neuropsychological', instruments: ['RBANS', 'D-KEFS', 'Trail Making', 'Wisconsin Card Sort'] },
  { name: 'Validity / Effort', instruments: ['TOMM', 'SIRS-2', 'M-FAST', 'VSVT'] },
  { name: 'Forensic-Specific', instruments: ['HCR-20v3', 'PCL-R', 'SAVRY', 'Static-99R'] },
  { name: 'Attention / Executive', instruments: ['CAARS', 'CPT-3', 'Conners-4'] },
  { name: 'Trauma', instruments: ['CAPS-5', 'PCL-5', 'TSI-2'] },
  { name: 'Adaptive', instruments: ['Vineland-3', 'ABAS-3'] },
]

const SPECIALTY_DEFAULTS: Record<Specialty, { evalTypes: string[]; instruments: string[] }> = {
  forensic: {
    evalTypes: ['CST', 'Risk Assessment', 'Fitness for Duty', 'Malingering'],
    instruments: ['MMPI-3', 'PAI', 'TOMM', 'SIRS-2', 'HCR-20v3', 'PCL-R'],
  },
  clinical: {
    evalTypes: ['PTSD Dx', 'ADHD Dx'],
    instruments: ['MMPI-3', 'PAI', 'CAPS-5', 'PCL-5', 'CAARS'],
  },
  neuro: {
    evalTypes: ['ADHD Dx'],
    instruments: ['WAIS-V', 'WMS-IV', 'RBANS', 'D-KEFS', 'TOMM'],
  },
  school: {
    evalTypes: ['ADHD Dx'],
    instruments: ['WISC-V', 'CAARS', 'Conners-4', 'Vineland-3'],
  },
  other: { evalTypes: [], instruments: [] },
}

export default function StepClinical({
  config,
  onConfigUpdate,
  onAdvance,
}: StepProps): React.JSX.Element {
  const { strings } = useLocale()
  const specialty = config.practice?.specialty ?? 'forensic'
  const [supportedEvalTypes, setSupportedEvalTypes] = useState<readonly string[]>([])
  const [evalTypes, setEvalTypes] = useState<string[]>(
    config.clinical?.evalTypes !== undefined
      ? [...config.clinical.evalTypes]
      : SPECIALTY_DEFAULTS[specialty].evalTypes,
  )
  const [instruments, setInstruments] = useState<string[]>(
    config.clinical?.instruments !== undefined
      ? [...config.clinical.instruments]
      : SPECIALTY_DEFAULTS[specialty].instruments,
  )
  const [provisioningResults, setProvisioningResults] =
    useState<readonly ProvisionTemplateResult[] | null>(null)
  const [workspaceSummary, setWorkspaceSummary] =
    useState<WorkspaceSeedSummary | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const resp = await window.psygil.setup.getSupportedEvalTypes()
      if (cancelled) return
      if (resp.status === 'success') {
        setSupportedEvalTypes(resp.data.evalTypes)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const toggle = (list: string[], value: string): string[] =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value]

  const handleSave = async (): Promise<void> => {
    setError(null)
    setSaving(true)
    try {
      const clinical: ClinicalConfig = { evalTypes, instruments }
      const saveResp = await window.psygil.setup.saveClinical({ clinical })
      if (saveResp.status !== 'success') {
        setError(saveResp.message)
        setSaving(false)
        return
      }
      onConfigUpdate(saveResp.data.config)

      // Provision templates immediately so the user sees what was created
      const provResp = await window.psygil.setup.provisionTemplates({ overwrite: false })
      if (provResp.status !== 'success') {
        setError(`Templates not provisioned: ${provResp.message}`)
        setSaving(false)
        return
      }
      setProvisioningResults(provResp.data.results)
      setWorkspaceSummary(provResp.data.workspaceSummary)
      setSaving(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setSaving(false)
    }
  }

  return (
    <div>
      <h2 style={styles.heading}>{strings.clinical.title}</h2>
      <p style={styles.subheading}>
        {strings.clinical.subtitle}
      </p>

      {error !== null && <div style={styles.errorBox}>{error}</div>}

      <div style={styles.fieldRow}>
        <label style={styles.fieldLabel}>Evaluation types</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {supportedEvalTypes.map((et) => (
            <label
              key={et}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: 8,
                border: '1px solid var(--border)',
                borderRadius: 4,
                background: evalTypes.includes(et) ? 'var(--highlight)' : 'var(--bg)',
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              <input
                type="checkbox"
                checked={evalTypes.includes(et)}
                onChange={() => setEvalTypes(toggle(evalTypes, et))}
              />
              {et}
            </label>
          ))}
        </div>
      </div>

      <div style={styles.fieldRow}>
        <label style={styles.fieldLabel}>Instrument library</label>
        {INSTRUMENT_CATEGORIES.map((cat) => (
          <div key={cat.name} style={{ marginBottom: 12 }}>
            <div
              style={{
                fontSize: 11,
                color: 'var(--text-secondary)',
                marginBottom: 4,
                textTransform: 'uppercase',
                letterSpacing: 0.4,
              }}
            >
              {cat.name}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {cat.instruments.map((inst) => {
                const selected = instruments.includes(inst)
                return (
                  <button
                    key={inst}
                    type="button"
                    onClick={() => setInstruments(toggle(instruments, inst))}
                    style={{
                      padding: '4px 10px',
                      fontSize: 12,
                      border: '1px solid var(--border)',
                      borderRadius: 12,
                      background: selected ? 'var(--accent)' : 'var(--bg)',
                      color: selected ? '#fff' : 'var(--text)',
                      cursor: 'pointer',
                    }}
                  >
                    {inst}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {provisioningResults !== null && (
        <div style={styles.successBox}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>
            Templates provisioned ({provisioningResults.length})
          </div>
          {provisioningResults.map((r) => (
            <div key={r.id} style={{ fontSize: 12 }}>
              {r.skipped ? '○' : '✓'} {r.evalType}: {r.id}.docx
              {r.skipped && r.skipReason !== null && ` (${r.skipReason})`}
            </div>
          ))}
          {workspaceSummary !== null && (
            <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(34, 197, 94, 0.3)' }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>
                Workspace content seeded ({workspaceSummary.written} files)
              </div>
              <div style={{ fontSize: 12 }}>
                ✓ Writing Samples: {workspaceSummary.byCategory['writing-samples'] ?? 0}
              </div>
              <div style={{ fontSize: 12 }}>
                ✓ Documents: {workspaceSummary.byCategory['documents'] ?? 0}
              </div>
              <div style={{ fontSize: 12 }}>
                ✓ Testing guides: {workspaceSummary.byCategory['testing'] ?? 0}
              </div>
              <div style={{ fontSize: 12 }}>
                ✓ Forms: {workspaceSummary.byCategory['forms'] ?? 0}
              </div>
              {workspaceSummary.skipped > 0 && (
                <div style={{ fontSize: 11, marginTop: 4, color: 'var(--text-secondary)' }}>
                  {workspaceSummary.skipped} already existed and were not overwritten
                </div>
              )}
              {workspaceSummary.failed > 0 && (
                <div style={{ fontSize: 11, marginTop: 4, color: 'var(--warn)' }}>
                  {workspaceSummary.failed} failed to write (see main console)
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div style={styles.footerActions}>
        {provisioningResults === null ? (
          <button
            type="button"
            style={styles.primaryButton}
            onClick={handleSave}
            disabled={saving || evalTypes.length === 0}
          >
            {saving ? 'Saving...' : 'Save and provision templates'}
          </button>
        ) : (
          <button type="button" style={styles.primaryButton} onClick={onAdvance}>
            Continue
          </button>
        )}
      </div>
    </div>
  )
}
