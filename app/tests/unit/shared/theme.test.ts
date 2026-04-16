/**
 * Unit tests for src/renderer/src/app/theme.ts
 *
 * Runs in the node environment. DOM APIs (document, localStorage) are
 * mocked inline to avoid requiring jsdom as a dev dependency.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Minimal browser API mocks (document.documentElement, localStorage)
// ---------------------------------------------------------------------------

type Attributes = Record<string, string>

const attrs: Attributes = {}
const store: Record<string, string> = {}

const mockDocument = {
  documentElement: {
    getAttribute: (key: string): string | null => attrs[key] ?? null,
    setAttribute: (key: string, value: string): void => { attrs[key] = value },
    removeAttribute: (key: string): void => { delete attrs[key] },
  },
}

const mockLocalStorage = {
  getItem: (key: string): string | null => store[key] ?? null,
  setItem: (key: string, value: string): void => { store[key] = value },
  removeItem: (key: string): void => { delete store[key] },
  clear: (): void => { Object.keys(store).forEach((k) => { delete store[k] }) },
}

// Install the mocks into global before importing the module under test
vi.stubGlobal('document', mockDocument)
vi.stubGlobal('localStorage', mockLocalStorage)

// Now import the module (after globals are set)
const { setTheme, getTheme, initThemeOnLoad, THEME_CHOICES } = await import(
  '../../../src/renderer/src/app/theme'
)

const STORAGE_KEY = 'psygil_theme'
const MIGRATION_FLAG = 'psygil_theme_migrated_v1'

beforeEach(() => {
  mockLocalStorage.clear()
  mockDocument.documentElement.removeAttribute('data-theme')
})

// ---------------------------------------------------------------------------
// setTheme
// ---------------------------------------------------------------------------

describe('setTheme', () => {
  it('writes data-theme attribute to documentElement', () => {
    setTheme('medium')
    expect(mockDocument.documentElement.getAttribute('data-theme')).toBe('medium')
  })

  it('persists the key to localStorage', () => {
    setTheme('dark')
    expect(mockLocalStorage.getItem(STORAGE_KEY)).toBe('dark')
  })

  it('writes "warm" correctly', () => {
    setTheme('warm')
    expect(mockDocument.documentElement.getAttribute('data-theme')).toBe('warm')
    expect(mockLocalStorage.getItem(STORAGE_KEY)).toBe('warm')
  })

  it('writes "light" correctly', () => {
    setTheme('light')
    expect(mockDocument.documentElement.getAttribute('data-theme')).toBe('light')
  })
})

// ---------------------------------------------------------------------------
// getTheme
// ---------------------------------------------------------------------------

describe('getTheme', () => {
  it('returns the stored theme key when valid', () => {
    mockLocalStorage.setItem(STORAGE_KEY, 'dark')
    expect(getTheme()).toBe('dark')
  })

  it('returns "light" as the default when nothing is stored', () => {
    expect(getTheme()).toBe('light')
  })

  it('returns "light" when stored value is unrecognized', () => {
    mockLocalStorage.setItem(STORAGE_KEY, 'solarized')
    expect(getTheme()).toBe('light')
  })

  it('returns stored "light" unchanged', () => {
    mockLocalStorage.setItem(STORAGE_KEY, 'light')
    expect(getTheme()).toBe('light')
  })

  it('returns stored "warm" unchanged', () => {
    mockLocalStorage.setItem(STORAGE_KEY, 'warm')
    expect(getTheme()).toBe('warm')
  })
})

// ---------------------------------------------------------------------------
// getTheme - migration: old "medium" (cream palette) becomes "warm"
// ---------------------------------------------------------------------------

describe('getTheme - migration', () => {
  it('remaps stored "medium" to "warm" when migration flag is absent', () => {
    mockLocalStorage.setItem(STORAGE_KEY, 'medium')
    const result = getTheme()
    expect(result).toBe('warm')
  })

  it('sets the migration flag after remapping', () => {
    mockLocalStorage.setItem(STORAGE_KEY, 'medium')
    getTheme()
    expect(mockLocalStorage.getItem(MIGRATION_FLAG)).toBe('1')
  })

  it('updates the stored key from "medium" to "warm" after migration', () => {
    mockLocalStorage.setItem(STORAGE_KEY, 'medium')
    getTheme()
    expect(mockLocalStorage.getItem(STORAGE_KEY)).toBe('warm')
  })

  it('returns "medium" (new gray palette) when migration flag is already set', () => {
    mockLocalStorage.setItem(STORAGE_KEY, 'medium')
    mockLocalStorage.setItem(MIGRATION_FLAG, '1')
    const result = getTheme()
    expect(result).toBe('medium')
  })

  it('does not re-run migration on subsequent calls after it fired once', () => {
    // First call fires migration
    mockLocalStorage.setItem(STORAGE_KEY, 'medium')
    getTheme()

    // Simulate a user who re-saves "medium" (new gray) after migration
    mockLocalStorage.setItem(STORAGE_KEY, 'medium')
    // Flag is still set from the first call
    const result = getTheme()
    expect(result).toBe('medium')
  })
})

// ---------------------------------------------------------------------------
// initThemeOnLoad
// ---------------------------------------------------------------------------

describe('initThemeOnLoad', () => {
  it('applies the stored theme to documentElement', () => {
    mockLocalStorage.setItem(STORAGE_KEY, 'dark')
    initThemeOnLoad()
    expect(mockDocument.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('applies "light" as default when nothing is stored', () => {
    initThemeOnLoad()
    expect(mockDocument.documentElement.getAttribute('data-theme')).toBe('light')
  })
})

// ---------------------------------------------------------------------------
// THEME_CHOICES
// ---------------------------------------------------------------------------

describe('THEME_CHOICES', () => {
  it('has exactly 4 entries', () => {
    expect(THEME_CHOICES).toHaveLength(4)
  })

  it('has keys in the order: light, warm, medium, dark', () => {
    const keys = THEME_CHOICES.map((t) => t.key)
    expect(keys).toEqual(['light', 'warm', 'medium', 'dark'])
  })

  it('has unique keys', () => {
    const keys = THEME_CHOICES.map((t) => t.key)
    const unique = new Set(keys)
    expect(unique.size).toBe(4)
  })

  it('each entry has a non-empty label and description', () => {
    for (const t of THEME_CHOICES) {
      expect(t.label.length).toBeGreaterThan(0)
      expect(t.description.length).toBeGreaterThan(0)
    }
  })

  it('each entry has a preview object with hex color strings', () => {
    const hexRe = /^#[0-9a-fA-F]{6}$/
    for (const t of THEME_CHOICES) {
      expect(t.preview.bg).toMatch(hexRe)
      expect(t.preview.panel).toMatch(hexRe)
      expect(t.preview.accent).toMatch(hexRe)
      expect(t.preview.text).toMatch(hexRe)
    }
  })
})
