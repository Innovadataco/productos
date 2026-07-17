-- Recrear índices de similitud pgvector sobre embeddings.
-- Prisma no gestiona índices de tipo vector; las migraciones manuales de Prisma
-- pueden eliminarlos si se tocan las columnas vector. Verificar tras cada migrate deploy.
-- Nota: hnsw requiere pgvector >= 0.5.0; la imagen pgvector/pgvector:pg16 lo cumple.

DROP INDEX IF EXISTS "EmbeddingReporte_vector_idx";
CREATE INDEX "EmbeddingReporte_vector_idx" ON "EmbeddingReporte" USING hnsw (vector vector_cosine_ops);

DROP INDEX IF EXISTS "EmbeddingDataset_vector_idx";
CREATE INDEX "EmbeddingDataset_vector_idx" ON "EmbeddingDataset" USING hnsw (vector vector_cosine_ops);
