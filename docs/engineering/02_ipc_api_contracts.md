# Psygil IPC API Contract Specification

**Document Version:** 1.0
**Last Updated:** March 2026
**Author:** Psygil Engineering Team
**Status:** Active

---

## Table of Contents

1. [Overview](#overview)
2. [Communication Boundaries](#communication-boundaries)
3. [Boundary 1: Electron Main ↔ Python Sidecar](#boundary-1-electron-main--python-sidecar)
4. [Boundary 2: Electron Main ↔ OnlyOffice Document Editor](#boundary-2-electron-main--onlyoffice-document-editor)
5. [Boundary 3: Electron Main ↔ LLM Gateway](#boundary-3-electron-main--llm-gateway)
6. [Boundary 4: Electron Main ↔ Renderer (React UI)](#boundary-4-electron-main--renderer-react-ui)
7. [Cross-Cutting Concerns](#cross-cutting-concerns)
8. [Error Handling](#error-handling)
9. [Security Architecture](#security-architecture)

---

## Overview

Psygil is an Electron desktop application for clinical document analysis and AI-assisted review. This specification defines the contract interfaces for all inter-process communication (IPC) boundaries in the application architecture.

### Architecture Diagram

```
┌─────────────────────────────────────────────┐
│           Electron Main Process              │
│                                              │
│  ┌──────────────────────────────────────┐  │
│  │   Core Application Logic             │  │
│  │   • Case Management                  │  │
│  │   • Orchestration                    │  │
│  │   • IPC Routing                      │  │
│  └──────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
        │              │              │
        │              │              │
   ┌────▼─┐       ┌────▼─────┐   ┌──▼────────┐
   │Python│       │OnlyOffice │   │LLM Gateway│
   │Sidecar       │ (embedded)│   │(HTTP/REST)│
   └──────┘       └───────────┘   └───────────┘
        │
        │ (Renderer IPC)
        ▼
┌─────────────────────────┐
│   React Renderer        │
│   (nodeIntegration:false)
└─────────────────────────┘
```

---

## Communication Boundaries

| Boundary | Type | Protocol | Purpose |
|----------|------|----------|---------|
| Main ↔ Python | Local IPC | Unix Socket / Named Pipe | PII Detection, Transcription, Style Extraction |
| Main ↔ OnlyOffice | Embedded API | OnlyOffice SDK + Events | Document Editing & Manipulation |
| Main ↔ LLM Gateway | Network | HTTPS REST | LLM Completions, Token Counting |
| Main ↔ Renderer | Process IPC | Electron IPC (contextBridge) | UI State & User Interactions |

---

# Boundary 1: Electron Main ↔ Python Sidecar

## Overview

The Python Sidecar handles sensitive NLP tasks: PII detection via Microsoft Presidio, audio transcription via OpenAI Whisper, and writing style extraction. Communication occurs over a local Unix socket (macOS/Linux) or Named Pipe (Windows) using JSON-RPC 2.0.

### Connection Details

- **Protocol:** JSON-RPC 2.0
- **Transport:** Unix socket (`/tmp/Psygil-sidecar.sock` or Windows Named Pipe `\\.\pipe\Psygil-sidecar`)
- **Startup:** Main process spawns Python child process on app launch
- **Shutdown:** Main process terminates sidecar on app exit
- **Health Check Interval:** Every 30 seconds
- **Request Timeout:** 60 seconds (PII/Transcription), 30 seconds (Health)
- **Max Concurrent Requests:** 5 per service type

---

## Endpoint: POST /pii/detect

**Description:** De-identify a single text section by detecting and replacing PII entities.

**Direction:** Main → Sidecar (Request), Sidecar → Main (Response)

### Request Schema

```json
{
  "jsonrpc": "2.0",
  "method": "pii/detect",
  "params": {
    "text": "Patient John Smith, DOB 01/15/1985, SSN 123-45-6789",
    "entity_types": ["PERSON", "DATE", "SSN"],
    "redaction_style": "bracket",
    "include_positions": true,
    "language": "en"
  },
  "id": "req_001_timestamp_uuid"
}
```

**Parameters:**

| Field | Type | Required | Description | Default |
|-------|------|----------|-------------|---------|
| `text` | string | Yes | Raw text to de-identify | — |
| `entity_types` | string[] | No | Specific entities to detect (empty = all) | All supported types |
| `redaction_style` | enum | No | `bracket` \| `hash` \| `placeholder` | `bracket` |
| `include_positions` | boolean | No | Return start/end char positions | true |
| `language` | string | No | ISO 639-1 language code | `en` |

**Supported Entity Types:**

- `PERSON` — Names
- `EMAIL` — Email addresses
- `PHONE` — Phone numbers
- `DATE` — Dates (various formats)
- `SSN` — US Social Security Numbers
- `CREDIT_CARD` — Credit card numbers
- `MEDICAL_RECORD` — Medical record numbers
- `MRN` — Medical Record Numbers
- `PATIENT_ID` — Patient identifiers
- `LOCATION` — Geographic locations (privacy-sensitive)
- `HOSPITAL` — Hospital/facility names
- `IBAN` — International Bank Account Numbers

### Response Schema

```json
{
  "jsonrpc": "2.0",
  "result": {
    "de_identified_text": "Patient [PERSON], DOB [DATE], SSN [SSN]",
    "entities": [
      {
        "original_text": "John Smith",
        "entity_type": "PERSON",
        "replacement_placeholder": "[PERSON]",
        "confidence_score": 0.95,
        "start_position": 8,
        "end_position": 18,
        "redaction_style": "bracket"
      },
      {
        "original_text": "01/15/1985",
        "entity_type": "DATE",
        "replacement_placeholder": "[DATE]",
        "confidence_score": 0.92,
        "start_position": 24,
        "end_position": 34,
        "redaction_style": "bracket"
      },
      {
        "original_text": "123-45-6789",
        "entity_type": "SSN",
        "replacement_placeholder": "[SSN]",
        "confidence_score": 0.99,
        "start_position": 40,
        "end_position": 51,
        "redaction_style": "bracket"
      }
    ],
    "processing_time_ms": 245,
    "total_entities_detected": 3,
    "all_entities_confidence_avg": 0.953
  },
  "id": "req_001_timestamp_uuid"
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `de_identified_text` | string | Original text with all detected PII replaced |
| `entities` | object[] | Array of detected PII entities |
| `entities[].original_text` | string | Original PII text (not sent downstream) |
| `entities[].entity_type` | string | Entity classification |
| `entities[].replacement_placeholder` | string | Placeholder used in de_identified_text |
| `entities[].confidence_score` | number | 0.0–1.0 confidence in detection |
| `entities[].start_position` | integer | Character position in original text |
| `entities[].end_position` | integer | Character position in original text |
| `entities[].redaction_style` | string | Redaction method applied |
| `processing_time_ms` | integer | Total processing duration |
| `total_entities_detected` | integer | Count of detected entities |
| `all_entities_confidence_avg` | number | Average confidence across all detections |

### Error Responses

**Timeout (60 seconds exceeded):**

```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32603,
    "message": "Internal error",
    "data": {
      "error_type": "TIMEOUT",
      "details": "PII detection did not complete within 60 seconds",
      "request_id": "req_001_timestamp_uuid"
    }
  },
  "id": "req_001_timestamp_uuid"
}
```

**Invalid text (empty or null):**

```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32602,
    "message": "Invalid params",
    "data": {
      "error_type": "INVALID_INPUT",
      "details": "text parameter cannot be empty",
      "request_id": "req_001_timestamp_uuid"
    }
  },
  "id": "req_001_timestamp_uuid"
}
```

**Sidecar unavailable:**

```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32000,
    "message": "Server error",
    "data": {
      "error_type": "SIDECAR_UNAVAILABLE",
      "details": "Sidecar process crashed or is not responding",
      "request_id": "req_001_timestamp_uuid"
    }
  },
  "id": "req_001_timestamp_uuid"
}
```

### Rate Limiting

- **Limit:** 100 requests per minute per entity type
- **Backoff:** Linear backoff (1s, 2s, 3s) on rate limit exceeded
- **Response Header:** `X-RateLimit-Remaining: 87`

### Example Flow (JavaScript)

```javascript
// In Electron Main Process
const { spawn } = require('child_process');
const net = require('net');

class PiiDetector {
  constructor() {
    this.socket = null;
    this.requestId = 0;
    this.pendingRequests = new Map();
  }

  async detect(text, options = {}) {
    const id = `req_${++this.requestId}_${Date.now()}_${Math.random()}`;

    const payload = {
      jsonrpc: '2.0',
      method: 'pii/detect',
      params: {
        text,
        entity_types: options.entityTypes || [],
        redaction_style: options.redactionStyle || 'bracket',
        include_positions: true,
        language: options.language || 'en'
      },
      id
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error('PII detection timeout (60s)'));
      }, 60000);

      this.pendingRequests.set(id, { resolve, reject, timeout });
      this.socket.write(JSON.stringify(payload) + '\n');
    });
  }
}
```

---

## Endpoint: POST /pii/batch

**Description:** De-identify multiple text sections in a single request (optimized for multi-section documents).

**Direction:** Main → Sidecar (Request), Sidecar → Main (Response)

### Request Schema

```json
{
  "jsonrpc": "2.0",
  "method": "pii/batch",
  "params": {
    "sections": [
      {
        "section_id": "intro_001",
        "text": "Patient John Smith presented with chest pain.",
        "section_type": "clinical_note"
      },
      {
        "section_id": "physical_exam_001",
        "text": "BP 120/80, HR 75. Contact: (555) 123-4567",
        "section_type": "vital_signs"
      },
      {
        "section_id": "plan_001",
        "text": "Follow up with Dr. Jane Doe on 03/20/2026",
        "section_type": "treatment_plan"
      }
    ],
    "entity_types": ["PERSON", "PHONE", "DATE", "EMAIL"],
    "redaction_style": "bracket",
    "skip_sections": []
  },
  "id": "batch_001_timestamp_uuid"
}
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sections` | object[] | Yes | Array of section objects |
| `sections[].section_id` | string | Yes | Unique identifier for section |
| `sections[].text` | string | Yes | Text to de-identify |
| `sections[].section_type` | string | No | Semantic hint (clinical_note, vital_signs, etc.) |
| `entity_types` | string[] | No | Entity types to detect |
| `redaction_style` | enum | No | `bracket` \| `hash` \| `placeholder` |
| `skip_sections` | string[] | No | section_ids to skip processing |

### Response Schema

```json
{
  "jsonrpc": "2.0",
  "result": {
    "batch_id": "batch_001_timestamp_uuid",
    "total_sections": 3,
    "processed_sections": 3,
    "failed_sections": 0,
    "results": [
      {
        "section_id": "intro_001",
        "status": "success",
        "de_identified_text": "Patient [PERSON] presented with chest pain.",
        "entities": [
          {
            "original_text": "John Smith",
            "entity_type": "PERSON",
            "replacement_placeholder": "[PERSON]",
            "confidence_score": 0.96,
            "start_position": 8,
            "end_position": 18
          }
        ],
        "processing_time_ms": 52
      },
      {
        "section_id": "physical_exam_001",
        "status": "success",
        "de_identified_text": "BP 120/80, HR 75. Contact: [PHONE]",
        "entities": [
          {
            "original_text": "(555) 123-4567",
            "entity_type": "PHONE",
            "replacement_placeholder": "[PHONE]",
            "confidence_score": 0.98,
            "start_position": 22,
            "end_position": 36
          }
        ],
        "processing_time_ms": 48
      },
      {
        "section_id": "plan_001",
        "status": "success",
        "de_identified_text": "Follow up with Dr. [PERSON] on [DATE]",
        "entities": [
          {
            "original_text": "Jane Doe",
            "entity_type": "PERSON",
            "replacement_placeholder": "[PERSON]",
            "confidence_score": 0.94,
            "start_position": 21,
            "end_position": 29
          },
          {
            "original_text": "03/20/2026",
            "entity_type": "DATE",
            "replacement_placeholder": "[DATE]",
            "confidence_score": 0.99,
            "start_position": 33,
            "end_position": 43
          }
        ],
        "processing_time_ms": 61
      }
    ],
    "total_processing_time_ms": 161,
    "entities_per_section_avg": 1.33
  },
  "id": "batch_001_timestamp_uuid"
}
```

### Error Handling

**Partial failure (some sections succeeded):**

```json
{
  "jsonrpc": "2.0",
  "result": {
    "batch_id": "batch_001_timestamp_uuid",
    "total_sections": 3,
    "processed_sections": 2,
    "failed_sections": 1,
    "results": [
      // ... successful sections ...
      {
        "section_id": "malformed_section",
        "status": "error",
        "error": {
          "error_type": "INVALID_INPUT",
          "details": "Text exceeds maximum length of 10000 characters"
        }
      }
    ]
  },
  "id": "batch_001_timestamp_uuid"
}
```

### Batch Processing Constraints

- **Max sections per request:** 50
- **Max text length per section:** 10,000 characters
- **Total timeout:** 120 seconds
- **Retry policy:** No automatic retry (caller responsibility)

---

## Endpoint: POST /transcribe

**Description:** Transcribe an audio file using OpenAI Whisper. Returns timestamped transcript with confidence scores per segment.

**Direction:** Main → Sidecar (Request), Sidecar → Main (Response)

### Request Schema

```json
{
  "jsonrpc": "2.0",
  "method": "transcribe",
  "params": {
    "audio_file_path": "/tmp/Psygil_audio_b7f3c8d9.wav",
    "language": "en",
    "model": "base",
    "include_timestamps": true,
    "include_confidence": true,
    "pii_detection_enabled": true,
    "pii_entity_types": ["PERSON", "DATE", "EMAIL"],
    "auto_detect_language": false
  },
  "id": "transcribe_001_timestamp_uuid"
}
```

**Parameters:**

| Field | Type | Required | Description | Default |
|-------|------|----------|-------------|---------|
| `audio_file_path` | string | Yes | Absolute path to audio file (WAV, MP3, FLAC, OGG) | — |
| `language` | string | No | ISO 639-1 language code | `en` |
| `model` | enum | No | `tiny` \| `base` \| `small` \| `medium` \| `large` | `base` |
| `include_timestamps` | boolean | No | Include start/end time per segment | true |
| `include_confidence` | boolean | No | Include confidence scores per segment | true |
| `pii_detection_enabled` | boolean | No | Apply PII redaction to transcript | false |
| `pii_entity_types` | string[] | No | Entity types to detect in transcript | All types |
| `auto_detect_language` | boolean | No | Auto-detect language if unclear | false |

**Supported Audio Formats:**

- WAV (.wav)
- MP3 (.mp3)
- FLAC (.flac)
- OGG Vorbis (.ogg)
- M4A (.m4a)

**Model Performance:**

| Model | Speed | Accuracy | VRAM | Use Case |
|-------|-------|----------|------|----------|
| `tiny` | 10x faster | 85% | <1GB | Real-time transcription |
| `base` | 5x faster | 92% | 1-2GB | Default, balanced |
| `small` | 2x faster | 96% | 2-3GB | High accuracy, short audio |
| `medium` | 1x speed | 98% | 5-6GB | Longer sessions, accents |
| `large` | 0.5x speed | 99%+ | 10GB+ | Critical accuracy required |

### Response Schema

```json
{
  "jsonrpc": "2.0",
  "result": {
    "transcript_id": "transcript_uuid_b7f3c8d9",
    "language": "en",
    "model_used": "base",
    "duration_seconds": 45.3,
    "transcription": "Patient presented with persistent cough. Vital signs stable. Recommended follow-up in two weeks.",
    "full_transcript": "Patient presented with persistent cough. Vital signs stable. Recommended follow-up in two weeks.",
    "de_identified_transcript": null,
    "segments": [
      {
        "segment_id": 0,
        "start_time": 0.0,
        "end_time": 4.2,
        "text": "Patient presented with persistent cough.",
        "confidence": 0.96,
        "speaker_id": null
      },
      {
        "segment_id": 1,
        "start_time": 4.2,
        "end_time": 8.1,
        "text": "Vital signs stable.",
        "confidence": 0.98,
        "speaker_id": null
      },
      {
        "segment_id": 2,
        "start_time": 8.1,
        "end_time": 12.5,
        "text": "Recommended follow-up in two weeks.",
        "confidence": 0.94,
        "speaker_id": null
      }
    ],
    "pii_entities": [],
    "processing_time_ms": 8500,
    "words_per_minute": 178.2
  },
  "id": "transcribe_001_timestamp_uuid"
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `transcript_id` | string | Unique identifier for this transcription |
| `language` | string | Detected/specified language |
| `model_used` | string | Whisper model version used |
| `duration_seconds` | number | Total audio duration |
| `transcription` | string | Full transcript text |
| `full_transcript` | string | Unredacted transcript |
| `de_identified_transcript` | string \| null | PII-redacted transcript (if enabled) |
| `segments` | object[] | Time-indexed transcript segments |
| `segments[].segment_id` | integer | Segment sequence number |
| `segments[].start_time` | number | Start time in seconds |
| `segments[].end_time` | number | End time in seconds |
| `segments[].text` | string | Segment text |
| `segments[].confidence` | number | 0.0–1.0 confidence |
| `segments[].speaker_id` | string \| null | Speaker identification (future) |
| `pii_entities` | object[] | Detected PII (if enabled) |
| `processing_time_ms` | integer | Total processing duration |
| `words_per_minute` | number | Speech rate metric |

### Error Responses

**File not found:**

```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32602,
    "message": "Invalid params",
    "data": {
      "error_type": "FILE_NOT_FOUND",
      "details": "Audio file does not exist: /tmp/Psygil_audio_b7f3c8d9.wav",
      "request_id": "transcribe_001_timestamp_uuid"
    }
  },
  "id": "transcribe_001_timestamp_uuid"
}
```

**Unsupported format:**

```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32602,
    "message": "Invalid params",
    "data": {
      "error_type": "UNSUPPORTED_FORMAT",
      "details": "Audio format .xyz not supported",
      "supported_formats": ["wav", "mp3", "flac", "ogg", "m4a"],
      "request_id": "transcribe_001_timestamp_uuid"
    }
  },
  "id": "transcribe_001_timestamp_uuid"
}
```

**Timeout (audio too long or system overloaded):**

```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32603,
    "message": "Internal error",
    "data": {
      "error_type": "TIMEOUT",
      "details": "Transcription exceeded 300 second timeout",
      "request_id": "transcribe_001_timestamp_uuid"
    }
  },
  "id": "transcribe_001_timestamp_uuid"
}
```

### Transcription Constraints

- **Max audio duration:** 300 seconds (5 minutes) for `base` model, 600s for `large`
- **Max file size:** 100 MB
- **Supported sample rates:** 16 kHz (preferred), 8-48 kHz supported
- **Timeout:** 300 seconds base model, 600 seconds large model
- **Queue depth:** Max 10 concurrent transcriptions

---

## Endpoint: GET /health

**Description:** Health check endpoint for sidecar process. Used by Main process to detect crashes or hangs.

**Direction:** Main → Sidecar (Request), Sidecar → Main (Response)

### Request Schema

```json
{
  "jsonrpc": "2.0",
  "method": "health",
  "params": {},
  "id": "health_001_timestamp_uuid"
}
```

### Response Schema (Healthy)

```json
{
  "jsonrpc": "2.0",
  "result": {
    "status": "healthy",
    "uptime_seconds": 3602,
    "memory_usage_mb": 245,
    "cpu_percent": 2.3,
    "pii_detector": {
      "status": "ready",
      "requests_processed": 342,
      "avg_latency_ms": 178
    },
    "transcriber": {
      "status": "ready",
      "requests_processed": 18,
      "avg_latency_ms": 8234
    },
    "style_extractor": {
      "status": "ready",
      "requests_processed": 0,
      "avg_latency_ms": 0
    },
    "latest_error": null,
    "version": "1.2.3"
  },
  "id": "health_001_timestamp_uuid"
}
```

### Response Schema (Degraded)

```json
{
  "jsonrpc": "2.0",
  "result": {
    "status": "degraded",
    "uptime_seconds": 7205,
    "memory_usage_mb": 890,
    "cpu_percent": 87.5,
    "pii_detector": {
      "status": "ready",
      "requests_processed": 1024,
      "avg_latency_ms": 412
    },
    "transcriber": {
      "status": "unhealthy",
      "requests_processed": 8,
      "error": "CUDA out of memory, falling back to CPU"
    },
    "style_extractor": {
      "status": "ready",
      "requests_processed": 12,
      "avg_latency_ms": 234
    },
    "latest_error": "Whisper model failed to load GPU",
    "version": "1.2.3"
  },
  "id": "health_001_timestamp_uuid"
}
```

### Health Check Schedule

- **Interval:** 30 seconds
- **Timeout:** 5 seconds
- **Consecutive failures before restart:** 3
- **Action on unhealthy:** Log warning, trigger graceful restart

---

## Endpoint: POST /style/extract

**Description:** Extract writing style rules from clinical samples. Returns structured style rules for LLM guidance during document generation.

**Direction:** Main → Sidecar (Request), Sidecar → Main (Response)

### Request Schema

```json
{
  "jsonrpc": "2.0",
  "method": "style/extract",
  "params": {
    "samples": [
      {
        "sample_id": "existing_note_001",
        "text": "Patient presents with substernal chest discomfort radiating to left arm, associated with diaphoresis and dyspnea. Physical examination reveals tachycardia at 102 bpm. EKG shows ST elevation in leads II, III, aVF.",
        "document_type": "clinical_note",
        "author_id": "clinician_uuid_001"
      },
      {
        "sample_id": "existing_note_002",
        "text": "Pt w/ c/o persistent cough x3 wks. VSS. CXR unremarkable. Recommend f/u PCP in 1 wk. Dx: URTI vs allergic rhinitis.",
        "document_type": "clinical_note",
        "author_id": "clinician_uuid_001"
      },
      {
        "sample_id": "existing_note_003",
        "text": "45-year-old female with history of hypertension and diabetes mellitus type 2 presents to the emergency department with acute onset severe headache.",
        "document_type": "clinical_note",
        "author_id": "clinician_uuid_001"
      }
    ],
    "analyze_medical_terminology": true,
    "analyze_abbreviations": true,
    "analyze_narrative_structure": true,
    "analyze_vocabulary_level": true
  },
  "id": "style_001_timestamp_uuid"
}
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `samples` | object[] | Yes | Array of writing samples |
| `samples[].sample_id` | string | Yes | Unique identifier |
| `samples[].text` | string | Yes | Sample text (min 200 chars) |
| `samples[].document_type` | string | No | semantic hint |
| `samples[].author_id` | string | No | Optional author identifier |
| `analyze_medical_terminology` | boolean | No | Extract medical term usage | true |
| `analyze_abbreviations` | boolean | No | Extract abbreviation patterns | true |
| `analyze_narrative_structure` | boolean | No | Extract narrative/structure style | true |
| `analyze_vocabulary_level` | boolean | No | Analyze vocabulary complexity | true |

### Response Schema

```json
{
  "jsonrpc": "2.0",
  "result": {
    "style_profile_id": "profile_uuid_8f2d4e9c",
    "created_at": "2026-03-19T14:32:45Z",
    "samples_analyzed": 3,
    "confidence_score": 0.87,
    "style_rules": {
      "vocabulary": {
        "level": "advanced",
        "formal_percentage": 0.78,
        "technical_terminology_preference": "high",
        "common_medical_terms": [
          "substernal",
          "diaphoresis",
          "tachycardia",
          "ST elevation"
        ],
        "abbreviation_patterns": {
          "uses_abbreviations": true,
          "frequency": "moderate",
          "common_abbreviations": [
            {
              "abbreviation": "c/o",
              "expansion": "complains of",
              "frequency": 2
            },
            {
              "abbreviation": "VSS",
              "expansion": "vital signs stable",
              "frequency": 1
            },
            {
              "abbreviation": "CXR",
              "expansion": "chest X-ray",
              "frequency": 1
            },
            {
              "abbreviation": "f/u",
              "expansion": "follow-up",
              "frequency": 1
            }
          ]
        }
      },
      "narrative_structure": {
        "preferred_format": "paragraph",
        "includes_assessment_plan": true,
        "typical_sections": [
          "Chief Complaint",
          "History of Present Illness",
          "Physical Exam",
          "Assessment & Plan"
        ],
        "average_section_length_words": 84,
        "uses_bullets": false
      },
      "tone_and_voice": {
        "tone": "professional_clinical",
        "voice_type": "objective",
        "passive_voice_percentage": 0.42,
        "active_voice_percentage": 0.58,
        "example_opening_phrases": [
          "Patient presents with",
          "Pt w/",
          "45-year-old [gender] with"
        ]
      },
      "temporal_references": {
        "uses_specific_dates": true,
        "uses_relative_time": false,
        "time_expression_patterns": [
          "x3 wks",
          "1 wk"
        ]
      },
      "medical_language_patterns": {
        "uses_differential_diagnosis_notation": true,
        "diagnostic_pattern": "Dx: [condition] vs [alternative]",
        "common_findings_notation": "finding at [location/value]"
      }
    },
    "llm_prompt_guidance": {
      "system_prompt_injection": "You are a clinical documentation specialist writing from the perspective of a physician. Use formal medical terminology and objective clinical language. Structure notes with clear sections (CC, HPI, PE, A&P). Prefer active voice. Use technical medical terms appropriately. Include specific findings and measurements. Avoid excessive abbreviations unless established.",
      "generation_parameters": {
        "temperature": 0.7,
        "top_p": 0.95,
        "presence_penalty": 0.1,
        "frequency_penalty": 0.05
      }
    },
    "processing_time_ms": 1245
  },
  "id": "style_001_timestamp_uuid"
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `style_profile_id` | string | Unique identifier for this style profile |
| `created_at` | string | ISO 8601 timestamp |
| `samples_analyzed` | integer | Number of samples processed |
| `confidence_score` | number | 0.0–1.0 confidence in extracted rules |
| `style_rules` | object | Extracted style rules (see structure above) |
| `llm_prompt_guidance` | object | Recommended LLM prompt injection |
| `llm_prompt_guidance.system_prompt_injection` | string | System prompt to guide LLM |
| `llm_prompt_guidance.generation_parameters` | object | Recommended LLM parameters |
| `processing_time_ms` | integer | Total processing duration |

### Error Responses

**Insufficient samples:**

```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32602,
    "message": "Invalid params",
    "data": {
      "error_type": "INSUFFICIENT_SAMPLES",
      "details": "Minimum 2 samples required, got 1",
      "request_id": "style_001_timestamp_uuid"
    }
  },
  "id": "style_001_timestamp_uuid"
}
```

**Sample text too short:**

```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32602,
    "message": "Invalid params",
    "data": {
      "error_type": "SAMPLE_TOO_SHORT",
      "details": "Sample 'existing_note_001' contains 45 characters, minimum 200 required",
      "request_id": "style_001_timestamp_uuid"
    }
  },
  "id": "style_001_timestamp_uuid"
}
```

### Style Extraction Constraints

- **Min samples:** 2
- **Max samples:** 20
- **Min sample length:** 200 characters
- **Max sample length:** 5000 characters
- **Timeout:** 60 seconds
- **Cache duration:** 30 days (reuse same profile_id)

---

## Python Sidecar Connection Lifecycle

### Startup Sequence

```
1. Electron Main Process checks for sidecar executable
2. Spawns Python subprocess with arguments:
   --socket /tmp/Psygil-sidecar.sock
   --port 5555 (fallback TCP if socket fails)
   --log-level debug
3. Main waits for socket to become available (10 second timeout)
4. First health check sent
5. If healthy, app proceeds; if timeout, graceful degradation
```

### Graceful Degradation (Sidecar Unavailable)

When sidecar is unavailable:

- **PII Detection:** Disabled in UI (gray out feature)
- **Transcription:** Disabled in UI with message "Transcription service unavailable"
- **Style Extraction:** Disabled in UI
- **User notification:** Toast warning "Some AI features unavailable, please restart app"
- **Error handling:** Main process catches all sidecar errors, logs, and continues

### Message Format (Line-Delimited JSON)

Each request and response is a single line of JSON followed by newline (`\n`):

```
{"jsonrpc": "2.0", "method": "pii/detect", "params": {...}, "id": "req_001"}\n
{"jsonrpc": "2.0", "result": {...}, "id": "req_001"}\n
```

---

# Boundary 2: Electron Main ↔ OnlyOffice Document Editor

## Overview

OnlyOffice Document Editor is embedded within the Electron application and provides WYSIWYG document editing. Communication occurs via the OnlyOffice Document Builder API (for programmatic manipulation) and Electron IPC events (for user edits and document state changes).

### Architecture

```
Electron Main
    ↓
    └─→ BrowserWindow (OnlyOffice iframe)
           ↓
           └─→ OnlyOffice Editor (iframe sandboxed)
                  ↓
                  └─→ DOM events → parent window.postMessage
```

### Integration Points

- **Document lifecycle:** Open, edit, save, finalize
- **Content injection:** Insert agent-generated sections with track changes
- **Review workflow:** Inject comments for Editor/Legal Reviewer flags
- **State sync:** Bidirectional sync of document content and metadata

---

## Event: open_document

**Description:** Open a .docx document in the embedded OnlyOffice editor.

**Direction:** Main → OnlyOffice

### Request Schema

```json
{
  "event": "open_document",
  "payload": {
    "document_path": "/home/user/cases/case_abc123/document.docx",
    "document_id": "doc_uuid_f8e4c9a2",
    "case_id": "case_abc123",
    "read_only": false,
    "document_metadata": {
      "title": "Clinical Assessment - Case ABC123",
      "author": "Dr. Smith",
      "created_date": "2026-03-19T10:00:00Z",
      "version": 1,
      "document_type": "clinical_assessment"
    },
    "editor_config": {
      "layout": "default",
      "toolbar_visible": true,
      "sidebar_visible": true,
      "display_mode": "edit",
      "collaborative_editing": false
    }
  }
}
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `document_path` | string | Yes | Absolute path to .docx file |
| `document_id` | string | Yes | Unique identifier for this document instance |
| `case_id` | string | Yes | Associated case identifier |
| `read_only` | boolean | No | Lock document from editing | false |
| `document_metadata` | object | No | Metadata (title, author, etc.) | |
| `editor_config` | object | No | Editor configuration options | |

### Response Schema (Success)

```json
{
  "event": "document_opened",
  "payload": {
    "status": "success",
    "document_id": "doc_uuid_f8e4c9a2",
    "document_length": 4250,
    "sections": [
      {
        "section_id": "intro_001",
        "section_type": "introduction",
        "title": "Clinical Presentation",
        "start_char": 0,
        "end_char": 450
      },
      {
        "section_id": "hpi_001",
        "section_type": "hpi",
        "title": "History of Present Illness",
        "start_char": 450,
        "end_char": 1200
      },
      {
        "section_id": "pe_001",
        "section_type": "physical_exam",
        "title": "Physical Examination",
        "start_char": 1200,
        "end_char": 2000
      },
      {
        "section_id": "assessment_001",
        "section_type": "assessment",
        "title": "Assessment & Plan",
        "start_char": 2000,
        "end_char": 4250
      }
    ],
    "document_hash": "sha256_abcd1234efgh5678",
    "opened_at": "2026-03-19T14:32:45Z"
  }
}
```

### Error Response

```json
{
  "event": "document_open_error",
  "payload": {
    "status": "error",
    "error_type": "FILE_NOT_FOUND",
    "details": "Document not found at /home/user/cases/case_abc123/document.docx",
    "document_id": "doc_uuid_f8e4c9a2"
  }
}
```

---

## Event: insert_content

**Description:** Inject agent-generated content into document with track changes enabled.

**Direction:** Main → OnlyOffice

### Request Schema

```json
{
  "event": "insert_content",
  "payload": {
    "document_id": "doc_uuid_f8e4c9a2",
    "insert_mode": "insert_after_section",
    "target_section_id": "pe_001",
    "sections": [
      {
        "section_id": "ai_assessment_001",
        "section_type": "assessment",
        "title": "AI-Assisted Assessment",
        "content": "Based on clinical presentation and examination findings, differential diagnoses include acute coronary syndrome, pulmonary embolism, and aortic dissection. EKG findings support acute MI. Recommend immediate cardiology consultation and troponin/BNP testing.",
        "metadata": {
          "generated_by": "agent_sonnet_001",
          "confidence_score": 0.92,
          "model_version": "claude-sonnet-20250101",
          "generation_timestamp": "2026-03-19T14:32:00Z"
        },
        "track_changes_enabled": true,
        "author": "AI Assistant"
      }
    ],
    "track_changes": {
      "enabled": true,
      "author": "AI Assistant",
      "revision_type": "insertion"
    }
  }
}
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `document_id` | string | Yes | Document to modify |
| `insert_mode` | enum | Yes | `append` \| `insert_after_section` \| `replace_section` \| `insert_at_position` |
| `target_section_id` | string | No | Section ID (if insert_after_section) |
| `sections` | object[] | Yes | Content to insert |
| `sections[].section_id` | string | Yes | Unique section identifier |
| `sections[].section_type` | string | Yes | `introduction`, `hpi`, `physical_exam`, `assessment`, `plan`, etc. |
| `sections[].title` | string | Yes | Section heading |
| `sections[].content` | string | Yes | Section text (formatted as plain text or HTML) |
| `sections[].metadata` | object | No | Generation metadata |
| `track_changes_enabled` | boolean | No | Enable track changes for insertion | true |
| `track_changes.author` | string | No | Author name for track changes | "AI Assistant" |

### Response Schema (Success)

```json
{
  "event": "content_inserted",
  "payload": {
    "status": "success",
    "document_id": "doc_uuid_f8e4c9a2",
    "inserted_sections": [
      {
        "section_id": "ai_assessment_001",
        "position": 2,
        "start_char": 2000,
        "end_char": 2450,
        "track_changes_id": "tc_uuid_8f3d2e9c"
      }
    ],
    "total_document_length": 4700,
    "insertion_timestamp": "2026-03-19T14:33:00Z"
  }
}
```

### Error Response (Conflict)

```json
{
  "event": "content_insert_error",
  "payload": {
    "status": "error",
    "error_type": "DOCUMENT_LOCKED",
    "details": "Document is being edited by another user",
    "document_id": "doc_uuid_f8e4c9a2"
  }
}
```

---

## Event: insert_comments

**Description:** Inject Word comments for Editor/Legal Reviewer flags.

**Direction:** Main → OnlyOffice

### Request Schema

```json
{
  "event": "insert_comments",
  "payload": {
    "document_id": "doc_uuid_f8e4c9a2",
    "comments": [
      {
        "comment_id": "comment_uuid_001",
        "section_id": "ai_assessment_001",
        "position": 125,
        "text": "[EDITOR] Please verify medication dosages match current institutional protocols.",
        "comment_type": "flag",
        "reviewer_role": "editor",
        "severity": "medium",
        "created_by": "system"
      },
      {
        "comment_id": "comment_uuid_002",
        "section_id": "ai_assessment_001",
        "position": 340,
        "text": "[LEGAL] Ensure differential diagnosis statement complies with liability requirements.",
        "comment_type": "flag",
        "reviewer_role": "legal_reviewer",
        "severity": "high",
        "created_by": "system"
      }
    ]
  }
}
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `document_id` | string | Yes | Document ID |
| `comments` | object[] | Yes | Array of comments |
| `comments[].comment_id` | string | Yes | Unique comment identifier |
| `comments[].section_id` | string | Yes | Target section ID |
| `comments[].position` | integer | Yes | Character position in section |
| `comments[].text` | string | Yes | Comment text |
| `comments[].comment_type` | enum | Yes | `flag` \| `question` \| `suggestion` |
| `comments[].reviewer_role` | enum | Yes | `editor` \| `legal_reviewer` \| `clinician` |
| `comments[].severity` | enum | No | `low` \| `medium` \| `high` | `medium` |
| `comments[].created_by` | string | Yes | Creator identifier |

### Response Schema

```json
{
  "event": "comments_inserted",
  "payload": {
    "status": "success",
    "document_id": "doc_uuid_f8e4c9a2",
    "comments_inserted": 2,
    "insertion_timestamp": "2026-03-19T14:34:00Z"
  }
}
```

---

## Event: get_document_content

**Description:** Extract current document content for agent processing (e.g., re-analyze after clinician edits).

**Direction:** Main → OnlyOffice (Request), OnlyOffice → Main (Response)

### Request Schema

```json
{
  "event": "get_document_content",
  "payload": {
    "document_id": "doc_uuid_f8e4c9a2",
    "include_metadata": true,
    "include_track_changes": true,
    "include_comments": true,
    "format": "json"
  }
}
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `document_id` | string | Yes | Document to extract |
| `include_metadata` | boolean | No | Include document metadata | true |
| `include_track_changes` | boolean | No | Include track changes info | false |
| `include_comments` | boolean | No | Include comment details | false |
| `format` | enum | No | `json` \| `docx` (binary) | `json` |

### Response Schema

```json
{
  "event": "document_content",
  "payload": {
    "status": "success",
    "document_id": "doc_uuid_f8e4c9a2",
    "metadata": {
      "title": "Clinical Assessment - Case ABC123",
      "author": "Dr. Smith",
      "created_date": "2026-03-19T10:00:00Z",
      "last_modified": "2026-03-19T14:35:00Z",
      "last_modified_by": "Dr. Smith",
      "version": 2,
      "word_count": 1247,
      "document_hash": "sha256_xyz9876abc1234"
    },
    "sections": [
      {
        "section_id": "intro_001",
        "section_type": "introduction",
        "title": "Clinical Presentation",
        "content": "45-year-old male presenting with acute onset substernal chest discomfort...",
        "start_char": 0,
        "end_char": 450,
        "edited_by_clinician": false
      },
      {
        "section_id": "hpi_001",
        "section_type": "hpi",
        "title": "History of Present Illness",
        "content": "Patient reports onset of symptoms while sitting at home. Associated with diaphoresis and dyspnea...",
        "start_char": 450,
        "end_char": 1200,
        "edited_by_clinician": true,
        "edit_summary": "Clinician added 'radiation to left shoulder'"
      },
      {
        "section_id": "ai_assessment_001",
        "section_type": "assessment",
        "title": "AI-Assisted Assessment",
        "content": "Based on clinical presentation, differential diagnoses include acute coronary syndrome...",
        "start_char": 2000,
        "end_char": 2450,
        "track_changes": [
          {
            "track_change_id": "tc_uuid_8f3d2e9c",
            "change_type": "insertion",
            "author": "AI Assistant",
            "timestamp": "2026-03-19T14:33:00Z",
            "accepted": false
          }
        ]
      }
    ],
    "comments": [
      {
        "comment_id": "comment_uuid_001",
        "section_id": "ai_assessment_001",
        "text": "[EDITOR] Please verify medication dosages...",
        "reviewer_role": "editor",
        "status": "unresolved"
      }
    ]
  }
}
```

---

## Event: finalize_document

**Description:** Lock document, generate integrity hash, create sealed PDF for archival.

**Direction:** Main → OnlyOffice

### Request Schema

```json
{
  "event": "finalize_document",
  "payload": {
    "document_id": "doc_uuid_f8e4c9a2",
    "case_id": "case_abc123",
    "finalize_options": {
      "accept_all_track_changes": false,
      "reject_unresolved_comments": false,
      "generate_pdf": true,
      "generate_audit_trail": true,
      "lock_document": true,
      "archive_path": "/home/user/cases/case_abc123/archive"
    },
    "metadata": {
      "finalized_by": "Dr. Smith",
      "finalization_reason": "Ready for submission",
      "retention_period_days": 2555
    }
  }
}
```

### Response Schema

```json
{
  "event": "document_finalized",
  "payload": {
    "status": "success",
    "document_id": "doc_uuid_f8e4c9a2",
    "document_hash": "sha256_final_hash_xyz987",
    "document_signature": "digital_signature_xyz",
    "finalization_timestamp": "2026-03-19T15:00:00Z",
    "pdf_generated": true,
    "pdf_path": "/home/user/cases/case_abc123/archive/document.pdf",
    "audit_trail": {
      "total_changes": 5,
      "track_changes_accepted": 3,
      "track_changes_rejected": 2,
      "comments_resolved": 1,
      "sections_modified": ["hpi_001", "ai_assessment_001"]
    }
  }
}
```

---

## Event: on_document_changed

**Description:** Fired when clinician edits document content. Allows main process to track changes and trigger re-analysis.

**Direction:** OnlyOffice → Main (Async event)

### Event Schema

```json
{
  "event": "on_document_changed",
  "payload": {
    "document_id": "doc_uuid_f8e4c9a2",
    "changed_at": "2026-03-19T14:35:42Z",
    "change_type": "text_edit",
    "changed_sections": [
      {
        "section_id": "hpi_001",
        "section_type": "hpi",
        "change_summary": "Clinician added text about symptom radiation",
        "new_content": "Patient reports onset of symptoms while sitting at home. Associated with diaphoresis, dyspnea, and radiation to left shoulder and jaw.",
        "operation": "edit"
      }
    ],
    "changed_by": "Dr. Smith",
    "is_significant_change": true
  }
}
```

### Main Process Handler Example

```javascript
// In Electron preload script or main process
ipcMain.on('on_document_changed', (event, payload) => {
  console.log('Document changed:', payload.document_id);

  // Trigger PII re-detection on changed sections
  if (payload.is_significant_change) {
    app.detectPiiInSection(
      payload.document_id,
      payload.changed_sections[0].section_id,
      payload.changed_sections[0].new_content
    );
  }
});
```

---

## Event: on_save

**Description:** Fired when document auto-saves or user manually saves.

**Direction:** OnlyOffice → Main (Async event)

### Event Schema

```json
{
  "event": "on_save",
  "payload": {
    "document_id": "doc_uuid_f8e4c9a2",
    "saved_at": "2026-03-19T14:36:00Z",
    "document_hash": "sha256_after_save_hash",
    "save_count": 7,
    "unsaved_changes": false,
    "file_size_bytes": 4750
  }
}
```

---

## OnlyOffice IPC Constants

### Channel Names

```javascript
const ONLYOFFICE_CHANNELS = {
  OPEN_DOCUMENT: 'onlyoffice:open_document',
  INSERT_CONTENT: 'onlyoffice:insert_content',
  INSERT_COMMENTS: 'onlyoffice:insert_comments',
  GET_DOCUMENT_CONTENT: 'onlyoffice:get_document_content',
  FINALIZE_DOCUMENT: 'onlyoffice:finalize_document',
  ON_DOCUMENT_CHANGED: 'onlyoffice:document_changed',
  ON_SAVE: 'onlyoffice:save',
  ERROR: 'onlyoffice:error'
};
```

---

# Boundary 3: Electron Main ↔ LLM Gateway

## Overview

The LLM Gateway abstracts API calls to Claude (Anthropic) and GPT-4o (OpenAI). The Main process communicates with the gateway via HTTPS REST API. The gateway handles:

- Provider selection (Claude primary, GPT-4o fallback)
- API key retrieval from OS keychain
- Token counting and cost tracking
- Retry logic with exponential backoff
- Request/response streaming
- Rate limiting and quota management

### LLM Gateway Architecture

```
Electron Main
    ↓
    └─→ HTTPS REST
           ↓
           └─→ LLM Gateway Service
                  ↓
                  ├─→ Anthropic Claude API
                  └─→ OpenAI API (fallback)
```

### Base URL

- **Production:** `https://llm-gateway.Psygil.local:8443`
- **Development:** `http://localhost:5000`
- **Timeout:** 120 seconds

### Authentication

- **Method:** Bearer token in `Authorization` header
- **Token storage:** OS keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service)
- **Rotation:** Every 24 hours

---

## Endpoint: POST /llm/complete

**Description:** Send a de-identified prompt for LLM completion (streaming or buffered).

**Direction:** Main → LLM Gateway (Request), LLM Gateway → Main (Streaming Response)

### Request Schema

```json
{
  "request_id": "llm_req_uuid_001",
  "model_preference": "claude",
  "provider_override": null,
  "prompt": {
    "system_prompt": "You are a clinical documentation specialist. Review the de-identified clinical note and provide a structured assessment...",
    "user_prompt": "Patient presents with substernal chest discomfort. EKG shows ST elevation in II, III, aVF. Troponin elevated. What is the most likely diagnosis?",
    "context": {
      "case_id": "case_abc123",
      "document_id": "doc_uuid_f8e4c9a2",
      "section_id": "assessment_001",
      "extracted_style_profile": {
        "style_profile_id": "profile_uuid_8f2d4e9c",
        "llm_guidance": "Use formal medical terminology and objective language."
      }
    }
  },
  "parameters": {
    "model": "claude-sonnet-20250101",
    "max_tokens": 500,
    "temperature": 0.7,
    "top_p": 0.95,
    "presence_penalty": 0.1,
    "frequency_penalty": 0.05,
    "stream": true,
    "stop_sequences": ["END_OF_ASSESSMENT"]
  },
  "retry_policy": {
    "max_retries": 2,
    "backoff_multiplier": 2.0,
    "retry_on": ["RATE_LIMIT", "SERVICE_UNAVAILABLE"]
  },
  "cost_allocation": {
    "case_id": "case_abc123",
    "evaluation_type": "ai_assisted_assessment",
    "cost_center": "clinical_operations"
  }
}
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `request_id` | string | Yes | Unique request identifier (UUID) |
| `model_preference` | enum | No | `claude` \| `openai` \| `auto` | `claude` |
| `provider_override` | string | No | Force specific provider | null |
| `prompt.system_prompt` | string | Yes | System prompt for LLM |
| `prompt.user_prompt` | string | Yes | User message |
| `prompt.context` | object | No | Request context |
| `parameters.model` | string | No | Specific model variant | `claude-sonnet-20250101` |
| `parameters.max_tokens` | integer | No | Max completion tokens | 1000 |
| `parameters.temperature` | number | No | 0.0–1.0 sampling temperature | 0.7 |
| `parameters.top_p` | number | No | 0.0–1.0 nucleus sampling | 0.95 |
| `parameters.stream` | boolean | No | Stream response tokens | true |
| `retry_policy.max_retries` | integer | No | Max retry attempts | 2 |
| `cost_allocation.case_id` | string | Yes | Case to charge token usage to |
| `cost_allocation.evaluation_type` | string | Yes | Type of evaluation (for analytics) |

### Response Schema (Streaming)

When `stream: true`, gateway responds with `Content-Type: text/event-stream`:

```
event: token
data: {"token":"Based","finish_reason":null,"index":0}

event: token
data: {"token":" on","finish_reason":null,"index":1}

event: token
data: {"token":" clinical","finish_reason":null,"index":2}

...

event: complete
data: {"finish_reason":"stop","total_tokens":487,"input_tokens":145,"output_tokens":342,"cost_usd":0.0234}

event: metadata
data: {"provider":"claude","model":"claude-sonnet-20250101","request_id":"llm_req_uuid_001","timestamp":"2026-03-19T14:40:00Z"}
```

### Streaming Event Types

| Event | Payload | Description |
|-------|---------|-------------|
| `token` | `{"token": "...", "finish_reason": null, "index": N}` | Single token |
| `complete` | `{"finish_reason": "stop", "total_tokens": N, ...}` | Completion finished |
| `metadata` | `{"provider": "...", "model": "...", ...}` | Response metadata |
| `error` | `{"error_type": "...", "details": "..."}` | Error event |

### Response Schema (Buffered)

When `stream: false`:

```json
{
  "request_id": "llm_req_uuid_001",
  "status": "success",
  "completion": {
    "text": "Based on clinical presentation (substernal chest discomfort, ST elevation in leads II, III, aVF, elevated troponin), the most likely diagnosis is acute ST-elevation myocardial infarction (STEMI) of the inferior wall. Immediate intervention with cardiac catheterization and percutaneous coronary intervention is indicated.",
    "finish_reason": "stop"
  },
  "usage": {
    "input_tokens": 145,
    "output_tokens": 342,
    "total_tokens": 487
  },
  "cost": {
    "input_cost_usd": 0.0145,
    "output_cost_usd": 0.0089,
    "total_cost_usd": 0.0234
  },
  "provider": "claude",
  "model": "claude-sonnet-20250101",
  "timestamp": "2026-03-19T14:40:00Z"
}
```

### Error Response (Model Overloaded)

```json
{
  "request_id": "llm_req_uuid_001",
  "status": "error",
  "error": {
    "error_type": "SERVICE_UNAVAILABLE",
    "details": "Claude API temporarily overloaded, retrying with GPT-4o",
    "provider_attempted": "claude",
    "fallback_provider": "openai",
    "retry_attempt": 1,
    "timestamp": "2026-03-19T14:40:05Z"
  }
}
```

### Error Response (Rate Limit)

```json
{
  "request_id": "llm_req_uuid_001",
  "status": "error",
  "error": {
    "error_type": "RATE_LIMIT",
    "details": "Rate limit exceeded: 1000 requests/min",
    "retry_after_seconds": 45,
    "quota_reset_at": "2026-03-19T14:41:00Z"
  }
}
```

### Error Response (Invalid API Key)

```json
{
  "request_id": "llm_req_uuid_001",
  "status": "error",
  "error": {
    "error_type": "AUTHENTICATION_FAILED",
    "details": "API key invalid or expired for provider 'claude'",
    "requires_reauth": true
  }
}
```

### Token Counting

The gateway counts tokens before sending request:

```json
{
  "request_id": "llm_req_uuid_001",
  "event": "tokens_counted",
  "data": {
    "input_tokens": 145,
    "estimated_output_tokens": 400,
    "total_estimated": 545,
    "estimated_cost_usd": 0.0250
  }
}
```

### Retry Logic

Gateway automatically retries on:
- Rate limits (429 status)
- Service unavailable (503 status)
- Timeouts (>120s)

**Exponential backoff:** `delay = base_delay * (backoff_multiplier ^ retry_count)`

---

## Endpoint: POST /llm/complete/batch

**Description:** Batch multiple completion requests for multi-section document processing.

**Direction:** Main → LLM Gateway (Request), LLM Gateway → Main (Response)

### Request Schema

```json
{
  "batch_id": "batch_uuid_001",
  "requests": [
    {
      "request_id": "llm_req_uuid_001",
      "section_id": "hpi_001",
      "system_prompt": "You are a clinical documentation specialist...",
      "user_prompt": "Expand the History of Present Illness section with differential diagnosis...",
      "parameters": {
        "model": "claude-sonnet-20250101",
        "max_tokens": 400,
        "temperature": 0.7
      }
    },
    {
      "request_id": "llm_req_uuid_002",
      "section_id": "assessment_001",
      "system_prompt": "You are a clinical documentation specialist...",
      "user_prompt": "Generate an assessment based on clinical findings...",
      "parameters": {
        "model": "claude-sonnet-20250101",
        "max_tokens": 500,
        "temperature": 0.7
      }
    }
  ],
  "cost_allocation": {
    "case_id": "case_abc123",
    "evaluation_type": "multi_section_generation"
  },
  "parallel_limit": 5
}
```

### Response Schema

```json
{
  "batch_id": "batch_uuid_001",
  "status": "success",
  "total_requests": 2,
  "successful": 2,
  "failed": 0,
  "results": [
    {
      "request_id": "llm_req_uuid_001",
      "section_id": "hpi_001",
      "status": "success",
      "completion": "The patient initially presented with mild cough...",
      "usage": {
        "input_tokens": 120,
        "output_tokens": 380,
        "total_tokens": 500
      },
      "cost_usd": 0.0189
    },
    {
      "request_id": "llm_req_uuid_002",
      "section_id": "assessment_001",
      "status": "success",
      "completion": "Based on clinical presentation, differential diagnoses include...",
      "usage": {
        "input_tokens": 145,
        "output_tokens": 450,
        "total_tokens": 595
      },
      "cost_usd": 0.0234
    }
  ],
  "batch_summary": {
    "total_input_tokens": 265,
    "total_output_tokens": 830,
    "total_tokens": 1095,
    "total_cost_usd": 0.0423,
    "processing_time_seconds": 12.3
  }
}
```

---

## Endpoint: GET /health

**Description:** Health check for LLM Gateway service.

**Direction:** Main → LLM Gateway (Request), LLM Gateway → Main (Response)

### Request Schema

```
GET /health HTTP/1.1
Authorization: Bearer <token>
```

### Response Schema (Healthy)

```json
{
  "status": "healthy",
  "timestamp": "2026-03-19T14:40:00Z",
  "providers": {
    "claude": {
      "status": "operational",
      "latency_ms": 342,
      "requests_last_hour": 1250,
      "errors_last_hour": 2,
      "error_rate": 0.0016
    },
    "openai": {
      "status": "operational",
      "latency_ms": 455,
      "requests_last_hour": 320,
      "errors_last_hour": 1,
      "error_rate": 0.0031
    }
  },
  "quotas": {
    "claude": {
      "requests_remaining_today": 8750,
      "tokens_remaining_today": 4500000,
      "reset_at": "2026-03-20T00:00:00Z"
    },
    "openai": {
      "requests_remaining_today": 2450,
      "tokens_remaining_today": 1200000,
      "reset_at": "2026-03-20T00:00:00Z"
    }
  },
  "version": "1.2.3"
}
```

---

## LLM Gateway Error Codes

| Code | Meaning | Retriable | Action |
|------|---------|-----------|--------|
| `AUTHENTICATION_FAILED` | Invalid/expired API key | No | Prompt user to re-authenticate |
| `RATE_LIMIT` | Quota exceeded | Yes | Backoff and retry |
| `SERVICE_UNAVAILABLE` | Provider down | Yes | Retry or fallback |
| `TIMEOUT` | Request >120s | Yes | Retry or fail |
| `INVALID_REQUEST` | Bad schema | No | Fix and resubmit |
| `CONTEXT_LENGTH_EXCEEDED` | Prompt too long | No | Summarize or split request |
| `GENERATION_FAILED` | LLM returned error | Maybe | Log and fallback |

---

## Main Process Integration Example

```javascript
// In Electron Main Process
const fetch = require('node-fetch');

class LLMGateway {
  constructor(baseUrl, authToken) {
    this.baseUrl = baseUrl;
    this.authToken = authToken;
  }

  async complete(params) {
    const response = await fetch(`${this.baseUrl}/llm/complete`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(params)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`LLM Gateway error: ${error.error.error_type}`);
    }

    if (params.parameters.stream) {
      return this.handleStreamingResponse(response);
    } else {
      return response.json();
    }
  }

  async *handleStreamingResponse(response) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          const eventType = line.substring(7);
          const dataLine = lines[lines.indexOf(line) + 1];
          if (dataLine && dataLine.startsWith('data: ')) {
            const data = JSON.parse(dataLine.substring(6));
            yield { event: eventType, data };
          }
        }
      }
    }
  }
}
```

---

# Boundary 4: Electron Main ↔ Renderer (React UI)

## Overview

Electron IPC allows the Renderer process (React UI) to communicate with the Main process securely. All IPC is routed through `contextBridge` in a preload script, with no raw Node access in the Renderer.

### Security Model

- **nodeIntegration:** false (disabled)
- **contextIsolation:** true (enabled)
- **preload script:** Validates all IPC messages
- **allowed channels:** Whitelist defined in preload

---

## IPC Channel Definitions

### Case Management Channels

#### Channel: case:create

**Direction:** Renderer → Main

**Request:**

```json
{
  "case_name": "Smith vs Hospital ABC",
  "case_type": "medical_malpractice",
  "client_id": "client_uuid_001",
  "description": "Cardiac care negligence claim",
  "metadata": {
    "date_of_incident": "2025-06-15",
    "plaintiff_name": "John Smith",
    "defendant_name": "Hospital ABC"
  }
}
```

**Response (Success):**

```json
{
  "status": "success",
  "case_id": "case_abc123",
  "created_at": "2026-03-19T14:40:00Z"
}
```

**Response (Error):**

```json
{
  "status": "error",
  "error_code": "VALIDATION_ERROR",
  "message": "case_name is required"
}
```

---

#### Channel: case:list

**Direction:** Renderer → Main

**Request:**

```json
{
  "filter": {
    "case_type": "medical_malpractice",
    "status": "open"
  },
  "sort": {
    "field": "created_at",
    "order": "desc"
  },
  "pagination": {
    "page": 1,
    "limit": 20
  }
}
```

**Response:**

```json
{
  "status": "success",
  "cases": [
    {
      "case_id": "case_abc123",
      "case_name": "Smith vs Hospital ABC",
      "case_type": "medical_malpractice",
      "status": "open",
      "created_at": "2026-03-19T10:00:00Z",
      "document_count": 5,
      "last_modified": "2026-03-19T14:00:00Z"
    }
  ],
  "total": 47,
  "page": 1,
  "limit": 20
}
```

---

#### Channel: case:update

**Direction:** Renderer → Main

**Request:**

```json
{
  "case_id": "case_abc123",
  "updates": {
    "status": "closed",
    "resolution_date": "2026-03-19"
  }
}
```

**Response:**

```json
{
  "status": "success",
  "case_id": "case_abc123",
  "updated_fields": ["status", "resolution_date"]
}
```

---

#### Channel: case:delete

**Direction:** Renderer → Main

**Request:**

```json
{
  "case_id": "case_abc123"
}
```

**Response:**

```json
{
  "status": "success",
  "case_id": "case_abc123",
  "deleted_at": "2026-03-19T14:40:00Z"
}
```

---

### Document Management Channels

#### Channel: document:upload

**Direction:** Renderer → Main

**Request:**

```json
{
  "case_id": "case_abc123",
  "file_path": "/tmp/uploads/clinical_note.docx",
  "file_name": "clinical_note.docx",
  "file_size_bytes": 45230,
  "document_type": "clinical_note",
  "metadata": {
    "uploaded_by": "user_uuid_001",
    "date_created": "2026-03-15"
  }
}
```

**Response:**

```json
{
  "status": "success",
  "document_id": "doc_uuid_f8e4c9a2",
  "case_id": "case_abc123",
  "uploaded_at": "2026-03-19T14:40:00Z",
  "pii_detection_status": "pending"
}
```

---

#### Channel: document:open

**Direction:** Renderer → Main

**Request:**

```json
{
  "case_id": "case_abc123",
  "document_id": "doc_uuid_f8e4c9a2"
}
```

**Response:**

```json
{
  "status": "success",
  "document_id": "doc_uuid_f8e4c9a2",
  "window_id": "editor_window_001"
}
```

---

#### Channel: document:list

**Direction:** Renderer → Main

**Request:**

```json
{
  "case_id": "case_abc123",
  "filter": {
    "document_type": "clinical_note",
    "status": "unreviewed"
  }
}
```

**Response:**

```json
{
  "status": "success",
  "documents": [
    {
      "document_id": "doc_uuid_f8e4c9a2",
      "file_name": "clinical_note.docx",
      "document_type": "clinical_note",
      "uploaded_at": "2026-03-19T10:00:00Z",
      "pii_detection_status": "complete",
      "pii_entities_found": 3,
      "review_status": "unreviewed"
    }
  ],
  "total": 5
}
```

---

### Agent & Gate Channels

#### Channel: agent:request

**Direction:** Renderer → Main

**Request:**

```json
{
  "request_id": "agent_req_uuid_001",
  "case_id": "case_abc123",
  "document_id": "doc_uuid_f8e4c9a2",
  "task_type": "generate_assessment",
  "task_description": "Generate a clinical assessment based on the patient presentation",
  "parameters": {
    "include_differential_diagnosis": true,
    "include_recommendations": true,
    "use_style_profile": "profile_uuid_8f2d4e9c"
  }
}
```

**Response (Queued):**

```json
{
  "status": "success",
  "request_id": "agent_req_uuid_001",
  "queue_position": 3,
  "estimated_wait_seconds": 45
}
```

---

#### Channel: agent:status (Streaming)

**Direction:** Main → Renderer (Async updates)

**Event (In Progress):**

```json
{
  "request_id": "agent_req_uuid_001",
  "status": "processing",
  "progress": {
    "stage": "pii_detection",
    "stage_progress_percent": 45,
    "overall_progress_percent": 15
  },
  "timestamp": "2026-03-19T14:41:00Z"
}
```

**Event (Completion):**

```json
{
  "request_id": "agent_req_uuid_001",
  "status": "completed",
  "result": {
    "generated_content": "Based on clinical presentation with substernal chest discomfort, ST elevation, and elevated troponin, the assessment indicates acute STEMI...",
    "confidence_score": 0.92,
    "processing_time_seconds": 34.2
  },
  "timestamp": "2026-03-19T14:42:00Z"
}
```

**Event (Error):**

```json
{
  "request_id": "agent_req_uuid_001",
  "status": "error",
  "error": {
    "error_type": "SIDECAR_UNAVAILABLE",
    "message": "PII detection service unavailable"
  },
  "timestamp": "2026-03-19T14:41:30Z"
}
```

---

#### Channel: gate:submit

**Direction:** Renderer → Main

**Request:**

```json
{
  "case_id": "case_abc123",
  "document_id": "doc_uuid_f8e4c9a2",
  "submission_type": "editor_review",
  "reviewer_notes": "Document ready for legal review",
  "track_changes_status": "all_accepted"
}
```

**Response:**

```json
{
  "status": "success",
  "submission_id": "sub_uuid_001",
  "submitted_at": "2026-03-19T14:42:00Z",
  "next_reviewer_role": "legal_reviewer"
}
```

---

#### Channel: gate:status

**Direction:** Main → Renderer (Query)

**Request:**

```json
{
  "case_id": "case_abc123",
  "document_id": "doc_uuid_f8e4c9a2"
}
```

**Response:**

```json
{
  "status": "success",
  "gate_status": "editor_review",
  "current_reviewer": "Dr. Smith",
  "submitted_by": "AI Assistant",
  "submitted_at": "2026-03-19T14:40:00Z",
  "estimated_review_time_minutes": 30,
  "can_resubmit": false
}
```

---

### Configuration Channels

#### Channel: config:get

**Direction:** Renderer → Main

**Request:**

```json
{
  "config_key": "llm_provider"
}
```

**Response:**

```json
{
  "status": "success",
  "config": {
    "llm_provider": "claude",
    "llm_model": "claude-sonnet-20250101",
    "fallback_provider": "openai",
    "fallback_model": "gpt-4o",
    "max_tokens": 1000,
    "temperature": 0.7
  }
}
```

---

#### Channel: config:set

**Direction:** Renderer → Main

**Request:**

```json
{
  "updates": {
    "temperature": 0.8,
    "llm_provider": "openai"
  }
}
```

**Response:**

```json
{
  "status": "success",
  "updated_config": {
    "temperature": 0.8,
    "llm_provider": "openai"
  }
}
```

---

### Authentication Channels

#### Channel: auth:login

**Direction:** Renderer → Main

**Request:**

```json
{
  "username": "user@example.com",
  "password": "hashed_password_from_renderer"
}
```

**Response (Success):**

```json
{
  "status": "success",
  "user_id": "user_uuid_001",
  "user_name": "Dr. Smith",
  "roles": ["clinician", "editor"],
  "session_token": "session_token_jwt",
  "expires_at": "2026-03-20T14:40:00Z"
}
```

**Response (Error):**

```json
{
  "status": "error",
  "error_code": "INVALID_CREDENTIALS",
  "message": "Username or password incorrect"
}
```

---

#### Channel: auth:logout

**Direction:** Renderer → Main

**Request:**

```json
{
  "user_id": "user_uuid_001"
}
```

**Response:**

```json
{
  "status": "success",
  "logged_out_at": "2026-03-19T14:40:00Z"
}
```

---

#### Channel: auth:status

**Direction:** Main → Renderer (Query)

**Request:**

```json
{}
```

**Response (Authenticated):**

```json
{
  "is_authenticated": true,
  "user_id": "user_uuid_001",
  "user_name": "Dr. Smith",
  "roles": ["clinician", "editor"],
  "session_expires_at": "2026-03-20T14:40:00Z"
}
```

**Response (Not Authenticated):**

```json
{
  "is_authenticated": false,
  "session_expired": false
}
```

---

### Audit Trail Channels

#### Channel: audit:query

**Direction:** Renderer → Main

**Request:**

```json
{
  "case_id": "case_abc123",
  "document_id": "doc_uuid_f8e4c9a2",
  "action_types": ["document_upload", "pii_detection", "content_generation"],
  "date_range": {
    "start": "2026-03-15T00:00:00Z",
    "end": "2026-03-19T23:59:59Z"
  },
  "limit": 50
}
```

**Response:**

```json
{
  "status": "success",
  "audit_events": [
    {
      "event_id": "audit_uuid_001",
      "action_type": "document_upload",
      "actor_id": "user_uuid_001",
      "actor_name": "Dr. Smith",
      "timestamp": "2026-03-19T10:00:00Z",
      "details": {
        "document_id": "doc_uuid_f8e4c9a2",
        "file_name": "clinical_note.docx",
        "file_size_bytes": 45230
      }
    },
    {
      "event_id": "audit_uuid_002",
      "action_type": "pii_detection",
      "actor_id": "system",
      "timestamp": "2026-03-19T10:05:00Z",
      "details": {
        "document_id": "doc_uuid_f8e4c9a2",
        "entities_detected": 3,
        "processing_time_ms": 245
      }
    }
  ],
  "total": 127
}
```

---

## Preload Script Example

```javascript
// preload.js
const { contextBridge, ipcRenderer } = require('electron');

const ALLOWED_CHANNELS = {
  // Case management
  'case:create': true,
  'case:list': true,
  'case:update': true,
  'case:delete': true,
  // Document management
  'document:upload': true,
  'document:open': true,
  'document:list': true,
  // Agent
  'agent:request': true,
  'agent:status': true,
  // Gate
  'gate:submit': true,
  'gate:status': true,
  // Config
  'config:get': true,
  'config:set': true,
  // Auth
  'auth:login': true,
  'auth:logout': true,
  'auth:status': true,
  // Audit
  'audit:query': true
};

contextBridge.exposeInMainWorld('ipc', {
  // Invoke pattern (request-response)
  invoke: (channel, data) => {
    if (!ALLOWED_CHANNELS[channel]) {
      throw new Error(`Unauthorized IPC channel: ${channel}`);
    }
    return ipcRenderer.invoke(channel, data);
  },

  // Listen pattern (async updates)
  on: (channel, callback) => {
    if (!ALLOWED_CHANNELS[channel]) {
      throw new Error(`Unauthorized IPC channel: ${channel}`);
    }
    const listener = (event, data) => callback(data);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  }
});
```

---

## React Component Example

```javascript
// useCase.js
import { useEffect, useState } from 'react';

export function useCase(caseId) {
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    window.ipc
      .invoke('case:list', {
        filter: { case_id: caseId }
      })
      .then(response => {
        if (response.status === 'success') {
          setCaseData(response.cases[0]);
        } else {
          setError(response.error_code);
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [caseId]);

  return { caseData, loading, error };
}

// Streaming agent status
export function useAgentRequest(requestId) {
  const [status, setStatus] = useState('pending');
  const [result, setResult] = useState(null);

  useEffect(() => {
    const unsubscribe = window.ipc.on('agent:status', (payload) => {
      if (payload.request_id === requestId) {
        setStatus(payload.status);
        if (payload.status === 'completed') {
          setResult(payload.result);
        }
      }
    });

    return unsubscribe;
  }, [requestId]);

  return { status, result };
}
```

---

## IPC Channel Constants

```javascript
// ipcChannels.js
export const IPC_CHANNELS = {
  // Case Management
  CASE_CREATE: 'case:create',
  CASE_LIST: 'case:list',
  CASE_UPDATE: 'case:update',
  CASE_DELETE: 'case:delete',

  // Document Management
  DOCUMENT_UPLOAD: 'document:upload',
  DOCUMENT_OPEN: 'document:open',
  DOCUMENT_LIST: 'document:list',

  // Agent
  AGENT_REQUEST: 'agent:request',
  AGENT_STATUS: 'agent:status',

  // Gate
  GATE_SUBMIT: 'gate:submit',
  GATE_STATUS: 'gate:status',

  // Configuration
  CONFIG_GET: 'config:get',
  CONFIG_SET: 'config:set',

  // Authentication
  AUTH_LOGIN: 'auth:login',
  AUTH_LOGOUT: 'auth:logout',
  AUTH_STATUS: 'auth:status',

  // Audit
  AUDIT_QUERY: 'audit:query'
};
```

---

# Cross-Cutting Concerns

## Request ID Tracing

All requests should include a `request_id` (UUID format) for end-to-end tracing across all boundaries:

```
┌─────────────────────────────────────────────────────┐
│ User action in React                                │
│ request_id: "abc123..."                             │
└────────────────┬────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────┐
│ Electron Main → Python Sidecar (PII detection)      │
│ request_id: "abc123..." [logged]                    │
└────────────────┬────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────┐
│ Electron Main → LLM Gateway                         │
│ request_id: "abc123..." [propagated]                │
└────────────────┬────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────┐
│ LLM provider (Claude/OpenAI)                        │
│ request_id: "abc123..." [in headers]                │
└─────────────────────────────────────────────────────┘
```

---

## Timeout Policy

| Boundary | Operation | Timeout |
|----------|-----------|---------|
| Main ↔ Python Sidecar | PII Detection | 60s |
| Main ↔ Python Sidecar | Transcription | 300s (large model), 120s (base) |
| Main ↔ Python Sidecar | Health Check | 5s |
| Main ↔ Python Sidecar | Style Extraction | 60s |
| Main ↔ OnlyOffice | Document Open | 30s |
| Main ↔ OnlyOffice | Content Insert | 10s |
| Main ↔ OnlyOffice | Finalization | 20s |
| Main ↔ LLM Gateway | Completion | 120s |
| Main ↔ Renderer | Any IPC | 10s |

---

## Error Handling Strategy

### Retry Logic

**Automatic Retry (3 attempts, exponential backoff):**
- Network timeouts
- Rate limits (429)
- Service unavailable (503)
- Transient errors

**No Retry (fail immediately):**
- Authentication errors (401, 403)
- Invalid input (400, 422)
- Not found (404)
- Unauthorized channels (IPC)

### User Notification

**Critical Errors (toast notification):**
- Sidecar crashed
- LLM Gateway unavailable
- Document save failed

**Non-Critical Warnings (log only):**
- High latency detected
- Rate limit approaching
- Feature degradation

---

## Logging & Monitoring

### Log Levels

- **ERROR:** Critical failures requiring user action
- **WARN:** Degradation or approaching limits
- **INFO:** Successful operations, state changes
- **DEBUG:** Detailed operation flow (request/response)
- **TRACE:** Token-level debugging

### Monitored Metrics

- Request latency (p50, p95, p99)
- Error rates per boundary
- Token usage per model
- Sidecar health status
- LLM provider availability

---

# Security Architecture

## Input Validation

### Main Process Responsibility

The Main process is responsible for validating all input:

1. **IPC messages from Renderer:** Validate schema against whitelist
2. **Sidecar responses:** Validate JSON-RPC compliance
3. **OnlyOffice events:** Validate event structure
4. **LLM Gateway responses:** Validate JSON schema

### Validation Example

```javascript
// In main.js
ipcMain.handle('case:create', async (event, payload) => {
  // Validate required fields
  if (!payload.case_name || payload.case_name.length === 0) {
    throw new Error('case_name is required');
  }

  if (!payload.case_type ||
      !['medical_malpractice', 'personal_injury', ...].includes(payload.case_type)) {
    throw new Error('case_type is invalid');
  }

  // Sanitize input
  const sanitized = {
    case_name: payload.case_name.trim(),
    case_type: payload.case_type.toLowerCase()
  };

  // Process
  return await createCase(sanitized);
});
```

---

## Credential Management

### API Key Storage

- **Method:** OS keychain (Electron `electron-keytar`)
- **Keys stored:** LLM provider API keys, service tokens
- **Rotation:** Every 24 hours
- **Access:** Only Main process (Renderer never sees raw keys)

### Implementation

```javascript
// In main.js
const keytar = require('keytar');

async function getClaudeApiKey() {
  const key = await keytar.getPassword('Psygil', 'claude-api-key');
  if (!key) {
    throw new Error('Claude API key not configured');
  }
  return key;
}

async function setClaudeApiKey(apiKey) {
  await keytar.setPassword('Psygil', 'claude-api-key', apiKey);
}
```

---

## Data Isolation

- **Renderer:** No access to file system, no direct network access
- **Main process:** Mediates all file system and network operations
- **Sidecar:** Isolated process, communication via socket only
- **OnlyOffice:** Sandboxed iframe within BrowserWindow

---

## Audit Trail

Every user action is logged:

```javascript
// Audit log schema
{
  "event_id": "uuid",
  "timestamp": "2026-03-19T14:40:00Z",
  "actor_id": "user_uuid",
  "action_type": "document_upload|content_generation|gate_submission",
  "case_id": "case_uuid",
  "details": { /* action-specific */ },
  "ip_address": "192.168.1.100",
  "user_agent": "..."
}
```

---

## Communication Encryption

- **Local IPC (Main ↔ Python/OnlyOffice):** Unencrypted (local machine trust boundary)
- **Network (Main ↔ LLM Gateway):** TLS 1.3 required
- **At-rest (documents):** File system encryption (user responsibility)

---

## End-to-End Summary Table

| Boundary | Protocol | Max Latency | Retry | Encryption |
|----------|----------|-------------|-------|------------|
| Main ↔ Python | Unix Socket / JSON-RPC | 60s | Yes (timeout) | None |
| Main ↔ OnlyOffice | Electron IPC | 30s | No | None |
| Main ↔ LLM Gateway | HTTPS REST | 120s | Yes (transient) | TLS 1.3 |
| Main ↔ Renderer | Electron IPC | 10s | No | None |

---

## Document Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-03-19 | Initial specification, all boundaries defined |

---

**END OF SPECIFICATION**
