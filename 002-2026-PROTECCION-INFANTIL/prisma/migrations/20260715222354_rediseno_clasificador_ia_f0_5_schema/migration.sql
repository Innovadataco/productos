-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CategoriaConducta" ADD VALUE 'EXTORSION';
ALTER TYPE "CategoriaConducta" ADD VALUE 'CONTENIDO_GENERADO_IA';
ALTER TYPE "CategoriaConducta" ADD VALUE 'DIFUSION_NO_CONSENTIDA';
ALTER TYPE "CategoriaConducta" ADD VALUE 'DOXING';

-- AlterTable
ALTER TABLE "ClasificacionIA" ADD COLUMN     "categoriasSecundarias" JSONB,
ADD COLUMN     "modeloCascada" TEXT,
ADD COLUMN     "posibleAgresorPar" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "usoCascada" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "votos" JSONB;

-- AlterTable
ALTER TABLE "DatasetEntrenamiento" ADD COLUMN     "textoAnonimizado" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Reporte" ADD COLUMN     "keywordsDetectadas" TEXT[],
ADD COLUMN     "prioridadAlta" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "EmbeddingDataset" (
    "id" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "vector" vector(768) NOT NULL,
    "modeloUsado" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmbeddingDataset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmbeddingDataset_datasetId_key" ON "EmbeddingDataset"("datasetId");

-- CreateIndex
CREATE INDEX "EmbeddingDataset_vector_idx" ON "EmbeddingDataset"("vector");

-- AddForeignKey
ALTER TABLE "EmbeddingDataset" ADD CONSTRAINT "EmbeddingDataset_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "DatasetEntrenamiento"("id") ON DELETE CASCADE ON UPDATE CASCADE;
