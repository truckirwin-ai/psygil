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
    return path.join(app.getPath("userData"), "psygil.db");
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
    // placeholder — real logic runs in runMigrations below
  },
  {
    id: "007_six_stage_pipeline",
    description: "Migrate workflow_current_stage from gate system to 6-stage pipeline",
    sql: "SELECT 1"
    // placeholder — real logic runs in runMigrations below
  },
  {
    id: "008_expand_intake_referral_types",
    description: "Add insurance and physician referral types to patient_intake",
    sql: "SELECT 1"
    // placeholder — recreates table with expanded CHECK
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
    const { runBaseMigration } = await Promise.resolve().then(() => require("./migrate-rC5PboBP.js"));
    runBaseMigration(result.sqlite);
  }
  runMigrations(result.sqlite);
  try {
    const { ensureViewsAndTriggers } = await Promise.resolve().then(() => require("./migrate-rC5PboBP.js"));
    ensureViewsAndTriggers(result.sqlite);
  } catch {
    console.warn("[db] Failed to ensure views/triggers (non-fatal)");
  }
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
const STAGE_ORDER$1 = ["onboarding", "testing", "interview", "diagnostics", "review", "complete"];
const SUBFOLDER_TO_STAGE = {
  "_Inbox": "onboarding",
  "Collateral": "onboarding",
  "Testing": "testing",
  "Interviews": "interview",
  "Diagnostics": "diagnostics",
  "Reports": "review"
  // draft reports = review stage
  // 'Archive' doesn't map to a stage — it's housekeeping
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
  let entries;
  try {
    entries = fs.readdirSync(wsPath);
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
    const fullPath = path.join(wsPath, entry);
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
    console.log(`[workspace-sync] ${caseNumber} folder deleted — removed from DB`);
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
  for (const sub of CASE_SUBFOLDERS) {
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
    console.log("[watcher] Ready — watching for changes");
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
    throw new Error("No workspace path configured — set workspace before creating cases");
  }
  const folderName = `${params.case_number} ${params.examinee_last_name}, ${params.examinee_first_name}`;
  const folderPath = path.join(wsPath, folderName);
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
function listCases() {
  const sqlite = getSqlite();
  const cols = sqlite.pragma("table_info(cases)").map((c) => c.name);
  const hasDeletedAt = cols.includes("deleted_at");
  const query = hasDeletedAt ? "SELECT * FROM cases WHERE deleted_at IS NULL AND case_status != ? ORDER BY created_at DESC" : "SELECT * FROM cases WHERE case_status != ? ORDER BY created_at DESC";
  const rows = sqlite.prepare(query).all("archived");
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
      const pdfModule = await import("pdf-parse");
      const pdfParse = pdfModule.default ?? pdfModule;
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
function ok$4(data) {
  return { status: "success", data };
}
function fail$4(error_code, message) {
  return { status: "error", error_code, message };
}
function registerAiHandlers() {
  electron.ipcMain.handle(
    "ai:complete",
    async (_event, params) => {
      try {
        if (!params.systemPrompt || !params.userMessage) {
          return fail$4("INVALID_REQUEST", "systemPrompt and userMessage are required");
        }
        const apiKey = retrieveApiKey();
        if (!apiKey) {
          return fail$4("NO_API_KEY", "Claude API key not configured");
        }
        const response = await callClaude(apiKey, {
          systemPrompt: params.systemPrompt,
          userMessage: params.userMessage,
          model: params.model,
          maxTokens: params.maxTokens
        });
        return ok$4(response);
      } catch (e) {
        const message = e instanceof Error ? e.message : "AI completion failed";
        console.error("[ai:complete] error:", message);
        if (message.includes("Invalid API key")) {
          return fail$4("AUTHENTICATION_FAILED", "Invalid Claude API key");
        }
        if (message.includes("Rate limited")) {
          return fail$4("RATE_LIMITED", message);
        }
        if (message.includes("temporarily unavailable")) {
          return fail$4("SERVICE_UNAVAILABLE", "Claude API temporarily unavailable");
        }
        if (message.includes("Cannot reach")) {
          return fail$4("NETWORK_ERROR", "Cannot reach Claude API");
        }
        return fail$4("AI_ERROR", message);
      }
    }
  );
  electron.ipcMain.handle(
    "ai:testConnection",
    async (_event, _params) => {
      try {
        const apiKey = retrieveApiKey();
        if (!apiKey) {
          return ok$4({
            connected: false,
            error: "Claude API key not configured"
          });
        }
        const response = await callClaude(apiKey, {
          systemPrompt: "You are a helpful assistant.",
          userMessage: 'Say "ok".',
          maxTokens: 10
        });
        return ok$4({
          connected: true,
          model: response.model
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Connection test failed";
        console.error("[ai:testConnection] error:", message);
        return ok$4({
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
    try {
      parsedResult = JSON.parse(fullText);
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
const DIAGNOSTICIAN_SYSTEM_PROMPT = `You are the Diagnostician Agent for Psygil, an AI assistant for forensic and clinical psychologists. Your role is to organize evidence against diagnostic criteria and psycho-legal standards. You present options—you do not diagnose.

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
     * insufficient_data: Boolean—true if this criterion cannot be assessed with available data
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
3. Every diagnosis entry has status: "evidence_presented" — NEVER "confirmed," "ruled_out," or "recommended"
4. The entire output is framed as evidence organization: "Evidence supporting MDD includes..." NOT "The patient has MDD."
5. Differential comparisons present both sides fairly—no steering toward one diagnosis
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
- Avoid hedging language unless genuinely uncertain ("possibly," "apparently," "may indicate" — use judiciously)
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
9. If clinician's Gate 2 decision conflicts with diagnostic evidence, DO NOT resolve—present clinician's decision and let clinician justify in later revision

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
      style_guide: {
        tone: "formal",
        formality_level: "professional",
        citation_style: "inline"
      },
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
    return JSON.parse(row.result_json);
  } catch {
    return null;
  }
}
const EDITOR_SYSTEM_PROMPT = `You are the Editor/Legal Reviewer Agent for Psygil, an AI tool for forensic and clinical psychologists. Your role is to review draft reports with a critical eye—flagging vulnerabilities, inconsistencies, and quality issues that could undermine credibility or legal defensibility.

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
function ok$3(data) {
  return { status: "success", data };
}
function fail$3(error_code, message) {
  return { status: "error", error_code, message };
}
async function handleAgentRun(_event, params) {
  try {
    if (!isValidAgentType(params.agentType)) {
      return fail$3("INVALID_AGENT_TYPE", `Invalid agent type: ${params.agentType}`);
    }
    if (!Number.isInteger(params.caseId) || params.caseId <= 0) {
      return fail$3("INVALID_CASE_ID", `Invalid case ID: ${params.caseId}`);
    }
    if (!Array.isArray(params.inputTexts) || params.inputTexts.length === 0) {
      return fail$3("INVALID_INPUT", "inputTexts must be a non-empty array");
    }
    const apiKey = retrieveApiKey();
    if (!apiKey) {
      return fail$3("NO_API_KEY", "Anthropic API key not configured");
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
    return ok$3({
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
    return fail$3("AGENT_RUN_FAILED", message);
  }
}
function handleAgentStatus(_event, operationId) {
  try {
    if (operationId) {
      const status2 = getStatus(operationId);
      if (!status2) {
        return fail$3("OPERATION_NOT_FOUND", `Operation ${operationId} not found`);
      }
      return ok$3({
        operationId: status2.operationId,
        agentType: status2.agentType,
        caseId: status2.caseId,
        status: status2.status,
        elapsedMs: Date.now() - status2.startedAt,
        tokenUsage: status2.tokenUsage
      });
    }
    if (!currentOperation) {
      return ok$3({
        operationId: null,
        agentType: null,
        caseId: null,
        status: "idle",
        elapsedMs: 0
      });
    }
    const status = getStatus(currentOperation);
    if (!status) {
      return ok$3({
        operationId: null,
        agentType: null,
        caseId: null,
        status: "idle",
        elapsedMs: 0
      });
    }
    return ok$3({
      operationId: status.operationId,
      agentType: status.agentType,
      caseId: status.caseId,
      status: status.status,
      elapsedMs: Date.now() - status.startedAt,
      tokenUsage: status.tokenUsage
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to get agent status";
    return fail$3("AGENT_STATUS_FAILED", message);
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
        return ok$3({
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
        return fail$3("INGESTOR_RUN_FAILED", message);
      }
    }
  );
  electron.ipcMain.handle(
    "ingestor:getResult",
    (_event, params) => {
      try {
        const result = getLatestIngestorResult(params.caseId);
        if (!result) {
          return fail$3("NO_RESULT", "No ingestor result found for this case");
        }
        return ok$3(result);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to get ingestor result";
        return fail$3("INGESTOR_GET_FAILED", message);
      }
    }
  );
  electron.ipcMain.handle(
    "diagnostician:run",
    async (_event, params) => {
      try {
        const result = await runDiagnosticianAgent(params.caseId);
        return ok$3({
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
        return fail$3("DIAGNOSTICIAN_RUN_FAILED", message);
      }
    }
  );
  electron.ipcMain.handle(
    "diagnostician:getResult",
    (_event, params) => {
      try {
        const result = getLatestDiagnosticianResult$1(params.caseId);
        if (!result) {
          return fail$3("NO_RESULT", "No diagnostician result found for this case");
        }
        return ok$3(result);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to get diagnostician result";
        return fail$3("DIAGNOSTICIAN_GET_FAILED", message);
      }
    }
  );
  electron.ipcMain.handle(
    "writer:run",
    async (_event, params) => {
      try {
        const result = await runWriterAgent(params.caseId);
        return ok$3({
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
        return fail$3("WRITER_RUN_FAILED", message);
      }
    }
  );
  electron.ipcMain.handle(
    "writer:getResult",
    (_event, params) => {
      try {
        const result = getLatestWriterResult$1(params.caseId);
        if (!result) {
          return fail$3("NO_RESULT", "No writer result found for this case");
        }
        return ok$3(result);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to get writer result";
        return fail$3("WRITER_GET_FAILED", message);
      }
    }
  );
  electron.ipcMain.handle(
    "editor:run",
    async (_event, params) => {
      try {
        const result = await runEditorAgent(params.caseId);
        return ok$3({
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
        return fail$3("EDITOR_RUN_FAILED", message);
      }
    }
  );
  electron.ipcMain.handle(
    "editor:getResult",
    (_event, params) => {
      try {
        const result = getLatestEditorResult(params.caseId);
        if (!result) {
          return fail$3("NO_RESULT", "No editor result found for this case");
        }
        return ok$3(result);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to get editor result";
        return fail$3("EDITOR_GET_FAILED", message);
      }
    }
  );
}
function ensureTable$1() {
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
  ensureTable$1();
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
  ensureTable$1();
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
  ensureTable$1();
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
      return { canAdvance: false, reason: "Data confirmation incomplete — review extracted data before advancing" };
    }
    return { canAdvance: true, reason: "Intake complete, documents uploaded, and data confirmed" };
  },
  testing: (caseRow) => {
    const documents2 = listDocuments(caseRow.case_id);
    const testingDocs = documents2.filter(
      (d) => d.document_type === "test_score_report" || d.document_type === "test_battery" || d.document_type === "standardized_test"
    );
    if (testingDocs.length === 0) {
      return { canAdvance: false, reason: "No test result documents found" };
    }
    return { canAdvance: true, reason: "Test results documented" };
  },
  interview: (caseRow) => {
    const documents2 = listDocuments(caseRow.case_id);
    const interviewDocs = documents2.filter(
      (d) => d.document_type === "interview_notes" || d.document_type === "transcript_vtt" || d.document_type === "behavioral_observation"
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
         WHERE case_id = ? AND action_type = 'report_signed'
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
  if (!STAGE_ORDER[currentStage]) {
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
      "Case is complete — no further advancement possible"
    ]
  };
  return conditions[stage] ?? [];
}
function ok$2(data) {
  return { status: "success", data };
}
function fail$2(error_code, message) {
  return { status: "error", error_code, message };
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
    return ok$2(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return fail$2("PIPELINE_CHECK_FAILED", `Failed to check stage advancement: ${message}`);
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
    return ok$2(advanceResult);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return fail$2("PIPELINE_ADVANCE_FAILED", `Failed to advance stage: ${message}`);
  }
}
function handlePipelineSetStage(_event, params) {
  try {
    const db = getSqlite();
    const row = db.prepare("SELECT workflow_current_stage FROM cases WHERE case_id = ?").get(params.caseId);
    if (!row) return fail$2("CASE_NOT_FOUND", `Case ${params.caseId} not found`);
    const previousStage = row.workflow_current_stage || "onboarding";
    const newStatus = params.stage === "complete" ? "completed" : "in_progress";
    db.prepare("UPDATE cases SET workflow_current_stage = ?, case_status = ?, last_modified = datetime('now') WHERE case_id = ?").run(params.stage, newStatus, params.caseId);
    console.log(`[pipeline] Stage set: case ${params.caseId} ${previousStage} → ${params.stage}`);
    return ok$2({ success: true, newStage: params.stage, previousStage });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return fail$2("PIPELINE_SET_STAGE_FAILED", `Failed to set stage: ${message}`);
  }
}
function handlePipelineConditions(_event, params) {
  try {
    const conditions = getStageConditions(params.stage);
    const result = {
      stage: params.stage,
      conditions
    };
    return ok$2(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return fail$2("PIPELINE_CONDITIONS_FAILED", `Failed to retrieve conditions: ${message}`);
  }
}
function registerPipelineHandlers() {
  electron.ipcMain.handle("pipeline:check", handlePipelineCheck);
  electron.ipcMain.handle("pipeline:advance", handlePipelineAdvance);
  electron.ipcMain.handle("pipeline:set-stage", handlePipelineSetStage);
  electron.ipcMain.handle("pipeline:conditions", handlePipelineConditions);
  console.log("[pipeline] IPC handlers registered: pipeline:check, pipeline:advance, pipeline:set-stage, pipeline:conditions");
}
function ensureTable() {
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
  ensureTable();
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
  ensureTable();
  const sqlite = getSqlite();
  return sqlite.prepare(`
    SELECT * FROM diagnostic_decisions
    WHERE case_id = ?
    ORDER BY decided_at ASC
  `).all(caseId);
}
function deleteDecision(caseId, diagnosisKey) {
  ensureTable();
  const sqlite = getSqlite();
  const result = sqlite.prepare(`
    DELETE FROM diagnostic_decisions
    WHERE case_id = ? AND diagnosis_key = ?
  `).run(caseId, diagnosisKey);
  return result.changes > 0;
}
function ok$1(data) {
  return { status: "success", data };
}
function fail$1(error_code, message) {
  return { status: "error", error_code, message };
}
function registerDecisionHandlers() {
  electron.ipcMain.handle(
    "diagnosticDecision:save",
    (_event, params) => {
      try {
        const row = saveDecision(params);
        return ok$1(row);
      } catch (e) {
        return fail$1("DECISION_SAVE_FAILED", e instanceof Error ? e.message : "Failed to save decision");
      }
    }
  );
  electron.ipcMain.handle(
    "diagnosticDecision:list",
    (_event, params) => {
      try {
        const rows = listDecisions(params.case_id);
        return ok$1(rows);
      } catch (e) {
        return fail$1("DECISION_LIST_FAILED", e instanceof Error ? e.message : "Failed to list decisions");
      }
    }
  );
  electron.ipcMain.handle(
    "diagnosticDecision:delete",
    (_event, params) => {
      try {
        deleteDecision(params.case_id, params.diagnosis_key);
        return ok$1(void 0);
      } catch (e) {
        return fail$1("DECISION_DELETE_FAILED", e instanceof Error ? e.message : "Failed to delete decision");
      }
    }
  );
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
                text: "⚠️ AI DRAFT — CLINICIAN REVIEW REQUIRED",
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
function submitAttestation(params) {
  const sqlite = getSqlite();
  const { caseId, signedBy, attestationStatement, signatureDate } = params;
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
             finalized_by_user_id = 0, finalized_at = ?, status = 'finalized',
             file_path = ?, file_size_bytes = ?
         WHERE report_id = ?`
    ).run(
      integrityHash,
      pdfPath ?? null,
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
         VALUES (?, 0, 1, ?, ?, 0, ?, 'finalized', ?, ?, 1)`
    ).run(
      caseId,
      integrityHash,
      pdfPath ?? null,
      (/* @__PURE__ */ new Date()).toISOString(),
      finalDocxPath,
      fileSizeBytes
    );
    reportId = result.lastInsertRowid ?? null;
  }
  logAuditEntry({
    caseId,
    actionType: "report_signed",
    actorType: "system",
    actorId: "0",
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
  const summary = `# Case Summary — ${caseRow.case_number}

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
        const { seedDemoCases: seedDemoCases2, createSeedTrigger: createSeedTrigger2 } = require("../seed-demo-cases");
        createSeedTrigger2();
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
        const { checkForUpdates } = await Promise.resolve().then(() => require("./index-IAEcCKD8.js"));
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
        const { downloadUpdate } = await Promise.resolve().then(() => require("./index-IAEcCKD8.js"));
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
        const url = await getDocumentServerUrl();
        return ok(url);
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
  registerSeedHandlers();
  registerApiKeyHandlers();
  registerDataConfirmationHandlers();
  registerAiHandlers();
  registerAgentHandlers();
  registerPipelineHandlers();
  registerDecisionHandlers();
  registerUpdaterHandlers();
  registerOnlyOfficeHandlers();
  registerReportHandlers();
  registerAuditHandlers();
  registerTestimonyHandlers();
}
const TRIGGER = path.join(electron.app.getPath("userData"), "seed-demo.trigger");
function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}
function createPlaceholder(dir, filename, content) {
  ensureDir(dir);
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
  { num: "PSY-2026-0226", last: "Thompson", first: "Kiara", dob: "1996-07-14", gender: "F", evalType: "Fitness", referral: "Court", stage: "interview", complaint: "Fitness to proceed — alleged intellectual disability", charges: "Theft (M1), Fraud (M2)", jurisdiction: "Boulder County", attorney: "PD Anna Klein", deadline: "2026-05-02", createdAt: "2026-03-03", notes: "WAIS-V and ABAS-3 completed. Clinical interview in progress." },
  // ─── DIAGNOSTICS (7) ──────────────────────────────────────────────
  { num: "PSY-2026-0231", last: "Johnson", first: "Marcus", dob: "1992-03-15", gender: "M", evalType: "CST", referral: "Court", stage: "diagnostics", complaint: "Cannot assist counsel — possible psychotic disorder", charges: "Assault 1st (F3), Criminal Mischief (M1)", jurisdiction: "Denver District Court", attorney: "ADA Rachel Thornton", deadline: "2026-04-15", createdAt: "2026-02-15", notes: "Schizophrenia suspected. 3 sessions completed. All testing done." },
  { num: "PSY-2026-0232", last: "Williams", first: "Sarah", dob: "1984-09-08", gender: "F", evalType: "Risk", referral: "Court", stage: "diagnostics", complaint: "Stalking with escalation pattern", charges: "Stalking (F5), Menacing (M1)", jurisdiction: "Jefferson County", attorney: "PD Kevin Ford", deadline: "2026-04-01", createdAt: "2026-02-10", notes: "HCR-20v3, PCL-R scored. Diagnostician ready for review." },
  { num: "PSY-2026-0233", last: "Washington", first: "Keisha", dob: "1989-01-25", gender: "F", evalType: "CST", referral: "Court", stage: "diagnostics", complaint: "Erratic behavior, possible bipolar episode", charges: "Robbery (F4), Assault 3rd (M1)", jurisdiction: "Adams County", attorney: "PD David Chen", deadline: "2026-04-12", createdAt: "2026-02-18", notes: "Diagnostician identified Bipolar I and ASPD differential." },
  { num: "PSY-2026-0234", last: "Kim", first: "Sung-Ho", dob: "1973-12-01", gender: "M", evalType: "PTSD Dx", referral: "Attorney", stage: "diagnostics", complaint: "PTSD and TBI differential diagnosis", charges: "", jurisdiction: "", attorney: "Steven Park, Esq.", deadline: "2026-04-05", createdAt: "2026-02-05", notes: "Diagnostician presenting PTSD vs. Adjustment Disorder options." },
  { num: "PSY-2026-0235", last: "Foster", first: "Derek", dob: "1981-06-20", gender: "M", evalType: "Malingering", referral: "Court", stage: "diagnostics", complaint: "Suspected symptom fabrication — disability claim", charges: "Theft (F4)", jurisdiction: "Denver District Court", attorney: "ADA Nancy Clark", deadline: "2026-04-02", createdAt: "2026-02-08", notes: "MMPI-3 FBS elevated. SIRS-2 probable. TOMM below cutoff." },
  { num: "PSY-2026-0236", last: "Tanaka", first: "Yuki", dob: "1967-05-30", gender: "F", evalType: "Capacity", referral: "Attorney", stage: "diagnostics", complaint: "Testamentary capacity for contested will", charges: "", jurisdiction: "El Paso County Probate", attorney: "Margaret Collins, Esq.", deadline: "2026-04-10", createdAt: "2026-02-12", notes: "MoCA=18. Diagnostician weighing Major NCD vs. age-related decline." },
  { num: "PSY-2026-0237", last: "Reeves", first: "Anthony", dob: "1975-03-08", gender: "M", evalType: "Mitigation", referral: "Attorney", stage: "diagnostics", complaint: "Sentencing mitigation — childhood trauma history", charges: "Aggravated Assault (F4)", jurisdiction: "Arapahoe County", attorney: "PD Carlos Diaz", deadline: "2026-04-18", createdAt: "2026-02-14", notes: "ACEs score 8/10. Diagnostician evaluating PTSD + SUD comorbidity." },
  // ─── REVIEW (6) ───────────────────────────────────────────────────
  { num: "PSY-2026-0241", last: "Fitzgerald", first: "Sean", dob: "1963-08-11", gender: "M", evalType: "Capacity", referral: "Attorney", stage: "review", complaint: "Financial conservatorship evaluation", charges: "", jurisdiction: "Douglas County Probate", attorney: "Margaret Collins, Esq.", deadline: "2026-04-18", createdAt: "2026-01-20", notes: "Draft report in clinician review. Vascular NCD diagnosed." },
  { num: "PSY-2026-0242", last: "Hoffman", first: "Rachel", dob: "1990-11-04", gender: "F", evalType: "Fitness", referral: "Court", stage: "review", complaint: "Fitness to proceed — possible dissociative disorder", charges: "Forgery (F5)", jurisdiction: "Boulder County", attorney: "PD James Hartley", deadline: "2026-04-08", createdAt: "2026-01-25", notes: "Report drafted. Editor flagged 2 medium issues." },
  { num: "PSY-2026-0243", last: "Kowalski", first: "Anna", dob: "1979-03-16", gender: "F", evalType: "Custody", referral: "Court", stage: "review", complaint: "Custody modification — substance abuse allegation", charges: "", jurisdiction: "El Paso County Family Court", attorney: "Judge William Huang", deadline: "2026-04-15", createdAt: "2026-01-28", notes: "Both parents evaluated. Report under clinical review." },
  { num: "PSY-2026-0244", last: "Cooper", first: "Ashley", dob: "1988-04-22", gender: "F", evalType: "CST", referral: "Court", stage: "review", complaint: "Restored competency — re-evaluation", charges: "Assault 2nd (F4), Resisting Arrest (M2)", jurisdiction: "Denver District Court", attorney: "PD Olivia Barnes", deadline: "2026-04-08", createdAt: "2026-01-15", notes: "Competent. Report ready for attestation. Editor: 1 high flag." },
  { num: "PSY-2026-0245", last: "Patel", first: "Neha", dob: "1986-07-09", gender: "F", evalType: "PTSD Dx", referral: "Attorney", stage: "review", complaint: "PTSD from sexual assault — civil damages case", charges: "", jurisdiction: "", attorney: "Jennifer Walsh, Esq.", deadline: "2026-04-12", createdAt: "2026-01-22", notes: "PTSD confirmed. Report in final review before attestation." },
  { num: "PSY-2026-0246", last: "Santos", first: "Rafael", dob: "1971-10-15", gender: "M", evalType: "Neuropsych", referral: "Attorney", stage: "review", complaint: "Cognitive impairment after industrial chemical exposure", charges: "", jurisdiction: "", attorney: "David Greenwald, Esq.", deadline: "2026-04-20", createdAt: "2026-01-18", notes: "Neuropsych battery complete. Report drafted with 3 AI draft sections." },
  // ─── COMPLETE (12) ────────────────────────────────────────────────
  { num: "PSY-2026-0251", last: "Chen", first: "Wei", dob: "1977-02-19", gender: "M", evalType: "PTSD Dx", referral: "Attorney", stage: "complete", complaint: "Occupational PTSD — first responder", charges: "", jurisdiction: "", attorney: "Linda Park, Esq.", deadline: "2026-03-10", createdAt: "2025-12-15", notes: "PTSD confirmed. Report finalized and sealed." },
  { num: "PSY-2026-0252", last: "Thompson", first: "Robert", dob: "1969-06-30", gender: "M", evalType: "Malingering", referral: "Court", stage: "complete", complaint: "Symptom exaggeration in disability claim", charges: "Fraud (F4)", jurisdiction: "Adams County", attorney: "ADA James Whitfield", deadline: "2026-03-20", createdAt: "2025-12-10", notes: "Malingering confirmed. MMPI-3 and SIRS-2 definitive." },
  { num: "PSY-2026-0253", last: "Anderson", first: "Lisa", dob: "1993-09-14", gender: "F", evalType: "Fitness", referral: "Court", stage: "complete", complaint: "Fitness restored after treatment", charges: "Theft (M1)", jurisdiction: "Boulder County", attorney: "PD Anna Klein", deadline: "2026-03-15", createdAt: "2025-12-01", notes: "Fit to proceed. Treatment compliance documented." },
  { num: "PSY-2026-0254", last: "Garcia", first: "Miguel", dob: "1965-12-03", gender: "M", evalType: "Capacity", referral: "Attorney", stage: "complete", complaint: "Conservatorship — advanced dementia", charges: "", jurisdiction: "El Paso County Probate", attorney: "Elena Ruiz, Esq.", deadline: "2026-02-28", createdAt: "2025-11-15", notes: "Lacks capacity. Conservatorship recommended." },
  { num: "PSY-2026-0255", last: "Petrov", first: "Alexei", dob: "1975-04-03", gender: "M", evalType: "Risk", referral: "Court", stage: "complete", complaint: "SVP risk assessment — sexual offense history", charges: "Sexual Assault (F3)", jurisdiction: "Denver District Court", attorney: "ADA Karen Wells", deadline: "2026-03-15", createdAt: "2025-11-20", notes: "High risk. Civil commitment recommended." },
  { num: "PSY-2026-0256", last: "Jackson", first: "Tamara", dob: "1983-08-07", gender: "F", evalType: "CST", referral: "Court", stage: "complete", complaint: "Incompetent — treatment ordered", charges: "Assault 2nd (F4)", jurisdiction: "Denver District Court", attorney: "PD Marcus Lee", deadline: "2026-03-10", createdAt: "2025-11-25", notes: "IST. Committed to CMHIP for restoration." },
  { num: "PSY-2026-0257", last: "Taylor", first: "Brandon", dob: "1997-01-20", gender: "M", evalType: "CST", referral: "Court", stage: "complete", complaint: "Substance-induced psychosis resolved", charges: "DUI (M1), Eluding (F5)", jurisdiction: "Adams County", attorney: "ADA Robert Park", deadline: "2026-03-25", createdAt: "2025-12-05", notes: "Competent. Substance-induced condition resolved." },
  { num: "PSY-2026-0258", last: "Harris", first: "Tyrone", dob: "1972-11-28", gender: "M", evalType: "Risk", referral: "Court", stage: "complete", complaint: "DV risk — lethality assessment for bond hearing", charges: "Domestic Violence (F4)", jurisdiction: "Arapahoe County", attorney: "ADA Michelle Stevens", deadline: "2026-03-05", createdAt: "2025-11-10", notes: "High lethality risk. No-contact bond recommended." },
  { num: "PSY-2026-0259", last: "Suzuki", first: "Kenji", dob: "1998-05-16", gender: "M", evalType: "ADHD Dx", referral: "Physician", stage: "complete", complaint: "ADHD evaluation for workplace accommodations", charges: "", jurisdiction: "", attorney: "", deadline: "2026-03-30", createdAt: "2025-12-20", notes: "ADHD Combined confirmed. Accommodations letter provided." },
  { num: "PSY-2026-0260", last: "Singh", first: "Rajveer", dob: "1968-03-09", gender: "M", evalType: "Fitness", referral: "Court", stage: "complete", complaint: "Fitness evaluation — non-English speaker", charges: "DUI (M1)", jurisdiction: "Weld County", attorney: "PD Carlos Diaz", deadline: "2026-03-18", createdAt: "2025-12-08", notes: "Fit to proceed with interpreter. Language barrier only." },
  { num: "PSY-2026-0261", last: "OBrien", first: "Patrick", dob: "1960-09-25", gender: "M", evalType: "Malingering", referral: "Insurance", stage: "complete", complaint: "Workers comp claim — suspected feigning", charges: "", jurisdiction: "", attorney: "Hartford Insurance", deadline: "2026-03-28", createdAt: "2025-12-12", notes: "Malingering probable. TOMM and SIRS-2 below cutoffs." },
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
      current_employer: c.evalType === "Capacity" ? "N/A — retired since 2020" : "",
      work_history: c.evalType === "Capacity" ? "Worked 30+ years in financial services. Retired as branch manager. Employer noted no concerns prior to retirement." : `${Math.floor(Math.random() * 5) + 2} jobs in the past 10 years. Longest tenure: ${Math.floor(Math.random() * 5) + 2} years.`,
      military_service: Math.random() > 0.8 ? `${isMale ? "US Army" : "US Air Force"}, ${4 + Math.floor(Math.random() * 8)} years, honorable discharge.` : "N/A"
    },
    health: {
      medical_conditions: c.evalType === "Capacity" ? "Hypertension (controlled with medication), Type 2 diabetes, mild hearing loss bilateral." : Math.random() > 0.5 ? "No significant medical conditions reported." : "Hypertension, managed with medication. No other active conditions.",
      current_medications: c.evalType === "Capacity" ? "Lisinopril 20mg daily, Metformin 500mg BID, aspirin 81mg daily." : Math.random() > 0.5 ? "None reported." : "Sertraline 50mg daily.",
      surgeries_hospitalizations: c.evalType === "Capacity" ? "Appendectomy (1995), knee replacement (2018)." : "No surgical history reported.",
      head_injuries: c.evalType === "Capacity" ? "No reported head injuries. No loss of consciousness events." : c.evalType === "Neuropsych" ? "TBI from motor vehicle accident 6 months ago. Brief loss of consciousness at scene. ER evaluation, CT negative." : "No reported head injuries.",
      sleep_quality: c.evalType === "PTSD Dx" ? "Poor — nightmares 3-4 times per week, difficulty falling asleep." : "Reports adequate sleep, 6-7 hours per night.",
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
function createSeedTrigger() {
  fs.writeFileSync(TRIGGER, (/* @__PURE__ */ new Date()).toISOString(), "utf-8");
}
function backfillDemoTypes() {
  const sqlite = getSqlite();
  const update = sqlite.prepare(`
    UPDATE cases SET
      evaluation_type = ?,
      referral_source = ?,
      evaluation_questions = ?,
      examinee_dob = ?,
      examinee_gender = ?,
      notes = CASE WHEN notes IS NULL OR notes = '' THEN ? ELSE notes END
    WHERE case_number = ? AND (evaluation_type IS NULL OR evaluation_type = '')
  `);
  let updated = 0;
  for (const c of CASES) {
    const bare = c.num.replace(/^PSY-/, "");
    let result = update.run(
      c.evalType,
      c.referral,
      c.complaint,
      c.dob,
      c.gender,
      `[DEMO] ${c.notes}`,
      bare
    );
    if (result.changes === 0) {
      result = update.run(
        c.evalType,
        c.referral,
        c.complaint,
        c.dob,
        c.gender,
        `[DEMO] ${c.notes}`,
        c.num
      );
    }
    if (result.changes > 0) updated++;
  }
  if (updated > 0) {
    console.log(`[seed] Backfilled evaluation_type for ${updated} demo cases`);
  }
  return updated;
}
function backfillOnboarding() {
  const sqlite = getSqlite();
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
  const insertOb = sqlite.prepare(`
    INSERT OR IGNORE INTO patient_onboarding (
      case_id, section, content, clinician_notes, verified, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  let intakeFilled = 0;
  let obFilled = 0;
  for (const c of CASES) {
    const bare = c.num.replace(/^PSY-/, "");
    const row = sqlite.prepare("SELECT case_id FROM cases WHERE case_number = ? OR case_number = ?").get(c.num, bare);
    if (!row) continue;
    const stageIndex = ["onboarding", "testing", "interview", "diagnostics", "review", "complete"].indexOf(c.stage);
    const refType = c.referral.toLowerCase().includes("court") ? "court" : c.referral.toLowerCase().includes("attorney") ? "attorney" : c.referral.toLowerCase().includes("insurance") ? "insurance" : c.referral.toLowerCase().includes("physician") ? "physician" : "court";
    const existingIntake = sqlite.prepare("SELECT COUNT(*) as cnt FROM patient_intake WHERE case_id = ?").get(row.case_id);
    if (existingIntake.cnt === 0) {
      const intakeComplete = stageIndex >= 1;
      insertIntake.run({
        caseId: row.case_id,
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
      intakeFilled++;
    }
    if (stageIndex >= 1) {
      const existingOb = sqlite.prepare("SELECT COUNT(*) as cnt FROM patient_onboarding WHERE case_id = ?").get(row.case_id);
      if (existingOb.cnt === 0) {
        const ob = generateOnboardingData(c);
        for (const [section, content] of Object.entries(ob)) {
          insertOb.run(
            row.case_id,
            section,
            JSON.stringify(content),
            null,
            1,
            "complete",
            c.createdAt,
            c.createdAt
          );
        }
        obFilled++;
      }
    }
  }
  if (intakeFilled > 0) console.log(`[seed] Backfilled intake data for ${intakeFilled} demo cases`);
  if (obFilled > 0) console.log(`[seed] Backfilled onboarding data for ${obFilled} demo cases`);
  return intakeFilled + obFilled;
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
      ensureDir(caseFolderPath);
      for (const sub of CASE_SUBFOLDERS) {
        ensureDir(path.join(caseFolderPath, sub));
      }
      sqlite.prepare("UPDATE cases SET folder_path = ? WHERE case_id = ?").run(caseFolderPath, caseId);
      createPlaceholder(
        path.join(caseFolderPath, "_Inbox"),
        "CASE_INFO.txt",
        `PSYGIL DEMO CASE — AI-GENERATED DATA
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
      sandbox: !isDev
      // sandbox=true in production only; dev needs GPU access
    }
  });
  const csp = isDev ? "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ws: http://localhost:* https://api.anthropic.com; frame-src http://localhost:9980; object-src 'none'; base-uri 'self'; form-action 'none'" : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https://api.anthropic.com http://localhost:9980 ws://localhost:9980; frame-src http://localhost:9980; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'";
  win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [csp]
      }
    });
  });
  if (process.env["ELECTRON_RENDERER_URL"]) {
    win.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    win.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
  return win;
}
electron.app.whenReady().then(async () => {
  electron.app.setAsDefaultProtocolClient("psygil");
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
      console.log("[main] Demo seed trigger detected — seeding 42 cases...");
      seedDemoCases();
    } else {
      const db = getSqlite();
      const demoCount = db.prepare("SELECT count(*) as n FROM cases WHERE case_number LIKE '%2026-02%'").get().n;
      if (demoCount === 0) {
        console.log("[main] No demo cases found — auto-seeding 42 demo cases...");
        createSeedTrigger();
        seedDemoCases();
      } else {
        backfillDemoTypes();
        backfillOnboarding();
      }
    }
  } catch (err) {
    console.error("[main] Demo seed failed (non-fatal):", err);
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
