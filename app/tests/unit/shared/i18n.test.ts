/**
 * Tests for the i18n (useLocale) hook and string management.
 *
 * Verifies:
 *  - All locale files have matching structural shape
 *  - English has required complete values
 *  - Non-English locales are stubs (awaiting translation)
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { strings as en } from '../../../src/renderer/src/strings/en'
import { strings as fr } from '../../../src/renderer/src/strings/fr'
import { strings as es } from '../../../src/renderer/src/strings/es'
import { strings as de } from '../../../src/renderer/src/strings/de'
import type { Strings } from '../../../src/renderer/src/strings/en'

describe('i18n localization', () => {
  beforeEach(() => {
    try {
      localStorage.clear()
    } catch {
      // localStorage may not be available in test environment
    }
  })

  describe('string shape consistency', () => {
    function getKeysDeep(obj: unknown): Set<string> {
      const keys = new Set<string>()
      const visit = (val: unknown, prefix: string) => {
        if (val !== null && typeof val === 'object') {
          for (const [k, v] of Object.entries(val)) {
            const fullKey = prefix ? `${prefix}.${k}` : k
            keys.add(fullKey)
            visit(v, fullKey)
          }
        }
      }
      visit(obj, '')
      return keys
    }

    it('English has required top-level sections', () => {
      const enKeys = Object.keys(en)
      expect(enKeys).toContain('practice')
      expect(enKeys).toContain('clinical')
    })

    it('French has the same structure as English', () => {
      const enKeys = getKeysDeep(en)
      const frKeys = getKeysDeep(fr)
      expect(frKeys).toEqual(enKeys)
    })

    it('Spanish has the same structure as English', () => {
      const enKeys = getKeysDeep(en)
      const esKeys = getKeysDeep(es)
      expect(esKeys).toEqual(enKeys)
    })

    it('German has the same structure as English', () => {
      const enKeys = getKeysDeep(en)
      const deKeys = getKeysDeep(de)
      expect(deKeys).toEqual(enKeys)
    })
  })

  describe('English strings completeness', () => {
    it('practice section has required fields', () => {
      expect(en.practice.title).toBeTruthy()
      expect(en.practice.subtitle).toBeTruthy()
      expect(en.practice.fieldFullName).toBeTruthy()
      expect(en.practice.fieldCredentials).toBeTruthy()
    })

    it('clinical section has required fields', () => {
      expect(en.clinical.title).toBeTruthy()
      expect(en.clinical.subtitle).toBeTruthy()
      expect(en.clinical.evalTypes).toBeTruthy()
      expect(en.clinical.instruments).toBeTruthy()
    })
  })

  describe('non-English locales are stubs', () => {
    it('French strings are empty (awaiting translation)', () => {
      const isEmptyLocale = (strings: Strings): boolean => {
        const isEmpty = (val: unknown): boolean => {
          if (typeof val === 'string') return val === ''
          if (val !== null && typeof val === 'object') {
            return Object.values(val).every(isEmpty)
          }
          return false
        }
        return isEmpty(strings)
      }
      expect(isEmptyLocale(fr)).toBe(true)
    })

    it('Spanish strings are empty (awaiting translation)', () => {
      const isEmptyLocale = (strings: Strings): boolean => {
        const isEmpty = (val: unknown): boolean => {
          if (typeof val === 'string') return val === ''
          if (val !== null && typeof val === 'object') {
            return Object.values(val).every(isEmpty)
          }
          return false
        }
        return isEmpty(strings)
      }
      expect(isEmptyLocale(es)).toBe(true)
    })

    it('German strings are empty (awaiting translation)', () => {
      const isEmptyLocale = (strings: Strings): boolean => {
        const isEmpty = (val: unknown): boolean => {
          if (typeof val === 'string') return val === ''
          if (val !== null && typeof val === 'object') {
            return Object.values(val).every(isEmpty)
          }
          return false
        }
        return isEmpty(strings)
      }
      expect(isEmptyLocale(de)).toBe(true)
    })
  })

  describe('locale type safety', () => {
    it('all locales export Strings type', () => {
      const _en: Strings = en
      const _fr: Strings = fr
      const _es: Strings = es
      const _de: Strings = de
      expect(_en).toBeDefined()
      expect(_fr).toBeDefined()
      expect(_es).toBeDefined()
      expect(_de).toBeDefined()
    })
  })
})
