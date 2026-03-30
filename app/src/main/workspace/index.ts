// =============================================================================
// Workspace folder management — config persistence, folder creation, file
// watcher, tree builder
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
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs'
import type { FSWatcher } from 'chokidar'
import chokidar from 'chokidar'
import type { FolderNode } from '../../shared/types'
import { getSqlite } from '../db/connection'

// ---------------------------------------------------------------------------
// Workspace → DB sync
// Scans the workspace root for case folders matching the pattern:
//   {case_number} {last}, {first}[optional mi]
// Creates DB records for any folder not already indexed.
// Called on startup and when watcher detects new top-level directories.
// ---------------------------------------------------------------------------

// Regex: "2026-0147 Johnson, Marcus D." or "2026-0147 Johnson, Marcus"
const CASE_FOLDER_PATTERN = /^(\d{4}-\d{4})\s+([^,]+),\s+(.+)$/

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

  let synced = 0

  for (const entry of entries) {
    // Skip system folders
    if (entry.startsWith('_') || entry.startsWith('.')) continue

    const fullPath = join(wsPath, entry)
    try {
      if (!statSync(fullPath).isDirectory()) continue
    } catch {
      continue
    }

    const match = CASE_FOLDER_PATTERN.exec(entry)
    if (!match) continue

    const [, caseNumber, lastName, firstAndMi] = match
    if (!caseNumber || !lastName || !firstAndMi) continue

    // Split "Marcus D." or "Marcus" into first + mi
    const parts = firstAndMi.trim().split(/\s+/)
    const firstName = parts[0] ?? firstAndMi.trim()

    // Check if already in DB
    const existing = db.prepare('SELECT case_id FROM cases WHERE case_number = ?').get(caseNumber)
    if (existing) continue

    // Insert minimal record — user can fill details via Intake later
    // Check if folder_path column exists (added in later migration)
    const cols = (db.pragma('table_info(cases)') as Array<{ name: string }>).map(c => c.name)
    const hasFolderPath = cols.includes('folder_path')

    try {
      if (hasFolderPath) {
        db.prepare(`
          INSERT INTO cases (
            case_number, primary_clinician_user_id,
            examinee_first_name, examinee_last_name,
            case_status, workflow_current_stage,
            folder_path, created_at
          ) VALUES (?, 1, ?, ?, 'intake', 'gate_1', ?, CURRENT_DATE)
        `).run(caseNumber, firstName, lastName.trim(), fullPath)
      } else {
        db.prepare(`
          INSERT INTO cases (
            case_number, primary_clinician_user_id,
            examinee_first_name, examinee_last_name,
            case_status, workflow_current_stage, created_at
          ) VALUES (?, 1, ?, ?, 'intake', 'gate_1', CURRENT_DATE)
        `).run(caseNumber, firstName, lastName.trim())
      }
      console.log('[workspace-sync] Indexed:', entry)
      synced++
    } catch (e) {
      console.error('[workspace-sync] Failed to index', entry, (e as Error).message)
    }
  }

  if (synced > 0) {
    console.log(`[workspace-sync] Indexed ${synced} new case folders`)
  }
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

export function watchWorkspace(root: string): void {
  // Close any existing watcher before starting a new one
  if (activeWatcher !== null) {
    activeWatcher.close()
    activeWatcher = null
  }

  const watcher = chokidar.watch(root, {
    ignoreInitial: true,
    persistent: true,
    depth: 10,
    ignored: [
      /(^|[/\\])\../, // dotfiles
      '**/node_modules/**',
      '**/.DS_Store',
    ],
  })

  const broadcast = (event: string, filePath: string): void => {
    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send('workspace:file-changed', { event, path: filePath })
      }
    }
  }

  watcher.on('add', (filePath) => broadcast('add', filePath))
  watcher.on('change', (filePath) => broadcast('change', filePath))
  watcher.on('unlink', (filePath) => broadcast('unlink', filePath))
  watcher.on('addDir', (dirPath) => {
    broadcast('addDir', dirPath)
    // If a new top-level case folder was added, sync it to the DB
    const parentDir = dirPath.split('/').slice(0, -1).join('/')
    if (parentDir === root) {
      syncWorkspaceToDB(root)
    }
  })
  watcher.on('unlinkDir', (dirPath) => broadcast('unlinkDir', dirPath))

  activeWatcher = watcher
}

export function stopWatcher(): void {
  if (activeWatcher !== null) {
    activeWatcher.close()
    activeWatcher = null
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
