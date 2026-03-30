import { useState } from 'react'

export interface EvalReportTabProps {
  readonly caseId: number
}

export default function EvalReportTab({ caseId }: EvalReportTabProps): React.JSX.Element {
  return (
    <div
      style={{
        background: 'var(--panel)',
        minHeight: '100%',
        paddingBottom: 40,
        overflowY: 'auto',
      }}
    >
      {/* OnlyOffice-style ruler */}
      <div
        className="oo-ruler"
        style={{
          maxWidth: 860,
          margin: '0 auto',
          height: 20,
          background: 'var(--panel)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'flex-end',
          padding: '0 22px',
          fontSize: 9,
          color: 'var(--text-secondary)',
          fontFamily: "'JetBrains Mono', monospace",
        }}
      >
        <span style={{ flex: 1, textAlign: 'center' }}>1</span>
        <span style={{ flex: 1, textAlign: 'center' }}>2</span>
        <span style={{ flex: 1, textAlign: 'center' }}>3</span>
        <span style={{ flex: 1, textAlign: 'center' }}>4</span>
        <span style={{ flex: 1, textAlign: 'center' }}>5</span>
        <span style={{ flex: 1, textAlign: 'center' }}>6</span>
        <span style={{ flex: 1, textAlign: 'center' }}>7</span>
        <span style={{ flex: 1, textAlign: 'center' }}>8</span>
      </div>

      {/* Word toolbar */}
      <WordToolbar />

      {/* Document editor */}
      <div className="document-editor">
        <p
          style={{
            textAlign: 'center',
            textTransform: 'uppercase',
            fontWeight: 'bold',
            fontSize: 14,
            marginBottom: 8,
          }}
        >
          CONFIDENTIAL FORENSIC EVALUATION REPORT
        </p>
        <p
          style={{
            textAlign: 'center',
            textTransform: 'uppercase',
            fontWeight: 'bold',
            fontSize: 14,
            marginBottom: 30,
          }}
        >
          COMPETENCY TO STAND TRIAL EVALUATION
        </p>

        <p style={{ marginBottom: 12 }}>
          <strong>Evaluator:</strong> Truck Irwin, Psy.D., ABPP (Forensic Psychology)
          <br />
          <strong>License:</strong> CO-PSY-12847
          <br />
          <strong>Date of Report:</strong> March 19, 2026
        </p>

        <p style={{ marginTop: 24, marginBottom: 12 }}>
          <strong>IDENTIFYING INFORMATION</strong>
        </p>
        <p style={{ marginBottom: 6 }}>
          <strong>Name:</strong> Marcus D. Johnson
          <br />
          <strong>Date of Birth:</strong> June 14, 1991
          <br />
          <strong>Age:</strong> 34 years
          <br />
          <strong>Gender:</strong> Male
          <br />
          <strong>Ethnicity:</strong> African American
          <br />
          <strong>Education:</strong> 11th grade (no diploma)
          <br />
          <strong>Marital Status:</strong> Single
          <br />
          <strong>Current Location:</strong> Denver County Jail
          <br />
          <strong>Case Number:</strong> 2025CR-4821
          <br />
          <strong>Charges:</strong> Assault in the First Degree (F3), Criminal Mischief (M1)
        </p>

        <p style={{ marginTop: 20, marginBottom: 12 }}>
          <strong>REFERRAL INFORMATION</strong>
        </p>
        <p>
          Mr. Johnson was referred for a competency to stand trial evaluation by the Honorable
          Judge Patricia Morales, Denver District Court, Division 3, pursuant to C.R.S. §
          16-8.5-101. The court order, dated February 28, 2026, requests assessment of the
          defendant's competency to proceed to trial.
        </p>

        <p style={{ marginTop: 20, marginBottom: 12 }}>
          <strong>NOTIFICATION AND CONSENT</strong>
        </p>
        <p>
          Mr. Johnson was advised that the purpose of this evaluation is not therapeutic. He was
          informed that this evaluation is being conducted for the court, that I am not his
          treating clinician, and that my report will be provided to the court and shared with
          prosecution and defense. He was advised that communications made during this evaluation
          are not protected by clinician-patient privilege and can be disclosed to the court. Mr.
          Johnson acknowledged understanding of these limitations and agreed to proceed.
        </p>

        <p style={{ marginTop: 20, marginBottom: 12 }}>
          <strong>SOURCES OF INFORMATION</strong>
        </p>
        <ol style={{ paddingLeft: 20, marginBottom: 12 }}>
          <li>
            Clinical interview with Mr. Johnson (3 sessions, 6.5 total hours)
            <ul style={{ paddingLeft: 20, marginTop: 6 }}>
              <li>Session 1: March 8, 2026 (2.5 hours)</li>
              <li>Session 2: March 10, 2026 (2.0 hours)</li>
              <li>Session 3: March 12, 2026 (2.0 hours)</li>
            </ul>
          </li>
          <li>
            Psychological Testing:
            <ul style={{ paddingLeft: 20, marginTop: 6 }}>
              <li>Minnesota Multiphasic Personality Inventory-3 (MMPI-3)</li>
              <li>Personality Assessment Inventory (PAI)</li>
              <li>Wechsler Adult Intelligence Scale, Fifth Edition (WAIS-V)</li>
              <li>Test of Memory Malingering (TOMM)</li>
              <li>Structured Interview of Reported Symptoms, 2nd Edition (SIRS-2)</li>
            </ul>
          </li>
          <li>
            Records Reviewed:
            <ul style={{ paddingLeft: 20, marginTop: 6 }}>
              <li>Court Order for Competency Evaluation (Feb 28, 2026)</li>
              <li>Police Report, Incident #2025-DPD-48721</li>
              <li>Denver Health Medical Center records (June 2024 – January 2025)</li>
              <li>Denver County Jail medical records (February – March 2026)</li>
              <li>Prior Competency Evaluation by Robert Smith, Ph.D. (2023)</li>
            </ul>
          </li>
        </ol>

        <AIDraftSection>
          <p style={{ marginBottom: 8 }}>
            <strong>RELEVANT BACKGROUND HISTORY</strong>
          </p>
          <p>
            Mr. Johnson is a 34-year-old African American male with an 11th-grade education,
            currently incarcerated at Denver County Jail pending trial. He reports a history of
            intermittent homelessness and unstable housing over the past 3-4 years. Employment
            history is sporadic, with most recent employment ending approximately two years ago
            when Mr. Johnson stopped working due to what he describes as "people interfering with
            my work."
          </p>
          <p style={{ marginTop: 8 }}>
            Psychiatric history is significant for first hospitalization in June 2024 at Denver
            Health Medical Center following police contact during an episode of acute psychosis.
            He was diagnosed at that time with Unspecified Psychotic Disorder and started on
            Risperidone 2mg daily. Mr. Johnson had a second hospitalization in September 2024
            after discontinuing medication, and a third hospitalization in January 2025 following
            his arrest for the current charges.
          </p>
          <p style={{ marginTop: 8 }}>
            Mr. Johnson's substance use history includes occasional marijuana use in his 20s, but
            he denies current substance abuse. He reports no significant medical history beyond
            the psychiatric illnesses noted above. Family psychiatric history is unknown.
          </p>
        </AIDraftSection>

        <p style={{ marginTop: 20, marginBottom: 12 }}>
          <strong>BEHAVIORAL OBSERVATIONS</strong>
        </p>
        <p>
          Mr. Johnson presented as a thin, 34-year-old African American male appearing his stated
          age. He was neatly dressed in jail clothing but somewhat disheveled in appearance.
          Speech was normal in rate and volume but occasionally pressured, with frequent
          tangential comments related to persecutory concerns. Affect was constricted with limited
          emotional range. Eye contact was poor, with occasional suspiciousness observed during
          the evaluation.
        </p>
        <p style={{ marginTop: 8 }}>
          Throughout all three sessions, Mr. Johnson endorsed auditory hallucinations ("hearing
          voices") and persecutory delusions (beliefs that people are conspiring against him,
          using technology to monitor him). His thought process was linear but interrupted by
          preoccupation with these paranoid themes. Most notably, Mr. Johnson demonstrated limited
          insight into his mental illness, attributing his symptoms to external persecution rather
          than internal mental health processes.
        </p>

        <p style={{ marginTop: 20, marginBottom: 12 }}>
          <strong>ASSESSMENT RESULTS</strong>
        </p>
        <p style={{ marginTop: 12, marginBottom: 8 }}>
          <strong>Validity and Effort Testing</strong>
        </p>
        <p>
          Mr. Johnson's performance on effort tests was entirely adequate. TOMM Trial 2 score of
          48/50 (above the cut-score of 45) and SIRS-2 results showing honest responding across
          all eight scales confirm genuine effort and absence of malingering. These results
          indicate that his performance on personality and cognitive testing reflects genuine
          functioning rather than intentional poor performance or symptom exaggeration.
        </p>

        <p style={{ marginTop: 12, marginBottom: 8 }}>
          <strong>Cognitive Functioning (WAIS-V)</strong>
        </p>
        <p>
          Mr. Johnson's WAIS-V composite scores indicate low-average intellectual functioning
          (FSIQ=82, 12th percentile). Notable weaknesses in verbal comprehension (VCI=78, 7th
          percentile) and working memory (WMI=80, 9th percentile) relative to visual-spatial
          abilities (VSI=88, 21st percentile). These cognitive limitations are relevant to his
          ability to understand complex legal concepts and instructions.
        </p>

        <p style={{ marginTop: 12, marginBottom: 8 }}>
          <strong>Personality and Psychopathology (MMPI-3)</strong>
        </p>
        <p>
          Mr. Johnson's MMPI-3 profile shows significant elevations on THD (75T — Thought
          Dysfunction), RC6 (72T — Ideas of Persecution), and RC8 (78T — Aberrant Experiences).
          All validity scales are within acceptable limits. This pattern is consistent with a
          primary psychotic disorder with prominent thought disturbance and persecutory ideation.
          No evidence of malingering or defensive responding.
        </p>

        <p style={{ marginTop: 12, marginBottom: 8 }}>
          <strong>Personality and Psychopathology (PAI)</strong>
        </p>
        <p>
          The PAI corroborates MMPI-3 findings. Mr. Johnson shows elevated SCZ (72T) and PAR
          (68T) scales, consistent with schizophrenia-spectrum disorder with persecutory
          features. Treatment scales show openness to treatment (RXR=42T, well below the
          elevation threshold), and no current suicidality (SUI=48T).
        </p>

        <AIDraftSection>
          <p style={{ marginBottom: 8 }}>
            <strong>CLINICAL FORMULATION</strong>
          </p>
          <p>
            Results of the current evaluation are consistent with a diagnosis of Schizophrenia,
            First Episode, Currently in Acute Episode. Onset appears to have occurred in June
            2024 (first hospitalization). The constellation of psychotic symptoms (auditory
            hallucinations, persecutory delusions), thought disturbance (elevated THD and RC8 on
            MMPI-3, elevated SCZ on PAI), and poor insight into illness are all consistent with
            schizophrenia.
          </p>
          <p style={{ marginTop: 8 }}>
            The patient's symptom presentation in the clinical interview aligns with test
            findings. His endorsed auditory hallucinations and persecutory ideation match his
            MMPI-3 RC8 and RC6 elevations and PAI SCZ and PAR elevations. His low-average
            cognitive functioning (FSIQ=82) and notable verbal weakness (VCI=78) must be
            considered in the context of his competency assessment.
          </p>
          <p style={{ marginTop: 8 }}>
            Mr. Johnson's medications (Risperodone 4mg daily) have stabilized his acute
            presentation somewhat since incarceration, but breakthrough symptoms persist,
            particularly auditory hallucinations and paranoid ideation. His history of medication
            non-compliance (stopping medications after prior hospitalizations) is a significant
            prognostic factor.
          </p>
        </AIDraftSection>

        <p style={{ marginTop: 20, marginBottom: 12 }}>
          <strong>DIAGNOSTIC IMPRESSIONS</strong>
        </p>
        <p>
          <strong>Axis I Diagnosis:</strong>
        </p>
        <p style={{ marginLeft: 20, marginTop: 8 }}>
          <strong>Primary:</strong> Schizophrenia, First Episode, Currently in Acute Episode
          (F20.9)
          <br />
          <strong>Secondary (Ruled Out):</strong> Major Depressive Disorder — Insufficient
          evidence; depressive symptoms mild and secondary to psychosis
        </p>

        <AIDraftSection style={{ marginTop: 20 }}>
          <p style={{ marginBottom: 8 }}>
            <strong>COMPETENCY OPINION</strong>
          </p>
          <p>
            The legal standard for competency to stand trial is established by Dusky v. United
            States, 362 U.S. 402 (1960). The defendant must have: (1) a factual understanding of
            the charges and proceedings, (2) a rational understanding of the charges and
            proceedings, and (3) the ability to consult with counsel and assist in his defense.
          </p>

          <p style={{ marginTop: 12, marginBottom: 8 }}>
            <strong>Factual Understanding of the Proceedings</strong>
          </p>
          <p>
            Mr. Johnson demonstrates a basic but incomplete factual understanding of the legal
            proceedings. He can name his charges (Assault and Criminal Mischief) but cannot
            articulate what these charges mean or distinguish between felonies and
            misdemeanors. He knows the names and roles of his attorney (Public Defender Marcus
            Washington) and the judge (Judge Morales) but has limited understanding of their
            functions in the legal process. He correctly understands that he is in court for
            something that happened in January 2026, but his understanding of causality and
            consequences is limited.
          </p>

          <p style={{ marginTop: 12, marginBottom: 8 }}>
            <strong>Rational Understanding of the Proceedings</strong>
          </p>
          <p>
            Mr. Johnson's rational understanding of the proceedings is significantly impaired.
            His active psychotic symptoms — particularly his persecutory delusions — substantially
            interfere with his ability to rationally appreciate the proceedings and their likely
            consequences. During interviews, Mr. Johnson expressed beliefs that people at the jail
            are conspiring against him and that the legal system is part of a larger conspiracy to
            harm him. These beliefs prevented him from engaging in rational discussion about the
            facts of his case or possible legal strategies.
          </p>
          <p style={{ marginTop: 8 }}>
            Most critically, Mr. Johnson's auditory hallucinations and persecutory ideation cause
            him to distrust his own attorney, expressing concerns that his attorney "might be in
            on it too." This fundamental lack of trust in counsel, driven by psychotic symptoms,
            severely compromises his ability to work rationally with his attorney or appreciate
            the proceedings.
          </p>

          <p style={{ marginTop: 12, marginBottom: 8 }}>
            <strong>Ability to Consult with Counsel</strong>
          </p>
          <p>
            Mr. Johnson's ability to assist counsel and participate meaningfully in his defense
            is substantially compromised by his psychotic symptoms. While he reports that his
            attorney visits and attempts to explain legal matters, Mr. Johnson's paranoia prevents
            him from trusting the information provided. He second-guesses his attorney's motives,
            interprets discussions through a lens of conspiracy, and relies on hallucinatory input
            ("the voices") to make sense of information.
          </p>
          <p style={{ marginTop: 8 }}>
            Mr. Johnson has also expressed doubts about the factual events of January 15, 2026,
            claiming confusion about what occurred and attributing his actions to external
            influences rather than his own judgment. This makes meaningful collaboration with
            counsel extremely difficult.
          </p>

          <p style={{ marginTop: 12, marginBottom: 8 }}>
            <strong>Overall Competency Opinion</strong>
          </p>
          <p>
            <strong>
              OPINION: Mr. Marcus D. Johnson is NOT COMPETENT to stand trial at this time.
            </strong>
          </p>
          <p style={{ marginTop: 8 }}>
            The primary basis for this opinion is his impaired rational understanding of the
            proceedings and his severely compromised ability to assist counsel, both directly
            caused by active psychotic symptoms (auditory hallucinations, persecutory delusions,
            paranoid ideation). While his basic factual understanding is adequate, the Dusky
            standard requires all three prongs to be met. Mr. Johnson meets the first prong at a
            basic level but fails prongs two and three.
          </p>
          <p style={{ marginTop: 8 }}>
            His thought disturbance (confirmed by elevated THD, RC8, and RC6 on MMPI-3 and
            elevated SCZ and PAR on PAI) and cognitive limitations (FSIQ=82, verbal weakness)
            compound the impairment caused by his psychotic symptoms. The combination creates a
            substantial barrier to rational participation in trial proceedings.
          </p>
        </AIDraftSection>

        <p style={{ marginTop: 20, marginBottom: 12 }}>
          <strong>RECOMMENDATIONS</strong>
        </p>
        <ol style={{ paddingLeft: 20, marginBottom: 12 }}>
          <li>
            Referral to Colorado Mental Health Institute at Pueblo (CDMH-P) for competency
            restoration treatment, including psychiatric care and psychopharmacological
            management.
          </li>
          <li>
            Continue psychiatric medication (Risperidone or equivalent antipsychotic at current
            or higher dose) with regular monitoring by a psychiatrist.
          </li>
          <li>
            Individual psychotherapy aimed at improving insight into illness and medication
            compliance.
          </li>
          <li>Re-evaluation recommended after 6 months of stabilization and competency restoration efforts.</li>
        </ol>
      </div>
    </div>
  )
}

function WordToolbar(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState('Home')

  return (
    <div
      className="word-toolbar"
      style={{
        background: 'var(--panel)',
        borderBottom: '1px solid var(--border)',
        padding: '4px 8px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        flexShrink: 0,
      }}
    >
      <div
        className="word-toolbar-tabs"
        style={{
          display: 'flex',
          gap: 0,
          fontSize: 11,
          borderBottom: '1px solid var(--border)',
          paddingBottom: 4,
        }}
      >
        {['File', 'Home', 'Insert', 'Layout', 'References', 'Review', 'View'].map((tab) => (
          <div
            key={tab}
            className={`word-toolbar-tab${activeTab === tab ? ' active' : ''}`}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '4px 10px',
              cursor: 'pointer',
              color: activeTab === tab ? 'var(--accent)' : 'var(--text-secondary)',
              borderBottom: activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
              fontWeight: activeTab === tab ? 600 : 400,
            }}
          >
            {tab}
          </div>
        ))}
      </div>

      {/* Formatting tools (Home tab) */}
      {activeTab === 'Home' && (
        <div
          className="word-toolbar-tools"
          style={{
            display: 'flex',
            gap: 6,
            alignItems: 'center',
            flexWrap: 'wrap',
            padding: '4px 0',
          }}
        >
          <select
            className="word-font-select"
            style={{
              padding: '2px 4px',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 3,
              fontSize: 11,
              color: 'var(--text)',
            }}
            defaultValue="Times New Roman"
          >
            <option>Times New Roman</option>
            <option>Arial</option>
            <option>Helvetica</option>
            <option>Calibri</option>
          </select>

          <select
            style={{
              padding: '2px 4px',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 3,
              fontSize: 11,
              color: 'var(--text)',
            }}
            defaultValue="12"
          >
            <option>10</option>
            <option>11</option>
            <option>12</option>
            <option>13</option>
            <option>14</option>
          </select>

          <div
            style={{
              width: 1,
              height: 20,
              background: 'var(--border)',
              margin: '0 4px',
            }}
          />

          <button
            className="word-tool-btn bold-btn"
            style={{
              padding: '3px 6px',
              background: 'none',
              border: '1px solid transparent',
              borderRadius: 3,
              cursor: 'pointer',
              fontSize: 12,
              color: 'var(--text)',
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              fontWeight: 700,
            }}
          >
            B
          </button>

          <button
            className="word-tool-btn italic-btn"
            style={{
              padding: '3px 6px',
              background: 'none',
              border: '1px solid transparent',
              borderRadius: 3,
              cursor: 'pointer',
              fontSize: 12,
              color: 'var(--text)',
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              fontStyle: 'italic',
            }}
          >
            I
          </button>

          <button
            className="word-tool-btn underline-btn"
            style={{
              padding: '3px 6px',
              background: 'none',
              border: '1px solid transparent',
              borderRadius: 3,
              cursor: 'pointer',
              fontSize: 12,
              color: 'var(--text)',
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              textDecoration: 'underline',
            }}
          >
            U
          </button>

          <div
            style={{
              width: 1,
              height: 20,
              background: 'var(--border)',
              margin: '0 4px',
            }}
          />

          <button
            style={{
              padding: '3px 6px',
              background: 'none',
              border: '1px solid transparent',
              borderRadius: 3,
              cursor: 'pointer',
              fontSize: 12,
              color: 'var(--text)',
            }}
          >
            ≡ Left
          </button>

          <button
            style={{
              padding: '3px 6px',
              background: 'none',
              border: '1px solid transparent',
              borderRadius: 3,
              cursor: 'pointer',
              fontSize: 12,
              color: 'var(--text)',
            }}
          >
            ≣ Center
          </button>

          <button
            style={{
              padding: '3px 6px',
              background: 'none',
              border: '1px solid transparent',
              borderRadius: 3,
              cursor: 'pointer',
              fontSize: 12,
              color: 'var(--text)',
            }}
          >
            ≡ Right
          </button>
        </div>
      )}
    </div>
  )
}

function AIDraftSection({
  children,
  style,
}: {
  readonly children: React.ReactNode
  readonly style?: React.CSSProperties
}): React.JSX.Element {
  return (
    <div
      style={{
        border: '2px dashed #ff9800',
        background: '#fff8e1',
        borderRadius: 4,
        padding: 16,
        margin: '16px 0',
        position: 'relative',
        ...style,
      }}
    >
      <div
        style={{
          display: 'inline-block',
          background: '#ff9800',
          color: 'white',
          fontSize: 10,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          padding: '2px 8px',
          borderRadius: 3,
          marginBottom: 10,
        }}
      >
        AI DRAFT — CLINICIAN REVIEW REQUIRED
      </div>
      <div style={{ color: '#333' }}>{children}</div>
    </div>
  )
}
