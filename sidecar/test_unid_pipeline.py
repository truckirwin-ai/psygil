"""Test the UNID redaction pipeline: redact, rehydrate, destroy.

Usage:
  1. Start the server:  python3 sidecar/server.py
  2. Run this test:      python3 sidecar/test_unid_pipeline.py

Tests the full UNID pipeline:
  - pii/redact: Full-PHI text → redacted text with UNIDs
  - pii/rehydrate: Redacted text with UNIDs → full-PHI text
  - pii/destroy: Explicitly destroy UNID map
"""

import json
import socket
import sys
import re

SOCKET_PATH = "/tmp/psygil-sidecar.sock"


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


def main() -> int:
    failures: list[str] = []

    sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    try:
        sock.connect(SOCKET_PATH)
    except (FileNotFoundError, ConnectionRefusedError) as exc:
        print(f"FAIL — Cannot connect to {SOCKET_PATH}: {exc}")
        print("Make sure the server is running: python3 sidecar/server.py")
        return 1

    # Test 1: pii/redact — detect PHI and replace with UNIDs
    full_phi_text = "John Doe was born on 03/15/1990 and lives at 1247 Elm Street, Denver. His phone is 555-1234."
    operation_id = "test-op-1"

    resp = send_rpc(
        sock,
        "pii/redact",
        {
            "text": full_phi_text,
            "operationId": operation_id,
            "context": "intake",
        },
        req_id=1,
    )

    if "error" in resp:
        failures.append(f"pii/redact: got error response: {resp['error']}")
    else:
        result = resp.get("result", {})
        redacted_text = result.get("redactedText", "")
        entity_count = result.get("entityCount", 0)
        type_breakdown = result.get("typeBreakdown", {})

        # Verify redacted text contains UNIDs and no original PHI
        if "John Doe" in redacted_text:
            failures.append(f"pii/redact: Original name found in redacted text: {redacted_text}")
        if "03/15/1990" in redacted_text:
            failures.append(f"pii/redact: Original DOB found in redacted text: {redacted_text}")
        if "1247 Elm Street" in redacted_text:
            failures.append(f"pii/redact: Original address found in redacted text: {redacted_text}")

        # Verify UNIDs are present
        unid_pattern = r"[A-Z_]+_[0-9a-f]{6}"
        unids_found = re.findall(unid_pattern, redacted_text)
        if len(unids_found) < 2:
            failures.append(f"pii/redact: Expected at least 2 UNIDs, got {len(unids_found)}: {redacted_text}")

        # Verify entity count
        if entity_count < 2:
            failures.append(f"pii/redact: Expected at least 2 entities, got {entity_count}")

        # Verify type breakdown has entries
        if len(type_breakdown) == 0:
            failures.append(f"pii/redact: Expected type breakdown, got empty dict")

        print(f"✓ pii/redact succeeded")
        print(f"  - Redacted text: {redacted_text}")
        print(f"  - Entity count: {entity_count}")
        print(f"  - Type breakdown: {type_breakdown}")

    # Test 2: pii/rehydrate — replace UNIDs back to original PHI
    # Simulate AI response that echoes back the redacted text
    ai_response = f"Patient {redacted_text.split()[0]} presented with concern."

    resp = send_rpc(
        sock,
        "pii/rehydrate",
        {
            "text": ai_response,
            "operationId": operation_id,
        },
        req_id=2,
    )

    if "error" in resp:
        failures.append(f"pii/rehydrate: got error response: {resp['error']}")
    else:
        result = resp.get("result", {})
        full_text = result.get("fullText", "")
        unids_replaced = result.get("unidsReplaced", 0)

        # Verify rehydrated text contains original PHI
        if "John Doe" not in full_text and "John" not in full_text:
            failures.append(f"pii/rehydrate: Original name not found in rehydrated text: {full_text}")

        # Verify UNIDs are gone
        unid_pattern = r"[A-Z_]+_[0-9a-f]{6}"
        unids_remaining = re.findall(unid_pattern, full_text)
        if len(unids_remaining) > 0:
            failures.append(f"pii/rehydrate: UNIDs still present in rehydrated text: {unids_remaining}")

        print(f"✓ pii/rehydrate succeeded")
        print(f"  - Rehydrated text: {full_text}")
        print(f"  - UNIDs replaced: {unids_replaced}")

    # Test 3: pii/destroy — destroy a UNID map
    operation_id_2 = "test-op-2"

    # First create a map
    resp = send_rpc(
        sock,
        "pii/redact",
        {
            "text": "Jane Smith",
            "operationId": operation_id_2,
            "context": "intake",
        },
        req_id=3,
    )

    if "error" in resp:
        failures.append(f"pii/redact (for destroy test): got error response")
    else:
        # Now destroy it
        resp = send_rpc(
            sock,
            "pii/destroy",
            {
                "operationId": operation_id_2,
            },
            req_id=4,
        )

        if "error" in resp:
            failures.append(f"pii/destroy: got error response: {resp['error']}")
        else:
            result = resp.get("result", {})
            destroyed = result.get("destroyed", False)
            if not destroyed:
                failures.append(f"pii/destroy: reported destroyed=False")
            else:
                print(f"✓ pii/destroy succeeded")

    # Test 4: pii/destroy on non-existent map should return destroyed=False
    resp = send_rpc(
        sock,
        "pii/destroy",
        {
            "operationId": "nonexistent-map",
        },
        req_id=5,
    )

    if "error" not in resp:
        result = resp.get("result", {})
        destroyed = result.get("destroyed", False)
        if destroyed:
            failures.append(f"pii/destroy (nonexistent): should return destroyed=False, got True")
        else:
            print(f"✓ pii/destroy (nonexistent map) correctly returned False")

    sock.close()

    if failures:
        print("\nFAIL")
        for f in failures:
            print(f"  - {f}")
        return 1

    print("\n✓ All tests PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
