-- Run this once in the Supabase SQL editor before Week 2

-- Enable the pgvector extension (makes the vector type available)
CREATE EXTENSION IF NOT EXISTS vector;

-- One row per uploaded PDF
CREATE TABLE IF NOT EXISTS documents (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    filename     TEXT        NOT NULL,
    storage_path TEXT        NOT NULL,
    size_bytes   BIGINT      NOT NULL,
    -- pending → processing → ready | error
    status       TEXT        NOT NULL DEFAULT 'pending',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One row per text chunk extracted from a document.
-- embedding holds a 1536-dim vector (output of text-embedding-3-small).
CREATE TABLE IF NOT EXISTS chunks (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID        NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index INTEGER     NOT NULL,
    content     TEXT        NOT NULL,
    embedding   vector(1536),
    page_number INTEGER,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- IVFFlat index enables fast approximate nearest-neighbor search.
-- Build after loading data; lists ≈ rows / 1000 is the pgvector recommendation.
CREATE INDEX IF NOT EXISTS chunks_embedding_idx
    ON chunks USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- One row per conversation (a series of Q&A exchanges)
CREATE TABLE IF NOT EXISTS conversations (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    title      TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One row per message (user question or assistant answer)
CREATE TABLE IF NOT EXISTS messages (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role            TEXT        NOT NULL CHECK (role IN ('user', 'assistant')),
    content         TEXT        NOT NULL,
    source_chunks   UUID[],     -- chunk IDs cited in this answer
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
