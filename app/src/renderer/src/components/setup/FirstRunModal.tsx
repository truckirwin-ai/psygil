/**
 * FirstRunModal, minimal first-launch setup prompt.
 *
 * Replaces the Auth0 LoginGate and the first three steps of the 8-step
 * setup wizard. Collects the absolute minimum needed to open the main
 * app:
 *
 *   1. Clinician name (used as the stamp on every clinical decision).
 *   2. License key (validated locally plus remote with offline fallback).
 *   3. Storage folder (local path, validated and provisioned).
 *
 * AI configuration, theme, clinical preferences, templates, and optional
 * shared-storage / team-account settings are configured post-first-run
 * via Settings. This keeps the cold-start path short and never depends
 * on an external browser round trip.
 */

import { useCallback, useEffect, useState } from 'react'
import { isErr, isOk } from '../../../../shared/types/ipc'
import type {
  LicenseValidationResult,
  StorageValidationResult,
} from '../../../../shared/types/setup'

interface FirstRunModalProps {
  /** Called once setup is complete and the main shell should render. */
  readonly onComplete: () => void
}

type Step = 'enter' | 'submitting' | 'error'

interface FormState {
  readonly fullName: string
  readonly licenseKey: string
  readonly storagePath: string
}

const EMPTY_FORM: FormState = {
  fullName: '',
  licenseKey: '',
  storagePath: '',
}

export default function FirstRunModal({ onComplete }: FirstRunModalProps): React.JSX.Element {
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [step, setStep] = useState<Step>('enter')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [storageWarning, setStorageWarning] = useState<string | null>(null)

  // Prefill the storage path with the OS default (~/Documents/Psygil Cases).
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const resp = await window.psygil.setup.getDefaultStoragePath()
        if (cancelled) return
        if (isOk(resp)) {
          setForm((prev) => (prev.storagePath === '' ? { ...prev, storagePath: resp.data.path } : prev))
        }
      } catch {
        // Non-fatal: user can type or browse manually.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const updateField = useCallback(
    <K extends keyof FormState>(field: K, value: FormState[K]) => {
      setForm((prev) => ({ ...prev, [field]: value }))
      setErrorMessage(null)
    },
    [],
  )

  const browseStorageFolder = useCallback(async () => {
    setErrorMessage(null)
    setStorageWarning(null)
    try {
      const resp = await window.psygil.setup.pickStorageFolder()
      if (isOk(resp) && resp.data.path !== null) {
        setForm((prev) => ({ ...prev, storagePath: resp.data.path as string }))
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Folder picker failed'
      setErrorMessage(message)
    }
  }, [])

  const submit = useCallback(async () => {
    const fullName = form.fullName.trim()
    const licenseKey = form.licenseKey.trim()
    const storagePath = form.storagePath.trim()

    if (fullName.length < 2) {
      setErrorMessage('Enter your name as it should appear on reports.')
      return
    }
    if (licenseKey.length === 0) {
      setErrorMessage('Enter your license key.')
      return
    }
    if (storagePath.length === 0) {
      setErrorMessage('Pick a folder for your cases.')
      return
    }

    setStep('submitting')
    setErrorMessage(null)

    try {
      // 1. Validate license (local first, remote with offline fallback).
      const validateResp = await window.psygil.setup.validateLicense({ key: licenseKey })
      if (!isOk(validateResp)) {
        const message = isErr(validateResp) ? validateResp.message : 'License validation failed'
        setStep('enter')
        setErrorMessage(message)
        return
      }
      const validation: LicenseValidationResult = validateResp.data
      if (!validation.ok || validation.license === null) {
        setStep('enter')
        setErrorMessage(validation.errorMessage ?? 'License rejected.')
        return
      }

      // 2. Persist license.
      const saveLicenseResp = await window.psygil.setup.saveLicense({
        license: validation.license,
      })
      if (!isOk(saveLicenseResp)) {
        const message = isErr(saveLicenseResp)
          ? saveLicenseResp.message
          : 'Could not save license'
        setStep('enter')
        setErrorMessage(message)
        return
      }

      // 3. Validate storage path.
      const storageResp = await window.psygil.setup.validateStoragePath({ path: storagePath })
      if (!isOk(storageResp)) {
        const message = isErr(storageResp) ? storageResp.message : 'Storage validation failed'
        setStep('enter')
        setErrorMessage(message)
        return
      }
      const storageValidation: StorageValidationResult = storageResp.data
      if (!storageValidation.ok) {
        const firstError = storageValidation.errors[0]?.message ?? 'Folder is not usable.'
        setStep('enter')
        setErrorMessage(firstError)
        return
      }
      const cloudWarning = storageValidation.warnings.find((w) => w.code === 'CLOUD_SYNC_FOLDER')
      if (cloudWarning !== undefined) {
        setStorageWarning(cloudWarning.message)
      }

      // 4. Provision storage (creates cases/, _Resources/, etc.).
      const provisionResp = await window.psygil.setup.provisionStorage({
        path: storageValidation.normalizedPath,
        cloudSyncWarningAcknowledged: true,
      })
      if (!isOk(provisionResp)) {
        const message = isErr(provisionResp)
          ? provisionResp.message
          : 'Could not provision storage folder'
        setStep('enter')
        setErrorMessage(message)
        return
      }

      // 5. Save practice info (name is the only required field for the
      //    minimum path; everything else is edited later in Settings).
      const practiceResp = await window.psygil.setup.savePractice({
        practice: {
          fullName,
          credentials: '',
          licenseNumber: '',
          licenseState: '',
          specialty: 'forensic',
          practiceName: null,
          npi: null,
          practiceAddress: null,
          phone: null,
          logoRelPath: null,
        },
      })
      if (!isOk(practiceResp)) {
        const message = isErr(practiceResp) ? practiceResp.message : 'Could not save your name'
        setStep('enter')
        setErrorMessage(message)
        return
      }

      // 6. Mark setup complete. Everything else (AI key, theme, templates,
      //    clinical prefs, shared storage / team) is optional and lives in
      //    Settings post-first-run.
      const completeResp = await window.psygil.setup.complete()
      if (!isOk(completeResp)) {
        const message = isErr(completeResp) ? completeResp.message : 'Could not finalize setup'
        setStep('enter')
        setErrorMessage(message)
        return
      }

      onComplete()
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Setup failed'
      setStep('enter')
      setErrorMessage(message)
    }
  }, [form, onComplete])

  const busy = step === 'submitting'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="first-run-title"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 520,
          background: 'var(--panel)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '32px',
          boxShadow: '0 4px 20px color-mix(in srgb, var(--text) 15%, transparent)',
        }}
      >
        <h1
          id="first-run-title"
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 600,
            color: 'var(--text)',
          }}
        >
          Welcome to Psygil
        </h1>
        <p
          style={{
            marginTop: 8,
            marginBottom: 24,
            fontSize: 14,
            color: 'var(--text-secondary)',
          }}
        >
          Three items to set up, then you can open your first case. Everything
          else is editable later in Settings.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Field
            label="Your name"
            hint="Used as the stamp on every clinical decision and on report signature lines."
          >
            <input
              type="text"
              value={form.fullName}
              onChange={(e) => updateField('fullName', e.target.value)}
              placeholder="e.g. Dr. Robert Irwin"
              disabled={busy}
              autoFocus
              style={inputStyle}
            />
          </Field>

          <Field
            label="License key"
            hint="Provided by Foundry SMB at purchase. Validates offline; contacts licenses.psygil.com when online."
          >
            <input
              type="text"
              value={form.licenseKey}
              onChange={(e) => updateField('licenseKey', e.target.value)}
              placeholder="PSYGIL-XXXX-XXXX-XXXX-XXXX"
              disabled={busy}
              style={{ ...inputStyle, fontFamily: 'Consolas, monospace' }}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
            />
          </Field>

          <Field
            label="Local storage folder"
            hint="Where your case files live on this machine. Pick a folder on a local drive; cloud-sync folders (Dropbox, iCloud, OneDrive) are not supported for v1.0."
          >
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={form.storagePath}
                onChange={(e) => updateField('storagePath', e.target.value)}
                placeholder="/Users/you/Documents/Psygil Cases"
                disabled={busy}
                style={{ ...inputStyle, flex: 1 }}
                spellCheck={false}
              />
              <button
                type="button"
                onClick={browseStorageFolder}
                disabled={busy}
                style={secondaryButtonStyle}
              >
                Browse...
              </button>
            </div>
            {storageWarning !== null && (
              <div
                role="note"
                style={{
                  marginTop: 8,
                  fontSize: 12,
                  color: 'var(--warn)',
                }}
              >
                Warning: {storageWarning}
              </div>
            )}
          </Field>
        </div>

        {errorMessage !== null && (
          <div
            role="alert"
            style={{
              marginTop: 20,
              padding: '10px 12px',
              borderRadius: 4,
              background: 'color-mix(in srgb, var(--danger) 10%, transparent)',
              border: '1px solid var(--danger)',
              color: 'var(--danger)',
              fontSize: 13,
            }}
          >
            {errorMessage}
          </div>
        )}

        <div
          style={{
            marginTop: 28,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Shared storage and team accounts are set up later in Settings.
          </span>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy}
            style={primaryButtonStyle}
          >
            {busy ? 'Setting up...' : 'Get started'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Field wrapper
// ---------------------------------------------------------------------------

interface FieldProps {
  readonly label: string
  readonly hint: string
  readonly children: React.ReactNode
}

function Field({ label, hint, children }: FieldProps): React.JSX.Element {
  return (
    <div>
      <label
        style={{
          display: 'block',
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--text)',
          marginBottom: 4,
        }}
      >
        {label}
      </label>
      {children}
      <div
        style={{
          marginTop: 6,
          fontSize: 11,
          color: 'var(--text-secondary)',
          lineHeight: 1.4,
        }}
      >
        {hint}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  fontSize: 14,
  background: 'var(--field-bg)',
  color: 'var(--field-text)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  outline: 'none',
  boxSizing: 'border-box',
}

const primaryButtonStyle: React.CSSProperties = {
  padding: '8px 20px',
  fontSize: 14,
  fontWeight: 600,
  background: 'var(--accent)',
  color: 'var(--field-bg)',
  border: '1px solid var(--accent)',
  borderRadius: 4,
  cursor: 'pointer',
}

const secondaryButtonStyle: React.CSSProperties = {
  padding: '8px 14px',
  fontSize: 14,
  background: 'var(--panel)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}
