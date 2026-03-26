# Psygil — Expert Panel Review

**Simulated Critical Review by a Panel of Clinical and Forensic Psychologists**
**Date:** March 19, 2026
**Document Reviewed:** Psygil Technical & Functional Analysis (Revised Architecture)

---

## Panel Composition

The following review synthesizes perspectives from five simulated practitioner archetypes, representing the breadth of your target market. Each raises concerns grounded in published practice standards, real workflow realities, and the professional culture of psychology.

- **Panelist A:** ABPP-certified forensic psychologist, solo private practice, 20+ years. Primarily criminal competency and risk assessments. Testifies weekly.
- **Panelist B:** Clinical psychologist, large hospital-based neuropsychology department, 15 years. Conducts 300+ evaluations per year. Manages a team of 4 psychometrists.
- **Panelist C:** Forensic psychologist, small group practice (3 doctors), 10 years. Custody evaluations and personal injury. Balances clinical work with business operations.
- **Panelist D:** Clinical psychologist, VA Medical Center, 12 years. PTSD and TBI evaluations. Works within a heavily regulated, EHR-mandated environment.
- **Panelist E:** Early-career forensic psychologist, 3 years post-licensure. Solo practice. Tech-forward, cost-sensitive, building a caseload.

---

## I. OVERALL ASSESSMENT

**The panel unanimously agrees: the pain point is real.** Documentation is the single largest non-clinical time sink in evaluation practice. The 4-12 hour estimate in the spec is accurate — and conservative for complex forensic cases. A tool that genuinely compresses this to 2 hours while maintaining defensibility would be transformative.

**The "doctor always diagnoses" principle is exactly right** and may be the most important design decision in the entire product. The panel's primary concern is not whether this principle exists on paper, but whether it will survive contact with real clinical workflows. The details matter enormously.

That said, the panel identified **significant concerns** across six domains. These are not criticisms of the vision — they are concerns from practitioners who would use this daily, and who know where clinical software fails.

---

## II. CRITICAL CONCERNS

### Concern 1: The Evaluation Workflow Is Not a Linear Pipeline

**Raised by: Panelists A, B, C (unanimous)**

The four-stage pipeline (Ingest → Evidence Map → Write → Edit/Legal Review) with sequential gates implies that forensic and clinical evaluations proceed in a linear fashion. They do not. In real practice:

- A forensic evaluator often begins writing the background history section *before* testing is complete, because records review and clinical interview happen first and the test battery may not be finalized until mid-evaluation.
- New collateral records arrive after the evaluation has started — sometimes after the report draft is underway. Insurance records, school transcripts, prior treatment notes may appear at any point.
- The clinician may revise their diagnostic hypotheses *during* report writing, not just at a discrete "Gate 2." Writing the clinical formulation often clarifies thinking — the act of writing is itself diagnostic reasoning.
- Multi-session evaluations (3-8 sessions over weeks) mean data accumulates continuously. The Ingestor Agent cannot "complete" its work until the case is closed, which may not happen until after writing has begun.

**Recommendation:** The pipeline should support non-linear, iterative workflows. Specifically:

- Allow the Writer Agent to generate partial reports (e.g., background history and behavioral observations) before the Diagnostician Agent has finished evidence mapping.
- Allow re-ingestion of new materials at any point in the workflow without resetting the entire pipeline.
- Gate 2 should be revisitable — the clinician may revise diagnostic decisions after seeing the drafted report and realizing the formulation doesn't cohere.
- Consider a "working document" model where the report is a living .docx in OnlyOffice that the agents update incrementally, rather than a batch-generated artifact.

---

### Concern 2: Test Data Handling Has Serious Professional and Legal Constraints

**Raised by: Panelists A, B, D (critical)**

The spec describes the Ingestor Agent parsing test scores, and the instrument library containing scoring ranges and normative data. This is where the product intersects with **test security obligations** that are legally and ethically binding.

**Test Security (NAN/AACN Joint Position):** The National Academy of Neuropsychology and the American Academy of Clinical Neuropsychology have published position papers stating that test materials, stimuli, and raw data must be protected from unauthorized disclosure. Storing test items, scoring algorithms, or detailed normative tables in a software application raises test security concerns — particularly if any of that data could be extracted, reverse-engineered, or inadvertently disclosed.

**Publisher Licensing:** Test instruments like the MMPI-3, WAIS-V, WISC-V, PAI, and ADOS-2 are copyrighted products owned by publishers (Pearson, PAR, WPS, MHS). Their scoring algorithms, normative tables, and interpretation guidelines are proprietary. The Ingestor Agent cannot "know" that a WAIS-V FSIQ of 68 is in the Extremely Low range unless it has access to the WAIS-V normative tables — which are licensed, not public.

**Computerized Scoring:** Many tests already have publisher-provided computerized scoring (Q-global for Pearson instruments, PARiConnect for PAI). Practitioners use these systems to generate score reports. The Ingestor Agent should ingest the *output* of these scoring systems (PDF or structured score reports), not attempt to replicate the scoring itself.

**Recommendation:**

- The Ingestor Agent should parse score reports from publisher platforms (Q-global PDFs, PARiConnect exports), not raw test data. This respects test security and avoids publisher licensing issues entirely.
- Remove any stored normative tables or scoring algorithms from the instrument library. Instead, store only: instrument name, abbreviation, what it measures, which diagnoses it maps to, and general interpretive ranges (Extremely Low / Low / Average / High — no specific score cutoffs that constitute proprietary normative data).
- Add a "Score Report Import" feature that accepts PDF or structured exports from Q-global, PARiConnect, and other publisher platforms. The Ingestor Agent extracts scores and classifications from these reports.
- Consult with Pearson, PAR, and WPS legal departments early. They have partnered with software platforms before (e.g., Pearson's integration with Epic EHR) and may be willing to license data interchange formats.

---

### Concern 3: The Diagnostician Agent's Evidence Mapping Is More Complex Than Described

**Raised by: Panelists A, C, E**

The spec describes the Diagnostician Agent mapping evidence to DSM-5-TR criteria on a criterion-by-criterion basis. In practice, diagnostic reasoning in forensic and clinical contexts involves dimensions that the current spec doesn't address:

**Differential Diagnosis is Not a Checklist.** The DSM-5-TR criteria for Major Depressive Disorder and Bipolar II Disorder overlap substantially. The criteria for PTSD, Complex PTSD (ICD-11), and Borderline Personality Disorder share features. Differential diagnosis requires weighing *patterns* of symptoms, *temporal sequences* (did the substance use precede or follow the depression?), and *contextual factors* (is the apparent psychosis a cultural phenomenon or a clinical symptom?) that don't reduce to criterion-matching.

**Malingering Assessment Is Embedded, Not Separate.** In forensic evaluations, validity testing (TOMM, SIRS-2, MMPI-3 validity scales) doesn't just flag whether someone is malingering — it contextualizes the interpretation of every other test. If the TOMM suggests poor effort, the WAIS-V scores are uninterpretable. If MMPI-3 F-r is elevated, all clinical scales are suspect. The Diagnostician Agent needs to process validity/effort data *first* and apply it as a lens to all subsequent evidence mapping.

**Psycho-Legal Constructs Don't Map to DSM-5-TR.** "Competency to stand trial" is a legal construct, not a clinical diagnosis. A person can be diagnosed with Schizophrenia and still be competent. The Diagnostician Agent needs to map evidence to both *diagnostic criteria* and *psycho-legal standards* (Dusky standard for competency, M'Naghten or Model Penal Code for insanity, best interests of the child for custody). These are different analytic frameworks.

**Recommendation:**

- Build differential diagnosis logic that considers symptom patterns and temporal sequences, not just individual criterion matching. Present differentials as a structured comparison (e.g., "MDD vs. Bipolar II: these features support MDD; these features support Bipolar II; these features are ambiguous").
- Implement a validity/effort assessment layer that processes malingering data *before* clinical evidence mapping. If effort testing flags concerns, the Evidence Map should note this prominently and qualify all affected test interpretations.
- For forensic evaluations, add a separate "Psycho-Legal Analysis" output alongside the diagnostic Evidence Map. This maps evidence to the relevant legal standard (Dusky, M'Naghten, best interests) rather than DSM criteria.
- For clinical evaluations, emphasize functional impairment mapping (how does this diagnosis affect daily functioning, work capacity, interpersonal relationships) alongside criterion-matching.

---

### Concern 4: The Writer Agent's "80-90% of the Document" Claim Needs Qualification

**Raised by: Panelists A, B, C (strong consensus)**

The spec claims the Writer Agent generates 80-90% of the final document. This is either a powerful value proposition or a professional liability risk, depending on what "80-90%" means.

**What the Writer Agent CAN reliably generate:**

- Identifying information and referral questions (structured data, minimal clinical judgment)
- Background history summary from records (collateral synthesis — high-volume, time-consuming, and well-suited for AI)
- Test result tables with scores and classifications (structured data presentation)
- Boilerplate sections: informed consent documentation, evaluation procedures, limitations and caveats

**What the Writer Agent SHOULD NOT generate without extreme caution:**

- Behavioral observations. These are the clinician's direct, in-room impressions: how the patient presented, their demeanor, affect, eye contact, rapport, effort, and behavior during testing. These are *personal observations* that only the clinician can make. If the Writer generates behavioral observations from transcript analysis, it must be clearly marked as "extracted from transcript" — not presented as the clinician's direct observation.
- Clinical formulation. This is the integrative narrative that connects history, test data, behavioral observations, and diagnostic reasoning into a coherent explanatory model. This is the intellectual core of the evaluation and the section most frequently scrutinized on cross-examination. It requires clinical judgment, not AI generation.
- Risk assessment opinions. "This individual presents a moderate risk of future violence" is a clinical opinion with legal consequences. The AI should never generate risk level conclusions.

**The realistic expectation:** The Writer Agent probably generates 50-60% of the final document (background history, test result summaries, boilerplate), and produces *structured drafts* of the remaining sections that the clinician substantially revises. Marketing it as "80-90%" may create an expectation that the clinician just reviews and signs, which is neither safe nor professionally appropriate.

**Recommendation:**

- Distinguish between "fully generated sections" (background history, test tables, boilerplate) and "draft sections requiring clinical revision" (behavioral observations, formulation, risk opinions, recommendations).
- In the OnlyOffice editor, visually differentiate these sections — perhaps with a sidebar annotation or background shading that indicates "AI-generated, review required" vs. "AI-generated from structured data."
- Reframe the marketing from "writes 80-90% of the report" to "handles the time-consuming documentation so you can focus on the clinical sections that require your expertise." This is more honest and more appealing to experienced clinicians.

---

### Concern 5: Practice Integration Realities

**Raised by: Panelists B, C, D**

**Psychometrist Workflow (Large Practices).** Panelist B manages four psychometrists who administer and score tests. The psychologist reviews scores, conducts the clinical interview, and writes the report. Psygil's workflow assumes the psychologist does everything. In reality, the psychometrist generates the score reports, the psychologist reviews them, and the report-writing begins. Psygil needs to accommodate a workflow where someone other than the psychologist enters test data.

**Existing Scoring Platform Integration.** Every panelist uses at least one publisher scoring platform: Q-global (Pearson: WAIS-V, WISC-V, WMS-IV, MMPI-3), PARiConnect (PAR: PAI, SIRS-2), WPS Online (WPS: ADOS-2). These platforms generate PDF score reports. The most valuable thing the Ingestor Agent could do is parse these PDFs accurately. If it can extract a Q-global MMPI-3 extended score report into structured data, that alone saves 30-60 minutes per evaluation.

**Referral Source Documentation.** Forensic evaluations begin with a court order or attorney referral that specifies the evaluation questions. Clinical evaluations begin with a referral from a physician, attorney, or insurance company. The referral document frames the entire evaluation. The Ingestor Agent should parse these referrals and extract the specific questions the evaluation must answer — these drive the report structure.

**Template Diversity.** Different courts, agencies, and referral sources require different report formats. A state forensic hospital competency report has a different structure than a private practice custody report. VA disability evaluations follow specific Disability Benefits Questionnaire (DBQ) formats. The template system must accommodate this variety, not impose a single structure.

**Recommendation:**

- Add a "Psychometrist" user role (or data entry mode) where test scores and administration notes can be entered by someone who is not the evaluating psychologist.
- Prioritize Q-global and PARiConnect PDF import as a launch feature. This is where the largest immediate time savings are.
- Add a referral document parser that extracts the specific evaluation questions and uses them to structure the report outline.
- Support multiple report templates per evaluation type, configurable per referral source or jurisdiction.

---

### Concern 6: Cross-Examination Defensibility of AI-Assisted Reports

**Raised by: Panelists A, C, E (forensic-critical)**

Every forensic psychologist's report will eventually be challenged on cross-examination. An opposing attorney who learns that a report was "AI-generated" will exploit this aggressively. The panel's concerns:

**"Doctor, did you write this report?"** If the answer is "an AI wrote the first draft and I reviewed it," the opposing attorney will challenge every sentence: "Did the AI write this sentence? Did you personally observe this behavior, or did the AI extract it from a transcript? Can you explain the AI's reasoning for including this particular piece of evidence?" The clinician must be able to defend every sentence as their own professional work product.

**Daubert/Frye Challenges to AI Methodology.** An opposing expert could argue that the AI's evidence mapping methodology is not "generally accepted" in the field (Frye standard) or that the AI's methods have not been subjected to peer review and do not have a known error rate (Daubert standard). If the Diagnostician Agent's evidence mapping influenced the clinician's diagnostic thinking, this becomes an admissibility challenge.

**The Audit Trail Is a Double-Edged Sword.** The spec positions the audit trail as a defense record. But it's also discoverable. An opposing attorney could subpoena the audit trail and use it to show: which diagnostic options the AI presented that the clinician rejected (suggesting the clinician is cherry-picking), how much of the report the clinician edited vs. accepted as-is (suggesting the clinician didn't exercise independent judgment), and the time stamps (if the clinician "reviewed" 30 pages in 5 minutes, that's not a review).

**Recommendation:**

- The product needs a "Testimony Preparation" feature that helps clinicians prepare for cross-examination about AI assistance. This should include: a clear statement of what the AI did and didn't do, documentation that the clinician exercised independent clinical judgment, and talking points for common challenges.
- Consider making the audit trail detail level configurable — the clinician should be able to choose what level of process detail is recorded, understanding the trade-offs. Some clinicians may prefer a less granular trail that documents gate decisions without logging every AI suggestion that was rejected.
- The product's website, documentation, and marketing must never use language that implies the AI "decides," "determines," or "concludes" anything. Even casual marketing language like "AI-powered diagnostics" could be used against a clinician on the stand.
- Engage a forensic psychology ethics consultant and a trial attorney to review the product's discoverability implications before launch.

---

## III. ADDITIONAL CONCERNS AND SUGGESTIONS

### A. Cultural and Linguistic Competence

**Raised by: Panelist D**

The APA Multicultural Guidelines (2017) require psychologists to consider cultural, linguistic, and contextual factors in assessment. The Writer Agent generating behavioral observations and clinical formulations must account for: culturally-specific presentation of symptoms (somatization of depression in some cultures), language barriers and interpreter use, cultural context for behaviors that might otherwise be pathologized, and immigration-related stressors (particularly relevant for forensic immigration evaluations, which are a growing market).

**Recommendation:** Add cultural/linguistic context fields to the case record that the Writer Agent incorporates into formulations. Consider adding immigration evaluations to the evaluation type list — this is a fast-growing forensic subspecialty.

### B. Informed Consent for AI-Assisted Evaluation

**Raised by: Panelists A, C, D (consensus)**

The APA Ethics Code (Standard 9.03) requires informed consent for assessments. If an AI tool assists in the evaluation process, the evaluee should be informed. The spec does not address this.

**Recommendation:** Build an informed consent template into the system that discloses AI assistance in documentation. The language should be vetted by a forensic psychology ethics committee. Example: "This evaluation utilized AI-assisted documentation tools for organizing records and drafting report sections. All clinical observations, diagnostic decisions, and professional opinions were made independently by the evaluating psychologist."

### C. Peer Consultation Documentation

**Raised by: Panelist C**

In complex cases, forensic psychologists frequently consult with colleagues. The APA Specialty Guidelines for Forensic Psychology encourage peer consultation. The system should accommodate documentation of peer consultations that informed the evaluation.

**Recommendation:** Add a "Peer Consultation" section to the case record and report template.

### D. Version Control and Report Finalization

**Raised by: Panelists A, B**

Forensic reports are legal documents. Once submitted to the court, they should not be altered. The version control system must clearly distinguish between working drafts and finalized reports, and finalized reports should be locked against further editing with a clear chain of custody.

**Recommendation:** Implement a "Finalize Report" action that locks the document, generates a hash for integrity verification, and creates a sealed PDF alongside the .docx. Any subsequent changes create a new version with an amendment log.

### E. Billing Integration is More Urgent Than Stated

**Raised by: Panelists C, E**

The spec defers billing to post-Beta. For a small practice or solo practitioner, the billing workflow is inseparable from the evaluation workflow. Every evaluation has CPT codes (96130-96133 for psychological testing, 96136-96139 for neuropsychological testing) and time tracking requirements. If the system already tracks time spent on each case, generating the billing documentation is a small incremental feature that dramatically increases value for solo practitioners.

**Recommendation:** Reconsider deferring billing entirely. At minimum, track time-per-case and map evaluation types to CPT codes. Full superbill generation can wait, but basic billing data capture should be in the MVP.

---

## IV. WHAT THE PANEL WOULD PAY FOR (IN PRIORITY ORDER)

Across all five panelists, here is what they would pay $299-$349/month for, in priority order:

1. **Q-global and PARiConnect PDF import with structured score extraction.** This alone saves 30-60 minutes per evaluation. If it works reliably, it's worth the subscription.
2. **Background history synthesis from records.** Taking 200 pages of medical/legal/school records and generating a coherent chronological summary is 2-4 hours of work. If the AI does this well, it's transformative.
3. **Court-formatted report templates by jurisdiction and evaluation type.** Not generic templates — templates that match what their specific court expects.
4. **The audit trail / attestation record.** For forensic practitioners, this is insurance against cross-examination challenges.
5. **Voice-matched report writing.** Having the AI write in their established voice, rather than generic clinical prose, is the difference between "I'll use this" and "I'll need to rewrite everything anyway."
6. **Legal review / Daubert compliance checking.** Having an adversarial reader check for cross-examination vulnerabilities before the report is submitted.

---

## V. VERDICT FROM THE PANEL

**Panelist A (Solo Forensic, 20 years):** "I've been waiting for something like this for a decade. The principle of 'doctor diagnoses' is non-negotiable and you've got it right. My concern is the pipeline rigidity — my workflow is messy and iterative, not a clean four-stage process. If you can make it flexible enough for how I actually work, I'll pay for it. If it forces me into a linear pipeline, I'll fight it for a month and go back to Word."

**Panelist B (Hospital Neuropsych, 15 years):** "My psychometrists need access. Q-global import is the killer feature — we process 300+ evaluations a year and each one has a 15-page MMPI-3 report that needs to be manually entered. If your Ingestor can parse that accurately, you've already saved my department 500+ hours per year. That alone justifies the cost."

**Panelist C (Small Group, Custody, 10 years):** "Test publisher licensing is your biggest blind spot. You can't store WAIS-V norms. You can't replicate PAI scoring. Parse the score reports — don't reinvent the wheel. Also, billing matters more than you think. I track every minute because insurance companies demand it."

**Panelist D (VA, PTSD/TBI, 12 years):** "The cultural competence gap worries me. I evaluate veterans from 40 countries in 15 languages. If the Writer generates formulations that don't account for cultural context, I'm going to spend as much time fixing the AI's work as I saved. Also, I need this to work within my VA EHR workflow eventually — I know that's post-Beta, but don't architect yourself into a corner."

**Panelist E (Early-career, Solo, 3 years):** "I'm your easiest sell. I'm drowning in documentation, I can't afford a psychometrist, and I need every efficiency gain I can get. The $299-$349 price is a stretch at my caseload, but if it saves me 4+ hours per evaluation, it pays for itself in two evaluations per month. My concern is onboarding — if setup takes a whole day, I can't afford the time investment. The 30-minute first-report target is critical for people like me."

---

*This review is a simulated exercise based on published practice standards, peer-reviewed literature, and realistic practitioner perspectives. It should be validated with actual forensic and clinical psychologists during beta testing.*

**Sources consulted:**

- [APA Specialty Guidelines for Forensic Psychology](https://www.apa.org/practice/guidelines/forensic-psychology)
- [Eight Best Practices for Forensic Psychological Assessment (Annual Reviews)](https://www.annualreviews.org/content/journals/10.1146/annurev-lawsocsci-050420-010148)
- [AAPL Practice Guideline for Forensic Assessment](https://www.aapl.org/docs/pdf/Forensic_Assessment.pdf)
- [NAN/AACN Joint Position Paper on Computerized Assessment Devices](https://pmc.ncbi.nlm.nih.gov/articles/PMC3847815/)
- [AACN Position on Test Security](https://www.tandfonline.com/doi/full/10.1080/13854046.2021.2022214)
- [Report Writing in the Forensic Context: Recurring Problems (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC6818304/)
- [Ethical Challenges of AI in Psychological Assessment (Springer)](https://link.springer.com/article/10.1007/s43681-025-00788-4)
- [APA Survey: Psychologists' AI Use and Concerns (2025)](https://www.apa.org/news/press/releases/2025/12/psychologists-ai-use-concerns)
- [NAN/AACN/ACPN Update on Third Party Observers](https://pubmed.ncbi.nlm.nih.gov/34008473/)
