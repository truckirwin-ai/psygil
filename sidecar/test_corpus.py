"""Test corpus for de-identification verification.

Contains 50+ forensic psychology text samples with annotated PHI entities.
Used by test_deidentification.py to verify PII detection, redaction, and recall.
"""

# Each item has:
#   "text": the full test text
#   "expected_phi": list of PHI entities with text and type
#   "context": where this would appear in the workflow (intake, report, etc.)

TEST_CORPUS = [
    # ========================================================================
    # CATEGORY A: Individual Entity Types (18+ tests)
    # ========================================================================

    # 1. PERSON — Names
    {
        "text": "Marcus D. Johnson was referred for competency evaluation.",
        "expected_phi": [
            {"text": "Marcus D. Johnson", "type": "PERSON"}
        ],
        "context": "intake"
    },
    {
        "text": "The patient, Sarah Chen-Liu, has a significant psychiatric history.",
        "expected_phi": [
            {"text": "Sarah Chen-Liu", "type": "PERSON"}
        ],
        "context": "intake"
    },
    {
        "text": "Contact: Attorney Robert J. Matthews (referral source)",
        "expected_phi": [
            {"text": "Robert J. Matthews", "type": "PERSON"}
        ],
        "context": "intake"
    },

    # 2. DATE_TIME / DOB — Dates of birth
    {
        "text": "Patient DOB: 03/15/1988",
        "expected_phi": [
            {"text": "03/15/1988", "type": "DATE_TIME"}
        ],
        "context": "intake"
    },
    {
        "text": "Date of birth: March 22, 1976",
        "expected_phi": [
            {"text": "March 22, 1976", "type": "DATE_TIME"}
        ],
        "context": "intake"
    },
    {
        "text": "Subject born 1985-07-14 in Colorado",
        "expected_phi": [
            {"text": "1985-07-14", "type": "DATE_TIME"}
        ],
        "context": "intake"
    },

    # 3. PHONE_NUMBER — Telephone numbers
    {
        "text": "Contact: (303) 555-0147",
        "expected_phi": [
            {"text": "(303) 555-0147", "type": "PHONE_NUMBER"}
        ],
        "context": "intake"
    },
    {
        "text": "Fax: 720-555-0123 ext. 456",
        "expected_phi": [
            {"text": "720-555-0123", "type": "PHONE_NUMBER"}
        ],
        "context": "intake"
    },
    {
        "text": "Reach him at 555-0198 during business hours",
        "expected_phi": [
            {"text": "555-0198", "type": "PHONE_NUMBER"}
        ],
        "context": "intake"
    },

    # 4. EMAIL_ADDRESS — Email addresses
    {
        "text": "Email: marcus.johnson@email.com",
        "expected_phi": [
            {"text": "marcus.johnson@email.com", "type": "EMAIL_ADDRESS"}
        ],
        "context": "intake"
    },
    {
        "text": "Contact the office at referrals@denverpsych.org",
        "expected_phi": [
            {"text": "referrals@denverpsych.org", "type": "EMAIL_ADDRESS"}
        ],
        "context": "intake"
    },

    # 5. US_SSN — Social Security numbers
    {
        "text": "SSN: 456-78-9012",
        "expected_phi": [
            {"text": "456-78-9012", "type": "US_SSN"}
        ],
        "context": "intake"
    },
    {
        "text": "Social security #123456789",
        "expected_phi": [
            {"text": "123456789", "type": "US_SSN"}
        ],
        "context": "intake"
    },

    # 6. LOCATION — Geographic data / addresses (street addresses)
    {
        "text": "Address: 1247 Elm Street, Denver, CO 80202",
        "expected_phi": [
            {"text": "1247 Elm Street, Denver, CO 80202", "type": "LOCATION"}
        ],
        "context": "intake"
    },
    {
        "text": "Resides at 555 Park Avenue, Apartment 12B, Boulder, Colorado",
        "expected_phi": [
            {"text": "555 Park Avenue, Apartment 12B, Boulder, Colorado", "type": "LOCATION"}
        ],
        "context": "intake"
    },
    {
        "text": "Subject's workplace: 1600 Acme Plaza, Denver, CO",
        "expected_phi": [
            {"text": "1600 Acme Plaza, Denver, CO", "type": "LOCATION"}
        ],
        "context": "intake"
    },

    # 7. MEDICAL_LICENSE — Medical record numbers / license numbers
    {
        "text": "Medical record #2026-0147",
        "expected_phi": [
            {"text": "2026-0147", "type": "MEDICAL_LICENSE"}
        ],
        "context": "intake"
    },
    {
        "text": "Case number: CR-2024-0089456",
        "expected_phi": [
            {"text": "CR-2024-0089456", "type": "MEDICAL_LICENSE"}
        ],
        "context": "intake"
    },

    # 8. US_BANK_NUMBER / Financial — Account numbers / health plan IDs
    {
        "text": "Insurance plan #4521 8847 9012 3456",
        "expected_phi": [
            {"text": "4521 8847 9012 3456", "type": "US_BANK_NUMBER"}
        ],
        "context": "intake"
    },

    # 9. US_DRIVER_LICENSE — License and certificate numbers
    {
        "text": "Driver license: D123456789",
        "expected_phi": [
            {"text": "D123456789", "type": "US_DRIVER_LICENSE"}
        ],
        "context": "intake"
    },
    {
        "text": "Professional license #PSY-456123",
        "expected_phi": [
            {"text": "PSY-456123", "type": "US_DRIVER_LICENSE"}
        ],
        "context": "intake"
    },

    # 10. IP_ADDRESS — Device identifiers / IP addresses
    {
        "text": "Server IP: 192.168.1.100",
        "expected_phi": [
            {"text": "192.168.1.100", "type": "IP_ADDRESS"}
        ],
        "context": "intake"
    },

    # 11. URL — Web URLs
    {
        "text": "Patient website: https://marcus-j-johnson.personal-site.com",
        "expected_phi": [
            {"text": "https://marcus-j-johnson.personal-site.com", "type": "URL"}
        ],
        "context": "intake"
    },

    # ========================================================================
    # CATEGORY B: Complex Paragraphs (10+ tests)
    # ========================================================================

    {
        "text": """Marcus D. Johnson (DOB: 03/15/1988) was referred by attorney Sarah Chen
of Chen & Associates (303-555-0199) for a competency to stand trial evaluation.
Mr. Johnson resides at 1247 Elm Street, Denver, CO 80202. His SSN is 456-78-9012.
The evaluation was conducted at Denver County Courthouse on 01/15/2026.""",
        "expected_phi": [
            {"text": "Marcus D. Johnson", "type": "PERSON"},
            {"text": "03/15/1988", "type": "DATE_TIME"},
            {"text": "Sarah Chen", "type": "PERSON"},
            {"text": "303-555-0199", "type": "PHONE_NUMBER"},
            {"text": "1247 Elm Street, Denver, CO 80202", "type": "LOCATION"},
            {"text": "456-78-9012", "type": "US_SSN"},
            {"text": "01/15/2026", "type": "DATE_TIME"},
        ],
        "context": "intake"
    },

    {
        "text": """Intake Summary:
Patient: Dr. Elizabeth Patterson, PhD
DOB: July 12, 1974
Contact: 720-555-0156 or e.patterson@medical-center.com
Address: 445 Medical Plaza Drive, Boulder, CO 80302
Evaluation Type: Custody determination
Referral from: Hon. Judge Margaret O'Brien, District Court

Ms. Patterson presents with significant history of treatment seeking.""",
        "expected_phi": [
            {"text": "Dr. Elizabeth Patterson", "type": "PERSON"},
            {"text": "July 12, 1974", "type": "DATE_TIME"},
            {"text": "720-555-0156", "type": "PHONE_NUMBER"},
            {"text": "e.patterson@medical-center.com", "type": "EMAIL_ADDRESS"},
            {"text": "445 Medical Plaza Drive, Boulder, CO 80302", "type": "LOCATION"},
            {"text": "Margaret O'Brien", "type": "PERSON"},
        ],
        "context": "intake"
    },

    {
        "text": """Clinical Referral Details:
Case ID: 2024-PSY-8847
Patient: Robert J. Martinez
Date of Birth: September 4, 1992
Home Phone: (719) 555-0189
Work Phone: (720) 555-0234 ext 123
Email: r.martinez@company.net
Address: 3200 Maple Drive, Apartment 42, Colorado Springs, CO 80910

Referred by: The Law Offices of Chen, Matthews & Associates
Attorney: Robert J. Matthews
Bar License: CO-54321

Evaluation ordered: 02/28/2026
Previous provider: Dr. James Wu, Clinical Psychology, Denver Forensic Services

Insurance: United Healthcare Plan #UH-456789-01""",
        "expected_phi": [
            {"text": "2024-PSY-8847", "type": "MEDICAL_LICENSE"},
            {"text": "Robert J. Martinez", "type": "PERSON"},
            {"text": "September 4, 1992", "type": "DATE_TIME"},
            {"text": "(719) 555-0189", "type": "PHONE_NUMBER"},
            {"text": "(720) 555-0234", "type": "PHONE_NUMBER"},
            {"text": "r.martinez@company.net", "type": "EMAIL_ADDRESS"},
            {"text": "3200 Maple Drive, Apartment 42, Colorado Springs, CO 80910", "type": "LOCATION"},
            {"text": "Robert J. Matthews", "type": "PERSON"},
            {"text": "02/28/2026", "type": "DATE_TIME"},
            {"text": "James Wu", "type": "PERSON"},
        ],
        "context": "intake"
    },

    {
        "text": """Collateral Contacts:
Mother: Patricia J. Johnson, DOB 1955
Home: 303-555-0412
Address: 1247 Elm Street, Denver, CO 80202

Sister: Jennifer Johnson-Clark
Phone: 720-555-0501
Email: jen.clark@gmail.com

Ex-partner: David A. Foster
DOB: March 14, 1987
Address: 5500 Colfax Avenue, Denver, CO 80215

Employer: Tech Solutions Inc.,
HR Contact: Linda Montgomery
Phone: 303-555-0667
Email: hr@techsolutions.net""",
        "expected_phi": [
            {"text": "Patricia J. Johnson", "type": "PERSON"},
            {"text": "1955", "type": "DATE_TIME"},
            {"text": "303-555-0412", "type": "PHONE_NUMBER"},
            {"text": "1247 Elm Street, Denver, CO 80202", "type": "LOCATION"},
            {"text": "Jennifer Johnson-Clark", "type": "PERSON"},
            {"text": "720-555-0501", "type": "PHONE_NUMBER"},
            {"text": "jen.clark@gmail.com", "type": "EMAIL_ADDRESS"},
            {"text": "David A. Foster", "type": "PERSON"},
            {"text": "March 14, 1987", "type": "DATE_TIME"},
            {"text": "5500 Colfax Avenue, Denver, CO 80215", "type": "LOCATION"},
            {"text": "Linda Montgomery", "type": "PERSON"},
            {"text": "303-555-0667", "type": "PHONE_NUMBER"},
            {"text": "hr@techsolutions.net", "type": "EMAIL_ADDRESS"},
        ],
        "context": "intake"
    },

    {
        "text": """Competency Evaluation Report
Subject: Michael Thompson
DOB: 12/22/1985
Case #: CR-2024-001847
Evaluation Date: 03/01/2026

Conducting Psychologist: Dr. Sarah M. Chen, PhD, License #CO-PSY-8841
Address: 1500 Clinical Way, Denver, CO 80204
Phone: 303-555-0999

Referring Court: Denver District Court
Judge: Hon. Michael P. Rodriguez
Court Phone: 303-555-1100

Subject's Attorney: James B. Anderson, Esq.
Office: The Anderson Law Group
Address: 200 17th Street, Suite 1800, Denver, CO 80202
Phone: 720-555-0845
Email: j.anderson@andersonlaw.com""",
        "expected_phi": [
            {"text": "Michael Thompson", "type": "PERSON"},
            {"text": "12/22/1985", "type": "DATE_TIME"},
            {"text": "CR-2024-001847", "type": "MEDICAL_LICENSE"},
            {"text": "03/01/2026", "type": "DATE_TIME"},
            {"text": "Sarah M. Chen", "type": "PERSON"},
            {"text": "CO-PSY-8841", "type": "US_DRIVER_LICENSE"},
            {"text": "1500 Clinical Way, Denver, CO 80204", "type": "LOCATION"},
            {"text": "303-555-0999", "type": "PHONE_NUMBER"},
            {"text": "Michael P. Rodriguez", "type": "PERSON"},
            {"text": "303-555-1100", "type": "PHONE_NUMBER"},
            {"text": "James B. Anderson", "type": "PERSON"},
            {"text": "200 17th Street, Suite 1800, Denver, CO 80202", "type": "LOCATION"},
            {"text": "720-555-0845", "type": "PHONE_NUMBER"},
            {"text": "j.anderson@andersonlaw.com", "type": "EMAIL_ADDRESS"},
        ],
        "context": "report"
    },

    {
        "text": """Child Custody Evaluation Summary
Minor: Joshua and Emma Thompson
DOBs: 06/15/2015 and 04/22/2018
Parent 1: Jennifer R. Thompson, SSN: 567-89-0123
Parent 2: Christopher M. Thompson, SSN: 456-78-9012
Current Address: 8800 Canyon Boulevard, Boulder, CO 80302
Emergency Contact: Maternal Grandmother, Patricia L. Adams
Phone: 303-555-0734

School: Boulder Valley Elementary, Principal: Dr. Karen Wilson
Phone: 303-555-1234

Current Daycare Provider: Little Stars Academy, Contact: Rebecca Santos
Phone: 720-555-2345""",
        "expected_phi": [
            {"text": "06/15/2015", "type": "DATE_TIME"},
            {"text": "04/22/2018", "type": "DATE_TIME"},
            {"text": "Jennifer R. Thompson", "type": "PERSON"},
            {"text": "567-89-0123", "type": "US_SSN"},
            {"text": "Christopher M. Thompson", "type": "PERSON"},
            {"text": "456-78-9012", "type": "US_SSN"},
            {"text": "8800 Canyon Boulevard, Boulder, CO 80302", "type": "LOCATION"},
            {"text": "Patricia L. Adams", "type": "PERSON"},
            {"text": "303-555-0734", "type": "PHONE_NUMBER"},
            {"text": "Karen Wilson", "type": "PERSON"},
            {"text": "303-555-1234", "type": "PHONE_NUMBER"},
            {"text": "Rebecca Santos", "type": "PERSON"},
            {"text": "720-555-2345", "type": "PHONE_NUMBER"},
        ],
        "context": "report"
    },

    # ========================================================================
    # CATEGORY C: Edge Cases
    # ========================================================================

    # Empty text
    {
        "text": "",
        "expected_phi": [],
        "context": "intake"
    },

    # No PHI
    {
        "text": "The patient presented with symptoms of anxiety and depression.",
        "expected_phi": [],
        "context": "intake"
    },

    # Very long text with PHI
    {
        "text": """The patient, Michael Johnson, DOB 05/20/1980, was referred by attorney Sarah Chen
on 02/15/2026 for a comprehensive psychological evaluation. Mr. Johnson resides at
3500 South Pearl Street, Denver, CO 80210. His contact numbers are 303-555-0123 and
720-555-0456. Email: m.johnson@email.com. SSN: 456-78-9012.

The patient's mother, Patricia Johnson, can be reached at 303-555-0789. Sister Jennifer
Johnson-Smith's contact is jen.smith@gmail.com.

Previous treatment with Dr. Robert Martinez at Denver Psychological Services,
1200 Medical Center Drive, Denver, CO 80204, Phone: 303-555-0999.

Insurance: United Healthcare, Member ID: UH-123456789-01

Evaluation ordered by Judge Margaret O'Brien, District Court, Phone: 303-555-1100.

The comprehensive interview was conducted on multiple dates: 02/20/2026, 02/25/2026,
and 03/01/2026. Additional collateral contact with school counselor Ms. Lisa Patterson
on 02/28/2026 at Boulder Valley School District, 303-555-2000.

Case number in court records: CR-2025-034567. Health plan authorization number:
HMO-7891234567.

All psychological testing was conducted per standard forensic protocols and documented
according to ethical guidelines.""",
        "expected_phi": [
            {"text": "Michael Johnson", "type": "PERSON"},
            {"text": "05/20/1980", "type": "DATE_TIME"},
            {"text": "Sarah Chen", "type": "PERSON"},
            {"text": "02/15/2026", "type": "DATE_TIME"},
            {"text": "3500 South Pearl Street, Denver, CO 80210", "type": "LOCATION"},
            {"text": "303-555-0123", "type": "PHONE_NUMBER"},
            {"text": "720-555-0456", "type": "PHONE_NUMBER"},
            {"text": "m.johnson@email.com", "type": "EMAIL_ADDRESS"},
            {"text": "456-78-9012", "type": "US_SSN"},
            {"text": "Patricia Johnson", "type": "PERSON"},
            {"text": "303-555-0789", "type": "PHONE_NUMBER"},
            {"text": "Jennifer Johnson-Smith", "type": "PERSON"},
            {"text": "jen.smith@gmail.com", "type": "EMAIL_ADDRESS"},
            {"text": "Robert Martinez", "type": "PERSON"},
            {"text": "1200 Medical Center Drive, Denver, CO 80204", "type": "LOCATION"},
            {"text": "303-555-0999", "type": "PHONE_NUMBER"},
            {"text": "Margaret O'Brien", "type": "PERSON"},
            {"text": "303-555-1100", "type": "PHONE_NUMBER"},
            {"text": "02/20/2026", "type": "DATE_TIME"},
            {"text": "02/25/2026", "type": "DATE_TIME"},
            {"text": "03/01/2026", "type": "DATE_TIME"},
            {"text": "Lisa Patterson", "type": "PERSON"},
            {"text": "02/28/2026", "type": "DATE_TIME"},
            {"text": "303-555-2000", "type": "PHONE_NUMBER"},
            {"text": "CR-2025-034567", "type": "MEDICAL_LICENSE"},
        ],
        "context": "report"
    },

    # PHI at start and end
    {
        "text": "John Smith started the evaluation on 01/15/2026 and no clinical concerns emerged.",
        "expected_phi": [
            {"text": "John Smith", "type": "PERSON"},
            {"text": "01/15/2026", "type": "DATE_TIME"},
        ],
        "context": "intake"
    },

    # Names with special characters
    {
        "text": "Patient: François O'Brien-Schmidt, known as Frank.",
        "expected_phi": [
            {"text": "François O'Brien-Schmidt", "type": "PERSON"},
        ],
        "context": "intake"
    },

    # Multiple entities of same type
    {
        "text": "Alice met with Bob and Charlie during the evaluation. Alice's contact: 303-555-0111. Bob's: 720-555-0222. Charlie's: 719-555-0333.",
        "expected_phi": [
            {"text": "Alice", "type": "PERSON"},
            {"text": "Bob", "type": "PERSON"},
            {"text": "Charlie", "type": "PERSON"},
            {"text": "303-555-0111", "type": "PHONE_NUMBER"},
            {"text": "720-555-0222", "type": "PHONE_NUMBER"},
            {"text": "719-555-0333", "type": "PHONE_NUMBER"},
        ],
        "context": "intake"
    },

    # Adjacent PHI
    {
        "text": "Contact Dr. Sarah Chen at 303-555-0123 or sarah.chen@psych.com immediately.",
        "expected_phi": [
            {"text": "Sarah Chen", "type": "PERSON"},
            {"text": "303-555-0123", "type": "PHONE_NUMBER"},
            {"text": "sarah.chen@psych.com", "type": "EMAIL_ADDRESS"},
        ],
        "context": "intake"
    },

    # Various date formats
    {
        "text": "Dates: 2026-03-15, March 15 2026, 3/15/26, 15 March 2026, 15-Mar-2026",
        "expected_phi": [
            {"text": "2026-03-15", "type": "DATE_TIME"},
            {"text": "March 15 2026", "type": "DATE_TIME"},
            {"text": "3/15/26", "type": "DATE_TIME"},
            {"text": "15 March 2026", "type": "DATE_TIME"},
            {"text": "15-Mar-2026", "type": "DATE_TIME"},
        ],
        "context": "intake"
    },

    # Various phone formats
    {
        "text": "Call 303-555-0123 or (303) 555-0123 or 303.555.0123 or 3035550123.",
        "expected_phi": [
            {"text": "303-555-0123", "type": "PHONE_NUMBER"},
            {"text": "(303) 555-0123", "type": "PHONE_NUMBER"},
            {"text": "303.555.0123", "type": "PHONE_NUMBER"},
            {"text": "3035550123", "type": "PHONE_NUMBER"},
        ],
        "context": "intake"
    },

    # SSN partial patterns
    {
        "text": "SSN: 456-78-9012, SSN: 123-45-6789",
        "expected_phi": [
            {"text": "456-78-9012", "type": "US_SSN"},
            {"text": "123-45-6789", "type": "US_SSN"},
        ],
        "context": "intake"
    },

    # ========================================================================
    # CATEGORY D: Forensic Psychology Domain Context
    # ========================================================================

    {
        "text": """Competency to Stand Trial Evaluation

Defendant: Michael J. Thompson
DOB: 06/15/1975
Case: People v. Thompson, Case No. 2024-CR-089456
Charges: Aggravated assault

Evaluation conducted by: Dr. Patricia M. Chen, PhD
License: CO-PSY-12345
Office: 1500 Clinical Way, Suite 300, Denver, CO 80204
Phone: 303-555-9999

Referred by: The Public Defender's Office
Attorney: James R. Sanders, Esq.
Phone: 720-555-0845

Evaluation dates: 02/15/2026, 02/22/2026, 03/01/2026

Collateral source: Court-appointed investigator David Wu
Phone: 303-555-1234

Subject's stated emergency contact: Maria Thompson (mother)
Address: 2400 South Broadway, Denver, CO 80210
Phone: 303-555-5678""",
        "expected_phi": [
            {"text": "Michael J. Thompson", "type": "PERSON"},
            {"text": "06/15/1975", "type": "DATE_TIME"},
            {"text": "2024-CR-089456", "type": "MEDICAL_LICENSE"},
            {"text": "Patricia M. Chen", "type": "PERSON"},
            {"text": "CO-PSY-12345", "type": "US_DRIVER_LICENSE"},
            {"text": "1500 Clinical Way, Suite 300, Denver, CO 80204", "type": "LOCATION"},
            {"text": "303-555-9999", "type": "PHONE_NUMBER"},
            {"text": "James R. Sanders", "type": "PERSON"},
            {"text": "720-555-0845", "type": "PHONE_NUMBER"},
            {"text": "02/15/2026", "type": "DATE_TIME"},
            {"text": "02/22/2026", "type": "DATE_TIME"},
            {"text": "03/01/2026", "type": "DATE_TIME"},
            {"text": "David Wu", "type": "PERSON"},
            {"text": "303-555-1234", "type": "PHONE_NUMBER"},
            {"text": "Maria Thompson", "type": "PERSON"},
            {"text": "2400 South Broadway, Denver, CO 80210", "type": "LOCATION"},
            {"text": "303-555-5678", "type": "PHONE_NUMBER"},
        ],
        "context": "report"
    },

    {
        "text": """Risk Assessment Evaluation

Subject: Robert Anthony Martinez
DOB: 09/23/1988
Evaluation ID: 2026-RA-001847
Evaluation Date: 02/28/2026

Psychologist: Dr. Lisa M. Wong, PhD, Forensic Psychology
License #: CO-PSY-54321
Contact: lwong@denverforensic.com, 720-555-0234

Requesting Agency: Colorado Department of Corrections
Contact: Supervisor Maria Elena Rodriguez
Phone: 303-555-4567
Address: 2862 South Circle Drive, Suite 300, Colorado Springs, CO 80906

Facility: Colorado State Penitentiary
Location: Canon City, Colorado
Facility Phone: 719-555-0100

Subject's Listed Family Contact: Alexander Martinez (father)
Address: 1847 West Evans Avenue, Denver, CO 80219
Phone: 303-555-8901""",
        "expected_phi": [
            {"text": "Robert Anthony Martinez", "type": "PERSON"},
            {"text": "09/23/1988", "type": "DATE_TIME"},
            {"text": "2026-RA-001847", "type": "MEDICAL_LICENSE"},
            {"text": "02/28/2026", "type": "DATE_TIME"},
            {"text": "Lisa M. Wong", "type": "PERSON"},
            {"text": "CO-PSY-54321", "type": "US_DRIVER_LICENSE"},
            {"text": "lwong@denverforensic.com", "type": "EMAIL_ADDRESS"},
            {"text": "720-555-0234", "type": "PHONE_NUMBER"},
            {"text": "Maria Elena Rodriguez", "type": "PERSON"},
            {"text": "303-555-4567", "type": "PHONE_NUMBER"},
            {"text": "2862 South Circle Drive, Suite 300, Colorado Springs, CO 80906", "type": "LOCATION"},
            {"text": "719-555-0100", "type": "PHONE_NUMBER"},
            {"text": "Alexander Martinez", "type": "PERSON"},
            {"text": "1847 West Evans Avenue, Denver, CO 80219", "type": "LOCATION"},
            {"text": "303-555-8901", "type": "PHONE_NUMBER"},
        ],
        "context": "report"
    },

    {
        "text": """Child Sexual Abuse Allegation Evaluation

Referred Child: Emma Rose Sullivan
DOB: 07/14/2018 (age 7)
Parents:
  - Mother: Catherine Anne Sullivan, DOB 05/22/1980, Email: c.sullivan@email.com
  - Father: Thomas Edward Sullivan, DOB 03/18/1978, Phone: 303-555-2233

Family Address: 445 Maple Drive, Boulder, CO 80302

Alleged Perpetrator: [Name withheld per protocol]
Evaluation Psychologist: Dr. Robert C. Johnson, PhD
License: CO-PSY-98765
Office: 900 Fifteenth Street, Denver, CO 80202
Phone: 303-555-7890

Referring Agency: Boulder County Department of Human Services
Caseworker: Jennifer M. Brooks
Phone: 720-555-3456
Office Address: 3450 North Broadway, Boulder, CO 80304

School: Boulder Valley Elementary School
Principal: Dr. Mark Patterson
Phone: 303-555-6789

Teacher: Ms. Rachel Williams, Email: r.williams@bvsd.org""",
        "expected_phi": [
            {"text": "Emma Rose Sullivan", "type": "PERSON"},
            {"text": "07/14/2018", "type": "DATE_TIME"},
            {"text": "Catherine Anne Sullivan", "type": "PERSON"},
            {"text": "05/22/1980", "type": "DATE_TIME"},
            {"text": "c.sullivan@email.com", "type": "EMAIL_ADDRESS"},
            {"text": "Thomas Edward Sullivan", "type": "PERSON"},
            {"text": "03/18/1978", "type": "DATE_TIME"},
            {"text": "303-555-2233", "type": "PHONE_NUMBER"},
            {"text": "445 Maple Drive, Boulder, CO 80302", "type": "LOCATION"},
            {"text": "Robert C. Johnson", "type": "PERSON"},
            {"text": "CO-PSY-98765", "type": "US_DRIVER_LICENSE"},
            {"text": "900 Fifteenth Street, Denver, CO 80202", "type": "LOCATION"},
            {"text": "303-555-7890", "type": "PHONE_NUMBER"},
            {"text": "Jennifer M. Brooks", "type": "PERSON"},
            {"text": "720-555-3456", "type": "PHONE_NUMBER"},
            {"text": "3450 North Broadway, Boulder, CO 80304", "type": "LOCATION"},
            {"text": "Mark Patterson", "type": "PERSON"},
            {"text": "303-555-6789", "type": "PHONE_NUMBER"},
            {"text": "Rachel Williams", "type": "PERSON"},
            {"text": "r.williams@bvsd.org", "type": "EMAIL_ADDRESS"},
        ],
        "context": "report"
    },

    {
        "text": """Insanity Evaluation (Defendant)

Defendant: Joshua James Anderson
DOB: 12/10/1992
Case: State v. Anderson, Docket #2025-CR-012345
County: Denver County District Court
Judge: Hon. Margaret L. O'Brien
Phone: 303-555-0999

Evaluator: Dr. Jennifer K. Martinez, PhD, Forensic Psychology
License: CO-PSY-77777
Office: 1200 South University Boulevard, Suite 200, Denver, CO 80210
Cell: 720-555-0555
Email: j.martinez@denverpsych.com

Referring Attorney: David Michael Chen, Esq.
Law Firm: Chen, Matthews & Associates
Address: 600 Seventeenth Street, Suite 2000, Denver, CO 80202
Phone: 303-555-2222

Co-evaluator (second opinion): Dr. Anthony R. Thompson, PhD
License: CO-PSY-88888
Phone: 720-555-1111

Defendant's contact person: Sister, Angela Marie Anderson
Address: 1500 Grant Street, Denver, CO 80203
Phone: 303-555-3333

Prior treatment provider: Dr. William Foster, MD
Clinic: Denver Mental Health Services
Address: 4900 East Louisiana Avenue, Denver, CO 80222
Phone: 303-555-4444""",
        "expected_phi": [
            {"text": "Joshua James Anderson", "type": "PERSON"},
            {"text": "12/10/1992", "type": "DATE_TIME"},
            {"text": "2025-CR-012345", "type": "MEDICAL_LICENSE"},
            {"text": "Margaret L. O'Brien", "type": "PERSON"},
            {"text": "303-555-0999", "type": "PHONE_NUMBER"},
            {"text": "Jennifer K. Martinez", "type": "PERSON"},
            {"text": "CO-PSY-77777", "type": "US_DRIVER_LICENSE"},
            {"text": "1200 South University Boulevard, Suite 200, Denver, CO 80210", "type": "LOCATION"},
            {"text": "720-555-0555", "type": "PHONE_NUMBER"},
            {"text": "j.martinez@denverpsych.com", "type": "EMAIL_ADDRESS"},
            {"text": "David Michael Chen", "type": "PERSON"},
            {"text": "600 Seventeenth Street, Suite 2000, Denver, CO 80202", "type": "LOCATION"},
            {"text": "303-555-2222", "type": "PHONE_NUMBER"},
            {"text": "Anthony R. Thompson", "type": "PERSON"},
            {"text": "CO-PSY-88888", "type": "US_DRIVER_LICENSE"},
            {"text": "720-555-1111", "type": "PHONE_NUMBER"},
            {"text": "Angela Marie Anderson", "type": "PERSON"},
            {"text": "1500 Grant Street, Denver, CO 80203", "type": "LOCATION"},
            {"text": "303-555-3333", "type": "PHONE_NUMBER"},
            {"text": "William Foster", "type": "PERSON"},
            {"text": "4900 East Louisiana Avenue, Denver, CO 80222", "type": "LOCATION"},
            {"text": "303-555-4444", "type": "PHONE_NUMBER"},
        ],
        "context": "report"
    },

    # ========================================================================
    # Additional real-world forensic samples
    # ========================================================================

    {
        "text": """Witness Credibility Assessment

Witness: Thomas Harold Jackson
DOB: 02/28/1965
Address: 567 Oak Street, Golden, CO 80401
Phone: (303) 555-0999
SSN: 234-56-7890

Employer: Rocky Mountain Construction LLC
Contact: Supervisor John Maxwell
Phone: 303-555-2000

Case: People v. Henderson, Case #2025-CR-098765
Trial Date: 05/15/2026

Counsel: Attorney Patricia Nicole Santos, Esq.
Firm: Santos & Associates, P.C.
Address: 1111 South Tejon Street, Colorado Springs, CO 80905
Phone: 719-555-0321
Email: p.santos@santoslaw.com

Court: El Paso County District Court, Judge: Hon. Robert Michael Stevens
Phone: 719-555-0100

Assessment conducted by: Dr. Margaret Chen, PhD
License: CO-PSY-65432
Date of evaluation: 04/20/2026""",
        "expected_phi": [
            {"text": "Thomas Harold Jackson", "type": "PERSON"},
            {"text": "02/28/1965", "type": "DATE_TIME"},
            {"text": "567 Oak Street, Golden, CO 80401", "type": "LOCATION"},
            {"text": "(303) 555-0999", "type": "PHONE_NUMBER"},
            {"text": "234-56-7890", "type": "US_SSN"},
            {"text": "John Maxwell", "type": "PERSON"},
            {"text": "303-555-2000", "type": "PHONE_NUMBER"},
            {"text": "2025-CR-098765", "type": "MEDICAL_LICENSE"},
            {"text": "05/15/2026", "type": "DATE_TIME"},
            {"text": "Patricia Nicole Santos", "type": "PERSON"},
            {"text": "1111 South Tejon Street, Colorado Springs, CO 80905", "type": "LOCATION"},
            {"text": "719-555-0321", "type": "PHONE_NUMBER"},
            {"text": "p.santos@santoslaw.com", "type": "EMAIL_ADDRESS"},
            {"text": "Robert Michael Stevens", "type": "PERSON"},
            {"text": "719-555-0100", "type": "PHONE_NUMBER"},
            {"text": "Margaret Chen", "type": "PERSON"},
            {"text": "CO-PSY-65432", "type": "US_DRIVER_LICENSE"},
            {"text": "04/20/2026", "type": "DATE_TIME"},
        ],
        "context": "report"
    },
]

def get_corpus() -> list[dict]:
    """Return the full test corpus."""
    return TEST_CORPUS

def count_entities(corpus: list[dict] | None = None) -> int:
    """Count total PHI entities across the corpus."""
    if corpus is None:
        corpus = TEST_CORPUS
    total = 0
    for item in corpus:
        total += len(item.get("expected_phi", []))
    return total
