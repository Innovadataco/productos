-- SPEC-171 (Pilar B, I-51): probes de salud + incidentes de infraestructura.
-- ADITIVA: solo CREATE TABLE / CREATE INDEX / ALTER TYPE ADD VALUE. Sin DROP,
-- sin tocar índices existentes (I-53).

-- AlterEnum
ALTER TYPE "AccionAudit" ADD VALUE 'INFRA_INCIDENTE_ABIERTO';
ALTER TYPE "AccionAudit" ADD VALUE 'INFRA_INCIDENTE_RESUELTO';
ALTER TYPE "AccionAudit" ADD VALUE 'INFRA_EMAIL_ENVIADO';

-- CreateTable
CREATE TABLE "HealthProbe" (
    "id" TEXT NOT NULL,
    "senal" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "latenciaMs" INTEGER NOT NULL DEFAULT 0,
    "detalle" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealthProbe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidenteInfra" (
    "id" TEXT NOT NULL,
    "senal" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'ABIERTO',
    "inicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fin" TIMESTAMP(3),
    "detalle" TEXT,
    "ultimoEmailEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IncidenteInfra_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HealthProbe_senal_creadoEn_idx" ON "HealthProbe"("senal", "creadoEn");

-- CreateIndex
CREATE INDEX "IncidenteInfra_senal_estado_idx" ON "IncidenteInfra"("senal", "estado");
