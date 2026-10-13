from collections.abc import Generator
from functools import lru_cache

from sqlalchemy import Engine, create_engine, text
from sqlalchemy.orm import DeclarativeBase, Session

from config import settings


class Base(DeclarativeBase):
    pass


def _database_url() -> str:
    if not settings.database_url:
        raise RuntimeError("DATABASE_URL is not configured")
    return settings.database_url


@lru_cache
def get_engine() -> Engine:
    return create_engine(
        _database_url(),
        pool_pre_ping=True,
        pool_recycle=300,
    )


def get_db() -> Generator[Session, None, None]:
    with Session(get_engine(), autoflush=False, expire_on_commit=False) as session:
        yield session


def verify_database() -> None:
    with get_engine().connect() as connection:
        connection.execute(text("SELECT 1"))
        vector_enabled = connection.execute(
            text("SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector')")
        ).scalar_one()
        if not vector_enabled:
            raise RuntimeError("The PostgreSQL vector extension is not enabled")
