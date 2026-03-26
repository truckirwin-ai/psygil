// Workspace folder management — config persistence, folder creation, file watcher, tree builder
// Source of truth: docs/engineering/26_Workspace_Folder_Architecture.md

import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs'
import type { FSWatcher } from 'chokidar'
import chokidar from 'chokidar'
import type { FolderNode } from '../../shared/types'

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
  watcher.on('addDir', (dirPath) => broadcast('addDir', dirPath))
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
