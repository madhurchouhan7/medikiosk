"""Document OCR pipeline.

Layered design — real processing at every layer, no fabricated text:

1. File bytes are persisted to disk (data/uploads) so a human can always
   view the original, whatever happens downstream.
2. If a Tesseract engine is available (pytesseract + binary), the image is
   preprocessed with Pillow and actually OCR'd.
3. Whatever text exists (OCR output) is mined for medication entities with
   explicit regex patterns. A medicine named without a readable dose gets
   dosage="UNKNOWN" and is flagged for verification — never guessed.
4. If no OCR engine is available, the result honestly reports
   requires_verification=True with zero invented entities; the navigator
   transcribes from the stored image and the correction becomes the
   HUMAN_VERIFIED record.
"""
import io
import os
import re
import uuid
from abc import ABC, abstractmethod
from typing import List, Optional, Tuple

from app.models.schemas import ExtractedEntity, DocumentProcessResult

# Common Indian prescription medication patterns
MEDICATION_PATTERNS = [
    (r"amlodipine\s*(\d+\s*mg)?", "Amlodipine"),
    (r"metformin\s*(\d+\s*mg)?", "Metformin"),
    (r"atorvastatin\s*(\d+\s*mg)?", "Atorvastatin"),
    (r"paracetamol\s*(\d+\s*mg)?", "Paracetamol"),
    (r"cetirizine\s*(\d+\s*mg)?", "Cetirizine"),
    (r"aspirin\s*(\d+\s*mg)?", "Aspirin"),
    (r"omeprazole\s*(\d+\s*mg)?", "Omeprazole"),
    (r"metoprolol\s*(\d+\s*mg)?", "Metoprolol"),
    (r"losartan\s*(\d+\s*mg)?", "Losartan"),
    (r"glimepiride\s*(\d+\s*mg)?", "Glimepiride"),
    (r"telmisartan\s*(\d+\s*mg)?", "Telmisartan"),
    (r"diclofenac\s*(\d+\s*mg)?", "Diclofenac"),
    (r"ecosprin\s*(\d+\s*mg)?", "Ecosprin"),
    (r"sorbitrate\s*(\d+\s*mg)?", "Sorbitrate"),
]

FREQUENCY_MAP = {
    "od": "Once daily (OD)",
    "bd": "Twice daily (BD)",
    "tds": "Three times daily (TDS)",
    "qid": "Four times daily (QID)",
    "prn": "As needed (PRN)",
    "sos": "As needed (SOS)",
    "hs": "At bedtime (HS)",
    "ac": "Before meals (AC)",
    "pc": "After meals (PC)",
}

UPLOAD_ROOT = os.getenv(
    "NIRAMAYA_UPLOADS",
    os.getenv("MEDIKIOSK_UPLOADS", os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))),
        "..", "data", "uploads")))

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".pdf", ".webp"}


class OCREngineUnavailable(Exception):
    pass


def store_upload(session_id: str, file_name: str, file_bytes: bytes) -> str:
    """Persist raw upload bytes. Returns the stored relative path."""
    safe_name = re.sub(r"[^A-Za-z0-9._-]", "_", os.path.basename(file_name))[-80:]
    doc_dir = os.path.abspath(os.path.join(UPLOAD_ROOT, session_id))
    os.makedirs(doc_dir, exist_ok=True)
    stored = f"{uuid.uuid4().hex}_{safe_name}"
    with open(os.path.join(doc_dir, stored), "wb") as f:
        f.write(file_bytes)
    return os.path.join(session_id, stored)


def validate_upload(file_name: str, file_bytes: Optional[bytes]) -> None:
    from fastapi import HTTPException
    ext = os.path.splitext(file_name or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported file type '{ext}'. Use JPG, PNG, WEBP or PDF.")
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Empty file received. Please retry the upload.")
    if len(file_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="File larger than 10 MB. Please upload a smaller scan.")


def run_tesseract(image_bytes: bytes) -> Tuple[str, float]:
    """Preprocess with Pillow and OCR with Tesseract. Raises
    OCREngineUnavailable when the engine/binary is missing."""
    try:
        import pytesseract  # type: ignore
        from PIL import Image, ImageOps
    except ImportError as e:
        raise OCREngineUnavailable("OCR engine not installed") from e
    try:
        img = Image.open(io.BytesIO(image_bytes))
    except Exception as e:
        raise OCREngineUnavailable(f"Unreadable image: {e}") from e
    try:
        img = ImageOps.grayscale(img)
        w, h = img.size
        if max(w, h) < 1200:
            scale = 1200 / max(w, h)
            img = img.resize((int(w * scale), int(h * scale)))
        data = pytesseract.image_to_data(img, output_type=pytesseract.Output.DATAFRAME)
    except Exception as e:
        # Covers missing binary (TesseractNotFoundError) and runtime failures.
        raise OCREngineUnavailable(str(e)) from e
    words = data.dropna(subset=["text"])
    text = " ".join(str(t) for t in words["text"].tolist())
    conf = words["conf"].tolist()
    nums = [c for c in conf if isinstance(c, (int, float)) and c >= 0]
    mean_conf = (sum(nums) / len(nums) / 100.0) if nums else 0.0
    return text, round(mean_conf, 2)


def extract_medication_entities(
    text: str, session_id: str, source_ref: str, base_confidence: float
) -> Tuple[List[ExtractedEntity], bool]:
    """Mine medication entities from OCR/plain text.

    Returns (entities, requires_verification). A matched medicine whose dose
    is absent or unreadable keeps dosage="UNKNOWN" and forces verification.
    Nothing is ever invented: no match means no entity.
    """
    entities: List[ExtractedEntity] = []
    lowered = text.lower()
    requires_verification = False

    freq_re = re.compile(r"\b(od|bd|tds|qid|prn|sos|hs|ac|pc)\b", re.IGNORECASE)
    freq_match = freq_re.search(lowered)
    frequency = FREQUENCY_MAP.get(freq_match.group(1).lower(), "Frequency not stated") if freq_match else "Frequency not stated"

    for pattern, display in MEDICATION_PATTERNS:
        m = re.search(pattern, lowered)
        if not m:
            continue
        dose_raw = (m.group(1) or "").replace(" ", "")
        if dose_raw:
            dosage: Optional[str] = dose_raw
            conf = base_confidence
        else:
            dosage = "UNKNOWN"
            conf = round(base_confidence * 0.6, 2)
            requires_verification = True
        if conf < 0.65:
            requires_verification = True
        entities.append(ExtractedEntity(

            session_id=session_id,
            category="MEDICATION",
            entity_name=display,
            dosage=dosage,
            frequency=frequency,
            confidence=round(conf, 2),
            source_ref=source_ref,
            verified=False,
        ))
    if not entities:
        # Text with no recognisable medicine is not a success — a human
        # must look at the scan.
        requires_verification = True
    return entities, requires_verification


class BaseOCRProvider(ABC):
    @abstractmethod
    async def process_document(
        self,
        session_id: str,
        doc_type: str,
        file_name: str,
        file_bytes: Optional[bytes] = None,
    ) -> DocumentProcessResult:
        pass


class TesseractOCRProvider(BaseOCRProvider):
    """Production provider: persist → OCR → extract → confidence → verify-flag."""

    async def process_document(
        self,
        session_id: str,
        doc_type: str,
        file_name: str,
        file_bytes: Optional[bytes] = None,
    ) -> DocumentProcessResult:
        from fastapi import HTTPException
        document_id = str(uuid.uuid4())
        if not file_bytes:
            raise HTTPException(status_code=400, detail="No document bytes received.")

        stored_rel = store_upload(session_id, file_name, file_bytes)
        source_ref = f"upload:{stored_rel}#doc={document_id}"

        ext = os.path.splitext(file_name)[1].lower()
        if ext == ".pdf":
            # Image-only pipeline: PDFs need rendering (out of scope for the
            # prototype's native deps). The file is stored and routed to a
            # human — the honest path, not a guessed extraction.
            return DocumentProcessResult(
                document_id=document_id,
                session_id=session_id,
                raw_text="",
                overall_confidence=0.0,
                entities=[],
                requires_verification=True,
                exception_type="LOW_OCR_CONFIDENCE",
            )

        try:
            raw_text, ocr_conf = run_tesseract(file_bytes)
        except OCREngineUnavailable as e:
            return DocumentProcessResult(
                document_id=document_id,
                session_id=session_id,
                raw_text="",
                overall_confidence=0.0,
                entities=[],
                requires_verification=True,
                exception_type="LOW_OCR_CONFIDENCE",
            )

        if not raw_text.strip():
            return DocumentProcessResult(
                document_id=document_id,
                session_id=session_id,
                raw_text="",
                overall_confidence=round(ocr_conf, 2),
                entities=[],
                requires_verification=True,
                exception_type="LOW_OCR_CONFIDENCE",
            )

        entities, needs_check = extract_medication_entities(
            raw_text, session_id, source_ref, ocr_conf)
        overall = round(sum(e.confidence for e in entities) / len(entities), 2) if entities else round(ocr_conf * 0.5, 2)
        if not entities:
            needs_check = True
        return DocumentProcessResult(
            document_id=document_id,
            session_id=session_id,
            raw_text=raw_text[:2000],
            overall_confidence=overall,
            entities=entities,
            requires_verification=needs_check or overall < 0.65,
            exception_type="LOW_OCR_CONFIDENCE" if (needs_check or overall < 0.65) else None,
        )


def get_ocr_provider() -> BaseOCRProvider:
    return TesseractOCRProvider()
