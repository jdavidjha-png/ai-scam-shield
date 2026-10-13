from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from database import get_db, verify_database
from models import DocumentChunk
from schemas_rag import RagAskResponse, RagQuestion, RagSource
from services.embedding_service import EmbeddingServiceError
from services.rag_answer_service import answer_question

router = APIRouter(prefix="/api/rag", tags=["document rag"])


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


@router.get("/health")
def rag_health(db: DatabaseSession):
    try:
        verify_database()
        chunk_count = db.scalar(select(func.count()).select_from(DocumentChunk)) or 0
        return {
            "status": "ok",
            "database": "connected",
            "pgvector": "enabled",
            "chunk_count": chunk_count,
        }
    except (RuntimeError, SQLAlchemyError) as exc:
        raise HTTPException(
            status_code=503,
            detail="PostgreSQL or pgvector is unavailable",
        ) from exc


@router.post("/ask", response_model=RagAskResponse)
def ask_rag(request: RagQuestion, db: DatabaseSession):
    chunk_count = db.scalar(select(func.count()).select_from(DocumentChunk)) or 0
    if chunk_count == 0:
        raise HTTPException(
            status_code=404,
            detail="The document knowledge base is empty. Run scripts/ingest_rag_docs.py first.",
        )

    try:
        result = answer_question(request.question, db)
    except EmbeddingServiceError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=503,
            detail="Unable to search the document knowledge base",
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail="Answer generation is unavailable",
        ) from exc

    return RagAskResponse(
        success=True,
        question=result.question,
        answer=result.answer,
        sources=[
            RagSource(
                document_name=source.document_name,
                chunk_index=source.chunk_index,
                snippet=source.snippet,
                distance=source.distance,
            )
            for source in result.sources
        ],
    )
