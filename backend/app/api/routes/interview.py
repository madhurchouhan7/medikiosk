from fastapi import APIRouter, HTTPException
from app.models.schemas import ResponsePayload, InterviewTurnResult, AssistanceTask
from app.db.memory_store import db_store
from app.services.interview.adaptive_engine import AdaptiveInterviewEngine
from app.services.ai.provider import get_llm_provider
from app.services.speech.provider import get_stt_provider
from app.core.confidence import AssistanceScoreEngine

router = APIRouter(prefix="/interview", tags=["Interview"])

@router.get("/start/{session_id}")
async def start_interview(session_id: str):
    if session_id not in db_store.sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    session = db_store.sessions[session_id]
    session.status = "IN_INTERVIEW"
    session.current_step = "interview"
    session.demo_stage = 3

    first_question = AdaptiveInterviewEngine.get_first_question()
    db_store.log_audit(session_id, "AI Interview started", "AI Intake Engine", "AI_EXTRACTED", f"First question: {first_question.question_id}")
    return {
        "session_id": session_id,
        "question": first_question,
        "demo_stage": session.demo_stage,
        "assistance_score": session.assistance_score
    }

@router.post("/respond", response_model=InterviewTurnResult)
async def respond_to_question(payload: ResponsePayload):
    session_id = payload.session_id
    if session_id not in db_store.sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    session = db_store.sessions[session_id]
    transcription = payload.answer_text
    stt_conf = 0.95

    # Check for speech audio
    if payload.audio_base64:
        stt_provider = get_stt_provider()
        stt_res = await stt_provider.transcribe(payload.audio_base64, session.language)
        transcription = stt_res["transcript"]
        stt_conf = stt_res["confidence"]

    # AI Turn processing
    llm_provider = get_llm_provider()
    history = db_store.responses.get(session_id, [])
    turn_res = await llm_provider.process_turn(payload.category, transcription, history)

    # Check if this input indicates speech difficulty or repeated skips
    is_speech_failure = "muffled" in transcription.lower() or stt_conf < 0.65
    is_repeated_skip = "skip" in transcription.lower() and len(history) > 1

    # Check safety flag for acute chest pain
    is_chest_pain = any(term in transcription.lower() for term in ["chest pain", "seene mein dard", "heart pain"])

    # Calculate Assistance Score & Exception Classification
    assistance_score, exception_cat = AssistanceScoreEngine.calculate_score(
        stt_confidence=0.48 if is_speech_failure else stt_conf,
        ocr_confidence=1.0,
        completeness=0.5 if turn_res["is_unknown"] or is_repeated_skip else 1.0,
        has_safety_flag=is_chest_pain
    )
    session.assistance_score = assistance_score

    # Save turn with provenance
    turn_record = {
        "question_id": payload.question_id,
        "category": payload.category,
        "answer_text": transcription,
        "is_unknown": turn_res["is_unknown"],
        "provenance": "PATIENT_REPORTED"
    }
    db_store.responses[session_id].append(turn_record)

    db_store.log_audit(
        session_id,
        f"Captured {payload.category}",
        "AI Intake Engine",
        "PATIENT_REPORTED",
        f"Text: '{transcription}' · Assistance Score: {int(assistance_score*100)}%"
    )

    # If an exception is detected, route to task queue
    if exception_cat:
        tier = "TIER_1_OPD_FLOOR" if exception_cat in ["LOW_SPEECH_CONFIDENCE", "INTERACTION_FAILURE", "RULE_BASED_SAFETY_FLAG", "PATIENT_REQUEST"] else "TIER_2_REMOTE_HUB"
        priority = "URGENT" if exception_cat == "RULE_BASED_SAFETY_FLAG" else "HIGH" if exception_cat == "LOW_SPEECH_CONFIDENCE" else "MEDIUM"
        
        reason = (
            "CLINICAL RED FLAG: Chest pain detected. Requires immediate clinical triage." if is_chest_pain else
            "Speech recognition failed to achieve reliable transcription." if is_speech_failure else
            "Patient unable to answer required intake questions." if is_repeated_skip else
            f"Automated intake exception: {exception_cat}"
        )

        task = AssistanceTask(
            session_id=session_id,
            patient_name=session.patient.name,
            exception_category=exception_cat,
            tier=tier,
            reason=reason,
            priority=priority,
            status="PENDING",
            assistance_score=assistance_score,
            failed_step="VOICE_INTERVIEW"
        )
        db_store.assistance_tasks[task.id] = task
        session.status = "NEED_ASSISTANCE"
        db_store.log_audit(session_id, f"Exception escalated: {exception_cat}", "Task Router", "SYSTEM_AUDIT", f"Assigned to {tier}")

    next_q = AdaptiveInterviewEngine.get_next_question(payload.question_id)
    if next_q is None:
        session.demo_stage = 4 # Ready for document scan

    return InterviewTurnResult(
        session_id=session_id,
        transcription=transcription,
        stt_confidence=stt_conf,
        is_unknown=turn_res["is_unknown"],
        assistance_score=assistance_score,
        detected_entities=turn_res["evidence_items"],
        next_question=next_q,
        is_interview_complete=(next_q is None)
    )
