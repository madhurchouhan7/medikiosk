from fastapi import APIRouter
from app.config import settings

router = APIRouter(prefix="/health", tags=["Health"])

@router.api_route("", methods=["GET", "HEAD"])
async def get_health():
    return {
        "status": "HEALTHY",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "providers": {
            "llm": settings.LLM_PROVIDER,
            "stt": settings.STT_PROVIDER,
            "ocr": settings.OCR_PROVIDER,
            "local_mode": True
        }
    }
