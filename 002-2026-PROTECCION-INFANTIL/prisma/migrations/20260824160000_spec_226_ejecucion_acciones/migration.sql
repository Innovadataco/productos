-- SPEC-226 (002-PI-mega-cola): ejecución de acciones automáticas (reglas modo EJECUTA).
-- Migración 100% aditiva: CREATE TYPE ×3, ALTER TYPE ... ADD VALUE IF NOT EXISTS ×3,
-- CREATE TABLE ejecuciones_accion + FK a recomendaciones + 3 índices. Cero DROP.

CREATE TYPE "TipoAccionEjecutable" AS ENUM ('CREAR_BONO', 'ENVIAR_NOTIFICACION', 'ASIGNAR_OPERADOR', 'CREAR_ALERTA');
CREATE TYPE "EstadoEjecucion" AS ENUM ('EJECUTADA', 'REVERTIDA', 'FALLIDA');
CREATE TYPE "OrigenEjecucion" AS ENUM ('AUTOMATICA', 'MANUAL_ADMIN');

ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'ANALISIS_ACCION_EJECUTADA';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'ANALISIS_ACCION_FALLIDA';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'ANALISIS_ACCION_REVERTIDA';

CREATE TABLE "ejecuciones_accion" (
    "id" TEXT NOT NULL,
    "recomendacionId" TEXT NOT NULL,
    "reglaId" TEXT NOT NULL,
    "tipoAccion" "TipoAccionEjecutable" NOT NULL,
    "parametros" JSONB NOT NULL,
    "estado" "EstadoEjecucion" NOT NULL,
    "resultado" JSONB,
    "motivoFallo" TEXT,
    "origenEjecucion" "OrigenEjecucion" NOT NULL,
    "ejecutadaPorAdminId" TEXT,
    "ejecutadaEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revertidaEn" TIMESTAMPTZ(6),
    "revertidaPorAdminId" TEXT,
    "motivoReversion" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ejecuciones_accion_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ejecuciones_accion_recomendacionId_fkey"
        FOREIGN KEY ("recomendacionId") REFERENCES "recomendaciones"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "ejecuciones_accion_recomendacionId_idx" ON "ejecuciones_accion"("recomendacionId");
CREATE INDEX "ejecuciones_accion_reglaId_ejecutadaEn_idx" ON "ejecuciones_accion"("reglaId", "ejecutadaEn");
CREATE INDEX "ejecuciones_accion_estado_ejecutadaEn_idx" ON "ejecuciones_accion"("estado", "ejecutadaEn");
