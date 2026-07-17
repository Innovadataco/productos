-- CreateEnum
CREATE TYPE "EstadoApelacion" AS ENUM ('RECIBIDA', 'EN_REVISION', 'ACEPTADA', 'RECHAZADA', 'VENCIDA');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AccionAudit" ADD VALUE 'APELACION_CREADA';
ALTER TYPE "AccionAudit" ADD VALUE 'APELACION_RESUELTA';
ALTER TYPE "AccionAudit" ADD VALUE 'APELACION_VENCIDA';
ALTER TYPE "AccionAudit" ADD VALUE 'APELACION_REHABILITADA';

-- CreateTable
CREATE TABLE "ApelacionIdentificador" (
    "id" TEXT NOT NULL,
    "identificador" TEXT NOT NULL,
    "plataformaId" TEXT NOT NULL,
    "tokenAcceso" TEXT NOT NULL,
    "estado" "EstadoApelacion" NOT NULL DEFAULT 'RECIBIDA',
    "motivoSolicitud" TEXT NOT NULL,
    "evidenciaUrl" TEXT,
    "respuestaAdmin" TEXT,
    "adminId" TEXT,
    "tipoVerificacion" TEXT NOT NULL,
    "contacto" TEXT,
    "smsCodigoHash" TEXT,
    "smsVerificado" BOOLEAN NOT NULL DEFAULT false,
    "smsIntentos" INTEGER NOT NULL DEFAULT 0,
    "pausaHasta" TIMESTAMP(3),
    "visibilidadRestaurada" BOOLEAN NOT NULL DEFAULT false,
    "derechoApelar" BOOLEAN NOT NULL DEFAULT true,
    "notaRehabilitacion" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApelacionIdentificador_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ApelacionIdentificador_tokenAcceso_key" ON "ApelacionIdentificador"("tokenAcceso");

-- CreateIndex
CREATE INDEX "ApelacionIdentificador_identificador_plataformaId_idx" ON "ApelacionIdentificador"("identificador", "plataformaId");

-- CreateIndex
CREATE INDEX "ApelacionIdentificador_estado_idx" ON "ApelacionIdentificador"("estado");

-- CreateIndex
CREATE INDEX "ApelacionIdentificador_tokenAcceso_idx" ON "ApelacionIdentificador"("tokenAcceso");

-- AddForeignKey
ALTER TABLE "ApelacionIdentificador" ADD CONSTRAINT "ApelacionIdentificador_plataformaId_fkey" FOREIGN KEY ("plataformaId") REFERENCES "Plataforma"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApelacionIdentificador" ADD CONSTRAINT "ApelacionIdentificador_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApelacionIdentificador" ADD CONSTRAINT "ApelacionIdentificador_identificador_plataformaId_fkey" FOREIGN KEY ("identificador", "plataformaId") REFERENCES "IdentificadorReportado"("identificador", "plataformaId") ON DELETE RESTRICT ON UPDATE CASCADE;

