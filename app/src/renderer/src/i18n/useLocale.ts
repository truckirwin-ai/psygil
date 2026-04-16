/**
 * useLocale hook for localization support.
 *
 * Returns an object with:
 *  - strings: The translated strings object for the current locale
 *  - locale: The current locale key ('en', 'fr', 'es', 'de')
 *  - setLocale: Function to change the locale (writes to localStorage)
 *
 * Reads from localStorage.psygil_locale on first call. Defaults to 'en' if
 * not set or invalid. Falls back to English for any empty string values
 * in non-English locales to handle incomplete translations gracefully.
 */

import { useState, useCallback } from 'react'

import { strings as en } from '../strings/en'
import { strings as fr } from '../strings/fr'
import { strings as es } from '../strings/es'
import { strings as de } from '../strings/de'
import type { Strings } from '../strings/en'

type LocaleKey = 'en' | 'fr' | 'es' | 'de'

const LOCALE_BUNDLES: Record<LocaleKey, Strings> = {
  en,
  fr,
  es,
  de,
}

function getInitialLocale(): LocaleKey {
  if (typeof window === 'undefined') return 'en'
  try {
    const stored = localStorage.getItem('psygil_locale')
    if (stored && (stored === 'en' || stored === 'fr' || stored === 'es' || stored === 'de')) {
      return stored as LocaleKey
    }
  } catch {
    // localStorage access may fail in some contexts
  }
  return 'en'
}

function getStringValue(value: string, fallback: string): string {
  return value && value.trim().length > 0 ? value : fallback
}

function mergeWithFallback(locale: Strings, fallback: Strings): Strings {
  const result: Record<string, Record<string, string>> = {}
  for (const [section, values] of Object.entries(locale)) {
    result[section] = {}
    const fallbackSection = (fallback as unknown as Record<string, Record<string, string>>)[section]
    for (const [key, value] of Object.entries(values)) {
      const fallbackValue = (fallbackSection?.[key] as string) ?? ''
      result[section]![key] = getStringValue(value, fallbackValue)
    }
  }
  return result as Strings
}

export interface UseLocaleReturn {
  strings: Strings
  locale: LocaleKey
  setLocale: (key: LocaleKey) => void
}

export function useLocale(): UseLocaleReturn {
  const [locale, setLocaleState] = useState<LocaleKey>(getInitialLocale())

  const setLocale = useCallback((key: LocaleKey) => {
    setLocaleState(key)
    try {
      localStorage.setItem('psygil_locale', key)
    } catch {
      // best effort: if localStorage is unavailable, we still set the state
    }
  }, [])

  const currentBundle = LOCALE_BUNDLES[locale]
  const fallbackBundle = LOCALE_BUNDLES.en
  const mergedStrings = locale === 'en' ? currentBundle : mergeWithFallback(currentBundle, fallbackBundle)

  return {
    strings: mergedStrings,
    locale,
    setLocale,
  }
}
