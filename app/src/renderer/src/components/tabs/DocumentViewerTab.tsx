import React, { useState } from 'react'
import styles from './DocumentViewerTab.module.css'

interface DocumentViewerTabProps {
  caseId: number
  documentType: string // 'collateral' | 'interview' | 'report'
  documentId?: string
}

interface Document {
  id: string
  name: string
  type: string
  date?: string
  duration?: string
  content: string
}

// Demo collateral documents
const COLLATERAL_DOCS: Record<string, Document> = {
  'court-order': {
    id: 'court-order',
    name: 'Court Order for Competency Evaluation',
    type: 'Court Document',
    date: 'Feb 28, 2026',
    content: `COURT ORDER FOR COMPETENCY EVALUATION

CASE NO: 2025CR-4821
PEOPLE OF THE STATE OF COLORADO
v.
MARCUS D. JOHNSON

HONORABLE JUDGE PATRICIA MORALES
Denver District Court, Division 3

ORDER ISSUED: February 28, 2026

The Court, having found reasonable grounds to believe that the above-named defendant may be incompetent to proceed to trial, ORDERS that:

1. The defendant, Marcus D. Johnson, shall undergo a comprehensive evaluation for competency to stand trial pursuant to C.R.S. § 16-8.5-101.

2. The evaluation shall address the defendant's:
   a. Factual understanding of the charges and court proceedings
   b. Rational understanding of the charges and proceedings
   c. Ability to consult with counsel and assist in his defense

3. The evaluator shall consider the Dusky standard (Dusky v. United States, 362 U.S. 402, 1960).

4. A written report of findings shall be submitted to this Court within 30 days.

5. The defendant shall be provided notification that communications during evaluation are not protected by privilege.

IT IS SO ORDERED.

_____________________________
Honorable Patricia Morales
Judge, Denver District Court`,
  },
  'hospital-records': {
    id: 'hospital-records',
    name: 'Denver Health Medical Center Records',
    type: 'Medical Records',
    date: 'Jun 15, 2024 – Jan 10, 2025',
    content: `DENVER HEALTH MEDICAL CENTER
PSYCHIATRIC ADMISSION RECORDS

PATIENT: Marcus D. Johnson
DOB: June 14, 1991
CASE NO: 2025CR-4821

ADMISSION 1: June 15, 2024
Duration: 14 days (Discharged June 29, 2024)

Chief Complaint: "Patient brought in by police after found wandering near downtown mall, disoriented and speaking to unseen persons"

Initial Diagnosis: Unspecified Psychotic Disorder, Rule out Schizophrenia

Clinical Notes:
Patient presented with disorganized behavior, poor hygiene, and bizarre ideation. States that "people are trying to get him through the radio." No clear precipitant for current episode. Family history unavailable. Patient denies substance abuse.

Treatment: Psychiatric hospitalization, Risperidone 2mg daily initiated, supportive care

Discharge Diagnosis: Unspecified Psychotic Disorder, Rule out Schizophrenia
Discharge Medications: Risperidone 2mg daily, Benztropine 1mg daily PRN


ADMISSION 2: September 18, 2024
Duration: 18 days (Discharged October 6, 2024)

Chief Complaint: Readmission — relapse of psychotic symptoms after medication non-compliance

Clinical Notes:
Patient stopped taking Risperidone approximately 2 weeks after discharge from first admission. Presents again with auditory hallucinations, paranoid ideation, and disorganized thinking. States that "agents are monitoring me and controlling my thoughts."

Psychiatric History: First hospitalization June 2024. Medications stopped against medical advice.

Treatment: Recommenced on Risperidone, increased to 3mg daily; brief psychosocial intervention

Discharge Plan: Community mental health referral, medication compliance education


ADMISSION 3: January 8, 2025
Duration: 15 days (Discharged January 23, 2025)

Chief Complaint: Admission via Denver Police Department in custody — assault incident

Clinical Notes:
Patient arrested January 15, 2025 after assault. At time of arrest, patient displaying acute psychotic symptoms. States he believed his victim was "involved in the conspiracy." Medical clearance completed; no medical contraindications to psychiatric care.

Medications: Continued Risperidone 3mg daily; added Lorazepam PRN for agitation`,
  },
  'police-report': {
    id: 'police-report',
    name: 'Police Report — Incident #2025-DPD-48721',
    type: 'Law Enforcement',
    date: 'Jan 15, 2026',
    content: `DENVER POLICE DEPARTMENT
INCIDENT REPORT

CASE: 2025-DPD-48721
REPORTING OFFICER: Officer Jennifer Martinez, Badge #4721
DATE OF INCIDENT: January 15, 2026
TIME: 14:32 hours

OFFENSE: Assault in the First Degree (F3), Criminal Mischief (M1)

PARTIES INVOLVED:
Suspect: Marcus D. Johnson, age 34, DOB 06/14/1991
Victim: Timothy R. Walsh, age 38

NARRATIVE:
Officers responded to report of assault in progress at 16th Street and Larimer Street. Upon arrival, found suspect Johnson on the ground being restrained by bystanders. Victim Walsh was bleeding from facial injuries.

Witness Accounts:
Witness 1 (Sarah Chen) reported seeing Johnson approach Walsh without apparent provocation and strike him repeatedly with a hammer. Victim fell to ground. Johnson continued striking victim until bystanders intervened.

Johnson's Statements:
During arrest, Johnson appeared disoriented and confused. Repeatedly stated "He was part of it" and "I had to stop him." Officer observed Johnson speaking to himself incoherently. Johnson appeared to have poor understanding of the seriousness of his actions.

Scene Evidence:
- Hammer recovered at scene (20 oz claw hammer, belonging to nearby construction site)
- Blood splatter on Johnson's clothing
- Multiple witnesses present (approx. 15 people)

Officer Observations:
Suspect appeared mentally unstable. Recommended emergency psychiatric evaluation. Denver Police noted Johnson's behavioral disorganization and seemed unaware of circumstances.

DISPOSITION: Arrested and transported to Denver County Jail. Medical clearance completed at Denver Health. Remains in custody pending court appearance.`,
  },
  'jail-medical': {
    id: 'jail-medical',
    name: 'Denver County Jail Medical Records',
    type: 'Custodial Medical',
    date: 'Feb 1 – Mar 15, 2026',
    content: `DENVER COUNTY JAIL
MEDICAL RECORD

INMATE: Marcus D. Johnson
INMATE #: J-87624
DATE ADMITTED: January 15, 2026

MEDICAL HISTORY:
Psychiatric disorder — previously diagnosed psychotic disorder

MEDICATIONS:
Risperidone 4mg daily (increased from 3mg due to breakthrough symptoms)
Benztropine 1mg daily
Lorazepam 2mg daily (recently reduced due to stability)

PROGRESS NOTES:

Feb 3, 2026: Inmate presenting with auditory hallucinations. Reports "hearing voices telling me I'm being watched." Affect constricted. Speech tangential. Denies current suicidality. Medication compliance good. Will continue current regimen.

Feb 15, 2026: Inmate appears stabilized on current medications. However, continues to endorse paranoid ideation regarding other inmates and jail staff. States "Some of the guards are in on it too." Insight into illness minimal. Risk of future non-compliance if released.

Mar 1, 2026: Mental status exam shows continued mild thought disorganization. Symptoms partially responsive to medication. Remains paranoid but more reality-oriented than on admission. Denies auditory hallucinations today (though reported them 2 days ago). Continues medication.

Mar 12, 2026: Evaluation by Dr. Irwin for competency assessment. Inmate cooperative. Reviewed prior medical records and medications.`,
  },
}

// Demo interview sessions
const INTERVIEW_SESSIONS: Record<string, Document> = {
  'session-1': {
    id: 'session-1',
    name: 'Session 1 — Initial Interview',
    type: 'Clinical Interview',
    date: 'Mar 8, 2026',
    duration: '2.5 hours',
    content: `CLINICAL INTERVIEW SESSION 1
Marcus D. Johnson — CST Evaluation
Date: March 8, 2026
Time: 10:00 AM – 12:30 PM
Duration: 2.5 hours
Evaluator: Truck Irwin, Psy.D.

PRESENTING COMPLAINT:
Johnson is a 34-year-old African American male currently incarcerated at Denver County Jail awaiting trial on charges of Assault 1st Degree and Criminal Mischief. He was referred for competency to stand trial evaluation by Court Order dated February 28, 2026.

BEHAVIORAL OBSERVATIONS:
Johnson presented as a thin, African American male appearing his stated age. Dressed in jail clothing, somewhat disheveled. Speech normal in rate but occasionally pressured. Affect constricted with limited emotional range. Eye contact poor. Displayed some suspiciousness during interview. Overall presentation consistent with chronic mental illness.

MENTAL STATUS EXAMINATION:
Orientation: Alert and oriented to person, place, time, and situation
Memory: Intact for immediate and recent events
Cognition: Able to follow commands; some difficulty with complex reasoning
Thought Process: Linear but interrupted by preoccupation with paranoid themes
Thought Content: Endorses auditory hallucinations ("hearing voices telling me people are against me") and persecutory delusions (belief that people are conspiring against him, using technology to monitor him)
Mood/Affect: Stated mood "worried"; affect constricted and somewhat flat
Insight/Judgment: Limited insight into mental illness; attributes symptoms to external persecution rather than internal mental processes

CHIEF COMPLAINT REGARDING CHARGES:
When asked about the incident on January 15, 2026, Johnson states: "I did what I had to do. He was part of it. They're all part of the conspiracy." When pressed for details, Johnson becomes tangential, returning repeatedly to his beliefs about persecution.

UNDERSTANDING OF LEGAL PROCEEDINGS:
Johnson correctly names his charges (Assault and Criminal Mischief) but cannot articulate what these charges mean. Does not distinguish between felonies and misdemeanors. Knows names of his attorney (Public Defender Marcus Washington) and judge (Judge Morales) but has limited understanding of their roles. States: "I don't know if my lawyer is helping me or if he's in on it too."

INTERVIEW ENDING:
Johnson agreed to continue with testing. Signed consent form after notification of non-therapeutic nature of evaluation and lack of privilege.`,
  },
  'session-2': {
    id: 'session-2',
    name: 'Session 2 — Psychological Testing',
    type: 'Clinical Interview',
    date: 'Mar 10, 2026',
    duration: '2.0 hours',
    content: `CLINICAL INTERVIEW SESSION 2
Marcus D. Johnson — Psychological Testing Session
Date: March 10, 2026
Time: 1:00 PM – 3:00 PM
Duration: 2.0 hours
Evaluator: Truck Irwin, Psy.D.
Psychometrist: J. Torres

OVERVIEW:
Patient completed MMPI-3 and PAI testing during this session. Testing was conducted in interview room at Denver County Jail. Patient was alert and cooperative throughout.

BEHAVIORAL OBSERVATIONS DURING TESTING:
Johnson remained seated and focused on test materials. Occasionally fidgeted or looked around suspiciously. Did not attempt to read examiner's face or ask for feedback. Testing was completed without interruption.

EFFORT AND COOPERATION:
Patient appeared to put forth genuine effort on both instruments. Did not appear to be malingering or minimizing symptoms. Validity scales on both MMPI-3 and PAI were within acceptable limits.

RESPONSE TO TESTING:
When asked if he understood the instructions, Johnson stated: "Yeah, I understand. I'm just answering honestly about how I feel." Agreed that the tests were fair and unbiased.

CLINICAL OBSERVATIONS:
During break, Johnson spontaneously mentioned hearing "voices in the background" and expressed concern that "people here might be listening." Made reference to previous statement about attorney potentially being "in on the conspiracy."

INTERVIEW NOTES:
When asked directly about his ability to work with his attorney, Johnson expressed hesitation: "I want to work with him, but I don't know if I can trust him. How do I know what he's telling me is true?"

ENDING:
Session concluded at 3:00 PM. Patient scheduled for cognitive testing (WAIS-V) on March 11, 2026.`,
  },
  'session-3': {
    id: 'session-3',
    name: 'Session 3 — Cognitive Testing',
    type: 'Clinical Interview',
    date: 'Mar 12, 2026',
    duration: '2.0 hours',
    content: `CLINICAL INTERVIEW SESSION 3
Marcus D. Johnson — Cognitive Testing & Effort Assessment
Date: March 12, 2026
Time: 1:00 PM – 3:00 PM
Duration: 2.0 hours
Evaluator: Truck Irwin, Psy.D.
Psychometrist: J. Torres

OVERVIEW:
Patient completed WAIS-V cognitive testing and effort/validity measures (TOMM and SIRS-2) during this session.

BEHAVIORAL OBSERVATIONS:
Johnson was alert and cooperative. Appeared somewhat fatigued but maintained effort throughout. Made occasional comments about other inmates or guards, but remained focused on tasks.

COGNITIVE TESTING (WAIS-V):
Patient worked through verbal and visual tasks systematically. Performance on verbal tasks appeared lower than visual tasks (observation confirmed by scores: VCI=78 vs. VSI=88). Patient occasionally made comments like "This is hard" or "I don't know" when uncertain.

EFFORT TESTING (TOMM):
Patient understood instructions easily. Trial 1: 42/50. Trial 2: 48/50 (PASS — well above cut score of 45). This performance indicates genuine memory functioning and adequate effort on testing.

SYMPTOM VALIDITY (SIRS-2):
Patient endorsed various symptoms when asked structured questions. All eight primary SIRS-2 scales fell within "Honest" classification range, indicating genuine reported symptoms rather than fabrication.

CLINICAL OBSERVATIONS:
When asked directly about his understanding of the legal case, Johnson stated: "I know I'm here because of what happened. But I don't think I did anything wrong. That guy was part of the conspiracy."

When asked if he could discuss his case with his attorney, Johnson hesitated: "I could talk to him, but I don't think he understands how serious this is. Or maybe he's part of it."

INTERVIEWER IMPRESSIONS:
Johnson demonstrates:
- Genuine psychotic symptoms (endorsement of auditory hallucinations, paranoid delusions)
- Poor insight into illness
- Genuine effort on cognitive and validity testing (TOMM PASS, SIRS-2 honest responding)
- Cognitive impairment at low-average level
- Apparent distrust of legal counsel driven by paranoid ideation

CLOSING:
Session concluded at 3:00 PM. Patient informed that evaluation was complete and that a written report would be submitted to the court. Johnson asked: "Does this mean I can get out?" Explained that report findings would be presented to court, which would make decisions about his case.`,
  },
}

const DocumentViewerTab: React.FC<DocumentViewerTabProps> = ({
  caseId,
  documentType,
  documentId,
}) => {
  let docs: Record<string, Document> = {}
  let docList: string[] = []

  if (documentType === 'collateral') {
    docs = COLLATERAL_DOCS
    docList = ['court-order', 'hospital-records', 'police-report', 'jail-medical']
  } else if (documentType === 'interview') {
    docs = INTERVIEW_SESSIONS
    docList = ['session-1', 'session-2', 'session-3']
  }

  const [selectedDocId, setSelectedDocId] = useState<string>(
    documentId || docList[0] || ''
  )
  const selectedDoc = docs[selectedDocId]

  return (
    <div className={styles.documentViewerTab}>
      {/* Document selector */}
      {docList.length > 1 && (
        <div className={styles.documentSelector}>
          <label htmlFor="doc-select">Select Document:</label>
          <select
            id="doc-select"
            value={selectedDocId}
            onChange={(e) => setSelectedDocId(e.target.value)}
            className={styles.select}
          >
            {docList.map((docId) => (
              <option key={docId} value={docId}>
                {docs[docId]?.name || docId}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Document content */}
      {selectedDoc ? (
        <div className={styles.documentContent}>
          <div className={styles.documentHeader}>
            <h1>{selectedDoc.name}</h1>
            <div className={styles.documentMeta}>
              <span className={styles.docType}>{selectedDoc.type}</span>
              {selectedDoc.date && <span className={styles.docDate}>{selectedDoc.date}</span>}
              {selectedDoc.duration && <span className={styles.docDuration}>{selectedDoc.duration}</span>}
            </div>
          </div>

          <div className={styles.documentBody}>
            {selectedDoc.content.split('\n\n').map((paragraph, idx) => (
              <p key={idx}>{paragraph}</p>
            ))}
          </div>
        </div>
      ) : (
        <div className={styles.emptyState}>
          <p>No documents available for this case.</p>
        </div>
      )}
    </div>
  )
}

export default DocumentViewerTab
