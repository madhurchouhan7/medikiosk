# Implementation Plan: MediKiosk

## Phase Breakdown

### Phase 1: Project Setup, Design System & Core Routing
- Initialize React TypeScript Vite application with Tailwind CSS, Lucide icons, Framer Motion, and i18next architecture.
- Build design system with healthcare palette: primary teal/cyan (`#007791`, `#00A896`), clinical navy (`#0A2540`), emergency red (`#E63946`), success green (`#2A9D8F`), surface slate.
- Configure routes for Landing, Kiosk, Navigator, Doctor, and Admin.

### Phase 2: Mock Adapters & AI Provider Layer
- Implement `LLMProvider`, `STTProvider`, `OCRProvider`, and `ABDMProvider` interface hierarchy.
- Create robust `MockLLMProvider`, `MockSTTProvider`, `MockOCRProvider`, and `MockABDMAdapter` with synthetic medical knowledge bases and realistic latencies.
- Wire backend FastAPI app structure.

### Phase 3: Patient Kiosk & Adaptive Clinical Interview Engine
- Build `/kiosk` fullscreen container with 1920x1080 touch targets.
- Create screens: Language Selection (10 languages), Patient ABHA Auth, Audio Consent, AI Interview, Document Scan, Review, Complete.
- Build adaptive clinical history engine based on standard SOAP / History framework: Chief Complaint, HPI, Past History, Vitals, Medications, Review of Systems.
- Build voice interaction state machine: `IDLE`, `LISTENING`, `TRANSCRIBING`, `THINKING`, `ASKING`, `CONFIRMATION_REQUIRED`, `ERROR`.

### Phase 4: Document Intelligence & Evidence-Linked Data Pipeline
- File upload & live camera scanner simulator.
- Preprocessing, OCR extraction, medical entity normalization.
- Evidence-linked JSON schema with source document reference and bounding boxes.

### Phase 5: Confidence & Navigator Assistance Workflow
- Implement confidence calculator scoring OCR, STT, and entity matching clarity.
- Low confidence (< 0.75) or manual "Need Help" generates a Navigator Task.
- Build `/navigator` dashboard with task list, side-by-side verification editor, and resolution actions.

### Phase 6: Doctor Dashboard & Physician Intake Summary
- Build `/doctor` dashboard featuring scannable SOAP summary.
- Distinct visual contrast between `AI EXTRACTED` and `HUMAN VERIFIED`.
- Integrated Red Flag engine displaying alerts (`NORMAL`, `ATTENTION`, `URGENT`).
- One-click summary approval & FHIR export view.

### Phase 7: Landing Page & Public Product Showcase
- Premium product landing page inspired by `medickiosk.in`.
- Sections: Hero, Problem vs Solution, Capabilities, 6-Step Patient Journey, Tech Stack (Local-first, Sarvam, Whisper, Ollama, FastAPI, PostgreSQL), Security, Interactive Live Prototype Launcher.

### Phase 8: Backend Persistence & Docker Orchestration
- FastAPI endpoints for session lifecycle, interview flow, document processing, navigator tasks, doctor summaries, system health.
- In-memory fallback and PostgreSQL/SQLAlchemy schemas.
- Dockerfile & `docker-compose.yml` for single-command launch.

### Phase 9: Testing, Hallucination Prevention & Final Polish
- Automated Pytest test suite covering session states, unknown handling, low-confidence task triggers, hallucination prevention rules.
- Polish animations, loading states, error states, and touch accessibility.
