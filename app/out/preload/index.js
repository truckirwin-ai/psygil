"use strict";
const electron = require("electron");
const CH = {
  CASES_LIST: "cases:list",
  CASES_GET: "cases:get",
  CASES_CREATE: "cases:create",
  CASES_UPDATE: "cases:update",
  CASES_ARCHIVE: "cases:archive",
  DB_HEALTH: "db:health",
  AUTH_LOGIN: "auth:login",
  AUTH_GET_STATUS: "auth:getStatus",
  AUTH_LOGOUT: "auth:logout",
  CONFIG_GET: "config:get",
  CONFIG_SET: "config:set"
};
const api = {
  platform: process.platform,
  cases: {
    list: (params) => electron.ipcRenderer.invoke(CH.CASES_LIST, params),
    get: (params) => electron.ipcRenderer.invoke(CH.CASES_GET, params),
    create: (params) => electron.ipcRenderer.invoke(CH.CASES_CREATE, params),
    update: (params) => electron.ipcRenderer.invoke(CH.CASES_UPDATE, params),
    archive: (params) => electron.ipcRenderer.invoke(CH.CASES_ARCHIVE, params)
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
  }
};
electron.contextBridge.exposeInMainWorld("psygil", api);
