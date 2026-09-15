from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from datetime import datetime
from app.models.schemas import AssistanceTask, TaskVerifyPayload
from app.db.memory_store import db_store

router = APIRouter(prefix="/assistance", tags=["Assistance"])

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

    # Update extracted entities with verified corrections and HUMAN_VERIFIED provenance
    if session_id in db_store.documents:
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
    return {"message": "Task escalated", "task_id": task_id, "priority": "URGENT"}
