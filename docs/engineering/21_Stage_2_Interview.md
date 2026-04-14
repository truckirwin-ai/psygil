# Psygil Stage 2: Interview — Production Specification

**Document Version:** 1.0
**Created:** 2026-03-22
**Author:** Truck Irwin / Engineering
**Status:** Active — Production Specification
**References:** Case Lifecycle Spec (doc 18), Case Directory Schema (doc 16), UNID Redaction (doc 15), Agent Prompt Specs (doc 03), IPC Contracts (doc 02), Pipeline Architecture (doc 14)

---

## Overview

Stage 2: Interview is where the clinician conducts face-to-face clinical interviews with the patient and collateral contacts (family, treatment providers, attorneys, employers). This stage generates the most clinically rich data in the evaluation — the patient's narrative account, behavioral observations in real-time, and independent corroboration from third parties.

**Entry Condition:** Case has reached Interview status (all tests in battery scored and reviewed).
**Exit Condition:** Clinician has documented at least one clinical interview session AND determined sufficient data has been gathered for diagnostic formulation.

**Key Principle:** DOCTOR ALWAYS DIAGNOSES. Interview observations are clinical data — the clinician interprets them, not the AI. The AI supports with session prep, transcript processing, and behavioral extraction from audio, but the clinician's direct clinical judgment drives all interpretations.

---

## Step 2.1: Session Preparation

### Purpose

Before each interview session, the clinician needs context on what remains to be explored — gaps from the biopsychosocial history, referral questions not yet addressed, test results needing clarification, and discrepancies between patient self-report and collateral records.

### Session Prep Sheet Generation

**Who Triggers:** Clinician clicks "Prepare Session" in the Interview section or creates a new session_NNN directory
**When Triggered:** Before the first or subsequent interview sessions
**What Gets Generated:** An AI-assisted session preparation sheet

**Process:**

1. App assembles case record to this point:
   - Patient demographics and referral questions
   - Complete biopsychosocial history (clinician-reviewed version)
   - Test battery results with scores and validity indicators
   - Any collateral records received to date
   - Any prior interview session notes (if multiple sessions)

2. **UNID Redaction Point:** Full-PHI case data sent through redaction pipeline (fresh UNIDs for this operation)

3. App sends redacted case to **Ingestor Agent** with specific instructions:
   - **Identify gaps:** Which sections of the biopsychosocial have incomplete information (e.g., "Family history of mental illness: vague, needs clarification")
   - **Map referral questions:** Which referral questions are directly addressed by existing data, which need interview exploration
   - **Flag test-related questions:** Which test results show elevations, validity concerns, or patterns that need patient explanation (e.g., "SIRS-2 elevations — need to explore during interview to assess consistency with claimed symptoms")
   - **Collateral discrepancies:** Where patient self-report contradicts collateral records (e.g., "Patient reports being employed continuously 2015-present; employer records show three separations")

4. Ingestor returns structured prep sheet with re-hydrated PHI

5. **Session Prep Sheet stored:** `interviews/session_NNN/prep_sheet.json`

### Session Prep Sheet Data Model

```json
{
  "sessionNumber": 1,
  "sessionType": "Clinical Interview",
  "preparedAt": "2026-03-20T09:00:00Z",
  "evaluationType": "CST",
  "referralQuestions": [
    {
      "question": "Is the defendant competent to stand trial?",
      "source": "Court Order",
      "addressedBy": ["test results", "interview needed"],
      "priority": "primary",
      "suggestedProbes": [
        "Explain your understanding of the charges against you",
        "What do you understand about your role in this trial?",
        "What is your attorney's role in helping you?"
      ]
    }
  ],
  "biopsychosocialGaps": [
    {
      "section": "Psychiatric History",
      "gap": "No details on duration of prior depression diagnosis (2018). Patient noted 'was treated' but current medication status unclear.",
      "suggestion": "Ask about: onset date, treatment provider, duration, current medication and prescriber, reason treatment ended"
    },
    {
      "section": "Substance Use History",
      "gap": "Denies current use but timeline of prior use vague. Last use reported as '2-3 years ago' but inconsistent with police report describing arrest while intoxicated (8 months ago).",
      "suggestion": "Clarify: dates of use, patterns, last confirmed use date, current screening question"
    }
  ],
  "testClarifications": [
    {
      "instrument": "SIRS-2",
      "result": "Failed (Total Score: 52)",
      "implication": "Indicates possible symptom exaggeration or factitious disorder",
      "suggestedProbes": [
        "Have you ever had to fake or exaggerate symptoms to get help?",
        "Tell me about times you felt you had to 'play up' your problems to be taken seriously",
        "Are there any symptoms you mentioned in our earlier conversation that you're uncertain about?"
      ]
    },
    {
      "instrument": "MMPI-3",
      "result": "F-family elevations, Scale 4 (Antisocial Features) T=78, Scale 6 (Anger/Hostility) T=75",
      "implication": "Pattern suggests possible impulsivity, anger dyscontrol, disregard for social norms. Consistent with charges but need to assess temporal relationship and context.",
      "suggestedProbes": [
        "Describe a recent situation where you felt angry. What happened?",
        "How do you typically handle it when someone disrespects you?",
        "Tell me about the incident that led to these charges"
      ]
    }
  ],
  "collateralDiscrepancies": [
    {
      "topic": "Employment History",
      "patientReport": "Worked at ABC Manufacturing from 2015 to present, promoted to supervisor in 2020",
      "collateralRecord": "Employer records (ABC Manufacturing HR): employed 2015-2017 (separated for 'performance issues'), 2018-2019 (hired as general laborer, terminated for absenteeism), not employed 2020-present",
      "status": "Major discrepancy",
      "suggestedProbes": [
        "Walk me through your employment at ABC Manufacturing. How long were you there?",
        "Why did you leave ABC Manufacturing?",
        "What were you doing for work from 2018 to now?"
      ]
    }
  ],
  "prioritizedTopics": [
    {
      "topic": "Competency-Relevant Legal Understanding",
      "justification": "Primary referral question",
      "estimatedTime": "15-20 minutes"
    },
    {
      "topic": "Incident Narrative (Charges)",
      "justification": "Core to understanding mental state and behavior pattern",
      "estimatedTime": "20-30 minutes"
    },
    {
      "topic": "Psychiatric/Medication History Clarification",
      "justification": "Inconsistency with current presentation",
      "estimatedTime": "15-20 minutes"
    }
  ],
  "sessionDurationEstimate": "60-90 minutes",
  "notes": "This case shows significant discrepancies between self-report and collateral records. Recommend open-ended questions early, followed by gentle confrontation on specific inconsistencies. Validity concerns (SIRS-2) suggest need to assess consistency of reported symptoms across session."
}
```

### Eval-Type-Specific Interview Protocols

The session prep sheet is supplemented by eval-type-specific interview protocol guidance. These are pre-built prompts/checklists that the clinician can consult or print:

#### CST (Competency to Stand Trial) — Dusky Criteria Framework

Focus on three legally-defined areas:

1. **Factual Understanding of Charges and Proceedings**
   - Does patient understand what he/she is accused of?
   - Does patient understand the charges and their seriousness?
   - Does patient understand the nature of the trial process?
   - Sample questions:
     - "What are you accused of?"
     - "What do you understand will happen in a trial?"
     - "How long could you go to prison if convicted?"

2. **Rational and Factual Understanding of Attorney-Client Relationship**
   - Does patient understand attorney's role?
   - Can patient communicate with attorney?
   - Does patient understand confidentiality?
   - Sample questions:
     - "What is your attorney's job in this case?"
     - "Can you talk to your attorney freely about your case?"
     - "If you tell your attorney something, who will know?"

3. **Ability to Assist in Defense**
   - Can patient describe events leading to charges?
   - Can patient recall relevant facts?
   - Can patient make coherent decisions about defense strategy?
   - Sample questions:
     - "Tell me what happened the day of [incident]. Start from the beginning."
     - "Who was there with you?"
     - "What did the police ask you?"

**Prep Sheet Integration:** For CST cases, the Ingestor identifies which Dusky criteria are likely supported/unsupported by existing data, flagging what needs interview exploration.

#### Custody/Parenting Capacity

1. **Parental Knowledge & Reasoning**
   - Understands child's needs
   - Can explain parenting philosophy
   - Sample questions:
     - "Tell me about your child. What are his/her main needs right now?"
     - "How do you handle discipline?"
     - "What would you do if your child was struggling in school?"

2. **Parent-Child Relationship Observation** (can occur during interview if child is present)
   - Emotional tone, responsiveness, boundary-setting
   - Can be documented in structured observation form (see Step 2.3)

3. **Collateral Contact — Other Parent/Caregiver**
   - Interview typically includes call to other parent or current caregiver
   - Questions parallel to the parent interview but from outside perspective

#### Risk Assessment (Violence, Suicide, Sexual Offense Recidivism)

**For Violence Risk:**
- HCR-20 V3 structured professional judgment framework
- Prep sheet flags which HCR-20 items are addressed by testing/history, which need interview exploration
- Sample questions:
  - "Describe your anger. How hot does it get?"
  - "What's the worst you've ever hurt someone?"
  - "When you're angry, can you stop yourself?"

**For Suicide Risk:**
- Columbia-Suicide Severity Rating Scale (C-SSRS) or similar
- Current ideation, intent, plan, behavior
- Sample questions:
  - "Have you ever thought about hurting yourself?"
  - "Right now, are you thinking about ending your life?"
  - "Do you have a plan?"

**For Sexual Offense Recidivism:**
- Dynamic Risk Assessment for Offender Re-entry (DRAOR) or Static-99R informed
- Sexual interests, offense history, victim empathy, access to victims
- Sensitive topic — build rapport first

#### PTSD/Trauma Evaluation

- Focus on trauma narrative (what happened, where, when, with whom)
- CAPS-5 structured interview framework (if using CAPS-5 for diagnosis)
- Sample questions:
  - "Tell me about the most traumatic event you've experienced"
  - "When that happened, what did you think was going to happen to you?"
  - "How has that event affected your life since?"

#### Malingering-Focused Evaluation

- SIRS-2 behavioral analysis during interview (is patient consistent with tested profile?)
- Symptom validity interview approach
- Sample questions:
  - "Tell me about your [reported symptom]. When did it start?"
  - "Has anyone ever told you that you're exaggerating or faking?"
  - "If I talk to people who know you, what would they say about [reported symptom]?"

#### Cognitive/Capacity Evaluation (Medical/Testamentary)

- Cognitive assessment during interview (orientation, memory, reasoning)
- Functional assessment for decision-making capacity
- Sample questions:
  - "What is today's date?"
  - "Tell me about your current medications. Who prescribed them?"
  - "What are your options, and what do you think is the best choice?"

### Prep Sheet Access in UI

- Clinician opens case → Interview section
- Clicks "Prepare Session" → modal generates prep sheet
- Can view in-app or print for reference during session
- Prep sheet is read-only (not edited by clinician) but informs clinician's session approach

---

## Step 2.2: Clinical Interview Execution

### Who Participates

**Clinician:** Licensed psychologist or doctoral-level practitioner
**Patient:** The evaluee
**Optional third parties:** Family members (custody evaluations), collateral contacts by phone
**Location:** In-person, or by video (Zoom, etc.) — **NOT in the application**

### What Happens During the Interview

The application is NOT used during the actual interview. The clinician and patient meet face-to-face (or via video), and the clinician:

1. Conducts the interview using the prep sheet as a guide
2. Optionally records the session (audio only)
3. Takes notes (paper, handwritten, or typed into computer after session)

### Audio Recording (Optional)

**Clinician's Choice:** Record or don't record. Recording is optional, not required.

**If Recording:**

1. Clinician places phone or recording device on desk to record audio
2. Patient consent required (typically documented in informed consent form or obtained verbally at session start)
3. Audio file stored locally on clinician's machine (laptop, phone, tablet) — NEVER uploaded to cloud or sent to AI
4. After session ends, clinician transfers audio file to project directory

### Local Whisper Transcription

**Trigger:** Clinician has an audio recording and wants a transcript

**Process:**

1. Clinician opens the case, clicks "Transcribe Audio" in the Interview section
2. Selects the audio file from local storage
3. App passes audio file path to **Python sidecar** process
4. Sidecar invokes **Whisper** (OpenAI's local speech-to-text model):
   - Whisper runs entirely locally (never sends audio to any external API)
   - Processes audio, generates transcript
5. Whisper returns transcript in VTT (WebVTT) format with timestamps
6. Sidecar saves transcript to: `interviews/session_NNN/transcript.vtt`
7. Clinician sees transcript in-app (can edit for accuracy)

**Important:** The Whisper transcription is a tool for documentation, not for clinical analysis. The clinician reviews the transcript for accuracy and may correct Whisper errors, but the clinician's own observations take precedence. Clinician may not rely solely on the transcript to understand what happened — they were there, they know.

### Real-Time Note-Taking Interface (Optional)

**Not Required:** The clinician can take notes on paper, in Word, or in any note-taking app.

**If Using Psygil for Notes:**

1. During or after session, clinician opens `interviews/session_NNN/` section
2. Clicks "Add Session Notes" → opens a text editor
3. Can type free-form narrative notes
4. **No structured prompting or AI assistance during note entry** — this is the clinician's direct documentation

---

## Step 2.3: Session Documentation

### Session Metadata

Every session gets a structured metadata record:

```json
{
  "sessionNumber": 1,
  "sessionDate": "2026-03-20",
  "sessionStartTime": "09:00",
  "sessionEndTime": "10:35",
  "durationMinutes": 95,
  "location": "Clinician's Office, Conference Room B",
  "participantRoles": [
    {
      "role": "patient",
      "name": "PERSON_[UNID at time of storage]",
      "status": "present"
    },
    {
      "role": "collateral_contact",
      "name": "PERSON_[UNID]",
      "relationship": "mother",
      "status": "present"
    },
    {
      "role": "clinician",
      "name": "Dr. Truck Irwin, Psy.D.",
      "status": "present"
    }
  ],
  "audioRecorded": true,
  "transcriptAvailable": true,
  "sessionType": "Clinical Interview",
  "focusAreas": [
    "Competency assessment",
    "Psychiatric history clarification",
    "Incident narrative"
  ],
  "clinicianNotes": "Patient presented as guarded but cooperative. Responded to clarification questions about prior hospitalization with initially evasive answers, then provided more detail. No signs of acute distress during session. Some confusion about trial process evident."
}
```

### Structured Mental Status Examination (MSE)

The Mental Status Examination is a standardized clinical assessment of cognitive and emotional functioning. Each field is observed during the interview and documented in a structured form.

**MSE Data Model:**

```json
{
  "sessionNumber": 1,
  "mseCompletedDate": "2026-03-20",
  "appearance": {
    "description": "Well-groomed, clean clothing, appears stated age",
    "observations": [
      "Hair neat and clean",
      "Clothing appropriate for weather and occasion",
      "No obvious signs of neglect",
      "Facial hair neatly trimmed"
    ],
    "clinicianNotes": "Presentation is consistent with adequate self-care"
  },
  "behavior": {
    "description": "Cooperative, attentive, no unusual movements",
    "psychomotor": "Calm, no restlessness or retardation",
    "observations": [
      "Sits upright in chair",
      "Maintains eye contact",
      "Gestures appropriate to content",
      "No rocking, pacing, or stereotyped movements"
    ],
    "clinicianNotes": "Behavior appropriate throughout interview. No signs of agitation or withdrawal."
  },
  "speech": {
    "rate": "Normal",
    "volume": "Normal",
    "rhythm": "Regular, no pauses or stuttering",
    "quality": "Clear, articulate",
    "observations": [
      "Speaks at conversational pace",
      "No word-finding difficulties",
      "Pronunciation clear",
      "Responds to questions directly"
    ],
    "clinicianNotes": "Speech within normal limits. No evidence of expressive language disorder."
  },
  "mood": {
    "patientReport": "Says he feels 'okay, considering everything'",
    "rating": "Euthymic (normal)",
    "stability": "Stable throughout interview",
    "observations": [
      "Reports no current suicidal ideation",
      "Denies persistent depressed mood",
      "Describes normal pleasure in activities",
      "Expresses appropriate concern about legal situation"
    ],
    "clinicianNotes": "Mood appears to be in normal range. Appropriate emotional response to circumstances."
  },
  "affect": {
    "quality": "Appropriate to content",
    "range": "Full range (shows laughter, concern, seriousness)",
    "stability": "Stable",
    "observations": [
      "Smiles when discussing positive memories",
      "Shows concern when discussing charges",
      "Facial expressions congruent with verbal content",
      "No flat or blunted affect"
    ],
    "clinicianNotes": "Affect is appropriate and congruent. No evidence of affective flattening or inappropriate emotional responses."
  },
  "thoughtProcess": {
    "description": "Goal-directed, organized, coherent",
    "observations": [
      "Responses follow logically from questions",
      "Able to follow complex questions",
      "Thinks through responses before answering",
      "No tangentiality or loose associations"
    ],
    "clinicianNotes": "Thought process is organized and rational. No evidence of looseness of association or disorganized thinking."
  },
  "thoughtContent": {
    "description": "No delusions, hallucinations, or obsessions",
    "observations": [
      "Content consistent with reality",
      "No paranoid ideation expressed",
      "No grandiose ideas",
      "No command hallucinations reported"
    ],
    "hallucinations": {
      "present": false,
      "details": null
    },
    "delusions": {
      "present": false,
      "details": null
    },
    "obsessions": {
      "present": false,
      "details": null
    },
    "clinicianNotes": "Thought content is within normal limits. No evidence of psychotic symptoms."
  },
  "perception": {
    "hallucinations": {
      "auditory": {
        "present": false,
        "details": null
      },
      "visual": {
        "present": false,
        "details": null
      },
      "tactile": {
        "present": false,
        "details": null
      },
      "olfactory": {
        "present": false,
        "details": null
      }
    },
    "clinicianNotes": "Patient denies all forms of hallucinations. No evidence of perceptual disturbance."
  },
  "cognition": {
    "orientation": {
      "person": {
        "result": "Correct",
        "observation": "Knows own name, date of birth, age"
      },
      "place": {
        "result": "Correct",
        "observation": "Knows location of evaluation (clinician's office in Denver)"
      },
      "time": {
        "result": "Correct with minor lag",
        "observation": "Knows current date, day of week, approximate time. Slight hesitation before responding."
      }
    },
    "attention": {
      "result": "Good",
      "observation": "Able to maintain focus throughout 95-minute interview. No distractibility. Follows complex multi-part questions."
    },
    "memory": {
      "immediate": {
        "result": "Intact",
        "observation": "Recalls 3/3 objects after 3-second delay"
      },
      "recent": {
        "result": "Intact",
        "observation": "Able to recall details of events from this week and month"
      },
      "remote": {
        "result": "Intact",
        "observation": "Recalls significant life events with accurate dates and contexts"
      }
    },
    "concentration": {
      "result": "Good",
      "observation": "No difficulty with serial 7s (100-7-93-86-79). Performed without error."
    },
    "abstractAbility": {
      "result": "Good",
      "observation": "Able to explain proverbs ('People who live in glass houses shouldn't throw stones') with appropriate abstract interpretation"
    },
    "clinicianNotes": "Cognitive examination shows no evidence of dementia or significant cognitive impairment. Orientation, attention, and memory all within normal limits."
  },
  "insight": {
    "levelOfInsight": "Good",
    "description": "Aware of legal situation, understands he faces criminal charges",
    "observations": [
      "Recognizes impact of charges on his life",
      "Acknowledges previous mental health concerns",
      "Understands he has attorney and will face trial",
      "Concerned about outcome"
    ],
    "clinicianNotes": "Patient has good insight into his legal situation and mental health history. Demonstrates realistic understanding of consequences."
  },
  "judgment": {
    "description": "Judgment appears intact",
    "observations": [
      "Made appropriate decision to accept attorney",
      "Demonstrates understanding of legal advice",
      "Responses to hypothetical questions show rational decision-making",
      "No evidence of impulsive or reckless judgment"
    ],
    "hypotheticalQuestion": "If you found a wallet with $100 in cash and no identification, what would you do?",
    "response": "I'd try to find out who it belongs to. Maybe check if there's an address or phone number inside. If not, I'd give it to the police.",
    "clinicianNotes": "Judgment is intact. Patient demonstrates appropriate decision-making in hypothetical scenarios."
  }
}
```

**MSE Documentation Rules:**

1. **Each field is documented with both a summary and detailed observations**
2. **Observations are behavioral/clinical facts, not inferences**
   - ✓ "Makes eye contact throughout interview"
   - ✗ "Confident and making good eye contact (implies psychological interpretation)"
3. **Clinician notes provide clinical context**
4. **All negative findings are documented explicitly** (what is NOT present)
5. **MSE is stored immediately after session** → `interviews/session_NNN/mental_status.json`

### Narrative Session Notes

Free-text clinician notes on the interview. Can include:

- Patient's account of the incident (for CST, custody, or risk cases)
- Clarifications of prior inconsistencies
- New information that contradicts prior reports
- Clinician's observations of emotional state, cooperation, effort
- Anything not captured in the MSE or structured forms

**Stored:** `interviews/session_NNN/notes.json`

```json
{
  "sessionNumber": 1,
  "narrativeNotes": "Patient provided detailed account of charges. States he was at a bar with friends, had three beers over 4 hours. Denies initiating the fight but acknowledges he 'threw some punches' after being 'pushed into it.' Claims the other man started it. When asked about his anger, acknowledged he sometimes 'loses it' when disrespected but says this was different—he felt threatened. Consistent with his account when asked to describe the incident a second time, 20 minutes later. Police report states he was the aggressor; patient's account conflicts with this. Did not become defensive when confronted with this discrepancy—acknowledged police might have different perspective but insisted his account is accurate.\n\nAsked about his prior hospitalization (2018). Initially evasive ('it was just for observation'). After gentle pressing, revealed he was hospitalized for suicidal ideation following a breakup. Stayed 3 days, was discharged on sertraline. Did not continue with psychiatry after discharge. No current suicidal ideation; denies ongoing depressive symptoms. Describes himself as 'over that now.'\n\nRegarding competency: Patient demonstrates clear understanding of charges (assault 2, menacing), knows he faces up to X years in prison if convicted, understands his attorney's role, and can discuss trial process intelligently. Able to recall relevant facts. No barriers to assisting in his defense evident.",
  "clinicianObservations": "Patient maintains guarded demeanor throughout but engages appropriately with questions. Speech clear and goal-directed. No evidence of psychosis or cognitive impairment. Some minimization of his own role in the incident, but this may be understandable defensive posture in criminal matter rather than evidence of poor insight. Overall, appears competent to stand trial based on initial assessment."
}
```

### Behavioral Observations (From Transcript or Direct Observation)

If a transcript is available, the Ingestor Agent can extract behavioral observations. If no transcript, clinician directly documents observations.

**Key Distinction:**
- **Transcript-derived:** "From the recording, the patient appeared anxious when discussing the incident — speaking faster and taking short breaths"
- **Clinician direct observation:** "The patient appeared anxious when I asked about the incident, showed physical signs of tension (shoulders raised, fidgeting)"

**Behavioral Observations Data Model:**

```json
{
  "sessionNumber": 1,
  "behavioralObservations": [
    {
      "topic": "Demeanor During Incident Discussion",
      "source": "clinician_direct_observation",
      "observation": "When asked to describe the fight, patient's shoulders tightened, he leaned forward, and his speech became faster. His eyes moved away from clinician's face for the first time in the interview.",
      "clinicalSignificance": "Physical response consistent with arousal/anxiety. Could indicate genuine discomfort discussing the event or heightened emotion when recalling it."
    },
    {
      "topic": "Consistency of Incident Account",
      "source": "clinician_direct_observation",
      "observation": "Incident narrative provided twice (initial telling and again when asked for clarification ~20 minutes later). Both accounts matched precisely: same details about location, companions, sequence of events, what the other man said, what precipitated the physical confrontation.",
      "clinicalSignificance": "Consistency across tellings suggests either genuine memory or a well-rehearsed account. Did not add or subtract details on retelling."
    },
    {
      "topic": "Emotional Regulation When Challenged",
      "source": "clinician_direct_observation",
      "observation": "When presented with police report's contradictory account (patient was aggressor, not victim of assault), patient did not become defensive or angry. Acknowledged police perspective but maintained his account. Stated: 'That's what they saw. But I know what happened.'",
      "clinicalSignificance": "Ability to handle contradiction without emotional escalation suggests some capacity for emotional regulation, at least in formal setting with authority figure."
    },
    {
      "topic": "Effort During Competency Assessment",
      "source": "clinician_direct_observation",
      "observation": "Patient engaged throughout competency questions. Answered fully, thought through questions before responding. Demonstrated understanding of Dusky prongs without prompting.",
      "clinicalSignificance": "Good effort and engagement suggest assessment is reliable; not a case of patient 'putting on a show' in obvious way."
    },
    {
      "topic": "Thought Content: Paranoid Ideation",
      "source": "clinician_direct_observation",
      "observation": "Patient expressed belief that the other man 'was looking for a fight' and 'wanted me to throw the first punch so he could claim I started it.' When asked if this was speculation or if he had evidence, patient said 'He kept bumping into me, eyeing me.' Did not evidence belief that there was a conspiracy or that people in general are out to get him—isolated to this specific incident.",
      "clinicalSignificance": "No evidence of generalized paranoid ideation. Attribution of hostile intent to one individual in context of physical confrontation is not necessarily pathological."
    }
  ]
}
```

### Eval-Type-Specific Structured Data Forms

Some evaluation types require specific structured data collection. These are in addition to the MSE and narrative notes:

#### CST: Dusky Competency Assessment Form

```json
{
  "evalType": "CST",
  "sessionNumber": 1,
  "duskyAssessment": {
    "prong1_FactualUnderstanding": {
      "criterion": "Defendant has rational and factual understanding of the proceedings against him and the possible penalties.",
      "understandsCharges": {
        "result": "Yes",
        "evidence": "Patient correctly states charges: 'Assault in the second degree and menacing.' Knows these are felonies. Understands victim's role.",
        "assessment": "Adequate"
      },
      "understandsPenalties": {
        "result": "Yes",
        "evidence": "When asked maximum penalty, stated 'probably like 5 to 10 years?' (actual is 8 years for assault 2). Understands seriousness.",
        "assessment": "Adequate"
      },
      "understandsTrialProcess": {
        "result": "Yes",
        "evidence": "Can explain: jury hears evidence, prosecution and defense present cases, judge gives instructions, jury decides guilty/not guilty, sentencing happens if guilty.",
        "assessment": "Adequate"
      },
      "clinicianConclusion": "Prong 1: ADEQUATE. Patient demonstrates factual understanding of charges, penalties, and trial process."
    },
    "prong2_RationalUnderstanding": {
      "criterion": "Defendant has sufficient present ability to consult with his lawyer with a reasonable degree of rational understanding of the proceedings against him.",
      "understandsAttorneyRole": {
        "result": "Yes",
        "evidence": "States: 'My attorney helps me defend myself, tells me my options, and is supposed to help me get the best outcome.'",
        "assessment": "Adequate"
      },
      "canCommunicateWithAttorney": {
        "result": "Yes",
        "evidence": "Reports regular communication with attorney (weekly meetings, phone calls). Follows attorney's advice.",
        "assessment": "Adequate"
      },
      "understandsConfidentiality": {
        "result": "Yes",
        "evidence": "Knows what he tells attorney is private and cannot be used against him (with exception of disclosure of plans to harm).",
        "assessment": "Adequate"
      },
      "canDiscussStrategy": {
        "result": "Yes",
        "evidence": "When given hypothetical about testifying vs. not testifying, patient could discuss pros and cons. Deferred to attorney's recommendation but showed understanding.",
        "assessment": "Adequate"
      },
      "clinicianConclusion": "Prong 2: ADEQUATE. Patient has rational understanding and can consult meaningfully with counsel."
    },
    "prong2b_AssistInDefense": {
      "criterion": "Defendant has sufficient present ability to assist in preparation of his defense.",
      "canRecallIncident": {
        "result": "Yes",
        "evidence": "Provides detailed, consistent account of incident. Can place it in timeline.",
        "assessment": "Adequate"
      },
      "canIdentifyWitnesses": {
        "result": "Yes",
        "evidence": "Names three companions present at scene. Can describe their roles.",
        "assessment": "Adequate"
      },
      "canReassonAboutDefense": {
        "result": "Yes",
        "evidence": "When asked about possible defenses (self-defense, mistaken identity, etc.), can discuss applicability to his case.",
        "assessment": "Adequate"
      },
      "clinicianConclusion": "Prong 2b: ADEQUATE. Patient can assist in preparation of defense."
    },
    "overallCompetencyOpinion": "COMPETENT TO STAND TRIAL. Patient meets Dusky criteria on both prongs.",
    "disclaimer": "This assessment is based on a single interview and testing. Competency is not a static state—patient's status can change if circumstances change (medication changes, acute mental health event, etc.). This assessment reflects competency at this moment in time."
  }
}
```

#### Custody: Parent-Child Interaction Observation

```json
{
  "evalType": "Custody",
  "sessionNumber": 1,
  "parentChildInteraction": {
    "childPresent": true,
    "childAge": 7,
    "durationOfObservation": "20 minutes",
    "settingDescription": "Unstructured play situation. Child given access to toys. Parent instructed to interact as they normally would.",
    "observations": [
      {
        "dimension": "Parent's Responsiveness",
        "observation": "Parent notices when child attempts to show her a toy, makes eye contact, asks follow-up questions. Responds to child's requests for help without delay.",
        "rating": "High"
      },
      {
        "dimension": "Parent's Boundary-Setting",
        "observation": "When child tried to climb on a table, parent gently redirected: 'We don't climb on furniture. Let's find something fun to do on the floor.' Did not use harsh tone or repeated corrections.",
        "rating": "Appropriate"
      },
      {
        "dimension": "Child's Attachment Behavior",
        "observation": "Child frequently looks back at parent while playing, occasionally brings toys to share, seeks parent's approval. When parent stepped to the side briefly, child noticed and called out 'Mommy, watch this!'",
        "rating": "Secure attachment pattern"
      },
      {
        "dimension": "Parent's Emotional Warmth",
        "observation": "Parent smiles, laughs at child's jokes, uses warm tone of voice. Shows physical affection (hugs, pats on back).",
        "rating": "High"
      }
    ],
    "clinicalConclusion": "Parent demonstrates appropriate parenting behaviors during observation. Child shows secure attachment. No concerns identified based on this interaction."
  }
}
```

#### Risk Assessment: HCR-20 Item Exploration

```json
{
  "evalType": "ViolenceRiskAssessment",
  "sessionNumber": 1,
  "hcr20Exploration": {
    "historicalItems": [
      {
        "item": "H1: Previous violence",
        "rating": "Present",
        "evidence": [
          "Prior arrest for assault 2001 (domestic violence incident)",
          "Multiple bar fights reported by collateral contacts",
          "Current charges involve physical violence"
        ],
        "interviewData": "When asked about prior violence, patient minimizes: 'That was a long time ago. I've calmed down.' Denies pattern but acknowledges 'I've had fights.'"
      },
      {
        "item": "H2: Age at first violent incident",
        "rating": "Age 25 (current age 34)",
        "evidence": "First documented violent incident when patient was 25 years old"
      },
      {
        "item": "H3: Relationship instability",
        "rating": "Present",
        "evidence": [
          "Multiple breakups, each lasting 1-2 years",
          "Current relationship status: dating, no committed relationship",
          "Prior history of conflict with romantic partners (per collateral)"
        ]
      }
    ],
    "clinicalItems": [
      {
        "item": "C1: Lack of insight",
        "rating": "Moderate concern",
        "evidence": "Patient attributes incident to other man's aggression and 'looking for a fight.' Minimizes his own role and prior violence. Some defensive ideation."
      },
      {
        "item": "C2: Negative attitudes",
        "rating": "Moderate concern",
        "evidence": "MMPI-3 shows elevations on scales suggesting anger, antisocial attitudes. Interview reveals cynical view of others, belief that people are 'always trying to take advantage.' States 'most people are fake.'"
      },
      {
        "item": "C3: Active symptoms of mental illness",
        "rating": "Not present",
        "evidence": "No active psychotic symptoms, suicidal/homicidal ideation, or acute mood disturbance"
      },
      {
        "item": "C4: Impulsivity",
        "rating": "Present",
        "evidence": [
          "History of bar fights suggests reactive aggression",
          "Quick escalation from verbal to physical confrontation",
          "Limited evidence of thinking through consequences before acting"
        ],
        "interviewData": "When asked how he handles anger, states: 'I just react. I don't think about it.' Acknowledges this is a problem."
      }
    ],
    "riskItems": [
      {
        "item": "R1: Plans for future violence",
        "rating": "Not identified",
        "evidence": "No statements suggesting plans to harm others. No identified target."
      },
      {
        "item": "R2: Exposure to destabilizers",
        "rating": "Present",
        "evidence": [
          "Incarceration pending trial",
          "Potential loss of employment, housing, relationships",
          "If convicted, lengthy prison sentence",
          "These are significant stressors that could increase risk"
        ]
      }
    ]
  }
}
```

---

## Step 2.4: Collateral Interviews

### Purpose

Collateral contacts provide independent perspectives on the patient's history, functioning, and behavior. They serve to:

- Corroborate or contradict patient self-report
- Provide observations of patient's behavior in natural settings (not clinical setting)
- Clarify timeline and context
- Identify patterns or concerns the patient may not have reported

### Who to Contact

The clinician decides who to contact based on the evaluation type and case circumstances:

**Typical Collateral Contacts:**

- **Attorney** (in forensic cases) — provides legal context, observation of defendant's courtroom demeanor
- **Family members** (parent, spouse, sibling) — observation of patient across lifespan, family history corroboration
- **Treatment providers** (psychiatrist, therapist, physician) — prior diagnosis, medication history, response to treatment
- **Employers** — work behavior, reliability, interpersonal functioning
- **Teachers** (in child/adolescent evals) — school behavior, learning, peer relationships
- **Probation officer** (in forensic cases) — recent behavior, compliance with conditions
- **Prior evaluators** (if previous psychological eval) — prior testing, diagnosed conditions, recommendations

### Documentation Process

For each collateral contact:

```json
{
  "collateralInterviewId": "session_003_defense_counsel",
  "contactedParty": "Sarah Mitchell, Esq.",
  "relationship": "Defense Attorney",
  "contactMethod": "Phone",
  "contactDate": "2026-03-21",
  "contactTime": "14:30",
  "durationMinutes": 25,
  "clinicianNotes": "Attorney reported that defendant is following legal advice, complying with no-contact order, attending all court dates. Described defendant as 'engaged and willing to help with his defense.' Attorney noted defendant was visibly emotional during last appearance but this was appropriate given severity of charges.",
  "informationObtained": [
    {
      "topic": "Defendant's Legal Understanding",
      "report": "Attorney confirmed defendant demonstrates understanding of charges, potential penalties, and trial process. Attorney states defendant can discuss defense strategy coherently."
    },
    {
      "topic": "Defendant's Compliance",
      "report": "No violations of bail conditions. Defendant has made all court appearances. Has been compliant with no-contact order."
    },
    {
      "topic": "Defendant's Demeanor",
      "report": "Attorney observed defendant was calm and rational during meetings. Emotional response to legal situation was appropriate."
    }
  ],
  "discrepancies": [
    {
      "topic": "Prior Criminal History",
      "patientReport": "Told evaluator he had 'one previous incident from a long time ago'",
      "collateralReport": "Attorney reviewed criminal history: assault 2001, disorderly conduct 2005, assault 2008, current charges. Three prior incidents, not one.",
      "note": "Patient significantly minimized prior criminal history."
    }
  ],
  "consentAndConfidentiality": {
    "patientConsentObtained": true,
    "consentDate": "2026-03-20",
    "consentMethod": "Verbal consent during intake interview. Attorney's status in criminal case implies consent for communication.",
    "privacyLimits": "Discussed with attorney that information would be included in evaluation report filed with court (public record in criminal case)"
  }
}
```

### Storage Location

Each collateral interview stored in: `interviews/collateral_interviews/session_NNN_contact_name/notes.json`

Example:
- `interviews/collateral_interviews/session_003_defense_counsel/notes.json`
- `interviews/collateral_interviews/session_004_mother/notes.json`
- `interviews/collateral_interviews/session_005_psychiatrist_smith/notes.json`

### Collateral Interview Index

When multiple collateral interviews occur, an index is maintained:

```json
{
  "collateralInterviewIndex": [
    {
      "sessionId": "session_003",
      "contactName": "Sarah Mitchell, Esq.",
      "relationship": "Defense Attorney",
      "contactDate": "2026-03-21",
      "durationMinutes": 25,
      "keyFindings": "Corroborated legal understanding; noted minimization of prior criminal history"
    },
    {
      "sessionId": "session_004",
      "contactName": "Patricia Johnson (mother)",
      "relationship": "Mother",
      "contactDate": "2026-03-22",
      "durationMinutes": 35,
      "keyFindings": "Confirms childhood psychiatric history; reports ongoing anger issues; notes improvement with prior medication"
    }
  ]
}
```

---

## Step 2.5: Behavioral Observation Integration

### Ingestor Agent Extraction from Transcript

If a transcript is available (from Whisper), the clinician can invoke the Ingestor Agent to extract behavioral observations automatically.

**Process:**

1. Clinician opens Interview section, clicks "Extract Behavioral Observations" on a session with transcript
2. App takes the transcript text and the session notes (MSE + narrative)
3. **UNID Redaction Point:** Transcript and notes sent through redaction pipeline (fresh UNIDs)
4. Redacted transcript sent to **Ingestor Agent** with instructions:
   - Extract observable behaviors from the transcript (speech patterns, tone, pause length, etc.)
   - Match them to MSE categories (affect, speech, thought process)
   - Explicitly label as "transcript-derived"
   - Compare extracted observations to clinician's direct MSE observations
   - Flag any contradictions
5. Ingestor returns structured observation data with re-hydrated PHI
6. Clinician reviews extracted observations, can edit or approve

### Clinician Review & Verification

The extracted observations are stored as **draft** and require clinician review:

```json
{
  "behavioralObservations": [
    {
      "topic": "Speech Rate During Incident Discussion",
      "source": "transcript-derived (Ingestor Agent extraction)",
      "extractedObservation": "Speech rate increased from baseline ~120 words/minute to ~140 words/minute when discussing the fight. Pauses decreased from 1-2 second pauses to near-continuous speech.",
      "supportingEvidence": "Transcript shows longer utterances and fewer pause markers when transitioning from family history to incident narrative.",
      "clinicianReview": {
        "status": "approved",
        "clinicianNotes": "I noticed this during the interview. He did speed up noticeably when talking about the fight. Consistent with my direct observation."
      }
    },
    {
      "topic": "Affect Congruence During Incident Narrative",
      "source": "transcript-derived (Ingestor Agent extraction)",
      "extractedObservation": "Emotional tone does not match content. When describing being 'attacked,' patient's voice remains flat and calm. No exclamation marks or emphatic language.",
      "supportingEvidence": "Transcript shows: 'He just came at me. I defended myself. Nothing special about it.' (flat, matter-of-fact tone for describing a violent assault)",
      "clinicianReview": {
        "status": "needs_revision",
        "clinicianNotes": "The extraction is technically correct about the transcript, but I didn't notice this in real-time. I observed him as emotionally engaged. The transcript might be missing vocal tone cues. I'm not changing this extraction—it's what the transcript shows—but I'm noting my direct observation supersedes this: Patient appeared engaged and showed emotional response when discussing the incident in person."
      }
    }
  ]
}
```

### Behavioral Observation Summary

Once all sessions are complete, a summary is generated:

```json
{
  "behavioralObservationSummary": {
    "totalSessions": 2,
    "sourcesOfObservations": [
      "clinician_direct_observation (MSE from both sessions)",
      "transcript-derived (Whisper transcript from session 1)"
    ],
    "keyBehavioralThemes": [
      {
        "theme": "Emotional Regulation",
        "observations": [
          "Patient remained calm when confronted with police report contradicting his account",
          "Speech rate increased when discussing incident, but patient did not become agitated",
          "No outbursts or loss of emotional control observed"
        ],
        "clinicalSignificance": "Suggests capacity for emotional regulation in formal setting"
      },
      {
        "theme": "Thought Organization",
        "observations": [
          "Incident narrative consistent across two tellings, 20 minutes apart",
          "Responses follow logically from questions",
          "No tangentiality or looseness of associations"
        ],
        "clinicalSignificance": "No evidence of disorganized thinking"
      },
      {
        "theme": "Minimization Pattern",
        "observations": [
          "Minimized role in fight ('I just defended myself')",
          "Minimized prior psychiatric history ('just observation')",
          "Minimized prior violence history (said 'one incident long ago' when records show three)"
        ],
        "clinicalSignificance": "Pattern of minimization may reflect defensive posture or poor insight into own behavior"
      }
    ]
  }
}
```

---

## Step 2.6: Advancement to Diagnostics

### Validation

Before the case advances to Diagnostics, the application validates:

1. **At least one clinical interview session is documented** — a session with session metadata, MSE, and notes exists
2. **Interview documentation is reasonably complete** — MSE has been filled out for at least one session
3. **Clinician confirms readiness** — clinician explicitly clicks "Advance to Diagnostics"

### What Happens on Advancement

1. App validates conditions above
2. App creates `diagnostics/` directory on disk
3. Case status changes to **Diagnostics** (orange)
4. Audit trail logs: "Case advanced to Diagnostics. Sessions: [count]. Total hours: [sum of session durations]. Collateral contacts: [count]."
5. Clinician is now ready to formulate diagnoses based on complete data: intake/biopsychosocial, test battery, interview observations, collateral information

---

## Step 2.7: Error Handling & Edge Cases

### Patient Doesn't Show for Interview

**Scenario:** Clinician had scheduled interview; patient failed to appear.

**What the Clinician Does:**
1. Creates a session record but marks it as "No-show"
2. Documents the absence and attempt to reschedule
3. Can continue to collect collateral information
4. Can continue reviewing test data

**Application Behavior:**
- Session record shows status "No-show"
- The case cannot advance to Diagnostics without at least one completed interview session
- Clinician can document "Awaiting completed interview" in case notes
- The case stays in Interview stage

### Patient Becomes Agitated or Unsafe During Interview

**Scenario:** Patient becomes angry, threatens harm, or becomes physically aggressive during interview.

**What the Clinician Does:**
1. Ends the session immediately
2. Documents what happened, when, and how it was managed
3. Implements safety protocols (calling security, ending session, etc.)
4. May decide to continue evaluation in future session or discontinue

**Application Behavior:**
- Clinician can document incident in session notes
- Session is marked with status flag "Terminated Early" or "Safety Incident"
- MSE and other structured data may be incomplete for that session
- Clinician notes explain reason

### Collateral Contact Refuses to Speak

**Scenario:** Clinician attempts to contact a family member or other collateral; the person declines to participate.

**What the Clinician Does:**
1. Documents the attempted contact and reason for refusal
2. May note: "Mother declined to speak due to ongoing family conflict" or "Teacher unavailable; will contact next week"
3. Proceeds with case using available information

**Application Behavior:**
- Collateral interview record created with status "Refused" or "Unavailable"
- No notes captured for that contact
- Clinician can document attempted contact and outcome
- Case can still advance when clinical interview is complete

### Audio Recording Failure

**Scenario:** Clinician started recording but the file was corrupted or lost.

**What the Clinician Does:**
1. Conducts interview normally
2. Takes notes without transcript
3. MSE and narrative notes are complete
4. Session proceeds without transcript data

**Application Behavior:**
- Session metadata shows `audioRecorded: false`
- `transcriptAvailable: false`
- No Whisper transcription available
- Behavioral observations are clinician direct observation only
- Case proceeds normally

### Whisper Transcription Error

**Scenario:** Whisper transcription is produced but contains significant errors (audio quality poor, background noise, unclear speech).

**What the Clinician Does:**
1. Reviews the transcript for accuracy
2. Edits errors directly in the transcript editor
3. Can re-run Whisper if desired (available in UI)
4. Approves final transcript when satisfied

**Application Behavior:**
- Transcript is editable by clinician
- Transcription confidence score (if available from Whisper) can be displayed
- Clinician can mark sections as "edited for accuracy"
- If clinician decides transcript is unreliable, can delete it and rely on manual notes instead

### Multiple Interview Sessions Across Different Dates

**Scenario:** Clinician conducts three interview sessions over two weeks (due to patient availability or need for additional exploration).

**What the Clinician Does:**
1. Creates session_001, session_002, session_003 directories as each occurs
2. Completes MSE and notes for each session
3. Each session has its own metadata, MSE, and notes

**Application Behavior:**
- File tree shows all sessions under Interviews
- `interview_summary.json` aggregates: total sessions (3), total hours (e.g., 4.5), date range (e.g., 3/20/2026 - 3/28/2026)
- Advance to Diagnostics shows total session count in audit trail
- Ingestor's prep sheet for later sessions includes findings from prior sessions for context

---

## Step 2.8: IPC Contracts (Electron ↔ Python Sidecar)

### New IPC Channels for Interview Stage

```typescript
// Create a new interview session directory
ipcMain.handle('interview:createSession', async (event, {
  caseNumber: string,
  sessionType: 'clinical_interview' | 'collateral_interview',
  sessionDate: string,        // YYYY-MM-DD
  participantRoles: Array<{ role: string, name: string }>
}) => Promise<{
  sessionId: string,          // e.g., "session_001"
  directoryPath: string,      // Full path to interviews/session_NNN/
  created: string[]           // Files created: ["notes.json", "mental_status.json"]
}>);

// Process audio for Whisper transcription
ipcMain.handle('interview:transcribeAudio', async (event, {
  caseNumber: string,
  sessionId: string,
  audioPath: string           // Path to local audio file
}) => Promise<{
  transcriptPath: string,     // Path to interviews/session_NNN/transcript.vtt
  duration: number,           // Audio duration in seconds
  wordCount: number,          // Approximate word count
  confidenceScore?: number    // Optional: Whisper confidence
}>);

// Extract behavioral observations from transcript via Ingestor
ipcMain.handle('interview:extractBehavioralObservations', async (event, {
  caseNumber: string,
  sessionId: string,
  transcriptPath: string
}) => Promise<{
  observations: Array<{
    topic: string,
    source: string,           // "transcript-derived"
    observation: string,
    evidence: string
  }>,
  statusRequiringReview: boolean  // If behavioral observations conflict with clinician notes
}>);

// Save session MSE data
ipcMain.handle('interview:saveMSE', async (event, {
  caseNumber: string,
  sessionId: string,
  mseData: object            // Full MSE object
}) => Promise<{ saved: boolean, path: string }>);

// Save session notes
ipcMain.handle('interview:saveNotes', async (event, {
  caseNumber: string,
  sessionId: string,
  notes: object              // Notes object with narrative and metadata
}) => Promise<{ saved: boolean, path: string }>);

// Generate session prep sheet
ipcMain.handle('interview:generatePrepSheet', async (event, {
  caseNumber: string,
  sessionNumber?: number     // Optional; if omitted, generates for next session
}) => Promise<{
  prepSheet: object,
  path: string               // interviews/session_NNN/prep_sheet.json
}>);

// Record collateral interview
ipcMain.handle('interview:saveCollateralContact', async (event, {
  caseNumber: string,
  contactName: string,
  relationship: string,
  contactMethod: 'phone' | 'in_person' | 'email',
  notes: object
}) => Promise<{
  sessionId: string,
  directoryPath: string
}>);

// List all interview sessions for a case
ipcMain.handle('interview:listSessions', async (event, {
  caseNumber: string
}) => Promise<Array<{
  sessionId: string,
  sessionNumber: number,
  sessionDate: string,
  type: string,
  durationMinutes?: number,
  mseComplete: boolean,
  transcriptAvailable: boolean
}>>);

// Advance case from Interview to Diagnostics
ipcMain.handle('interview:advanceToDiagnostics', async (event, {
  caseNumber: string
}) => Promise<{
  success: boolean,
  message: string,
  caseStatus: string,        // Should be "Diagnostics"
  directoryCreated: boolean
}>);
```

---

## Step 2.9: Data Model — Session Tables in SQLCipher

### `interview_sessions` Table

```sql
CREATE TABLE interview_sessions (
  sessionId TEXT PRIMARY KEY,
  caseNumber TEXT NOT NULL,
  sessionNumber INTEGER NOT NULL,
  sessionDate DATE NOT NULL,
  sessionType TEXT NOT NULL,  -- 'clinical_interview', 'collateral_interview'
  startTime TIME,
  endTime TIME,
  durationMinutes INTEGER,
  location TEXT,

  -- Metadata
  audioRecorded BOOLEAN DEFAULT FALSE,
  transcriptPath TEXT,
  prepSheetPath TEXT,

  -- Completion status
  mseComplete BOOLEAN DEFAULT FALSE,
  notesComplete BOOLEAN DEFAULT FALSE,
  statusFlag TEXT,  -- 'completed', 'no_show', 'terminated_early', 'pending'

  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY(caseNumber) REFERENCES cases(caseNumber)
);
```

### `session_participants` Table

```sql
CREATE TABLE session_participants (
  participantId TEXT PRIMARY KEY,
  sessionId TEXT NOT NULL,
  caseNumber TEXT NOT NULL,
  role TEXT NOT NULL,  -- 'patient', 'clinician', 'collateral_contact', 'observer'
  name TEXT NOT NULL,
  relationship TEXT,  -- e.g., 'mother', 'defense attorney', 'therapist'
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY(sessionId) REFERENCES interview_sessions(sessionId),
  FOREIGN KEY(caseNumber) REFERENCES cases(caseNumber)
);
```

### `mental_status_examination` Table

```sql
CREATE TABLE mental_status_examination (
  mseId TEXT PRIMARY KEY,
  caseNumber TEXT NOT NULL,
  sessionId TEXT NOT NULL,

  -- MSE fields
  appearance TEXT,
  behavior TEXT,
  speech TEXT,
  mood TEXT,
  affect TEXT,
  thoughtProcess TEXT,
  thoughtContent TEXT,
  perception TEXT,
  cognition TEXT,
  insight TEXT,
  judgment TEXT,

  -- Scores/ratings
  cognitiveScreeningScore INTEGER,  -- Optional: MMSE, MoCA, etc.
  orientationX3 BOOLEAN,  -- Person, place, time

  -- Metadata
  completedAt TIMESTAMP,
  clinicianNotes TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY(caseNumber) REFERENCES cases(caseNumber),
  FOREIGN KEY(sessionId) REFERENCES interview_sessions(sessionId)
);
```

### `collateral_interviews` Table

```sql
CREATE TABLE collateral_interviews (
  collateralId TEXT PRIMARY KEY,
  caseNumber TEXT NOT NULL,
  sessionId TEXT NOT NULL,

  contactName TEXT NOT NULL,
  relationship TEXT NOT NULL,  -- 'mother', 'attorney', 'therapist', etc.
  contactMethod TEXT NOT NULL,  -- 'phone', 'in_person', 'email'
  contactDate DATE NOT NULL,
  contactTime TIME,
  durationMinutes INTEGER,

  -- Outcome
  status TEXT NOT NULL,  -- 'completed', 'refused', 'unavailable', 'pending'
  reasonForNoncompletion TEXT,

  -- Consent & confidentiality
  patientConsentObtained BOOLEAN DEFAULT TRUE,
  informationSharedWithCollateral TEXT,  -- e.g., "Report will be filed with court"

  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY(caseNumber) REFERENCES cases(caseNumber),
  FOREIGN KEY(sessionId) REFERENCES interview_sessions(sessionId)
);
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-03-22 | Initial production specification. Complete Stage 2 workflow including session prep, clinical interviews, MSE documentation, collateral interviews, behavioral observation integration, and advancement to Diagnostics. |

---

## Related Documents

| Document | Purpose |
|----------|---------|
| Doc 18: Case Lifecycle Spec | Full lifecycle context; Stage 2 section provides high-level overview |
| Doc 16: Case Directory Schema | Directory structure for `interviews/` subdirectory |
| Doc 15: UNID Redaction Architecture | Redaction pipelines for session prep (Ingestor) and behavioral extraction |
| Doc 03: Agent Prompt Specs | Ingestor Agent specifications for behavioral extraction and completeness flagging |
| Doc 02: IPC Contracts | Electron-Python communication; new channels for interview operations |
| Doc 14: Pipeline Architecture Addendum | Stage 2 UI and visual presentation |

