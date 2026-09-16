import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Niramaya"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"

    # Provider Modes: LLM/STT rule-based locally; OCR uses Tesseract when
    # the binary is present, otherwise stores scans for human transcription.
    LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", "MOCK")
    STT_PROVIDER: str = os.getenv("STT_PROVIDER", "MOCK")
    OCR_PROVIDER: str = os.getenv("OCR_PROVIDER", "TESSERACT")

    # Thresholds
    HIGH_CONFIDENCE_THRESHOLD: float = 0.85
    LOW_CONFIDENCE_THRESHOLD: float = 0.65

    class Config:
        case_sensitive = True

settings = Settings()
