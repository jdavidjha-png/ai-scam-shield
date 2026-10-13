from types import SimpleNamespace

from fastapi.testclient import TestClient

import main
from routes import rag
from services.rag_answer_service import RagAnswer, RagSource


client = TestClient(main.app)


def test_openapi_exposes_rag_ask():
    response = client.get("/openapi.json")
    assert response.status_code == 200
    assert "/api/rag/ask" in response.json()["paths"]


def test_empty_question_is_rejected():
    response = client.post("/api/rag/ask", json={"question": "   "})
    assert response.status_code == 422


def test_empty_knowledge_base_returns_404():
    fake_db = SimpleNamespace(
        scalar=lambda _: 0,
    )
    main.app.dependency_overrides[rag.get_database_session] = lambda: fake_db
    try:
        response = client.post(
            "/api/rag/ask",
            json={"question": "What is phishing?"},
        )
    finally:
        main.app.dependency_overrides.clear()

    assert response.status_code == 404


def test_ask_returns_answer_and_sources(monkeypatch):
    fake_db = SimpleNamespace(
        scalar=lambda _: 3,
    )
    fake_result = RagAnswer(
        question="What is phishing?",
        answer="Phishing tricks you into sharing sensitive information.",
        sources=[
            RagSource(
                document_name="phishing-basics.md",
                chunk_index=0,
                snippet="Phishing is a type of online scam",
                distance=0.42,
            )
        ],
    )
    observed = {}

    def fake_answer(question, db):
        observed["question"] = question
        observed["db"] = db
        return fake_result

    monkeypatch.setattr(rag, "answer_question", fake_answer)
    main.app.dependency_overrides[rag.get_database_session] = lambda: fake_db
    try:
        response = client.post(
            "/api/rag/ask",
            json={"question": "What is phishing?"},
        )
    finally:
        main.app.dependency_overrides.clear()

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["answer"].startswith("Phishing")
    assert payload["sources"][0]["document_name"] == "phishing-basics.md"
    assert observed["question"] == "What is phishing?"


def test_answer_service_includes_context_in_groq_prompt(monkeypatch):
    from services import rag_answer_service
    from services.document_search_service import ChunkMatch

    record = SimpleNamespace(
        document_name="phishing-basics.md",
        chunk_index=0,
        content="Phishing is a type of online scam.",
    )
    matches = [ChunkMatch(record=record, distance=0.5)]
    observed = {}

    monkeypatch.setattr(
        rag_answer_service,
        "find_similar_chunks",
        lambda *_, **__: matches,
    )

    completion = SimpleNamespace(
        choices=[
            SimpleNamespace(message=SimpleNamespace(content="Phishing is a scam type."))
        ]
    )

    class FakeCompletions:
        @staticmethod
        def create(**kwargs):
            observed.update(kwargs)
            return completion

    fake_client = SimpleNamespace(
        chat=SimpleNamespace(completions=FakeCompletions())
    )
    monkeypatch.setattr(rag_answer_service, "get_groq_client", lambda: fake_client)

    result = rag_answer_service.answer_question(
        "What is phishing?",
        SimpleNamespace(),
    )

    assert "Phishing is a type of online scam." in observed["messages"][1]["content"]
    assert result.answer == "Phishing is a scam type."
    assert result.sources[0].document_name == "phishing-basics.md"
