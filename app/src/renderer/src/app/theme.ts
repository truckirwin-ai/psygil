/**
 * Theme management helper for Psygil renderer.
 *
 * Manages three themes: light, warm, dark.
 * Applies the active theme via html[data-theme="..."] and persists the
 * selection to localStorage. Includes migration for users who had the
 * old "medium" key stored (now maps to "dark").
 */

export type ThemeKey = 'light' | 'warm' | 'dark'

const STORAGE_KEY = 'psygil_theme'
const DEFAULT_THEME: ThemeKey = 'light'

export interface ThemeChoice {
  readonly key: ThemeKey
  readonly label: string
  readonly description: string
  readonly preview: {
    readonly bg: string
    readonly panel: string
    readonly accent: string
    readonly text: string
  }
}

export const THEME_CHOICES: readonly ThemeChoice[] = [
  {
    key: 'light',
    label: 'Light',
    description: 'Bright white interface, ideal for well-lit environments.',
    preview: { bg: '#ffffff', panel: '#fafafb', accent: '#4f46e5', text: '#1a1a2e' },
  },
  {
    key: 'warm',
    label: 'Warm',
    description: 'Cream parchment tones, easy on the eyes for long sessions.',
    preview: { bg: '#faf8f4', panel: '#e6ddd0', accent: '#8b5e3c', text: '#2c2418' },
  },
  {
    key: 'dark',
    label: 'Dark',
    description: 'Neutral gray with higher contrast, reduced eye strain.',
    preview: { bg: '#1a1a2e', panel: '#12121e', accent: '#818cf8', text: '#d4d4dc' },
  },
] as const

/**
 * Write data-theme attribute and persist to localStorage.
 */
export function setTheme(key: ThemeKey): void {
  document.documentElement.setAttribute('data-theme', key)
  localStorage.setItem(STORAGE_KEY, key)
}

/**
 * Read the stored theme key. Migrates legacy values:
 *   - "medium" (the old neutral gray key) maps to "dark"
 */
export function getTheme(): ThemeKey {
  const stored = localStorage.getItem(STORAGE_KEY)

  // Migration: old "medium" key is now "dark"
  if (stored === 'medium') {
    localStorage.setItem(STORAGE_KEY, 'dark')
    return 'dark'
  }

  if (stored === 'light' || stored === 'warm' || stored === 'dark') {
    return stored
  }

  return DEFAULT_THEME
}

/**
 * Read the stored theme and apply it to the document element.
 * Call once at app startup before the first render.
 */
export function initThemeOnLoad(): void {
  const key = getTheme()
  document.documentElement.setAttribute('data-theme', key)
}
