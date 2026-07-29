-- SPEC-115: catálogo geográfico real LATAM (GeoNames). Migración 100% ADITIVA:
-- columnas nuevas nullables o con default, índices nuevos, extensión pg_trgm.
-- Ninguna fila ni columna existente se elimina; las FK de reportes quedan intactas.

-- Extensión para búsqueda "contains" sobre el nombre normalizado (incluida en contrib
-- de la imagen pgvector/pgvector:pg16).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- AlterTable
ALTER TABLE "Ciudad" ADD COLUMN     "geonameId" INTEGER;
ALTER TABLE "Ciudad" ADD COLUMN     "nombreNormalizado" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Ciudad" ADD COLUMN     "poblacion" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Ciudad_geonameId_key" ON "Ciudad"("geonameId");

-- CreateIndex
CREATE INDEX "Ciudad_paisId_nombreNormalizado_idx" ON "Ciudad"("paisId", "nombreNormalizado");

-- CreateIndex (búsqueda ILIKE %…% del endpoint /api/ciudades/buscar sobre ~150k filas)
CREATE INDEX "Ciudad_nombreNormalizado_trgm_idx" ON "Ciudad" USING GIN ("nombreNormalizado" gin_trgm_ops);
