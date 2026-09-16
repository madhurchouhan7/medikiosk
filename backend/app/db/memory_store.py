import json
import os
import tempfile
from typing import Dict, List
from datetime import datetime
from app.models.schemas import (
    Session, Patient, AssistanceTask, ClinicalSummary,
    ExtractedEntity, OperationalMetrics, ExceptionCategory
)

# JSON snapshot file. Survives server restarts (mount as a volume in Docker).
DATA_FILE = os.getenv(
    "NIRAMAYA_DATA_FILE",
    os.getenv("MEDIKIOSK_DATA_FILE", os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "..", "data",
        "niramaya_store.json")))


class InMemoryStore:
    def __init__(self, data_file: str = DATA_FILE, seed_demo: bool = True):
        self.sessions: Dict[str, Session] = {}
        self.responses: Dict[str, List[dict]] = {}
        self.documents: Dict[str, List[ExtractedEntity]] = {}
        self.assistance_tasks: Dict[str, AssistanceTask] = {}
        self.summaries: Dict[str, ClinicalSummary] = {}
        self.audit_trail: List[dict] = []
        self.metrics = OperationalMetrics()
        self.abha_registry: Dict[str, Patient] = {}  # ABHA ID -> Patient
        self.document_files: Dict[str, dict] = {}  # doc_id -> {session_id, file_name, stored_rel, doc_type}
        self._data_file = os.path.abspath(data_file)
        self._seed_demo = seed_demo
        if not self._load():
            if seed_demo:
                self.init_demo_scenarios()
                self.save()

    def log_audit(self, session_id: str, action: str, actor: str, provenance: str, details: str = ""):
        self.audit_trail.insert(0, {
            "timestamp": datetime.utcnow().strftime("%H:%M:%S"),
            "session_id": session_id,
            "action": action,
            "actor": actor,
            "provenance": provenance,
            "details": details
        })
        # Keep the trail bounded; audit is a log, not an archive.
        self.audit_trail = self.audit_trail[:500]

    # ── Persistence (atomic JSON snapshot) ────────────────────────────────
    def to_snapshot(self) -> dict:
        return {
            "sessions": {k: v.model_dump(mode="json") for k, v in self.sessions.items()},
            "responses": self.responses,
            "documents": {k: [e.model_dump(mode="json") for e in v] for k, v in self.documents.items()},
            "assistance_tasks": {k: v.model_dump(mode="json") for k, v in self.assistance_tasks.items()},
            "summaries": {k: v.model_dump(mode="json") for k, v in self.summaries.items()},
            "audit_trail": self.audit_trail,
            "abha_registry": {k: v.model_dump(mode="json") for k, v in self.abha_registry.items()},
            "document_files": self.document_files,
        }

    def save(self) -> None:
        try:
            os.makedirs(os.path.dirname(self._data_file), exist_ok=True)
            fd, tmp = tempfile.mkstemp(dir=os.path.dirname(self._data_file), suffix=".tmp")
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                json.dump(self.to_snapshot(), f, ensure_ascii=False)
            os.replace(tmp, self._data_file)
        except OSError:
            # Persistence must never break the request path; the data
            # remains live in memory for this process lifetime.
            pass

    def _load(self) -> bool:
        try:
            with open(self._data_file, "r", encoding="utf-8") as f:
                snap = json.load(f)
        except (OSError, ValueError):
            return False
        try:
            self.sessions = {k: Session.model_validate(v) for k, v in snap.get("sessions", {}).items()}
            self.responses = snap.get("responses", {})
            self.documents = {
                k: [ExtractedEntity.model_validate(e) for e in v]
                for k, v in snap.get("documents", {}).items()
            }
            self.assistance_tasks = {
                k: AssistanceTask.model_validate(v)
                for k, v in snap.get("assistance_tasks", {}).items()
            }
            self.summaries = {
                k: ClinicalSummary.model_validate(v)
                for k, v in snap.get("summaries", {}).items()
            }
            self.audit_trail = snap.get("audit_trail", [])
            self.abha_registry = {
                k: Patient.model_validate(v)
                for k, v in snap.get("abha_registry", {}).items()
            }
            self.document_files = snap.get("document_files", {})
            return True
        except (ValueError, TypeError, KeyError):
            return False

    def get_abha_health_records(self, abha_id: str) -> List[dict]:
        """Returns mock ABHA health records (past consultations, prescriptions, lab reports)."""
        records_by_abha = {
            "91-8823-9912-4012": [
                {
                    "type": "PRESCRIPTION",
                    "date": "2025-08-15",
                    "doctor": "Dr. Sharma, Cardiologist, AIIMS Delhi",
                    "facility": "AIIMS New Delhi",
                    "summary": "Hypertension management - Amlodipine 5mg OD, follow-up in 3 months",
                    "medications": ["Amlodipine 5mg OD", "Aspirin 75mg OD"]
                },
                {
                    "type": "LAB_REPORT",
                    "date": "2025-07-20",
                    "doctor": "Dr. Mehta, General Physician",
                    "facility": "District Hospital Jaipur",
                    "summary": "Blood pressure 145/92 mmHg, cholesterol borderline high",
                    "tests": ["CBC", "Lipid Profile", "RFT"]
                }
            ],
            "91-1122-3344-5566": [
                {
                    "type": "PRESCRIPTION",
                    "date": "2025-09-01",
                    "doctor": "Dr. Verma, ENT Specialist",
                    "facility": "Apollo Hospital Mumbai",
                    "summary": "Allergic rhinitis - Cetirizine 10mg at night",
                    "medications": ["Cetirizine 10mg OD"]
                }
            ],
            "91-4433-2211-9988": [
                {
                    "type": "DISCHARGE_SUMMARY",
                    "date": "2025-06-10",
                    "doctor": "Dr. Rao, Orthopedics",
                    "facility": "Government Medical College, Hyderabad",
                    "summary": "Knee osteoarthritis, conservative management, physiotherapy advised",
                    "medications": ["Diclofenac 50mg BD", "Calcium D3 1000mg OD"]
                }
            ]
        }
        return records_by_abha.get(abha_id, [])

    def init_demo_scenarios(self):
        """Synthetic showcase cases built through the REAL pipeline.

        No hardcoded summaries, scores, or red flags: responses pass the LLM
        turn classifier, document text passes the medication extractor, scores
        come from AssistanceScoreEngine, tasks follow the same routing rules
        as live traffic, and summaries/red flags come from
        ClinicalSummaryGenerator. Only the *input utterances* are synthetic
        (clearly-labelled demo patients) — everything downstream is computed.
        """
        from app.core.confidence import AssistanceScoreEngine
        from app.services.ocr.provider import extract_medication_entities
        from app.services.summary.generator import ClinicalSummaryGenerator

        def add_response(session_id: str, qid: str, category: str, text: str):
            # Sync version of MockLLMProvider.process_turn is_unknown logic.
            # Avoids asyncio.run_until_complete at import time, which crashes
            # under uvicorn/uvloop ("this event loop is already running").
            cleaned = (text or "").strip().lower()
            is_unknown = (not cleaned or any(
                phrase in cleaned for phrase in [
                    "don't know", "dont know", "don't remember",
                    "dont remember", "maloom nahi", "pata nahi", "yaad nahi"]))
            turn = {"is_unknown": is_unknown}
            # Route-level STT/safety signals, same as interview.respond.
            stt = 0.0 if not text.strip() else 0.95
            chest = any(k in text.lower() for k in
                        ["chest pain", "seene mein dard", "heart pain"])
            speech_fail = (not text.strip()) or stt < 0.65
            score, exc = AssistanceScoreEngine.calculate_score(
                stt_confidence=0.48 if speech_fail else stt,
                ocr_confidence=1.0,
                completeness=0.5 if turn["is_unknown"] else 1.0,
                has_safety_flag=chest)
            self.responses[session_id].append({
                "question_id": qid, "category": category,
                "answer_text": text, "is_unknown": turn["is_unknown"],
                "provenance": "PATIENT_REPORTED"})
            return score, exc

        def add_document(session_id: str, ocr_text: str, source: str):
            entities, needs_check = extract_medication_entities(
                ocr_text, session_id, source, 0.9)
            for e in entities:
                e.provenance = "AI_EXTRACTED"
            self.documents[session_id] = entities
            score, exc = AssistanceScoreEngine.calculate_score(
                ocr_confidence=(sum(e.confidence for e in entities) / len(entities))
                if entities else 0.0)
            return entities, (needs_check or exc is not None), score

        def make_task(session_id: str, name: str, category, tier: str,
                      reason: str, priority: str, score: float,
                      failed_step: str, entities):
            task = AssistanceTask(
                session_id=session_id, patient_name=name,
                exception_category=category, tier=tier, reason=reason,
                priority=priority, status="PENDING",
                assistance_score=score, failed_step=failed_step,
                entities=list(entities))
            self.assistance_tasks[task.id] = task
            self.sessions[session_id].status = "NEED_ASSISTANCE"
            self.sessions[session_id].assistance_score = score
            self.log_audit(session_id, f"Exception created: {category}",
                           "Task Router", "SYSTEM_AUDIT", f"Assigned to {tier}")

        def finish(session_id: str):
            session = self.sessions[session_id]
            summary = ClinicalSummaryGenerator.generate(
                session_id, session.patient,
                self.responses[session_id], self.documents[session_id])
            self.summaries[session_id] = summary
            return summary

        def register(pid: str, name: str, age: int, gender: str, abha: str,
                     lang: str, phone: str, sid: str):
            patient = Patient(id=pid, name=name, age=age, gender=gender,
                              abha_id=abha, language_preference=lang,
                              phone=phone)
            session = Session(id=sid, patient_id=patient.id, patient=patient,
                              language=lang, status="ACTIVE",
                              current_step="interview", assistance_score=1.0)
            self.sessions[sid] = session
            self.responses[sid] = []
            self.documents[sid] = []
            self.abha_registry[abha] = patient
            self.log_audit(sid, "Session initiated (demo patient)",
                           "Patient Kiosk", "PATIENT_REPORTED",
                           f"Language: {lang}")
            return patient, session

        # ── Case A: straightforward intake, high confidence ──
        register("patient-scen-a", "Aarav Mehta (demo)", 34, "Male",
                 "91-1122-3344-5566", "en", "+91 98111 22334", "session-scen-a")
        add_response("session-scen-a", "q_chief_complaint", "CHIEF_COMPLAINT",
                     "Dry cough for 3 days")
        add_response("session-scen-a", "q_hpi_onset", "HPI_ONSET",
                     "Onset 3 days ago, mild irritation, no fever")
        add_response("session-scen-a", "q_past_medical_history",
                     "PAST_MEDICAL_HISTORY", "No chronic illnesses")
        add_document("session-scen-a", "Rx: Cetirizine 10mg OD at night",
                     "demo-scan:clear_prescription#line=1")
        self.sessions["session-scen-a"].status = "COMPLETED"
        self.sessions["session-scen-a"].assistance_score = 0.98
        finish("session-scen-a")
        self.log_audit("session-scen-a", "Session completed automatically",
                       "System Orchestration Engine", "AI_EXTRACTED",
                       "High confidence, routed to Doctor")

        # ── Case B: dose unreadable → Tier 2 verification task ──
        register("patient-scen-b", "Rajesh Kumar (demo)", 52, "Male",
                 "91-8823-9912-4012", "hi", "+91 98765 43210", "session-scen-b")
        add_response("session-scen-b", "q_chief_complaint", "CHIEF_COMPLAINT",
                     "Ghutne mein dard hai (Knee pain)")
        add_response("session-scen-b", "q_hpi_onset", "HPI_ONSET",
                     "Dard 2 hafte se hai, chalne par badhta hai")
        add_response("session-scen-b", "q_past_medical_history",
                     "PAST_MEDICAL_HISTORY", "High BP (Hypertension) ki bimari hai")
        entities, needs_check, doc_score = add_document(
            "session-scen-b", "Rx: Amlodipine OD",
            "demo-scan:blurry_prescription#line=2")
        assert needs_check  # dose missing → UNKNOWN → verification
        make_task("session-scen-b", "Rajesh Kumar (demo)",
                  "LOW_OCR_CONFIDENCE", "TIER_2_REMOTE_HUB",
                  "Unreadable prescription dosage below threshold",
                  "HIGH", doc_score, "DOC_SCAN", entities)
        finish("session-scen-b")

        # ── Case C: empty/speech failure → Tier 1 task ──
        register("patient-scen-c", "Saraswati Devi (demo)", 67, "Female",
                 "91-4433-2211-9988", "hi", "+91 97654 32109", "session-scen-c")
        score_c, exc_c = add_response("session-scen-c", "q_chief_complaint",
                                      "CHIEF_COMPLAINT", "")
        assert exc_c == "LOW_SPEECH_CONFIDENCE"
        make_task("session-scen-c", "Saraswati Devi (demo)",
                  "LOW_SPEECH_CONFIDENCE", "TIER_1_OPD_FLOOR",
                  "Speech recognition failed to achieve reliable transcription.",
                  "MEDIUM", score_c, "VOICE_INTERVIEW", [])

        # ── Case E: chest pain → urgent safety task + red flags ──
        register("patient-scen-e", "Vikram Singh (demo)", 58, "Male",
                 "91-7788-9900-1122", "en", "+91 99001 12233", "session-scen-e")
        score_e, exc_e = add_response(
            "session-scen-e", "q_chief_complaint", "CHIEF_COMPLAINT",
            "Acute crushing chest pain with left arm radiation")
        assert exc_e == "RULE_BASED_SAFETY_FLAG"
        make_task("session-scen-e", "Vikram Singh (demo)",
                  "RULE_BASED_SAFETY_FLAG", "TIER_1_OPD_FLOOR",
                  "CLINICAL RED FLAG: Acute chest pain & diaphoresis detected. "
                  "Immediate clinical triage required.",
                  "URGENT", score_e, "CLINICAL_SAFETY_EVALUATION", [])
        summary_e = finish("session-scen-e")
        assert any(f.severity == "URGENT" for f in summary_e.red_flags)
        self.log_audit("session-scen-e",
                       "CRITICAL ALERT: RULE_BASED_SAFETY_FLAG",
                       "Clinical Rules Engine", "SYSTEM_AUDIT",
                       "Emergency protocol routing triggered")


db_store = InMemoryStore()
