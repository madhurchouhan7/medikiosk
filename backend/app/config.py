import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "MediKiosk"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"

    # AI Provider Modes: MOCK, OLLAMA, SARVAM, CLOUD
    LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", "MOCK")
    STT_PROVIDER: str = os.getenv("STT_PROVIDER", "MOCK")
    OCR_PROVIDER: str = os.getenv("OCR_PROVIDER", "MOCK")

    # Thresholds
    HIGH_CONFIDENCE_THRESHOLD: float = 0.85
    LOW_CONFIDENCE_THRESHOLD: float = 0.65

    class Config:
        case_sensitive = True

settings = Settings()
