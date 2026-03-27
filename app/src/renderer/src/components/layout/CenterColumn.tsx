import { useState, useCallback } from 'react'
import type { Tab } from '../../types/tabs'

// ---------------------------------------------------------------------------
// Pipeline stage colors (hardcoded per spec §6)
// ---------------------------------------------------------------------------

const PIPELINE_STAGES = [
  { label: 'Onboarding', color: '#2196f3' },
  { label: 'Testing', color: '#9c27b0' },
  { label: 'Interview', color: '#e91e63' },
  { label: 'Diagnostics', color: '#ff9800' },
  { label: 'Review', color: '#ff5722' },
  { label: 'Complete', color: '#4caf50' },
] as const

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CenterColumnProps {
  readonly tabs: readonly Tab[]
  readonly activeTabId: string | null
  readonly onCloseTab: (id: string) => void
  readonly onSetActiveTab: (id: string) => void
}

// ---------------------------------------------------------------------------
// CenterColumn
// ---------------------------------------------------------------------------

export default function CenterColumn({
  tabs,
  activeTabId,
  onCloseTab,
  onSetActiveTab,
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
      {/* Tab bar — spec §8.1 */}
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

      {/* Content area — spec §8.2 */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {activeTab == null ? (
          <WelcomeContent />
        ) : activeTab.type === 'clinical-overview' ? (
          <ClinicalOverviewContent tab={activeTab} />
        ) : (
          <DocumentContent tab={activeTab} />
        )}
      </div>

      {/* Pipeline bar — spec §8.4, 80px */}
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
// Tab content components
// ---------------------------------------------------------------------------

function WelcomeContent(): React.JSX.Element {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
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

function ClinicalOverviewContent({ tab }: { readonly tab: Tab }): React.JSX.Element {
  return (
    <div style={{ padding: '20px 24px', overflow: 'auto', height: '100%' }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>
        Clinical Overview
      </h2>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        Case #{tab.caseId} — summary view will be populated in a later sprint.
      </p>
    </div>
  )
}

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
// PipelinePill — single stage pill in the pipeline bar
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
