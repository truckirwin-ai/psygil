/**
 * English (en-US) localization strings.
 *
 * Wizard-focused strings extracted from setup steps. These strings are
 * the source of truth for all supported languages via the useLocale hook.
 *
 * Structure:
 *  - practice: Practice identity collection (Step 4)
 *  - clinical: Clinical preferences and evaluation types (Step 7)
 */

export const strings = {
  practice: {
    title: 'Tell us about your practice',
    subtitle: 'This information appears on report headers and the audit trail. It is stored locally on this machine and is not patient information.',
    fieldFullName: 'Full name',
    fieldCredentials: 'Credentials',
  },
  clinical: {
    title: 'Clinical preferences',
    subtitle: 'Select which evaluation types you perform and which test instruments you use.',
    evalTypes: 'Evaluation types',
    instruments: 'Test instruments',
  },
} as const

export type Strings = typeof strings
