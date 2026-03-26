"""Psygil Python Sidecar — JSON-RPC 2.0 server over Unix domain socket.

Process 4 in the 4-process architecture:
  1. Electron Main
  2. Renderer (sandboxed)
  3. OnlyOffice (local server)
  4. Python Sidecar (this) — PII detection, NLP pipeline

Startup protocol:
  - Prints {"status":"ready","pid":<pid>} to stdout so Electron Main
    knows the sidecar is accepting connections.
  - Listens on /tmp/psygil-sidecar.sock for JSON-RPC 2.0 requests.
  - Shuts down gracefully on SIGTERM.
"""

import asyncio
import json
import os
import signal
import sys
from typing import Any

import spacy
from presidio_analyzer import AnalyzerEngine, RecognizerRegistry
from presidio_analyzer.nlp_engine import NlpEngineProvider

SOCKET_PATH = "/tmp/psygil-sidecar.sock"

# ---------------------------------------------------------------------------
# Presidio + spaCy initialisation
# ---------------------------------------------------------------------------

_analyzer: AnalyzerEngine | None = None


def _get_analyzer() -> AnalyzerEngine:
    """Lazy-init the Presidio AnalyzerEngine with spaCy en_core_web_lg."""
    global _analyzer
    if _analyzer is not None:
        return _analyzer

    nlp_config = {
        "nlp_engine_name": "spacy",
        "models": [{"lang_code": "en", "model_name": "en_core_web_lg"}],
    }
    nlp_engine = NlpEngineProvider(nlp_configuration=nlp_config).create_engine()

    registry = RecognizerRegistry()
    registry.load_predefined_recognizers(nlp_engine=nlp_engine)

    _analyzer = AnalyzerEngine(
        nlp_engine=nlp_engine,
        registry=registry,
        supported_languages=["en"],
    )
    return _analyzer


# All 18 HIPAA Safe Harbor identifier types mapped to Presidio entity types
HIPAA_ENTITIES: list[str] = [
    "PERSON",             # 1.  Names
    "DATE_TIME",          # 2.  Dates (except year)
    "PHONE_NUMBER",       # 3.  Telephone numbers
    "EMAIL_ADDRESS",      # 4.  Email addresses
    "US_SSN",             # 5.  Social Security numbers
    "MEDICAL_LICENSE",    # 6.  Medical record numbers
    "US_BANK_NUMBER",     # 7.  Account numbers
    "US_DRIVER_LICENSE",  # 8.  Certificate/license numbers
    "IP_ADDRESS",         # 9.  Device identifiers / IPs
    "URL",                # 10. Web URLs
    "LOCATION",           # 11. Geographic data / addresses
    "IBAN_CODE",          # 12. Financial account identifiers
    "CREDIT_CARD",        # 13. Credit card numbers
    "US_PASSPORT",        # 14. Passport numbers
    "NRP",                # 15. National/ethnic identifiers
    "US_ITIN",            # 16. Tax ID numbers
    "CRYPTO",             # 17. Biometric / unique identifiers
    "SG_NRIC_FIN",        # 18. Catch-all unique identifiers
]


# ---------------------------------------------------------------------------
# JSON-RPC 2.0 helpers
# ---------------------------------------------------------------------------

def _make_response(id_: Any, result: Any) -> dict:
    return {"jsonrpc": "2.0", "result": result, "id": id_}


def _make_error(id_: Any, code: int, message: str) -> dict:
    return {"jsonrpc": "2.0", "error": {"code": code, "message": message}, "id": id_}


# ---------------------------------------------------------------------------
# RPC method registry
# ---------------------------------------------------------------------------

METHODS: dict[str, Any] = {}


def rpc_method(name: str):
    """Decorator to register a JSON-RPC method handler."""
    def decorator(fn):
        METHODS[name] = fn
        return fn
    return decorator


@rpc_method("health/ping")
async def health_ping(_params: Any) -> dict:
    return {"status": "ok"}


@rpc_method("pii/detect")
async def pii_detect(params: Any) -> dict:
    """Detect PII entities in a single text using Presidio + spaCy."""
    text = params.get("text", "") if isinstance(params, dict) else ""
    if not text:
        return {"entities": []}

    analyzer = _get_analyzer()
    results = analyzer.analyze(
        text=text,
        entities=HIPAA_ENTITIES,
        language="en",
    )

    entities = [
        {
            "text": text[r.start : r.end],
            "start": r.start,
            "end": r.end,
            "type": r.entity_type,
            "score": round(r.score, 4),
        }
        for r in sorted(results, key=lambda r: r.start)
    ]
    return {"entities": entities}


@rpc_method("pii/batch")
async def pii_batch(params: Any) -> dict:
    """Detect PII entities in multiple texts using Presidio + spaCy."""
    texts = params.get("texts", []) if isinstance(params, dict) else []

    analyzer = _get_analyzer()
    results_list: list[list[dict]] = []

    for text in texts:
        if not text:
            results_list.append([])
            continue

        results = analyzer.analyze(
            text=text,
            entities=HIPAA_ENTITIES,
            language="en",
        )

        entities = [
            {
                "text": text[r.start : r.end],
                "start": r.start,
                "end": r.end,
                "type": r.entity_type,
                "score": round(r.score, 4),
            }
            for r in sorted(results, key=lambda r: r.start)
        ]
        results_list.append(entities)

    return {"results": results_list}


# ---------------------------------------------------------------------------
# Request dispatch
# ---------------------------------------------------------------------------

async def dispatch(raw: bytes) -> bytes:
    """Parse a JSON-RPC 2.0 request and dispatch to the registered handler."""
    try:
        request = json.loads(raw)
    except (json.JSONDecodeError, UnicodeDecodeError):
        resp = _make_error(None, -32700, "Parse error")
        return json.dumps(resp).encode() + b"\n"

    req_id = request.get("id")
    method = request.get("method")
    params = request.get("params", {})

    if not method or not isinstance(method, str):
        resp = _make_error(req_id, -32600, "Invalid Request")
        return json.dumps(resp).encode() + b"\n"

    handler = METHODS.get(method)
    if handler is None:
        resp = _make_error(req_id, -32601, f"Method not found: {method}")
        return json.dumps(resp).encode() + b"\n"

    try:
        result = await handler(params)
        resp = _make_response(req_id, result)
    except Exception as exc:
        resp = _make_error(req_id, -32000, str(exc))

    return json.dumps(resp).encode() + b"\n"


# ---------------------------------------------------------------------------
# Async Unix socket server
# ---------------------------------------------------------------------------

async def handle_client(reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
    """Handle a single client connection. Reads newline-delimited JSON-RPC."""
    try:
        while True:
            line = await reader.readline()
            if not line:
                break
            response = await dispatch(line)
            writer.write(response)
            await writer.drain()
    except asyncio.CancelledError:
        pass
    except ConnectionResetError:
        pass
    finally:
        writer.close()
        try:
            await writer.wait_closed()
        except Exception:
            pass


async def run_server():
    """Start the Unix socket server and signal readiness to Electron."""
    # Clean up stale socket file
    if os.path.exists(SOCKET_PATH):
        os.unlink(SOCKET_PATH)

    server = await asyncio.start_unix_server(handle_client, path=SOCKET_PATH)

    # Signal readiness to Electron Main (it reads stdout for this JSON)
    ready_msg = json.dumps({"status": "ready", "pid": os.getpid()})
    sys.stdout.write(ready_msg + "\n")
    sys.stdout.flush()

    # Graceful shutdown on SIGTERM
    loop = asyncio.get_running_loop()
    shutdown_event = asyncio.Event()

    def on_sigterm():
        shutdown_event.set()

    loop.add_signal_handler(signal.SIGTERM, on_sigterm)
    loop.add_signal_handler(signal.SIGINT, on_sigterm)

    async with server:
        await shutdown_event.wait()

    # Cleanup socket file
    if os.path.exists(SOCKET_PATH):
        os.unlink(SOCKET_PATH)


def main():
    asyncio.run(run_server())


if __name__ == "__main__":
    main()
