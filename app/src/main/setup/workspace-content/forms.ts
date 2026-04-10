// =============================================================================
// Forms, blank forms the clinician copies into each case folder
// =============================================================================
//
// Shipped as DOCX files under /Workspace/Forms/. These are starter forms
// that the clinician should review with their own counsel before use in
// real cases. Placeholder tokens (e.g. {{CLINICIAN_FULL_NAME}}) are
// replaced at provision time with the practice info from the setup wizard.
//
// No real patient data ever lives in /Workspace/Forms/. Completed, signed
// copies live inside each case folder at cases/<case_dir>/Intake/.
// =============================================================================

export interface FormSection {
  readonly heading: string
  readonly body: readonly string[]
}

export interface BlankForm {
  readonly id: string
  readonly filename: string
  readonly title: string
  readonly subtitle: string
  readonly sections: readonly FormSection[]
}

// ---------------------------------------------------------------------------
// Shared header / signature blocks
// ---------------------------------------------------------------------------

const PRACTICE_HEADER: FormSection = {
  heading: 'Header',
  body: [
    '{{PRACTICE_NAME}}',
    '{{PRACTICE_ADDRESS}}',
    'Phone: {{PRACTICE_PHONE}}',
  ],
}

const SIGNATURE_BLOCK: FormSection = {
  heading: 'Signatures',
  body: [
    '',
    '',
    '________________________________________',
    'Examinee signature                                                       Date',
    '',
    '________________________________________',
    'Witness signature (if required)                                          Date',
    '',
    '________________________________________',
    '{{CLINICIAN_FULL_NAME}}, {{CLINICIAN_CREDENTIALS}}          Date',
    'Licensed Psychologist, {{CLINICIAN_STATE}} #{{CLINICIAN_LICENSE}}',
  ],
}

// ---------------------------------------------------------------------------
// Form 1: Informed Consent for Forensic Evaluation
// ---------------------------------------------------------------------------

const FORENSIC_CONSENT: BlankForm = {
  id: 'informed_consent_forensic',
  filename: 'Informed_Consent_Forensic_Evaluation.docx',
  title: 'Informed Consent for Forensic Psychological Evaluation',
  subtitle: 'Acknowledgment of Non-Confidential, Court-Involved Examination',
  sections: [
    PRACTICE_HEADER,
    {
      heading: 'Nature of This Evaluation',
      body: [
        'You are being asked to participate in a forensic psychological evaluation requested by ________________________ (the referring party). A forensic evaluation is different from ordinary mental health treatment. Its purpose is to address a specific legal question, not to treat you.',
        '',
        'The examiner, {{CLINICIAN_FULL_NAME}}, {{CLINICIAN_CREDENTIALS}}, is a licensed psychologist practicing forensic psychology. The examiner is not your treating therapist and no therapeutic relationship is being created by your participation in this evaluation.',
      ],
    },
    {
      heading: 'Limits of Confidentiality',
      body: [
        'The usual rules of confidentiality that apply between a mental health provider and a patient DO NOT apply in this evaluation. Information you share during this evaluation may be included in a written report, shared with the referring party, shared with the court, shared with attorneys representing either side in the legal matter, and may become part of the public record in your case.',
        '',
        'The examiner may also testify about information you share in this evaluation if called as a witness in a court proceeding.',
      ],
    },
    {
      heading: 'Duty to Report',
      body: [
        'If during this evaluation you disclose information about current child abuse, dependent adult abuse, elder abuse, or a serious threat to a specific identifiable person, the examiner may be required by law to report that information to the appropriate authorities or warn the person at risk, regardless of this agreement.',
      ],
    },
    {
      heading: 'Procedures',
      body: [
        'This evaluation may include: one or more clinical interviews, psychological testing, review of records provided by the referring party or other sources, interviews with collateral informants, and review of any audio or video recordings relevant to the referral question.',
        '',
        'You are not required to answer every question. However, a refusal to participate meaningfully in the evaluation may be noted in the examiner\'s report and may affect the outcome of the legal matter.',
      ],
    },
    {
      heading: 'Your Rights',
      body: [
        '1. You have the right to decline to participate in this evaluation.',
        '2. You have the right to consult with your attorney before the evaluation begins.',
        '3. You have the right to take breaks during the evaluation.',
        '4. You have the right to know the purpose of the evaluation and who will receive the report.',
        '5. You have the right to receive a copy of the report through your attorney, subject to court rules and applicable law.',
      ],
    },
    {
      heading: 'Acknowledgment',
      body: [
        'By signing below, I acknowledge that:',
        '',
        '- I have read or had read to me the above information.',
        '- I have had the opportunity to ask questions.',
        '- I understand that this is a forensic evaluation, not treatment.',
        '- I understand the limits of confidentiality described above.',
        '- I am participating voluntarily (if applicable) or have been ordered by the court to participate (circle one).',
        '- I understand that I may stop the evaluation at any time, though a refusal to continue may be reported.',
      ],
    },
    SIGNATURE_BLOCK,
  ],
}

// ---------------------------------------------------------------------------
// Form 2: Authorization for Release of Information
// ---------------------------------------------------------------------------

const ROI: BlankForm = {
  id: 'release_of_information',
  filename: 'Authorization_for_Release_of_Information.docx',
  title: 'Authorization for Release of Information',
  subtitle: 'HIPAA-Compliant Release',
  sections: [
    PRACTICE_HEADER,
    {
      heading: 'Patient/Client Information',
      body: [
        'Name: _________________________________________________',
        'Date of Birth: __________________________________________',
        'Other identifying information: __________________________',
      ],
    },
    {
      heading: 'Release Authorization',
      body: [
        'I authorize:',
        '',
        '________________________________________ (releasing party)',
        'Address: _______________________________________________',
        'Phone: _________________________________________________',
        'Fax: ___________________________________________________',
        '',
        'to release the following protected health information to:',
        '',
        '{{CLINICIAN_FULL_NAME}}, {{CLINICIAN_CREDENTIALS}}',
        '{{PRACTICE_NAME}}',
        '{{PRACTICE_ADDRESS}}',
        'Phone: {{PRACTICE_PHONE}}',
      ],
    },
    {
      heading: 'Specific Information to Be Released',
      body: [
        'Check all that apply:',
        '',
        '[ ] Complete mental health record',
        '[ ] Medical records',
        '[ ] Psychiatric evaluations',
        '[ ] Psychological testing results',
        '[ ] Treatment summaries',
        '[ ] Medication records',
        '[ ] Discharge summaries',
        '[ ] Progress notes',
        '[ ] Other: _________________________________________',
        '',
        'Date range of records: ___________________ to ___________________',
      ],
    },
    {
      heading: 'Psychotherapy Notes',
      body: [
        'Release of psychotherapy notes requires a separate authorization under HIPAA (45 CFR 164.508(a)(2)). Check one:',
        '',
        '[ ] I DO authorize release of psychotherapy notes.',
        '[ ] I DO NOT authorize release of psychotherapy notes.',
      ],
    },
    {
      heading: 'Substance Use Records',
      body: [
        'Records of substance use treatment are protected by 42 CFR Part 2 and require separate authorization. Check one:',
        '',
        '[ ] I DO authorize release of substance use treatment records.',
        '[ ] I DO NOT authorize release of substance use treatment records.',
      ],
    },
    {
      heading: 'Purpose of Release',
      body: [
        'The information will be used for:',
        '[ ] Forensic psychological evaluation',
        '[ ] Clinical consultation',
        '[ ] Legal proceedings',
        '[ ] Other: _________________________________________',
      ],
    },
    {
      heading: 'Expiration',
      body: [
        'This authorization will expire on ______________________ or upon completion of the psychological evaluation, whichever comes first.',
      ],
    },
    {
      heading: 'Your Rights',
      body: [
        '1. You may revoke this authorization at any time by providing written notice. Revocation will not affect information already released.',
        '2. The releasing party may not condition treatment, payment, enrollment, or eligibility for benefits on your signing this authorization.',
        '3. Information released under this authorization may be redisclosed by the recipient and may no longer be protected by HIPAA.',
        '4. You have the right to a copy of this authorization.',
      ],
    },
    SIGNATURE_BLOCK,
  ],
}

// ---------------------------------------------------------------------------
// Form 3: Notification of Non-Confidentiality (short form)
// ---------------------------------------------------------------------------

const NON_CONFIDENTIALITY: BlankForm = {
  id: 'notification_non_confidentiality',
  filename: 'Notification_of_Non_Confidentiality.docx',
  title: 'Notification of Non-Confidentiality',
  subtitle: 'Short Form for Court-Ordered Evaluations',
  sections: [
    PRACTICE_HEADER,
    {
      heading: 'Notification',
      body: [
        'I, ______________________________ (name), understand the following:',
        '',
        '1. I am participating in a psychological evaluation conducted by {{CLINICIAN_FULL_NAME}}, {{CLINICIAN_CREDENTIALS}}, pursuant to a court order or at the request of ______________________________.',
        '',
        '2. This is a forensic evaluation, not mental health treatment. The examiner is not my therapist.',
        '',
        '3. Information I share during this evaluation is NOT confidential in the way that information shared with a treating therapist would be. A written report will be provided to the court and to the parties to the legal proceeding.',
        '',
        '4. The examiner may be called as a witness and may testify about what I said and what was found during this evaluation.',
        '',
        '5. Exceptions to confidentiality for serious threats to identifiable persons, child abuse, dependent adult abuse, and elder abuse apply and are explained separately as needed.',
        '',
        '6. I have had an opportunity to ask questions about this evaluation and my rights.',
        '',
        '7. I understand that I may choose not to participate, but that my refusal may be reported to the court.',
      ],
    },
    SIGNATURE_BLOCK,
  ],
}

// ---------------------------------------------------------------------------
// Form 4: Fee Agreement and Retainer
// ---------------------------------------------------------------------------

const FEE_AGREEMENT: BlankForm = {
  id: 'fee_agreement',
  filename: 'Fee_Agreement_and_Retainer.docx',
  title: 'Fee Agreement and Retainer',
  subtitle: 'Forensic Psychological Services',
  sections: [
    PRACTICE_HEADER,
    {
      heading: 'Parties',
      body: [
        'This Agreement is between {{PRACTICE_NAME}} ("the Practice") and ______________________________ ("the Retaining Party"), dated ______________________________.',
      ],
    },
    {
      heading: 'Services',
      body: [
        'The Retaining Party engages the Practice to provide the following forensic psychological services:',
        '',
        '[ ] Records review',
        '[ ] Clinical interview(s) of the examinee',
        '[ ] Collateral interviews',
        '[ ] Psychological testing',
        '[ ] Written report',
        '[ ] Consultation with counsel',
        '[ ] Deposition testimony',
        '[ ] Trial testimony',
        '[ ] Other: _________________________________________',
      ],
    },
    {
      heading: 'Fees',
      body: [
        'The Practice charges at the following rates:',
        '',
        '| Service                            | Rate                    |',
        '| ---------------------------------- | ----------------------- |',
        '| Records review, interviews, report | $______ per hour        |',
        '| Deposition testimony               | $______ per hour, 4 hr min |',
        '| Trial testimony                    | $______ per day, 1 day min |',
        '| Travel (door to door)              | $______ per hour        |',
        '| Mileage                            | Current IRS rate        |',
        '',
        'Fees are NOT contingent on the outcome of the case. Psygil professionals do not accept contingency arrangements for forensic work, consistent with the APA Specialty Guidelines for Forensic Psychology.',
      ],
    },
    {
      heading: 'Retainer',
      body: [
        'An initial retainer of $______________________ is due at the time this Agreement is signed. The Practice will bill against the retainer at the rates above and provide periodic statements. If the retainer is exhausted, an additional retainer will be required before the Practice continues work.',
      ],
    },
    {
      heading: 'Cancellation of Testimony',
      body: [
        'If deposition or trial testimony is scheduled and then cancelled with less than ______ business days notice, the full scheduled fee is due.',
      ],
    },
    {
      heading: 'Records',
      body: [
        'The Practice will retain its records consistent with state and federal record retention requirements. Copies may be provided upon written request and payment of reproduction costs.',
      ],
    },
    {
      heading: 'Limitations',
      body: [
        'The Practice does not guarantee any particular outcome. The Practice will provide honest, independent opinions based on the data, which may or may not favor the Retaining Party\'s position.',
      ],
    },
    SIGNATURE_BLOCK,
  ],
}

// ---------------------------------------------------------------------------
// Form 5: Collateral Contact Consent
// ---------------------------------------------------------------------------

const COLLATERAL_CONSENT: BlankForm = {
  id: 'collateral_contact_consent',
  filename: 'Collateral_Contact_Consent.docx',
  title: 'Consent for Collateral Contact',
  subtitle: 'Authorization for the Examiner to Interview Third Parties',
  sections: [
    PRACTICE_HEADER,
    {
      heading: 'Purpose',
      body: [
        'Collateral interviews with people who know you can help the examiner prepare a thorough and accurate report. This form authorizes {{CLINICIAN_FULL_NAME}}, {{CLINICIAN_CREDENTIALS}} to contact specific individuals and discuss relevant information.',
      ],
    },
    {
      heading: 'Authorized Contacts',
      body: [
        'I authorize the examiner to contact the following individuals:',
        '',
        '1. Name: _________________________________________________',
        '   Relationship: __________________________________________',
        '   Phone: ________________________________________________',
        '',
        '2. Name: _________________________________________________',
        '   Relationship: __________________________________________',
        '   Phone: ________________________________________________',
        '',
        '3. Name: _________________________________________________',
        '   Relationship: __________________________________________',
        '   Phone: ________________________________________________',
        '',
        '4. Name: _________________________________________________',
        '   Relationship: __________________________________________',
        '   Phone: ________________________________________________',
      ],
    },
    {
      heading: 'Scope',
      body: [
        'The examiner may discuss with the above individuals:',
        '',
        '[ ] General observations about me',
        '[ ] My behavior and functioning',
        '[ ] My relationships with others',
        '[ ] My mental health history as known to them',
        '[ ] Events relevant to the evaluation',
        '[ ] Other: _________________________________________',
        '',
        'Information obtained from these contacts may be included in the examiner\'s written report and may be disclosed as described in the Informed Consent for Forensic Evaluation form.',
      ],
    },
    {
      heading: 'Revocation',
      body: [
        'I may revoke this authorization at any time by providing written notice to the examiner. Revocation will not affect information already gathered.',
      ],
    },
    SIGNATURE_BLOCK,
  ],
}

export const BLANK_FORMS: readonly BlankForm[] = [
  FORENSIC_CONSENT,
  ROI,
  NON_CONFIDENTIALITY,
  FEE_AGREEMENT,
  COLLATERAL_CONSENT,
] as const
