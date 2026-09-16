from fastapi import APIRouter, HTTPException
from app.models.schemas import ClinicalSummary
from app.db.memory_store import db_store
from app.services.summary.generator import ClinicalSummaryGenerator

router = APIRouter(prefix="/summaries", tags=["Summaries"])

@router.get("", response_model=list)
async def list_summaries():
    """Doctor patient queue — every session appears, not just ones with a
    stored summary. Rows for in-progress sessions are derived live from
    responses so a new kiosk case is never invisible."""
    result = []
    for session_id, session in db_store.sessions.items():
        summary = db_store.summaries.get(session_id)
        if summary is None:
            responses = db_store.responses.get(session_id, [])
            chief = next(
                (r.get("answer_text", "") for r in responses
                 if r.get("category") == "CHIEF_COMPLAINT" and r.get("answer_text")),
                "Intake in progress — no chief complaint yet",
            )
            result.append({
                "session_id": session_id,
                "patient_name": session.patient.name,
                "patient_id": session.patient.id,
                "abha_id": session.patient.abha_id,
                "age": session.patient.age,
                "gender": session.patient.gender,
                "chief_complaint": chief,
                "status": session.status,
                "assistance_score": session.assistance_score,
                "physician_verified": False,
                "started_at": session.started_at.isoformat() if session.started_at else None,
            })
        else:
            result.append({
                "session_id": session_id,
                "patient_name": summary.patient.name,
                "patient_id": summary.patient.id,
                "abha_id": summary.patient.abha_id,
                "age": summary.patient.age,
                "gender": summary.patient.gender,
                "chief_complaint": summary.chief_complaint,
                "status": session.status,
                "assistance_score": session.assistance_score,
                "physician_verified": summary.physician_verified,
                "started_at": session.started_at.isoformat() if session.started_at else None,
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
    db_store.save()
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
        db_store.save()
        return {
            "message": "Clinical summary verified by physician",
            "session_id": session_id,
            "physician_verified": True,
            "demo_stage": 11
        }
    raise HTTPException(status_code=404, detail="Summary not generated yet")
