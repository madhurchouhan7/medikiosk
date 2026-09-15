from fastapi import APIRouter, HTTPException
from app.models.schemas import ClinicalSummary
from app.db.memory_store import db_store
from app.services.summary.generator import ClinicalSummaryGenerator

router = APIRouter(prefix="/summaries", tags=["Summaries"])

@router.get("/{session_id}", response_model=ClinicalSummary)
async def get_summary(session_id: str):
    if session_id not in db_store.sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    session = db_store.sessions[session_id]
    responses = db_store.responses.get(session_id, [])
    meds = db_store.documents.get(session_id, [])

    summary = ClinicalSummaryGenerator.generate(session_id, session.patient, responses, meds)
    db_store.summaries[session_id] = summary
    session.demo_stage = 10 # Doctor view delivered
    return summary

@router.post("/{session_id}/verify")
async def verify_summary(session_id: str, physician_notes: str = "Verified and accepted for consultation by Dr. Sharma"):
    if session_id not in db_store.sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    session = db_store.sessions[session_id]
    if session_id in db_store.summaries:
        summary = db_store.summaries[session_id]
        summary.physician_verified = True
        summary.physician_notes = physician_notes
        session.demo_stage = 11 # Audit view & complete
        
        db_store.log_audit(
            session_id,
            "Clinical Intake Summary signed off",
            "Dr. Sharma (Consulting Physician)",
            "CLINICIAN_CONFIRMED",
            f"Notes: {physician_notes}"
        )
        return {
            "message": "Clinical summary verified by physician",
            "session_id": session_id,
            "physician_verified": True,
            "demo_stage": 11
        }
    raise HTTPException(status_code=404, detail="Summary not generated yet")
