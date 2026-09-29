import os

import pytest
from sqlalchemy import create_engine, select, text
from sqlalchemy.orm import Session

from models import ScamMessage


TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(
    not TEST_DATABASE_URL,
    reason="Set TEST_DATABASE_URL to run PostgreSQL integration tests",
)


def test_pgvector_storage_and_similarity_search():
    engine = create_engine(TEST_DATABASE_URL)

    with engine.connect() as connection:
        assert connection.execute(text("SELECT 1")).scalar_one() == 1
        assert connection.execute(
            text("SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname='vector')")
        ).scalar_one()

    with Session(engine) as session:
        record = ScamMessage(
            text="Your bank account will be blocked. Verify your KYC immediately.",
            category="PHISHING",
            embedding=[0.1] * 384,
        )
        session.add(record)
        session.flush()

        distance = ScamMessage.embedding.l2_distance([0.1] * 384)
        match = session.execute(
            select(ScamMessage, distance.label("distance"))
            .where(ScamMessage.id == record.id)
            .order_by(distance)
        ).one()

        assert match.ScamMessage.id == record.id
        assert float(match.distance) == pytest.approx(0.0)
        session.rollback()
