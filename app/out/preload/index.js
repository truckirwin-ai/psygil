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
  WS_GET_PATH: "workspace:getPath",
  WS_SET_PATH: "workspace:setPath",
  WS_GET_TREE: "workspace:getTree",
  WS_OPEN_FINDER: "workspace:openInFinder",
  WS_PICK_FOLDER: "workspace:pickFolder",
  WS_DEFAULT_PATH: "workspace:getDefaultPath",
  WS_FILE_CHANGED: "workspace:file-changed"
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
  pii: {
    detect: (params) => electron.ipcRenderer.invoke("pii:detect", params),
    batchDetect: (params) => electron.ipcRenderer.invoke("pii:batchDetect", params)
  },
  workspace: {
    getPath: () => electron.ipcRenderer.invoke(CH.WS_GET_PATH),
    setPath: (path) => electron.ipcRenderer.invoke(CH.WS_SET_PATH, path),
    getTree: () => electron.ipcRenderer.invoke(CH.WS_GET_TREE),
    openInFinder: (path) => electron.ipcRenderer.invoke(CH.WS_OPEN_FINDER, path),
    pickFolder: () => electron.ipcRenderer.invoke(CH.WS_PICK_FOLDER),
    getDefaultPath: () => electron.ipcRenderer.invoke(CH.WS_DEFAULT_PATH),
    onFileChanged: (callback) => {
      electron.ipcRenderer.on(CH.WS_FILE_CHANGED, (_event, data) => callback(data));
    },
    offFileChanged: () => {
      electron.ipcRenderer.removeAllListeners(CH.WS_FILE_CHANGED);
    }
  }
};
electron.contextBridge.exposeInMainWorld("psygil", api);
