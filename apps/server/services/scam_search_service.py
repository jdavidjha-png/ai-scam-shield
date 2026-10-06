from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from config import settings
from models import ScamMessage
from services.embedding_service import generate_embedding


@dataclass(frozen=True)
class ScamMatch:
    record: ScamMessage
    distance: float


@dataclass(frozen=True)
class SearchOutcome:
    matches: list[ScamMatch]
    closest_distance: float | None
    meaningful_match: bool

    @property
    def meaningful_matches(self) -> list[ScamMatch]:
        return [
            match
            for match in self.matches
            if match.distance <= settings.scam_distance_threshold
        ]


def find_similar_scams(
    message: str,
    db: Session,
    limit: int = 3,
) -> SearchOutcome:
    if not 1 <= limit <= 20:
        raise ValueError("Search limit must be between 1 and 20")

    embedding = generate_embedding(message)
    distance = ScamMessage.embedding.l2_distance(embedding).label("distance")
    rows = db.execute(
        select(ScamMessage, distance)
        .order_by(distance)
        .limit(limit)
    ).all()

    matches = [
        ScamMatch(record=record, distance=float(row_distance))
        for record, row_distance in rows
    ]
    closest_distance = matches[0].distance if matches else None

    return SearchOutcome(
        matches=matches,
        closest_distance=closest_distance,
        meaningful_match=(
            closest_distance is not None
            and closest_distance <= settings.scam_distance_threshold
        ),
    )
