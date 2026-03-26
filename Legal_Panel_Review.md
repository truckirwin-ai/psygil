# Psygil — Legal Panel Review

**Simulated Critical Review by a Panel of Attorneys**
**Date:** March 19, 2026
**Document Reviewed:** Psygil Technical & Functional Analysis (Revised Architecture)
**Scope:** Legal soundness of the application design, output defensibility, regulatory compliance, liability exposure, and intellectual property risks

---

## Panel Composition

- **Panelist 1 — Health Law & FDA Regulatory:** Partner at a national health law firm, 18 years. Advises digital health startups on FDA classification, HIPAA compliance, and state AI healthcare regulations.
- **Panelist 2 — Medical Malpractice Defense:** Senior litigator, 22 years. Defends physicians, hospitals, and medical device companies in malpractice and product liability actions.
- **Panelist 3 — Intellectual Property & Licensing:** IP partner, 15 years. Specializes in software licensing, copyright, and trade secret disputes. Advises test publishers and clinical software companies.
- **Panelist 4 — Trial Attorney (Plaintiff):** Senior trial attorney, 20 years. Represents plaintiffs in personal injury, custody, and criminal cases where forensic psychological evaluations are challenged on cross-examination. This panelist will attack Psygil's output.
- **Panelist 5 — Privacy & Data Security:** Counsel at a privacy-focused firm, 12 years. Specializes in HIPAA, state privacy laws, data breach litigation, and emerging AI transparency regulations.
- **Panelist 6 — Forensic Psychology Ethics & Expert Testimony:** Attorney-psychologist (JD/PhD), 14 years. Consults on admissibility of psychological testimony, ethics complaints, and licensing board actions.

---

## I. OVERALL LEGAL ASSESSMENT

**The panel agrees: the "doctor always diagnoses" principle is the single most important legal decision in this product.** It is the architectural firewall between Psygil being classified as a writing tool (low regulatory burden, standard liability posture) and being classified as a clinical decision support system (FDA scrutiny, heightened liability, potential device classification). Every design choice should be tested against the question: "Does this move us closer to or further from the line where the AI is making clinical decisions?"

**The local-first PHI architecture is a genuine legal advantage** that simplifies HIPAA compliance substantially. If PHI truly never leaves the device, the regulatory surface area is dramatically smaller than cloud-based competitors.

**However, the panel identified critical legal risks** that, if not addressed before launch, could expose Psygil, its users, and Foundry SMB to significant liability. Several of these are addressable through design changes and documentation. Others require outside counsel engagement before the product ships.

---

## II. CRITICAL LEGAL ISSUES

### Issue 1: FDA Regulatory Classification — Stay on the Right Side of the Line

**Raised by: Panelist 1 (Health Law & FDA)**

This is the threshold legal question: **Is Psygil a medical device under FDA jurisdiction?**

Under the 21st Century Cures Act (Section 3060), certain clinical decision support (CDS) software is exempt from FDA device classification if it meets ALL FOUR of these criteria: (1) it is not intended to acquire, process, or analyze a medical image, signal, or pattern; (2) it is intended for the purpose of displaying, analyzing, or printing medical information; (3) it is intended for the purpose of supporting or providing recommendations to a health care professional about prevention, diagnosis, or treatment; and (4) it is intended for the purpose of enabling the health care professional to independently review the basis for the recommendations.

Psygil's current design *likely* qualifies for this CDS exemption — but only if the architecture is maintained precisely as described. The moment the product begins to: select or recommend diagnoses autonomously, process medical imaging (MRI, CT, EEG), generate risk scores that practitioners rely on without independent review, or make treatment recommendations — it crosses from exempt CDS into Software as a Medical Device (SaMD), which requires FDA premarket authorization (510(k) or De Novo).

**Critical concern:** The Diagnostician Agent's evidence mapping — even though it's framed as presenting options, not making decisions — could be characterized as "providing recommendations about diagnosis" under criterion (3). The key to maintaining exemption is criterion (4): the practitioner must be able to "independently review the basis" for the AI's analysis. The three-gate architecture with active clinician review at each stage supports this. But if future features erode clinician oversight (batch processing, auto-acceptance, or reduced gate friction), the exemption could be lost.

**Recommendations:**

- Engage an FDA regulatory attorney to review the product design against the CDS exemption criteria *before launch*. This is a $15K-$25K engagement that prevents a potential product shutdown.
- Document the CDS exemption analysis in writing and maintain it as a living document updated with each feature release.
- Add internal design review gates: any new feature must be assessed against the four CDS exemption criteria before implementation.
- Never use the words "diagnose," "diagnostic tool," or "clinical decision support" in marketing, documentation, or product UI. Use "writing tool," "evidence organization," and "documentation assistant" consistently.
- Monitor the FDA's evolving AI/ML Action Plan (finalized December 2024) and state-level AI healthcare regulations (particularly California AB 3030 and Colorado SB 24-205) for changes that could affect classification.

---

### Issue 2: Malpractice Liability — Who Gets Sued When a Report Is Wrong?

**Raised by: Panelist 2 (Malpractice Defense)**

When an AI-assisted forensic report leads to an adverse outcome — a wrongful conviction, a child placed with an abusive parent, a dangerous individual released based on an underestimated risk assessment — someone gets sued. The legal question is: who?

**Current liability landscape for AI-assisted medical documentation:**

- **The practitioner** bears primary liability. Physicians and psychologists have a duty to independently exercise clinical judgment regardless of what tools they use. Using an AI writing tool does not transfer liability to the tool developer. The practitioner who signs the report is professionally and legally responsible for its contents.
- **The tool developer** (Foundry SMB) faces potential product liability claims if the software is defective — e.g., if the PII detection fails and PHI is exposed, if the Ingestor Agent materially misrepresents test scores, or if the Writer Agent generates factually incorrect content that the clinician fails to catch.
- **The organization** (hospital, practice, court system) that deploys the tool may face institutional liability if it mandated use without adequate training or oversight.

**Psygil's "doctor always diagnoses" architecture is the strongest possible defense.** It establishes that the AI is a tool, not an autonomous agent. The three-gate review process, the attestation record, and the explicit clinician sign-off all support the argument that the practitioner exercised independent judgment. This is exactly the posture that malpractice defense counsel would want.

**However, there are vulnerabilities:**

**The "80-90% of the document" claim is a plaintiff's exhibit.** If Psygil's marketing, documentation, or UI communicates that the AI writes most of the report, a plaintiff's attorney will argue that the practitioner was essentially rubber-stamping AI output, not exercising independent judgment. The percentage claim must be removed from all external-facing materials.

**The Writer Agent generating behavioral observations creates liability.** Behavioral observations ("The patient presented with flat affect, poor eye contact, and psychomotor retardation") are personal clinical observations that only the examiner can make. If the Writer Agent generates these from transcript analysis and the clinician doesn't materially revise them, a plaintiff can argue the clinician didn't actually observe the patient — the AI inferred behavior from text. This is a devastating cross-examination vector.

**Factual errors in AI-generated content.** If the Ingestor Agent misparses a test score (e.g., transposing a WAIS-V FSIQ of 86 to 68) and the clinician doesn't catch it, the resulting diagnostic formulation could be fundamentally wrong. The practitioner is liable for the error, but Foundry SMB could face a product liability claim for a defective ingestion pipeline.

**Recommendations:**

- Remove the "80-90%" claim from all materials. Replace with language like "automates time-consuming documentation tasks" without quantifying the AI's contribution.
- Behavioral observations must be clearly marked in the UI as "Draft — Requires Clinician Review and Revision." Consider requiring the clinician to affirmatively edit or confirm each behavioral observation, not just scroll past it.
- Implement a "Critical Data Verification" step where all parsed test scores are displayed in a side-by-side comparison with the source document, requiring clinician confirmation. Test score errors are among the most damaging factual mistakes in forensic reports.
- Draft a comprehensive End User License Agreement (EULA) with: clear disclaimers that the software is a writing assistance tool, not a clinical decision support system; explicit statement that the practitioner bears full professional responsibility for report content; limitation of liability clause capping Foundry SMB's exposure; indemnification provisions; and mandatory arbitration clause.
- Obtain product liability insurance (Errors & Omissions / Professional Liability) before launch. Budget $5K-$15K/year depending on coverage limits.

---

### Issue 3: Intellectual Property — Test Publisher Licensing Is a Legal Minefield

**Raised by: Panelist 3 (Intellectual Property)**

The instrument library as currently described raises serious intellectual property concerns that could result in cease-and-desist orders, copyright infringement claims, or trade secret misappropriation allegations.

**What is protectable:**

- **Test content (items, stimuli, protocols):** Copyrighted and trade-secret-protected. Reproducing, storing, or distributing test items is a direct copyright infringement and a violation of test security obligations.
- **Scoring algorithms and normative tables:** These are proprietary data owned by publishers. The specific cutoff scores, percentile conversions, and classification ranges (e.g., "FSIQ 70-79 = Borderline") are derived from copyrighted normative studies.
- **Interpretive text:** Publisher-provided interpretation narratives are copyrighted. The Ingestor Agent cannot reproduce them.
- **Test abbreviations and names:** Generally not protectable as trademarks for descriptive use, but some publishers have asserted trademark claims.

**What is NOT protectable:**

- The fact that a particular test exists and what it measures (factual information).
- A clinician's own test scores for a specific patient (the clinician licensed the test and owns the results).
- General classification ranges that are published in peer-reviewed literature and widely known in the field.
- The clinician's own interpretations of scores.

**The spec describes the instrument library as containing "scoring ranges, normative data reference, forensic-specific considerations."** If "scoring ranges" means specific normative cutoffs from publisher manuals, this is a copyright and trade secret issue. If it means general classification categories from published literature, it's defensible.

**The spec also states the Ingestor Agent "knows that a WAIS-V FSIQ of 68 is in the Extremely Low range."** This specific score-to-classification mapping comes from the WAIS-V Technical and Interpretive Manual, which is copyrighted by Pearson. Storing this mapping in the software distributes copyrighted data.

**Recommendations:**

- Strip all publisher-specific normative cutoffs from the instrument library. Store only: instrument name, abbreviation, what it measures, associated diagnoses, and references to the publisher manual.
- The Ingestor Agent should parse score reports from publisher platforms (Q-global, PARiConnect) where the publisher has already generated the classifications. The agent reads the publisher's output — it doesn't replicate the publisher's normative tables.
- For the Diagnostician Agent's evidence mapping, use only the classifications that appear on the publisher-generated score report (which the clinician has already licensed). Do not independently derive classifications from raw scores.
- Engage Pearson Clinical, PAR, and WPS legal/business development teams to discuss data interchange partnerships. These publishers have existing integrations with EHR systems and may license structured data exports.
- The DSM-5-TR database issue identified in the technical analysis is confirmed as a critical IP risk. APA Publishing holds copyright on the criteria text. A licensing agreement or a fallback to criterion codes (which are factual and not copyrightable) is required.
- Have IP counsel review the instrument library and diagnosis catalog before launch to ensure no copyrighted content has been inadvertently included.

---

### Issue 4: The Audit Trail Is Discoverable — Design It Accordingly

**Raised by: Panelist 4 (Plaintiff's Trial Attorney)**

I will subpoena the audit trail. Here is what I will do with it:

**Attack 1: The AI wrote the report, not the doctor.**

I will request production of the full audit trail showing: the original AI-generated draft, every edit the clinician made, and the final submitted report. I will then calculate the percentage of the report that the clinician actually changed. If the clinician accepted 90% of the AI's output with minimal edits, I will argue to the jury that this evaluation was conducted by an algorithm, not a licensed psychologist. I will ask: "Doctor, you spent 47 minutes reviewing a 35-page report that the AI generated in 3 minutes. Is that your idea of independent clinical judgment?"

**Attack 2: The AI offered diagnoses the doctor rejected.**

If the Diagnostician Agent presented five potential diagnoses and the clinician selected only two, I will ask: "Doctor, the AI identified evidence supporting Antisocial Personality Disorder. You rejected that diagnosis. Why? Did you have additional evidence the AI didn't consider, or did you simply disagree with the algorithm?" I will use the rejected options to argue the clinician was cherry-picking diagnoses.

**Attack 3: Timestamp analysis.**

I will calculate how much time the clinician spent at each gate. If Gate 2 (the diagnostic decision) shows a 4-minute timestamp, I will argue: "You reviewed the evidence for ten potential diagnoses, each with multiple DSM-5-TR criteria, and made your diagnostic determination in four minutes?"

**Attack 4: The AI's legal review flags.**

If the Editor/Legal Reviewer Agent flagged speculative language and the clinician dismissed the flag, I will introduce that flag as evidence that even the AI recognized the report's weaknesses — and the clinician ignored the warning.

**Recommendations (from defense perspective):**

- **The audit trail granularity must be configurable.** The clinician should choose between: "Full Detail" (logs every AI suggestion, every edit, every timestamp — maximum transparency, maximum discoverability risk) and "Decision Record Only" (logs gate approvals, diagnostic selections, and final attestation — documents clinician oversight without exposing the sausage-making). Default to "Decision Record Only."
- **Never log rejected diagnostic options.** The Evidence Map should present criteria evidence, but the audit trail should record only what the clinician *selected*, not what the AI presented that the clinician rejected. Documenting rejected options creates a cross-examination roadmap.
- **Do not timestamp individual gate review durations to the minute.** Record the date of gate completion, not the clock time. A timestamp of "reviewed on March 15, 2026" is defensible. A timestamp of "Gate 2 completed in 3 minutes 47 seconds" is an invitation to attack.
- **Build a "Testimony Preparation" export** that generates a clean summary of the clinician's review process: which gates were completed, what diagnostic decisions were made, and the clinician's attestation. This is what the clinician's attorney would want to present — a narrative of independent professional judgment, not a granular log of AI interactions.
- **Consult with a litigation hold specialist** to develop data retention policies for audit trails. How long are they kept? Can they be purged after the case is closed? State laws on medical record retention vary (typically 7-10 years) and may apply to audit trail data.

---

### Issue 5: HIPAA and PHI — The Local-First Architecture Is Strong, but Not Complete

**Raised by: Panelist 5 (Privacy & Data Security)**

The local-first architecture substantially reduces HIPAA exposure. If PHI never leaves the device, the primary HIPAA concerns — transmission security, cloud storage, and business associate agreements with cloud providers — are eliminated. This is a genuine legal advantage.

**However, several HIPAA issues remain:**

**The LLM Gateway sends data to external servers.** The spec states that PHI is de-identified before transmission to Claude/GPT-4o, and that only de-identified text reaches the LLM. This is the critical claim. If de-identification fails — if a patient name, date of birth, Social Security number, or other identifier survives the PII detection pipeline — the transmission constitutes a HIPAA breach. The consequences include: HHS Office for Civil Rights enforcement (fines up to $2.09M per violation category per year), state attorney general enforcement, private right of action in some states, and mandatory breach notification if the breach affects 500+ individuals.

**The >99% PII detection sensitivity claim means 1% of PHI entities are missed.** In a 30-page forensic report with potentially hundreds of PHI entities (names, dates, locations, ID numbers, phone numbers), a 1% miss rate could mean several PHI entities in every transmission. This is not compliant.

**Backup files containing PHI.** Encrypted local backups are good practice, but if a clinician's laptop is stolen and the encryption is defeated, the PHI is exposed. HIPAA requires a risk assessment for all PHI storage, including local storage.

**HIPAA Business Associate Agreement (BAA) with LLM providers.** Even though the data is de-identified before transmission, the argument that de-identified data is not PHI depends on the de-identification being compliant with HIPAA's Safe Harbor method (45 CFR 164.514(b)) or Expert Determination method (45 CFR 164.514(a)). If the de-identification does not meet these standards, the LLM provider is receiving PHI and a BAA is required. Both Anthropic (Claude) and OpenAI offer BAAs for enterprise customers — obtain them regardless, as a belt-and-suspenders measure.

**State privacy law compliance.** Multiple states have enacted or are enacting AI-specific healthcare privacy laws. California AB 3030 (effective January 1, 2025) requires disclosure to patients when generative AI is used to generate patient communications relating to clinical information. Colorado SB 24-205 (effective mid-2026) classifies AI systems that affect healthcare access as "high-risk" and requires impact assessments, disclosure, and risk management. These requirements may apply to Psygil depending on how the product is used.

**Recommendations:**

- Validate the PII detection pipeline against the HIPAA Safe Harbor de-identification standard (18 identifier categories). Achieving Safe Harbor compliance for the de-identified text sent to the LLM is the cleanest legal position. Document this validation.
- Implement a "PHI review queue" where the clinician can review de-identified text before it's sent to the LLM, at least for the first several evaluations. This catches systematic de-identification failures early.
- Obtain BAAs from Anthropic and OpenAI regardless of the de-identification claim. The cost is zero (they offer them to enterprise customers), and it eliminates a legal argument.
- Conduct a formal HIPAA Security Rule risk assessment for the application and document it. This is required for any system handling PHI, even local-first systems.
- Implement device-level encryption requirements: require full-disk encryption on the host machine, enforce strong passphrase requirements for the application, and implement auto-lock after inactivity.
- Monitor California AB 3030, Colorado SB 24-205, and similar state laws. Build a disclosure mechanism into the product: a configurable informed consent statement that the clinician can include in evaluation reports disclosing AI assistance in documentation. Some states may require this.

---

### Issue 6: Admissibility of AI-Assisted Expert Testimony — Daubert/Frye Risks

**Raised by: Panelist 6 (Attorney-Psychologist, JD/PhD)**

This is the concern that keeps forensic psychologists up at night. When a clinician who used Psygil takes the stand, the opposing counsel will challenge the admissibility of their testimony under Daubert or Frye. The challenge will target the AI's methodology, not the clinician's.

**The Daubert attack:**

Under Daubert v. Merrell Dow Pharmaceuticals (1993), expert testimony must be based on: (1) a testable theory or technique, (2) that has been subjected to peer review and publication, (3) with a known or potential error rate, (4) with existing and maintained standards controlling the technique's operation, and (5) that has general acceptance in the relevant scientific community.

An opposing expert will argue: "The AI system that organized evidence and drafted this report has not been subjected to peer review. Its error rate for evidence mapping is unknown. There are no published standards for AI-assisted forensic evaluation. The method is not generally accepted in the forensic psychology community. Under Daubert, the methodology underlying this report is inadmissible."

**The Frye attack (in Frye jurisdictions):**

Under Frye v. United States (1923), the technique must have "general acceptance" in the relevant scientific community. AI-assisted forensic report writing is not yet generally accepted. A Frye challenge could exclude the testimony entirely.

**The defense:**

The strongest defense is that the AI is not the "methodology" — the clinician's methodology is standard forensic psychological evaluation (clinical interview, records review, psychometric testing, behavioral observation, diagnostic formulation). The AI assisted only with documentation — the writing, not the clinical reasoning. The clinician's methodology is well-established, peer-reviewed, and generally accepted. The AI is a writing tool, like Dragon dictation software or a word processor.

**This defense holds only if the product is designed and used as a writing tool.** If the Diagnostician Agent's evidence mapping influenced the clinician's diagnostic reasoning — if the clinician relied on the AI to identify which diagnoses to consider — the defense collapses. The evidence mapping becomes part of the methodology, and it's subject to Daubert/Frye scrutiny.

**Recommendations:**

- The product must be positioned, designed, and documented as a **writing and documentation tool**, not an evidence analysis tool. This is the Daubert/Frye firewall.
- The Diagnostician Agent's evidence mapping feature is the highest legal risk feature in the product. Consider whether it should be: (a) an optional feature the clinician can disable, (b) clearly labeled as "organizational assistance" rather than "evidence analysis," or (c) designed so that the clinician provides their diagnostic hypotheses first, and the AI then organizes the evidence to support the clinician's own reasoning — rather than the AI generating hypotheses the clinician didn't independently develop.
- Publish peer-reviewed validation studies. A single published study demonstrating that Psygil-assisted reports meet or exceed the quality standards of unassisted reports would substantially strengthen the Daubert defense. Target the Journal of Forensic Psychology Research and Practice or Law and Human Behavior.
- Develop a "Testimony Guide" for clinicians that includes: sample voir dire responses about AI-assisted documentation, talking points for Daubert/Frye challenges, and language that frames the AI as a documentation tool.
- Engage a forensic psychology academic to serve as an expert witness consultant who can testify about the methodology's validity if needed.
- Track judicial opinions on AI-assisted expert testimony. This is a rapidly evolving area of law. The National Center for State Courts published an AI-generated evidence guide for judges in 2024 that signals increasing judicial scrutiny.

---

## III. ADDITIONAL LEGAL CONCERNS

### A. Terms of Service and Liability Limitation

**Panelist 2:**

The EULA must include: disclaimer that the software is not a medical device and is not intended to diagnose, treat, or prevent any condition; explicit allocation of professional responsibility to the licensed practitioner; limitation of Foundry SMB's liability to the amount paid for the software in the preceding 12 months; exclusion of consequential, incidental, and punitive damages; mandatory binding arbitration with class action waiver (enforceable in most jurisdictions under AT&T Mobility v. Concepcion); governing law clause (select a favorable jurisdiction — Delaware or your home state); and a severability clause.

### B. Informed Consent for Evaluees

**Panelist 6:**

The APA Ethics Code (Standard 9.03) and the APA Specialty Guidelines for Forensic Psychology both require informed consent for evaluations. AI assistance in report writing should be disclosed to the evaluee. Build a configurable disclosure template into the system. Sample language: "This evaluation utilized AI-assisted documentation tools for organizing records and drafting report sections. All clinical observations, diagnostic determinations, and professional opinions were made independently by the undersigned evaluating psychologist."

### C. Data Retention and Destruction Policies

**Panelist 5:**

State medical record retention laws (typically 7-10 years, varying by state and patient age) apply to evaluation records. If audit trails are considered part of the medical record, they must be retained accordingly. Define clear data retention policies and communicate them to users. Implement automated retention schedules with notification before destruction.

### D. Open Source License Compliance (OnlyOffice AGPL)

**Panelist 3:**

The AGPL v3 license on OnlyOffice Community Edition has a "network use" clause: if users interact with the software over a network, you must make the source code of the modified version available. During development, this is manageable because the software isn't distributed. But if any beta testers use the Community Edition, and the Electron app is distributed to them, AGPL obligations may be triggered. Purchase the Developer Edition *before distributing to any external user*, not just before "production launch."

### E. Insurance Requirements

**Panelist 2:**

Before launch, obtain: Product Liability / Errors & Omissions insurance ($1M-$5M coverage), Cyber Liability insurance (for data breach notification costs if PII detection fails), Directors & Officers insurance (protects Foundry SMB leadership), and General Commercial Liability. Budget $10K-$25K/year for the insurance package. This is non-negotiable for a product handling PHI in forensic contexts.

---

## IV. LEGAL RISK SEVERITY MATRIX

| # | Issue | Severity | Timing | Estimated Cost to Address |
|---|-------|----------|--------|--------------------------|
| 1 | FDA CDS exemption analysis | **Critical** | Pre-launch | $15K-$25K (regulatory counsel) |
| 2 | EULA / Terms of Service drafting | **Critical** | Pre-launch | $10K-$20K (commercial counsel) |
| 3 | HIPAA Safe Harbor validation for de-identification | **Critical** | Pre-launch | $5K-$10K (privacy counsel + validation) |
| 4 | BAAs with Anthropic and OpenAI | **High** | Pre-launch | $0 (enterprise BAAs are free) |
| 5 | Product liability insurance | **High** | Pre-launch | $10K-$25K/year |
| 6 | Test publisher IP review of instrument library | **High** | Pre-launch | $5K-$10K (IP counsel) |
| 7 | DSM-5-TR content licensing (APA) | **High** | Month 1 | Varies (licensing negotiation) |
| 8 | Audit trail discoverability design review | **High** | Pre-launch | Internal (design decision) |
| 9 | Informed consent template development | **Medium** | Pre-launch | $2K-$5K (ethics consultant) |
| 10 | State AI healthcare law compliance review | **Medium** | Pre-launch | $5K-$10K (regulatory counsel) |
| 11 | Peer-reviewed validation study | **Medium** | Year 1 | $20K-$50K (academic collaboration) |
| 12 | OnlyOffice AGPL compliance (pre-distribution) | **Medium** | Pre-beta | $6K (Developer Edition license) |
| 13 | Data retention policy development | **Low** | Pre-launch | $2K-$5K (privacy counsel) |
| **Total estimated pre-launch legal budget** | | | | **$60K-$130K** |

---

## V. THE PANEL'S TOP 5 DIRECTIVES

1. **Engage an FDA regulatory attorney before launch.** The CDS exemption analysis is the threshold legal question. If Psygil is classified as SaMD, the entire go-to-market timeline and cost structure changes. Get this answered first. Budget $15K-$25K.

2. **Redesign the audit trail for litigation defensibility.** Default to "Decision Record Only" (gate approvals, diagnostic selections, attestation). Never log rejected diagnostic options. Use date stamps, not minute-level timestamps. Build a "Testimony Preparation" export that tells the story of independent clinical judgment.

3. **Remove every instance of percentage claims about AI contribution.** "Writes 80-90% of the report," "generates the bulk of the document," and similar language will be Plaintiff's Exhibit A in every malpractice case involving a Psygil-generated report. Replace with "automates documentation tasks so clinicians can focus on clinical judgment."

4. **Strip all publisher-proprietary normative data from the instrument library.** Parse publisher-generated score reports instead. Do not independently derive score classifications from raw scores. This is a copyright and trade secret issue that could result in cease-and-desist orders from Pearson, PAR, or WPS.

5. **Never use the words "diagnose," "diagnostic," or "clinical decision support" in any external-facing material.** The product is a "writing tool," a "documentation assistant," an "evidence organizer." This language is not marketing spin — it is the legal classification that determines FDA jurisdiction, Daubert/Frye defensibility, and malpractice liability allocation.

---

*This review is a simulated exercise based on current regulatory frameworks, case law, and legal analysis. It should be validated with licensed attorneys in health law, malpractice defense, intellectual property, and privacy before product launch. The estimated costs are ranges based on typical market rates and should be confirmed with specific counsel.*

**Legal sources consulted:**

- [FDA Regulation of Clinical Software / AI-ML (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC12264609/)
- [FDA CDS Guidance Updates (Arnold & Porter)](https://www.arnoldporter.com/en/perspectives/advisories/2026/01/fda-cuts-red-tape-on-clinical-decision-support-software)
- [AI and Medical Malpractice Liability (Milbank Quarterly)](https://www.milbank.org/quarterly/articles/artificial-intelligence-and-liability-in-medicine-balancing-safety-and-innovation/)
- [AI in Medical Malpractice (Indigo)](https://www.getindigo.com/blog/ai-in-medical-malpractice-liability-risk-guide)
- [AI-Generated Evidence Guide for Judges (NCSC)](https://www.ncsc.org/resources-courts/ai-generated-evidence-guide-judges)
- [Daubert and Frye Applied to AI Evidence (MSBA)](https://www.msba.org/site/site/content/News-and-Publications/News/General-News/Applying_Daubert_and_Frye_to_AI_Evidence.aspx)
- [HHS HIPAA Business Associates FAQ](https://www.hhs.gov/hipaa/for-professionals/faq/business-associates/index.html)
- [California AB 3030 AI Healthcare Disclosure](https://hooperlundy.com/the-ai-landscape-california-and-other-state-legislative-efforts-to-regulate-use-of-ai-in-health-care/)
- [Colorado SB 24-205 AI Act Healthcare Implications (Foley & Lardner)](https://www.foley.com/insights/publications/2025/02/the-colorado-ai-act-implications-for-health-care-providers/)
- [Discoverability of AI Prompts and Outputs (RedgraveLLP)](http://www.redgravellp.com/publication/don-t-rush-past-relevance-assessing-the-discoverability-of-ai-prompts-and-outputs)
- [OnlyOffice AGPL License FAQ](https://www.onlyoffice.com/license-faq)
