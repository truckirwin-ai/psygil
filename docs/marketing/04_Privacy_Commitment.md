# Psygil Data Privacy Commitment
**Effective:** April 17, 2026
**Version:** 1.0

---

## Our Promise

Psygil is built on a simple principle: your patient data is yours. Period.

We do not access it. We do not collect it. We do not train on it. We cannot, because the architecture makes it impossible.

---

## Seven Commitments

### 1. Patient data never leaves your device
All protected health information (PHI) is stored in a locally encrypted SQLCipher database on your machine. Case files, test scores, clinical notes, interview transcripts, and generated reports never pass through Psygil's servers.

### 2. No data is ever used to train AI models
Psygil does not fine-tune, train, or improve any artificial intelligence model using your clinical data, case notes, test scores, interview recordings, or report content. Your data is used exclusively for generating your reports during your current session.

### 3. PHI is redacted before any AI interaction
Before any text is sent to an AI model for report generation, all 18 HIPAA identifier categories are detected and replaced with cryptographic single-use tokens (UNIDs) using Microsoft Presidio and spaCy NLP running locally on your machine. The AI model never sees real patient names, dates of birth, Social Security numbers, or any other identifying information.

### 4. You retain 100% ownership of all data and outputs
Every report, case file, test score, clinical note, and interview transcript belongs to you. Psygil claims no license, no rights, and no interest in any content you create or any data you enter. You may export, transfer, or delete your data at any time.

### 5. Audio transcription runs entirely offline
Clinical interview transcription uses faster-whisper running locally on your machine. Audio recordings are never transmitted to cloud speech recognition services. Your session recordings remain on your device.

### 6. Encryption at rest and in transit
All local data is encrypted using SQLCipher with AES-256 encryption and Argon2id key derivation. API communications use TLS 1.3. Database encryption keys are derived from your passphrase and stored in the operating system's secure keychain.

### 7. Complete, immutable audit trail
Every action, clinical decision, AI interaction, and data modification is logged with timestamps and actor attribution. Audit entries are secured with a SHA-256 hash chain that detects any tampering. SQL triggers prevent modification or deletion of audit records.

---

## How This Differs From Other Platforms

Some competitors claim "HIPAA compliance" while their terms of service grant them rights to your data:

**PAR AI Report Writer** (effective September 17, 2025): PAR's End User License Agreement explicitly grants PAR a license to use user inputs AND outputs to train and improve their AI services. For forensic psychologists handling legally privileged case information, this creates potential violations of APA Ethics Code Section 4 (Privacy and Confidentiality) and applicable state bar ethics rules.

**Psygil's architecture makes this impossible.** Patient data never reaches our servers. We have no mechanism to collect, store, or train on your clinical data. This is not a policy choice. It is an engineering decision.

---

## Business Associate Agreement

Psygil will execute a Business Associate Agreement (BAA) with any clinical user or institution upon request. Contact support@psygil.com to initiate.

---

## Questions

For questions about Psygil's privacy architecture, data handling, or compliance posture, contact:

**Email:** support@psygil.com
**Web:** psygil.com/privacy

---

*psygil.com | a Foundry SMB product*
*This document is intended for publication at psygil.com/privacy-commitment*
