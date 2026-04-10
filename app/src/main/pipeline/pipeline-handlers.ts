/**
 * Pipeline Stage Advancement IPC Handlers
 *
 * Exposes pipeline operations (check, advance, conditions) via IPC.
 * Uses the same ok()/fail() pattern as other handler files.
 */

import { ipcMain, BrowserWindow } from 'electron'
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
  PipelineSetStageParams,
  PipelineSetStageResult,
  PipelineConditionsParams,
  PipelineConditionsResult,
} from '../../shared/types'

// ---------------------------------------------------------------------------
// Helper: ok(data) and fail(code, message)
// ---------------------------------------------------------------------------

function ok<T>(data: T): IpcResponse<T> {
  return { status: 'success', data }
}

function fail(error_code: string, message: string): IpcResponse<never> {
  return { status: 'error', error_code, message }
}

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
// Handler: pipeline:set-stage  (arbitrary stage change, e.g. Kanban drag-drop)
// ---------------------------------------------------------------------------

function handlePipelineSetStage(
  _event: Electron.IpcMainInvokeEvent,
  params: PipelineSetStageParams,
): IpcResponse<PipelineSetStageResult> {
  try {
    const db = getSqlite()
    const row = db.prepare('SELECT workflow_current_stage FROM cases WHERE case_id = ?').get(params.caseId) as { workflow_current_stage: string } | undefined
    if (!row) return fail('CASE_NOT_FOUND', `Case ${params.caseId} not found`)

    const previousStage = row.workflow_current_stage || 'onboarding'
    const newStatus = params.stage === 'complete' ? 'completed' : 'in_progress'

    db.prepare('UPDATE cases SET workflow_current_stage = ?, case_status = ?, last_modified = datetime(\'now\') WHERE case_id = ?')
      .run(params.stage, newStatus, params.caseId)

    broadcastCasesChanged(params.caseId, params.stage, previousStage)
    return ok({ success: true, newStage: params.stage, previousStage })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return fail('PIPELINE_SET_STAGE_FAILED', `Failed to set stage: ${message}`)
  }
}

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
  ipcMain.handle('pipeline:set-stage', handlePipelineSetStage)
  ipcMain.handle('pipeline:conditions', handlePipelineConditions)
}
