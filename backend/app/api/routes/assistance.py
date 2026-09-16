from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel
from app.models.schemas import AssistanceTask, TaskVerifyPayload
from app.db.memory_store import db_store

router = APIRouter(prefix="/assistance", tags=["Assistance"])

class HelpRequest(BaseModel):
    session_id: str

@router.post("/help", response_model=AssistanceTask)
async def request_help(payload: HelpRequest):
    """Patient pressed 'Need help' at the kiosk. Creates a Tier 1 task —
    never a document/OCR entity."""
    session_id = payload.session_id
    if session_id not in db_store.sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    session = db_store.sessions[session_id]
    session.assistance_score = 0.0
    session.status = "NEED_ASSISTANCE"
    for task in db_store.assistance_tasks.values():
        if (task.session_id == session_id
                and task.exception_category == "PATIENT_REQUEST"
                and task.status == "PENDING"):
            db_store.save()
            return task
    task = AssistanceTask(
        session_id=session_id,
        patient_name=session.patient.name,
        exception_category="PATIENT_REQUEST",
        tier="TIER_1_OPD_FLOOR",
        reason="Patient requested staff assistance at the kiosk",
        priority="HIGH",
        status="PENDING",
        assistance_score=0.0,
        failed_step="KIOSK_HELP_REQUEST",
        entities=[],
    )
    db_store.assistance_tasks[task.id] = task
    db_store.log_audit(session_id, "Patient requested staff help", "Patient Kiosk", "PATIENT_REPORTED", "Tier 1 navigator dispatched to kiosk")
    db_store.save()
    return task

@router.get("/tasks", response_model=List[AssistanceTask])
async def list_assistance_tasks(tier: Optional[str] = Query(None)):
    all_tasks = list(db_store.assistance_tasks.values())
    if tier:
        return [t for t in all_tasks if t.tier == tier]
    return all_tasks

@router.post("/tasks/{task_id}/verify")
async def verify_task(task_id: str, payload: TaskVerifyPayload):
    if task_id not in db_store.assistance_tasks:
        raise HTTPException(status_code=404, detail="Task not found")

    task = db_store.assistance_tasks[task_id]
    session_id = task.session_id

    # Update extracted entities with verified corrections and HUMAN_VERIFIED provenance.
    # Corrections referencing unknown ids are manual transcriptions from the
    # stored scan — they are CREATED as human-verified, never merged silently.
    from app.models.schemas import ExtractedEntity
    if session_id not in db_store.documents:
        db_store.documents[session_id] = []
    matched_ids = set()
    for entity in db_store.documents[session_id]:
        for corr in payload.corrections:
            if entity.id == corr.entity_id:
                entity.entity_name = corr.corrected_name
                if corr.corrected_dosage:
                    entity.dosage = corr.corrected_dosage
                if corr.corrected_frequency:
                    entity.frequency = corr.corrected_frequency
                entity.confidence = 1.0
                entity.provenance = "HUMAN_VERIFIED"
                entity.verified = True
                entity.verified_by = payload.navigator_name
                entity.verified_at = datetime.utcnow()
                matched_ids.add(corr.entity_id)
    for corr in payload.corrections:
        if corr.entity_id not in matched_ids and corr.corrected_name.strip():
            db_store.documents[session_id].append(ExtractedEntity(
                session_id=session_id,
                category="MEDICATION",
                entity_name=corr.corrected_name.strip(),
                dosage=corr.corrected_dosage or "UNKNOWN",
                frequency=corr.corrected_frequency or "Frequency not stated",
                confidence=1.0,
                provenance="HUMAN_VERIFIED",
                source_ref=f"manual-transcription:{task_id}",
                verified=True,
                verified_by=payload.navigator_name,
                verified_at=datetime.utcnow(),
            ))

    task.status = "RESOLVED"
    
    # Restore session assistance score and advance demo stage
    if session_id in db_store.sessions:
        db_store.sessions[session_id].assistance_score = 1.0
        db_store.sessions[session_id].status = "ACTIVE"
        db_store.sessions[session_id].demo_stage = 9 # Verification complete, routed to doctor

    db_store.log_audit(
        session_id,
        f"Exception resolved by {payload.navigator_name}",
        payload.navigator_name,
        "HUMAN_VERIFIED",
        f"Corrected entities: {[c.corrected_name for c in payload.corrections]}"
    )
    db_store.save()

    return {
        "message": "Assistance task verified and resolved successfully",
        "task_id": task_id,
        "new_assistance_score": 1.0,
        "demo_stage": 9
    }

@router.post("/tasks/{task_id}/escalate")
async def escalate_task(task_id: str, note: str = "Escalated to attending clinician"):
    if task_id not in db_store.assistance_tasks:
        raise HTTPException(status_code=404, detail="Task not found")

    task = db_store.assistance_tasks[task_id]
    task.priority = "URGENT"
    task.reason = f"[ESCALATED] {task.reason} — {note}"
    
    db_store.log_audit(
        task.session_id,
        "Task escalated to urgent priority",
        "Floor Navigator",
        "SYSTEM_AUDIT",
        note
    )
    db_store.save()
    return {"message": "Task escalated", "task_id": task_id, "priority": "URGENT"}
