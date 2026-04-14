// =============================================================================
// Storage Path Validation, cloud-sync detection, write permissions, space
// Source of truth: docs/engineering/17_Setup_Workflow_Spec.md §"Storage Configuration"
// =============================================================================
//
// Rules enforced:
//  1. Path must be absolute
//  2. Parent directory must exist and be writable
//  3. Warn if inside a known cloud-sync folder (iCloud, OneDrive, Dropbox, Google Drive, Box)
//  4. Refuse system directories (/, /etc, C:\Windows, etc.)
//  5. Warn if less than 500 MB free
//  6. Refuse paths containing parent-directory traversal segments
// =============================================================================

import { statSync, accessSync, constants, existsSync, mkdirSync, writeFileSync, unlinkSync, realpathSync } from 'fs'
import { isAbsolute, normalize, resolve, sep } from 'path'
import { homedir, platform, tmpdir } from 'os'

const MIN_FREE_BYTES = 500 * 1024 * 1024 // 500 MB

export type StorageWarningCode =
  | 'CLOUD_SYNC_FOLDER'
  | 'LOW_DISK_SPACE'
  | 'PATH_NOT_EMPTY'

export type StorageErrorCode =
  | 'INVALID_PATH'
  | 'PATH_TRAVERSAL'
  | 'SYSTEM_DIRECTORY'
  | 'NOT_ABSOLUTE'
  | 'PARENT_MISSING'
  | 'NOT_WRITABLE'
  | 'NOT_A_DIRECTORY'

export interface StorageValidationResult {
  readonly ok: boolean
  readonly normalizedPath: string
  readonly errors: readonly { code: StorageErrorCode; message: string }[]
  readonly warnings: readonly { code: StorageWarningCode; message: string }[]
}

// ---------------------------------------------------------------------------
// Cloud sync folder detection
// ---------------------------------------------------------------------------

interface CloudFolderPattern {
  readonly name: string
  readonly matches: (normalizedPath: string) => boolean
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function getCloudFolderPatterns(): readonly CloudFolderPattern[] {
  const home = homedir()
  const osPlatform = platform()
  const patterns: CloudFolderPattern[] = [
    {
      name: 'iCloud Drive',
      matches: (p) =>
        p.includes(`${sep}Library${sep}Mobile Documents${sep}com~apple~CloudDocs`) ||
        p.includes(`${sep}iCloud Drive${sep}`) ||
        p.endsWith(`${sep}iCloud Drive`),
    },
    {
      name: 'Dropbox',
      matches: (p) =>
        p.startsWith(`${home}${sep}Dropbox`) ||
        p.includes(`${sep}Dropbox${sep}`) ||
        p.endsWith(`${sep}Dropbox`),
    },
    {
      name: 'Google Drive',
      matches: (p) =>
        p.startsWith(`${home}${sep}Google Drive`) ||
        p.includes(`${sep}Google Drive${sep}`) ||
        p.endsWith(`${sep}Google Drive`) ||
        p.includes(`${sep}GoogleDrive${sep}`),
    },
    {
      name: 'OneDrive',
      matches: (p) =>
        p.startsWith(`${home}${sep}OneDrive`) ||
        p.includes(`${sep}OneDrive${sep}`) ||
        p.endsWith(`${sep}OneDrive`) ||
        new RegExp(`${escapeRegex(sep)}OneDrive - `, 'i').test(p),
    },
    {
      name: 'Box',
      matches: (p) =>
        p.startsWith(`${home}${sep}Box`) ||
        p.includes(`${sep}Box${sep}`) ||
        p.includes(`${sep}Box Sync${sep}`),
    },
  ]
  // On Windows, OneDrive may redirect the Documents folder. We cannot reliably
  // detect that from path alone; the pattern above catches the common case.
  if (osPlatform === 'win32') {
    // No-op: the generic patterns above handle Windows OneDrive paths too.
  }
  return patterns
}

function detectCloudFolder(path: string): string | null {
  const norm = normalize(path)
  for (const pattern of getCloudFolderPatterns()) {
    if (pattern.matches(norm)) return pattern.name
  }
  return null
}

// ---------------------------------------------------------------------------
// System directory detection
// ---------------------------------------------------------------------------

const POSIX_SYSTEM_PREFIXES: readonly string[] = [
  '/etc',
  '/usr',
  '/bin',
  '/sbin',
  '/var',
  '/System',
  '/Library',
  '/private',
  '/dev',
  '/proc',
  '/sys',
]

const WIN32_SYSTEM_PREFIXES: readonly string[] = [
  'C:\\Windows',
  'C:\\Program Files',
  'C:\\Program Files (x86)',
  'C:\\ProgramData',
]

function isUnderOsTmpdir(path: string): boolean {
  const candidates: string[] = [tmpdir()]
  try {
    candidates.push(realpathSync(tmpdir()))
  } catch {
    // ignore
  }
  return candidates.some((root) => path === root || path.startsWith(`${root}${sep}`))
}

function isSystemDirectory(path: string): boolean {
  const norm = normalize(path)
  // The OS tmpdir is a legal scratch location even though it may live under
  // /var or /private. Carve it out before the system-prefix check so tests
  // and developer flows can provision temporary project roots.
  if (isUnderOsTmpdir(norm)) return false
  if (platform() === 'win32') {
    return WIN32_SYSTEM_PREFIXES.some((p) =>
      norm.toLowerCase().startsWith(p.toLowerCase()),
    )
  }
  // Refuse root filesystem
  if (norm === '/' || norm === sep) return true
  return POSIX_SYSTEM_PREFIXES.some((p) => norm === p || norm.startsWith(`${p}${sep}`))
}

// ---------------------------------------------------------------------------
// Free disk space, best effort, non-fatal if unavailable
// ---------------------------------------------------------------------------

function getFreeSpace(path: string): number | null {
  try {
    // statfs is Node 19+. Fall back to null if not available.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('fs') as typeof import('fs') & {
      statfsSync?: (p: string) => { bavail: bigint; bsize: bigint }
    }
    if (typeof fs.statfsSync !== 'function') return null
    const stats = fs.statfsSync(path)
    return Number(stats.bavail * stats.bsize)
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Main validation
// ---------------------------------------------------------------------------

/**
 * Validate a proposed storage path. Returns a structured result with errors
 * (blocking) and warnings (non-blocking, user must acknowledge).
 *
 * The path does NOT need to exist yet, we only require that its parent
 * directory exists and is writable, since setup will create the leaf.
 */
export function validateStoragePath(inputPath: string): StorageValidationResult {
  const errors: { code: StorageErrorCode; message: string }[] = []
  const warnings: { code: StorageWarningCode; message: string }[] = []

  if (typeof inputPath !== 'string' || inputPath.trim() === '') {
    return {
      ok: false,
      normalizedPath: '',
      errors: [{ code: 'INVALID_PATH', message: 'Path is empty.' }],
      warnings: [],
    }
  }

  const trimmed = inputPath.trim()

  if (!isAbsolute(trimmed)) {
    errors.push({ code: 'NOT_ABSOLUTE', message: 'Path must be absolute.' })
  }

  if (trimmed.includes('..')) {
    errors.push({
      code: 'PATH_TRAVERSAL',
      message: 'Path contains parent-directory traversal segments.',
    })
  }

  const normalized = resolve(trimmed)

  if (isSystemDirectory(normalized)) {
    errors.push({
      code: 'SYSTEM_DIRECTORY',
      message: 'Cannot use a system directory. Choose a location in your home folder.',
    })
  }

  // Parent must exist and be writable
  const parent = normalize(resolve(normalized, '..'))
  if (!existsSync(parent)) {
    errors.push({
      code: 'PARENT_MISSING',
      message: `Parent directory does not exist: ${parent}`,
    })
  } else {
    try {
      const st = statSync(parent)
      if (!st.isDirectory()) {
        errors.push({
          code: 'NOT_A_DIRECTORY',
          message: `Parent path is not a directory: ${parent}`,
        })
      } else {
        try {
          accessSync(parent, constants.W_OK)
        } catch {
          errors.push({
            code: 'NOT_WRITABLE',
            message: `No write permission on ${parent}`,
          })
        }
      }
    } catch {
      errors.push({
        code: 'PARENT_MISSING',
        message: `Cannot stat parent directory: ${parent}`,
      })
    }
  }

  // Cloud-sync warning
  const cloud = detectCloudFolder(normalized)
  if (cloud !== null) {
    warnings.push({
      code: 'CLOUD_SYNC_FOLDER',
      message:
        `This folder appears to be synced by ${cloud}. Storing the Psygil database in a ` +
        `cloud-synced folder can cause database corruption because multiple sync clients ` +
        `may modify the file simultaneously. We strongly recommend choosing a local-only ` +
        `folder.`,
    })
  }

  // Free space warning (only if parent exists)
  if (errors.find((e) => e.code === 'PARENT_MISSING') === undefined) {
    const free = getFreeSpace(parent)
    if (free !== null && free < MIN_FREE_BYTES) {
      warnings.push({
        code: 'LOW_DISK_SPACE',
        message: `Less than 500 MB free at ${parent}. Psygil needs room for case files and databases.`,
      })
    }
  }

  // If the target already exists and is not empty, warn (not fatal).
  if (existsSync(normalized)) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { readdirSync } = require('fs') as typeof import('fs')
      const entries = readdirSync(normalized)
      if (entries.length > 0) {
        warnings.push({
          code: 'PATH_NOT_EMPTY',
          message:
            'This folder already contains files. Setup will create the Psygil structure alongside them.',
        })
      }
    } catch {
      // ignore, read errors will surface during actual provisioning
    }
  }

  return {
    ok: errors.length === 0,
    normalizedPath: normalized,
    errors,
    warnings,
  }
}

// ---------------------------------------------------------------------------
// Provisioning, create the project root structure
// ---------------------------------------------------------------------------

export const PROJECT_ROOT_SUBFOLDERS = [
  '.psygil',
  '.psygil/assets',
  'cases',
  // User-facing Workspace, a single home for all non-case content:
  //   Writing Samples, the clinician's own prior reports, used to
  //                     calibrate the Writer Agent's voice and style
  //   Templates, starter report templates (7 eval types) plus any
  //                     existing reports the clinician wants to convert
  //                     into templates
  //   Documents, reference materials (DSM codes, case law, statutes,
  //                     APA specialty guidelines, HIPAA forensic notes)
  //   Testing, scoring guides and interpretive references for the
  //                     instruments in the clinician's library
  //   Forms, blank intake/consent/release forms. Completed
  //                     copies live inside each case folder, never here.
  'Workspace',
  'Workspace/Writing Samples',
  'Workspace/Templates',
  'Workspace/Documents',
  'Workspace/Testing',
  'Workspace/Forms',
] as const

/**
 * Create the project root directory structure per doc 16 / doc 17.
 * Returns the list of folders that were created (for audit trail).
 * Idempotent, safe to call on an existing Psygil root.
 */
export function provisionProjectRoot(projectRoot: string): readonly string[] {
  if (!isAbsolute(projectRoot)) {
    throw new Error(`provisionProjectRoot: path must be absolute, got ${projectRoot}`)
  }

  const created: string[] = []
  for (const sub of ['', ...PROJECT_ROOT_SUBFOLDERS]) {
    const full = sub === '' ? projectRoot : resolve(projectRoot, sub)
    if (!existsSync(full)) {
      mkdirSync(full, { recursive: true })
      created.push(full)
    }
  }

  // Probe write permissions with a transient marker file
  const probe = resolve(projectRoot, '.psygil', '.write-probe')
  try {
    writeFileSync(probe, `psygil-write-probe ${new Date().toISOString()}`, 'utf-8')
    unlinkSync(probe)
  } catch (err) {
    throw new Error(
      `Project root is not writable after provisioning: ${projectRoot}. ${(err as Error).message}`,
    )
  }

  return created
}
