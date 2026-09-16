from datetime import datetime
from typing import List, Optional, Dict, Literal
from pydantic import BaseModel, Field
import uuid

# --- Provenance Type ---
ProvenanceType = Literal["PATIENT_REPORTED", "AI_EXTRACTED", "HUMAN_VERIFIED", "CLINICIAN_CONFIRMED"]

# --- Exception Categories ---
ExceptionCategory = Literal[
    "LOW_SPEECH_CONFIDENCE",
    "LOW_OCR_CONFIDENCE",
    "INCOMPLETE_ANSWERS",
    "INTERACTION_FAILURE",
    "PATIENT_REQUEST",
    "RULE_BASED_SAFETY_FLAG"
]

# --- Evidence-Linked Data Item ---
class EvidenceItem(BaseModel):
    value: str
    source: str
    confidence: float
    provenance: ProvenanceType = "PATIENT_REPORTED"
    verified: bool = False
    verified_by: Optional[str] = None
    verified_at: Optional[datetime] = None

# --- Patient & Session Schemas ---
class PatientCreate(BaseModel):
    name: str = "Demo Patient"
    age: int = 45
    gender: str = "Male"
    abha_id: Optional[str] = "91-8823-9912-4012"
    language_preference: str = "hi"
    phone: Optional[str] = "+91 98765 43210"

class Patient(PatientCreate):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=datetime.utcnow)

class SessionCreate(BaseModel):
    language: str = "hi"
    abha_id: Optional[str] = None
    patient_name: Optional[str] = None
    patient_age: Optional[int] = None
    patient_gender: Optional[str] = None
    patient_phone: Optional[str] = None

class Session(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    patient_id: str
    patient: Patient
    language: str = "hi"
    status: str = "ACTIVE" # ACTIVE, IN_INTERVIEW, DOC_SCAN, NEED_ASSISTANCE, COMPLETED
    current_step: str = "language"
    assistance_score: float = 1.0 # 0.0 to 1.0 (Higher = automated, Lower = assistance needed)
    demo_stage: int = 1 # 1 to 11 (SIH Demo Stage Tracker)
    started_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None

# --- Interview Question & Response ---
class Question(BaseModel):
    question_id: str
    category: str
    text: Dict[str, str]
    audio_hint: Optional[str] = None
    options: Optional[List[str]] = None

class ResponsePayload(BaseModel):
    session_id: str
    question_id: str
    category: str
    answer_text: str
    audio_base64: Optional[str] = None
    idempotency_key: Optional[str] = None

class InterviewTurnResult(BaseModel):
    session_id: str
    transcription: str
    stt_confidence: float
    is_unknown: bool
    assistance_score: float
    detected_entities: List[EvidenceItem] = []
    next_question: Optional[Question] = None
    is_interview_complete: bool = False

# --- Document & Extraction Schemas ---
class ExtractedEntity(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str
    category: str # MEDICATION, DIAGNOSIS, INVESTIGATION, ALLERGY
    entity_name: str
    dosage: Optional[str] = None
    frequency: Optional[str] = None
    duration: Optional[str] = None
    confidence: float
    provenance: ProvenanceType = "AI_EXTRACTED"
    source_ref: str
    verified: bool = False
    verified_by: Optional[str] = None
    verified_at: Optional[datetime] = None

class DocumentProcessResult(BaseModel):
    document_id: str
    session_id: str
    raw_text: str
    overall_confidence: float
    assistance_score: float = 1.0
    entities: List[ExtractedEntity]
    requires_verification: bool
    exception_type: Optional[ExceptionCategory] = None

# --- Assistance Task Schemas ---
class AssistanceTask(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str
    patient_name: str
    exception_category: ExceptionCategory
    tier: Literal["TIER_1_OPD_FLOOR", "TIER_2_REMOTE_HUB"] = "TIER_1_OPD_FLOOR"
    reason: str
    priority: str = "MEDIUM" # LOW, MEDIUM, HIGH, URGENT
    status: str = "PENDING" # PENDING, IN_REVIEW, RESOLVED, REJECTED
    assistance_score: float = 0.5
    failed_step: str = "DOC_SCAN"
    entities: List[ExtractedEntity] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)

class VerificationCorrection(BaseModel):
    entity_id: str
    corrected_name: str
    corrected_dosage: Optional[str] = None
    corrected_frequency: Optional[str] = None
    verified: bool = True

class TaskVerifyPayload(BaseModel):
    corrections: List[VerificationCorrection]
    navigator_name: str = "Staff Navigator (Tier 1)"

# --- Red Flags & Clinical Summary ---
class RedFlagAlert(BaseModel):
    severity: str # NORMAL, ATTENTION, URGENT
    symptom: str
    message: str
    action_required: str

class ClinicalSummary(BaseModel):
    session_id: str
    patient: Patient
    chief_complaint: str
    hpi_summary: str
    socrates_breakdown: Optional[Dict[str, str]] = None
    past_medical_history: List[str] = []
    past_surgical_history: List[str] = []
    medications: List[ExtractedEntity] = []
    allergies: List[str] = []
    family_history: List[str] = []
    personal_social_history: List[str] = []
    review_of_systems: List[str] = []
    previous_treatment: List[str] = []
    previous_investigations: List[str] = []
    red_flags: List[RedFlagAlert] = []
    missing_or_uncertain_info: List[str] = []
    physician_verified: bool = False
    physician_notes: Optional[str] = None
    disclaimer: str = "AI-assisted summary — physician verification required."

# --- Operational Analytics Metrics ---
class OperationalMetrics(BaseModel):
    total_sessions: int = 142
    intake_completion_rate: float = 0.94 # 94%
    median_intake_time_seconds: int = 88 # 88s
    exception_rate: float = 0.12 # 12%
    avg_resolution_time_seconds: int = 34 # 34s
    ocr_correction_rate: float = 0.08 # 8%
    ai_to_human_handoff_rate: float = 0.10 # 10%
