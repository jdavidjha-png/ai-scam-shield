from sentence_transformers import SentenceTransformer
import psycopg
from pgvector.psycopg import register_vector
from dotenv import load_dotenv
from groq import Groq
import os

# Load environment variables
load_dotenv()

# Groq client
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

# Embedding model
model = SentenceTransformer("all-MiniLM-L6-v2")

# PostgreSQL connection
conn = psycopg.connect(
    host="localhost",
    port=5432,
    dbname="ai_scam_shield",
    user="macbook"
)

register_vector(conn)


def search_knowledge(question, limit=3):
    question_embedding = model.encode(
        question,
        normalize_embeddings=True
    )

    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                content,
                1 - (embedding <=> %s) AS similarity
            FROM knowledge_base
            WHERE embedding IS NOT NULL
            ORDER BY embedding <=> %s
            LIMIT %s;
            """,
            (question_embedding, question_embedding, limit)
        )

        return cur.fetchall()


def generate_answer(question):
    # Search relevant knowledge
    results = search_knowledge(question)

    # Combine retrieved chunks
    context = "\n\n".join(
        content for content, similarity in results
    )

    # Generate answer using Groq
    response = client.chat.completions.create(
        model="openai/gpt-oss-20b",
        messages=[
            {
                "role": "system",
                "content": """You are AI Scam Shield, a helpful scam-safety assistant.

Answer the user's question using the provided knowledge.
Do not invent facts.
If the message appears suspicious, clearly explain why and give safe next steps.
"""
            },
            {
                "role": "user",
                "content": f"""Knowledge:
{context}

User question:
{question}

Give a clear and practical answer."""
            }
        ],
        temperature=0.2
    )

    return response.choices[0].message.content


# Test question
question = "Mujhe message aaya hai ki mera bank account band ho jayega, kya ye scam hai?"

# Generate final answer
answer = generate_answer(question)

print("\nAI Scam Shield Answer:\n")
print(answer)

# Close database connection
conn.close()