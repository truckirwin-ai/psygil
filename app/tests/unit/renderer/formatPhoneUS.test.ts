/**
 * Tests for formatPhoneUS, the North American phone formatter used in the
 * Intake and Onboarding wizard. The function currently lives inside
 * IntakeOnboardingModal.tsx; when extracted to a utility module, update the
 * import path.
 */

import { describe, it, expect } from 'vitest'

// When extracted, replace with:
//   import { formatPhoneUS } from '@/components/modals/phoneFormat'
// For now, duplicate the implementation under test to keep the scaffold runnable.
function formatPhoneUS(value: string): string {
  let digits = (value || '').replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1)
  digits = digits.slice(0, 10)
  if (digits.length === 0) return ''
  if (digits.length < 4) return `(${digits}`
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

describe('formatPhoneUS', () => {
  it('formats 10 digits', () => {
    expect(formatPhoneUS('1112223333')).toBe('(111) 222-3333')
  })

  it('drops a leading country code 1', () => {
    expect(formatPhoneUS('11112223333')).toBe('(111) 222-3333')
  })

  it('formats progressively', () => {
    expect(formatPhoneUS('1')).toBe('(1')
    expect(formatPhoneUS('111')).toBe('(111')
    expect(formatPhoneUS('1112')).toBe('(111) 2')
    expect(formatPhoneUS('111222')).toBe('(111) 222')
    expect(formatPhoneUS('1112223')).toBe('(111) 222-3')
  })

  it('strips non-digits', () => {
    expect(formatPhoneUS('abc-111-def-222-3333')).toBe('(111) 222-3333')
    expect(formatPhoneUS('(111) 222-3333')).toBe('(111) 222-3333')
  })

  it('returns empty on empty input', () => {
    expect(formatPhoneUS('')).toBe('')
  })

  it('caps at 10 digits', () => {
    expect(formatPhoneUS('111222333399999')).toBe('(111) 222-3333')
  })
})
