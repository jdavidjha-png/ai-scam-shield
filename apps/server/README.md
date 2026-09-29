# AI Scam Shield backend

## Architecture

`main.py` remains the FastAPI entry point and preserves the existing
`POST /check-scam` Groq analysis route. The `/api/scam` router adds the
embedding knowledge-base flow:

1. FastAPI validates incoming text with Pydantic.
2. `services/embedding_service.py` runs
   `sentence-transformers/all-MiniLM-L6-v2` locally.
3. The service verifies that the model returned exactly 384 normalized floats.
4. SQLAlchemy stores known messages through psycopg in PostgreSQL.
5. pgvector's `<->` operator performs L2 nearest-neighbor search in the
   database; similarity is not calculated in Python.
6. `services/scam_search_service.py` exposes the retrieval logic to both
   `/api/scam/search` and `/check-scam`.
7. `/check-scam` includes only matches within the calibrated threshold as
   supporting evidence in the Groq prompt. If retrieval is unavailable, the
   existing Groq analysis continues without database evidence.

No embedding text is sent to OpenAI or another embedding service. The existing
OpenAI Python package remains because the Groq analysis route uses its
OpenAI-compatible client.

## Configuration

Copy the names from `.env.example` into the existing ignored `.env` and supply
your real local values:

```dotenv
GROQ_API_KEY=...
DATABASE_URL=postgresql+psycopg://YOUR_USERNAME:YOUR_PASSWORD@localhost:5432/ai_scam_shield
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
```

`config.py` loads `apps/server/.env` by absolute path. The database URL, API
keys, and credentials are never defined in source code. `.env` is ignored by
`apps/server/.gitignore`.

## Database setup

From PowerShell, create the database and apply the explicit schema migration.
Replace the PostgreSQL bin path and username where necessary:

```powershell
& "C:\Program Files\PostgreSQL\18\bin\createdb.exe" -U YOUR_USERNAME ai_scam_shield
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U YOUR_USERNAME -d ai_scam_shield -f migrations\001_create_scam_messages.sql
```

The migration enables the already-installed extension in this database and
creates `scam_messages.embedding` as `VECTOR(384)`. It does not install or
build pgvector.

If the earlier 1536-dimension migration was already applied, recreate this
empty development table before reapplying the migration:

```sql
DROP TABLE IF EXISTS scam_messages;
```

Verify PostgreSQL and pgvector through the application:

```powershell
Invoke-RestMethod http://localhost:8000/api/scam/health
```

Or verify directly:

```powershell
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U YOUR_USERNAME -d ai_scam_shield -c "SELECT extversion FROM pg_extension WHERE extname = 'vector';"
```

## Run

From `apps/server`:

```powershell
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```

On first embedding use, Sentence Transformers downloads the model into its
local cache. Later requests run locally and do not need an API key or network
connection.

## Exercise the APIs

Generate and verify an embedding (the default response contains its dimension
and first five values):

```powershell
$body = @{ message = "Your bank account will be blocked. Verify immediately." } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://localhost:8000/api/scam/embedding -ContentType application/json -Body $body
```

To inspect the complete development vector:

```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:8000/api/scam/embedding?include_vector=true" -ContentType application/json -Body $body
```

Add a known scam (the frontend never supplies the embedding):

```powershell
$known = @{ text = "Your bank account will be blocked. Verify your KYC immediately."; category = "PHISHING" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://localhost:8000/api/scam/knowledge -ContentType application/json -Body $known
```

Seed three development examples:

```powershell
python scripts\seed_knowledge.py
```

Import a CSV with `text,category` columns (the importer also recognizes
`message`, `content`, or `scam_message` for text and `type`, `label`, or
`scam_category` for category):

```powershell
python scripts\import_scam_csv.py data\scam_messages.csv
```

Each row is validated, embedded locally, and inserted into PostgreSQL. Invalid
rows are rejected with their CSV line number. Accepted categories are
`PHISHING`, `BANKING`, `INVESTMENT`, `LOTTERY`, `ROMANCE`, `IMPERSONATION`,
`TECH_SUPPORT`, `JOB`, and `OTHER`.

Find the three closest records:

```powershell
$query = @{ message = "Your banking access will be suspended. Verify immediately." } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "http://localhost:8000/api/scam/search?limit=3" -ContentType application/json -Body $query
```

The SQLAlchemy `l2_distance` expression compiles to pgvector's `<->` operator.
Smaller distances mean closer vectors. The response sets `meaningful_match`
when the closest distance is at or below `SCAM_DISTANCE_THRESHOLD`.

## Calibrate the distance threshold

Run the reproducible held-out calibration:

```powershell
python scripts\calibrate_distance_threshold.py
```

The script deduplicates the SMS dataset, stores 80% of spam examples as the
conceptual training set, and evaluates the remaining spam plus all legitimate
messages. It saves precision, recall, F1, confusion counts, and distance
quantiles to `data/distance_calibration.json`.

For seed 42, `0.85` maximized F1 (precision `0.9375`, recall `0.7031`, F1
`0.8036`). A threshold meeting 90% recall had only `0.4021` precision, so the
application uses `0.85` for meaningful retrieval evidence. This threshold is
not a scam probability or final verdict and should be recalibrated whenever
the model or knowledge dataset changes.

## Inspect stored data

Open psql:

```powershell
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U YOUR_USERNAME -d ai_scam_shield
```

Then run:

```sql
\d+ scam_messages

SELECT id, text, category, vector_dims(embedding) AS dimensions, created_at
FROM scam_messages
ORDER BY id;
```

## Tests

Unit tests mock the local model and Groq, so they neither spend API credits nor
require network access:

```powershell
python -m pytest -q
```

To include the PostgreSQL storage/search integration test, first apply the
migration to a disposable test database:

```powershell
$env:TEST_DATABASE_URL = "postgresql+psycopg://YOUR_USERNAME:YOUR_PASSWORD@localhost:5432/ai_scam_shield_test"
python -m pytest -q
```
