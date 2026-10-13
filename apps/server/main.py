import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

import psycopg
from pgvector.psycopg import register_vector
from sentence_transformers import SentenceTransformer
from groq import Groq


# Load environment variables
load_dotenv()

app = FastAPI()


# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Groq client
client = Groq(
    api_key=os.getenv("GROQ_API_KEY")
)


# Embedding model
embedding_model = SentenceTransformer(
    "all-MiniLM-L6-v2"
)


# PostgreSQL connection
conn = None

def get_db_connection():
    global conn
    try:
        if conn is None or conn.closed:
            conn = psycopg.connect(
                host="localhost",
                port=5432,
                dbname="ai_scam_shield",
                user="macbook"
            )
            register_vector(conn)
    except Exception:
        conn = psycopg.connect(
            host="localhost",
            port=5432,
            dbname="ai_scam_shield",
            user="macbook"
        )
        register_vector(conn)
    return conn

# Request models
class MessageRequest(BaseModel):
    message: str


class QARequest(BaseModel):
    question: str
    limit: int = 3


def search_knowledge(question, limit=3):
    question_embedding = embedding_model.encode(
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


def generate_answer(question):
    # Retrieve relevant knowledge
    results = search_knowledge(question)

    # Combine retrieved chunks
    context = "\n\n".join(
        row[2] for row in results
    )

    # Generate answer using Groq
    response = client.chat.completions.create(
        model="openai/gpt-oss-20b",
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


@app.get("/")
def home():
    return {
        "message": "AI Scam Shield API is running"
    }


@app.post("/check-scam")
def check_scam(request: MessageRequest):
    try:
        answer = generate_answer(
            request.message
        )
        return {
            "success": True,
            "analysis": answer
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "analysis": "Unable to analyze the message. Please try again."
        }


@app.post("/document-qa")
@app.post("/qa")
def document_qa(request: QARequest):
    try:
        results = search_knowledge(request.question, limit=request.limit)

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

        response = client.chat.completions.create(
            model="openai/gpt-oss-20b",
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
{request.question}

Provide a clear, helpful, and well-structured answer:"""
                }
            ],
            temperature=0.2
        )

        answer = response.choices[0].message.content

        return {
            "success": True,
            "answer": answer,
            "sources": sources
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "answer": "Unable to generate answer. Please try again."
        }