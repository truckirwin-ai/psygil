# HIPAA SAFE HARBOR DE-IDENTIFICATION VALIDATION PROTOCOL
## Psygil PII Detection Pipeline — Compliance Documentation and Engineering Specification

**Document Version:** 1.0
**Last Updated:** 2026-03-19
**Classification:** Legal Compliance / Engineering Specification
**Responsible Party:** Psygil Privacy and Compliance Officer

---

## I. PURPOSE AND SCOPE

This protocol documents Psygil's comprehensive approach to de-identifying Protected Health Information (PHI) before transmission to third-party AI providers, specifically Anthropic Claude and OpenAI. The de-identification method implemented by Psygil follows the HIPAA Safe Harbor standard as defined in 45 CFR § 164.514(b)(2), which establishes a regulatory safe harbor for information that has been de-identified through the removal or generalization of specified identifiers.

This document serves dual purposes:
1. **Engineering Specification:** Provides technical implementation requirements, validation methodology, and quality assurance protocols for the Presidio-based PII detection pipeline.
2. **Legal Compliance Documentation:** Demonstrates that Psygil's de-identification methodology satisfies the regulatory requirements of HIPAA Safe Harbor and supports the legal conclusion that information transmitted to third-party LLM providers is no longer Protected Health Information under HIPAA.

The scope encompasses all text-based clinical and forensic documents processed through Psygil, including but not limited to: competency evaluations, custody/family law evaluations, risk assessments, clinical diagnostic assessments, disability evaluations, and neuropsychological reports.

---

## II. REGULATORY FRAMEWORK

### The HIPAA Safe Harbor Standard

45 CFR § 164.514(b)(2) establishes the Safe Harbor de-identification method. De-identification is achieved through compliance with both of the following requirements:

**Requirement 1: Removal or Generalization of 18 Specified Identifiers**

A covered entity must remove or generalize all of the following identifiers of the individual and of relatives, employers, and household members of the individual contained in the designated record set:

1. Names
2. Geographic subdivisions smaller than a state
3. All dates (except year) directly related to an individual
4. Telephone numbers
5. Fax numbers
6. Electronic mail addresses
7. Social Security numbers
8. Medical record numbers
9. Health plan beneficiary numbers
10. Account numbers
11. Certificate/license numbers
12. Vehicle identifiers and serial numbers
13. Device identifiers and serial numbers
14. Web Universal Resource Locators (URLs)
15. Internet Protocol (IP) addresses
16. Biometric identifiers, including those from fingerprints and voice
17. Full-face photographic images and any comparable images
18. Any other unique identifying number, characteristic, or code

**Requirement 2: Knowledge Standard**

The covered entity must not have actual knowledge that the remaining information could be used alone or in combination with other information to identify an individual who is a subject of the information. This is the objective "actual knowledge" standard: the entity's state of mind regarding whether remaining information could identify an individual is irrelevant; what matters is whether, as an objective fact, the remaining information could identify the individual.

**Application to Psygil's Use Case**

Psygil qualifies as a Business Associate (BA) to clinical practices and forensic psychology firms that are covered entities under HIPAA. Psygil's LLM transmission infrastructure is designed to ensure that information transmitted to third-party AI providers (Anthropic, OpenAI) is de-identified under the Safe Harbor standard. When information has been successfully de-identified under Safe Harbor, it is no longer Protected Health Information, and therefore transmission to a third-party provider does not require a Business Associate Agreement with that provider, as the information is no longer subject to HIPAA.

---

## III. THE 18 SAFE HARBOR IDENTIFIERS — COMPLETE SPECIFICATION

This section provides detailed specifications for each of the 18 identifiers, including regulatory context, forensic/clinical examples, detection methodology, and known challenges specific to psychological evaluations and forensic reports.

### 1. NAMES

**Regulatory Definition:** All names used by the individual, including patient names, names of family members, household members, employers, and emergency contacts.

**Clinical/Forensic Examples:**
- Patient name: "Dr. Jane Maria Chen"
- Family members: "Her ex-husband Michael Chen reported..."
- Collateral contacts: "Called Ms. Patricia Rodriguez, maternal aunt"
- Referring attorney: "Matter referred by Attorney James Mitchell"
- Judge: "Ordered by Judge Patricia Hoffmann"
- Clinician name: "Evaluation conducted by Dr. Robert Patel"

**Detection Methodology:**
- Primary: Presidio PERSON entity type via spaCy en_core_web_lg NER model
- Supplementary: Custom recognizer pattern for titles preceding names (Dr., Judge, Mr., Ms., Mrs., etc.)
- Context patterns: "Patient [PERSON]", "evaluated by [PERSON]", "referred by [PERSON]"
- Confidence threshold: 0.75 for automatic replacement; <0.75 flagged for human review

**Replacement Strategy:**
- Format: `[PERSON_N]` where N is an incrementing integer within document scope
- Examples: `[PERSON_1]`, `[PERSON_2]`, `[PERSON_3]`
- Placeholder mapping stored locally only, never transmitted with de-identified text

**Known Difficulties in Clinical Text:**
- **Middle names and initials:** spaCy sometimes tags middle names separately; requires post-processing to consolidate multi-token person entities
- **Nicknames and informal references:** "He goes by Bobby, not Robert" — requires contextual resolution and may be missed on first pass
- **Cultural name formats:** Vietnamese, Chinese, Arabic, and other non-Western name structures may confuse English-trained NER models; e.g., family name placed after given name, or names with particles ("von", "de")
- **Incomplete names:** "Dr. C." or "the attending physician Dr. M." — regex patterns needed for initial-based references
- **Repetitive name references:** Once a name is introduced, subsequent pronouns should not be re-flagged, but some context-unaware uses ("As Dr. Smith noted, Dr. Smith also stated...") require validation

### 2. GEOGRAPHIC DATA SMALLER THAN STATE

**Regulatory Definition:** All geographic subdivisions smaller than a state, including street address, city, county, and zip code. Exception: The first three digits of zip code are allowable if the resulting geographic unit contains more than 20,000 residents.

**Clinical/Forensic Examples:**
- Street address: "Resides at 742 Maple Drive, Apartment 3B"
- City: "Works in Denver, Colorado"
- County: "Referred from Adams County Family Court"
- Zip code: "92101" (allowable if population >20K); "92103" (may be impermissible if population <20K)
- Neighborhood: "Lives in the Castro District of San Francisco"

**Detection Methodology:**
- Primary: Presidio LOCATION entity type via spaCy NER
- Supplementary: Custom regex patterns for:
  - Street addresses: `\d+\s+[A-Za-z]+\s+(Street|Street|Avenue|Road|Drive|Lane|Court|Plaza|Boulevard|Way|Circle|Place|Parkway)`
  - Zip codes: `\b\d{5}(-\d{4})?\b`
  - Zip+4 format: Always flagged (reveals precise location)
- Geographic database lookup: Cross-reference detected zip codes against Census Bureau data to determine population >20K threshold
- Context patterns: "address is", "located in", "from the county of", "served by the court in"

**Replacement Strategy:**
- Format: `[LOCATION_N]` for city/county names and street addresses
- Zip code handling: If population >20K, retain first 3 digits as `[ZIP_3_PREFIX]`; otherwise replace entire code with `[ZIP_CODE_N]`
- Examples: `[LOCATION_1]`, `[LOCATION_2]`, `[ZIP_3_PREFIX_5]`, `[ZIP_CODE_1]`

**Known Difficulties in Clinical Text:**
- **Zip code population boundaries:** The 20,000 resident threshold requires real-time or regularly updated Census data; changes in population can shift permissibility; conservative approach is to flag all specific zip codes and allow clinician review
- **Familiar location names:** City names that are also common words ("Angel [city]" vs. "angel [common noun]") may cause false positives or false negatives
- **Regional references:** "Northern California" is permissible (larger than state subdivision); "Silicon Valley" is ambiguous (recognized regional term but smaller than county) — requires contextual rules
- **Institutional addresses:** "The hospital is located at..." may reveal the specific facility, which indirectly identifies the covered entity and could allow cross-referencing to identify the patient

### 3. ALL DATES (EXCEPT YEAR) DIRECTLY RELATED TO THE INDIVIDUAL

**Regulatory Definition:** All dates, except year, that are directly related to an individual, including birth dates, dates of service/evaluation, hospitalization dates, and incident dates. Special rule: Ages over 89 are treated as identifiers and must be converted to "89+" or generalized.

**Clinical/Forensic Examples:**
- Date of birth: "Born November 14, 1976" → Remove month/day, retain only "1976"
- Date of evaluation: "Evaluated on March 15, 2026" → Generalize to "March 2026" or "2026"
- Hospitalization date: "Admitted April 3, 2025" → Generalize to "April 2025"
- Incident date: "The alleged offense occurred December 10, 2024" → Generalize to "December 2024"
- Age over 89: "A 93-year-old male" → Replace with "89+ years old"
- Approximate dates: "About two weeks prior to the evaluation" → No action if no specific calendar date

**Detection Methodology:**
- Primary: Presidio DATE_TIME entity type via spaCy NER
- Supplementary: Custom recognizer patterns for:
  - Full dates: `(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}`
  - Date abbreviations: `\d{1,2}/\d{1,2}/\d{4}`
  - Month-year only: `(January|February|...|December)\s+\d{4}` — permissible if no day specified
  - Ages: `\b([0-9]{1,3})\s*(-|\s)?\s*year(s)?\s*old\b` with specific flagging for age >89
- Context patterns: "born", "evaluated", "admitted", "occurred on", "age"

**Replacement Strategy:**
- Full date (month, day, year): Replace with `[DATE_N]` (assume this generalizes to year only; clinician may retain year if appropriate for clinical context)
- Dates already generalized to month/year: Permissible if clinically necessary; may replace with `[MONTH_YEAR_N]` for added caution
- Ages 89 and below: Generally permissible; no replacement needed
- Ages above 89: Replace with "89+"
- Examples: `[DATE_1]`, `[MONTH_YEAR_1]`

**Known Difficulties in Clinical Text:**
- **Relative dates:** "Two months before the incident" or "Shortly after graduation" do not contain specific calendar dates; no action required, but context must be evaluated to ensure no re-identification is possible
- **Implicit date reference:** "Since the 2024 election" or "During the pandemic" — may indirectly indicate timeframe; generally permissible if no specific month/day
- **Year-only references:** "In 2023, the patient..." — permissible under regulation; no action needed
- **Age imprecision:** "In her early fifties" or "A middle-aged man" — generally permissible; only specific age >89 requires replacement
- **Sequential date reasoning:** If a document states "evaluated in January" and "discharged two weeks later," the combination may allow calculation of the discharge date; requires careful contextual review

### 4. TELEPHONE NUMBERS

**Regulatory Definition:** All telephone numbers, including office, mobile, home, and fax numbers associated with the individual, their family, employers, and emergency contacts.

**Clinical/Forensic Examples:**
- Home phone: "Contact number is 303-555-0142"
- Mobile phone: "Reachable at (720) 555-0198"
- Work phone: "Office: 720-555-0156 ext. 204"
- Emergency contact: "In case of emergency, call 303-555-0115"
- Attorney phone: "Defense counsel: 720-555-0199"

**Detection Methodology:**
- Primary: Presidio PHONE_NUMBER entity type
- Custom regex patterns:
  - Standard US format: `\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}`
  - Format with extension: `\d{3}[-.\s]\d{3}[-.\s]\d{4}(\s+ext\.?\s*\d+)?`
  - International format: `\+\d{1,3}\s?\d{1,14}`
- Context patterns: "phone", "call", "extension", "reach at", "contact"

**Replacement Strategy:**
- Format: `[PHONE_N]` for all telephone numbers including extensions
- Example: `[PHONE_1]`, `[PHONE_2]`

**Known Difficulties in Clinical Text:**
- **Extensions:** Must be captured with main number; splitting into separate entities loses critical information
- **International formats:** Varying digit patterns and country code conventions; regex must account for global formats if evaluations involve international patients
- **Partial numbers:** "Call 555-0142" (missing area code) — should be flagged and replaced
- **Number sequences resembling phone numbers:** Dates formatted as "03-22-2019" may be misidentified as phone numbers; requires context filtering

### 5. FAX NUMBERS

**Regulatory Definition:** All fax numbers, including court fax, attorney fax, and healthcare facility fax numbers.

**Clinical/Forensic Examples:**
- Court fax: "Submission deadline: Fax to 303-555-0107"
- Attorney fax: "Defense counsel fax: (720) 555-0108"
- Provider fax: "Referral to: Fax 720-555-0110"

**Detection Methodology:**
- Primary: PHONE_NUMBER entity type with contextual disambiguation
- Custom regex: Same patterns as telephone numbers, with context keywords: "fax", "fax number", "transmit to"
- Disambiguation: Distinguish from telephone numbers via preceding or following text

**Replacement Strategy:**
- Format: `[FAX_N]` (separate from telephone numbers for clarity)
- Example: `[FAX_1]`, `[FAX_2]`

**Known Difficulties in Clinical Text:**
- **Ambiguous phone vs. fax:** Some documents list "Phone/Fax" with a single number; requires judgment to determine if the number is used for both; conservative approach is to replace
- **Format similarity:** Fax and phone share identical formatting; context-dependent detection

### 6. ELECTRONIC MAIL ADDRESSES

**Regulatory Definition:** All email addresses associated with the individual, their family, employers, healthcare providers, and legal representatives.

**Clinical/Forensic Examples:**
- Patient email: "Preferred contact: jane.chen@example.com"
- Attorney email: "Opposing counsel: james.mitchell@lawfirm.com"
- Healthcare provider email: "Primary care physician: robert.patel@medicalcenter.org"
- Collateral contact: "Sister's email: patricia.rodriguez@company.com"

**Detection Methodology:**
- Primary: Presidio EMAIL_ADDRESS entity type
- Regex pattern: `[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}`
- Context patterns: "email", "contact", "@"

**Replacement Strategy:**
- Format: `[EMAIL_N]`
- Example: `[EMAIL_1]`, `[EMAIL_2]`

**Known Difficulties in Clinical Text:**
- **Institutional vs. personal identifiers:** An institutional email may not identify the specific individual (e.g., "support@hospital.org"), but does identify the facility, which may be restricted in some contexts; conservative approach is to replace all email addresses
- **Embedded email in URLs:** "Visit https://hospital.org/patient/jane.chen/" — the email-like segment should be detected and replaced

### 7. SOCIAL SECURITY NUMBERS

**Regulatory Definition:** All Social Security numbers, including full SSNs and partial SSNs.

**Clinical/Forensic Examples:**
- Full SSN: "SSN: 123-45-6789"
- Partial SSN (last 4): "Last four digits: 6789" — regulations specify "social security numbers" without explicit exception for partial SSNs; conservative approach is to replace all SSN-related numbers
- Context: "Claimant's SSN on file: 123-45-6789"

**Detection Methodology:**
- Primary: Presidio US_SSN entity type
- Regex pattern: `\b(\d{3})-?(\d{2})-?(\d{4})\b` or `\b\d{3}-\d{2}-\d{4}\b`
- Partial SSN pattern: `\b\d{4}\b` in context of "SSN", "social security", "last four"
- Confidence threshold: High (SSN pattern is highly specific)

**Replacement Strategy:**
- Format: `[SSN_N]` for full and partial SSNs
- Example: `[SSN_1]`, `[SSN_PARTIAL_1]`

**Known Difficulties in Clinical Text:**
- **Partial SSN ambiguity:** Last four digits of SSN may appear in other contexts (account numbers, case numbers); contextual filtering required
- **False positives:** Sequences resembling SSN format that are not SSNs (e.g., test numbers, example numbers in instructions); requires manual review or confidence-based filtering

### 8. MEDICAL RECORD NUMBERS

**Regulatory Definition:** All medical record numbers, patient chart numbers, and hospital identification numbers.

**Clinical/Forensic Examples:**
- Hospital MRN: "MRN: 987654"
- Clinic chart number: "Chart #: CCH-2024-45678"
- Healthcare system ID: "Patient ID: 0023456"
- EHR number: "EHR #4002119"

**Detection Methodology:**
- Custom recognizer (no standard Presidio entity type):
  - Context patterns: "MRN", "medical record number", "chart number", "patient ID", "patient number", "EHR"
  - Regex: `(MRN|Chart\s*#?|Patient\s*ID|EHR\s*#?)\s*[:=]?\s*([A-Za-z0-9\-]+)`
  - Capture group 2 contains the identifier to replace
- Confidence threshold: 0.80 (context-dependent)

**Replacement Strategy:**
- Format: `[MRN_N]` or `[PATIENT_ID_N]` depending on source
- Example: `[MRN_1]`, `[PATIENT_ID_1]`

**Known Difficulties in Clinical Text:**
- **Institutional variation:** MRN formats vary widely across institutions; custom recognizers must be trained on institution-specific formats or maintain a flexible regex
- **Context ambiguity:** "Chart number" may refer to psychological test chart numbers (e.g., MMPI-2 chart codes) rather than medical record numbers; requires disambiguation
- **Abbreviation variation:** MRN, EMR, EHR, HIN, etc.; all variants must be recognized

### 9. HEALTH PLAN BENEFICIARY NUMBERS

**Regulatory Definition:** All health insurance plan member IDs and beneficiary identification numbers.

**Clinical/Forensic Examples:**
- Insurance member ID: "Insurance member ID: 98765432X"
- Medicaid number: "Medicaid #: 123456789"
- Medicare number: "Medicare number: 1ZX9-ML7-VE3"
- Group number: "Group #: 54321"

**Detection Methodology:**
- Custom recognizer (no standard Presidio entity type):
  - Context patterns: "insurance", "member ID", "beneficiary number", "medicaid", "medicare", "group number", "policy number"
  - Regex (common formats): `(Member\s*ID|Beneficiary|Medicaid|Medicare|Group\s*#?|Policy\s*#?)\s*[:=]?\s*([A-Za-z0-9\-]+)`
  - Insurance ID formats highly variable; regex must be flexible or institution/insurance-carrier specific
- Confidence threshold: 0.80

**Replacement Strategy:**
- Format: `[INSURANCE_ID_N]`
- Example: `[INSURANCE_ID_1]`, `[INSURANCE_ID_2]`

**Known Difficulties in Clinical Text:**
- **Format variability:** Different insurance carriers use different ID formats; maintaining accurate regex is challenging
- **Partial IDs:** Some documents may contain only a portion of the ID; must detect and replace

### 10. ACCOUNT NUMBERS

**Regulatory Definition:** All financial account numbers, including bank accounts, credit card numbers (though these should never be in clinical records), and other financial accounts.

**Clinical/Forensic Examples:**
- Bank account number: In custody/disability cases, may reference "Account #: 45678901"
- Financial account: "Investment account ending in 1234"
- Billing account: "Billing account: 0012345"

**Detection Methodology:**
- Custom recognizer:
  - Context patterns: "account", "account number", "account #", "banking", "financial account"
  - Regex: `(Account|Account\s*#|Billing\s*Account)\s*[:=]?\s*([A-Za-z0-9\-]+)`
  - Confidence threshold: 0.75 (context-dependent; may be false positives)
- Note: In psychological evaluations, this identifier is less common than in other medical contexts

**Replacement Strategy:**
- Format: `[ACCOUNT_N]`
- Example: `[ACCOUNT_1]`

**Known Difficulties in Clinical Text:**
- **Low frequency:** Account numbers appear rarely in psychological reports, reducing test sensitivity
- **Ambiguous context:** "She manages the family account" (narrative reference, not a number) should not be flagged
- **Partial account numbers:** Last four digits ("...1234") may be referenced; should be flagged in financial/custody contexts

### 11. CERTIFICATE AND LICENSE NUMBERS

**Regulatory Definition:** Professional license numbers, certifications, and credential identifiers for the individual and other professionals mentioned.

**Clinical/Forensic Examples:**
- Professional license: "Licensed as a psychologist: PA License #: PY-123456"
- Medical license: "Physician: MD License #: 78901"
- Attorney bar number: "Opposing counsel Bar #: 456789"
- Nursing license: "RN License #: 98765"

**Detection Methodology:**
- Custom recognizer:
  - Context patterns: "license", "license #", "certification", "credential", "bar number", "state #"
  - Regex: `(License|License\s*#|Certification|Credential|Bar\s*#|State\s*#)\s*[:=]?\s*([A-Za-z0-9\-]+)`
  - State prefixes: "NY", "CA", "PA", "TX", etc. may precede license numbers
  - Confidence threshold: 0.80
- Note: License numbers for clinicians and other professionals mentioned in the report should be replaced to protect their privacy as well

**Replacement Strategy:**
- Format: `[LICENSE_N]` or `[CREDENTIAL_N]`
- Example: `[LICENSE_1]`, `[CREDENTIAL_1]`

**Known Difficulties in Clinical Text:**
- **Format variation:** Different states and professional boards use different formats; no standard structure
- **Incomplete context:** "Her license number was discussed" without an actual number — should not be flagged

### 12. VEHICLE IDENTIFIERS AND SERIAL NUMBERS

**Regulatory Definition:** License plate numbers, Vehicle Identification Numbers (VINs), and other vehicle serial numbers.

**Clinical/Forensic Examples:**
- License plate: "Vehicle plate: ABC-1234" or "License plate: XYZ123"
- VIN: "VIN: 1HGBH41JXMN109186"
- Context in forensic cases: "The accused's vehicle, plate number XYZ123, was seen leaving the scene"

**Detection Methodology:**
- Custom recognizer:
  - License plate regex: `([A-Z]{1,3}[\s-]?(\d{2,4})|(\d{3,4}[\s-]?[A-Z]{1,3}))`
  - VIN regex: `\b([A-HJ-NPR-Z0-9]{17})\b` (VINs are 17 alphanumeric characters, excluding I, O, Q)
  - Context patterns: "license plate", "plate", "VIN", "vehicle identification"
  - Confidence threshold: 0.85 for VIN (high specificity), 0.75 for plates

**Replacement Strategy:**
- Format: `[LICENSE_PLATE_N]` or `[VIN_N]`
- Example: `[LICENSE_PLATE_1]`, `[VIN_1]`

**Known Difficulties in Clinical Text:**
- **Rare in psychological evaluations:** Vehicle identifiers appear primarily in forensic cases involving accidents or criminal matters
- **False positives:** Letter-number sequences in other contexts may resemble plates (e.g., model numbers, test codes)

### 13. DEVICE IDENTIFIERS AND SERIAL NUMBERS

**Regulatory Definition:** Serial numbers, model numbers, and other identifiers for implanted medical devices, prosthetics, hearing aids, and other devices.

**Clinical/Forensic Examples:**
- Pacemaker serial: "Implanted device serial: PM-2024-001234"
- Hearing aid: "Hearing aid serial: HA-9876543"
- Implant identifier: "Cochlear implant model: CI512"
- Prosthetic: "Left below-knee prosthetic, model XYZ-2024"

**Detection Methodology:**
- Custom recognizer:
  - Context patterns: "device", "serial", "model", "implant", "pacemaker", "hearing aid", "prosthetic", "device serial"
  - Regex: `(Device|Serial|Model|Implant|Pacemaker|Hearing\s*Aid|Prosthetic)\s*[:=]?\s*([A-Za-z0-9\-]+)`
  - Confidence threshold: 0.80
- Note: This identifier is rare in psychological evaluations but may appear in neuropsychological reports or medical record excerpts

**Replacement Strategy:**
- Format: `[DEVICE_ID_N]`
- Example: `[DEVICE_ID_1]`

**Known Difficulties in Clinical Text:**
- **Very low frequency:** Device identifiers rarely appear in psychological reports, reducing practical test sensitivity
- **Ambiguous references:** "Device testing" or "device-based interventions" should not trigger flagging

### 14. WEB UNIVERSAL RESOURCE LOCATORS (URLs)

**Regulatory Definition:** All URLs, including those embedded in documents, referral sources, and collateral references.

**Clinical/Forensic Examples:**
- Website reference: "For more information, see https://www.psychologytoday.com/find/psychologists"
- Patient portal: "Results available at https://hospital.org/patient/records/jane.chen/latest"
- Hospital link: "Facility information: https://medicalcenter.org/departments/psychiatry"
- Embedded email-like URL: "https://hospital.org/contact/robert.patel/"

**Detection Methodology:**
- Primary: Presidio URL entity type
- Regex pattern: `https?://[^\s]+` (or more refined to avoid capturing trailing punctuation)
- Context patterns: "see", "visit", "available at", "link"

**Replacement Strategy:**
- Format: `[URL_N]`
- Example: `[URL_1]`, `[URL_2]`

**Known Difficulties in Clinical Text:**
- **Embedded identifiers in URLs:** URLs may contain names, IDs, or other identifiers; the entire URL should be replaced to eliminate potential re-identification
- **Trailing punctuation:** URLs ending with a period or comma may be partially detected; regex must account for URL boundary detection

### 15. INTERNET PROTOCOL (IP) ADDRESSES

**Regulatory Definition:** All IP addresses (IPv4 and IPv6) associated with the individual or systems processing their information.

**Clinical/Forensic Examples:**
- IPv4 address: "Accessed from IP: 192.168.1.100"
- IPv6 address: "Connection IP: 2001:0db8:85a3:0000:0000:8a2e:0370:7334"

**Detection Methodology:**
- Presidio IP_ADDRESS entity type
- IPv4 regex: `\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b`
- IPv6 regex: `(?:[0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}`

**Replacement Strategy:**
- Format: `[IP_ADDRESS_N]`
- Example: `[IP_ADDRESS_1]`

**Known Difficulties in Clinical Text:**
- **Extremely rare:** IP addresses are almost never present in psychological evaluations
- **No practical impact:** Unlikely to affect validation results

### 16. BIOMETRIC IDENTIFIERS

**Regulatory Definition:** Fingerprints, voiceprints, retinal images, and other biometric identifiers.

**Clinical/Forensic Examples:**
- Fingerprint reference: "Fingerprints on file: [biometric data]"
- Voiceprint: "Voice identification completed"

**Detection Methodology:**
- Custom recognizer:
  - Context patterns: "fingerprint", "voiceprint", "biometric", "retinal"
  - Confidence threshold: 0.90 (very specific)
- Note: Text-based documents would contain reference to biometric data, not the actual biometric itself

**Replacement Strategy:**
- Format: `[BIOMETRIC_N]`

**Known Difficulties in Clinical Text:**
- **Not applicable to text processing:** Psygil processes text only; actual biometric data (images, voice recordings) would not be present
- **References to biometric data:** If a report states "Fingerprints collected and matched to the database," no specific identifier needs replacement unless a specific fingerprint ID is provided

### 17. FULL-FACE PHOTOGRAPHIC IMAGES

**Regulatory Definition:** Full-face photographs and any comparable images of the individual.

**Clinical/Forensic Examples:**
- Photograph reference: "[Photo of patient attached]"
- Image reference in report text

**Detection Methodology:**
- Not applicable: Psygil's system processes text only and does not handle image data
- If documents reference attached images, the reference itself should be noted; however, the actual image is not processed

**Replacement Strategy:**
- Text references such as "[Photo attached]" may be removed or generalized to "[Image attached]"

---

### 18. ANY OTHER UNIQUE IDENTIFYING NUMBER, CHARACTERISTIC, OR CODE

**Regulatory Definition:** Case numbers, docket numbers, booking numbers (in forensic contexts), court case identifiers, Protective Restraining Order (PRO) numbers, PREA incident numbers (in correctional settings), and any other unique identifiers not covered above.

**Clinical/Forensic Examples:**
- Case number: "Case #: 2024-CV-012345"
- Docket number: "Docket: 2024-12345"
- Booking number (forensic): "Booking #: 2024-001234"
- Court identifier: "District Court Case No.: 23-L-001234"
- Protective order number: "PRO #: PO-2024-5678"
- PREA incident: "PREA incident #: 2024-0045"
- Medical record variant: "Hospital system ID: HSN-987654321"

**Detection Methodology:**
- Custom recognizers for common forensic identifiers:
  - Case/docket number regex: `(Case|Docket|Case\s*No\.|Court\s*Case)\s*[:=]?#?\s*(\d{4}[-]?\d{2,5}|[A-Z]+-\d{2,6})`
  - Booking number regex: `(Booking|Booking\s*#)\s*[:=]?\s*(\d{6,10})`
  - PRO number regex: `(PRO|Protective\s*Order)\s*#?[:=]?\s*([A-Z]+[-]?\d{4}[-]?\d{2,4})`
  - PREA incident: `(PREA|Incident)\s*#?[:=]?\s*(\d{4}[-]?\d{4,5})`
- Confidence threshold: 0.85 (context-dependent; these identifiers are highly institution/jurisdiction specific)

**Replacement Strategy:**
- Format: `[CASE_NUMBER_N]`, `[DOCKET_N]`, `[BOOKING_N]`, `[INCIDENT_N]`, or generically `[IDENTIFIER_N]`
- Example: `[CASE_NUMBER_1]`, `[DOCKET_1]`, `[BOOKING_1]`

**Known Difficulties in Clinical Text:**
- **Jurisdiction variation:** Case/docket numbering systems vary by court; regex must be flexible or customized per jurisdiction
- **Format inconsistency:** Same identifiers formatted differently across documents
- **Over-breadth:** Generic regex for "any unique identifier" risks false positives; specificity requires jurisdiction/institution knowledge
- **Clinical case numbers vs. legal case numbers:** A clinical practice may assign its own case numbers; distinguishing from court identifiers requires context

---

## IV. VALIDATION METHODOLOGY

### A. Test Corpus Requirements

The validation of Psygil's de-identification pipeline must be based on a comprehensive, representative test corpus that includes authentic clinical and forensic evaluation documents containing all 18 Safe Harbor identifiers.

**Corpus Composition:**
- **Minimum size:** 50 de-identified forensic/clinical evaluation documents
- **Document types represented:** Each of the following document types must comprise at least 8-10% of the corpus:
  - Competency to stand trial evaluations
  - Custody and visitation evaluations
  - Risk assessments (e.g., dangerousness assessments, suicide risk)
  - Clinical diagnostic evaluations
  - Disability evaluations (Social Security Disability, workers' compensation)
  - Neuropsychological assessments
  - Family law evaluations (parental capacity, family dynamics)

- **Identifier coverage:** Every document in the corpus must be manually annotated to include examples of as many of the 18 identifiers as contextually appropriate. The corpus must collectively include documented instances of all 18 identifier categories. Documents should include:
  - Varied spellings and formats (e.g., multiple date formats, international phone numbers)
  - Edge cases (e.g., cultural names, ambiguous references)
  - Multiple instances of the same identifier type within a single document

- **Source requirements:**
  - Primary source: Authentic, redacted real-world documents provided by clinical advisors (psychologists, forensic evaluators) with appropriate de-identification and consent
  - Supplementary source: Synthetic documents created to fill gaps in coverage, using natural language generation or manually crafted examples that replicate realistic clinical language while containing inserted identifiers
  - All documents must undergo secondary de-identification to remove any residual identifiers before use in validation testing

- **Document length and complexity:**
  - Minimum 5 pages per document (typical psychological evaluations are 10-25 pages)
  - Include documents with complex narratives, multiple collateral sources, detailed case history sections
  - Include documents with appendices, charts, and mixed formatting

**Corpus Management:**
- Corpus version controlled; validation results keyed to specific corpus version
- Corpus stored securely with access limited to validation team members
- Corpus reviewed and updated quarterly to reflect new document types or formats encountered in production use
- All test documents marked with unique corpus ID and version number

### B. Annotation Protocol

Manual annotation of the test corpus is critical for establishing the ground truth against which the Presidio pipeline's performance will be measured.

**Annotation Standards:**
- Each document annotated independently by two clinical reviewers (Reviewer A: Clinical Advisor/Psychologist; Reviewer B: Second independent psychologist or trained research assistant)
- Both reviewers blind to each other's annotations
- Annotation performed using structured annotation tool (e.g., Tagtog, Label Studio, or custom Python script)
- For each identified PHI instance, the annotator records:
  - **Text span:** Exact text from the document
  - **Character offsets:** Start and end position in document
  - **Identifier category:** Which of the 18 categories (1-18)
  - **Entity type:** Descriptive entity type (e.g., PERSON, LOCATION, DATE_OF_BIRTH)
  - **Context:** Surrounding sentence or clause for disambiguation
  - **Certainty:** Annotator's confidence that this is an identifier (high/medium/low)

**Inter-Rater Reliability:**
- Calculate Cohen's kappa coefficient for overall agreement and per-category agreement
- Target: Cohen's kappa ≥ 0.90 (indicating strong agreement)
- If kappa <0.90 for a specific category, that category is subject to:
  - Third-party adjudication: A third reviewer (Privacy Officer or Compliance Counsel) reviews disagreements and renders final judgment
  - Root cause analysis: Determine whether the annotation instructions were ambiguous and clarify for all annotators
- Document final kappa score and any categories requiring adjudication in validation report

**Adjudication Protocol for Disagreements:**
- If Reviewer A and Reviewer B disagree on whether a text span is an identifier:
  - Third reviewer (independent adjudicator) reviews the text, category, and context
  - Adjudicator's decision is treated as ground truth for that instance
  - Disagreement patterns are analyzed to improve annotation guidelines
- If both reviewers agree but adjudicator disagrees, the adjudicator's judgment prevails
- All adjudication decisions documented with reasoning

### C. Metrics

Performance of the Presidio-based pipeline is evaluated using standard information retrieval metrics, calculated per identifier category and in aggregate.

**Primary Metrics:**

1. **Recall (Sensitivity):**
   - Formula: TP / (TP + FN)
   - Definition: Of all actual identifiers in the test corpus (ground truth), what percentage did the pipeline detect?
   - Interpretation: Low recall = identifiers are being missed and may leak to LLM providers
   - **Targets by category:**
     - Categories 1-7 (high-risk: names, locations, dates, phone, fax, email, SSN): Recall ≥ 100% for categories 1, 7; Recall ≥ 99.5% for categories 2-6
     - Categories 8-18 (lower-risk or specialized): Recall ≥ 99% for categories 8-12; Recall ≥ 95% for categories 13-18
     - **Overall target:** Recall ≥ 99%

2. **Precision:**
   - Formula: TP / (TP + FP)
   - Definition: Of all text spans flagged by the pipeline as identifiers, what percentage are actually identifiers (ground truth)?
   - Interpretation: Low precision = many false alarms; high false positives may result in over-redaction, reducing clinical utility
   - **Target:** Precision ≥ 90%
   - Rationale: False positives are acceptable (conservative = safe); false negatives are breaches (unacceptable)

3. **F1 Score (Harmonic Mean of Precision and Recall):**
   - Formula: 2 × (Precision × Recall) / (Precision + Recall)
   - Definition: Single metric balancing precision and recall
   - **Target:** F1 ≥ 0.95 overall

**Secondary Metrics:**

4. **False Negative Analysis:**
   - Count and categorize all identifiers missed by the pipeline
   - For each false negative, document:
     - Exact text and category
     - Why the pipeline missed it (model error, regex mismatch, low confidence)
     - Remediation strategy (new recognizer, regex refinement, confidence threshold adjustment)
     - Severity (critical, high, medium, low)

5. **False Positive Analysis:**
   - Count and categorize all non-identifiers flagged as identifiers
   - For each false positive, document:
     - Exact text, detected entity type, and why it was flagged
     - Root cause (model overgeneralization, regex too broad, context not considered)
     - Remediation strategy
     - Impact on clinical utility (i.e., if clinician must manually approve this replacement, does it significantly burden review?)

6. **Confidence Score Distribution:**
   - For each entity detected, Presidio assigns a confidence score (0.0-1.0)
   - Analyze distribution of confidence scores for true positives vs. false positives
   - Determine optimal confidence threshold for flagging entities to PHI Review Queue (default: 0.75)

**Reporting:**
- Results reported in matrix format:
  - Rows: Identifier categories (1-18)
  - Columns: TP, FP, FN, Recall, Precision, F1
  - Include aggregate row (all categories combined)
- Report generated for each validation run with date, corpus version, pipeline version, and reviewer identities
- Results archived in validation repository for trend analysis over time

### D. Failure Modes and Remediation

When the pipeline fails to meet target metrics, a structured remediation process ensures systematic improvement.

**Remediation Workflow:**

1. **Failure Identification:**
   - For each identifier with Recall <99% or Precision <90%, perform root cause analysis
   - Categorize root cause:
     - **Model limitation:** spaCy NER does not recognize entity type (e.g., certain cultural name formats)
     - **Regex mismatch:** Custom regex pattern does not match actual format of identifier
     - **Confidence threshold:** Entity correctly detected but confidence score below threshold, causing automatic replacement to be suppressed
     - **Context error:** Presidio detects entity but context rules incorrectly suppress it (false negative)
     - **Over-generalization:** Regex or model too broad, causing false positives

2. **Remediation Implementation:**
   - **For model limitations:**
     - Add examples of missed entity types to spaCy custom training corpus
     - Retrain spaCy NER model on augmented corpus
     - Test on subset of validation corpus before full re-validation
   - **For regex mismatches:**
     - Analyze false negative instances to identify pattern(s) not covered by current regex
     - Refine regex to cover new patterns while maintaining precision
     - Test refined regex against known false positives to avoid overgeneralization
   - **For confidence threshold issues:**
     - Analyze confidence score distribution for category
     - If many correct detections have confidence <0.75, lower threshold
     - Evaluate resulting increase in false positives; if acceptable, retain lower threshold
   - **For context errors:**
     - Review context rules; add exceptions or refinements
     - Implement additional context patterns
   - **For over-generalization:**
     - Add negative examples to Presidio recognizer to suppress false positives
     - Refine regex to reduce false positive rate

3. **Remediation Testing:**
   - After remediation, re-validate on 20% sample of test corpus to verify improvement
   - Full re-validation when multiple categories are remediated simultaneously
   - Document each remediation in pipeline change log with:
     - Date, category, specific failure
     - Remediation description
     - Before/after metrics
     - Validation date

4. **Escalation and Pause:**
   - If any category remains at Recall <98% after two remediation cycles, escalate to Privacy Officer
   - Consider temporary pause of automatic de-identification for that category; require manual review of all instances
   - For categories 1, 7 (names, SSN), failure to reach 100% recall triggers immediate investigation and potential system pause pending fix

---

## V. PIPELINE ARCHITECTURE

Psygil's de-identification pipeline is implemented as a Python microservice sidecar that interfaces with the LLM Gateway. The architecture ensures:

1. **Local processing:** Presidio analyzer runs on-premises; PII is never transmitted to external services
2. **Stateless replacements:** Placeholder mappings are stored locally and never transmitted with de-identified text
3. **Re-identification capability:** Authorized clinicians can locally reverse de-identification to view original data

**Technical Flow:**

1. **Input Reception:**
   - Clinical document (text-based) received by frontend; user initiates LLM query
   - Raw text passed to Python sidecar via Unix domain socket (inter-process communication, no network exposure)

2. **Presidio Analyzer Execution:**
   - Analyzer initializes with:
     - spaCy model: en_core_web_lg (English, trained on diverse corpus including medical text)
     - Custom recognizers: 10+ recognizers for identifier categories 8-18 (medical record #, insurance #, account #, license #, vehicle ID, device ID, URLs, IP addresses, biometric refs, case numbers)
     - Regex patterns for structured identifiers (SSN, phone, dates, zip codes)
   - All entities in text analyzed; each entity assigned:
     - Entity type (e.g., PERSON, DATE_OF_BIRTH, LOCATION)
     - Confidence score (0.0-1.0)
     - Character offsets (start, end position)
     - Entity value (text span)

3. **Confidence-Based Filtering:**
   - Entities with confidence ≥0.75 automatically processed for replacement
   - Entities with confidence <0.75 and ≥0.50 flagged for PHI Review Queue (if enabled)
   - Entities with confidence <0.50 discarded as likely false positives (not flagged)

4. **Presidio Anonymizer:**
   - For each entity meeting replacement criteria, Anonymizer generates:
     - Placeholder token: `[ENTITY_TYPE_N]` (where N is incrementing integer within document scope)
     - Original value recorded in local mapping table (not transmitted)
   - Anonymizer returns de-identified text with placeholders
   - Mapping table: `{placeholder: original_value, entity_type: category, position: [start, end], confidence: score}`

5. **PHI Review Queue (Optional):**
   - If enabled (default: enabled for first 30 days of deployment), low-confidence entities (0.50-0.75) presented to clinician
   - UI displays:
     - De-identified text with low-confidence entities highlighted in amber
     - Original text shown in side-by-side view (with original identifiers visible to clinician only)
     - For each flagged entity: suggested entity type, confidence score, and surrounding context
   - Clinician actions:
     - **Approve:** Accept default replacement
     - **Override:** Correct entity type or value, or mark as not-an-identifier
     - **Cancel:** Cancel LLM transmission; user may edit document and retry
   - All PHI Review Queue decisions logged to audit trail with timestamp, user ID, decision type, entity details

6. **LLM Transmission:**
   - De-identified text (with placeholders, not original identifiers) passed to LLM Gateway
   - Mapping table remains on-premises; never transmitted
   - LLM provider (Anthropic, OpenAI) processes only de-identified text
   - All processing per Business Associate Agreement (BAA)

7. **LLM Response:**
   - LLM response received by gateway
   - Response contains de-identified text and any generated text with placeholders preserved
   - Example: "Based on [DATE_1] evaluation showing [PERSON_1] scored in the [IDENTIFIER_1] percentile..."

8. **Local Re-Identification:**
   - Before presenting to clinician, Python sidecar reverse-maps placeholders
   - Mapping table consulted; each placeholder replaced with original value
   - Example: `[DATE_1]` → "March 15, 2026", `[PERSON_1]` → "Jane Chen"
   - Re-identified response displayed to clinician

9. **Logging and Audit Trail:**
   - Every de-identification request logged with:
     - Timestamp, user ID, document ID
     - Number of entities detected, by type
     - Number of entities automatically replaced
     - Number of entities flagged for manual review
     - User decisions (approve, override, cancel)
     - LLM provider, request timestamp
   - All data PII data (mapping tables, logs with identifiers) encrypted at rest and accessible only to authorized users
   - Audit trail regularly reviewed for anomalies (e.g., unusually high missed entity counts)

---

## VI. PHI REVIEW QUEUE

The PHI Review Queue is an optional feature that enhances de-identification assurance by allowing authorized clinicians to review and approve low-confidence entity detections before transmission to LLM providers.

**Configuration:**
- Enabled by default for the first 30 calendar days of deployment
- After 30 days, may be disabled if false negative rate is sufficiently low (Recall >99% for all categories)
- May be re-enabled at any time via administration settings

**User Experience:**
- When clinician initiates LLM request, system detects low-confidence entities (0.50-0.75)
- If any low-confidence entities present, UI displays PHI Review screen:
  - Left panel: De-identified text with low-confidence entities highlighted in amber boxes
  - Right panel: Original text (visible to clinician only) with detected entities highlighted
  - Entity list panel: For each detected entity:
    - Entity type (auto-detected by Presidio)
    - Confidence score
    - Text snippet with context
    - Action buttons: "Approve", "Override", "Remove"

**Clinician Actions:**
- **Approve:** Accept entity replacement; proceed to LLM transmission
- **Override:** Manually correct entity type, modify replacement value, or mark as non-identifier
  - Example: "Presidio tagged '555-0142' as PHONE_NUMBER (confidence 0.65). Override: This is not a phone number; remove flagging."
- **Remove flagging:** Mark detected entity as not-an-identifier; proceed without replacement
- **Mark all as reviewed:** Clinician can approve all low-confidence entities at once; useful if flagging is noisy

**Approval Workflow:**
- Clinician reviews all flagged entities
- Clinician clicks "Confirm and Send to LLM" to proceed
- System logs all clinician decisions to audit trail
- De-identified text (with any user overrides applied) transmitted to LLM

**Disable Workflow:**
- After 30 days of operation, system administrator reviews false negative audit
- If Recall >99% across all categories, PHI Review Queue automatically disabled
- Clinician receives notification: "PHI Review Queue has been disabled. Low-confidence entities are now automatically replaced."
- Clinician may manually re-enable if preferred via settings

---

## VII. ONGOING MONITORING

Continuous monitoring of the de-identification pipeline ensures sustained compliance with Safe Harbor requirements and detects any degradation in performance.

**Monthly False Negative Audit:**
- Every 30 calendar days, sampling process executes:
  - Random sample of 10% of processed documents from the prior month (minimum 50 documents)
  - For each sampled document, manual review by clinical reviewer to identify any missed identifiers
  - Comparison to Presidio output: identifiers detected by manual review but missed by Presidio = false negatives
  - Compilation of false negative instances by category
  - If false negative rate exceeds 1% for any category, trigger immediate investigation

**Quarterly Full Validation:**
- Every 90 calendar days, full validation against updated test corpus
  - Test corpus updated to reflect new document types or formats encountered
  - Corpus size maintained at minimum 50 documents; additions made if significant gaps identified
  - Full validation metrics (Recall, Precision, F1) calculated per category and in aggregate
  - Results compared to prior quarter; significant drops (>2% change) trigger investigation
  - Report generated and reviewed by Privacy Officer

**Model Update Protocol:**
- Presidio and spaCy models receive updates periodically (quarterly or upon critical security/accuracy fixes)
- When updates released:
  - Staging environment updated first
  - Small test run (5-10 documents) executed in staging
  - If performance maintained or improved, production deployment scheduled
  - If performance degrades, investigate cause and determine whether to defer update or implement compensating controls (e.g., stricter confidence thresholds)
  - Full validation scheduled within 30 days of production deployment

**Anomaly Detection:**
- Audit trail analyzed monthly for anomalies:
  - Unusually high percentage of PHI Review Queue escalations (suggests NLP degradation)
  - Sudden spike in entity detection (suggests regex overgeneralization)
  - High rate of clinician overrides (suggests model is frequently incorrect)
  - Geographic or timing patterns in missed entities (suggests document type bias)
- Any anomaly triggers root cause analysis and potential remediation

**Confirmed False Negative Response:**
- If a false negative is confirmed (PHI leaked to LLM provider):
  1. **Immediate actions (within 24 hours):**
     - Pause all LLM transmissions
     - Identify scope: which documents, which identifiers, which provider
     - Verify data handling by LLM provider per BAA (request confirmation of data deletion)
  2. **Investigation (within 5 business days):**
     - Root cause analysis: why was the identifier missed? (model error, regex failure, edge case)
     - Determine if false negative is isolated or systemic (one-off or pattern)
     - If systemic, implement immediate fix (new recognizer, regex refinement, confidence threshold adjustment)
  3. **Validation (within 10 business days):**
     - Full re-validation against test corpus
     - Confirm Recall restored to ≥99% for affected category
  4. **Notification and reporting:**
     - If breach determination required under HIPAA Breach Notification Rule, execute notification process (45 CFR Part 164, Subpart D)
     - Report to HHS OCR if breach notification required
     - Internal incident report generated; filed with Privacy Officer and Compliance team
  5. **Resume transmission:**
     - Only after successful full re-validation and explicit approval from Privacy Officer

---

## VIII. COMPLIANCE DOCUMENTATION

Psygil maintains a comprehensive documentation repository to support ongoing HIPAA compliance and facilitate regulatory audits.

**Living Documentation:**
- This protocol document (03_HIPAA_Safe_Harbor_Validation.md) maintained as a "living document"
- Updates made whenever:
  - Validation methodology changes
  - New identifier categories added
  - Pipeline architecture modified
  - Lessons learned from audit findings
- All changes tracked in version history with date, author, and description of change
- Previous versions archived for audit trail

**Validation Test Results Archive:**
- Each validation run produces a results report containing:
  - Date of validation, corpus version, pipeline version
  - Metrics per category: TP, FP, FN, Recall, Precision, F1
  - False negative details (text, category, root cause)
  - False positive details (text, detected type, reason for flag)
  - Confidence score distribution histogram
  - Any remediation steps taken since last validation
- Reports archived in `/mnt/Psygil/compliance/validation_results/` directory
- Reports accessible to Privacy Officer, Compliance team, and external auditors

**Remediation Log:**
- Centralized log maintained in `/mnt/Psygil/compliance/remediation_log.md`
- Each remediation entry contains:
  - Date of remediation
  - Category and specific failure (e.g., "Category 1 (Names): Missing cultural names")
  - Description of remediation (e.g., "Added 50 non-Western names to spaCy training corpus")
  - Validation date confirming fix
  - Before/after metrics
  - Owner/implementer

**Annual Compliance Review:**
- Each calendar year, Privacy Officer and Compliance Counsel review:
  - All validation test results from prior 12 months
  - All remediation actions taken
  - Any false negatives or confirmed breaches
  - Changes in regulatory landscape or HIPAA guidance
  - Feedback from users and clinicians
- Annual review report generated; filed with leadership and board of directors if applicable
- Review results inform next year's compliance objectives and priorities

---

## IX. BREACH RESPONSE PROTOCOL

In the unlikely event that PHI is confirmed to have been transmitted to an LLM provider despite de-identification efforts, Psygil follows this structured response protocol to meet HIPAA Breach Notification Rule obligations and minimize harm.

**Scope Determination (within 24 hours):**
1. Identify affected documents: which documents contained undetected PHI?
2. Identify scope of breach: what identifiers were transmitted? (names, SSNs, medical record numbers, etc.)
3. Identify affected individuals: how many patients' information was potentially exposed?
4. Identify affected LLM provider: which provider (Anthropic, OpenAI, or other)?
5. Determine transmission date and time

**Provider Notification and Data Handling (within 48 hours):**
1. Immediately contact LLM provider's security/privacy team
2. Invoke BAA breach notification clause
3. Request confirmation:
   - Has provider access and delete the transmitted data?
   - Has data been retained, copied, or shared with any third parties?
   - What data retention or deletion timeline applies?
4. Request written confirmation of data handling
5. If provider cannot confirm deletion, escalate to legal counsel and Privacy Officer

**Breach Risk Assessment (within 5 business days):**
Determine whether breach notification is required under 45 CFR § 164.400 et seq. (Breach Notification Rule).

Key factors:
- **Nature of information:** What identifiers were exposed? (SSN and date of birth = high risk; zip code and general date = low risk)
- **Context of breach:** To whom was it disclosed? (LLM provider is a BAA partner; risk lower than public disclosure, but still present due to cloud infrastructure)
- **Protective measures:** Were any protective measures in place? (encryption, access controls, etc.)
- **Mitigation:** Has the exposed information been returned or destroyed?

Standard: A breach requires notification if there is a reasonable basis to conclude that the protected health information has been compromised. Compromise is presumed unless the covered entity demonstrates that there is a low probability that the PHI has been compromised.

**Notification Decision:**
- **No notification required:** If risk assessment concludes PHI not compromised (e.g., only zip code and age, both non-specific)
- **Notification required:** If PHI reasonably compromised (e.g., name, SSN, date of birth transmitted)

**If Notification Required (within 60 days of discovery):**

1. **Individual notification (45 CFR § 164.404):**
   - Send written notice to each affected individual at last known address
   - Notice must include:
     - Date, time of breach (or best estimate)
     - Description of type of information involved
     - Steps individual should take to protect against identity theft
     - What Psygil is doing to investigate and prevent future breaches
     - Psygil contact information (phone number, address, website)
   - Notice must be written in plain language
   - Timeframe: Without unreasonable delay, no later than 60 calendar days after discovery of breach

2. **Media notification (45 CFR § 164.406):**
   - If breach affects more than 500 residents of a state or jurisdiction, notify prominent media in affected state/jurisdiction
   - Notification includes: nature of breach, number of individuals affected, description of steps Psygil is taking
   - Timeframe: Same as individual notification (within 60 days)

3. **HHS OCR notification (45 CFR § 164.408):**
   - If breach affects more than 500 U.S. residents, notify HHS Office for Civil Rights
   - Notification includes: date, time of breach, scope, steps being taken
   - Timeframe: At time of media notification (or earlier if individual notification complete before 60 days)
   - If breach affects fewer than 500 residents, maintain records of breach and report to HHS OCR upon request

4. **State attorney general notification:**
   - In some states, state attorney general must be notified of breaches affecting residents of that state
   - Requirements vary by state; consult state breach notification law

**Root Cause Analysis and Remediation (within 10 business days):**
1. Forensic analysis: Why was the identifier missed? Investigate:
   - Was it a model error (NER failure to recognize)?
   - Was it a regex failure (pattern not covered)?
   - Was it a confidence threshold issue (entity detected but confidence below threshold)?
   - Was it an edge case (unusual format, abbreviation, etc.)?
2. Determine if isolated incident or systemic pattern:
   - Isolated: One-off failure, limited scope
   - Systemic: Pattern suggests broader vulnerability
3. Implement immediate remediation:
   - New recognizer, expanded regex, adjusted confidence threshold, or other fix
4. Re-validate pipeline: Run full validation to confirm Recall ≥99% for all categories

**Prevention of Future Breaches:**
1. Implement compensating controls if needed (e.g., temporarily lower confidence threshold, re-enable PHI Review Queue)
2. Enhance monitoring and auditing (more frequent false negative sampling)
3. Consider architectural changes (e.g., add secondary de-identification step)
4. Training for users and clinicians on de-identification features and limitations

**Incident Reporting:**
1. Internal incident report to leadership and board
2. Documentation in compliance file for regulatory review
3. Disclosure to insurance carrier if applicable

---

## X. APPENDIX

### A. Complete Text of 45 CFR § 164.514(b)(2) — Safe Harbor Method

[This section would include the full regulatory text verbatim. For this document, the key language is included in Section II above.]

**Safe Harbor Standard (45 CFR § 164.514(b)(2)):**

"(2) De-identification of a limited data set. If the data are part of a limited data set, the covered entity may use the following identifiers, which shall apply only to the patient, members of the patient's family, and any employer of the patient, in the de-identification process set forth in paragraph (b)(1) of this section and the de-identified information shall not be treated as identifiable health information, provided that the requirements of paragraphs (b)(2)(i) and (ii) of this section are met:

(i) City, state, ZIP code, and their more specific subdivisions.
(ii) The covered entity may permit data users to receive dates instead of year when necessary for research purposes or public health activities."

[Additional regulatory context from 45 CFR § 164.514(b)(1) on the Safe Harbor method and the 18 identifiers is incorporated in Section II above.]

### B. Presidio Entity Type Reference Table

| Presidio Entity Type | Identifier Category | Custom Recognizer Required? | Confidence Threshold |
|---|---|---|---|
| PERSON | 1 (Names) | No (spaCy NER) | 0.75 |
| LOCATION | 2 (Geographic) | Supplementary regex | 0.75 |
| DATE_TIME | 3 (Dates) | Supplementary regex | 0.75 |
| PHONE_NUMBER | 4 (Phone) | Supplementary regex | 0.80 |
| PHONE_NUMBER | 5 (Fax) | Context-dependent | 0.80 |
| EMAIL_ADDRESS | 6 (Email) | No (Presidio built-in) | 0.75 |
| US_SSN | 7 (SSN) | No (Presidio built-in) | 0.90 |
| (Custom) | 8 (Medical Record #) | Yes | 0.80 |
| (Custom) | 9 (Insurance #) | Yes | 0.80 |
| (Custom) | 10 (Account #) | Yes | 0.75 |
| (Custom) | 11 (License #) | Yes | 0.80 |
| (Custom) | 12 (Vehicle ID) | Yes | 0.85 |
| (Custom) | 13 (Device ID) | Yes | 0.80 |
| URL | 14 (URLs) | No (Presidio built-in) | 0.75 |
| IP_ADDRESS | 15 (IP Address) | No (Presidio built-in) | 0.90 |
| (Custom) | 16 (Biometric) | Yes | 0.90 |
| (N/A) | 17 (Photos) | Not applicable (text only) | N/A |
| (Custom) | 18 (Case/Docket #) | Yes | 0.85 |

### C. Sample De-Identified Document (Before/After)

**BEFORE DE-IDENTIFICATION (Original, with all identifiers):**

```
PSYCHOLOGICAL EVALUATION REPORT

Patient Name: Jane Maria Chen
Date of Birth: November 14, 1976 (Age: 49)
Evaluation Date: March 15, 2026
Referral Source: Attorney James Mitchell (Phone: 720-555-0199, Email: james.mitchell@lawfirm.com)
Court Case: District Court Case No. 2024-CV-012345
Judge: Hon. Patricia Hoffmann

Address: 742 Maple Drive, Apartment 3B, Denver, CO 80202
Phone: 303-555-0142 (home); 720-555-0198 (mobile)
Insurance: Blue Cross Blue Shield, Member ID: 98765432X
Medical Record Number: 987654

Referring Psychologist: Dr. Robert Patel, License #: PA-123456
Clinic: Mountain View Psychological Services, 1500 Arapahoe Street, Suite 200, Denver, CO 80205

[Clinical narrative describing evaluation...]

The patient reported her ex-husband, Michael Chen, contacted her two weeks before the evaluation to discuss custody arrangements. The alleged incident occurred December 10, 2024, in Denver. Court-ordered evaluation completed March 15, 2026.

Collateral contact: Patricia Rodriguez (maternal aunt), Phone: 303-555-0115, Email: patricia.rodriguez@company.com

[Psychological findings and recommendations...]
```

**AFTER DE-IDENTIFICATION (With placeholders):**

```
PSYCHOLOGICAL EVALUATION REPORT

Patient Name: [PERSON_1]
Date of Birth: [DATE_1] (Age: [AGE_1])
Evaluation Date: [DATE_2]
Referral Source: Attorney [PERSON_2] (Phone: [PHONE_1], Email: [EMAIL_1])
Court Case: District Court Case No. [CASE_NUMBER_1]
Judge: Hon. [PERSON_3]

Address: [LOCATION_1]
Phone: [PHONE_2] (home); [PHONE_3] (mobile)
Insurance: [INSURANCE_NAME_1], Member ID: [INSURANCE_ID_1]
Medical Record Number: [MRN_1]

Referring Psychologist: Dr. [PERSON_4], License #: [LICENSE_1]
Clinic: [LOCATION_2], [LOCATION_3]

[Clinical narrative describing evaluation...]

The patient reported her ex-husband, [PERSON_5], contacted her two weeks before the evaluation to discuss custody arrangements. The alleged incident occurred [DATE_3], in [LOCATION_4]. Court-ordered evaluation completed [DATE_4].

Collateral contact: [PERSON_6] (maternal aunt), Phone: [PHONE_4], Email: [EMAIL_2]

[Psychological findings and recommendations...]
```

**Notes:**
- All 18 identifiers are represented in this example
- Placeholder mapping (stored locally only):
  - `[PERSON_1]` → "Jane Maria Chen"
  - `[DATE_1]` → "November 14, 1976"
  - `[PERSON_2]` → "James Mitchell"
  - etc.
- De-identified text is transmitted to LLM provider; mapping remains on-premises
- When LLM response received, placeholders are re-identified locally before display to clinician

### D. Validation Test Result Template

**Psygil PII Detection Pipeline — Validation Test Report**

**Report Date:** [YYYY-MM-DD]
**Corpus Version:** [e.g., v2.1_2026-Q1]
**Pipeline Version:** [e.g., Presidio 0.10.0, spaCy en_core_web_lg v3.7]
**Reviewers:** [Name 1, Name 2]
**Validator (Report Author):** [Name]

**Executive Summary:**
[1-2 paragraph summary of validation results, key findings, any remediation required]

**Detailed Results by Category:**

| Category | Identifier Type | TP | FP | FN | Recall | Precision | F1 | Target Met? |
|---|---|---|---|---|---|---|---|---|
| 1 | Names | 145 | 2 | 0 | 100% | 98.6% | 0.993 | ✓ |
| 2 | Geographic | 89 | 5 | 1 | 98.9% | 94.7% | 0.968 | ✓ |
| ... | ... | ... | ... | ... | ... | ... | ... | ... |
| 18 | Case/Docket # | 42 | 3 | 0 | 100% | 93.3% | 0.965 | ✓ |
| **TOTAL** | **All Categories** | **[N]** | **[N]** | **[N]** | **99.2%** | **92.5%** | **0.958** | **✓** |

**Aggregate Metrics:**
- Overall Recall: 99.2% (Target: ≥99.0%) — **MET**
- Overall Precision: 92.5% (Target: ≥90.0%) — **MET**
- Overall F1: 0.958 (Target: ≥0.95) — **MET**

**False Negative Analysis:**
[Detailed list of all false negatives with category, text, root cause, remediation]

**False Positive Analysis:**
[Detailed list of all false positives with category, detected type, reason, clinical impact]

**Confidence Score Analysis:**
[Distribution histogram of confidence scores; analysis of threshold appropriateness]

**Remediation Since Last Validation:**
[List of improvements made since prior validation report]

**Recommendations:**
[Any recommended next steps, areas for improvement, or ongoing monitoring tasks]

---

## CONCLUSION

This HIPAA Safe Harbor De-Identification Validation Protocol provides Psygil with a comprehensive, legally compliant, and technically rigorous approach to de-identifying Protected Health Information before transmission to third-party AI language model providers. By adhering to the Safe Harbor standard defined in 45 CFR § 164.514(b)(2), implementing a validated Presidio-based detection pipeline, maintaining detailed validation testing and remediation logs, and following a structured breach response protocol, Psygil ensures that information transmitted to AI providers is no longer Protected Health Information under HIPAA. This protocol document serves as both an engineering specification for the technical implementation and legal compliance documentation to support regulatory audit and oversight.

---

**Document Control**

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-03-19 | Psygil Compliance | Initial document creation |

---

**Approval Signatures**

| Role | Name | Signature | Date |
|---|---|---|---|
| Privacy Officer | [Name] | [Signature] | [Date] |
| Chief Compliance Officer | [Name] | [Signature] | [Date] |
| Legal Counsel | [Name] | [Signature] | [Date] |

