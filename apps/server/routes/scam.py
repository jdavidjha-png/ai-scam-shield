from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from config import settings
from database import get_db, verify_database
from models import ScamMessage
from schemas import KnowledgeCreate, MessageInput, ScamMessageResponse, SearchResult
from services.embedding_service import EmbeddingServiceError, generate_embedding
from services.scam_search_service import find_similar_scams


router = APIRouter(prefix="/api/scam", tags=["scam embeddings"])


def get_database_session():
    session_generator = get_db()
    try:
        session = next(session_generator)
    except (RuntimeError, SQLAlchemyError) as exc:
        raise HTTPException(
            status_code=503,
            detail="PostgreSQL is unavailable",
        ) from exc
    try:
        yield session
    finally:
        session_generator.close()


DatabaseSession = Annotated[Session, Depends(get_database_session)]


def _embedding_or_http_error(text: str) -> list[float]:
    try:
        return generate_embedding(text)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except EmbeddingServiceError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.get("/health")
def database_health():
    try:
        verify_database()
        return {"status": "ok", "database": "connected", "pgvector": "enabled"}
    except (RuntimeError, SQLAlchemyError):
        raise HTTPException(
            status_code=503,
            detail="PostgreSQL or pgvector is unavailable",
        )


@router.post("/embedding")
def create_embedding(
    request: MessageInput,
    include_vector: Annotated[bool, Query()] = False,
):
    embedding = _embedding_or_http_error(request.message)
    response = {
        "success": True,
        "message": request.message,
        "dimensions": len(embedding),
        "preview": embedding[:5],
    }
    if include_vector:
        response["embedding"] = embedding
    return response


@router.post(
    "/knowledge",
    response_model=ScamMessageResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_knowledge(request: KnowledgeCreate, db: DatabaseSession):
    embedding = _embedding_or_http_error(request.text)
    record = ScamMessage(
        text=request.text,
        category=request.category.value,
        embedding=embedding,
    )
    try:
        db.add(record)
        db.commit()
        db.refresh(record)
        return record
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=503,
            detail="Unable to store the scam message",
        ) from exc


@router.post("/search")
def search_knowledge(
    request: MessageInput,
    db: DatabaseSession,
    limit: Annotated[int, Query(ge=1, le=20)] = 3,
):
    try:
        outcome = find_similar_scams(request.message, db, limit)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except EmbeddingServiceError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=503,
            detail="Unable to search the scam knowledge base",
        ) from exc

    if not outcome.matches:
        raise HTTPException(status_code=404, detail="The scam knowledge base is empty")

    results = [
        SearchResult(
            id=match.record.id,
            text=match.record.text,
            category=match.record.category,
            created_at=match.record.created_at,
            distance=match.distance,
        )
        for match in outcome.matches
    ]
    return {
        "query": request.message,
        "meaningful_match": outcome.meaningful_match,
        "closest_distance": outcome.closest_distance,
        "distance_threshold": settings.scam_distance_threshold,
        "results": results,
    }
