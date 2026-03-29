# Sprint 4, Task 4.5: Rate Limiting + Error Handling

**Status:** COMPLETED
**Date:** 2026-03-29
**Spec Reference:** BUILD_MANIFEST.md Task 4.5

## Deliverables

### 1. `app/src/main/ai/rate-limiter.ts` (234 lines)

A production-ready rate limiter with exponential backoff and retry logic for Claude API calls.

**Key Features:**
- Sliding window (1-minute) tracking for both requests and tokens
- Exponential backoff: `delay = min(baseDelay * 2^attempt, maxDelay) + jitter`
- Random jitter (0-500ms) to prevent thundering herd
- Configurable per-minute limits:
  - `requestsPerMinute: 50` (Anthropic tier 1 default)
  - `tokensPerMinute: 40000` (typical tier 1 allocation)
  - `maxRetries: 3` (default)
  - `baseDelayMs: 1000`, `maxDelayMs: 60000` (backoff bounds)

**Public API:**
```typescript
export class RateLimiter {
  executeWithRetry<T>(fn: () => Promise<T>): Promise<RetryResult<T>>
  canMakeRequest(): boolean
  recordRequest(inputTokens: number, outputTokens: number): void
  getStatus(): RateLimitStatus
  reset(): void
}
```

**Retry Logic:**
- Retries on: 429 (rate limited), 5xx errors, network errors, timeouts
- Does NOT retry on: 401 (auth), 400 content_policy, 400 context_length
- Returns structured result with: success, data, error, attempts, totalDelayMs

**Acceptance Criteria: PASS**
- ✅ Exponential backoff with jitter implemented
- ✅ Sliding window tracking for requests and tokens
- ✅ Retry logic respects max retries and backoff bounds
- ✅ Rate limit prevents exceeding Anthropic API limits

---

### 2. `app/src/main/ai/error-handler.ts` (204 lines)

Comprehensive error classification and user-facing message generation.

**Key Features:**
- 9 error codes with distinct classification rules:
  - `INVALID_API_KEY` — 401, 400 invalid_api_key
  - `RATE_LIMITED` — 429
  - `API_UNAVAILABLE` — 5xx, 529 (overloaded)
  - `NETWORK_ERROR` — ECONNREFUSED, ENOTFOUND, etc.
  - `TIMEOUT` — Timeout/AbortError
  - `INVALID_RESPONSE` — Parse failures
  - `CONTENT_FILTERED` — 400 content_policy
  - `CONTEXT_TOO_LONG` — 400 context_length
  - `UNKNOWN_ERROR` — Catch-all

**Public API:**
```typescript
export function classifyError(
  statusCode: number | null,
  responseBody: string | null,
  error?: Error
): AiError

export function formatUserError(error: AiError): string
```

**Error Structure:**
```typescript
export interface AiError {
  readonly code: AiErrorCode
  readonly message: string          // User-facing, safe for UI display
  readonly technicalDetail?: string // Logs only, never shown to user
  readonly retryable: boolean       // Whether to retry
  readonly suggestedAction?: string // User guidance (e.g., "Check Settings")
}
```

**Security:**
- API keys NEVER appear in error messages, technical details, or suggested actions
- Error messages use user-friendly language ("Your API key is invalid" not "401")
- Each error code has a specific, actionable suggested action

**Error Examples:**
| Error | Message | Retryable | Suggestion |
|-------|---------|-----------|-----------|
| 401 | Your API key is invalid or expired | No | Check your API key in Settings |
| 429 | Please wait a moment — the AI is processing other requests | Yes | Try again in a moment |
| 400 context_length | The text is too long for the AI to process... | No | Split the text into smaller parts |
| Network | Cannot connect to the AI service | Yes | Check your internet connection |

**Acceptance Criteria: PASS**
- ✅ All Claude API error codes classified correctly
- ✅ User-facing messages are clear and actionable
- ✅ API keys never appear in error messages or logs
- ✅ Retryable field set correctly for each error type

---

### 3. `app/src/main/ai/request-logger.ts` (114 lines)

Minimal in-memory ring buffer logger for debugging and audit (never persisted).

**Key Features:**
- Ring buffer stores last 100 requests only
- Never persisted to disk (memory-only)
- Thread-safe append-and-shift pattern
- Aggregate statistics on demand

**Public API:**
```typescript
export class RequestLogger {
  log(entry: AiRequestLog): void
  getRecent(count?: number): readonly AiRequestLog[]
  getStats(): { totalRequests, totalTokens, avgDurationMs, errorRate }
  clear(): void
}
```

**Log Entry Structure:**
```typescript
export interface AiRequestLog {
  readonly timestamp: string        // ISO 8601
  readonly operationId: string      // Unique ID for request
  readonly model: string            // e.g., "claude-3-5-sonnet"
  readonly inputTokens: number
  readonly outputTokens: number
  readonly durationMs: number       // Wall-clock time
  readonly success: boolean
  readonly errorCode?: string       // e.g., "RATE_LIMITED"
  readonly retryCount: number       // 0 if first attempt
}
```

**Usage Example:**
```typescript
const logger = new RequestLogger()

// Log a successful request
logger.log({
  timestamp: new Date().toISOString(),
  operationId: 'op-12345',
  model: 'claude-3-5-sonnet',
  inputTokens: 150,
  outputTokens: 450,
  durationMs: 2300,
  success: true,
  retryCount: 0,
})

// Get statistics
const stats = logger.getStats()
// { totalRequests: 1, totalTokens: 600, avgDurationMs: 2300, errorRate: 0 }
```

**Acceptance Criteria: PASS**
- ✅ In-memory ring buffer with 100-request max
- ✅ Never persists to disk
- ✅ Tracks usage without sensitive data
- ✅ Provides aggregate statistics

---

### 4. Updated `app/src/main/ai/index.ts`

Re-exports all modules for clean external API:

```typescript
export { RateLimiter, type RateLimiterConfig, ... } from './rate-limiter'
export { classifyError, formatUserError, type AiError, ... } from './error-handler'
export { RequestLogger, type AiRequestLog } from './request-logger'
// Plus existing exports for callClaude and key storage
```

---

### 5. Test Suite: `app/src/main/ai/__tests__/index.test.ts` (449 lines)

Comprehensive test coverage for all three modules:

**RateLimiter Tests (9 tests):**
- ✅ Allows request when under limit
- ✅ Tracks request counts correctly
- ✅ Prevents request when token limit exceeded
- ✅ Prevents request when request limit exceeded
- ✅ Returns detailed status
- ✅ Resets state correctly
- ✅ executeWithRetry succeeds immediately
- ✅ executeWithRetry retries on retryable errors (rate limit, network)
- ✅ executeWithRetry does NOT retry on auth, policy, context errors

**Error Handler Tests (13 tests):**
- ✅ Classifies HTTP 401, 400 (various types), 429, 5xx, 529
- ✅ Classifies network errors (ECONNREFUSED, ENOTFOUND)
- ✅ Classifies timeout errors
- ✅ Never includes API keys in error messages
- ✅ formatUserError produces safe output

**RequestLogger Tests (8 tests):**
- ✅ Logs single and multiple requests in order
- ✅ Returns only recent entries
- ✅ Calculates statistics correctly (total tokens, avg duration, error rate)
- ✅ Maintains ring buffer max of 100 entries
- ✅ Returns empty stats for empty logger
- ✅ Clears all entries

**Total: 30 unit tests covering all acceptance criteria**

---

## Architecture Integration

### Where These Fit in Psygil:

1. **RateLimiter** — Used by the Claude API caller (likely in `ai-handlers.ts` or a future integration)
   ```typescript
   const limiter = new RateLimiter()
   const result = await limiter.executeWithRetry(() => callClaude(apiKey, options))
   ```

2. **Error Handler** — Used by IPC handlers and the renderer to display errors
   ```typescript
   const error = classifyError(response.status, body, errorObj)
   window.psygil.notify.error(formatUserError(error))
   ```

3. **RequestLogger** — Used to track all Claude API usage for debugging
   ```typescript
   const logger = new RequestLogger()
   logger.log({ ... request details ... })
   const stats = logger.getStats() // Check API usage
   ```

### Module Dependencies:
- **Rate Limiter:** No external dependencies (uses native `setTimeout`)
- **Error Handler:** No external dependencies
- **Request Logger:** No external dependencies

All three modules are **self-contained, testable, and zero-dependency**.

---

## Acceptance Criteria Checklist

| Criterion | Status | Notes |
|-----------|--------|-------|
| Retry logic with exponential backoff works correctly | ✅ PASS | Implemented with jitter, tested with 9 scenarios |
| Rate limiting prevents exceeding Anthropic API limits | ✅ PASS | Sliding window tracking for both requests and tokens |
| All Claude API error codes produce clear, user-facing messages | ✅ PASS | 9 error codes, each with specific message and suggestion |
| API key NEVER appears in logs or error messages | ✅ PASS | Verified in error classification logic and test suite |
| Request logger tracks usage without persisting sensitive data | ✅ PASS | In-memory ring buffer (100 requests), never written to disk |

---

## Files Created

| File | Lines | Purpose |
|------|-------|---------|
| `app/src/main/ai/rate-limiter.ts` | 234 | Rate limiting with exponential backoff |
| `app/src/main/ai/error-handler.ts` | 204 | Error classification and user messages |
| `app/src/main/ai/request-logger.ts` | 114 | In-memory request logging |
| `app/src/main/ai/index.ts` | 20 | Module exports (updated) |
| `app/src/main/ai/__tests__/index.test.ts` | 449 | Unit test suite (30 tests) |

**Total: 1,021 lines of production code + tests**

---

## Next Steps (Sprint 4, Task 4.6)

The rate limiter and error handler are now ready for integration into the Claude API caller (likely in `ai-handlers.ts`).

The GO/NO-GO gate before Sprint 5 requires PII detection to achieve ≥99% recall and <2% false positives on the test corpus. This work is independent of the rate limiting + error handling.

**No blocking issues identified.** All modules are production-ready and fully tested.
