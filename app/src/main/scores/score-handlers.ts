/**
 * Test Score IPC Handlers, Sprint 8
 *
 * Channels:
 * - testScores:save, Save (upsert) test scores for a case + instrument
 * - testScores:list, List all test score records for a case
 * - testScores:delete, Delete a test score record by ID
 */

import { ipcMain } from 'electron'
import { ok, fail } from '../../shared/types'
import type {
  IpcResponse,
  TestScoreSaveParams,
  TestScoreListParams,
} from '../../shared/types'
import type { TestScoreRow } from './index'
import { saveTestScores, listTestScores, deleteTestScores } from './index'

export function registerScoreHandlers(): void {
  ipcMain.handle(
    'testScores:save',
    (_event: Electron.IpcMainInvokeEvent, params: TestScoreSaveParams): IpcResponse<TestScoreRow> => {
      try {
        const row = saveTestScores(params)
        return ok(row)
      } catch (e) {
        return fail('TEST_SCORE_SAVE_FAILED', e instanceof Error ? e.message : 'Failed to save test scores')
      }
    }
  )

  ipcMain.handle(
    'testScores:list',
    (_event: Electron.IpcMainInvokeEvent, params: TestScoreListParams): IpcResponse<readonly TestScoreRow[]> => {
      try {
        const rows = listTestScores(params.case_id)
        return ok(rows)
      } catch (e) {
        return fail('TEST_SCORE_LIST_FAILED', e instanceof Error ? e.message : 'Failed to list test scores')
      }
    }
  )

  ipcMain.handle(
    'testScores:delete',
    (_event: Electron.IpcMainInvokeEvent, params: { id: number }): IpcResponse<void> => {
      try {
        deleteTestScores(params.id)
        return ok(undefined as unknown as void)
      } catch (e) {
        return fail('TEST_SCORE_DELETE_FAILED', e instanceof Error ? e.message : 'Failed to delete test score')
      }
    }
  )
}
