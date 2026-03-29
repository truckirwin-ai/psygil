import { contextBridge, ipcRenderer } from 'electron'
import type {
  PsygilApi,
  WorkspaceFileChangedEvent,
  PiiDetectParams,
  PiiBatchDetectParams,
  PiiRedactParams,
  PiiRehydrateParams,
  PiiDestroyParams,
  IntakeSaveParams,
  IntakeGetParams,
  OnboardingSaveParams,
  OnboardingGetParams,
  IngestFileParams,
  DocumentsGetParams,
  DocumentsListParams,
  DocumentsDeleteParams,
  ApiKeyStoreParams,
  AiCompleteParams,
  AiTestConnectionParams,
} from '../shared/types'

// IPC channel constants — must match main/ipc/handlers.ts
const CH = {
  CASES_LIST: 'cases:list',
  CASES_GET: 'cases:get',
  CASES_CREATE: 'cases:create',
  CASES_ARCHIVE: 'cases:archive',
  INTAKE_SAVE: 'intake:save',
  INTAKE_GET: 'intake:get',
  ONBOARDING_SAVE: 'onboarding:save',
  ONBOARDING_GET: 'onboarding:get',
  DB_HEALTH: 'db:health',
  AUTH_LOGIN: 'auth:login',
  AUTH_GET_STATUS: 'auth:getStatus',
  AUTH_LOGOUT: 'auth:logout',
  CONFIG_GET: 'config:get',
  CONFIG_SET: 'config:set',
  DOCS_INGEST: 'documents:ingest',
  DOCS_LIST: 'documents:list',
  DOCS_GET: 'documents:get',
  DOCS_DELETE: 'documents:delete',
  DOCS_PICK_FILE: 'documents:pickFile',
  PII_REDACT: 'pii:redact',
  PII_REHYDRATE: 'pii:rehydrate',
  PII_DESTROY: 'pii:destroy',
  WS_GET_PATH: 'workspace:getPath',
  WS_SET_PATH: 'workspace:setPath',
  WS_GET_TREE: 'workspace:getTree',
  SEED_DEMO: 'seed:demoCases',
  WS_OPEN_FINDER: 'workspace:openInFinder',
  WS_OPEN_NATIVE: 'workspace:openNative',
  WS_PICK_FOLDER: 'workspace:pickFolder',
  WS_DEFAULT_PATH: 'workspace:getDefaultPath',
  WS_FILE_CHANGED: 'workspace:file-changed',
  API_KEY_STORE: 'apiKey:store',
  API_KEY_RETRIEVE: 'apiKey:retrieve',
  API_KEY_DELETE: 'apiKey:delete',
  API_KEY_HAS: 'apiKey:has',
} as const

// Typed API exposed to the renderer as window.psygil.
// The renderer has NO access to Node.js, ipcRenderer, or require —
// only the methods explicitly listed here.
const api: PsygilApi = {
  platform: process.platform,

  cases: {
    list: (params) => ipcRenderer.invoke(CH.CASES_LIST, params),
    get: (params) => ipcRenderer.invoke(CH.CASES_GET, params),
    create: (params) => ipcRenderer.invoke(CH.CASES_CREATE, params),
    archive: (params) => ipcRenderer.invoke(CH.CASES_ARCHIVE, params)
  },

  intake: {
    save: (params: IntakeSaveParams) => ipcRenderer.invoke(CH.INTAKE_SAVE, params),
    get: (params: IntakeGetParams) => ipcRenderer.invoke(CH.INTAKE_GET, params),
  },

  onboarding: {
    save: (params: OnboardingSaveParams) => ipcRenderer.invoke(CH.ONBOARDING_SAVE, params),
    get: (params: OnboardingGetParams) => ipcRenderer.invoke(CH.ONBOARDING_GET, params),
  },

  db: {
    health: () => ipcRenderer.invoke(CH.DB_HEALTH)
  },

  auth: {
    login: () => ipcRenderer.invoke(CH.AUTH_LOGIN),
    getStatus: () => ipcRenderer.invoke(CH.AUTH_GET_STATUS),
    logout: () => ipcRenderer.invoke(CH.AUTH_LOGOUT)
  },

  config: {
    get: (params) => ipcRenderer.invoke(CH.CONFIG_GET, params),
    set: (params) => ipcRenderer.invoke(CH.CONFIG_SET, params)
  },

  documents: {
    ingest: (params: IngestFileParams) => ipcRenderer.invoke(CH.DOCS_INGEST, params),
    list: (params: DocumentsListParams) => ipcRenderer.invoke(CH.DOCS_LIST, params),
    get: (params: DocumentsGetParams) => ipcRenderer.invoke(CH.DOCS_GET, params),
    delete: (params: DocumentsDeleteParams) => ipcRenderer.invoke(CH.DOCS_DELETE, params),
    pickFile: () => ipcRenderer.invoke(CH.DOCS_PICK_FILE),
  },

  pii: {
    detect: (params: PiiDetectParams) => ipcRenderer.invoke('pii:detect', params),
    batchDetect: (params: PiiBatchDetectParams) => ipcRenderer.invoke('pii:batchDetect', params),
    redact: (params: PiiRedactParams) => ipcRenderer.invoke(CH.PII_REDACT, params),
    rehydrate: (params: PiiRehydrateParams) => ipcRenderer.invoke(CH.PII_REHYDRATE, params),
    destroy: (params: PiiDestroyParams) => ipcRenderer.invoke(CH.PII_DESTROY, params),
  },

  seed: {
    demoCases: () => ipcRenderer.invoke(CH.SEED_DEMO),
  },
  workspace: {
    getPath: () => ipcRenderer.invoke(CH.WS_GET_PATH),
    setPath: (path) => ipcRenderer.invoke(CH.WS_SET_PATH, path),
    getTree: () => ipcRenderer.invoke(CH.WS_GET_TREE),
    openInFinder: (path) => ipcRenderer.invoke(CH.WS_OPEN_FINDER, path),
    openNative: (path) => ipcRenderer.invoke(CH.WS_OPEN_NATIVE, path),
    pickFolder: () => ipcRenderer.invoke(CH.WS_PICK_FOLDER),
    getDefaultPath: () => ipcRenderer.invoke(CH.WS_DEFAULT_PATH),
    onFileChanged: (callback: (event: WorkspaceFileChangedEvent) => void) => {
      ipcRenderer.on(CH.WS_FILE_CHANGED, (_event, data) => callback(data))
    },
    offFileChanged: () => {
      ipcRenderer.removeAllListeners(CH.WS_FILE_CHANGED)
    },
  },

  apiKey: {
    store: (params: ApiKeyStoreParams) => ipcRenderer.invoke(CH.API_KEY_STORE, params),
    retrieve: () => ipcRenderer.invoke(CH.API_KEY_RETRIEVE),
    delete: () => ipcRenderer.invoke(CH.API_KEY_DELETE),
    has: () => ipcRenderer.invoke(CH.API_KEY_HAS),
  },

  ai: {
    complete: (params: AiCompleteParams) => ipcRenderer.invoke('ai:complete', params),
    testConnection: (params?: AiTestConnectionParams) => ipcRenderer.invoke('ai:testConnection', params ?? {}),
  },
}

contextBridge.exposeInMainWorld('psygil', api)
