/**
 * Psygil AI Module Tests
 *
 * Tests for rate limiter, error handler, and request logger.
 * Run with: npm test app/src/main/ai/__tests__/index.test.ts
 */

import { RateLimiter, type RateLimitStatus } from '../rate-limiter'
import { classifyError, formatUserError, type AiError } from '../error-handler'
import { RequestLogger, type AiRequestLog } from '../request-logger'

// ---------------------------------------------------------------------------
// Rate Limiter Tests
// ---------------------------------------------------------------------------

describe('RateLimiter', () => {
  let limiter: RateLimiter

  beforeEach(() => {
    limiter = new RateLimiter({
      maxRetries: 3,
      baseDelayMs: 100,
      maxDelayMs: 1000,
      requestsPerMinute: 10,
      tokensPerMinute: 5000,
    })
  })

  test('allows request when under limit', () => {
    expect(limiter.canMakeRequest()).toBe(true)
  })

  test('tracks request counts correctly', () => {
    limiter.recordRequest(100, 200)
    const status = limiter.getStatus()
    expect(status.requestsInWindow).toBe(1)
    expect(status.tokensInWindow).toBe(300)
  })

  test('prevents request when token limit exceeded', () => {
    // Record 6 requests of 1000 tokens each = 6000 tokens (exceeds 5000)
    for (let i = 0; i < 6; i++) {
      limiter.recordRequest(500, 500)
    }
    expect(limiter.canMakeRequest()).toBe(false)
  })

  test('prevents request when request limit exceeded', () => {
    // Record 11 requests (exceeds 10)
    for (let i = 0; i < 11; i++) {
      limiter.recordRequest(10, 10)
    }
    expect(limiter.canMakeRequest()).toBe(false)
  })

  test('returns detailed status', () => {
    limiter.recordRequest(100, 200)
    limiter.recordRequest(50, 100)
    const status = limiter.getStatus()

    expect(status.requestsInWindow).toBe(2)
    expect(status.tokensInWindow).toBe(450)
    expect(status.canMakeRequest).toBe(true)
    expect(status.requestsRemaining).toBe(8) // 10 - 2
    expect(status.tokensRemaining).toBe(4550) // 5000 - 450
    expect(status.nextAvailableMs).toBe(0) // Can make request now
  })

  test('resets state correctly', () => {
    limiter.recordRequest(100, 200)
    expect(limiter.canMakeRequest()).toBe(true)

    limiter.reset()
    const status = limiter.getStatus()
    expect(status.requestsInWindow).toBe(0)
    expect(status.tokensInWindow).toBe(0)
  })

  test('executeWithRetry succeeds immediately', async () => {
    const result = await limiter.executeWithRetry(async () => 'success')
    expect(result.success).toBe(true)
    expect(result.data).toBe('success')
    expect(result.attempts).toBe(1)
    expect(result.totalDelayMs).toBe(0)
  })

  test('executeWithRetry retries on retryable errors', async () => {
    let attempts = 0
    const result = await limiter.executeWithRetry(async () => {
      attempts++
      if (attempts < 2) {
        throw new Error('Rate limited')
      }
      return 'success'
    })

    expect(result.success).toBe(true)
    expect(result.data).toBe('success')
    expect(result.attempts).toBe(2)
  })

  test('executeWithRetry does not retry on auth errors', async () => {
    let attempts = 0
    const result = await limiter.executeWithRetry(async () => {
      attempts++
      throw new Error('Invalid API key')
    })

    expect(result.success).toBe(false)
    expect(result.attempts).toBe(1) // No retry
  })

  test('executeWithRetry does not retry on content filtered errors', async () => {
    let attempts = 0
    const result = await limiter.executeWithRetry(async () => {
      attempts++
      throw new Error('content_policy')
    })

    expect(result.success).toBe(false)
    expect(result.attempts).toBe(1) // No retry
  })

  test('executeWithRetry does not retry on context length errors', async () => {
    let attempts = 0
    const result = await limiter.executeWithRetry(async () => {
      attempts++
      throw new Error('context_length')
    })

    expect(result.success).toBe(false)
    expect(result.attempts).toBe(1) // No retry
  })

  test('executeWithRetry respects max retries', async () => {
    const result = await limiter.executeWithRetry(async () => {
      throw new Error('Persistent failure')
    })

    expect(result.success).toBe(false)
    expect(result.attempts).toBe(4) // maxRetries: 3 + 1 initial
  })
})

// ---------------------------------------------------------------------------
// Error Handler Tests
// ---------------------------------------------------------------------------

describe('Error Handler', () => {
  test('classifies 401 Unauthorized', () => {
    const error = classifyError(401, null)
    expect(error.code).toBe('INVALID_API_KEY')
    expect(error.retryable).toBe(false)
    expect(error.message).toContain('invalid or expired')
    expect(error.suggestedAction).toContain('Settings')
  })

  test('classifies 400 invalid_api_key', () => {
    const error = classifyError(400, 'error: invalid_api_key')
    expect(error.code).toBe('INVALID_API_KEY')
    expect(error.retryable).toBe(false)
  })

  test('classifies 400 content_policy', () => {
    const error = classifyError(400, 'error: content_policy_violation')
    expect(error.code).toBe('CONTENT_FILTERED')
    expect(error.retryable).toBe(false)
  })

  test('classifies 400 context_length', () => {
    const error = classifyError(400, 'error: context_length_exceeded')
    expect(error.code).toBe('CONTEXT_TOO_LONG')
    expect(error.retryable).toBe(false)
    expect(error.message).toContain('too long')
    expect(error.message).toContain('splitting')
  })

  test('classifies 429 Rate Limited', () => {
    const error = classifyError(429, null)
    expect(error.code).toBe('RATE_LIMITED')
    expect(error.retryable).toBe(true)
  })

  test('classifies 500 Server Error', () => {
    const error = classifyError(500, null)
    expect(error.code).toBe('API_UNAVAILABLE')
    expect(error.retryable).toBe(true)
  })

  test('classifies 502 Bad Gateway', () => {
    const error = classifyError(502, null)
    expect(error.code).toBe('API_UNAVAILABLE')
    expect(error.retryable).toBe(true)
  })

  test('classifies 503 Service Unavailable', () => {
    const error = classifyError(503, null)
    expect(error.code).toBe('API_UNAVAILABLE')
    expect(error.retryable).toBe(true)
  })

  test('classifies 529 Overloaded', () => {
    const error = classifyError(529, null)
    expect(error.code).toBe('API_UNAVAILABLE')
    expect(error.retryable).toBe(true)
  })

  test('classifies network error', () => {
    const error = classifyError(0, null, new Error('ECONNREFUSED'))
    expect(error.code).toBe('NETWORK_ERROR')
    expect(error.retryable).toBe(true)
    expect(error.message).toContain('internet')
  })

  test('classifies timeout error', () => {
    const error = classifyError(0, null, new Error('timeout'))
    expect(error.code).toBe('TIMEOUT')
    expect(error.retryable).toBe(true)
  })

  test('never includes API key in error messages', () => {
    const errors = [
      classifyError(401, 'sk-ant-12345abcde'),
      classifyError(400, 'api_key=sk-ant-12345abcde'),
      classifyError(0, null, new Error('sk-ant-12345abcde')),
    ]

    errors.forEach((error) => {
      expect(error.message).not.toContain('sk-ant')
      if (error.suggestedAction) {
        expect(error.suggestedAction).not.toContain('sk-ant')
      }
    })
  })

  test('formatUserError produces safe output', () => {
    const error = classifyError(401, null)
    const formatted = formatUserError(error)

    expect(formatted).toContain('Your API key')
    expect(formatted).toContain('Settings')
  })
})

// ---------------------------------------------------------------------------
// Request Logger Tests
// ---------------------------------------------------------------------------

describe('RequestLogger', () => {
  let logger: RequestLogger

  beforeEach(() => {
    logger = new RequestLogger()
  })

  test('logs single request', () => {
    const entry: AiRequestLog = {
      timestamp: new Date().toISOString(),
      operationId: 'op-123',
      model: 'claude-3-5-sonnet',
      inputTokens: 100,
      outputTokens: 200,
      durationMs: 500,
      success: true,
      retryCount: 0,
    }

    logger.log(entry)
    const recent = logger.getRecent(1)

    expect(recent.length).toBe(1)
    expect(recent[0].operationId).toBe('op-123')
  })

  test('logs multiple requests in order', () => {
    for (let i = 0; i < 5; i++) {
      logger.log({
        timestamp: new Date().toISOString(),
        operationId: `op-${i}`,
        model: 'claude-3-5-sonnet',
        inputTokens: 100,
        outputTokens: 200,
        durationMs: 500,
        success: true,
        retryCount: 0,
      })
    }

    const recent = logger.getRecent(5)
    expect(recent.length).toBe(5)
    expect(recent[0].operationId).toBe('op-0')
    expect(recent[4].operationId).toBe('op-4')
  })

  test('returns only recent entries', () => {
    for (let i = 0; i < 10; i++) {
      logger.log({
        timestamp: new Date().toISOString(),
        operationId: `op-${i}`,
        model: 'claude-3-5-sonnet',
        inputTokens: 100,
        outputTokens: 200,
        durationMs: 500,
        success: true,
        retryCount: 0,
      })
    }

    const recent = logger.getRecent(3)
    expect(recent.length).toBe(3)
    expect(recent[0].operationId).toBe('op-7')
    expect(recent[2].operationId).toBe('op-9')
  })

  test('calculates stats correctly', () => {
    logger.log({
      timestamp: new Date().toISOString(),
      operationId: 'op-1',
      model: 'claude-3-5-sonnet',
      inputTokens: 100,
      outputTokens: 200,
      durationMs: 1000,
      success: true,
      retryCount: 0,
    })

    logger.log({
      timestamp: new Date().toISOString(),
      operationId: 'op-2',
      model: 'claude-3-5-sonnet',
      inputTokens: 150,
      outputTokens: 250,
      durationMs: 2000,
      success: false,
      errorCode: 'RATE_LIMITED',
      retryCount: 2,
    })

    const stats = logger.getStats()
    expect(stats.totalRequests).toBe(2)
    expect(stats.totalTokens).toBe(700) // 100+200+150+250
    expect(stats.avgDurationMs).toBe(1500) // (1000+2000)/2
    expect(stats.errorRate).toBe(0.5) // 1 error / 2 requests
  })

  test('maintains ring buffer max size of 100', () => {
    for (let i = 0; i < 150; i++) {
      logger.log({
        timestamp: new Date().toISOString(),
        operationId: `op-${i}`,
        model: 'claude-3-5-sonnet',
        inputTokens: 100,
        outputTokens: 200,
        durationMs: 500,
        success: true,
        retryCount: 0,
      })
    }

    const allEntries = logger.getRecent(150)
    expect(allEntries.length).toBe(100) // Max size is 100
    expect(allEntries[0].operationId).toBe('op-50') // First 50 were removed
    expect(allEntries[99].operationId).toBe('op-149') // Last one is newest
  })

  test('returns empty stats for empty logger', () => {
    const stats = logger.getStats()
    expect(stats.totalRequests).toBe(0)
    expect(stats.totalTokens).toBe(0)
    expect(stats.avgDurationMs).toBe(0)
    expect(stats.errorRate).toBe(0)
  })

  test('clears all entries', () => {
    for (let i = 0; i < 5; i++) {
      logger.log({
        timestamp: new Date().toISOString(),
        operationId: `op-${i}`,
        model: 'claude-3-5-sonnet',
        inputTokens: 100,
        outputTokens: 200,
        durationMs: 500,
        success: true,
        retryCount: 0,
      })
    }

    logger.clear()
    const recent = logger.getRecent(10)
    expect(recent.length).toBe(0)
  })
})
