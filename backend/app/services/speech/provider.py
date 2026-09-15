from abc import ABC, abstractmethod
from typing import Dict, Any

class BaseSTTProvider(ABC):
    @abstractmethod
    async def transcribe(self, audio_base64: str, language: str) -> Dict[str, Any]:
        pass

class MockSTTProvider(BaseSTTProvider):
    async def transcribe(self, audio_base64: str, language: str) -> Dict[str, Any]:
        # Simulated speech recognition with high confidence score
        return {
            "transcript": "Ghutne mein dard hai aur High BP ki bimari hai.",
            "confidence": 0.94,
            "language": language
        }

def get_stt_provider() -> BaseSTTProvider:
    return MockSTTProvider()
