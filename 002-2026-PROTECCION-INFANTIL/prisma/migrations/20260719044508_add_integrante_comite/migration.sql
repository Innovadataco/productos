-- CreateEnum
CREATE TYPE "TipoIdentificacionIntegrante" AS ENUM ('CEDULA_CIUDADANIA', 'CEDULA_EXTRANJERIA', 'PASAPORTE', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoIntegranteComite" AS ENUM ('ACTIVO', 'INACTIVO');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AccionAudit" ADD VALUE 'COMITE_CREADO';
ALTER TYPE "AccionAudit" ADD VALUE 'COMITE_ACTIVADO';
ALTER TYPE "AccionAudit" ADD VALUE 'COMITE_DESACTIVADO';
ALTER TYPE "AccionAudit" ADD VALUE 'COMITE_PASSWORD_REGENERADA';
ALTER TYPE "AccionAudit" ADD VALUE 'COMITE_EMAIL_REENVIADO';
ALTER TYPE "AccionAudit" ADD VALUE 'COMITE_INTEGRANTE_CREADO';
ALTER TYPE "AccionAudit" ADD VALUE 'COMITE_INTEGRANTE_ACTUALIZADO';
ALTER TYPE "AccionAudit" ADD VALUE 'COMITE_INTEGRANTE_INACTIVADO';

-- AlterTable
ALTER TABLE "PerfilOperador" ADD COLUMN     "ultimoEmailNotificacionEn" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "IntegranteComite" (
    "id" TEXT NOT NULL,
    "comiteId" TEXT NOT NULL,
    "nombres" TEXT NOT NULL,
    "apellidos" TEXT NOT NULL,
    "tipoIdentificacion" "TipoIdentificacionIntegrante" NOT NULL,
    "numeroIdentificacion" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaFin" TIMESTAMP(3),
    "estado" "EstadoIntegranteComite" NOT NULL DEFAULT 'ACTIVO',
    "creadoPorId" TEXT NOT NULL,
    "modificadoPorId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegranteComite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IntegranteComite_comiteId_idx" ON "IntegranteComite"("comiteId");

-- CreateIndex
CREATE INDEX "IntegranteComite_estado_idx" ON "IntegranteComite"("estado");

-- CreateIndex
CREATE INDEX "IntegranteComite_tipoIdentificacion_idx" ON "IntegranteComite"("tipoIdentificacion");

-- AddForeignKey
ALTER TABLE "IntegranteComite" ADD CONSTRAINT "IntegranteComite_comiteId_fkey" FOREIGN KEY ("comiteId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegranteComite" ADD CONSTRAINT "IntegranteComite_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegranteComite" ADD CONSTRAINT "IntegranteComite_modificadoPorId_fkey" FOREIGN KEY ("modificadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
