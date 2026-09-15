from fastapi import APIRouter, HTTPException
from typing import Optional
from app.models.schemas import SessionCreate, Session, Patient, OperationalMetrics
from app.db.memory_store import db_store

router = APIRouter(prefix="/sessions", tags=["Sessions"])

@router.post("", response_model=Session)
async def create_session(payload: SessionCreate):
    patient = Patient(
        name="Walk-in Patient",
        age=45,
        gender="Male",
        abha_id=payload.abha_id or "91-9988-1122-3344",
        language_preference=payload.language
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
    db_store.log_audit(session.id, "Session initiated", "Patient Kiosk #3", "PATIENT_REPORTED", f"Language: {payload.language}")
    return session

@router.get("/{session_id}", response_model=Session)
async def get_session(session_id: str):
    if session_id not in db_store.sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    return db_store.sessions[session_id]

@router.post("/{session_id}/stage")
async def update_demo_stage(session_id: str, stage: int):
    if session_id in db_store.sessions:
        db_store.sessions[session_id].demo_stage = stage
        return {"session_id": session_id, "demo_stage": stage}
    raise HTTPException(status_code=404, detail="Session not found")

@router.post("/{session_id}/reset")
async def reset_session(session_id: str):
    if session_id in db_store.sessions:
        db_store.sessions[session_id].status = "COMPLETED"
        db_store.log_audit(session_id, "Session completed & kiosk reset", "Kiosk Watchdog", "SYSTEM_AUDIT", "Screen returned to welcome state")
    return {"message": "Session reset successfully"}

@router.get("/metrics/operational", response_model=OperationalMetrics)
async def get_operational_metrics():
    return db_store.metrics

@router.get("/audit/logs")
async def get_audit_logs():
    return db_store.audit_trail
