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

// Register local-file:// as a privileged scheme so it can be used in iframes
// for serving local PDFs to the renderer without CSP issues.
protocol.registerSchemesAsPrivileged([
  { scheme: 'local-file', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }
])

// Disable GPU acceleration to avoid CVDisplayLink / GPU process crashes in dev
app.disableHardwareAcceleration()
import { join } from 'path'
import { registerAllHandlers } from './ipc'
import { loadWorkspacePath, watchWorkspace, stopWatcher, syncWorkspaceToDB } from './workspace'
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

  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    title: 'Psygil',
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

  // Sync workspace folders → DB BEFORE opening window so the tree is populated on first load
  try {
    const wsPath = loadWorkspacePath()
    if (wsPath !== null) {
      syncWorkspaceToDB(wsPath)
      watchWorkspace(wsPath)
    }
  } catch (err) {
    console.error('[main] Workspace sync failed:', err)
  }

  // Open window after sync so renderer gets populated case list immediately
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    stopWatcher()
    app.quit()
  }
})

app.on('before-quit', () => {
  stopWatcher()
})
