/**
 * IPC Handlers for the Test Harness
 *
 * Registers handlers so the renderer (or DevTools console) can trigger
 * test harness runs via window.psygil.testHarness.*
 */

import { ipcMain } from 'electron'
import { listManifests, runManifestById } from './index'
import type { RunResult } from './runner'

export function registerTestHarnessHandlers(): void {
  // List all available manifests
  ipcMain.handle('testHarness:list', async () => {
    try {
      const manifests = listManifests()
      return { success: true, data: manifests }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  // Run a specific manifest by ID
  ipcMain.handle('testHarness:run', async (_event, params: { manifestId: string }) => {
    try {
      const result: RunResult = await runManifestById(params.manifestId)
      return { success: true, data: result }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  // Run all manifests sequentially
  ipcMain.handle('testHarness:runAll', async () => {
    try {
      const manifests = listManifests()
      const results: RunResult[] = []
      for (const m of manifests) {
        const result = await runManifestById(m.id)
        results.push(result)
      }
      return { success: true, data: results }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })
}
