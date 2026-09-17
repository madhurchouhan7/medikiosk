# MediKiosk — Technical Overview

> **AI-Assisted Clinical Intake & Patient Case-Taking Platform**  
> Verified from source code · September 2026

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Solution Summary](#2-solution-summary)
3. [Tech Stack](#3-tech-stack)
4. [System Architecture](#4-system-architecture)
5. [Architecture Flowgraph](#5-architecture-flowgraph)
6. [Patient Kiosk — Screen Flow & State Machine](#6-patient-kiosk--screen-flow--state-machine)
7. [Adaptive Clinical Interview Engine](#7-adaptive-clinical-interview-engine)
8. [Confidence Scoring Engine](#8-confidence-scoring-engine)
9. [Document Intelligence — OCR Pipeline](#9-document-intelligence--ocr-pipeline)
10. [Human-in-the-Loop — Navigator Workflow](#10-human-in-the-loop--navigator-workflow)
11. [Offline-First Data Layer](#11-offline-first-data-layer)
12. [Data Model & Persistence](#12-data-model--persistence)
13. [API Contract](#13-api-contract)
14. [Doctor Dashboard](#14-doctor-dashboard)
15. [Security & Safety Model](#15-security--safety-model)
16. [Deployment Architecture](#16-deployment-architecture)
17. [Implemented vs Planned](#17-implemented-vs-planned)

---

## 1. Problem Statement

Current OPD workflow in high-footfall Indian public hospitals suffers from:

- Patients report only their primary complaint — chronic conditions like hypertension or diabetes are often undisclosed unless actively asked.
- Previous prescriptions are lost or forgotten — medication name, dose, and frequency are unknown to both patient and doctor.
- Doctors must manually retrieve and cross-check old documents mid-consultation, reducing time for clinical decision-making.
- There is no structured history format. Information captured is verbal, inconsistent, and non-searchable.
- Limited consultation slots make thorough history-taking impractical every visit.

---

## 2. Solution Summary

MediKiosk is a **patient-facing AI clinical intake kiosk** that:

- Collects structured clinical history **before** physician consultation via voice and touch
- Digitizes previous prescriptions, lab reports, and discharge summaries via OCR
- Scores confidence on every extracted piece of information
- Routes uncertain or incomplete data to a **human navigator** for verification
- Delivers a **physician-verifiable structured clinical summary** to the doctor dashboard

> **Important distinction:**  
> AI = history collection + extraction + organization + confidence scoring  
> Doctor = examination + verification + diagnosis + treatment decisions

---

## 3. Tech Stack

### Frontend

| Technology | Version | Purpose |
|---|---|---|
| React | 19.0.0 | UI framework |
| TypeScript | 5.7.3 | Type safety |
| Vite | 6.1.0 | Build tool & dev server |
| Tailwind CSS | 3.4.17 | Utility-first styling |
| Framer Motion | 12.4.7 | Animations & transitions |
| React Router | 7.2.0 | Client-side routing |
| Lucide React | 0.475.0 | Icon system |
| Tesseract.js | 5.1.1 | Client-side OCR fallback |
| clsx + tailwind-merge | — | Conditional class utilities |

### Backend

| Technology | Version | Purpose |
|---|---|---|
| FastAPI | >= 0.110.0 | REST API framework |
| Python | 3.x | Runtime |
| Pydantic | v2 >= 2.6.0 | Data validation & schemas |
| pydantic-settings | >= 2.2.0 | Environment configuration |
| Uvicorn | >= 0.28.0 | ASGI server |
| pytesseract | >= 0.3.10 | Server-side OCR (Tesseract wrapper) |
| Pillow | >= 10.0.0 | Image preprocessing for OCR |
| python-multipart | >= 0.0.9 | File upload handling |
| pytest + httpx | >= 8.0.0 | Test suite |

### AI / Provider Abstraction Layer

The system is built on **pluggable provider interfaces** — each AI service has a mock, local, and cloud implementation:

| Provider | Interface | Implementations |
|---|---|---|
| `LLMProvider` | `generate_interview_question()`, `extract_entities()`, `generate_clinical_summary()` | `MockLLMProvider` (default), `OllamaLLMProvider` *(planned)*, `CloudLLMProvider` *(planned)* |
| `STTProvider` | `transcribe_audio(audio_bytes, language)` | `MockSTTProvider` (default), `WhisperSTTProvider` *(planned)*, `SarvamSTTProvider` *(planned)* |
| `OCRProvider` | `extract_text_and_entities(image_bytes)` | `MockOCRProvider`, `TesseractOCRProvider` (default in Docker), `SarvamOCRProvider` *(planned)* |

> Provider selection is controlled via environment variables: `LLM_PROVIDER`, `STT_PROVIDER`, `OCR_PROVIDER`

### Data Layer

| Technology | Status | Purpose |
|---|---|---|
| JSON file store (`niramaya_store.json`) | **Implemented** | In-memory store persisted atomically to disk |
| Docker volume mount | **Implemented** | Survives container restarts |
| `localStorage` (browser) | **Implemented** | Client-side session snapshot & outbox queue |
| PostgreSQL | Planned | Relational data store |
| pgvector | Planned | Medical embeddings for semantic search |
| Redis | Planned | Session cache |

### Infrastructure & Deployment

| Component | Technology |
|---|---|
| Frontend hosting | Vercel |
| Backend hosting | Render (Python runtime) |
| Containerization | Docker + docker-compose |
| Reverse proxy | Nginx |
| CORS | Origin-whitelist only (no wildcard) |

---

## 4. System Architecture

```
+-----------------------------------------------------------------------+
|               FRONTEND  (React 19 + Vite + TypeScript)                |
|                                                                       |
|  +--------------+  +-------------------+  +------------------------+  |
|  | Landing      |  | Patient Kiosk     |  | Navigator Dashboard    |  |
|  | /            |  | /kiosk/*          |  | /navigator/*           |  |
|  +--------------+  +-------------------+  +------------------------+  |
|  +--------------------------------+  +-----------------------------+  |
|  | Doctor Dashboard               |  | Admin / System Health      |  |
|  | /doctor/*                      |  | /admin/*                   |  |
|  +--------------------------------+  +-----------------------------+  |
|                                                                       |
|  Services: api.ts · offline.ts · localInterview.ts                    |
+------------------------------------+----------------------------------+
                                     |
                              REST API (JSON over HTTPS)
                              CORS: explicit frontend origin(s) only
+------------------------------------v----------------------------------+
|                    BACKEND  (FastAPI + Uvicorn)                       |
|                                                                       |
|  +-----------------+  +------------------+  +-------------------+    |
|  | Session Engine  |  | Adaptive Interview|  | Confidence &      |    |
|  | (State machine) |  | Engine           |  | Exception Engine  |    |
|  +-----------------+  +------------------+  +-------------------+    |
|  +-----------------+  +------------------+  +-------------------+    |
|  | Red Flag Engine |  | Clinical Summary |  | Audit Service     |    |
|  | (Deterministic) |  | Generator        |  | (Provenance log)  |    |
|  +-----------------+  +------------------+  +-------------------+    |
|                                                                       |
|  Routes: /sessions  /interview  /documents  /assistance               |
|          /summaries  /health                                          |
+--------------------+-------------------------------------------------+
                     |
          +----------+---------------------------+
          |                                      |
+---------v-------------------+   +--------------v--------------------+
|  PROVIDER ABSTRACTION       |   |  DATA PERSISTENCE                 |
|                             |   |                                   |
|  LLM  -> Mock / Ollama      |   |  InMemoryStore + JSON snapshot    |
|  STT  -> Mock / Whisper     |   |  (atomic file write, Docker vol)  |
|  OCR  -> Tesseract / Sarvam |   |  Planned: PostgreSQL + pgvector   |
+-----------------------------+   |  Planned: Redis session cache     |
                                  +-----------------------------------+
```

---

## 5. Architecture Flowgraph

```
PATIENT arrives at hospital
        |
        v
+-----------------------+
|   MEDIKIOSK KIOSK     |  Fullscreen 1920x1080 touch display
|   (React Frontend)    |
+-----------+-----------+
            |
            v
+-----------------------+
|  Language Selection   |  10 Indian languages
|  + Audio Consent      |  Multilingual consent screen
+-----------+-----------+
            |
            v
+-----------------------+
|  Patient / Visit      |  ABHA lookup or new patient registration
|  Details              |  Name, age, gender, ABHA ID
+-----------+-----------+
            |
            v
+-----------------------+
|  AI HISTORY TAKING    |  Voice (Web Speech API -> STT Provider)
|  Voice + Touch        |  Touch fallback with structured options
+-----------+-----------+
            |
            v
+-------------------------------------------------------+
|           ADAPTIVE INTERVIEW ENGINE                    |
|                                                       |
|  Step 1: Chief Complaint (universal, multilingual)    |
|     |                                                 |
|     v  detect_specialty_domain(answer_text)           |
|     +-- CARDIAC_RESPIRATORY                           |
|     +-- MUSCULOSKELETAL                               |
|     +-- GASTROINTESTINAL                              |
|     +-- NEUROLOGICAL                                  |
|     +-- FEVER_INFECTION                               |
|     +-- GENERAL                                       |
|     |                                                 |
|     v  Domain-specific SOCRATES question bank         |
|  Site -> Onset -> Character -> Radiation ->           |
|  Associated Symptoms -> Timing -> Severity            |
|     |                                                 |
|     v  Universal follow-up questions                  |
|  Previous Treatment -> Past Medical History ->        |
|  Past Surgical -> Medications -> Allergies ->         |
|  Family History -> Social History ->                  |
|  Review of Systems -> Previous Investigations         |
+-----------------------+-----------------------+-------+
                        |  Each answer -> POST /interview/respond
                        |  Idempotency key prevents duplicate storage
                        v
          +---------------------------------+
          |  PATIENT RESPONSE EXTRACTION   |
          |  + Provenance tagging          |
          |  provenance = PATIENT_REPORTED |
          +--------------+-----------------+
                         |
                         v
          +---------------------------------+
          |   DOCUMENT SCAN / UPLOAD       |
          |   Prescription  Lab Report     |
          |   Discharge Summary            |
          +--------------+-----------------+
                         |  POST /documents/process (multipart)
                         v
          +---------------------------------+
          |   OCR ENGINE (pytesseract)     |
          |   Image -> Raw text            |
          |   -> Medical Entity Extraction |
          |   Medication/Dose/Frequency    |
          |   Diagnosis / Date / Result    |
          |   provenance = AI_EXTRACTED    |
          +--------------+-----------------+
                         |
                         v
          +-----------------------------------------------+
          |         CONFIDENCE ENGINE                      |
          |                                               |
          |  score = 0.4*ocr_conf + 0.4*stt_conf         |
          |          + 0.2*completeness                   |
          |                                               |
          |  Override rules (evaluated first):            |
          |  - user_requested_help  -> score = 0.0        |
          |  - has_safety_flag      -> score = 0.3        |
          |  - stt_confidence < 0.7 -> score * 0.8        |
          |  - ocr_confidence < 0.65-> score * 0.85       |
          |  - completeness < 0.7   -> score * 0.85       |
          +-----------------+-----------------------------+
                            |
             +--------------+--------------+
             |              |              |
          >= 0.85       0.65-0.84       < 0.65
             |              |              |
             v              v              v
         AUTO-PASS    INLINE PATIENT   NAVIGATOR TASK
                      CONFIRMATION     DISPATCHED
                      PROMPT           (ExceptionCategory
                                       + Priority + Tier)
             |              |              |
             +--------------+-------+------+
                                    |
                                    v
                    +------------------------------+
                    |  STRUCTURED PATIENT RECORD   |
                    |  Evidence-linked JSON        |
                    |  Source ref per entity       |
                    +--------------+---------------+
                                   |
                    +--------------v---------------+
                    |  CLINICAL SUMMARY GENERATOR  |
                    |  GET /summaries/{id}         |
                    +--------------+---------------+
                                   |
                    +--------------v---------------+
                    |  DOCTOR DASHBOARD            |
                    |  /doctor/patients/:id        |
                    |  - AI EXTRACTED items        |
                    |  - HUMAN VERIFIED items      |
                    |  - Red flag alerts           |
                    |  - Missing / uncertain       |
                    +--------------+---------------+
                                   |
                    +--------------v---------------+
                    |  PHYSICIAN REVIEW & SIGN-OFF |
                    |  POST /summaries/{id}/verify |
                    |  physician_verified = true   |
                    +------------------------------+
                                   |
                                   v
                        CLINICAL CONSULTATION
```

---

## 6. Patient Kiosk — Screen Flow & State Machine

Routes defined in `route_map.md`, implemented under `/src/features/kiosk/`:

```
/kiosk/language   ->  Language Selector (10 Indian languages)
/kiosk/auth       ->  ABHA Sandbox Login / Aadhaar / New Patient Registration
/kiosk/consent    ->  Multilingual audio consent + tap confirmation
/kiosk/interview  ->  AI voice/touch adaptive clinical history interview
/kiosk/documents  ->  Prescription & medical report camera/upload scanner
/kiosk/review     ->  Patient summary & extracted item preview
/kiosk/complete   ->  Completion confirmation + auto kiosk reset timer
```

### Session Status States

```
ACTIVE -> IN_INTERVIEW -> DOC_SCAN -> NEED_ASSISTANCE -> COMPLETED
                                            ^
                                  (low confidence triggers)
```

### Voice Interaction State Machine (frontend)

```
IDLE -> LISTENING -> TRANSCRIBING -> THINKING -> ASKING
                          |                          |
                   CONFIRMATION_REQUIRED         (next question)
                          |
                        ERROR -> fallback to TOUCH
```

### Demo Stage Tracker (backend integer)

| Stage | Meaning |
|---|---|
| 1 | Language selected |
| 2 | Patient details entered |
| 3 | Interview started |
| 4 | Document scan |
| 5 | Document processed OK |
| 6 | Document -> navigator task |
| 9 | Navigator resolved |
| 10 | Summary generated |
| 11 | Doctor sign-off complete |

---

## 7. Adaptive Clinical Interview Engine

**File:** `backend/app/services/interview/adaptive_engine.py` (800 lines)

### Domain Classification

After the chief complaint answer is received, `detect_specialty_domain(text)` classifies into one of:

| Domain | Trigger Keywords (sample) |
|---|---|
| `CARDIAC_RESPIRATORY` | chest, breath, palpitation, cough, angina |
| `MUSCULOSKELETAL` | knee, joint, back, shoulder, hip, arthritis |
| `GASTROINTESTINAL` | stomach, vomit, loose motion, jaundice, cramp |
| `NEUROLOGICAL` | headache, dizziness, seizure, numbness, paralysis |
| `FEVER_INFECTION` | fever, chills, rigor, rash, burning urine |
| `GENERAL` | fallback |

> Keyword matching is bilingual — includes transliterated Hindi keywords alongside English.

### Question Sequencing Logic

```python
class AdaptiveInterviewEngine:

    def get_first_question() -> Question:
        # Always returns CHIEF_COMPLAINT_QUESTION

    def get_domain_from_responses(responses) -> str:
        # Scans responses for CHIEF_COMPLAINT answer
        # -> passes to detect_specialty_domain()

    def get_next_question(current_question_id, responses) -> Question | None:
        # 1. If current = chief_complaint -> return domain_list[0]
        # 2. Find position of current_id in domain_list
        # 3. Return domain_list[idx+1], or None if interview complete
```

### Clinical History Framework (12 categories)

```
1.  CHIEF_COMPLAINT
2.  HPI_SITE        \
3.  HPI_ONSET        |
4.  HPI_CHARACTER    |  SOCRATES -- domain-specific question bank
5.  HPI_RADIATION    |
6.  HPI_SEVERITY    /
7.  PREVIOUS_TREATMENT
8.  PAST_MEDICAL_HISTORY
9.  PAST_SURGICAL_HISTORY
10. MEDICATIONS
11. ALLERGIES
12. FAMILY_HISTORY
13. PERSONAL_SOCIAL_HISTORY
14. REVIEW_OF_SYSTEMS
15. PREVIOUS_INVESTIGATIONS
```

### Question Schema

```python
class Question(BaseModel):
    question_id: str
    category: str
    text: dict        # {"en": "...", "hi": "...", "bn": "...", ...}
    options: list     # Touch-selectable quick answers (bilingual)
```

> Every question is fully localized in 10 languages: English, Hindi, Bengali, Tamil, Telugu, Marathi, Gujarati, Kannada, Malayalam, Punjabi.

### Idempotency on Response Submission

Every interview answer includes an `idempotency_key`. The backend checks this key before inserting.  
**Queued answers submitted twice (offline retry) are stored exactly once.**

---

## 8. Confidence Scoring Engine

**File:** `backend/app/core/confidence.py`

### Formula

```
score = 0.4 x ocr_confidence
      + 0.4 x stt_confidence
      + 0.2 x completeness
```

### Override Rules (evaluated before formula)

```python
if user_requested_help:
    return score=0.0, exception="PATIENT_REQUEST"

if has_safety_flag:           # e.g. chest pain keyword detected
    return score=0.3, exception="RULE_BASED_SAFETY_FLAG"

if stt_confidence < 0.7:
    score = stt_confidence * 0.8
    exception = "LOW_SPEECH_CONFIDENCE"

if ocr_confidence < 0.65:
    score = ocr_confidence * 0.85
    exception = "LOW_OCR_CONFIDENCE"

if completeness < 0.7:
    score = completeness * 0.85
    exception = "INCOMPLETE_ANSWERS"

# No override triggered: apply weighted formula
score = 0.4*ocr_conf + 0.4*stt_conf + 0.2*completeness
```

### Threshold Routing

| Score Range | Action |
|---|---|
| **>= 0.85** | Auto-advance. No interruption to patient flow. |
| **0.65 to 0.84** | Inline patient confirmation prompt shown at kiosk. |
| **< 0.65** | Navigator task dispatched to assistance queue. |

### Exception Categories

| Category | Trigger |
|---|---|
| `PATIENT_REQUEST` | Patient pressed "Need Help" button |
| `RULE_BASED_SAFETY_FLAG` | Deterministic keyword match (e.g. "chest pain", "seene mein dard") |
| `LOW_SPEECH_CONFIDENCE` | STT confidence < 0.70 |
| `LOW_OCR_CONFIDENCE` | OCR confidence < 0.65 |
| `INCOMPLETE_ANSWERS` | Completeness ratio < 0.70 |

### Navigator Task Tier Assignment

| Exception | Tier | Priority |
|---|---|---|
| `RULE_BASED_SAFETY_FLAG` | TIER_1_OPD_FLOOR | URGENT |
| `LOW_SPEECH_CONFIDENCE` | TIER_1_OPD_FLOOR | HIGH |
| `PATIENT_REQUEST` | TIER_1_OPD_FLOOR | HIGH |
| `LOW_OCR_CONFIDENCE` | TIER_2_REMOTE_HUB | HIGH |
| `INCOMPLETE_ANSWERS` | TIER_2_REMOTE_HUB | MEDIUM |

---

## 9. Document Intelligence — OCR Pipeline

**File:** `backend/app/api/routes/documents.py`

### Upload Flow

```
POST /documents/process (multipart/form-data)
  Fields: session_id, doc_type, file_name, file (binary), idempotency_key
```

### Processing Pipeline

```
1. Validate upload (file type, size)
2. get_ocr_provider() -> TesseractOCRProvider (default)
3. ocr_provider.process_document(session_id, doc_type, file_name, file_bytes)
4. Mark all entities: provenance = "AI_EXTRACTED"
5. Store raw file bytes to disk (Docker volume: /data/uploads/{session_id}/)
6. Run AssistanceScoreEngine.calculate_score(ocr_confidence=...)
7. If requires_verification OR assistance_score < 0.65 -> dispatch NavigatorTask
8. Serve original file at GET /documents/file/{doc_id} for navigator review
```

### Extracted Entity Schema

```json
{
  "entity_id": "med_001",
  "category": "MEDICATION",
  "entity_name": "Amlodipine",
  "dosage": "5mg",
  "frequency": "Once daily",
  "source_type": "DOCUMENT",
  "source_ref": "upload:{session_id}/{file}#doc={doc_id}",
  "confidence": 0.94,
  "provenance": "AI_EXTRACTED",
  "verified": false,
  "verified_by": null,
  "verified_at": null
}
```

### Fallback Behavior (No OCR Binary)

If Tesseract binary is not available on the host, the file is persisted to disk and a `LOW_OCR_CONFIDENCE` navigator task is created automatically.  
**The system never fabricates extracted text — unknown = routed to human.**

### Supported Document Types

- `PRESCRIPTION`
- `LAB_REPORT`
- `DISCHARGE_SUMMARY`

---

## 10. Human-in-the-Loop — Navigator Workflow

**Files:** `backend/app/api/routes/assistance.py`, frontend `/src/features/navigator/`

### Endpoints

```
POST /assistance/help                  # Patient-initiated help request
GET  /assistance/tasks                 # List all tasks (filter: ?tier=)
POST /assistance/tasks/{id}/verify     # Navigator resolves task
POST /assistance/tasks/{id}/escalate   # Escalate to URGENT
```

### Task Lifecycle

```
PENDING -> IN_REVIEW -> RESOLVED
                    |-> REJECTED
                    |-> ESCALATED (priority -> URGENT)
```

### Verification Logic

When navigator submits corrections via `POST /assistance/tasks/{id}/verify`:

```python
# 1. Match existing AI_EXTRACTED entities by entity_id
for entity in db_store.documents[session_id]:
    for correction in payload.corrections:
        if entity.id == correction.entity_id:
            entity.entity_name  = correction.corrected_name
            entity.dosage       = correction.corrected_dosage
            entity.confidence   = 1.0
            entity.provenance   = "HUMAN_VERIFIED"
            entity.verified     = True
            entity.verified_by  = payload.navigator_name
            entity.verified_at  = datetime.utcnow()

# 2. New entity (manual transcription from scan image — no prior AI entity)
db_store.documents[session_id].append(ExtractedEntity(
    provenance = "HUMAN_VERIFIED",
    source_ref = f"manual-transcription:{task_id}",
    confidence = 1.0,
    verified   = True,
    ...
))
```

After resolution:
- `session.assistance_score -> 1.0`
- `session.status -> ACTIVE`
- `session.demo_stage -> 9` (ready for doctor)
- Audit log entry written with actor name and corrected entities

---

## 11. Offline-First Data Layer

**File:** `src/services/offline.ts`

### Two-Layer Local Persistence

```
Layer 1: Session Snapshot
  Key:     niramaya.session.snapshot.v1  (localStorage)
  Stores:  current kiosk state, patient details, answered questions
  Purpose: Survive page reload / browser crash during intake

Layer 2: Outbox Queue
  Key:     niramaya.outbox.v1  (localStorage)
  Stores:  pending server operations with idempotency keys
  Purpose: Queue operations when offline, drain when online
```

### Outbox Operation Types

```typescript
type OutboxOp =
  | { kind: "answer";      sessionId, questionId, category, answerText, audioBase64 }
  | { kind: "document";    sessionId, docType, fileName, fileType, fileBase64 }
  | { kind: "help";        sessionId }
  | { kind: "verify-task"; taskId, corrections, navigatorName }
```

### Sync Logic

```typescript
async function processOutbox(): Promise<void> {
  if (processing || !navigator.onLine) return;

  for each pending entry where nextRetryAt <= now:
    try:
      await executeOp(entry.op)
      remove entry from outbox   // success
    catch ApiError (4xx):
      remove entry from outbox   // won't succeed on retry, drop
    catch network error:
      entry.attempts += 1
      entry.nextRetryAt = now + backoffMs(attempts)  // exponential
}

function backoffMs(attempts: number): number {
  return Math.min(30000, 1000 * 2 ** attempts);
  // 1s, 2s, 4s, 8s, 16s, 30s (capped)
}
```

### Trigger Points

```typescript
window.addEventListener("online", () => void processOutbox());
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") void processOutbox();
});
enqueueOp(op)  // Immediately attempts flush on every enqueue
```

### Offline Fallback Interview

**File:** `src/services/localInterview.ts`

When the server is unreachable, the kiosk falls back to a minimal local question bank — 10 questions in EN/HI — covering:

```
CHIEF_COMPLAINT, HPI_SITE, HPI_ONSET, HPI_CHARACTER, HPI_SEVERITY,
PREVIOUS_TREATMENT, PAST_MEDICAL_HISTORY, MEDICATIONS, ALLERGIES,
REVIEW_OF_SYSTEMS
```

On reconnect:
- Queued answers sync via outbox
- Server resumes adaptive sequencing via `GET /interview/next/{session_id}`

> **Important distinction:** Session data & interview responses are offline-safe via localStorage outbox. Cloud AI services (LLM, STT) require connectivity. The local fallback uses a deterministic rule-based question bank — not a local AI model.

### React Integration (concurrent-safe)

```typescript
// Uses useSyncExternalStore — React 18+ concurrent-safe external store subscription
// Cached snapshot prevents unnecessary re-renders (solves blank page bug)

export function useOnlineStatus(): { online: boolean; pending: number; syncing: boolean }
export function useOutboxPending(): { pending: number; syncing: boolean }
```

---

## 12. Data Model & Persistence

**File:** `backend/app/db/memory_store.py`

### In-Memory Store Structure

```python
class InMemoryStore:
    sessions:          Dict[str, Session]               # Active sessions
    responses:         Dict[str, List[dict]]            # Interview answers per session
    documents:         Dict[str, List[ExtractedEntity]] # OCR entities per session
    assistance_tasks:  Dict[str, AssistanceTask]        # Navigator task queue
    summaries:         Dict[str, ClinicalSummary]       # Generated doctor summaries
    audit_trail:       List[dict]                       # Bounded to 500 entries
    abha_registry:     Dict[str, Patient]               # Mock ABHA patient registry
    document_files:    Dict[str, dict]                  # Document metadata + stored path
    metrics:           OperationalMetrics
```

### JSON Snapshot Persistence

```python
def save(self) -> None:
    # Atomic write: write to temp file, then os.replace() atomically
    fd, tmp = tempfile.mkstemp(dir=data_dir, suffix=".tmp")
    json.dump(self.to_snapshot(), f, ensure_ascii=False)
    os.replace(tmp, self._data_file)
    # Failure is swallowed — never breaks the request path
    # Data remains live in-process memory for process lifetime
```

Data file path from environment: `NIRAMAYA_DATA_FILE`  
Docker volume mount: `/data/niramaya_store.json`  
Uploaded scans: `/data/uploads/{session_id}/`

### Provenance Tagging

Every data item carries a provenance field:

| Provenance | Meaning |
|---|---|
| `PATIENT_REPORTED` | Direct voice/touch answer from patient |
| `AI_EXTRACTED` | Extracted by OCR or LLM provider |
| `HUMAN_VERIFIED` | Corrected and signed off by navigator |
| `CLINICIAN_CONFIRMED` | Final doctor sign-off |
| `SYSTEM_AUDIT` | Automated system action |

### Key Pydantic Schemas (`backend/app/models/schemas.py`)

```python
class Patient(BaseModel):
    id: UUID
    abha_id: str
    name: str; age: int; gender: str
    language_preference: str   # "hi", "en", "ta", etc.

class Session(BaseModel):
    id: UUID
    patient: Patient
    status: str                # ACTIVE | IN_INTERVIEW | NEED_ASSISTANCE | COMPLETED
    current_step: str
    language: str
    assistance_score: float    # 0.0 to 1.0
    demo_stage: int            # 1 to 11

class ExtractedEntity(BaseModel):
    id: UUID; session_id: str
    category: str              # MEDICATION | DIAGNOSIS | INVESTIGATION | ALLERGY
    entity_name: str
    dosage: Optional[str]; frequency: Optional[str]
    confidence: float          # 0.0 to 1.0
    provenance: str
    source_ref: str            # "upload:session_id/file.jpg#doc=doc_id" or "manual-transcription:task_id"
    verified: bool
    verified_by: Optional[str]
    verified_at: Optional[datetime]

class AssistanceTask(BaseModel):
    id: UUID; session_id: str; patient_name: str
    exception_category: str
    tier: str                  # TIER_1_OPD_FLOOR | TIER_2_REMOTE_HUB
    reason: str
    priority: str              # LOW | MEDIUM | HIGH | URGENT
    status: str                # PENDING | IN_REVIEW | RESOLVED | REJECTED
    assistance_score: float
    failed_step: str
    entities: List[ExtractedEntity]

class ClinicalSummary(BaseModel):
    session_id: str; patient: Patient
    chief_complaint: str; hpi_summary: str
    past_medical_history: str
    current_medications: List[ExtractedEntity]
    red_flags: List[dict]      # [{severity: NORMAL|ATTENTION|URGENT, message: str}]
    physician_verified: bool
    physician_notes: Optional[str]
```

---

## 13. API Contract

Base path: `/api`

### Sessions

```
POST   /sessions                         Create session, register patient
GET    /sessions                         List all sessions (?status= filter)
POST   /sessions/abha/lookup             ABHA ID patient lookup
POST   /sessions/abha/create             New ABHA ID registration
GET    /sessions/metrics/operational     Operational metrics
GET    /sessions/audit/logs              Compliance audit trail
GET    /sessions/{id}                    Get session by ID
POST   /sessions/{id}/stage             Update demo stage
POST   /sessions/{id}/reset             Complete & reset session
```

### Interview

```
GET    /interview/start/{session_id}     Begin interview, return first question
GET    /interview/next/{session_id}      Resume after offline reconnect
POST   /interview/respond               Submit patient answer (with idempotency_key)
```

### Documents

```
POST   /documents/process               Upload & OCR document (multipart/form-data)
GET    /documents/file/{doc_id}         Serve original scan (for navigator review)
```

### Assistance (Navigator)

```
POST   /assistance/help                 Patient-requested help
GET    /assistance/tasks                List tasks (?tier= filter)
POST   /assistance/tasks/{id}/verify    Resolve with corrections
POST   /assistance/tasks/{id}/escalate  Escalate to URGENT
```

### Summaries (Doctor)

```
GET    /summaries                       Doctor patient queue list
GET    /summaries/{session_id}          Generate + return clinical summary
POST   /summaries/{session_id}/verify   Physician sign-off
```

### System

```
GET    /health                          API health check
```

---

## 14. Doctor Dashboard

**Route:** `/doctor/patients/:id`  
**File:** `src/features/doctor/`

The doctor sees a SOAP-format structured summary containing:

| Section | Provenance |
|---|---|
| Patient Profile (name, age, gender, ABHA ID) | System |
| Chief Complaint | AI Extracted |
| History of Present Illness | AI Extracted |
| Past Medical History | AI Extracted |
| Current Medications | AI Extracted + Human Verified |
| Previous Reports / Investigations | AI Extracted |
| Allergies | Patient Reported |
| Red Flag Alerts (NORMAL / ATTENTION / URGENT) | Deterministic engine |
| Missing / Uncertain fields | Flagged explicitly |
| Physician Notes | Doctor input |

Visual distinction: `AI EXTRACTED` (teal badge) vs `HUMAN VERIFIED` (purple badge) on every item.

Doctor actions:
- Review structured summary
- Edit any field
- Sign off: `POST /summaries/{id}/verify` -> `physician_verified = true`
- `physician_verified` is logged in audit trail with `CLINICIAN_CONFIRMED` provenance

---

## 15. Security & Safety Model

### Authentication & Authorization

- JWT role-based access: `PATIENT` / `NAVIGATOR` / `DOCTOR` / `ADMIN`
- CORS: explicit frontend origin whitelist only (`FRONTEND_ORIGINS` env var), no wildcard
- Session auto-purge and memory reset after completion

### Safety Constraints (non-negotiable)

| Constraint | Implementation |
|---|---|
| No autonomous diagnosis | System outputs `clinical_summary`, never `diagnosis`. Physician verification required. |
| No fabricated data | Untranscribable audio -> low-confidence task. Unreadable OCR -> task. System never invents values. |
| Unknown is explicit | `is_unknown: true` stored per response. Displayed as "UNKNOWN / NEEDS VERIFICATION". |
| Chest pain red flag override | Keyword detection -> `score = 0.3`, `RULE_BASED_SAFETY_FLAG`, priority `URGENT`. Bypasses normal confidence formula. |
| Audit trail | Every action logged: timestamp, session_id, action, actor, provenance, detail. |
| Evidence tracing | Every extracted entity has `source_ref` linking to origin document + line reference. |
| Session isolation | Separate document buckets, response lists, and summaries per session UUID. |
| Navigator cannot silently overwrite | New manual transcriptions are appended as `HUMAN_VERIFIED` — never merged silently with AI entities. |

---

## 16. Deployment Architecture

### Cloud (Current Configuration)

```
Internet
    |
    v
Vercel CDN -> React SPA (static build)
    |
    | HTTPS REST API
    v
Render Web Service
    |
    +-- FastAPI / Uvicorn (Python runtime)
    |
    +-- /data/niramaya_store.json  (persistent disk volume)
    +-- /data/uploads/{session_id}/  (document scan files)
```

**Render environment variables:**
```
LLM_PROVIDER=MOCK
STT_PROVIDER=MOCK
OCR_PROVIDER=TESSERACT
FRONTEND_ORIGINS=https://your-app.vercel.app
NIRAMAYA_DATA_FILE=/data/niramaya_store.json
NIRAMAYA_UPLOADS=/data/uploads
```

### Local Docker

```bash
docker-compose up

# Frontend: http://localhost:3000  (Nginx serving React dist)
# Backend:  http://localhost:8000  (Uvicorn + FastAPI)
# Volume:   niramaya-data -> /data
```

`docker-compose.yml` mounts a named volume so patient snapshots and uploaded scans survive container restarts.

### Air-Gapped / On-Premises (Planned)

Full local-first capability when providers are swapped:

```
OCR:     Tesseract binary (pre-installed in backend/Dockerfile via apt)
STT:     Whisper (local, planned)
LLM:     Ollama / Gemma (local, planned)
Storage: PostgreSQL + Redis (local, planned)
```

---

## 17. Implemented vs Planned

### Implemented (verified in repository)

- [x] React 19 + TypeScript + Vite + Tailwind + Framer Motion frontend
- [x] FastAPI + Pydantic v2 + Uvicorn backend
- [x] Adaptive clinical interview engine (6 domains, 800-line question bank, bilingual EN/HI + 8 regional languages)
- [x] Session state machine (7 statuses, 11 demo stages)
- [x] Confidence scoring engine with weighted formula + override rules
- [x] Exception classification and navigator task dispatch (2 tiers, 4 priority levels)
- [x] OCR pipeline using pytesseract + Pillow
- [x] Evidence-linked entity schema with source_ref and provenance tagging
- [x] Navigator assistant dashboard with task queue and verification editor
- [x] Doctor dashboard with AI-vs-human-verified distinction and physician sign-off
- [x] ABHA mock registry (lookup + new patient creation with generated ABHA ID)
- [x] Audit trail (bounded at 500 entries, role + provenance per entry)
- [x] Offline-first localStorage session snapshot
- [x] Outbox queue with idempotency keys and exponential backoff retry
- [x] Offline fallback question bank (10 questions, EN/HI, rule-based — no local AI model)
- [x] Idempotent interview answer and document upload endpoints
- [x] Atomic JSON snapshot persistence with Docker volume
- [x] Docker + docker-compose single-command local deployment
- [x] Vercel (frontend) + Render (backend) cloud deployment configs
- [x] Nginx reverse proxy config
- [x] pytest test suite covering sessions, interview, documents, navigator

### Planned / Configured but Not Yet Active

- [ ] PostgreSQL relational store (replacing JSON file store)
- [ ] pgvector for medical embedding similarity search
- [ ] Redis session cache
- [ ] Whisper STT (local, server-side transcription)
- [ ] Ollama LLM (local Llama/Gemma for question generation & NLP extraction)
- [ ] Sarvam AI (Indian-language STT + TTS + OCR)
- [ ] FHIR R4 export (architecture specifies ABDM compliance)
- [ ] i18next runtime language switching in frontend
- [ ] Admin system health dashboard (route defined, UI partial)
- [ ] Full cloud LLM integration (currently MockLLMProvider only)

---

*All information in this document is derived directly from the MediKiosk source code and project documentation.*  
*No technology, integration, or feature has been invented or assumed.*
