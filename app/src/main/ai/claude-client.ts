/**
 * Psygil Claude API Client
 *
 * Typed HTTP client for Anthropic Claude API (Messages API).
 * Uses Node.js 18+ native fetch API with TLS verification.
 *
 * Spec reference: docs/engineering/02_ipc_api_contracts.md (Boundary 3)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClaudeRequestOptions {
  readonly systemPrompt: string
  readonly userMessage: string
  readonly model?: string
  readonly maxTokens?: number
  readonly temperature?: number
}

export interface ClaudeResponse {
  readonly content: string
  readonly model: string
  readonly inputTokens: number
  readonly outputTokens: number
  readonly stopReason: string
}

interface AnthropicMessage {
  id: string
  type: string
  role: string
  content: Array<{
    type: string
    text: string
  }>
  model: string
  stop_reason: string
  usage: {
    input_tokens: number
    output_tokens: number
  }
}

interface AnthropicError {
  type: string
  error: {
    type: string
    message: string
  }
}

// ---------------------------------------------------------------------------
// Anthropic API Error Handler
// ---------------------------------------------------------------------------

class AnthropicApiError extends Error {
  constructor(
    readonly statusCode: number,
    readonly errorType: string,
    message: string
  ) {
    super(message)
    this.name = 'AnthropicApiError'
  }
}

// ---------------------------------------------------------------------------
// Claude HTTP Client
// ---------------------------------------------------------------------------

/**
 * Call Claude API with the given system prompt and user message.
 *
 * @param apiKey - Anthropic API key
 * @param options - Request options (system prompt, user message, model, etc.)
 * @returns Parsed response with content, token counts, and metadata
 * @throws AnthropicApiError on API errors
 */
export async function callClaude(
  apiKey: string,
  options: ClaudeRequestOptions
): Promise<ClaudeResponse> {
  const {
    systemPrompt,
    userMessage,
    model = 'claude-sonnet-4-20250514',
    maxTokens = 4096,
    temperature = 0,
  } = options

  // Validate inputs
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error('API key is required')
  }
  if (!systemPrompt || systemPrompt.trim().length === 0) {
    throw new Error('System prompt is required')
  }
  if (!userMessage || userMessage.trim().length === 0) {
    throw new Error('User message is required')
  }

  // Build request body
  const requestBody = {
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: userMessage,
      },
    ],
    temperature,
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(requestBody),
    })

    // Handle different status codes
    if (response.status === 401) {
      throw new AnthropicApiError(401, 'AUTHENTICATION_FAILED', 'Invalid API key')
    }

    if (response.status === 429) {
      const retryAfter = response.headers.get('retry-after') || '60'
      const message = `Rate limited. Retry after ${retryAfter} seconds`
      throw new AnthropicApiError(429, 'RATE_LIMIT', message)
    }

    if (response.status === 500 || response.status === 502 || response.status === 503) {
      throw new AnthropicApiError(
        response.status,
        'SERVICE_UNAVAILABLE',
        'API temporarily unavailable'
      )
    }

    if (!response.ok) {
      // Try to parse error response
      let errorMessage = 'Unexpected API response'
      try {
        const errorData = (await response.json()) as AnthropicError
        if (errorData.error?.message) {
          errorMessage = errorData.error.message
        }
      } catch {
        // Fall back to text if not valid JSON
        try {
          errorMessage = await response.text()
        } catch {
          errorMessage = `HTTP ${response.status}`
        }
      }
      throw new AnthropicApiError(response.status, 'API_ERROR', errorMessage)
    }

    // Parse successful response
    const data = (await response.json()) as AnthropicMessage
    const textContent = data.content.find((c) => c.type === 'text')

    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text content in API response')
    }

    return {
      content: textContent.text,
      model: data.model,
      inputTokens: data.usage.input_tokens,
      outputTokens: data.usage.output_tokens,
      stopReason: data.stop_reason,
    }
  } catch (e) {
    if (e instanceof AnthropicApiError) {
      throw e
    }
    if (e instanceof Error) {
      // Network or timeout errors
      if (e.message.includes('fetch')) {
        throw new AnthropicApiError(0, 'NETWORK_ERROR', `Cannot reach Anthropic API: ${e.message}`)
      }
      throw e
    }
    throw new Error('Claude API call failed')
  }
}
