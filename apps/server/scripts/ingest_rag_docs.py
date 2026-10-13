import argparse
import sys
from pathlib import Path

from sqlalchemy import delete
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

SERVER_DIR = Path(__file__).resolve().parents[1]
if str(SERVER_DIR) not in sys.path:
    sys.path.insert(0, str(SERVER_DIR))

from database import get_engine  # noqa: E402
from models import DocumentChunk  # noqa: E402
from services.chunk_service import chunk_text  # noqa: E402
from services.embedding_service import EmbeddingServiceError, generate_embedding  # noqa: E402

DEFAULT_DOCS_DIR = SERVER_DIR / "data" / "rag_docs"


def ingest_file(session: Session, path: Path, *, clear: bool) -> int:
    document_name = path.name
    text = path.read_text(encoding="utf-8")
    chunks = chunk_text(text)
    if not chunks:
        print(f"Skipped (empty): {document_name}")
        return 0

    if clear:
        session.execute(
            delete(DocumentChunk).where(DocumentChunk.document_name == document_name)
        )

    inserted = 0
    for chunk_index, content in enumerate(chunks):
        try:
            embedding = generate_embedding(content)
        except (ValueError, EmbeddingServiceError) as exc:
            raise RuntimeError(
                f"Failed to embed chunk {chunk_index} of {document_name}: {exc}"
            ) from exc

        session.add(
            DocumentChunk(
                document_name=document_name,
                chunk_index=chunk_index,
                content=content,
                embedding=embedding,
            )
        )
        inserted += 1

    return inserted


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Chunk markdown files, embed locally, and store in document_chunks."
    )
    parser.add_argument(
        "docs_dir",
        nargs="?",
        type=Path,
        default=DEFAULT_DOCS_DIR,
        help="Directory containing .md files (default: data/rag_docs)",
    )
    parser.add_argument(
        "--clear",
        action="store_true",
        help="Delete existing chunks for each document before re-importing",
    )
    args = parser.parse_args()

    docs_dir = args.docs_dir.resolve()
    if not docs_dir.is_dir():
        raise SystemExit(f"Directory not found: {docs_dir}")

    paths = sorted(docs_dir.glob("*.md"))
    if not paths:
        raise SystemExit(f"No .md files found in {docs_dir}")

    total = 0
    try:
        with Session(get_engine()) as session:
            for path in paths:
                count = ingest_file(session, path, clear=args.clear)
                session.commit()
                total += count
                print(f"{path.name}: {count} chunk(s)")
    except (RuntimeError, SQLAlchemyError) as exc:
        raise SystemExit(str(exc)) from exc

    print(f"Done. Inserted {total} chunk(s) from {len(paths)} file(s).")


if __name__ == "__main__":
    main()
