import { useState, useEffect, useCallback } from 'react'
import type { OnboardingSection, CaseRow } from '../../../../shared/types/ipc'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface OnboardingModalProps {
  readonly isOpen: boolean
  readonly onClose: () => void
  readonly caseId?: number
  readonly onSaved?: () => void
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Mode = 'self-report' | 'clinician'

// Map display tab keys to OnboardingSection values
type TabKey = OnboardingSection
// 'contact' | 'complaints' | 'family' | 'education' | 'health' | 'mental' | 'substance' | 'legal' | 'recent'

interface FieldDef {
  readonly key: string
  readonly label: string
  readonly placeholder?: string
  readonly rows: number
  readonly hint?: string
}

interface TabDef {
  readonly key: TabKey
  readonly label: string
  readonly note?: string
  readonly fields: readonly FieldDef[]
}

// ---------------------------------------------------------------------------
// Tab / field definitions (v4 spec)
// ---------------------------------------------------------------------------

const TABS: readonly TabDef[] = [
  {
    key: 'contact',
    label: 'Contact',
    note: 'Name, date of birth, age, and gender are carried over from intake and shown below.',
    fields: [
      {
        key: 'marital_status',
        label: 'Marital / Relationship Status',
        placeholder: 'Describe current marital or relationship status...',
        rows: 1,
      },
      {
        key: 'dependents',
        label: 'Dependents / Children',
        placeholder: 'Names and ages of children or other dependents...',
        rows: 2,
      },
      {
        key: 'living_situation',
        label: 'Current Living Situation',
        placeholder: 'Who do you live with? House, apartment, shelter, other?',
        rows: 2,
      },
      {
        key: 'primary_language',
        label: 'Primary Language',
        placeholder: 'Primary language spoken at home...',
        rows: 1,
      },
    ],
  },
  {
    key: 'complaints',
    label: 'Complaints',
    note: 'Narrative responses only, no checklists. Reduces over-reporting bias.',
    fields: [
      {
        key: 'primary_complaint',
        label: 'Primary Complaint, Describe in Detail',
        placeholder: 'Describe the primary concern in your own words...',
        rows: 4,
      },
      {
        key: 'secondary_concerns',
        label: 'Secondary Concerns',
        placeholder: 'Any other concerns or symptoms you want to mention...',
        rows: 3,
      },
      {
        key: 'onset_timeline',
        label: 'Onset & Timeline',
        placeholder: 'When did this begin? How has it changed over time?',
        rows: 2,
      },
    ],
  },
  {
    key: 'family',
    label: 'Family',
    fields: [
      {
        key: 'family_of_origin',
        label: 'Family of Origin',
        placeholder: 'Describe your upbringing, parents, siblings, household growing up...',
        rows: 3,
      },
      {
        key: 'family_mental_health',
        label: 'Family Mental Health History',
        placeholder: 'Any known mental health diagnoses or concerns in family members?',
        rows: 3,
      },
      {
        key: 'family_medical_history',
        label: 'Family Medical History',
        placeholder: 'Significant medical conditions in immediate or extended family...',
        rows: 2,
      },
      {
        key: 'current_family_relationships',
        label: 'Current Family Relationships',
        placeholder: 'Describe your current relationships with family members...',
        rows: 2,
      },
    ],
  },
  {
    key: 'education',
    label: 'Education & Work',
    fields: [
      {
        key: 'highest_education',
        label: 'Highest Level of Education',
        placeholder: "e.g. High school diploma, GED, some college, bachelor's degree...",
        rows: 1,
      },
      {
        key: 'schools_attended',
        label: 'Schools Attended',
        placeholder: 'List schools attended and approximate years...',
        rows: 1,
      },
      {
        key: 'academic_experience',
        label: 'Academic Experience',
        placeholder: 'Describe your overall experience in school, strengths, struggles, notable events...',
        rows: 2,
      },
      {
        key: 'employment_status',
        label: 'Current Employment Status',
        placeholder: 'Employed, unemployed, disabled, retired, student...',
        rows: 1,
      },
      {
        key: 'current_employer',
        label: 'Current / Most Recent Employer & Role',
        placeholder: 'Employer name and your role or job title...',
        rows: 1,
      },
      {
        key: 'work_history',
        label: 'Work History Summary',
        placeholder: 'Summarize your work history, including gaps or significant changes...',
        rows: 3,
      },
      {
        key: 'military_service',
        label: 'Military Service',
        placeholder: 'Branch, dates of service, rank, discharge status. Write N/A if none.',
        rows: 2,
        hint: 'Write N/A if none',
      },
    ],
  },
  {
    key: 'health',
    label: 'Health',
    fields: [
      {
        key: 'medical_conditions',
        label: 'Current Medical Conditions',
        placeholder: 'List any active medical diagnoses or ongoing health concerns...',
        rows: 2,
      },
      {
        key: 'current_medications',
        label: 'Current Medications',
        placeholder: 'Medication name, dosage, prescriber, and purpose for each...',
        rows: 2,
      },
      {
        key: 'surgeries_hospitalizations',
        label: 'Surgeries & Hospitalizations',
        placeholder: 'Any past surgeries, hospitalizations, or significant medical procedures...',
        rows: 2,
      },
      {
        key: 'head_injuries',
        label: 'Head Injuries / Traumatic Brain Injury',
        placeholder: 'Any history of head injuries, concussions, or TBI...',
        rows: 2,
      },
      {
        key: 'sleep_quality',
        label: 'Sleep Quality & Disturbance',
        placeholder: 'Describe your typical sleep patterns and any difficulties...',
        rows: 1,
      },
      {
        key: 'appetite_weight',
        label: 'Appetite & Weight Changes',
        placeholder: 'Any recent changes in appetite or significant weight gain/loss?',
        rows: 1,
      },
    ],
  },
  {
    key: 'mental',
    label: 'Mental Health',
    fields: [
      {
        key: 'previous_treatment',
        label: 'Previous Mental Health Treatment',
        placeholder: 'Describe any past therapy, counseling, or psychiatric care...',
        rows: 3,
      },
      {
        key: 'previous_diagnoses',
        label: 'Previous Diagnoses',
        placeholder: 'Any mental health diagnoses you have received in the past...',
        rows: 2,
      },
      {
        key: 'psych_medications',
        label: 'Psychiatric Medications Past & Present',
        placeholder: 'List psychiatric medications you have taken, including current ones...',
        rows: 2,
      },
      {
        key: 'self_harm_history',
        label: 'History of Self-Harm or Suicidal Thoughts',
        placeholder: 'Any history of self-harm, suicidal thoughts, or attempts...',
        rows: 2,
      },
      {
        key: 'violence_history',
        label: 'History of Violence or Harm to Others',
        placeholder: 'Any history of violent behavior or causing harm to others...',
        rows: 2,
      },
    ],
  },
  {
    key: 'substance',
    label: 'Substance Use',
    fields: [
      {
        key: 'alcohol_use',
        label: 'Alcohol Use',
        placeholder: 'Describe your alcohol use, frequency, amount, patterns, impact...',
        rows: 2,
      },
      {
        key: 'drug_use',
        label: 'Drug / Substance Use',
        placeholder: 'Describe any use of illicit drugs, marijuana, or misuse of prescriptions...',
        rows: 3,
      },
      {
        key: 'substance_treatment',
        label: 'Treatment for Substance Use',
        placeholder: 'Any past or current treatment programs for substance use...',
        rows: 2,
      },
    ],
  },
  {
    key: 'legal',
    label: 'Legal',
    fields: [
      {
        key: 'arrests_convictions',
        label: 'Prior Arrests & Convictions',
        placeholder: 'List prior arrests and convictions, including dates and outcomes...',
        rows: 3,
      },
      {
        key: 'incarceration_history',
        label: 'Incarceration History',
        placeholder: 'Any periods of incarceration, facility, dates, reason...',
        rows: 2,
      },
      {
        key: 'probation_parole',
        label: 'Probation / Parole',
        placeholder: 'Current or past probation or parole status and conditions...',
        rows: 2,
      },
      {
        key: 'protective_orders',
        label: 'Protective Orders / Restraining Orders',
        placeholder: 'Any active or prior protective or restraining orders...',
        rows: 2,
      },
    ],
  },
  {
    key: 'recent',
    label: 'Recent Events',
    fields: [
      {
        key: 'events_circumstances',
        label: 'Describe the Events or Circumstances',
        placeholder: 'Describe what happened leading up to this evaluation...',
        rows: 5,
      },
      {
        key: 'current_stressors',
        label: 'Current Stressors',
        placeholder: 'What is causing stress in your life right now?',
        rows: 2,
      },
      {
        key: 'goals_evaluation',
        label: 'Goals for This Evaluation',
        placeholder: 'What do you hope to get out of this evaluation?',
        rows: 2,
      },
    ],
  },
]

// ---------------------------------------------------------------------------
// Form state helpers
// ---------------------------------------------------------------------------

type SectionData = Record<string, string>
type FormState = Record<TabKey, SectionData>

function buildEmptyForm(): FormState {
  const state: Partial<FormState> = {}
  for (const tab of TABS) {
    const sectionData: Record<string, string> = { clinician_notes: '' }
    for (const field of tab.fields) {
      sectionData[field.key] = ''
    }
    state[tab.key] = sectionData
  }
  return state as FormState
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function OnboardingModal({
  isOpen,
  onClose,
  caseId,
  onSaved,
}: OnboardingModalProps): React.JSX.Element | null {
  const [activeTab, setActiveTab] = useState<TabKey>('contact')
  const [mode, setMode] = useState<Mode>('self-report')
  const [form, setForm] = useState<FormState>(buildEmptyForm)
  const [caseData, setCaseData] = useState<CaseRow | null>(null)
  const [saving, setSaving] = useState(false)

  // Reset + load when modal opens
  useEffect(() => {
    if (!isOpen) return
    setForm(buildEmptyForm())
    setActiveTab('contact')
    setMode('self-report')
    setCaseData(null)

    if (caseId == null) return

    // Load case meta for contact read-only display
    void window.psygil.cases.get({ case_id: caseId }).then((res) => {
      if (res.status === 'success') setCaseData(res.data)
    })

    // Load existing onboarding data
    void window.psygil.onboarding.get({ case_id: caseId }).then((res) => {
      if (res.status !== 'success') return
      setForm((prev) => {
        const next = { ...prev }
        for (const row of res.data) {
          const tab = TABS.find((t) => t.key === row.section)
          if (!tab) continue
          let content: Record<string, string> = {}
          try {
            content = JSON.parse(row.content) as Record<string, string>
          } catch {
            // non-JSON legacy: treat as primary field
            const firstField = tab.fields[0]?.key ?? 'content'
            content = { [firstField]: row.content }
          }
          next[row.section] = {
            ...prev[row.section],
            ...content,
            clinician_notes: row.clinician_notes ?? '',
          }
        }
        return next
      })
    })
  }, [isOpen, caseId])

  // Escape to close
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  const updateField = useCallback((section: TabKey, field: string, value: string) => {
    setForm((prev) => ({
      ...prev,
      [section]: { ...prev[section], [field]: value },
    }))
  }, [])

  const saveSection = useCallback(
    async (section: TabKey, status: 'draft' | 'complete'): Promise<void> => {
      if (caseId == null) return
      const sectionData = form[section]
      const { clinician_notes, ...fieldValues } = sectionData
      await window.psygil.onboarding.save({
        case_id: caseId,
        section,
        data: {
          content: JSON.stringify(fieldValues),
          clinician_notes: clinician_notes || undefined,
          status,
        },
      })
    },
    [caseId, form],
  )

  const handleSaveDraft = useCallback(async (): Promise<void> => {
    setSaving(true)
    try {
      await saveSection(activeTab, 'draft')
    } finally {
      setSaving(false)
    }
  }, [activeTab, saveSection])

  const handleSaveAndContinue = useCallback(async (): Promise<void> => {
    setSaving(true)
    try {
      const idx = TABS.findIndex((t) => t.key === activeTab)
      const isLast = idx === TABS.length - 1
      await saveSection(activeTab, isLast ? 'complete' : 'draft')
      if (isLast) {
        onSaved?.()
        onClose()
      } else {
        setActiveTab(TABS[idx + 1].key)
      }
    } finally {
      setSaving(false)
    }
  }, [activeTab, saveSection, onClose, onSaved])

  if (!isOpen) return null

  const currentTabIdx = TABS.findIndex((t) => t.key === activeTab)
  const currentTab = TABS[currentTabIdx]
  const isLastTab = currentTabIdx === TABS.length - 1
  const isClinician = mode === 'clinician'

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={containerStyle} onClick={(e) => e.stopPropagation()}>

        {/* ── HEADER ── */}
        <div style={headerStyle}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>
              Patient Onboarding, Biopsychosocial History
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              Self-report or referral-report form. All fields are narrative text entry.
            </div>
          </div>
          <button onClick={onClose} style={closeButtonStyle} aria-label="Close">
            &times;
          </button>
        </div>

        {/* ── DATA FIDELITY NOTE ── */}
        <div style={fidelityBoxStyle}>
          <span style={{ fontWeight: 600, color: 'var(--accent)' }}>Data Fidelity Protocol: </span>
          Patient-reported information will be cleaned for grammar and spelling, then translated to
          clinical language for the case overview. Every reported element is preserved, nothing is
          omitted. The clinician verifies and annotates during the initial interview.
        </div>

        {/* ── MODE TOGGLE + TAB BAR ── */}
        <div style={tabBarContainerStyle}>
          {/* Mode toggle */}
          <div style={{ display: 'flex', gap: 2, marginRight: 20, flexShrink: 0 }}>
            <ModeButton
              label="Patient Self-Report"
              active={mode === 'self-report'}
              onClick={() => setMode('self-report')}
            />
            <ModeButton
              label="Clinician Interview Review"
              active={mode === 'clinician'}
              onClick={() => setMode('clinician')}
            />
          </div>

          {/* Tab strip */}
          <div style={{ display: 'flex', overflow: 'auto', gap: 0 }}>
            {TABS.map((tab, idx) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={tab.key === activeTab ? activeTabStyle : inactiveTabStyle}
              >
                {idx + 1}. {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── TAB CONTENT ── */}
        <div style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Section header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={sectionTitleStyle}>{currentTab.label.toUpperCase()}</span>
            <span style={isClinician ? underReviewBadgeStyle : patientBadgeStyle}>
              {isClinician ? 'Under Review' : 'Patient-Reported'}
            </span>
          </div>

          {/* Optional section note */}
          {currentTab.note != null && (
            <div style={sectionNoteStyle}>{currentTab.note}</div>
          )}

          {/* Contact tab: read-only intake fields */}
          {currentTab.key === 'contact' && (
            <div style={readOnlyGroupStyle}>
              <div style={readOnlyRowStyle}>
                <span style={readOnlyLabelStyle}>Name</span>
                <span style={readOnlyValueStyle}>
                  {caseData
                    ? `${caseData.examinee_first_name} ${caseData.examinee_last_name}`
                    : ','}
                </span>
              </div>
              <div style={readOnlyRowStyle}>
                <span style={readOnlyLabelStyle}>Date of Birth</span>
                <span style={readOnlyValueStyle}>{caseData?.examinee_dob ?? ','}</span>
              </div>
              <div style={readOnlyRowStyle}>
                <span style={readOnlyLabelStyle}>Age</span>
                <span style={readOnlyValueStyle}>
                  {caseData?.examinee_dob != null
                    ? calcAge(caseData.examinee_dob)
                    : ','}
                </span>
              </div>
              <div style={readOnlyRowStyle}>
                <span style={readOnlyLabelStyle}>Gender</span>
                <span style={readOnlyValueStyle}>{caseData?.examinee_gender ?? ','}</span>
              </div>
            </div>
          )}

          {/* Section fields */}
          {currentTab.fields.map((field) => (
            <FieldRow
              key={field.key}
              field={field}
              value={form[activeTab][field.key] ?? ''}
              onChange={(val) => updateField(activeTab, field.key, val)}
            />
          ))}

          {/* Clinician verification notes (only in clinician mode) */}
          {isClinician && (
            <div style={clinicianBoxStyle}>
              <label style={{ ...labelStyle, color: 'var(--accent)', display: 'block', marginBottom: 6 }}>
                Clinician Verification Notes
              </label>
              <textarea
                style={{ ...textareaStyle, minHeight: 72 }}
                rows={3}
                value={form[activeTab].clinician_notes ?? ''}
                onChange={(e) => updateField(activeTab, 'clinician_notes', e.target.value)}
                placeholder="Clinical observations, discrepancies, follow-up items..."
              />
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 4 }}>
            <button
              onClick={() => void handleSaveDraft()}
              style={secondaryButtonStyle}
              disabled={saving}
            >
              Save Draft
            </button>
            <button
              onClick={() => void handleSaveAndContinue()}
              style={primaryButtonStyle}
              disabled={saving}
            >
              {isLastTab ? 'Complete Onboarding ✓' : 'Save & Continue →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// FieldRow
// ---------------------------------------------------------------------------

function FieldRow({
  field,
  value,
  onChange,
}: {
  readonly field: FieldDef
  readonly value: string
  readonly onChange: (val: string) => void
}): React.JSX.Element {
  const isMultiline = field.rows > 1

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={labelStyle}>
        {field.label}
        {field.hint != null && (
          <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--text-secondary)', fontWeight: 400, letterSpacing: 0 }}>
            ({field.hint})
          </span>
        )}
      </label>
      {isMultiline ? (
        <textarea
          style={textareaStyle}
          rows={field.rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
        />
      ) : (
        <input
          type="text"
          style={inputStyle}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ModeButton
// ---------------------------------------------------------------------------

function ModeButton({
  label,
  active,
  onClick,
}: {
  readonly label: string
  readonly active: boolean
  readonly onClick: () => void
}): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? 'var(--accent)' : 'var(--panel)',
        color: active ? '#ffffff' : 'var(--text-secondary)',
        border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
        borderRadius: 4,
        padding: '4px 12px',
        fontSize: 11,
        fontWeight: 500,
        cursor: 'pointer',
        fontFamily: 'inherit',
        whiteSpace: 'nowrap',
        transition: 'background 0.15s, color 0.15s',
      }}
    >
      {label}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function calcAge(dob: string): string {
  const birth = new Date(dob)
  if (isNaN(birth.getTime())) return ','
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const m = now.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--
  return String(age)
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.55)',
  zIndex: 9999,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const containerStyle: React.CSSProperties = {
  background: 'var(--panel)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  maxWidth: 860,
  width: '92%',
  maxHeight: 'calc(100vh - 64px)',
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
}

const headerStyle: React.CSSProperties = {
  position: 'sticky',
  top: 0,
  background: 'var(--panel)',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  padding: '14px 24px 12px',
  borderBottom: '1px solid var(--border)',
  zIndex: 2,
}

const closeButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  fontSize: 20,
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  padding: '0 0 0 12px',
  lineHeight: 1,
  flexShrink: 0,
}

const fidelityBoxStyle: React.CSSProperties = {
  margin: '0 24px',
  marginTop: 14,
  padding: '8px 12px',
  borderLeft: '3px solid var(--accent)',
  background: 'var(--bg)',
  borderRadius: '0 4px 4px 0',
  fontSize: 11.5,
  color: 'var(--text-secondary)',
  lineHeight: 1.55,
}

const tabBarContainerStyle: React.CSSProperties = {
  position: 'sticky',
  top: 57,
  background: 'var(--panel)',
  display: 'flex',
  alignItems: 'center',
  padding: '10px 24px 0',
  borderBottom: '1px solid var(--border)',
  zIndex: 2,
  flexWrap: 'wrap',
  gap: 8,
  marginTop: 12,
}

const activeTabStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  borderBottom: '2px solid var(--accent)',
  color: 'var(--accent)',
  fontSize: 11,
  fontWeight: 600,
  padding: '6px 10px',
  cursor: 'pointer',
  fontFamily: 'inherit',
  whiteSpace: 'nowrap',
  letterSpacing: 0.2,
}

const inactiveTabStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  borderBottom: '2px solid transparent',
  color: 'var(--text-secondary)',
  fontSize: 11,
  fontWeight: 500,
  padding: '6px 10px',
  cursor: 'pointer',
  fontFamily: 'inherit',
  whiteSpace: 'nowrap',
  letterSpacing: 0.2,
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--accent)',
  letterSpacing: 0.8,
  textTransform: 'uppercase',
}

const patientBadgeStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  background: '#fff3cd',
  color: '#856404',
  padding: '2px 8px',
  borderRadius: 4,
  letterSpacing: 0.3,
}

const underReviewBadgeStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  background: '#fff3cd',
  color: '#856404',
  padding: '2px 8px',
  borderRadius: 4,
  letterSpacing: 0.3,
}

const sectionNoteStyle: React.CSSProperties = {
  fontSize: 11.5,
  color: 'var(--text-secondary)',
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  padding: '6px 10px',
  lineHeight: 1.5,
}

const readOnlyGroupStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gap: '6px 24px',
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  padding: '10px 14px',
}

const readOnlyRowStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
}

const readOnlyLabelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 500,
  color: 'var(--text-secondary)',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
}

const readOnlyValueStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--text)',
}

const clinicianBoxStyle: React.CSSProperties = {
  borderLeft: '3px solid var(--accent)',
  background: 'var(--panel)',
  padding: '8px 12px',
  borderRadius: '0 4px 4px 0',
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  color: 'var(--text-secondary)',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
}

const textareaStyle: React.CSSProperties = {
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  padding: '7px 10px',
  fontSize: 13,
  color: 'var(--text)',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  resize: 'vertical',
  lineHeight: 1.5,
}

const inputStyle: React.CSSProperties = {
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  padding: '7px 10px',
  fontSize: 13,
  color: 'var(--text)',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
}

const primaryButtonStyle: React.CSSProperties = {
  background: 'var(--accent)',
  color: '#ffffff',
  border: 'none',
  borderRadius: 4,
  padding: '8px 22px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const secondaryButtonStyle: React.CSSProperties = {
  background: 'var(--panel)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  padding: '8px 22px',
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
  fontFamily: 'inherit',
}
