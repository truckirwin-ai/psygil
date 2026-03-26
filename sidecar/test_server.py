"""Test client for the Psygil sidecar JSON-RPC server.

Usage:
  1. Start the server:  python3 sidecar/server.py
  2. Run this test:      python3 sidecar/test_server.py

Tests:
  - Connects to Unix socket at /tmp/psygil-sidecar.sock
  - Sends health/ping → asserts {"status":"ok"}
  - Sends pii/detect stub → asserts text returned unchanged
  - Sends pii/batch stub → asserts texts returned unchanged
  - Sends unknown method → asserts error response
  - Prints PASS or FAIL
"""

import json
import socket
import sys

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

    # Test 1: health/ping
    resp = send_rpc(sock, "health/ping", req_id=1)
    if resp.get("result") != {"status": "ok"}:
        failures.append(f"health/ping: expected {{'status':'ok'}}, got {resp.get('result')}")

    # Test 2: pii/detect stub
    resp = send_rpc(sock, "pii/detect", {"text": "John Doe was born on 1/1/1990"}, req_id=2)
    result = resp.get("result", {})
    if result.get("text") != "John Doe was born on 1/1/1990":
        failures.append(f"pii/detect: text not returned unchanged, got {result}")
    if result.get("entities") != []:
        failures.append(f"pii/detect: expected empty entities, got {result.get('entities')}")

    # Test 3: pii/batch stub
    texts = ["Alice", "Bob"]
    resp = send_rpc(sock, "pii/batch", {"texts": texts}, req_id=3)
    result = resp.get("result", {})
    if len(result.get("results", [])) != 2:
        failures.append(f"pii/batch: expected 2 results, got {len(result.get('results', []))}")

    # Test 4: unknown method → error
    resp = send_rpc(sock, "nonexistent/method", req_id=4)
    if "error" not in resp:
        failures.append(f"unknown method: expected error response, got {resp}")

    sock.close()

    if failures:
        print("FAIL")
        for f in failures:
            print(f"  - {f}")
        return 1

    print("PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
