/**
 * Shared types and style helpers for SetupWizard step components.
 */

import type { CSSProperties } from 'react'
import type { SetupConfig } from '../../../../shared/types/setup'

export interface StepProps {
  readonly config: SetupConfig
  readonly onConfigUpdate: (config: SetupConfig) => void
  readonly onAdvance: () => void
}

// ---------------------------------------------------------------------------
// Style helpers, keep visual consistency without a CSS module dependency
// ---------------------------------------------------------------------------

export const styles = {
  heading: {
    fontSize: 22,
    fontWeight: 700,
    marginBottom: 4,
    color: 'var(--text)',
    letterSpacing: -0.3,
  } satisfies CSSProperties,

  subheading: {
    fontSize: 14,
    color: 'var(--text-secondary)',
    marginBottom: 24,
    lineHeight: 1.5,
  } satisfies CSSProperties,

  fieldLabel: {
    display: 'block',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text)',
    marginBottom: 4,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.4,
  } satisfies CSSProperties,

  input: {
    width: '100%',
    padding: '8px 12px',
    background: 'var(--bg)',
    color: 'var(--text)',
    border: '1px solid var(--border)',
    borderRadius: 4,
    fontSize: 14,
    boxSizing: 'border-box' as const,
    fontFamily: 'inherit',
  } satisfies CSSProperties,

  fieldRow: {
    marginBottom: 16,
  } satisfies CSSProperties,

  fieldGrid2: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 16,
    marginBottom: 16,
  } satisfies CSSProperties,

  primaryButton: {
    padding: '10px 20px',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  } satisfies CSSProperties,

  secondaryButton: {
    padding: '10px 20px',
    background: 'transparent',
    color: 'var(--text)',
    border: '1px solid var(--border)',
    borderRadius: 4,
    fontSize: 14,
    cursor: 'pointer',
  } satisfies CSSProperties,

  errorBox: {
    padding: '10px 14px',
    background: 'rgba(220, 38, 38, 0.08)',
    border: '1px solid rgba(220, 38, 38, 0.4)',
    borderRadius: 4,
    color: '#dc2626',
    fontSize: 13,
    marginBottom: 16,
  } satisfies CSSProperties,

  warningBox: {
    padding: '10px 14px',
    background: 'rgba(245, 158, 11, 0.08)',
    border: '1px solid rgba(245, 158, 11, 0.4)',
    borderRadius: 4,
    color: '#b45309',
    fontSize: 13,
    marginBottom: 16,
  } satisfies CSSProperties,

  successBox: {
    padding: '10px 14px',
    background: 'rgba(34, 197, 94, 0.08)',
    border: '1px solid rgba(34, 197, 94, 0.4)',
    borderRadius: 4,
    color: '#15803d',
    fontSize: 13,
    marginBottom: 16,
  } satisfies CSSProperties,

  card: {
    border: '1px solid var(--border)',
    borderRadius: 6,
    padding: 16,
    background: 'var(--panel)',
    marginBottom: 16,
  } satisfies CSSProperties,

  footerActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 24,
    paddingTop: 16,
    borderTop: '1px solid var(--border)',
  } satisfies CSSProperties,
} as const
