/**
 * Psygil AI Error Handler
 *
 * Classifies Claude API errors and generates user-facing messages.
 * CRITICAL: Never includes API keys in error messages or logs.
 * Spec reference: BUILD_MANIFEST.md Task 4.5
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AiErrorCode =
  | 'INVALID_API_KEY'
  | 'RATE_LIMITED'
  | 'API_UNAVAILABLE'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'INVALID_RESPONSE'
  | 'CONTENT_FILTERED'
  | 'CONTEXT_TOO_LONG'
  | 'UNKNOWN_ERROR'

export interface AiError {
  readonly code: AiErrorCode
  readonly message: string           // User-facing message
  readonly technicalDetail?: string  // For logs only
  readonly retryable: boolean
  readonly suggestedAction?: string  // e.g., "Check your API key in Settings"
}

// ---------------------------------------------------------------------------
// Error Classification
// ---------------------------------------------------------------------------

/**
 * Classify an HTTP response or error into a structured AiError.
 *
 * @param statusCode - HTTP status code (null for non-HTTP errors)
 * @param responseBody - HTTP response body or error message
 * @param error - Optional Error object for network/timeout errors
 * @returns Structured error with classification, user message, and metadata
 */
export function classifyError(
  statusCode: number | null,
  responseBody: string | null,
  error?: Error
): AiError {
  // Network/timeout errors
  if (!statusCode || statusCode === 0) {
    const message = error?.message ?? 'unknown error'

    if (isNetworkError(message)) {
      return {
        code: 'NETWORK_ERROR',
        message: 'Cannot connect to the AI service. Check your internet connection.',
        technicalDetail: message,
        retryable: true,
        suggestedAction: 'Check your internet connection and try again',
      }
    }

    if (isTimeoutError(message)) {
      return {
        code: 'TIMEOUT',
        message: 'The AI service took too long to respond. Please try again.',
        technicalDetail: message,
        retryable: true,
        suggestedAction: 'Try again in a moment',
      }
    }

    return {
      code: 'UNKNOWN_ERROR',
      message: 'An unexpected error occurred.',
      technicalDetail: message,
      retryable: true,
    }
  }

  // 401 Unauthorized
  if (statusCode === 401) {
    return {
      code: 'INVALID_API_KEY',
      message: 'Your API key is invalid or expired.',
      technicalDetail: 'HTTP 401 Unauthorized',
      retryable: false,
      suggestedAction: 'Check your API key in Settings',
    }
  }

  // 400 Bad Request — parse specific error types
  if (statusCode === 400) {
    const body = responseBody?.toLowerCase() ?? ''

    if (body.includes('invalid_api_key') || body.includes('api_key')) {
      return {
        code: 'INVALID_API_KEY',
        message: 'Your API key is invalid.',
        technicalDetail: 'HTTP 400 invalid_api_key',
        retryable: false,
        suggestedAction: 'Check your API key in Settings',
      }
    }

    if (body.includes('content_policy') || body.includes('content filtered')) {
      return {
        code: 'CONTENT_FILTERED',
        message: 'The AI declined to process this request due to content policy.',
        technicalDetail: 'HTTP 400 content_policy',
        retryable: false,
        suggestedAction: 'Modify your request and try again',
      }
    }

    if (body.includes('context_length') || body.includes('too long')) {
      return {
        code: 'CONTEXT_TOO_LONG',
        message: 'The text is too long for the AI to process. Try splitting it into smaller sections.',
        technicalDetail: 'HTTP 400 context_length',
        retryable: false,
        suggestedAction: 'Split the text into smaller parts and try again',
      }
    }

    return {
      code: 'INVALID_RESPONSE',
      message: 'The request was invalid. Please check your input.',
      technicalDetail: `HTTP 400: ${responseBody ?? 'unknown'}`,
      retryable: true,
    }
  }

  // 429 Too Many Requests
  if (statusCode === 429) {
    return {
      code: 'RATE_LIMITED',
      message: 'Please wait a moment — the AI is processing other requests.',
      technicalDetail: 'HTTP 429 Rate Limited',
      retryable: true,
      suggestedAction: 'Try again in a moment',
    }
  }

  // 5xx Server Errors
  if (statusCode >= 500 && statusCode < 600) {
    return {
      code: 'API_UNAVAILABLE',
      message: 'The AI service is temporarily unavailable. Please try again in a moment.',
      technicalDetail: `HTTP ${statusCode}`,
      retryable: true,
      suggestedAction: 'Try again in a moment',
    }
  }

  // 529 Anthropic Overloaded (custom Anthropic status)
  if (statusCode === 529) {
    return {
      code: 'API_UNAVAILABLE',
      message: 'The AI service is currently overloaded. Please try again shortly.',
      technicalDetail: 'HTTP 529 Overloaded',
      retryable: true,
      suggestedAction: 'Try again in a few moments',
    }
  }

  // 503 Service Unavailable
  if (statusCode === 503) {
    return {
      code: 'API_UNAVAILABLE',
      message: 'The AI service is temporarily unavailable. Please try again later.',
      technicalDetail: 'HTTP 503 Service Unavailable',
      retryable: true,
      suggestedAction: 'Try again in a moment',
    }
  }

  // Default: Unknown error
  return {
    code: 'UNKNOWN_ERROR',
    message: 'An unexpected error occurred while communicating with the AI service.',
    technicalDetail: `HTTP ${statusCode}: ${responseBody ?? 'unknown'}`,
    retryable: true,
  }
}

// ---------------------------------------------------------------------------
// User-Facing Formatting
// ---------------------------------------------------------------------------

/**
 * Format error for the renderer (safe to display to user).
 * Never includes technical details, API keys, or sensitive information.
 */
export function formatUserError(error: AiError): string {
  let output = error.message

  if (error.suggestedAction) {
    output += ` ${error.suggestedAction}.`
  }

  return output
}

// ---------------------------------------------------------------------------
// Error Detection Helpers
// ---------------------------------------------------------------------------

function isNetworkError(message: string): boolean {
  const lowerMessage = message.toLowerCase()
  return (
    lowerMessage.includes('econnrefused') ||
    lowerMessage.includes('enotfound') ||
    lowerMessage.includes('econnreset') ||
    lowerMessage.includes('etimedout') ||
    lowerMessage.includes('network') ||
    lowerMessage.includes('cannot reach') ||
    lowerMessage.includes('connect')
  )
}

function isTimeoutError(message: string): boolean {
  const lowerMessage = message.toLowerCase()
  return (
    lowerMessage.includes('timeout') ||
    lowerMessage.includes('abort') ||
    lowerMessage.includes('took too long')
  )
}
