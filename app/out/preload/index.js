"use strict";
const electron = require("electron");
const CH = {
  CASES_LIST: "cases:list",
  CASES_GET: "cases:get",
  CASES_CREATE: "cases:create",
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
  WS_FILE_CHANGED: "workspace:file-changed",
  API_KEY_STORE: "apiKey:store",
  API_KEY_RETRIEVE: "apiKey:retrieve",
  API_KEY_DELETE: "apiKey:delete",
  API_KEY_HAS: "apiKey:has"
};
const api = {
  platform: process.platform,
  cases: {
    list: (params) => electron.ipcRenderer.invoke(CH.CASES_LIST, params),
    get: (params) => electron.ipcRenderer.invoke(CH.CASES_GET, params),
    create: (params) => electron.ipcRenderer.invoke(CH.CASES_CREATE, params),
    archive: (params) => electron.ipcRenderer.invoke(CH.CASES_ARCHIVE, params)
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
    pickFile: () => electron.ipcRenderer.invoke(CH.DOCS_PICK_FILE)
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
    onFileChanged: (callback) => {
      electron.ipcRenderer.on(CH.WS_FILE_CHANGED, (_event, data) => callback(data));
    },
    offFileChanged: () => {
      electron.ipcRenderer.removeAllListeners(CH.WS_FILE_CHANGED);
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
  }
};
electron.contextBridge.exposeInMainWorld("psygil", api);
