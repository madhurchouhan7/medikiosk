# MediKiosk API Contract Specification

## REST API Endpoints (Base URL: `/api`)

### 1. Sessions API
- `POST /api/sessions`
  - **Body**: `{ "language": "hi", "abha_id": "91-1234-5678-9012" }`
  - **Response**: `{ "session_id": "uuid", "patient": {...}, "status": "ACTIVE" }`
- `GET /api/sessions/{id}`
  - **Response**: Full session state including responses, documents, confidence level, and tasks.

### 2. AI Adaptive Interview API
- `POST /api/interview/start`
  - **Body**: `{ "session_id": "uuid" }`
  - **Response**: `{ "question_id": "q1", "category": "CHIEF_COMPLAINT", "text": "What brings you to the hospital today?", "audio_url": "..." }`
- `POST /api/interview/respond`
  - **Body**: `{ "session_id": "uuid", "question_id": "q1", "answer_text": "Ghutne mein dard hai", "audio_base64": "..." }`
  - **Response**: `{ "transcription": "Ghutne mein dard hai", "stt_confidence": 0.95, "next_question": {...}, "is_complete": false }`

### 3. Document Intelligence API
- `POST /api/documents/upload`
  - **Body**: `multipart/form-data` (`file`, `session_id`, `doc_type`)
  - **Response**: `{ "document_id": "uuid", "status": "PROCESSING" }`
- `GET /api/documents/{id}/entities`
  - **Response**: `{ "document_id": "uuid", "raw_text": "...", "entities": [ { "name": "Amlodipine", "dosage": "5mg", "confidence": 0.92, "source_snippet": "Amlodipine 5mg OD" } ] }`

### 4. Confidence & Assistance Navigator API
- `GET /api/assistance/tasks`
  - **Query Params**: `status=PENDING`
  - **Response**: Array of pending navigator tasks with priority, patient details, and low-confidence entity payloads.
- `POST /api/assistance/tasks/{id}/verify`
  - **Body**: `{ "corrections": [ { "entity_id": "uuid", "corrected_value": "Amlodipine 5mg", "verified": true } ] }`
  - **Response**: `{ "task_id": "uuid", "status": "RESOLVED" }`

### 5. Doctor Portal & Clinical Summary API
- `GET /api/doctors/patients`
  - **Response**: List of patients with intake session status.
- `GET /api/visits/{id}/summary`
  - **Response**: Complete structured clinical summary (SOAP, Red Flags, Medications, Evidence Links).
- `POST /api/visits/{id}/summary/verify`
  - **Body**: `{ "doctor_notes": "...", "confirmed": true }`
  - **Response**: `{ "status": "VERIFIED", "timestamp": "..." }`

### 6. System Health API
- `GET /api/health`
  - **Response**: `{ "status": "HEALTHY", "providers": { "llm": "OLLAMA_LOCAL", "stt": "WHISPER_LOCAL", "ocr": "TESSERACT_LOCAL", "db": "POSTGRES_CONNECTED" } }`
