/**
 * Step 2: License activation.
 *
 * Validates the format and tier of a Psygil license key. Local-only in MVP;
 * the validator interface is stable so a real server call can replace it
 * later without changing the wizard.
 */

import { useState } from 'react'
import type { StepProps } from '../shared'
import { styles } from '../shared'

// Development default. Matches the seed solo key in
// services/license-server/server.ts so the in-process verifier and the
// wizard share the same convention. Replace this with a real key in
// production by typing or pasting over it.
const DEFAULT_DEV_KEY = 'PSGIL-SOLO1-ABCDE-12345-XYZ7Q'

export default function StepLicense({
  config,
  onConfigUpdate,
  onAdvance,
}: StepProps): React.JSX.Element {
  const [keyInput, setKeyInput] = useState<string>(DEFAULT_DEV_KEY)
  const [validating, setValidating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [offlineNotice, setOfflineNotice] = useState<boolean>(false)
  const [validationSource, setValidationSource] = useState<'local' | 'remote' | null>(null)

  // If a license is already saved, show a brief summary and let the user
  // re-enter or move on.
  const existing = config.license

  const handleValidate = async (): Promise<void> => {
    setError(null)
    setOfflineNotice(false)
    setValidationSource(null)
    setValidating(true)
    try {
      const validateResp = await window.psygil.setup.validateLicense({ key: keyInput })
      if (validateResp.status !== 'success') {
        setError(validateResp.message)
        setValidating(false)
        return
      }
      const result = validateResp.data
      if (!result.ok || result.license === null) {
        setError(result.errorMessage ?? 'License rejected.')
        setValidating(false)
        return
      }
      // Capture the source so we can show the offline-fallback notice
      setOfflineNotice(result.offlineFallback === true)
      setValidationSource(result.source)

      const saveResp = await window.psygil.setup.saveLicense({ license: result.license })
      if (saveResp.status !== 'success') {
        setError(saveResp.message)
        setValidating(false)
        return
      }
      onConfigUpdate(saveResp.data.config)
      setValidating(false)
      // If we fell back to local, hold for user acknowledgment instead
      // of advancing automatically. They click Continue to move on.
      if (result.offlineFallback !== true) {
        onAdvance()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setValidating(false)
    }
  }

  return (
    <div>
      <h2 style={styles.heading}>Activate your license</h2>
      <p style={styles.subheading}>
        Enter the 25-character license key from your Psygil welcome email.
        The format is PSGIL-XXXXX-XXXXX-XXXXX-XXXXX. Validation runs locally
        in the MVP and never contacts a remote server.
      </p>

      {existing !== null && (
        <div style={styles.successBox}>
          License is active. Tier: {existing.tier}, seats: {existing.seats}.
        </div>
      )}

      {offlineNotice && (
        <div style={styles.warningBox}>
          <strong>Validated offline.</strong> The license server could not be
          reached, so we accepted the key against the local format check. The
          app will retry validation against the server on next launch and on
          every connection. You have a 14-day grace period from today.
        </div>
      )}

      {validationSource === 'remote' && !offlineNotice && existing !== null && (
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 12 }}>
          Verified against the Psygil license server.
        </div>
      )}

      {error !== null && <div style={styles.errorBox}>{error}</div>}

      <div style={styles.fieldRow}>
        <label style={styles.fieldLabel} htmlFor="license-key">
          License key
        </label>
        <input
          id="license-key"
          type="text"
          value={keyInput}
          onChange={(e) => setKeyInput(e.target.value)}
          placeholder="PSGIL-XXXXX-XXXXX-XXXXX-XXXXX"
          autoComplete="off"
          spellCheck={false}
          style={{ ...styles.input, fontFamily: 'ui-monospace, SFMono-Regular, monospace', textTransform: 'uppercase' }}
        />
      </div>

      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
        The field is pre-filled with the development solo key{' '}
        <code>{DEFAULT_DEV_KEY}</code>. Replace it with a real key in
        production. Other dev keys you can try:
        <ul style={{ margin: '4px 0 0 18px', padding: 0 }}>
          <li>
            <code>PSGIL-PRAC1-SEAT5-ABCDE-12345</code> (practice, 5 seats)
          </li>
          <li>
            <code>PSGIL-ENTR1-ABCDE-12345-67890</code> (enterprise, 25 seats)
          </li>
          <li>
            <code>PSGIL-SOLO2-EXPIR-EDKEY-00001</code> (expired, for testing)
          </li>
          <li>
            <code>PSGIL-SOLO3-REVOK-EDKEY-00002</code> (revoked, for testing)
          </li>
        </ul>
      </div>

      <div style={styles.footerActions}>
        <button
          type="button"
          style={styles.primaryButton}
          onClick={handleValidate}
          disabled={validating || keyInput.trim().length === 0}
        >
          {validating ? 'Validating...' : existing !== null ? 'Replace key' : 'Activate'}
        </button>
        {(existing !== null || offlineNotice) && (
          <button
            type="button"
            style={styles.secondaryButton}
            onClick={onAdvance}
          >
            Continue
          </button>
        )}
      </div>
    </div>
  )
}
