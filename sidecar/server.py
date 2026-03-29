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


# ---------------------------------------------------------------------------
# In-memory UNID map storage
# ---------------------------------------------------------------------------

_unid_maps: dict[str, dict[str, str]] = {}  # operationId -> { phiValue -> unid }


def _generate_unid(entity_type: str) -> str:
    """Generate a UNID: TYPE_6hexchars"""
    import secrets
    hex_str = secrets.token_hex(3)  # 6 hex characters
    return f"{entity_type}_{hex_str}"


def _map_presidio_type_to_unid_type(presidio_type: str) -> str:
    """Map Presidio entity types to UNID type prefixes."""
    mapping = {
        "PERSON": "PERSON",
        "DATE_TIME": "DATE",  # Will be refined to DOB if context suggests it
        "PHONE_NUMBER": "PHONE",
        "EMAIL_ADDRESS": "EMAIL",
        "US_SSN": "SSN",
        "MEDICAL_LICENSE": "LICENSE",
        "US_BANK_NUMBER": "RECNUM",
        "US_DRIVER_LICENSE": "LICENSE",
        "IP_ADDRESS": "IP",
        "URL": "URL",
        "LOCATION": "ADDRESS",
        "IBAN_CODE": "RECNUM",
        "CREDIT_CARD": "RECNUM",
        "US_PASSPORT": "LICENSE",
        "NRP": "OTHER",
        "US_ITIN": "RECNUM",
        "CRYPTO": "BIOMETRIC",
        "SG_NRIC_FIN": "OTHER",
    }
    return mapping.get(presidio_type, "OTHER")


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


@rpc_method("pii/redact")
async def pii_redact(params: Any) -> dict:
    """Redact PHI with UNIDs: takes full-PHI text, returns redacted text + map."""
    text = params.get("text", "") if isinstance(params, dict) else ""
    operation_id = params.get("operationId", "") if isinstance(params, dict) else ""
    context = params.get("context", "intake") if isinstance(params, dict) else "intake"

    if not text or not operation_id:
        return {"redactedText": text, "entityCount": 0, "typeBreakdown": {}}

    analyzer = _get_analyzer()
    entities = analyzer.analyze(
        text=text,
        entities=HIPAA_ENTITIES,
        language="en",
    )

    # Create UNID map for this operation
    unid_map: dict[str, str] = {}
    type_breakdown: dict[str, int] = {}

    # Sort by position descending so we can replace without shifting indices
    sorted_entities = sorted(entities, key=lambda e: e.start, reverse=True)

    redacted_text = text
    for entity in sorted_entities:
        phi_value = text[entity.start : entity.end]

        # Check if we've already mapped this exact PHI value in this operation
        if phi_value not in unid_map:
            unid_type = _map_presidio_type_to_unid_type(entity.entity_type)
            # Special case: DATE_TIME might be DOB or just DATE (heuristic: in context, if mentioned early, might be DOB)
            if entity.entity_type == "DATE_TIME" and "birth" in text[max(0, entity.start - 50) : entity.start].lower():
                unid_type = "DOB"
            unid_map[phi_value] = _generate_unid(unid_type)
            type_breakdown[unid_type] = type_breakdown.get(unid_type, 0) + 1

        unid = unid_map[phi_value]
        redacted_text = redacted_text[:entity.start] + unid + redacted_text[entity.end :]

    # Store map in memory
    _unid_maps[operation_id] = unid_map

    return {
        "redactedText": redacted_text,
        "entityCount": len(unid_map),
        "typeBreakdown": type_breakdown,
    }


@rpc_method("pii/rehydrate")
async def pii_rehydrate(params: Any) -> dict:
    """Rehydrate UNIDs back to original PHI."""
    text = params.get("text", "") if isinstance(params, dict) else ""
    operation_id = params.get("operationId", "") if isinstance(params, dict) else ""

    if not operation_id or operation_id not in _unid_maps:
        return {"fullText": text, "unidsReplaced": 0}

    unid_map = _unid_maps[operation_id]
    full_text = text
    replaced_count = 0

    # Reverse the map: unid -> phi_value
    reverse_map = {v: k for k, v in unid_map.items()}

    # Replace all UNIDs with original PHI
    for unid, phi_value in reverse_map.items():
        if unid in full_text:
            full_text = full_text.replace(unid, phi_value)
            replaced_count += 1

    # Destroy the map
    del _unid_maps[operation_id]

    return {"fullText": full_text, "unidsReplaced": replaced_count}


@rpc_method("pii/destroy")
async def pii_destroy(params: Any) -> dict:
    """Explicitly destroy a UNID map."""
    operation_id = params.get("operationId", "") if isinstance(params, dict) else ""

    if operation_id in _unid_maps:
        # Overwrite the map before deletion
        map_to_destroy = _unid_maps[operation_id]
        for key in list(map_to_destroy.keys()):
            map_to_destroy[key] = ""
        del _unid_maps[operation_id]
        return {"destroyed": True}

    return {"destroyed": False}


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
