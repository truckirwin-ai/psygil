/**
 * Psygil Agent Runner Framework
 *
 * Generic agent executor shared by all 5 agents (Ingestor, Psychometrician, Diagnostician, Writer, Editor).
 * Coordinates the PII redaction → Claude API → rehydration pipeline.
 *
 * The runner lives in the main process and calls sidecar functions directly (not via IPC).
 */

import { randomUUID } from 'crypto'
import { callClaude, type ClaudeResponse } from '../ai/claude-client'
import { redact, rehydrate, destroyMap } from '../pii/pii_detector'
import { scanForProhibited } from '../publish/hardRuleScan'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AgentType = 'ingestor' | 'psychometrician' | 'diagnostician' | 'writer' | 'editor'

/**
 * Configuration for running an agent.
 */
export interface AgentConfig {
  readonly agentType: AgentType
  readonly systemPrompt: string
  readonly caseId: number
  readonly inputTexts: readonly string[]
  readonly context?: string
  readonly maxTokens?: number
  readonly temperature?: number
}

/**
 * Successful agent run. `result` is guaranteed and typed as T.
 */
export interface AgentSuccess<T> {
  readonly status: 'success'
  readonly agentType: string
  readonly caseId: number
  readonly operationId: string
  readonly result: T
  readonly error?: never
  readonly tokenUsage?: {
    readonly input: number
    readonly output: number
  }
  readonly durationMs: number
}

/**
 * Failed agent run. `error` is guaranteed; `result` is absent.
 */
export interface AgentError {
  readonly status: 'error'
  readonly agentType: string
  readonly caseId: number
  readonly operationId: string
  readonly result?: never
  readonly error: string
  readonly tokenUsage?: {
    readonly input: number
    readonly output: number
  }
  readonly durationMs: number
}

/**
 * Discriminated union on `status`. Narrow with `isSuccessful(result)`.
 */
export type AgentResult<T = unknown> = AgentSuccess<T> | AgentError

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REDACTION_CONTEXT_MAP: Record<AgentType, 'intake' | 'report' | 'review' | 'diagnostics'> = {
  ingestor: 'intake',
  psychometrician: 'intake',
  diagnostician: 'diagnostics',
  writer: 'report',
  editor: 'review',
}

// ---------------------------------------------------------------------------
// Public: Run an agent
// ---------------------------------------------------------------------------

/**
 * Execute an agent with the given configuration.
 *
 * Pipeline:
 * 1. Generate operationId
 * 2. Concatenate inputTexts
 * 3. Redact PHI → UNIDs via sidecar
 * 4. Call Claude API with systemPrompt
 * 5. Parse JSON response
 * 6. Rehydrate UNIDs → PHI
 * 7. Destroy UNID map
 * 8. Return structured result
 *
 * @param apiKey - Anthropic API key
 * @param config - Agent configuration
 * @returns AgentResult with structured output
 */
export async function runAgent<T = unknown>(
  apiKey: string,
  config: AgentConfig
): Promise<AgentResult<T>> {
  const startTime = Date.now()
  const operationId = randomUUID()

  try {
    // 1. Concatenate all input texts
    const concatenated = config.inputTexts.join('\n\n')

    // 2. Redact PHI to UNIDs
    const redactionContext = REDACTION_CONTEXT_MAP[config.agentType]
    const redactionResult = await redact(concatenated, operationId, redactionContext)
    const redactedText = redactionResult.redactedText

    // 3. Call Claude API with redacted text
    let claudeResponse: ClaudeResponse
    try {
      claudeResponse = await callClaude(apiKey, {
        systemPrompt: config.systemPrompt,
        userMessage: redactedText,
        model: 'claude-sonnet-4-20250514',
        maxTokens: config.maxTokens ?? 4096,
        temperature: config.temperature ?? 0,
      })
    } catch (e) {
      // If Claude fails, clean up UNID map before throwing
      await destroyMap(operationId)
      throw e
    }

    // 4. Rehydrate response text
    const rehydrationResult = await rehydrate(claudeResponse.content, operationId)
    const fullText = rehydrationResult.fullText

    // 4a. HARD RULE guard (per CLAUDE.md): reject any Claude output that
    // contains em dashes, en dashes, or AI watermark strings before the
    // result can be persisted to agent_results. Throws HardRuleViolationError
    // which falls into the outer catch and produces an AgentError with the
    // violation surfaced in `error`.
    scanForProhibited(fullText, { label: `${config.agentType}:${operationId}` })

    // 5. Parse rehydrated text as JSON. Claude often wraps JSON in
    // ```json ... ``` fences; strip those before parsing so downstream
    // consumers always see structured objects rather than raw strings.
    let parsedResult: T
    const stripFences = (raw: string): string => {
      const trimmed = raw.trim()
      const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
      return fenced ? fenced[1].trim() : trimmed
    }
    try {
      parsedResult = JSON.parse(stripFences(fullText)) as T
    } catch {
      // If not valid JSON, treat the full text as the result
      parsedResult = fullText as unknown as T
    }

    // 6. Destroy UNID map (redundant if rehydrate succeeds, but explicit for safety)
    await destroyMap(operationId)

    const durationMs = Date.now() - startTime

    return {
      status: 'success',
      agentType: config.agentType,
      caseId: config.caseId,
      operationId,
      result: parsedResult,
      tokenUsage: {
        input: claudeResponse.inputTokens,
        output: claudeResponse.outputTokens,
      },
      durationMs,
    }
  } catch (e) {
    // Ensure UNID map is always destroyed, even on error
    try {
      await destroyMap(operationId)
    } catch {
      // Silently fail if destroy fails
    }

    const durationMs = Date.now() - startTime
    const errorMessage = e instanceof Error ? e.message : 'Unknown error'

    return {
      status: 'error',
      agentType: config.agentType,
      caseId: config.caseId,
      operationId,
      error: errorMessage,
      durationMs,
    }
  }
}

// ---------------------------------------------------------------------------
// Type guards and utilities
// ---------------------------------------------------------------------------

/**
 * Check if a value is a valid agent type.
 */
export function isValidAgentType(value: unknown): value is AgentType {
  return (
    typeof value === 'string' &&
    ['ingestor', 'psychometrician', 'diagnostician', 'writer', 'editor'].includes(value)
  )
}

/**
 * Check if an AgentResult is successful. Narrows to AgentSuccess<T> so
 * `result.result` is accessible and typed as T.
 */
export function isSuccessful<T>(result: AgentResult<T>): result is AgentSuccess<T> {
  return result.status === 'success'
}
