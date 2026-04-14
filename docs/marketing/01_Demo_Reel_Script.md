# Psygil Demo Reel — Narration Script

**Runtime target:** ~3 minutes 30 seconds
**Format:** Voiceover + screen recording
**Audience:** Forensic psychologists, expert witnesses, defense and prosecution counsel, court administrators

---

## Core message (every chapter must reinforce this)

Psygil is an evidence engine, not a decision engine. Every diagnostic
judgment in a Psygil evaluation is made by the licensed clinician. The AI
agents read records, organize evidence, and draft language — but they
never diagnose, and they never sign. The doctor diagnoses. Always.

The pipeline enforces this with **decision gates**. The Writer agent
literally cannot run until the clinician has personally confirmed at least
one diagnosis. There is no override. There is no "AI-suggested final
report." The clinician's hand is on every clinical conclusion.

---

## Open (5 seconds)

> Psygil is the forensic psychology IDE. Built for clinicians who write
> evaluations courts will rely on, and lawyers will challenge.

[Visual: Dashboard, 50 cases visible in the kanban view, six pipeline
stages across the top.]

---

## Chapter 1 — Intake (~45 seconds)

> Every case begins where a real evaluation begins. With the referral.
>
> Psygil opens a structured intake the moment a new case is created.
> Identity. Insurance. Court information. Charges. Referral question.
> Legal history. Family history. Medical history. Substance use.
> Presenting complaints. Recent events.
>
> The clinician fills it in — not the AI. Psygil never guesses at facts
> the clinician hasn't entered.

[Visual: New Case modal opens. Watch the first form populate field by
field. Last name. First name. Date of birth. Address. Phone. Insurance.
Each one entered deliberately. Then the form advances through six
sections.]

> Intake takes a few minutes for a careful clinician. Psygil keeps every
> field structured so the downstream agents — and the eventual reviewer
> — know exactly what was disclosed and when.

[Visual: Final intake step closes. Case opens as a tab. Pipeline shows
"Onboarding" stage marked complete, "Testing" highlighted next.]

---

## Chapter 2 — Testing (~30 seconds)

> Once intake is complete, the case enters the Testing stage.
>
> Psygil's Ingestor agent reads every document the clinician has provided
> — referral letters, prior evaluations, medical records, police reports
> — and produces a structured summary the clinician can review before
> testing begins.

[Visual: Ingestor runs. Token usage and duration appear on the agent
panel. Test Results tab opens, showing the structured output.]

> The clinician selects the test battery appropriate for this evaluation
> type. For competency, that might mean the ECST-R and the MacCAT-CA.
> For risk assessment, the HCR-20 or the Static-99R. Psygil tracks every
> instrument administered, who scored it, when, and the result.
>
> The AI does not pick the tests. The AI does not score the tests. The
> clinician does both.

[Visual: Test Results tab shows the test battery list. Pipeline advances
to "Interview".]

---

## Chapter 3 — Interviews (~30 seconds)

> Interview is where the clinician meets the defendant. Face to face.
> Psygil does not sit in on the interview, and it does not record audio.
>
> When the interview is complete, the clinician's notes — mental status
> exam, behavioral observations, defendant's account, response to
> questioning about competency or insanity — are entered into Psygil's
> structured interview templates.

[Visual: Interview tab. Structured note fields visible. Scroll through
the populated MSE template.]

> Psygil's role here is record-keeping and discoverability. Every
> observation lives in one place. Every quote is tied back to the date
> and context where it was recorded. When opposing counsel issues a
> discovery request, the clinician can produce the underlying record in
> minutes, not days.

[Visual: Pipeline advances to "Diagnostics".]

---

## Chapter 4 — Diagnostics (~50 seconds)

**[This is the most important chapter. Slow it down.]**

> Now the case enters Diagnostics. This is where Psygil's design becomes
> uncompromising.
>
> The Diagnostician agent reads everything the clinician has gathered —
> intake, records, test results, interview notes — and proposes an
> evidence map. For every diagnosis the agent considers relevant, it
> shows the DSM-5-TR criteria, the ICD-10 code, and the specific evidence
> from the case file that supports or contradicts each criterion.

[Visual: Diagnostician runs. Evidence Map tab opens. Show the structured
output: diagnosis name, ICD code, criteria checklist, evidence quotes
linked to source documents.]

> The agent does not diagnose. It cannot. It assembles evidence and
> presents it to the clinician.
>
> Here is the gate.

[Visual: Highlight the "Render" / "Defer" / "Reject" decision controls
next to each proposed diagnosis. Pause on this for 2 seconds.]

> The clinician — and only the clinician — decides which diagnoses are
> rendered, which are deferred, and which are rejected. The clinician
> can add diagnoses the agent missed. The clinician can override the
> agent on every line. The clinician's reasoning is captured in a
> clinical notes field, and the entire decision is timestamped, signed,
> and written to the audit log.
>
> Until the clinician makes at least one diagnostic decision, the
> Writer agent will refuse to run. There is no skip. There is no
> "AI-only" path. The doctor diagnoses, or the report does not exist.

[Visual: Clinician confirms a diagnosis. The "Render" state lights up.
Pipeline advances to "Review".]

---

## Chapter 5 — Reports (~40 seconds)

> With the clinical decisions made, the Writer agent drafts the report.
> It pulls language from the clinician's intake, the structured
> interview notes, the test results, and — critically — only the
> diagnoses the clinician has personally rendered.
>
> The Editor agent then reviews the draft for internal consistency,
> tone, and citation accuracy.

[Visual: Writer runs, then Editor runs. Eval Report tab opens, showing
the drafted forensic evaluation report.]

> The clinician reviews the draft, edits any language they disagree
> with, and then attests. Attestation is a cryptographically signed,
> timestamped event tied to the clinician's identity. The report is
> locked. The audit log records every change from intake to signature.
>
> If this case ends up in court — and many do — the clinician can
> reproduce the evidentiary chain on demand. Every record. Every test.
> Every decision. Every revision. Every signature.

[Visual: Attestation tab. Clinician signs. Pipeline advances to
"Complete". Case appears in the Complete column on the dashboard.]

---

## Close (10 seconds)

> Psygil. The clinician decides. The record proves it.
>
> Built by Foundry SMB.

[Visual: Dashboard. The new case sits in the "Complete" column. Logo
fade.]

---

## Production notes

### Pacing
- Chapter 1 (Intake) is the longest visually. Keep narration sparse so
  the viewer can see the human-paced typing. The typing is the message:
  the clinician is doing the work.
- Chapter 4 (Diagnostics) is the most important conceptually. Slow it
  down. Linger on the gate. Pause on the "Render" controls.
- Chapters 2, 3, 5 should move briskly — they're transitions.

### Visual cues to highlight on screen
- During intake field-by-field typing: a small overlay reading
  *"Clinician input — entered manually"*
- When the Diagnostician runs: an overlay reading
  *"AI proposes evidence — never diagnoses"*
- When the clinician confirms a diagnosis: a full-screen flash reading
  *"Clinical decision required to proceed"*
- When the report is signed: an overlay reading
  *"Cryptographically attested. Audit log immutable."*

### What to NEVER show
- Do not show any AI agent producing a final clinical conclusion.
- Do not show any "auto-fill" of clinical fields.
- Do not show the Writer running before the diagnosis is confirmed
  (it would error and that error is the message — but it does not
  belong in a marketing reel).
- Do not show real PII. The walkthrough uses Claude-generated synthetic
  cases (`scripts/demo-case.json`), and the case file is regenerated on
  every run to guarantee uniqueness.

### Source assets
- Walkthrough script: `app/scripts/demo-walkthrough.ts`
- Screenshot output: `app/demo-screenshots/<timestamp>/`
- Video output (when `recordVideo` succeeds):
  `app/demo-screenshots/<timestamp>/video.webm`
- Demo case file (Claude-authored, fresh each run):
  `app/scripts/demo-case.json`

### Producing a clean run
```bash
cd app
pnpm build               # refresh out/main, out/preload, out/renderer
pnpm tsx scripts/demo-walkthrough.ts
```

Human-paced typing is on by default. Disable with `DEMO_HUMAN_TYPING=0`
for a fast smoke test.

For Playwright video capture (experimental — may not be supported on
your Playwright version, in which case it falls back gracefully):
```bash
DEMO_RECORD_VIDEO=1 pnpm tsx scripts/demo-walkthrough.ts
```

If Playwright video capture does not produce a `.webm`, the most
reliable fallback is macOS native screen recording: press
`Cmd+Shift+5`, choose "Record Selected Window", click the Psygil
window, then start the walkthrough. The 3-second pause at each chapter
marker gives you obvious cut points for post-production.

Total runtime: approximately 6 to 9 minutes, depending on Anthropic API
latency and how long the Diagnostician + Writer + Editor take. The
intake portion alone runs about 90 to 120 seconds with human-paced
typing enabled, which is where most of the visual content for the reel
comes from.
