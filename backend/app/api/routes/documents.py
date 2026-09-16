import os
from fastapi import APIRouter, HTTPException, Form, UploadFile, File
from fastapi.responses import FileResponse
from typing import Optional
from app.models.schemas import DocumentProcessResult, AssistanceTask
from app.db.memory_store import db_store
from app.services.ocr.provider import get_ocr_provider, validate_upload, UPLOAD_ROOT
from app.core.confidence import AssistanceScoreEngine
from app.config import settings

router = APIRouter(prefix="/documents", tags=["Documents"])

@router.post("/process", response_model=DocumentProcessResult)
async def process_document(
    session_id: str = Form(...),
    doc_type: str = Form("PRESCRIPTION"),
    file_name: str = Form("prescription_scan.jpg"),
    file: Optional[UploadFile] = File(None),
    idempotency_key: Optional[str] = Form(None),
):
    if session_id not in db_store.sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    # Idempotent retry: a re-sent upload with the same key returns the
    # already-stored outcome instead of duplicating entities/tasks.
    if idempotency_key:
        for meta in db_store.document_files.values():
            if meta.get("idempotency_key") == idempotency_key and meta.get("session_id") == session_id:
                entities = [e for e in db_store.documents.get(session_id, [])
                            if e.source_ref.startswith(f"upload:{meta['stored_rel']}")]
                return DocumentProcessResult(
                    document_id=meta["doc_id"],
                    session_id=session_id,
                    raw_text=meta.get("raw_text", ""),
                    overall_confidence=meta.get("overall_confidence", 0.0),
                    assistance_score=meta.get("assistance_score", 0.0),
                    entities=entities,
                    requires_verification=meta.get("requires_verification", True),
                    exception_type=meta.get("exception_type"),
                )

    session = db_store.sessions[session_id]
    session.current_step = "documents"
    session.demo_stage = 4

    file_bytes: Optional[bytes] = None
    if file and file.filename:
        file_bytes = await file.read()
        file_name = file.filename

    validate_upload(file_name, file_bytes)
    assert file_bytes is not None

    ocr_provider = get_ocr_provider()
    result = await ocr_provider.process_document(session_id, doc_type, file_name, file_bytes)

    for e in result.entities:
        e.provenance = "AI_EXTRACTED"
    # Replace only entities sourced from this document, keep others.
    kept = [e for e in db_store.documents.get(session_id, [])
            if not e.source_ref.startswith("upload:")]
    db_store.documents[session_id] = kept + result.entities

    # Remember the stored file so the navigator can view the original.
    stored_rel = ""
    if result.entities:
        src = result.entities[0].source_ref
        if src.startswith("upload:"):
            stored_rel = src[len("upload:"):].split("#doc=")[0]
    else:
        # No entities (engine missing / unreadable): the provider still
        # persisted the bytes — locate the newest file for this session.
        sess_dir = os.path.abspath(os.path.join(UPLOAD_ROOT, session_id))
        if os.path.isdir(sess_dir):
            files = sorted(os.listdir(sess_dir))
            if files:
                stored_rel = os.path.join(session_id, files[-1])
    db_store.document_files[result.document_id] = {
        "doc_id": result.document_id,
        "session_id": session_id,
        "file_name": file_name,
        "stored_rel": stored_rel,
        "doc_type": doc_type,
        "raw_text": result.raw_text,
        "overall_confidence": result.overall_confidence,
        "assistance_score": result.assistance_score,
        "requires_verification": result.requires_verification,
        "exception_type": result.exception_type,
        "idempotency_key": idempotency_key,
    }

    assistance_score, exception_cat = AssistanceScoreEngine.calculate_score(
        ocr_confidence=result.overall_confidence
    )
    result.assistance_score = assistance_score
    result.exception_type = exception_cat or result.exception_type
    session.assistance_score = assistance_score
    db_store.document_files[result.document_id]["assistance_score"] = assistance_score
    db_store.document_files[result.document_id]["exception_type"] = result.exception_type

    if result.entities:
        names = ", ".join(f"{e.entity_name} {e.dosage or 'UNKNOWN'}" for e in result.entities)
        detail = f"Extracted: {names} · Overall Conf: {int(result.overall_confidence*100)}%"
    else:
        detail = "No machine-readable text — routed for manual transcription from the stored image."
    db_store.log_audit(session_id, f"Document processed: {file_name}", "OCR Engine", "AI_EXTRACTED", detail)

    if result.requires_verification or assistance_score < settings.LOW_CONFIDENCE_THRESHOLD:
        session.demo_stage = 6
        task = AssistanceTask(
            session_id=session_id,
            patient_name=session.patient.name,
            exception_category="LOW_OCR_CONFIDENCE",
            tier="TIER_2_REMOTE_HUB",
            reason=("No readable text — transcribe medicines from the stored scan"
                    if not result.entities else
                    "Low OCR confidence / unreadable prescription text (dosage ambiguous)"),
            priority="HIGH",
            status="PENDING",
            assistance_score=assistance_score,
            failed_step="DOCUMENT_OCR_EXTRACTION",
            entities=result.entities,
        )
        db_store.assistance_tasks[task.id] = task
        session.status = "NEED_ASSISTANCE"
        db_store.log_audit(session_id, "Exception routed: LOW_OCR_CONFIDENCE", "Task Router", "SYSTEM_AUDIT",
                           "Assigned to Tier 2 Remote Documentation Reviewer Hub")
    else:
        session.demo_stage = 5

    db_store.save()
    return result


@router.get("/file/{doc_id}")
async def get_document_file(doc_id: str):
    """Serve the stored original scan so the navigator verifies against the
    real document, not a description of it."""
    meta = db_store.document_files.get(doc_id)
    if not meta or not meta.get("stored_rel"):
        raise HTTPException(status_code=404, detail="Document file not found")
    path = os.path.abspath(os.path.join(UPLOAD_ROOT, meta["stored_rel"]))
    if not path.startswith(os.path.abspath(UPLOAD_ROOT)) or not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="Document file not found")
    return FileResponse(path)
