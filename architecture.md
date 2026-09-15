# MediKiosk System Architecture

## Overview
MediKiosk is an AI-assisted clinical patient intake platform designed for high-footfall Indian public hospitals and compliant with ABDM (Ayushman Bharat Digital Health Mission) FHIR R4 concepts. It automates walk-in intake, multilingual voice interviews, prescription OCR extraction, confidence scoring, navigator human-in-the-loop verification, and physician summary generation.

## High-Level Component Diagram

```
+-----------------------------------------------------------------------------------+
|                                 FRONTEND (React + Vite)                           |
|                                                                                   |
|  +--------------------+  +--------------------+  +-----------------------------+  |
|  |   Landing Page     |  |   Patient Kiosk    |  |    Navigator Dashboard      |  |
|  |   (Marketing/Info) |  | (Voice/Touch 1080p)|  |   (Human Verification)      |  |
|  +--------------------+  +--------------------+  +-----------------------------+  |
|  +--------------------------------------------+  +-----------------------------+  |
|  |            Doctor Dashboard                |  |    Admin System Health      |  |
|  |     (Structured Clinical Intake Summary)   |  |   (Infrastructure Monitoring)|  |
|  +--------------------------------------------+  +-----------------------------+  |
+------------------------------------------+----------------------------------------+
                                           |
                                      REST APIs
                                           |
+------------------------------------------v----------------------------------------+
|                                 BACKEND (FastAPI)                                 |
|                                                                                   |
|  +------------------+  +-------------------+  +--------------------------------+  |
|  | Session Engine   |  | Adaptive Interview|  | Confidence & Task Dispatch     |  |
|  | (State Machine)  |  | (Clinical Framework|  | Engine (High/Med/Low Threshold)|  |
|  +------------------+  +-------------------+  +--------------------------------+  |
|  +------------------+  +-------------------+  +--------------------------------+  |
|  | Red Flag Engine  |  | Clinical Summary  |  | Evidence & Audit Service       |  |
|  | (Deterministic)  |  | Generator         |  | (Source Tracing & HIPAA Logs)  |  |
|  +------------------+  +-------------------+  +--------------------------------+  |
+------------------------------------------+----------------------------------------+
                                           |
                     +---------------------+---------------------+
                     |                                           |
+--------------------v--------------------+     +----------------v------------------+
|           PROVIDER ABSTRACTION LAYER    |     |            DATA PERSISTENCE       |
|                                         |     |                                   |
|  - LLM: Local (Ollama) / Cloud / Mock   |     |  - PostgreSQL (Relational + UUID) |  |
|  - STT: Whisper / Sarvam / Mock         |     |  - pgvector (Medical Embeddings)  |  |
|  - OCR: Tesseract / Sarvam / Mock       |     |  - Redis (Session Cache)          |  |
|  - TTS: Web Speech / Sarvam / Mock      |     |                                   |
+-----------------------------------------+     +-----------------------------------+
```

## Modular Provider Abstractions

### 1. LLM Provider (`LLMProvider`)
- Interfaces: `generate_interview_question()`, `extract_entities()`, `generate_clinical_summary()`
- Implementations: `MockLLMProvider` (default sandbox), `OllamaLLMProvider` (local Llama/Gemma), `CloudLLMProvider` (fallback)

### 2. Speech-to-Text Provider (`STTProvider`)
- Interfaces: `transcribe_audio(audio_bytes, language)`
- Implementations: `MockSTTProvider` (simulated speech recognition), `WhisperSTTProvider` (local Whisper), `SarvamSTTProvider`

### 3. OCR Provider (`OCRProvider`)
- Interfaces: `extract_text_and_entities(image_bytes)`
- Implementations: `MockOCRProvider` (simulated prescription extraction with synthetic bounding boxes), `TesseractOCRProvider`, `SarvamOCRProvider`

## Confidence Engine Algorithm

```math
\text{Confidence Score} = w_{\text{ocr}} \cdot C_{\text{ocr}} + w_{\text{stt}} \cdot C_{\text{stt}} + w_{\text{entity}} \cdot C_{\text{match}}
```
- **HIGH $(\ge 0.85)$**: Auto-advance without blocking patient flow.
- **MEDIUM $(0.65 - 0.84)$**: Show inline confirmation prompt to patient at kiosk.
- **LOW $(< 0.65)$**: Dispatch task to Navigator Dashboard for human verification.

## Evidence-Linked Data Structure
Every extracted medical entity preserves source trace:
```json
{
  "entity_id": "med_001",
  "category": "MEDICATION",
  "name": "Amlodipine",
  "dosage": "5mg",
  "frequency": "Once daily",
  "source_type": "DOCUMENT",
  "source_ref": "doc_prescription_01.jpg#line=3",
  "confidence": 0.94,
  "verified": false,
  "verified_by": null,
  "verified_at": null
}
```

## Security & Local-First Design
- Full local-first capability: all inference (Whisper, Ollama, Tesseract) and storage (PostgreSQL, Redis) can run fully air-gapped on-premises.
- JWT role-based security: `PATIENT`, `NAVIGATOR`, `DOCTOR`, `ADMIN`.
- Session auto-purge & clean memory reset after completion.
