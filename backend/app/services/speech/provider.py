"""Speech-to-text provider.

Honesty rule: this service NEVER invents a transcript. If no transcription
engine is configured, audio that arrives without a transcript is reported as
untranscribed (confidence 0.0) so the caller routes to touch input or a
navigator — instead of hallucinating "Ghutne mein dard hai".
"""
import base64
from abc import ABC, abstractmethod
from typing import Dict, Any


class BaseSTTProvider(ABC):
    @abstractmethod
    async def transcribe(self, audio_base64: str, language: str) -> Dict[str, Any]:
        pass


class UntranscribedSTTProvider(BaseSTTProvider):
    """Default provider: no local STT engine is bundled with the prototype.

    Real deployments plug in Whisper/Sarvam here behind the same interface.
    Audio shorter than ~1s (or undecodable) is treated as empty input.
    """

    async def transcribe(self, audio_base64: str, language: str) -> Dict[str, Any]:
        try:
            raw = base64.b64decode(audio_base64, validate=True)
        except Exception:
            return {"transcript": "", "confidence": 0.0, "language": language,
                    "reason": "undecodable_audio"}
        if len(raw) < 2000:
            return {"transcript": "", "confidence": 0.0, "language": language,
                    "reason": "empty_audio"}
        return {"transcript": "", "confidence": 0.0, "language": language,
                "reason": "no_stt_engine_configured"}


def get_stt_provider() -> BaseSTTProvider:
    return UntranscribedSTTProvider()
