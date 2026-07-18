-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AccionAudit" ADD VALUE 'TEXTO_ORIGINAL_REVELADO';
ALTER TYPE "AccionAudit" ADD VALUE 'ANONIMIZACION_VALIDADA';
ALTER TYPE "AccionAudit" ADD VALUE 'ANONIMIZACION_RECHAZADA';

-- AlterTable
ALTER TABLE "Reporte" ADD COLUMN     "anonimizacionValidadaEn" TIMESTAMP(3),
ADD COLUMN     "anonimizacionValidadaPorId" TEXT;

-- CreateIndex
CREATE INDEX "Reporte_anonimizacionValidadaPorId_idx" ON "Reporte"("anonimizacionValidadaPorId");

-- AddForeignKey
ALTER TABLE "Reporte" ADD CONSTRAINT "Reporte_anonimizacionValidadaPorId_fkey" FOREIGN KEY ("anonimizacionValidadaPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
