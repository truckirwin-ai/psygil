/**
 * Test Harness Entry Point
 *
 * Exports all manifests and the runner for use by IPC handlers or direct import.
 * The test harness can be invoked from:
 *   1. IPC handler (testHarness:run) for running from the renderer
 *   2. Direct import in Vitest tests
 *   3. CLI script for headless CI runs
 */

import { runManifest, verifyCaseState } from './runner'
export { runManifest, verifyCaseState }
export type { RunResult, StepResult } from './runner'
export type { TestCaseManifest, PipelineStep, StepAction } from './manifest'

// ---------------------------------------------------------------------------
// Case manifests
// ---------------------------------------------------------------------------

import { deshawnRigginsManifest } from './cases/deshawn-riggins'

/** All available test case manifests, keyed by ID */
export const MANIFESTS: Record<string, import('./manifest').TestCaseManifest> = {
  'cst-riggins-001': deshawnRigginsManifest,
}

/** List all manifest IDs with metadata */
export function listManifests(): readonly {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly stopAtStage: string | null
  readonly stepCount: number
}[] {
  return Object.values(MANIFESTS).map((m) => ({
    id: m.id,
    name: m.name,
    description: m.description,
    stopAtStage: m.stopAtStage,
    stepCount: m.steps.length,
  }))
}

/** Run a manifest by ID */
export async function runManifestById(manifestId: string): Promise<import('./runner').RunResult> {
  const manifest = MANIFESTS[manifestId]
  if (!manifest) {
    throw new Error(`Unknown manifest: ${manifestId}. Available: ${Object.keys(MANIFESTS).join(', ')}`)
  }
  return runManifest(manifest)
}
