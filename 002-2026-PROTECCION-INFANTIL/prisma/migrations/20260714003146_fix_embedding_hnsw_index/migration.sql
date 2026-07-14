-- Fix: EmbeddingReporte.vector no cabe en btree (limitación 2704 bytes)
-- pgvector requiere índice hnsw o ivfflat para búsqueda por similitud

DROP INDEX IF EXISTS "EmbeddingReporte_vector_idx";
CREATE INDEX "EmbeddingReporte_vector_idx" ON "EmbeddingReporte" USING hnsw (vector vector_cosine_ops);
