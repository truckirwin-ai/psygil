/**
 * Step 3: Storage configuration.
 *
 * Picks a folder for the project root, validates it, surfaces cloud-sync
 * warnings, and provisions the directory structure on the main process.
 *
 * Hard rules from doc 17:
 *  - Cloud-sync warning must be acknowledged before provisioning
 *  - System directories are blocked
 *  - Parent directory must exist and be writable
 */

import { useEffect, useState } from 'react'
import type { StepProps } from '../shared'
import { styles } from '../shared'
import type { StorageValidationResult } from '../../../../../shared/types/setup'

export default function StepStorage({
  config,
  onConfigUpdate,
  onAdvance,
}: StepProps): React.JSX.Element {
  const [path, setPath] = useState<string>(config.storage?.projectRoot ?? '')
  const [validation, setValidation] = useState<StorageValidationResult | null>(null)
  const [acknowledgedCloud, setAcknowledgedCloud] = useState(false)
  const [provisioning, setProvisioning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Pre-fill with the OS default if no path is set
  useEffect(() => {
    let cancelled = false
    if (path !== '') return
    void (async () => {
      const resp = await window.psygil.setup.getDefaultStoragePath()
      if (cancelled) return
      if (resp.status === 'success') setPath(resp.data.path)
    })()
    return () => {
      cancelled = true
    }
  }, [path])

  // Validate whenever the path changes
  useEffect(() => {
    let cancelled = false
    if (path.trim() === '') {
      setValidation(null)
      return
    }
    void (async () => {
      const resp = await window.psygil.setup.validateStoragePath({ path })
      if (cancelled) return
      if (resp.status === 'success') {
        setValidation(resp.data)
      } else {
        setValidation(null)
        setError(resp.message)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [path])

  const handlePick = async (): Promise<void> => {
    setError(null)
    const resp = await window.psygil.setup.pickStorageFolder()
    if (resp.status === 'success' && resp.data.path !== null) {
      setPath(resp.data.path)
      setAcknowledgedCloud(false)
    }
  }

  const handleProvision = async (): Promise<void> => {
    setError(null)
    setProvisioning(true)
    try {
      const resp = await window.psygil.setup.provisionStorage({
        path,
        cloudSyncWarningAcknowledged: acknowledgedCloud,
      })
      if (resp.status !== 'success') {
        setError(resp.message)
        setProvisioning(false)
        return
      }
      onConfigUpdate(resp.data.config)
      setProvisioning(false)
      onAdvance()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setProvisioning(false)
    }
  }

  const cloudWarning = validation?.warnings.find((w) => w.code === 'CLOUD_SYNC_FOLDER')
  const hasErrors = validation !== null && validation.errors.length > 0
  const canProvision =
    validation !== null &&
    !hasErrors &&
    (cloudWarning === undefined || acknowledgedCloud)

  return (
    <div>
      <h2 style={styles.heading}>Choose where to store your case files</h2>
      <p style={styles.subheading}>
        Psygil creates a project root with subfolders for cases, templates,
        and reference materials. The encrypted database lives inside this
        folder. We recommend a local-only path that is not synced by iCloud,
        Dropbox, OneDrive, or Google Drive.
      </p>

      {error !== null && <div style={styles.errorBox}>{error}</div>}

      <div style={styles.fieldRow}>
        <label style={styles.fieldLabel} htmlFor="storage-path">
          Project root
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            id="storage-path"
            type="text"
            value={path}
            onChange={(e) => {
              setPath(e.target.value)
              setAcknowledgedCloud(false)
            }}
            style={{ ...styles.input, flex: 1 }}
            spellCheck={false}
          />
          <button type="button" style={styles.secondaryButton} onClick={handlePick}>
            Choose...
          </button>
        </div>
      </div>

      {validation !== null && validation.errors.length > 0 && (
        <div style={styles.errorBox}>
          {validation.errors.map((e) => (
            <div key={e.code}>{e.message}</div>
          ))}
        </div>
      )}

      {cloudWarning !== undefined && (
        <div style={styles.warningBox}>
          <div style={{ marginBottom: 8 }}>{cloudWarning.message}</div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={acknowledgedCloud}
              onChange={(e) => setAcknowledgedCloud(e.target.checked)}
            />
            I understand the risk and want to use this folder anyway.
          </label>
        </div>
      )}

      {validation?.warnings.find((w) => w.code === 'PATH_NOT_EMPTY') !== undefined && (
        <div style={styles.warningBox}>
          This folder already contains files. Setup will create the Psygil
          structure alongside them.
        </div>
      )}

      {validation?.warnings.find((w) => w.code === 'LOW_DISK_SPACE') !== undefined && (
        <div style={styles.warningBox}>
          Less than 500 MB free at the parent directory. Consider a different location.
        </div>
      )}

      {validation !== null && !hasErrors && cloudWarning === undefined && (
        <div style={styles.successBox}>Path looks good.</div>
      )}

      <div style={styles.footerActions}>
        <button
          type="button"
          style={styles.primaryButton}
          onClick={handleProvision}
          disabled={!canProvision || provisioning}
        >
          {provisioning ? 'Creating folders...' : 'Create project root'}
        </button>
      </div>
    </div>
  )
}
