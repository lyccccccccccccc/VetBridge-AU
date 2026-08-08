from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_synthetic_extraction_is_always_unapproved() -> None:
    response = client.post(
        "/v1/extractions/synthetic",
        json={
            "document_id": "document-a-note",
            "synthetic_text": "Buddy vomited twice in this fictional record.",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["facts"][0]["review_status"] == "PENDING_CLINICIAN_REVIEW"
    assert "Clinician review" in body["disclaimer"]
