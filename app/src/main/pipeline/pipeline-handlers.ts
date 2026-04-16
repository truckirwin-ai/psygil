/**
 * Pipeline Stage Advancement IPC Handlers
 *
 * Exposes pipeline operations (check, advance, conditions) via IPC.
 * Uses the same ok()/fail() pattern as other handler files.
 */

import { ipcMain, BrowserWindow } from 'electron'
import { ok, fail } from '../../shared/types'
import type { IpcResponse } from '../../shared/types'
import { getSqlite } from '../db/connection'
import {
  checkStageAdvancement,
  advanceStage,
  getStageConditions,
  type StageAdvancementCheck,
} from './index'
import type {
  PipelineCheckParams,
  PipelineCheckResult,
  PipelineAdvanceParams,
  PipelineAdvanceResult,
  PipelineConditionsParams,
  PipelineConditionsResult,
} from '../../shared/types'

// Broadcast a cases:changed event so renderer can refresh kanban/lists
function broadcastCasesChanged(caseId: number, newStage: string, previousStage: string): void {
  const windows = BrowserWindow.getAllWindows()
  for (const win of windows) {
    if (!win.isDestroyed()) {
      win.webContents.send('cases:changed', { caseId, newStage, previousStage })
    }
  }
}

// ---------------------------------------------------------------------------
// Handler: pipeline:check
// ---------------------------------------------------------------------------

function handlePipelineCheck(
  _event: Electron.IpcMainInvokeEvent,
  params: PipelineCheckParams,
): IpcResponse<PipelineCheckResult> {
  try {
    const check = checkStageAdvancement(params.caseId)

    const result: PipelineCheckResult = {
      canAdvance: check.canAdvance,
      currentStage: check.currentStage,
      nextStage: check.nextStage,
      reason: check.reason,
    }

    return ok(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return fail('PIPELINE_CHECK_FAILED', `Failed to check stage advancement: ${message}`)
  }
}

// ---------------------------------------------------------------------------
// Handler: pipeline:advance
// ---------------------------------------------------------------------------

function handlePipelineAdvance(
  _event: Electron.IpcMainInvokeEvent,
  params: PipelineAdvanceParams,
): IpcResponse<PipelineAdvanceResult> {
  try {
    const result = advanceStage(params.caseId)

    const advanceResult: PipelineAdvanceResult = {
      success: result.success,
      newStage: result.newStage,
      previousStage: result.previousStage,
    }

    if (result.success && result.newStage) {
      broadcastCasesChanged(params.caseId, result.newStage, result.previousStage ?? '')
    }

    return ok(advanceResult)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return fail('PIPELINE_ADVANCE_FAILED', `Failed to advance stage: ${message}`)
  }
}

// ---------------------------------------------------------------------------
// Handler: pipeline:set-stage  (removed per Phase B.4 ship plan)
//
// The arbitrary-stage-change handler was a gate-enforcement backdoor: it
// updated `workflow_current_stage` without re-validating preconditions,
// which let any keyboard or scripted caller skip a gate. All legitimate
// stage advancement now goes through `pipeline:advance`, which enforces
// gate conditions server-side via checkStageAdvancement().
//
// A future supervisor-unlock path (Phase B.4 residual / Phase D) will
// reintroduce an audited, role-gated override. Until then, there is no
// IPC surface for unilateral stage setting.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Handler: pipeline:conditions
// ---------------------------------------------------------------------------

function handlePipelineConditions(
  _event: Electron.IpcMainInvokeEvent,
  params: PipelineConditionsParams,
): IpcResponse<PipelineConditionsResult> {
  try {
    const conditions = getStageConditions(params.stage as any)

    const result: PipelineConditionsResult = {
      stage: params.stage,
      conditions,
    }

    return ok(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return fail('PIPELINE_CONDITIONS_FAILED', `Failed to retrieve conditions: ${message}`)
  }
}

// ---------------------------------------------------------------------------
// Public: Register all pipeline handlers
// ---------------------------------------------------------------------------

export function registerPipelineHandlers(): void {
  ipcMain.handle('pipeline:check', handlePipelineCheck)
  ipcMain.handle('pipeline:advance', handlePipelineAdvance)
  // pipeline:set-stage intentionally removed, see comment above.
  ipcMain.handle('pipeline:conditions', handlePipelineConditions)
}
