# Adaptive Interview Prompt Instructions

Given the current session history and patient response:
1. Identify the active category in the clinical framework:
   - Chief Complaint
   - History of Presenting Illness (HPI)
   - Past Medical / Surgical History
   - Current Medications
   - Allergies
   - Review of Systems (ROS)
2. Determine if the last patient answer was ambiguous or incomplete.
3. Formulate the next single question in patient-friendly language.
4. If patient states "I don't remember" or "I don't know", mark entity as `UNKNOWN` and proceed.
