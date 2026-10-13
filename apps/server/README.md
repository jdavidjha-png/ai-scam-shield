# AI Scam Shield backend — Document FAQ RAG

Teaching stack: markdown lessons are chunked, embedded locally, stored in
PostgreSQL with pgvector, and retrieved for `/api/rag/ask` before Groq formats
an answer.

`POST /check-scam` remains a separate Groq-only message analyzer (no document
retrieval).

## Configuration

Create `apps/server/.env`:

```dotenv
GROQ_API_KEY=...
DATABASE_URL=postgresql+psycopg://YOUR_USERNAME:YOUR_PASSWORD@localhost:5432/ai_scam_shield
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
```

Optional: `RAG_TOP_K` (default 3), `RAG_DISTANCE_THRESHOLD` (default 0 = disabled).

## Database

Apply the document chunks migration:

```bash
psql -U YOUR_USER -d ai_scam_shield -f migrations/002_document_chunks.sql
```

Requires the [pgvector](https://github.com/pgvector/pgvector) extension on PostgreSQL.

## Ingest lesson documents

From `apps/server`:

```bash
python -m pip install -r requirements.txt
python scripts/ingest_rag_docs.py
```

Sample markdown lives in `data/rag_docs/`. Re-import after edits:

```bash
python scripts/ingest_rag_docs.py --clear
```

## Run

```bash
python -m uvicorn main:app --reload --port 8000
```

Health: `GET http://localhost:8000/api/rag/health` (includes `chunk_count`).

Ask: `POST http://localhost:8000/api/rag/ask` with JSON `{"question": "..."}`.

Web UI: `http://localhost:3000/qna` when Next.js is running.

## Tests

```bash
python -m pytest -q tests/test_rag_api.py
```
