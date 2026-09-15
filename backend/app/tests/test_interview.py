import pytest
import asyncio
from app.services.interview.adaptive_engine import AdaptiveInterviewEngine
from app.services.ai.provider import MockLLMProvider
from app.services.ocr.provider import MockOCRProvider
from app.services.red_flags.evaluator import RedFlagEvaluator
from app.services.summary.generator import ClinicalSummaryGenerator
from app.models.schemas import Patient

@pytest.mark.asyncio
async def test_adaptive_question_flow():
    q1 = AdaptiveInterviewEngine.get_first_question()
    assert q1.question_id == "q_chief_complaint"

    q2 = AdaptiveInterviewEngine.get_next_question("q_chief_complaint")
    assert q2.question_id == "q_hpi_onset"

@pytest.mark.asyncio
async def test_unknown_response_handling():
    llm = MockLLMProvider()
    res = await llm.process_turn("MEDICATIONS", "I don't remember which medicine I take", [])
    assert res["is_unknown"] is True
    assert len(res["evidence_items"]) == 0

@pytest.mark.asyncio
async def test_ocr_low_confidence_trigger():
    ocr = MockOCRProvider()
    res = await ocr.process_document("session-123", "PRESCRIPTION", "handwritten_prescription.jpg")
    assert res.requires_verification is True
    assert res.overall_confidence < 0.65
    assert len(res.entities) > 0

@pytest.mark.asyncio
async def test_red_flag_chest_pain_alert():
    alerts = RedFlagEvaluator.evaluate("I have severe chest pain since morning", "None")
    assert len(alerts) > 0
    urgent_alerts = [a for a in alerts if a.severity == "URGENT"]
    assert len(urgent_alerts) == 1
    assert "Chest Pain" in urgent_alerts[0].symptom

@pytest.mark.asyncio
async def test_hallucination_prevention_on_unknown():
    patient = Patient(name="Test Patient", age=30, gender="Female")
    responses = [
        {"category": "CHIEF_COMPLAINT", "answer_text": "Knee pain", "is_unknown": False},
        {"category": "MEDICATIONS", "answer_text": "Don't remember", "is_unknown": True}
    ]
    summary = ClinicalSummaryGenerator.generate("session-xyz", patient, responses, [])

    # Verify that unknown info is explicitly listed as uncertain and no dummy medication is invented
    assert "MEDICATIONS: Patient reported UNKNOWN / unable to specify" in summary.missing_or_uncertain_info
    assert len(summary.medications) == 0
