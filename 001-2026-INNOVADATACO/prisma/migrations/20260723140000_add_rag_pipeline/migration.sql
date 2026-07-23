-- Pipeline RAG (spec 003): campos de identidad del espacio vectorial, FTS en
-- español, índices HNSW (coseno) y GIN, y borrado en cascada de los fragmentos.
-- Prisma no tipa `vector` ni `tsvector`; por eso el vector, el tsvector y sus
-- índices van en SQL crudo (FR-012, D-020, D-019).

-- Extensión para búsqueda textual sin acentos (rama FTS, FR-015)
CREATE EXTENSION IF NOT EXISTS unaccent;

-- `unaccent` es STABLE, no IMMUTABLE, así que no puede usarse tal cual en una
-- columna GENERATED ni en un índice funcional. Envoltura IMMUTABLE documentada
-- (Postgres wiki): fija el diccionario 'unaccent'. Si el diccionario cambiara,
-- habría que reindexar — no ocurre en operación normal.
CREATE OR REPLACE FUNCTION f_unaccent(text)
  RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
AS $$ SELECT unaccent('unaccent', $1) $$;

-- Identidad del espacio vectorial por fragmento (FR-021, FR-026)
ALTER TABLE "DocumentoChunk"
  ADD COLUMN "embeddingModel" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "enrichConfig"   TEXT NOT NULL DEFAULT 'none';

-- FTS sobre el contenido PLANO, nunca el enriquecido (FR-027).
-- Columna generada: la mantiene la BD, la app nunca la escribe.
ALTER TABLE "DocumentoChunk"
  ADD COLUMN "contenidoFts" tsvector
  GENERATED ALWAYS AS (to_tsvector('spanish', f_unaccent(coalesce("contenido", '')))) STORED;

-- El índice btree sobre embedding no acelera la similitud: se reemplaza (D-020)
DROP INDEX IF EXISTS "DocumentoChunk_embedding_idx";

-- HNSW con distancia coseno para la rama vectorial (D-020, SC-010/SC-016)
CREATE INDEX "DocumentoChunk_embedding_hnsw_idx"
  ON "DocumentoChunk" USING hnsw ("embedding" vector_cosine_ops);

-- GIN sobre el tsvector para la rama FTS (D-019, SC-016)
CREATE INDEX "DocumentoChunk_contenidoFts_gin_idx"
  ON "DocumentoChunk" USING gin ("contenidoFts");

-- Filtro por modelo + enriquecimiento vigentes y conteo de pendientes (FR-021b/c)
CREATE INDEX "DocumentoChunk_embeddingModel_enrichConfig_idx"
  ON "DocumentoChunk" ("embeddingModel", "enrichConfig");

-- Los fragmentos son datos derivados del documento: al borrarlo, se van con él
-- (FR-022, D-021). La baja lógica (activo=false) NO borra; la búsqueda excluye.
ALTER TABLE "DocumentoChunk" DROP CONSTRAINT "DocumentoChunk_documentoId_fkey";
ALTER TABLE "DocumentoChunk"
  ADD CONSTRAINT "DocumentoChunk_documentoId_fkey"
  FOREIGN KEY ("documentoId") REFERENCES "DocumentoOficial"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
