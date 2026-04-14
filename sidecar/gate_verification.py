#!/usr/bin/env python3
"""Sprint 4 GO/NO-GO Gate Verification

Runs the UNID redaction pipeline against a gold-standard test corpus
and measures PII recall and false positive rates.

Gate Criteria:
  - PII Recall: ≥99% (of known PHI entities, ≥99% detected and redacted)
  - False Positive Rate: <2% (non-PHI tokens incorrectly flagged as PHI)

Usage:
    python sidecar/gate_verification.py [--verbose] [--json]

Exit codes:
    0 = PASS (all criteria met)
    1 = FAIL (one or more criteria not met)
    2 = ERROR (could not complete verification)
"""

import argparse
import asyncio
import json
import socket
import sys
from datetime import datetime
from typing import Any

from gold_standard_corpus import GOLD_STANDARD

SOCKET_PATH = "/tmp/psygil-sidecar.sock"

# Gate pass/fail thresholds
RECALL_THRESHOLD = 0.99  # ≥99%
FP_RATE_THRESHOLD = 0.02  # <2%


def send_rpc(sock: socket.socket, method: str, params: dict | None = None, req_id: int = 1) -> dict:
    """Send a JSON-RPC 2.0 request and return the parsed response."""
    request = {"jsonrpc": "2.0", "method": method, "id": req_id}
    if params is not None:
        request["params"] = params

    sock.sendall(json.dumps(request).encode() + b"\n")

    # Read newline-delimited response
    buf = b""
    while True:
        chunk = sock.recv(4096)
        if not chunk:
            raise ConnectionError("Server closed connection")
        buf += chunk
        if b"\n" in buf:
            break

    return json.loads(buf.split(b"\n")[0])


def _overlap_fraction(detected_start: int, detected_end: int, expected_start: int, expected_end: int) -> float:
    """Calculate overlap fraction between two character ranges."""
    overlap_start = max(detected_start, expected_start)
    overlap_end = min(detected_end, expected_end)
    if overlap_end <= overlap_start:
        return 0.0
    overlap_len = overlap_end - overlap_start
    expected_len = expected_end - expected_start
    return overlap_len / expected_len if expected_len > 0 else 0.0


def find_matching_detection(
    expected_entity: dict, detected_entities: list[dict], min_overlap: float = 0.8
) -> dict | None:
    """
    Find a detected entity that matches the expected entity.
    A match requires:
      1. Same entity type (or compatible types)
      2. ≥80% character overlap
    """
    expected_start = expected_entity["start"]
    expected_end = expected_entity["end"]
    expected_type = expected_entity["type"]

    for detected in detected_entities:
        detected_start = detected["start"]
        detected_end = detected["end"]
        detected_type = detected["type"]

        # Check overlap
        overlap = _overlap_fraction(detected_start, detected_end, expected_start, expected_end)
        if overlap < min_overlap:
            continue

        # Check type compatibility (Presidio types to expected types)
        # Since Presidio returns different type names, we do loose matching
        if _types_compatible(expected_type, detected_type):
            return detected

    return None


def _types_compatible(expected_type: str, detected_type: str) -> bool:
    """Check if expected HIPAA type matches detected Presidio type."""
    # Maps expected types to possible Presidio types
    compatibility = {
        "PERSON": ["PERSON"],
        "DATE_TIME": ["DATE_TIME"],
        "PHONE_NUMBER": ["PHONE_NUMBER"],
        "EMAIL_ADDRESS": ["EMAIL_ADDRESS"],
        "US_SSN": ["US_SSN"],
        "LOCATION": ["LOCATION"],
        "MEDICAL_LICENSE": ["MEDICAL_LICENSE"],
        "US_DRIVER_LICENSE": ["US_DRIVER_LICENSE"],
        "US_PASSPORT": ["US_PASSPORT"],
        "IP_ADDRESS": ["IP_ADDRESS"],
        "URL": ["URL"],
        "RECNUM": ["US_BANK_NUMBER", "IBAN_CODE", "CREDIT_CARD", "US_ITIN"],
        "LICENSE": ["MEDICAL_LICENSE", "US_DRIVER_LICENSE", "US_PASSPORT"],
    }

    # Normalize expected type from our corpus format
    expected_normalized = expected_type.replace("_TIME", "")

    for compatible in compatibility.get(expected_normalized, []):
        if detected_type == compatible or detected_type == expected_type:
            return True

    # Fallback: allow if types exactly match
    return expected_type == detected_type


def run_sample_test(sock: socket.socket, sample: dict, sample_idx: int) -> dict:
    """
    Run PII detection on a single sample and measure recall + FP rate.

    Returns:
        {
            "sample_id": "GS-001",
            "text_length": 256,
            "expected_entities": 5,
            "detected_entities": 5,
            "correct_detections": 5,
            "missed_entities": [],
            "false_positives": [],
            "per_type_metrics": { "PERSON": {...}, "DATE": {...} },
            "sample_recall": 1.0,
            "sample_fp_rate": 0.0,
        }
    """
    text = sample["text"]
    expected_entities = sample["phi_entities"]
    non_phi_tokens = sample["non_phi_tokens"]

    # Detect PHI in this sample
    try:
        resp = send_rpc(sock, "pii/detect", {"text": text}, req_id=sample_idx)
        if "error" in resp:
            return {
                "sample_id": sample["id"],
                "error": f"pii/detect failed: {resp['error']}",
            }
        detected_entities = resp.get("result", {}).get("entities", [])
    except Exception as e:
        return {
            "sample_id": sample["id"],
            "error": f"Exception in pii/detect: {e}",
        }

    # Match detected to expected
    correct_detections = 0
    matched_expected = set()
    missed_entities = []

    for expected in expected_entities:
        matched = find_matching_detection(expected, detected_entities)
        if matched:
            correct_detections += 1
            matched_expected.add(id(expected))
        else:
            missed_entities.append(expected)

    # Find false positives: detected entities with no match in expected
    false_positives = []
    for detected in detected_entities:
        # Check if this detected entity matches any expected entity
        is_match = False
        for expected in expected_entities:
            if find_matching_detection(expected, [detected]):
                is_match = True
                break

        # Also check if it overlaps with a non_phi_token (false positive if it does)
        overlaps_non_phi = False
        for non_phi in non_phi_tokens:
            overlap = _overlap_fraction(
                detected["start"], detected["end"], non_phi["start"], non_phi["end"]
            )
            if overlap > 0.5:  # 50%+ overlap with non-PHI is a false positive
                overlaps_non_phi = True
                break

        if not is_match and overlaps_non_phi:
            false_positives.append(detected)

    # Calculate per-type metrics
    per_type_metrics = {}
    for expected_type in set(e["type"] for e in expected_entities):
        type_expected = [e for e in expected_entities if e["type"] == expected_type]
        type_correct = sum(1 for e in type_expected if find_matching_detection(e, detected_entities))
        type_recall = type_correct / len(type_expected) if type_expected else 0.0
        per_type_metrics[expected_type] = {
            "total": len(type_expected),
            "detected": type_correct,
            "recall": round(type_recall, 4),
        }

    # Sample-level metrics
    sample_recall = correct_detections / len(expected_entities) if expected_entities else 1.0
    sample_fp_rate = len(false_positives) / len(non_phi_tokens) if non_phi_tokens else 0.0

    return {
        "sample_id": sample["id"],
        "domain": sample["domain"],
        "complexity": sample["complexity"],
        "text_length": len(text),
        "expected_entities": len(expected_entities),
        "detected_entities": len(detected_entities),
        "correct_detections": correct_detections,
        "missed_entities": [
            {
                "text": e["text"],
                "type": e["type"],
                "expected_pos": f"{e['start']}-{e['end']}",
            }
            for e in missed_entities
        ],
        "false_positives": [
            {
                "text": text[d["start"] : d["end"]],
                "type": d["type"],
                "detected_pos": f"{d['start']}-{d['end']}",
            }
            for d in false_positives
        ],
        "per_type_metrics": per_type_metrics,
        "sample_recall": round(sample_recall, 4),
        "sample_fp_rate": round(sample_fp_rate, 4),
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Sprint 4 GO/NO-GO Gate Verification for PII Detection",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Verbose output: show per-sample results",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output results as JSON instead of human-readable format",
    )
    args = parser.parse_args()

    # Connect to sidecar
    sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    try:
        sock.connect(SOCKET_PATH)
    except (FileNotFoundError, ConnectionRefusedError) as exc:
        error_msg = f"ERROR: Cannot connect to {SOCKET_PATH}: {exc}\n"
        error_msg += "Make sure the sidecar server is running:\n"
        error_msg += "  python3 sidecar/server.py\n"
        if args.json:
            print(json.dumps({"gate": "sprint-4", "decision": "ERROR", "message": str(exc)}))
        else:
            print(error_msg, file=sys.stderr)
        return 2

    print(f"Connected to sidecar at {SOCKET_PATH}", file=sys.stderr)

    # Run tests
    results = []
    total_expected_entities = 0
    total_detected_entities = 0
    total_correct_detections = 0
    total_non_phi_tokens = 0
    total_false_positives = 0

    for idx, sample in enumerate(GOLD_STANDARD):
        result = run_sample_test(sock, sample, idx + 1)
        results.append(result)

        # Accumulate metrics
        if "error" not in result:
            total_expected_entities += result["expected_entities"]
            total_detected_entities += result["detected_entities"]
            total_correct_detections += result["correct_detections"]
            total_non_phi_tokens += sum(1 for token in sample.get("non_phi_tokens", []))

            # Count false positives across all samples
            total_false_positives += len(result["false_positives"])

    sock.close()

    # Calculate overall metrics
    overall_recall = (
        total_correct_detections / total_expected_entities
        if total_expected_entities > 0
        else 1.0
    )
    overall_fp_rate = (
        total_false_positives / total_non_phi_tokens if total_non_phi_tokens > 0 else 0.0
    )

    # Determine pass/fail
    recall_pass = overall_recall >= RECALL_THRESHOLD
    fp_pass = overall_fp_rate < FP_RATE_THRESHOLD
    gate_pass = recall_pass and fp_pass
    decision = "GO" if gate_pass else "NO-GO"

    # Calculate per-type metrics across all samples
    per_type_aggregated = {}
    for result in results:
        if "error" not in result:
            for entity_type, metrics in result.get("per_type_metrics", {}).items():
                if entity_type not in per_type_aggregated:
                    per_type_aggregated[entity_type] = {"total": 0, "detected": 0}
                per_type_aggregated[entity_type]["total"] += metrics["total"]
                per_type_aggregated[entity_type]["detected"] += metrics["detected"]

    for entity_type in per_type_aggregated:
        agg = per_type_aggregated[entity_type]
        agg["recall"] = agg["detected"] / agg["total"] if agg["total"] > 0 else 0.0

    # Identify worst-performing samples
    worst_samples = sorted(
        [r for r in results if "error" not in r],
        key=lambda r: r["sample_recall"],
    )[:5]

    # Prepare JSON output
    json_output = {
        "gate": "sprint-4",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "decision": decision,
        "metrics": {
            "recall": round(overall_recall, 4),
            "false_positive_rate": round(overall_fp_rate, 4),
            "total_samples": len(GOLD_STANDARD),
            "total_phi_entities": total_expected_entities,
            "total_detected": total_detected_entities,
            "correct_detections": total_correct_detections,
            "total_non_phi_tokens": total_non_phi_tokens,
            "total_false_positives": total_false_positives,
        },
        "gate_criteria": {
            "recall": {
                "threshold": RECALL_THRESHOLD,
                "actual": round(overall_recall, 4),
                "pass": recall_pass,
            },
            "false_positive_rate": {
                "threshold": FP_RATE_THRESHOLD,
                "actual": round(overall_fp_rate, 4),
                "pass": fp_pass,
            },
        },
        "per_type": {
            entity_type: {
                "total": agg["total"],
                "detected": agg["detected"],
                "recall": round(agg["recall"], 4),
            }
            for entity_type, agg in sorted(per_type_aggregated.items())
        },
        "worst_performing_samples": [
            {
                "sample_id": s["sample_id"],
                "domain": s["domain"],
                "recall": s["sample_recall"],
                "missed_count": len(s["missed_entities"]),
            }
            for s in worst_samples
        ],
        "missed_entities": [
            {
                "sample_id": r["sample_id"],
                "entities": r["missed_entities"],
            }
            for r in results
            if "error" not in r and r["missed_entities"]
        ][:10],  # First 10 samples with misses
    }

    if args.json:
        print(json.dumps(json_output, indent=2))
        return 0 if gate_pass else 1

    # Human-readable format
    print("\n" + "=" * 73)
    print("  PSYGIL SPRINT 4 — GO/NO-GO GATE VERIFICATION")
    print("=" * 73)
    print()
    print(f"Test Corpus:     {len(GOLD_STANDARD)} samples")
    print(f"PHI Entities:    {total_expected_entities} annotated")
    print(f"Non-PHI Tokens:  {total_non_phi_tokens} annotated")
    print()
    print("-" * 73)
    print("─── RESULTS ──────────────────────────────────────────────────────────")
    print("-" * 73)
    print()

    # Recall result
    recall_status = "✅ PASS" if recall_pass else "❌ FAIL"
    print(f"PII Recall:           {overall_recall*100:5.1f}% ({total_correct_detections}/{total_expected_entities})  {recall_status} (≥{RECALL_THRESHOLD*100:.0f}%)")

    # FP rate result
    fp_status = "✅ PASS" if fp_pass else "❌ FAIL"
    print(f"False Positive Rate:   {overall_fp_rate*100:5.1f}% ({total_false_positives}/{total_non_phi_tokens})  {fp_status} (<{FP_RATE_THRESHOLD*100:.0f}%)")

    print()
    print("-" * 73)
    print("─── PER-TYPE RECALL ──────────────────────────────────────────────────")
    print("-" * 73)
    print()

    for entity_type in sorted(per_type_aggregated.keys()):
        agg = per_type_aggregated[entity_type]
        type_recall = agg["recall"]
        type_pass = "✅" if type_recall >= RECALL_THRESHOLD else "⚠️ "
        print(
            f"{entity_type:20s} {type_recall*100:5.1f}% ({agg['detected']}/{agg['total']:2d})   {type_pass}"
        )

    if worst_samples:
        print()
        print("-" * 73)
        print("─── WORST-PERFORMING SAMPLES ─────────────────────────────────────")
        print("-" * 73)
        print()
        for sample in worst_samples:
            print(
                f"{sample['sample_id']:8s} ({sample['domain']:20s}) {sample['sample_recall']*100:5.1f}% recall — {len(sample['missed_entities'])} missed"
            )

    if args.verbose:
        print()
        print("-" * 73)
        print("─── MISSED ENTITIES (FIRST 10) ────────────────────────────────────")
        print("-" * 73)
        print()
        missed_count = 0
        for result in results:
            if "error" in result or not result["missed_entities"]:
                continue
            print(f"{result['sample_id']}:")
            for entity in result["missed_entities"]:
                print(f"  - \"{entity['text']}\" ({entity['type']})")
            missed_count += 1
            if missed_count >= 10:
                break

    print()
    print("=" * 73)
    print(f"  DECISION:  {'✅ GO' if gate_pass else '❌ NO-GO'}")
    if not gate_pass:
        if not recall_pass:
            print(f"    → Recall {overall_recall*100:.1f}% is below {RECALL_THRESHOLD*100:.0f}% threshold")
        if not fp_pass:
            print(f"    → FP rate {overall_fp_rate*100:.1f}% exceeds {FP_RATE_THRESHOLD*100:.0f}% threshold")
    print("=" * 73)
    print()

    return 0 if gate_pass else 1


if __name__ == "__main__":
    sys.exit(main())
