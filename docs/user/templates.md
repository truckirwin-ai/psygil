# Templates

What this covers: what report templates are, how to upload your own, the placeholder token syntax, and how templates relate to the Writer agent's output.

---

## What a Template Is

A report template is a `.docx` file structured as a report skeleton. It contains section headings, boilerplate text, and placeholder tokens. When the Writer agent generates a report draft for a case, it uses the template matching that case's evaluation type as its structural blueprint: the section order, required headings, and standard language come from the template.

Seven templates ship with Psygil v1.0:

| Evaluation Type | Template File |
|---|---|
| Competency to Stand Trial | `report_cst.docx` |
| Child Custody Evaluation | `report_custody.docx` |
| Violence/Sexual Reoffense Risk | `report_risk_assessment.docx` |
| Fitness for Duty | `report_fitness_for_duty.docx` |
| PTSD Diagnostic Evaluation | `report_ptsd_dx.docx` |
| ADHD Diagnostic Evaluation | `report_adhd_dx.docx` |
| Malingering Assessment | `report_malingering.docx` |

These built-in templates follow APA forensic report conventions: referral question, procedures, records reviewed, background history, mental status exam, test results, clinical formulation, and opinion to a reasonable degree of psychological certainty.

---

## Placeholder Token Syntax

Templates use double-brace mustache-style tokens: `{{TOKEN_NAME}}`.

There are two categories:

### Practice-Level Tokens

These are replaced once at provisioning time, when you upload a template. Values come from the profile you entered during setup.

| Token | Replaced With |
|---|---|
| `{{PRACTICE_NAME}}` | Your practice name |
| `{{CLINICIAN_FULL_NAME}}` | Your full name as entered in setup |
| `{{CLINICIAN_CREDENTIALS}}` | e.g., `Psy.D., ABPP` |
| `{{CLINICIAN_LICENSE}}` | Your license number |
| `{{CLINICIAN_STATE}}` | Your license state |
| `{{PRACTICE_ADDRESS}}` | Practice street address |
| `{{PRACTICE_PHONE}}` | Practice phone number |

Once provisioned, these tokens are replaced with your values in every template. You do not need to fill them in per case.

### Patient-Level Tokens

These remain in the template as-is. The Writer agent fills them in from the case record when generating a draft.

| Token | Description |
|---|---|
| `{{PATIENT_NAME}}` | Patient full name |
| `{{DATE_OF_BIRTH}}` | Patient date of birth |
| `{{CASE_NUMBER}}` | Case number |
| `{{REFERRING_PARTY}}` | Attorney, court, or referring agency |
| `{{DATE_OF_REPORT}}` | Date the report is signed |
| `{{DATES_OF_CONTACT}}` | All evaluation appointment dates |
| `{{COURT_NAME}}` | Court name, for forensic evaluations |
| `{{DOCKET_NUMBER}}` | Docket or cause number |
| `{{JURISDICTION}}` | State or jurisdiction |

If a patient-level token cannot be filled from the case record, it is left in the draft with a highlighted flag so you can fill it manually.

---

## Uploading a Custom Template

Go to Settings > Templates. Click Upload Template.

Select your `.docx` file. The app:
1. Parses the file and identifies all `{{TOKEN_NAME}}` tokens present.
2. Prompts you to select which evaluation type this template applies to.
3. Replaces all practice-level tokens with your profile values.
4. Saves the provisioned template to `{workspace}/templates/`.

If your file uses a token the app does not recognize, the token is preserved as-is and noted in the upload summary. You can either add the token to the file's normal text (removing the double-brace syntax) or use a supported token name.

You can upload multiple templates for the same evaluation type. When generating a report, Psygil uses the most recently uploaded template for that type. To make an older template active again, go to Settings > Templates and click Set as Active next to it.

---

## Customizing Templates by Jurisdiction or Evaluation Subtype

A common pattern is to maintain one template per jurisdiction where you practice regularly. For example:

- `cst_colorado.docx` uses Colorado competency statutory language.
- `cst_federal.docx` uses the Dusky standard and federal procedural language.

Each file is uploaded as a separate template for the CST evaluation type. Before generating a report, select the appropriate template in Settings > Templates or in the Report panel of the specific case.

You can also create evaluation-subtype variants. For example, separate templates for adult and juvenile custody evaluations, or for initial risk assessments versus risk reassessments.

---

## How Templates Drive Writer Agent Output

When you click Generate Draft in Stage 4: Review, the app passes two things to the Writer agent:

1. The assembled case record (demographics, test scores, interview notes, diagnostic formulation, all PHI-redacted before transmission).
2. The active template for the case's evaluation type, converted to a structural outline.

The Writer agent uses the template's section order and headings as the report structure. It fills each section with prose derived from the case record. It does not reorder sections or add headings that are not in the template.

If a section in the template has no corresponding data in the case record, the Writer agent leaves the section with a `draft_requiring_revision` flag and a note explaining what data is missing.

The generated draft is editable. The template affects structure; final prose is always yours to revise.

---

## See Also

- [walkthrough.md](./walkthrough.md): Stage 4 (Review) where the Writer agent generates the draft
- [ai-assistant.md](./ai-assistant.md): What the Writer and Editor agents do
- [quick-start.md](./quick-start.md): Setting up clinical preferences and evaluation types
