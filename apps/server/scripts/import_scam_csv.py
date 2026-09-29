import argparse
import csv
import sys
from pathlib import Path

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

# Allow this script to import backend modules when run from any directory.
SERVER_DIR = Path(__file__).resolve().parents[1]
if str(SERVER_DIR) not in sys.path:
    sys.path.insert(0, str(SERVER_DIR))

from database import get_engine  # noqa: E402
from models import ScamMessage  # noqa: E402
from schemas import ScamCategory  # noqa: E402
from services.embedding_service import (  # noqa: E402
    EmbeddingServiceError,
    generate_embedding,
)


TEXT_COLUMNS = ("text", "message", "content", "scam_message")
CATEGORY_COLUMNS = ("category", "type", "label", "scam_category")


def find_column(fieldnames: list[str], candidates: tuple[str, ...]) -> str | None:
    normalized = {name.strip().lower(): name for name in fieldnames}
    return next(
        (normalized[candidate] for candidate in candidates if candidate in normalized),
        None,
    )


def normalize_category(value: str) -> str:
    normalized = value.strip().upper().replace("-", "_").replace(" ", "_")
    return ScamCategory(normalized).value


def import_csv(csv_path: Path) -> tuple[int, int]:
    inserted = 0
    rejected = 0

    with csv_path.open("r", encoding="utf-8-sig", newline="") as csv_file:
        reader = csv.DictReader(csv_file)
        if not reader.fieldnames:
            raise ValueError("CSV file must contain a header row")

        text_column = find_column(reader.fieldnames, TEXT_COLUMNS)
        category_column = find_column(reader.fieldnames, CATEGORY_COLUMNS)
        if not text_column or not category_column:
            raise ValueError(
                "CSV must contain a text/message/content column and a "
                "category/type/label column"
            )

        with Session(get_engine(), expire_on_commit=False) as session:
            for line_number, row in enumerate(reader, start=2):
                text = (row.get(text_column) or "").strip()
                raw_category = row.get(category_column) or ""

                try:
                    if not text:
                        raise ValueError("message text is empty")
                    category = normalize_category(raw_category)
                    embedding = generate_embedding(text)
                    session.add(
                        ScamMessage(
                            text=text,
                            category=category,
                            embedding=embedding,
                        )
                    )
                    session.commit()
                    inserted += 1
                    print(f"Line {line_number}: imported ({category})")
                except (ValueError, EmbeddingServiceError, SQLAlchemyError) as exc:
                    session.rollback()
                    rejected += 1
                    print(f"Line {line_number}: rejected - {exc}", file=sys.stderr)

    return inserted, rejected


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Generate local embeddings and import scam messages from CSV."
    )
    parser.add_argument("csv_file", type=Path, help="Path to the CSV file")
    args = parser.parse_args()

    csv_path = args.csv_file.resolve()
    if not csv_path.is_file():
        parser.error(f"CSV file does not exist: {csv_path}")

    try:
        inserted, rejected = import_csv(csv_path)
    except (ValueError, OSError, RuntimeError) as exc:
        print(f"Import failed: {exc}", file=sys.stderr)
        return 1

    print(f"\nFinished: {inserted} imported, {rejected} rejected")
    return 0 if rejected == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())
