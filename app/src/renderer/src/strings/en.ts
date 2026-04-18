/**
 * English (en-US) localization strings.
 *
 * Wizard-focused strings extracted from setup steps. These strings are
 * the source of truth for all supported languages via the useLocale hook.
 *
 * Structure:
 *  - welcome: Sidecar health check intro (Step 1)
 *  - practice: Practice identity collection (Step 4)
 *  - clinical: Clinical preferences and evaluation types (Step 7)
 */

export const strings = {
  welcome: {
    title: 'Welcome to Psygil',
    subtitle: 'Forensic and clinical evaluation software.',
    getStarted: 'Get started',
    sidcarHealthCheck: 'Sidecar health check',
    sidecarLoading: 'Loading encryption and PII detection...',
    sidecarReady: 'Sidecar ready',
  },
  practice: {
    title: 'Tell us about your practice',
    subtitle: 'This information appears on report headers and the audit trail. It is stored locally on this machine and is not patient information.',
    fieldFullName: 'Full name',
    fieldCredentials: 'Credentials',
    fieldLicenseNumber: 'License number',
    fieldLicenseState: 'License state',
    fieldSpecialty: 'Specialty',
    fieldPracticeName: 'Practice name',
    fieldNpi: 'NPI number',
    fieldAddress: 'Address',
    fieldPhone: 'Phone',
    required: 'required',
  },
  clinical: {
    title: 'Clinical preferences',
    subtitle: 'Select which evaluation types you perform and which test instruments you use.',
    fieldEvaluationType: 'Primary evaluation type',
    fieldJurisdiction: 'Jurisdiction',
    evalTypes: 'Evaluation types',
    instruments: 'Test instruments',
    selectEvalTypes: 'Select the evaluation types you perform',
    selectInstruments: 'Select the test instruments you use',
  },
} as const

export type Strings = typeof strings
