import { app, BrowserWindow, protocol } from 'electron'
import { join } from 'path'
import { registerAllHandlers } from './ipc'
import { loadWorkspacePath, watchWorkspace, stopWatcher } from './workspace'
import { initDb } from './db/connection'

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
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  })

  // DevTools: open in development, disabled in production
  if (process.env.NODE_ENV === 'development') {
    win.webContents.openDevTools()
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

  // Initialize encrypted database + run pending migrations before registering handlers
  await initDb()

  registerAllHandlers()

  // If workspace was previously configured, start the file watcher
  const wsPath = loadWorkspacePath()
  if (wsPath !== null) {
    watchWorkspace(wsPath)
  }

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
