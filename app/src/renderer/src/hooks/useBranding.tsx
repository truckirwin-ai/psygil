/**
 * Branding context and hook.
 *
 * Loads practice branding once on app mount, listens for 'branding:changed'
 * broadcasts from main, and exposes the current branding to any consumer.
 *
 * Consumers call useBranding() and re-render automatically when the user
 * saves new branding in Settings > Practice.
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export interface PracticeBranding {
  practiceName: string
  logoPath?: string
  logoData?: string
  primaryColor: string
  tagline?: string
  showAttribution: boolean
}

const DEFAULT_BRANDING: PracticeBranding = {
  practiceName: '',
  logoPath: undefined,
  logoData: undefined,
  primaryColor: '#2E75B6',
  tagline: undefined,
  showAttribution: true,
}

interface BrandingContextValue {
  branding: PracticeBranding
  /** Base64 data URL for the logo, or null if no logo is set */
  logoDataUrl: string | null
  /**
   * Display name to show in the UI chrome. Falls back to "Psygil" when
   * the practice name is blank so the app never looks unbranded.
   */
  displayName: string
}

const BrandingContext = createContext<BrandingContextValue>({
  branding: DEFAULT_BRANDING,
  logoDataUrl: null,
  displayName: 'Psygil',
})

function deriveLogoDataUrl(b: PracticeBranding): string | null {
  if (!b.logoData) return null
  const ext = b.logoPath?.endsWith('.png')
    ? 'png'
    : b.logoPath?.endsWith('.jpg') || b.logoPath?.endsWith('.jpeg')
    ? 'jpeg'
    : 'png'
  return `data:image/${ext};base64,${b.logoData}`
}

export function BrandingProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [branding, setBranding] = useState<PracticeBranding>(DEFAULT_BRANDING)

  // Load on mount
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        // @ts-ignore — branding namespace added to PsygilApi
        const resp = await window.psygil.branding.get()
        if (!cancelled && resp.status === 'success') {
          setBranding(resp.data as PracticeBranding)
        }
      } catch (e) {
        console.error('[BrandingProvider] initial load failed:', e)
      }
    })()
    return () => { cancelled = true }
  }, [])

  // Subscribe to main-process broadcasts
  useEffect(() => {
    // @ts-ignore — onChanged added to PsygilApi
    const unsubscribe = window.psygil.branding.onChanged?.((updated: PracticeBranding) => {
      setBranding(updated)
    })
    return () => { if (typeof unsubscribe === 'function') unsubscribe() }
  }, [])

  const value = useMemo<BrandingContextValue>(() => ({
    branding,
    logoDataUrl: deriveLogoDataUrl(branding),
    displayName: branding.practiceName.trim() || 'Psygil',
  }), [branding])

  // Keep the OS window title in sync too.
  useEffect(() => {
    document.title = value.displayName
  }, [value.displayName])

  return (
    <BrandingContext.Provider value={value}>
      {children}
    </BrandingContext.Provider>
  )
}

export function useBranding(): BrandingContextValue {
  return useContext(BrandingContext)
}
