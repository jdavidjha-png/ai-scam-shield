import pytest

from services import embedding_service


def test_generate_embedding_uses_local_model(monkeypatch):
    class FakeVector:
        def tolist(self):
            return [0.1] * 384

    class FakeModel:
        def encode(self, text, **kwargs):
            assert text == "test message"
            assert kwargs["normalize_embeddings"] is True
            return FakeVector()

    monkeypatch.setattr(embedding_service, "get_embedding_model", FakeModel)

    result = embedding_service.generate_embedding("test message")

    assert len(result) == 384


def test_generate_embedding_rejects_wrong_dimension(monkeypatch):
    class FakeVector:
        def tolist(self):
            return [0.1] * 10

    class FakeModel:
        def encode(self, *args, **kwargs):
            return FakeVector()

    monkeypatch.setattr(embedding_service, "get_embedding_model", FakeModel)

    with pytest.raises(
        embedding_service.EmbeddingServiceError,
        match="Expected 384",
    ):
        embedding_service.generate_embedding("test message")
