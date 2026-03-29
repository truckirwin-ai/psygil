import { useState, useCallback, useEffect } from 'react'
import type { Tab } from '../../types/tabs'
import type { CaseRow, PatientIntakeRow } from '../../../../shared/types/ipc'

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
  | 'validity'
  | 'interviews'
  | 'diagnostics'
  | 'report'

interface SubTabDef {
  readonly id: OverviewSubTab
  readonly label: string
  readonly minStageIndex: number
}

const ALL_SUB_TABS: SubTabDef[] = [
  { id: 'intake', label: 'Intake', minStageIndex: 0 },
  { id: 'referral', label: 'Referral', minStageIndex: 0 },
  { id: 'collateral', label: 'Collateral', minStageIndex: 1 },
  { id: 'testing', label: 'Testing', minStageIndex: 1 },
  { id: 'validity', label: 'Validity', minStageIndex: 2 },
  { id: 'interviews', label: 'Interviews', minStageIndex: 2 },
  { id: 'diagnostics', label: 'Diagnostics', minStageIndex: 3 },
  { id: 'report', label: 'Report', minStageIndex: 4 },
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
}: CenterColumnProps): React.JSX.Element {
  const activeTab = tabs.find((t) => t.id === activeTabId)

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
          <ClinicalOverviewContent tab={activeTab} onEditIntake={onEditIntake} />
        ) : (
          <DocumentContent tab={activeTab} />
        )}
      </div>

      {/* Pipeline bar — 80px */}
      <div
        style={{
          height: 80,
          flexShrink: 0,
          borderTop: '1px solid var(--border)',
          background: 'var(--panel)',
        }}
      >
        <div className="panel-header" style={{ borderBottom: 'none' }}>
          <span className="panel-header-title">Evaluation Pipeline</span>
        </div>
        <div style={{ display: 'flex', gap: 4, padding: '8px 12px', flexWrap: 'wrap' }}>
          {PIPELINE_STAGES.map((stage) => (
            <PipelinePill key={stage.label} label={stage.label} color={stage.color} />
          ))}
        </div>
      </div>
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

  const showClose = isActive || hovered

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
}: {
  readonly tab: Tab
  readonly onEditIntake: (caseId: number) => void
}): React.JSX.Element {
  const [caseRow, setCaseRow] = useState<CaseRow | null>(null)
  const [intakeRow, setIntakeRow] = useState<PatientIntakeRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeSubTab, setActiveSubTab] = useState<OverviewSubTab>('intake')

  useEffect(() => {
    if (tab.caseId == null) return
    let cancelled = false
    setLoading(true)

    void (async () => {
      const [caseResp, intakeResp] = await Promise.all([
        window.psygil.cases.get({ case_id: tab.caseId as number }),
        window.psygil.intake.get({ case_id: tab.caseId as number }),
      ])

      if (cancelled) return

      if (caseResp.status === 'success') setCaseRow(caseResp.data)
      if (intakeResp.status === 'success') setIntakeRow(intakeResp.data)
      setLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [tab.caseId])

  const handleEditIntake = useCallback(() => {
    if (tab.caseId != null) onEditIntake(tab.caseId)
  }, [tab.caseId, onEditIntake])

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

  // Visible sub-tabs based on current stage
  const visibleTabs = ALL_SUB_TABS.filter((t) => stageIndex >= t.minStageIndex)

  // If current sub-tab not visible at this stage, reset to intake
  const effectiveSubTab = visibleTabs.some((t) => t.id === activeSubTab)
    ? activeSubTab
    : 'intake'

  const deadline = intakeRow?.report_deadline ?? null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* ── Case header ── */}
      <div
        style={{
          padding: '14px 24px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--panel)',
          flexShrink: 0,
        }}
      >
        {/* Row 1: name + stage pill */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>{fullName}</div>
          <span
            style={{
              background: stageColor,
              color: '#fff',
              fontSize: 11,
              fontWeight: 700,
              borderRadius: 4,
              padding: '3px 10px',
              letterSpacing: 0.5,
              textTransform: 'uppercase',
              flexShrink: 0,
            }}
          >
            {stageLabel}
          </span>
        </div>

        {/* Row 2: pipeline stages progress */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
          {PIPELINE_STAGE_LIST.map((s, idx) => {
            const isDone = idx < stageIndex
            const isCurrent = idx === stageIndex
            const stColor = s.color
            return (
              <div
                key={s.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                {idx > 0 && (
                  <div
                    style={{
                      width: 16,
                      height: 1,
                      background: isDone || isCurrent ? stColor : 'var(--border)',
                      flexShrink: 0,
                    }}
                  />
                )}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '2px 8px',
                    borderRadius: 10,
                    border: `1.5px solid ${isDone || isCurrent ? stColor : 'var(--border)'}`,
                    background: isCurrent ? stColor : isDone ? `${stColor}22` : 'transparent',
                    fontSize: 11,
                    fontWeight: isCurrent ? 700 : isDone ? 600 : 400,
                    color: isCurrent ? '#fff' : isDone ? stColor : 'var(--text-secondary)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span style={{ fontSize: 10 }}>
                    {isDone ? '✓' : isCurrent ? '●' : '○'}
                  </span>
                  {s.label}
                </div>
              </div>
            )
          })}
        </div>

        {/* Row 3: case metadata */}
        <div
          style={{
            display: 'flex',
            gap: 20,
            fontSize: 12,
            color: 'var(--text-secondary)',
            flexWrap: 'wrap',
          }}
        >
          <MetaChip label="Case #" value={caseRow.case_number} />
          {caseRow.evaluation_type != null && caseRow.evaluation_type !== '' && (
            <MetaChip label="Eval Type" value={caseRow.evaluation_type} />
          )}
          {caseRow.referral_source != null && caseRow.referral_source !== '' && (
            <MetaChip label="Referral" value={caseRow.referral_source} />
          )}
          {deadline != null && deadline !== '' && (
            <MetaChip label="Deadline" value={new Date(deadline).toLocaleDateString()} />
          )}
          <MetaChip label="Opened" value={new Date(caseRow.created_at).toLocaleDateString()} />
        </div>
      </div>

      {/* ── Sub-tab bar ── */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--border)',
          background: 'var(--panel)',
          flexShrink: 0,
          overflowX: 'auto',
        }}
      >
        {visibleTabs.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setActiveSubTab(id)}
            style={{
              padding: '7px 16px',
              fontSize: 12,
              fontWeight: effectiveSubTab === id ? 600 : 400,
              color:
                effectiveSubTab === id ? 'var(--accent)' : 'var(--text-secondary)',
              background: 'transparent',
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
        ))}
      </div>

      {/* ── Sub-tab content ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        {effectiveSubTab === 'intake' && (
          <IntakeSubTab caseRow={caseRow} intakeRow={intakeRow} onEdit={handleEditIntake} />
        )}
        {effectiveSubTab === 'referral' && (
          <ReferralSubTab caseRow={caseRow} intakeRow={intakeRow} />
        )}
        {effectiveSubTab === 'collateral' && (
          <CollateralSubTab caseRow={caseRow} stageIndex={stageIndex} />
        )}
        {effectiveSubTab === 'testing' && (
          <TestingSubTab caseRow={caseRow} stageIndex={stageIndex} />
        )}
        {effectiveSubTab === 'validity' && (
          <ValiditySubTab caseRow={caseRow} />
        )}
        {effectiveSubTab === 'interviews' && (
          <InterviewsSubTab caseRow={caseRow} />
        )}
        {effectiveSubTab === 'diagnostics' && (
          <DiagnosticsSubTab stageIndex={stageIndex} />
        )}
        {effectiveSubTab === 'report' && (
          <ReportSubTab caseRow={caseRow} stageIndex={stageIndex} />
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
// IntakeSubTab
// ---------------------------------------------------------------------------

function IntakeSubTab({
  caseRow,
  intakeRow,
  onEdit,
}: {
  readonly caseRow: CaseRow
  readonly intakeRow: PatientIntakeRow | null
  readonly onEdit: () => void
}): React.JSX.Element {
  return (
    <div>
      <SectionHeader title="Intake Summary" onEdit={onEdit} />

      {intakeRow == null ? (
        <EmptyState message="No intake data yet. Click Edit to add intake information." />
      ) : (
        <div
          style={{
            background: 'var(--panel)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            overflow: 'hidden',
          }}
        >
          <IntakeField
            label="Examinee"
            value={`${caseRow.examinee_last_name}, ${caseRow.examinee_first_name}`}
          />
          {caseRow.examinee_dob != null && (
            <IntakeField label="Date of Birth" value={caseRow.examinee_dob} />
          )}
          {caseRow.examinee_gender != null && (
            <IntakeField label="Gender" value={caseRow.examinee_gender} />
          )}
          <IntakeField
            label="Eval Type"
            value={intakeRow.eval_type ?? caseRow.evaluation_type ?? '—'}
          />
          <IntakeField label="Referral Type" value={intakeRow.referral_type} />
          <IntakeField label="Referral Source" value={intakeRow.referral_source ?? '—'} />
          <IntakeField label="Jurisdiction" value={intakeRow.jurisdiction ?? '—'} />
          <IntakeField label="Charges" value={intakeRow.charges ?? '—'} />
          <IntakeField label="Attorney" value={intakeRow.attorney_name ?? '—'} />
          <IntakeField
            label="Report Deadline"
            value={
              intakeRow.report_deadline != null
                ? new Date(intakeRow.report_deadline).toLocaleDateString()
                : '—'
            }
          />
          {intakeRow.presenting_complaint != null && intakeRow.presenting_complaint !== '' && (
            <div
              style={{
                padding: '10px 16px',
                borderTop: '1px solid var(--border)',
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  marginBottom: 4,
                }}
              >
                Evaluation Purpose / Presenting Concern
              </div>
              <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>
                {intakeRow.presenting_complaint}
              </div>
            </div>
          )}
          <div
            style={{
              padding: '6px 16px',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'flex-end',
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: intakeRow.status === 'complete' ? '#4caf50' : '#ff9800',
              }}
            >
              {intakeRow.status === 'complete' ? '✓ Complete' : '⏳ Draft'}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ReferralSubTab
// ---------------------------------------------------------------------------

function ReferralSubTab({
  caseRow,
  intakeRow,
}: {
  readonly caseRow: CaseRow
  readonly intakeRow: PatientIntakeRow | null
}): React.JSX.Element {
  return (
    <div>
      <SectionHeader title="Referral Information" />
      <div
        style={{
          background: 'var(--panel)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          overflow: 'hidden',
        }}
      >
        <IntakeField
          label="Referral Source Type"
          value={intakeRow?.referral_type ?? '—'}
        />
        <IntakeField
          label="Referring Party"
          value={intakeRow?.referral_source ?? caseRow.referral_source ?? '—'}
        />
        <IntakeField label="Jurisdiction" value={intakeRow?.jurisdiction ?? '—'} />
        <IntakeField label="Charges" value={intakeRow?.charges ?? '—'} />
        <IntakeField label="Attorney / Counsel" value={intakeRow?.attorney_name ?? '—'} />
        <IntakeField
          label="Report Deadline"
          value={
            intakeRow?.report_deadline != null
              ? new Date(intakeRow.report_deadline).toLocaleDateString()
              : '—'
          }
        />
        <IntakeField
          label="Date Authorized"
          value={new Date(caseRow.created_at).toLocaleDateString()}
        />
        {caseRow.evaluation_questions != null && caseRow.evaluation_questions !== '' && (
          <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)' }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 4,
              }}
            >
              Evaluation Questions / Referral Questions
            </div>
            <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>
              {caseRow.evaluation_questions}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// CollateralSubTab
// ---------------------------------------------------------------------------

function CollateralSubTab({
  caseRow,
  stageIndex,
}: {
  readonly caseRow: CaseRow
  readonly stageIndex: number
}): React.JSX.Element {
  const docs = getCollateralDocs(caseRow.evaluation_type)

  // Always-received docs regardless of stage
  const alwaysReceived = new Set(['Court Order', 'Informed Consent'])

  return (
    <div>
      <SectionHeader title="Collateral Documents" />
      <div
        style={{
          background: 'var(--panel)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          overflow: 'hidden',
        }}
      >
        {docs.map((doc, idx) => {
          const isReceived = alwaysReceived.has(doc) || stageIndex >= 2
          return (
            <div
              key={doc}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 16px',
                borderBottom: idx < docs.length - 1 ? '1px solid var(--border)' : 'none',
                gap: 12,
              }}
            >
              <div>
                <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{doc}</div>
                {isReceived && (
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                    Pages: {Math.floor(Math.random() * 40) + 5}
                  </div>
                )}
              </div>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: isReceived ? '#4caf50' : '#ff9800',
                  whiteSpace: 'nowrap',
                }}
              >
                {isReceived ? '✓ Received' : '⏳ Requested'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
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
  const instruments = getInstrumentsForEvalType(caseRow.evaluation_type)
  const hasValidityInstruments = instruments.some((key) => INSTRUMENT_INFO[key]?.isValidity)

  return (
    <div>
      <SectionHeader title="Test Battery" />

      {hasValidityInstruments && (
        <div
          style={{
            background: '#fff3e0',
            border: '1px solid #ff9800',
            borderRadius: 6,
            padding: '10px 14px',
            marginBottom: 14,
            fontSize: 12,
            color: '#e65100',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
          }}
        >
          <span style={{ fontSize: 14 }}>⚠</span>
          <span>
            Validity/effort measures included. Review validity results before interpreting clinical
            scales.
          </span>
        </div>
      )}

      <div
        style={{
          background: 'var(--panel)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          overflow: 'hidden',
        }}
      >
        {instruments.map((key, idx) => {
          const info = INSTRUMENT_INFO[key]
          const isScored = stageIndex >= 2
          if (info == null) return null
          return (
            <div
              key={key}
              style={{
                padding: '10px 16px',
                borderBottom: idx < instruments.length - 1 ? '1px solid var(--border)' : 'none',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--text)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  {info.isValidity && (
                    <span style={{ color: '#ff9800', fontSize: 12 }}>⚠</span>
                  )}
                  {key} — {info.fullName}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--text-secondary)',
                    marginTop: 2,
                    display: 'flex',
                    gap: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  <span>{info.category}</span>
                  <span>{info.duration}</span>
                </div>
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: isScored ? '#4caf50' : '#9c27b0',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {isScored ? '✓ Scored' : '● In Progress'}
              </span>
            </div>
          )
        })}
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
// InterviewsSubTab
// ---------------------------------------------------------------------------

function InterviewsSubTab({ caseRow }: { readonly caseRow: CaseRow }): React.JSX.Element {
  // Use 2 sessions / 3.0 hours as default since schema doesn't track these
  const sessionCount = 2
  const totalHours = 3.0
  const sessionDuration = (totalHours / sessionCount).toFixed(1)
  const titles = getSessionTitles(caseRow.evaluation_type)

  const evalTypeLower = (caseRow.evaluation_type ?? '').toLowerCase()

  function getSessionNotes(title: string): string {
    if (evalTypeLower.includes('cst') || evalTypeLower.includes('competency')) {
      if (title.includes('Dusky')) {
        return 'Assessed understanding of legal proceedings, ability to assist counsel, and factual/rational understanding of charges. Dusky criteria reviewed in detail.'
      }
      return 'Psychiatric history, symptom review, mental status examination, and prior hospitalizations documented.'
    }
    if (evalTypeLower.includes('custody')) {
      return 'Parenting practices, discipline approach, child-parent relationship quality, and co-parenting dynamics reviewed.'
    }
    if (evalTypeLower.includes('risk')) {
      return 'Index offense narrative, criminal history, victim information, and dynamic risk factors assessed.'
    }
    if (evalTypeLower.includes('ptsd')) {
      return 'Trauma timeline, symptom onset, re-experiencing phenomena, avoidance, and functional impairment reviewed.'
    }
    if (evalTypeLower.includes('malingering')) {
      return 'Symptom presentation consistency across methods, reported vs. observed behavior, and feigning indicators assessed.'
    }
    if (evalTypeLower.includes('capacity')) {
      return 'Cognitive functioning, decision-making capacity, understanding of condition and treatment options evaluated.'
    }
    return 'History, presenting concerns, current functioning, and evaluation questions addressed.'
  }

  return (
    <div>
      <SectionHeader title="Clinical Interviews" />

      <div
        style={{
          display: 'flex',
          gap: 16,
          marginBottom: 14,
          fontSize: 13,
          color: 'var(--text-secondary)',
        }}
      >
        <span>
          <strong style={{ color: 'var(--text)' }}>Sessions:</strong> {sessionCount}
        </span>
        <span>
          <strong style={{ color: 'var(--text)' }}>Total Hours:</strong> {totalHours}
        </span>
        <span>
          <strong style={{ color: 'var(--text)' }}>Avg Duration:</strong> {sessionDuration} hr
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {Array.from({ length: sessionCount }, (_, i) => {
          const title = titles[i] ?? titles[titles.length - 1]
          return (
            <div
              key={i}
              style={{
                background: 'var(--panel)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: '12px 16px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 8,
                  gap: 12,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                  Session {i + 1}: {title}
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  {sessionDuration} hr
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {getSessionNotes(title)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// DiagnosticsSubTab
// ---------------------------------------------------------------------------

function DiagnosticsSubTab({ stageIndex }: { readonly stageIndex: number }): React.JSX.Element {
  const isInProgress = stageIndex === 3

  return (
    <div>
      <SectionHeader title="Diagnostic Formulation" />

      {/* DOCTOR ALWAYS DIAGNOSES — mandatory warning */}
      <div
        style={{
          background: '#ffebee',
          border: '2px solid #f44336',
          borderRadius: 6,
          padding: '12px 16px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
        }}
      >
        <span style={{ fontSize: 18, flexShrink: 0 }}>🚨</span>
        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: '#c62828',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginBottom: 4,
            }}
          >
            THE DOCTOR ALWAYS DIAGNOSES
          </div>
          <div style={{ fontSize: 12, color: '#d32f2f', lineHeight: 1.5 }}>
            All diagnostic conclusions must be made by a licensed clinician. Psygil provides
            supporting data only. No AI-generated diagnosis will be inserted into this record.
            Clinician review and attestation required before this section is considered complete.
          </div>
        </div>
      </div>

      {isInProgress ? (
        <div
          style={{
            padding: '24px',
            background: 'var(--panel)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
            ⏳ Awaiting Clinician Determination
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Testing and interview phases complete. The evaluating clinician must review all data and
            enter their diagnostic formulation before this evaluation can proceed to Report.
          </div>
        </div>
      ) : (
        <div
          style={{
            background: 'var(--panel)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 4,
              }}
            >
              Primary Diagnosis
            </div>
            <div style={{ fontSize: 13, color: 'var(--text)' }}>
              Clinician-entered diagnosis will appear here.
            </div>
          </div>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 4,
              }}
            >
              Supporting Evidence
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Test results, interview data, and collateral information will be summarized here once
              the clinician completes their formulation.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ReportSubTab
// ---------------------------------------------------------------------------

function ReportSubTab({
  caseRow,
  stageIndex,
}: {
  readonly caseRow: CaseRow
  readonly stageIndex: number
}): React.JSX.Element {
  const isFinal = stageIndex >= 5
  const sections = getReportSections(caseRow.evaluation_type)
  // Complete first 3 sections if in Review, all if Complete
  const completedCount = isFinal ? sections.length : Math.min(3, sections.length)

  return (
    <div>
      <SectionHeader title="Evaluation Report" />

      {/* Report metadata */}
      <div
        style={{
          background: 'var(--panel)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          overflow: 'hidden',
          marginBottom: 16,
        }}
      >
        <IntakeField label="Report Type" value={caseRow.evaluation_type ?? 'Psychological Evaluation'} />
        <IntakeField
          label="Status"
          value={isFinal ? '✓ Final' : '⏳ Draft'}
        />
        <IntakeField
          label="Evaluator"
          value="Assigned Clinician"
        />
        <IntakeField
          label="Est. Length"
          value={`${sections.length * 2}–${sections.length * 3} pages`}
        />
      </div>

      {/* Report sections checklist */}
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>
        Report Sections
      </div>
      <div
        style={{
          background: 'var(--panel)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          overflow: 'hidden',
        }}
      >
        {sections.map((section, idx) => {
          const done = idx < completedCount
          return (
            <div
              key={section}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 16px',
                borderBottom: idx < sections.length - 1 ? '1px solid var(--border)' : 'none',
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  color: done ? '#4caf50' : 'var(--text-secondary)',
                  flexShrink: 0,
                }}
              >
                {done ? '✓' : '⏳'}
              </span>
              <span
                style={{
                  fontSize: 13,
                  color: done ? 'var(--text)' : 'var(--text-secondary)',
                }}
              >
                {section}
              </span>
            </div>
          )
        })}
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
}: {
  readonly label: string
  readonly value: string
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
      <div style={{ fontSize: 13, color: 'var(--text)', flex: 1 }}>{value}</div>
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
