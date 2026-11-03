import os
from typing import List, Dict, Any, Tuple
from dotenv import load_dotenv
from groq import Groq
from sentence_transformers import SentenceTransformer

from .db import get_db_connection

load_dotenv()

# Singleton clients
_groq_client = None
_embedding_model = None


def get_groq_client() -> Groq:
    """Returns a singleton instance of the Groq client."""
    global _groq_client
    if _groq_client is None:
        api_key = os.getenv("GROQ_API_KEY")
        _groq_client = Groq(api_key=api_key)
    return _groq_client


def get_embedding_model() -> SentenceTransformer:
    """Returns a singleton instance of the SentenceTransformer model."""
    global _embedding_model
    if _embedding_model is None:
        _embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
    return _embedding_model


def search_knowledge(question: str, limit: int = 3) -> List[Tuple[Any, ...]]:
    """Finds the most relevant knowledge chunks using vector similarity."""
    model = get_embedding_model()
    question_embedding = model.encode(
        question,
        normalize_embeddings=True
    )

    db = get_db_connection()
    with db.cursor() as cur:
        cur.execute(
            """
            SELECT
                id,
                source_file,
                content,
                1 - (embedding <=> %s) AS similarity
            FROM knowledge_base
            WHERE embedding IS NOT NULL
            ORDER BY embedding <=> %s
            LIMIT %s;
            """,
            (
                question_embedding,
                question_embedding,
                limit
            )
        )
        return cur.fetchall()


def generate_answer(question: str) -> str:
    """Analyzes a suspicious message and returns scam-safety advice."""
    results = search_knowledge(question)

    # Combine retrieved chunks
    context = "\n\n".join(
        row[2] for row in results
    )

    client = get_groq_client()
    model_name = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")

    response = client.chat.completions.create(
        model=model_name,
        messages=[
            {
                "role": "system",
                "content": """You are AI Scam Shield, a helpful scam-safety assistant.

Use the provided knowledge to analyze the user's message.

Do not invent facts.

Clearly explain:
1. Whether the message looks like a scam.
2. Why it looks suspicious.
3. What the user should safely do next.

Keep the answer clear and practical.
"""
            },
            {
                "role": "user",
                "content": f"""Knowledge:

{context}

User message:

{question}

Analyze this message and give a clear scam-safety answer."""
            }
        ],
        temperature=0.2
    )

    return response.choices[0].message.content


def answer_document_qa(question: str, limit: int = 3) -> Dict[str, Any]:
    """Answers a question using lesson documents and returns answers with citations."""
    results = search_knowledge(question, limit=limit)

    sources = [
        {
            "id": row[0],
            "source_file": row[1],
            "content": row[2],
            "similarity": round(float(row[3]), 4)
        }
        for row in results
    ]

    context = "\n\n".join(
        f"Source ({row[1]}):\n{row[2]}" for row in results
    )

    client = get_groq_client()
    model_name = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")

    response = client.chat.completions.create(
        model=model_name,
        messages=[
            {
                "role": "system",
                "content": """You are AI Scam Shield, a helpful and knowledgeable scam-safety assistant.
Answer the user's question clearly, practically, and accurately using the provided knowledge chunks retrieved from the lesson documents.
If the question is about identifying, verifying, avoiding, or reporting scams, provide concrete steps and safe actions.
Format your answer with clear bullet points and readable paragraphs.
Do not invent false facts."""
            },
            {
                "role": "user",
                "content": f"""Knowledge:
{context}

User question:
{question}

Provide a clear, helpful, and well-structured answer:"""
            }
        ],
        temperature=0.2
    )

    return {
        "answer": response.choices[0].message.content,
        "sources": sources
    }
