from abc import ABC, abstractmethod
from typing import List
import uuid
from app.models.schemas import ExtractedEntity, DocumentProcessResult

class BaseOCRProvider(ABC):
    @abstractmethod
    async def process_document(self, session_id: str, doc_type: str, file_name: str) -> DocumentProcessResult:
        pass

class MockOCRProvider(BaseOCRProvider):
    async def process_document(self, session_id: str, doc_type: str, file_name: str) -> DocumentProcessResult:
        document_id = str(uuid.uuid4())
        doc_name_lower = file_name.lower()

        # Generate realistic extraction scenarios based on document file name / type
        if "handwritten" in doc_name_lower or "low_conf" in doc_name_lower or "patient_c" in doc_name_lower:
            # Low confidence scenario triggering Navigator task
            entities = [
                ExtractedEntity(
                    session_id=session_id,
                    category="MEDICATION",
                    entity_name="Amlodipine",
                    dosage="[Unclear 5mg/10mg]",
                    frequency="Once daily",
                    confidence=0.52, # Low confidence (<0.65)
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
        else:
            # Standard High confidence prescription scenario
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
