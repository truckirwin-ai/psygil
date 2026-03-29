/**
 * Psygil Request Logger for Claude API
 *
 * In-memory ring buffer (last 100 requests) for debugging and audit.
 * Never persisted to disk. Never includes sensitive data.
 * Spec reference: BUILD_MANIFEST.md Task 4.5
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AiRequestLog {
  readonly timestamp: string
  readonly operationId: string
  readonly model: string
  readonly inputTokens: number
  readonly outputTokens: number
  readonly durationMs: number
  readonly success: boolean
  readonly errorCode?: string
  readonly retryCount: number
}

// ---------------------------------------------------------------------------
// Request Logger
// ---------------------------------------------------------------------------

/**
 * In-memory ring buffer logger for Claude API requests.
 * Keeps only the last 100 requests. Never persisted.
 */
export class RequestLogger {
  private readonly buffer: AiRequestLog[] = []
  private readonly maxSize = 100

  /**
   * Log a single API request.
   */
  log(entry: AiRequestLog): void {
    this.buffer.push(entry)

    // Remove oldest entries if buffer exceeds max size
    while (this.buffer.length > this.maxSize) {
      this.buffer.shift()
    }
  }

  /**
   * Get the most recent N log entries (default: 10).
   */
  getRecent(count: number = 10): readonly AiRequestLog[] {
    const limit = Math.min(count, this.buffer.length)
    return this.buffer.slice(-limit)
  }

  /**
   * Get aggregate statistics from all logged requests.
   */
  getStats(): {
    readonly totalRequests: number
    readonly totalTokens: number
    readonly avgDurationMs: number
    readonly errorRate: number
  } {
    if (this.buffer.length === 0) {
      return {
        totalRequests: 0,
        totalTokens: 0,
        avgDurationMs: 0,
        errorRate: 0,
      }
    }

    const totalRequests = this.buffer.length
    const totalTokens = this.buffer.reduce((sum, entry) => {
      return sum + entry.inputTokens + entry.outputTokens
    }, 0)
    const totalDurationMs = this.buffer.reduce((sum, entry) => sum + entry.durationMs, 0)
    const avgDurationMs = Math.round(totalDurationMs / totalRequests)
    const errorCount = this.buffer.filter((entry) => !entry.success).length
    const errorRate = totalRequests > 0 ? errorCount / totalRequests : 0

    return {
      totalRequests,
      totalTokens,
      avgDurationMs,
      errorRate,
    }
  }

  /**
   * Clear all logged entries (for testing or reset).
   */
  clear(): void {
    this.buffer.length = 0
  }

  /**
   * Get all logged entries (for debugging).
   */
  getAllEntries(): readonly AiRequestLog[] {
    return [...this.buffer]
  }
}
