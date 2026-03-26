# Task 1.3 — Auth0 PKCE Login (Remy)

## YOUR ROLE
You are Remy, a backend engineer agent. Implement the Auth0 PKCE login flow for Psygil.

## PROJECT LOCATION
`/Users/truckirwin/Desktop/Foundry SMB/Products/Psygil`

## MANDATORY: READ FIRST
Before writing any code, read:
1. `/Users/truckirwin/Desktop/Foundry SMB/Products/Psygil/BUILD_MANIFEST.md`
2. `/Users/truckirwin/Desktop/Foundry SMB/Products/Psygil/docs/engineering/02_ipc_api_contracts.md` — Specifically Boundary 4: Electron Main ↔ Renderer IPC
3. `/Users/truckirwin/Desktop/Foundry SMB/Products/Psygil/docs/engineering/03_agent_prompt_specs.md` — Agent prompts
4. `/Users/truckirwin/Desktop/Foundry SMB/Products/Psygil/docs/engineering/08_ui_design_system.md` — Design system for buttons, input fields, etc.

## DEPENDENCIES
1. Task 1.1 (Electron Scaffold) must be completed.
2. Task 1.5 (contextBridge + Typed IPC Preload) must be completed.

## YOUR TASK: Task 1.3 — Auth0 PKCE login flow

## ACCEPTANCE CRITERIA
- Login/logout functionality works correctly.
- Auth0 tokens (ID, Access, Refresh) are securely stored in Electron's `safeStorage`.
- License check is performed after login and respects `is_active` user status.
- UI reflects login state (e.g., shows user info, enables/disables login button).

## WHAT TO BUILD
In `app/src/main/auth/`:

```
auth/
  index.ts             (Initialize Auth0 SDK, manage session state)
  login.ts             (Handle PKCE flow, redirect callback, token storage)
  logout.ts            (Clear tokens, reset state)
  user.ts              (Expose user status and info via IPC)
  auth0-config.ts      (Auth0 config: domain, client ID, callback URL)
```

## TECHNICAL REQUIREMENTS
- **Auth0 Integration**: Use Auth0's SDK for PKCE flow (`auth0-electron-sample` or similar).
- **PKCE Flow**: Implement Proof Key for Code Exchange for enhanced security.
- **Callback URL**: Use a custom URI scheme (e.g., `psygil://callback`) registered with Electron.
- **Token Storage**: Securely store tokens using Electron's `safeStorage` API.
- **IPC**: Expose `auth.getStatus()`, `auth.login()`, `auth.logout()` functions via contextBridge, returning typed responses.
- **License Check**: Simulate a license check based on user status (e.g., user `is_active` flag from DB).
- **State Management**: Manage login state (logged in/out, user info) in the main process and propagate to renderer via IPC.
- **Environment Variables**: Load Auth0 domain and client ID from environment variables (e.g., `.env` file). **DO NOT hardcode credentials.**

## CONSTRAINTS
- Do NOT implement any database logic here — rely on stubs or mocks if needed for Auth0 state.
- Do NOT implement any UI beyond basic state reflection (e.g., showing logged-in user name).
- All Auth0 configuration must be externalized.
- TypeScript strict mode.

## DONE WHEN
- A successful login redirects back to the app via custom URI scheme.
- User tokens are stored securely.
- UI reflects the logged-in state.
- Logout clears tokens and state.
- All IPC handlers are typed and functional.

## NOTIFY WHEN DONE
When completely finished, run:
`openclaw system event --text "Task 1.3 done: Auth0 PKCE login flow implemented, tokens stored securely, IPC handlers typed" --mode now`
