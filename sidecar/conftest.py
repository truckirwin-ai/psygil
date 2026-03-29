"""Pytest configuration and fixtures for sidecar tests.

This file provides:
- Automatic server health check at session startup
- Clear error messages if server is not running
- Session-scoped sidecar client fixture
"""

import socket
import sys
import pytest
from test_deidentification import SidecarClient, SOCKET_PATH


def pytest_configure(config):
    """Check that sidecar is running before tests start."""
    try:
        client = SidecarClient(SOCKET_PATH)
        client.connect()

        # Verify health
        response = client.send_rpc("health/ping")
        if response.get("result", {}).get("status") != "ok":
            raise ValueError("Sidecar health check failed")

        client.close()
        print(f"\n✓ Sidecar is running at {SOCKET_PATH}")

    except (FileNotFoundError, ConnectionRefusedError, ConnectionError) as exc:
        print(f"\n✗ SIDECAR NOT RUNNING")
        print(f"\nPlease start the sidecar server in a separate terminal:")
        print(f"  python3 sidecar/server.py")
        print(f"\nWaiting for connection at: {SOCKET_PATH}")
        print(f"\nError: {exc}")
        sys.exit(1)


@pytest.fixture(scope="session")
def sidecar_client():
    """Session-scoped sidecar client."""
    client = SidecarClient(SOCKET_PATH)
    client.connect()
    yield client
    client.close()
