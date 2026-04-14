/**
 * Step 5: AI configuration + UNID pipeline verification.
 *
 * Optional step. The user can skip AI entirely and the app remains fully
 * functional for manual editing. If they enter a key, three things must
 * happen successfully before we advance:
 *  1. Store the API key in the OS keychain (window.psygil.apiKey.store)
 *  2. Test the connection (window.psygil.ai.testConnection)
 *  3. Verify the UNID pipeline end-to-end (redact -> rehydrate -> destroy)
 *
 * Step 3 is the HIPAA hard gate from doc 17 §5.
 */

import { useState } from 'react'
import type { StepProps } from '../shared'
import { styles } from '../shared'
import type { AiConfig } from '../../../../../shared/types/setup'

const ANTHROPIC_MODELS: readonly { value: string; label: string }[] = [
  { value: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4 (recommended)' },
  { value: 'claude-opus-4-5-20250929', label: 'Claude Opus 4' },
  { value: 'claude-haiku-4-5-20250929', label: 'Claude Haiku 4' },
]

const UNID_PROBE_TEXT =
  'Patient Sample Synthetic, born 01/01/1990, was evaluated on April 1, 2026 ' +
  'at 1234 Main Street, Denver, CO. Phone: (555) 010-0100. ' +
  'Examiner: Dr. Synthetic Examiner.'

type GateStatus = 'idle' | 'storing' | 'testing' | 'verifying' | 'ok' | 'failed'

export default function StepAi({
  config,
  onConfigUpdate,
  onAdvance,
}: StepProps): React.JSX.Element {
  const [provider, setProvider] = useState<'anthropic' | 'openai'>(
    config.ai?.provider ?? 'anthropic',
  )
  const [model, setModel] = useState<string>(config.ai?.model ?? ANTHROPIC_MODELS[0]!.value)
  const [apiKey, setApiKey] = useState<string>('')
  const [status, setStatus] = useState<GateStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [verifiedDetail, setVerifiedDetail] = useState<string | null>(null)

  const runFullGate = async (): Promise<void> => {
    setError(null)
    setVerifiedDetail(null)

    // 1. Store key
    setStatus('storing')
    const storeResp = await window.psygil.apiKey.store({ key: apiKey })
    if (storeResp.status !== 'success') {
      setStatus('failed')
      setError(`Failed to store API key: ${storeResp.message}`)
      return
    }

    // 2. Test connection
    setStatus('testing')
    const testResp = await window.psygil.ai.testConnection({})
    if (testResp.status !== 'success') {
      setStatus('failed')
      setError(`Connection test failed: ${testResp.message}`)
      return
    }

    // 3. UNID round-trip, uses an in-memory operationId per doc 15
    setStatus('verifying')
    const operationId = `setup-verify-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const redactResp = await window.psygil.pii.redact({
      text: UNID_PROBE_TEXT,
      operationId,
      context: 'review',
    })
    if (redactResp.status !== 'success') {
      setStatus('failed')
      setError(`Redact failed: ${redactResp.message}`)
      return
    }
    const { redactedText, entityCount } = redactResp.data
    if (entityCount === 0) {
      setStatus('failed')
      setError('UNID redact returned 0 entities. Pipeline misconfigured.')
      return
    }

    const rehydrateResp = await window.psygil.pii.rehydrate({
      text: redactedText,
      operationId,
    })
    if (rehydrateResp.status !== 'success') {
      setStatus('failed')
      setError(`Rehydrate failed: ${rehydrateResp.message}`)
      return
    }

    // The sidecar implements single-use UNID maps: a successful rehydrate
    // automatically destroys the map. We verify that by calling destroy and
    // expecting either {destroyed: true} (if the implementation defers
    // destruction) or {destroyed: false} (if rehydrate already removed it).
    // Both are acceptable. The HIPAA invariant we care about is that the
    // map is GONE after this point, so we then attempt a second rehydrate
    // and verify it fails, proving the map is unrecoverable.
    const destroyResp = await window.psygil.pii.destroy({ operationId })
    if (destroyResp.status !== 'success') {
      setStatus('failed')
      setError(`Destroy failed: ${destroyResp.message}`)
      return
    }

    // Sanity check: a second rehydrate with the same operationId must
    // replace ZERO unids, because the map is gone. The RPC call itself
    // succeeds (the sidecar returns the input unchanged), but the
    // unidsReplaced counter is the actual leak signal.
    const recheckResp = await window.psygil.pii.rehydrate({
      text: redactedText,
      operationId,
    })
    if (recheckResp.status === 'success' && recheckResp.data.unidsReplaced > 0) {
      setStatus('failed')
      setError(
        'UNID map still rehydrates after destroy. Aborting for HIPAA safety. ' +
          'The PII sidecar is leaking single-use maps and must be fixed.',
      )
      return
    }

    // 4. Persist AI config
    const ai: AiConfig = {
      provider,
      model,
      configured: true,
      verifiedAt: new Date().toISOString(),
    }
    const saveResp = await window.psygil.setup.saveAi({ ai })
    if (saveResp.status !== 'success') {
      setStatus('failed')
      setError(saveResp.message)
      return
    }
    onConfigUpdate(saveResp.data.config)
    setStatus('ok')
    setVerifiedDetail(
      `${entityCount} synthetic PHI entities redacted, rehydrated, and the UNID map was destroyed.`,
    )
  }

  const handleSkip = async (): Promise<void> => {
    setError(null)
    const ai: AiConfig = {
      provider: null,
      model: null,
      configured: false,
      verifiedAt: null,
    }
    const resp = await window.psygil.setup.saveAi({ ai })
    if (resp.status !== 'success') {
      setError(resp.message)
      return
    }
    onConfigUpdate(resp.data.config)
    onAdvance()
  }

  const busy = status === 'storing' || status === 'testing' || status === 'verifying'

  return (
    <div>
      <h2 style={styles.heading}>Connect your AI assistant</h2>
      <p style={styles.subheading}>
        AI features are optional. You can use Psygil without one. If you enter
        an API key, we test the connection and verify that the UNID redaction
        pipeline removes PHI before any text leaves this machine.
      </p>

      {error !== null && <div style={styles.errorBox}>{error}</div>}
      {status === 'ok' && verifiedDetail !== null && (
        <div style={styles.successBox}>
          UNID pipeline verified. {verifiedDetail}
        </div>
      )}

      <div style={styles.fieldGrid2}>
        <div>
          <label style={styles.fieldLabel}>Provider</label>
          <select
            style={styles.input}
            value={provider}
            onChange={(e) => setProvider(e.target.value as 'anthropic' | 'openai')}
          >
            <option value="anthropic">Anthropic (recommended)</option>
            <option value="openai">OpenAI</option>
          </select>
        </div>
        <div>
          <label style={styles.fieldLabel}>Model</label>
          <select
            style={styles.input}
            value={model}
            onChange={(e) => setModel(e.target.value)}
          >
            {ANTHROPIC_MODELS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={styles.fieldRow}>
        <label style={styles.fieldLabel}>API key</label>
        <input
          style={{ ...styles.input, fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-ant-..."
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>
        The key is encrypted with the OS keychain. It is never written to
        config files or logs. The connection test sends a minimal prompt
        with no patient data.
      </div>

      {busy && (
        <div style={{ ...styles.card, marginTop: 16 }}>
          <div style={{ fontSize: 13 }}>
            {status === 'storing' && 'Storing the key in the OS keychain...'}
            {status === 'testing' && 'Sending a minimal test prompt...'}
            {status === 'verifying' && 'Running the UNID pipeline end-to-end...'}
          </div>
        </div>
      )}

      <div style={styles.footerActions}>
        <button type="button" style={styles.secondaryButton} onClick={handleSkip}>
          Skip for now
        </button>
        <button
          type="button"
          style={styles.primaryButton}
          onClick={status === 'ok' ? onAdvance : runFullGate}
          disabled={busy || (status !== 'ok' && apiKey.trim().length === 0)}
        >
          {busy
            ? 'Working...'
            : status === 'ok'
              ? 'Continue'
              : 'Test and save'}
        </button>
      </div>
    </div>
  )
}
