import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import type { Tab } from '../../types/tabs'
import type { CaseRow, PatientIntakeRow, PatientOnboardingRow } from '../../../../shared/types/ipc'

// New standalone tab components
import DashboardTab from '../tabs/DashboardTab'
import TestResultsTab from '../tabs/TestResultsTab'
import { DiagnosticsTab } from '../tabs/DiagnosticsTab'
import EvalReportTab from '../tabs/EvalReportTab'
import { AttestationTab } from '../tabs/AttestationTab'
import { AuditTrailTab } from '../tabs/AuditTrailTab'
import SettingsTab from '../tabs/SettingsTab'
import DocumentViewerTab from '../tabs/DocumentViewerTab'
import EvidenceMapTab from '../tabs/EvidenceMapTab'
import DataConfirmationTab from '../tabs/DataConfirmationTab'
import PipelinePanel from '../tabs/PipelinePanel'

// ---------------------------------------------------------------------------
// Pipeline stage constants
// ---------------------------------------------------------------------------

const PIPELINE_STAGE_LIST = [
  { key: 'onboarding', label: 'Onboarding', color: '#2196f3' },
  { key: 'testing', label: 'Testing', color: '#9c27b0' },
  { key: 'interview', label: 'Interview', color: '#e91e63' },
  { key: 'diagnostics', label: 'Diagnostics', color: '#ff9800' },
  { key: 'review', label: 'Review', color: '#ff5722' },
  { key: 'complete', label: 'Complete', color: '#4caf50' },
] as const

type StageKey = (typeof PIPELINE_STAGE_LIST)[number]['key']

// Kept for the bottom pipeline bar
const PIPELINE_STAGES = PIPELINE_STAGE_LIST

const STAGE_COLORS: Record<string, string> = {
  onboarding: '#2196f3',
  testing: '#9c27b0',
  interview: '#e91e63',
  diagnostics: '#ff9800',
  review: '#ff5722',
  complete: '#4caf50',
}

const STAGE_ORDER: StageKey[] = [
  'onboarding',
  'testing',
  'interview',
  'diagnostics',
  'review',
  'complete',
]

function getStageIndex(stage: string | null): number {
  if (stage == null) return 0
  const idx = STAGE_ORDER.indexOf(stage as StageKey)
  return idx === -1 ? 0 : idx
}

function getStageColor(stage: string | null): string {
  return stage != null && stage in STAGE_COLORS ? STAGE_COLORS[stage] : '#9e9e9e'
}

function getStageLabel(stage: string | null): string {
  if (stage == null) return 'Unknown'
  const found = PIPELINE_STAGE_LIST.find((s) => s.key === stage)
  return found?.label ?? stage
}

// ---------------------------------------------------------------------------
// Instrument data
// ---------------------------------------------------------------------------

interface InstrumentInfo {
  fullName: string
  category: string
  duration: string
  isValidity: boolean
}

const INSTRUMENT_INFO: Record<string, InstrumentInfo> = {
  'MMPI-3': {
    fullName: 'Minnesota Multiphasic Personality Inventory-3',
    category: 'Personality/Psychopathology',
    duration: '35–50 min',
    isValidity: false,
  },
  PAI: {
    fullName: 'Personality Assessment Inventory',
    category: 'Personality/Psychopathology',
    duration: '40–50 min',
    isValidity: false,
  },
  'WAIS-V': {
    fullName: 'Wechsler Adult Intelligence Scale-V',
    category: 'Cognitive/IQ',
    duration: '60–90 min',
    isValidity: false,
  },
  TOMM: {
    fullName: 'Test of Memory Malingering',
    category: 'Effort/Validity',
    duration: '15–20 min',
    isValidity: true,
  },
  'SIRS-2': {
    fullName: 'Structured Interview of Reported Symptoms-2',
    category: 'Effort/Validity',
    duration: '30–45 min',
    isValidity: true,
  },
  'PCL-R': {
    fullName: 'Psychopathy Checklist-Revised',
    category: 'Risk Assessment',
    duration: '60–90 min',
    isValidity: false,
  },
  'HCR-20': {
    fullName: 'Historical Clinical Risk Management-20',
    category: 'Risk Assessment',
    duration: 'Variable',
    isValidity: false,
  },
  'HCR-20v3': {
    fullName: 'Historical Clinical Risk Management-20 (v3)',
    category: 'Risk Assessment',
    duration: 'Variable',
    isValidity: false,
  },
  'CAPS-5': {
    fullName: 'Clinician-Administered PTSD Scale for DSM-5',
    category: 'PTSD Assessment',
    duration: '45–60 min',
    isValidity: false,
  },
  'M-FAST': {
    fullName: 'Miller Forensic Assessment of Symptoms Test',
    category: 'Effort/Validity',
    duration: '5–10 min',
    isValidity: true,
  },
  MoCA: {
    fullName: 'Montreal Cognitive Assessment',
    category: 'Cognitive Screening',
    duration: '10 min',
    isValidity: false,
  },
  CAARS: {
    fullName: 'Conners Adult ADHD Rating Scale',
    category: 'ADHD',
    duration: '10–15 min',
    isValidity: false,
  },
  'CPT-3': {
    fullName: 'Conners Continuous Performance Test-3',
    category: 'Attention',
    duration: '14 min',
    isValidity: false,
  },
  'MCMI-IV': {
    fullName: 'Millon Clinical Multiaxial Inventory-IV',
    category: 'Personality',
    duration: '25–30 min',
    isValidity: false,
  },
  'BDI-II': {
    fullName: 'Beck Depression Inventory-II',
    category: 'Depression',
    duration: '5–10 min',
    isValidity: false,
  },
  BAI: {
    fullName: 'Beck Anxiety Inventory',
    category: 'Anxiety',
    duration: '5–10 min',
    isValidity: false,
  },
  SARA: {
    fullName: 'Spousal Assault Risk Assessment',
    category: 'Risk Assessment',
    duration: 'Variable',
    isValidity: false,
  },
  AUDIT: {
    fullName: 'Alcohol Use Disorders Identification Test',
    category: 'Screening',
    duration: '5 min',
    isValidity: false,
  },
  'ABAS-3': {
    fullName: 'Adaptive Behavior Assessment System-3',
    category: 'Adaptive Behavior',
    duration: 'Variable',
    isValidity: false,
  },
  'Vineland-3': {
    fullName: 'Vineland Adaptive Behavior Scales-3',
    category: 'Adaptive Behavior',
    duration: 'Variable',
    isValidity: false,
  },
  'PCL-5': {
    fullName: 'PTSD Checklist for DSM-5',
    category: 'PTSD Screening',
    duration: '5–10 min',
    isValidity: false,
  },
  'TSI-2': {
    fullName: 'Trauma Symptom Inventory-2',
    category: 'Trauma',
    duration: '20–30 min',
    isValidity: false,
  },
  'DES-II': {
    fullName: 'Dissociative Experiences Scale-II',
    category: 'Dissociation',
    duration: '10 min',
    isValidity: false,
  },
  FBS: {
    fullName: 'Fake Bad Scale',
    category: 'Effort/Validity',
    duration: 'Embedded',
    isValidity: true,
  },
  SIMS: {
    fullName: 'Structured Inventory of Malingered Symptomatology',
    category: 'Effort/Validity',
    duration: '10 min',
    isValidity: true,
  },
}

function getInstrumentsForEvalType(evalType: string | null): string[] {
  const et = (evalType ?? '').toLowerCase()
  if (et.includes('cst') || et.includes('fitness') || et.includes('competency')) {
    return ['MMPI-3', 'PAI', 'WAIS-V', 'TOMM', 'SIRS-2', 'M-FAST']
  }
  if (et.includes('custody')) {
    return ['MMPI-3', 'PAI', 'MCMI-IV', 'BDI-II', 'BAI']
  }
  if (et.includes('risk')) {
    return ['PCL-R', 'HCR-20v3', 'SARA', 'PAI', 'MMPI-3', 'TOMM']
  }
  if (et.includes('ptsd')) {
    return ['CAPS-5', 'PCL-5', 'TSI-2', 'DES-II', 'PAI', 'MMPI-3', 'TOMM']
  }
  if (et.includes('malingering')) {
    return ['SIRS-2', 'TOMM', 'M-FAST', 'MMPI-3', 'PAI']
  }
  if (et.includes('capacity')) {
    return ['MoCA', 'WAIS-V', 'ABAS-3', 'PAI', 'TOMM']
  }
  if (et.includes('adhd')) {
    return ['CAARS', 'CPT-3', 'WAIS-V', 'MMPI-3', 'TOMM']
  }
  return ['MMPI-3', 'PAI', 'TOMM']
}

function getCollateralDocs(evalType: string | null): string[] {
  const et = (evalType ?? '').toLowerCase()
  if (et.includes('cst') || et.includes('fitness') || et.includes('competency')) {
    return [
      'Court Order',
      'Police Report',
      'Jail Medical Records',
      'Prior Mental Health Records',
      'Informed Consent',
    ]
  }
  if (et.includes('custody')) {
    return ['Family Court Filing', 'Prior Custody Evaluations', 'CPS Records', 'Informed Consent']
  }
  if (et.includes('risk')) {
    return ['Prior Offense History', 'Victim Impact Statements', 'Informed Consent']
  }
  if (et.includes('ptsd')) {
    return ['Medical Records-Treating Provider', 'Employment Records', 'Informed Consent']
  }
  if (et.includes('capacity')) {
    return [
      'Medical Records-Primary Care',
      'Neurology Consultation',
      'Financial Records',
      'Informed Consent',
    ]
  }
  if (et.includes('malingering')) {
    return ['Prior Psychological Evaluations', 'Insurance Claim File', 'Informed Consent']
  }
  if (et.includes('adhd')) {
    return ['School Records/Transcripts', 'Prior Neuropsych Testing', 'Informed Consent']
  }
  return ['Referral Documentation', 'Informed Consent']
}

function getSessionTitles(evalType: string | null): string[] {
  const et = (evalType ?? '').toLowerCase()
  if (et.includes('cst') || et.includes('fitness') || et.includes('competency')) {
    return [
      'Clinical Interview — Psychiatric History & Mental Status',
      'Competency-Focused Interview — Dusky Criteria',
      'Collateral Interview — Defense Counsel',
    ]
  }
  if (et.includes('custody')) {
    return [
      'Parent Interview — Parenting History & Current Functioning',
      'Child Observation & Home Assessment',
    ]
  }
  if (et.includes('risk')) {
    return ['Clinical Interview — History & Index Offense', 'Structured Risk Assessment Interview']
  }
  if (et.includes('ptsd')) {
    return [
      'Clinical Interview — Trauma History & Symptom Assessment',
      'CAPS-5 Structured Interview',
    ]
  }
  if (et.includes('malingering')) {
    return ['Clinical Interview — Symptom Presentation', 'SIRS-2 Interview & Behavioral Analysis']
  }
  if (et.includes('capacity')) {
    return [
      'Clinical Interview — Cognitive & Functional Assessment',
      'Collateral Interview — Family/Caregiver',
    ]
  }
  return ['Clinical Interview — History & Presenting Concerns', 'Follow-up Interview']
}

function getReportSections(evalType: string | null): string[] {
  const et = (evalType ?? '').toLowerCase()
  const base = [
    'Identifying Information & Referral Question',
    'Informed Consent & Evaluation Procedures',
    'Background Information',
    'Behavioral Observations',
    'Test Results & Validity',
    'Clinical Interview Findings',
  ]
  if (et.includes('cst') || et.includes('fitness') || et.includes('competency')) {
    return [...base, 'Competency Analysis — Dusky Criteria', 'Diagnostic Impressions', 'Opinions & Recommendations']
  }
  if (et.includes('custody')) {
    return [...base, 'Parenting Capacity Analysis', 'Best Interest Assessment', 'Recommendations']
  }
  if (et.includes('risk')) {
    return [...base, 'Risk Factor Analysis', 'Dynamic Risk Factors', 'Risk Level Opinion', 'Risk Management Recommendations']
  }
  if (et.includes('ptsd')) {
    return [...base, 'Trauma History & PTSD Criteria', 'Diagnostic Impressions', 'Treatment Recommendations']
  }
  if (et.includes('malingering')) {
    return [...base, 'Validity & Effort Analysis', 'Symptom Validity Conclusions', 'Diagnostic Impressions']
  }
  if (et.includes('capacity')) {
    return [...base, 'Cognitive & Functional Assessment', 'Capacity Opinion', 'Recommendations']
  }
  return [...base, 'Diagnostic Impressions', 'Summary & Recommendations']
}

// ---------------------------------------------------------------------------
// Sub-tab type
// ---------------------------------------------------------------------------

type OverviewSubTab =
  | 'intake'
  | 'referral'
  | 'collateral'
  | 'testing'
  | 'interviews'
  | 'diagnostics'
  | 'report'
  | 'archive'

interface SubTabDef {
  readonly id: OverviewSubTab
  readonly label: string
  /** Stage index at which this workflow step is considered complete.
   *  Stages: onboarding=0, testing=1, interview=2, diagnostics=3, review=4, complete=5 */
  readonly doneAtStage: number
}

// Full clinical workflow — all tabs always visible.
// This is the actual sequence a forensic psychologist works through.
const ALL_SUB_TABS: SubTabDef[] = [
  { id: 'intake', label: 'Intake', doneAtStage: 1 },        // done when past onboarding (Referral is inner tab)
  { id: 'testing', label: 'Testing', doneAtStage: 2 },       // done when past testing
  { id: 'interviews', label: 'Interviews', doneAtStage: 3 }, // done when past interview
  { id: 'diagnostics', label: 'Diagnostics', doneAtStage: 4 }, // done when past diagnostics
  { id: 'report', label: 'Reports', doneAtStage: 5 },        // done when complete
  { id: 'collateral', label: 'Documents', doneAtStage: 5 },  // after reports — file browser
  { id: 'archive', label: 'Archive', doneAtStage: 5 },       // done when complete
]

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CenterColumnProps {
  readonly tabs: readonly Tab[]
  readonly activeTabId: string | null
  readonly onCloseTab: (id: string) => void
  readonly onSetActiveTab: (id: string) => void
  readonly onEditIntake: (caseId: number) => void
  readonly onOpenTab: (tab: Tab) => void
  readonly cases: readonly CaseRow[]
  readonly onRefreshCases?: () => void
  readonly onUploadDocuments?: (caseId: number) => void
  readonly onImportScores?: (caseId: number) => void
}

// ---------------------------------------------------------------------------
// CenterColumn
// ---------------------------------------------------------------------------

export default function CenterColumn({
  tabs,
  activeTabId,
  onCloseTab,
  onSetActiveTab,
  onEditIntake,
  onOpenTab,
  cases,
  onRefreshCases,
  onUploadDocuments,
  onImportScores,
}: CenterColumnProps): React.JSX.Element {
  const activeTab = tabs.find((t) => t.id === activeTabId)

  // Derive current stage from active tab's case for the pipeline panel
  const activeCaseId = activeTab?.caseId ?? null
  const activeCase = activeCaseId != null
    ? (cases as CaseRow[]).find((c) => c.case_id === activeCaseId) ?? null
    : null
  const activeCaseStage = activeCase?.workflow_current_stage ?? null

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--bg)',
        overflow: 'hidden',
      }}
    >
      {/* Tab bar */}
      <div
        className="tab-bar"
        style={{
          height: 32,
          display: 'flex',
          alignItems: 'stretch',
          background: 'var(--panel)',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
          overflowX: 'auto',
        }}
      >
        {tabs.length === 0 ? (
          <span
            style={{
              padding: '0 16px',
              fontSize: 12,
              color: 'var(--text-secondary)',
              fontStyle: 'italic',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            No open tabs
          </span>
        ) : (
          tabs.map((tab) => (
            <TabButton
              key={tab.id}
              tab={tab}
              isActive={tab.id === activeTabId}
              onActivate={() => onSetActiveTab(tab.id)}
              onClose={() => onCloseTab(tab.id)}
            />
          ))
        )}
      </div>

      {/* Content area */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {activeTab == null ? (
          <WelcomeContent />
        ) : activeTab.type === 'clinical-overview' ? (
          <ClinicalOverviewContent tab={activeTab} onEditIntake={onEditIntake} onUploadDocuments={onUploadDocuments} onImportScores={onImportScores} onOpenTab={onOpenTab} />
        ) : activeTab.type === 'dashboard' ? (
          <DashboardTab
            cases={cases as CaseRow[]}
            onCaseClick={(caseId) => {
              const c = (cases as CaseRow[]).find((r) => r.case_id === caseId)
              if (c) {
                onOpenTab({
                  id: `overview:${c.case_id}`,
                  title: `${c.examinee_last_name}, ${c.examinee_first_name}`,
                  type: 'clinical-overview',
                  caseId: c.case_id,
                })
              }
            }}
            onRefresh={onRefreshCases}
          />
        ) : activeTab.type === 'tests' ? (
          <TestResultsTab caseId={activeTab.caseId!} />
        ) : activeTab.type === 'diagnostics' ? (
          <DiagnosticsTab caseId={activeTab.caseId!} />
        ) : activeTab.type === 'report' ? (
          <EvalReportTab caseId={activeTab.caseId!} />
        ) : activeTab.type === 'attestation' ? (
          <AttestationTab caseId={activeTab.caseId!} />
        ) : activeTab.type === 'audit' ? (
          <AuditTrailTab caseId={activeTab.caseId!} />
        ) : activeTab.type === 'settings' ? (
          <SettingsTab />
        ) : activeTab.type === 'document-viewer' ? (
          <DocumentViewerTab
            caseId={activeTab.caseId!}
            documentType={activeTab.documentType ?? 'collateral'}
            documentId={activeTab.documentId}
          />
        ) : activeTab.type === 'evidence-map' ? (
          <EvidenceMapTab caseId={activeTab.caseId!} />
        ) : activeTab.type === 'data-confirmation' ? (
          <DataConfirmationTab caseId={activeTab.caseId!} />
        ) : activeTab.type === 'resource' ? (
          <ResourceViewerTab filePath={activeTab.filePath!} title={activeTab.title} />
        ) : (
          <DocumentContent tab={activeTab} />
        )}
      </div>

      {/* Pipeline bar — 80px */}
      <PipelinePanel
        currentStage={activeCaseStage}
        caseId={activeCaseId}
        onStageAdvanced={onRefreshCases}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// TabButton
// ---------------------------------------------------------------------------

function TabButton({
  tab,
  isActive,
  onActivate,
  onClose,
}: {
  readonly tab: Tab
  readonly isActive: boolean
  readonly onActivate: () => void
  readonly onClose: () => void
}): React.JSX.Element {
  const [hovered, setHovered] = useState(false)
  const [closeHovered, setCloseHovered] = useState(false)

  const isPinned = tab.type === 'dashboard'
  const showClose = !isPinned && (isActive || hovered)

  const handleClose = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onClose()
    },
    [onClose],
  )

  return (
    <div
      style={{
        height: 32,
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        gap: 6,
        borderRight: '1px solid var(--border)',
        fontSize: 12,
        cursor: 'pointer',
        color: isActive || hovered ? 'var(--text)' : 'var(--text-secondary)',
        background: isActive ? 'var(--bg)' : hovered ? 'var(--highlight)' : 'transparent',
        fontWeight: isActive ? 500 : 400,
        borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
        flexShrink: 0,
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onActivate}
    >
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>
        {tab.title}
      </span>
      <span
        style={{
          width: 16,
          height: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 3,
          fontSize: 12,
          opacity: showClose ? (closeHovered ? 1 : 0.6) : 0,
          background: closeHovered ? 'rgba(0,0,0,0.1)' : 'transparent',
          flexShrink: 0,
          transition: 'opacity 0.1s',
        }}
        onMouseEnter={() => setCloseHovered(true)}
        onMouseLeave={() => setCloseHovered(false)}
        onClick={handleClose}
      >
        &#10005;
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// WelcomeContent
// ---------------------------------------------------------------------------

function WelcomeContent(): React.JSX.Element {
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}
    >
      <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
        <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.3 }}>&#128203;</div>
        <div style={{ fontSize: 14, fontWeight: 500 }}>Open a case to begin</div>
        <div style={{ fontSize: 12, marginTop: 4 }}>
          Select a case from the tree or create a new one
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ClinicalOverviewContent — full implementation
// ---------------------------------------------------------------------------

function ClinicalOverviewContent({
  tab,
  onEditIntake,
  onUploadDocuments,
  onImportScores,
  onOpenTab,
}: {
  readonly tab: Tab
  readonly onEditIntake: (caseId: number) => void
  readonly onUploadDocuments?: (caseId: number) => void
  readonly onImportScores?: (caseId: number) => void
  readonly onOpenTab?: (tab: Tab) => void
}): React.JSX.Element {
  const [caseRow, setCaseRow] = useState<CaseRow | null>(null)
  const [intakeRow, setIntakeRow] = useState<PatientIntakeRow | null>(null)
  const [onboardingSections, setOnboardingSections] = useState<readonly PatientOnboardingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [activeSubTab, setActiveSubTab] = useState<OverviewSubTab>('intake')
  const [diagnosticFormulation, setDiagnosticFormulation] = useState<{
    impressions: string; ruledOut: string; validity: string; prognosis: string;
    conditions: { name: string; dsmCode: string; notes: string; status: string }[]
  } | null>(null)

  useEffect(() => {
    if (tab.caseId == null) return
    let cancelled = false
    setLoading(true)

    void (async () => {
      try {
        const [caseResp, intakeResp] = await Promise.all([
          window.psygil.cases.get({ case_id: tab.caseId as number }),
          window.psygil.intake.get({ case_id: tab.caseId as number }),
        ])

        if (cancelled) return

        if (caseResp.status === 'success') setCaseRow(caseResp.data)
        if (intakeResp.status === 'success') setIntakeRow(intakeResp.data)

        // Fetch onboarding separately so a failure doesn't block case/intake
        try {
          const obResp = await window.psygil.onboarding.get({ case_id: tab.caseId as number })
          if (!cancelled && obResp.status === 'success') setOnboardingSections(obResp.data)
        } catch (obErr) {
          console.warn('[ClinicalOverview] Onboarding fetch failed (non-fatal):', obErr)
        }
      } catch (err) {
        console.error('[ClinicalOverview] Failed to load case data:', err)
      }
      if (!cancelled) setLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [tab.caseId])

  const handleEditIntake = useCallback(() => {
    if (tab.caseId != null) onEditIntake(tab.caseId)
  }, [tab.caseId, onEditIntake])

  const handleBuildReport = useCallback((formulation: typeof diagnosticFormulation) => {
    setDiagnosticFormulation(formulation)
    setActiveSubTab('report')
  }, [])

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: 'var(--text-secondary)',
          fontSize: 13,
        }}
      >
        Loading…
      </div>
    )
  }

  if (caseRow == null) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: 'var(--text-secondary)',
          fontSize: 13,
        }}
      >
        Case not found.
      </div>
    )
  }

  const stage = caseRow.workflow_current_stage ?? 'onboarding'
  const stageIndex = getStageIndex(stage)
  const stageColor = getStageColor(stage)
  const stageLabel = getStageLabel(stage)
  const fullName = `${caseRow.examinee_last_name}, ${caseRow.examinee_first_name}`

  // All workflow tabs always visible
  const visibleTabs = ALL_SUB_TABS

  const effectiveSubTab = visibleTabs.some((t) => t.id === activeSubTab)
    ? activeSubTab
    : 'intake'

  const deadline = intakeRow?.report_deadline ?? null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* ── Case header — name (left), metadata (right) ── */}
      <div
        style={{
          padding: '10px 24px',
          borderBottom: '1px solid var(--border)',
          background: '#fff',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>{fullName}</div>
          <span
            style={{
              background: stageColor,
              color: '#fff',
              fontSize: 10,
              fontWeight: 700,
              borderRadius: 3,
              padding: '2px 8px',
              letterSpacing: 0.5,
              textTransform: 'uppercase',
              flexShrink: 0,
            }}
          >
            {stageLabel}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12, color: 'var(--text-secondary)', flexShrink: 0 }}>
          <MetaChip label="Case #" value={caseRow.case_number} />
          <MetaChip label="Opened" value={new Date(caseRow.created_at).toLocaleDateString()} />
          {deadline != null && deadline !== '' && (
            <MetaChip label="Due" value={new Date(deadline).toLocaleDateString()} />
          )}
        </div>
      </div>

      {/* ── Sub-tab bar — tabs (left), action buttons (right) ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          borderBottom: '1px solid var(--border)',
          background: 'var(--panel)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', overflowX: 'auto', flex: 1, minWidth: 0 }}>
          {visibleTabs.map(({ id, label, doneAtStage }) => {
            const isDone = stageIndex >= doneAtStage
            return (
              <button
                key={id}
                onClick={() => setActiveSubTab(id)}
                style={{
                  padding: '7px 16px',
                  fontSize: 12,
                  fontWeight: effectiveSubTab === id ? 600 : 400,
                  color:
                    effectiveSubTab === id ? 'var(--accent)' : 'var(--text-secondary)',
                  background: effectiveSubTab === id ? '#fff' : 'transparent',
                  border: 'none',
                  borderBottom:
                    effectiveSubTab === id
                      ? '2px solid var(--accent)'
                      : '2px solid transparent',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Sub-tab content ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: effectiveSubTab === 'report' ? 0 : '20px 24px' }}>
        {effectiveSubTab === 'intake' && (
          <IntakeSubTab caseRow={caseRow} intakeRow={intakeRow} onboardingSections={onboardingSections} onEdit={handleEditIntake} />
        )}
        {effectiveSubTab === 'collateral' && (
          <DocumentsSubTab caseRow={caseRow} intakeRow={intakeRow} stageIndex={stageIndex} onEdit={handleEditIntake} />
        )}
        {effectiveSubTab === 'testing' && (
          <TestingSubTab caseRow={caseRow} stageIndex={stageIndex} />
        )}
        {effectiveSubTab === 'interviews' && (
          <InterviewsSubTab caseRow={caseRow} />
        )}
        {effectiveSubTab === 'diagnostics' && (
          <DiagnosticsSubTab caseRow={caseRow} intakeRow={intakeRow} onboardingSections={onboardingSections} stageIndex={stageIndex} onBuildReport={handleBuildReport} />
        )}
        {effectiveSubTab === 'report' && (
          <ReportSubTab caseRow={caseRow} intakeRow={intakeRow} onboardingSections={onboardingSections} stageIndex={stageIndex} diagnosticFormulation={diagnosticFormulation} />
        )}
        {effectiveSubTab === 'archive' && (
          <ArchiveSubTab caseRow={caseRow} />
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// MetaChip — small label/value pair in the header
// ---------------------------------------------------------------------------

function MetaChip({
  label,
  value,
}: {
  readonly label: string
  readonly value: string
}): React.JSX.Element {
  return (
    <span>
      <span style={{ fontWeight: 600 }}>{label}:</span> {value}
    </span>
  )
}

// ---------------------------------------------------------------------------
// IntakeSubTab — dense read-only data view of patient information
// Uses key-value table rows for maximum information density.
// ---------------------------------------------------------------------------

type IntakeInnerTab = 'overview' | 'referral' | 'medical' | 'clinical'

const INTAKE_INNER_TABS: readonly { id: IntakeInnerTab; label: string }[] = [
  { id: 'overview', label: 'Background' },
  { id: 'referral', label: 'Referral' },
  { id: 'medical', label: 'Medical History' },
  { id: 'clinical', label: 'Clinical History' },
]

/** Compact key-value row for read-only data display — always renders, shows blank for empty.
 *  When `fullText` is provided and differs from `value`, shows a dotted underline and
 *  a styled tooltip on hover with the complete intake text. */
function DataRow({ label, value, fullText }: { readonly label: string; readonly value: string | undefined; readonly fullText?: string | null }): JSX.Element {
  const v = value?.trim()
  const full = fullText?.trim()
  const hasTip = !!(full && v && full !== v && full.length > (v?.length ?? 0))
  const [hover, setHover] = useState(false)

  return (
    <tr>
      <td style={dataLabelTd}>{label}</td>
      <td
        style={{ ...(v ? dataValueTd : dataValueEmptyTd), position: 'relative' as const, ...(hasTip ? { cursor: 'help', borderBottom: '1px dotted rgba(255,255,255,0.25)' } : {}) }}
        onMouseEnter={hasTip ? () => setHover(true) : undefined}
        onMouseLeave={hasTip ? () => setHover(false) : undefined}
      >
        {v || '\u00A0'}
        {hasTip && hover && (
          <div style={{
            position: 'absolute', left: 0, bottom: '100%', zIndex: 9999,
            maxWidth: 420, padding: '8px 10px', marginBottom: 4,
            background: '#dce8f5', border: '1px solid #a8c4e0',
            borderRadius: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
            fontSize: 12, lineHeight: '1.45', color: '#1a2332', whiteSpace: 'pre-wrap' as const,
            pointerEvents: 'none' as const,
          }}>
            <div style={{ fontWeight: 600, fontSize: 10, textTransform: 'uppercase' as const, color: '#4a6a8a', marginBottom: 3, letterSpacing: '0.04em' }}>Full Intake Text</div>
            {full}
          </div>
        )}
      </td>
    </tr>
  )
}

/** Section header spanning full table width */
function SectionHead({ title }: { readonly title: string }): React.JSX.Element {
  return (
    <tr>
      <td colSpan={2} style={sectionHeadTd}>{title}</td>
    </tr>
  )
}

/** Narrative block — always renders with label; shows empty space when no data */
function NarrativeBlock({ label, value }: { readonly label: string; readonly value: string | undefined }): React.JSX.Element {
  const v = value?.trim()
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={narrativeLabelStyle}>{label}</div>
      <div style={v ? narrativeValueStyle : narrativeValueEmptyStyle}>{v || '\u00A0'}</div>
    </div>
  )
}

/** Truncate long narrative text to first sentence or ~80 chars for snapshot display */
function truncateSnapshot(text: string): string {
  const t = text.trim()
  const firstSentence = t.split(/\.\s/)[0]
  if (firstSentence.length <= 80) return firstSentence + (t.length > firstSentence.length + 1 ? '.' : '')
  return firstSentence.slice(0, 77) + '…'
}

/** ~33% summary — strips filler, keeps 1-2 sentences, caps at ~120 chars. Good for background overview. */
function summaryNote(text: string | undefined | null): string | undefined {
  if (!text?.trim()) return undefined
  const t = text.trim()
  const cleaned = t
    .replace(/^(the )?(examinee|patient|client|individual) (reports?|reported|endorses?|endorsed|denies|denied|describes?|described|states?|stated|indicates?|indicated) (that |a history of |having |experiencing )?/i, '')
    .replace(/^(history of |hx of |h\/o )/i, '')
    .trim()
  // Take up to two sentences
  const sentences = cleaned.split(/[.;]\s/)
  const joined = sentences.slice(0, 2).join('. ').replace(/\.\s*$/, '')
  if (joined.length <= 120) return joined + (sentences.length > 2 ? '…' : '')
  const cut = joined.slice(0, 120).replace(/\s\S*$/, '')
  return cut + '…'
}

/** Minimal clinical shorthand — just enough to trigger recall. Strips filler, keeps key terms. */
function shortNote(text: string | undefined | null): string | undefined {
  if (!text?.trim()) return undefined
  const t = text.trim()
  // Strip common narrative filler prefixes
  const cleaned = t
    .replace(/^(the )?(examinee|patient|client|individual) (reports?|reported|endorses?|endorsed|denies|denied|describes?|described|states?|stated|indicates?|indicated) (that |a history of |having |experiencing )?/i, '')
    .replace(/^(history of |hx of |h\/o )/i, '')
    .trim()
  // Take up to first period or semicolon, cap at ~50 chars
  const chunk = cleaned.split(/[.;]\s/)[0]
  if (chunk.length <= 50) return chunk
  // Cut at last word boundary before 50
  const cut = chunk.slice(0, 50).replace(/\s\S*$/, '')
  return cut + '…'
}

/** Condense narrative text into a short summary note + 2-3 bullet points for Clinical Snapshot */
function SnapshotBrief({ label, text }: { readonly label: string; readonly text: string | undefined }): React.JSX.Element | null {
  if (!text?.trim()) return null
  const t = text.trim()
  // Split on sentence boundaries or semicolons/commas for list-style data
  const parts = t.split(/[.;]\s+/).map(s => s.trim().replace(/\.$/, '')).filter(Boolean)
  const lead = parts[0] ? (parts[0].length > 70 ? parts[0].slice(0, 67) + '…' : parts[0]) : t.slice(0, 70)
  const bullets = parts.slice(1, 4).map(b => b.length > 60 ? b.slice(0, 57) + '…' : b)
  return (
    <div style={{ padding: '0 10px', marginBottom: 6 }}>
      <div style={narrativeLabelStyle}>{label}</div>
      <div style={{ fontSize: 11, color: 'var(--text)', lineHeight: 1.45 }}>{lead}</div>
      {bullets.length > 0 && (
        <ul style={{ margin: '2px 0 0', paddingLeft: 14, listStyleType: 'disc' }}>
          {bullets.map((b, i) => (
            <li key={i} style={{ fontSize: 10.5, color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: 1 }}>{b}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Stacked snapshot section: title on own line, bulleted items below */
function SnapshotSection({ title, items, emptyText }: {
  readonly title: string
  readonly items: (string | null | undefined)[]
  readonly emptyText?: string
}): React.JSX.Element {
  const filtered = items.filter((i): i is string => !!i?.trim())
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: 2 }}>{title}</div>
      {filtered.length > 0 ? (
        <ul style={{ margin: 0, paddingLeft: 14, listStyleType: 'disc' }}>
          {filtered.map((item, i) => (
            <li key={i} style={{ fontSize: 11, color: 'var(--text)', lineHeight: 1.5, marginBottom: 1 }}>{item}</li>
          ))}
        </ul>
      ) : (
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontStyle: 'italic' }}>{emptyText ?? '—'}</div>
      )}
    </div>
  )
}

function IntakeSubTab({
  caseRow,
  intakeRow,
  onboardingSections,
  onEdit,
}: {
  readonly caseRow: CaseRow
  readonly intakeRow: PatientIntakeRow | null
  readonly onboardingSections: readonly PatientOnboardingRow[]
  readonly onEdit: () => void
}): React.JSX.Element {
  const [activeInner, setActiveInner] = useState<IntakeInnerTab>('overview')

  const parsedSections = useMemo(() => {
    const map: Record<string, Record<string, string>> = {}
    for (const row of onboardingSections) {
      try { map[row.section] = JSON.parse(row.content) as Record<string, string> } catch { /* skip */ }
    }
    return map
  }, [onboardingSections])

  const demo = parsedSections.contact
  const fam = parsedSections.family
  const edu = parsedSections.education ?? parsedSections.family
  const complaints = parsedSections.complaints
  const health = parsedSections.health
  const mental = parsedSections.mental
  const substance = parsedSections.substance
  const recent = parsedSections.recent

  const innerTabBarStyle: React.CSSProperties = {
    display: 'flex', gap: 0,
    borderBottom: '1px solid var(--border)', marginBottom: 0, overflowX: 'auto',
  }
  const innerTabStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 14px', fontSize: 11,
    fontWeight: active ? 600 : 400,
    color: active ? 'var(--accent)' : 'var(--text-secondary)',
    background: 'transparent', border: 'none',
    borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
    cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0,
  })

  // ── Clinical notes state (editable, auto-saves on blur) ──
  const [clinNotes, setClinNotes] = useState<Record<string, string>>({})
  const notesLoaded = useRef(false)

  // Load existing clinician_notes from onboarding rows
  useEffect(() => {
    if (notesLoaded.current) return
    const loaded: Record<string, string> = {}
    for (const row of onboardingSections) {
      if (row.clinician_notes) loaded[row.section] = row.clinician_notes
    }
    setClinNotes(loaded)
    notesLoaded.current = true
  }, [onboardingSections])

  const updateNote = useCallback((key: string, value: string) => {
    setClinNotes((prev) => ({ ...prev, [key]: value }))
  }, [])

  // Save a note to the appropriate onboarding section on blur
  const saveNote = useCallback(async (noteKey: string) => {
    // Map note keys to onboarding sections
    const sectionMap: Record<string, string> = {
      demographics: 'contact', identity: 'contact',
      education: 'family', family: 'family',
      recent: 'recent',
      complaints: 'complaints',
      medical: 'health', medications: 'health',
      mental: 'mental', risk: 'mental',
      substance: 'substance',
    }
    const section = sectionMap[noteKey] ?? noteKey
    const existingRow = onboardingSections.find((r) => r.section === section)
    try {
      await window.psygil.onboarding.save({
        case_id: caseRow.case_id,
        section: section as any,
        data: {
          content: existingRow?.content ?? '{}',
          clinician_notes: clinNotes[noteKey] ?? '',
          status: existingRow?.status ?? 'draft',
        },
      })
    } catch (err) {
      console.error('[IntakeSubTab] Failed to save clinical note:', err)
    }
  }, [caseRow.case_id, onboardingSections, clinNotes])

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Patient Information</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {intakeRow && (
            <span style={{ fontSize: 11, fontWeight: 600, color: intakeRow.status === 'complete' ? '#4caf50' : '#ff9800' }}>
              {intakeRow.status === 'complete' ? '✓ Complete' : '⏳ Draft'}
            </span>
          )}
          <button onClick={onEdit} style={editBtnStyle}>Edit</button>
        </div>
      </div>

      {/* Tab bar */}
      <div style={innerTabBarStyle}>
        {INTAKE_INNER_TABS.map((t) => (
          <button key={t.id} onClick={() => setActiveInner(t.id)} style={innerTabStyle(activeInner === t.id)}>{t.label}</button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 1: Background
          Three columns: identity & living | education & family | clinical notes
          ═══════════════════════════════════════════════════════════════════ */}
      {activeInner === 'overview' && (
        <div style={{ paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 0 }}>
          <div style={threeColGrid}>
            {/* ── COL 1: Identity, living situation ── */}
            <div>
              <table style={dataTableStyle}>
                <tbody>
                  <SectionHead title="Identity" />
                  <DataRow label="Name" value={`${caseRow.examinee_last_name ?? '—'}, ${caseRow.examinee_first_name ?? ''}`} />
                  <DataRow label="DOB / Age" value={caseRow.examinee_dob ? `${caseRow.examinee_dob} (${calcAge(caseRow.examinee_dob)})` : undefined} />
                  <DataRow label="Gender" value={caseRow.examinee_gender ?? undefined} />
                  <DataRow label="Language" value={demo?.primary_language} />
                </tbody>
              </table>
              <table style={dataTableStyle}>
                <tbody>
                  <SectionHead title="Living Situation" />
                  <DataRow label="Marital" value={demo?.marital_status} />
                  <DataRow label="Dependents" value={demo?.dependents} />
                  <DataRow label="Housing" value={demo?.living_situation} />
                </tbody>
              </table>
              <table style={dataTableStyle}>
                <tbody>
                  <SectionHead title="Education & Employment" />
                  <DataRow label="Education" value={edu?.highest_education ?? fam?.highest_education} />
                  <DataRow label="Employment" value={edu?.employment_status ?? fam?.employment_status} />
                  <DataRow label="Employer" value={edu?.current_employer ?? fam?.current_employer} />
                  <DataRow label="Military" value={edu?.military_service ?? fam?.military_service} />
                </tbody>
              </table>
            </div>

            {/* ── COL 2: Family background (short fields) ── */}
            <div>
              <table style={dataTableStyle}>
                <tbody>
                  <SectionHead title="Family Background" />
                  <DataRow label="Family Psych Hx" value={summaryNote(fam?.family_mental_health)} fullText={fam?.family_mental_health} />
                  <DataRow label="Family Medical Hx" value={summaryNote(fam?.family_medical_history)} fullText={fam?.family_medical_history} />
                </tbody>
              </table>
              <table style={dataTableStyle}>
                <tbody>
                  <SectionHead title="Current Stressors" />
                  <DataRow label="Eval Goals" value={summaryNote(recent?.goals_evaluation)} fullText={recent?.goals_evaluation} />
                </tbody>
              </table>
            </div>

            {/* ── COL 3: Clinical Notes ── */}
            <div style={clinNotesColumnStyle}>
              <div style={clinNotesColumnHeader}>Clinical Notes</div>
              <ClinicalNoteField
                label="Identity & Presentation"
                value={clinNotes.demographics ?? ''}
                onChange={(v) => updateNote('demographics', v)}
                onBlur={() => void saveNote('demographics')}
                placeholder="Presentation discrepancies, living stability, language/interpreter needs, cultural considerations…"
              />
              <ClinicalNoteField
                label="Education & Employment"
                value={clinNotes.education ?? ''}
                onChange={(v) => updateNote('education', v)}
                onBlur={() => void saveNote('education')}
                placeholder="Cognitive indicators, employment stability, vocational capacity, academic difficulties…"
              />
              <ClinicalNoteField
                label="Family & Stressors"
                value={clinNotes.family ?? ''}
                onChange={(v) => updateNote('family', v)}
                onBlur={() => void saveNote('family')}
                placeholder="Support system, intergenerational patterns, precipitating factors, protective factors…"
              />
            </div>
          </div>

          {/* ── Full-width narrative summaries below the grid ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, marginTop: 4 }}>
            <table style={dataTableStyle}>
              <tbody>
                <SectionHead title="Family & Relationships" />
                <DataRow label="Family of Origin" value={summaryNote(fam?.family_of_origin)} fullText={fam?.family_of_origin} />
                <DataRow label="Relationships" value={summaryNote(fam?.current_family_relationships)} fullText={fam?.current_family_relationships} />
              </tbody>
            </table>
            <table style={dataTableStyle}>
              <tbody>
                <SectionHead title="Current Circumstances" />
                <DataRow label="Events" value={summaryNote(recent?.events_circumstances)} fullText={recent?.events_circumstances} />
                <DataRow label="Stressors" value={summaryNote(recent?.current_stressors)} fullText={recent?.current_stressors} />
              </tbody>
            </table>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
            <table style={dataTableStyle}>
              <tbody>
                <SectionHead title="Work & Academic History" />
                <DataRow label="Work History" value={summaryNote(edu?.work_history ?? fam?.work_history)} fullText={edu?.work_history ?? fam?.work_history} />
                <DataRow label="Academic Hx" value={summaryNote(edu?.academic_experience ?? fam?.academic_experience)} fullText={edu?.academic_experience ?? fam?.academic_experience} />
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 2: Referral (moved from standalone tab)
          ═══════════════════════════════════════════════════════════════════ */}
      {activeInner === 'referral' && (
        <div style={{ paddingTop: 12 }}>
          <ReferralSubTab caseRow={caseRow} intakeRow={intakeRow} onboardingSections={onboardingSections} onEdit={onEdit} />
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 3: Medical History
          Three columns: medical conditions | substance use | clinical notes
          ═══════════════════════════════════════════════════════════════════ */}
      {activeInner === 'medical' && (
        <div style={{ paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 0 }}>
          <div style={threeColGrid}>
            {/* ── COL 1: High-priority medical — neuro, TBI, conditions, surgeries ── */}
            <div>
              <table style={dataTableStyle}>
                <tbody>
                  <SectionHead title="Neurological & TBI" />
                  <DataRow label="Head Injuries" value={shortNote(health?.head_injuries)} fullText={health?.head_injuries} />
                  <DataRow label="Seizures" value={shortNote(health?.seizure_history)} fullText={health?.seizure_history} />
                  <DataRow label="LOC History" value={shortNote(health?.loss_of_consciousness)} fullText={health?.loss_of_consciousness} />
                </tbody>
              </table>
              <table style={dataTableStyle}>
                <tbody>
                  <SectionHead title="Active Medical Conditions" />
                  <DataRow label="Conditions" value={shortNote(health?.medical_conditions)} fullText={health?.medical_conditions} />
                  <DataRow label="Surgeries / Hosp" value={shortNote(health?.surgeries_hospitalizations)} fullText={health?.surgeries_hospitalizations} />
                </tbody>
              </table>
              <table style={dataTableStyle}>
                <tbody>
                  <SectionHead title="Substance Use" />
                  <DataRow label="Alcohol" value={shortNote(substance?.alcohol_use)} fullText={substance?.alcohol_use} />
                  <DataRow label="Drugs" value={shortNote(substance?.drug_use)} fullText={substance?.drug_use} />
                  <DataRow label="SA Treatment" value={shortNote(substance?.substance_treatment)} fullText={substance?.substance_treatment} />
                </tbody>
              </table>
            </div>

            {/* ── COL 2: Medications, functional status, vitals ── */}
            <div>
              <table style={dataTableStyle}>
                <tbody>
                  <SectionHead title="Current Medications" />
                  <DataRow label="Psych Meds" value={shortNote(mental?.psych_medications)} fullText={mental?.psych_medications} />
                  <DataRow label="Other Meds" value={shortNote(health?.current_medications)} fullText={health?.current_medications} />
                </tbody>
              </table>
              <table style={dataTableStyle}>
                <tbody>
                  <SectionHead title="Functional Status" />
                  <DataRow label="Sleep" value={shortNote(health?.sleep_quality)} fullText={health?.sleep_quality} />
                  <DataRow label="Appetite / Wt" value={shortNote(health?.appetite_weight)} fullText={health?.appetite_weight} />
                  <DataRow label="Pain" value={shortNote(health?.chronic_pain)} fullText={health?.chronic_pain} />
                  <DataRow label="Mobility" value={shortNote(health?.mobility_limitations)} fullText={health?.mobility_limitations} />
                </tbody>
              </table>
              <table style={dataTableStyle}>
                <tbody>
                  <SectionHead title="Relevant History" />
                  <DataRow label="Allergies" value={shortNote(health?.allergies)} fullText={health?.allergies} />
                  <DataRow label="Family Medical" value={shortNote(fam?.family_medical_history)} fullText={fam?.family_medical_history} />
                </tbody>
              </table>
            </div>

            {/* ── COL 3: Clinical Notes ── */}
            <div style={clinNotesColumnStyle}>
              <div style={clinNotesColumnHeader}>Clinical Notes</div>
              <ClinicalNoteField
                label="Neurological / TBI"
                value={clinNotes.neuro ?? ''}
                onChange={(v) => updateNote('neuro', v)}
                onBlur={() => void saveNote('neuro')}
                placeholder="TBI severity, cognitive sequelae, imaging results, relevance to current presentation…"
              />
              <ClinicalNoteField
                label="Medications & Compliance"
                value={clinNotes.medical ?? ''}
                onChange={(v) => updateNote('medical', v)}
                onBlur={() => void saveNote('medical')}
                placeholder="Medication effects on testing, compliance, polypharmacy concerns, side effects affecting presentation…"
              />
              <ClinicalNoteField
                label="Substance Use"
                value={clinNotes.substance ?? ''}
                onChange={(v) => updateNote('substance', v)}
                onBlur={() => void saveNote('substance')}
                placeholder="Impact on cognitive testing, current use patterns, sobriety duration, treatment engagement…"
              />
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 4: Clinical History
          Three columns: presenting concerns | mental health | clinical notes
          ═══════════════════════════════════════════════════════════════════ */}
      {activeInner === 'clinical' && (
        <div style={{ paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 0 }}>
          <div style={threeColGrid}>
            {/* ── COL 1: Risk & safety, then presenting concerns ── */}
            <div>
              <table style={dataTableStyle}>
                <tbody>
                  <SectionHead title="Risk & Safety" />
                  <DataRow label="Self-Harm / SI" value={shortNote(mental?.self_harm_history)} fullText={mental?.self_harm_history} />
                  <DataRow label="Violence / HI" value={shortNote(mental?.violence_history)} fullText={mental?.violence_history} />
                  <DataRow label="Current Risk" value={shortNote(mental?.current_risk_level)} fullText={mental?.current_risk_level} />
                  <DataRow label="Safety Plan" value={shortNote(mental?.safety_plan)} fullText={mental?.safety_plan} />
                </tbody>
              </table>
              <table style={dataTableStyle}>
                <tbody>
                  <SectionHead title="Presenting Concerns" />
                  <DataRow label="Primary" value={shortNote(complaints?.primary_complaint ?? intakeRow?.presenting_complaint)} fullText={complaints?.primary_complaint ?? intakeRow?.presenting_complaint} />
                  <DataRow label="Secondary" value={shortNote(complaints?.secondary_concerns)} fullText={complaints?.secondary_concerns} />
                  <DataRow label="Onset" value={shortNote(complaints?.onset_timeline)} fullText={complaints?.onset_timeline} />
                  <DataRow label="Stressors" value={shortNote(complaints?.stressors ?? recent?.current_stressors)} fullText={complaints?.stressors ?? recent?.current_stressors} />
                </tbody>
              </table>
            </div>

            {/* ── COL 2: Psychiatric history & treatment ── */}
            <div>
              <table style={dataTableStyle}>
                <tbody>
                  <SectionHead title="Psychiatric History" />
                  <DataRow label="Prior Dx" value={shortNote(mental?.previous_diagnoses)} fullText={mental?.previous_diagnoses} />
                  <DataRow label="Prior Treatment" value={shortNote(mental?.previous_treatment)} fullText={mental?.previous_treatment} />
                  <DataRow label="Hospitalizations" value={shortNote(mental?.psych_hospitalizations)} fullText={mental?.psych_hospitalizations} />
                  <DataRow label="Psych Meds" value={shortNote(mental?.psych_medications)} fullText={mental?.psych_medications} />
                </tbody>
              </table>
              <table style={dataTableStyle}>
                <tbody>
                  <SectionHead title="Functional & Behavioral" />
                  <DataRow label="Current Functioning" value={shortNote(mental?.current_functioning)} fullText={mental?.current_functioning} />
                  <DataRow label="Coping" value={shortNote(mental?.coping_mechanisms)} fullText={mental?.coping_mechanisms} />
                  <DataRow label="Social Support" value={shortNote(mental?.social_support)} fullText={mental?.social_support} />
                  <DataRow label="Family Psych Hx" value={shortNote(fam?.family_mental_health)} fullText={fam?.family_mental_health} />
                </tbody>
              </table>
            </div>

            {/* ── COL 3: Clinical Notes ── */}
            <div style={clinNotesColumnStyle}>
              <div style={clinNotesColumnHeader}>Clinical Notes</div>
              <ClinicalNoteField
                label="Risk Assessment"
                value={clinNotes.risk ?? ''}
                onChange={(v) => updateNote('risk', v)}
                onBlur={() => void saveNote('risk')}
                placeholder="Risk level rationale, protective factors, safety plan adequacy, imminent concerns…"
              />
              <ClinicalNoteField
                label="Presenting Concerns"
                value={clinNotes.complaints ?? ''}
                onChange={(v) => updateNote('complaints', v)}
                onBlur={() => void saveNote('complaints')}
                placeholder="Consistency of concern presentation, symptom validity observations, malingering indicators…"
              />
              <ClinicalNoteField
                label="Psychiatric History"
                value={clinNotes.mental ?? ''}
                onChange={(v) => updateNote('mental', v)}
                onBlur={() => void saveNote('mental')}
                placeholder="Treatment compliance, diagnostic consistency, hospitalization triggers, medication response…"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** Editable clinical note field for the third column */
function ClinicalNoteField({
  label, value, onChange, onBlur, placeholder,
}: {
  readonly label: string
  readonly value: string
  readonly onChange: (v: string) => void
  readonly onBlur: () => void
  readonly placeholder: string
}): React.JSX.Element {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={clinNoteLabelStyle}>{label}</div>
      <textarea
        style={clinNoteTextareaStyle}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        rows={3}
      />
    </div>
  )
}

// Data display styles for dense read-only layout
const dataTableStyle: React.CSSProperties = {
  width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 12,
}
const dataLabelTd: React.CSSProperties = {
  padding: '3px 8px 3px 0', fontWeight: 600, fontSize: 11,
  color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.3,
  whiteSpace: 'nowrap', verticalAlign: 'top', width: '35%',
  borderBottom: '1px solid var(--border)',
}
const dataValueTd: React.CSSProperties = {
  padding: '3px 0', fontSize: 12.5, color: 'var(--text)',
  verticalAlign: 'top', borderBottom: '1px solid var(--border)',
}
const dataValueEmptyTd: React.CSSProperties = {
  ...dataValueTd, color: 'var(--text-secondary)', fontStyle: 'italic', opacity: 0.5,
}
const sectionHeadTd: React.CSSProperties = {
  padding: '10px 0 4px', fontSize: 11, fontWeight: 700,
  color: 'var(--text)', textTransform: 'uppercase', letterSpacing: 0.8,
  borderBottom: '1px solid var(--text-secondary)',
}
const narrativeLabelStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)',
  textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2,
}
const narrativeValueStyle: React.CSSProperties = {
  fontSize: 12.5, color: 'var(--text)', lineHeight: 1.55,
  padding: '4px 8px', background: 'var(--bg)', borderRadius: 3,
  borderLeft: '2px solid var(--border)', whiteSpace: 'pre-wrap',
  minHeight: 24,
}
const narrativeValueEmptyStyle: React.CSSProperties = {
  ...narrativeValueStyle, minHeight: 24, opacity: 0.4,
}
const narrativeSectionHeader: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: 'var(--text)',
  textTransform: 'uppercase', letterSpacing: 0.8,
  padding: '10px 0 6px', marginTop: 4,
  borderBottom: '1px solid var(--text-secondary)', marginBottom: 8,
}
const threeColGrid: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: '1fr 1fr 280px', gap: 20,
}
const clinNotesColumnHeader: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: 'var(--text)',
  textTransform: 'uppercase', letterSpacing: 0.8,
  padding: '10px 0 8px', borderBottom: '1px solid var(--text-secondary)', marginBottom: 10,
}
const clinNoteLabelStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)',
  textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 3,
}
const clinNoteTextareaStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box' as const,
  background: 'var(--bg)', border: '1px solid var(--border)',
  borderRadius: 4, padding: '6px 8px', fontSize: 12,
  color: 'var(--text)', fontFamily: 'inherit', resize: 'vertical',
  lineHeight: 1.5, minHeight: 60,
}
const clinNotesColumnStyle: React.CSSProperties = {
  background: 'var(--sidebar-bg, #f5f5f5)', borderRadius: 6, padding: '0 12px 12px',
}
const snapshotLabelStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
  color: 'var(--text-secondary)', marginTop: 8, marginBottom: 2,
}
const snapshotValueStyle: React.CSSProperties = {
  fontSize: 11, color: 'var(--text)', lineHeight: 1.55,
}

// ---------------------------------------------------------------------------
// ReferralSubTab — form-style referral layout
// ---------------------------------------------------------------------------

function ReferralSubTab({
  caseRow,
  intakeRow,
  onboardingSections,
  onEdit,
}: {
  readonly caseRow: CaseRow
  readonly intakeRow: PatientIntakeRow | null
  readonly onboardingSections: readonly PatientOnboardingRow[]
  readonly onEdit: () => void
}): React.JSX.Element {
  const legalData = useMemo(() => {
    const row = onboardingSections.find((r) => r.section === 'legal')
    if (!row) return undefined
    try { return JSON.parse(row.content) as Record<string, string> } catch { return undefined }
  }, [onboardingSections])

  const [refNotes, setRefNotes] = useState<Record<string, string>>({})
  const refNotesLoaded = useRef(false)

  // Load persisted referral notes
  useEffect(() => {
    if (refNotesLoaded.current) return
    const row = onboardingSections.find((r) => r.section === 'referral_notes')
    if (row) {
      try { setRefNotes(JSON.parse(row.content) as Record<string, string>) } catch { /* ignore */ }
    }
    refNotesLoaded.current = true
  }, [onboardingSections])

  // Save all referral notes on blur
  const saveRefNotes = useCallback(async () => {
    try {
      await window.psygil.onboarding.save({
        case_id: caseRow.case_id,
        section: 'referral_notes' as any,
        data: { content: JSON.stringify(refNotes), status: 'draft' },
      })
    } catch (err) { console.error('[ReferralSubTab] Failed to save notes:', err) }
  }, [caseRow.case_id, refNotes])

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Referral Information</div>
        <button onClick={onEdit} style={editBtnStyle}>Edit</button>
      </div>

      {/* ── Row 1: Referring Party + Court/Attorney + Notes ── */}
      <div style={threeColGrid}>
        <div>
          <table style={dataTableStyle}>
            <tbody>
              <SectionHead title="Referring Party" />
              <DataRow label="Source Type" value={intakeRow?.referral_type ?? undefined} />
              <DataRow label="Referring Party" value={intakeRow?.referral_source ?? caseRow.referral_source ?? undefined} />
              <DataRow label="Date Authorized" value={caseRow.created_at ? new Date(caseRow.created_at).toLocaleDateString() : undefined} />
            </tbody>
          </table>
        </div>
        <div>
          <table style={dataTableStyle}>
            <tbody>
              <SectionHead title="Court & Attorney" />
              <DataRow label="Jurisdiction / Court" value={intakeRow?.jurisdiction ?? undefined} />
              <DataRow label="Attorney / Counsel" value={intakeRow?.attorney_name ?? undefined} />
              <DataRow label="Report Deadline" value={intakeRow?.report_deadline ? new Date(intakeRow.report_deadline).toLocaleDateString() : undefined} />
            </tbody>
          </table>
        </div>
        <div style={clinNotesColumnStyle}>
          <div style={clinNotesColumnHeader}>Clinical Notes</div>
          <ClinicalNoteField
            label="Referral Context"
            value={refNotes.referral ?? ''}
            onChange={(v) => setRefNotes((p) => ({ ...p, referral: v }))}
            onBlur={() => void saveRefNotes()}
            placeholder="Referral source relationship, potential bias, referral question clarity…"
          />
        </div>
      </div>

      {/* ── Row 2: Evaluation Details + Legal History + Notes ── */}
      <div style={threeColGrid}>
        <div>
          <table style={dataTableStyle}>
            <tbody>
              <SectionHead title="Evaluation Details" />
              <DataRow label="Evaluation Type" value={intakeRow?.eval_type ?? caseRow.evaluation_type ?? undefined} />
            </tbody>
          </table>
          <NarrativeBlock label="Reason for Referral / Evaluation Questions" value={intakeRow?.presenting_complaint ?? caseRow.evaluation_questions ?? undefined} />
        </div>
        <div>
          <table style={dataTableStyle}>
            <tbody>
              <SectionHead title="Legal History" />
            </tbody>
          </table>
          <NarrativeBlock label="Prior Arrests & Convictions" value={legalData?.arrests_convictions} />
          <NarrativeBlock label="Incarceration History" value={legalData?.incarceration_history} />
          <NarrativeBlock label="Probation / Parole" value={legalData?.probation_parole} />
          <NarrativeBlock label="Protective / Restraining Orders" value={legalData?.protective_orders} />
        </div>
        <div style={clinNotesColumnStyle}>
          <div style={clinNotesColumnHeader}>&nbsp;</div>
          <ClinicalNoteField
            label="Evaluation Scope"
            value={refNotes.eval ?? ''}
            onChange={(v) => setRefNotes((p) => ({ ...p, eval: v }))}
            onBlur={() => void saveRefNotes()}
            placeholder="Referral question adequacy, scope limitations, charge severity considerations…"
          />
          <ClinicalNoteField
            label="Legal History"
            value={refNotes.legal ?? ''}
            onChange={(v) => setRefNotes((p) => ({ ...p, legal: v }))}
            onBlur={() => void saveRefNotes()}
            placeholder="Pattern observations, escalation/de-escalation, relevance to referral question…"
          />
        </div>
      </div>

      {/* ── Full-width Charges block ── */}
      <NarrativeBlock label="Charges" value={intakeRow?.charges ?? undefined} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// DocumentsSubTab — directory-organized file browser
// ---------------------------------------------------------------------------

/** Ordered directories matching clinical workflow */
const DOC_DIRECTORIES = [
  { key: 'Intake', subfolder: '_Inbox', color: '#2196f3' },
  { key: 'Referral', subfolder: 'Collateral', color: '#00897b' },
  { key: 'Testing', subfolder: 'Testing', color: '#9c27b0' },
  { key: 'Interview', subfolder: 'Interviews', color: '#e91e63' },
  { key: 'Diagnostics', subfolder: 'Diagnostics', color: '#ff9800' },
  { key: 'Reports', subfolder: 'Reports', color: '#4caf50' },
] as const

interface DocEntry {
  readonly document_id: number
  readonly filename: string
  readonly description: string | null
  readonly mime_type: string | null
  readonly file_path: string
  readonly upload_date: string
}

function DocumentsSubTab({
  caseRow,
  intakeRow,
  stageIndex,
  onEdit,
}: {
  readonly caseRow: CaseRow
  readonly intakeRow: PatientIntakeRow | null
  readonly stageIndex: number
  readonly onEdit: () => void
}): React.JSX.Element {
  const [docsByDir, setDocsByDir] = useState<Record<string, DocEntry[]>>({})
  const [docNotes, setDocNotes] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const docNotesLoaded = useRef(false)

  // Load persisted document review notes
  useEffect(() => {
    if (docNotesLoaded.current) return
    docNotesLoaded.current = true
    ;(async () => {
      try {
        const resp = await window.psygil.onboarding.get({ case_id: caseRow.case_id })
        if (resp.status === 'success' && resp.data) {
          const row = resp.data.find((r: any) => r.section === 'documents_notes')
          if (row) {
            try { setDocNotes(JSON.parse(row.content) as Record<string, string>) } catch { /* ignore */ }
          }
        }
      } catch { /* ignore */ }
    })()
  }, [caseRow.case_id])

  // Save document notes on blur
  const saveDocNotes = useCallback(async () => {
    try {
      await window.psygil.onboarding.save({
        case_id: caseRow.case_id,
        section: 'documents_notes' as any,
        data: { content: JSON.stringify(docNotes), status: 'draft' },
      })
    } catch (err) { console.error('[DocumentsSubTab] Failed to save notes:', err) }
  }, [caseRow.case_id, docNotes])

  // Load documents from DB
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const resp = await window.psygil.documents.list({ case_id: caseRow.case_id })
        if (cancelled) return
        if (resp.status === 'success' && resp.data) {
          const grouped: Record<string, DocEntry[]> = {}
          for (const dir of DOC_DIRECTORIES) grouped[dir.key] = []
          for (const doc of resp.data) {
            const path = doc.file_path.replace(/\\/g, '/')
            let matched = false
            for (const dir of DOC_DIRECTORIES) {
              if (path.includes(`/${dir.subfolder}/`) || path.includes(`\\${dir.subfolder}\\`)) {
                grouped[dir.key].push({
                  document_id: doc.document_id,
                  filename: doc.original_filename,
                  description: doc.description ?? doc.document_type ?? null,
                  mime_type: doc.mime_type,
                  file_path: doc.file_path,
                  upload_date: doc.upload_date,
                })
                matched = true
                break
              }
            }
            if (!matched) {
              // Default to Intake
              grouped['Intake'].push({
                document_id: doc.document_id,
                filename: doc.original_filename,
                description: doc.description ?? doc.document_type ?? null,
                mime_type: doc.mime_type,
                file_path: doc.file_path,
                upload_date: doc.upload_date,
              })
            }
          }
          setDocsByDir(grouped)
        }
      } catch (err) {
        console.error('[DocumentsSubTab] list error:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [caseRow.case_id])

  const totalFiles = Object.values(docsByDir).reduce((sum, arr) => sum + arr.length, 0)

  const handleUpload = useCallback(async () => {
    try {
      const resp = await window.psygil.documents.pickFiles()
      if (resp.status === 'success' && resp.data?.filePaths?.length > 0) {
        for (const fp of resp.data.filePaths as string[]) {
          await window.psygil.documents.ingest({ case_id: caseRow.case_id, file_path: fp, subfolder: '_Inbox' })
        }
        // Reload
        const listResp = await window.psygil.documents.list({ case_id: caseRow.case_id })
        if (listResp.status === 'success' && listResp.data) {
          const grouped: Record<string, DocEntry[]> = {}
          for (const dir of DOC_DIRECTORIES) grouped[dir.key] = []
          for (const doc of listResp.data) {
            const path = doc.file_path.replace(/\\/g, '/')
            let matched = false
            for (const dir of DOC_DIRECTORIES) {
              if (path.includes(`/${dir.subfolder}/`)) {
                grouped[dir.key].push({ document_id: doc.document_id, filename: doc.original_filename, description: doc.description ?? doc.document_type ?? null, mime_type: doc.mime_type, file_path: doc.file_path, upload_date: doc.upload_date })
                matched = true
                break
              }
            }
            if (!matched) grouped['Intake'].push({ document_id: doc.document_id, filename: doc.original_filename, description: doc.description ?? doc.document_type ?? null, mime_type: doc.mime_type, file_path: doc.file_path, upload_date: doc.upload_date })
          }
          setDocsByDir(grouped)
        }
      }
    } catch (err) {
      console.error('[DocumentsSubTab] upload error:', err)
    }
  }, [caseRow.case_id])

  const handleOpenFile = useCallback((filePath: string) => {
    window.psygil.workspace.openNative(filePath).catch((err: unknown) => {
      console.error('[DocumentsSubTab] open error:', err)
    })
  }, [])

  const formatDate = (dateStr: string): string => {
    try {
      const d = new Date(dateStr)
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    } catch { return dateStr?.split('T')[0] ?? '—' }
  }

  const fileIcon = (mime: string | null): string => {
    if (!mime) return '📄'
    if (mime.includes('pdf')) return '📕'
    if (mime.includes('image')) return '🖼'
    if (mime.includes('word') || mime.includes('docx')) return '📘'
    if (mime.includes('sheet') || mime.includes('xlsx') || mime.includes('csv')) return '📊'
    if (mime.includes('audio')) return '🎙'
    if (mime.includes('video')) return '🎬'
    return '📄'
  }

  const fileLinkStyle: React.CSSProperties = {
    cursor: 'pointer', color: 'var(--accent)', textDecoration: 'none',
    fontSize: 12, fontWeight: 500,
  }

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
          Case Documents {!loading && <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--text-secondary)' }}>({totalFiles} file{totalFiles !== 1 ? 's' : ''})</span>}
        </div>
        <button onClick={handleUpload} style={editBtnStyle}>＋ Upload Files</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20 }}>
        {/* ── Left: Directory file list ── */}
        <div>
          {DOC_DIRECTORIES.map(({ key, color }) => {
            const files = docsByDir[key] ?? []
            return (
              <div key={key} style={{ marginBottom: 16 }}>
                {/* Directory header */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 10px', background: 'var(--sidebar-bg, #f5f5f5)',
                  borderLeft: `3px solid ${color}`, borderRadius: '0 4px 4px 0', marginBottom: 2,
                }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{key}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    {files.length > 0 ? `${files.length} file${files.length !== 1 ? 's' : ''}` : 'No files'}
                  </span>
                </div>
                {/* File rows */}
                {files.length > 0 ? (
                  <table style={{ ...dataTableStyle, marginLeft: 12 }}>
                    <tbody>
                      {files.map((doc) => (
                        <tr
                          key={doc.document_id}
                          style={{ cursor: 'pointer' }}
                          onClick={() => handleOpenFile(doc.file_path)}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = 'var(--sidebar-bg, #f0f0f0)' }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent' }}
                        >
                          <td style={{ ...dataLabelTd, width: '40%' }}>
                            <span style={fileLinkStyle}>
                              {fileIcon(doc.mime_type)} {doc.filename}
                            </span>
                          </td>
                          <td style={{ ...dataValueTd, width: '40%', fontSize: 11, color: 'var(--text-secondary)' }}>
                            {doc.description ?? doc.mime_type ?? '—'}
                          </td>
                          <td style={{ ...dataValueTd, width: '20%', fontSize: 11, color: 'var(--text-secondary)', textAlign: 'right' }}>
                            {formatDate(doc.upload_date)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ marginLeft: 12, padding: '4px 10px', fontSize: 11, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                    No files uploaded
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* ── Right: Clinical Notes (column 3) ── */}
        <div style={clinNotesColumnStyle}>
          <div style={clinNotesColumnHeader}>Clinical Notes</div>
          <ClinicalNoteField
            label="Document Review"
            value={docNotes.review ?? ''}
            onChange={(v) => setDocNotes((p) => ({ ...p, review: v }))}
            onBlur={() => void saveDocNotes()}
            placeholder="Missing critical documents, inconsistencies across records, collateral source reliability…"
          />
          <ClinicalNoteField
            label="Record Gaps"
            value={docNotes.gaps ?? ''}
            onChange={(v) => setDocNotes((p) => ({ ...p, gaps: v }))}
            onBlur={() => void saveDocNotes()}
            placeholder="Key records not yet obtained, impact on evaluation, follow-up needed…"
          />
          <ClinicalNoteField
            label="File Notes"
            value={docNotes.files ?? ''}
            onChange={(v) => setDocNotes((p) => ({ ...p, files: v }))}
            onBlur={() => void saveDocNotes()}
            placeholder="Notable discrepancies between records, files requiring follow-up…"
          />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// FormField — form-style field (label above, value in bordered box)
// ---------------------------------------------------------------------------

function FormField({
  label,
  value,
  fullWidth,
  multiline,
}: {
  readonly label: string
  readonly value: string
  readonly fullWidth?: boolean
  readonly multiline?: boolean
}): React.JSX.Element {
  const isEmpty = !value || value === '—'
  return (
    <div style={fullWidth ? { gridColumn: '1 / -1' } : undefined}>
      <div style={fieldLabelStyle}>{label}</div>
      <div style={{
        background: 'var(--bg)', border: '1px solid var(--border)',
        borderRadius: 4, padding: multiline ? '8px 10px' : '6px 10px',
        fontSize: 13, color: isEmpty ? 'var(--text-secondary)' : 'var(--text)',
        lineHeight: multiline ? 1.6 : 1.4,
        minHeight: multiline ? 48 : 30,
        marginTop: 3,
        fontStyle: isEmpty ? 'italic' : 'normal',
      }}>
        {isEmpty ? '—' : value}
      </div>
    </div>
  )
}

function calcAge(dob: string): string {
  const birth = new Date(dob)
  if (isNaN(birth.getTime())) return '—'
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const m = now.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--
  return String(age)
}

const editBtnStyle: React.CSSProperties = {
  padding: '4px 14px', fontSize: 11, fontWeight: 500,
  border: '1px solid var(--accent)', borderRadius: 4,
  background: 'var(--accent)', color: '#fff',
  cursor: 'pointer', fontFamily: 'inherit',
}

const fieldLabelStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 600,
  color: 'var(--text-secondary)',
  textTransform: 'uppercase', letterSpacing: 0.5,
}

const gridRow2: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
}

const gridRow3: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12,
}

const gridRow3Inner: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
}

const gridRow4: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12,
}

// ---------------------------------------------------------------------------
// TestingSubTab
// ---------------------------------------------------------------------------

function TestingSubTab({
  caseRow,
  stageIndex,
}: {
  readonly caseRow: CaseRow
  readonly stageIndex: number
}): React.JSX.Element {
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([])
  const [testNotes, setTestNotes] = useState<Record<string, string>>({})
  const [orderedExtras, setOrderedExtras] = useState<string[]>([])
  const [showOrderDropdown, setShowOrderDropdown] = useState(false)
  const orderRef = useRef<HTMLDivElement>(null)
  const testNotesLoaded = useRef(false)

  // Load persisted testing notes + ordered extras
  useEffect(() => {
    if (testNotesLoaded.current) return
    testNotesLoaded.current = true
    ;(async () => {
      try {
        const resp = await window.psygil.onboarding.get({ case_id: caseRow.case_id })
        if (resp.status === 'success' && resp.data) {
          const row = resp.data.find((r: any) => r.section === 'testing_notes')
          if (row) {
            try {
              const parsed = JSON.parse(row.content) as { notes?: Record<string, string>; extras?: string[] }
              if (parsed.notes) setTestNotes(parsed.notes)
              if (parsed.extras) setOrderedExtras(parsed.extras)
            } catch { /* ignore */ }
          }
        }
      } catch { /* ignore */ }
    })()
  }, [caseRow.case_id])

  // Save testing notes + ordered extras on blur
  const saveTestData = useCallback(async () => {
    try {
      await window.psygil.onboarding.save({
        case_id: caseRow.case_id,
        section: 'testing_notes' as any,
        data: { content: JSON.stringify({ notes: testNotes, extras: orderedExtras }), status: 'draft' },
      })
    } catch (err) { console.error('[TestingSubTab] Failed to save notes:', err) }
  }, [caseRow.case_id, testNotes, orderedExtras])

  const defaultInstruments = getInstrumentsForEvalType(caseRow.evaluation_type)
  const defaultSet = useMemo(() => new Set(defaultInstruments), [defaultInstruments])
  // Merge default battery + any additionally ordered measures (deduped)
  const instruments = useMemo(() => {
    const set = new Set(defaultInstruments)
    for (const k of orderedExtras) set.add(k)
    return Array.from(set)
  }, [defaultInstruments, orderedExtras])

  const validityInstruments = instruments.filter((k) => INSTRUMENT_INFO[k]?.isValidity)

  // Full catalog sorted by category, for checkbox list
  const fullCatalog = useMemo(() => {
    return Object.keys(INSTRUMENT_INFO).sort((a, b) => {
      const catA = INSTRUMENT_INFO[a]?.category ?? ''
      const catB = INSTRUMENT_INFO[b]?.category ?? ''
      return catA.localeCompare(catB) || a.localeCompare(b)
    })
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent): void {
      if (orderRef.current && !orderRef.current.contains(e.target as Node)) {
        setShowOrderDropdown(false)
      }
    }
    if (showOrderDropdown) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showOrderDropdown])

  const handleUploadTesting = useCallback(async () => {
    try {
      const resp = await window.psygil.documents.pickFiles()
      if (resp.status === 'success' && resp.data?.filePaths?.length > 0) {
        const paths = resp.data.filePaths as string[]
        const names: string[] = []
        for (const fp of paths) {
          await window.psygil.documents.ingest({ case_id: caseRow.case_id, file_path: fp, subfolder: 'Testing' })
          const parts = fp.replace(/\\/g, '/').split('/')
          names.push(parts[parts.length - 1])
        }
        setUploadedFiles((prev) => [...prev, ...names])
      }
    } catch (err) {
      console.error('[TestingSubTab] File upload error:', err)
    }
  }, [caseRow.case_id])

  const handleToggleMeasure = useCallback((key: string) => {
    setOrderedExtras((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    )
  }, [])

  // Auto-save when ordered extras change (debounced by the state update)
  const extrasInitialized = useRef(false)
  useEffect(() => {
    if (!extrasInitialized.current) { extrasInitialized.current = true; return }
    void saveTestData()
  }, [orderedExtras]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Test Battery</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Order Measures button + dropdown */}
          <div ref={orderRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setShowOrderDropdown((p) => !p)}
              style={{
                ...editBtnStyle,
                background: showOrderDropdown ? 'var(--accent)' : 'var(--panel)',
                color: showOrderDropdown ? '#fff' : 'var(--accent)',
                border: '1px solid var(--accent)',
              }}
            >
              ＋ Order Measures
            </button>
            {showOrderDropdown && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 4,
                background: 'var(--panel)', border: '1px solid var(--border)',
                borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                width: 420, maxHeight: 440, overflowY: 'auto', zIndex: 100,
                padding: '8px 0',
              }}>
                <div style={{ padding: '4px 12px 8px', fontSize: 11, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Test Instruments ({instruments.length} ordered)</span>
                  {orderedExtras.length > 0 && <span style={{ color: 'var(--accent)', fontWeight: 600 }}>+{orderedExtras.length} added</span>}
                </div>
                {fullCatalog.map((key) => {
                  const info = INSTRUMENT_INFO[key]
                  if (!info) return null
                  const isDefault = defaultSet.has(key)
                  const isOrdered = orderedExtras.includes(key)
                  const isChecked = isDefault || isOrdered
                  return (
                    <label
                      key={key}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: 8,
                        padding: '5px 12px', cursor: isDefault ? 'default' : 'pointer',
                        opacity: isDefault ? 0.7 : 1,
                      }}
                      onMouseEnter={(e) => { if (!isDefault) (e.currentTarget as HTMLLabelElement).style.background = 'var(--sidebar-bg, #f0f0f0)' }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLLabelElement).style.background = 'transparent' }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={isDefault}
                        onChange={() => { if (!isDefault) handleToggleMeasure(key) }}
                        style={{ marginTop: 2, accentColor: 'var(--accent)', cursor: isDefault ? 'default' : 'pointer' }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          {info.isValidity && <span style={{ color: '#ff9800', fontSize: 10 }}>⚠</span>}
                          {key} — {info.fullName}
                          {isDefault && <span style={{ fontSize: 9, color: 'var(--text-secondary)', fontWeight: 400, marginLeft: 4 }}>(default)</span>}
                          {isOrdered && <span style={{ fontSize: 9, color: '#2196f3', fontWeight: 700, marginLeft: 4, border: '1px solid #2196f3', borderRadius: 3, padding: '0 3px' }}>ADDED</span>}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                          {info.category} · {info.duration}
                        </div>
                      </div>
                    </label>
                  )
                })}
              </div>
            )}
          </div>
          <button onClick={handleUploadTesting} style={editBtnStyle}>＋ Upload Score Reports</button>
        </div>
      </div>

      <div style={threeColGrid}>
        {/* COL 1 — All Tests & Scores */}
        <div>
          <table style={dataTableStyle}>
            <tbody>
              <SectionHead title="Tests & Scores" />
              <DataRow label="Total Instruments" value={String(instruments.length)} />
              <DataRow label="Scored" value={`${stageIndex >= 2 ? instruments.length : 0} / ${instruments.length}`} />
              {orderedExtras.length > 0 && (
                <DataRow label="Ordered (added)" value={String(orderedExtras.length)} />
              )}
            </tbody>
          </table>
          {instruments.map((key) => {
            const info = INSTRUMENT_INFO[key]
            if (!info) return null
            const isScored = stageIndex >= 2
            const isOrdered = orderedExtras.includes(key)
            return (
              <div key={key} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    {info.isValidity && <span style={{ color: '#ff9800', fontSize: 11 }}>⚠</span>}
                    {key} — {info.fullName}
                    {isOrdered && <span style={{ fontSize: 9, color: '#2196f3', fontWeight: 700, marginLeft: 4, border: '1px solid #2196f3', borderRadius: 3, padding: '0 4px' }}>ORDERED</span>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', gap: 12 }}>
                    <span>{info.category}</span>
                    <span>{info.duration}</span>
                    <span style={{ color: isScored && !isOrdered ? '#4caf50' : '#9c27b0', fontWeight: 600 }}>
                      {isScored && !isOrdered ? '✓ Scored' : '● In Progress'}
                    </span>
                  </div>
                </div>
                {isOrdered && (
                  <button
                    onClick={() => handleToggleMeasure(key)}
                    title="Remove from battery"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: '#f44336', fontSize: 14, padding: '2px 4px', lineHeight: 1,
                      fontFamily: 'inherit',
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            )
          })}
          {uploadedFiles.length > 0 && (
            <>
              <div style={{ ...narrativeSectionHeader, marginTop: 8 }}>Uploaded Score Reports</div>
              <table style={dataTableStyle}>
                <tbody>
                  {uploadedFiles.map((name, idx) => (
                    <tr key={`${name}-${idx}`}>
                      <td style={dataLabelTd}>{name}</td>
                      <td style={{ ...dataValueTd, color: '#4caf50', fontWeight: 600, fontSize: 11 }}>✓ Uploaded</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>

        {/* COL 2 — Validity & Evaluation Info */}
        <div>
          <table style={dataTableStyle}>
            <tbody>
              <SectionHead title="Validity & Evaluation Info" />
              <DataRow label="Evaluation Type" value={caseRow.evaluation_type ?? undefined} />
              <DataRow label="Validity Measures" value={validityInstruments.length > 0 ? String(validityInstruments.length) : 'None'} />
              <DataRow label="Effort Status" value={stageIndex >= 2 ? 'All scored' : 'Pending'} />
            </tbody>
          </table>
          {validityInstruments.length > 0 && (
            <>
              <div style={{ ...narrativeSectionHeader, marginTop: 4 }}>Validity Instruments</div>
              {validityInstruments.map((key) => {
                const info = INSTRUMENT_INFO[key]
                if (!info) return null
                const isScored = stageIndex >= 2
                return (
                  <div key={key} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ color: '#ff9800', fontSize: 11 }}>⚠</span> {key} — {info.fullName}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', gap: 12 }}>
                      <span>{info.category}</span>
                      <span>{info.duration}</span>
                      <span style={{ color: isScored ? '#4caf50' : '#9c27b0', fontWeight: 600 }}>
                        {isScored ? '✓ Pass' : '● Pending'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </>
          )}
          <NarrativeBlock label="Embedded Validity Note" value="Clinical instruments (MMPI-3, PAI, MCMI-IV) include internal validity indicators (F, Fp, FBS, NIM, MAL). Review these scales in the full test report." />
        </div>

        {/* COL 3 — Clinical Notes */}
        <div style={clinNotesColumnStyle}>
          <div style={clinNotesColumnHeader}>Clinical Notes</div>
          <ClinicalNoteField
            label="Battery Selection"
            value={testNotes.battery ?? ''}
            onChange={(v) => setTestNotes((p) => ({ ...p, battery: v }))}
            onBlur={() => void saveTestData()}
            placeholder="Rationale for instrument selection, additional tests needed, appropriateness for this population…"
          />
          <ClinicalNoteField
            label="Validity & Effort"
            value={testNotes.validity ?? ''}
            onChange={(v) => setTestNotes((p) => ({ ...p, validity: v }))}
            onBlur={() => void saveTestData()}
            placeholder="Effort indicators, response style observations, embedded validity scale notes…"
          />
          <ClinicalNoteField
            label="Testing Observations"
            value={testNotes.observations ?? ''}
            onChange={(v) => setTestNotes((p) => ({ ...p, observations: v }))}
            onBlur={() => void saveTestData()}
            placeholder="Behavioral observations during testing, rapport, attention, fatigue, environmental factors…"
          />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ValiditySubTab
// ---------------------------------------------------------------------------

function ValiditySubTab({ caseRow }: { readonly caseRow: CaseRow }): React.JSX.Element {
  const instruments = getInstrumentsForEvalType(caseRow.evaluation_type)
  const validityInstruments = instruments.filter((key) => INSTRUMENT_INFO[key]?.isValidity)
  const overallPass = validityInstruments.length === 0 || true // In real app, from data

  return (
    <div>
      <SectionHeader title="Validity & Effort Assessment" />

      {/* Overall verdict */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '14px 18px',
          background: overallPass ? '#e8f5e9' : '#ffebee',
          border: `1px solid ${overallPass ? '#4caf50' : '#f44336'}`,
          borderRadius: 6,
          marginBottom: 16,
        }}
      >
        <span style={{ fontSize: 24 }}>{overallPass ? '✅' : '🚨'}</span>
        <div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: overallPass ? '#2e7d32' : '#c62828',
            }}
          >
            {overallPass ? 'PASS — Results Considered Valid' : 'CONCERNS — Validity Questionable'}
          </div>
          <div style={{ fontSize: 12, color: overallPass ? '#388e3c' : '#d32f2f', marginTop: 2 }}>
            {overallPass
              ? 'Effort indicators within acceptable limits. Clinical results interpretable.'
              : 'Validity concerns detected. Review effort measures before interpreting results.'}
          </div>
        </div>
      </div>

      {validityInstruments.length === 0 ? (
        <EmptyState message="No standalone validity instruments in this battery. Review embedded validity scales within clinical instruments." />
      ) : (
        <div
          style={{
            background: 'var(--panel)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            overflow: 'hidden',
          }}
        >
          {validityInstruments.map((key, idx) => {
            const info = INSTRUMENT_INFO[key]
            if (info == null) return null
            return (
              <div
                key={key}
                style={{
                  padding: '10px 16px',
                  borderBottom:
                    idx < validityInstruments.length - 1 ? '1px solid var(--border)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                    {key} — {info.fullName}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {info.category} · {info.duration}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#4caf50',
                    whiteSpace: 'nowrap',
                  }}
                >
                  ✓ Pass
                </span>
              </div>
            )
          })}
        </div>
      )}

      <div
        style={{
          marginTop: 14,
          padding: '10px 14px',
          background: 'var(--panel)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          fontSize: 12,
          color: 'var(--text-secondary)',
        }}
      >
        <strong style={{ color: 'var(--text)' }}>Note on Embedded Scales:</strong> Clinical
        instruments (MMPI-3, PAI, MCMI-IV) include internal validity indicators (e.g., F, Fp, FBS,
        NIM, MAL). Review these scales in the full test report.
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// InterviewsSubTab — session-based interview workspace
// ---------------------------------------------------------------------------

interface InterviewSession {
  id: string
  title: string
  date: string
  source: 'import' | 'manual' | 'recording'
  filename: string | null
  transcript: string
  summary: string
  duration: string
  /** Recording state — only relevant for source=recording */
  recordingStatus?: 'idle' | 'recording' | 'paused' | 'finalizing' | 'done'
  recordingStartedAt?: number | null
  recordingElapsed?: number  // seconds
  /** True while Whisper is actively streaming chunks into the transcript */
  isStreaming?: boolean
}

let _nextSessionId = 1

function InterviewsSubTab({ caseRow }: { readonly caseRow: CaseRow }): JSX.Element {
  const titles = getSessionTitles(caseRow.evaluation_type)
  const [sessions, setSessions] = useState<InterviewSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [intNotes, setIntNotes] = useState<Record<string, Record<string, string>>>({})
  const [showNewSessionInput, setShowNewSessionInput] = useState(false)
  const [newSessionTitle, setNewSessionTitle] = useState('')
  const newTitleRef = useRef<HTMLInputElement>(null)

  const interviewDataLoaded = useRef(false)

  // Load persisted interview sessions + notes
  useEffect(() => {
    if (interviewDataLoaded.current) return
    interviewDataLoaded.current = true
    ;(async () => {
      try {
        const resp = await window.psygil.onboarding.get({ case_id: caseRow.case_id })
        if (resp.status === 'success' && resp.data) {
          const row = resp.data.find((r: any) => r.section === 'interview_notes')
          if (row) {
            try {
              const parsed = JSON.parse(row.content) as { sessions?: InterviewSession[]; notes?: Record<string, Record<string, string>> }
              if (parsed.sessions?.length) {
                setSessions(parsed.sessions)
                setActiveSessionId(parsed.sessions[0].id)
              }
              if (parsed.notes) setIntNotes(parsed.notes)
            } catch { /* ignore */ }
          }
        }
      } catch { /* ignore */ }
    })()
  }, [caseRow.case_id])

  // Save interview data (sessions + notes)
  const saveInterviewData = useCallback(async (
    sessionsOverride?: InterviewSession[],
    notesOverride?: Record<string, Record<string, string>>,
  ) => {
    const sessionsToSave = sessionsOverride ?? sessions
    const notesToSave = notesOverride ?? intNotes
    try {
      await window.psygil.onboarding.save({
        case_id: caseRow.case_id,
        section: 'interview_notes' as any,
        data: {
          content: JSON.stringify({ sessions: sessionsToSave, notes: notesToSave }),
          status: 'draft',
        },
      })
    } catch (err) { console.error('[InterviewsSubTab] Failed to save:', err) }
  }, [caseRow.case_id, sessions, intNotes])

  // Audio settings
  const [showAudioSettings, setShowAudioSettings] = useState(false)
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedMicId, setSelectedMicId] = useState<string>('')
  const [captureSystemAudio, setCaptureSystemAudio] = useState(true)
  const [whisperStatus, setWhisperStatus] = useState<{ available: boolean; model: string | null } | null>(null)
  const [micGain, setMicGain] = useState(100)
  const audioSettingsRef = useRef<HTMLDivElement>(null)

  // Enumerate audio input devices
  useEffect(() => {
    async function loadDevices(): Promise<void> {
      try {
        // Request permission first so labels are populated
        await navigator.mediaDevices.getUserMedia({ audio: true }).then((s) => s.getTracks().forEach((t) => t.stop()))
        const devices = await navigator.mediaDevices.enumerateDevices()
        const mics = devices.filter((d) => d.kind === 'audioinput')
        setAudioDevices(mics)
        if (!selectedMicId && mics.length > 0) setSelectedMicId(mics[0].deviceId)
      } catch (err) {
        console.error('[Audio] Failed to enumerate devices:', err)
      }
    }
    if (showAudioSettings) {
      void loadDevices()
      // Also check Whisper status
      window.psygil.whisper.status().then((resp) => {
        if (resp.status === 'success') setWhisperStatus(resp.data)
      }).catch(() => setWhisperStatus({ available: false, model: null }))
    }
  }, [showAudioSettings, selectedMicId])

  // Close audio settings on outside click
  useEffect(() => {
    if (!showAudioSettings) return
    const handler = (e: MouseEvent): void => {
      if (audioSettingsRef.current && !audioSettingsRef.current.contains(e.target as Node)) {
        setShowAudioSettings(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showAudioSettings])

  // Cleanup media stream + PCM ScriptProcessor on unmount
  useEffect(() => {
    return () => {
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop())
      rawMicStreamRef.current?.getTracks().forEach((t) => t.stop())
      if (mediaRecorderRef.current?.state !== 'inactive') {
        try { mediaRecorderRef.current?.stop() } catch { /* already stopped */ }
      }
      if (pcmScriptNodeRef.current) {
        try { pcmScriptNodeRef.current.disconnect() } catch { /* ok */ }
      }
      if (pcmAudioContextRef.current) {
        pcmAudioContextRef.current.close().catch(() => {})
      }
    }
  }, [])

  // Inject keyframe animations once
  useEffect(() => {
    const id = 'psygil-interview-keyframes'
    if (document.getElementById(id)) return
    const style = document.createElement('style')
    style.id = id
    style.textContent = `
      @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
      @keyframes spin { to{transform:rotate(360deg)} }
    `
    document.head.appendChild(style)
  }, [])

  // Focus input when shown
  useEffect(() => {
    if (showNewSessionInput && newTitleRef.current) newTitleRef.current.focus()
  }, [showNewSessionInput])

  // Auto-select first session when sessions change
  useEffect(() => {
    if (activeSessionId === null && sessions.length > 0) {
      setActiveSessionId(sessions[0].id)
    }
  }, [sessions, activeSessionId])

  // Auto-save sessions + notes (debounced 1s after last change)
  const interviewSaveInitialized = useRef(false)
  useEffect(() => {
    if (!interviewSaveInitialized.current) { interviewSaveInitialized.current = true; return }
    const timer = setTimeout(() => { void saveInterviewData() }, 1000)
    return () => clearTimeout(timer)
  }, [sessions, intNotes]) // eslint-disable-line react-hooks/exhaustive-deps

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null
  const activeNotes = activeSessionId ? (intNotes[activeSessionId] ?? {}) : {}

  const updateSessionNote = useCallback((key: string, value: string) => {
    if (!activeSessionId) return
    setIntNotes((prev) => ({
      ...prev,
      [activeSessionId]: { ...(prev[activeSessionId] ?? {}), [key]: value },
    }))
  }, [activeSessionId])

  const updateSessionField = useCallback((id: string, field: 'transcript' | 'summary' | 'title', value: string) => {
    setSessions((prev) => prev.map((s) => s.id === id ? { ...s, [field]: value } : s))
  }, [])

  // Import transcripts — each file creates a new session
  const handleImportTranscripts = useCallback(async () => {
    try {
      const resp = await window.psygil.documents.pickFilesFrom({
        defaultPath: '$DOWNLOADS',
        title: 'Select Interview Transcripts (Zoom, Teams, etc.)',
        extensions: ['vtt', 'txt', 'pdf', 'json', 'csv', 'docx', 'doc'],
      })
      if (resp.status === 'success' && resp.data?.filePaths?.length > 0) {
        const paths = resp.data.filePaths as string[]
        const newSessions: InterviewSession[] = []
        for (const fp of paths) {
          await window.psygil.documents.ingest({ case_id: caseRow.case_id, file_path: fp, subfolder: 'Interviews' })
          const parts = fp.replace(/\\/g, '/').split('/')
          const filename = parts[parts.length - 1]
          // Strip extension for title
          const baseName = filename.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ')
          const sessionNum = sessions.length + newSessions.length + 1
          const suggestedTitle = titles[sessionNum - 1] ?? `Session ${sessionNum}`
          const id = `session-${_nextSessionId++}`
          newSessions.push({
            id,
            title: suggestedTitle,
            date: new Date().toISOString().split('T')[0],
            source: 'import',
            filename,
            transcript: `[Imported from ${filename}]\n\nTranscript content will be loaded from the file. Source: ${baseName}`,
            summary: '',
            duration: '',
          })
        }
        setSessions((prev) => [...prev, ...newSessions])
        if (newSessions.length > 0) setActiveSessionId(newSessions[0].id)
      }
    } catch (err) {
      console.error('[InterviewsSubTab] Import error:', err)
    }
  }, [caseRow.case_id, sessions.length, titles])

  // Create a new session — immediately creates a tab dated today
  const handleCreateNewSession = useCallback(() => {
    const today = new Date()
    const dateStr = today.toISOString().split('T')[0]
    const sessionNum = sessions.length + 1
    const id = `session-${_nextSessionId++}`
    const suggestedTitle = titles[sessionNum - 1] ?? `Session ${sessionNum}`
    const newSession: InterviewSession = {
      id,
      title: `${suggestedTitle} — ${dateStr}`,
      date: dateStr,
      source: 'recording',
      filename: null,
      transcript: '',
      summary: '',
      duration: '',
      recordingStatus: 'idle',
      recordingStartedAt: null,
      recordingElapsed: 0,
    }
    setSessions((prev) => [...prev, newSession])
    setActiveSessionId(id)
    setShowNewSessionInput(false)
    setNewSessionTitle('')
  }, [sessions.length, titles])

  // Create a manual session (from inline input, kept for typed-title use)
  const handleCreateManualSession = useCallback(() => {
    const title = newSessionTitle.trim()
    if (!title) return
    const id = `session-${_nextSessionId++}`
    const newSession: InterviewSession = {
      id,
      title,
      date: new Date().toISOString().split('T')[0],
      source: 'manual',
      filename: null,
      transcript: '',
      summary: '',
      duration: '',
    }
    setSessions((prev) => [...prev, newSession])
    setActiveSessionId(id)
    setNewSessionTitle('')
    setShowNewSessionInput(false)
  }, [newSessionTitle])

  // ── Real audio capture: ScriptProcessorNode (live PCM) + MediaRecorder (archival) ──
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const rawMicStreamRef = useRef<MediaStream | null>(null)
  const liveStreamActiveRef = useRef(false)
  const activeSessionIdForStreamRef = useRef<string | null>(null)
  const pcmAudioContextRef = useRef<AudioContext | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pcmScriptNodeRef = useRef<ScriptProcessorNode | null>(null)
  const pcmChunkCountRef = useRef(0)

  /**
   * Convert a Float32Array to base64 for IPC transport.
   */
  const float32ToBase64 = useCallback((f32: Float32Array): string => {
    const u8 = new Uint8Array(f32.buffer, f32.byteOffset, f32.byteLength)
    let binary = ''
    for (let i = 0; i < u8.length; i++) binary += String.fromCharCode(u8[i])
    return btoa(binary)
  }, [])

  const startMediaCapture = useCallback(async (sessionId: string): Promise<boolean> => {
    try {
      // Build mic constraints using selected device
      const micConstraints: MediaTrackConstraints = selectedMicId
        ? { deviceId: { exact: selectedMicId }, echoCancellation: true, noiseSuppression: true }
        : { echoCancellation: true, noiseSuppression: true }

      const micStream = await navigator.mediaDevices.getUserMedia({ audio: micConstraints })
      rawMicStreamRef.current = micStream

      // Apply gain if not 100%
      let streamForRecorder: MediaStream
      if (micGain !== 100) {
        const gainCtx = new AudioContext()
        const source = gainCtx.createMediaStreamSource(micStream)
        const gainNode = gainCtx.createGain()
        gainNode.gain.value = micGain / 100
        source.connect(gainNode)
        const dest = gainCtx.createMediaStreamDestination()
        gainNode.connect(dest)
        streamForRecorder = dest.stream
      } else {
        streamForRecorder = micStream
      }
      mediaStreamRef.current = streamForRecorder

      // ──────────────────────────────────────────────────────────
      // 1. Start live streaming session on the sidecar
      // ──────────────────────────────────────────────────────────
      activeSessionIdForStreamRef.current = sessionId
      if (typeof window.psygil?.whisper?.streamStart === 'function') {
        try {
          const resp = await window.psygil.whisper.streamStart({ sessionId })
          liveStreamActiveRef.current = resp.status === 'success'
          if (liveStreamActiveRef.current) {
            console.log(`[Audio] Live stream started for session ${sessionId}`)
          }
        } catch (err) {
          console.warn('[Audio] Live stream start failed:', err)
          liveStreamActiveRef.current = false
        }
      }

      // ──────────────────────────────────────────────────────────
      // 2. ScriptProcessorNode: capture raw PCM at 16 kHz for live transcription
      //    This bypasses WebM container entirely — sidecar gets raw float32.
      //    (ScriptProcessorNode is deprecated but works reliably in Electron
      //    where AudioWorklet blob: URLs are blocked by CSP.)
      // ──────────────────────────────────────────────────────────
      pcmChunkCountRef.current = 0
      if (liveStreamActiveRef.current) {
        try {
          // Force 16 kHz sample rate so whisper gets what it expects
          const pcmCtx = new AudioContext({ sampleRate: 16000 })
          const pcmSource = pcmCtx.createMediaStreamSource(micStream)

          // bufferSize=4096 at 16kHz = 256ms per callback — good latency
          const scriptNode = pcmCtx.createScriptProcessor(4096, 1, 1)

          scriptNode.onaudioprocess = (e: AudioProcessingEvent) => {
            if (!liveStreamActiveRef.current) return
            const inputData = e.inputBuffer.getChannelData(0) // Float32Array
            // Copy the data (the buffer gets reused)
            const pcmCopy = new Float32Array(inputData.length)
            pcmCopy.set(inputData)
            const b64 = float32ToBase64(pcmCopy)

            pcmChunkCountRef.current += 1
            if (pcmChunkCountRef.current <= 3 || pcmChunkCountRef.current % 20 === 0) {
              console.log(`[Audio] PCM chunk #${pcmChunkCountRef.current}: ${pcmCopy.length} samples, ${b64.length} b64 chars`)
            }

            window.psygil?.whisper?.streamAudio({
              sessionId: activeSessionIdForStreamRef.current ?? '',
              audioBase64: b64,
            })
          }

          pcmSource.connect(scriptNode)
          scriptNode.connect(pcmCtx.destination) // must connect to keep node alive
          pcmAudioContextRef.current = pcmCtx
          pcmScriptNodeRef.current = scriptNode
          console.log(`[Audio] PCM ScriptProcessorNode started at ${pcmCtx.sampleRate} Hz`)
        } catch (err) {
          console.warn('[Audio] ScriptProcessor setup failed, live transcription may not work:', err)
        }
      }

      // ──────────────────────────────────────────────────────────
      // 3. MediaRecorder: archival WebM recording only (NOT streamed)
      // ──────────────────────────────────────────────────────────
      audioChunksRef.current = []
      const recorder = new MediaRecorder(streamForRecorder, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm',
      })
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }
      recorder.start(1000) // 1s chunks for archival (no need for 250ms)
      mediaRecorderRef.current = recorder
      return true
    } catch (err) {
      console.error('[Audio] Failed to start capture:', err)
      return false
    }
  }, [selectedMicId, micGain, float32ToBase64])

  const stopMediaCapture = useCallback((): Promise<Blob> => {
    return new Promise((resolve) => {
      // Stop live stream to sidecar
      if (liveStreamActiveRef.current && activeSessionIdForStreamRef.current) {
        if (typeof window.psygil?.whisper?.streamStop === 'function') {
          window.psygil.whisper.streamStop({ sessionId: activeSessionIdForStreamRef.current }).catch(() => {})
        }
        liveStreamActiveRef.current = false
      }

      // Tear down PCM ScriptProcessorNode + AudioContext
      if (pcmScriptNodeRef.current) {
        pcmScriptNodeRef.current.disconnect()
        pcmScriptNodeRef.current = null
      }
      if (pcmAudioContextRef.current) {
        pcmAudioContextRef.current.close().catch(() => {})
        pcmAudioContextRef.current = null
      }

      const recorder = mediaRecorderRef.current
      if (!recorder || recorder.state === 'inactive') {
        resolve(new Blob(audioChunksRef.current, { type: 'audio/webm' }))
        return
      }
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        resolve(blob)
      }
      recorder.stop()
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop())
      mediaStreamRef.current = null
      mediaRecorderRef.current = null
    })
  }, [])

  const pauseMediaCapture = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause()
    }
  }, [])

  const resumeMediaCapture = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume()
    }
  }, [])

  // Save audio blob to case Interviews folder via IPC
  const saveAudioFile = useCallback(async (blob: Blob, sessionId: string): Promise<string | null> => {
    try {
      if (!caseRow.case_id) return null
      const arrayBuf = await blob.arrayBuffer()
      const uint8 = new Uint8Array(arrayBuf)
      // Convert to base64 for IPC transport
      let binary = ''
      for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i])
      const b64 = btoa(binary)
      const filename = `interview_${sessionId}_${new Date().toISOString().replace(/[:.]/g, '-')}.webm`

      const resp = await window.psygil.whisper.saveAudio({
        caseId: caseRow.case_id,
        audioBase64: b64,
        filename,
        mimeType: 'audio/webm',
      })

      if (resp.status === 'success') {
        console.log(`[Audio] Saved: ${resp.data.filePath} (${(resp.data.sizeBytes / 1024).toFixed(1)} KB)`)
        return resp.data.filePath
      }
      console.error('[Audio] Save failed:', resp.error)
      return null
    } catch (err) {
      console.error('[Audio] Failed to save audio:', err)
      return null
    }
  }, [caseRow.case_id])

  // Recording controls — wired to real MediaRecorder + live streaming
  const handleToggleRecording = useCallback(async () => {
    if (!activeSession) return
    const status = activeSession.recordingStatus ?? 'idle'
    if (status === 'idle' || status === 'done') {
      // Start recording + live stream
      const ok = await startMediaCapture(activeSession.id)
      if (!ok) {
        setSessions((prev) => prev.map((s) => s.id === activeSession.id ? {
          ...s,
          transcript: (s.transcript ? s.transcript + '\n' : '') + '⚠ Microphone access denied or unavailable. Check Audio Settings (gear icon) and ensure a mic is selected.',
        } : s))
        return
      }
      setSessions((prev) => prev.map((s) => s.id === activeSession.id ? {
        ...s,
        recordingStatus: 'recording' as const,
        recordingStartedAt: Date.now(),
        recordingElapsed: 0,
        isStreaming: true,
      } : s))
    } else if (status === 'recording') {
      // Pause
      pauseMediaCapture()
      const elapsed = activeSession.recordingStartedAt
        ? Math.round((Date.now() - activeSession.recordingStartedAt) / 1000) + (activeSession.recordingElapsed ?? 0)
        : activeSession.recordingElapsed ?? 0
      setSessions((prev) => prev.map((s) => s.id === activeSession.id ? {
        ...s,
        recordingStatus: 'paused' as const,
        recordingStartedAt: null,
        recordingElapsed: elapsed,
      } : s))
    } else if (status === 'paused') {
      // Resume
      resumeMediaCapture()
      setSessions((prev) => prev.map((s) => s.id === activeSession.id ? {
        ...s,
        recordingStatus: 'recording' as const,
        recordingStartedAt: Date.now(),
      } : s))
    }
  }, [activeSession, startMediaCapture, pauseMediaCapture, resumeMediaCapture])

  // ── Sentence-buffered live transcript ──
  // Instead of dumping every 3-second whisper chunk as a new timestamped line,
  // we accumulate text and only commit a timestamped paragraph when we hit a
  // sentence boundary (.  ?  !). Incomplete text sits in a pending buffer and
  // is shown as a live "typing" line at the end of the transcript.
  const pendingTextRef = useRef('')          // text not yet committed (no sentence end)
  const pendingTimestampRef = useRef('')     // timestamp captured when the first word of the pending text arrived

  /**
   * Flush any remaining pending text into the transcript as a committed line.
   * Called on stream stop so nothing is lost.
   */
  const flushPendingTranscript = useCallback((sessionId: string) => {
    const pending = pendingTextRef.current.trim()
    if (!pending) return
    const ts = pendingTimestampRef.current
    setSessions((prev) => prev.map((s) => {
      if (s.id !== sessionId) return s
      // Remove the old live-preview suffix (the ▍ line) and append committed text
      const cleaned = s.transcript.replace(/\n?⏳ .*$/, '')
      const sep = cleaned ? '\n' : ''
      return { ...s, transcript: cleaned + sep + ts + pending }
    }))
    pendingTextRef.current = ''
    pendingTimestampRef.current = ''
  }, [])

  // Listen for live transcription text from the sidecar (via main process)
  useEffect(() => {
    const whisper = window.psygil?.whisper
    if (!whisper?.onLiveText) {
      console.log('[InterviewsSubTab] Live transcription listener not available (rebuild needed)')
      return
    }
    const off = whisper.onLiveText((data) => {
      if (data.type === 'partial') {
        setSessions((prev) => prev.map((s) => {
          if (s.id !== data.sessionId) return s

          // Compute a timestamp for this moment
          const startedAt = s.recordingStartedAt
          let nowTimestamp = ''
          if (startedAt) {
            const elapsedSec = Math.round((Date.now() - startedAt) / 1000) + (s.recordingElapsed ?? 0)
            const mm = Math.floor(elapsedSec / 60)
            const ss = elapsedSec % 60
            nowTimestamp = `[${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}] `
          }

          // If this is the start of a new pending chunk, record the timestamp
          if (!pendingTextRef.current) {
            pendingTimestampRef.current = nowTimestamp
          }

          // Add incoming text to pending buffer (with a space separator)
          const incoming = data.text.trim()
          if (!incoming) return s
          pendingTextRef.current = pendingTextRef.current
            ? pendingTextRef.current + ' ' + incoming
            : incoming

          // Check for sentence boundaries in the pending buffer
          // Split on sentence-ending punctuation followed by a space or end-of-string
          const sentenceEndRe = /([.!?])\s+/g
          const fullText = pendingTextRef.current
          let lastSplit = 0
          let match: RegExpExecArray | null = null
          const committedLines: string[] = []

          // Find all sentence boundaries
          while ((match = sentenceEndRe.exec(fullText)) !== null) {
            const endIdx = match.index + match[0].length
            const sentence = fullText.slice(lastSplit, endIdx).trim()
            if (sentence) committedLines.push(sentence)
            lastSplit = endIdx
          }

          // Also commit if ending with sentence-final punctuation at end of string
          if (lastSplit === 0 && /[.!?]$/.test(fullText.trim())) {
            committedLines.push(fullText.trim())
            lastSplit = fullText.length
          }

          if (committedLines.length > 0) {
            // We have complete sentences — commit them
            const committed = committedLines.join(' ')
            const remainder = fullText.slice(lastSplit).trim()
            const ts = pendingTimestampRef.current

            // Remove old live-preview line (⏳ ...) and append committed block
            const cleaned = s.transcript.replace(/\n?⏳ .*$/, '')
            const sep = cleaned ? '\n' : ''
            let newTranscript = cleaned + sep + ts + committed

            // If there's leftover text, show it as live preview
            pendingTextRef.current = remainder
            pendingTimestampRef.current = remainder ? nowTimestamp : ''
            if (remainder) {
              newTranscript += '\n⏳ ' + remainder
            }

            return { ...s, transcript: newTranscript }
          } else {
            // No complete sentence yet — just update the live preview line
            const cleaned = s.transcript.replace(/\n?⏳ .*$/, '')
            const sep = cleaned ? '\n' : ''
            return { ...s, transcript: cleaned + sep + '⏳ ' + pendingTextRef.current }
          }
        }))
      } else if (data.type === 'final') {
        // Flush remaining pending text on final
        const pending = pendingTextRef.current.trim()
        if (pending) {
          const ts = pendingTimestampRef.current
          setSessions((prev) => prev.map((s) => {
            if (s.id !== data.sessionId) return s
            const cleaned = s.transcript.replace(/\n?⏳ .*$/, '')
            const sep = cleaned ? '\n' : ''
            return { ...s, transcript: cleaned + sep + ts + pending }
          }))
          pendingTextRef.current = ''
          pendingTimestampRef.current = ''
        }
        console.log(`[Transcribe] Final transcript for ${data.sessionId}: ${data.text.length} chars`)
      } else if (data.type === 'error') {
        setSessions((prev) => prev.map((s) => {
          if (s.id !== data.sessionId) return s
          return { ...s, transcript: s.transcript + `\n[${data.text}]\n` }
        }))
      }
    })
    return () => { off() }
  }, [])

  /**
   * Generate a clinical interview summary from a transcript via Claude API.
   * Runs in the background after recording stops — does not block the UI.
   */
  const generateSessionSummary = useCallback(async (sessionId: string, transcript: string) => {
    console.log(`[Summary] generateSessionSummary called for ${sessionId}, transcript length: ${transcript?.length ?? 0}`)
    if (!transcript || transcript.trim().length < 40) {
      console.log('[Summary] Transcript too short for summary generation, skipping')
      return
    }

    // Get case context for the prompt
    const patientName = caseRow.patient_name ?? 'the patient'
    const evalType = caseRow.evaluation_type ?? 'forensic psychological evaluation'

    console.log(`[Summary] Calling Claude API for session ${sessionId}...`)
    try {
      const resp = await window.psygil.ai.complete({
        systemPrompt: `You are a forensic psychology clinical assistant. Generate a concise, professional interview session summary from the provided transcript. The summary should be written in clinical language appropriate for a forensic psychological evaluation report.

Structure the summary as follows:
1. **Session Overview** — One sentence: who was interviewed, approximate duration, and setting context.
2. **Key Topics Covered** — Brief bullet points of the main areas discussed (e.g., presenting complaint, psychiatric history, substance use, legal history, family background).
3. **Notable Clinical Observations** — Any significant behavioral observations, affect, rapport quality, or inconsistencies noted in the transcript.
4. **Clinically Relevant Statements** — Direct quotes or paraphrased statements from the interviewee that are diagnostically or forensically significant.
5. **Follow-up Considerations** — Areas that need further exploration, collateral contacts to pursue, or additional testing indicated.

Keep the summary to 200-400 words. Use professional clinical language. Do not diagnose — note observations only. DOCTOR ALWAYS DIAGNOSES — the AI never makes diagnostic conclusions.`,
        userMessage: `Patient: ${patientName}
Evaluation type: ${evalType}

Interview transcript:
${transcript.trim()}

Generate the clinical interview session summary.`,
        maxTokens: 1024,
      })

      console.log(`[Summary] Claude API response status: ${resp.status}`, resp)
      if (resp.status === 'success' && resp.data?.content) {
        setSessions((prev) => {
          const updated = prev.map((s) =>
            s.id === sessionId ? { ...s, summary: resp.data!.content } : s
          )
          // Auto-save with the updated sessions (includes new summary)
          void saveInterviewData(updated)
          return updated
        })
        console.log(`[Summary] Generated summary for session ${sessionId} (${resp.data.content.length} chars)`)
      } else {
        // AI call failed — set a fallback message so the spinner stops
        console.warn('[Summary] AI completion failed:', resp)
        const errorMsg = resp.status === 'error'
          ? `[Summary generation failed: ${(resp as any).message ?? 'unknown error'}. You can write a summary manually.]`
          : ''
        if (errorMsg) {
          setSessions((prev) => prev.map((s) =>
            s.id === sessionId ? { ...s, summary: errorMsg } : s
          ))
        }
      }
    } catch (err) {
      console.warn('[Summary] Failed to generate summary:', err)
      // Stop the spinner by setting an error message
      setSessions((prev) => prev.map((s) =>
        s.id === sessionId
          ? { ...s, summary: `[Summary generation failed: ${err instanceof Error ? err.message : 'unknown error'}. You can write a summary manually.]` }
          : s
      ))
    }
  }, [caseRow.patient_name, caseRow.evaluation_type, saveInterviewData])

  const handleStopRecording = useCallback(async () => {
    if (!activeSession) return
    const sessionId = activeSession.id
    const elapsed = activeSession.recordingStartedAt
      ? Math.round((Date.now() - activeSession.recordingStartedAt) / 1000) + (activeSession.recordingElapsed ?? 0)
      : activeSession.recordingElapsed ?? 0
    const mins = Math.floor(elapsed / 60)
    const secs = elapsed % 60
    const durationStr = `${mins}:${String(secs).padStart(2, '0')}`

    // Flush pending buffered text + merge into a single "finalizing" state update.
    // We grab the cleaned transcript from inside the updater so we have the latest state.
    let capturedTranscript = ''
    const pendingFlush = pendingTextRef.current.trim()
    const pendingTs = pendingTimestampRef.current
    pendingTextRef.current = ''
    pendingTimestampRef.current = ''

    setSessions((prev) => prev.map((s) => {
      if (s.id !== sessionId) return s
      // Clean up: remove ⏳ live-preview line, append any remaining pending text
      let transcript = (s.transcript || '').replace(/\n?⏳ .*$/, '')
      if (pendingFlush) {
        const sep = transcript ? '\n' : ''
        transcript = transcript + sep + pendingTs + pendingFlush
      }
      capturedTranscript = transcript
      return {
        ...s,
        recordingStatus: 'finalizing' as const,
        recordingStartedAt: null,
        recordingElapsed: elapsed,
        duration: durationStr,
        transcript,
      }
    }))

    const audioBlob = await stopMediaCapture()
    const sizeKB = (audioBlob.size / 1024).toFixed(1)

    // Save audio file for archival (transcription already happened live)
    const savedFilePath = await saveAudioFile(audioBlob, sessionId)
    const savedNote = savedFilePath
      ? `\n[Audio saved: ${sizeKB} KB, ${durationStr}]\n`
      : `\n[Audio captured: ${sizeKB} KB, ${durationStr} — file save failed]\n`

    setSessions((prev) => prev.map((s) => s.id === sessionId ? {
      ...s,
      recordingStatus: 'done' as const,
      isStreaming: false,
      transcript: capturedTranscript + savedNote,
    } : s))

    // Auto-generate summary in the background (non-blocking)
    // Strip timestamp prefixes and metadata lines for cleaner AI input
    const cleanTranscript = capturedTranscript
      .replace(/^\[[\d:]+\]\s*/gm, '')  // remove [MM:SS] prefixes
      .replace(/^\[Audio .*\]$/gm, '')   // remove [Audio saved: ...] lines
      .trim()
    console.log(`[Summary] Sending transcript to Claude (${cleanTranscript.length} chars)`)
    generateSessionSummary(sessionId, cleanTranscript)
  }, [activeSession, stopMediaCapture, saveAudioFile, generateSessionSummary])

  // Live elapsed timer
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (activeSession?.recordingStatus !== 'recording') return
    const iv = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(iv)
  }, [activeSession?.recordingStatus])

  const liveElapsed = useMemo(() => {
    if (!activeSession) return '0:00'
    const base = activeSession.recordingElapsed ?? 0
    const running = activeSession.recordingStartedAt
      ? Math.round((Date.now() - activeSession.recordingStartedAt) / 1000)
      : 0
    const total = base + running
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSession?.recordingStartedAt, activeSession?.recordingElapsed, tick])

  const sessionTabStyle = (active: boolean): React.CSSProperties => ({
    padding: '5px 12px', fontSize: 11,
    fontWeight: active ? 600 : 400,
    color: active ? 'var(--accent)' : 'var(--text-secondary)',
    background: 'transparent', border: 'none',
    borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
    cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0,
  })

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
          Clinical Interviews
          {sessions.length > 0 && <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--text-secondary)', marginLeft: 6 }}>({sessions.length} session{sessions.length !== 1 ? 's' : ''})</span>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleImportTranscripts} style={editBtnStyle}>＋ Import Transcripts</button>
          <button
            onClick={handleCreateNewSession}
            style={{ ...editBtnStyle, background: 'var(--panel)', color: 'var(--accent)', border: '1px solid var(--accent)' }}
          >
            ＋ New Session
          </button>
        </div>
      </div>

      {/* ── New session inline input ── */}
      {showNewSessionInput && (
        <div style={{
          display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10,
          padding: '8px 12px', background: 'var(--sidebar-bg, #f5f5f5)', borderRadius: 6,
        }}>
          <input
            ref={newTitleRef}
            type="text"
            value={newSessionTitle}
            onChange={(e) => setNewSessionTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreateManualSession(); if (e.key === 'Escape') { setShowNewSessionInput(false); setNewSessionTitle('') } }}
            placeholder="Session title (e.g., Clinical Interview — Psychiatric History)"
            style={{
              flex: 1, padding: '5px 10px', fontSize: 12, fontFamily: 'inherit',
              border: '1px solid var(--border)', borderRadius: 4,
              background: 'var(--bg)', color: 'var(--text)',
            }}
          />
          <button onClick={handleCreateManualSession} style={{ ...editBtnStyle, padding: '5px 14px' }}>Create</button>
          <button
            onClick={() => { setShowNewSessionInput(false); setNewSessionTitle('') }}
            style={{ ...editBtnStyle, background: 'var(--panel)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* ── Session subtabs ── */}
      {sessions.length > 0 && (
        <div style={{
          display: 'flex', gap: 0, borderBottom: '1px solid var(--border)',
          marginBottom: 0, overflowX: 'auto',
        }}>
          {sessions.map((s, idx) => (
            <button
              key={s.id}
              onClick={() => setActiveSessionId(s.id)}
              style={sessionTabStyle(activeSessionId === s.id)}
            >
              {idx + 1}. {s.title}
              {s.source === 'import' && <span style={{ marginLeft: 4, fontSize: 9, opacity: 0.6 }}>📎</span>}
            </button>
          ))}
        </div>
      )}

      {/* ── Empty state ── */}
      {sessions.length === 0 && (
        <div style={{
          padding: '40px 20px', textAlign: 'center',
          color: 'var(--text-secondary)', fontSize: 13,
        }}>
          <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.3 }}>🎙</div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>No interview sessions yet</div>
          <div style={{ fontSize: 12 }}>
            Import transcripts from Zoom, Teams, or other meeting portals, or create a manual session for typed notes.
          </div>
        </div>
      )}

      {/* ── Active session content ── */}
      {activeSession && (
        <div style={{ paddingTop: 12 }}>
          {/* Session header bar */}
          <div style={{
            display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12,
            padding: '8px 12px', background: 'var(--sidebar-bg, #f5f5f5)', borderRadius: 6,
          }}>
            <table style={{ ...dataTableStyle, marginBottom: 0, width: 'auto' }}>
              <tbody>
                <tr>
                  <td style={{ ...dataLabelTd, borderBottom: 'none', padding: '2px 10px 2px 0' }}>Date</td>
                  <td style={{ ...dataValueTd, borderBottom: 'none', padding: '2px 0' }}>{activeSession.date}</td>
                </tr>
              </tbody>
            </table>
            <table style={{ ...dataTableStyle, marginBottom: 0, width: 'auto' }}>
              <tbody>
                <tr>
                  <td style={{ ...dataLabelTd, borderBottom: 'none', padding: '2px 10px 2px 0' }}>Source</td>
                  <td style={{ ...dataValueTd, borderBottom: 'none', padding: '2px 0' }}>
                    {activeSession.source === 'import' ? `📎 ${activeSession.filename}` : activeSession.source === 'recording' ? '🎙 Recording' : '✏️ Manual'}
                  </td>
                </tr>
              </tbody>
            </table>
            <div style={{ flex: 1 }} />

            {/* ── Recording controls ── */}
            {(activeSession.source === 'recording' || activeSession.source === 'manual') && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Elapsed / duration display */}
                {(activeSession.recordingStatus === 'recording' || activeSession.recordingStatus === 'paused') && (
                  <span style={{
                    fontFamily: 'monospace', fontSize: 13, fontWeight: 600,
                    color: activeSession.recordingStatus === 'recording' ? '#e54040' : 'var(--text-secondary)',
                    minWidth: 48, textAlign: 'right',
                  }}>
                    {liveElapsed}
                  </span>
                )}
                {activeSession.recordingStatus === 'recording' && (
                  <>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#e54040', animation: 'pulse 1.2s ease-in-out infinite', flexShrink: 0 }} />
                    <span style={{ fontSize: 10, fontWeight: 600, color: '#e54040', textTransform: 'uppercase', letterSpacing: '0.04em' }}>LIVE</span>
                  </>
                )}

                {/* Record / Pause button */}
                {(activeSession.recordingStatus === 'idle' || activeSession.recordingStatus === 'done' || !activeSession.recordingStatus) && (
                  <button
                    onClick={handleToggleRecording}
                    title="Start recording — live transcription streams as you speak"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '4px 12px', fontSize: 11, fontWeight: 600,
                      border: '1px solid #e54040', borderRadius: 4,
                      background: 'rgba(229,64,64,0.08)', color: '#e54040',
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    <span style={{ fontSize: 14 }}>🎙</span> Record
                  </button>
                )}
                {activeSession.recordingStatus === 'recording' && (
                  <>
                    <button
                      onClick={handleToggleRecording}
                      title="Pause recording and transcription"
                      style={{
                        padding: '4px 10px', fontSize: 11, fontWeight: 600,
                        border: '1px solid var(--border)', borderRadius: 4,
                        background: 'var(--panel)', color: 'var(--text)',
                        cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      ⏸ Pause
                    </button>
                    <button
                      onClick={handleStopRecording}
                      title="Stop recording"
                      style={{
                        padding: '4px 10px', fontSize: 11, fontWeight: 600,
                        border: '1px solid #e54040', borderRadius: 4,
                        background: '#e54040', color: '#fff',
                        cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      ⏹ Stop
                    </button>
                  </>
                )}
                {activeSession.recordingStatus === 'paused' && (
                  <>
                    <button
                      onClick={handleToggleRecording}
                      title="Resume recording and live transcription"
                      style={{
                        padding: '4px 10px', fontSize: 11, fontWeight: 600,
                        border: '1px solid #e54040', borderRadius: 4,
                        background: 'rgba(229,64,64,0.08)', color: '#e54040',
                        cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      🎙 Resume
                    </button>
                    <button
                      onClick={handleStopRecording}
                      title="Stop recording"
                      style={{
                        padding: '4px 10px', fontSize: 11, fontWeight: 600,
                        border: '1px solid #e54040', borderRadius: 4,
                        background: '#e54040', color: '#fff',
                        cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      ⏹ Stop
                    </button>
                  </>
                )}
                {activeSession.recordingStatus === 'finalizing' && (
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid var(--accent)', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    Finalizing transcript…
                  </span>
                )}

                {/* ── Audio settings gear ── */}
                <div style={{ position: 'relative' }} ref={audioSettingsRef}>
                  <button
                    onClick={() => setShowAudioSettings((v) => !v)}
                    title="Audio input settings"
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: 28, height: 28, padding: 0,
                      border: '1px solid var(--border)', borderRadius: 4,
                      background: showAudioSettings ? 'var(--accent)' : 'var(--panel)',
                      color: showAudioSettings ? '#fff' : 'var(--text-secondary)',
                      cursor: 'pointer', fontSize: 14,
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="3" />
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                  </button>

                  {/* ── Audio settings popover ── */}
                  {showAudioSettings && (
                    <div style={{
                      position: 'absolute', right: 0, top: '100%', marginTop: 6, zIndex: 9999,
                      width: 320, padding: '14px 16px',
                      background: 'var(--panel, #fff)', border: '1px solid var(--border)',
                      borderRadius: 6, boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                          <line x1="12" y1="19" x2="12" y2="23" />
                          <line x1="8" y1="23" x2="16" y2="23" />
                        </svg>
                        Audio Settings
                      </div>

                      {/* Microphone select */}
                      <div style={{ marginBottom: 12 }}>
                        <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 4 }}>
                          Microphone
                        </label>
                        <select
                          value={selectedMicId}
                          onChange={(e) => setSelectedMicId(e.target.value)}
                          style={{
                            width: '100%', padding: '5px 8px', fontSize: 11, fontFamily: 'inherit',
                            border: '1px solid var(--border)', borderRadius: 4,
                            background: 'var(--bg)', color: 'var(--text)',
                          }}
                        >
                          {audioDevices.length === 0 && <option value="">No microphones detected</option>}
                          {audioDevices.map((d) => (
                            <option key={d.deviceId} value={d.deviceId}>
                              {d.label || `Microphone (${d.deviceId.slice(0, 8)}…)`}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Mic gain */}
                      <div style={{ marginBottom: 12 }}>
                        <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span>Input Level</span>
                          <span style={{ fontFamily: 'monospace', color: 'var(--text)' }}>{micGain}%</span>
                        </label>
                        <input
                          type="range"
                          min={0} max={200} value={micGain}
                          onChange={(e) => setMicGain(Number(e.target.value))}
                          style={{ width: '100%', accentColor: 'var(--accent)' }}
                        />
                      </div>

                      {/* System audio toggle */}
                      <div style={{ marginBottom: 12 }}>
                        <label style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          fontSize: 11, color: 'var(--text)', cursor: 'pointer',
                        }}>
                          <input
                            type="checkbox"
                            checked={captureSystemAudio}
                            onChange={(e) => setCaptureSystemAudio(e.target.checked)}
                            style={{ accentColor: 'var(--accent)' }}
                          />
                          Capture system audio (speaker output)
                        </label>
                        <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 3, paddingLeft: 24 }}>
                          Records audio from video calls, playback, etc.
                        </div>
                      </div>

                      {/* Whisper engine status */}
                      <div style={{
                        padding: '8px 10px', borderRadius: 4, fontSize: 10, lineHeight: 1.5,
                        background: whisperStatus?.available ? 'rgba(46,160,67,0.08)' : 'rgba(229,64,64,0.06)',
                        border: `1px solid ${whisperStatus?.available ? 'rgba(46,160,67,0.2)' : 'rgba(229,64,64,0.15)'}`,
                        color: 'var(--text-secondary)',
                      }}>
                        <strong style={{ color: 'var(--text)' }}>Transcription Engine:</strong>{' '}
                        {whisperStatus?.available
                          ? <span style={{ color: '#2ea043' }}>Whisper.cpp ready ({whisperStatus.model})</span>
                          : <span style={{ color: '#e54040' }}>Whisper.cpp not installed</span>
                        }
                        <br />
                        {whisperStatus?.available
                          ? 'All audio is processed on-device. Nothing leaves this machine.'
                          : <>Setup: <code style={{ fontSize: 9 }}>~/Library/Application Support/Psygil/whisper/</code> needs <code style={{ fontSize: 9 }}>main</code> + <code style={{ fontSize: 9 }}>ggml-base.en.bin</code></>
                        }
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Duration (shown when not actively recording) */}
            {activeSession.duration && activeSession.recordingStatus !== 'recording' && activeSession.recordingStatus !== 'paused' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Duration</span>
                <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--text)' }}>{activeSession.duration}</span>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20 }}>
            {/* ── Left: Summary + Full editor ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {/* Summary — collapsible after transcription */}
              {(activeSession.recordingStatus === 'done' || activeSession.summary || activeSession.source !== 'recording') && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ ...narrativeSectionHeader, display: 'flex', alignItems: 'center', gap: 8 }}>
                    Session Summary
                    {activeSession.recordingStatus === 'done' && !activeSession.summary && (
                      <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ display: 'inline-block', width: 10, height: 10, border: '2px solid var(--accent)', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                        Generating…
                      </span>
                    )}
                  </div>
                  <textarea
                    value={activeSession.summary}
                    onChange={(e) => updateSessionField(activeSession.id, 'summary', e.target.value)}
                    onBlur={() => void saveInterviewData()}
                    placeholder={activeSession.recordingStatus === 'done' && !activeSession.summary
                      ? 'AI is generating a clinical summary from the transcript…'
                      : 'Brief summary of this interview session — key topics covered, notable observations, clinical impressions…'}
                    style={{
                      width: '100%', boxSizing: 'border-box' as const, minHeight: 80,
                      padding: '8px 10px', fontSize: 12.5, fontFamily: 'inherit',
                      lineHeight: 1.6, border: '1px solid var(--border)', borderRadius: 4,
                      background: 'var(--bg)', color: 'var(--text)', resize: 'vertical',
                    }}
                  />
                </div>
              )}

              {/* Transcript / Notes — full height editor */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ ...narrativeSectionHeader, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {activeSession.source === 'import' ? 'Transcript' : activeSession.source === 'recording' ? 'Live Transcript' : 'Session Notes'}
                  {activeSession.isStreaming && activeSession.recordingStatus === 'recording' && (
                    <span style={{
                      fontSize: 10, fontWeight: 600, color: '#e54040',
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#e54040', animation: 'pulse 1.2s ease-in-out infinite' }} />
                      streaming
                    </span>
                  )}
                  {activeSession.recordingStatus === 'paused' && (
                    <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)' }}>paused</span>
                  )}
                </div>
                <textarea
                  value={activeSession.transcript}
                  onChange={(e) => updateSessionField(activeSession.id, 'transcript', e.target.value)}
                  onBlur={() => void saveInterviewData()}
                  placeholder={
                    activeSession.recordingStatus === 'idle'
                      ? 'Press Record to begin live transcription. Words appear here as you speak. You can also type notes directly…'
                      : activeSession.recordingStatus === 'recording'
                        ? 'Listening… transcription will stream here in real time. You can type notes alongside the live text.'
                        : activeSession.recordingStatus === 'paused'
                          ? 'Recording paused. Press Resume to continue live transcription…'
                          : activeSession.recordingStatus === 'finalizing'
                            ? 'Flushing final audio chunk…'
                            : activeSession.source === 'import'
                              ? 'Imported transcript content will appear here…'
                              : 'Type session notes, observations, and interview content here…'
                  }
                  style={{
                    width: '100%', boxSizing: 'border-box' as const, minHeight: 420, flex: 1,
                    padding: '10px 12px', fontSize: 12.5, fontFamily: 'monospace',
                    lineHeight: 1.7, border: '1px solid var(--border)', borderRadius: 4,
                    background: activeSession.recordingStatus === 'recording' ? 'rgba(229,64,64,0.03)' : 'var(--bg)',
                    color: 'var(--text)', resize: 'vertical',
                    borderColor: activeSession.recordingStatus === 'recording' ? 'rgba(229,64,64,0.3)' : undefined,
                  }}
                />
              </div>
            </div>

            {/* ── Right: Clinical Notes (column 3) ── */}
            <div style={clinNotesColumnStyle}>
              <div style={clinNotesColumnHeader}>Clinical Notes</div>
              <ClinicalNoteField
                label="Mental Status Exam"
                value={activeNotes.mse ?? ''}
                onChange={(v) => updateSessionNote('mse', v)}
                onBlur={() => void saveInterviewData()}
                placeholder="Appearance, behavior, speech, mood/affect, thought process/content, cognition, insight/judgment…"
              />
              <ClinicalNoteField
                label="Rapport & Engagement"
                value={activeNotes.rapport ?? ''}
                onChange={(v) => updateSessionNote('rapport', v)}
                onBlur={() => void saveInterviewData()}
                placeholder="Cooperativeness, defensiveness, forthcomingness, consistency across sessions…"
              />
              <ClinicalNoteField
                label="Key Clinical Observations"
                value={activeNotes.observations ?? ''}
                onChange={(v) => updateSessionNote('observations', v)}
                onBlur={() => void saveInterviewData()}
                placeholder="Discrepancies noted, emotional responses, areas requiring follow-up, collateral contradictions…"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// DiagnosticsSubTab — Clinician Diagnostic Workspace
// ---------------------------------------------------------------------------

/** Short-title → full clinical paragraph for clinician formulation dropdowns */
interface FormulationTemplate {
  title: string
  body: string
}

/** Diagnostic consideration with DSM excerpt and templated formulation options */
interface DiagCondition {
  name: string
  dsmCode: string
  dsmExcerpt: string
  relevance: string
  dataSummary: string
  contradictingData: string
  templateOptions: FormulationTemplate[]
}

/** Build dynamic diagnostic considerations from all case data — only includes
 *  conditions that are actually suggested by the data. If only one fits, returns one.
 *  Includes contradicting data and rule-out reasoning per condition. */
function getDiagnosticConsiderations(
  evalType: string | null,
  parsedOb: Record<string, Record<string, string>>,
  intakeRow: PatientIntakeRow | null,
  stageIndex: number,
): DiagCondition[] {
  const et = (evalType ?? '').toLowerCase()
  const mental = parsedOb.mental
  const health = parsedOb.health
  const substance = parsedOb.substance
  const complaints = parsedOb.complaints
  const legal = parsedOb.legal
  const family = parsedOb.family

  const conditions: DiagCondition[] = []

  // Helper: check if a field has meaningful content (not empty, not "none", not "denies")
  const has = (val: string | undefined): boolean =>
    !!val && !val.toLowerCase().match(/^(—|none|n\/a|no |denies|not reported|no prior|no significant|no reported|no criminal|no history|no known)/)

  // ─────────────────────────────────────────────────
  // CST / Competency evaluations
  // ─────────────────────────────────────────────────
  if (et.includes('cst') || et.includes('competency')) {
    const hasPriorPsychDx = has(mental?.previous_diagnoses)
    const hasPsychMeds = has(mental?.psych_medications)
    const hasPriorTreatment = has(mental?.previous_treatment)
    const hasSubstance = has(substance?.alcohol_use) || has(substance?.drug_use)
    const hasCognitiveHistory = has(health?.head_injuries)

    // Psychotic disorder — consider if prior diagnoses, psych meds, or treatment suggest it
    if (hasPriorPsychDx || hasPsychMeds || hasPriorTreatment) {
      conditions.push({
        name: 'Schizophrenia', dsmCode: 'F20.9',
        dsmExcerpt: 'Two or more of: delusions, hallucinations, disorganized speech, grossly disorganized or catatonic behavior, negative symptoms. At least one must be delusions, hallucinations, or disorganized speech. Continuous disturbance for at least 6 months, with at least 1 month of active-phase symptoms. (DSM-5-TR 298.9)',
        relevance: `Prior psychiatric history suggests psychotic spectrum consideration. ${hasPriorPsychDx ? `Documented prior diagnoses: ${mental!.previous_diagnoses}.` : ''} ${hasPsychMeds ? `Psychiatric medications: ${mental!.psych_medications}.` : ''} ${hasPriorTreatment ? `Treatment history: ${mental!.previous_treatment}.` : ''}`,
        dataSummary: `MSE findings, collateral reports, medication response history, and SIRS-2/MMPI-3 psychotic scales should be cross-referenced to determine whether active psychotic symptoms are present and meet duration criteria.`,
        contradictingData: `${!hasPriorPsychDx ? 'No prior psychotic diagnoses documented. ' : ''}If SIRS-2 indicates feigned psychosis, or if symptoms only appeared in the context of substance use, a primary psychotic disorder may not be supported.${hasSubstance ? ` Substance use is reported — substance-induced psychotic disorder must be differentiated.` : ''}`,
        templateOptions: [
          { title: 'Full criteria met — active psychosis confirmed', body: 'Clinical history, psychometric testing, and behavioral observations during the evaluation are consistent with an active psychotic disorder meeting DSM-5-TR criteria for Schizophrenia. The examinee demonstrated positive symptoms including [specify: delusions/hallucinations/disorganized speech] that have persisted for a duration consistent with the six-month continuous disturbance requirement. Functional impairment across occupational, social, and self-care domains is well-documented in both the clinical record and collateral reports. The symptom profile is not better accounted for by a mood disorder with psychotic features, substance-induced psychosis, or a medical condition.' },
          { title: 'Partial criteria — subthreshold presentation', body: 'While the clinical history documents prior psychotic episodes and the examinee reports residual symptoms, the current evaluation does not establish active psychotic symptoms meeting full DSM-5-TR criteria at this time. The presentation is more consistent with the residual phase of the illness, characterized by attenuated positive symptoms and persistent negative symptoms. This diagnostic consideration remains active pending integration of collateral records and longitudinal treatment data.' },
          { title: 'History supports but current MSE unremarkable', body: 'The examinee carries a documented history of schizophrenia per treatment records; however, mental status examination during the current evaluation was largely unremarkable for active psychotic symptoms. This may reflect adequate medication management, symptom remission, or strategic symptom minimization in the forensic context. The diagnosis is supported historically but cannot be confirmed as currently active based on the present evaluation data alone.' },
          { title: 'Diagnosis not supported — alternative explanation', body: 'The available clinical data do not support a diagnosis of Schizophrenia. Reported symptoms are better accounted for by [specify alternative: substance-induced psychotic disorder/mood disorder with psychotic features/malingering]. Testing validity indicators, behavioral observations, and the temporal relationship between symptoms and external circumstances argue against a primary psychotic disorder.' },
          { title: 'Medication response supports diagnosis', body: 'The examinee\'s documented positive response to antipsychotic medication is consistent with a primary psychotic disorder. Treatment records indicate symptom reduction with [medication], which is a first-line agent for schizophrenia. The pattern of medication response, when considered alongside the clinical history and current symptom presentation, provides additional support for this diagnostic consideration.' },
          { title: 'Collateral confirms chronic course', body: 'Collateral informants describe a chronic and deteriorating course consistent with the longitudinal trajectory expected in Schizophrenia. Reports from [family/treatment providers/correctional staff] document persistent functional decline, disorganized behavior, and social withdrawal predating the current forensic involvement. This corroborating information strengthens the diagnostic formulation.' },
          { title: 'Differentiate from substance-induced psychosis', body: 'Given the documented co-occurring substance use history, careful differential diagnosis is required between primary Schizophrenia and Substance-Induced Psychotic Disorder. The critical question is whether psychotic symptoms persist during periods of documented sobriety. Available data [support/do not clearly support] the independence of psychotic symptoms from substance use, and this differentiation has direct implications for competency-related treatment recommendations.' },
          { title: 'Negative symptoms predominate', body: 'The current clinical presentation is dominated by negative symptoms including affective flattening, alogia, avolition, and social withdrawal, with minimal active positive symptoms. This negative symptom profile is consistent with the deficit syndrome variant of Schizophrenia and has particular relevance to the competency question, as these symptoms may impair the examinee\'s ability to assist counsel and maintain rational understanding of proceedings independently of positive symptom management.' },
          { title: 'Cognitive deficits secondary to psychosis', body: 'Neurocognitive testing reveals deficits in processing speed, working memory, and executive functioning that are consistent with the cognitive impairment commonly associated with chronic schizophrenia. These deficits are unlikely to represent a primary neurocognitive disorder given the age of onset and symptom trajectory, but they are directly relevant to the examinee\'s functional capacity and ability to participate meaningfully in legal proceedings.' },
          { title: 'Competency implications — treatment restorability', body: 'If Schizophrenia is confirmed as the primary condition impairing competency, the prognosis for restoration through psychopharmacological treatment is [favorable/guarded/poor] based on the examinee\'s documented treatment history, medication adherence patterns, and degree of prior symptom stabilization. Treatment recommendations should account for the specific symptom profile contributing to the competency deficits identified.' },
        ],
      })
    }

    // Schizoaffective — only if both mood and psychotic features are suggested
    if (hasPriorPsychDx && hasPriorTreatment) {
      conditions.push({
        name: 'Schizoaffective Disorder', dsmCode: 'F25.x',
        dsmExcerpt: 'An uninterrupted period during which there is a major mood episode concurrent with Criterion A of Schizophrenia. Delusions or hallucinations for 2+ weeks in the absence of a major mood episode during the lifetime duration of the illness. (DSM-5-TR 295.70)',
        relevance: `Both psychiatric treatment history and prior diagnoses are documented, raising the question of whether mood and psychotic symptoms co-occur or are independent.`,
        dataSummary: `The temporal relationship between mood and psychotic symptoms must be established through detailed timeline analysis. MMPI-3/PAI mood and psychotic scales, interview timeline, and collateral informants are critical.`,
        contradictingData: `If psychotic symptoms occur exclusively during mood episodes, a mood disorder with psychotic features is more appropriate. If no clear mood episodes are documented, primary psychotic disorder should be considered instead.`,
        templateOptions: [
          { title: 'Temporal independence confirmed — schizoaffective supported', body: 'Longitudinal analysis of the clinical record establishes that psychotic symptoms have persisted for at least two weeks in the absence of a concurrent major mood episode, meeting the critical DSM-5-TR criterion distinguishing Schizoaffective Disorder from a mood disorder with psychotic features. The temporal relationship between mood and psychotic symptoms, supported by treatment records, medication history, and the current clinical interview, is consistent with Schizoaffective Disorder.' },
          { title: 'Both features present — temporal independence unclear', body: 'Mood and psychotic features are both documented in the clinical history and are observed in the current evaluation; however, their temporal independence has not been clearly established through available data. It remains unclear whether psychotic symptoms have persisted during euthymic periods. This diagnostic consideration is active but not confirmed, and additional collateral information or treatment records may clarify the longitudinal course.' },
          { title: 'Mood disorder with psychotic features more likely', body: 'Review of available data suggests that psychotic symptoms have occurred exclusively during major mood episodes and do not persist independently. This pattern is more consistent with a mood disorder with psychotic features (Major Depressive Disorder or Bipolar Disorder) rather than Schizoaffective Disorder. The distinction has treatment implications, as mood stabilization may be the primary treatment target.' },
          { title: 'Bipolar type vs. depressive type differentiation', body: 'The clinical history includes [manic/depressive] episodes co-occurring with psychotic symptoms. Clarification of the Schizoaffective Disorder subtype (Bipolar Type vs. Depressive Type) is necessary for accurate diagnosis and treatment planning. Available data are most consistent with the [Bipolar/Depressive] type designation based on the documented mood episode history.' },
          { title: 'Treatment records clarify longitudinal course', body: 'Psychiatric treatment records spanning [duration] provide critical longitudinal data for this differential. Hospital discharge summaries document [psychotic symptoms during euthymic periods / psychotic symptoms only during mood episodes], which [supports / argues against] the temporal independence criterion required for Schizoaffective Disorder. This historical documentation is weighted heavily in the diagnostic formulation.' },
          { title: 'Current presentation mixed — defer final diagnosis', body: 'The current evaluation captures a mixed clinical presentation with both mood and psychotic features active simultaneously, making it difficult to parse temporal independence at this single point in time. A definitive differentiation between Schizoaffective Disorder and a mood disorder with psychotic features may require longitudinal observation. For the purposes of this evaluation, both conditions are considered and treatment recommendations address both symptom domains.' },
          { title: 'Medication history informs differential', body: 'The examinee\'s differential response to antipsychotic versus mood-stabilizing medications provides additional diagnostic data. Records indicate [better response to antipsychotics alone / requirement of combined antipsychotic and mood stabilizer for stabilization], which is [consistent with / atypical for] Schizoaffective Disorder and informs the diagnostic formulation.' },
          { title: 'Functional impact on competency', body: 'Regardless of whether the final diagnosis is Schizoaffective Disorder or a mood disorder with psychotic features, the combined impact of mood dysregulation and psychotic symptoms on the examinee\'s rational understanding, factual understanding, and ability to assist counsel is the critical forensic question. The current symptom severity in both domains [significantly impairs / does not significantly impair] these competency-related abilities.' },
          { title: 'Collateral supports independent psychotic periods', body: 'Collateral informants, including [family members/treatment providers], describe periods during which the examinee exhibited clear psychotic symptoms (e.g., paranoid ideation, auditory hallucinations, disorganized behavior) in the absence of observable mood disturbance. This corroborating information supports the temporal independence of psychotic symptoms required for a Schizoaffective Disorder diagnosis.' },
          { title: 'Substance use complicates differential', body: 'Co-occurring substance use introduces additional complexity into the mood-psychosis differential. Periods of substance use may independently trigger both mood and psychotic symptoms, confounding the assessment of temporal independence. Documented periods of sobriety with persistent symptoms are critical for resolving this differential, and available data [are sufficient / are insufficient] to confidently parse the contributions of substance use versus primary psychiatric illness.' },
        ],
      })
    }

    // Intellectual disability — consider if cognitive testing suggests it or educational history
    if (hasCognitiveHistory || et.includes('fitness')) {
      conditions.push({
        name: 'Intellectual Disability', dsmCode: 'F7x',
        dsmExcerpt: 'Deficits in intellectual functions confirmed by clinical assessment and standardized intelligence testing. Deficits in adaptive functioning. Onset during the developmental period. (DSM-5-TR)',
        relevance: `${hasCognitiveHistory ? `Documented cognitive/neurological history: ${health!.head_injuries}.` : 'Cognitive functioning is relevant to competency determination.'} WAIS-V results should be reviewed for full-scale and index-level performance.`,
        dataSummary: `WAIS-V FSIQ and index scores, educational history (${parsedOb.education?.highest_education ?? 'not documented'}), adaptive functioning observations from interview and collateral.`,
        contradictingData: `If WAIS-V scores fall within normal limits and educational/occupational history demonstrates age-appropriate functioning, intellectual disability is not supported.`,
        templateOptions: [
          { title: 'Full criteria met — ID confirmed', body: 'Cognitive testing results (WAIS-V FSIQ in the [specify range]) combined with documented deficits in adaptive functioning and a developmental period onset are consistent with a diagnosis of Intellectual Disability. Educational records, vocational history, and collateral informant reports corroborate longstanding deficits in conceptual, social, and practical adaptive domains. This diagnosis is directly relevant to the competency determination, as intellectual deficits may impair the examinee\'s ability to understand legal concepts and assist counsel.' },
          { title: 'Borderline cognitive functioning — not ID', body: 'Cognitive scores fall in the borderline range (FSIQ 70-84), which does not meet the intellectual functioning criterion for Intellectual Disability but represents meaningfully reduced cognitive capacity. This level of functioning is relevant to the competency question, as the examinee may require simplified communication, additional time, and concrete explanations to participate meaningfully in proceedings. Adaptive functioning is [consistent with / better than expected for] the measured cognitive level.' },
          { title: 'Scores normal — ID not supported', body: 'Cognitive testing yields scores within the normal range across all index domains. The intellectual functioning criterion for Intellectual Disability is not met. Educational and occupational history further demonstrate age-appropriate cognitive capacity. This condition is ruled out as a contributor to any competency-related deficits.' },
          { title: 'Effort concerns compromise interpretation', body: 'Performance on effort testing raises concern for suboptimal engagement during cognitive assessment. Measured cognitive scores may underestimate the examinee\'s true abilities, and a diagnosis of Intellectual Disability cannot be reliably established in the context of questionable effort. Readministration under conditions of adequate motivation may be warranted before drawing diagnostic conclusions.' },
          { title: 'Adaptive functioning deficits exceed IQ prediction', body: 'Adaptive functioning deficits documented through collateral reports and behavioral observation exceed what would be predicted by measured intellectual ability alone. This discrepancy may reflect comorbid conditions (e.g., psychotic disorder, autism spectrum features) or environmental factors that compound the impact of cognitive limitations on daily functioning. The adaptive deficit profile is relevant to competency regardless of whether formal ID criteria are fully met.' },
          { title: 'Mild severity — can assist with accommodations', body: 'The pattern of results is consistent with Mild Intellectual Disability. The examinee demonstrates the capacity to acquire basic academic skills, communicate needs, and manage routine daily activities with support. With appropriate accommodations — including simplified legal language, visual aids, and extended preparation time — the examinee may be capable of achieving sufficient understanding to participate in proceedings. Specific accommodation recommendations are provided.' },
          { title: 'Moderate-severe — significant competency implications', body: 'Cognitive testing and adaptive functioning data are consistent with [Moderate/Severe] Intellectual Disability. Deficits in abstract reasoning, comprehension of complex information, and independent decision-making are profound and raise serious questions about the examinee\'s capacity to achieve a rational and factual understanding of proceedings, even with accommodation and competency restoration efforts. The likelihood of successful restoration should be addressed explicitly.' },
          { title: 'Educational history corroborates developmental onset', body: 'Educational records document placement in special education services beginning at age [X], individualized education plans targeting [academic/behavioral/adaptive] goals, and [completion of / failure to complete] a modified curriculum. This documented history of developmental-period onset corroborates the current cognitive testing and supports a longstanding pattern of intellectual limitation rather than an acquired cognitive deficit.' },
          { title: 'Comorbid psychiatric condition complicates picture', body: 'The examinee presents with both intellectual limitations and a co-occurring psychiatric condition [specify], which independently and synergistically impact competency-related abilities. The relative contributions of cognitive deficits versus psychiatric symptoms to the observed functional impairments must be carefully parsed, as they have different implications for treatment and restorability.' },
          { title: 'Cultural/linguistic factors require cautious interpretation', body: 'The examinee\'s cultural and linguistic background introduces potential confounds in interpreting standardized cognitive testing. Measured scores should be interpreted cautiously, with appropriate consideration of [limited English proficiency / limited formal education / cultural factors affecting test-taking behavior]. Nonverbal indices and behavioral observations may provide a more accurate estimate of intellectual functioning than the Full Scale IQ in this case.' },
        ],
      })
    }

    // Substance-induced — if substance use reported
    if (hasSubstance) {
      conditions.push({
        name: 'Substance-Induced Psychotic Disorder', dsmCode: 'F1x.x59',
        dsmExcerpt: 'Prominent hallucinations or delusions that developed during or soon after substance intoxication or withdrawal, and the substance is capable of producing these symptoms. Not better explained by an independent psychotic disorder. (DSM-5-TR)',
        relevance: `Active substance use is documented: ${[substance?.alcohol_use, substance?.drug_use].filter(has).join('; ')}. The temporal relationship between substance use and psychotic symptoms must be established.`,
        dataSummary: `Substance timeline relative to symptom onset, toxicology if available, periods of sobriety with/without symptom persistence, and collateral reports of substance use patterns.`,
        contradictingData: `If psychotic symptoms persist during documented periods of abstinence, a substance-induced etiology is unlikely. If symptoms clearly predate substance use onset, an independent psychotic disorder is more likely.`,
        templateOptions: [
          { title: 'Substance-induced etiology supported', body: 'The temporal relationship between substance use and psychotic symptom onset supports a substance-induced etiology. Psychotic symptoms emerged in the context of active substance use and available data indicate symptom remission during documented periods of abstinence. The substance(s) involved ([specify]) are pharmacologically capable of producing psychotic symptoms, and the clinical presentation is consistent with a substance-induced psychotic disorder rather than an independent psychotic illness.' },
          { title: 'Independent psychotic disorder more likely', body: 'Although substance use is documented, psychotic symptoms appear to persist independently of substance use status. Treatment records and collateral reports indicate that hallucinations and/or delusional thinking continued during periods of verified sobriety, suggesting an independent psychotic disorder rather than a purely substance-induced condition. Substance use may exacerbate but does not fully account for the psychotic presentation.' },
          { title: 'Temporal relationship unclear — insufficient sobriety data', body: 'The differential between substance-induced and independent psychotic disorder cannot be confidently resolved based on available data. There are no well-documented periods of sustained sobriety during which the presence or absence of psychotic symptoms was clinically assessed. Longitudinal observation in a controlled setting may be necessary to establish whether psychotic symptoms persist independent of substance use.' },
          { title: 'Methamphetamine-induced psychosis pattern', body: 'The clinical presentation is consistent with methamphetamine-induced psychotic disorder, characterized by prominent paranoid ideation, persecutory delusions, and tactile/auditory hallucinations emerging in the context of chronic stimulant use. This substance-specific pattern is well-documented in the literature and typically resolves with sustained abstinence, though resolution may require weeks to months following cessation. The time course of symptom resolution will be diagnostically informative.' },
          { title: 'Cannabis-associated psychosis — primary disorder risk', body: 'Psychotic symptoms emerged in the context of heavy cannabis use. The relationship between cannabis and psychosis is complex — cannabis can trigger psychotic episodes in individuals with genetic vulnerability and may represent either a substance-induced condition or the unmasking of an independent psychotic disorder. The examinee\'s age of onset, family psychiatric history, and symptom trajectory will inform this differentiation over time.' },
          { title: 'Dual diagnosis — co-occurring independent disorders', body: 'Clinical data suggest that both an independent psychotic disorder and a substance use disorder are present and interacting. Psychotic symptoms appear to predate the onset of substance use, and substance use exacerbates but did not initiate the psychotic illness. Both conditions require independent treatment attention, and competency restoration planning should address both substance use and psychotic symptom management.' },
          { title: 'Withdrawal-related psychosis', body: 'The timing of psychotic symptom onset is consistent with a withdrawal-related psychotic episode rather than intoxication-related psychosis. Symptoms emerged during the acute withdrawal period following cessation of [specify substance], which is consistent with the known withdrawal syndrome for this substance class. Medical monitoring during withdrawal and appropriate pharmacological management are recommended.' },
          { title: 'Polysubstance use complicates attribution', body: 'The examinee\'s polysubstance use pattern makes it difficult to attribute psychotic symptoms to any single substance. Multiple substances used concurrently or in close temporal proximity are each capable of producing psychotic features. For diagnostic and treatment purposes, the substance-induced etiology is supported in aggregate, but the specific causative agent cannot be isolated with certainty.' },
          { title: 'Competency implications — expected course', body: 'If the psychotic presentation is primarily substance-induced, the expected course with sustained abstinence is [favorable/guarded] for symptom resolution. Competency restoration efforts should prioritize substance use treatment alongside symptom monitoring. The examinee should be reassessed after a period of documented sobriety to determine whether psychotic symptoms have resolved and competency has been restored.' },
          { title: 'Prior episodes resolve with sobriety — pattern established', body: 'Review of the longitudinal history reveals a pattern of psychotic episodes occurring exclusively during active substance use, with documented symptom resolution during prior periods of sobriety. This established pattern strongly supports a substance-induced etiology and argues against an independent psychotic disorder. This historical pattern is the strongest diagnostic evidence available for this differentiation.' },
        ],
      })
    }

    // Malingering — always considered in forensic CST context
    conditions.push({
      name: 'Malingering', dsmCode: 'Z76.5 (not a mental disorder)',
      dsmExcerpt: 'Intentional production of false or grossly exaggerated symptoms motivated by external incentives. Strongly suspect when: medicolegal context of presentation, marked discrepancy between claimed disability and objective findings, lack of cooperation during evaluation, or presence of Antisocial Personality Disorder. (DSM-5-TR)',
      relevance: `Forensic competency evaluation inherently involves external incentive (avoidance of criminal prosecution). ${intakeRow?.charges ? `Pending charges: ${intakeRow.charges}.` : ''} Malingering must be assessed in all forensic contexts regardless of clinical presentation.`,
      dataSummary: `SIRS-2 profile: ${stageIndex >= 2 ? 'scored — review classification' : 'pending'}. TOMM effort testing: ${stageIndex >= 2 ? 'scored — review trial data' : 'pending'}. MMPI-3 validity scales (F, Fp, FBS): ${stageIndex >= 2 ? 'review over-reporting indicators' : 'pending'}. Cross-method symptom consistency from interview.`,
      contradictingData: `If SIRS-2 classifies as genuine, TOMM passes effort threshold, and MMPI-3 validity scales are within acceptable limits, malingering is not supported. Consistent symptom presentation across methods further argues against feigning.`,
      templateOptions: [
        { title: 'Credible presentation — no feigning indicators', body: 'Validity testing across multiple instruments is consistent with a credible clinical presentation. SIRS-2 classification falls in the genuine range, TOMM performance exceeds the established cutoff for adequate effort, and MMPI-3 validity scales (F, Fp, FBS) are within acceptable limits. Cross-method consistency between self-report, structured interview, and behavioral observation further supports the credibility of the reported symptom profile. Malingering is not indicated.' },
        { title: 'Mild over-reporting — interpret with caution', body: 'Some validity indicators are mildly elevated, suggesting a tendency toward symptom over-reporting or exaggeration that does not rise to the level of definitive malingering. This pattern may reflect a genuine cry for help, limited psychological sophistication in describing symptoms, or mild exaggeration of real distress. Clinical findings from self-report measures should be interpreted conservatively, with greater weight given to behavioral observations and structured interview data.' },
        { title: 'Strong feigning indicators — symptom credibility compromised', body: 'Multiple validity indicators across instruments converge on a pattern strongly suggestive of feigned or grossly exaggerated symptomatology. SIRS-2 classifies the presentation in the [probable/definite] feigning range, TOMM performance falls below the cutoff for adequate effort, and MMPI-3 over-reporting scales are clinically elevated. The clinical findings from self-report measures cannot be considered reliable indicators of genuine psychopathology and should be interpreted in this context.' },
        { title: 'Inconsistent presentation across methods', body: 'Significant inconsistencies were observed between the examinee\'s self-reported symptoms and behavioral presentation during the evaluation. Symptoms endorsed on structured instruments were not corroborated by mental status examination findings, and the pattern of reported impairment is not consistent with known clinical presentations of the claimed condition. This cross-method inconsistency raises concern for symptom fabrication or exaggeration.' },
        { title: 'External incentive is prominent', body: 'The evaluative context presents a clear and powerful external incentive for symptom fabrication or exaggeration. The examinee faces [serious criminal charges / potential incarceration / forensic commitment] and a finding of incompetence would [delay proceedings / result in treatment rather than prosecution]. While external incentive alone does not establish malingering, it is a necessary consideration per DSM-5-TR and elevates the importance of empirically validated validity testing in this case.' },
        { title: 'Selective symptom endorsement pattern', body: 'The examinee endorsed an unusual pattern of symptoms characterized by [rare symptom combinations / improbable symptoms / obvious symptoms with no subtle ones / dramatic presentation inconsistent with known disorders]. This selective endorsement pattern is inconsistent with genuine psychopathology and is more consistent with a naive attempt to present as mentally ill. The symptom profile does not map onto any recognized diagnostic entity.' },
        { title: 'Coaching or preparation suspected', body: 'Elements of the clinical presentation suggest possible coaching or prior preparation for the evaluation. The examinee demonstrated [rehearsed responses / knowledge of specific test strategies / sudden onset of symptoms coinciding with legal proceedings / symptom presentation that shifted when validity measures were administered]. While not conclusive, these observations are noted and considered in the overall credibility assessment.' },
        { title: 'Partial malingering — genuine condition with exaggeration', body: 'The data pattern is most consistent with partial malingering — the exaggeration or embellishment of genuine psychiatric symptoms. The examinee likely does experience some degree of [specify: mood disturbance / anxiety / cognitive difficulty], but the severity and functional impact are overstated relative to what objective testing and behavioral observation support. Clinical formulations should be based on the probable genuine baseline rather than the exaggerated self-report.' },
        { title: 'Effort adequate despite forensic context', body: 'Despite the inherent external incentive present in this forensic evaluation, the examinee demonstrated adequate effort on validity testing and maintained a consistent and clinically coherent symptom presentation. This is noteworthy and supports the authenticity of the clinical picture. The presence of a forensic context alone does not impugn symptom credibility when validity measures are passed.' },
        { title: 'Validity testing inconclusive — mixed indicators', body: 'Validity testing produced a mixed profile that does not clearly resolve the question of symptom credibility. Some indicators suggest adequate effort and genuine responding, while others show mild elevations in the over-reporting direction. This pattern may reflect genuine distress combined with unsophisticated self-reporting, or it may represent a partially successful attempt at symptom exaggeration. Clinical conclusions should be drawn primarily from sources less susceptible to manipulation, including behavioral observation and collateral data.' },
        { title: 'Malingered incompetence vs. malingered symptoms', body: 'An important distinction exists between malingering psychiatric symptoms and malingering incompetence to stand trial. The examinee may [report genuine symptoms while exaggerating incompetence / feign psychiatric symptoms to support an incompetency finding / genuinely lack understanding that appears strategic]. The validity assessment addresses symptom credibility; the competency determination requires separate analysis of whether genuine or feigned symptoms actually impair the specific functional abilities required for competency.' },
      ],
    })
  }

  // ─────────────────────────────────────────────────
  // Custody evaluations
  // ─────────────────────────────────────────────────
  else if (et.includes('custody')) {
    const hasDepressiveFeatures = has(mental?.previous_treatment) || has(mental?.previous_diagnoses) || has(health?.sleep_quality)
    const hasPersonalityData = stageIndex >= 2 // MCMI scored
    const hasSubstance = has(substance?.alcohol_use) || has(substance?.drug_use)

    if (hasDepressiveFeatures) {
      conditions.push({
        name: 'Major Depressive Disorder', dsmCode: 'F33.x',
        dsmExcerpt: 'Five or more symptoms during the same 2-week period representing a change from previous functioning; at least one is depressed mood or loss of interest/pleasure. Symptoms cause clinically significant distress or impairment. (DSM-5-TR 296.xx)',
        relevance: `Clinical history suggests depressive features. ${has(mental?.previous_diagnoses) ? `Prior diagnoses: ${mental!.previous_diagnoses}.` : ''} ${has(mental?.previous_treatment) ? `Treatment history: ${mental!.previous_treatment}.` : ''} ${has(health?.sleep_quality) ? `Sleep disturbance reported: ${health!.sleep_quality}.` : ''}`,
        dataSummary: `MMPI-3 depression scales (RC2, RCd), MCMI-IV clinical scales, interview mood assessment, appetite/weight changes (${health?.appetite_weight ?? 'not assessed'}), functional impairment.`,
        contradictingData: `If symptoms are temporally limited to the custody proceedings and do not meet 2-week duration/severity criteria, Adjustment Disorder is more appropriate. If testing mood scales are within normal limits, a clinical mood disorder may not be present.`,
        templateOptions: [
          { title: 'MDD confirmed — predates custody stressor', body: 'Clinical data including self-report, psychometric testing, and behavioral observation are consistent with Major Depressive Disorder meeting full DSM-5-TR duration and severity criteria. Importantly, the depressive episode predates the onset of custody proceedings, indicating that the mood disorder is not merely a reaction to the current legal stressor. The impact of MDD on parenting capacity, emotional availability, and daily functioning is addressed in the parenting assessment section.' },
          { title: 'Depressive features — adjustment disorder more likely', body: 'Depressive features are present and acknowledged by the examinee; however, symptom onset is temporally linked to the initiation of custody proceedings, and the severity and duration do not clearly meet full criteria for Major Depressive Disorder. The clinical picture is more consistent with an Adjustment Disorder with depressed mood, reflecting a proportionate emotional response to a significant psychosocial stressor. This distinction has implications for prognosis and treatment recommendations.' },
          { title: 'No clinical depression — proportionate distress', body: 'Testing and clinical interview data do not support a clinical depressive disorder. The examinee reports some mood-related concerns; however, these appear proportionate to the current life circumstances, including the stress of custody litigation. MMPI-3 depression scales fall within normal limits, and behavioral observations during the evaluation are inconsistent with a clinical mood disorder.' },
          { title: 'Recurrent MDD — established pattern', body: 'The examinee has a documented history of recurrent Major Depressive Disorder, with the current episode representing the [number]th documented episode. Prior episodes have been treated with [medication/therapy], with [partial/full] response. The recurrent nature of the illness is relevant to the long-term parenting assessment, as it introduces a probabilistic risk of future episodes that may temporarily impact parenting capacity.' },
          { title: 'MDD with impact on parenting capacity', body: 'The current depressive episode is associated with observable deficits in energy, motivation, concentration, and emotional responsiveness that are relevant to parenting capacity. The examinee reports difficulty maintaining consistent routines, reduced patience with the child(ren), and withdrawal from activities previously shared with the child(ren). These functional impairments are directly relevant to the best-interest analysis and are amenable to treatment.' },
          { title: 'MDD in remission — not currently impairing', body: 'The examinee has a documented history of Major Depressive Disorder that is currently in partial or full remission, either through ongoing treatment or spontaneous recovery. Current testing and interview do not reveal active symptoms meeting diagnostic threshold. The historical diagnosis is noted but does not represent a current impairment to parenting capacity. Continued treatment adherence is recommended as a protective factor.' },
          { title: 'Examinee minimizing — testing suggests more impairment', body: 'The examinee presented as minimally distressed during the clinical interview; however, psychometric testing reveals clinically significant elevations on depression-related scales that are inconsistent with the self-presentation. This discrepancy may reflect a defensive test-taking approach motivated by the evaluative context, emotional suppression as a coping style, or limited insight into the severity of the mood disturbance. The testing data are weighted in this formulation.' },
          { title: 'Suicide risk factors warrant monitoring', body: 'In addition to meeting criteria for Major Depressive Disorder, the examinee endorses [hopelessness/passive suicidal ideation/prior attempts/other risk factors] that warrant clinical attention. While this evaluation is not a suicide risk assessment per se, these factors are relevant to parenting in that they indicate a level of psychiatric severity requiring active treatment and monitoring. Appropriate safety recommendations are included.' },
          { title: 'Depression secondary to domestic violence', body: 'The depressive presentation appears closely linked to the examinee\'s reported history of domestic violence within the marital relationship. Symptoms of helplessness, low self-worth, hypervigilance, and social withdrawal are consistent with both MDD and the psychological sequelae of intimate partner violence. This etiological context is important for treatment planning and for understanding the examinee\'s presentation within the custody evaluation.' },
          { title: 'Comorbid anxiety amplifies functional impact', body: 'Major Depressive Disorder co-occurs with significant anxiety symptoms, creating a combined clinical picture that has a greater functional impact than either condition alone. The examinee reports [rumination, indecisiveness, worry about custody outcome, sleep disruption] that interfere with daily parenting tasks. Treatment addressing both mood and anxiety domains is likely to produce the most meaningful improvement in parenting-related functioning.' },
        ],
      })
    }

    // Adjustment disorder — likely in custody context
    conditions.push({
      name: 'Adjustment Disorder', dsmCode: 'F43.2x',
      dsmExcerpt: 'Emotional or behavioral symptoms in response to an identifiable stressor within 3 months of onset. Clinically significant as evidenced by marked distress or significant impairment. Does not meet criteria for another mental disorder and is not merely an exacerbation of a preexisting condition. (DSM-5-TR 309.x)',
      relevance: `Custody proceedings constitute a major psychosocial stressor. Onset: ${complaints?.onset_timeline ?? 'review intake'}. Current stressors: ${parsedOb.recent?.current_stressors ?? 'not documented'}.`,
      dataSummary: `Symptom onset relative to stressor, prior baseline functioning, proportionality of symptoms to stressor severity, and whether full criteria for a more specific disorder (MDD, GAD) are met.`,
      contradictingData: `${hasDepressiveFeatures ? 'If depressive symptoms meet full MDD criteria independently of the stressor, Adjustment Disorder would not apply — a more specific diagnosis takes precedence.' : 'If no clinically significant distress or impairment is documented, Adjustment Disorder is not warranted.'}`,
      templateOptions: [
        { title: 'Adjustment disorder confirmed — custody stressor', body: 'The examinee\'s emotional and behavioral symptoms are temporally linked to the onset of custody proceedings and are consistent with an Adjustment Disorder with [depressed mood/anxiety/mixed anxiety and depressed mood/disturbance of conduct]. Symptoms are clinically significant, representing distress that exceeds what would be expected given the stressor, but do not meet criteria for a more specific diagnosis such as Major Depressive Disorder or Generalized Anxiety Disorder. Prognosis is favorable with resolution of the stressor and/or appropriate therapeutic support.' },
        { title: 'Symptoms exceed adjustment — more specific dx warranted', body: 'While the symptom onset is temporally related to the custody proceedings, the severity, duration, and pervasiveness of the clinical presentation exceed what would be expected for an Adjustment Disorder. The symptom profile more closely approximates criteria for [Major Depressive Disorder/Generalized Anxiety Disorder], and the more specific diagnosis should take diagnostic precedence per DSM-5-TR convention.' },
        { title: 'Expected stress response — not clinically significant', body: 'The examinee reports emotional distress related to the custody proceedings; however, the level of distress observed and reported does not rise to the level of clinical significance required for an Adjustment Disorder diagnosis. The emotional response appears proportionate to the gravity of the situation and does not demonstrate marked distress beyond what would be expected or significant impairment in functioning.' },
        { title: 'Parenting impact is transient and situation-specific', body: 'The adjustment reaction has produced some transient effects on parenting-related functioning, including [reduced patience, difficulty with routines, emotional reactivity in front of the child(ren)]. These impairments appear directly tied to the custody litigation stressor and are expected to improve as the legal process resolves. They do not reflect a stable impairment in parenting capacity and should be distinguished from characterological or chronic limitations.' },
        { title: 'High-conflict custody amplifying symptoms', body: 'The adjustment symptoms are being actively maintained and amplified by the high-conflict nature of the custody dispute itself. Ongoing litigation, contentious communication with the co-parent, and uncertainty about the outcome are functioning as chronic re-stressors that prevent natural symptom resolution. Reduction in interpersonal conflict and establishment of a stable custody arrangement would likely be the most effective intervention.' },
        { title: 'Adjustment disorder with behavioral disturbance', body: 'The examinee\'s adjustment reaction has manifested primarily in behavioral terms, including [poor judgment in communication with co-parent, boundary violations, impulsive decision-making, violation of court orders]. While the underlying emotional distress is understandable, the behavioral expression raises concerns relevant to the custody determination and suggests a need for structured intervention to improve coping and decision-making during the litigation period.' },
        { title: 'Pre-existing vulnerability amplifying reaction', body: 'The examinee\'s adjustment reaction is occurring in the context of pre-existing psychological vulnerability, including [prior mood episodes, personality features, limited coping resources, minimal social support]. While the current symptoms are primarily adjustment-related, the underlying vulnerability increases the risk of a more severe psychiatric decompensation and suggests that prophylactic therapeutic support is warranted.' },
        { title: 'Children\'s adjustment should be considered', body: 'It is noted that the examinee\'s adjustment reaction to the custody proceedings may have secondary effects on the child(ren)\'s adjustment and emotional well-being. The parent\'s emotional availability, consistency, and ability to shield the child(ren) from adult conflict during this period are relevant considerations in the best-interest analysis, independent of the parent\'s own diagnostic status.' },
        { title: 'Prior adjustment to divorce was adaptive', body: 'The examinee demonstrates a history of adaptive coping with prior significant stressors, including [the separation, relocation, financial changes]. The current adjustment reaction appears to be a time-limited response to the escalation of custody litigation rather than a pattern of chronic maladjustment. This adaptive history is a protective factor in the parenting assessment.' },
        { title: 'Malingered or exaggerated adjustment symptoms', body: 'Consideration is given to the possibility that the examinee is presenting or exaggerating adjustment-related symptoms to create a favorable impression in the custody evaluation — either to appear as a sympathetic victim or to attribute impairment to the co-parent\'s behavior. Validity testing and cross-method consistency [support the credibility of the presentation / raise some concern about the authenticity of reported distress].' },
      ],
    })

    if (hasPersonalityData) {
      conditions.push({
        name: 'Personality Disorder Features', dsmCode: 'F60.x',
        dsmExcerpt: 'An enduring pattern of inner experience and behavior that deviates markedly from cultural expectations, manifested in 2+ of: cognition, affectivity, interpersonal functioning, impulse control. The pattern is inflexible and pervasive, leads to distress or impairment, is stable/longstanding, and not better explained by another disorder. (DSM-5-TR)',
        relevance: `MCMI-IV and MMPI-3 personality scales have been administered and scored. Personality assessment is standard in custody evaluations to evaluate interpersonal functioning, emotional regulation, and parenting-relevant traits.`,
        dataSummary: `MCMI-IV personality scales — review elevation patterns and BR scores. MMPI-3 RC and PSY-5 scales. Interview: relationship history, interpersonal patterns, emotional regulation, conflict style.`,
        contradictingData: `If personality scales are within normal limits and no pervasive maladaptive pattern is documented across multiple data sources, personality pathology is not indicated. Situational stress can temporarily elevate personality scales without reflecting enduring traits.`,
        templateOptions: [
          { title: 'Clinically significant personality features identified', body: 'Personality testing reveals clinically significant elevations consistent with maladaptive personality features, specifically [Cluster B traits / narcissistic features / borderline features / antisocial features / dependent features]. These characterological patterns are relevant to parenting capacity assessment, as they impact interpersonal functioning, emotional regulation, co-parenting cooperation, and the ability to prioritize the child(ren)\'s needs over the parent\'s own emotional needs. The pervasive and enduring nature of these traits suggests they are unlikely to change substantially without sustained therapeutic intervention.' },
          { title: 'Testing within normal limits — no personality pathology', body: 'Personality testing, including MCMI-IV clinical and personality pattern scales, falls within normal limits. No clinically significant personality pathology is indicated. The examinee demonstrates adequate emotional regulation, interpersonal flexibility, and impulse control as measured by standardized instruments and corroborated by behavioral observation during the evaluation.' },
          { title: 'Elevations present but context-inflated', body: 'Personality scale elevations are noted on the MCMI-IV; however, these should be interpreted cautiously given the acute stress of the custody proceedings and the evaluative context, both of which are known to inflate trait-like measures on personality instruments. The elevations may reflect state-dependent distress rather than enduring characterological dysfunction. Longitudinal data, including collateral reports and functioning outside the litigation context, would help clarify whether these represent stable personality traits.' },
          { title: 'Narcissistic features — impact on co-parenting', body: 'Testing and interview data are consistent with narcissistic personality features, including a pervasive pattern of grandiosity, need for admiration, and limited empathy. In the custody context, these features are most relevant to the examinee\'s capacity for genuine co-parenting, ability to acknowledge the other parent\'s relationship with the child(ren), and willingness to support the child(ren)\'s autonomy rather than viewing them as extensions of self. These features are associated with high-conflict co-parenting dynamics.' },
          { title: 'Borderline features — emotional dysregulation concerns', body: 'The personality assessment reveals borderline personality features characterized by emotional instability, fear of abandonment, identity disturbance, and impulsive behavior. These features have direct relevance to parenting capacity, as they may contribute to inconsistent emotional availability, difficulty maintaining stable routines, boundary violations with the child(ren), and the potential to involve the child(ren) in adult emotional conflicts. The custody evaluator should assess whether these features are being effectively managed with treatment.' },
          { title: 'Antisocial features — rule-violation pattern', body: 'Personality testing and historical data indicate antisocial personality features, including a pattern of disregard for rules and social norms, deceitfulness, and limited remorse. In the custody context, these features are relevant to the examinee\'s ability to model prosocial behavior, maintain truthful communication with the court and co-parent, and comply with custody orders and parenting plans. The examinee\'s criminal history [corroborates / is inconsistent with] the testing findings.' },
          { title: 'Dependent features — enmeshment risk', body: 'Testing suggests dependent personality features, including excessive need for reassurance, difficulty making independent decisions, and fear of separation. In the parenting context, these features may manifest as enmeshment with the child(ren), difficulty supporting age-appropriate autonomy, and reliance on the child(ren) for emotional support (parentification). The evaluator should assess the quality of parent-child boundaries.' },
          { title: 'Defensive profile — personality assessment limited', body: 'The examinee produced a highly defensive personality testing profile, with significant minimization and social desirability responding. The resulting personality scale scores may significantly underestimate the presence of maladaptive traits. Behavioral observations and collateral data should be weighted more heavily than self-report testing in assessing personality functioning for this examinee.' },
          { title: 'Personality features stable — treatment prognosis guarded', body: 'The identified personality features are characterological in nature, reflecting longstanding and deeply ingrained patterns of thinking, feeling, and relating to others. Per the DSM-5-TR criteria for personality disorders, these patterns are inflexible and pervasive, and they are unlikely to change substantially without intensive, sustained therapeutic intervention (e.g., DBT, schema therapy). Treatment prognosis for personality-level change is guarded and should be factored into long-term custody planning.' },
          { title: 'Personality strengths noted alongside concerns', body: 'While certain personality features raise concern, the assessment also identifies personality strengths relevant to parenting, including [conscientiousness, warmth, resilience, strong work ethic, social engagement]. A balanced formulation recognizes both the areas of concern and the adaptive personality resources the examinee brings to the parenting role. Recommendations should build on identified strengths while addressing areas of vulnerability.' },
        ],
      })
    }

    if (hasSubstance) {
      conditions.push({
        name: 'Substance Use Disorder', dsmCode: 'F1x.x',
        dsmExcerpt: 'A problematic pattern of use leading to clinically significant impairment or distress, as manifested by 2+ of 11 criteria within a 12-month period. Severity: Mild (2-3), Moderate (4-5), Severe (6+). (DSM-5-TR)',
        relevance: `Substance use is documented and is relevant to parenting capacity assessment. Alcohol: ${substance?.alcohol_use ?? '—'}. Drugs: ${substance?.drug_use ?? '—'}.`,
        dataSummary: `Self-report quantity/frequency, collateral reports, impact on parenting or daily functioning, treatment history: ${substance?.substance_treatment ?? 'none reported'}.`,
        contradictingData: `If use is infrequent and no functional impairment or parenting impact is documented, diagnostic threshold may not be met. Self-report minimization is common in custody evaluations.`,
        templateOptions: [
          { title: 'SUD confirmed — parenting impact documented', body: 'Reported substance use patterns, functional impact, and collateral data are consistent with a Substance Use Disorder ([specify substance], [mild/moderate/severe] severity). The substance use has demonstrable impact on parenting capacity, including [impaired supervision, inconsistent routines, exposure of child(ren) to substance use behavior, driving under the influence with child(ren) present]. Treatment recommendations are directly tied to custody considerations.' },
          { title: 'Use documented but below diagnostic threshold', body: 'Substance use is documented and acknowledged by the examinee; however, the pattern does not clearly meet the DSM-5-TR diagnostic threshold of two or more criteria within a 12-month period. Current use appears [recreational/social/infrequent] without documented functional impairment or impact on parenting. This finding does not preclude monitoring, as self-report minimization is common in custody evaluations.' },
          { title: 'Active SUD — safety concerns for child(ren)', body: 'The examinee meets criteria for an active Substance Use Disorder that raises specific safety concerns for the child(ren). These include [unsupervised access while intoxicated, impaired judgment affecting child safety decisions, exposing child(ren) to drug-related activity or individuals, DUI incidents with child(ren) present]. Structured safety measures, including [drug testing, supervised visitation, substance abuse treatment] should be considered as conditions of custody or visitation.' },
          { title: 'SUD in sustained remission', body: 'The examinee has a documented history of Substance Use Disorder that is currently in sustained remission, supported by [length of sobriety, treatment completion, ongoing recovery program participation, negative drug screens]. The historical diagnosis is noted as a relevant consideration, but the examinee\'s recovery trajectory represents a positive prognostic indicator for parenting capacity. Continued monitoring and relapse prevention are recommended.' },
          { title: 'Minimization suspected — collateral contradicts self-report', body: 'The examinee\'s self-report of substance use is notably minimal and inconsistent with collateral information, which documents [more frequent use, more problematic consequences, incidents involving child(ren)]. This discrepancy suggests minimization motivated by the evaluative context and raises concern that the true extent of substance involvement may be greater than acknowledged. Collateral data are weighted more heavily in this formulation.' },
          { title: 'Alcohol use in co-parenting conflict context', body: 'Alcohol use has become a focal point of the custody dispute, with the co-parent alleging problematic drinking. The current evaluation finds that the examinee\'s alcohol consumption [meets/does not meet] criteria for an Alcohol Use Disorder. Self-report, collateral, and any available objective data (e.g., EtG testing) are [consistent/inconsistent] with the allegations. Regardless of diagnostic status, the evaluator notes that alcohol use during parenting time is a legitimate custodial concern.' },
          { title: 'Treatment compliance as prognostic indicator', body: 'The examinee has engaged in substance abuse treatment, including [specify: inpatient, outpatient, AA/NA, medication-assisted treatment]. Treatment compliance and engagement are [good/partial/poor], which serves as a prognostic indicator for sustained recovery and, by extension, parenting capacity. The examinee\'s willingness to participate in structured treatment is [a positive indicator / a concern given inconsistent follow-through].' },
          { title: 'Prescription medication misuse', body: 'The substance use concern involves misuse of prescribed medications, specifically [specify: opioids, benzodiazepines, stimulants]. This is distinguished from illicit drug use but carries similar implications for parenting capacity, including impaired alertness, judgment, and responsiveness. The evaluator notes that prescription medication misuse can be more difficult to detect and monitor than illicit substance use, and specific recommendations for medication management are provided.' },
          { title: 'Child(ren) exposed to parental substance use', body: 'Regardless of whether the examinee\'s substance use meets formal diagnostic criteria, collateral information indicates that the child(ren) have been exposed to parental substance use behavior, including [witnessing intoxication, finding substances/paraphernalia, being present during substance-related conflict, parentification due to parent\'s impairment]. The impact of this exposure on the child(ren)\'s emotional well-being and sense of safety is a primary consideration in the custody recommendation.' },
          { title: 'Co-occurring MDD and SUD — integrated treatment needed', body: 'Substance Use Disorder co-occurs with Major Depressive Disorder in this case, and the two conditions appear to reinforce each other — depressive symptoms trigger substance use as a coping mechanism, and substance use exacerbates mood instability. Integrated dual-diagnosis treatment addressing both conditions simultaneously is recommended, as treating either in isolation is unlikely to produce sustained improvement in overall functioning and parenting capacity.' },
        ],
      })
    }
  }

  // ─────────────────────────────────────────────────
  // Risk Assessment
  // ─────────────────────────────────────────────────
  else if (et.includes('risk')) {
    const hasViolence = has(mental?.violence_history)
    const hasCriminal = has(legal?.arrests_convictions)
    const hasSubstance = has(substance?.alcohol_use) || has(substance?.drug_use)

    conditions.push({
      name: 'Antisocial Personality Disorder', dsmCode: 'F60.2',
      dsmExcerpt: 'Pervasive pattern of disregard for and violation of the rights of others since age 15. Three or more of: failure to conform to social norms, deceitfulness, impulsivity, irritability/aggressiveness, reckless disregard for safety, consistent irresponsibility, lack of remorse. Age 18+, evidence of Conduct Disorder before age 15. (DSM-5-TR 301.7)',
      relevance: `Risk assessment context requires evaluation of characterological antisocial patterns. ${hasViolence ? `Violence history: ${mental!.violence_history}.` : ''} ${hasCriminal ? `Criminal history: ${legal!.arrests_convictions}.` : ''} PCL-R results directly inform this consideration.`,
      dataSummary: `PCL-R total and factor scores: ${stageIndex >= 2 ? 'scored — review interpersonal, affective, lifestyle, antisocial facets' : 'pending'}. MMPI-3 antisocial scales. Conduct disorder history before age 15 per interview and records.`,
      contradictingData: `If PCL-R total score is below clinical threshold, criminal history is limited to a single incident, and no pervasive pattern of rights-violation is documented, ASPD criteria are likely not met. ${!hasViolence ? 'No violence history has been documented. ' : ''}Situational criminal behavior does not necessarily reflect a personality disorder.`,
      templateOptions: [
        { title: 'ASPD confirmed — full criteria met', body: 'PCL-R results, criminal history, and the longitudinal behavioral pattern support a diagnosis of Antisocial Personality Disorder. The examinee demonstrates a pervasive pattern of disregard for and violation of the rights of others since at least age 15, with evidence of Conduct Disorder prior to that age documented in [juvenile records/school records/collateral reports]. At least three DSM-5-TR criteria are clearly met, including [specify: failure to conform, deceitfulness, impulsivity, aggressiveness, reckless disregard, irresponsibility, lack of remorse]. This diagnosis has direct and significant implications for the violence risk formulation.' },
        { title: 'Some antisocial features — full pattern not established', body: 'While some antisocial features are present in the behavioral history and testing profile, the full pervasive and enduring pattern required for a diagnosis of Antisocial Personality Disorder is not clearly established across all data sources. The PCL-R total score falls in the [moderate/low] range, and the criterion of onset before age 15 (Conduct Disorder) is [not documented/questionable]. Antisocial traits are noted as relevant to the risk formulation but a categorical ASPD diagnosis is not confirmed.' },
        { title: 'Criminal behavior situational — ASPD not supported', body: 'Available clinical data do not support a diagnosis of Antisocial Personality Disorder. Criminal behavior appears situational rather than reflecting an enduring personality pattern, occurring in the context of [specific circumstances: substance intoxication, peer influence, economic desperation, a single impulsive act]. Interpersonal functioning outside of the index behavior does not demonstrate the pervasive disregard for others\' rights characteristic of ASPD.' },
        { title: 'PCL-R elevated — psychopathic features present', body: 'The PCL-R total score of [score] falls in the [moderate/high] range, with particular elevation on Factor 1 (Interpersonal/Affective) facets. This suggests psychopathic personality features, including superficial charm, grandiosity, pathological lying, lack of empathy, and shallow affect. Psychopathic traits are among the strongest predictors of instrumental violence and have specific implications for risk management, including reduced amenability to standard therapeutic interventions.' },
        { title: 'Factor 2 dominant — lifestyle/antisocial behavior', body: 'The PCL-R profile is characterized by predominant elevation on Factor 2 (Lifestyle/Antisocial) facets, reflecting chronic behavioral instability, impulsivity, irresponsibility, and a persistent pattern of criminal behavior. Factor 1 (Interpersonal/Affective) traits are less prominent, suggesting that the antisocial behavior pattern is driven more by impulsivity and poor self-regulation than by the callous-unemotional traits characteristic of primary psychopathy. This profile has somewhat different risk management implications.' },
        { title: 'Conduct Disorder history confirmed', body: 'Evidence of Conduct Disorder prior to age 15 is clearly documented, including [specify: aggressive behavior toward people/animals, destruction of property, deceitfulness/theft, serious rule violations]. This developmental history meets the DSM-5-TR requirement for an ASPD diagnosis and reflects an early-onset pattern of antisocial behavior that has persisted into adulthood. Early onset is a negative prognostic indicator for behavioral change.' },
        { title: 'ASPD with comorbid SUD — compounding risk', body: 'Antisocial Personality Disorder co-occurs with a Substance Use Disorder, creating a compounding risk profile. Research consistently demonstrates that ASPD with comorbid substance use is associated with higher rates of violent recidivism, poorer treatment outcomes, and greater difficulty with community supervision compliance. Both conditions must be addressed in the risk management plan, with the understanding that substance use may function as a disinhibiting factor that increases the probability of violence in an already high-risk individual.' },
        { title: 'Treatment amenability assessment', body: 'The examinee\'s amenability to treatment is a critical consideration given the ASPD diagnosis. Available data suggest [limited/moderate/uncertain] treatment responsivity based on [prior treatment engagement, motivation for change, capacity for emotional insight, age-related maturation]. Risk management recommendations should be calibrated to the realistic probability of behavioral change, with greater emphasis on external controls for individuals assessed as having low treatment amenability.' },
        { title: 'Age and desistance considerations', body: 'The examinee is [age], and the well-documented phenomenon of age-related desistance from antisocial behavior is relevant to the longitudinal risk assessment. Antisocial behavior, particularly the impulsive/lifestyle dimension, tends to attenuate with age. However, the interpersonal/affective (psychopathic) dimension is more stable. The examinee\'s current behavioral trajectory and the specific PCL-R factor pattern inform whether age-related desistance is likely to meaningfully reduce risk in this case.' },
        { title: 'Institutional vs. community behavior discrepancy', body: 'A notable discrepancy exists between the examinee\'s behavior in structured/institutional settings and behavior in community settings. This pattern is relevant to the risk formulation, as [institutional compliance may reflect external contingency management rather than internalized behavioral change / community dysfunction may reflect lack of external structure rather than characterological deficiency]. Risk management recommendations should account for this discrepancy.' },
      ],
    })

    conditions.push({
      name: 'Structured Violence Risk (HCR-20v3)', dsmCode: 'N/A — risk formulation',
      dsmExcerpt: 'The HCR-20v3 is not a diagnostic tool. It structures professional judgment about violence risk using Historical (10), Clinical (5), and Risk Management (5) factors. The output is a formulated risk level (low/moderate/high) with scenario planning — not an actuarial prediction or a diagnosis.',
      relevance: `Violence risk formulation is the primary purpose of this evaluation. HCR-20v3 provides the framework for integrating all data sources into a structured risk judgment. ${intakeRow?.charges ? `Current charges: ${intakeRow.charges}.` : ''}`,
      dataSummary: `HCR-20v3 factor ratings: ${stageIndex >= 2 ? 'review H, C, R factors' : 'pending'}. ${stageIndex >= 2 ? 'STATIC-99R actuarial estimate (if applicable).' : ''} Dynamic risk factors from clinical interview. Protective factors assessment.`,
      contradictingData: `Risk instruments produce structured judgments, not diagnoses, and are not subject to rule-in/rule-out logic. However, protective factors (stable employment, social support, treatment engagement) may mitigate overall risk formulation.`,
      templateOptions: [
        { title: 'High risk — multiple domains elevated', body: 'Structured professional judgment incorporating historical, clinical, and risk management factors indicates an elevated violence risk profile. Multiple Historical factors are present and immutable, Clinical factors reflect active and poorly managed symptomatology, and Risk Management factors indicate limited viable community supervision options. Specific risk scenarios, including [most likely, worst case, and escalation pathway scenarios], have been formulated with corresponding management recommendations. The overall risk judgment is HIGH for future violence.' },
        { title: 'Moderate risk — dynamic factors amenable to intervention', body: 'The HCR-20v3 assessment indicates a moderate level of concern for future violence. While Historical factors establish a baseline of elevated risk, the Clinical and Risk Management domains contain dynamic factors that are amenable to intervention. Specifically, [active mental illness, substance use, insight deficits, treatment noncompliance] are currently contributing to risk but could be reduced with appropriate intervention. Risk management recommendations target these modifiable factors.' },
        { title: 'Low-to-moderate risk — protective factors established', body: 'Current assessment reflects a low-to-moderate risk profile. While some Historical factors are present, protective factors are well-established, including [stable employment/housing, prosocial relationships, treatment engagement, absence of recent violence, aging]. The Clinical factor profile reflects [managed/stable] symptomatology, and Risk Management factors indicate [adequate supervision resources, treatment compliance, social support]. The risk judgment is LOW-TO-MODERATE with current protective factors maintained.' },
        { title: 'Historical factors establish baseline risk', body: 'The Historical (H) scale of the HCR-20v3 documents immutable risk factors that establish the baseline risk level for this individual. Key historical factors rated as Present include [H1: Violence, H2: Other Antisocial Behavior, H3: Relationships, H4: Employment, H5: Substance Use, H6: Major Mental Disorder, H7: Personality Disorder, H8: Traumatic Experiences, H9: Violent Attitudes, H10: Treatment Response]. These factors cannot be changed but inform the level of risk management intensity required.' },
        { title: 'Clinical factors — active destabilizers identified', body: 'The Clinical (C) scale identifies current, dynamic factors that may actively increase violence risk. Key elevations include [C1: Insight (poor), C2: Violent Ideation/Intent, C3: Symptoms of Major Mental Disorder, C4: Instability, C5: Treatment/Supervision Response (noncompliant)]. These factors represent current destabilizers that, if addressed through targeted intervention, could meaningfully reduce the overall risk level. Clinical factor management should be the primary focus of the risk management plan.' },
        { title: 'Risk management factors — supervision planning', body: 'The Risk Management (R) scale evaluates the quality and feasibility of future supervision and intervention plans. Current assessment indicates [R1: Professional Services (available/limited), R2: Living Situation (stable/unstable), R3: Personal Support (present/absent), R4: Treatment/Supervision Response (likely compliant/noncompliant), R5: Stress/Coping (manageable/overwhelmed)]. These factors directly inform the specificity of release and community supervision recommendations.' },
        { title: 'Risk scenario — most likely violence pattern', body: 'Based on integration of all HCR-20v3 factors and case-specific data, the most likely violence scenario involves [describe: the nature of violence (physical assault, threats, domestic violence, weapon use), the most likely victim(s), the situational triggers (substance use, interpersonal conflict, treatment discontinuation, psychotic decompensation), the temporal context, and the severity]. This scenario informs targeted prevention and management strategies.' },
        { title: 'Protective factors reduce overall risk judgment', body: 'Several protective factors mitigate the risk indicated by the HCR-20v3 factor ratings. These include [genuine motivation for change, strong family support, stable employment, absence of violence for extended period, demonstrated treatment response, prosocial peer network, aging effects]. These protective factors are weighted in the overall structured professional judgment and result in a risk rating that is [lower than/consistent with] what the factor count alone would suggest.' },
        { title: 'Conditional risk — substance use as key trigger', body: 'The violence risk is strongly conditional on substance use status. Historical analysis reveals that all or most prior violent incidents occurred in the context of substance intoxication, and periods of sobriety have been associated with absence of aggressive behavior. The risk level is materially different when the examinee is actively using substances versus maintaining sobriety. Risk management must therefore prioritize substance use monitoring and treatment as the primary violence prevention strategy.' },
        { title: 'Institutional vs. community risk differential', body: 'The risk formulation must account for the significant difference between institutional and community risk. The examinee\'s risk level in a structured, supervised environment is [lower/similar] to the community risk. Transition planning from institutional to community settings represents a period of elevated risk, as external controls are reduced and environmental stressors increase. A graduated transition plan with increasing autonomy contingent on demonstrated stability is recommended.' },
        { title: 'Imminent vs. long-term risk differentiation', body: 'The distinction between imminent and long-term violence risk is clinically important in this case. Imminent risk (days to weeks) is [elevated/not elevated] based on current Clinical factors. Long-term risk (months to years) is [elevated/moderate/low] based primarily on Historical factors and the trajectory of dynamic risk management. Intervention priorities differ depending on the temporal frame of the risk question being addressed.' },
      ],
    })

    if (hasSubstance) {
      conditions.push({
        name: 'Substance Use Disorder', dsmCode: 'F1x.x',
        dsmExcerpt: 'A problematic pattern of use leading to clinically significant impairment or distress, 2+ of 11 criteria within a 12-month period. (DSM-5-TR)',
        relevance: `Substance use is documented and is a well-established dynamic risk factor for violence. Alcohol: ${substance?.alcohol_use ?? '—'}. Drugs: ${substance?.drug_use ?? '—'}.`,
        dataSummary: `Use patterns, intoxication at time of index offense (if applicable), treatment history: ${substance?.substance_treatment ?? 'none reported'}. HCR-20v3 Clinical factor C4 (Substance Use Problems).`,
        contradictingData: `If substance use is minimal, infrequent, and not associated with aggressive behavior or the index offense, its contribution to violence risk may be limited.`,
        templateOptions: [
          { title: 'SUD as primary dynamic risk factor', body: 'Active substance use is a significant dynamic risk factor in this case, rated as Present on HCR-20v3 Historical factor H5 (Substance Use Problems) and relevant to Clinical factor C4 (Instability). The temporal association between substance use and prior violent behavior is [strong/moderate], with [most/some/all] prior incidents occurring in the context of intoxication. Substance use treatment and monitoring are central to the risk management plan, as sustained sobriety would meaningfully reduce the assessed risk level.' },
          { title: 'Substance use documented — not primary risk driver', body: 'Substance use is documented in the clinical history but does not appear to be a primary contributing factor to the violence risk profile in this case. Prior violent behavior has occurred independently of substance use, and the primary risk drivers appear to be [characterological/psychiatric/situational] rather than substance-related. Substance use is noted as a general risk factor but is not identified as a key intervention target for violence prevention.' },
          { title: 'Disinhibition pathway — violence while intoxicated', body: 'The substance use pattern functions primarily as a disinhibiting factor, reducing impulse control and judgment during intoxication and creating conditions under which pre-existing aggressive tendencies are more likely to be expressed. This pharmacological disinhibition pathway is well-documented in the violence risk literature and suggests that the examinee\'s risk level is materially different when intoxicated versus sober. Risk management should include objective substance use monitoring.' },
          { title: 'Withdrawal-related agitation and aggression', body: 'In addition to intoxication-related risk, withdrawal from [specify substance] is associated with irritability, agitation, and lowered threshold for aggressive responding. The examinee\'s history includes [documented/reported] episodes of aggression during withdrawal periods. Risk management must address both active use and withdrawal phases, potentially including medically managed detoxification and medication-assisted treatment to reduce withdrawal-related aggression.' },
          { title: 'Treatment engagement as risk management tool', body: 'The examinee\'s engagement with substance use treatment is a critical risk management variable. Current treatment status is [actively engaged/previously engaged but dropped out/never engaged/court-ordered but minimally compliant]. Treatment engagement and sustained recovery would address one of the most modifiable risk factors in this case, and treatment recommendations should be specific regarding modality, intensity, and monitoring requirements.' },
          { title: 'Polysubstance use amplifies overall risk', body: 'The examinee\'s polysubstance use pattern creates a compounding risk profile in which the combined effects of multiple substances — including impaired judgment, disinhibition, paranoia, and physiological agitation — exceed the risk associated with any single substance. Risk management must address the full substance use pattern rather than targeting a single substance, and the feasibility of sustained abstinence should be realistically assessed.' },
        ],
      })
    }

    if (has(mental?.violence_history) && has(legal?.arrests_convictions)) {
      conditions.push({
        name: 'Intermittent Explosive Disorder', dsmCode: 'F63.81',
        dsmExcerpt: 'Recurrent behavioral outbursts representing a failure to control aggressive impulses: verbal aggression 2x/week for 3 months, or 3 behavioral outbursts involving property damage/physical assault in 12 months. Aggression is grossly out of proportion to provocation. Age 6+, not better explained by another disorder. (DSM-5-TR 312.34)',
        relevance: `Both violence history and criminal record document recurrent aggressive behavior. Violence: ${mental!.violence_history}. Criminal: ${legal!.arrests_convictions}.`,
        dataSummary: `Frequency and proportionality of aggressive outbursts, provocation analysis, whether aggression is premeditated (arguing against IED) or impulsive, comorbid substance use at time of incidents.`,
        contradictingData: `If aggressive behavior is premeditated, instrumental, or occurs exclusively in the context of substance intoxication, IED criteria are not met. If ASPD better accounts for the pattern, IED should not be diagnosed concurrently per DSM-5-TR exclusion.`,
        templateOptions: [
          { title: 'IED confirmed — recurrent impulsive aggression', body: 'The documented pattern of recurrent, impulsive aggressive outbursts that are grossly disproportionate to provocation is consistent with a diagnosis of Intermittent Explosive Disorder. The examinee reports [verbal aggression occurring at least twice weekly for three months / at least three behavioral outbursts involving property damage or physical assault within the past 12 months]. The aggressive episodes are not premeditated, are not committed to achieve a tangible objective, and cause the examinee marked distress or functional impairment. The aggression is not better accounted for by ASPD, a psychotic disorder, or substance intoxication.' },
          { title: 'Aggression instrumental/premeditated — IED not met', body: 'Analysis of the aggressive behavior pattern reveals that episodes are more instrumental, goal-directed, or premeditated than would be consistent with Intermittent Explosive Disorder. The aggression appears to serve identifiable purposes (e.g., intimidation, coercion, material gain) rather than representing a failure of impulse control. This pattern is more consistent with [ASPD / characterological aggression / situational violence] and does not meet IED criteria.' },
          { title: 'Aggression in substance context — IED exclusion', body: 'Aggressive outbursts occur predominantly or exclusively in the context of substance intoxication, which represents an exclusionary consideration for IED per DSM-5-TR. The impulsive aggression may be a direct pharmacological effect of the substance rather than reflecting a separate impulse control disorder. If aggressive behavior does not occur during sobriety, IED should not be diagnosed, and the aggression should be attributed to the substance use disorder.' },
          { title: 'IED with TBI — neurological disinhibition', body: 'The examinee\'s history of traumatic brain injury involving [frontal/temporal] regions is directly relevant to the IED diagnosis, as TBI-related damage to prefrontal regulatory circuits can produce a neurobehavioral syndrome characterized by impulsive aggression, emotional dysregulation, and disproportionate reactive responses. The neurological contribution to the aggressive behavior has implications for treatment (pharmacological management may be more effective than behavioral interventions alone) and for the risk formulation.' },
          { title: 'IED comorbid with mood disorder', body: 'Intermittent Explosive Disorder co-occurs with [MDD / Bipolar Disorder], and the irritability associated with mood episodes may exacerbate the frequency and severity of aggressive outbursts. Mood stabilization through pharmacological and therapeutic intervention may reduce the frequency of IED episodes, suggesting that treatment of the comorbid mood disorder should be prioritized in the risk management plan.' },
          { title: 'Pattern emerging — subthreshold presentation', body: 'The examinee demonstrates a concerning pattern of impulsive aggressive responses that approaches but does not clearly meet the frequency or severity threshold for IED. This subthreshold presentation is clinically relevant to the risk formulation even without a formal diagnosis, as it indicates impulse control deficits that may escalate under stress or substance influence. Anger management intervention is recommended regardless of diagnostic status.' },
          { title: 'ASPD better accounts for aggression pattern', body: 'Per DSM-5-TR exclusionary criteria, IED should not be diagnosed when the aggressive behavior is better accounted for by Antisocial Personality Disorder. In this case, the pattern of aggression is embedded within a broader characterological pattern of rights-violation, deceitfulness, and disregard for others that is more parsimoniously explained by ASPD. The aggression is a feature of the personality disorder rather than a separate impulse control disorder.' },
        ],
      })
    }
  }

  // ─────────────────────────────────────────────────
  // PTSD evaluation
  // ─────────────────────────────────────────────────
  else if (et.includes('ptsd')) {
    conditions.push({
      name: 'Posttraumatic Stress Disorder', dsmCode: 'F43.10',
      dsmExcerpt: 'Exposure to actual or threatened death, serious injury, or sexual violence (Criterion A). Presence of: intrusion symptoms (B, 1+), persistent avoidance (C, 1+), negative alterations in cognitions/mood (D, 2+), marked alterations in arousal/reactivity (E, 2+). Duration 1+ month (F). Clinically significant distress or impairment (G). (DSM-5-TR 309.81)',
      relevance: `This is a PTSD-specific evaluation. Primary concern: ${complaints?.primary_complaint ?? intakeRow?.presenting_complaint ?? 'review referral'}. Onset: ${complaints?.onset_timeline ?? 'not documented'}.`,
      dataSummary: `CAPS-5 cluster scores and severity: ${stageIndex >= 2 ? 'scored — review criterion-by-criterion' : 'pending'}. PCL-5 total and cluster scores: ${stageIndex >= 2 ? 'scored' : 'pending'}. Trauma narrative from interview. Functional impairment: ${complaints?.secondary_concerns ?? 'review interview'}.`,
      contradictingData: `If CAPS-5 does not meet threshold for all required clusters, full PTSD criteria are not met — consider subthreshold presentation or alternative diagnosis. If validity testing suggests exaggeration (see response style below), symptom credibility is compromised. Duration under 1 month → Acute Stress Disorder instead.`,
      templateOptions: [
        { title: 'Full PTSD criteria met — CAPS-5 confirmed', body: 'CAPS-5 administration confirms symptoms meeting full DSM-5-TR diagnostic criteria across all required clusters: Criterion B (intrusion, [specify number] symptoms endorsed), Criterion C (avoidance, [specify number] symptoms endorsed), Criterion D (negative alterations in cognitions and mood, [specify number] symptoms endorsed), and Criterion E (arousal and reactivity, [specify number] symptoms endorsed). Symptom onset is temporally linked to the documented traumatic event, duration exceeds one month, and clinically significant functional impairment is documented across [occupational/social/personal] domains.' },
        { title: 'Subthreshold PTSD — partial criteria met', body: 'Significant trauma-related symptoms are present and clinically meaningful; however, one or more DSM-5-TR criterion clusters are not fully met at the clinical threshold on CAPS-5. Specifically, [Cluster C avoidance / Cluster D cognitions-mood / Cluster E arousal] falls below the diagnostic cutoff with [specify number] of the required [specify number] symptoms endorsed. This subthreshold presentation still represents clinically significant distress and may warrant treatment, though a formal PTSD diagnosis is not supported at this time.' },
        { title: 'Trauma exposure documented but PTSD not supported', body: 'While the examinee reports exposure to a traumatic event meeting Criterion A, the subsequent symptom presentation does not reliably meet PTSD criteria. CAPS-5 severity scores are below the diagnostic threshold, and the clinical picture may be better accounted for by [an adjustment disorder / a pre-existing mood or anxiety disorder exacerbated by the event / normal stress response]. The absence of a PTSD diagnosis does not invalidate the examinee\'s reported distress.' },
        { title: 'Delayed-expression PTSD', body: 'The PTSD presentation in this case meets the DSM-5-TR specifier for delayed expression, with full diagnostic criteria not met until at least six months after the traumatic event. The examinee reports [initial partial symptoms / no immediate symptoms / initial numbing followed by gradual symptom emergence]. Delayed expression is well-documented in the literature, particularly following [sexual trauma / military combat / childhood abuse], and does not undermine the validity of the diagnosis.' },
        { title: 'PTSD with dissociative subtype', body: 'In addition to meeting full PTSD criteria, the examinee demonstrates persistent or recurrent symptoms of [depersonalization / derealization] in response to trauma-related stimuli, meeting the DSM-5-TR dissociative subtype specifier. This dissociative presentation is clinically significant because it may [complicate treatment engagement, affect the examinee\'s credibility in legal proceedings, indicate more severe trauma exposure, require specialized treatment approaches such as phase-oriented trauma therapy].' },
        { title: 'Complex trauma presentation', body: 'While DSM-5-TR does not include a separate Complex PTSD diagnosis, the examinee\'s presentation includes features characteristic of chronic, repeated traumatic exposure, including [affect dysregulation, negative self-concept, interpersonal difficulties, somatization]. These features extend beyond the core PTSD symptom clusters and suggest that the impact of trauma on this individual\'s functioning is broader than a standard PTSD diagnosis captures. Treatment planning should address these additional domains.' },
        { title: 'Multiple trauma exposures — index event identified', body: 'The examinee reports exposure to multiple traumatic events across the lifespan. For the purposes of this evaluation, the index traumatic event is identified as [specify event], which is the event most directly linked to the current PTSD symptom presentation and the referral question. However, the clinician notes that cumulative trauma exposure creates a vulnerability context that may amplify symptom severity and complicate treatment response beyond what would be expected from a single-incident trauma.' },
        { title: 'Functional impairment documented across domains', body: 'The PTSD diagnosis is associated with significant and documented functional impairment. The examinee reports [inability to work / reduced work capacity, social withdrawal and isolation, disrupted intimate relationships, impaired parenting, neglect of self-care, substance use as coping]. Functional impairment verification is an essential component of the diagnostic formulation and is relevant to any determination of disability or damages in the forensic context.' },
        { title: 'Pre-existing vulnerability amplified trauma response', body: 'The examinee\'s pre-existing psychological vulnerability, including [prior trauma history / pre-existing mood disorder / personality features / limited coping resources], likely contributed to the severity of the trauma response. The "eggshell plaintiff" principle is relevant in forensic contexts — a defendant takes the plaintiff as they find them, and pre-existing vulnerability does not diminish the causal role of the index trauma. However, apportionment of impairment between pre-existing conditions and trauma-related symptoms should be addressed.' },
        { title: 'Treatment response informs prognosis', body: 'The examinee\'s response to prior PTSD treatment is informative for prognosis. [The examinee has not yet engaged in evidence-based trauma treatment / The examinee completed [CPT/PE/EMDR] with [significant/partial/minimal] symptom reduction / The examinee has been treatment-resistant to multiple modalities]. This treatment history informs the expected trajectory of recovery and the degree of permanent impairment that may be anticipated.' },
        { title: 'Criterion A event meets threshold — analysis', body: 'The reported traumatic event meets DSM-5-TR Criterion A through [direct exposure / witnessing / learning about a close family member or friend\'s experience / repeated professional exposure to details]. The specific elements establishing Criterion A qualification include [actual/threatened death, serious injury, or sexual violence]. This determination is foundational to the PTSD diagnosis and has been verified through [self-report, police reports, medical records, witness statements].' },
      ],
    })

    // Only add Acute Stress if onset is recent
    const onset = complaints?.onset_timeline ?? ''
    if (onset.toLowerCase().includes('week') || onset.toLowerCase().includes('days') || onset.toLowerCase().includes('recent')) {
      conditions.push({
        name: 'Acute Stress Disorder', dsmCode: 'F43.0',
        dsmExcerpt: '9+ symptoms from any of five categories: intrusion, negative mood, dissociative, avoidance, arousal. Duration: 3 days to 1 month after trauma exposure. If symptoms persist beyond 1 month, PTSD should be diagnosed instead. (DSM-5-TR 308.3)',
        relevance: `Symptom onset description suggests a relatively recent timeframe: "${onset}". If duration is under 1 month, ASD rather than PTSD applies.`,
        dataSummary: `Exact symptom onset date and current duration are critical for differentiating ASD from PTSD. The 1-month threshold is the key differentiator.`,
        contradictingData: `If symptoms have persisted beyond 1 month (as is likely by evaluation date), ASD is ruled out by definition and PTSD criteria should be evaluated.`,
        templateOptions: [
          { title: 'ASD confirmed — under one month duration', body: 'Symptom duration is less than one month from the date of trauma exposure, and the examinee meets the DSM-5-TR requirement of nine or more symptoms from the five categories (intrusion, negative mood, dissociation, avoidance, and arousal). The presentation is consistent with Acute Stress Disorder. Symptom severity and functional impairment are clinically significant. Re-evaluation for PTSD is recommended if symptoms persist beyond the one-month mark.' },
          { title: 'Duration exceeds one month — ASD ruled out', body: 'Symptom duration exceeds one month from the date of trauma exposure. Acute Stress Disorder is ruled out by definition per DSM-5-TR temporal criteria, as ASD applies only within the 3-day to 1-month window following trauma. The diagnostic focus should shift to evaluation of PTSD criteria, which applies when symptoms persist beyond one month.' },
          { title: 'Early intervention recommended — prevent PTSD', body: 'The current ASD presentation represents a window of opportunity for early intervention to prevent the development of chronic PTSD. Research indicates that early, evidence-based intervention (particularly brief CBT with exposure components) during the acute post-trauma period can significantly reduce the probability of PTSD development. Specific treatment recommendations for this acute phase are provided.' },
          { title: 'Prominent dissociative features in acute phase', body: 'The acute stress presentation is characterized by prominent dissociative symptoms, including [depersonalization, derealization, dissociative amnesia, reduced awareness of surroundings, emotional numbing]. Peritraumatic and acute-phase dissociation is a well-established predictor of subsequent PTSD development. The prominence of dissociative features in this presentation increases the clinical concern for chronic PTSD and supports the recommendation for early therapeutic intervention.' },
          { title: 'Severity suggests high PTSD conversion risk', body: 'The severity of the current acute stress presentation — particularly the intensity of intrusion and hyperarousal symptoms — places the examinee at elevated risk for conversion to PTSD. While not all individuals with ASD develop PTSD, the current symptom profile and severity level are associated with a [high/moderate] probability of chronic course without intervention.' },
          { title: 'Functional impairment requires immediate support', body: 'The acute stress reaction has produced significant functional impairment that requires immediate clinical attention, including [inability to work, inability to be alone, severe sleep disruption, inability to care for dependents, avoidance of necessary activities]. Regardless of whether the presentation ultimately meets PTSD criteria, the current level of functional impairment warrants immediate supportive intervention and safety planning.' },
        ],
      })
    }

    // Always assess response style in PTSD litigation/disability context
    conditions.push({
      name: 'Malingered / Exaggerated PTSD Symptoms', dsmCode: 'Z76.5',
      dsmExcerpt: 'In forensic and disability contexts, the base rate of malingered or exaggerated PTSD is significant. Assessment requires multi-method validity evaluation including embedded validity indicators in PTSD measures, standalone symptom validity tests, and cross-method consistency analysis. (Clinical standard of practice)',
      relevance: `PTSD evaluations frequently occur in medicolegal contexts with external incentives. ${intakeRow?.charges ? `Legal context: ${intakeRow.charges}.` : 'Assess for litigation, disability, or other external incentive.'}`,
      dataSummary: `TSI-2 atypical response scale: ${stageIndex >= 2 ? 'review' : 'pending'}. MMPI-3 over-reporting (F, Fp, FBS, RBS): ${stageIndex >= 2 ? 'review' : 'pending'}. CAPS-5 symptom consistency with behavioral observation. PCL-5 vs. CAPS-5 concordance.`,
      contradictingData: `If all validity indicators are within normal limits and symptom presentation is consistent across self-report, structured interview, and behavioral observation, malingering is not supported.`,
      templateOptions: [
        { title: 'Credible presentation — validity indicators passed', body: 'Multi-method validity assessment is consistent with a genuine and credible PTSD presentation. TSI-2 atypical response scale is within normal limits, MMPI-3 over-reporting indicators (F, Fp, FBS, RBS) do not suggest exaggeration, and symptom presentation on CAPS-5 structured interview is concordant with PCL-5 self-report and behavioral observation during evaluation sessions. No reliable indicators of symptom fabrication or exaggeration were detected across instruments. The clinical data can be interpreted at face value.' },
        { title: 'Mild over-reporting — conservative interpretation advised', body: 'Some validity indicators show mild elevations in the over-reporting direction, suggesting a tendency to endorse symptoms more broadly or severely than is typical of genuine PTSD presentations. This may reflect a "cry for help" pattern, unsophisticated symptom description, or mild exaggeration of genuine distress. Clinical findings from self-report instruments should be interpreted conservatively, with greater reliance placed on structured interview data and behavioral observation.' },
        { title: 'Strong exaggeration pattern — credibility compromised', body: 'Convergent validity indicators across multiple instruments suggest a pattern of symptom exaggeration that is inconsistent with genuine PTSD. MMPI-3 over-reporting scales are clinically elevated (F = [score], Fp = [score], FBS = [score]), TSI-2 atypical response scale exceeds the cutoff, and CAPS-5 symptom endorsement is inconsistent with behavioral presentation during the evaluation. Self-report symptom data cannot be considered reliable indicators of the examinee\'s actual clinical status.' },
        { title: 'Symptom coaching suspected', body: 'Elements of the symptom presentation suggest possible coaching or preparation, including [textbook recitation of DSM criteria, implausible symptom combinations, symptoms that align perfectly with diagnostic criteria without the expected individual variation, sudden onset coinciding precisely with legal proceedings]. While coaching does not preclude the presence of genuine symptoms, it compromises the reliability of the self-reported clinical picture and warrants heightened scrutiny of all symptom claims.' },
        { title: 'External incentive analysis', body: 'The evaluation context presents a clear external incentive for symptom exaggeration or fabrication. The examinee stands to [gain financially through litigation/receive disability benefits/avoid legal consequences/obtain favorable custody determination] if a PTSD diagnosis is established. While external incentive alone does not establish malingering, it is a critical contextual factor that must be considered in the overall credibility assessment. The base rate of malingered PTSD in [litigation/disability/forensic] contexts is estimated at [10-50%] depending on the setting.' },
        { title: 'Partial malingering — genuine distress with exaggeration', body: 'The overall data pattern is most consistent with partial malingering — the exaggeration of genuine trauma-related symptoms for external gain. The examinee likely did experience a traumatic event and has some authentic distress; however, the severity and functional impact are overstated relative to what objective data support. The genuine baseline of symptoms is estimated to be [less severe than reported], and clinical formulations should be based on this adjusted baseline rather than the exaggerated self-report.' },
        { title: 'Cross-method consistency supports genuineness', body: 'Symptom presentation was notably consistent across self-report measures (PCL-5), structured clinical interview (CAPS-5), behavioral observation, and collateral reports. This cross-method consistency is difficult to fabricate and provides strong support for the genuineness of the reported PTSD symptoms. The concordance across methods is specifically noted as evidence against symptom fabrication or exaggeration.' },
        { title: 'Atypical symptom profile warrants further inquiry', body: 'The examinee\'s symptom profile departs from typical PTSD presentations in ways that warrant further clinical inquiry. Specifically, [endorsement of rare symptoms, absence of expected core symptoms, symptom severity that does not diminish with therapeutic rapport, symptom presentation that fluctuates inconsistently across evaluation sessions]. These atypical features do not definitively establish malingering but are noted as requiring integration into the overall credibility assessment.' },
        { title: 'Validity testing inconclusive — clinical judgment primary', body: 'Validity testing produced an inconclusive profile that neither clearly supports nor clearly undermines symptom credibility. In the absence of definitive validity testing results, the clinician\'s overall judgment is based on the totality of data, including behavioral observation, consistency of presentation, concordance between reported symptoms and known clinical patterns, plausibility of the reported trauma-symptom connection, and external incentive analysis. The overall clinical impression is that the presentation is [probably genuine / of uncertain credibility / probably exaggerated].' },
        { title: 'Fabricated trauma event suspected', body: 'Beyond symptom exaggeration, there is concern that the reported traumatic event itself may be fabricated or substantially embellished. Inconsistencies between the examinee\'s account and [police reports, medical records, witness statements, prior statements] raise questions about the veracity of the Criterion A event. If the traumatic event did not occur as described, the PTSD diagnosis is invalid regardless of the symptom presentation, as Criterion A is a prerequisite for the diagnosis.' },
      ],
    })

    // Comorbid depression — if data suggests it
    if (has(mental?.previous_treatment) || has(mental?.previous_diagnoses) || has(health?.sleep_quality)) {
      conditions.push({
        name: 'Major Depressive Disorder (comorbid)', dsmCode: 'F33.x',
        dsmExcerpt: 'MDD is highly comorbid with PTSD (estimated 50%+ co-occurrence). DSM-5-TR Criterion D for PTSD (negative cognitions/mood) overlaps substantially with MDD symptoms. The clinician must determine whether depressive symptoms warrant an independent MDD diagnosis or are subsumed under the PTSD diagnosis. (DSM-5-TR 296.xx)',
        relevance: `Depressive features are suggested by the clinical history. ${has(mental?.previous_diagnoses) ? `Prior diagnoses: ${mental!.previous_diagnoses}.` : ''} ${has(health?.sleep_quality) ? `Sleep: ${health!.sleep_quality}.` : ''} Criterion D overlap with PTSD must be carefully differentiated.`,
        dataSummary: `MMPI-3 depression scales (RC2, RCd, Low Positive Emotions), interview mood assessment, whether depressive symptoms exist independently of PTSD avoidance/numbing.`,
        contradictingData: `If depressive symptoms are entirely accounted for by PTSD Criterion D (negative cognitions/mood associated with the trauma), a separate MDD diagnosis may not be warranted. If symptoms preceded the trauma, independent MDD is supported.`,
        templateOptions: [
          { title: 'Comorbid MDD — independent of PTSD Criterion D', body: 'Depressive symptoms are present that appear to function independently of the PTSD Criterion D cluster and warrant a separate comorbid diagnosis of Major Depressive Disorder. Key indicators supporting an independent MDD diagnosis include [depressive episodes predating the trauma, depressive symptoms extending beyond trauma-related cognitions, anhedonia and vegetative symptoms not linked to specific trauma content, prior depressive episodes unrelated to traumatic events]. The 50%+ comorbidity rate between PTSD and MDD is well-established, and both conditions require independent treatment attention.' },
          { title: 'Depression subsumed under PTSD Criterion D', body: 'Depressive features are present but appear to be largely subsumed under the PTSD Criterion D cluster (negative alterations in cognitions and mood associated with the traumatic event). Specifically, [negative beliefs about self, persistent negative emotional state, diminished interest, detachment] are all directly linked to the trauma content and its aftermath rather than representing an independent depressive syndrome. A separate MDD diagnosis is not indicated, and treatment of the PTSD is expected to address the depressive features concurrently.' },
          { title: 'Pre-existing MDD worsened by trauma', body: 'The examinee has a documented history of Major Depressive Disorder that predated the traumatic event and was subsequently worsened by the trauma exposure. This temporal sequence has implications for the forensic context — both the exacerbation of the pre-existing MDD and the new PTSD diagnosis may be attributable to the traumatic event, but the pre-existing baseline must be established for accurate apportionment of impairment and damages.' },
          { title: 'MDD driving primary functional impairment', body: 'While both PTSD and MDD are diagnosed, the depressive symptoms appear to be the primary driver of the examinee\'s current functional impairment. [Anhedonia, psychomotor retardation, impaired concentration, fatigue, worthlessness] are more prominently contributing to occupational and social disability than the trauma-specific symptoms. This has treatment implications, as antidepressant medication and behavioral activation may produce the most immediate functional improvement.' },
          { title: 'Suicidality in context of comorbid PTSD-MDD', body: 'The combination of PTSD and MDD creates an elevated suicide risk that exceeds the risk associated with either condition alone. The examinee endorses [hopelessness, passive suicidal ideation, active ideation without plan, prior attempts]. The trauma-related cognitions (particularly guilt, shame, and perceived burdensomeness) interact with depressive cognitions to create a high-risk profile. Safety planning and risk monitoring are critical treatment priorities.' },
          { title: 'Differentiation requires longitudinal analysis', body: 'The overlapping symptom profiles of PTSD and MDD make differential diagnosis difficult at a single evaluation point. Several symptoms (insomnia, concentration difficulty, anhedonia, irritability) are shared across both conditions. A definitive determination of whether the depressive syndrome is independent or subsumed under PTSD Criterion D may require longitudinal observation of whether depressive symptoms persist after PTSD-specific treatment. For current purposes, both conditions are diagnosed and targeted in treatment recommendations.' },
          { title: 'Treatment implications for comorbidity', body: 'The PTSD-MDD comorbidity has specific treatment implications. Evidence-based PTSD treatments (CPT, PE) often produce concurrent improvement in depressive symptoms. However, severe MDD with vegetative features may need to be partially stabilized before the examinee can meaningfully engage in trauma-focused therapy. A sequenced approach — initial mood stabilization followed by trauma processing — may be optimal in this case. Combined pharmacotherapy (SSRI) and psychotherapy is recommended.' },
        ],
      })
    }
  }

  // ─────────────────────────────────────────────────
  // Capacity evaluation
  // ─────────────────────────────────────────────────
  else if (et.includes('capacity')) {
    conditions.push({
      name: 'Major Neurocognitive Disorder', dsmCode: 'F02.8x',
      dsmExcerpt: 'Significant cognitive decline from a previous level of performance in one or more cognitive domains (complex attention, executive function, learning/memory, language, perceptual-motor, social cognition) based on clinician concern AND substantial impairment documented by standardized testing. Deficits interfere with independence in everyday activities. (DSM-5-TR)',
      relevance: `Capacity evaluation directly requires assessment of cognitive functioning and its impact on decision-making. Medical history: ${health?.medical_conditions ?? 'review'}. Head injuries: ${health?.head_injuries ?? 'none reported'}. Family history: ${family?.family_mental_health ?? 'review'}.`,
      dataSummary: `MoCA: ${stageIndex >= 2 ? 'scored' : 'pending'}. WAIS-V indices (processing speed, working memory): ${stageIndex >= 2 ? 'scored' : 'pending'}. Trail Making B: ${stageIndex >= 2 ? 'review time and errors' : 'pending'}. WCST: ${stageIndex >= 2 ? 'review perseverative errors' : 'pending'}. Collateral informant report of functional decline.`,
      contradictingData: `If cognitive scores are within normal limits for age and education, and informant reports do not document functional decline, a neurocognitive disorder is not supported. Depression can produce cognitive deficits that mimic dementia (see below if applicable).`,
      templateOptions: [
        { title: 'Major NCD confirmed — multi-domain decline', body: 'Neuropsychological testing reveals a consistent pattern of cognitive decline across multiple domains, including [memory, executive function, attention, language, visuospatial processing], that meets DSM-5-TR criteria for Major Neurocognitive Disorder. Performance falls [1.5+ / 2+ standard deviations] below expected levels based on age and educational attainment. Collateral informants confirm progressive functional decline affecting [financial management, medication management, driving, meal preparation, personal safety judgment]. The pattern and progression are most consistent with [Alzheimer\'s type / vascular / Lewy body / frontotemporal / mixed etiology].' },
        { title: 'Mild NCD — independent functioning preserved', body: 'Cognitive testing reveals modest but clinically significant decline from the expected baseline, consistent with Mild Neurocognitive Disorder. The examinee demonstrates measurable deficits in [specify domains] that require greater effort or compensatory strategies but do not yet interfere with independence in everyday activities. Monitoring for progression to Major NCD is recommended.' },
        { title: 'Cognitive performance normal — NCD not supported', body: 'Cognitive performance across all assessed domains falls within expected limits for the examinee\'s age, education, and estimated premorbid functioning. A neurocognitive disorder is not supported by the current neuropsychological data. Subjective cognitive concerns may reflect normal aging, depression-related cognitive inefficiency, or medication side effects rather than a neurodegenerative process.' },
        { title: 'Alzheimer\'s-type pattern identified', body: 'The neuropsychological profile is most consistent with an Alzheimer\'s-type etiology, characterized by predominant deficits in episodic memory and delayed recall with relative preservation of attention and motor function in early stages. This pattern, combined with the reported insidious onset and gradual progression, is consistent with the clinical presentation of Alzheimer\'s disease. Neuroimaging and biomarker studies may further support or refine this etiological attribution.' },
        { title: 'Vascular pattern — stepwise decline', body: 'The cognitive profile demonstrates features consistent with vascular neurocognitive disorder, including predominant deficits in executive function, processing speed, and attention with relatively preserved episodic memory. The examinee\'s medical history of [hypertension, diabetes, stroke, cardiovascular disease] and the reported stepwise pattern of decline further support a vascular etiology.' },
        { title: 'Frontotemporal pattern — behavioral variant', body: 'The clinical presentation is characterized by prominent behavioral and personality changes, including disinhibition, apathy, loss of empathy, and compulsive behaviors, with relative preservation of memory and visuospatial function. This pattern is most consistent with the behavioral variant of frontotemporal neurocognitive disorder and has particular relevance to capacity determination, as these behavioral changes affect judgment and vulnerability to exploitation.' },
        { title: 'Capacity specifically impaired — unable to manage affairs', body: 'The severity of neurocognitive decline directly impairs the examinee\'s capacity to manage financial affairs, make informed medical decisions, and understand and appreciate the consequences of decisions. Specific functional impairments documented during the evaluation include inability to understand financial documents, confusion about medical treatments, and inability to weigh risks and benefits of proposed actions.' },
        { title: 'Capacity partially preserved — domain-specific', body: 'Neurocognitive decline is documented; however, capacity is not uniformly impaired across all domains. The examinee retains sufficient cognitive function to understand basic information about personal care and express consistent preferences, while lacking capacity for complex financial decisions and independent living without supervision. A domain-specific capacity determination is most appropriate.' },
        { title: 'Effort adequate — scores reflect true ability', body: 'Performance validity testing indicates adequate effort and engagement during the neuropsychological evaluation. The measured cognitive scores are interpreted as a reliable reflection of the examinee\'s current cognitive functioning rather than an underestimate due to poor effort or deliberate underperformance. This foundational finding supports the validity of the capacity determination.' },
        { title: 'Rapid decline warrants urgent protective measures', body: 'Collateral informants describe a rapid trajectory of cognitive decline with documented incidents of financial exploitation, wandering, medication errors, and safety-compromising decisions. The pace of decline suggests that protective measures should be implemented urgently rather than deferred. Recommendations for guardianship, conservatorship, or power of attorney activation are provided with appropriate urgency.' },
        { title: 'Medication effects may contribute to presentation', body: 'The examinee\'s current medication regimen includes agents known to impair cognitive function in older adults, including [anticholinergics, benzodiazepines, opioids]. The observed cognitive deficits may be partially or wholly attributable to medication effects rather than a neurodegenerative process. A medication review by the prescribing physician is recommended before establishing a definitive neurocognitive disorder diagnosis.' },
      ],
    })

    // Depressive pseudodementia — important differential in capacity
    if (has(mental?.previous_treatment) || has(mental?.previous_diagnoses) || has(health?.sleep_quality)) {
      conditions.push({
        name: 'Depressive Pseudodementia', dsmCode: 'F33.x',
        dsmExcerpt: 'Major depression can produce cognitive impairment (concentration, memory, executive function) that mimics neurocognitive disorder. Key differentiators: subacute onset (weeks vs. months/years), prominent subjective concerns relative to objective performance, effortful "I don\'t know" responses, response to antidepressant treatment. (Clinical differential)',
        relevance: `${has(mental?.previous_diagnoses) ? `Prior diagnoses: ${mental!.previous_diagnoses}.` : ''} ${has(health?.sleep_quality) ? `Sleep disturbance: ${health!.sleep_quality}.` : ''} Depression-related cognitive deficits must be differentiated from neurodegenerative decline.`,
        dataSummary: `Mood assessment from interview, onset acuity (sudden vs. gradual), effort on cognitive testing (adequate effort with poor performance suggests organic decline; poor effort may suggest depression or malingering), depression history.`,
        contradictingData: `If onset is clearly gradual over months/years, informants describe progressive decline, and mood symptoms are absent or secondary, organic neurocognitive disorder is more likely than pseudodementia.`,
        templateOptions: [
          { title: 'Depression likely accounting for cognitive deficits', body: 'The combination of active mood symptoms, prominent subjective cognitive concerns, and the pattern of cognitive testing raises the strong possibility that depression is contributing to or fully accounting for the observed cognitive deficits. Key indicators favoring a depressive etiology include: subacute symptom onset (weeks rather than months/years), prominent "I don\'t know" responses on cognitive testing despite adequate effort, subjective concerns disproportionately severe relative to objective performance, and history of mood disorder. An antidepressant trial with cognitive re-evaluation after mood stabilization is recommended before concluding a neurodegenerative diagnosis.' },
          { title: 'Neurodegenerative process more likely than pseudodementia', body: 'The pattern of cognitive decline is more consistent with a neurodegenerative process than depressive pseudodementia. Onset has been gradual over [months/years], collateral informants describe progressive functional decline, and mood symptoms appear secondary to and less prominent than the cognitive deterioration. The examinee demonstrates typical dementia features including confabulation, lack of concern about cognitive deficits, and a pattern of near-miss errors rather than the effortful "I don\'t know" responses characteristic of depression-related cognitive impairment.' },
          { title: 'Mixed presentation — both depression and neurodegeneration', body: 'The clinical data suggest a mixed presentation in which both a depressive disorder and a neurocognitive disorder may be contributing to the observed cognitive impairment. Depression may be exacerbating or unmasking cognitive deficits that have a neurodegenerative basis. Treatment of the depressive component is recommended with the expectation that cognitive re-evaluation after mood stabilization will clarify the degree of improvement attributable to mood treatment versus the residual cognitive deficit representing a neurodegenerative process.' },
          { title: 'Effort pattern consistent with depression-related impairment', body: 'The pattern of effort on cognitive testing is informative for this differential. The examinee demonstrated adequate effort (performance validity tests are passed) but showed a pattern of slow, effortful processing, frequent "I don\'t know" responses, and variable performance that is more characteristic of depression-related cognitive impairment than of neurodegenerative disease. In dementia, patients typically attempt tasks and fail; in depression, patients often give up prematurely despite having residual capacity.' },
          { title: 'Treatment trial recommended before capacity determination', body: 'Given the plausibility of depressive pseudodementia, a definitive capacity determination should be deferred pending an adequate antidepressant treatment trial. If depression is the primary driver of cognitive deficits, cognitive function may improve substantially with mood stabilization, fundamentally altering the capacity assessment. A 6-8 week treatment trial with cognitive re-evaluation is recommended before making decisions about guardianship or other protective measures.' },
          { title: 'Prior depression history supports pseudodementia hypothesis', body: 'The examinee\'s documented history of recurrent depressive episodes, with prior episodes associated with cognitive concerns that resolved with treatment, supports the pseudodementia hypothesis. The current presentation mirrors prior episodes in which mood symptoms were accompanied by concentration difficulty, memory concerns, and psychomotor retardation. This historical pattern is the strongest evidence available for a reversible, depression-mediated etiology.' },
          { title: 'Grief reaction mimicking cognitive decline', body: 'The onset of cognitive concerns coincides with a significant bereavement ([specify loss]), and the presentation may represent a grief reaction with prominent cognitive features rather than a neurodegenerative process. Complicated grief can produce concentration difficulty, disorientation, confusion, and apparent memory impairment that mimics dementia. Grief-focused intervention should be considered before attributing cognitive deficits to a neurodegenerative etiology.' },
          { title: 'Age complicates differential — higher index of suspicion', body: 'The examinee\'s age ([age]) places them in a demographic where both depression and neurodegenerative disease are prevalent, making this differential diagnosis particularly challenging. Neither condition can be dismissed based on demographics alone. The base rate of neurodegenerative disease at this age is [elevated/significant], warranting a thorough workup even when depression is present and may be contributing to the cognitive picture.' },
        ],
      })
    }

    // Delirium — always rule out in capacity
    conditions.push({
      name: 'Delirium (rule-out)', dsmCode: 'F05',
      dsmExcerpt: 'A disturbance in attention and awareness that develops acutely (hours to days), represents a change from baseline, tends to fluctuate during the day, and is a direct physiological consequence of a medical condition, substance, or multiple etiologies. (DSM-5-TR 293.0)',
      relevance: `Delirium must be ruled out before diagnosing neurocognitive disorder, as it can produce severe cognitive deficits that are reversible. Current medications: ${health?.current_medications ?? 'review'}.`,
      dataSummary: `Onset acuity, fluctuation pattern during evaluation sessions, medication review for deliriogenic agents, recent medical events, attentional performance on testing.`,
      contradictingData: `If cognitive deficits are stable across evaluation sessions, onset is gradual over months, and no acute medical precipitant is identified, delirium is effectively ruled out.`,
      templateOptions: [
        { title: 'Delirium ruled out — stable presentation', body: 'No evidence of delirium is present. Cognitive performance was stable across evaluation sessions with no fluctuation in attention or awareness. Onset of cognitive difficulties was gradual rather than acute, no acute medical precipitant has been identified, and the examinee demonstrated consistent orientation and attentional capacity throughout the evaluation. Delirium is ruled out as a contributor to the observed cognitive deficits, and the capacity assessment can proceed based on the neurocognitive evaluation findings.' },
        { title: 'Fluctuating presentation — delirium concern', body: 'Fluctuating cognitive performance across evaluation sessions raises concern for a delirious process. Specifically, the examinee demonstrated [variable attention, waxing and waning of orientation, inconsistent performance on attentional tasks, apparent confusion during afternoon sessions not present in morning sessions]. Medical evaluation should be obtained before finalizing a neurocognitive disorder diagnosis, as delirium is a reversible medical emergency and its identification fundamentally changes the diagnostic and management approach.' },
        { title: 'Medication-induced delirium suspected', body: 'The examinee\'s current medication regimen includes agents with known deliriogenic potential, including [anticholinergics, benzodiazepines, opioids, corticosteroids, polypharmacy in an elderly patient]. The relatively acute onset and fluctuating nature of cognitive symptoms raise concern for a medication-induced delirium superimposed on any underlying cognitive baseline. An urgent medication review by the prescribing physician is recommended before proceeding with capacity determination.' },
        { title: 'Post-operative or medical delirium context', body: 'The evaluation is occurring in the context of a recent [surgery, hospitalization, infection, metabolic disturbance], which is a common precipitant of delirium in older adults. Cognitive testing performed during an active delirious episode does not validly represent the examinee\'s baseline cognitive functioning, and any capacity determination based on such data would be premature. Re-evaluation after medical stabilization is strongly recommended.' },
        { title: 'Delirium superimposed on dementia', body: 'The clinical picture suggests delirium superimposed on a pre-existing neurocognitive disorder. The examinee has a baseline of cognitive decline consistent with [specify type of NCD], with a recent acute worsening characterized by [fluctuating attention, new-onset confusion, visual hallucinations, psychomotor agitation/retardation]. Both conditions must be addressed — the delirium requires urgent medical evaluation and treatment, while the underlying NCD informs the long-term capacity question.' },
        { title: 'Hypoactive delirium — may be missed', body: 'The examinee presents with features consistent with hypoactive delirium, characterized by reduced alertness, psychomotor slowing, and apparent apathy rather than the agitated presentation typically associated with delirium. Hypoactive delirium is frequently misdiagnosed as depression or dementia and carries a worse prognosis due to delayed identification. Formal delirium screening and medical workup are recommended before attributing the presentation to a neurocognitive or mood disorder.' },
      ],
    })
  }

  // ─────────────────────────────────────────────────
  // Generic / other eval types
  // ─────────────────────────────────────────────────
  else {
    const hasDepressive = has(mental?.previous_treatment) || has(mental?.previous_diagnoses)
    const hasSubstance = has(substance?.alcohol_use) || has(substance?.drug_use)

    if (hasDepressive) {
      conditions.push({
        name: 'Major Depressive Disorder', dsmCode: 'F33.x',
        dsmExcerpt: 'Five or more symptoms during the same 2-week period. At least one is depressed mood or loss of interest/pleasure. Symptoms cause clinically significant distress or impairment. (DSM-5-TR 296.xx)',
        relevance: `Clinical history suggests depressive features. ${has(mental?.previous_diagnoses) ? `Prior diagnoses: ${mental!.previous_diagnoses}.` : ''} ${has(mental?.previous_treatment) ? `Treatment: ${mental!.previous_treatment}.` : ''}`,
        dataSummary: `Testing mood scales, interview observations, sleep/appetite/concentration, functional impairment, prior episode history.`,
        contradictingData: `If symptoms are situational and do not meet 2-week severity/duration threshold, Adjustment Disorder is more appropriate.`,
        templateOptions: [
          { title: 'MDD confirmed — full criteria met', body: 'Clinical data, including psychometric testing, clinical interview, and behavioral observation, are consistent with Major Depressive Disorder meeting full DSM-5-TR criteria. The examinee endorses five or more qualifying symptoms, including [depressed mood / anhedonia] as a core symptom, that have persisted for at least two weeks and represent a change from previous functioning. Clinically significant distress and functional impairment are documented.' },
          { title: 'Depressive features situational — may not meet criteria', body: 'Depressive features are present and acknowledged by the examinee; however, the onset and course appear situational, temporally linked to [current stressors]. The severity and duration may not meet the full DSM-5-TR criteria for Major Depressive Disorder. An Adjustment Disorder with depressed mood may more accurately capture the current clinical picture.' },
          { title: 'Depression not supported by available data', body: 'A clinical depressive disorder is not supported by the available evaluation data. Psychometric mood scales fall within normal limits, and behavioral observations during the evaluation are inconsistent with clinically significant depression. Any mood-related concerns reported by the examinee are proportionate to current life circumstances and do not warrant a formal diagnosis.' },
          { title: 'Recurrent episode — established pattern', body: 'The current depressive episode occurs in the context of a documented history of recurrent Major Depressive Disorder. Prior episodes have been treated with [medication/therapy] with [partial/full/minimal] response. The recurrent nature of the illness informs prognosis, treatment planning, and the expected trajectory of symptom resolution.' },
          { title: 'Severe episode with vegetative features', body: 'The current depressive episode is severe, with prominent vegetative features including [significant weight change, insomnia/hypersomnia, psychomotor retardation/agitation, fatigue, impaired concentration]. The severity of the episode is relevant to the forensic question in that it may [affect the examinee\'s reliability as an informant, impair participation in proceedings, explain behavioral changes relevant to the referral question].' },
          { title: 'Defensive presentation may mask depression', body: 'The examinee presented with a minimizing and defensive interpersonal style during the evaluation. Psychometric validity indicators suggest underreporting of psychological distress. It is possible that the true severity of depressive symptoms is greater than what is reflected in self-report data. Behavioral observations and collateral information should be weighted accordingly in the diagnostic formulation.' },
          { title: 'Comorbid anxiety complicates presentation', body: 'Depressive symptoms co-occur with significant anxiety features, creating a mixed presentation. The co-occurrence of depression and anxiety is associated with greater functional impairment, longer episode duration, and reduced treatment response compared to either condition alone. Treatment recommendations should address both symptom domains.' },
          { title: 'Treatment response informs prognosis', body: 'The examinee\'s history of treatment response is relevant to the diagnostic formulation and prognosis. [Prior positive response to SSRIs suggests a biologically-mediated depression amenable to pharmacotherapy / Prior treatment resistance suggests a more complex or chronic condition / No prior treatment has been attempted, so prognosis is uncertain]. These treatment history data inform recommendations.' },
        ],
      })
    }

    conditions.push({
      name: 'Adjustment Disorder', dsmCode: 'F43.2x',
      dsmExcerpt: 'Emotional or behavioral symptoms in response to identifiable stressor within 3 months. Marked distress or significant impairment. Does not meet criteria for another disorder. (DSM-5-TR 309.x)',
      relevance: `Current evaluation context constitutes a stressor. Stressors: ${parsedOb.recent?.current_stressors ?? 'review intake'}. Onset: ${complaints?.onset_timeline ?? 'not documented'}.`,
      dataSummary: `Temporal relationship between stressor and symptoms, proportionality, whether a more specific diagnosis is warranted.`,
      contradictingData: `${hasDepressive ? 'If full MDD criteria are met, Adjustment Disorder should not be diagnosed — the more specific diagnosis takes precedence.' : 'If no clinically significant distress or impairment is present, Adjustment Disorder is not warranted.'}`,
      templateOptions: [
        { title: 'Adjustment disorder confirmed', body: 'The examinee\'s emotional and behavioral symptoms are temporally linked to an identifiable stressor and consistent with an Adjustment Disorder. Symptoms developed within three months of the stressor onset, represent clinically significant distress or impairment, and do not meet criteria for a more specific mental disorder. The subtype is best characterized as [with depressed mood / with anxiety / with mixed anxiety and depressed mood / with disturbance of conduct / with mixed disturbance of emotions and conduct / unspecified].' },
        { title: 'Symptoms exceed adjustment — more specific dx warranted', body: 'While the temporal relationship to a stressor is documented, the severity and scope of symptoms exceed what would be characterized as an adjustment reaction. The clinical picture more closely meets criteria for [Major Depressive Disorder / Generalized Anxiety Disorder / other specified disorder], which takes diagnostic precedence per DSM-5-TR. The more specific diagnosis should be assigned.' },
        { title: 'Expected response — does not meet clinical threshold', body: 'The examinee reports distress related to [current circumstances]; however, the response appears proportionate to the situation and does not reach the clinical threshold required for an Adjustment Disorder diagnosis. The distress does not represent marked impairment or exceed what would be expected given the nature and severity of the stressor.' },
        { title: 'Chronic stressor — adjustment may be prolonged', body: 'The stressor is chronic and ongoing rather than a discrete event, which may produce a prolonged adjustment reaction that persists as long as the stressor continues. DSM-5-TR permits the persistent specifier when the stressor or its consequences are ongoing. The prognosis for symptom resolution is directly tied to resolution or adaptation to the chronic stressor.' },
        { title: 'Stressor has resolved — symptoms persisting', body: 'The identifiable stressor has resolved; however, symptoms persist beyond the expected adaptation period. Per DSM-5-TR, Adjustment Disorder symptoms should not persist for more than six months after the stressor (or its consequences) has terminated. If symptoms continue, an alternative diagnosis should be considered, as the presentation may reflect a more enduring condition that was triggered but not solely caused by the stressor.' },
        { title: 'Pre-existing vulnerability amplifying reaction', body: 'The adjustment reaction is occurring in the context of pre-existing psychological vulnerability that may amplify the stress response. While the current symptoms are primarily adjustment-related, the underlying vulnerability suggests that the examinee may be at higher risk for developing a more severe condition if the stressor continues or escalates. Supportive intervention is recommended as both treatment and prevention.' },
      ],
    })

    if (hasSubstance) {
      conditions.push({
        name: 'Substance Use Disorder', dsmCode: 'F1x.x',
        dsmExcerpt: 'Problematic pattern of use leading to impairment or distress, 2+ of 11 criteria in 12 months. (DSM-5-TR)',
        relevance: `Substance use documented. Alcohol: ${substance?.alcohol_use ?? '—'}. Drugs: ${substance?.drug_use ?? '—'}.`,
        dataSummary: `Use patterns, functional impact, treatment history: ${substance?.substance_treatment ?? 'none reported'}.`,
        contradictingData: `If use is infrequent with no documented impairment, diagnostic threshold is not met.`,
        templateOptions: [
          { title: 'SUD confirmed — criteria met', body: 'Self-reported substance use patterns, functional impact, and available collateral data are consistent with a Substance Use Disorder ([specify substance], [mild/moderate/severe] severity). The examinee meets [number] of 11 DSM-5-TR criteria within the past 12 months. The substance use is relevant to the referral question in that it may [affect cognitive functioning during evaluation, contribute to the clinical picture, represent a treatment target, serve as a risk factor].' },
          { title: 'Use documented but below diagnostic threshold', body: 'Substance use is documented and acknowledged; however, the current pattern does not meet the DSM-5-TR threshold of two or more criteria within a 12-month period. Use appears [recreational/occasional/social] without evidence of compulsive use, tolerance, withdrawal, or functional impairment meeting diagnostic criteria. The substance use is noted but does not warrant a formal SUD diagnosis at this time.' },
          { title: 'SUD in remission — historical diagnosis noted', body: 'The examinee has a historical Substance Use Disorder that is currently in [early/sustained] remission. The period of remission is [specify duration], supported by [self-report/drug screening/treatment records]. The historical diagnosis is noted as relevant context but does not represent a current active condition. Relapse risk should be monitored.' },
          { title: 'Minimization suspected in forensic context', body: 'Given the forensic evaluation context, the examinee\'s self-report of substance use may underrepresent the true extent of involvement. Collateral data, if available, should be compared against self-report. The current formulation is based on available information but may require revision if additional data emerge.' },
          { title: 'Substance use complicating diagnostic picture', body: 'Active substance use complicates the diagnostic picture by potentially mimicking, exacerbating, or masking other psychiatric conditions. The contribution of substance use to the overall clinical presentation must be carefully parsed, as it has implications for treatment planning and for answering the specific referral question.' },
          { title: 'Treatment history informs prognosis', body: 'The examinee\'s substance use treatment history includes [specify: no prior treatment / outpatient counseling / inpatient rehabilitation / medication-assisted treatment / 12-step program]. Treatment engagement and response to date have been [good/partial/poor], which informs the prognosis for sustained recovery and guides treatment recommendations in the context of this evaluation.' },
        ],
      })
    }

    // Malingering if forensic context
    if (intakeRow?.charges) {
      conditions.push({
        name: 'Malingering', dsmCode: 'Z76.5',
        dsmExcerpt: 'Intentional production of false or exaggerated symptoms motivated by external incentives. Not a mental disorder. (DSM-5-TR)',
        relevance: `Forensic context with pending charges: ${intakeRow.charges}. External incentive is present.`,
        dataSummary: `Validity testing: ${stageIndex >= 2 ? 'review MMPI-3 validity scales and standalone measures' : 'pending'}. Cross-method consistency.`,
        contradictingData: `If all validity indicators are within normal limits and presentation is consistent across methods, malingering is not supported.`,
        templateOptions: [
          { title: 'Credible presentation — validity passed', body: 'Validity testing is consistent with a genuine and credible clinical presentation. Over-reporting indicators on standardized instruments fall within acceptable limits, and the symptom presentation is internally consistent and concordant with behavioral observation. Clinical data can be interpreted at face value for the purposes of this evaluation.' },
          { title: 'Possible exaggeration detected — interpret with caution', body: 'Validity indicators suggest possible symptom exaggeration or over-reporting. While not definitive for malingering, the elevated scores on [specify scales] indicate that self-reported symptoms may overstate the examinee\'s actual level of distress or impairment. Clinical conclusions should rely more heavily on behavioral observation and collateral data than on self-report measures in this case.' },
          { title: 'Strong feigning indicators — credibility compromised', body: 'Multiple validity indicators converge on a pattern strongly suggestive of symptom fabrication or gross exaggeration. Self-report clinical data cannot be considered reliable and should not form the basis of diagnostic conclusions. The forensic context, including pending charges of [specify], provides a clear external incentive for symptom misrepresentation.' },
          { title: 'External incentive present but presentation credible', body: 'The forensic context provides a clear external incentive for symptom misrepresentation. However, validity testing and cross-method consistency support the credibility of the clinical presentation. The presence of external incentive alone does not establish malingering, and in this case, the weight of evidence supports genuine symptom reporting despite the motivational context.' },
          { title: 'Partial exaggeration of genuine symptoms', body: 'The data pattern is most consistent with partial malingering — the embellishment of genuine symptoms for secondary gain. The examinee likely experiences some degree of authentic psychological distress, but the severity is overstated relative to what objective measures and behavioral observation support. Diagnostic formulations should be based on the estimated genuine baseline rather than the inflated self-report.' },
          { title: 'Validity inconclusive — mixed indicators', body: 'Validity testing produced a mixed and inconclusive profile. Some indicators support genuine responding while others suggest mild over-reporting tendencies. In the absence of a clear resolution, clinical conclusions are drawn with appropriate conservatism, weighting behavioral observation and collateral data alongside self-report. The overall impression is that the presentation is [probably genuine / of uncertain credibility].' },
        ],
      })
    }
  }

  // ─────────────────────────────────────────────────
  // Cross-cutting: TBI — only if head injury documented
  // ─────────────────────────────────────────────────
  if (has(health?.head_injuries) && !et.includes('capacity')) {
    conditions.push({
      name: 'Neurocognitive Disorder Due to TBI', dsmCode: 'S06.x / F02.8x',
      dsmExcerpt: 'Cognitive decline with evidence of TBI (impact to head, acceleration/deceleration, blast). Deficits present immediately or after recovery of consciousness. May be major (interferes with independence) or mild (does not interfere). (DSM-5-TR)',
      relevance: `Documented head injury: ${health!.head_injuries}. Cognitive effects of TBI may influence presentation and must be considered in the differential.`,
      dataSummary: `Neuropsychological profile: ${stageIndex >= 2 ? 'review cognitive testing pattern for TBI-consistent deficits (processing speed, executive function, memory)' : 'pending'}. Injury severity indicators, recovery trajectory.`,
      contradictingData: `If cognitive testing shows no deficits, or if injury was minor with no LOC and negative neuroimaging, clinically significant TBI effects are unlikely.`,
      templateOptions: [
        { title: 'TBI with confirmed cognitive sequelae', body: 'Documented traumatic brain injury with neuropsychological testing revealing a pattern of cognitive deficits consistent with post-traumatic sequelae, particularly in [processing speed, executive function, memory, attention]. The severity and distribution of deficits are commensurate with the reported injury severity and mechanism. These cognitive effects are relevant to the current evaluation in that they may [impact competency-related abilities, contribute to the clinical presentation, affect treatment response, alter the risk profile, reduce cognitive reserve].' },
        { title: 'TBI documented but no current cognitive deficits', body: 'TBI is documented in the medical history; however, current neuropsychological testing does not reveal cognitive deficits attributable to the reported injury. Scores across cognitive domains fall within expected limits, suggesting either full recovery from the injury, a mild injury without lasting effects, or adequate compensation. The historical TBI is noted but does not appear to be contributing to the current clinical or forensic picture.' },
        { title: 'TBI complicating psychiatric differential', body: 'The documented TBI introduces complexity into the psychiatric differential diagnosis, as post-traumatic neurological changes can produce symptoms that overlap with primary psychiatric conditions, including [mood lability, impulsivity, personality changes, psychotic-like experiences, cognitive concerns]. Careful differentiation between TBI-related neurobehavioral effects and primary psychiatric illness is essential, as the treatment implications differ significantly.' },
        { title: 'Chronic TBI effects — frontal/executive dysfunction', body: 'Neuropsychological testing reveals a pattern of executive dysfunction consistent with frontal lobe injury, including [impaired planning, reduced cognitive flexibility, poor impulse control, difficulty with abstract reasoning, perseveration]. This frontal dysexecutive profile is consistent with the documented mechanism of injury and has direct relevance to [competency-related abilities, risk assessment, capacity for behavioral self-regulation, treatment amenability].' },
        { title: 'Multiple TBIs — cumulative effects', body: 'The examinee reports multiple traumatic brain injuries over the lifespan, raising concern for cumulative neurological effects. The aggregate impact of repeated brain injuries may exceed what would be expected from any single event. The neuropsychological profile should be interpreted in the context of this cumulative exposure history, and the possibility of chronic traumatic encephalopathy (CTE) spectrum changes is noted, though definitive diagnosis is not possible during life.' },
        { title: 'TBI as mitigating factor — forensic consideration', body: 'The documented TBI and associated cognitive and behavioral sequelae are relevant as a potential mitigating factor in the forensic context. Post-traumatic changes in [impulse control, judgment, emotional regulation, social cognition] may have contributed to the behavior in question and should be considered in the overall forensic formulation. The degree to which TBI-related deficits contributed to the behavior versus other factors requires careful analysis.' },
        { title: 'Neuroimaging recommended to corroborate', body: 'Neuropsychological findings are suggestive of TBI-related cognitive effects; however, neuroimaging (MRI with susceptibility-weighted imaging) is recommended to corroborate the injury and assess for structural abnormalities including [contusions, diffuse axonal injury, white matter changes, cortical atrophy]. Imaging findings would strengthen the diagnostic formulation and are relevant to medico-legal proceedings.' },
        { title: 'Mild TBI — post-concussive symptoms', body: 'The reported injury meets criteria for mild TBI (brief or no loss of consciousness, GCS 13-15). Current concerns of [headache, dizziness, concentration difficulty, irritability, sleep disturbance, light/noise sensitivity] are consistent with post-concussive symptoms. While most mild TBI symptoms resolve within weeks to months, a minority of patients develop persistent post-concussive syndrome. The relationship between ongoing symptoms and the injury should be evaluated in the context of other potential contributing factors including pre-existing conditions and psychological factors.' },
      ],
    })
  }

  return conditions
}

// ---------------------------------------------------------------------------
// DSM-5-TR condition catalog for manual addition
// ---------------------------------------------------------------------------
interface DsmCatalogEntry {
  readonly name: string
  readonly dsmCode: string
  readonly category: string
  readonly evalTypes: readonly string[]  // empty = all eval types
}

const DSM_CATALOG: readonly DsmCatalogEntry[] = [
  // Psychotic Spectrum
  { name: 'Schizophrenia', dsmCode: 'F20.9', category: 'Psychotic Spectrum', evalTypes: ['cst', 'competency'] },
  { name: 'Schizoaffective Disorder', dsmCode: 'F25.x', category: 'Psychotic Spectrum', evalTypes: ['cst', 'competency'] },
  { name: 'Brief Psychotic Disorder', dsmCode: 'F23', category: 'Psychotic Spectrum', evalTypes: ['cst', 'competency'] },
  { name: 'Delusional Disorder', dsmCode: 'F22', category: 'Psychotic Spectrum', evalTypes: ['cst', 'competency'] },
  { name: 'Substance-Induced Psychotic Disorder', dsmCode: 'F1x.x59', category: 'Psychotic Spectrum', evalTypes: ['cst', 'competency'] },
  // Mood Disorders
  { name: 'Major Depressive Disorder', dsmCode: 'F33.x', category: 'Mood Disorders', evalTypes: [] },
  { name: 'Bipolar I Disorder', dsmCode: 'F31.x', category: 'Mood Disorders', evalTypes: [] },
  { name: 'Bipolar II Disorder', dsmCode: 'F31.81', category: 'Mood Disorders', evalTypes: [] },
  { name: 'Persistent Depressive Disorder', dsmCode: 'F34.1', category: 'Mood Disorders', evalTypes: [] },
  { name: 'Adjustment Disorder', dsmCode: 'F43.2x', category: 'Mood Disorders', evalTypes: [] },
  // Anxiety & Trauma
  { name: 'Posttraumatic Stress Disorder', dsmCode: 'F43.10', category: 'Anxiety & Trauma', evalTypes: [] },
  { name: 'Acute Stress Disorder', dsmCode: 'F43.0', category: 'Anxiety & Trauma', evalTypes: ['ptsd', 'personal injury'] },
  { name: 'Generalized Anxiety Disorder', dsmCode: 'F41.1', category: 'Anxiety & Trauma', evalTypes: [] },
  { name: 'Panic Disorder', dsmCode: 'F41.0', category: 'Anxiety & Trauma', evalTypes: [] },
  { name: 'Social Anxiety Disorder', dsmCode: 'F40.10', category: 'Anxiety & Trauma', evalTypes: [] },
  // Personality Disorders
  { name: 'Antisocial Personality Disorder', dsmCode: 'F60.2', category: 'Personality Disorders', evalTypes: ['risk', 'cst', 'competency'] },
  { name: 'Borderline Personality Disorder', dsmCode: 'F60.3', category: 'Personality Disorders', evalTypes: [] },
  { name: 'Narcissistic Personality Disorder', dsmCode: 'F60.81', category: 'Personality Disorders', evalTypes: [] },
  { name: 'Personality Disorder Features', dsmCode: 'F60.x', category: 'Personality Disorders', evalTypes: ['custody'] },
  // Substance Use
  { name: 'Alcohol Use Disorder', dsmCode: 'F10.x', category: 'Substance Use', evalTypes: [] },
  { name: 'Cannabis Use Disorder', dsmCode: 'F12.x', category: 'Substance Use', evalTypes: [] },
  { name: 'Opioid Use Disorder', dsmCode: 'F11.x', category: 'Substance Use', evalTypes: [] },
  { name: 'Stimulant Use Disorder', dsmCode: 'F15.x', category: 'Substance Use', evalTypes: [] },
  { name: 'Substance Use Disorder', dsmCode: 'F1x.x', category: 'Substance Use', evalTypes: [] },
  // Neurocognitive
  { name: 'Major Neurocognitive Disorder', dsmCode: 'F02.8x', category: 'Neurocognitive', evalTypes: ['capacity', 'testamentary'] },
  { name: 'Mild Neurocognitive Disorder', dsmCode: 'G31.84', category: 'Neurocognitive', evalTypes: ['capacity', 'testamentary'] },
  { name: 'Neurocognitive Disorder Due to TBI', dsmCode: 'S06.x / F02.8x', category: 'Neurocognitive', evalTypes: [] },
  { name: 'Delirium', dsmCode: 'F05', category: 'Neurocognitive', evalTypes: ['capacity'] },
  { name: 'Intellectual Disability', dsmCode: 'F7x', category: 'Neurocognitive', evalTypes: ['cst', 'competency'] },
  // Behavioral / Impulse
  { name: 'Intermittent Explosive Disorder', dsmCode: 'F63.81', category: 'Behavioral', evalTypes: ['risk'] },
  { name: 'Conduct Disorder', dsmCode: 'F91.x', category: 'Behavioral', evalTypes: ['risk', 'juvenile'] },
  { name: 'ADHD', dsmCode: 'F90.x', category: 'Behavioral', evalTypes: [] },
  // Dissociative
  { name: 'Dissociative Identity Disorder', dsmCode: 'F44.81', category: 'Dissociative', evalTypes: [] },
  { name: 'Dissociative Amnesia', dsmCode: 'F44.0', category: 'Dissociative', evalTypes: [] },
  // Validity / Forensic
  { name: 'Malingering', dsmCode: 'Z76.5', category: 'Response Validity', evalTypes: [] },
  { name: 'Malingered / Exaggerated PTSD Symptoms', dsmCode: 'Z76.5', category: 'Response Validity', evalTypes: ['ptsd', 'personal injury'] },
  { name: 'Factitious Disorder', dsmCode: 'F68.10', category: 'Response Validity', evalTypes: [] },
  // Risk Frameworks
  { name: 'Structured Violence Risk (HCR-20v3)', dsmCode: 'N/A — risk formulation', category: 'Risk Frameworks', evalTypes: ['risk'] },
  // Other
  { name: 'Somatic Symptom Disorder', dsmCode: 'F45.1', category: 'Other', evalTypes: ['personal injury'] },
  { name: 'Depressive Pseudodementia', dsmCode: 'F33.x', category: 'Other', evalTypes: ['capacity'] },
  { name: 'Insomnia Disorder', dsmCode: 'G47.00', category: 'Other', evalTypes: [] },
  { name: 'Unspecified Mental Disorder', dsmCode: 'F99', category: 'Other', evalTypes: [] },
] as const

function buildManualCondition(entry: DsmCatalogEntry): DiagCondition {
  return {
    name: entry.name,
    dsmCode: entry.dsmCode,
    dsmExcerpt: `See DSM-5-TR criteria for ${entry.name} (${entry.dsmCode}).`,
    relevance: 'Manually added by clinician for diagnostic consideration.',
    dataSummary: 'Review case data and testing results for evidence supporting or contradicting this diagnosis.',
    contradictingData: '',
    templateOptions: [
      { title: 'Criteria met — diagnosis supported', body: `Clinical data, testing results, and behavioral observations are consistent with a diagnosis of ${entry.name}. [Provide specific supporting evidence and rationale.]` },
      { title: 'Partial criteria — under consideration', body: `Some features of ${entry.name} are present; however, full diagnostic criteria are not clearly met at this time. [Specify which criteria are met and which require further evaluation.]` },
      { title: 'Diagnosis not supported', body: `The available clinical data do not support a diagnosis of ${entry.name}. [Provide basis for ruling out and identify alternative explanations.]` },
      { title: 'Deferred — insufficient data', body: `Insufficient data are currently available to render a diagnostic opinion regarding ${entry.name}. Additional [testing/collateral/records] would be needed to adequately evaluate this condition.` },
    ],
  }
}

// ---------------------------------------------------------------------------
// DiagnosticsSubTab — main component
// ---------------------------------------------------------------------------

function DiagnosticsSubTab({
  caseRow,
  intakeRow,
  onboardingSections,
  stageIndex,
  onBuildReport,
}: {
  readonly caseRow: CaseRow
  readonly intakeRow: PatientIntakeRow | null
  readonly onboardingSections: readonly PatientOnboardingRow[]
  readonly stageIndex: number
  readonly onBuildReport: (formulation: {
    impressions: string; ruledOut: string; validity: string; prognosis: string;
    conditions: { name: string; dsmCode: string; notes: string; status: string }[]
  }) => void
}): React.JSX.Element {
  const [clinicianNotes, setClinicianNotes] = useState<Record<string, string>>({})
  const [selectedTemplates, setSelectedTemplates] = useState<Record<string, number | null>>({})
  const [declinedConditions, setDeclinedConditions] = useState<Record<string, boolean>>({})
  const [ruledOutConditions, setRuledOutConditions] = useState<Record<string, boolean>>({})
  const [deletedConditions, setDeletedConditions] = useState<Record<string, boolean>>({})
  const [attestationChecked, setAttestationChecked] = useState(false)
  const [formReviewed, setFormReviewed] = useState(false)
  const [clinicalObsNotes, setClinicalObsNotes] = useState<Record<string, string>>({})
  const [reportDrafts, setReportDrafts] = useState<string[]>([])
  const [currentReport, setCurrentReport] = useState<string>('')
  const [reportBuilding, setReportBuilding] = useState(false)
  const [addedConditions, setAddedConditions] = useState<DiagCondition[]>([])
  const [showAddDropdown, setShowAddDropdown] = useState(false)

  const parsedOb = useMemo(() => {
    const map: Record<string, Record<string, string>> = {}
    for (const row of onboardingSections) {
      try { map[row.section] = JSON.parse(row.content) as Record<string, string> } catch { /* skip */ }
    }
    return map
  }, [onboardingSections])

  const baseConditions = useMemo(() => {
    return getDiagnosticConsiderations(caseRow.evaluation_type, parsedOb, intakeRow, stageIndex)
  }, [caseRow.evaluation_type, parsedOb, intakeRow, stageIndex])

  const allConditions = useMemo(() => {
    return [...baseConditions, ...addedConditions]
  }, [baseConditions, addedConditions])

  const handleNoteChange = useCallback((key: string, value: string) => {
    setClinicianNotes((prev) => ({ ...prev, [key]: value }))
  }, [])

  const handleTemplateSelect = useCallback((condName: string, idx: number, body: string) => {
    setSelectedTemplates((prev) => ({ ...prev, [condName]: idx }))
    setClinicianNotes((prev) => ({ ...prev, [condName]: body }))
  }, [])

  const fullName = `${caseRow.examinee_last_name}, ${caseRow.examinee_first_name}`
  const age = caseRow.examinee_dob ? calcAge(caseRow.examinee_dob) : '—'
  const instruments = getInstrumentsForEvalType(caseRow.evaluation_type)
  const et = (caseRow.evaluation_type ?? '').toLowerCase()

  // Filtered catalog: conditions relevant to this eval type, minus those already present
  const availableToAdd = useMemo(() => {
    const existingNames = new Set(allConditions.map(c => c.name))
    return DSM_CATALOG.filter(entry => {
      if (existingNames.has(entry.name)) return false
      // Show if: no eval type restriction, or matches current eval type
      if (entry.evalTypes.length === 0) return true
      return entry.evalTypes.some(t => et.includes(t))
    })
  }, [allConditions, et])

  // Group available conditions by category for the dropdown
  const catalogByCategory = useMemo(() => {
    const groups: Record<string, DsmCatalogEntry[]> = {}
    for (const entry of availableToAdd) {
      if (!groups[entry.category]) groups[entry.category] = []
      groups[entry.category].push(entry)
    }
    return groups
  }, [availableToAdd])

  const handleAddCondition = useCallback((entry: DsmCatalogEntry) => {
    setAddedConditions(prev => [...prev, buildManualCondition(entry)])
    setShowAddDropdown(false)
  }, [])

  // ── Auto-build Final Diagnostic Formulation from case data + conditions ──
  const autoFormulation = useMemo(() => {
    const conditionsWithNotes = allConditions.filter(c => clinicianNotes[c.name]?.trim())
    const conditionsWithoutNotes = allConditions.filter(c => !clinicianNotes[c.name]?.trim())

    // ── Diagnostic Impressions ──
    const impressionLines: string[] = []
    conditionsWithNotes.forEach(c => {
      const note = clinicianNotes[c.name]!.trim()
      // Determine disposition from clinician note keywords
      const lowerNote = note.toLowerCase()
      const isRuledOut = lowerNote.includes('not supported') || lowerNote.includes('ruled out') ||
        lowerNote.includes('do not support') || lowerNote.includes('does not meet') ||
        lowerNote.includes('not indicated') || lowerNote.includes('not warranted')
      if (!isRuledOut) {
        impressionLines.push(`${c.dsmCode}  ${c.name}`)
      }
    })
    // Add unformulated conditions as "under consideration"
    if (conditionsWithoutNotes.length > 0 && conditionsWithNotes.length > 0) {
      impressionLines.push('')
      impressionLines.push('Conditions under consideration (formulation pending):')
      conditionsWithoutNotes.forEach(c => {
        impressionLines.push(`  ${c.dsmCode}  ${c.name}`)
      })
    } else if (conditionsWithNotes.length === 0) {
      // Nothing formulated yet — list all as under consideration
      allConditions.forEach(c => {
        impressionLines.push(`${c.dsmCode}  ${c.name}  [formulation pending]`)
      })
    }
    const impressions = impressionLines.join('\n')

    // ── Conditions Ruled Out ──
    const ruledOutLines: string[] = []
    conditionsWithNotes.forEach(c => {
      const note = clinicianNotes[c.name]!.trim()
      const lowerNote = note.toLowerCase()
      const isRuledOut = lowerNote.includes('not supported') || lowerNote.includes('ruled out') ||
        lowerNote.includes('do not support') || lowerNote.includes('does not meet') ||
        lowerNote.includes('not indicated') || lowerNote.includes('not warranted')
      if (isRuledOut) {
        // Extract first sentence as the basis
        const firstSentence = note.split(/\.\s/)[0] + '.'
        ruledOutLines.push(`${c.name} (${c.dsmCode}): ${firstSentence}`)
      }
    })
    const ruledOut = ruledOutLines.length > 0
      ? ruledOutLines.join('\n\n')
      : allConditions.length > 0
        ? 'No conditions have been ruled out. Complete individual condition formulations above.'
        : ''

    // ── Response Style & Validity ──
    const validityParts: string[] = []
    const malingeringCond = allConditions.find(c =>
      c.name.toLowerCase().includes('malingering') || c.name.toLowerCase().includes('exaggerated'))
    if (malingeringCond && clinicianNotes[malingeringCond.name]?.trim()) {
      validityParts.push(clinicianNotes[malingeringCond.name]!.trim())
    } else {
      // Build from instruments and stage
      const validityInstruments: string[] = []
      if (instruments.includes('TOMM')) validityInstruments.push('TOMM')
      if (instruments.includes('SIRS-2')) validityInstruments.push('SIRS-2')
      if (instruments.includes('M-FAST')) validityInstruments.push('M-FAST')
      if (instruments.includes('MMPI-3')) validityInstruments.push('MMPI-3 validity scales (F, Fp, FBS, RBS)')
      if (instruments.includes('PAI')) validityInstruments.push('PAI validity indicators (NIM, PIM, MAL)')
      if (instruments.includes('TSI-2')) validityInstruments.push('TSI-2 atypical response scale')

      if (validityInstruments.length > 0) {
        if (stageIndex >= 2) {
          validityParts.push(`Response style was assessed using ${validityInstruments.join(', ')}. All validity indicators should be reviewed and integrated into the overall credibility assessment.`)
        } else {
          validityParts.push(`Response style will be assessed using ${validityInstruments.join(', ')}. Testing is pending.`)
        }
      }

      // Behavioral observation
      validityParts.push(`Behavioral observations during the evaluation: The examinee was [cooperative/guarded/defensive/forthcoming] throughout the clinical interview. Effort and engagement appeared [adequate/variable/questionable]. Self-report was [consistent/inconsistent] with behavioral presentation and collateral data.`)
    }
    const validity = validityParts.join('\n\n')

    // ── Prognosis & Recommendations ──
    const recParts: string[] = []
    const confirmedConditions = conditionsWithNotes.filter(c => {
      const lowerNote = (clinicianNotes[c.name] ?? '').toLowerCase()
      return !(lowerNote.includes('not supported') || lowerNote.includes('ruled out') ||
        lowerNote.includes('do not support') || lowerNote.includes('does not meet') ||
        lowerNote.includes('not indicated') || lowerNote.includes('not warranted'))
    })

    // Eval-type-specific forensic conclusions
    if (et.includes('cst') || et.includes('competency')) {
      recParts.push(`Based on the findings of this evaluation, it is the opinion of the undersigned that ${fullName} is [competent/not competent] to stand trial at this time. [If not competent: The primary factors contributing to the competency deficit are [specify conditions]. The prognosis for restoration to competency through [inpatient/outpatient] treatment is [favorable/guarded/poor], with an estimated restoration period of [timeframe].]`)
    } else if (et.includes('custody')) {
      recParts.push(`Based on the findings of this evaluation and consistent with the best interests of the child(ren), the following custody and parenting plan recommendations are offered:`)
      recParts.push(`1. Primary residential custody: [recommendation]\n2. Parenting time schedule: [recommendation]\n3. Decision-making authority: [recommendation]\n4. Therapeutic interventions: [recommendation]\n5. Conditions or stipulations: [recommendation]`)
    } else if (et.includes('risk')) {
      recParts.push(`Based on integration of all assessment data through structured professional judgment, the overall violence risk level is assessed as [LOW / MODERATE / HIGH].`)
      recParts.push(`Risk management recommendations:\n1. Supervision level: [recommendation]\n2. Treatment targets: [recommendation]\n3. Substance use monitoring: [recommendation]\n4. Community supports: [recommendation]\n5. Conditions for risk reduction: [recommendation]`)
    } else if (et.includes('ptsd')) {
      const hasValidPTSD = confirmedConditions.some(c => c.name === 'Posttraumatic Stress Disorder')
      if (hasValidPTSD) {
        recParts.push(`The examinee meets DSM-5-TR diagnostic criteria for Posttraumatic Stress Disorder. The condition is causally linked to the reported traumatic event and is associated with [significant/moderate] functional impairment.`)
      }
      recParts.push(`Treatment recommendations:\n1. Evidence-based trauma therapy: [CPT / PE / EMDR]\n2. Pharmacotherapy: [SSRI consideration]\n3. Prognosis with treatment: [favorable/guarded]\n4. Prognosis without treatment: [chronic course expected]\n5. Estimated duration of treatment: [timeframe]`)
    } else if (et.includes('capacity')) {
      recParts.push(`Based on the findings of this evaluation, it is the opinion of the undersigned that ${fullName} [has/lacks] the capacity to [manage financial affairs / make medical decisions / execute legal documents / live independently].`)
      recParts.push(`Recommendations:\n1. [Guardianship/conservatorship recommendation]\n2. [Protective measures]\n3. [Treatment for reversible contributors]\n4. [Re-evaluation timeline]`)
    } else {
      recParts.push(`Diagnostic conclusions and treatment recommendations are summarized below.`)
    }

    // Add confirmed conditions summary
    if (confirmedConditions.length > 0) {
      const condList = confirmedConditions.map(c => `${c.name} (${c.dsmCode})`).join(', ')
      recParts.push(`\nDiagnoses informing these recommendations: ${condList}.`)
    }

    const prognosis = recParts.join('\n\n')

    return { impressions, ruledOut, validity, prognosis }
  }, [allConditions, clinicianNotes, instruments, stageIndex, fullName, et])

  // ── Gate tracking ──
  // Gate 1: Every condition has either a clinician formulation or explicit "No additional comments"
  const conditionCompletionMap = useMemo(() => {
    const map: Record<string, 'complete' | 'declined' | 'ruled_out' | 'deleted' | 'pending'> = {}
    for (const cond of allConditions) {
      if (deletedConditions[cond.name]) {
        map[cond.name] = 'deleted'
      } else if (ruledOutConditions[cond.name]) {
        map[cond.name] = 'ruled_out'
      } else if (declinedConditions[cond.name]) {
        map[cond.name] = 'declined'
      } else if (clinicianNotes[cond.name]?.trim()) {
        map[cond.name] = 'complete'
      } else {
        map[cond.name] = 'pending'
      }
    }
    return map
  }, [allConditions, clinicianNotes, declinedConditions, ruledOutConditions, deletedConditions])

  const gate1_allConditionsFormulated = useMemo(() => {
    return allConditions.length > 0 && allConditions.every(c =>
      conditionCompletionMap[c.name] !== 'pending')
  }, [allConditions, conditionCompletionMap])

  // Gate 2: Final Formulation reviewed — all 4 fields have content and doctor clicked "Review Complete"
  const gate2_finalFormulationComplete = useMemo(() => {
    return formReviewed &&
      !!clinicianNotes._impressions?.trim() &&
      !!clinicianNotes._ruledOut?.trim() &&
      !!clinicianNotes._validity?.trim() &&
      !!clinicianNotes._prognosis?.trim()
  }, [formReviewed, clinicianNotes])

  // Gate 3: Attestation signed
  const gate3_attestationSigned = attestationChecked

  const allGatesPassed = gate1_allConditionsFormulated && gate2_finalFormulationComplete && gate3_attestationSigned

  const completedCount = allConditions.filter(c =>
    conditionCompletionMap[c.name] !== 'pending').length

  // Seed the formulation fields when auto-formulation updates, but only for empty fields
  const [formSeeded, setFormSeeded] = useState(false)
  useEffect(() => {
    if (!formSeeded && allConditions.length > 0) {
      setClinicianNotes(prev => ({
        ...prev,
        _impressions: prev._impressions || autoFormulation.impressions,
        _ruledOut: prev._ruledOut || autoFormulation.ruledOut,
        _validity: prev._validity || autoFormulation.validity,
        _prognosis: prev._prognosis || autoFormulation.prognosis,
      }))
      setFormSeeded(true)
    }
  }, [allConditions, autoFormulation, formSeeded])

  const diagNoteStyle: React.CSSProperties = {
    width: '100%', minHeight: 60, padding: '6px 8px', fontSize: 12,
    fontFamily: 'inherit', lineHeight: 1.6, boxSizing: 'border-box' as const,
    border: '1px solid var(--border)', borderRadius: 4,
    background: 'var(--bg)', color: 'var(--text)', resize: 'vertical',
  }

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Diagnostic Workspace</div>

      {/* ================================================================== */}
      {/*  CASE HEADER — dense DataRow tables                               */}
      {/* ================================================================== */}
      <div style={threeColGrid}>
        <div>
          <table style={dataTableStyle}>
            <tbody>
              <SectionHead title="Patient" />
              <DataRow label="Name" value={fullName} />
              <DataRow label="DOB" value={caseRow.examinee_dob ? `${caseRow.examinee_dob}  (age ${age})` : undefined} />
              <DataRow label="Gender" value={caseRow.examinee_gender ?? undefined} />
              <DataRow label="Language" value={parsedOb.contact?.primary_language} />
            </tbody>
          </table>
          <NarrativeBlock label="Concern" value={parsedOb.complaints?.primary_complaint ?? intakeRow?.presenting_complaint ?? undefined} />
        </div>
        <div>
          <table style={dataTableStyle}>
            <tbody>
              <SectionHead title="Referral" />
              <DataRow label="Type" value={intakeRow?.eval_type ?? caseRow.evaluation_type ?? undefined} />
              <DataRow label="Source" value={intakeRow?.referral_source ?? caseRow.referral_source ?? undefined} />
              <DataRow label="Jurisdiction" value={intakeRow?.jurisdiction ?? undefined} />
            </tbody>
          </table>
          <NarrativeBlock label="Charges" value={intakeRow?.charges ?? undefined} />
        </div>
        <div style={{ background: 'var(--sidebar-bg, #f5f5f5)', borderRadius: 6, padding: '0 10px 8px' }}>
          <table style={dataTableStyle}>
            <tbody>
              <SectionHead title="Clinical Summary" />
              <DataRow label="Eval Type" value={intakeRow?.eval_type ?? caseRow.evaluation_type ?? undefined} />
              <DataRow label="Test Battery" value={instruments.length > 0 ? instruments.join(', ') : undefined} />
              <DataRow label="Setting" value={parsedOb.contact?.eval_setting ?? 'In-Person'} />
              <DataRow label="Stage" value={(['Onboarding', 'Testing', 'Interview', 'Diagnostics', 'Review', 'Complete'])[stageIndex] ?? undefined} />
              <DataRow label="Intake Date" value={intakeRow?.created_at ? intakeRow.created_at.split('T')[0] : caseRow.created_at?.split('T')[0]} />
              <DataRow label="Due Date" value={intakeRow?.report_deadline ?? undefined} />
              <DataRow label="Prior Dx" value={shortNote(parsedOb.mental?.previous_diagnoses)} />
              <DataRow label="Hx Treatment" value={shortNote(parsedOb.mental?.previous_treatment)} />
              <DataRow label="Medications" value={shortNote(parsedOb.mental?.psych_medications)} />
              <DataRow label="Medical" value={shortNote(parsedOb.health?.medical_conditions)} />
              <DataRow label="Neurological" value={parsedOb.health?.head_injuries && !parsedOb.health.head_injuries.toLowerCase().match(/^(no |none|denies)/) ? shortNote(parsedOb.health.head_injuries) : undefined} />
              <DataRow label="Substance Use" value={shortNote([
                parsedOb.substance?.alcohol_use && !parsedOb.substance.alcohol_use.toLowerCase().match(/^(—|none|denies|no )/) ? parsedOb.substance.alcohol_use : null,
                parsedOb.substance?.drug_use && !parsedOb.substance.drug_use.toLowerCase().match(/^(—|none|denies|no )/) ? parsedOb.substance.drug_use : null,
              ].filter(Boolean).join(', ') || undefined)} />
              <DataRow label="Sleep" value={shortNote(parsedOb.health?.sleep_quality)} />
              <DataRow label="Stressors" value={shortNote(parsedOb.complaints?.stressors ?? parsedOb.mental?.current_stressors)} />
            </tbody>
          </table>
          {/* Risk flags — inside Clinical Summary column */}
          {(parsedOb.mental?.violence_history && !parsedOb.mental.violence_history.toLowerCase().includes('denies')) ||
           (parsedOb.mental?.self_harm_history && !parsedOb.mental.self_harm_history.toLowerCase().includes('denies')) ||
           (parsedOb.substance?.drug_use && !parsedOb.substance.drug_use.toLowerCase().includes('denies')) ? (
            <div style={{ margin: '4px 0 6px', padding: '5px 8px', background: '#fff8e1', borderLeft: '3px solid #ff9800', fontSize: 10, color: '#795548', lineHeight: 1.5, borderRadius: '0 4px 4px 0' }}>
              <strong>Flagged: </strong>
              {parsedOb.mental?.violence_history && !parsedOb.mental.violence_history.toLowerCase().includes('denies') && <span>Violence hx. </span>}
              {parsedOb.mental?.self_harm_history && !parsedOb.mental.self_harm_history.toLowerCase().includes('denies') && <span>Self-harm hx. </span>}
              {parsedOb.substance?.drug_use && !parsedOb.substance.drug_use.toLowerCase().includes('denies') && <span>Substance use. </span>}
              {parsedOb.health?.head_injuries && !parsedOb.health.head_injuries.toLowerCase().includes('no reported') && <span>TBI hx. </span>}
            </div>
          ) : null}
        </div>
      </div>

      {/* ================================================================== */}
      {/*  DIAGNOSTIC CONSIDERATIONS                                        */}
      {/* ================================================================== */}
      {/* ── Section header with integrated progress tracker + Add button ── */}
      <div style={{ marginTop: 16, padding: '10px 0 8px', borderBottom: '1px solid var(--text-secondary)', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text)', whiteSpace: 'nowrap' }}>Diagnostic Considerations</span>
          <div style={{ flex: 1, height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              width: allConditions.length > 0 ? `${(completedCount / allConditions.length) * 100}%` : '0%',
              height: '100%', borderRadius: 3, transition: 'width 0.3s',
              background: completedCount === allConditions.length ? '#2e7d32' : '#1976d2',
            }} />
          </div>
          <span style={{ fontSize: 10, fontWeight: 600, color: gate1_allConditionsFormulated ? '#2e7d32' : 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
            {completedCount}/{allConditions.length} {gate1_allConditionsFormulated ? '✓' : ''}
          </span>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button
              onClick={() => setShowAddDropdown(!showAddDropdown)}
              style={{
                padding: '3px 10px', fontSize: 10, fontWeight: 600, fontFamily: 'inherit',
                cursor: 'pointer', background: 'var(--bg)', border: '1px solid var(--border)',
                borderRadius: 4, color: 'var(--text-secondary)', whiteSpace: 'nowrap',
              }}
            >
              + Add
            </button>
            {showAddDropdown && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 100,
                width: 320, maxHeight: 400, overflowY: 'auto',
                background: 'var(--bg)', border: '1px solid var(--border)',
                borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
              }}>
                <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 700, color: 'var(--text)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Add Diagnostic Consideration</span>
                  <button onClick={() => setShowAddDropdown(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--text-secondary)', padding: '0 2px' }}>×</button>
                </div>
                {availableToAdd.length === 0 ? (
                  <div style={{ padding: '12px 10px', fontSize: 11, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                    All relevant conditions are already listed.
                  </div>
                ) : (
                  Object.entries(catalogByCategory).map(([category, entries]) => (
                    <div key={category}>
                      <div style={{ padding: '6px 10px 3px', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-secondary)', background: 'var(--sidebar-bg, #f5f5f5)' }}>
                        {category}
                      </div>
                      {entries.map(entry => (
                        <button
                          key={entry.name}
                          onClick={() => handleAddCondition(entry)}
                          style={{
                            display: 'block', width: '100%', textAlign: 'left',
                            padding: '6px 10px', fontSize: 11, fontFamily: 'inherit',
                            background: 'none', border: 'none', borderBottom: '1px solid var(--border)',
                            cursor: 'pointer', color: 'var(--text)',
                          }}
                          onMouseEnter={(e) => { (e.target as HTMLElement).style.background = 'var(--sidebar-bg, #f5f5f5)' }}
                          onMouseLeave={(e) => { (e.target as HTMLElement).style.background = 'none' }}
                        >
                          <span style={{ fontWeight: 600 }}>{entry.name}</span>
                          <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{entry.dsmCode}</span>
                        </button>
                      ))}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {allConditions.map((cond) => {
        const status = conditionCompletionMap[cond.name] ?? 'pending'
        if (status === 'deleted') return null
        const statusColor = status === 'complete' ? '#2e7d32' : status === 'ruled_out' ? '#e65100' : status === 'declined' ? '#6a6a6a' : '#c62828'
        const statusIcon = status === 'complete' ? '●' : status === 'ruled_out' ? '✕' : status === 'declined' ? '○' : '◌'
        const statusLabel = status === 'complete' ? 'Formulated' : status === 'ruled_out' ? 'Ruled Out' : status === 'declined' ? 'No comments' : 'Pending'
        return (
        <div key={cond.name} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--border)', opacity: status === 'ruled_out' ? 0.65 : 1 }}>
          {/* Condition header */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
            <span style={{ color: statusColor, fontSize: 11, flexShrink: 0 }} title={statusLabel}>{statusIcon}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{cond.name}</span>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{cond.dsmCode}</span>
            <span style={{ fontSize: 10, color: statusColor, marginLeft: 'auto', flexShrink: 0 }}>{statusLabel}</span>
          </div>

          {/* Three-column: Why + Case Data | DSM + Contradicting | Formulation */}
          <div style={threeColGrid}>
            <div>
              <div style={clinNoteLabelStyle}>Why Considered</div>
              <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.55, marginBottom: 8 }}>{cond.relevance}</div>
              <div style={clinNoteLabelStyle}>Case Data</div>
              <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.55 }}>{cond.dataSummary}</div>
            </div>
            <div>
              <div style={clinNoteLabelStyle}>DSM-5-TR Reference</div>
              <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.55, marginBottom: 8 }}>{cond.dsmExcerpt}</div>
              {cond.contradictingData ? (
                <>
                  <div style={{ ...clinNoteLabelStyle, color: '#c62828' }}>Contradicting / Rule-Out</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{cond.contradictingData}</div>
                </>
              ) : null}
            </div>
            <div style={{ ...clinNotesColumnStyle, display: 'flex', flexDirection: 'column' }}>
              <div style={{ ...clinNoteLabelStyle, marginTop: 0, paddingTop: 4, flexShrink: 0 }}>Clinician Formulation</div>
              <select
                value={
                  ruledOutConditions[cond.name] ? '__ruleout__' :
                  declinedConditions[cond.name] ? '__decline__' :
                  selectedTemplates[cond.name] != null ? String(selectedTemplates[cond.name]) : ''
                }
                onChange={(e) => {
                  const val = e.target.value
                  // Reset all flags first
                  const clearFlags = () => {
                    setDeclinedConditions(prev => ({ ...prev, [cond.name]: false }))
                    setRuledOutConditions(prev => ({ ...prev, [cond.name]: false }))
                    setDeletedConditions(prev => ({ ...prev, [cond.name]: false }))
                  }
                  if (val === '__delete__') {
                    clearFlags()
                    setDeletedConditions(prev => ({ ...prev, [cond.name]: true }))
                    setSelectedTemplates(prev => ({ ...prev, [cond.name]: null }))
                    setClinicianNotes(prev => ({ ...prev, [cond.name]: '' }))
                  } else if (val === '__ruleout__') {
                    clearFlags()
                    setRuledOutConditions(prev => ({ ...prev, [cond.name]: true }))
                    setSelectedTemplates(prev => ({ ...prev, [cond.name]: null }))
                    setClinicianNotes(prev => ({ ...prev, [cond.name]: `Ruled out: ${cond.name}. ${cond.contradictingData || 'Clinical data does not support this diagnosis.'}` }))
                  } else if (val === '__decline__') {
                    clearFlags()
                    setDeclinedConditions(prev => ({ ...prev, [cond.name]: true }))
                    setSelectedTemplates(prev => ({ ...prev, [cond.name]: null }))
                    setClinicianNotes(prev => ({ ...prev, [cond.name]: '' }))
                  } else if (val === '') {
                    clearFlags()
                    setSelectedTemplates(prev => ({ ...prev, [cond.name]: null }))
                  } else {
                    clearFlags()
                    const idx = parseInt(val, 10)
                    handleTemplateSelect(cond.name, idx, cond.templateOptions[idx].body)
                  }
                }}
                style={{
                  width: '100%', padding: '4px 6px', fontSize: 11, fontFamily: 'inherit',
                  border: '1px solid var(--border)', borderRadius: 3, background: 'var(--bg)',
                  color: (declinedConditions[cond.name] || ruledOutConditions[cond.name]) ? '#6a6a6a' : 'var(--text)',
                  marginBottom: 4, cursor: 'pointer', flexShrink: 0,
                }}
              >
                <option value="">— Select formulation template —</option>
                {cond.templateOptions.map((tpl, idx) => (
                  <option key={idx} value={idx}>{tpl.title}</option>
                ))}
                <option value="__decline__">No additional comments</option>
                <option value="__ruleout__">⊘ Rule Out</option>
                <option value="__delete__">✕ DELETE</option>
              </select>
              {ruledOutConditions[cond.name] ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ padding: '6px 8px', fontSize: 11, color: '#e65100', fontWeight: 600, background: '#fff3e0', border: '1px solid #ffcc80', borderRadius: 4 }}>
                    ⊘ RULED OUT
                  </div>
                  <textarea
                    value={clinicianNotes[cond.name] ?? ''}
                    onChange={(e) => handleNoteChange(cond.name, e.target.value)}
                    placeholder="Basis for ruling out this condition..."
                    style={{ ...diagNoteStyle, flex: 1, minHeight: 60 }}
                  />
                </div>
              ) : declinedConditions[cond.name] ? (
                <div style={{ flex: 1, minHeight: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#6a6a6a', fontStyle: 'italic', border: '1px dashed var(--border)', borderRadius: 4, background: 'var(--bg)' }}>
                  No additional clinician comments for this condition.
                </div>
              ) : (
              <textarea
                value={clinicianNotes[cond.name] ?? ''}
                onChange={(e) => handleNoteChange(cond.name, e.target.value)}
                placeholder="Clinical notes for this condition..."
                style={{ ...diagNoteStyle, flex: 1, minHeight: 120 }}
              />
              )}
            </div>
          </div>
        </div>
        )
      })}

      {/* ================================================================== */}
      {/*  FINAL FORMULATION                                                */}
      {/* ================================================================== */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={narrativeSectionHeader}>Final Diagnostic Formulation</div>
        <button
          onClick={() => {
            setClinicianNotes(prev => ({
              ...prev,
              _impressions: autoFormulation.impressions,
              _ruledOut: autoFormulation.ruledOut,
              _validity: autoFormulation.validity,
              _prognosis: autoFormulation.prognosis,
            }))
          }}
          style={{
            padding: '4px 10px', fontSize: 11, fontFamily: 'inherit', cursor: 'pointer',
            background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4,
            color: 'var(--text-secondary)',
          }}
          title="Rebuild all fields from the diagnostic considerations and clinician notes above"
        >
          ↻ Rebuild from above
        </button>
      </div>

      <div style={threeColGrid}>
        <div>
          <div style={clinNoteLabelStyle}>Diagnostic Impressions</div>
          <textarea
            value={clinicianNotes._impressions ?? ''}
            onChange={(e) => handleNoteChange('_impressions', e.target.value)}
            placeholder="DSM-5-TR codes and full diagnostic labels..."
            style={{ ...diagNoteStyle, minHeight: 100 }}
          />
          <div style={{ ...clinNoteLabelStyle, marginTop: 10 }}>Conditions Ruled Out</div>
          <textarea
            value={clinicianNotes._ruledOut ?? ''}
            onChange={(e) => handleNoteChange('_ruledOut', e.target.value)}
            placeholder="Conditions considered and ruled out with basis..."
            style={{ ...diagNoteStyle, minHeight: 80 }}
          />
        </div>
        <div>
          <div style={clinNoteLabelStyle}>Response Style & Validity</div>
          <textarea
            value={clinicianNotes._validity ?? ''}
            onChange={(e) => handleNoteChange('_validity', e.target.value)}
            placeholder="Effort, consistency, credibility of self-report..."
            style={{ ...diagNoteStyle, minHeight: 100 }}
          />
          <div style={{ ...clinNoteLabelStyle, marginTop: 10 }}>Prognosis & Recommendations</div>
          <textarea
            value={clinicianNotes._prognosis ?? ''}
            onChange={(e) => handleNoteChange('_prognosis', e.target.value)}
            placeholder="Prognosis, treatment recommendations, referrals..."
            style={{ ...diagNoteStyle, minHeight: 80 }}
          />
        </div>
        <div style={{ ...clinNotesColumnStyle, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* ── Gate 2: Review Complete ── */}
          <div>
            <div style={clinNotesColumnHeader}>Gate 2 — Final Review</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 8 }}>
              Review all four formulation fields. When satisfied, mark the review as complete.
            </div>
            <button
              onClick={() => setFormReviewed(!formReviewed)}
              disabled={!clinicianNotes._impressions?.trim() || !clinicianNotes._ruledOut?.trim() || !clinicianNotes._validity?.trim() || !clinicianNotes._prognosis?.trim()}
              style={{
                width: '100%', padding: '6px 10px', fontSize: 11, fontFamily: 'inherit', cursor: 'pointer',
                background: gate2_finalFormulationComplete ? '#2e7d32' : 'var(--bg)',
                color: gate2_finalFormulationComplete ? '#fff' : 'var(--text)',
                border: `1px solid ${gate2_finalFormulationComplete ? '#2e7d32' : 'var(--border)'}`,
                borderRadius: 4, fontWeight: 600,
                opacity: (!clinicianNotes._impressions?.trim() || !clinicianNotes._ruledOut?.trim() || !clinicianNotes._validity?.trim() || !clinicianNotes._prognosis?.trim()) ? 0.4 : 1,
              }}
            >
              {gate2_finalFormulationComplete ? '✓ Review Complete' : 'Mark Review Complete'}
            </button>
          </div>

          {/* ── Gate 3: Attestation ── */}
          <div>
            <div style={clinNotesColumnHeader}>Attestation</div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '4px 0' }}>
              <input
                type="checkbox"
                checked={attestationChecked}
                onChange={(e) => setAttestationChecked(e.target.checked)}
                style={{ marginTop: 2, flexShrink: 0, width: 14, height: 14, cursor: 'pointer' }}
              />
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                I attest that all conclusions documented herein represent my independent professional judgment. No AI system rendered, suggested, or influenced these diagnostic conclusions.
              </div>
            </div>
          </div>

          {/* ── Build Report ── */}
          <div style={{ marginTop: 8 }}>
            {/* Gate status summary */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 8, fontSize: 10 }}>
              <span style={{ color: gate1_allConditionsFormulated ? '#2e7d32' : '#c62828' }}>{gate1_allConditionsFormulated ? '✓' : '○'} Formulations</span>
              <span style={{ color: gate2_finalFormulationComplete ? '#2e7d32' : '#c62828' }}>{gate2_finalFormulationComplete ? '✓' : '○'} Review</span>
              <span style={{ color: gate3_attestationSigned ? '#2e7d32' : '#c62828' }}>{gate3_attestationSigned ? '✓' : '○'} Attestation</span>
            </div>
            <button
              disabled={!allGatesPassed || reportBuilding}
              onClick={async () => {
                setReportBuilding(true)
                try {
                  // ── 1. Save each diagnostic decision to the database ──
                  for (const c of allConditions) {
                    const status = conditionCompletionMap[c.name]
                    if (status === 'deleted') continue
                    const decision: 'render' | 'rule_out' | 'defer' =
                      status === 'ruled_out' ? 'rule_out' :
                      status === 'complete' ? 'render' : 'defer'
                    await window.psygil.diagnosticDecisions.save({
                      case_id: caseRow.case_id,
                      diagnosis_key: c.name.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
                      icd_code: c.dsmCode,
                      diagnosis_name: c.name,
                      decision,
                      clinician_notes: clinicianNotes[c.name] ?? '',
                    })
                  }

                  // ── 2. Save clinical observation notes as onboarding section ──
                  await window.psygil.onboarding.save({
                    case_id: caseRow.case_id,
                    section: 'diagnostic_notes',
                    data: {
                      impressions: clinicianNotes._impressions ?? '',
                      ruled_out: clinicianNotes._ruledOut ?? '',
                      validity: clinicianNotes._validity ?? '',
                      prognosis: clinicianNotes._prognosis ?? '',
                      clinical_obs: JSON.stringify(clinicalObsNotes),
                      attestation_signed: attestationChecked ? 'true' : 'false',
                      attestation_date: new Date().toISOString(),
                    },
                  })

                  // ── 3. Log audit trail ──
                  await window.psygil.audit.log({
                    caseId: caseRow.case_id,
                    actionType: 'diagnostic_formulation_complete',
                    actorType: 'clinician',
                    details: {
                      conditionsRendered: allConditions.filter(c => conditionCompletionMap[c.name] === 'complete').map(c => c.name),
                      conditionsRuledOut: allConditions.filter(c => conditionCompletionMap[c.name] === 'ruled_out').map(c => c.name),
                      conditionsDeleted: allConditions.filter(c => conditionCompletionMap[c.name] === 'deleted').map(c => c.name),
                      attestationSigned: attestationChecked,
                    },
                  })

                  // ── 4. Build formulation payload and trigger report rebuild ──
                  const condPayload = allConditions
                    .filter(c => conditionCompletionMap[c.name] !== 'deleted')
                    .map(c => ({
                      name: c.name,
                      dsmCode: c.dsmCode,
                      notes: clinicianNotes[c.name] ?? '',
                      status: conditionCompletionMap[c.name] ?? 'pending',
                    }))

                  onBuildReport({
                    impressions: clinicianNotes._impressions ?? '',
                    ruledOut: clinicianNotes._ruledOut ?? '',
                    validity: clinicianNotes._validity ?? '',
                    prognosis: clinicianNotes._prognosis ?? '',
                    conditions: condPayload,
                  })
                } catch (err) {
                  console.error('Build report failed:', err)
                } finally {
                  setReportBuilding(false)
                }
              }}
              style={{
                width: '100%', padding: '8px 12px', fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
                cursor: allGatesPassed && !reportBuilding ? 'pointer' : 'not-allowed',
                background: allGatesPassed ? '#1565c0' : '#ccc',
                color: allGatesPassed ? '#fff' : '#888',
                border: 'none', borderRadius: 5,
                transition: 'background 0.2s',
              }}
              title={allGatesPassed ? 'Save diagnostic decisions and build report' : 'Complete all gates to unlock'}
            >
              {reportBuilding ? '⟳ Saving & Building…' : allGatesPassed ? '⬢ Build Report' : '⬡ Complete Gates to Build'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}



// ---------------------------------------------------------------------------
// ReportSubTab — Editable document editor with "Edit in Word" support
// ---------------------------------------------------------------------------

/** Build pre-populated report content from case data */
function buildReportContent(
  caseRow: CaseRow,
  intakeRow: PatientIntakeRow | null,
  parsedOb: Record<string, Record<string, string>>,
  stageIndex: number,
): { title: string; body: string }[] {
  const fullName = `${caseRow.examinee_last_name ?? ''}, ${caseRow.examinee_first_name ?? ''}`
  const age = caseRow.examinee_dob ? calcAge(caseRow.examinee_dob) : '—'
  const dob = caseRow.examinee_dob ?? '—'
  const evalType = caseRow.evaluation_type ?? 'Psychological Evaluation'
  const evalDate = caseRow.created_at ? new Date(caseRow.created_at).toLocaleDateString() : '—'
  const contact = parsedOb.contact
  const complaints = parsedOb.complaints
  const family = parsedOb.family
  const education = parsedOb.education
  const health = parsedOb.health
  const mental = parsedOb.mental
  const substance = parsedOb.substance
  const legal = parsedOb.legal
  const recent = parsedOb.recent

  const sections: { title: string; body: string }[] = []

  // 1. Identifying Information & Referral
  sections.push({
    title: 'Identifying Information & Referral Question',
    body: `Name: ${fullName}\nDate of Birth: ${dob}\nAge: ${age}\nGender: ${contact?.gender ?? intakeRow?.gender ?? '—'}\nReferral Source: ${intakeRow?.referral_source ?? '—'}\nReferring Attorney/Agency: ${intakeRow?.referring_attorney ?? '—'}\nEvaluation Type: ${evalType}\nDate of Evaluation: ${evalDate}\nCharges/Legal Context: ${intakeRow?.charges ?? '—'}\n\nReferral Question: ${intakeRow?.referral_question ?? intakeRow?.presenting_complaint ?? '[Enter referral question]'}`,
  })

  // 2. Informed Consent & Procedures
  const instruments = getInstrumentsForEvalType(caseRow.evaluation_type)
  const instrumentList = instruments.map((i) => {
    const info = INSTRUMENT_INFO[i]
    return info ? `${i} — ${info.fullName}` : i
  }).join('\n')

  sections.push({
    title: 'Informed Consent & Evaluation Procedures',
    body: `${fullName.split(',')[1]?.trim() ?? 'The examinee'} was informed of the nature and purpose of this evaluation, including limits of confidentiality, the non-treatment nature of the evaluation, and that findings would be documented in a written report. The examinee acknowledged understanding and provided verbal consent to proceed.\n\nThe following assessment procedures were administered:\n${instrumentList}\nClinical Interview\nReview of Collateral Records`,
  })

  // 3. Background Information
  const bgParts: string[] = []
  if (family) {
    bgParts.push(`Family History: ${family.marital_status ? `Marital status: ${family.marital_status}.` : ''} ${family.children ? `Children: ${family.children}.` : ''} ${family.family_mental_health ? `Family psychiatric history: ${family.family_mental_health}.` : ''}`)
  }
  if (education) {
    bgParts.push(`Education & Employment: ${education.highest_education ? `Education: ${education.highest_education}.` : ''} ${education.current_employment ? `Current employment: ${education.current_employment}.` : ''} ${education.military_service ? `Military: ${education.military_service}.` : ''}`)
  }
  if (health) {
    bgParts.push(`Medical History: ${health.medical_conditions ? `Conditions: ${health.medical_conditions}.` : 'No significant medical history reported.'} ${health.head_injuries ? `Head injuries: ${health.head_injuries}.` : ''} ${health.current_medications ? `Medications: ${health.current_medications}.` : ''}`)
  }
  if (mental) {
    bgParts.push(`Mental Health History: ${mental.previous_diagnoses ? `Prior diagnoses: ${mental.previous_diagnoses}.` : 'No prior psychiatric diagnoses reported.'} ${mental.previous_treatment ? `Treatment: ${mental.previous_treatment}.` : ''} ${mental.psych_medications ? `Psychiatric medications: ${mental.psych_medications}.` : ''}`)
  }
  if (substance) {
    bgParts.push(`Substance Use History: ${substance.alcohol_use ? `Alcohol: ${substance.alcohol_use}.` : ''} ${substance.drug_use ? `Drugs: ${substance.drug_use}.` : ''} ${substance.substance_treatment ? `Treatment: ${substance.substance_treatment}.` : ''}`)
  }
  if (legal) {
    bgParts.push(`Legal History: ${legal.arrests_convictions ?? 'No significant criminal history reported.'} ${legal.incarceration_history ? `Incarceration: ${legal.incarceration_history}.` : ''}`)
  }

  sections.push({
    title: 'Background Information',
    body: bgParts.join('\n\n') || '[Background information to be compiled from intake data]',
  })

  // 4. Behavioral Observations
  sections.push({
    title: 'Behavioral Observations',
    body: `[Clinician to document behavioral observations from evaluation sessions including: appearance, demeanor, cooperation level, rapport, speech characteristics, thought process, affect, orientation, and any notable behavioral features.]`,
  })

  // 5. Test Results & Validity
  const testParts = instruments.map((i) => {
    const info = INSTRUMENT_INFO[i]
    if (!info) return `${i}: [Results pending]`
    return `${i} (${info.fullName}):\n${info.isValidity ? '[Validity/effort test results]' : '[Test scores and interpretation]'}`
  })
  sections.push({
    title: 'Test Results & Validity',
    body: stageIndex >= 2
      ? testParts.join('\n\n') || '[Test results to be entered]'
      : '[Testing not yet completed for this case]',
  })

  // 6. Clinical Interview Findings
  sections.push({
    title: 'Clinical Interview Findings',
    body: `Presenting Concerns: ${complaints?.primary_complaint ?? intakeRow?.presenting_complaint ?? '[Enter presenting concerns]'}\n${complaints?.onset_timeline ? `Onset: ${complaints.onset_timeline}` : ''}\n${complaints?.secondary_concerns ? `Secondary Concerns: ${complaints.secondary_concerns}` : ''}\n\n[Clinician to document clinical interview findings including: history of present illness, symptom review, functional assessment, and any additional clinical observations.]`,
  })

  // 7+ Eval-type-specific sections
  const et = (evalType ?? '').toLowerCase()
  if (et.includes('cst') || et.includes('competency')) {
    sections.push({ title: 'Competency Analysis — Dusky Criteria', body: '[Clinician analysis of factual understanding, rational understanding, and ability to consult with counsel per Dusky v. United States (1960).]' })
  } else if (et.includes('custody')) {
    sections.push({ title: 'Parenting Capacity Analysis', body: '[Analysis of parenting capacity based on testing, interview, collateral, and behavioral observations.]' })
    sections.push({ title: 'Best Interest Assessment', body: '[Best interest factors analysis per applicable jurisdiction.]' })
  } else if (et.includes('risk')) {
    sections.push({ title: 'Risk Factor Analysis', body: '[Structured analysis of historical, clinical, and risk management factors. HCR-20v3 and/or other risk instruments.]' })
    sections.push({ title: 'Dynamic Risk Factors', body: '[Current dynamic risk factors including substance use, treatment engagement, social support, and environmental stressors.]' })
    sections.push({ title: 'Risk Level Opinion', body: '[Clinician risk level opinion with structured professional judgment rationale.]' })
  } else if (et.includes('ptsd')) {
    sections.push({ title: 'Trauma History & PTSD Criteria', body: '[Detailed trauma history and criterion-by-criterion PTSD analysis per DSM-5-TR.]' })
  } else if (et.includes('capacity')) {
    sections.push({ title: 'Cognitive & Functional Assessment', body: '[Neuropsychological test results and functional capacity analysis.]' })
    sections.push({ title: 'Capacity Opinion', body: '[Clinician opinion on decisional capacity with supporting data.]' })
  }

  // Diagnostic Impressions (always)
  sections.push({
    title: 'Diagnostic Impressions',
    body: '[Clinician to enter final DSM-5-TR diagnostic impressions based on the Diagnostics tab formulations.]',
  })

  // Summary & Recommendations (always)
  sections.push({
    title: 'Summary & Recommendations',
    body: '[Clinician summary of key findings, opinions, and recommendations.]',
  })

  return sections
}

/** Toolbar button style helper */
const tbBtn: React.CSSProperties = {
  width: 28, height: 28, border: '1px solid #d0d0d0', borderRadius: 3,
  background: '#fff', cursor: 'pointer', fontSize: 12, color: '#444',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  flexShrink: 0,
}
const tbSep: React.CSSProperties = { width: 1, height: 20, background: '#d0d0d0', margin: '0 3px', flexShrink: 0 }
const tbSelect: React.CSSProperties = {
  height: 28, border: '1px solid #d0d0d0', borderRadius: 3, background: '#fff',
  fontSize: 11, color: '#444', cursor: 'pointer', padding: '0 4px',
}

function ReportSubTab({
  caseRow,
  intakeRow,
  onboardingSections,
  stageIndex,
  diagnosticFormulation,
}: {
  readonly caseRow: CaseRow
  readonly intakeRow: PatientIntakeRow | null
  readonly onboardingSections: readonly PatientOnboardingRow[]
  readonly stageIndex: number
  readonly diagnosticFormulation: {
    impressions: string; ruledOut: string; validity: string; prognosis: string;
    conditions: { name: string; dsmCode: string; notes: string; status: string }[]
  } | null
}): React.JSX.Element {
  const parsedOb = useMemo(() => {
    const map: Record<string, Record<string, string>> = {}
    for (const row of onboardingSections) {
      try { map[row.section] = JSON.parse(row.content) as Record<string, string> } catch { /* skip */ }
    }
    return map
  }, [onboardingSections])

  const reportSections = useMemo(
    () => buildReportContent(caseRow, intakeRow, parsedOb, stageIndex),
    [caseRow, intakeRow, parsedOb, stageIndex],
  )

  // Editable section content stored in state
  const [sectionContent, setSectionContent] = useState<Record<number, string>>({})
  const [sectionTitles, setSectionTitles] = useState<Record<number, string>>({})

  // Initialize from generated report
  useEffect(() => {
    const bodies: Record<number, string> = {}
    const titles: Record<number, string> = {}
    reportSections.forEach((sec, idx) => {
      bodies[idx] = sec.body
      titles[idx] = sec.title
    })
    setSectionContent(bodies)
    setSectionTitles(titles)
  }, [reportSections])

  // Inject diagnostic formulation into the report when Build Report is triggered
  useEffect(() => {
    if (!diagnosticFormulation) return
    const dx = diagnosticFormulation

    setSectionContent(prev => {
      const updated = { ...prev }
      // Find the Diagnostic Impressions section and inject formulation data
      const titles = { ...sectionTitles }
      for (const idxStr of Object.keys(titles)) {
        const idx = parseInt(idxStr, 10)
        const title = (titles[idx] ?? '').toLowerCase()

        if (title.includes('diagnostic impression')) {
          // Build rendered diagnoses
          const rendered = dx.conditions.filter(c => c.status === 'complete')
          const ruledOut = dx.conditions.filter(c => c.status === 'ruled_out')
          const lines: string[] = []
          if (rendered.length > 0) {
            for (const c of rendered) {
              lines.push(`${c.dsmCode}  ${c.name}`)
              if (c.notes.trim()) lines.push(`  ${c.notes.trim()}`)
              lines.push('')
            }
          }
          if (ruledOut.length > 0) {
            lines.push('Conditions Ruled Out:')
            for (const c of ruledOut) {
              lines.push(`  ${c.dsmCode}  ${c.name}`)
              if (c.notes.trim()) lines.push(`    ${c.notes.trim()}`)
            }
            lines.push('')
          }
          if (dx.ruledOut.trim()) {
            lines.push(dx.ruledOut)
            lines.push('')
          }
          updated[idx] = (dx.impressions ? dx.impressions + '\n\n' : '') + lines.join('\n')
        }

        if (title.includes('summary') && title.includes('recommendation')) {
          const parts: string[] = []
          if (dx.validity.trim()) parts.push(`Response Style & Validity:\n${dx.validity}`)
          if (dx.prognosis.trim()) parts.push(`Prognosis & Recommendations:\n${dx.prognosis}`)
          if (parts.length > 0) {
            updated[idx] = parts.join('\n\n')
          }
        }
      }
      return updated
    })
  }, [diagnosticFormulation, sectionTitles])

  const [isExporting, setIsExporting] = useState(false)
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(false)

  // ── Edit in Word: generate .docx and open in MS Word ──
  const handleEditInWord = useCallback(async () => {
    setIsExporting(true)
    try {
      const fullName = `${caseRow.examinee_last_name ?? ''}, ${caseRow.examinee_first_name ?? ''}`
      const evalType = caseRow.evaluation_type ?? 'Psychological Evaluation'
      const sections = reportSections.map((sec, idx) => ({
        title: sectionTitles[idx] ?? sec.title,
        body: sectionContent[idx] ?? sec.body,
      }))
      await window.psygil.report.exportAndOpen({
        caseId: caseRow.case_id,
        fullName,
        evalType,
        sections,
      })
    } catch (err) {
      console.error('Export failed:', err)
    } finally {
      setIsExporting(false)
    }
  }, [caseRow, reportSections, sectionContent, sectionTitles])

  // ── Upload Template: pick .docx, strip PHI, load sections ──
  const handleUploadTemplate = useCallback(async () => {
    setIsLoadingTemplate(true)
    try {
      const resp = await window.psygil.report.loadTemplate()
      if (resp.status === 'success' && resp.data?.sections) {
        const loaded = resp.data.sections as { title: string; body: string }[]
        const bodies: Record<number, string> = {}
        const titles: Record<number, string> = {}
        loaded.forEach((sec, idx) => {
          titles[idx] = sec.title
          bodies[idx] = sec.body
        })
        setSectionTitles(titles)
        setSectionContent(bodies)
      }
    } catch (err) {
      console.error('Template load failed:', err)
    } finally {
      setIsLoadingTemplate(false)
    }
  }, [])

  const fullName = `${caseRow.examinee_last_name ?? ''}, ${caseRow.examinee_first_name ?? ''}`
  const evalType = caseRow.evaluation_type ?? 'Psychological Evaluation'

  // Number of sections currently active
  const activeSections = Object.keys(sectionContent).length || reportSections.length

  // ── Report template definitions ──
  const REPORT_TEMPLATES = [
    { key: 'forensic-cst', label: 'Competency to Stand Trial (CST)' },
    { key: 'forensic-risk', label: 'Violence Risk Assessment' },
    { key: 'forensic-custody', label: 'Child Custody Evaluation' },
    { key: 'forensic-ptsd', label: 'PTSD / Trauma Evaluation' },
    { key: 'forensic-capacity', label: 'Decisional Capacity' },
    { key: 'forensic-malingering', label: 'Malingering Assessment' },
    { key: 'forensic-general', label: 'General Forensic Evaluation' },
    { key: 'clinical-neuro', label: 'Neuropsychological Evaluation' },
    { key: 'clinical-diagnostic', label: 'Diagnostic Psychological Evaluation' },
    { key: 'clinical-disability', label: 'Disability / IME Report' },
    { key: 'sentencing', label: 'Sentencing Mitigation Report' },
    { key: 'juvenile', label: 'Juvenile Forensic Evaluation' },
    { key: 'blank', label: 'Blank Report (No Sections)' },
  ] as const

  const [selectedTemplate, setSelectedTemplate] = useState<string>('')

  const handleTemplateChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const key = e.target.value
    setSelectedTemplate(key)
    if (!key) return
    // Re-generate sections from case data using the current buildReportContent
    // In production this would load template-specific section structures
    const sections = buildReportContent(caseRow, intakeRow, parsedOb, stageIndex)
    const bodies: Record<number, string> = {}
    const titles: Record<number, string> = {}
    sections.forEach((sec, idx) => {
      titles[idx] = sec.title
      bodies[idx] = sec.body
    })
    setSectionTitles(titles)
    setSectionContent(bodies)
  }, [caseRow, intakeRow, parsedOb, stageIndex])

  return (
    <div style={{ padding: 0, background: '#e8e8e8', minHeight: '100%' }}>
      {/* ══════════════════════════════════════════════════════════════════════
          TOOLBAR ROW 1 — File actions + Edit in Word
          ══════════════════════════════════════════════════════════════════════ */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 12px', borderBottom: '1px solid #d0d0d0', background: '#f5f5f5',
        position: 'sticky', top: 0, zIndex: 11,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#333' }}>Evaluation Report</span>
          <select
            value={selectedTemplate}
            onChange={handleTemplateChange}
            style={{
              height: 26, border: '1px solid #d0d0d0', borderRadius: 3, background: '#fff',
              fontSize: 11, color: '#444', cursor: 'pointer', padding: '0 6px', minWidth: 200,
            }}
          >
            <option value="">— Select Template —</option>
            {REPORT_TEMPLATES.map((t) => (
              <option key={t.key} value={t.key}>{t.label}</option>
            ))}
          </select>
          <span style={{ fontSize: 11, color: '#999', background: '#e8e8e8', padding: '1px 8px', borderRadius: 3 }}>Draft</span>
          <span style={{ fontSize: 11, color: '#aaa' }}>{activeSections} sections</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={handleUploadTemplate}
            disabled={isLoadingTemplate}
            style={{
              padding: '4px 12px', fontSize: 11, fontWeight: 600,
              background: '#fff', color: '#555', border: '1px solid #d0d0d0', borderRadius: 4,
              cursor: isLoadingTemplate ? 'not-allowed' : 'pointer',
              opacity: isLoadingTemplate ? 0.6 : 1,
              display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            <span style={{ fontSize: 13 }}>+</span>
            {isLoadingTemplate ? 'Loading…' : 'Upload Template'}
          </button>
          <button
            onClick={handleEditInWord}
            disabled={isExporting}
            style={{
              padding: '4px 12px', fontSize: 11, fontWeight: 600,
              background: '#185abd', color: '#fff', border: 'none', borderRadius: 4,
              cursor: isExporting ? 'not-allowed' : 'pointer', opacity: isExporting ? 0.6 : 1,
              display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 800, fontFamily: 'serif' }}>W</span>
            {isExporting ? 'Exporting…' : 'Edit in Word'}
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TOOLBAR ROW 2 — Formatting controls
          ══════════════════════════════════════════════════════════════════════ */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap',
        padding: '4px 12px', borderBottom: '1px solid #d0d0d0', background: '#fafafa',
        position: 'sticky', top: 39, zIndex: 10,
      }}>
        {/* Undo / Redo */}
        <button style={tbBtn} title="Undo">↩</button>
        <button style={tbBtn} title="Redo">↪</button>
        <div style={tbSep} />

        {/* Font family */}
        <select style={{ ...tbSelect, width: 130 }} defaultValue="Times New Roman">
          <option>Times New Roman</option>
          <option>Arial</option>
          <option>Calibri</option>
          <option>Georgia</option>
          <option>Courier New</option>
        </select>

        {/* Font size */}
        <select style={{ ...tbSelect, width: 48 }} defaultValue="12">
          <option>9</option><option>10</option><option>11</option><option>12</option>
          <option>14</option><option>16</option><option>18</option><option>24</option>
        </select>
        <div style={tbSep} />

        {/* Bold / Italic / Underline / Strikethrough */}
        <button style={{ ...tbBtn, fontWeight: 700 }} title="Bold">B</button>
        <button style={{ ...tbBtn, fontStyle: 'italic' }} title="Italic">I</button>
        <button style={{ ...tbBtn, textDecoration: 'underline' }} title="Underline">U</button>
        <button style={{ ...tbBtn, textDecoration: 'line-through' }} title="Strikethrough">S</button>
        <div style={tbSep} />

        {/* Text color / Highlight */}
        <button style={{ ...tbBtn, position: 'relative' }} title="Text Color">
          <span>A</span>
          <span style={{ position: 'absolute', bottom: 2, left: 4, right: 4, height: 3, background: '#222', borderRadius: 1 }} />
        </button>
        <button style={{ ...tbBtn, position: 'relative' }} title="Highlight">
          <span style={{ background: '#ffeb3b', padding: '0 3px', borderRadius: 1, fontSize: 11 }}>ab</span>
        </button>
        <div style={tbSep} />

        {/* Alignment */}
        <button style={tbBtn} title="Align Left">≡</button>
        <button style={tbBtn} title="Center">☰</button>
        <button style={tbBtn} title="Align Right">≡</button>
        <button style={tbBtn} title="Justify">⊞</button>
        <div style={tbSep} />

        {/* Lists */}
        <button style={{ ...tbBtn, fontSize: 14 }} title="Bullet List">•≡</button>
        <button style={{ ...tbBtn, fontSize: 11 }} title="Numbered List">1.</button>
        <div style={tbSep} />

        {/* Indent */}
        <button style={{ ...tbBtn, fontSize: 13 }} title="Decrease Indent">⇤</button>
        <button style={{ ...tbBtn, fontSize: 13 }} title="Increase Indent">⇥</button>
        <div style={tbSep} />

        {/* Line spacing */}
        <select style={{ ...tbSelect, width: 44 }} defaultValue="1.5" title="Line Spacing">
          <option value="1.0">1.0</option>
          <option value="1.15">1.15</option>
          <option value="1.5">1.5</option>
          <option value="2.0">2.0</option>
        </select>

        {/* Insert */}
        <div style={tbSep} />
        <button style={{ ...tbBtn, fontSize: 11, width: 'auto', padding: '0 6px' }} title="Insert Table">Table</button>
        <button style={{ ...tbBtn, fontSize: 11, width: 'auto', padding: '0 6px' }} title="Insert Image">Image</button>
        <button style={{ ...tbBtn, fontSize: 11, width: 'auto', padding: '0 6px' }} title="Page Break">Break</button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          DOCUMENT BODY — white page on gray background
          ══════════════════════════════════════════════════════════════════════ */}
      <div style={{ padding: '24px 0', minHeight: 'calc(100vh - 120px)' }}>
        <div style={{
          maxWidth: 816,
          margin: '0 auto', padding: '56px 72px',
          background: '#fff', border: '1px solid #c8c8c8',
          boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
          minHeight: 1056,
          fontFamily: "'Times New Roman', Times, serif",
          fontSize: 13, lineHeight: 1.8, color: '#222',
        }}>
          {/* Document header */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>
              Confidential Forensic Evaluation Report
            </div>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 16 }}>
              {evalType}
            </div>
            <div style={{ borderBottom: '2px solid #333', width: 120, margin: '0 auto' }} />
          </div>

          {/* Report header fields */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 24px', marginBottom: 28, fontSize: 12 }}>
            <div><strong>Examinee:</strong> {fullName}</div>
            <div><strong>Date of Birth:</strong> {caseRow.examinee_dob ?? '—'}</div>
            <div><strong>Case ID:</strong> {caseRow.case_id}</div>
            <div><strong>Age:</strong> {caseRow.examinee_dob ? calcAge(caseRow.examinee_dob) : '—'}</div>
            <div><strong>Evaluation Type:</strong> {evalType}</div>
            <div><strong>Date of Report:</strong> {new Date().toLocaleDateString()}</div>
          </div>

          <div style={{ borderTop: '1px solid #ccc', marginBottom: 24 }} />

          {/* Report sections — contentEditable, flows like printed page */}
          {(Object.keys(sectionContent).length > 0
            ? Object.keys(sectionContent).map(Number).sort((a, b) => a - b)
            : reportSections.map((_, i) => i)
          ).map((idx) => (
            <div key={idx} style={{ marginBottom: 24 }}>
              <div style={{
                fontSize: 13, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: 0.5, marginBottom: 8, color: '#111',
                borderBottom: '1px solid #ddd', paddingBottom: 4,
              }}>
                {sectionTitles[idx] ?? reportSections[idx]?.title ?? `Section ${idx + 1}`}
              </div>
              <div
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => {
                  const text = e.currentTarget.innerText ?? ''
                  setSectionContent((prev) => ({ ...prev, [idx]: text }))
                }}
                style={{
                  fontSize: 13, fontFamily: "'Times New Roman', Times, serif",
                  lineHeight: 1.8, color: '#222',
                  whiteSpace: 'pre-wrap', wordWrap: 'break-word',
                  outline: 'none', cursor: 'text',
                  padding: '2px 0', minHeight: 20,
                }}
              >
                {sectionContent[idx] ?? ''}
              </div>
            </div>
          ))}

          {/* Signature block */}
          <div style={{ marginTop: 48, borderTop: '1px solid #ccc', paddingTop: 24 }}>
            <div style={{ marginBottom: 48 }} />
            <div style={{ borderTop: '1px solid #333', width: 280, marginBottom: 4 }} />
            <div style={{ fontSize: 12 }}>[Clinician Name, Credentials]</div>
            <div style={{ fontSize: 12, color: '#666' }}>Licensed Psychologist</div>
            <div style={{ fontSize: 12, color: '#666' }}>Date: _______________</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shared: IntakeField row
// ---------------------------------------------------------------------------

function IntakeField({
  label,
  value,
  wrap,
}: {
  readonly label: string
  readonly value: string
  readonly wrap?: boolean
}): React.JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        padding: '8px 16px',
        borderBottom: '1px solid var(--border)',
        gap: 16,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          width: 140,
          flexShrink: 0,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text)', flex: 1, lineHeight: wrap ? 1.6 : undefined }}>{value}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shared: SectionHeader
// ---------------------------------------------------------------------------

function SectionHeader({
  title,
  onEdit,
}: {
  readonly title: string
  readonly onEdit?: () => void
}): React.JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 14,
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{title}</div>
      {onEdit != null && (
        <button onClick={onEdit} style={editButtonStyle}>
          Edit
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shared: EmptyState
// ---------------------------------------------------------------------------

function EmptyState({ message }: { readonly message: string }): React.JSX.Element {
  return (
    <div
      style={{
        padding: '24px',
        background: 'var(--panel)',
        border: '1px solid var(--border)',
        borderRadius: 6,
        textAlign: 'center',
        color: 'var(--text-secondary)',
        fontSize: 13,
      }}
    >
      {message}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ResourceViewerTab — renders resource file content in the editor area
// Supports: .txt/.md/.csv/.rtf (text), .docx/.doc (HTML via mammoth),
//           .pdf (embedded viewer), binary fallback.
// PHI toggle: when PHI is detected, shows a toggle to view redacted version.
//             Many uploads (dissertations, articles, guidelines) won't have
//             PHI — in that case the toggle doesn't appear.
// ---------------------------------------------------------------------------

function ResourceViewerTab({
  filePath,
  title,
}: {
  readonly filePath: string
  readonly title: string
}): React.JSX.Element {
  const [content, setContent] = useState<string | null>(null)
  const [redacted, setRedacted] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [encoding, setEncoding] = useState<'text' | 'html' | 'pdf-base64' | 'base64'>('text')
  const [phiCount, setPhiCount] = useState(0)
  const [showRedacted, setShowRedacted] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setContent(null)
    setRedacted(null)
    setShowRedacted(false)

    void (async () => {
      try {
        const resp = await window.psygil?.resources?.read?.({ storedPath: filePath })
        if (cancelled) return
        if (resp?.status === 'success' && resp.data) {
          setContent(resp.data.content)
          setRedacted(resp.data.redacted)
          setEncoding(resp.data.encoding)
          setPhiCount(resp.data.phiCount)
        } else {
          setError(resp?.error?.message ?? 'Failed to read file')
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to read file')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [filePath])

  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''

  const categoryLabel = filePath.includes('Writing Samples')
    ? 'Writing Sample'
    : filePath.includes('Templates')
      ? 'Template'
      : filePath.includes('Documentation')
        ? 'Reference Document'
        : 'Resource'

  // The active content to display (original or redacted)
  const activeContent = showRedacted ? redacted : content

  // Styles for the document HTML wrapper — gives DOCX content a clean look
  const docHtmlStyle = `
    body { font-family: 'Georgia', 'Times New Roman', serif; font-size: 13px; line-height: 1.8;
           color: var(--text); max-width: 100%; padding: 24px 32px; margin: 0; background: transparent; }
    h1, h2, h3, h4, h5, h6 { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
           color: var(--text); margin: 1.2em 0 0.4em; }
    h1 { font-size: 20px; border-bottom: 1px solid var(--border); padding-bottom: 6px; }
    h2 { font-size: 17px; } h3 { font-size: 15px; }
    p { margin: 0.5em 0; } ul, ol { margin: 0.5em 0; padding-left: 24px; }
    table { border-collapse: collapse; margin: 12px 0; width: 100%; }
    th, td { border: 1px solid var(--border); padding: 6px 10px; font-size: 12px; text-align: left; }
    th { background: var(--panel); font-weight: 600; }
    strong { font-weight: 700; } em { font-style: italic; }
    img { max-width: 100%; }
  `

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 20px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--panel)',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 16 }}>
          {ext === 'pdf' ? '📕' : ext === 'docx' || ext === 'doc' ? '📄' : ext === 'txt' ? '📝' : '📎'}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {title}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px', marginTop: 1 }}>
            {categoryLabel}
          </div>
        </div>

        {/* PHI toggle — only shown when PHI was actually detected */}
        {!loading && phiCount > 0 && (
          <button
            onClick={() => setShowRedacted(!showRedacted)}
            style={{
              padding: '4px 10px',
              fontSize: 11,
              background: showRedacted ? 'var(--accent)' : 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              color: showRedacted ? '#fff' : 'var(--text-secondary)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s',
            }}
            title={showRedacted
              ? `Showing redacted view (${phiCount} PHI item${phiCount === 1 ? '' : 's'} removed)`
              : `${phiCount} potential PHI item${phiCount === 1 ? '' : 's'} detected — click to view redacted`
            }
          >
            {showRedacted ? '⚕ PHI Redacted' : `⚕ ${phiCount} PHI`}
          </button>
        )}

        <button
          onClick={() => window.psygil?.resources?.open?.({ storedPath: filePath })}
          style={{
            padding: '4px 10px',
            fontSize: 11,
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
          title="Open in external application"
        >
          Open External
        </button>
      </div>

      {/* Content area */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
            Loading…
          </div>
        ) : error ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#ef5350', fontSize: 13 }}>
            {error}
          </div>
        ) : encoding === 'pdf-base64' && !showRedacted ? (
          /* PDF: embed in iframe for native rendering */
          <iframe
            src={`data:application/pdf;base64,${content}`}
            style={{ flex: 1, border: 'none', width: '100%' }}
            title={title}
          />
        ) : encoding === 'html' || (encoding === 'pdf-base64' && showRedacted) ? (
          /* DOCX converted HTML or PDF redacted text view */
          <iframe
            srcDoc={`<!DOCTYPE html><html><head><style>${docHtmlStyle}</style></head><body>${activeContent}</body></html>`}
            style={{ flex: 1, border: 'none', width: '100%' }}
            title={title}
            sandbox="allow-same-origin"
          />
        ) : encoding === 'base64' ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
            <p style={{ margin: '0 0 12px' }}>Binary file — preview not available for .{ext}</p>
            <button
              onClick={() => window.psygil?.resources?.open?.({ storedPath: filePath })}
              style={{
                padding: '8px 16px',
                fontSize: 12,
                background: 'var(--accent)',
                border: 'none',
                borderRadius: 4,
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              Open in External App
            </button>
          </div>
        ) : (
          /* Plain text — monospace rendering */
          <div style={{ flex: 1, overflow: 'auto' }}>
            <pre
              style={{
                margin: 0,
                padding: '16px 24px',
                fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
                fontSize: 12,
                lineHeight: 1.7,
                color: 'var(--text)',
                whiteSpace: 'pre-wrap',
                wordWrap: 'break-word',
                background: 'transparent',
                tabSize: 4,
              }}
            >
              {activeContent}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// DocumentContent
// ---------------------------------------------------------------------------

function DocumentContent({ tab }: { readonly tab: Tab }): React.JSX.Element {
  return (
    <div style={{ padding: '20px 24px', overflow: 'auto', height: '100%' }}>
      <div
        style={{
          padding: 16,
          background: 'var(--panel)',
          borderRadius: 4,
          border: '1px solid var(--border)',
        }}
      >
        <div
          style={{
            fontSize: 11,
            textTransform: 'uppercase',
            fontWeight: 600,
            color: 'var(--text-secondary)',
            marginBottom: 8,
          }}
        >
          Document
        </div>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', marginBottom: 4 }}>
          {tab.title}
        </div>
        <div
          style={{
            fontSize: 11,
            color: 'var(--text-secondary)',
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          {tab.filePath}
        </div>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 16 }}>
        Document viewer will render file content in a later sprint.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// PipelinePill
// ---------------------------------------------------------------------------

function PipelinePill({
  label,
  color,
}: {
  readonly label: string
  readonly color: string
}): React.JSX.Element {
  const [hovered, setHovered] = useState(false)

  return (
    <span
      style={{
        padding: '4px 12px',
        borderRadius: 4,
        fontSize: 12,
        fontWeight: 500,
        border: `1px solid ${hovered ? color : 'var(--border)'}`,
        color: hovered ? '#ffffff' : 'var(--text-secondary)',
        background: hovered ? color : 'var(--panel)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        transition: 'all 0.15s',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span style={{ fontSize: 10 }}>&#9675;</span>
      {label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// ArchiveSubTab
// ---------------------------------------------------------------------------

function ArchiveSubTab({ caseRow }: { readonly caseRow: CaseRow }): React.JSX.Element {
  const isComplete = (caseRow.workflow_current_stage ?? '').toLowerCase() === 'complete'

  return (
    <div>
      <SectionHeader title="Archive" />

      {isComplete ? (
        <div
          style={{
            background: 'var(--panel)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            overflow: 'hidden',
          }}
        >
          <IntakeField label="Status" value="✓ Case Complete" />
          <IntakeField label="Completed" value={caseRow.last_modified?.split('T')[0] ?? '—'} />
          <IntakeField label="Evaluation Type" value={caseRow.evaluation_type ?? '—'} />
          <IntakeField label="Case Number" value={caseRow.case_number ?? '—'} />
        </div>
      ) : (
        <div
          style={{
            background: 'var(--panel)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: 16,
            color: 'var(--text-secondary)',
            fontSize: 13,
          }}
        >
          Case is still active. Materials will be archived once the evaluation reaches the Complete stage.
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------

const editButtonStyle: React.CSSProperties = {
  background: 'var(--panel)',
  color: 'var(--accent)',
  border: '1px solid var(--accent)',
  borderRadius: 4,
  padding: '5px 14px',
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
  fontFamily: 'inherit',
}
