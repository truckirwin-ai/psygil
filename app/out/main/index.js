"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
const electron = require("electron");
const path = require("path");
const node_crypto = require("node:crypto");
const fs = require("fs");
const chokidar = require("chokidar");
const net = require("net");
const Database = require("better-sqlite3");
const betterSqlite3 = require("drizzle-orm/better-sqlite3");
const argon2 = require("argon2");
const drizzleOrm = require("drizzle-orm");
const sqliteCore = require("drizzle-orm/sqlite-core");
function _interopNamespaceDefault(e) {
  const n = Object.create(null, { [Symbol.toStringTag]: { value: "Module" } });
  if (e) {
    for (const k in e) {
      if (k !== "default") {
        const d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: () => e[k]
        });
      }
    }
  }
  n.default = e;
  return Object.freeze(n);
}
const net__namespace = /* @__PURE__ */ _interopNamespaceDefault(net);
const TOKEN_KEYS = {
  ID_TOKEN: "psygil_id_token",
  ACCESS_TOKEN: "psygil_access_token",
  REFRESH_TOKEN: "psygil_refresh_token"
};
let currentSession = null;
function encryptAndStore(key, value) {
  if (!electron.safeStorage.isEncryptionAvailable()) {
    throw new Error("Encryption not available — cannot store tokens securely");
  }
  const encrypted = electron.safeStorage.encryptString(value);
  tokenStore.set(key, encrypted);
}
const tokenStore = /* @__PURE__ */ new Map();
function setTokens(tokens) {
  encryptAndStore(TOKEN_KEYS.ID_TOKEN, tokens.idToken);
  encryptAndStore(TOKEN_KEYS.ACCESS_TOKEN, tokens.accessToken);
  if (tokens.refreshToken) {
    encryptAndStore(TOKEN_KEYS.REFRESH_TOKEN, tokens.refreshToken);
  }
}
function clearTokens() {
  tokenStore.clear();
}
function setSession(session) {
  currentSession = session;
}
function getSession() {
  return currentSession;
}
function clearSession() {
  currentSession = null;
  clearTokens();
}
function getAuthStatus() {
  if (!currentSession) {
    return { is_authenticated: false, session_expired: false };
  }
  const expired = new Date(currentSession.expiresAt) < /* @__PURE__ */ new Date();
  if (expired) {
    return { is_authenticated: false, session_expired: true };
  }
  return {
    is_authenticated: true,
    user_id: currentSession.userId,
    user_name: currentSession.userName,
    user_email: currentSession.email,
    is_active: currentSession.isActive,
    roles: currentSession.roles,
    session_expires_at: currentSession.expiresAt
  };
}
function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
function loadAuth0Config() {
  return {
    domain: requireEnv("AUTH0_DOMAIN"),
    clientId: requireEnv("AUTH0_CLIENT_ID"),
    callbackUrl: process.env["AUTH0_CALLBACK_URL"] ?? "psygil://callback",
    logoutUrl: process.env["AUTH0_LOGOUT_URL"] ?? "psygil://logout",
    audience: process.env["AUTH0_AUDIENCE"] || void 0,
    scopes: process.env["AUTH0_SCOPES"] ?? "openid profile email offline_access"
  };
}
function base64UrlEncode(buffer) {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function generateCodeVerifier() {
  return base64UrlEncode(node_crypto.randomBytes(32));
}
function generateCodeChallenge(verifier) {
  const hash = node_crypto.createHash("sha256").update(verifier).digest();
  return base64UrlEncode(hash);
}
function decodeIdTokenPayload(idToken) {
  const parts = idToken.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT format");
  }
  const payload = Buffer.from(parts[1], "base64url").toString("utf-8");
  return JSON.parse(payload);
}
async function exchangeCodeForTokens(code, codeVerifier) {
  const config = loadAuth0Config();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: config.clientId,
    code,
    code_verifier: codeVerifier,
    redirect_uri: config.callbackUrl
  });
  if (config.audience) {
    body.set("audience", config.audience);
  }
  const response = await fetch(`https://${config.domain}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString()
  });
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Token exchange failed (${response.status}): ${errorBody}`);
  }
  return await response.json();
}
async function performLogin(parentWindow) {
  const config = loadAuth0Config();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = base64UrlEncode(node_crypto.randomBytes(16));
  const authUrl = new URL(`https://${config.domain}/authorize`);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", config.clientId);
  authUrl.searchParams.set("redirect_uri", config.callbackUrl);
  authUrl.searchParams.set("scope", config.scopes);
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("state", state);
  if (config.audience) {
    authUrl.searchParams.set("audience", config.audience);
  }
  return new Promise((resolve) => {
    const authWindow = new electron.BrowserWindow({
      width: 480,
      height: 640,
      parent: parentWindow ?? void 0,
      modal: true,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });
    authWindow.once("ready-to-show", () => authWindow.show());
    const handleCallback = async (url) => {
      try {
        const callbackUrl = new URL(url);
        const returnedState = callbackUrl.searchParams.get("state");
        const code = callbackUrl.searchParams.get("code");
        const error = callbackUrl.searchParams.get("error");
        const notAuthenticated = {
          is_authenticated: false,
          user_id: "",
          user_name: "",
          user_email: "",
          is_active: false
        };
        if (error) {
          resolve(notAuthenticated);
          authWindow.close();
          return;
        }
        if (returnedState !== state) {
          resolve(notAuthenticated);
          authWindow.close();
          return;
        }
        if (!code) {
          resolve(notAuthenticated);
          authWindow.close();
          return;
        }
        const tokens = await exchangeCodeForTokens(code, codeVerifier);
        setTokens({
          idToken: tokens.id_token,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token
        });
        const payload = decodeIdTokenPayload(tokens.id_token);
        const expiresAt = new Date(Date.now() + tokens.expires_in * 1e3).toISOString();
        setSession({
          userId: payload.sub,
          userName: payload.name ?? payload.email ?? "Unknown",
          email: payload.email ?? "",
          roles: payload["https://psygil.com/roles"] ?? ["clinician"],
          isActive: true,
          expiresAt
        });
        resolve({
          is_authenticated: true,
          user_id: payload.sub,
          user_name: payload.name ?? payload.email ?? "Unknown",
          user_email: payload.email ?? "",
          is_active: true
        });
      } catch (err) {
        resolve({
          is_authenticated: false,
          user_id: "",
          user_name: "",
          user_email: "",
          is_active: false
        });
      } finally {
        if (!authWindow.isDestroyed()) {
          authWindow.close();
        }
      }
    };
    authWindow.webContents.on("will-navigate", (_event, url) => {
      if (url.startsWith("psygil://")) {
        void handleCallback(url);
      }
    });
    authWindow.webContents.on("will-redirect", (_event, url) => {
      if (url.startsWith("psygil://")) {
        void handleCallback(url);
      }
    });
    authWindow.on("closed", () => {
      resolve({
        is_authenticated: false,
        user_id: "",
        user_name: "",
        user_email: "",
        is_active: false
      });
    });
    void authWindow.loadURL(authUrl.toString());
  });
}
function performLogout(parentWindow) {
  clearSession();
  const loggedOutAt = (/* @__PURE__ */ new Date()).toISOString();
  try {
    const config = loadAuth0Config();
    const logoutUrl = new URL(`https://${config.domain}/v2/logout`);
    logoutUrl.searchParams.set("client_id", config.clientId);
    logoutUrl.searchParams.set("returnTo", config.logoutUrl);
    const logoutWindow = new electron.BrowserWindow({
      width: 1,
      height: 1,
      show: false,
      parent: parentWindow ?? void 0,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });
    void logoutWindow.loadURL(logoutUrl.toString());
    setTimeout(() => {
      if (!logoutWindow.isDestroyed()) {
        logoutWindow.close();
      }
    }, 3e3);
  } catch {
  }
  return { logged_out_at: loggedOutAt };
}
function checkLicense() {
  const session = getSession();
  if (!session || !session.isActive) {
    return { is_active: false, license_type: "none", expires_at: null };
  }
  return {
    is_active: true,
    license_type: "trial",
    expires_at: session.expiresAt
  };
}
function getConfigPath() {
  return path.join(electron.app.getPath("userData"), "config.json");
}
function readConfig() {
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) return {};
  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
function writeConfig(config) {
  const configPath = getConfigPath();
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
}
function loadWorkspacePath() {
  const config = readConfig();
  return config.workspacePath ?? null;
}
function saveWorkspacePath(p) {
  const config = readConfig();
  writeConfig({ ...config, workspacePath: p });
}
const WORKSPACE_SUBFOLDERS = ["_Inbox", "_Templates", "_Reference", "_Shared"];
function createFolderStructure(root) {
  if (!fs.existsSync(root)) {
    fs.mkdirSync(root, { recursive: true });
  }
  for (const sub of WORKSPACE_SUBFOLDERS) {
    const subPath = path.join(root, sub);
    if (!fs.existsSync(subPath)) {
      fs.mkdirSync(subPath, { recursive: true });
    }
  }
}
function getDefaultWorkspacePath() {
  return path.join(electron.app.getPath("documents"), "Psygil Cases");
}
let activeWatcher = null;
function watchWorkspace(root) {
  if (activeWatcher !== null) {
    activeWatcher.close();
    activeWatcher = null;
  }
  const watcher = chokidar.watch(root, {
    ignoreInitial: true,
    persistent: true,
    depth: 10,
    ignored: [
      /(^|[/\\])\../,
      // dotfiles
      "**/node_modules/**",
      "**/.DS_Store"
    ]
  });
  const broadcast = (event, filePath) => {
    const windows = electron.BrowserWindow.getAllWindows();
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send("workspace:file-changed", { event, path: filePath });
      }
    }
  };
  watcher.on("add", (filePath) => broadcast("add", filePath));
  watcher.on("change", (filePath) => broadcast("change", filePath));
  watcher.on("unlink", (filePath) => broadcast("unlink", filePath));
  watcher.on("addDir", (dirPath) => broadcast("addDir", dirPath));
  watcher.on("unlinkDir", (dirPath) => broadcast("unlinkDir", dirPath));
  activeWatcher = watcher;
}
function stopWatcher() {
  if (activeWatcher !== null) {
    activeWatcher.close();
    activeWatcher = null;
  }
}
function getWorkspaceTree(root) {
  if (!fs.existsSync(root)) return [];
  return buildTree(root);
}
function buildTree(dirPath) {
  let entries;
  try {
    entries = fs.readdirSync(dirPath);
  } catch {
    return [];
  }
  const nodes = [];
  const sorted = [...entries].sort((a, b) => {
    const aIsDir = isDirectory(path.join(dirPath, a));
    const bIsDir = isDirectory(path.join(dirPath, b));
    if (aIsDir && !bIsDir) return -1;
    if (!aIsDir && bIsDir) return 1;
    return a.localeCompare(b);
  });
  for (const name of sorted) {
    if (name.startsWith(".")) continue;
    const fullPath = path.join(dirPath, name);
    const isDir = isDirectory(fullPath);
    const node = {
      name,
      path: fullPath,
      isDirectory: isDir,
      children: isDir ? buildTree(fullPath) : void 0
    };
    nodes.push(node);
  }
  return nodes;
}
function isDirectory(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}
const SOCKET_PATH = "/tmp/psygil-sidecar.sock";
const REQUEST_TIMEOUT_MS = 3e4;
let _rpcId = 0;
function rpcCall(method, params) {
  return new Promise((resolve, reject) => {
    const client = new net__namespace.Socket();
    const id = ++_rpcId;
    const timeout = setTimeout(() => {
      client.destroy();
      reject(new Error(`PII sidecar request timed out: ${method}`));
    }, REQUEST_TIMEOUT_MS);
    client.connect(SOCKET_PATH, () => {
      const request = JSON.stringify({ jsonrpc: "2.0", method, params, id });
      client.write(request + "\n");
    });
    let buffer = "";
    client.on("data", (chunk) => {
      buffer += chunk.toString();
      if (buffer.includes("\n")) {
        clearTimeout(timeout);
        try {
          const resp = JSON.parse(buffer.split("\n")[0]);
          client.destroy();
          if (resp.error) {
            reject(new Error(`PII sidecar error: ${resp.error.message}`));
          } else {
            resolve(resp.result ?? {});
          }
        } catch {
          client.destroy();
          reject(new Error(`Failed to parse sidecar response: ${buffer}`));
        }
      }
    });
    client.on("error", (err) => {
      clearTimeout(timeout);
      reject(new Error(`PII sidecar connection error: ${err.message}`));
    });
  });
}
async function detect(text) {
  const result = await rpcCall("pii/detect", { text });
  const entities = result.entities;
  return entities.map((e) => ({
    text: e.text,
    start: e.start,
    end: e.end,
    type: e.type,
    score: e.score
  }));
}
async function batchDetect(texts) {
  const result = await rpcCall("pii/batch", { texts: [...texts] });
  const results = result.results;
  return results.map(
    (entities) => entities.map((e) => ({
      text: e.text,
      start: e.start,
      end: e.end,
      type: e.type,
      score: e.score
    }))
  );
}
const users = sqliteCore.sqliteTable("users", {
  user_id: sqliteCore.integer("user_id").primaryKey({ autoIncrement: true }),
  email: sqliteCore.text("email").notNull().unique(),
  full_name: sqliteCore.text("full_name").notNull(),
  role: sqliteCore.text("role").notNull(),
  // CHECK: psychologist | psychometrist | admin | receptionist
  specializations: sqliteCore.text("specializations"),
  credentials: sqliteCore.text("credentials"),
  license_number: sqliteCore.text("license_number"),
  state_licensed: sqliteCore.text("state_licensed"),
  organization: sqliteCore.text("organization"),
  is_active: sqliteCore.integer("is_active", { mode: "boolean" }).notNull().default(true),
  created_at: sqliteCore.text("created_at").notNull().default(drizzleOrm.sql`CURRENT_DATE`),
  last_login: sqliteCore.text("last_login"),
  deleted_at: sqliteCore.text("deleted_at"),
  // Addendum: practice association
  practice_id: sqliteCore.integer("practice_id").references(() => practiceConfig.practice_id)
}, (table) => [
  sqliteCore.index("idx_users_email").on(table.email),
  sqliteCore.index("idx_users_role").on(table.role),
  sqliteCore.index("idx_users_is_active").on(table.is_active),
  sqliteCore.index("idx_users_practice_id").on(table.practice_id)
]);
const diagnosisCatalog = sqliteCore.sqliteTable("diagnosis_catalog", {
  diagnosis_id: sqliteCore.integer("diagnosis_id").primaryKey({ autoIncrement: true }),
  code: sqliteCore.text("code").notNull().unique(),
  dsm5tr_code: sqliteCore.text("dsm5tr_code"),
  name: sqliteCore.text("name").notNull(),
  description: sqliteCore.text("description"),
  category: sqliteCore.text("category"),
  is_builtin: sqliteCore.integer("is_builtin", { mode: "boolean" }).notNull().default(true),
  created_by_user_id: sqliteCore.integer("created_by_user_id").references(() => users.user_id),
  created_at: sqliteCore.text("created_at").notNull().default(drizzleOrm.sql`CURRENT_DATE`)
}, (table) => [
  sqliteCore.index("idx_diagnosis_catalog_code").on(table.code),
  sqliteCore.index("idx_diagnosis_catalog_dsm5tr_code").on(table.dsm5tr_code),
  sqliteCore.index("idx_diagnosis_catalog_is_builtin").on(table.is_builtin)
]);
const instrumentLibrary = sqliteCore.sqliteTable("instrument_library", {
  instrument_id: sqliteCore.integer("instrument_id").primaryKey({ autoIncrement: true }),
  abbreviation: sqliteCore.text("abbreviation").notNull().unique(),
  full_name: sqliteCore.text("full_name").notNull(),
  description: sqliteCore.text("description"),
  what_it_measures: sqliteCore.text("what_it_measures"),
  publisher: sqliteCore.text("publisher"),
  publication_year: sqliteCore.integer("publication_year"),
  scoring_method: sqliteCore.text("scoring_method"),
  time_to_administer_minutes: sqliteCore.integer("time_to_administer_minutes"),
  is_active: sqliteCore.integer("is_active", { mode: "boolean" }).notNull().default(true),
  created_at: sqliteCore.text("created_at").notNull().default(drizzleOrm.sql`CURRENT_DATE`)
}, (table) => [
  sqliteCore.index("idx_instrument_library_abbreviation").on(table.abbreviation),
  sqliteCore.index("idx_instrument_library_is_active").on(table.is_active)
]);
const diagnosisInstrumentMappings = sqliteCore.sqliteTable("diagnosis_instrument_mappings", {
  mapping_id: sqliteCore.integer("mapping_id").primaryKey({ autoIncrement: true }),
  diagnosis_id: sqliteCore.integer("diagnosis_id").notNull().references(() => diagnosisCatalog.diagnosis_id, { onDelete: "cascade" }),
  instrument_id: sqliteCore.integer("instrument_id").notNull().references(() => instrumentLibrary.instrument_id, { onDelete: "cascade" }),
  relevance_score: sqliteCore.real("relevance_score").default(1),
  is_primary: sqliteCore.integer("is_primary", { mode: "boolean" }).default(false),
  notes: sqliteCore.text("notes")
}, (table) => [
  sqliteCore.uniqueIndex("idx_dim_unique").on(table.diagnosis_id, table.instrument_id),
  sqliteCore.index("idx_diagnosis_instrument_mappings_diagnosis_id").on(table.diagnosis_id),
  sqliteCore.index("idx_diagnosis_instrument_mappings_instrument_id").on(table.instrument_id)
]);
const practiceProfiles = sqliteCore.sqliteTable("practice_profiles", {
  profile_id: sqliteCore.integer("profile_id").primaryKey({ autoIncrement: true }),
  profile_name: sqliteCore.text("profile_name").notNull().unique(),
  profile_type: sqliteCore.text("profile_type").notNull(),
  // CHECK: forensic_criminal | forensic_civil | clinical_general | neuropsych
  description: sqliteCore.text("description"),
  default_diagnoses: sqliteCore.text("default_diagnoses"),
  default_instruments: sqliteCore.text("default_instruments"),
  standard_sections: sqliteCore.text("standard_sections"),
  created_by_user_id: sqliteCore.integer("created_by_user_id").notNull().references(() => users.user_id),
  is_active: sqliteCore.integer("is_active", { mode: "boolean" }).notNull().default(true),
  created_at: sqliteCore.text("created_at").notNull().default(drizzleOrm.sql`CURRENT_DATE`)
}, (table) => [
  sqliteCore.index("idx_practice_profiles_profile_type").on(table.profile_type),
  sqliteCore.index("idx_practice_profiles_is_active").on(table.is_active)
]);
const reportTemplates = sqliteCore.sqliteTable("report_templates", {
  template_id: sqliteCore.integer("template_id").primaryKey({ autoIncrement: true }),
  template_name: sqliteCore.text("template_name").notNull(),
  evaluation_type: sqliteCore.text("evaluation_type").notNull(),
  template_content: sqliteCore.text("template_content"),
  sections: sqliteCore.text("sections"),
  jurisdiction: sqliteCore.text("jurisdiction"),
  created_by_user_id: sqliteCore.integer("created_by_user_id").notNull().references(() => users.user_id),
  is_active: sqliteCore.integer("is_active", { mode: "boolean" }).notNull().default(true),
  version: sqliteCore.integer("version").default(1),
  created_at: sqliteCore.text("created_at").notNull().default(drizzleOrm.sql`CURRENT_DATE`)
}, (table) => [
  sqliteCore.index("idx_report_templates_evaluation_type").on(table.evaluation_type),
  sqliteCore.index("idx_report_templates_jurisdiction").on(table.jurisdiction),
  sqliteCore.index("idx_report_templates_is_active").on(table.is_active)
]);
const styleRules = sqliteCore.sqliteTable("style_rules", {
  rule_id: sqliteCore.integer("rule_id").primaryKey({ autoIncrement: true }),
  rule_name: sqliteCore.text("rule_name").notNull().unique(),
  rule_content: sqliteCore.text("rule_content").notNull(),
  category: sqliteCore.text("category"),
  guardrails: sqliteCore.text("guardrails"),
  examples: sqliteCore.text("examples"),
  created_at: sqliteCore.text("created_at").notNull().default(drizzleOrm.sql`CURRENT_DATE`),
  updated_at: sqliteCore.text("updated_at").default(drizzleOrm.sql`CURRENT_DATE`)
}, (table) => [
  sqliteCore.index("idx_style_rules_category").on(table.category)
]);
const cases = sqliteCore.sqliteTable("cases", {
  case_id: sqliteCore.integer("case_id").primaryKey({ autoIncrement: true }),
  case_number: sqliteCore.text("case_number").notNull().unique(),
  primary_clinician_user_id: sqliteCore.integer("primary_clinician_user_id").notNull().references(() => users.user_id),
  examinee_first_name: sqliteCore.text("examinee_first_name").notNull(),
  examinee_last_name: sqliteCore.text("examinee_last_name").notNull(),
  examinee_dob: sqliteCore.text("examinee_dob"),
  examinee_gender: sqliteCore.text("examinee_gender"),
  cultural_context: sqliteCore.text("cultural_context"),
  linguistic_context: sqliteCore.text("linguistic_context"),
  evaluation_type: sqliteCore.text("evaluation_type"),
  practice_profile_id: sqliteCore.integer("practice_profile_id").references(() => practiceProfiles.profile_id),
  referral_source: sqliteCore.text("referral_source"),
  evaluation_questions: sqliteCore.text("evaluation_questions"),
  case_status: sqliteCore.text("case_status").notNull().default("intake"),
  // CHECK: intake | in_progress | completed | archived
  workflow_current_stage: sqliteCore.text("workflow_current_stage").default("gate_1"),
  // CHECK: gate_1 | gate_2 | gate_3 | finalized
  created_at: sqliteCore.text("created_at").notNull().default(drizzleOrm.sql`CURRENT_DATE`),
  last_modified: sqliteCore.text("last_modified").default(drizzleOrm.sql`CURRENT_DATE`),
  completed_at: sqliteCore.text("completed_at"),
  notes: sqliteCore.text("notes"),
  // Addendum: practice association
  practice_id: sqliteCore.integer("practice_id").references(() => practiceConfig.practice_id)
}, (table) => [
  sqliteCore.index("idx_cases_primary_clinician_user_id").on(table.primary_clinician_user_id),
  sqliteCore.index("idx_cases_case_status").on(table.case_status),
  sqliteCore.index("idx_cases_workflow_current_stage").on(table.workflow_current_stage),
  sqliteCore.index("idx_cases_created_at").on(table.created_at),
  sqliteCore.index("idx_cases_case_number").on(table.case_number),
  sqliteCore.index("idx_cases_practice_id").on(table.practice_id)
]);
const sessions = sqliteCore.sqliteTable("sessions", {
  session_id: sqliteCore.integer("session_id").primaryKey({ autoIncrement: true }),
  case_id: sqliteCore.integer("case_id").notNull().references(() => cases.case_id, { onDelete: "cascade" }),
  session_number: sqliteCore.integer("session_number").notNull(),
  session_date: sqliteCore.text("session_date").notNull(),
  clinician_user_id: sqliteCore.integer("clinician_user_id").notNull().references(() => users.user_id),
  psychometrist_user_id: sqliteCore.integer("psychometrist_user_id").references(() => users.user_id),
  duration_minutes: sqliteCore.integer("duration_minutes"),
  session_notes: sqliteCore.text("session_notes"),
  behavioral_observations: sqliteCore.text("behavioral_observations"),
  rapport_quality: sqliteCore.text("rapport_quality"),
  created_at: sqliteCore.text("created_at").notNull().default(drizzleOrm.sql`CURRENT_DATE`)
}, (table) => [
  sqliteCore.uniqueIndex("idx_sessions_case_session").on(table.case_id, table.session_number),
  sqliteCore.index("idx_sessions_case_id").on(table.case_id),
  sqliteCore.index("idx_sessions_session_date").on(table.session_date),
  sqliteCore.index("idx_sessions_clinician_user_id").on(table.clinician_user_id)
]);
const documents = sqliteCore.sqliteTable("documents", {
  document_id: sqliteCore.integer("document_id").primaryKey({ autoIncrement: true }),
  case_id: sqliteCore.integer("case_id").notNull().references(() => cases.case_id, { onDelete: "cascade" }),
  session_id: sqliteCore.integer("session_id").references(() => sessions.session_id, { onDelete: "set null" }),
  document_type: sqliteCore.text("document_type").notNull(),
  // CHECK: referral | pdf | docx | transcript_vtt | audio | score_report | medical_record | other
  original_filename: sqliteCore.text("original_filename").notNull(),
  file_path: sqliteCore.text("file_path").notNull(),
  file_size_bytes: sqliteCore.integer("file_size_bytes"),
  mime_type: sqliteCore.text("mime_type"),
  uploaded_by_user_id: sqliteCore.integer("uploaded_by_user_id").notNull().references(() => users.user_id),
  upload_date: sqliteCore.text("upload_date").notNull().default(drizzleOrm.sql`CURRENT_DATE`),
  description: sqliteCore.text("description"),
  indexed_content: sqliteCore.text("indexed_content"),
  // Addendum: cloud sync columns
  remote_path: sqliteCore.text("remote_path"),
  remote_version: sqliteCore.text("remote_version"),
  sync_status: sqliteCore.text("sync_status").default("local_only"),
  // CHECK: local_only | synced | pending_upload | pending_download | conflict
  last_synced_at: sqliteCore.text("last_synced_at")
}, (table) => [
  sqliteCore.index("idx_documents_case_id").on(table.case_id),
  sqliteCore.index("idx_documents_session_id").on(table.session_id),
  sqliteCore.index("idx_documents_document_type").on(table.document_type),
  sqliteCore.index("idx_documents_upload_date").on(table.upload_date),
  sqliteCore.index("idx_documents_sync_status").on(table.sync_status),
  sqliteCore.index("idx_documents_last_synced_at").on(table.last_synced_at)
]);
const testAdministrations = sqliteCore.sqliteTable("test_administrations", {
  test_admin_id: sqliteCore.integer("test_admin_id").primaryKey({ autoIncrement: true }),
  case_id: sqliteCore.integer("case_id").notNull().references(() => cases.case_id, { onDelete: "cascade" }),
  session_id: sqliteCore.integer("session_id").references(() => sessions.session_id, { onDelete: "set null" }),
  instrument_id: sqliteCore.integer("instrument_id").notNull().references(() => instrumentLibrary.instrument_id),
  administration_date: sqliteCore.text("administration_date").notNull(),
  administered_by_user_id: sqliteCore.integer("administered_by_user_id").notNull().references(() => users.user_id),
  score_report_document_id: sqliteCore.integer("score_report_document_id").references(() => documents.document_id, { onDelete: "set null" }),
  raw_score: sqliteCore.real("raw_score"),
  standard_score: sqliteCore.real("standard_score"),
  percentile: sqliteCore.integer("percentile"),
  scaled_score: sqliteCore.real("scaled_score"),
  t_score: sqliteCore.real("t_score"),
  confidence_interval_lower: sqliteCore.real("confidence_interval_lower"),
  confidence_interval_upper: sqliteCore.real("confidence_interval_upper"),
  interpretation: sqliteCore.text("interpretation"),
  notes: sqliteCore.text("notes"),
  data_entry_method: sqliteCore.text("data_entry_method"),
  // CHECK: manual | qglobal_import | pariconnect_import | pdf_extraction
  created_at: sqliteCore.text("created_at").notNull().default(drizzleOrm.sql`CURRENT_DATE`)
}, (table) => [
  sqliteCore.index("idx_test_administrations_case_id").on(table.case_id),
  sqliteCore.index("idx_test_administrations_instrument_id").on(table.instrument_id),
  sqliteCore.index("idx_test_administrations_administration_date").on(table.administration_date)
]);
const gateReviews = sqliteCore.sqliteTable("gate_reviews", {
  gate_review_id: sqliteCore.integer("gate_review_id").primaryKey({ autoIncrement: true }),
  case_id: sqliteCore.integer("case_id").notNull().references(() => cases.case_id, { onDelete: "cascade" }),
  gate_number: sqliteCore.integer("gate_number").notNull(),
  // CHECK: 1 | 2 | 3
  gate_purpose: sqliteCore.text("gate_purpose").notNull(),
  reviewer_user_id: sqliteCore.integer("reviewer_user_id").notNull().references(() => users.user_id),
  review_date: sqliteCore.text("review_date").notNull().default(drizzleOrm.sql`CURRENT_DATE`),
  review_status: sqliteCore.text("review_status").notNull().default("pending"),
  // CHECK: pending | in_progress | completed | requires_revision
  notes: sqliteCore.text("notes")
}, (table) => [
  sqliteCore.uniqueIndex("idx_gate_reviews_case_gate").on(table.case_id, table.gate_number),
  sqliteCore.index("idx_gate_reviews_case_id").on(table.case_id),
  sqliteCore.index("idx_gate_reviews_gate_number").on(table.gate_number),
  sqliteCore.index("idx_gate_reviews_review_status").on(table.review_status)
]);
const gateDecisions = sqliteCore.sqliteTable("gate_decisions", {
  decision_id: sqliteCore.integer("decision_id").primaryKey({ autoIncrement: true }),
  gate_review_id: sqliteCore.integer("gate_review_id").notNull().references(() => gateReviews.gate_review_id, { onDelete: "cascade" }),
  case_id: sqliteCore.integer("case_id").notNull().references(() => cases.case_id, { onDelete: "cascade" }),
  decision_type: sqliteCore.text("decision_type").notNull(),
  // CHECK: data_confirmed | diagnosis_selected | diagnosis_ruled_out | attestation | other
  subject_entity_type: sqliteCore.text("subject_entity_type"),
  subject_entity_id: sqliteCore.integer("subject_entity_id"),
  actor_user_id: sqliteCore.integer("actor_user_id").notNull().references(() => users.user_id),
  decision_rationale: sqliteCore.text("decision_rationale"),
  decision_date: sqliteCore.text("decision_date").notNull().default(drizzleOrm.sql`CURRENT_DATE`),
  is_final: sqliteCore.integer("is_final", { mode: "boolean" }).default(false)
}, (table) => [
  sqliteCore.index("idx_gate_decisions_gate_review_id").on(table.gate_review_id),
  sqliteCore.index("idx_gate_decisions_case_id").on(table.case_id),
  sqliteCore.index("idx_gate_decisions_decision_type").on(table.decision_type),
  sqliteCore.index("idx_gate_decisions_actor_user_id").on(table.actor_user_id)
]);
const diagnoses = sqliteCore.sqliteTable("diagnoses", {
  diagnosis_record_id: sqliteCore.integer("diagnosis_record_id").primaryKey({ autoIncrement: true }),
  case_id: sqliteCore.integer("case_id").notNull().references(() => cases.case_id, { onDelete: "cascade" }),
  diagnosis_id: sqliteCore.integer("diagnosis_id").notNull().references(() => diagnosisCatalog.diagnosis_id),
  selected_at_gate_2: sqliteCore.integer("selected_at_gate_2", { mode: "boolean" }).default(true),
  clinician_user_id: sqliteCore.integer("clinician_user_id").notNull().references(() => users.user_id),
  confidence_level: sqliteCore.text("confidence_level"),
  // CHECK: high | moderate | low
  supporting_evidence: sqliteCore.text("supporting_evidence"),
  selection_date: sqliteCore.text("selection_date").notNull().default(drizzleOrm.sql`CURRENT_DATE`),
  is_primary_diagnosis: sqliteCore.integer("is_primary_diagnosis", { mode: "boolean" }).default(false),
  rule_out_rationale: sqliteCore.text("rule_out_rationale")
}, (table) => [
  sqliteCore.index("idx_diagnoses_case_id").on(table.case_id),
  sqliteCore.index("idx_diagnoses_diagnosis_id").on(table.diagnosis_id),
  sqliteCore.index("idx_diagnoses_clinician_user_id").on(table.clinician_user_id),
  sqliteCore.index("idx_diagnoses_selected_at_gate_2").on(table.selected_at_gate_2)
]);
const agentRuns = sqliteCore.sqliteTable("agent_runs", {
  agent_run_id: sqliteCore.integer("agent_run_id").primaryKey({ autoIncrement: true }),
  case_id: sqliteCore.integer("case_id").notNull().references(() => cases.case_id, { onDelete: "cascade" }),
  agent_type: sqliteCore.text("agent_type").notNull(),
  // CHECK: diagnostician | writer | validator
  agent_version: sqliteCore.text("agent_version"),
  input_hash: sqliteCore.text("input_hash"),
  input_summary: sqliteCore.text("input_summary"),
  output_hash: sqliteCore.text("output_hash"),
  output_summary: sqliteCore.text("output_summary"),
  duration_seconds: sqliteCore.real("duration_seconds"),
  status: sqliteCore.text("status").notNull().default("success"),
  // CHECK: success | partial_success | failed | error
  error_message: sqliteCore.text("error_message"),
  invoked_by_user_id: sqliteCore.integer("invoked_by_user_id").notNull().references(() => users.user_id),
  started_at: sqliteCore.text("started_at").notNull().default(drizzleOrm.sql`CURRENT_DATE`),
  completed_at: sqliteCore.text("completed_at")
}, (table) => [
  sqliteCore.index("idx_agent_runs_case_id").on(table.case_id),
  sqliteCore.index("idx_agent_runs_agent_type").on(table.agent_type),
  sqliteCore.index("idx_agent_runs_status").on(table.status),
  sqliteCore.index("idx_agent_runs_started_at").on(table.started_at)
]);
const evidenceMaps = sqliteCore.sqliteTable("evidence_maps", {
  evidence_map_id: sqliteCore.integer("evidence_map_id").primaryKey({ autoIncrement: true }),
  agent_run_id: sqliteCore.integer("agent_run_id").notNull().references(() => agentRuns.agent_run_id, { onDelete: "cascade" }),
  case_id: sqliteCore.integer("case_id").notNull().references(() => cases.case_id, { onDelete: "cascade" }),
  diagnosis_id: sqliteCore.integer("diagnosis_id").notNull().references(() => diagnosisCatalog.diagnosis_id),
  criterion_name: sqliteCore.text("criterion_name").notNull(),
  criterion_description: sqliteCore.text("criterion_description"),
  supporting_evidence: sqliteCore.text("supporting_evidence"),
  contradicting_evidence: sqliteCore.text("contradicting_evidence"),
  evidence_strength: sqliteCore.text("evidence_strength"),
  // CHECK: strong | moderate | weak | absent
  confidence_score: sqliteCore.real("confidence_score"),
  source_documents: sqliteCore.text("source_documents"),
  created_at: sqliteCore.text("created_at").notNull().default(drizzleOrm.sql`CURRENT_DATE`)
}, (table) => [
  sqliteCore.index("idx_evidence_maps_agent_run_id").on(table.agent_run_id),
  sqliteCore.index("idx_evidence_maps_case_id").on(table.case_id),
  sqliteCore.index("idx_evidence_maps_diagnosis_id").on(table.diagnosis_id)
]);
const writerDrafts = sqliteCore.sqliteTable("writer_drafts", {
  draft_id: sqliteCore.integer("draft_id").primaryKey({ autoIncrement: true }),
  agent_run_id: sqliteCore.integer("agent_run_id").notNull().references(() => agentRuns.agent_run_id, { onDelete: "cascade" }),
  case_id: sqliteCore.integer("case_id").notNull().references(() => cases.case_id, { onDelete: "cascade" }),
  section_name: sqliteCore.text("section_name").notNull(),
  section_content: sqliteCore.text("section_content").notNull(),
  content_type: sqliteCore.text("content_type").notNull(),
  // CHECK: fully_generated | draft_requiring_revision
  revision_status: sqliteCore.text("revision_status").default("pending"),
  // CHECK: pending | reviewed | approved | revised
  reviewer_user_id: sqliteCore.integer("reviewer_user_id").references(() => users.user_id),
  review_notes: sqliteCore.text("review_notes"),
  created_at: sqliteCore.text("created_at").notNull().default(drizzleOrm.sql`CURRENT_DATE`),
  reviewed_at: sqliteCore.text("reviewed_at")
}, (table) => [
  sqliteCore.index("idx_writer_drafts_agent_run_id").on(table.agent_run_id),
  sqliteCore.index("idx_writer_drafts_case_id").on(table.case_id),
  sqliteCore.index("idx_writer_drafts_content_type").on(table.content_type),
  sqliteCore.index("idx_writer_drafts_revision_status").on(table.revision_status)
]);
const reports = sqliteCore.sqliteTable("reports", {
  report_id: sqliteCore.integer("report_id").primaryKey({ autoIncrement: true }),
  case_id: sqliteCore.integer("case_id").notNull().references(() => cases.case_id, { onDelete: "cascade" }),
  report_version: sqliteCore.integer("report_version").notNull().default(1),
  template_id: sqliteCore.integer("template_id").references(() => reportTemplates.template_id, { onDelete: "set null" }),
  generated_by_user_id: sqliteCore.integer("generated_by_user_id").notNull().references(() => users.user_id),
  created_at: sqliteCore.text("created_at").notNull().default(drizzleOrm.sql`CURRENT_DATE`),
  last_modified: sqliteCore.text("last_modified").default(drizzleOrm.sql`CURRENT_DATE`),
  finalized_by_user_id: sqliteCore.integer("finalized_by_user_id").references(() => users.user_id),
  finalized_at: sqliteCore.text("finalized_at"),
  is_locked: sqliteCore.integer("is_locked", { mode: "boolean" }).default(false),
  integrity_hash: sqliteCore.text("integrity_hash"),
  sealed_pdf_path: sqliteCore.text("sealed_pdf_path"),
  file_path: sqliteCore.text("file_path").notNull(),
  file_size_bytes: sqliteCore.integer("file_size_bytes"),
  status: sqliteCore.text("status").notNull().default("draft")
  // CHECK: draft | in_review | revisions_needed | approved | finalized
}, (table) => [
  sqliteCore.index("idx_reports_case_id").on(table.case_id),
  sqliteCore.index("idx_reports_report_version").on(table.report_version),
  sqliteCore.index("idx_reports_status").on(table.status),
  sqliteCore.index("idx_reports_created_at").on(table.created_at),
  sqliteCore.index("idx_reports_is_locked").on(table.is_locked)
]);
const reportRevisions = sqliteCore.sqliteTable("report_revisions", {
  revision_id: sqliteCore.integer("revision_id").primaryKey({ autoIncrement: true }),
  report_id: sqliteCore.integer("report_id").notNull().references(() => reports.report_id, { onDelete: "cascade" }),
  revision_number: sqliteCore.integer("revision_number").notNull(),
  changed_by_user_id: sqliteCore.integer("changed_by_user_id").notNull().references(() => users.user_id),
  revision_date: sqliteCore.text("revision_date").notNull().default(drizzleOrm.sql`CURRENT_DATE`),
  change_summary: sqliteCore.text("change_summary"),
  previous_integrity_hash: sqliteCore.text("previous_integrity_hash"),
  new_integrity_hash: sqliteCore.text("new_integrity_hash")
}, (table) => [
  sqliteCore.uniqueIndex("idx_report_revisions_report_rev").on(table.report_id, table.revision_number),
  sqliteCore.index("idx_report_revisions_report_id").on(table.report_id),
  sqliteCore.index("idx_report_revisions_changed_by_user_id").on(table.changed_by_user_id)
]);
const auditLog = sqliteCore.sqliteTable("audit_log", {
  audit_log_id: sqliteCore.integer("audit_log_id").primaryKey({ autoIncrement: true }),
  case_id: sqliteCore.integer("case_id").notNull().references(() => cases.case_id, { onDelete: "cascade" }),
  action_type: sqliteCore.text("action_type").notNull(),
  // CHECK: see SQL spec for full list
  actor_user_id: sqliteCore.integer("actor_user_id").notNull().references(() => users.user_id),
  action_date: sqliteCore.text("action_date").notNull().default(drizzleOrm.sql`CURRENT_DATE`),
  details: sqliteCore.text("details"),
  related_entity_type: sqliteCore.text("related_entity_type"),
  related_entity_id: sqliteCore.integer("related_entity_id"),
  granularity: sqliteCore.text("granularity").default("decision_record_only")
  // CHECK: decision_record_only | full_detail
}, (table) => [
  sqliteCore.index("idx_audit_log_case_id").on(table.case_id),
  sqliteCore.index("idx_audit_log_action_date").on(table.action_date),
  sqliteCore.index("idx_audit_log_actor_user_id").on(table.actor_user_id),
  sqliteCore.index("idx_audit_log_action_type").on(table.action_type)
]);
const peerConsultations = sqliteCore.sqliteTable("peer_consultations", {
  consultation_id: sqliteCore.integer("consultation_id").primaryKey({ autoIncrement: true }),
  case_id: sqliteCore.integer("case_id").notNull().references(() => cases.case_id, { onDelete: "cascade" }),
  initiating_clinician_user_id: sqliteCore.integer("initiating_clinician_user_id").notNull().references(() => users.user_id),
  consulting_clinician_user_id: sqliteCore.integer("consulting_clinician_user_id").notNull().references(() => users.user_id),
  consultation_date: sqliteCore.text("consultation_date").notNull().default(drizzleOrm.sql`CURRENT_DATE`),
  consultation_topic: sqliteCore.text("consultation_topic"),
  consultation_notes: sqliteCore.text("consultation_notes"),
  consultation_response: sqliteCore.text("consultation_response"),
  response_date: sqliteCore.text("response_date")
}, (table) => [
  sqliteCore.index("idx_peer_consultations_case_id").on(table.case_id),
  sqliteCore.index("idx_peer_consultations_initiating").on(table.initiating_clinician_user_id),
  sqliteCore.index("idx_peer_consultations_consulting").on(table.consulting_clinician_user_id)
]);
const referralSources = sqliteCore.sqliteTable("referral_sources", {
  referral_id: sqliteCore.integer("referral_id").primaryKey({ autoIncrement: true }),
  case_id: sqliteCore.integer("case_id").notNull().references(() => cases.case_id, { onDelete: "cascade" }),
  referral_document_id: sqliteCore.integer("referral_document_id").references(() => documents.document_id, { onDelete: "set null" }),
  referral_source_name: sqliteCore.text("referral_source_name").notNull(),
  referral_source_type: sqliteCore.text("referral_source_type"),
  // CHECK: attorney | court | medical | insurance | self_referred | other
  referral_date: sqliteCore.text("referral_date"),
  evaluation_questions: sqliteCore.text("evaluation_questions"),
  specific_concerns: sqliteCore.text("specific_concerns"),
  requesting_party: sqliteCore.text("requesting_party")
}, (table) => [
  sqliteCore.index("idx_referral_sources_case_id").on(table.case_id),
  sqliteCore.index("idx_referral_sources_referral_source_type").on(table.referral_source_type)
]);
const backupMetadata = sqliteCore.sqliteTable("backup_metadata", {
  backup_id: sqliteCore.integer("backup_id").primaryKey({ autoIncrement: true }),
  backup_date: sqliteCore.text("backup_date").notNull().default(drizzleOrm.sql`CURRENT_DATE`),
  backup_type: sqliteCore.text("backup_type").notNull(),
  // CHECK: full | incremental | export
  backup_path: sqliteCore.text("backup_path").notNull(),
  case_count: sqliteCore.integer("case_count"),
  file_size_bytes: sqliteCore.integer("file_size_bytes"),
  integrity_hash: sqliteCore.text("integrity_hash"),
  created_by_user_id: sqliteCore.integer("created_by_user_id").references(() => users.user_id),
  notes: sqliteCore.text("notes")
}, (table) => [
  sqliteCore.index("idx_backup_metadata_backup_date").on(table.backup_date),
  sqliteCore.index("idx_backup_metadata_backup_type").on(table.backup_type)
]);
const caseNotes = sqliteCore.sqliteTable("case_notes", {
  case_note_id: sqliteCore.integer("case_note_id").primaryKey({ autoIncrement: true }),
  case_id: sqliteCore.integer("case_id").notNull().references(() => cases.case_id, { onDelete: "cascade" }),
  session_id: sqliteCore.integer("session_id").references(() => sessions.session_id, { onDelete: "set null" }),
  created_by_user_id: sqliteCore.integer("created_by_user_id").notNull().references(() => users.user_id),
  note_content: sqliteCore.text("note_content").notNull(),
  note_type: sqliteCore.text("note_type"),
  // CHECK: clinical | administrative | diagnostic_reasoning | test_interpretation
  created_at: sqliteCore.text("created_at").notNull().default(drizzleOrm.sql`CURRENT_DATE`)
}, (table) => [
  sqliteCore.index("idx_case_notes_case_id").on(table.case_id),
  sqliteCore.index("idx_case_notes_session_id").on(table.session_id),
  sqliteCore.index("idx_case_notes_created_at").on(table.created_at)
]);
const practiceConfig = sqliteCore.sqliteTable("practice_config", {
  practice_id: sqliteCore.integer("practice_id").primaryKey({ autoIncrement: true }),
  practice_name: sqliteCore.text("practice_name").notNull().unique(),
  storage_mode: sqliteCore.text("storage_mode").notNull().default("local_only"),
  // CHECK: local_only | shared_drive | cloud_o365 | cloud_gdrive
  storage_path: sqliteCore.text("storage_path"),
  cloud_tenant_id: sqliteCore.text("cloud_tenant_id"),
  cloud_site_id: sqliteCore.text("cloud_site_id"),
  cloud_drive_id: sqliteCore.text("cloud_drive_id"),
  gdrive_shared_drive_id: sqliteCore.text("gdrive_shared_drive_id"),
  auto_sync_interval_minutes: sqliteCore.integer("auto_sync_interval_minutes"),
  enable_version_history: sqliteCore.integer("enable_version_history", { mode: "boolean" }).default(true),
  max_local_cache_mb: sqliteCore.integer("max_local_cache_mb").default(5e3),
  admin_email: sqliteCore.text("admin_email"),
  created_at: sqliteCore.text("created_at").notNull().default(drizzleOrm.sql`CURRENT_DATE`),
  updated_at: sqliteCore.text("updated_at").default(drizzleOrm.sql`CURRENT_DATE`)
}, (table) => [
  sqliteCore.index("idx_practice_config_storage_mode").on(table.storage_mode),
  sqliteCore.index("idx_practice_config_practice_name").on(table.practice_name)
]);
const documentPermissions = sqliteCore.sqliteTable("document_permissions", {
  permission_id: sqliteCore.integer("permission_id").primaryKey({ autoIncrement: true }),
  document_id: sqliteCore.integer("document_id").notNull().references(() => documents.document_id, { onDelete: "cascade" }),
  user_id: sqliteCore.integer("user_id").notNull().references(() => users.user_id, { onDelete: "cascade" }),
  permission_level: sqliteCore.text("permission_level").notNull().default("read"),
  // CHECK: read | write | admin
  granted_by_user_id: sqliteCore.integer("granted_by_user_id").notNull().references(() => users.user_id),
  granted_at: sqliteCore.text("granted_at").notNull().default(drizzleOrm.sql`CURRENT_DATE`),
  revoked_at: sqliteCore.text("revoked_at")
}, (table) => [
  sqliteCore.uniqueIndex("idx_document_permissions_doc_user").on(table.document_id, table.user_id),
  sqliteCore.index("idx_document_permissions_document_id").on(table.document_id),
  sqliteCore.index("idx_document_permissions_user_id").on(table.user_id),
  sqliteCore.index("idx_document_permissions_permission_level").on(table.permission_level)
]);
const fileLocks = sqliteCore.sqliteTable("file_locks", {
  lock_id: sqliteCore.integer("lock_id").primaryKey({ autoIncrement: true }),
  document_id: sqliteCore.integer("document_id").notNull().references(() => documents.document_id, { onDelete: "cascade" }).unique(),
  locked_by_user_id: sqliteCore.integer("locked_by_user_id").notNull().references(() => users.user_id),
  lock_type: sqliteCore.text("lock_type").notNull().default("exclusive"),
  // CHECK: exclusive | shared
  acquired_at: sqliteCore.text("acquired_at").notNull().default(drizzleOrm.sql`CURRENT_DATE`),
  expires_at: sqliteCore.text("expires_at").notNull(),
  released_at: sqliteCore.text("released_at")
}, (table) => [
  sqliteCore.index("idx_file_locks_document_id").on(table.document_id),
  sqliteCore.index("idx_file_locks_locked_by_user_id").on(table.locked_by_user_id),
  sqliteCore.index("idx_file_locks_expires_at").on(table.expires_at)
]);
const syncManifest = sqliteCore.sqliteTable("sync_manifest", {
  manifest_id: sqliteCore.integer("manifest_id").primaryKey({ autoIncrement: true }),
  case_id: sqliteCore.integer("case_id").notNull().references(() => cases.case_id, { onDelete: "cascade" }).unique(),
  last_sync_date: sqliteCore.text("last_sync_date"),
  manifest_json: sqliteCore.text("manifest_json"),
  sync_direction: sqliteCore.text("sync_direction").notNull().default("bidirectional"),
  // CHECK: upload | download | bidirectional
  sync_status: sqliteCore.text("sync_status").notNull().default("synced"),
  // CHECK: synced | pending | conflict | error
  error_message: sqliteCore.text("error_message"),
  updated_at: sqliteCore.text("updated_at").notNull().default(drizzleOrm.sql`CURRENT_DATE`)
}, (table) => [
  sqliteCore.index("idx_sync_manifest_case_id").on(table.case_id),
  sqliteCore.index("idx_sync_manifest_sync_status").on(table.sync_status),
  sqliteCore.index("idx_sync_manifest_updated_at").on(table.updated_at)
]);
const caseAssignments = sqliteCore.sqliteTable("case_assignments", {
  assignment_id: sqliteCore.integer("assignment_id").primaryKey({ autoIncrement: true }),
  case_id: sqliteCore.integer("case_id").notNull().references(() => cases.case_id, { onDelete: "cascade" }),
  user_id: sqliteCore.integer("user_id").notNull().references(() => users.user_id, { onDelete: "cascade" }),
  role_in_case: sqliteCore.text("role_in_case").notNull(),
  // CHECK: primary_clinician | reviewing_clinician | psychometrist | receptionist
  assigned_by_user_id: sqliteCore.integer("assigned_by_user_id").notNull().references(() => users.user_id),
  assigned_at: sqliteCore.text("assigned_at").notNull().default(drizzleOrm.sql`CURRENT_DATE`),
  completed_at: sqliteCore.text("completed_at")
}, (table) => [
  sqliteCore.uniqueIndex("idx_case_assignments_unique").on(table.case_id, table.user_id, table.role_in_case),
  sqliteCore.index("idx_case_assignments_case_id").on(table.case_id),
  sqliteCore.index("idx_case_assignments_user_id").on(table.user_id),
  sqliteCore.index("idx_case_assignments_role_in_case").on(table.role_in_case)
]);
const schema = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  agentRuns,
  auditLog,
  backupMetadata,
  caseAssignments,
  caseNotes,
  cases,
  diagnoses,
  diagnosisCatalog,
  diagnosisInstrumentMappings,
  documentPermissions,
  documents,
  evidenceMaps,
  fileLocks,
  gateDecisions,
  gateReviews,
  instrumentLibrary,
  peerConsultations,
  practiceConfig,
  practiceProfiles,
  referralSources,
  reportRevisions,
  reportTemplates,
  reports,
  sessions,
  styleRules,
  syncManifest,
  testAdministrations,
  users,
  writerDrafts
}, Symbol.toStringTag, { value: "Module" }));
const DEV_PASSPHRASE = "psygil-dev-key-2026";
const DEV_SALT = Buffer.from("psygil-kdf-salt-v1");
async function deriveKey(passphrase) {
  const keyBuffer = await argon2.hash(passphrase, {
    type: argon2.argon2id,
    memoryCost: 65536,
    // 64 MB
    timeCost: 3,
    parallelism: 1,
    hashLength: 32,
    salt: DEV_SALT,
    raw: true
  });
  return keyBuffer.toString("hex");
}
function openDatabase(dbPath, hexKey) {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const sqlite = new Database(dbPath);
  sqlite.pragma("cipher='sqlcipher'");
  sqlite.pragma(`key="x'${hexKey}'"`);
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("journal_mode = WAL");
  const db = betterSqlite3.drizzle(sqlite, { schema });
  return { db, sqlite };
}
async function initDatabase(passphrase = DEV_PASSPHRASE, dbPath = getDefaultDbPath()) {
  const hexKey = await deriveKey(passphrase);
  return openDatabase(dbPath, hexKey);
}
function getDefaultDbPath() {
  try {
    const { app } = require("electron");
    return path.join(app.getPath("userData"), "psygil.db");
  } catch {
    return path.join(process.cwd(), "data", "psygil.db");
  }
}
const MIGRATIONS = [
  {
    id: "003_case_folder_path",
    description: "Add folder_path column to cases table",
    sql: `ALTER TABLE cases ADD COLUMN folder_path TEXT;`
  },
  {
    id: "004_patient_intake",
    description: "Create patient_intake table for referral/intake data",
    sql: `
      CREATE TABLE IF NOT EXISTS patient_intake (
        intake_id INTEGER PRIMARY KEY AUTOINCREMENT,
        case_id INTEGER NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
        referral_type TEXT NOT NULL DEFAULT 'court'
          CHECK (referral_type IN ('court', 'attorney', 'self', 'walk-in')),
        referral_source TEXT,
        eval_type TEXT,
        presenting_complaint TEXT,
        jurisdiction TEXT,
        charges TEXT,
        attorney_name TEXT,
        report_deadline TEXT,
        status TEXT NOT NULL DEFAULT 'draft'
          CHECK (status IN ('draft', 'complete')),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE (case_id)
      );
      CREATE INDEX IF NOT EXISTS idx_patient_intake_case_id ON patient_intake(case_id);
      CREATE INDEX IF NOT EXISTS idx_patient_intake_status ON patient_intake(status);

      CREATE TRIGGER IF NOT EXISTS tr_patient_intake_updated_at
      AFTER UPDATE ON patient_intake
      FOR EACH ROW
      BEGIN
        UPDATE patient_intake SET updated_at = datetime('now') WHERE intake_id = NEW.intake_id;
      END;
    `
  },
  {
    id: "005_patient_onboarding",
    description: "Create patient_onboarding table for section-based onboarding data",
    sql: `
      CREATE TABLE IF NOT EXISTS patient_onboarding (
        onboarding_id INTEGER PRIMARY KEY AUTOINCREMENT,
        case_id INTEGER NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
        section TEXT NOT NULL
          CHECK (section IN (
            'contact', 'complaints', 'family', 'education',
            'health', 'mental', 'substance', 'legal', 'recent'
          )),
        content TEXT NOT NULL DEFAULT '{}',
        clinician_notes TEXT,
        verified INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'draft'
          CHECK (status IN ('draft', 'complete')),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE (case_id, section)
      );
      CREATE INDEX IF NOT EXISTS idx_patient_onboarding_case_id ON patient_onboarding(case_id);
      CREATE INDEX IF NOT EXISTS idx_patient_onboarding_section ON patient_onboarding(section);
      CREATE INDEX IF NOT EXISTS idx_patient_onboarding_status ON patient_onboarding(status);

      CREATE TRIGGER IF NOT EXISTS tr_patient_onboarding_updated_at
      AFTER UPDATE ON patient_onboarding
      FOR EACH ROW
      BEGIN
        UPDATE patient_onboarding SET updated_at = datetime('now') WHERE onboarding_id = NEW.onboarding_id;
      END;
    `
  }
];
function runMigrations(sqlite) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id TEXT PRIMARY KEY,
      description TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  const applied = new Set(
    sqlite.prepare("SELECT id FROM _migrations").all().map((r) => r.id)
  );
  for (const migration of MIGRATIONS) {
    if (applied.has(migration.id)) continue;
    console.log(`[migrations] Applying: ${migration.id} — ${migration.description}`);
    const tx = sqlite.transaction(() => {
      sqlite.exec(migration.sql);
      sqlite.prepare("INSERT INTO _migrations (id, description) VALUES (?, ?)").run(
        migration.id,
        migration.description
      );
    });
    tx();
    console.log(`[migrations] Applied: ${migration.id}`);
  }
}
let handle = null;
async function initDb() {
  if (handle !== null) return;
  const result = await initDatabase();
  handle = result;
  runMigrations(result.sqlite);
}
function getSqlite() {
  if (handle === null) throw new Error("Database not initialized — call initDb() first");
  return handle.sqlite;
}
const CASE_SUBFOLDERS = [
  "_Inbox",
  "Collateral",
  "Testing",
  "Interviews",
  "Diagnostics",
  "Reports",
  "Archive"
];
function createCase(params) {
  const sqlite = getSqlite();
  const wsPath = loadWorkspacePath();
  if (wsPath === null) {
    throw new Error("No workspace path configured — set workspace before creating cases");
  }
  const folderName = `${params.case_number} ${params.examinee_last_name}, ${params.examinee_first_name}`;
  const folderPath = path.join(wsPath, folderName);
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }
  for (const sub of CASE_SUBFOLDERS) {
    const subPath = path.join(folderPath, sub);
    if (!fs.existsSync(subPath)) {
      fs.mkdirSync(subPath, { recursive: true });
    }
  }
  const stmt = sqlite.prepare(`
    INSERT INTO cases (
      case_number, primary_clinician_user_id,
      examinee_first_name, examinee_last_name, examinee_dob, examinee_gender,
      evaluation_type, referral_source, evaluation_questions,
      case_status, workflow_current_stage, folder_path, notes
    ) VALUES (
      @case_number, @primary_clinician_user_id,
      @examinee_first_name, @examinee_last_name, @examinee_dob, @examinee_gender,
      @evaluation_type, @referral_source, @evaluation_questions,
      'intake', 'gate_1', @folder_path, @notes
    )
  `);
  const result = stmt.run({
    case_number: params.case_number,
    primary_clinician_user_id: params.primary_clinician_user_id,
    examinee_first_name: params.examinee_first_name,
    examinee_last_name: params.examinee_last_name,
    examinee_dob: params.examinee_dob ?? null,
    examinee_gender: params.examinee_gender ?? null,
    evaluation_type: params.evaluation_type ?? null,
    referral_source: params.referral_source ?? null,
    evaluation_questions: params.evaluation_questions ?? null,
    folder_path: folderPath,
    notes: params.notes ?? null
  });
  const caseId = Number(result.lastInsertRowid);
  return getCaseById(caseId);
}
function listCases() {
  const sqlite = getSqlite();
  const rows = sqlite.prepare("SELECT * FROM cases WHERE deleted_at IS NULL AND case_status != ? ORDER BY created_at DESC").all("archived");
  return rows;
}
function getCaseById(caseId) {
  const sqlite = getSqlite();
  const row = sqlite.prepare("SELECT * FROM cases WHERE case_id = ?").get(caseId);
  return row ?? null;
}
function archiveCase(caseId) {
  const sqlite = getSqlite();
  const existing = getCaseById(caseId);
  if (existing === null) {
    throw new Error(`Case ${caseId} not found`);
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  sqlite.prepare("UPDATE cases SET case_status = 'archived', deleted_at = ?, last_modified = ? WHERE case_id = ?").run(now, now, caseId);
  if (existing.folder_path && fs.existsSync(existing.folder_path)) {
    const wsPath = loadWorkspacePath();
    if (wsPath !== null) {
      const archiveRoot = path.join(wsPath, "Archive");
      if (!fs.existsSync(archiveRoot)) {
        fs.mkdirSync(archiveRoot, { recursive: true });
      }
      const folderName = existing.folder_path.split("/").pop();
      const archiveDest = path.join(archiveRoot, folderName);
      try {
        fs.renameSync(existing.folder_path, archiveDest);
        sqlite.prepare("UPDATE cases SET folder_path = ? WHERE case_id = ?").run(archiveDest, caseId);
      } catch (err) {
        console.error(`[cases] Failed to move folder to archive: ${err}`);
      }
    }
  }
  return getCaseById(caseId);
}
function saveIntake(caseId, data) {
  const sqlite = getSqlite();
  sqlite.prepare(`
    INSERT INTO patient_intake (
      case_id, referral_type, referral_source, eval_type,
      presenting_complaint, jurisdiction, charges,
      attorney_name, report_deadline, status
    ) VALUES (
      @case_id, @referral_type, @referral_source, @eval_type,
      @presenting_complaint, @jurisdiction, @charges,
      @attorney_name, @report_deadline, @status
    )
    ON CONFLICT (case_id) DO UPDATE SET
      referral_type = excluded.referral_type,
      referral_source = excluded.referral_source,
      eval_type = excluded.eval_type,
      presenting_complaint = excluded.presenting_complaint,
      jurisdiction = excluded.jurisdiction,
      charges = excluded.charges,
      attorney_name = excluded.attorney_name,
      report_deadline = excluded.report_deadline,
      status = excluded.status
  `).run({
    case_id: caseId,
    referral_type: data.referral_type ?? "court",
    referral_source: data.referral_source ?? null,
    eval_type: data.eval_type ?? null,
    presenting_complaint: data.presenting_complaint ?? null,
    jurisdiction: data.jurisdiction ?? null,
    charges: data.charges ?? null,
    attorney_name: data.attorney_name ?? null,
    report_deadline: data.report_deadline ?? null,
    status: data.status ?? "draft"
  });
  return getIntake(caseId);
}
function getIntake(caseId) {
  const sqlite = getSqlite();
  const row = sqlite.prepare("SELECT * FROM patient_intake WHERE case_id = ?").get(caseId);
  return row ?? null;
}
function saveOnboardingSection(caseId, section, data) {
  const sqlite = getSqlite();
  sqlite.prepare(`
    INSERT INTO patient_onboarding (
      case_id, section, content, clinician_notes, verified, status
    ) VALUES (
      @case_id, @section, @content, @clinician_notes, @verified, @status
    )
    ON CONFLICT (case_id, section) DO UPDATE SET
      content = excluded.content,
      clinician_notes = excluded.clinician_notes,
      verified = excluded.verified,
      status = excluded.status
  `).run({
    case_id: caseId,
    section,
    content: data.content,
    clinician_notes: data.clinician_notes ?? null,
    verified: data.verified ? 1 : 0,
    status: data.status ?? "draft"
  });
  const row = sqlite.prepare("SELECT * FROM patient_onboarding WHERE case_id = ? AND section = ?").get(caseId, section);
  return row;
}
function getOnboardingSections(caseId) {
  const sqlite = getSqlite();
  const rows = sqlite.prepare("SELECT * FROM patient_onboarding WHERE case_id = ? ORDER BY section").all(caseId);
  return rows;
}
const VALID_SUBFOLDERS = [
  "_Inbox",
  "Collateral",
  "Testing",
  "Interviews",
  "Diagnostics",
  "Reports",
  "Archive"
];
async function extractText(filePath, mimeType) {
  try {
    if (mimeType === "application/pdf") {
      const pdfParse = (await import("pdf-parse")).default;
      const buffer = fs.readFileSync(filePath);
      const result = await pdfParse(buffer);
      return result.text || null;
    }
    if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || mimeType === "application/msword") {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value || null;
    }
    if (mimeType.startsWith("text/")) {
      return fs.readFileSync(filePath, "utf-8");
    }
    return null;
  } catch (err) {
    console.error(`[documents] Text extraction failed for ${filePath}:`, err);
    return null;
  }
}
function mimeFromExt(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".doc": "application/msword",
    ".txt": "text/plain",
    ".csv": "text/csv",
    ".rtf": "application/rtf",
    ".vtt": "text/vtt",
    ".json": "application/json"
  };
  return map[ext] ?? "application/octet-stream";
}
function docTypeFromExt(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    ".pdf": "pdf",
    ".docx": "docx",
    ".doc": "docx",
    ".vtt": "transcript_vtt",
    ".mp3": "audio",
    ".wav": "audio",
    ".m4a": "audio"
  };
  return map[ext] ?? "other";
}
async function ingestFile(caseId, filePath, subfolder, uploadedByUserId = 1) {
  const caseRow = getCaseById(caseId);
  if (caseRow === null) {
    throw new Error(`Case ${caseId} not found`);
  }
  if (caseRow.folder_path === null) {
    throw new Error(`Case ${caseId} has no workspace folder`);
  }
  if (!VALID_SUBFOLDERS.includes(subfolder)) {
    throw new Error(`Invalid subfolder: ${subfolder}. Must be one of: ${VALID_SUBFOLDERS.join(", ")}`);
  }
  if (!fs.existsSync(filePath)) {
    throw new Error(`Source file does not exist: ${filePath}`);
  }
  const fileName = path.basename(filePath);
  const destDir = path.join(caseRow.folder_path, subfolder);
  const destPath = path.join(destDir, fileName);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  fs.copyFileSync(filePath, destPath);
  const stat = fs.statSync(destPath);
  const mime = mimeFromExt(filePath);
  const docType = docTypeFromExt(filePath);
  const extractedText = await extractText(destPath, mime);
  const sqlite = getSqlite();
  const stmt = sqlite.prepare(`
    INSERT INTO documents (
      case_id, document_type, original_filename, file_path,
      file_size_bytes, mime_type, uploaded_by_user_id,
      description, indexed_content
    ) VALUES (
      @case_id, @document_type, @original_filename, @file_path,
      @file_size_bytes, @mime_type, @uploaded_by_user_id,
      @description, @indexed_content
    )
  `);
  const result = stmt.run({
    case_id: caseId,
    document_type: docType,
    original_filename: fileName,
    file_path: destPath,
    file_size_bytes: stat.size,
    mime_type: mime,
    uploaded_by_user_id: uploadedByUserId,
    description: null,
    indexed_content: extractedText
  });
  const docId = Number(result.lastInsertRowid);
  return getDocument(docId);
}
function getDocument(docId) {
  const sqlite = getSqlite();
  const row = sqlite.prepare("SELECT * FROM documents WHERE document_id = ?").get(docId);
  return row ?? null;
}
function listDocuments(caseId) {
  const sqlite = getSqlite();
  const rows = sqlite.prepare("SELECT * FROM documents WHERE case_id = ? ORDER BY upload_date DESC").all(caseId);
  return rows;
}
function deleteDocument(docId) {
  const sqlite = getSqlite();
  const existing = getDocument(docId);
  if (existing === null) {
    throw new Error(`Document ${docId} not found`);
  }
  sqlite.prepare("DELETE FROM documents WHERE document_id = ?").run(docId);
}
function ok(data) {
  return { status: "success", data };
}
function fail(error_code, message) {
  return { status: "error", error_code, message };
}
function registerCasesHandlers() {
  electron.ipcMain.handle(
    "cases:list",
    (_event, _params) => {
      try {
        const cases2 = listCases();
        return ok({ cases: cases2, total: cases2.length });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to list cases";
        return fail("CASES_LIST_FAILED", message);
      }
    }
  );
  electron.ipcMain.handle(
    "cases:get",
    (_event, params) => {
      try {
        const row = getCaseById(params.case_id);
        if (row === null) {
          return fail("CASE_NOT_FOUND", `Case ${params.case_id} not found`);
        }
        return ok(row);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to get case";
        return fail("CASES_GET_FAILED", message);
      }
    }
  );
  electron.ipcMain.handle(
    "cases:create",
    (_event, params) => {
      try {
        const row = createCase(params);
        return ok(row);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to create case";
        return fail("CASES_CREATE_FAILED", message);
      }
    }
  );
  electron.ipcMain.handle(
    "cases:archive",
    (_event, params) => {
      try {
        const row = archiveCase(params.case_id);
        return ok(row);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to archive case";
        return fail("CASES_ARCHIVE_FAILED", message);
      }
    }
  );
}
function registerIntakeHandlers() {
  electron.ipcMain.handle(
    "intake:save",
    (_event, params) => {
      try {
        const row = saveIntake(params.case_id, params.data);
        return ok(row);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to save intake";
        return fail("INTAKE_SAVE_FAILED", message);
      }
    }
  );
  electron.ipcMain.handle(
    "intake:get",
    (_event, params) => {
      try {
        const row = getIntake(params.case_id);
        return ok(row);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to get intake";
        return fail("INTAKE_GET_FAILED", message);
      }
    }
  );
}
function registerOnboardingHandlers() {
  electron.ipcMain.handle(
    "onboarding:save",
    (_event, params) => {
      try {
        const row = saveOnboardingSection(params.case_id, params.section, params.data);
        return ok(row);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to save onboarding section";
        return fail("ONBOARDING_SAVE_FAILED", message);
      }
    }
  );
  electron.ipcMain.handle(
    "onboarding:get",
    (_event, params) => {
      try {
        const rows = getOnboardingSections(params.case_id);
        return ok(rows);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to get onboarding sections";
        return fail("ONBOARDING_GET_FAILED", message);
      }
    }
  );
}
function registerDbHandlers() {
  electron.ipcMain.handle(
    "db:health",
    () => ok({ connected: true, encrypted: true, version: "0.1.0" })
  );
}
function registerAuthHandlers() {
  electron.ipcMain.handle(
    "auth:login",
    async (event) => {
      try {
        const parentWindow = electron.BrowserWindow.fromWebContents(event.sender);
        const result = await performLogin(parentWindow);
        if (!result.success) {
          return fail("LOGIN_FAILED", result.error ?? "Login failed");
        }
        const license = checkLicense();
        return ok({
          is_authenticated: true,
          user_id: result.userId ?? "",
          user_name: result.userName ?? "",
          user_email: result.email ?? "",
          is_active: license.is_active
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Login failed";
        return fail("LOGIN_FAILED", message);
      }
    }
  );
  electron.ipcMain.handle(
    "auth:getStatus",
    () => ok(getAuthStatus())
  );
  electron.ipcMain.handle(
    "auth:logout",
    (event) => {
      try {
        const parentWindow = electron.BrowserWindow.fromWebContents(event.sender);
        const result = performLogout(parentWindow);
        return ok(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Logout failed";
        return fail("LOGOUT_FAILED", message);
      }
    }
  );
}
function registerConfigHandlers() {
  electron.ipcMain.handle(
    "config:get",
    (_event, _params) => ok({ config: {} })
  );
  electron.ipcMain.handle(
    "config:set",
    (_event, _params) => ok({ updated_config: {} })
  );
}
function registerWorkspaceHandlers() {
  electron.ipcMain.handle(
    "workspace:getPath",
    () => ok(loadWorkspacePath())
  );
  electron.ipcMain.handle(
    "workspace:setPath",
    (_event, path2) => {
      try {
        saveWorkspacePath(path2);
        createFolderStructure(path2);
        watchWorkspace(path2);
        return ok(void 0);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to set workspace path";
        return fail("WORKSPACE_SET_FAILED", message);
      }
    }
  );
  electron.ipcMain.handle(
    "workspace:getTree",
    () => {
      const wsPath = loadWorkspacePath();
      if (wsPath === null) {
        return fail("NO_WORKSPACE", "No workspace path configured");
      }
      try {
        return ok(getWorkspaceTree(wsPath));
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to read workspace tree";
        return fail("TREE_READ_FAILED", message);
      }
    }
  );
  electron.ipcMain.handle(
    "workspace:openInFinder",
    (_event, path2) => {
      electron.shell.openPath(path2);
      return ok(void 0);
    }
  );
  electron.ipcMain.handle(
    "workspace:pickFolder",
    async (event) => {
      const parentWindow = electron.BrowserWindow.fromWebContents(event.sender);
      const result = await electron.dialog.showOpenDialog(parentWindow, {
        title: "Choose Workspace Folder",
        properties: ["openDirectory", "createDirectory"],
        buttonLabel: "Choose"
      });
      if (result.canceled || result.filePaths.length === 0) {
        return ok(null);
      }
      return ok(result.filePaths[0]);
    }
  );
  electron.ipcMain.handle(
    "workspace:getDefaultPath",
    () => ok(getDefaultWorkspacePath())
  );
}
function registerDocumentHandlers() {
  electron.ipcMain.handle(
    "documents:ingest",
    async (_event, params) => {
      try {
        const row = await ingestFile(params.case_id, params.file_path, params.subfolder);
        return ok(row);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to ingest file";
        return fail("DOCUMENT_INGEST_FAILED", message);
      }
    }
  );
  electron.ipcMain.handle(
    "documents:list",
    (_event, params) => {
      try {
        const rows = listDocuments(params.case_id);
        return ok(rows);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to list documents";
        return fail("DOCUMENTS_LIST_FAILED", message);
      }
    }
  );
  electron.ipcMain.handle(
    "documents:get",
    (_event, params) => {
      try {
        const row = getDocument(params.document_id);
        return ok(row);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to get document";
        return fail("DOCUMENTS_GET_FAILED", message);
      }
    }
  );
  electron.ipcMain.handle(
    "documents:delete",
    (_event, params) => {
      try {
        deleteDocument(params.document_id);
        return ok(void 0);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to delete document";
        return fail("DOCUMENTS_DELETE_FAILED", message);
      }
    }
  );
  electron.ipcMain.handle(
    "documents:pickFile",
    async (event) => {
      const parentWindow = electron.BrowserWindow.fromWebContents(event.sender);
      const result = await electron.dialog.showOpenDialog(parentWindow, {
        title: "Select Document to Upload",
        properties: ["openFile"],
        filters: [
          { name: "Documents", extensions: ["pdf", "docx", "doc", "txt", "csv", "rtf"] },
          { name: "All Files", extensions: ["*"] }
        ]
      });
      if (result.canceled || result.filePaths.length === 0) {
        return ok(null);
      }
      return ok(result.filePaths[0]);
    }
  );
}
function registerPiiHandlers() {
  electron.ipcMain.handle(
    "pii:detect",
    async (_event, params) => {
      try {
        const entities = await detect(params.text);
        return ok({ entities });
      } catch (e) {
        const message = e instanceof Error ? e.message : "PII detection failed";
        return fail("PII_DETECT_FAILED", message);
      }
    }
  );
  electron.ipcMain.handle(
    "pii:batchDetect",
    async (_event, params) => {
      try {
        const results = await batchDetect(params.texts);
        return ok({ results });
      } catch (e) {
        const message = e instanceof Error ? e.message : "PII batch detection failed";
        return fail("PII_BATCH_DETECT_FAILED", message);
      }
    }
  );
}
function registerAllHandlers() {
  registerCasesHandlers();
  registerIntakeHandlers();
  registerOnboardingHandlers();
  registerDbHandlers();
  registerAuthHandlers();
  registerConfigHandlers();
  registerDocumentHandlers();
  registerPiiHandlers();
  registerWorkspaceHandlers();
}
electron.protocol.registerSchemesAsPrivileged([
  {
    scheme: "psygil",
    privileges: {
      standard: true,
      secure: true,
      allowServiceWorkers: false,
      supportFetchAPI: false,
      corsEnabled: false
    }
  }
]);
function createWindow() {
  const win = new electron.BrowserWindow({
    width: 1440,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });
  if (process.env.NODE_ENV === "development") {
    win.webContents.openDevTools();
  }
  if (process.env["ELECTRON_RENDERER_URL"]) {
    win.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    win.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
  return win;
}
electron.app.whenReady().then(async () => {
  electron.app.setAsDefaultProtocolClient("psygil");
  await initDb();
  registerAllHandlers();
  const wsPath = loadWorkspacePath();
  if (wsPath !== null) {
    watchWorkspace(wsPath);
  }
  createWindow();
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    stopWatcher();
    electron.app.quit();
  }
});
electron.app.on("before-quit", () => {
  stopWatcher();
});
