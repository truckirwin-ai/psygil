# Integration Guide — Test Results, Document Viewer, Evidence Map Components

**Components Created:** March 29, 2026
**Integration Target:** Case Overview and Tree Navigation

---

## Quick Reference

| Component | File Path | Props | Demo Cases |
|-----------|-----------|-------|-----------|
| TestResultsTab | `components/tabs/TestResultsTab.tsx` | `caseId` | Johnson (0, 1) |
| DocumentViewerTab | `components/tabs/DocumentViewerTab.tsx` | `caseId`, `documentType`, `documentId?` | Johnson (0, 1) |
| EvidenceMapTab | `components/tabs/EvidenceMapTab.tsx` | `caseId` | Johnson (0, 1) |

---

## Basic Import and Usage

### In Your Component:

```tsx
import TestResultsTab from '@/components/tabs/TestResultsTab'
import DocumentViewerTab from '@/components/tabs/DocumentViewerTab'
import EvidenceMapTab from '@/components/tabs/EvidenceMapTab'

// In render/JSX:
<TestResultsTab caseId={caseId} />

<DocumentViewerTab
  caseId={caseId}
  documentType="collateral"
  documentId="court-order"
/>

<EvidenceMapTab caseId={caseId} />
```

---

## Integration Scenario 1: Case Overview Tabs

**Location:** Clinical Overview component

**Current State (Prototype):**
```html
<div class="ov-tabs">
  <div class="ov-tab active">Intake</div>
  <div class="ov-tab">Referral</div>
  <div class="ov-tab">Collateral</div>
  <!-- etc -->
</div>
```

**Target State (Production):**
```tsx
const [activeOverviewTab, setActiveOverviewTab] = useState<string>('intake')

return (
  <div className="ov-wrap">
    <div className="ov-tabs">
      <button
        className={`ov-tab ${activeOverviewTab === 'intake' ? 'active' : ''}`}
        onClick={() => setActiveOverviewTab('intake')}
      >
        Intake
      </button>
      <button
        className={`ov-tab ${activeOverviewTab === 'tests' ? 'active' : ''}`}
        onClick={() => setActiveOverviewTab('tests')}
      >
        Test Results
      </button>
      <button
        className={`ov-tab ${activeOverviewTab === 'evidence' ? 'active' : ''}`}
        onClick={() => setActiveOverviewTab('evidence')}
      >
        Evidence Map
      </button>
    </div>

    {activeOverviewTab === 'tests' && <TestResultsTab caseId={caseId} />}
    {activeOverviewTab === 'evidence' && <EvidenceMapTab caseId={caseId} />}
  </div>
)
```

---

## Integration Scenario 2: Tree Navigation

**Location:** Left column tree nodes in main layout

**Current State (Prototype):**
```javascript
{
  id: 'test-results-summary',
  label: 'Summary',
  icon: '📊',
  contentFn: 'getTestSummary',
  caseId: caseId
}
```

**Target State (Production):**

In your tree building code:

```tsx
function buildTreeForCase(caseId: number, caseData: CaseRow): TreeNode[] {
  const stage = caseData.workflow_current_stage

  const nodes: TreeNode[] = [
    // ... existing nodes ...
    {
      id: `${caseId}-test-results`,
      label: 'Test Results',
      icon: '📊',
      component: <TestResultsTab caseId={caseId} />,
      visible: stage >= 'testing'
    },
    {
      id: `${caseId}-collateral`,
      label: 'Collateral Records',
      icon: '📄',
      component: <DocumentViewerTab caseId={caseId} documentType="collateral" />,
      visible: stage >= 'testing'
    },
    {
      id: `${caseId}-interviews`,
      label: 'Interview Notes',
      icon: '🎙',
      component: <DocumentViewerTab caseId={caseId} documentType="interview" />,
      visible: stage >= 'interview'
    },
    {
      id: `${caseId}-evidence-map`,
      label: 'Evidence Map',
      icon: '🗺',
      component: <EvidenceMapTab caseId={caseId} />,
      visible: stage >= 'interview'
    },
  ]

  return nodes
}
```

---

## Integration Scenario 3: Tab Bar System

**Location:** Center column tab bar

**Current Flow:**
1. User clicks tree node
2. `openTab(tabId, label, contentFn, caseId)` called
3. Tab bar renders new tab
4. Content function generates HTML and renders in pane

**New Flow with Components:**

```tsx
// In your tab management code:

interface TabPane {
  id: string
  label: string
  content?: string  // For HTML content
  component?: React.ReactNode  // For React components
  isWord?: boolean
}

function openTab(id: string, label: string, contentOrComponent: string | React.ReactNode) {
  const newTab: TabPane = {
    id,
    label,
    component: typeof contentOrComponent === 'string'
      ? { __html: contentOrComponent }
      : contentOrComponent
  }
  setTabs([...tabs, newTab])
}

// When rendering tabs:
{activeTab?.component && typeof activeTab.component === 'string' ? (
  <div dangerouslySetInnerHTML={activeTab.component} />
) : (
  activeTab?.component
)}
```

---

## Data Flow: Demo to Production

### Current State (Demo Data Embedded)

```tsx
// Components have hardcoded demo data
const JOHNSON_TESTS: Record<string, InstrumentData> = {
  'mmpi3': { /* hardcoded test results */ }
}
```

### Transition State (Mixed)

Replace hardcoded data with IPC calls:

```tsx
const [testData, setTestData] = useState<InstrumentData | null>(null)
const [loading, setLoading] = useState(false)

useEffect(() => {
  if (!isJohnson) return

  setLoading(true)
  // Call to backend for test results
  // window.psygil.tests.get({ case_id: caseId })
  //   .then(data => setTestData(data))
  //   .finally(() => setLoading(false))
}, [caseId])

if (loading) return <div>Loading...</div>
if (!testData) return <div>No test data available</div>

// Render with real data
```

### Production State (Full IPC Integration)

Define new IPC handlers for test data:

```typescript
// ipc.ts
export interface TestsGetParams {
  readonly case_id: number
}

export interface TestsGetResult {
  readonly instruments: InstrumentData[]
  readonly summary: {
    readonly diagnosis: string
    readonly confidence: number
    readonly lastUpdated: string
  }
}

// In PsygilApi interface:
readonly tests: {
  readonly get: (params: TestsGetParams) => Promise<IpcResponse<TestsGetResult>>
}
```

---

## Styling Integration

### CSS Custom Properties

Components use these variables. Ensure they're defined in your root:

```css
:root {
  --bg: #ffffff;
  --panel: #f3f3f3;
  --border: #e0e0e0;
  --text: #1e1e1e;
  --text-secondary: #666666;
  --accent: #0078d4;
  --highlight: #e8f4fd;
}
```

### Module CSS

All components use CSS Modules (`*.module.css`). No global styles needed.

Import in components:
```tsx
import styles from './TestResultsTab.module.css'
```

Use classes:
```tsx
<div className={styles.testResultsTab}>
  <table className={styles.table}>
```

---

## Props Interface Reference

### TestResultsTab

```tsx
interface TestResultsTabProps {
  caseId: number  // Case database ID
}
```

**Behavior:**
- If `caseId` is 0 or 1 (Johnson): Renders full demo data with all instruments
- Otherwise: Shows placeholder "Test results data not yet available"

**Sub-tabs:**
- Summary (all cases)
- MMPI-3, PAI, WAIS-V, TOMM, SIRS-2 (Johnson only)

### DocumentViewerTab

```tsx
interface DocumentViewerTabProps {
  caseId: number
  documentType: string  // 'collateral' | 'interview' | 'report'
  documentId?: string   // Optional, defaults to first document
}
```

**Behavior:**
- If `caseId` is 0 or 1 (Johnson): Renders demo documents
- Otherwise: Shows placeholder

**Document Types:**
- `'collateral'`: Court orders, medical records, police reports, jail records
- `'interview'`: Clinical interview sessions with notes
- `'report'`: Evaluation reports (not yet implemented)

**Document Selector:**
- Dropdown populated with documents of requested type
- Optional `documentId` sets initial selection

### EvidenceMapTab

```tsx
interface EvidenceMapTabProps {
  caseId: number
}
```

**Behavior:**
- If `caseId` is 0 or 1 (Johnson): Renders evidence convergence tables
- Otherwise: Shows placeholder

**Content:**
- Collapsible diagnosis sections (Primary, Secondary, Ruled Out)
- Evidence tables with: Criterion, Test Instruments, Clinical Interview, Collateral Records
- Coherence summary
- Confidence metrics with progress bars

---

## Error Handling Strategy

### Loading State
```tsx
const [loading, setLoading] = useState(false)

useEffect(() => {
  setLoading(true)
  fetchData()
    .then(setData)
    .catch(error => console.error(error))
    .finally(() => setLoading(false))
}, [caseId])

if (loading) return <Spinner />
if (!data) return <EmptyState />
```

### Empty/Placeholder States

All three components handle missing data gracefully:

- **TestResultsTab:** "Test results data not yet available for this case"
- **DocumentViewerTab:** "No documents available for this case"
- **EvidenceMapTab:** "Evidence map will be generated after initial testing and interviews are complete"

---

## Performance Considerations

### Large Documents
DocumentViewerTab renders full content in a scrollable pane. For very large documents (50K+ text), consider virtualization:

```tsx
import { FixedSizeList } from 'react-window'

// Split document into lines and virtualize
const lines = documentContent.split('\n')
```

### Large Tables
TestResultsTab and EvidenceMapTab render tables. For 100+ rows, consider:
- Server-side filtering
- Pagination
- Virtual scrolling (react-window, react-virtualized)

### Memory
Demo data is ~50KB. In production, load on demand and cache via IndexedDB or localStorage.

---

## Testing Checklist

- [ ] Import components in target location
- [ ] Pass correct `caseId` (should be 0 or 1 for demo)
- [ ] Verify styling in light theme
- [ ] Verify styling in medium theme
- [ ] Verify styling in dark theme
- [ ] Test table scrolling on narrow viewport
- [ ] Test document selector dropdown
- [ ] Test collapsible diagnosis sections
- [ ] Verify no console errors or warnings
- [ ] Check keyboard navigation (tab, enter, arrow keys)
- [ ] Verify responsive behavior at different breakpoints

---

## Troubleshooting

### "Module not found" error
```
Error: Cannot find module './TestResultsTab.module.css'
```
**Fix:** Ensure CSS Module extension is `.module.css` (not just `.css`)

### Styling not applied
**Fix:** Check that CSS custom properties are defined in parent context:
```css
html[data-theme="light"] {
  --bg: #ffffff;
  /* etc */
}
```

### Demo data not showing (non-Johnson cases)
**Expected behavior.** Demo data only renders for `caseId` 0 or 1. Other cases show placeholder text.

### Table columns misaligned
**Fix:** Ensure table has `width: 100%` and consistent column definitions.

### Document content looks broken
**Fix:** Document content uses `pre-wrap` to preserve whitespace. Ensure content is properly escaped.

---

## Migration Path

### Phase 1: Integration (Week 1)
- Import components into case overview
- Connect to tree navigation
- Wire up with demo data

### Phase 2: IPC Binding (Week 2)
- Create IPC handlers for test data retrieval
- Create IPC handlers for document listing
- Replace hardcoded demo data with live queries

### Phase 3: Optimization (Week 3)
- Add caching for frequently accessed documents
- Implement virtualization for large datasets
- Performance profiling and optimization

---

## File Manifest

**Created Files:**
- `app/src/renderer/src/components/tabs/TestResultsTab.tsx` (379 lines)
- `app/src/renderer/src/components/tabs/TestResultsTab.module.css` (72 lines)
- `app/src/renderer/src/components/tabs/DocumentViewerTab.tsx` (372 lines)
- `app/src/renderer/src/components/tabs/DocumentViewerTab.module.css` (64 lines)
- `app/src/renderer/src/components/tabs/EvidenceMapTab.tsx` (255 lines)
- `app/src/renderer/src/components/tabs/EvidenceMapTab.module.css` (126 lines)

**Total:** 6 files, ~1,300 lines of code

---

## Support Reference

Components follow the UI Design Lock v4 specification:
- `docs/engineering/13_UI_Design_Lock_v4.md` — Sections 4.3, 11
- `Psygil_UI_Prototype_v4.html` — Live demo with all styling

For questions about styling or behavior, refer to the prototype as the source of truth.
