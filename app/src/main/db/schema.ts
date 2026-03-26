/**
 * Drizzle ORM schema for Psygil — matches SQL spec docs 01 + 01a exactly.
 * All 29 tables (24 base + 5 addendum) defined here for type-safe queries.
 * FTS5 virtual tables, views, and triggers are applied via raw SQL migration.
 */

import { sql } from 'drizzle-orm'
import { sqliteTable, text, integer, real, uniqueIndex, index } from 'drizzle-orm/sqlite-core'

// ============================================================================
// 1. USER MANAGEMENT
// ============================================================================

export const users = sqliteTable('users', {
  user_id: integer('user_id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  full_name: text('full_name').notNull(),
  role: text('role').notNull(), // CHECK: psychologist | psychometrist | admin | receptionist
  specializations: text('specializations'),
  credentials: text('credentials'),
  license_number: text('license_number'),
  state_licensed: text('state_licensed'),
  organization: text('organization'),
  is_active: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  created_at: text('created_at').notNull().default(sql`CURRENT_DATE`),
  last_login: text('last_login'),
  deleted_at: text('deleted_at'),
  // Addendum: practice association
  practice_id: integer('practice_id').references(() => practiceConfig.practice_id),
}, (table) => [
  index('idx_users_email').on(table.email),
  index('idx_users_role').on(table.role),
  index('idx_users_is_active').on(table.is_active),
  index('idx_users_practice_id').on(table.practice_id),
])

// ============================================================================
// 2. CONFIGURATION TABLES
// ============================================================================

export const diagnosisCatalog = sqliteTable('diagnosis_catalog', {
  diagnosis_id: integer('diagnosis_id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull().unique(),
  dsm5tr_code: text('dsm5tr_code'),
  name: text('name').notNull(),
  description: text('description'),
  category: text('category'),
  is_builtin: integer('is_builtin', { mode: 'boolean' }).notNull().default(true),
  created_by_user_id: integer('created_by_user_id').references(() => users.user_id),
  created_at: text('created_at').notNull().default(sql`CURRENT_DATE`),
}, (table) => [
  index('idx_diagnosis_catalog_code').on(table.code),
  index('idx_diagnosis_catalog_dsm5tr_code').on(table.dsm5tr_code),
  index('idx_diagnosis_catalog_is_builtin').on(table.is_builtin),
])

export const instrumentLibrary = sqliteTable('instrument_library', {
  instrument_id: integer('instrument_id').primaryKey({ autoIncrement: true }),
  abbreviation: text('abbreviation').notNull().unique(),
  full_name: text('full_name').notNull(),
  description: text('description'),
  what_it_measures: text('what_it_measures'),
  publisher: text('publisher'),
  publication_year: integer('publication_year'),
  scoring_method: text('scoring_method'),
  time_to_administer_minutes: integer('time_to_administer_minutes'),
  is_active: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  created_at: text('created_at').notNull().default(sql`CURRENT_DATE`),
}, (table) => [
  index('idx_instrument_library_abbreviation').on(table.abbreviation),
  index('idx_instrument_library_is_active').on(table.is_active),
])

export const diagnosisInstrumentMappings = sqliteTable('diagnosis_instrument_mappings', {
  mapping_id: integer('mapping_id').primaryKey({ autoIncrement: true }),
  diagnosis_id: integer('diagnosis_id').notNull().references(() => diagnosisCatalog.diagnosis_id, { onDelete: 'cascade' }),
  instrument_id: integer('instrument_id').notNull().references(() => instrumentLibrary.instrument_id, { onDelete: 'cascade' }),
  relevance_score: real('relevance_score').default(1.0),
  is_primary: integer('is_primary', { mode: 'boolean' }).default(false),
  notes: text('notes'),
}, (table) => [
  uniqueIndex('idx_dim_unique').on(table.diagnosis_id, table.instrument_id),
  index('idx_diagnosis_instrument_mappings_diagnosis_id').on(table.diagnosis_id),
  index('idx_diagnosis_instrument_mappings_instrument_id').on(table.instrument_id),
])

export const practiceProfiles = sqliteTable('practice_profiles', {
  profile_id: integer('profile_id').primaryKey({ autoIncrement: true }),
  profile_name: text('profile_name').notNull().unique(),
  profile_type: text('profile_type').notNull(), // CHECK: forensic_criminal | forensic_civil | clinical_general | neuropsych
  description: text('description'),
  default_diagnoses: text('default_diagnoses'),
  default_instruments: text('default_instruments'),
  standard_sections: text('standard_sections'),
  created_by_user_id: integer('created_by_user_id').notNull().references(() => users.user_id),
  is_active: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  created_at: text('created_at').notNull().default(sql`CURRENT_DATE`),
}, (table) => [
  index('idx_practice_profiles_profile_type').on(table.profile_type),
  index('idx_practice_profiles_is_active').on(table.is_active),
])

export const reportTemplates = sqliteTable('report_templates', {
  template_id: integer('template_id').primaryKey({ autoIncrement: true }),
  template_name: text('template_name').notNull(),
  evaluation_type: text('evaluation_type').notNull(),
  template_content: text('template_content'),
  sections: text('sections'),
  jurisdiction: text('jurisdiction'),
  created_by_user_id: integer('created_by_user_id').notNull().references(() => users.user_id),
  is_active: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  version: integer('version').default(1),
  created_at: text('created_at').notNull().default(sql`CURRENT_DATE`),
}, (table) => [
  index('idx_report_templates_evaluation_type').on(table.evaluation_type),
  index('idx_report_templates_jurisdiction').on(table.jurisdiction),
  index('idx_report_templates_is_active').on(table.is_active),
])

export const styleRules = sqliteTable('style_rules', {
  rule_id: integer('rule_id').primaryKey({ autoIncrement: true }),
  rule_name: text('rule_name').notNull().unique(),
  rule_content: text('rule_content').notNull(),
  category: text('category'),
  guardrails: text('guardrails'),
  examples: text('examples'),
  created_at: text('created_at').notNull().default(sql`CURRENT_DATE`),
  updated_at: text('updated_at').default(sql`CURRENT_DATE`),
}, (table) => [
  index('idx_style_rules_category').on(table.category),
])

// ============================================================================
// 3. CASE MANAGEMENT
// ============================================================================

export const cases = sqliteTable('cases', {
  case_id: integer('case_id').primaryKey({ autoIncrement: true }),
  case_number: text('case_number').notNull().unique(),
  primary_clinician_user_id: integer('primary_clinician_user_id').notNull().references(() => users.user_id),
  examinee_first_name: text('examinee_first_name').notNull(),
  examinee_last_name: text('examinee_last_name').notNull(),
  examinee_dob: text('examinee_dob'),
  examinee_gender: text('examinee_gender'),
  cultural_context: text('cultural_context'),
  linguistic_context: text('linguistic_context'),
  evaluation_type: text('evaluation_type'),
  practice_profile_id: integer('practice_profile_id').references(() => practiceProfiles.profile_id),
  referral_source: text('referral_source'),
  evaluation_questions: text('evaluation_questions'),
  case_status: text('case_status').notNull().default('intake'), // CHECK: intake | in_progress | completed | archived
  workflow_current_stage: text('workflow_current_stage').default('gate_1'), // CHECK: gate_1 | gate_2 | gate_3 | finalized
  created_at: text('created_at').notNull().default(sql`CURRENT_DATE`),
  last_modified: text('last_modified').default(sql`CURRENT_DATE`),
  completed_at: text('completed_at'),
  notes: text('notes'),
  // Addendum: practice association
  practice_id: integer('practice_id').references(() => practiceConfig.practice_id),
}, (table) => [
  index('idx_cases_primary_clinician_user_id').on(table.primary_clinician_user_id),
  index('idx_cases_case_status').on(table.case_status),
  index('idx_cases_workflow_current_stage').on(table.workflow_current_stage),
  index('idx_cases_created_at').on(table.created_at),
  index('idx_cases_case_number').on(table.case_number),
  index('idx_cases_practice_id').on(table.practice_id),
])

export const sessions = sqliteTable('sessions', {
  session_id: integer('session_id').primaryKey({ autoIncrement: true }),
  case_id: integer('case_id').notNull().references(() => cases.case_id, { onDelete: 'cascade' }),
  session_number: integer('session_number').notNull(),
  session_date: text('session_date').notNull(),
  clinician_user_id: integer('clinician_user_id').notNull().references(() => users.user_id),
  psychometrist_user_id: integer('psychometrist_user_id').references(() => users.user_id),
  duration_minutes: integer('duration_minutes'),
  session_notes: text('session_notes'),
  behavioral_observations: text('behavioral_observations'),
  rapport_quality: text('rapport_quality'),
  created_at: text('created_at').notNull().default(sql`CURRENT_DATE`),
}, (table) => [
  uniqueIndex('idx_sessions_case_session').on(table.case_id, table.session_number),
  index('idx_sessions_case_id').on(table.case_id),
  index('idx_sessions_session_date').on(table.session_date),
  index('idx_sessions_clinician_user_id').on(table.clinician_user_id),
])

// ============================================================================
// 4. DOCUMENTS & TEST DATA
// ============================================================================

export const documents = sqliteTable('documents', {
  document_id: integer('document_id').primaryKey({ autoIncrement: true }),
  case_id: integer('case_id').notNull().references(() => cases.case_id, { onDelete: 'cascade' }),
  session_id: integer('session_id').references(() => sessions.session_id, { onDelete: 'set null' }),
  document_type: text('document_type').notNull(), // CHECK: referral | pdf | docx | transcript_vtt | audio | score_report | medical_record | other
  original_filename: text('original_filename').notNull(),
  file_path: text('file_path').notNull(),
  file_size_bytes: integer('file_size_bytes'),
  mime_type: text('mime_type'),
  uploaded_by_user_id: integer('uploaded_by_user_id').notNull().references(() => users.user_id),
  upload_date: text('upload_date').notNull().default(sql`CURRENT_DATE`),
  description: text('description'),
  indexed_content: text('indexed_content'),
  // Addendum: cloud sync columns
  remote_path: text('remote_path'),
  remote_version: text('remote_version'),
  sync_status: text('sync_status').default('local_only'), // CHECK: local_only | synced | pending_upload | pending_download | conflict
  last_synced_at: text('last_synced_at'),
}, (table) => [
  index('idx_documents_case_id').on(table.case_id),
  index('idx_documents_session_id').on(table.session_id),
  index('idx_documents_document_type').on(table.document_type),
  index('idx_documents_upload_date').on(table.upload_date),
  index('idx_documents_sync_status').on(table.sync_status),
  index('idx_documents_last_synced_at').on(table.last_synced_at),
])

export const testAdministrations = sqliteTable('test_administrations', {
  test_admin_id: integer('test_admin_id').primaryKey({ autoIncrement: true }),
  case_id: integer('case_id').notNull().references(() => cases.case_id, { onDelete: 'cascade' }),
  session_id: integer('session_id').references(() => sessions.session_id, { onDelete: 'set null' }),
  instrument_id: integer('instrument_id').notNull().references(() => instrumentLibrary.instrument_id),
  administration_date: text('administration_date').notNull(),
  administered_by_user_id: integer('administered_by_user_id').notNull().references(() => users.user_id),
  score_report_document_id: integer('score_report_document_id').references(() => documents.document_id, { onDelete: 'set null' }),
  raw_score: real('raw_score'),
  standard_score: real('standard_score'),
  percentile: integer('percentile'),
  scaled_score: real('scaled_score'),
  t_score: real('t_score'),
  confidence_interval_lower: real('confidence_interval_lower'),
  confidence_interval_upper: real('confidence_interval_upper'),
  interpretation: text('interpretation'),
  notes: text('notes'),
  data_entry_method: text('data_entry_method'), // CHECK: manual | qglobal_import | pariconnect_import | pdf_extraction
  created_at: text('created_at').notNull().default(sql`CURRENT_DATE`),
}, (table) => [
  index('idx_test_administrations_case_id').on(table.case_id),
  index('idx_test_administrations_instrument_id').on(table.instrument_id),
  index('idx_test_administrations_administration_date').on(table.administration_date),
])

// ============================================================================
// 5. WORKFLOW & GATE SYSTEM
// ============================================================================

export const gateReviews = sqliteTable('gate_reviews', {
  gate_review_id: integer('gate_review_id').primaryKey({ autoIncrement: true }),
  case_id: integer('case_id').notNull().references(() => cases.case_id, { onDelete: 'cascade' }),
  gate_number: integer('gate_number').notNull(), // CHECK: 1 | 2 | 3
  gate_purpose: text('gate_purpose').notNull(),
  reviewer_user_id: integer('reviewer_user_id').notNull().references(() => users.user_id),
  review_date: text('review_date').notNull().default(sql`CURRENT_DATE`),
  review_status: text('review_status').notNull().default('pending'), // CHECK: pending | in_progress | completed | requires_revision
  notes: text('notes'),
}, (table) => [
  uniqueIndex('idx_gate_reviews_case_gate').on(table.case_id, table.gate_number),
  index('idx_gate_reviews_case_id').on(table.case_id),
  index('idx_gate_reviews_gate_number').on(table.gate_number),
  index('idx_gate_reviews_review_status').on(table.review_status),
])

export const gateDecisions = sqliteTable('gate_decisions', {
  decision_id: integer('decision_id').primaryKey({ autoIncrement: true }),
  gate_review_id: integer('gate_review_id').notNull().references(() => gateReviews.gate_review_id, { onDelete: 'cascade' }),
  case_id: integer('case_id').notNull().references(() => cases.case_id, { onDelete: 'cascade' }),
  decision_type: text('decision_type').notNull(), // CHECK: data_confirmed | diagnosis_selected | diagnosis_ruled_out | attestation | other
  subject_entity_type: text('subject_entity_type'),
  subject_entity_id: integer('subject_entity_id'),
  actor_user_id: integer('actor_user_id').notNull().references(() => users.user_id),
  decision_rationale: text('decision_rationale'),
  decision_date: text('decision_date').notNull().default(sql`CURRENT_DATE`),
  is_final: integer('is_final', { mode: 'boolean' }).default(false),
}, (table) => [
  index('idx_gate_decisions_gate_review_id').on(table.gate_review_id),
  index('idx_gate_decisions_case_id').on(table.case_id),
  index('idx_gate_decisions_decision_type').on(table.decision_type),
  index('idx_gate_decisions_actor_user_id').on(table.actor_user_id),
])

// ============================================================================
// 6. DIAGNOSES (CLINICIAN-SELECTED ONLY)
// ============================================================================

export const diagnoses = sqliteTable('diagnoses', {
  diagnosis_record_id: integer('diagnosis_record_id').primaryKey({ autoIncrement: true }),
  case_id: integer('case_id').notNull().references(() => cases.case_id, { onDelete: 'cascade' }),
  diagnosis_id: integer('diagnosis_id').notNull().references(() => diagnosisCatalog.diagnosis_id),
  selected_at_gate_2: integer('selected_at_gate_2', { mode: 'boolean' }).default(true),
  clinician_user_id: integer('clinician_user_id').notNull().references(() => users.user_id),
  confidence_level: text('confidence_level'), // CHECK: high | moderate | low
  supporting_evidence: text('supporting_evidence'),
  selection_date: text('selection_date').notNull().default(sql`CURRENT_DATE`),
  is_primary_diagnosis: integer('is_primary_diagnosis', { mode: 'boolean' }).default(false),
  rule_out_rationale: text('rule_out_rationale'),
}, (table) => [
  index('idx_diagnoses_case_id').on(table.case_id),
  index('idx_diagnoses_diagnosis_id').on(table.diagnosis_id),
  index('idx_diagnoses_clinician_user_id').on(table.clinician_user_id),
  index('idx_diagnoses_selected_at_gate_2').on(table.selected_at_gate_2),
])

// ============================================================================
// 7. AGENT SYSTEM & PROCESSING
// ============================================================================

export const agentRuns = sqliteTable('agent_runs', {
  agent_run_id: integer('agent_run_id').primaryKey({ autoIncrement: true }),
  case_id: integer('case_id').notNull().references(() => cases.case_id, { onDelete: 'cascade' }),
  agent_type: text('agent_type').notNull(), // CHECK: diagnostician | writer | validator
  agent_version: text('agent_version'),
  input_hash: text('input_hash'),
  input_summary: text('input_summary'),
  output_hash: text('output_hash'),
  output_summary: text('output_summary'),
  duration_seconds: real('duration_seconds'),
  status: text('status').notNull().default('success'), // CHECK: success | partial_success | failed | error
  error_message: text('error_message'),
  invoked_by_user_id: integer('invoked_by_user_id').notNull().references(() => users.user_id),
  started_at: text('started_at').notNull().default(sql`CURRENT_DATE`),
  completed_at: text('completed_at'),
}, (table) => [
  index('idx_agent_runs_case_id').on(table.case_id),
  index('idx_agent_runs_agent_type').on(table.agent_type),
  index('idx_agent_runs_status').on(table.status),
  index('idx_agent_runs_started_at').on(table.started_at),
])

export const evidenceMaps = sqliteTable('evidence_maps', {
  evidence_map_id: integer('evidence_map_id').primaryKey({ autoIncrement: true }),
  agent_run_id: integer('agent_run_id').notNull().references(() => agentRuns.agent_run_id, { onDelete: 'cascade' }),
  case_id: integer('case_id').notNull().references(() => cases.case_id, { onDelete: 'cascade' }),
  diagnosis_id: integer('diagnosis_id').notNull().references(() => diagnosisCatalog.diagnosis_id),
  criterion_name: text('criterion_name').notNull(),
  criterion_description: text('criterion_description'),
  supporting_evidence: text('supporting_evidence'),
  contradicting_evidence: text('contradicting_evidence'),
  evidence_strength: text('evidence_strength'), // CHECK: strong | moderate | weak | absent
  confidence_score: real('confidence_score'),
  source_documents: text('source_documents'),
  created_at: text('created_at').notNull().default(sql`CURRENT_DATE`),
}, (table) => [
  index('idx_evidence_maps_agent_run_id').on(table.agent_run_id),
  index('idx_evidence_maps_case_id').on(table.case_id),
  index('idx_evidence_maps_diagnosis_id').on(table.diagnosis_id),
])

export const writerDrafts = sqliteTable('writer_drafts', {
  draft_id: integer('draft_id').primaryKey({ autoIncrement: true }),
  agent_run_id: integer('agent_run_id').notNull().references(() => agentRuns.agent_run_id, { onDelete: 'cascade' }),
  case_id: integer('case_id').notNull().references(() => cases.case_id, { onDelete: 'cascade' }),
  section_name: text('section_name').notNull(),
  section_content: text('section_content').notNull(),
  content_type: text('content_type').notNull(), // CHECK: fully_generated | draft_requiring_revision
  revision_status: text('revision_status').default('pending'), // CHECK: pending | reviewed | approved | revised
  reviewer_user_id: integer('reviewer_user_id').references(() => users.user_id),
  review_notes: text('review_notes'),
  created_at: text('created_at').notNull().default(sql`CURRENT_DATE`),
  reviewed_at: text('reviewed_at'),
}, (table) => [
  index('idx_writer_drafts_agent_run_id').on(table.agent_run_id),
  index('idx_writer_drafts_case_id').on(table.case_id),
  index('idx_writer_drafts_content_type').on(table.content_type),
  index('idx_writer_drafts_revision_status').on(table.revision_status),
])

// ============================================================================
// 8. REPORTS
// ============================================================================

export const reports = sqliteTable('reports', {
  report_id: integer('report_id').primaryKey({ autoIncrement: true }),
  case_id: integer('case_id').notNull().references(() => cases.case_id, { onDelete: 'cascade' }),
  report_version: integer('report_version').notNull().default(1),
  template_id: integer('template_id').references(() => reportTemplates.template_id, { onDelete: 'set null' }),
  generated_by_user_id: integer('generated_by_user_id').notNull().references(() => users.user_id),
  created_at: text('created_at').notNull().default(sql`CURRENT_DATE`),
  last_modified: text('last_modified').default(sql`CURRENT_DATE`),
  finalized_by_user_id: integer('finalized_by_user_id').references(() => users.user_id),
  finalized_at: text('finalized_at'),
  is_locked: integer('is_locked', { mode: 'boolean' }).default(false),
  integrity_hash: text('integrity_hash'),
  sealed_pdf_path: text('sealed_pdf_path'),
  file_path: text('file_path').notNull(),
  file_size_bytes: integer('file_size_bytes'),
  status: text('status').notNull().default('draft'), // CHECK: draft | in_review | revisions_needed | approved | finalized
}, (table) => [
  index('idx_reports_case_id').on(table.case_id),
  index('idx_reports_report_version').on(table.report_version),
  index('idx_reports_status').on(table.status),
  index('idx_reports_created_at').on(table.created_at),
  index('idx_reports_is_locked').on(table.is_locked),
])

export const reportRevisions = sqliteTable('report_revisions', {
  revision_id: integer('revision_id').primaryKey({ autoIncrement: true }),
  report_id: integer('report_id').notNull().references(() => reports.report_id, { onDelete: 'cascade' }),
  revision_number: integer('revision_number').notNull(),
  changed_by_user_id: integer('changed_by_user_id').notNull().references(() => users.user_id),
  revision_date: text('revision_date').notNull().default(sql`CURRENT_DATE`),
  change_summary: text('change_summary'),
  previous_integrity_hash: text('previous_integrity_hash'),
  new_integrity_hash: text('new_integrity_hash'),
}, (table) => [
  uniqueIndex('idx_report_revisions_report_rev').on(table.report_id, table.revision_number),
  index('idx_report_revisions_report_id').on(table.report_id),
  index('idx_report_revisions_changed_by_user_id').on(table.changed_by_user_id),
])

// ============================================================================
// 9. AUDIT TRAIL (Litigation-Defensible)
// ============================================================================

export const auditLog = sqliteTable('audit_log', {
  audit_log_id: integer('audit_log_id').primaryKey({ autoIncrement: true }),
  case_id: integer('case_id').notNull().references(() => cases.case_id, { onDelete: 'cascade' }),
  action_type: text('action_type').notNull(), // CHECK: see SQL spec for full list
  actor_user_id: integer('actor_user_id').notNull().references(() => users.user_id),
  action_date: text('action_date').notNull().default(sql`CURRENT_DATE`),
  details: text('details'),
  related_entity_type: text('related_entity_type'),
  related_entity_id: integer('related_entity_id'),
  granularity: text('granularity').default('decision_record_only'), // CHECK: decision_record_only | full_detail
}, (table) => [
  index('idx_audit_log_case_id').on(table.case_id),
  index('idx_audit_log_action_date').on(table.action_date),
  index('idx_audit_log_actor_user_id').on(table.actor_user_id),
  index('idx_audit_log_action_type').on(table.action_type),
])

// ============================================================================
// 10. PEER CONSULTATION
// ============================================================================

export const peerConsultations = sqliteTable('peer_consultations', {
  consultation_id: integer('consultation_id').primaryKey({ autoIncrement: true }),
  case_id: integer('case_id').notNull().references(() => cases.case_id, { onDelete: 'cascade' }),
  initiating_clinician_user_id: integer('initiating_clinician_user_id').notNull().references(() => users.user_id),
  consulting_clinician_user_id: integer('consulting_clinician_user_id').notNull().references(() => users.user_id),
  consultation_date: text('consultation_date').notNull().default(sql`CURRENT_DATE`),
  consultation_topic: text('consultation_topic'),
  consultation_notes: text('consultation_notes'),
  consultation_response: text('consultation_response'),
  response_date: text('response_date'),
}, (table) => [
  index('idx_peer_consultations_case_id').on(table.case_id),
  index('idx_peer_consultations_initiating').on(table.initiating_clinician_user_id),
  index('idx_peer_consultations_consulting').on(table.consulting_clinician_user_id),
])

// ============================================================================
// 11. REFERRAL DATA
// ============================================================================

export const referralSources = sqliteTable('referral_sources', {
  referral_id: integer('referral_id').primaryKey({ autoIncrement: true }),
  case_id: integer('case_id').notNull().references(() => cases.case_id, { onDelete: 'cascade' }),
  referral_document_id: integer('referral_document_id').references(() => documents.document_id, { onDelete: 'set null' }),
  referral_source_name: text('referral_source_name').notNull(),
  referral_source_type: text('referral_source_type'), // CHECK: attorney | court | medical | insurance | self_referred | other
  referral_date: text('referral_date'),
  evaluation_questions: text('evaluation_questions'),
  specific_concerns: text('specific_concerns'),
  requesting_party: text('requesting_party'),
}, (table) => [
  index('idx_referral_sources_case_id').on(table.case_id),
  index('idx_referral_sources_referral_source_type').on(table.referral_source_type),
])

// ============================================================================
// 12. BACKUP & ARCHIVAL METADATA
// ============================================================================

export const backupMetadata = sqliteTable('backup_metadata', {
  backup_id: integer('backup_id').primaryKey({ autoIncrement: true }),
  backup_date: text('backup_date').notNull().default(sql`CURRENT_DATE`),
  backup_type: text('backup_type').notNull(), // CHECK: full | incremental | export
  backup_path: text('backup_path').notNull(),
  case_count: integer('case_count'),
  file_size_bytes: integer('file_size_bytes'),
  integrity_hash: text('integrity_hash'),
  created_by_user_id: integer('created_by_user_id').references(() => users.user_id),
  notes: text('notes'),
}, (table) => [
  index('idx_backup_metadata_backup_date').on(table.backup_date),
  index('idx_backup_metadata_backup_type').on(table.backup_type),
])

// ============================================================================
// 13. CASE NOTES
// ============================================================================

export const caseNotes = sqliteTable('case_notes', {
  case_note_id: integer('case_note_id').primaryKey({ autoIncrement: true }),
  case_id: integer('case_id').notNull().references(() => cases.case_id, { onDelete: 'cascade' }),
  session_id: integer('session_id').references(() => sessions.session_id, { onDelete: 'set null' }),
  created_by_user_id: integer('created_by_user_id').notNull().references(() => users.user_id),
  note_content: text('note_content').notNull(),
  note_type: text('note_type'), // CHECK: clinical | administrative | diagnostic_reasoning | test_interpretation
  created_at: text('created_at').notNull().default(sql`CURRENT_DATE`),
}, (table) => [
  index('idx_case_notes_case_id').on(table.case_id),
  index('idx_case_notes_session_id').on(table.session_id),
  index('idx_case_notes_created_at').on(table.created_at),
])

// ============================================================================
// ADDENDUM: SHARED STORAGE TABLES (01a)
// ============================================================================

export const practiceConfig = sqliteTable('practice_config', {
  practice_id: integer('practice_id').primaryKey({ autoIncrement: true }),
  practice_name: text('practice_name').notNull().unique(),
  storage_mode: text('storage_mode').notNull().default('local_only'), // CHECK: local_only | shared_drive | cloud_o365 | cloud_gdrive
  storage_path: text('storage_path'),
  cloud_tenant_id: text('cloud_tenant_id'),
  cloud_site_id: text('cloud_site_id'),
  cloud_drive_id: text('cloud_drive_id'),
  gdrive_shared_drive_id: text('gdrive_shared_drive_id'),
  auto_sync_interval_minutes: integer('auto_sync_interval_minutes'),
  enable_version_history: integer('enable_version_history', { mode: 'boolean' }).default(true),
  max_local_cache_mb: integer('max_local_cache_mb').default(5000),
  admin_email: text('admin_email'),
  created_at: text('created_at').notNull().default(sql`CURRENT_DATE`),
  updated_at: text('updated_at').default(sql`CURRENT_DATE`),
}, (table) => [
  index('idx_practice_config_storage_mode').on(table.storage_mode),
  index('idx_practice_config_practice_name').on(table.practice_name),
])

export const documentPermissions = sqliteTable('document_permissions', {
  permission_id: integer('permission_id').primaryKey({ autoIncrement: true }),
  document_id: integer('document_id').notNull().references(() => documents.document_id, { onDelete: 'cascade' }),
  user_id: integer('user_id').notNull().references(() => users.user_id, { onDelete: 'cascade' }),
  permission_level: text('permission_level').notNull().default('read'), // CHECK: read | write | admin
  granted_by_user_id: integer('granted_by_user_id').notNull().references(() => users.user_id),
  granted_at: text('granted_at').notNull().default(sql`CURRENT_DATE`),
  revoked_at: text('revoked_at'),
}, (table) => [
  uniqueIndex('idx_document_permissions_doc_user').on(table.document_id, table.user_id),
  index('idx_document_permissions_document_id').on(table.document_id),
  index('idx_document_permissions_user_id').on(table.user_id),
  index('idx_document_permissions_permission_level').on(table.permission_level),
])

export const fileLocks = sqliteTable('file_locks', {
  lock_id: integer('lock_id').primaryKey({ autoIncrement: true }),
  document_id: integer('document_id').notNull().references(() => documents.document_id, { onDelete: 'cascade' }).unique(),
  locked_by_user_id: integer('locked_by_user_id').notNull().references(() => users.user_id),
  lock_type: text('lock_type').notNull().default('exclusive'), // CHECK: exclusive | shared
  acquired_at: text('acquired_at').notNull().default(sql`CURRENT_DATE`),
  expires_at: text('expires_at').notNull(),
  released_at: text('released_at'),
}, (table) => [
  index('idx_file_locks_document_id').on(table.document_id),
  index('idx_file_locks_locked_by_user_id').on(table.locked_by_user_id),
  index('idx_file_locks_expires_at').on(table.expires_at),
])

export const syncManifest = sqliteTable('sync_manifest', {
  manifest_id: integer('manifest_id').primaryKey({ autoIncrement: true }),
  case_id: integer('case_id').notNull().references(() => cases.case_id, { onDelete: 'cascade' }).unique(),
  last_sync_date: text('last_sync_date'),
  manifest_json: text('manifest_json'),
  sync_direction: text('sync_direction').notNull().default('bidirectional'), // CHECK: upload | download | bidirectional
  sync_status: text('sync_status').notNull().default('synced'), // CHECK: synced | pending | conflict | error
  error_message: text('error_message'),
  updated_at: text('updated_at').notNull().default(sql`CURRENT_DATE`),
}, (table) => [
  index('idx_sync_manifest_case_id').on(table.case_id),
  index('idx_sync_manifest_sync_status').on(table.sync_status),
  index('idx_sync_manifest_updated_at').on(table.updated_at),
])

export const caseAssignments = sqliteTable('case_assignments', {
  assignment_id: integer('assignment_id').primaryKey({ autoIncrement: true }),
  case_id: integer('case_id').notNull().references(() => cases.case_id, { onDelete: 'cascade' }),
  user_id: integer('user_id').notNull().references(() => users.user_id, { onDelete: 'cascade' }),
  role_in_case: text('role_in_case').notNull(), // CHECK: primary_clinician | reviewing_clinician | psychometrist | receptionist
  assigned_by_user_id: integer('assigned_by_user_id').notNull().references(() => users.user_id),
  assigned_at: text('assigned_at').notNull().default(sql`CURRENT_DATE`),
  completed_at: text('completed_at'),
}, (table) => [
  uniqueIndex('idx_case_assignments_unique').on(table.case_id, table.user_id, table.role_in_case),
  index('idx_case_assignments_case_id').on(table.case_id),
  index('idx_case_assignments_user_id').on(table.user_id),
  index('idx_case_assignments_role_in_case').on(table.role_in_case),
])
