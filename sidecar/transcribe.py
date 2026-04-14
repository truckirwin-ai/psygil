"""
Psygil Live Streaming Transcription Service

Uses faster-whisper for local, HIPAA-compliant speech-to-text.
Communicates via Unix domain socket.

Live streaming architecture (like Zoom/Otter):
  1. Renderer captures audio via MediaRecorder in 250ms chunks
  2. Electron Main relays raw WebM/Opus bytes over this socket
  3. This service decodes via FFmpeg → accumulates PCM buffer
  4. Every ~2-3 seconds of audio, runs faster-whisper
  5. Sends partial transcripts back immediately

Protocol:
  - JSON-RPC 2.0 for control messages (health, status, file transcription)
  - Binary streaming protocol for live audio:
    * Client sends: {"method":"stream/start","id":1,"params":{"session_id":"..."}}\n
    * Client sends: AUDIO:<base64-encoded-webm-chunk>\n  (repeated every 250ms)
    * Client sends: {"method":"stream/stop","id":2,"params":{"session_id":"..."}}\n
    * Server sends back: {"result":{"type":"partial","text":"...","session_id":"..."}}\n
    * Server sends back: {"result":{"type":"final","text":"...","session_id":"..."}}\n

Installation:
  pip install faster-whisper numpy

The first run will download the 'base.en' model (~150MB).
Models are cached at ~/.cache/huggingface/hub/
"""

import asyncio
import base64
import json
import os
import signal
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from typing import Any

SOCKET_PATH = "/tmp/psygil-transcribe.sock"

# ---------------------------------------------------------------------------
# faster-whisper lazy init
# ---------------------------------------------------------------------------

_model = None
_model_size = "base.en"


def _get_model():
    """Lazy-load the faster-whisper model."""
    global _model
    if _model is not None:
        return _model

    try:
        from faster_whisper import WhisperModel

        _model = WhisperModel(
            _model_size,
            device="auto",
            compute_type="int8",
        )
        print(f"[Transcribe] Model loaded: {_model_size}", file=sys.stderr)
        return _model
    except ImportError:
        print(
            "[Transcribe] faster-whisper not installed. Run: pip install faster-whisper",
            file=sys.stderr,
        )
        return None
    except Exception as e:
        print(f"[Transcribe] Model load error: {e}", file=sys.stderr)
        return None


# ---------------------------------------------------------------------------
# FFmpeg audio decoding
# ---------------------------------------------------------------------------


def decode_webm_to_pcm(webm_bytes: bytes) -> bytes:
    """
    Decode WebM/Opus audio bytes to raw PCM s16le at 16kHz mono.
    Uses FFmpeg subprocess — handles any input format.
    """
    try:
        process = subprocess.Popen(
            [
                "ffmpeg",
                "-i", "pipe:0",
                "-f", "s16le",
                "-ar", "16000",
                "-ac", "1",
                "-loglevel", "error",
                "pipe:1",
            ],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        pcm_data, stderr = process.communicate(input=webm_bytes, timeout=10)
        if process.returncode != 0:
            err = stderr.decode("utf-8", errors="replace").strip()
            # Don't log for empty/tiny chunks — expected during startup
            if len(webm_bytes) > 100:
                print(f"[Transcribe] FFmpeg decode error: {err}", file=sys.stderr)
            return b""
        return pcm_data
    except subprocess.TimeoutExpired:
        process.kill()
        return b""
    except FileNotFoundError:
        print("[Transcribe] FFmpeg not found. Install: brew install ffmpeg", file=sys.stderr)
        return b""
    except Exception as e:
        print(f"[Transcribe] Decode error: {e}", file=sys.stderr)
        return b""


def pcm_to_float32(pcm_s16: bytes):
    """Convert raw PCM s16le bytes to numpy float32 array."""
    import numpy as np
    audio = np.frombuffer(pcm_s16, dtype=np.int16).astype(np.float32) / 32768.0
    return audio


# ---------------------------------------------------------------------------
# Live streaming session
# ---------------------------------------------------------------------------


class StreamingSession:
    """
    Manages a live transcription session.

    Accumulates raw PCM float32 audio (16 kHz mono, sent directly from
    the renderer's AudioWorklet — no container format, no FFmpeg needed).
    Runs whisper every CHUNK_SECONDS and sends partial transcripts back.
    """

    CHUNK_SECONDS = 3.0  # Transcribe every 3 seconds of audio
    SAMPLE_RATE = 16000
    OVERLAP_SECONDS = 0.5  # Keep last 0.5s as context for next chunk

    def __init__(self, session_id: str, writer: asyncio.StreamWriter):
        import numpy as np
        self.session_id = session_id
        self.writer = writer
        self.pcm_buffer = np.array([], dtype=np.float32)
        self.full_transcript = ""
        self.running = False
        self._process_task = None
        self._lock = asyncio.Lock()
        self._new_audio = asyncio.Event()

    async def start(self):
        """Start the background processing loop."""
        self.running = True
        self._process_task = asyncio.create_task(self._process_loop())

    async def stop(self):
        """Stop processing, flush remaining audio, send final transcript."""
        buf_secs = len(self.pcm_buffer) / self.SAMPLE_RATE
        print(f"[Transcribe] Stopping session {self.session_id}, buffer={buf_secs:.1f}s, chunks={self._chunk_count}", file=sys.stderr)
        self.running = False
        self._new_audio.set()  # Wake up the loop
        if self._process_task:
            await self._process_task

        # Final flush — transcribe whatever's left in the buffer
        buf_secs_final = len(self.pcm_buffer) / self.SAMPLE_RATE
        if buf_secs_final > 0.1:
            print(f"[Transcribe] Final flush: {buf_secs_final:.1f}s remaining", file=sys.stderr)
        await self._transcribe_buffer(final=True)

        # Send final message
        print(f"[Transcribe] Final transcript: {len(self.full_transcript)} chars", file=sys.stderr)
        await self._send({
            "type": "final",
            "session_id": self.session_id,
            "text": self.full_transcript.strip(),
        })

    _chunk_count = 0

    def add_raw_pcm_float32(self, raw_bytes: bytes):
        """
        Add raw PCM float32 audio directly from the renderer's ScriptProcessorNode.
        The data is already 16 kHz mono float32 — no decoding needed.
        """
        import numpy as np
        if not raw_bytes or len(raw_bytes) < 4:
            return
        try:
            audio = np.frombuffer(raw_bytes, dtype=np.float32)
            self.pcm_buffer = np.concatenate([self.pcm_buffer, audio])
            self._chunk_count += 1
            buf_secs = len(self.pcm_buffer) / self.SAMPLE_RATE
            if self._chunk_count <= 3 or self._chunk_count % 20 == 0:
                print(f"[Transcribe] PCM chunk #{self._chunk_count}: {len(audio)} samples, buffer={buf_secs:.1f}s", file=sys.stderr)
            self._new_audio.set()
        except Exception as e:
            print(f"[Transcribe] PCM parse error: {e}", file=sys.stderr)

    async def _process_loop(self):
        """Background loop: transcribe accumulated audio every CHUNK_SECONDS."""
        while self.running:
            # Wait for new audio or stop signal, with a timeout so we
            # periodically re-check the buffer even without new events.
            try:
                await asyncio.wait_for(self._new_audio.wait(), timeout=1.0)
            except asyncio.TimeoutError:
                pass
            self._new_audio.clear()

            if not self.running:
                break

            # Check if we have enough audio to transcribe
            buffer_duration = len(self.pcm_buffer) / self.SAMPLE_RATE
            if buffer_duration >= self.CHUNK_SECONDS:
                print(f"[Transcribe] Processing {buffer_duration:.1f}s of audio...", file=sys.stderr)
                await self._transcribe_buffer(final=False)

    async def _transcribe_buffer(self, final: bool = False):
        """Run faster-whisper on the accumulated buffer."""
        import numpy as np

        async with self._lock:
            if len(self.pcm_buffer) < self.SAMPLE_RATE * 0.5:
                # Less than 0.5s — skip unless final
                if not final:
                    return
                if len(self.pcm_buffer) < self.SAMPLE_RATE * 0.1:
                    return  # Too short even for final

            audio_to_process = self.pcm_buffer.copy()

            if not final:
                # Keep overlap for context continuity
                overlap_samples = int(self.OVERLAP_SECONDS * self.SAMPLE_RATE)
                self.pcm_buffer = self.pcm_buffer[-overlap_samples:]
            else:
                self.pcm_buffer = np.array([], dtype=np.float32)

        model = _get_model()
        if model is None:
            await self._send({
                "type": "error",
                "session_id": self.session_id,
                "error": "Transcription model not available",
            })
            return

        # Run transcription in executor to avoid blocking
        audio_secs = len(audio_to_process) / self.SAMPLE_RATE
        print(f"[Transcribe] Running whisper on {audio_secs:.1f}s of audio (final={final})...", file=sys.stderr)
        loop = asyncio.get_event_loop()
        try:
            text = await loop.run_in_executor(None, self._run_whisper, audio_to_process)
            if text.strip():
                self.full_transcript += " " + text.strip()
                print(f"[Transcribe] Got text: '{text.strip()[:80]}...' ({len(text.strip())} chars)", file=sys.stderr)
                await self._send({
                    "type": "partial",
                    "session_id": self.session_id,
                    "text": text.strip(),
                })
            else:
                print(f"[Transcribe] Whisper returned empty text for {audio_secs:.1f}s of audio", file=sys.stderr)
        except Exception as e:
            print(f"[Transcribe] Whisper error: {e}", file=sys.stderr)
            await self._send({
                "type": "error",
                "session_id": self.session_id,
                "error": str(e),
            })

    def _run_whisper(self, audio) -> str:
        """Synchronous whisper transcription (runs in executor)."""
        model = _get_model()
        if model is None:
            return ""

        segments, _ = model.transcribe(
            audio,
            language="en",
            beam_size=1,  # Fast for real-time
            vad_filter=True,
            vad_parameters=dict(
                min_silence_duration_ms=300,
                speech_pad_ms=100,
            ),
        )

        parts = []
        for seg in segments:
            parts.append(seg.text.strip())
        return " ".join(parts)

    async def _send(self, result: dict):
        """Send a JSON result to the client."""
        try:
            msg = json.dumps({"jsonrpc": "2.0", "result": result, "id": None})
            self.writer.write(msg.encode("utf-8") + b"\n")
            await self.writer.drain()
        except Exception as e:
            print(f"[Transcribe] Send error: {e}", file=sys.stderr)


# ---------------------------------------------------------------------------
# File-based transcription (batch mode)
# ---------------------------------------------------------------------------


def transcribe_file(audio_path: str, language: str = "en") -> dict:
    """Transcribe a complete audio file."""
    model = _get_model()
    if model is None:
        return {"error": "faster-whisper not available", "text": "", "segments": [], "duration_sec": 0}

    if not os.path.exists(audio_path):
        return {"error": f"File not found: {audio_path}", "text": "", "segments": [], "duration_sec": 0}

    start_time = time.time()
    segments_iter, info = model.transcribe(
        audio_path,
        language=language,
        beam_size=5,
        vad_filter=True,
        vad_parameters=dict(min_silence_duration_ms=500, speech_pad_ms=200),
    )

    segments = []
    parts = []
    for seg in segments_iter:
        segments.append({"start": round(seg.start, 2), "end": round(seg.end, 2), "text": seg.text.strip()})
        parts.append(seg.text.strip())

    return {
        "text": " ".join(parts),
        "segments": segments,
        "duration_sec": round(time.time() - start_time, 2),
        "language": getattr(info, "language", language),
    }


# ---------------------------------------------------------------------------
# Socket server — handles both JSON-RPC and streaming audio
# ---------------------------------------------------------------------------

# Active streaming sessions
_sessions: dict[str, StreamingSession] = {}


async def handle_client(reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
    """Handle a single client connection with mixed JSON-RPC + audio streaming."""
    try:
        while True:
            line = await reader.readline()
            if not line:
                break

            line_str = line.decode("utf-8", errors="replace").strip()
            if not line_str:
                continue

            # Check for binary audio data: AUDIO:<base64>\n (legacy protocol)
            if line_str.startswith("AUDIO:"):
                b64_data = line_str[6:]
                try:
                    raw_bytes = base64.b64decode(b64_data)
                except Exception:
                    continue

                # Feed raw PCM float32 to all active sessions on this connection
                for session in _sessions.values():
                    if session.writer is writer:
                        session.add_raw_pcm_float32(raw_bytes)
                continue

            # JSON-RPC message
            try:
                data = json.loads(line_str)
            except json.JSONDecodeError:
                resp = {"jsonrpc": "2.0", "error": {"code": -32700, "message": "Parse error"}, "id": None}
                writer.write(json.dumps(resp).encode("utf-8") + b"\n")
                await writer.drain()
                continue

            method = data.get("method", "")
            params = data.get("params", {})
            req_id = data.get("id")

            if method == "health/ping":
                model = _get_model()
                resp = {
                    "jsonrpc": "2.0",
                    "result": {"status": "ok", "model": _model_size, "model_loaded": model is not None},
                    "id": req_id,
                }

            elif method == "transcription/status":
                model = _get_model()
                resp = {
                    "jsonrpc": "2.0",
                    "result": {"available": model is not None, "model": _model_size, "backend": "faster-whisper"},
                    "id": req_id,
                }

            elif method == "transcription/transcribe":
                file_path = params.get("file_path", "")
                language = params.get("language", "en")
                loop = asyncio.get_event_loop()
                result = await loop.run_in_executor(None, lambda: transcribe_file(file_path, language))
                resp = {"jsonrpc": "2.0", "result": result, "id": req_id}

            elif method == "stream/start":
                session_id = params.get("session_id", "")
                if not session_id:
                    resp = {"jsonrpc": "2.0", "error": {"code": -32602, "message": "session_id required"}, "id": req_id}
                else:
                    session = StreamingSession(session_id, writer)
                    _sessions[session_id] = session
                    await session.start()
                    resp = {"jsonrpc": "2.0", "result": {"started": True, "session_id": session_id}, "id": req_id}
                    print(f"[Transcribe] Stream started: {session_id}", file=sys.stderr)

            elif method == "stream/stop":
                session_id = params.get("session_id", "")
                session = _sessions.pop(session_id, None)
                if session:
                    await session.stop()
                    resp = {"jsonrpc": "2.0", "result": {"stopped": True, "session_id": session_id}, "id": req_id}
                    print(f"[Transcribe] Stream stopped: {session_id}", file=sys.stderr)
                else:
                    resp = {"jsonrpc": "2.0", "result": {"stopped": False, "error": "session not found"}, "id": req_id}

            elif method == "stream/audio":
                # Audio arrives as raw PCM float32 (16 kHz mono) in base64
                # Sent directly from the renderer's AudioWorklet — no container format
                session_id = params.get("session_id", "")
                audio_b64 = params.get("audio", "")
                session = _sessions.get(session_id)
                if session and audio_b64:
                    try:
                        raw_bytes = base64.b64decode(audio_b64)
                        session.add_raw_pcm_float32(raw_bytes)
                    except Exception as e:
                        print(f"[Transcribe] Audio chunk error: {e}", file=sys.stderr)
                # No response for audio chunks (fire-and-forget)
                continue

            else:
                resp = {
                    "jsonrpc": "2.0",
                    "error": {"code": -32601, "message": f"Method not found: {method}"},
                    "id": req_id,
                }

            writer.write(json.dumps(resp).encode("utf-8") + b"\n")
            await writer.drain()

    except asyncio.CancelledError:
        pass
    except ConnectionResetError:
        pass
    except Exception as e:
        print(f"[Transcribe] Client error: {e}", file=sys.stderr)
    finally:
        # Clean up any sessions on this connection
        dead = [sid for sid, s in _sessions.items() if s.writer is writer]
        for sid in dead:
            s = _sessions.pop(sid)
            s.running = False
        writer.close()
        try:
            await writer.wait_closed()
        except Exception:
            pass


async def main():
    """Start the transcription socket server."""
    if os.path.exists(SOCKET_PATH):
        os.unlink(SOCKET_PATH)

    server = await asyncio.start_unix_server(handle_client, path=SOCKET_PATH)

    ready_msg = json.dumps({"status": "ready", "pid": os.getpid(), "service": "transcription"})
    print(ready_msg, flush=True)

    loop = asyncio.get_event_loop()

    def _shutdown(sig, _frame):
        print(f"[Transcribe] Received {sig}, shutting down...", file=sys.stderr)
        server.close()
        loop.stop()

    for sig in (signal.SIGTERM, signal.SIGINT):
        signal.signal(sig, _shutdown)

    print(f"[Transcribe] Listening on {SOCKET_PATH}", file=sys.stderr)

    async with server:
        await server.serve_forever()


if __name__ == "__main__":
    asyncio.run(main())
