import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.interview.adaptive_engine import AdaptiveInterviewEngine
from app.services.ai.provider import MockLLMProvider
from app.services.ocr.provider import extract_medication_entities, get_ocr_provider
from app.services.speech.provider import get_stt_provider
from app.services.red_flags.evaluator import RedFlagEvaluator
from app.services.summary.generator import ClinicalSummaryGenerator
from app.models.schemas import Patient


@pytest.mark.asyncio
async def test_adaptive_question_flow():
    q1 = AdaptiveInterviewEngine.get_first_question()
    assert q1.question_id == "q_chief_complaint"

    # SOCRATES Site is the next question following Chief Complaint
    q2 = AdaptiveInterviewEngine.get_next_question("q_chief_complaint")
    assert q2.question_id == "q_hpi_site"

    # Verify specialty domain adaptation: Cardiac complaint routes to cardiac SOCRATES questions
    cardiac_history = [{"category": "CHIEF_COMPLAINT", "answer_text": "Acute chest pain"}]
    q_cardiac_site = AdaptiveInterviewEngine.get_next_question("q_chief_complaint", cardiac_history)
    assert q_cardiac_site.question_id == "q_hpi_site"
    assert "chest" in q_cardiac_site.text["en"].lower()


@pytest.mark.asyncio
async def test_unknown_response_handling():
    llm = MockLLMProvider()
    res = await llm.process_turn("MEDICATIONS", "I don't remember which medicine I take", [])
    assert res["is_unknown"] is True
    assert len(res["evidence_items"]) == 0


@pytest.mark.asyncio
async def test_ocr_extracts_real_text_without_invention():
    # Known text in -> structured entities out, no guessing.
    entities, needs_check = extract_medication_entities(
        "Rx: Amlodipine 5mg OD, Paracetamol 650mg PRN", "s-1", "upload:x#doc=1", 0.9)
    names = {e.entity_name for e in entities}
    assert {"Amlodipine", "Paracetamol"} <= names
    aml = next(e for e in entities if e.entity_name == "Amlodipine")
    assert aml.dosage == "5mg"
    assert needs_check is False

    # Dose absent -> UNKNOWN + verification, never a guessed dose.
    entities2, needs_check2 = extract_medication_entities(
        "Rx: Amlodipine OD", "s-1", "upload:x#doc=1", 0.9)
    assert entities2[0].dosage == "UNKNOWN"
    assert needs_check2 is True

    # No medicine mentioned -> no entities at all.
    entities3, needs_check3 = extract_medication_entities(
        "Patient reports headache since morning", "s-1", "upload:x#doc=1", 0.9)
    assert entities3 == []
    assert needs_check3 is True


@pytest.mark.asyncio
async def test_ocr_provider_never_fabricates_without_engine():
    provider = get_ocr_provider()
    # 1x1 png bytes; with no tesseract installed this must route to human
    # review with ZERO invented medicines.
    png = (b"\x89PNG\r\n\x1a\n" + b"\x00" * 200)
    res = await provider.process_document("s-1", "PRESCRIPTION", "scan.png", png)
    assert res.requires_verification is True
    assert res.entities == []
    assert res.raw_text == ""


@pytest.mark.asyncio
async def test_stt_never_invents_transcript():
    stt = get_stt_provider()
    import base64
    fake_audio = base64.b64encode(b"\x00" * 5000).decode()
    res = await stt.transcribe(fake_audio, "hi")
    assert res["transcript"] == ""
    assert res["confidence"] == 0.0

    res2 = await stt.transcribe(base64.b64encode(b"ab").decode(), "hi")
    assert res2["transcript"] == ""
    assert res2["confidence"] == 0.0


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


def test_full_session_flow_through_real_endpoints():
    """End-to-end through the actual API: session -> interview -> summary
    appears in the doctor queue. Uses an isolated store file."""
    import tempfile, os
    from app.db import memory_store as ms
    from app.api.routes import sessions as r_sessions, interview as r_interview
    from app.api.routes import documents as r_docs, assistance as r_assist, summaries as r_sum

    tmp = tempfile.mkdtemp()
    store = ms.InMemoryStore(data_file=os.path.join(tmp, "store.json"), seed_demo=False)
    for mod in (r_sessions, r_interview, r_docs, r_assist, r_sum):
        mod.db_store = store

    c = TestClient(app)
    try:
        s = c.post("/api/sessions", json={"language": "hi", "patient_name": "E2E Patient",
                                          "patient_age": 40, "patient_gender": "Female"}).json()
        sid = s["id"]
        assert s["patient"]["name"] == "E2E Patient"

        start = c.get(f"/api/interview/start/{sid}").json()
        assert start["question"]["question_id"] == "q_chief_complaint"

        r1 = c.post("/api/interview/respond", json={
            "session_id": sid, "question_id": "q_chief_complaint",
            "category": "CHIEF_COMPLAINT", "answer_text": "Knee pain since two weeks"}).json()
        assert r1["next_question"]["question_id"] == "q_hpi_site"

        # Empty answer -> recorded as unknown, low score, assistance task.
        r2 = c.post("/api/interview/respond", json={
            "session_id": sid, "question_id": "q_hpi_site",
            "category": "HPI_SITE", "answer_text": ""}).json()
        assert r2["is_unknown"] is True
        assert r2["assistance_score"] < 0.65

        tasks = c.get("/api/assistance/tasks").json()
        assert any(t["session_id"] == sid for t in tasks)

        # Help request creates a Tier-1 task, not a document.
        h = c.post("/api/assistance/help", json={"session_id": sid}).json()
        assert h["exception_category"] == "PATIENT_REQUEST"
        assert h["entities"] == []

        # New session is visible in the doctor queue even before sign-off.
        queue = c.get("/api/summaries").json()
        assert any(q["session_id"] == sid for q in queue)

        summ = c.get(f"/api/summaries/{sid}").json()
        assert summ["chief_complaint"] == "Knee pain since two weeks"

        # Persistence: snapshot file exists and reloads the session.
        assert os.path.isfile(os.path.join(tmp, "store.json"))
        store2 = ms.InMemoryStore(data_file=os.path.join(tmp, "store.json"), seed_demo=False)
        assert sid in store2.sessions
        assert store2.sessions[sid].patient.name == "E2E Patient"
    finally:
        for mod in (r_sessions, r_interview, r_docs, r_assist, r_sum):
            mod.db_store = ms.db_store
