/**
 * Psygil Rate Limiter for Claude API
 *
 * Implements exponential backoff, sliding window rate limiting, and retry logic.
 * Spec reference: BUILD_MANIFEST.md Task 4.5
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RateLimiterConfig {
  readonly maxRetries: number           // default: 3
  readonly baseDelayMs: number          // default: 1000
  readonly maxDelayMs: number           // default: 60000
  readonly requestsPerMinute: number    // default: 50 (Anthropic tier 1)
  readonly tokensPerMinute: number      // default: 40000
}

export interface RetryResult<T> {
  readonly success: boolean
  readonly data?: T
  readonly error?: string
  readonly attempts: number
  readonly totalDelayMs: number
}

export interface RateLimitStatus {
  readonly requestsInWindow: number
  readonly tokensInWindow: number
  readonly canMakeRequest: boolean
  readonly nextAvailableMs: number      // 0 if can make request now
  readonly requestsRemaining: number
  readonly tokensRemaining: number
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/**
 * Sleep for the given milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Add jitter (0-500ms) to prevent thundering herd.
 */
function getJitter(): number {
  return Math.random() * 500
}

/**
 * Calculate exponential backoff delay: baseDelay * 2^attempt + jitter
 */
function getBackoffDelay(attempt: number, baseDelayMs: number, maxDelayMs: number): number {
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt)
  const clampedDelay = Math.min(exponentialDelay, maxDelayMs)
  const jitteredDelay = clampedDelay + getJitter()
  return Math.min(jitteredDelay, maxDelayMs)
}

// ---------------------------------------------------------------------------
// RateLimiter Class
// ---------------------------------------------------------------------------

export class RateLimiter {
  private readonly config: Required<RateLimiterConfig>
  private readonly requestTimestamps: number[] = []
  private readonly tokenCounts: number[] = []

  constructor(config?: Partial<RateLimiterConfig>) {
    this.config = {
      maxRetries: config?.maxRetries ?? 3,
      baseDelayMs: config?.baseDelayMs ?? 1000,
      maxDelayMs: config?.maxDelayMs ?? 60000,
      requestsPerMinute: config?.requestsPerMinute ?? 50,
      tokensPerMinute: config?.tokensPerMinute ?? 40000,
    }
  }

  /**
   * Execute a function with retry logic, respecting rate limits.
   *
   * Retries on:
   * - Errors (including 429 rate limit errors)
   * - Network errors
   * - Timeouts
   *
   * Does NOT retry on:
   * - 401 Unauthorized (invalid API key)
   * - 400 Content Filtered
   * - 400 Context Too Long
   */
  async executeWithRetry<T>(fn: () => Promise<T>): Promise<RetryResult<T>> {
    let lastError: Error | null = null
    let totalDelayMs = 0

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      // Check rate limit before executing
      if (!this.canMakeRequest()) {
        const status = this.getStatus()
        if (status.nextAvailableMs > 0) {
          await sleep(status.nextAvailableMs)
          totalDelayMs += status.nextAvailableMs
        }
      }

      try {
        const result = await fn()
        // Record successful execution
        this.recordRequest(0, 0) // tokens will be recorded by the caller
        return {
          success: true,
          data: result,
          attempts: attempt + 1,
          totalDelayMs,
        }
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e))

        // Check if this error should be retried
        const shouldRetry = this.isRetryableError(lastError) && attempt < this.config.maxRetries

        if (!shouldRetry) {
          return {
            success: false,
            error: lastError.message,
            attempts: attempt + 1,
            totalDelayMs,
          }
        }

        // Calculate backoff delay
        const backoffDelay = getBackoffDelay(
          attempt,
          this.config.baseDelayMs,
          this.config.maxDelayMs
        )
        await sleep(backoffDelay)
        totalDelayMs += backoffDelay
      }
    }

    return {
      success: false,
      error: lastError?.message ?? 'Unknown error after max retries',
      attempts: this.config.maxRetries + 1,
      totalDelayMs,
    }
  }

  /**
   * Check if we can make a request right now (sliding window).
   */
  canMakeRequest(): boolean {
    const now = Date.now()
    const oneMinuteAgo = now - 60000

    // Remove timestamps outside the window
    while (this.requestTimestamps.length > 0 && this.requestTimestamps[0] < oneMinuteAgo) {
      this.requestTimestamps.shift()
      this.tokenCounts.shift()
    }

    const requestsInWindow = this.requestTimestamps.length
    const tokensInWindow = this.tokenCounts.reduce((sum, count) => sum + count, 0)

    return (
      requestsInWindow < this.config.requestsPerMinute &&
      tokensInWindow < this.config.tokensPerMinute
    )
  }

  /**
   * Record that a request was made (for sliding window tracking).
   */
  recordRequest(inputTokens: number, outputTokens: number): void {
    const now = Date.now()
    const totalTokens = inputTokens + outputTokens
    this.requestTimestamps.push(now)
    this.tokenCounts.push(totalTokens)
  }

  /**
   * Get current rate limit status.
   */
  getStatus(): RateLimitStatus {
    const now = Date.now()
    const oneMinuteAgo = now - 60000

    // Remove timestamps outside the window
    while (this.requestTimestamps.length > 0 && this.requestTimestamps[0] < oneMinuteAgo) {
      this.requestTimestamps.shift()
      this.tokenCounts.shift()
    }

    const requestsInWindow = this.requestTimestamps.length
    const tokensInWindow = this.tokenCounts.reduce((sum, count) => sum + count, 0)
    const canMakeRequest = this.canMakeRequest()

    // Calculate next available time
    let nextAvailableMs = 0
    if (!canMakeRequest && this.requestTimestamps.length > 0) {
      const oldestTimestamp = this.requestTimestamps[0]
      const nextAvailable = oldestTimestamp + 60000
      nextAvailableMs = Math.max(0, nextAvailable - now)
    }

    return {
      requestsInWindow,
      tokensInWindow,
      canMakeRequest,
      nextAvailableMs,
      requestsRemaining: Math.max(0, this.config.requestsPerMinute - requestsInWindow),
      tokensRemaining: Math.max(0, this.config.tokensPerMinute - tokensInWindow),
    }
  }

  /**
   * Reset the limiter.
   */
  reset(): void {
    this.requestTimestamps.length = 0
    this.tokenCounts.length = 0
  }

  /**
   * Determine if an error should trigger a retry.
   * Does NOT retry on auth/policy errors.
   */
  private isRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase()

    // Do NOT retry on auth errors
    if (message.includes('invalid api key') || message.includes('401')) {
      return false
    }

    // Do NOT retry on policy/content filtered
    if (message.includes('content_policy') || message.includes('content filtered')) {
      return false
    }

    // Do NOT retry on context length errors
    if (message.includes('context_length') || message.includes('too long')) {
      return false
    }

    // Retry on everything else (429, 5xx, network, timeout, etc.)
    return true
  }
}
