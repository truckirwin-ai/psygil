/**
 * Psygil AI Provider Abstraction
 *
 * Single entry point for all AI completions. Routes requests through either
 * the Psygil passthrough proxy (Trial/Solo) or a direct BYOK provider client
 * (Practice/Enterprise with their own key).
 *
 * Every agent calls completeAi() instead of callClaude() directly. The
 * routing decision is made here based on the persisted AiConfig.mode.
 *
 * The passthrough proxy is a Fly.io service at api.psygil.com that injects
 * Foundry SMB's provider keys server-side. Users never see an API key in
 * passthrough mode; their license key is the authentication token.
 */

import { callClaude } from './claude-client'
import { callPsygilProxy } from './psygil-proxy'
import { callOpenAi } from './openai-client'
import { callGemini } from './google-client'
import { retrieveApiKey, detectProvider } from './key-storage'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AiProvider = 'psygil' | 'anthropic' | 'openai' | 'google'

export interface AiCompletionRequest {
  readonly systemPrompt: string
  readonly userMessage: string
  readonly model?: string
  readonly maxTokens?: number
  readonly temperature?: number
}

export interface AiCompletionResponse {
  readonly content: string
  readonly model: string
  readonly inputTokens: number
  readonly outputTokens: number
  readonly stopReason: string
  readonly provider: AiProvider
}

export type AiRoutingMode = 'passthrough' | 'byok'

// ---------------------------------------------------------------------------
// Config resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the current AI routing mode from the persisted setup config.
 * Falls back to 'passthrough' when no config exists (Trial/Solo default).
 */
function resolveRoutingMode(): AiRoutingMode {
  try {
    const { app } = require('electron')
    const { join } = require('path')
    const fs = require('fs')
    const setupPath = join(app.getPath('userData'), 'psygil-setup.json')
    if (fs.existsSync(setupPath)) {
      const raw = fs.readFileSync(setupPath, 'utf-8')
      const config = JSON.parse(raw)
      const mode = config?.ai?.mode
      if (mode === 'byok') return 'byok'
    }
  } catch {
    // Non-fatal: default to passthrough
  }
  return 'passthrough'
}

/**
 * Resolve the license key for passthrough authentication.
 */
function resolveLicenseKey(): string | null {
  try {
    const { app } = require('electron')
    const { join } = require('path')
    const fs = require('fs')
    const setupPath = join(app.getPath('userData'), 'psygil-setup.json')
    if (fs.existsSync(setupPath)) {
      const raw = fs.readFileSync(setupPath, 'utf-8')
      const config = JSON.parse(raw)
      // The license key is stored as part of the setup config
      // but not the LicenseInfo object; it was validated during setup.
      // For passthrough auth, we read the raw key from a separate field.
      return config?.licenseKey ?? config?.license?.key ?? null
    }
  } catch {
    // Non-fatal
  }
  return null
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Route a completion request through the configured provider.
 *
 * In passthrough mode: sends to api.psygil.com with the license key.
 * In BYOK mode: detects the provider from the stored key prefix and
 * calls the appropriate client (Anthropic, OpenAI, or Google).
 *
 * This is the ONLY function agents should call for AI completions.
 */
export async function completeAi(
  request: AiCompletionRequest,
): Promise<AiCompletionResponse> {
  const mode = resolveRoutingMode()

  if (mode === 'passthrough') {
    return callPassthrough(request)
  }

  return callByok(request)
}

// ---------------------------------------------------------------------------
// Routing implementations
// ---------------------------------------------------------------------------

async function callPassthrough(
  request: AiCompletionRequest,
): Promise<AiCompletionResponse> {
  const licenseKey = resolveLicenseKey()

  // If no license key is available (e.g., expired trial, corrupted config),
  // fall back to BYOK if a key is stored there. This prevents a hard lockout.
  if (!licenseKey) {
    const byokKey = retrieveApiKey()
    if (byokKey) {
      process.stderr.write('[ai:provider] No license key for passthrough; falling back to stored BYOK key.\n')
      return callByok(request)
    }
    throw new Error(
      'No AI configuration available. Enter a license key (for Psygil AI) or configure your own API key in Settings > AI.',
    )
  }

  try {
    return await callPsygilProxy(licenseKey, request)
  } catch (e) {
    // If the proxy is unreachable (server down, network issue), try BYOK
    // as a graceful fallback so the user is not blocked.
    const byokKey = retrieveApiKey()
    if (byokKey) {
      process.stderr.write(
        `[ai:provider] Psygil proxy unreachable (${(e as Error).message}); falling back to stored BYOK key.\n`,
      )
      return callByok(request)
    }
    throw e
  }
}

async function callByok(
  request: AiCompletionRequest,
): Promise<AiCompletionResponse> {
  const apiKey = retrieveApiKey()
  if (!apiKey) {
    throw new Error(
      'No API key configured. Go to Settings > AI and enter your API key, or switch to Psygil AI (passthrough mode).',
    )
  }

  const provider = detectProvider(apiKey)

  switch (provider) {
    case 'anthropic': {
      const resp = await callClaude(apiKey, {
        systemPrompt: request.systemPrompt,
        userMessage: request.userMessage,
        model: request.model,
        maxTokens: request.maxTokens,
        temperature: request.temperature,
      })
      return { ...resp, provider: 'anthropic' }
    }
    case 'openai': {
      return callOpenAi(apiKey, request)
    }
    case 'google': {
      return callGemini(apiKey, request)
    }
    default:
      throw new Error(`Unknown API key provider. Key prefix not recognized. Supported: Anthropic (sk-ant-), OpenAI (sk-), Google (AIza).`)
  }
}
