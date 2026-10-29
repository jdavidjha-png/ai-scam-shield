"""Services package for AI Scam Shield core logic."""
from .db import get_db_connection
from .detector import search_knowledge, generate_answer, answer_document_qa

__all__ = [
    "get_db_connection",
    "search_knowledge",
    "generate_answer",
    "answer_document_qa",
]
