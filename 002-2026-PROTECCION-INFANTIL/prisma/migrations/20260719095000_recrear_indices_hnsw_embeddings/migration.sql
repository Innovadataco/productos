-- Migración aditiva: recrear índices HNSW sobre embeddings.
-- Prisma no gestiona índices de tipo vector; si una migración anterior los eliminó,
-- esta migración los recrea sin pérdida de datos.
-- Requiere pgvector >= 0.5.0 (imagen pgvector/pgvector:pg16).

CREATE EXTENSION IF NOT EXISTS vector;

CREATE INDEX IF NOT EXISTS "EmbeddingReporte_vector_idx" ON "EmbeddingReporte" USING hnsw (vector vector_cosine_ops);
CREATE INDEX IF NOT EXISTS "EmbeddingDataset_vector_idx" ON "EmbeddingDataset" USING hnsw (vector vector_cosine_ops);
