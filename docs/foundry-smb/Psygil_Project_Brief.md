# Foundry SMB — Project: Psygil (Psygil)

**Status:** Pre-Development (Engineering Specs + UI Prototype Complete, Ready for Sprint 1)
**Product Type:** Electron Desktop Application (Local-First)
**Target Market:** Licensed Psychologists — Forensic and Clinical
**Revenue Model:** SaaS Subscription ($299-$349/month)
**Estimated Year 1 Revenue:** $270K-$630K (75-150 users) + $300K SBIR Phase I
**Estimated Year 1 Expenses:** $112K-$327K
**Launch Target:** Q4 2026 (October-November)

---

## One-Sentence Description

Psygil is an AI-powered writing tool that helps forensic and clinical psychologists complete comprehensive, defensible evaluation reports in 2 hours instead of 8 — while ensuring the doctor always makes every diagnostic decision.

## Problem

Licensed psychologists who conduct formal evaluations (competency to stand trial, child custody, risk assessments, diagnostic assessments, disability determinations) spend 4-12 hours per evaluation on documentation. They use Microsoft Word, dictation software, and memory. No purpose-built tool exists for this use case. The 73,000+ psychologists who conduct evaluations in the US have zero specialized software.

## Solution

A local-first Electron desktop app with four AI agents (Ingestor, Diagnostician, Writer, Editor/Legal Reviewer) that organizes evidence, maps diagnostic criteria, generates report prose in the clinician's voice, and reviews for legal defensibility — with the clinician making every diagnostic decision through a three-gate review process.

## Competitive Advantage

1. **Local-first PHI architecture** — all protected health information stays on the device. 12-18 month rebuild moat for cloud-first competitors.
2. **Forensic/evaluation specialization** — purpose-built for 20-60 page evaluations, not 50-minute therapy SOAP notes.
3. **Doctor-diagnoses-always architecture** — AI writes, doctor decides. Enforced at agent, gate, and audit trail levels.
4. **Full Word-compatible editing** (OnlyOffice) — reports go directly to courts and attorneys.
5. **Defensibility infrastructure** — audit trail, attestation record, testimony preparation features.

## Project Assets (as of March 21, 2026)

- **45+ documents** across strategy (19), engineering (11), legal (3), reviews (3), analysis (2), UI (2), project management (2), templates (1), other (3)
- **Total documentation:** ~3MB+
- **UI Prototype (v4):** Working HTML with 50-case database, 6-stage pipeline, stage-appropriate document trees, clinical overview with summary tabs, 3 themes, draggable splitters (~3,745 lines, 258KB)
- **UI Design Lock:** 15-section comprehensive reference locking every UI decision
- **Project Dashboard:** Living HTML with Gantt, task tracker, budget, risk register
- **Sprint Plan:** 24 two-week sprints across 15 months, 68 user stories mapped
- **Build Manifest:** Execution leash with sprint tasks, acceptance criteria, and architectural principles

## Key Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| PII Detection | Python sidecar (Presidio + spaCy) | Bulletproof over clever. >99% sensitivity. |
| Style System | Pre-computed rules (not RAG) | Lighter, faster, predictable, editable. |
| Storage | SQLCipher (encrypted SQLite) | ACID, FTS5, proven. Clinical-grade. |
| Agent Count | 4 (from original 8) | Reduced latency and cost, preserved quality. |
| Editor | OnlyOffice (Community → Developer) | Full Word compatibility. Native .docx. |
| Scope | Forensic + Clinical (from forensic-only) | Real client needs drove the expansion. |
| Audit Trail | Decision Record Only (default) | Defensible without being discoverable. |
| Pipeline | 6-stage: Onboarding→Testing→Interview→Diagnostics→Review→Complete | Clinically meaningful stages replacing Gate 1/2/3. |
| Document Trees | Stage-appropriate (documents appear when created) | Matches real clinical workflow. |

## Next Milestones

1. **Milestone 0: PII Validation** — Validate Presidio pipeline against HIPAA Safe Harbor (18 categories). GO/NO-GO decision.
2. **FDA CDS Exemption** — Outside counsel confirms exempt from SaMD classification.
3. **Beta (10 clinicians)** — Must demonstrate >50% time savings.
4. **Public Launch** — Q4 2026.
5. **100 Paying Users** — Target: March 2027.

## BYOB Methodology Note

This project was built using the BYOB (Build Your Own Business) methodology — a framework for taking solo-founder product ideas from strategy through engineering-ready specifications in a single intensive engagement. The methodology includes: deep document analysis, rapid decision loops, expert panel stress-testing (clinical, legal, executive), engineering specification generation, legal document drafting, and UI prototyping. See `CLAUDE.md` in the project root for the full methodology documentation.
