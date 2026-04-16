# AI Assistant

What this covers: what the four AI agents do and do not do, when to invoke each one, how to assess their output, and approximate per-case costs.

---

## What the AI Does

Psygil includes four agents: Ingestor, Diagnostician, Writer, and Editor. Each handles a specific, bounded task. Together they reduce repetitive documentation work. None of them diagnose, decide, or act without your explicit action.

### What the agents do

- **Ingestor:** Parses uploaded documents (PDFs, DOCX files, transcripts, score reports) and extracts structured data into the case record: demographics, referral questions, test administrations, behavioral observations, timeline events, and collateral summaries. It flags missing data. It does not interpret findings.
- **Diagnostician:** Maps test scores, validity indicators, interview observations, and collateral data against DSM-5-TR criteria. Presents candidate diagnoses with supporting evidence. Never selects a diagnosis. Every diagnosis carries status `evidence_presented`; only you can change it to `confirmed`, `ruled_out`, or `deferred`.
- **Writer:** Generates a full report draft using your active template as structure. Every section includes `revision_notes` identifying what to verify. Sections needing specific attention are flagged `draft_requiring_revision`.
- **Editor:** Runs a nine-category adversarial review: factual consistency, logical coherence, legal adequacy, ethical compliance, testimony defensibility, formatting, completeness, internal consistency, and bias indicators. Returns structured flags and suggested revisions; you decide what to change.

### What the agents do not do

- They do not diagnose. Diagnostic decisions are yours, recorded individually with your name and timestamp.
- They do not decide what goes in the report. The Writer generates draft prose; you edit and sign.
- They do not see PHI. Before text is sent to the API, all 18 HIPAA Safe Harbor identifiers are replaced with opaque temporary codes (UNIDs). The API receives de-identified text. Your workstation rehydrates UNIDs back to real names and dates before display or storage. See [hipaa.md](./hipaa.md).

---

## When to Use Each Agent

| Agent | When to invoke | Found in |
|---|---|---|
| Ingestor | After uploading documents during Onboarding or Testing | Folder tree: document node > Run Ingestor |
| Diagnostician | At the start of Stage 3: Diagnostics | Diagnostics panel > Generate Evidence Summary |
| Writer | In Stage 4: Review, after all diagnostic decisions are complete | Report panel > Generate Draft |
| Editor | In Stage 4: Review, before finalizing | Report panel > Run Editorial Review |

All agents are optional. If AI is not configured, all four agent buttons are disabled. You can write reports manually without AI at any stage.

---

## What to Verify Before Trusting Output

Review agent output as you would a draft from a trainee. It is a starting point, not a final product.

### After running the Ingestor

- Check that extracted demographics match the source documents.
- Review `completeness_flags`. Flags labeled `missing` mean the agent could not find that data; verify whether it exists in the documents or needs to be collected.
- Extracted test scores come from publisher score reports only. The Ingestor does not compute or score independently.

### After running the Diagnostician

- Read the supporting evidence for each candidate diagnosis. If a diagnosis you consider supported is absent, add it manually.
- There is no "Accept All" button. Each diagnosis requires a separate confirm, rule-out, or defer decision with written justification.

### After running the Writer

- Every section marked `draft_requiring_revision` must be resolved before you can finalize the report. You can either fill in the missing content or, if the section is not applicable to your case, delete it or mark it as not applicable.
- Review `revision_notes` on all sections, including those not flagged. Notes identify what the agent used as source data and where you should verify accuracy.
- If the case record contains an error, the report will reflect it. Accuracy in intake, testing, and diagnostic stages flows directly into report quality.

### After running the Editor

- The Editor flags issues by category and severity. Address all high-severity flags before signing.
- Editor output is advisory. You decide whether each flag requires a change.

---

## Cost Model

Usage is billed directly by your provider. Psygil does not mark up usage or charge a per-call fee.

Approximate per-case cost using Claude Sonnet 4 (the recommended model at $3.00/M input tokens, $15.00/M output tokens):

| Agent | Typical input tokens | Typical output tokens | Estimated cost |
|---|---|---|---|
| Ingestor (per document) | 8,000 | 3,000 | $0.07 |
| Diagnostician | 12,000 | 5,000 | $0.11 |
| Writer (full draft) | 20,000 | 10,000 | $0.21 |
| Editor | 15,000 | 4,000 | $0.11 |
| **Full case (all agents)** | | | **~$0.50** |

Estimates assume four to six uploaded documents, a standard test battery, and a 20-page report. Complex cases with extensive collateral records or multiple drafting iterations cost more.

Model pricing is in `app/src/renderer/src/components/setup/steps/StepAi.tsx`. Haiku 4 ($0.80/M input, $4.00/M output) drops the full-case cost to roughly $0.07. Opus 4 ($15.00/M input, $75.00/M output) raises it to roughly $2.50. Opus 4 is not necessary for documentation tasks.

---

## See Also

- [hipaa.md](./hipaa.md): How PHI redaction works before API calls
- [walkthrough.md](./walkthrough.md): The pipeline stages where each agent is used
- [templates.md](./templates.md): How the Writer agent uses report templates
- [troubleshooting.md](./troubleshooting.md): What to do when an agent call fails
