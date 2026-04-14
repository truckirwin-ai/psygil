-- Psygil: AI-Powered Evaluation Report Writing Tool
-- Comprehensive SQLite Database Schema
-- Purpose: Support forensic and clinical psychology evaluation workflows with litigation-defensible audit trails
-- SQLCipher-compatible (pragma key recommended for deployment)

-- ============================================================================
-- PRAGMA SETTINGS
-- ============================================================================
-- Enable foreign keys (required for referential integrity)
PRAGMA foreign_keys = ON;

-- ============================================================================
-- 1. USER MANAGEMENT
-- ============================================================================

CREATE TABLE users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('psychologist', 'psychometrist', 'admin')),
    specializations TEXT,
    credentials TEXT,
    license_number TEXT,
    state_licensed TEXT,
    organization TEXT,
    is_active BOOLEAN NOT NULL DEFAULT 1,
    created_at DATE NOT NULL DEFAULT CURRENT_DATE,
    last_login DATE,
    deleted_at DATE,

    CONSTRAINT valid_role CHECK (role IN ('psychologist', 'psychometrist', 'admin'))
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_is_active ON users(is_active);

-- ============================================================================
-- 2. CONFIGURATION TABLES
-- ============================================================================

-- Diagnosis catalog: built-in and custom diagnoses with DSM-5-TR codes
CREATE TABLE diagnosis_catalog (
    diagnosis_id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    dsm5tr_code TEXT,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    is_builtin BOOLEAN NOT NULL DEFAULT 1,
    created_by_user_id INTEGER,
    created_at DATE NOT NULL DEFAULT CURRENT_DATE,

    FOREIGN KEY (created_by_user_id) REFERENCES users(user_id),
    CONSTRAINT valid_diagnosis_code CHECK (LENGTH(code) > 0)
);

CREATE INDEX idx_diagnosis_catalog_code ON diagnosis_catalog(code);
CREATE INDEX idx_diagnosis_catalog_dsm5tr_code ON diagnosis_catalog(dsm5tr_code);
CREATE INDEX idx_diagnosis_catalog_is_builtin ON diagnosis_catalog(is_builtin);

-- Instrument library: standardized tests and measures
CREATE TABLE instrument_library (
    instrument_id INTEGER PRIMARY KEY AUTOINCREMENT,
    abbreviation TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    description TEXT,
    what_it_measures TEXT,
    publisher TEXT,
    publication_year INTEGER,
    scoring_method TEXT,
    time_to_administer_minutes INTEGER,
    is_active BOOLEAN NOT NULL DEFAULT 1,
    created_at DATE NOT NULL DEFAULT CURRENT_DATE,

    CONSTRAINT valid_abbreviation CHECK (LENGTH(abbreviation) > 0),
    CONSTRAINT valid_full_name CHECK (LENGTH(full_name) > 0)
);

CREATE INDEX idx_instrument_library_abbreviation ON instrument_library(abbreviation);
CREATE INDEX idx_instrument_library_is_active ON instrument_library(is_active);

-- Diagnosis-to-instrument mappings: which tests are relevant for which diagnoses
CREATE TABLE diagnosis_instrument_mappings (
    mapping_id INTEGER PRIMARY KEY AUTOINCREMENT,
    diagnosis_id INTEGER NOT NULL,
    instrument_id INTEGER NOT NULL,
    relevance_score REAL DEFAULT 1.0,
    is_primary BOOLEAN DEFAULT 0,
    notes TEXT,

    FOREIGN KEY (diagnosis_id) REFERENCES diagnosis_catalog(diagnosis_id) ON DELETE CASCADE,
    FOREIGN KEY (instrument_id) REFERENCES instrument_library(instrument_id) ON DELETE CASCADE,
    UNIQUE (diagnosis_id, instrument_id)
);

CREATE INDEX idx_diagnosis_instrument_mappings_diagnosis_id ON diagnosis_instrument_mappings(diagnosis_id);
CREATE INDEX idx_diagnosis_instrument_mappings_instrument_id ON diagnosis_instrument_mappings(instrument_id);

-- Practice profile presets: templates for different evaluation types
CREATE TABLE practice_profiles (
    profile_id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_name TEXT NOT NULL UNIQUE,
    profile_type TEXT NOT NULL CHECK (profile_type IN ('forensic_criminal', 'forensic_civil', 'clinical_general', 'neuropsych')),
    description TEXT,
    default_diagnoses TEXT,
    default_instruments TEXT,
    standard_sections TEXT,
    created_by_user_id INTEGER NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT 1,
    created_at DATE NOT NULL DEFAULT CURRENT_DATE,

    FOREIGN KEY (created_by_user_id) REFERENCES users(user_id)
);

CREATE INDEX idx_practice_profiles_profile_type ON practice_profiles(profile_type);
CREATE INDEX idx_practice_profiles_is_active ON practice_profiles(is_active);

-- Report templates: multiple templates per evaluation type
CREATE TABLE report_templates (
    template_id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_name TEXT NOT NULL,
    evaluation_type TEXT NOT NULL,
    template_content TEXT,
    sections TEXT,
    jurisdiction TEXT,
    created_by_user_id INTEGER NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT 1,
    version INTEGER DEFAULT 1,
    created_at DATE NOT NULL DEFAULT CURRENT_DATE,

    FOREIGN KEY (created_by_user_id) REFERENCES users(user_id)
);

CREATE INDEX idx_report_templates_evaluation_type ON report_templates(evaluation_type);
CREATE INDEX idx_report_templates_jurisdiction ON report_templates(jurisdiction);
CREATE INDEX idx_report_templates_is_active ON report_templates(is_active);

-- Style rules: pre-computed writing guidance from samples
CREATE TABLE style_rules (
    rule_id INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_name TEXT NOT NULL UNIQUE,
    rule_content TEXT NOT NULL,
    category TEXT,
    guardrails TEXT,
    examples TEXT,
    created_at DATE NOT NULL DEFAULT CURRENT_DATE,
    updated_at DATE DEFAULT CURRENT_DATE
);

CREATE INDEX idx_style_rules_category ON style_rules(category);

-- ============================================================================
-- 3. CASE MANAGEMENT
-- ============================================================================

-- Cases: primary entity for multi-session evaluations
CREATE TABLE cases (
    case_id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_number TEXT NOT NULL UNIQUE,
    primary_clinician_user_id INTEGER NOT NULL,
    examinee_first_name TEXT NOT NULL,
    examinee_last_name TEXT NOT NULL,
    examinee_dob DATE,
    examinee_gender TEXT,
    cultural_context TEXT,
    linguistic_context TEXT,
    evaluation_type TEXT,
    practice_profile_id INTEGER,
    referral_source TEXT,
    evaluation_questions TEXT,
    case_status TEXT NOT NULL DEFAULT 'intake'
        CHECK (case_status IN ('intake', 'in_progress', 'completed', 'archived')),
    workflow_current_stage TEXT DEFAULT 'gate_1'
        CHECK (workflow_current_stage IN ('gate_1', 'gate_2', 'gate_3', 'finalized')),
    created_at DATE NOT NULL DEFAULT CURRENT_DATE,
    last_modified DATE DEFAULT CURRENT_DATE,
    completed_at DATE,
    notes TEXT,

    FOREIGN KEY (primary_clinician_user_id) REFERENCES users(user_id),
    FOREIGN KEY (practice_profile_id) REFERENCES practice_profiles(profile_id)
);

CREATE INDEX idx_cases_primary_clinician_user_id ON cases(primary_clinician_user_id);
CREATE INDEX idx_cases_case_status ON cases(case_status);
CREATE INDEX idx_cases_workflow_current_stage ON cases(workflow_current_stage);
CREATE INDEX idx_cases_created_at ON cases(created_at);
CREATE INDEX idx_cases_case_number ON cases(case_number);

-- Sessions: individual evaluation sessions within a case
CREATE TABLE sessions (
    session_id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id INTEGER NOT NULL,
    session_number INTEGER NOT NULL,
    session_date DATE NOT NULL,
    clinician_user_id INTEGER NOT NULL,
    psychometrist_user_id INTEGER,
    duration_minutes INTEGER,
    session_notes TEXT,
    behavioral_observations TEXT,
    rapport_quality TEXT,
    created_at DATE NOT NULL DEFAULT CURRENT_DATE,

    FOREIGN KEY (case_id) REFERENCES cases(case_id) ON DELETE CASCADE,
    FOREIGN KEY (clinician_user_id) REFERENCES users(user_id),
    FOREIGN KEY (psychometrist_user_id) REFERENCES users(user_id),
    UNIQUE (case_id, session_number),
    CONSTRAINT valid_duration CHECK (duration_minutes IS NULL OR duration_minutes > 0)
);

CREATE INDEX idx_sessions_case_id ON sessions(case_id);
CREATE INDEX idx_sessions_session_date ON sessions(session_date);
CREATE INDEX idx_sessions_clinician_user_id ON sessions(clinician_user_id);

-- ============================================================================
-- 4. DOCUMENTS & TEST DATA
-- ============================================================================

-- Documents: uploaded files (PDFs, DOCX, VTT transcripts, audio)
CREATE TABLE documents (
    document_id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id INTEGER NOT NULL,
    session_id INTEGER,
    document_type TEXT NOT NULL
        CHECK (document_type IN ('referral', 'pdf', 'docx', 'transcript_vtt', 'audio', 'score_report', 'medical_record', 'other')),
    original_filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size_bytes INTEGER,
    mime_type TEXT,
    uploaded_by_user_id INTEGER NOT NULL,
    upload_date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT,
    indexed_content TEXT,

    FOREIGN KEY (case_id) REFERENCES cases(case_id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE SET NULL,
    FOREIGN KEY (uploaded_by_user_id) REFERENCES users(user_id)
);

CREATE INDEX idx_documents_case_id ON documents(case_id);
CREATE INDEX idx_documents_session_id ON documents(session_id);
CREATE INDEX idx_documents_document_type ON documents(document_type);
CREATE INDEX idx_documents_upload_date ON documents(upload_date);

-- FTS5 virtual table for full-text search on documents
CREATE VIRTUAL TABLE documents_fts USING fts5(
    document_id UNINDEXED,
    original_filename,
    indexed_content,
    content=documents,
    content_rowid=document_id
);

-- Test administrations: instrument scores from publisher reports
CREATE TABLE test_administrations (
    test_admin_id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id INTEGER NOT NULL,
    session_id INTEGER,
    instrument_id INTEGER NOT NULL,
    administration_date DATE NOT NULL,
    administered_by_user_id INTEGER NOT NULL,
    score_report_document_id INTEGER,
    raw_score REAL,
    standard_score REAL,
    percentile INTEGER,
    scaled_score REAL,
    t_score REAL,
    confidence_interval_lower REAL,
    confidence_interval_upper REAL,
    interpretation TEXT,
    notes TEXT,
    data_entry_method TEXT
        CHECK (data_entry_method IN ('manual', 'qglobal_import', 'pariconnect_import', 'pdf_extraction')),
    created_at DATE NOT NULL DEFAULT CURRENT_DATE,

    FOREIGN KEY (case_id) REFERENCES cases(case_id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE SET NULL,
    FOREIGN KEY (instrument_id) REFERENCES instrument_library(instrument_id),
    FOREIGN KEY (administered_by_user_id) REFERENCES users(user_id),
    FOREIGN KEY (score_report_document_id) REFERENCES documents(document_id) ON DELETE SET NULL
);

CREATE INDEX idx_test_administrations_case_id ON test_administrations(case_id);
CREATE INDEX idx_test_administrations_instrument_id ON test_administrations(instrument_id);
CREATE INDEX idx_test_administrations_administration_date ON test_administrations(administration_date);

-- ============================================================================
-- 5. WORKFLOW & GATE SYSTEM
-- ============================================================================

-- Gate reviews: Gate 1 (data confirmation), Gate 2 (diagnostic decision), Gate 3 (attestation)
CREATE TABLE gate_reviews (
    gate_review_id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id INTEGER NOT NULL,
    gate_number INTEGER NOT NULL CHECK (gate_number IN (1, 2, 3)),
    gate_purpose TEXT NOT NULL,
    reviewer_user_id INTEGER NOT NULL,
    review_date DATE NOT NULL DEFAULT CURRENT_DATE,
    review_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (review_status IN ('pending', 'in_progress', 'completed', 'requires_revision')),
    notes TEXT,

    FOREIGN KEY (case_id) REFERENCES cases(case_id) ON DELETE CASCADE,
    FOREIGN KEY (reviewer_user_id) REFERENCES users(user_id),
    UNIQUE (case_id, gate_number)
);

CREATE INDEX idx_gate_reviews_case_id ON gate_reviews(case_id);
CREATE INDEX idx_gate_reviews_gate_number ON gate_reviews(gate_number);
CREATE INDEX idx_gate_reviews_review_status ON gate_reviews(review_status);

-- Gate decisions: individual decisions within a gate (e.g., diagnoses selected at Gate 2)
CREATE TABLE gate_decisions (
    decision_id INTEGER PRIMARY KEY AUTOINCREMENT,
    gate_review_id INTEGER NOT NULL,
    case_id INTEGER NOT NULL,
    decision_type TEXT NOT NULL
        CHECK (decision_type IN ('data_confirmed', 'diagnosis_selected', 'diagnosis_ruled_out', 'attestation', 'other')),
    subject_entity_type TEXT,
    subject_entity_id INTEGER,
    actor_user_id INTEGER NOT NULL,
    decision_rationale TEXT,
    decision_date DATE NOT NULL DEFAULT CURRENT_DATE,
    is_final BOOLEAN DEFAULT 0,

    FOREIGN KEY (gate_review_id) REFERENCES gate_reviews(gate_review_id) ON DELETE CASCADE,
    FOREIGN KEY (case_id) REFERENCES cases(case_id) ON DELETE CASCADE,
    FOREIGN KEY (actor_user_id) REFERENCES users(user_id)
);

CREATE INDEX idx_gate_decisions_gate_review_id ON gate_decisions(gate_review_id);
CREATE INDEX idx_gate_decisions_case_id ON gate_decisions(case_id);
CREATE INDEX idx_gate_decisions_decision_type ON gate_decisions(decision_type);
CREATE INDEX idx_gate_decisions_actor_user_id ON gate_decisions(actor_user_id);

-- ============================================================================
-- 6. DIAGNOSES (CLINICIAN-SELECTED ONLY)
-- ============================================================================

-- Diagnoses: clinician selections at Gate 2 (NEVER AI-selected)
CREATE TABLE diagnoses (
    diagnosis_record_id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id INTEGER NOT NULL,
    diagnosis_id INTEGER NOT NULL,
    selected_at_gate_2 BOOLEAN DEFAULT 1,
    clinician_user_id INTEGER NOT NULL,
    confidence_level TEXT CHECK (confidence_level IN ('high', 'moderate', 'low')),
    supporting_evidence TEXT,
    selection_date DATE NOT NULL DEFAULT CURRENT_DATE,
    is_primary_diagnosis BOOLEAN DEFAULT 0,
    rule_out_rationale TEXT,

    FOREIGN KEY (case_id) REFERENCES cases(case_id) ON DELETE CASCADE,
    FOREIGN KEY (diagnosis_id) REFERENCES diagnosis_catalog(diagnosis_id),
    FOREIGN KEY (clinician_user_id) REFERENCES users(user_id)
);

CREATE INDEX idx_diagnoses_case_id ON diagnoses(case_id);
CREATE INDEX idx_diagnoses_diagnosis_id ON diagnoses(diagnosis_id);
CREATE INDEX idx_diagnoses_clinician_user_id ON diagnoses(clinician_user_id);
CREATE INDEX idx_diagnoses_selected_at_gate_2 ON diagnoses(selected_at_gate_2);

-- ============================================================================
-- 7. AGENT SYSTEM & PROCESSING
-- ============================================================================

-- Agent runs: log of each agent invocation with input/output hashing
CREATE TABLE agent_runs (
    agent_run_id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id INTEGER NOT NULL,
    agent_type TEXT NOT NULL
        CHECK (agent_type IN ('diagnostician', 'writer', 'validator')),
    agent_version TEXT,
    input_hash TEXT,
    input_summary TEXT,
    output_hash TEXT,
    output_summary TEXT,
    duration_seconds REAL,
    status TEXT NOT NULL DEFAULT 'success'
        CHECK (status IN ('success', 'partial_success', 'failed', 'error')),
    error_message TEXT,
    invoked_by_user_id INTEGER NOT NULL,
    started_at DATE NOT NULL DEFAULT CURRENT_DATE,
    completed_at DATE,

    FOREIGN KEY (case_id) REFERENCES cases(case_id) ON DELETE CASCADE,
    FOREIGN KEY (invoked_by_user_id) REFERENCES users(user_id)
);

CREATE INDEX idx_agent_runs_case_id ON agent_runs(case_id);
CREATE INDEX idx_agent_runs_agent_type ON agent_runs(agent_type);
CREATE INDEX idx_agent_runs_status ON agent_runs(status);
CREATE INDEX idx_agent_runs_started_at ON agent_runs(started_at);

-- Evidence maps: Diagnostician Agent output mapping criteria to evidence per diagnosis
CREATE TABLE evidence_maps (
    evidence_map_id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_run_id INTEGER NOT NULL,
    case_id INTEGER NOT NULL,
    diagnosis_id INTEGER NOT NULL,
    criterion_name TEXT NOT NULL,
    criterion_description TEXT,
    supporting_evidence TEXT,
    contradicting_evidence TEXT,
    evidence_strength TEXT CHECK (evidence_strength IN ('strong', 'moderate', 'weak', 'absent')),
    confidence_score REAL,
    source_documents TEXT,
    created_at DATE NOT NULL DEFAULT CURRENT_DATE,

    FOREIGN KEY (agent_run_id) REFERENCES agent_runs(agent_run_id) ON DELETE CASCADE,
    FOREIGN KEY (case_id) REFERENCES cases(case_id) ON DELETE CASCADE,
    FOREIGN KEY (diagnosis_id) REFERENCES diagnosis_catalog(diagnosis_id)
);

CREATE INDEX idx_evidence_maps_agent_run_id ON evidence_maps(agent_run_id);
CREATE INDEX idx_evidence_maps_case_id ON evidence_maps(case_id);
CREATE INDEX idx_evidence_maps_diagnosis_id ON evidence_maps(diagnosis_id);

-- Writer drafts: Writer Agent output sections with content classification
CREATE TABLE writer_drafts (
    draft_id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_run_id INTEGER NOT NULL,
    case_id INTEGER NOT NULL,
    section_name TEXT NOT NULL,
    section_content TEXT NOT NULL,
    content_type TEXT NOT NULL
        CHECK (content_type IN ('fully_generated', 'draft_requiring_revision')),
    revision_status TEXT DEFAULT 'pending'
        CHECK (revision_status IN ('pending', 'reviewed', 'approved', 'revised')),
    reviewer_user_id INTEGER,
    review_notes TEXT,
    created_at DATE NOT NULL DEFAULT CURRENT_DATE,
    reviewed_at DATE,

    FOREIGN KEY (agent_run_id) REFERENCES agent_runs(agent_run_id) ON DELETE CASCADE,
    FOREIGN KEY (case_id) REFERENCES cases(case_id) ON DELETE CASCADE,
    FOREIGN KEY (reviewer_user_id) REFERENCES users(user_id)
);

CREATE INDEX idx_writer_drafts_agent_run_id ON writer_drafts(agent_run_id);
CREATE INDEX idx_writer_drafts_case_id ON writer_drafts(case_id);
CREATE INDEX idx_writer_drafts_content_type ON writer_drafts(content_type);
CREATE INDEX idx_writer_drafts_revision_status ON writer_drafts(revision_status);

-- FTS5 for full-text search on writer drafts
CREATE VIRTUAL TABLE writer_drafts_fts USING fts5(
    draft_id UNINDEXED,
    section_name,
    section_content,
    content=writer_drafts,
    content_rowid=draft_id
);

-- ============================================================================
-- 8. REPORTS
-- ============================================================================

-- Reports: generated .docx files with version history and finalization
CREATE TABLE reports (
    report_id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id INTEGER NOT NULL,
    report_version INTEGER NOT NULL DEFAULT 1,
    template_id INTEGER,
    generated_by_user_id INTEGER NOT NULL,
    created_at DATE NOT NULL DEFAULT CURRENT_DATE,
    last_modified DATE DEFAULT CURRENT_DATE,
    finalized_by_user_id INTEGER,
    finalized_at DATE,
    is_locked BOOLEAN DEFAULT 0,
    integrity_hash TEXT,
    sealed_pdf_path TEXT,
    file_path TEXT NOT NULL,
    file_size_bytes INTEGER,
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'in_review', 'revisions_needed', 'approved', 'finalized')),

    FOREIGN KEY (case_id) REFERENCES cases(case_id) ON DELETE CASCADE,
    FOREIGN KEY (template_id) REFERENCES report_templates(template_id) ON DELETE SET NULL,
    FOREIGN KEY (generated_by_user_id) REFERENCES users(user_id),
    FOREIGN KEY (finalized_by_user_id) REFERENCES users(user_id)
);

CREATE INDEX idx_reports_case_id ON reports(case_id);
CREATE INDEX idx_reports_report_version ON reports(report_version);
CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_reports_created_at ON reports(created_at);
CREATE INDEX idx_reports_is_locked ON reports(is_locked);

-- Report revisions: audit trail of report changes and reviews
CREATE TABLE report_revisions (
    revision_id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id INTEGER NOT NULL,
    revision_number INTEGER NOT NULL,
    changed_by_user_id INTEGER NOT NULL,
    revision_date DATE NOT NULL DEFAULT CURRENT_DATE,
    change_summary TEXT,
    previous_integrity_hash TEXT,
    new_integrity_hash TEXT,

    FOREIGN KEY (report_id) REFERENCES reports(report_id) ON DELETE CASCADE,
    FOREIGN KEY (changed_by_user_id) REFERENCES users(user_id),
    UNIQUE (report_id, revision_number)
);

CREATE INDEX idx_report_revisions_report_id ON report_revisions(report_id);
CREATE INDEX idx_report_revisions_changed_by_user_id ON report_revisions(changed_by_user_id);

-- ============================================================================
-- 9. AUDIT TRAIL (Litigation-Defensible)
-- ============================================================================

-- Audit log: configurable granularity, DATE-based not minute-level
-- NEVER stores rejected diagnostic options (legal requirement)
CREATE TABLE audit_log (
    audit_log_id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id INTEGER NOT NULL,
    action_type TEXT NOT NULL
        CHECK (action_type IN (
            'case_created',
            'case_modified',
            'session_added',
            'document_uploaded',
            'test_score_entered',
            'diagnosis_selected',
            'gate_completed',
            'agent_invoked',
            'report_generated',
            'report_finalized',
            'attestation_signed',
            'audit_export'
        )),
    actor_user_id INTEGER NOT NULL,
    action_date DATE NOT NULL DEFAULT CURRENT_DATE,
    details TEXT,
    related_entity_type TEXT,
    related_entity_id INTEGER,
    granularity TEXT DEFAULT 'decision_record_only'
        CHECK (granularity IN ('decision_record_only', 'full_detail')),

    FOREIGN KEY (case_id) REFERENCES cases(case_id) ON DELETE CASCADE,
    FOREIGN KEY (actor_user_id) REFERENCES users(user_id)
);

CREATE INDEX idx_audit_log_case_id ON audit_log(case_id);
CREATE INDEX idx_audit_log_action_date ON audit_log(action_date);
CREATE INDEX idx_audit_log_actor_user_id ON audit_log(actor_user_id);
CREATE INDEX idx_audit_log_action_type ON audit_log(action_type);

-- FTS5 for full-text search on audit logs
CREATE VIRTUAL TABLE audit_log_fts USING fts5(
    audit_log_id UNINDEXED,
    action_type,
    details,
    content=audit_log,
    content_rowid=audit_log_id
);

-- ============================================================================
-- 10. PEER CONSULTATION
-- ============================================================================

-- Peer consultation records: collaborative case review
CREATE TABLE peer_consultations (
    consultation_id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id INTEGER NOT NULL,
    initiating_clinician_user_id INTEGER NOT NULL,
    consulting_clinician_user_id INTEGER NOT NULL,
    consultation_date DATE NOT NULL DEFAULT CURRENT_DATE,
    consultation_topic TEXT,
    consultation_notes TEXT,
    consultation_response TEXT,
    response_date DATE,

    FOREIGN KEY (case_id) REFERENCES cases(case_id) ON DELETE CASCADE,
    FOREIGN KEY (initiating_clinician_user_id) REFERENCES users(user_id),
    FOREIGN KEY (consulting_clinician_user_id) REFERENCES users(user_id),
    CONSTRAINT different_clinicians CHECK (initiating_clinician_user_id != consulting_clinician_user_id)
);

CREATE INDEX idx_peer_consultations_case_id ON peer_consultations(case_id);
CREATE INDEX idx_peer_consultations_initiating_clinician_user_id ON peer_consultations(initiating_clinician_user_id);
CREATE INDEX idx_peer_consultations_consulting_clinician_user_id ON peer_consultations(consulting_clinician_user_id);

-- ============================================================================
-- 11. REFERRAL DATA
-- ============================================================================

-- Referral documents: extract key data from referral sources
CREATE TABLE referral_sources (
    referral_id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id INTEGER NOT NULL,
    referral_document_id INTEGER,
    referral_source_name TEXT NOT NULL,
    referral_source_type TEXT
        CHECK (referral_source_type IN ('attorney', 'court', 'medical', 'insurance', 'self_referred', 'other')),
    referral_date DATE,
    evaluation_questions TEXT,
    specific_concerns TEXT,
    requesting_party TEXT,

    FOREIGN KEY (case_id) REFERENCES cases(case_id) ON DELETE CASCADE,
    FOREIGN KEY (referral_document_id) REFERENCES documents(document_id) ON DELETE SET NULL
);

CREATE INDEX idx_referral_sources_case_id ON referral_sources(case_id);
CREATE INDEX idx_referral_sources_referral_source_type ON referral_sources(referral_source_type);

-- ============================================================================
-- 12. BACKUP & ARCHIVAL METADATA
-- ============================================================================

-- Backup metadata: system-level backup records for compliance
CREATE TABLE backup_metadata (
    backup_id INTEGER PRIMARY KEY AUTOINCREMENT,
    backup_date DATE NOT NULL DEFAULT CURRENT_DATE,
    backup_type TEXT NOT NULL
        CHECK (backup_type IN ('full', 'incremental', 'export')),
    backup_path TEXT NOT NULL,
    case_count INTEGER,
    file_size_bytes INTEGER,
    integrity_hash TEXT,
    created_by_user_id INTEGER,
    notes TEXT,

    FOREIGN KEY (created_by_user_id) REFERENCES users(user_id)
);

CREATE INDEX idx_backup_metadata_backup_date ON backup_metadata(backup_date);
CREATE INDEX idx_backup_metadata_backup_type ON backup_metadata(backup_type);

-- ============================================================================
-- 13. CASE NOTES (Full-Text Search Support)
-- ============================================================================

-- Case notes: clinical notes and observations with FTS support
CREATE TABLE case_notes (
    case_note_id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id INTEGER NOT NULL,
    session_id INTEGER,
    created_by_user_id INTEGER NOT NULL,
    note_content TEXT NOT NULL,
    note_type TEXT
        CHECK (note_type IN ('clinical', 'administrative', 'diagnostic_reasoning', 'test_interpretation')),
    created_at DATE NOT NULL DEFAULT CURRENT_DATE,

    FOREIGN KEY (case_id) REFERENCES cases(case_id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE SET NULL,
    FOREIGN KEY (created_by_user_id) REFERENCES users(user_id)
);

CREATE INDEX idx_case_notes_case_id ON case_notes(case_id);
CREATE INDEX idx_case_notes_session_id ON case_notes(session_id);
CREATE INDEX idx_case_notes_created_at ON case_notes(created_at);

-- FTS5 for full-text search on case notes
CREATE VIRTUAL TABLE case_notes_fts USING fts5(
    case_note_id UNINDEXED,
    note_content,
    content=case_notes,
    content_rowid=case_note_id
);

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- View: Active cases with primary clinician and current workflow stage
CREATE VIEW v_active_cases AS
SELECT
    c.case_id,
    c.case_number,
    c.primary_clinician_user_id,
    u.full_name AS clinician_name,
    c.examinee_first_name,
    c.examinee_last_name,
    c.workflow_current_stage,
    c.case_status,
    COUNT(DISTINCT s.session_id) AS session_count,
    COUNT(DISTINCT d.document_id) AS document_count,
    c.created_at,
    c.last_modified
FROM cases c
LEFT JOIN users u ON c.primary_clinician_user_id = u.user_id
LEFT JOIN sessions s ON c.case_id = s.case_id
LEFT JOIN documents d ON c.case_id = d.case_id
WHERE c.case_status IN ('intake', 'in_progress')
GROUP BY c.case_id;

-- View: Case progress with gate completion status
CREATE VIEW v_case_progress AS
SELECT
    c.case_id,
    c.case_number,
    c.workflow_current_stage,
    COALESCE(g1.review_status, 'pending') AS gate_1_status,
    COALESCE(g2.review_status, 'pending') AS gate_2_status,
    COALESCE(g3.review_status, 'pending') AS gate_3_status,
    COUNT(DISTINCT r.report_id) AS report_count,
    MAX(CASE WHEN r.status = 'finalized' THEN r.finalized_at END) AS last_finalization_date
FROM cases c
LEFT JOIN gate_reviews g1 ON c.case_id = g1.case_id AND g1.gate_number = 1
LEFT JOIN gate_reviews g2 ON c.case_id = g2.case_id AND g2.gate_number = 2
LEFT JOIN gate_reviews g3 ON c.case_id = g3.case_id AND g3.gate_number = 3
LEFT JOIN reports r ON c.case_id = r.case_id
GROUP BY c.case_id;

-- View: Diagnostician work queue (cases requiring diagnosis decision)
CREATE VIEW v_diagnostic_queue AS
SELECT
    c.case_id,
    c.case_number,
    c.examinee_first_name,
    c.examinee_last_name,
    c.primary_clinician_user_id,
    u.full_name AS clinician_name,
    COUNT(DISTINCT t.test_admin_id) AS test_count,
    COUNT(DISTINCT d.document_id) AS document_count,
    g2.review_status,
    g2.reviewer_user_id,
    c.created_at
FROM cases c
LEFT JOIN users u ON c.primary_clinician_user_id = u.user_id
LEFT JOIN test_administrations t ON c.case_id = t.case_id
LEFT JOIN documents d ON c.case_id = d.case_id
LEFT JOIN gate_reviews g2 ON c.case_id = g2.case_id AND g2.gate_number = 2
WHERE c.workflow_current_stage = 'gate_2'
GROUP BY c.case_id;

-- View: Report finalization queue (reports awaiting approval)
CREATE VIEW v_finalization_queue AS
SELECT
    r.report_id,
    r.case_id,
    c.case_number,
    c.examinee_first_name,
    c.examinee_last_name,
    r.report_version,
    r.status,
    r.created_at,
    u_gen.full_name AS generated_by,
    COUNT(DISTINCT rev.revision_id) AS revision_count
FROM reports r
LEFT JOIN cases c ON r.case_id = c.case_id
LEFT JOIN users u_gen ON r.generated_by_user_id = u_gen.user_id
LEFT JOIN report_revisions rev ON r.report_id = rev.report_id
WHERE r.status IN ('in_review', 'revisions_needed')
GROUP BY r.report_id
ORDER BY r.created_at ASC;

-- ============================================================================
-- TRIGGER: Auto-update last_modified timestamp on cases
-- ============================================================================

CREATE TRIGGER tr_cases_update_last_modified
AFTER UPDATE ON cases
FOR EACH ROW
BEGIN
    UPDATE cases SET last_modified = CURRENT_DATE WHERE case_id = NEW.case_id;
END;

-- ============================================================================
-- TRIGGER: Auto-log gate completion to audit trail
-- ============================================================================

CREATE TRIGGER tr_gate_review_audit
AFTER UPDATE ON gate_reviews
FOR EACH ROW
WHEN NEW.review_status = 'completed' AND OLD.review_status != 'completed'
BEGIN
    INSERT INTO audit_log (case_id, action_type, actor_user_id, details)
    VALUES (
        NEW.case_id,
        'gate_completed',
        NEW.reviewer_user_id,
        'Gate ' || NEW.gate_number || ' completed with status: ' || NEW.review_status
    );
END;

-- ============================================================================
-- TRIGGER: Auto-log diagnosis selection to audit trail
-- ============================================================================

CREATE TRIGGER tr_diagnosis_audit
AFTER INSERT ON diagnoses
FOR EACH ROW
BEGIN
    INSERT INTO audit_log (case_id, action_type, actor_user_id, details, related_entity_type, related_entity_id)
    VALUES (
        NEW.case_id,
        'diagnosis_selected',
        NEW.clinician_user_id,
        'Diagnosis: ' || NEW.diagnosis_id || ' selected with confidence: ' || NEW.confidence_level,
        'diagnosis',
        NEW.diagnosis_record_id
    );
END;

-- ============================================================================
-- TRIGGER: Auto-log report finalization to audit trail
-- ============================================================================

CREATE TRIGGER tr_report_finalization_audit
AFTER UPDATE ON reports
FOR EACH ROW
WHEN NEW.status = 'finalized' AND OLD.status != 'finalized'
BEGIN
    INSERT INTO audit_log (case_id, action_type, actor_user_id, details, related_entity_type, related_entity_id)
    VALUES (
        NEW.case_id,
        'report_finalized',
        NEW.finalized_by_user_id,
        'Report version ' || NEW.report_version || ' finalized with integrity hash: ' || NEW.integrity_hash,
        'report',
        NEW.report_id
    );
END;

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
-- This schema is designed to support forensic and clinical psychology
-- evaluation workflows with comprehensive audit trails, multi-stage workflow
-- gates, AI-agent integration points, and litigation-defensible record keeping.
--
-- Key Design Principles:
-- 1. Clinician diagnostic authority (Gate 2 decisions are clinician-only)
-- 2. Comprehensive audit trail with granularity control
-- 3. Never stores rejected diagnostic options
-- 4. DATE-based timestamps by default (not minute-level)
-- 5. Full-text search on clinical notes and report content
-- 6. Agent integration with input/output hashing
-- 7. Multi-version report management with integrity hashing
-- 8. Litigation-defensible with version history and formal gates
-- ============================================================================
