// Unit tests for the setup state machine, pure logic, no fs.
import { describe, it, expect } from 'vitest'
import {
  SETUP_STATES,
  stateRank,
  isAtLeast,
  nextState,
  advanceTo,
  freshConfig,
  isSetupComplete,
  type SetupState,
  type SetupConfig,
} from '../state'

describe('setup state machine', () => {
  it('exposes exactly nine ordered states', () => {
    expect(SETUP_STATES.length).toBe(9)
    expect(SETUP_STATES[0]).toBe('fresh')
    expect(SETUP_STATES[SETUP_STATES.length - 1]).toBe('complete')
  })

  it('stateRank matches index in SETUP_STATES', () => {
    SETUP_STATES.forEach((state, idx) => {
      expect(stateRank(state)).toBe(idx)
    })
  })

  it('isAtLeast is monotonic', () => {
    expect(isAtLeast('storage_ready', 'fresh')).toBe(true)
    expect(isAtLeast('storage_ready', 'storage_ready')).toBe(true)
    expect(isAtLeast('storage_ready', 'complete')).toBe(false)
  })

  it('nextState returns the next state in order and clamps at complete', () => {
    expect(nextState('fresh')).toBe('sidecar_verified')
    expect(nextState('profile_done')).toBe('ai_configured')
    expect(nextState('complete')).toBe('complete')
  })

  it('advanceTo only moves forward, never backward', () => {
    const base: SetupConfig = { ...freshConfig(), setupState: 'profile_done' }
    const forward = advanceTo(base, 'ai_configured')
    expect(forward.setupState).toBe('ai_configured')

    const attemptedBackward = advanceTo(base, 'fresh')
    expect(attemptedBackward.setupState).toBe('profile_done')
  })

  it('freshConfig starts at fresh with null data', () => {
    const c = freshConfig()
    expect(c.setupState).toBe('fresh')
    expect(c.license).toBeNull()
    expect(c.storage).toBeNull()
    expect(c.practice).toBeNull()
    expect(c.ai).toBeNull()
    expect(c.appearance).toBeNull()
    expect(c.clinical).toBeNull()
  })

  it('isSetupComplete only true at complete', () => {
    expect(isSetupComplete(freshConfig())).toBe(false)
    const done: SetupConfig = { ...freshConfig(), setupState: 'complete' }
    expect(isSetupComplete(done)).toBe(true)
  })

  it('state ordering covers all sprint-17 wizard steps', () => {
    const expected: SetupState[] = [
      'fresh',
      'sidecar_verified',
      'license_entered',
      'storage_ready',
      'profile_done',
      'ai_configured',
      'prefs_done',
      'clinical_done',
      'complete',
    ]
    expect([...SETUP_STATES]).toEqual(expected)
  })
})
