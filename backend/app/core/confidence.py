from app.models.schemas import ExceptionCategory

class AssistanceScoreEngine:
    @staticmethod
    def calculate_score(
        stt_confidence: float = 1.0,
        ocr_confidence: float = 1.0,
        completeness: float = 1.0,
        user_requested_help: bool = False,
        has_safety_flag: bool = False
    ) -> tuple[float, ExceptionCategory | None]:
        """
        Calculates the Niramaya Assistance Score (0.0 to 1.0).
        Higher score = high automation reliability.
        Lower score (<0.65) = triggers escalation task to Navigator.
        """
        if user_requested_help:
            return 0.0, "PATIENT_REQUEST"

        if has_safety_flag:
            return 0.3, "RULE_BASED_SAFETY_FLAG"

        if stt_confidence < 0.7:
            score = round(stt_confidence * 0.8, 2)
            return score, "LOW_SPEECH_CONFIDENCE"

        if ocr_confidence < 0.65:
            score = round(ocr_confidence * 0.85, 2)
            return score, "LOW_OCR_CONFIDENCE"

        if completeness < 0.7:
            score = round(completeness * 0.85, 2)
            return score, "INCOMPLETE_ANSWERS"

        score = round((0.4 * ocr_confidence) + (0.4 * stt_confidence) + (0.2 * completeness), 2)
        return score, None
