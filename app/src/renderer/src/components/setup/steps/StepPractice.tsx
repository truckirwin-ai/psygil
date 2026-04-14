/**
 * Step 4: Practice information.
 *
 * Collects clinician identity and optional practice metadata. None of this
 * is PHI; it is the practitioner's own professional identity used for
 * report letterheads, audit trail attribution, and template substitution.
 */

import { useState } from 'react'
import type { StepProps } from '../shared'
import { styles } from '../shared'
import type { PracticeInfo, Specialty } from '../../../../../shared/types/setup'

const SPECIALTIES: { value: Specialty; label: string }[] = [
  { value: 'forensic', label: 'Forensic Psychology' },
  { value: 'clinical', label: 'Clinical Psychology' },
  { value: 'neuro', label: 'Neuropsychology' },
  { value: 'school', label: 'School Psychology' },
  { value: 'other', label: 'Other' },
]

const US_STATES: readonly string[] = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
]

function blankPractice(): PracticeInfo {
  return {
    fullName: '',
    credentials: '',
    licenseNumber: '',
    licenseState: '',
    specialty: 'forensic',
    practiceName: null,
    npi: null,
    practiceAddress: null,
    phone: null,
    logoRelPath: null,
  }
}

export default function StepPractice({
  config,
  onConfigUpdate,
  onAdvance,
}: StepProps): React.JSX.Element {
  const [practice, setPractice] = useState<PracticeInfo>(
    config.practice ?? blankPractice(),
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const update = <K extends keyof PracticeInfo>(key: K, value: PracticeInfo[K]): void => {
    setPractice((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async (): Promise<void> => {
    setError(null)
    setSaving(true)
    try {
      const resp = await window.psygil.setup.savePractice({ practice })
      if (resp.status !== 'success') {
        setError(resp.message)
        setSaving(false)
        return
      }
      onConfigUpdate(resp.data.config)
      setSaving(false)
      onAdvance()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setSaving(false)
    }
  }

  const requiredOk =
    practice.fullName.trim().length > 0 &&
    practice.credentials.trim().length > 0 &&
    practice.licenseNumber.trim().length > 0 &&
    practice.licenseState.trim().length > 0

  return (
    <div>
      <h2 style={styles.heading}>Tell us about your practice</h2>
      <p style={styles.subheading}>
        This information appears on report headers and the audit trail.
        It is stored locally on this machine and is not patient information.
      </p>

      {error !== null && <div style={styles.errorBox}>{error}</div>}

      <div style={styles.fieldGrid2}>
        <div>
          <label style={styles.fieldLabel}>Full name *</label>
          <input
            style={styles.input}
            value={practice.fullName}
            onChange={(e) => update('fullName', e.target.value)}
            placeholder="Dr. Jordan Whitfield"
          />
        </div>
        <div>
          <label style={styles.fieldLabel}>Credentials *</label>
          <input
            style={styles.input}
            value={practice.credentials}
            onChange={(e) => update('credentials', e.target.value)}
            placeholder="Psy.D., ABPP"
          />
        </div>
      </div>

      <div style={styles.fieldGrid2}>
        <div>
          <label style={styles.fieldLabel}>License number *</label>
          <input
            style={styles.input}
            value={practice.licenseNumber}
            onChange={(e) => update('licenseNumber', e.target.value)}
            placeholder="PSY12345"
          />
        </div>
        <div>
          <label style={styles.fieldLabel}>License state *</label>
          <select
            style={styles.input}
            value={practice.licenseState}
            onChange={(e) => update('licenseState', e.target.value)}
          >
            <option value="">-- Select --</option>
            {US_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={styles.fieldGrid2}>
        <div>
          <label style={styles.fieldLabel}>Specialty *</label>
          <select
            style={styles.input}
            value={practice.specialty}
            onChange={(e) => update('specialty', e.target.value as Specialty)}
          >
            {SPECIALTIES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={styles.fieldLabel}>Practice name</label>
          <input
            style={styles.input}
            value={practice.practiceName ?? ''}
            onChange={(e) => update('practiceName', e.target.value === '' ? null : e.target.value)}
            placeholder="Forensic Psychology Services"
          />
        </div>
      </div>

      <div style={styles.fieldGrid2}>
        <div>
          <label style={styles.fieldLabel}>Practice address</label>
          <input
            style={styles.input}
            value={practice.practiceAddress ?? ''}
            onChange={(e) =>
              update('practiceAddress', e.target.value === '' ? null : e.target.value)
            }
            placeholder="1234 Main Street, Denver, CO 80202"
          />
        </div>
        <div>
          <label style={styles.fieldLabel}>Phone</label>
          <input
            style={styles.input}
            value={practice.phone ?? ''}
            onChange={(e) => update('phone', e.target.value === '' ? null : e.target.value)}
            placeholder="(303) 555-0100"
          />
        </div>
      </div>

      <div style={styles.fieldRow}>
        <label style={styles.fieldLabel}>NPI (optional)</label>
        <input
          style={styles.input}
          value={practice.npi ?? ''}
          onChange={(e) => update('npi', e.target.value === '' ? null : e.target.value)}
          placeholder="1234567890"
        />
      </div>

      <div style={styles.footerActions}>
        <button
          type="button"
          style={styles.primaryButton}
          onClick={handleSave}
          disabled={!requiredOk || saving}
        >
          {saving ? 'Saving...' : 'Save and continue'}
        </button>
      </div>
    </div>
  )
}
