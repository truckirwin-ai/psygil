# Task 1.1 — Electron Scaffold (Apex)

## YOUR ROLE
You are Apex, a systems architect agent. Build the Electron application scaffold for Psygil.

## PROJECT LOCATION
`/Users/truckirwin/Desktop/Foundry SMB/Products/Psygil`

## MANDATORY: READ FIRST
Before writing any code, read:
1. `/Users/truckirwin/Desktop/Foundry SMB/Products/Psygil/BUILD_MANIFEST.md` — execution rules and constraints
2. `/Users/truckirwin/Desktop/Foundry SMB/Products/Psygil/CLAUDE.md` — project context

## YOUR TASK: Task 1.1 — Electron scaffold with Vite bundling

## ACCEPTANCE CRITERIA (from BUILD_MANIFEST.md)
- App launches and shows an empty window
- main/renderer/preload structure is correct
- 4-process architecture slots are present: Main, Renderer, OnlyOffice (placeholder), Python sidecar (placeholder)
- TypeScript throughout

## WHAT TO BUILD
Create a new `app/` directory inside the project root with:

```
app/
  package.json          (Electron + Vite deps, scripts: dev, build, preview)
  tsconfig.json
  electron.vite.config.ts   (or vite.config.ts with electron plugin)
  src/
    main/
      index.ts           (Electron main process — creates BrowserWindow, loads renderer)
    preload/
      index.ts           (preload stub — empty contextBridge for now)
    renderer/
      index.html
      src/
        App.tsx           (empty React component — just renders <div>Psygil loading...</div>)
        main.tsx          (ReactDOM.createRoot)
```

## TECHNICAL REQUIREMENTS
- Use `electron-vite` package (not manual config) — it handles main/preload/renderer bundling correctly
- Electron 33+ 
- Vite 6+
- React 19
- TypeScript strict mode
- Renderer: `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`
- Main window: 1440x900 default size
- No DevTools in production; DevTools open in development

## CONSTRAINTS (non-negotiable)
- Do NOT install SQLCipher, Auth0, or any feature deps — scaffold only
- Do NOT create any UI beyond a loading placeholder
- Do NOT modify anything outside the `app/` directory
- Keep package.json name: `psygil-app`

## DONE WHEN
Running `npm run dev` inside `app/` launches an Electron window showing "Psygil loading..." and no console errors.

## NOTIFY WHEN DONE
When completely finished, run:
`openclaw system event --text "Task 1.1 done: Electron scaffold built, app launches" --mode now`
