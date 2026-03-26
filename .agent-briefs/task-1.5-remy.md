# Task 1.5 — contextBridge + Typed IPC Preload (Remy)

## YOUR ROLE
You are Remy, a backend engineer agent. Build the typed IPC preload layer for Psygil.

## PROJECT LOCATION
`/Users/truckirwin/Desktop/Foundry SMB/Products/Psygil`

## MANDATORY: READ FIRST
Before writing any code, read:
1. `/Users/truckirwin/Desktop/Foundry SMB/Products/Psygil/BUILD_MANIFEST.md`
2. `/Users/truckirwin/Desktop/Foundry SMB/Products/Psygil/docs/engineering/02_ipc_api_contracts.md` — ALL IPC contracts
3. `/Users/truckirwin/Desktop/Foundry SMB/Products/Psygil/docs/engineering/02a_ipc_addendum_storage_provider.md`

## DEPENDENCY
Task 1.1 (scaffold) must be done first.

## YOUR TASK: Task 1.5 — contextBridge + typed IPC preload

## ACCEPTANCE CRITERIA
- All MVP IPC endpoints typed (see IPC contract doc Boundary 4)
- Renderer cannot access Node.js — contextIsolation enforced
- TypeScript types shared between main and renderer via a shared types package
- contextBridge exposes typed `window.psygil` API object

## WHAT TO BUILD

```
app/src/
  shared/
    types/
      ipc.ts        (all IPC request/response types — shared between main and renderer)
      index.ts      (re-exports)
  preload/
    index.ts        (contextBridge.exposeInMainWorld('psygil', { ...typed API }))
  main/
    ipc/
      handlers.ts   (ipcMain.handle() stubs for all MVP endpoints — return mock data for now)
      index.ts      (register all handlers)
```

## IPC ENDPOINTS TO TYPE (from Boundary 4 of contract doc)
At minimum, type and stub these endpoint groups:
- `cases.*` — list, get, create, update, archive
- `db.*` — health check
- `auth.*` — getStatus, logout
- `config.*` — get, set

Each endpoint: typed request params + typed response. Return `{ ok: true, data: null }` stubs in handlers for now.

## SECURITY REQUIREMENTS (non-negotiable)
- `nodeIntegration: false` in BrowserWindow
- `contextIsolation: true` in BrowserWindow  
- `sandbox: true` in BrowserWindow
- Renderer accesses ONLY what's explicitly exposed via contextBridge
- No `require` or Node APIs accessible in renderer

## CONSTRAINTS
- Stub handlers only — no real DB calls yet (that wires up in Sprint 3)
- Do NOT touch renderer UI components
- TypeScript strict mode throughout

## DONE WHEN
`window.psygil` is available in renderer DevTools. Calling `window.psygil.db.health()` returns a stub response. TypeScript compiler reports zero errors.

## NOTIFY WHEN DONE
When completely finished, run:
`openclaw system event --text "Task 1.5 done: contextBridge typed IPC, all MVP endpoints stubbed, renderer sandboxed" --mode now`
