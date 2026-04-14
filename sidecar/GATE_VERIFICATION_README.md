# Sprint 4 GO/NO-GO Gate Verification

## Overview

This directory contains the verification harness for Sprint 4 gate criteria: **PII Detection Recall ≥99% with False Positive Rate <2%**.

## Files

### `gate_verification.py`
The main verification script that:
- Connects to the running sidecar server
- Runs the UNID redaction pipeline against a gold-standard test corpus
- Measures PII recall and false positive rates
- Generates GO/NO-GO reports in human-readable and JSON formats

### `gold_standard_corpus.py`
A carefully curated corpus of 100 forensic psychology evaluation text samples with:
- Manually annotated PHI entities (347 total)
- Non-PHI tokens for false positive measurement (2,841 total)
- Coverage of all 7 forensic domains (CST, Custody, Risk, Personal Injury, Criminal Responsibility, Immigration, Disability)
- Varying complexity levels (simple, moderate, complex)

## Prerequisites

The following Python packages must be installed in the sidecar environment:
```bash
pip install presidio-analyzer presidio-anonymizer spacy
python -m spacy download en_core_web_lg
```

## Running the Verification

### Step 1: Start the Sidecar Server

In a terminal, start the Python sidecar:
```bash
cd /path/to/Psygil
python3 sidecar/server.py
```

You should see output like:
```json
{"status": "ready", "pid": 12345}
```

The sidecar listens on `/tmp/psygil-sidecar.sock` and initializes Presidio + spaCy on startup.

### Step 2: Run the Gate Verification

In another terminal, run the verification script:
```bash
cd /path/to/Psygil
python3 sidecar/gate_verification.py
```

### Step 3: Review Results

**Human-readable output:**
```
═══════════════════════════════════════════════════════════════════════════════
  PSYGIL SPRINT 4 — GO/NO-GO GATE VERIFICATION
═══════════════════════════════════════════════════════════════════════════════

Test Corpus:     100 samples
PHI Entities:    347 annotated
Non-PHI Tokens:  2,841 annotated

─── RESULTS ───────────────────────────────────────────────────────────────────

PII Recall:           99.4% (345/347)  ✅ PASS (≥99%)
False Positive Rate:   1.2% (34/2841)  ✅ PASS (<2%)

─── PER-TYPE RECALL ───────────────────────────────────────────────────────────

PERSON:      100.0% (89/89)   ✅
DATE_TIME:    99.1% (111/112)  ✅
PHONE_NUMBER: 100.0% (23/23)   ✅
EMAIL_ADDRESS: 100.0% (15/15)   ✅
US_SSN:       100.0% (8/8)     ✅
LOCATION:      98.0% (49/50)    ⚠️  (below 99%)
...

═══════════════════════════════════════════════════════════════════════════════
  DECISION:  ✅ GO  /  ❌ NO-GO
═══════════════════════════════════════════════════════════════════════════════
```

**JSON output (for CI/CD integration):**
```bash
python3 sidecar/gate_verification.py --json
```

Returns:
```json
{
  "gate": "sprint-4",
  "timestamp": "2026-03-29T...",
  "decision": "GO",
  "metrics": {
    "recall": 0.994,
    "false_positive_rate": 0.012,
    "total_samples": 100,
    "total_phi_entities": 347
  },
  "per_type": { ... },
  "worst_performing_samples": [ ... ]
}
```

## Gate Criteria

| Metric | Threshold | Pass Condition |
|--------|-----------|----------------|
| PII Recall | ≥99% | Must detect and redact ≥99% of known PHI entities |
| False Positive Rate | <2% | Can flag at most 2% of non-PHI tokens as PHI |

## Flags

### `--verbose`
Show detailed per-sample results and missed entities:
```bash
python3 sidecar/gate_verification.py --verbose
```

### `--json`
Output results as machine-readable JSON instead of human-readable text:
```bash
python3 sidecar/gate_verification.py --json
```

### Combine flags
```bash
python3 sidecar/gate_verification.py --verbose --json
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | PASS — Both recall and FP rate criteria met |
| 1 | FAIL — One or more criteria not met |
| 2 | ERROR — Could not connect to sidecar or other error |

## Gold Standard Corpus Details

### Coverage

**Forensic Domains:**
- Competency to Stand Trial (CST): 16 samples
- Custody Evaluations: 8 samples
- Risk Assessments (violence, sexual offense): 8 samples
- Personal Injury: 8 samples
- Criminal Responsibility / Insanity: 8 samples
- Immigration Psychological Evaluation: 8 samples
- Disability Evaluation: 8 samples
- Edge Cases & Mixed: 28 samples

### PHI Entity Types (347 total)

- PERSON: 89 entities (names of patients, families, clinicians, attorneys)
- DATE_TIME: 112 entities (DOBs, evaluation dates, incident dates)
- PHONE_NUMBER: 23 entities (clinical office, attorney, collateral contacts)
- EMAIL_ADDRESS: 15 entities (clinical and attorney email)
- US_SSN: 8 entities (disability claims, Social Security numbers)
- LOCATION: 68 entities (addresses, cities, states)
- RECNUM: 16 entities (case numbers, medical record numbers)
- US_PASSPORT: 2 entities (immigration applications)
- US_DRIVER_LICENSE: 3 entities (license numbers)
- Other: 3 entities

### Non-PHI Tokens (2,841 total)

Non-PHI tokens are scored to measure false positives. These are legitimate clinical and legal terms that could be misidentified as PHI, including:
- Clinical diagnoses (PTSD, OCD, depression)
- Legal terms (felony, assault, custody)
- Facility types (hospital, detention center, rehabilitation)
- Profession types (psychologist, attorney, physician)
- Service acronyms (SSDI, CST, FCE)
- Evaluation type names
- Geographic descriptors (downtown, north side)

## Interpreting Results

### If PASS (GO):
Sprint 4 is complete. Proceed to Sprint 5.

### If FAIL:
- **Low Recall:** The pipeline is missing PHI entities. Review the worst-performing samples to identify patterns:
  - Abbreviated names not fully detected?
  - Partial addresses or dates without full context?
  - Non-standard phone/SSN formats?
  - Add these patterns to Presidio recognizers and retest.

- **High False Positive Rate:** The pipeline is over-flagging legitimate text. Review false positives:
  - Clinical terms being mislabeled?
  - Common names or abbreviations?
  - Adjust Presidio confidence thresholds or add suppression rules.

## Troubleshooting

### "Cannot connect to /tmp/psygil-sidecar.sock"
- Ensure sidecar server is running: `python3 sidecar/server.py`
- Check process: `ps aux | grep server.py`
- Clean up stale socket: `rm -f /tmp/psygil-sidecar.sock`

### "spacy or presidio module not found"
- Install dependencies: `pip install presidio-analyzer presidio-anonymizer spacy`
- Download spacy model: `python -m spacy download en_core_web_lg`

### Recall is unexpectedly low
- Presidio might have low confidence on certain entity types
- Review PII detection in `server.py` / `pii_detect()` method
- Consider lowering Presidio confidence thresholds or adding custom recognizers

### False positive rate is too high
- Non-PHI suppression rules may need adjustment
- Review what tokens are being flagged in `--verbose` output
- Add exclusions for common clinical/legal terms

## Integration with CI/CD

Add to your CI/CD pipeline (example for GitHub Actions):

```yaml
- name: Run Sprint 4 Gate Verification
  run: |
    python3 sidecar/gate_verification.py --json > gate_results.json
    EXIT_CODE=$?
    if [ $EXIT_CODE -eq 0 ]; then
      echo "✅ Gate PASSED - Sprint 4 complete"
    else
      echo "❌ Gate FAILED - Sprint 4 needs rework"
      cat gate_results.json
    fi
    exit $EXIT_CODE
```

## Performance Notes

- Full corpus run: ~5-10 minutes (100 samples × Presidio analysis)
- Memory: Presidio + spaCy requires ~2GB RAM
- Can be optimized with batch mode: `pii/batch` instead of `pii/detect` per sample

## What's Being Tested

The gate verification tests the PII detection pipeline in isolation:
1. **Presidio + spaCy NLP engine** detects HIPAA Safe Harbor entities
2. **Entity type mapping** correctly classifies detected entities
3. **Character-level matching** (≥80% overlap) counts as correct detection
4. **No PHI leakage** in redaction output

This is the critical security gate before PII reaches the AI model.

---

**Last Updated:** 2026-03-29
**Sprint 4 Status:** Testing
**Gate Decision:** Pending verification run
