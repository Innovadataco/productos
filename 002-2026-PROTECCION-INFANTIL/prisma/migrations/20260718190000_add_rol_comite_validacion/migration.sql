-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AccionAudit" ADD VALUE 'CASO_RESUELTO_POR_COMITE';
ALTER TYPE "AccionAudit" ADD VALUE 'CASO_REASIGNADO';

-- AlterEnum
ALTER TYPE "RolUsuario" ADD VALUE 'COMITE_VALIDACION';

-- AlterTable
ALTER TABLE "PerfilOperador" ADD COLUMN     "esComite" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Reporte" ADD COLUMN     "comiteId" TEXT;

-- CreateTable
CREATE TABLE "SolicitudComite" (
    "id" TEXT NOT NULL,
    "reporteId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "comiteId" TEXT,
    "operadorId" TEXT,
    "motivo" TEXT NOT NULL,
    "resolucion" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resueltoEn" TIMESTAMP(3),

    CONSTRAINT "SolicitudComite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SolicitudComite_reporteId_key" ON "SolicitudComite"("reporteId");

-- CreateIndex
CREATE UNIQUE INDEX "SolicitudComite_numero_key" ON "SolicitudComite"("numero");

-- CreateIndex
CREATE INDEX "SolicitudComite_estado_idx" ON "SolicitudComite"("estado");

-- CreateIndex
CREATE INDEX "SolicitudComite_comiteId_idx" ON "SolicitudComite"("comiteId");

-- CreateIndex
CREATE INDEX "SolicitudComite_operadorId_idx" ON "SolicitudComite"("operadorId");

-- CreateIndex
CREATE INDEX "SolicitudComite_creadoEn_idx" ON "SolicitudComite"("creadoEn");

-- CreateIndex
CREATE INDEX "CorreccionAdmin_adminId_idx" ON "CorreccionAdmin"("adminId");

-- CreateIndex
CREATE INDEX "PerfilOperador_esComite_idx" ON "PerfilOperador"("esComite");

-- CreateIndex
CREATE INDEX "Reporte_comiteId_idx" ON "Reporte"("comiteId");

-- AddForeignKey
ALTER TABLE "Reporte" ADD CONSTRAINT "Reporte_comiteId_fkey" FOREIGN KEY ("comiteId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudComite" ADD CONSTRAINT "SolicitudComite_reporteId_fkey" FOREIGN KEY ("reporteId") REFERENCES "Reporte"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudComite" ADD CONSTRAINT "SolicitudComite_comiteId_fkey" FOREIGN KEY ("comiteId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudComite" ADD CONSTRAINT "SolicitudComite_operadorId_fkey" FOREIGN KEY ("operadorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
