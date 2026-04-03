# Psygil UI State Audit — Unsaved Editable State Inventory

**Audit Date:** 2026-04-03
**File Audited:** `/app/src/renderer/src/components/layout/CenterColumn.tsx` (5600+ lines)
**Scope:** All `useState` calls holding user-editable data that is NOT immediately persisted to disk/database

---

## SUMMARY

**Total unsaved state variables:** 12 user-editable items
**Most critical gap:** 3 major note sections (testNotes, refNotes, intNotes) have `onChange` handlers but empty `onBlur={() => {}}` handlers — data is lost on navigation or refresh.
**Severity:** HIGH — Session data, testing notes, and interview notes can be lost.

---

## DETAILED INVENTORY

### 1. Clinical Notes in Intake Section (clinNotes)

| Property | Line | State Variable | Description | Persistence | Issue |
|----------|------|---|---|---|---|
| clinNotes | 1099 | `const [clinNotes, setClinNotes] = useState<Record<string, string>>({})` | Map of clinician notes keyed by section (demographics, education, family, neuro, medical, substance, risk, complaints, mental) | **YES — Has saveNote on blur** | OK ✓ Saves to onboarding:save on blur for each note field |

**How it works:**
- Loads from `onboardingSections` on mount (useEffect at 1103-1111)
- Each textarea has `onBlur={() => saveNote(key)}` which calls IPC `window.psygil.onboarding.save()`
- Maps note keys to onboarding sections via `sectionMap` (1120-1128)
- **Status:** PROPERLY PERSISTED

---

### 2. Referral Notes (refNotes)

| Property | Line | State Variable | Description | Persistence | Issue |
|----------|------|---|---|---|---|
| refNotes | 1577 | `const [refNotes, setRefNotes] = useState<Record<string, string>>({})` | Clinician notes for referral context, evaluation scope, legal history | **NO PERSISTENCE** | **CRITICAL: Empty onBlur handlers** |

**Fields:**
- `refNotes.referral` (1614) — "Referral Context" textarea
- `refNotes.eval` (1648) — "Evaluation Scope" textarea
- `refNotes.legal` (1655) — "Legal History" textarea

**Current state:**
```typescript
onBlur={() => {}}  // Line 1615, 1649, 1656 — EMPTY HANDLERS
```

**Data loss scenario:** User types clinical notes about referral context, navigates away, notes are lost.

**Recommended IPC channel:** `onboarding:save` (reuse the existing pattern) — save to onboarding section 'contact' or a new 'referral_notes' section.

---

### 3. Testing Notes (testNotes)

| Property | Line | State Variable | Description | Persistence | Issue |
|----------|------|---|---|---|---|
| testNotes | 1999 | `const [testNotes, setTestNotes] = useState<Record<string, string>>({})` | Battery selection rationale, validity/effort observations, testing behavioral notes | **NO PERSISTENCE** | **CRITICAL: Empty onBlur handlers** |

**Fields:**
- `testNotes.battery` (2244) — "Battery Selection" textarea (2245, onBlur 2246)
- `testNotes.validity` (2251) — "Validity & Effort" textarea (2252, onBlur 2253)
- `testNotes.observations` (2258) — "Testing Observations" textarea (2259, onBlur 2260)

**Current state:**
```typescript
onBlur={() => {}}  // Line 2246, 2253, 2260 — EMPTY HANDLERS
```

**Data loss scenario:** User documents testing observations during the Testing stage, navigates to another tab, notes are lost on refresh.

**Recommended IPC channel:**
- Option A: Create new `session_notes` table/IPC handler for test session notes
- Option B: Extend `onboarding:save` with a 'testing_notes' section
- Option C: Create a new `testing:saveNotes` channel for test battery metadata

---

### 4. Ordered Test Measures (orderedExtras)

| Property | Line | State Variable | Description | Persistence | Issue |
|----------|------|---|---|---|---|
| orderedExtras | 2000 | `const [orderedExtras, setOrderedExtras] = useState<string[]>([])` | Array of additional test measures ordered beyond the default battery for this eval type | **NO PERSISTENCE** | **CRITICAL: No save on unmount** |

**Current state:**
- Toggleable via checkboxes in dropdown (2107-2126)
- Handler: `handleToggleMeasure` (2053-2057) adds/removes from array
- Displayed as "ADDED" badge on test list (2119, 2159)
- Summary: "Ordered (added)" count displayed (2088, 2143)

**Data loss scenario:** User orders additional tests (e.g., adds CAPS-5 to default battery), navigates away or closes app — ordered extras array is reset to `[]` on next mount.

**Recommended IPC channel:**
- Create new `cases:updateTestBattery` IPC handler
- Or extend `cases:update` to include `ordered_measures: string[]`
- Or create `testing:saveOrderedMeasures` channel
- **Database:** Store in `case_test_battery` table (if doesn't exist, create it) with columns: case_id, measure_code, is_default, is_ordered, added_at

---

### 5. Interview Session Data (sessions)

| Property | Line | State Variable | Description | Persistence | Issue |
|----------|------|---|---|---|---|
| sessions | 2409 | `const [sessions, setSessions] = useState<InterviewSession[]>([])` | Array of interview sessions created during Interview stage with title, timestamps, audio metadata | **PARTIAL — Sessions array structure undefined** | **CRITICAL: No database persistence** |

**Fields in each session:**
- `session.id` (string) — generated as `_nextSessionId++` (2405, 2527, 2553)
- `session.title` (string) — e.g., "Session 1: Clinical Interview"
- Session timestamps (not explicitly stored in code review, likely in-memory)

**Current state:**
- Sessions created via `handleAddSessions` (2520-2547) or `handleAddSession` (2550-2573)
- Auto-selects first session when array changes (2490-2493)
- Displayed in tabs (2895-2910)

**Data loss scenario:** User creates 3 interview sessions with notes, closes app — all sessions are gone.

**Recommended IPC channel:** Create new `interviews:createSession` and `interviews:listSessions` handlers

**Database requirement:**
```sql
CREATE TABLE interview_sessions (
  session_id INTEGER PRIMARY KEY,
  case_id INTEGER,
  title TEXT,
  created_at TIMESTAMP,
  audio_file_path TEXT,
  transcription TEXT,
  FOREIGN KEY(case_id) REFERENCES cases(case_id)
)
```

---

### 6. Interview Session Notes (intNotes)

| Property | Line | State Variable | Description | Persistence | Issue |
|----------|------|---|---|---|---|
| intNotes | 2411 | `const [intNotes, setIntNotes] = useState<Record<string, Record<string, string>>>({})` | Nested map: sessionId → { mse, rapport, observations } — clinician notes per interview session | **NO PERSISTENCE** | **CRITICAL: Empty onBlur handlers** |

**Structure:**
```typescript
{
  "session_1": {
    "mse": "Appearance organized, speech clear...",
    "rapport": "Cooperative and engaged...",
    "observations": "No contradictions noted..."
  },
  "session_2": { ... }
}
```

**Fields per session:**
- `intNotes[sessionId].mse` (3248) — Mental Status Exam (onBlur 3249)
- `intNotes[sessionId].rapport` (3255) — Rapport & Engagement (onBlur 3256)
- `intNotes[sessionId].observations` (3262) — Key Clinical Observations (onBlur 3263)

**Update handler:**
```typescript
const updateSessionNote = useCallback((key: string, value: string) => {
  if (!activeSessionId) return
  setIntNotes((prev) => ({
    ...prev,
    [activeSessionId]: { ...(prev[activeSessionId] ?? {}), [key]: value },
  }))
}, [activeSessionId])  // Line 2498-2504
```

**Current state:**
```typescript
onBlur={() => {}}  // Line 3249, 3256, 3263 — EMPTY HANDLERS
```

**Data loss scenario:** User conducts interview, documents MSE observations in session notes, navigates to another stage, notes are lost.

**Recommended IPC channel:**
- Create `interviews:saveSessionNotes` handler
- Or extend the above `interview_sessions` table to include note columns
- **Database:** Add to interview_sessions table:
  - mental_status_exam TEXT
  - rapport_observations TEXT
  - clinical_observations TEXT

---

### 7. Uploaded Files (uploadedFiles)

| Property | Line | State Variable | Description | Persistence | Issue |
|----------|------|---|---|---|---|
| uploadedFiles | 1998 | `const [uploadedFiles, setUploadedFiles] = useState<string[]>([])` | Array of filenames uploaded during Testing stage via "Upload Score Reports" button | **PARTIAL — Files are saved to disk, but UI array is not** | **MEDIUM: Files exist, but UI loses track** |

**Current state:**
- Files uploaded via `handleUploadTesting` (2035-2050)
- Each file sent to `window.psygil.documents.ingest()` (2042)
- Filename added to state: `setUploadedFiles((prev) => [...prev, ...names])` (2048)
- Display in UI as list (2185-2195)

**Issue:**
- Files ARE persisted to disk via documents:ingest IPC
- But `uploadedFiles` array is in-memory only
- On next mount, array is empty — UI won't show previously uploaded files even though they exist on disk

**Data loss scenario:** User uploads test reports, page refreshes, file list vanishes (though files still exist on disk).

**Recommended fix:**
- Query `documents:list` on mount for case_id with subfolder='Testing'
- Populate `uploadedFiles` from API result
- Or: Accept that files are persisted and the UI list is just a "session convenience" that reloads from disk on mount

**Current status:** PARTIALLY OK but needs UI reload fix

---

### 8-12. UI Toggle States (Non-Editable Data)

These are NOT user-editable data and are intentionally transient:

| Line | State | Purpose | Persistence |
|------|-------|---------|---|
| 565 | `hovered`, `closeHovered` | Tab hover effect | Transient ✓ |
| 668 | `loading` | Data fetch spinner | Transient ✓ |
| 919 | `hover` | Button hover | Transient ✓ |
| 1704 | `loading` | Document list fetch | Transient ✓ |
| 2001 | `showOrderDropdown` | Dropdown visibility | Transient ✓ |
| 2412 | `showNewSessionInput` | Add session input visibility | Transient ✓ |
| 2413 | `newSessionTitle` | Input buffer for new session | Transient (acceptable) |
| 2417-2422 | Audio settings (device, gain, system audio) | Audio recorder settings | Transient (ephemeral, UI-only) |
| 2814 | `tick` | Animation frame counter | Transient ✓ |
| 3992-3999 | Attestation/form review checkboxes | Form submission state | Transient (OK for modal) |
| 4224 | `formSeeded` | Form population flag | Transient ✓ |
| 4950-4951 | Export/template loading spinners | Async operation state | Transient ✓ |
| 5371-5375 | Document view loading/phi count | Document viewer state | Transient ✓ |
| 5629 | `hovered` | Document hover effect | Transient ✓ |

---

## CRITICAL FINDINGS

### 🔴 RED — Unsaved Data That WILL Be Lost

1. **refNotes** (1577) — Referral context, evaluation scope, legal notes — EMPTY onBlur handlers
2. **testNotes** (1999) — Battery selection rationale, validity observations, testing notes — EMPTY onBlur handlers
3. **intNotes** (2411) — Interview session MSE, rapport, observations — EMPTY onBlur handlers
4. **sessions** (2409) — Entire interview session array — NO DATABASE BACKING
5. **orderedExtras** (2000) — Additional ordered test measures — NO PERSISTENCE

### 🟡 YELLOW — Partially Lost or Session-Only

6. **uploadedFiles** (1998) — Files persist to disk, but UI state array doesn't reload on mount

---

## RECOMMENDED SAVE MECHANISMS

### Option 1: Extend Onboarding (Quickest)
Treat all unsaved notes as additional onboarding sections:

```typescript
// For refNotes → onboarding section 'referral_notes'
// For testNotes → onboarding section 'testing_notes'
// For intNotes → new table interview_session_notes (sessionId, noteKey, noteValue)

// Reuse existing IPC:
await window.psygil.onboarding.save({
  case_id,
  section: 'referral_notes',  // or 'testing_notes'
  data: {
    content: JSON.stringify(refNotes),  // serialize entire map
    clinician_notes: '',
    status: 'draft'
  }
})
```

**Pros:** Reuses existing IPC + database schema
**Cons:** Shoehorns note data into onboarding table; clinician_notes field semantics conflict

---

### Option 2: Create New Session/Notes IPC Handlers (Recommended)

Create three new IPC channels:

1. **`interviews:saveSessionNotes`**
   - Params: `{ caseId, sessionId, noteKey, noteValue }`
   - Saves to new `interview_session_notes` table
   - Reuses `sessions` array on mount by querying `interviews:listSessions`

2. **`testing:saveNotes`**
   - Params: `{ caseId, noteKey, noteValue }` (e.g., battery, validity, observations)
   - Saves to new `testing_notes` table
   - Load on mount via `testing:getNotes`

3. **`testing:updateBattery`**
   - Params: `{ caseId, orderedMeasures: string[] }`
   - Saves to new `case_test_battery` table or `cases.ordered_measures` JSON column
   - Load on mount via `testing:getBattery`

---

### Option 3: Create Unified Notes IPC Handler (Most Flexible)

```typescript
interface SaveNoteParams {
  caseId: number
  scope: 'referral' | 'testing' | 'interview'  // which tab
  sessionId?: string  // required for 'interview' scope
  noteKey: string    // e.g., 'mse', 'battery', 'legal'
  noteValue: string  // textarea value
}

await window.psygil.notes.save(params)
```

Create single `notes` table:
```sql
CREATE TABLE clinical_notes (
  note_id INTEGER PRIMARY KEY,
  case_id INTEGER,
  scope TEXT,        -- 'referral' | 'testing' | 'interview'
  session_id TEXT,   -- NULL for referral/testing
  note_key TEXT,     -- e.g., 'mse', 'battery'
  note_value TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  FOREIGN KEY(case_id) REFERENCES cases(case_id)
)
```

---

## IMPLEMENTATION PRIORITY

**Sprint assignment should follow this order:**

1. **clinNotes** — Already has saveNote pattern, just verify it works end-to-end ✓
2. **refNotes** → Implement onBlur handlers + IPC (copy from clinNotes pattern)
3. **testNotes** → Implement onBlur handlers + IPC (copy from clinNotes pattern)
4. **sessions** → Create interview_sessions table + CRUD IPC
5. **intNotes** → Create interview_session_notes table + CRUD IPC, load sessions on mount
6. **orderedExtras** → Extend cases table or create case_test_battery table + CRUD IPC
7. **uploadedFiles** → Fix mount-time reload from documents:list

---

## CODE LOCATIONS FOR REFERENCE

| State | Definition Line | onBlur Handlers | Load Point | Issue |
|-------|---|---|---|---|
| clinNotes | 1099 | 1229, 1236, 1243, 1355, 1362, 1369, 1435, 1442, 1449 | 1103-1111 (useEffect) | ✓ Works |
| refNotes | 1577 | 1615, 1649, 1656 | None (never loaded) | ❌ Empty handlers |
| testNotes | 1999 | 2246, 2253, 2260 | None (never loaded) | ❌ Empty handlers |
| sessions | 2409 | N/A (array state) | None (never loaded) | ❌ No DB |
| intNotes | 2411 | 3249, 3256, 3263 | None (never loaded) | ❌ Empty handlers |
| orderedExtras | 2000 | N/A (checkbox handler) | None (never loaded) | ❌ No persistence |
| uploadedFiles | 1998 | N/A (file handler) | None (never reloaded) | ⚠️ Partial |

---

## ACCEPTANCE CRITERIA FOR CLOSURE

Each unsaved state item must have:

1. ✓ useEffect on mount that loads data from IPC
2. ✓ onChange handler that updates state
3. ✓ onBlur (or form submit) handler that calls save IPC
4. ✓ Database table/column to persist data
5. ✓ IPC preload channel registered in preload/index.ts
6. ✓ IPC handler in main/ipc/handlers.ts
7. ✓ Type definitions in shared/types/ipc.ts
8. ✓ Audit log entry (via window.psygil.audit.log) when data is saved
