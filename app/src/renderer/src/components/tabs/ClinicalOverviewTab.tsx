import React, { useEffect, useState } from 'react'
import { CaseRow, PatientIntakeRow } from '../../../../shared/types/ipc'

/**
 * ClinicalOverviewTab
 *
 * Displays the clinical overview for a case, including:
 * - Header with pipeline indicator, metadata, diagnosis
 * - Summary tabs with stage-appropriate content (Intake, Referral, Testing, etc.)
 * - Edit buttons that open full forms in new tabs
 */

export interface Tab {
  id: string
  label: string
  contentFn?: string
  caseId?: string
}

interface ClinicalOverviewTabProps {
  caseId: number
  onOpenTab: (tab: Tab) => void
}

// Stage colors (from design system)
const STAGE_COLORS: Record<string, string> = {
  Onboarding: '#2196f3',
  Testing: '#9c27b0',
  Interview: '#e91e63',
  Diagnostics: '#ff9800',
  Review: '#ff5722',
  Complete: '#4caf50',
}

// Severity colors
const SEV_COLORS: Record<string, string> = {
  Low: '#4caf50',
  Moderate: '#ff9800',
  High: '#f44336',
  ['Very High']: '#9c27b0',
}

// Stage indices for determining progression
const STAGE_IDX: Record<string, number> = {
  onboarding: 0,
  testing: 1,
  interview: 2,
  diagnostics: 3,
  review: 4,
  complete: 5,
}

interface TabDef {
  id: string
  label: string
  html: string
}

export const ClinicalOverviewTab: React.FC<ClinicalOverviewTabProps> = ({
  caseId,
  onOpenTab,
}) => {
  const [caseData, setCaseData] = useState<CaseRow | null>(null)
  const [intakeData, setIntakeData] = useState<PatientIntakeRow | null>(null)
  const [activeTab, setActiveTab] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Load case and intake data on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load case data
        const caseRes = await window.psygil.cases.get({ case_id: caseId })
        if (caseRes.status === 'success') {
          setCaseData(caseRes.data)
        }

        // Load intake data
        const intakeRes = await window.psygil.intake.get({ case_id: caseId })
        if (intakeRes.status === 'success') {
          setIntakeData(intakeRes.data)
        }
      } catch (err) {
        console.error('Failed to load case data:', err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [caseId])

  if (loading || !caseData) {
    return (
      <div style={{ padding: '16px', fontSize: '13px' }}>
        Loading clinical overview...
      </div>
    )
  }

  // Helper: render colored pill
  const renderPill = (label: string, color: string) => (
    <span
      style={{
        background: color,
        color: '#fff',
        padding: '2px 8px',
        borderRadius: '3px',
        fontSize: '11px',
        whiteSpace: 'nowrap',
        display: 'inline-block',
      }}
    >
      {label}
    </span>
  )

  // Helper: render pipeline indicator
  const renderPipeline = () => {
    const stages = ['Onboarding', 'Testing', 'Interview', 'Diagnostics', 'Review', 'Complete']
    const currentStageIdx = caseData.workflow_current_stage
      ? STAGE_IDX[caseData.workflow_current_stage.toLowerCase()] ?? 0
      : 0

    return (
      <div
        style={{
          display: 'flex',
          gap: '4px',
          marginBottom: '16px',
          flexWrap: 'wrap',
        }}
      >
        {stages.map((stage, i) => {
          const color = STAGE_COLORS[stage]

          if (i < currentStageIdx) {
            // Completed stage
            return (
              <span
                key={stage}
                style={{
                  opacity: 0.5,
                  fontSize: '11px',
                  padding: '2px 8px',
                  borderRadius: '3px',
                  background: color,
                  color: '#fff',
                }}
              >
                ✓ {stage}
              </span>
            )
          } else if (i === currentStageIdx) {
            // Current stage
            return (
              <span
                key={stage}
                style={{
                  fontSize: '11px',
                  padding: '2px 8px',
                  borderRadius: '3px',
                  background: color,
                  color: '#fff',
                  fontWeight: 600,
                }}
              >
                ● {stage}
              </span>
            )
          } else {
            // Future stage
            return (
              <span
                key={stage}
                style={{
                  fontSize: '11px',
                  padding: '2px 8px',
                  borderRadius: '3px',
                  border: '1px solid var(--border)',
                  color: 'var(--text-secondary)',
                }}
              >
                ○ {stage}
              </span>
            )
          }
        })}
      </div>
    )
  }

  // Helper: render edit button
  const renderEditButton = (fnName: string) => (
    <button
      className="ov-edit-btn"
      onClick={() => {
        onOpenTab({
          id: `case${caseId}-${fnName}`,
          label: getFunctionLabel(fnName),
          contentFn: fnName,
          caseId: String(caseId),
        })
      }}
    >
      Edit
    </button>
  )

  // Map function names to labels
  const getFunctionLabel = (fnName: string): string => {
    const labels: Record<string, string> = {
      makeCaseIntake: 'Intake Form',
      makeCaseReferral: 'Referral Docs',
      makeCaseCollateral: 'Collateral Records',
      makeCaseTests: 'Test Battery',
      makeCaseValidity: 'Validity Summary',
      makeCaseInterviews: 'Interview Notes',
      makeCaseDiagnostics: 'Diagnostics',
      makeCaseReport: `${caseData!.evaluation_type || 'Evaluation'} Report`,
    }
    return labels[fnName] || fnName
  }

  // Determine which tabs to show based on pipeline stage
  const currentStage = caseData!.workflow_current_stage?.toLowerCase() || 'onboarding'
  const currentStageIdx = STAGE_IDX[currentStage] ?? 0

  // Build tab definitions (only show stages reached)
  const tabs: TabDef[] = []

  // Intake (always)
  tabs.push({
    id: `case${caseId}-ov-intake`,
    label: 'Intake',
    html: renderIntakePane(),
  })

  // Referral (always)
  tabs.push({
    id: `case${caseId}-ov-referral`,
    label: 'Referral',
    html: renderReferralPane(),
  })

  // Testing (stage 1+)
  if (currentStageIdx >= 1) {
    tabs.push({
      id: `case${caseId}-ov-testing`,
      label: 'Testing',
      html: renderTestingPane(),
    })
  }

  // Interviews (stage 2+)
  if (currentStageIdx >= 2) {
    tabs.push({
      id: `case${caseId}-ov-interviews`,
      label: 'Interviews',
      html: renderInterviewsPane(),
    })
  }

  // Diagnostics (stage 3+)
  if (currentStageIdx >= 3) {
    tabs.push({
      id: `case${caseId}-ov-diagnostics`,
      label: 'Diagnostics',
      html: renderDiagnosticsPane(),
    })
  }

  // Report (stage 4+)
  if (currentStageIdx >= 4) {
    tabs.push({
      id: `case${caseId}-ov-report`,
      label: 'Report',
      html: renderReportPane(),
    })
  }

  // Set first tab as active on mount
  useEffect(() => {
    if (tabs.length > 0 && !activeTab) {
      setActiveTab(tabs[0].id)
    }
  }, [tabs, activeTab])

  // Render panes
  function renderIntakePane(): string {
    return `
      <div style="float: right;">
        ${renderEditButton('makeCaseIntake').props?.children || ''}
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; margin-bottom: 10px;">
        <div class="ov-field">
          <span class="ov-field-lbl">Name</span>
          <span class="ov-field-val">${caseData!.examinee_first_name} ${
      caseData!.examinee_last_name
    }</span>
        </div>
        <div class="ov-field">
          <span class="ov-field-lbl">Age / Gender</span>
          <span class="ov-field-val">${caseData!.examinee_gender || 'Unknown'}</span>
        </div>
        <div class="ov-field">
          <span class="ov-field-lbl">Case Number</span>
          <span class="ov-field-val">#${caseData!.case_number}</span>
        </div>
        <div class="ov-field">
          <span class="ov-field-lbl">Eval Type</span>
          <span class="ov-field-val">${caseData!.evaluation_type || 'Unknown'}</span>
        </div>
        <div class="ov-field">
          <span class="ov-field-lbl">Referred</span>
          <span class="ov-field-val">${
            caseData!.created_at ? caseData!.created_at.split('T')[0] : 'Unknown'
          }</span>
        </div>
      </div>
    `
  }

  function renderReferralPane(): string {
    return `
      <div style="float: right;">
        ${renderEditButton('makeCaseReferral').props?.children || ''}
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; margin-bottom: 10px;">
        <div class="ov-field">
          <span class="ov-field-lbl">Source Type</span>
          <span class="ov-field-val">${caseData!.referral_source || 'Unknown'}</span>
        </div>
        <div class="ov-field">
          <span class="ov-field-lbl">Referring Party</span>
          <span class="ov-field-val">${
            intakeData?.attorney_name || 'Not specified'
          }</span>
        </div>
      </div>
    `
  }

  function renderTestingPane(): string {
    return `
      <div style="float: right;">
        ${renderEditButton('makeCaseTests').props?.children || ''}
      </div>
      <div class="ov-field">
        <span class="ov-field-lbl">Status</span>
        <span class="ov-field-val">Testing in progress</span>
      </div>
    `
  }

  function renderInterviewsPane(): string {
    return `
      <div style="float: right;">
        ${renderEditButton('makeCaseInterviews').props?.children || ''}
      </div>
      <div class="ov-field">
        <span class="ov-field-lbl">Sessions</span>
        <span class="ov-field-val">Interviews completed</span>
      </div>
    `
  }

  function renderDiagnosticsPane(): string {
    return `
      <div style="float: right;">
        ${renderEditButton('makeCaseDiagnostics').props?.children || ''}
      </div>
      <div class="ov-field">
        <span class="ov-field-lbl">Status</span>
        <span class="ov-field-val">In diagnostics phase</span>
      </div>
    `
  }

  function renderReportPane(): string {
    return `
      <div style="float: right;">
        ${renderEditButton('makeCaseReport').props?.children || ''}
      </div>
      <div class="ov-field">
        <span class="ov-field-lbl">Status</span>
        <span class="ov-field-val">Report in progress</span>
      </div>
    `
  }

  const displayName = `${caseData!.examinee_last_name}, ${caseData!.examinee_first_name}`

  return (
    <div style={{ padding: '16px', fontSize: '13px' }}>
      {/* Header Section */}
      <h1 style={{ fontSize: '16px', marginBottom: '8px' }}>
        Clinical Overview — {displayName}
      </h1>

      {/* Pipeline Indicator */}
      {renderPipeline()}

      {/* Metadata Row */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap',
          fontSize: '12px',
          color: 'var(--text-secondary)',
          marginBottom: '6px',
        }}
      >
        <span>
          Case <strong style={{ color: 'var(--text)' }}>#{caseData!.case_number}</strong>
        </span>
        <span>
          Type{' '}
          <strong style={{ color: 'var(--text)' }}>{caseData!.evaluation_type || 'Unknown'}</strong>
        </span>
        <span>
          Status{' '}
          {renderPill(
            caseData!.case_status || 'Unknown',
            STAGE_COLORS[caseData!.workflow_current_stage || 'onboarding']
          )}
        </span>
      </div>

      {/* Summary Tabs */}
      <div className="ov-tabs">
        {tabs.map((tab, i) => (
          <button
            key={tab.id}
            className={`ov-tab${activeTab === tab.id ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '7px 14px',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-secondary)',
              borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
              background: 'none',
              border: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Panes */}
      {tabs.map((tab) => (
        <div
          key={`pane-${tab.id}`}
          className={`ov-pane${activeTab === tab.id ? ' active' : ''}`}
          style={{
            display: activeTab === tab.id ? 'block' : 'none',
            padding: '12px 0',
          }}
          dangerouslySetInnerHTML={{ __html: tab.html }}
        />
      ))}
    </div>
  )
}

export default ClinicalOverviewTab
