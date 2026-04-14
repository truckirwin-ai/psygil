// =============================================================================
// Case 4: Szczerba-Ngo, Amelia, Custody Evaluation, INTERVIEW stage
// Contested custody of a 9yo with autism
// =============================================================================

import type { CaseRecord } from './shared'
import { SYNTHETIC_BANNER, clinicianSignature } from './shared'

const CASE_NUMBER = '2026-0398'
const EXAMINEE = 'Szczerba-Ngo, Amelia R.'
const DOB = '2017-02-04'

const COURT_ORDER = `${SYNTHETIC_BANNER}

DISTRICT COURT, DOUGLAS COUNTY, COLORADO
Case Number: ${CASE_NUMBER}-DR
Division: Family Court
Judge: Hon. Moira Delacroix

IN RE THE MARRIAGE OF:
Tomasz R. Szczerba, Petitioner
and
Mai T. Ngo, Respondent
Minor child: Amelia R. Szczerba-Ngo (DOB 02/04/2017)

STIPULATED ORDER FOR CHILD AND FAMILY INVESTIGATOR / PARENTING EVALUATION

The parties have stipulated to the appointment of a mental health professional to conduct a full parenting evaluation pursuant to C.R.S. 14-10-127. Jordan Whitfield, Psy.D., ABPP of Pike Forensics is appointed.

The evaluation shall address:
1. The best interests of the minor child in the context of the parties' proposed parenting plans
2. Each parent's capacity to meet Amelia's special needs as a child with Autism Spectrum Disorder (previously diagnosed at Children's Hospital Colorado, 2023)
3. The practicality and stability of each proposed parenting plan
4. Recommendations for parenting time, decision-making, and any needed therapeutic supports

Fees are to be split 50/50 between the parties with an initial retainer of $6,000 due upon acceptance. Written report to be filed no later than June 30, 2026.

BY THE COURT:
Moira Delacroix
District Court Judge
Dated: February 20, 2026
`

const FATHER_INTERVIEW = `${SYNTHETIC_BANNER}

PARENTING EVALUATION INTERVIEW NOTES
Parent interviewed: Tomasz R. Szczerba (father)
Date: March 10, 2026
Duration: 120 minutes
Location: Pike Forensics

Mr. Szczerba is a 41-year-old Polish-born man who immigrated to the United States in 2014 for graduate school. He works as a senior process engineer at a semiconductor firm in Colorado Springs. He speaks Polish and English fluently. The marriage lasted from 2015 to 2024; the parties separated in April 2024 and the divorce was final in December 2024. Amelia is the parties' only child.

Amelia's developmental history: Mr. Szczerba reports concerns began at age 2 when Amelia was not making eye contact during family meals. Both parents agreed to a developmental evaluation at Children's Hospital Colorado in 2023. Diagnoses confirmed included Autism Spectrum Disorder, Level 1 (requiring support). Amelia has received weekly speech and occupational therapy through her pediatrician's referral network since 2023 and has an IEP at Castle Rock Elementary.

Proposed parenting plan: Mr. Szczerba is seeking primary parenting time (Monday through Friday) with alternating weekends. He feels his work schedule (consistent, flexible, close to schools) and his relationship with Amelia's therapy providers support his role as primary.

Concerns about Ms. Ngo: Mr. Szczerba expresses concern that Ms. Ngo's work schedule as an ICU nurse involves rotating 12-hour shifts, which he believes is destabilizing for Amelia. He also states that Ms. Ngo does not consistently implement Amelia's sensory strategies (weighted blanket, quiet space in the evenings) and that Amelia has "meltdowns" returning from Ms. Ngo's home. He denies any concerns about Ms. Ngo's love for their daughter or her commitment.

Own acknowledged limitations: Mr. Szczerba acknowledges he can be "rigid" about routines and that he struggles to adapt when plans change. He says he is working on this in individual therapy.

Allegations or countervailing concerns: None that rise to the level of a safety concern. This is a high-conflict but not a domestic violence case.

Note: Mr. Szczerba was cooperative and articulate. He responded to all questions. He did not make disparaging comments about Ms. Ngo beyond the specific concerns noted above. He volunteered concerns about his own limitations without prompting.

Jordan Whitfield, Psy.D., ABPP
`

const MOTHER_INTERVIEW = `${SYNTHETIC_BANNER}

PARENTING EVALUATION INTERVIEW NOTES
Parent interviewed: Mai T. Ngo (mother)
Date: March 17, 2026
Duration: 120 minutes
Location: Pike Forensics

Ms. Ngo is a 38-year-old Vietnamese American woman born in San Jose. She moved to Colorado in 2012 after completing her BSN at UC Davis. She works as a pediatric ICU nurse at Children's Hospital Colorado. She is bilingual in Vietnamese and English. Her parents live in Louisville (Colorado) and are actively involved in Amelia's care.

Amelia's developmental history: Ms. Ngo's recollection tracks Mr. Szczerba's: early concerns at age 2, formal evaluation at Children's in 2023, ASD Level 1 diagnosis, ongoing OT and SLP. Ms. Ngo has attended every IEP meeting and maintains her own folder of Amelia's progress reports.

Proposed parenting plan: Ms. Ngo is proposing a 50/50 schedule with alternating weeks. She acknowledges her 12-hour shifts are a challenge and states she has arranged her schedule so that on her working days Amelia is with her maternal grandparents (who Amelia loves and who are a familiar presence).

Concerns about Mr. Szczerba: Ms. Ngo states that Mr. Szczerba's rigidity around routines sometimes means Amelia does not get the flexibility she needs for new experiences. She shared an example: Amelia was invited to a classmate's birthday party last fall and Mr. Szczerba did not take her because it "disrupted" the nap schedule. Ms. Ngo also feels Mr. Szczerba is controlling about Amelia's diet in ways that are not sensory-based.

Own acknowledged limitations: Ms. Ngo acknowledges her schedule is difficult and that she has sometimes arrived home exhausted and less patient than she wishes. She notes she has reduced her shifts to 30 hours per week since the separation.

Allegations: Ms. Ngo expressed concern that Mr. Szczerba's intense focus on routines could shade into "controlling" behavior but did not allege abuse or unsafe parenting.

Note: Ms. Ngo was cooperative, reflective, and appropriate. She acknowledged Mr. Szczerba's strengths as a father. She did not attempt to denigrate him.

Jordan Whitfield, Psy.D., ABPP
`

const CHILD_OBSERVATION = `${SYNTHETIC_BANNER}

CHILD OBSERVATION SESSION NOTES
Child: Amelia R. Szczerba-Ngo (age 9)
Date: March 24, 2026
Location: Pike Forensics child-friendly room
Duration: 45 minutes
Observer: Jordan Whitfield, Psy.D., ABPP

Amelia was brought by both parents, who remained in the waiting room. She entered quietly, made brief eye contact, and sat at the provided art table.

Amelia selected the drawing materials and began drawing a structured scene: a house with two separate rooms labeled "Mama house" and "Daddy house" in careful print. She placed a stick figure labeled "me" in between the two rooms. Her drawing was age-appropriate in technique and showed planning.

I asked open questions about her school and interests. Amelia responded in full sentences with clear articulation. She prefers to talk about things she knows well (the school hamster named Bruno, the books in her classroom library). Social reciprocity was reduced; she did not ask me questions about myself.

Family questions were answered factually and briefly. "I like my mama's house because of grandma and grandpa." "I like my daddy's house because it's quiet." When I asked if there was anything about living at either house that was hard, she said "the drives," referring to the Monday and Friday exchanges.

Amelia showed typical sensory preferences for a child with ASD Level 1: she asked that the overhead light be dimmed before drawing, she requested the weighted blanket she had brought, and she asked to skip the planned board game, preferring to continue drawing.

When told the session was ending in 5 minutes, she used the visual timer I provided and transitioned without difficulty.

Jordan Whitfield, Psy.D., ABPP
`

const SCHOOL_RECORDS = `${SYNTHETIC_BANNER}

CASTLE ROCK ELEMENTARY SCHOOL
Individualized Education Program (IEP) Progress Report Summary

Student: Amelia R. Szczerba-Ngo
Grade: 3
IEP Team Meeting Date: January 15, 2026
Case Manager: Brenna Tolliver, Special Education Teacher

ACADEMIC PERFORMANCE

Reading: Reading on grade level with strong decoding skills. Comprehension of inferential material remains below grade level and is a focus of intervention.

Math: Computation at grade level. Word problems with multi-step requirements remain challenging; visual supports help.

Writing: Written output is below grade level due to fine motor and executive function challenges. Using speech-to-text for longer assignments.

SOCIAL-EMOTIONAL

Amelia participates in a social skills group twice a week. She has made progress in initiating interactions with classmates during structured activities. Unstructured play (recess) remains difficult; she typically seeks out an adult or goes to the reading corner.

SPECIAL CONSIDERATIONS

Sensory accommodations: noise-reducing headphones available, dimmed lighting in quiet reading space, flexible seating.

Behavioral: No behavioral incidents this year. When frustrated Amelia typically withdraws rather than acts out.

Parent involvement: Both parents attend IEP meetings. Both are responsive to teacher communication. Mr. Szczerba communicates primarily through the online portal; Ms. Ngo typically attends in-person check-ins.

Brenna Tolliver, M.Ed.
Castle Rock Elementary SPED Team
`

const PLANNING_NOTE = `${SYNTHETIC_BANNER}

PIKE FORENSICS
Case Planning Note (INTERVIEW STAGE)

Case: ${EXAMINEE} (Custody Evaluation)
Case Number: ${CASE_NUMBER}
Date: March 26, 2026

PROGRESS TO DATE

1. Both parents interviewed (March 10 and March 17). Collateral records obtained from Castle Rock Elementary IEP team, Children's Hospital Colorado OT and SLP, pediatrician.
2. First child observation completed March 24. Amelia is an articulate, attached, typically-presenting child with ASD Level 1, bonded to both parents.

STILL OUTSTANDING

1. Joint home visit with Mr. Szczerba and Amelia (scheduled April 3)
2. Joint home visit with Ms. Ngo and Amelia (scheduled April 7)
3. Collateral telephone interviews with maternal grandmother Linh Ngo and Amelia's occupational therapist Rowan Khoroshev (both scheduled for week of April 8)
4. Review of Amelia's complete pediatric records (releases signed, records received April 2)
5. Structured testing: neither parent will be given formal personality testing in this case; the MMPI-3 was considered and set aside because the clinical picture does not suggest psychopathology in either parent

FORMULATION IN PROGRESS

Both parents meet minimum standards for parenting capacity. Both have genuine strengths relevant to Amelia's needs. Mr. Szczerba offers routine and technical engagement with Amelia's therapy schedule. Ms. Ngo offers family continuity and extended family support. The central question is which plan best serves Amelia's specific developmental profile and which plan is most practically sustainable.

An interim recommendation before the home visits would be premature. The case is currently on track for a final report by the June 30 deadline.

Jordan Whitfield, Psy.D., ABPP
`

export const CASE_04_SZCZERBA: CaseRecord = {
  caseNumber: CASE_NUMBER,
  createdAt: '2026-02-20',
  lastModified: '2026-03-26',
  firstName: 'Amelia',
  lastName: 'Szczerba-Ngo',
  dob: DOB,
  gender: 'F',
  evaluationType: 'Custody',
  referralSource: 'Douglas County District Court (Family)',
  evaluationQuestions:
    'Best interests of a 9yo with ASD Level 1, comparative parenting capacity, sustainable parenting plan.',
  stage: 'interview',
  caseStatus: 'in_progress',
  notes:
    'Both parent interviews complete. Joint home visits and collateral scheduled. No testing planned.',
  complexity: 'very-complex',
  summary:
    'Contested custody of 9yo with ASD Level 1. Both parents cooperative. Father wants primary, mother wants 50/50.',
  diagnoses: ['F84.0 Autism Spectrum Disorder, Level 1 (child; prior diagnosis)'],
  intake: {
    referral_type: 'court',
    referral_source: 'Hon. Moira Delacroix, Douglas County District Court',
    eval_type: 'Custody',
    presenting_complaint:
      'Parenting evaluation for contested custody of 9yo with ASD. High-conflict but no DV.',
    jurisdiction: 'Douglas County',
    charges: null,
    attorney_name:
      "Kepler Frostenson (for Petitioner father), Beatrix Ommundsen (for Respondent mother)",
    report_deadline: '2026-06-30',
    status: 'complete',
  },
  onboarding: [
    {
      section: 'contact',
      content:
        'Petitioner Tomasz Szczerba (Castle Rock). Respondent Mai Ngo (Castle Rock). Minor child Amelia, 9, attends Castle Rock Elementary.',
      status: 'complete',
    },
    {
      section: 'family',
      content:
        'Parents married 2015, separated April 2024, divorce final December 2024. Amelia is only child. Maternal grandparents in Louisville, CO actively involved.',
      status: 'complete',
    },
    {
      section: 'health',
      content:
        'Child diagnosed with ASD Level 1 at Children\'s Hospital Colorado 2023. Ongoing OT and SLP weekly. IEP at Castle Rock Elementary.',
      status: 'complete',
    },
  ],
  documents: [
    {
      subfolder: 'Collateral',
      filename: 'Stipulated_Court_Order_Custody_Eval.txt',
      documentType: 'other',
      content: COURT_ORDER,
      description: 'Stipulated order for parenting evaluation',
    },
    {
      subfolder: 'Interviews',
      filename: 'Father_Interview_Szczerba.txt',
      documentType: 'other',
      content: FATHER_INTERVIEW,
      description: 'Father interview notes, March 10',
    },
    {
      subfolder: 'Interviews',
      filename: 'Mother_Interview_Ngo.txt',
      documentType: 'other',
      content: MOTHER_INTERVIEW,
      description: 'Mother interview notes, March 17',
    },
    {
      subfolder: 'Interviews',
      filename: 'Child_Observation_Session_1.txt',
      documentType: 'other',
      content: CHILD_OBSERVATION,
      description: 'First child observation, March 24',
    },
    {
      subfolder: 'Collateral',
      filename: 'Castle_Rock_Elementary_IEP_Summary.txt',
      documentType: 'other',
      content: SCHOOL_RECORDS,
      description: 'IEP progress report summary',
    },
    {
      subfolder: 'Diagnostics',
      filename: 'Case_Planning_Note.txt',
      documentType: 'other',
      content: PLANNING_NOTE,
      description: 'Interview-stage planning note',
    },
  ],
}
