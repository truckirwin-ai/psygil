/**
 * Diagnostic Decision IPC Handlers, Sprint 7.3
 *
 * Channels:
 * - diagnosticDecision:save, Save (upsert) a diagnostic decision
 * - diagnosticDecision:list, List all decisions for a case
 * - diagnosticDecision:delete, Delete a decision
 */

import { ipcMain } from 'electron'
import { ok, fail } from '../../shared/types'
import type {
  IpcResponse,
  DiagnosticDecisionSaveParams,
  DiagnosticDecisionRow,
  DiagnosticDecisionListParams,
  DiagnosticDecisionDeleteParams,
  ClinicalFormulationSaveParams,
  ClinicalFormulationGetParams,
  ClinicalFormulationRow,
} from '../../shared/types'
import { saveDecision, listDecisions, deleteDecision, saveFormulation, getFormulation } from './index'

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

  ipcMain.handle(
    'clinicalFormulation:save',
    (_event: Electron.IpcMainInvokeEvent, params: ClinicalFormulationSaveParams): IpcResponse<ClinicalFormulationRow> => {
      try {
        const row = saveFormulation(params)
        return ok(row)
      } catch (e) {
        return fail('FORMULATION_SAVE_FAILED', e instanceof Error ? e.message : 'Failed to save formulation')
      }
    }
  )

  ipcMain.handle(
    'clinicalFormulation:get',
    (_event: Electron.IpcMainInvokeEvent, params: ClinicalFormulationGetParams): IpcResponse<ClinicalFormulationRow | null> => {
      try {
        const row = getFormulation(params.case_id)
        return ok(row)
      } catch (e) {
        return fail('FORMULATION_GET_FAILED', e instanceof Error ? e.message : 'Failed to get formulation')
      }
    }
  )
}
