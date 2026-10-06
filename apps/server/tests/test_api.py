from datetime import datetime, timezone
from types import SimpleNamespace

from fastapi.testclient import TestClient
import pytest

import main
from routes import scam
from services import scam_search_service
from services.scam_search_service import ScamMatch, SearchOutcome


client = TestClient(main.app)


def test_fastapi_starts_and_exposes_existing_and_new_routes():
    response = client.get("/openapi.json")
    assert response.status_code == 200
    paths = response.json()["paths"]
    assert "/check-scam" in paths
    assert "/api/scam/embedding" in paths
    assert "/api/scam/knowledge" in paths
    assert "/api/scam/search" in paths


def test_embedding_endpoint_returns_384_dimensions(monkeypatch):
    monkeypatch.setattr(scam, "generate_embedding", lambda _: [0.25] * 384)

    response = client.post(
        "/api/scam/embedding",
        json={"message": "Verify your bank account immediately."},
    )

    assert response.status_code == 200
    assert response.json()["dimensions"] == 384
    assert response.json()["preview"] == [0.25] * 5
    assert "embedding" not in response.json()


def test_embedding_endpoint_can_return_complete_vector(monkeypatch):
    monkeypatch.setattr(scam, "generate_embedding", lambda _: [0.25] * 384)

    response = client.post(
        "/api/scam/embedding?include_vector=true",
        json={"message": "Verify your bank account immediately."},
    )

    assert len(response.json()["embedding"]) == 384


def test_empty_message_is_rejected():
    response = client.post("/api/scam/embedding", json={"message": "   "})
    assert response.status_code == 422


def test_existing_scam_analysis_route_still_works(monkeypatch):
    record = SimpleNamespace(
        id=1,
        text="Send a payment to claim your prize.",
        category="LOTTERY",
        created_at=datetime.now(timezone.utc),
    )
    outcome = SearchOutcome(
        matches=[ScamMatch(record=record, distance=0.7)],
        closest_distance=0.7,
        meaningful_match=True,
    )
    completion = SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content="Verdict: SCAM"))]
    )
    observed = {}
    monkeypatch.setattr(
        main.client.chat.completions,
        "create",
        lambda **kwargs: observed.update(kwargs) or completion,
    )
    monkeypatch.setattr(main, "find_similar_scams", lambda *_, **__: outcome)
    main.app.dependency_overrides[main.get_db] = lambda: SimpleNamespace()

    try:
        response = client.post(
            "/check-scam",
            json={"message": "Urgent payment needed"},
        )
    finally:
        main.app.dependency_overrides.clear()

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["analysis"] == "Verdict: SCAM"
    assert payload["retrieval"]["meaningful_match"] is True
    assert payload["retrieval"]["matches_used"] == 1
    assert "Send a payment to claim your prize." in observed["messages"][1]["content"]


@pytest.mark.parametrize(
    ("distance", "expected_match"),
    [(0.70, True), (0.95, False)],
)
def test_search_applies_calibrated_distance_threshold(
    monkeypatch,
    distance,
    expected_match,
):
    record = SimpleNamespace(
        id=1,
        text="You won a cash prize.",
        category="OTHER",
        created_at=datetime.now(timezone.utc),
    )
    fake_db = SimpleNamespace(
        execute=lambda _: SimpleNamespace(all=lambda: [(record, distance)])
    )

    main.app.dependency_overrides[scam.get_database_session] = lambda: fake_db
    monkeypatch.setattr(
        scam_search_service,
        "generate_embedding",
        lambda _: [0.25] * 384,
    )
    try:
        response = client.post(
            "/api/scam/search?limit=3",
            json={"message": "Claim your prize"},
        )
    finally:
        main.app.dependency_overrides.clear()

    assert response.status_code == 200
    payload = response.json()
    assert payload["meaningful_match"] is expected_match
    assert payload["closest_distance"] == distance
    assert payload["distance_threshold"] == 0.85
