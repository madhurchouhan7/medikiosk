# MediKiosk Data Model & Schema Definition

## PostgreSQL Schemas & Pydantic Definitions

### 1. Patients Table (`patients`)
| Field | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Primary patient ID |
| `abha_id` | VARCHAR(50) | ABHA / ABDM Identifier |
| `name` | VARCHAR(100) | Patient full name |
| `age` | INT | Patient age |
| `gender` | VARCHAR(20) | Male / Female / Other |
| `phone` | VARCHAR(20) | Contact phone number |
| `language_preference` | VARCHAR(10) | Preferred language code (e.g. `hi`, `en`) |
| `created_at` | TIMESTAMP | Registration timestamp |

### 2. Sessions Table (`sessions`)
| Field | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Session ID |
| `patient_id` | UUID (FK) | Reference to `patients.id` |
| `status` | VARCHAR(30) | `ACTIVE`, `IN_INTERVIEW`, `DOC_SCAN`, `NEED_ASSISTANCE`, `COMPLETED`, `ABORTED` |
| `current_step` | VARCHAR(50) | Active kiosk screen step |
| `language` | VARCHAR(10) | Session language |
| `started_at` | TIMESTAMP | Session start time |
| `completed_at` | TIMESTAMP | Session completion time |

### 3. Interview Responses (`responses`)
| Field | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Response ID |
| `session_id` | UUID (FK) | Reference to `sessions.id` |
| `category` | VARCHAR(50) | `CHIEF_COMPLAINT`, `HPI`, `PAST_HISTORY`, `MEDICATION`, `ALLERGY`, `ROS` |
| `question_text` | TEXT | Question asked by AI |
| `answer_text` | TEXT | Patient response (transcript or touch choice) |
| `is_unknown` | BOOLEAN | True if patient answered "I don't know" or similar |
| `stt_confidence` | FLOAT | Speech-to-text confidence score (0.0 to 1.0) |
| `timestamp` | TIMESTAMP | Response time |

### 4. Documents & Extracted Entities (`documents`, `extracted_entities`)
| Field | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Entity ID |
| `session_id` | UUID (FK) | Reference to `sessions.id` |
| `document_id` | UUID (FK) | Reference document ID |
| `category` | VARCHAR(50) | `MEDICATION`, `DIAGNOSIS`, `INVESTIGATION`, `ALLERGY` |
| `entity_name` | VARCHAR(150) | Extracted value (e.g. "Amlodipine") |
| `value_detail` | TEXT | Dosage, frequency, date |
| `source_ref` | VARCHAR(255) | Original document snippet / line reference |
| `confidence` | FLOAT | Extraction confidence (0.0 to 1.0) |
| `verified` | BOOLEAN | Human verification flag |
| `verified_by` | VARCHAR(100) | Navigator username who verified |
| `verified_at` | TIMESTAMP | Verification timestamp |

### 5. Assistance Tasks (`assistance_tasks`)
| Field | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Task ID |
| `session_id` | UUID (FK) | Reference session ID |
| `patient_name` | VARCHAR(100) | Patient name for queue |
| `reason` | VARCHAR(100) | `LOW_OCR_CONFIDENCE`, `LOW_STT_CONFIDENCE`, `PATIENT_REQUESTED_HELP`, `AMBIGUOUS_MEDICATION` |
| `priority` | VARCHAR(20) | `LOW`, `MEDIUM`, `HIGH`, `URGENT` |
| `status` | VARCHAR(30) | `PENDING`, `IN_REVIEW`, `RESOLVED`, `REJECTED` |
| `created_at` | TIMESTAMP | Task creation timestamp |

### 6. Red Flags & Doctor Summaries (`red_flags`, `doctor_summaries`)
| Field | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Summary ID |
| `session_id` | UUID (FK) | Reference session ID |
| `chief_complaint` | TEXT | Summary chief complaint |
| `hpi_summary` | TEXT | History of Presenting Illness summary |
| `past_medical_history` | TEXT | Past medical history |
| `current_medications` | JSONB | Array of verified/extracted medications |
| `red_flags` | JSONB | Array of alerts (`severity`: `NORMAL`, `ATTENTION`, `URGENT`, `message`) |
| `physician_verified` | BOOLEAN | Final doctor sign-off flag |
| `verified_at` | TIMESTAMP | Doctor verification timestamp |
