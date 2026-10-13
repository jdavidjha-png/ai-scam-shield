import os
from pathlib import Path

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")


class Settings:
    database_url = os.getenv("DATABASE_URL", "")
    embedding_model = os.getenv(
        "EMBEDDING_MODEL",
        "sentence-transformers/all-MiniLM-L6-v2",
    )
    embedding_dimensions = 384
    rag_top_k = int(os.getenv("RAG_TOP_K", "3"))
    rag_distance_threshold = float(os.getenv("RAG_DISTANCE_THRESHOLD", "0"))


settings = Settings()
