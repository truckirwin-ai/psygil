// =============================================================================
// Documents, reference materials for the clinician's workspace
// =============================================================================
//
// These live under /Workspace/Documents/ and provide quick-reference text
// for DSM codes, case law, professional guidelines, and HIPAA/forensic
// practice notes. Content is concise summary material, not full statutes
// or full articles. The clinician is expected to consult primary sources
// for definitive use.
// =============================================================================

export interface DocumentFile {
  readonly filename: string
  readonly title: string
  readonly content: string
}

// ---------------------------------------------------------------------------
// DSM-5-TR Forensic Quick Reference
// ---------------------------------------------------------------------------

const DSM5TR_REFERENCE: DocumentFile = {
  filename: 'DSM-5-TR_Forensic_Quick_Reference.md',
  title: 'DSM-5-TR Forensic Quick Reference',
  content: `# DSM-5-TR Forensic Quick Reference

A condensed reference for diagnostic codes most often encountered in forensic
psychology practice. This file is a starting point, not a substitute for the
full DSM-5-TR text.

## Psychotic Disorders

| Code | Name | Notes |
|------|------|-------|
| F20.9 | Schizophrenia | Specify course (first episode, multiple episodes, continuous) and current severity |
| F25.0 | Schizoaffective, bipolar type | Mood episodes must be concurrent with active phase for a substantial portion |
| F25.1 | Schizoaffective, depressive type | Same concurrence rule |
| F22 | Delusional Disorder | Specify subtype (persecutory, somatic, grandiose, jealous, mixed, unspecified) |
| F23 | Brief Psychotic Disorder | Duration at least 1 day but less than 1 month |
| F06.2 | Psychotic disorder due to another medical condition | Requires documented medical cause |

## Trauma and Stressor-Related

| Code | Name | Notes |
|------|------|-------|
| F43.10 | Posttraumatic Stress Disorder | Specify "with delayed expression" or "with dissociative symptoms" |
| F43.0 | Acute Stress Disorder | 3 days to 1 month post-trauma |
| F43.20 | Adjustment Disorder, unspecified | Onset within 3 months of stressor |
| F43.21 | Adjustment with depressed mood | |
| F43.22 | Adjustment with anxiety | |
| F43.23 | Adjustment with mixed anxiety and depressed mood | |
| F43.24 | Adjustment with disturbance of conduct | |

## Mood Disorders

| Code | Name | Notes |
|------|------|-------|
| F32.x | Major Depressive Disorder, single episode | x specifies severity: .0 mild, .1 moderate, .2 severe, .3 with psychotic features |
| F33.x | Major Depressive Disorder, recurrent | Same severity specifiers |
| F34.1 | Persistent Depressive Disorder (Dysthymia) | Duration at least 2 years |
| F31.x | Bipolar I Disorder | x encodes current episode and severity |
| F31.81 | Bipolar II Disorder | No history of manic episode |

## Anxiety Disorders

| Code | Name | Notes |
|------|------|-------|
| F41.1 | Generalized Anxiety Disorder | Duration at least 6 months |
| F40.0x | Agoraphobia | |
| F40.10 | Social Anxiety Disorder | |
| F41.0 | Panic Disorder | |

## Personality Disorders

| Code | Name | Cluster |
|------|------|---------|
| F60.0 | Paranoid | A |
| F60.1 | Schizoid | A |
| F60.2 | Antisocial | B |
| F60.3 | Borderline | B |
| F60.4 | Histrionic | B |
| F60.5 | Obsessive-Compulsive (Personality) | C |
| F60.6 | Avoidant | C |
| F60.7 | Dependent | C |
| F60.81 | Narcissistic | B |

## Neurodevelopmental

| Code | Name | Notes |
|------|------|-------|
| F90.0 | ADHD, predominantly inattentive | Symptoms before age 12, two or more settings |
| F90.1 | ADHD, predominantly hyperactive-impulsive | |
| F90.2 | ADHD, combined | |
| F70-F73 | Intellectual Disability | F70 mild, F71 moderate, F72 severe, F73 profound |
| F84.0 | Autism Spectrum Disorder | Level 1, 2, or 3 per support needs |

## Substance-Related

Use the F10-F19 series with .10 for mild, .20 for moderate, .21 for moderate
in remission, .20 for severe, etc. Common codes:

- F10.20 Alcohol Use Disorder, moderate
- F11.20 Opioid Use Disorder, moderate
- F14.20 Cocaine Use Disorder, moderate
- F12.20 Cannabis Use Disorder, moderate

## Forensic-Relevant V Codes and Z Codes

- Z65.3 Problems related to other legal circumstances
- Z65.1 Imprisonment or other incarceration
- Z63.0 Relationship distress with spouse or intimate partner
- Z62.820 Parent-child relational problem
- Z91.5 Personal history of self-harm

## Notes on Use in Forensic Reports

Always specify the full diagnostic criterion set met in the body of the
report. A code alone is not sufficient. Note the sources of information
supporting each criterion: interview, records, collateral, testing. Where
criteria are partially met or where differential diagnoses remain live,
document that explicitly rather than forcing a single code.
`,
}

// ---------------------------------------------------------------------------
// Dusky Standard
// ---------------------------------------------------------------------------

const DUSKY_REFERENCE: DocumentFile = {
  filename: 'Dusky_Standard_and_Key_Case_Law.md',
  title: 'Dusky Standard and Key CST Case Law',
  content: `# Dusky Standard and Key Competency to Stand Trial Case Law

## The Dusky Standard

**Dusky v. United States, 362 U.S. 402 (1960)**

The foundational federal competency standard. A defendant must have:

1. **Sufficient present ability to consult with counsel** with a reasonable
   degree of rational understanding, AND
2. A **rational as well as factual understanding** of the proceedings
   against them.

Both prongs must be satisfied. A defendant who can recite facts about court
proceedings but holds delusional beliefs that prevent meaningful consultation
with counsel does not meet Dusky.

## Related Federal Decisions

**Drope v. Missouri, 420 U.S. 162 (1975)**
Expanded Dusky by holding that a defendant must have the capacity to assist
in preparing their defense. Due process requires inquiry whenever evidence
raises a bona fide doubt about competency.

**Godinez v. Moran, 509 U.S. 389 (1993)**
Held that the competency standard for pleading guilty or waiving counsel is
the same as for standing trial. Rejected the argument that a higher standard
applies to waiver of counsel.

**Indiana v. Edwards, 554 U.S. 164 (2008)**
Carved out an exception to Godinez. A trial court may deny self-representation
to a defendant who is competent to stand trial but not competent to conduct
trial proceedings alone. Introduces a "representational competence" standard
that is higher than Dusky.

**Jackson v. Indiana, 406 U.S. 715 (1972)**
A defendant found incompetent may not be held indefinitely awaiting
restoration. The state must either make progress toward restoration within a
reasonable period or begin civil commitment or release the defendant.

**Sell v. United States, 539 U.S. 166 (2003)**
Established the four-factor test for involuntarily medicating a defendant to
restore competency: (1) important governmental interests, (2) medication will
significantly further those interests, (3) necessary to further those
interests, (4) medically appropriate.

**Cooper v. Oklahoma, 517 U.S. 348 (1996)**
Held that states may not require proof of incompetency by clear and
convincing evidence. A preponderance standard is constitutionally required.

## Key Functional Abilities to Assess

Drawing from the federal standard and most state statutes, the examiner
should make factual findings on:

1. **Factual understanding of the proceedings**
   - Identifies the roles of courtroom personnel (judge, prosecutor, defense
     counsel, jury, witnesses)
   - Understands the charges and possible penalties
   - Understands plea options

2. **Rational understanding**
   - Can apply factual knowledge to their own case
   - Is not prevented by delusional or psychotic beliefs from engaging with
     the reality of their situation
   - Can weigh the advice of counsel against alternatives

3. **Capacity to consult with counsel**
   - Can disclose relevant information to their attorney
   - Can track the attorney's questions and provide coherent answers
   - Can tolerate the stress of the courtroom
   - Can make reasoned decisions about plea, defense strategy, and testimony

## Jurisdictional Considerations

Many states have codified Dusky with additional functional abilities. Verify
the applicable statute for the jurisdiction at the start of each evaluation.
Colorado, for example, uses C.R.S. 16-8.5-101 through 16-8.5-123 and
enumerates specific abilities the examiner must address.
`,
}

// ---------------------------------------------------------------------------
// Daubert + Frye
// ---------------------------------------------------------------------------

const DAUBERT_REFERENCE: DocumentFile = {
  filename: 'Daubert_Frye_and_Expert_Testimony.md',
  title: 'Daubert, Frye, and Expert Testimony Admissibility',
  content: `# Daubert, Frye, and Expert Testimony Admissibility

Two distinct standards govern the admissibility of expert psychological
testimony in the United States. The applicable standard depends on the
jurisdiction. Know which one governs your case before testifying.

## Frye (older standard)

**Frye v. United States, 293 F. 1013 (D.C. Cir. 1923)**

The "general acceptance" test. Expert testimony is admissible only if the
principle or method on which it is based is generally accepted in the
relevant scientific community.

**Still the standard in:** California, Illinois, Maryland, Minnesota, New
Jersey, New York, Pennsylvania, Washington, and a handful of other states.
These states have either expressly rejected Daubert or have not yet adopted
it.

## Daubert (federal standard and most states)

**Daubert v. Merrell Dow Pharmaceuticals, 509 U.S. 579 (1993)**
**General Electric Co. v. Joiner, 522 U.S. 136 (1997)**
**Kumho Tire Co. v. Carmichael, 526 U.S. 137 (1999)**

Known as the "Daubert trilogy." Replaced Frye in federal court and in the
majority of states. The trial judge acts as a "gatekeeper" and assesses both
the relevance and reliability of proposed expert testimony.

Daubert factors (non-exhaustive, not a rigid checklist):

1. Has the theory or technique been **tested**?
2. Has it been **subject to peer review and publication**?
3. What is the **known or potential error rate**?
4. Are there **standards controlling the technique's operation**?
5. Has the theory or technique gained **general acceptance** in the relevant
   scientific community?

Kumho extended Daubert to all expert testimony, including non-scientific
experience-based testimony. The same gatekeeping applies to a forensic
psychologist offering a clinical opinion as to an engineer offering a
failure analysis.

## Federal Rule of Evidence 702 (as amended)

Codifies the Daubert trilogy. A witness qualified as an expert by knowledge,
skill, experience, training, or education may testify if:

(a) the expert's scientific, technical, or other specialized knowledge will
    help the trier of fact;
(b) the testimony is based on sufficient facts or data;
(c) the testimony is the product of reliable principles and methods;
(d) the expert has reliably applied the principles and methods to the facts
    of the case.

The 2023 amendment to Rule 702 made explicit that the proponent of expert
testimony must demonstrate each of these requirements by a preponderance.

## Implications for Forensic Psychology

- **Know your methodology.** Be prepared to explain on the stand why you
  chose the tests and interview methods you used and why they are reliable.
- **Use validated instruments.** A test with published psychometric
  properties, peer-reviewed validation, and known error rates is far more
  defensible than an ad hoc interview technique.
- **Document your work.** A clear audit trail from raw data to final opinion
  is the best defense against a Daubert challenge.
- **Match the standard.** Testimony that would pass Daubert may still fail
  Frye if it lacks general acceptance. The reverse is rare but possible.
- **Stay within your discipline.** Opinions about malingering and symptom
  validity are more likely to survive gatekeeping than global opinions about
  witness credibility, which are typically excluded as invading the province
  of the jury.
`,
}

// ---------------------------------------------------------------------------
// APA Specialty Guidelines
// ---------------------------------------------------------------------------

const APA_GUIDELINES: DocumentFile = {
  filename: 'APA_Specialty_Guidelines_Forensic.md',
  title: 'APA Specialty Guidelines for Forensic Psychology, Summary',
  content: `# Specialty Guidelines for Forensic Psychology (APA, 2013)

A condensed summary of the American Psychological Association's Specialty
Guidelines for Forensic Psychology (Am Psychol 2013;68:7-19). These are
aspirational guidelines, not enforceable standards, but are frequently cited
in court and in licensing board complaints.

## 1. Responsibilities

**1.01 Integrity.** Forensic practitioners strive for accuracy, impartiality,
fairness, and independence.

**1.02 Impartiality and Fairness.** Avoid partisanship and offer testimony
that fairly represents the data. Do not act as advocates for the retaining
party.

**1.03 Avoiding Conflicts of Interest.** Decline or withdraw from cases in
which a multiple relationship or financial interest may compromise objectivity.

## 2. Competence

**2.01 Scope of Competence.** Practice within the boundaries of your
competence, based on education, training, supervised experience, and
professional experience.

**2.02 Gaining and Maintaining Competence.** Pursue ongoing education. Use
consultation and peer review for complex or unfamiliar matters.

**2.03 Representing Competencies.** Represent your competence accurately to
retaining parties, courts, and the individuals being evaluated.

## 3. Diligence

**3.01 Provision of Services.** Provide services that are prompt, thorough,
and grounded in methods appropriate to the question.

**3.02 Responsiveness.** Communicate promptly with retaining parties, opposing
counsel, and the court as circumstances require.

## 4. Relationships

**4.01 Responsibilities to Retaining Parties.** Understand and clarify your
role at the outset. Clarify whether you are a consultant, a testifying expert,
or a court-appointed neutral.

**4.02 Multiple Relationships.** Avoid multiple relationships that could
impair objectivity. Do not provide therapy and forensic evaluation to the
same person.

**4.03 Provision of Emergency Mental Health Services.** If a forensic
examinee presents an emergency, provide minimum necessary intervention and
make referrals.

## 5. Fees

**5.01 Determining Fees.** Set fees in advance, in writing, and based on
services rendered rather than contingent on outcome.

**5.02 Fee Arrangements.** Contingency fees for forensic work are
impermissible. Retainers are acceptable.

## 6. Informed Consent, Notification, and Assent

**6.01 Informed Consent.** Obtain informed consent when the individual has
the legal capacity to provide it and the retaining party authorizes it.

**6.02 Notification of Non-Confidentiality.** When informed consent is not
required (e.g., court-ordered evaluations), notify the examinee of the
purpose of the evaluation, the limits of confidentiality, and the intended
recipients of the report.

**6.03 Communication with Third Parties.** Understand what information will
be disclosed to whom and communicate this to the examinee.

## 7. Conflicts in Practice

**7.01 Conflicts with Legal Authority.** When legal requirements conflict
with ethical principles, attempt to resolve the conflict in a way consistent
with the Ethics Code.

## 8. Privacy, Confidentiality, and Privilege

**8.01 Release of Information.** Respect applicable privilege. Do not release
information without appropriate authorization or legal compulsion.

**8.02 Access to Information.** Retain records consistent with professional
standards and legal requirements.

## 9. Methods and Procedures

**9.01 Use of Appropriate Methods.** Select methods that are reliable, valid,
and relevant to the psycho-legal questions.

**9.02 Use of Multiple Sources of Information.** Whenever feasible, use
multiple methods and sources. Do not rely on a single method for a
consequential opinion.

**9.03 Opinions Regarding Persons Not Examined.** Avoid offering opinions
about the psychological characteristics of individuals you have not personally
examined, except in circumstances where such opinions are explicitly offered
as hypothetical.

## 10. Assessment

**10.01 Focus on Legally Relevant Factors.** Scope assessments to the
psycho-legal question. Avoid gratuitous characterizations.

**10.02 Selection and Use of Assessment Procedures.** Use instruments that
are appropriate to the examinee and the psycho-legal question, and that have
adequate psychometric properties for forensic use.

**10.03 Appreciation of Individual Differences.** Consider cultural,
linguistic, developmental, and contextual factors in assessment and
interpretation.

## 11. Professional and Other Public Communications

**11.01 Accuracy, Fairness, and Avoidance of Deception.** Communicate opinions
accurately and avoid misleading statements or inferences.

**11.02 Differentiating Observations, Inferences, and Conclusions.** Distinguish
clearly between what was observed, what was inferred, and what was concluded.

**11.03 Disclosing Sources of Information and Bases of Opinions.** Identify
the sources and methods on which opinions rest. Disclose limitations.

**11.04 Comprehensive and Accurate Presentation of Opinions in Reports and
Testimony.** Present all reasonable bases for opinions and address data that
does not support the conclusions.

## Using This Document

Treat these guidelines as a minimum standard of practice. When in doubt
about a case, consult a peer with forensic experience, document the
consultation, and proceed conservatively.
`,
}

// ---------------------------------------------------------------------------
// HIPAA Forensic Notes
// ---------------------------------------------------------------------------

const HIPAA_FORENSIC: DocumentFile = {
  filename: 'HIPAA_Minimum_Necessary_Forensic_Context.md',
  title: 'HIPAA Minimum Necessary Standard in Forensic Contexts',
  content: `# HIPAA Minimum Necessary Standard in Forensic Contexts

Forensic psychology practice sits at a difficult intersection of HIPAA
privacy rules and the duty to produce a full report to the court. This
document outlines the practical compliance approach used at this practice.

## The Minimum Necessary Rule

45 CFR 164.502(b) requires covered entities to make reasonable efforts to
limit the use, disclosure, and request of protected health information (PHI)
to the minimum necessary to accomplish the intended purpose.

In a clinical context this typically means sharing only the PHI relevant to
the specific treatment or payment purpose. In a forensic context the
"intended purpose" is defined by the court order, the retention agreement,
or the referral question.

## Releases and Authorizations

**Court-ordered evaluations.** A court order that specifically names the
examinee and the scope of the evaluation satisfies the HIPAA disclosure
requirement. 45 CFR 164.512(e) allows disclosure in response to an order
of a court or administrative tribunal without separate authorization.

**Attorney-retained evaluations.** When retained by defense counsel for a
criminal case or by either side in a civil case, obtain a written HIPAA
authorization from the examinee (or their guardian) before requesting
records from third parties. The authorization should specify the records
sought, the providers, the purpose, and an expiration date.

**Requests from opposing counsel.** Do not release records to opposing
counsel without either (a) a signed authorization from the examinee, (b) a
subpoena accompanied by satisfactory assurance under 45 CFR 164.512(e)(1)(ii),
or (c) a court order.

## What Goes in the Report

Reports produced for the court are not protected by HIPAA in the usual
sense because the court is the intended recipient. However, the minimum
necessary principle still applies to the *content*. Include only PHI that
bears on the psycho-legal question. Historical details unrelated to the
referral question should be summarized at a high level or omitted.

Example: a CST evaluation should note relevant psychiatric history but
should not include the examinee's childhood medical history unless it
bears on the competency question. A custody evaluation should note mental
health information relevant to parenting capacity but should not include a
parent's history of an unrelated sexually transmitted infection from
twenty years ago.

## Psychotherapy Notes

Psychotherapy notes held by any psychotherapist are subject to a higher
standard of protection under 45 CFR 164.508(a)(2). A separate authorization
is required, and a court order for medical records does not typically
cover psychotherapy notes. Request these only when specifically required
and with a separate authorization or court order explicitly addressing
them.

## The Psygil Local-First Architecture

This application keeps all patient data encrypted on the local machine.
PHI never leaves the application unless the clinician explicitly exports
a report or copies text to the clipboard. When the application communicates
with the Claude API for draft generation, all PHI is replaced with
single-use opaque tokens (UNIDs) before transmission; the tokens are
rehydrated locally after the response is received, and the mapping is
destroyed at the end of each operation.

This architecture is designed to keep the practice compliant with HIPAA
Safe Harbor under 45 CFR 164.514(b). However, the clinician remains the
covered entity and is ultimately responsible for compliance. Review any
third-party integration (cloud storage, practice management software,
billing services) separately with compliance counsel before enabling it.

## Business Associate Agreements

If you use any cloud service that stores PHI on your behalf (e.g., Google
Workspace, Microsoft 365, Dropbox Business), you must have a signed Business
Associate Agreement (BAA) with that vendor before storing any patient data
in their service. A BAA is not required for Psygil itself because the
application runs entirely on your local machine and does not receive,
create, maintain, or transmit PHI on your behalf.

## Record Retention

Consult your state licensing board and your malpractice carrier for the
applicable retention period. Many states require retention of forensic
records for at least the longer of (a) seven years after the date of
service, or (b) until any minor examinee reaches the age of majority plus
the statute of limitations. Colorado requires at least seven years.

## Incident Response

If you suspect a breach of PHI (stolen laptop, unauthorized access,
accidental disclosure), follow these steps:

1. Contain the breach if possible
2. Document what happened, when, and what data was involved
3. Assess the risk of compromise per 45 CFR 164.402
4. Notify affected individuals within 60 days if the breach meets the
   definition under the Breach Notification Rule
5. Notify HHS via the breach portal if the breach involves fewer than
   500 individuals (annually) or immediately if 500 or more
6. Consult with privacy counsel before making notifications

Do not wait until a breach to develop your incident response plan. Write
it down and review it annually.
`,
}

// ---------------------------------------------------------------------------
// Tarasoff
// ---------------------------------------------------------------------------

const TARASOFF_REFERENCE: DocumentFile = {
  filename: 'Tarasoff_Duty_to_Warn_and_Protect.md',
  title: 'Tarasoff: Duty to Warn and Protect',
  content: `# Tarasoff Duty to Warn and Protect

A brief reference for the clinician's obligation when a patient or examinee
communicates a credible threat against an identifiable third party.

## Origin

**Tarasoff v. Regents of the University of California, 17 Cal. 3d 425 (1976)**

Established that a psychotherapist has a duty to exercise reasonable care to
protect a foreseeable victim of their patient. The case involved a university
counselor who was told by a patient of an intent to kill a named individual
(Tatiana Tarasoff) and did not warn her. She was killed.

The California Supreme Court held: "When a therapist determines, or pursuant
to the standards of his profession should determine, that his patient
presents a serious danger of violence to another, he incurs an obligation to
use reasonable care to protect the intended victim against such danger."

## Scope of the Duty

The Tarasoff duty has been adopted in some form by most states, either by
statute or by case law. The scope varies:

- Some states require a clear identified or identifiable victim
- Some states require an imminent threat
- Some states permit but do not require warning
- A few states (including Texas and Virginia) have rejected the Tarasoff
  duty in favor of confidentiality

**Always verify the law in your jurisdiction at the start of any forensic
or clinical engagement.**

## Discharging the Duty

Courts have recognized several ways to discharge the duty:

1. Warn the intended victim directly
2. Warn someone likely to notify the victim (a close family member)
3. Notify law enforcement
4. Take steps to have the patient involuntarily hospitalized if they meet
   civil commitment criteria
5. Any combination of the above appropriate to the circumstances

The standard is reasonable care, not a guarantee of protection.

## Forensic Context

Forensic evaluations present unique Tarasoff questions. The examinee is
typically not your patient; no therapeutic relationship exists. Nevertheless,
most jurisdictions extend some duty to warn or protect to forensic examiners
who learn of a credible threat during an evaluation.

Practical guidance:
- Disclose the limits of confidentiality at the outset, including that
  threats against identifiable persons may be reported
- Document any threats with the specific language used, the date, and the
  context
- Consult immediately with your professional liability carrier and
  forensic peer before taking action on an ambiguous threat
- Err on the side of the legal duty when in doubt

## Threat Assessment versus Risk Assessment

A Tarasoff trigger is distinct from a general violence risk assessment.
Tarasoff concerns a specific communicated threat against an identified
person. A risk assessment is a structured appraisal of the likelihood of
future violence based on static and dynamic factors. A clinician may have
Tarasoff duties even in the absence of a formal risk assessment, and may
conduct a risk assessment without ever triggering Tarasoff.

## What Not to Do

- Do not conceal a credible threat in the name of confidentiality
- Do not act alone on a complex threat; consult immediately
- Do not warn a third party unless necessary to discharge the duty
- Do not include speculative threats in routine reports without careful
  consideration of the consequences
- Do not assume that informed consent to the forensic evaluation alone is
  sufficient to waive all confidentiality
`,
}

export const DOCUMENT_FILES: readonly DocumentFile[] = [
  DSM5TR_REFERENCE,
  DUSKY_REFERENCE,
  DAUBERT_REFERENCE,
  APA_GUIDELINES,
  HIPAA_FORENSIC,
  TARASOFF_REFERENCE,
] as const
