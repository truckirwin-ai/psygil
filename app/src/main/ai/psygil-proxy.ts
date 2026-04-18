/**
 * Psygil Passthrough Proxy Client
 *
 * Sends AI completion requests to api.psygil.com. The server injects
 * Foundry SMB's provider API keys, selects the model based on the
 * license tier, and returns a normalized response. The user's license
 * key is the only credential transmitted; no provider API keys exist
 * on the desktop.
 *
 * The proxy URL is configurable via PSYGIL_API_URL env var for staging
 * and local development. Production default: https://api.psygil.com
 */

import type { AiCompletionRequest, AiCompletionResponse } from './provider'

const DEFAULT_PROXY_URL = 'https://api.psygil.com'
const PROXY_TIMEOUT_MS = 60_000

function getProxyUrl(): string {
  return process.env.PSYGIL_API_URL?.trim() || DEFAULT_PROXY_URL
}

function getClientVersion(): string {
  try {
    const pkg = require('../../../package.json')
    return pkg.version ?? '0.0.0'
  } catch {
    return '0.0.0'
  }
}

interface ProxyResponse {
  readonly content: string
  readonly model: string
  readonly inputTokens: number
  readonly outputTokens: number
  readonly stopReason: string
  readonly provider: string
}

interface ProxyError {
  readonly error: string
  readonly code?: string
  readonly retryAfter?: number
}

/**
 * Call the Psygil AI proxy with the user's license key as authentication.
 *
 * The proxy handles:
 *   - License validation (tier, expiry, rate limits)
 *   - Provider selection (Anthropic by default, configurable server-side)
 *   - Model selection (Sonnet 4.5 default, tier-based overrides)
 *   - Foundry SMB API key injection
 *   - Usage tracking per license
 *
 * @param licenseKey The user's Psygil license key (PSGIL-XXXX-XXXX-XXXX-XXXX)
 * @param request The completion request (system prompt, user message, etc.)
 */
export async function callPsygilProxy(
  licenseKey: string,
  request: AiCompletionRequest,
): Promise<AiCompletionResponse> {
  const url = `${getProxyUrl()}/v1/ai/complete`

  const body = {
    systemPrompt: request.systemPrompt,
    userMessage: request.userMessage,
    model: request.model ?? undefined,
    maxTokens: request.maxTokens ?? 4096,
    temperature: request.temperature ?? 0,
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Psygil-License': licenseKey,
        'X-Psygil-Client-Version': getClientVersion(),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    if (response.status === 401) {
      throw new Error('License key rejected by Psygil API. Check that your license is active and not expired.')
    }

    if (response.status === 429) {
      const retryAfter = response.headers.get('retry-after') ?? '60'
      throw new Error(`Rate limited by Psygil API. You have reached your monthly evaluation cap. Retry after ${retryAfter} seconds, or upgrade your plan for a higher limit.`)
    }

    if (response.status === 402) {
      throw new Error('Monthly evaluation cap exceeded. Additional evaluations are $1.50 each. Upgrade your plan or wait until next month.')
    }

    if (response.status === 503) {
      throw new Error('Psygil AI service is temporarily unavailable. The app will fall back to your stored API key if one is configured.')
    }

    if (!response.ok) {
      let errorMessage = `Psygil API returned status ${response.status}`
      try {
        const errorData = (await response.json()) as ProxyError
        if (errorData.error) errorMessage = errorData.error
      } catch {
        try { errorMessage = await response.text() } catch { /* use default */ }
      }
      throw new Error(errorMessage)
    }

    const data = (await response.json()) as ProxyResponse

    return {
      content: data.content,
      model: data.model,
      inputTokens: data.inputTokens,
      outputTokens: data.outputTokens,
      stopReason: data.stopReason,
      provider: (data.provider === 'anthropic' || data.provider === 'openai' || data.provider === 'google')
        ? data.provider
        : 'psygil',
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      throw new Error('Psygil AI request timed out after 60 seconds. Check your internet connection.')
    }
    throw e
  } finally {
    clearTimeout(timeout)
  }
}
