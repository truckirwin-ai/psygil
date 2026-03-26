# Psygil — Technical & Functional Analysis

**Analyst:** Claude (at request of Truck Irwin, CEO)
**Date:** March 18, 2026
**Scope:** All 19 project documents reviewed

---

## I. EXECUTIVE ASSESSMENT

Psygil is one of the most thoroughly documented pre-revenue products I've encountered. Across 19 documents you've built a coherent vision spanning architecture, agent design, market positioning, go-to-market, SBIR strategy, and multi-year financial modeling. The core thesis is strong: forensic psychologists have an acute, measurable pain point (4-12 hours of unbillable documentation per evaluation), zero purpose-built tools exist, and the local-first architecture creates a genuine structural moat against cloud-first competitors.

That said, the documentation reveals both strengths worth doubling down on and gaps worth addressing before you build. Here's the honest breakdown.

---

## II. TECHNICAL ANALYSIS

### A. Architecture — What's Strong

**Local-first PHI handling is the right call and well-designed.** The decision to process all PHI on-device via WASM-compiled NLP (Presidio), store in encrypted IndexedDB, and only transmit de-identified data to the LLM is architecturally sound. This isn't just a compliance checkbox — it's a genuine competitive moat. Cloud-first competitors like Nabla or Heidi Health would need a full architectural rebuild to match this posture. The dual-mode PII scrubbing (WASM for browser, Python sidecar for Electron) is pragmatic and gives you a migration path.

**The LLMGateway abstraction is critical and correctly prioritized.** Supporting Claude Sonnet as primary with GPT-4o fallback, with the architecture designed for Gemini/local model (Ollama) swap, protects against vendor lock-in and pricing changes. At $2.72 per evaluation with 90.9% AI gross margin, your unit economics are healthy — but only if you're not locked to a single provider.

**React + Vite over Next.js is the right choice** for a client-side SPA that pushes heavy computation to Web Workers. No SSR needed, cleaner WASM integration, leaner bundle.

**TipTap/ProseMirror for the editor** is industry-standard and extensible. The inline suggestion nodes, track changes, and streaming token append are all well-supported by the ProseMirror document model. Good choice.

### B. Architecture — What Needs Scrutiny

**1. WASM Performance for PII Scrubbing at Scale**

The docs claim >98% sensitivity and >95% specificity for PII detection via Presidio compiled to WASM. This is ambitious. Presidio in its native Python environment with full spaCy models achieves these numbers, but WASM compilation typically requires quantized models with reduced accuracy. You need to validate this claim early — it's Specific Aim 1 in your SBIR for good reason.

*Risk:* If WASM PII detection falls to 94-95% sensitivity, you're missing 5-6% of PHI entities. In forensic contexts where a single leaked name could compromise a case, this is unacceptable. The human review queue (confidence <0.75) mitigates this, but if the queue is too noisy (too many false positives from low specificity), clinicians will start rubber-stamping reviews.

*Recommendation:* Build the Python sidecar path first (higher accuracy, faster to validate). Use it as your ground truth for WASM benchmarking. Ship Electron with sidecar initially; WASM browser-only can follow once validated against real forensic documents.

**2. Local RAG Feasibility with all-MiniLM-L6-v2 in WASM**

all-MiniLM-L6-v2 is a 22M parameter model producing 384-dimensional embeddings. Running this in WASM via Transformers.js is feasible for small document sets, but forensic psychologists with 5+ years of reports could have hundreds of documents. Embedding 500 reports × 20 pages × ~10 chunks/page = 100,000 chunks on first indexing would take significant time in WASM.

*Risk:* First-run indexing could take 30-60+ minutes in browser, creating a terrible first-use experience. Incremental indexing is fine, but the initial backlog is the problem.

*Recommendation:* Profile this early. Consider background indexing with a progress indicator, or offer the Electron sidecar path with a native ONNX runtime for 10-20x faster embedding. Also consider whether the initial MVP even needs RAG — you could launch with template-based voice matching and add RAG in Beta.

**3. IndexedDB as Primary Storage for Clinical Data**

IndexedDB is the right storage layer for browser-based PHI, but it has known limitations: no native full-text search, inconsistent storage quotas across browsers (some cap at 50% of disk), and no built-in backup/restore mechanism. For a clinician managing 200+ active cases with version history, you could hit storage limits.

*Risk:* Data loss from browser cache clear, storage eviction, or corrupted IndexedDB. Clinicians losing evaluation data is catastrophic — not just inconvenient, potentially legally actionable.

*Recommendation:* Prioritize the Electron path for production use. OPFS (Origin Private File System) via SQLite is more robust than raw IndexedDB. Build encrypted local backup/export from day one (you mention this in Settings — make it automatic, not manual). Consider a "vault" concept where completed evaluations are exported and archived automatically.

**4. Eight-Agent Orchestration Complexity**

The eight-agent system is elegant on paper — each agent has clear boundaries, single responsibilities, and the Orchestrator prevents cross-contamination. But in practice, orchestrating 8 sequential LLM calls per evaluation introduces latency, cost, and failure-mode complexity.

A single evaluation traverses: Ingestor → Test Data Analyst → Diagnostician → (Gate 2) → Writer → Legal Reviewer → Editor → Fact Checker → (Gate 4). That's 8 LLM calls minimum, likely more with retries and multi-section processing. At ~10-30 seconds per call, you're looking at 2-5 minutes of processing time per stage transition, plus doctor review time at gates.

*Risk:* The workflow could feel sluggish. Clinicians used to typing in Word won't wait 20 minutes for a pipeline to process if they could draft faster manually.

*Recommendation:* For MVP, collapse to 3 agents as your build plan already specifies (Ingestor, Diagnostician, Writer). But also consider whether some agents can run in parallel post-MVP. Legal Reviewer and Editor could run concurrently after the Writer, for instance. The Fact Checker could run in parallel with Legal Review since it's checking source data, not prose quality.

**5. DSM-5-TR Database Licensing**

You reference a "licensed DSM-5-TR as read-only database" with full diagnostic criteria. The APA holds copyright on DSM-5-TR content. Distributing the full criterion text in a commercial product requires a licensing agreement with APA Publishing. This isn't a technical problem — it's a legal/business one that could block your entire diagnostic mapping feature.

*Risk:* APA could refuse to license, or license at a cost that destroys your unit economics. They've historically been protective of DSM content.

*Recommendation:* Engage APA Publishing licensing early — before you build the database. Have a fallback strategy: reference criterion codes and numbers without full text, linking to the clinician's own DSM-5-TR reference. Clinicians already own the manual; you just need to point to the right criteria, not reproduce them.

### C. Technology Stack Assessment

| Component | Choice | Assessment |
|-----------|--------|------------|
| Frontend | React 18 + TypeScript + Vite | Correct. Industry standard, WASM-friendly. |
| Editor | TipTap/ProseMirror | Correct. Best-in-class for structured clinical editing. |
| Local Storage | IndexedDB + OPFS SQLite | Adequate for MVP; needs robustness work for production. |
| PII Detection | Presidio (WASM/sidecar) | Right tool; WASM accuracy needs validation. |
| Embeddings | all-MiniLM-L6-v2 via Transformers.js | Right model; performance at scale needs profiling. |
| Vector Store | LanceDB WASM | Good choice. Columnar, fast ANN, WASM-native. |
| LLM | Claude Sonnet (primary) + GPT-4o (fallback) | Correct. BAA coverage, large context, instruction quality. |
| DSM-5-TR DB | sql.js (SQLite WASM) | Right tech; content licensing is the risk. |
| Voice | Whisper.cpp WASM | Correct for local transcription. Latency acceptable for voice notes. |
| Desktop | Electron | Necessary for Electron-specific capabilities (sidecar, fs, signing). |
| Export | docx.js + print-to-PDF | Standard approach. May need python-docx for complex formatting. |

---

## III. FUNCTIONAL ANALYSIS

### A. Workflow Design — What's Strong

**The four-gate approval model is the product's strongest functional differentiator.** In forensic psychology, the chain of custody between "AI suggested this" and "doctor approved this" is the entire legal defense. Gate 1 (post-ingest data confirmation), Gate 2 (diagnostic review), Gate 3 (legal flag resolution), and Gate 4 (final attestation) create a documented trail that no competitor offers. This isn't a feature — it's legal infrastructure.

**The Legal Reviewer agent concept is genuinely novel.** Having a dedicated adversarial reader that flags speculative language, unsupported causation, unjustified certainty, and actuarial predictions without instruments is exactly what forensic psychologists need. Every forensic report gets cross-examined; having an AI pre-screen for vulnerabilities that a hostile attorney would exploit is a clear, defensible value proposition.

**The Kanban board with 10 workflow columns** maps well to how forensic practices actually manage caseloads. The decision to disable drag (movement controlled by workflow engine only) is smart — it prevents bypassing gates.

**The billing loop integration (CPT codes, ICD-10-CM crosswalk, superbill generation)** is a sleeper differentiator. No competitor in the evaluation space closes this loop. For clinical private practice, this alone could justify the subscription.

### B. Workflow Design — What Needs Scrutiny

**1. The Forensic-First Strategy is Right, but the Feature Scope is Clinical-General**

Your go-to-market says "forensic first" (8,000 ABPP practitioners), but the feature set covers forensic, neuropsych, clinical, school, and group practice use cases simultaneously. Building for all five segments from day one means you're building for none of them deeply enough.

*Recommendation:* For MVP/Beta, ruthlessly scope to forensic evaluations only. That means: forensic report templates (competency, custody, risk assessment, disability), forensic-specific instruments (HCR-20, PCL-R, Static-99R, MMPI-3 validity scales for malingering), Daubert/Frye standard compliance checking, and court-formatted export. Leave neuropsych battery integration, school IEP templates, and billing loop for post-Beta.

**2. Voice Matching via RAG Adds Complexity with Uncertain Value at Launch**

RAG-based voice matching is a compelling long-term feature, but it requires clinicians to upload 10-20 prior reports before it produces meaningful style matching. For a new user on day one, there's no prior work to index. The first experience will be generic voice, which may disappoint.

*Recommendation:* Launch with configurable writing style rules (which you already have) plus 3-5 pre-built forensic voice profiles ("clinical-formal," "court-accessible," "academic-technical"). Add RAG voice matching as a progressive enhancement that improves with usage. Market it as "the system that learns your voice over time" rather than a launch feature.

**3. The Zoom Transcript Ingestion is a Strong Feature but Narrow**

Zoom .vtt files are one input format, but forensic evaluations often involve: in-person interviews (no transcript), phone calls, recorded depositions (various formats), collateral interviews, and written correspondence. Zoom-only transcript processing may undersell the need.

*Recommendation:* Rename and broaden this feature to "Interview & Session Processing." Support audio file upload (WAV, MP3, M4A) with Whisper transcription, plus VTT/SRT subtitle import. This captures both telehealth and in-person recorded sessions.

**4. Multi-Session Evaluation Handling Isn't Clearly Specified**

Forensic evaluations often span 3-8 sessions over weeks. The documents describe a single-evaluation workflow but don't clearly address how the system handles multi-session cases: accumulating data across sessions, maintaining diagnostic hypotheses that evolve, tracking which sessions contributed which observations.

*Recommendation:* Define a "Case" as the primary entity (not a single session). Cases accumulate sessions, documents, and test administrations over time. The Diagnostician operates on the full case record, not individual sessions. This is critical for forensic work.

**5. The "Doctor in Control" Framing Needs Sharper UX Patterns**

The documents repeatedly emphasize doctor oversight, but the UX for exercising that control isn't fully specified. What does "review" mean at each gate? Is it a checklist? A side-by-side diff? A sign-off dialog? The difference between a rubber-stamp checkbox and a meaningful clinical review is the UX implementation.

*Recommendation:* At Gate 2 (diagnostic review), show the Diagnostician's criterion mapping as a structured table: each DSM-5-TR criterion, the evidence for/against, the source, and a radio button (Agree / Disagree / Modify). At Gate 3, show Legal Reviewer flags as an inline annotation layer the doctor can accept, dismiss, or modify. At Gate 4, show the Fact Checker's verification report as a pass/fail checklist with source links. Make the review *active*, not passive.

---

## IV. BUSINESS & MARKET ASSESSMENT

### What's Well-Positioned

**The market timing is excellent.** Nuance DAX's $19.7B acquisition proved the thesis that AI clinical documentation commands premium valuations. The forensic psychology niche is genuinely uncontested — no competitor has purpose-built for 20-60 page evaluations with legal defensibility requirements.

**The local-first architecture creates a real moat.** Cloud-first competitors (Nabla, Heidi, Upheal) would need 12-18 months of rearchitecting to match your privacy posture. By that time, you'd have audit trail lock-in with early adopters.

**The SBIR strategy is well-aligned.** NIMH, AHRQ, and NSF all have clear funding lanes for this work. The Specific Aims are well-structured and achievable. Phase I ($300K) would fund MVP development and clinical validation simultaneously.

### What Needs Adjustment

**Revenue projections may be aggressive for Year 1.** The base scenario projects $984K ARR in Year 1 with 2,800 individual paid seats and 2,000 group seats. Given that you're targeting an 8,000-person forensic market initially, 4,800 seats in Year 1 represents 60% market penetration of the entire forensic segment — which is unrealistic for a new product from an unknown company, regardless of product quality.

*More realistic Year 1:* 50-100 paying individual users at $200-300/month average = $120K-$360K ARR. Still a strong signal. Don't over-promise to investors; let the product prove the model.

**The 17-agent company model is novel but unproven operationally.** Having AI agents fill every functional role (CFO, CMO, CRO, etc.) is bold. It compresses costs dramatically and could work for a solo founder. But it also means every strategic decision depends on the quality of agent prompts and the CEO's ability to context-switch across 17 domain areas simultaneously.

*Recommendation:* The agent team is a force multiplier for execution, but hire one human (a fractional clinical advisor or part-time senior engineer) within the first 6 months. A single human collaborator who understands the clinical domain will catch things that agents miss and provide the peer review loop that every founder needs.

---

## V. TOP 10 RISKS AND MITIGATIONS

| # | Risk | Severity | Mitigation |
|---|------|----------|------------|
| 1 | DSM-5-TR content licensing blocked by APA | Critical | Engage APA Publishing licensing immediately; design fallback using criterion codes without full text |
| 2 | WASM PII detection accuracy below 98% threshold | High | Build Python sidecar first as ground truth; ship Electron-first if browser accuracy insufficient |
| 3 | IndexedDB data loss from browser eviction | High | Automatic encrypted backups; push Electron as primary platform; implement data recovery |
| 4 | Clinician adoption friction (too complex, too slow) | High | Ruthlessly scope MVP to forensic-only; measure time-to-first-report; target <30 minutes for first evaluation |
| 5 | Year 1 revenue below projections | Medium | Anchor financial model on 50-100 users, not 4,800; extend runway via SBIR Phase I |
| 6 | Agent orchestration latency (8 sequential LLM calls) | Medium | Parallelize where possible; use streaming aggressively; consider batch processing overnight |
| 7 | RAG indexing performance in browser | Medium | Profile early; offer Electron fast-path; defer RAG to post-MVP |
| 8 | Malpractice liability from AI-generated content | Medium | "Draft" watermarks, mandatory review gates, attestation language, product liability insurance |
| 9 | Single-founder key-person risk | Medium | Document everything (which you've done well); hire fractional clinical advisor and senior engineer |
| 10 | Competitor response from funded players (Nabla, Heidi) | Low | Forensic niche is too specialized for generalists to pivot into quickly; your domain depth is the defense |

---

## VI. STRATEGIC RECOMMENDATIONS

1. **Ship Electron first, browser second.** The Python sidecar for PII, native file system access, and storage robustness make Electron the better platform for forensic clinicians who need reliability above all else. Browser PWA can follow for lighter use cases.

2. **Narrow MVP to forensic evaluations exclusively.** Competency evaluations, custody evaluations, and risk assessments. Three templates. One specialty. Prove the workflow before expanding.

3. **Validate PII detection accuracy before anything else.** This is your load-bearing wall. If it fails, the product can't ship. Make it Milestone 0.

4. **Engage APA Publishing on DSM-5-TR licensing in Month 1.** This is a business blocker that takes months to resolve. Start the conversation now.

5. **Hire one human.** A part-time senior engineer or fractional clinical advisor. The agent team is impressive but needs a human peer review loop.

6. **Submit NIMH SBIR Phase I as early as possible.** $300K of non-dilutive funding that also validates clinical feasibility is the highest-ROI activity you can do in the next 90 days.

7. **Build the audit trail as a first-class product feature, not a compliance checkbox.** Market it as "your legal defense record." Every forensic psychologist who's been cross-examined will understand the value immediately.

8. **Defer billing loop, school district features, and EHR integration until post-Beta.** These are expansion market features. Don't let them dilute forensic focus.

9. **Set realistic Year 1 targets:** 50-100 paying users, $120-360K ARR, 3-5 ABPP testimonials, 1 conference presentation, SBIR Phase I submitted.

10. **Treat the documentation corpus you've built as an asset.** These 19 documents represent a level of pre-build thinking that most startups never achieve. Use them as your SBIR narrative, your investor deck source material, and your engineering specification simultaneously.

---

## VII. OVERALL VERDICT

Psygil is a well-conceived product targeting a genuine market gap with a defensible technical approach. The local-first architecture, multi-agent accountability model, and forensic specialization create real competitive advantages that funded competitors can't easily replicate.

The primary risk isn't technical feasibility — it's execution scope. You've documented a product that could serve five market segments, integrate with six EHR systems, generate billing codes, and run 17 AI agents as company staff. The path to success is narrowing all of that to "forensic psychologists can complete a legally defensible evaluation report in 2 hours instead of 8" and shipping that first.

The foundation is strong. Now build the narrowest possible version that proves the thesis.
