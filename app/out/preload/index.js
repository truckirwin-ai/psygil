"use strict";
const electron = require("electron");
const CH = {
  CASES_LIST: "cases:list",
  CASES_GET: "cases:get",
  CASES_CREATE: "cases:create",
  CASES_UPDATE: "cases:update",
  CASES_ARCHIVE: "cases:archive",
  INTAKE_SAVE: "intake:save",
  INTAKE_GET: "intake:get",
  ONBOARDING_SAVE: "onboarding:save",
  ONBOARDING_GET: "onboarding:get",
  DB_HEALTH: "db:health",
  AUTH_LOGIN: "auth:login",
  AUTH_GET_STATUS: "auth:getStatus",
  AUTH_LOGOUT: "auth:logout",
  CONFIG_GET: "config:get",
  CONFIG_SET: "config:set",
  DOCS_INGEST: "documents:ingest",
  DOCS_LIST: "documents:list",
  DOCS_GET: "documents:get",
  DOCS_DELETE: "documents:delete",
  DOCS_PICK_FILE: "documents:pickFile",
  DOCS_PICK_FILES: "documents:pickFiles",
  DOCS_PICK_FILES_FROM: "documents:pickFilesFrom",
  DOCS_SYNC_TO_DISK: "documents:syncToDisk",
  DOCS_WRITE_TAB_DOC: "documents:writeTabDoc",
  PII_REDACT: "pii:redact",
  PII_REHYDRATE: "pii:rehydrate",
  PII_DESTROY: "pii:destroy",
  WS_GET_PATH: "workspace:getPath",
  WS_SET_PATH: "workspace:setPath",
  WS_GET_TREE: "workspace:getTree",
  SEED_DEMO: "seed:demoCases",
  WS_OPEN_FINDER: "workspace:openInFinder",
  WS_OPEN_NATIVE: "workspace:openNative",
  WS_PICK_FOLDER: "workspace:pickFolder",
  WS_DEFAULT_PATH: "workspace:getDefaultPath",
  WS_GET_MALFORMED: "workspace:getMalformed",
  WS_SCAFFOLD: "workspace:scaffold",
  WS_FILE_CHANGED: "workspace:file-changed",
  API_KEY_STORE: "apiKey:store",
  API_KEY_RETRIEVE: "apiKey:retrieve",
  API_KEY_DELETE: "apiKey:delete",
  API_KEY_HAS: "apiKey:has",
  DATA_CONFIRMATION_SAVE: "data-confirmation:save",
  DATA_CONFIRMATION_GET: "data-confirmation:get"
};
const api = {
  platform: process.platform,
  cases: {
    list: (params) => electron.ipcRenderer.invoke(CH.CASES_LIST, params),
    get: (params) => electron.ipcRenderer.invoke(CH.CASES_GET, params),
    create: (params) => electron.ipcRenderer.invoke(CH.CASES_CREATE, params),
    update: (params) => electron.ipcRenderer.invoke(CH.CASES_UPDATE, params),
    archive: (params) => electron.ipcRenderer.invoke(CH.CASES_ARCHIVE, params),
    onChanged: (callback) => {
      const wrapped = (_event, data) => {
        callback(data);
      };
      electron.ipcRenderer.on("cases:changed", wrapped);
      return wrapped;
    },
    offChanged: (wrapped) => {
      if (wrapped) {
        electron.ipcRenderer.removeListener("cases:changed", wrapped);
      } else {
        electron.ipcRenderer.removeAllListeners("cases:changed");
      }
    }
  },
  intake: {
    save: (params) => electron.ipcRenderer.invoke(CH.INTAKE_SAVE, params),
    get: (params) => electron.ipcRenderer.invoke(CH.INTAKE_GET, params)
  },
  onboarding: {
    save: (params) => electron.ipcRenderer.invoke(CH.ONBOARDING_SAVE, params),
    get: (params) => electron.ipcRenderer.invoke(CH.ONBOARDING_GET, params)
  },
  db: {
    health: () => electron.ipcRenderer.invoke(CH.DB_HEALTH)
  },
  auth: {
    login: () => electron.ipcRenderer.invoke(CH.AUTH_LOGIN),
    getStatus: () => electron.ipcRenderer.invoke(CH.AUTH_GET_STATUS),
    logout: () => electron.ipcRenderer.invoke(CH.AUTH_LOGOUT)
  },
  config: {
    get: (params) => electron.ipcRenderer.invoke(CH.CONFIG_GET, params),
    set: (params) => electron.ipcRenderer.invoke(CH.CONFIG_SET, params)
  },
  documents: {
    ingest: (params) => electron.ipcRenderer.invoke(CH.DOCS_INGEST, params),
    list: (params) => electron.ipcRenderer.invoke(CH.DOCS_LIST, params),
    get: (params) => electron.ipcRenderer.invoke(CH.DOCS_GET, params),
    delete: (params) => electron.ipcRenderer.invoke(CH.DOCS_DELETE, params),
    pickFile: () => electron.ipcRenderer.invoke(CH.DOCS_PICK_FILE),
    pickFiles: () => electron.ipcRenderer.invoke(CH.DOCS_PICK_FILES),
    pickFilesFrom: (params) => electron.ipcRenderer.invoke(CH.DOCS_PICK_FILES_FROM, params),
    getDroppedFilePath: (file) => electron.webUtils.getPathForFile(file),
    syncToDisk: (params) => electron.ipcRenderer.invoke(CH.DOCS_SYNC_TO_DISK, params),
    writeTabDoc: (params) => electron.ipcRenderer.invoke(CH.DOCS_WRITE_TAB_DOC, params)
  },
  pii: {
    detect: (params) => electron.ipcRenderer.invoke("pii:detect", params),
    batchDetect: (params) => electron.ipcRenderer.invoke("pii:batchDetect", params),
    redact: (params) => electron.ipcRenderer.invoke(CH.PII_REDACT, params),
    rehydrate: (params) => electron.ipcRenderer.invoke(CH.PII_REHYDRATE, params),
    destroy: (params) => electron.ipcRenderer.invoke(CH.PII_DESTROY, params)
  },
  seed: {
    demoCases: () => electron.ipcRenderer.invoke(CH.SEED_DEMO)
  },
  workspace: {
    getPath: () => electron.ipcRenderer.invoke(CH.WS_GET_PATH),
    setPath: (path) => electron.ipcRenderer.invoke(CH.WS_SET_PATH, path),
    getTree: () => electron.ipcRenderer.invoke(CH.WS_GET_TREE),
    openInFinder: (path) => electron.ipcRenderer.invoke(CH.WS_OPEN_FINDER, path),
    openNative: (path) => electron.ipcRenderer.invoke(CH.WS_OPEN_NATIVE, path),
    pickFolder: () => electron.ipcRenderer.invoke(CH.WS_PICK_FOLDER),
    getDefaultPath: () => electron.ipcRenderer.invoke(CH.WS_DEFAULT_PATH),
    getMalformed: () => electron.ipcRenderer.invoke(CH.WS_GET_MALFORMED),
    scaffold: (folderPath) => electron.ipcRenderer.invoke(CH.WS_SCAFFOLD, folderPath),
    onFileChanged: (callback) => {
      const wrapped = (_event, data) => {
        callback(data);
      };
      electron.ipcRenderer.on(CH.WS_FILE_CHANGED, wrapped);
      return wrapped;
    },
    offFileChanged: (wrapped) => {
      if (wrapped) {
        electron.ipcRenderer.removeListener(CH.WS_FILE_CHANGED, wrapped);
      } else {
        electron.ipcRenderer.removeAllListeners(CH.WS_FILE_CHANGED);
      }
    }
  },
  apiKey: {
    store: (params) => electron.ipcRenderer.invoke(CH.API_KEY_STORE, params),
    retrieve: () => electron.ipcRenderer.invoke(CH.API_KEY_RETRIEVE),
    delete: () => electron.ipcRenderer.invoke(CH.API_KEY_DELETE),
    has: () => electron.ipcRenderer.invoke(CH.API_KEY_HAS)
  },
  ai: {
    complete: (params) => electron.ipcRenderer.invoke("ai:complete", params),
    testConnection: (params) => electron.ipcRenderer.invoke("ai:testConnection", params ?? {})
  },
  agent: {
    run: (params) => electron.ipcRenderer.invoke("agent:run", params),
    status: (operationId) => electron.ipcRenderer.invoke("agent:status", operationId)
  },
  ingestor: {
    run: (params) => electron.ipcRenderer.invoke("ingestor:run", params),
    getResult: (params) => electron.ipcRenderer.invoke("ingestor:getResult", params)
  },
  diagnostician: {
    run: (params) => electron.ipcRenderer.invoke("diagnostician:run", params),
    getResult: (params) => electron.ipcRenderer.invoke("diagnostician:getResult", params)
  },
  writer: {
    run: (params) => electron.ipcRenderer.invoke("writer:run", params),
    getResult: (params) => electron.ipcRenderer.invoke("writer:getResult", params)
  },
  editor: {
    run: (params) => electron.ipcRenderer.invoke("editor:run", params),
    getResult: (params) => electron.ipcRenderer.invoke("editor:getResult", params)
  },
  pipeline: {
    check: (params) => electron.ipcRenderer.invoke("pipeline:check", params),
    advance: (params) => electron.ipcRenderer.invoke("pipeline:advance", params),
    setStage: (params) => electron.ipcRenderer.invoke("pipeline:set-stage", params),
    conditions: (params) => electron.ipcRenderer.invoke("pipeline:conditions", params)
  },
  diagnosticDecisions: {
    save: (params) => electron.ipcRenderer.invoke("diagnosticDecision:save", params),
    list: (params) => electron.ipcRenderer.invoke("diagnosticDecision:list", params),
    delete: (params) => electron.ipcRenderer.invoke("diagnosticDecision:delete", params)
  },
  testScores: {
    save: (params) => electron.ipcRenderer.invoke("testScores:save", params),
    list: (params) => electron.ipcRenderer.invoke("testScores:list", params),
    delete: (params) => electron.ipcRenderer.invoke("testScores:delete", params)
  },
  clinicalFormulation: {
    save: (params) => electron.ipcRenderer.invoke("clinicalFormulation:save", params),
    get: (params) => electron.ipcRenderer.invoke("clinicalFormulation:get", params)
  },
  dataConfirmation: {
    save: (args) => electron.ipcRenderer.invoke(CH.DATA_CONFIRMATION_SAVE, args),
    get: (args) => electron.ipcRenderer.invoke(CH.DATA_CONFIRMATION_GET, args)
  },
  onlyoffice: {
    start: () => electron.ipcRenderer.invoke("onlyoffice:start"),
    stop: () => electron.ipcRenderer.invoke("onlyoffice:stop"),
    status: () => electron.ipcRenderer.invoke("onlyoffice:status"),
    getUrl: () => electron.ipcRenderer.invoke("onlyoffice:getUrl"),
    generateToken: (args) => electron.ipcRenderer.invoke("onlyoffice:generateToken", args),
    generateDocx: (args) => electron.ipcRenderer.invoke("onlyoffice:generateDocx", args),
    openDocument: (args) => electron.ipcRenderer.invoke("onlyoffice:openDocument", args)
  },
  updater: {
    check: () => electron.ipcRenderer.invoke("updater:check"),
    download: (args) => electron.ipcRenderer.invoke("updater:download", args),
    getVersion: () => electron.ipcRenderer.invoke("updater:getVersion")
  },
  report: {
    getStatus: (args) => electron.ipcRenderer.invoke("report:getStatus", args),
    submitAttestation: (args) => electron.ipcRenderer.invoke("report:submitAttestation", args),
    verifyIntegrity: (args) => electron.ipcRenderer.invoke("report:verifyIntegrity", args),
    exportAndOpen: (args) => electron.ipcRenderer.invoke("report:exportAndOpen", args),
    loadTemplate: () => electron.ipcRenderer.invoke("report:loadTemplate")
  },
  templates: {
    analyze: (args) => electron.ipcRenderer.invoke("templates:analyze", args),
    save: (args) => electron.ipcRenderer.invoke("templates:save", args),
    list: (args) => electron.ipcRenderer.invoke("templates:list", args),
    get: (args) => electron.ipcRenderer.invoke("templates:get", args),
    delete: (args) => electron.ipcRenderer.invoke("templates:delete", args),
    open: (args) => electron.ipcRenderer.invoke("templates:open", args),
    setLastUsed: (args) => electron.ipcRenderer.invoke("templates:setLastUsed", args),
    getLastUsed: (args) => electron.ipcRenderer.invoke("templates:getLastUsed", args)
  },
  audit: {
    log: (args) => electron.ipcRenderer.invoke("audit:log", args),
    getTrail: (args) => electron.ipcRenderer.invoke("audit:getTrail", args),
    export: (args) => electron.ipcRenderer.invoke("audit:export", args)
  },
  testimony: {
    prepare: (args) => electron.ipcRenderer.invoke("testimony:prepare", args)
  },
  referral: {
    parseDoc: () => electron.ipcRenderer.invoke("referral:parse-doc")
  },
  resources: {
    upload: (args) => electron.ipcRenderer.invoke("resources:upload", args),
    list: (args) => electron.ipcRenderer.invoke("resources:list", args),
    delete: (args) => electron.ipcRenderer.invoke("resources:delete", args),
    open: (args) => electron.ipcRenderer.invoke("resources:open", args),
    read: (args) => electron.ipcRenderer.invoke("resources:read", args),
    uploadWritingSample: (args) => electron.ipcRenderer.invoke("resources:uploadWritingSample", args),
    previewCleaned: (args) => electron.ipcRenderer.invoke("resources:previewCleaned", args),
    analyzeStyle: (args) => electron.ipcRenderer.invoke("resources:analyzeStyle", args),
    getStyleProfile: () => electron.ipcRenderer.invoke("resources:getStyleProfile"),
    recalculateStyleProfile: () => electron.ipcRenderer.invoke("resources:recalculateStyleProfile")
  },
  whisper: {
    saveAudio: (args) => electron.ipcRenderer.invoke("whisper:saveAudio", args),
    transcribe: (args) => electron.ipcRenderer.invoke("whisper:transcribe", args),
    status: () => electron.ipcRenderer.invoke("whisper:status"),
    // Live streaming
    streamStart: (args) => electron.ipcRenderer.invoke("whisper:stream:start", args),
    streamAudio: (args) => {
      electron.ipcRenderer.send("whisper:stream:audio", args);
    },
    streamStop: (args) => electron.ipcRenderer.invoke("whisper:stream:stop", args),
    onLiveText: (callback) => {
      const wrapped = (_event, data) => {
        callback(data);
      };
      electron.ipcRenderer.on("whisper:liveText", wrapped);
      return () => {
        electron.ipcRenderer.removeListener("whisper:liveText", wrapped);
      };
    }
  },
  diagnosisCatalog: {
    search: (params) => electron.ipcRenderer.invoke("diagnosisCatalog:search", params),
    list: (params) => electron.ipcRenderer.invoke("diagnosisCatalog:list", params)
  },
  testHarness: {
    list: () => electron.ipcRenderer.invoke("testHarness:list"),
    run: (params) => electron.ipcRenderer.invoke("testHarness:run", params),
    runAll: () => electron.ipcRenderer.invoke("testHarness:runAll")
  },
  setup: {
    getConfig: () => electron.ipcRenderer.invoke("setup:getConfig"),
    reset: () => electron.ipcRenderer.invoke("setup:reset"),
    advance: (params) => electron.ipcRenderer.invoke("setup:advance", params),
    validateLicense: (params) => electron.ipcRenderer.invoke("setup:validateLicense", params),
    saveLicense: (params) => electron.ipcRenderer.invoke("setup:saveLicense", params),
    validateStoragePath: (params) => electron.ipcRenderer.invoke("setup:validateStoragePath", params),
    pickStorageFolder: () => electron.ipcRenderer.invoke("setup:pickStorageFolder"),
    getDefaultStoragePath: () => electron.ipcRenderer.invoke("setup:getDefaultStoragePath"),
    provisionStorage: (params) => electron.ipcRenderer.invoke("setup:provisionStorage", params),
    savePractice: (params) => electron.ipcRenderer.invoke("setup:savePractice", params),
    saveAi: (params) => electron.ipcRenderer.invoke("setup:saveAi", params),
    saveAppearance: (params) => electron.ipcRenderer.invoke("setup:saveAppearance", params),
    saveClinical: (params) => electron.ipcRenderer.invoke("setup:saveClinical", params),
    provisionTemplates: (params) => electron.ipcRenderer.invoke("setup:provisionTemplates", params),
    getSupportedEvalTypes: () => electron.ipcRenderer.invoke("setup:getSupportedEvalTypes"),
    complete: () => electron.ipcRenderer.invoke("setup:complete")
  }
};
electron.contextBridge.exposeInMainWorld("psygil", api);
