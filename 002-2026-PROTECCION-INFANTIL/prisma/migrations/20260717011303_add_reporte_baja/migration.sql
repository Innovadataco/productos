-- CreateEnum
CREATE TYPE "MotivoBajaReporte" AS ENUM ('RETIRO_LIMPIEZA', 'REPORTE_FALSO', 'ORDEN_LEGAL');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to the
-- enum.


ALTER TYPE "AccionAudit" ADD VALUE 'REPORT_DEACTIVATE';
ALTER TYPE "AccionAudit" ADD VALUE 'REPORT_REACTIVATE';

-- DropIndex
DROP INDEX IF EXISTS "EmbeddingDataset_vector_idx";

-- DropIndex
DROP INDEX IF EXISTS "EmbeddingReporte_vector_idx";

-- AlterTable
ALTER TABLE "Reporte" ADD COLUMN     "eliminado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "eliminadoEn" TIMESTAMP(3),
ADD COLUMN     "eliminadoPorId" TEXT,
ADD COLUMN     "motivoBaja" "MotivoBajaReporte",
ADD COLUMN     "notaBaja" TEXT;

-- CreateIndex
CREATE INDEX "Reporte_eliminado_idx" ON "Reporte"("eliminado");

-- CreateIndex
CREATE INDEX "Reporte_eliminadoPorId_idx" ON "Reporte"("eliminadoPorId");

-- AddForeignKey
ALTER TABLE "Reporte" ADD CONSTRAINT "Reporte_eliminadoPorId_fkey" FOREIGN KEY ("eliminadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Índices hnsw para búsqueda por similitud. Prisma no los gestiona; verificar tras cada migrate deploy.
CREATE INDEX IF NOT EXISTS "EmbeddingReporte_vector_idx" ON "EmbeddingReporte" USING hnsw (vector vector_cosine_ops);
CREATE INDEX IF NOT EXISTS "EmbeddingDataset_vector_idx" ON "EmbeddingDataset" USING hnsw (vector vector_cosine_ops);
