// Tab types for center column tab management.
// Renderer-only — not shared with main process.

export type TabType =
  | 'clinical-overview'
  | 'document'
  | 'dashboard'
  | 'tests'
  | 'diagnostics'
  | 'report'
  | 'attestation'
  | 'audit'
  | 'settings'
  | 'document-viewer'
  | 'evidence-map'
  | 'data-confirmation'
  | 'resource'

export interface Tab {
  readonly id: string
  readonly title: string
  readonly type: TabType
  readonly filePath?: string
  readonly caseId?: number
  /** For document-viewer: which document sub-type to show */
  readonly documentType?: string
  readonly documentId?: string
}

export interface TabState {
  readonly tabs: readonly Tab[]
  readonly activeId: string | null
}
