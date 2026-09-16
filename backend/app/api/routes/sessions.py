from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List
from app.models.schemas import SessionCreate, Session, Patient, OperationalMetrics
from app.db.memory_store import db_store

router = APIRouter(prefix="/sessions", tags=["Sessions"])

@router.post("", response_model=Session)
async def create_session(payload: SessionCreate):
    # Reuse the registered ABHA patient when known so demographics survive.
    known = db_store.abha_registry.get(payload.abha_id) if payload.abha_id else None
    patient = Patient(
        name=payload.patient_name or (known.name if known else "Walk-in Patient"),
        age=payload.patient_age or (known.age if known else 0),
        gender=payload.patient_gender or (known.gender if known else "Not specified"),
        abha_id=payload.abha_id or (known.abha_id if known else "WALK-IN"),
        language_preference=payload.language,
        phone=payload.patient_phone or (known.phone if known else None),
    )
    session = Session(
        patient_id=patient.id,
        patient=patient,
        language=payload.language,
        status="ACTIVE",
        current_step="language",
        assistance_score=1.0,
        demo_stage=1
    )
    db_store.sessions[session.id] = session
    db_store.responses[session.id] = []
    db_store.documents[session.id] = []
    db_store.log_audit(session.id, "Session initiated", "Patient Kiosk", "PATIENT_REPORTED", f"Language: {payload.language}")
    db_store.save()
    return session

@router.get("", response_model=List[Session])
async def list_sessions(status: Optional[str] = Query(None)):
    """List all sessions - used by Doctor & Navigator dashboards for patient queue."""
    all_sessions = list(db_store.sessions.values())
    if status:
        return [s for s in all_sessions if s.status == status]
    # Return sessions with meaningful data (not empty shells)
    return sorted(all_sessions, key=lambda s: s.started_at, reverse=True)

@router.post("/abha/lookup")
async def abha_lookup(abha_id: str, name: Optional[str] = None):
    """Look up patient by ABHA ID. Returns patient data from ABHA mock registry."""
    # Check existing sessions for matching ABHA ID
    for session in db_store.sessions.values():
        if session.patient.abha_id == abha_id:
            return {
                "found": True,
                "patient": session.patient,
                "abha_health_records": db_store.get_abha_health_records(abha_id)
            }

    # Mock ABHA registry lookup
    abha_patient = db_store.abha_registry.get(abha_id)
    if abha_patient:
        return {
            "found": True,
            "patient": abha_patient,
            "abha_health_records": db_store.get_abha_health_records(abha_id)
        }

    return {"found": False, "message": "ABHA ID not found. Please register as new patient."}

@router.post("/abha/create")
async def create_abha_id(name: str, age: int, gender: str, phone: str, dob: str):
    """Create a new ABHA ID for a new patient."""
    import random
    # Generate ABHA-format ID: XX-XXXX-XXXX-XXXX
    abha_id = f"91-{random.randint(1000,9999)}-{random.randint(1000,9999)}-{random.randint(1000,9999)}"
    patient = Patient(
        name=name,
        age=age,
        gender=gender,
        abha_id=abha_id,
        language_preference="hi",
        phone=phone
    )
    db_store.abha_registry[abha_id] = patient
    db_store.log_audit("system", f"New ABHA ID created: {abha_id}", "ABHA Registration", "PATIENT_REPORTED", f"Patient: {name}")
    db_store.save()
    return {"abha_id": abha_id, "patient": patient, "message": "ABHA ID created successfully"}

@router.get("/metrics/operational", response_model=OperationalMetrics)
async def get_operational_metrics():
    return db_store.metrics

@router.get("/audit/logs")
async def get_audit_logs():
    return db_store.audit_trail

@router.get("/{session_id}", response_model=Session)
async def get_session(session_id: str):
    if session_id not in db_store.sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    return db_store.sessions[session_id]

@router.post("/{session_id}/stage")
async def update_demo_stage(session_id: str, stage: int):
    if session_id in db_store.sessions:
        db_store.sessions[session_id].demo_stage = stage
        db_store.save()
        return {"session_id": session_id, "demo_stage": stage}
    raise HTTPException(status_code=404, detail="Session not found")

@router.post("/{session_id}/reset")
async def reset_session(session_id: str):
    if session_id in db_store.sessions:
        db_store.sessions[session_id].status = "COMPLETED"
        db_store.log_audit(session_id, "Session completed & kiosk reset", "Kiosk Watchdog", "SYSTEM_AUDIT", "Screen returned to welcome state")
        db_store.save()
    return {"message": "Session reset successfully"}
