from typing import Literal

from fastapi import FastAPI
from pydantic import BaseModel, Field

app = FastAPI(
    title="VetBridge Document Service",
    description=(
        "Synthetic-safe boundary for extraction and draft generation. "
        "It does not diagnose, triage, prescribe, or mutate referral state."
    ),
    version="0.1.0",
)


class SourceLocation(BaseModel):
    page: int | None = Field(default=None, ge=1)
    section: str | None = None


class ExtractedFact(BaseModel):
    fact_type: str
    candidate_value: str
    confidence: float = Field(ge=0, le=1)
    source: SourceLocation
    review_status: Literal["PENDING_CLINICIAN_REVIEW"] = "PENDING_CLINICIAN_REVIEW"


class SyntheticExtractionRequest(BaseModel):
    document_id: str
    synthetic_text: str = Field(min_length=1, max_length=20_000)


class ExtractionResponse(BaseModel):
    document_id: str
    model_version: str
    facts: list[ExtractedFact]
    disclaimer: str


@app.get("/health")
def health() -> dict[str, str]:
    return {"service": "vetbridge-document-service", "status": "ok"}


@app.post("/v1/extractions/synthetic", response_model=ExtractionResponse)
def extract_synthetic(request: SyntheticExtractionRequest) -> ExtractionResponse:
    """Return a deterministic stub until a parser provider is selected."""
    return ExtractionResponse(
        document_id=request.document_id,
        model_version="deterministic-stub-v1",
        facts=[
            ExtractedFact(
                fact_type="DOCUMENT_TEXT_PRESENT",
                candidate_value=f"{len(request.synthetic_text)} characters",
                confidence=1.0,
                source=SourceLocation(section="submitted synthetic text"),
            )
        ],
        disclaimer="Draft extraction. Clinician review is required.",
    )
