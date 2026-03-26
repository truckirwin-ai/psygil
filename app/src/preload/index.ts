import { contextBridge, ipcRenderer } from 'electron'
import type { PsygilApi } from '../shared/types'

// IPC channel constants — must match main/ipc/handlers.ts
const CH = {
  CASES_LIST: 'cases:list',
  CASES_GET: 'cases:get',
  CASES_CREATE: 'cases:create',
  CASES_UPDATE: 'cases:update',
  CASES_ARCHIVE: 'cases:archive',
  DB_HEALTH: 'db:health',
  AUTH_LOGIN: 'auth:login',
  AUTH_GET_STATUS: 'auth:getStatus',
  AUTH_LOGOUT: 'auth:logout',
  CONFIG_GET: 'config:get',
  CONFIG_SET: 'config:set'
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
    update: (params) => ipcRenderer.invoke(CH.CASES_UPDATE, params),
    archive: (params) => ipcRenderer.invoke(CH.CASES_ARCHIVE, params)
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
  }
}

contextBridge.exposeInMainWorld('psygil', api)
