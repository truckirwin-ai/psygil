# 33, Documentation and Information Inventory Request

Status: Draft, v1 (2026-04-15)
Audience: Truck (CEO)
Purpose: list every document and artifact still needed before beta, grouped by consumer.

These are the gaps between what we have (strong strategic + engineering spec set) and what a compliant, defensible, supportable product requires.

---

## A. Legal and Compliance (highest urgency, attorney review)

1. **Business Associate Agreement (BAA) template** between Foundry SMB and Practice customers.
2. **EULA, Terms of Service, Privacy Policy**, final versions post-attorney review (drafts exist).
3. **HIPAA Security Risk Analysis** for Foundry SMB as a vendor.
4. **HIPAA Safe Harbor validation report** (protocol exists; need the actual run on v2 build).
5. **Breach notification procedure**, who we notify and within what window.
6. **State-by-state practice scope matrix**, which states permit forensic tele-eval, which require in-state licensure, which require extra consent.
7. **Informed consent templates**, per evaluation type (CST, Custody, Risk, Fitness, etc.). Template exists; clinical advisor to finalize per type.
8. **Record retention policy**, per jurisdiction, for the Archive folder.
9. **Subpoena / discovery response policy**, how clinicians should handle record requests; what the audit log provides.
10. **Export control classification** (if any AI components trigger EAR considerations).

## B. Clinical Content

1. **Instrument norms library**, licensed or free, with citation metadata and version hashes. Current `instrumentNorms.ts` is scaffolding.
2. **Test battery templates**, per evaluation type, agreed by clinical advisor.
3. **DSM-5-TR criterion maps**, for the evidence_maps table.
4. **Validity scale interpretation rules**, for flagging.
5. **Sample reports**, redacted, for each evaluation type, agreed as style exemplars.
6. **Clinical advisor sign-off letter**, attesting to the workflow and the "DOCTOR ALWAYS DIAGNOSES" principle.

## C. Product and Design

1. **Component-level design system spec**, extending 08_ui_design_system.md with every primitive used in v2 (status chips, gate panel, notes rail, tab strip).
2. **Dark mode parity audit**, every screen.
3. **Keyboard shortcut reference card**, shipped in-app and on docs.
4. **Error and empty-state catalog**, one definitive list with copy and design.
5. **Icon set manifest**, license and provenance for every icon.

## D. Engineering and Ops

1. **Threat model** (STRIDE or similar) for the Electron app and workspace share.
2. **Backup and restore runbook**, for Practice customers.
3. **Incident response runbook**, if a workstation is lost or stolen.
4. **Release checklist**, signed off per release; includes notarization and HARD RULE scan.
5. **Code-signing inventory**, certificates, expiration dates, HSM custody.
6. **Update channel plan**, stable and beta feeds, rollback procedure.
7. **Third-party license inventory** (OSS license compliance for all npm deps, OnlyOffice server, pdfjs-dist, docx).
8. **Database schema migration history**, every forward migration with notes.
9. **Performance baseline**, per platform, on reference hardware.
10. **Observability plan**, what logs we keep locally, how admins retrieve them, zero-PHI guarantee.

## E. Support and Success

1. **Onboarding playbook for new customers**, step by step, first 30 days.
2. **Training curriculum**, video scripts + screen recordings for Setup, Intake, Diagnostics, Publish.
3. **Support runbook**, tiered triage, escalation paths, SLA commitments.
4. **Customer communication templates**, release notes, breach notice, maintenance windows.
5. **Ticketing taxonomy**, categories mapped to engineering owners.

## F. Sales and Marketing

1. **Pricing sheet** (have strategy, need published sheet per edition).
2. **Competitive one-pagers**, vs. Nabla, Heidi, Blueprint, and legacy forensic tools.
3. **Demo script matrix**, by persona: solo psychologist, practice admin, forensic fellowship director, DA office evaluator.
4. **Case study assets**, after first design partners go live.
5. **Conference kit**, booth collateral, badge-ribbon program, speaker bio.
6. **Foundry SMB brand guide**, colors, typography, voice, "no em dashes" included.

## G. People and Corporate

1. **Clinical advisory board charter**, roles, compensation, meeting cadence.
2. **Contractor agreements**, for every current and planned contributor.
3. **IP assignment confirmations** for all prior work.
4. **Privacy and security training**, annual, for all contributors with code access.
5. **Incident log** (even if empty; start it now).

## H. Data for Beta

1. **Design-partner roster**, 5 to 10 practices committed to beta.
2. **Beta success criteria**, measurable, signed off before launch.
3. **Feedback capture plan**, in-app plus interviews.
4. **Kill-switch plan**, if a partner needs to exit, how we transfer their data.

---

## What I recommend you pull together first (next 2 weeks)

1. BAA template draft (A1).
2. HIPAA Safe Harbor validation run on v2 (A4).
3. Informed consent templates for top 3 eval types (B7 partial).
4. Threat model (D1).
5. Release checklist (D4), so every RC exercises it.
6. Design-partner roster (H1).

Everything else can sequence behind those six without blocking beta readiness.
