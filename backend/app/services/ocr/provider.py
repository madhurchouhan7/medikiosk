from abc import ABC, abstractmethod
from typing import List, Optional
import uuid
from app.models.schemas import ExtractedEntity, DocumentProcessResult

# Common Indian prescription medication patterns
MEDICATION_PATTERNS = [
    (r"amlodipine\s*(\d+mg)", "Amlodipine"),
    (r"metformin\s*(\d+mg)", "Metformin"),
    (r"atorvastatin\s*(\d+mg)", "Atorvastatin"),
    (r"paracetamol\s*(\d+mg)", "Paracetamol"),
    (r"cetirizine\s*(\d+mg)", "Cetirizine"),
    (r"aspirin\s*(\d+mg)", "Aspirin"),
    (r"omeprazole\s*(\d+mg)", "Omeprazole"),
    (r"metoprolol\s*(\d+mg)", "Metoprolol"),
    (r"losartan\s*(\d+mg)", "Losartan"),
    (r"glimepiride\s*(\d+mg)", "Glimepiride"),
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


class BaseOCRProvider(ABC):
    @abstractmethod
    async def process_document(
        self,
        session_id: str,
        doc_type: str,
        file_name: str,
        file_bytes: Optional[bytes] = None
    ) -> DocumentProcessResult:
        pass


class MockOCRProvider(BaseOCRProvider):
    async def process_document(
        self,
        session_id: str,
        doc_type: str,
        file_name: str,
        file_bytes: Optional[bytes] = None
    ) -> DocumentProcessResult:
        document_id = str(uuid.uuid4())
        doc_name_lower = file_name.lower()

        # If real bytes were provided, simulate intelligent OCR extraction
        # In production this would call Tesseract/Sarvam OCR
        if file_bytes and len(file_bytes) > 0:
            # Use file size as a proxy for image quality (demo heuristic)
            # Small files tend to be low quality
            is_low_quality = len(file_bytes) < 50000  # < 50KB = likely low quality
            return await self._process_real_upload(session_id, file_name, file_bytes, is_low_quality)

        # Filename-based scenario selection (backwards compatible)
        if "handwritten" in doc_name_lower or "low_conf" in doc_name_lower or "patient_c" in doc_name_lower or "blurry" in doc_name_lower:
            return await self._low_confidence_result(session_id, document_id, file_name)
        else:
            return await self._high_confidence_result(session_id, document_id, file_name)

    async def _process_real_upload(
        self,
        session_id: str,
        file_name: str,
        file_bytes: bytes,
        is_low_quality: bool
    ) -> DocumentProcessResult:
        """Process a real uploaded file. In production would call Tesseract."""
        document_id = str(uuid.uuid4())

        if is_low_quality:
            # Simulate poor OCR on low-quality image
            entities = [
                ExtractedEntity(
                    session_id=session_id,
                    category="MEDICATION",
                    entity_name="Amlodipine",
                    dosage="[Unclear 5mg/10mg]",
                    frequency="Once daily",
                    confidence=0.52,
                    source_ref=f"{file_name}#line=2 (Low Quality Image)",
                    verified=False
                )
            ]
            return DocumentProcessResult(
                document_id=document_id,
                session_id=session_id,
                raw_text="Rx: Amlodipine [unclear dose] OD\n(Image quality low — manual review required)",
                overall_confidence=0.55,
                entities=entities,
                requires_verification=True
            )
        else:
            # Good quality upload — return realistic extraction
            entities = [
                ExtractedEntity(
                    session_id=session_id,
                    category="MEDICATION",
                    entity_name="Amlodipine",
                    dosage="5mg",
                    frequency="Once daily (OD)",
                    duration="Ongoing",
                    confidence=0.94,
                    source_ref=f"{file_name}#line=1",
                    verified=False
                ),
                ExtractedEntity(
                    session_id=session_id,
                    category="MEDICATION",
                    entity_name="Paracetamol",
                    dosage="650mg",
                    frequency="As needed (PRN)",
                    duration="5 days",
                    confidence=0.91,
                    source_ref=f"{file_name}#line=2",
                    verified=False
                )
            ]
            return DocumentProcessResult(
                document_id=document_id,
                session_id=session_id,
                raw_text="Rx:\n1. Amlodipine 5mg OD - Ongoing\n2. Paracetamol 650mg PRN for pain — 5 days",
                overall_confidence=0.93,
                entities=entities,
                requires_verification=False
            )

    async def _low_confidence_result(self, session_id: str, document_id: str, file_name: str) -> DocumentProcessResult:
        entities = [
            ExtractedEntity(
                session_id=session_id,
                category="MEDICATION",
                entity_name="Amlodipine",
                dosage="[Unclear 5mg/10mg]",
                frequency="Once daily",
                confidence=0.52,
                source_ref=f"{file_name}#line=2 (Handwritten)",
                verified=False
            ),
            ExtractedEntity(
                session_id=session_id,
                category="MEDICATION",
                entity_name="Metformin",
                dosage="500mg",
                frequency="Twice daily",
                confidence=0.88,
                source_ref=f"{file_name}#line=4",
                verified=False
            )
        ]
        return DocumentProcessResult(
            document_id=document_id,
            session_id=session_id,
            raw_text="Rx: Amlodipine [blurred] OD, Metformin 500mg BD after meals.",
            overall_confidence=0.60,
            entities=entities,
            requires_verification=True
        )

    async def _high_confidence_result(self, session_id: str, document_id: str, file_name: str) -> DocumentProcessResult:
        entities = [
            ExtractedEntity(
                session_id=session_id,
                category="MEDICATION",
                entity_name="Amlodipine",
                dosage="5mg",
                frequency="Once daily (OD)",
                duration="Ongoing",
                confidence=0.96,
                source_ref=f"{file_name}#line=1",
                verified=False
            ),
            ExtractedEntity(
                session_id=session_id,
                category="MEDICATION",
                entity_name="Paracetamol",
                dosage="650mg",
                frequency="As needed (PRN) for pain",
                duration="5 days",
                confidence=0.94,
                source_ref=f"{file_name}#line=2",
                verified=False
            )
        ]
        return DocumentProcessResult(
            document_id=document_id,
            session_id=session_id,
            raw_text="Rx:\n1. Amlodipine 5mg OD - Ongoing\n2. Paracetamol 650mg PRN for pain",
            overall_confidence=0.95,
            entities=entities,
            requires_verification=False
        )


def get_ocr_provider() -> BaseOCRProvider:
    return MockOCRProvider()
