from fastapi import APIRouter, HTTPException
from app.models.schemas import ClinicalSummary
from app.db.memory_store import db_store
from app.services.summary.generator import ClinicalSummaryGenerator

router = APIRouter(prefix="/summaries", tags=["Summaries"])

@router.get("", response_model=list)
async def list_summaries():
    """List all available summaries — used by Doctor dashboard patient queue."""
    result = []
    for session_id, summary in db_store.summaries.items():
        session = db_store.sessions.get(session_id)
        result.append({
            "session_id": session_id,
            "patient_name": summary.patient.name,
            "patient_id": summary.patient.id,
            "abha_id": summary.patient.abha_id,
            "age": summary.patient.age,
            "gender": summary.patient.gender,
            "chief_complaint": summary.chief_complaint,
            "status": session.status if session else "UNKNOWN",
            "assistance_score": session.assistance_score if session else 1.0,
            "physician_verified": summary.physician_verified,
            "started_at": session.started_at.isoformat() if session else None,
        })
    return sorted(result, key=lambda x: x["started_at"] or "", reverse=True)

@router.get("/{session_id}", response_model=ClinicalSummary)
async def get_summary(session_id: str):
    if session_id not in db_store.sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    session = db_store.sessions[session_id]
    responses = db_store.responses.get(session_id, [])
    meds = db_store.documents.get(session_id, [])

    summary = ClinicalSummaryGenerator.generate(session_id, session.patient, responses, meds)
    db_store.summaries[session_id] = summary
    session.demo_stage = 10
    return summary

@router.post("/{session_id}/verify")
async def verify_summary(session_id: str, physician_notes: str = "Verified and accepted for consultation"):
    if session_id not in db_store.sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    session = db_store.sessions[session_id]
    if session_id in db_store.summaries:
        summary = db_store.summaries[session_id]
        summary.physician_verified = True
        summary.physician_notes = physician_notes
        session.demo_stage = 11

        db_store.log_audit(
            session_id,
            "Clinical Intake Summary signed off",
            "Consulting Physician",
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
