# Psygil UI Wireframes & Component Hierarchy Specification

**Document Version:** 1.0
**Last Updated:** March 2026
**Author:** Psygil Engineering Team
**Status:** Active

---

## Table of Contents

1. [Overview](#overview)
2. [App Shell & Top-Level Hierarchy](#app-shell--top-level-hierarchy)
3. [Routing Architecture](#routing-architecture)
4. [State Management](#state-management)
5. [Screen 1: Dashboard / Case List](#screen-1-dashboard--case-list)
6. [Screen 2: Case Detail / Workspace](#screen-2-case-detail--workspace)
7. [Screen 3: Document Upload & Ingestion](#screen-3-document-upload--ingestion)
8. [Screen 4: Gate 1 — Data Confirmation](#screen-4-gate-1--data-confirmation)
9. [Screen 5: Gate 2 — Diagnostic Decision](#screen-5-gate-2--diagnostic-decision)
10. [Screen 6: Report Editor](#screen-6-report-editor)
11. [Screen 7: Gate 3 — Final Attestation](#screen-7-gate-3--final-attestation)
12. [Screen 8: Settings / Configuration](#screen-8-settings--configuration)
13. [Screen 9: Psychometrist View (Restricted)](#screen-9-psychometrist-view-restricted)
14. [Shared Components & Patterns](#shared-components--patterns)
15. [IPC Channel Usage Map](#ipc-channel-usage-map)

---

## Overview

Psygil is an Electron desktop application designed for forensic and clinical psychologists to analyze clinical documents, manage diagnostic decisions, and generate comprehensive clinical reports. The UI is built with React and TypeScript, with embedded OnlyOffice integration for document editing.

### Key Design Principles

1. **Gate-Driven Workflow:** All case progression is controlled by workflow gates, not user preference
2. **Clinician Agency:** Diagnostic decisions require active clinician selection; no AI recommendations are auto-accepted
3. **Evidence-Based Display:** All diagnostic decisions must show supporting evidence; no hidden AI reasoning
4. **Audit Trail:** Every action is traceable with timestamps and user attribution
5. **Role-Based Access:** Psychometrists, clinicians, and reviewers have distinct capabilities

---

## App Shell & Top-Level Hierarchy

### App Architecture

```
PsygilApp (Root Component)
├── ElectronBridge (IPC Context Provider)
├── AuthContext Provider
├── CaseContext Provider
├── UIStateContext Provider
├── ToastProvider (Global Notifications)
└── Router (React Router)
    ├── Layout (App Shell)
    │   ├── TopBar
    │   │   ├── LogoSection
    │   │   ├── BreadcrumbNav
    │   │   ├── HelpButton
    │   │   └── UserMenu
    │   ├── MainContent
    │   │   └── RouteRenderer
    │   └── BottomStatusBar
    │       ├── SyncStatus
    │       ├── LLMActivityIndicator
    │       └── AuditLogIndicator
    ├── DashboardPage
    ├── CaseDetailPage
    ├── DocumentUploadPage
    ├── Gate1DataConfirmationPage
    ├── Gate2DiagnosticDecisionPage
    ├── ReportEditorPage
    ├── Gate3FinalAttestationPage
    ├── SettingsPage
    ├── PsychometristDashboardPage
    ├── LoginPage
    └── NotFoundPage
```

### App Shell Layout (Persistent)

```
┌─────────────────────────────────────────────────────────────────┐
│ Psygil Logo | Breadcrumb Nav              Help | User Menu ▼ │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│   [MAIN CONTENT AREA - Route-specific rendering]                │
│                                                                   │
│                                                                   │
├─────────────────────────────────────────────────────────────────┤
│ ✓ Sync OK | LLM: Idle | Audit Log                               │
└─────────────────────────────────────────────────────────────────┘
```

### Component Tree: App Shell

```typescript
// src/components/AppShell.tsx
export interface AppShellProps {
  children: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  showSidebar?: boolean;
}

// Component structure
AppShell
├── TopBar
│   ├── LogoSection
│   ├── BreadcrumbNav
│   ├── HelpButton (onClick → opens contextual help panel)
│   └── UserMenu
│       ├── Profile option
│       ├── Settings option
│       └── Logout option
├── MainContent
│   └── {children}
└── BottomStatusBar
    ├── SyncStatusIndicator (polling /health every 30s)
    ├── LLMActivityIndicator (listens to llm:* IPC events)
    └── AuditLogIndicator (unread audit entries badge)
```

### Top-Level Context Providers

```typescript
// src/context/types.ts

interface AuthContextType {
  user: User | null;
  role: 'clinician' | 'psychometrist' | 'legal_reviewer' | 'admin';
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
}

interface CaseContextType {
  currentCaseId: string | null;
  currentCase: Case | null;
  caseList: Case[];
  setCaseId: (id: string) => void;
  refreshCaseList: () => Promise<void>;
  updateCase: (updates: Partial<Case>) => Promise<void>;
}

interface UIStateContextType {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  toastQueue: Toast[];
  addToast: (toast: Toast) => void;
  removeToast: (id: string) => void;
}

interface ElectronBridgeContextType {
  // IPC communication helpers
  invoke: <T>(channel: string, args?: any) => Promise<T>;
  on: (channel: string, callback: Function) => void;
  off: (channel: string, callback: Function) => void;
  // File system helpers
  openFile: (filters?: FileFilter[]) => Promise<string[]>;
  saveFile: (defaultPath?: string) => Promise<string>;
}
```

---

## Routing Architecture

```typescript
// src/router.tsx

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      {
        path: '/',
        element: <DashboardPage />,
      },
      {
        path: '/case/:caseId',
        element: <CaseDetailPage />,
        children: [
          {
            path: 'documents',
            element: <DocumentUploadPage />,
          },
          {
            path: 'gate-1',
            element: <Gate1DataConfirmationPage />,
          },
          {
            path: 'gate-2',
            element: <Gate2DiagnosticDecisionPage />,
          },
          {
            path: 'report',
            element: <ReportEditorPage />,
          },
          {
            path: 'gate-3',
            element: <Gate3FinalAttestationPage />,
          },
          {
            path: 'audit-trail',
            element: <AuditTrailPage />,
          },
        ],
      },
      {
        path: '/settings',
        element: <SettingsPage />,
      },
      {
        path: '/psychometrist',
        element: <PsychometristDashboardPage />,
        loader: requireRole('psychometrist'),
      },
    ],
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
]);
```

---

## State Management

### Local State vs. Context vs. Server State

```
┌─────────────────────────────────────────────────────────────┐
│ State Management Strategy                                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ GLOBAL CONTEXT (Zustand Stores):                           │
│   • authStore: user, role, permissions                     │
│   • caseStore: current case, case list, metadata           │
│   • uiStore: sidebar, tabs, notifications                  │
│   • settingsStore: user preferences, audit settings        │
│                                                             │
│ LOCAL COMPONENT STATE (useState):                          │
│   • Form inputs (temporary editing)                        │
│   • Expanded/collapsed panels                              │
│   • Hover states, focus states                             │
│   • Pagination, sorting, filtering                         │
│                                                             │
│ SERVER STATE (SWR/React Query):                            │
│   • Case list (cached, auto-revalidate)                    │
│   • Documents (with processing status)                     │
│   • Clinical notes, observations                           │
│   • Report versions, audit trail                           │
│                                                             │
│ LLM OPERATION STATE (IPC Events):                          │
│   • Report generation progress                             │
│   • Section streaming status                               │
│   • Token usage metrics                                    │
│   • Error handling for LLM failures                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Zustand Store Structure

```typescript
// src/store/authStore.ts
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  role: null,
  permissions: [],
  setUser: (user) => set({ user }),
  setRole: (role) => set({ role }),
  loadPermissions: async () => { /* ... */ },
}));

// src/store/caseStore.ts
export const useCaseStore = create<CaseState>((set) => ({
  currentCaseId: null,
  currentCase: null,
  caseList: [],
  setCaseId: (id) => set({ currentCaseId: id }),
  setCase: (caseData) => set({ currentCase: caseData }),
  updateCaseList: (list) => set({ caseList: list }),
}));

// src/store/uiStore.ts
export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  activeTab: 'documents',
  notifications: [],
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setActiveTab: (tab) => set({ activeTab: tab }),
  addNotification: (notif) => set((state) => ({
    notifications: [...state.notifications, notif],
  })),
}));
```

---

## Screen 1: Dashboard / Case List

### Purpose
Home screen showing all active and archived cases in a Kanban board view. Cases move through fixed workflow stages. Clinicians see cases assigned to them; psychometrists see limited data entry cases.

### Wireframe

```
┌───────────────────────────────────────────────────────────────┐
│ Psygil    Dashboard                           Help | User ▼ │
├───────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─ Quick Stats ───────────────────────────────────────────┐  │
│  │ Active Cases: 12  │ Pending Reviews: 3  │ Completed: 8  │  │
│  │ (This Month) ────────────────────────────────────────── │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  [+ Create New Case]                                            │
│                                                                 │
│  ┌──────┬──────┬────────┬────────┬────────┬────────┬────────┐  │
│  │ New  │Intake│Evidence│ Diag   │Writing │ Legal  │ Final  │  │
│  │  (0) │ (2)  │Mapping │Review  │  (3)   │Review  │Review  │  │
│  │      │      │  (1)   │ (2)    │        │  (1)   │ (2)    │  │
│  ├──────┼──────┼────────┼────────┼────────┼────────┼────────┤  │
│  │      │      │        │        │        │        │        │  │
│  │      │┌─────┴──────┐ │        │┌─────┐ │        │┌──────┐│  │
│  │      ││ Patient-101││ │        ││P-105│ │        ││P-110 ││  │
│  │      ││ Eval: Cust │ │        ││Eval:││ │        ││Eval: ││  │
│  │      ││ Stage: 1/8 │ │        ││C&A  ││ │        ││Cust  ││  │
│  │      ││ Days: 5    │ │        ││Days:││ │        ││Days: ││  │
│  │      ││ Next: Gate1│ │        ││14   ││ │        ││6      ││  │
│  │      │└───────────┬┘ │        │└─────┘ │        │└──────┘│  │
│  │      │┌────────────┴─┐│        │        │        │        │  │
│  │      ││ Patient-102  ││        │        │        │        │  │
│  │      ││ Eval: C&A    ││        │        │        │        │  │
│  │      ││ Stage: 2/8   ││        │        │        │        │  │
│  │      ││ Days: 2      ││        │        │        │        │  │
│  │      ││ Next: Ingest ││        │        │        │        │  │
│  │      │└──────────────┘│        │        │        │        │  │
│  │      │                │        │        │        │        │  │
│  └──────┴──────┴────────┴────────┴────────┴────────┴────────┘  │
│                                                                 │
│  Finalized & Archived:                                          │
│  P-090, P-085, P-080, P-075 [Show archived cases]               │
│                                                                 │
└───────────────────────────────────────────────────────────────┘
```

### React Component Tree

```typescript
// src/pages/DashboardPage.tsx

DashboardPage
├── QuickStatsBar
│   ├── StatCard (Active Cases)
│   ├── StatCard (Pending Reviews)
│   └── StatCard (Completed This Month)
├── CreateCaseButton
│   └── Modal: NewCaseForm
│       ├── PatientIDInput
│       ├── EvaluationTypeSelect
│       ├── ReferralSourceSelect
│       └── SubmitButton
├── KanbanBoard
│   ├── KanbanColumn (columnId="new")
│   │   ├── ColumnHeader
│   │   │   ├── Title
│   │   │   └── CaseCount
│   │   └── CaseCard[] (each case)
│   │       ├── PatientIDDisplay
│   │       ├── EvaluationTypeBadge
│   │       ├── StageBadge
│   │       ├── DaysInStageMeter
│   │       ├── NextActionLabel
│   │       └── ContextMenu
│   │           ├── ViewDetails
│   │           ├── MoveCase (if gates pass)
│   │           └── ArchiveCase
│   ├── KanbanColumn (columnId="intake")
│   ├── KanbanColumn (columnId="evidence-mapping")
│   ├── KanbanColumn (columnId="diagnostic-review")
│   ├── KanbanColumn (columnId="writing")
│   ├── KanbanColumn (columnId="legal-review")
│   ├── KanbanColumn (columnId="final-review")
│   ├── KanbanColumn (columnId="finalized")
│   └── KanbanColumn (columnId="archived")
└── ArchivedCasesList (collapsed, expandable)
    └── ArchivedCaseCard[]
```

### State Management

```typescript
interface DashboardState {
  cases: Case[];
  filter: 'all' | 'assigned-to-me' | 'pending-review';
  sortBy: 'date-updated' | 'days-in-stage' | 'priority';
  showArchived: boolean;
  selectedCase: Case | null;

  // Actions
  refreshCases: () => Promise<void>;
  moveCase: (caseId: string, targetColumn: string) => Promise<void>;
  archiveCase: (caseId: string) => Promise<void>;
}

// Used via:
const { cases, filter, refreshCases } = useDashboardStore();
```

### Key IPC Channels Used

| Channel | Purpose | Direction |
|---------|---------|-----------|
| `case:list` | Fetch all cases with gate status | Main ← Renderer |
| `case:move` | Attempt to move case between columns (checks gates) | Main ← Renderer |
| `case:archive` | Archive a case | Main ← Renderer |
| `audit:log-action` | Log dashboard navigation event | Main ← Renderer |

### Gate Validation Logic

```typescript
// Cases can only move between columns if gate validation passes
async function validateGateTransition(
  caseId: string,
  fromColumn: string,
  toColumn: string
): Promise<{ allowed: boolean; blockers?: string[] }> {

  const case = await getCaseDetails(caseId);

  // Gate 1 validation: must have confirmed data
  if (toColumn === 'diagnostic-review') {
    if (case.gates.gate1_status !== 'approved') {
      return {
        allowed: false,
        blockers: ['Gate 1 (Data Confirmation) not approved'],
      };
    }
  }

  // Gate 2 validation: must have diagnostic decisions
  if (toColumn === 'writing') {
    if (case.gates.gate2_status !== 'approved') {
      return {
        allowed: false,
        blockers: ['Gate 2 (Diagnostic Decision) not approved'],
      };
    }
  }

  // Gate 3 validation: must pass final review
  if (toColumn === 'finalized') {
    if (case.gates.gate3_status !== 'approved') {
      return {
        allowed: false,
        blockers: ['Gate 3 (Final Attestation) not approved'],
      };
    }
  }

  return { allowed: true };
}
```

---

## Screen 2: Case Detail / Workspace

### Purpose
Main workspace for case management. Sidebar navigation controls which section (Documents, Sessions, Tests, Evidence Map, Report, Audit Trail) is displayed in the main area. The top bar always shows case metadata and gate status.

### Wireframe

```
┌────────────────────────────────────────────────────────────────┐
│ Psygil  Case P-101 | Custody & Abuse | Stage: Evidence...    │
│                                               Help | User ▼     │
├────────────────────────────────────────────────────────────────┤
│                                                                  │
│ ┌────────────┐┌──────────────────────────────────────────────┐ │
│ │ Case Nav   ││          MAIN CONTENT AREA                   │ │
│ ├────────────┤│                                              │ │
│ │ Documents  ││  [Content changes based on selected section] │ │
│ │ Sessions   ││                                              │ │
│ │ Tests      ││  When "Documents" selected:                 │ │
│ │ Evidence   ││    • Upload area                            │ │
│ │  Map       ││    • Document list                          │ │
│ │ Report     ││    • Processing status                      │ │
│ │ Audit      ││                                              │ │
│ │ Trail      ││  When "Report" selected:                    │ │
│ │            ││    • OnlyOffice editor (75% width)          │ │
│ │            ││    • Section navigator (right panel)        │ │
│ │            ││                                              │ │
│ │ ─────────  ││  When "Evidence Map" selected:              │ │
│ │ [Close]    ││    • Evidence map display                   │ │
│ │            ││    • Diagnostic options                     │ │
│ │            ││                                              │ │
│ └────────────┘│                                              │ │
│               │                                              │ │
│               │                                              │ │
│               └──────────────────────────────────────────────┘ │
│                                                                  │
└────────────────────────────────────────────────────────────────┘
```

### Top Bar Detail

```
┌─────────────────────────────────────────────────────────────────┐
│ Logo | Case: P-101 | Eval: Custody & Abuse | Stage: 3/8         │
│                                                                   │
│ Gate Status Badges:                                               │
│ [✓ Gate 1] [✓ Gate 2] [⏳ Gate 3 (in progress)] [○ Not Applicable]│
│                                                                   │
│ Right Side: [Help] [User Menu] [Settings]                        │
└─────────────────────────────────────────────────────────────────┘
```

### React Component Tree

```typescript
// src/pages/CaseDetailPage.tsx

CaseDetailPage
├── TopBar (sticky)
│   ├── CaseMetadataSection
│   │   ├── CaseID
│   │   ├── EvaluationType
│   │   ├── CurrentStage (shows 3/8, etc.)
│   │   └── StageName
│   ├── GateStatusBadges
│   │   ├── GateBadge (gate1)
│   │   │   ├── Icon (checkmark, warning, pending)
│   │   │   ├── Label
│   │   │   └── Tooltip (shows details on hover)
│   │   ├── GateBadge (gate2)
│   │   ├── GateBadge (gate3)
│   │   └── GateBadge (N/A if not applicable)
│   └── UserActions
│       ├── HelpButton
│       └── UserMenu
├── CaseDetailLayout
│   ├── Sidebar
│   │   ├── CaseNavigation
│   │   │   ├── NavItem (onClick → setActiveSection('documents'))
│   │   │   │   ├── Icon
│   │   │   │   └── Label
│   │   │   ├── NavItem (sessions)
│   │   │   ├── NavItem (tests)
│   │   │   ├── NavItem (evidence-map)
│   │   │   ├── NavItem (report)
│   │   │   ├── NavItem (audit-trail)
│   │   │   └── Divider
│   │   └── CaseMetadata (sidebar)
│   │       ├── CreatedDate
│   │       ├── AssignedTo
│   │       ├── LastModified
│   │       └── CaseStatus
│   └── MainContent
│       ├── {activeSection === 'documents' && <DocumentUploadPage />}
│       ├── {activeSection === 'sessions' && <SessionsSection />}
│       ├── {activeSection === 'tests' && <TestsSection />}
│       ├── {activeSection === 'evidence-map' && <EvidenceMapSection />}
│       ├── {activeSection === 'report' && <ReportEditorPage />}
│       └── {activeSection === 'audit-trail' && <AuditTrailSection />}
```

### State Management

```typescript
interface CaseDetailState {
  caseId: string;
  case: Case | null;
  activeSection: 'documents' | 'sessions' | 'tests' | 'evidence-map' | 'report' | 'audit-trail';
  gateStatuses: GateStatus[];

  setActiveSection: (section: string) => void;
  loadCase: (caseId: string) => Promise<void>;
  refreshGateStatus: () => Promise<void>;
}

// Reusable hook:
export const useCaseDetail = (caseId: string) => {
  const { case: caseData, refreshGateStatus } = useCaseDetailStore();

  useEffect(() => {
    if (!caseData || caseData.id !== caseId) {
      useCaseDetailStore.getState().loadCase(caseId);
    }
  }, [caseId]);

  return { caseData, refreshGateStatus };
};
```

### Key IPC Channels Used

| Channel | Purpose | Direction |
|---------|---------|-----------|
| `case:details` | Get case full details (documents, sessions, tests) | Main ← Renderer |
| `case:gate-status` | Get current gate validation status | Main ← Renderer |
| `case:update-metadata` | Update case description, notes, etc. | Main ← Renderer |

---

## Screen 3: Document Upload & Ingestion

### Purpose
Upload source documents (PDFs, DOCX, audio, VTT files) and initiate ingestion. Shows processing status and extracted referral questions. Supports special import for standardized score reports (Q-global, PARiConnect).

### Wireframe

```
┌────────────────────────────────────────────────────────────────┐
│ Psygil  Case P-101 | Documents                  Help | User ▼ │
├────────────────────────────────────────────────────────────────┤
│                                                                  │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │  DRAG & DROP ZONE                                        │   │
│ │                                                          │   │
│ │  Drop PDFs, DOCX, audio, or VTT files here              │   │
│ │  or [Browse Files]                                       │   │
│ │                                                          │   │
│ │  Supported: .pdf, .docx, .mp3, .wav, .vtt, .m4a         │   │
│ │  Max size per file: 100 MB                               │   │
│ └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│ [Import Q-Global Score Report] [Import PARiConnect PDF]         │
│                                                                  │
│ ────────────────────────────────────────────────────────────   │
│                                                                  │
│ DOCUMENT LIST                                                   │
│                                                                  │
│ ┌──────┬─────────────────┬──────────┬─────────────────────┐    │
│ │ Type │ Filename        │ Uploaded │ Status              │    │
│ ├──────┼─────────────────┼──────────┼─────────────────────┤    │
│ │ [📄] │ Referral Letter │ 2 hrs    │ ✓ Ingested          │    │
│ │ [🎵] │ Session 1       │ 1 hr     │ ⟳ Transcribing 45%  │    │
│ │ [📊] │ WISC-V Scores   │ 30 min   │ ✓ Ingested          │    │
│ │ [📄] │ Evaluation Plan │ 15 min   │ ⚠ Needs Manual Conf │    │
│ └──────┴─────────────────┴──────────┴─────────────────────┘    │
│                                                                  │
│ ────────────────────────────────────────────────────────────   │
│                                                                  │
│ EXTRACTED REFERRAL QUESTIONS:                                   │
│                                                                  │
│ ┌─ Referral Questions from Intake Documents ───────────────┐   │
│ │                                                            │   │
│ │ □ What is patient's current cognitive functioning level?  │   │
│ │   Source: Referral Letter (page 2)                        │   │
│ │   [Edit] [Remove]                                         │   │
│ │                                                            │   │
│ │ □ Is there evidence of trauma history?                    │   │
│ │   Source: Auto-extracted, high confidence                 │   │
│ │   [Edit] [Remove]                                         │   │
│ │                                                            │   │
│ │ □ [+ Add Manual Question]                                 │   │
│ │                                                            │   │
│ └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│ [← Back] [Continue to Data Confirmation →]                      │
│                                                                  │
└────────────────────────────────────────────────────────────────┘
```

### React Component Tree

```typescript
// src/pages/DocumentUploadPage.tsx

DocumentUploadPage
├── DragDropUploadZone
│   ├── DropZoneOverlay
│   └── BrowseFilesButton
│       └── HiddenFileInput
├── QuickImportButtons
│   ├── ImportQGlobalButton (opens Q-Global parser dialog)
│   └── ImportPARiConnectButton (opens PARiConnect parser dialog)
├── DocumentList
│   ├── DocumentListHeader
│   │   ├── ColumnHeader (Type)
│   │   ├── ColumnHeader (Filename)
│   │   ├── ColumnHeader (Uploaded)
│   │   └── ColumnHeader (Status)
│   └── DocumentRow[]
│       ├── DocumentTypeIcon
│       ├── FilenameTruncated
│       ├── UploadDateRelative
│       ├── ProcessingStatusBadge
│       │   ├── ProgressBar (if in-progress)
│       │   ├── ErrorIcon + Tooltip (if failed)
│       │   └── CheckIcon (if complete)
│       ├── RetryButton (if failed)
│       └── DeleteButton
├── ReferralQuestionsPanel
│   ├── PanelHeader
│   │   ├── Title
│   │   └── InformationIcon (tooltip explaining extraction)
│   ├── QuestionCard[]
│   │   ├── CheckboxInput (for selection)
│   │   ├── QuestionText
│   │   ├── SourceBadge (which document it came from)
│   │   ├── ConfidenceMeter
│   │   ├── EditButton
│   │   └── RemoveButton
│   ├── ManualQuestionForm
│   │   ├── TextAreaInput
│   │   └── AddButton
│   └── ClearAllButton
└── NavigationButtons
    ├── BackButton
    └── ContinueButton (disabled until ≥1 document uploaded)
```

### State Management

```typescript
interface DocumentUploadState {
  documents: UploadedDocument[];
  uploadProgress: Map<string, number>; // fileId -> percentage
  referralQuestions: ReferralQuestion[];
  selectedQuestions: string[]; // questionIds

  addDocument: (file: File) => Promise<void>;
  removeDocument: (fileId: string) => Promise<void>;
  retryUpload: (fileId: string) => Promise<void>;
  extractReferralQuestions: () => Promise<void>;
  importQGlobalReport: (file: File) => Promise<void>;
  importPARiConnectReport: (file: File) => Promise<void>;
  updateQuestion: (questionId: string, updates: Partial<ReferralQuestion>) => void;
  removeQuestion: (questionId: string) => void;
  addManualQuestion: (text: string) => void;
  proceed: () => Promise<void>; // Saves and navigates to Gate 1
}
```

### Key IPC Channels Used

| Channel | Purpose | Direction |
|---------|---------|-----------|
| `document:upload` | Send file to main process for ingestion | Renderer → Main |
| `document:transcribe` | Request audio transcription (Python sidecar) | Main → Sidecar |
| `document:extract-referral` | Parse referral document for questions | Main → Sidecar |
| `document:import-qglobal` | Special handling for Q-Global score PDF | Main → Sidecar |
| `document:import-pariconnect` | Special handling for PARiConnect PDF | Main → Sidecar |
| `document:status` | Poll upload/processing status | Renderer → Main |
| `audit:log-action` | Log document upload event | Renderer → Main |

### Processing Status Flow

```
User selects file
    ↓
[Drag & Drop Zone] shows uploading
    ↓
Main process receives file via IPC
    ↓
Document stored in case folder
    ↓
Ingestion task dispatched:
  - If PDF/DOCX: Python sidecar.style/extract + PII detection
  - If Audio: Python sidecar.transcribe → stored as text + VTT
  - If VTT: parsed directly for session markers
    ↓
Referral questions extracted + displayed in editable cards
    ↓
User can manually add/edit questions
    ↓
Confirm and proceed to Gate 1
```

---

## Screen 4: Gate 1 — Data Confirmation

### Purpose
Review and confirm all extracted structured data before proceeding. Split view shows source document alongside extracted data. Checklist tracks what has been confirmed vs. needs review. This is the first formal gate.

### Wireframe

```
┌────────────────────────────────────────────────────────────────┐
│ Psygil  Case P-101 | Gate 1: Data Confirmation  Help | User ▼ │
├────────────────────────────────────────────────────────────────┤
│                                                                  │
│ ┌─ Split View ────────────────────────────────────────────┐    │
│ │                                                           │    │
│ │ LEFT (50%): Source Document          │ RIGHT (50%): Data │    │
│ │                                      │                   │    │
│ │ [PDF Viewer - Referral Letter]       │ EXTRACTED DATA:   │    │
│ │                                      │                   │    │
│ │ [Scrollable document preview]        │ Demographics:     │    │
│ │                                      │ ─────────────────│    │
│ │                                      │ Name: [P-101]     │    │
│ │                                      │ DOB: [DATE]       │    │
│ │                                      │ Age: [NUMBER]     │    │
│ │                                      │ Sex: [M/F]        │    │
│ │                                      │ Grade: [text]     │    │
│ │                                      │ [Expand/Collapse] │    │
│ │                                      │                   │    │
│ │                                      │ Referral:         │    │
│ │                                      │ ─────────────────│    │
│ │                                      │ From: [School]    │    │
│ │                                      │ Reason: [text]    │    │
│ │                                      │ [Expand/Collapse] │    │
│ │                                      │                   │    │
│ │                                      │ Test Scores:      │    │
│ │                                      │ ─────────────────│    │
│ │                                      │ WISC-V: [scores]  │    │
│ │                                      │ [Expand/Collapse] │    │
│ │                                      │                   │    │
│ └─────────────────────────────────────────────────────────────┘  │
│                                                                  │
│ DATA CONFIRMATION CHECKLIST:                                    │
│                                                                  │
│ ┌─ Category ──────────┬───────┬──────────────────────────────┐  │
│ │ Demographics        │ ✓ OK  │ (Confirmed by clinician)     │  │
│ │ Referral Questions  │ ⚠ REV │ (Missing evaluation consent) │  │
│ │ Test Scores         │ ✓ OK  │ (From Q-Global import)       │  │
│ │ Behavioral Obs.     │ ○ NEW │ (Not yet extracted)          │  │
│ │ Timeline            │ ✓ OK  │ (Auto-extracted)             │  │
│ │ Collateral Records  │ ✗ GAP │ (No school records)          │  │
│ └─────────────────────┴───────┴──────────────────────────────┘  │
│                                                                  │
│ [+ Add Manual Observation]                                       │
│                                                                  │
│ ┌─ Manual Observations ────────────────────────────────────┐    │
│ │                                                           │    │
│ │ Observation #1: Patient was cooperative during eval       │    │
│ │ Source: Clinician notes                                   │    │
│ │ Timestamp: 2026-03-19 14:30                              │    │
│ │ [Remove]                                                  │    │
│ │                                                           │    │
│ └───────────────────────────────────────────────────────────┘   │
│                                                                  │
│ [Confirm Data] [Request Re-Ingestion]                            │
│                                                                  │
└────────────────────────────────────────────────────────────────┘
```

### React Component Tree

```typescript
// src/pages/Gate1DataConfirmationPage.tsx

Gate1DataConfirmationPage
├── SplitViewContainer
│   ├── LeftPanel (50%)
│   │   ├── DocumentViewerHeader
│   │   │   ├── DocumentTitle
│   │   │   ├── PageIndicator
│   │   │   └── DownloadButton
│   │   └── DocumentViewer
│   │       └── PDFViewer (using react-pdf or similar)
│   │           ├── PreviousPageButton
│   │           ├── Canvas
│   │           └── NextPageButton
│   └── RightPanel (50%)
│       ├── ExtractedDataHeader
│       │   └── Title
│       ├── DataCategorySection[]
│       │   ├── CategoryHeader
│       │   │   ├── CategoryTitle
│       │   │   ├── ToggleExpandButton
│       │   │   └── StatusBadge
│       │   └── CategoryContent (when expanded)
│       │       ├── DataField[]
│       │       │   ├── FieldLabel
│       │       │   ├── EditableValue
│       │       │   └── ConfirmCheckbox
│       │       └── EditButton
│       └── ScrollContainer
├── DataConfirmationChecklist
│   ├── ChecklistHeader
│   │   └── Title
│   └── ChecklistItem[]
│       ├── CategoryName
│       ├── StatusIcon + Label
│       │   ├── Green checkmark (OK)
│       │   ├── Amber warning (Needs Review)
│       │   ├── Red X (Missing)
│       │   └── Blue circle (New / Not extracted)
│       └── Description (tooltip or collapsible)
├── ManualObservationSection
│   ├── SectionTitle
│   ├── ObservationCard[]
│   │   ├── ObservationText
│   │   ├── SourceBadge
│   │   ├── Timestamp
│   │   └── RemoveButton
│   ├── Divider
│   └── AddObservationForm
│       ├── TextAreaInput
│       ├── SourceDropdown (Clinician notes / Other)
│       └── AddButton
└── ActionButtons
    ├── ConfirmDataButton (disabled until all checklist items ≥ Amber)
    └── RequestReIngestionButton
```

### State Management

```typescript
interface Gate1State {
  caseId: string;
  extractedData: ExtractedDataMap; // category -> fields
  confirmationStatus: Map<string, ConfirmationStatus>; // category -> status
  manualObservations: ManualObservation[];
  newObservationText: string;

  toggleCategory: (category: string) => void;
  updateField: (category: string, fieldName: string, value: any) => void;
  confirmCategory: (category: string) => void;
  addManualObservation: (text: string, source: string) => void;
  removeObservation: (observationId: string) => void;
  requestReIngestion: (category: string) => Promise<void>;
  confirmAll: () => Promise<void>; // Locks Gate 1, saves attestation
}

const useGate1Store = create<Gate1State>((set) => ({
  // ...
}));
```

### Key IPC Channels Used

| Channel | Purpose | Direction |
|---------|---------|-----------|
| `gate1:get-extracted-data` | Retrieve all ingested and parsed data | Renderer → Main |
| `gate1:update-field` | User edits an extracted field | Renderer → Main |
| `gate1:add-observation` | Clinician adds manual observation | Renderer → Main |
| `gate1:confirm-category` | Mark a data category as confirmed | Renderer → Main |
| `gate1:request-reingest` | Trigger re-ingestion for a category | Renderer → Main |
| `gate1:confirm-all` | Submit Gate 1 (unlocks Gate 2) | Renderer → Main |
| `audit:log-action` | Log data confirmation event | Renderer → Main |

### Confirmation Logic

```typescript
// Only allow proceeding to Gate 2 if all critical categories are confirmed

interface ConfirmationStatus {
  status: 'ok' | 'needs-review' | 'missing' | 'new';
  confirmedAt?: string;
  confirmedBy?: string;
  notes?: string;
}

function canProceedToGate2(confirmationMap: Map<string, ConfirmationStatus>): boolean {
  const critical = ['demographics', 'referral-questions'];

  return critical.every((cat) => {
    const status = confirmationMap.get(cat);
    return status && ['ok', 'needs-review'].includes(status.status);
  });
}
```

---

## Screen 5: Gate 2 — Diagnostic Decision

### Purpose
**THIS IS THE MOST IMPORTANT SCREEN IN THE APPLICATION**

Clinician reviews evidence for each potential diagnosis and makes active diagnostic decisions. No AI recommendations are shown; clinician must explicitly select a decision for each diagnosis (Render Diagnosis, Rule Out, Defer, or No Decision). Evidence is presented in structured DSM-5-TR criteria tables. For forensic cases, Dusky/M'Naghten analysis is shown.

### Wireframe

```
┌────────────────────────────────────────────────────────────────┐
│ Psygil  Case P-101 | Gate 2: Diagnostic Decision  Help | User▼│
├────────────────────────────────────────────────────────────────┤
│                                                                  │
│ ┌─ VALIDITY & EFFORT ASSESSMENT (Forensic Cases) ────────────┐ │
│ │                                                              │ │
│ │ TOMM Result: Valid profile (both trials > 45)               │ │
│ │ SIRS-2 Result: Genuine presentation (F = 4, NIM = 0)        │ │
│ │ Conclusion: Data sufficient for forensic conclusions        │ │
│ │                                                              │ │
│ └──────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌─ PSYCHO-LEGAL ANALYSIS (if applicable) ──────────────────────┐ │
│ │                                                              │ │
│ │ Evaluating Competency Standard: DUSKY (Drope v. Missouri)    │ │
│ │ Clinician Assessment Required:                               │ │
│ │   ✓ Factual understanding of charges                        │ │
│ │   ○ Rational/irrational understanding of case               │ │
│ │   ○ Ability to consult with attorney                        │ │
│ │                                                              │ │
│ └──────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ═══════════════════════════════════════════════════════════════ │
│                                                                  │
│ DIAGNOSTIC EVIDENCE MAPS:                                       │
│                                                                  │
│ ┌─ ADHD ──────────────────────────────────┬─ Decision ──────┐   │
│ │                                          │                │   │
│ │ DSM-5-TR Criteria Summary:               │ [Render ADHD]  │   │
│ │                                          │ [Rule Out]     │   │
│ │ ┌──────┬──────────┬─────────┬──────┐   │ [Defer]        │   │
│ │ │Crit. │Evidence+ │Evidence-│Gap   │   │ [No Decision]  │   │
│ │ ├──────┼──────────┼─────────┼──────┤   │                │   │
│ │ │A1    │✓ Parent  │         │      │   │ Selected:      │   │
│ │ │(Inatten.)│report; │         │      │   │ [No Decision]  │   │
│ │ │      │TOVA      │         │      │   │                │   │
│ │ │      │(90th %)  │         │      │   │ Clinical Notes:│   │
│ │ │A2    │✓ T-scor. │○ Could be│      │   │ ───────────── │   │
│ │ │(Hypacti)│81; ✓    │anxiety  │      │   │               │   │
│ │ │      │Teacher   │  driven  │      │   │ [large text   │   │
│ │ │      │rating    │         │      │   │  area for     │   │
│ │ │B1    │✗ Not obs.│✓ Parent │      │   │  clinician    │   │
│ │ │(School)│in school │report │      │   │  reasoning]   │   │
│ │ │      │setting   │of home  │      │   │               │   │
│ │ │      │          │behavior │      │   │               │   │
│ │ │...   │...       │...      │...   │   │               │   │
│ │ └──────┴──────────┴─────────┴──────┘   │               │   │
│ │                                          │ [Save Notes]   │   │
│ │ Full Details: [Show/Hide]                │               │   │
│ │                                          │               │   │
│ └──────────────────────────────────────────┴───────────────┘   │
│                                                                  │
│ ┌─ Specific Learning Disorder ────────────┬─ Decision ──────┐   │
│ │ ...similar structure...                 │ [Render]       │   │
│ └─────────────────────────────────────────┴────────────────┘   │
│                                                                  │
│ ┌─ Anxiety Disorder ──────────────────────┬─ Decision ──────┐   │
│ │ ...similar structure...                 │ [Rule Out]     │   │
│ └─────────────────────────────────────────┴────────────────┘   │
│                                                                  │
│ [+ Add Custom Diagnosis]                                         │
│                                                                  │
│ [Proceed to Writing] (disabled until ≥1 diagnostic decision)    │
│                                                                  │
└────────────────────────────────────────────────────────────────┘
```

### React Component Tree

```typescript
// src/pages/Gate2DiagnosticDecisionPage.tsx

Gate2DiagnosticDecisionPage
├── ValidityAssessmentBanner (if forensic)
│   ├── TommResultCard
│   │   ├── Title
│   ├── Label
│   ├── ResultText
│   └── InterpretationText
│   ├── Sirsv2ResultCard
│   ├── ConclusionStatement
│   └── InfoIcon
├── PsychoLegalAnalysisPanel (if applicable)
│   ├── CompetencyStandardSelector
│   │   ├── Label
│   │   ├── DropdownSelect
│   │   │   ├── Option: Dusky (Fitness to Stand Trial)
│   │   │   ├── Option: M'Naghten (Insanity)
│   │   │   ├── Option: Best Interests (Guardianship)
│   │   │   └── Option: Other (custom)
│   │   └── InfoIcon
│   └── LegalStandardChecklist
│       ├── ChecklistItem[] (criteria specific to selected standard)
│       │   ├── CheckboxInput
│       │   ├── CriterionLabel
│       │   └── StatusIndicator
│       └── NotesTextArea
├── DiagnosisCardList
│   └── DiagnosisCard[] (one per potential diagnosis)
│       ├── DiagnosisHeader
│       │   ├── DiagnosisName (bolded)
│       │   └── DSMCode
│       ├── CriteriaTableContainer
│       │   └── CriteriaTable
│       │       ├── TableHeader
│       │       │   ├── "Criterion"
│       │       │   ├── "Evidence For"
│       │       │   ├── "Evidence Against"
│       │       │   ├── "Data Gap"
│       │       │   └── "Source Document"
│       │       └── CriteriaRow[] (one per DSM criterion)
│       │           ├── CriterionID
│       │           ├── EvidenceForCell
│       │           │   ├── ✓ Icon + Evidence summary
│       │           │   ├── Source indicator
│       │           │   └── ExpandButton (shows full text)
│       │           ├── EvidenceAgainstCell
│       │           │   ├── ✗ Icon (if applicable)
│       │           │   └── Evidence summary
│       │           ├── DataGapCell
│       │           │   ├── ○ Icon
│       │           │   └── Missing data description
│       │           └── SourceCell
│       │               └── DocumentLink
│       ├── FullDetailsToggle (Show/Hide full criterion text)
│       ├── DecisionPanel (RIGHT SIDE)
│       │   ├── DecisionButtonGroup
│       │   │   ├── RenderDiagnosisButton (primary style)
│       │   │   ├── RuleOutButton
│       │   │   ├── DeferButton
│       │   │   └── NoDecisionButton (default, grayed out)
│       │   ├── SelectedDecisionDisplay
│       │   │   └── "Selected: [decision]"
│       │   ├── ClinicalNotesLabel
│       │   └── ClinicalNotesTextArea
│       │       └── Placeholder text
│       └── SaveNotesButton (per diagnosis)
├── AddCustomDiagnosisButton
│   └── Modal: CustomDiagnosisForm
│       ├── DiagnosisNameInput
│       ├── DSMCodeInput
│       └── AddButton
└── ProceedToWritingButton
    └── (Disabled until ≥ 1 diagnosis has a decision other than "No Decision")
```

### State Management

```typescript
interface DiagnosticDecision {
  diagnosisId: string;
  diagnosisName: string;
  dsmCode: string;
  decision: 'render' | 'rule-out' | 'defer' | 'no-decision'; // Default: no-decision
  clinicalNotes: string;
  lastModifiedAt: string;
  lastModifiedBy: string;
}

interface Gate2State {
  caseId: string;
  diagnoses: Diagnosis[]; // Populated from case setup
  decisions: Map<string, DiagnosticDecision>; // diagnosis ID -> decision

  // Forensic-specific
  validityAssessment: ValidityAssessment | null;
  psychoLegalStandard: 'dusky' | 'm-naghten' | 'best-interests' | 'custom' | null;
  legalStandardAssessment: Map<string, boolean>; // criterion -> assessed

  // Actions
  setDecision: (diagnosisId: string, decision: DiagnosticDecision) => void;
  updateClinicalNotes: (diagnosisId: string, notes: string) => void;
  addCustomDiagnosis: (diagnosis: Diagnosis) => void;
  setLegalStandard: (standard: string) => void;
  assessLegalCriterion: (criterionId: string, assessed: boolean) => void;
  canProceed: () => boolean; // True if ≥1 diagnosis has decision != no-decision
  proceed: () => Promise<void>; // Locks Gate 2, initiates Report generation
}

const useGate2Store = create<Gate2State>((set) => ({
  // ...
}));
```

### Critical Design Note: No AI Recommendation Auto-Accept

```typescript
// ENFORCED: There is NO auto-accept mechanism
// ENFORCED: No "Accept All" button exists
// ENFORCED: No summary recommendation is shown until clinician has made explicit selections

interface DiagnosticCard {
  // Shows evidence only
  criteriaTable: CriteriaTable;

  // Decision buttons are always neutral (no default highlight)
  decisionButtons: {
    render: Button;     // Not pre-selected
    ruleOut: Button;    // Not pre-selected
    defer: Button;      // Not pre-selected
    noDecision: Button; // Default visual state (grayed)
  };

  // No "AI recommends X" text is shown
  // No progress bar suggesting one decision is more likely
  // Clinician must actively click to make a selection
}
```

### Key IPC Channels Used

| Channel | Purpose | Direction |
|---------|---------|-----------|
| `gate2:get-diagnoses` | Retrieve potential diagnoses for case | Renderer → Main |
| `gate2:get-evidence` | Get evidence summary for a diagnosis | Renderer → Main |
| `gate2:set-decision` | Save clinician's diagnostic decision | Renderer → Main |
| `gate2:set-legal-standard` | Update forensic legal standard | Renderer → Main |
| `gate2:confirm-all` | Lock Gate 2, initiate report generation | Renderer → Main |
| `llm:report-stream` | Receive report sections as they're generated | Main → Renderer |
| `audit:log-action` | Log diagnostic decision event | Renderer → Main |

### Report Generation Trigger

Once clinician confirms Gate 2:

```
Gate 2 Confirm Click
    ↓
IPC: gate2:confirm-all sent to Main
    ↓
Main process validates ≥1 decision made
    ↓
Main invokes LLM via llm:complete with:
  {
    case_id: "...",
    diagnoses: [list of clinician decisions],
    evidence_map: {...},
    template: "clinical_report_template",
    model: "claude-3-5-sonnet"
  }
    ↓
LLM generates report sections in streaming mode
    ↓
Each section streamed via IPC llm:report-stream → Renderer
    ↓
Report sections inserted into OnlyOffice document
    ↓
Renderer navigates to Screen 6 (Report Editor)
```

---

## Screen 6: Report Editor

### Purpose
OnlyOffice document editor displaying the generated clinical report. Right sidebar shows section navigator and content status (complete vs. draft requiring revision). Agent status panel shows Writer Agent progress as sections stream in.

### Wireframe

```
┌────────────────────────────────────────────────────────────────┐
│ Psygil  Case P-101 | Report Editor              Help | User ▼ │
├────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────┬──────────────────────────────┐ │
│  │  OnlyOffice Document        │ SECTION NAVIGATOR            │ │
│  │  (75% width)                │ (25% width)                  │ │
│  │                             │                              │ │
│  │ [CLINICAL REPORT FOR...]    │ SECTIONS:                    │ │
│  │                             │                              │ │
│  │ REFERRAL & BACKGROUND       │ □ Referral & Background      │ │
│  │ Patient: [de-identified]    │ □ Clinical History           │ │
│  │ Evaluation Type: C&A        │ ✓ Behavioral Observations    │ │
│  │ Date of Eval: ...           │ ✓ Test Results (Complete)    │ │
│  │ Reason for Referral: ...    │ ⚠ Diagnostic Formulation     │ │
│  │                             │ ⚠ Risk Assessment            │ │
│  │ ...                         │ □ Recommendations            │ │
│  │                             │ □ Limitations                │ │
│  │ CLINICAL HISTORY            │                              │ │
│  │ [User can edit freely]      │ ─────────────────────────    │ │
│  │                             │                              │ │
│  │ BEHAVIORAL OBSERVATIONS     │ AGENT STATUS:                │ │
│  │ [with annotation] ◄─────────┤ ⟳ Generating...              │ │
│  │ "Patient presented alert    │ Current: Diagnostic Section  │ │
│  │ and oriented. Affect        │ Tokens Used: 4,250 / 8,000   │ │
│  │ appropriate. Speech clear." │ Est. Time: 45 sec remaining  │ │
│  │                             │                              │ │
│  │ [+] Insert Observations ◄───┤ ◄─ Shows progress bar        │ │
│  │                             │                              │ │
│  │ [Formatted text from LLM]   │                              │ │
│  │                             │                              │ │
│  │ TEST RESULTS [Complete]     │ REVISION NOTES:              │ │
│  │ [Table with WISC-V scores]  │                              │ │
│  │                             │ • Diag. section needs       │ │
│  │ ...                         │   review of DSM mapping     │ │
│  │                             │ • Add limitations on IQ     │ │
│  │                             │   from ODD diagnosis        │ │
│  │                             │                              │ │
│  │                             │ ─────────────────────────    │ │
│  │                             │ [Save Revision Notes]        │ │
│  │                             │ [Request Full Regeneration]  │ │
│  │                             │                              │ │
│  └─────────────────────────────┴──────────────────────────────┘ │
│                                                                  │
│ [← Back] [Gate 3: Final Review →]                               │
│                                                                  │
└────────────────────────────────────────────────────────────────┘
```

### React Component Tree

```typescript
// src/pages/ReportEditorPage.tsx

ReportEditorPage
├── ReportEditorLayout
│   ├── MainEditorPanel (75% width)
│   │   ├── OnlyOfficeDocumentEditor
│   │   │   ├── EditorContainer
│   │   │   │   └── OnlyOffice API embedded iframe
│   │   │   ├── FloatingToolbar (on text selection)
│   │   │   │   ├── BoldButton
│   │   │   │   ├── ItalicButton
│   │   │   │   └── HighlightButton (for revision markers)
│   │   │   └── SectionAnnotationOverlay
│   │   │       └── SectionAnnotation[] (floating badges)
│   │   │           ├── SectionName
│   │   │           ├── StatusIcon
│   │   │           └── RevisionNote (on hover)
│   │   └── InsertObservationsButton
│   │       └── Modal: ManualObservationInserter
│   │           ├── ObservationSelector (checkboxes)
│   │           ├── CustomTextArea (add more)
│   │           └── InsertButton
│   └── RightSidebar (25% width)
│       ├── SectionNavigator
│       │   ├── NavigatorHeader
│       │   │   └── "SECTIONS"
│       │   └── SectionLink[]
│       │       ├── SectionName
│       │       ├── StatusIcon
│       │       │   ├── ✓ (complete, green)
│       │       │   ├── ⚠ (draft/needs revision, amber)
│       │       │   └── □ (not yet generated, gray)
│       │       └── onClick: scrollIntoView on editor
│       ├── Divider
│       ├── AgentStatusPanel
│       │   ├── AgentStatusHeader
│       │   │   └── "AGENT STATUS"
│       │   ├── StatusIndicator
│       │   │   ├── Icon (animated if in-progress)
│       │   │   └── StatusText (e.g., "Generating..." or "Idle")
│       │   ├── CurrentSectionDisplay
│       │   │   ├── Label: "Current Section:"
│       │   │   └── SectionName
│       │   ├── TokenMetrics
│       │   │   ├── TokensUsedLabel
│       │   │   ├── "X tokens / Y tokens"
│       │   │   └── ProgressBar
│       │   ├── EstimatedTimeRemaining
│       │   │   ├── Label
│       │   │   └── TimeEstimate
│       │   └── ErrorMessageContainer (if agent fails)
│       ├── Divider
│       ├── RevisionNotesPanel
│       │   ├── PanelHeader
│       │   │   └── "REVISION NOTES"
│       │   ├── RevisionNoteList
│       │   │   └── RevisionNote[]
│       │   │       ├── BulletPoint
│       │   │       ├── NoteText (editable)
│       │   │       ├── SectionReference (links to section)
│       │   │       ├── EditButton
│       │   │       └── DeleteButton
│       │   ├── AddRevisionNoteForm
│       │   │   ├── TextAreaInput
│       │   │   └── AddButton
│       │   └── SaveRevisionNotesButton
│       └── ActionButtons
│           ├── RequestFullRegenerationButton
│           └── RegenerateSection (context menu on sections)
└── NavigationButtons (sticky footer)
    ├── BackButton
    └── ProceedToGate3Button (disabled until report marked complete)
```

### State Management

```typescript
interface ReportEditorState {
  caseId: string;
  reportId: string;
  documentContent: string; // OnlyOffice document JSON/HTML
  sections: Section[]; // List of report sections
  sectionStatus: Map<string, 'not-started' | 'generating' | 'complete' | 'draft'>;

  // Agent streaming
  agentActive: boolean;
  currentSection: string | null;
  tokensUsed: number;
  totalTokens: number;
  estimatedTimeRemaining: number;

  // Revision tracking
  revisionNotes: RevisionNote[];

  // Actions
  updateDocumentContent: (content: string) => void;
  insertObservations: (observations: string[]) => void;
  addRevisionNote: (note: RevisionNote) => void;
  removeRevisionNote: (noteId: string) => void;
  requestSectionRegeneration: (sectionName: string) => Promise<void>;
  requestFullRegeneration: () => Promise<void>;
  markReportComplete: () => Promise<void>;
}

const useReportEditorStore = create<ReportEditorState>((set) => ({
  // ...
}));
```

### Key IPC Channels Used

| Channel | Purpose | Direction |
|---------|---------|-----------|
| `onlyoffice:open` | Open document in OnlyOffice editor | Renderer → Main |
| `onlyoffice:save` | Save document back to file system | Renderer → Main |
| `onlyoffice:get-content` | Get current editor content | Renderer → Main |
| `llm:report-stream` | Receive streamed report sections | Main → Renderer |
| `llm:regenerate-section` | Request regeneration of one section | Renderer → Main |
| `llm:cancel-generation` | Cancel in-progress report generation | Renderer → Main |
| `report:insert-observations` | Add clinician observations to document | Renderer → Main |
| `audit:log-action` | Log report editing events | Renderer → Main |

### OnlyOffice Integration

```typescript
// src/components/OnlyOfficeDocumentEditor.tsx

interface OnlyOfficeDocumentEditorProps {
  documentUrl: string; // File path or S3 URL
  readOnly: boolean;
  onSave: (content: string) => Promise<void>;
  onEdit: (isDirty: boolean) => void;
}

export const OnlyOfficeDocumentEditor: React.FC<OnlyOfficeDocumentEditorProps> = ({
  documentUrl,
  readOnly,
  onSave,
  onEdit,
}) => {
  useEffect(() => {
    // Load OnlyOffice API
    const script = document.createElement('script');
    script.src = 'http://localhost:8000/web-apps/apps/api/documents/api.js';
    document.head.appendChild(script);

    script.onload = () => {
      // Initialize OnlyOffice editor
      const editor = new window.DocsAPI.DocEditor('onlyoffice-editor', {
        document: {
          fileType: 'docx',
          key: `key_${caseId}_${Date.now()}`,
          title: `Clinical Report - ${caseId}`,
          url: documentUrl,
        },
        editorConfig: {
          mode: readOnly ? 'view' : 'edit',
          callbackUrl: `http://localhost/callback`,
        },
        events: {
          onDocumentStateChange: (event) => onEdit(event.data),
          onRequestSaveAs: (event) => onSave(event.data.url),
        },
      });
    };
  }, [documentUrl]);

  return <div id="onlyoffice-editor" style={{ height: '100%' }} />;
};
```

---

## Screen 7: Gate 3 — Final Attestation

### Purpose
Final review and attestation before locking and sealing the report. Display reviewer flags (if any), fact-check results, and source verification summary. Clinician reviews and signs the attestation statement. Report is locked and a sealed PDF is generated with integrity hash.

### Wireframe

```
┌────────────────────────────────────────────────────────────────┐
│ Psygil  Case P-101 | Gate 3: Final Attestation  Help | User ▼ │
├────────────────────────────────────────────────────────────────┤
│                                                                  │
│ ┌─ REVIEWER FLAGS ─────────────────────────────────────────┐   │
│ │                                                           │   │
│ │ ⚠ [HIGH] Inconsistency in IQ scores                      │   │
│ │   Description: WAIS-IV shows 82, but WISC-V shows 74.   │   │
│ │   Suggestion: Clarify reason for discrepancy in report. │   │
│ │   [✓ Accept] [✗ Dismiss] [✎ Modify]                     │   │
│ │                                                           │   │
│ │ ℹ [INFO] Missing school records                          │   │
│ │   Description: No teacher questionnaires on file.        │   │
│ │   Suggestion: Add note about limitations on observation. │   │
│ │   [✓ Accept] [✗ Dismiss] [✎ Modify]                     │   │
│ │                                                           │   │
│ │ [+ Show All Flags] (if paginated)                        │   │
│ │                                                           │   │
│ └───────────────────────────────────────────────────────────┘   │
│                                                                  │
│ ┌─ REPORT INTEGRITY CHECK ─────────────────────────────────┐   │
│ │                                                           │   │
│ │ ✓ Source Verification: 98% of claims traced to source    │   │
│ │ ✓ Fact Check: 0 contradictions detected                  │   │
│ │ ✓ PII Scrubbing: All PII de-identified correctly         │   │
│ │ ⚠ Templates: 2 boilerplate sections (review for accuracy)│   │
│ │                                                           │   │
│ └───────────────────────────────────────────────────────────┘   │
│                                                                  │
│ ┌─ ATTESTATION STATEMENT ──────────────────────────────────┐   │
│ │                                                           │   │
│ │ I hereby attest that this clinical evaluation and        │   │
│ │ diagnostic opinion are based on information gathered    │   │
│ │ during the evaluation period and are consistent with    │   │
│ │ applicable professional standards. I have reviewed all  │   │
│ │ source materials and documented any limitations.        │   │
│ │                                                           │   │
│ │ [Edit Attestation Text]                                 │   │
│ │                                                           │   │
│ │ Evaluated by: Dr. Jane Smith                             │   │
│ │ License #: PS12345 (CA)                                  │   │
│ │ Date: March 19, 2026                                     │   │
│ │                                                           │   │
│ │ [Digitally Sign] ← Opens signature pad                   │   │
│ │                                                           │   │
│ └───────────────────────────────────────────────────────────┘   │
│                                                                  │
│ ┌─ SEALING & HASH ─────────────────────────────────────────┐   │
│ │                                                           │   │
│ │ Upon finalization, this report will be:                  │   │
│ │ • Locked from further editing                            │   │
│ │ • Assigned an integrity hash (SHA-256)                   │   │
│ │ • Exported as a sealed PDF with hash embedded            │   │
│ │ • Recorded in the audit trail with timestamp             │   │
│ │                                                           │   │
│ └───────────────────────────────────────────────────────────┘   │
│                                                                  │
│ [← Back to Report] [Finalize & Seal Report]                     │
│                                                                  │
└────────────────────────────────────────────────────────────────┘
```

### React Component Tree

```typescript
// src/pages/Gate3FinalAttestationPage.tsx

Gate3FinalAttestationPage
├── ReviewerFlagsSection
│   ├── SectionHeader
│   │   ├── Title
│   │   └── FlagCount
│   ├── FlagList
│   │   └── ReviewerFlag[]
│   │       ├── SeverityBadge
│   │       │   ├── [HIGH] (red)
│   │       │   ├── [MEDIUM] (amber)
│   │       │   └── [INFO] (blue)
│   │       ├── FlagTitle
│   │       ├── FlagDescription
│   │       ├── SuggestionBox
│   │       │   ├── Label
│   │       │   └── SuggestionText
│   │       └── ActionButtons
│   │           ├── AcceptButton
│   │           ├── DismissButton
│   │           └── ModifyButton (opens edit dialog)
│   └── ShowAllFlagsButton (if paginated)
├── ReportIntegrityCheckSection
│   ├── SectionHeader
│   │   └── Title
│   ├── IntegrityCheckList
│   │   └── IntegrityCheckItem[]
│   │       ├── StatusIcon (✓ or ⚠)
│   │       ├── CheckTitle
│   │       └── CheckDetails
│   │           ├── Description
│   │           └── Remediation (if ⚠)
│   └── InfoIcon (explain what these checks mean)
├── AttestationStatementSection
│   ├── SectionHeader
│   │   └── Title
│   ├── StatementText
│   │   └── EditableTextArea
│   ├── ClinicianMetadataSection
│   │   ├── ClinicianNameDisplay
│   │   ├── LicenseNumberDisplay
│   │   ├── EvaluationDateDisplay
│   │   └── EditButton (to change date if needed)
│   └── DigitalSignatureSection
│       ├── SignaturePadButton
│       │   └── Modal: SignaturePad
│       │       ├── Canvas for drawing
│       │       ├── ClearButton
│       │       ├── UndoButton
│       │       └── ConfirmSignatureButton
│       ├── SignaturePreviewImage
│       └── SignedIndicator
├── SealingInfoSection
│   ├── SectionHeader
│   │   └── Title
│   ├── SealingSteps
│   │   ├── Step (locked)
│   │   ├── Step (hash assigned)
│   │   ├── Step (PDF sealed)
│   │   └── Step (audit recorded)
│   └── HashPreview
│       ├── Label
│       └── HashValue (SHA-256, truncated for display)
└── ActionButtons (sticky footer)
    ├── BackButton
    └── FinalizeReportButton
        ├── onClick: confirmFinalizeDialog()
        └── Dialog: FinalizeConfirmation
            ├── WarningText
            ├── CheckboxToConfirm (user must check)
            └── FinalizeButton (enabled only if checked)
```

### State Management

```typescript
interface Gate3State {
  caseId: string;
  reportId: string;
  flags: ReviewerFlag[];
  flagResolutions: Map<string, 'accepted' | 'dismissed' | 'modified'>;

  // Attestation
  attestationStatement: string; // Configurable, default provided
  clinicianName: string;
  clinicianLicenseNumber: string;
  evaluationDate: string;
  signature: string; // Base64-encoded image

  // Integrity
  integrityChecks: IntegrityCheck[];

  // Actions
  setFlagResolution: (flagId: string, resolution: string) => void;
  modifyFlag: (flagId: string, modification: string) => void;
  updateAttestationStatement: (text: string) => void;
  setSignature: (signatureImage: string) => void;
  finalize: () => Promise<void>; // Locks report, generates hash, saves sealed PDF
  canFinalize: () => boolean; // True if all flags addressed + signed
}

const useGate3Store = create<Gate3State>((set) => ({
  // ...
}));
```

### Key IPC Channels Used

| Channel | Purpose | Direction |
|---------|---------|-----------|
| `gate3:get-flags` | Retrieve reviewer flags | Renderer → Main |
| `gate3:set-flag-resolution` | Record clinician's flag response | Renderer → Main |
| `gate3:get-integrity-check` | Get report integrity summary | Renderer → Main |
| `gate3:sign-attestation` | Save signature | Renderer → Main |
| `gate3:finalize` | Lock report, generate hash, seal PDF | Renderer → Main |
| `audit:log-action` | Log finalization event with hash | Renderer → Main |

### Report Sealing & Hashing

```typescript
// Invoked on Gate 3 finalization

async function finalizeReport(
  caseId: string,
  reportId: string,
  signature: string,
): Promise<FinalizedReport> {

  // 1. Lock document in OnlyOffice
  await onlyoffice.lockDocument(reportId);

  // 2. Export current document as PDF
  const pdfBuffer = await onlyoffice.exportToPDF(reportId);

  // 3. Generate integrity hash
  const hash = sha256(pdfBuffer + signature + new Date().toISOString());

  // 4. Embed hash in PDF metadata
  const sealedPdf = embedHashInPDF(pdfBuffer, hash);

  // 5. Save sealed PDF
  const sealedPath = await fileSystem.saveSealedPDF(
    caseId,
    reportId,
    sealedPdf,
  );

  // 6. Lock report in database
  await database.lockReport(reportId, hash);

  // 7. Create audit record
  await auditLog.record({
    caseId,
    reportId,
    action: 'finalize',
    hash,
    signature,
    timestamp: new Date(),
    user: currentUser.id,
  });

  // 8. Update case stage to "Finalized"
  await caseService.updateStage(caseId, 'finalized');

  return {
    reportId,
    hash,
    sealedPdfPath: sealedPath,
    finalizedAt: new Date(),
  };
}
```

---

## Screen 8: Settings / Configuration

### Purpose
User profile, diagnosis configuration, instrument management, template management, style rules, and audit trail preferences.

### Wireframe

```
┌────────────────────────────────────────────────────────────────┐
│ Psygil  Settings                              Help | User ▼  │
├────────────────────────────────────────────────────────────────┤
│                                                                  │
│ ┌─ Settings Tabs ─────────────────────────────────────────┐    │
│ │ [Profile] [Diagnoses] [Instruments] [Templates] [Style]│    │
│ │ [Audit Trail] [Security]                                │    │
│ └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│ ═════════════════════════════════════════════════════════════  │
│                                                                  │
│ PROFILE TAB:                                                    │
│                                                                  │
│ Name: [Dr. Jane Smith]                                          │
│ Email: [jane@clinic.org]                                        │
│ Role: [Dropdown: Clinician / Legal Reviewer / Admin]           │
│ License: [PS12345 (CA)]                                         │
│ Specialty: [Forensic Psychology / Clinical Psychology]         │
│ [Save Changes]                                                  │
│                                                                  │
│ ─────────────────────────────────────────────────────────      │
│                                                                  │
│ DIAGNOSES TAB:                                                  │
│                                                                  │
│ Manage available diagnoses and instrument mappings:             │
│                                                                  │
│ ┌─ Diagnosis List ─────────────────────────────────────────┐   │
│ │ ✓ ADHD                      [Map Instruments]  [Remove]   │   │
│ │   Instruments: TOVA, CPT, WISC-V                         │   │
│ │                                                          │   │
│ │ ✓ Specific Learning Disorder [Map Instruments]  [Remove]│   │
│ │   Instruments: WIAT-III, WISC-V                         │   │
│ │                                                          │   │
│ │ ✓ Oppositional Defiant Disorder [Map Instruments] [Rmv] │   │
│ │   Instruments: CBCL, TRF, BASC-3                        │   │
│ │                                                          │   │
│ │ [+ Add Custom Diagnosis]                                 │   │
│ │   Form: Name, DSM Code, Instruments                      │   │
│ │   [Add]                                                  │   │
│ │                                                          │   │
│ └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│ ─────────────────────────────────────────────────────────      │
│                                                                  │
│ INSTRUMENTS TAB:                                                │
│                                                                  │
│ Manage psychological tests and instruments:                     │
│                                                                  │
│ ┌─ Instrument List ────────────────────────────────────────┐   │
│ │ WISC-V (Wechsler Intelligence Scale)  [Edit] [Remove]    │   │
│ │ WIAT-III (Wechsler Individual Achievement Test) [E] [R]  │   │
│ │ CBCL (Child Behavior Checklist)  [Edit] [Remove]        │   │
│ │ BASC-3 (Behavior Assessment System)  [Edit] [Remove]    │   │
│ │ ...                                                      │   │
│ │                                                          │   │
│ │ [+ Add Custom Instrument]                                │   │
│ │   Form: Name, Publisher, Subscales, Scoring             │   │
│ │   [Add]                                                  │   │
│ │                                                          │   │
│ └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│ ─────────────────────────────────────────────────────────      │
│                                                                  │
│ TEMPLATES TAB:                                                  │
│                                                                  │
│ Report templates per evaluation type and jurisdiction:          │
│                                                                  │
│ ┌─ Template List ──────────────────────────────────────────┐   │
│ │ Evaluation Type: Custody & Abuse                         │   │
│ │ Jurisdiction: California                                │   │
│ │ Template: [Standard CA Custody Report Template]         │   │
│ │ [Edit] [Preview] [Delete]                               │   │
│ │                                                          │   │
│ │ Evaluation Type: School Evaluation                       │   │
│ │ Jurisdiction: Multi-State                               │   │
│ │ Template: [IDEA-Compliant Report Template]              │   │
│ │ [Edit] [Preview] [Delete]                               │   │
│ │                                                          │   │
│ │ [+ Add New Template]                                     │   │
│ │   Form: Eval Type, Jurisdiction, Template Content      │   │
│ │   [Add]                                                  │   │
│ │                                                          │   │
│ └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│ ─────────────────────────────────────────────────────────      │
│                                                                  │
│ STYLE RULES TAB:                                                │
│                                                                  │
│ View and edit writing style guidelines and guardrails:          │
│                                                                  │
│ ┌─ Style Guide ────────────────────────────────────────────┐   │
│ │ Tone: Professional, objective                            │   │
│ │ Avoid: Jargon, unsupported claims, emotional language   │   │
│ │ Recommend: Criterion-referenced language, empirical data │   │
│ │ Examples: [Show / Hide]                                  │   │
│ │ [Edit Style Rules]                                       │   │
│ │                                                          │   │
│ └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│ ─────────────────────────────────────────────────────────      │
│                                                                  │
│ AUDIT TRAIL TAB:                                                │
│                                                                  │
│ [○ Decision Record Only] [●] Full Detail                       │
│ (Controls audit trail verbosity)                                │
│ [Save Preferences]                                              │
│                                                                  │
│ ─────────────────────────────────────────────────────────      │
│                                                                  │
│ SECURITY TAB:                                                   │
│                                                                  │
│ Password: [****] [Change Password]                              │
│ Two-Factor Authentication: [Enabled] [Disable]                 │
│ Session Timeout: [30 minutes] [Dropdown]                       │
│ [Save Security Settings]                                        │
│                                                                  │
│ ═════════════════════════════════════════════════════════════  │
│                                                                  │
│ [Save All Changes] [Cancel]                                     │
│                                                                  │
└────────────────────────────────────────────────────────────────┘
```

### React Component Tree

```typescript
// src/pages/SettingsPage.tsx

SettingsPage
├── SettingsContainer
│   ├── TabNavigation
│   │   ├── TabButton (profile, active)
│   │   ├── TabButton (diagnoses)
│   │   ├── TabButton (instruments)
│   │   ├── TabButton (templates)
│   │   ├── TabButton (style)
│   │   ├── TabButton (audit-trail)
│   │   └── TabButton (security)
│   └── TabContent
│       ├── {activeTab === 'profile' && <ProfileTab />}
│       │   ├── ProfileForm
│       │   │   ├── TextInput (name)
│       │   │   ├── TextInput (email)
│       │   │   ├── Select (role)
│       │   │   ├── TextInput (license)
│       │   │   └── MultiSelect (specialties)
│       │   └── SaveButton
│       ├── {activeTab === 'diagnoses' && <DiagnosesTab />}
│       │   ├── DiagnosisList
│       │   │   └── DiagnosisItem[]
│       │   │       ├── DiagnosisName
│       │   │       ├── MappedInstruments (badges)
│       │   │       ├── MapInstrumentsButton
│       │   │       │   └── Modal: InstrumentMapper
│       │   │       │       ├── Checklist of instruments
│       │   │       │       └── SaveButton
│       │   │       └── RemoveButton
│       │   ├── Divider
│       │   └── AddCustomDiagnosisForm
│       │       ├── TextInput (name)
│       │       ├── TextInput (DSM code)
│       │       ├── MultiSelect (instruments)
│       │       └── AddButton
│       ├── {activeTab === 'instruments' && <InstrumentsTab />}
│       │   ├── InstrumentList
│       │   │   └── InstrumentItem[]
│       │   │       ├── InstrumentName
│       │   │       ├── Publisher
│       │   │       ├── EditButton
│       │   │       └── RemoveButton
│       │   └── AddCustomInstrumentForm
│       │       ├── TextInput (name)
│       │       ├── TextInput (publisher)
│       │       ├── TextArea (subscales)
│       │       ├── TextArea (scoring rules)
│       │       └── AddButton
│       ├── {activeTab === 'templates' && <TemplatesTab />}
│       │   ├── TemplateList
│       │   │   └── TemplateItem[]
│       │   │       ├── EvaluationType
│       │   │       ├── Jurisdiction
│       │   │       ├── TemplateName
│       │   │       ├── PreviewButton
│       │   │       ├── EditButton
│       │   │       └── DeleteButton
│       │   └── AddTemplateButton
│       │       └── Modal: TemplateCreator
│       ├── {activeTab === 'style' && <StyleTab />}
│       │   ├── StyleGuideDisplay
│       │   │   ├── Tone section
│       │   │   ├── AvoidSection
│       │   │   ├── RecommendSection
│       │   │   └── ExamplesToggle
│       │   └── EditStyleRulesButton
│       │       └── Modal: StyleRuleEditor
│       ├── {activeTab === 'audit-trail' && <AuditTrailTab />}
│       │   ├── DetailLevelSelector
│       │   │   ├── RadioOption (Decision Record Only)
│       │   │   └── RadioOption (Full Detail)
│       │   └── SaveButton
│       └── {activeTab === 'security' && <SecurityTab />}
│           ├── PasswordSection
│           │   ├── PasswordInput
│           │   └── ChangePasswordButton
│           ├── TwoFactorSection
│           │   ├── StatusToggle
│           │   └── SetupInstructions
│           ├── SessionTimeoutSection
│           │   └── TimeoutSelect
│           └── SaveButton
└── BottomActionButtons
    ├── SaveAllButton
    └── CancelButton
```

### State Management

```typescript
interface SettingsState {
  profile: UserProfile;
  diagnoses: Diagnosis[];
  instruments: Instrument[];
  templates: ReportTemplate[];
  styleRules: StyleRuleSet;
  auditTrailVerbosity: 'minimal' | 'full';

  // UI state
  activeTab: string;
  unsavedChanges: boolean;

  // Actions
  setActiveTab: (tab: string) => void;
  updateProfile: (updates: Partial<UserProfile>) => void;
  addDiagnosis: (diagnosis: Diagnosis) => void;
  removeDiagnosis: (diagnosisId: string) => void;
  mapInstruments: (diagnosisId: string, instruments: string[]) => void;
  addInstrument: (instrument: Instrument) => void;
  removeInstrument: (instrumentId: string) => void;
  addTemplate: (template: ReportTemplate) => void;
  updateTemplate: (templateId: string, updates: Partial<ReportTemplate>) => void;
  removeTemplate: (templateId: string) => void;
  updateStyleRules: (rules: StyleRuleSet) => void;
  setAuditTrailVerbosity: (level: string) => void;
  saveAll: () => Promise<void>;
  cancel: () => void;
}

const useSettingsStore = create<SettingsState>((set) => ({
  // ...
}));
```

### Key IPC Channels Used

| Channel | Purpose | Direction |
|---------|---------|-----------|
| `settings:get-all` | Load all settings | Renderer → Main |
| `settings:update-profile` | Save profile changes | Renderer → Main |
| `settings:add-diagnosis` | Add new diagnosis | Renderer → Main |
| `settings:update-instruments` | Update instrument list | Renderer → Main |
| `settings:update-templates` | Save report templates | Renderer → Main |
| `settings:update-style-rules` | Save style guide | Renderer → Main |
| `audit:log-action` | Log settings change | Renderer → Main |

---

## Screen 9: Psychometrist View (Restricted)

### Purpose
Restricted dashboard for psychometrists. Limited to entering test scores, uploading score reports, and entering administration notes. No access to diagnostic decisions, evidence maps, or report editing.

### Wireframe

```
┌────────────────────────────────────────────────────────────────┐
│ Psygil  Psychometrist Dashboard                Help | User ▼  │
├────────────────────────────────────────────────────────────────┤
│                                                                  │
│ CASES ASSIGNED TO YOU FOR DATA ENTRY:                           │
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Patient-101 | Evaluation: Custody & Abuse                  │ │
│ │ Assigned by: Dr. Jane Smith                                │ │
│ │ Status: Awaiting Test Data Entry                           │ │
│ │ [Enter Test Scores] [Upload Score Report] [Enter Notes]   │ │
│ │                                                             │ │
│ │ Test Scores Entered:                                       │ │
│ │ • WISC-V (Full Scale IQ: 74)                              │ │
│ │ • TOVA (Not yet entered)                                  │ │
│ │                                                             │ │
│ │ [View Uploaded Documents] [Mark Complete]                  │ │
│ │                                                             │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Patient-102 | Evaluation: School Evaluation                │ │
│ │ Assigned by: Dr. Mark Johnson                              │ │
│ │ Status: Test Data Entry In Progress (2 of 4 complete)     │ │
│ │ [Enter Test Scores] [Upload Score Report] [Enter Notes]   │ │
│ │                                                             │ │
│ │ [View Status] [Mark Complete]                              │ │
│ │                                                             │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ─────────────────────────────────────────────────────────────  │
│                                                                  │
│ SCORING INTERFACE (for Patient-101, when "Enter Test Scores"):  │
│                                                                  │
│ ┌─ WISC-V Scoring Form ────────────────────────────────────┐    │
│ │                                                            │    │
│ │ Administration Date: [Date Picker]                        │    │
│ │ Examiner: [Dropdown: Your name (pre-filled)]             │    │
│ │                                                            │    │
│ │ Subtest Scores:                                           │    │
│ │ ┌─────────────────┬─────────┬────────────────────────┐   │    │
│ │ │ Subtest         │ Raw     │ Scaled Score / Percentile│   │    │
│ │ ├─────────────────┼─────────┼────────────────────────┤   │    │
│ │ │ Block Design    │ [____]  │ [__] / [__]%           │   │    │
│ │ │ Similarities    │ [____]  │ [__] / [__]%           │   │    │
│ │ │ Digit Span      │ [____]  │ [__] / [__]%           │   │    │
│ │ │ ...             │ ...     │ ...                    │   │    │
│ │ └─────────────────┴─────────┴────────────────────────┘   │    │
│ │                                                            │    │
│ │ Composite Scores:                                          │    │
│ │ Verbal Comprehension: [___] (Percentile: [__] %)         │    │
│ │ Visual-Spatial: [___] (Percentile: [__] %)               │    │
│ │ Fluid Reasoning: [___] (Percentile: [__] %)              │    │
│ │ Working Memory: [___] (Percentile: [__] %)               │    │
│ │ Processing Speed: [___] (Percentile: [__] %)             │    │
│ │ Full Scale IQ: [___] (Percentile: [__] %)                │    │
│ │                                                            │    │
│ │ Confidence Interval (95%): [___] - [___]                 │    │
│ │                                                            │    │
│ │ [Validate Scores] [Save & Continue] [Cancel]              │    │
│ │                                                            │    │
│ └────────────────────────────────────────────────────────────┘   │
│                                                                  │
│ ─────────────────────────────────────────────────────────────  │
│                                                                  │
│ UPLOAD SCORE REPORT (e.g., from Q-Global):                      │
│                                                                  │
│ [Drag & Drop PDF or XLSX here]                                  │
│ The system will auto-populate test scores where possible.       │
│ [Upload]                                                        │
│                                                                  │
│ ─────────────────────────────────────────────────────────────  │
│                                                                  │
│ ADMINISTRATION NOTES:                                           │
│                                                                  │
│ [Text Area for psychometrist's observations during testing]      │
│ Examples: behaviors noted, testing conditions, etc.             │
│ [Save Notes]                                                    │
│                                                                  │
└────────────────────────────────────────────────────────────────┘
```

### React Component Tree

```typescript
// src/pages/PsychometristDashboardPage.tsx

PsychometristDashboardPage
├── AssignedCasesList
│   └── AssignedCaseCard[]
│       ├── PatientID
│       ├── EvaluationType
│       ├── AssignedBy
│       ├── CompletionStatus
│       │   ├── ProgressBar
│       │   └── EnteredCount / TotalCount
│       ├── ActionButtons
│       │   ├── EnterTestScoresButton
│       │   ├── UploadScoreReportButton
│       │   ├── EnterAdminNotesButton
│       │   └── ViewDocumentsButton (read-only)
│       └── MarkCompleteButton
├── Modal: TestScoringForm (appears on "Enter Test Scores" click)
│   ├── InstrumentSelector
│   │   ├── Label
│   │   └── DropdownSelect
│   │       └── Options: WISC-V, WIAT-III, etc.
│   ├── AdministrationMetadata
│   │   ├── DatePicker
│   │   └── ExaminerDisplay (pre-filled, read-only)
│   ├── ScoringTable
│   │   ├── TableHeader
│   │   ├── SubtestRow[] (raw scores, scaled scores, percentiles)
│   │   └── CompositeRow[] (index scores, confidence intervals)
│   ├── CalculateButton (auto-calculates composites)
│   ├── ValidateButton (checks for errors)
│   └── SaveButton
├── Modal: ScoreReportUpload
│   ├── DropZoneForPDF/XLSX
│   ├── AutoPopulationIndicator
│   └── UploadButton
├── Modal: AdminNotesForm
│   ├── TextAreaInput
│   ├── RichTextToolbar (optional: bold, italic, bullet points)
│   └── SaveButton
└── NotificationToast
    └── "You do not have access to diagnostic decisions or report editing."
```

### State Management

```typescript
interface PsychometristState {
  assignedCases: AssignedCase[];
  currentCase: AssignedCase | null;
  testScores: Map<string, TestScore>; // instrumentId -> scores
  adminNotes: string;

  // Actions
  loadAssignedCases: () => Promise<void>;
  setCaseActive: (caseId: string) => void;
  enterTestScores: (instrumentId: string, scores: TestScore) => void;
  uploadScoreReport: (file: File) => Promise<void>;
  updateAdminNotes: (notes: string) => void;
  markCaseComplete: (caseId: string) => Promise<void>;

  // Permissions enforcement
  canAccessDiagnosticDecisions: () => boolean; // Always false for psychometrist
  canAccessReportEditing: () => boolean; // Always false for psychometrist
}

const usePsychometristStore = create<PsychometristState>((set) => ({
  // ...
}));
```

### Key IPC Channels Used

| Channel | Purpose | Direction |
|---------|---------|-----------|
| `psychometrist:get-assigned-cases` | List cases assigned for data entry | Renderer → Main |
| `psychometrist:enter-test-scores` | Save test scores for an instrument | Renderer → Main |
| `psychometrist:upload-score-report` | Import score report PDF/XLSX | Renderer → Main |
| `psychometrist:update-admin-notes` | Save psychometrist observations | Renderer → Main |
| `psychometrist:mark-case-complete` | Mark case data entry as done | Renderer → Main |
| `audit:log-action` | Log test score entry | Renderer → Main |

### Access Control Enforcement

```typescript
// Role-based access control enforced at multiple levels

function checkPsychometristAccess(route: string, user: User): boolean {
  if (user.role !== 'psychometrist') {
    return true; // Non-psychometrists can access everything
  }

  // Psychometrists can ONLY access:
  const allowedRoutes = [
    '/psychometrist', // Dashboard
    '/case/:caseId/documents', // View documents (read-only)
  ];

  const forbiddenRoutes = [
    '/case/:caseId/gate-2', // Diagnostic decisions
    '/case/:caseId/report', // Report editing
    '/case/:caseId/gate-3', // Final attestation
    '/case/:caseId/evidence-map', // Evidence map
  ];

  if (forbiddenRoutes.some((r) => matchRoute(r, route))) {
    return false; // Deny access
  }

  return true;
}

// Also enforced in:
// 1. IPC message handlers (Main process rejects unauthorized requests)
// 2. API middleware (backend rejects unauthorized queries)
// 3. UI components (conditionally render based on role)
```

---

## Shared Components & Patterns

### Common UI Components Library

```typescript
// src/components/shared/

// Form Components
├── TextInput
├── TextArea
├── Select (Dropdown)
├── MultiSelect (Checkboxes)
├── DatePicker
├── FileInput (hidden)
├── Toggle (On/Off)
└── Checkbox

// Layout Components
├── Card
├── Modal
├── TabNavigation
├── Sidebar
├── Panel
└── Divider

// Status & Feedback
├── Badge (severity levels)
├── ProgressBar
├── LoadingSpinner
├── Toast (notification)
├── Alert (info, warning, error)
└── Tooltip

// Data Display
├── Table
├── List
├── Tree (hierarchical)
└── Timeline

// Specific Components
├── GateStatusBadges
├── CaseCard
├── DiagnosisEvidenceCard
├── DocumentTypeIcon
├── ConfirmationChecklist
└── FlagCard
```

### Toast Notification System

```typescript
// src/components/ToastProvider.tsx

interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number; // ms (0 = persistent)
  action?: {
    label: string;
    onClick: () => void;
  };
}

// Usage
const toast = useToast();
toast.success('Case saved', 'Changes have been saved successfully.');
toast.error('Upload failed', 'Please try again.', {
  action: { label: 'Retry', onClick: retryUpload },
});
```

### Modal Dialog System

```typescript
// src/components/Modal.tsx

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

// Usage
const [isOpen, setIsOpen] = useState(false);
return (
  <>
    <Button onClick={() => setIsOpen(true)}>Open Dialog</Button>
    <Modal
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      title="Confirm Action"
      footer={
        <>
          <Button variant="secondary" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleConfirm}>
            Confirm
          </Button>
        </>
      }
    >
      Are you sure you want to proceed?
    </Modal>
  </>
);
```

### Data Fetching Hook (SWR/React Query)

```typescript
// src/hooks/useCase.ts

export function useCase(caseId: string) {
  const { data: caseData, error, isLoading, mutate } = useSWR(
    caseId ? `/api/case/${caseId}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 60000, // 1 min
    },
  );

  return {
    case: caseData,
    isLoading,
    error,
    refresh: () => mutate(),
  };
}
```

---

## IPC Channel Usage Map

### Summary Table

| Channel | Purpose | Direction | Boundary | Used in Screens |
|---------|---------|-----------|----------|-----------------|
| `case:list` | Fetch cases for dashboard | Renderer → Main | Main ↔ Renderer | Screen 1 |
| `case:details` | Get full case data | Renderer → Main | Main ↔ Renderer | Screen 2 |
| `case:update-metadata` | Update case description | Renderer → Main | Main ↔ Renderer | Screen 2 |
| `case:move` | Move case between columns | Renderer → Main | Main ↔ Renderer | Screen 1 |
| `case:archive` | Archive a case | Renderer → Main | Main ↔ Renderer | Screen 1 |
| `document:upload` | Upload new document | Renderer → Main | Main ↔ Renderer | Screen 3 |
| `document:transcribe` | Request audio transcription | Main → Sidecar | Main ↔ Python | Screen 3 |
| `document:extract-referral` | Parse referral document | Main → Sidecar | Main ↔ Python | Screen 3 |
| `document:import-qglobal` | Import Q-Global PDF | Main → Sidecar | Main ↔ Python | Screen 3 |
| `document:import-pariconnect` | Import PARiConnect PDF | Main → Sidecar | Main ↔ Python | Screen 3 |
| `document:status` | Poll upload/processing status | Renderer → Main | Main ↔ Renderer | Screen 3 |
| `gate1:get-extracted-data` | Retrieve ingested data | Renderer → Main | Main ↔ Renderer | Screen 4 |
| `gate1:update-field` | User edits extracted field | Renderer → Main | Main ↔ Renderer | Screen 4 |
| `gate1:confirm-all` | Submit Gate 1 | Renderer → Main | Main ↔ Renderer | Screen 4 |
| `gate2:get-diagnoses` | Retrieve potential diagnoses | Renderer → Main | Main ↔ Renderer | Screen 5 |
| `gate2:get-evidence` | Get evidence for diagnosis | Renderer → Main | Main ↔ Renderer | Screen 5 |
| `gate2:set-decision` | Save diagnostic decision | Renderer → Main | Main ↔ Renderer | Screen 5 |
| `gate2:confirm-all` | Lock Gate 2, initiate report | Renderer → Main | Main ↔ Renderer | Screen 5 |
| `llm:report-stream` | Streamed report sections | Main → Renderer | Main ↔ Renderer | Screen 6 |
| `llm:complete` | Request LLM completion | Main → LLM Gateway | Main ↔ LLM | Screen 5-6 |
| `llm:cancel-generation` | Cancel in-progress generation | Renderer → Main | Main ↔ Renderer | Screen 6 |
| `onlyoffice:open` | Open document in editor | Renderer → Main | Main ↔ Renderer | Screen 6 |
| `onlyoffice:save` | Save document | Renderer → Main | Main ↔ Renderer | Screen 6 |
| `gate3:finalize` | Lock report, generate hash | Renderer → Main | Main ↔ Renderer | Screen 7 |
| `settings:update-profile` | Save profile changes | Renderer → Main | Main ↔ Renderer | Screen 8 |
| `audit:log-action` | Log any action | Renderer → Main | Main ↔ Renderer | All Screens |
| `pii:detect` | Detect and redact PII | Main → Sidecar | Main ↔ Python | Screen 4, 6 |

---

## Conclusion

This UI specification provides:

1. **ASCII Wireframes** for all 9 major screens showing layout and information hierarchy
2. **React Component Trees** detailing the hierarchical component structure for each screen
3. **State Management Strategies** using Zustand for global state and local useState for UI state
4. **IPC Channel References** mapping each screen to the relevant inter-process communication channels
5. **Design Principles** enforcing clinician agency (no auto-accept recommendations), evidence-based display, and audit trail accountability
6. **Role-Based Access Control** distinguishing between clinicians, psychometrists, legal reviewers, and admins

The specification is designed to support the complete clinical workflow from case intake through report finalization, with robust gate-based progression and comprehensive audit trails.
