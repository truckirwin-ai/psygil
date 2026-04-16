/**
 * Theme management helper for Psygil renderer.
 *
 * Manages the four-theme system: light, warm, medium, dark.
 * Applies the active theme via html[data-theme="..."] and persists the
 * selection to localStorage. Includes a one-time migration for users who
 * had the old "medium" (cream palette) theme stored, which is now "warm".
 */

export type ThemeKey = 'light' | 'warm' | 'medium' | 'dark'

const STORAGE_KEY = 'psygil_theme'
const MIGRATION_FLAG = 'psygil_theme_migrated_v1'
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
    preview: { bg: '#ffffff', panel: '#f3f3f3', accent: '#0078d4', text: '#1e1e1e' },
  },
  {
    key: 'warm',
    label: 'Warm',
    description: 'Cream parchment tones, easy on the eyes for long sessions.',
    preview: { bg: '#faf8f4', panel: '#e6ddd0', accent: '#8b5e3c', text: '#2c2418' },
  },
  {
    key: 'medium',
    label: 'Medium',
    description: 'Neutral gray, higher contrast without full dark mode.',
    preview: { bg: '#2b2f36', panel: '#1f2329', accent: '#7aa2ff', text: '#e6e8ea' },
  },
  {
    key: 'dark',
    label: 'Dark',
    description: 'Deep dark, minimal eye strain in low-light environments.',
    preview: { bg: '#0d1117', panel: '#161b22', accent: '#58a6ff', text: '#c9d1d9' },
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
 * Read the stored theme key, applying the one-time "medium -> warm" migration
 * for users whose stored value was the old cream palette.
 *
 * Migration logic:
 *   - Before E.7, "medium" meant cream parchment (now "warm").
 *   - After E.7, "medium" is the new neutral gray palette.
 *   - If localStorage has "medium" and the migration flag is absent, we remap
 *     to "warm" and set the flag so the migration only fires once.
 *   - On subsequent reads the stored value "warm" is returned as-is.
 */
export function getTheme(): ThemeKey {
  const stored = localStorage.getItem(STORAGE_KEY)

  if (stored === 'medium') {
    const migrated = localStorage.getItem(MIGRATION_FLAG)
    if (migrated === null) {
      // One-time migration: old "medium" (cream) is now "warm".
      localStorage.setItem(STORAGE_KEY, 'warm')
      localStorage.setItem(MIGRATION_FLAG, '1')
      return 'warm'
    }
    // Migration already ran; "medium" now refers to the new gray palette.
    return 'medium'
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
