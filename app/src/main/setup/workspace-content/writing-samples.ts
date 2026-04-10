// =============================================================================
// Writing Samples, synthetic prior reports used to calibrate the Writer Agent
// =============================================================================
//
// These are full-length example forensic reports in a consistent clinical
// voice. The Writer Agent reads them at draft time to learn the examiner's
// preferred sentence length, section ordering, diagnostic formulation
// language, and hedging patterns.
//
// Every sample is explicitly synthetic. No real patient data appears.
// =============================================================================

export interface WritingSample {
  readonly filename: string
  readonly evalType: string
  readonly content: string
}

const SYNTHETIC_HEADER =
  '[SYNTHETIC WRITING SAMPLE. All names, dates, diagnoses, and facts in this ' +
  'document are fictitious. This file exists to calibrate the Psygil Writer ' +
  "Agent on the examiner's preferred voice and style.]"

// ---------------------------------------------------------------------------
// Sample 1: CST evaluation, mixed outcome
// ---------------------------------------------------------------------------

const SAMPLE_CST: WritingSample = {
  filename: 'Writing_Sample_CST_Maynard.txt',
  evalType: 'CST',
  content: `${SYNTHETIC_HEADER}

FORENSIC PSYCHOLOGICAL EVALUATION
Competency to Stand Trial

Examinee: Adrian T. Maynard
Date of Birth: March 4, 1987
Case Number: 2024-CR-01829
Court: 18th Judicial District, Division 6
Referring Party: Hon. Celeste Okonkwo via court order dated May 3, 2024
Date of Report: June 18, 2024
Dates of Contact: May 22, 2024 and June 11, 2024
Location: Arapahoe County Detention Facility

REFERRAL QUESTION

The court requested an evaluation addressing whether Mr. Maynard has a rational and factual understanding of the proceedings against him and sufficient present ability to consult with counsel, consistent with Dusky v. United States, 362 U.S. 402 (1960). Mr. Maynard is charged with one count of Second Degree Burglary (C.R.S. 18-4-203) and one count of Criminal Mischief (C.R.S. 18-4-501).

NOTICE OF NON-CONFIDENTIALITY

I met with Mr. Maynard at the outset of each interview and explained that I had been appointed by the court, that the evaluation was not treatment, that the usual rules of doctor-patient confidentiality did not apply, and that a written report would be provided to the court and to both parties. Mr. Maynard acknowledged understanding in his own words and agreed to proceed. He asked whether he could stop the interview if he became uncomfortable; I confirmed that he could.

PROCEDURES

I reviewed the arrest report, the jail mental health screening dated May 4, the jail psychiatry progress notes through June 7, the public defender's intake notes, and a prior psychological evaluation from 2019 obtained via release. I conducted two clinical interviews totaling approximately three hours. I administered a mental status examination on each occasion and a brief competency-specific structured interview. I did not administer formal psychological testing in this evaluation because the clinical picture was unambiguous after the interviews and the prior records.

RELEVANT BACKGROUND

Mr. Maynard reports that he was raised in Pueblo by his paternal grandmother. He completed the tenth grade and later earned a GED. He worked as a journeyman electrician for several years in his twenties. He describes the onset of mood symptoms in his late teens. He was first psychiatrically hospitalized in 2016 following a paranoid episode at a construction site, at which time he was told he had a condition involving "the chemicals in the brain." He has had three subsequent hospitalizations, most recently in late 2022. He acknowledges stopping his medication several weeks before the current arrest and describes the period leading up to the offense as one in which "the TV was talking directly at me."

MENTAL STATUS

At the first interview Mr. Maynard was appropriately groomed in jail attire, cooperative, and oriented to person and place. He was uncertain of the exact date. His speech was at times pressured, with tangential associations when he described his legal situation. His mood was "OK I guess" and his affect was restricted. He denied current suicidal or homicidal ideation. He endorsed persistent auditory hallucinations ("a man who comments on what I do") and paranoid ideation regarding surveillance by "the people who run the network." Insight into his illness was limited. Judgment in the interview was fair.

At the second interview, after two additional weeks on resumed antipsychotic medication, the clinical picture had improved. He remained mildly paranoid but his speech was better organized and he could track questions about his case more effectively.

FUNCTIONAL ABILITIES

Factual understanding. At the first interview Mr. Maynard correctly named his attorney, correctly identified the prosecution as "trying to get me convicted," and correctly understood that the judge made decisions in court. He could not explain the role of a jury or describe the plea options available to him. He could not name his charges and offered a conflated account involving three separate events, two of which did not occur. At the second interview he could name both charges, could describe a guilty plea and a trial as two distinct paths forward, and could explain in his own words what a jury does.

Rational understanding. At the first interview Mr. Maynard held a fixed belief that the District Attorney's office was "running an experiment on homeless people using mind control," and that his charges were "a cover story" for this experiment. He believed his attorney might be "working with them." At the second interview he could articulate doubts about these beliefs. He told me, "I still think something was off with the DA but maybe I was reading into things." He could tentatively consider that his earlier thoughts may have been symptoms of his illness returning when he stopped his medication.

Capacity to consult with counsel. At the first interview Mr. Maynard said he did not trust his attorney and refused to discuss the case with her. At the second interview he said he had met with her the day before and that they had talked about his case for about twenty minutes. He described the meeting as "OK." He was able to recall and paraphrase the substance of what his attorney had said to him.

CLINICAL FORMULATION

Mr. Maynard meets criteria for Schizophrenia, continuous (F20.9), with a course of treatment non-adherence followed by relapse in the weeks preceding the current charges. At the time of the offense and at the time of the first evaluation session, he was experiencing active positive symptoms including paranoid delusions, delusions of reference, and persistent auditory hallucinations. By the second session, after he had been restarted on olanzapine 15 mg at bedtime for approximately two weeks, his positive symptoms had partially remitted. His thought organization improved enough that he could meaningfully engage with the legal proceedings.

The diagnosis is mine. The formulation is based on my own interviews, the prior evaluation from 2019 that documents a prior psychotic episode with similar features, and the jail psychiatry records showing the trajectory of his response to reintroduced medication.

OPINION

To a reasonable degree of psychological certainty, at the time of the first interview Mr. Maynard did not have sufficient present ability to consult with counsel with a reasonable degree of rational understanding, and he did not have a rational as well as factual understanding of the proceedings against him. At that time his paranoid delusions centered on his attorney and the prosecution rendered him unable to meaningfully participate in his defense.

At the time of the second interview, Mr. Maynard had made meaningful clinical gains. He had acquired factual understanding he previously lacked. His paranoid ideation was less fixed. He was able to work with his attorney in a limited but productive way. It is my opinion that Mr. Maynard is now competent to stand trial, with the caveat that his competency is contingent on continued medication adherence. If his treatment is interrupted his competency is likely to deteriorate within weeks.

RECOMMENDATIONS

I recommend that the court find Mr. Maynard presently competent. I recommend that his treatment plan in custody include mandatory medication administration, documented refusal procedures, and weekly mental health checks. I recommend that counsel be alert to signs of decompensation and be prepared to re-raise competency if Mr. Maynard's engagement deteriorates in a way that suggests relapse.

Respectfully submitted,

Jordan Whitfield, Psy.D., ABPP
Licensed Psychologist, Colorado
`,
}

// ---------------------------------------------------------------------------
// Sample 2: PTSD civil evaluation, opinion on causation
// ---------------------------------------------------------------------------

const SAMPLE_PTSD: WritingSample = {
  filename: 'Writing_Sample_PTSD_Avila.txt',
  evalType: 'PTSD Dx',
  content: `${SYNTHETIC_HEADER}

FORENSIC PSYCHOLOGICAL EVALUATION
PTSD Diagnostic Assessment and Causation Opinion

Examinee: Raquel V. Avila
Date of Birth: September 19, 1981
Civil Action: Avila v. Colorado Skylight Logistics, Inc.
Case Number: 2023-CV-00842
Referring Party: Halvorsen & Ostrom LLP (plaintiff counsel)
Date of Report: February 8, 2024
Dates of Contact: January 11, 2024 and January 18, 2024
Location: Foundry SMB Clinical Suite, Denver

REFERRAL QUESTION

Plaintiff's counsel requested a psychological evaluation of Ms. Avila to determine whether she currently meets DSM-5-TR criteria for Posttraumatic Stress Disorder, to identify any comorbid or alternative diagnoses, and to offer an opinion on whether the motor vehicle collision of November 4, 2022 is a substantial contributing cause of her current clinical presentation.

NOTICE OF LIMITS ON CONFIDENTIALITY

Ms. Avila was informed at the outset that this evaluation was requested by her attorney for the civil proceeding, that the usual rules of doctor-patient confidentiality did not apply, and that a written report would be provided to her counsel and potentially to opposing counsel and the court. She acknowledged understanding and agreed to proceed.

PROCEDURES

I reviewed the Aurora Police Department accident report, emergency department records from Anschutz Medical Center for the three weeks following the collision, primary care records from 2020 to present, mental health records from Ms. Avila's employer-sponsored EAP covering six sessions in early 2023, and a plaintiff's disclosure packet including photographs of the scene. I conducted two interviews totaling four hours. I administered the Clinician-Administered PTSD Scale for DSM-5 (CAPS-5), the PCL-5, the Beck Depression Inventory-II, the Trauma Symptom Inventory-2 (TSI-2), and the Miller Forensic Assessment of Symptoms Test (M-FAST) for symptom validity.

RELEVANT BACKGROUND

Ms. Avila is a 42-year-old woman who immigrated to the United States from Oaxaca at age seven and grew up in Denver. She completed a bachelor's degree in accounting at Metropolitan State University and has worked as a payroll specialist at the same employer since 2012. She is married with two children, ages 14 and 9. She denied any significant psychiatric history prior to November 2022 and there is no mental health treatment documented in her primary care records before that date. She described herself before the collision as "a person who could handle anything."

THE INDEX EVENT

On the morning of November 4, 2022, Ms. Avila was driving southbound on I-25 near the Evans Avenue exit when a commercial box truck operated by an employee of the defendant entered her lane without signaling and struck her vehicle on the driver's side. Her vehicle spun into the concrete barrier. Ms. Avila was conscious throughout. She describes thinking that she was going to die. She recalls the sound of the impact in detail, the sensation of the airbag, and the smell of coolant. She was extracted by Aurora Fire Rescue and transported to Anschutz with a fractured left wrist, a concussion (loss of consciousness not documented), and multiple contusions. The driver of the box truck sustained minor injuries. No fatalities occurred.

PTSD CRITERIA REVIEW (DSM-5-TR)

Criterion A. Ms. Avila was directly exposed to actual or threatened death and serious injury. Criterion A is met.

Criterion B (intrusion). She endorsed four of five intrusion symptoms on the CAPS-5 with clinically significant frequency and intensity. She experiences weekly intrusive memories of the collision, nightmares two to three times per month (content includes being trapped in a crushed vehicle), dissociative flashbacks triggered by the sound of large trucks, and prolonged distress at exposure to related cues. Criterion B is met.

Criterion C (avoidance). She endorsed both avoidance symptoms. She has not driven on I-25 since the collision. She takes a longer alternate route to work. She actively avoids thinking about the collision and declined to review the photographs her attorney had sent her. Criterion C is met.

Criterion D (negative alterations in cognition and mood). She endorsed five of seven symptoms: persistent negative beliefs about herself ("I am not who I used to be"), persistent blame of herself despite evidence the collision was not her fault, persistent negative emotional state (fear, shame), markedly diminished interest in activities she previously enjoyed including hiking and her church's Sunday potluck group, and persistent feelings of detachment from her husband and children that she describes as "being behind glass." Criterion D is met.

Criterion E (alterations in arousal and reactivity). She endorsed five of six symptoms: irritability with her children, hypervigilance in vehicles, exaggerated startle response, concentration difficulties affecting her work performance, and sleep disturbance characterized by difficulty falling asleep and early morning awakening. Criterion E is met.

Criterion F (duration). Symptoms have persisted for more than fifteen months, well beyond the one-month threshold.

Criterion G (functional impairment). Ms. Avila reported a documented performance improvement plan at work, strained relationships with her children, and substantial narrowing of her activities. Criterion G is met.

Criterion H (rule-outs). Her presentation is not attributable to a substance, medication, or another medical condition. Her concussion has clinically resolved per her neurology follow-up.

She did not endorse dissociative symptoms at the level needed for the dissociative specifier.

SYMPTOM VALIDITY

CAPS-5 total severity score: 46 (moderate to severe range).
PCL-5 total: 52 (consistent with the CAPS-5 and well above the 33 screening threshold).
TSI-2 validity scales (ATR, RL): within normal limits, no elevation suggesting exaggeration.
M-FAST total: 2 (no concerns; the threshold for possible feigning is 6).

The validity pattern is consistent with a genuine and substantial symptom presentation. There is no indication of exaggeration or feigning.

DIAGNOSTIC IMPRESSION

Posttraumatic Stress Disorder (F43.10), with delayed expression not endorsed. Specifier: not dissociative. Severity: moderate.

Persistent Depressive Disorder features are present in the context of the PTSD but do not appear to rise to the level of an independent mood disorder diagnosis at this time.

CAUSATION

To a reasonable degree of psychological certainty, the November 4, 2022 motor vehicle collision is a substantial contributing cause of Ms. Avila's current diagnosis of Posttraumatic Stress Disorder. The bases for this opinion are as follows. First, Criterion A is met by the collision itself; this is the only qualifying traumatic exposure in her history. Second, her pre-collision functioning is documented as unremarkable across medical, occupational, and personal domains, with no prior psychiatric treatment. Third, the temporal onset of symptoms immediately follows the collision. Fourth, the specific content of her intrusion symptoms (crushed vehicle, truck sounds, highway) is directly traceable to the collision.

RECOMMENDATIONS

I recommend that Ms. Avila receive evidence-based treatment for PTSD, specifically Prolonged Exposure therapy or Cognitive Processing Therapy with a trauma-focused clinician. I recommend a psychiatric consultation to address her sleep disturbance and consider pharmacological adjuncts. I recommend a graduated return to highway driving with the support of her therapist once PTSD treatment is underway. Based on the moderate severity and the absence of prior psychiatric history, her prognosis with appropriate treatment is fair to good.

Respectfully submitted,

Jordan Whitfield, Psy.D., ABPP
Licensed Psychologist, Colorado
`,
}

export const WRITING_SAMPLES: readonly WritingSample[] = [SAMPLE_CST, SAMPLE_PTSD] as const
