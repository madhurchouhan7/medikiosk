from typing import List
from app.models.schemas import RedFlagAlert

class RedFlagEvaluator:
    @staticmethod
    def evaluate(symptoms_text: str, past_history: str) -> List[RedFlagAlert]:
        alerts = []
        text_lower = (symptoms_text + " " + past_history).lower()

        # URGENT Check
        if any(term in text_lower for term in ["chest pain", "seene mein dard", "shortness of breath", "difficulty breathing", "heart pain"]):
            alerts.append(RedFlagAlert(
                severity="URGENT",
                symptom="Acute Chest Pain / Respiratory Distress",
                message="Potential cardiac/respiratory emergency detected.",
                action_required="Immediate priority clinician evaluation recommended before standard queue."
            ))

        # ATTENTION Check
        if any(term in text_lower for term in ["hypertension", "high bp", "bp hai", "high blood pressure"]):
            alerts.append(RedFlagAlert(
                severity="ATTENTION",
                symptom="History of Hypertension",
                message="Co-existing chronic cardiovascular risk factor reported.",
                action_required="Check baseline blood pressure prior to physician consultation."
            ))

        if not alerts:
            alerts.append(RedFlagAlert(
                severity="NORMAL",
                symptom="Routine Triage",
                message="No immediate critical red flags detected during automated intake.",
                action_required="Standard consultation queue."
            ))

        return alerts
