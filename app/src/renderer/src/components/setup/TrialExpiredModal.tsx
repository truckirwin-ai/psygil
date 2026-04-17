/**
 * TrialExpiredModal, blocks app access when a trial license has expired.
 *
 * Rendered by App.tsx when setup:checkLicenseExpiry returns expired: true.
 * The user can enter a paid license key to unlock, or quit the app.
 * Re-entering a trial key is rejected (tier === 'trial' with a past
 * expiresAt still fails the expiry check on next launch).
 */

import { useCallback, useState } from 'react'
import { isOk, isErr } from '../../../../shared/types/ipc'

interface TrialExpiredModalProps {
  readonly expiresAt: string
  readonly onUnlocked: () => void
}

export default function TrialExpiredModal({
  expiresAt,
  onUnlocked,
}: TrialExpiredModalProps): React.JSX.Element {
  const [licenseKey, setLicenseKey] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const expDate = new Date(expiresAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const handleActivate = useCallback(async () => {
    const key = licenseKey.trim()
    if (key.length === 0) {
      setError('Enter a license key.')
      return
    }

    setBusy(true)
    setError(null)

    try {
      // Validate the new key.
      const validateResp = await window.psygil.setup.validateLicense({ key })
      if (!isOk(validateResp)) {
        setBusy(false)
        setError(isErr(validateResp) ? validateResp.message : 'Validation failed.')
        return
      }
      const validation = validateResp.data
      if (!validation.ok || validation.license === null) {
        setBusy(false)
        setError(validation.errorMessage ?? 'License rejected.')
        return
      }

      // Block re-entry of a trial key (it would just expire again).
      if (validation.license.tier === 'trial') {
        setBusy(false)
        setError('Trial keys cannot be reused after expiration. Enter a paid license key (solo, practice, or enterprise).')
        return
      }

      // Persist the new license.
      const saveResp = await window.psygil.setup.saveLicense({
        license: validation.license,
      })
      if (!isOk(saveResp)) {
        setBusy(false)
        setError(isErr(saveResp) ? saveResp.message : 'Could not save license.')
        return
      }

      onUnlocked()
    } catch (e: unknown) {
      setBusy(false)
      setError(e instanceof Error ? e.message : 'Activation failed.')
    }
  }, [licenseKey, onUnlocked])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="trial-expired-title"
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
          maxWidth: 480,
          background: 'var(--panel)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '32px',
          boxShadow: '0 4px 20px color-mix(in srgb, var(--text) 15%, transparent)',
        }}
      >
        <h1
          id="trial-expired-title"
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 600,
            color: 'var(--text)',
          }}
        >
          Trial Expired
        </h1>
        <p
          style={{
            marginTop: 12,
            marginBottom: 8,
            fontSize: 14,
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
          }}
        >
          Your 10-day Psygil trial ended on {expDate}. Enter a paid license key
          to continue using the app. Your cases and data are preserved; they
          will be accessible as soon as a valid key is activated.
        </p>

        <div style={{ marginTop: 20 }}>
          <label
            style={{
              display: 'block',
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text)',
              marginBottom: 6,
            }}
          >
            License key
          </label>
          <input
            type="text"
            value={licenseKey}
            onChange={(e) => {
              setLicenseKey(e.target.value)
              setError(null)
            }}
            placeholder="PSGIL-SOLO1-XXXXX-XXXXX-XXXXX"
            disabled={busy}
            autoFocus
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            style={{
              width: '100%',
              padding: '8px 10px',
              fontSize: 14,
              fontFamily: 'Consolas, monospace',
              background: 'var(--field-bg)',
              color: 'var(--field-text)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {error !== null && (
          <div
            role="alert"
            style={{
              marginTop: 16,
              padding: '10px 12px',
              borderRadius: 4,
              background: 'color-mix(in srgb, var(--danger) 10%, transparent)',
              border: '1px solid var(--danger)',
              color: 'var(--danger)',
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        <div
          style={{
            marginTop: 24,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <button
            type="button"
            onClick={() => window.close()}
            disabled={busy}
            style={{
              padding: '8px 16px',
              fontSize: 14,
              background: 'var(--panel)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            Quit
          </button>
          <button
            type="button"
            onClick={() => void handleActivate()}
            disabled={busy}
            style={{
              padding: '8px 20px',
              fontSize: 14,
              fontWeight: 600,
              background: 'var(--accent)',
              color: 'var(--field-bg)',
              border: '1px solid var(--accent)',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            {busy ? 'Activating...' : 'Activate'}
          </button>
        </div>

        <p
          style={{
            marginTop: 20,
            fontSize: 11,
            color: 'var(--text-secondary)',
            textAlign: 'center',
          }}
        >
          Contact sales@foundrysmb.com for licensing questions.
        </p>
      </div>
    </div>
  )
}
