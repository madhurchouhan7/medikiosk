from abc import ABC, abstractmethod
from typing import Dict, Any, List
from app.models.schemas import EvidenceItem

class BaseLLMProvider(ABC):
    @abstractmethod
    async def process_turn(self, category: str, answer_text: str, history: List[Dict[str, Any]]) -> Dict[str, Any]:
        pass

class MockLLMProvider(BaseLLMProvider):
    async def process_turn(self, category: str, answer_text: str, history: List[Dict[str, Any]]) -> Dict[str, Any]:
        cleaned = answer_text.strip().lower()

        # Check for unknown / don't know responses
        is_unknown = any(phrase in cleaned for phrase in ["don't know", "dont know", "don't remember", "dont remember", "maloom nahi", "pata nahi", "yaad nahi"])

        evidence_items = []

        if category == "CHIEF_COMPLAINT":
            if "knee" in cleaned or "ghutne" in cleaned:
                evidence_items.append(EvidenceItem(
                    value="Right/Left Knee Pain",
                    source="Patient Voice Response",
                    confidence=0.96
                ))
            elif "chest" in cleaned or "seene" in cleaned:
                evidence_items.append(EvidenceItem(
                    value="Acute Chest Pain",
                    source="Patient Voice Response",
                    confidence=0.95
                ))

        elif category == "PAST_HISTORY":
            if "bp" in cleaned or "hypertension" in cleaned or "high blood pressure" in cleaned:
                evidence_items.append(EvidenceItem(
                    value="Hypertension (High BP)",
                    source="Patient Voice Response",
                    confidence=0.98
                ))
            elif "sugar" in cleaned or "diabetes" in cleaned:
                evidence_items.append(EvidenceItem(
                    value="Type 2 Diabetes Mellitus",
                    source="Patient Voice Response",
                    confidence=0.97
                ))

        return {
            "is_unknown": is_unknown,
            "evidence_items": evidence_items
        }

def get_llm_provider() -> BaseLLMProvider:
    return MockLLMProvider()
