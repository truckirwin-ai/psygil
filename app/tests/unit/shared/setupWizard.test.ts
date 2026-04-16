/**
 * Unit tests for setup wizard pure logic: sidecar error classification
 * and AI test-connection cost estimation.
 *
 * These tests exercise the exported helper functions from the setup step
 * components without rendering any React UI.
 */

import { describe, it, expect } from 'vitest'
import {
  classifySidecarError,
} from '../../../src/renderer/src/components/setup/steps/StepSidecar'
import {
  computeTestCost,
} from '../../../src/renderer/src/components/setup/steps/StepAi'

// ---------------------------------------------------------------------------
// classifySidecarError
// ---------------------------------------------------------------------------

describe('classifySidecarError', () => {
  it('matches ENOENT to Python-not-installed', () => {
    const result = classifySidecarError('spawn python3.11 ENOENT')
    expect(result.category).toBe('Python not installed')
    expect(result.remediation).toMatch(/brew install python/)
    expect(result.remediation).toMatch(/python\.org/)
  })

  it('matches "Python not found" to Python-not-installed', () => {
    const result = classifySidecarError('Python not found on PATH')
    expect(result.category).toBe('Python not installed')
    expect(result.remediation).toMatch(/brew install python/)
  })

  it('matches "command not found" to Python-not-installed', () => {
    const result = classifySidecarError('sh: python3.11: command not found')
    expect(result.category).toBe('Python not installed')
    expect(result.remediation).toMatch(/brew install python/)
  })

  it('matches en_core_web_lg to spaCy-model-missing', () => {
    const result = classifySidecarError("Can't find model 'en_core_web_lg'")
    expect(result.category).toBe('spaCy model missing')
    expect(result.remediation).toMatch(/setup-dev-venv\.sh/)
  })

  it('matches "No module named spacy" to spaCy-model-missing', () => {
    const result = classifySidecarError('ModuleNotFoundError: No module named spacy')
    expect(result.category).toBe('spaCy model missing')
    expect(result.remediation).toMatch(/setup-dev-venv\.sh/)
  })

  it('matches EADDRINUSE to socket-in-use', () => {
    const result = classifySidecarError('listen EADDRINUSE: address already in use /tmp/psygil-sidecar.sock')
    expect(result.category).toBe('Socket in use')
    expect(result.remediation).toMatch(/psygil-sidecar\.sock/)
  })

  it('matches "socket already in use" to socket-in-use', () => {
    const result = classifySidecarError('socket already in use')
    expect(result.category).toBe('Socket in use')
    expect(result.remediation).toMatch(/psygil-sidecar\.sock/)
  })

  it('matches "Smoke test FAILED" to smoke-test-failed', () => {
    const result = classifySidecarError('Smoke test FAILED: sidecar exited with code 1')
    expect(result.category).toBe('Sidecar smoke test failed')
    expect(result.remediation).toMatch(/requirements\.txt/)
  })

  it('returns unknown-error category and passes through raw message for unrecognized errors', () => {
    const rawMessage = 'Some completely unknown sidecar failure condition xyz'
    const result = classifySidecarError(rawMessage)
    expect(result.category).toBe('Unknown error')
    expect(result.remediation).toBe(rawMessage)
  })
})

// ---------------------------------------------------------------------------
// computeTestCost
// ---------------------------------------------------------------------------

describe('computeTestCost', () => {
  it('computes correct cost for claude-sonnet-4-20250514', () => {
    // (1000 * 3.00 + 500 * 15.00) / 1_000_000 = (3000 + 7500) / 1_000_000 = 0.0105
    const cost = computeTestCost('claude-sonnet-4-20250514', 1000, 500)
    expect(cost).not.toBeNull()
    expect(cost).toBeCloseTo(0.0105, 6)
  })

  it('computes correct cost for claude-opus-4-20250514', () => {
    // (1000 * 15.00 + 500 * 75.00) / 1_000_000 = (15000 + 37500) / 1_000_000 = 0.0525
    const cost = computeTestCost('claude-opus-4-20250514', 1000, 500)
    expect(cost).not.toBeNull()
    expect(cost).toBeCloseTo(0.0525, 6)
  })

  it('computes correct cost for claude-haiku-4-5-20251001', () => {
    // (1000 * 0.80 + 500 * 4.00) / 1_000_000 = (800 + 2000) / 1_000_000 = 0.0028
    const cost = computeTestCost('claude-haiku-4-5-20251001', 1000, 500)
    expect(cost).not.toBeNull()
    expect(cost).toBeCloseTo(0.0028, 6)
  })

  it('returns null for an unknown model', () => {
    const cost = computeTestCost('gpt-4o-mystery-model', 1000, 500)
    expect(cost).toBeNull()
  })

  it('returns null for an empty model string', () => {
    const cost = computeTestCost('', 1000, 500)
    expect(cost).toBeNull()
  })

  it('returns zero cost when both token counts are zero', () => {
    const cost = computeTestCost('claude-sonnet-4-20250514', 0, 0)
    expect(cost).toBe(0)
  })
})
