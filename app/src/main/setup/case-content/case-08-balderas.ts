// =============================================================================
// Case 8: Balderas, Rogelio, Malingering Assessment, DIAGNOSTICS stage
// Workers comp TBI claim with suspected symptom exaggeration
// =============================================================================

import type { CaseRecord } from './shared'
import { SYNTHETIC_BANNER, clinicianSignature } from './shared'

const CASE_NUMBER = '2026-0476'
const EXAMINEE = 'Balderas, Rogelio T.'
const DOB = '1994-12-03'

const REFERRAL = `${SYNTHETIC_BANNER}

OMBLER, KINGSLEY & TRAWICK
Defense Counsel for Republic Industrial Insurance
2222 S. Havana Street, Aurora, CO 80014

February 10, 2026

Jordan Whitfield, Psy.D., ABPP
Pike Forensics

Re: Rogelio T. Balderas v. Weld Ag Services, Inc. and Republic Industrial Insurance
WC Claim No.: WC-2025-CO-48821

Dr. Whitfield,

Our firm represents Republic Industrial Insurance in the above workers compensation claim. Mr. Balderas alleges a traumatic brain injury sustained on June 14, 2025 when a pallet fell from a warehouse shelf and, in his account, struck him on the head. He has been off work since the claim date and is receiving temporary total disability benefits.

Several features of this claim have raised questions:
1. The initial incident report documented a minor impact with no loss of consciousness and no bleeding.
2. Two days later Mr. Balderas presented to an ED with reports of confusion, headache, and memory loss.
3. Two independent medical examinations in late 2025 produced inconsistent neuropsychological findings and the examiners disagreed on the presence of genuine cognitive impairment.
4. Surveillance obtained by the carrier in December 2025 shows Mr. Balderas engaged in activities inconsistent with the functional limitations he reports in treatment sessions.

We are retaining you to conduct a symptom validity assessment focused on whether Mr. Balderas's presentation is consistent with a genuine neurocognitive disorder or better explained by symptom exaggeration or malingering, within the Slick et al. (1999) Malingered Neurocognitive Dysfunction framework.

Enclosed: incident report, ED record, two prior IMEs, surveillance report summary.

Lachlan Ombler, Esq.
`

const PRIOR_IMES = `${SYNTHETIC_BANNER}

PRIOR INDEPENDENT MEDICAL EXAMINATION SUMMARIES (DEFENSE-PROVIDED)

IME #1 (August 12, 2025)
Examiner: Thanos Makridakis, Psy.D.
Findings: Impressions included "moderate post-concussive cognitive impairment" based primarily on subjective complaints and self-reported functional decline. No symptom validity testing was conducted.

IME #2 (November 3, 2025)
Examiner: Cordelia Van Buskirk, Ph.D.
Findings: Administered a limited neuropsychological battery (WAIS-IV selected subtests, WMS-IV selected subtests, Trail Making A and B). Reported scores 2 to 3 standard deviations below the mean on multiple measures. Administered the TOMM but reported only "completed" without providing the trial scores. Concluded "severe cognitive impairment consistent with moderate TBI."

OBSERVATION (Pike Forensics review of prior IMEs)

Neither prior examiner conducted a comprehensive symptom validity assessment per current standards of practice. The absence of TOMM trial scores in IME #2 is a significant gap. The severity of reported cognitive impairment in IME #2 is inconsistent with the mechanism of injury documented in the incident report.

Jordan Whitfield, Psy.D., ABPP
`

const TOMM_RESULTS = `${SYNTHETIC_BANNER}

PIKE FORENSICS
TOMM Administration Results

Examinee: ${EXAMINEE}
Date: February 24, 2026
Examiner: Jordan Whitfield, Psy.D., ABPP

ADMINISTRATION

Standard TOMM administration. Instructions delivered slowly in English with visual examples. Mr. Balderas confirmed understanding before each trial began.

RESULTS

Trial 1: 28 / 50
Trial 2: 22 / 50
Retention Trial: 19 / 50

INTERPRETATION

All three trial scores are substantially BELOW the Tombaugh (1996) cutoff of 45. Trial 2 score of 22 is below chance-level performance on a 50-item forced-choice recognition task. Below-chance performance is statistically unlikely (p<.001) without deliberate effort to perform poorly. The Retention trial further below Trial 2 is also inconsistent with genuine memory impairment, which should remain stable between Trial 2 and Retention.

This TOMM result alone is strongly suggestive of non-credible performance on memory testing. Per Slick et al. (1999) criteria, below-chance performance on a forced-choice measure meets the definitive criterion for Malingered Neurocognitive Dysfunction, Sufficient Evidence level, in the presence of external incentive.

Jordan Whitfield, Psy.D., ABPP
`

const MMPI3_MFAST = `${SYNTHETIC_BANNER}

PIKE FORENSICS
MMPI-3 and M-FAST Results Summary

Examinee: ${EXAMINEE}
Dates: February 25, 2026 (MMPI-3), February 26, 2026 (M-FAST)
Examiner: Jordan Whitfield, Psy.D., ABPP

MMPI-3 VALIDITY SCALES

CNS:    4      (within limits)
VRIN-r: T=58   (within limits)
TRIN-r: T=55   (within limits)
F-r:    T=118  (MARKED ELEVATION - considering overreporting)
Fp-r:   T=112  (MARKED ELEVATION - strong indicator of overreporting)
Fs:     T=98   (significant elevation - overreporting of somatic symptoms)
FBS-r:  T=94   (significant elevation - noncredible symptom reporting)
RBS:    T=105  (MARKED ELEVATION - overreporting of cognitive symptoms)
L-r:    T=42
K-r:    T=38

INTERPRETATION OF MMPI-3 VALIDITY

The Fp-r elevation of T=112 is a strong single indicator of over-reporting. The RBS elevation of T=105 specifically suggests overreporting of cognitive symptoms. The combined elevation of Fp-r, F-r, Fs, FBS-r, and RBS is a textbook pattern for non-credible responding in the context of potential secondary gain. Substantive scales cannot be meaningfully interpreted in the presence of these validity elevations.

M-FAST RESULTS

Total score: 12
Reference cutoff for possible feigning: 6
Reference cutoff for probable feigning: 9

Scale elevations:
  Reported vs. Observed:          Elevated
  Extreme Symptomatology:         Elevated
  Rare Combinations:              Elevated
  Unusual Hallucinations:         Not elevated
  Unusual Symptom Course:         Elevated
  Negative Image:                 Elevated
  Suggestibility:                 Elevated

INTERPRETATION

M-FAST total of 12 is well above the probable feigning cutoff of 9. Multiple scale elevations. The pattern is characteristic of deliberate symptom exaggeration or feigning.

COMBINED SYMPTOM VALIDITY FINDINGS

Across three independent symptom validity measures (TOMM, MMPI-3 validity scales, M-FAST), Mr. Balderas's presentation is consistent with deliberate exaggeration. This pattern, combined with documented external incentive (pending workers compensation claim), the discrepancy between reported symptoms and documented mechanism of injury, and the surveillance evidence of inconsistent functional limitations, meets Slick et al. (1999) criteria for Definite Malingered Neurocognitive Dysfunction.

Jordan Whitfield, Psy.D., ABPP
`

const PRELIM_FORMULATION = `${SYNTHETIC_BANNER}

PIKE FORENSICS
Preliminary Formulation (PENDING FINAL REPORT)

Case: ${EXAMINEE}
Case Number: ${CASE_NUMBER}
Date: February 28, 2026

SLICK ET AL. (1999) CRITERIA REVIEW

Criterion A. Presence of substantial external incentive: MET (active workers compensation claim, temporary total disability benefits).

Criterion B. Evidence from neuropsychological testing.
  B1. Performance below chance on forced-choice measure: MET (TOMM Trial 2 = 22/50, below-chance at p<.001)
  B2. Discrepancy between test data and known patterns of brain function: MET (reported cognitive profile inconsistent with documented mechanism of injury)
  B3. Discrepancy between test data and observed behavior: MET (surveillance evidence of preserved function)

Criterion C. Evidence from self-report.
  C1. Self-reported history that is discrepant with documented history: MET
  C2. Self-reported symptoms that are discrepant with known patterns: MET
  C3. Self-reported symptoms that are discrepant with behavioral observations: MET
  C4. Evidence of exaggerated or fabricated psychological dysfunction on well-validated validity scales: MET (MMPI-3 Fp-r T=112, M-FAST total=12)

Criterion D. Behaviors meeting necessary criteria from B or C are not fully accounted for by psychiatric, neurological, or developmental factors.

DIAGNOSTIC IMPRESSION (PRELIMINARY)

The Slick et al. (1999) MND framework supports a conclusion of DEFINITE Malingered Neurocognitive Dysfunction. Under DSM-5-TR this is coded as V65.2 / Z76.5 Malingering.

A genuine underlying mild neurocognitive condition related to the June 2025 incident cannot be definitively ruled out without further investigation, but if present it is being substantially exaggerated.

REMAINING WORK BEFORE FINAL REPORT

1. Review of the December 2025 surveillance footage (not yet provided by defense counsel)
2. Second interview session to document specific symptom claims and cross-check against surveillance findings
3. Brief additional clinical interview regarding mental health and substance use history independent of the claim

This is a diagnostics-stage formulation. The final written report will await the surveillance review and second interview, projected for late March.
${clinicianSignature()}`

export const CASE_08_BALDERAS: CaseRecord = {
  caseNumber: CASE_NUMBER,
  createdAt: '2026-02-10',
  lastModified: '2026-02-28',
  firstName: 'Rogelio',
  lastName: 'Balderas',
  dob: DOB,
  gender: 'M',
  evaluationType: 'Malingering',
  referralSource: 'Ombler, Kingsley & Trawick (Defense)',
  evaluationQuestions:
    'Symptom validity assessment under Slick et al. (1999) MND framework. Genuine vs. feigned cognitive impairment following workplace incident.',
  stage: 'diagnostics',
  caseStatus: 'in_progress',
  notes:
    'Three symptom validity measures converge on non-credible performance. Surveillance review and second interview pending.',
  complexity: 'complex',
  summary:
    '31yo man, workers comp TBI claim, below-chance TOMM, MMPI-3 overreporting, M-FAST 12. Definite MND pending final review.',
  diagnoses: ['Z76.5 Malingering (preliminary, pending surveillance review)'],
  intake: {
    referral_type: 'attorney',
    referral_source: 'Lachlan Ombler, Esq. (defense for insurance carrier)',
    eval_type: 'Malingering',
    presenting_complaint: 'Claimed post-TBI cognitive impairment; discrepancies flagged by carrier.',
    jurisdiction: 'Weld County Workers Compensation',
    charges: null,
    attorney_name: 'Lachlan Ombler, Esq. (defense)',
    report_deadline: '2026-04-01',
    status: 'complete',
  },
  onboarding: [
    {
      section: 'contact',
      content:
        'Resides in Greeley. Represented by his own claimant attorney (Mirabel Vercingetorix). Pike Forensics retained by defense counsel.',
      status: 'complete',
    },
    {
      section: 'complaints',
      content:
        'Claims severe memory loss, cognitive fog, inability to work, inability to drive. Claims have escalated over course of workers comp claim.',
      status: 'complete',
    },
    {
      section: 'legal',
      content:
        'Active WC claim (WC-2025-CO-48821). Receiving temporary total disability benefits. No criminal history.',
      status: 'complete',
    },
  ],
  documents: [
    {
      subfolder: '_Inbox',
      filename: 'Defense_Counsel_Referral.txt',
      documentType: 'other',
      content: REFERRAL,
      description: 'Defense counsel referral with background',
    },
    {
      subfolder: 'Collateral',
      filename: 'Prior_IME_Summaries.txt',
      documentType: 'other',
      content: PRIOR_IMES,
      description: 'Prior IME summaries with methodological concerns',
    },
    {
      subfolder: 'Testing',
      filename: 'TOMM_Below_Chance_Results.txt',
      documentType: 'other',
      content: TOMM_RESULTS,
      description: 'TOMM results, below-chance on Trial 2',
    },
    {
      subfolder: 'Testing',
      filename: 'MMPI-3_M-FAST_Results.txt',
      documentType: 'other',
      content: MMPI3_MFAST,
      description: 'MMPI-3 and M-FAST results, convergent overreporting',
    },
    {
      subfolder: 'Diagnostics',
      filename: 'Preliminary_Malingering_Formulation.txt',
      documentType: 'other',
      content: PRELIM_FORMULATION,
      description: 'Slick et al. (1999) MND framework review',
    },
  ],
}
