from sentence_transformers import SentenceTransformer
import psycopg
from pgvector.psycopg import register_vector


model = SentenceTransformer("all-MiniLM-L6-v2")


conn = psycopg.connect(
    host="localhost",
    port=5432,
    dbname="ai_scam_shield",
    user="macbook"
)

# 3. PostgreSQL ko vector samajhne ke liye register karo
register_vector(conn)

with conn.cursor() as cur:

    # 4. Jinke embeddings abhi nahi hain, un chunks ko nikalo
    cur.execute("""
        SELECT id, content
        FROM knowledge_base
        WHERE embedding IS NULL
        ORDER BY id
    """)

    rows = cur.fetchall()

    print(f"Found {len(rows)} chunks to embed.")

    # 5. Har chunk ka embedding banao aur database mein save karo
    for row_id, content in rows:

        embedding = model.encode(
            content,
            normalize_embeddings=True
        )

        cur.execute(
            """
            UPDATE knowledge_base
            SET embedding = %s
            WHERE id = %s
            """,
            (embedding, row_id)
        )

        print(f"Embedded chunk {row_id}")

# 6. Changes save karo
conn.commit()
conn.close()

print("All embeddings saved successfully!")