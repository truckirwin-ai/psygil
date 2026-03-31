/**
 * Psygil Agent IPC Handlers
 *
 * Registers the following IPC channels:
 * - agent:run — Run an agent with specified parameters
 * - agent:status — Get current agent status (queued/running/done/error)
 */

import { randomUUID } from 'crypto'
import { ipcMain } from 'electron'
import type {
  IpcResponse, AgentRunParams, AgentRunResult, AgentStatusResult, AgentType,
  IngestorRunParams, IngestorRunResult, IngestorGetResultParams,
  DiagnosticianRunParams, DiagnosticianRunResult, DiagnosticianGetResultParams,
  WriterRunParams, WriterRunResult, WriterGetResultParams,
  EditorRunParams, EditorRunResult, EditorGetResultParams,
} from '../../shared/types'
import { runAgent, isValidAgentType, type AgentConfig } from './runner'
import { retrieveApiKey } from '../ai/key-storage'
import { runIngestorAgent, getLatestIngestorResult } from './ingestor'
import { runDiagnosticianAgent, getLatestDiagnosticianResult } from './diagnostician'
import { runWriterAgent, getLatestWriterResult } from './writer'
import { runEditorAgent, getLatestEditorResult } from './editor'

// ---------------------------------------------------------------------------
// In-memory agent status tracking
// ---------------------------------------------------------------------------

interface AgentStatus {
  readonly operationId: string
  readonly agentType: AgentType
  readonly caseId: number
  readonly status: 'queued' | 'running' | 'done' | 'error'
  readonly startedAt: number
  readonly completedAt?: number
  readonly tokenUsage?: {
    readonly input: number
    readonly output: number
  }
  readonly error?: string
}

// Simple map: operationId -> AgentStatus
const agentStatusMap = new Map<string, AgentStatus>()

// Current running operation (one at a time for simplicity)
let currentOperation: string | null = null

// ---------------------------------------------------------------------------
// Helper: Update status
// ---------------------------------------------------------------------------

function updateStatus(operationId: string, status: AgentStatus): void {
  agentStatusMap.set(operationId, status)
}

function getStatus(operationId: string): AgentStatus | undefined {
  return agentStatusMap.get(operationId)
}

function clearStatus(operationId: string): void {
  agentStatusMap.delete(operationId)
}

// ---------------------------------------------------------------------------
// Stub helper — returns a typed success/error envelope
// ---------------------------------------------------------------------------

function ok<T>(data: T): IpcResponse<T> {
  return { status: 'success', data }
}

function fail(error_code: string, message: string): IpcResponse<never> {
  return { status: 'error', error_code, message }
}

// ---------------------------------------------------------------------------
// Agent handlers
// ---------------------------------------------------------------------------

/**
 * agent:run
 * Run an agent with the given configuration and return the result.
 */
async function handleAgentRun(
  _event: Electron.IpcMainInvokeEvent,
  params: AgentRunParams
): Promise<IpcResponse<AgentRunResult>> {
  try {
    // Validate agent type
    if (!isValidAgentType(params.agentType)) {
      return fail('INVALID_AGENT_TYPE', `Invalid agent type: ${params.agentType}`)
    }

    // Validate case ID
    if (!Number.isInteger(params.caseId) || params.caseId <= 0) {
      return fail('INVALID_CASE_ID', `Invalid case ID: ${params.caseId}`)
    }

    // Validate input texts
    if (!Array.isArray(params.inputTexts) || params.inputTexts.length === 0) {
      return fail('INVALID_INPUT', 'inputTexts must be a non-empty array')
    }

    // Retrieve API key from secure storage
    const apiKey = retrieveApiKey()
    if (!apiKey) {
      return fail('NO_API_KEY', 'Anthropic API key not configured')
    }

    // Build agent config
    const config: AgentConfig = {
      agentType: params.agentType,
      systemPrompt: params.systemPrompt,
      caseId: params.caseId,
      inputTexts: params.inputTexts,
      context: params.context,
      maxTokens: params.maxTokens,
      temperature: params.temperature,
    }

    // Create operation ID
    const operationId = randomUUID()

    // Record status as queued
    updateStatus(operationId, {
      operationId,
      agentType: params.agentType,
      caseId: params.caseId,
      status: 'queued',
      startedAt: Date.now(),
    })

    // Run agent
    currentOperation = operationId
    const result = await runAgent(apiKey, config)
    currentOperation = null

    // Update status
    if (result.status === 'success') {
      updateStatus(operationId, {
        operationId,
        agentType: params.agentType,
        caseId: params.caseId,
        status: 'done',
        startedAt: Date.now() - (result.durationMs || 0),
        completedAt: Date.now(),
        tokenUsage: result.tokenUsage,
      })
    } else {
      updateStatus(operationId, {
        operationId,
        agentType: params.agentType,
        caseId: params.caseId,
        status: 'error',
        startedAt: Date.now() - (result.durationMs || 0),
        completedAt: Date.now(),
        error: result.error,
      })
    }

    return ok({
      operationId,
      agentType: params.agentType,
      caseId: params.caseId,
      status: result.status,
      result: result.result,
      error: result.error,
      tokenUsage: result.tokenUsage,
      durationMs: result.durationMs,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Agent execution failed'
    return fail('AGENT_RUN_FAILED', message)
  }
}

/**
 * agent:status
 * Get the current status of an agent operation or the currently running agent.
 */
function handleAgentStatus(
  _event: Electron.IpcMainInvokeEvent,
  operationId?: string
): IpcResponse<AgentStatusResult> {
  try {
    // If operationId provided, look it up
    if (operationId) {
      const status = getStatus(operationId)
      if (!status) {
        return fail('OPERATION_NOT_FOUND', `Operation ${operationId} not found`)
      }
      return ok({
        operationId: status.operationId,
        agentType: status.agentType,
        caseId: status.caseId,
        status: status.status,
        elapsedMs: Date.now() - status.startedAt,
        tokenUsage: status.tokenUsage,
      })
    }

    // Otherwise, return current operation (if any)
    if (!currentOperation) {
      return ok({
        operationId: null,
        agentType: null,
        caseId: null,
        status: 'idle',
        elapsedMs: 0,
      })
    }

    const status = getStatus(currentOperation)
    if (!status) {
      return ok({
        operationId: null,
        agentType: null,
        caseId: null,
        status: 'idle',
        elapsedMs: 0,
      })
    }

    return ok({
      operationId: status.operationId,
      agentType: status.agentType,
      caseId: status.caseId,
      status: status.status,
      elapsedMs: Date.now() - status.startedAt,
      tokenUsage: status.tokenUsage,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to get agent status'
    return fail('AGENT_STATUS_FAILED', message)
  }
}

// ---------------------------------------------------------------------------
// Public: Register agent handlers
// ---------------------------------------------------------------------------

export function registerAgentHandlers(): void {
  ipcMain.handle('agent:run', handleAgentRun)
  ipcMain.handle('agent:status', handleAgentStatus)

  // Ingestor handlers
  ipcMain.handle(
    'ingestor:run',
    async (
      _event: Electron.IpcMainInvokeEvent,
      params: IngestorRunParams
    ): Promise<IpcResponse<IngestorRunResult>> => {
      try {
        const result = await runIngestorAgent(params.caseId)
        return ok({
          operationId: result.operationId,
          caseId: result.caseId,
          status: result.status,
          result: result.result,
          error: result.error,
          tokenUsage: result.tokenUsage,
          durationMs: result.durationMs,
        })
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Ingestor failed'
        return fail('INGESTOR_RUN_FAILED', message)
      }
    }
  )

  ipcMain.handle(
    'ingestor:getResult',
    (_event: Electron.IpcMainInvokeEvent, params: IngestorGetResultParams): IpcResponse<unknown> => {
      try {
        const result = getLatestIngestorResult(params.caseId)
        if (!result) {
          return fail('NO_RESULT', 'No ingestor result found for this case')
        }
        return ok(result)
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to get ingestor result'
        return fail('INGESTOR_GET_FAILED', message)
      }
    }
  )

  // -----------------------------------------------------------------------
  // Diagnostician handlers
  // -----------------------------------------------------------------------

  ipcMain.handle(
    'diagnostician:run',
    async (
      _event: Electron.IpcMainInvokeEvent,
      params: DiagnosticianRunParams
    ): Promise<IpcResponse<DiagnosticianRunResult>> => {
      try {
        const result = await runDiagnosticianAgent(params.caseId)
        return ok({
          operationId: result.operationId,
          caseId: result.caseId,
          status: result.status,
          result: result.result,
          error: result.error,
          tokenUsage: result.tokenUsage,
          durationMs: result.durationMs,
        })
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Diagnostician failed'
        return fail('DIAGNOSTICIAN_RUN_FAILED', message)
      }
    }
  )

  ipcMain.handle(
    'diagnostician:getResult',
    (_event: Electron.IpcMainInvokeEvent, params: DiagnosticianGetResultParams): IpcResponse<unknown> => {
      try {
        const result = getLatestDiagnosticianResult(params.caseId)
        if (!result) {
          return fail('NO_RESULT', 'No diagnostician result found for this case')
        }
        return ok(result)
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to get diagnostician result'
        return fail('DIAGNOSTICIAN_GET_FAILED', message)
      }
    }
  )

  // -----------------------------------------------------------------------
  // Writer handlers
  // -----------------------------------------------------------------------

  ipcMain.handle(
    'writer:run',
    async (
      _event: Electron.IpcMainInvokeEvent,
      params: WriterRunParams
    ): Promise<IpcResponse<WriterRunResult>> => {
      try {
        const result = await runWriterAgent(params.caseId)
        return ok({
          operationId: result.operationId,
          caseId: result.caseId,
          status: result.status,
          result: result.result,
          error: result.error,
          tokenUsage: result.tokenUsage,
          durationMs: result.durationMs,
        })
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Writer failed'
        return fail('WRITER_RUN_FAILED', message)
      }
    }
  )

  ipcMain.handle(
    'writer:getResult',
    (_event: Electron.IpcMainInvokeEvent, params: WriterGetResultParams): IpcResponse<unknown> => {
      try {
        const result = getLatestWriterResult(params.caseId)
        if (!result) {
          return fail('NO_RESULT', 'No writer result found for this case')
        }
        return ok(result)
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to get writer result'
        return fail('WRITER_GET_FAILED', message)
      }
    }
  )

  // -----------------------------------------------------------------------
  // Editor handlers
  // -----------------------------------------------------------------------

  ipcMain.handle(
    'editor:run',
    async (
      _event: Electron.IpcMainInvokeEvent,
      params: EditorRunParams
    ): Promise<IpcResponse<EditorRunResult>> => {
      try {
        const result = await runEditorAgent(params.caseId)
        return ok({
          operationId: result.operationId,
          caseId: result.caseId,
          status: result.status,
          result: result.result,
          error: result.error,
          tokenUsage: result.tokenUsage,
          durationMs: result.durationMs,
        })
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Editor failed'
        return fail('EDITOR_RUN_FAILED', message)
      }
    }
  )

  ipcMain.handle(
    'editor:getResult',
    (_event: Electron.IpcMainInvokeEvent, params: EditorGetResultParams): IpcResponse<unknown> => {
      try {
        const result = getLatestEditorResult(params.caseId)
        if (!result) {
          return fail('NO_RESULT', 'No editor result found for this case')
        }
        return ok(result)
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to get editor result'
        return fail('EDITOR_GET_FAILED', message)
      }
    }
  )
}
