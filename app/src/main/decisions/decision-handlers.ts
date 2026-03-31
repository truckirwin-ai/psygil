/**
 * Diagnostic Decision IPC Handlers — Sprint 7.3
 *
 * Channels:
 * - diagnosticDecision:save — Save (upsert) a diagnostic decision
 * - diagnosticDecision:list — List all decisions for a case
 * - diagnosticDecision:delete — Delete a decision
 */

import { ipcMain } from 'electron'
import type {
  IpcResponse,
  DiagnosticDecisionSaveParams,
  DiagnosticDecisionRow,
  DiagnosticDecisionListParams,
  DiagnosticDecisionDeleteParams,
} from '../../shared/types'
import { saveDecision, listDecisions, deleteDecision } from './index'

function ok<T>(data: T): IpcResponse<T> {
  return { status: 'success', data }
}

function fail(error_code: string, message: string): IpcResponse<never> {
  return { status: 'error', error_code, message }
}

export function registerDecisionHandlers(): void {
  ipcMain.handle(
    'diagnosticDecision:save',
    (_event: Electron.IpcMainInvokeEvent, params: DiagnosticDecisionSaveParams): IpcResponse<DiagnosticDecisionRow> => {
      try {
        const row = saveDecision(params)
        return ok(row)
      } catch (e) {
        return fail('DECISION_SAVE_FAILED', e instanceof Error ? e.message : 'Failed to save decision')
      }
    }
  )

  ipcMain.handle(
    'diagnosticDecision:list',
    (_event: Electron.IpcMainInvokeEvent, params: DiagnosticDecisionListParams): IpcResponse<readonly DiagnosticDecisionRow[]> => {
      try {
        const rows = listDecisions(params.case_id)
        return ok(rows)
      } catch (e) {
        return fail('DECISION_LIST_FAILED', e instanceof Error ? e.message : 'Failed to list decisions')
      }
    }
  )

  ipcMain.handle(
    'diagnosticDecision:delete',
    (_event: Electron.IpcMainInvokeEvent, params: DiagnosticDecisionDeleteParams): IpcResponse<void> => {
      try {
        deleteDecision(params.case_id, params.diagnosis_key)
        return ok(undefined as unknown as void)
      } catch (e) {
        return fail('DECISION_DELETE_FAILED', e instanceof Error ? e.message : 'Failed to delete decision')
      }
    }
  )
}
