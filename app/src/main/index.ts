import { app, BrowserWindow, protocol } from 'electron'

// Disable GPU acceleration to avoid CVDisplayLink / GPU process crashes in dev
app.disableHardwareAcceleration()
import { join } from 'path'
import { registerAllHandlers } from './ipc'
import { loadWorkspacePath, watchWorkspace, stopWatcher, syncWorkspaceToDB } from './workspace'
import { initDb, getSqlite } from './db/connection'
import { shouldSeedDemoCases, seedDemoCases, createSeedTrigger, backfillDemoTypes, backfillOnboarding } from './seed-demo-cases'

// 4-process architecture:
// Process 1: Main (this file) — app lifecycle, IPC hub, window management
// Process 2: Renderer (sandboxed) — React UI
// Process 3: OnlyOffice (placeholder) — local document editing server
// Process 4: Python sidecar (placeholder) — PII detection, NLP pipeline

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
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: !isDev  // sandbox=true in production only; dev needs GPU access
    }
  })

  // DevTools: disabled — open manually with Cmd+Option+I if needed

  // Inject CSP headers for all responses.
  // In dev mode, Vite's React plugin injects an inline <script> preamble for
  // HMR / Fast Refresh. `script-src 'self'` blocks it → blank screen.
  // So we add 'unsafe-inline' for scripts in dev only.
  const csp = isDev
    ? "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ws: http://localhost:* https://api.anthropic.com; frame-src http://localhost:9980; object-src 'none'; base-uri 'self'; form-action 'none'"
    : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https://api.anthropic.com http://localhost:9980 ws://localhost:9980; frame-src http://localhost:9980; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'"
  win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp],
      },
    })
  })

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

  // Initialize encrypted database + run pending migrations
  // CRITICAL: registerAllHandlers() MUST run even if DB/seed fails,
  // otherwise the renderer gets zero IPC handlers → blank screen.
  try {
    await initDb()
  } catch (err) {
    console.error('[main] DB init failed:', err)
  }

  // Register IPC handlers — always, regardless of DB state
  try {
    registerAllHandlers()
  } catch (err) {
    console.error('[main] Handler registration failed:', err)
  }

  // Demo seeding — DISABLED for clean-slate testing.
  // To re-enable: create the trigger file manually with `db:seed-demo` script.
  // The auto-seed fallback (which re-seeded when 0 cases found) is removed
  // to allow starting with a genuinely empty database.
  try {
    if (shouldSeedDemoCases()) {
      console.log('[main] Demo seed trigger detected — seeding 42 cases...')
      seedDemoCases()
    } else {
      console.log('[main] No demo seed trigger — skipping demo seed.')
    }
  } catch (err) {
    console.error('[main] Demo seed failed (non-fatal):', err)
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
