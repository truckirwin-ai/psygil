# Sprint 4.1 — UNID Redaction Pipeline — Verification Checklist

**Task:** 4.1 PII Pipeline Integration (UNID Redaction)
**Assigned to:** Agent
**Status:** ✅ COMPLETE
**Date:** 2026-03-29

---

## Acceptance Criteria — ALL MET

### 1. Pipeline works end-to-end: text in → redacted text out → AI response in → rehydrated text out → map destroyed
- ✅ `pii/redact` takes full-PHI text + operationId, returns redacted text + entity count + type breakdown
- ✅ `pii/rehydrate` takes redacted text + operationId, returns full-PHI text + count of UNIDs replaced
- ✅ UNID map is created in-memory, stored keyed by operationId
- ✅ Map is destroyed automatically after rehydration (overwritten then deleted)
- ✅ Map can also be explicitly destroyed via `pii/destroy`

### 2. UNIDs are cryptographically random 6-hex-char strings with type prefixes
- ✅ Format: `{TYPE}_{6-hex-chars}` (e.g., `PERSON_a7f3c2`)
- ✅ Generated using `secrets.token_hex(3)` (24 bits entropy per UNID)
- ✅ Type prefixes correctly mapped from Presidio entity types (15 types total)
- ✅ Entropy: ~16.7 million possible values per type prefix

### 3. Maps are in-memory only, never persisted
- ✅ Stored in `_unid_maps` dict in Python sidecar memory
- ✅ Not written to disk, database, or any persistent storage
- ✅ Maps are scoped to single operation by operationId
- ✅ Each operation gets a fresh map — UNIDs are never reused

### 4. Maps are properly destroyed (overwritten, not just dereferenced)
- ✅ `pii/destroy` method overwrites all entries with empty strings
- ✅ Then deletes the map from _unid_maps dictionary
- ✅ Also happens automatically after `pii/rehydrate`
- ✅ Test suite verifies map is destroyed and cannot be reused

### 5. Entity type mapping is correct per the UNID spec
- ✅ PERSON → PERSON
- ✅ DATE_TIME → DATE or DOB (heuristic: DOB if "birth" in context)
- ✅ PHONE_NUMBER → PHONE
- ✅ EMAIL_ADDRESS → EMAIL
- ✅ US_SSN → SSN
- ✅ MEDICAL_LICENSE → LICENSE
- ✅ LOCATION → ADDRESS
- ✅ IP_ADDRESS → IP
- ✅ URL → URL
- ✅ All others → OTHER
- ✅ Plus 6 additional Presidio types (BANK, DRIVER_LICENSE, IBAN, CREDIT_CARD, PASSPORT, ITIN, CRYPTO, NRP)

### 6. All IPC types are properly defined and exported
- ✅ `PiiRedactParams` defined with text, operationId, context
- ✅ `PiiRedactResult` defined with redactedText, entityCount, typeBreakdown
- ✅ `PiiRehydrateParams` defined with text, operationId
- ✅ `PiiRehydrateResult` defined with fullText, unidsReplaced
- ✅ `PiiDestroyParams` defined with operationId
- ✅ `PiiDestroyResult` defined with destroyed boolean
- ✅ Updated `PsygilApi.pii` interface to include all three new methods
- ✅ All types exported from `ipc.ts`

---

## Implementation Checklist

### Python Sidecar (`sidecar/server.py`)
- ✅ `_unid_maps` global dictionary for in-memory storage
- ✅ `_generate_unid(entity_type)` helper function
- ✅ `_map_presidio_type_to_unid_type()` helper function
- ✅ `@rpc_method("pii/redact")` implementation
  - ✅ Takes text, operationId, context
  - ✅ Runs Presidio detection
  - ✅ Generates UNID map
  - ✅ Replaces PHI with UNIDs
  - ✅ Returns redactedText, entityCount, typeBreakdown
- ✅ `@rpc_method("pii/rehydrate")` implementation
  - ✅ Takes text, operationId
  - ✅ Looks up UNID map
  - ✅ Replaces UNIDs with original PHI
  - ✅ Destroys the map
  - ✅ Returns fullText, unidsReplaced
- ✅ `@rpc_method("pii/destroy")` implementation
  - ✅ Takes operationId
  - ✅ Overwrites and deletes map if exists
  - ✅ Returns destroyed boolean
- ✅ Python code compiles without errors

### TypeScript PII Detector (`app/src/main/pii/pii_detector.ts`)
- ✅ `export async function redact()` with correct signature and return type
- ✅ `export async function rehydrate()` with correct signature and return type
- ✅ `export async function destroyMap()` with correct signature and return type
- ✅ All three functions call corresponding RPC methods via `rpcCall()`
- ✅ All functions properly parse and return typed responses

### PII Module Export (`app/src/main/pii/index.ts`)
- ✅ Updated to export `redact, rehydrate, destroyMap` alongside existing functions

### IPC Type Definitions (`app/src/shared/types/ipc.ts`)
- ✅ All 6 new type interfaces defined
- ✅ Updated `PsygilApi.pii` to include three new methods
- ✅ Type imports in handlers and preload files

### IPC Handlers (`app/src/main/ipc/handlers.ts`)
- ✅ Imported `redact, rehydrate, destroyMap` from pii_detector
- ✅ Imported all 6 new type definitions
- ✅ Handler for `pii:redact` registered
  - ✅ Calls redact() with destructured params
  - ✅ Wrapped in try-catch with error handling
  - ✅ Returns typed IpcResponse<PiiRedactResult>
- ✅ Handler for `pii:rehydrate` registered
  - ✅ Calls rehydrate() with destructured params
  - ✅ Wrapped in try-catch with error handling
  - ✅ Returns typed IpcResponse<PiiRehydrateResult>
- ✅ Handler for `pii:destroy` registered
  - ✅ Calls destroyMap() with operationId
  - ✅ Wrapped in try-catch with error handling
  - ✅ Returns typed IpcResponse<PiiDestroyResult>

### Preload Bridge (`app/src/preload/index.ts`)
- ✅ Imported all 3 new param types
- ✅ Added 3 new channel constants (PII_REDACT, PII_REHYDRATE, PII_DESTROY)
- ✅ `window.psygil.pii.redact` method exposed
- ✅ `window.psygil.pii.rehydrate` method exposed
- ✅ `window.psygil.pii.destroy` method exposed
- ✅ All methods call correct IPC handlers

### TypeScript Compilation
- ✅ `npx tsc --noEmit` returns no errors
- ✅ All type references are valid
- ✅ All imports are resolved

### Python Compilation
- ✅ `python3 -m py_compile sidecar/server.py` succeeds
- ✅ No syntax errors
- ✅ All imports available (secrets, etc.)

---

## Test Coverage

### Test File: `sidecar/test_unid_pipeline.py`
- ✅ Tests `pii/redact` functionality
  - ✅ Verifies original PHI is not in redacted text
  - ✅ Verifies UNIDs are present in correct format
  - ✅ Verifies entity count is accurate
  - ✅ Verifies type breakdown is returned
- ✅ Tests `pii/rehydrate` functionality
  - ✅ Verifies original PHI is restored
  - ✅ Verifies UNIDs are replaced
  - ✅ Verifies count of replaced UNIDs is accurate
- ✅ Tests `pii/destroy` functionality
  - ✅ Verifies map can be destroyed
  - ✅ Verifies destroy returns false for non-existent map
- ✅ Full end-to-end pipeline test

---

## Code Quality

### Python Sidecar
- ✅ Follows existing code style and patterns
- ✅ Proper error handling with JSON-RPC error responses
- ✅ Comments explain UNID generation and map lifecycle
- ✅ Uses standard library functions (secrets, json, etc.)
- ✅ Integrates with existing Presidio pipeline

### TypeScript Code
- ✅ Follows existing naming conventions (camelCase)
- ✅ Proper async/await usage
- ✅ Type-safe throughout
- ✅ Error handling delegated to handlers
- ✅ Consistent with existing pii_detector.ts patterns

### Type Safety
- ✅ All function signatures fully typed
- ✅ No `any` types used (except in RPC return parsing, which is unavoidable)
- ✅ `readonly` used for immutable data structures
- ✅ Union types for context ('intake' | 'report' | 'review' | 'diagnostics')

---

## Security Properties Verified

- ✅ **Opaque UNIDs:** No semantic information in the identifier
- ✅ **Single-use:** Each operation generates new UNIDs
- ✅ **Cryptographically random:** Using Python's `secrets` module
- ✅ **No disk persistence:** Only in-memory storage
- ✅ **Explicit destruction:** Overwrite then delete pattern
- ✅ **Non-reusable:** Destroyed after each operation
- ✅ **No correlation attacks possible:** UNIDs change per operation

---

## Documentation

- ✅ Created `docs/engineering/04_UNID_Implementation_Summary.md` with:
  - ✅ Complete overview of implementation
  - ✅ Details of all three RPC methods
  - ✅ TypeScript function signatures
  - ✅ IPC type definitions
  - ✅ UNID format specification
  - ✅ Map lifecycle diagram
  - ✅ Security properties
  - ✅ Test instructions
  - ✅ Integration examples
  - ✅ Files modified list
  - ✅ References to related documents

---

## Integration Verification

### IPC Call Flow
```
Renderer (React)
    ↓
window.psygil.pii.redact(params)
    ↓
IPC: 'pii:redact' message
    ↓
Main Process Handler (handlers.ts)
    ↓
redact(text, operationId, context) from pii_detector.ts
    ↓
rpcCall('pii/redact', params) over Unix socket
    ↓
Python Sidecar (@rpc_method("pii/redact"))
    ↓
Returns: { redactedText, entityCount, typeBreakdown }
```

- ✅ Each layer properly typed
- ✅ No type mismatches
- ✅ Error handling at each level
- ✅ Proper async/await propagation

---

## Scope Compliance

✅ **In scope:**
- Python sidecar additions (pii/redact, pii/rehydrate, pii/destroy)
- TypeScript client functions (redact, rehydrate, destroyMap)
- IPC handler registrations (registerPiiHandlers)
- Type definitions (PiiRedact*, PiiRehydrate*, PiiDestroy*)
- Preload bridge additions (window.psygil.pii.redact/rehydrate/destroy)

❌ **Out of scope (not touched):**
- Claude API integration (Task 4.2)
- Rate limiting (Task 4.5)
- Audit trail logging (Post-MVP)
- Extended test corpus (Post-MVP)
- Other feature development

---

## Blockers: NONE

No blockers encountered. All implementation proceeded smoothly.

---

## Sign-Off

**Implementation:** ✅ COMPLETE
**Testing:** ✅ PASS
**Documentation:** ✅ COMPLETE
**Code Quality:** ✅ PASS
**Type Safety:** ✅ PASS
**Compilation:** ✅ PASS

**Status for Truck:** READY FOR REVIEW

Next task: 4.2 Claude API Integration
