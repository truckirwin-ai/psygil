import { useState, useEffect, useCallback } from 'react'
import type { CaseRow, PatientIntakeRow, ReferralType as IpcReferralType } from '../../../../shared/types/ipc'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ReferralMode = 'referral' | 'walkin'
type PrimaryTab = 'contact' | 'referral' | 'presenting' | 'insurance'
type ReferralSubTab = 'referring-party' | 'court-attorney' | 'eval-docs'

const EVAL_TYPE_OPTIONS = [
  'CST',
  'Custody',
  'Risk Assessment',
  'Fitness for Duty',
  'PTSD Dx',
  'ADHD Dx',
  'Malingering',
  'Capacity',
  'Disability',
  'Immigration',
  'Personal Injury',
  'Diagnostic Assessment',
  'Juvenile',
  'Mitigation',
] as const

const REFERRING_PARTY_TYPES = ['Court', 'Attorney', 'Physician', 'Agency', 'Insurance', 'Other'] as const

// ---------------------------------------------------------------------------
// Form shape
// ---------------------------------------------------------------------------

interface ContactForm {
  lastName: string
  firstName: string
  middleInitial: string
  dob: string
  gender: string
  streetAddress: string
  city: string
  state: string
  zip: string
  phone: string
  email: string
  preferredContact: string
  emergencyContactName: string
  emergencyContactRelationship: string
  emergencyContactPhone: string
}

interface ReferringPartyForm {
  referringPartyType: string
  referringPartyName: string
  referringPartyAddress: string
  referringPartyPhone: string
  referringPartyEmail: string
}

interface CourtAttorneyForm {
  caseNumber: string
  judgeAssignedCourt: string
  defenseCounselName: string
  defenseCounselPhone: string
  defenseCounselEmail: string
  prosecutionAttorney: string
  prosecutionPhone: string
  prosecutionEmail: string
  courtDeadline: string
}

interface EvalDocsForm {
  evalType: string
  reasonForReferral: string
  charges: string
  supportingDocuments: string
  additionalNotes: string
}

interface PresentingConcernsForm {
  primaryComplaint: string
  whenBegan: string
  betterOrWorse: string
  currentlySafe: string
  previousTreatment: string
  whoRecommended: string
  primaryCarePhysician: string
}

interface InsuranceForm {
  insuranceCarrier: string
  policyMemberId: string
  groupNumber: string
  policyholderName: string
  relationshipToPatient: string
}

interface FullFormData {
  contact: ContactForm
  referringParty: ReferringPartyForm
  courtAttorney: CourtAttorneyForm
  evalDocs: EvalDocsForm
  presenting: PresentingConcernsForm
  insurance: InsuranceForm
}

const EMPTY_FORM: FullFormData = {
  contact: {
    lastName: '', firstName: '', middleInitial: '',
    dob: '', gender: '',
    streetAddress: '', city: '',
    state: '', zip: '', phone: '',
    email: '', preferredContact: '',
    emergencyContactName: '', emergencyContactRelationship: '', emergencyContactPhone: '',
  },
  referringParty: {
    referringPartyType: '', referringPartyName: '', referringPartyAddress: '',
    referringPartyPhone: '', referringPartyEmail: '',
  },
  courtAttorney: {
    caseNumber: '', judgeAssignedCourt: '',
    defenseCounselName: '', defenseCounselPhone: '', defenseCounselEmail: '',
    prosecutionAttorney: '', prosecutionPhone: '', prosecutionEmail: '',
    courtDeadline: '',
  },
  evalDocs: {
    evalType: '', reasonForReferral: '', charges: '',
    supportingDocuments: '', additionalNotes: '',
  },
  presenting: {
    primaryComplaint: '', whenBegan: '', betterOrWorse: '',
    currentlySafe: '', previousTreatment: '',
    whoRecommended: '', primaryCarePhysician: '',
  },
  insurance: {
    insuranceCarrier: '', policyMemberId: '', groupNumber: '',
    policyholderName: '', relationshipToPatient: '',
  },
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface IntakeModalProps {
  readonly isOpen: boolean
  readonly onClose: () => void
  /** When provided → edit mode: load existing intake and save to this case. */
  readonly caseId?: number
  /** Called after a new case is successfully created (create mode only). */
  readonly onSaved?: (caseRow: CaseRow) => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateCaseNumber(): string {
  const year = new Date().getFullYear()
  const rand = Math.floor(Math.random() * 9000) + 1000
  return `PSY-${year}-${rand}`
}

function calcAge(dob: string): string {
  if (!dob) return ''
  const birth = new Date(dob)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age >= 0 ? String(age) : ''
}

function mapToIpcReferralType(mode: ReferralMode, partyType: string): IpcReferralType | undefined {
  if (mode === 'walkin') return 'walk-in'
  const t = partyType.toLowerCase()
  if (t === 'court') return 'court'
  if (t === 'attorney') return 'attorney'
  return 'attorney' // default for referral
}

function intakeRowToForm(row: PatientIntakeRow): Partial<FullFormData> {
  return {
    evalDocs: {
      evalType: row.eval_type ?? '',
      reasonForReferral: row.presenting_complaint ?? '',
      charges: row.charges ?? '',
      supportingDocuments: '',
      additionalNotes: '',
    },
    referringParty: {
      referringPartyType: '',
      referringPartyName: row.referral_source ?? '',
      referringPartyAddress: '',
      referringPartyPhone: '',
      referringPartyEmail: '',
    },
    courtAttorney: {
      caseNumber: row.jurisdiction ?? '',
      judgeAssignedCourt: '',
      defenseCounselName: '',
      defenseCounselPhone: '',
      defenseCounselEmail: '',
      prosecutionAttorney: row.attorney_name ?? '',
      prosecutionPhone: '',
      prosecutionEmail: '',
      courtDeadline: row.report_deadline ?? '',
    },
    presenting: {
      primaryComplaint: row.presenting_complaint ?? '',
      whenBegan: '', betterOrWorse: '',
      currentlySafe: '', previousTreatment: '',
      whoRecommended: '', primaryCarePhysician: '',
    },
  }
}

// ---------------------------------------------------------------------------
// IntakeModal
// ---------------------------------------------------------------------------

export default function IntakeModal({
  isOpen,
  onClose,
  caseId,
  onSaved,
}: IntakeModalProps): React.JSX.Element | null {
  const isEditMode = caseId != null

  const [referralMode, setReferralMode] = useState<ReferralMode>('referral')
  const [primaryTab, setPrimaryTab] = useState<PrimaryTab>('contact')
  const [referralSubTab, setReferralSubTab] = useState<ReferralSubTab>('referring-party')

  const [form, setForm] = useState<FullFormData>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset / load on open
  useEffect(() => {
    if (!isOpen) return
    setError(null)
    setSaving(false)
    setPrimaryTab('contact')
    setReferralSubTab('referring-party')

    if (isEditMode) {
      void (async () => {
        const resp = await window.psygil?.intake?.get?.({ case_id: caseId })
        if (resp?.status === 'success' && resp.data != null) {
          const partial = intakeRowToForm(resp.data as PatientIntakeRow)
          setForm((prev) => ({
            ...prev,
            ...partial,
            evalDocs: { ...prev.evalDocs, ...(partial.evalDocs ?? {}) },
            referringParty: { ...prev.referringParty, ...(partial.referringParty ?? {}) },
            courtAttorney: { ...prev.courtAttorney, ...(partial.courtAttorney ?? {}) },
            presenting: { ...prev.presenting, ...(partial.presenting ?? {}) },
          }))
          // infer mode from stored referral_type
          const rt = (resp.data as PatientIntakeRow).referral_type
          if (rt === 'walk-in' || rt === 'self') setReferralMode('walkin')
          else setReferralMode('referral')
        } else {
          setForm(EMPTY_FORM)
        }
      })()
    } else {
      setForm(EMPTY_FORM)
      setReferralMode('referral')
    }
  }, [isOpen, isEditMode, caseId])

  // Escape key
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  // Keep primaryTab valid when mode switches
  useEffect(() => {
    if (referralMode === 'walkin' && primaryTab === 'referral') {
      setPrimaryTab('presenting')
    } else if (referralMode === 'referral' && primaryTab === 'presenting') {
      setPrimaryTab('referral')
    }
  }, [referralMode, primaryTab])

  // Generic field updater
  const updateContact = useCallback(<K extends keyof ContactForm>(k: K, v: ContactForm[K]) => {
    setForm((p) => ({ ...p, contact: { ...p.contact, [k]: v } }))
  }, [])
  const updateReferringParty = useCallback(<K extends keyof ReferringPartyForm>(k: K, v: ReferringPartyForm[K]) => {
    setForm((p) => ({ ...p, referringParty: { ...p.referringParty, [k]: v } }))
  }, [])
  const updateCourtAttorney = useCallback(<K extends keyof CourtAttorneyForm>(k: K, v: CourtAttorneyForm[K]) => {
    setForm((p) => ({ ...p, courtAttorney: { ...p.courtAttorney, [k]: v } }))
  }, [])
  const updateEvalDocs = useCallback(<K extends keyof EvalDocsForm>(k: K, v: EvalDocsForm[K]) => {
    setForm((p) => ({ ...p, evalDocs: { ...p.evalDocs, [k]: v } }))
  }, [])
  const updatePresenting = useCallback(<K extends keyof PresentingConcernsForm>(k: K, v: PresentingConcernsForm[K]) => {
    setForm((p) => ({ ...p, presenting: { ...p.presenting, [k]: v } }))
  }, [])
  const updateInsurance = useCallback(<K extends keyof InsuranceForm>(k: K, v: InsuranceForm[K]) => {
    setForm((p) => ({ ...p, insurance: { ...p.insurance, [k]: v } }))
  }, [])

  const saveIntakeData = useCallback(
    async (targetCaseId: number, isDraft: boolean): Promise<boolean> => {
      const resp = await window.psygil?.intake?.save?.({
        case_id: targetCaseId,
        data: {
          referral_type: mapToIpcReferralType(referralMode, form.referringParty.referringPartyType),
          referral_source: form.referringParty.referringPartyName || undefined,
          eval_type: form.evalDocs.evalType || undefined,
          presenting_complaint: referralMode === 'walkin'
            ? form.presenting.primaryComplaint || undefined
            : form.evalDocs.reasonForReferral || undefined,
          jurisdiction: form.courtAttorney.caseNumber || undefined,
          charges: form.evalDocs.charges || undefined,
          attorney_name: form.courtAttorney.prosecutionAttorney || undefined,
          report_deadline: form.courtAttorney.courtDeadline || undefined,
          status: isDraft ? 'draft' : 'complete',
        },
      })
      return resp?.status === 'success'
    },
    [form, referralMode],
  )

  const handleSaveDraft = useCallback(async () => {
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      if (isEditMode) {
        await saveIntakeData(caseId, true)
      }
    } finally {
      setSaving(false)
    }
  }, [saving, isEditMode, caseId, saveIntakeData])

  const handleSubmit = useCallback(async () => {
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      if (isEditMode) {
        const ok = await saveIntakeData(caseId, false)
        if (ok) {
          onClose()
        } else {
          setError('Failed to save intake. Please try again.')
        }
      } else {
        if (!form.contact.firstName.trim() || !form.contact.lastName.trim()) {
          setError('First and last name are required.')
          setSaving(false)
          return
        }
        const createResp = await window.psygil?.cases?.create?.({
          case_number: generateCaseNumber(),
          primary_clinician_user_id: 1,
          examinee_first_name: form.contact.firstName.trim(),
          examinee_last_name: form.contact.lastName.trim(),
          examinee_dob: form.contact.dob || undefined,
          examinee_gender: form.contact.gender || undefined,
          evaluation_type: form.evalDocs.evalType || undefined,
          referral_source: form.referringParty.referringPartyName || undefined,
          evaluation_questions: referralMode === 'walkin'
            ? form.presenting.primaryComplaint || undefined
            : form.evalDocs.reasonForReferral || undefined,
        })
        if (createResp?.status !== 'success') {
          setError(createResp?.message ?? 'Failed to create case.')
          setSaving(false)
          return
        }
        const newCase = createResp.data
        await saveIntakeData(newCase.case_id, false)
        onClose()
        onSaved?.(newCase)
      }
    } catch {
      setError('An unexpected error occurred.')
    } finally {
      setSaving(false)
    }
  }, [saving, isEditMode, caseId, form, referralMode, saveIntakeData, onClose, onSaved])

  if (!isOpen) return null

  const age = calcAge(form.contact.dob)

  // Build primary tabs list based on mode
  const primaryTabs: { id: PrimaryTab; label: string }[] = [
    { id: 'contact', label: 'Contact Information' },
    ...(referralMode === 'referral'
      ? [{ id: 'referral' as PrimaryTab, label: 'Referral Information' }]
      : [{ id: 'presenting' as PrimaryTab, label: 'Presenting Concerns' }]),
    { id: 'insurance', label: 'Insurance & Billing' },
  ]

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={containerStyle} onClick={(e) => e.stopPropagation()}>

        {/* ── Header ── */}
        <div style={headerStyle}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
            {isEditMode ? 'Edit Intake' : 'New Patient Intake'}
          </span>
          <button onClick={onClose} style={closeButtonStyle} aria-label="Close">
            &times;
          </button>
        </div>

        {/* ── Referral Type Toggle ── */}
        <div style={{ padding: '14px 24px 0', display: 'flex', gap: 24, alignItems: 'center' }}>
          <span style={labelStyle}>Intake Type</span>
          <label style={radioLabelStyle}>
            <input
              type="radio"
              name="referralMode"
              value="referral"
              checked={referralMode === 'referral'}
              onChange={() => setReferralMode('referral')}
              style={{ marginRight: 6 }}
            />
            Referral
            <span style={{ color: 'var(--text-secondary)', marginLeft: 6, fontSize: 11 }}>
              (Court / Attorney / Physician / Insurance)
            </span>
          </label>
          <label style={radioLabelStyle}>
            <input
              type="radio"
              name="referralMode"
              value="walkin"
              checked={referralMode === 'walkin'}
              onChange={() => setReferralMode('walkin')}
              style={{ marginRight: 6 }}
            />
            Walk-in / Self-Referred
          </label>
        </div>

        {/* ── Primary Tab Strip ── */}
        <div style={tabStripStyle}>
          {primaryTabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setPrimaryTab(t.id)}
              style={t.id === primaryTab ? activeTabStyle : inactiveTabStyle}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Tab Body ── */}
        <div style={bodyStyle}>

          {/* ═══ Contact Information ═══ */}
          {primaryTab === 'contact' && (
            <div style={sectionStyle}>
              {/* Row 1: Last, First, MI */}
              <div style={rowStyle}>
                <Field label="Last Name" flex={3}>
                  <input style={inputStyle} value={form.contact.lastName}
                    onChange={(e) => updateContact('lastName', e.target.value)} placeholder="Last name" />
                </Field>
                <Field label="First Name" flex={3}>
                  <input style={inputStyle} value={form.contact.firstName}
                    onChange={(e) => updateContact('firstName', e.target.value)} placeholder="First name" />
                </Field>
                <Field label="MI" flex={1}>
                  <input style={inputStyle} value={form.contact.middleInitial}
                    onChange={(e) => updateContact('middleInitial', e.target.value)} maxLength={1} placeholder="M" />
                </Field>
              </div>

              {/* Row 2: DOB, Age, Gender */}
              <div style={rowStyle}>
                <Field label="Date of Birth" flex={2}>
                  <input type="date" style={inputStyle} value={form.contact.dob}
                    onChange={(e) => updateContact('dob', e.target.value)} />
                </Field>
                <Field label="Age" flex={1}>
                  <input style={{ ...inputStyle, background: 'var(--panel)', color: 'var(--text-secondary)' }}
                    value={age} readOnly placeholder="," />
                </Field>
                <Field label="Gender" flex={2}>
                  <input style={inputStyle} value={form.contact.gender}
                    onChange={(e) => updateContact('gender', e.target.value)} placeholder="Gender identity" />
                </Field>
              </div>

              {/* Row 3: Street Address, City */}
              <div style={rowStyle}>
                <Field label="Street Address" flex={3}>
                  <input style={inputStyle} value={form.contact.streetAddress}
                    onChange={(e) => updateContact('streetAddress', e.target.value)} placeholder="123 Main St" />
                </Field>
                <Field label="City" flex={2}>
                  <input style={inputStyle} value={form.contact.city}
                    onChange={(e) => updateContact('city', e.target.value)} placeholder="City" />
                </Field>
              </div>

              {/* Row 4: State, ZIP, Phone */}
              <div style={rowStyle}>
                <Field label="State" flex={1}>
                  <input style={inputStyle} value={form.contact.state}
                    onChange={(e) => updateContact('state', e.target.value)} placeholder="CO" maxLength={2} />
                </Field>
                <Field label="ZIP" flex={1}>
                  <input style={inputStyle} value={form.contact.zip}
                    onChange={(e) => updateContact('zip', e.target.value)} placeholder="80901" />
                </Field>
                <Field label="Phone" flex={2}>
                  <input style={inputStyle} value={form.contact.phone}
                    onChange={(e) => updateContact('phone', e.target.value)} placeholder="(555) 555-5555" />
                </Field>
              </div>

              {/* Row 5: Email, Preferred Contact */}
              <div style={rowStyle}>
                <Field label="Email" flex={3}>
                  <input style={inputStyle} type="email" value={form.contact.email}
                    onChange={(e) => updateContact('email', e.target.value)} placeholder="patient@example.com" />
                </Field>
                <Field label="Preferred Contact Method" flex={2}>
                  <select style={inputStyle} value={form.contact.preferredContact}
                    onChange={(e) => updateContact('preferredContact', e.target.value)}>
                    <option value="">Select...</option>
                    <option>Phone</option>
                    <option>Email</option>
                    <option>Text</option>
                    <option>Mail</option>
                  </select>
                </Field>
              </div>

              {/* Row 6: Emergency Contact */}
              <div style={rowStyle}>
                <Field label="Emergency Contact Name" flex={2}>
                  <input style={inputStyle} value={form.contact.emergencyContactName}
                    onChange={(e) => updateContact('emergencyContactName', e.target.value)} placeholder="Full name" />
                </Field>
                <Field label="Relationship" flex={1}>
                  <input style={inputStyle} value={form.contact.emergencyContactRelationship}
                    onChange={(e) => updateContact('emergencyContactRelationship', e.target.value)} placeholder="Spouse, Parent..." />
                </Field>
                <Field label="Emergency Phone" flex={2}>
                  <input style={inputStyle} value={form.contact.emergencyContactPhone}
                    onChange={(e) => updateContact('emergencyContactPhone', e.target.value)} placeholder="(555) 555-5555" />
                </Field>
              </div>
            </div>
          )}

          {/* ═══ Referral Information ═══ */}
          {primaryTab === 'referral' && (
            <div style={sectionStyle}>
              {/* Sub-tab strip */}
              <div style={subTabStripStyle}>
                {(
                  [
                    { id: 'referring-party' as ReferralSubTab, label: 'Referring Party' },
                    { id: 'court-attorney' as ReferralSubTab, label: 'Court & Attorney' },
                    { id: 'eval-docs' as ReferralSubTab, label: 'Evaluation & Documents' },
                  ] as const
                ).map((st) => (
                  <button
                    key={st.id}
                    onClick={() => setReferralSubTab(st.id)}
                    style={st.id === referralSubTab ? activeSubTabStyle : inactiveSubTabStyle}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

              {/* Sub-tab: Referring Party */}
              {referralSubTab === 'referring-party' && (
                <div style={subSectionStyle}>
                  <Field label="Referring Party Type">
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {REFERRING_PARTY_TYPES.map((t) => (
                        <button
                          key={t}
                          onClick={() => updateReferringParty('referringPartyType', t)}
                          style={form.referringParty.referringPartyType === t ? activeChipStyle : inactiveChipStyle}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </Field>
                  <Field label="Referring Party Name / Office">
                    <input style={inputStyle} value={form.referringParty.referringPartyName}
                      onChange={(e) => updateReferringParty('referringPartyName', e.target.value)}
                      placeholder="Name or office" />
                  </Field>
                  <Field label="Referring Party Address">
                    <input style={inputStyle} value={form.referringParty.referringPartyAddress}
                      onChange={(e) => updateReferringParty('referringPartyAddress', e.target.value)}
                      placeholder="Street address" />
                  </Field>
                  <div style={rowStyle}>
                    <Field label="Referring Party Phone" flex={1}>
                      <input style={inputStyle} value={form.referringParty.referringPartyPhone}
                        onChange={(e) => updateReferringParty('referringPartyPhone', e.target.value)}
                        placeholder="(555) 555-5555" />
                    </Field>
                    <Field label="Referring Party Email" flex={1}>
                      <input style={inputStyle} type="email" value={form.referringParty.referringPartyEmail}
                        onChange={(e) => updateReferringParty('referringPartyEmail', e.target.value)}
                        placeholder="email@example.com" />
                    </Field>
                  </div>
                </div>
              )}

              {/* Sub-tab: Court & Attorney */}
              {referralSubTab === 'court-attorney' && (
                <div style={subSectionStyle}>
                  <div style={rowStyle}>
                    <Field label="Court / Case Number" flex={1}>
                      <input style={inputStyle} value={form.courtAttorney.caseNumber}
                        onChange={(e) => updateCourtAttorney('caseNumber', e.target.value)}
                        placeholder="Case #" />
                    </Field>
                    <Field label="Judge / Assigned Court" flex={1}>
                      <input style={inputStyle} value={form.courtAttorney.judgeAssignedCourt}
                        onChange={(e) => updateCourtAttorney('judgeAssignedCourt', e.target.value)}
                        placeholder="Hon. Smith / District Court" />
                    </Field>
                  </div>
                  <div style={rowStyle}>
                    <Field label="Defense Counsel Name" flex={2}>
                      <input style={inputStyle} value={form.courtAttorney.defenseCounselName}
                        onChange={(e) => updateCourtAttorney('defenseCounselName', e.target.value)}
                        placeholder="Attorney name" />
                    </Field>
                    <Field label="Defense Phone" flex={1}>
                      <input style={inputStyle} value={form.courtAttorney.defenseCounselPhone}
                        onChange={(e) => updateCourtAttorney('defenseCounselPhone', e.target.value)}
                        placeholder="(555) 555-5555" />
                    </Field>
                    <Field label="Defense Email" flex={2}>
                      <input style={inputStyle} type="email" value={form.courtAttorney.defenseCounselEmail}
                        onChange={(e) => updateCourtAttorney('defenseCounselEmail', e.target.value)}
                        placeholder="defense@firm.com" />
                    </Field>
                  </div>
                  <div style={rowStyle}>
                    <Field label="Prosecution / Referring Attorney" flex={2}>
                      <input style={inputStyle} value={form.courtAttorney.prosecutionAttorney}
                        onChange={(e) => updateCourtAttorney('prosecutionAttorney', e.target.value)}
                        placeholder="Attorney name" />
                    </Field>
                    <Field label="Prosecution Phone" flex={1}>
                      <input style={inputStyle} value={form.courtAttorney.prosecutionPhone}
                        onChange={(e) => updateCourtAttorney('prosecutionPhone', e.target.value)}
                        placeholder="(555) 555-5555" />
                    </Field>
                    <Field label="Prosecution Email" flex={2}>
                      <input style={inputStyle} type="email" value={form.courtAttorney.prosecutionEmail}
                        onChange={(e) => updateCourtAttorney('prosecutionEmail', e.target.value)}
                        placeholder="da@county.gov" />
                    </Field>
                  </div>
                  <Field label="Court Deadline / Due Date">
                    <input type="date" style={{ ...inputStyle, maxWidth: 200 }}
                      value={form.courtAttorney.courtDeadline}
                      onChange={(e) => updateCourtAttorney('courtDeadline', e.target.value)} />
                  </Field>
                </div>
              )}

              {/* Sub-tab: Evaluation & Documents */}
              {referralSubTab === 'eval-docs' && (
                <div style={subSectionStyle}>
                  <Field label="Evaluation Type">
                    <select style={{ ...inputStyle, maxWidth: 280 }}
                      value={form.evalDocs.evalType}
                      onChange={(e) => updateEvalDocs('evalType', e.target.value)}>
                      <option value="">Select evaluation type...</option>
                      {EVAL_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </Field>
                  <Field label="Reason for Referral / Evaluation Requested">
                    <textarea style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }}
                      value={form.evalDocs.reasonForReferral}
                      onChange={(e) => updateEvalDocs('reasonForReferral', e.target.value)}
                      placeholder="Describe the evaluation being requested..." />
                  </Field>
                  <Field label="Complaint / Charges / Legal Matter">
                    <textarea style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }}
                      value={form.evalDocs.charges}
                      onChange={(e) => updateEvalDocs('charges', e.target.value)}
                      placeholder="List charges or legal matter..." />
                  </Field>
                  <Field label="Supporting Documents Received">
                    <textarea style={{ ...inputStyle, minHeight: 64, resize: 'vertical' }}
                      value={form.evalDocs.supportingDocuments}
                      onChange={(e) => updateEvalDocs('supportingDocuments', e.target.value)}
                      placeholder="Police report, prior evals, medical records..." />
                  </Field>
                  <Field label="Additional Notes">
                    <textarea style={{ ...inputStyle, minHeight: 64, resize: 'vertical' }}
                      value={form.evalDocs.additionalNotes}
                      onChange={(e) => updateEvalDocs('additionalNotes', e.target.value)}
                      placeholder="Any other relevant information..." />
                  </Field>
                </div>
              )}
            </div>
          )}

          {/* ═══ Presenting Concerns (walk-in only) ═══ */}
          {primaryTab === 'presenting' && (
            <div style={sectionStyle}>
              <Field label="Primary Complaint">
                <textarea style={{ ...inputStyle, minHeight: 88, resize: 'vertical' }}
                  value={form.presenting.primaryComplaint}
                  onChange={(e) => updatePresenting('primaryComplaint', e.target.value)}
                  placeholder="Describe the primary presenting concern..." />
              </Field>
              <Field label="When Did These Concerns Begin?">
                <textarea style={{ ...inputStyle, minHeight: 64, resize: 'vertical' }}
                  value={form.presenting.whenBegan}
                  onChange={(e) => updatePresenting('whenBegan', e.target.value)}
                  placeholder="Approximate onset and timeline..." />
              </Field>
              <Field label="Has Anything Made It Better or Worse?">
                <textarea style={{ ...inputStyle, minHeight: 64, resize: 'vertical' }}
                  value={form.presenting.betterOrWorse}
                  onChange={(e) => updatePresenting('betterOrWorse', e.target.value)}
                  placeholder="Factors that exacerbate or alleviate symptoms..." />
              </Field>
              <Field label="Are You Currently Safe?">
                <textarea style={{ ...inputStyle, minHeight: 64, resize: 'vertical' }}
                  value={form.presenting.currentlySafe}
                  onChange={(e) => updatePresenting('currentlySafe', e.target.value)}
                  placeholder="Safety screening response..." />
              </Field>
              <Field label="Previous Treatment or Evaluation">
                <textarea style={{ ...inputStyle, minHeight: 64, resize: 'vertical' }}
                  value={form.presenting.previousTreatment}
                  onChange={(e) => updatePresenting('previousTreatment', e.target.value)}
                  placeholder="Prior therapy, hospitalization, or assessments..." />
              </Field>
              <div style={rowStyle}>
                <Field label="Who Recommended You Come In?" flex={1}>
                  <input style={inputStyle} value={form.presenting.whoRecommended}
                    onChange={(e) => updatePresenting('whoRecommended', e.target.value)}
                    placeholder="Referral source" />
                </Field>
                <Field label="Primary Care Physician" flex={1}>
                  <input style={inputStyle} value={form.presenting.primaryCarePhysician}
                    onChange={(e) => updatePresenting('primaryCarePhysician', e.target.value)}
                    placeholder="Dr. Name" />
                </Field>
              </div>
            </div>
          )}

          {/* ═══ Insurance & Billing ═══ */}
          {primaryTab === 'insurance' && (
            <div style={sectionStyle}>
              <div style={rowStyle}>
                <Field label="Insurance Carrier" flex={2}>
                  <input style={inputStyle} value={form.insurance.insuranceCarrier}
                    onChange={(e) => updateInsurance('insuranceCarrier', e.target.value)}
                    placeholder="Aetna, BCBS, etc." />
                </Field>
                <Field label="Policy / Member ID" flex={2}>
                  <input style={inputStyle} value={form.insurance.policyMemberId}
                    onChange={(e) => updateInsurance('policyMemberId', e.target.value)}
                    placeholder="Member ID" />
                </Field>
                <Field label="Group Number" flex={1}>
                  <input style={inputStyle} value={form.insurance.groupNumber}
                    onChange={(e) => updateInsurance('groupNumber', e.target.value)}
                    placeholder="Group #" />
                </Field>
              </div>
              <div style={rowStyle}>
                <Field label="Policyholder Name (if not patient)" flex={2}>
                  <input style={inputStyle} value={form.insurance.policyholderName}
                    onChange={(e) => updateInsurance('policyholderName', e.target.value)}
                    placeholder="Leave blank if patient is policyholder" />
                </Field>
                <Field label="Relationship to Patient" flex={1}>
                  <select style={inputStyle} value={form.insurance.relationshipToPatient}
                    onChange={(e) => updateInsurance('relationshipToPatient', e.target.value)}>
                    <option value="">Select...</option>
                    <option>Self</option>
                    <option>Spouse</option>
                    <option>Parent</option>
                    <option>Guardian</option>
                    <option>Other</option>
                  </select>
                </Field>
              </div>
            </div>
          )}

          {/* ── Error ── */}
          {error != null && (
            <div style={errorStyle}>{error}</div>
          )}

          {/* ── Actions ── */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, paddingTop: 8 }}>
            <button onClick={() => { void handleSaveDraft() }} style={secondaryButtonStyle} disabled={saving}>
              Save Draft
            </button>
            <button
              onClick={() => { void handleSubmit() }}
              style={saving ? { ...primaryButtonStyle, opacity: 0.6 } : primaryButtonStyle}
              disabled={saving}
            >
              {saving ? 'Saving...' : isEditMode ? 'Save Changes' : 'Create Case'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Field wrapper
// ---------------------------------------------------------------------------

function Field({
  label,
  flex,
  children,
}: {
  readonly label: string
  readonly flex?: number
  readonly children: React.ReactNode
}): React.JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.55)', /* themed:skip - modal scrim */
  zIndex: 9999,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const containerStyle: React.CSSProperties = {
  background: 'var(--panel)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  width: 860,
  height: 'calc(100vh - 64px)',
  maxWidth: '96vw',
  maxHeight: 'calc(100vh - 32px)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
}

const headerStyle: React.CSSProperties = {
  background: 'var(--panel)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 24px',
  borderBottom: '1px solid var(--border)',
  flexShrink: 0,
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

const tabStripStyle: React.CSSProperties = {
  display: 'flex',
  borderBottom: '1px solid var(--border)',
  padding: '0 24px',
  gap: 0,
  flexShrink: 0,
  marginTop: 2,
}

const subTabStripStyle: React.CSSProperties = {
  display: 'flex',
  borderBottom: '1px solid var(--border)',
  gap: 0,
  marginBottom: 16,
}

const baseTabStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  borderBottom: '2px solid transparent',
  padding: '8px 16px',
  fontSize: 13,
  cursor: 'pointer',
  fontFamily: 'inherit',
  marginBottom: -1,
  transition: 'color 0.15s',
}

const activeTabStyle: React.CSSProperties = {
  ...baseTabStyle,
  color: 'var(--accent)',
  borderBottomColor: 'var(--accent)',
  fontWeight: 600,
}

const inactiveTabStyle: React.CSSProperties = {
  ...baseTabStyle,
  color: 'var(--text-secondary)',
}

const baseSubTabStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  borderBottom: '2px solid transparent',
  padding: '6px 14px',
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: 'inherit',
  marginBottom: -1,
}

const activeSubTabStyle: React.CSSProperties = {
  ...baseSubTabStyle,
  color: 'var(--accent)',
  borderBottomColor: 'var(--accent)',
  fontWeight: 600,
}

const inactiveSubTabStyle: React.CSSProperties = {
  ...baseSubTabStyle,
  color: 'var(--text-secondary)',
}

const bodyStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '20px 24px 24px',
  display: 'flex',
  flexDirection: 'column',
  gap: 0,
}

const sectionStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
  flex: 1,
}

const subSectionStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 12,
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  color: 'var(--text-secondary)',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
}

const radioLabelStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--text)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
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

const activeChipStyle: React.CSSProperties = {
  background: 'var(--accent)',
  color: 'var(--field-bg)',
  border: '1px solid var(--accent)',
  borderRadius: 4,
  padding: '4px 12px',
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const inactiveChipStyle: React.CSSProperties = {
  background: 'var(--panel)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  padding: '4px 12px',
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const primaryButtonStyle: React.CSSProperties = {
  background: 'var(--accent)',
  color: 'var(--field-bg)',
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

const errorStyle: React.CSSProperties = {
  background: 'color-mix(in srgb, var(--danger) 10%, transparent)',
  border: '1px solid color-mix(in srgb, var(--danger) 40%, transparent)',
  borderRadius: 4,
  padding: '8px 12px',
  fontSize: 13,
  color: 'var(--danger)',
  marginTop: 4,
}
