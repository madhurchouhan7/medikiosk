# Red Flag Evaluation Rules

Evaluate patient interview responses and extracted symptoms against deterministic red-flag rules:
- `URGENT`: Chest pain, acute shortness of breath, severe sudden headache, loss of consciousness, stroke-like symptoms, high fever with stiff neck.
- `ATTENTION`: Uncontrolled high blood pressure (>160/100), blood in stool/sputum, persistent vomiting, high blood sugar, joint swelling with severe pain.
- `NORMAL`: Standard mild or chronic non-acute symptoms.

Return structured alert payload: `{ "level": "URGENT" | "ATTENTION" | "NORMAL", "reason": "...", "action": "Priority review recommended" }`
