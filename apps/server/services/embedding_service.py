from functools import lru_cache

from sentence_transformers import SentenceTransformer

from config import settings


class EmbeddingServiceError(RuntimeError):
    pass


@lru_cache(maxsize=1)
def get_embedding_model() -> SentenceTransformer:
    try:
        return SentenceTransformer(settings.embedding_model)
    except Exception as exc:
        raise EmbeddingServiceError("Unable to load the local embedding model") from exc


def generate_embedding(text: str) -> list[float]:
    clean_text = text.strip()
    if not clean_text:
        raise ValueError("Text must not be empty")

    try:
        embedding = get_embedding_model().encode(
            clean_text,
            normalize_embeddings=True,
            convert_to_numpy=True,
        )
        vector = embedding.tolist()
    except EmbeddingServiceError:
        raise
    except Exception as exc:
        raise EmbeddingServiceError("Unable to generate a local embedding") from exc

    if len(vector) != settings.embedding_dimensions:
        raise EmbeddingServiceError(
            f"Expected {settings.embedding_dimensions} embedding dimensions, "
            f"received {len(vector)}"
        )
    return vector
