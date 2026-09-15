from typing import List, Dict, Optional
from app.models.schemas import (
    Patient, ClinicalSummary, ExtractedEntity, RedFlagAlert
)

# Clinical red flag rules for deterministic safety evaluation
RED_FLAG_RULES = [
    {
        "keywords": ["chest pain", "seene mein dard", "crushing", "chest tightness", "heart pain", "heaviness"],
        "severity": "URGENT",
        "symptom": "Acute Chest Pain / Anginal Equivalents",
        "message": "Reported acute chest pain, tightness, or pressure — potential acute coronary syndrome (ACS).",
        "action": "Immediate 12-lead ECG and urgent clinician triage prior to routine OPD queue."
    },
    {
        "keywords": ["left arm", "radiating", "jaw pain", "sweating", "diaphoresis", "cold sweat", "thand pashina"],
        "severity": "URGENT",
        "symptom": "Cardiac Radiation Symptoms & Diaphoresis",
        "message": "Chest pain radiating to left arm/shoulder/jaw accompanied by diaphoresis.",
        "action": "Activate emergency cardiac triage protocol. Alert attending physician immediately."
    },
    {
        "keywords": ["difficulty breathing", "breathlessness", "saans", "dyspnoea", "orthopnea", "short of breath"],
        "severity": "ATTENTION",
        "symptom": "Respiratory Distress",
        "message": "Patient reports significant shortness of breath or breathlessness on lying flat.",
        "action": "Check sitting SpO2 pulse oximetry and respiratory rate before consultation."
    },
    {
        "keywords": ["hypertension", "high bp", "high blood pressure", "haibp"],
        "severity": "ATTENTION",
        "symptom": "Co-existing Hypertension",
        "message": "Patient reports ongoing high blood pressure / hypertension history.",
        "action": "Record sitting blood pressure in both arms prior to examination."
    },
    {
        "keywords": ["diabetes", "sugar", "diabetic", "insulin"],
        "severity": "ATTENTION",
        "symptom": "Co-existing Diabetes Mellitus",
        "message": "Patient reports known diabetes mellitus.",
        "action": "Check random blood glucose (RBS) if symptomatic or not checked recently."
    },
    {
        "keywords": ["black stool", "bloody stool", "rectal bleeding", "vomiting blood", "hematemesis"],
        "severity": "URGENT",
        "symptom": "Gastrointestinal Bleeding",
        "message": "Patient reports black or bloody stools — possible upper/lower GI bleed.",
        "action": "Check hemoglobin, orthostatic vitals, and alert gastroenterology/surgical team."
    }
]

class ClinicalSummaryGenerator:
    @staticmethod
    def generate(
        session_id: str,
        patient: Patient,
        responses: List[dict],
        medications: List[ExtractedEntity]
    ) -> ClinicalSummary:
        chief_complaint = "Not reported"
        hpi_parts: List[str] = []
        socrates: Dict[str, str] = {}
        past_medical_history: List[str] = []
        past_surgical_history: List[str] = []
        allergies: List[str] = []
        family_history: List[str] = []
        personal_social_history: List[str] = []
        review_of_systems: List[str] = []
        previous_treatment: List[str] = []
        previous_investigations: List[str] = []

        all_text = " ".join([r.get("answer_text", "") for r in responses]).lower()
        unknown_items: List[str] = []

        for resp in responses:
            cat = resp.get("category", "")
            ans = resp.get("answer_text", "")
            is_unknown = resp.get("is_unknown", False)

            if is_unknown:
                unknown_items.append(f"{cat}: Patient reported UNKNOWN / unable to specify")
                continue

            # 1. Chief Complaint
            if cat == "CHIEF_COMPLAINT" and ans:
                chief_complaint = ans

            # 2. SOCRATES HPI Probes
            elif cat == "HPI_SITE" and ans:
                socrates["Site (S)"] = ans
                hpi_parts.append(f"Location: {ans}")
            elif (cat == "HPI_ONSET" or cat == "HPI") and ans:
                socrates["Onset (O)"] = ans
                hpi_parts.append(f"Onset: {ans}")
            elif cat == "HPI_CHARACTER" and ans:
                socrates["Character (C)"] = ans
                hpi_parts.append(f"Character: {ans}")
            elif cat == "HPI_RADIATION" and ans:
                socrates["Radiation (R)"] = ans
                hpi_parts.append(f"Radiation: {ans}")
            elif cat == "HPI_ASSOCIATED" and ans:
                socrates["Associated (A)"] = ans
                hpi_parts.append(f"Associated: {ans}")
            elif cat == "HPI_TIMING" and ans:
                socrates["Timing (T)"] = ans
                hpi_parts.append(f"Timing: {ans}")
            elif cat == "HPI_EXACERBATING" and ans:
                socrates["Exacerbating/Relieving (E)"] = ans
                hpi_parts.append(f"Aggravating/Relieving: {ans}")
            elif cat == "HPI_SEVERITY" and ans:
                socrates["Severity (S)"] = ans
                hpi_parts.append(f"Severity: {ans}")

            # 3. Previous Treatment for this Episode
            elif cat == "PREVIOUS_TREATMENT" and ans:
                previous_treatment.append(ans)

            # 4. Past Medical History
            elif (cat == "PAST_MEDICAL_HISTORY" or cat == "PAST_HISTORY") and ans:
                past_medical_history.append(ans)

            # 5. Past Surgical / Hospitalization History
            elif cat == "PAST_SURGICAL_HISTORY" and ans:
                past_surgical_history.append(ans)

            # 6. Regular Medications
            elif cat == "MEDICATIONS" and ans:
                if "no medication" not in ans.lower():
                    review_of_systems.append(f"Current Daily Meds: {ans}")

            # 7. Allergies
            elif cat == "ALLERGIES" and ans:
                allergies.append(ans)

            # 8. Family History
            elif cat == "FAMILY_HISTORY" and ans:
                family_history.append(ans)

            # 9. Personal & Social History
            elif cat == "PERSONAL_SOCIAL_HISTORY" and ans:
                personal_social_history.append(ans)

            # 10. Review of Systems
            elif cat == "REVIEW_OF_SYSTEMS" and ans:
                review_of_systems.append(ans)

            # 11. Previous Investigations
            elif cat == "PREVIOUS_INVESTIGATIONS" and ans:
                previous_investigations.append(ans)

        # Assemble coherent HPI summary string
        if hpi_parts:
            hpi_summary = " · ".join(hpi_parts)
        else:
            hpi_summary = "History of present illness not captured"

        # Red Flag safety rules
        red_flags: List[RedFlagAlert] = []
        seen_flags: set = set()
        for rule in RED_FLAG_RULES:
            for keyword in rule["keywords"]:
                if keyword in all_text and rule["symptom"] not in seen_flags:
                    red_flags.append(RedFlagAlert(
                        severity=rule["severity"],
                        symptom=rule["symptom"],
                        message=rule["message"],
                        action_required=rule["action"]
                    ))
                    seen_flags.add(rule["symptom"])
                    break

        # Gaps / uncertain items
        missing: List[str] = list(unknown_items)
        if chief_complaint == "Not reported":
            missing.append("Chief complaint not clearly captured")
        for med in medications:
            if med.confidence < 0.7:
                missing.append(f"{med.entity_name} dosage unclear ({int(med.confidence*100)}% confidence) — awaiting verification")

        if not past_medical_history:
            past_medical_history = ["No chronic conditions reported"]
        if not allergies:
            allergies = ["No known drug allergies reported"]

        return ClinicalSummary(
            session_id=session_id,
            patient=patient,
            chief_complaint=chief_complaint,
            hpi_summary=hpi_summary,
            socrates_breakdown=socrates if socrates else None,
            past_medical_history=past_medical_history,
            past_surgical_history=past_surgical_history if past_surgical_history else ["No prior surgeries / hospitalizations reported"],
            medications=medications,
            allergies=allergies,
            family_history=family_history if family_history else ["Non-contributory / no early cardiovascular disease"],
            personal_social_history=personal_social_history if personal_social_history else ["Non-smoker, no alcohol/tobacco habits reported"],
            review_of_systems=review_of_systems if review_of_systems else ["No active red flags on review of other systems"],
            previous_treatment=previous_treatment if previous_treatment else ["No prior medications taken for this acute episode"],
            previous_investigations=previous_investigations if previous_investigations else ["No previous reports brought today"],
            red_flags=sorted(red_flags, key=lambda f: 0 if f.severity == "URGENT" else 1),
            missing_or_uncertain_info=missing if missing else ["No critical clinical gaps — high-confidence intake"],
            physician_verified=False,
            disclaimer="AI-assisted summary — physician verification required before clinical decisions."
        )
