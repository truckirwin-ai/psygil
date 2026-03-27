import { useState, useEffect, useCallback } from 'react'

interface OnboardingModalProps {
  readonly isOpen: boolean
  readonly onClose: () => void
  readonly caseId?: number
}

type TabKey =
  | 'contact'
  | 'complaints'
  | 'family'
  | 'education'
  | 'health'
  | 'mentalHealth'
  | 'substanceUse'
  | 'legal'
  | 'recentEvents'

type Mode = 'self-report' | 'clinician'

interface TabDef {
  readonly key: TabKey
  readonly label: string
  readonly fields: readonly FieldDef[]
}

interface FieldDef {
  readonly key: string
  readonly label: string
  readonly placeholder: string
}

const TABS: readonly TabDef[] = [
  {
    key: 'contact',
    label: 'Contact',
    fields: [
      { key: 'address', label: 'Address & Phone', placeholder: 'Current address, phone numbers, email...' },
      { key: 'emergency', label: 'Emergency Contact', placeholder: 'Name, relationship, phone...' },
      { key: 'insurance', label: 'Insurance Information', placeholder: 'Provider, policy number, group...' },
    ],
  },
  {
    key: 'complaints',
    label: 'Complaints',
    fields: [
      { key: 'primary', label: 'Primary Complaint', placeholder: 'Describe the primary concern in your own words...' },
      { key: 'history', label: 'History of Present Concern', placeholder: 'When did this begin? How has it progressed?' },
      { key: 'impact', label: 'Daily Impact', placeholder: 'How does this affect daily life, work, relationships?' },
    ],
  },
  {
    key: 'family',
    label: 'Family',
    fields: [
      { key: 'structure', label: 'Family Structure', placeholder: 'Household members, marital status, children...' },
      { key: 'history', label: 'Family History', placeholder: 'Family mental health history, significant events...' },
      { key: 'relationships', label: 'Key Relationships', placeholder: 'Quality of current family relationships...' },
    ],
  },
  {
    key: 'education',
    label: 'Education',
    fields: [
      { key: 'level', label: 'Educational Background', placeholder: 'Highest level completed, schools attended...' },
      { key: 'employment', label: 'Employment History', placeholder: 'Current and past employment, job performance...' },
    ],
  },
  {
    key: 'health',
    label: 'Health',
    fields: [
      { key: 'current', label: 'Current Health Conditions', placeholder: 'Active medical diagnoses, medications...' },
      { key: 'history', label: 'Medical History', placeholder: 'Past surgeries, hospitalizations, chronic conditions...' },
      { key: 'medications', label: 'Current Medications', placeholder: 'Medication name, dosage, prescriber, purpose...' },
    ],
  },
  {
    key: 'mentalHealth',
    label: 'Mental Health',
    fields: [
      { key: 'current', label: 'Current Mental Health', placeholder: 'Current symptoms, mood, sleep, appetite...' },
      { key: 'history', label: 'Treatment History', placeholder: 'Past therapy, hospitalizations, medications...' },
      { key: 'selfHarm', label: 'Self-Harm & Safety', placeholder: 'History of self-harm, suicidal ideation, safety concerns...' },
    ],
  },
  {
    key: 'substanceUse',
    label: 'Substance Use',
    fields: [
      { key: 'current', label: 'Current Use', placeholder: 'Substances used, frequency, amount...' },
      { key: 'history', label: 'Substance History', placeholder: 'Past use, treatment history, sobriety periods...' },
    ],
  },
  {
    key: 'legal',
    label: 'Legal',
    fields: [
      { key: 'current', label: 'Current Legal Matters', placeholder: 'Pending charges, court dates, probation status...' },
      { key: 'history', label: 'Legal History', placeholder: 'Prior arrests, convictions, incarcerations...' },
      { key: 'involvement', label: 'System Involvement', placeholder: 'CPS, probation, parole, civil matters...' },
    ],
  },
  {
    key: 'recentEvents',
    label: 'Recent Events',
    fields: [
      { key: 'stressors', label: 'Recent Stressors', placeholder: 'Major life changes, losses, conflicts...' },
      { key: 'trauma', label: 'Trauma History', placeholder: 'Significant traumatic experiences, timeline...' },
      { key: 'coping', label: 'Coping & Support', placeholder: 'Current coping strategies, support systems...' },
    ],
  },
]

type TabData = Record<string, string>
type FormState = Record<TabKey, TabData>

function buildEmptyForm(): FormState {
  const state: Partial<FormState> = {}
  for (const tab of TABS) {
    const tabData: Record<string, string> = { clinicianNotes: '' }
    for (const field of tab.fields) {
      tabData[field.key] = ''
    }
    state[tab.key] = tabData
  }
  return state as FormState
}

export default function OnboardingModal({
  isOpen,
  onClose,
  caseId,
}: OnboardingModalProps): React.JSX.Element | null {
  const [activeTab, setActiveTab] = useState<TabKey>('contact')
  const [mode, setMode] = useState<Mode>('self-report')
  const [form, setForm] = useState<FormState>(buildEmptyForm)

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setForm(buildEmptyForm())
      setActiveTab('contact')
      setMode('self-report')
    }
  }, [isOpen])

  // Escape key closes modal
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  const updateField = useCallback((tab: TabKey, field: string, value: string) => {
    setForm((prev) => ({
      ...prev,
      [tab]: { ...prev[tab], [field]: value },
    }))
  }, [])

  const handleSaveDraft = useCallback(() => {
    window.psygil?.onboarding?.save?.({ caseId, tab: activeTab, data: form[activeTab], isDraft: true })
  }, [caseId, activeTab, form])

  const handleSaveAndContinue = useCallback(() => {
    window.psygil?.onboarding?.save?.({ caseId, tab: activeTab, data: form[activeTab], isDraft: false })
    const idx = TABS.findIndex((t) => t.key === activeTab)
    if (idx < TABS.length - 1) {
      setActiveTab(TABS[idx + 1].key)
    }
  }, [caseId, activeTab, form])

  const handleComplete = useCallback(() => {
    window.psygil?.onboarding?.save?.({ caseId, data: form, isDraft: false, complete: true })
    onClose()
  }, [caseId, form, onClose])

  if (!isOpen) return null

  const currentTabIdx = TABS.findIndex((t) => t.key === activeTab)
  const currentTab = TABS[currentTabIdx]
  const isLastTab = currentTabIdx === TABS.length - 1

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={containerStyle} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={headerStyle}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
            Patient Onboarding{caseId != null ? ` — Case #${caseId}` : ''}
          </span>
          <button onClick={onClose} style={closeButtonStyle} aria-label="Close">
            &times;
          </button>
        </div>

        {/* Mode toggle + Tab bar */}
        <div style={tabBarContainerStyle}>
          {/* Mode toggle */}
          <div style={{ display: 'flex', gap: 4, marginRight: 16 }}>
            <ModeButton
              label="Patient Self-Report"
              active={mode === 'self-report'}
              onClick={() => setMode('self-report')}
            />
            <ModeButton
              label="Clinician Interview"
              active={mode === 'clinician'}
              onClick={() => setMode('clinician')}
            />
          </div>

          {/* Tab bar */}
          <div style={{ display: 'flex', gap: 0, overflow: 'auto' }}>
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={activeTab === tab.key ? activeTabStyle : inactiveTabStyle}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {currentTab.fields.map((field) => (
            <div key={field.key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>{field.label}</label>
              <textarea
                style={textareaStyle}
                value={form[activeTab][field.key]}
                onChange={(e) => updateField(activeTab, field.key, e.target.value)}
                placeholder={field.placeholder}
              />
            </div>
          ))}

          {/* Clinician notes — visible only in clinician mode */}
          {mode === 'clinician' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ ...labelStyle, color: 'var(--accent)' }}>Clinician Notes</label>
              <textarea
                style={{ ...textareaStyle, borderColor: 'var(--accent)' }}
                value={form[activeTab].clinicianNotes}
                onChange={(e) => updateField(activeTab, 'clinicianNotes', e.target.value)}
                placeholder="Clinical observations, discrepancies, follow-up items..."
              />
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, paddingTop: 8 }}>
            <button onClick={handleSaveDraft} style={secondaryButtonStyle}>
              Save Draft
            </button>
            {isLastTab ? (
              <button onClick={handleComplete} style={primaryButtonStyle}>
                Complete Onboarding
              </button>
            ) : (
              <button onClick={handleSaveAndContinue} style={primaryButtonStyle}>
                Save &amp; Continue
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* --- ModeButton --- */

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
        padding: '3px 10px',
        fontSize: 11,
        fontWeight: 500,
        cursor: 'pointer',
        fontFamily: 'inherit',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  )
}

/* --- Styles --- */

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
  maxWidth: 880,
  width: '90%',
  maxHeight: 'calc(100vh - 64px)',
  overflowY: 'auto',
}

const headerStyle: React.CSSProperties = {
  position: 'sticky',
  top: 0,
  background: 'var(--panel)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 24px',
  borderBottom: '1px solid var(--border)',
  zIndex: 1,
}

const closeButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  fontSize: 20,
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  padding: 0,
  lineHeight: 1,
}

const tabBarContainerStyle: React.CSSProperties = {
  position: 'sticky',
  top: 45,
  background: 'var(--panel)',
  display: 'flex',
  alignItems: 'center',
  padding: '8px 24px 0',
  borderBottom: '1px solid var(--border)',
  zIndex: 1,
  flexWrap: 'wrap',
  gap: 8,
}

const activeTabStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  borderBottom: '2px solid var(--accent)',
  color: 'var(--accent)',
  fontSize: 12,
  fontWeight: 600,
  padding: '6px 12px',
  cursor: 'pointer',
  fontFamily: 'inherit',
  whiteSpace: 'nowrap',
}

const inactiveTabStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  borderBottom: '2px solid transparent',
  color: 'var(--text-secondary)',
  fontSize: 12,
  fontWeight: 500,
  padding: '6px 12px',
  cursor: 'pointer',
  fontFamily: 'inherit',
  whiteSpace: 'nowrap',
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
  padding: '8px 10px',
  fontSize: 13,
  color: 'var(--text)',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  minHeight: 80,
  resize: 'vertical',
}

const primaryButtonStyle: React.CSSProperties = {
  background: 'var(--accent)',
  color: '#ffffff',
  border: 'none',
  borderRadius: 4,
  padding: '8px 24px',
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
  padding: '8px 24px',
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
  fontFamily: 'inherit',
}
