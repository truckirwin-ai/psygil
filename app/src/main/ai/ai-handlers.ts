/**
 * Psygil AI IPC Handlers
 *
 * Registers IPC handlers for AI operations:
 * - ai:complete, Call Claude with system prompt + user message
 * - ai:testConnection, Test API key and connectivity
 *
 * Spec reference: docs/engineering/02_ipc_api_contracts.md (Boundary 3)
 */

import { ipcMain } from 'electron'
import type { IpcResponse } from '../../shared/types'
import type { AiCompleteParams, AiCompleteResult, AiTestConnectionParams, AiTestConnectionResult } from '../../shared/types'
import { callClaude } from './claude-client'
import { retrieveApiKey } from './key-storage'

// ---------------------------------------------------------------------------
// Stub helper, returns a typed success or error envelope
// ---------------------------------------------------------------------------

function ok<T>(data: T): IpcResponse<T> {
  return { status: 'success', data }
}

function fail(error_code: string, message: string): IpcResponse<never> {
  return { status: 'error', error_code, message }
}

// ---------------------------------------------------------------------------
// AI handlers
// ---------------------------------------------------------------------------

/**
 * Register all AI-related IPC handlers
 */
export function registerAiHandlers(): void {
  ipcMain.handle(
    'ai:complete',
    async (_event, params: AiCompleteParams): Promise<IpcResponse<AiCompleteResult>> => {
      try {
        // Validate input
        if (!params.systemPrompt || !params.userMessage) {
          return fail('INVALID_REQUEST', 'systemPrompt and userMessage are required')
        }

        // Get API key from storage
        const apiKey = retrieveApiKey()
        if (!apiKey) {
          return fail('NO_API_KEY', 'Claude API key not configured')
        }

        // Call Claude
        const response = await callClaude(apiKey, {
          systemPrompt: params.systemPrompt,
          userMessage: params.userMessage,
          model: params.model,
          maxTokens: params.maxTokens,
        })

        return ok(response)
      } catch (e) {
        const message = e instanceof Error ? e.message : 'AI completion failed'
        console.error('[ai:complete] error:', message)

        // Map error types for user-facing messages
        if (message.includes('Invalid API key')) {
          return fail('AUTHENTICATION_FAILED', 'Invalid Claude API key')
        }
        if (message.includes('Rate limited')) {
          return fail('RATE_LIMITED', message)
        }
        if (message.includes('temporarily unavailable')) {
          return fail('SERVICE_UNAVAILABLE', 'Claude API temporarily unavailable')
        }
        if (message.includes('Cannot reach')) {
          return fail('NETWORK_ERROR', 'Cannot reach Claude API')
        }

        return fail('AI_ERROR', message)
      }
    }
  )

  ipcMain.handle(
    'ai:testConnection',
    async (_event, _params: AiTestConnectionParams): Promise<IpcResponse<AiTestConnectionResult>> => {
      try {
        // Get API key from storage
        const apiKey = retrieveApiKey()
        if (!apiKey) {
          return ok({
            connected: false,
            error: 'Claude API key not configured',
          })
        }

        // Send minimal test message
        const response = await callClaude(apiKey, {
          systemPrompt: 'You are a helpful assistant.',
          userMessage: 'Say "ok".',
          maxTokens: 10,
        })

        return ok({
          connected: true,
          model: response.model,
        })
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Connection test failed'
        console.error('[ai:testConnection] error:', message)

        return ok({
          connected: false,
          error: message,
        })
      }
    }
  )
}
