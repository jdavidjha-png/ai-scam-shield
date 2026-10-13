from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from config import settings
from models import DocumentChunk
from services.embedding_service import generate_embedding


@dataclass(frozen=True)
class ChunkMatch:
    record: DocumentChunk
    distance: float


def find_similar_chunks(
    question: str,
    db: Session,
    limit: int | None = None,
) -> list[ChunkMatch]:
    if limit is None:
        limit = settings.rag_top_k
    if not 1 <= limit <= 20:
        raise ValueError("Search limit must be between 1 and 20")

    chunk_count = db.scalar(select(func.count()).select_from(DocumentChunk))
    if not chunk_count:
        return []

    embedding = generate_embedding(question)
    distance = DocumentChunk.embedding.l2_distance(embedding).label("distance")
    rows = db.execute(
        select(DocumentChunk, distance).order_by(distance).limit(limit)
    ).all()

    matches = [
        ChunkMatch(record=record, distance=float(row_distance))
        for record, row_distance in rows
    ]

    threshold = settings.rag_distance_threshold
    if threshold > 0:
        matches = [match for match in matches if match.distance <= threshold]

    return matches
