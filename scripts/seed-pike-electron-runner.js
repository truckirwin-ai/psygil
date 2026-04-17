/**
 * Electron main-process runner for seed-pike-demo.
 * Run via: node_modules/.bin/electron scripts/seed-pike-electron-runner.js
 */
const { app } = require('electron')

// Suppress the dock icon and GUI
app.dock && app.dock.hide()

app.whenReady().then(async () => {
  try {
    // Register tsx so we can require TypeScript files
    const { register } = require('tsx/cjs')
    register()
  } catch {
    // tsx may not support .register() in all versions; fall back to require directly
  }

  try {
    require('./seed-pike-demo.ts')
  } catch (err) {
    console.error('Runner failed:', err)
    app.exit(1)
  }
})

app.on('window-all-closed', () => {
  // don't quit on window close; the seed script calls process.exit()
})
