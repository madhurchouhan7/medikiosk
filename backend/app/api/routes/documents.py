from fastapi import APIRouter, HTTPException, Form
from app.models.schemas import DocumentProcessResult, AssistanceTask
from app.db.memory_store import db_store
from app.services.ocr.provider import get_ocr_provider
from app.core.confidence import AssistanceScoreEngine
from app.config import settings

router = APIRouter(prefix="/documents", tags=["Documents"])

@router.post("/process", response_model=DocumentProcessResult)
async def process_document(
    session_id: str = Form(...),
    doc_type: str = Form("PRESCRIPTION"),
    file_name: str = Form("prescription_scan.jpg")
):
    if session_id not in db_store.sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    session = db_store.sessions[session_id]
    session.current_step = "documents"
    session.demo_stage = 4

    ocr_provider = get_ocr_provider()
    result = await ocr_provider.process_document(session_id, doc_type, file_name)

    # Store extracted entities with AI_EXTRACTED provenance
    for e in result.entities:
        e.provenance = "AI_EXTRACTED"
    db_store.documents[session_id] = result.entities

    # Calculate Assistance Score & Exception Classification
    assistance_score, exception_cat = AssistanceScoreEngine.calculate_score(
        ocr_confidence=result.overall_confidence
    )
    result.assistance_score = assistance_score
    result.exception_type = exception_cat
    session.assistance_score = assistance_score

    db_store.log_audit(
        session_id,
        f"Document OCR processed: {file_name}",
        "OCR Engine",
        "AI_EXTRACTED",
        f"Overall Conf: {int(result.overall_confidence*100)}% · Assistance Score: {int(assistance_score*100)}%"
    )

    # If low confidence or explicitly requires verification, route to Tier 2 Remote Hub
    if result.requires_verification or assistance_score < settings.LOW_CONFIDENCE_THRESHOLD:
        session.demo_stage = 6 # Simulated low-confidence case (AI detects uncertainty)
        task = AssistanceTask(
            session_id=session_id,
            patient_name=session.patient.name,
            exception_category="LOW_OCR_CONFIDENCE",
            tier="TIER_2_REMOTE_HUB",
            reason="Low OCR confidence / unreadable prescription text (dosage ambiguous)",
            priority="HIGH",
            status="PENDING",
            assistance_score=assistance_score,
            failed_step="DOCUMENT_OCR_EXTRACTION",
            entities=result.entities
        )
        db_store.assistance_tasks[task.id] = task
        session.status = "NEED_ASSISTANCE"
        db_store.log_audit(
            session_id,
            "Exception routed: LOW_OCR_CONFIDENCE",
            "Task Router",
            "SYSTEM_AUDIT",
            "Assigned to Tier 2 Remote Documentation Reviewer Hub"
        )
    else:
        session.demo_stage = 5 # Normal case - proceeds automatically

    return result
