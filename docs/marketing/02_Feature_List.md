# Psygil Feature List
**Version:** 1.0
**Updated:** April 17, 2026
**Classification:** Marketing-ready

---

## Headline

**The only evaluation platform built for legally defensible forensic and clinical psychology reports.**

Psygil cuts report writing time by 90% while keeping the clinician in control of every diagnostic decision. Local-first architecture means your patient data never leaves your machine.

---

## Core Features

### 1. Gate-Based Diagnostic Decision Workflow
**No other platform has this.**

A structured 6-stage clinical pipeline (Onboarding, Testing, Interview, Diagnostics, Review, Complete) with built-in decision gates at each transition. The clinician must confirm all prerequisites before advancing. Every gate decision is logged in the tamper-evident audit trail.

This is not a linear template. It is a clinical decision framework that mirrors how evaluations actually proceed, with enforced checkpoints that prevent premature conclusions.

*Competitive advantage: No competitor offers structured clinical decision gates. PsychAssist, Psynth, and others generate reports from inputs without enforcing a clinical workflow.*

---

### 2. AI-Powered Report Generation (Doctor Always Diagnoses)
Write complete forensic evaluation reports in under 35 minutes instead of 6-8 hours.

Four specialized AI agents work in sequence:
- **Ingestor**: Extracts and organizes case data from uploaded documents, intake forms, and clinical notes
- **Diagnostician**: Presents differential diagnosis options with supporting evidence; the clinician makes every diagnostic decision
- **Writer**: Generates a complete draft report using the clinician's confirmed diagnoses, test data, and clinical observations
- **Editor**: Reviews the draft for consistency, factual accuracy, speculative language, and clinical standards compliance

The AI never makes diagnostic conclusions. Every clinical decision is made by the licensed clinician and recorded with full attribution in the audit trail.

---

### 3. Integrated Peer Review Module
**No other platform has this.**

Built-in peer review workflow with structured annotation, severity-graded flags (critical, high, medium, low), and section-by-section review tracking. The Editor Agent performs an automated first pass; human reviewers can add, dismiss, or escalate flags before the report is finalized.

Peer review is not optional. It is architecturally integrated into the report workflow as a required step before attestation and publication.

*Competitive advantage: No competitor has a structured peer review step built into the report workflow.*

---

### 4. UNID Redaction Pipeline (PHI Protection)
All patient data is redacted before any AI API call.

The UNID (Universal Non-Identifying Descriptor) system replaces every piece of protected health information with cryptographic single-use tokens before text is sent to the AI model. Names, dates, locations, SSNs, phone numbers, and 18 HIPAA identifier categories are detected and replaced using Microsoft Presidio and spaCy NLP running locally on your machine.

After the AI generates its output, tokens are rehydrated back to the original values locally. The AI model never sees real patient data.

---

### 5. Local-First Encrypted Database
All case data stays on your machine. Always.

- SQLCipher AES-256 encryption at rest
- Argon2id key derivation (OWASP-recommended)
- No cloud storage of patient data
- No data transmitted to third-party servers
- Data ownership: 100% yours, always

*Competitive advantage: PAR's AI Report Writer EULA grants PAR a license to use your inputs and outputs to train their AI. Psygil has no mechanism to access your data because it never leaves your device.*

---

### 6. Assessment Library (43+ Instruments)
Comprehensive psychometric instrument support across forensic, neuropsychological, clinical, and specialized domains.

**Forensic Core:** MMPI-3, PAI, MCMI-IV, MacCAT-CA, ECST-R, PSI-4
**Malingering/Effort:** SIRS-2, M-FAST, SIMS, TOMM, FBS
**Risk Assessment:** PCL-R, HCR-20v3, SARA, Static-99R, LSI-R
**Neuropsychological:** WAIS-V, WAIS-IV, WMS-IV, D-KEFS, CVLT-3, MoCA, CPT-3, RBANS, WIAT-4, BRIEF-2
**Clinical:** CAPS-5, PCL-5, TSI-2, DES-II, BDI-II, BAI, CAARS, Conners-3, BASC-3, ADOS-2, PHQ-9, GAD-7
**Adaptive:** ABAS-3, Vineland-3
**Substance:** AUDIT

24 instruments include built-in scoring norms with interpretive bands and validity scale thresholds. All instruments support score import and forensic-contextual interpretation in generated reports.

*Competitive context: Psynth supports 370+ instruments but has no forensic workflow. PsychWriterPro supports 230+. Psygil leads in forensic instrument depth with contextual interpretation that changes based on evaluation type (e.g., a PAI Antisocial score of 85T gets different narrative framing in a custody evaluation vs. a criminal competency evaluation).*

---

### 7. Clinical Voice Learning
Reports that sound like you wrote them, not like an AI wrote them.

Psygil analyzes your past reports to build a clinical voice profile:
- Sentence length and complexity patterns
- Preferred clinical terminology (e.g., "individual" vs. "patient" vs. "examinee")
- Formality register and hedging patterns
- Section ordering preferences
- Signature phrases and writing conventions

The voice profile is stored locally as structured data (not model weights) and injected as few-shot context at generation time. No fine-tuning. No model training. Your writing samples never leave your machine.

*Competitive parity: PsychAssist, Neuroaide, Psynth, and PsychReport.ai all offer voice learning. Psygil matches this capability with the added benefit of fully local processing.*

---

### 8. Word and PDF Export
Export completed reports directly to Microsoft Word (.docx) or PDF format.

- Save-as dialog for choosing export location
- Letter size, 0.75" margins for court submission
- Preserves section structure, headings, and formatting
- Courts and attorneys receive documents in their expected format

*Competitive parity: Neuroaide, PsychReport.ai, and Psynth all offer Word export. Psygil now matches this.*

---

### 9. Live Interview Transcription
Record and transcribe clinical interviews in real time, entirely offline.

- Faster-whisper running locally via Python sidecar
- Sentence-buffered output with timestamps
- No cloud speech services; audio never leaves your device
- Transcripts feed directly into the case file and report generation pipeline
- Structured summary extraction for background and clinical interview sections

*Competitive parity: Assessment Assistant and NovoPsych have cloud-based transcription. Psygil's offline transcription is architecturally superior for forensic use where audio recordings may be legally privileged.*

---

### 10. Tamper-Evident Audit Trail
Every action logged. Every log entry immutable.

- SHA-256 hash chain: each audit entry includes the hash of the previous entry, creating an immutable sequence that detects any tampering
- SQL triggers prevent UPDATE and DELETE on audit records
- Full attribution: clinician actions, AI agent operations, and system events are logged separately with timestamps
- Export to CSV or JSON for court submission
- Chain verification: one-click integrity check confirms no records have been altered

Built for expert testimony. When opposing counsel asks "how do you know the AI didn't make this diagnosis?", the audit trail provides the definitive answer.

---

### 11. Daubert/Frye Legal Standard Support
Reports designed to withstand legal challenge.

- Gate-based workflow enforces methodological rigor
- Every diagnostic decision attributed to the clinician with timestamp
- AI contributions clearly delineated from clinical judgment
- Peer review documentation included in the case record
- No AI artifacts, no watermarks, no "generated by" attribution in output
- Hard Rule enforcement: automated scanning for em dashes, en dashes, and AI-generated language patterns before any report is finalized

*Competitive advantage: Only PsychAssist claims Daubert/Frye support, but without the gate-based workflow and audit trail depth that Psygil provides.*

---

### 12. White-Label Practice Branding
Your reports carry your practice name, not ours.

- Custom practice name on all reports and UI
- Logo upload for report headers and title pages
- Custom primary color for report accents
- Optional tagline/subtitle
- "Powered by Psygil" attribution can be disabled on Enterprise tier

*Competitive advantage: No competitor explicitly offers white-label report branding. For group practices and hospital forensic units, this is a deal requirement.*

---

### 13. 190+ Clinical Formulation Templates
Pre-built formulation templates across 25 diagnostic conditions:

Competency to Stand Trial (CST), Custody Evaluations, Risk Assessment (violence, sexual, domestic), PTSD, Capacity Evaluations, Criminal Responsibility, Fitness for Duty, Immigration Evaluations, Disability Determinations, Personal Injury, Workers' Compensation, Juvenile Transfer, Sex Offender Evaluations, Substance Abuse, Neurocognitive Disorders, Intellectual Disability, Autism Spectrum, ADHD, Mood Disorders, Anxiety Disorders, Personality Disorders, Trauma and Dissociative Disorders, Psychotic Disorders, Malingering Determinations, and Mitigation Evaluations.

Each template provides forensic-specific clinical framing matched to the evaluation context.

---

### 14. Multi-Theme Interface
Professional IDE-grade interface with three themes:

- **Light**: Clean white workspace for bright environments
- **Warm**: Cream parchment palette for extended reading sessions
- **Dark**: Neutral gray for reduced eye strain in dim environments

Form fields and report preview always render on white backgrounds for readability regardless of theme. Theme preference persists across sessions.

---

### 15. Data Privacy Commitment
Explicit, architectural, non-negotiable:

1. Patient data never leaves this device
2. No data is ever used to train AI models
3. You retain 100% ownership of all data and outputs
4. HIPAA-aligned architecture (encryption at rest and in transit)
5. BAA available on request
6. Complete audit trail for every action
7. Audio transcription runs entirely offline

This is not a policy checkbox. It is an architectural commitment. Psygil has no mechanism to access, collect, or train on your patient data because the architecture makes it impossible.

---

## Platform Specifications

| Specification | Detail |
|---|---|
| Platforms | macOS (Apple Silicon + Intel), Windows |
| Architecture | 4-process: Main, Renderer (sandboxed), OnlyOffice, Python Sidecar |
| Database | SQLCipher 4.6 (AES-256 encryption) |
| AI Provider | Anthropic Claude (configurable), OpenAI, Google Gemini |
| Transcription | faster-whisper (local, offline) |
| PHI Protection | UNID redaction (Presidio + spaCy en_core_web_lg) |
| Document Editing | OnlyOffice Document Server (local) |
| Export Formats | Word (.docx), PDF |
| License Tiers | Trial (10-day), Solo, Practice, Enterprise |

---

*psygil.com | a Foundry SMB product*
