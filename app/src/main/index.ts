// Silence EPIPE errors on stdout/stderr. These occur when the parent process
// (terminal, CI runner, or packaged launcher) closes its pipe before Electron
// finishes writing log output. Without this guard every console.log call can
// throw an uncaught exception and crash the app.
for (const stream of [process.stdout, process.stderr]) {
  stream?.on?.('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EPIPE' || err.code === 'ERR_STREAM_DESTROYED') return
    // Re-throw non-EPIPE errors so they surface normally
    throw err
  })
}

import { app, BrowserWindow, protocol, net } from 'electron'
import { pathToFileURL } from 'url'
import { configurePortableMode } from './portable'

// Portable-install detection: if a .psygil-portable marker exists next to
// the .app bundle (or Windows/Linux install dir), redirect userData to a
// sibling Psygil-Data/ folder. Must run before app.whenReady() so every
// consumer of userData picks up the redirected path on first access.
configurePortableMode()

// Second-instance lock (Phase C.1): refuse to launch if another Psygil is
// already running. If a second instance fires the protocol handler with a
// psygil:// URL, forward it to the running instance instead of starting a
// new one. Must run BEFORE app.whenReady().
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
  // Stop execution; app.quit() is async and we do not want any handlers to
  // register on the losing instance.
  process.exit(0)
}

// Register local-file:// as a privileged scheme so it can be used in iframes
// for serving local PDFs to the renderer without CSP issues.
protocol.registerSchemesAsPrivileged([
  { scheme: 'local-file', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }
])

// Disable GPU acceleration to avoid CVDisplayLink / GPU process crashes in dev
app.disableHardwareAcceleration()
import { join } from 'path'
import { registerAllHandlers } from './ipc'
import { registerCallbackHandler } from './auth/callback'
import { loadWorkspacePath, watchWorkspace, stopWatcher, syncWorkspaceToDB } from './workspace'
import { acquireWorkspaceLock, releaseWorkspaceLock } from './workspace/lock'
import { initDb, getSqlite } from './db/connection'
import { shouldSeedDemoCases, seedDemoCases, createSeedTrigger, backfillDemoTypes, backfillOnboarding } from './seed-demo-cases'
import { seedRealisticCases } from './setup/case-content/seeder'

// 4-process architecture:
// Process 1: Main (this file), app lifecycle, IPC hub, window management
// Process 2: Renderer (sandboxed), React UI
// Process 3: OnlyOffice (placeholder), local document editing server
// Process 4: Python sidecar (placeholder), PII detection, NLP pipeline

// Register psygil:// as a privileged scheme BEFORE app is ready.
// This allows Auth0 to redirect back to our app after PKCE login.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'psygil',
    privileges: {
      standard: true,
      secure: true,
      allowServiceWorkers: false,
      supportFetchAPI: false,
      corsEnabled: false,
    },
  },
])

function createWindow(): BrowserWindow {
  // electron-vite sets ELECTRON_RENDERER_URL in dev mode; NODE_ENV may not be set
  const isDev = !!process.env['ELECTRON_RENDERER_URL'] || process.env.NODE_ENV === 'development'

  // Read the persisted theme to set the initial window background color.
  // On macOS, setting backgroundColor to a dark value makes the native
  // title bar (traffic lights + drag region) render in dark mode.
  let bgColor = '#ffffff'
  try {
    const fs = require('fs')
    const { join: pjoin } = require('path')
    const setupPath = pjoin(app.getPath('userData'), 'psygil-setup.json')
    if (fs.existsSync(setupPath)) {
      const raw = fs.readFileSync(setupPath, 'utf-8')
      const cfg = JSON.parse(raw)
      const theme = cfg?.appearance?.theme
      if (theme === 'dark') bgColor = '#2b2f36'
      else if (theme === 'warm') bgColor = '#faf8f4'
    }
  } catch { /* default to white */ }

  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    title: 'Psygil',
    backgroundColor: bgColor,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,  // Required for inline PDF rendering via <webview>
      sandbox: !isDev  // sandbox=true in production only; dev needs GPU access
    }
  })

  // Apply persisted branding to the window title, best-effort.
  // Imported lazily to avoid a module-load cycle with the IPC handler module.
  void (async () => {
    try {
      const { getBranding } = await import('./branding/brandingManager')
      const b = await getBranding()
      const t = b.practiceName.trim()
      if (t) win.setTitle(t)
    } catch {
      // Non-fatal, default title stays
    }
  })()

  // DevTools: disabled, open manually with Cmd+Option+I if needed

  // Inject CSP headers for all responses.
  // In dev mode, Vite's React plugin injects an inline <script> preamble for
  // HMR / Fast Refresh. `script-src 'self'` blocks it → blank screen.
  // So we add 'unsafe-inline' for scripts in dev only.
  const csp = isDev
    ? "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ws: http://localhost:* https://api.anthropic.com; frame-src 'self' blob: data: local-file: http://localhost:9980; object-src 'self' blob: local-file:; base-uri 'self'; form-action 'none'"
    : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https://api.anthropic.com http://localhost:9980 ws://localhost:9980; frame-src 'self' blob: data: local-file: http://localhost:9980; object-src 'self' blob: local-file:; base-uri 'self'; form-action 'none'; frame-ancestors 'none'"
  win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp],
      },
    })
  })

  // Forward renderer console messages and crashes to the main process
  // stdout so packaged builds can be debugged without DevTools. Use
  // process.stdout.write directly so the project's "no console.log in
  // production" rule stays clean at the grep level.
  win.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    const levelTag = level === 0 ? 'LOG' : level === 1 ? 'WARN' : level === 2 ? 'ERR ' : 'INFO'
    process.stdout.write(`[renderer ${levelTag}] ${message}  (${sourceId}:${line})\n`)
  })
  win.webContents.on('did-fail-load', (_event, code, description, url) => {
    console.error(`[renderer FAIL-LOAD] ${code} ${description} url=${url}`)
  })
  win.webContents.on('render-process-gone', (_event, details) => {
    console.error(`[renderer GONE] reason=${details.reason} exitCode=${details.exitCode}`)
  })
  win.webContents.on('unresponsive', () => {
    console.error('[renderer UNRESPONSIVE]')
  })
  win.webContents.on('preload-error', (_event, preloadPath, error) => {
    console.error(`[renderer PRELOAD-ERROR] ${preloadPath}: ${error.message}`)
  })

  // Open DevTools automatically when PSYGIL_DEVTOOLS=1 even in packaged builds
  if (process.env['PSYGIL_DEVTOOLS'] === '1') {
    win.webContents.openDevTools({ mode: 'detach' })
  }

  // electron-vite handles loading the renderer in dev vs production
  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

app.whenReady().then(async () => {
  // Register psygil:// as the default protocol client so the OS routes
  // Auth0 PKCE callbacks back to this app from the system browser.
  app.setAsDefaultProtocolClient('psygil')

  // Register local-file:// protocol to serve workspace files (e.g. PDFs)
  // to the renderer process. URL format: local-file:///absolute/path/to/file.pdf
  protocol.handle('local-file', (request) => {
    // Strip the scheme to get the file path
    const filePath = decodeURIComponent(request.url.replace('local-file://', ''))
    return net.fetch(pathToFileURL(filePath).toString())
  })

  // Initialize encrypted database + run pending migrations
  // CRITICAL: registerAllHandlers() MUST run even if DB/seed fails,
  // otherwise the renderer gets zero IPC handlers → blank screen.
  try {
    await initDb()
  } catch (err) {
    console.error('[main] DB init failed:', err)
  }

  // Register IPC handlers, always, regardless of DB state
  try {
    registerAllHandlers()
  } catch (err) {
    console.error('[main] Handler registration failed:', err)
  }

  // Register Auth0 deep-link callback handler (open-url + second-instance).
  // Lines touched by Phase B.1: this block only. A concurrent agent adding
  // a second-instance lock should merge cleanly since that lock fires before
  // app.whenReady() and this block is scoped to the ready callback.
  try {
    registerCallbackHandler()
  } catch (err) {
    console.error('[main] Callback handler registration failed:', err)
  }

  // Demo seeding, DISABLED for clean-slate testing.
  // To re-enable: create the trigger file manually with `db:seed-demo` script.
  // The auto-seed fallback (which re-seeded when 0 cases found) is removed
  // to allow starting with a genuinely empty database.
  try {
    if (shouldSeedDemoCases()) {
      seedDemoCases()
    } else {
    }
  } catch (err) {
    console.error('[main] Demo seed failed (non-fatal):', err)
  }

  // Realistic case seeding, opt-in via env var. Runs inside Electron so
  // native modules (better-sqlite3) are built against the correct Node
  // version. Use: PSYGIL_SEED_REALISTIC=1 npm run dev
  try {
    if (process.env['PSYGIL_SEED_REALISTIC'] === '1') {
      const wsPath = loadWorkspacePath()
      if (wsPath !== null) {
        const overwrite = process.env['PSYGIL_SEED_OVERWRITE'] === '1'
        seedRealisticCases({ projectRoot: wsPath, overwrite })
      } else {
        console.warn('[main] PSYGIL_SEED_REALISTIC set but no workspace path configured.')
      }
    }
  } catch (err) {
    console.error('[main] Realistic case seeding failed:', err)
  }

  // Sync workspace folders to DB BEFORE opening window so the tree is populated on first load.
  // Acquire the per-workspace lock file (Phase C.1) so two Psygil instances
  // cannot both watch and mutate the same workspace tree. A stale lock from
  // a crashed previous run is auto-recovered.
  try {
    const wsPath = loadWorkspacePath()
    if (wsPath !== null) {
      const lockResult = acquireWorkspaceLock(wsPath)
      if (!lockResult.acquired) {
        process.stderr.write(
          `[main] Workspace lock held by PID ${lockResult.heldByPid} since ${lockResult.heldSince} (host ${lockResult.hostname}). Refusing to sync or watch.\n`,
        )
        // Continue to open the window so the user can see a warning banner
        // (UI surface for this lands in Phase C.2). Sync and watcher are
        // skipped to avoid corruption.
      } else {
        syncWorkspaceToDB(wsPath)
        watchWorkspace(wsPath)
      }
    }
  } catch (err) {
    process.stderr.write(`[main] Workspace sync failed: ${err}\n`)
  }

  // Open window after sync so renderer gets populated case list immediately
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })

  // Second-instance handler (Phase C.1): when the OS tries to launch a
  // second Psygil (user double-clicks the dock icon, or a psygil:// URL
  // comes in from the browser), surface and focus the existing window
  // instead of starting a new process. The second instance was already
  // quit via requestSingleInstanceLock at the top of this file; this
  // handler fires in the original surviving instance with the second
  // instance's argv.
  app.on('second-instance', (_event, argv) => {
    const wins = BrowserWindow.getAllWindows()
    if (wins.length > 0) {
      const win = wins[0]
      if (win.isMinimized()) win.restore()
      win.show()
      win.focus()
    }
    // If one of the argv entries is a psygil:// URL (Windows / Linux
    // deep-link path), forward it to the Auth0 callback handler that
    // Phase B.1 will land in src/main/auth/callback.ts. Detection only
    // for now; the handler wires this up.
    for (const arg of argv) {
      if (typeof arg === 'string' && arg.startsWith('psygil://')) {
        app.emit('open-url', { preventDefault: () => undefined }, arg)
        break
      }
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    const wsPath = loadWorkspacePath()
    if (wsPath !== null) releaseWorkspaceLock(wsPath)
    stopWatcher()
    app.quit()
  }
})

app.on('before-quit', () => {
  const wsPath = loadWorkspacePath()
  if (wsPath !== null) releaseWorkspaceLock(wsPath)
  stopWatcher()
})
