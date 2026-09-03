-- SPEC-380 (PR A · C4) — análisis persistente del comité + recomendación de
-- generar informe. Puramente ADITIVA: 5 columnas nullables sobre
-- `SolicitudComite`, 2 índices, 2 FKs. No cambia `resolucion` ni su semántica
-- (la lee el informe del caso — informes-caso.ts:193 — con informes ya emitidos).

ALTER TABLE "SolicitudComite" ADD COLUMN "analisis" TEXT;
ALTER TABLE "SolicitudComite" ADD COLUMN "analisisActualizadoEn" TIMESTAMP(3);
ALTER TABLE "SolicitudComite" ADD COLUMN "analisisPorId" TEXT;
ALTER TABLE "SolicitudComite" ADD COLUMN "recomendacionInformeEn" TIMESTAMP(3);
ALTER TABLE "SolicitudComite" ADD COLUMN "recomendacionPorId" TEXT;

ALTER TABLE "SolicitudComite"
    ADD CONSTRAINT "SolicitudComite_analisisPorId_fkey"
    FOREIGN KEY ("analisisPorId") REFERENCES "Usuario"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SolicitudComite"
    ADD CONSTRAINT "SolicitudComite_recomendacionPorId_fkey"
    FOREIGN KEY ("recomendacionPorId") REFERENCES "Usuario"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Consulta "casos con recomendación pendiente" del rector, tenant-scoped.
CREATE INDEX "SolicitudComite_colegioId_recomendacionInformeEn_idx"
    ON "SolicitudComite" ("colegioId", "recomendacionInformeEn");

-- Dos valores nuevos en el enum de auditoría. `ADD VALUE IF NOT EXISTS`
-- para que la migración sea idempotente contra re-aplicaciones.
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'COMITE_ANALISIS_ACTUALIZADO';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'COMITE_RECOMENDACION_INFORME';
