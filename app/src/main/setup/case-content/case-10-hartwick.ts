// =============================================================================
// Case 10: Hartwick-Paradeza, Lenora, Custody Relocation, REVIEW stage
// Mother wants to relocate from Denver to Flagstaff; father opposes
// =============================================================================

import type { CaseRecord } from './shared'
import { SYNTHETIC_BANNER, clinicianSignature, reportHeader } from './shared'

const CASE_NUMBER = '2026-0502'
const EXAMINEE = 'Hartwick-Paradeza, Lenora J.'
const DOB = '2018-08-12'
const COURT = 'Larimer County District Court (Family)'

const ORDER = `${SYNTHETIC_BANNER}

LARIMER COUNTY DISTRICT COURT
Case Number: ${CASE_NUMBER}-DR
Division: Family Court
Judge: Hon. Imelda Arlequín-Briggs

IN RE THE MARRIAGE OF:
Adeline Voss Hartwick (Petitioner/Relocating Parent)
and
Beckett L. Paradeza (Respondent/Non-Relocating Parent)
Minor child: Lenora J. Hartwick-Paradeza (age 7, DOB 08/12/2018)

ORDER FOR RELOCATION EVALUATION

The Petitioner has filed a Motion to Relocate seeking to move with the minor child from Fort Collins, Colorado to Flagstaff, Arizona. The Respondent opposes the motion. Under C.R.S. 14-10-129, the Court must consider the Spahmer v. Gullette factors and the best interests of the child.

IT IS HEREBY ORDERED that a relocation-focused parenting evaluation shall be conducted by Jordan Whitfield, Psy.D., ABPP of Pike Forensics. The evaluation shall address all statutory factors including:
1. Reasons for the proposed relocation
2. Reasons for the non-relocating parent's opposition
3. Quality of the child's relationship with each parent
4. Educational opportunities in both locations
5. Presence of extended family in both locations
6. Advantages and disadvantages of relocation to the child
7. Any other relevant factors

Written report to be filed no later than April 15, 2026.

BY THE COURT:
Imelda Arlequín-Briggs
District Court Judge
Dated: February 10, 2026
`

const MOTHER_INTERVIEW = `${SYNTHETIC_BANNER}

PARENTING EVALUATION INTERVIEW NOTES
Parent: Adeline Voss Hartwick (mother, relocating)
Date: March 3, 2026
Duration: 110 minutes
Examiner: Jordan Whitfield, Psy.D., ABPP

Ms. Voss Hartwick is a 36-year-old woman who has lived in Colorado since 2011. She works as a curriculum designer for an educational technology company. Her employer has offered her a promotion to Senior Curriculum Director, a position that requires relocation to the company's operations hub in Flagstaff, Arizona. The promotion represents a 38% salary increase and a significant career advancement. She has accepted the offer contingent on court approval of the relocation.

Her proposed plan: relocate with Lenora to Flagstaff in June 2026. She proposes that Mr. Paradeza continue to have substantial parenting time through video calls three times per week, an extended summer visit (6 weeks), all of winter break, and spring break in alternating years. She has offered to split travel costs 50/50.

Supporting factors: her sister and mother live in Sedona, Arizona (45 minutes from Flagstaff). Lenora has visited twice and has a close relationship with her maternal grandmother. Flagstaff has strong public schools and Ms. Voss Hartwick has already identified an elementary school with a well-regarded gifted program.

Concerns: Ms. Voss Hartwick acknowledges that relocation will reduce face-to-face time with Mr. Paradeza and that this is a real loss for Lenora. She emphasizes she is not seeking to limit his involvement and has proposed generous parenting time.

She denied any motivation to limit the father's contact. She described Mr. Paradeza as a loving and involved father. She is not in a new romantic relationship. She described the decision as "career opportunity that is genuinely rare."
`

const FATHER_INTERVIEW = `${SYNTHETIC_BANNER}

PARENTING EVALUATION INTERVIEW NOTES
Parent: Beckett L. Paradeza (father, non-relocating)
Date: March 6, 2026
Duration: 110 minutes
Examiner: Jordan Whitfield, Psy.D., ABPP

Mr. Paradeza is a 39-year-old man who owns a small landscape architecture firm in Fort Collins. He has lived in Colorado his entire life. His firm has 6 employees and is rooted in the Northern Colorado region. He cannot practically relocate his business.

He opposes the relocation. His reasons: Lenora has lived in Fort Collins her entire life, attends Traut Core Knowledge School where she has strong friendships and is doing well academically, participates in a local children's theater program she loves, and has a close relationship with both her father's parents who live in Loveland.

He acknowledges the career significance for Ms. Voss Hartwick and says he "would not stand in her way if it were only about her." His concern is the impact on his daughter. He proposes that Ms. Voss Hartwick could consider remote work arrangements, which he has asked her to pursue. Ms. Voss Hartwick has told him that the Senior Curriculum Director role specifically requires in-person leadership.

Mr. Paradeza expressed openness to relocating to Arizona himself if it would keep the family close, but acknowledged this is not practical for his business.

He described Ms. Voss Hartwick as a good mother and did not make disparaging comments about her. He expressed frustration with the situation but not with her specifically.
`

const CHILD_INTERVIEW = `${SYNTHETIC_BANNER}

CHILD INTERVIEW AND OBSERVATION NOTES
Child: Lenora Hartwick-Paradeza (age 7)
Date: March 13, 2026
Duration: 50 minutes
Examiner: Jordan Whitfield, Psy.D., ABPP

Lenora was brought by both parents, who remained in the waiting room. She was initially shy but warmed quickly. She is a verbal, articulate, typically-developing child with age-appropriate social reciprocity and a bright affect.

School: "I like my school. My teacher is Ms. Pemberton. My best friend is Zoe and my other best friend is Aisling." She described the theater program with animation ("I was a sunflower in the spring show!").

Family: "My mommy is going to get a new job and she wants us to move to Arizona where my grandma and my aunt live. I don't know if I want to yet." When asked what she would miss most, she named Zoe, her theater program, and her father. When asked what she was excited about, she named her grandmother and the pool at her grandmother's house.

When asked directly how she felt about the move: "A little scared. Mommy says we can still see Daddy a lot. Daddy says it's far and I'll be sad." She did not express distress, did not disparage either parent, and did not show evidence of coaching.

She asked several times during the conversation whether her father would be "mad at her" for talking to me. I reassured her that her father had specifically asked her to come and talk with me. She relaxed visibly.

Clinical impression: Lenora is an attached, well-adjusted child with a strong relationship with both parents. She shows age-appropriate ambivalence about the proposed relocation. She is not demonstrating distress that exceeds the developmental norm for a 7-year-old facing a major life change.
`

const FINAL_REPORT = `${reportHeader(
  CASE_NUMBER,
  EXAMINEE,
  DOB,
  'Relocation Parenting Evaluation',
  COURT,
)}REFERRAL QUESTION

The Court requested a relocation-focused parenting evaluation addressing the statutory factors in C.R.S. 14-10-129 and the best interests of Lenora Hartwick-Paradeza (age 7) in the context of her mother's proposed relocation from Fort Collins, Colorado to Flagstaff, Arizona.

PROCEDURES

I reviewed the pleadings, the parents' proposed parenting plans, school records from Traut Core Knowledge School, and correspondence between counsel. I interviewed Ms. Voss Hartwick (110 minutes, March 3, 2026) and Mr. Paradeza (110 minutes, March 6, 2026) separately. I conducted a 50-minute interview and observation of Lenora at my office (March 13, 2026). I completed collateral telephone interviews with Lenora's teacher Idalia Pemberton, her pediatrician Vasanti Tiruvallur, MD, her theater instructor Mercy Dagbovie-Kamara, and her maternal grandmother Eleonore Voss. I conducted a home visit at Ms. Voss Hartwick's home on March 20, 2026 and at Mr. Paradeza's home on March 22, 2026.

BACKGROUND

Ms. Voss Hartwick and Mr. Paradeza were married in 2016 and separated in 2023. They share joint legal custody with a 60/40 parenting time split favoring Ms. Voss Hartwick. The current arrangement has worked well since the divorce in 2024.

In January 2026 Ms. Voss Hartwick's employer offered her a promotion to Senior Curriculum Director that requires relocation to Flagstaff, Arizona. The promotion represents a significant career advancement and a 38% salary increase. She accepted contingent on court approval.

Mr. Paradeza opposes the relocation on the grounds that it would reduce his parenting time and remove Lenora from her school, friends, theater program, and paternal grandparents.

STATUTORY FACTORS (C.R.S. 14-10-129)

1. Reasons for the proposed relocation: Genuine and legitimate career opportunity. Not motivated by a desire to frustrate the father's parenting time.

2. Reasons for opposition: Genuine concern for the child's attachments, stability, and relationship with her father. Not motivated by ill will toward the mother.

3. Quality of the child's relationship with each parent: Lenora has strong, close relationships with both parents. There is no evidence of attachment disruption with either parent.

4. Educational opportunities: Lenora's current school (Traut Core Knowledge) is high-performing. The proposed Flagstaff school (Sechrist Elementary) has a strong gifted program and is comparable in quality.

5. Extended family: Paternal grandparents in Loveland (active weekly contact). Maternal grandmother and maternal aunt in Sedona, Arizona (45 minutes from Flagstaff). Both sets of extended family are meaningful presences.

6. Advantages and disadvantages to the child: Advantages include proximity to maternal extended family, enhanced financial stability through the mother's career advancement, and a strong school option. Disadvantages include loss of daily relationship with father, loss of current school community, loss of the theater program Lenora loves, and reduced contact with paternal grandparents.

7. Other factors: Lenora expressed age-appropriate ambivalence. She is a resilient, well-adjusted child who will likely adapt to either outcome but will experience real loss regardless of the decision.

SUMMARY FORMULATION

Both parents are loving, capable, and committed. The mother's career opportunity is real and significant. The father's concerns are legitimate. Lenora will experience loss under either outcome. She is a resilient child with secure attachments who is more likely to adapt well than poorly to a thoughtful transition.

RECOMMENDATIONS

Rather than a single recommendation for or against relocation, I am offering the Court my analysis of what would best serve Lenora under each potential outcome:

IF RELOCATION IS GRANTED:
1. The proposed parenting time plan (video three times weekly, 6-week summer, all winter break, spring break alternating) should be the minimum baseline, with the Court encouraging the parties to add a long weekend visit once per quarter.
2. The mother should commit to facilitating the video contact proactively rather than relying on Lenora to initiate.
3. A specific plan for maintaining Lenora's relationship with her paternal grandparents should be agreed upon before the move.
4. Co-parenting counseling for at least six months during the transition.

IF RELOCATION IS DENIED:
1. The current 60/40 schedule should continue.
2. The parents should explore with Ms. Voss Hartwick's employer whether any flexibility exists for remote work arrangements that could support the career advancement without relocation.
3. The Court may wish to revisit the issue if circumstances change.

The Court is in a better position than I am to weigh the statutory factors and make the ultimate decision.

DRAFT STATUS

This report is in REVIEW stage. Attestation and signature pending a final co-parent review call scheduled for April 10, 2026.
${clinicianSignature()}`

export const CASE_10_HARTWICK: CaseRecord = {
  caseNumber: CASE_NUMBER,
  createdAt: '2026-02-10',
  lastModified: '2026-04-08',
  firstName: 'Lenora',
  lastName: 'Hartwick-Paradeza',
  dob: DOB,
  gender: 'F',
  evaluationType: 'Custody',
  referralSource: 'Larimer County District Court (Family)',
  evaluationQuestions:
    'C.R.S. 14-10-129 relocation factors; best interests of 7yo in proposed move from Fort Collins to Flagstaff.',
  stage: 'review',
  caseStatus: 'in_progress',
  notes: 'Report in review. Final co-parent review call April 10, 2026. Attestation pending.',
  complexity: 'moderate',
  summary:
    '7yo child, mother proposing relocation to AZ for career, father opposes. Both parents capable; scenario-dependent recommendations.',
  diagnoses: [],
  intake: {
    referral_type: 'court',
    referral_source: 'Hon. Imelda Arlequín-Briggs, Larimer County District Court',
    eval_type: 'Custody',
    presenting_complaint: 'Relocation evaluation per C.R.S. 14-10-129 for a 7yo child.',
    jurisdiction: 'Larimer County',
    charges: null,
    attorney_name:
      'Isidore Kvartsynenko (for mother), Tabitha Oluwatoyin (for father)',
    report_deadline: '2026-04-15',
    status: 'complete',
  },
  onboarding: [
    {
      section: 'contact',
      content:
        'Petitioner Adeline Voss Hartwick (Fort Collins). Respondent Beckett Paradeza (Fort Collins). Minor child Lenora, 7.',
      status: 'complete',
    },
    {
      section: 'family',
      content:
        'Parents married 2016, separated 2023, divorced 2024. Current schedule 60/40 favoring mother. Maternal grandmother and aunt in Sedona, AZ. Paternal grandparents in Loveland, CO.',
      status: 'complete',
    },
    {
      section: 'education',
      content:
        'Lenora attends Traut Core Knowledge School, performing well. Active in children\'s theater program.',
      status: 'complete',
    },
    {
      section: 'recent',
      content:
        'Mother received promotion offer January 2026 requiring relocation to Flagstaff. Filed Motion to Relocate February 2026.',
      status: 'complete',
    },
  ],
  documents: [
    {
      subfolder: 'Collateral',
      filename: 'Court_Order_Relocation_Eval.txt',
      documentType: 'other',
      content: ORDER,
      description: 'Court order for relocation evaluation',
    },
    {
      subfolder: 'Interviews',
      filename: 'Mother_Interview_VossHartwick.txt',
      documentType: 'other',
      content: MOTHER_INTERVIEW,
      description: 'Mother (relocating parent) interview notes',
    },
    {
      subfolder: 'Interviews',
      filename: 'Father_Interview_Paradeza.txt',
      documentType: 'other',
      content: FATHER_INTERVIEW,
      description: 'Father (non-relocating parent) interview notes',
    },
    {
      subfolder: 'Interviews',
      filename: 'Child_Interview_Lenora.txt',
      documentType: 'other',
      content: CHILD_INTERVIEW,
      description: 'Child interview and observation notes',
    },
    {
      subfolder: 'Reports',
      filename: 'DRAFT_Relocation_Evaluation_Report.txt',
      documentType: 'other',
      content: FINAL_REPORT,
      description: 'Draft relocation evaluation report, pending attestation',
    },
  ],
}
