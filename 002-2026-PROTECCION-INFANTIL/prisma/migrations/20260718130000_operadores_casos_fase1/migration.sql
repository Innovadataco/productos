-- Manual migration for spec 018 operators

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AccionAudit" ADD VALUE 'OPERADOR_CREADO';
ALTER TYPE "AccionAudit" ADD VALUE 'OPERADOR_ACTIVADO';
ALTER TYPE "AccionAudit" ADD VALUE 'OPERADOR_DESACTIVADO';
ALTER TYPE "AccionAudit" ADD VALUE 'OPERADOR_ASIGNADO';
ALTER TYPE "AccionAudit" ADD VALUE 'OPERADOR_REASIGNADO';
ALTER TYPE "AccionAudit" ADD VALUE 'CASO_CONFIRMADO';
ALTER TYPE "AccionAudit" ADD VALUE 'CASO_CORREGIDO';
ALTER TYPE "AccionAudit" ADD VALUE 'CASO_DADO_DE_BAJA';
ALTER TYPE "AccionAudit" ADD VALUE 'CASO_ESCALADO';
ALTER TYPE "AccionAudit" ADD VALUE 'CASO_NOTA_AGREGADA';

-- AlterEnum
ALTER TYPE "RolUsuario" ADD VALUE 'OPERADOR';

-- DropIndex

-- DropIndex

-- AlterTable
ALTER TABLE "ApelacionIdentificador" ADD COLUMN     "operadorId" TEXT;

-- AlterTable
ALTER TABLE "Reporte" ADD COLUMN     "operadorId" TEXT;

-- CreateTable
CREATE TABLE "PerfilOperador" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "cupoMaximo" INTEGER NOT NULL DEFAULT 10,
    "esRevisorDeApelaciones" BOOLEAN NOT NULL DEFAULT false,
    "notasInternas" TEXT,
    "creadoPorId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerfilOperador_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PerfilOperador_usuarioId_key" ON "PerfilOperador"("usuarioId");

-- CreateIndex
CREATE INDEX "PerfilOperador_usuarioId_idx" ON "PerfilOperador"("usuarioId");

-- CreateIndex
CREATE INDEX "PerfilOperador_creadoPorId_idx" ON "PerfilOperador"("creadoPorId");

-- CreateIndex
CREATE INDEX "ApelacionIdentificador_operadorId_idx" ON "ApelacionIdentificador"("operadorId");

-- CreateIndex
CREATE INDEX "Reporte_operadorId_idx" ON "Reporte"("operadorId");

-- AddForeignKey
ALTER TABLE "PerfilOperador" ADD CONSTRAINT "PerfilOperador_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerfilOperador" ADD CONSTRAINT "PerfilOperador_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reporte" ADD CONSTRAINT "Reporte_operadorId_fkey" FOREIGN KEY ("operadorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApelacionIdentificador" ADD CONSTRAINT "ApelacionIdentificador_operadorId_fkey" FOREIGN KEY ("operadorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

