// Unit tests for license validation, pure logic, no network.
import { describe, it, expect } from 'vitest'
import { validateLocal, normalizeLicenseKey } from '../license'

describe('license validation', () => {
  describe('normalizeLicenseKey', () => {
    it('strips whitespace and uppercases', () => {
      expect(normalizeLicenseKey(' psgil - solo1 - abcde - 12345 - xyz7q '))
        .toBe('PSGIL-SOLO1-ABCDE-12345-XYZ7Q')
    })
  })

  describe('validateLocal, solo tier', () => {
    it('accepts a well-formed solo key and assigns 1 seat', () => {
      const result = validateLocal('PSGIL-SOLO1-ABCDE-12345-XYZ7Q')
      expect(result.ok).toBe(true)
      expect(result.license).not.toBeNull()
      expect(result.license?.tier).toBe('solo')
      expect(result.license?.seats).toBe(1)
      expect(result.errorCode).toBeNull()
    })
  })

  describe('validateLocal, practice tier', () => {
    it('accepts a practice key with SEAT5 and assigns 5 seats', () => {
      const result = validateLocal('PSGIL-PRAC1-SEAT5-ABCDE-12345')
      expect(result.ok).toBe(true)
      expect(result.license?.tier).toBe('practice')
      expect(result.license?.seats).toBe(5)
    })

    it('falls back to 5 seats when SEAT block is missing', () => {
      const result = validateLocal('PSGIL-PRAC2-ABCDE-12345-XYZ7Q')
      expect(result.ok).toBe(true)
      expect(result.license?.seats).toBe(5)
    })
  })

  describe('validateLocal, enterprise tier', () => {
    it('accepts an enterprise key and assigns default 25 seats', () => {
      const result = validateLocal('PSGIL-ENTR1-ABCDE-12345-67890')
      expect(result.ok).toBe(true)
      expect(result.license?.tier).toBe('enterprise')
      expect(result.license?.seats).toBe(25)
    })
  })

  describe('validateLocal, rejections', () => {
    it('rejects a malformed key', () => {
      const result = validateLocal('not-a-license')
      expect(result.ok).toBe(false)
      expect(result.errorCode).toBe('MALFORMED')
      expect(result.license).toBeNull()
    })

    it('rejects an unknown tier marker', () => {
      const result = validateLocal('PSGIL-BOGUS-ABCDE-12345-XYZ7Q')
      expect(result.ok).toBe(false)
      expect(result.errorCode).toBe('UNKNOWN_TIER')
    })

    it('rejects the empty string', () => {
      const result = validateLocal('')
      expect(result.ok).toBe(false)
      expect(result.errorCode).toBe('MALFORMED')
    })
  })
})
