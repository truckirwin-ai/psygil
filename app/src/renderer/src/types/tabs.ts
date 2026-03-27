// Tab types for center column tab management.
// Renderer-only — not shared with main process.

export type TabType = 'clinical-overview' | 'document'

export interface Tab {
  readonly id: string
  readonly title: string
  readonly type: TabType
  readonly filePath?: string
  readonly caseId?: number
}

export interface TabState {
  readonly tabs: readonly Tab[]
  readonly activeId: string | null
}
