BEGIN;

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS scam_messages (
    id BIGSERIAL PRIMARY KEY,
    text TEXT NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (
        category IN (
            'PHISHING',
            'BANKING',
            'INVESTMENT',
            'LOTTERY',
            'ROMANCE',
            'IMPERSONATION',
            'TECH_SUPPORT',
            'JOB',
            'OTHER'
        )
    ),
    embedding VECTOR(384) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_scam_messages_category
    ON scam_messages (category);

COMMIT;
