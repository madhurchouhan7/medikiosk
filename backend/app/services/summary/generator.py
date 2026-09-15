from typing import List
from app.models.schemas import ClinicalSummary, Patient, ExtractedEntity
from app.services.red_flags.evaluator import RedFlagEvaluator

class ClinicalSummaryGenerator:
    @staticmethod
    def generate(
        session_id: str,
        patient: Patient,
        responses: List[dict],
        extracted_medications: List[ExtractedEntity]
    ) -> ClinicalSummary:
        chief_complaint = "Not reported"
        hpi = "Standard history collected"
        past_medical = []
        uncertain_info = []

        for r in responses:
            cat = r.get("category")
            answer = r.get("answer_text", "")
            if r.get("is_unknown"):
                uncertain_info.append(f"{cat}: Patient reported UNKNOWN / unable to specify")

            if cat == "CHIEF_COMPLAINT":
                chief_complaint = answer
            elif cat == "HPI":
                hpi = answer
            elif cat == "PAST_HISTORY":
                if answer and not r.get("is_unknown"):
                    past_medical.append(answer)

        # Check red flags
        red_flags = RedFlagEvaluator.evaluate(chief_complaint, " ".join(past_medical))

        return ClinicalSummary(
            session_id=session_id,
            patient=patient,
            chief_complaint=chief_complaint,
            hpi_summary=hpi,
            past_medical_history=past_medical if past_medical else ["None reported"],
            medications=extracted_medications,
            allergies=["No known drug allergies reported"],
            review_of_systems=["Musculoskeletal: Pain reported", "Cardiovascular: Monitored"],
            red_flags=red_flags,
            missing_or_uncertain_info=uncertain_info if uncertain_info else ["None"],
            physician_verified=False
        )
