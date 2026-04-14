import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type {
  PsygilApi,
  WorkspaceFileChangedEvent,
  PiiDetectParams,
  PiiBatchDetectParams,
  PiiRedactParams,
  PiiRehydrateParams,
  PiiDestroyParams,
  CasesUpdateParams,
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
  AgentRunParams,
  IngestorRunParams,
  IngestorGetResultParams,
  DiagnosticianRunParams,
  DiagnosticianGetResultParams,
  WriterRunParams,
  WriterGetResultParams,
  EditorRunParams,
  EditorGetResultParams,
  PsychometricianRunParams,
  PsychometricianGetResultParams,
  PipelineCheckParams,
  PipelineAdvanceParams,
  PipelineSetStageParams,
  PipelineConditionsParams,
  DiagnosticDecisionSaveParams,
  DiagnosticDecisionListParams,
  DiagnosticDecisionDeleteParams,
  ClinicalFormulationSaveParams,
  ClinicalFormulationGetParams,
  TestScoreSaveParams,
  TestScoreListParams,
  DiagnosisCatalogSearchParams,
  DiagnosisCatalogListParams,
} from '../shared/types'

// IPC channel constants, must match main/ipc/handlers.ts
const CH = {
  CASES_LIST: 'cases:list',
  CASES_GET: 'cases:get',
  CASES_CREATE: 'cases:create',
  CASES_UPDATE: 'cases:update',
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
  DOCS_PICK_FILES: 'documents:pickFiles',
  DOCS_PICK_FILES_FROM: 'documents:pickFilesFrom',
  DOCS_SYNC_TO_DISK: 'documents:syncToDisk',
  DOCS_WRITE_TAB_DOC: 'documents:writeTabDoc',
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
  WS_GET_MALFORMED: 'workspace:getMalformed',
  WS_SCAFFOLD: 'workspace:scaffold',
  WS_FILE_CHANGED: 'workspace:file-changed',
  API_KEY_STORE: 'apiKey:store',
  API_KEY_RETRIEVE: 'apiKey:retrieve',
  API_KEY_DELETE: 'apiKey:delete',
  API_KEY_HAS: 'apiKey:has',
  DATA_CONFIRMATION_SAVE: 'data-confirmation:save',
  DATA_CONFIRMATION_GET: 'data-confirmation:get',
} as const

// Typed API exposed to the renderer as window.psygil.
// The renderer has NO access to Node.js, ipcRenderer, or require, // only the methods explicitly listed here.
const api: PsygilApi = {
  platform: process.platform,

  cases: {
    list: (params) => ipcRenderer.invoke(CH.CASES_LIST, params),
    get: (params) => ipcRenderer.invoke(CH.CASES_GET, params),
    create: (params) => ipcRenderer.invoke(CH.CASES_CREATE, params),
    update: (params: CasesUpdateParams) => ipcRenderer.invoke(CH.CASES_UPDATE, params),
    archive: (params) => ipcRenderer.invoke(CH.CASES_ARCHIVE, params),
    onChanged: (callback: (data: { caseId: number; newStage: string; previousStage: string }) => void) => {
      const wrapped = (_event: Electron.IpcRendererEvent, data: { caseId: number; newStage: string; previousStage: string }): void => { callback(data) }
      ipcRenderer.on('cases:changed', wrapped)
      return wrapped
    },
    offChanged: (wrapped?: (...args: unknown[]) => void) => {
      if (wrapped) {
        ipcRenderer.removeListener('cases:changed', wrapped as never)
      } else {
        ipcRenderer.removeAllListeners('cases:changed')
      }
    },
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
    pickFiles: () => ipcRenderer.invoke(CH.DOCS_PICK_FILES),
    pickFilesFrom: (params: { defaultPath?: string; title?: string; extensions?: string[] }) =>
      ipcRenderer.invoke(CH.DOCS_PICK_FILES_FROM, params),
    getDroppedFilePath: (file: File) => webUtils.getPathForFile(file),
    syncToDisk: (params: { case_id: number }) =>
      ipcRenderer.invoke(CH.DOCS_SYNC_TO_DISK, params),
    writeTabDoc: (params: { case_id: number; tab: 'intake' | 'referral' | 'testing' | 'interview' | 'diagnostics' }) =>
      ipcRenderer.invoke(CH.DOCS_WRITE_TAB_DOC, params),
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
    getMalformed: () => ipcRenderer.invoke(CH.WS_GET_MALFORMED),
    scaffold: (folderPath: string) => ipcRenderer.invoke(CH.WS_SCAFFOLD, folderPath),
    onFileChanged: (callback: (event: WorkspaceFileChangedEvent) => void) => {
      const wrapped = (_event: Electron.IpcRendererEvent, data: WorkspaceFileChangedEvent): void => { callback(data) }
      ipcRenderer.on(CH.WS_FILE_CHANGED, wrapped)
      return wrapped
    },
    offFileChanged: (wrapped?: (...args: unknown[]) => void) => {
      if (wrapped) {
        ipcRenderer.removeListener(CH.WS_FILE_CHANGED, wrapped as never)
      } else {
        ipcRenderer.removeAllListeners(CH.WS_FILE_CHANGED)
      }
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

  agent: {
    run: (params: AgentRunParams) => ipcRenderer.invoke('agent:run', params),
    status: (operationId?: string) => ipcRenderer.invoke('agent:status', operationId),
  },

  ingestor: {
    run: (params: IngestorRunParams) => ipcRenderer.invoke('ingestor:run', params),
    getResult: (params: IngestorGetResultParams) => ipcRenderer.invoke('ingestor:getResult', params),
  },

  diagnostician: {
    run: (params: DiagnosticianRunParams) => ipcRenderer.invoke('diagnostician:run', params),
    getResult: (params: DiagnosticianGetResultParams) => ipcRenderer.invoke('diagnostician:getResult', params),
  },

  writer: {
    run: (params: WriterRunParams) => ipcRenderer.invoke('writer:run', params),
    getResult: (params: WriterGetResultParams) => ipcRenderer.invoke('writer:getResult', params),
  },

  editor: {
    run: (params: EditorRunParams) => ipcRenderer.invoke('editor:run', params),
    getResult: (params: EditorGetResultParams) => ipcRenderer.invoke('editor:getResult', params),
  },

  psychometrician: {
    run: (params: PsychometricianRunParams) => ipcRenderer.invoke('psychometrician:run', params),
    getResult: (params: PsychometricianGetResultParams) => ipcRenderer.invoke('psychometrician:getResult', params),
  },

  pipeline: {
    check: (params: PipelineCheckParams) => ipcRenderer.invoke('pipeline:check', params),
    advance: (params: PipelineAdvanceParams) => ipcRenderer.invoke('pipeline:advance', params),
    setStage: (params: PipelineSetStageParams) => ipcRenderer.invoke('pipeline:set-stage', params),
    conditions: (params: PipelineConditionsParams) => ipcRenderer.invoke('pipeline:conditions', params),
  },

  diagnosticDecisions: {
    save: (params: DiagnosticDecisionSaveParams) => ipcRenderer.invoke('diagnosticDecision:save', params),
    list: (params: DiagnosticDecisionListParams) => ipcRenderer.invoke('diagnosticDecision:list', params),
    delete: (params: DiagnosticDecisionDeleteParams) => ipcRenderer.invoke('diagnosticDecision:delete', params),
  },

  testScores: {
    save: (params: TestScoreSaveParams) => ipcRenderer.invoke('testScores:save', params),
    list: (params: TestScoreListParams) => ipcRenderer.invoke('testScores:list', params),
    delete: (params: { id: number }) => ipcRenderer.invoke('testScores:delete', params),
  },

  clinicalFormulation: {
    save: (params: ClinicalFormulationSaveParams) => ipcRenderer.invoke('clinicalFormulation:save', params),
    get: (params: ClinicalFormulationGetParams) => ipcRenderer.invoke('clinicalFormulation:get', params),
  },

  dataConfirmation: {
    save: (args: { caseId: number; categoryId: string; status: string; notes: string }) => ipcRenderer.invoke(CH.DATA_CONFIRMATION_SAVE, args),
    get: (args: { caseId: number }) => ipcRenderer.invoke(CH.DATA_CONFIRMATION_GET, args),
  },

  branding: {
    get: () => ipcRenderer.invoke('branding:get'),
    save: (branding: unknown) => ipcRenderer.invoke('branding:save', branding),
    saveLogo: () => ipcRenderer.invoke('branding:saveLogo'),
    onChanged: (cb: (b: unknown) => void) => {
      const listener = (_e: unknown, b: unknown): void => cb(b)
      ipcRenderer.on('branding:changed', listener)
      return () => { ipcRenderer.removeListener('branding:changed', listener) }
    },
  },

  onlyoffice: {
    start: () => ipcRenderer.invoke('onlyoffice:start'),
    stop: () => ipcRenderer.invoke('onlyoffice:stop'),
    status: () => ipcRenderer.invoke('onlyoffice:status'),
    getUrl: () => ipcRenderer.invoke('onlyoffice:getUrl'),
    generateToken: (args: { payload: Record<string, unknown> }) => ipcRenderer.invoke('onlyoffice:generateToken', args),
    generateDocx: (args: { caseId: number }) => ipcRenderer.invoke('onlyoffice:generateDocx', args),
    openDocument: (args: { caseId: number; filePath?: string; readOnly?: boolean }) => ipcRenderer.invoke('onlyoffice:openDocument', args),
  },

  updater: {
    check: () => ipcRenderer.invoke('updater:check'),
    download: (args: { version: string }) => ipcRenderer.invoke('updater:download', args),
    getVersion: () => ipcRenderer.invoke('updater:getVersion'),
  },

  report: {
    getStatus: (args: { caseId: number }) => ipcRenderer.invoke('report:getStatus', args),
    submitAttestation: (args: { caseId: number; signedBy: string; attestationStatement: string; signatureDate: string }) => ipcRenderer.invoke('report:submitAttestation', args),
    verifyIntegrity: (args: { caseId: number }) => ipcRenderer.invoke('report:verifyIntegrity', args),
    exportAndOpen: (args: { caseId: number; fullName: string; evalType: string; sections: { title: string; body: string }[] }) => ipcRenderer.invoke('report:exportAndOpen', args),
    loadTemplate: () => ipcRenderer.invoke('report:loadTemplate'),
  },

  templates: {
    analyze: (args) => ipcRenderer.invoke('templates:analyze', args),
    save: (args) => ipcRenderer.invoke('templates:save', args),
    list: (args) => ipcRenderer.invoke('templates:list', args),
    get: (args) => ipcRenderer.invoke('templates:get', args),
    delete: (args) => ipcRenderer.invoke('templates:delete', args),
    open: (args) => ipcRenderer.invoke('templates:open', args),
    setLastUsed: (args) => ipcRenderer.invoke('templates:setLastUsed', args),
    getLastUsed: (args) => ipcRenderer.invoke('templates:getLastUsed', args),
  },

  audit: {
    log: (args: { caseId: number; actionType: string; actorType: 'clinician' | 'ai_agent' | 'system'; actorId?: string; details: Record<string, unknown>; relatedEntityType?: string; relatedEntityId?: number }) => ipcRenderer.invoke('audit:log', args),
    getTrail: (args: { caseId: number }) => ipcRenderer.invoke('audit:getTrail', args),
    export: (args: { caseId: number; format?: 'csv' | 'json' }) => ipcRenderer.invoke('audit:export', args),
  },

  testimony: {
    prepare: (args: { caseId: number }) => ipcRenderer.invoke('testimony:prepare', args),
  },

  referral: {
    parseDoc: () => ipcRenderer.invoke('referral:parse-doc'),
  },

  resources: {
    upload: (args: { category: string; filePaths?: string[] }) => ipcRenderer.invoke('resources:upload', args),
    list: (args: { category?: string }) => ipcRenderer.invoke('resources:list', args),
    delete: (args: { id: string; storedPath: string }) => ipcRenderer.invoke('resources:delete', args),
    open: (args: { storedPath: string }) => ipcRenderer.invoke('resources:open', args),
    read: (args: { storedPath: string }) => ipcRenderer.invoke('resources:read', args),
    uploadWritingSample: (args: { filePaths?: string[] }) => ipcRenderer.invoke('resources:uploadWritingSample', args),
    previewCleaned: (args: { storedPath: string }) => ipcRenderer.invoke('resources:previewCleaned', args),
    analyzeStyle: (args: { storedPaths: string[] }) => ipcRenderer.invoke('resources:analyzeStyle', args),
    getStyleProfile: () => ipcRenderer.invoke('resources:getStyleProfile'),
    recalculateStyleProfile: () => ipcRenderer.invoke('resources:recalculateStyleProfile'),
  },

  whisper: {
    saveAudio: (args: { caseId: number; audioBase64: string; filename: string; mimeType: string }) =>
      ipcRenderer.invoke('whisper:saveAudio', args),
    transcribe: (args: { filePath: string; language?: string }) =>
      ipcRenderer.invoke('whisper:transcribe', args),
    status: () => ipcRenderer.invoke('whisper:status'),
    // Live streaming
    streamStart: (args: { sessionId: string }) =>
      ipcRenderer.invoke('whisper:stream:start', args),
    streamAudio: (args: { sessionId: string; audioBase64: string }) => {
      ipcRenderer.send('whisper:stream:audio', args)
    },
    streamStop: (args: { sessionId: string }) =>
      ipcRenderer.invoke('whisper:stream:stop', args),
    onLiveText: (callback: (data: { sessionId: string; text: string; type: 'partial' | 'final' | 'error' }) => void) => {
      const wrapped = (_event: Electron.IpcRendererEvent, data: any): void => { callback(data) }
      ipcRenderer.on('whisper:liveText', wrapped)
      return () => { ipcRenderer.removeListener('whisper:liveText', wrapped) }
    },
  },

  diagnosisCatalog: {
    search: (params: DiagnosisCatalogSearchParams) => ipcRenderer.invoke('diagnosisCatalog:search', params),
    list: (params?: DiagnosisCatalogListParams) => ipcRenderer.invoke('diagnosisCatalog:list', params),
  },

  testHarness: {
    list: () => ipcRenderer.invoke('testHarness:list'),
    run: (params: { manifestId: string }) => ipcRenderer.invoke('testHarness:run', params),
    runAll: () => ipcRenderer.invoke('testHarness:runAll'),
  },

  setup: {
    getConfig: () => ipcRenderer.invoke('setup:getConfig'),
    reset: () => ipcRenderer.invoke('setup:reset'),
    advance: (params) => ipcRenderer.invoke('setup:advance', params),
    validateLicense: (params) => ipcRenderer.invoke('setup:validateLicense', params),
    saveLicense: (params) => ipcRenderer.invoke('setup:saveLicense', params),
    validateStoragePath: (params) => ipcRenderer.invoke('setup:validateStoragePath', params),
    pickStorageFolder: () => ipcRenderer.invoke('setup:pickStorageFolder'),
    getDefaultStoragePath: () => ipcRenderer.invoke('setup:getDefaultStoragePath'),
    provisionStorage: (params) => ipcRenderer.invoke('setup:provisionStorage', params),
    savePractice: (params) => ipcRenderer.invoke('setup:savePractice', params),
    saveAi: (params) => ipcRenderer.invoke('setup:saveAi', params),
    saveAppearance: (params) => ipcRenderer.invoke('setup:saveAppearance', params),
    saveClinical: (params) => ipcRenderer.invoke('setup:saveClinical', params),
    provisionTemplates: (params) => ipcRenderer.invoke('setup:provisionTemplates', params),
    getSupportedEvalTypes: () => ipcRenderer.invoke('setup:getSupportedEvalTypes'),
    complete: () => ipcRenderer.invoke('setup:complete'),
  },
}

contextBridge.exposeInMainWorld('psygil', api)
