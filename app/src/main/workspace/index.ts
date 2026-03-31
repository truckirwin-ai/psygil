// =============================================================================
// Workspace folder management — config persistence, folder creation, file
// watcher, tree builder, filesystem ↔ DB reconciliation
// Source of truth: docs/engineering/26_Workspace_Folder_Architecture.md
// =============================================================================
//
// ██████████████████████████████████████████████████████████████████████████████
// ██  CRITICAL RULE: THE FILESYSTEM IS THE SOURCE OF TRUTH FOR THE TREE     ██
// ██████████████████████████████████████████████████████████████████████████████
//
// getWorkspaceTree() reads actual files/folders from disk via readdirSync.
// The renderer's LeftColumn.tsx calls this via IPC to build the tree UI.
//
// The DB (cases table) provides METADATA OVERLAY ONLY — stage colors, eval
// types, workflow status.  It NEVER determines which nodes appear in the tree.
//
// If you need to change what appears in the tree: change the filesystem.
// If you need to change how tree nodes look: change the DB metadata or the
// LeftColumn rendering logic.
//
// DO NOT add logic that fabricates tree nodes from DB records.
// DO NOT filter out filesystem entries based on pipeline stage.
// =============================================================================

import { app, BrowserWindow } from 'electron'
import { join, basename } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs'
import type { FSWatcher } from 'chokidar'
import chokidar from 'chokidar'
import type { FolderNode } from '../../shared/types'
import { getSqlite } from '../db/connection'

// ---------------------------------------------------------------------------
// Constants — canonical case subfolder structure
// ---------------------------------------------------------------------------

/**
 * Every case folder gets these subfolders. They map to the 6-stage clinical
 * pipeline and provide a predictable on-disk structure.
 *
 * _Inbox/       — Unsorted incoming files (referrals, correspondence)
 * Collateral/   — Court orders, prior records, third-party documents
 * Testing/      — Test score reports, psychometric raw data
 * Interviews/   — Clinical interview notes, behavioral observations
 * Diagnostics/  — Diagnostic formulations, differential dx notes
 * Reports/      — Draft and final reports
 * Archive/      — Superseded documents, old versions
 */
export const CASE_SUBFOLDERS = [
  '_Inbox',
  'Collateral',
  'Testing',
  'Interviews',
  'Diagnostics',
  'Reports',
  'Archive',
] as const

/**
 * The 6-stage clinical pipeline, ordered by progression.
 * Stage is inferred from which subfolders contain files.
 */
const STAGE_ORDER = ['onboarding', 'testing', 'interview', 'diagnostics', 'review', 'complete'] as const
type Stage = (typeof STAGE_ORDER)[number]

/**
 * Map subfolder names → pipeline stage they indicate.
 * A case is inferred to be at the DEEPEST stage for which it has files.
 */
const SUBFOLDER_TO_STAGE: Record<string, Stage> = {
  '_Inbox':      'onboarding',
  'Collateral':  'onboarding',
  'Testing':     'testing',
  'Interviews':  'interview',
  'Diagnostics': 'diagnostics',
  'Reports':     'review',  // draft reports = review stage
  // 'Archive' doesn't map to a stage — it's housekeeping
}

// Regex: "2026-0147 Johnson, Marcus D." or "2026-0147 Johnson, Marcus"
const CASE_FOLDER_PATTERN = /^(\d{4}-\d{4})\s+([^,]+),\s+(.+)$/

// ---------------------------------------------------------------------------
// Workspace → DB reconciliation
// Full scan: for every case folder on disk, UPSERT the DB record with
// metadata derived from what files actually exist.
// ---------------------------------------------------------------------------

interface FolderScanResult {
  caseNumber: string
  lastName: string
  firstName: string
  folderPath: string
  folderName: string
  inferredStage: Stage
  inferredStatus: 'intake' | 'in_progress' | 'completed'
  fileCount: number
  subfolderCounts: Record<string, number>
  hasSubfolders: boolean
}

interface MalformedFolder {
  name: string
  path: string
  reason: 'bad_name' | 'no_subfolders'
}

// Module-level storage for malformed folders (renderer can query via IPC)
let _malformedFolders: readonly MalformedFolder[] = []

export function getMalformedFolders(): readonly MalformedFolder[] {
  return _malformedFolders
}

/**
 * Scan a case folder and derive metadata from its contents.
 */
function scanCaseFolder(folderPath: string): { inferredStage: Stage; inferredStatus: 'intake' | 'in_progress' | 'completed'; fileCount: number; subfolderCounts: Record<string, number>; hasSubfolders: boolean } {
  const subfolderCounts: Record<string, number> = {}
  let totalFiles = 0
  let hasSubfolders = false

  let entries: string[]
  try {
    entries = readdirSync(folderPath)
  } catch {
    return { inferredStage: 'onboarding', inferredStatus: 'intake', fileCount: 0, subfolderCounts: {}, hasSubfolders: false }
  }

  for (const entry of entries) {
    if (entry.startsWith('.')) continue
    const entryPath = join(folderPath, entry)

    try {
      if (!statSync(entryPath).isDirectory()) {
        totalFiles++  // root-level files count
        continue
      }
    } catch {
      continue
    }

    hasSubfolders = true

    // Count files in this subfolder (non-recursive — just immediate children)
    let subCount = 0
    try {
      const subEntries = readdirSync(entryPath)
      for (const se of subEntries) {
        if (se.startsWith('.')) continue
        try {
          if (!statSync(join(entryPath, se)).isDirectory()) {
            subCount++
          }
        } catch { /* skip */ }
      }
    } catch { /* skip */ }

    subfolderCounts[entry] = subCount
    totalFiles += subCount
  }

  // Infer stage from deepest subfolder with files
  let inferredStage: Stage = 'onboarding'
  let deepestIndex = 0

  // Check for finalized report (complete stage)
  const reportCount = subfolderCounts['Reports'] ?? 0
  const hasFinalReport = reportCount > 0 && (() => {
    try {
      const reportEntries = readdirSync(join(folderPath, 'Reports'))
      return reportEntries.some(f => /^Final_Report|_FINAL|_sealed|_signed/i.test(f))
    } catch { return false }
  })()

  if (hasFinalReport) {
    inferredStage = 'complete'
    deepestIndex = 5
  } else {
    for (const [subfolder, stage] of Object.entries(SUBFOLDER_TO_STAGE)) {
      const count = subfolderCounts[subfolder] ?? 0
      if (count > 0) {
        const stageIdx = STAGE_ORDER.indexOf(stage)
        if (stageIdx > deepestIndex) {
          deepestIndex = stageIdx
          inferredStage = stage
        }
      }
    }
  }

  // Infer case_status from stage
  const inferredStatus = inferredStage === 'onboarding' && totalFiles <= 1
    ? 'intake' as const
    : inferredStage === 'complete'
      ? 'completed' as const
      : 'in_progress' as const

  return { inferredStage, inferredStatus, fileCount: totalFiles, subfolderCounts, hasSubfolders }
}

/**
 * Full reconciliation: scan workspace, UPSERT every case folder into DB.
 * - New folders → INSERT
 * - Existing folders → UPDATE stage/status/file counts based on actual contents
 * - Malformed folders → logged for UI to prompt cleanup
 */
export function syncWorkspaceToDB(wsPath: string): void {
  let db: ReturnType<typeof getSqlite>
  try {
    db = getSqlite()
  } catch (e) {
    console.error('[workspace-sync] DB not ready:', (e as Error).message)
    return
  }

  console.log('[workspace-sync] Scanning:', wsPath)

  // Ensure a default clinician user exists (user_id = 1)
  const existingUser = db.prepare('SELECT user_id FROM users WHERE user_id = 1').get()
  if (!existingUser) {
    db.prepare(`
      INSERT OR IGNORE INTO users (user_id, email, full_name, role, is_active, created_at)
      VALUES (1, 'clinician@psygil.com', 'Dr. Robert Irwin', 'psychologist', 1, CURRENT_DATE)
    `).run()
  }

  let entries: string[]
  try {
    entries = readdirSync(wsPath)
  } catch {
    return
  }

  const malformed: MalformedFolder[] = []
  let synced = 0
  let updated = 0

  // Prepared statements
  const selectCase = db.prepare('SELECT case_id, workflow_current_stage, case_status FROM cases WHERE case_number = ?')
  const insertCase = db.prepare(`
    INSERT INTO cases (
      case_number, primary_clinician_user_id,
      examinee_first_name, examinee_last_name,
      case_status, workflow_current_stage,
      folder_path, created_at
    ) VALUES (?, 1, ?, ?, ?, ?, ?, CURRENT_DATE)
  `)
  const updateCaseMetadata = db.prepare(`
    UPDATE cases SET
      workflow_current_stage = ?,
      case_status = ?,
      folder_path = ?,
      last_modified = date('now')
    WHERE case_number = ?
  `)

  for (const entry of entries) {
    // Skip system folders (workspace-level)
    if (entry.startsWith('_') || entry.startsWith('.')) continue

    const fullPath = join(wsPath, entry)
    try {
      if (!statSync(fullPath).isDirectory()) continue
    } catch {
      continue
    }

    const match = CASE_FOLDER_PATTERN.exec(entry)
    if (!match) {
      // Not a system folder, not a valid case folder → malformed
      malformed.push({ name: entry, path: fullPath, reason: 'bad_name' })
      continue
    }

    const [, caseNumber, lastName, firstAndMi] = match
    if (!caseNumber || !lastName || !firstAndMi) continue

    const parts = firstAndMi.trim().split(/\s+/)
    const firstName = parts[0] ?? firstAndMi.trim()

    // Scan folder contents to derive metadata
    const scan = scanCaseFolder(fullPath)

    // Flag valid-named folders that have no subfolders
    if (!scan.hasSubfolders) {
      malformed.push({ name: entry, path: fullPath, reason: 'no_subfolders' })
    }

    // Check if already in DB
    const existing = selectCase.get(caseNumber) as { case_id: number; workflow_current_stage: string; case_status: string } | undefined

    if (existing) {
      // UPDATE — reconcile stage/status from filesystem
      // Only advance stage, never regress (clinician may have manually set it)
      const currentIdx = STAGE_ORDER.indexOf(existing.workflow_current_stage as Stage)
      const inferredIdx = STAGE_ORDER.indexOf(scan.inferredStage)

      if (inferredIdx > currentIdx || existing.case_status !== scan.inferredStatus) {
        const newStage = inferredIdx > currentIdx ? scan.inferredStage : existing.workflow_current_stage
        const newStatus = scan.inferredStatus
        updateCaseMetadata.run(newStage, newStatus, fullPath, caseNumber)
        updated++
      }
    } else {
      // INSERT — new case folder discovered on disk
      try {
        insertCase.run(caseNumber, firstName, lastName.trim(), scan.inferredStatus, scan.inferredStage, fullPath)
        console.log('[workspace-sync] Indexed:', entry)
        synced++
      } catch (e) {
        console.error('[workspace-sync] Failed to index', entry, (e as Error).message)
      }
    }
  }

  _malformedFolders = malformed

  // Orphan cleanup: delete DB records for case folders that no longer exist on disk.
  // The filesystem is the source of truth — if the folder is gone, the DB record goes.
  const allDbCases = db.prepare('SELECT case_id, case_number, folder_path FROM cases').all() as { case_id: number; case_number: string; folder_path: string | null }[]
  let orphansRemoved = 0
  for (const dbCase of allDbCases) {
    if (dbCase.folder_path && !existsSync(dbCase.folder_path)) {
      db.prepare('DELETE FROM cases WHERE case_id = ?').run(dbCase.case_id)
      orphansRemoved++
      console.log(`[workspace-sync] Orphan removed: ${dbCase.case_number} (${dbCase.folder_path})`)
    }
  }

  if (synced > 0) console.log(`[workspace-sync] Indexed ${synced} new case folders`)
  if (updated > 0) console.log(`[workspace-sync] Updated ${updated} case folders from filesystem`)
  if (orphansRemoved > 0) console.log(`[workspace-sync] Removed ${orphansRemoved} orphan DB records`)
  if (malformed.length > 0) {
    console.log(`[workspace-sync] ${malformed.length} malformed folder(s) detected:`)
    for (const m of malformed) {
      console.log(`  - ${m.name} (${m.reason})`)
    }
  }
}

/**
 * Targeted re-sync: reconcile a single case folder after a file change.
 * Much faster than full sync — called by chokidar on file events.
 *
 * Unlike the original version which only advanced stage, this will
 * ALWAYS update the DB to match the filesystem truth — including
 * regressing the stage when files are deleted.
 */
export function syncSingleCase(caseFolderPath: string): void {
  let db: ReturnType<typeof getSqlite>
  try {
    db = getSqlite()
  } catch { return }

  const folderName = basename(caseFolderPath)
  const match = CASE_FOLDER_PATTERN.exec(folderName)
  if (!match) return

  const [, caseNumber] = match
  if (!caseNumber) return

  // If the folder was deleted, remove the DB record — filesystem is truth
  if (!existsSync(caseFolderPath)) {
    db.prepare('DELETE FROM cases WHERE case_number = ?').run(caseNumber)
    console.log(`[workspace-sync] ${caseNumber} folder deleted — removed from DB`)
    return
  }

  const scan = scanCaseFolder(caseFolderPath)

  const existing = db.prepare('SELECT case_id, workflow_current_stage, case_status FROM cases WHERE case_number = ?')
    .get(caseNumber) as { case_id: number; workflow_current_stage: string; case_status: string } | undefined

  if (!existing) return  // workspace sync will handle new folders

  // Always reconcile stage and status to match filesystem reality.
  // The filesystem is the source of truth — if files were deleted,
  // the stage should regress accordingly.
  if (existing.workflow_current_stage !== scan.inferredStage || existing.case_status !== scan.inferredStatus) {
    db.prepare(`
      UPDATE cases SET
        workflow_current_stage = ?,
        case_status = ?,
        last_modified = date('now')
      WHERE case_id = ?
    `).run(scan.inferredStage, scan.inferredStatus, existing.case_id)
    console.log(`[workspace-sync] ${caseNumber} updated: ${existing.workflow_current_stage} → ${scan.inferredStage}, ${existing.case_status} → ${scan.inferredStatus}`)
  }
}

/**
 * Scaffold standard subfolders in a case folder if they're missing.
 * Returns list of folders that were created.
 */
export function scaffoldCaseSubfolders(caseFolderPath: string): string[] {
  const created: string[] = []
  if (!existsSync(caseFolderPath)) {
    mkdirSync(caseFolderPath, { recursive: true })
    created.push(caseFolderPath)
  }
  for (const sub of CASE_SUBFOLDERS) {
    const subPath = join(caseFolderPath, sub)
    if (!existsSync(subPath)) {
      mkdirSync(subPath, { recursive: true })
      created.push(sub)
    }
  }
  return created
}

// ---------------------------------------------------------------------------
// Config persistence — workspace path stored in userData/config.json
// ---------------------------------------------------------------------------

function getConfigPath(): string {
  return join(app.getPath('userData'), 'config.json')
}

interface AppConfig {
  readonly workspacePath?: string
}

function readConfig(): AppConfig {
  const configPath = getConfigPath()
  if (!existsSync(configPath)) return {}
  try {
    const raw = readFileSync(configPath, 'utf-8')
    return JSON.parse(raw) as AppConfig
  } catch {
    return {}
  }
}

function writeConfig(config: AppConfig): void {
  const configPath = getConfigPath()
  writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
}

export function loadWorkspacePath(): string | null {
  const config = readConfig()
  return config.workspacePath ?? null
}

export function saveWorkspacePath(p: string): void {
  const config = readConfig()
  writeConfig({ ...config, workspacePath: p })
}

// ---------------------------------------------------------------------------
// Folder structure — create workspace subfolders per spec
// ---------------------------------------------------------------------------

const WORKSPACE_SUBFOLDERS = ['_Inbox', '_Templates', '_Reference', '_Shared'] as const

export function createFolderStructure(root: string): void {
  if (!existsSync(root)) {
    mkdirSync(root, { recursive: true })
  }
  for (const sub of WORKSPACE_SUBFOLDERS) {
    const subPath = join(root, sub)
    if (!existsSync(subPath)) {
      mkdirSync(subPath, { recursive: true })
    }
  }
}

// ---------------------------------------------------------------------------
// Default workspace path
// ---------------------------------------------------------------------------

export function getDefaultWorkspacePath(): string {
  return join(app.getPath('documents'), 'Psygil Cases')
}

// ---------------------------------------------------------------------------
// File watcher — chokidar watches the workspace root, emits IPC events
// ---------------------------------------------------------------------------

let activeWatcher: FSWatcher | null = null
let _watchedRoot: string | null = null

export function watchWorkspace(root: string): void {
  // Close any existing watcher before starting a new one
  if (activeWatcher !== null) {
    activeWatcher.close()
    activeWatcher = null
  }

  _watchedRoot = root

  const watcher = chokidar.watch(root, {
    ignoreInitial: true,
    persistent: true,
    depth: 10,
    ignored: [
      /(^|[/\\])\./, // dotfiles
      '**/node_modules/**',
      '**/.DS_Store',
    ],
  })

  // Debounce: accumulate changed case folders, sync DB THEN broadcast to
  // renderer.  The old code broadcast BEFORE the debounced sync, so the
  // renderer would call cases.list() and get stale data.
  let syncTimer: ReturnType<typeof setTimeout> | null = null
  const pendingCaseFolders = new Set<string>()

  const broadcastRefresh = (): void => {
    const windows = BrowserWindow.getAllWindows()
    console.log(`[watcher] broadcasting refresh to ${windows.length} window(s)`)
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send('workspace:file-changed', { event: 'sync-complete', path: root })
      }
    }
  }

  const scheduleSync = (filePath: string): void => {
    // Determine which case folder this file belongs to
    const relative = filePath.replace(root + '/', '')
    const topLevel = relative.split('/')[0]
    if (!topLevel || topLevel.startsWith('_') || topLevel.startsWith('.')) return

    const caseFolderPath = join(root, topLevel)
    pendingCaseFolders.add(caseFolderPath)

    if (syncTimer) clearTimeout(syncTimer)
    syncTimer = setTimeout(() => {
      console.log(`[watcher] syncing ${pendingCaseFolders.size} case folder(s)`)
      for (const cfp of pendingCaseFolders) {
        syncSingleCase(cfp)
      }
      pendingCaseFolders.clear()
      syncTimer = null

      // NOW broadcast — DB is up-to-date, renderer will get fresh data
      broadcastRefresh()
    }, 500)  // 500ms debounce
  }

  watcher.on('ready', () => {
    console.log('[watcher] Ready — watching for changes')
  })

  watcher.on('error', (err) => {
    console.error('[watcher] Error:', err)
  })

  watcher.on('add', (filePath) => {
    console.log(`[watcher] add: ${filePath}`)
    scheduleSync(filePath)
  })
  watcher.on('change', (filePath) => {
    console.log(`[watcher] change: ${filePath}`)
    scheduleSync(filePath)
  })
  watcher.on('unlink', (filePath) => {
    console.log(`[watcher] unlink: ${filePath}`)
    scheduleSync(filePath)
  })
  watcher.on('addDir', (dirPath) => {
    console.log(`[watcher] addDir: ${dirPath}`)
    // If a new top-level folder was added, do a full sync (might be a new case)
    const parentDir = dirPath.split('/').slice(0, -1).join('/')
    if (parentDir === root) {
      syncWorkspaceToDB(root)
      broadcastRefresh()
    } else {
      scheduleSync(dirPath)
    }
  })
  watcher.on('unlinkDir', (dirPath) => {
    console.log(`[watcher] unlinkDir: ${dirPath}`)
    // If a top-level folder was removed, do a full sync (handles orphan cleanup)
    const parentDir = dirPath.split('/').slice(0, -1).join('/')
    if (parentDir === root) {
      syncWorkspaceToDB(root)
      broadcastRefresh()
    } else {
      scheduleSync(dirPath)
    }
  })

  activeWatcher = watcher
}

export function stopWatcher(): void {
  if (activeWatcher !== null) {
    activeWatcher.close()
    activeWatcher = null
    _watchedRoot = null
  }
}

// ---------------------------------------------------------------------------
// Tree builder — recursive JSON tree of files/folders
// ---------------------------------------------------------------------------

export function getWorkspaceTree(root: string): readonly FolderNode[] {
  if (!existsSync(root)) return []
  return buildTree(root)
}

function buildTree(dirPath: string): readonly FolderNode[] {
  let entries: readonly string[]
  try {
    entries = readdirSync(dirPath)
  } catch {
    return []
  }

  const nodes: FolderNode[] = []

  // Sort: folders first, then files, both alphabetically
  const sorted = [...entries].sort((a, b) => {
    const aIsDir = isDirectory(join(dirPath, a))
    const bIsDir = isDirectory(join(dirPath, b))
    if (aIsDir && !bIsDir) return -1
    if (!aIsDir && bIsDir) return 1
    return a.localeCompare(b)
  })

  for (const name of sorted) {
    // Skip dotfiles and .DS_Store
    if (name.startsWith('.')) continue

    const fullPath = join(dirPath, name)
    const isDir = isDirectory(fullPath)

    const node: FolderNode = {
      name,
      path: fullPath,
      isDirectory: isDir,
      children: isDir ? buildTree(fullPath) : undefined,
    }

    nodes.push(node)
  }

  return nodes
}

function isDirectory(p: string): boolean {
  try {
    return statSync(p).isDirectory()
  } catch {
    return false
  }
}
