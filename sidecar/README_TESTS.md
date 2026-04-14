# De-identification Verification Test Suite

**Task 4.4 — Sprint 4**

This directory contains a comprehensive test suite for validating the UNID-based PHI redaction pipeline. The tests verify that no Protected Health Information (PHI) appears in any outbound API request after de-identification.

## Files

- **`test_deidentification.py`** — Main test suite with 50+ test cases
- **`test_corpus.py`** — 30+ forensic psychology text samples with annotated PHI entities
- **`conftest.py`** — Pytest configuration and fixtures
- **`test_server.py`** — Original basic test client (kept for reference)

## Quick Start

### 1. Start the Sidecar Server (Terminal 1)

```bash
python3 sidecar/server.py
```

You should see:
```
{"status":"ready","pid":12345}
```

### 2. Run the Test Suite (Terminal 2)

```bash
cd /path/to/Psygil
pytest sidecar/test_deidentification.py -v
```

### Expected Output

```
test_deidentification.py::TestIndividualEntityTypes::test_person_single_name PASS
test_deidentification.py::TestIndividualEntityTypes::test_person_multiple_names PASS
test_deidentification.py::TestRedactionNoPhiInOutput::test_redact_removes_person_name PASS
test_deidentification.py::TestRedactionNoPhiInOutput::test_redact_complex_paragraph_no_phi PASS
...

DE-IDENTIFICATION VERIFICATION TEST SUITE — SUMMARY
================================================================================
Test corpus: 30 samples
Total PHI entities in corpus: 150+
...
GO/NO-GO Criteria (Task 4.6):
  PII Recall Rate: ≥99%
  False Positive Rate: <2%
================================================================================
```

## Test Categories

### Category A: Individual Entity Type Detection (18 tests)
Verifies detection of each HIPAA Safe Harbor identifier type:
- PERSON names (single, hyphenated, accented)
- DATE_TIME (various formats)
- PHONE_NUMBER (parentheses, dash, dot formats)
- EMAIL_ADDRESS
- US_SSN (dash and no-dash formats)
- LOCATION (street addresses)
- MEDICAL_LICENSE (case/record numbers)
- US_DRIVER_LICENSE
- IP_ADDRESS
- URL

### Category B: Redaction — No PHI in Output (7+ tests)
Verifies that original PHI values are NOT present in redacted output:
- Individual PHI types replaced with UNIDs
- Complex paragraphs with multiple PHI types
- Clinical content preserved
- Legal context preserved

### Category C: UNID Format Validation (3+ tests)
Verifies UNID format specification:
- Pattern: `{TYPE}_{6hex}`
- Valid type prefixes
- No duplicate UNIDs within operation
- 24-bit entropy per UNID

### Category D: Rehydration Accuracy (4+ tests)
Verifies re-hydration of UNIDs back to original PHI:
- Simple text rehydration
- Complex multi-entity rehydration
- Multiple same-entity rehydration
- Wrong operationId handling

### Category E: UNID Map Lifecycle (4+ tests)
Verifies map creation, existence, and destruction:
- Map created after redact
- Map destroyed after rehydrate
- Explicit destroy functionality
- Nonexistent map destruction

### Category F: PII Detection Metrics (2+ tests)
Measures and reports metrics:
- PII recall rate against test corpus
- Entity count alignment between detect and redact
- Provides data for GO/NO-GO gate (Task 4.6)

### Category G: Edge Cases & Robustness (6+ tests)
Tests error handling and edge cases:
- Empty text
- Very long text (5000+ chars)
- Special characters in names
- Whitespace preservation
- Various date/phone formats
- Adjacent PHI entities

### Category H: Integration Tests (2+ tests)
Full workflow tests:
- Redact → Use → Rehydrate cycle
- Multiple independent operations

## Test Corpus

The corpus (`test_corpus.py`) contains 30+ forensic psychology text samples including:

- **Competency to Stand Trial** — CST evaluations with defendant, attorney, court info
- **Risk Assessment** — DOC evaluations with facility, caseworker, prior treatment
- **Child Custody** — Family evaluations with minor DOBs, parental SSNs
- **Child Sexual Abuse** — CSAM evaluations with school, teacher, caseworker contacts
- **Insanity Evaluation** — Insanity defense cases with multiple expert opinions
- **Witness Credibility** — Witness assessments with employment, trial date
- **Complex Intake** — Multi-contact referral with collateral sources

Each corpus item includes:
- Full text with realistic PHI interleaved
- Annotated PHI entities with types
- Context (intake, report, etc.)

Total PHI entities: 150+

## Metrics & GO/NO-GO Gate (Task 4.6)

The test suite measures:

### PII Recall Rate
Percentage of known PHI entities detected by Presidio analyzer.

```
Recall = (PHI entities detected) / (Total expected PHI entities)
GO/NO-GO threshold: ≥99%
```

### False Positive Rate
Percentage of detected entities that are NOT actually PHI.

```
FP Rate = (Non-PHI detected as PHI) / (Total detected)
GO/NO-GO threshold: <2%
```

These metrics are computed in `TestPiiMetrics.test_detection_recall_on_corpus()` and reported at the end of the test run.

## Architecture

### Sidecar IPC Contract

The tests verify the following JSON-RPC 2.0 endpoints (implemented in `server.py`):

#### `pii/redact`
```json
Request:
{
  "jsonrpc": "2.0",
  "method": "pii/redact",
  "params": {
    "text": "Full-PHI text here",
    "operationId": "unique-operation-id",
    "context": "intake" | "report" | "review" | "diagnostics"
  }
}

Response:
{
  "jsonrpc": "2.0",
  "result": {
    "redactedText": "Text with UNID_xyz123 replacing PHI",
    "entityCount": 5,
    "typeBreakdown": { "PERSON": 2, "PHONE": 1, "SSN": 1, "DATE": 1 }
  }
}
```

#### `pii/rehydrate`
```json
Request:
{
  "jsonrpc": "2.0",
  "method": "pii/rehydrate",
  "params": {
    "text": "AI response with UNID_xyz123 and more text",
    "operationId": "unique-operation-id"
  }
}

Response:
{
  "jsonrpc": "2.0",
  "result": {
    "fullText": "AI response with Original Name and more text",
    "unidsReplaced": 1
  }
}
```

#### `pii/destroy`
```json
Request:
{
  "jsonrpc": "2.0",
  "method": "pii/destroy",
  "params": {
    "operationId": "unique-operation-id"
  }
}

Response:
{
  "jsonrpc": "2.0",
  "result": {
    "destroyed": true | false
  }
}
```

## Key Invariants (from Architecture Spec)

The tests verify these non-negotiable invariants:

1. **No PHI in any outbound HTTPS request** — The Python sidecar is the only component making API calls, and it only sends redacted text.

2. **No UNID map on disk** — Maps exist in-memory only, for the duration of a single operation.

3. **No UNID reuse** — Every operation generates fresh UNIDs. Previous UNIDs cannot be correlated with future ones.

4. **Reports contain full PHI** — The final evaluation report is never redacted (tested separately).

5. **Audit trail contains no PHI** — Operation logs record entity counts and types, never values or mappings.

## HIPAA Safe Harbor Identifier Types

The test suite covers all 18 identifier types:

1. Names
2. Dates (except year)
3. Telephone numbers
4. Email addresses
5. Social Security numbers
6. Medical record numbers
7. Account numbers
8. Certificate/license numbers
9. Device identifiers
10. Web URLs
11. Geographic data / addresses
12. Financial account identifiers
13. Credit card numbers
14. Passport numbers
15. National/ethnic identifiers
16. Tax ID numbers
17. Biometric identifiers
18. Catch-all unique identifiers

## Running Specific Tests

```bash
# Run only entity detection tests
pytest sidecar/test_deidentification.py::TestIndividualEntityTypes -v

# Run only redaction tests
pytest sidecar/test_deidentification.py::TestRedactionNoPhiInOutput -v

# Run only metrics tests
pytest sidecar/test_deidentification.py::TestPiiMetrics -v

# Run a specific test
pytest sidecar/test_deidentification.py::TestRedactionNoPhiInOutput::test_redact_removes_person_name -v

# Run with output capture disabled (see print statements)
pytest sidecar/test_deidentification.py -v -s

# Run with coverage (if pytest-cov installed)
pytest sidecar/test_deidentification.py --cov=sidecar --cov-report=term-missing
```

## Troubleshooting

### Connection Error
```
FAIL — Cannot connect to /tmp/psygil-sidecar.sock
```
**Solution:** Start the sidecar: `python3 sidecar/server.py`

### Import Error
```
ModuleNotFoundError: No module named 'spacy'
```
**Solution:** Install dependencies: `pip install presidio-analyzer spacy` and download model: `python -m spacy download en_core_web_lg`

### Presidio Not Recognizing PHI
Some entities require the spaCy model to be initialized. If detection is too low, verify:
```bash
python3 -c "import spacy; nlp = spacy.load('en_core_web_lg'); print(nlp('John Smith was born 01/15/1990'))"
```

### Test Corpus Too Small
The corpus is designed with 30+ samples covering 150+ PHI entities. If you need more coverage, add items to `test_corpus.py`.

## Success Criteria (Acceptance Criteria)

- [ ] 50+ test cases implemented
- [ ] All 18 HIPAA identifier types covered
- [ ] Tests verify no PHI in redacted output
- [ ] Tests measure PII recall rate
- [ ] Tests measure false positive rate
- [ ] Tests cover re-hydration accuracy
- [ ] Tests cover UNID map lifecycle
- [ ] Tests use forensic psychology domain-appropriate data
- [ ] All tests pass with sidecar running
- [ ] Metrics computed and reported
- [ ] Ready for GO/NO-GO gate (Task 4.6)

## References

- **Architecture Spec:** `docs/engineering/15_UNID_Redaction_Architecture.md`
- **HIPAA Safe Harbor:** `docs/legal/HIPAA_Safe_Harbor_Validation.md` (referenced in spec)
- **Sidecar Implementation:** `sidecar/server.py`
- **BUILD_MANIFEST:** Task 4.4 acceptance criteria and Task 4.6 GO/NO-GO gate

## Next Steps

1. **Task 4.5** (Rate Limiting + Error Handling) — After these tests pass
2. **Task 4.6** (GO/NO-GO Gate) — Uses metrics from this test suite
   - PII Recall: ≥99% → PASS
   - FP Rate: <2% → PASS
   - If both pass → Proceed to Sprint 5
   - If fail → Extend Sprint 4 to improve recall/FP

---

**Test Suite Version:** 1.0
**Created:** 2026-03-29
**Status:** Ready for use
