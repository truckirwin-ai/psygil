import { useState, useEffect, useCallback } from 'react'
import type { CaseRow, PatientIntakeRow, OnboardingSection, PatientOnboardingRow, ReferralType as IpcReferralType } from '../../../../shared/types/ipc'

// ---------------------------------------------------------------------------
// Step definitions (8 total: 2 intake + 6 onboarding)
// ---------------------------------------------------------------------------

type StepIndex = 0 | 1 | 2 | 3 | 4 | 5

interface StepDef {
  readonly index: StepIndex
  readonly number: number
  readonly label: string
  readonly phase: 'intake' | 'patient-history'
  readonly type: 'intake' | 'onboarding'
  readonly intakeField?: keyof IntakeFormFields
  readonly onboardingSection?: OnboardingSection
  /** Merged steps save to multiple onboarding sections */
  readonly onboardingSections?: readonly OnboardingSection[]
}

const STEPS: readonly StepDef[] = [
  // Phase 1: Intake (steps 0-1)
  { index: 0, number: 1, label: 'Contact & Insurance', phase: 'intake', type: 'intake', intakeField: 'contact' },
  { index: 1, number: 2, label: 'Referral & Legal', phase: 'intake', type: 'intake', intakeField: 'referral' },
  // Phase 2: Patient History (steps 2-5)
  { index: 2, number: 3, label: 'Demographics & Family', phase: 'patient-history', type: 'onboarding', onboardingSection: 'contact', onboardingSections: ['contact', 'family'] },
  { index: 3, number: 4, label: 'Presenting Complaints', phase: 'patient-history', type: 'onboarding', onboardingSection: 'complaints' },
  { index: 4, number: 5, label: 'Medical & Substance Use', phase: 'patient-history', type: 'onboarding', onboardingSection: 'health', onboardingSections: ['health', 'substance'] },
  { index: 5, number: 6, label: 'Recent Events', phase: 'patient-history', type: 'onboarding', onboardingSection: 'recent' },
]

// ---------------------------------------------------------------------------
// Intake form types
// ---------------------------------------------------------------------------

type ReferralMode = 'referral' | 'walkin'

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

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
] as const

const GENDER_OPTIONS = ['Male', 'Female', 'Non-binary', 'Transgender Male', 'Transgender Female', 'Other', 'Prefer not to say'] as const
const MARITAL_STATUS_OPTIONS = ['Single', 'Married', 'Divorced', 'Separated', 'Widowed', 'Domestic Partnership', 'Other'] as const
const EMPLOYMENT_STATUS_OPTIONS = ['Employed Full-Time', 'Employed Part-Time', 'Self-Employed', 'Unemployed', 'Retired', 'Disabled', 'Student'] as const
const EDUCATION_OPTIONS = ['Less than High School', 'High School/GED', 'Some College', "Associate's", "Bachelor's", "Master's", 'Doctorate/Professional', 'Other'] as const
const LANGUAGES = ['English', 'Spanish', 'Mandarin', 'Cantonese', 'Vietnamese', 'Tagalog', 'Arabic', 'French', 'Korean', 'Japanese', 'Other'] as const
const INSURANCE_RELATIONSHIP = ['Self', 'Spouse', 'Parent', 'Child', 'Other'] as const

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

interface ReferralForm {
  referringPartyType: string
  referringPartyName: string
  referringPartyAddress: string
  referringPartyPhone: string
  referringPartyEmail: string
  caseNumber: string
  judgeAssignedCourt: string
  defenseCounselName: string
  defenseCounselPhone: string
  defenseCounselEmail: string
  prosecutionAttorney: string
  prosecutionPhone: string
  prosecutionEmail: string
  courtDeadline: string
  evalType: string
  reasonForReferral: string
  charges: string
  supportingDocuments: string
  additionalNotes: string
  // Legal history (patient-reported)
  arrestsConvictions: string
  incarcerationHistory: string
  probationParole: string
  protectiveOrders: string
}

interface InsuranceForm {
  insuranceCarrier: string
  policyMemberId: string
  groupNumber: string
  policyholderName: string
  relationshipToPatient: string
}

interface IntakeFormFields {
  contact: ContactForm
  referral: ReferralForm
}

const EMPTY_INTAKE_FORM: IntakeFormFields = {
  contact: {
    lastName: '', firstName: '', middleInitial: '',
    dob: '', gender: '',
    streetAddress: '', city: '',
    state: '', zip: '', phone: '',
    email: '', preferredContact: '',
    emergencyContactName: '', emergencyContactRelationship: '', emergencyContactPhone: '',
  },
  referral: {
    referringPartyType: '', referringPartyName: '', referringPartyAddress: '',
    referringPartyPhone: '', referringPartyEmail: '',
    caseNumber: '', judgeAssignedCourt: '',
    defenseCounselName: '', defenseCounselPhone: '', defenseCounselEmail: '',
    prosecutionAttorney: '', prosecutionPhone: '', prosecutionEmail: '',
    courtDeadline: '',
    evalType: '', reasonForReferral: '', charges: '',
    supportingDocuments: '', additionalNotes: '',
    arrestsConvictions: '', incarcerationHistory: '',
    probationParole: '', protectiveOrders: '',
  },
}

// ---------------------------------------------------------------------------
// Onboarding form types
// ---------------------------------------------------------------------------

type SectionData = Record<string, string>
type OnboardingFormState = Record<OnboardingSection, SectionData>

function buildEmptyOnboardingForm(): OnboardingFormState {
  const state: Partial<OnboardingFormState> = {}
  const sections: OnboardingSection[] = ['contact', 'complaints', 'family', 'health', 'substance', 'recent']
  for (const section of sections) {
    state[section] = { clinician_notes: '' }
  }
  return state as OnboardingFormState
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface IntakeOnboardingModalProps {
  readonly isOpen: boolean
  readonly onClose: () => void
  readonly caseId?: number
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
  if (isNaN(birth.getTime())) return ','
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
  return 'attorney'
}

function intakeRowToForm(row: PatientIntakeRow): Partial<IntakeFormFields> {
  return {
    referral: {
      referringPartyType: '',
      referringPartyName: row.referral_source ?? '',
      referringPartyAddress: '',
      referringPartyPhone: '',
      referringPartyEmail: '',
      caseNumber: row.jurisdiction ?? '',
      judgeAssignedCourt: '',
      defenseCounselName: '',
      defenseCounselPhone: '',
      defenseCounselEmail: '',
      prosecutionAttorney: row.attorney_name ?? '',
      prosecutionPhone: '',
      prosecutionEmail: '',
      courtDeadline: row.report_deadline ?? '',
      evalType: row.eval_type ?? '',
      reasonForReferral: row.presenting_complaint ?? '',
      charges: row.charges ?? '',
      supportingDocuments: '',
      additionalNotes: '',
    },
  }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function IntakeOnboardingModal({
  isOpen,
  onClose,
  caseId,
  onSaved,
}: IntakeOnboardingModalProps): React.JSX.Element | null {
  const isEditMode = caseId != null

  // Current step
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0)
  const currentStep = STEPS[currentStepIndex]

  // Intake form
  const [referralMode, setReferralMode] = useState<ReferralMode>('referral')
  const [intakeForm, setIntakeForm] = useState<IntakeFormFields>(EMPTY_INTAKE_FORM)
  const [intakeMode, setIntakeMode] = useState<'clinician' | 'self-report'>('self-report')

  // Onboarding form
  const [onboardingForm, setOnboardingForm] = useState<OnboardingFormState>(buildEmptyOnboardingForm())
  const [onboardingMode, setOnboardingMode] = useState<'clinician' | 'self-report'>('self-report')

  // Metadata
  const [caseData, setCaseData] = useState<CaseRow | null>(null)
  const [createdCaseId, setCreatedCaseId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set())

  // Effective case ID: prop (edit mode) or newly created ID
  const effectiveCaseId = caseId ?? createdCaseId

  // Keep mode in sync (onboarding sections 2-7 can use clinician mode, sections 0-1 always use self-report)
  const effectiveMode = currentStepIndex < 2 ? 'self-report' : onboardingMode
  const isClinician = effectiveMode === 'clinician'

  // Reset + load on open
  useEffect(() => {
    if (!isOpen) return
    setError(null)
    setSaving(false)
    setCurrentStepIndex(0)
    setReferralMode('referral')
    setIntakeMode('self-report')
    setOnboardingMode('self-report')
    setIntakeForm(EMPTY_INTAKE_FORM)
    setOnboardingForm(buildEmptyOnboardingForm())
    setCaseData(null)
    setCreatedCaseId(null)
    setCompletedSteps(new Set())

    if (caseId == null) return

    // Load case meta
    void window.psygil.cases.get({ case_id: caseId }).then((res) => {
      if (res.status === 'success') setCaseData(res.data)
    })

    // Load existing intake
    void window.psygil.intake.get({ case_id: caseId }).then((res) => {
      if (res.status !== 'success' || res.data == null) return
      const partial = intakeRowToForm(res.data)
      setIntakeForm((prev) => ({
        ...prev,
        referral: { ...prev.referral, ...(partial.referral ?? {}) },
      }))
      const rt = res.data.referral_type
      if (rt === 'walk-in' || rt === 'self') setReferralMode('walkin')
      else setReferralMode('referral')
      setCompletedSteps((p) => new Set([...p, 0, 1]))
    })

    // Load existing onboarding
    void window.psygil.onboarding.get({ case_id: caseId }).then((res) => {
      if (res.status !== 'success') return
      setOnboardingForm((prev) => {
        const next = { ...prev }
        const loadedSections = new Set<OnboardingSection>()
        for (const row of res.data) {
          const step = STEPS.find((s) => s.onboardingSection === row.section)
          if (!step || !step.onboardingSection) continue
          loadedSections.add(row.section)
          let content: Record<string, string> = {}
          try {
            content = JSON.parse(row.content) as Record<string, string>
          } catch {
            const firstField = 'content'
            content = { [firstField]: row.content }
          }
          next[row.section] = {
            ...prev[row.section],
            ...content,
            clinician_notes: row.clinician_notes ?? '',
          }
        }
        // Mark onboarding steps as completed
        const completedOnboardingSteps = Array.from(loadedSections)
          .map((section) => STEPS.find((s) => s.onboardingSection === section)?.index)
          .filter((idx) => idx != null) as number[]
        setCompletedSteps((p) => new Set([...p, ...completedOnboardingSteps]))
        return next
      })
    })
  }, [isOpen, caseId])

  // Escape key
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  // Intake field updaters
  const updateContactField = useCallback(<K extends keyof ContactForm>(k: K, v: ContactForm[K]) => {
    setIntakeForm((p) => ({ ...p, contact: { ...p.contact, [k]: v } }))
  }, [])

  const updateReferralField = useCallback(<K extends keyof ReferralForm>(k: K, v: ReferralForm[K]) => {
    setIntakeForm((p) => ({ ...p, referral: { ...p.referral, [k]: v } }))
  }, [])

  // Onboarding field updater
  const updateOnboardingField = useCallback((section: OnboardingSection, field: string, value: string) => {
    setOnboardingForm((prev) => ({
      ...prev,
      [section]: { ...prev[section], [field]: value },
    }))
  }, [])

  // Save handlers
  const saveIntakeData = useCallback(
    async (targetCaseId: number): Promise<boolean> => {
      const resp = await window.psygil.intake.save({
        case_id: targetCaseId,
        data: {
          referral_type: mapToIpcReferralType(referralMode, intakeForm.referral.referringPartyType),
          referral_source: intakeForm.referral.referringPartyName || undefined,
          eval_type: intakeForm.referral.evalType || undefined,
          presenting_complaint: intakeForm.referral.reasonForReferral || undefined,
          jurisdiction: intakeForm.referral.caseNumber || undefined,
          charges: intakeForm.referral.charges || undefined,
          attorney_name: intakeForm.referral.prosecutionAttorney || undefined,
          report_deadline: intakeForm.referral.courtDeadline || undefined,
          status: 'draft',
        },
      })
      return resp?.status === 'success'
    },
    [intakeForm, referralMode],
  )

  const saveOnboardingSection = useCallback(
    async (targetCaseId: number, section: OnboardingSection): Promise<boolean> => {
      const sectionData = onboardingForm[section]
      const { clinician_notes, ...fieldValues } = sectionData
      const resp = await window.psygil.onboarding.save({
        case_id: targetCaseId,
        section,
        data: {
          content: JSON.stringify(fieldValues),
          clinician_notes: clinician_notes || undefined,
          status: 'draft',
        },
      })
      return resp?.status === 'success'
    },
    [onboardingForm],
  )

  const handleSaveDraft = useCallback(async () => {
    if (saving || effectiveCaseId == null) return
    setSaving(true)
    setError(null)
    try {
      if (currentStep.type === 'intake') {
        await saveIntakeData(effectiveCaseId)
      } else if (currentStep.onboardingSections) {
        for (const section of currentStep.onboardingSections) {
          await saveOnboardingSection(effectiveCaseId, section)
        }
      } else if (currentStep.onboardingSection) {
        await saveOnboardingSection(effectiveCaseId, currentStep.onboardingSection)
      }
    } catch {
      setError('Failed to save draft.')
    } finally {
      setSaving(false)
    }
  }, [saving, effectiveCaseId, currentStep, saveIntakeData, saveOnboardingSection])

  const handleSaveAndContinue = useCallback(async () => {
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      let targetCaseId = effectiveCaseId
      const isLastStep = currentStepIndex === STEPS.length - 1

      // ── Create case on first save (create mode, Step 0) ──
      if (targetCaseId == null) {
        const firstName = intakeForm.contact.firstName.trim()
        const lastName = intakeForm.contact.lastName.trim()
        if (!firstName || !lastName) {
          setError('First and last name are required to create a case.')
          setSaving(false)
          return
        }
        const caseNumber = generateCaseNumber()
        const createResp = await window.psygil?.cases?.create?.({
          case_number: caseNumber,
          primary_clinician_user_id: 1,
          examinee_first_name: firstName,
          examinee_last_name: lastName,
          examinee_dob: intakeForm.contact.dob || undefined,
          examinee_gender: intakeForm.contact.gender || undefined,
          evaluation_type: intakeForm.referral.evalType || undefined,
          referral_source: intakeForm.referral.referringPartyName || undefined,
          evaluation_questions: intakeForm.referral.reasonForReferral || undefined,
        })
        if (createResp?.status !== 'success') {
          setError(createResp?.message ?? 'Failed to create case.')
          setSaving(false)
          return
        }
        const newCase = createResp.data
        targetCaseId = newCase.case_id
        setCreatedCaseId(newCase.case_id)
        setCaseData(newCase)
      }

      // ── Save current step data ──
      if (currentStep.type === 'intake') {
        const ok = await saveIntakeData(targetCaseId)
        if (!ok) {
          setError('Failed to save intake.')
          setSaving(false)
          return
        }
      } else if (currentStep.onboardingSections) {
        for (const section of currentStep.onboardingSections) {
          const ok = await saveOnboardingSection(targetCaseId, section)
          if (!ok) {
            setError(`Failed to save ${section} section.`)
            setSaving(false)
            return
          }
        }
      } else if (currentStep.onboardingSection) {
        const ok = await saveOnboardingSection(targetCaseId, currentStep.onboardingSection)
        if (!ok) {
          setError('Failed to save section.')
          setSaving(false)
          return
        }
      }

      // Mark current step as complete
      setCompletedSteps((p) => new Set([...p, currentStepIndex]))

      if (isLastStep) {
        // ── On intake completion: sync eval type + advance pipeline stage ──
        if (targetCaseId != null) {
          try {
            // Sync evaluation_type from intake form → cases table
            const evalType = intakeForm.referral.evalType
            if (evalType) {
              await window.psygil?.cases?.update?.({
                case_id: targetCaseId,
                evaluation_type: evalType,
              })
            }

            // Advance pipeline: onboarding → testing
            await window.psygil?.pipeline?.setStage?.({
              caseId: targetCaseId,
              stage: 'testing',
            })
          } catch (err) {
            console.error('[intake] Post-completion updates failed (non-fatal):', err)
          }
        }

        onSaved?.(caseData!)
        onClose()
      } else {
        setCurrentStepIndex(currentStepIndex + 1)
      }
    } catch (err) {
      setError('An error occurred.')
    } finally {
      setSaving(false)
    }
  }, [saving, currentStepIndex, currentStep, effectiveCaseId, intakeForm, caseData, saveIntakeData, saveOnboardingSection, onClose, onSaved])

  if (!isOpen) return null

  const age = calcAge(intakeForm.contact.dob)
  const isLastStep = currentStepIndex === STEPS.length - 1

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={containerStyle} onClick={(e) => e.stopPropagation()}>

        {/* ── HEADER ── */}
        <div style={headerStyle}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>
              {isEditMode ? 'Edit Intake & Onboarding' : 'New Intake & Onboarding Wizard'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              Step {currentStep.number} of {STEPS.length}, {currentStep.phase === 'intake' ? 'Administrative Information' : 'Patient History'}
            </div>
          </div>
          <button onClick={onClose} style={closeButtonStyle} aria-label="Close">
            &times;
          </button>
        </div>

        {/* ── FIDELITY NOTE ── */}
        <div style={fidelityBoxStyle}>
          <span style={{ fontWeight: 600, color: 'var(--accent)' }}>Data Fidelity Protocol: </span>
          Information will be cleaned for grammar and spelling, then translated to clinical language for the case overview.
          Every element is preserved. The clinician verifies and annotates during the initial interview.
        </div>

        {/* ── STEP TAB BAR ── */}
        <div style={stepTabBarStyle}>
          <div style={{ display: 'flex', overflow: 'auto', gap: 0, flex: 1 }}>
            {STEPS.map((step, idx) => {
              const isActive = idx === currentStepIndex
              const isCompleted = completedSteps.has(idx)
              const isBefore = idx < currentStepIndex
              return (
                <button
                  key={step.index}
                  onClick={() => setCurrentStepIndex(idx)}
                  style={isActive ? activeStepTabStyle : inactiveStepTabStyle}
                  title={step.label}
                >
                  {isBefore && isCompleted ? '✓' : step.number}. {step.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── STEP CONTENT ── */}
        <div style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: 16, flex: 1, overflowY: 'auto' }}>

          {/* INTAKE STEPS */}
          {currentStep.type === 'intake' && currentStep.intakeField === 'contact' && (
            <IntakeContactAndInsuranceStep contact={intakeForm.contact} age={age} onContactUpdate={updateContactField} />
          )}

          {currentStep.type === 'intake' && currentStep.intakeField === 'referral' && (
            <IntakeReferralStep
              referralMode={referralMode}
              onReferralModeChange={setReferralMode}
              referralData={intakeForm.referral}
              onReferralUpdate={updateReferralField}
            />
          )}

          {/* ONBOARDING STEPS, merged Demographics & Family */}
          {currentStep.type === 'onboarding' && currentStep.onboardingSections?.includes('contact') && currentStep.onboardingSections?.includes('family') && (
            <DemographicsFamilyStep
              contactData={onboardingForm.contact}
              familyData={onboardingForm.family}
              onContactUpdate={(field, value) => updateOnboardingField('contact', field, value)}
              onFamilyUpdate={(field, value) => updateOnboardingField('family', field, value)}
              caseData={caseData}
              isClinician={isClinician}
            />
          )}

          {/* ONBOARDING STEPS, merged Medical & Substance */}
          {currentStep.type === 'onboarding' && currentStep.onboardingSections?.includes('health') && currentStep.onboardingSections?.includes('substance') && (
            <MedicalSubstanceStep
              healthData={onboardingForm.health}
              substanceData={onboardingForm.substance}
              onHealthUpdate={(field, value) => updateOnboardingField('health', field, value)}
              onSubstanceUpdate={(field, value) => updateOnboardingField('substance', field, value)}
              isClinician={isClinician}
            />
          )}

          {/* ONBOARDING STEPS, single-section (Complaints, Recent Events) */}
          {currentStep.type === 'onboarding' && !currentStep.onboardingSections && currentStep.onboardingSection && (
            <OnboardingStep
              section={currentStep.onboardingSection}
              sectionLabel={currentStep.label}
              sectionData={onboardingForm[currentStep.onboardingSection]}
              onUpdate={(field, value) => updateOnboardingField(currentStep.onboardingSection!, field, value)}
              caseData={caseData}
              isClinician={isClinician}
            />
          )}

          {error && (
            <div style={{ color: '#d32f2f', fontSize: 13, padding: '8px 12px', background: '#ffebee', borderRadius: 4 }}>
              {error}
            </div>
          )}

          {/* ACTION BUTTONS */}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, paddingTop: 4 }}>
            <button
              onClick={() => void handleSaveDraft()}
              style={secondaryButtonStyle}
              disabled={saving}
            >
              Save Draft
            </button>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setCurrentStepIndex(Math.max(0, currentStepIndex - 1))}
                style={secondaryButtonStyle}
                disabled={currentStepIndex === 0 || saving}
              >
                Back
              </button>
              <button
                onClick={() => void handleSaveAndContinue()}
                style={primaryButtonStyle}
                disabled={saving}
              >
                {isLastStep ? 'Complete Intake ✓' : 'Save & Continue →'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Intake Contact & Insurance Step (MERGED)
// ---------------------------------------------------------------------------

interface IntakeContactAndInsuranceStepProps {
  readonly contact: any
  readonly age: string
  readonly onContactUpdate: (key: string, value: string) => void
}

function IntakeContactAndInsuranceStep({ contact, age, onContactUpdate }: IntakeContactAndInsuranceStepProps): React.JSX.Element {
  return (
    <div style={sectionStyle}>
      {/* CONTACT SECTION */}
      <div>
        <div style={sectionHeaderStyle}>
          Contact Information
        </div>

        <div style={rowStyle}>
          <Field label="Last Name" flex={3}>
            <input style={inputStyle} value={contact.lastName}
              onChange={(e) => onContactUpdate('lastName', e.target.value)} placeholder="Last name" />
          </Field>
          <Field label="First Name" flex={3}>
            <input style={inputStyle} value={contact.firstName}
              onChange={(e) => onContactUpdate('firstName', e.target.value)} placeholder="First name" />
          </Field>
          <Field label="MI" flex={1}>
            <input style={inputStyle} value={contact.middleInitial}
              onChange={(e) => onContactUpdate('middleInitial', e.target.value)} maxLength={1} placeholder="M" />
          </Field>
        </div>

        <div style={rowStyle}>
          <Field label="Date of Birth" flex={2}>
            <input type="date" style={inputStyle} value={contact.dob}
              onChange={(e) => onContactUpdate('dob', e.target.value)} />
          </Field>
          <Field label="Age" flex={1}>
            <input style={{ ...inputStyle, background: 'var(--panel)', color: 'var(--text-secondary)' }}
              value={age} readOnly placeholder="," />
          </Field>
          <Field label="Gender" flex={2}>
            <select style={inputStyle} value={contact.gender}
              onChange={(e) => onContactUpdate('gender', e.target.value)}>
              <option value="">Select...</option>
              {GENDER_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </Field>
        </div>

        <div style={rowStyle}>
          <Field label="Street Address" flex={3}>
            <input style={inputStyle} value={contact.streetAddress}
              onChange={(e) => onContactUpdate('streetAddress', e.target.value)} placeholder="123 Main St" />
          </Field>
          <Field label="City" flex={2}>
            <input style={inputStyle} value={contact.city}
              onChange={(e) => onContactUpdate('city', e.target.value)} placeholder="City" />
          </Field>
        </div>

        <div style={rowStyle}>
          <Field label="State" flex={1}>
            <select style={inputStyle} value={contact.state}
              onChange={(e) => onContactUpdate('state', e.target.value)}>
              <option value="">Select...</option>
              {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="ZIP" flex={1}>
            <input style={inputStyle} value={contact.zip}
              onChange={(e) => onContactUpdate('zip', e.target.value)} placeholder="80901" />
          </Field>
          <Field label="Phone" flex={2}>
            <input style={inputStyle} value={contact.phone}
              onChange={(e) => onContactUpdate('phone', e.target.value)} placeholder="(555) 555-5555" />
          </Field>
        </div>

        <div style={rowStyle}>
          <Field label="Email" flex={3}>
            <input style={inputStyle} type="email" value={contact.email}
              onChange={(e) => onContactUpdate('email', e.target.value)} placeholder="patient@example.com" />
          </Field>
          <Field label="Preferred Contact Method" flex={2}>
            <select style={inputStyle} value={contact.preferredContact}
              onChange={(e) => onContactUpdate('preferredContact', e.target.value)}>
              <option value="">Select...</option>
              <option>Phone</option>
              <option>Email</option>
              <option>Text</option>
              <option>Mail</option>
            </select>
          </Field>
        </div>

        <div style={rowStyle}>
          <Field label="Emergency Contact Name" flex={2}>
            <input style={inputStyle} value={contact.emergencyContactName}
              onChange={(e) => onContactUpdate('emergencyContactName', e.target.value)} placeholder="Full name" />
          </Field>
          <Field label="Relationship" flex={1}>
            <input style={inputStyle} value={contact.emergencyContactRelationship}
              onChange={(e) => onContactUpdate('emergencyContactRelationship', e.target.value)} placeholder="Spouse, Parent..." />
          </Field>
          <Field label="Emergency Phone" flex={2}>
            <input style={inputStyle} value={contact.emergencyContactPhone}
              onChange={(e) => onContactUpdate('emergencyContactPhone', e.target.value)} placeholder="(555) 555-5555" />
          </Field>
        </div>
      </div>

      {/* INSURANCE SECTION */}
      <div>
        <div style={sectionHeaderStyle}>
          Insurance & Billing
        </div>

        <div style={rowStyle}>
          <Field label="Insurance Carrier" flex={2}>
            <input style={inputStyle} value={contact.insuranceCarrier || ''}
              onChange={(e) => onContactUpdate('insuranceCarrier', e.target.value)}
              placeholder="Aetna, BCBS, etc." />
          </Field>
          <Field label="Policy / Member ID" flex={2}>
            <input style={inputStyle} value={contact.policyMemberId || ''}
              onChange={(e) => onContactUpdate('policyMemberId', e.target.value)}
              placeholder="Member ID" />
          </Field>
          <Field label="Group Number" flex={1}>
            <input style={inputStyle} value={contact.groupNumber || ''}
              onChange={(e) => onContactUpdate('groupNumber', e.target.value)}
              placeholder="Group #" />
          </Field>
        </div>

        <div style={rowStyle}>
          <Field label="Policyholder Name (if not patient)" flex={2}>
            <input style={inputStyle} value={contact.policyholderName || ''}
              onChange={(e) => onContactUpdate('policyholderName', e.target.value)}
              placeholder="Full name" />
          </Field>
          <Field label="Relationship to Patient" flex={2}>
            <select style={inputStyle} value={contact.relationshipToPatient || ''}
              onChange={(e) => onContactUpdate('relationshipToPatient', e.target.value)}>
              <option value="">Select...</option>
              {INSURANCE_RELATIONSHIP.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Intake Referral Step (FLATTENED, no sub-tabs)
// ---------------------------------------------------------------------------

interface IntakeReferralStepProps {
  readonly referralMode: any
  readonly onReferralModeChange: (mode: any) => void
  readonly referralData: any
  readonly onReferralUpdate: (key: string, value: string) => void
}

function IntakeReferralStep({
  referralMode,
  onReferralModeChange,
  referralData,
  onReferralUpdate,
}: IntakeReferralStepProps): React.JSX.Element {
  const [parsing, setParsing] = useState(false)
  const [parsedFile, setParsedFile] = useState<string | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)

  const handleBrowseReferral = useCallback(async () => {
    setParsing(true)
    setParseError(null)
    try {
      const resp = await window.psygil.referral.parseDoc()
      if (resp.status === 'error') {
        if (resp.error === 'cancelled') {
          // User cancelled the file picker, no error to show
          setParsing(false)
          return
        }
        setParseError(resp.error ?? 'Failed to parse document')
        setParsing(false)
        return
      }
      const fields = resp.data
      if (!fields) {
        setParsing(false)
        return
      }

      // Apply parsed fields to form (only non-empty values)
      const fieldKeys: (keyof typeof referralData)[] = [
        'caseNumber', 'judgeAssignedCourt', 'defenseCounselName',
        'prosecutionAttorney', 'referringPartyName', 'referringPartyType',
        'referringPartyPhone', 'evalType', 'charges', 'reasonForReferral',
        'courtDeadline',
      ]
      for (const key of fieldKeys) {
        if (fields[key]) {
          onReferralUpdate(key, fields[key])
        }
      }

      setParsedFile(fields._fileName ?? 'document')
    } catch (err: any) {
      setParseError(err?.message ?? 'Unexpected error')
    } finally {
      setParsing(false)
    }
  }, [onReferralUpdate, referralData])

  return (
    <div style={sectionStyle}>
      {/* Import referral document */}
      <div style={importBoxStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
          <button
            onClick={() => void handleBrowseReferral()}
            disabled={parsing}
            style={browseButtonStyle}
          >
            {parsing ? 'Parsing...' : 'Browse Referral Document'}
          </button>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {parsedFile
              ? <>Imported: <strong style={{ color: 'var(--text)' }}>{parsedFile}</strong>, fields auto-filled below</>
              : 'Upload a .docx or .pdf referral and auto-fill the fields below, or enter data manually.'}
          </span>
        </div>
        {parseError && (
          <div style={{ fontSize: 11, color: '#d32f2f', marginTop: 4 }}>{parseError}</div>
        )}
      </div>

      {/* Referral type toggle */}
      <div style={{ display: 'flex', gap: 24, alignItems: 'center', marginBottom: 8 }}>
        <span style={labelStyle}>Type</span>
        <label style={radioLabelStyle}>
          <input
            type="radio"
            name="referralMode"
            value="referral"
            checked={referralMode === 'referral'}
            onChange={() => onReferralModeChange('referral')}
            style={{ marginRight: 6 }}
          />
          Referral
        </label>
        <label style={radioLabelStyle}>
          <input
            type="radio"
            name="referralMode"
            value="walkin"
            checked={referralMode === 'walkin'}
            onChange={() => onReferralModeChange('walkin')}
            style={{ marginRight: 6 }}
          />
          Walk-in / Self-Referred
        </label>
      </div>

      {referralMode === 'referral' && (
        <>
          {/* REFERRING PARTY SECTION */}
          <div>
            <div style={sectionHeaderStyle}>
              Referring Party
            </div>

            <Field label="Referring Party Type">
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {REFERRING_PARTY_TYPES.map((t) => (
                  <button
                    key={t}
                    onClick={() => onReferralUpdate('referringPartyType', t)}
                    style={referralData.referringPartyType === t ? activeChipStyle : inactiveChipStyle}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Referring Party Name / Office">
              <input style={inputStyle} value={referralData.referringPartyName}
                onChange={(e) => onReferralUpdate('referringPartyName', e.target.value)}
                placeholder="Name or office" />
            </Field>

            <Field label="Referring Party Address">
              <input style={inputStyle} value={referralData.referringPartyAddress}
                onChange={(e) => onReferralUpdate('referringPartyAddress', e.target.value)}
                placeholder="Street address" />
            </Field>

            <div style={rowStyle}>
              <Field label="Referring Party Phone" flex={1}>
                <input style={inputStyle} value={referralData.referringPartyPhone}
                  onChange={(e) => onReferralUpdate('referringPartyPhone', e.target.value)}
                  placeholder="(555) 555-5555" />
              </Field>
              <Field label="Referring Party Email" flex={1}>
                <input style={inputStyle} type="email" value={referralData.referringPartyEmail}
                  onChange={(e) => onReferralUpdate('referringPartyEmail', e.target.value)}
                  placeholder="email@example.com" />
              </Field>
            </div>
          </div>

          {/* COURT & ATTORNEY SECTION */}
          <div>
            <div style={sectionHeaderStyle}>
              Court & Attorney
            </div>

            <div style={rowStyle}>
              <Field label="Court / Case Number" flex={1}>
                <input style={inputStyle} value={referralData.caseNumber}
                  onChange={(e) => onReferralUpdate('caseNumber', e.target.value)}
                  placeholder="Case #" />
              </Field>
              <Field label="Judge / Assigned Court" flex={1}>
                <input style={inputStyle} value={referralData.judgeAssignedCourt}
                  onChange={(e) => onReferralUpdate('judgeAssignedCourt', e.target.value)}
                  placeholder="Hon. Smith / District Court" />
              </Field>
            </div>

            <div style={rowStyle}>
              <Field label="Defense Counsel Name" flex={2}>
                <input style={inputStyle} value={referralData.defenseCounselName}
                  onChange={(e) => onReferralUpdate('defenseCounselName', e.target.value)}
                  placeholder="Attorney name" />
              </Field>
              <Field label="Defense Phone" flex={1}>
                <input style={inputStyle} value={referralData.defenseCounselPhone}
                  onChange={(e) => onReferralUpdate('defenseCounselPhone', e.target.value)}
                  placeholder="(555) 555-5555" />
              </Field>
            </div>

            <div style={rowStyle}>
              <Field label="Prosecution / Referring Attorney" flex={2}>
                <input style={inputStyle} value={referralData.prosecutionAttorney}
                  onChange={(e) => onReferralUpdate('prosecutionAttorney', e.target.value)}
                  placeholder="Attorney name" />
              </Field>
              <Field label="Prosecution Phone" flex={1}>
                <input style={inputStyle} value={referralData.prosecutionPhone}
                  onChange={(e) => onReferralUpdate('prosecutionPhone', e.target.value)}
                  placeholder="(555) 555-5555" />
              </Field>
            </div>

            <Field label="Court Deadline / Due Date">
              <input type="date" style={{ ...inputStyle, maxWidth: 200 }}
                value={referralData.courtDeadline}
                onChange={(e) => onReferralUpdate('courtDeadline', e.target.value)} />
            </Field>
          </div>

          {/* EVALUATION & DOCUMENTS SECTION */}
          <div>
            <div style={sectionHeaderStyle}>
              Evaluation & Documents
            </div>

            <Field label="Evaluation Type">
              <select style={{ ...inputStyle, maxWidth: 280 }}
                value={referralData.evalType}
                onChange={(e) => onReferralUpdate('evalType', e.target.value)}>
                <option value="">Select evaluation type...</option>
                {EVAL_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>

            <Field label="Reason for Referral / Evaluation Requested">
              <textarea style={{ ...textareaStyle, minHeight: 72, resize: 'vertical' }}
                value={referralData.reasonForReferral}
                onChange={(e) => onReferralUpdate('reasonForReferral', e.target.value)}
                placeholder="Describe the evaluation being requested..." />
            </Field>

            <Field label="Complaint / Charges / Legal Matter">
              <textarea style={{ ...textareaStyle, minHeight: 72, resize: 'vertical' }}
                value={referralData.charges}
                onChange={(e) => onReferralUpdate('charges', e.target.value)}
                placeholder="List charges or legal matter..." />
            </Field>

            <Field label="Supporting Documents Received">
              <textarea style={{ ...textareaStyle, minHeight: 64, resize: 'vertical' }}
                value={referralData.supportingDocuments}
                onChange={(e) => onReferralUpdate('supportingDocuments', e.target.value)}
                placeholder="Police report, prior evals, medical records..." />
            </Field>

            <Field label="Additional Notes">
              <textarea style={{ ...textareaStyle, minHeight: 64, resize: 'vertical' }}
                value={referralData.additionalNotes}
                onChange={(e) => onReferralUpdate('additionalNotes', e.target.value)}
                placeholder="Any other relevant information..." />
            </Field>
          </div>

          {/* LEGAL HISTORY SECTION */}
          <div>
            <div style={sectionHeaderStyle}>
              Legal History
            </div>

            <Field label="Prior Arrests & Convictions">
              <textarea style={{ ...textareaStyle, minHeight: 64, resize: 'vertical' }}
                value={referralData.arrestsConvictions}
                onChange={(e) => onReferralUpdate('arrestsConvictions', e.target.value)}
                placeholder="Prior arrests, charges, and convictions..." />
            </Field>

            <div style={rowStyle}>
              <Field label="Incarceration History" flex={1}>
                <textarea style={{ ...textareaStyle, minHeight: 64, resize: 'vertical' }}
                  value={referralData.incarcerationHistory}
                  onChange={(e) => onReferralUpdate('incarcerationHistory', e.target.value)}
                  placeholder="Prior incarceration, duration, facility..." />
              </Field>
              <Field label="Probation / Parole" flex={1}>
                <textarea style={{ ...textareaStyle, minHeight: 64, resize: 'vertical' }}
                  value={referralData.probationParole}
                  onChange={(e) => onReferralUpdate('probationParole', e.target.value)}
                  placeholder="Current or prior probation/parole status..." />
              </Field>
            </div>

            <Field label="Protective / Restraining Orders">
              <textarea style={{ ...textareaStyle, minHeight: 64, resize: 'vertical' }}
                value={referralData.protectiveOrders}
                onChange={(e) => onReferralUpdate('protectiveOrders', e.target.value)}
                placeholder="Active or prior protective orders..." />
            </Field>
          </div>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Demographics & Family (merged step, contact + family onboarding sections)
// Uses columns and dropdowns for structured fields, textareas for narratives.
// ---------------------------------------------------------------------------

const LIVING_SITUATION_OPTIONS = ['Own Home', 'Renting', 'With Family', 'With Roommates', 'Homeless/Shelter', 'Assisted Living', 'Group Home', 'Incarcerated', 'Other'] as const

interface DemographicsFamilyStepProps {
  readonly contactData: SectionData
  readonly familyData: SectionData
  readonly onContactUpdate: (field: string, value: string) => void
  readonly onFamilyUpdate: (field: string, value: string) => void
  readonly caseData: CaseRow | null
  readonly isClinician: boolean
}

function DemographicsFamilyStep({
  contactData, familyData, onContactUpdate, onFamilyUpdate, caseData, isClinician,
}: DemographicsFamilyStepProps): React.JSX.Element {
  return (
    <div style={sectionStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
          DEMOGRAPHICS & FAMILY
        </span>
        <span style={isClinician ? underReviewBadgeStyle : patientBadgeStyle}>
          {isClinician ? 'Under Review' : 'Patient-Reported'}
        </span>
      </div>

      {/* Read-only patient info from intake */}
      {caseData && (
        <div style={readOnlyGroupStyle}>
          <div style={readOnlyRowStyle}>
            <span style={readOnlyLabelStyle}>Name</span>
            <span style={readOnlyValueStyle}>{`${caseData.examinee_first_name} ${caseData.examinee_last_name}`}</span>
          </div>
          <div style={readOnlyRowStyle}>
            <span style={readOnlyLabelStyle}>DOB</span>
            <span style={readOnlyValueStyle}>{caseData.examinee_dob ?? ','}</span>
          </div>
          <div style={readOnlyRowStyle}>
            <span style={readOnlyLabelStyle}>Gender</span>
            <span style={readOnlyValueStyle}>{caseData.examinee_gender ?? ','}</span>
          </div>
        </div>
      )}

      {/* DEMOGRAPHICS, structured fields in columns */}
      <div style={sectionHeaderStyle}>Demographics</div>
      <div style={rowStyle}>
        <Field label="Marital / Relationship Status" flex={1}>
          <select style={inputStyle} value={contactData.marital_status ?? ''}
            onChange={(e) => onContactUpdate('marital_status', e.target.value)}>
            <option value="">Select...</option>
            {MARITAL_STATUS_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </Field>
        <Field label="Dependents / Children" flex={1}>
          <input style={inputStyle} value={contactData.dependents ?? ''}
            onChange={(e) => onContactUpdate('dependents', e.target.value)}
            placeholder="Number and ages" />
        </Field>
      </div>

      <div style={rowStyle}>
        <Field label="Living Situation" flex={1}>
          <select style={inputStyle} value={contactData.living_situation ?? ''}
            onChange={(e) => onContactUpdate('living_situation', e.target.value)}>
            <option value="">Select...</option>
            {LIVING_SITUATION_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </Field>
        <Field label="Primary Language" flex={1}>
          <select style={inputStyle} value={contactData.primary_language ?? ''}
            onChange={(e) => onContactUpdate('primary_language', e.target.value)}>
            <option value="">Select...</option>
            {LANGUAGES.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </Field>
      </div>

      {/* EDUCATION & EMPLOYMENT, structured */}
      <div style={sectionHeaderStyle}>Education & Employment</div>
      <div style={rowStyle}>
        <Field label="Highest Education" flex={1}>
          <select style={inputStyle} value={familyData.highest_education ?? ''}
            onChange={(e) => onFamilyUpdate('highest_education', e.target.value)}>
            <option value="">Select...</option>
            {EDUCATION_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </Field>
        <Field label="Employment Status" flex={1}>
          <select style={inputStyle} value={familyData.employment_status ?? ''}
            onChange={(e) => onFamilyUpdate('employment_status', e.target.value)}>
            <option value="">Select...</option>
            {EMPLOYMENT_STATUS_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </Field>
      </div>

      <div style={rowStyle}>
        <Field label="Schools Attended" flex={1}>
          <input style={inputStyle} value={familyData.schools_attended ?? ''}
            onChange={(e) => onFamilyUpdate('schools_attended', e.target.value)}
            placeholder="Schools, colleges, programs..." />
        </Field>
        <Field label="Current / Recent Employer & Role" flex={1}>
          <input style={inputStyle} value={familyData.current_employer ?? ''}
            onChange={(e) => onFamilyUpdate('current_employer', e.target.value)}
            placeholder="Employer, role" />
        </Field>
      </div>

      <div style={rowStyle}>
        <Field label="Academic Experience" flex={1}>
          <textarea style={{ ...textareaStyle, minHeight: 56, resize: 'vertical' }}
            value={familyData.academic_experience ?? ''}
            onChange={(e) => onFamilyUpdate('academic_experience', e.target.value)}
            placeholder="Academic performance, challenges, special education..." />
        </Field>
        <Field label="Work History" flex={1}>
          <textarea style={{ ...textareaStyle, minHeight: 56, resize: 'vertical' }}
            value={familyData.work_history ?? ''}
            onChange={(e) => onFamilyUpdate('work_history', e.target.value)}
            placeholder="Employment history, gaps, issues..." />
        </Field>
      </div>

      <Field label="Military Service">
        <input style={inputStyle} value={familyData.military_service ?? ''}
          onChange={(e) => onFamilyUpdate('military_service', e.target.value)}
          placeholder="Branch, dates, discharge status, or N/A" />
      </Field>

      {/* FAMILY, narrative fields */}
      <div style={sectionHeaderStyle}>Family History</div>
      <Field label="Family of Origin">
        <textarea style={{ ...textareaStyle, minHeight: 72, resize: 'vertical' }}
          value={familyData.family_of_origin ?? ''}
          onChange={(e) => onFamilyUpdate('family_of_origin', e.target.value)}
          placeholder="Parents, siblings, upbringing, household composition..." />
      </Field>

      <div style={rowStyle}>
        <Field label="Family Mental Health History" flex={1}>
          <textarea style={{ ...textareaStyle, minHeight: 64, resize: 'vertical' }}
            value={familyData.family_mental_health ?? ''}
            onChange={(e) => onFamilyUpdate('family_mental_health', e.target.value)}
            placeholder="Family history of mental health conditions..." />
        </Field>
        <Field label="Family Medical History" flex={1}>
          <textarea style={{ ...textareaStyle, minHeight: 64, resize: 'vertical' }}
            value={familyData.family_medical_history ?? ''}
            onChange={(e) => onFamilyUpdate('family_medical_history', e.target.value)}
            placeholder="Family history of medical conditions..." />
        </Field>
      </div>

      <Field label="Current Family Relationships">
        <textarea style={{ ...textareaStyle, minHeight: 64, resize: 'vertical' }}
          value={familyData.current_family_relationships ?? ''}
          onChange={(e) => onFamilyUpdate('current_family_relationships', e.target.value)}
          placeholder="Current relationships, support system, conflicts..." />
      </Field>

      {/* Clinician notes */}
      {isClinician && (
        <div style={clinicianBoxStyle}>
          <label style={{ ...labelStyle, color: 'var(--accent)', display: 'block', marginBottom: 6 }}>
            Clinician Verification Notes
          </label>
          <textarea
            style={{ ...textareaStyle, minHeight: 72 }}
            value={contactData.clinician_notes ?? ''}
            onChange={(e) => onContactUpdate('clinician_notes', e.target.value)}
            placeholder="Clinical observations, discrepancies, follow-up items..."
          />
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Medical & Substance Use (merged step, health + substance onboarding sections)
// All narrative text inputs per over-reporting prevention principle.
// ---------------------------------------------------------------------------

interface MedicalSubstanceStepProps {
  readonly healthData: SectionData
  readonly substanceData: SectionData
  readonly onHealthUpdate: (field: string, value: string) => void
  readonly onSubstanceUpdate: (field: string, value: string) => void
  readonly isClinician: boolean
}

function MedicalSubstanceStep({
  healthData, substanceData, onHealthUpdate, onSubstanceUpdate, isClinician,
}: MedicalSubstanceStepProps): React.JSX.Element {
  return (
    <div style={sectionStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
          MEDICAL & SUBSTANCE USE
        </span>
        <span style={isClinician ? underReviewBadgeStyle : patientBadgeStyle}>
          {isClinician ? 'Under Review' : 'Patient-Reported'}
        </span>
      </div>

      {/* MEDICAL CONDITIONS */}
      <div style={sectionHeaderStyle}>Medical History</div>

      <Field label="Current Medical Conditions">
        <textarea style={{ ...textareaStyle, minHeight: 64, resize: 'vertical' }}
          value={healthData.medical_conditions ?? ''}
          onChange={(e) => onHealthUpdate('medical_conditions', e.target.value)}
          placeholder="Describe current medical conditions..." />
      </Field>

      <div style={rowStyle}>
        <Field label="Current Medications" flex={1}>
          <textarea style={{ ...textareaStyle, minHeight: 56, resize: 'vertical' }}
            value={healthData.current_medications ?? ''}
            onChange={(e) => onHealthUpdate('current_medications', e.target.value)}
            placeholder="Medication, dose, prescriber..." />
        </Field>
        <Field label="Surgeries & Hospitalizations" flex={1}>
          <textarea style={{ ...textareaStyle, minHeight: 56, resize: 'vertical' }}
            value={healthData.surgeries_hospitalizations ?? ''}
            onChange={(e) => onHealthUpdate('surgeries_hospitalizations', e.target.value)}
            placeholder="Prior surgeries, hospitalizations..." />
        </Field>
      </div>

      <div style={rowStyle}>
        <Field label="Head Injuries / TBI" flex={1}>
          <textarea style={{ ...textareaStyle, minHeight: 56, resize: 'vertical' }}
            value={healthData.head_injuries ?? ''}
            onChange={(e) => onHealthUpdate('head_injuries', e.target.value)}
            placeholder="Head injuries, LOC, TBI history..." />
        </Field>
        <Field label="Sleep Quality & Disturbance" flex={1}>
          <input style={inputStyle} value={healthData.sleep_quality ?? ''}
            onChange={(e) => onHealthUpdate('sleep_quality', e.target.value)}
            placeholder="Hours, quality, disturbances..." />
        </Field>
      </div>

      <Field label="Appetite & Weight Changes">
        <input style={inputStyle} value={healthData.appetite_weight ?? ''}
          onChange={(e) => onHealthUpdate('appetite_weight', e.target.value)}
          placeholder="Recent changes in appetite or weight..." />
      </Field>

      {/* MENTAL HEALTH */}
      <div style={sectionHeaderStyle}>Mental Health History</div>

      <div style={rowStyle}>
        <Field label="Previous Treatment" flex={1}>
          <textarea style={{ ...textareaStyle, minHeight: 64, resize: 'vertical' }}
            value={healthData.previous_treatment ?? ''}
            onChange={(e) => onHealthUpdate('previous_treatment', e.target.value)}
            placeholder="Prior therapy, counseling, inpatient..." />
        </Field>
        <Field label="Previous Diagnoses" flex={1}>
          <textarea style={{ ...textareaStyle, minHeight: 64, resize: 'vertical' }}
            value={healthData.previous_diagnoses ?? ''}
            onChange={(e) => onHealthUpdate('previous_diagnoses', e.target.value)}
            placeholder="Prior psychiatric or psychological diagnoses..." />
        </Field>
      </div>

      <Field label="Psychiatric Medications, Past & Present">
        <textarea style={{ ...textareaStyle, minHeight: 56, resize: 'vertical' }}
          value={healthData.psych_medications ?? ''}
          onChange={(e) => onHealthUpdate('psych_medications', e.target.value)}
          placeholder="Current and prior psychiatric medications..." />
      </Field>

      <div style={rowStyle}>
        <Field label="History of Self-Harm or Suicidal Thoughts" flex={1}>
          <textarea style={{ ...textareaStyle, minHeight: 56, resize: 'vertical' }}
            value={healthData.self_harm_history ?? ''}
            onChange={(e) => onHealthUpdate('self_harm_history', e.target.value)}
            placeholder="Describe history, frequency, most recent..." />
        </Field>
        <Field label="History of Violence or Harm to Others" flex={1}>
          <textarea style={{ ...textareaStyle, minHeight: 56, resize: 'vertical' }}
            value={healthData.violence_history ?? ''}
            onChange={(e) => onHealthUpdate('violence_history', e.target.value)}
            placeholder="Describe history, context, most recent..." />
        </Field>
      </div>

      {/* SUBSTANCE USE */}
      <div style={sectionHeaderStyle}>Substance Use</div>

      <div style={rowStyle}>
        <Field label="Alcohol Use" flex={1}>
          <textarea style={{ ...textareaStyle, minHeight: 56, resize: 'vertical' }}
            value={substanceData.alcohol_use ?? ''}
            onChange={(e) => onSubstanceUpdate('alcohol_use', e.target.value)}
            placeholder="Frequency, amount, history..." />
        </Field>
        <Field label="Drug / Substance Use" flex={1}>
          <textarea style={{ ...textareaStyle, minHeight: 56, resize: 'vertical' }}
            value={substanceData.drug_use ?? ''}
            onChange={(e) => onSubstanceUpdate('drug_use', e.target.value)}
            placeholder="Substances, frequency, route..." />
        </Field>
      </div>

      <Field label="Substance Use Treatment History">
        <textarea style={{ ...textareaStyle, minHeight: 56, resize: 'vertical' }}
          value={substanceData.substance_treatment ?? ''}
          onChange={(e) => onSubstanceUpdate('substance_treatment', e.target.value)}
          placeholder="Prior treatment, rehab, detox, duration..." />
      </Field>

      {/* Clinician notes */}
      {isClinician && (
        <div style={clinicianBoxStyle}>
          <label style={{ ...labelStyle, color: 'var(--accent)', display: 'block', marginBottom: 6 }}>
            Clinician Verification Notes
          </label>
          <textarea
            style={{ ...textareaStyle, minHeight: 72 }}
            value={healthData.clinician_notes ?? ''}
            onChange={(e) => onHealthUpdate('clinician_notes', e.target.value)}
            placeholder="Clinical observations, discrepancies, follow-up items..."
          />
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Onboarding Step (generic, used for Complaints and Recent Events)
// ---------------------------------------------------------------------------

interface OnboardingStepProps {
  readonly section: OnboardingSection
  readonly sectionLabel: string
  readonly sectionData: SectionData
  readonly onUpdate: (field: string, value: string) => void
  readonly caseData: CaseRow | null
  readonly isClinician: boolean
}

function OnboardingStep({
  section,
  sectionLabel,
  sectionData,
  onUpdate,
  caseData,
  isClinician,
}: OnboardingStepProps): React.JSX.Element {
  const fieldMap: Record<OnboardingSection, readonly string[]> = {
    contact: ['marital_status', 'dependents', 'living_situation', 'primary_language'],
    complaints: ['primary_complaint', 'secondary_concerns', 'onset_timeline'],
    family: ['family_of_origin', 'family_mental_health', 'family_medical_history', 'current_family_relationships', 'highest_education', 'schools_attended', 'academic_experience', 'employment_status', 'current_employer', 'work_history', 'military_service'],
    health: ['medical_conditions', 'current_medications', 'surgeries_hospitalizations', 'head_injuries', 'sleep_quality', 'appetite_weight', 'previous_treatment', 'previous_diagnoses', 'psych_medications', 'self_harm_history', 'violence_history'],
    substance: ['alcohol_use', 'drug_use', 'substance_treatment'],
    recent: ['events_circumstances', 'current_stressors', 'goals_evaluation'],
  }

  const fieldLabels: Record<string, string> = {
    marital_status: 'Marital / Relationship Status',
    dependents: 'Dependents / Children',
    living_situation: 'Current Living Situation',
    primary_language: 'Primary Language',
    primary_complaint: 'Primary Complaint, Describe in Detail',
    secondary_concerns: 'Secondary Concerns',
    onset_timeline: 'Onset & Timeline',
    family_of_origin: 'Family of Origin',
    family_mental_health: 'Family Mental Health History',
    family_medical_history: 'Family Medical History',
    current_family_relationships: 'Current Family Relationships',
    highest_education: 'Highest Level of Education',
    schools_attended: 'Schools Attended',
    academic_experience: 'Academic Experience',
    employment_status: 'Current Employment Status',
    current_employer: 'Current / Most Recent Employer & Role',
    work_history: 'Work History Summary',
    military_service: 'Military Service',
    medical_conditions: 'Current Medical Conditions',
    current_medications: 'Current Medications',
    surgeries_hospitalizations: 'Surgeries & Hospitalizations',
    head_injuries: 'Head Injuries / Traumatic Brain Injury',
    sleep_quality: 'Sleep Quality & Disturbance',
    appetite_weight: 'Appetite & Weight Changes',
    previous_treatment: 'Previous Mental Health Treatment',
    previous_diagnoses: 'Previous Diagnoses',
    psych_medications: 'Psychiatric Medications Past & Present',
    self_harm_history: 'History of Self-Harm or Suicidal Thoughts',
    violence_history: 'History of Violence or Harm to Others',
    alcohol_use: 'Alcohol Use',
    drug_use: 'Drug / Substance Use',
    substance_treatment: 'Treatment for Substance Use',
    arrests_convictions: 'Prior Arrests & Convictions',
    incarceration_history: 'Incarceration History',
    probation_parole: 'Probation / Parole',
    protective_orders: 'Protective Orders / Restraining Orders',
    events_circumstances: 'Describe the Events or Circumstances',
    current_stressors: 'Current Stressors',
    goals_evaluation: 'Goals for This Evaluation',
  }

  const fields = fieldMap[section] || []

  return (
    <div style={sectionStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
          {sectionLabel.toUpperCase()}
        </span>
        <span style={isClinician ? underReviewBadgeStyle : patientBadgeStyle}>
          {isClinician ? 'Under Review' : 'Patient-Reported'}
        </span>
      </div>

      {/* Show read-only intake data for contact section */}
      {section === 'contact' && caseData && (
        <div style={readOnlyGroupStyle}>
          <div style={readOnlyRowStyle}>
            <span style={readOnlyLabelStyle}>Name</span>
            <span style={readOnlyValueStyle}>
              {`${caseData.examinee_first_name} ${caseData.examinee_last_name}`}
            </span>
          </div>
          <div style={readOnlyRowStyle}>
            <span style={readOnlyLabelStyle}>Date of Birth</span>
            <span style={readOnlyValueStyle}>{caseData.examinee_dob ?? ','}</span>
          </div>
          <div style={readOnlyRowStyle}>
            <span style={readOnlyLabelStyle}>Age</span>
            <span style={readOnlyValueStyle}>
              {caseData.examinee_dob ? calcAge(caseData.examinee_dob) : ','}
            </span>
          </div>
          <div style={readOnlyRowStyle}>
            <span style={readOnlyLabelStyle}>Gender</span>
            <span style={readOnlyValueStyle}>{caseData.examinee_gender ?? ','}</span>
          </div>
        </div>
      )}

      {/* Form fields */}
      {fields.map((field) => (
        <div key={field} style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 6 }}>
          <label style={labelStyle}>{fieldLabels[field] || field}</label>
          <textarea
            style={{ ...textareaStyle, minHeight: field.includes('primary_complaint') || field.includes('events_circumstances') ? 120 : 72 }}
            value={sectionData[field] ?? ''}
            onChange={(e) => onUpdate(field, e.target.value)}
            placeholder={`Enter ${fieldLabels[field] || field}...`}
          />
        </div>
      ))}

      {/* Clinician notes (only in clinician mode) */}
      {isClinician && (
        <div style={clinicianBoxStyle}>
          <label style={{ ...labelStyle, color: 'var(--accent)', display: 'block', marginBottom: 6 }}>
            Clinician Verification Notes
          </label>
          <textarea
            style={{ ...textareaStyle, minHeight: 72 }}
            rows={3}
            value={sectionData.clinician_notes ?? ''}
            onChange={(e) => onUpdate('clinician_notes', e.target.value)}
            placeholder="Clinical observations, discrepancies, follow-up items..."
          />
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Field component
// ---------------------------------------------------------------------------

interface FieldProps {
  readonly label: string
  readonly flex?: number
  readonly children: React.ReactNode
}

function Field({ label, flex = 1, children }: FieldProps): React.JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex, marginTop: 10 }}>
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
  width: 'min(920px, 92vw)',
  height: 'calc(100vh - 80px)',
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

const stepTabBarStyle: React.CSSProperties = {
  position: 'sticky',
  top: 57,
  background: 'var(--panel)',
  display: 'flex',
  alignItems: 'center',
  padding: '10px 24px 0',
  borderBottom: '1px solid var(--border)',
  zIndex: 2,
  overflow: 'hidden',
}

const activeStepTabStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  borderBottom: '2px solid var(--accent)',
  color: 'var(--accent)',
  fontSize: 10,
  fontWeight: 600,
  padding: '6px 8px',
  cursor: 'pointer',
  fontFamily: 'inherit',
  whiteSpace: 'nowrap',
  letterSpacing: 0.2,
}

const inactiveStepTabStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  borderBottom: '2px solid transparent',
  color: 'var(--text-secondary)',
  fontSize: 10,
  fontWeight: 500,
  padding: '6px 8px',
  cursor: 'pointer',
  fontFamily: 'inherit',
  whiteSpace: 'nowrap',
  letterSpacing: 0.2,
}

const sectionStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
}

const sectionHeaderStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--accent)',
  textTransform: 'uppercase',
  letterSpacing: 0.8,
  marginTop: 14,
  marginBottom: 4,
  paddingBottom: 6,
  borderBottom: '1px solid var(--border)',
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 12,
}

const activeChipStyle: React.CSSProperties = {
  background: 'var(--accent)',
  color: '#ffffff',
  border: '1px solid var(--accent)',
  borderRadius: 4,
  padding: '4px 12px',
  fontSize: 11,
  fontWeight: 500,
  cursor: 'pointer',
  fontFamily: 'inherit',
  whiteSpace: 'nowrap',
}

const inactiveChipStyle: React.CSSProperties = {
  background: 'var(--panel)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  padding: '4px 12px',
  fontSize: 11,
  fontWeight: 500,
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

const readOnlyGroupStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gap: '6px 24px',
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  padding: '10px 14px',
  marginBottom: 12,
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

const importBoxStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  padding: '10px 14px',
  background: 'var(--bg)',
  border: '1px dashed var(--border)',
  borderRadius: 6,
  marginBottom: 6,
}

const browseButtonStyle: React.CSSProperties = {
  background: 'var(--panel)',
  color: 'var(--accent)',
  border: '1px solid var(--accent)',
  borderRadius: 4,
  padding: '6px 16px',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
  whiteSpace: 'nowrap',
  flexShrink: 0,
}

const radioLabelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  fontSize: 12,
  color: 'var(--text)',
  cursor: 'pointer',
  gap: 4,
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
