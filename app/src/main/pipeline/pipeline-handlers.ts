/**
 * Pipeline Stage Advancement IPC Handlers
 *
 * Exposes pipeline operations (check, advance, conditions) via IPC.
 * Uses the same ok()/fail() pattern as other handler files.
 */

import { ipcMain } from 'electron'
import type { IpcResponse } from '../../shared/types'
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

// ---------------------------------------------------------------------------
// Helper: ok(data) and fail(code, message)
// ---------------------------------------------------------------------------

function ok<T>(data: T): IpcResponse<T> {
  return { status: 'success', data }
}

function fail(error_code: string, message: string): IpcResponse<never> {
  return { status: 'error', error_code, message }
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

    return ok(advanceResult)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return fail('PIPELINE_ADVANCE_FAILED', `Failed to advance stage: ${message}`)
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
  ipcMain.handle('pipeline:conditions', handlePipelineConditions)

  console.log('[pipeline] IPC handlers registered: pipeline:check, pipeline:advance, pipeline:conditions')
}
