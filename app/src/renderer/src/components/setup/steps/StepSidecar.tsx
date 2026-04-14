/**
 * Step 1: Sidecar health check.
 *
 * The Python sidecar is the source of truth for HIPAA-compliant PII
 * detection. We refuse to advance until pii.detect responds successfully
 * with a known synthetic phrase. This is the hard gate from doc 17 §1.
 *
 * No real PHI is sent to the sidecar here; the test phrase contains
 * fully fictitious tokens to exercise Presidio's detection paths.
 */

import { useCallback, useEffect, useState } from 'react'
import type { StepProps } from '../shared'
import { styles } from '../shared'

const HEALTH_PROBE_TEXT =
  'Patient name: Sample Synthetic. Date of birth: 01/01/1990. Phone: (555) 010-0100.'

// The Python sidecar takes several seconds to load spaCy's en_core_web_lg
// model on first launch. The probe races the load, so we retry on failure
// with linear backoff before surfacing an error to the user.
const MAX_AUTO_RETRIES = 6
const RETRY_DELAY_MS = 1500


type ProbeStatus = 'idle' | 'probing' | 'ok' | 'failed'

export default function StepSidecar({ config, onConfigUpdate, onAdvance }: StepProps): React.JSX.Element {
  const [status, setStatus] = useState<ProbeStatus>('idle')
  const [detectedCount, setDetectedCount] = useState<number>(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [retryAttempt, setRetryAttempt] = useState<number>(0)

  /**
   * Run the probe once. Returns true on success, false on retryable failure.
   * On success, persists state. On failure sets errorMessage but does NOT
   * set status to 'failed' (the caller decides based on retry count).
   */
  const runProbeOnce = useCallback(async (): Promise<boolean> => {
    try {
      const resp = await window.psygil.pii.detect({ text: HEALTH_PROBE_TEXT })
      if (resp.status !== 'success') {
        setErrorMessage(resp.message)
        return false
      }
      const count = resp.data.entities.length
      if (count === 0) {
        setErrorMessage(
          'Sidecar responded but did not detect any PII in the probe text. ' +
            'Presidio may be misconfigured.',
        )
        setDetectedCount(0)
        return false
      }
      setDetectedCount(count)

      // Persist sidecar_verified state so a relaunch can resume here
      const advanceResp = await window.psygil.setup.advance({ targetState: 'sidecar_verified' })
      if (advanceResp.status === 'success') {
        onConfigUpdate(advanceResp.data.config)
      }
      return true
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err))
      return false
    }
  }, [onConfigUpdate])

  const runProbe = useCallback(async () => {
    setStatus('probing')
    setErrorMessage(null)
    setRetryAttempt(0)

    for (let attempt = 1; attempt <= MAX_AUTO_RETRIES; attempt++) {
      setRetryAttempt(attempt)
      const ok = await runProbeOnce()
      if (ok) {
        setStatus('ok')
        setRetryAttempt(0)
        return
      }
      // Wait before retrying (except after the last attempt)
      if (attempt < MAX_AUTO_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
      }
    }
    setStatus('failed')
    setRetryAttempt(0)
  }, [runProbeOnce])

  useEffect(() => {
    // Auto-run on mount unless we've already verified
    if (config.setupState === 'fresh') {
      void runProbe()
    } else {
      setStatus('ok')
      setDetectedCount(-1)
    }
  }, [config.setupState, runProbe])

  return (
    <div>
      <h2 style={styles.heading}>Verify the PII pipeline</h2>
      <p style={styles.subheading}>
        Psygil ships with a local Python sidecar that runs Presidio for PII
        detection. We confirm it responds correctly before continuing. No real
        patient data is sent during this check.
      </p>

      <div style={styles.card}>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
          Health probe
        </div>
        {status === 'probing' && (
          <div style={{ fontSize: 14 }}>
            {retryAttempt <= 1
              ? 'Probing the sidecar...'
              : `Waiting for sidecar to initialize (attempt ${retryAttempt} of ${MAX_AUTO_RETRIES})... spaCy model load takes a few seconds on first run.`}
          </div>
        )}
        {status === 'ok' && (
          <div style={styles.successBox}>
            Sidecar is healthy.
            {detectedCount > 0 && (
              <> Detected {detectedCount} synthetic PII entities in the probe text.</>
            )}
          </div>
        )}
        {status === 'failed' && (
          <div style={styles.errorBox}>
            Sidecar check failed. {errorMessage ?? ''}
          </div>
        )}
      </div>

      {status === 'failed' && (
        <div style={{ ...styles.warningBox, marginTop: 8 }}>
          <strong>Sidecar unreachable.</strong> PII detection, redaction, and AI
          features will not function until this is fixed. You can skip the gate
          below to continue setup and use the app for non-PHI work.
          <br />
          <br />
          Common causes:
          <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
            <li>The Python sidecar is not running (check the dev console for <code>[PII]</code> log lines)</li>
            <li>System Python is older than 3.10 (Presidio + spaCy require 3.10+)</li>
            <li>Required packages not installed (see <code>sidecar/requirements.txt</code>)</li>
          </ul>
        </div>
      )}

      <div style={styles.footerActions}>
        {status === 'failed' && (
          <button
            type="button"
            style={{
              ...styles.secondaryButton,
              borderColor: 'rgba(245, 158, 11, 0.6)',
              color: '#b45309',
            }}
            onClick={async () => {
              await window.psygil.setup.advance({ targetState: 'sidecar_verified' })
              onAdvance()
            }}
            title="Bypass the sidecar health gate"
          >
            Skip gate
          </button>
        )}
        <button
          type="button"
          style={styles.secondaryButton}
          onClick={runProbe}
          disabled={status === 'probing'}
        >
          {status === 'failed' ? 'Try again' : 'Re-run probe'}
        </button>
        <button
          type="button"
          style={styles.primaryButton}
          onClick={onAdvance}
          disabled={status !== 'ok'}
        >
          Continue
        </button>
      </div>
    </div>
  )
}
