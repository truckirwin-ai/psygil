import { useState, useEffect, useCallback } from 'react'

interface IntakeModalProps {
  readonly isOpen: boolean
  readonly onClose: () => void
}

type EvalType =
  | ''
  | 'CST'
  | 'Custody'
  | 'Risk'
  | 'Fitness'
  | 'PTSD'
  | 'ADHD'
  | 'Malingering'
  | 'Capacity'

type ReferralType = 'Court-Ordered' | 'Attorney-Referred' | 'Self-Referred' | 'Walk-In'

const EVAL_TYPES: readonly EvalType[] = [
  'CST',
  'Custody',
  'Risk',
  'Fitness',
  'PTSD',
  'ADHD',
  'Malingering',
  'Capacity',
]

const REFERRAL_TYPES: readonly ReferralType[] = [
  'Court-Ordered',
  'Attorney-Referred',
  'Self-Referred',
  'Walk-In',
]

interface IntakeFormData {
  readonly lastName: string
  readonly firstName: string
  readonly middleInitial: string
  readonly dob: string
  readonly gender: string
  readonly evalType: EvalType
  readonly referralType: ReferralType | ''
  readonly referralSource: string
  readonly presentingComplaint: string
  readonly jurisdiction: string
  readonly charges: string
  readonly attorney: string
  readonly reportDeadline: string
}

const EMPTY_FORM: IntakeFormData = {
  lastName: '',
  firstName: '',
  middleInitial: '',
  dob: '',
  gender: '',
  evalType: '',
  referralType: '',
  referralSource: '',
  presentingComplaint: '',
  jurisdiction: '',
  charges: '',
  attorney: '',
  reportDeadline: '',
}

export default function IntakeModal({ isOpen, onClose }: IntakeModalProps): React.JSX.Element | null {
  const [form, setForm] = useState<IntakeFormData>(EMPTY_FORM)

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) setForm(EMPTY_FORM)
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

  const updateField = useCallback(
    <K extends keyof IntakeFormData>(field: K, value: IntakeFormData[K]) => {
      setForm((prev) => ({ ...prev, [field]: value }))
    },
    [],
  )

  const handleSaveDraft = useCallback(() => {
    window.psygil?.intake?.save?.({ ...form, isDraft: true })
  }, [form])

  const handleSubmit = useCallback(() => {
    window.psygil?.intake?.save?.({ ...form, isDraft: false })
    onClose()
  }, [form, onClose])

  if (!isOpen) return null

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={containerStyle} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={headerStyle}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
            New Case Intake
          </span>
          <button onClick={onClose} style={closeButtonStyle} aria-label="Close">
            &times;
          </button>
        </div>

        {/* Form body */}
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Name row */}
          <div style={rowStyle}>
            <Field label="Last Name" flex={3}>
              <input
                style={inputStyle}
                value={form.lastName}
                onChange={(e) => updateField('lastName', e.target.value)}
                placeholder="Last name"
              />
            </Field>
            <Field label="First Name" flex={3}>
              <input
                style={inputStyle}
                value={form.firstName}
                onChange={(e) => updateField('firstName', e.target.value)}
                placeholder="First name"
              />
            </Field>
            <Field label="MI" flex={1}>
              <input
                style={inputStyle}
                value={form.middleInitial}
                onChange={(e) => updateField('middleInitial', e.target.value)}
                maxLength={1}
                placeholder="M"
              />
            </Field>
          </div>

          {/* DOB / Gender / Eval Type */}
          <div style={rowStyle}>
            <Field label="Date of Birth" flex={2}>
              <input
                type="date"
                style={inputStyle}
                value={form.dob}
                onChange={(e) => updateField('dob', e.target.value)}
              />
            </Field>
            <Field label="Gender" flex={2}>
              <input
                style={inputStyle}
                value={form.gender}
                onChange={(e) => updateField('gender', e.target.value)}
                placeholder="Gender"
              />
            </Field>
            <Field label="Evaluation Type" flex={3}>
              <select
                style={inputStyle}
                value={form.evalType}
                onChange={(e) => updateField('evalType', e.target.value as EvalType)}
              >
                <option value="">Select type...</option>
                {EVAL_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {/* Referral Type toggle buttons */}
          <Field label="Referral Type">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {REFERRAL_TYPES.map((rt) => (
                <button
                  key={rt}
                  onClick={() => updateField('referralType', rt)}
                  style={
                    form.referralType === rt ? activeToggleStyle : inactiveToggleStyle
                  }
                >
                  {rt}
                </button>
              ))}
            </div>
          </Field>

          {/* Referral Source / Jurisdiction */}
          <div style={rowStyle}>
            <Field label="Referral Source" flex={1}>
              <input
                style={inputStyle}
                value={form.referralSource}
                onChange={(e) => updateField('referralSource', e.target.value)}
                placeholder="Referral source"
              />
            </Field>
            <Field label="Jurisdiction" flex={1}>
              <input
                style={inputStyle}
                value={form.jurisdiction}
                onChange={(e) => updateField('jurisdiction', e.target.value)}
                placeholder="Jurisdiction"
              />
            </Field>
          </div>

          {/* Charges / Attorney / Deadline */}
          <div style={rowStyle}>
            <Field label="Charges" flex={2}>
              <input
                style={inputStyle}
                value={form.charges}
                onChange={(e) => updateField('charges', e.target.value)}
                placeholder="Charges"
              />
            </Field>
            <Field label="Attorney" flex={2}>
              <input
                style={inputStyle}
                value={form.attorney}
                onChange={(e) => updateField('attorney', e.target.value)}
                placeholder="Attorney name"
              />
            </Field>
            <Field label="Report Deadline" flex={2}>
              <input
                type="date"
                style={inputStyle}
                value={form.reportDeadline}
                onChange={(e) => updateField('reportDeadline', e.target.value)}
              />
            </Field>
          </div>

          {/* Presenting Complaint */}
          <Field label="Presenting Complaint">
            <textarea
              style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
              value={form.presentingComplaint}
              onChange={(e) => updateField('presentingComplaint', e.target.value)}
              placeholder="Describe the presenting complaint..."
            />
          </Field>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, paddingTop: 8 }}>
            <button onClick={handleSaveDraft} style={secondaryButtonStyle}>
              Save Draft
            </button>
            <button onClick={handleSubmit} style={primaryButtonStyle}>
              Submit
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* --- Field wrapper --- */

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

const rowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 16,
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
  padding: '6px 10px',
  fontSize: 13,
  color: 'var(--text)',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
}

const activeToggleStyle: React.CSSProperties = {
  background: 'var(--accent)',
  color: '#ffffff',
  border: '1px solid var(--accent)',
  borderRadius: 4,
  padding: '5px 14px',
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const inactiveToggleStyle: React.CSSProperties = {
  background: 'var(--panel)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  padding: '5px 14px',
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
  fontFamily: 'inherit',
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
