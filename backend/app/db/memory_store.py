from typing import Dict, List
from datetime import datetime
from app.models.schemas import (
    Session, Patient, AssistanceTask, ClinicalSummary,
    ExtractedEntity, OperationalMetrics, ExceptionCategory
)


class InMemoryStore:
    def __init__(self):
        self.sessions: Dict[str, Session] = {}
        self.responses: Dict[str, List[dict]] = {}
        self.documents: Dict[str, List[ExtractedEntity]] = {}
        self.assistance_tasks: Dict[str, AssistanceTask] = {}
        self.summaries: Dict[str, ClinicalSummary] = {}
        self.audit_trail: List[dict] = []
        self.metrics = OperationalMetrics()
        self.abha_registry: Dict[str, Patient] = {}  # ABHA ID -> Patient
        self.init_demo_scenarios()

    def log_audit(self, session_id: str, action: str, actor: str, provenance: str, details: str = ""):
        self.audit_trail.insert(0, {
            "timestamp": datetime.utcnow().strftime("%H:%M:%S"),
            "session_id": session_id,
            "action": action,
            "actor": actor,
            "provenance": provenance,
            "details": details
        })

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
        """
        Pre-seeds the 5 specific patient scenarios:
        Scenario A: Easy Case (Full Automation)
        Scenario B: Blurry Prescription (Tier 2 Remote Hub Exception)
        Scenario C: Language / Speech Difficulty (Tier 1 Floor Navigator)
        Scenario D: Repeated Interaction Failure (Escalation to Navigator)
        Scenario E: Clinical Red Flag (Urgent Safety Escalation)
        """
        # --- SCENARIO A: Easy case ---
        p_a = Patient(
            id="patient-scen-a",
            name="Aarav Mehta",
            age=34,
            gender="Male",
            abha_id="91-1122-3344-5566",
            language_preference="en",
            phone="+91 98111 22334"
        )
        s_a = Session(
            id="session-scen-a",
            patient_id=p_a.id,
            patient=p_a,
            language="en",
            status="COMPLETED",
            current_step="complete",
            assistance_score=0.98,
            demo_stage=10
        )
        self.sessions[s_a.id] = s_a
        self.abha_registry[p_a.abha_id] = p_a
        self.responses[s_a.id] = [
            {"category": "CHIEF_COMPLAINT", "answer_text": "Dry cough for 3 days", "is_unknown": False, "provenance": "PATIENT_REPORTED"},
            {"category": "HPI", "answer_text": "Onset 3 days ago, mild irritation, no fever", "is_unknown": False, "provenance": "PATIENT_REPORTED"},
            {"category": "PAST_HISTORY", "answer_text": "No chronic illnesses", "is_unknown": False, "provenance": "PATIENT_REPORTED"}
        ]
        self.documents[s_a.id] = [
            ExtractedEntity(
                session_id=s_a.id,
                category="MEDICATION",
                entity_name="Cetirizine",
                dosage="10mg",
                frequency="Once daily at night",
                confidence=0.96,
                provenance="AI_EXTRACTED",
                source_ref="clear_prescription_scen_a.jpg#line=1",
                verified=False
            )
        ]
        self.summaries[s_a.id] = ClinicalSummary(
            session_id=s_a.id,
            patient=p_a,
            chief_complaint="Dry cough for 3 days",
            hpi_summary="Onset 3 days ago, mild throat irritation, no fever or shortness of breath",
            past_medical_history=["No chronic conditions reported"],
            medications=self.documents[s_a.id],
            allergies=["No known drug allergies reported"],
            review_of_systems=["Respiratory: Mild dry cough", "General: Afebrile"],
            red_flags=[],
            missing_or_uncertain_info=["None — high-confidence automated intake"],
            physician_verified=False
        )

        # --- SCENARIO B: Blurry prescription (Pending Tier 2 Task) ---
        p_b = Patient(
            id="patient-scen-b",
            name="Rajesh Kumar",
            age=52,
            gender="Male",
            abha_id="91-8823-9912-4012",
            language_preference="hi",
            phone="+91 98765 43210"
        )
        s_b = Session(
            id="session-scen-b",
            patient_id=p_b.id,
            patient=p_b,
            language="hi",
            status="NEED_ASSISTANCE",
            current_step="documents",
            assistance_score=0.52,
            demo_stage=7
        )
        self.sessions[s_b.id] = s_b
        self.abha_registry[p_b.abha_id] = p_b
        self.responses[s_b.id] = [
            {"category": "CHIEF_COMPLAINT", "answer_text": "Ghutne mein dard hai (Knee pain)", "is_unknown": False, "provenance": "PATIENT_REPORTED"},
            {"category": "HPI", "answer_text": "Dard 2 hafte se hai, chalne par badhta hai", "is_unknown": False, "provenance": "PATIENT_REPORTED"},
            {"category": "PAST_HISTORY", "answer_text": "High BP (Hypertension) ki bimari hai", "is_unknown": False, "provenance": "PATIENT_REPORTED"}
        ]
        unclear_med = ExtractedEntity(
            id="med-scen-b-01",
            session_id=s_b.id,
            category="MEDICATION",
            entity_name="Amlodipine",
            dosage="[Unclear 5mg/10mg]",
            frequency="Once daily (OD)",
            confidence=0.52,
            provenance="AI_EXTRACTED",
            source_ref="blurry_prescription_scen_b.jpg#line=2",
            verified=False
        )
        self.documents[s_b.id] = [unclear_med]
        self.summaries[s_b.id] = ClinicalSummary(
            session_id=s_b.id,
            patient=p_b,
            chief_complaint="Ghutne mein dard (Knee pain) — 2 weeks",
            hpi_summary="Pain started 2 weeks ago, worsens on walking and standing. No recent trauma.",
            past_medical_history=["Hypertension (High BP) — ongoing for 3 years"],
            medications=[unclear_med],
            allergies=["Not reported / needs confirmation during consultation"],
            review_of_systems=["Musculoskeletal: Right knee tenderness", "Cardiovascular: Managed hypertension"],
            red_flags=[],
            missing_or_uncertain_info=["Amlodipine dosage ambiguous — awaiting Tier 2 reviewer verification"],
            physician_verified=False
        )

        task_b = AssistanceTask(
            id="task-scen-b-001",
            session_id=s_b.id,
            patient_name=p_b.name,
            exception_category="LOW_OCR_CONFIDENCE",
            tier="TIER_2_REMOTE_HUB",
            reason="Unreadable prescription dosage (52% confidence) below threshold",
            priority="HIGH",
            status="PENDING",
            assistance_score=0.52,
            failed_step="DOC_SCAN",
            entities=[unclear_med]
        )
        self.assistance_tasks[task_b.id] = task_b

        # --- SCENARIO C: Language / Speech Difficulty (Pending Tier 1 Task) ---
        p_c = Patient(
            id="patient-scen-c",
            name="Saraswati Devi",
            age=67,
            gender="Female",
            abha_id="91-4433-2211-9988",
            language_preference="hi",
            phone="+91 97654 32109"
        )
        s_c = Session(
            id="session-scen-c",
            patient_id=p_c.id,
            patient=p_c,
            language="hi",
            status="NEED_ASSISTANCE",
            current_step="interview",
            assistance_score=0.48,
            demo_stage=6
        )
        self.sessions[s_c.id] = s_c
        self.abha_registry[p_c.abha_id] = p_c
        self.responses[s_c.id] = [
            {"category": "CHIEF_COMPLAINT", "answer_text": "Low confidence transcription / audio muffled", "is_unknown": True, "provenance": "AI_EXTRACTED"}
        ]
        self.documents[s_c.id] = []
        task_c = AssistanceTask(
            id="task-scen-c-002",
            session_id=s_c.id,
            patient_name=p_c.name,
            exception_category="LOW_SPEECH_CONFIDENCE",
            tier="TIER_1_OPD_FLOOR",
            reason="Speech recognition confidence 48% (dialect / low volume). Touchscreen input assistance needed.",
            priority="MEDIUM",
            status="PENDING",
            assistance_score=0.48,
            failed_step="VOICE_INTERVIEW",
            entities=[]
        )
        self.assistance_tasks[task_c.id] = task_c

        # --- SCENARIO E: Clinical Red Flag (Urgent Alert) ---
        p_e = Patient(
            id="patient-scen-e",
            name="Vikram Singh",
            age=58,
            gender="Male",
            abha_id="91-7788-9900-1122",
            language_preference="en",
            phone="+91 99001 12233"
        )
        s_e = Session(
            id="session-scen-e",
            patient_id=p_e.id,
            patient=p_e,
            language="en",
            status="NEED_ASSISTANCE",
            current_step="interview",
            assistance_score=0.30,
            demo_stage=7
        )
        self.sessions[s_e.id] = s_e
        self.abha_registry[p_e.abha_id] = p_e
        self.responses[s_e.id] = [
            {"category": "CHIEF_COMPLAINT", "answer_text": "Acute crushing chest pain with left arm radiation", "is_unknown": False, "provenance": "PATIENT_REPORTED"},
            {"category": "HPI", "answer_text": "Started 45 minutes ago while climbing stairs, sweating", "is_unknown": False, "provenance": "PATIENT_REPORTED"}
        ]
        self.documents[s_e.id] = []
        task_e = AssistanceTask(
            id="task-scen-e-003",
            session_id=s_e.id,
            patient_name=p_e.name,
            exception_category="RULE_BASED_SAFETY_FLAG",
            tier="TIER_1_OPD_FLOOR",
            reason="CLINICAL RED FLAG: Acute chest pain & diaphoresis detected. Immediate clinical triage required.",
            priority="URGENT",
            status="PENDING",
            assistance_score=0.30,
            failed_step="CLINICAL_SAFETY_EVALUATION",
            entities=[]
        )
        self.assistance_tasks[task_e.id] = task_e

        # Initial audit log entries
        self.log_audit(s_a.id, "Session completed automatically", "System Orchestration Engine", "AI_EXTRACTED", "High confidence 98%, routed to Doctor")
        self.log_audit(s_b.id, "Exception created: LOW_OCR_CONFIDENCE", "Task Router", "SYSTEM_AUDIT", "Assigned to Tier 2 Remote Reviewer Hub")
        self.log_audit(s_c.id, "Exception created: LOW_SPEECH_CONFIDENCE", "Task Router", "SYSTEM_AUDIT", "Assigned to Tier 1 OPD Floor Navigator")
        self.log_audit(s_e.id, "CRITICAL ALERT: RULE_BASED_SAFETY_FLAG", "Clinical Rules Engine", "SYSTEM_AUDIT", "Emergency protocol routing triggered")


db_store = InMemoryStore()
