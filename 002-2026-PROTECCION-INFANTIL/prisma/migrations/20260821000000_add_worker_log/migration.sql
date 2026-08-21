-- SPEC-193 (Fase 1): bitácora de logs de workers y servicios.
-- ADITIVA: crea enum, tabla e índices; extiende AccionAudit. Sin DROP.

-- CreateEnum
CREATE TYPE "NivelLog" AS ENUM ('DEBUG', 'INFO', 'WARN', 'ERROR');

-- CreateTable
CREATE TABLE "worker_logs" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "servicio" TEXT NOT NULL,
    "nivel" "NivelLog" NOT NULL,
    "mensaje" VARCHAR(500) NOT NULL,
    "contextoJson" JSONB,
    "creadoEn" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),

    CONSTRAINT "worker_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_worker_logs_servicio_creado" ON "worker_logs" ("servicio", "creadoEn" DESC);

-- CreateIndex
CREATE INDEX "idx_worker_logs_nivel_creado" ON "worker_logs" ("nivel", "creadoEn" DESC);

-- CreateIndex
CREATE INDEX "idx_worker_logs_creado" ON "worker_logs" ("creadoEn" DESC);

-- AlterEnum
ALTER TYPE "AccionAudit" ADD VALUE 'LOGS_MANTENIMIENTO_PURGA';
ALTER TYPE "AccionAudit" ADD VALUE 'REPORTE_REASIGNADO_MANUAL';
