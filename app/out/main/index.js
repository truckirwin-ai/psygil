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
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const electron = require("electron");
const url = require("url");
const path = require("path");
const node_crypto = require("node:crypto");
const fs = require("fs");
const chokidar = require("chokidar");
const Database = require("better-sqlite3");
const betterSqlite3 = require("drizzle-orm/better-sqlite3");
const argon2 = require("argon2");
const drizzleOrm = require("drizzle-orm");
const sqliteCore = require("drizzle-orm/sqlite-core");
const net = require("net");
const crypto = require("crypto");
const child_process = require("child_process");
const util = require("util");
const os = require("os");
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
const path__namespace = /* @__PURE__ */ _interopNamespaceDefault(path);
const fs__namespace = /* @__PURE__ */ _interopNamespaceDefault(fs);
const net__namespace = /* @__PURE__ */ _interopNamespaceDefault(net);
const TOKEN_KEYS = {
  ID_TOKEN: "psygil_id_token",
  ACCESS_TOKEN: "psygil_access_token",
  REFRESH_TOKEN: "psygil_refresh_token"
};
let currentSession = null;
function encryptAndStore(key, value) {
  if (!electron.safeStorage.isEncryptionAvailable()) {
    throw new Error("Encryption not available, cannot store tokens securely");
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
    const handleCallback = async (url2) => {
      try {
        const callbackUrl = new URL(url2);
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
    authWindow.webContents.on("will-navigate", (_event, url2) => {
      if (url2.startsWith("psygil://")) {
        void handleCallback(url2);
      }
    });
    authWindow.webContents.on("will-redirect", (_event, url2) => {
      if (url2.startsWith("psygil://")) {
        void handleCallback(url2);
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
const diagnosticDecisions = sqliteCore.sqliteTable("diagnostic_decisions", {
  decision_id: sqliteCore.integer("decision_id").primaryKey({ autoIncrement: true }),
  case_id: sqliteCore.integer("case_id").notNull().references(() => cases.case_id, { onDelete: "cascade" }),
  diagnosis_key: sqliteCore.text("diagnosis_key").notNull(),
  icd_code: sqliteCore.text("icd_code").notNull().default(""),
  diagnosis_name: sqliteCore.text("diagnosis_name").notNull(),
  decision: sqliteCore.text("decision").notNull(),
  // CHECK: render | rule_out | defer
  clinician_notes: sqliteCore.text("clinician_notes").notNull().default(""),
  decided_at: sqliteCore.text("decided_at").notNull().default(drizzleOrm.sql`CURRENT_TIMESTAMP`),
  updated_at: sqliteCore.text("updated_at").notNull().default(drizzleOrm.sql`CURRENT_TIMESTAMP`)
}, (table) => [
  sqliteCore.uniqueIndex("idx_diagnostic_decisions_unique").on(table.case_id, table.diagnosis_key),
  sqliteCore.index("idx_diagnostic_decisions_case_id").on(table.case_id),
  sqliteCore.index("idx_diagnostic_decisions_decision").on(table.decision)
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
  diagnosticDecisions,
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
    const userData = app.getPath("userData");
    const setupConfigPath = path.join(userData, "psygil-setup.json");
    const fs2 = require("fs");
    if (fs2.existsSync(setupConfigPath)) {
      try {
        const raw = fs2.readFileSync(setupConfigPath, "utf-8");
        const parsed = JSON.parse(raw);
        const projectRoot = parsed.storage?.projectRoot;
        if (typeof projectRoot === "string" && projectRoot.length > 0) {
          return path.join(projectRoot, ".psygil", "psygil.db");
        }
      } catch {
      }
    }
    return path.join(userData, "psygil.db");
  } catch {
    return path.join(process.cwd(), "data", "psygil.db");
  }
}
const PROTOTYPE_CASE_UPDATES = [
  { num: "2026-0147", stage: "gate_3", status: "in_progress", eval_type: "CST", referral: "Court", deadline: "2026-04-15", charges: "Assault 1st (F3), Criminal Mischief (M1)", jurisdiction: "Denver District Court" },
  { num: "2026-0152", stage: "gate_1", status: "in_progress", eval_type: "Custody", referral: "Attorney", deadline: "2026-04-20", charges: null, jurisdiction: "Arapahoe County" },
  { num: "2026-0158", stage: "gate_3", status: "in_progress", eval_type: "Risk", referral: "Court", deadline: "2026-04-01", charges: "Stalking (F5), Menacing (M1)", jurisdiction: "Jefferson County" },
  { num: "2026-0161", stage: "finalized", status: "completed", eval_type: "PTSD Dx", referral: "Attorney", deadline: "2026-04-10", charges: null, jurisdiction: null },
  { num: "2026-0165", stage: "gate_1", status: "in_progress", eval_type: "ADHD Dx", referral: "Physician", deadline: "2026-04-25", charges: null, jurisdiction: null },
  { num: "2025-0989", stage: "finalized", status: "completed", eval_type: "Malingering", referral: "Court", deadline: "2026-03-20", charges: "Fraud (F4)", jurisdiction: "Adams County" },
  { num: "2025-0988", stage: "finalized", status: "completed", eval_type: "Fitness", referral: "Court", deadline: "2026-03-15", charges: "Theft (M1)", jurisdiction: "Boulder County" },
  { num: "2025-0987", stage: "finalized", status: "completed", eval_type: "Capacity", referral: "Attorney", deadline: "2026-02-28", charges: null, jurisdiction: "El Paso County" },
  { num: "2026-0170", stage: "gate_1", status: "intake", eval_type: "CST", referral: "Court", deadline: "2026-05-01", charges: "Murder 2nd (F2)", jurisdiction: "Denver District Court" },
  { num: "2026-0171", stage: "gate_2", status: "in_progress", eval_type: "CST", referral: "Court", deadline: "2026-04-28", charges: "Arson 1st (F3)", jurisdiction: "Arapahoe County" },
  { num: "2026-0172", stage: "finalized", status: "completed", eval_type: "Risk", referral: "Court", deadline: "2026-03-15", charges: "Sexual Assault (F3)", jurisdiction: "Denver District Court" },
  { num: "2026-0173", stage: "gate_3", status: "in_progress", eval_type: "CST", referral: "Court", deadline: "2026-04-12", charges: "Robbery (F4), Assault 3rd (M1)", jurisdiction: "Adams County" },
  { num: "2026-0174", stage: "gate_2", status: "in_progress", eval_type: "Custody", referral: "Court", deadline: "2026-05-10", charges: null, jurisdiction: "Jefferson County Family Court" },
  { num: "2026-0175", stage: "gate_3", status: "in_progress", eval_type: "PTSD Dx", referral: "Attorney", deadline: "2026-04-05", charges: null, jurisdiction: null },
  { num: "2026-0176", stage: "finalized", status: "completed", eval_type: "Malingering", referral: "Insurance", deadline: "2026-03-28", charges: null, jurisdiction: null },
  { num: "2026-0177", stage: "finalized", status: "completed", eval_type: "CST", referral: "Court", deadline: "2026-03-10", charges: "Assault 2nd (F4)", jurisdiction: "Denver District Court" },
  { num: "2026-0178", stage: "gate_3", status: "in_progress", eval_type: "Capacity", referral: "Attorney", deadline: "2026-04-18", charges: null, jurisdiction: "Douglas County Probate" },
  { num: "2026-0179", stage: "gate_1", status: "in_progress", eval_type: "Risk", referral: "Court", deadline: "2026-05-05", charges: "Menacing (F5), Harassment (M3)", jurisdiction: "Denver District Court" },
  { num: "2026-0180", stage: "finalized", status: "completed", eval_type: "CST", referral: "Court", deadline: "2026-03-25", charges: "DUI (M1), Eluding (F5)", jurisdiction: "Adams County" },
  { num: "2026-0181", stage: "gate_3", status: "in_progress", eval_type: "Fitness", referral: "Court", deadline: "2026-04-08", charges: "Forgery (F5)", jurisdiction: "Boulder County" },
  { num: "2026-0182", stage: "finalized", status: "completed", eval_type: "PTSD Dx", referral: "Attorney", deadline: "2026-03-22", charges: null, jurisdiction: null },
  { num: "2026-0183", stage: "gate_1", status: "intake", eval_type: "CST", referral: "Court", deadline: "2026-05-12", charges: "Assault 1st (F3), Kidnapping (F2)", jurisdiction: "Denver District Court" },
  { num: "2026-0184", stage: "gate_3", status: "in_progress", eval_type: "Custody", referral: "Court", deadline: "2026-04-15", charges: null, jurisdiction: "El Paso County Family Court" },
  { num: "2026-0185", stage: "finalized", status: "completed", eval_type: "Risk", referral: "Court", deadline: "2026-03-05", charges: "Domestic Violence (F4)", jurisdiction: "Arapahoe County" },
  { num: "2026-0186", stage: "finalized", status: "completed", eval_type: "ADHD Dx", referral: "Physician", deadline: "2026-03-30", charges: null, jurisdiction: null },
  { num: "2026-0187", stage: "gate_2", status: "in_progress", eval_type: "CST", referral: "Court", deadline: "2026-05-08", charges: "Criminal Mischief (F4), Trespass (M3)", jurisdiction: "Jefferson County" },
  { num: "2026-0188", stage: "gate_3", status: "in_progress", eval_type: "Malingering", referral: "Court", deadline: "2026-04-02", charges: "Theft (F4)", jurisdiction: "Denver District Court" },
  { num: "2026-0189", stage: "gate_1", status: "intake", eval_type: "Risk", referral: "Court", deadline: "2026-05-15", charges: "Harassment (M1), Stalking (M1)", jurisdiction: "Adams County" },
  { num: "2026-0190", stage: "finalized", status: "completed", eval_type: "Fitness", referral: "Court", deadline: "2026-03-18", charges: "DUI (M1)", jurisdiction: "Weld County" },
  { num: "2026-0191", stage: "gate_3", status: "in_progress", eval_type: "CST", referral: "Court", deadline: "2026-04-08", charges: "Assault 2nd (F4), Resisting Arrest (M2)", jurisdiction: "Denver District Court" }
];
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
  },
  {
    id: "006_update_prototype_case_stages",
    description: "Update synced prototype cases with correct stages, eval types, and metadata",
    sql: "SELECT 1"
    // placeholder, real logic runs in runMigrations below
  },
  {
    id: "007_six_stage_pipeline",
    description: "Migrate workflow_current_stage from gate system to 6-stage pipeline",
    sql: "SELECT 1"
    // placeholder, real logic runs in runMigrations below
  },
  {
    id: "008_expand_intake_referral_types",
    description: "Add insurance and physician referral types to patient_intake",
    sql: "SELECT 1"
    // placeholder, recreates table with expanded CHECK
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
    console.log(`[migrations] Applying: ${migration.id}, ${migration.description}`);
    const tx = sqlite.transaction(() => {
      if (migration.id === "007_six_stage_pipeline") {
        sqlite.exec(`
          DROP VIEW IF EXISTS v_active_cases;
          DROP VIEW IF EXISTS v_case_progress;
          DROP VIEW IF EXISTS v_diagnostic_queue;
          DROP VIEW IF EXISTS v_finalization_queue;
          DROP VIEW IF EXISTS v_user_case_assignments;
          DROP VIEW IF EXISTS v_active_file_locks;
          DROP VIEW IF EXISTS v_case_sync_status;
        `);
        const cols = sqlite.pragma("table_info(cases)");
        const colNames = cols.map((c) => c.name);
        try {
          sqlite.exec("DROP TABLE IF EXISTS cases_new;");
        } catch {
        }
        sqlite.exec(`
          CREATE TABLE IF NOT EXISTS cases_new (
            case_id INTEGER PRIMARY KEY AUTOINCREMENT,
            case_number TEXT NOT NULL UNIQUE,
            primary_clinician_user_id INTEGER NOT NULL REFERENCES users(user_id),
            examinee_first_name TEXT NOT NULL,
            examinee_last_name TEXT NOT NULL,
            examinee_dob TEXT,
            examinee_gender TEXT,
            cultural_context TEXT,
            linguistic_context TEXT,
            evaluation_type TEXT,
            practice_profile_id INTEGER REFERENCES practice_profiles(profile_id),
            referral_source TEXT,
            evaluation_questions TEXT,
            case_status TEXT NOT NULL DEFAULT 'intake'
              CHECK (case_status IN ('intake', 'in_progress', 'completed', 'archived')),
            workflow_current_stage TEXT DEFAULT 'onboarding'
              CHECK (workflow_current_stage IN ('onboarding', 'testing', 'interview', 'diagnostics', 'review', 'complete')),
            created_at TEXT NOT NULL DEFAULT (date('now')),
            last_modified TEXT DEFAULT (date('now')),
            completed_at TEXT,
            notes TEXT,
            folder_path TEXT,
            deleted_at TEXT,
            practice_id INTEGER REFERENCES practice_config(practice_id)
          );
        `);
        const newCols = sqlite.pragma("table_info(cases_new)").map((c) => c.name);
        const sharedCols = colNames.filter((c) => newCols.includes(c));
        const selectExprs = sharedCols.map((col) => {
          if (col === "workflow_current_stage") {
            return `CASE workflow_current_stage
              WHEN 'gate_1' THEN 'onboarding'
              WHEN 'gate_2' THEN 'interview'
              WHEN 'gate_3' THEN 'review'
              WHEN 'finalized' THEN 'complete'
              ELSE COALESCE(workflow_current_stage, 'onboarding')
            END AS workflow_current_stage`;
          }
          return col;
        });
        const insertCols = sharedCols.join(", ");
        const selectList = selectExprs.join(", ");
        sqlite.exec(`INSERT INTO cases_new (${insertCols}) SELECT ${selectList} FROM cases;`);
        sqlite.exec(`DROP TABLE cases;`);
        sqlite.exec(`ALTER TABLE cases_new RENAME TO cases;`);
        sqlite.exec(`
          CREATE INDEX IF NOT EXISTS idx_cases_primary_clinician_user_id ON cases(primary_clinician_user_id);
          CREATE INDEX IF NOT EXISTS idx_cases_case_status ON cases(case_status);
          CREATE INDEX IF NOT EXISTS idx_cases_workflow_current_stage ON cases(workflow_current_stage);
          CREATE INDEX IF NOT EXISTS idx_cases_created_at ON cases(created_at);
          CREATE INDEX IF NOT EXISTS idx_cases_case_number ON cases(case_number);
        `);
        sqlite.exec(`
          CREATE TABLE IF NOT EXISTS data_confirmation (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            case_id INTEGER NOT NULL REFERENCES cases(case_id),
            category_id TEXT NOT NULL,
            status TEXT NOT NULL CHECK(status IN ('unreviewed', 'confirmed', 'corrected', 'flagged')),
            notes TEXT DEFAULT '',
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(case_id, category_id)
          );
          CREATE INDEX IF NOT EXISTS idx_data_confirmation_case_id ON data_confirmation(case_id);
        `);
        console.log("[migrations] Migrated workflow_current_stage to 6-stage pipeline");
      } else if (migration.id === "006_update_prototype_case_stages") {
        const cols = sqlite.pragma("table_info(cases)").map((c) => c.name);
        const hasCharges = cols.includes("charges");
        const hasJurisdiction = cols.includes("jurisdiction");
        const hasEvalType = cols.includes("evaluation_type");
        for (const c of PROTOTYPE_CASE_UPDATES) {
          let sql = `UPDATE cases SET workflow_current_stage = ?, case_status = ?, referral_source = ?`;
          const params = [c.stage, c.status, c.referral];
          if (hasEvalType) {
            sql += `, evaluation_type = ?`;
            params.push(c.eval_type);
          }
          if (hasCharges) {
            sql += `, charges = ?`;
            params.push(c.charges ?? null);
          }
          if (hasJurisdiction) {
            sql += `, jurisdiction = ?`;
            params.push(c.jurisdiction ?? null);
          }
          sql += ` WHERE case_number = ?`;
          params.push(c.num);
          sqlite.prepare(sql).run(...params);
        }
      } else if (migration.id === "008_expand_intake_referral_types") {
        const intakeCols = sqlite.pragma("table_info(patient_intake)").map((c) => c.name);
        if (intakeCols.length > 0) {
          try {
            sqlite.exec("DROP TABLE IF EXISTS patient_intake_new;");
          } catch {
          }
          sqlite.exec(`
            CREATE TABLE IF NOT EXISTS patient_intake_new (
              intake_id INTEGER PRIMARY KEY AUTOINCREMENT,
              case_id INTEGER NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
              referral_type TEXT NOT NULL DEFAULT 'court'
                CHECK (referral_type IN ('court', 'attorney', 'self', 'walk-in', 'insurance', 'physician')),
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
            INSERT INTO patient_intake_new SELECT * FROM patient_intake;
            DROP TABLE patient_intake;
            ALTER TABLE patient_intake_new RENAME TO patient_intake;
            CREATE INDEX IF NOT EXISTS idx_patient_intake_case_id ON patient_intake(case_id);
            CREATE INDEX IF NOT EXISTS idx_patient_intake_status ON patient_intake(status);
          `);
          console.log("[migrations] Expanded patient_intake referral types");
        }
      } else {
        sqlite.exec(migration.sql);
      }
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
  const tableCount = result.sqlite.prepare("SELECT count(*) as n FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").get().n;
  if (tableCount === 0) {
    const { runBaseMigration } = await Promise.resolve().then(() => require("./migrate-CP3Kt-wA.js"));
    runBaseMigration(result.sqlite);
  }
  runMigrations(result.sqlite);
  try {
    const { ensureViewsAndTriggers } = await Promise.resolve().then(() => require("./migrate-CP3Kt-wA.js"));
    ensureViewsAndTriggers(result.sqlite);
  } catch {
    console.warn("[db] Failed to ensure views/triggers (non-fatal)");
  }
}
function getSqlite() {
  if (handle === null) throw new Error("Database not initialized, call initDb() first");
  return handle.sqlite;
}
const CASE_SUBFOLDERS$1 = [
  "_Inbox",
  "Collateral",
  "Testing",
  "Interviews",
  "Diagnostics",
  "Reports",
  "Archive"
];
const STAGE_ORDER$1 = ["onboarding", "testing", "interview", "diagnostics", "review", "complete"];
const SUBFOLDER_TO_STAGE = {
  "_Inbox": "onboarding",
  "Collateral": "onboarding",
  "Testing": "testing",
  "Interviews": "interview",
  "Diagnostics": "diagnostics",
  "Reports": "review"
  // draft reports = review stage
  // 'Archive' doesn't map to a stage, it's housekeeping
};
const CASE_FOLDER_PATTERN = /^(\d{4}-\d{4})\s+([^,]+),\s+(.+)$/;
let _malformedFolders = [];
function getMalformedFolders() {
  return _malformedFolders;
}
function scanCaseFolder(folderPath) {
  const subfolderCounts = {};
  let totalFiles = 0;
  let hasSubfolders = false;
  let entries;
  try {
    entries = fs.readdirSync(folderPath);
  } catch {
    return { inferredStage: "onboarding", inferredStatus: "intake", fileCount: 0, subfolderCounts: {}, hasSubfolders: false };
  }
  for (const entry of entries) {
    if (entry.startsWith(".")) continue;
    const entryPath = path.join(folderPath, entry);
    try {
      if (!fs.statSync(entryPath).isDirectory()) {
        totalFiles++;
        continue;
      }
    } catch {
      continue;
    }
    hasSubfolders = true;
    let subCount = 0;
    try {
      const subEntries = fs.readdirSync(entryPath);
      for (const se of subEntries) {
        if (se.startsWith(".")) continue;
        try {
          if (!fs.statSync(path.join(entryPath, se)).isDirectory()) {
            subCount++;
          }
        } catch {
        }
      }
    } catch {
    }
    subfolderCounts[entry] = subCount;
    totalFiles += subCount;
  }
  let inferredStage = "onboarding";
  let deepestIndex = 0;
  const reportCount = subfolderCounts["Reports"] ?? 0;
  const hasFinalReport = reportCount > 0 && (() => {
    try {
      const reportEntries = fs.readdirSync(path.join(folderPath, "Reports"));
      return reportEntries.some((f) => /^Final_Report|_FINAL|_sealed|_signed/i.test(f));
    } catch {
      return false;
    }
  })();
  if (hasFinalReport) {
    inferredStage = "complete";
    deepestIndex = 5;
  } else {
    for (const [subfolder, stage] of Object.entries(SUBFOLDER_TO_STAGE)) {
      const count = subfolderCounts[subfolder] ?? 0;
      if (count > 0) {
        const stageIdx = STAGE_ORDER$1.indexOf(stage);
        if (stageIdx > deepestIndex) {
          deepestIndex = stageIdx;
          inferredStage = stage;
        }
      }
    }
  }
  const inferredStatus = inferredStage === "onboarding" && totalFiles <= 1 ? "intake" : inferredStage === "complete" ? "completed" : "in_progress";
  return { inferredStage, inferredStatus, fileCount: totalFiles, subfolderCounts, hasSubfolders };
}
function syncWorkspaceToDB(wsPath) {
  let db;
  try {
    db = getSqlite();
  } catch (e) {
    console.error("[workspace-sync] DB not ready:", e.message);
    return;
  }
  console.log("[workspace-sync] Scanning:", wsPath);
  const existingUser = db.prepare("SELECT user_id FROM users WHERE user_id = 1").get();
  if (!existingUser) {
    db.prepare(`
      INSERT OR IGNORE INTO users (user_id, email, full_name, role, is_active, created_at)
      VALUES (1, 'clinician@psygil.com', 'Dr. Robert Irwin', 'psychologist', 1, CURRENT_DATE)
    `).run();
  }
  const casesRoot = path.join(wsPath, "cases");
  const scanRoot = fs.existsSync(casesRoot) ? casesRoot : wsPath;
  let entries;
  try {
    entries = fs.readdirSync(scanRoot);
  } catch {
    return;
  }
  const malformed = [];
  let synced = 0;
  let updated = 0;
  const selectCase = db.prepare("SELECT case_id, workflow_current_stage, case_status FROM cases WHERE case_number = ?");
  const insertCase = db.prepare(`
    INSERT INTO cases (
      case_number, primary_clinician_user_id,
      examinee_first_name, examinee_last_name,
      case_status, workflow_current_stage,
      folder_path, created_at
    ) VALUES (?, 1, ?, ?, ?, ?, ?, CURRENT_DATE)
  `);
  const updateCaseMetadata = db.prepare(`
    UPDATE cases SET
      workflow_current_stage = ?,
      case_status = ?,
      folder_path = ?,
      last_modified = date('now')
    WHERE case_number = ?
  `);
  for (const entry of entries) {
    if (entry.startsWith("_") || entry.startsWith(".")) continue;
    const fullPath = path.join(scanRoot, entry);
    try {
      if (!fs.statSync(fullPath).isDirectory()) continue;
    } catch {
      continue;
    }
    const match = CASE_FOLDER_PATTERN.exec(entry);
    if (!match) {
      malformed.push({ name: entry, path: fullPath, reason: "bad_name" });
      continue;
    }
    const [, caseNumber, lastName, firstAndMi] = match;
    if (!caseNumber || !lastName || !firstAndMi) continue;
    const parts = firstAndMi.trim().split(/\s+/);
    const firstName = parts[0] ?? firstAndMi.trim();
    const scan = scanCaseFolder(fullPath);
    if (!scan.hasSubfolders) {
      malformed.push({ name: entry, path: fullPath, reason: "no_subfolders" });
    }
    const existing = selectCase.get(caseNumber);
    if (existing) {
      const currentIdx = STAGE_ORDER$1.indexOf(existing.workflow_current_stage);
      const inferredIdx = STAGE_ORDER$1.indexOf(scan.inferredStage);
      if (inferredIdx > currentIdx || existing.case_status !== scan.inferredStatus) {
        const newStage = inferredIdx > currentIdx ? scan.inferredStage : existing.workflow_current_stage;
        const newStatus = scan.inferredStatus;
        updateCaseMetadata.run(newStage, newStatus, fullPath, caseNumber);
        updated++;
      }
    } else {
      try {
        insertCase.run(caseNumber, firstName, lastName.trim(), scan.inferredStatus, scan.inferredStage, fullPath);
        console.log("[workspace-sync] Indexed:", entry);
        synced++;
      } catch (e) {
        console.error("[workspace-sync] Failed to index", entry, e.message);
      }
    }
  }
  _malformedFolders = malformed;
  const allDbCases = db.prepare("SELECT case_id, case_number, folder_path FROM cases").all();
  let orphansRemoved = 0;
  for (const dbCase of allDbCases) {
    if (dbCase.folder_path && !fs.existsSync(dbCase.folder_path)) {
      db.prepare("DELETE FROM cases WHERE case_id = ?").run(dbCase.case_id);
      orphansRemoved++;
      console.log(`[workspace-sync] Orphan removed: ${dbCase.case_number} (${dbCase.folder_path})`);
    }
  }
  if (synced > 0) console.log(`[workspace-sync] Indexed ${synced} new case folders`);
  if (updated > 0) console.log(`[workspace-sync] Updated ${updated} case folders from filesystem`);
  if (orphansRemoved > 0) console.log(`[workspace-sync] Removed ${orphansRemoved} orphan DB records`);
  if (malformed.length > 0) {
    console.log(`[workspace-sync] ${malformed.length} malformed folder(s) detected:`);
    for (const m of malformed) {
      console.log(`  - ${m.name} (${m.reason})`);
    }
  }
}
function syncSingleCase(caseFolderPath) {
  let db;
  try {
    db = getSqlite();
  } catch {
    return;
  }
  const folderName = path.basename(caseFolderPath);
  const match = CASE_FOLDER_PATTERN.exec(folderName);
  if (!match) return;
  const [, caseNumber] = match;
  if (!caseNumber) return;
  if (!fs.existsSync(caseFolderPath)) {
    db.prepare("DELETE FROM cases WHERE case_number = ?").run(caseNumber);
    console.log(`[workspace-sync] ${caseNumber} folder deleted, removed from DB`);
    return;
  }
  const scan = scanCaseFolder(caseFolderPath);
  const existing = db.prepare("SELECT case_id, workflow_current_stage, case_status FROM cases WHERE case_number = ?").get(caseNumber);
  if (!existing) return;
  if (existing.workflow_current_stage !== scan.inferredStage || existing.case_status !== scan.inferredStatus) {
    db.prepare(`
      UPDATE cases SET
        workflow_current_stage = ?,
        case_status = ?,
        last_modified = date('now')
      WHERE case_id = ?
    `).run(scan.inferredStage, scan.inferredStatus, existing.case_id);
    console.log(`[workspace-sync] ${caseNumber} updated: ${existing.workflow_current_stage} → ${scan.inferredStage}, ${existing.case_status} → ${scan.inferredStatus}`);
  }
}
function scaffoldCaseSubfolders(caseFolderPath) {
  const created = [];
  if (!fs.existsSync(caseFolderPath)) {
    fs.mkdirSync(caseFolderPath, { recursive: true });
    created.push(caseFolderPath);
  }
  for (const sub of CASE_SUBFOLDERS$1) {
    const subPath = path.join(caseFolderPath, sub);
    if (!fs.existsSync(subPath)) {
      fs.mkdirSync(subPath, { recursive: true });
      created.push(sub);
    }
  }
  return created;
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
  try {
    const setupPath = path.join(electron.app.getPath("userData"), "psygil-setup.json");
    if (fs.existsSync(setupPath)) {
      const raw = fs.readFileSync(setupPath, "utf-8");
      const parsed = JSON.parse(raw);
      const root = parsed.storage?.projectRoot;
      if (typeof root === "string" && root.length > 0) return root;
    }
  } catch {
  }
  const config = readConfig();
  return config.workspacePath ?? null;
}
function saveWorkspacePath(p) {
  const config = readConfig();
  writeConfig({ ...config, workspacePath: p });
}
function createFolderStructure(root) {
  if (!fs.existsSync(root)) {
    fs.mkdirSync(root, { recursive: true });
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
      /(^|[/\\])\./,
      // dotfiles
      "**/node_modules/**",
      "**/.DS_Store"
    ]
  });
  let syncTimer = null;
  const pendingCaseFolders = /* @__PURE__ */ new Set();
  const broadcastRefresh = () => {
    const windows = electron.BrowserWindow.getAllWindows();
    console.log(`[watcher] broadcasting refresh to ${windows.length} window(s)`);
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send("workspace:file-changed", { event: "sync-complete", path: root });
      }
    }
  };
  const scheduleSync = (filePath) => {
    const relative = filePath.replace(root + "/", "");
    const topLevel = relative.split("/")[0];
    if (!topLevel || topLevel.startsWith("_") || topLevel.startsWith(".")) return;
    const caseFolderPath = path.join(root, topLevel);
    pendingCaseFolders.add(caseFolderPath);
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      console.log(`[watcher] syncing ${pendingCaseFolders.size} case folder(s)`);
      for (const cfp of pendingCaseFolders) {
        syncSingleCase(cfp);
      }
      pendingCaseFolders.clear();
      syncTimer = null;
      broadcastRefresh();
    }, 500);
  };
  watcher.on("ready", () => {
    console.log("[watcher] Ready, watching for changes");
  });
  watcher.on("error", (err) => {
    console.error("[watcher] Error:", err);
  });
  watcher.on("add", (filePath) => {
    console.log(`[watcher] add: ${filePath}`);
    scheduleSync(filePath);
  });
  watcher.on("change", (filePath) => {
    console.log(`[watcher] change: ${filePath}`);
    scheduleSync(filePath);
  });
  watcher.on("unlink", (filePath) => {
    console.log(`[watcher] unlink: ${filePath}`);
    scheduleSync(filePath);
  });
  watcher.on("addDir", (dirPath) => {
    console.log(`[watcher] addDir: ${dirPath}`);
    const parentDir = dirPath.split("/").slice(0, -1).join("/");
    if (parentDir === root) {
      syncWorkspaceToDB(root);
      broadcastRefresh();
    } else {
      scheduleSync(dirPath);
    }
  });
  watcher.on("unlinkDir", (dirPath) => {
    console.log(`[watcher] unlinkDir: ${dirPath}`);
    const parentDir = dirPath.split("/").slice(0, -1).join("/");
    if (parentDir === root) {
      syncWorkspaceToDB(root);
      broadcastRefresh();
    } else {
      scheduleSync(dirPath);
    }
  });
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
async function redact(text, operationId, context) {
  const result = await rpcCall("pii/redact", { text, operationId, context });
  return {
    redactedText: result.redactedText,
    entityCount: result.entityCount,
    typeBreakdown: result.typeBreakdown
  };
}
async function rehydrate(text, operationId) {
  const result = await rpcCall("pii/rehydrate", { text, operationId });
  return {
    fullText: result.fullText,
    unidsReplaced: result.unidsReplaced
  };
}
async function destroyMap(operationId) {
  const result = await rpcCall("pii/destroy", { operationId });
  return {
    destroyed: result.destroyed
  };
}
function createCase(params) {
  const sqlite = getSqlite();
  const wsPath = loadWorkspacePath();
  if (wsPath === null) {
    throw new Error("No workspace path configured, set workspace before creating cases");
  }
  const casesRoot = path.join(wsPath, "cases");
  if (!fs.existsSync(casesRoot)) {
    fs.mkdirSync(casesRoot, { recursive: true });
  }
  const folderName = `${params.case_number} ${params.examinee_last_name}, ${params.examinee_first_name}`;
  const folderPath = path.join(casesRoot, folderName);
  scaffoldCaseSubfolders(folderPath);
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
      'intake', 'onboarding', @folder_path, @notes
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
function updateCase(params) {
  const sqlite = getSqlite();
  const existing = getCaseById(params.case_id);
  if (existing === null) {
    throw new Error(`Case ${params.case_id} not found`);
  }
  const setClauses = [];
  const values = { case_id: params.case_id };
  if (params.evaluation_type !== void 0) {
    setClauses.push("evaluation_type = @evaluation_type");
    values.evaluation_type = params.evaluation_type;
  }
  if (params.workflow_current_stage !== void 0) {
    setClauses.push("workflow_current_stage = @workflow_current_stage");
    values.workflow_current_stage = params.workflow_current_stage;
  }
  if (params.case_status !== void 0) {
    setClauses.push("case_status = @case_status");
    values.case_status = params.case_status;
  }
  if (params.referral_source !== void 0) {
    setClauses.push("referral_source = @referral_source");
    values.referral_source = params.referral_source;
  }
  if (params.evaluation_questions !== void 0) {
    setClauses.push("evaluation_questions = @evaluation_questions");
    values.evaluation_questions = params.evaluation_questions;
  }
  if (params.notes !== void 0) {
    setClauses.push("notes = @notes");
    values.notes = params.notes;
  }
  if (setClauses.length === 0) {
    return existing;
  }
  setClauses.push("last_modified = datetime('now')");
  const sql = `UPDATE cases SET ${setClauses.join(", ")} WHERE case_id = @case_id`;
  sqlite.prepare(sql).run(values);
  console.log(`[cases] Updated case ${params.case_id}: ${setClauses.join(", ")}`);
  return getCaseById(params.case_id);
}
function listCases() {
  const sqlite = getSqlite();
  const cols = sqlite.pragma("table_info(cases)").map((c) => c.name);
  const hasDeletedAt = cols.includes("deleted_at");
  const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='patient_intake'").all();
  const hasIntakeTable = tables.length > 0;
  let query;
  if (hasIntakeTable) {
    const whereClause = hasDeletedAt ? "WHERE c.deleted_at IS NULL AND c.case_status != ?" : "WHERE c.case_status != ?";
    query = `SELECT c.*, COALESCE(c.evaluation_type, pi.eval_type) AS evaluation_type
             FROM cases c LEFT JOIN patient_intake pi ON pi.case_id = c.case_id
             ${whereClause} ORDER BY c.created_at DESC`;
  } else {
    query = hasDeletedAt ? "SELECT * FROM cases WHERE deleted_at IS NULL AND case_status != ? ORDER BY created_at DESC" : "SELECT * FROM cases WHERE case_status != ? ORDER BY created_at DESC";
  }
  const rows = sqlite.prepare(query).all("archived");
  return rows;
}
function getCaseById(caseId) {
  const sqlite = getSqlite();
  const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='patient_intake'").all();
  const hasIntakeTable = tables.length > 0;
  const query = hasIntakeTable ? `SELECT c.*, COALESCE(c.evaluation_type, pi.eval_type) AS evaluation_type
       FROM cases c LEFT JOIN patient_intake pi ON pi.case_id = c.case_id
       WHERE c.case_id = ?` : "SELECT * FROM cases WHERE case_id = ?";
  const row = sqlite.prepare(query).get(caseId);
  return row ?? null;
}
function archiveCase(caseId) {
  const sqlite = getSqlite();
  const existing = getCaseById(caseId);
  if (existing === null) {
    throw new Error(`Case ${caseId} not found`);
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const archCols = sqlite.pragma("table_info(cases)").map((c) => c.name);
  if (archCols.includes("deleted_at") && archCols.includes("last_modified")) {
    sqlite.prepare("UPDATE cases SET case_status = 'archived', deleted_at = ?, last_modified = ? WHERE case_id = ?").run(now, now, caseId);
  } else {
    sqlite.prepare("UPDATE cases SET case_status = 'archived' WHERE case_id = ?").run(caseId);
  }
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
  if (data.eval_type) {
    sqlite.prepare(
      "UPDATE cases SET evaluation_type = ?, last_modified = datetime('now') WHERE case_id = ?"
    ).run(data.eval_type, caseId);
    console.log(`[cases] Synced evaluation_type to '${data.eval_type}' for case ${caseId}`);
  }
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
      const pdfParseModule = await import("pdf-parse");
      const PDFParseCtor = pdfParseModule.PDFParse ?? pdfParseModule.default?.PDFParse;
      if (typeof PDFParseCtor !== "function") {
        console.error("[documents] pdf-parse PDFParse class not available");
        return null;
      }
      const buffer = fs.readFileSync(filePath);
      const parser = new PDFParseCtor({ data: buffer });
      const parsed = await parser.getText();
      if (typeof parsed.text === "string" && parsed.text.length > 0) {
        return parsed.text;
      }
      if (Array.isArray(parsed.pages)) {
        const combined = parsed.pages.map((p) => typeof p.text === "string" ? p.text : "").join("\n");
        return combined.length > 0 ? combined : null;
      }
      return null;
    }
    if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || mimeType === "application/msword") {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value || null;
    }
    if (mimeType.startsWith("text/")) {
      return fs.readFileSync(filePath, "utf-8");
    }
    if (mimeType === "application/rtf" || mimeType === "text/rtf") {
      const raw = fs.readFileSync(filePath, "utf-8");
      return stripRtf(raw);
    }
    return null;
  } catch (err) {
    console.error(`[documents] Text extraction failed for ${filePath}:`, err);
    return null;
  }
}
function stripRtf(rtf) {
  let out = rtf;
  out = out.replace(/\\par[d]?/g, "\n");
  out = out.replace(/\\line/g, "\n");
  out = out.replace(/\\'[0-9a-fA-F]{2}/g, "");
  out = out.replace(/\\u-?\d+\??/g, "");
  out = out.replace(/\\[a-zA-Z]+-?\d* ?/g, "");
  out = out.replace(/[{}]/g, "");
  out = out.replace(/[ \t]+/g, " ").replace(/\n /g, "\n").trim();
  return out;
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
    ".md": "text/markdown",
    ".markdown": "text/markdown",
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
async function registerExistingDocument(caseId, filePath, uploadedByUserId = 1) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`registerExistingDocument: file does not exist: ${filePath}`);
  }
  const fileName = path.basename(filePath);
  const stat = fs.statSync(filePath);
  const mime = mimeFromExt(filePath);
  const docType = docTypeFromExt(filePath);
  const extractedText = await extractText(filePath, mime);
  const sqlite = getSqlite();
  const existing = sqlite.prepare("SELECT document_id FROM documents WHERE case_id = ? AND file_path = ? LIMIT 1").get(caseId, filePath);
  if (existing) {
    sqlite.prepare(
      `UPDATE documents SET
           document_type = @document_type,
           original_filename = @original_filename,
           file_size_bytes = @file_size_bytes,
           mime_type = @mime_type,
           indexed_content = @indexed_content
         WHERE document_id = @document_id`
    ).run({
      document_id: existing.document_id,
      document_type: docType,
      original_filename: fileName,
      file_size_bytes: stat.size,
      mime_type: mime,
      indexed_content: extractedText
    });
    return getDocument(existing.document_id);
  }
  const result = sqlite.prepare(
    `INSERT INTO documents (
         case_id, document_type, original_filename, file_path,
         file_size_bytes, mime_type, uploaded_by_user_id,
         description, indexed_content
       ) VALUES (
         @case_id, @document_type, @original_filename, @file_path,
         @file_size_bytes, @mime_type, @uploaded_by_user_id,
         @description, @indexed_content
       )`
  ).run({
    case_id: caseId,
    document_type: docType,
    original_filename: fileName,
    file_path: filePath,
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
let Document$1, Packer$1, Paragraph$1, HeadingLevel$1, TextRun$1, AlignmentType;
try {
  const m = require("docx");
  Document$1 = m.Document;
  Packer$1 = m.Packer;
  Paragraph$1 = m.Paragraph;
  HeadingLevel$1 = m.HeadingLevel;
  TextRun$1 = m.TextRun;
  AlignmentType = m.AlignmentType;
} catch (err) {
  console.error("[case-docs-writer] Failed to load docx module:", err);
}
function heading(text, level = 2) {
  const hl = level === 1 ? HeadingLevel$1.HEADING_1 : level === 3 ? HeadingLevel$1.HEADING_3 : HeadingLevel$1.HEADING_2;
  return new Paragraph$1({ text, heading: hl, spacing: { after: 120, before: level === 1 ? 0 : 200 } });
}
function labelValue(label, value) {
  if (!value?.trim()) return null;
  return new Paragraph$1({
    children: [
      new TextRun$1({ text: `${label}: `, bold: true, size: 22 }),
      new TextRun$1({ text: value.trim(), size: 22 })
    ],
    spacing: { after: 80 }
  });
}
function bodyText(text) {
  if (!text?.trim()) return null;
  return new Paragraph$1({ text: text.trim(), spacing: { after: 120 }, style: "Normal" });
}
function sectionBlock(title, content) {
  if (!content?.trim()) return [];
  return [
    new Paragraph$1({
      children: [new TextRun$1({ text: title, bold: true, size: 22, color: "333333" })],
      spacing: { after: 60, before: 160 }
    }),
    new Paragraph$1({ text: content.trim(), spacing: { after: 120 } })
  ];
}
function emptyLine() {
  return new Paragraph$1({ text: "", spacing: { after: 80 } });
}
function timestampFooter() {
  const now = (/* @__PURE__ */ new Date()).toISOString().replace("T", " ").slice(0, 19);
  return new Paragraph$1({
    children: [new TextRun$1({ text: `Generated: ${now} UTC, This document is auto-generated from Psygil case data.`, italic: true, color: "888888", size: 18 })],
    spacing: { before: 400 }
  });
}
function compact(items) {
  return items.filter(Boolean);
}
async function writeDocx(children, filePath) {
  if (!Document$1) throw new Error("docx module not loaded");
  const dir = filePath.replace(/\/[^/]+$/, "");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const doc = new Document$1({ sections: [{ children }] });
  const buf = await Packer$1.toBuffer(doc);
  await fs.promises.writeFile(filePath, buf);
  console.log(`[case-docs] Wrote: ${filePath}`);
}
function parseOnboardingSections(rows) {
  const map = {};
  for (const row of rows) {
    try {
      map[row.section] = JSON.parse(row.content);
    } catch {
    }
  }
  return map;
}
function getIntakeRow(caseId) {
  const sqlite = getSqlite();
  const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='patient_intake'").all();
  if (tables.length === 0) return null;
  return sqlite.prepare("SELECT * FROM patient_intake WHERE case_id = ?").get(caseId) ?? null;
}
async function writeIntakeDoc(caseRow, intakeRow, sections) {
  if (!caseRow.folder_path) return null;
  const filePath = path.join(caseRow.folder_path, "_Inbox", "Patient_Intake.docx");
  const demo = sections.contact ?? {};
  const fam = sections.family ?? {};
  const complaints = sections.complaints ?? {};
  const health = sections.health ?? {};
  const substance = sections.substance ?? {};
  const recent = sections.recent ?? {};
  const children = compact([
    heading(`Patient Intake, ${caseRow.examinee_last_name}, ${caseRow.examinee_first_name}`, 1),
    labelValue("Case Number", caseRow.case_number),
    labelValue("Evaluation Type", intakeRow?.eval_type ?? caseRow.evaluation_type),
    labelValue("Date of Birth", caseRow.examinee_dob),
    labelValue("Gender", caseRow.examinee_gender),
    labelValue("Intake Status", intakeRow?.status ?? "N/A"),
    labelValue("Created", caseRow.created_at?.split("T")[0]),
    emptyLine(),
    // Demographics & Contact (from 'contact' section)
    heading("Demographics & Contact", 2),
    labelValue("Primary Language", demo.primary_language),
    labelValue("Marital Status", demo.marital_status),
    labelValue("Living Situation", demo.living_situation),
    labelValue("Dependents", demo.dependents),
    labelValue("Phone", demo.phone),
    labelValue("Email", demo.email),
    labelValue("Address", demo.address),
    labelValue("Emergency Contact", demo.emergency_contact),
    labelValue("Eval Setting", demo.eval_setting),
    // Education & Employment (stored in 'family' section)
    heading("Education & Employment", 2),
    labelValue("Highest Education", fam.highest_education),
    labelValue("Schools Attended", fam.schools_attended),
    labelValue("Employment Status", fam.employment_status),
    labelValue("Current Employer", fam.current_employer),
    labelValue("Military Service", fam.military_service),
    ...sectionBlock("Work History", fam.work_history),
    ...sectionBlock("Academic Experience", fam.academic_experience),
    // Family Background (stored in 'family' section)
    heading("Family Background", 2),
    ...sectionBlock("Family of Origin", fam.family_of_origin),
    ...sectionBlock("Current Family Relationships", fam.current_family_relationships),
    ...sectionBlock("Family Mental Health History", fam.family_mental_health),
    ...sectionBlock("Family Medical History", fam.family_medical_history),
    // Presenting Complaints (from 'complaints' section)
    heading("Presenting Complaints", 2),
    ...sectionBlock("Primary Complaint", complaints.primary_complaint ?? intakeRow?.presenting_complaint),
    ...sectionBlock("Secondary Concerns", complaints.secondary_concerns),
    ...sectionBlock("Onset & Timeline", complaints.onset_timeline),
    // Medical History (from 'health' section)
    heading("Medical History", 2),
    ...sectionBlock("Medical Conditions", health.medical_conditions),
    ...sectionBlock("Current Medications", health.current_medications),
    ...sectionBlock("Surgeries & Hospitalizations", health.surgeries_hospitalizations),
    ...sectionBlock("Head Injuries / Neurological", health.head_injuries),
    ...sectionBlock("Sleep Quality", health.sleep_quality),
    ...sectionBlock("Appetite & Weight Changes", health.appetite_weight),
    ...sectionBlock("Chronic Pain", health.chronic_pain),
    // Mental Health History (also stored in 'health' section)
    heading("Mental Health History", 2),
    ...sectionBlock("Previous Diagnoses", health.previous_diagnoses),
    ...sectionBlock("Previous Treatment", health.previous_treatment),
    ...sectionBlock("Psychiatric Medications", health.psych_medications),
    ...sectionBlock("Suicide / Self-Harm History", health.self_harm_history),
    ...sectionBlock("Violence History", health.violence_history),
    // Substance Use (from 'substance' section)
    heading("Substance Use History", 2),
    ...sectionBlock("Alcohol Use", substance.alcohol_use),
    ...sectionBlock("Drug Use", substance.drug_use),
    ...sectionBlock("Tobacco Use", substance.tobacco_use),
    ...sectionBlock("Substance Use Treatment", substance.substance_treatment),
    // Recent Events & Current Circumstances (from 'recent' section)
    heading("Recent Events & Current Circumstances", 2),
    ...sectionBlock("Events / Circumstances", recent.events_circumstances),
    ...sectionBlock("Current Stressors", recent.current_stressors),
    ...sectionBlock("Goals for Evaluation", recent.goals_evaluation),
    // Referral Summary (brief, full referral doc is separate)
    heading("Referral Summary", 2),
    labelValue("Referral Source", intakeRow?.referral_source ?? caseRow.referral_source),
    labelValue("Referral Type", intakeRow?.referral_type),
    labelValue("Jurisdiction / Case Number", intakeRow?.jurisdiction),
    ...sectionBlock("Charges / Legal Matter", intakeRow?.charges),
    labelValue("Attorney", intakeRow?.attorney_name),
    labelValue("Report Deadline", intakeRow?.report_deadline),
    ...sectionBlock("Presenting Complaint (Referral)", intakeRow?.presenting_complaint),
    timestampFooter()
  ]);
  await writeDocx(children, filePath);
  return filePath;
}
async function writeReferralDoc(caseRow, intakeRow, sections) {
  if (!caseRow.folder_path) return null;
  const filePath = path.join(caseRow.folder_path, "Collateral", "Referral_Information.docx");
  const legal = sections.legal ?? {};
  const refNotes = sections.referral_notes ?? {};
  const recent = sections.recent ?? {};
  const complaints = sections.complaints ?? {};
  const health = sections.health ?? {};
  const children = compact([
    heading(`Referral Information, ${caseRow.examinee_last_name}, ${caseRow.examinee_first_name}`, 1),
    labelValue("Case Number", caseRow.case_number),
    labelValue("Evaluation Type", intakeRow?.eval_type ?? caseRow.evaluation_type),
    labelValue("Date of Birth", caseRow.examinee_dob),
    labelValue("Gender", caseRow.examinee_gender),
    emptyLine(),
    // Referral context
    heading("Referral Details", 2),
    labelValue("Referral Source", intakeRow?.referral_source ?? caseRow.referral_source),
    labelValue("Referral Type", intakeRow?.referral_type),
    labelValue("Jurisdiction / Case Number", intakeRow?.jurisdiction),
    labelValue("Attorney", intakeRow?.attorney_name),
    labelValue("Report Deadline", intakeRow?.report_deadline),
    ...sectionBlock("Charges / Legal Matter", intakeRow?.charges),
    ...sectionBlock("Evaluation Questions", caseRow.evaluation_questions),
    // Reason for referral, the presenting complaint from intake
    heading("Reason for Referral", 2),
    ...sectionBlock("Presenting Complaint", intakeRow?.presenting_complaint ?? complaints.primary_complaint),
    ...sectionBlock("Goals for Evaluation", recent.goals_evaluation),
    // Legal history (from 'legal' onboarding section, if populated)
    heading("Legal History", 2),
    ...sectionBlock("Criminal History", legal.criminal_history),
    ...sectionBlock("Prior Evaluations", legal.prior_evaluations),
    ...sectionBlock("Current Legal Status", legal.current_legal_status),
    ...sectionBlock("Probation / Parole", legal.probation_parole),
    // Events leading to referral (from 'recent' section)
    heading("Events Leading to Referral", 2),
    ...sectionBlock("Events / Circumstances", recent.events_circumstances),
    ...sectionBlock("Current Stressors", recent.current_stressors),
    // Relevant mental health background (brief, full is in intake doc)
    heading("Relevant Clinical Background", 2),
    ...sectionBlock("Previous Diagnoses", health.previous_diagnoses),
    ...sectionBlock("Previous Treatment", health.previous_treatment),
    ...sectionBlock("Violence History", health.violence_history),
    // Clinician referral notes (if saved)
    ...refNotes.referral ? [heading("Clinician Notes", 2), ...sectionBlock("Referral Context", refNotes.referral)] : [],
    ...refNotes.eval ? [...sectionBlock("Evaluation Scope", refNotes.eval)] : [],
    ...refNotes.legal ? [...sectionBlock("Legal History Notes", refNotes.legal)] : [],
    timestampFooter()
  ]);
  await writeDocx(children, filePath);
  return filePath;
}
async function writeTestingDoc(caseRow, intakeRow, sections) {
  if (!caseRow.folder_path) return null;
  const filePath = path.join(caseRow.folder_path, "Testing", "Testing_Summary.docx");
  const testNotes = sections.testing_notes ?? {};
  const complaints = sections.complaints ?? {};
  const health = sections.health ?? {};
  const sqlite = getSqlite();
  let testBatteries = [];
  try {
    const tbTables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='test_batteries'").all();
    if (tbTables.length > 0) {
      testBatteries = sqlite.prepare("SELECT * FROM test_batteries WHERE case_id = ? ORDER BY category, test_name").all(caseRow.case_id);
    }
  } catch {
  }
  const children = compact([
    heading(`Testing Summary, ${caseRow.examinee_last_name}, ${caseRow.examinee_first_name}`, 1),
    labelValue("Case Number", caseRow.case_number),
    labelValue("Evaluation Type", intakeRow?.eval_type ?? caseRow.evaluation_type),
    labelValue("Date of Birth", caseRow.examinee_dob),
    emptyLine(),
    // Referral context for testing
    heading("Evaluation Context", 2),
    ...sectionBlock("Presenting Complaint", complaints.primary_complaint ?? intakeRow?.presenting_complaint),
    ...sectionBlock("Previous Diagnoses", health.previous_diagnoses),
    ...sectionBlock("Head Injuries / Neurological", health.head_injuries),
    // Test battery
    heading("Test Battery & Administration", 2),
    ...sectionBlock("Battery Selection Rationale", testNotes.battery),
    ...sectionBlock("Validity & Effort Indicators", testNotes.validity),
    ...sectionBlock("Testing Behavioral Observations", testNotes.observations),
    // If test batteries are stored in the DB, list them
    ...testBatteries.length > 0 ? [
      heading("Administered Measures", 2),
      ...testBatteries.map((t) => labelValue(
        t.test_name,
        [t.category, t.status, t.notes].filter(Boolean).join(", ") || "Scheduled"
      ))
    ] : [],
    timestampFooter()
  ]);
  await writeDocx(children, filePath);
  return filePath;
}
async function writeInterviewDoc(caseRow, intakeRow, sections) {
  if (!caseRow.folder_path) return null;
  const filePath = path.join(caseRow.folder_path, "Interviews", "Interview_Notes.docx");
  const intNotes = sections.interview_notes ?? {};
  const complaints = sections.complaints ?? {};
  const recent = sections.recent ?? {};
  const children = compact([
    heading(`Interview Notes, ${caseRow.examinee_last_name}, ${caseRow.examinee_first_name}`, 1),
    labelValue("Case Number", caseRow.case_number),
    labelValue("Evaluation Type", intakeRow?.eval_type ?? caseRow.evaluation_type),
    labelValue("Date of Birth", caseRow.examinee_dob),
    emptyLine(),
    // Brief context for the interviewer
    heading("Evaluation Context", 2),
    ...sectionBlock("Presenting Complaint", complaints.primary_complaint ?? intakeRow?.presenting_complaint),
    ...sectionBlock("Events / Circumstances", recent.events_circumstances)
  ]);
  const sessionKeys = Object.keys(intNotes).filter((k) => k.startsWith("session"));
  if (sessionKeys.length > 0) {
    for (const sessionKey of sessionKeys) {
      const sessionData = intNotes[sessionKey];
      let parsed = {};
      if (typeof sessionData === "string") {
        try {
          parsed = JSON.parse(sessionData);
        } catch {
          parsed = { notes: sessionData };
        }
      } else if (typeof sessionData === "object") {
        parsed = sessionData;
      }
      children.push(heading(`${sessionKey.replace("session-", "Session ")}`, 2));
      children.push(...sectionBlock("Mental Status Examination", parsed.mse));
      children.push(...sectionBlock("Rapport & Engagement", parsed.rapport));
      children.push(...sectionBlock("Clinical Observations", parsed.observations));
      children.push(...sectionBlock("Transcript", parsed.transcript));
      children.push(...sectionBlock("Summary", parsed.summary));
    }
  } else {
    children.push(...sectionBlock("Mental Status Examination", intNotes.mse));
    children.push(...sectionBlock("Rapport & Engagement", intNotes.rapport));
    children.push(...sectionBlock("Clinical Observations", intNotes.observations));
  }
  children.push(timestampFooter());
  await writeDocx(children.filter(Boolean), filePath);
  return filePath;
}
async function writeDiagnosticsDoc(caseRow, intakeRow, sections) {
  if (!caseRow.folder_path) return null;
  const filePath = path.join(caseRow.folder_path, "Diagnostics", "Diagnostic_Formulation.docx");
  const diagNotes = sections.diagnostic_notes ?? {};
  const complaints = sections.complaints ?? {};
  const health = sections.health ?? {};
  const substance = sections.substance ?? {};
  const children = compact([
    heading(`Diagnostic Formulation, ${caseRow.examinee_last_name}, ${caseRow.examinee_first_name}`, 1),
    labelValue("Case Number", caseRow.case_number),
    labelValue("Evaluation Type", intakeRow?.eval_type ?? caseRow.evaluation_type),
    labelValue("Date of Birth", caseRow.examinee_dob),
    emptyLine(),
    // Clinical summary for diagnostic context
    heading("Clinical Summary", 2),
    ...sectionBlock("Presenting Complaint", complaints.primary_complaint ?? intakeRow?.presenting_complaint),
    ...sectionBlock("Secondary Concerns", complaints.secondary_concerns),
    ...sectionBlock("Onset & Timeline", complaints.onset_timeline),
    heading("Relevant History", 2),
    ...sectionBlock("Previous Diagnoses", health.previous_diagnoses),
    ...sectionBlock("Previous Treatment", health.previous_treatment),
    ...sectionBlock("Psychiatric Medications", health.psych_medications),
    ...sectionBlock("Head Injuries / Neurological", health.head_injuries),
    ...sectionBlock("Substance Use, Alcohol", substance.alcohol_use),
    ...sectionBlock("Substance Use, Drugs", substance.drug_use),
    ...sectionBlock("Self-Harm History", health.self_harm_history),
    ...sectionBlock("Violence History", health.violence_history)
  ]);
  const conditionKeys = Object.keys(diagNotes).filter((k) => !k.startsWith("_"));
  const metaKeys = Object.keys(diagNotes).filter((k) => k.startsWith("_"));
  if (conditionKeys.length > 0) {
    children.push(heading("Diagnostic Considerations", 2));
    for (const condName of conditionKeys) {
      const formulation = diagNotes[condName];
      if (formulation?.trim()) {
        children.push(heading(condName, 3));
        children.push(bodyText(formulation));
      }
    }
  }
  if (metaKeys.length > 0) {
    children.push(heading("Final Diagnostic Formulation", 2));
    children.push(...sectionBlock("Diagnostic Impressions", diagNotes._impressions));
    children.push(...sectionBlock("Conditions Ruled Out", diagNotes._ruledOut));
    children.push(...sectionBlock("Response Style & Validity", diagNotes._validity));
    children.push(...sectionBlock("Prognosis & Recommendations", diagNotes._prognosis));
  }
  children.push(timestampFooter());
  await writeDocx(children.filter(Boolean), filePath);
  return filePath;
}
async function writeCaseDoc(caseId, tab) {
  const caseRow = getCaseById(caseId);
  if (!caseRow?.folder_path) return null;
  const onboarding = getOnboardingSections(caseId);
  const sections = parseOnboardingSections(onboarding);
  const intakeRow = getIntakeRow(caseId);
  let filePath = null;
  switch (tab) {
    case "intake":
      filePath = await writeIntakeDoc(caseRow, intakeRow, sections);
      break;
    case "referral":
      filePath = await writeReferralDoc(caseRow, intakeRow, sections);
      break;
    case "testing":
      filePath = await writeTestingDoc(caseRow, intakeRow, sections);
      break;
    case "interview":
      filePath = await writeInterviewDoc(caseRow, intakeRow, sections);
      break;
    case "diagnostics":
      filePath = await writeDiagnosticsDoc(caseRow, intakeRow, sections);
      break;
    default:
      return null;
  }
  if (filePath) {
    try {
      await registerExistingDocument(caseId, filePath);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[case-docs] Failed to register ${filePath} in documents table:`, msg);
    }
  }
  return filePath;
}
async function syncAllCaseDocs(caseId) {
  const files = [];
  const errors = [];
  const tabs = ["intake", "referral", "testing", "interview", "diagnostics"];
  for (const tab of tabs) {
    try {
      const path2 = await writeCaseDoc(caseId, tab);
      if (path2) files.push(path2);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${tab}: ${msg}`);
      console.error(`[case-docs] Failed to write ${tab} doc for case ${caseId}:`, msg);
    }
  }
  return { files, errors };
}
const getKeyPath = () => {
  return path__namespace.join(electron.app.getPath("userData"), "psygil-api-key.enc");
};
function checkEncryptionAvailable() {
  if (!electron.safeStorage.isEncryptionAvailable()) {
    throw new Error(
      "Encryption not available: OS credential storage unavailable. API keys cannot be stored securely on this system."
    );
  }
}
function storeApiKey(key) {
  checkEncryptionAvailable();
  if (!key || key.trim().length === 0) {
    throw new Error("API key cannot be empty");
  }
  const encrypted = electron.safeStorage.encryptString(key);
  const keyPath = getKeyPath();
  try {
    fs__namespace.writeFileSync(keyPath, encrypted, { mode: 384 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to write key file";
    throw new Error(`Failed to store API key: ${message}`);
  }
}
function retrieveApiKey() {
  const envKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (envKey && envKey.length > 0) {
    return envKey;
  }
  checkEncryptionAvailable();
  const keyPath = getKeyPath();
  if (!fs__namespace.existsSync(keyPath)) {
    return null;
  }
  try {
    const encrypted = fs__namespace.readFileSync(keyPath);
    const decrypted = electron.safeStorage.decryptString(encrypted);
    return decrypted;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to decrypt key";
    throw new Error(`Failed to retrieve API key: ${message}`);
  }
}
function hasApiKey() {
  const keyPath = getKeyPath();
  return fs__namespace.existsSync(keyPath);
}
function deleteApiKey() {
  const keyPath = getKeyPath();
  if (!fs__namespace.existsSync(keyPath)) {
    return false;
  }
  try {
    fs__namespace.unlinkSync(keyPath);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete key file";
    throw new Error(`Failed to delete API key: ${message}`);
  }
}
class AnthropicApiError extends Error {
  constructor(statusCode, errorType, message) {
    super(message);
    this.statusCode = statusCode;
    this.errorType = errorType;
    this.name = "AnthropicApiError";
  }
}
async function callClaude(apiKey, options) {
  const {
    systemPrompt,
    userMessage,
    model = "claude-sonnet-4-20250514",
    maxTokens = 4096,
    temperature = 0
  } = options;
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error("API key is required");
  }
  if (!systemPrompt || systemPrompt.trim().length === 0) {
    throw new Error("System prompt is required");
  }
  if (!userMessage || userMessage.trim().length === 0) {
    throw new Error("User message is required");
  }
  const requestBody = {
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: userMessage
      }
    ],
    temperature
  };
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify(requestBody)
    });
    if (response.status === 401) {
      throw new AnthropicApiError(401, "AUTHENTICATION_FAILED", "Invalid API key");
    }
    if (response.status === 429) {
      const retryAfter = response.headers.get("retry-after") || "60";
      const message = `Rate limited. Retry after ${retryAfter} seconds`;
      throw new AnthropicApiError(429, "RATE_LIMIT", message);
    }
    if (response.status === 500 || response.status === 502 || response.status === 503) {
      throw new AnthropicApiError(
        response.status,
        "SERVICE_UNAVAILABLE",
        "API temporarily unavailable"
      );
    }
    if (!response.ok) {
      let errorMessage = "Unexpected API response";
      try {
        const errorData = await response.json();
        if (errorData.error?.message) {
          errorMessage = errorData.error.message;
        }
      } catch {
        try {
          errorMessage = await response.text();
        } catch {
          errorMessage = `HTTP ${response.status}`;
        }
      }
      throw new AnthropicApiError(response.status, "API_ERROR", errorMessage);
    }
    const data = await response.json();
    const textContent = data.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text content in API response");
    }
    return {
      content: textContent.text,
      model: data.model,
      inputTokens: data.usage.input_tokens,
      outputTokens: data.usage.output_tokens,
      stopReason: data.stop_reason
    };
  } catch (e) {
    if (e instanceof AnthropicApiError) {
      throw e;
    }
    if (e instanceof Error) {
      if (e.message.includes("fetch")) {
        throw new AnthropicApiError(0, "NETWORK_ERROR", `Cannot reach Anthropic API: ${e.message}`);
      }
      throw e;
    }
    throw new Error("Claude API call failed");
  }
}
function ok$7(data) {
  return { status: "success", data };
}
function fail$7(error_code, message) {
  return { status: "error", error_code, message };
}
function registerAiHandlers() {
  electron.ipcMain.handle(
    "ai:complete",
    async (_event, params) => {
      try {
        if (!params.systemPrompt || !params.userMessage) {
          return fail$7("INVALID_REQUEST", "systemPrompt and userMessage are required");
        }
        const apiKey = retrieveApiKey();
        if (!apiKey) {
          return fail$7("NO_API_KEY", "Claude API key not configured");
        }
        const response = await callClaude(apiKey, {
          systemPrompt: params.systemPrompt,
          userMessage: params.userMessage,
          model: params.model,
          maxTokens: params.maxTokens
        });
        return ok$7(response);
      } catch (e) {
        const message = e instanceof Error ? e.message : "AI completion failed";
        console.error("[ai:complete] error:", message);
        if (message.includes("Invalid API key")) {
          return fail$7("AUTHENTICATION_FAILED", "Invalid Claude API key");
        }
        if (message.includes("Rate limited")) {
          return fail$7("RATE_LIMITED", message);
        }
        if (message.includes("temporarily unavailable")) {
          return fail$7("SERVICE_UNAVAILABLE", "Claude API temporarily unavailable");
        }
        if (message.includes("Cannot reach")) {
          return fail$7("NETWORK_ERROR", "Cannot reach Claude API");
        }
        return fail$7("AI_ERROR", message);
      }
    }
  );
  electron.ipcMain.handle(
    "ai:testConnection",
    async (_event, _params) => {
      try {
        const apiKey = retrieveApiKey();
        if (!apiKey) {
          return ok$7({
            connected: false,
            error: "Claude API key not configured"
          });
        }
        const response = await callClaude(apiKey, {
          systemPrompt: "You are a helpful assistant.",
          userMessage: 'Say "ok".',
          maxTokens: 10
        });
        return ok$7({
          connected: true,
          model: response.model
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Connection test failed";
        console.error("[ai:testConnection] error:", message);
        return ok$7({
          connected: false,
          error: message
        });
      }
    }
  );
}
const REDACTION_CONTEXT_MAP = {
  ingestor: "intake",
  diagnostician: "diagnostics",
  writer: "report",
  editor: "review"
};
async function runAgent(apiKey, config) {
  const startTime = Date.now();
  const operationId = crypto.randomUUID();
  try {
    const concatenated = config.inputTexts.join("\n\n");
    const redactionContext = REDACTION_CONTEXT_MAP[config.agentType];
    const redactionResult = await redact(concatenated, operationId, redactionContext);
    const redactedText = redactionResult.redactedText;
    let claudeResponse;
    try {
      claudeResponse = await callClaude(apiKey, {
        systemPrompt: config.systemPrompt,
        userMessage: redactedText,
        model: "claude-sonnet-4-20250514",
        maxTokens: config.maxTokens ?? 4096,
        temperature: config.temperature ?? 0
      });
    } catch (e) {
      await destroyMap(operationId);
      throw e;
    }
    const rehydrationResult = await rehydrate(claudeResponse.content, operationId);
    const fullText = rehydrationResult.fullText;
    let parsedResult;
    const stripFences = (raw) => {
      const trimmed = raw.trim();
      const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
      return fenced ? fenced[1].trim() : trimmed;
    };
    try {
      parsedResult = JSON.parse(stripFences(fullText));
    } catch {
      parsedResult = fullText;
    }
    await destroyMap(operationId);
    const durationMs = Date.now() - startTime;
    return {
      status: "success",
      agentType: config.agentType,
      caseId: config.caseId,
      operationId,
      result: parsedResult,
      tokenUsage: {
        input: claudeResponse.inputTokens,
        output: claudeResponse.outputTokens
      },
      durationMs
    };
  } catch (e) {
    try {
      await destroyMap(operationId);
    } catch {
    }
    const durationMs = Date.now() - startTime;
    const errorMessage = e instanceof Error ? e.message : "Unknown error";
    return {
      status: "error",
      agentType: config.agentType,
      caseId: config.caseId,
      operationId,
      error: errorMessage,
      durationMs
    };
  }
}
function isValidAgentType(value) {
  return typeof value === "string" && ["ingestor", "diagnostician", "writer", "editor"].includes(value);
}
const INGESTOR_SYSTEM_PROMPT = `You are the Ingestor Agent for Psygil, an AI assistant for forensic and clinical psychologists. Your role is to parse raw case materials and extract structured data into a standardized case record.

CRITICAL PRINCIPLE: You extract and organize data. You do not interpret, score, or diagnose. The clinician diagnoses.

YOUR INPUTS:
- Raw documents: PDF text, DOCX text, VTT transcripts, Whisper transcripts, handwritten notes (as text)
- Referral documents: Letters, intake forms, legal requests
- Standardized test score reports: Q-global exports, PARiConnect exports, publisher score reports
- Collateral records: School reports, medical records, prior evaluations

YOUR OUTPUTS:
A structured JSON case record with sections: demographics, referral_questions, test_administrations, behavioral_observations_from_transcripts, timeline_events, collateral_summary, and completeness_flags.

EXTRACTION RULES:

1. DEMOGRAPHICS:
   - Extract: Name, DOB, age, sex/gender, race/ethnicity, handedness, education level, occupation, referral source, evaluator name, evaluation dates
   - If missing, note as null with a reason_missing flag
   - Do NOT infer or estimate missing values

2. REFERRAL QUESTIONS:
   - Extract verbatim referral questions from referral letters or intake forms
   - Label each question with source document and page number
   - If referral questions are implicit, extract them as inferred questions with an "inferred" flag

3. TEST ADMINISTRATIONS:
   - For each standardized test:
     * Extract test name, administration date, raw scores, scaled scores, percentiles, T-scores
     * Extract validity indicators exactly as reported
     * Extract diagnostic classifications provided by the test publisher
     * CRITICAL: Do NOT independently interpret or score tests. Extract only what the publisher score report explicitly states
     * Flag any missing subtests or incomplete administrations
     * Include the source document, date, and any administrator notes
   - PUBLISHER SCORE REPORT FORMATS (documents typed as "test_score_report"):
     * Q-Global (Pearson MMPI-3): Extract all clinical scales (ANX, FRS, OBS, DEP, HLT, BIZ, ANG, CYN, ASP, TPA, LSE, SOD, FAM, WRK, TRT), validity indicators (VRIN-T, TRIN-T, F, Fp, Fs, L, K), supplementary items (PS, HPI, RC scales). Include rawScore, tScore, percentile, classification for each.
     * PARiConnect (PAI): Extract all clinical scales, validity scales (NIM, PIM, ICN, INF), treatment indicators. Include rawScore, tScore, percentile for each.
     * WAIS-V (Pearson): Extract subtest scaled scores, Index scores (VCI, VSI, FRI, WMI, PSI), FSIQ, GAI. Include scaled_score, composite_score, percentile, confidence_interval.
     * TOMM: Extract Trial 1, Trial 2, Retention scores. Report pass/fail status (cutoff: 45).
     * SIRS-2: Extract scale classifications (Genuine, Indeterminate, Probable Feigning, Definite Feigning). Report per-scale results.
   - For each test, output a sub-object in test_administrations with keys: instrumentId, instrumentName, publisher, administrationDate, importSource, clinicalScales (object), validityIndicators (object), status, completeness

4. BEHAVIORAL OBSERVATIONS FROM TRANSCRIPTS:
   - If audio/video transcripts are provided, extract behavioral observations
   - Clearly label these as "transcript-derived" NOT clinician direct observation
   - Include: apparent mood, affect, speech patterns, cooperation, unusual behaviors, engagement level
   - Quote the relevant transcript passages
   - Do NOT diagnose or interpret behavior

5. TIMELINE EVENTS:
   - Extract key dates and events from all documents in chronological order
   - For each event, cite the source document
   - Do NOT infer causality or significance

6. COLLATERAL SUMMARY:
   - For each collateral record: source, date, key facts extracted
   - Do NOT interpret; only extract facts as stated
   - Note any conflicting information across collateral sources

7. COMPLETENESS FLAGS:
   - For each major data category, flag completeness: "complete," "partial," "missing"
   - Add a summary_gaps field noting the top 3 missing data categories

OUTPUT FORMAT:
Return a valid JSON object with these top-level keys:
  case_id, version, generated_at, demographics, referral_questions,
  test_administrations, behavioral_observations_from_transcripts,
  timeline_events, collateral_summary, completeness_flags

TONE:
Clinical, precise, objective. Use professional terminology. Avoid speculation.`;
function mapDocType(docType, filePath) {
  const map = {
    referral: "referral_letter",
    intake: "intake_form",
    test_report: "test_score_report",
    score_report: "test_score_report",
    transcript_vtt: "transcript_vtt",
    transcript: "transcript_vtt",
    collateral: "collateral_medical",
    medical_record: "collateral_medical",
    educational_record: "collateral_educational",
    legal_document: "collateral_legal",
    prior_eval: "prior_evaluation",
    report: "prior_evaluation",
    other: "collateral_medical"
  };
  if (filePath) {
    const normalized = filePath.replace(/\\/g, "/");
    if (normalized.includes("/Testing/") || normalized.includes("/testing/")) {
      return "test_score_report";
    }
  }
  return map[docType] ?? "collateral_medical";
}
async function runIngestorAgent(caseId) {
  const caseRow = getCaseById(caseId);
  if (!caseRow) {
    return {
      status: "error",
      agentType: "ingestor",
      caseId,
      operationId: "",
      error: `Case ${caseId} not found`,
      durationMs: 0
    };
  }
  const documents2 = listDocuments(caseId);
  if (documents2.length === 0) {
    return {
      status: "error",
      agentType: "ingestor",
      caseId,
      operationId: "",
      error: "No documents uploaded for this case. Upload documents before running ingestion.",
      durationMs: 0
    };
  }
  const intake = getIntake(caseId);
  const apiKey = retrieveApiKey();
  if (!apiKey) {
    return {
      status: "error",
      agentType: "ingestor",
      caseId,
      operationId: "",
      error: "Anthropic API key not configured. Set your API key in Settings.",
      durationMs: 0
    };
  }
  const rawDocs = documents2.filter((d) => d.indexed_content).map((d) => ({
    document_name: d.original_filename,
    document_type: mapDocType(d.document_type, d.file_path),
    text_content: d.indexed_content,
    upload_date: d.upload_date
  }));
  if (rawDocs.length === 0) {
    return {
      status: "error",
      agentType: "ingestor",
      caseId,
      operationId: "",
      error: "No documents with extractable text found. Ensure documents are PDF, DOCX, or TXT.",
      durationMs: 0
    };
  }
  const inputPayload = JSON.stringify(
    {
      case_id: caseRow.case_number ?? `CASE-${caseId}`,
      raw_documents: rawDocs,
      clinician_metadata: {
        clinician_name: "Unknown",
        // Clinician name not stored on intake; sourced from case/user record
        evaluation_type: caseRow.evaluation_type ?? "other",
        jurisdiction: intake?.jurisdiction ?? void 0,
        case_notes: intake?.presenting_complaint ?? void 0
      }
    },
    null,
    2
  );
  const config = {
    agentType: "ingestor",
    systemPrompt: INGESTOR_SYSTEM_PROMPT,
    caseId,
    inputTexts: [inputPayload],
    maxTokens: 8192,
    // Ingestor output can be large
    temperature: 0
  };
  const result = await runAgent(apiKey, config);
  if (result.status === "success" && result.result) {
    try {
      saveIngestorResult(caseId, result.operationId, result.result);
    } catch (e) {
      console.error("[ingestor] Failed to save result to DB:", e.message);
    }
  }
  return result;
}
function saveIngestorResult(caseId, operationId, output) {
  const sqlite = getSqlite();
  const tables = sqlite.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='agent_results'"
  ).all();
  if (tables.length === 0) {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS agent_results (
        result_id INTEGER PRIMARY KEY AUTOINCREMENT,
        case_id INTEGER NOT NULL REFERENCES cases(case_id),
        agent_type TEXT NOT NULL CHECK(agent_type IN ('ingestor', 'diagnostician', 'writer', 'editor')),
        operation_id TEXT NOT NULL,
        result_json TEXT NOT NULL,
        version TEXT NOT NULL DEFAULT '1.0',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(case_id, agent_type, operation_id)
      )
    `);
    sqlite.exec(`
      CREATE INDEX IF NOT EXISTS idx_agent_results_case
        ON agent_results(case_id, agent_type)
    `);
  } else {
    const cols = sqlite.prepare("PRAGMA table_info(agent_results)").all();
    const colNames = new Set(cols.map((c) => c.name));
    if (!colNames.has("operation_id")) {
      try {
        sqlite.exec(`ALTER TABLE agent_results ADD COLUMN operation_id TEXT`);
      } catch {
      }
    }
    if (!colNames.has("version")) {
      try {
        sqlite.exec(`ALTER TABLE agent_results ADD COLUMN version TEXT DEFAULT '1.0'`);
      } catch {
      }
    }
  }
  sqlite.prepare(`
    INSERT INTO agent_results (case_id, agent_type, operation_id, result_json, version)
    VALUES (?, 'ingestor', ?, ?, ?)
  `).run(caseId, operationId, JSON.stringify(output), output.version ?? "1.0");
}
function getLatestIngestorResult(caseId) {
  const sqlite = getSqlite();
  const tables = sqlite.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='agent_results'"
  ).all();
  if (tables.length === 0) return null;
  const row = sqlite.prepare(`
    SELECT result_json FROM agent_results
    WHERE case_id = ? AND agent_type = 'ingestor'
    ORDER BY created_at DESC
    LIMIT 1
  `).get(caseId);
  if (!row) return null;
  try {
    return JSON.parse(row.result_json);
  } catch {
    return null;
  }
}
const DIAGNOSTICIAN_SYSTEM_PROMPT = `You are the Diagnostician Agent for Psygil, an AI assistant for forensic and clinical psychologists. Your role is to organize evidence against diagnostic criteria and psycho-legal standards. You present options,you do not diagnose.

CRITICAL PRINCIPLE: You map evidence to criteria. The clinician decides the diagnosis.

YOUR INPUTS:
- Structured case record (confirmed at Gate 1): demographics, referral questions, test administrations, behavioral observations, timeline, collateral summary
- DSM-5-TR diagnostic catalog (diagnostic criteria for all relevant diagnoses)
- Instrument library (interpretation guidelines for MMPI-3, PAI, TOMM, SIRS-2, etc.)

YOUR OUTPUTS:
An evidence map JSON object with five sections: validity_assessment, diagnostic_evidence_map, differential_comparisons, psycholegal_analysis (forensic only), and functional_impairment_summary (clinical only).

PROCESSING ORDER:

STEP 1: VALIDITY ASSESSMENT (ALWAYS PROCESS FIRST)
Before examining any diagnostic evidence, assess the validity and interpretability of psychological test data.

For effort/performance validity tests (TOMM, SIRS-2, CVLT-II forced choice, etc.):
- Extract pass/fail status
- Note if patient failed or produced inconsistent performance
- Assess impact: Valid = "Full interpretability"; Questionable = "Interpret with caution"; Invalid = "Invalid for diagnostic interpretation"

For MMPI-3 validity scales:
- Extract VRIN-T, TRIN-T, F, Fp, Fs scales
- Determine if profile is valid using publisher guidelines
- Valid profile = "All validity scales within acceptable range"
- Invalid profile = "Profile validity compromised; specific scales unreliable"
- Describe impact on interpretability of clinical and content scales

For PAI validity scales (NIM, PIM, ICN):
- Apply publisher rules; note if profile is interpretable
- Flag if patient produced inconsistent or random responses

OUTPUT FOR VALIDITY ASSESSMENT:
\`\`\`
"validity_assessment": {
  "effort_tests": [
    {
      "test_name": "TOMM",
      "status": "pass|fail|not_administered",
      "impact_on_interpretability": "Full|Caution|Invalid"
    }
  ],
  "mmpi3_validity": {
    "overall_validity": "Valid|Questionable|Invalid",
    "validity_scales": {...},
    "interpretation_impact": "string describing which clinical scales are reliable"
  },
  "pai_validity": {...},
  "summary": "Overall assessment of test battery interpretability given validity findings"
}
\`\`\`

STEP 2: DIAGNOSTIC EVIDENCE MAP
For each diagnosis in the DSM-5-TR catalog that is relevant to the referral questions or presenting symptoms:

A. Criterion-by-criterion analysis:
   - For each criterion (A, B, C, etc.), assess:
     * supporting_evidence: Array of case facts, test findings, behavioral observations that support this criterion. Format: {"source": "item from case record", "strength": "strong|moderate|weak"}
     * contradicting_evidence: Array of facts that argue against this criterion
     * insufficient_data: Boolean,true if this criterion cannot be assessed with available data
     * source_citations: Array of references to case record entries (e.g., "test_administrations[0].publisher_classifications[1]")

B. Onset, duration, and context:
   - Timeline: When did symptoms appear? Are they consistent with this diagnosis's typical onset?
   - Precipitants: What events preceded symptom onset?
   - Course: Are symptoms stable, worsening, improving?
   - Environmental factors: Substance use, medical conditions, medications affecting presentation?

C. Functional impact:
   - How does this diagnosis account for the referral questions?
   - Does it explain the observed behavioral pattern?

OUTPUT FOR EACH DIAGNOSIS:
\`\`\`
"diagnosis_name": {
  "icd_code": "F32.1",
  "status": "evidence_presented",
  "criteria_analysis": {
    "criterion_a": {
      "description": "DSM-5-TR criterion text",
      "met_status": "met|not_met|insufficient_data",
      "supporting_evidence": [...],
      "contradicting_evidence": [...],
      "source_citations": [...]
    },
    ... (all criteria)
  },
  "onset_and_course": {...},
  "functional_impact": "How this diagnosis would explain presenting problems",
  "probability_estimate": "Not used for diagnosis selection; informational only for clinician review"
}
\`\`\`

STEP 3: DIFFERENTIAL COMPARISONS
For overlapping or related diagnoses, produce structured comparisons highlighting distinguishing features.

Examples:
- Major Depressive Disorder vs. Bipolar II: Compare depressive symptom profiles, history of mania/hypomania, course differences
- Generalized Anxiety Disorder vs. Specific Phobia: Compare scope of anxiety, triggers, avoidance patterns
- ADHD vs. Anxiety-Induced Inattention: Compare symptom onset, temporal pattern, impulsivity markers
- Antisocial Personality Disorder vs. Narcissistic Personality Disorder: Compare empathy deficits, criminality, grandiosity

OUTPUT:
\`\`\`
"differential_comparisons": [
  {
    "diagnosis_pair": "MDD vs Bipolar II",
    "key_distinguishing_features": [
      {
        "feature": "History of manic/hypomanic episodes",
        "evidence_for_diagnosis_1": "No reported elevated mood or decreased need for sleep",
        "evidence_for_diagnosis_2": "Patient reported 2-week period of high energy and racing thoughts per collateral interview"
      }
    ],
    "clinical_clarification": "Patient's history of depressive episodes without clear manic/hypomanic periods aligns more closely with MDD; however, patient's elevated energy during [date range] warrants consideration of Bipolar II if pattern recurs or is confirmed in direct interview."
  }
]
\`\`\`

STEP 4: PSYCHO-LEGAL ANALYSIS (FORENSIC CASES ONLY)
If evaluation type is forensic, map evidence to relevant legal standards:

COMPETENCY EVALUATIONS (Dusky standard):
- Factual understanding of charges, court process, and consequences
- Rational understanding of charges in context of personal situation
- Ability to assist counsel in defense strategy
- Any mental illness/disability affecting these capacities?

INSANITY EVALUATIONS (M'Naghten, MPC, other state standard):
- At time of alleged offense, did defendant know the nature/quality of the act?
- At time of offense, did defendant know the act was wrong (morally or legally)?
- (MPC standard): Did defendant have capacity to appreciate criminality and conform conduct to law?

CIVIL COMMITMENT EVALUATIONS:
- Does patient meet state statutory definition of mental illness?
- Is patient a danger to self? To others? Evidence of specific threats, acts, prior attempts?
- Is patient gravely disabled? Specific examples of inability to care for self?

CUSTODY EVALUATIONS:
- Best interests of child: What arrangement serves child's physical/emotional/educational needs?
- Parental capacity to meet child's needs
- Quality of parent-child relationship
- Child's preferences (age-dependent)
- Any history of abuse, neglect, substance misuse?

OUTPUT:
\`\`\`
"psycholegal_analysis": {
  "legal_standard": "Dusky|M'Naghten|MPC|[other]",
  "jurisdiction": "State/county",
  "standard_elements": [
    {
      "element": "Factual understanding of charges",
      "evidence_map": [...]
    }
  ],
  "critical_gaps": "What evidence is missing to fully assess against this standard?",
  "clinical_findings_applicable_to_legal_standard": "Summary of how clinical findings relate to legal standard"
}
\`\`\`

STEP 5: FUNCTIONAL IMPAIRMENT SUMMARY (CLINICAL CASES ONLY)
Synthesize how presenting problems and diagnostic findings affect daily functioning.

Domains:
- Work/academic: Job performance, concentration, attendance, conflict with coworkers
- Social/relationships: Friendship quality, romantic relationships, family dynamics, social isolation
- Self-care: Hygiene, nutrition, medical compliance, sleep
- Safety: Self-harm, suicide risk, aggression, substance abuse, reckless behavior

OUTPUT:
\`\`\`
"functional_impairment_summary": {
  "work_academic": "Description of impairment in work/academic functioning with evidence",
  "social_relationships": "...",
  "self_care": "...",
  "safety_risk": "...",
  "overall_impairment_level": "None|Mild|Moderate|Severe"
}
\`\`\`

CRITICAL OUTPUT CONSTRAINTS:

1. NO field called "selected_diagnosis," "recommended_diagnosis," or "suggested_diagnosis"
2. NO language like "the diagnosis is," "the patient meets criteria for," "we recommend," or "the clinician should consider"
3. Every diagnosis entry has status: "evidence_presented", NEVER "confirmed," "ruled_out," or "recommended"
4. The entire output is framed as evidence organization: "Evidence supporting MDD includes..." NOT "The patient has MDD."
5. Differential comparisons present both sides fairly,no steering toward one diagnosis
6. Probability estimates (if included) are for clinician reference only; they do not constitute a recommendation
7. Psycho-legal analysis maps evidence to legal standards; it does not opine on legal conclusions (competency, insanity, best interests)

TONE:
Objective, evidence-based, precise. Use clinical terminology. Organize for clarity. Avoid advocacy.`;
async function runDiagnosticianAgent(caseId) {
  const caseRow = getCaseById(caseId);
  if (!caseRow) {
    return {
      status: "error",
      agentType: "diagnostician",
      caseId,
      operationId: "",
      error: `Case ${caseId} not found`,
      durationMs: 0
    };
  }
  const ingestorResult = getLatestIngestorResult(caseId);
  if (!ingestorResult) {
    return {
      status: "error",
      agentType: "diagnostician",
      caseId,
      operationId: "",
      error: "Ingestor Agent has not been run for this case. Run Ingestor first to extract and structure case data.",
      durationMs: 0
    };
  }
  const apiKey = retrieveApiKey();
  if (!apiKey) {
    return {
      status: "error",
      agentType: "diagnostician",
      caseId,
      operationId: "",
      error: "Anthropic API key not configured. Set your API key in Settings.",
      durationMs: 0
    };
  }
  const referralQuestions = ingestorResult.referral_questions ? ingestorResult.referral_questions.map((q) => typeof q === "object" && q !== null && "question_text" in q ? q.question_text : JSON.stringify(q)).filter((q) => q.length > 0) : [];
  const inputPayload = JSON.stringify(
    {
      case_id: caseRow.case_number ?? `CASE-${caseId}`,
      case_record: ingestorResult,
      referral_questions: referralQuestions,
      evaluation_type: caseRow.evaluation_type ?? "other"
    },
    null,
    2
  );
  const config = {
    agentType: "diagnostician",
    systemPrompt: DIAGNOSTICIAN_SYSTEM_PROMPT,
    caseId,
    inputTexts: [inputPayload],
    maxTokens: 8192,
    // Diagnostician output can be large (multiple diagnoses)
    temperature: 0
  };
  const result = await runAgent(apiKey, config);
  if (result.status === "success" && result.result) {
    try {
      saveDiagnosticianResult(caseId, result.operationId, result.result);
    } catch (e) {
      console.error("[diagnostician] Failed to save result to DB:", e.message);
    }
  }
  return result;
}
function saveDiagnosticianResult(caseId, operationId, output) {
  const sqlite = getSqlite();
  const tables = sqlite.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='agent_results'"
  ).all();
  if (tables.length === 0) {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS agent_results (
        result_id INTEGER PRIMARY KEY AUTOINCREMENT,
        case_id INTEGER NOT NULL REFERENCES cases(case_id),
        agent_type TEXT NOT NULL CHECK(agent_type IN ('ingestor', 'diagnostician', 'writer', 'editor')),
        operation_id TEXT NOT NULL,
        result_json TEXT NOT NULL,
        version TEXT NOT NULL DEFAULT '1.0',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(case_id, agent_type, operation_id)
      )
    `);
    sqlite.exec(`
      CREATE INDEX IF NOT EXISTS idx_agent_results_case
        ON agent_results(case_id, agent_type)
    `);
  }
  sqlite.prepare(`
    INSERT INTO agent_results (case_id, agent_type, operation_id, result_json, version)
    VALUES (?, 'diagnostician', ?, ?, ?)
  `).run(caseId, operationId, JSON.stringify(output), output.version ?? "1.0");
}
function getLatestDiagnosticianResult$1(caseId) {
  const sqlite = getSqlite();
  const tables = sqlite.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='agent_results'"
  ).all();
  if (tables.length === 0) return null;
  const row = sqlite.prepare(`
    SELECT result_json FROM agent_results
    WHERE case_id = ? AND agent_type = 'diagnostician'
    ORDER BY created_at DESC
    LIMIT 1
  `).get(caseId);
  if (!row) return null;
  try {
    return JSON.parse(row.result_json);
  } catch {
    return null;
  }
}
function loadStyleProfile() {
  const DEFAULT_STYLE = {
    tone: "formal",
    formality_level: "professional",
    citation_style: "inline"
  };
  try {
    const wsPath = loadWorkspacePath() || getDefaultWorkspacePath();
    const profilePath = path__namespace.join(wsPath, "Workspace", "Writing Samples", ".style-profile.json");
    if (!fs__namespace.existsSync(profilePath)) return DEFAULT_STYLE;
    const raw = fs__namespace.readFileSync(profilePath, "utf-8");
    const profile = JSON.parse(raw);
    return {
      tone: "formal",
      formality_level: "professional",
      citation_style: "inline",
      // Real metrics from analyzed writing samples
      avg_sentence_length: profile.avgSentenceLength,
      vocabulary_richness: profile.vocabularyRichness,
      formality_score: profile.formalityScore,
      person_reference: profile.personReference,
      tense_distribution: profile.tenseDistribution,
      top_clinical_terms: profile.topTerms?.slice(0, 15).map((t) => t.term) ?? [],
      hedging_patterns: profile.hedgingPhrases?.slice(0, 10).map((h) => h.phrase) ?? [],
      section_headings: profile.sectionHeadings ?? [],
      sample_count: profile.sampleCount,
      total_word_count: profile.totalWordCount
    };
  } catch (_) {
    return DEFAULT_STYLE;
  }
}
const WRITER_SYSTEM_PROMPT = `You are the Writer Agent for Psygil, an AI assistant for forensic and clinical psychologists. Your role is to transform structured case data and clinician decisions into professional report prose. You write in the clinician's voice, respecting their diagnostic conclusions. You flag content requiring revision.

CRITICAL PRINCIPLE: You write what the clinician decided. You do not add interpretation beyond what was selected at Gate 2. You flag sections that need revision.

YOUR INPUTS:
- Clinician's diagnostic decisions from Gate 2: Which diagnoses were selected, which were ruled out, any forensic/functional conclusions
- Structured case record: All extracted data (demographics, referral questions, test results, observations, timeline, collateral)
- Style guide: Tone, formatting, clinical terminology preferences for this clinician's voice
- Section templates: Structure and content guidelines for each report section
- Report template: Overall report format/jurisdiction (clinical psychiatric, forensic competency, custody evaluation, etc.)

YOUR OUTPUTS:
Array of section objects. Each section has:
- section_name: Section title (e.g., "Background History," "Test Results," "Diagnostic Impressions")
- content: Prose text in clinician's voice
- content_type: "fully_generated" (routine, minimal judgment) OR "draft_requiring_revision" (interpretation-heavy, needs clinician edit)
- sources: Array of case record citations
- confidence: 0-100 how well this matches style guide and expected quality

SECTION-BY-SECTION GUIDELINES:

1. BACKGROUND HISTORY & DEMOGRAPHICS
   Content type: fully_generated (routine documentation)
   Process:
   - Organize chronologically using timeline_events
   - Reference referral questions to frame context
   - Include relevant life events, family history, medical history
   - Do NOT interpret; only state facts
   - Use collateral records to fill gaps
   - Structure: Demographics → Referral circumstances → Educational/occupational history → Family history → Medical history → Substance use history → Prior psychiatric treatment
   Output: Professional, well-organized narrative

2. BEHAVIORAL OBSERVATIONS
   Content type: ALWAYS draft_requiring_revision (with mandatory note)
   Process:
   - Extract observations from case record behavioral_observations_from_transcripts
   - If source is transcript: "The following observations were derived from [VTT/transcript analysis]"
   - Include mood, affect, speech, cooperation, appearance, psychomotor activity
   - Do NOT diagnose (e.g., "patient appeared depressed" is OK; "patient showed depressed mood consistent with MDD" is NOT)
   - Include relevant quotes from interview or transcript
   - Acknowledge direct vs. transcript-derived observations
   Mandatory note for all behavioral observation sections:
   "Note: Observations extracted from transcript/recording require clinician review. The clinician's direct clinical impression supersedes transcript-derived observations. Clinician should revise this section to reflect their actual observations from the evaluation."

3. MENTAL STATUS EXAMINATION (if conducted)
   Content type: fully_generated (factual documentation)
   Process:
   - Use behavioral observations and any documented MSE findings
   - Organize by standard MSE domains: appearance, behavior, speech, mood, affect, thought process, thought content, perception, cognition, insight, judgment
   - Stick to observable facts; minimal interpretation
   Output: Standard clinical MSE format

4. TEST RESULTS & INTERPRETATION
   Content type: fully_generated for score reporting; draft_requiring_revision for interpretation
   Process:
   A. Validity section:
      - Report all validity indicator scores from case record
      - Use interpretation language from instrument library
      - Example: "MMPI-3 VRIN-T of 45 and TRIN-T of 52 are within acceptable ranges, indicating valid responding."
      - If any validity concerns: "Profile validity is questionable; interpretation of clinical scales should be cautious."
      - Do NOT skip or minimize validity findings
   B. Score reporting:
      - For each test, create table or prose paragraph with:
        * Test name, administration date
        * Subtest/scale names and scores (raw, scaled, percentiles, T-scores as available)
        * Publisher classifications (e.g., "MMPI-3 profile code 4-6'-2' indicates elevated anger/hostility and possible depression")
        * Only extract what publisher stated; do NOT independently interpret
   C. Interpretation:
      - Synthesize findings across tests
      - Compare to referral questions
      - Use clinician's Gate 2 decisions to guide interpretation
      - Describe what test results support or challenge each diagnosis the clinician selected
      - For diagnoses clinician ruled out: explain why test results do not support them
      - Maintain clinician's voice: "The MMPI-3 profile is consistent with..." (per clinician's conclusion)
   Content type for interpretation subsection: draft_requiring_revision (clinician should review and revise)

5. DIAGNOSTIC IMPRESSIONS
   Content type: draft_requiring_revision (clinician final revision point)
   Process:
   - Introduce with referral questions: "The evaluation was conducted to address the following questions: [list]"
   - For each diagnosis clinician selected at Gate 2:
     * Write 1-2 paragraphs explaining evidence
     * Cite test scores, behavioral observations, timeline, collateral
     * Describe how this diagnosis explains the referral questions
     * Example: "Mr. Smith meets DSM-5-TR criteria for Major Depressive Disorder based on: (1) depressed mood reported over the past 3 months; (2) sleep disturbance per collateral interview; (3) MMPI-3 profile code 2-7'-4 consistent with depression and anxiety..."
   - For diagnoses clinician considered but ruled out:
     * Explain why: "Bipolar II Disorder was considered given the patient's reported high-energy periods. However, these episodes did not meet criteria for hypomania because [specific reasons]. The clinical presentation is more consistent with Major Depressive Disorder with anxious features."
   - Do NOT introduce diagnoses clinician did not address
   - Do NOT add "the clinician diagnoses" language; instead: "Based on the evidence presented, [diagnosis] explains the following..."
   Tone: Professional, evidence-based, clinician's voice
   Flag: draft_requiring_revision (clinician may wish to adjust wording or emphasis)

6. CLINICAL FORMULATION (if non-forensic clinical case)
   Content type: draft_requiring_revision (inherently interpretive)
   Process:
   - Integrate diagnoses with etiology, predisposing factors, precipitants, maintaining factors
   - Tie together how patient's history, circumstances, test results, and behavior led to current presentation
   - Use biopsychosocial framework
   - Example: "Mr. Smith's depression appears rooted in a combination of genetic vulnerability (mother with bipolar disorder), early loss experiences (father's death when patient was 12), and ongoing psychosocial stressors (recent divorce, job loss). The MMPI-3 profile supports significant depression with social withdrawal and self-criticism as maintaining factors."
   - Do NOT diagnose beyond what clinician selected at Gate 2
   Flag: draft_requiring_revision

7. RISK ASSESSMENT (forensic and safety-relevant clinical cases)
   Content type: ALWAYS draft_requiring_revision
   Mandatory note: "Risk assessment is presented for clinician review and decision. This section does NOT constitute a risk opinion; the clinician must provide the final risk determination."
   Process:
   - Present risk factors organized by domain (violence, suicide, general recidivism, etc., per referral questions)
   - Cite specific evidence from case: prior incidents, threat history, substance use, psychiatric history, protective factors
   - Reference validated instruments if administered (HCR-20, PCL-5, etc.)
   - For forensic cases: Relate risk factors to legal standard (e.g., "The defendant reported three prior arrests for assault, suggesting pattern of violence risk relevant to sentencing/disposition.")
   - Do NOT state "Risk of violence is MODERATE" or similar opinions
   - Instead: "Risk factors for violence include: [list]. Protective factors include: [list]. The clinician determines overall risk level based on these factors."
   Flag: draft_requiring_revision

8. RECOMMENDATIONS (if applicable)
   Content type: draft_requiring_revision (require clinician selection/editing)
   Process:
   - If referral asks for treatment recommendations: Present clinically indicated options (medication, psychotherapy, hospitalization, etc.)
   - If forensic: Do NOT recommend legal outcomes (competency, insanity, custody determination); instead present findings. For example:
     * Competency: "Based on the assessment, the defendant demonstrates understanding of charges, court process, and ability to assist counsel. The clinician determines whether these findings support competency."
     * Custody: "The following factors are relevant to the best-interests determination: [list evidence]. The clinician determines the custody recommendation."
   - If clinical: "Treatment considerations include..."
   Flag: draft_requiring_revision

QUALITY GATES:

For content_type = "fully_generated":
- Confidence should be 85-100
- Content is factual, organized, professional
- Minimal interpretation; clinician unlikely to revise

For content_type = "draft_requiring_revision":
- Confidence may be 60-85
- Content is a solid first draft addressing the section
- Clinician MUST review and may revise substantially
- Include notes flagging interpretation choices the clinician should review

GENERAL WRITING STANDARDS:
- Spell out all abbreviations on first use (e.g., "Major Depressive Disorder (MDD)")
- Use past tense for evaluation findings, present tense for ongoing symptoms if applicable
- Cite page numbers or section headings when referencing prior records
- Avoid hedging language unless genuinely uncertain ("possibly," "apparently," "may indicate", use judiciously)
- Use technical terminology appropriate to the audience (attorney vs. clinician vs. family)
- Maintain professional tone; avoid colloquialisms
- For test interpretation, reference the instrument manual and publisher guidance
- For diagnostic criteria, reference DSM-5-TR by criterion letter (e.g., "Criterion A")

CRITICAL CONTENT CONSTRAINTS:

1. Do NOT write diagnostic statements beyond what clinician selected at Gate 2
2. Do NOT generate risk opinions (e.g., "high risk of violence")
3. Do NOT state legal conclusions (competency, insanity, best interests)
4. Behavioral observations extracted from transcripts MUST be labeled and flagged draft_requiring_revision
5. Clinical formulation MUST be flagged draft_requiring_revision
6. Risk assessment MUST be flagged draft_requiring_revision with mandatory disclaimer
7. Do NOT invent supporting evidence not in case record
8. Do NOT invent collateral records or test scores
9. If clinician's Gate 2 decision conflicts with diagnostic evidence, DO NOT resolve,present clinician's decision and let clinician justify in later revision

TONE MATCHING:
If style guide is provided, match it:
- Formal vs. conversational? (typically formal in forensic, may vary in clinical)
- Prefer active vs. passive voice?
- Preferred citation style for prior records?
- Length expectations for sections?

OUTPUT FORMAT:
Return JSON array of section objects, each with section_name, content, content_type, sources, confidence.`;
async function runWriterAgent(caseId) {
  const caseRow = getCaseById(caseId);
  if (!caseRow) {
    return {
      status: "error",
      agentType: "writer",
      caseId,
      operationId: "",
      error: `Case ${caseId} not found`,
      durationMs: 0
    };
  }
  const ingestorResult = getLatestIngestorResult(caseId);
  if (!ingestorResult) {
    return {
      status: "error",
      agentType: "writer",
      caseId,
      operationId: "",
      error: "Ingestor has not been run yet. Run the Ingestor Agent first to build the case record.",
      durationMs: 0
    };
  }
  const diagnosticianResult = getLatestDiagnosticianResult(caseId);
  if (!diagnosticianResult) {
    return {
      status: "error",
      agentType: "writer",
      caseId,
      operationId: "",
      error: "Diagnostician has not been run yet. Run the Diagnostician Agent first to gather diagnostic decisions.",
      durationMs: 0
    };
  }
  if ((!diagnosticianResult.selected_diagnoses || diagnosticianResult.selected_diagnoses.length === 0) && (!diagnosticianResult.ruled_out_diagnoses || diagnosticianResult.ruled_out_diagnoses.length === 0)) {
    return {
      status: "error",
      agentType: "writer",
      caseId,
      operationId: "",
      error: "No diagnostic decisions found. The clinician must make at least one diagnostic decision in Gate 2.",
      durationMs: 0
    };
  }
  const apiKey = retrieveApiKey();
  if (!apiKey) {
    return {
      status: "error",
      agentType: "writer",
      caseId,
      operationId: "",
      error: "Anthropic API key not configured. Set your API key in Settings.",
      durationMs: 0
    };
  }
  const writerInput = JSON.stringify(
    {
      case_id: caseRow.case_number ?? `CASE-${caseId}`,
      case_record: ingestorResult,
      clinician_gate2_decisions: {
        selected_diagnoses: diagnosticianResult.selected_diagnoses ?? [],
        ruled_out_diagnoses: diagnosticianResult.ruled_out_diagnoses ?? [],
        functional_impairment_level: diagnosticianResult.functional_impairment_level ?? "unknown",
        forensic_conclusions: diagnosticianResult.forensic_conclusions ?? {}
      },
      style_guide: loadStyleProfile(),
      report_template: {
        report_type: caseRow.evaluation_type ?? "general",
        jurisdiction: "general",
        required_sections: [
          "Background History",
          "Behavioral Observations",
          "Test Results",
          "Diagnostic Impressions",
          "Recommendations"
        ]
      }
    },
    null,
    2
  );
  const config = {
    agentType: "writer",
    systemPrompt: WRITER_SYSTEM_PROMPT,
    caseId,
    inputTexts: [writerInput],
    maxTokens: 24e3,
    // Writer output can be large (multiple report sections)
    temperature: 0.2
    // Low temperature for consistency, but slightly higher than ingestor/diagnostician for prose quality
  };
  const result = await runAgent(apiKey, config);
  if (result.status === "success" && result.result) {
    try {
      saveWriterResult(caseId, result.operationId, result.result);
    } catch (e) {
      console.error("[writer] Failed to save result to DB:", e.message);
    }
  }
  return result;
}
function saveWriterResult(caseId, operationId, output) {
  const sqlite = getSqlite();
  const tables = sqlite.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='agent_results'"
  ).all();
  if (tables.length === 0) {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS agent_results (
        result_id INTEGER PRIMARY KEY AUTOINCREMENT,
        case_id INTEGER NOT NULL REFERENCES cases(case_id),
        agent_type TEXT NOT NULL CHECK(agent_type IN ('ingestor', 'diagnostician', 'writer', 'editor')),
        operation_id TEXT NOT NULL,
        result_json TEXT NOT NULL,
        version TEXT NOT NULL DEFAULT '1.0',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(case_id, agent_type, operation_id)
      )
    `);
    sqlite.exec(`
      CREATE INDEX IF NOT EXISTS idx_agent_results_case
        ON agent_results(case_id, agent_type)
    `);
  }
  sqlite.prepare(`
    INSERT INTO agent_results (case_id, agent_type, operation_id, result_json, version)
    VALUES (?, 'writer', ?, ?, ?)
  `).run(caseId, operationId, JSON.stringify(output), output.version ?? "1.0");
}
function getLatestWriterResult$1(caseId) {
  const sqlite = getSqlite();
  const tables = sqlite.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='agent_results'"
  ).all();
  if (tables.length === 0) return null;
  const row = sqlite.prepare(`
    SELECT result_json FROM agent_results
    WHERE case_id = ? AND agent_type = 'writer'
    ORDER BY created_at DESC
    LIMIT 1
  `).get(caseId);
  if (!row) return null;
  try {
    return JSON.parse(row.result_json);
  } catch {
    return null;
  }
}
function getLatestDiagnosticianResult(caseId) {
  const sqlite = getSqlite();
  const tables = sqlite.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='agent_results'"
  ).all();
  if (tables.length === 0) return null;
  const row = sqlite.prepare(`
    SELECT result_json FROM agent_results
    WHERE case_id = ? AND agent_type = 'diagnostician'
    ORDER BY created_at DESC
    LIMIT 1
  `).get(caseId);
  if (!row) return null;
  try {
    let parsed = JSON.parse(row.result_json);
    if (typeof parsed === "string") {
      const stripped = parsed.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
      try {
        parsed = JSON.parse(stripped);
      } catch {
        return null;
      }
    }
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    const result = parsed;
    try {
      const decisionTables = sqlite.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='diagnostic_decisions'"
      ).all();
      if (decisionTables.length > 0) {
        const decisions = sqlite.prepare(
          `SELECT diagnosis_key, icd_code, diagnosis_name, decision, clinician_notes
           FROM diagnostic_decisions WHERE case_id = ?`
        ).all(caseId);
        const selected = decisions.filter((d) => d.decision === "render").map((d) => ({
          diagnosis_key: d.diagnosis_key,
          icd_code: d.icd_code,
          diagnosis_name: d.diagnosis_name,
          clinician_notes: d.clinician_notes ?? ""
        }));
        const ruledOut = decisions.filter((d) => d.decision === "rule_out").map((d) => ({
          diagnosis_key: d.diagnosis_key,
          icd_code: d.icd_code,
          diagnosis_name: d.diagnosis_name,
          clinician_notes: d.clinician_notes ?? ""
        }));
        if (selected.length > 0) {
          result.selected_diagnoses = selected;
        }
        if (ruledOut.length > 0) {
          result.ruled_out_diagnoses = ruledOut;
        }
      }
    } catch (e) {
      console.error("[writer] Failed to merge diagnostic_decisions:", e.message);
    }
    return result;
  } catch {
    return null;
  }
}
const EDITOR_SYSTEM_PROMPT = `You are the Editor/Legal Reviewer Agent for Psygil, an AI tool for forensic and clinical psychologists. Your role is to review draft reports with a critical eye,flagging vulnerabilities, inconsistencies, and quality issues that could undermine credibility or legal defensibility.

CRITICAL PRINCIPLE: You are adversarial. You flag problems. You do not edit directly; you annotate and suggest fixes.

YOUR INPUTS:
- Draft report (from Writer Agent): sections array with prose content
- Confirmed case record: structured data that serves as ground truth
- Clinician's Gate 2 decisions: diagnoses selected and ruled out
- Evaluation type and jurisdiction (to assess legal standards)

YOUR REVIEW ROLE:
You read the draft report as if you were cross-examining the evaluation in court, or as a peer reviewer assessing scientific and clinical rigor. You look for:

1. SPECULATIVE LANGUAGE
   Flags when the report uses hedging, speculation, or unfounded assumptions
   Examples:
   - "The patient may have experienced trauma in childhood" (no evidence)
   - "Symptoms possibly indicate bipolar disorder" (not clinician's diagnosis)
   - "It is likely that the patient has..." (unfounded inference)
   Action: Suggest precise language grounded in evidence or remove speculation

2. UNSUPPORTED CONCLUSIONS
   Flags when claims are made without citing supporting evidence
   Examples:
   - "The patient demonstrates poor insight" (not documented in observations or tests)
   - "Family history suggests genetic predisposition" (no family psychiatric history in record)
   - "The patient is at high risk for violence" (no risk assessment instrument administered)
   Action: Cite the supporting evidence or revise/remove

3. LEGAL VULNERABILITIES
   Flags statements that could be challenged on Daubert/Frye grounds or that misstate legal standards
   Examples:
   - "The defendant is competent to stand trial" (clinician should not state legal conclusion)
   - "This patient is a danger to self and others" (overstated without specific evidence)
   - "The defendant was insane at the time of the offense" (legal conclusion, not clinical finding)
   - Report uses outdated psychological instruments or theory not accepted in jurisdiction
   Action: Reframe as clinical findings; remove legal conclusions; suggest appropriate framing

4. FACTUAL INCONSISTENCY
   Flags when report statements contradict case record or prior statements in report
   Examples:
   - Report states "Patient has no history of psychiatric treatment" but collateral record documents prior hospitalization
   - Report states "MMPI-3 validity is acceptable" but VRIN-T is elevated
   - Report says "Patient denies hearing voices" but later states "auditory hallucinations reported"
   Action: Identify the contradiction and suggest reconciliation

5. DAUBERT/FRYE RISK
   Flags use of unreliable instruments, methods, or interpretations
   Examples:
   - Graphology analysis (not scientifically valid)
   - Interpretation of MMPI scores outside publisher's guidelines
   - Claim of "repressed memory" recovery (controversial, not standard practice)
   - Use of projective instruments (TAT, Rorschach) for diagnosis without full protocols
   Action: Suggest removal or qualification with disclaimer

6. OVERSTATEMENT
   Flags language that exaggerates findings or conclusions
   Examples:
   - "Patient is completely unable to care for self" (but description shows some functioning)
   - "Clearly demonstrates severe psychosis" (descriptors do not match actual content)
   - "Absolutely no capacity for rational thought" (absolute language without nuance)
   Action: Suggest more measured, precise language

7. MISSING CAVEAT
   Flags when important limitations, confounds, or alternative explanations are not mentioned
   Examples:
   - Report interprets depression scores but does not note that medical condition (thyroid disorder) was not ruled out
   - Report makes cognitive conclusions without noting patient was on sedating medication
   - Behavioral observations from transcript not flagged as such
   - Report does not note missing collateral records that would strengthen conclusions
   Action: Suggest adding caveat or limitation

8. SOURCE MISMATCH
   Flags when evidence cited does not actually support the claim, or source is misattributed
   Examples:
   - Citation to test score that was not administered
   - Paraphrase of collateral record that contradicts actual wording
   - Attribution to "patient reported" when source was clinician inference
   Action: Identify correct source or revise claim

9. DIAGNOSTIC OVERREACH
   Flags when report states diagnoses or conclusions that differ from or exceed what clinician selected at Gate 2
   CRITICAL: This ensures Writer Agent did not editorialize the diagnostic section.
   Examples:
   - Clinician selected only MDD at Gate 2; report suggests GAD as comorbidity without clinician decision
   - Clinician ruled out Bipolar II; report says "cannot definitively rule out bipolar features"
   - Clinician did not select any personality disorder; report contains extensive formulation of personality pathology
   Action: Flag and ask clinician to confirm diagnosis or revise report

REVIEW PROCESS:

1. Compare each clinical claim in report to case record evidence
2. Check that every diagnosis mentioned was explicitly selected (or ruled out with explanation) at Gate 2
3. Verify that test scores and classifications cited match what was in test administration records
4. Verify that behavioral observations labeled "transcript-derived" are actually from transcripts
5. Verify that collateral facts cited actually appear in collateral_summary
6. Scan for hedging language (may, might, possibly, perhaps, appears to, seems, likely, suggests, etc.) and assess if warranted by evidence
7. Check for absolute language (never, always, completely, totally, absolutely) and assess if supported
8. Identify missing data (e.g., "patient states no psychiatric history" when no treatment history was documented) and flag as potential gap
9. For forensic reports: Verify that legal standards are correctly stated and that clinician has not made legal conclusions
10. For risk assessment: Verify that risk factors are cited from validated instruments or case evidence, not clinician speculation
11. Check that any cautions about validity, missing data, or alternative explanations are clearly stated

FLAG SEVERITY LEVELS:

- CRITICAL: Error that could undermine entire report or expose clinician to legal challenge
  Examples: Fundamental factual error, legal conclusion stated, instrument misused
- HIGH: Significant quality or accuracy issue requiring revision
  Examples: Unsupported major conclusion, major contradiction, missing critical caveat
- MEDIUM: Quality issue that should be addressed
  Examples: Speculative language, minor inconsistency, hedging without basis
- LOW: Minor issue or improvement suggestion
  Examples: Tone, clarity, organizational suggestion

OUTPUT FORMAT:
Return JSON object with review_summary, annotations array, and revision_priorities array.

TONE:
Professional, objective, constructive. Your suggestions are for improvement and legal protection, not criticism.`;
async function runEditorAgent(caseId) {
  const caseRow = getCaseById(caseId);
  if (!caseRow) {
    return {
      status: "error",
      agentType: "editor",
      caseId,
      operationId: "",
      error: `Case ${caseId} not found`,
      durationMs: 0
    };
  }
  const draftReport = getLatestWriterResult(caseId);
  if (!draftReport) {
    return {
      status: "error",
      agentType: "editor",
      caseId,
      operationId: "",
      error: "No draft report found. Run Writer Agent before Editor Agent.",
      durationMs: 0
    };
  }
  const ingestorResult = getLatestIngestorResult(caseId);
  if (!ingestorResult) {
    return {
      status: "error",
      agentType: "editor",
      caseId,
      operationId: "",
      error: "No ingestor result found. Run Ingestor Agent before Editor Agent.",
      durationMs: 0
    };
  }
  const gate2Decisions = {};
  const intake = getIntake(caseId);
  const apiKey = retrieveApiKey();
  if (!apiKey) {
    return {
      status: "error",
      agentType: "editor",
      caseId,
      operationId: "",
      error: "Anthropic API key not configured. Set your API key in Settings.",
      durationMs: 0
    };
  }
  const inputPayload = JSON.stringify(
    {
      case_id: caseRow.case_number ?? `CASE-${caseId}`,
      draft_report: draftReport,
      case_record: ingestorResult,
      clinician_gate2_decisions: gate2Decisions,
      evaluation_type: caseRow.evaluation_type ?? "other",
      jurisdiction: intake?.jurisdiction ?? void 0
    },
    null,
    2
  );
  const config = {
    agentType: "editor",
    systemPrompt: EDITOR_SYSTEM_PROMPT,
    caseId,
    inputTexts: [inputPayload],
    maxTokens: 2e4,
    // Editor output can include many annotations
    temperature: 0
  };
  const result = await runAgent(apiKey, config);
  if (result.status === "success" && result.result) {
    try {
      saveEditorResult(caseId, result.operationId, result.result);
    } catch (e) {
      console.error("[editor] Failed to save result to DB:", e.message);
    }
  }
  return result;
}
function saveEditorResult(caseId, operationId, output) {
  const sqlite = getSqlite();
  const tables = sqlite.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='agent_results'"
  ).all();
  if (tables.length === 0) {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS agent_results (
        result_id INTEGER PRIMARY KEY AUTOINCREMENT,
        case_id INTEGER NOT NULL REFERENCES cases(case_id),
        agent_type TEXT NOT NULL CHECK(agent_type IN ('ingestor', 'diagnostician', 'writer', 'editor')),
        operation_id TEXT NOT NULL,
        result_json TEXT NOT NULL,
        version TEXT NOT NULL DEFAULT '1.0',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(case_id, agent_type, operation_id)
      )
    `);
    sqlite.exec(`
      CREATE INDEX IF NOT EXISTS idx_agent_results_case
        ON agent_results(case_id, agent_type)
    `);
  }
  sqlite.prepare(`
    INSERT INTO agent_results (case_id, agent_type, operation_id, result_json, version)
    VALUES (?, 'editor', ?, ?, ?)
  `).run(caseId, operationId, JSON.stringify(output), output.version ?? "1.0");
}
function getLatestEditorResult(caseId) {
  const sqlite = getSqlite();
  const tables = sqlite.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='agent_results'"
  ).all();
  if (tables.length === 0) return null;
  const row = sqlite.prepare(`
    SELECT result_json FROM agent_results
    WHERE case_id = ? AND agent_type = 'editor'
    ORDER BY created_at DESC
    LIMIT 1
  `).get(caseId);
  if (!row) return null;
  try {
    return JSON.parse(row.result_json);
  } catch {
    return null;
  }
}
function getLatestWriterResult(caseId) {
  const sqlite = getSqlite();
  const tables = sqlite.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='agent_results'"
  ).all();
  if (tables.length === 0) return null;
  const row = sqlite.prepare(`
    SELECT result_json FROM agent_results
    WHERE case_id = ? AND agent_type = 'writer'
    ORDER BY created_at DESC
    LIMIT 1
  `).get(caseId);
  if (!row) return null;
  try {
    return JSON.parse(row.result_json);
  } catch {
    return null;
  }
}
const agentStatusMap = /* @__PURE__ */ new Map();
let currentOperation = null;
function updateStatus(operationId, status) {
  agentStatusMap.set(operationId, status);
}
function getStatus(operationId) {
  return agentStatusMap.get(operationId);
}
function ok$6(data) {
  return { status: "success", data };
}
function fail$6(error_code, message) {
  return { status: "error", error_code, message };
}
async function handleAgentRun(_event, params) {
  try {
    if (!isValidAgentType(params.agentType)) {
      return fail$6("INVALID_AGENT_TYPE", `Invalid agent type: ${params.agentType}`);
    }
    if (!Number.isInteger(params.caseId) || params.caseId <= 0) {
      return fail$6("INVALID_CASE_ID", `Invalid case ID: ${params.caseId}`);
    }
    if (!Array.isArray(params.inputTexts) || params.inputTexts.length === 0) {
      return fail$6("INVALID_INPUT", "inputTexts must be a non-empty array");
    }
    const apiKey = retrieveApiKey();
    if (!apiKey) {
      return fail$6("NO_API_KEY", "Anthropic API key not configured");
    }
    const config = {
      agentType: params.agentType,
      systemPrompt: params.systemPrompt,
      caseId: params.caseId,
      inputTexts: params.inputTexts,
      context: params.context,
      maxTokens: params.maxTokens,
      temperature: params.temperature
    };
    const operationId = crypto.randomUUID();
    updateStatus(operationId, {
      operationId,
      agentType: params.agentType,
      caseId: params.caseId,
      status: "queued",
      startedAt: Date.now()
    });
    currentOperation = operationId;
    const result = await runAgent(apiKey, config);
    currentOperation = null;
    if (result.status === "success") {
      updateStatus(operationId, {
        operationId,
        agentType: params.agentType,
        caseId: params.caseId,
        status: "done",
        startedAt: Date.now() - (result.durationMs || 0),
        completedAt: Date.now(),
        tokenUsage: result.tokenUsage
      });
    } else {
      updateStatus(operationId, {
        operationId,
        agentType: params.agentType,
        caseId: params.caseId,
        status: "error",
        startedAt: Date.now() - (result.durationMs || 0),
        completedAt: Date.now(),
        error: result.error
      });
    }
    return ok$6({
      operationId,
      agentType: params.agentType,
      caseId: params.caseId,
      status: result.status,
      result: result.result,
      error: result.error,
      tokenUsage: result.tokenUsage,
      durationMs: result.durationMs
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Agent execution failed";
    return fail$6("AGENT_RUN_FAILED", message);
  }
}
function handleAgentStatus(_event, operationId) {
  try {
    if (operationId) {
      const status2 = getStatus(operationId);
      if (!status2) {
        return fail$6("OPERATION_NOT_FOUND", `Operation ${operationId} not found`);
      }
      return ok$6({
        operationId: status2.operationId,
        agentType: status2.agentType,
        caseId: status2.caseId,
        status: status2.status,
        elapsedMs: Date.now() - status2.startedAt,
        tokenUsage: status2.tokenUsage
      });
    }
    if (!currentOperation) {
      return ok$6({
        operationId: null,
        agentType: null,
        caseId: null,
        status: "idle",
        elapsedMs: 0
      });
    }
    const status = getStatus(currentOperation);
    if (!status) {
      return ok$6({
        operationId: null,
        agentType: null,
        caseId: null,
        status: "idle",
        elapsedMs: 0
      });
    }
    return ok$6({
      operationId: status.operationId,
      agentType: status.agentType,
      caseId: status.caseId,
      status: status.status,
      elapsedMs: Date.now() - status.startedAt,
      tokenUsage: status.tokenUsage
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to get agent status";
    return fail$6("AGENT_STATUS_FAILED", message);
  }
}
function registerAgentHandlers() {
  electron.ipcMain.handle("agent:run", handleAgentRun);
  electron.ipcMain.handle("agent:status", handleAgentStatus);
  electron.ipcMain.handle(
    "ingestor:run",
    async (_event, params) => {
      try {
        const result = await runIngestorAgent(params.caseId);
        return ok$6({
          operationId: result.operationId,
          caseId: result.caseId,
          status: result.status,
          result: result.result,
          error: result.error,
          tokenUsage: result.tokenUsage,
          durationMs: result.durationMs
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Ingestor failed";
        return fail$6("INGESTOR_RUN_FAILED", message);
      }
    }
  );
  electron.ipcMain.handle(
    "ingestor:getResult",
    (_event, params) => {
      try {
        const result = getLatestIngestorResult(params.caseId);
        if (!result) {
          return fail$6("NO_RESULT", "No ingestor result found for this case");
        }
        return ok$6(result);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to get ingestor result";
        return fail$6("INGESTOR_GET_FAILED", message);
      }
    }
  );
  electron.ipcMain.handle(
    "diagnostician:run",
    async (_event, params) => {
      try {
        const result = await runDiagnosticianAgent(params.caseId);
        return ok$6({
          operationId: result.operationId,
          caseId: result.caseId,
          status: result.status,
          result: result.result,
          error: result.error,
          tokenUsage: result.tokenUsage,
          durationMs: result.durationMs
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Diagnostician failed";
        return fail$6("DIAGNOSTICIAN_RUN_FAILED", message);
      }
    }
  );
  electron.ipcMain.handle(
    "diagnostician:getResult",
    (_event, params) => {
      try {
        const result = getLatestDiagnosticianResult$1(params.caseId);
        if (!result) {
          return fail$6("NO_RESULT", "No diagnostician result found for this case");
        }
        return ok$6(result);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to get diagnostician result";
        return fail$6("DIAGNOSTICIAN_GET_FAILED", message);
      }
    }
  );
  electron.ipcMain.handle(
    "writer:run",
    async (_event, params) => {
      try {
        const result = await runWriterAgent(params.caseId);
        return ok$6({
          operationId: result.operationId,
          caseId: result.caseId,
          status: result.status,
          result: result.result,
          error: result.error,
          tokenUsage: result.tokenUsage,
          durationMs: result.durationMs
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Writer failed";
        return fail$6("WRITER_RUN_FAILED", message);
      }
    }
  );
  electron.ipcMain.handle(
    "writer:getResult",
    (_event, params) => {
      try {
        const result = getLatestWriterResult$1(params.caseId);
        if (!result) {
          return fail$6("NO_RESULT", "No writer result found for this case");
        }
        return ok$6(result);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to get writer result";
        return fail$6("WRITER_GET_FAILED", message);
      }
    }
  );
  electron.ipcMain.handle(
    "editor:run",
    async (_event, params) => {
      try {
        const result = await runEditorAgent(params.caseId);
        return ok$6({
          operationId: result.operationId,
          caseId: result.caseId,
          status: result.status,
          result: result.result,
          error: result.error,
          tokenUsage: result.tokenUsage,
          durationMs: result.durationMs
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Editor failed";
        return fail$6("EDITOR_RUN_FAILED", message);
      }
    }
  );
  electron.ipcMain.handle(
    "editor:getResult",
    (_event, params) => {
      try {
        const result = getLatestEditorResult(params.caseId);
        if (!result) {
          return fail$6("NO_RESULT", "No editor result found for this case");
        }
        return ok$6(result);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to get editor result";
        return fail$6("EDITOR_GET_FAILED", message);
      }
    }
  );
}
function ensureTable$2() {
  const sqlite = getSqlite();
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS data_confirmation (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id INTEGER NOT NULL REFERENCES cases(case_id),
      category_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('unreviewed', 'confirmed', 'corrected', 'flagged')),
      notes TEXT DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(case_id, category_id)
    )
  `);
}
function saveDataConfirmation(caseId, categoryId, status, notes = "") {
  ensureTable$2();
  const sqlite = getSqlite();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const validStatuses = ["unreviewed", "confirmed", "corrected", "flagged"];
  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid confirmation status: ${status}`);
  }
  sqlite.prepare(
    `INSERT INTO data_confirmation (case_id, category_id, status, notes, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(case_id, category_id) DO UPDATE SET
         status = excluded.status,
         notes = excluded.notes,
         updated_at = excluded.updated_at`
  ).run(caseId, categoryId, status, notes, now);
}
function getDataConfirmation(caseId) {
  ensureTable$2();
  const sqlite = getSqlite();
  const rows = sqlite.prepare(
    `SELECT id, case_id, category_id, status, notes, updated_at
       FROM data_confirmation
       WHERE case_id = ?
       ORDER BY updated_at DESC`
  ).all(caseId);
  return rows;
}
function isDataConfirmationComplete(caseId) {
  ensureTable$2();
  getSqlite();
  const requiredCategories = ["demographics", "referral_questions"];
  const confirmationStates = getDataConfirmation(caseId);
  const stateMap = /* @__PURE__ */ new Map();
  for (const row of confirmationStates) {
    stateMap.set(row.category_id, row.status);
  }
  for (const catId of requiredCategories) {
    const status = stateMap.get(catId);
    if (status !== "confirmed" && status !== "corrected") {
      return false;
    }
  }
  return true;
}
const PIPELINE_STAGES = [
  "onboarding",
  "testing",
  "interview",
  "diagnostics",
  "review",
  "complete"
];
const STAGE_ORDER = {
  onboarding: 0,
  testing: 1,
  interview: 2,
  diagnostics: 3,
  review: 4,
  complete: 5
};
const ADVANCEMENT_CONDITIONS = {
  onboarding: (caseRow) => {
    getSqlite();
    const intake = getIntake(caseRow.case_id);
    if (!intake || intake.status !== "complete") {
      return { canAdvance: false, reason: "Intake form not marked complete" };
    }
    const documents2 = listDocuments(caseRow.case_id);
    if (documents2.length === 0) {
      return { canAdvance: false, reason: "No documents uploaded yet" };
    }
    if (!isDataConfirmationComplete(caseRow.case_id)) {
      return { canAdvance: false, reason: "Data confirmation incomplete, review extracted data before advancing" };
    }
    return { canAdvance: true, reason: "Intake complete, documents uploaded, and data confirmed" };
  },
  testing: (caseRow) => {
    const documents2 = listDocuments(caseRow.case_id);
    const testingDocs = documents2.filter(
      (d) => d.document_type === "score_report" || d.file_path && d.file_path.includes("/Testing/")
    );
    if (testingDocs.length > 0) {
      return { canAdvance: true, reason: "Test results documented" };
    }
    const sqlite = getSqlite();
    const scoreCount = sqlite.prepare("SELECT count(*) as n FROM test_scores WHERE case_id = ?").get(caseRow.case_id).n;
    if (scoreCount > 0) {
      return { canAdvance: true, reason: "Test scores entered" };
    }
    return { canAdvance: false, reason: "No test result documents or scores found" };
  },
  interview: (caseRow) => {
    const documents2 = listDocuments(caseRow.case_id);
    const interviewDocs = documents2.filter(
      (d) => d.document_type === "transcript_vtt" || d.file_path && d.file_path.includes("/Interviews/")
    );
    if (interviewDocs.length === 0) {
      return { canAdvance: false, reason: "No interview documents found" };
    }
    const sqlite = getSqlite();
    const ingestorResult = sqlite.prepare(
      `SELECT result_id FROM agent_results
         WHERE case_id = ? AND agent_type = 'ingestor'
         ORDER BY created_at DESC LIMIT 1`
    ).get(caseRow.case_id);
    if (!ingestorResult) {
      return { canAdvance: false, reason: "Ingestor agent has not been run yet" };
    }
    return { canAdvance: true, reason: "Interviews documented and ingestor complete" };
  },
  diagnostics: (caseRow) => {
    const sqlite = getSqlite();
    const diagnosticianResult = sqlite.prepare(
      `SELECT result_id FROM agent_results
         WHERE case_id = ? AND agent_type = 'diagnostician'
         ORDER BY created_at DESC LIMIT 1`
    ).get(caseRow.case_id);
    if (!diagnosticianResult) {
      return { canAdvance: false, reason: "Diagnostician agent has not been run yet" };
    }
    return { canAdvance: true, reason: "Diagnostician complete and decisions recorded" };
  },
  review: (caseRow) => {
    const sqlite = getSqlite();
    const writerResult = sqlite.prepare(
      `SELECT result_id FROM agent_results
         WHERE case_id = ? AND agent_type = 'writer'
         ORDER BY created_at DESC LIMIT 1`
    ).get(caseRow.case_id);
    if (!writerResult) {
      return { canAdvance: false, reason: "Writer agent has not been run yet" };
    }
    const editorResult = sqlite.prepare(
      `SELECT result_id FROM agent_results
         WHERE case_id = ? AND agent_type = 'editor'
         ORDER BY created_at DESC LIMIT 1`
    ).get(caseRow.case_id);
    if (!editorResult) {
      return { canAdvance: false, reason: "Editor agent has not been run yet" };
    }
    const attestationExists = sqlite.prepare(
      `SELECT audit_log_id FROM audit_log
         WHERE case_id = ? AND action_type = 'attestation_signed'
         LIMIT 1`
    ).get(caseRow.case_id);
    if (!attestationExists) {
      return { canAdvance: false, reason: "Attestation has not been recorded" };
    }
    return { canAdvance: true, reason: "Report reviewed and attested" };
  },
  complete: (_caseRow) => {
    return { canAdvance: false, reason: "Case is already complete" };
  }
};
function checkStageAdvancement(caseId) {
  const caseRow = getCaseById(caseId);
  if (!caseRow) {
    return {
      canAdvance: false,
      currentStage: "onboarding",
      nextStage: null,
      reason: `Case ${caseId} not found`
    };
  }
  const rawStage = caseRow.workflow_current_stage ?? "onboarding";
  const LEGACY_MAP = {
    gate_1: "testing",
    gate_2: "diagnostics",
    intake: "onboarding"
  };
  let currentStage = LEGACY_MAP[rawStage] ?? rawStage;
  if (STAGE_ORDER[currentStage] === void 0) {
    currentStage = "onboarding";
  }
  if (currentStage === "complete") {
    return {
      canAdvance: false,
      currentStage,
      nextStage: null,
      reason: "Case is already complete"
    };
  }
  const conditionChecker = ADVANCEMENT_CONDITIONS[currentStage];
  if (!conditionChecker) {
    return {
      canAdvance: false,
      currentStage,
      nextStage: null,
      reason: `Unknown stage: ${currentStage}`
    };
  }
  const { canAdvance, reason } = conditionChecker(caseRow);
  const currentIndex = STAGE_ORDER[currentStage];
  const nextStage = currentIndex < PIPELINE_STAGES.length - 1 ? PIPELINE_STAGES[currentIndex + 1] : null;
  return {
    canAdvance,
    currentStage,
    nextStage,
    reason
  };
}
function advanceStage(caseId) {
  const check = checkStageAdvancement(caseId);
  if (!check.canAdvance) {
    throw new Error(`Cannot advance case ${caseId}: ${check.reason}`);
  }
  if (!check.nextStage) {
    throw new Error(`Case ${caseId} is already at the final stage`);
  }
  const previousStage = check.currentStage;
  const newStage = check.nextStage;
  const sqlite = getSqlite();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  sqlite.prepare(
    `UPDATE cases
       SET workflow_current_stage = ?, last_modified = ?
       WHERE case_id = ?`
  ).run(newStage, now, caseId);
  try {
    const tables = sqlite.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='case_audit_log'"
    ).all();
    if (tables.length > 0) {
      sqlite.prepare(
        `INSERT INTO case_audit_log (case_id, action, actor_type, actor_id, timestamp, details)
           VALUES (?, ?, ?, ?, ?, ?)`
      ).run(
        caseId,
        "stage_advanced",
        "system",
        0,
        now,
        JSON.stringify({ from: previousStage, to: newStage })
      );
    }
  } catch (e) {
    console.error("[pipeline] Failed to log stage advancement:", e.message);
  }
  return {
    success: true,
    newStage,
    previousStage
  };
}
function getStageConditions(stage) {
  const conditions = {
    onboarding: [
      "Intake form must be marked complete",
      "At least one document must be uploaded",
      "Extracted data must be reviewed and confirmed"
    ],
    testing: ["At least one test result document must be uploaded"],
    interview: [
      "At least one interview document must be uploaded",
      "Ingestor agent must complete the case review"
    ],
    diagnostics: [
      "Diagnostician agent must review the case and present diagnostic options",
      "Clinician must accept or reject each diagnosis option"
    ],
    review: [
      "Writer agent must draft the report",
      "Editor agent must complete legal review",
      "Clinician must attest to the report accuracy"
    ],
    complete: [
      "Case is complete, no further advancement possible"
    ]
  };
  return conditions[stage] ?? [];
}
function ok$5(data) {
  return { status: "success", data };
}
function fail$5(error_code, message) {
  return { status: "error", error_code, message };
}
function broadcastCasesChanged(caseId, newStage, previousStage) {
  const windows = electron.BrowserWindow.getAllWindows();
  console.log(`[pipeline] broadcasting cases:changed to ${windows.length} window(s) (case ${caseId}: ${previousStage} → ${newStage})`);
  for (const win of windows) {
    if (!win.isDestroyed()) {
      win.webContents.send("cases:changed", { caseId, newStage, previousStage });
    }
  }
}
function handlePipelineCheck(_event, params) {
  try {
    const check = checkStageAdvancement(params.caseId);
    const result = {
      canAdvance: check.canAdvance,
      currentStage: check.currentStage,
      nextStage: check.nextStage,
      reason: check.reason
    };
    return ok$5(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return fail$5("PIPELINE_CHECK_FAILED", `Failed to check stage advancement: ${message}`);
  }
}
function handlePipelineAdvance(_event, params) {
  try {
    const result = advanceStage(params.caseId);
    const advanceResult = {
      success: result.success,
      newStage: result.newStage,
      previousStage: result.previousStage
    };
    if (result.success && result.newStage) {
      broadcastCasesChanged(params.caseId, result.newStage, result.previousStage ?? "");
    }
    return ok$5(advanceResult);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return fail$5("PIPELINE_ADVANCE_FAILED", `Failed to advance stage: ${message}`);
  }
}
function handlePipelineSetStage(_event, params) {
  try {
    const db = getSqlite();
    const row = db.prepare("SELECT workflow_current_stage FROM cases WHERE case_id = ?").get(params.caseId);
    if (!row) return fail$5("CASE_NOT_FOUND", `Case ${params.caseId} not found`);
    const previousStage = row.workflow_current_stage || "onboarding";
    const newStatus = params.stage === "complete" ? "completed" : "in_progress";
    db.prepare("UPDATE cases SET workflow_current_stage = ?, case_status = ?, last_modified = datetime('now') WHERE case_id = ?").run(params.stage, newStatus, params.caseId);
    console.log(`[pipeline] Stage set: case ${params.caseId} ${previousStage} → ${params.stage}`);
    broadcastCasesChanged(params.caseId, params.stage, previousStage);
    return ok$5({ success: true, newStage: params.stage, previousStage });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return fail$5("PIPELINE_SET_STAGE_FAILED", `Failed to set stage: ${message}`);
  }
}
function handlePipelineConditions(_event, params) {
  try {
    const conditions = getStageConditions(params.stage);
    const result = {
      stage: params.stage,
      conditions
    };
    return ok$5(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return fail$5("PIPELINE_CONDITIONS_FAILED", `Failed to retrieve conditions: ${message}`);
  }
}
function registerPipelineHandlers() {
  electron.ipcMain.handle("pipeline:check", handlePipelineCheck);
  electron.ipcMain.handle("pipeline:advance", handlePipelineAdvance);
  electron.ipcMain.handle("pipeline:set-stage", handlePipelineSetStage);
  electron.ipcMain.handle("pipeline:conditions", handlePipelineConditions);
  console.log("[pipeline] IPC handlers registered: pipeline:check, pipeline:advance, pipeline:set-stage, pipeline:conditions");
}
function ensureTable$1() {
  const sqlite = getSqlite();
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS diagnostic_decisions (
      decision_id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id INTEGER NOT NULL REFERENCES cases(case_id),
      diagnosis_key TEXT NOT NULL,
      icd_code TEXT NOT NULL DEFAULT '',
      diagnosis_name TEXT NOT NULL,
      decision TEXT NOT NULL CHECK(decision IN ('render', 'rule_out', 'defer')),
      clinician_notes TEXT NOT NULL DEFAULT '',
      decided_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(case_id, diagnosis_key)
    )
  `);
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_diag_decisions_case
      ON diagnostic_decisions(case_id)
  `);
}
function saveDecision(params) {
  ensureTable$1();
  const sqlite = getSqlite();
  sqlite.prepare(`
    INSERT INTO diagnostic_decisions (case_id, diagnosis_key, icd_code, diagnosis_name, decision, clinician_notes)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(case_id, diagnosis_key) DO UPDATE SET
      icd_code = excluded.icd_code,
      diagnosis_name = excluded.diagnosis_name,
      decision = excluded.decision,
      clinician_notes = excluded.clinician_notes,
      updated_at = datetime('now')
  `).run(
    params.case_id,
    params.diagnosis_key,
    params.icd_code,
    params.diagnosis_name,
    params.decision,
    params.clinician_notes || ""
  );
  return sqlite.prepare(`
    SELECT * FROM diagnostic_decisions
    WHERE case_id = ? AND diagnosis_key = ?
  `).get(params.case_id, params.diagnosis_key);
}
function listDecisions(caseId) {
  ensureTable$1();
  const sqlite = getSqlite();
  return sqlite.prepare(`
    SELECT * FROM diagnostic_decisions
    WHERE case_id = ?
    ORDER BY decided_at ASC
  `).all(caseId);
}
function deleteDecision(caseId, diagnosisKey) {
  ensureTable$1();
  const sqlite = getSqlite();
  const result = sqlite.prepare(`
    DELETE FROM diagnostic_decisions
    WHERE case_id = ? AND diagnosis_key = ?
  `).run(caseId, diagnosisKey);
  return result.changes > 0;
}
function ensureFormulationTable() {
  const sqlite = getSqlite();
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS clinical_formulations (
      formulation_id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id INTEGER NOT NULL REFERENCES cases(case_id),
      formulation_text TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(case_id)
    )
  `);
}
function saveFormulation(params) {
  ensureFormulationTable();
  const sqlite = getSqlite();
  sqlite.prepare(`
    INSERT INTO clinical_formulations (case_id, formulation_text)
    VALUES (?, ?)
    ON CONFLICT(case_id) DO UPDATE SET
      formulation_text = excluded.formulation_text,
      updated_at = datetime('now')
  `).run(params.case_id, params.formulation_text);
  return sqlite.prepare(`
    SELECT * FROM clinical_formulations WHERE case_id = ?
  `).get(params.case_id);
}
function getFormulation(caseId) {
  ensureFormulationTable();
  const sqlite = getSqlite();
  const row = sqlite.prepare(`
    SELECT * FROM clinical_formulations WHERE case_id = ?
  `).get(caseId);
  return row ?? null;
}
function ok$4(data) {
  return { status: "success", data };
}
function fail$4(error_code, message) {
  return { status: "error", error_code, message };
}
function registerDecisionHandlers() {
  electron.ipcMain.handle(
    "diagnosticDecision:save",
    (_event, params) => {
      try {
        const row = saveDecision(params);
        return ok$4(row);
      } catch (e) {
        return fail$4("DECISION_SAVE_FAILED", e instanceof Error ? e.message : "Failed to save decision");
      }
    }
  );
  electron.ipcMain.handle(
    "diagnosticDecision:list",
    (_event, params) => {
      try {
        const rows = listDecisions(params.case_id);
        return ok$4(rows);
      } catch (e) {
        return fail$4("DECISION_LIST_FAILED", e instanceof Error ? e.message : "Failed to list decisions");
      }
    }
  );
  electron.ipcMain.handle(
    "diagnosticDecision:delete",
    (_event, params) => {
      try {
        deleteDecision(params.case_id, params.diagnosis_key);
        return ok$4(void 0);
      } catch (e) {
        return fail$4("DECISION_DELETE_FAILED", e instanceof Error ? e.message : "Failed to delete decision");
      }
    }
  );
  electron.ipcMain.handle(
    "clinicalFormulation:save",
    (_event, params) => {
      try {
        const row = saveFormulation(params);
        return ok$4(row);
      } catch (e) {
        return fail$4("FORMULATION_SAVE_FAILED", e instanceof Error ? e.message : "Failed to save formulation");
      }
    }
  );
  electron.ipcMain.handle(
    "clinicalFormulation:get",
    (_event, params) => {
      try {
        const row = getFormulation(params.case_id);
        return ok$4(row);
      } catch (e) {
        return fail$4("FORMULATION_GET_FAILED", e instanceof Error ? e.message : "Failed to get formulation");
      }
    }
  );
}
function ensureTable() {
  const sqlite = getSqlite();
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS test_scores (
      score_id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id INTEGER NOT NULL REFERENCES cases(case_id),
      instrument_name TEXT NOT NULL,
      instrument_abbrev TEXT NOT NULL DEFAULT '',
      administration_date TEXT NOT NULL,
      data_entry_method TEXT NOT NULL DEFAULT 'manual',
      scores_json TEXT NOT NULL DEFAULT '[]',
      validity_scores_json TEXT NOT NULL DEFAULT '[]',
      clinical_narrative TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(case_id, instrument_name)
    )
  `);
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_test_scores_case
      ON test_scores(case_id)
  `);
}
function toPublicRow(raw) {
  return {
    score_id: raw.score_id,
    case_id: raw.case_id,
    instrument_name: raw.instrument_name,
    instrument_abbrev: raw.instrument_abbrev,
    administration_date: raw.administration_date,
    data_entry_method: raw.data_entry_method,
    scores: JSON.parse(raw.scores_json),
    validity_scores: JSON.parse(raw.validity_scores_json),
    clinical_narrative: raw.clinical_narrative,
    notes: raw.notes,
    created_at: raw.created_at,
    updated_at: raw.updated_at
  };
}
function saveTestScores(params) {
  ensureTable();
  const sqlite = getSqlite();
  const scoresJson = JSON.stringify(params.scores);
  const validityJson = JSON.stringify(params.validity_scores ?? []);
  sqlite.prepare(`
    INSERT INTO test_scores (
      case_id, instrument_name, instrument_abbrev, administration_date,
      data_entry_method, scores_json, validity_scores_json,
      clinical_narrative, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(case_id, instrument_name) DO UPDATE SET
      instrument_abbrev = excluded.instrument_abbrev,
      administration_date = excluded.administration_date,
      data_entry_method = excluded.data_entry_method,
      scores_json = excluded.scores_json,
      validity_scores_json = excluded.validity_scores_json,
      clinical_narrative = excluded.clinical_narrative,
      notes = excluded.notes,
      updated_at = datetime('now')
  `).run(
    params.case_id,
    params.instrument_name,
    params.instrument_abbrev,
    params.administration_date,
    params.data_entry_method,
    scoresJson,
    validityJson,
    params.clinical_narrative ?? "",
    params.notes ?? ""
  );
  const raw = sqlite.prepare(`
    SELECT * FROM test_scores
    WHERE case_id = ? AND instrument_name = ?
  `).get(params.case_id, params.instrument_name);
  return toPublicRow(raw);
}
function listTestScores(caseId) {
  ensureTable();
  const sqlite = getSqlite();
  const rows = sqlite.prepare(`
    SELECT * FROM test_scores
    WHERE case_id = ?
    ORDER BY administration_date ASC, score_id ASC
  `).all(caseId);
  return rows.map(toPublicRow);
}
function deleteTestScores(scoreId) {
  ensureTable();
  const sqlite = getSqlite();
  const result = sqlite.prepare(`
    DELETE FROM test_scores WHERE score_id = ?
  `).run(scoreId);
  return result.changes > 0;
}
function ok$3(data) {
  return { status: "success", data };
}
function fail$3(error_code, message) {
  return { status: "error", error_code, message };
}
function registerScoreHandlers() {
  electron.ipcMain.handle(
    "testScores:save",
    (_event, params) => {
      try {
        const row = saveTestScores(params);
        return ok$3(row);
      } catch (e) {
        return fail$3("TEST_SCORE_SAVE_FAILED", e instanceof Error ? e.message : "Failed to save test scores");
      }
    }
  );
  electron.ipcMain.handle(
    "testScores:list",
    (_event, params) => {
      try {
        const rows = listTestScores(params.case_id);
        return ok$3(rows);
      } catch (e) {
        return fail$3("TEST_SCORE_LIST_FAILED", e instanceof Error ? e.message : "Failed to list test scores");
      }
    }
  );
  electron.ipcMain.handle(
    "testScores:delete",
    (_event, params) => {
      try {
        deleteTestScores(params.id);
        return ok$3(void 0);
      } catch (e) {
        return fail$3("TEST_SCORE_DELETE_FAILED", e instanceof Error ? e.message : "Failed to delete test score");
      }
    }
  );
}
const TRANSCRIBE_SOCKET = "/tmp/psygil-transcribe.sock";
function getWhisperDir() {
  return path.join(electron.app.getPath("userData"), "whisper");
}
function getWhisperBinary() {
  return path.join(getWhisperDir(), "main");
}
function getWhisperModel() {
  return path.join(getWhisperDir(), "ggml-base.en.bin");
}
function isWhisperCppAvailable() {
  return fs.existsSync(getWhisperBinary()) && fs.existsSync(getWhisperModel());
}
let sidecarReady = false;
function getSidecarScriptPath() {
  const devPath = path.join(__dirname, "..", "..", "..", "..", "sidecar", "transcribe.py");
  if (fs.existsSync(devPath)) return devPath;
  return path.join(electron.app.getAppPath(), "..", "sidecar", "transcribe.py");
}
function spawnTranscribeSidecar() {
  return new Promise((resolve, reject) => {
    const scriptPath = getSidecarScriptPath();
    if (!fs.existsSync(scriptPath)) {
      reject(new Error(`Transcription sidecar not found: ${scriptPath}`));
      return;
    }
    const child = child_process.spawn("python3", [scriptPath], {
      stdio: ["ignore", "pipe", "pipe"]
    });
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("Transcription sidecar startup timed out"));
    }, 3e4);
    let stdoutBuffer = "";
    child.stdout.on("data", (chunk) => {
      stdoutBuffer += chunk.toString();
      const lines = stdoutBuffer.split("\n");
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          if (msg.status === "ready" && msg.service === "transcription") {
            clearTimeout(timeout);
            sidecarReady = true;
            console.log(`[Transcribe] Sidecar ready, PID ${msg.pid}`);
            resolve({ pid: msg.pid });
            return;
          }
        } catch {
        }
      }
    });
    child.stderr.on("data", (chunk) => {
      console.log(`[Transcribe/sidecar] ${chunk.toString().trim()}`);
    });
    child.on("error", (err) => {
      clearTimeout(timeout);
      sidecarReady = false;
      reject(new Error(`Failed to spawn transcription sidecar: ${err.message}`));
    });
    child.on("exit", (code, sig) => {
      clearTimeout(timeout);
      sidecarReady = false;
      console.log(`[Transcribe] Sidecar exited: code=${code}, signal=${sig}`);
    });
  });
}
const liveStreams = /* @__PURE__ */ new Map();
function startLiveStream(sessionId, win) {
  return new Promise((resolve) => {
    if (!sidecarReady) {
      resolve(false);
      return;
    }
    const socket = new net__namespace.Socket();
    const timeout = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, 1e4);
    socket.connect(TRANSCRIBE_SOCKET, () => {
      clearTimeout(timeout);
      const startCmd = JSON.stringify({
        jsonrpc: "2.0",
        method: "stream/start",
        params: { session_id: sessionId },
        id: 1
      });
      socket.write(startCmd + "\n");
      liveStreams.set(sessionId, { sessionId, socket, win });
      console.log(`[Transcribe] Live stream started: ${sessionId}`);
      resolve(true);
    });
    let buffer = "";
    socket.on("data", (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const resp = JSON.parse(line);
          if (resp.error) {
            console.error(`[Transcribe] Sidecar error: ${resp.error.message}`);
            continue;
          }
          const r = resp.result;
          if (!r) continue;
          if (r.started || r.stopped) continue;
          if (r.type === "partial" && r.text) {
            win.webContents.send("whisper:liveText", {
              sessionId: r.session_id ?? sessionId,
              text: r.text,
              type: "partial"
            });
          } else if (r.type === "final" && r.text !== void 0) {
            win.webContents.send("whisper:liveText", {
              sessionId: r.session_id ?? sessionId,
              text: r.text,
              type: "final"
            });
          } else if (r.type === "error") {
            win.webContents.send("whisper:liveText", {
              sessionId: r.session_id ?? sessionId,
              text: `[Transcription error: ${r.error}]`,
              type: "error"
            });
          }
        } catch {
        }
      }
    });
    socket.on("error", (err) => {
      clearTimeout(timeout);
      console.error(`[Transcribe] Stream socket error: ${err.message}`);
      liveStreams.delete(sessionId);
      resolve(false);
    });
    socket.on("close", () => {
      liveStreams.delete(sessionId);
    });
  });
}
function sendAudioChunk(sessionId, audioBase64) {
  const stream = liveStreams.get(sessionId);
  if (!stream) return;
  const msg = JSON.stringify({
    jsonrpc: "2.0",
    method: "stream/audio",
    params: { session_id: sessionId, audio: audioBase64 }
  });
  stream.socket.write(msg + "\n");
}
function stopLiveStream(sessionId) {
  const stream = liveStreams.get(sessionId);
  if (!stream) return;
  const stopCmd = JSON.stringify({
    jsonrpc: "2.0",
    method: "stream/stop",
    params: { session_id: sessionId },
    id: 2
  });
  stream.socket.write(stopCmd + "\n");
  setTimeout(() => {
    if (liveStreams.has(sessionId)) {
      stream.socket.destroy();
      liveStreams.delete(sessionId);
    }
  }, 1e4);
}
function sidecarRpc(method, params = {}) {
  return new Promise((resolve, reject) => {
    if (!sidecarReady) {
      reject(new Error("Transcription sidecar not ready"));
      return;
    }
    const client = new net__namespace.Socket();
    const timeout = setTimeout(() => {
      client.destroy();
      reject(new Error("Sidecar RPC timed out"));
    }, 3e5);
    client.connect(TRANSCRIBE_SOCKET, () => {
      const request = JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 });
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
          if (resp.error) reject(new Error(resp.error.message));
          else resolve(resp.result);
        } catch {
          client.destroy();
          reject(new Error("Failed to parse sidecar response"));
        }
      }
    });
    client.on("error", (err) => {
      clearTimeout(timeout);
      reject(new Error(`Sidecar connection error: ${err.message}`));
    });
  });
}
function ok$2(data) {
  return { status: "success", data };
}
function fail$2(code, error) {
  return { status: "error", error, code };
}
function handleSaveAudio(_event, args) {
  try {
    const caseRow = getCaseById(args.caseId);
    if (!caseRow) return fail$2("NOT_FOUND", `Case ${args.caseId} not found`);
    if (!caseRow.folder_path) return fail$2("NO_FOLDER", `Case ${args.caseId} has no workspace folder`);
    const interviewDir = path.join(caseRow.folder_path, "Interviews");
    if (!fs.existsSync(interviewDir)) fs.mkdirSync(interviewDir, { recursive: true });
    const destPath = path.join(interviewDir, args.filename);
    const buffer = Buffer.from(args.audioBase64, "base64");
    fs.writeFileSync(destPath, buffer);
    const stat = fs.statSync(destPath);
    console.log(`[Whisper] Saved audio: ${destPath} (${(stat.size / 1024).toFixed(1)} KB)`);
    return ok$2({ filePath: destPath, sizeBytes: stat.size });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to save audio";
    console.error("[Whisper] saveAudio error:", msg);
    return fail$2("SAVE_ERROR", msg);
  }
}
async function handleTranscribe(_event, args) {
  const lang = args.language ?? "en";
  if (!fs.existsSync(args.filePath)) {
    return fail$2("FILE_NOT_FOUND", `Audio file not found: ${args.filePath}`);
  }
  if (sidecarReady) {
    try {
      const result = await sidecarRpc("transcription/transcribe", {
        file_path: args.filePath,
        language: lang
      });
      if (!result.error) {
        return ok$2({ text: result.text, segments: result.segments, duration: result.duration_sec });
      }
    } catch (err) {
      console.warn(`[Transcribe] Sidecar batch failed: ${err}`);
    }
  }
  if (!isWhisperCppAvailable()) {
    return fail$2("NOT_AVAILABLE", "No transcription engine available.");
  }
  return new Promise((resolve) => {
    const binary = getWhisperBinary();
    const model = getWhisperModel();
    const cliArgs = ["-m", model, "-f", args.filePath, "-l", lang, "--output-txt", "--no-timestamps", "--print-progress", "false"];
    const startTime = Date.now();
    child_process.execFile(binary, cliArgs, { timeout: 3e5 }, (error, stdout, stderr) => {
      const elapsed = (Date.now() - startTime) / 1e3;
      if (error) {
        resolve(fail$2("TRANSCRIBE_ERROR", `Whisper.cpp error: ${stderr || error.message}`));
        return;
      }
      const text = stdout.trim();
      const lines = text.split("\n").filter((l) => l.trim());
      const segments = lines.map((line, i) => ({ start: i * 5, end: (i + 1) * 5, text: line.trim() }));
      resolve(ok$2({ text, segments, duration: elapsed }));
    });
  });
}
async function handleStreamStart(event, args) {
  const win = electron.BrowserWindow.fromWebContents(event.sender);
  if (!win) return fail$2("NO_WINDOW", "Could not find browser window");
  if (!sidecarReady) {
    return fail$2("NOT_AVAILABLE", "Transcription sidecar not running");
  }
  const started = await startLiveStream(args.sessionId, win);
  if (!started) {
    return fail$2("STREAM_FAILED", "Failed to start live stream");
  }
  return ok$2({ started: true });
}
function handleStreamAudio(_event, args) {
  sendAudioChunk(args.sessionId, args.audioBase64);
}
function handleStreamStop(_event, args) {
  stopLiveStream(args.sessionId);
  return ok$2({ stopped: true });
}
function handleStatus() {
  const whisperCpp = isWhisperCppAvailable();
  return ok$2({
    available: sidecarReady || whisperCpp,
    model: sidecarReady ? "faster-whisper base.en" : whisperCpp ? path.basename(getWhisperModel()) : null,
    version: sidecarReady ? "faster-whisper" : whisperCpp ? "whisper.cpp" : null,
    sidecarReady
  });
}
function registerWhisperHandlers() {
  electron.ipcMain.handle("whisper:saveAudio", handleSaveAudio);
  electron.ipcMain.handle("whisper:transcribe", handleTranscribe);
  electron.ipcMain.handle("whisper:status", handleStatus);
  electron.ipcMain.handle("whisper:stream:start", handleStreamStart);
  electron.ipcMain.on("whisper:stream:audio", (_event, args) => handleStreamAudio(_event, args));
  electron.ipcMain.handle("whisper:stream:stop", handleStreamStop);
  console.log("[Whisper] IPC handlers registered (batch + live streaming)");
  spawnTranscribeSidecar().catch((err) => {
    console.log(`[Whisper] Sidecar not available: ${err.message}`);
  });
}
function ensureDir$3(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}
function writeFixtureFile(fixturesDir, filename, content) {
  ensureDir$3(fixturesDir);
  const filePath = path.join(fixturesDir, filename);
  fs.writeFileSync(filePath, content, "utf-8");
  return filePath;
}
async function runManifest(manifest) {
  const startTime = Date.now();
  const results = [];
  let caseId = null;
  const wsPath = loadWorkspacePath();
  const fixturesDir = wsPath ? path.join(wsPath, ".test-harness-fixtures") : path.join(path.dirname(__dirname), "..", "..", ".test-harness-fixtures");
  ensureDir$3(fixturesDir);
  console.log(`
${"=".repeat(72)}`);
  console.log(`TEST HARNESS: ${manifest.name}`);
  console.log(`ID: ${manifest.id}`);
  console.log(`Stop at: ${manifest.stopAtStage ?? "complete (full run)"}`);
  console.log(`Steps: ${manifest.steps.length}`);
  console.log(`${"=".repeat(72)}
`);
  try {
    const sqlite = getSqlite();
    const existing = sqlite.prepare("SELECT case_id FROM cases WHERE case_number = ?").get(manifest.caseDefinition.caseNumber);
    if (existing) {
      const cid = existing.case_id;
      console.log(`  [cleanup] Deleting prior test case ${cid} (${manifest.caseDefinition.caseNumber})`);
      const tablesToClean = [
        "agent_results",
        "data_confirmation",
        "diagnostic_decisions",
        "clinical_formulations",
        "patient_intake",
        "audit_log",
        "documents",
        "test_scores"
      ];
      for (const t of tablesToClean) {
        try {
          sqlite.prepare(`DELETE FROM ${t} WHERE case_id = ?`).run(cid);
        } catch (e) {
        }
      }
      sqlite.prepare("DELETE FROM cases WHERE case_id = ?").run(cid);
    }
  } catch (e) {
    console.warn(`  [cleanup] Warning: ${e.message}`);
  }
  for (let i = 0; i < manifest.steps.length; i++) {
    const step = manifest.steps[i];
    const stepStart = Date.now();
    console.log(`  [${i + 1}/${manifest.steps.length}] ${step.description}`);
    try {
      await executeStep(step, manifest, caseId, fixturesDir);
      if (step.action.type === "create_case" && caseId === null) {
        const sqlite = getSqlite();
        const row = sqlite.prepare("SELECT case_id FROM cases WHERE case_number = ?").get(manifest.caseDefinition.caseNumber);
        if (row) {
          caseId = row.case_id;
          console.log(`    -> Case created: ID ${caseId}`);
        }
      }
      if (caseId !== null) {
        const caseRow = getCaseById(caseId);
        const stageAfter = caseRow?.workflow_current_stage ?? "unknown";
        const statusAfter = caseRow?.case_status ?? "unknown";
        if (step.expectedStage && stageAfter !== step.expectedStage) {
          throw new Error(
            `Stage mismatch: expected '${step.expectedStage}', got '${stageAfter}'`
          );
        }
        if (step.expectedStatus && statusAfter !== step.expectedStatus) {
          throw new Error(
            `Status mismatch: expected '${step.expectedStatus}', got '${statusAfter}'`
          );
        }
        if (step.expectFailure) {
          throw new Error("Expected step to fail, but it succeeded");
        }
        results.push({
          stepIndex: i,
          description: step.description,
          action: step.action,
          success: true,
          caseId: caseId ?? void 0,
          stageAfter,
          statusAfter,
          durationMs: Date.now() - stepStart
        });
        console.log(`    -> OK (stage: ${stageAfter}, status: ${statusAfter}) [${Date.now() - stepStart}ms]`);
      } else {
        results.push({
          stepIndex: i,
          description: step.description,
          action: step.action,
          success: true,
          durationMs: Date.now() - stepStart
        });
        console.log(`    -> OK [${Date.now() - stepStart}ms]`);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (step.expectFailure) {
        console.log(`    -> EXPECTED FAILURE: ${errorMsg} [${Date.now() - stepStart}ms]`);
        results.push({
          stepIndex: i,
          description: step.description,
          action: step.action,
          success: true,
          error: `Expected failure: ${errorMsg}`,
          durationMs: Date.now() - stepStart
        });
      } else {
        console.error(`    -> FAILED: ${errorMsg}`);
        results.push({
          stepIndex: i,
          description: step.description,
          action: step.action,
          success: false,
          error: errorMsg,
          durationMs: Date.now() - stepStart
        });
      }
    }
  }
  const totalMs = Date.now() - startTime;
  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  console.log(`
${"=".repeat(72)}`);
  console.log(`RESULT: ${passed}/${results.length} passed, ${failed} failed [${totalMs}ms]`);
  console.log(`${"=".repeat(72)}
`);
  return {
    manifestId: manifest.id,
    caseId,
    totalSteps: manifest.steps.length,
    passed,
    failed,
    steps: results,
    durationMs: totalMs
  };
}
async function executeStep(step, manifest, caseId, fixturesDir) {
  const { action } = step;
  switch (action.type) {
    case "create_case": {
      const def = manifest.caseDefinition;
      createCase({
        case_number: def.caseNumber,
        primary_clinician_user_id: 1,
        examinee_first_name: def.firstName,
        examinee_last_name: def.lastName,
        examinee_dob: def.dob,
        examinee_gender: def.gender,
        evaluation_type: def.evaluationType,
        referral_source: def.referralSource,
        evaluation_questions: def.evaluationQuestions,
        notes: def.notes
      });
      break;
    }
    case "save_intake": {
      if (caseId === null) throw new Error("No case created yet");
      const intake = manifest.intake;
      const sqlite = getSqlite();
      sqlite.prepare("DELETE FROM patient_intake WHERE case_id = ?").run(caseId);
      sqlite.prepare(
        `INSERT INTO patient_intake
           (case_id, referral_source, referral_type, presenting_complaint, status)
           VALUES (?, ?, ?, ?, ?)`
      ).run(
        caseId,
        intake.referralSource,
        intake.referralType,
        intake.presentingComplaint,
        intake.status
      );
      break;
    }
    case "ingest_document": {
      if (caseId === null) throw new Error("No case created yet");
      const doc = manifest.documents[action.documentIndex];
      if (!doc) throw new Error(`Document index ${action.documentIndex} out of range`);
      const fixturePath = writeFixtureFile(fixturesDir, doc.filename, doc.content);
      const docRow = await ingestFile(caseId, fixturePath, doc.subfolder);
      const VALID_DB_TYPES = /* @__PURE__ */ new Set([
        "referral",
        "pdf",
        "docx",
        "transcript_vtt",
        "audio",
        "score_report",
        "medical_record",
        "other"
      ]);
      if (doc.documentType !== docRow.document_type && VALID_DB_TYPES.has(doc.documentType)) {
        const sqlite = getSqlite();
        sqlite.prepare("UPDATE documents SET document_type = ? WHERE document_id = ?").run(doc.documentType, docRow.document_id);
      }
      break;
    }
    case "confirm_data": {
      if (caseId === null) throw new Error("No case created yet");
      const conf = manifest.dataConfirmations[action.confirmationIndex];
      if (!conf) throw new Error(`Confirmation index ${action.confirmationIndex} out of range`);
      saveDataConfirmation(caseId, conf.categoryId, conf.status, conf.notes ?? "");
      break;
    }
    case "advance_stage": {
      if (caseId === null) throw new Error("No case created yet");
      const check = checkStageAdvancement(caseId);
      if (!check.canAdvance) {
        throw new Error(`Cannot advance: ${check.reason}`);
      }
      advanceStage(caseId);
      break;
    }
    case "force_stage": {
      if (caseId === null) throw new Error("No case created yet");
      const sqlite = getSqlite();
      sqlite.prepare("UPDATE cases SET workflow_current_stage = ?, last_modified = ? WHERE case_id = ?").run(action.stage, (/* @__PURE__ */ new Date()).toISOString(), caseId);
      break;
    }
    case "save_scores": {
      if (caseId === null) throw new Error("No case created yet");
      const score = manifest.scores[action.scoreIndex];
      if (!score) throw new Error(`Score index ${action.scoreIndex} out of range`);
      saveTestScores({
        case_id: caseId,
        instrument_name: score.instrumentName,
        instrument_abbrev: score.instrumentAbbrev,
        administration_date: score.administrationDate,
        data_entry_method: score.dataEntryMethod,
        scores: score.scores.map((s) => ({
          scale_name: s.scaleName,
          raw_score: s.rawScore,
          t_score: s.tScore,
          percentile: s.percentile,
          scaled_score: s.scaledScore,
          interpretation: s.interpretation,
          is_elevated: s.isElevated
        })),
        validity_scores: score.validityScores?.map((s) => ({
          scale_name: s.scaleName,
          raw_score: s.rawScore,
          t_score: s.tScore,
          percentile: s.percentile,
          interpretation: s.interpretation,
          is_elevated: s.isElevated
        })),
        clinical_narrative: score.clinicalNarrative,
        notes: score.notes
      });
      break;
    }
    case "save_decision": {
      if (caseId === null) throw new Error("No case created yet");
      const dec = manifest.decisions[action.decisionIndex];
      if (!dec) throw new Error(`Decision index ${action.decisionIndex} out of range`);
      saveDecision({
        case_id: caseId,
        diagnosis_key: dec.diagnosisKey,
        icd_code: dec.icdCode,
        diagnosis_name: dec.diagnosisName,
        decision: dec.decision,
        clinician_notes: dec.clinicianNotes ?? ""
      });
      break;
    }
    case "save_formulation": {
      if (caseId === null) throw new Error("No case created yet");
      if (!manifest.formulation) throw new Error("No formulation defined in manifest");
      saveFormulation({
        case_id: caseId,
        formulation_text: manifest.formulation.formulation
      });
      break;
    }
    case "inject_agent_result": {
      if (caseId === null) throw new Error("No case created yet");
      const stub = manifest.agentResults[action.agentResultIndex];
      if (!stub) throw new Error(`Agent result index ${action.agentResultIndex} out of range`);
      const sqlite = getSqlite();
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS agent_results (
          result_id INTEGER PRIMARY KEY AUTOINCREMENT,
          case_id INTEGER NOT NULL REFERENCES cases(case_id),
          agent_type TEXT NOT NULL,
          result_json TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);
      sqlite.prepare(
        `INSERT INTO agent_results (case_id, agent_type, result_json)
           VALUES (?, ?, ?)`
      ).run(caseId, stub.agentType, JSON.stringify(stub.resultJson));
      break;
    }
    case "attest_report": {
      if (caseId === null) throw new Error("No case created yet");
      const sqlite = getSqlite();
      sqlite.prepare(
        `INSERT INTO audit_log (case_id, action_type, actor_user_id, details, action_date)
           VALUES (?, 'attestation_signed', 1, ?, datetime('now'))`
      ).run(caseId, JSON.stringify({ attested: true, method: "test_harness" }));
      break;
    }
    case "screenshot": {
      console.log(`    [SCREENSHOT: ${action.label}]`);
      break;
    }
    default: {
      throw new Error(`Unknown action type: ${JSON.stringify(action)}`);
    }
  }
}
const COURT_ORDER$4 = `DISTRICT COURT, CITY AND COUNTY OF DENVER, COLORADO
Case No. 2026CR1847

THE PEOPLE OF THE STATE OF COLORADO
v.
DESHAWN MARQUIS RIGGINS

ORDER FOR COMPETENCY EVALUATION

The Court, having reviewed the Motion filed by defense counsel Whitney Polk,
Assistant Public Defender, and having found reasonable cause to believe the
defendant may be incompetent to proceed pursuant to C.R.S. 16-8.5-101, hereby
ORDERS as follows:

1. The defendant shall submit to a competency evaluation to be conducted by a
   qualified forensic psychologist.

2. The evaluation shall address the following:
   a. Whether the defendant has sufficient present ability to consult with his
      attorney with a reasonable degree of rational understanding;
   b. Whether the defendant has a rational as well as factual understanding of
      the proceedings against him;
   c. Whether any mental disease or defect renders the defendant incompetent to
      proceed, and if so, whether restoration to competency is likely with
      appropriate treatment.

3. The evaluating psychologist shall submit a written report to the Court within
   thirty (30) days of this Order.

4. The defendant is charged with Robbery in the First Degree, C.R.S. 18-4-302
   (Class 3 Felony) and Assault in the Second Degree, C.R.S. 18-3-203 (Class 4
   Felony). Maximum combined penalty: 24 years DOC.

5. Defense counsel reports the defendant is unable to meaningfully participate in
   case preparation, appears confused about the nature of the charges, and has
   exhibited disorganized behavior during attorney-client meetings.

DATED this 15th day of March, 2026.

BY THE COURT:

_______________________________
The Honorable Frank W. Medina
Denver District Court, Division 5
`;
const POLICE_REPORT = `DENVER POLICE DEPARTMENT
INCIDENT REPORT

Case No: 2026-0038741
Date of Incident: 2026-02-08
Time: 2237 hours
Location: 1400 block of Champa Street, Denver, CO 80202
Reporting Officer: Det. Brian Kowalski, Badge #4187

NARRATIVE:

On 02/08/2026 at approximately 2237 hours, officers responded to a robbery in
progress at the Quick Mart convenience store, 1423 Champa Street. Upon arrival,
officers found the victim, store clerk Rajesh Bhattacharya (DOB 04/12/1985),
with a laceration to the left forearm consistent with a bladed weapon.

Mr. Bhattacharya stated that a Black male, approximately 6 feet tall, entered
the store at approximately 2230 hours and demanded money from the register while
holding a box cutter. The suspect appeared agitated and was talking to himself.
When the clerk attempted to comply, the suspect became confused, dropped the box
cutter, picked it up, and inadvertently cut the clerk during a struggle. The
suspect fled on foot with approximately $147 in cash.

Surveillance footage (preserved, Exhibit A) shows the suspect entering the store,
appearing to respond to stimuli not present in the environment (looking at the
ceiling, mouthing words, appearing startled). The robbery attempt was disorganized;
the suspect took nearly 4 minutes to communicate his demand and at one point
appeared to forget why he was in the store.

The suspect was identified as DeShawn Marquis Riggins (DOB 07/23/1997) via
fingerprint evidence recovered from the box cutter (abandoned at scene) and
confirmed through surveillance footage comparison with prior booking photographs.

Mr. Riggins was located on 02/10/2026 at the Denver Rescue Mission, 1130
Park Avenue West. At the time of arrest, he was found in a disoriented state,
wearing the same clothing depicted in the surveillance footage. He had $23 in
cash on his person. Mr. Riggins did not resist arrest but appeared unable to
understand the Miranda advisement. He repeatedly asked officers "Is the ceiling
still there?" and stated "They keep moving the floor."

CHARGES FILED:
- Robbery in the First Degree, C.R.S. 18-4-302 (F3)
- Assault in the Second Degree, C.R.S. 18-3-203 (F4)

EVIDENCE LOGGED:
- Box cutter (Exhibit A)
- Surveillance footage, 4 camera angles (Exhibit B)
- Cash recovered ($23, Exhibit C)
- Booking photograph (Exhibit D)
- Victim medical records (Exhibit E)

Det. Brian Kowalski #4187
Denver Police Department, District 6
`;
const JAIL_MEDICAL = `DENVER COUNTY JAIL - MEDICAL/MENTAL HEALTH SCREENING
CONFIDENTIAL HEALTH INFORMATION

Inmate: RIGGINS, DESHAWN MARQUIS
Booking #: 2026-J-018934
DOB: 07/23/1997   Age: 28   Sex: M   Race: Black
Booking Date: 02/10/2026   Time: 1415

INITIAL MEDICAL SCREENING (performed by RN C. Delgado):

Vitals: BP 142/88, HR 96, Temp 98.4, O2 Sat 97%
Weight: 178 lbs, Height: 6'0"
BMI: 24.1

Current Medications (per inmate report, unverified):
- Risperidone 4mg BID (reports noncompliance x 3 months)
- Trazodone 100mg QHS
- Benztropine 1mg BID

Allergies: Haloperidol (dystonic reaction, 2021)

Medical History:
- Schizoaffective disorder, bipolar type (first dx age 19, per inmate)
- 4 prior psychiatric hospitalizations (Colorado Mental Health Institute at
  Pueblo, 2016, 2018, 2020; Denver Health, 2023)
- History of medication noncompliance
- Appendectomy (2014)
- No seizure history
- No head injury (per inmate report)

Current Mental Status (screening level):
- Oriented to person only; confused about date and location
- Affect: flat, intermittent inappropriate laughter
- Speech: low volume, occasionally tangential
- Endorsed auditory hallucinations ("voices that argue with each other")
- Denied current SI/HI
- Poor hygiene, mild malnutrition

Substance Use:
- Denies current alcohol use
- Reports intermittent marijuana use (last use "maybe a few weeks ago")
- Denies IV drug use, methamphetamine, cocaine, opioids

Jail Psychiatry Referral: URGENT
Placed on mental health observation (Q15 checks)
Risperidone restarted at 2mg BID with titration plan to 4mg over 1 week

Screening Nurse: C. Delgado, RN
Date: 02/10/2026
`;
const PRIOR_PSYCH_RECORDS = `COLORADO MENTAL HEALTH INSTITUTE AT PUEBLO
DISCHARGE SUMMARY

Patient: Riggins, DeShawn M.
MRN: CMHIP-2020-04821
Admission Date: 09/14/2020
Discharge Date: 11/22/2020
Length of Stay: 69 days
Admitting Psychiatrist: Rajiv Patel, M.D.
Discharge Psychiatrist: Rajiv Patel, M.D.

DIAGNOSES AT DISCHARGE:
Axis I:
  1. Schizoaffective Disorder, Bipolar Type (F25.0) - Primary
  2. Cannabis Use Disorder, Moderate (F12.20)

REASON FOR ADMISSION:
Mr. Riggins was admitted following a court-ordered competency restoration
pursuant to C.R.S. 16-8.5-111. He had been found incompetent to stand trial
on charges of Criminal Mischief (F4) in Arapahoe County Case No. 2020CR2614.
At the time of admission, Mr. Riggins was experiencing active psychotic symptoms
including auditory hallucinations (command type), paranoid delusions regarding
government surveillance, and disorganized thought processes that precluded
meaningful attorney-client communication.

COURSE OF TREATMENT:
Mr. Riggins was stabilized on risperidone 4mg BID after trials of olanzapine
(excessive sedation, 20 lb weight gain in 3 weeks) and aripiprazole (inadequate
symptom control at 30mg). Competency restoration education was provided through
structured group and individual sessions focusing on courtroom procedures, roles
of legal personnel, charges and potential penalties, and the ability to assist
counsel.

MENTAL STATUS AT DISCHARGE:
Mr. Riggins was alert, oriented x4, with organized thought processes and no
active psychotic symptoms. He demonstrated adequate factual understanding of
the charges, the roles of the judge, prosecutor, and defense attorney, and the
potential consequences of conviction. He was able to articulate a rational
strategy for working with his attorney.

COMPETENCY STATUS AT DISCHARGE:
Restored to competency. Returned to court jurisdiction on 11/22/2020.

MEDICATION AT DISCHARGE:
- Risperidone 4mg BID
- Benztropine 1mg BID (for EPS prophylaxis)
- Trazodone 100mg QHS (sleep)

FOLLOW-UP:
Community mental health at Mental Health Center of Denver.
Outpatient psychiatry with Dr. Lisa Huang.

PROGNOSIS:
Guarded. Mr. Riggins has a pattern of medication noncompliance following
discharge, with 3 prior hospitalizations (2016, 2018, prior to this admission)
all precipitated by cessation of antipsychotic medication. Risk of
decompensation is HIGH if medication adherence is not maintained.

Rajiv Patel, M.D.
Board Certified Psychiatry
CMHIP
`;
const DEFENSE_MOTION = `DISTRICT COURT, CITY AND COUNTY OF DENVER, COLORADO
Case No. 2026CR1847

THE PEOPLE OF THE STATE OF COLORADO
v.
DESHAWN MARQUIS RIGGINS

MOTION FOR DETERMINATION OF COMPETENCY TO PROCEED

Whitney Polk, Assistant Public Defender, on behalf of the defendant, DeShawn
Marquis Riggins, respectfully moves this Court for an order directing a
competency evaluation pursuant to C.R.S. 16-8.5-101, and in support thereof
states the following:

1. The defendant is charged with Robbery in the First Degree (F3) and Assault
   in the Second Degree (F4), with a combined maximum exposure of 24 years in
   the Department of Corrections.

2. Defense counsel has met with the defendant on four occasions since his
   arrest on February 10, 2026 (February 12, February 19, February 26, and
   March 3, 2026).

3. During each meeting, the defendant exhibited the following concerning
   behaviors:
   a. Inability to sustain attention for more than 2-3 minutes
   b. Responding to internal stimuli (turning head, whispering to unseen
      persons, covering ears)
   c. Inability to articulate the charges against him despite repeated
      explanation
   d. Expressed belief that his attorney is "working for the voices"
   e. On one occasion (March 3), refused to exit his cell, stating that "the
      courtroom has been poisoned"

4. The defendant has a documented history of Schizoaffective Disorder, Bipolar
   Type, with four prior psychiatric hospitalizations, the most recent being a
   69-day competency restoration admission at CMHIP in 2020.

5. According to jail medical records, the defendant had been noncompliant with
   his prescribed antipsychotic medication (risperidone 4mg BID) for
   approximately three months prior to the alleged offense.

6. Counsel is unable to discuss plea options, review discovery, or prepare any
   defense strategy due to the defendant's current mental state.

WHEREFORE, defense counsel respectfully requests that this Court order a
competency evaluation by a qualified forensic psychologist.

Respectfully submitted,

_______________________________
Whitney Polk, #42891
Assistant Public Defender
Office of the Colorado State Public Defender
1290 Broadway, Suite 900
Denver, CO 80203
`;
const COLLATERAL_MOTHER = `COLLATERAL CONTACT NOTES
Case: Riggins, DeShawn M. (PSY-2026-H001)
Contact: Loretta Riggins (mother)
Date: 03/28/2026
Interviewer: Clinician
Duration: 47 minutes
Method: Telephone

Ms. Riggins (age 54) was contacted by telephone and provided verbal consent
for this collateral interview. She was cooperative and appeared genuinely
concerned about her son's welfare.

DEVELOPMENTAL HISTORY:
DeShawn was born full-term following an uncomplicated pregnancy. Ms. Riggins
denied any prenatal substance use. Developmental milestones were met within
normal limits. He attended Denver Public Schools through 11th grade, when he
dropped out following his first psychiatric hospitalization at age 19. He was
in special education from 7th grade for "emotional disturbance" (per IEP
records she recalls). He played football in 9th and 10th grade but quit after
a disciplinary suspension.

FAMILY PSYCHIATRIC HISTORY:
Ms. Riggins reported that DeShawn's biological father, Marcus Riggins Sr.
(deceased, 2019, cardiac arrest), had "episodes" that she believes were
psychotic, but he was never formally diagnosed or treated. DeShawn's paternal
uncle, Terrence Riggins, was diagnosed with schizophrenia and is currently
a resident at a group home in Aurora. A maternal cousin was treated for
bipolar disorder. Ms. Riggins herself takes sertraline for depression.

ONSET OF SYMPTOMS:
Ms. Riggins recalled that DeShawn first "started acting different" around age
17. He became increasingly isolated, stopped attending school regularly, and
began talking to himself. At 19, following an incident where he barricaded
himself in his room for 3 days believing the television was communicating
directly with him, he was hospitalized at CMHIP for the first time.

MEDICATION COMPLIANCE:
Ms. Riggins stated that DeShawn "does well when he takes his medicine, but he
always stops." She described a repeating cycle: hospitalization, stabilization,
discharge, 3-6 months of compliance, then gradual discontinuation followed by
decompensation. The most recent discontinuation began around November 2025
when DeShawn lost his Medicaid coverage during an address change and could not
afford the medication out of pocket.

CURRENT LIVING SITUATION:
Prior to arrest, DeShawn was living intermittently at the Denver Rescue Mission
and occasionally staying with Ms. Riggins at her apartment in Montbello. She
stated he had been "getting worse for about two months" before the arrest,
with increasing disorganization, poor self-care, and talking to voices "more
than I've ever seen."

FUNCTIONING WHEN STABLE:
When medicated and stable, Ms. Riggins described DeShawn as "sweet, funny, and
helpful." He held a part-time job at a warehouse (DHL) for 8 months in 2022
and volunteered at his church (New Hope Baptist) intermittently. He has never
been married and has no children.

Interviewer notes: Ms. Riggins's account is consistent with the documented
psychiatric history and supports a pattern of cyclic decompensation linked to
medication noncompliance. Her report of the timeline of recent deterioration
aligns with jail medical records showing 3 months of missed risperidone.
`;
const INTERVIEW_NOTES_1 = `CLINICAL INTERVIEW NOTES
Case: Riggins, DeShawn M. (PSY-2026-H001)
Session: 1 of 2
Date: 03/29/2026
Duration: 52 minutes
Location: Interview Room B, Denver County Jail
Clinician: [Primary Evaluator]

BEHAVIORAL OBSERVATIONS:
Mr. Riggins was escorted to the interview room by correctional staff. He was
dressed in standard jail-issue clothing that appeared clean but wrinkled. He
was malodorous, suggesting poor hygiene. He made intermittent eye contact,
frequently scanning the corners of the room and the ceiling. He was restless,
shifting in his chair and occasionally standing without apparent purpose before
sitting again.

ORIENTATION AND ATTENTION:
Mr. Riggins was oriented to person ("DeShawn Riggins") and partial to place
("a jail... Denver, I think"). He was not oriented to date, stating it was
"January... no, February" (actual date March 29). He was unable to maintain
attention for more than 3-4 minutes before becoming distracted by internal
stimuli.

UNDERSTANDING OF EVALUATION PURPOSE:
When asked why he was being seen today, Mr. Riggins stated, "My lawyer... she
wants to know if I'm crazy." With prompting, he was unable to elaborate on
what a competency evaluation means or what its outcome might be.

UNDERSTANDING OF CHARGES:
Mr. Riggins was asked about his current charges. He stated, "They say I robbed
somebody." When asked what robbery means, he said, "Taking stuff." He was
unable to name the specific charges (Robbery 1st, Assault 2nd) despite
reportedly being informed multiple times by counsel. When asked about possible
penalties, he stated, "They could lock me up for a long time," but was unable
to provide any specifics regarding sentence length or felony classification.

UNDERSTANDING OF COURTROOM ROLES:
Judge: "The boss. He decides things." (Adequate understanding)
Prosecutor: "The one trying to get me." (Partial understanding; unable to
  articulate that the prosecutor represents the state/people)
Defense attorney: Initially stated, "She's nice," referring to Ms. Polk.
  When asked what her job is, he said, "To help me, I think." However, when
  asked if he trusts her, he paused for approximately 15 seconds, then
  stated, "Sometimes the voices say she's lying to me."
Jury: "People who watch." (Inadequate; unable to describe the jury's
  decision-making role)

ABILITY TO ASSIST COUNSEL:
Mr. Riggins was asked to describe what happened on the night of February 8.
His account was fragmented and largely incoherent. He stated, "I went to the
store because they told me to get something... not the voices, the other
ones... I needed something but I can't remember what." He was unable to provide
a linear narrative of events. When asked specific questions about the incident,
he became increasingly agitated and stated, "I don't want to talk about the
ceiling people."

THOUGHT PROCESS:
Tangential, with frequent loose associations. Example: When asked about his
medication history, he responded, "The pills make the floor stay still.
The floor at Pueblo was better. They had good chicken there. My mom makes
chicken too. Is she coming today?"

PSYCHOTIC SYMPTOMS:
Mr. Riggins endorsed ongoing auditory hallucinations, describing "two voices
that argue about what I should do." He reported that one voice is "mean" and
tells him "not to trust anyone" while the other "tries to help but gets
confused." He stated the voices have been present "since forever" but have
been "louder" since he stopped taking medication. He denied visual
hallucinations but appeared to track nonexistent stimuli in the room on
multiple occasions.

He endorsed a persecutory belief that "the ceiling people" are monitoring him
and can "move the floor" to disorient him. He was unable to identify who the
ceiling people are or what they want.

AFFECT AND MOOD:
Mood: "I don't know. Tired, I guess."
Affect: Flat with intermittent inappropriate laughter, typically following
mentions of the "ceiling people" or voices. No tearfulness. Range was
markedly restricted.

RISK ASSESSMENT:
Suicidal ideation: Denied. "I don't want to die."
Homicidal ideation: Denied.
Self-harm: No evidence of recent self-harm. No scars observed.
Violence risk: Low in current setting. No behavioral incidents reported by
jail staff since booking.

IMPRESSION:
Mr. Riggins presents with active psychotic symptoms (auditory hallucinations,
persecutory delusions, disorganized thought process) that significantly impair
his factual and rational understanding of the legal proceedings. His current
presentation is consistent with his documented history of schizoaffective
disorder during periods of medication noncompliance. Formal testing will
further quantify cognitive and personality functioning.

Second interview session scheduled for 04/01/2026 to complete the evaluation.
`;
const INTERVIEW_NOTES_2 = `CLINICAL INTERVIEW NOTES
Case: Riggins, DeShawn M. (PSY-2026-H001)
Session: 2 of 2
Date: 04/01/2026
Duration: 43 minutes
Location: Interview Room B, Denver County Jail
Clinician: [Primary Evaluator]

NOTE: Mr. Riggins has now been back on risperidone (titrated to 4mg BID as of
03/24/2026) for approximately 3 weeks. Jail psychiatry reports partial
stabilization with reduced hallucination frequency and improved sleep.

BEHAVIORAL OBSERVATIONS:
Mr. Riggins was notably more organized in presentation compared to Session 1.
Hygiene had improved. He sat still for approximately 10-minute stretches before
becoming restless. Eye contact was improved but remained inconsistent. He
appeared tired but cooperative.

ORIENTATION:
Oriented to person and place ("Denver County Jail"). Oriented to approximate
date ("end of March or early April" - close; actual date April 1). Significant
improvement from Session 1.

FOLLOW-UP ON CHARGES AND LEGAL UNDERSTANDING:
When asked again about his charges, Mr. Riggins stated, "Robbery and assault.
They say I hurt the guy at the store." This represents improved factual
recall from Session 1. However, when asked about the difference between
Robbery 1st and 2nd degree, or the distinction between felony classes, he
was unable to articulate any differences. When asked about maximum penalties,
he stated, "A long time. Years." He was unable to give a number.

PLEA OPTIONS:
When asked about possible plea options, Mr. Riggins stated, "Guilty means I
did it. Not guilty means I didn't." He was unable to describe what a plea
bargain is or why someone might accept one. He stated he wants "to go home"
but could not connect that desire to any legal strategy.

ABILITY TO ASSIST COUNSEL (REASSESSED):
Mr. Riggins was asked to describe the events of February 8 again. His
narrative was somewhat more coherent than Session 1: "I went to the store.
I had the thing, the cutter. I needed money. The voices were loud that night.
I didn't mean to cut him." However, he was unable to identify potential
witnesses, discuss surveillance footage strategically, or consider how his
mental state at the time might be relevant to a defense.

When asked if he could sit through a trial, he stated, "I don't know. Sometimes
it gets too loud in my head." When asked what he would do if the voices became
disruptive during a hearing, he said, "I'd try to ignore them."

MEDICATION EFFECTS:
Mr. Riggins reported that the risperidone has made the voices "quieter but
not gone." He stated the voices are present for portions of each day but are
no longer constant. The persecutory beliefs about "ceiling people" persist but
are described with less conviction: "I know it sounds crazy, but I still
feel like they're watching."

COMPETENCY-SPECIFIC FUNCTIONING:
Applied to the Dusky standard (Dusky v. United States, 1960):

1. Rational understanding of proceedings: IMPAIRED. Mr. Riggins has improved
   factual knowledge of his situation but continues to incorporate delusional
   material into his understanding of the legal process (e.g., concern that
   the courtroom may be "poisoned," intermittent belief that counsel is allied
   with the voices).

2. Factual understanding of proceedings: PARTIALLY INTACT. He can now name
   his charges, identify the general roles of courtroom personnel, and
   understands that conviction results in incarceration. However, he lacks
   nuanced understanding of plea options, felony grades, and procedural rights.

3. Ability to assist counsel: SIGNIFICANTLY IMPAIRED. While his narrative of
   events has improved, he remains unable to discuss case strategy, evaluate
   evidence, or identify relevant information for his defense. His ongoing
   psychotic symptoms, though partially treated, continue to intrude upon his
   reasoning.

OVERALL IMPRESSION:
Mr. Riggins shows partial improvement with medication reinstatement but remains
significantly impaired in his ability to assist counsel and in his rational
understanding of proceedings. The improvement trend suggests restoration is
feasible with continued treatment, consistent with his prior restoration at
CMHIP in 2020 (69-day course).

Testing data (MMPI-3, PAI, WAIS-IV, MacCAT-CA) will be integrated with
interview findings for the final report.
`;
const MMPI3_SCORES = {
  instrumentName: "Minnesota Multiphasic Personality Inventory-3",
  instrumentAbbrev: "MMPI-3",
  administrationDate: "2026-03-30",
  dataEntryMethod: "manual",
  scores: [
    { scaleName: "RC1 (Somatic Complaints)", tScore: 58, percentile: 79, interpretation: "Within normal limits" },
    { scaleName: "RC2 (Low Positive Emotions)", tScore: 72, percentile: 99, interpretation: "Clinically elevated", isElevated: true },
    { scaleName: "RC3 (Cynicism)", tScore: 55, percentile: 69, interpretation: "Within normal limits" },
    { scaleName: "RC4 (Antisocial Behavior)", tScore: 61, percentile: 86, interpretation: "Mildly elevated" },
    { scaleName: "RC6 (Ideas of Persecution)", tScore: 88, percentile: 99, interpretation: "Markedly elevated", isElevated: true },
    { scaleName: "RC7 (Dysfunctional Negative Emotions)", tScore: 70, percentile: 98, interpretation: "Clinically elevated", isElevated: true },
    { scaleName: "RC8 (Aberrant Experiences)", tScore: 85, percentile: 99, interpretation: "Markedly elevated", isElevated: true },
    { scaleName: "RC9 (Hypomanic Activation)", tScore: 62, percentile: 88, interpretation: "Mildly elevated" },
    { scaleName: "EID (Emotional/Internalizing Dysfunction)", tScore: 71, percentile: 99, interpretation: "Clinically elevated", isElevated: true },
    { scaleName: "THD (Thought Dysfunction)", tScore: 86, percentile: 99, interpretation: "Markedly elevated", isElevated: true },
    { scaleName: "BXD (Behavioral/Externalizing Dysfunction)", tScore: 57, percentile: 76, interpretation: "Within normal limits" }
  ],
  validityScores: [
    { scaleName: "CNS (Cannot Say)", rawScore: 2, interpretation: "Valid" },
    { scaleName: "VRIN-r (Variable Response Inconsistency)", tScore: 52, interpretation: "Valid" },
    { scaleName: "TRIN-r (True Response Inconsistency)", tScore: 57, interpretation: "Valid" },
    { scaleName: "F-r (Infrequent Responses)", tScore: 78, interpretation: "Elevated but consistent with severe psychopathology", isElevated: true },
    { scaleName: "Fp-r (Infrequent Psychopathology)", tScore: 63, interpretation: "Acceptable range" },
    { scaleName: "Fs (Infrequent Somatic)", tScore: 51, interpretation: "Valid" },
    { scaleName: "FBS-r (Symptom Validity)", tScore: 55, interpretation: "Valid" },
    { scaleName: "L-r (Uncommon Virtues)", tScore: 45, interpretation: "Valid" },
    { scaleName: "K-r (Adjustment Validity)", tScore: 38, interpretation: "Low; consistent with poor coping resources" }
  ],
  clinicalNarrative: "The MMPI-3 profile is valid and interpretable. The pattern of elevated THD (T=86), RC6 (T=88), and RC8 (T=85) is consistent with active psychotic symptomatology including persecutory ideation and aberrant perceptual experiences. Elevated EID and RC2 suggest comorbid depressive features with anhedonia. The overall configuration is consistent with schizoaffective disorder presentation. F-r elevation (T=78) is within the range expected for individuals with genuine severe psychopathology and does not suggest overreporting when considered alongside validity indicators."
};
const PAI_SCORES = {
  instrumentName: "Personality Assessment Inventory",
  instrumentAbbrev: "PAI",
  administrationDate: "2026-03-30",
  dataEntryMethod: "manual",
  scores: [
    { scaleName: "SCZ (Schizophrenia)", tScore: 82, percentile: 99, interpretation: "Markedly elevated", isElevated: true },
    { scaleName: "SCZ-P (Psychotic Experiences)", tScore: 86, percentile: 99, interpretation: "Markedly elevated", isElevated: true },
    { scaleName: "SCZ-S (Social Detachment)", tScore: 74, percentile: 99, interpretation: "Clinically elevated", isElevated: true },
    { scaleName: "SCZ-T (Thought Disorder)", tScore: 78, percentile: 99, interpretation: "Clinically elevated", isElevated: true },
    { scaleName: "PAR (Paranoia)", tScore: 76, percentile: 99, interpretation: "Clinically elevated", isElevated: true },
    { scaleName: "PAR-H (Hypervigilance)", tScore: 72, percentile: 99, interpretation: "Clinically elevated", isElevated: true },
    { scaleName: "PAR-P (Persecution)", tScore: 80, percentile: 99, interpretation: "Markedly elevated", isElevated: true },
    { scaleName: "DEP (Depression)", tScore: 68, percentile: 96, interpretation: "Clinically elevated", isElevated: true },
    { scaleName: "ANX (Anxiety)", tScore: 64, percentile: 92, interpretation: "Mildly elevated" },
    { scaleName: "MAN (Mania)", tScore: 58, percentile: 79, interpretation: "Within normal limits" },
    { scaleName: "ANT (Antisocial Features)", tScore: 56, percentile: 73, interpretation: "Within normal limits" },
    { scaleName: "AGG (Aggression)", tScore: 52, percentile: 58, interpretation: "Within normal limits" },
    { scaleName: "SUI (Suicidal Ideation)", tScore: 48, percentile: 42, interpretation: "Within normal limits" }
  ],
  validityScores: [
    { scaleName: "ICN (Inconsistency)", tScore: 55, interpretation: "Valid" },
    { scaleName: "INF (Infrequency)", tScore: 62, interpretation: "Acceptable" },
    { scaleName: "NIM (Negative Impression)", tScore: 71, interpretation: "Mildly elevated; consistent with genuine distress", isElevated: true },
    { scaleName: "PIM (Positive Impression)", tScore: 39, interpretation: "Low; not attempting to minimize" },
    { scaleName: "MAL (Malingering Index)", rawScore: 2, interpretation: "Below cutoff; no malingering indicators" }
  ],
  clinicalNarrative: 'PAI results corroborate the MMPI-3 findings. The SCZ composite (T=82) with prominent psychotic experiences (SCZ-P=86) and thought disorder (SCZ-T=78) subscales confirms the presence of significant psychotic symptomatology. Paranoia (T=76) with prominent persecution (PAR-P=80) aligns with the documented persecutory delusions regarding "ceiling people." Validity indicators are acceptable; the MAL index (2) and absence of elevated NIM/INF convergence argue against symptom fabrication.'
};
const WAIS_IV_SCORES = {
  instrumentName: "Wechsler Adult Intelligence Scale - IV",
  instrumentAbbrev: "WAIS-IV",
  administrationDate: "2026-03-31",
  dataEntryMethod: "manual",
  scores: [
    { scaleName: "Verbal Comprehension Index (VCI)", rawScore: void 0, scaledScore: void 0, tScore: void 0, percentile: 27, interpretation: "Low Average", isElevated: false },
    { scaleName: "Perceptual Reasoning Index (PRI)", percentile: 21, interpretation: "Low Average" },
    { scaleName: "Working Memory Index (WMI)", percentile: 9, interpretation: "Low; consistent with attentional impairment from psychotic symptoms", isElevated: true },
    { scaleName: "Processing Speed Index (PSI)", percentile: 16, interpretation: "Low Average" },
    { scaleName: "Full Scale IQ (FSIQ)", rawScore: void 0, tScore: void 0, percentile: 18, interpretation: "Low Average (FSIQ = 86, 95% CI: 82-91)" },
    { scaleName: "Similarities", scaledScore: 8, interpretation: "Average" },
    { scaleName: "Vocabulary", scaledScore: 7, interpretation: "Low Average" },
    { scaleName: "Information", scaledScore: 7, interpretation: "Low Average" },
    { scaleName: "Block Design", scaledScore: 7, interpretation: "Low Average" },
    { scaleName: "Matrix Reasoning", scaledScore: 8, interpretation: "Average" },
    { scaleName: "Visual Puzzles", scaledScore: 7, interpretation: "Low Average" },
    { scaleName: "Digit Span", scaledScore: 5, interpretation: "Borderline; impaired forward and backward span", isElevated: true },
    { scaleName: "Arithmetic", scaledScore: 6, interpretation: "Low Average" },
    { scaleName: "Symbol Search", scaledScore: 7, interpretation: "Low Average" },
    { scaleName: "Coding", scaledScore: 6, interpretation: "Low Average" }
  ],
  clinicalNarrative: "Estimated FSIQ of 86 (Low Average, 18th percentile) likely represents an underestimate of premorbid functioning given the impact of active psychotic symptoms on attention and processing speed. The WMI (9th percentile) is notably depressed relative to VCI (27th percentile), consistent with attentional fragmentation secondary to hallucinations. Digit Span (scaled score 5) was particularly impaired, with Mr. Riggins reporting auditory hallucinations during administration. These results should be interpreted with caution given the confounding effect of active psychosis on cognitive test performance."
};
const MACCAT_CA_SCORES = {
  instrumentName: "MacArthur Competence Assessment Tool - Criminal Adjudication",
  instrumentAbbrev: "MacCAT-CA",
  administrationDate: "2026-04-01",
  dataEntryMethod: "manual",
  scores: [
    { scaleName: "Understanding", rawScore: 10, interpretation: "Minimal impairment (range 0-16; clinical concern below 10)" },
    { scaleName: "Reasoning", rawScore: 8, interpretation: "Mild impairment (range 0-16; clinical concern below 10)", isElevated: true },
    { scaleName: "Appreciation", rawScore: 4, interpretation: "Clinically significant impairment (range 0-12; clinical concern below 6)", isElevated: true }
  ],
  clinicalNarrative: 'MacCAT-CA results reveal a dissociation between Understanding (adequate) and Appreciation (significantly impaired). Mr. Riggins can recite factual information about the legal system when prompted (Understanding = 10) but is unable to apply that knowledge rationally to his own situation (Appreciation = 4). This pattern is characteristic of psychotic interference with rational decision-making capacity. The Appreciation subscale was particularly impacted by his incorporation of delusional material when asked to apply legal concepts to his case (e.g., belief that the courtroom is "poisoned," mistrust of counsel driven by auditory hallucinations). Reasoning (8) falls below the concern threshold, suggesting difficulty in legal decision-making even when provided with relevant information.'
};
const INGESTOR_RESULT = {
  agentType: "ingestor",
  resultJson: {
    case_id: "PSY-2026-H001",
    version: "1.0",
    generated_at: "2026-04-02T14:30:00Z",
    demographics: {
      name: "DeShawn Marquis Riggins",
      dob: "1997-07-23",
      age: 28,
      sex: "Male",
      race: "Black",
      education: "11th grade (did not graduate)",
      occupation: "Unemployed (last employment: DHL warehouse, 2022)"
    },
    referral_questions: [
      {
        question_text: "Does the defendant have sufficient present ability to consult with his attorney with a reasonable degree of rational understanding?",
        source_document: "Court Order, Case No. 2026CR1847"
      },
      {
        question_text: "Does the defendant have a rational as well as factual understanding of the proceedings against him?",
        source_document: "Court Order, Case No. 2026CR1847"
      },
      {
        question_text: "If incompetent, is restoration to competency likely with appropriate treatment?",
        source_document: "Court Order, Case No. 2026CR1847"
      }
    ],
    completeness_flags: {
      demographics: "complete",
      referral_questions: "complete",
      test_results: "complete",
      interview_data: "complete",
      collateral_information: "complete"
    }
  }
};
const DIAGNOSTICIAN_RESULT = {
  agentType: "diagnostician",
  resultJson: {
    case_id: "PSY-2026-H001",
    version: "1.0",
    generated_at: "2026-04-03T10:00:00Z",
    diagnostic_evidence_map: {
      "Schizoaffective Disorder, Bipolar Type": {
        icd_code: "F25.0",
        status: "evidence_presented",
        supporting_evidence: [
          "Active auditory hallucinations (command and conversational type)",
          'Persecutory delusions ("ceiling people")',
          "Disorganized thought process documented across interviews",
          "MMPI-3 THD T=86, RC6 T=88, RC8 T=85",
          "PAI SCZ T=82, SCZ-P T=86",
          "4 prior hospitalizations with this diagnosis",
          "History of medication response (risperidone)",
          "Family history: paternal uncle with schizophrenia"
        ]
      }
    },
    psycholegal_analysis: {
      legal_standard: "Dusky v. United States (1960)",
      jurisdiction: "Colorado, C.R.S. 16-8.5-101",
      standard_elements: [
        { element: "Factual understanding", evidence_map: ["MacCAT-CA Understanding = 10 (adequate)"] },
        { element: "Rational understanding", evidence_map: ["MacCAT-CA Appreciation = 4 (impaired)", "Delusional intrusions into legal reasoning"] },
        { element: "Ability to assist counsel", evidence_map: ["Unable to provide coherent narrative", "Cannot discuss case strategy", "Paranoid regarding counsel"] }
      ]
    }
  }
};
const WRITER_RESULT = {
  agentType: "writer",
  resultJson: {
    case_id: "PSY-2026-H001",
    version: "1.0",
    generated_at: "2026-04-04T09:00:00Z",
    sections_generated: ["identifying_information", "referral_information", "relevant_history", "behavioral_observations", "test_results", "clinical_findings", "competency_analysis", "conclusions_and_recommendations"],
    status: "draft_complete"
  }
};
const EDITOR_RESULT = {
  agentType: "editor",
  resultJson: {
    case_id: "PSY-2026-H001",
    version: "1.0",
    generated_at: "2026-04-04T14:00:00Z",
    review_status: "approved_with_minor_edits",
    issues_found: 3,
    issues_resolved: 3
  }
};
const deshawnRigginsManifest = {
  id: "cst-riggins-001",
  name: "DeShawn Riggins - CST Full Pipeline",
  description: "Complex Competency to Stand Trial evaluation. 28-year-old male with schizoaffective disorder, 4 prior hospitalizations, medication noncompliance. Court-ordered eval for Robbery 1st / Assault 2nd in Denver District Court. Tests every pipeline stage from intake through report completion.",
  stopAtStage: null,
  // full run
  caseDefinition: {
    caseNumber: "PSY-2026-H001",
    firstName: "DeShawn",
    lastName: "Riggins",
    dob: "1997-07-23",
    gender: "M",
    evaluationType: "CST",
    referralSource: "Court",
    evaluationQuestions: "Competency to stand trial per C.R.S. 16-8.5-101. (1) Sufficient present ability to consult with attorney? (2) Rational and factual understanding of proceedings? (3) If incompetent, is restoration likely?",
    notes: "Court-ordered CST. Prior CMHIP restoration (2020, 69 days). Currently decompensated, restarted risperidone 02/10/2026."
  },
  intake: {
    referralSource: "Hon. Frank W. Medina, Denver District Court, Division 5",
    referralType: "court",
    presentingComplaint: "Defense counsel reports defendant unable to meaningfully participate in case preparation, appears confused about charges, exhibits disorganized behavior and responds to internal stimuli during attorney meetings. History of schizoaffective disorder with medication noncompliance.",
    status: "complete"
  },
  documents: [
    {
      filename: "Court_Order_CST_Evaluation_2026CR1847.txt",
      subfolder: "_Inbox",
      documentType: "court_order",
      content: COURT_ORDER$4,
      description: "Court order for competency evaluation, Case No. 2026CR1847"
    },
    {
      filename: "Denver_PD_Incident_Report_2026-0038741.txt",
      subfolder: "Collateral",
      documentType: "police_report",
      content: POLICE_REPORT,
      description: "Denver PD incident report for robbery/assault, Det. Kowalski"
    },
    {
      filename: "Denver_County_Jail_Medical_Screening.txt",
      subfolder: "Collateral",
      documentType: "medical_record",
      content: JAIL_MEDICAL,
      description: "Jail intake medical/mental health screening, RN Delgado"
    },
    {
      filename: "CMHIP_Discharge_Summary_2020.txt",
      subfolder: "Collateral",
      documentType: "medical_record",
      content: PRIOR_PSYCH_RECORDS,
      description: "CMHIP discharge summary from 2020 competency restoration (69 days)"
    },
    {
      filename: "Defense_Motion_Competency_2026CR1847.txt",
      subfolder: "Collateral",
      documentType: "legal_document",
      content: DEFENSE_MOTION,
      description: "Defense motion for competency determination, Whitney Polk APD"
    },
    {
      filename: "Collateral_Contact_Loretta_Riggins_Mother.txt",
      subfolder: "Collateral",
      documentType: "collateral_contact",
      content: COLLATERAL_MOTHER,
      description: "Collateral interview with Loretta Riggins (mother), 47 min telephone"
    },
    // Testing documents (uploaded during testing stage)
    {
      filename: "MMPI3_Score_Report_Riggins.txt",
      subfolder: "Testing",
      documentType: "score_report",
      content: "MMPI-3 Score Report\nExaminee: DeShawn Riggins\nDate: 03/30/2026\n[Score data entered manually via ScoreImportModal]",
      description: "MMPI-3 score report placeholder (scores entered manually)"
    },
    {
      filename: "PAI_Score_Report_Riggins.txt",
      subfolder: "Testing",
      documentType: "score_report",
      content: "PAI Score Report\nExaminee: DeShawn Riggins\nDate: 03/30/2026\n[Score data entered manually via ScoreImportModal]",
      description: "PAI score report placeholder (scores entered manually)"
    },
    {
      filename: "WAIS_IV_Score_Report_Riggins.txt",
      subfolder: "Testing",
      documentType: "score_report",
      content: "WAIS-IV Score Report\nExaminee: DeShawn Riggins\nDate: 03/31/2026\n[Score data entered manually via ScoreImportModal]",
      description: "WAIS-IV score report placeholder (scores entered manually)"
    },
    {
      filename: "MacCAT_CA_Score_Report_Riggins.txt",
      subfolder: "Testing",
      documentType: "score_report",
      content: "MacCAT-CA Score Report\nExaminee: DeShawn Riggins\nDate: 04/01/2026\n[Score data entered manually via ScoreImportModal]",
      description: "MacCAT-CA score report placeholder (scores entered manually)"
    },
    // Interview documents
    {
      filename: "Clinical_Interview_Session_1_03292026.txt",
      subfolder: "Interviews",
      documentType: "transcript_vtt",
      content: INTERVIEW_NOTES_1,
      description: "Clinical interview session 1 (52 min), Denver County Jail"
    },
    {
      filename: "Clinical_Interview_Session_2_04012026.txt",
      subfolder: "Interviews",
      documentType: "transcript_vtt",
      content: INTERVIEW_NOTES_2,
      description: "Clinical interview session 2 (43 min), Denver County Jail"
    }
  ],
  scores: [MMPI3_SCORES, PAI_SCORES, WAIS_IV_SCORES, MACCAT_CA_SCORES],
  decisions: [
    {
      diagnosisKey: "F25.0",
      icdCode: "ICD-10-CM",
      diagnosisName: "Schizoaffective Disorder, Bipolar Type",
      decision: "render",
      clinicianNotes: "Well-established diagnosis with 4 hospitalizations, consistent MMPI-3/PAI profiles, documented psychotic symptoms across multiple sources. Current decompensation secondary to 3-month medication noncompliance."
    },
    {
      diagnosisKey: "F12.20",
      icdCode: "ICD-10-CM",
      diagnosisName: "Cannabis Use Disorder, Moderate",
      decision: "render",
      clinicianNotes: "Documented in CMHIP records. Per self-report, intermittent use continues. Not a primary contributor to current presentation but relevant to treatment planning."
    },
    {
      diagnosisKey: "Z65.1",
      icdCode: "ICD-10-CM",
      diagnosisName: "Imprisonment",
      decision: "render",
      clinicianNotes: "Contextual factor relevant to current evaluation setting."
    },
    {
      diagnosisKey: "F31.9",
      icdCode: "ICD-10-CM",
      diagnosisName: "Bipolar Disorder, Unspecified",
      decision: "rule_out",
      clinicianNotes: "Psychotic features and course are better accounted for by schizoaffective disorder. No periods of psychosis independent of mood episodes were identified in the limited history available, but the schizoaffective presentation across multiple hospitalizations and treatment responses supports schizoaffective over pure bipolar."
    },
    {
      diagnosisKey: "F20.9",
      icdCode: "ICD-10-CM",
      diagnosisName: "Schizophrenia, Unspecified",
      decision: "rule_out",
      clinicianNotes: "Mood episodes (depressive) documented during 2020 CMHIP admission argue against pure schizophrenia. Schizoaffective, bipolar type, better fits the longitudinal course."
    }
  ],
  formulation: {
    formulation: "Mr. Riggins is a 28-year-old Black male with a well-documented history of Schizoaffective Disorder, Bipolar Type, currently experiencing psychotic decompensation following approximately 3 months of antipsychotic medication noncompliance. His presentation, including auditory hallucinations, persecutory delusions, and disorganized thought processes, is consistent across multiple data sources: clinical interview, collateral contact with his mother, jail medical records, prior hospitalization records, and objective psychological testing (MMPI-3, PAI, WAIS-IV, MacCAT-CA).\n\nWith respect to the referral questions, Mr. Riggins demonstrates adequate factual understanding of the proceedings (MacCAT-CA Understanding = 10) but significantly impaired rational understanding (MacCAT-CA Appreciation = 4) and impaired ability to assist counsel. Active psychotic symptoms intrude upon his legal reasoning, producing paranoid beliefs about counsel and delusional interpretations of the courtroom environment. His cognitive profile (FSIQ = 86) represents a likely underestimate given attentional interference from hallucinations.\n\nGiven his history of successful competency restoration at CMHIP in 2020 (69-day course on risperidone 4mg BID) and his partial response to medication reinstatement since booking, the prognosis for restoration is favorable with continued antipsychotic treatment in a structured setting. However, his documented pattern of cyclic medication noncompliance raises concerns about long-term maintenance of competency if returned to the community without robust support systems."
  },
  agentResults: [INGESTOR_RESULT, DIAGNOSTICIAN_RESULT, WRITER_RESULT, EDITOR_RESULT],
  dataConfirmations: [
    { categoryId: "demographics", status: "confirmed", notes: "Verified against jail booking records and CMHIP discharge summary" },
    { categoryId: "referral_questions", status: "confirmed", notes: "Three referral questions confirmed per court order" }
  ],
  // ---------------------------------------------------------------------------
  // Pipeline steps - ordered execution
  // ---------------------------------------------------------------------------
  steps: [
    // === ONBOARDING STAGE ===
    {
      description: "Create case: DeShawn Riggins, CST evaluation",
      action: { type: "create_case" },
      expectedStage: "onboarding",
      tags: ["screenshot"]
    },
    {
      description: "Screenshot: Empty case created in onboarding",
      action: { type: "screenshot", label: "01_case_created_onboarding" }
    },
    {
      description: "Save intake form (court-ordered CST)",
      action: { type: "save_intake" },
      expectedStage: "onboarding"
    },
    {
      description: "Ingest court order (Case No. 2026CR1847)",
      action: { type: "ingest_document", documentIndex: 0 },
      expectedStage: "onboarding"
    },
    {
      description: "Ingest police report (Det. Kowalski)",
      action: { type: "ingest_document", documentIndex: 1 },
      expectedStage: "onboarding"
    },
    {
      description: "Ingest jail medical screening",
      action: { type: "ingest_document", documentIndex: 2 },
      expectedStage: "onboarding"
    },
    {
      description: "Ingest CMHIP discharge summary (2020)",
      action: { type: "ingest_document", documentIndex: 3 },
      expectedStage: "onboarding"
    },
    {
      description: "Ingest defense motion for competency",
      action: { type: "ingest_document", documentIndex: 4 },
      expectedStage: "onboarding"
    },
    {
      description: "Ingest collateral contact (mother Loretta Riggins)",
      action: { type: "ingest_document", documentIndex: 5 },
      expectedStage: "onboarding"
    },
    {
      description: "Screenshot: All onboarding documents ingested",
      action: { type: "screenshot", label: "02_onboarding_docs_complete" }
    },
    {
      description: "Confirm demographics data",
      action: { type: "confirm_data", confirmationIndex: 0 },
      expectedStage: "onboarding"
    },
    {
      description: "Confirm referral questions",
      action: { type: "confirm_data", confirmationIndex: 1 },
      expectedStage: "onboarding"
    },
    {
      description: "Advance: onboarding -> testing",
      action: { type: "advance_stage" },
      expectedStage: "testing"
    },
    {
      description: "Screenshot: Advanced to testing stage",
      action: { type: "screenshot", label: "03_testing_stage_entered" }
    },
    // === TESTING STAGE ===
    {
      description: "Ingest MMPI-3 score report",
      action: { type: "ingest_document", documentIndex: 6 },
      expectedStage: "testing"
    },
    {
      description: "Save MMPI-3 scores (manual entry)",
      action: { type: "save_scores", scoreIndex: 0 },
      expectedStage: "testing"
    },
    {
      description: "Ingest PAI score report",
      action: { type: "ingest_document", documentIndex: 7 },
      expectedStage: "testing"
    },
    {
      description: "Save PAI scores (manual entry)",
      action: { type: "save_scores", scoreIndex: 1 },
      expectedStage: "testing"
    },
    {
      description: "Ingest WAIS-IV score report",
      action: { type: "ingest_document", documentIndex: 8 },
      expectedStage: "testing"
    },
    {
      description: "Save WAIS-IV scores (manual entry)",
      action: { type: "save_scores", scoreIndex: 2 },
      expectedStage: "testing"
    },
    {
      description: "Ingest MacCAT-CA score report",
      action: { type: "ingest_document", documentIndex: 9 },
      expectedStage: "testing"
    },
    {
      description: "Save MacCAT-CA scores (manual entry)",
      action: { type: "save_scores", scoreIndex: 3 },
      expectedStage: "testing"
    },
    {
      description: "Screenshot: All test scores entered",
      action: { type: "screenshot", label: "04_test_scores_complete" }
    },
    {
      description: "Advance: testing -> interview",
      action: { type: "advance_stage" },
      expectedStage: "interview"
    },
    {
      description: "Screenshot: Advanced to interview stage",
      action: { type: "screenshot", label: "05_interview_stage_entered" }
    },
    // === INTERVIEW STAGE ===
    {
      description: "Ingest clinical interview session 1 notes",
      action: { type: "ingest_document", documentIndex: 10 },
      expectedStage: "interview"
    },
    {
      description: "Ingest clinical interview session 2 notes",
      action: { type: "ingest_document", documentIndex: 11 },
      expectedStage: "interview"
    },
    {
      description: "Screenshot: Interview documents uploaded",
      action: { type: "screenshot", label: "06_interviews_documented" }
    },
    {
      description: "Inject ingestor agent result (case synthesis)",
      action: { type: "inject_agent_result", agentResultIndex: 0 },
      expectedStage: "interview"
    },
    {
      description: "Advance: interview -> diagnostics",
      action: { type: "advance_stage" },
      expectedStage: "diagnostics"
    },
    {
      description: "Screenshot: Advanced to diagnostics stage",
      action: { type: "screenshot", label: "07_diagnostics_stage_entered" }
    },
    // === DIAGNOSTICS STAGE ===
    {
      description: "Inject diagnostician agent result (evidence map)",
      action: { type: "inject_agent_result", agentResultIndex: 1 },
      expectedStage: "diagnostics"
    },
    {
      description: "Screenshot: Diagnostician evidence map available",
      action: { type: "screenshot", label: "08_evidence_map_ready" }
    },
    {
      description: "Clinician renders Schizoaffective Disorder, Bipolar Type (F25.0)",
      action: { type: "save_decision", decisionIndex: 0 },
      expectedStage: "diagnostics"
    },
    {
      description: "Clinician renders Cannabis Use Disorder, Moderate (F12.20)",
      action: { type: "save_decision", decisionIndex: 1 },
      expectedStage: "diagnostics"
    },
    {
      description: "Clinician renders Z-code: Imprisonment (Z65.1)",
      action: { type: "save_decision", decisionIndex: 2 },
      expectedStage: "diagnostics"
    },
    {
      description: "Clinician rules out Bipolar Disorder (F31.9)",
      action: { type: "save_decision", decisionIndex: 3 },
      expectedStage: "diagnostics"
    },
    {
      description: "Clinician rules out Schizophrenia (F20.9)",
      action: { type: "save_decision", decisionIndex: 4 },
      expectedStage: "diagnostics"
    },
    {
      description: "Save clinical formulation",
      action: { type: "save_formulation" },
      expectedStage: "diagnostics"
    },
    {
      description: "Screenshot: All diagnostic decisions and formulation complete",
      action: { type: "screenshot", label: "09_diagnostics_complete" }
    },
    {
      description: "Advance: diagnostics -> review",
      action: { type: "advance_stage" },
      expectedStage: "review"
    },
    {
      description: "Screenshot: Advanced to review stage",
      action: { type: "screenshot", label: "10_review_stage_entered" }
    },
    // === REVIEW STAGE ===
    {
      description: "Inject writer agent result (draft report)",
      action: { type: "inject_agent_result", agentResultIndex: 2 },
      expectedStage: "review"
    },
    {
      description: "Inject editor agent result (legal review)",
      action: { type: "inject_agent_result", agentResultIndex: 3 },
      expectedStage: "review"
    },
    {
      description: "Screenshot: Report drafted and reviewed",
      action: { type: "screenshot", label: "11_report_drafted" }
    },
    {
      description: "Clinician attests to report accuracy",
      action: { type: "attest_report" },
      expectedStage: "review"
    },
    {
      description: "Advance: review -> complete",
      action: { type: "advance_stage" },
      expectedStage: "complete"
    },
    {
      description: "Screenshot: Case complete",
      action: { type: "screenshot", label: "12_case_complete" }
    }
  ]
};
const MANIFESTS = {
  "cst-riggins-001": deshawnRigginsManifest
};
function listManifests() {
  return Object.values(MANIFESTS).map((m) => ({
    id: m.id,
    name: m.name,
    description: m.description,
    stopAtStage: m.stopAtStage,
    stepCount: m.steps.length
  }));
}
async function runManifestById(manifestId) {
  const manifest = MANIFESTS[manifestId];
  if (!manifest) {
    throw new Error(`Unknown manifest: ${manifestId}. Available: ${Object.keys(MANIFESTS).join(", ")}`);
  }
  return runManifest(manifest);
}
function registerTestHarnessHandlers() {
  electron.ipcMain.handle("testHarness:list", async () => {
    try {
      const manifests = listManifests();
      return { success: true, data: manifests };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
  electron.ipcMain.handle("testHarness:run", async (_event, params) => {
    try {
      const result = await runManifestById(params.manifestId);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
  electron.ipcMain.handle("testHarness:runAll", async () => {
    try {
      const manifests = listManifests();
      const results = [];
      for (const m of manifests) {
        const result = await runManifestById(m.id);
        results.push(result);
      }
      return { success: true, data: results };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}
const execFileAsync = util.promisify(child_process.execFile);
const CONTAINER_NAME = "psygil-onlyoffice";
const IMAGE = "onlyoffice/documentserver:latest";
const PORT = 9980;
const HEALTH_CHECK_INTERVAL_MS = 2e3;
const HEALTH_CHECK_TIMEOUT_MS = 12e4;
function storeSecret(secret) {
  {
    throw new Error("SafeStorage not initialized. Call initializeSafeStorage() first.");
  }
}
function getSecret() {
  {
    return null;
  }
}
async function isDockerAvailable() {
  try {
    const { stdout } = await execFileAsync("docker", ["--version"]);
    return stdout.includes("Docker");
  } catch {
    return false;
  }
}
async function isContainerRunning() {
  try {
    const { stdout } = await execFileAsync("docker", ["ps", "--filter", `name=${CONTAINER_NAME}`, "--format", "{{.Names}}"]);
    return stdout.trim() === CONTAINER_NAME;
  } catch {
    return false;
  }
}
async function waitForHealthCheck() {
  const startTime = Date.now();
  while (Date.now() - startTime < HEALTH_CHECK_TIMEOUT_MS) {
    try {
      const response = await fetch(`http://localhost:${PORT}/healthcheck`);
      if (response.ok) {
        return;
      }
    } catch {
    }
    await new Promise((resolve) => setTimeout(resolve, HEALTH_CHECK_INTERVAL_MS));
  }
  throw new Error(`OnlyOffice health check timed out after ${HEALTH_CHECK_TIMEOUT_MS}ms`);
}
async function startDocumentServer() {
  const dockerAvailable = await isDockerAvailable();
  if (!dockerAvailable) {
    throw new Error("Docker is not installed or not available on this system. Please install Docker to use OnlyOffice.");
  }
  const running = await isContainerRunning();
  if (running) {
    try {
      await waitForHealthCheck();
      let secret = getSecret();
      if (!secret) {
        secret = generateJwtSecret();
        storeSecret(secret);
      }
      return { port: PORT, jwtSecret: secret };
    } catch (err) {
      console.error("[onlyoffice] Health check failed for running container:", err);
      throw new Error("OnlyOffice container is running but not responding. Check Docker logs.");
    }
  }
  console.log("[onlyoffice] Starting container...");
  try {
    console.log("[onlyoffice] Pulling image...");
    await execFileAsync("docker", ["pull", IMAGE]);
    console.log("[onlyoffice] Ensuring volume exists...");
    try {
      await execFileAsync("docker", ["volume", "create", "psygil-oo-fonts"]);
    } catch {
    }
    console.log("[onlyoffice] Starting container...");
    await execFileAsync("docker", [
      "run",
      "-d",
      `--name=${CONTAINER_NAME}`,
      `-p=${PORT}:80`,
      "-v=psygil-oo-fonts:/usr/share/fonts/custom",
      `-e=JWT_ENABLED=true`,
      `-e=JWT_SECRET=${generateJwtSecret()}`,
      `-e=WOPI_ENABLED=false`,
      IMAGE
    ]);
    console.log("[onlyoffice] Waiting for health check...");
    await waitForHealthCheck();
    const secret = generateJwtSecret();
    storeSecret(secret);
    console.log("[onlyoffice] Container started and healthy");
    return { port: PORT, jwtSecret: secret };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to start OnlyOffice container: ${message}`);
  }
}
async function stopDocumentServer() {
  try {
    const running = await isContainerRunning();
    if (!running) {
      return;
    }
    console.log("[onlyoffice] Stopping container...");
    await execFileAsync("docker", ["stop", CONTAINER_NAME]);
    console.log("[onlyoffice] Container stopped");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to stop OnlyOffice container: ${message}`);
  }
}
async function getDocumentServerStatus() {
  try {
    const running = await isContainerRunning();
    if (!running) {
      return { running: false, port: null, healthy: false };
    }
    let healthy = false;
    try {
      const response = await fetch(`http://localhost:${PORT}/healthcheck`);
      healthy = response.ok;
    } catch {
      healthy = false;
    }
    return { running: true, port: PORT, healthy };
  } catch {
    return { running: false, port: null, healthy: false };
  }
}
async function getDocumentServerUrl() {
  const status = await getDocumentServerStatus();
  if (status.running && status.healthy) {
    return `http://localhost:${PORT}`;
  }
  return null;
}
function generateJwtSecret() {
  const crypto2 = require("crypto");
  return crypto2.randomBytes(32).toString("hex");
}
function generateJwtToken(payload) {
  const secret = getSecret();
  if (!secret) {
    throw new Error("JWT secret not configured. Start the Document Server first.");
  }
  const header = { alg: "HS256", typ: "JWT" };
  const headerEncoded = base64urlEncode(JSON.stringify(header));
  const payloadEncoded = base64urlEncode(JSON.stringify(payload));
  const signatureInput = `${headerEncoded}.${payloadEncoded}`;
  const signature = crypto.createHmac("sha256", secret).update(signatureInput).digest("base64");
  const signatureEncoded = base64urlEncode(signature);
  return `${signatureInput}.${signatureEncoded}`;
}
function base64urlEncode(str) {
  let input;
  if (typeof str === "string") {
    input = Buffer.from(str).toString("base64");
  } else {
    input = str.toString("base64");
  }
  return input.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
function getSecureEditorConfig() {
  return {
    customization: {
      macros: false,
      macrosMode: "disable",
      plugins: false
    },
    permissions: {
      fillForms: false,
      modifyContentControl: false,
      modifyFilter: false
    }
  };
}
let Document;
let Packer;
let Paragraph;
let HeadingLevel;
let TextRun;
try {
  const docxModule = require("docx");
  Document = docxModule.Document;
  Packer = docxModule.Packer;
  Paragraph = docxModule.Paragraph;
  HeadingLevel = docxModule.HeadingLevel;
  TextRun = docxModule.TextRun;
} catch (err) {
  console.error("[docx-generator] Failed to load docx module:", err);
  throw new Error("docx module not found. Make sure docx is installed: npm install docx");
}
async function generateReportDocx(caseId, writerOutput, editorOutput, outputDir) {
  let reportDir;
  {
    const wsPath = loadWorkspacePath();
    if (!wsPath) {
      throw new Error("Workspace not configured");
    }
    reportDir = getReportDraftsDir$1(caseId, wsPath);
  }
  fs.mkdirSync(reportDir, { recursive: true });
  const version = getNextVersion(reportDir);
  const sections = buildDocumentSections(writerOutput, editorOutput);
  const doc = new Document({
    sections: [
      {
        children: sections
      }
    ]
  });
  const bytes = await Packer.toBuffer(doc);
  const filePath = path.join(reportDir, `draft_v${version}.docx`);
  await fs.promises.writeFile(filePath, bytes);
  console.log("[docx-generator] Generated:", filePath);
  return { filePath, version };
}
function getReportDraftsDir$1(caseId, workspacePath) {
  const wsPath = workspacePath ?? loadWorkspacePath();
  if (!wsPath) {
    throw new Error("Workspace not configured");
  }
  return path.join(wsPath, `case_${caseId}`, "report", "drafts");
}
function getNextVersion(reportDir) {
  try {
    const files = fs.readdirSync(reportDir);
    const draftFiles = files.filter((f) => f.match(/^draft_v\d+\.docx$/));
    if (draftFiles.length === 0) return 1;
    const versions = draftFiles.map((f) => {
      const match = f.match(/draft_v(\d+)\.docx/);
      return match ? parseInt(match[1], 10) : 0;
    }).filter((v) => v > 0);
    return Math.max(...versions) + 1;
  } catch {
    return 1;
  }
}
function buildDocumentSections(writerOutput, editorOutput) {
  const sections = [];
  sections.push(
    new Paragraph({
      text: "Forensic Psychology Evaluation Report",
      heading: HeadingLevel.HEADING_1,
      alignment: "center",
      spacing: { after: 400 }
    })
  );
  const summary = writerOutput.report_summary;
  if (summary) {
    sections.push(
      new Paragraph({
        text: "Report Summary",
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 200 }
      })
    );
    const summaryRows = [];
    if (summary.patient_name) {
      summaryRows.push(
        new Paragraph({
          children: [new TextRun({ text: "Patient: ", bold: true }), new TextRun(summary.patient_name)],
          spacing: { after: 100 }
        })
      );
    }
    if (summary.evaluation_dates) {
      summaryRows.push(
        new Paragraph({
          children: [new TextRun({ text: "Evaluation Dates: ", bold: true }), new TextRun(summary.evaluation_dates)],
          spacing: { after: 100 }
        })
      );
    }
    if (summary.evaluation_type) {
      summaryRows.push(
        new Paragraph({
          children: [new TextRun({ text: "Evaluation Type: ", bold: true }), new TextRun(summary.evaluation_type)],
          spacing: { after: 100 }
        })
      );
    }
    if (summary.selected_diagnoses && summary.selected_diagnoses.length > 0) {
      summaryRows.push(
        new Paragraph({
          children: [new TextRun({ text: "Selected Diagnoses: ", bold: true }), new TextRun(summary.selected_diagnoses.join(", "))],
          spacing: { after: 200 }
        })
      );
    }
    sections.push(...summaryRows);
  }
  sections.push(
    new Paragraph({
      pageBreakBefore: true,
      text: ""
    })
  );
  if (writerOutput.sections && writerOutput.sections.length > 0) {
    for (const section of writerOutput.sections) {
      sections.push(
        new Paragraph({
          text: section.section_name,
          heading: HeadingLevel.HEADING_2,
          spacing: { after: 200, before: 200 }
        })
      );
      const paragraphs = section.content.split("\n\n").filter((p) => p.trim());
      for (const para of paragraphs) {
        sections.push(
          new Paragraph({
            text: para.trim(),
            spacing: { after: 200 }
          })
        );
      }
      if (section.content_type === "draft_requiring_revision") {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({
                text: "⚠️ AI DRAFT, CLINICIAN REVIEW REQUIRED",
                bold: true,
                color: "FF6B35"
              })
            ],
            spacing: { after: 200, before: 100 }
          })
        );
      }
      if (section.sources && section.sources.length > 0) {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({
                text: "Sources: ",
                italic: true,
                color: "666666"
              }),
              new TextRun({
                text: section.sources.join("; "),
                italic: true,
                color: "666666"
              })
            ],
            spacing: { after: 300 }
          })
        );
      }
    }
  }
  if (editorOutput && editorOutput.annotations && editorOutput.annotations.length > 0) {
    sections.push(
      new Paragraph({
        pageBreakBefore: true,
        text: "Editor Review Annotations",
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 200 }
      })
    );
    const summary2 = editorOutput.review_summary;
    sections.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Total Flags: ${summary2.total_flags} (Critical: ${summary2.critical_flags}, High: ${summary2.high_flags}, Medium: ${summary2.medium_flags}, Low: ${summary2.low_flags})`,
            bold: true
          })
        ],
        spacing: { after: 200 }
      })
    );
    const annotationRows = [];
    for (const annotation of editorOutput.annotations) {
      annotationRows.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `[${annotation.severity.toUpperCase()}] ${annotation.flag_type}: `,
              bold: true,
              color: getSeverityColor(annotation.severity)
            })
          ],
          spacing: { before: 100 }
        })
      );
      annotationRows.push(
        new Paragraph({
          text: annotation.location.section_name,
          spacing: { after: 50 },
          indent: { left: 400 }
        })
      );
      annotationRows.push(
        new Paragraph({
          text: annotation.description,
          spacing: { after: 100 },
          indent: { left: 400 }
        })
      );
      annotationRows.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "Suggestion: ",
              italic: true
            }),
            new TextRun({
              text: annotation.suggestion,
              italic: true
            })
          ],
          spacing: { after: 200 },
          indent: { left: 400 }
        })
      );
    }
    sections.push(...annotationRows);
  }
  return sections;
}
function getSeverityColor(severity) {
  switch (severity) {
    case "critical":
      return "CC0000";
    case "high":
      return "FF6B35";
    case "medium":
      return "FFC107";
    case "low":
      return "4CAF50";
    default:
      return "000000";
  }
}
function logAuditEntry(params) {
  const sqlite = getSqlite();
  let actorUserId = 0;
  if (params.actorType === "clinician" && params.actorId) {
    const parsed = parseInt(params.actorId, 10);
    if (!isNaN(parsed)) {
      actorUserId = parsed;
    }
  } else if (params.actorType === "ai_agent") {
    actorUserId = -1;
  }
  const detailsJson = JSON.stringify(params.details);
  const result = sqlite.prepare(
    `INSERT INTO audit_log
       (case_id, action_type, actor_user_id, action_date, details,
        related_entity_type, related_entity_id, granularity)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'decision_record_only')`
  ).run(
    params.caseId,
    params.actionType,
    actorUserId,
    (/* @__PURE__ */ new Date()).toISOString(),
    detailsJson,
    params.relatedEntityType ?? null,
    params.relatedEntityId ?? null
  );
  const auditLogId = result.lastInsertRowid ?? 0;
  console.log(`[audit] Logged: case_id=${params.caseId}, action=${params.actionType}, audit_log_id=${auditLogId}`);
  return auditLogId;
}
function getAuditTrail(caseId) {
  const sqlite = getSqlite();
  const rows = sqlite.prepare(
    `SELECT audit_log_id, case_id, action_type, actor_user_id, action_date, details,
              related_entity_type, related_entity_id, granularity
       FROM audit_log
       WHERE case_id = ?
       ORDER BY action_date DESC`
  ).all(caseId);
  return rows;
}
function exportAuditTrail(caseId, format = "csv") {
  const trail = getAuditTrail(caseId);
  if (format === "json") {
    return JSON.stringify(trail, null, 2);
  }
  const headers = ["Timestamp", "Action", "Actor ID", "Details", "Related Entity"];
  const rows = trail.map((entry) => [
    entry.action_date,
    entry.action_type,
    String(entry.actor_user_id),
    entry.details ? JSON.stringify(JSON.parse(entry.details)).substring(0, 100) : "",
    entry.related_entity_type ? `${entry.related_entity_type}#${entry.related_entity_id}` : ""
  ]);
  const csv = [headers, ...rows].map(
    (row) => row.map((cell) => {
      const str = String(cell);
      return str.includes(",") || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
    }).join(",")
  ).join("\n") + "\n";
  return csv;
}
function computeFileHash(filePath) {
  const hash = crypto.createHash("sha256");
  const fs2 = require("fs");
  const buffer = fs2.readFileSync(filePath);
  hash.update(buffer);
  return hash.digest("hex");
}
function getReportFinalDir(caseId, workspacePath) {
  const wsPath = loadWorkspacePath();
  if (!wsPath) {
    throw new Error("Workspace not configured");
  }
  return path.join(wsPath, `case_${caseId}`, "report", "final");
}
function getReportDraftsDir(caseId, workspacePath) {
  const wsPath = loadWorkspacePath();
  if (!wsPath) {
    throw new Error("Workspace not configured");
  }
  return path.join(wsPath, `case_${caseId}`, "report", "drafts");
}
function findLatestDraft(draftsDir) {
  try {
    if (!fs.existsSync(draftsDir)) {
      return null;
    }
    const files = fs.readdirSync(draftsDir);
    const draftFiles = files.filter((f) => f.match(/^draft_v\d+\.docx$/));
    if (draftFiles.length === 0) {
      return null;
    }
    const sorted = draftFiles.sort((a, b) => {
      const aMatch = a.match(/draft_v(\d+)/);
      const bMatch = b.match(/draft_v(\d+)/);
      const aVersion = aMatch ? parseInt(aMatch[1], 10) : 0;
      const bVersion = bMatch ? parseInt(bMatch[1], 10) : 0;
      return bVersion - aVersion;
    });
    return path.join(draftsDir, sorted[0]);
  } catch (error) {
    console.error("[reports] Error finding latest draft:", error);
    return null;
  }
}
async function generateSealedPdf(docxPath, outputPath) {
  try {
    child_process.execFileSync("soffice", [
      "--headless",
      "--convert-to",
      "pdf",
      "--outdir",
      path.resolve(outputPath, ".."),
      docxPath
    ], { timeout: 3e4 });
    console.log("[reports] PDF generated via LibreOffice:", outputPath);
  } catch (error) {
    console.warn("[reports] LibreOffice conversion failed:", error);
    console.warn("[reports] Falling back: PDF conversion must be done manually");
    throw new Error(
      "LibreOffice not available for PDF conversion. Please ensure LibreOffice is installed."
    );
  }
}
function resolveClinicianUserId() {
  const sqlite = getSqlite();
  const row = sqlite.prepare("SELECT user_id FROM users WHERE is_active = 1 ORDER BY user_id ASC LIMIT 1").get();
  if (row?.user_id) return row.user_id;
  sqlite.prepare(
    `INSERT OR IGNORE INTO users (user_id, email, full_name, role, credentials, is_active, created_at)
       VALUES (1, 'clinician@psygil.local', 'Default Clinician', 'psychologist', 'Ph.D.', 1, CURRENT_DATE)`
  ).run();
  return 1;
}
function submitAttestation(params) {
  const sqlite = getSqlite();
  const { caseId, signedBy, attestationStatement, signatureDate } = params;
  const clinicianUserId = resolveClinicianUserId();
  const caseRow = getCaseById(caseId);
  if (!caseRow) {
    throw new Error(`Case ${caseId} not found`);
  }
  if (caseRow.workflow_current_stage !== "review") {
    throw new Error(
      `Case must be in 'review' stage to submit attestation. Current stage: ${caseRow.workflow_current_stage}`
    );
  }
  const draftsDir = getReportDraftsDir(caseId);
  const draftDocxPath = findLatestDraft(draftsDir);
  if (!draftDocxPath) {
    throw new Error("No report draft found. Generate a report first.");
  }
  const finalDir = getReportFinalDir(caseId);
  fs.mkdirSync(finalDir, { recursive: true });
  const finalDocxPath = path.join(finalDir, "evaluation_report.docx");
  const fs$1 = require("fs");
  const content = fs$1.readFileSync(draftDocxPath);
  fs$1.writeFileSync(finalDocxPath, content);
  console.log("[reports] Copied final DOCX:", finalDocxPath);
  let pdfPath = null;
  try {
    const pdfFileName = "evaluation_report.pdf";
    pdfPath = path.join(finalDir, pdfFileName);
    generateSealedPdf(finalDocxPath, pdfPath);
  } catch (error) {
    console.warn("[reports] PDF generation failed:", error);
    pdfPath = null;
  }
  const integrityHash = computeFileHash(finalDocxPath);
  const stats = fs$1.statSync(finalDocxPath);
  const fileSizeBytes = stats.size;
  let reportId;
  const existingReport = sqlite.prepare("SELECT report_id FROM reports WHERE case_id = ? ORDER BY created_at DESC LIMIT 1").get(caseId);
  if (existingReport) {
    reportId = existingReport.report_id;
    sqlite.prepare(
      `UPDATE reports
         SET is_locked = 1, integrity_hash = ?, sealed_pdf_path = ?,
             finalized_by_user_id = ?, finalized_at = ?, status = 'finalized',
             file_path = ?, file_size_bytes = ?
         WHERE report_id = ?`
    ).run(
      integrityHash,
      pdfPath ?? null,
      clinicianUserId,
      (/* @__PURE__ */ new Date()).toISOString(),
      finalDocxPath,
      fileSizeBytes,
      reportId
    );
  } else {
    const result = sqlite.prepare(
      `INSERT INTO reports
         (case_id, generated_by_user_id, is_locked, integrity_hash, sealed_pdf_path,
          finalized_by_user_id, finalized_at, status, file_path, file_size_bytes, report_version)
         VALUES (?, ?, 1, ?, ?, ?, ?, 'finalized', ?, ?, 1)`
    ).run(
      caseId,
      clinicianUserId,
      integrityHash,
      pdfPath ?? null,
      clinicianUserId,
      (/* @__PURE__ */ new Date()).toISOString(),
      finalDocxPath,
      fileSizeBytes
    );
    reportId = result.lastInsertRowid ?? null;
  }
  logAuditEntry({
    caseId,
    actionType: "attestation_signed",
    actorType: "clinician",
    actorId: String(clinicianUserId),
    details: {
      signedBy,
      attestationStatement,
      signatureDate,
      integrityHash,
      filePath: finalDocxPath
    },
    relatedEntityType: "report",
    relatedEntityId: reportId
  });
  logAuditEntry({
    caseId,
    actionType: "report_signed",
    actorType: "clinician",
    actorId: String(clinicianUserId),
    details: {
      signedBy,
      attestationStatement,
      signatureDate,
      integrityHash,
      filePath: finalDocxPath
    },
    relatedEntityType: "report",
    relatedEntityId: reportId
  });
  return {
    reportId,
    integrityHash,
    pdfPath: pdfPath ?? "",
    docxPath: finalDocxPath
  };
}
function verifyIntegrity(caseId) {
  const sqlite = getSqlite();
  const reportRow = sqlite.prepare(
    "SELECT integrity_hash, file_path FROM reports WHERE case_id = ? AND is_locked = 1 ORDER BY finalized_at DESC LIMIT 1"
  ).get(caseId);
  if (!reportRow || !reportRow.file_path) {
    return {
      valid: false,
      storedHash: null,
      computedHash: ""
    };
  }
  const computedHash = computeFileHash(reportRow.file_path);
  return {
    valid: computedHash === (reportRow.integrity_hash ?? ""),
    storedHash: reportRow.integrity_hash ?? null,
    computedHash
  };
}
function getReportStatus(caseId) {
  const sqlite = getSqlite();
  const reportRow = sqlite.prepare(
    "SELECT report_id, status, is_locked, integrity_hash, report_version, sealed_pdf_path, file_path FROM reports WHERE case_id = ? ORDER BY created_at DESC LIMIT 1"
  ).get(caseId);
  if (!reportRow) {
    return {
      hasReport: false,
      status: null,
      isLocked: false,
      integrityHash: null,
      version: null,
      pdfPath: null,
      docxPath: null
    };
  }
  return {
    hasReport: true,
    status: reportRow.status ?? "draft",
    isLocked: reportRow.is_locked === 1,
    integrityHash: reportRow.integrity_hash ?? null,
    version: reportRow.report_version ?? null,
    pdfPath: reportRow.sealed_pdf_path ?? null,
    docxPath: reportRow.file_path ?? null
  };
}
function getCaseFolderPath(caseId, workspacePath) {
  const wsPath = loadWorkspacePath();
  if (!wsPath) {
    throw new Error("Workspace not configured");
  }
  return path.join(wsPath, `case_${caseId}`);
}
function generateCaseSummary(caseRow, auditTrail) {
  const summary = `# Case Summary, ${caseRow.case_number}

## Examinee Information
- **Name:** ${caseRow.examinee_first_name} ${caseRow.examinee_last_name}
- **Date of Birth:** ${caseRow.examinee_dob ?? "Not provided"}
- **Gender:** ${caseRow.examinee_gender ?? "Not provided"}

## Evaluation Details
- **Type:** ${caseRow.evaluation_type ?? "General"}
- **Referral Source:** ${caseRow.referral_source ?? "Not specified"}
- **Evaluation Questions:** ${caseRow.evaluation_questions ?? "None specified"}
- **Created:** ${caseRow.created_at}
- **Current Stage:** ${caseRow.workflow_current_stage ?? "Unknown"}

## Audit Trail Summary
- **Total Actions:** ${auditTrail.length}
- **Last Modified:** ${auditTrail[0]?.action_date ?? "Unknown"}

### Key Actions
${auditTrail.slice(0, 10).map((entry) => `- [${entry.action_date}] ${entry.action_type} (Actor: ${entry.actor_user_id})`).join("\n")}

---

*This summary generated for testimony preparation purposes.*
*Complete audit trail available in \`audit_trail.csv\`.*
`;
  return summary;
}
async function copyDirRecursive(src, dest) {
  const files = [];
  if (!fs.existsSync(src)) {
    return files;
  }
  fs.mkdirSync(dest, { recursive: true });
  const entries = await fs.promises.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      const subFiles = await copyDirRecursive(srcPath, destPath);
      files.push(...subFiles);
    } else {
      await fs.promises.copyFile(srcPath, destPath);
      files.push(path.basename(destPath));
    }
  }
  return files;
}
async function prepareTestimonyPackage(caseId) {
  const caseRow = getCaseById(caseId);
  if (!caseRow) {
    throw new Error(`Case ${caseId} not found`);
  }
  const caseFolder = getCaseFolderPath(caseId);
  const timestamp = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const exportDir = path.join(caseFolder, "exports", `testimony_${timestamp}`);
  fs.mkdirSync(exportDir, { recursive: true });
  const files = [];
  const reportDir = path.join(caseFolder, "report", "final");
  if (fs.existsSync(reportDir)) {
    const reportFiles = await copyDirRecursive(reportDir, path.join(exportDir, "report"));
    files.push(...reportFiles.map((f) => `report/${f}`));
  }
  const testingDir = path.join(caseFolder, "Testing");
  if (fs.existsSync(testingDir)) {
    const testFiles = await copyDirRecursive(testingDir, path.join(exportDir, "test_results"));
    files.push(...testFiles.map((f) => `test_results/${f}`));
  }
  const auditTrail = getAuditTrail(caseId);
  const caseSummary = generateCaseSummary(caseRow, auditTrail);
  const caseSummaryPath = path.join(exportDir, "case_summary.md");
  await fs.promises.writeFile(caseSummaryPath, caseSummary, "utf-8");
  files.push("case_summary.md");
  const auditCsv = exportAuditTrail(caseId, "csv");
  const auditPath = path.join(exportDir, "audit_trail.csv");
  await fs.promises.writeFile(auditPath, auditCsv, "utf-8");
  files.push("audit_trail.csv");
  console.log(`[testimony] Prepared package: ${exportDir}`);
  return {
    exportDir,
    files
  };
}
const SETUP_STATES = [
  "fresh",
  "sidecar_verified",
  "license_entered",
  "storage_ready",
  "profile_done",
  "ai_configured",
  "prefs_done",
  "clinical_done",
  "complete"
];
function stateRank(state) {
  return SETUP_STATES.indexOf(state);
}
function freshConfig() {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  return {
    version: 1,
    setupState: "fresh",
    createdAt: now,
    updatedAt: now,
    license: null,
    storage: null,
    practice: null,
    ai: null,
    appearance: null,
    clinical: null
  };
}
function getUserDataConfigPath() {
  return path.join(electron.app.getPath("userData"), "psygil-setup.json");
}
function getProjectConfigPath(projectRoot) {
  return path.join(projectRoot, ".psygil", "config.json");
}
function loadConfig() {
  const path2 = getUserDataConfigPath();
  if (!fs.existsSync(path2)) return freshConfig();
  try {
    const raw = fs.readFileSync(path2, "utf-8");
    const parsed = JSON.parse(raw);
    const base = freshConfig();
    return {
      ...base,
      ...parsed,
      version: 1,
      setupState: isValidState(parsed.setupState) ? parsed.setupState : "fresh",
      createdAt: parsed.createdAt ?? base.createdAt,
      updatedAt: parsed.updatedAt ?? base.updatedAt
    };
  } catch (err) {
    console.error("[setup/state] Failed to parse config, starting fresh:", err);
    return freshConfig();
  }
}
function isValidState(s) {
  return typeof s === "string" && SETUP_STATES.includes(s);
}
function saveConfig(config) {
  const stamped = {
    ...config,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  const userDataPath = getUserDataConfigPath();
  ensureParentDir(userDataPath);
  writeAtomic(userDataPath, JSON.stringify(stamped, null, 2));
  if (stamped.storage !== null) {
    try {
      const mirror = getProjectConfigPath(stamped.storage.projectRoot);
      ensureParentDir(mirror);
      writeAtomic(mirror, JSON.stringify(stamped, null, 2));
    } catch (err) {
      console.warn("[setup/state] Failed to write project mirror config:", err);
    }
  }
}
function ensureParentDir(filePath) {
  const parent = path.join(filePath, "..");
  if (!fs.existsSync(parent)) fs.mkdirSync(parent, { recursive: true });
}
function writeAtomic(filePath, content) {
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, content, "utf-8");
  try {
    const { renameSync } = require("fs");
    renameSync(tmp, filePath);
  } catch {
    fs.writeFileSync(filePath, content, "utf-8");
  }
}
function advanceTo(config, target) {
  if (stateRank(config.setupState) >= stateRank(target)) return config;
  return { ...config, setupState: target };
}
const MIN_FREE_BYTES = 500 * 1024 * 1024;
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function getCloudFolderPatterns() {
  const home = os.homedir();
  os.platform();
  const patterns = [
    {
      name: "iCloud Drive",
      matches: (p) => p.includes(`${path.sep}Library${path.sep}Mobile Documents${path.sep}com~apple~CloudDocs`) || p.includes(`${path.sep}iCloud Drive${path.sep}`) || p.endsWith(`${path.sep}iCloud Drive`)
    },
    {
      name: "Dropbox",
      matches: (p) => p.startsWith(`${home}${path.sep}Dropbox`) || p.includes(`${path.sep}Dropbox${path.sep}`) || p.endsWith(`${path.sep}Dropbox`)
    },
    {
      name: "Google Drive",
      matches: (p) => p.startsWith(`${home}${path.sep}Google Drive`) || p.includes(`${path.sep}Google Drive${path.sep}`) || p.endsWith(`${path.sep}Google Drive`) || p.includes(`${path.sep}GoogleDrive${path.sep}`)
    },
    {
      name: "OneDrive",
      matches: (p) => p.startsWith(`${home}${path.sep}OneDrive`) || p.includes(`${path.sep}OneDrive${path.sep}`) || p.endsWith(`${path.sep}OneDrive`) || new RegExp(`${escapeRegex(path.sep)}OneDrive - `, "i").test(p)
    },
    {
      name: "Box",
      matches: (p) => p.startsWith(`${home}${path.sep}Box`) || p.includes(`${path.sep}Box${path.sep}`) || p.includes(`${path.sep}Box Sync${path.sep}`)
    }
  ];
  return patterns;
}
function detectCloudFolder(path$1) {
  const norm = path.normalize(path$1);
  for (const pattern of getCloudFolderPatterns()) {
    if (pattern.matches(norm)) return pattern.name;
  }
  return null;
}
const POSIX_SYSTEM_PREFIXES = [
  "/etc",
  "/usr",
  "/bin",
  "/sbin",
  "/var",
  "/System",
  "/Library",
  "/private",
  "/dev",
  "/proc",
  "/sys"
];
const WIN32_SYSTEM_PREFIXES = [
  "C:\\Windows",
  "C:\\Program Files",
  "C:\\Program Files (x86)",
  "C:\\ProgramData"
];
function isUnderOsTmpdir(path$1) {
  const candidates = [os.tmpdir()];
  try {
    candidates.push(fs.realpathSync(os.tmpdir()));
  } catch {
  }
  return candidates.some((root) => path$1 === root || path$1.startsWith(`${root}${path.sep}`));
}
function isSystemDirectory(path$1) {
  const norm = path.normalize(path$1);
  if (isUnderOsTmpdir(norm)) return false;
  if (os.platform() === "win32") {
    return WIN32_SYSTEM_PREFIXES.some(
      (p) => norm.toLowerCase().startsWith(p.toLowerCase())
    );
  }
  if (norm === "/" || norm === path.sep) return true;
  return POSIX_SYSTEM_PREFIXES.some((p) => norm === p || norm.startsWith(`${p}${path.sep}`));
}
function getFreeSpace(path2) {
  try {
    const fs2 = require("fs");
    if (typeof fs2.statfsSync !== "function") return null;
    const stats = fs2.statfsSync(path2);
    return Number(stats.bavail * stats.bsize);
  } catch {
    return null;
  }
}
function validateStoragePath(inputPath) {
  const errors = [];
  const warnings = [];
  if (typeof inputPath !== "string" || inputPath.trim() === "") {
    return {
      ok: false,
      normalizedPath: "",
      errors: [{ code: "INVALID_PATH", message: "Path is empty." }],
      warnings: []
    };
  }
  const trimmed = inputPath.trim();
  if (!path.isAbsolute(trimmed)) {
    errors.push({ code: "NOT_ABSOLUTE", message: "Path must be absolute." });
  }
  if (trimmed.includes("..")) {
    errors.push({
      code: "PATH_TRAVERSAL",
      message: "Path contains parent-directory traversal segments."
    });
  }
  const normalized = path.resolve(trimmed);
  if (isSystemDirectory(normalized)) {
    errors.push({
      code: "SYSTEM_DIRECTORY",
      message: "Cannot use a system directory. Choose a location in your home folder."
    });
  }
  const parent = path.normalize(path.resolve(normalized, ".."));
  if (!fs.existsSync(parent)) {
    errors.push({
      code: "PARENT_MISSING",
      message: `Parent directory does not exist: ${parent}`
    });
  } else {
    try {
      const st = fs.statSync(parent);
      if (!st.isDirectory()) {
        errors.push({
          code: "NOT_A_DIRECTORY",
          message: `Parent path is not a directory: ${parent}`
        });
      } else {
        try {
          fs.accessSync(parent, fs.constants.W_OK);
        } catch {
          errors.push({
            code: "NOT_WRITABLE",
            message: `No write permission on ${parent}`
          });
        }
      }
    } catch {
      errors.push({
        code: "PARENT_MISSING",
        message: `Cannot stat parent directory: ${parent}`
      });
    }
  }
  const cloud = detectCloudFolder(normalized);
  if (cloud !== null) {
    warnings.push({
      code: "CLOUD_SYNC_FOLDER",
      message: `This folder appears to be synced by ${cloud}. Storing the Psygil database in a cloud-synced folder can cause database corruption because multiple sync clients may modify the file simultaneously. We strongly recommend choosing a local-only folder.`
    });
  }
  if (errors.find((e) => e.code === "PARENT_MISSING") === void 0) {
    const free = getFreeSpace(parent);
    if (free !== null && free < MIN_FREE_BYTES) {
      warnings.push({
        code: "LOW_DISK_SPACE",
        message: `Less than 500 MB free at ${parent}. Psygil needs room for case files and databases.`
      });
    }
  }
  if (fs.existsSync(normalized)) {
    try {
      const { readdirSync } = require("fs");
      const entries = readdirSync(normalized);
      if (entries.length > 0) {
        warnings.push({
          code: "PATH_NOT_EMPTY",
          message: "This folder already contains files. Setup will create the Psygil structure alongside them."
        });
      }
    } catch {
    }
  }
  return {
    ok: errors.length === 0,
    normalizedPath: normalized,
    errors,
    warnings
  };
}
const PROJECT_ROOT_SUBFOLDERS = [
  ".psygil",
  ".psygil/assets",
  "cases",
  // User-facing Workspace, a single home for all non-case content:
  //   Writing Samples, the clinician's own prior reports, used to
  //                     calibrate the Writer Agent's voice and style
  //   Templates, starter report templates (7 eval types) plus any
  //                     existing reports the clinician wants to convert
  //                     into templates
  //   Documents, reference materials (DSM codes, case law, statutes,
  //                     APA specialty guidelines, HIPAA forensic notes)
  //   Testing, scoring guides and interpretive references for the
  //                     instruments in the clinician's library
  //   Forms, blank intake/consent/release forms. Completed
  //                     copies live inside each case folder, never here.
  "Workspace",
  "Workspace/Writing Samples",
  "Workspace/Templates",
  "Workspace/Documents",
  "Workspace/Testing",
  "Workspace/Forms"
];
function provisionProjectRoot(projectRoot) {
  if (!path.isAbsolute(projectRoot)) {
    throw new Error(`provisionProjectRoot: path must be absolute, got ${projectRoot}`);
  }
  const created = [];
  for (const sub of ["", ...PROJECT_ROOT_SUBFOLDERS]) {
    const full = sub === "" ? projectRoot : path.resolve(projectRoot, sub);
    if (!fs.existsSync(full)) {
      fs.mkdirSync(full, { recursive: true });
      created.push(full);
    }
  }
  const probe = path.resolve(projectRoot, ".psygil", ".write-probe");
  try {
    fs.writeFileSync(probe, `psygil-write-probe ${(/* @__PURE__ */ new Date()).toISOString()}`, "utf-8");
    fs.unlinkSync(probe);
  } catch (err) {
    throw new Error(
      `Project root is not writable after provisioning: ${projectRoot}. ${err.message}`
    );
  }
  return created;
}
const KEY_REGEX = /^PSGIL-([A-Z0-9]{5})-([A-Z0-9]{5})-([A-Z0-9]{5})-([A-Z0-9]{5})$/;
const REMOTE_TIMEOUT_MS = 5e3;
function normalizeLicenseKey(raw) {
  return raw.replace(/\s+/g, "").toUpperCase();
}
function validateLocal(rawKey) {
  const key = normalizeLicenseKey(rawKey);
  if (!KEY_REGEX.test(key)) {
    return {
      ok: false,
      license: null,
      errorCode: "MALFORMED",
      errorMessage: "License key format is invalid. Expected PSGIL-XXXXX-XXXXX-XXXXX-XXXXX.",
      source: "local",
      offlineFallback: false
    };
  }
  const match = KEY_REGEX.exec(key);
  if (match === null) {
    return {
      ok: false,
      license: null,
      errorCode: "MALFORMED",
      errorMessage: "License key format is invalid.",
      source: "local",
      offlineFallback: false
    };
  }
  const block1 = match[1];
  const block2 = match[2];
  let tier;
  if (block1.startsWith("SOLO")) {
    tier = "solo";
  } else if (block1.startsWith("PRAC")) {
    tier = "practice";
  } else if (block1.startsWith("ENTR")) {
    tier = "enterprise";
  } else {
    return {
      ok: false,
      license: null,
      errorCode: "UNKNOWN_TIER",
      errorMessage: `Unknown license tier marker: ${block1}`,
      source: "local",
      offlineFallback: false
    };
  }
  const seats = extractSeats(tier, block2);
  return {
    ok: true,
    license: {
      tier,
      seats,
      expiresAt: null,
      activatedAt: (/* @__PURE__ */ new Date()).toISOString()
    },
    errorCode: null,
    errorMessage: null,
    source: "local",
    offlineFallback: false
  };
}
async function validateRemote(rawKey, serverUrl) {
  const key = normalizeLicenseKey(rawKey);
  const trimmed = serverUrl.replace(/\/+$/, "");
  if (!trimmed.startsWith("https://")) {
    throw new Error("License server URL must use https://");
  }
  const endpoint = `${trimmed}/v1/licenses/validate`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REMOTE_TIMEOUT_MS);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
      signal: controller.signal
    });
    if (!response.ok) {
      return {
        ok: false,
        license: null,
        errorCode: "REJECTED",
        errorMessage: `License server returned HTTP ${response.status}`,
        source: "remote",
        offlineFallback: false
      };
    }
    const body = await response.json();
    if (body.ok === true) {
      const tier = body.tier;
      if (tier !== "solo" && tier !== "practice" && tier !== "enterprise") {
        return {
          ok: false,
          license: null,
          errorCode: "UNKNOWN_TIER",
          errorMessage: `Server returned unknown tier: ${String(tier)}`,
          source: "remote",
          offlineFallback: false
        };
      }
      return {
        ok: true,
        license: {
          tier,
          seats: typeof body.seats === "number" && body.seats > 0 ? body.seats : 1,
          expiresAt: typeof body.expiresAt === "string" ? body.expiresAt : null,
          activatedAt: (/* @__PURE__ */ new Date()).toISOString()
        },
        errorCode: null,
        errorMessage: null,
        source: "remote",
        offlineFallback: false
      };
    }
    const errorCode = body.errorCode === "EXPIRED" || body.errorCode === "REJECTED" ? body.errorCode : "REJECTED";
    return {
      ok: false,
      license: null,
      errorCode,
      errorMessage: body.errorMessage ?? "License rejected by server.",
      source: "remote",
      offlineFallback: false
    };
  } finally {
    clearTimeout(timer);
  }
}
async function validateLicense(rawKey) {
  const local = validateLocal(rawKey);
  if (!local.ok && local.errorCode === "MALFORMED") return local;
  const serverUrl = getConfiguredLicenseServer();
  if (serverUrl === null) {
    return local;
  }
  try {
    return await validateRemote(rawKey, serverUrl);
  } catch (err) {
    if (local.ok) {
      return {
        ...local,
        offlineFallback: true
      };
    }
    return {
      ok: false,
      license: null,
      errorCode: "NETWORK",
      errorMessage: `Cannot reach license server and the key did not pass local validation. ${err.message}`,
      source: "remote",
      offlineFallback: false
    };
  }
}
function extractSeats(tier, block2) {
  if (tier === "solo") return 1;
  const seatMatch = /^SEAT(\d{1,3})$/.exec(block2);
  if (seatMatch !== null) {
    const n = Number.parseInt(seatMatch[1], 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return tier === "practice" ? 5 : 25;
}
function getConfiguredLicenseServer() {
  const env = process.env["PSYGIL_LICENSE_SERVER"];
  if (typeof env === "string" && env.trim().length > 0) {
    return env.trim();
  }
  return null;
}
const HEADER_BLOCK = {
  heading: "Header",
  body: [
    "{{PRACTICE_NAME}}",
    "{{PRACTICE_ADDRESS}}",
    "Phone: {{PRACTICE_PHONE}}",
    "",
    "CONFIDENTIAL FORENSIC PSYCHOLOGICAL EVALUATION"
  ]
};
const IDENTIFYING_INFO = {
  heading: "Identifying Information",
  body: [
    "Patient Name: {{PATIENT_NAME}}",
    "Date of Birth: {{DATE_OF_BIRTH}}",
    "Case Number: {{CASE_NUMBER}}",
    "Referring Party: {{REFERRING_PARTY}}",
    "Date of Report: {{DATE_OF_REPORT}}",
    "Dates of Contact: {{DATES_OF_CONTACT}}",
    "Examiner: {{CLINICIAN_FULL_NAME}}, {{CLINICIAN_CREDENTIALS}}",
    "License: {{CLINICIAN_LICENSE}} ({{CLINICIAN_STATE}})"
  ]
};
const NOTICE_OF_NON_CONFIDENTIALITY = {
  heading: "Notice of Non-Confidentiality",
  body: [
    "The evaluee was informed at the outset that this evaluation is being conducted at the request of {{REFERRING_PARTY}} and that the usual rules of doctor-patient confidentiality do not apply. The evaluee was advised that information obtained during the evaluation would be included in a written report provided to the referring party and that the report may be shared with the court and other parties to the legal proceeding. The evaluee acknowledged understanding of these limits and voluntarily agreed to participate."
  ]
};
const PROCEDURES_BOILERPLATE = [
  "Review of records provided by the referring party",
  "Clinical interview with the evaluee",
  "Mental status examination",
  "Collateral interview(s) where appropriate",
  "Standardized psychological testing (see Test Results)",
  "Symptom validity and effort testing"
];
const SIGNATURE_BLOCK$1 = {
  heading: "Signature",
  body: [
    "The opinions expressed in this report are held to a reasonable degree of psychological certainty based on the data reviewed and the methods described. If additional information becomes available, I reserve the right to supplement or modify these opinions.",
    "",
    "Respectfully submitted,",
    "",
    "",
    "_______________________________",
    "{{CLINICIAN_FULL_NAME}}, {{CLINICIAN_CREDENTIALS}}",
    "Licensed Psychologist, {{CLINICIAN_STATE}} #{{CLINICIAN_LICENSE}}",
    "Date: {{DATE_OF_REPORT}}"
  ]
};
const CST_TEMPLATE = {
  id: "report_cst",
  evalType: "CST",
  title: "Competency to Stand Trial Evaluation",
  subtitle: "Forensic Psychological Evaluation",
  sections: [
    HEADER_BLOCK,
    IDENTIFYING_INFO,
    {
      heading: "Referral Question",
      body: [
        "The {{COURT_NAME}} ordered a psychological evaluation to address the following question: whether {{PATIENT_NAME}} has sufficient present ability to consult with counsel with a reasonable degree of rational understanding, and whether the defendant has a rational as well as factual understanding of the proceedings, as set forth in Dusky v. United States, 362 U.S. 402 (1960). The court order specified the following jurisdiction-specific statutory criteria: {{JURISDICTION}} competency standard."
      ]
    },
    NOTICE_OF_NON_CONFIDENTIALITY,
    {
      heading: "Procedures",
      body: [
        "The following procedures were used in the preparation of this report:",
        ...PROCEDURES_BOILERPLATE,
        "Administration of the MacArthur Competence Assessment Tool, Criminal Adjudication (MacCAT-CA)",
        "Administration of the Evaluation of Competency to Stand Trial, Revised (ECST-R)"
      ]
    },
    {
      heading: "Records Reviewed",
      body: [
        "Arrest report and charging documents dated [DATE]",
        "Criminal complaint and affidavit of probable cause",
        "Prior psychiatric and psychological evaluation reports",
        "Jail medical intake screening and mental health records",
        "Prescription medication administration records from the detention facility",
        "Prior competency evaluation(s), if any",
        "Collateral statements from defense counsel"
      ]
    },
    {
      heading: "Relevant Background",
      body: [
        "{{PATIENT_NAME}} is a [AGE]-year-old [RACE/ETHNICITY] [GENDER] who was born in [LOCATION]. The defendant reported being raised by [CAREGIVERS] and described the home environment as [DESCRIPTION]. There was no reported history of physical abuse, sexual abuse, or neglect, though the defendant noted [RELEVANT CHILDHOOD DETAILS]. The defendant completed [EDUCATION LEVEL] and reported [WORK HISTORY]. The defendant denied any history of special education placement or learning disability diagnosis.",
        "Regarding psychiatric history, the defendant reported first contact with mental health services at age [AGE] for [SYMPTOMS]. The defendant has carried diagnoses of [DIAGNOSES] and has been prescribed [MEDICATIONS]. The defendant reported [NUMBER] prior psychiatric hospitalizations, the most recent in [DATE] at [FACILITY] for [REASON]. The defendant described [COMPLIANCE/NONCOMPLIANCE] with prescribed medications prior to the current arrest.",
        "The defendant reported a history of [SUBSTANCE] use beginning at age [AGE]. At its most severe, the defendant described [PATTERN OF USE]. The defendant reported last using [SUBSTANCE] on [DATE]. The defendant denied any history of medically supervised detoxification or inpatient substance treatment, though noted [RELEVANT TREATMENT HISTORY].",
        "The defendant has a criminal history that includes [NUMBER] prior arrests for [OFFENSES]. The defendant reported [NUMBER] prior incarcerations, with the longest term being [DURATION]. The defendant denied any prior competency evaluations or commitments for competency restoration. The defendant is currently charged with [CHARGES] and faces a potential sentence of [RANGE]."
      ]
    },
    {
      heading: "Mental Status Examination",
      body: [
        "{{PATIENT_NAME}} presented as a [BUILD] [RACE/ETHNICITY] [GENDER] who appeared [CONSISTENT/OLDER/YOUNGER] than the stated age of [AGE]. The defendant was dressed in jail-issued clothing and appeared [GROOMING]. The defendant was [COOPERATIVE/GUARDED/HOSTILE] with the evaluation process and [DID/DID NOT] appear to put forth adequate effort.",
        "Speech was [RATE], [RHYTHM], and [VOLUME], with [NORMAL/ABNORMAL] prosody. The defendant's receptive language appeared [INTACT/IMPAIRED], and expressive language was [DESCRIPTION]. The defendant [DID/DID NOT] require repetition of questions.",
        'The defendant described mood as "[PATIENT WORDS]." Affect was [RANGE] in range, [CONGRUENT/INCONGRUENT] with stated mood, and [APPROPRIATE/INAPPROPRIATE] to content. No tearfulness, irritability, or affective lability was observed during the interview.',
        "Thought process was [LINEAR/CIRCUMSTANTIAL/TANGENTIAL/LOOSE]. The defendant [DENIED/ENDORSED] current suicidal ideation, homicidal ideation, and intent to harm self or others. The defendant [DENIED/ENDORSED] auditory hallucinations, visual hallucinations, and paranoid ideation. There was [NO EVIDENCE/EVIDENCE] of delusional thinking during the interview. Thought content was notable for [RELEVANT CONTENT].",
        "The defendant was oriented to person, place, date, and situation. Attention and concentration appeared [INTACT/IMPAIRED] based on the defendant's ability to track questions and maintain the thread of conversation throughout the interview. Immediate recall was [INTACT/IMPAIRED]. The defendant demonstrated [ADEQUATE/IMPAIRED] fund of general knowledge. Insight into the current legal situation was [GOOD/FAIR/POOR]. Judgment, as assessed by the defendant's decision-making in the current legal context, was [GOOD/FAIR/POOR]."
      ]
    },
    {
      heading: "Test Results",
      body: [
        "MacArthur Competence Assessment Tool, Criminal Adjudication (MacCAT-CA): The MacCAT-CA is a structured clinical instrument that assesses three areas of competency-related abilities. On the Understanding subscale, the defendant scored [SCORE], which falls in the [RANGE] range and indicates [INTERPRETATION] grasp of the legal process. On the Reasoning subscale, the defendant scored [SCORE], indicating [INTERPRETATION] ability to process and discriminate legally relevant information. On the Appreciation subscale, the defendant scored [SCORE], indicating [INTERPRETATION] capacity to apply legal understanding to the defendant's own case.",
        "Evaluation of Competency to Stand Trial, Revised (ECST-R): The ECST-R is a structured interview designed to assess competency-relevant abilities and includes embedded validity scales. On the Consult with Counsel subscale, the defendant scored [SCORE], placing performance in the [RANGE] range. On the Factual Understanding of Courtroom Proceedings subscale, the defendant scored [SCORE], in the [RANGE] range. On the Rational Understanding of Courtroom Proceedings subscale, the defendant scored [SCORE], in the [RANGE] range. The Atypical Presentation Scale score was [SCORE], which [DID/DID NOT] exceed the recommended cutoff for suspected feigning of incompetency.",
        "Miller Forensic Assessment of Symptoms Test (M-FAST): The M-FAST is a brief screening instrument for feigned mental illness. The defendant obtained a total score of [SCORE]. Scores at or above 6 suggest possible malingering and warrant further assessment. The defendant's score [DID/DID NOT] exceed this threshold.",
        "Validity Indicator Profile (VIP) or Test of Memory Malingering (TOMM): [INSTRUMENT] was administered to assess effort and response validity. The defendant scored [SCORES ACROSS TRIALS]. These results [ARE/ARE NOT] consistent with adequate effort, and the defendant's performance [IS/IS NOT] considered valid for interpretation purposes."
      ]
    },
    {
      heading: "Functional Abilities Assessment",
      body: [
        "Factual Understanding of the Proceedings: The defendant was asked to describe the roles of various courtroom personnel. The defendant [CORRECTLY/INCORRECTLY] identified the role of the judge as [DEFENDANT'S RESPONSE]. The defendant described the prosecutor's role as [DEFENDANT'S RESPONSE] and defense counsel's role as [DEFENDANT'S RESPONSE]. The defendant [WAS/WAS NOT] able to explain the function of a jury. The defendant demonstrated [ADEQUATE/INADEQUATE] understanding of the adversarial nature of the proceedings and [COULD/COULD NOT] identify the range of pleas available (guilty, not guilty, no contest). When asked about the potential consequences of conviction, the defendant stated [DEFENDANT'S RESPONSE].",
        "Rational Understanding of the Proceedings: The defendant was asked to describe how the legal proceedings apply to the defendant's own situation. The defendant [WAS/WAS NOT] able to articulate the specific charges and their elements in basic terms. When asked what evidence the prosecution might present, the defendant stated [DEFENDANT'S RESPONSE]. The defendant's account of the alleged offense was [CONSISTENT/INCONSISTENT] across the interview and [DID/DID NOT] reflect an appreciation of the legal significance of the facts. The defendant [DID/DID NOT] demonstrate the ability to weigh the relative merits of going to trial versus accepting a plea offer, stating [DEFENDANT'S RESPONSE].",
        "Capacity to Consult with Counsel: The defendant reported [FREQUENCY AND QUALITY] of contact with defense counsel. The defendant [WAS/WAS NOT] able to identify the attorney by name and describe the content of recent discussions. During the evaluation, the defendant demonstrated [ADEQUATE/IMPAIRED] ability to track questions, provide relevant answers, and maintain a coherent conversational thread. The defendant [DID/DID NOT] show the ability to disclose potentially useful information when asked open-ended questions about the circumstances of the offense. The defendant's capacity to tolerate the stress of courtroom proceedings appeared [ADEQUATE/COMPROMISED] based on [BEHAVIORAL OBSERVATIONS]. The defendant [DID/DID NOT] demonstrate the ability to make reasoned decisions about defense strategy when presented with hypothetical scenarios."
      ]
    },
    {
      heading: "Clinical Formulation",
      body: [
        "Based on the totality of the data gathered in this evaluation, {{PATIENT_NAME}} presents with [CLINICAL PICTURE SUMMARY]. The defendant carries prior diagnoses of [DIAGNOSES], and the current evaluation findings are [CONSISTENT/INCONSISTENT] with [DIAGNOSIS per DSM-5-TR criteria]. Specifically, [DESCRIBE KEY SYMPTOMS AND HOW THEY MAP TO DIAGNOSTIC CRITERIA].",
        "With respect to competency-relevant abilities, the defendant's [DIAGNOSIS/SYMPTOMS] [DO/DO NOT] appear to impair the defendant's factual understanding of the proceedings. The defendant [CAN/CANNOT] identify courtroom personnel, describe the charges, and explain potential outcomes with reasonable accuracy. Regarding rational understanding, the defendant [IS/IS NOT] able to apply legal knowledge to the defendant's own case, as evidenced by [SPECIFIC EXAMPLES]. The defendant's capacity to consult with counsel [IS/IS NOT] compromised by [SYMPTOM/CONDITION], as demonstrated by [SPECIFIC EXAMPLES].",
        "Symptom validity testing produced results that [ARE/ARE NOT] consistent with genuine symptom presentation and adequate effort. The defendant's performance on the M-FAST [DID/DID NOT] suggest feigning of mental illness. Performance on the [TOMM/VIP] indicated [ADEQUATE/INADEQUATE] effort, and the cognitive and clinical test results are [CONSIDERED/NOT CONSIDERED] valid reflections of the defendant's actual functioning."
      ]
    },
    {
      heading: "Opinion",
      body: [
        "To a reasonable degree of psychological certainty, it is this examiner's opinion that {{PATIENT_NAME}} [IS/IS NOT] competent to stand trial at the present time.",
        "[IF COMPETENT]: The defendant demonstrates a factual and rational understanding of the nature and object of the proceedings and possesses a sufficient present ability to consult with counsel with a reasonable degree of rational understanding. While the defendant does present with [DIAGNOSIS/SYMPTOMS], these conditions do not impair the defendant's competency-relevant abilities to a degree that would render the defendant incompetent under the Dusky standard.",
        "[IF NOT COMPETENT]: The defendant does not, at the present time, possess a sufficient factual and rational understanding of the proceedings, and/or does not possess sufficient present ability to consult with counsel. Specifically, the defendant's [DIAGNOSIS/CONDITION] impairs the defendant's ability to [SPECIFIC DEFICITS]. These deficits are directly attributable to [CLINICAL CONDITION] and are not the product of deliberate malingering or volitional noncooperation, based on the validity testing results described above."
      ]
    },
    {
      heading: "Recommendations",
      body: [
        "[IF COMPETENT]: No further action is recommended for purposes of competency. The court may wish to consider [RELEVANT CLINICAL RECOMMENDATIONS, e.g., continued medication management, mental health monitoring during proceedings].",
        "[IF NOT COMPETENT]: It is recommended that the defendant be committed for competency restoration treatment. Based on the nature of the defendant's condition, inpatient treatment at a [STATE HOSPITAL/FORENSIC UNIT] is recommended. The defendant's primary deficits are in the area of [SPECIFIC DEFICITS], and restoration efforts should focus on [PSYCHOEDUCATION/MEDICATION STABILIZATION/SPECIFIC INTERVENTIONS]. Given the defendant's clinical presentation and treatment history, the prognosis for restoration within a [TIMEFRAME] period is [GOOD/FAIR/GUARDED/POOR]. The basis for this prognosis is [REASONING]."
      ]
    },
    SIGNATURE_BLOCK$1
  ]
};
const CUSTODY_TEMPLATE = {
  id: "report_custody",
  evalType: "Custody",
  title: "Child Custody Evaluation",
  subtitle: "Best Interests of the Child",
  sections: [
    HEADER_BLOCK,
    {
      heading: "Identifying Information",
      body: [
        "Child(ren): {{PATIENT_NAME}}",
        "Dates of Birth: {{DATE_OF_BIRTH}}",
        "Parents/Parties: (to be entered)",
        "Case Number: {{CASE_NUMBER}}",
        "Court: {{COURT_NAME}}",
        "Docket: {{DOCKET_NUMBER}}",
        "Referring Party: {{REFERRING_PARTY}}",
        "Date of Report: {{DATE_OF_REPORT}}",
        "Examiner: {{CLINICIAN_FULL_NAME}}, {{CLINICIAN_CREDENTIALS}}"
      ]
    },
    {
      heading: "Referral Question",
      body: [
        "The {{COURT_NAME}} ordered a psychological evaluation to address the best interests of the child(ren) with respect to decision-making responsibility and parenting time. The evaluation is guided by the APA Guidelines for Child Custody Evaluations in Family Law Proceedings (2010) and the AFCC Model Standards of Practice for Child Custody Evaluation (2022)."
      ]
    },
    {
      heading: "Notice of Limits on Confidentiality",
      body: [
        "All parties were informed at the outset that this is a court-ordered evaluation, that information obtained will be included in a written report provided to the court and the parties, and that the usual rules of confidentiality do not apply. Each parent signed a written acknowledgment of informed consent. The children were informed, in developmentally appropriate language, that the examiner would be writing a report for the judge about what is best for the family, and that what they said would not be kept secret from the parents or the court."
      ]
    },
    {
      heading: "Procedures",
      body: [
        "The following procedures were used in the preparation of this report:",
        "Review of court filings, prior orders, and legal pleadings",
        "Review of prior custody or parenting evaluations, if any",
        "Individual clinical interview with [PARENT A], approximately [HOURS] hours across [NUMBER] sessions",
        "Individual clinical interview with [PARENT B], approximately [HOURS] hours across [NUMBER] sessions",
        "Individual clinical interview with each child at a developmentally appropriate level",
        "Observation of [PARENT A]-child interaction (structured and unstructured, approximately [DURATION])",
        "Observation of [PARENT B]-child interaction (structured and unstructured, approximately [DURATION])",
        "Home visit to [PARENT A]'s residence on [DATE]",
        "Home visit to [PARENT B]'s residence on [DATE]",
        "Standardized psychological testing of each parent (see Test Results)",
        "Collateral interviews with [NUMBER] individuals identified by the parties and the court",
        "Review of school records, medical records, and mental health records for each child"
      ]
    },
    {
      heading: "Background of the Family",
      body: [
        "[PARENT A] and [PARENT B] married on [DATE] and separated on [DATE], after approximately [DURATION] of marriage. The couple has [NUMBER] children together: [CHILD NAMES AND AGES]. The separation was initiated by [PARENT] following [CIRCUMSTANCES]. The divorce petition was filed on [DATE].",
        "Both parents described the early relationship as [DESCRIPTION]. Conflict reportedly increased when [PRECIPITANT]. [PARENT A] alleged [ALLEGATIONS]. [PARENT B] denied these allegations and counter-alleged [COUNTER-ALLEGATIONS]. The court has [ISSUED/NOT ISSUED] any temporary protective orders. There [IS/IS NO] active involvement of child protective services.",
        "[CHILD NAME], age [AGE], is currently in [GRADE] at [SCHOOL]. The child's teachers describe the child as [TEACHER OBSERVATIONS]. The child [IS/IS NOT] receiving any special services at school. The child's pediatrician, [NAME], reported [RELEVANT MEDICAL INFORMATION]. The child [HAS/HAS NOT] been in individual therapy; if so, with [THERAPIST NAME] since [DATE] for [PRESENTING CONCERNS].",
        "The current parenting schedule, pursuant to temporary orders entered [DATE], provides for [SCHEDULE DESCRIPTION]. Both parties reported [COMPLIANCE/NONCOMPLIANCE] with the current schedule. [PARENT] reported conflict at exchanges, specifically [DESCRIPTION]."
      ]
    },
    {
      heading: "Clinical Interview with [PARENT A]",
      body: [
        "[PARENT A] is a [AGE]-year-old [OCCUPATION] who resides in [LOCATION]. The parent presented as [APPEARANCE AND DEMEANOR] and was [COOPERATIVE/GUARDED] throughout the interview. The parent appeared invested in the evaluation and [DID/DID NOT] present information in a balanced manner.",
        "Regarding the marriage and separation, [PARENT A] reported [PARENT'S ACCOUNT]. The parent expressed concern about [SPECIFIC CONCERNS ABOUT OTHER PARENT'S PARENTING]. When asked to describe [PARENT B]'s strengths as a parent, [PARENT A] stated [RESPONSE]. When asked about personal weaknesses as a parent, the parent stated [RESPONSE].",
        "[PARENT A] described a parenting approach characterized by [STYLE]. The parent reported a typical day with the children as [DESCRIPTION]. The parent reported involvement in the children's schoolwork, medical appointments, and extracurricular activities as follows: [DESCRIPTION].",
        "Mental status examination of [PARENT A] revealed [MSE FINDINGS]. The parent [DENIED/ENDORSED] current psychiatric symptoms. The parent reported [MENTAL HEALTH HISTORY]. The parent [DENIED/ENDORSED] current or past substance use concerns.",
        "[PARENT A] proposed the following parenting plan: [DESCRIPTION OF DESIRED OUTCOME]. The parent's reasoning was [RATIONALE]."
      ]
    },
    {
      heading: "Clinical Interview with [PARENT B]",
      body: [
        "[PARENT B] is a [AGE]-year-old [OCCUPATION] who resides in [LOCATION]. The parent presented as [APPEARANCE AND DEMEANOR] and was [COOPERATIVE/GUARDED] throughout the interview.",
        "Regarding the marriage and separation, [PARENT B] reported [PARENT'S ACCOUNT]. The parent expressed concern about [SPECIFIC CONCERNS ABOUT OTHER PARENT'S PARENTING]. When asked to describe [PARENT A]'s strengths as a parent, [PARENT B] stated [RESPONSE]. When asked about personal weaknesses as a parent, the parent stated [RESPONSE].",
        "[PARENT B] described a parenting approach characterized by [STYLE]. The parent reported a typical day with the children as [DESCRIPTION]. The parent reported involvement in the children's education, healthcare, and activities as follows: [DESCRIPTION].",
        "Mental status examination of [PARENT B] revealed [MSE FINDINGS]. The parent [DENIED/ENDORSED] current psychiatric symptoms. The parent reported [MENTAL HEALTH HISTORY]. The parent [DENIED/ENDORSED] current or past substance use concerns.",
        "[PARENT B] proposed the following parenting plan: [DESCRIPTION OF DESIRED OUTCOME]. The parent's reasoning was [RATIONALE]."
      ]
    },
    {
      heading: "Clinical Interviews with Children",
      body: [
        "[CHILD NAME], age [AGE], was interviewed individually on [DATE]. The child presented as a [DESCRIPTION] child who appeared [COMFORTABLE/ANXIOUS/GUARDED] in the interview setting. Rapport was established [EASILY/WITH DIFFICULTY].",
        "The child described life at [PARENT A]'s home as [DESCRIPTION]. The child described life at [PARENT B]'s home as [DESCRIPTION]. When asked about the parenting schedule, the child stated [CHILD'S WORDS]. The child [DID/DID NOT] express a preference regarding where to live, stating [CHILD'S WORDS IF APPLICABLE]. The examiner notes that the child's expressed preference [IS/IS NOT] consistent with the child's observed emotional state and [APPEARS/DOES NOT APPEAR] to reflect undue influence from either parent.",
        "The child described school as [DESCRIPTION] and identified [FRIENDS/ACTIVITIES]. When asked about the family situation, the child stated [CHILD'S WORDS]. The child [DID/DID NOT] report awareness of parental conflict. The child's emotional presentation when discussing each parent was [OBSERVATION].",
        "The child's developmental level and verbal capacities [ARE/ARE NOT] sufficient to provide meaningful input into custody considerations. The examiner assigns [WEIGHT] to the child's expressed preferences based on [REASONING]."
      ]
    },
    {
      heading: "Parent-Child Observations",
      body: [
        "Observation of [PARENT A] with [CHILD/CHILDREN]: The observation took place on [DATE] at [LOCATION] and lasted approximately [DURATION]. [PARENT A] greeted the child(ren) by [GREETING BEHAVIOR]. During unstructured play, the parent [DESCRIPTION OF INTERACTION]. The parent demonstrated [WARMTH/ATTUNEMENT/DIRECTIVENESS/PERMISSIVENESS] in interactions. The parent set limits by [DESCRIPTION]. The child(ren) appeared [COMFORTABLE/CLINGY/AVOIDANT/RELAXED] with this parent. The parent [DID/DID NOT] initiate physical affection, and the child(ren) [DID/DID NOT] seek proximity.",
        "Observation of [PARENT B] with [CHILD/CHILDREN]: The observation took place on [DATE] at [LOCATION] and lasted approximately [DURATION]. [PARENT B] greeted the child(ren) by [GREETING BEHAVIOR]. During unstructured play, the parent [DESCRIPTION OF INTERACTION]. The parent demonstrated [WARMTH/ATTUNEMENT/DIRECTIVENESS/PERMISSIVENESS]. The parent set limits by [DESCRIPTION]. The child(ren) appeared [COMFORTABLE/CLINGY/AVOIDANT/RELAXED] with this parent.",
        "Comparison of Observations: Both parents demonstrated [SHARED STRENGTHS]. [PARENT A] was notably more [QUALITY] while [PARENT B] was notably more [QUALITY]. The children's behavior [DID/DID NOT] vary meaningfully between the two observations. [ANY NOTABLE DIFFERENCES IN CHILD BEHAVIOR]."
      ]
    },
    {
      heading: "Test Results",
      body: [
        "Minnesota Multiphasic Personality Inventory-3 (MMPI-3): [PARENT A] produced a valid profile (CNS = [SCORE], TRIN-r = [SCORE]T, VRIN-r = [SCORE]T, F-r = [SCORE]T, Fp-r = [SCORE]T, L-r = [SCORE]T, K-r = [SCORE]T). The Substantive Scale profile was characterized by [DESCRIPTION OF ELEVATED SCALES AND INTERPRETATION]. Of particular relevance to the custody context, [SPECIFIC FINDINGS].",
        "Minnesota Multiphasic Personality Inventory-3 (MMPI-3): [PARENT B] produced a valid profile (CNS = [SCORE], TRIN-r = [SCORE]T, VRIN-r = [SCORE]T, F-r = [SCORE]T, Fp-r = [SCORE]T, L-r = [SCORE]T, K-r = [SCORE]T). The Substantive Scale profile was characterized by [DESCRIPTION OF ELEVATED SCALES AND INTERPRETATION]. Of particular relevance to the custody context, [SPECIFIC FINDINGS].",
        "Parenting Stress Index, Fourth Edition (PSI-4): [PARENT A] obtained a Total Stress score of [PERCENTILE] percentile, with elevations on [SPECIFIC SUBSCALES]. [PARENT B] obtained a Total Stress score of [PERCENTILE] percentile, with elevations on [SPECIFIC SUBSCALES]. These results suggest [INTERPRETATION].",
        "Parent-Child Relationship Inventory (PCRI): [PARENT A] produced a profile indicating [DESCRIPTION]. [PARENT B] produced a profile indicating [DESCRIPTION]. Of note, [SPECIFIC COMPARISONS RELEVANT TO REFERRAL QUESTION].",
        "Symptom validity was assessed through embedded indicators on the MMPI-3 and behavioral observation during testing. Both parents produced valid profiles. Neither parent's test results showed evidence of gross over-reporting or under-reporting of symptoms that would invalidate interpretation."
      ]
    },
    {
      heading: "Collateral Information",
      body: [
        "[COLLATERAL NAME], [RELATIONSHIP], was interviewed by telephone on [DATE]. This individual reported [SUMMARY OF RELEVANT INFORMATION]. The collateral described [PARENT]'s parenting as [DESCRIPTION] and reported observing [SPECIFIC OBSERVATIONS].",
        "[COLLATERAL NAME], [RELATIONSHIP/PROFESSIONAL ROLE], was interviewed on [DATE]. This individual reported [SUMMARY]. Of note, this collateral stated [SPECIFIC RELEVANT INFORMATION].",
        "[SCHOOL PROFESSIONAL NAME], [TITLE] at [SCHOOL], reported that [CHILD NAME] is [DESCRIPTION OF SCHOOL FUNCTIONING]. The school professional reported contact with [PARENT A] regarding school matters as [FREQUENCY/QUALITY] and with [PARENT B] as [FREQUENCY/QUALITY]. The school professional [DID/DID NOT] express concerns about either parent's involvement.",
        "[THERAPIST NAME], [CHILD]'s individual therapist, reported [RELEVANT CLINICAL OBSERVATIONS, noting limitations of collateral reporting due to therapeutic confidentiality]. The therapist [DID/DID NOT] express concerns about the child's adjustment to the current arrangement."
      ]
    },
    {
      heading: "Best-Interests Analysis",
      body: [
        "The following analysis applies the statutory best-interests factors to the data gathered in this evaluation. Each factor is addressed individually, followed by a summary integration.",
        "Wishes of the parents: [PARENT A] seeks [PROPOSED PLAN]. [PARENT B] seeks [PROPOSED PLAN]. The parents [AGREE/DISAGREE] on [SPECIFIC AREAS].",
        "Wishes of the child(ren): [CHILD NAME], age [AGE], expressed [PREFERENCE/NO PREFERENCE]. The weight assigned to this preference is [WEIGHT] based on the child's age, maturity, and the examiner's assessment of the degree to which the preference reflects the child's own reasoning versus external influence. [REPEAT FOR EACH CHILD].",
        "Interaction and interrelationship: The children have [STRONG/ADEQUATE/STRAINED] relationships with both parents. The children [DO/DO NOT] demonstrate differential attachment behavior. Sibling relationships are [DESCRIPTION]. Each parent's extended family provides [DESCRIPTION OF SUPPORT].",
        "Adjustment to home, school, and community: The children are currently [WELL/ADEQUATELY/POORLY] adjusted to their school setting. The children have [DESCRIPTION OF PEER RELATIONSHIPS AND COMMUNITY TIES] in each parent's community. A change in primary residence would require [DESCRIPTION OF DISRUPTION].",
        "Mental and physical health of all individuals: [PARENT A]'s mental health [IS/IS NOT] a factor in this analysis. Testing revealed [RELEVANT FINDINGS]. [PARENT B]'s mental health [IS/IS NOT] a factor. The children's mental health [IS/IS NOT] a concern, as evidenced by [RELEVANT FINDINGS].",
        "History of domestic violence: [THERE IS/THERE IS NO] credible evidence of domestic violence in this case. [IF PRESENT: DESCRIPTION, IMPACT ON CHILDREN, AND ANALYSIS OF RISK]. The record reflects [FINDINGS RE: PROTECTIVE ORDERS, POLICE REPORTS, CPS INVOLVEMENT].",
        "Cooperation and facilitation: [PARENT A] has demonstrated [DESCRIPTION] willingness to support the children's relationship with [PARENT B]. [PARENT B] has demonstrated [DESCRIPTION] willingness to support the children's relationship with [PARENT A]. Specific examples include [EXAMPLES]. Gatekeeping behavior [WAS/WAS NOT] observed, specifically [DESCRIPTION]."
      ]
    },
    {
      heading: "Opinion",
      body: [
        "To a reasonable degree of psychological certainty, and based on the totality of data gathered in this evaluation, I offer the following opinions:",
        "Regarding decision-making responsibility: The data support [JOINT/SOLE/CONDITIONAL] decision-making. [PARENT A] and [PARENT B] [ARE/ARE NOT] able to communicate and cooperate on major decisions regarding the children's education, healthcare, and religious upbringing. The basis for this opinion is [SPECIFIC DATA POINTS].",
        "Regarding parenting time: The data support a parenting schedule that [DESCRIPTION OF RECOMMENDED SCHEDULE AND REASONING]. This recommendation is based on the following considerations: the children's ages and developmental needs, the quality of each parent-child relationship as observed, each parent's capacity to meet the children's daily needs, the geographic proximity of the parents' residences, and the children's school and activity schedules.",
        "The examiner notes the following limitations of this evaluation: [E.g., one parent was less forthcoming, records from a specific provider were not available, the children were interviewed during a period of acute stress]."
      ]
    },
    {
      heading: "Recommendations",
      body: [
        "1. [DECISION-MAKING ALLOCATION]: [Joint/Sole] decision-making responsibility is recommended, with [SPECIFIC PROVISIONS for areas of disagreement if applicable].",
        "2. [PARENTING TIME SCHEDULE]: The recommended schedule provides for [DESCRIPTION], with [HOLIDAY/VACATION PROVISIONS]. Transitions should occur at [LOCATION/METHOD].",
        "3. [THERAPEUTIC SERVICES]: Individual therapy is recommended for [CHILD NAME] to address [SPECIFIC CONCERNS], with a therapist selected jointly by both parents. Co-parenting counseling is [RECOMMENDED/NOT RECOMMENDED] to address [ISSUES].",
        "4. [COMMUNICATION]: The parents are encouraged to use [COMMUNICATION METHOD, e.g., a co-parenting application] to minimize direct conflict and create a written record of agreements.",
        "5. [RE-EVALUATION]: A review of the parenting arrangement in [TIMEFRAME] is recommended to assess the children's adjustment and any changes in circumstances."
      ]
    },
    SIGNATURE_BLOCK$1
  ]
};
const RISK_ASSESSMENT_TEMPLATE = {
  id: "report_risk_assessment",
  evalType: "Risk Assessment",
  title: "Violence Risk Assessment",
  subtitle: "Structured Professional Judgment",
  sections: [
    HEADER_BLOCK,
    IDENTIFYING_INFO,
    {
      heading: "Referral Question",
      body: [
        "The referring party requested an evaluation of {{PATIENT_NAME}}'s risk for future violence, the risk factors contributing to that risk, and recommended risk management strategies. The evaluation uses a structured professional judgment (SPJ) approach informed by the HCR-20 Version 3 (Historical-Clinical-Risk Management-20; Douglas, Hart, Webster, & Belfrage, 2013). This report does not produce a single numerical probability of violence. Instead, it identifies risk factors, describes the nature and severity of anticipated violence, identifies likely scenarios, and recommends management strategies."
      ]
    },
    NOTICE_OF_NON_CONFIDENTIALITY,
    {
      heading: "Procedures",
      body: [
        "The following procedures were used in the preparation of this report:",
        ...PROCEDURES_BOILERPLATE,
        "Coding of risk factors on the HCR-20 Version 3",
        "Administration of the Psychopathy Checklist, Revised (PCL-R) or Psychopathy Checklist: Screening Version (PCL:SV)",
        "Administration of the Personality Assessment Inventory (PAI)"
      ]
    },
    {
      heading: "Records Reviewed",
      body: [
        "Criminal history records, including adult and juvenile records",
        "Arrest reports and police narratives for the index offense and prior violent offenses",
        "Pre-sentence investigation report",
        "Institutional disciplinary and classification records",
        "Institutional mental health treatment records",
        "Prior psychiatric and psychological evaluation reports",
        "Prior risk assessment reports, if any",
        "Community supervision records (probation/parole)",
        "Victim impact statements, where available"
      ]
    },
    {
      heading: "Relevant Background",
      body: [
        "{{PATIENT_NAME}} is a [AGE]-year-old [RACE/ETHNICITY] [GENDER] who is currently [INCARCERATED AT/ON SUPERVISION IN/RESIDING IN]. The examinee was referred for risk assessment in connection with [CONTEXT, e.g., parole consideration, civil commitment review, sentencing].",
        "The examinee was raised in [LOCATION] by [CAREGIVERS]. The home environment was characterized by [DESCRIPTION]. The examinee reported [PRESENCE/ABSENCE] of childhood physical abuse, sexual abuse, witnessing domestic violence, and parental substance use. The examinee first came to the attention of the juvenile justice system at age [AGE] for [OFFENSE].",
        "Educational history includes [HIGHEST LEVEL COMPLETED]. The examinee reported [HISTORY OF SCHOOL BEHAVIORAL PROBLEMS/SUSPENSIONS/EXPULSIONS/SPECIAL EDUCATION PLACEMENT]. Employment history has been [STABLE/UNSTABLE], with the longest period of continuous employment being [DURATION] at [TYPE OF WORK].",
        "Relationship history includes [NUMBER] significant intimate partnerships. The examinee described these relationships as [DESCRIPTION]. There [IS/IS NOT] a documented history of intimate partner violence, including [SPECIFIC INCIDENTS IF APPLICABLE].",
        "Substance use history includes [SUBSTANCES] beginning at age [AGE]. The examinee described [PATTERN AND SEVERITY]. The examinee has completed [NUMBER] substance treatment programs. The examinee reported last using [SUBSTANCE] on [DATE]. The relationship between substance use and violent behavior in this examinee's history is [DESCRIPTION].",
        "Psychiatric history includes [DIAGNOSES, TREATMENT HISTORY, HOSPITALIZATIONS]. The examinee is currently prescribed [MEDICATIONS] and reports [COMPLIANCE/NONCOMPLIANCE]. The relationship between psychiatric symptoms and violent behavior in this examinee's history is [DESCRIPTION]."
      ]
    },
    {
      heading: "Mental Status Examination",
      body: [
        "{{PATIENT_NAME}} presented as a [BUILD] [GENDER] who appeared the stated age of [AGE]. Grooming and hygiene were [DESCRIPTION]. The examinee was [COOPERATIVE/GUARDED/HOSTILE] with the evaluation process. Eye contact was [DESCRIPTION]. Psychomotor activity was [NORMAL/AGITATED/RETARDED].",
        `Speech was [RATE, RHYTHM, VOLUME]. Mood was described as "[PATIENT'S WORDS]." Affect was [DESCRIPTION]. Thought process was [LINEAR/CIRCUMSTANTIAL/TANGENTIAL]. Thought content was notable for [DESCRIPTION]. The examinee [DENIED/ENDORSED] current suicidal and homicidal ideation. There was [NO EVIDENCE/EVIDENCE] of hallucinations or delusions.`,
        "Cognition was grossly [INTACT/IMPAIRED]. The examinee was oriented to person, place, date, and situation. Attention and concentration were [ADEQUATE/IMPAIRED]. Insight into the factors contributing to past violent behavior was [GOOD/LIMITED/POOR]. Judgment appeared [ADEQUATE/IMPAIRED]."
      ]
    },
    {
      heading: "Test Results",
      body: [
        "Personality Assessment Inventory (PAI): The examinee produced a [VALID/INVALID] profile. Validity scale findings: Inconsistency (ICN) = [SCORE]T, Infrequency (INF) = [SCORE]T, Negative Impression (NIM) = [SCORE]T, Positive Impression (PIM) = [SCORE]T. The clinical profile was characterized by elevations on [SCALES AND SCORES]. Of particular relevance to the risk assessment, [SPECIFIC FINDINGS, e.g., AGG-A (Aggressive Attitude) = SCORE, AGG-P (Aggressive Behavior) = SCORE, ANT (Antisocial Features) = SCORE, VPI (Violence Potential Index) = SCORE].",
        "Psychopathy Checklist, Revised (PCL-R): The examinee obtained a Total score of [SCORE] (Factor 1 = [SCORE]; Factor 2 = [SCORE]). This score falls [BELOW/WITHIN/ABOVE] the range typically associated with a designation of psychopathy in [FORENSIC/CORRECTIONAL] settings (cutoff of 30). The interpersonal and affective features (Factor 1) were [PROMINENT/NOT PROMINENT], as evidenced by [BEHAVIORAL EXAMPLES]. The antisocial lifestyle features (Factor 2) were [PROMINENT/NOT PROMINENT], as evidenced by [BEHAVIORAL EXAMPLES].",
        "Performance validity and symptom validity testing: [INSTRUMENT(S)] were administered. Results indicated [ADEQUATE/INADEQUATE] effort and [NO EVIDENCE/EVIDENCE] of symptom exaggeration. The examinee's self-report is considered [RELIABLE/UNRELIABLE] for purposes of this evaluation."
      ]
    },
    {
      heading: "Historical Risk Factors",
      body: [
        "H1, Violence: The examinee has a documented history of [NUMBER] violent acts, beginning at age [AGE]. The most serious prior violent act involved [DESCRIPTION]. The pattern of prior violence is characterized by [INSTRUMENTAL/REACTIVE/MIXED] aggression, directed toward [VICTIM TYPES]. Severity has [ESCALATED/REMAINED STABLE/DE-ESCALATED] over time. This item is coded as [PRESENT/POSSIBLY PRESENT/ABSENT].",
        "H2, Other Antisocial Behavior: The examinee has a history of [DESCRIPTION OF NON-VIOLENT CRIMINAL AND ANTISOCIAL BEHAVIOR]. This item is coded as [PRESENT/POSSIBLY PRESENT/ABSENT].",
        "H3, Relationships: The examinee has [NEVER/RARELY/INTERMITTENTLY] maintained stable intimate relationships. The quality of family and peer relationships has been characterized by [DESCRIPTION]. This item is coded as [PRESENT/POSSIBLY PRESENT/ABSENT].",
        "H4, Employment: Employment history has been characterized by [CHRONIC UNEMPLOYMENT/INSTABILITY/TERMINATED POSITIONS]. The longest period of sustained employment was [DURATION]. This item is coded as [PRESENT/POSSIBLY PRESENT/ABSENT].",
        "H5, Substance Use: Substance use has been a [MAJOR/MINOR/ABSENT] factor in the examinee's history. The relationship between substance use and violence is [DIRECT/INDIRECT/ABSENT]. This item is coded as [PRESENT/POSSIBLY PRESENT/ABSENT].",
        "H6, Major Mental Disorder: The examinee [HAS/HAS NOT] been diagnosed with a major mental disorder ([DIAGNOSIS]). The temporal relationship between active symptoms and violent behavior is [DESCRIPTION]. This item is coded as [PRESENT/POSSIBLY PRESENT/ABSENT].",
        "H7, Personality Disorder: The examinee [DOES/DOES NOT] present with features consistent with [PERSONALITY DISORDER]. PCL-R findings [SUPPORT/DO NOT SUPPORT] a pattern of psychopathic traits. This item is coded as [PRESENT/POSSIBLY PRESENT/ABSENT].",
        "H8, Traumatic Experiences: The examinee reports [HISTORY OF TRAUMA]. The connection between trauma history and violent behavior patterns is [DESCRIPTION]. This item is coded as [PRESENT/POSSIBLY PRESENT/ABSENT].",
        "H9, Violent Attitudes: The examinee expressed attitudes toward violence that were [DESCRIPTION]. The examinee [DID/DID NOT] endorse beliefs that violence is an acceptable means of conflict resolution. This item is coded as [PRESENT/POSSIBLY PRESENT/ABSENT].",
        "H10, Treatment or Supervision Response: The examinee's history of response to prior treatment and supervision has been [DESCRIPTION]. Prior supervision violations include [DESCRIPTION]. This item is coded as [PRESENT/POSSIBLY PRESENT/ABSENT]."
      ]
    },
    {
      heading: "Clinical Risk Factors",
      body: [
        "C1, Insight: The examinee demonstrated [GOOD/PARTIAL/POOR] insight into mental disorder, risk factors for violence, and the need for treatment. Specifically, the examinee [DESCRIPTION OF INSIGHT OR LACK THEREOF]. This item is coded as [PRESENT/POSSIBLY PRESENT/ABSENT].",
        "C2, Violent Ideation or Intent: The examinee [DENIED/ENDORSED] current thoughts, fantasies, or plans involving violence. [IF ENDORSED: DESCRIPTION OF CONTENT, TARGET, PLAN SPECIFICITY]. This item is coded as [PRESENT/POSSIBLY PRESENT/ABSENT].",
        "C3, Symptoms of Major Mental Disorder: The examinee currently [DOES/DOES NOT] exhibit active symptoms of [DISORDER]. Current symptoms include [DESCRIPTION]. The relationship between current symptoms and violence risk is [DESCRIPTION]. This item is coded as [PRESENT/POSSIBLY PRESENT/ABSENT].",
        "C4, Instability: The examinee's current functioning is characterized by [STABILITY/INSTABILITY] in the areas of [AFFECT, BEHAVIOR, COGNITION]. Recent destabilizing events include [DESCRIPTION]. This item is coded as [PRESENT/POSSIBLY PRESENT/ABSENT].",
        "C5, Treatment or Supervision Response: The examinee's current response to treatment and supervision is [DESCRIPTION]. Compliance with medication, programming, and supervisory conditions is [DESCRIPTION]. This item is coded as [PRESENT/POSSIBLY PRESENT/ABSENT]."
      ]
    },
    {
      heading: "Risk Management Factors",
      body: [
        "R1, Professional Services and Plans: The availability and quality of professional services in the anticipated setting is [DESCRIPTION]. The examinee [HAS/HAS NOT] been connected with [MENTAL HEALTH TREATMENT, SUBSTANCE TREATMENT, CASE MANAGEMENT]. This item is coded as [PRESENT/POSSIBLY PRESENT/ABSENT].",
        "R2, Living Situation: The anticipated living arrangement is [DESCRIPTION]. Stability, exposure to destabilizers (substances, antisocial peers, weapons access), and access to potential victims are [ASSESSED]. This item is coded as [PRESENT/POSSIBLY PRESENT/ABSENT].",
        "R3, Personal Support: The examinee's prosocial support network includes [DESCRIPTION]. The quality and willingness of these supports to assist with risk management is [DESCRIPTION]. This item is coded as [PRESENT/POSSIBLY PRESENT/ABSENT].",
        "R4, Treatment or Supervision Response: The examinee's anticipated response to future treatment and supervision, based on historical patterns and current engagement, is [DESCRIPTION]. This item is coded as [PRESENT/POSSIBLY PRESENT/ABSENT].",
        "R5, Stress or Coping: Anticipated stressors in the release environment include [DESCRIPTION]. The examinee's demonstrated coping resources include [DESCRIPTION]. The gap between anticipated stressors and coping capacity is [DESCRIPTION]. This item is coded as [PRESENT/POSSIBLY PRESENT/ABSENT]."
      ]
    },
    {
      heading: "Formulation",
      body: [
        "The primary drivers of risk in {{PATIENT_NAME}}'s case are [IDENTIFICATION OF KEY RISK FACTORS AND THEIR INTERRELATIONSHIP]. The examinee's history of violence has been characterized by [PATTERN], and the conditions under which violence has occurred in the past have consistently involved [PRECIPITANTS].",
        "The clinical picture is [COMPLICATED/CLARIFIED] by [SPECIFIC FACTORS, e.g., co-occurring substance use and psychotic symptoms, psychopathic personality features, treatment noncompliance]. The examinee's current mental state [DOES/DOES NOT] mirror the conditions present during prior violent episodes.",
        "Protective factors include [DESCRIPTION, e.g., age-related desistance, stable relationship, employment, medication compliance, demonstrated prosocial coping skills]. These protective factors [ARE/ARE NOT] sufficient to offset the identified risk factors given the anticipated setting."
      ]
    },
    {
      heading: "Scenario Planning",
      body: [
        "Most likely scenario: Based on the pattern of prior violence and current risk factors, the most likely violent scenario involves [WHO: victim type, WHAT: nature of violence, WHERE: setting, WHEN: precipitating conditions, HOW: method]. The estimated time horizon for this scenario is [SHORT-TERM/MEDIUM-TERM/LONG-TERM]. The conditions that would make this scenario more likely include [DESTABILIZERS]. The conditions that would make it less likely include [PROTECTIVE FACTORS AND MANAGEMENT STRATEGIES].",
        "Worst-case scenario: The most severe plausible scenario involves [DESCRIPTION]. This scenario would be more likely if [CONDITIONS]. Although less probable than the above scenario, it warrants planning because [REASONING]."
      ]
    },
    {
      heading: "Summary Risk Judgment",
      body: [
        "Based on the structured professional judgment analysis described above, the examiner rates {{PATIENT_NAME}}'s risk for future violence as [LOW/MODERATE/HIGH] for the [TIME HORIZON] in the context of [SPECIFIED SETTING].",
        "This judgment is based on the following key considerations: [NUMBERED LIST OF PRIMARY FACTORS DRIVING THE RATING]. The judgment assumes [SPECIFIC CONDITIONS, e.g., that the examinee will receive recommended treatment, that supervision conditions will be enforced]. If these conditions change, the risk level may change accordingly.",
        "This risk rating reflects the examiner's clinical judgment informed by the HCR-20V3 framework. It is not a prediction that violence will or will not occur. It is an assessment of the presence and relevance of empirically supported risk factors, applied to the specific circumstances of this case."
      ]
    },
    {
      heading: "Risk Management Recommendations",
      body: [
        "1. Monitoring: [SPECIFIC MONITORING RECOMMENDATIONS, e.g., frequency of supervision contacts, substance testing schedule, GPS monitoring, curfew conditions, weapon restrictions].",
        "2. Treatment: [SPECIFIC TREATMENT RECOMMENDATIONS, e.g., psychiatric medication management with named medications if applicable, individual psychotherapy targeting specific criminogenic needs, substance abuse treatment modality, anger management programming].",
        "3. Supervision: [SPECIFIC SUPERVISION CONDITIONS, e.g., residential restrictions, association restrictions, employment requirements, reporting conditions].",
        "4. Victim Safety: [IF APPLICABLE: specific recommendations for victim notification, no-contact orders, geographic restrictions].",
        "5. Re-evaluation: This risk assessment should be updated in [TIMEFRAME] or sooner if there is a significant change in the examinee's circumstances, mental state, or behavior."
      ]
    },
    SIGNATURE_BLOCK$1
  ]
};
const FFD_TEMPLATE = {
  id: "report_fitness_for_duty",
  evalType: "Fitness for Duty",
  title: "Fitness for Duty Evaluation",
  subtitle: "Psychological Fitness for Continued Employment",
  sections: [
    HEADER_BLOCK,
    IDENTIFYING_INFO,
    {
      heading: "Referral Question",
      body: [
        "The referring employer, [AGENCY/DEPARTMENT NAME], requested a fitness for duty evaluation (FFDE) of {{PATIENT_NAME}} to determine whether the employee is psychologically fit to perform the essential functions of the position of [JOB TITLE] safely and effectively. The evaluation was triggered by [BRIEF DESCRIPTION OF TRIGGERING EVENT]. This evaluation is conducted consistent with the International Association of Chiefs of Police (IACP) Psychological Services Section guidelines for fitness for duty evaluations (2018) and applicable ADA requirements. The scope of this evaluation is limited to the question of fitness; it is not a general psychological evaluation."
      ]
    },
    {
      heading: "Notice of Limits on Confidentiality",
      body: [
        "The employee was informed, both verbally and in writing, that this evaluation is being conducted at the request of the employer, not for treatment purposes. The employee was advised that information obtained during the evaluation would be included in a written report provided to the employer and that the scope of disclosure is limited to information directly relevant to the fitness determination. The employee was informed that the usual rules of doctor-patient confidentiality do not apply in this context. The employee was also advised of the right to decline participation, with the understanding that a refusal would be reported to the employer and might result in administrative action. The employee signed a written acknowledgment of these limits and voluntarily agreed to participate."
      ]
    },
    {
      heading: "Procedures",
      body: [
        "The following procedures were used in the preparation of this report:",
        "Review of position description and essential job functions for [JOB TITLE]",
        "Review of the triggering incident documentation provided by the employer",
        "Review of personnel records, performance evaluations, and disciplinary history provided by the employer",
        "Review of medical and mental health records authorized by the employee",
        "Clinical interview with the employee, approximately [HOURS] hours",
        "Standardized psychological testing (see Test Results)",
        "Symptom validity and performance validity testing",
        "Collateral interview with [SUPERVISOR/COMMANDING OFFICER NAME AND TITLE], on [DATE]"
      ]
    },
    {
      heading: "Records Reviewed",
      body: [
        "Position description and essential functions for [JOB TITLE], dated [DATE]",
        "Internal affairs investigation report(s), case number(s) [NUMBER], dated [DATE]",
        "Incident reports dated [DATES]",
        "Performance evaluations for the past [NUMBER] years",
        "Disciplinary actions and letters of reprimand, if any",
        "Training records, including use-of-force training and de-escalation training completion",
        "Medical records from [PROVIDER] authorized by the employee",
        "Mental health records from [PROVIDER] authorized by the employee",
        "Prior fitness for duty evaluation(s), dated [DATE], if any",
        "Employee Assistance Program (EAP) utilization records, if authorized by the employee"
      ]
    },
    {
      heading: "Essential Job Functions",
      body: [
        "The position of [JOB TITLE] with [AGENCY] requires the following psychological capacities, as derived from the position description and the IACP guidelines: (1) the ability to exercise sound judgment and make decisions under conditions of acute stress and ambiguity; (2) the ability to interact effectively and professionally with the public, colleagues, and supervisors; (3) the ability to control emotional reactions and maintain composure during confrontational or high-risk encounters; (4) the ability to carry and, if necessary, deploy a firearm or other use-of-force instruments with appropriate judgment [IF APPLICABLE]; (5) the ability to work rotating shifts and tolerate irregular schedules without significant impairment; (6) the ability to maintain the alertness and concentration necessary for safe performance of duties; and (7) the ability to accept and respond appropriately to supervisory direction and organizational authority."
      ]
    },
    {
      heading: "Relevant Background",
      body: [
        "{{PATIENT_NAME}} is a [AGE]-year-old [GENDER] who has been employed with [AGENCY] for [DURATION] in the capacity of [JOB TITLE]. The employee reported [PRIOR LAW ENFORCEMENT/PUBLIC SAFETY EXPERIENCE]. The employee described work performance prior to the triggering incident(s) as [DESCRIPTION]. The employee reported [NUMBER] prior internal affairs investigations, resulting in [OUTCOMES].",
        "The employee reported a psychiatric history of [DESCRIPTION, OR DENIED PRIOR TREATMENT]. The employee is currently [TAKING/NOT TAKING] psychotropic medications, specifically [MEDICATIONS AND DOSAGES]. The employee [DENIED/ENDORSED] current substance use, including alcohol use of [FREQUENCY AND QUANTITY]. The employee reported last consuming alcohol on [DATE].",
        "Personal stressors identified by the employee include [DESCRIPTION, e.g., marital difficulties, financial pressures, family illness, recent loss, child-related stress]. The employee reported sleep of approximately [HOURS] per night and described sleep quality as [DESCRIPTION]. The employee [DENIED/ENDORSED] symptoms of depression, anxiety, posttraumatic stress, and anger/irritability.",
        "The employee reported [NUMBER] critical incidents during the course of employment, including [BRIEF DESCRIPTIONS]. The employee [HAS/HAS NOT] participated in critical incident debriefing. The employee described coping with occupational stress through [METHODS]."
      ]
    },
    {
      heading: "Triggering Concerns",
      body: [
        "According to documents provided by the employer, the referral for FFDE was prompted by [DETAILED DESCRIPTION OF TRIGGERING EVENT(S), DATES, AND CIRCUMSTANCES]. The employer specifically identified the following concerns: [ENUMERATED CONCERNS FROM THE REFERRAL LETTER].",
        "The employee's account of the triggering incident(s) is as follows: [EMPLOYEE'S VERSION]. The employee attributed the incident(s) to [EMPLOYEE'S EXPLANATION]. Points of agreement between the employer's account and the employee's account include [AREAS OF AGREEMENT]. Points of disagreement include [AREAS OF DISAGREEMENT].",
        "The employee's supervisor, [NAME AND TITLE], reported the following additional concerns during a collateral interview on [DATE]: [SUPERVISOR'S OBSERVATIONS]. The supervisor described the employee's performance trajectory as [DESCRIPTION] and noted [SPECIFIC BEHAVIORAL CHANGES OBSERVED]."
      ]
    },
    {
      heading: "Mental Status Examination",
      body: [
        "{{PATIENT_NAME}} presented as a [BUILD] [GENDER] who appeared [CONSISTENT WITH/OLDER THAN/YOUNGER THAN] the stated age of [AGE]. The employee was dressed in [ATTIRE] and was [WELL/ADEQUATELY/POORLY] groomed. The employee arrived [ON TIME/LATE] and was [COOPERATIVE/GUARDED/DEFENSIVE/HOSTILE] throughout the evaluation. The employee's attitude toward the evaluation was characterized by [DESCRIPTION].",
        `Speech was [RATE, VOLUME, RHYTHM]. The employee was [SPONTANEOUS/REQUIRED PROMPTING]. Mood was described as "[EMPLOYEE'S WORDS]." Affect was [RANGE, CONGRUENCE, APPROPRIATENESS]. The employee became [TEARFUL/ANGRY/FLAT] when discussing [TOPIC].`,
        "Thought process was [LINEAR AND GOAL-DIRECTED/CIRCUMSTANTIAL/TANGENTIAL]. Thought content was notable for [DESCRIPTION]. The employee [DENIED/ENDORSED] suicidal ideation, homicidal ideation, and intent to harm self or others. There was [NO EVIDENCE/EVIDENCE] of psychotic symptoms.",
        "Cognition was grossly intact. The employee was oriented in all spheres. Attention and concentration appeared [ADEQUATE/IMPAIRED] during the interview. Insight into the concerns that prompted the evaluation was [GOOD/PARTIAL/POOR]. Judgment, as assessed by the employee's response to the evaluation process and understanding of the situation, was [GOOD/FAIR/POOR]."
      ]
    },
    {
      heading: "Test Results",
      body: [
        "Minnesota Multiphasic Personality Inventory-3 (MMPI-3): The employee produced a [VALID/INVALID] profile. Validity indicators: CNS = [SCORE], TRIN-r = [SCORE]T, VRIN-r = [SCORE]T, F-r = [SCORE]T, Fp-r = [SCORE]T, Fs = [SCORE]T, FBS-r = [SCORE]T, L-r = [SCORE]T, K-r = [SCORE]T. [IF INVALID: The profile is considered invalid due to REASON and interpretation of the clinical scales is precluded.] [IF VALID: The clinical profile was characterized by DESCRIPTION OF ELEVATIONS AND INTERPRETATION]. Scales of particular relevance to the fitness question include [SPECIFIC SCALES AND INTERPRETATION].",
        "Personality Assessment Inventory (PAI): The employee produced a [VALID/INVALID] profile. Validity indicators: ICN = [SCORE]T, INF = [SCORE]T, NIM = [SCORE]T, PIM = [SCORE]T. The clinical profile was characterized by [DESCRIPTION]. Of note, the following scales were elevated: [SCALES AND INTERPRETATIONS RELEVANT TO FITNESS].",
        "Trauma Symptom Inventory-2 (TSI-2) [IF TRAUMA CONCERN]: The employee's profile was [VALID/INVALID]. Elevated scales included [SCALES], consistent with [INTERPRETATION].",
        "Performance validity testing ([INSTRUMENT]): The employee scored [SCORE], which [DOES/DOES NOT] exceed the cutoff for adequate effort. Symptom validity testing ([INSTRUMENT]): The employee scored [SCORE], indicating [CREDIBLE/NONCREDIBLE] symptom presentation."
      ]
    },
    {
      heading: "Job-Related Functional Analysis",
      body: [
        "The following analysis maps the clinical findings to the essential job functions identified above.",
        "Judgment under stress: The employee's current capacity for sound judgment under stress is [ADEQUATE/COMPROMISED]. This assessment is based on [TEST FINDINGS, BEHAVIORAL OBSERVATIONS, AND INCIDENT HISTORY]. [SPECIFIC EXAMPLES OF HOW CURRENT SYMPTOMS OR PERSONALITY FEATURES MAY AFFECT JUDGMENT].",
        "Interpersonal functioning: The employee's ability to interact effectively with the public, colleagues, and supervisors is [ADEQUATE/COMPROMISED]. Testing revealed [RELEVANT FINDINGS]. The triggering incident(s) [DO/DO NOT] reflect a pattern of interpersonal dysfunction. [SPECIFIC EXAMPLES].",
        "Emotional regulation: The employee's ability to control emotional reactions and maintain composure is [ADEQUATE/COMPROMISED]. Testing and interview findings suggest [DESCRIPTION]. The employee's history of [CRITICAL INCIDENTS/PERSONAL STRESSORS] [HAS/HAS NOT] affected emotional regulation capacity.",
        "Firearms judgment [IF APPLICABLE]: The employee's psychological capacity for safe firearms handling and appropriate use-of-force decision-making is [ADEQUATE/COMPROMISED]. This assessment is based on [SPECIFIC FINDINGS].",
        "Alertness and concentration: The employee's current capacity to maintain the alertness and concentration required for safe performance is [ADEQUATE/COMPROMISED]. The employee reports [SLEEP PATTERN, SUBSTANCE USE, MEDICATION EFFECTS].",
        "Response to authority: The employee's capacity to accept and respond appropriately to supervisory direction is [ADEQUATE/COMPROMISED]. This assessment is based on [INTERVIEW FINDINGS, PERSONNEL RECORD, TEST DATA]."
      ]
    },
    {
      heading: "Clinical Formulation",
      body: [
        "Based on the totality of data gathered in this evaluation, {{PATIENT_NAME}} presents with [CLINICAL SUMMARY]. The current clinical picture [IS/IS NOT] consistent with a diagnosable mental health condition. Specifically, the employee meets criteria for [DIAGNOSIS per DSM-5-TR, OR: does not meet criteria for a diagnosable condition at this time].",
        "The relationship between the clinical findings and the employee's job-relevant functioning is as follows: [DESCRIPTION OF HOW SYMPTOMS/TRAITS MAP TO FUNCTIONAL DEFICITS, IF ANY]. The triggering incident(s) [ARE/ARE NOT] attributable to the identified clinical condition. [ALTERNATIVE EXPLANATIONS IF APPLICABLE, e.g., personality style, situational factors, volitional misconduct].",
        "Symptom validity and performance validity findings [SUPPORT/DO NOT SUPPORT] the credibility of the employee's self-reported symptoms. The examiner's overall confidence in the clinical data is [HIGH/MODERATE/LOW], based on [REASONING]."
      ]
    },
    {
      heading: "Opinion",
      body: [
        "To a reasonable degree of psychological certainty, it is this examiner's opinion that {{PATIENT_NAME}} is:",
        "[SELECT ONE]:",
        "Fit for Duty: The employee does not present with a psychological condition that impairs the ability to perform the essential functions of the position of [JOB TITLE] safely and effectively at this time.",
        "Fit for Duty with Conditions: The employee is fit to return to duty provided the following conditions are met: [SPECIFIC CONDITIONS, e.g., continued treatment, medication compliance, supervisory monitoring, temporary duty restrictions, follow-up evaluation].",
        "Temporarily Unfit for Duty: The employee is not currently fit to perform the essential functions of the position due to [CONDITION]. The condition is expected to be treatable, and restoration to fitness is reasonably anticipated within [TIMEFRAME], provided the employee engages in [RECOMMENDED TREATMENT].",
        "Unfit for Duty: The employee is not fit to perform the essential functions of the position due to [CONDITION], and the prognosis for restoration to fitness within a reasonable period is [POOR/GUARDED]."
      ]
    },
    {
      heading: "Recommendations",
      body: [
        "1. Treatment: [SPECIFIC TREATMENT RECOMMENDATIONS, e.g., individual psychotherapy with a clinician experienced in law enforcement/first responder issues, psychiatric medication evaluation, substance treatment]. Treatment should target [SPECIFIC GOALS].",
        "2. Return-to-duty conditions [IF APPLICABLE]: [SPECIFIC CONDITIONS, e.g., modified duty assignment, partner assignment, removal from specific duties, administrative assignment pending treatment completion].",
        "3. Follow-up evaluation: A follow-up fitness evaluation is recommended in [TIMEFRAME] to assess treatment progress and readiness for [FULL DUTY/CONTINUED MODIFIED DUTY].",
        "4. Scope of disclosure: Consistent with ADA requirements and IACP guidelines, the employer is advised to limit disclosure of this report to individuals with a need to know. The employee's specific diagnoses and treatment details should not be disclosed beyond what is necessary for the fitness determination and accommodation process."
      ]
    },
    SIGNATURE_BLOCK$1
  ]
};
const PTSD_TEMPLATE = {
  id: "report_ptsd_dx",
  evalType: "PTSD Dx",
  title: "PTSD Diagnostic Evaluation",
  subtitle: "DSM-5-TR Posttraumatic Stress Disorder Assessment",
  sections: [
    HEADER_BLOCK,
    IDENTIFYING_INFO,
    {
      heading: "Referral Question",
      body: [
        "The referring party, {{REFERRING_PARTY}}, requested a diagnostic evaluation of {{PATIENT_NAME}} to determine whether the evaluee currently meets DSM-5-TR criteria for Posttraumatic Stress Disorder (309.81, F43.10), to identify any related or alternative diagnoses, to assess the relationship between the claimed traumatic event and the current clinical presentation, and to offer treatment recommendations. This evaluation was requested in the context of [LITIGATION/WORKERS COMPENSATION CLAIM/DISABILITY DETERMINATION/CLINICAL REFERRAL]."
      ]
    },
    NOTICE_OF_NON_CONFIDENTIALITY,
    {
      heading: "Procedures",
      body: [
        "The following procedures were used in the preparation of this report:",
        ...PROCEDURES_BOILERPLATE,
        "Administration of the Clinician-Administered PTSD Scale for DSM-5 (CAPS-5)",
        "Administration of the PTSD Checklist for DSM-5 (PCL-5)",
        "Administration of the Detailed Assessment of Posttraumatic Stress (DAPS)",
        "Administration of the Beck Depression Inventory-II (BDI-II)",
        "Administration of the Miller Forensic Assessment of Symptoms Test (M-FAST)",
        "Administration of the Test of Memory Malingering (TOMM)"
      ]
    },
    {
      heading: "Records Reviewed",
      body: [
        "Pre-incident mental health records from [PROVIDER], dated [RANGE]",
        "Post-incident mental health treatment records from [PROVIDER], dated [RANGE]",
        "Medical records from [PROVIDER] related to the claimed traumatic event",
        "Incident report/police report/military records dated [DATE]",
        "Employment records, including pre-incident performance evaluations",
        "Disability application or workers compensation claim documents",
        "Prior psychological or psychiatric evaluation reports",
        "Deposition transcripts, if applicable"
      ]
    },
    {
      heading: "Relevant Background",
      body: [
        "{{PATIENT_NAME}} is a [AGE]-year-old [RACE/ETHNICITY] [GENDER] who is [CURRENTLY EMPLOYED AS/FORMERLY EMPLOYED AS/CURRENTLY UNEMPLOYED SINCE]. The evaluee was referred in connection with [CONTEXT OF REFERRAL].",
        "The evaluee reported a [UNREMARKABLE/NOTABLE] developmental history. The evaluee was raised in [LOCATION] by [CAREGIVERS] and described the childhood home as [DESCRIPTION]. The evaluee [DENIED/ENDORSED] childhood physical abuse, sexual abuse, and other adverse childhood experiences. The evaluee completed [EDUCATION LEVEL] and has worked primarily as [OCCUPATIONAL HISTORY].",
        "Prior trauma history: The evaluee reported the following traumatic events prior to the index event: [LIST WITH APPROXIMATE DATES AND BRIEF DESCRIPTIONS]. The evaluee [DID/DID NOT] seek treatment following these events. The evaluee [DENIED/ENDORSED] prior symptoms of PTSD, anxiety, or depression following earlier traumatic exposure.",
        "Psychiatric history prior to the index event: The evaluee [DENIED/ENDORSED] prior mental health treatment. [IF ENDORSED: The evaluee was treated by PROVIDER for CONDITION from DATE to DATE. Treatment included INTERVENTIONS. The evaluee described the outcome as DESCRIPTION.] The evaluee [DENIED/ENDORSED] prior psychiatric hospitalizations, suicide attempts, and self-harm behavior.",
        "Substance use history: The evaluee reported [PRE-INCIDENT SUBSTANCE USE PATTERN]. Since the index event, the evaluee reported [CHANGE IN SUBSTANCE USE, IF ANY]. The evaluee [DENIED/ENDORSED] prior substance treatment.",
        "Current functioning: The evaluee described a typical day as [DESCRIPTION]. The evaluee reported [CURRENT OCCUPATIONAL STATUS, SOCIAL FUNCTIONING, SLEEP PATTERN, APPETITE, ENERGY LEVEL]. The evaluee described the impact of symptoms on daily functioning as [DESCRIPTION]."
      ]
    },
    {
      heading: "Traumatic Event History",
      body: [
        "Index event: The evaluee described the following event as the primary traumatic experience at issue in this evaluation. On [DATE], the evaluee [DETAILED DESCRIPTION OF THE EVENT IN THE EVALUEE'S OWN WORDS, WITH SPECIFIC SENSORY DETAILS AND EMOTIONAL REACTIONS]. The evaluee reported that during the event, the evaluee experienced [FEAR/HELPLESSNESS/HORROR/DISSOCIATION/OTHER PERITRAUMATIC REACTIONS]. The evaluee believed that [NATURE OF PERCEIVED THREAT: death, serious injury, sexual violence].",
        "Criterion A analysis: The described event [DOES/DOES NOT] meet DSM-5-TR Criterion A for PTSD. Specifically, the evaluee [WAS DIRECTLY EXPOSED TO/WITNESSED/LEARNED ABOUT/WAS REPEATEDLY EXPOSED TO AVERSIVE DETAILS OF] [ACTUAL OR THREATENED DEATH/SERIOUS INJURY/SEXUAL VIOLENCE]. The basis for this determination is [DESCRIPTION OF HOW THE EVENT MAPS TO CRITERION A, WITH REFERENCE TO CORROBORATING RECORDS WHERE AVAILABLE].",
        "The evaluee reported that symptoms began [IMMEDIATELY AFTER/WITHIN DAYS OF/WITHIN WEEKS OF/MONTHS AFTER] the index event. The first symptoms noticed were [DESCRIPTION]. The evaluee first sought treatment on [DATE], approximately [TIMEFRAME] after the event."
      ]
    },
    {
      heading: "Symptom Review",
      body: [
        "The following symptom review is organized by DSM-5-TR criteria for PTSD (309.81, F43.10). Each criterion cluster is assessed based on clinical interview, the CAPS-5, and corroborating self-report and record data.",
        "Criterion B, Intrusion symptoms (one or more required): The evaluee [ENDORSED/DENIED] recurrent, involuntary, and intrusive distressing memories of the event, occurring [FREQUENCY]. The evaluee [ENDORSED/DENIED] recurrent distressing dreams related to the event, occurring [FREQUENCY]. The evaluee [ENDORSED/DENIED] dissociative reactions (flashbacks) in which the evaluee feels or acts as if the event were recurring, occurring [FREQUENCY AND DESCRIPTION]. The evaluee [ENDORSED/DENIED] intense or prolonged psychological distress at exposure to cues resembling the event, triggered by [SPECIFIC CUES]. The evaluee [ENDORSED/DENIED] marked physiological reactions to such cues, including [SPECIFIC REACTIONS]. CAPS-5 Cluster B severity: [SCORE].",
        "Criterion C, Avoidance (one or more required): The evaluee [ENDORSED/DENIED] avoidance of distressing memories, thoughts, or feelings associated with the event. The evaluee [ENDORSED/DENIED] avoidance of external reminders (people, places, conversations, activities, objects, situations) that arouse such distress. Specific avoidance behaviors include [DESCRIPTION]. CAPS-5 Cluster C severity: [SCORE].",
        "Criterion D, Negative alterations in cognitions and mood (two or more required): The evaluee [ENDORSED/DENIED] inability to remember an important aspect of the event. The evaluee [ENDORSED/DENIED] persistent and exaggerated negative beliefs about oneself, others, or the world, specifically [DESCRIPTION]. The evaluee [ENDORSED/DENIED] persistent distorted cognitions about the cause or consequences of the event that lead to blame of self or others. The evaluee [ENDORSED/DENIED] persistent negative emotional state ([FEAR/HORROR/ANGER/GUILT/SHAME]). The evaluee [ENDORSED/DENIED] markedly diminished interest in significant activities, specifically [ACTIVITIES]. The evaluee [ENDORSED/DENIED] feelings of detachment or estrangement from others. The evaluee [ENDORSED/DENIED] persistent inability to experience positive emotions. CAPS-5 Cluster D severity: [SCORE].",
        "Criterion E, Alterations in arousal and reactivity (two or more required): The evaluee [ENDORSED/DENIED] irritable behavior and angry outbursts, described as [DESCRIPTION]. The evaluee [ENDORSED/DENIED] reckless or self-destructive behavior, including [DESCRIPTION]. The evaluee [ENDORSED/DENIED] hypervigilance, manifested as [DESCRIPTION]. The evaluee [ENDORSED/DENIED] exaggerated startle response, triggered by [STIMULI]. The evaluee [ENDORSED/DENIED] problems with concentration. The evaluee [ENDORSED/DENIED] sleep disturbance, including [DESCRIPTION OF SLEEP ONSET DIFFICULTY, MAINTENANCE DIFFICULTY, NIGHTMARES]. CAPS-5 Cluster E severity: [SCORE].",
        "Criterion F, Duration: Symptoms have been present for [DURATION], which [DOES/DOES NOT] exceed the one-month minimum required by DSM-5-TR.",
        "Criterion G, Functional impairment: Symptoms cause clinically significant distress and impairment in [SOCIAL, OCCUPATIONAL, AND/OR OTHER] functioning. Specific functional impairment includes [DESCRIPTION OF IMPAIRMENT IN WORK, RELATIONSHIPS, DAILY ACTIVITIES].",
        "Criterion H, Exclusion: The disturbance [IS/IS NOT] attributable to the physiological effects of a substance or another medical condition. [IF ALTERNATIVE EXPLANATIONS EXIST: DESCRIPTION AND REASONING].",
        "Dissociative subtype: The evaluee [DOES/DOES NOT] report persistent or recurrent experiences of depersonalization or derealization. [IF ENDORSED: DESCRIPTION OF EXPERIENCES].",
        "Delayed expression: The evaluee [DOES/DOES NOT] meet the delayed expression specifier (full criteria not met until at least six months after the event, though some symptoms may have begun immediately)."
      ]
    },
    {
      heading: "Mental Status Examination",
      body: [
        "{{PATIENT_NAME}} presented as a [BUILD] [GENDER] who appeared [CONSISTENT WITH/OLDER THAN] the stated age of [AGE]. The evaluee was dressed in [ATTIRE] and was [GROOMING]. The evaluee was [COOPERATIVE/GUARDED/ANXIOUS] with the evaluation process.",
        `Speech was [RATE, VOLUME, RHYTHM]. The evaluee's voice [DID/DID NOT] become [STRAINED/QUIET/PRESSURED] when discussing the traumatic event. Mood was described as "[EVALUEE'S WORDS]." Affect was [CONSTRICTED/BLUNTED/LABILE/APPROPRIATE], and the evaluee became visibly [TEARFUL/TENSE/AGITATED] when recounting [SPECIFIC TOPIC].`,
        "Thought process was [LINEAR/CIRCUMSTANTIAL]. The evaluee [DENIED/ENDORSED] current suicidal ideation, homicidal ideation, and intent to harm self or others. There was no evidence of psychotic symptoms. Thought content was notable for [TRAUMA-RELATED PREOCCUPATIONS, GUILT, HYPERVIGILANT THEMES].",
        "The evaluee was oriented in all spheres. Attention and concentration were [DESCRIPTION], consistent with the evaluee's reported concentration difficulties. Insight into the relationship between symptoms and the traumatic event was [GOOD/PARTIAL/POOR]. Judgment appeared [INTACT/MILDLY IMPAIRED]."
      ]
    },
    {
      heading: "Test Results",
      body: [
        "Clinician-Administered PTSD Scale for DSM-5 (CAPS-5): The evaluee obtained a total severity score of [SCORE] (range 0-80). Cluster scores: B (Intrusion) = [SCORE], C (Avoidance) = [SCORE], D (Negative Cognitions/Mood) = [SCORE], E (Arousal/Reactivity) = [SCORE]. Using the DSM-5 diagnostic rule (at least one moderate or higher symptom in each required cluster), the evaluee [MEETS/DOES NOT MEET] CAPS-5 criteria for a PTSD diagnosis. The overall severity is in the [MILD/MODERATE/SEVERE/EXTREME] range.",
        "PTSD Checklist for DSM-5 (PCL-5): The evaluee obtained a total score of [SCORE] (range 0-80; clinical cutoff = 31-33). Cluster scores: B = [SCORE], C = [SCORE], D = [SCORE], E = [SCORE]. The self-report pattern is [CONSISTENT/INCONSISTENT] with the CAPS-5 interview findings.",
        "Detailed Assessment of Posttraumatic Stress (DAPS): The evaluee's profile was [VALID/INVALID] based on the Positive Bias (PB = [SCORE]T) and Negative Bias (NB = [SCORE]T) scales. Clinical scale findings: [RELEVANT ELEVATED SCALES AND T-SCORES]. The DAPS results [SUPPORT/DO NOT SUPPORT] a diagnosis of PTSD.",
        "Beck Depression Inventory-II (BDI-II): The evaluee obtained a total score of [SCORE], falling in the [MINIMAL/MILD/MODERATE/SEVERE] range of self-reported depressive symptoms. Items endorsed at the highest level include [SPECIFIC ITEMS].",
        "Miller Forensic Assessment of Symptoms Test (M-FAST): The evaluee obtained a total score of [SCORE] (clinical cutoff = 6). The score [DOES/DOES NOT] exceed the cutoff for possible malingering.",
        "Test of Memory Malingering (TOMM): The evaluee scored [TRIAL 1 SCORE]/50, [TRIAL 2 SCORE]/50, and [RETENTION TRIAL SCORE]/50. Scores at or above 45 on Trial 2 indicate adequate effort. The evaluee's performance [IS/IS NOT] consistent with adequate effort."
      ]
    },
    {
      heading: "Symptom Validity",
      body: [
        "The credibility of the evaluee's symptom presentation is a central issue in forensic PTSD evaluations, given the external incentives that may be present. In this case, the evaluee [HAS/DOES NOT HAVE] identifiable external incentives, specifically [DESCRIPTION].",
        "The evaluee's performance on dedicated validity measures was as follows: M-FAST = [SCORE] (below/above cutoff), TOMM Trial 2 = [SCORE] (at or above/below cutoff). The DAPS validity scales [DID/DID NOT] suggest over-reporting or under-reporting.",
        "Consistency of presentation: The evaluee's self-reported symptoms were [CONSISTENT/INCONSISTENT] across the clinical interview, the CAPS-5, and self-report measures. The evaluee's presentation during the interview was [CONSISTENT/INCONSISTENT] with the severity of symptoms reported on questionnaires. Record review revealed [CONSISTENT/INCONSISTENT] symptom reporting across time and providers.",
        "Based on the totality of validity evidence, the examiner considers the evaluee's symptom presentation to be [CREDIBLE/NOT FULLY CREDIBLE/NONCREDIBLE]. [IF NOT FULLY CREDIBLE: SPECIFIC BASIS FOR THIS DETERMINATION]."
      ]
    },
    {
      heading: "Diagnostic Impression",
      body: [
        "Based on the data gathered in this evaluation, the following diagnostic impressions are offered:",
        "[PRIMARY DIAGNOSIS]: Posttraumatic Stress Disorder (309.81, F43.10), [WITH/WITHOUT] dissociative symptoms, [WITH/WITHOUT] delayed expression. Severity: [MILD/MODERATE/SEVERE] based on CAPS-5 total severity score and functional impairment. [OR: The evaluee does not currently meet full DSM-5-TR criteria for PTSD. Specifically, the evaluee does not meet criteria for Cluster [X] because REASONING.]",
        "[IF APPLICABLE, ADDITIONAL DIAGNOSES]: [DIAGNOSIS, CODE]. This condition is [COMORBID WITH/DIFFERENTIAL FROM] PTSD. The basis for this additional diagnosis is [DESCRIPTION].",
        "[IF APPLICABLE, RULE-OUTS]: The following diagnoses were considered and ruled out: [DIAGNOSES AND REASONING FOR EXCLUSION]. Specific differential considerations included Acute Stress Disorder (if within one month), Adjustment Disorder (if Criterion A not met), Major Depressive Disorder (overlapping but distinct symptoms), and Malingered PTSD (addressed in Symptom Validity section)."
      ]
    },
    {
      heading: "Causation and Nexus",
      body: [
        "[THIS SECTION IS INCLUDED WHEN THE REFERRAL QUESTION REQUIRES A CAUSATION OPINION]",
        "The evaluee's current PTSD symptoms [ARE/ARE NOT] causally related to the index event of [DATE]. This opinion is based on the following analysis:",
        "Temporal relationship: Symptoms [BEGAN/WORSENED] within [TIMEFRAME] of the index event. Pre-incident functioning, as documented in [RECORDS], was [DESCRIPTION]. Post-incident functioning declined in the following areas: [DESCRIPTION].",
        'Pre-existing conditions: The evaluee [DID/DID NOT] have pre-existing psychiatric conditions. [IF YES: The evaluee carried a prior diagnosis of DIAGNOSIS, which was STABLE/ACTIVE at the time of the index event. The index event AGGRAVATED/DID NOT AGGRAVATE this pre-existing condition.] The concept of the "eggshell plaintiff" [IS/IS NOT] relevant to this case.',
        "Alternative causes: The examiner considered whether the current symptoms could be attributed to [OTHER TRAUMATIC EVENTS, SUBSTANCE USE, MEDICAL CONDITIONS, LIFE STRESSORS] rather than the index event. [ANALYSIS OF ALTERNATIVE CAUSES AND REASONING].",
        "Conclusion: To a reasonable degree of psychological certainty, the index event of [DATE] is [THE PRIMARY CAUSE/A SUBSTANTIAL CONTRIBUTING CAUSE/NOT A SUBSTANTIAL CAUSE] of the evaluee's current clinical presentation."
      ]
    },
    {
      heading: "Opinion",
      body: [
        "To a reasonable degree of psychological certainty, the examiner offers the following opinions:",
        "1. Diagnosis: {{PATIENT_NAME}} [DOES/DOES NOT] currently meet DSM-5-TR criteria for Posttraumatic Stress Disorder (309.81, F43.10). [SEVERITY AND SPECIFIERS].",
        "2. Causation: The claimed traumatic event of [DATE] [IS/IS NOT] a substantial contributing cause of the current clinical presentation. [BRIEF SUPPORTING RATIONALE].",
        "3. Functional impairment: The evaluee's symptoms result in [DESCRIPTION OF CURRENT FUNCTIONAL LIMITATIONS] in the areas of [OCCUPATIONAL, SOCIAL, DAILY FUNCTIONING].",
        "4. Prognosis: With appropriate evidence-based treatment, the prognosis is [GOOD/FAIR/GUARDED/POOR]. The basis for this prognosis is [CHRONICITY, COMPLEXITY, COMORBIDITIES, TREATMENT RESPONSE TO DATE]."
      ]
    },
    {
      heading: "Recommendations",
      body: [
        "1. Evidence-based PTSD treatment: The evaluee is a candidate for [Prolonged Exposure (PE) / Cognitive Processing Therapy (CPT) / Eye Movement Desensitization and Reprocessing (EMDR)], which are the treatments with the strongest empirical support for PTSD. Treatment should be delivered by a clinician trained in the specific protocol, with fidelity monitoring.",
        "2. Comorbid condition treatment: [IF APPLICABLE: Concurrent treatment for DIAGNOSIS is recommended, including SPECIFIC RECOMMENDATIONS].",
        "3. Psychiatric consultation: [IF APPLICABLE: A psychiatric evaluation for psychotropic medication management is recommended, targeting SPECIFIC SYMPTOMS].",
        "4. Functional rehabilitation: [IF APPLICABLE: Vocational rehabilitation, graduated return-to-work plan, or occupational therapy is recommended to address SPECIFIC FUNCTIONAL DEFICITS].",
        "5. Substance use treatment: [IF APPLICABLE: Treatment for substance use should be [INTEGRATED WITH/SEQUENTIAL TO] PTSD treatment].",
        "6. Follow-up evaluation: A re-evaluation in [TIMEFRAME] is recommended to assess treatment response, symptom trajectory, and updated functional status."
      ]
    },
    SIGNATURE_BLOCK$1
  ]
};
const ADHD_TEMPLATE = {
  id: "report_adhd_dx",
  evalType: "ADHD Dx",
  title: "ADHD Diagnostic Evaluation",
  subtitle: "DSM-5-TR Attention-Deficit/Hyperactivity Disorder Assessment",
  sections: [
    HEADER_BLOCK,
    IDENTIFYING_INFO,
    {
      heading: "Referral Question",
      body: [
        "The referring party, {{REFERRING_PARTY}}, requested a diagnostic evaluation of {{PATIENT_NAME}} to determine whether the evaluee currently meets DSM-5-TR criteria for Attention-Deficit/Hyperactivity Disorder (ADHD), to specify the presentation type and severity, and to provide treatment and accommodation recommendations. The evaluation was requested in the context of [CLINICAL REFERRAL/ACADEMIC ACCOMMODATION REQUEST/WORKPLACE ACCOMMODATION REQUEST/DISABILITY DETERMINATION/FORENSIC REFERRAL]. This evaluation follows best practice guidelines for adult ADHD assessment, including the use of multi-method, multi-informant data collection."
      ]
    },
    NOTICE_OF_NON_CONFIDENTIALITY,
    {
      heading: "Procedures",
      body: [
        "The following procedures were used in the preparation of this report:",
        ...PROCEDURES_BOILERPLATE,
        "Administration of the Diagnostic Interview for ADHD in Adults, Version 5 (DIVA-5)",
        "Administration of the Conners Adult ADHD Rating Scales (CAARS-2), self-report and observer-report forms",
        "Administration of the Wechsler Adult Intelligence Scale, Fourth Edition (WAIS-IV), selected subtests",
        "Administration of the Conners Continuous Performance Test, Third Edition (CPT-3)",
        "Administration of the Wisconsin Card Sorting Test (WCST)",
        "Administration of the Trail Making Test, Parts A and B",
        "Administration of symptom validity measures"
      ]
    },
    {
      heading: "Records Reviewed",
      body: [
        "Childhood school records and report cards from [SCHOOL/DISTRICT], grades [RANGE]",
        "Prior psychoeducational or psychological evaluation reports",
        "Prior psychiatric records from [PROVIDER]",
        "Academic accommodation records from [INSTITUTION], if any",
        "Medical records from [PROVIDER], including any neurological workup",
        "Self-report questionnaires completed by the evaluee",
        "Observer-report questionnaires completed by [INFORMANT NAME AND RELATIONSHIP]"
      ]
    },
    {
      heading: "Developmental History",
      body: [
        "{{PATIENT_NAME}} is a [AGE]-year-old [RACE/ETHNICITY] [GENDER] who is currently [OCCUPATION/STUDENT STATUS]. The evaluee was born [FULL-TERM/PREMATURE] following [UNREMARKABLE/COMPLICATED] pregnancy and delivery. Early developmental milestones for walking, talking, and toilet training were reached [ON TIME/WITH DELAY].",
        'The evaluee reported that behavioral and attention difficulties were first noticed at approximately age [AGE], by [PARENT/TEACHER/SELF]. Specific childhood symptoms included [DESCRIPTION, e.g., difficulty staying seated, losing belongings, daydreaming, blurting out answers, difficulty waiting turns, difficulty completing homework]. Report cards from grades [RANGE] reflect [TEACHER COMMENTS, e.g., "does not work to potential," "needs to pay attention," "fidgets and distracts others"].',
        "The evaluee's childhood behavior at home was described as [DESCRIPTION]. The evaluee [WAS/WAS NOT] identified for special education or Section 504 services. The evaluee [WAS/WAS NOT] evaluated for ADHD as a child. [IF EVALUATED: The results of that evaluation were DESCRIPTION.] The evaluee [WAS/WAS NOT] prescribed stimulant medication as a child. [IF PRESCRIBED: The reported response was DESCRIPTION.]",
        "Family history of ADHD or learning difficulties: The evaluee reported that [FAMILY MEMBER(S)] [HAS/HAVE] been diagnosed with or shows symptoms of [ADHD/LEARNING DISABILITY/OTHER]. Family psychiatric history is notable for [DESCRIPTION].",
        "The evaluee described academic performance in [ELEMENTARY/MIDDLE/HIGH SCHOOL/COLLEGE] as [DESCRIPTION]. The evaluee reported [GRADE REPETITIONS/SUSPENSIONS/ACADEMIC PROBATION/STRONG GRADES WITH HIGH EFFORT, IF APPLICABLE]. Social functioning in childhood and adolescence was described as [DESCRIPTION]."
      ]
    },
    {
      heading: "Current Presentation",
      body: [
        "The evaluee reported the following current symptoms of inattention: [SPECIFIC SYMPTOMS ENDORSED, e.g., difficulty sustaining attention during meetings, making careless errors on reports, difficulty organizing tasks and managing time, losing phone and keys frequently, being easily distracted by background noise, difficulty following through on tasks at work]. The evaluee rated these symptoms as [MILD/MODERATE/SEVERE] in their impact on daily functioning.",
        "The evaluee reported the following current symptoms of hyperactivity and impulsivity: [SPECIFIC SYMPTOMS ENDORSED, e.g., internal restlessness, difficulty remaining seated through meetings, talking excessively, interrupting colleagues, difficulty waiting in lines, making impulsive purchases]. The evaluee rated these symptoms as [MILD/MODERATE/SEVERE].",
        "Symptoms are present in the following settings: [HOME, WORK, SCHOOL, SOCIAL SITUATIONS]. Specific examples of cross-setting impairment include: at work, [EXAMPLE]; at home, [EXAMPLE]; in social situations, [EXAMPLE].",
        "The evaluee reported that symptoms have persisted [CONTINUOUSLY/WITH FLUCTUATION] since childhood. The evaluee identified [COMPENSATORY STRATEGIES, e.g., lists, alarms, partner reminders, hyperfocus on deadline pressure] that have partially masked the impact of symptoms. The evaluee reported that current demands have [EXCEEDED/NOT EXCEEDED] the compensatory capacity, specifically because [REASON, e.g., new job with more administrative demands, graduate school, remote work with less external structure].",
        "The evaluee [DENIED/ENDORSED] current depression, anxiety, and sleep disturbance. The evaluee reported current substance use as [DESCRIPTION]. The evaluee reported current caffeine consumption of [AMOUNT] and screen time of approximately [HOURS] per day."
      ]
    },
    {
      heading: "Mental Status Examination",
      body: [
        "{{PATIENT_NAME}} presented as a [BUILD] [GENDER] who appeared the stated age of [AGE]. Grooming and hygiene were [DESCRIPTION]. The evaluee arrived [ON TIME/LATE] for the evaluation. The evaluee was [COOPERATIVE AND ENGAGED/RESTLESS/DISTRACTIBLE] throughout testing.",
        `Speech was [NORMAL RATE/RAPID/PRESSURED] and [NORMAL VOLUME/LOUD]. The evaluee [DID/DID NOT] frequently go off-topic or lose the thread of questions during the interview. Mood was described as "[EVALUEE'S WORDS]." Affect was [FULL/CONSTRICTED] and [APPROPRIATE/ANXIOUS].`,
        "Thought process was [LINEAR/TANGENTIAL/CIRCUMSTANTIAL]. The evaluee [DID/DID NOT] jump between topics. There was no evidence of psychotic symptoms. The evaluee [DENIED/ENDORSED] suicidal and homicidal ideation.",
        "Behavioral observations during testing: The evaluee [DESCRIPTION, e.g., frequently shifted position in the chair, asked to take breaks, looked around the room, needed questions repeated, lost track of multi-step instructions, maintained focus with visible effort, fidgeted with pen throughout]. The evaluee's sustained effort during the testing session was [ADEQUATE/VARIABLE/DECLINED OVER THE SESSION]."
      ]
    },
    {
      heading: "Test Results",
      body: [
        "WAIS-IV Selected Subtests: The evaluee's performance on selected subtests was as follows: [SUBTEST NAMES AND SCALED SCORES]. The Working Memory Index (WMI) was estimated at [SCORE] (percentile = [PERCENTILE]). The Processing Speed Index (PSI) was estimated at [SCORE] (percentile = [PERCENTILE]). [INTERPRETATION: A pattern of WMI and PSI scores significantly below the evaluee's Verbal Comprehension and Perceptual Reasoning abilities IS/IS NOT present, which IS/IS NOT consistent with the attentional and processing efficiency weaknesses seen in ADHD.]",
        "Conners Continuous Performance Test, Third Edition (CPT-3): The evaluee's performance was characterized by [DESCRIPTION]. Key indices: Detectability (d') = [T-SCORE] (measure of attentiveness), Omissions = [T-SCORE] (missed targets, suggesting inattention), Commissions = [T-SCORE] (false alarms, suggesting impulsivity), Hit Reaction Time = [T-SCORE], HRT Standard Error = [T-SCORE] (response consistency), Perseverations = [T-SCORE]. The overall pattern [IS/IS NOT] consistent with an ADHD-related attentional profile. [IMPORTANT NOTE: CPT performance alone is not diagnostic of ADHD and must be interpreted in context.]",
        "Wisconsin Card Sorting Test (WCST): The evaluee completed [NUMBER] categories and made [NUMBER] perseverative errors (T = [SCORE]). The error pattern [IS/IS NOT] consistent with executive dysfunction. [INTERPRETATION IN CONTEXT].",
        "Trail Making Test: Part A (processing speed and visual scanning) was completed in [SECONDS] (T = [SCORE]). Part B (cognitive flexibility and set-shifting) was completed in [SECONDS] (T = [SCORE]). The B:A ratio was [RATIO], which [IS/IS NOT] suggestive of executive functioning difficulty beyond simple processing speed.",
        "Conners Adult ADHD Rating Scales, Second Edition (CAARS-2): Self-report: Inattention/Memory Problems = [T-SCORE], Hyperactivity/Restlessness = [T-SCORE], Impulsivity/Emotional Lability = [T-SCORE], Problems with Self-Concept = [T-SCORE], ADHD Index = [T-SCORE]. Observer report (completed by [INFORMANT]): Inattention/Memory Problems = [T-SCORE], Hyperactivity/Restlessness = [T-SCORE], Impulsivity/Emotional Lability = [T-SCORE], ADHD Index = [T-SCORE]. Self and observer reports were [CONSISTENT/DISCREPANT], with [DESCRIPTION OF PATTERN].",
        "DIVA-5 (Diagnostic Interview for ADHD in Adults): The structured interview confirmed [NUMBER] of 9 inattention criteria and [NUMBER] of 9 hyperactivity-impulsivity criteria in adulthood. Childhood symptoms were corroborated by [EVALUEE REPORT/OBSERVER REPORT/SCHOOL RECORDS], confirming [NUMBER] of 9 inattention criteria and [NUMBER] of 9 hyperactivity-impulsivity criteria present before age 12."
      ]
    },
    {
      heading: "Symptom Validity",
      body: [
        "The base rate of ADHD symptom exaggeration in evaluations conducted for accommodation or disability purposes is estimated at 25-48% in research samples (Musso & Gouvier, 2014; Sullivan et al., 2007). Symptom validity assessment is therefore a standard and necessary component of this evaluation.",
        "[VALIDITY INSTRUMENT] was administered. The evaluee obtained a score of [SCORE], which [DOES/DOES NOT] exceed the cutoff for suspected feigning or exaggeration. [ADDITIONAL VALIDITY INSTRUMENT, IF USED]: The evaluee obtained a score of [SCORE], indicating [INTERPRETATION].",
        "Embedded validity indicators on the CAARS-2 (Inconsistency Index = [SCORE]) [DID/DID NOT] suggest inconsistent responding. The CPT-3 profile [DID/DID NOT] show patterns associated with poor effort (e.g., below-chance performance, unusually slow reaction times unrelated to the evaluee's cognitive profile).",
        "The evaluee's self-reported symptoms were [CONSISTENT/INCONSISTENT] with observer reports, school records, and behavioral observations during testing. Overall, the evaluee's symptom presentation is judged to be [CREDIBLE/NOT FULLY CREDIBLE/NONCREDIBLE] based on the convergence of validity evidence."
      ]
    },
    {
      heading: "Differential Diagnosis",
      body: [
        "The following conditions were considered as possible explanations for, or contributors to, the evaluee's attentional and organizational complaints:",
        "Major Depressive Disorder: The evaluee [DOES/DOES NOT] currently meet criteria for MDD. Depressive symptoms [ARE/ARE NOT] a more parsimonious explanation for the reported concentration difficulties. The evaluee's attentional complaints [PRECEDED/DID NOT PRECEDE] the onset of any depressive episodes, which [SUPPORTS/DOES NOT SUPPORT] a primary ADHD diagnosis.",
        "Generalized Anxiety Disorder: The evaluee [DOES/DOES NOT] report symptoms consistent with GAD. Anxiety-driven attentional fragmentation [IS/IS NOT] a more parsimonious explanation for the symptoms. [REASONING].",
        "Learning Disorders: Prior testing [DID/DID NOT] identify a specific learning disorder. Academic performance patterns [ARE/ARE NOT] consistent with a learning disability rather than ADHD. [REASONING].",
        "Sleep Disorders: The evaluee reported [SLEEP PATTERN]. The evaluee [HAS/HAS NOT] been evaluated for obstructive sleep apnea or other sleep disorders. Sleep deprivation [IS/IS NOT] an adequate explanation for the reported symptoms. [REASONING].",
        "Substance Use Disorders: Current and past substance use [IS/IS NOT] an adequate alternative explanation for the attentional complaints. [REASONING].",
        "Medical Conditions: The evaluee [DOES/DOES NOT] have medical conditions (e.g., thyroid disorder, anemia, chronic pain) that could account for attentional complaints. [REASONING].",
        "Normal Variation: The evaluee's complaints [ARE/ARE NOT] within the range of normal attentional variation under the evaluee's current life circumstances (e.g., high stress, sleep deprivation, demanding workload). [REASONING]."
      ]
    },
    {
      heading: "Diagnostic Impression",
      body: [
        "Based on the totality of data gathered in this evaluation, the following diagnostic impressions are offered:",
        "[PRIMARY DIAGNOSIS]: Attention-Deficit/Hyperactivity Disorder, [Combined Presentation (F90.2) / Predominantly Inattentive Presentation (F90.0) / Predominantly Hyperactive-Impulsive Presentation (F90.1)], [Mild/Moderate/Severe]. This diagnosis is based on the following: (1) [NUMBER] inattention symptoms and [NUMBER] hyperactivity-impulsivity symptoms are currently present, exceeding the DSM-5-TR threshold of 5 for adults; (2) childhood onset before age 12 is supported by [EVIDENCE]; (3) symptoms are present in [SETTINGS]; (4) symptoms cause clinically significant impairment in [DOMAINS]; (5) symptoms are not better explained by [DIFFERENTIAL DIAGNOSES RULED OUT].",
        "[OR: The evaluee does not currently meet DSM-5-TR criteria for ADHD. Specifically, [CRITERIA NOT MET AND REASONING]. The evaluee's attentional complaints are better accounted for by [ALTERNATIVE EXPLANATION].]",
        "[IF APPLICABLE, COMORBID DIAGNOSES]: [DIAGNOSIS AND CODE]. The basis for this additional diagnosis is [DESCRIPTION]. The comorbid condition [DOES/DOES NOT] complicate the ADHD presentation."
      ]
    },
    {
      heading: "Opinion",
      body: [
        "To a reasonable degree of psychological certainty, the examiner offers the following opinions:",
        "1. Diagnosis: {{PATIENT_NAME}} [DOES/DOES NOT] currently meet DSM-5-TR criteria for ADHD. [PRESENTATION TYPE AND SEVERITY].",
        "2. Childhood onset: The evaluee's symptom history [IS/IS NOT] consistent with onset before age 12, as supported by [EVIDENCE].",
        "3. Functional impairment: The evaluee's symptoms result in [DESCRIPTION] impairment in [DOMAINS]. This impairment [IS/IS NOT] attributable to the ADHD diagnosis.",
        "4. Symptom credibility: The evaluee's symptom presentation [IS/IS NOT] credible based on multi-method validity assessment."
      ]
    },
    {
      heading: "Recommendations",
      body: [
        "1. Psychiatric consultation: A psychiatric evaluation for stimulant or non-stimulant pharmacotherapy is recommended. First-line options include [METHYLPHENIDATE/AMPHETAMINE-BASED STIMULANTS/ATOMOXETINE], with the choice guided by the evaluee's medical history, comorbidities, and substance use risk. Medication response should be monitored with standardized follow-up measures.",
        "2. Psychotherapy: Cognitive-behavioral therapy (CBT) adapted for adult ADHD is recommended to address [SPECIFIC TARGETS, e.g., time management, organizational skills, emotional regulation, procrastination, self-esteem]. The Safren CBT for Adult ADHD protocol has the strongest empirical support.",
        "3. Academic accommodations [IF APPLICABLE]: The evaluee's diagnosis and functional limitations support the following accommodations under Section 504 or the ADA: [SPECIFIC ACCOMMODATIONS, e.g., extended time on examinations (1.5x), testing in a reduced-distraction environment, permission to audio-record lectures, note-taking assistance]. These accommodations are directly tied to the documented functional deficits and are not intended to provide an unfair advantage.",
        "4. Workplace accommodations [IF APPLICABLE]: The evaluee may benefit from [SPECIFIC ACCOMMODATIONS, e.g., written rather than verbal instructions, flexible scheduling, noise-reducing workspace modifications, structured check-ins with supervisor, use of organizational technology].",
        "5. Comorbid condition treatment [IF APPLICABLE]: Concurrent treatment for [DIAGNOSIS] is recommended, including [SPECIFIC RECOMMENDATIONS].",
        "6. Follow-up evaluation: A follow-up evaluation in [TIMEFRAME] is recommended to assess treatment response and the continued need for accommodations."
      ]
    },
    SIGNATURE_BLOCK$1
  ]
};
const MALINGERING_TEMPLATE = {
  id: "report_malingering",
  evalType: "Malingering",
  title: "Symptom Validity Assessment",
  subtitle: "Evaluation of Feigned or Exaggerated Psychological Symptoms",
  sections: [
    HEADER_BLOCK,
    IDENTIFYING_INFO,
    {
      heading: "Referral Question",
      body: [
        "The referring party, {{REFERRING_PARTY}}, requested an evaluation to determine whether {{PATIENT_NAME}}'s reported psychological symptoms are consistent with a genuine clinical presentation or whether there is evidence of symptom fabrication, gross exaggeration, or insufficient effort that undermines the validity of the clinical data. The evaluation uses the Slick, Sherman, and Iverson (1999) criteria for Malingered Neurocognitive Dysfunction (MND), where neurocognitive complaints are at issue, and the Rogers (2008) model for detection of feigned psychiatric symptoms. No single test score or clinical observation is used as a sole determinant of a malingering conclusion."
      ]
    },
    NOTICE_OF_NON_CONFIDENTIALITY,
    {
      heading: "Procedures",
      body: [
        "The following procedures were used in the preparation of this report:",
        ...PROCEDURES_BOILERPLATE,
        "Administration of the Test of Memory Malingering (TOMM)",
        "Administration of the Word Memory Test (WMT) or Medical Symptom Validity Test (MSVT)",
        "Administration of the Structured Inventory of Malingered Symptomatology (SIMS)",
        "Administration of the Miller Forensic Assessment of Symptoms Test (M-FAST)",
        "Administration of the Structured Interview of Reported Symptoms, Second Edition (SIRS-2)",
        "Administration of the Minnesota Multiphasic Personality Inventory-3 (MMPI-3)",
        "Administration of the Personality Assessment Inventory (PAI)",
        "Review of embedded validity indicators across all cognitive and personality measures"
      ]
    },
    {
      heading: "Records Reviewed",
      body: [
        "Prior psychological and psychiatric evaluation reports, including any prior validity testing results",
        "Medical records from treating providers, dated [RANGE]",
        "Mental health treatment records from [PROVIDER], dated [RANGE]",
        "Incident reports, police reports, or workplace injury reports related to the claimed event",
        "Surveillance video or investigative reports provided by the referring party, if any",
        "Deposition transcripts, if available",
        "Employment, academic, or military records documenting pre-claim functioning",
        "Social media content provided by the referring party, if any",
        "Prior claims history, if provided"
      ]
    },
    {
      heading: "Relevant Background",
      body: [
        "{{PATIENT_NAME}} is a [AGE]-year-old [RACE/ETHNICITY] [GENDER] who is currently [EMPLOYED AS/UNEMPLOYED SINCE/ON DISABILITY SINCE]. The evaluee is being evaluated in connection with [CONTEXT, e.g., personal injury litigation, workers compensation claim, disability determination, criminal proceedings].",
        "The evaluee claims the following symptoms: [SUMMARY OF CLAIMED SYMPTOMS AND ALLEGED ONSET DATE]. The evaluee attributes these symptoms to [CLAIMED CAUSE]. Treatment to date has included [DESCRIPTION OF TREATMENT]. The evaluee reports [IMPROVEMENT/NO IMPROVEMENT/WORSENING] since treatment began.",
        "The evaluee's pre-claim functioning, as documented in [RECORDS], indicates [DESCRIPTION OF BASELINE FUNCTIONING]. Prior diagnoses include [DIAGNOSES, IF ANY]. The evaluee [DID/DID NOT] have pre-existing psychiatric or cognitive conditions.",
        "External incentives: At the time of this evaluation, the evaluee [HAS/DOES NOT HAVE] identifiable external incentives that could motivate symptom fabrication or exaggeration. Specifically: [DESCRIPTION, e.g., pending personal injury lawsuit with claimed damages of $X, workers compensation claim, disability application, criminal proceedings where a mental health defense has been raised, avoidance of military deployment, child custody proceeding]."
      ]
    },
    {
      heading: "Presenting Complaints",
      body: [
        "The evaluee reported the following current symptoms during the clinical interview:",
        `Cognitive complaints: [DESCRIPTION, e.g., "I can't remember anything," "I can't concentrate for more than a few minutes," "I get confused all the time"]. The evaluee rated memory impairment as [SEVERITY] and concentration impairment as [SEVERITY]. The evaluee reported that these difficulties [DO/DO NOT] interfere with [SPECIFIC DAILY ACTIVITIES].`,
        "Psychiatric complaints: [DESCRIPTION, e.g., depression, anxiety, PTSD symptoms, psychotic symptoms, dissociation]. The evaluee described the severity as [DESCRIPTION] and the frequency as [DESCRIPTION].",
        "Functional complaints: The evaluee reported being unable to [SPECIFIC CLAIMED LIMITATIONS, e.g., work, drive, manage finances, maintain household, care for children]. The evaluee described a typical day as [DESCRIPTION].",
        "Notably, the evaluee's self-reported functional limitations [ARE/ARE NOT] consistent with the evaluee's observed behavior during the evaluation, which included [SPECIFIC OBSERVATIONS, e.g., the evaluee navigated to the office without difficulty, managed a full day of testing, used a smartphone to check messages during breaks, recalled specific details of the evaluation schedule]."
      ]
    },
    {
      heading: "Mental Status Examination",
      body: [
        "{{PATIENT_NAME}} presented as a [BUILD] [GENDER] who appeared [CONSISTENT WITH/OLDER THAN] the stated age. Grooming and hygiene were [DESCRIPTION]. The evaluee arrived [ON TIME/LATE] and was [COOPERATIVE/GUARDED/EVASIVE/DRAMATIC] throughout the evaluation.",
        `Speech was [DESCRIPTION]. The evaluee's conversational language ability appeared [CONSISTENT/INCONSISTENT] with claimed cognitive deficits. Mood was described as "[EVALUEE'S WORDS]." Affect was [DESCRIPTION]. The evaluee's affective presentation [WAS/WAS NOT] consistent with the severity of claimed distress.`,
        "Thought process was [DESCRIPTION]. The evaluee [DENIED/ENDORSED] hallucinations, describing them as [IF ENDORSED: DESCRIPTION, with attention to atypical features]. The evaluee [DENIED/ENDORSED] delusions. There was [NO EVIDENCE/EVIDENCE] of genuine psychotic symptoms based on behavioral observation and the pattern of reported experiences.",
        "Effort and engagement: The evaluee appeared to [PUT FORTH ADEQUATE EFFORT/DEMONSTRATE VARIABLE EFFORT/SHOW SIGNS OF POOR EFFORT] during testing. Specific behavioral indicators included [DESCRIPTION, e.g., answering quickly without appearing to consider the question, taking an unusually long time on simple items, appearing to deliberately select wrong answers, giving approximate but consistently incorrect responses]."
      ]
    },
    {
      heading: "Performance Validity Findings",
      body: [
        "Performance validity tests (PVTs) assess whether the evaluee is putting forth adequate effort on cognitive testing. Below-chance or below-cutoff performance on PVTs does not, by itself, establish malingering, but it does indicate that the cognitive test results cannot be interpreted as valid reflections of the evaluee's true abilities.",
        "Test of Memory Malingering (TOMM): Trial 1 = [SCORE]/50, Trial 2 = [SCORE]/50, Retention Trial = [SCORE]/50. The recommended cutoff for adequate effort is 45/50 on Trial 2. The evaluee's performance [EXCEEDS/FALLS BELOW] this cutoff. [IF BELOW CUTOFF: This level of performance is lower than what is typically seen in individuals with moderate to severe traumatic brain injury, dementia, and intellectual disability, and is strongly associated with noncredible effort in research samples.]",
        "Word Memory Test (WMT) [OR Medical Symptom Validity Test (MSVT)]: Immediate Recognition = [SCORE]%, Delayed Recognition = [SCORE]%, Consistency = [SCORE]%. The evaluee's performance [PASSES/FAILS] the WMT validity criteria. [IF FAILS: The pattern of failure IS/IS NOT consistent with deliberate suppression of performance, as opposed to genuine cognitive impairment.]",
        "[ADDITIONAL PVTs, IF ADMINISTERED]: [INSTRUMENT] yielded a score of [SCORE], which [DOES/DOES NOT] exceed the cutoff for noncredible performance. Classification accuracy for this measure is [SENSITIVITY/SPECIFICITY].",
        "Summary of PVT findings: The evaluee [PASSED/FAILED] [NUMBER] of [NUMBER] stand-alone PVTs. [NUMBER] embedded PVT indicators across cognitive testing were [WITHIN/OUTSIDE] normal limits. The convergence of PVT findings indicates that the evaluee's effort on cognitive testing was [ADEQUATE/INADEQUATE], and the cognitive test results [CAN/CANNOT] be interpreted with confidence."
      ]
    },
    {
      heading: "Symptom Validity Findings",
      body: [
        "Symptom validity tests (SVTs) assess whether the evaluee's reported psychiatric and cognitive symptoms are consistent with known patterns of genuine psychopathology or whether they show features associated with fabrication or gross exaggeration.",
        "Structured Interview of Reported Symptoms, Second Edition (SIRS-2): The evaluee's profile was classified as [GENUINE/INDETERMINATE/FEIGNING] based on the primary scale decision model. Specific scale scores: Rare Symptoms (RS) = [SCORE], Symptom Combinations (SC) = [SCORE], Improbable or Absurd Symptoms (IA) = [SCORE], Reported vs. Observed Symptoms (RO) = [SCORE], Symptom Selectivity (SEL) = [SCORE]. The supplementary scales indicated [DESCRIPTION]. [INTERPRETATION OF PATTERN].",
        "Miller Forensic Assessment of Symptoms Test (M-FAST): Total score = [SCORE] (cutoff = 6). The evaluee's score [DOES/DOES NOT] exceed the screening cutoff for possible malingering.",
        "Structured Inventory of Malingered Symptomatology (SIMS): Total score = [SCORE] (cutoff = 14). Subscale scores: Psychosis = [SCORE], Neurologic Impairment = [SCORE], Amnestic Disorders = [SCORE], Low Intelligence = [SCORE], Affective Disorders = [SCORE]. The total score [DOES/DOES NOT] exceed the cutoff.",
        'MMPI-3 validity scales: F-r = [SCORE]T, Fp-r = [SCORE]T, Fs = [SCORE]T, FBS-r = [SCORE]T, RBS = [SCORE]T. The pattern of validity scale elevations [IS/IS NOT] consistent with over-reporting. [SPECIFIC INTERPRETATION OF THE PATTERN, e.g., "The combination of elevated Fp-r and Fs with relatively lower F-r suggests endorsement of rarely endorsed items rather than general psychological distress."]',
        "PAI validity scales: NIM = [SCORE]T, MAL = [SCORE]T, RDF = [SCORE], DEF = [SCORE]T, CDF = [SCORE]. The pattern [IS/IS NOT] consistent with over-reporting. [SPECIFIC INTERPRETATION].",
        "Summary of SVT findings: The evaluee's symptom presentation [IS/IS NOT] consistent with genuine psychopathology across multiple measures. The convergence of SVT findings indicates [CREDIBLE PRESENTATION/INDETERMINATE PRESENTATION/PROBABLE OVER-REPORTING/DEFINITE OVER-REPORTING]."
      ]
    },
    {
      heading: "External Evidence",
      body: [
        "The following external evidence was considered in evaluating the consistency and credibility of the evaluee's claimed symptoms:",
        `Records consistency: The evaluee's symptom reports across time and providers have been [CONSISTENT/INCONSISTENT]. Specifically, [DESCRIPTION OF CONSISTENCY OR INCONSISTENCY ACROSS RECORDS, e.g., "The evaluee reported severe memory impairment to the current examiner but demonstrated intact memory during a deposition conducted three weeks prior"].`,
        `Behavioral consistency: The evaluee's observed behavior during the evaluation [WAS/WAS NOT] consistent with the severity of claimed impairment. [SPECIFIC EXAMPLES, e.g., "The evaluee claimed inability to recall basic personal information but provided a detailed and chronologically organized account of the incident in question"].`,
        "Surveillance or collateral observations: [IF AVAILABLE: Surveillance footage dated DATE showed the evaluee DESCRIPTION, which IS/IS NOT consistent with the evaluee's claimed functional limitations. IF NOT AVAILABLE: No surveillance or independent observational data was provided for review.]",
        "Social media content: [IF AVAILABLE: Social media posts reviewed showed DESCRIPTION, which IS/IS NOT consistent with claimed limitations. IF NOT AVAILABLE: No social media content was provided for review.]",
        "Treatment engagement: The evaluee [HAS/HAS NOT] engaged in recommended treatment. [IF NOT: The evaluee's failure to pursue treatment IS/IS NOT consistent with claimed severity of symptoms.]",
        "Incentive context: The evaluee has [DESCRIPTION OF EXTERNAL INCENTIVES]. The presence of external incentives does not prove malingering but does establish the necessary precondition of motive identified in the diagnostic frameworks used in this evaluation."
      ]
    },
    {
      heading: "Analysis",
      body: [
        "The following analysis integrates the performance validity, symptom validity, and external evidence findings using the applicable diagnostic framework.",
        "[IF NEUROCOGNITIVE CLAIMS]: Applying the Slick, Sherman, and Iverson (1999) criteria for Malingered Neurocognitive Dysfunction (MND):",
        "Criterion A (Presence of external incentive): [MET/NOT MET]. The evaluee has [DESCRIPTION OF INCENTIVE].",
        "Criterion B (Evidence from neuropsychological testing): [MET/NOT MET]. The evaluee [PERFORMED BELOW CHANCE ON/FAILED] [NUMBER] PVTs, which [MEETS/DOES NOT MEET] the threshold for Criterion B evidence. [SPECIFIC FINDINGS].",
        "Criterion C (Evidence from self-report): [MET/NOT MET]. The evaluee's self-reported symptoms [ARE/ARE NOT] substantially discrepant from known patterns of genuine dysfunction, behavioral observations, and documented functioning.",
        "Criterion D (Behaviors not fully accounted for): The above findings [ARE/ARE NOT] fully accounted for by psychiatric, neurological, or developmental factors. [REASONING].",
        "Classification: Based on the Slick criteria, the evaluee's presentation meets criteria for [DEFINITE MND/PROBABLE MND/DOES NOT MEET MND CRITERIA].",
        "[IF PSYCHIATRIC CLAIMS]: Applying the Rogers (2008) model for detection of feigned psychiatric symptoms:",
        "The evaluee's SIRS-2 profile was classified as [GENUINE/INDETERMINATE/FEIGNING]. The evaluee's MMPI-3 and PAI validity profiles [CONVERGE/DO NOT CONVERGE] with the SIRS-2 finding. The overall pattern [IS/IS NOT] consistent with a detection strategy of [RARE SYMPTOMS/SYMPTOM COMBINATIONS/INDISCRIMINANT SYMPTOM ENDORSEMENT/SYMPTOM SEVERITY]. [REASONING AND INTEGRATION]."
      ]
    },
    {
      heading: "Opinion",
      body: [
        "To a reasonable degree of psychological certainty, the examiner offers the following opinions regarding the validity of {{PATIENT_NAME}}'s symptom presentation:",
        "[SELECT ONE]:",
        "Credible Presentation: The evaluee's reported symptoms are consistent with genuine psychopathology. Performance and symptom validity testing did not reveal evidence of fabrication or gross exaggeration. The clinical test results can be interpreted with confidence.",
        "Indeterminate / Insufficient Effort: The evaluee's performance on validity testing was mixed, and the examiner cannot determine with confidence whether the clinical presentation is genuine. Specifically, [DESCRIPTION OF MIXED FINDINGS]. The cognitive and clinical test results [SHOULD BE INTERPRETED WITH CAUTION / CANNOT BE INTERPRETED WITH CONFIDENCE].",
        "Probable Feigning: The evaluee's presentation is more consistent with fabricated or grossly exaggerated symptoms than with genuine psychopathology. This conclusion is based on [MULTIPLE CONVERGING FINDINGS]. The evaluee meets Slick criteria for Probable MND [AND/OR] the SIRS-2 classification is Feigning. The clinical test results cannot be interpreted as valid reflections of the evaluee's true functioning.",
        "Definite Feigning: The evaluee's presentation is definitively inconsistent with genuine psychopathology. Performance on forced-choice PVTs was at or below chance levels, indicating deliberate suppression of performance. This conclusion is based on [SPECIFIC BELOW-CHANCE FINDINGS AND ADDITIONAL CONVERGING EVIDENCE]."
      ]
    },
    {
      heading: "Caveats",
      body: [
        "The following caveats apply to the interpretation of this evaluation:",
        "1. Failure on validity testing does not automatically establish deliberate intent to deceive. Alternative explanations include genuine cognitive impairment (though current PVTs are designed to be passed even by severely impaired individuals), low motivation unrelated to secondary gain, cultural or linguistic factors affecting test performance, fatigue, and pain. The examiner considered each of these alternatives and determined that [THEY ARE/ARE NOT] adequate explanations for the observed pattern based on [REASONING].",
        "2. A finding of noncredible symptom presentation does not mean the evaluee has no genuine symptoms. It means the evaluee's self-reported symptoms cannot be taken at face value, and the specific degree of impairment claimed by the evaluee is not supported by the data. The evaluee may have genuine underlying symptoms that are being exaggerated for secondary gain.",
        "3. Malingering is not a mental disorder. It is a behavior that may occur in the context of genuine psychopathology, personality pathology, or in the absence of any mental health condition.",
        "4. This opinion is based on the data available at the time of the evaluation. If additional records, surveillance, or collateral information become available, the examiner reserves the right to supplement or modify these opinions."
      ]
    },
    {
      heading: "Recommendations",
      body: [
        "1. Interpretation of prior and concurrent evaluations: [IF NONCREDIBLE]: Prior evaluations that relied on the evaluee's self-reported symptoms without adequate validity testing should be interpreted with caution. Diagnoses based solely on the evaluee's uncorroborated self-report may not be reliable.",
        "2. Further evaluation: [IF INDETERMINATE]: A re-evaluation with additional validity measures, observation in a naturalistic setting, or collateral data collection is recommended to resolve the ambiguity in the current findings.",
        "3. Treatment implications: [IF CREDIBLE]: The evaluee would benefit from treatment for [DIAGNOSES]. [IF NONCREDIBLE]: Treatment recommendations cannot be meaningfully offered when the clinical presentation is not credible. If the evaluee seeks treatment independently, the treating clinician should be made aware of the validity findings in this report.",
        "4. Referring party: The referring party is advised that [SPECIFIC GUIDANCE ON HOW TO USE THESE FINDINGS IN THE APPLICABLE LEGAL/ADMINISTRATIVE CONTEXT]."
      ]
    },
    SIGNATURE_BLOCK$1
  ]
};
const REPORT_TEMPLATES = [
  CST_TEMPLATE,
  CUSTODY_TEMPLATE,
  RISK_ASSESSMENT_TEMPLATE,
  FFD_TEMPLATE,
  PTSD_TEMPLATE,
  ADHD_TEMPLATE,
  MALINGERING_TEMPLATE
];
function templatesForEvalTypes(selected) {
  const set = new Set(selected);
  return REPORT_TEMPLATES.filter((t) => set.has(t.evalType));
}
const SUPPORTED_EVAL_TYPES = [
  "CST",
  "Custody",
  "Risk Assessment",
  "Fitness for Duty",
  "PTSD Dx",
  "ADHD Dx",
  "Malingering"
];
function loadDocx$1() {
  const m = require("docx");
  return {
    Document: m.Document,
    Packer: m.Packer,
    Paragraph: m.Paragraph,
    HeadingLevel: m.HeadingLevel,
    TextRun: m.TextRun,
    AlignmentType: m.AlignmentType
  };
}
function buildPracticeTokenMap(practice) {
  return {
    PRACTICE_NAME: practice.practiceName ?? "Independent Forensic Practice",
    CLINICIAN_FULL_NAME: practice.fullName,
    CLINICIAN_CREDENTIALS: practice.credentials,
    CLINICIAN_LICENSE: practice.licenseNumber,
    CLINICIAN_STATE: practice.licenseState,
    PRACTICE_ADDRESS: practice.practiceAddress ?? "",
    PRACTICE_PHONE: practice.phone ?? ""
  };
}
function applyTokens(text, tokens) {
  return text.replace(/\{\{([A-Z_]+)\}\}/g, (match, key) => {
    if (Object.prototype.hasOwnProperty.call(tokens, key)) {
      return tokens[key];
    }
    return match;
  });
}
function applyTokensToSection(section, tokens) {
  return {
    heading: applyTokens(section.heading, tokens),
    body: section.body.map((line) => applyTokens(line, tokens))
  };
}
async function renderDocx(template, tokens) {
  const docx = loadDocx$1();
  const { Document: Document2, Packer: Packer2, Paragraph: Paragraph2, HeadingLevel: HeadingLevel2, TextRun: TextRun2, AlignmentType: AlignmentType2 } = docx;
  const children = [];
  children.push(
    new Paragraph2({
      heading: HeadingLevel2.TITLE,
      alignment: AlignmentType2.CENTER,
      children: [new TextRun2({ text: applyTokens(template.title, tokens), bold: true })]
    })
  );
  children.push(
    new Paragraph2({
      alignment: AlignmentType2.CENTER,
      children: [
        new TextRun2({ text: applyTokens(template.subtitle, tokens), italics: true })
      ]
    })
  );
  children.push(new Paragraph2({ text: "" }));
  for (const rawSection of template.sections) {
    const section = applyTokensToSection(rawSection, tokens);
    children.push(
      new Paragraph2({
        heading: HeadingLevel2.HEADING_2,
        children: [new TextRun2({ text: section.heading, bold: true })]
      })
    );
    for (const line of section.body) {
      children.push(new Paragraph2({ text: line }));
    }
    children.push(new Paragraph2({ text: "" }));
  }
  const doc = new Document2({
    creator: tokens["CLINICIAN_FULL_NAME"] ?? "Psygil",
    title: applyTokens(template.title, tokens),
    description: `Psygil template: ${template.id}`,
    sections: [{ children }]
  });
  return Packer2.toBuffer(doc);
}
async function provisionTemplates(options) {
  const { projectRoot, practice, selectedEvalTypes } = options;
  const overwrite = options.overwrite === true;
  const templatesDir = path.join(projectRoot, "Workspace", "Templates");
  if (!fs.existsSync(templatesDir)) {
    fs.mkdirSync(templatesDir, { recursive: true });
  }
  const tokens = buildPracticeTokenMap(practice);
  const templates = templatesForEvalTypes(selectedEvalTypes);
  const results = [];
  for (const template of templates) {
    const docxPath = path.join(templatesDir, `${template.id}.docx`);
    const txtPath = path.join(templatesDir, `${template.id}.txt`);
    if (!overwrite && fs.existsSync(docxPath)) {
      results.push({
        id: template.id,
        evalType: template.evalType,
        docxPath,
        txtPath,
        bytesWritten: 0,
        skipped: true,
        skipReason: "File already exists"
      });
      continue;
    }
    try {
      const buffer = await renderDocx(template, tokens);
      fs.writeFileSync(docxPath, buffer);
      results.push({
        id: template.id,
        evalType: template.evalType,
        docxPath,
        txtPath,
        bytesWritten: buffer.length,
        skipped: false,
        skipReason: null
      });
    } catch (err) {
      results.push({
        id: template.id,
        evalType: template.evalType,
        docxPath,
        txtPath,
        bytesWritten: 0,
        skipped: true,
        skipReason: `Generation failed: ${err.message}`
      });
    }
  }
  return results;
}
const SYNTHETIC_HEADER = "[SYNTHETIC WRITING SAMPLE. All names, dates, diagnoses, and facts in this document are fictitious. This file exists to calibrate the Psygil Writer Agent on the examiner's preferred voice and style.]";
const SAMPLE_CST = {
  filename: "Writing_Sample_CST_Maynard.txt",
  evalType: "CST",
  content: `${SYNTHETIC_HEADER}

FORENSIC PSYCHOLOGICAL EVALUATION
Competency to Stand Trial

Examinee: Adrian T. Maynard
Date of Birth: March 4, 1987
Case Number: 2024-CR-01829
Court: 18th Judicial District, Division 6
Referring Party: Hon. Celeste Okonkwo via court order dated May 3, 2024
Date of Report: June 18, 2024
Dates of Contact: May 22, 2024 and June 11, 2024
Location: Arapahoe County Detention Facility

REFERRAL QUESTION

The court requested an evaluation addressing whether Mr. Maynard has a rational and factual understanding of the proceedings against him and sufficient present ability to consult with counsel, consistent with Dusky v. United States, 362 U.S. 402 (1960). Mr. Maynard is charged with one count of Second Degree Burglary (C.R.S. 18-4-203) and one count of Criminal Mischief (C.R.S. 18-4-501).

NOTICE OF NON-CONFIDENTIALITY

I met with Mr. Maynard at the outset of each interview and explained that I had been appointed by the court, that the evaluation was not treatment, that the usual rules of doctor-patient confidentiality did not apply, and that a written report would be provided to the court and to both parties. Mr. Maynard acknowledged understanding in his own words and agreed to proceed. He asked whether he could stop the interview if he became uncomfortable; I confirmed that he could.

PROCEDURES

I reviewed the arrest report, the jail mental health screening dated May 4, the jail psychiatry progress notes through June 7, the public defender's intake notes, and a prior psychological evaluation from 2019 obtained via release. I conducted two clinical interviews totaling approximately three hours. I administered a mental status examination on each occasion and a brief competency-specific structured interview. I did not administer formal psychological testing in this evaluation because the clinical picture was unambiguous after the interviews and the prior records.

RELEVANT BACKGROUND

Mr. Maynard reports that he was raised in Pueblo by his paternal grandmother. He completed the tenth grade and later earned a GED. He worked as a journeyman electrician for several years in his twenties. He describes the onset of mood symptoms in his late teens. He was first psychiatrically hospitalized in 2016 following a paranoid episode at a construction site, at which time he was told he had a condition involving "the chemicals in the brain." He has had three subsequent hospitalizations, most recently in late 2022. He acknowledges stopping his medication several weeks before the current arrest and describes the period leading up to the offense as one in which "the TV was talking directly at me."

MENTAL STATUS

At the first interview Mr. Maynard was appropriately groomed in jail attire, cooperative, and oriented to person and place. He was uncertain of the exact date. His speech was at times pressured, with tangential associations when he described his legal situation. His mood was "OK I guess" and his affect was restricted. He denied current suicidal or homicidal ideation. He endorsed persistent auditory hallucinations ("a man who comments on what I do") and paranoid ideation regarding surveillance by "the people who run the network." Insight into his illness was limited. Judgment in the interview was fair.

At the second interview, after two additional weeks on resumed antipsychotic medication, the clinical picture had improved. He remained mildly paranoid but his speech was better organized and he could track questions about his case more effectively.

FUNCTIONAL ABILITIES

Factual understanding. At the first interview Mr. Maynard correctly named his attorney, correctly identified the prosecution as "trying to get me convicted," and correctly understood that the judge made decisions in court. He could not explain the role of a jury or describe the plea options available to him. He could not name his charges and offered a conflated account involving three separate events, two of which did not occur. At the second interview he could name both charges, could describe a guilty plea and a trial as two distinct paths forward, and could explain in his own words what a jury does.

Rational understanding. At the first interview Mr. Maynard held a fixed belief that the District Attorney's office was "running an experiment on homeless people using mind control," and that his charges were "a cover story" for this experiment. He believed his attorney might be "working with them." At the second interview he could articulate doubts about these beliefs. He told me, "I still think something was off with the DA but maybe I was reading into things." He could tentatively consider that his earlier thoughts may have been symptoms of his illness returning when he stopped his medication.

Capacity to consult with counsel. At the first interview Mr. Maynard said he did not trust his attorney and refused to discuss the case with her. At the second interview he said he had met with her the day before and that they had talked about his case for about twenty minutes. He described the meeting as "OK." He was able to recall and paraphrase the substance of what his attorney had said to him.

CLINICAL FORMULATION

Mr. Maynard meets criteria for Schizophrenia, continuous (F20.9), with a course of treatment non-adherence followed by relapse in the weeks preceding the current charges. At the time of the offense and at the time of the first evaluation session, he was experiencing active positive symptoms including paranoid delusions, delusions of reference, and persistent auditory hallucinations. By the second session, after he had been restarted on olanzapine 15 mg at bedtime for approximately two weeks, his positive symptoms had partially remitted. His thought organization improved enough that he could meaningfully engage with the legal proceedings.

The diagnosis is mine. The formulation is based on my own interviews, the prior evaluation from 2019 that documents a prior psychotic episode with similar features, and the jail psychiatry records showing the trajectory of his response to reintroduced medication.

OPINION

To a reasonable degree of psychological certainty, at the time of the first interview Mr. Maynard did not have sufficient present ability to consult with counsel with a reasonable degree of rational understanding, and he did not have a rational as well as factual understanding of the proceedings against him. At that time his paranoid delusions centered on his attorney and the prosecution rendered him unable to meaningfully participate in his defense.

At the time of the second interview, Mr. Maynard had made meaningful clinical gains. He had acquired factual understanding he previously lacked. His paranoid ideation was less fixed. He was able to work with his attorney in a limited but productive way. It is my opinion that Mr. Maynard is now competent to stand trial, with the caveat that his competency is contingent on continued medication adherence. If his treatment is interrupted his competency is likely to deteriorate within weeks.

RECOMMENDATIONS

I recommend that the court find Mr. Maynard presently competent. I recommend that his treatment plan in custody include mandatory medication administration, documented refusal procedures, and weekly mental health checks. I recommend that counsel be alert to signs of decompensation and be prepared to re-raise competency if Mr. Maynard's engagement deteriorates in a way that suggests relapse.

Respectfully submitted,

Jordan Whitfield, Psy.D., ABPP
Licensed Psychologist, Colorado
`
};
const SAMPLE_PTSD = {
  filename: "Writing_Sample_PTSD_Avila.txt",
  evalType: "PTSD Dx",
  content: `${SYNTHETIC_HEADER}

FORENSIC PSYCHOLOGICAL EVALUATION
PTSD Diagnostic Assessment and Causation Opinion

Examinee: Raquel V. Avila
Date of Birth: September 19, 1981
Civil Action: Avila v. Colorado Skylight Logistics, Inc.
Case Number: 2023-CV-00842
Referring Party: Halvorsen & Ostrom LLP (plaintiff counsel)
Date of Report: February 8, 2024
Dates of Contact: January 11, 2024 and January 18, 2024
Location: Foundry SMB Clinical Suite, Denver

REFERRAL QUESTION

Plaintiff's counsel requested a psychological evaluation of Ms. Avila to determine whether she currently meets DSM-5-TR criteria for Posttraumatic Stress Disorder, to identify any comorbid or alternative diagnoses, and to offer an opinion on whether the motor vehicle collision of November 4, 2022 is a substantial contributing cause of her current clinical presentation.

NOTICE OF LIMITS ON CONFIDENTIALITY

Ms. Avila was informed at the outset that this evaluation was requested by her attorney for the civil proceeding, that the usual rules of doctor-patient confidentiality did not apply, and that a written report would be provided to her counsel and potentially to opposing counsel and the court. She acknowledged understanding and agreed to proceed.

PROCEDURES

I reviewed the Aurora Police Department accident report, emergency department records from Anschutz Medical Center for the three weeks following the collision, primary care records from 2020 to present, mental health records from Ms. Avila's employer-sponsored EAP covering six sessions in early 2023, and a plaintiff's disclosure packet including photographs of the scene. I conducted two interviews totaling four hours. I administered the Clinician-Administered PTSD Scale for DSM-5 (CAPS-5), the PCL-5, the Beck Depression Inventory-II, the Trauma Symptom Inventory-2 (TSI-2), and the Miller Forensic Assessment of Symptoms Test (M-FAST) for symptom validity.

RELEVANT BACKGROUND

Ms. Avila is a 42-year-old woman who immigrated to the United States from Oaxaca at age seven and grew up in Denver. She completed a bachelor's degree in accounting at Metropolitan State University and has worked as a payroll specialist at the same employer since 2012. She is married with two children, ages 14 and 9. She denied any significant psychiatric history prior to November 2022 and there is no mental health treatment documented in her primary care records before that date. She described herself before the collision as "a person who could handle anything."

THE INDEX EVENT

On the morning of November 4, 2022, Ms. Avila was driving southbound on I-25 near the Evans Avenue exit when a commercial box truck operated by an employee of the defendant entered her lane without signaling and struck her vehicle on the driver's side. Her vehicle spun into the concrete barrier. Ms. Avila was conscious throughout. She describes thinking that she was going to die. She recalls the sound of the impact in detail, the sensation of the airbag, and the smell of coolant. She was extracted by Aurora Fire Rescue and transported to Anschutz with a fractured left wrist, a concussion (loss of consciousness not documented), and multiple contusions. The driver of the box truck sustained minor injuries. No fatalities occurred.

PTSD CRITERIA REVIEW (DSM-5-TR)

Criterion A. Ms. Avila was directly exposed to actual or threatened death and serious injury. Criterion A is met.

Criterion B (intrusion). She endorsed four of five intrusion symptoms on the CAPS-5 with clinically significant frequency and intensity. She experiences weekly intrusive memories of the collision, nightmares two to three times per month (content includes being trapped in a crushed vehicle), dissociative flashbacks triggered by the sound of large trucks, and prolonged distress at exposure to related cues. Criterion B is met.

Criterion C (avoidance). She endorsed both avoidance symptoms. She has not driven on I-25 since the collision. She takes a longer alternate route to work. She actively avoids thinking about the collision and declined to review the photographs her attorney had sent her. Criterion C is met.

Criterion D (negative alterations in cognition and mood). She endorsed five of seven symptoms: persistent negative beliefs about herself ("I am not who I used to be"), persistent blame of herself despite evidence the collision was not her fault, persistent negative emotional state (fear, shame), markedly diminished interest in activities she previously enjoyed including hiking and her church's Sunday potluck group, and persistent feelings of detachment from her husband and children that she describes as "being behind glass." Criterion D is met.

Criterion E (alterations in arousal and reactivity). She endorsed five of six symptoms: irritability with her children, hypervigilance in vehicles, exaggerated startle response, concentration difficulties affecting her work performance, and sleep disturbance characterized by difficulty falling asleep and early morning awakening. Criterion E is met.

Criterion F (duration). Symptoms have persisted for more than fifteen months, well beyond the one-month threshold.

Criterion G (functional impairment). Ms. Avila reported a documented performance improvement plan at work, strained relationships with her children, and substantial narrowing of her activities. Criterion G is met.

Criterion H (rule-outs). Her presentation is not attributable to a substance, medication, or another medical condition. Her concussion has clinically resolved per her neurology follow-up.

She did not endorse dissociative symptoms at the level needed for the dissociative specifier.

SYMPTOM VALIDITY

CAPS-5 total severity score: 46 (moderate to severe range).
PCL-5 total: 52 (consistent with the CAPS-5 and well above the 33 screening threshold).
TSI-2 validity scales (ATR, RL): within normal limits, no elevation suggesting exaggeration.
M-FAST total: 2 (no concerns; the threshold for possible feigning is 6).

The validity pattern is consistent with a genuine and substantial symptom presentation. There is no indication of exaggeration or feigning.

DIAGNOSTIC IMPRESSION

Posttraumatic Stress Disorder (F43.10), with delayed expression not endorsed. Specifier: not dissociative. Severity: moderate.

Persistent Depressive Disorder features are present in the context of the PTSD but do not appear to rise to the level of an independent mood disorder diagnosis at this time.

CAUSATION

To a reasonable degree of psychological certainty, the November 4, 2022 motor vehicle collision is a substantial contributing cause of Ms. Avila's current diagnosis of Posttraumatic Stress Disorder. The bases for this opinion are as follows. First, Criterion A is met by the collision itself; this is the only qualifying traumatic exposure in her history. Second, her pre-collision functioning is documented as unremarkable across medical, occupational, and personal domains, with no prior psychiatric treatment. Third, the temporal onset of symptoms immediately follows the collision. Fourth, the specific content of her intrusion symptoms (crushed vehicle, truck sounds, highway) is directly traceable to the collision.

RECOMMENDATIONS

I recommend that Ms. Avila receive evidence-based treatment for PTSD, specifically Prolonged Exposure therapy or Cognitive Processing Therapy with a trauma-focused clinician. I recommend a psychiatric consultation to address her sleep disturbance and consider pharmacological adjuncts. I recommend a graduated return to highway driving with the support of her therapist once PTSD treatment is underway. Based on the moderate severity and the absence of prior psychiatric history, her prognosis with appropriate treatment is fair to good.

Respectfully submitted,

Jordan Whitfield, Psy.D., ABPP
Licensed Psychologist, Colorado
`
};
const WRITING_SAMPLES$1 = [SAMPLE_CST, SAMPLE_PTSD];
const DSM5TR_REFERENCE = {
  filename: "DSM-5-TR_Forensic_Quick_Reference.md",
  title: "DSM-5-TR Forensic Quick Reference",
  content: `# DSM-5-TR Forensic Quick Reference

A condensed reference for diagnostic codes most often encountered in forensic
psychology practice. This file is a starting point, not a substitute for the
full DSM-5-TR text.

## Psychotic Disorders

| Code | Name | Notes |
|------|------|-------|
| F20.9 | Schizophrenia | Specify course (first episode, multiple episodes, continuous) and current severity |
| F25.0 | Schizoaffective, bipolar type | Mood episodes must be concurrent with active phase for a substantial portion |
| F25.1 | Schizoaffective, depressive type | Same concurrence rule |
| F22 | Delusional Disorder | Specify subtype (persecutory, somatic, grandiose, jealous, mixed, unspecified) |
| F23 | Brief Psychotic Disorder | Duration at least 1 day but less than 1 month |
| F06.2 | Psychotic disorder due to another medical condition | Requires documented medical cause |

## Trauma and Stressor-Related

| Code | Name | Notes |
|------|------|-------|
| F43.10 | Posttraumatic Stress Disorder | Specify "with delayed expression" or "with dissociative symptoms" |
| F43.0 | Acute Stress Disorder | 3 days to 1 month post-trauma |
| F43.20 | Adjustment Disorder, unspecified | Onset within 3 months of stressor |
| F43.21 | Adjustment with depressed mood | |
| F43.22 | Adjustment with anxiety | |
| F43.23 | Adjustment with mixed anxiety and depressed mood | |
| F43.24 | Adjustment with disturbance of conduct | |

## Mood Disorders

| Code | Name | Notes |
|------|------|-------|
| F32.x | Major Depressive Disorder, single episode | x specifies severity: .0 mild, .1 moderate, .2 severe, .3 with psychotic features |
| F33.x | Major Depressive Disorder, recurrent | Same severity specifiers |
| F34.1 | Persistent Depressive Disorder (Dysthymia) | Duration at least 2 years |
| F31.x | Bipolar I Disorder | x encodes current episode and severity |
| F31.81 | Bipolar II Disorder | No history of manic episode |

## Anxiety Disorders

| Code | Name | Notes |
|------|------|-------|
| F41.1 | Generalized Anxiety Disorder | Duration at least 6 months |
| F40.0x | Agoraphobia | |
| F40.10 | Social Anxiety Disorder | |
| F41.0 | Panic Disorder | |

## Personality Disorders

| Code | Name | Cluster |
|------|------|---------|
| F60.0 | Paranoid | A |
| F60.1 | Schizoid | A |
| F60.2 | Antisocial | B |
| F60.3 | Borderline | B |
| F60.4 | Histrionic | B |
| F60.5 | Obsessive-Compulsive (Personality) | C |
| F60.6 | Avoidant | C |
| F60.7 | Dependent | C |
| F60.81 | Narcissistic | B |

## Neurodevelopmental

| Code | Name | Notes |
|------|------|-------|
| F90.0 | ADHD, predominantly inattentive | Symptoms before age 12, two or more settings |
| F90.1 | ADHD, predominantly hyperactive-impulsive | |
| F90.2 | ADHD, combined | |
| F70-F73 | Intellectual Disability | F70 mild, F71 moderate, F72 severe, F73 profound |
| F84.0 | Autism Spectrum Disorder | Level 1, 2, or 3 per support needs |

## Substance-Related

Use the F10-F19 series with .10 for mild, .20 for moderate, .21 for moderate
in remission, .20 for severe, etc. Common codes:

- F10.20 Alcohol Use Disorder, moderate
- F11.20 Opioid Use Disorder, moderate
- F14.20 Cocaine Use Disorder, moderate
- F12.20 Cannabis Use Disorder, moderate

## Forensic-Relevant V Codes and Z Codes

- Z65.3 Problems related to other legal circumstances
- Z65.1 Imprisonment or other incarceration
- Z63.0 Relationship distress with spouse or intimate partner
- Z62.820 Parent-child relational problem
- Z91.5 Personal history of self-harm

## Notes on Use in Forensic Reports

Always specify the full diagnostic criterion set met in the body of the
report. A code alone is not sufficient. Note the sources of information
supporting each criterion: interview, records, collateral, testing. Where
criteria are partially met or where differential diagnoses remain live,
document that explicitly rather than forcing a single code.
`
};
const DUSKY_REFERENCE = {
  filename: "Dusky_Standard_and_Key_Case_Law.md",
  title: "Dusky Standard and Key CST Case Law",
  content: `# Dusky Standard and Key Competency to Stand Trial Case Law

## The Dusky Standard

**Dusky v. United States, 362 U.S. 402 (1960)**

The foundational federal competency standard. A defendant must have:

1. **Sufficient present ability to consult with counsel** with a reasonable
   degree of rational understanding, AND
2. A **rational as well as factual understanding** of the proceedings
   against them.

Both prongs must be satisfied. A defendant who can recite facts about court
proceedings but holds delusional beliefs that prevent meaningful consultation
with counsel does not meet Dusky.

## Related Federal Decisions

**Drope v. Missouri, 420 U.S. 162 (1975)**
Expanded Dusky by holding that a defendant must have the capacity to assist
in preparing their defense. Due process requires inquiry whenever evidence
raises a bona fide doubt about competency.

**Godinez v. Moran, 509 U.S. 389 (1993)**
Held that the competency standard for pleading guilty or waiving counsel is
the same as for standing trial. Rejected the argument that a higher standard
applies to waiver of counsel.

**Indiana v. Edwards, 554 U.S. 164 (2008)**
Carved out an exception to Godinez. A trial court may deny self-representation
to a defendant who is competent to stand trial but not competent to conduct
trial proceedings alone. Introduces a "representational competence" standard
that is higher than Dusky.

**Jackson v. Indiana, 406 U.S. 715 (1972)**
A defendant found incompetent may not be held indefinitely awaiting
restoration. The state must either make progress toward restoration within a
reasonable period or begin civil commitment or release the defendant.

**Sell v. United States, 539 U.S. 166 (2003)**
Established the four-factor test for involuntarily medicating a defendant to
restore competency: (1) important governmental interests, (2) medication will
significantly further those interests, (3) necessary to further those
interests, (4) medically appropriate.

**Cooper v. Oklahoma, 517 U.S. 348 (1996)**
Held that states may not require proof of incompetency by clear and
convincing evidence. A preponderance standard is constitutionally required.

## Key Functional Abilities to Assess

Drawing from the federal standard and most state statutes, the examiner
should make factual findings on:

1. **Factual understanding of the proceedings**
   - Identifies the roles of courtroom personnel (judge, prosecutor, defense
     counsel, jury, witnesses)
   - Understands the charges and possible penalties
   - Understands plea options

2. **Rational understanding**
   - Can apply factual knowledge to their own case
   - Is not prevented by delusional or psychotic beliefs from engaging with
     the reality of their situation
   - Can weigh the advice of counsel against alternatives

3. **Capacity to consult with counsel**
   - Can disclose relevant information to their attorney
   - Can track the attorney's questions and provide coherent answers
   - Can tolerate the stress of the courtroom
   - Can make reasoned decisions about plea, defense strategy, and testimony

## Jurisdictional Considerations

Many states have codified Dusky with additional functional abilities. Verify
the applicable statute for the jurisdiction at the start of each evaluation.
Colorado, for example, uses C.R.S. 16-8.5-101 through 16-8.5-123 and
enumerates specific abilities the examiner must address.
`
};
const DAUBERT_REFERENCE = {
  filename: "Daubert_Frye_and_Expert_Testimony.md",
  title: "Daubert, Frye, and Expert Testimony Admissibility",
  content: `# Daubert, Frye, and Expert Testimony Admissibility

Two distinct standards govern the admissibility of expert psychological
testimony in the United States. The applicable standard depends on the
jurisdiction. Know which one governs your case before testifying.

## Frye (older standard)

**Frye v. United States, 293 F. 1013 (D.C. Cir. 1923)**

The "general acceptance" test. Expert testimony is admissible only if the
principle or method on which it is based is generally accepted in the
relevant scientific community.

**Still the standard in:** California, Illinois, Maryland, Minnesota, New
Jersey, New York, Pennsylvania, Washington, and a handful of other states.
These states have either expressly rejected Daubert or have not yet adopted
it.

## Daubert (federal standard and most states)

**Daubert v. Merrell Dow Pharmaceuticals, 509 U.S. 579 (1993)**
**General Electric Co. v. Joiner, 522 U.S. 136 (1997)**
**Kumho Tire Co. v. Carmichael, 526 U.S. 137 (1999)**

Known as the "Daubert trilogy." Replaced Frye in federal court and in the
majority of states. The trial judge acts as a "gatekeeper" and assesses both
the relevance and reliability of proposed expert testimony.

Daubert factors (non-exhaustive, not a rigid checklist):

1. Has the theory or technique been **tested**?
2. Has it been **subject to peer review and publication**?
3. What is the **known or potential error rate**?
4. Are there **standards controlling the technique's operation**?
5. Has the theory or technique gained **general acceptance** in the relevant
   scientific community?

Kumho extended Daubert to all expert testimony, including non-scientific
experience-based testimony. The same gatekeeping applies to a forensic
psychologist offering a clinical opinion as to an engineer offering a
failure analysis.

## Federal Rule of Evidence 702 (as amended)

Codifies the Daubert trilogy. A witness qualified as an expert by knowledge,
skill, experience, training, or education may testify if:

(a) the expert's scientific, technical, or other specialized knowledge will
    help the trier of fact;
(b) the testimony is based on sufficient facts or data;
(c) the testimony is the product of reliable principles and methods;
(d) the expert has reliably applied the principles and methods to the facts
    of the case.

The 2023 amendment to Rule 702 made explicit that the proponent of expert
testimony must demonstrate each of these requirements by a preponderance.

## Implications for Forensic Psychology

- **Know your methodology.** Be prepared to explain on the stand why you
  chose the tests and interview methods you used and why they are reliable.
- **Use validated instruments.** A test with published psychometric
  properties, peer-reviewed validation, and known error rates is far more
  defensible than an ad hoc interview technique.
- **Document your work.** A clear audit trail from raw data to final opinion
  is the best defense against a Daubert challenge.
- **Match the standard.** Testimony that would pass Daubert may still fail
  Frye if it lacks general acceptance. The reverse is rare but possible.
- **Stay within your discipline.** Opinions about malingering and symptom
  validity are more likely to survive gatekeeping than global opinions about
  witness credibility, which are typically excluded as invading the province
  of the jury.
`
};
const APA_GUIDELINES = {
  filename: "APA_Specialty_Guidelines_Forensic.md",
  title: "APA Specialty Guidelines for Forensic Psychology, Summary",
  content: `# Specialty Guidelines for Forensic Psychology (APA, 2013)

A condensed summary of the American Psychological Association's Specialty
Guidelines for Forensic Psychology (Am Psychol 2013;68:7-19). These are
aspirational guidelines, not enforceable standards, but are frequently cited
in court and in licensing board complaints.

## 1. Responsibilities

**1.01 Integrity.** Forensic practitioners strive for accuracy, impartiality,
fairness, and independence.

**1.02 Impartiality and Fairness.** Avoid partisanship and offer testimony
that fairly represents the data. Do not act as advocates for the retaining
party.

**1.03 Avoiding Conflicts of Interest.** Decline or withdraw from cases in
which a multiple relationship or financial interest may compromise objectivity.

## 2. Competence

**2.01 Scope of Competence.** Practice within the boundaries of your
competence, based on education, training, supervised experience, and
professional experience.

**2.02 Gaining and Maintaining Competence.** Pursue ongoing education. Use
consultation and peer review for complex or unfamiliar matters.

**2.03 Representing Competencies.** Represent your competence accurately to
retaining parties, courts, and the individuals being evaluated.

## 3. Diligence

**3.01 Provision of Services.** Provide services that are prompt, thorough,
and grounded in methods appropriate to the question.

**3.02 Responsiveness.** Communicate promptly with retaining parties, opposing
counsel, and the court as circumstances require.

## 4. Relationships

**4.01 Responsibilities to Retaining Parties.** Understand and clarify your
role at the outset. Clarify whether you are a consultant, a testifying expert,
or a court-appointed neutral.

**4.02 Multiple Relationships.** Avoid multiple relationships that could
impair objectivity. Do not provide therapy and forensic evaluation to the
same person.

**4.03 Provision of Emergency Mental Health Services.** If a forensic
examinee presents an emergency, provide minimum necessary intervention and
make referrals.

## 5. Fees

**5.01 Determining Fees.** Set fees in advance, in writing, and based on
services rendered rather than contingent on outcome.

**5.02 Fee Arrangements.** Contingency fees for forensic work are
impermissible. Retainers are acceptable.

## 6. Informed Consent, Notification, and Assent

**6.01 Informed Consent.** Obtain informed consent when the individual has
the legal capacity to provide it and the retaining party authorizes it.

**6.02 Notification of Non-Confidentiality.** When informed consent is not
required (e.g., court-ordered evaluations), notify the examinee of the
purpose of the evaluation, the limits of confidentiality, and the intended
recipients of the report.

**6.03 Communication with Third Parties.** Understand what information will
be disclosed to whom and communicate this to the examinee.

## 7. Conflicts in Practice

**7.01 Conflicts with Legal Authority.** When legal requirements conflict
with ethical principles, attempt to resolve the conflict in a way consistent
with the Ethics Code.

## 8. Privacy, Confidentiality, and Privilege

**8.01 Release of Information.** Respect applicable privilege. Do not release
information without appropriate authorization or legal compulsion.

**8.02 Access to Information.** Retain records consistent with professional
standards and legal requirements.

## 9. Methods and Procedures

**9.01 Use of Appropriate Methods.** Select methods that are reliable, valid,
and relevant to the psycho-legal questions.

**9.02 Use of Multiple Sources of Information.** Whenever feasible, use
multiple methods and sources. Do not rely on a single method for a
consequential opinion.

**9.03 Opinions Regarding Persons Not Examined.** Avoid offering opinions
about the psychological characteristics of individuals you have not personally
examined, except in circumstances where such opinions are explicitly offered
as hypothetical.

## 10. Assessment

**10.01 Focus on Legally Relevant Factors.** Scope assessments to the
psycho-legal question. Avoid gratuitous characterizations.

**10.02 Selection and Use of Assessment Procedures.** Use instruments that
are appropriate to the examinee and the psycho-legal question, and that have
adequate psychometric properties for forensic use.

**10.03 Appreciation of Individual Differences.** Consider cultural,
linguistic, developmental, and contextual factors in assessment and
interpretation.

## 11. Professional and Other Public Communications

**11.01 Accuracy, Fairness, and Avoidance of Deception.** Communicate opinions
accurately and avoid misleading statements or inferences.

**11.02 Differentiating Observations, Inferences, and Conclusions.** Distinguish
clearly between what was observed, what was inferred, and what was concluded.

**11.03 Disclosing Sources of Information and Bases of Opinions.** Identify
the sources and methods on which opinions rest. Disclose limitations.

**11.04 Comprehensive and Accurate Presentation of Opinions in Reports and
Testimony.** Present all reasonable bases for opinions and address data that
does not support the conclusions.

## Using This Document

Treat these guidelines as a minimum standard of practice. When in doubt
about a case, consult a peer with forensic experience, document the
consultation, and proceed conservatively.
`
};
const HIPAA_FORENSIC = {
  filename: "HIPAA_Minimum_Necessary_Forensic_Context.md",
  title: "HIPAA Minimum Necessary Standard in Forensic Contexts",
  content: `# HIPAA Minimum Necessary Standard in Forensic Contexts

Forensic psychology practice sits at a difficult intersection of HIPAA
privacy rules and the duty to produce a full report to the court. This
document outlines the practical compliance approach used at this practice.

## The Minimum Necessary Rule

45 CFR 164.502(b) requires covered entities to make reasonable efforts to
limit the use, disclosure, and request of protected health information (PHI)
to the minimum necessary to accomplish the intended purpose.

In a clinical context this typically means sharing only the PHI relevant to
the specific treatment or payment purpose. In a forensic context the
"intended purpose" is defined by the court order, the retention agreement,
or the referral question.

## Releases and Authorizations

**Court-ordered evaluations.** A court order that specifically names the
examinee and the scope of the evaluation satisfies the HIPAA disclosure
requirement. 45 CFR 164.512(e) allows disclosure in response to an order
of a court or administrative tribunal without separate authorization.

**Attorney-retained evaluations.** When retained by defense counsel for a
criminal case or by either side in a civil case, obtain a written HIPAA
authorization from the examinee (or their guardian) before requesting
records from third parties. The authorization should specify the records
sought, the providers, the purpose, and an expiration date.

**Requests from opposing counsel.** Do not release records to opposing
counsel without either (a) a signed authorization from the examinee, (b) a
subpoena accompanied by satisfactory assurance under 45 CFR 164.512(e)(1)(ii),
or (c) a court order.

## What Goes in the Report

Reports produced for the court are not protected by HIPAA in the usual
sense because the court is the intended recipient. However, the minimum
necessary principle still applies to the *content*. Include only PHI that
bears on the psycho-legal question. Historical details unrelated to the
referral question should be summarized at a high level or omitted.

Example: a CST evaluation should note relevant psychiatric history but
should not include the examinee's childhood medical history unless it
bears on the competency question. A custody evaluation should note mental
health information relevant to parenting capacity but should not include a
parent's history of an unrelated sexually transmitted infection from
twenty years ago.

## Psychotherapy Notes

Psychotherapy notes held by any psychotherapist are subject to a higher
standard of protection under 45 CFR 164.508(a)(2). A separate authorization
is required, and a court order for medical records does not typically
cover psychotherapy notes. Request these only when specifically required
and with a separate authorization or court order explicitly addressing
them.

## The Psygil Local-First Architecture

This application keeps all patient data encrypted on the local machine.
PHI never leaves the application unless the clinician explicitly exports
a report or copies text to the clipboard. When the application communicates
with the Claude API for draft generation, all PHI is replaced with
single-use opaque tokens (UNIDs) before transmission; the tokens are
rehydrated locally after the response is received, and the mapping is
destroyed at the end of each operation.

This architecture is designed to keep the practice compliant with HIPAA
Safe Harbor under 45 CFR 164.514(b). However, the clinician remains the
covered entity and is ultimately responsible for compliance. Review any
third-party integration (cloud storage, practice management software,
billing services) separately with compliance counsel before enabling it.

## Business Associate Agreements

If you use any cloud service that stores PHI on your behalf (e.g., Google
Workspace, Microsoft 365, Dropbox Business), you must have a signed Business
Associate Agreement (BAA) with that vendor before storing any patient data
in their service. A BAA is not required for Psygil itself because the
application runs entirely on your local machine and does not receive,
create, maintain, or transmit PHI on your behalf.

## Record Retention

Consult your state licensing board and your malpractice carrier for the
applicable retention period. Many states require retention of forensic
records for at least the longer of (a) seven years after the date of
service, or (b) until any minor examinee reaches the age of majority plus
the statute of limitations. Colorado requires at least seven years.

## Incident Response

If you suspect a breach of PHI (stolen laptop, unauthorized access,
accidental disclosure), follow these steps:

1. Contain the breach if possible
2. Document what happened, when, and what data was involved
3. Assess the risk of compromise per 45 CFR 164.402
4. Notify affected individuals within 60 days if the breach meets the
   definition under the Breach Notification Rule
5. Notify HHS via the breach portal if the breach involves fewer than
   500 individuals (annually) or immediately if 500 or more
6. Consult with privacy counsel before making notifications

Do not wait until a breach to develop your incident response plan. Write
it down and review it annually.
`
};
const TARASOFF_REFERENCE = {
  filename: "Tarasoff_Duty_to_Warn_and_Protect.md",
  title: "Tarasoff: Duty to Warn and Protect",
  content: `# Tarasoff Duty to Warn and Protect

A brief reference for the clinician's obligation when a patient or examinee
communicates a credible threat against an identifiable third party.

## Origin

**Tarasoff v. Regents of the University of California, 17 Cal. 3d 425 (1976)**

Established that a psychotherapist has a duty to exercise reasonable care to
protect a foreseeable victim of their patient. The case involved a university
counselor who was told by a patient of an intent to kill a named individual
(Tatiana Tarasoff) and did not warn her. She was killed.

The California Supreme Court held: "When a therapist determines, or pursuant
to the standards of his profession should determine, that his patient
presents a serious danger of violence to another, he incurs an obligation to
use reasonable care to protect the intended victim against such danger."

## Scope of the Duty

The Tarasoff duty has been adopted in some form by most states, either by
statute or by case law. The scope varies:

- Some states require a clear identified or identifiable victim
- Some states require an imminent threat
- Some states permit but do not require warning
- A few states (including Texas and Virginia) have rejected the Tarasoff
  duty in favor of confidentiality

**Always verify the law in your jurisdiction at the start of any forensic
or clinical engagement.**

## Discharging the Duty

Courts have recognized several ways to discharge the duty:

1. Warn the intended victim directly
2. Warn someone likely to notify the victim (a close family member)
3. Notify law enforcement
4. Take steps to have the patient involuntarily hospitalized if they meet
   civil commitment criteria
5. Any combination of the above appropriate to the circumstances

The standard is reasonable care, not a guarantee of protection.

## Forensic Context

Forensic evaluations present unique Tarasoff questions. The examinee is
typically not your patient; no therapeutic relationship exists. Nevertheless,
most jurisdictions extend some duty to warn or protect to forensic examiners
who learn of a credible threat during an evaluation.

Practical guidance:
- Disclose the limits of confidentiality at the outset, including that
  threats against identifiable persons may be reported
- Document any threats with the specific language used, the date, and the
  context
- Consult immediately with your professional liability carrier and
  forensic peer before taking action on an ambiguous threat
- Err on the side of the legal duty when in doubt

## Threat Assessment versus Risk Assessment

A Tarasoff trigger is distinct from a general violence risk assessment.
Tarasoff concerns a specific communicated threat against an identified
person. A risk assessment is a structured appraisal of the likelihood of
future violence based on static and dynamic factors. A clinician may have
Tarasoff duties even in the absence of a formal risk assessment, and may
conduct a risk assessment without ever triggering Tarasoff.

## What Not to Do

- Do not conceal a credible threat in the name of confidentiality
- Do not act alone on a complex threat; consult immediately
- Do not warn a third party unless necessary to discharge the duty
- Do not include speculative threats in routine reports without careful
  consideration of the consequences
- Do not assume that informed consent to the forensic evaluation alone is
  sufficient to waive all confidentiality
`
};
const DOCUMENT_FILES = [
  DSM5TR_REFERENCE,
  DUSKY_REFERENCE,
  DAUBERT_REFERENCE,
  APA_GUIDELINES,
  HIPAA_FORENSIC,
  TARASOFF_REFERENCE
];
const MMPI3 = {
  filename: "MMPI-3_Scoring_Quick_Reference.md",
  instrument: "MMPI-3",
  content: `# MMPI-3 Scoring Quick Reference

The Minnesota Multiphasic Personality Inventory, 3 (Ben-Porath & Tellegen,
2020) is a 335-item self-report inventory with 52 substantive scales and
10 validity scales. This reference covers forensic-relevant scales and
cutoffs.

## Administration

- 335 true/false items
- Reading level: 4.5 grade
- Administration time: 25-50 minutes
- Age range: 18-80
- Paper, computer, or Q-global administration

## Validity Scales

| Scale | Name | Interpretation at elevated T |
|-------|------|-----------------------------|
| CNS | Cannot Say | >=15 items: profile interpretation questionable |
| VRIN-r | Variable Response Inconsistency | T>=80: random/inconsistent responding |
| TRIN-r | True Response Inconsistency | T>=80F (fixed false) or T>=80T (fixed true) |
| F-r | Infrequent Responses | T>=120: consider overreporting or severe psychopathology |
| Fp-r | Infrequent Psychopathology Responses | T>=100: strong indicator of overreporting |
| Fs | Infrequent Somatic Responses | T>=100: overreporting of somatic symptoms |
| FBS-r | Symptom Validity | T>=100: noncredible symptom reporting |
| RBS | Response Bias Scale | T>=100: overreporting of cognitive symptoms |
| L-r | Uncommon Virtues | T>=80: underreporting, defensive responding |
| K-r | Adjustment Validity | T>=70: defensive, T<=35: overreporting |

## Higher-Order Scales

- **EID** (Emotional/Internalizing Dysfunction)
- **THD** (Thought Dysfunction)
- **BXD** (Behavioral/Externalizing Dysfunction)

Elevations (T>=65) indicate dysfunction in the respective domain.

## Restructured Clinical Scales

- **RCd** (Demoralization)
- **RC1** (Somatic Complaints)
- **RC2** (Low Positive Emotions)
- **RC3** (Cynicism)
- **RC4** (Antisocial Behavior)
- **RC6** (Ideas of Persecution)
- **RC7** (Dysfunctional Negative Emotions)
- **RC8** (Aberrant Experiences)
- **RC9** (Hypomanic Activation)

Interpret T-scores:
- T<=38: Low (may reflect absence of problem or denial)
- T 39-64: Within normal limits
- T 65-79: Moderate elevation (clinically significant)
- T>=80: Marked elevation

## Specific Problems Scales

Organized into five domains: Somatic/Cognitive, Internalizing, Externalizing,
Interpersonal, and Interest. Consult the manual for individual scale
interpretation. Use in conjunction with the RC scales, not as stand-alone
interpretations.

## Personality Psychopathology Five (PSY-5)

- AGGR-r (Aggressiveness)
- PSYC-r (Psychoticism)
- DISC-r (Disconstraint)
- NEGE-r (Negative Emotionality/Neuroticism)
- INTR-r (Introversion/Low Positive Emotionality)

## Forensic Use Notes

- The MMPI-3 is routinely admissible in federal and state courts
- Score reports alone are not clinical interpretations; always integrate
  with interview, records, and collateral
- Validity scales are the first line of defense against feigning; do not
  interpret substantive scales without first clearing validity
- Be cautious with interpretation when CNS > 10 or when VRIN-r/TRIN-r T
  scores exceed 80
- Publisher: Pearson Clinical Assessments
`
};
const PAI = {
  filename: "PAI_Scoring_Quick_Reference.md",
  instrument: "PAI",
  content: `# PAI Scoring Quick Reference

The Personality Assessment Inventory (Morey, 1991, 2007) is a 344-item
self-report inventory with 22 non-overlapping scales. Widely used in
forensic practice.

## Administration

- 344 items on a 4-point scale (False, Slightly True, Mainly True, Very True)
- Reading level: 4th grade
- Administration time: 40-50 minutes
- Age range: 18+

## Validity Scales

| Scale | Name | Cutoff |
|-------|------|--------|
| ICN | Inconsistency | T>=73: inconsistent responding |
| INF | Infrequency | T>=75: random or careless |
| NIM | Negative Impression | T>=84: overreporting, consider feigning |
| PIM | Positive Impression | T>=68: defensive, underreporting |

Supplementary indices:
- **Rogers Discriminant Function (RDF)**: feigning of mental disorder
- **Malingering Index (MAL)**: feigning of psychiatric symptoms
- **Defensiveness Index (DEF)**: defensive profile

## Clinical Scales

Eleven clinical scales, grouped by content area:

**Neurotic Spectrum**
- SOM (Somatic Complaints), T>=70 clinically significant
- ANX (Anxiety)
- ARD (Anxiety-Related Disorders)
- DEP (Depression)

**Psychotic Spectrum**
- MAN (Mania)
- PAR (Paranoia)
- SCZ (Schizophrenia)

**Behavioral/Impulse Control**
- BOR (Borderline Features)
- ANT (Antisocial Features)
- ALC (Alcohol Problems)
- DRG (Drug Problems)

## Treatment Scales

- AGG (Aggression)
- SUI (Suicidal Ideation)
- STR (Stress)
- NON (Nonsupport)
- RXR (Treatment Rejection)

## Interpersonal Scales

- DOM (Dominance)
- WRM (Warmth)

## Interpretation Ranges

- T<60: Within normal limits
- T 60-69: Mild elevation
- T 70-84: Marked elevation, clinically significant
- T>=85: Severe elevation

## Forensic Use Notes

- The PAI's validity indices (NIM, PIM, RDF, MAL) make it a workhorse for
  forensic assessment
- The Morey Validity Indices should be consulted in every forensic PAI
- NIM elevations alone do not establish feigning; integrate with RDF, MAL,
  and external evidence
- Publisher: PAR, Inc.
`
};
const TOMM = {
  filename: "TOMM_Scoring_Guide.md",
  instrument: "TOMM",
  content: `# TOMM Scoring Guide

The Test of Memory Malingering (Tombaugh, 1996) is a 50-item visual
recognition test designed to discriminate between genuine memory impairment
and feigned memory impairment. It is a stand-alone performance validity
test and one of the most widely used PVTs in forensic practice.

## Administration

- 50 line drawings of common objects, presented twice (Trial 1 and Trial 2)
- Optional Retention Trial after 15-20 minute delay
- Forced-choice recognition: for each test item, the examinee picks between
  the studied item and a foil
- Administration time: about 15 minutes including the delay
- Age range: 16+

## Cutoffs

| Trial | Score | Interpretation |
|-------|-------|----------------|
| Trial 2 | <45 | Below chance-adjusted cutoff. Indicates possible feigning. |
| Trial 2 | 45-49 | Borderline; consider other PVTs and the full clinical picture |
| Trial 2 | 50 | No concerns on this measure |
| Retention | <45 | Same as Trial 2 |

The Trial 2 cutoff of <45 was derived from a normative sample including
patients with cognitive impairment. Genuine dementia patients typically
score at or above 45; performance below that level in the absence of
severe cognitive impairment raises validity concerns.

## Interpretation Principles

1. **Never rely on the TOMM alone.** A failed TOMM in isolation does not
   establish malingering. Use at least two PVTs before reaching a
   performance validity conclusion.

2. **Consider the clinical context.** Below-cutoff performance in a
   cooperative examinee with severe dementia may reflect genuine impairment.
   The Slick et al. (1999) criteria require external incentive and other
   evidence to support a definite determination.

3. **Chance-level or below-chance performance** (i.e., <25/50 on Trial 2)
   is strong evidence of non-credible performance. Random responding by an
   examinee attempting to appear impaired produces scores clustering at 25.

4. **Document verbatim.** Record the exact instructions given, any deviations
   from standard administration, and the examinee's behavior during the
   test.

## Forensic Use Notes

- Well-validated in forensic, neuropsychological, and disability samples
- Effort cutoffs are independent of education and most demographic factors
- Publisher: Multi-Health Systems (MHS)
- See Slick, Sherman, and Iverson (1999) for the full Malingered
  Neurocognitive Dysfunction criteria framework
`
};
const HCR20 = {
  filename: "HCR-20v3_Item_Summary.md",
  instrument: "HCR-20v3",
  content: `# HCR-20v3 Item Summary

The Historical Clinical Risk Management-20, Version 3 (Douglas, Hart,
Webster, & Belfrage, 2013) is a structured professional judgment tool for
violence risk assessment. It organizes risk factors into three domains
and produces a qualitative summary judgment rather than a numerical
probability.

## Scoring

Each of the 20 items is rated on three dimensions:

- **Presence:** N (not present), P (possibly present), Y (yes, present)
- **Relevance:** N, P, Y (the relevance of the item to THIS examinee's
  risk in THIS context)
- **Sub-indicators:** any item may have specific sub-items the examiner
  documents

The HCR-20v3 does NOT produce a total score. The examiner forms a
summary risk judgment after considering all items, case formulation, and
scenario planning.

## Historical Items (H1-H10)

Unchanging, retrospective factors.

1. **H1 Violence**, History of violence (including childhood)
2. **H2 Other antisocial behavior**, Non-violent criminal behavior
3. **H3 Relationships**, Pattern of relationship instability
4. **H4 Employment**, Pattern of employment problems
5. **H5 Substance use**, History of substance use problems
6. **H6 Major mental disorder**, History of psychosis, mood disorder, etc.
7. **H7 Personality disorder**, History of personality disorder with
   violence-relevant features (antisocial, psychopathic, borderline)
8. **H8 Traumatic experiences**, Victimization, adverse childhood experiences
9. **H9 Violent attitudes**, History of attitudes supportive of violence
10. **H10 Treatment or supervision response**, History of poor response

## Clinical Items (C1-C5)

Current, dynamic factors reflecting the examinee's present clinical
state.

1. **C1 Insight**, Into illness, into risk, into need for treatment
2. **C2 Violent ideation or intent**, Current fantasies or plans
3. **C3 Symptoms of major mental disorder**, Current active symptoms
4. **C4 Instability**, Emotional, behavioral, cognitive instability
5. **C5 Treatment or supervision response**, Current engagement

## Risk Management Items (R1-R5)

Prospective factors in the anticipated living situation.

1. **R1 Professional services and plans**, Availability and adequacy
2. **R2 Living situation**, Stability, safety
3. **R3 Personal support**, Quality and availability
4. **R4 Treatment or supervision response**, Expected response
5. **R5 Stress or coping**, Stressors in anticipated environment

## Case Formulation

The examiner develops a case formulation integrating the rated items to
answer:

1. Who is at risk? (specific victims or categories)
2. What kind of violence? (instrumental, reactive, sexual, etc.)
3. When and where? (context-dependent)
4. How severe? (likely physical harm)

## Summary Risk Judgment

The examiner makes a qualitative judgment of risk for the specified time
frame and setting, classified as:

- **Low**: Routine management sufficient
- **Moderate**: Enhanced monitoring and intervention warranted
- **High**: Intensive management, treatment, and monitoring

The judgment must be tied to the formulation. A numerical score alone is
NOT the product of an HCR-20v3 assessment.

## Forensic Use Notes

- The HCR-20v3 is a structured professional judgment instrument; it does
  not produce actuarial probabilities
- Training in the instrument is required for competent use
- Admissible in most jurisdictions under Daubert and Frye as a generally
  accepted structured risk assessment approach
- Publisher: Mental Health Law and Policy Institute, Simon Fraser University
`
};
const CAPS5 = {
  filename: "CAPS-5_Administration_Guide.md",
  instrument: "CAPS-5",
  content: `# CAPS-5 Administration Guide

The Clinician-Administered PTSD Scale for DSM-5 (Weathers et al., 2013) is
a 30-item structured interview that is the gold-standard assessment for
PTSD diagnosis and severity.

## Structure

- 30 items corresponding to the 20 DSM-5 PTSD symptoms plus four associated
  features (dissociation, guilt, trauma-related dissociation, etc.)
- Prompts elicit both frequency and intensity for each symptom
- Administration time: 45-60 minutes
- Training is required for reliable administration

## Rating Scale

Each symptom is rated on a 5-point severity scale:

- **0** Absent
- **1** Mild (minimal effect on functioning)
- **2** Moderate (clearly present, some impact)
- **3** Severe (marked impact)
- **4** Extreme (pervasive, incapacitating)

Severity ratings combine frequency and intensity. A rating of 2 or higher
on a given symptom is considered clinically significant for diagnostic
scoring.

## Diagnostic Scoring

A symptom is "endorsed" for diagnostic purposes when:
- Severity >= 2, AND
- The symptom meets DSM-5 duration and functional impairment criteria

PTSD diagnosis requires:
- Criterion A: direct exposure to qualifying traumatic event
- Criterion B: >=1 intrusion symptom (items 1-5)
- Criterion C: >=1 avoidance symptom (items 6-7)
- Criterion D: >=2 negative alterations in cognition and mood (items 8-14)
- Criterion E: >=2 alterations in arousal and reactivity (items 15-20)
- Criterion F: duration >1 month
- Criterion G: clinically significant distress or impairment
- Criterion H: not attributable to substance or medical condition

## Severity Score Ranges

CAPS-5 total severity (sum of all item severity scores):

| Range | Interpretation |
|-------|----------------|
| 0-19 | Asymptomatic / few symptoms |
| 20-39 | Mild PTSD / subthreshold |
| 40-59 | Moderate PTSD |
| 60-79 | Severe PTSD |
| 80+ | Extreme PTSD |

These ranges are approximate and should be interpreted in context. Use the
diagnostic scoring rules, not the total severity score, to determine
diagnostic status.

## Subtype Specifiers

- **With dissociative symptoms:** Endorsement of either item 29
  (depersonalization) or item 30 (derealization) at severity >=2, in
  addition to meeting full PTSD criteria
- **With delayed expression:** Full diagnostic criteria not met until at
  least six months after the trauma

## Forensic Use Notes

- The CAPS-5 is the most widely accepted PTSD diagnostic instrument in
  forensic practice
- Administer ONCE the index trauma has been clearly identified; running
  the full interview with no identified Criterion A event is inappropriate
- Always combine with a validated symptom validity measure (PCL-5 plus MMPI-3
  validity scales, for example) in forensic contexts
- Available free of charge from the National Center for PTSD to qualified
  professionals at ptsd.va.gov
- Specific training videos and scoring workshops are available through the
  National Center for PTSD
`
};
const PCLR = {
  filename: "PCL-R_Scoring_Criteria.md",
  instrument: "PCL-R",
  content: `# PCL-R Scoring Criteria

The Psychopathy Checklist, Revised (Hare, 2003) is a 20-item rating scale
for the assessment of psychopathy. It is scored from a semi-structured
interview and a thorough record review. It is NOT a self-report instrument.

## Administration

- Requires formal training (typically a 2-3 day workshop)
- Semi-structured interview (1-2 hours)
- Extensive collateral record review is REQUIRED; scoring without records
  is not permitted per the manual
- Administration + scoring time: 3-6 hours

## Items and Factors

The 20 items load onto four facets organized in two factors plus two items
that do not load on a factor.

### Factor 1: Interpersonal/Affective

**Facet 1: Interpersonal**
- Item 1 Glibness/Superficial Charm
- Item 2 Grandiose Sense of Self-Worth
- Item 4 Pathological Lying
- Item 5 Conning/Manipulative

**Facet 2: Affective**
- Item 6 Lack of Remorse or Guilt
- Item 7 Shallow Affect
- Item 8 Callous/Lack of Empathy
- Item 16 Failure to Accept Responsibility

### Factor 2: Social Deviance

**Facet 3: Lifestyle**
- Item 3 Need for Stimulation/Proneness to Boredom
- Item 9 Parasitic Lifestyle
- Item 13 Lack of Realistic, Long-Term Goals
- Item 14 Impulsivity
- Item 15 Irresponsibility

**Facet 4: Antisocial**
- Item 10 Poor Behavioral Controls
- Item 12 Early Behavioral Problems
- Item 18 Juvenile Delinquency
- Item 19 Revocation of Conditional Release
- Item 20 Criminal Versatility

### Items Not Loading on a Factor
- Item 11 Promiscuous Sexual Behavior
- Item 17 Many Short-Term Marital Relationships

## Scoring

Each item is rated:
- **0** Does not apply
- **1** Applies to some extent
- **2** Definitely applies

Total score range: 0-40

## Interpretation

The PCL-R does NOT produce a categorical diagnosis. It produces a
dimensional score reflecting the presence and severity of psychopathic
features.

Common cutoffs:
- **30 or higher**: Research cutoff for classification as "psychopathic"
  in North American samples; used in most PCL-R research
- **25 or higher**: Sometimes used in European samples
- **0-19**: Generally non-psychopathic range
- **20-29**: Intermediate/"mixed" range

Cutoffs should NEVER be applied mechanically in forensic reports. Present
the total and facet scores, describe the items that were rated as present,
and offer an interpretation in the specific context of the psycho-legal
question.

## Forensic Use Notes

- Highly admissible under Daubert and Frye
- Frequently used in sexually violent predator proceedings, parole
  decisions, and treatment planning
- Training and supervision are essential; the manual requires raters to
  establish interrater reliability before independent use
- The PCL:SV (Screening Version) is available for shorter assessments but
  produces a less reliable score
- Publisher: Multi-Health Systems (MHS)
- Score interpretation should be cautious, especially at the high end; a
  high PCL-R score does not by itself predict future violence
`
};
const WAIS = {
  filename: "WAIS-V_Subtest_Reference.md",
  instrument: "WAIS-V",
  content: `# WAIS-V Subtest Reference

The Wechsler Adult Intelligence Scale, Fifth Edition is the standard
individually administered measure of adult cognitive functioning for
examinees aged 16 years through 90.

## Composite Scores

The WAIS-V produces a Full Scale IQ (FSIQ) and five index scores:

- **VCI** Verbal Comprehension Index
- **VSI** Visual Spatial Index
- **FRI** Fluid Reasoning Index
- **WMI** Working Memory Index
- **PSI** Processing Speed Index

Composite score mean = 100, SD = 15.

## Classification (by composite score)

| Range | Classification |
|-------|----------------|
| 130+ | Extremely High |
| 120-129 | Very High |
| 110-119 | High Average |
| 90-109 | Average |
| 80-89 | Low Average |
| 70-79 | Very Low |
| <=69 | Extremely Low |

Report both the standard score and the 95% confidence interval. Never
report an FSIQ without also reporting the index scores and commenting on
index variability.

## Subtest Scores

Subtest scores have mean = 10, SD = 3. Classification:

| Range | Classification |
|-------|----------------|
| 16+ | Well above average |
| 13-15 | Above average |
| 8-12 | Average |
| 5-7 | Below average |
| <=4 | Well below average |

## Core Subtests by Index

**VCI**
- Similarities (abstract verbal reasoning)
- Vocabulary (word knowledge, verbal concepts)
- Information (general fund of knowledge), supplemental in some protocols

**VSI**
- Block Design (spatial problem-solving, visual motor)
- Visual Puzzles (mental rotation, spatial reasoning)

**FRI**
- Matrix Reasoning (nonverbal inductive reasoning)
- Figure Weights (quantitative reasoning without reading)

**WMI**
- Digit Span (working memory, attention)
- Picture Span (visual working memory) or Letter-Number Sequencing

**PSI**
- Symbol Search (visual scanning, speed)
- Coding (visual-motor speed, sustained attention)

## Forensic Use Notes

- Use the WAIS-V when a formal IQ assessment is needed for intellectual
  disability determination, competency evaluations involving cognitive
  concerns, or disability claims
- The Flynn effect should be considered in death penalty cases; consult
  the manual and recent case law
- Performance validity testing is required when test results will be used
  forensically; the WAIS-V has embedded validity indicators but should be
  paired with a stand-alone PVT such as the TOMM
- Cultural and linguistic factors matter; use the administration manual's
  guidance for non-native English speakers
- Publisher: Pearson Clinical Assessments
`
};
const TESTING_GUIDES = [
  MMPI3,
  PAI,
  TOMM,
  HCR20,
  CAPS5,
  PCLR,
  WAIS
];
const PRACTICE_HEADER = {
  heading: "Header",
  body: [
    "{{PRACTICE_NAME}}",
    "{{PRACTICE_ADDRESS}}",
    "Phone: {{PRACTICE_PHONE}}"
  ]
};
const SIGNATURE_BLOCK = {
  heading: "Signatures",
  body: [
    "",
    "",
    "________________________________________",
    "Examinee signature                                                       Date",
    "",
    "________________________________________",
    "Witness signature (if required)                                          Date",
    "",
    "________________________________________",
    "{{CLINICIAN_FULL_NAME}}, {{CLINICIAN_CREDENTIALS}}          Date",
    "Licensed Psychologist, {{CLINICIAN_STATE}} #{{CLINICIAN_LICENSE}}"
  ]
};
const FORENSIC_CONSENT = {
  id: "informed_consent_forensic",
  filename: "Informed_Consent_Forensic_Evaluation.docx",
  title: "Informed Consent for Forensic Psychological Evaluation",
  subtitle: "Acknowledgment of Non-Confidential, Court-Involved Examination",
  sections: [
    PRACTICE_HEADER,
    {
      heading: "Nature of This Evaluation",
      body: [
        "You are being asked to participate in a forensic psychological evaluation requested by ________________________ (the referring party). A forensic evaluation is different from ordinary mental health treatment. Its purpose is to address a specific legal question, not to treat you.",
        "",
        "The examiner, {{CLINICIAN_FULL_NAME}}, {{CLINICIAN_CREDENTIALS}}, is a licensed psychologist practicing forensic psychology. The examiner is not your treating therapist and no therapeutic relationship is being created by your participation in this evaluation."
      ]
    },
    {
      heading: "Limits of Confidentiality",
      body: [
        "The usual rules of confidentiality that apply between a mental health provider and a patient DO NOT apply in this evaluation. Information you share during this evaluation may be included in a written report, shared with the referring party, shared with the court, shared with attorneys representing either side in the legal matter, and may become part of the public record in your case.",
        "",
        "The examiner may also testify about information you share in this evaluation if called as a witness in a court proceeding."
      ]
    },
    {
      heading: "Duty to Report",
      body: [
        "If during this evaluation you disclose information about current child abuse, dependent adult abuse, elder abuse, or a serious threat to a specific identifiable person, the examiner may be required by law to report that information to the appropriate authorities or warn the person at risk, regardless of this agreement."
      ]
    },
    {
      heading: "Procedures",
      body: [
        "This evaluation may include: one or more clinical interviews, psychological testing, review of records provided by the referring party or other sources, interviews with collateral informants, and review of any audio or video recordings relevant to the referral question.",
        "",
        "You are not required to answer every question. However, a refusal to participate meaningfully in the evaluation may be noted in the examiner's report and may affect the outcome of the legal matter."
      ]
    },
    {
      heading: "Your Rights",
      body: [
        "1. You have the right to decline to participate in this evaluation.",
        "2. You have the right to consult with your attorney before the evaluation begins.",
        "3. You have the right to take breaks during the evaluation.",
        "4. You have the right to know the purpose of the evaluation and who will receive the report.",
        "5. You have the right to receive a copy of the report through your attorney, subject to court rules and applicable law."
      ]
    },
    {
      heading: "Acknowledgment",
      body: [
        "By signing below, I acknowledge that:",
        "",
        "- I have read or had read to me the above information.",
        "- I have had the opportunity to ask questions.",
        "- I understand that this is a forensic evaluation, not treatment.",
        "- I understand the limits of confidentiality described above.",
        "- I am participating voluntarily (if applicable) or have been ordered by the court to participate (circle one).",
        "- I understand that I may stop the evaluation at any time, though a refusal to continue may be reported."
      ]
    },
    SIGNATURE_BLOCK
  ]
};
const ROI = {
  id: "release_of_information",
  filename: "Authorization_for_Release_of_Information.docx",
  title: "Authorization for Release of Information",
  subtitle: "HIPAA-Compliant Release",
  sections: [
    PRACTICE_HEADER,
    {
      heading: "Patient/Client Information",
      body: [
        "Name: _________________________________________________",
        "Date of Birth: __________________________________________",
        "Other identifying information: __________________________"
      ]
    },
    {
      heading: "Release Authorization",
      body: [
        "I authorize:",
        "",
        "________________________________________ (releasing party)",
        "Address: _______________________________________________",
        "Phone: _________________________________________________",
        "Fax: ___________________________________________________",
        "",
        "to release the following protected health information to:",
        "",
        "{{CLINICIAN_FULL_NAME}}, {{CLINICIAN_CREDENTIALS}}",
        "{{PRACTICE_NAME}}",
        "{{PRACTICE_ADDRESS}}",
        "Phone: {{PRACTICE_PHONE}}"
      ]
    },
    {
      heading: "Specific Information to Be Released",
      body: [
        "Check all that apply:",
        "",
        "[ ] Complete mental health record",
        "[ ] Medical records",
        "[ ] Psychiatric evaluations",
        "[ ] Psychological testing results",
        "[ ] Treatment summaries",
        "[ ] Medication records",
        "[ ] Discharge summaries",
        "[ ] Progress notes",
        "[ ] Other: _________________________________________",
        "",
        "Date range of records: ___________________ to ___________________"
      ]
    },
    {
      heading: "Psychotherapy Notes",
      body: [
        "Release of psychotherapy notes requires a separate authorization under HIPAA (45 CFR 164.508(a)(2)). Check one:",
        "",
        "[ ] I DO authorize release of psychotherapy notes.",
        "[ ] I DO NOT authorize release of psychotherapy notes."
      ]
    },
    {
      heading: "Substance Use Records",
      body: [
        "Records of substance use treatment are protected by 42 CFR Part 2 and require separate authorization. Check one:",
        "",
        "[ ] I DO authorize release of substance use treatment records.",
        "[ ] I DO NOT authorize release of substance use treatment records."
      ]
    },
    {
      heading: "Purpose of Release",
      body: [
        "The information will be used for:",
        "[ ] Forensic psychological evaluation",
        "[ ] Clinical consultation",
        "[ ] Legal proceedings",
        "[ ] Other: _________________________________________"
      ]
    },
    {
      heading: "Expiration",
      body: [
        "This authorization will expire on ______________________ or upon completion of the psychological evaluation, whichever comes first."
      ]
    },
    {
      heading: "Your Rights",
      body: [
        "1. You may revoke this authorization at any time by providing written notice. Revocation will not affect information already released.",
        "2. The releasing party may not condition treatment, payment, enrollment, or eligibility for benefits on your signing this authorization.",
        "3. Information released under this authorization may be redisclosed by the recipient and may no longer be protected by HIPAA.",
        "4. You have the right to a copy of this authorization."
      ]
    },
    SIGNATURE_BLOCK
  ]
};
const NON_CONFIDENTIALITY = {
  id: "notification_non_confidentiality",
  filename: "Notification_of_Non_Confidentiality.docx",
  title: "Notification of Non-Confidentiality",
  subtitle: "Short Form for Court-Ordered Evaluations",
  sections: [
    PRACTICE_HEADER,
    {
      heading: "Notification",
      body: [
        "I, ______________________________ (name), understand the following:",
        "",
        "1. I am participating in a psychological evaluation conducted by {{CLINICIAN_FULL_NAME}}, {{CLINICIAN_CREDENTIALS}}, pursuant to a court order or at the request of ______________________________.",
        "",
        "2. This is a forensic evaluation, not mental health treatment. The examiner is not my therapist.",
        "",
        "3. Information I share during this evaluation is NOT confidential in the way that information shared with a treating therapist would be. A written report will be provided to the court and to the parties to the legal proceeding.",
        "",
        "4. The examiner may be called as a witness and may testify about what I said and what was found during this evaluation.",
        "",
        "5. Exceptions to confidentiality for serious threats to identifiable persons, child abuse, dependent adult abuse, and elder abuse apply and are explained separately as needed.",
        "",
        "6. I have had an opportunity to ask questions about this evaluation and my rights.",
        "",
        "7. I understand that I may choose not to participate, but that my refusal may be reported to the court."
      ]
    },
    SIGNATURE_BLOCK
  ]
};
const FEE_AGREEMENT = {
  id: "fee_agreement",
  filename: "Fee_Agreement_and_Retainer.docx",
  title: "Fee Agreement and Retainer",
  subtitle: "Forensic Psychological Services",
  sections: [
    PRACTICE_HEADER,
    {
      heading: "Parties",
      body: [
        'This Agreement is between {{PRACTICE_NAME}} ("the Practice") and ______________________________ ("the Retaining Party"), dated ______________________________.'
      ]
    },
    {
      heading: "Services",
      body: [
        "The Retaining Party engages the Practice to provide the following forensic psychological services:",
        "",
        "[ ] Records review",
        "[ ] Clinical interview(s) of the examinee",
        "[ ] Collateral interviews",
        "[ ] Psychological testing",
        "[ ] Written report",
        "[ ] Consultation with counsel",
        "[ ] Deposition testimony",
        "[ ] Trial testimony",
        "[ ] Other: _________________________________________"
      ]
    },
    {
      heading: "Fees",
      body: [
        "The Practice charges at the following rates:",
        "",
        "| Service                            | Rate                    |",
        "| ---------------------------------- | ----------------------- |",
        "| Records review, interviews, report | $______ per hour        |",
        "| Deposition testimony               | $______ per hour, 4 hr min |",
        "| Trial testimony                    | $______ per day, 1 day min |",
        "| Travel (door to door)              | $______ per hour        |",
        "| Mileage                            | Current IRS rate        |",
        "",
        "Fees are NOT contingent on the outcome of the case. Psygil professionals do not accept contingency arrangements for forensic work, consistent with the APA Specialty Guidelines for Forensic Psychology."
      ]
    },
    {
      heading: "Retainer",
      body: [
        "An initial retainer of $______________________ is due at the time this Agreement is signed. The Practice will bill against the retainer at the rates above and provide periodic statements. If the retainer is exhausted, an additional retainer will be required before the Practice continues work."
      ]
    },
    {
      heading: "Cancellation of Testimony",
      body: [
        "If deposition or trial testimony is scheduled and then cancelled with less than ______ business days notice, the full scheduled fee is due."
      ]
    },
    {
      heading: "Records",
      body: [
        "The Practice will retain its records consistent with state and federal record retention requirements. Copies may be provided upon written request and payment of reproduction costs."
      ]
    },
    {
      heading: "Limitations",
      body: [
        "The Practice does not guarantee any particular outcome. The Practice will provide honest, independent opinions based on the data, which may or may not favor the Retaining Party's position."
      ]
    },
    SIGNATURE_BLOCK
  ]
};
const COLLATERAL_CONSENT = {
  id: "collateral_contact_consent",
  filename: "Collateral_Contact_Consent.docx",
  title: "Consent for Collateral Contact",
  subtitle: "Authorization for the Examiner to Interview Third Parties",
  sections: [
    PRACTICE_HEADER,
    {
      heading: "Purpose",
      body: [
        "Collateral interviews with people who know you can help the examiner prepare a thorough and accurate report. This form authorizes {{CLINICIAN_FULL_NAME}}, {{CLINICIAN_CREDENTIALS}} to contact specific individuals and discuss relevant information."
      ]
    },
    {
      heading: "Authorized Contacts",
      body: [
        "I authorize the examiner to contact the following individuals:",
        "",
        "1. Name: _________________________________________________",
        "   Relationship: __________________________________________",
        "   Phone: ________________________________________________",
        "",
        "2. Name: _________________________________________________",
        "   Relationship: __________________________________________",
        "   Phone: ________________________________________________",
        "",
        "3. Name: _________________________________________________",
        "   Relationship: __________________________________________",
        "   Phone: ________________________________________________",
        "",
        "4. Name: _________________________________________________",
        "   Relationship: __________________________________________",
        "   Phone: ________________________________________________"
      ]
    },
    {
      heading: "Scope",
      body: [
        "The examiner may discuss with the above individuals:",
        "",
        "[ ] General observations about me",
        "[ ] My behavior and functioning",
        "[ ] My relationships with others",
        "[ ] My mental health history as known to them",
        "[ ] Events relevant to the evaluation",
        "[ ] Other: _________________________________________",
        "",
        "Information obtained from these contacts may be included in the examiner's written report and may be disclosed as described in the Informed Consent for Forensic Evaluation form."
      ]
    },
    {
      heading: "Revocation",
      body: [
        "I may revoke this authorization at any time by providing written notice to the examiner. Revocation will not affect information already gathered."
      ]
    },
    SIGNATURE_BLOCK
  ]
};
const BLANK_FORMS = [
  FORENSIC_CONSENT,
  ROI,
  NON_CONFIDENTIALITY,
  FEE_AGREEMENT,
  COLLATERAL_CONSENT
];
function loadDocx() {
  const m = require("docx");
  return {
    Document: m.Document,
    Packer: m.Packer,
    Paragraph: m.Paragraph,
    HeadingLevel: m.HeadingLevel,
    TextRun: m.TextRun,
    AlignmentType: m.AlignmentType
  };
}
function applySectionTokens(section, tokens) {
  return {
    heading: applyTokens(section.heading, tokens),
    body: section.body.map((line) => applyTokens(line, tokens))
  };
}
async function renderFormDocx(form, tokens) {
  const docx = loadDocx();
  const { Document: Document2, Packer: Packer2, Paragraph: Paragraph2, HeadingLevel: HeadingLevel2, TextRun: TextRun2, AlignmentType: AlignmentType2 } = docx;
  const children = [];
  children.push(
    new Paragraph2({
      heading: HeadingLevel2.TITLE,
      alignment: AlignmentType2.CENTER,
      children: [new TextRun2({ text: form.title, bold: true })]
    })
  );
  children.push(
    new Paragraph2({
      alignment: AlignmentType2.CENTER,
      children: [new TextRun2({ text: form.subtitle, italics: true })]
    })
  );
  children.push(new Paragraph2({ text: "" }));
  for (const rawSection of form.sections) {
    const section = applySectionTokens(rawSection, tokens);
    if (section.heading !== "Header") {
      children.push(
        new Paragraph2({
          heading: HeadingLevel2.HEADING_2,
          children: [new TextRun2({ text: section.heading, bold: true })]
        })
      );
    }
    for (const line of section.body) {
      children.push(new Paragraph2({ text: line }));
    }
    children.push(new Paragraph2({ text: "" }));
  }
  const doc = new Document2({
    creator: tokens["CLINICIAN_FULL_NAME"] ?? "Psygil",
    title: form.title,
    description: `Psygil blank form: ${form.id}`,
    sections: [{ children }]
  });
  return Packer2.toBuffer(doc);
}
function ensureDir$2(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
function writeSkipResult(category, filename, path2, reason) {
  return {
    category,
    filename,
    path: path2,
    bytesWritten: 0,
    skipped: true,
    skipReason: reason
  };
}
function writeTextFile(category, dir, filename, content, overwrite) {
  ensureDir$2(dir);
  const path$1 = path.join(dir, filename);
  if (!overwrite && fs.existsSync(path$1)) {
    return writeSkipResult(category, filename, path$1, "File already exists");
  }
  fs.writeFileSync(path$1, content, "utf-8");
  return {
    category,
    filename,
    path: path$1,
    bytesWritten: Buffer.byteLength(content, "utf-8"),
    skipped: false,
    skipReason: null
  };
}
async function writeFormFile(dir, form, tokens, overwrite) {
  ensureDir$2(dir);
  const path$1 = path.join(dir, form.filename);
  if (!overwrite && fs.existsSync(path$1)) {
    return writeSkipResult("forms", form.filename, path$1, "File already exists");
  }
  try {
    const buffer = await renderFormDocx(form, tokens);
    fs.writeFileSync(path$1, buffer);
    return {
      category: "forms",
      filename: form.filename,
      path: path$1,
      bytesWritten: buffer.length,
      skipped: false,
      skipReason: null
    };
  } catch (err) {
    return writeSkipResult(
      "forms",
      form.filename,
      path$1,
      `DOCX generation failed: ${err.message}`
    );
  }
}
async function seedWorkspaceContent(options) {
  const { projectRoot, practice } = options;
  const overwrite = options.overwrite === true;
  const tokens = buildPracticeTokenMap(practice);
  const workspace = path.join(projectRoot, "Workspace");
  const writingSamplesDir = path.join(workspace, "Writing Samples");
  const documentsDir = path.join(workspace, "Documents");
  const testingDir = path.join(workspace, "Testing");
  const formsDir = path.join(workspace, "Forms");
  const results = [];
  for (const sample of WRITING_SAMPLES$1) {
    results.push(
      writeTextFile(
        "writing-samples",
        writingSamplesDir,
        sample.filename,
        sample.content,
        overwrite
      )
    );
  }
  for (const doc of DOCUMENT_FILES) {
    results.push(
      writeTextFile("documents", documentsDir, doc.filename, doc.content, overwrite)
    );
  }
  for (const guide of TESTING_GUIDES) {
    results.push(
      writeTextFile("testing", testingDir, guide.filename, guide.content, overwrite)
    );
  }
  for (const form of BLANK_FORMS) {
    results.push(await writeFormFile(formsDir, form, tokens, overwrite));
  }
  return results;
}
function summarizeSeedResults(results) {
  let written = 0;
  let skipped = 0;
  let failed = 0;
  const byCategory = {
    "writing-samples": 0,
    documents: 0,
    testing: 0,
    forms: 0
  };
  for (const r of results) {
    if (r.skipped && r.skipReason !== null && r.skipReason.startsWith("DOCX generation failed")) {
      failed += 1;
    } else if (r.skipped) {
      skipped += 1;
    } else {
      written += 1;
      byCategory[r.category] = (byCategory[r.category] ?? 0) + 1;
    }
  }
  return { written, skipped, failed, byCategory };
}
function ok$1(data) {
  return { status: "success", data };
}
function fail$1(error_code, message) {
  return { status: "error", error_code, message };
}
const SETUP_CHANNELS = {
  GET_CONFIG: "setup:getConfig",
  RESET: "setup:reset",
  ADVANCE: "setup:advance",
  VALIDATE_LICENSE: "setup:validateLicense",
  SAVE_LICENSE: "setup:saveLicense",
  VALIDATE_STORAGE_PATH: "setup:validateStoragePath",
  PICK_STORAGE_FOLDER: "setup:pickStorageFolder",
  DEFAULT_STORAGE_PATH: "setup:getDefaultStoragePath",
  PROVISION_STORAGE: "setup:provisionStorage",
  SAVE_PRACTICE: "setup:savePractice",
  SAVE_APPEARANCE: "setup:saveAppearance",
  SAVE_CLINICAL: "setup:saveClinical",
  PROVISION_TEMPLATES: "setup:provisionTemplates",
  SAVE_AI: "setup:saveAi",
  GET_SUPPORTED_EVAL_TYPES: "setup:getSupportedEvalTypes",
  COMPLETE: "setup:complete"
};
function registerSetupHandlers() {
  electron.ipcMain.handle(
    SETUP_CHANNELS.GET_CONFIG,
    () => {
      try {
        return ok$1({ config: loadConfig() });
      } catch (err) {
        return fail$1("SETUP_LOAD_FAILED", err.message);
      }
    }
  );
  electron.ipcMain.handle(
    SETUP_CHANNELS.RESET,
    () => {
      try {
        const fresh = freshConfig();
        saveConfig(fresh);
        return ok$1({ config: fresh });
      } catch (err) {
        return fail$1("SETUP_RESET_FAILED", err.message);
      }
    }
  );
  electron.ipcMain.handle(
    SETUP_CHANNELS.ADVANCE,
    (_event, params) => {
      try {
        const current = loadConfig();
        const next = advanceTo(current, params.targetState);
        saveConfig(next);
        return ok$1({ config: next });
      } catch (err) {
        return fail$1("SETUP_ADVANCE_FAILED", err.message);
      }
    }
  );
  electron.ipcMain.handle(
    SETUP_CHANNELS.VALIDATE_LICENSE,
    async (_event, params) => {
      try {
        const result = await validateLicense(params.key);
        return ok$1(result);
      } catch (err) {
        return fail$1("LICENSE_VALIDATE_FAILED", err.message);
      }
    }
  );
  electron.ipcMain.handle(
    SETUP_CHANNELS.SAVE_LICENSE,
    (_event, params) => {
      try {
        const current = loadConfig();
        const updated = advanceTo(
          { ...current, license: params.license },
          "license_entered"
        );
        saveConfig(updated);
        return ok$1({ config: updated });
      } catch (err) {
        return fail$1("LICENSE_SAVE_FAILED", err.message);
      }
    }
  );
  electron.ipcMain.handle(
    SETUP_CHANNELS.VALIDATE_STORAGE_PATH,
    (_event, params) => {
      try {
        return ok$1(validateStoragePath(params.path));
      } catch (err) {
        return fail$1("STORAGE_VALIDATE_FAILED", err.message);
      }
    }
  );
  electron.ipcMain.handle(
    SETUP_CHANNELS.DEFAULT_STORAGE_PATH,
    () => {
      return ok$1({ path: getDefaultStoragePath() });
    }
  );
  electron.ipcMain.handle(
    SETUP_CHANNELS.PICK_STORAGE_FOLDER,
    async () => {
      try {
        const parent = electron.BrowserWindow.getFocusedWindow() ?? void 0;
        const res = await electron.dialog.showOpenDialog(parent ?? new electron.BrowserWindow({ show: false }), {
          title: "Choose a folder for Psygil case files",
          properties: ["openDirectory", "createDirectory"],
          defaultPath: getDefaultStoragePath()
        });
        if (res.canceled || res.filePaths.length === 0) {
          return ok$1({ path: null });
        }
        return ok$1({ path: res.filePaths[0] });
      } catch (err) {
        return fail$1("PICK_FOLDER_FAILED", err.message);
      }
    }
  );
  electron.ipcMain.handle(
    SETUP_CHANNELS.PROVISION_STORAGE,
    (_event, params) => {
      try {
        const validation = validateStoragePath(params.path);
        if (!validation.ok) {
          return fail$1(
            "STORAGE_INVALID",
            validation.errors.map((e) => e.message).join("; ")
          );
        }
        const hasCloudWarning = validation.warnings.find(
          (w) => w.code === "CLOUD_SYNC_FOLDER"
        );
        if (hasCloudWarning !== void 0 && !params.cloudSyncWarningAcknowledged) {
          return fail$1(
            "CLOUD_SYNC_UNACKNOWLEDGED",
            hasCloudWarning.message
          );
        }
        const created = provisionProjectRoot(validation.normalizedPath);
        const current = loadConfig();
        const storage = {
          mode: "local",
          projectRoot: validation.normalizedPath,
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          cloudSyncWarningAcknowledged: hasCloudWarning !== void 0
        };
        const updated = advanceTo(
          { ...current, storage },
          "storage_ready"
        );
        saveConfig(updated);
        return ok$1({ config: updated, created });
      } catch (err) {
        return fail$1("STORAGE_PROVISION_FAILED", err.message);
      }
    }
  );
  electron.ipcMain.handle(
    SETUP_CHANNELS.SAVE_PRACTICE,
    (_event, params) => {
      try {
        const errs = validatePracticeInfo(params.practice);
        if (errs.length > 0) {
          return fail$1("PRACTICE_INVALID", errs.join("; "));
        }
        const current = loadConfig();
        const updated = advanceTo(
          { ...current, practice: params.practice },
          "profile_done"
        );
        saveConfig(updated);
        return ok$1({ config: updated });
      } catch (err) {
        return fail$1("PRACTICE_SAVE_FAILED", err.message);
      }
    }
  );
  electron.ipcMain.handle(
    SETUP_CHANNELS.SAVE_AI,
    (_event, params) => {
      try {
        const current = loadConfig();
        const updated = advanceTo(
          { ...current, ai: params.ai },
          "ai_configured"
        );
        saveConfig(updated);
        return ok$1({ config: updated });
      } catch (err) {
        return fail$1("AI_SAVE_FAILED", err.message);
      }
    }
  );
  electron.ipcMain.handle(
    SETUP_CHANNELS.SAVE_APPEARANCE,
    (_event, params) => {
      try {
        const current = loadConfig();
        const updated = advanceTo(
          { ...current, appearance: params.appearance },
          "prefs_done"
        );
        saveConfig(updated);
        return ok$1({ config: updated });
      } catch (err) {
        return fail$1("APPEARANCE_SAVE_FAILED", err.message);
      }
    }
  );
  electron.ipcMain.handle(
    SETUP_CHANNELS.SAVE_CLINICAL,
    (_event, params) => {
      try {
        const current = loadConfig();
        const updated = advanceTo(
          { ...current, clinical: params.clinical },
          "clinical_done"
        );
        saveConfig(updated);
        return ok$1({ config: updated });
      } catch (err) {
        return fail$1("CLINICAL_SAVE_FAILED", err.message);
      }
    }
  );
  electron.ipcMain.handle(
    SETUP_CHANNELS.PROVISION_TEMPLATES,
    async (_event, params) => {
      try {
        const config = loadConfig();
        if (config.storage === null) {
          return fail$1("NO_STORAGE", "Storage must be configured before provisioning templates.");
        }
        if (config.practice === null) {
          return fail$1("NO_PRACTICE", "Practice information must be saved before provisioning templates.");
        }
        const selected = config.clinical?.evalTypes ?? SUPPORTED_EVAL_TYPES;
        const results = await provisionTemplates({
          projectRoot: config.storage.projectRoot,
          practice: config.practice,
          selectedEvalTypes: selected,
          overwrite: params?.overwrite === true
        });
        let workspaceResults = [];
        let workspaceSummary = {
          written: 0,
          skipped: 0,
          failed: 0,
          byCategory: {}
        };
        try {
          workspaceResults = await seedWorkspaceContent({
            projectRoot: config.storage.projectRoot,
            practice: config.practice,
            overwrite: params?.overwrite === true
          });
          workspaceSummary = summarizeSeedResults(workspaceResults);
        } catch (seedErr) {
          console.error("[setup] Workspace content seeding failed:", seedErr);
        }
        return ok$1({ results, workspaceResults, workspaceSummary });
      } catch (err) {
        return fail$1("TEMPLATE_PROVISION_FAILED", err.message);
      }
    }
  );
  electron.ipcMain.handle(
    SETUP_CHANNELS.GET_SUPPORTED_EVAL_TYPES,
    () => {
      return ok$1({
        evalTypes: [...SUPPORTED_EVAL_TYPES],
        templates: REPORT_TEMPLATES.map((t) => ({
          id: t.id,
          evalType: t.evalType,
          title: t.title
        }))
      });
    }
  );
  electron.ipcMain.handle(
    SETUP_CHANNELS.COMPLETE,
    () => {
      try {
        const current = loadConfig();
        const required = [
          "license_entered",
          "storage_ready",
          "profile_done",
          "prefs_done",
          "clinical_done"
        ];
        for (const s of required) {
          const currentIdx = current.setupState;
          if (rank(currentIdx) < rank(s)) {
            return fail$1(
              "SETUP_INCOMPLETE",
              `Cannot complete setup: current state is '${current.setupState}', missing '${s}'.`
            );
          }
        }
        const updated = advanceTo(current, "complete");
        saveConfig(updated);
        const isDev = !electron.app.isPackaged;
        if (isDev) {
          console.log(
            "[setup] Setup complete. Dev mode detected, skipping auto-relaunch.\n         Restart `npm run dev` to pick up the new project root\n         and see the clean database."
          );
        } else {
          setTimeout(() => {
            try {
              electron.app.relaunch();
              electron.app.exit(0);
            } catch (err) {
              console.error("[setup] Failed to relaunch after complete:", err);
            }
          }, 400);
        }
        return ok$1({ config: updated });
      } catch (err) {
        return fail$1("SETUP_COMPLETE_FAILED", err.message);
      }
    }
  );
}
function getDefaultStoragePath() {
  try {
    const docs = electron.app.getPath("documents");
    return path.join(docs, "Psygil");
  } catch {
    return path.join(os.homedir(), "Documents", "Psygil");
  }
}
function validatePracticeInfo(p) {
  const errors = [];
  if (typeof p.fullName !== "string" || p.fullName.trim().length === 0) {
    errors.push("Full name is required");
  }
  if (typeof p.credentials !== "string" || p.credentials.trim().length === 0) {
    errors.push("Credentials are required");
  }
  if (typeof p.licenseNumber !== "string" || p.licenseNumber.trim().length === 0) {
    errors.push("License number is required");
  }
  if (typeof p.licenseState !== "string" || p.licenseState.trim().length === 0) {
    errors.push("License state is required");
  }
  const validSpecialties = ["forensic", "clinical", "neuro", "school", "other"];
  if (!validSpecialties.includes(p.specialty)) {
    errors.push(`Specialty must be one of: ${validSpecialties.join(", ")}`);
  }
  return errors;
}
function rank(state) {
  const order = [
    "fresh",
    "sidecar_verified",
    "license_entered",
    "storage_ready",
    "profile_done",
    "ai_configured",
    "prefs_done",
    "clinical_done",
    "complete"
  ];
  return order.indexOf(state);
}
const READY_TIMEOUT_MS = 1e4;
function resolveSidecarDir() {
  if (process.env.PSYGIL_SIDECAR_DIR && fs.existsSync(process.env.PSYGIL_SIDECAR_DIR)) {
    return process.env.PSYGIL_SIDECAR_DIR;
  }
  if (electron.app.isPackaged) {
    return path.join(process.resourcesPath, "sidecar");
  }
  return path.join(__dirname, "..", "..", "..", "sidecar");
}
function resolvePythonExecutable(sidecarDir) {
  if (process.env.PSYGIL_PYTHON && fs.existsSync(process.env.PSYGIL_PYTHON)) {
    return process.env.PSYGIL_PYTHON;
  }
  const isWin = process.platform === "win32";
  const venvPython = isWin ? path.join(sidecarDir, "venv", "Scripts", "python.exe") : path.join(sidecarDir, "venv", "bin", "python");
  if (fs.existsSync(venvPython)) return venvPython;
  return isWin ? "python" : "python3";
}
function resolveBundledBinary() {
  const isWin = process.platform === "win32";
  const platformDir = process.platform === "darwin" ? "darwin" : process.platform === "win32" ? "win32" : "linux";
  const binaryName = isWin ? "psygil-sidecar.exe" : "psygil-sidecar";
  const candidates = [];
  if (process.env.PSYGIL_SIDECAR_BIN !== void 0 && fs.existsSync(process.env.PSYGIL_SIDECAR_BIN)) {
    candidates.push(process.env.PSYGIL_SIDECAR_BIN);
  }
  candidates.push(
    path.join(
      __dirname,
      "..",
      "..",
      "resources",
      "sidecar",
      platformDir,
      "psygil-sidecar",
      binaryName
    )
  );
  if (electron.app.isPackaged) {
    candidates.push(
      path.join(
        process.resourcesPath,
        "sidecar",
        platformDir,
        "psygil-sidecar",
        binaryName
      )
    );
  }
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}
function spawnSidecar() {
  return new Promise((resolve, reject) => {
    const bundledBinary = resolveBundledBinary();
    let command;
    let args;
    if (bundledBinary !== null) {
      command = bundledBinary;
      args = [];
    } else {
      const sidecarDir = resolveSidecarDir();
      const scriptPath = path.join(sidecarDir, "server.py");
      if (!fs.existsSync(scriptPath)) {
        reject(new Error(`Sidecar script not found at ${scriptPath}`));
        return;
      }
      command = resolvePythonExecutable(sidecarDir);
      args = [scriptPath];
    }
    const child = child_process.spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, PYTHONUNBUFFERED: "1" }
    });
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("Sidecar startup timed out"));
    }, READY_TIMEOUT_MS);
    let stdoutBuffer = "";
    child.stdout.on("data", (chunk) => {
      stdoutBuffer += chunk.toString();
      const lines = stdoutBuffer.split("\n");
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          if (msg.status === "ready" && typeof msg.pid === "number") {
            clearTimeout(timeout);
            resolve({ pid: msg.pid });
            return;
          }
        } catch {
        }
      }
    });
    child.on("error", (err) => {
      clearTimeout(timeout);
      reject(new Error(`Failed to spawn sidecar: ${err.message}`));
    });
    child.on("exit", (code, sig) => {
      clearTimeout(timeout);
      reject(new Error(`Sidecar exited unexpectedly: code=${code}, signal=${sig}`));
    });
  });
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
        console.log("[cases:list] returning", cases2.length, "cases");
        return ok({ cases: cases2, total: cases2.length });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to list cases";
        console.error("[cases:list] error:", message);
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
  electron.ipcMain.handle(
    "cases:update",
    (_event, params) => {
      try {
        const row = updateCase(params);
        return ok(row);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to update case";
        return fail("CASES_UPDATE_FAILED", message);
      }
    }
  );
}
function registerIntakeHandlers() {
  electron.ipcMain.handle(
    "intake:save",
    (_event, params) => {
      try {
        const row = saveIntake(params.case_id, {
          ...params.data,
          referral_type: params.data.referral_type ?? "self",
          referral_source: params.data.referral_source ?? null,
          eval_type: params.data.eval_type ?? null,
          presenting_complaint: params.data.presenting_complaint ?? null,
          jurisdiction: params.data.jurisdiction ?? null,
          charges: params.data.charges ?? null,
          attorney_name: params.data.attorney_name ?? null,
          report_deadline: params.data.report_deadline ?? null,
          status: params.data.status ?? "draft"
        });
        void writeCaseDoc(params.case_id, "intake").catch((e) => console.error("[case-docs] intake write failed:", e));
        void writeCaseDoc(params.case_id, "referral").catch((e) => console.error("[case-docs] referral write failed:", e));
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
        const sectionToTab = {
          contact: "intake",
          complaints: "intake",
          family: "intake",
          education: "intake",
          health: "intake",
          mental: "intake",
          substance: "intake",
          recent: "intake",
          legal: "referral",
          referral_notes: "referral",
          testing_notes: "testing",
          interview_notes: "interview",
          diagnostic_notes: "diagnostics",
          documents_notes: "intake"
        };
        const tab = sectionToTab[params.section];
        if (tab) {
          void writeCaseDoc(params.case_id, tab).catch((e) => console.error(`[case-docs] ${tab} write failed:`, e));
        }
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
        if (!result.is_authenticated) {
          return fail("LOGIN_FAILED", "Login failed");
        }
        const license = checkLicense();
        return ok({
          is_authenticated: true,
          user_id: result.user_id ?? "",
          user_name: result.user_name ?? "",
          user_email: result.user_email ?? "",
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
        syncWorkspaceToDB(path2);
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
      electron.shell.showItemInFolder(path2);
      return ok(void 0);
    }
  );
  electron.ipcMain.handle(
    "workspace:openNative",
    (_event, path2) => {
      void electron.shell.openPath(path2);
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
  electron.ipcMain.handle(
    "workspace:getMalformed",
    () => {
      return ok(getMalformedFolders());
    }
  );
  electron.ipcMain.handle(
    "workspace:scaffold",
    (_event, folderPath) => {
      try {
        const created = scaffoldCaseSubfolders(folderPath);
        return ok(created);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to scaffold subfolders";
        return fail("SCAFFOLD_FAILED", message);
      }
    }
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
  electron.ipcMain.handle(
    "documents:pickFiles",
    async (event) => {
      const parentWindow = electron.BrowserWindow.fromWebContents(event.sender);
      const result = await electron.dialog.showOpenDialog(parentWindow, {
        title: "Select Documents to Upload",
        properties: ["openFile", "multiSelections"],
        filters: [
          { name: "Documents", extensions: ["pdf", "docx", "doc", "txt", "csv", "rtf"] },
          { name: "All Files", extensions: ["*"] }
        ]
      });
      if (result.canceled || result.filePaths.length === 0) {
        return ok({ filePaths: [] });
      }
      return ok({ filePaths: result.filePaths });
    }
  );
  electron.ipcMain.handle(
    "documents:pickFilesFrom",
    async (event, params) => {
      const parentWindow = electron.BrowserWindow.fromWebContents(event.sender);
      const defaultDir = params.defaultPath === "$DOWNLOADS" ? electron.app.getPath("downloads") : params.defaultPath ?? void 0;
      const exts = params.extensions ?? ["pdf", "docx", "doc", "txt", "csv", "rtf", "vtt", "json"];
      const result = await electron.dialog.showOpenDialog(parentWindow, {
        title: params.title ?? "Select Files to Upload",
        defaultPath: defaultDir,
        properties: ["openFile", "multiSelections"],
        filters: [
          { name: "Documents", extensions: exts },
          { name: "All Files", extensions: ["*"] }
        ]
      });
      if (result.canceled || result.filePaths.length === 0) {
        return ok({ filePaths: [] });
      }
      return ok({ filePaths: result.filePaths });
    }
  );
  electron.ipcMain.handle(
    "documents:syncToDisk",
    async (_event, params) => {
      try {
        const result = await syncAllCaseDocs(params.case_id);
        return ok(result);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to sync documents to disk";
        return fail("DOCUMENTS_SYNC_FAILED", message);
      }
    }
  );
  electron.ipcMain.handle(
    "documents:writeTabDoc",
    async (_event, params) => {
      try {
        const filePath = await writeCaseDoc(params.case_id, params.tab);
        return ok(filePath);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to write tab document";
        return fail("DOCUMENT_WRITE_FAILED", message);
      }
    }
  );
}
function registerPiiHandlers() {
  spawnSidecar().then((info) => {
    console.log(`[PII] Sidecar ready, PID ${info.pid}`);
  }).catch((err) => {
    console.warn(
      `[PII] Sidecar not available: ${err.message}
      The PII pipeline will fail until the sidecar starts.
      Requires Python 3.10+ with presidio-analyzer + spacy + en_core_web_lg.
      See sidecar/BUILD.md for details.`
    );
  });
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
  electron.ipcMain.handle(
    "pii:redact",
    async (_event, params) => {
      try {
        const result = await redact(params.text, params.operationId, params.context);
        return ok(result);
      } catch (e) {
        const message = e instanceof Error ? e.message : "PII redaction failed";
        return fail("PII_REDACT_FAILED", message);
      }
    }
  );
  electron.ipcMain.handle(
    "pii:rehydrate",
    async (_event, params) => {
      try {
        const result = await rehydrate(params.text, params.operationId);
        return ok(result);
      } catch (e) {
        const message = e instanceof Error ? e.message : "PII rehydration failed";
        return fail("PII_REHYDRATE_FAILED", message);
      }
    }
  );
  electron.ipcMain.handle(
    "pii:destroy",
    async (_event, params) => {
      try {
        const result = await destroyMap(params.operationId);
        return ok(result);
      } catch (e) {
        const message = e instanceof Error ? e.message : "PII map destruction failed";
        return fail("PII_DESTROY_FAILED", message);
      }
    }
  );
}
function registerSeedHandlers() {
  electron.ipcMain.handle(
    "seed:demoCases",
    () => {
      try {
        const { seedDemoCases: seedDemoCases2, createSeedTrigger } = require("../seed-demo-cases");
        createSeedTrigger();
        seedDemoCases2();
        return ok({ inserted: 30 });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Seed failed";
        return fail("SEED_FAILED", message);
      }
    }
  );
}
function registerApiKeyHandlers() {
  electron.ipcMain.handle(
    "apiKey:store",
    (_event, params) => {
      try {
        storeApiKey(params.key);
        return ok({ stored: true });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to store API key";
        return fail("API_KEY_STORE_FAILED", message);
      }
    }
  );
  electron.ipcMain.handle(
    "apiKey:retrieve",
    () => {
      try {
        const key = retrieveApiKey();
        return ok({ key });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to retrieve API key";
        return fail("API_KEY_RETRIEVE_FAILED", message);
      }
    }
  );
  electron.ipcMain.handle(
    "apiKey:delete",
    () => {
      try {
        const deleted = deleteApiKey();
        return ok({ deleted });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to delete API key";
        return fail("API_KEY_DELETE_FAILED", message);
      }
    }
  );
  electron.ipcMain.handle(
    "apiKey:has",
    () => {
      try {
        const hasKey = hasApiKey();
        return ok({ hasKey });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to check API key";
        return fail("API_KEY_HAS_FAILED", message);
      }
    }
  );
}
function registerDataConfirmationHandlers() {
  electron.ipcMain.handle(
    "data-confirmation:save",
    (_event, params) => {
      try {
        saveDataConfirmation(params.caseId, params.categoryId, params.status, params.notes);
        return ok({ status: "success" });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to save data confirmation";
        return fail("DATA_CONFIRMATION_SAVE_FAILED", message);
      }
    }
  );
  electron.ipcMain.handle(
    "data-confirmation:get",
    (_event, params) => {
      try {
        const rows = getDataConfirmation(params.caseId);
        const data = rows.map((row) => ({
          category_id: row.category_id,
          status: row.status,
          notes: row.notes
        }));
        return ok({ data });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to get data confirmation";
        return fail("DATA_CONFIRMATION_GET_FAILED", message);
      }
    }
  );
}
function registerUpdaterHandlers() {
  electron.ipcMain.handle(
    "updater:check",
    async () => {
      try {
        const { checkForUpdates } = await Promise.resolve().then(() => require("./index-jvEF-um2.js"));
        const result = await checkForUpdates();
        return ok(result);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to check for updates";
        console.error("[updater:check] error:", message);
        return fail("UPDATER_CHECK_FAILED", message);
      }
    }
  );
  electron.ipcMain.handle(
    "updater:download",
    async (_event, params) => {
      try {
        const { downloadUpdate } = await Promise.resolve().then(() => require("./index-jvEF-um2.js"));
        const filePath = await downloadUpdate(params.version);
        return ok({ filePath });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to download update";
        console.error("[updater:download] error:", message);
        return fail("UPDATER_DOWNLOAD_FAILED", message);
      }
    }
  );
  electron.ipcMain.handle(
    "updater:getVersion",
    () => {
      try {
        const { getAppVersion } = require("../updater");
        return ok(getAppVersion());
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to get app version";
        return fail("UPDATER_GET_VERSION_FAILED", message);
      }
    }
  );
}
function registerOnlyOfficeHandlers() {
  electron.ipcMain.handle(
    "onlyoffice:start",
    async () => {
      try {
        const result = await startDocumentServer();
        console.log("[onlyoffice:start] Document Server started on port", result.port);
        return ok(result);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to start Document Server";
        console.error("[onlyoffice:start] error:", message);
        return fail("ONLYOFFICE_START_FAILED", message);
      }
    }
  );
  electron.ipcMain.handle(
    "onlyoffice:stop",
    async () => {
      try {
        await stopDocumentServer();
        console.log("[onlyoffice:stop] Document Server stopped");
        return ok(void 0);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to stop Document Server";
        console.error("[onlyoffice:stop] error:", message);
        return fail("ONLYOFFICE_STOP_FAILED", message);
      }
    }
  );
  electron.ipcMain.handle(
    "onlyoffice:status",
    async () => {
      try {
        const status = await getDocumentServerStatus();
        return ok(status);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to get Document Server status";
        return fail("ONLYOFFICE_STATUS_FAILED", message);
      }
    }
  );
  electron.ipcMain.handle(
    "onlyoffice:getUrl",
    async () => {
      try {
        const url2 = await getDocumentServerUrl();
        return ok(url2);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to get Document Server URL";
        return fail("ONLYOFFICE_URL_FAILED", message);
      }
    }
  );
  electron.ipcMain.handle(
    "onlyoffice:generateToken",
    async (_event, params) => {
      try {
        const token = generateJwtToken(params.payload);
        return ok(token);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to generate JWT token";
        return fail("ONLYOFFICE_TOKEN_FAILED", message);
      }
    }
  );
  electron.ipcMain.handle(
    "onlyoffice:generateDocx",
    async (_event, params) => {
      try {
        const writerOutput = getLatestWriterResult$1(params.caseId);
        if (!writerOutput) {
          return fail("NO_WRITER_OUTPUT", "No writer output found. Run Writer Agent first.");
        }
        const editorOutput = getLatestEditorResult(params.caseId);
        const result = await generateReportDocx(params.caseId, writerOutput, editorOutput);
        console.log("[onlyoffice:generateDocx] Generated:", result.filePath);
        return ok(result);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to generate DOCX";
        console.error("[onlyoffice:generateDocx] error:", message);
        return fail("ONLYOFFICE_DOCX_FAILED", message);
      }
    }
  );
  electron.ipcMain.handle(
    "onlyoffice:openDocument",
    async (_event, params) => {
      try {
        const serverUrl = await getDocumentServerUrl();
        if (!serverUrl) {
          return fail("ONLYOFFICE_NOT_RUNNING", "Document Server is not running. Start it first.");
        }
        const secureConfig = getSecureEditorConfig();
        const documentPayload = {
          document: {
            fileType: "docx",
            key: `case_${params.caseId}_${Date.now()}`,
            title: `case_${params.caseId}_report`,
            url: params.filePath ?? ""
            // This would be served by the app
          },
          documentType: "text",
          editorConfig: {
            mode: params.readOnly ? "view" : "edit",
            callbackUrl: params.readOnly ? void 0 : `http://localhost:3000/api/onlyoffice/callback`,
            ...secureConfig
          }
        };
        const jwtToken = generateJwtToken(documentPayload);
        return ok({
          documentUrl: serverUrl,
          jwtToken,
          callbackUrl: `http://localhost:3000/api/onlyoffice/callback`
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to open document";
        console.error("[onlyoffice:openDocument] error:", message);
        return fail("ONLYOFFICE_OPEN_FAILED", message);
      }
    }
  );
}
function registerReportHandlers() {
  electron.ipcMain.handle(
    "report:submitAttestation",
    (_event, params) => {
      try {
        const result = submitAttestation({
          caseId: params.caseId,
          signedBy: params.signedBy,
          attestationStatement: params.attestationStatement,
          signatureDate: params.signatureDate
        });
        return ok({
          success: true,
          integrityHash: result.integrityHash,
          finalizedAt: (/* @__PURE__ */ new Date()).toISOString()
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to submit attestation";
        console.error("[report:submitAttestation]", message);
        return fail("REPORT_SUBMIT_FAILED", message);
      }
    }
  );
  electron.ipcMain.handle(
    "report:getStatus",
    (_event, params) => {
      try {
        const status = getReportStatus(params.caseId);
        return ok({
          finalized: status.isLocked,
          finalizedAt: status.integrityHash ? (/* @__PURE__ */ new Date()).toISOString() : void 0,
          integrityHash: status.integrityHash ?? void 0,
          signedBy: void 0
          // Could be stored in audit log details
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to get report status";
        return fail("REPORT_STATUS_FAILED", message);
      }
    }
  );
  electron.ipcMain.handle(
    "report:verifyIntegrity",
    (_event, params) => {
      try {
        const result = verifyIntegrity(params.caseId);
        return ok({
          valid: result.valid,
          integrityHash: result.storedHash ?? "",
          expectedHash: result.computedHash
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to verify integrity";
        return fail("REPORT_VERIFY_FAILED", message);
      }
    }
  );
  electron.ipcMain.handle(
    "report:exportAndOpen",
    async (_event, params) => {
      try {
        const docxMod = require("docx");
        const { Document: Doc, Packer: Pkr, Paragraph: Para, HeadingLevel: HL, TextRun: TR } = docxMod;
        const { writeFileSync, mkdirSync: mkDir } = require("fs");
        const { join: joinPath } = require("path");
        const wsPath = loadWorkspacePath();
        if (!wsPath) {
          return fail("NO_WORKSPACE", "Workspace not configured");
        }
        const draftsDir = joinPath(wsPath, `case_${params.caseId}`, "report", "drafts");
        mkDir(draftsDir, { recursive: true });
        const fs2 = require("fs");
        let version = 1;
        try {
          const existing = fs2.readdirSync(draftsDir);
          const versions = existing.filter((f) => f.match(/^draft_v\d+\.docx$/)).map((f) => {
            const m = f.match(/draft_v(\d+)/);
            return m ? parseInt(m[1], 10) : 0;
          });
          if (versions.length > 0) {
            version = Math.max(...versions) + 1;
          }
        } catch {
        }
        const fileName = `draft_v${version}.docx`;
        const filePath = joinPath(draftsDir, fileName);
        const children = [];
        children.push(
          new Para({
            children: [new TR({ text: "CONFIDENTIAL FORENSIC EVALUATION REPORT", bold: true, size: 28 })],
            alignment: "center",
            spacing: { after: 100 }
          })
        );
        children.push(
          new Para({
            children: [new TR({ text: params.evalType, color: "666666", size: 22 })],
            alignment: "center",
            spacing: { after: 300 }
          })
        );
        children.push(
          new Para({
            children: [
              new TR({ text: "Examinee: ", bold: true, size: 22 }),
              new TR({ text: params.fullName, size: 22 })
            ],
            spacing: { after: 80 }
          })
        );
        children.push(
          new Para({
            children: [
              new TR({ text: "Date: ", bold: true, size: 22 }),
              new TR({ text: (/* @__PURE__ */ new Date()).toLocaleDateString(), size: 22 })
            ],
            spacing: { after: 300 }
          })
        );
        for (const sec of params.sections) {
          children.push(
            new Para({
              text: sec.title,
              heading: HL.HEADING_2,
              spacing: { before: 240, after: 120 }
            })
          );
          const bodyLines = sec.body.split("\n");
          for (const line of bodyLines) {
            children.push(
              new Para({
                children: [new TR({ text: line, size: 22 })],
                spacing: { after: 60 }
              })
            );
          }
        }
        children.push(new Para({ text: "", spacing: { before: 600 } }));
        children.push(new Para({
          children: [new TR({ text: "________________________________________", size: 22 })],
          spacing: { after: 40 }
        }));
        children.push(new Para({
          children: [new TR({ text: "[Clinician Name, Credentials]", size: 22 })],
          spacing: { after: 20 }
        }));
        children.push(new Para({
          children: [new TR({ text: "Licensed Psychologist", color: "666666", size: 20 })],
          spacing: { after: 20 }
        }));
        children.push(new Para({
          children: [new TR({ text: "Date: _______________", color: "666666", size: 20 })]
        }));
        const doc = new Doc({
          sections: [{ children }]
        });
        const buffer = await Pkr.toBuffer(doc);
        writeFileSync(filePath, buffer);
        console.log("[report:exportAndOpen] Saved:", filePath);
        void electron.shell.openPath(filePath);
        return ok({ filePath });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to export report";
        console.error("[report:exportAndOpen]", message);
        return fail("REPORT_EXPORT_FAILED", message);
      }
    }
  );
  electron.ipcMain.handle(
    "report:loadTemplate",
    async (event) => {
      try {
        const parentWindow = electron.BrowserWindow.fromWebContents(event.sender);
        const result = await electron.dialog.showOpenDialog(parentWindow, {
          title: "Select Report Template (.docx)",
          filters: [
            { name: "Word Documents", extensions: ["docx", "doc"] },
            { name: "All Files", extensions: ["*"] }
          ],
          properties: ["openFile"]
        });
        if (result.canceled || result.filePaths.length === 0) {
          return fail("USER_CANCELLED", "No file selected");
        }
        const filePath = result.filePaths[0];
        const fs2 = require("fs");
        const fileBuffer = fs2.readFileSync(filePath);
        const mammoth = require("mammoth");
        const extracted = await mammoth.extractRawText({ buffer: fileBuffer });
        const rawText = extracted.value ?? "";
        let cleaned = rawText;
        cleaned = cleaned.replace(/\b\d{3}[-.]?\d{2}[-.]?\d{4}\b/g, "[SSN REMOVED]");
        cleaned = cleaned.replace(/\b(0?[1-9]|1[0-2])[/\-](0?[1-9]|[12]\d|3[01])[/\-](19|20)\d{2}\b/g, "[DOB REMOVED]");
        cleaned = cleaned.replace(/\b(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})\b/g, "[PHONE REMOVED]");
        cleaned = cleaned.replace(/\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Z|a-z]{2,}\b/g, "[EMAIL REMOVED]");
        cleaned = cleaned.replace(/\b\d{1,5}\s+[A-Z][a-z]+\s+(St|Ave|Blvd|Dr|Ln|Rd|Ct|Way|Pl|Circle|Terrace|Drive|Lane|Road|Court|Boulevard|Avenue|Street)\b\.?/gi, "[ADDRESS REMOVED]");
        const lines = cleaned.split("\n").filter((l) => l.trim().length > 0);
        const sections = [];
        let currentTitle = "Imported Section";
        let currentBody = [];
        for (const line of lines) {
          const trimmed = line.trim();
          const isHeading = trimmed.length < 80 && trimmed.length > 2 && (trimmed === trimmed.toUpperCase() || /^[A-Z][A-Z\s&:,\-,,]+$/.test(trimmed));
          if (isHeading) {
            if (currentBody.length > 0) {
              sections.push({ title: currentTitle, body: currentBody.join("\n") });
            }
            currentTitle = trimmed;
            currentBody = [];
          } else {
            currentBody.push(trimmed);
          }
        }
        if (currentBody.length > 0) {
          sections.push({ title: currentTitle, body: currentBody.join("\n") });
        }
        if (sections.length === 0) {
          sections.push({ title: "Imported Template", body: cleaned });
        }
        return ok({ sections });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to load template";
        console.error("[report:loadTemplate]", message);
        return fail("TEMPLATE_LOAD_FAILED", message);
      }
    }
  );
}
function registerAuditHandlers() {
  electron.ipcMain.handle(
    "audit:log",
    (_event, params) => {
      try {
        const detailsObj = typeof params.details === "string" ? JSON.parse(params.details) : params.details;
        const actorType = params.actorType === "agent" ? "ai_agent" : params.actorType;
        const auditLogId = logAuditEntry({
          caseId: params.caseId,
          actionType: params.actionType,
          actorType,
          actorId: params.actorId,
          details: detailsObj,
          relatedEntityType: params.relatedEntityType,
          relatedEntityId: params.relatedEntityId ? parseInt(params.relatedEntityId, 10) : void 0
        });
        return ok({
          entryId: String(auditLogId),
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to log audit entry";
        return fail("AUDIT_LOG_FAILED", message);
      }
    }
  );
  electron.ipcMain.handle(
    "audit:getTrail",
    (_event, params) => {
      try {
        const auditRows = getAuditTrail(params.caseId);
        const entries = auditRows.map((row) => ({
          id: String(row.audit_log_id),
          caseId: row.case_id,
          timestamp: row.action_date,
          actionType: row.action_type,
          actorType: row.actor_user_id === -1 ? "agent" : "system",
          actorId: row.actor_user_id === -1 ? "ai_agent" : String(row.actor_user_id),
          details: row.details ?? "",
          relatedEntityType: row.related_entity_type ?? void 0,
          relatedEntityId: row.related_entity_id ? String(row.related_entity_id) : void 0,
          status: "complete"
        }));
        return ok({ entries, total: entries.length });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to get audit trail";
        return fail("AUDIT_GET_FAILED", message);
      }
    }
  );
  electron.ipcMain.handle(
    "audit:export",
    (_event, params) => {
      try {
        const format = params.format ?? "csv";
        const data = exportAuditTrail(params.caseId, format);
        const mimeType = format === "json" ? "application/json" : "text/csv";
        return ok({ data, mimeType });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to export audit trail";
        return fail("AUDIT_EXPORT_FAILED", message);
      }
    }
  );
}
function registerTestimonyHandlers() {
  electron.ipcMain.handle(
    "testimony:prepare",
    async (_event, params) => {
      try {
        const result = await prepareTestimonyPackage(params.caseId);
        return ok({
          success: true,
          exportedFiles: result.files,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to prepare testimony package";
        console.error("[testimony:prepare]", message);
        return fail("TESTIMONY_PREPARE_FAILED", message);
      }
    }
  );
}
function registerReferralParseHandlers() {
  const fs2 = require("fs");
  const pathMod = require("path");
  const mammoth = require("mammoth");
  const pdfParse = require("pdf-parse");
  electron.ipcMain.handle("referral:parse-doc", async (_event) => {
    try {
      const parentWindow = electron.BrowserWindow.getFocusedWindow();
      if (!parentWindow) return { status: "error", error: "No active window" };
      const result = await electron.dialog.showOpenDialog(parentWindow, {
        title: "Select Referral Document",
        filters: [
          { name: "Documents", extensions: ["docx", "doc", "pdf", "txt", "rtf"] },
          { name: "All Files", extensions: ["*"] }
        ],
        properties: ["openFile"]
      });
      if (result.canceled || result.filePaths.length === 0) {
        return { status: "error", error: "cancelled" };
      }
      const filePath = result.filePaths[0];
      const ext = pathMod.extname(filePath).toLowerCase();
      const buffer = fs2.readFileSync(filePath);
      let rawText = "";
      if (ext === ".docx" || ext === ".doc") {
        const extracted = await mammoth.extractRawText({ buffer });
        rawText = extracted.value ?? "";
      } else if (ext === ".pdf") {
        const parsed = await pdfParse(buffer);
        rawText = parsed.text ?? "";
      } else {
        rawText = buffer.toString("utf-8");
      }
      if (!rawText.trim()) {
        return { status: "error", error: "Could not extract text from document" };
      }
      const fields = { _rawText: rawText };
      const text = rawText;
      const extract = (patterns) => {
        for (const pat of patterns) {
          const m = text.match(pat);
          if (m && m[1]?.trim()) return m[1].trim();
        }
        return "";
      };
      fields.caseNumber = extract([
        /(?:case|docket|cause)\s*(?:no\.?|number|#)\s*[:\-]?\s*(.+)/i,
        /(?:case|docket)\s*[:\-]\s*(.+)/i,
        /\b(\d{2,4}[-\s]?[A-Z]{1,3}[-\s]?\d{3,8})\b/
      ]);
      fields.judgeAssignedCourt = extract([
        /(?:judge|hon\.?|honorable)\s*[:\-]?\s*(.+)/i,
        /(?:assigned\s+court|court)\s*[:\-]?\s*(.+)/i,
        /(?:division|department|dept\.?)\s*[:\-]?\s*(.+)/i
      ]);
      fields.defenseCounselName = extract([
        /(?:defense\s+(?:counsel|attorney|lawyer))\s*[:\-]?\s*(.+)/i,
        /(?:public\s+defender)\s*[:\-]?\s*(.+)/i
      ]);
      fields.prosecutionAttorney = extract([
        /(?:prosecut(?:or|ing|ion)\s*(?:attorney)?)\s*[:\-]?\s*(.+)/i,
        /(?:district\s+attorney|da|ada)\s*[:\-]?\s*(.+)/i,
        /(?:referring\s+attorney)\s*[:\-]?\s*(.+)/i
      ]);
      fields.referringPartyName = extract([
        /(?:referr(?:ed|ing)\s+(?:by|party|source))\s*[:\-]?\s*(.+)/i,
        /(?:referral\s+source)\s*[:\-]?\s*(.+)/i,
        /(?:ordered\s+by)\s*[:\-]?\s*(.+)/i
      ]);
      const rpTypeStr = extract([
        /(?:referral\s+type|referring\s+party\s+type)\s*[:\-]?\s*(.+)/i
      ]);
      if (rpTypeStr) {
        const lower = rpTypeStr.toLowerCase();
        if (lower.includes("court")) fields.referringPartyType = "Court";
        else if (lower.includes("attorney") || lower.includes("counsel")) fields.referringPartyType = "Attorney";
        else if (lower.includes("physician") || lower.includes("doctor")) fields.referringPartyType = "Physician";
        else if (lower.includes("agency")) fields.referringPartyType = "Agency";
        else if (lower.includes("insurance")) fields.referringPartyType = "Insurance";
      }
      if (!fields.referringPartyType) {
        const lower = text.toLowerCase();
        if (/\bcourt\s+order/i.test(lower) || /\bordered\s+by\s+the\s+court/i.test(lower)) {
          fields.referringPartyType = "Court";
        } else if (/\battorney|counsel/i.test(fields.referringPartyName)) {
          fields.referringPartyType = "Attorney";
        }
      }
      const evalStr = extract([
        /(?:evaluation|eval|assessment)\s*(?:type|requested)?\s*[:\-]?\s*(.+)/i,
        /(?:type\s+of\s+evaluation)\s*[:\-]?\s*(.+)/i,
        /(?:requesting|request\s+for)\s*[:\-]?\s*(.+)/i
      ]);
      if (evalStr) {
        const lower = evalStr.toLowerCase();
        const evalTypes = [
          [/competenc|cst/i, "CST"],
          [/custod/i, "Custody"],
          [/risk\s+assess/i, "Risk Assessment"],
          [/fitness/i, "Fitness for Duty"],
          [/ptsd/i, "PTSD Dx"],
          [/adhd|attention/i, "ADHD Dx"],
          [/malinger|feign/i, "Malingering"],
          [/capacit/i, "Capacity"],
          [/disabilit/i, "Disability"],
          [/immigra|hardship/i, "Immigration"],
          [/personal\s+injur/i, "Personal Injury"],
          [/diagnostic/i, "Diagnostic Assessment"],
          [/juvenile|minor/i, "Juvenile"],
          [/mitigat/i, "Mitigation"]
        ];
        for (const [pat, val] of evalTypes) {
          if (pat.test(lower) || pat.test(text)) {
            fields.evalType = val;
            break;
          }
        }
        if (!fields.evalType) fields.evalType = evalStr.substring(0, 60);
      }
      fields.charges = extract([
        /(?:charge[sd]?|offense[sd]?|allegation[sd]?)\s*[:\-]?\s*(.+)/i,
        /(?:charged\s+with)\s*[:\-]?\s*(.+)/i
      ]);
      fields.reasonForReferral = extract([
        /(?:reason\s+for\s+referral)\s*[:\-]?\s*([\s\S]{10,300}?)(?:\n\n|\n[A-Z])/i,
        /(?:referral\s+question|purpose\s+of\s+evaluation)\s*[:\-]?\s*([\s\S]{10,300}?)(?:\n\n|\n[A-Z])/i,
        /(?:evaluation\s+requested\s+(?:to|for))\s*[:\-]?\s*([\s\S]{10,300}?)(?:\n\n|\n[A-Z])/i
      ]);
      fields.courtDeadline = extract([
        /(?:deadline|due\s+date|report\s+due|completion\s+date)\s*[:\-]?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i,
        /(?:deadline|due\s+date|report\s+due)\s*[:\-]?\s*([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/i
      ]);
      if (fields.courtDeadline) {
        const d = new Date(fields.courtDeadline);
        if (!isNaN(d.getTime())) {
          fields.courtDeadline = d.toISOString().split("T")[0];
        }
      }
      const phones = text.match(/\(?\d{3}\)?[\s\-.]?\d{3}[\s\-.]?\d{4}/g) ?? [];
      if (phones.length > 0 && !fields.referringPartyPhone) {
        fields.referringPartyPhone = phones[0];
      }
      fields._fileName = pathMod.basename(filePath);
      if (fields._rawText.length > 3e3) {
        fields._rawText = fields._rawText.substring(0, 3e3) + "\n\n[... truncated ...]";
      }
      return { status: "success", data: fields };
    } catch (err) {
      console.error("[referral:parse-doc]", err);
      return { status: "error", error: err?.message ?? "Failed to parse referral document" };
    }
  });
}
function registerResourcesHandlers() {
  const fs2 = require("fs");
  const pathMod = require("path");
  const mammoth = require("mammoth");
  const pdfParse = require("pdf-parse");
  const CATEGORY_LABELS = {
    "writing-samples": "Writing Samples",
    "templates": "Templates",
    "documentation": "Documents",
    "testing": "Testing",
    "forms": "Forms"
  };
  for (const [key, label] of Object.entries(CATEGORY_LABELS)) {
  }
  function resolveWorkspace() {
    return loadWorkspacePath() || getDefaultWorkspacePath();
  }
  function getResourcesRoot() {
    return pathMod.join(resolveWorkspace(), "Workspace");
  }
  function getCategoryDir(category) {
    const label = CATEGORY_LABELS[category] || category;
    return pathMod.join(getResourcesRoot(), label);
  }
  function ensureCategoryDirs() {
    const root = getResourcesRoot();
    if (!fs2.existsSync(root)) fs2.mkdirSync(root, { recursive: true });
    for (const label of Object.values(CATEGORY_LABELS)) {
      const dir = pathMod.join(root, label);
      if (!fs2.existsSync(dir)) fs2.mkdirSync(dir, { recursive: true });
    }
  }
  const DOC_EXTS = /* @__PURE__ */ new Set([".txt", ".pdf", ".doc", ".docx", ".csv", ".rtf", ".md", ".xlsx", ".xls", ".json", ".xml", ".html", ".htm"]);
  function mimeForExt(ext) {
    switch (ext) {
      case ".pdf":
        return "application/pdf";
      case ".docx":
        return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      case ".doc":
        return "application/msword";
      case ".txt":
      case ".md":
        return "text/plain";
      case ".csv":
        return "text/csv";
      case ".rtf":
        return "application/rtf";
      case ".json":
        return "application/json";
      case ".xml":
        return "application/xml";
      case ".html":
      case ".htm":
        return "text/html";
      case ".xlsx":
        return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      default:
        return "application/octet-stream";
    }
  }
  function cleanedBaseName(filename, sourceExt) {
    const stem = pathMod.basename(filename, sourceExt);
    const tag = sourceExt.replace(".", "");
    return `${stem}_${tag}.txt`;
  }
  function stripPhi(text) {
    let count = 0;
    let cleaned = text;
    cleaned = cleaned.replace(/\b\d{3}[-.]?\d{2}[-.]?\d{4}\b/g, () => {
      count++;
      return "[SSN REMOVED]";
    });
    cleaned = cleaned.replace(/\b(0?[1-9]|1[0-2])[/\-](0?[1-9]|[12]\d|3[01])[/\-](19|20)\d{2}\b/g, () => {
      count++;
      return "[DATE REMOVED]";
    });
    cleaned = cleaned.replace(/\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+\d{1,2},?\s+(19|20)\d{2}\b/gi, () => {
      count++;
      return "[DATE REMOVED]";
    });
    cleaned = cleaned.replace(/\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+(19|20)\d{2}\b/gi, () => {
      count++;
      return "[DATE REMOVED]";
    });
    cleaned = cleaned.replace(/\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/g, () => {
      count++;
      return "[PHONE REMOVED]";
    });
    cleaned = cleaned.replace(/\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g, () => {
      count++;
      return "[EMAIL REMOVED]";
    });
    cleaned = cleaned.replace(/\b\d{1,5}\s+(?:[NSEW]\.?\s+)?[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,3}\s+(?:St|Ave|Blvd|Dr|Ln|Rd|Ct|Way|Pl|Pkwy|Cir|Terr?|Drive|Lane|Road|Court|Boulevard|Avenue|Street|Parkway|Circle|Terrace|Place)\.?(?:\s*,?\s*(?:Apt|Suite|Ste|Unit|Bldg|#)\s*[#]?\s*[A-Za-z0-9\-]+)?/gi, () => {
      count++;
      return "[ADDRESS REMOVED]";
    });
    cleaned = cleaned.replace(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?,\s*(?:CO|Colorado|CA|NY|TX|FL|AZ|NM|UT|WY|NE|KS|OK)\s+\d{5}(?:-\d{4})?\b/g, () => {
      count++;
      return "[LOCATION REMOVED]";
    });
    cleaned = cleaned.replace(/\bNPI:?\s*\d{10}\b/gi, () => {
      count++;
      return "[NPI REMOVED]";
    });
    cleaned = cleaned.replace(/\bDEA:?\s*[A-Za-z]{2}\d{7}\b/gi, () => {
      count++;
      return "[DEA REMOVED]";
    });
    cleaned = cleaned.replace(/\bMRN:?\s*[A-Z]{1,5}-?\d{4}-?\d{3,8}\b/gi, () => {
      count++;
      return "[MRN REMOVED]";
    });
    cleaned = cleaned.replace(/\bRx\s*#?\s*[A-Za-z]*-?\d{4,10}\b/gi, () => {
      count++;
      return "[RX REMOVED]";
    });
    cleaned = cleaned.replace(/\b(?:Member\s*ID|Medicaid\s*ID|Insurance\s*ID|Group\s*#?|Policy\s*#?|Claim\s*#?)\s*:?\s*[A-Za-z0-9\-]{5,20}\b/gi, () => {
      count++;
      return "[INSURANCE ID REMOVED]";
    });
    cleaned = cleaned.replace(/\b(?:driver'?s?\s*license|DL|CDL)\s*(?:#|number|num|no\.?)?\s*:?\s*[A-Za-z0-9\-]{6,15}\b/gi, () => {
      count++;
      return "[LICENSE REMOVED]";
    });
    cleaned = cleaned.replace(/\b(?:License|Lic)\s*#?\s*:?\s*(?:PSY|CSW|LPC|LCSW|LMFT|PT|OT|MD|DO|RN|NP)-?\d{4,10}\b/gi, () => {
      count++;
      return "[LICENSE REMOVED]";
    });
    cleaned = cleaned.replace(/\b(?:badge|badge\s*#|badge\s*number)\s*:?\s*#?\s*[A-Za-z]*-?\d{2,8}\b/gi, () => {
      count++;
      return "[BADGE REMOVED]";
    });
    cleaned = cleaned.replace(/\b(?:employee\s*ID|staff\s*ID|student\s*ID|offender\s*(?:number|#|ID)|CDOC\s*(?:#|number)?|inmate\s*(?:account|#|ID)|booking\s*#?|case\s*#?|SID|FBI\s*(?:number|#)?)\s*:?\s*[A-Za-z0-9\-]{4,20}\b/gi, () => {
      count++;
      return "[ID REMOVED]";
    });
    cleaned = cleaned.replace(/\b[A-Z]{2,6}-\d{4}-\d{2,8}\b/g, () => {
      count++;
      return "[ID REMOVED]";
    });
    cleaned = cleaned.replace(/\b[A-Z]{2,6}-(?:[A-Z]{2}-)?(?:\d{4}-)*\d{3,8}\b/g, () => {
      count++;
      return "[ID REMOVED]";
    });
    cleaned = cleaned.replace(/\b(?:passport)\s*#?\s*:?\s*[A-Z]?\d{6,9}\b/gi, () => {
      count++;
      return "[PASSPORT REMOVED]";
    });
    cleaned = cleaned.replace(/\b(?:account|routing)\s*#?\s*:?\s*[\*]*\d{4,12}\b/gi, () => {
      count++;
      return "[FINANCIAL REMOVED]";
    });
    cleaned = cleaned.replace(/\b(?:Tax\s*ID|EIN)\s*:?\s*\d{2}-\d{7}\b/gi, () => {
      count++;
      return "[TAX ID REMOVED]";
    });
    cleaned = cleaned.replace(/\b(?:Fax|fax)\s*:?\s*\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/g, () => {
      count++;
      return "[FAX REMOVED]";
    });
    cleaned = cleaned.replace(/\bhttps?:\/\/[^\s]+/gi, () => {
      count++;
      return "[URL REMOVED]";
    });
    const NAME_TITLES = [
      "Dr",
      "Mr",
      "Ms",
      "Mrs",
      "Miss",
      "Prof",
      "Sgt",
      "Sergeant",
      "Lt",
      "Lieutenant",
      "Cpl",
      "Corporal",
      "Capt",
      "Captain",
      "Det",
      "Detective",
      "Inv",
      "Investigator",
      "Chief",
      "Officer",
      "Ofc",
      "Hon",
      "Judge",
      "Justice",
      "Atty",
      "Attorney"
    ];
    const titlePattern = NAME_TITLES.map((t) => t.replace(/\./g, "\\.")).join("|");
    const titleNameRegex = new RegExp(
      `\\b(?:${titlePattern})\\.?\\s+[A-Z][a-z]+(?:\\s+[A-Z]\\.?)?\\s+[A-Z][a-z]+(?:-[A-Z][a-z]+)?\\b`,
      "g"
    );
    cleaned = cleaned.replace(titleNameRegex, () => {
      count++;
      return "[NAME REMOVED]";
    });
    const titleLastRegex = new RegExp(
      `\\b(?:${titlePattern})\\.?\\s+[A-Z][a-z]{2,}\\b`,
      "g"
    );
    cleaned = cleaned.replace(titleLastRegex, () => {
      count++;
      return "[NAME REMOVED]";
    });
    const labeledNameLabels = [
      "Examinee",
      "Patient",
      "Client",
      "Evaluee",
      "Claimant",
      "Plaintiff",
      "Defendant",
      "Respondent",
      "Petitioner",
      "Victim",
      "Complainant",
      "Subject"
    ];
    const labelPattern = labeledNameLabels.join("|");
    const labeledNameRegex = new RegExp(
      `\\b(?:${labelPattern})\\s*:\\s*[A-Z][a-z]+(?:\\s+[A-Z]\\.?)?\\s+[A-Z][a-z]+(?:-[A-Z][a-z]+)?`,
      "g"
    );
    cleaned = cleaned.replace(labeledNameRegex, (match) => {
      const label = match.split(":")[0];
      count++;
      return `${label}: [NAME REMOVED]`;
    });
    const COMMON_NON_NAMES = /* @__PURE__ */ new Set([
      "mental status",
      "clinical formulation",
      "relevant background",
      "referral question",
      "united states",
      "supreme court",
      "social security",
      "district court",
      "judicial district",
      "colorado springs",
      "fort collins",
      "denver county",
      "adams county",
      "jefferson county",
      "larimer county",
      "el paso",
      "arapahoe county",
      "boulder county",
      "douglas county",
      "weld county",
      "peak forensics",
      "full scale",
      "verbal comprehension",
      "working memory",
      "processing speed",
      "perceptual reasoning"
    ]);
    cleaned = cleaned.replace(
      /\b([A-Z][a-z]{1,15})\s+([A-Z]\.?\s+)?([A-Z][a-z]{1,15}(?:-[A-Z][a-z]{1,15})?)\b/g,
      (match, first, _mid, last) => {
        const lower = match.toLowerCase();
        if (COMMON_NON_NAMES.has(lower)) return match;
        if (/^[A-Z][a-z]+\s+(The|And|For|With|From|Into|That|This|Each|Both|Such|Over|Upon)\s/i.test(match)) return match;
        const COMMON_WORDS = /* @__PURE__ */ new Set([
          "the",
          "and",
          "for",
          "was",
          "were",
          "are",
          "has",
          "had",
          "his",
          "her",
          "she",
          "not",
          "but",
          "with",
          "from",
          "that",
          "this",
          "they",
          "them",
          "been",
          "have",
          "will",
          "would",
          "could",
          "should",
          "about",
          "into",
          "over",
          "after",
          "before",
          "during",
          "between",
          "through",
          "under",
          "again",
          "further",
          "then",
          "once",
          "here",
          "there",
          "when",
          "where",
          "both",
          "each",
          "more",
          "most",
          "other",
          "some",
          "such",
          "only",
          "same",
          "than",
          "very",
          "also",
          "just",
          "because",
          "while",
          "does",
          "did",
          "doing",
          "being",
          "having",
          "getting",
          // Common forensic/clinical terms that start with caps at sentence start
          "case",
          "court",
          "scale",
          "test",
          "score",
          "trial",
          "level",
          "total",
          "index",
          "factor",
          "type",
          "range",
          "report",
          "order",
          "standard",
          "history",
          "current",
          "prior",
          "first",
          "second",
          "third",
          "diagnosis",
          "treatment",
          "evidence",
          "clinical"
        ]);
        if (COMMON_WORDS.has(first.toLowerCase()) || COMMON_WORDS.has(last.toLowerCase())) return match;
        if (first.length < 2 || last.length < 2) return match;
        count++;
        return "[NAME REMOVED]";
      }
    );
    cleaned = cleaned.replace(/\bDate\s+of\s+Birth\s*:\s*\[?[^\]\n]{5,30}\]?/gi, () => {
      count++;
      return "Date of Birth: [DOB REMOVED]";
    });
    cleaned = cleaned.replace(/\bDOB\s*:\s*\S+/gi, () => {
      count++;
      return "DOB: [DOB REMOVED]";
    });
    return { cleaned, strippedCount: count };
  }
  async function extractText2(filePath) {
    const ext = pathMod.extname(filePath).toLowerCase();
    if (ext === ".txt" || ext === ".csv" || ext === ".rtf" || ext === ".md") {
      return fs2.readFileSync(filePath, "utf-8");
    }
    if (ext === ".docx" || ext === ".doc") {
      const buffer = fs2.readFileSync(filePath);
      const result = await mammoth.extractRawText({ buffer });
      return result.value ?? "";
    }
    return "";
  }
  electron.ipcMain.handle(
    "resources:upload",
    async (event, params) => {
      try {
        ensureCategoryDirs();
        let filePaths = params.filePaths || [];
        if (filePaths.length === 0) {
          const parentWindow = electron.BrowserWindow.fromWebContents(event.sender);
          const result = await electron.dialog.showOpenDialog(parentWindow, {
            title: `Upload ${CATEGORY_LABELS[params.category] || params.category}`,
            filters: [
              { name: "Documents", extensions: ["docx", "doc", "pdf", "txt", "csv", "rtf", "md"] },
              { name: "All Files", extensions: ["*"] }
            ],
            properties: ["openFile", "multiSelections"]
          });
          if (result.canceled || result.filePaths.length === 0) {
            return fail("USER_CANCELLED", "No files selected");
          }
          filePaths = result.filePaths;
        }
        const categoryDir = getCategoryDir(params.category);
        const imported = [];
        let totalPhiStripped = 0;
        for (const srcPath of filePaths) {
          const originalFilename = pathMod.basename(srcPath);
          const ext = pathMod.extname(originalFilename).toLowerCase();
          let destFilename = originalFilename;
          let destPath = pathMod.join(categoryDir, destFilename);
          let counter = 1;
          while (fs2.existsSync(destPath)) {
            const base = pathMod.basename(originalFilename, ext);
            destFilename = `${base} (${counter})${ext}`;
            destPath = pathMod.join(categoryDir, destFilename);
            counter++;
          }
          fs2.copyFileSync(srcPath, destPath);
          let phiWasStripped = false;
          const rawText = await extractText2(srcPath);
          if (rawText && rawText.length > 0) {
            const { cleaned, strippedCount } = stripPhi(rawText);
            totalPhiStripped += strippedCount;
            phiWasStripped = strippedCount > 0;
            const cleanedDir = pathMod.join(categoryDir, "_cleaned");
            if (!fs2.existsSync(cleanedDir)) fs2.mkdirSync(cleanedDir, { recursive: true });
            const cleanedBase = cleanedBaseName(destFilename, ext);
            fs2.writeFileSync(pathMod.join(cleanedDir, cleanedBase), cleaned, "utf-8");
          }
          const stat = fs2.statSync(destPath);
          imported.push({
            id: destFilename,
            // use filename as ID, it's unique within the folder
            category: params.category,
            originalFilename: destFilename,
            storedPath: destPath,
            fileSize: stat.size,
            mimeType: mimeForExt(ext),
            uploadedAt: stat.mtime.toISOString(),
            phiStripped: phiWasStripped
          });
        }
        console.log(`[resources:upload] Imported ${imported.length} files to ${params.category}, stripped ${totalPhiStripped} PHI instances`);
        return ok({ imported, phiStripped: totalPhiStripped });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Resource upload failed";
        console.error("[resources:upload]", message);
        return fail("RESOURCE_UPLOAD_FAILED", message);
      }
    }
  );
  electron.ipcMain.handle(
    "resources:list",
    async (_event, params) => {
      try {
        const results = [];
        const categories = params.category ? [params.category] : Object.keys(CATEGORY_LABELS);
        for (const cat of categories) {
          const dir = getCategoryDir(cat);
          if (!fs2.existsSync(dir)) continue;
          if (cat === "writing-samples") {
            const cleanedDir = pathMod.join(dir, "_cleaned");
            if (!fs2.existsSync(cleanedDir)) continue;
            const cleanedEntries = fs2.readdirSync(cleanedDir);
            for (const filename of cleanedEntries) {
              if (filename.startsWith(".")) continue;
              const ext = pathMod.extname(filename).toLowerCase();
              if (ext !== ".txt") continue;
              const fullPath = pathMod.join(cleanedDir, filename);
              const stat = fs2.statSync(fullPath);
              if (!stat.isFile()) continue;
              results.push({
                id: filename,
                category: cat,
                originalFilename: filename,
                storedPath: fullPath,
                fileSize: stat.size,
                mimeType: "text/plain",
                uploadedAt: stat.mtime.toISOString(),
                phiStripped: true
              });
            }
            const mainEntries = fs2.readdirSync(dir);
            for (const filename of mainEntries) {
              if (filename.startsWith(".") || filename.startsWith("_")) continue;
              const ext = pathMod.extname(filename).toLowerCase();
              if (ext !== ".txt") continue;
              const fullPath = pathMod.join(dir, filename);
              const stat = fs2.statSync(fullPath);
              if (!stat.isFile()) continue;
              if (results.some((r) => r.originalFilename === filename && r.category === cat)) continue;
              results.push({
                id: filename,
                category: cat,
                originalFilename: filename,
                storedPath: fullPath,
                fileSize: stat.size,
                mimeType: "text/plain",
                uploadedAt: stat.mtime.toISOString(),
                phiStripped: false
              });
            }
            continue;
          }
          const entries = fs2.readdirSync(dir);
          for (const filename of entries) {
            if (filename.startsWith(".") || filename.startsWith("_")) continue;
            const ext = pathMod.extname(filename).toLowerCase();
            if (!DOC_EXTS.has(ext)) continue;
            const fullPath = pathMod.join(dir, filename);
            const stat = fs2.statSync(fullPath);
            if (!stat.isFile()) continue;
            const cleanedPath = pathMod.join(dir, "_cleaned", cleanedBaseName(filename, ext));
            const hasCleanedVersion = fs2.existsSync(cleanedPath);
            results.push({
              id: filename,
              category: cat,
              originalFilename: filename,
              storedPath: fullPath,
              fileSize: stat.size,
              mimeType: mimeForExt(ext),
              uploadedAt: stat.mtime.toISOString(),
              phiStripped: hasCleanedVersion
            });
          }
        }
        results.sort((a, b) => a.originalFilename.localeCompare(b.originalFilename));
        return ok(results);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Resource list failed";
        return fail("RESOURCE_LIST_FAILED", message);
      }
    }
  );
  electron.ipcMain.handle(
    "resources:delete",
    async (_event, params) => {
      try {
        if (fs2.existsSync(params.storedPath)) fs2.unlinkSync(params.storedPath);
        const dir = pathMod.dirname(params.storedPath);
        const dirName = pathMod.basename(dir);
        if (dirName !== "_cleaned") {
          const ext = pathMod.extname(params.storedPath);
          const cleanedPath = pathMod.join(dir, "_cleaned", cleanedBaseName(params.storedPath, ext));
          if (fs2.existsSync(cleanedPath)) fs2.unlinkSync(cleanedPath);
        }
        return ok(void 0);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Resource delete failed";
        return fail("RESOURCE_DELETE_FAILED", message);
      }
    }
  );
  electron.ipcMain.handle(
    "resources:open",
    async (_event, params) => {
      try {
        await electron.shell.openPath(params.storedPath);
        return ok(void 0);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Resource open failed";
        return fail("RESOURCE_OPEN_FAILED", message);
      }
    }
  );
  electron.ipcMain.handle(
    "resources:uploadWritingSample",
    async (event, params) => {
      try {
        ensureCategoryDirs();
        let filePaths = params.filePaths || [];
        if (filePaths.length === 0) {
          const parentWindow = electron.BrowserWindow.fromWebContents(event.sender);
          const result = await electron.dialog.showOpenDialog(parentWindow, {
            title: "Upload Writing Samples for Voice Analysis",
            filters: [
              { name: "Documents", extensions: ["docx", "doc", "pdf", "txt", "rtf", "md"] },
              { name: "All Files", extensions: ["*"] }
            ],
            properties: ["openFile", "multiSelections"]
          });
          if (result.canceled || result.filePaths.length === 0) {
            return fail("USER_CANCELLED", "No files selected");
          }
          filePaths = result.filePaths;
        }
        const categoryDir = getCategoryDir("writing-samples");
        const cleanedDir = pathMod.join(categoryDir, "_cleaned");
        if (!fs2.existsSync(cleanedDir)) fs2.mkdirSync(cleanedDir, { recursive: true });
        const imported = [];
        const reports2 = [];
        let totalPhiStripped = 0;
        let sidecarAvailable = false;
        try {
          const { healthCheck } = require("../sidecar");
          await healthCheck();
          sidecarAvailable = true;
        } catch {
          console.warn("[resources:uploadWritingSample] Presidio sidecar not available, falling back to regex");
        }
        for (const srcPath of filePaths) {
          const originalFilename = pathMod.basename(srcPath);
          const ext = pathMod.extname(originalFilename).toLowerCase();
          let destFilename = originalFilename;
          let destPath = pathMod.join(categoryDir, destFilename);
          let counter = 1;
          while (fs2.existsSync(destPath)) {
            const base = pathMod.basename(originalFilename, ext);
            destFilename = `${base} (${counter})${ext}`;
            destPath = pathMod.join(categoryDir, destFilename);
            counter++;
          }
          fs2.copyFileSync(srcPath, destPath);
          let rawText = "";
          if (ext === ".pdf") {
            try {
              const pdfBuffer = fs2.readFileSync(srcPath);
              const pdfData = await pdfParse(pdfBuffer);
              rawText = pdfData.text ?? "";
            } catch (pdfErr) {
              console.warn(`[resources:uploadWritingSample] PDF text extraction failed for ${originalFilename}:`, pdfErr);
            }
          } else {
            rawText = await extractText2(srcPath);
          }
          if (!rawText || rawText.trim().length === 0) {
            const stat = fs2.statSync(destPath);
            imported.push({
              id: destFilename,
              category: "writing-samples",
              originalFilename: destFilename,
              storedPath: destPath,
              fileSize: stat.size,
              mimeType: mimeForExt(ext),
              uploadedAt: stat.mtime.toISOString(),
              phiStripped: false
            });
            reports2.push({
              filename: destFilename,
              originalSize: rawText.length,
              cleanedSize: 0,
              entityCount: 0,
              typeBreakdown: {},
              presidioUsed: false,
              cleanedPath: "",
              cleanedPreview: "(No text could be extracted from this file)"
            });
            continue;
          }
          let cleanedText = "";
          let entityCount = 0;
          let typeBreakdown = {};
          let presidioUsed = false;
          if (sidecarAvailable) {
            const operationId = `ws-upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            try {
              const redactResult = await redact(rawText, operationId, "report");
              cleanedText = redactResult.redactedText;
              entityCount = redactResult.entityCount;
              typeBreakdown = redactResult.typeBreakdown;
              presidioUsed = true;
              try {
                await destroyMap(operationId);
              } catch {
                console.warn(`[resources:uploadWritingSample] UNID map destroy returned error for ${operationId}`);
              }
              console.log(`[resources:uploadWritingSample] Presidio stripped ${entityCount} PHI entities from ${originalFilename}:`, typeBreakdown);
            } catch (redactErr) {
              console.warn(`[resources:uploadWritingSample] Presidio redaction failed for ${originalFilename}, falling back to regex:`, redactErr);
              try {
                await destroyMap(operationId);
              } catch {
              }
            }
          }
          if (!presidioUsed) {
            const { cleaned, strippedCount } = stripPhi(rawText);
            cleanedText = cleaned;
            entityCount = strippedCount;
            typeBreakdown = strippedCount > 0 ? { "REGEX_PATTERN": strippedCount } : {};
          }
          totalPhiStripped += entityCount;
          const cleanedBase = cleanedBaseName(destFilename, ext);
          const cleanedPath = pathMod.join(cleanedDir, cleanedBase);
          fs2.writeFileSync(cleanedPath, cleanedText, "utf-8");
          try {
            if (fs2.existsSync(destPath)) fs2.unlinkSync(destPath);
          } catch (delErr) {
            console.warn(`[resources:uploadWritingSample] Could not delete original with PHI: ${destPath}`, delErr);
          }
          const cleanedStat = fs2.statSync(cleanedPath);
          imported.push({
            id: cleanedBase,
            category: "writing-samples",
            originalFilename: cleanedBase,
            storedPath: cleanedPath,
            fileSize: cleanedStat.size,
            mimeType: "text/plain",
            uploadedAt: cleanedStat.mtime.toISOString(),
            phiStripped: entityCount > 0
          });
          reports2.push({
            filename: destFilename,
            originalSize: rawText.length,
            cleanedSize: cleanedText.length,
            entityCount,
            typeBreakdown,
            presidioUsed,
            cleanedPath,
            cleanedPreview: cleanedText.slice(0, 500)
          });
        }
        console.log(`[resources:uploadWritingSample] Processed ${imported.length} files, stripped ${totalPhiStripped} total PHI entities (sidecar=${sidecarAvailable})`);
        return ok({ imported, reports: reports2, totalPhiStripped, sidecarAvailable });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Writing sample upload failed";
        console.error("[resources:uploadWritingSample]", message);
        return fail("WRITING_SAMPLE_UPLOAD_FAILED", message);
      }
    }
  );
  electron.ipcMain.handle(
    "resources:previewCleaned",
    async (_event, params) => {
      try {
        const filePath = params.storedPath;
        if (!fs2.existsSync(filePath)) {
          return fail("RESOURCE_NOT_FOUND", `File not found: ${filePath}`);
        }
        const ext = pathMod.extname(filePath).toLowerCase();
        let cleanedText = "";
        if (ext === ".pdf") {
          try {
            const pdfBuffer = fs2.readFileSync(filePath);
            const pdfData = await pdfParse(pdfBuffer);
            cleanedText = pdfData.text ?? "";
          } catch {
            cleanedText = "(Could not extract text from PDF)";
          }
        } else {
          cleanedText = await extractText2(filePath);
        }
        const markers = cleanedText.match(/\[(?:PERSON|DATE_TIME|PHONE_NUMBER|EMAIL_ADDRESS|US_SSN|LOCATION|CREDIT_CARD|CRYPTO|US_BANK_NUMBER|US_DRIVER_LICENSE|US_ITIN|US_PASSPORT|IP_ADDRESS|MEDICAL_LICENSE|URL|NRP|SSN REMOVED|DOB REMOVED|PHONE REMOVED|EMAIL REMOVED|ADDRESS REMOVED|UNID-[a-z0-9]+)\]/gi);
        const entityCount = markers ? markers.length : 0;
        return ok({
          cleanedText,
          originalText: "(Original with PHI was permanently deleted after de-identification)",
          entityCount,
          typeBreakdown: {}
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Preview failed";
        return fail("PREVIEW_FAILED", message);
      }
    }
  );
  electron.ipcMain.handle(
    "resources:analyzeStyle",
    async (_event, params) => {
      try {
        const CLINICAL_TERMS = /* @__PURE__ */ new Set([
          "evaluation",
          "assessment",
          "clinical",
          "forensic",
          "diagnosis",
          "diagnostic",
          "psychological",
          "psychiatric",
          "cognitive",
          "behavioral",
          "affective",
          "competency",
          "competent",
          "malingering",
          "symptom",
          "symptoms",
          "disorder",
          "impairment",
          "functioning",
          "history",
          "interview",
          "collateral",
          "records",
          "testing",
          "administered",
          "results",
          "scale",
          "score",
          "scores",
          "percentile",
          "profile",
          "validity",
          "criteria",
          "criterion",
          "consistent",
          "inconsistent",
          "reported",
          "presented",
          "observed",
          "exhibited",
          "endorsed",
          "denied",
          "treatment",
          "medication",
          "substance",
          "trauma",
          "risk",
          "recommendation",
          "opinion",
          "conclusion",
          "formulation",
          "defendant",
          "plaintiff",
          "petitioner",
          "respondent",
          "examinee",
          "evaluee",
          "claimant",
          "referred",
          "referral",
          "court",
          "adjudicative",
          "rational",
          "factual",
          "understanding",
          "prognosis",
          "etiology",
          "differential",
          "comorbid",
          "severity",
          "baseline",
          "normative",
          "standardized",
          "psychometric",
          "reliability",
          "validity",
          "credibility",
          "effort"
        ]);
        const HEDGING_PATTERNS = [
          "appears to",
          "is consistent with",
          "is inconsistent with",
          "suggests that",
          "it is likely that",
          "it is unlikely that",
          "to a reasonable degree of",
          "within a reasonable degree",
          "more likely than not",
          "based on the available",
          "the data suggest",
          "the results indicate",
          "in this examiner's opinion",
          "in my professional opinion",
          "the evidence suggests",
          "it should be noted",
          "notably",
          "it is important to note",
          "cannot be ruled out",
          "may be attributed to",
          "appears consistent",
          "does not appear to"
        ];
        const FIRST_PERSON = /* @__PURE__ */ new Set(["i", "my", "me", "mine", "myself", "we", "our", "us"]);
        const THIRD_PERSON = /* @__PURE__ */ new Set([
          "he",
          "she",
          "they",
          "his",
          "her",
          "their",
          "him",
          "them",
          "the evaluee",
          "the examinee",
          "the defendant",
          "the plaintiff",
          "the claimant",
          "the respondent",
          "the petitioner",
          "mr",
          "ms",
          "mrs",
          "dr"
        ]);
        const PAST_ENDINGS = ["ed", "was", "were", "had", "did", "said", "told", "went", "came", "gave", "made", "took"];
        const profiles = [];
        for (const storedPath of params.storedPaths) {
          const ext = pathMod.extname(storedPath).toLowerCase();
          const dir = pathMod.dirname(storedPath);
          const cleanedBase = cleanedBaseName(storedPath, ext);
          const cleanedPath = pathMod.join(dir, "_cleaned", cleanedBase);
          let text = "";
          if (fs2.existsSync(cleanedPath)) {
            text = fs2.readFileSync(cleanedPath, "utf-8");
          } else if (fs2.existsSync(storedPath)) {
            text = await extractText2(storedPath);
          }
          if (!text || text.trim().length === 0) {
            profiles.push({
              filename: pathMod.basename(storedPath),
              avgSentenceLength: 0,
              medianSentenceLength: 0,
              wordCount: 0,
              sentenceCount: 0,
              paragraphCount: 0,
              avgParagraphLength: 0,
              vocabularyRichness: 0,
              topTerms: [],
              hedgingPhrases: [],
              personReference: { firstPerson: 0, thirdPerson: 0 },
              tenseDistribution: { past: 0, present: 0 },
              sectionHeadings: [],
              formalityScore: 0
            });
            continue;
          }
          const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
          const paragraphCount = paragraphs.length;
          const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z])/).filter((s) => s.trim().length > 5);
          const sentenceCount = Math.max(sentences.length, 1);
          const sentenceLengths = sentences.map((s) => s.split(/\s+/).filter((w) => w.length > 0).length);
          sentenceLengths.sort((a, b) => a - b);
          const avgSentenceLength2 = sentenceLengths.length > 0 ? Math.round(sentenceLengths.reduce((sum, l) => sum + l, 0) / sentenceLengths.length * 10) / 10 : 0;
          const medianSentenceLength = sentenceLengths.length > 0 ? sentenceLengths[Math.floor(sentenceLengths.length / 2)] : 0;
          const words = text.toLowerCase().split(/\s+/).filter((w) => w.length > 0);
          const wordCount = words.length;
          const cleanWords = words.map((w) => w.replace(/[^a-z'-]/g, "")).filter((w) => w.length > 1);
          const uniqueWords = new Set(cleanWords);
          const vocabularyRichness2 = wordCount > 0 ? Math.round(uniqueWords.size / wordCount * 1e3) / 1e3 : 0;
          const avgParagraphLength = paragraphCount > 0 ? Math.round(sentenceCount / paragraphCount * 10) / 10 : 0;
          const termCounts = {};
          for (const w of cleanWords) {
            if (CLINICAL_TERMS.has(w)) {
              termCounts[w] = (termCounts[w] || 0) + 1;
            }
          }
          const topTerms2 = Object.entries(termCounts).sort(([, a], [, b]) => b - a).slice(0, 20).map(([term, count]) => ({ term, count }));
          const lowerText = text.toLowerCase();
          const hedgingPhrases2 = [];
          for (const phrase of HEDGING_PATTERNS) {
            const regex = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
            const matches = text.match(regex);
            if (matches && matches.length > 0) {
              hedgingPhrases2.push({ phrase, count: matches.length });
            }
          }
          hedgingPhrases2.sort((a, b) => b.count - a.count);
          let firstPersonCount = 0;
          let thirdPersonCount = 0;
          for (const w of cleanWords) {
            if (FIRST_PERSON.has(w)) firstPersonCount++;
            if (THIRD_PERSON.has(w)) thirdPersonCount++;
          }
          const totalPerson = Math.max(firstPersonCount + thirdPersonCount, 1);
          const personReference2 = {
            firstPerson: Math.round(firstPersonCount / totalPerson * 100),
            thirdPerson: Math.round(thirdPersonCount / totalPerson * 100)
          };
          let pastCount = 0;
          let presentCount = 0;
          for (const w of cleanWords) {
            if (PAST_ENDINGS.includes(w) || w.endsWith("ed") && w.length > 3) pastCount++;
            else if (w.endsWith("s") && !w.endsWith("ss") && w.length > 3) presentCount++;
          }
          const totalTense = Math.max(pastCount + presentCount, 1);
          const tenseDistribution2 = {
            past: Math.round(pastCount / totalTense * 100),
            present: Math.round(presentCount / totalTense * 100)
          };
          const sectionHeadings2 = [];
          for (const line of text.split("\n")) {
            const trimmed = line.trim();
            if (trimmed.length < 3 || trimmed.length > 80) continue;
            if (/^[A-Z\s:]+$/.test(trimmed) && trimmed.split(/\s+/).length >= 2) {
              sectionHeadings2.push(trimmed);
            } else if (/^[A-Z][a-z].*:$/.test(trimmed) && trimmed.split(/\s+/).length <= 8) {
              sectionHeadings2.push(trimmed);
            }
          }
          const formalityScore2 = Math.min(1, Math.max(
            0,
            Math.min(avgSentenceLength2 / 30, 1) * 0.25 + (1 - firstPersonCount / totalPerson) * 0.25 + Math.min(vocabularyRichness2 / 0.5, 1) * 0.25 + Math.min(topTerms2.length / 15, 1) * 0.25
          ));
          profiles.push({
            filename: pathMod.basename(storedPath),
            avgSentenceLength: avgSentenceLength2,
            medianSentenceLength,
            wordCount,
            sentenceCount,
            paragraphCount,
            avgParagraphLength,
            vocabularyRichness: vocabularyRichness2,
            topTerms: topTerms2,
            hedgingPhrases: hedgingPhrases2,
            personReference: personReference2,
            tenseDistribution: tenseDistribution2,
            sectionHeadings: sectionHeadings2.slice(0, 30),
            formalityScore: Math.round(formalityScore2 * 100) / 100
          });
        }
        const totalWordCount = profiles.reduce((s, p) => s + p.wordCount, 0);
        const avgSentenceLength = profiles.length > 0 ? Math.round(profiles.reduce((s, p) => s + p.avgSentenceLength, 0) / profiles.length * 10) / 10 : 0;
        const vocabularyRichness = profiles.length > 0 ? Math.round(profiles.reduce((s, p) => s + p.vocabularyRichness, 0) / profiles.length * 1e3) / 1e3 : 0;
        const formalityScore = profiles.length > 0 ? Math.round(profiles.reduce((s, p) => s + p.formalityScore, 0) / profiles.length * 100) / 100 : 0;
        const mergedTerms = {};
        for (const p of profiles) {
          for (const t of p.topTerms) {
            mergedTerms[t.term] = (mergedTerms[t.term] || 0) + t.count;
          }
        }
        const topTerms = Object.entries(mergedTerms).sort(([, a], [, b]) => b - a).slice(0, 20).map(([term, count]) => ({ term, count }));
        const mergedHedging = {};
        for (const p of profiles) {
          for (const h of p.hedgingPhrases) {
            mergedHedging[h.phrase] = (mergedHedging[h.phrase] || 0) + h.count;
          }
        }
        const hedgingPhrases = Object.entries(mergedHedging).sort(([, a], [, b]) => b - a).slice(0, 15).map(([phrase, count]) => ({ phrase, count }));
        let aggFirstPerson = 0;
        let aggThirdPerson = 0;
        let aggPast = 0;
        let aggPresent = 0;
        const allHeadings = [];
        for (const p of profiles) {
          aggFirstPerson += p.personReference.firstPerson;
          aggThirdPerson += p.personReference.thirdPerson;
          aggPast += p.tenseDistribution.past;
          aggPresent += p.tenseDistribution.present;
          for (const h of p.sectionHeadings) {
            if (!allHeadings.includes(h)) allHeadings.push(h);
          }
        }
        const personCount = profiles.length || 1;
        const personReference = {
          firstPerson: Math.round(aggFirstPerson / personCount),
          thirdPerson: Math.round(aggThirdPerson / personCount)
        };
        const tenseDistribution = {
          past: Math.round(aggPast / personCount),
          present: Math.round(aggPresent / personCount)
        };
        const sectionHeadings = allHeadings.slice(0, 30);
        const aggregate = {
          avgSentenceLength,
          vocabularyRichness,
          formalityScore,
          topTerms,
          hedgingPhrases,
          sampleCount: profiles.length,
          totalWordCount,
          personReference,
          tenseDistribution,
          sectionHeadings
        };
        try {
          const profilePath = pathMod.join(getCategoryDir("writing-samples"), ".style-profile.json");
          const persisted = {
            version: 1,
            updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
            ...aggregate
          };
          fs2.writeFileSync(profilePath, JSON.stringify(persisted, null, 2), "utf-8");
        } catch (persistErr) {
          console.warn("[resources:analyzeStyle] Could not persist style profile:", persistErr);
        }
        return ok({ profiles, aggregate });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Style analysis failed";
        console.error("[resources:analyzeStyle]", message);
        return fail("STYLE_ANALYSIS_FAILED", message);
      }
    }
  );
  electron.ipcMain.handle(
    "resources:getStyleProfile",
    async () => {
      try {
        const profilePath = pathMod.join(getCategoryDir("writing-samples"), ".style-profile.json");
        if (!fs2.existsSync(profilePath)) return ok(null);
        const raw = fs2.readFileSync(profilePath, "utf-8");
        return ok(JSON.parse(raw));
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to load style profile";
        console.error("[resources:getStyleProfile]", message);
        return ok(null);
      }
    }
  );
  electron.ipcMain.handle(
    "resources:recalculateStyleProfile",
    async () => {
      try {
        const cleanedDir = pathMod.join(getCategoryDir("writing-samples"), "_cleaned");
        if (!fs2.existsSync(cleanedDir)) {
          return ok({ profiles: [], aggregate: null });
        }
        const allFiles = fs2.readdirSync(cleanedDir).filter((f) => f.endsWith(".txt") && !f.startsWith(".")).map((f) => pathMod.join(getCategoryDir("writing-samples"), f.replace(".txt", ".original-stub")));
        const txtFiles = fs2.readdirSync(cleanedDir).filter((f) => f.endsWith(".txt") && !f.startsWith("."));
        const catDir = getCategoryDir("writing-samples");
        const storedPaths = txtFiles.map((f) => pathMod.join(catDir, f));
        if (storedPaths.length === 0) {
          return ok({ profiles: [], aggregate: null });
        }
        const { ipcMain: ipc } = require("electron");
        const result = await ipc.emit("resources:analyzeStyle", {}, { storedPaths });
        const profiles = [];
        const CLINICAL_TERMS = /* @__PURE__ */ new Set([
          "evaluation",
          "assessment",
          "clinical",
          "forensic",
          "diagnosis",
          "diagnostic",
          "psychological",
          "psychiatric",
          "cognitive",
          "behavioral",
          "affective",
          "competency",
          "competent",
          "malingering",
          "symptom",
          "symptoms",
          "disorder",
          "impairment",
          "functioning",
          "history",
          "interview",
          "collateral",
          "records",
          "testing",
          "administered",
          "results",
          "scale",
          "score",
          "scores",
          "percentile",
          "profile",
          "validity",
          "criteria",
          "criterion",
          "consistent",
          "inconsistent",
          "reported",
          "presented",
          "observed",
          "exhibited",
          "endorsed",
          "denied",
          "treatment",
          "medication",
          "substance",
          "trauma",
          "risk",
          "recommendation",
          "opinion",
          "conclusion",
          "formulation",
          "defendant",
          "plaintiff",
          "petitioner",
          "respondent",
          "examinee",
          "evaluee",
          "claimant",
          "referred",
          "referral",
          "court",
          "adjudicative",
          "rational",
          "factual",
          "understanding",
          "prognosis",
          "etiology",
          "differential",
          "comorbid",
          "severity",
          "baseline",
          "normative",
          "standardized",
          "psychometric",
          "reliability",
          "validity",
          "credibility",
          "effort"
        ]);
        const HEDGING_PATTERNS = [
          "appears to",
          "is consistent with",
          "is inconsistent with",
          "suggests that",
          "it is likely that",
          "it is unlikely that",
          "to a reasonable degree of",
          "within a reasonable degree",
          "more likely than not",
          "based on the available",
          "the data suggest",
          "the results indicate",
          "in this examiner's opinion",
          "in my professional opinion",
          "the evidence suggests",
          "it should be noted",
          "notably",
          "it is important to note",
          "cannot be ruled out",
          "may be attributed to",
          "appears consistent",
          "does not appear to"
        ];
        const FIRST_PERSON = /* @__PURE__ */ new Set(["i", "my", "me", "mine", "myself", "we", "our", "us"]);
        const THIRD_PERSON = /* @__PURE__ */ new Set([
          "he",
          "she",
          "they",
          "his",
          "her",
          "their",
          "him",
          "them",
          "the evaluee",
          "the examinee",
          "the defendant",
          "the plaintiff",
          "the claimant",
          "the respondent",
          "the petitioner",
          "mr",
          "ms",
          "mrs",
          "dr"
        ]);
        const PAST_ENDINGS = ["ed", "was", "were", "had", "did", "said", "told", "went", "came", "gave", "made", "took"];
        for (const txtFile of txtFiles) {
          const text = fs2.readFileSync(pathMod.join(cleanedDir, txtFile), "utf-8");
          if (!text || text.trim().length === 0) continue;
          const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
          const paragraphCount = paragraphs.length;
          const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z])/).filter((s) => s.trim().length > 5);
          const sentenceCount = Math.max(sentences.length, 1);
          const sentenceLengths = sentences.map((s) => s.split(/\s+/).filter((w) => w.length > 0).length);
          sentenceLengths.sort((a, b) => a - b);
          const avgSentenceLength = sentenceLengths.length > 0 ? Math.round(sentenceLengths.reduce((sum, l) => sum + l, 0) / sentenceLengths.length * 10) / 10 : 0;
          const medianSentenceLength = sentenceLengths.length > 0 ? sentenceLengths[Math.floor(sentenceLengths.length / 2)] : 0;
          const words = text.toLowerCase().split(/\s+/).filter((w) => w.length > 0);
          const wordCount = words.length;
          const cleanWords = words.map((w) => w.replace(/[^a-z'-]/g, "")).filter((w) => w.length > 1);
          const uniqueWords = new Set(cleanWords);
          const vocabularyRichness = wordCount > 0 ? Math.round(uniqueWords.size / wordCount * 1e3) / 1e3 : 0;
          const avgParagraphLength = paragraphCount > 0 ? Math.round(sentenceCount / paragraphCount * 10) / 10 : 0;
          const termCounts = {};
          for (const w of cleanWords) {
            if (CLINICAL_TERMS.has(w)) termCounts[w] = (termCounts[w] || 0) + 1;
          }
          const topTerms = Object.entries(termCounts).sort(([, a], [, b]) => b - a).slice(0, 20).map(([term, count]) => ({ term, count }));
          const lowerText = text.toLowerCase();
          const hedgingPhrases = [];
          for (const phrase of HEDGING_PATTERNS) {
            const regex = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
            const matches = text.match(regex);
            if (matches && matches.length > 0) hedgingPhrases.push({ phrase, count: matches.length });
          }
          hedgingPhrases.sort((a, b) => b.count - a.count);
          let firstPersonCount = 0;
          let thirdPersonCount = 0;
          for (const w of cleanWords) {
            if (FIRST_PERSON.has(w)) firstPersonCount++;
            if (THIRD_PERSON.has(w)) thirdPersonCount++;
          }
          const totalPerson = Math.max(firstPersonCount + thirdPersonCount, 1);
          const personReference = {
            firstPerson: Math.round(firstPersonCount / totalPerson * 100),
            thirdPerson: Math.round(thirdPersonCount / totalPerson * 100)
          };
          let pastCount = 0;
          let presentCount = 0;
          for (const w of cleanWords) {
            if (PAST_ENDINGS.includes(w) || w.endsWith("ed") && w.length > 3) pastCount++;
            else if (w.endsWith("s") && !w.endsWith("ss") && w.length > 3) presentCount++;
          }
          const totalTense = Math.max(pastCount + presentCount, 1);
          const tenseDistribution = {
            past: Math.round(pastCount / totalTense * 100),
            present: Math.round(presentCount / totalTense * 100)
          };
          const sectionHeadings = [];
          for (const line of text.split("\n")) {
            const trimmed = line.trim();
            if (trimmed.length < 3 || trimmed.length > 80) continue;
            if (/^[A-Z\s:]+$/.test(trimmed) && trimmed.split(/\s+/).length >= 2) sectionHeadings.push(trimmed);
            else if (/^[A-Z][a-z].*:$/.test(trimmed) && trimmed.split(/\s+/).length <= 8) sectionHeadings.push(trimmed);
          }
          const formalityScore = Math.min(1, Math.max(
            0,
            Math.min(avgSentenceLength / 30, 1) * 0.25 + (1 - firstPersonCount / totalPerson) * 0.25 + Math.min(vocabularyRichness / 0.5, 1) * 0.25 + Math.min(topTerms.length / 15, 1) * 0.25
          ));
          profiles.push({
            filename: txtFile,
            avgSentenceLength,
            medianSentenceLength,
            wordCount,
            sentenceCount,
            paragraphCount,
            avgParagraphLength,
            vocabularyRichness,
            topTerms,
            hedgingPhrases,
            personReference,
            tenseDistribution,
            sectionHeadings: sectionHeadings.slice(0, 30),
            formalityScore: Math.round(formalityScore * 100) / 100
          });
        }
        const totalWordCount = profiles.reduce((s, p) => s + p.wordCount, 0);
        const aggAvgSL = profiles.length > 0 ? Math.round(profiles.reduce((s, p) => s + p.avgSentenceLength, 0) / profiles.length * 10) / 10 : 0;
        const aggVR = profiles.length > 0 ? Math.round(profiles.reduce((s, p) => s + p.vocabularyRichness, 0) / profiles.length * 1e3) / 1e3 : 0;
        const aggFS = profiles.length > 0 ? Math.round(profiles.reduce((s, p) => s + p.formalityScore, 0) / profiles.length * 100) / 100 : 0;
        const mergedTerms = {};
        for (const p of profiles) {
          for (const t of p.topTerms) {
            mergedTerms[t.term] = (mergedTerms[t.term] || 0) + t.count;
          }
        }
        const aggTopTerms = Object.entries(mergedTerms).sort(([, a], [, b]) => b - a).slice(0, 20).map(([term, count]) => ({ term, count }));
        const mergedHedging2 = {};
        for (const p of profiles) {
          for (const h of p.hedgingPhrases) {
            mergedHedging2[h.phrase] = (mergedHedging2[h.phrase] || 0) + h.count;
          }
        }
        const aggHedging = Object.entries(mergedHedging2).sort(([, a], [, b]) => b - a).slice(0, 15).map(([phrase, count]) => ({ phrase, count }));
        let aFP = 0, aTP = 0, aPast = 0, aPres = 0;
        const allH = [];
        for (const p of profiles) {
          aFP += p.personReference.firstPerson;
          aTP += p.personReference.thirdPerson;
          aPast += p.tenseDistribution.past;
          aPres += p.tenseDistribution.present;
          for (const h of p.sectionHeadings) {
            if (!allH.includes(h)) allH.push(h);
          }
        }
        const pc = profiles.length || 1;
        const aggregate = {
          avgSentenceLength: aggAvgSL,
          vocabularyRichness: aggVR,
          formalityScore: aggFS,
          topTerms: aggTopTerms,
          hedgingPhrases: aggHedging,
          sampleCount: profiles.length,
          totalWordCount,
          personReference: { firstPerson: Math.round(aFP / pc), thirdPerson: Math.round(aTP / pc) },
          tenseDistribution: { past: Math.round(aPast / pc), present: Math.round(aPres / pc) },
          sectionHeadings: allH.slice(0, 30)
        };
        try {
          const profilePath = pathMod.join(getCategoryDir("writing-samples"), ".style-profile.json");
          fs2.writeFileSync(profilePath, JSON.stringify({ version: 1, updatedAt: (/* @__PURE__ */ new Date()).toISOString(), ...aggregate }, null, 2), "utf-8");
        } catch (_) {
        }
        return ok({ profiles, aggregate });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Recalculation failed";
        console.error("[resources:recalculateStyleProfile]", message);
        return fail("RECALCULATE_FAILED", message);
      }
    }
  );
  electron.ipcMain.handle(
    "resources:read",
    async (_event, params) => {
      try {
        const filePath = params.storedPath;
        if (!fs2.existsSync(filePath)) {
          return fail("RESOURCE_NOT_FOUND", `File not found: ${filePath}`);
        }
        const ext = pathMod.extname(filePath).toLowerCase();
        const mime = mimeForExt(ext);
        if ([".txt", ".md", ".csv", ".rtf", ".json", ".xml", ".html", ".htm", ".yaml", ".yml", ".toml", ".ini", ".cfg", ".log"].includes(ext)) {
          const content2 = fs2.readFileSync(filePath, "utf-8");
          const { cleaned, strippedCount } = stripPhi(content2);
          return ok({ content: content2, redacted: cleaned, encoding: "text", mimeType: mime, phiCount: strippedCount });
        }
        if (ext === ".docx" || ext === ".doc") {
          try {
            const buffer = fs2.readFileSync(filePath);
            const htmlResult = await mammoth.convertToHtml({ buffer });
            const html = htmlResult.value ?? "";
            const { cleaned, strippedCount } = stripPhi(html);
            return ok({ content: html, redacted: cleaned, encoding: "html", mimeType: "text/html", phiCount: strippedCount });
          } catch {
            try {
              const buffer = fs2.readFileSync(filePath);
              const textResult = await mammoth.extractRawText({ buffer });
              const text = textResult.value ?? "";
              const { cleaned, strippedCount } = stripPhi(text);
              return ok({ content: text, redacted: cleaned, encoding: "text", mimeType: "text/plain", phiCount: strippedCount });
            } catch {
              const content2 = fs2.readFileSync(filePath).toString("base64");
              return ok({ content: content2, redacted: content2, encoding: "base64", mimeType: mime, phiCount: 0 });
            }
          }
        }
        if (ext === ".pdf") {
          const pdfBuffer = fs2.readFileSync(filePath);
          const base64 = pdfBuffer.toString("base64");
          let redactedHtml = "";
          let phiCount = 0;
          try {
            const pdfData = await pdfParse(pdfBuffer);
            const text = pdfData.text ?? "";
            const { cleaned, strippedCount } = stripPhi(text);
            phiCount = strippedCount;
            redactedHtml = cleaned.split("\n").map(
              (line) => line.trim() ? `<p>${line.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>` : ""
            ).filter(Boolean).join("\n");
          } catch {
            redactedHtml = "<p><em>Could not extract text for PHI redaction.</em></p>";
          }
          return ok({ content: base64, redacted: redactedHtml, encoding: "pdf-base64", mimeType: mime, phiCount, localFilePath: filePath });
        }
        const content = fs2.readFileSync(filePath).toString("base64");
        return ok({ content, redacted: content, encoding: "base64", mimeType: mime, phiCount: 0 });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Resource read failed";
        return fail("RESOURCE_READ_FAILED", message);
      }
    }
  );
}
function registerTemplateHandlers() {
  const fs2 = require("fs");
  const pathMod = require("path");
  const mammoth = require("mammoth");
  const AdmZip = require("adm-zip");
  function getTemplatesDir() {
    const wsPath = loadWorkspacePath() || getDefaultWorkspacePath();
    return pathMod.join(wsPath, "Workspace", "Templates");
  }
  function getCustomDir() {
    const dir = pathMod.join(getTemplatesDir(), "_custom");
    if (!fs2.existsSync(dir)) fs2.mkdirSync(dir, { recursive: true });
    return dir;
  }
  function getTempDir() {
    const dir = pathMod.join(getTemplatesDir(), "_temp");
    if (!fs2.existsSync(dir)) fs2.mkdirSync(dir, { recursive: true });
    return dir;
  }
  function getPrefsPath() {
    return pathMod.join(getTemplatesDir(), ".template-prefs.json");
  }
  function loadPrefs() {
    const p = getPrefsPath();
    if (!fs2.existsSync(p)) return {};
    try {
      return JSON.parse(fs2.readFileSync(p, "utf-8"));
    } catch {
      return {};
    }
  }
  function savePrefs(prefs) {
    fs2.writeFileSync(getPrefsPath(), JSON.stringify(prefs, null, 2), "utf-8");
  }
  const EVAL_TYPE_KEYWORDS = {
    "CST": ["competency to stand trial", "competence to stand trial", "dusky", "competency evaluation", "competent to proceed"],
    "Custody": ["child custody", "custody evaluation", "best interests of the child", "parenting time", "parenting plan", "custody assessment"],
    "Risk Assessment": ["risk assessment", "violence risk", "sexual reoffense", "hcr-20", "static-99", "vrag", "risk for future violence"],
    "Fitness for Duty": ["fitness for duty", "fitness-for-duty", "fit for duty", "essential job functions", "return to duty", "iacp"],
    "PTSD Dx": ["ptsd", "posttraumatic stress", "post-traumatic stress", "caps-5", "pcl-5", "criterion a", "traumatic event"],
    "ADHD Dx": ["adhd", "attention-deficit", "attention deficit", "hyperactivity disorder", "diva-5", "caadid", "inattention"],
    "Malingering": ["malingering", "symptom validity", "feigning", "performance validity", "slick criteria", "rogers model", "effort testing"]
  };
  function detectEvalType(text) {
    const lower = text.toLowerCase();
    const scores = {};
    for (const [evalType, keywords] of Object.entries(EVAL_TYPE_KEYWORDS)) {
      let score = 0;
      for (const kw of keywords) {
        const regex = new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
        const matches = lower.match(regex);
        if (matches) score += matches.length;
      }
      scores[evalType] = score;
    }
    let best = "CST";
    let bestScore = 0;
    for (const [evalType, score] of Object.entries(scores)) {
      if (score > bestScore) {
        bestScore = score;
        best = evalType;
      }
    }
    return best;
  }
  function parseSections(text) {
    const lines = text.split("\n").filter((l) => l.trim().length > 0);
    const sections = [];
    let currentHeading = "";
    let currentBody = [];
    let order = 0;
    for (const line of lines) {
      const trimmed = line.trim();
      const isHeading = trimmed.length < 100 && trimmed.length > 2 && (trimmed === trimmed.toUpperCase() || /^[A-Z][A-Z\s&:,\-/()]+$/.test(trimmed)) && !/^\d+$/.test(trimmed);
      if (isHeading) {
        if (currentHeading && currentBody.length > 0) {
          const prose = currentBody.join("\n");
          sections.push({
            heading: currentHeading,
            contentType: detectContentType(prose),
            exampleProse: prose,
            estimatedLength: estimateLength(prose),
            order: order++
          });
        }
        currentHeading = trimmed;
        currentBody = [];
      } else {
        currentBody.push(trimmed);
      }
    }
    if (currentHeading && currentBody.length > 0) {
      const prose = currentBody.join("\n");
      sections.push({
        heading: currentHeading,
        contentType: detectContentType(prose),
        exampleProse: prose,
        estimatedLength: estimateLength(prose),
        order: order++
      });
    }
    if (sections.length === 0 && text.trim().length > 0) {
      sections.push({
        heading: "Full Report",
        contentType: "narrative",
        exampleProse: text.trim(),
        estimatedLength: estimateLength(text),
        order: 0
      });
    }
    return sections;
  }
  function detectContentType(text) {
    const lines = text.split("\n");
    let listLines = 0;
    let tableLines = 0;
    let narrativeLines = 0;
    for (const line of lines) {
      const trimmed = line.trim();
      if (/^[\-*]\s/.test(trimmed) || /^\d+[.)]\s/.test(trimmed)) {
        listLines++;
      } else if (/\t.*\t/.test(trimmed) || /\s{3,}/.test(trimmed)) {
        tableLines++;
      } else {
        narrativeLines++;
      }
    }
    const total = lines.length;
    if (total === 0) return "narrative";
    if (tableLines / total > 0.3) return "table";
    if (listLines / total > 0.4) return "list";
    if (listLines > 0 && narrativeLines > 0) return "mixed";
    return "narrative";
  }
  function estimateLength(text) {
    const words = text.split(/\s+/).length;
    if (words < 80) return "brief";
    if (words < 300) return "moderate";
    return "extensive";
  }
  async function analyzeFormatting(filePath) {
    const defaults = {
      margins: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
      // 1 inch = 1440 twips
      fontFamily: "Times New Roman",
      fontSize: 12,
      lineSpacing: 1.5,
      headingFont: "Times New Roman",
      headingSize: 14,
      headerContent: "",
      footerContent: ""
    };
    try {
      const buffer = fs2.readFileSync(filePath);
      const htmlResult = await mammoth.convertToHtml({ buffer });
      const html = htmlResult.value ?? "";
      const fontMatch = html.match(/font-family:\s*['"]?([^'";}]+)/i);
      if (fontMatch) {
        defaults.fontFamily = fontMatch[1].trim();
        defaults.headingFont = fontMatch[1].trim();
      }
      const sizeMatch = html.match(/font-size:\s*(\d+)pt/i);
      if (sizeMatch) {
        defaults.fontSize = parseInt(sizeMatch[1], 10);
      }
      const headerMatch = html.match(/<p[^>]*style="text-align:\s*center[^"]*"[^>]*>(.*?)<\/p>/i);
      if (headerMatch) {
        defaults.headerContent = headerMatch[1].replace(/<[^>]+>/g, "").trim();
      }
    } catch {
    }
    return defaults;
  }
  function stripPhiFromDocx(srcPath, destPath) {
    const zip = new AdmZip(srcPath);
    let totalCount = 0;
    const xmlEntries = ["word/document.xml", "word/header1.xml", "word/header2.xml", "word/header3.xml", "word/footer1.xml", "word/footer2.xml", "word/footer3.xml", "word/comments.xml", "word/endnotes.xml", "word/footnotes.xml"];
    for (const entryName of xmlEntries) {
      const entry = zip.getEntry(entryName);
      if (!entry) continue;
      let xml = entry.getData().toString("utf-8");
      xml = xml.replace(/>([^<]+)</g, (fullMatch, textContent) => {
        if (!textContent.trim()) return fullMatch;
        const { cleaned, strippedCount } = stripPhiFromText(textContent);
        totalCount += strippedCount;
        if (strippedCount > 0) return `>${cleaned}<`;
        return fullMatch;
      });
      zip.updateFile(entryName, Buffer.from(xml, "utf-8"));
    }
    zip.writeZip(destPath);
    return { strippedCount: totalCount };
  }
  function stripPhiFromText(text) {
    let count = 0;
    let cleaned = text;
    cleaned = cleaned.replace(/\b\d{3}[-.]?\d{2}[-.]?\d{4}\b/g, () => {
      count++;
      return "[SSN REMOVED]";
    });
    cleaned = cleaned.replace(/\b(0?[1-9]|1[0-2])[/\-](0?[1-9]|[12]\d|3[01])[/\-](19|20)\d{2}\b/g, () => {
      count++;
      return "[DATE REMOVED]";
    });
    cleaned = cleaned.replace(/\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+\d{1,2},?\s+(19|20)\d{2}\b/gi, () => {
      count++;
      return "[DATE REMOVED]";
    });
    cleaned = cleaned.replace(/\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+(19|20)\d{2}\b/gi, () => {
      count++;
      return "[DATE REMOVED]";
    });
    cleaned = cleaned.replace(/\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/g, () => {
      count++;
      return "[PHONE REMOVED]";
    });
    cleaned = cleaned.replace(/\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g, () => {
      count++;
      return "[EMAIL REMOVED]";
    });
    cleaned = cleaned.replace(/\b\d{1,5}\s+(?:[NSEW]\.?\s+)?[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,3}\s+(?:St|Ave|Blvd|Dr|Ln|Rd|Ct|Way|Pl|Pkwy|Cir|Terr?|Drive|Lane|Road|Court|Boulevard|Avenue|Street|Parkway|Circle|Terrace|Place)\.?(?:\s*,?\s*(?:Apt|Suite|Ste|Unit|Bldg|#)\s*[#]?\s*[A-Za-z0-9\-]+)?/gi, () => {
      count++;
      return "[ADDRESS REMOVED]";
    });
    cleaned = cleaned.replace(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?,\s*(?:CO|Colorado|CA|NY|TX|FL|AZ|NM|UT|WY|NE|KS|OK)\s+\d{5}(?:-\d{4})?\b/g, () => {
      count++;
      return "[LOCATION REMOVED]";
    });
    cleaned = cleaned.replace(/\bNPI:?\s*\d{10}\b/gi, () => {
      count++;
      return "[NPI REMOVED]";
    });
    cleaned = cleaned.replace(/\bDEA:?\s*[A-Za-z]{2}\d{7}\b/gi, () => {
      count++;
      return "[DEA REMOVED]";
    });
    cleaned = cleaned.replace(/\bMRN:?\s*[A-Z]{1,5}-?\d{4}-?\d{3,8}\b/gi, () => {
      count++;
      return "[MRN REMOVED]";
    });
    cleaned = cleaned.replace(/\bRx\s*#?\s*[A-Za-z]*-?\d{4,10}\b/gi, () => {
      count++;
      return "[RX REMOVED]";
    });
    cleaned = cleaned.replace(/\b(?:Member\s*ID|Medicaid\s*ID|Insurance\s*ID|Group\s*#?|Policy\s*#?|Claim\s*#?)\s*:?\s*[A-Za-z0-9\-]{5,20}\b/gi, () => {
      count++;
      return "[INSURANCE ID REMOVED]";
    });
    cleaned = cleaned.replace(/\b(?:driver'?s?\s*license|DL|CDL)\s*(?:#|number|num|no\.?)?\s*:?\s*[A-Za-z0-9\-]{6,15}\b/gi, () => {
      count++;
      return "[LICENSE REMOVED]";
    });
    cleaned = cleaned.replace(/\b(?:License|Lic)\s*#?\s*:?\s*(?:PSY|CSW|LPC|LCSW|LMFT|PT|OT|MD|DO|RN|NP)-?\d{4,10}\b/gi, () => {
      count++;
      return "[LICENSE REMOVED]";
    });
    cleaned = cleaned.replace(/\b(?:badge|badge\s*#|badge\s*number)\s*:?\s*#?\s*[A-Za-z]*-?\d{2,8}\b/gi, () => {
      count++;
      return "[BADGE REMOVED]";
    });
    cleaned = cleaned.replace(/\b(?:employee\s*ID|staff\s*ID|student\s*ID|offender\s*(?:number|#|ID)|CDOC\s*(?:#|number)?|inmate\s*(?:account|#|ID)|booking\s*#?|case\s*#?|SID|FBI\s*(?:number|#)?)\s*:?\s*[A-Za-z0-9\-]{4,20}\b/gi, () => {
      count++;
      return "[ID REMOVED]";
    });
    cleaned = cleaned.replace(/\b[A-Z]{2,6}-\d{4}-\d{2,8}\b/g, () => {
      count++;
      return "[ID REMOVED]";
    });
    cleaned = cleaned.replace(/\b[A-Z]{2,6}-(?:[A-Z]{2}-)?(?:\d{4}-)*\d{3,8}\b/g, () => {
      count++;
      return "[ID REMOVED]";
    });
    cleaned = cleaned.replace(/\bhttps?:\/\/[^\s]+/gi, () => {
      count++;
      return "[URL REMOVED]";
    });
    const NAME_TITLES = ["Dr", "Mr", "Ms", "Mrs", "Miss", "Prof", "Sgt", "Sergeant", "Lt", "Lieutenant", "Cpl", "Corporal", "Capt", "Captain", "Det", "Detective", "Inv", "Investigator", "Chief", "Officer", "Ofc", "Hon", "Judge", "Justice", "Atty", "Attorney"];
    const titlePattern = NAME_TITLES.join("|");
    cleaned = cleaned.replace(new RegExp(`\\b(?:${titlePattern})\\.?\\s+[A-Z][a-z]+(?:\\s+[A-Z]\\.?)?\\s+[A-Z][a-z]+(?:-[A-Z][a-z]+)?\\b`, "g"), () => {
      count++;
      return "[NAME REMOVED]";
    });
    cleaned = cleaned.replace(new RegExp(`\\b(?:${titlePattern})\\.?\\s+[A-Z][a-z]{2,}\\b`, "g"), () => {
      count++;
      return "[NAME REMOVED]";
    });
    const LABELS = ["Examinee", "Patient", "Client", "Evaluee", "Claimant", "Plaintiff", "Defendant", "Respondent", "Petitioner", "Victim", "Complainant", "Subject"];
    cleaned = cleaned.replace(new RegExp(`\\b(?:${LABELS.join("|")})\\s*:\\s*[A-Z][a-z]+(?:\\s+[A-Z]\\.?)?\\s+[A-Z][a-z]+(?:-[A-Z][a-z]+)?`, "g"), (match) => {
      const label = match.split(":")[0];
      count++;
      return `${label}: [NAME REMOVED]`;
    });
    const COMMON_NON_NAMES = /* @__PURE__ */ new Set(["mental status", "clinical formulation", "relevant background", "referral question", "united states", "supreme court", "social security", "district court", "judicial district", "colorado springs", "fort collins", "denver county", "adams county", "jefferson county", "larimer county", "el paso", "arapahoe county", "boulder county", "douglas county", "weld county", "peak forensics", "full scale", "verbal comprehension", "working memory", "processing speed", "perceptual reasoning"]);
    const COMMON_WORDS = /* @__PURE__ */ new Set(["the", "and", "for", "was", "were", "are", "has", "had", "his", "her", "she", "not", "but", "with", "from", "that", "this", "they", "them", "been", "have", "will", "would", "could", "should", "about", "into", "over", "after", "before", "during", "between", "through", "under", "again", "further", "then", "once", "here", "there", "when", "where", "both", "each", "more", "most", "other", "some", "such", "only", "same", "than", "very", "also", "just", "because", "while", "does", "did", "doing", "being", "having", "getting", "case", "court", "scale", "test", "score", "trial", "level", "total", "index", "factor", "type", "range", "report", "order", "standard", "history", "current", "prior", "first", "second", "third", "diagnosis", "treatment", "evidence", "clinical"]);
    cleaned = cleaned.replace(/\b([A-Z][a-z]{1,15})\s+([A-Z]\.?\s+)?([A-Z][a-z]{1,15}(?:-[A-Z][a-z]{1,15})?)\b/g, (match, first, _mid, last) => {
      if (COMMON_NON_NAMES.has(match.toLowerCase())) return match;
      if (/^[A-Z][a-z]+\s+(The|And|For|With|From|Into|That|This|Each|Both|Such|Over|Upon)\s/i.test(match)) return match;
      if (COMMON_WORDS.has(first.toLowerCase()) || COMMON_WORDS.has(last.toLowerCase())) return match;
      if (first.length < 2 || last.length < 2) return match;
      count++;
      return "[NAME REMOVED]";
    });
    cleaned = cleaned.replace(/\bDate\s+of\s+Birth\s*:\s*\[?[^\]\n]{5,30}\]?/gi, () => {
      count++;
      return "Date of Birth: [DOB REMOVED]";
    });
    return { cleaned, strippedCount: count };
  }
  function nameToId(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  }
  function getBuiltinProfiles() {
    return REPORT_TEMPLATES.map((t) => ({
      version: 1,
      id: t.id,
      name: `${t.title} (Built-in)`,
      evalType: t.evalType,
      source: "builtin",
      createdAt: "2026-03-19T00:00:00.000Z",
      formatting: {
        margins: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
        fontFamily: "Times New Roman",
        fontSize: 12,
        lineSpacing: 1.5,
        headingFont: "Times New Roman",
        headingSize: 14,
        headerContent: "",
        footerContent: ""
      },
      sections: t.sections.map((s, i) => ({
        heading: s.heading,
        contentType: "narrative",
        exampleProse: s.body.join("\n"),
        estimatedLength: s.body.join(" ").split(/\s+/).length < 80 ? "brief" : "moderate",
        order: i
      })),
      sectionCount: t.sections.length,
      docxPath: null
    }));
  }
  function getCustomProfiles() {
    const dir = getCustomDir();
    if (!fs2.existsSync(dir)) return [];
    const files = fs2.readdirSync(dir);
    const profiles = [];
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      try {
        const raw = fs2.readFileSync(pathMod.join(dir, file), "utf-8");
        profiles.push(JSON.parse(raw));
      } catch {
      }
    }
    return profiles;
  }
  electron.ipcMain.handle(
    "templates:analyze",
    async (event, params) => {
      try {
        let filePath = params?.filePath;
        if (!filePath) {
          const parentWindow = electron.BrowserWindow.fromWebContents(event.sender);
          const result = await electron.dialog.showOpenDialog(parentWindow, {
            title: "Upload Report Template (.docx)",
            filters: [
              { name: "Word Documents", extensions: ["docx", "doc"] },
              { name: "All Files", extensions: ["*"] }
            ],
            properties: ["openFile"]
          });
          if (result.canceled || result.filePaths.length === 0) {
            return fail("USER_CANCELLED", "No file selected");
          }
          filePath = result.filePaths[0];
        }
        const buffer = fs2.readFileSync(filePath);
        const extracted = await mammoth.extractRawText({ buffer });
        const rawText = extracted.value ?? "";
        if (!rawText || rawText.trim().length === 0) {
          return fail("EMPTY_DOCUMENT", "No text could be extracted from this document");
        }
        const { cleaned, strippedCount } = stripPhiFromText(rawText);
        const formatting = await analyzeFormatting(filePath);
        const sections = parseSections(cleaned);
        const detectedEvalType = detectEvalType(rawText);
        const originalName = pathMod.basename(filePath, pathMod.extname(filePath));
        const suggestedName = originalName.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        const tempDir = getTempDir();
        const tempDocxPath = pathMod.join(tempDir, `temp_${Date.now()}.docx`);
        stripPhiFromDocx(filePath, tempDocxPath);
        return ok({
          detectedEvalType,
          suggestedName,
          formatting,
          sections,
          cleanedText: cleaned,
          phiStripped: strippedCount,
          tempDocxPath
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Template analysis failed";
        return fail("TEMPLATE_ANALYZE_FAILED", message);
      }
    }
  );
  electron.ipcMain.handle(
    "templates:save",
    async (_event, params) => {
      try {
        const id = nameToId(params.name);
        const customDir = getCustomDir();
        const docxDest = pathMod.join(customDir, `${id}.docx`);
        const profilePath = pathMod.join(customDir, `${id}.json`);
        if (fs2.existsSync(params.tempDocxPath)) {
          fs2.copyFileSync(params.tempDocxPath, docxDest);
          try {
            fs2.unlinkSync(params.tempDocxPath);
          } catch {
          }
        }
        const profile = {
          version: 1,
          id,
          name: params.name,
          evalType: params.evalType,
          source: "custom",
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          formatting: params.formatting,
          sections: params.sections,
          sectionCount: params.sections.length,
          docxPath: docxDest
        };
        fs2.writeFileSync(profilePath, JSON.stringify(profile, null, 2), "utf-8");
        return ok(profile);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Template save failed";
        return fail("TEMPLATE_SAVE_FAILED", message);
      }
    }
  );
  electron.ipcMain.handle(
    "templates:list",
    async (_event, params) => {
      try {
        const builtins = getBuiltinProfiles();
        const custom = getCustomProfiles();
        const all = [...builtins, ...custom];
        const deletedPath = pathMod.join(getTemplatesDir(), ".deleted-builtins.json");
        let deletedIds = [];
        if (fs2.existsSync(deletedPath)) {
          try {
            deletedIds = JSON.parse(fs2.readFileSync(deletedPath, "utf-8"));
          } catch {
          }
        }
        const filtered = all.filter((t) => !deletedIds.includes(t.id)).filter((t) => !params?.evalType || t.evalType === params.evalType);
        const summaries = filtered.map((t) => ({
          id: t.id,
          name: t.name,
          evalType: t.evalType,
          source: t.source,
          sectionCount: t.sectionCount,
          createdAt: t.createdAt,
          docxPath: t.docxPath
        }));
        return ok(summaries);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Template list failed";
        return fail("TEMPLATE_LIST_FAILED", message);
      }
    }
  );
  electron.ipcMain.handle(
    "templates:get",
    async (_event, params) => {
      try {
        const customDir = getCustomDir();
        const customPath = pathMod.join(customDir, `${params.id}.json`);
        if (fs2.existsSync(customPath)) {
          const raw = fs2.readFileSync(customPath, "utf-8");
          return ok(JSON.parse(raw));
        }
        const builtins = getBuiltinProfiles();
        const builtin = builtins.find((t) => t.id === params.id);
        if (builtin) return ok(builtin);
        return fail("TEMPLATE_NOT_FOUND", `Template not found: ${params.id}`);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Template get failed";
        return fail("TEMPLATE_GET_FAILED", message);
      }
    }
  );
  electron.ipcMain.handle(
    "templates:delete",
    async (_event, params) => {
      try {
        const customDir = getCustomDir();
        const customJson = pathMod.join(customDir, `${params.id}.json`);
        const customDocx = pathMod.join(customDir, `${params.id}.docx`);
        if (fs2.existsSync(customJson)) {
          fs2.unlinkSync(customJson);
          if (fs2.existsSync(customDocx)) fs2.unlinkSync(customDocx);
          return ok(void 0);
        }
        const deletedPath = pathMod.join(getTemplatesDir(), ".deleted-builtins.json");
        let deletedIds = [];
        if (fs2.existsSync(deletedPath)) {
          try {
            deletedIds = JSON.parse(fs2.readFileSync(deletedPath, "utf-8"));
          } catch {
          }
        }
        if (!deletedIds.includes(params.id)) {
          deletedIds.push(params.id);
          fs2.writeFileSync(deletedPath, JSON.stringify(deletedIds, null, 2), "utf-8");
        }
        return ok(void 0);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Template delete failed";
        return fail("TEMPLATE_DELETE_FAILED", message);
      }
    }
  );
  electron.ipcMain.handle(
    "templates:open",
    async (_event, params) => {
      try {
        const customDocx = pathMod.join(getCustomDir(), `${params.id}.docx`);
        if (fs2.existsSync(customDocx)) {
          await electron.shell.openPath(customDocx);
          return ok(void 0);
        }
        const templatesDir = getTemplatesDir();
        const files = fs2.readdirSync(templatesDir);
        const match = files.find((f) => f.startsWith(params.id) && f.endsWith(".docx"));
        if (match) {
          await electron.shell.openPath(pathMod.join(templatesDir, match));
          return ok(void 0);
        }
        return fail("TEMPLATE_NOT_FOUND", `No docx found for template: ${params.id}`);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Template open failed";
        return fail("TEMPLATE_OPEN_FAILED", message);
      }
    }
  );
  electron.ipcMain.handle(
    "templates:setLastUsed",
    async (_event, params) => {
      try {
        const prefs = loadPrefs();
        prefs[params.evalType] = params.templateId;
        savePrefs(prefs);
        return ok(void 0);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to save template preference";
        return fail("TEMPLATE_PREF_FAILED", message);
      }
    }
  );
  electron.ipcMain.handle(
    "templates:getLastUsed",
    async (_event, params) => {
      try {
        const prefs = loadPrefs();
        return ok(prefs[params.evalType] || null);
      } catch {
        return ok(null);
      }
    }
  );
}
function registerDiagnosisCatalogHandlers() {
  const { seedDiagnosisCatalog } = require("../db/seed-catalog");
  electron.ipcMain.handle(
    "diagnosisCatalog:search",
    (_event, params) => {
      try {
        const { getSqlite: getSqlite2 } = require("../db/connection");
        const sqlite = getSqlite2();
        seedDiagnosisCatalog(sqlite);
        const limit = Math.min(params.limit ?? 20, 100);
        const q = `%${params.query}%`;
        const rows = sqlite.prepare(
          `SELECT diagnosis_id, code, dsm5tr_code, name, description, category, is_builtin
             FROM diagnosis_catalog
             WHERE code LIKE ? OR dsm5tr_code LIKE ? OR name LIKE ?
             ORDER BY category, name
             LIMIT ?`
        ).all(q, q, q, limit);
        return ok(rows);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Catalog search failed";
        console.error("[diagnosisCatalog:search] error:", message);
        return fail("CATALOG_SEARCH_FAILED", message);
      }
    }
  );
  electron.ipcMain.handle(
    "diagnosisCatalog:list",
    (_event, params) => {
      try {
        const { getSqlite: getSqlite2 } = require("../db/connection");
        const sqlite = getSqlite2();
        seedDiagnosisCatalog(sqlite);
        let rows;
        if (params?.category) {
          rows = sqlite.prepare(
            `SELECT diagnosis_id, code, dsm5tr_code, name, description, category, is_builtin
               FROM diagnosis_catalog
               WHERE category = ?
               ORDER BY name`
          ).all(params.category);
        } else {
          rows = sqlite.prepare(
            `SELECT diagnosis_id, code, dsm5tr_code, name, description, category, is_builtin
               FROM diagnosis_catalog
               ORDER BY category, name`
          ).all();
        }
        return ok(rows);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Catalog list failed";
        console.error("[diagnosisCatalog:list] error:", message);
        return fail("CATALOG_LIST_FAILED", message);
      }
    }
  );
}
function registerAllHandlers() {
  registerSetupHandlers();
  registerCasesHandlers();
  registerIntakeHandlers();
  registerOnboardingHandlers();
  registerDbHandlers();
  registerAuthHandlers();
  registerConfigHandlers();
  registerDocumentHandlers();
  registerPiiHandlers();
  registerWorkspaceHandlers();
  registerSeedHandlers();
  registerApiKeyHandlers();
  registerDataConfirmationHandlers();
  registerAiHandlers();
  registerAgentHandlers();
  registerPipelineHandlers();
  registerDecisionHandlers();
  registerScoreHandlers();
  registerUpdaterHandlers();
  registerOnlyOfficeHandlers();
  registerReportHandlers();
  registerTemplateHandlers();
  registerAuditHandlers();
  registerTestimonyHandlers();
  registerReferralParseHandlers();
  registerResourcesHandlers();
  registerWhisperHandlers();
  registerTestHarnessHandlers();
  try {
    registerDiagnosisCatalogHandlers();
  } catch (e) {
    console.warn("[main] diagnosisCatalog handlers skipped:", e.message);
  }
}
function writeSeedFile(dir, file) {
  const filePath = path.join(dir, file.originalFilename);
  fs.writeFileSync(filePath, file.content, "utf-8");
  const cleanedDir = path.join(dir, "_cleaned");
  if (!fs.existsSync(cleanedDir)) fs.mkdirSync(cleanedDir, { recursive: true });
  const cleanedName = path.basename(file.originalFilename, path.extname(file.originalFilename)) + ".txt";
  fs.writeFileSync(path.join(cleanedDir, cleanedName), file.content, "utf-8");
}
const WRITING_SAMPLES = [
  {
    originalFilename: "CST_Evaluation_Writing_Sample.txt",
    ext: ".txt",
    mime: "text/plain",
    content: `COMPETENCY TO STAND TRIAL EVALUATION
Forensic Psychological Evaluation

IDENTIFYING INFORMATION

[NAME REMOVED] is a [AGE]-year-old [GENDER] individual currently detained at [FACILITY REMOVED] pending adjudication of charges including [CHARGES REMOVED]. This evaluation was ordered by [COURT REMOVED] pursuant to [STATUTE REMOVED] to address the defendant's competency to stand trial.

REFERRAL INFORMATION

This evaluator was appointed by the [COURT REMOVED] to conduct a competency evaluation of [NAME REMOVED] following a motion filed by defense counsel. The referral question is whether [NAME REMOVED] has sufficient present ability to consult with counsel with a reasonable degree of rational understanding, and whether [NAME REMOVED] has a rational as well as factual understanding of the proceedings, consistent with the standard articulated in Dusky v. United States (1960).

NOTIFICATION OF RIGHTS AND LIMITS OF CONFIDENTIALITY

Prior to the commencement of this evaluation, [NAME REMOVED] was informed of the following: (1) the nature and purpose of this evaluation; (2) that this evaluation was ordered by the court and is not a treatment relationship; (3) that the usual rules of therapist-patient confidentiality do not apply; (4) that a written report will be submitted to the court and made available to all attorneys of record; (5) that this evaluator may be called to testify regarding findings and opinions; and (6) that participation, while ordered by the court, does not compel the examinee to answer any specific question. [NAME REMOVED] verbally acknowledged understanding of these conditions and agreed to proceed.

SOURCES OF INFORMATION

1. Clinical interview with [NAME REMOVED] conducted on [DATE REMOVED] at [FACILITY REMOVED] (approximately 3.5 hours)
2. Review of arrest report and probable cause affidavit dated [DATE REMOVED]
3. Review of prior mental health records from [PROVIDER REMOVED] ([DATE RANGE REMOVED])
4. Review of prior competency evaluation report by [EVALUATOR REMOVED] dated [DATE REMOVED]
5. Review of jail medical records including current medication log
6. Administration and scoring of the MacArthur Competence Assessment Tool,Criminal Adjudication (MacCAT-CA)
7. Administration and scoring of the Evaluation of Competency to Stand Trial,Revised (ECST-R)
8. Collateral telephone interview with defense counsel, [NAME REMOVED], Esq. (approximately 20 minutes)

MENTAL STATUS EXAMINATION

[NAME REMOVED] presented as a [DESCRIPTION] individual who appeared [DESCRIPTION] stated age. Hygiene and grooming were [DESCRIPTION]. The examinee was cooperative with the evaluation process throughout, maintaining adequate eye contact and engaging with questions in a manner that suggested genuine effort.

Speech was spontaneous, normal in rate, rhythm, and volume, and goal-directed throughout the evaluation. There were no observed abnormalities in articulation or prosody. Thought processes were linear and coherent, with occasional mild tangentiality that was easily redirected. There was no evidence of loosening of associations, thought blocking, flight of ideas, or neologisms.

Mood was described by the examinee as "alright, I guess, considering." Affect was mildly restricted in range but mood-congruent and appropriate to conversational content. There were no observed episodes of lability, flattening, or incongruence.

With respect to thought content, [NAME REMOVED] denied current suicidal ideation, homicidal ideation, or intent to harm self or others. The examinee denied current auditory or visual hallucinations, though reported a history of auditory hallucinations during periods of medication non-compliance (see Background History). There were no delusions elicited during the evaluation. [NAME REMOVED] did not exhibit paranoid ideation or ideas of reference during the interview.

Orientation was intact to person, place, time, and situation. Attention and concentration were adequate, as evidenced by the ability to engage in sustained conversation and follow multi-step test instructions. Immediate recall was intact for three of three items, with two of three items recalled after a five-minute delay. Fund of general knowledge was estimated to be within the average range. Insight was fair, and judgment appeared adequate for the purposes of this evaluation.

COMPETENCY ASSESSMENT INSTRUMENTS

MacArthur Competence Assessment Tool,Criminal Adjudication (MacCAT-CA)

The MacCAT-CA is a structured clinical instrument designed to assess three abilities related to adjudicative competence: Understanding (of the legal system and adjudicative process), Reasoning (about one's own legal situation), and Appreciation (of the relevance of information to one's own situation). Scores are interpreted relative to clinical and normative comparison groups.

Understanding: [NAME REMOVED] obtained a score of 14 out of a possible 16 on this subscale, which falls in the Adequate range. The examinee demonstrated a solid understanding of the roles of key courtroom personnel, the adversarial nature of proceedings, the nature and purpose of a plea, and the elements of an offense. [NAME REMOVED] was able to articulate the difference between a guilty and not-guilty plea and understood the potential consequences of each. The two items scored below the maximum involved minor imprecision in describing the role of the jury foreperson and the process of plea bargaining, neither of which represented a clinically significant deficit.

Reasoning: [NAME REMOVED] obtained a score of 12 out of a possible 16, which falls in the Adequate range. When presented with hypothetical legal scenarios, the examinee was able to identify relevant information, appreciate the implications of different courses of action, and demonstrate a basic capacity for means-ends reasoning. [NAME REMOVED] was able to describe a rationale for accepting or rejecting a plea offer that reflected consideration of evidence strength and potential consequences.

Appreciation: [NAME REMOVED] obtained a score of 5 out of a possible 6, which falls in the Adequate range. The examinee demonstrated appropriate appreciation of the charges, the likely evidence against [PRONOUN], and the potential penalties. [NAME REMOVED] did not exhibit delusional thinking regarding the legal process or [PRONOUN] own legal situation.

DIAGNOSTIC IMPRESSIONS

Based on the totality of data gathered during this evaluation, the following diagnostic impressions are offered consistent with the Diagnostic and Statistical Manual of Mental Disorders, Fifth Edition, Text Revision (DSM-5-TR):

1. Schizoaffective Disorder, Bipolar Type (F25.0), in partial remission on current medication regimen. This diagnosis is supported by the examinee's documented history of mood episodes with concurrent psychotic features, periods of auditory hallucinations, and a longitudinal course consistent with the diagnostic criteria. Current partial remission is supported by the absence of active psychotic symptoms during this evaluation and adequate mood stability reported by jail medical staff.

2. Cannabis Use Disorder, Moderate (F12.20), in a controlled environment. This diagnosis is supported by the examinee's self-reported history of regular cannabis use prior to incarceration, failed attempts to reduce use, and continued use despite knowledge of legal and health consequences.

PSYCHOLEGAL OPINIONS

It is this evaluator's opinion, based on the data gathered during this evaluation, and within reasonable psychological certainty, that:

1. Regarding factual understanding of the proceedings: [NAME REMOVED] demonstrates adequate factual understanding of the charges, the roles of courtroom personnel, the adversarial nature of proceedings, possible pleas, and potential penalties. The examinee's performance on the MacCAT-CA Understanding subscale was in the Adequate range, and clinical interview responses were consistent with this finding. [NAME REMOVED] was able to accurately describe the charges, identify [PRONOUN] attorney and the prosecutor by name, explain the judge's role, and articulate the difference between a bench trial and a jury trial.

2. Regarding rational understanding of the proceedings: [NAME REMOVED] demonstrates adequate rational understanding. The examinee does not exhibit delusional thinking that distorts [PRONOUN] perception of the legal process, the evidence, or the likely outcomes. [NAME REMOVED]'s MacCAT-CA Appreciation score was in the Adequate range. The examinee was able to apply information about [PRONOUN] own case in a logical manner without the intrusion of psychotic thought content.

3. Regarding ability to consult with counsel: [NAME REMOVED] demonstrates adequate ability to communicate with defense counsel. The examinee was able to sustain attention throughout a 3.5-hour evaluation, respond to questions coherently, and describe [PRONOUN] version of events in a linear and organized fashion. Defense counsel reports that [NAME REMOVED] has been able to participate meaningfully in case preparation meetings, discuss strategy, and review discovery materials with appropriate comprehension.

Therefore, it is this evaluator's opinion that [NAME REMOVED] is COMPETENT TO STAND TRIAL at this time. This opinion is contingent upon the examinee's continued adherence to [PRONOUN] current psychotropic medication regimen. Should medication compliance lapse, a re-evaluation may be warranted.

LIMITATIONS

This evaluation represents a snapshot of the examinee's functioning at the time of this assessment. Competency is a fluid construct that may change as a function of psychiatric stability, medication adherence, substance use, or other factors. The opinions expressed herein are based on the data available at the time of this evaluation and may require revision if new information becomes available.
`
  },
  {
    originalFilename: "Risk_Assessment_Narrative_Sample.txt",
    ext: ".txt",
    mime: "text/plain",
    content: `VIOLENCE RISK ASSESSMENT
Clinical Formulation and Psycholegal Opinions, Writing Sample

CLINICAL FORMULATION

The assessment of [NAME REMOVED]'s risk for future violence requires integration of historical, clinical, and contextual factors. The structured professional judgment approach employed in this evaluation uses validated instruments not to generate actuarial probability estimates, but to ensure systematic consideration of empirically supported risk and protective factors.

Historical risk factors are notable in this case. [NAME REMOVED] has a documented history of violent behavior beginning in adolescence, with [NUMBER] adjudicated offenses involving physical violence and [NUMBER] documented incidents of institutional aggression. The pattern of violence reflects predominantly reactive aggression, characterized by impulsive responses to perceived provocation rather than calculated, predatory behavior. This distinction has implications for risk management, as reactive violence is more amenable to pharmacological and cognitive-behavioral intervention than instrumental violence.

The examinee's history of substance use disorder constitutes a significant dynamic risk factor. Collateral records indicate that each of [NAME REMOVED]'s violent offenses occurred in the context of active substance use, specifically alcohol and stimulant intoxication. During periods of sustained sobriety, documented at [FACILITY REMOVED] between [DATE RANGE REMOVED], there were no documented acts of aggression. This suggests a strong functional relationship between substance use and violent behavior.

With respect to mental health factors, [NAME REMOVED]'s diagnosis of Bipolar I Disorder introduces additional risk variance. Episodes of mania, particularly those with psychotic features, have historically been associated with increased agitation, impulsivity, and impaired reality testing. However, the literature is clear that the relationship between severe mental illness and violence is modest and substantially mediated by substance use and treatment non-adherence (Elbogen & Johnson, 2009). [NAME REMOVED]'s current psychiatric stability on [MEDICATION REMOVED] is a protective factor, though one that is contingent on continued medication compliance and access to psychiatric care.

Protective factors identified in this evaluation include: (1) the examinee's expressed motivation for treatment and insight into the relationship between substance use and violent behavior; (2) a prosocial support network including [RELATIONSHIP REMOVED] who has agreed to provide housing and accountability; (3) absence of psychopathic personality traits as measured by the PCL-R (Total Score: [SCORE], which falls below the clinical threshold); and (4) increasing age, which is associated with desistance from violent behavior across populations.

HCR-20 V3 RESULTS

The Historical-Clinical-Risk Management-20, Version 3 (HCR-20 V3; Douglas, Hart, Webster, & Belfrage, 2013) is a structured professional judgment instrument comprising 20 items across three scales. Items are rated as Absent, Possibly Present, or Definitely Present, and the evaluator formulates a final risk judgment based on the totality of the assessment.

Historical Scale (H1-H10): [NAME REMOVED] received ratings of Definitely Present on H1 (Violence), H5 (Substance Use Problems), H7 (Personality Disorder), and H10 (Prior Supervision Failure). Ratings of Possibly Present were assigned to H2 (Other Antisocial Behavior), H4 (Employment Problems), and H6 (Major Mental Disorder). Items H3 (Relationships), H8 (Traumatic Experiences), and H9 (Violent Attitudes) received ratings of Absent or Possibly Present.

Clinical Scale (C1-C5): Current clinical factors reflect a mixed picture. C1 (Insight) was rated as Possibly Present, reflecting the examinee's partial but developing understanding of risk factors. C2 (Violent Ideation) was rated Absent based on current presentation. C3 (Symptoms of Major Mental Disorder) was rated Possibly Present given controlled but active psychiatric symptoms. C4 (Instability) was rated Possibly Present. C5 (Treatment or Supervision Response) was rated Possibly Present given mixed historical compliance.

Risk Management Scale (R1-R5): The relevance of risk management factors depends on the scenario being considered. In a community reintegration scenario with structured supervision: R1 (Professional Services and Plans) was rated Possibly Present given the availability of outpatient treatment resources. R2 (Living Situation) was rated Possibly Present. R3 (Personal Support) was rated Absent given the identified prosocial support system. R4 (Treatment or Supervision Response) and R5 (Stress or Coping) were each rated Possibly Present.

PSYCHOLEGAL OPINIONS ON RISK

Based on the structured professional judgment approach described above, and considering the totality of historical, clinical, and risk management factors:

It is this evaluator's opinion, within reasonable psychological certainty, that [NAME REMOVED] presents a MODERATE risk for future violence. This judgment reflects the following considerations:

Risk-elevating factors: Established pattern of reactive violence, significant substance use history with a functional relationship to violent episodes, history of supervision failure, and residual psychiatric symptoms requiring ongoing management.

Risk-mitigating factors: Absence of psychopathic personality traits, motivated engagement with treatment, identified prosocial supports, increasing age, and current psychiatric stability.

The temporal dimension of this risk opinion is critical. This moderate risk designation applies to a scenario in which [NAME REMOVED] is released to a structured community supervision plan with mandated substance use treatment, psychiatric medication management, and regular reporting. In the absence of such structured supports, risk would be expected to increase substantially. Conversely, sustained sobriety and medication adherence over a period of 12-18 months would support a downward revision of risk level.

It must be emphasized that violence risk assessment is inherently probabilistic and that no clinical instrument or method can predict with certainty whether a specific individual will or will not engage in future violence. The opinions expressed herein represent the evaluator's best clinical judgment based on the available data and current scientific understanding of violence risk factors.
`
  },
  {
    originalFilename: "Custody_Eval_Clinical_Formulation.txt",
    ext: ".txt",
    mime: "text/plain",
    content: `CHILD CUSTODY EVALUATION
Clinical Formulation Section, Writing Sample

CLINICAL FORMULATION

This evaluation involved comprehensive assessment of both parents and the minor child, including clinical interviews, psychological testing, collateral contacts, and record review. The following formulation integrates data across all sources to address the referral questions posed by the Court.

Parenting Capacity of [PARENT A]

[PARENT A] presented as an engaged and emotionally attuned parent who demonstrated a clear understanding of the children's developmental needs. During the clinical interview, [PARENT A] was able to articulate each child's temperament, academic strengths and challenges, social relationships, and emotional needs with specificity and accuracy, which was corroborated by collateral contacts including the children's teachers and pediatrician.

Psychological testing results for [PARENT A] were within normal limits. The MMPI-3 validity scales were acceptable (F = [SCORE]T, L = [SCORE]T, K = [SCORE]T), supporting the interpretability of the clinical scales. No clinical scales were elevated above the threshold of clinical significance (65T). The Parenting Stress Index, Fourth Edition (PSI-4) yielded a Total Stress score at the [PERCENTILE] percentile, which falls in the normal range and suggests that [PARENT A] is managing the stresses of parenting within expected limits. The Parent-Child Relationship Inventory (PCRI) reflected relative strengths in Communication and Involvement, with no domains of concern.

Areas of concern identified for [PARENT A] include: (1) a tendency to engage in mildly disparaging remarks about [PARENT B] in the children's presence, which was reported by [CHILD] during the individual interview and confirmed by collateral contact [COLLATERAL]; and (2) difficulty distinguishing between the children's own wishes and [PARENT A]'s projections about what the children want, which was observed during the parent-child observation and is consistent with the somewhat elevated Enmeshment scale on the PCRI.

Parenting Capacity of [PARENT B]

[PARENT B] presented as a caring parent who expressed genuine concern for the children's wellbeing and articulated a desire to maintain a close relationship. [PARENT B]'s knowledge of the children's daily routines, medical needs, and school performance was adequate, though somewhat less detailed than [PARENT A]'s, which is consistent with [PARENT B]'s historically more limited time with the children rather than a lack of investment.

The MMPI-3 for [PARENT B] showed acceptable validity (F = [SCORE]T, L = [SCORE]T, K = [SCORE]T). Elevation on Scale 4 (Antisocial Behavior, [SCORE]T) was in the moderate range and is consistent with [PARENT B]'s history of interpersonal conflict and authority difficulties documented in the record. No other clinical scales reached the threshold of significance. The PSI-4 Total Stress score was at the [PERCENTILE] percentile, also within normal limits. The PCRI showed relative strength in Autonomy-granting but a lower score on Limit Setting, which aligns with both self-report and collateral observations that [PARENT B] tends toward a more permissive parenting style.

Areas of concern identified for [PARENT B] include: (1) inconsistency in exercise of parenting time, with [NUMBER] missed or truncated visits documented over the past [TIME PERIOD], attributed by [PARENT B] to work schedule conflicts; (2) the presence of [PARTNER] in the home, about whom the children expressed mixed feelings during individual interviews; and (3) difficulty managing anger during co-parent communication, documented in text message exchanges reviewed during this evaluation.

The Children's Perspective

[CHILD 1], age [AGE], was interviewed individually and presented as a verbal, socially aware child who demonstrated a strong attachment to both parents. When asked about each parent, [CHILD 1] spontaneously offered positive attributes of both and expressed a wish to spend time with each parent. [CHILD 1] was able to articulate what was enjoyable about time with each parent with age-appropriate specificity. [CHILD 1] did report feeling "in the middle" at times, stating "[QUOTE REMOVED]," which reflects an awareness of parental conflict that is developmentally inappropriate and potentially harmful.

The Child Behavior Checklist (CBCL) completed by each parent showed notable discrepancy. [PARENT A]'s ratings yielded elevations on the Anxious/Depressed and Withdrawn/Depressed syndrome scales, while [PARENT B]'s ratings were entirely within normal limits. Such cross-informant discrepancies are common in custody evaluations and may reflect differences in the children's behavior across settings, differences in parental perceptiveness or reporting bias, or some combination thereof. This discrepancy does not, by itself, indicate that either parent's ratings are invalid.

Co-Parenting Dynamics

The central challenge identified in this evaluation is not parenting capacity, both parents demonstrate adequate capacity to meet the children's basic needs, but rather the quality of the co-parenting relationship. Communication between the parents is characterized by high conflict, defensive reactivity, and a pattern of escalation documented in text messages, emails, and collateral reports. Each parent attributes the conflict primarily to the other, and each demonstrates limited insight into their own contribution to the dynamic.

This pattern of co-parenting conflict is the most significant risk factor for the children's adjustment. The research literature consistently demonstrates that ongoing interparental conflict, particularly conflict to which children are exposed, is more predictive of negative child outcomes than family structure itself (Amato, 2001; Emery, 1999; Johnston, 1994). Both parents would benefit from structured co-parenting intervention, such as the High-Conflict Parenting Program or similar evidence-based program, to develop skills in parallel parenting, communication containment, and child-centered decision-making.

PSYCHOLEGAL OPINIONS

Consistent with professional guidelines and ethical standards, this evaluator does not recommend a specific custody schedule, as such determinations are within the province of the Court. Instead, the following clinical observations are offered to inform the Court's decision:

1. Both parents demonstrate adequate parenting capacity. Neither parent presents with psychopathology or behavioral patterns that would render them unfit or constitute a risk to the children's safety.

2. The children have meaningful attachments to both parents and would benefit from maintaining substantial relationships with each.

3. The primary risk to the children's wellbeing is ongoing exposure to interparental conflict rather than any deficiency in either parent's individual parenting capacity.

4. The children's expressed preferences, while noted, should be interpreted in the context of their developmental stage and their awareness of parental conflict, which may influence their statements.

5. A structured parallel parenting framework with clearly delineated responsibilities and minimal required direct communication between the parents would likely reduce conflict exposure for the children.
`
  }
];
const TEMPLATES = [
  {
    originalFilename: "CST_Report_Template.txt",
    ext: ".txt",
    mime: "text/plain",
    content: `COMPETENCY TO STAND TRIAL EVALUATION REPORT
[TEMPLATE]

=============================================
TITLE PAGE
=============================================
CONFIDENTIAL FORENSIC EVALUATION REPORT

Re: [Examinee Full Name]
Case Number: [Case #]
Date of Evaluation: [Date(s)]
Date of Report: [Date]

Evaluator: [Name, Degrees]
[License Type and Number]
[Board Certification if applicable]
[Professional Address]

Submitted to: [Court Name]
[Judge Name]

=============================================
1. IDENTIFYING INFORMATION
=============================================
[Full Name] is a [age]-year-old [gender] individual currently [detained at / released on bond to] [location]. Date of birth: [DOB]. Race/Ethnicity: [as self-reported].

=============================================
2. REFERRAL INFORMATION
=============================================
This evaluation was requested by [Court/Defense/Prosecution] to address the following question:

Whether the defendant has sufficient present ability to consult with [his/her/their] lawyer with a reasonable degree of rational understanding, and whether the defendant has a rational as well as factual understanding of the proceedings against [him/her/them], consistent with the standard established in Dusky v. United States, 362 U.S. 402 (1960).

Pending charges: [List charges with statute numbers]

=============================================
3. NOTIFICATION AND INFORMED CONSENT
=============================================
Prior to this evaluation, the examinee was informed of:
  (a) The nature and purpose of the evaluation
  (b) That this is not a treatment relationship
  (c) That confidentiality is limited
  (d) That a report will be submitted to the court
  (e) That the evaluator may testify
  (f) That participation does not require answering every question

The examinee [acknowledged / did not acknowledge] understanding and [agreed / declined] to proceed.

=============================================
4. SOURCES OF INFORMATION
=============================================
  1. Clinical interview with examinee ([date], approximately [hours] hours)
  2. [List all records reviewed with dates]
  3. [List all collateral interviews with relationship and duration]
  4. [List all instruments administered]

=============================================
5. RELEVANT BACKGROUND HISTORY
=============================================

Psychiatric History:
[Chronological psychiatric treatment history, hospitalizations, medications]

Substance Use History:
[Substances, age of onset, pattern, treatment history]

Legal History:
[Prior charges, convictions, prior competency evaluations]

Educational / Developmental History:
[Highest education, learning disabilities, developmental milestones if relevant]

=============================================
6. MENTAL STATUS EXAMINATION
=============================================
Appearance:
Behavior:
Speech:
Mood (self-reported):
Affect (observed):
Thought Process:
Thought Content:
Perceptual Disturbances:
Cognition (orientation, attention, memory):
Insight:
Judgment:

=============================================
7. COMPETENCY ASSESSMENT INSTRUMENTS
=============================================

[Instrument Name] (Citation)
[Description of instrument and what it measures]
[Score reporting by subscale]
[Interpretation relative to normative data]

[Repeat for each instrument]

=============================================
8. FUNCTIONAL COMPETENCY ABILITIES
=============================================

Factual Understanding of Proceedings:
- Understands charges: [yes/no with basis]
- Understands possible penalties: [yes/no with basis]
- Understands roles of courtroom personnel: [yes/no with basis]
- Understands plea options: [yes/no with basis]
- Understands trial process: [yes/no with basis]

Rational Understanding of Proceedings:
- Appreciates own legal situation: [yes/no with basis]
- Does not exhibit delusional distortion of proceedings: [yes/no with basis]
- Can weigh options rationally: [yes/no with basis]

Ability to Assist Counsel:
- Can communicate coherently: [yes/no with basis]
- Can sustain attention: [yes/no with basis]
- Can provide relevant information about the alleged offense: [yes/no with basis]
- Can participate in decision-making: [yes/no with basis]

=============================================
9. DIAGNOSTIC IMPRESSIONS
=============================================
[DSM-5-TR diagnosis with code]
[Supporting rationale]
[Differential diagnoses considered and ruled out]

=============================================
10. PSYCHOLEGAL OPINIONS
=============================================
It is this evaluator's opinion, within reasonable psychological certainty, that [Name]:

1. [Does / Does not] have sufficient factual understanding of the proceedings.
   Basis: [Specific data supporting this conclusion]

2. [Does / Does not] have rational understanding of the proceedings.
   Basis: [Specific data supporting this conclusion]

3. [Does / Does not] have sufficient ability to assist counsel.
   Basis: [Specific data supporting this conclusion]

Overall opinion: [Name] is [COMPETENT / NOT COMPETENT] to stand trial at this time.

[If incompetent: Opinion on restorability, recommended restoration setting, estimated timeline]

=============================================
11. LIMITATIONS
=============================================
[Standard limitations language: snapshot in time, medication contingency, new information caveat]

=============================================
12. SIGNATURE
=============================================
[Attestation statement]

_______________________________
[Name, Degrees]
[License]
[Board Certification]
[Date]
[Contact Information]
`
  },
  {
    originalFilename: "Custody_Evaluation_Template.txt",
    ext: ".txt",
    mime: "text/plain",
    content: `CHILD CUSTODY EVALUATION REPORT
[TEMPLATE, AFCC Model Standards Compliant]

=============================================
TITLE PAGE
=============================================
CONFIDENTIAL CHILD CUSTODY EVALUATION

In the Matter of: [Case Caption]
Case Number: [Case #]
Court: [Court Name, Division]

Evaluation Period: [Start Date] through [End Date]
Date of Report: [Date]

Evaluator: [Name, Degrees]
[License Type and Number]
[Board Certification]
[Professional Address]

=============================================
1. IDENTIFYING INFORMATION
=============================================
Parent A: [Name], DOB [DATE], age [age]
Parent B: [Name], DOB [DATE], age [age]
Child(ren):
  - [Name], DOB [DATE], age [age], grade [grade]
  - [Name], DOB [DATE], age [age], grade [grade]

=============================================
2. REFERRAL AND COURT ORDER
=============================================
This evaluation was ordered by [Court] pursuant to [Order/Stipulation dated DATE]. The Court has requested that this evaluator address the following:
  (a) [Specific question 1]
  (b) [Specific question 2]
  (c) [Specific question 3]

=============================================
3. INFORMED CONSENT AND CONFIDENTIALITY
=============================================
All parties were informed that:
  (a) This is not a treatment relationship
  (b) The evaluator serves as an objective expert
  (c) Information from one party may be shared with the other
  (d) The report will be provided to the Court and counsel
  (e) The evaluator may testify
All parties acknowledged understanding and agreed to participate.

=============================================
4. SOURCES OF INFORMATION
=============================================
Parent A:
  - Individual interview(s): [dates, total hours]
  - Psychological testing: [instruments]
  - Home visit: [date, duration]

Parent B:
  - Individual interview(s): [dates, total hours]
  - Psychological testing: [instruments]
  - Home visit: [date, duration]

Children:
  - Individual interview(s): [dates, total hours per child]
  - [Testing instruments if administered]

Parent-Child Observations:
  - [Parent A] with children: [date, duration, setting]
  - [Parent B] with children: [date, duration, setting]

Collateral Contacts:
  - [Name, relationship, date, duration, for each contact]

Records Reviewed:
  - [Comprehensive list of all documents reviewed]

=============================================
5. BACKGROUND, PARENT A
=============================================
Personal History:
Relationship History:
Parenting History and Philosophy:
Employment and Financial Situation:
Mental Health History:
Substance Use History:
Legal History:
Current Living Situation:
Parenting Strengths Identified:
Areas of Concern Identified:

=============================================
6. BACKGROUND, PARENT B
=============================================
[Same structure as Parent A, parallel format required]

=============================================
7. BACKGROUND, CHILDREN
=============================================
[For each child:]
Developmental History:
Educational Functioning:
Social Functioning:
Emotional/Behavioral Functioning:
Health:
Expressed Preferences (with developmental context):
Observed Attachment Behaviors:

=============================================
8. MENTAL STATUS EXAMINATIONS
=============================================
Parent A MSE:
[Standard MSE categories]

Parent B MSE:
[Standard MSE categories]

=============================================
9. PSYCHOLOGICAL TESTING RESULTS
=============================================

Parent A:
[Instrument, Validity indicators, Clinical scales, Interpretation]

Parent B:
[Instrument, Validity indicators, Clinical scales, Interpretation]

Children (if tested):
[Instrument, scores, interpretation]

Cross-informant analysis:
[Compare CBCL/TRF ratings across informants]

=============================================
10. PARENT-CHILD OBSERVATIONS
=============================================
[Parent A] with children:
[Detailed behavioral observations, warmth, responsiveness, limit-setting, child's behavior]

[Parent B] with children:
[Detailed behavioral observations, parallel structure]

=============================================
11. DIAGNOSTIC IMPRESSIONS
=============================================
Parent A: [Diagnoses or "No diagnosis warranted"]
Parent B: [Diagnoses or "No diagnosis warranted"]
Children: [Diagnoses or adjustment concerns if applicable]

=============================================
12. CLINICAL FORMULATION
=============================================
[Integration of all data addressing:]
  - Parenting capacity of each parent
  - Children's developmental needs
  - Attachment patterns
  - Co-parenting dynamics
  - Risk and protective factors
  - Impact of conflict on children

=============================================
13. PSYCHOLEGAL OPINIONS
=============================================
[Address each court-ordered question individually]

Question (a): [Restate question]
Opinion: [Clinical observations that inform this question]
Basis: [Specific data sources supporting this observation]

[Repeat for each question]

Note: Specific custody schedule recommendations are within the province of the Court. The above clinical observations are offered to inform the Court's determination regarding the best interests of the children.

=============================================
14. RECOMMENDATIONS
=============================================
  1. [Therapy, co-parenting program, etc.]
  2. [Specific to identified concerns]
  3. [Re-evaluation timeline if applicable]

=============================================
15. LIMITATIONS
=============================================
[Standard limitations]

=============================================
16. SIGNATURE AND ATTESTATION
=============================================
[Attestation statement]

_______________________________
[Name, Degrees]
[License, Board Certification]
[Date]
`
  },
  {
    originalFilename: "Risk_Assessment_Template.txt",
    ext: ".txt",
    mime: "text/plain",
    content: `VIOLENCE RISK ASSESSMENT REPORT
[TEMPLATE, Structured Professional Judgment Framework]

=============================================
1. IDENTIFYING INFORMATION
=============================================
Name: [Full Name]
DOB: [Date]  |  Age: [age]
Gender: [Gender]
Referral Source: [Source]
Type of Risk Assessed: [General violence / Sexual violence / Intimate partner / Stalking]
Date(s) of Evaluation: [Dates]
Date of Report: [Date]

=============================================
2. REFERRAL QUESTION
=============================================
[Who requested the evaluation and what specific risk question is being addressed]
[Legal context: sentencing, parole, civil commitment, treatment planning]

=============================================
3. CONFIDENTIALITY NOTICE
=============================================
[Standard forensic confidentiality notice]

=============================================
4. SOURCES OF INFORMATION
=============================================
  1. Clinical interview: [date, duration]
  2. Criminal records: [jurisdictions, date range]
  3. Institutional records: [facility, date range]
  4. Prior risk assessments: [evaluator, date]
  5. Collateral interviews: [name, relationship, date]
  6. Risk assessment instruments administered: [list]
  7. Psychological testing: [list]

=============================================
5. RELEVANT HISTORY
=============================================

Violence History (chronological):
[Date] - [Incident description, severity, context, outcome]
[Date] - [Repeat for each documented incident]

Pattern Analysis:
  - Predominant type: [Reactive / Instrumental / Mixed]
  - Typical triggers: [List identified triggers]
  - Typical targets: [Strangers / Acquaintances / Intimate partners / Authority figures]
  - Escalation pattern: [Describe]
  - Weapons involvement: [Describe]

Substance Use History:
[With specific attention to co-occurrence with violent episodes]

Mental Health History:
[Diagnoses, treatment, medication adherence, symptom-violence relationship]

Relationship History:
[Stability, conflict patterns, IPV history]

Employment History:
[Stability, disciplinary issues]

Institutional Behavior:
[Disciplinary record, program participation, infractions]

=============================================
6. MENTAL STATUS EXAMINATION
=============================================
[Standard MSE]

=============================================
7. PSYCHOLOGICAL TESTING
=============================================
[Personality assessment with attention to:]
  - Antisocial features
  - Psychopathic traits
  - Anger/hostility
  - Impulsivity
  - Substance abuse indicators
  - Validity/response style

=============================================
8. RISK ASSESSMENT INSTRUMENTS
=============================================

[Instrument Name] (Citation)
Purpose: [What the instrument assesses]
Structure: [Number of items, scales]

Item-level results:
[Present each item with rating and supporting data]

Summary: [Overall characterization based on instrument]

[Repeat for each instrument: HCR-20 V3, PCL-R, VRAG-R, STATIC-99R, etc.]

=============================================
9. RISK FACTORS IDENTIFIED
=============================================

Static Risk Factors (historical, unchangeable):
  - [Factor]: [Present/Absent], [Supporting data]

Dynamic Risk Factors (potentially changeable):
  - [Factor]: [Current status], [Supporting data]

Protective Factors:
  - [Factor]: [Current status], [Supporting data]

=============================================
10. RISK FORMULATION
=============================================
[Narrative integration of all risk and protective factors]
[Identification of key drivers of risk]
[Plausible violence scenarios]
[Temporal considerations]

=============================================
11. RISK MANAGEMENT RECOMMENDATIONS
=============================================
  1. [Supervision level]
  2. [Treatment targets, substance use, mental health, anger management]
  3. [Monitoring requirements]
  4. [Conditions that would indicate escalating risk]
  5. [Re-assessment timeline]

=============================================
12. PSYCHOLEGAL OPINION ON RISK LEVEL
=============================================
Based on the structured professional judgment approach:

Overall Risk Level: [LOW / MODERATE / HIGH]

This opinion applies to: [Specific scenario, e.g., community release with supervision]
Temporal scope: [Time frame, e.g., over the next 12 months under described conditions]

Risk-elevating factors: [Summary]
Risk-mitigating factors: [Summary]

[Explicitly state: risk is probabilistic, conditions may change, re-assessment warranted if circumstances change]

=============================================
13. LIMITATIONS
=============================================
[Standard limitations + specific to risk assessment:
  - Risk assessment is probabilistic, not predictive
  - Conditions may change
  - Assessment reflects point-in-time judgment
  - No instrument can predict with certainty]

=============================================
14. SIGNATURE
=============================================
[Attestation statement]
[Signature block]
`
  },
  {
    originalFilename: "PTSD_Personal_Injury_Template.txt",
    ext: ".txt",
    mime: "text/plain",
    content: `PSYCHOLOGICAL EVALUATION, PERSONAL INJURY / PTSD CLAIM
[TEMPLATE]

=============================================
1. IDENTIFYING INFORMATION
=============================================
Examinee: [Name]
DOB: [Date]  |  Age: [age]
Date of Claimed Incident: [Date]
Date(s) of Evaluation: [Date(s)]
Referral Source: [Attorney name, representing Plaintiff/Defendant]
Case: [Case caption and number]

=============================================
2. REFERRAL QUESTIONS
=============================================
  (a) Does the examinee meet diagnostic criteria for PTSD or other psychological disorder?
  (b) If so, is the diagnosed condition causally related to the claimed incident?
  (c) What is the examinee's current level of functional impairment?
  (d) What is the prognosis, with and without treatment?
  (e) Were there pre-existing psychological conditions?

=============================================
3. CONFIDENTIALITY NOTICE
=============================================
[Standard forensic notice, note: retained by [Plaintiff/Defense] counsel]

=============================================
4. SOURCES OF INFORMATION
=============================================
  1. Clinical interview: [date, duration]
  2. Pre-incident medical/mental health records: [list with dates]
  3. Post-incident treatment records: [list with dates]
  4. Employment records: [if applicable]
  5. Incident report / police report: [date]
  6. Deposition transcripts: [if applicable]
  7. Collateral interview: [name, relationship, date]
  8. Psychological testing: [list all instruments]

=============================================
5. PRE-INCIDENT BASELINE
=============================================
Mental Health History (pre-incident):
[Prior diagnoses, treatment, medications, hospitalizations]

Functional Baseline:
  - Employment: [Job, performance, attendance]
  - Relationships: [Quality, stability]
  - Social functioning: [Activities, engagement]
  - Physical health: [Relevant conditions]
  - Prior trauma exposure: [List with dates]

=============================================
6. INCIDENT DESCRIPTION
=============================================
[Examinee's account of the incident]
[Corroborating documentation]
[Discrepancies between accounts, if any]

=============================================
7. POST-INCIDENT COURSE
=============================================
Symptom Onset: [Timeline relative to incident]
Treatment Sought: [When, where, by whom]
Treatment Received: [Type, duration, response]
Current Symptoms: [Detailed current presentation]

Functional Impact:
  - Employment: [Changes since incident]
  - Relationships: [Changes since incident]
  - Daily activities: [Changes since incident]
  - Sleep: [Changes since incident]
  - Avoidance behaviors: [Specific examples]

=============================================
8. MENTAL STATUS EXAMINATION
=============================================
[Standard MSE with attention to trauma-related observations]

=============================================
9. PSYCHOLOGICAL TESTING, VALIDITY
=============================================
[MUST appear before substantive test results]

Performance Validity:
  - TOMM Trial 1: [Score]/50  Trial 2: [Score]/50  (Cutoff: 45)
  - [Other PVT results]

Symptom Validity:
  - SIMS Total: [Score] (Cutoff: >14)
  - MMPI-3 F: [Score]T  Fp: [Score]T  FBS: [Score]T
  - [Other SVT results]

Interpretation: [Credible / Non-credible / Mixed, with specific basis]

=============================================
10. PSYCHOLOGICAL TESTING, SUBSTANTIVE
=============================================

PTSD-Specific Measures:
  - CAPS-5 Total: [Score] (Threshold: 33)
    Cluster B (Intrusion): [Score]
    Cluster C (Avoidance): [Score]
    Cluster D (Cognition/Mood): [Score]
    Cluster E (Arousal): [Score]
  - PCL-5 Total: [Score] (Cutoff: 31-33)

Personality/Broad Assessment:
  - MMPI-3: [Validity + clinical scale profile]
  - [Other instruments]

Functional Assessment:
  - [Instruments measuring functional impairment]

=============================================
11. DIAGNOSTIC IMPRESSIONS
=============================================
  (a) Current diagnosis: [DSM-5-TR with code and specifiers]
  (b) Diagnostic criteria met: [Map symptoms to specific criteria]
  (c) Pre-existing conditions: [Diagnoses present before incident]
  (d) Differential diagnoses considered: [And basis for ruling out]
  (e) Validity and effort considerations: [Impact on diagnostic confidence]

=============================================
12. CAUSATION ANALYSIS
=============================================
  (a) Temporal relationship: [Symptom onset relative to incident]
  (b) Pre-existing vulnerability vs. new condition: [Analysis]
  (c) Intervening stressors: [Other events that may contribute]
  (d) Dose-response: [Severity of incident relative to symptom severity]
  (e) Causal opinion: [Within reasonable psychological certainty]

=============================================
13. FUNCTIONAL IMPAIRMENT
=============================================
[Quantified where possible: work days missed, income impact, relationship changes, activity restriction]

=============================================
14. PROGNOSIS
=============================================
  - With appropriate treatment: [Expected course and timeline]
  - Without treatment: [Expected course]
  - Treatment recommendations: [Specific modalities, estimated duration]

=============================================
15. LIMITATIONS
=============================================
[Standard limitations + retrospective assessment caveat, self-report reliance, time elapsed]

=============================================
16. SIGNATURE
=============================================
[Attestation + compensation disclosure per Fed. R. Civ. P. 26]
`
  }
];
const DOCUMENTATION = [
  {
    originalFilename: "DSM-5-TR_Forensic_Quick_Reference.txt",
    ext: ".txt",
    mime: "text/plain",
    content: `DSM-5-TR FORENSIC QUICK REFERENCE
Commonly Encountered Diagnoses in Forensic Evaluation

Last Updated: 2026

=============================================
PSYCHOTIC SPECTRUM DISORDERS
=============================================

Schizophrenia (F20.x)
  - Key Criteria: 2+ of: delusions, hallucinations, disorganized speech, disorganized/catatonic behavior, negative symptoms. At least 1 must be delusions, hallucinations, or disorganized speech. Duration ≥6 months with ≥1 month active symptoms.
  - Forensic Relevance: Most common diagnosis in CST evaluations involving psychosis. Address current symptom status, medication response, impact on each Dusky prong separately.
  - Common Specifiers: First episode vs. multiple episodes; currently in acute episode, partial remission, or full remission.

Schizoaffective Disorder (F25.x)
  - Key Criteria: Concurrent mood episode (Major Depressive or Manic) with Criterion A symptoms of schizophrenia. Delusions or hallucinations for ≥2 weeks in absence of major mood episode during lifetime duration.
  - Forensic Relevance: Requires careful differentiation from Schizophrenia with comorbid mood disorder and from Bipolar I with psychotic features. Longitudinal course is the distinguishing factor.
  - Subtypes: Bipolar type (F25.0) vs. Depressive type (F25.1)

Brief Psychotic Disorder (F23)
  - Key Criteria: ≥1 of delusions, hallucinations, disorganized speech, grossly disorganized/catatonic behavior. Duration 1 day to <1 month with full return to premorbid functioning.
  - Forensic Relevance: May be relevant in cases involving acute stress response at time of offense. Address temporal relationship between psychotic episode and alleged offense.

=============================================
MOOD DISORDERS
=============================================

Major Depressive Disorder (F32.x / F33.x)
  - Forensic Relevance: Common in personal injury claims, disability evaluations. Must differentiate from adjustment disorder, bereavement, and malingered depression. Validity testing critical in litigation context.
  - Key Forensic Consideration: Severity specifier (mild/moderate/severe) directly impacts functional impairment opinions.

Bipolar I Disorder (F31.x)
  - Forensic Relevance: Manic episodes may be relevant to CST (impaired judgment, grandiosity affecting cooperation with counsel), risk assessment (impulsivity during mania), and criminal responsibility.
  - Key Forensic Consideration: Distinguish between behavior during episode vs. interepisode functioning. Current episode specifier is critical.

=============================================
TRAUMA AND STRESSOR-RELATED DISORDERS
=============================================

Posttraumatic Stress Disorder (F43.10)
  - Criterion A: Exposure to actual or threatened death, serious injury, or sexual violence (direct, witnessed, learned about close person, repeated professional exposure)
  - Criterion B: Intrusion symptoms (≥1 required)
  - Criterion C: Avoidance (≥1 required)
  - Criterion D: Negative cognitions and mood (≥2 required)
  - Criterion E: Arousal and reactivity (≥2 required)
  - Duration: >1 month
  - Forensic Relevance: Primary diagnosis in personal injury/tort claims. MUST assess with structured instrument (CAPS-5). MUST include validity testing (SIMS, TOMM, MMPI F-family). Address Criterion A gateway carefully, not every distressing event qualifies.
  - Specifiers: With dissociative symptoms (depersonalization/derealization); With delayed expression (≥6 months)

Acute Stress Disorder (F43.0)
  - Forensic Relevance: May apply in immediate aftermath evaluations. Duration 3 days to 1 month after trauma. Does not require same cluster structure as PTSD.

Adjustment Disorder (F43.2x)
  - Forensic Relevance: Important differential in personal injury cases where stressor does not meet PTSD Criterion A. Less severe impairment. Must resolve within 6 months of stressor termination.

=============================================
SUBSTANCE USE DISORDERS
=============================================

General Framework:
  - Mild: 2-3 criteria
  - Moderate: 4-5 criteria
  - Severe: 6+ criteria
  - Specifiers: In early remission (3-12 mo), in sustained remission (>12 mo), on maintenance therapy, in a controlled environment

Alcohol Use Disorder (F10.x0)
  - Forensic Relevance: Relevant to risk assessment (disinhibition), CST (chronic cognitive effects), criminal responsibility (voluntary intoxication), custody (parenting capacity).

Cannabis Use Disorder (F12.x0)
  - Forensic Relevance: Increasingly relevant as legalization creates tension between legal status and clinical impact. Address cognitive effects during active use.

Stimulant Use Disorder (F15.x0 cocaine; F15.x0 amphetamine)
  - Forensic Relevance: Stimulant-induced psychosis mimics primary psychotic disorders. Time course is critical, stimulant psychosis typically resolves within days to weeks of cessation.

=============================================
NEURODEVELOPMENTAL DISORDERS
=============================================

Intellectual Disability (F7x)
  - Classification: Mild (F70), Moderate (F71), Severe (F72), Profound (F73)
  - Forensic Relevance: Directly relevant to CST (Dusky capacities), criminal responsibility (mens rea), Atkins v. Virginia (2002) for capital cases, Miranda waiver capacity.
  - Assessment: Requires BOTH (1) intellectual deficits on standardized testing AND (2) adaptive functioning deficits. IQ alone is insufficient.

ADHD (F90.x)
  - Forensic Relevance: May affect impulse control, risk behavior, substance use. Consider as context factor, rarely central to psycholegal question.

=============================================
PERSONALITY DISORDERS
=============================================

Antisocial Personality Disorder (F60.2)
  - Key Criteria: Age ≥18, evidence of conduct disorder onset before age 15, pervasive pattern of disregard for rights of others (≥3 criteria since age 15)
  - Forensic Relevance: Relevant to risk assessment, not appropriate as sole basis for civil commitment in most jurisdictions. PCL-R measures related but distinct construct (psychopathy).
  - IMPORTANT: Do not conflate with psychopathy. A person can meet ASPD criteria without elevated PCL-R scores, and vice versa.

Borderline Personality Disorder (F60.3)
  - Forensic Relevance: May affect credibility assessments, stalking/harassment cases, custody evaluations (emotional dysregulation impact on parenting).

=============================================
NEUROCOGNITIVE DISORDERS
=============================================

Major Neurocognitive Disorder (F02.x)
  - Forensic Relevance: Central to testamentary capacity, financial capacity, guardianship evaluations. Requires documented cognitive decline from premorbid level AND functional impairment.
  - Key: Must specify suspected etiology (Alzheimer's, vascular, Lewy body, etc.)

Mild Neurocognitive Disorder (F06.7x)
  - Forensic Relevance: Capacity may be preserved. Decision-specific and time-specific capacity assessment required.

=============================================
MALINGERING (V65.2 / Z76.5)
=============================================
  - NOT a mental disorder, listed in "Other Conditions That May Be a Focus of Clinical Attention"
  - DSM-5-TR guidance: Suspect when (1) medicolegal context, (2) marked discrepancy between claimed distress and objective findings, (3) lack of cooperation, (4) presence of ASPD
  - NEVER use as standalone label. Specify: malingered cognitive deficits, malingered psychiatric symptoms, malingered somatic complaints
  - Base on converging evidence from multiple validity indicators, not a single test score
`
  },
  {
    originalFilename: "Colorado_CST_Statute_Reference.txt",
    ext: ".txt",
    mime: "text/plain",
    content: `COLORADO COMPETENCY TO STAND TRIAL, STATUTORY REFERENCE
C.R.S. § 16-8.5-101 through 16-8.5-116

Compiled for forensic evaluation practice reference.
This is a practice summary, not legal advice. Verify current statute text.

=============================================
KEY DEFINITIONS (§ 16-8.5-101)
=============================================

"Competent to proceed" means that a defendant does not have a mental disability or developmental disability that renders the defendant incapable of:
  (a) Understanding the nature and course of the proceedings against the defendant; or
  (b) Participating or assisting in the defense; or
  (c) Cooperating with defense counsel.

"Mental disability" means a substantial disorder of thought, mood, perception, or cognitive ability that results in marked functional disability.

=============================================
RAISING THE QUESTION (§ 16-8.5-102)
=============================================

The question of competency may be raised by the court, prosecution, or defense at any time after charges are filed. Good faith doubt about competency triggers mandatory evaluation.

=============================================
EVALUATION REQUIREMENTS (§ 16-8.5-103)
=============================================

Court shall appoint one or more qualified experts to examine the defendant.

Qualified evaluator must be:
  - Licensed psychologist or psychiatrist
  - Completed forensic evaluation training approved by the Department
  - In some cases, provisionally licensed clinicians under supervision

Evaluation must be completed within:
  - 30 days if defendant is in custody
  - 60 days if defendant is out of custody
  - Extensions may be granted for good cause

=============================================
REPORT REQUIREMENTS (§ 16-8.5-104)
=============================================

Written report must include:
  (a) Description of evaluation procedures
  (b) Diagnosis, if any, with DSM criteria met
  (c) Clinical findings specific to each competency prong:
      - Understanding of nature and course of proceedings
      - Ability to participate/assist in defense
      - Ability to cooperate with counsel
  (d) Opinion on competency
  (e) If incompetent: opinion on restorability and timeframe
  (f) If incompetent: recommended placement (outpatient vs. inpatient)
  (g) Any medications being taken and their effects

=============================================
COMPETENCY HEARING (§ 16-8.5-105)
=============================================

Burden of proof: Preponderance of the evidence
Burden falls on: The party raising the issue

If found competent: Case proceeds.
If found incompetent: Court considers restoration.

=============================================
RESTORATION (§ 16-8.5-111)
=============================================

Restoration services may be provided:
  - Outpatient (community-based), preferred when appropriate
  - Inpatient (state hospital), when community setting insufficient

Maximum restoration period:
  - Misdemeanor: 91 days
  - Felony (non-violent): 1 year
  - Felony (violent): 3 years

Court must review progress every 90 days.

If not restored within maximum period:
  - Charges dismissed OR
  - Civil commitment proceedings initiated

=============================================
MEDICATION OVER OBJECTION (§ 16-8.5-112)
=============================================

Involuntary medication for restoration purposes requires:
  - Sell v. United States (2003) hearing
  - Government must demonstrate:
    (1) Important governmental interest at stake
    (2) Medication is substantially likely to render defendant competent
    (3) Medication is substantially unlikely to have side effects undermining fairness
    (4) Less intrusive alternatives have been considered

=============================================
EVALUATOR PRACTICE NOTES
=============================================

1. Always address ALL THREE prongs separately, even if one clearly resolves the question.
2. Colorado uses "competent to proceed" language, not "competent to stand trial."
3. Report must be filed with court and copies provided to both prosecution and defense.
4. Evaluator may be called to testify, prepare for both direct and cross.
5. If defendant refuses to participate: document refusal, base opinion on available data, note limitations.
6. Consider cultural and linguistic factors, interpreter use must be documented.
7. The evaluation is point-in-time. If medication changes between evaluation and hearing, note this in testimony.
`
  },
  {
    originalFilename: "Dusky_Standard_and_Key_Case_Law.txt",
    ext: ".txt",
    mime: "text/plain",
    content: `KEY CASE LAW FOR FORENSIC PSYCHOLOGY PRACTICE
Quick Reference for Evaluation and Testimony

=============================================
COMPETENCY TO STAND TRIAL
=============================================

Dusky v. United States, 362 U.S. 402 (1960)
  Standard: Whether the defendant has "sufficient present ability to consult with his lawyer with a reasonable degree of rational understanding" and whether he has "a rational as well as factual understanding of the proceedings against him."
  Two prongs: (1) Ability to consult with counsel; (2) Understanding of proceedings (both factual AND rational).
  Key: "Present ability", competency is assessed at the time of proceedings, not at time of offense.

Drope v. Missouri, 420 U.S. 162 (1975)
  Expanded Dusky: Added that the defendant must have "the ability to assist in preparing his defense." Effectively creates a third prong in some jurisdictions.
  Key: Failure to conduct a competency evaluation when facts raise a bona fide doubt violates due process.

Godinez v. Moran, 509 U.S. 389 (1993)
  The Dusky standard applies to all stages of criminal proceedings, including guilty pleas and waiver of counsel. No heightened competency standard required.

Indiana v. Edwards, 554 U.S. 164 (2008)
  States may require a higher standard of competency for self-representation than for standing trial. A defendant may be competent to stand trial with counsel but not competent to represent themselves.

Cooper v. Oklahoma, 517 U.S. 348 (1996)
  Burden of proof for incompetency: preponderance of the evidence (states may not require clear and convincing evidence).

=============================================
CRIMINAL RESPONSIBILITY / INSANITY
=============================================

M'Naghten's Case (1843), England
  "At the time of committing the act, the party accused was laboring under such a defect of reason, from disease of the mind, as not to know the nature and quality of the act he was doing, or if he did know it, that he did not know he was doing what was wrong."
  Still used in many U.S. jurisdictions.

Clark v. Arizona, 548 U.S. 735 (2006)
  States may limit the insanity defense to the M'Naghten standard (knowledge of wrongfulness only) without violating due process.

=============================================
EXPERT TESTIMONY ADMISSIBILITY
=============================================

Daubert v. Merrell Dow Pharmaceuticals, 509 U.S. 579 (1993)
  Federal standard for scientific expert testimony. Court acts as gatekeeper. Considers:
    (1) Whether theory/technique can be and has been tested
    (2) Whether it has been subjected to peer review and publication
    (3) Known or potential rate of error
    (4) General acceptance in the relevant scientific community
  Key for forensic psychology: Use validated instruments. Document methodology. Make reasoning explicit.

Frye v. United States, 293 F. 1013 (D.C. Cir. 1923)
  "General acceptance" test. Still used in some state courts (CA, NY, IL, others). Expert testimony must be based on scientific methods that are "generally accepted" in the relevant field.

Kumho Tire Co. v. Carmichael, 526 U.S. 137 (1999)
  Extended Daubert to all expert testimony, not just scientific experts. Clinical opinion testimony is also subject to reliability scrutiny.

=============================================
INTELLECTUAL DISABILITY / CAPITAL CASES
=============================================

Atkins v. Virginia, 536 U.S. 304 (2002)
  Execution of intellectually disabled persons violates the Eighth Amendment. States set their own procedures for determining intellectual disability.

Hall v. Florida, 572 U.S. 701 (2014)
  States may not use a strict IQ cutoff of 70 to determine intellectual disability. Must consider the standard error of measurement (SEM). An IQ score of 75 with SEM of 5 means the true score could be 70.

Moore v. Texas, 581 U.S. 1 (2017)
  Clinical standards (AAIDD, APA) must inform the determination, not outdated stereotypes or lay stereotypes of intellectual disability.

=============================================
RISK ASSESSMENT
=============================================

Kansas v. Hendricks, 521 U.S. 346 (1997)
  Sexually violent predator (SVP) civil commitment requires a "mental abnormality" that makes the person likely to engage in predatory acts of sexual violence. Not limited to DSM diagnoses.

Kansas v. Crane, 534 U.S. 407 (2002)
  SVP commitment requires proof that the individual has "serious difficulty" controlling behavior, not complete inability to control behavior.

Barefoot v. Estelle, 463 U.S. 880 (1983)
  Expert testimony on future dangerousness is admissible despite acknowledged limitations in predictive accuracy. However, cross-examination can expose those limitations.
  Note: This case is widely criticized. Evaluation practice has evolved substantially since 1983 with SPJ instruments.

=============================================
MIRANDA AND CONFESSIONS
=============================================

Miranda v. Arizona, 384 U.S. 436 (1966)
  Custodial interrogation requires warnings. Waiver must be knowing, intelligent, and voluntary.
  Forensic relevance: Evaluate whether a defendant's mental state (intellectual disability, psychosis, intoxication) rendered Miranda waiver invalid.

Colorado v. Connelly, 479 U.S. 157 (1986)
  Coercive police conduct is a necessary predicate for involuntary confession. Mental illness alone does not make a confession involuntary.

=============================================
CUSTODY EVALUATION
=============================================

Troxel v. Granville, 530 U.S. 57 (2000)
  Fit parents have a fundamental right to make decisions concerning the care, custody, and control of their children. Court orders overriding a fit parent's decision must receive special weight.

AFCC Model Standards for Child Custody Evaluation (2006)
  Not case law but the professional standard of care. Evaluators should be familiar with these standards and follow them.
`
  },
  {
    originalFilename: "Test_Battery_Selection_Guide.txt",
    ext: ".txt",
    mime: "text/plain",
    content: `FORENSIC TEST BATTERY SELECTION GUIDE
By Evaluation Type, Instruments, Purpose, and Norming Notes

=============================================
UNIVERSAL: PERFORMANCE & SYMPTOM VALIDITY
=============================================
ALWAYS administer validity testing FIRST, report BEFORE substantive results.

Performance Validity Tests (PVT):
  - TOMM (Test of Memory Malingering): Trial 1, Trial 2, Retention. Cutoff: <45 on Trial 2.
  - MSVT (Medical Symptom Validity Test): Immediate, Delayed, Consistency. Cutoff varies by index.
  - WMT (Word Memory Test): Immediate, Delayed, Consistency. Published cutoffs.
  - b Test: Cutoff: <15 errors.
  - RDS (Reliable Digit Span from WAIS-IV): Cutoff: ≤7.

Symptom Validity Tests (SVT):
  - SIMS (Structured Inventory of Malingered Symptomatology): Total >14 suggests feigning.
  - M-FAST (Miller Forensic Assessment of Symptoms Test): Total >6 warrants further assessment.
  - MMPI-3 Validity Scales: F, Fp, FBS, RBS, Fs. Interpret as configuration, not individual scales.

=============================================
COMPETENCY TO STAND TRIAL
=============================================

Primary Competency Instruments:
  - MacCAT-CA (MacArthur Competence Assessment Tool, Criminal Adjudication)
    Subscales: Understanding (0-16), Reasoning (0-16), Appreciation (0-6)
    Norms: Clinical and community samples. Interpret by subscale, not total.

  - ECST-R (Evaluation of Competency to Stand Trial, Revised)
    Subscales: Consult with Counsel, Factual Understanding, Rational Understanding
    Also includes: Atypical Presentation scales (detect feigned incompetency)

  - CAST*MR (Competence Assessment for Standing Trial for Defendants with Mental Retardation)
    Use ONLY when intellectual disability is suspected. Simplified language.

Supplemental:
  - WAIS-IV/WAIS-V (if cognitive deficits suspected)
  - MMPI-3 or PAI (personality and psychopathology)
  - MoCA or MMSE (brief cognitive screening)

=============================================
CHILD CUSTODY
=============================================

Parent Assessment:
  - MMPI-3 (Minnesota Multiphasic Personality Inventory-3)
    568 items. Validity + Clinical + PSY-5 + RC scales. Gold standard for custody.
    Note: MMPI-2 still widely used but MMPI-3 is current edition.

  - PAI (Personality Assessment Inventory)
    344 items. Alternative to MMPI when reading level is concern (4th grade vs. 6th).
    Validity: ICN, INF, NIM, PIM. Clinical: 11 scales.

  - MCMI-IV (Millon Clinical Multiaxial Inventory-IV)
    Use cautiously in custody, designed for clinical populations, not general population.
    High false positive rate for personality disorders in custody litigants.

  - PSI-4 (Parenting Stress Index, 4th Edition)
    120 items. Measures parenting stress across domains.

  - PCRI (Parent-Child Relationship Inventory)
    78 items. Measures parenting attitudes and relationship quality.
    Scales: Support, Satisfaction, Involvement, Communication, Limit Setting, Autonomy, Role Orientation

Child Assessment:
  - CBCL (Child Behavior Checklist, Achenbach System)
    Parent-report (CBCL), Teacher-report (TRF), Youth self-report (YSR 11-18).
    Cross-informant comparison is critical in custody cases.

  - Sentence Completion (age-appropriate version)
  - Kinetic Family Drawing (projective, use with caution, limited psychometric support)
  - ASPECT (Ackerman-Schoendorf Scales for Parent Evaluation of Custody)

=============================================
VIOLENCE RISK ASSESSMENT
=============================================

General Violence:
  - HCR-20 V3 (Historical-Clinical-Risk Management-20, Version 3)
    20 items across H (10), C (5), R (5) scales. SPJ framework.
    NOT actuarial, generates low/moderate/high judgment, not probability.

  - PCL-R (Psychopathy Checklist, Revised)
    20 items, semi-structured interview + file review. Total score 0-40.
    Factor 1: Interpersonal/Affective. Factor 2: Lifestyle/Antisocial.
    Clinical threshold: 30 (North America). Research cutoff only, NOT diagnostic.
    IMPORTANT: Requires specific training. Administration time ~3 hours.

  - VRAG-R (Violence Risk Appraisal Guide, Revised)
    Actuarial instrument. 12 items. Generates probability estimate.
    Use in conjunction with SPJ, not alone.

Sexual Violence:
  - STATIC-99R: Actuarial, 10 items (static factors only). Risk categories.
  - SVR-20 (Sexual Violence Risk-20): SPJ framework.
  - STABLE-2007 / ACUTE-2007: Dynamic risk factors for ongoing monitoring.

Intimate Partner Violence:
  - SARA (Spousal Assault Risk Assessment Guide): 20-item SPJ.
  - DVSI-R (Domestic Violence Screening Instrument, Revised)
  - ODARA (Ontario Domestic Assault Risk Assessment): Actuarial, 13 items.

Stalking:
  - SAM (Stalking Assessment and Management): SPJ framework.

=============================================
PTSD / PERSONAL INJURY
=============================================

PTSD-Specific:
  - CAPS-5 (Clinician-Administered PTSD Scale for DSM-5)
    Gold standard structured interview. 30 items. Maps directly to DSM-5 criteria.
    Severity score 0-80. Diagnostic threshold: 33 (recommended).
    REQUIRED in forensic PTSD evaluation, self-report alone is insufficient.

  - PCL-5 (PTSD Checklist for DSM-5)
    20-item self-report. Screening/monitoring, not diagnostic alone.
    Cutoff: 31-33 (varies by population).

  - TSI-2 (Trauma Symptom Inventory-2)
    136 items. 12 clinical scales. Includes validity scales (ATR, RL, INC).
    Broader trauma symptoms beyond PTSD.

Supplemental:
  - MMPI-3 (critical for validity assessment in litigation context)
  - BDI-2 (Beck Depression Inventory-II), comorbid depression
  - BAI (Beck Anxiety Inventory), comorbid anxiety
  - Functional assessment instruments as appropriate

=============================================
TESTAMENTARY / DECISIONAL CAPACITY
=============================================

Cognitive Screening:
  - MoCA (Montreal Cognitive Assessment): 30 points. <26 suggests impairment.
  - MMSE (Mini-Mental State Examination): 30 points. Well-known but ceiling effects.
  - SLUMS (Saint Louis University Mental Status): 30 points. Better sensitivity than MMSE.

Full Neuropsychological Battery (when warranted):
  - WAIS-IV/WAIS-V (intellectual functioning)
  - WMS-IV (memory)
  - D-KEFS (executive function)
  - Trail Making Test A & B
  - WCST (Wisconsin Card Sorting Test)
  - Boston Naming Test
  - Category Fluency / Letter Fluency

Capacity-Specific:
  - MacCAT-T (MacArthur Competence Assessment Tool, Treatment)
    For treatment decision-making capacity.
  - HCAI (Hopemont Capacity Assessment Interview)
  - ILS (Independent Living Scales)
  - ACCT (Assessment of Capacity for Clinical Trial participation)

=============================================
SCORE REPORTING CONVENTIONS
=============================================

Always report:
  1. Standard score on the instrument's native metric
  2. Percentile rank
  3. 95% confidence interval
  4. Descriptive classification per the test manual
  5. Normative sample used
  6. Validity indicator status BEFORE interpreting scores

Classification Systems (vary by instrument, use the publisher's system):
  IQ-Type (M=100, SD=15): <70 Extremely Low → 130+ Very Superior
  T-Scores (M=50, SD=10): <30 Very Low → 70+ Very High
  Scaled (M=10, SD=3): 1-4 Extremely Low → 16-19 Superior
`
  },
  {
    originalFilename: "APA_Specialty_Guidelines_Summary.txt",
    ext: ".txt",
    mime: "text/plain",
    content: `APA SPECIALTY GUIDELINES FOR FORENSIC PSYCHOLOGY (2013)
Practice Reference Summary

Source: American Psychological Association. (2013). Specialty guidelines for forensic psychology. American Psychologist, 68(1), 7-19.

=============================================
PURPOSE AND SCOPE
=============================================

These guidelines are aspirational, not mandatory. They are intended to improve the quality of forensic psychological services and facilitate the systematic development of the specialty. They apply to all psychologists who provide forensic services, regardless of whether they identify as forensic psychologists.

Forensic psychology is defined broadly: professional practice by any psychologist working within any sub-discipline of psychology when applying the scientific, technical, or specialized knowledge of psychology to the law.

=============================================
1. RESPONSIBILITIES (Guidelines 1.01-1.04)
=============================================

1.01, Knowledge of the Legal System
Forensic practitioners seek to understand the legal and professional standards relevant to their practice area, including relevant case law, statutes, rules, and legal procedures.

1.02, Knowledge of Scientific Basis
Practitioners rely on scientifically and professionally derived knowledge. Distinguish between established facts, provisional opinions, and personal values.

1.03, Competence
Practice within boundaries of competence based on education, training, supervised experience, and professional experience. Seek continuing education.

1.04, Scope of Practice
Do not extend opinions beyond the scope of relevant data and scientific basis. Acknowledge limitations.

=============================================
2. INDEPENDENCE AND OBJECTIVITY (Guidelines 2.01-2.08)
=============================================

2.01, Impartiality and Fairness
Strive for accuracy, impartiality, and fairness. Guard against the effects of advocacy.

2.02, Conflicts of Interest
Avoid dual roles. Do not serve as both therapist and forensic evaluator for the same individual.

2.03, Multiple Relationships
Be alert to multiple relationship issues. The forensic context creates unique multiple relationship risks.

2.04, Therapeutic-Forensic Role Conflicts
When a treating clinician is asked to provide forensic opinions, clearly delineate the limitations of doing so. Preferably, refer to an independent evaluator.

2.07, Contingent Fees
Forensic practitioners do not accept contingent fees (fees contingent on outcome of a case).

=============================================
3. INFORMED CONSENT AND NOTIFICATION (Guidelines 3.01-3.03)
=============================================

3.01, Notification of Purpose
Before conducting an evaluation, notify the examinee of:
  - The nature, purpose, and anticipated use of the evaluation
  - Who requested the evaluation
  - Who will receive the results
  - The limits of confidentiality
  - The voluntary or court-ordered nature of participation

3.02, Informed Consent
When possible, obtain informed consent. In court-ordered evaluations where consent is not required, notification (above) is still mandatory.

3.03, Communication with Collateral Sources
Consider obtaining consent before contacting collateral sources when feasible. Document any limitations on this process.

=============================================
4. METHODS AND PROCEDURES (Guidelines 4.01-4.08)
=============================================

4.01, Use of Methods and Procedures
Select methods and procedures that are appropriate to the forensic context and relevant to the psycholegal question.

4.02, Use of Multiple Sources of Information
Rely on multiple sources of data. Avoid over-reliance on any single source. Cross-validate information across sources.

4.02.01, When Sources Conflict
When information from different sources conflicts, attempt to resolve the discrepancy. Document the conflict and how it was addressed.

4.03, Use of Forensic Assessment Instruments
Use instruments that are validated for the specific forensic purpose. Be aware of the limitations of general clinical instruments when applied in forensic contexts.

4.04, Third Party Observation
Consider the potential effects of third-party observation on evaluation results.

4.06, Documentation
Maintain thorough documentation of all contacts, procedures, findings, and consultations.

=============================================
5. OPINIONS (Guidelines 5.01-5.04)
=============================================

5.01, Basis for Opinions
Base opinions on adequate foundation. Do not provide opinions without adequate basis.

5.02, Knowledge of the Law
Understand the legal standard being addressed but express opinions in clinical/scientific terms.

5.03, Ultimate Issue Opinions
When providing ultimate issue opinions (e.g., "competent to stand trial"), clearly articulate the clinical basis and the reasoning connecting data to opinion.

5.04, Report Writing
Reports should:
  - Be well-organized and clearly written
  - Distinguish between observations, inferences, and opinions
  - Present reasoning chains transparently
  - Acknowledge limitations and alternative explanations
  - Define technical terms

=============================================
6. COMMUNICATION (Guidelines 6.01-6.05)
=============================================

6.01, Honesty and Accuracy
Present findings honestly and accurately, including findings that may be adverse to the retaining party's position.

6.02, Scope of Testimony
In testimony, stay within the scope of expertise and the data gathered.

6.04, Comprehensive and Accurate Presentation
Present the full range of relevant data, including contradictory information. Do not selectively present data.

=============================================
IMPLICATIONS FOR PSYGIL IMPLEMENTATION
=============================================

1. Template system must enforce notification/consent documentation (Guideline 3.01).
2. Sources of Information section must be comprehensive and mandatory (Guideline 4.02).
3. Reports must separate observations from opinions structurally (Guideline 5.04).
4. The "DOCTOR ALWAYS DIAGNOSES" principle aligns with Guideline 5.01, opinions must have adequate basis and be formed by the clinician, not generated by AI.
5. Limitations section is mandatory, not optional (Guideline 1.04).
6. Contradictory data must be presented even when it weakens the opinion (Guideline 6.04).
7. Template warnings should flag potential dual-role conflicts (Guideline 2.02).
`
  }
];
function seedResources(workspacePath) {
  const resourcesRoot = path.join(workspacePath, "Workspace");
  const writingSamplesDir = path.join(resourcesRoot, "Writing Samples");
  const templatesDir = path.join(resourcesRoot, "Templates");
  const documentationDir = path.join(resourcesRoot, "Documents");
  for (const dir of [resourcesRoot, writingSamplesDir, templatesDir, documentationDir]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
  const cleanStaleFiles = (dir) => {
    try {
      for (const f of fs.readdirSync(dir)) {
        if (f.endsWith(".meta.json")) {
          try {
            const { unlinkSync } = require("fs");
            unlinkSync(path.join(dir, f));
          } catch {
          }
        }
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(f)) {
          try {
            const { unlinkSync } = require("fs");
            unlinkSync(path.join(dir, f));
          } catch {
          }
        }
      }
    } catch {
    }
  };
  cleanStaleFiles(writingSamplesDir);
  cleanStaleFiles(templatesDir);
  cleanStaleFiles(documentationDir);
  const DOC_EXTS = /* @__PURE__ */ new Set([".txt", ".pdf", ".doc", ".docx", ".csv", ".rtf", ".md", ".xlsx"]);
  const hasRealDocs = (dir) => {
    try {
      return fs.readdirSync(dir).some((f) => {
        if (f.startsWith(".") || f.startsWith("_")) return false;
        const ext = f.substring(f.lastIndexOf(".")).toLowerCase();
        return DOC_EXTS.has(ext);
      });
    } catch {
      return false;
    }
  };
  if (hasRealDocs(writingSamplesDir) || hasRealDocs(templatesDir) || hasRealDocs(documentationDir)) {
    console.log("[seed] Resources already seeded, skipping");
    return 0;
  }
  let count = 0;
  for (const file of WRITING_SAMPLES) {
    writeSeedFile(writingSamplesDir, file);
    count++;
  }
  for (const file of TEMPLATES) {
    writeSeedFile(templatesDir, file);
    count++;
  }
  for (const file of DOCUMENTATION) {
    writeSeedFile(documentationDir, file);
    count++;
  }
  console.log(`[seed] Seeded ${count} resource files across 3 categories`);
  return count;
}
const TRIGGER = path.join(electron.app.getPath("userData"), "seed-demo.trigger");
function ensureDir$1(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}
function createPlaceholder(dir, filename, content) {
  ensureDir$1(dir);
  const filePath = path.join(dir, filename);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, content ?? `[DEMO PLACEHOLDER] ${filename}
This is a demo file for UI development.
`, "utf-8");
  }
  return filePath;
}
const CASES = [
  // ─── ONBOARDING (5) ───────────────────────────────────────────────
  { num: "PSY-2026-0201", last: "Brown", first: "Deshawn", dob: "2003-09-18", gender: "M", evalType: "CST", referral: "Court", stage: "onboarding", complaint: "Defendant unable to communicate with counsel", charges: "Murder 2nd (F2)", jurisdiction: "Denver District Court", attorney: "PD Sarah Henley", deadline: "2026-05-01", createdAt: "2026-03-25", notes: "New intake. No prior psych history on file." },
  { num: "PSY-2026-0202", last: "Lewis", first: "Darnell", dob: "1991-04-10", gender: "M", evalType: "CST", referral: "Court", stage: "onboarding", complaint: "Bizarre behavior in courtroom, talking to self", charges: "Assault 1st (F3), Kidnapping (F2)", jurisdiction: "Denver District Court", attorney: "PD Alisha Green", deadline: "2026-05-12", createdAt: "2026-03-27", notes: "Court observed disorganized speech during arraignment." },
  { num: "PSY-2026-0203", last: "Ramirez", first: "Sofia", dob: "1988-06-15", gender: "F", evalType: "Risk", referral: "Court", stage: "onboarding", complaint: "Repeated violations of protective order", charges: "Harassment (M1), Stalking (M1)", jurisdiction: "Adams County", attorney: "PD Raymond Ortiz", deadline: "2026-05-15", createdAt: "2026-03-28", notes: "Third DV-related charge in 18 months." },
  { num: "PSY-2026-0204", last: "Okafor", first: "Chidi", dob: "1978-11-22", gender: "M", evalType: "Neuropsych", referral: "Attorney", stage: "onboarding", complaint: "Cognitive decline following TBI", charges: "", jurisdiction: "", attorney: "Marcus Webb, Esq.", deadline: "2026-05-20", createdAt: "2026-03-29", notes: "MVA 6 months ago. Employer reports significant functional decline." },
  { num: "PSY-2026-0205", last: "Park", first: "Minji", dob: "2001-02-08", gender: "F", evalType: "ADHD Dx", referral: "Physician", stage: "onboarding", complaint: "Academic underperformance, inattention complaints from employer", charges: "", jurisdiction: "", attorney: "", deadline: "2026-05-25", createdAt: "2026-03-29", notes: "Referred by PCP. History of poor academic performance." },
  // ─── TESTING (6) ──────────────────────────────────────────────────
  { num: "PSY-2026-0211", last: "Martinez", first: "Jose", dob: "1982-01-30", gender: "M", evalType: "Custody", referral: "Attorney", stage: "testing", complaint: "Parenting capacity dispute", charges: "", jurisdiction: "Arapahoe County Family Court", attorney: "Maria Gonzalez, Esq.", deadline: "2026-04-20", createdAt: "2026-03-10", notes: "High-conflict custody. Allegations of alcohol use by father." },
  { num: "PSY-2026-0212", last: "Rivera", first: "Carmen", dob: "1990-02-14", gender: "F", evalType: "PTSD Dx", referral: "Attorney", stage: "testing", complaint: "Psychological injury from workplace harassment", charges: "", jurisdiction: "", attorney: "Linda Park, Esq.", deadline: "2026-04-25", createdAt: "2026-03-08", notes: "CAPS-5, PCL-5, MMPI-3 administered. Awaiting score entry." },
  { num: "PSY-2026-0213", last: "Morales", first: "Diego", dob: "1995-07-03", gender: "M", evalType: "Risk", referral: "Court", stage: "testing", complaint: "Threat assessment after workplace threat", charges: "Menacing (F5), Harassment (M3)", jurisdiction: "Denver District Court", attorney: "PD Rachel Wong", deadline: "2026-05-05", createdAt: "2026-03-15", notes: "PCL-R, HCR-20v3 in progress. MMPI-3 completed." },
  { num: "PSY-2026-0214", last: "Okafor", first: "Yinka", dob: "1999-03-22", gender: "F", evalType: "ADHD Dx", referral: "Physician", stage: "testing", complaint: "Poor concentration, missed deadlines at work", charges: "", jurisdiction: "", attorney: "", deadline: "2026-04-30", createdAt: "2026-03-12", notes: "CAARS, CPT-3, WAIS-V administered. Score entry in progress." },
  { num: "PSY-2026-0215", last: "Cooper", first: "Marcus", dob: "1970-12-05", gender: "M", evalType: "Capacity", referral: "Attorney", stage: "testing", complaint: "Financial decision-making capacity questioned by family", charges: "", jurisdiction: "El Paso County Probate", attorney: "Elena Ruiz, Esq.", deadline: "2026-04-18", createdAt: "2026-03-06", notes: "MoCA and WAIS-V completed. Awaiting Trail Making and WCST." },
  { num: "PSY-2026-0216", last: "Mitchell", first: "Jamal", dob: "1987-09-28", gender: "M", evalType: "Mitigation", referral: "Attorney", stage: "testing", complaint: "Sentencing mitigation evaluation", charges: "Armed Robbery (F3)", jurisdiction: "Denver District Court", attorney: "PD Thomas Grant", deadline: "2026-04-22", createdAt: "2026-03-11", notes: "Defense requesting mitigation report for sentencing hearing." },
  // ─── INTERVIEW (6) ────────────────────────────────────────────────
  { num: "PSY-2026-0221", last: "Nguyen", first: "Linh", dob: "1994-08-17", gender: "F", evalType: "CST", referral: "Court", stage: "interview", complaint: "Defendant mute during proceedings", charges: "Arson 1st (F3)", jurisdiction: "Arapahoe County", attorney: "PD Michael Torres", deadline: "2026-04-28", createdAt: "2026-03-05", notes: "2 interviews completed. Testing: MMPI-3, PAI, WAIS-V." },
  { num: "PSY-2026-0222", last: "Rivera", first: "Carmen", dob: "1985-04-12", gender: "F", evalType: "Custody", referral: "Court", stage: "interview", complaint: "Relocation dispute affecting custody arrangement", charges: "", jurisdiction: "Jefferson County Family Court", attorney: "Judge Patricia Reeves", deadline: "2026-05-10", createdAt: "2026-03-02", notes: "Mother interview complete. Father interview scheduled." },
  { num: "PSY-2026-0223", last: "Mitchell", first: "Brenda", dob: "1976-10-30", gender: "F", evalType: "CST", referral: "Court", stage: "interview", complaint: "Reported auditory hallucinations during detention", charges: "Criminal Mischief (F4), Trespass (M3)", jurisdiction: "Jefferson County", attorney: "PD Thomas Grant", deadline: "2026-05-08", createdAt: "2026-03-01", notes: "1 interview completed. Collateral interview with family pending." },
  { num: "PSY-2026-0224", last: "Jackson", first: "Terrell", dob: "1980-05-19", gender: "M", evalType: "Risk", referral: "Court", stage: "interview", complaint: "Parole board risk evaluation for early release", charges: "Sexual Assault 2nd (F4)", jurisdiction: "Colorado DOC", attorney: "ADA Karen Wells", deadline: "2026-04-15", createdAt: "2026-02-20", notes: "Clinical interview and collateral review complete. Ingestor pending." },
  { num: "PSY-2026-0225", last: "Kim", first: "Sung-Ho", dob: "1973-12-01", gender: "M", evalType: "PTSD Dx", referral: "Attorney", stage: "interview", complaint: "Combat-related PTSD claim for VA benefits", charges: "", jurisdiction: "", attorney: "Steven Park, Esq.", deadline: "2026-04-20", createdAt: "2026-02-25", notes: "3 interview sessions. Detailed trauma history documented." },
  { num: "PSY-2026-0226", last: "Thompson", first: "Kiara", dob: "1996-07-14", gender: "F", evalType: "Fitness", referral: "Court", stage: "interview", complaint: "Fitness to proceed, alleged intellectual disability", charges: "Theft (M1), Fraud (M2)", jurisdiction: "Boulder County", attorney: "PD Anna Klein", deadline: "2026-05-02", createdAt: "2026-03-03", notes: "WAIS-V and ABAS-3 completed. Clinical interview in progress." },
  // ─── DIAGNOSTICS (7) ──────────────────────────────────────────────
  { num: "PSY-2026-0231", last: "Johnson", first: "Marcus", dob: "1992-03-15", gender: "M", evalType: "CST", referral: "Court", stage: "diagnostics", complaint: "Cannot assist counsel, possible psychotic disorder", charges: "Assault 1st (F3), Criminal Mischief (M1)", jurisdiction: "Denver District Court", attorney: "ADA Rachel Thornton", deadline: "2026-04-15", createdAt: "2026-02-15", notes: "Schizophrenia suspected. 3 sessions completed. All testing done." },
  { num: "PSY-2026-0232", last: "Williams", first: "Sarah", dob: "1984-09-08", gender: "F", evalType: "Risk", referral: "Court", stage: "diagnostics", complaint: "Stalking with escalation pattern", charges: "Stalking (F5), Menacing (M1)", jurisdiction: "Jefferson County", attorney: "PD Kevin Ford", deadline: "2026-04-01", createdAt: "2026-02-10", notes: "HCR-20v3, PCL-R scored. Diagnostician ready for review." },
  { num: "PSY-2026-0233", last: "Washington", first: "Keisha", dob: "1989-01-25", gender: "F", evalType: "CST", referral: "Court", stage: "diagnostics", complaint: "Erratic behavior, possible bipolar episode", charges: "Robbery (F4), Assault 3rd (M1)", jurisdiction: "Adams County", attorney: "PD David Chen", deadline: "2026-04-12", createdAt: "2026-02-18", notes: "Diagnostician identified Bipolar I and ASPD differential." },
  { num: "PSY-2026-0234", last: "Kim", first: "Sung-Ho", dob: "1973-12-01", gender: "M", evalType: "PTSD Dx", referral: "Attorney", stage: "diagnostics", complaint: "PTSD and TBI differential diagnosis", charges: "", jurisdiction: "", attorney: "Steven Park, Esq.", deadline: "2026-04-05", createdAt: "2026-02-05", notes: "Diagnostician presenting PTSD vs. Adjustment Disorder options." },
  { num: "PSY-2026-0235", last: "Foster", first: "Derek", dob: "1981-06-20", gender: "M", evalType: "Malingering", referral: "Court", stage: "diagnostics", complaint: "Suspected symptom fabrication, disability claim", charges: "Theft (F4)", jurisdiction: "Denver District Court", attorney: "ADA Nancy Clark", deadline: "2026-04-02", createdAt: "2026-02-08", notes: "MMPI-3 FBS elevated. SIRS-2 probable. TOMM below cutoff." },
  { num: "PSY-2026-0236", last: "Tanaka", first: "Yuki", dob: "1967-05-30", gender: "F", evalType: "Capacity", referral: "Attorney", stage: "diagnostics", complaint: "Testamentary capacity for contested will", charges: "", jurisdiction: "El Paso County Probate", attorney: "Margaret Collins, Esq.", deadline: "2026-04-10", createdAt: "2026-02-12", notes: "MoCA=18. Diagnostician weighing Major NCD vs. age-related decline." },
  { num: "PSY-2026-0237", last: "Reeves", first: "Anthony", dob: "1975-03-08", gender: "M", evalType: "Mitigation", referral: "Attorney", stage: "diagnostics", complaint: "Sentencing mitigation, childhood trauma history", charges: "Aggravated Assault (F4)", jurisdiction: "Arapahoe County", attorney: "PD Carlos Diaz", deadline: "2026-04-18", createdAt: "2026-02-14", notes: "ACEs score 8/10. Diagnostician evaluating PTSD + SUD comorbidity." },
  // ─── REVIEW (6) ───────────────────────────────────────────────────
  { num: "PSY-2026-0241", last: "Fitzgerald", first: "Sean", dob: "1963-08-11", gender: "M", evalType: "Capacity", referral: "Attorney", stage: "review", complaint: "Financial conservatorship evaluation", charges: "", jurisdiction: "Douglas County Probate", attorney: "Margaret Collins, Esq.", deadline: "2026-04-18", createdAt: "2026-01-20", notes: "Draft report in clinician review. Vascular NCD diagnosed." },
  { num: "PSY-2026-0242", last: "Hoffman", first: "Rachel", dob: "1990-11-04", gender: "F", evalType: "Fitness", referral: "Court", stage: "review", complaint: "Fitness to proceed, possible dissociative disorder", charges: "Forgery (F5)", jurisdiction: "Boulder County", attorney: "PD James Hartley", deadline: "2026-04-08", createdAt: "2026-01-25", notes: "Report drafted. Editor flagged 2 medium issues." },
  { num: "PSY-2026-0243", last: "Kowalski", first: "Anna", dob: "1979-03-16", gender: "F", evalType: "Custody", referral: "Court", stage: "review", complaint: "Custody modification, substance abuse allegation", charges: "", jurisdiction: "El Paso County Family Court", attorney: "Judge William Huang", deadline: "2026-04-15", createdAt: "2026-01-28", notes: "Both parents evaluated. Report under clinical review." },
  { num: "PSY-2026-0244", last: "Cooper", first: "Ashley", dob: "1988-04-22", gender: "F", evalType: "CST", referral: "Court", stage: "review", complaint: "Restored competency, re-evaluation", charges: "Assault 2nd (F4), Resisting Arrest (M2)", jurisdiction: "Denver District Court", attorney: "PD Olivia Barnes", deadline: "2026-04-08", createdAt: "2026-01-15", notes: "Competent. Report ready for attestation. Editor: 1 high flag." },
  { num: "PSY-2026-0245", last: "Patel", first: "Neha", dob: "1986-07-09", gender: "F", evalType: "PTSD Dx", referral: "Attorney", stage: "review", complaint: "PTSD from sexual assault, civil damages case", charges: "", jurisdiction: "", attorney: "Jennifer Walsh, Esq.", deadline: "2026-04-12", createdAt: "2026-01-22", notes: "PTSD confirmed. Report in final review before attestation." },
  { num: "PSY-2026-0246", last: "Santos", first: "Rafael", dob: "1971-10-15", gender: "M", evalType: "Neuropsych", referral: "Attorney", stage: "review", complaint: "Cognitive impairment after industrial chemical exposure", charges: "", jurisdiction: "", attorney: "David Greenwald, Esq.", deadline: "2026-04-20", createdAt: "2026-01-18", notes: "Neuropsych battery complete. Report drafted with 3 AI draft sections." },
  // ─── COMPLETE (12) ────────────────────────────────────────────────
  { num: "PSY-2026-0251", last: "Chen", first: "Wei", dob: "1977-02-19", gender: "M", evalType: "PTSD Dx", referral: "Attorney", stage: "complete", complaint: "Occupational PTSD, first responder", charges: "", jurisdiction: "", attorney: "Linda Park, Esq.", deadline: "2026-03-10", createdAt: "2025-12-15", notes: "PTSD confirmed. Report finalized and sealed." },
  { num: "PSY-2026-0252", last: "Thompson", first: "Robert", dob: "1969-06-30", gender: "M", evalType: "Malingering", referral: "Court", stage: "complete", complaint: "Symptom exaggeration in disability claim", charges: "Fraud (F4)", jurisdiction: "Adams County", attorney: "ADA James Whitfield", deadline: "2026-03-20", createdAt: "2025-12-10", notes: "Malingering confirmed. MMPI-3 and SIRS-2 definitive." },
  { num: "PSY-2026-0253", last: "Anderson", first: "Lisa", dob: "1993-09-14", gender: "F", evalType: "Fitness", referral: "Court", stage: "complete", complaint: "Fitness restored after treatment", charges: "Theft (M1)", jurisdiction: "Boulder County", attorney: "PD Anna Klein", deadline: "2026-03-15", createdAt: "2025-12-01", notes: "Fit to proceed. Treatment compliance documented." },
  { num: "PSY-2026-0254", last: "Garcia", first: "Miguel", dob: "1965-12-03", gender: "M", evalType: "Capacity", referral: "Attorney", stage: "complete", complaint: "Conservatorship, advanced dementia", charges: "", jurisdiction: "El Paso County Probate", attorney: "Elena Ruiz, Esq.", deadline: "2026-02-28", createdAt: "2025-11-15", notes: "Lacks capacity. Conservatorship recommended." },
  { num: "PSY-2026-0255", last: "Petrov", first: "Alexei", dob: "1975-04-03", gender: "M", evalType: "Risk", referral: "Court", stage: "complete", complaint: "SVP risk assessment, sexual offense history", charges: "Sexual Assault (F3)", jurisdiction: "Denver District Court", attorney: "ADA Karen Wells", deadline: "2026-03-15", createdAt: "2025-11-20", notes: "High risk. Civil commitment recommended." },
  { num: "PSY-2026-0256", last: "Jackson", first: "Tamara", dob: "1983-08-07", gender: "F", evalType: "CST", referral: "Court", stage: "complete", complaint: "Incompetent, treatment ordered", charges: "Assault 2nd (F4)", jurisdiction: "Denver District Court", attorney: "PD Marcus Lee", deadline: "2026-03-10", createdAt: "2025-11-25", notes: "IST. Committed to CMHIP for restoration." },
  { num: "PSY-2026-0257", last: "Taylor", first: "Brandon", dob: "1997-01-20", gender: "M", evalType: "CST", referral: "Court", stage: "complete", complaint: "Substance-induced psychosis resolved", charges: "DUI (M1), Eluding (F5)", jurisdiction: "Adams County", attorney: "ADA Robert Park", deadline: "2026-03-25", createdAt: "2025-12-05", notes: "Competent. Substance-induced condition resolved." },
  { num: "PSY-2026-0258", last: "Harris", first: "Tyrone", dob: "1972-11-28", gender: "M", evalType: "Risk", referral: "Court", stage: "complete", complaint: "DV risk, lethality assessment for bond hearing", charges: "Domestic Violence (F4)", jurisdiction: "Arapahoe County", attorney: "ADA Michelle Stevens", deadline: "2026-03-05", createdAt: "2025-11-10", notes: "High lethality risk. No-contact bond recommended." },
  { num: "PSY-2026-0259", last: "Suzuki", first: "Kenji", dob: "1998-05-16", gender: "M", evalType: "ADHD Dx", referral: "Physician", stage: "complete", complaint: "ADHD evaluation for workplace accommodations", charges: "", jurisdiction: "", attorney: "", deadline: "2026-03-30", createdAt: "2025-12-20", notes: "ADHD Combined confirmed. Accommodations letter provided." },
  { num: "PSY-2026-0260", last: "Singh", first: "Rajveer", dob: "1968-03-09", gender: "M", evalType: "Fitness", referral: "Court", stage: "complete", complaint: "Fitness evaluation, non-English speaker", charges: "DUI (M1)", jurisdiction: "Weld County", attorney: "PD Carlos Diaz", deadline: "2026-03-18", createdAt: "2025-12-08", notes: "Fit to proceed with interpreter. Language barrier only." },
  { num: "PSY-2026-0261", last: "OBrien", first: "Patrick", dob: "1960-09-25", gender: "M", evalType: "Malingering", referral: "Insurance", stage: "complete", complaint: "Workers comp claim, suspected feigning", charges: "", jurisdiction: "", attorney: "Hartford Insurance", deadline: "2026-03-28", createdAt: "2025-12-12", notes: "Malingering probable. TOMM and SIRS-2 below cutoffs." },
  { num: "PSY-2026-0262", last: "Hawkins", first: "Gerald", dob: "1958-12-09", gender: "M", evalType: "Capacity", referral: "Court", stage: "complete", complaint: "Healthcare proxy decision-making capacity", charges: "", jurisdiction: "Boulder County Probate", attorney: "Margaret Collins, Esq.", deadline: "2026-02-15", createdAt: "2025-11-01", notes: "Vascular NCD. Lacks capacity for healthcare decisions." }
];
function stageToStatus(stage) {
  switch (stage) {
    case "onboarding":
      return "intake";
    case "complete":
      return "completed";
    default:
      return "in_progress";
  }
}
function generateOnboardingData(c) {
  const age = (/* @__PURE__ */ new Date()).getFullYear() - parseInt(c.dob.slice(0, 4), 10);
  const isMale = c.gender === "M";
  const marital = age > 35 ? Math.random() > 0.5 ? "Married" : "Divorced" : "Single";
  const edu = age > 40 ? "Bachelor's degree" : Math.random() > 0.5 ? "Some college" : "High school diploma";
  return {
    contact: {
      marital_status: marital,
      dependents: marital === "Married" || marital === "Divorced" ? `${Math.floor(Math.random() * 3) + 1} children` : "None",
      living_situation: marital === "Married" ? "Lives with spouse" : age > 30 ? "Lives alone in apartment" : "Lives with family",
      primary_language: c.last === "Martinez" || c.last === "Rivera" || c.last === "Morales" || c.last === "Ramirez" ? "Spanish (bilingual English)" : "English"
    },
    complaints: {
      primary_complaint: c.complaint,
      secondary_concerns: c.evalType === "Capacity" ? "Family members report increasing confusion about financial matters, missed bill payments, and difficulty managing daily affairs over the past 12 months." : c.evalType === "CST" ? "Difficulty understanding court proceedings. Reports confusion about roles of judge, attorney, and jury." : c.evalType === "Custody" ? "Concerned about impact on children. Reports stress and sleep disruption since proceedings began." : c.evalType === "PTSD Dx" ? "Nightmares, hypervigilance, avoidance of trauma reminders. Reports significant impairment in daily functioning." : c.evalType === "Risk" ? "Reports feeling misunderstood. Denies intent to harm but acknowledges anger management difficulties." : "Reports difficulty concentrating, maintaining employment, and managing daily responsibilities.",
      onset_timeline: c.evalType === "Capacity" ? "Gradual onset over approximately 18 months. Family first noticed problems with checkbook management." : `Approximately ${Math.floor(Math.random() * 12) + 3} months ago, coinciding with ${c.charges ? "legal involvement" : "the precipitating event"}.`
    },
    family: {
      family_of_origin: `Raised by ${isMale ? "both parents" : "mother"} in ${["Denver", "Colorado Springs", "Pueblo", "Aurora", "Fort Collins"][Math.floor(Math.random() * 5)]}. ${Math.floor(Math.random() * 3) + 1} siblings.`,
      family_mental_health: c.evalType === "Capacity" ? "Mother had dementia diagnosed in her 70s. Father died of stroke at age 68." : Math.random() > 0.4 ? `${isMale ? "Mother" : "Father"} treated for depression. No other known family psychiatric history.` : "No known family psychiatric history reported.",
      family_medical_history: "Hypertension (maternal), diabetes (paternal).",
      current_family_relationships: marital === "Married" ? "Reports supportive relationship with spouse. Regular contact with extended family." : marital === "Divorced" ? "Co-parenting relationship described as strained. Limited contact with ex-spouse." : "Maintains regular contact with parents and siblings."
    },
    education: {
      highest_education: edu,
      schools_attended: `${["East", "West", "North", "Central", "Mountain View"][Math.floor(Math.random() * 5)]} High School${edu.includes("college") || edu.includes("Bachelor") ? `, ${["Metro State", "UC Denver", "PPCC", "Colorado State", "CU Boulder"][Math.floor(Math.random() * 5)]}` : ""}`,
      academic_experience: edu.includes("Bachelor") ? "Average academic performance. No special education history." : "Graduated on time. No learning disability diagnosis.",
      employment_status: c.evalType === "Capacity" ? "Retired" : Math.random() > 0.3 ? "Employed" : "Unemployed",
      current_employer: c.evalType === "Capacity" ? "N/A, retired since 2020" : "",
      work_history: c.evalType === "Capacity" ? "Worked 30+ years in financial services. Retired as branch manager. Employer noted no concerns prior to retirement." : `${Math.floor(Math.random() * 5) + 2} jobs in the past 10 years. Longest tenure: ${Math.floor(Math.random() * 5) + 2} years.`,
      military_service: Math.random() > 0.8 ? `${isMale ? "US Army" : "US Air Force"}, ${4 + Math.floor(Math.random() * 8)} years, honorable discharge.` : "N/A"
    },
    health: {
      medical_conditions: c.evalType === "Capacity" ? "Hypertension (controlled with medication), Type 2 diabetes, mild hearing loss bilateral." : Math.random() > 0.5 ? "No significant medical conditions reported." : "Hypertension, managed with medication. No other active conditions.",
      current_medications: c.evalType === "Capacity" ? "Lisinopril 20mg daily, Metformin 500mg BID, aspirin 81mg daily." : Math.random() > 0.5 ? "None reported." : "Sertraline 50mg daily.",
      surgeries_hospitalizations: c.evalType === "Capacity" ? "Appendectomy (1995), knee replacement (2018)." : "No surgical history reported.",
      head_injuries: c.evalType === "Capacity" ? "No reported head injuries. No loss of consciousness events." : c.evalType === "Neuropsych" ? "TBI from motor vehicle accident 6 months ago. Brief loss of consciousness at scene. ER evaluation, CT negative." : "No reported head injuries.",
      sleep_quality: c.evalType === "PTSD Dx" ? "Poor, nightmares 3-4 times per week, difficulty falling asleep." : "Reports adequate sleep, 6-7 hours per night.",
      appetite_weight: "Appetite normal. No significant weight changes in past 6 months."
    },
    mental: {
      previous_treatment: c.evalType === "PTSD Dx" ? "Outpatient therapy for 3 months after incident. Discontinued due to cost. No current treatment." : Math.random() > 0.5 ? "No prior mental health treatment reported." : "Brief counseling 2 years ago for adjustment issues. No ongoing treatment.",
      previous_diagnoses: c.evalType === "PTSD Dx" ? "Provisional PTSD diagnosis by treating therapist." : c.evalType === "ADHD Dx" ? "Teacher recommended ADHD evaluation in childhood; never formally assessed." : "No prior psychiatric diagnoses.",
      psych_medications: Math.random() > 0.6 ? "None currently." : "Sertraline 50mg, started 6 months ago by PCP.",
      self_harm_history: "Denies any history of self-harm or suicidal ideation.",
      violence_history: c.evalType === "Risk" ? "One prior assault charge (dismissed). Reports two physical altercations in past 5 years." : "Denies history of violence toward others."
    },
    substance: {
      alcohol_use: Math.random() > 0.5 ? "Social drinking, 2-3 drinks per week. Denies binge drinking." : "Denies alcohol use.",
      drug_use: c.evalType === "CST" && Math.random() > 0.5 ? "Reports marijuana use, daily for past 2 years. Denies other substance use." : "Denies current or past illicit drug use.",
      substance_treatment: "No history of substance abuse treatment."
    },
    legal: {
      arrests_convictions: c.charges ? `Current charges: ${c.charges}. ${Math.random() > 0.5 ? "One prior misdemeanor conviction." : "No prior criminal history."}` : "No criminal history reported.",
      incarceration_history: c.charges && Math.random() > 0.5 ? "Brief pretrial detention (3 days) related to current charges." : "No incarceration history.",
      probation_parole: "Not currently on probation or parole.",
      protective_orders: c.evalType === "Risk" ? "Active protective order filed by complainant. No prior protective orders." : "No protective orders."
    },
    recent: {
      events_circumstances: c.evalType === "Capacity" ? "Adult children petitioned for conservatorship after discovering $40,000 in unpaid bills and several suspicious financial transactions over the past year. Mr. Cooper was previously meticulous about finances. Family reports he has become increasingly confused about account balances and bill due dates." : `${c.complaint}. ${c.charges ? `Facing charges of ${c.charges}.` : ""} Evaluation ordered to address ${c.evalType === "CST" ? "competency to stand trial" : c.evalType === "Custody" ? "parenting fitness and custody recommendation" : c.evalType === "Risk" ? "risk of future violence" : "the referral question"}.`,
      current_stressors: c.charges ? "Pending legal proceedings, potential incarceration, financial strain from legal costs." : c.evalType === "Capacity" ? "Family conflict over financial management. Loss of independence. Uncertainty about living situation." : "Current legal/evaluation process, occupational impact, relationship strain.",
      goals_evaluation: c.evalType === "Capacity" ? 'Wants to demonstrate he can manage his own affairs. States he is "just fine" and family is overreacting.' : c.evalType === "CST" ? "Wants the process to be over. Uncertain about what the evaluation entails." : "Hopes evaluation will support a favorable outcome. Willing to cooperate with process."
    }
  };
}
const TEST_BATTERIES = {
  CST: ["MMPI-3", "PAI", "WAIS-V", "TOMM", "SIRS-2"],
  Custody: ["MMPI-3", "MCMI-IV", "PPVT-5", "ASPECT"],
  Risk: ["MMPI-3", "PCL-R", "HCR-20v3", "STATIC-99R"],
  Capacity: ["MoCA", "WAIS-V", "Trail Making A-B", "WCST"],
  "PTSD Dx": ["MMPI-3", "CAPS-5", "PCL-5", "TSI-2"],
  "ADHD Dx": ["CAARS-2", "CPT-3", "WAIS-V", "BRIEF-2A"],
  Malingering: ["MMPI-3", "SIRS-2", "TOMM", "PAI"],
  Fitness: ["WAIS-V", "ABAS-3", "MMPI-3", "MacCAT-CA"],
  Neuropsych: ["WAIS-V", "WMS-IV", "Trail Making A-B", "WCST", "D-KEFS", "BNT"],
  Mitigation: ["MMPI-3", "PAI", "ACE-Q", "PCL-5"]
};
function shouldSeedDemoCases() {
  return fs.existsSync(TRIGGER);
}
function seedDemoCases() {
  if (!fs.existsSync(TRIGGER)) return;
  console.log("[seed] Starting comprehensive demo seed (42 cases)...");
  const sqlite = getSqlite();
  (/* @__PURE__ */ new Date()).toISOString();
  let wsPath = loadWorkspacePath();
  if (!wsPath) {
    wsPath = getDefaultWorkspacePath();
  }
  createFolderStructure(wsPath);
  console.log(`[seed] Workspace: ${wsPath}`);
  const existingUser = sqlite.prepare("SELECT user_id FROM users WHERE user_id = 1").get();
  if (!existingUser) {
    sqlite.prepare(`
      INSERT INTO users (user_id, email, full_name, role, credentials, license_number, state_licensed, is_active, created_at)
      VALUES (1, 'truck@psygil.com', 'Dr. Truck Irwin, Psy.D.', 'psychologist', 'Psy.D., ABPP', 'PSY-CO-12345', 'CO', 1, '2026-01-01')
    `).run();
    console.log("[seed] Created clinician user (user_id=1)");
  }
  const insertCase = sqlite.prepare(`
    INSERT OR IGNORE INTO cases (
      case_number, primary_clinician_user_id,
      examinee_first_name, examinee_last_name, examinee_dob, examinee_gender,
      evaluation_type, referral_source, evaluation_questions,
      case_status, workflow_current_stage, notes, created_at, last_modified
    ) VALUES (
      @case_number, 1,
      @first, @last, @dob, @gender,
      @evalType, @referral, @complaint,
      @status, @stage, @notes, @createdAt, @createdAt
    )
  `);
  const insertIntake = sqlite.prepare(`
    INSERT OR IGNORE INTO patient_intake (
      case_id, referral_type, referral_source, eval_type,
      presenting_complaint, jurisdiction, charges,
      attorney_name, report_deadline, status, created_at, updated_at
    ) VALUES (
      @caseId, @refType, @referral, @evalType,
      @complaint, @jurisdiction, @charges,
      @attorney, @deadline, @intakeStatus, @createdAt, @createdAt
    )
  `);
  const insertOnboarding = sqlite.prepare(`
    INSERT OR IGNORE INTO patient_onboarding (
      case_id, section, content, clinician_notes, verified, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertDataConf = sqlite.prepare(`
    INSERT OR IGNORE INTO data_confirmation (
      case_id, category_id, status, notes, updated_at
    ) VALUES (?, ?, ?, ?, ?)
  `);
  const insertDoc = sqlite.prepare(`
    INSERT INTO documents (
      case_id, document_type, original_filename, file_path, mime_type, uploaded_by_user_id, upload_date
    ) VALUES (?, ?, ?, ?, ?, 1, ?)
  `);
  const insertAgentRun = sqlite.prepare(`
    INSERT INTO agent_runs (
      case_id, agent_type, input_summary, output_summary, status, invoked_by_user_id, started_at, completed_at
    ) VALUES (?, ?, ?, ?, 'success', 1, ?, ?)
  `);
  const insertCatalogEntry = sqlite.prepare(`
    INSERT OR IGNORE INTO diagnosis_catalog (code, dsm5tr_code, name, category, is_builtin)
    VALUES (?, ?, ?, ?, 1)
  `);
  const getCatalogId = sqlite.prepare(`SELECT diagnosis_id FROM diagnosis_catalog WHERE code = ?`);
  const insertDiagnosis = sqlite.prepare(`
    INSERT OR IGNORE INTO diagnoses (
      case_id, diagnosis_id, clinician_user_id, confidence_level,
      supporting_evidence, selection_date, is_primary_diagnosis, rule_out_rationale
    ) VALUES (?, ?, 1, ?, ?, ?, ?, ?)
  `);
  const insertReport = sqlite.prepare(`
    INSERT INTO reports (
      case_id, report_version, generated_by_user_id, status, file_path,
      is_locked, integrity_hash, finalized_at, created_at, last_modified
    ) VALUES (?, 1, 1, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertAudit = sqlite.prepare(`
    INSERT INTO audit_log (
      case_id, action_type, actor_user_id, action_date, details
    ) VALUES (?, ?, ?, ?, ?)
  `);
  let inserted = 0;
  const seedTransaction = sqlite.transaction(() => {
    for (const c of CASES) {
      const status = stageToStatus(c.stage);
      const result = insertCase.run({
        case_number: c.num,
        first: c.first,
        last: c.last,
        dob: c.dob,
        gender: c.gender,
        evalType: c.evalType,
        referral: c.referral,
        complaint: c.complaint,
        status,
        stage: c.stage,
        notes: `[DEMO] ${c.notes}`,
        createdAt: c.createdAt
      });
      if (result.changes === 0) continue;
      const caseId = Number(result.lastInsertRowid);
      inserted++;
      const folderName = `${c.num.replace("PSY-", "")} ${c.last}, ${c.first}`;
      const caseFolderPath = path.join(wsPath, folderName);
      ensureDir$1(caseFolderPath);
      for (const sub of CASE_SUBFOLDERS$1) {
        ensureDir$1(path.join(caseFolderPath, sub));
      }
      sqlite.prepare("UPDATE cases SET folder_path = ? WHERE case_id = ?").run(caseFolderPath, caseId);
      createPlaceholder(
        path.join(caseFolderPath, "_Inbox"),
        "CASE_INFO.txt",
        `PSYGIL DEMO CASE, AI-GENERATED DATA
${"=".repeat(40)}
Case:       ${c.num}
Examinee:   ${c.last}, ${c.first}
DOB:        ${c.dob}
Eval Type:  ${c.evalType}
Stage:      ${c.stage.toUpperCase()}
Referral:   ${c.referral}
Complaint:  ${c.complaint}
${c.charges ? `Charges:    ${c.charges}
` : ""}${c.jurisdiction ? `Court:      ${c.jurisdiction}
` : ""}${c.attorney ? `Attorney:   ${c.attorney}
` : ""}Deadline:   ${c.deadline}

This is a demo case containing no real patient data.
`
      );
      const refType = c.referral.toLowerCase().includes("court") ? "court" : c.referral.toLowerCase().includes("attorney") ? "attorney" : c.referral.toLowerCase().includes("insurance") ? "insurance" : c.referral.toLowerCase().includes("physician") ? "physician" : "court";
      const stageIndex = ["onboarding", "testing", "interview", "diagnostics", "review", "complete"].indexOf(c.stage);
      const intakeComplete = stageIndex >= 1;
      insertIntake.run({
        caseId,
        refType,
        referral: c.referral,
        evalType: c.evalType,
        complaint: c.complaint,
        jurisdiction: c.jurisdiction || null,
        charges: c.charges || null,
        attorney: c.attorney || null,
        deadline: c.deadline,
        intakeStatus: intakeComplete ? "complete" : "draft",
        createdAt: c.createdAt
      });
      insertAudit.run(caseId, "case_created", 1, c.createdAt, JSON.stringify({ eval_type: c.evalType }));
      if (stageIndex >= 1) {
        const ob = generateOnboardingData(c);
        for (const [section, content] of Object.entries(ob)) {
          insertOnboarding.run(
            caseId,
            section,
            JSON.stringify(content),
            null,
            1,
            "complete",
            c.createdAt,
            c.createdAt
          );
        }
      }
      if (stageIndex >= 0) {
        const collateralDir = path.join(caseFolderPath, "Collateral");
        const refFile = createPlaceholder(
          collateralDir,
          `Referral_Order_${c.num.replace("PSY-", "")}.pdf`,
          `[DEMO] Referral Order
Case: ${c.num}
From: ${c.referral}
Complaint: ${c.complaint}
`
        );
        insertDoc.run(caseId, "referral", `Referral_Order_${c.num.replace("PSY-", "")}.pdf`, refFile, "application/pdf", c.createdAt);
        if (c.charges) {
          const priorFile = createPlaceholder(
            collateralDir,
            `Prior_Records_${c.num.replace("PSY-", "")}.pdf`,
            `[DEMO] Prior Records
Case: ${c.num}
Charges: ${c.charges}
`
          );
          insertDoc.run(caseId, "medical_record", `Prior_Records_${c.num.replace("PSY-", "")}.pdf`, priorFile, "application/pdf", c.createdAt);
        }
      }
      if (stageIndex >= 1) {
        insertDataConf.run(caseId, "demographics", "confirmed", "", c.createdAt);
        insertDataConf.run(caseId, "referral_questions", "confirmed", "", c.createdAt);
        insertDataConf.run(caseId, "timeline", stageIndex >= 2 ? "confirmed" : "flagged", stageIndex >= 2 ? "" : "Timeline needs verification", c.createdAt);
        insertDataConf.run(caseId, "collateral_records", "confirmed", "", c.createdAt);
        insertAudit.run(caseId, "case_modified", 1, c.createdAt, "{}");
        insertAudit.run(caseId, "case_modified", 1, c.createdAt, "{}");
        insertAudit.run(caseId, "gate_completed", 1, c.createdAt, JSON.stringify({ from: "onboarding", to: "testing" }));
        const tests = TEST_BATTERIES[c.evalType] || ["MMPI-3", "PAI"];
        const testingDir = path.join(caseFolderPath, "Testing");
        for (const test of tests) {
          const testFile = createPlaceholder(
            testingDir,
            `${test}_Scores_${c.num.replace("PSY-", "")}.pdf`,
            `[DEMO] ${test} Score Report
Case: ${c.num}
Examinee: ${c.first} ${c.last}
`
          );
          insertDoc.run(caseId, "score_report", `${test}_Scores_${c.num.replace("PSY-", "")}.pdf`, testFile, "application/pdf", c.createdAt);
        }
        insertAudit.run(caseId, "test_score_entered", 1, c.createdAt, JSON.stringify({ count: tests.length }));
      }
      if (stageIndex >= 2) {
        insertAudit.run(caseId, "gate_completed", 1, c.createdAt, JSON.stringify({ from: "testing", to: "interview" }));
        const interviewDir = path.join(caseFolderPath, "Interviews");
        const intNotesFile = createPlaceholder(
          interviewDir,
          `Clinical_Interview_Notes.pdf`,
          `[DEMO] Clinical Interview Notes
Case: ${c.num}
Examinee: ${c.first} ${c.last}
Eval Type: ${c.evalType}
`
        );
        insertDoc.run(caseId, "pdf", `Clinical_Interview_Notes.pdf`, intNotesFile, "application/pdf", c.createdAt);
        const behObsFile = createPlaceholder(
          interviewDir,
          `Behavioral_Observations.pdf`,
          `[DEMO] Behavioral Observations
Case: ${c.num}
Examinee: ${c.first} ${c.last}
`
        );
        insertDoc.run(caseId, "pdf", `Behavioral_Observations.pdf`, behObsFile, "application/pdf", c.createdAt);
        insertAgentRun.run(
          caseId,
          "validator",
          `Validate data completeness for ${c.evalType} evaluation`,
          JSON.stringify({
            completeness_score: 0.85 + Math.random() * 0.12,
            sections_checked: ["demographics", "referral", "history", "observations", "test_data"],
            ready_for_diagnostics: true
          }),
          c.createdAt,
          c.createdAt
        );
        insertAudit.run(caseId, "agent_invoked", 1, c.createdAt, JSON.stringify({ agent: "validator" }));
      }
      if (stageIndex >= 3) {
        insertAudit.run(caseId, "gate_completed", 1, c.createdAt, JSON.stringify({ from: "interview", to: "diagnostics" }));
        const diagOptions = getDiagnosticOptions(c.evalType);
        insertAgentRun.run(
          caseId,
          "diagnostician",
          `Diagnostic analysis for ${c.evalType} evaluation`,
          JSON.stringify({
            diagnostic_options: diagOptions.map((d) => ({ key: d.key, name: d.name, icd: d.icd_code })),
            evidence_summary: `Analysis based on ${c.evalType} evaluation protocol`
          }),
          c.createdAt,
          c.createdAt
        );
        insertAudit.run(caseId, "agent_invoked", 1, c.createdAt, JSON.stringify({ agent: "diagnostician" }));
        for (const dx of diagOptions) {
          insertCatalogEntry.run(dx.icd_code, dx.icd_code, dx.name, c.evalType);
          const catalogRow = getCatalogId.get(dx.icd_code);
          if (!catalogRow) continue;
          const isPrimary = dx.decision === "render" ? 1 : 0;
          const ruleOutRationale = dx.decision === "rule_out" ? dx.notes : null;
          const confidence = dx.decision === "render" ? "high" : dx.decision === "defer" ? "low" : "moderate";
          insertDiagnosis.run(
            caseId,
            catalogRow.diagnosis_id,
            confidence,
            dx.notes,
            c.createdAt,
            isPrimary,
            ruleOutRationale
          );
        }
        insertAudit.run(caseId, "diagnosis_selected", 1, c.createdAt, JSON.stringify({
          rendered: diagOptions.filter((d) => d.decision === "render").map((d) => d.name),
          ruled_out: diagOptions.filter((d) => d.decision === "rule_out").map((d) => d.name)
        }));
      }
      if (stageIndex >= 4) {
        insertAudit.run(caseId, "gate_completed", 1, c.createdAt, JSON.stringify({ from: "diagnostics", to: "review" }));
        insertAgentRun.run(
          caseId,
          "writer",
          `Generate report draft for ${c.evalType} evaluation`,
          JSON.stringify({
            sections: ["Identifying Information", "Referral Question", "Background History", "Clinical Interview", "Test Results", "Diagnostic Formulation", "Forensic Opinion"],
            draft_sections: ["Clinical Interview", "Diagnostic Formulation", "Forensic Opinion"],
            confidence_range: [0.6, 0.85]
          }),
          c.createdAt,
          c.createdAt
        );
        insertAudit.run(caseId, "agent_invoked", 1, c.createdAt, JSON.stringify({ agent: "writer" }));
        insertAgentRun.run(
          caseId,
          "validator",
          `Validate report draft for ${c.evalType} evaluation`,
          JSON.stringify({
            flags: [
              { severity: "high", section: "Forensic Opinion", issue: "Review ultimate opinion language" },
              { severity: "medium", section: "Test Results", issue: "Verify score accuracy" }
            ],
            total_flags: 2
          }),
          c.createdAt,
          c.createdAt
        );
        insertAudit.run(caseId, "agent_invoked", 1, c.createdAt, JSON.stringify({ agent: "validator" }));
        const reportsDir = path.join(caseFolderPath, "Reports");
        const reportFile = createPlaceholder(
          reportsDir,
          `draft_v1.docx`,
          `[DEMO] Report Draft v1
Case: ${c.num}
Examinee: ${c.first} ${c.last}
Eval Type: ${c.evalType}
`
        );
        insertReport.run(caseId, "in_review", reportFile, 0, null, null, c.createdAt, c.createdAt);
        insertAudit.run(caseId, "report_generated", 1, c.createdAt, "{}");
      }
      if (stageIndex >= 5) {
        insertAudit.run(caseId, "attestation_signed", 1, c.createdAt, JSON.stringify({ signed_by: "Dr. Truck Irwin, Psy.D., ABPP" }));
        insertAudit.run(caseId, "gate_completed", 1, c.createdAt, JSON.stringify({ from: "review", to: "complete" }));
        const sealedPdf = createPlaceholder(
          path.join(caseFolderPath, "Reports"),
          `Final_Report_${c.num.replace("PSY-", "")}.pdf`,
          `[DEMO] SEALED FINAL REPORT
Case: ${c.num}
Examinee: ${c.first} ${c.last}
Eval Type: ${c.evalType}
Finalized: ${c.createdAt}
`
        );
        sqlite.prepare(`
          UPDATE reports SET status = 'finalized', is_locked = 1,
            integrity_hash = ?, sealed_pdf_path = ?, finalized_at = ?
          WHERE case_id = ? AND report_version = 1
        `).run(
          `sha256:${caseId.toString(16).padStart(8, "0")}demo${c.num.replace(/[^0-9]/g, "")}`,
          sealedPdf,
          c.createdAt,
          caseId
        );
      }
    }
  });
  seedTransaction();
  console.log(`[seed] Inserted ${inserted}/${CASES.length} demo cases with full supporting data`);
  try {
    seedResources(wsPath);
  } catch (e) {
    console.error("[seed] Resources seed failed:", e);
  }
  try {
    fs.unlinkSync(TRIGGER);
  } catch {
  }
}
function getDiagnosticOptions(evalType) {
  switch (evalType) {
    case "CST":
      return [
        { key: "schizophrenia_f20.9", icd_code: "F20.9", name: "Schizophrenia, Unspecified", decision: "render", notes: "Meets criteria per clinical interview and testing" },
        { key: "aspd_f60.2", icd_code: "F60.2", name: "Antisocial Personality Disorder", decision: "rule_out", notes: "Insufficient criteria met" }
      ];
    case "Custody":
      return [
        { key: "aud_f10.20", icd_code: "F10.20", name: "Alcohol Use Disorder, Moderate", decision: "render", notes: "Confirmed by history and collateral" },
        { key: "gad_f41.1", icd_code: "F41.1", name: "Generalized Anxiety Disorder", decision: "render", notes: "Meets criteria, impacts parenting" },
        { key: "bpd_f60.3", icd_code: "F60.3", name: "Borderline Personality Disorder", decision: "rule_out", notes: "Some traits but insufficient for full diagnosis" }
      ];
    case "Risk":
      return [
        { key: "aspd_f60.2", icd_code: "F60.2", name: "Antisocial Personality Disorder", decision: "render", notes: "PCL-R score elevated, meets criteria" },
        { key: "sud_f19.20", icd_code: "F19.20", name: "Substance Use Disorder, Moderate", decision: "render", notes: "Active use contributes to risk profile" },
        { key: "ied_f63.81", icd_code: "F63.81", name: "Intermittent Explosive Disorder", decision: "rule_out", notes: "Pattern better accounted for by ASPD" }
      ];
    case "PTSD Dx":
      return [
        { key: "ptsd_f43.10", icd_code: "F43.10", name: "PTSD, Unspecified", decision: "render", notes: "Meets all DSM-5-TR criteria per CAPS-5" },
        { key: "adjustment_f43.21", icd_code: "F43.21", name: "Adjustment Disorder with Depression", decision: "rule_out", notes: "Symptoms exceed adjustment disorder severity" }
      ];
    case "ADHD Dx":
      return [
        { key: "adhd_f90.2", icd_code: "F90.2", name: "ADHD, Combined Presentation", decision: "render", notes: "Met criteria on CAARS-2, CPT-3, and clinical interview" },
        { key: "gad_f41.1", icd_code: "F41.1", name: "Generalized Anxiety Disorder", decision: "defer", notes: "Some overlap with ADHD symptoms; monitor" }
      ];
    case "Malingering":
      return [
        { key: "malingering_z76.5", icd_code: "Z76.5", name: "Malingering", decision: "render", notes: "SIRS-2 and TOMM confirm feigning" },
        { key: "factitious_f68.1", icd_code: "F68.1", name: "Factitious Disorder", decision: "rule_out", notes: "External incentive present; not factitious" }
      ];
    case "Fitness":
      return [
        { key: "mild_id_f70", icd_code: "F70", name: "Mild Intellectual Disability", decision: "render", notes: "WAIS-V FSIQ < 70, adaptive deficits confirmed" },
        { key: "sld_f81.9", icd_code: "F81.9", name: "Specific Learning Disorder", decision: "rule_out", notes: "Deficits too broad for SLD" }
      ];
    case "Capacity":
      return [
        { key: "ncd_major_f03.90", icd_code: "F03.90", name: "Major Neurocognitive Disorder", decision: "render", notes: "MoCA and neuropsych testing confirm major impairment" },
        { key: "mdd_f32.1", icd_code: "F32.1", name: "Major Depressive Disorder", decision: "rule_out", notes: "Cognitive deficits not attributable to depression" }
      ];
    case "Neuropsych":
      return [
        { key: "tbi_ncd_f06.30", icd_code: "F06.30", name: "NCD due to Traumatic Brain Injury", decision: "render", notes: "Neuropsych profile consistent with TBI sequelae" },
        { key: "mdd_f32.1", icd_code: "F32.1", name: "Major Depressive Disorder", decision: "render", notes: "Comorbid depression affecting recovery" }
      ];
    case "Mitigation":
      return [
        { key: "ptsd_f43.10", icd_code: "F43.10", name: "PTSD, Unspecified", decision: "render", notes: "Childhood trauma history meets PTSD criteria" },
        { key: "sud_f19.20", icd_code: "F19.20", name: "Substance Use Disorder, Moderate", decision: "render", notes: "Polysubstance use since adolescence" },
        { key: "aspd_f60.2", icd_code: "F60.2", name: "Antisocial Personality Disorder", decision: "defer", notes: "Features present but mitigated by trauma history" }
      ];
    default:
      return [
        { key: "unspecified_f99", icd_code: "F99", name: "Unspecified Mental Disorder", decision: "defer", notes: "Further evaluation needed" }
      ];
  }
}
const SYNTHETIC_BANNER = "[SYNTHETIC CASE DATA. All names, dates, charges, and facts in this document are fictitious and exist only for Psygil development and demonstration. Nothing here reflects a real patient or a real case.]";
function clinicianSignature() {
  return "\n\nRespectfully submitted,\n\nJordan Whitfield, Psy.D., ABPP\nLicensed Psychologist, Colorado #PSY-4312\nPike Forensics\n1420 Larimer Street, Suite 410\nDenver, CO 80202\n";
}
function reportHeader(caseNumber, examinee, dob, reportTitle, court) {
  return `${SYNTHETIC_BANNER}

PIKE FORENSICS
Forensic Psychology Services

${reportTitle.toUpperCase()}

Examinee: ${examinee}
Date of Birth: ${dob}
Case Number: ${caseNumber}
Court: ${court}
Date of Report: ${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}
Examiner: Jordan Whitfield, Psy.D., ABPP

`;
}
const CASE_NUMBER$9 = "2026-0318";
const EXAMINEE$9 = "Martensen, Elijah D.";
const DOB$9 = "1991-07-14";
const COURT$3 = "18th Judicial District, Arapahoe County Division 7";
const REFERRAL$5 = `${SYNTHETIC_BANNER}

LAW OFFICE OF HECTOR FUENTES
Arapahoe County Public Defender
6450 S. Revere Parkway
Centennial, CO 80111

March 3, 2026

Jordan Whitfield, Psy.D., ABPP
Pike Forensics
1420 Larimer Street, Suite 410
Denver, CO 80202

Re: State v. Elijah D. Martensen
Case No.: ${CASE_NUMBER$9}-CR
Charge: Second Degree Assault (C.R.S. 18-3-203)

Dear Dr. Whitfield,

I represent Mr. Martensen on a single count of second degree assault arising from an incident at a Centennial tavern on February 11, 2026. Mr. Martensen sustained a serious closed head injury in a 2017 motorcycle accident with documented post-concussive symptoms and intermittent cognitive lapses since. His mother reports he has been increasingly forgetful and verbally disorganized in the months leading up to the arrest.

I am requesting a competency to stand trial evaluation under C.R.S. 16-8.5. My specific concerns are Mr. Martensen's factual understanding of the charge and his ability to track the proceedings long enough to assist meaningfully in his defense. He is oriented and cooperative at the jail but loses the thread of conversations after a few minutes.

Enclosed are the arrest report, the 2017 neurology discharge summary, and a release for his records at Craig Hospital. Please contact my paralegal Lina Orozco at (303) 555-0184 for scheduling.

Sincerely,

Hector Fuentes
Attorney at Law
Reg. No. 38221
`;
const COURT_ORDER$3 = `${SYNTHETIC_BANNER}

DISTRICT COURT, ARAPAHOE COUNTY, COLORADO
Court Address: 7325 S. Potomac Street, Centennial, CO 80112

THE PEOPLE OF THE STATE OF COLORADO,
Plaintiff,
v.
ELIJAH D. MARTENSEN,
Defendant.

Case Number: ${CASE_NUMBER$9}-CR
Division: 7
Judge: Hon. Penelope Stransky

ORDER FOR COMPETENCY EVALUATION

THIS MATTER coming before the Court on defense counsel's Motion for a Competency Evaluation filed March 4, 2026, and the Court finding reasonable cause to believe the defendant may be incompetent to proceed, IT IS HEREBY ORDERED:

1. The defendant shall submit to a competency evaluation pursuant to C.R.S. 16-8.5-103.

2. Jordan Whitfield, Psy.D., ABPP of Pike Forensics is appointed as the evaluating psychologist.

3. The evaluation shall address whether the defendant has a rational and factual understanding of the proceedings and the present ability to consult with counsel with a reasonable degree of rational understanding.

4. The evaluator shall have access to all relevant records, including medical and mental health records, and may interview collateral sources as necessary.

5. The written report shall be filed with the Court and provided to counsel for both parties no later than April 15, 2026.

6. Proceedings are stayed pending completion of the evaluation.

SO ORDERED this 5th day of March, 2026.

BY THE COURT:

Penelope Stransky
District Court Judge
`;
const ARREST_REPORT = `${SYNTHETIC_BANNER}

CENTENNIAL POLICE DEPARTMENT
Case Report

Report Number: 2026-02-0471
Date of Incident: 02/11/2026
Time: Approximately 22:40 hours
Location: The Broken Spoke, 12890 E Arapahoe Road, Centennial, CO
Reporting Officer: Officer K. Villanueva, Badge 4112

INCIDENT SUMMARY

On the above date and time, I was dispatched to The Broken Spoke on a report of an assault in progress. Upon arrival I observed a male subject, later identified as Elijah D. Martensen (DOB: 07/14/1991), being held by two patrons. A second male subject, Dennis Orchard, was seated on a barstool holding a blood-soaked bar towel to his face.

Mr. Orchard stated that he had been playing pool with friends when Mr. Martensen approached the pool table and accused him of "talking about his mother." Mr. Orchard denied this. Mr. Martensen then struck Mr. Orchard in the face with a closed fist. Multiple witnesses confirmed this account.

Mr. Orchard sustained a laceration above his right eye and a fractured nasal bone per subsequent ED evaluation. He was transported to Centennial Medical Plaza by EMS and treated.

Mr. Martensen was taken into custody without further incident. He appeared confused and asked repeatedly why he had been stopped. He stated, "I don't remember being in here." He was unable to recall the events of the evening and was unable to provide a coherent account of his movements since leaving his mother's home earlier in the day.

Mr. Martensen was transported to the Arapahoe County Detention Facility and booked on a charge of second degree assault (C.R.S. 18-3-203).

Officer K. Villanueva
Centennial Police Department
`;
const MEDICAL_RECORDS = `${SYNTHETIC_BANNER}

CRAIG HOSPITAL
3425 S. Clarkson Street
Englewood, CO 80113

DISCHARGE SUMMARY (Excerpt for Forensic Review)
Patient: Elijah D. Martensen
DOB: 07/14/1991
Admission Date: 08/22/2017
Discharge Date: 09/14/2017
Attending Physician: Rhea Montefiore, MD

HOSPITAL COURSE

Mr. Martensen was admitted to Craig Hospital after initial stabilization at Denver Health following a single-vehicle motorcycle collision on Interstate 70 west of Idaho Springs. Initial GCS at the scene was 7; intubation was performed en route. CT demonstrated a right temporal contusion with subarachnoid hemorrhage, a left frontal contusion, and a non-displaced skull fracture along the right temporal bone. ICP monitoring was initiated and remained elevated for 48 hours.

Mr. Martensen regained consciousness on hospital day 6 and began a graduated rehabilitation program focused on cognitive retraining, balance, and gait. At discharge he was ambulating without assistance, following two-step commands, and able to converse at a basic level. He continued to have word-finding difficulty, reduced processing speed, and impaired working memory. Post-concussive syndrome was documented.

DIAGNOSES AT DISCHARGE

1. Traumatic brain injury, moderate (S06.2X1A)
2. Post-concussive syndrome
3. Cognitive impairment, moderate

RECOMMENDATIONS

1. Outpatient speech-language therapy, twice weekly
2. Outpatient neuropsychology follow-up in 3 months
3. No return to motorcycle operation
4. Gradual reintroduction of work responsibilities under supervision
5. Family education regarding TBI recovery trajectory

Mr. Martensen and his mother, Marlena Martensen, acknowledged the discharge instructions.

Signed,
Rhea Montefiore, MD
`;
const MOCA_SCREEN = `${SYNTHETIC_BANNER}

PIKE FORENSICS
Screening Assessment Summary

Examinee: Elijah D. Martensen
Date of Administration: March 24, 2026
Location: Arapahoe County Detention Facility, Interview Room 4
Examiner: Jordan Whitfield, Psy.D., ABPP

MONTREAL COGNITIVE ASSESSMENT (MoCA)

Version: 8.2 (alternate form)
Administration time: 14 minutes
Total score: 22 of 30

Subtest breakdown:
  Visuospatial / Executive:    3 / 5
  Naming:                      2 / 3
  Attention:                   4 / 6
  Language:                    2 / 3
  Abstraction:                 1 / 2
  Delayed Recall:              2 / 5
  Orientation:                 6 / 6 (with prompt for day of week)

INTERPRETATION

A MoCA total of 22 is below the standard cutoff of 26 and consistent with mild cognitive impairment in an examinee with Mr. Martensen's documented history of moderate TBI. Delayed recall and executive function showed the greatest weakness. Basic orientation was preserved.

This screen supports the need for a structured competency interview with documentation of functional abilities across multiple contacts. The MoCA does not by itself answer the competency question.

Administered by: Jordan Whitfield, Psy.D., ABPP
`;
const INTERVIEW_ONE = `${SYNTHETIC_BANNER}

COMPETENCY INTERVIEW NOTES, SESSION 1
Examinee: Elijah D. Martensen
Date: March 24, 2026
Location: Arapahoe County Detention Facility
Duration: 90 minutes
Examiner: Jordan Whitfield, Psy.D., ABPP

NOTIFICATION OF NON-CONFIDENTIALITY

Explained the purpose of the evaluation, the court referral, and the limits of confidentiality. Mr. Martensen restated the purpose in his own words: "You're checking if I understand my case. You'll write a report for the judge." He asked no questions and agreed to proceed.

MENTAL STATUS

Appropriately groomed in jail attire. Cooperative, slow to initiate speech, attentive to questions but required several repeated prompts for complex questions. Speech was fluent but showed mild word-finding pauses. Mood was described as "alright, kind of tired." Affect was restricted. Denied suicidal or homicidal ideation, auditory or visual hallucinations, and paranoid ideation. Oriented to person and place; stated the date was "the 22nd or 23rd" (actual was the 24th). Remote memory for personal history was generally intact. Recent memory showed multiple gaps.

FACTUAL UNDERSTANDING

Charges. Mr. Martensen named the charge as "assault." He could not recall the specific degree. When I read the charge to him (second degree assault), he acknowledged it without protest and said "OK, that sounds right."

Roles in the courtroom. He correctly identified the judge ("decides things"), the prosecutor ("the DA, trying to convict me"), and his own attorney ("Mr. Fuentes, he's on my side"). He described a jury as "people who listen and say if you did it." He was uncertain about the role of a court reporter.

Plea options. He identified guilty and not guilty. When asked about a third option, he said "I don't know. Is there another one?" I described no contest and a plea bargain; he said "Right, OK," but could not paraphrase either back to me when asked five minutes later.

INTERMEDIATE MEMORY NOTE

Mr. Martensen asked me twice during the interview "what was your name again?" and once "what are we doing here?" The second instance occurred approximately 35 minutes into the session. After a short break he re-engaged without apparent frustration.

Next session scheduled for April 4, 2026.

Jordan Whitfield, Psy.D., ABPP
`;
const INTERVIEW_TWO = `${SYNTHETIC_BANNER}

COMPETENCY INTERVIEW NOTES, SESSION 2
Examinee: Elijah D. Martensen
Date: April 4, 2026
Location: Arapahoe County Detention Facility
Duration: 75 minutes
Examiner: Jordan Whitfield, Psy.D., ABPP

FOLLOWUP MENTAL STATUS

Mr. Martensen appeared less fatigued than at session 1. He initiated conversation by correctly identifying me and stating the purpose of the meeting. Correctional staff reported he had been sleeping better in the last week after a minor housing change.

FACTUAL UNDERSTANDING RE-ASSESSMENT

Charges and procedure. Mr. Martensen could again name his charge and correctly paraphrase what it meant. He correctly named both prior plea options and, after prompting, recalled no contest and plea bargain. He could describe in his own words the difference between a plea and a trial.

Roles. Reliable across both sessions for judge, prosecutor, defense attorney, jury. Court reporter still unclear; he stated "someone who writes stuff down."

RATIONAL UNDERSTANDING

I asked Mr. Martensen what he thought his attorney would advise him to do, and why. He said "Fuentes told me the DA might offer a plea to a lesser charge because they know I have brain stuff. He says I should think about it before trial because trials are hard and juries don't like violent stuff." This response reflects an appropriate understanding of the attorney's role and a rational consideration of trial strategy.

CAPACITY TO CONSULT WITH COUNSEL

Mr. Martensen reported meeting with Mr. Fuentes twice in the week before this interview. He could recall the substance of both meetings (the topics, the recommendation, the next steps) with reasonable accuracy. He indicated he trusted his attorney and found him "patient about going slow for me."

When I asked him how he would want to handle questions from a prosecutor on the stand, he replied "I'd probably say I don't remember, because I really don't. I wouldn't make stuff up." This reflects an appropriate understanding of the obligation to answer honestly and an acknowledgment of his own memory limitations.

SUMMARY

Across two sessions Mr. Martensen has demonstrated factual understanding of the charges, roles, and procedural options. He is capable of providing meaningful direction to counsel, provided accommodations for his pace and memory are maintained. His cognitive impairment is real and has functional consequences, but it does not prevent competent participation.

Jordan Whitfield, Psy.D., ABPP
`;
const FORMULATION$1 = `${SYNTHETIC_BANNER}

PIKE FORENSICS
Diagnostic Formulation

Case: ${EXAMINEE$9}
Case Number: ${CASE_NUMBER$9}
Prepared by: Jordan Whitfield, Psy.D., ABPP
Date: April 8, 2026

DIAGNOSTIC IMPRESSION

1. Major Neurocognitive Disorder Due to Traumatic Brain Injury, mild severity (F02.80)
2. Adjustment Disorder with Depressed Mood (F43.21), contextual

Mr. Martensen's diagnostic picture is anchored in a well-documented moderate TBI sustained in 2017 with residual deficits in short-term memory, processing speed, and mild executive dysfunction. The MoCA total of 22 is consistent with this history. His adjustment features are secondary to his current legal situation and the loss of stable housing that preceded the arrest.

CRITERION ANALYSIS (F02.80)

Evidence of significant cognitive decline from a previous level of performance in one or more cognitive domains (memory and complex attention) based on concern of the individual, a knowledgeable informant, or the clinician (Mr. Martensen and his mother have both reported functional decline since 2017), and a substantial impairment documented by standardized neurocognitive assessment (MoCA 22 in the mild cognitive impairment range) or another quantified clinical assessment.

The cognitive deficits interfere with independence in everyday activities (Mr. Martensen has been unable to return to his former work as a journeyman electrician and lives with his mother). The deficits do not occur exclusively in the context of delirium. The deficits are not better explained by another mental disorder. Etiology is a documented TBI with abnormal neuroimaging.

Severity is mild: the examinee is capable of self-care, conversation, and structured tasks but requires support for complex planning and novel problem solving.

COMPETENCY OPINION

See the attached draft report for the formal opinion. In brief, Mr. Martensen's cognitive limitations are real and required accommodation during the evaluation, but across two sessions he demonstrated factual understanding of the charges and proceedings, rational understanding of the attorney-client relationship, and the capacity to consult with counsel within his pace.

Jordan Whitfield, Psy.D., ABPP
`;
const DRAFT_REPORT = `${reportHeader(
  CASE_NUMBER$9,
  EXAMINEE$9,
  DOB$9,
  "Forensic Psychological Evaluation: Competency to Stand Trial",
  COURT$3
)}REFERRAL QUESTION

The Court requested an evaluation addressing whether Mr. Elijah D. Martensen has a rational and factual understanding of the proceedings against him and sufficient present ability to consult with counsel, consistent with Dusky v. United States, 362 U.S. 402 (1960). Mr. Martensen is charged with one count of Second Degree Assault (C.R.S. 18-3-203).

PROCEDURES

I reviewed the arrest report dated February 11, 2026, the 2017 discharge summary from Craig Hospital, the jail medical screening notes from February 12 through March 23, 2026, and correspondence with defense counsel Hector Fuentes. I conducted two clinical interviews totaling approximately 165 minutes on March 24 and April 4, 2026. I administered the Montreal Cognitive Assessment (MoCA) Version 8.2 and a structured competency-focused interview. Collateral contact with Mr. Martensen's mother, Marlena Martensen, was completed by telephone on April 1, 2026.

NOTIFICATION OF NON-CONFIDENTIALITY

At each interview Mr. Martensen was informed of the purpose of the evaluation, the limits of confidentiality, and the intended recipients of the report. He acknowledged understanding in his own words and agreed to proceed.

RELEVANT BACKGROUND

Mr. Martensen is a 34-year-old man raised in Parker, Colorado by his mother Marlena Martensen. He completed high school and a two-year apprenticeship in electrical work. He worked as a journeyman electrician for approximately six years before a motorcycle collision in August 2017 resulted in a moderate traumatic brain injury documented at Craig Hospital. Imaging at that time revealed bilateral contusions and a right temporal skull fracture. He completed an inpatient rehabilitation stay of approximately three weeks.

Since 2017 Mr. Martensen has lived intermittently with his mother. He has attempted to return to electrical work on three occasions and has been unable to sustain employment beyond four months due to cognitive demands of the job and difficulty tracking schedules. He receives Social Security Disability Insurance based on the TBI. He has no prior criminal history.

Mr. Martensen acknowledges social drinking but denies a history of substance use disorder. He has not been psychiatrically hospitalized. A prior course of cognitive rehabilitation ended in 2019.

MENTAL STATUS ACROSS TWO SESSIONS

At the first session Mr. Martensen was appropriately groomed, cooperative, and oriented to person and place with uncertainty about the date. His speech was fluent with mild word-finding pauses. His mood was neutral; his affect was restricted. He denied hallucinations and paranoid ideation. Intermediate memory for the interview itself was impaired: he asked twice to be reminded of my name and once the purpose of the meeting.

At the second session, two weeks later, Mr. Martensen was notably clearer. He initiated the conversation by correctly identifying me, stating the purpose of the meeting, and asking an appropriate procedural question about the next step. Correctional staff reported improved sleep over the prior week.

FUNCTIONAL ABILITIES

Factual understanding of the proceedings. At the second session Mr. Martensen correctly identified his charge, the roles of courtroom personnel, and the major plea options (guilty, not guilty, no contest, plea bargain). He could explain in his own words the difference between a trial and a plea.

Rational understanding. Mr. Martensen articulated an appropriate understanding of his attorney's recommendation regarding a plea offer and a rational consideration of the trial risks (jury perception, evidentiary issues). He does not hold delusional or distorted beliefs about the proceedings.

Capacity to consult with counsel. Mr. Martensen reported two recent meetings with Mr. Fuentes and could paraphrase both meetings' substance. He indicated trust in his attorney and identified specific accommodations (slower pace, written summaries) that helped him engage effectively. In the interview he was capable of sustained, meaningful exchange with these accommodations.

CLINICAL FORMULATION

Mr. Martensen meets criteria for Major Neurocognitive Disorder Due to Traumatic Brain Injury, mild severity (F02.80). His presentation is consistent with the documented 2017 injury. He also shows contextual adjustment features related to the current legal situation and loss of stable housing in the months preceding the arrest. He does not meet criteria for a psychotic disorder or a primary mood disorder.

The cognitive impairment is real, functionally relevant, and measurable. It does not rise to a level that prevents competent participation in the proceedings, provided his pace and memory limitations are accommodated by counsel and the Court.

OPINION

To a reasonable degree of psychological certainty, it is my opinion that Mr. Martensen presently has a rational and factual understanding of the proceedings against him and has sufficient present ability to consult with counsel with a reasonable degree of rational understanding. He is competent to stand trial under Dusky v. United States and C.R.S. 16-8.5.

RECOMMENDATIONS

1. Counsel should use shorter meetings (30 to 45 minutes) rather than a single long meeting, and should provide written summaries of decisions made and next steps.
2. The Court should allow the defendant occasional short breaks during extended proceedings.
3. Continued cognitive rehabilitation and case management support are warranted and should be coordinated by jail mental health while Mr. Martensen is in custody.
4. If the case proceeds to trial, counsel should consider whether expert testimony regarding the defendant's cognitive limitations would be relevant to jury understanding of his memory gaps.
${clinicianSignature()}`;
const CASE_01_MARTENSEN = {
  caseNumber: CASE_NUMBER$9,
  createdAt: "2026-03-03",
  lastModified: "2026-04-08",
  firstName: "Elijah",
  lastName: "Martensen",
  dob: DOB$9,
  gender: "M",
  evaluationType: "CST",
  referralSource: "Arapahoe County Public Defender",
  evaluationQuestions: "Factual and rational understanding of proceedings; capacity to consult with counsel given documented TBI history.",
  stage: "review",
  caseStatus: "in_progress",
  notes: "Draft report completed; attestation pending. Two-session evaluation showed competence with accommodations.",
  complexity: "moderate",
  summary: "34yo man, moderate TBI (2017), charged with second degree assault. Two sessions show competent with memory accommodations.",
  diagnoses: [
    "F02.80 Major Neurocognitive Disorder Due to TBI, mild",
    "F43.21 Adjustment Disorder with Depressed Mood"
  ],
  intake: {
    referral_type: "attorney",
    referral_source: "Hector Fuentes, Arapahoe County PD",
    eval_type: "CST",
    presenting_complaint: "Competency concerns secondary to documented TBI; counsel reports loss of conversational thread.",
    jurisdiction: "18th Judicial District, Arapahoe County",
    charges: "Second Degree Assault (C.R.S. 18-3-203)",
    attorney_name: "Hector Fuentes (Reg. 38221)",
    report_deadline: "2026-04-15",
    status: "complete"
  },
  onboarding: [
    {
      section: "contact",
      content: "Held at Arapahoe County Detention Facility since February 11, 2026. Contact via defense counsel Hector Fuentes at (303) 555-0184. Mother Marlena Martensen is primary collateral.",
      status: "complete"
    },
    {
      section: "complaints",
      content: "Memory lapses, word-finding difficulty, loss of conversational thread after several minutes, increasing disorganization in months preceding arrest.",
      status: "complete"
    },
    {
      section: "health",
      content: "Moderate TBI from 2017 motorcycle collision (GCS 7 at scene, bilateral contusions, right temporal fracture). Three-week Craig Hospital stay. Post-concussive syndrome documented. No current medications; prior brief course of cognitive rehabilitation.",
      clinician_notes: "Craig Hospital discharge summary obtained via release. Imaging confirms bilateral contusions.",
      status: "complete"
    },
    {
      section: "mental",
      content: "No psychiatric hospitalizations. No prior psychotic symptoms. No current suicidal or homicidal ideation. Mild depressive features tied to current legal situation and housing instability.",
      status: "complete"
    },
    {
      section: "substance",
      content: "Social alcohol use, no current substance use disorder per self report and jail medical screen.",
      status: "complete"
    },
    {
      section: "legal",
      content: "No prior criminal history. First-time felony charge.",
      status: "complete"
    },
    {
      section: "family",
      content: "Lives intermittently with mother Marlena Martensen in Parker, Colorado. Father deceased 2012. No siblings. Never married, no children.",
      status: "complete"
    },
    {
      section: "education",
      content: "High school diploma, two-year electrical apprenticeship. Worked as journeyman electrician 2011 to 2017. Unable to sustain employment beyond four months since TBI.",
      status: "complete"
    }
  ],
  documents: [
    {
      subfolder: "_Inbox",
      filename: "Referral_Letter_Fuentes.txt",
      documentType: "other",
      content: REFERRAL$5,
      description: "Referral letter from defense counsel"
    },
    {
      subfolder: "Collateral",
      filename: "Court_Order_Competency_Eval.txt",
      documentType: "other",
      content: COURT_ORDER$3,
      description: "Court order appointing examiner under C.R.S. 16-8.5"
    },
    {
      subfolder: "Collateral",
      filename: "Arrest_Report_Centennial_PD.txt",
      documentType: "other",
      content: ARREST_REPORT,
      description: "Centennial PD arrest report"
    },
    {
      subfolder: "Collateral",
      filename: "Craig_Hospital_Discharge_2017.txt",
      documentType: "other",
      content: MEDICAL_RECORDS,
      description: "2017 TBI discharge summary from Craig Hospital"
    },
    {
      subfolder: "Testing",
      filename: "MoCA_Screening_Summary.txt",
      documentType: "other",
      content: MOCA_SCREEN,
      description: "MoCA cognitive screening, score 22/30"
    },
    {
      subfolder: "Interviews",
      filename: "Interview_Session_1.txt",
      documentType: "other",
      content: INTERVIEW_ONE,
      description: "First competency interview, March 24"
    },
    {
      subfolder: "Interviews",
      filename: "Interview_Session_2.txt",
      documentType: "other",
      content: INTERVIEW_TWO,
      description: "Second competency interview, April 4"
    },
    {
      subfolder: "Diagnostics",
      filename: "Diagnostic_Formulation.txt",
      documentType: "other",
      content: FORMULATION$1,
      description: "Diagnostic formulation and criterion analysis"
    },
    {
      subfolder: "Reports",
      filename: "DRAFT_CST_Evaluation_Report.txt",
      documentType: "other",
      content: DRAFT_REPORT,
      description: "Draft competency evaluation report, pending attestation"
    }
  ]
};
const CASE_NUMBER$8 = "2026-0347";
const EXAMINEE$8 = "Pizarro Echeverría, Raúl A.";
const DOB$8 = "1997-11-08";
const COURT_ORDER$2 = `${SYNTHETIC_BANNER}

DENVER DISTRICT COURT
Court Address: 1437 Bannock Street, Denver, CO 80202

Case Number: ${CASE_NUMBER$8}-CR
Division: Criminal
Judge: Hon. Isadora Qurban

THE PEOPLE OF THE STATE OF COLORADO v. RAÚL A. PIZARRO ECHEVERRÍA

ORDER FOR COMPETENCY EVALUATION

Defendant is charged with Second Degree Burglary (C.R.S. 18-4-203) and Criminal Mischief (C.R.S. 18-4-501). Defense counsel has raised good faith doubt as to the defendant's competence pursuant to C.R.S. 16-8.5-102.

IT IS HEREBY ORDERED that Jordan Whitfield, Psy.D., ABPP of Pike Forensics is appointed to conduct a competency evaluation and file a written report no later than April 28, 2026. All proceedings are stayed pending the report.

BY THE COURT:

Isadora Qurban
District Court Judge
Dated: March 12, 2026
`;
const JAIL_RECORDS = `${SYNTHETIC_BANNER}

DENVER COUNTY JAIL
Mental Health Progress Notes (Excerpt)

Inmate: Pizarro Echeverría, Raúl (DOB 11/08/1997)
Book-in: March 5, 2026

3/5/2026 (intake RN): Inmate disheveled, agitated, speaking rapidly in a mixture of English and Spanish. Reports "the network" is watching him through the ceiling vents. Refusing food. Medical alert: prior psychiatric history per family notification.

3/6/2026 (psychiatric NP Bhavna Roychoudhury, PMHNP): Chart reviewed. Prior records from Denver Health Psychiatric 2021 and 2023 confirm Schizophrenia diagnosis. Last documented antipsychotic was olanzapine 20 mg QHS; inmate reports he stopped taking it "several weeks" before arrest because "it was part of the experiment." Mental status: paranoid delusions with persecutory and referential features, auditory hallucinations (hears "the announcers"), disorganized speech. Initiated olanzapine 10 mg QHS, increase over 5 days if tolerated.

3/12/2026: Dose increased to 15 mg QHS. Inmate sleeping better. Still paranoid but less agitated. Continues to decline food from staff ("they put it in the food"); will accept sealed commissary items.

3/20/2026: Dose increased to 20 mg QHS. Eating from staff trays approximately 50% of the time. Paranoid content reduced in intensity but not resolved. Able to track conversation for 5 to 10 minutes before drifting.

3/27/2026: Compliant with medication. Attorney visit today reported as "better than last time." Still believes the original charge is "tied to the experiment" but can entertain alternative explanations when prompted.
`;
const PRIOR_EVAL = `${SYNTHETIC_BANNER}

DENVER HEALTH PSYCHIATRIC EMERGENCY SERVICES
Discharge Summary (Excerpt for Forensic Review)

Patient: Pizarro Echeverría, Raúl A.
Admission: February 14, 2023
Discharge: February 28, 2023
Attending: Reginald Oyeyemi, MD

HISTORY

Mr. Pizarro Echeverría presented to DHPES via police transport following a welfare check at his employer's request. Coworkers reported he had stopped coming to work three weeks prior and had been calling the office stating that "the shift manager was poisoning the water cooler." On arrival he was paranoid, disorganized, and unable to provide a coherent history.

This was his third psychiatric hospitalization. Prior admissions were in 2020 (first psychotic break, age 22) and 2021 (relapse after medication non-adherence). Diagnosis of Schizophrenia was established in 2021 after a three-month prospective course.

HOSPITAL COURSE

Olanzapine titrated to 20 mg QHS with gradual improvement in positive symptoms. By hospital day 10 the patient was able to engage in group and individual therapy and acknowledged that his persecutory beliefs had been symptoms of his illness returning. Discharged to outpatient care at Colorado Coalition for the Homeless Behavioral Health with housing referral.

DISCHARGE DIAGNOSES

1. Schizophrenia, continuous course (F20.9)
2. Cannabis Use Disorder, in sustained remission (F12.21)

DISCHARGE MEDICATIONS

Olanzapine 20 mg PO QHS
`;
const MMPI_NOTE = `${SYNTHETIC_BANNER}

PIKE FORENSICS
Testing Note, MMPI-3 Administration (INVALID)

Examinee: ${EXAMINEE$8}
Date of Administration: March 31, 2026
Examiner: Jordan Whitfield, Psy.D., ABPP

NOTES

Administration was attempted at Denver County Jail. Mr. Pizarro Echeverría was offered the Spanish-language MMPI-3 after determining his preferred language with him. He completed approximately 180 of 335 items before asking to stop, stating "these questions are the experiment, you're recording my answers into the network."

VALIDITY

With only 180 items completed, the standard scoring rules cannot produce interpretable substantive scores. The CNS (Cannot Say) count would be over 15, and the VRIN-r and TRIN-r patterns on the items completed suggest inconsistent responding driven by the examinee's paranoid state rather than by random answering.

CLINICAL INTERPRETATION

The MMPI-3 cannot be scored or interpreted in this administration. The reason is directly observable: active positive symptoms of psychosis interfered with the examinee's ability to engage with the test instructions. This finding is itself informative for the competency question.

A repeat administration should be attempted only if symptoms substantially remit.

Jordan Whitfield, Psy.D., ABPP
`;
const INTERVIEW$1 = `${SYNTHETIC_BANNER}

COMPETENCY INTERVIEW NOTES
Examinee: ${EXAMINEE$8}
Date: March 31, 2026 (session 1) and April 14, 2026 (session 2)
Location: Denver County Jail
Examiner: Jordan Whitfield, Psy.D., ABPP

SESSION 1 (March 31)

Notification of non-confidentiality was provided in English and Spanish. Mr. Pizarro Echeverría acknowledged understanding with a simple nod and the phrase "OK, for the judge."

Mental status: disheveled in jail attire; restless; speech mildly pressured with loose associations. Oriented to person, uncertain of date. Endorsed auditory hallucinations ("announcers who say what I'm doing") and a persecutory delusional system involving "the network" that he believes includes jail staff, "maybe" his attorney, and the District Attorney's office. Affect suspicious with moments of appropriate humor.

Factual understanding: named the charge as "something about burglary." Could not explain what a plea bargain was, asked "what's a bargain?" Identified his attorney as "the lawyer they sent," the judge as "a judge," and stated a jury is "I don't know."

Rational understanding: believes his charge is "a cover story" for the surveillance operation. When asked whether his attorney might be working with the prosecution, replied "maybe, I can't tell yet."

Capacity to consult with counsel: refused to discuss the charge substantively. Said "I don't know what I can say here because of the microphones."

SESSION 2 (April 14)

Mr. Pizarro Echeverría had been on olanzapine 20 mg QHS for approximately six weeks. He recognized me, stated the purpose of the meeting, and apologized for the first session ("I wasn't myself").

Mental status: better groomed. Speech organized. Still mildly paranoid regarding "the network" but could entertain that these thoughts may be part of his illness. Affect less guarded.

Factual understanding improved: named both charges correctly, described trial and plea as two distinct paths, identified roles of judge, prosecution, defense, and jury. Able to explain plea bargain in his own words.

Rational understanding: still holds some persecutory content about "the DA" but acknowledges "my doctor said these thoughts come back when I stop my meds." Able to consider alternative explanations for his current situation without abandoning them entirely.

Capacity to consult with counsel: reports meeting with his attorney Federico Lopresti twice in the prior week. Can paraphrase those meetings. Acknowledges he has had trouble trusting Mr. Lopresti but is "trying."

The improvement between sessions is clinically meaningful but incomplete. The examinee remains symptomatic. Whether the remaining symptoms prevent rational engagement is the central question for the formulation.

Jordan Whitfield, Psy.D., ABPP
`;
const FORMULATION = `${SYNTHETIC_BANNER}

PIKE FORENSICS
Preliminary Diagnostic Formulation (DRAFT)

Case: ${EXAMINEE$8}
Case Number: ${CASE_NUMBER$8}

DIAGNOSIS

Schizophrenia, continuous course (F20.9)

The diagnosis is supported by documentation of three prior psychotic episodes (2020, 2021, 2023), sustained positive symptoms across episodes (paranoid delusions, auditory hallucinations, disorganized speech), duration greater than six months, and functional decline. Each episode has been temporally associated with antipsychotic medication non-adherence and each has responded to reintroduced olanzapine. The current episode follows the same pattern.

COMPETENCY CONSIDERATIONS (PRELIMINARY, PENDING FINAL SESSION)

Session 1 findings clearly supported incompetence: the examinee held fixed persecutory beliefs about his attorney and the DA's office, could not name or explain his charges, and refused to discuss his case on the basis of delusional content.

Session 2 findings show clinically meaningful improvement with 6 weeks of adherent antipsychotic treatment, but the picture is not yet clear. The examinee has acquired factual understanding he previously lacked. He is capable of limited, tentative engagement with his attorney. Persecutory content about the DA persists in a softer form.

The key question is whether the examinee's rational understanding is currently sufficient. The answer depends on whether his residual symptoms meaningfully prevent him from collaborating on strategy and testimony. A third session is indicated before finalizing the opinion.

NEXT STEPS

1. Schedule third interview for approximately April 28, consistent with the reporting deadline.
2. Collateral contact with Federico Lopresti (defense counsel) to assess quality of attorney-client consultation from the attorney's perspective.
3. Review Denver County Jail mental health progress notes through the date of the third interview.
4. Consider whether an opinion of "currently incompetent but likely restorable" is the most accurate and useful framing for this case.
${clinicianSignature()}`;
const CASE_02_PIZARRO = {
  caseNumber: CASE_NUMBER$8,
  createdAt: "2026-03-12",
  lastModified: "2026-04-07",
  firstName: "Raúl",
  lastName: "Pizarro Echeverría",
  dob: DOB$8,
  gender: "M",
  evaluationType: "CST",
  referralSource: "Denver District Court, Division Criminal",
  evaluationQuestions: "Competency in context of active psychotic symptoms and ongoing medication response.",
  stage: "diagnostics",
  caseStatus: "in_progress",
  notes: "Two sessions complete, clinically meaningful improvement on olanzapine. Third session and collateral pending.",
  complexity: "complex",
  summary: "28yo man, chronic schizophrenia with documented med non-adherence, charged with burglary. Partial improvement over two sessions.",
  diagnoses: ["F20.9 Schizophrenia, continuous"],
  intake: {
    referral_type: "court",
    referral_source: "Hon. Isadora Qurban, Denver District Court",
    eval_type: "CST",
    presenting_complaint: "Active psychosis, paranoid delusions involving the proceedings, medication non-adherence prior to arrest.",
    jurisdiction: "Denver County",
    charges: "Second Degree Burglary (C.R.S. 18-4-203), Criminal Mischief (C.R.S. 18-4-501)",
    attorney_name: "Federico Lopresti, Denver Public Defender",
    report_deadline: "2026-04-28",
    status: "complete"
  },
  onboarding: [
    {
      section: "contact",
      content: "Custody at Denver County Jail since March 5, 2026. Family contact through sister Ximena Pizarro at (303) 555-0199 with signed release.",
      status: "complete"
    },
    {
      section: "mental",
      content: "Schizophrenia, continuous course. Prior hospitalizations in 2020, 2021, 2023, each following medication non-adherence. Current episode began approximately 6 weeks before arrest after stopping olanzapine. Jail psychiatry restarted olanzapine March 6, titrated to 20 mg QHS by March 20.",
      clinician_notes: "Dose response trajectory is typical for this examinee per prior records.",
      status: "complete"
    },
    {
      section: "substance",
      content: "Cannabis Use Disorder in sustained remission since 2023 per DHPES records. Denies current use.",
      status: "complete"
    },
    {
      section: "legal",
      content: "First felony charge. No prior criminal history.",
      status: "complete"
    },
    {
      section: "family",
      content: "Oldest of three. Parents in Mexico City. Lived with sister Ximena in Denver since 2019. Sister is primary support and medication monitor when stable.",
      status: "complete"
    },
    {
      section: "education",
      content: "Completed high school in Mexico City. Attended two semesters of community college in Denver. Employed intermittently as prep cook.",
      status: "complete"
    }
  ],
  documents: [
    {
      subfolder: "Collateral",
      filename: "Court_Order_Competency_Eval.txt",
      documentType: "other",
      content: COURT_ORDER$2,
      description: "Denver District Court CST order"
    },
    {
      subfolder: "Collateral",
      filename: "Jail_Mental_Health_Progress_Notes.txt",
      documentType: "other",
      content: JAIL_RECORDS,
      description: "Denver County Jail psychiatric progress notes"
    },
    {
      subfolder: "Collateral",
      filename: "DHPES_2023_Discharge_Summary.txt",
      documentType: "other",
      content: PRIOR_EVAL,
      description: "2023 Denver Health Psychiatric discharge"
    },
    {
      subfolder: "Testing",
      filename: "MMPI-3_Invalid_Administration.txt",
      documentType: "other",
      content: MMPI_NOTE,
      description: "MMPI-3 invalid administration note"
    },
    {
      subfolder: "Interviews",
      filename: "Two_Session_Interview_Notes.txt",
      documentType: "other",
      content: INTERVIEW$1,
      description: "Two session CST interview notes, March 31 and April 14"
    },
    {
      subfolder: "Diagnostics",
      filename: "Preliminary_Formulation.txt",
      documentType: "other",
      content: FORMULATION,
      description: "Preliminary formulation pending third session"
    }
  ]
};
const CASE_NUMBER$7 = "2026-0362";
const EXAMINEE$7 = "Willoughby, Dante M.";
const DOB$7 = "1983-04-19";
const COURT$2 = "Jefferson County Parole Board";
const REFERRAL$4 = `${SYNTHETIC_BANNER}

JEFFERSON COUNTY PAROLE BOARD
Office of Community Supervision
1000 10th Street, Golden, CO 80401

February 1, 2026

Jordan Whitfield, Psy.D., ABPP
Pike Forensics

Re: Willoughby, Dante M. (DOC #A-2027156)
Parole Eligibility Hearing Date: March 15, 2026

Dr. Whitfield,

The Jefferson County Parole Board requests a structured violence risk assessment for Mr. Dante M. Willoughby in advance of his March 15 eligibility hearing. Mr. Willoughby is serving a sentence for First Degree Assault (C.R.S. 18-3-202) with a prior conviction for Domestic Violence Assault from 2014. He has completed the Responsible Thinking program and has been infraction-free for 18 months.

The Board seeks an opinion on Mr. Willoughby's risk of future violence if granted parole, the factors that most contribute to that risk, and specific release conditions that would mitigate identified risks.

Please use the HCR-20v3 as the primary structured instrument. Additional measures at your discretion.

Maricela Hoeflich, LCSW
Senior Parole Hearing Officer
`;
const HCR20_SUMMARY = `${SYNTHETIC_BANNER}

PIKE FORENSICS
HCR-20v3 Worksheet Summary

Examinee: ${EXAMINEE$7}
Interview dates: February 18 and March 2, 2026
Examiner: Jordan Whitfield, Psy.D., ABPP

HISTORICAL ITEMS (H1 to H10)

H1 Violence                  Present   High relevance
  Two adult convictions (2014 DV, 2019 First Degree Assault). Documented childhood fights and a juvenile adjudication for assault at age 15.

H2 Other antisocial behavior  Present   Moderate relevance
  Prior arrests for drug offenses and shoplifting. No felony non-violent offenses.

H3 Relationships              Present   High relevance
  Pattern of short, conflict-laden romantic relationships, two of which involved intimate partner violence.

H4 Employment                 Present   Moderate relevance
  Longest job held: 11 months. Poor response to supervisors historically.

H5 Substance use              Present   High relevance
  Alcohol Use Disorder prior to incarceration; both prior violent incidents involved alcohol intoxication.

H6 Major mental disorder      Possibly  Moderate relevance
  No psychotic disorder. Some depressive features during incarceration, consistent with Adjustment Disorder.

H7 Personality disorder       Present   High relevance
  Meets criteria for Antisocial Personality Disorder (F60.2).

H8 Traumatic experiences      Present   Moderate relevance
  Witnessed domestic violence in childhood. Father incarcerated. Self-reports no formal trauma treatment.

H9 Violent attitudes          Possibly  Moderate relevance
  At intake, scored 18 on CTS-R for Violence Normativity. Scores have declined over course of programming.

H10 Treatment response        Present   High relevance
  Prior outpatient court-mandated treatment in 2014 was minimally engaged. Current in-custody programming shows substantial improvement.

CLINICAL ITEMS (C1 to C5)

C1 Insight                    Possibly  High relevance
  Can describe how alcohol contributed to both prior incidents. Reluctant to fully own the 2019 offense; uses language like "the fight got out of hand."

C2 Violent ideation or intent No        Not relevant
  Denies current violent thoughts or plans. No recent infractions.

C3 Active symptoms            No        Not relevant

C4 Instability                Possibly  Moderate relevance
  Mild emotional dysregulation under stressors; improved with current CBT group.

C5 Treatment response         Present   High relevance
  Completed Responsible Thinking (18 months), CBT for Substance Use (12 months), active in Alcoholics Anonymous.

RISK MANAGEMENT ITEMS (R1 to R5)

R1 Professional services     Possibly  High relevance
  Release plan includes ongoing DUI monitoring and substance use counseling. Parole officer assignment confirmed.

R2 Living situation          Possibly  High relevance
  Will reside with adult sister Leandra Willoughby in Golden. Stable housing. No cohabitating partner.

R3 Personal support          Present   Moderate relevance
  Sister and AA sponsor are primary supports.

R4 Treatment response        Present   High relevance
  Projected engagement is favorable based on current trajectory.

R5 Stress or coping          Possibly  High relevance
  Anticipated stressors: reintegration, job search, possible contact with past social network.

CASE FORMULATION

Mr. Willoughby's historical risk profile is moderate to high, driven by two prior violent incidents, antisocial personality features, alcohol use disorder, and poor prior treatment engagement. His clinical profile shows meaningful improvement: insight has grown, positive symptoms are absent, and his current treatment response is strong. Risk management factors are favorable (stable housing, family support, structured release plan).

The highest-risk scenario is a return to alcohol use combined with an intimate partner conflict. Protective factors against this scenario are the absence of a current partner, the absence of cohabiting relationships in the release plan, AA involvement, and active CBT for substance use. No firearms history.

SUMMARY RISK JUDGMENT

For the 24 months following release to parole, MODERATE risk for violence, with risk concentrated in specific high-risk scenarios (alcohol relapse, intimate partner reintroduction). Risk is LOW for stranger violence.

Jordan Whitfield, Psy.D., ABPP
`;
const FINAL_REPORT$1 = `${reportHeader(
  CASE_NUMBER$7,
  EXAMINEE$7,
  DOB$7,
  "Violence Risk Assessment (HCR-20v3)",
  COURT$2
)}REFERRAL QUESTION

The Jefferson County Parole Board requested a structured violence risk assessment to inform Mr. Willoughby's March 15, 2026 parole eligibility hearing. Specific questions: (1) likelihood of future violence if released on parole, (2) factors most contributing to that risk, and (3) release conditions that would mitigate identified risks.

PROCEDURES

I reviewed Mr. Willoughby's DOC file including all prior convictions, disciplinary history, program completions, and mental health records. I conducted two clinical interviews on February 18 and March 2, 2026. I administered the HCR-20v3 through interview, record review, and collateral input from his corrections case manager Oleta Vandermark. Collateral telephone contact was made with his sister Leandra Willoughby.

RELEVANT BACKGROUND

Mr. Willoughby is a 42-year-old African American man raised in Pueblo by his mother and maternal grandmother. His father was incarcerated during most of his childhood. He witnessed intimate partner violence between his mother and a stepfather between ages 7 and 12. He completed 10th grade and later earned a GED in DOC custody.

He has two prior convictions for violence. The 2014 conviction was a DV misdemeanor plea from an original felony assault charge involving a live-in girlfriend. He completed court-mandated DV treatment with minimal engagement. The 2019 First Degree Assault conviction involved a bar fight in which Mr. Willoughby struck a stranger with a bar stool during an alcohol-related altercation; the victim suffered a fractured skull and recovered with surgical intervention. Mr. Willoughby received an 8-year sentence and has served 6 years.

His in-custody record shows no infractions in the last 18 months. He completed the Responsible Thinking program, CBT for Substance Use, and anger management. He attends AA weekly. He is employed in the prison kitchen at the highest available trust level.

DIAGNOSTIC IMPRESSION

Antisocial Personality Disorder (F60.2)
Alcohol Use Disorder, in sustained remission in a controlled environment (F10.21)

STRUCTURED RISK ASSESSMENT

Using the HCR-20v3 framework, Mr. Willoughby presents with a moderate to high historical profile, an improved clinical profile, and a favorable risk management profile. Historical risk is anchored by two violent convictions (both alcohol-involved), antisocial personality features, a history of intimate partner violence, and childhood exposure to violence. Dynamic clinical factors have improved substantially: he has developed insight into the role of alcohol in his violence, he is asymptomatic, and his treatment engagement is strong. Release plan factors are favorable: stable housing with a non-romantic relative, identified outpatient services, and a parole officer assignment.

SUMMARY RISK JUDGMENT

For the 24 months following release to parole, Mr. Willoughby's risk of future violence is MODERATE. Risk is not distributed randomly: it is concentrated in two specific scenarios. The first is a return to alcohol use, particularly in a social drinking context. The second is the reintroduction of a romantic partner under conditions of financial or emotional stress, given his documented pattern of intimate partner conflict. Outside these scenarios his risk for violence is low. His risk for stranger violence in the absence of alcohol is low.

RECOMMENDATIONS

If the Board grants parole, the following conditions would meaningfully mitigate the identified risks:

1. Continuous alcohol monitoring for at least 12 months. Ethyl glucuronide testing is more sensitive than traditional breathalyzer testing and is recommended.
2. Continuing outpatient CBT for Substance Use with a therapist experienced in relapse prevention.
3. Continuing AA participation with sponsor verification.
4. A 12-month restriction on cohabitating romantic relationships, with verification at parole meetings.
5. Immediate return to supervision if any alcohol-positive screen occurs, rather than awaiting a violation hearing.
6. A structured return-to-work plan developed with his parole officer within 30 days of release.

If the Board denies parole, clinical factors support a recommendation that Mr. Willoughby continue his current programming and be reconsidered at his next eligibility hearing.
${clinicianSignature()}`;
const CASE_03_WILLOUGHBY = {
  caseNumber: CASE_NUMBER$7,
  createdAt: "2026-02-01",
  lastModified: "2026-03-10",
  firstName: "Dante",
  lastName: "Willoughby",
  dob: DOB$7,
  gender: "M",
  evaluationType: "Risk Assessment",
  referralSource: "Jefferson County Parole Board",
  evaluationQuestions: "Future violence risk, contributing factors, and mitigating release conditions using HCR-20v3.",
  stage: "complete",
  caseStatus: "completed",
  notes: "Completed, signed, and delivered. Moderate risk, scenario-specific.",
  complexity: "moderate",
  summary: "42yo man, 2 prior violent convictions, 6 years served, 18 months infraction-free, HCR-20v3 moderate risk.",
  diagnoses: [
    "F60.2 Antisocial Personality Disorder",
    "F10.21 Alcohol Use Disorder, in sustained remission in a controlled environment"
  ],
  intake: {
    referral_type: "court",
    referral_source: "Maricela Hoeflich, Jefferson County Parole Board",
    eval_type: "Risk Assessment",
    presenting_complaint: "Parole eligibility hearing; prior violent convictions.",
    jurisdiction: "Jefferson County",
    charges: "Prior: First Degree Assault (C.R.S. 18-3-202)",
    attorney_name: null,
    report_deadline: "2026-03-10",
    status: "complete"
  },
  onboarding: [
    {
      section: "contact",
      content: "DOC facility Buena Vista. Case manager Oleta Vandermark. Sister Leandra Willoughby in Golden is release plan contact.",
      status: "complete"
    },
    {
      section: "legal",
      content: "2014 Domestic Violence misdemeanor (plea from original felony assault). 2019 First Degree Assault conviction, 8-year sentence, 6 served.",
      status: "complete"
    },
    {
      section: "substance",
      content: "Alcohol Use Disorder in sustained remission in controlled environment. Both prior violent incidents involved alcohol intoxication.",
      status: "complete"
    },
    {
      section: "mental",
      content: "No psychotic or mood disorder. Antisocial Personality Disorder features. Completed Responsible Thinking, CBT for Substance Use, anger management in custody.",
      status: "complete"
    }
  ],
  documents: [
    {
      subfolder: "_Inbox",
      filename: "Parole_Board_Referral.txt",
      documentType: "other",
      content: REFERRAL$4,
      description: "Parole Board referral letter"
    },
    {
      subfolder: "Testing",
      filename: "HCR-20v3_Worksheet_Summary.txt",
      documentType: "other",
      content: HCR20_SUMMARY,
      description: "HCR-20v3 structured professional judgment worksheet"
    },
    {
      subfolder: "Reports",
      filename: "FINAL_Risk_Assessment_Report.txt",
      documentType: "other",
      content: FINAL_REPORT$1,
      description: "Final signed risk assessment report"
    }
  ]
};
const CASE_NUMBER$6 = "2026-0398";
const EXAMINEE$6 = "Szczerba-Ngo, Amelia R.";
const DOB$6 = "2017-02-04";
const COURT_ORDER$1 = `${SYNTHETIC_BANNER}

DISTRICT COURT, DOUGLAS COUNTY, COLORADO
Case Number: ${CASE_NUMBER$6}-DR
Division: Family Court
Judge: Hon. Moira Delacroix

IN RE THE MARRIAGE OF:
Tomasz R. Szczerba, Petitioner
and
Mai T. Ngo, Respondent
Minor child: Amelia R. Szczerba-Ngo (DOB 02/04/2017)

STIPULATED ORDER FOR CHILD AND FAMILY INVESTIGATOR / PARENTING EVALUATION

The parties have stipulated to the appointment of a mental health professional to conduct a full parenting evaluation pursuant to C.R.S. 14-10-127. Jordan Whitfield, Psy.D., ABPP of Pike Forensics is appointed.

The evaluation shall address:
1. The best interests of the minor child in the context of the parties' proposed parenting plans
2. Each parent's capacity to meet Amelia's special needs as a child with Autism Spectrum Disorder (previously diagnosed at Children's Hospital Colorado, 2023)
3. The practicality and stability of each proposed parenting plan
4. Recommendations for parenting time, decision-making, and any needed therapeutic supports

Fees are to be split 50/50 between the parties with an initial retainer of $6,000 due upon acceptance. Written report to be filed no later than June 30, 2026.

BY THE COURT:
Moira Delacroix
District Court Judge
Dated: February 20, 2026
`;
const FATHER_INTERVIEW$1 = `${SYNTHETIC_BANNER}

PARENTING EVALUATION INTERVIEW NOTES
Parent interviewed: Tomasz R. Szczerba (father)
Date: March 10, 2026
Duration: 120 minutes
Location: Pike Forensics

Mr. Szczerba is a 41-year-old Polish-born man who immigrated to the United States in 2014 for graduate school. He works as a senior process engineer at a semiconductor firm in Colorado Springs. He speaks Polish and English fluently. The marriage lasted from 2015 to 2024; the parties separated in April 2024 and the divorce was final in December 2024. Amelia is the parties' only child.

Amelia's developmental history: Mr. Szczerba reports concerns began at age 2 when Amelia was not making eye contact during family meals. Both parents agreed to a developmental evaluation at Children's Hospital Colorado in 2023. Diagnoses confirmed included Autism Spectrum Disorder, Level 1 (requiring support). Amelia has received weekly speech and occupational therapy through her pediatrician's referral network since 2023 and has an IEP at Castle Rock Elementary.

Proposed parenting plan: Mr. Szczerba is seeking primary parenting time (Monday through Friday) with alternating weekends. He feels his work schedule (consistent, flexible, close to schools) and his relationship with Amelia's therapy providers support his role as primary.

Concerns about Ms. Ngo: Mr. Szczerba expresses concern that Ms. Ngo's work schedule as an ICU nurse involves rotating 12-hour shifts, which he believes is destabilizing for Amelia. He also states that Ms. Ngo does not consistently implement Amelia's sensory strategies (weighted blanket, quiet space in the evenings) and that Amelia has "meltdowns" returning from Ms. Ngo's home. He denies any concerns about Ms. Ngo's love for their daughter or her commitment.

Own acknowledged limitations: Mr. Szczerba acknowledges he can be "rigid" about routines and that he struggles to adapt when plans change. He says he is working on this in individual therapy.

Allegations or countervailing concerns: None that rise to the level of a safety concern. This is a high-conflict but not a domestic violence case.

Note: Mr. Szczerba was cooperative and articulate. He responded to all questions. He did not make disparaging comments about Ms. Ngo beyond the specific concerns noted above. He volunteered concerns about his own limitations without prompting.

Jordan Whitfield, Psy.D., ABPP
`;
const MOTHER_INTERVIEW$1 = `${SYNTHETIC_BANNER}

PARENTING EVALUATION INTERVIEW NOTES
Parent interviewed: Mai T. Ngo (mother)
Date: March 17, 2026
Duration: 120 minutes
Location: Pike Forensics

Ms. Ngo is a 38-year-old Vietnamese American woman born in San Jose. She moved to Colorado in 2012 after completing her BSN at UC Davis. She works as a pediatric ICU nurse at Children's Hospital Colorado. She is bilingual in Vietnamese and English. Her parents live in Louisville (Colorado) and are actively involved in Amelia's care.

Amelia's developmental history: Ms. Ngo's recollection tracks Mr. Szczerba's: early concerns at age 2, formal evaluation at Children's in 2023, ASD Level 1 diagnosis, ongoing OT and SLP. Ms. Ngo has attended every IEP meeting and maintains her own folder of Amelia's progress reports.

Proposed parenting plan: Ms. Ngo is proposing a 50/50 schedule with alternating weeks. She acknowledges her 12-hour shifts are a challenge and states she has arranged her schedule so that on her working days Amelia is with her maternal grandparents (who Amelia loves and who are a familiar presence).

Concerns about Mr. Szczerba: Ms. Ngo states that Mr. Szczerba's rigidity around routines sometimes means Amelia does not get the flexibility she needs for new experiences. She shared an example: Amelia was invited to a classmate's birthday party last fall and Mr. Szczerba did not take her because it "disrupted" the nap schedule. Ms. Ngo also feels Mr. Szczerba is controlling about Amelia's diet in ways that are not sensory-based.

Own acknowledged limitations: Ms. Ngo acknowledges her schedule is difficult and that she has sometimes arrived home exhausted and less patient than she wishes. She notes she has reduced her shifts to 30 hours per week since the separation.

Allegations: Ms. Ngo expressed concern that Mr. Szczerba's intense focus on routines could shade into "controlling" behavior but did not allege abuse or unsafe parenting.

Note: Ms. Ngo was cooperative, reflective, and appropriate. She acknowledged Mr. Szczerba's strengths as a father. She did not attempt to denigrate him.

Jordan Whitfield, Psy.D., ABPP
`;
const CHILD_OBSERVATION = `${SYNTHETIC_BANNER}

CHILD OBSERVATION SESSION NOTES
Child: Amelia R. Szczerba-Ngo (age 9)
Date: March 24, 2026
Location: Pike Forensics child-friendly room
Duration: 45 minutes
Observer: Jordan Whitfield, Psy.D., ABPP

Amelia was brought by both parents, who remained in the waiting room. She entered quietly, made brief eye contact, and sat at the provided art table.

Amelia selected the drawing materials and began drawing a structured scene: a house with two separate rooms labeled "Mama house" and "Daddy house" in careful print. She placed a stick figure labeled "me" in between the two rooms. Her drawing was age-appropriate in technique and showed planning.

I asked open questions about her school and interests. Amelia responded in full sentences with clear articulation. She prefers to talk about things she knows well (the school hamster named Bruno, the books in her classroom library). Social reciprocity was reduced; she did not ask me questions about myself.

Family questions were answered factually and briefly. "I like my mama's house because of grandma and grandpa." "I like my daddy's house because it's quiet." When I asked if there was anything about living at either house that was hard, she said "the drives," referring to the Monday and Friday exchanges.

Amelia showed typical sensory preferences for a child with ASD Level 1: she asked that the overhead light be dimmed before drawing, she requested the weighted blanket she had brought, and she asked to skip the planned board game, preferring to continue drawing.

When told the session was ending in 5 minutes, she used the visual timer I provided and transitioned without difficulty.

Jordan Whitfield, Psy.D., ABPP
`;
const SCHOOL_RECORDS = `${SYNTHETIC_BANNER}

CASTLE ROCK ELEMENTARY SCHOOL
Individualized Education Program (IEP) Progress Report Summary

Student: Amelia R. Szczerba-Ngo
Grade: 3
IEP Team Meeting Date: January 15, 2026
Case Manager: Brenna Tolliver, Special Education Teacher

ACADEMIC PERFORMANCE

Reading: Reading on grade level with strong decoding skills. Comprehension of inferential material remains below grade level and is a focus of intervention.

Math: Computation at grade level. Word problems with multi-step requirements remain challenging; visual supports help.

Writing: Written output is below grade level due to fine motor and executive function challenges. Using speech-to-text for longer assignments.

SOCIAL-EMOTIONAL

Amelia participates in a social skills group twice a week. She has made progress in initiating interactions with classmates during structured activities. Unstructured play (recess) remains difficult; she typically seeks out an adult or goes to the reading corner.

SPECIAL CONSIDERATIONS

Sensory accommodations: noise-reducing headphones available, dimmed lighting in quiet reading space, flexible seating.

Behavioral: No behavioral incidents this year. When frustrated Amelia typically withdraws rather than acts out.

Parent involvement: Both parents attend IEP meetings. Both are responsive to teacher communication. Mr. Szczerba communicates primarily through the online portal; Ms. Ngo typically attends in-person check-ins.

Brenna Tolliver, M.Ed.
Castle Rock Elementary SPED Team
`;
const PLANNING_NOTE$1 = `${SYNTHETIC_BANNER}

PIKE FORENSICS
Case Planning Note (INTERVIEW STAGE)

Case: ${EXAMINEE$6} (Custody Evaluation)
Case Number: ${CASE_NUMBER$6}
Date: March 26, 2026

PROGRESS TO DATE

1. Both parents interviewed (March 10 and March 17). Collateral records obtained from Castle Rock Elementary IEP team, Children's Hospital Colorado OT and SLP, pediatrician.
2. First child observation completed March 24. Amelia is an articulate, attached, typically-presenting child with ASD Level 1, bonded to both parents.

STILL OUTSTANDING

1. Joint home visit with Mr. Szczerba and Amelia (scheduled April 3)
2. Joint home visit with Ms. Ngo and Amelia (scheduled April 7)
3. Collateral telephone interviews with maternal grandmother Linh Ngo and Amelia's occupational therapist Rowan Khoroshev (both scheduled for week of April 8)
4. Review of Amelia's complete pediatric records (releases signed, records received April 2)
5. Structured testing: neither parent will be given formal personality testing in this case; the MMPI-3 was considered and set aside because the clinical picture does not suggest psychopathology in either parent

FORMULATION IN PROGRESS

Both parents meet minimum standards for parenting capacity. Both have genuine strengths relevant to Amelia's needs. Mr. Szczerba offers routine and technical engagement with Amelia's therapy schedule. Ms. Ngo offers family continuity and extended family support. The central question is which plan best serves Amelia's specific developmental profile and which plan is most practically sustainable.

An interim recommendation before the home visits would be premature. The case is currently on track for a final report by the June 30 deadline.

Jordan Whitfield, Psy.D., ABPP
`;
const CASE_04_SZCZERBA = {
  caseNumber: CASE_NUMBER$6,
  createdAt: "2026-02-20",
  lastModified: "2026-03-26",
  firstName: "Amelia",
  lastName: "Szczerba-Ngo",
  dob: DOB$6,
  gender: "F",
  evaluationType: "Custody",
  referralSource: "Douglas County District Court (Family)",
  evaluationQuestions: "Best interests of a 9yo with ASD Level 1, comparative parenting capacity, sustainable parenting plan.",
  stage: "interview",
  caseStatus: "in_progress",
  notes: "Both parent interviews complete. Joint home visits and collateral scheduled. No testing planned.",
  complexity: "very-complex",
  summary: "Contested custody of 9yo with ASD Level 1. Both parents cooperative. Father wants primary, mother wants 50/50.",
  diagnoses: ["F84.0 Autism Spectrum Disorder, Level 1 (child; prior diagnosis)"],
  intake: {
    referral_type: "court",
    referral_source: "Hon. Moira Delacroix, Douglas County District Court",
    eval_type: "Custody",
    presenting_complaint: "Parenting evaluation for contested custody of 9yo with ASD. High-conflict but no DV.",
    jurisdiction: "Douglas County",
    charges: null,
    attorney_name: "Kepler Frostenson (for Petitioner father), Beatrix Ommundsen (for Respondent mother)",
    report_deadline: "2026-06-30",
    status: "complete"
  },
  onboarding: [
    {
      section: "contact",
      content: "Petitioner Tomasz Szczerba (Castle Rock). Respondent Mai Ngo (Castle Rock). Minor child Amelia, 9, attends Castle Rock Elementary.",
      status: "complete"
    },
    {
      section: "family",
      content: "Parents married 2015, separated April 2024, divorce final December 2024. Amelia is only child. Maternal grandparents in Louisville, CO actively involved.",
      status: "complete"
    },
    {
      section: "health",
      content: "Child diagnosed with ASD Level 1 at Children's Hospital Colorado 2023. Ongoing OT and SLP weekly. IEP at Castle Rock Elementary.",
      status: "complete"
    }
  ],
  documents: [
    {
      subfolder: "Collateral",
      filename: "Stipulated_Court_Order_Custody_Eval.txt",
      documentType: "other",
      content: COURT_ORDER$1,
      description: "Stipulated order for parenting evaluation"
    },
    {
      subfolder: "Interviews",
      filename: "Father_Interview_Szczerba.txt",
      documentType: "other",
      content: FATHER_INTERVIEW$1,
      description: "Father interview notes, March 10"
    },
    {
      subfolder: "Interviews",
      filename: "Mother_Interview_Ngo.txt",
      documentType: "other",
      content: MOTHER_INTERVIEW$1,
      description: "Mother interview notes, March 17"
    },
    {
      subfolder: "Interviews",
      filename: "Child_Observation_Session_1.txt",
      documentType: "other",
      content: CHILD_OBSERVATION,
      description: "First child observation, March 24"
    },
    {
      subfolder: "Collateral",
      filename: "Castle_Rock_Elementary_IEP_Summary.txt",
      documentType: "other",
      content: SCHOOL_RECORDS,
      description: "IEP progress report summary"
    },
    {
      subfolder: "Diagnostics",
      filename: "Case_Planning_Note.txt",
      documentType: "other",
      content: PLANNING_NOTE$1,
      description: "Interview-stage planning note"
    }
  ]
};
const CASE_NUMBER$5 = "2026-0421";
const EXAMINEE$5 = "Bremner, Siobhan K.";
const DOB$5 = "1974-09-11";
const REFERRAL$3 = `${SYNTHETIC_BANNER}

HALVORSEN & OSTROM LLP
Attorneys at Law
1400 17th Street, Suite 1800, Denver, CO 80202

February 24, 2026

Jordan Whitfield, Psy.D., ABPp
Pike Forensics

Re: Bremner v. Denver Western Stockyards, Inc.
Case No.: 2025-CV-01420 (Adams County District Court)

Dr. Whitfield,

We represent Ms. Siobhan K. Bremner in her civil action against Denver Western Stockyards following a workplace collision on October 8, 2024. Ms. Bremner was struck by a forklift while working in the receiving bay and sustained a right tibial plateau fracture. Since that date she has experienced substantial psychological symptoms that have prevented her return to work.

We are retaining you to conduct a diagnostic evaluation to determine whether Ms. Bremner meets DSM-5-TR criteria for Posttraumatic Stress Disorder, to identify any comorbid conditions, and to offer an opinion on the causal relationship between the October 8 incident and her current psychological condition.

Enclosed are the Safety and Health Administration incident report, the Anschutz Medical Center ED and follow-up records, the employer's return-to-work evaluations, and a complete release. The discovery deadline is August 15, 2026.

Please invoice our office. Our paralegal Noemi Caballero will coordinate scheduling at (303) 555-0172.

Merrit Halvorsen
Senior Partner
`;
const INCIDENT_REPORT = `${SYNTHETIC_BANNER}

COLORADO DEPARTMENT OF LABOR AND EMPLOYMENT
OSHA-Reportable Incident Report (Redacted Summary)

Incident Date: October 8, 2024
Location: Denver Western Stockyards, 6850 E. 56th Avenue, Denver, CO
Reporting Supervisor: Alastair Penderghast, Operations Manager

SUMMARY

At approximately 11:15 AM on October 8, 2024, employee Siobhan K. Bremner was in the west receiving bay reviewing a shipment manifest when a forklift operated by another employee entered the bay without sounding its reverse alarm. The forklift struck Ms. Bremner in her right leg. She fell backward onto the concrete floor.

Emergency services were summoned and arrived within 7 minutes. Ms. Bremner was transported by ambulance to Anschutz Medical Center. Initial assessment by ED physician documented a displaced right tibial plateau fracture and mechanism-consistent soft tissue injuries. She was conscious throughout.

The forklift operator, Beaufort Van Dyken, stated he believed the bay was clear. The reverse alarm was subsequently determined to have been disconnected sometime in the two weeks prior; no record of the disconnection exists in maintenance logs. The alarm was restored and all bay procedures reviewed.

Ms. Bremner remained employed by Denver Western Stockyards until January 15, 2025, when she was placed on extended medical leave without return-to-work date.
`;
const ED_RECORDS = `${SYNTHETIC_BANNER}

ANSCHUTZ MEDICAL CENTER
Emergency Department Report (Excerpt)

Patient: Siobhan K. Bremner (DOB 09/11/1974)
Arrival: 11:48 AM, October 8, 2024
Chief Complaint: Crush injury to right lower extremity

PRESENTATION

EMS reports 51-year-old woman struck by a forklift at her workplace. Conscious and oriented. Reports pain in right knee and leg 10/10. Denied loss of consciousness. GCS 15 throughout transport.

EXAMINATION

Vitals: BP 142/88, HR 108, RR 18, SpO2 98% on RA.
Obvious deformity of right proximal tibia with ecchymosis and swelling. Distal pulses intact. No open wound.

IMAGING

Right tibia/fibula X-ray: Displaced fracture of the right tibial plateau, Schatzker type II.
Right knee MRI (obtained 10/09): Confirmed fracture with mild associated meniscal injury.

COURSE

Orthopedic consult. Patient admitted for operative fixation on 10/09. ORIF performed by Dr. Karaduman without complication. Discharged to home with outpatient physical therapy on 10/13.

Observation note: Patient expressed significant anxiety in the ED about "the sound" of the forklift, asking repeatedly whether it was coming toward her again. Psychiatry consult not obtained in the ED. Social work provided general support.

Orley Dymbort, MD
ED Attending
`;
const CAPS5_NOTE = `${SYNTHETIC_BANNER}

PIKE FORENSICS
Testing Note, CAPS-5 Partial Administration

Examinee: ${EXAMINEE$5}
Date: March 18, 2026
Examiner: Jordan Whitfield, Psy.D., ABPP
Status: PARTIAL, Administration paused at Criterion D

ADMINISTRATION

CAPS-5 administration was initiated at 10:00 AM. The index event was clearly established as the October 8, 2024 workplace collision. Criterion A is met.

Criterion B (intrusion): Completed. Ms. Bremner endorsed 4 of 5 items at clinically significant frequency and intensity. Composite symptom severity for Criterion B: 8 (of a possible 20). Intrusion symptoms include weekly distressing dreams of the collision, dissociative reactions to the sound of backup alarms, and prolonged distress when watching warehouse scenes on television.

Criterion C (avoidance): Completed. Both items endorsed. She avoids warehouses, loading docks, and any audio content involving large vehicles. She has not returned to her workplace.

Criterion D (negative alterations in cognition and mood): Administration paused after 3 of 7 items due to examinee distress. Ms. Bremner became tearful while describing her inability to feel close to her husband since the incident, and requested a break. After a 15-minute break she indicated she wished to return another day.

NEXT STEPS

Resume Criterion D items on the next appointment. Complete Criteria E and F. Administer PCL-5 as a parallel self-report measure. Administer TSI-2 for validity and breadth of trauma symptoms. Consider the M-FAST for symptom validity given the civil context.

Ms. Bremner's distress during administration is clinically informative and consistent with a genuine PTSD presentation; it is not a reason to conclude the administration was invalid. The distress will be noted in the final report with the full context.

Next session: March 25, 2026.

Jordan Whitfield, Psy.D., ABPP
`;
const PCL5_RESULTS = `${SYNTHETIC_BANNER}

PIKE FORENSICS
PCL-5 Self-Report Results

Examinee: ${EXAMINEE$5}
Date: March 18, 2026
Administration: Paper self-report, Pike Forensics office
Index trauma: Motor vehicle / workplace collision October 8, 2024

RESULTS

Total PCL-5 Score: 54
Screening threshold for probable PTSD: 33
Clinical significance: Well above threshold

Cluster scores:
  B (intrusion):       14 / 20
  C (avoidance):        8 / 8
  D (negative cognition and mood): 18 / 28
  E (arousal/reactivity): 14 / 24

INTERPRETATION

The PCL-5 total of 54 is substantially above the screening threshold of 33 and is consistent with probable PTSD. Cluster scores are elevated across all four DSM-5 PTSD criteria. Avoidance cluster is maximally endorsed.

The PCL-5 is a screening instrument, not a diagnostic one. The CAPS-5 (currently in progress) is the definitive diagnostic interview. The concordance between the PCL-5 self-report and the initial CAPS-5 findings is high.

Jordan Whitfield, Psy.D., ABPP
`;
const CASE_05_BREMNER = {
  caseNumber: CASE_NUMBER$5,
  createdAt: "2026-02-24",
  lastModified: "2026-03-18",
  firstName: "Siobhan",
  lastName: "Bremner",
  dob: DOB$5,
  gender: "F",
  evaluationType: "PTSD Dx",
  referralSource: "Halvorsen & Ostrom LLP (Plaintiff)",
  evaluationQuestions: "DSM-5-TR PTSD criteria, comorbid conditions, causal relationship to October 2024 workplace collision.",
  stage: "testing",
  caseStatus: "in_progress",
  notes: "CAPS-5 in progress (paused at Criterion D). PCL-5 completed. TSI-2 and M-FAST scheduled.",
  complexity: "moderate",
  summary: "51yo woman, workplace forklift collision 10/8/2024, tibial plateau fracture. No prior psych history. PCL-5 = 54, CAPS-5 in progress.",
  diagnoses: ["F43.10 Posttraumatic Stress Disorder (provisional, pending completion of CAPS-5)"],
  intake: {
    referral_type: "attorney",
    referral_source: "Merrit Halvorsen, Halvorsen & Ostrom LLP",
    eval_type: "PTSD Dx",
    presenting_complaint: "Persistent trauma symptoms following workplace collision preventing return to work.",
    jurisdiction: "Adams County District Court",
    charges: null,
    attorney_name: "Merrit Halvorsen (plaintiff)",
    report_deadline: "2026-06-15",
    status: "complete"
  },
  onboarding: [
    {
      section: "contact",
      content: "Lives in Thornton with husband Calum Bremner. Reached via cell at (303) 555-0167. Attorney paralegal Noemi Caballero coordinates scheduling.",
      status: "complete"
    },
    {
      section: "complaints",
      content: "Intrusion, avoidance, negative mood, hyperarousal. Unable to return to workplace. Deteriorated marital closeness since the incident.",
      status: "complete"
    },
    {
      section: "mental",
      content: "No prior psychiatric history, no prior treatment, no prior medications. Primary care records confirm no mental health concerns prior to October 2024.",
      status: "complete"
    },
    {
      section: "health",
      content: "ORIF right tibial plateau October 2024 without complication. Completed PT through June 2025. Residual knee stiffness.",
      status: "complete"
    },
    {
      section: "education",
      content: "Associate degree in business administration. Employed at Denver Western Stockyards 2009 to present (on extended leave since January 2025).",
      status: "complete"
    }
  ],
  documents: [
    {
      subfolder: "_Inbox",
      filename: "Plaintiff_Counsel_Referral.txt",
      documentType: "other",
      content: REFERRAL$3,
      description: "Plaintiff counsel referral letter"
    },
    {
      subfolder: "Collateral",
      filename: "OSHA_Incident_Report.txt",
      documentType: "other",
      content: INCIDENT_REPORT,
      description: "OSHA-reportable incident report, October 2024"
    },
    {
      subfolder: "Collateral",
      filename: "Anschutz_ED_Report.txt",
      documentType: "other",
      content: ED_RECORDS,
      description: "Anschutz ED report October 8, 2024"
    },
    {
      subfolder: "Testing",
      filename: "CAPS-5_Partial_Administration_Note.txt",
      documentType: "other",
      content: CAPS5_NOTE,
      description: "CAPS-5 partial administration note"
    },
    {
      subfolder: "Testing",
      filename: "PCL-5_Self_Report_Results.txt",
      documentType: "other",
      content: PCL5_RESULTS,
      description: "PCL-5 self-report results, total 54"
    }
  ]
};
const CASE_NUMBER$4 = "2026-0445";
const EXAMINEE$4 = "Bhattacharya, Harshit";
const DOB$4 = "1996-07-30";
const REFERRAL$2 = `${SYNTHETIC_BANNER}

Harshit Bhattacharya
847 Spruce Street, Apt 4B
Boulder, CO 80302
harshit.bh.grad@colorado.example

April 2, 2026

Pike Forensics
Attn: Jordan Whitfield, Psy.D., ABPP

Dear Dr. Whitfield,

My name is Harshit Bhattacharya. I am a third-year law student at the University of Colorado Boulder and I will be sitting for the Colorado Bar Examination in July 2026. I am writing to request a psychological evaluation to document ADHD and to support a request for testing accommodations.

I was diagnosed with ADHD by my pediatrician when I was 8 years old and took methylphenidate through middle school. I stopped taking medication in high school because I felt I could manage without it. I have struggled with sustained attention throughout college and law school. I received extended time on my LSAT based on my childhood diagnosis, but the documentation from that accommodation is more than five years old and NCBE requires current documentation.

My law school has confirmed I will be eligible for accommodations if I can provide a current comprehensive evaluation. I am able to pay privately for the evaluation. I have no court involvement and this is not a disability or insurance claim.

Thank you for considering my request. I am available weekday afternoons and evenings.

Sincerely,
Harshit Bhattacharya
`;
const INTAKE_FORM = `${SYNTHETIC_BANNER}

PIKE FORENSICS
Intake Form Summary

Completed: April 5, 2026 (self-completed electronically)

IDENTIFYING INFORMATION

Name: Harshit Bhattacharya
Date of Birth: July 30, 1996
Address: 847 Spruce Street, Apt 4B, Boulder, CO 80302
Email: harshit.bh.grad@colorado.example
Phone: (720) 555-0180
Emergency contact: Priya Bhattacharya (mother), (510) 555-0143

CURRENT STATUS

Occupation: Full-time law student, third year, University of Colorado Law School
Insurance: Self-pay (declines to submit to insurance to avoid claims history)
Primary care physician: Dr. Ann-Mette Halversen, CU Wardenburg Health
Current medications: None

REASON FOR EVALUATION

Documentation of ADHD for Colorado Bar Examination accommodations (extended time). Law school has approved accommodations contingent on current evaluation.

PRIOR DIAGNOSIS

First diagnosed with ADHD by pediatrician in second grade (1996 timeframe). Treated with methylphenidate 10 mg TID from 2004 to approximately 2011. Discontinued voluntarily during high school. Received extended time on LSAT in 2019 based on original diagnosis documentation.

CURRENT CONCERNS

Sustained attention during reading long passages. Difficulty completing timed outlines. Task initiation on non-urgent work. Organization of study materials. Symptoms have been relatively stable since undergraduate.

CONSENT

Standard release signed electronically. Understands the evaluation is private-pay, is not part of any legal proceeding, and will be shared with his law school dean of students and the NCBE only with his written authorization.
`;
const PLANNING_NOTE = `${SYNTHETIC_BANNER}

PIKE FORENSICS
Case Planning Note, Onboarding

Case: ${EXAMINEE$4}
Case Number: ${CASE_NUMBER$4}
Date: April 6, 2026

PROTOCOL FOR THIS EVALUATION

This is a straightforward adult ADHD evaluation for accommodations. NCBE documentation standards require:
1. Evidence of symptoms that began in childhood (DSM-5-TR Criterion B)
2. Current symptoms meeting criteria in at least two settings
3. Functional impairment
4. Rule-out of other disorders that could account for the presentation
5. Standardized testing of attention and executive function

PLANNED MEASURES

1. Clinical interview (2 hours, scheduled April 14)
2. Collateral form completed by mother Priya Bhattacharya (mailed April 6)
3. Collateral form completed by current classmate or study group partner (to be identified)
4. CAARS (Conners Adult ADHD Rating Scales) self and observer forms
5. WAIS-V (full battery), baseline cognitive functioning
6. Conners CPT-3, objective attention measure
7. WIAT-4 selected subtests (reading comprehension, written expression, math problem solving) for baseline academic achievement

RECORDS TO REQUEST

1. Original childhood evaluation documentation (mother is locating)
2. LSAT accommodation documentation (2019)
3. Current law school transcript
4. Undergraduate transcript
5. Letter from current law school dean of students confirming accommodation eligibility

NO CURRENT CONCERNS

Mr. Bhattacharya is private-pay, not in legal or disability proceedings, has documented childhood history, and has insight into his symptoms. This evaluation is expected to be straightforward and to conclude with either (a) a current diagnosis and accommodation recommendations or (b) insufficient evidence for a current diagnosis with notes on alternate explanations.

Expected duration: 4 weeks from intake to final report.

Jordan Whitfield, Psy.D., ABPP
`;
const RELEASE_FORM = `${SYNTHETIC_BANNER}

PIKE FORENSICS
Authorization for Release of Information

Executed: April 5, 2026

I, Harshit Bhattacharya, authorize:

Priya Bhattacharya (mother)
Address: 2245 Avalon Way, Fremont, CA 94539

to release to Jordan Whitfield, Psy.D., ABPP of Pike Forensics:

[X] Any childhood medical or psychological records in her possession
[X] A completed Collateral History Form
[ ] Other

I also authorize the University of Colorado Law School, Office of Student Services, to release:

[X] Accommodation eligibility letter
[X] Current academic transcript

AND the Colorado Bar Exam NCBE Testing Accommodations Office to RECEIVE the final evaluation report from Pike Forensics upon my subsequent written release (which will be executed after I review the final report).

This authorization expires 12 months from the date of execution unless revoked earlier in writing.

Signed:
Harshit Bhattacharya
Date: April 5, 2026

Witness:
Jordan Whitfield, Psy.D., ABPP
`;
const CASE_06_BHATTACHARYA = {
  caseNumber: CASE_NUMBER$4,
  createdAt: "2026-04-02",
  lastModified: "2026-04-06",
  firstName: "Harshit",
  lastName: "Bhattacharya",
  dob: DOB$4,
  gender: "M",
  evaluationType: "ADHD Dx",
  referralSource: "Self-referral, private pay",
  evaluationQuestions: "Current ADHD diagnosis and functional impairment to support Colorado Bar Exam accommodation request.",
  stage: "onboarding",
  caseStatus: "intake",
  notes: "Simple private-pay ADHD eval. Intake complete, testing scheduled, records requested.",
  complexity: "simple",
  summary: "29yo law student, childhood ADHD with prior treatment, seeking current diagnosis for bar exam accommodations.",
  diagnoses: [],
  intake: {
    referral_type: "self",
    referral_source: "Self-referral",
    eval_type: "ADHD Dx",
    presenting_complaint: "Documentation of ADHD for Colorado Bar Exam accommodations; childhood diagnosis with outdated paperwork.",
    jurisdiction: null,
    charges: null,
    attorney_name: null,
    report_deadline: "2026-05-30",
    status: "complete"
  },
  onboarding: [
    {
      section: "contact",
      content: "Boulder, CO resident. Third-year law student at CU Law. Cell (720) 555-0180. Mother in Fremont, CA is primary childhood history source.",
      status: "complete"
    },
    {
      section: "complaints",
      content: "Sustained attention on long reading, timed task completion, task initiation, organization. Symptoms stable since undergraduate.",
      status: "complete"
    },
    {
      section: "mental",
      content: "Childhood ADHD diagnosis (age 8). Methylphenidate 2004 to 2011. No other psychiatric history. No current medications. No suicidal ideation.",
      status: "complete"
    },
    {
      section: "education",
      content: "Bachelor's in political science, University of California Irvine. Currently J.D. program at CU Law, expected graduation May 2026. GPA 3.4.",
      status: "complete"
    }
  ],
  documents: [
    {
      subfolder: "_Inbox",
      filename: "Self_Referral_Letter.txt",
      documentType: "other",
      content: REFERRAL$2,
      description: "Self-referral email from examinee"
    },
    {
      subfolder: "_Inbox",
      filename: "Intake_Form_Summary.txt",
      documentType: "other",
      content: INTAKE_FORM,
      description: "Intake form summary"
    },
    {
      subfolder: "_Inbox",
      filename: "Release_of_Information_Forms.txt",
      documentType: "other",
      content: RELEASE_FORM,
      description: "Signed releases for mother, law school, and NCBE"
    },
    {
      subfolder: "Collateral",
      filename: "Case_Planning_Note.txt",
      documentType: "other",
      content: PLANNING_NOTE,
      description: "Planning note with protocol and records list"
    }
  ]
};
const CASE_NUMBER$3 = "2026-0459";
const EXAMINEE$3 = "McIlhenny, Connor P.";
const DOB$3 = "1987-05-22";
const COURT$1 = "Colorado Springs Police Department, Office of Internal Affairs";
const COMMAND_MEMO = `${SYNTHETIC_BANNER}

COLORADO SPRINGS POLICE DEPARTMENT
Office of the Chief
705 S. Nevada Avenue, Colorado Springs, CO 80903

January 7, 2026

FITNESS-FOR-DUTY EVALUATION REFERRAL

Subject Officer: Connor P. McIlhenny, Badge 8812
Assigned Unit: Patrol, District 3
Years of Service: 11

INCIDENT

On December 14, 2025, Officer McIlhenny was the primary responding officer to a domestic disturbance call in the 6200 block of N. Powers Boulevard. Upon arrival, the subject (adult male) advanced on Officer McIlhenny while holding a knife. Officer McIlhenny discharged his service weapon twice, striking the subject in the torso. The subject was pronounced at Memorial Hospital Central 35 minutes after arrival.

The officer-involved shooting was reviewed by the CSPD Use of Force Review Board on December 22, 2025 and found to be within policy. The subject's family has not initiated civil action as of this date.

REASON FOR REFERRAL

Per departmental policy, a fitness-for-duty evaluation is required following any officer-involved shooting before the officer returns to full duty. Officer McIlhenny has been on administrative leave with pay since December 15, 2025.

Specific questions:
1. Is Officer McIlhenny currently fit to perform the essential duties of a patrol officer?
2. If not currently fit, what accommodations or treatment would support a return to duty?
3. Are there any safety concerns related to Officer McIlhenny's current psychological state?

Payment: Departmental cost center 303-IA-Evals. Standard FFD rate schedule.

Chief Ingrid Aasgard
Colorado Springs Police Department
`;
const MMPI3_RESULTS = `${SYNTHETIC_BANNER}

PIKE FORENSICS
MMPI-3 Results Summary

Examinee: ${EXAMINEE$3}
Date: January 20, 2026
Administration: In-office, paper form
Examiner: Jordan Whitfield, Psy.D., ABPP

VALIDITY SCALES

CNS:    3        (within normal limits)
VRIN-r: T=48
TRIN-r: T=55
F-r:    T=52
Fp-r:   T=47
Fs:     T=51
FBS-r:  T=49
RBS:    T=55
L-r:    T=58
K-r:    T=61

All validity indices are within normal limits. No indication of random, inconsistent, over-reporting, or underreporting. The K-r and L-r elevations are mildly in the self-favorable direction, consistent with the public safety context but not at a level that distorts interpretation.

SUBSTANTIVE SCALES

Higher Order:
  EID (Emotional/Internalizing Dysfunction): T=58
  THD (Thought Dysfunction):                 T=45
  BXD (Behavioral/Externalizing Dysfunction): T=52

Restructured Clinical:
  RCd (Demoralization):        T=56
  RC1 (Somatic Complaints):    T=48
  RC2 (Low Positive Emotions): T=54
  RC3 (Cynicism):              T=59
  RC4 (Antisocial Behavior):   T=51
  RC6 (Ideas of Persecution):  T=44
  RC7 (Dysfunctional Negative Emotions): T=62
  RC8 (Aberrant Experiences):  T=43
  RC9 (Hypomanic Activation):  T=52

All RC scales are within normal limits (T<65). The mild elevation on RC7 (T=62) reflects situationally appropriate negative emotional arousal in the context of the recent critical incident. There is no indication of a psychotic, thought, or personality disorder.

INTERPRETATION

Officer McIlhenny's MMPI-3 profile is within normal limits across all validity and substantive scales. There is no evidence of a current mental disorder that would preclude return to full patrol duty. The mildly elevated RC7 is clinically coherent with acute stress following a critical incident and does not itself reach clinical significance.

Jordan Whitfield, Psy.D., ABPP
`;
const INTERVIEW = `${SYNTHETIC_BANNER}

PIKE FORENSICS
Structured Fitness for Duty Interview

Examinee: ${EXAMINEE$3}
Date: January 27, 2026
Duration: 150 minutes
Examiner: Jordan Whitfield, Psy.D., ABPP

NOTIFICATION

Officer McIlhenny was informed at the outset that this evaluation was requested by his department, that information shared would be reported to the department's designated recipient (Chief Aasgard), and that the evaluation did not create a treating relationship. He acknowledged understanding in his own words and agreed to proceed.

PERSONAL AND OCCUPATIONAL HISTORY

Officer McIlhenny is a 38-year-old man who joined the Colorado Springs Police Department in 2015 after six years as an Army Military Police officer (no deployments). He is married to Hana Thorburn-McIlhenny (RN, Memorial Hospital); they have two children ages 7 and 4. He holds an associate's degree in criminal justice. His department record includes no sustained complaints and two commendations for community engagement.

THE INCIDENT

Officer McIlhenny described the December 14 incident in his own words without prompting. His account was organized, factual, and consistent with the reports already in the file. He identified the moment he decided to fire, identified that he called for a supervisor and EMS immediately, and described his actions at the scene until relief arrived. He showed appropriate emotional engagement: a brief tearing of the eyes when describing the subject being pronounced, followed by a clear return to narrative.

POST-INCIDENT SYMPTOMS

First two weeks post-incident: difficulty sleeping (average 4 to 5 hours), intrusive memories (daily) of the subject advancing with the knife, mild hypervigilance in public, one instance of elevated startle response when a neighbor dropped a toolbox. He attended the department's mandatory debrief and met twice with his peer support officer. He initiated his own contact with a civilian therapist on January 5.

Weeks three and four: Sleep improving to 6 to 7 hours. Intrusive memories reduced to 2 or 3 times per week. Hypervigilance reduced. Attended 3 sessions with his therapist. Was able to go to his children's winter concert.

Current (week six): Sleep normalized. No nightmares for two weeks. Intrusions occur only when prompted by specific cues (knife imagery in media). He reports feeling "ready to go back, with support." He plans to continue therapy through the next several months and intends to attend the department's peer support retreat in March.

CAPACITY EVALUATION

Officer McIlhenny was asked how he would respond if called to a similar incident. His answer was thoughtful: he described a graduated return-to-duty approach he had discussed with his sergeant, beginning with administrative and training duty and transitioning back to patrol with his regular partner for the first two weeks. He described what he would need from his supervisor ("I want to be told if they see me hesitating"). He did not express bravado, denial, or inappropriate readiness.

IMPRESSION

Officer McIlhenny is showing a clinically appropriate acute stress response to a critical incident. His symptoms peaked in the first two weeks, responded to peer support and private therapy, and are substantially resolved at six weeks. His insight is intact. He has an appropriate support system and a coherent return-to-duty plan. There is no indication of PTSD, depression, substance misuse, or safety concerns.

Jordan Whitfield, Psy.D., ABPP
`;
const FFD_REPORT = `${reportHeader(
  CASE_NUMBER$3,
  EXAMINEE$3,
  DOB$3,
  "Fitness for Duty Evaluation",
  COURT$1
)}REFERRAL QUESTION

The Colorado Springs Police Department requested a fitness-for-duty evaluation of Officer Connor P. McIlhenny following an officer-involved shooting on December 14, 2025. The referral asked whether Officer McIlhenny is currently fit to perform the essential duties of a patrol officer, what accommodations or treatment would support return to duty if he is not, and whether there are any safety concerns related to his current psychological state.

PROCEDURES

I reviewed the CSPD Incident Report #2025-12-3401, the Use of Force Review Board findings dated December 22, 2025, the debrief notes from the mandatory critical incident debrief dated December 18, 2025, and Officer McIlhenny's department personnel summary. I conducted an extended clinical interview on January 27, 2026 (approximately 2.5 hours) and administered the MMPI-3 on January 20, 2026. Collateral telephone contact was made with Hana Thorburn-McIlhenny (wife) on January 29, 2026.

BACKGROUND

Officer McIlhenny is a 38-year-old man who joined CSPD in 2015 after six years as an Army Military Police officer. He is married and has two children. His department record is positive with no sustained complaints. He has no prior psychological issues, no prior critical incidents of this magnitude, and no mental health treatment prior to January 2026.

MENTAL STATUS

Officer McIlhenny presented well-groomed, cooperative, and organized. Mood was described as "getting back to normal." Affect was appropriate with a brief moment of tearfulness when describing the outcome of the subject. Speech was fluent and coherent. Thought process was logical and goal-directed. He denied suicidal or homicidal ideation, hallucinations, and delusions.

CLINICAL COURSE

Officer McIlhenny showed an acute stress response in the two weeks following the incident (sleep disruption, intrusions, mild hypervigilance) that has substantially resolved at the six-week mark with the combination of peer support, self-initiated civilian therapy, and appropriate family support. He does not meet criteria for Posttraumatic Stress Disorder or Acute Stress Disorder. He shows brief, contextually appropriate features consistent with an Adjustment Disorder with Anxiety (F43.22) that is nearly resolved.

Collateral from his wife confirmed the self-report: improved sleep, normalized family engagement, active use of coping strategies, no concerning behavior.

TESTING

MMPI-3 administered January 20, 2026. All validity scales within normal limits. All substantive scales within normal limits with the exception of a mild elevation on RC7 (T=62) reflecting situationally appropriate negative emotional arousal. No evidence of a current mental disorder on objective testing.

OPINION

To a reasonable degree of psychological certainty, Officer Connor P. McIlhenny is currently fit for duty as a patrol officer. His acute stress response has substantially resolved, his insight is intact, he has an appropriate support system and continued treatment engagement, and his approach to return to duty is thoughtful and collaborative.

RECOMMENDATIONS

1. Graduated return to duty beginning with two weeks of administrative and training duty, transitioning to patrol with his regular partner thereafter.
2. Continuation of his current civilian therapy for at least four additional months.
3. Attendance at the department peer support retreat scheduled for March 2026.
4. Scheduled supervisor check-in at 30 days post-return with explicit permission for Officer McIlhenny to raise concerns at any time.
5. If significant new symptoms arise in the first 90 days post-return, re-evaluation should be considered.

Officer McIlhenny's current clinical trajectory is favorable. The recommendations above are intended as structure and support rather than as restrictions driven by concern.
${clinicianSignature()}`;
const CASE_07_MCILHENNY = {
  caseNumber: CASE_NUMBER$3,
  createdAt: "2026-01-07",
  lastModified: "2026-02-05",
  firstName: "Connor",
  lastName: "McIlhenny",
  dob: DOB$3,
  gender: "M",
  evaluationType: "Fitness for Duty",
  referralSource: "Colorado Springs Police Department",
  evaluationQuestions: "Current fitness for patrol duty following December 2025 officer-involved shooting; accommodations; safety concerns.",
  stage: "complete",
  caseStatus: "completed",
  notes: "FFD report complete. Cleared for duty with graduated return plan.",
  complexity: "moderate",
  summary: "38yo police officer, 11 years service, fit for duty following December OIS with appropriate acute stress response resolving.",
  diagnoses: ["F43.22 Adjustment Disorder with Anxiety (resolving)"],
  intake: {
    referral_type: "attorney",
    referral_source: "Chief Ingrid Aasgard, CSPD",
    eval_type: "Fitness for Duty",
    presenting_complaint: "Post-OIS fitness for duty evaluation. Officer on administrative leave since December 15, 2025.",
    jurisdiction: "El Paso County",
    charges: null,
    attorney_name: null,
    report_deadline: "2026-02-15",
    status: "complete"
  },
  onboarding: [
    {
      section: "contact",
      content: "CSPD badge 8812. Wife Hana Thorburn-McIlhenny (RN, Memorial Hospital). Two children ages 7 and 4. Civilian therapist since January 5, 2026.",
      status: "complete"
    },
    {
      section: "mental",
      content: "No prior psychiatric history. Initiated civilian therapy January 5, 2026. Attending departmental peer support. Acute stress response with steady resolution.",
      status: "complete"
    },
    {
      section: "legal",
      content: "OIS on December 14, 2025 ruled within policy by Use of Force Review Board December 22, 2025.",
      status: "complete"
    },
    {
      section: "recent",
      content: "On administrative leave December 15, 2025 to present. Self-initiated therapy week three post-incident. Positive family support.",
      status: "complete"
    }
  ],
  documents: [
    {
      subfolder: "_Inbox",
      filename: "Chief_Referral_Memo.txt",
      documentType: "other",
      content: COMMAND_MEMO,
      description: "Chief of Police FFD referral memo"
    },
    {
      subfolder: "Testing",
      filename: "MMPI-3_Results_Summary.txt",
      documentType: "other",
      content: MMPI3_RESULTS,
      description: "MMPI-3 results, within normal limits"
    },
    {
      subfolder: "Interviews",
      filename: "Structured_FFD_Interview.txt",
      documentType: "other",
      content: INTERVIEW,
      description: "Structured FFD interview notes"
    },
    {
      subfolder: "Reports",
      filename: "FINAL_FFD_Report.txt",
      documentType: "other",
      content: FFD_REPORT,
      description: "Final FFD report, cleared for duty"
    }
  ]
};
const CASE_NUMBER$2 = "2026-0476";
const EXAMINEE$2 = "Balderas, Rogelio T.";
const DOB$2 = "1994-12-03";
const REFERRAL$1 = `${SYNTHETIC_BANNER}

OMBLER, KINGSLEY & TRAWICK
Defense Counsel for Republic Industrial Insurance
2222 S. Havana Street, Aurora, CO 80014

February 10, 2026

Jordan Whitfield, Psy.D., ABPP
Pike Forensics

Re: Rogelio T. Balderas v. Weld Ag Services, Inc. and Republic Industrial Insurance
WC Claim No.: WC-2025-CO-48821

Dr. Whitfield,

Our firm represents Republic Industrial Insurance in the above workers compensation claim. Mr. Balderas alleges a traumatic brain injury sustained on June 14, 2025 when a pallet fell from a warehouse shelf and, in his account, struck him on the head. He has been off work since the claim date and is receiving temporary total disability benefits.

Several features of this claim have raised questions:
1. The initial incident report documented a minor impact with no loss of consciousness and no bleeding.
2. Two days later Mr. Balderas presented to an ED with reports of confusion, headache, and memory loss.
3. Two independent medical examinations in late 2025 produced inconsistent neuropsychological findings and the examiners disagreed on the presence of genuine cognitive impairment.
4. Surveillance obtained by the carrier in December 2025 shows Mr. Balderas engaged in activities inconsistent with the functional limitations he reports in treatment sessions.

We are retaining you to conduct a symptom validity assessment focused on whether Mr. Balderas's presentation is consistent with a genuine neurocognitive disorder or better explained by symptom exaggeration or malingering, within the Slick et al. (1999) Malingered Neurocognitive Dysfunction framework.

Enclosed: incident report, ED record, two prior IMEs, surveillance report summary.

Lachlan Ombler, Esq.
`;
const PRIOR_IMES = `${SYNTHETIC_BANNER}

PRIOR INDEPENDENT MEDICAL EXAMINATION SUMMARIES (DEFENSE-PROVIDED)

IME #1 (August 12, 2025)
Examiner: Thanos Makridakis, Psy.D.
Findings: Impressions included "moderate post-concussive cognitive impairment" based primarily on subjective complaints and self-reported functional decline. No symptom validity testing was conducted.

IME #2 (November 3, 2025)
Examiner: Cordelia Van Buskirk, Ph.D.
Findings: Administered a limited neuropsychological battery (WAIS-IV selected subtests, WMS-IV selected subtests, Trail Making A and B). Reported scores 2 to 3 standard deviations below the mean on multiple measures. Administered the TOMM but reported only "completed" without providing the trial scores. Concluded "severe cognitive impairment consistent with moderate TBI."

OBSERVATION (Pike Forensics review of prior IMEs)

Neither prior examiner conducted a comprehensive symptom validity assessment per current standards of practice. The absence of TOMM trial scores in IME #2 is a significant gap. The severity of reported cognitive impairment in IME #2 is inconsistent with the mechanism of injury documented in the incident report.

Jordan Whitfield, Psy.D., ABPP
`;
const TOMM_RESULTS = `${SYNTHETIC_BANNER}

PIKE FORENSICS
TOMM Administration Results

Examinee: ${EXAMINEE$2}
Date: February 24, 2026
Examiner: Jordan Whitfield, Psy.D., ABPP

ADMINISTRATION

Standard TOMM administration. Instructions delivered slowly in English with visual examples. Mr. Balderas confirmed understanding before each trial began.

RESULTS

Trial 1: 28 / 50
Trial 2: 22 / 50
Retention Trial: 19 / 50

INTERPRETATION

All three trial scores are substantially BELOW the Tombaugh (1996) cutoff of 45. Trial 2 score of 22 is below chance-level performance on a 50-item forced-choice recognition task. Below-chance performance is statistically unlikely (p<.001) without deliberate effort to perform poorly. The Retention trial further below Trial 2 is also inconsistent with genuine memory impairment, which should remain stable between Trial 2 and Retention.

This TOMM result alone is strongly suggestive of non-credible performance on memory testing. Per Slick et al. (1999) criteria, below-chance performance on a forced-choice measure meets the definitive criterion for Malingered Neurocognitive Dysfunction, Sufficient Evidence level, in the presence of external incentive.

Jordan Whitfield, Psy.D., ABPP
`;
const MMPI3_MFAST = `${SYNTHETIC_BANNER}

PIKE FORENSICS
MMPI-3 and M-FAST Results Summary

Examinee: ${EXAMINEE$2}
Dates: February 25, 2026 (MMPI-3), February 26, 2026 (M-FAST)
Examiner: Jordan Whitfield, Psy.D., ABPP

MMPI-3 VALIDITY SCALES

CNS:    4      (within limits)
VRIN-r: T=58   (within limits)
TRIN-r: T=55   (within limits)
F-r:    T=118  (MARKED ELEVATION - considering overreporting)
Fp-r:   T=112  (MARKED ELEVATION - strong indicator of overreporting)
Fs:     T=98   (significant elevation - overreporting of somatic symptoms)
FBS-r:  T=94   (significant elevation - noncredible symptom reporting)
RBS:    T=105  (MARKED ELEVATION - overreporting of cognitive symptoms)
L-r:    T=42
K-r:    T=38

INTERPRETATION OF MMPI-3 VALIDITY

The Fp-r elevation of T=112 is a strong single indicator of over-reporting. The RBS elevation of T=105 specifically suggests overreporting of cognitive symptoms. The combined elevation of Fp-r, F-r, Fs, FBS-r, and RBS is a textbook pattern for non-credible responding in the context of potential secondary gain. Substantive scales cannot be meaningfully interpreted in the presence of these validity elevations.

M-FAST RESULTS

Total score: 12
Reference cutoff for possible feigning: 6
Reference cutoff for probable feigning: 9

Scale elevations:
  Reported vs. Observed:          Elevated
  Extreme Symptomatology:         Elevated
  Rare Combinations:              Elevated
  Unusual Hallucinations:         Not elevated
  Unusual Symptom Course:         Elevated
  Negative Image:                 Elevated
  Suggestibility:                 Elevated

INTERPRETATION

M-FAST total of 12 is well above the probable feigning cutoff of 9. Multiple scale elevations. The pattern is characteristic of deliberate symptom exaggeration or feigning.

COMBINED SYMPTOM VALIDITY FINDINGS

Across three independent symptom validity measures (TOMM, MMPI-3 validity scales, M-FAST), Mr. Balderas's presentation is consistent with deliberate exaggeration. This pattern, combined with documented external incentive (pending workers compensation claim), the discrepancy between reported symptoms and documented mechanism of injury, and the surveillance evidence of inconsistent functional limitations, meets Slick et al. (1999) criteria for Definite Malingered Neurocognitive Dysfunction.

Jordan Whitfield, Psy.D., ABPP
`;
const PRELIM_FORMULATION = `${SYNTHETIC_BANNER}

PIKE FORENSICS
Preliminary Formulation (PENDING FINAL REPORT)

Case: ${EXAMINEE$2}
Case Number: ${CASE_NUMBER$2}
Date: February 28, 2026

SLICK ET AL. (1999) CRITERIA REVIEW

Criterion A. Presence of substantial external incentive: MET (active workers compensation claim, temporary total disability benefits).

Criterion B. Evidence from neuropsychological testing.
  B1. Performance below chance on forced-choice measure: MET (TOMM Trial 2 = 22/50, below-chance at p<.001)
  B2. Discrepancy between test data and known patterns of brain function: MET (reported cognitive profile inconsistent with documented mechanism of injury)
  B3. Discrepancy between test data and observed behavior: MET (surveillance evidence of preserved function)

Criterion C. Evidence from self-report.
  C1. Self-reported history that is discrepant with documented history: MET
  C2. Self-reported symptoms that are discrepant with known patterns: MET
  C3. Self-reported symptoms that are discrepant with behavioral observations: MET
  C4. Evidence of exaggerated or fabricated psychological dysfunction on well-validated validity scales: MET (MMPI-3 Fp-r T=112, M-FAST total=12)

Criterion D. Behaviors meeting necessary criteria from B or C are not fully accounted for by psychiatric, neurological, or developmental factors.

DIAGNOSTIC IMPRESSION (PRELIMINARY)

The Slick et al. (1999) MND framework supports a conclusion of DEFINITE Malingered Neurocognitive Dysfunction. Under DSM-5-TR this is coded as V65.2 / Z76.5 Malingering.

A genuine underlying mild neurocognitive condition related to the June 2025 incident cannot be definitively ruled out without further investigation, but if present it is being substantially exaggerated.

REMAINING WORK BEFORE FINAL REPORT

1. Review of the December 2025 surveillance footage (not yet provided by defense counsel)
2. Second interview session to document specific symptom claims and cross-check against surveillance findings
3. Brief additional clinical interview regarding mental health and substance use history independent of the claim

This is a diagnostics-stage formulation. The final written report will await the surveillance review and second interview, projected for late March.
${clinicianSignature()}`;
const CASE_08_BALDERAS = {
  caseNumber: CASE_NUMBER$2,
  createdAt: "2026-02-10",
  lastModified: "2026-02-28",
  firstName: "Rogelio",
  lastName: "Balderas",
  dob: DOB$2,
  gender: "M",
  evaluationType: "Malingering",
  referralSource: "Ombler, Kingsley & Trawick (Defense)",
  evaluationQuestions: "Symptom validity assessment under Slick et al. (1999) MND framework. Genuine vs. feigned cognitive impairment following workplace incident.",
  stage: "diagnostics",
  caseStatus: "in_progress",
  notes: "Three symptom validity measures converge on non-credible performance. Surveillance review and second interview pending.",
  complexity: "complex",
  summary: "31yo man, workers comp TBI claim, below-chance TOMM, MMPI-3 overreporting, M-FAST 12. Definite MND pending final review.",
  diagnoses: ["Z76.5 Malingering (preliminary, pending surveillance review)"],
  intake: {
    referral_type: "attorney",
    referral_source: "Lachlan Ombler, Esq. (defense for insurance carrier)",
    eval_type: "Malingering",
    presenting_complaint: "Claimed post-TBI cognitive impairment; discrepancies flagged by carrier.",
    jurisdiction: "Weld County Workers Compensation",
    charges: null,
    attorney_name: "Lachlan Ombler, Esq. (defense)",
    report_deadline: "2026-04-01",
    status: "complete"
  },
  onboarding: [
    {
      section: "contact",
      content: "Resides in Greeley. Represented by his own claimant attorney (Mirabel Vercingetorix). Pike Forensics retained by defense counsel.",
      status: "complete"
    },
    {
      section: "complaints",
      content: "Claims severe memory loss, cognitive fog, inability to work, inability to drive. Claims have escalated over course of workers comp claim.",
      status: "complete"
    },
    {
      section: "legal",
      content: "Active WC claim (WC-2025-CO-48821). Receiving temporary total disability benefits. No criminal history.",
      status: "complete"
    }
  ],
  documents: [
    {
      subfolder: "_Inbox",
      filename: "Defense_Counsel_Referral.txt",
      documentType: "other",
      content: REFERRAL$1,
      description: "Defense counsel referral with background"
    },
    {
      subfolder: "Collateral",
      filename: "Prior_IME_Summaries.txt",
      documentType: "other",
      content: PRIOR_IMES,
      description: "Prior IME summaries with methodological concerns"
    },
    {
      subfolder: "Testing",
      filename: "TOMM_Below_Chance_Results.txt",
      documentType: "other",
      content: TOMM_RESULTS,
      description: "TOMM results, below-chance on Trial 2"
    },
    {
      subfolder: "Testing",
      filename: "MMPI-3_M-FAST_Results.txt",
      documentType: "other",
      content: MMPI3_MFAST,
      description: "MMPI-3 and M-FAST results, convergent overreporting"
    },
    {
      subfolder: "Diagnostics",
      filename: "Preliminary_Malingering_Formulation.txt",
      documentType: "other",
      content: PRELIM_FORMULATION,
      description: "Slick et al. (1999) MND framework review"
    }
  ]
};
const CASE_NUMBER$1 = "2026-0489";
const EXAMINEE$1 = "Lockridge, Keandre J.";
const DOB$1 = "2009-03-15";
const COURT_ORDER = `${SYNTHETIC_BANNER}

DENVER DISTRICT COURT
Case Number: ${CASE_NUMBER$1}-CR
Division: Criminal (Juvenile Transfer)
Judge: Hon. Wendell Straczynski

THE PEOPLE OF THE STATE OF COLORADO v. KEANDRE J. LOCKRIDGE
Juvenile (DOB 03/15/2009, age 16)
Charge: Aggravated Robbery (C.R.S. 18-4-302), transferred to adult court

ORDER FOR PRE-TRANSFER COMPETENCY AND DEVELOPMENTAL CAPACITY EVALUATION

The People have filed a motion to transfer this matter to adult criminal court under C.R.S. 19-2.5-802. Prior to the transfer hearing, defense counsel has requested a competency evaluation under C.R.S. 16-8.5 AND a developmental maturity evaluation addressing whether Mr. Lockridge has the capacity to participate meaningfully in adult criminal proceedings.

IT IS HEREBY ORDERED that Jordan Whitfield, Psy.D., ABPP of Pike Forensics is appointed to conduct both evaluations in a single integrated report.

The evaluator is specifically requested to address:
1. Dusky competency (factual and rational understanding, consultation with counsel)
2. Developmental capacity for adult criminal proceedings
3. Any cognitive or mental health factors bearing on competency or transfer

The written report is due no later than June 1, 2026. Proceedings are stayed pending the report.

BY THE COURT:
Wendell Straczynski
District Court Judge
Dated: April 1, 2026
`;
const REFERRAL = `${SYNTHETIC_BANNER}

COLORADO JUVENILE DEFENSE COALITION
Office of the Appointed Attorney
600 17th Street, Denver, CO 80202

April 3, 2026

Jordan Whitfield, Psy.D., ABPP
Pike Forensics

Re: State v. Keandre J. Lockridge (juvenile age 16)
Case No.: ${CASE_NUMBER$1}-CR

Dr. Whitfield,

I represent Keandre Lockridge in a juvenile transfer matter. The state has moved to transfer Keandre's aggravated robbery case to adult court. Given Keandre's age, limited educational history, and significant adverse childhood experiences, I have concerns about both (a) his competency under Dusky and (b) his developmental capacity to participate in adult proceedings even if found competent under Dusky.

Keandre is currently held at the Gilliam Youth Services Center. I am also requesting a Denver Public Schools records release and a Denver Human Services records release from his prior dependency case (2015 to 2018, during which he and his sister were removed from their mother's care after which she successfully completed reunification).

This is a complex case and I am grateful for your time. My paralegal Oswyn Penhaligon will coordinate scheduling at (303) 555-0155.

Daria Kwiatkowski
Juvenile Defender
`;
const RECORDS_REQUEST = `${SYNTHETIC_BANNER}

PIKE FORENSICS
Records Request Log

Case: ${EXAMINEE$1}
Case Number: ${CASE_NUMBER$1}
Logged: April 5, 2026

1. Denver Public Schools records (2014 to present)
   - Requested from: DPS Central Records Office
   - Release signed: Yes (via defense counsel)
   - Date sent: April 5
   - Status: pending, 7-10 business day turnaround

2. Denver Human Services records (2015 to 2018 dependency case)
   - Requested from: DHS Records Custodian
   - Release signed: Yes (via defense counsel)
   - Date sent: April 5
   - Status: pending, expected 14 days

3. Gilliam Youth Services Center mental health and educational records (current)
   - Requested from: Gilliam YSC Records
   - Release signed: Yes
   - Date sent: April 5
   - Status: pending

4. Prior pediatric mental health records (Children's Hospital Colorado, 2015 to 2019)
   - Requested from: Children's Hospital HIM
   - Release signed: Yes
   - Date sent: April 5
   - Status: pending

5. Police incident report (instant offense)
   - Already in file from defense counsel
   - Date received: April 3

Jordan Whitfield, Psy.D., ABPP
`;
const INITIAL_CONTACT = `${SYNTHETIC_BANNER}

PIKE FORENSICS
Initial Contact Note

Case: ${EXAMINEE$1}
Case Number: ${CASE_NUMBER$1}
Contact date: April 4, 2026
Contact type: Telephone with defense counsel Daria Kwiatkowski

Ms. Kwiatkowski called to confirm receipt of my acceptance of the appointment. She briefed me on the following:

1. Keandre's history of adverse childhood experiences: Keandre and his sister Makayla (now 19) were removed from their mother's care in 2015 following allegations of neglect related to her methamphetamine use. They spent approximately three years in foster care before successfully reunifying in 2018. His mother Carissa Lockridge has been sober since 2017 and is actively involved in his care.

2. Educational history: Keandre has been educated in Denver Public Schools. He was placed in special education services for a Specific Learning Disorder in reading in third grade. His IEP has been maintained continuously. His 2024 WIAT-IV results (most recent available) showed Basic Reading at the 12th percentile and Reading Comprehension at the 8th percentile.

3. Prior mental health: Outpatient trauma-focused therapy at Children's Hospital Colorado from 2016 to 2019. Never psychiatrically hospitalized. Not currently medicated.

4. Instant offense: Aggravated robbery charge from February 28, 2026 involving a convenience store. Keandre was one of three co-defendants. The other two are over 18. The knife was in the possession of one of the adult co-defendants. Keandre entered the store first.

5. Counsel's specific concerns: Keandre is cooperative but functions very concretely. In their first meeting, Keandre could not explain what "transfer to adult court" meant despite Ms. Kwiatkowski's explanation twice. He asked "does that mean I go to the grown-up jail?" without appearing to grasp the longer-term implications for his education, housing, and adult record.

NEXT STEPS

1. Review records as they arrive
2. Schedule first interview at Gilliam YSC for April 17 (confirmed by facility)
3. Schedule collateral interview with Carissa Lockridge at Pike Forensics on April 22
4. Plan developmental assessment battery including age-normed competency measures

Jordan Whitfield, Psy.D., ABPP
`;
const CASE_09_LOCKRIDGE = {
  caseNumber: CASE_NUMBER$1,
  createdAt: "2026-04-01",
  lastModified: "2026-04-05",
  firstName: "Keandre",
  lastName: "Lockridge",
  dob: DOB$1,
  gender: "M",
  evaluationType: "CST",
  referralSource: "Juvenile Defense Coalition / Denver District Court",
  evaluationQuestions: "Dusky competency AND developmental capacity for adult criminal proceedings in a 16-year-old with documented learning disability and childhood trauma history.",
  stage: "onboarding",
  caseStatus: "intake",
  notes: "Case just received. Records requested. First interview scheduled April 17 at Gilliam YSC.",
  complexity: "complex",
  summary: "16yo, charged with aggravated robbery, transfer to adult court pending. SLD reading, childhood trauma, cooperative but concrete.",
  diagnoses: [
    "F81.0 Specific Learning Disorder with impairment in reading (childhood)"
  ],
  intake: {
    referral_type: "court",
    referral_source: "Hon. Wendell Straczynski, Denver District Court",
    eval_type: "CST",
    presenting_complaint: "Juvenile transferred to adult court; competency and developmental maturity.",
    jurisdiction: "Denver County (2nd Judicial District)",
    charges: "Aggravated Robbery (C.R.S. 18-4-302)",
    attorney_name: "Daria Kwiatkowski, Juvenile Defender",
    report_deadline: "2026-06-01",
    status: "complete"
  },
  onboarding: [
    {
      section: "contact",
      content: "Held at Gilliam Youth Services Center, Denver. Mother Carissa Lockridge is primary contact. Defense counsel Daria Kwiatkowski via (303) 555-0155.",
      status: "complete"
    },
    {
      section: "family",
      content: "Mother Carissa, older sister Makayla (19). Removed from mother 2015 to 2018 for neglect related to maternal meth use. Mother sober since 2017. Father not involved.",
      status: "complete"
    },
    {
      section: "education",
      content: "Denver Public Schools. SLD in reading identified 3rd grade, IEP maintained. WIAT-IV 2024: Basic Reading 12th pctl, Reading Comp 8th pctl. Currently 10th grade.",
      status: "complete"
    },
    {
      section: "mental",
      content: "Trauma-focused outpatient therapy at Children's Hospital Colorado 2016 to 2019. Never psychiatrically hospitalized. No current medications.",
      status: "complete"
    },
    {
      section: "legal",
      content: "2015-2018 dependency case. No juvenile delinquency prior to February 2026. Instant offense: aggravated robbery co-defendant with two adults.",
      status: "complete"
    }
  ],
  documents: [
    {
      subfolder: "_Inbox",
      filename: "Juvenile_Defender_Referral.txt",
      documentType: "other",
      content: REFERRAL,
      description: "Juvenile Defense Coalition referral letter"
    },
    {
      subfolder: "Collateral",
      filename: "Court_Order_CST_and_Developmental.txt",
      documentType: "other",
      content: COURT_ORDER,
      description: "Court order for integrated CST and developmental evaluation"
    },
    {
      subfolder: "_Inbox",
      filename: "Records_Request_Log.txt",
      documentType: "other",
      content: RECORDS_REQUEST,
      description: "Log of 5 records requests in progress"
    },
    {
      subfolder: "_Inbox",
      filename: "Initial_Contact_Note.txt",
      documentType: "other",
      content: INITIAL_CONTACT,
      description: "Initial contact with defense counsel and planning"
    }
  ]
};
const CASE_NUMBER = "2026-0502";
const EXAMINEE = "Hartwick-Paradeza, Lenora J.";
const DOB = "2018-08-12";
const COURT = "Larimer County District Court (Family)";
const ORDER = `${SYNTHETIC_BANNER}

LARIMER COUNTY DISTRICT COURT
Case Number: ${CASE_NUMBER}-DR
Division: Family Court
Judge: Hon. Imelda Arlequín-Briggs

IN RE THE MARRIAGE OF:
Adeline Voss Hartwick (Petitioner/Relocating Parent)
and
Beckett L. Paradeza (Respondent/Non-Relocating Parent)
Minor child: Lenora J. Hartwick-Paradeza (age 7, DOB 08/12/2018)

ORDER FOR RELOCATION EVALUATION

The Petitioner has filed a Motion to Relocate seeking to move with the minor child from Fort Collins, Colorado to Flagstaff, Arizona. The Respondent opposes the motion. Under C.R.S. 14-10-129, the Court must consider the Spahmer v. Gullette factors and the best interests of the child.

IT IS HEREBY ORDERED that a relocation-focused parenting evaluation shall be conducted by Jordan Whitfield, Psy.D., ABPP of Pike Forensics. The evaluation shall address all statutory factors including:
1. Reasons for the proposed relocation
2. Reasons for the non-relocating parent's opposition
3. Quality of the child's relationship with each parent
4. Educational opportunities in both locations
5. Presence of extended family in both locations
6. Advantages and disadvantages of relocation to the child
7. Any other relevant factors

Written report to be filed no later than April 15, 2026.

BY THE COURT:
Imelda Arlequín-Briggs
District Court Judge
Dated: February 10, 2026
`;
const MOTHER_INTERVIEW = `${SYNTHETIC_BANNER}

PARENTING EVALUATION INTERVIEW NOTES
Parent: Adeline Voss Hartwick (mother, relocating)
Date: March 3, 2026
Duration: 110 minutes
Examiner: Jordan Whitfield, Psy.D., ABPP

Ms. Voss Hartwick is a 36-year-old woman who has lived in Colorado since 2011. She works as a curriculum designer for an educational technology company. Her employer has offered her a promotion to Senior Curriculum Director, a position that requires relocation to the company's operations hub in Flagstaff, Arizona. The promotion represents a 38% salary increase and a significant career advancement. She has accepted the offer contingent on court approval of the relocation.

Her proposed plan: relocate with Lenora to Flagstaff in June 2026. She proposes that Mr. Paradeza continue to have substantial parenting time through video calls three times per week, an extended summer visit (6 weeks), all of winter break, and spring break in alternating years. She has offered to split travel costs 50/50.

Supporting factors: her sister and mother live in Sedona, Arizona (45 minutes from Flagstaff). Lenora has visited twice and has a close relationship with her maternal grandmother. Flagstaff has strong public schools and Ms. Voss Hartwick has already identified an elementary school with a well-regarded gifted program.

Concerns: Ms. Voss Hartwick acknowledges that relocation will reduce face-to-face time with Mr. Paradeza and that this is a real loss for Lenora. She emphasizes she is not seeking to limit his involvement and has proposed generous parenting time.

She denied any motivation to limit the father's contact. She described Mr. Paradeza as a loving and involved father. She is not in a new romantic relationship. She described the decision as "career opportunity that is genuinely rare."
`;
const FATHER_INTERVIEW = `${SYNTHETIC_BANNER}

PARENTING EVALUATION INTERVIEW NOTES
Parent: Beckett L. Paradeza (father, non-relocating)
Date: March 6, 2026
Duration: 110 minutes
Examiner: Jordan Whitfield, Psy.D., ABPP

Mr. Paradeza is a 39-year-old man who owns a small landscape architecture firm in Fort Collins. He has lived in Colorado his entire life. His firm has 6 employees and is rooted in the Northern Colorado region. He cannot practically relocate his business.

He opposes the relocation. His reasons: Lenora has lived in Fort Collins her entire life, attends Traut Core Knowledge School where she has strong friendships and is doing well academically, participates in a local children's theater program she loves, and has a close relationship with both her father's parents who live in Loveland.

He acknowledges the career significance for Ms. Voss Hartwick and says he "would not stand in her way if it were only about her." His concern is the impact on his daughter. He proposes that Ms. Voss Hartwick could consider remote work arrangements, which he has asked her to pursue. Ms. Voss Hartwick has told him that the Senior Curriculum Director role specifically requires in-person leadership.

Mr. Paradeza expressed openness to relocating to Arizona himself if it would keep the family close, but acknowledged this is not practical for his business.

He described Ms. Voss Hartwick as a good mother and did not make disparaging comments about her. He expressed frustration with the situation but not with her specifically.
`;
const CHILD_INTERVIEW = `${SYNTHETIC_BANNER}

CHILD INTERVIEW AND OBSERVATION NOTES
Child: Lenora Hartwick-Paradeza (age 7)
Date: March 13, 2026
Duration: 50 minutes
Examiner: Jordan Whitfield, Psy.D., ABPP

Lenora was brought by both parents, who remained in the waiting room. She was initially shy but warmed quickly. She is a verbal, articulate, typically-developing child with age-appropriate social reciprocity and a bright affect.

School: "I like my school. My teacher is Ms. Pemberton. My best friend is Zoe and my other best friend is Aisling." She described the theater program with animation ("I was a sunflower in the spring show!").

Family: "My mommy is going to get a new job and she wants us to move to Arizona where my grandma and my aunt live. I don't know if I want to yet." When asked what she would miss most, she named Zoe, her theater program, and her father. When asked what she was excited about, she named her grandmother and the pool at her grandmother's house.

When asked directly how she felt about the move: "A little scared. Mommy says we can still see Daddy a lot. Daddy says it's far and I'll be sad." She did not express distress, did not disparage either parent, and did not show evidence of coaching.

She asked several times during the conversation whether her father would be "mad at her" for talking to me. I reassured her that her father had specifically asked her to come and talk with me. She relaxed visibly.

Clinical impression: Lenora is an attached, well-adjusted child with a strong relationship with both parents. She shows age-appropriate ambivalence about the proposed relocation. She is not demonstrating distress that exceeds the developmental norm for a 7-year-old facing a major life change.
`;
const FINAL_REPORT = `${reportHeader(
  CASE_NUMBER,
  EXAMINEE,
  DOB,
  "Relocation Parenting Evaluation",
  COURT
)}REFERRAL QUESTION

The Court requested a relocation-focused parenting evaluation addressing the statutory factors in C.R.S. 14-10-129 and the best interests of Lenora Hartwick-Paradeza (age 7) in the context of her mother's proposed relocation from Fort Collins, Colorado to Flagstaff, Arizona.

PROCEDURES

I reviewed the pleadings, the parents' proposed parenting plans, school records from Traut Core Knowledge School, and correspondence between counsel. I interviewed Ms. Voss Hartwick (110 minutes, March 3, 2026) and Mr. Paradeza (110 minutes, March 6, 2026) separately. I conducted a 50-minute interview and observation of Lenora at my office (March 13, 2026). I completed collateral telephone interviews with Lenora's teacher Idalia Pemberton, her pediatrician Vasanti Tiruvallur, MD, her theater instructor Mercy Dagbovie-Kamara, and her maternal grandmother Eleonore Voss. I conducted a home visit at Ms. Voss Hartwick's home on March 20, 2026 and at Mr. Paradeza's home on March 22, 2026.

BACKGROUND

Ms. Voss Hartwick and Mr. Paradeza were married in 2016 and separated in 2023. They share joint legal custody with a 60/40 parenting time split favoring Ms. Voss Hartwick. The current arrangement has worked well since the divorce in 2024.

In January 2026 Ms. Voss Hartwick's employer offered her a promotion to Senior Curriculum Director that requires relocation to Flagstaff, Arizona. The promotion represents a significant career advancement and a 38% salary increase. She accepted contingent on court approval.

Mr. Paradeza opposes the relocation on the grounds that it would reduce his parenting time and remove Lenora from her school, friends, theater program, and paternal grandparents.

STATUTORY FACTORS (C.R.S. 14-10-129)

1. Reasons for the proposed relocation: Genuine and legitimate career opportunity. Not motivated by a desire to frustrate the father's parenting time.

2. Reasons for opposition: Genuine concern for the child's attachments, stability, and relationship with her father. Not motivated by ill will toward the mother.

3. Quality of the child's relationship with each parent: Lenora has strong, close relationships with both parents. There is no evidence of attachment disruption with either parent.

4. Educational opportunities: Lenora's current school (Traut Core Knowledge) is high-performing. The proposed Flagstaff school (Sechrist Elementary) has a strong gifted program and is comparable in quality.

5. Extended family: Paternal grandparents in Loveland (active weekly contact). Maternal grandmother and maternal aunt in Sedona, Arizona (45 minutes from Flagstaff). Both sets of extended family are meaningful presences.

6. Advantages and disadvantages to the child: Advantages include proximity to maternal extended family, enhanced financial stability through the mother's career advancement, and a strong school option. Disadvantages include loss of daily relationship with father, loss of current school community, loss of the theater program Lenora loves, and reduced contact with paternal grandparents.

7. Other factors: Lenora expressed age-appropriate ambivalence. She is a resilient, well-adjusted child who will likely adapt to either outcome but will experience real loss regardless of the decision.

SUMMARY FORMULATION

Both parents are loving, capable, and committed. The mother's career opportunity is real and significant. The father's concerns are legitimate. Lenora will experience loss under either outcome. She is a resilient child with secure attachments who is more likely to adapt well than poorly to a thoughtful transition.

RECOMMENDATIONS

Rather than a single recommendation for or against relocation, I am offering the Court my analysis of what would best serve Lenora under each potential outcome:

IF RELOCATION IS GRANTED:
1. The proposed parenting time plan (video three times weekly, 6-week summer, all winter break, spring break alternating) should be the minimum baseline, with the Court encouraging the parties to add a long weekend visit once per quarter.
2. The mother should commit to facilitating the video contact proactively rather than relying on Lenora to initiate.
3. A specific plan for maintaining Lenora's relationship with her paternal grandparents should be agreed upon before the move.
4. Co-parenting counseling for at least six months during the transition.

IF RELOCATION IS DENIED:
1. The current 60/40 schedule should continue.
2. The parents should explore with Ms. Voss Hartwick's employer whether any flexibility exists for remote work arrangements that could support the career advancement without relocation.
3. The Court may wish to revisit the issue if circumstances change.

The Court is in a better position than I am to weigh the statutory factors and make the ultimate decision.

DRAFT STATUS

This report is in REVIEW stage. Attestation and signature pending a final co-parent review call scheduled for April 10, 2026.
${clinicianSignature()}`;
const CASE_10_HARTWICK = {
  caseNumber: CASE_NUMBER,
  createdAt: "2026-02-10",
  lastModified: "2026-04-08",
  firstName: "Lenora",
  lastName: "Hartwick-Paradeza",
  dob: DOB,
  gender: "F",
  evaluationType: "Custody",
  referralSource: "Larimer County District Court (Family)",
  evaluationQuestions: "C.R.S. 14-10-129 relocation factors; best interests of 7yo in proposed move from Fort Collins to Flagstaff.",
  stage: "review",
  caseStatus: "in_progress",
  notes: "Report in review. Final co-parent review call April 10, 2026. Attestation pending.",
  complexity: "moderate",
  summary: "7yo child, mother proposing relocation to AZ for career, father opposes. Both parents capable; scenario-dependent recommendations.",
  diagnoses: [],
  intake: {
    referral_type: "court",
    referral_source: "Hon. Imelda Arlequín-Briggs, Larimer County District Court",
    eval_type: "Custody",
    presenting_complaint: "Relocation evaluation per C.R.S. 14-10-129 for a 7yo child.",
    jurisdiction: "Larimer County",
    charges: null,
    attorney_name: "Isidore Kvartsynenko (for mother), Tabitha Oluwatoyin (for father)",
    report_deadline: "2026-04-15",
    status: "complete"
  },
  onboarding: [
    {
      section: "contact",
      content: "Petitioner Adeline Voss Hartwick (Fort Collins). Respondent Beckett Paradeza (Fort Collins). Minor child Lenora, 7.",
      status: "complete"
    },
    {
      section: "family",
      content: "Parents married 2016, separated 2023, divorced 2024. Current schedule 60/40 favoring mother. Maternal grandmother and aunt in Sedona, AZ. Paternal grandparents in Loveland, CO.",
      status: "complete"
    },
    {
      section: "education",
      content: "Lenora attends Traut Core Knowledge School, performing well. Active in children's theater program.",
      status: "complete"
    },
    {
      section: "recent",
      content: "Mother received promotion offer January 2026 requiring relocation to Flagstaff. Filed Motion to Relocate February 2026.",
      status: "complete"
    }
  ],
  documents: [
    {
      subfolder: "Collateral",
      filename: "Court_Order_Relocation_Eval.txt",
      documentType: "other",
      content: ORDER,
      description: "Court order for relocation evaluation"
    },
    {
      subfolder: "Interviews",
      filename: "Mother_Interview_VossHartwick.txt",
      documentType: "other",
      content: MOTHER_INTERVIEW,
      description: "Mother (relocating parent) interview notes"
    },
    {
      subfolder: "Interviews",
      filename: "Father_Interview_Paradeza.txt",
      documentType: "other",
      content: FATHER_INTERVIEW,
      description: "Father (non-relocating parent) interview notes"
    },
    {
      subfolder: "Interviews",
      filename: "Child_Interview_Lenora.txt",
      documentType: "other",
      content: CHILD_INTERVIEW,
      description: "Child interview and observation notes"
    },
    {
      subfolder: "Reports",
      filename: "DRAFT_Relocation_Evaluation_Report.txt",
      documentType: "other",
      content: FINAL_REPORT,
      description: "Draft relocation evaluation report, pending attestation"
    }
  ]
};
const REALISTIC_CASES = [
  CASE_01_MARTENSEN,
  CASE_02_PIZARRO,
  CASE_03_WILLOUGHBY,
  CASE_04_SZCZERBA,
  CASE_05_BREMNER,
  CASE_06_BHATTACHARYA,
  CASE_07_MCILHENNY,
  CASE_08_BALDERAS,
  CASE_09_LOCKRIDGE,
  CASE_10_HARTWICK
];
const CASE_SUBFOLDERS = [
  "_Inbox",
  "Collateral",
  "Testing",
  "Interviews",
  "Diagnostics",
  "Reports",
  "Archive"
];
const SUBFOLDER_UPLOAD_OFFSET_DAYS = {
  _Inbox: 0,
  Collateral: 2,
  Testing: 14,
  Interviews: 21,
  Diagnostics: 35,
  Reports: 45,
  Archive: 50
};
function addDays(isoDate, days) {
  const d = /* @__PURE__ */ new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function minIsoDate(a, b) {
  return a <= b ? a : b;
}
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
function scaffoldCaseFolder(caseFolderPath) {
  ensureDir(caseFolderPath);
  for (const sub of CASE_SUBFOLDERS) {
    ensureDir(path.join(caseFolderPath, sub));
  }
}
function upsertCase(record, folderPath, clinicianUserId) {
  const sqlite = getSqlite();
  const existing = sqlite.prepare("SELECT case_id FROM cases WHERE case_number = ?").get(record.caseNumber);
  if (existing !== void 0) {
    sqlite.prepare(
      `UPDATE cases SET
        primary_clinician_user_id = ?,
        examinee_first_name = ?,
        examinee_last_name = ?,
        examinee_dob = ?,
        examinee_gender = ?,
        evaluation_type = ?,
        referral_source = ?,
        evaluation_questions = ?,
        case_status = ?,
        workflow_current_stage = ?,
        folder_path = ?,
        notes = ?,
        created_at = ?,
        last_modified = ?
      WHERE case_id = ?`
    ).run(
      clinicianUserId,
      record.firstName,
      record.lastName,
      record.dob,
      record.gender,
      record.evaluationType,
      record.referralSource,
      record.evaluationQuestions,
      record.caseStatus,
      record.stage,
      folderPath,
      record.notes,
      record.createdAt,
      record.lastModified,
      existing.case_id
    );
    return existing.case_id;
  }
  const insert = sqlite.prepare(
    `INSERT INTO cases (
      case_number, primary_clinician_user_id,
      examinee_first_name, examinee_last_name, examinee_dob, examinee_gender,
      evaluation_type, referral_source, evaluation_questions,
      case_status, workflow_current_stage, folder_path, notes,
      created_at, last_modified
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const result = insert.run(
    record.caseNumber,
    clinicianUserId,
    record.firstName,
    record.lastName,
    record.dob,
    record.gender,
    record.evaluationType,
    record.referralSource,
    record.evaluationQuestions,
    record.caseStatus,
    record.stage,
    folderPath,
    record.notes,
    record.createdAt,
    record.lastModified
  );
  return Number(result.lastInsertRowid);
}
function upsertIntake(caseId, record) {
  const sqlite = getSqlite();
  sqlite.prepare(
    `INSERT INTO patient_intake (
      case_id, referral_type, referral_source, eval_type,
      presenting_complaint, jurisdiction, charges,
      attorney_name, report_deadline, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(case_id) DO UPDATE SET
      referral_type = excluded.referral_type,
      referral_source = excluded.referral_source,
      eval_type = excluded.eval_type,
      presenting_complaint = excluded.presenting_complaint,
      jurisdiction = excluded.jurisdiction,
      charges = excluded.charges,
      attorney_name = excluded.attorney_name,
      report_deadline = excluded.report_deadline,
      status = excluded.status`
  ).run(
    caseId,
    record.intake.referral_type,
    record.intake.referral_source,
    record.intake.eval_type,
    record.intake.presenting_complaint,
    record.intake.jurisdiction,
    record.intake.charges,
    record.intake.attorney_name,
    record.intake.report_deadline,
    record.intake.status
  );
}
function upsertOnboarding(caseId, record) {
  const sqlite = getSqlite();
  const stmt = sqlite.prepare(
    `INSERT INTO patient_onboarding (
      case_id, section, content, clinician_notes, verified, status
    ) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(case_id, section) DO UPDATE SET
      content = excluded.content,
      clinician_notes = excluded.clinician_notes,
      verified = excluded.verified,
      status = excluded.status`
  );
  for (const entry of record.onboarding) {
    stmt.run(
      caseId,
      entry.section,
      entry.content,
      entry.clinician_notes ?? null,
      entry.status === "complete" ? 1 : 0,
      entry.status
    );
  }
}
function writeDocument(caseId, caseFolder, doc, clinicianUserId, overwrite, caseCreatedAt, caseLastModified) {
  const sqlite = getSqlite();
  const destDir = path.join(caseFolder, doc.subfolder);
  ensureDir(destDir);
  const destPath = path.join(destDir, doc.filename);
  const offset = SUBFOLDER_UPLOAD_OFFSET_DAYS[doc.subfolder];
  const uploadDate = minIsoDate(addDays(caseCreatedAt, offset), caseLastModified);
  if (fs.existsSync(destPath) && !overwrite) {
    const existing = sqlite.prepare("SELECT document_id FROM documents WHERE case_id = ? AND file_path = ?").get(caseId, destPath);
    if (existing === void 0) {
      insertDocumentRow(caseId, destPath, doc, clinicianUserId, uploadDate);
    }
    return { written: false, skipped: true };
  }
  fs.writeFileSync(destPath, doc.content, "utf-8");
  insertDocumentRow(caseId, destPath, doc, clinicianUserId, uploadDate);
  return { written: true, skipped: false };
}
function insertDocumentRow(caseId, destPath, doc, clinicianUserId, uploadDate) {
  const sqlite = getSqlite();
  let size = 0;
  try {
    size = fs.statSync(destPath).size;
  } catch {
    size = Buffer.byteLength(doc.content, "utf-8");
  }
  const mime = doc.documentType === "pdf" ? "application/pdf" : doc.documentType === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "text/plain";
  sqlite.prepare("DELETE FROM documents WHERE case_id = ? AND file_path = ?").run(caseId, destPath);
  sqlite.prepare(
    `INSERT INTO documents (
      case_id, document_type, original_filename, file_path,
      file_size_bytes, mime_type, uploaded_by_user_id,
      description, indexed_content, upload_date
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    caseId,
    doc.documentType,
    doc.filename,
    destPath,
    size,
    mime,
    clinicianUserId,
    doc.description,
    doc.content,
    uploadDate
  );
}
function seedRealisticCases(options) {
  const { projectRoot } = options;
  const clinicianUserId = options.clinicianUserId ?? 1;
  const overwrite = options.overwrite === true;
  const sqlite = getSqlite();
  const casesRoot = path.join(projectRoot, "cases");
  ensureDir(casesRoot);
  sqlite.prepare(
    `INSERT OR IGNORE INTO users (user_id, email, full_name, role, is_active, created_at)
       VALUES (1, 'clinician@pikeforensics.example', 'Dr. Jordan Whitfield', 'psychologist', 1, date('now'))`
  ).run();
  const results = [];
  for (const record of REALISTIC_CASES) {
    const folderName = `${record.caseNumber} ${record.lastName}, ${record.firstName}`;
    const folderPath = path.join(casesRoot, folderName);
    scaffoldCaseFolder(folderPath);
    const caseId = upsertCase(record, folderPath, clinicianUserId);
    upsertIntake(caseId, record);
    upsertOnboarding(caseId, record);
    let written = 0;
    let skipped = 0;
    for (const doc of record.documents) {
      const outcome = writeDocument(
        caseId,
        folderPath,
        doc,
        clinicianUserId,
        overwrite,
        record.createdAt,
        record.lastModified
      );
      if (outcome.written) written += 1;
      if (outcome.skipped) skipped += 1;
    }
    results.push({
      caseNumber: record.caseNumber,
      caseId,
      documentsWritten: written,
      documentsSkipped: skipped,
      stage: record.stage
    });
  }
  return results;
}
for (const stream of [process.stdout, process.stderr]) {
  stream?.on?.("error", (err) => {
    if (err.code === "EPIPE" || err.code === "ERR_STREAM_DESTROYED") return;
    throw err;
  });
}
electron.protocol.registerSchemesAsPrivileged([
  { scheme: "local-file", privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }
]);
electron.app.disableHardwareAcceleration();
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
  const isDev = !!process.env["ELECTRON_RENDERER_URL"] || process.env.NODE_ENV === "development";
  const win = new electron.BrowserWindow({
    width: 1440,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
      // Required for inline PDF rendering via <webview>
      sandbox: !isDev
      // sandbox=true in production only; dev needs GPU access
    }
  });
  const csp = isDev ? "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ws: http://localhost:* https://api.anthropic.com; frame-src 'self' blob: data: local-file: http://localhost:9980; object-src 'self' blob: local-file:; base-uri 'self'; form-action 'none'" : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https://api.anthropic.com http://localhost:9980 ws://localhost:9980; frame-src 'self' blob: data: local-file: http://localhost:9980; object-src 'self' blob: local-file:; base-uri 'self'; form-action 'none'; frame-ancestors 'none'";
  win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [csp]
      }
    });
  });
  win.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    const levelTag = level === 0 ? "LOG" : level === 1 ? "WARN" : level === 2 ? "ERR " : "INFO";
    console.log(`[renderer ${levelTag}] ${message}  (${sourceId}:${line})`);
  });
  win.webContents.on("did-fail-load", (_event, code, description, url2) => {
    console.error(`[renderer FAIL-LOAD] ${code} ${description} url=${url2}`);
  });
  win.webContents.on("render-process-gone", (_event, details) => {
    console.error(`[renderer GONE] reason=${details.reason} exitCode=${details.exitCode}`);
  });
  win.webContents.on("unresponsive", () => {
    console.error("[renderer UNRESPONSIVE]");
  });
  win.webContents.on("preload-error", (_event, preloadPath, error) => {
    console.error(`[renderer PRELOAD-ERROR] ${preloadPath}: ${error.message}`);
  });
  if (process.env["PSYGIL_DEVTOOLS"] === "1") {
    win.webContents.openDevTools({ mode: "detach" });
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
  electron.protocol.handle("local-file", (request) => {
    const filePath = decodeURIComponent(request.url.replace("local-file://", ""));
    return electron.net.fetch(url.pathToFileURL(filePath).toString());
  });
  try {
    await initDb();
  } catch (err) {
    console.error("[main] DB init failed:", err);
  }
  try {
    registerAllHandlers();
  } catch (err) {
    console.error("[main] Handler registration failed:", err);
  }
  try {
    if (shouldSeedDemoCases()) {
      console.log("[main] Demo seed trigger detected, seeding 42 cases...");
      seedDemoCases();
    } else {
      console.log("[main] No demo seed trigger, skipping demo seed.");
    }
  } catch (err) {
    console.error("[main] Demo seed failed (non-fatal):", err);
  }
  try {
    if (process.env["PSYGIL_SEED_REALISTIC"] === "1") {
      const wsPath = loadWorkspacePath();
      if (wsPath !== null) {
        const overwrite = process.env["PSYGIL_SEED_OVERWRITE"] === "1";
        console.log(
          `[main] PSYGIL_SEED_REALISTIC=1, seeding 10 realistic cases into ${wsPath} (overwrite=${String(overwrite)})`
        );
        const results = seedRealisticCases({ projectRoot: wsPath, overwrite });
        for (const r of results) {
          console.log(
            `  ${r.caseNumber.padEnd(18)} stage=${r.stage.padEnd(12)} docs=${r.documentsWritten} skipped=${r.documentsSkipped}`
          );
        }
        console.log(`[main] Realistic case seeding complete: ${results.length} cases.`);
      } else {
        console.warn("[main] PSYGIL_SEED_REALISTIC set but no workspace path configured.");
      }
    }
  } catch (err) {
    console.error("[main] Realistic case seeding failed:", err);
  }
  try {
    const wsPath = loadWorkspacePath();
    if (wsPath !== null) {
      syncWorkspaceToDB(wsPath);
      watchWorkspace(wsPath);
    }
  } catch (err) {
    console.error("[main] Workspace sync failed:", err);
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
exports.getDefaultDbPath = getDefaultDbPath;
exports.initDatabase = initDatabase;
