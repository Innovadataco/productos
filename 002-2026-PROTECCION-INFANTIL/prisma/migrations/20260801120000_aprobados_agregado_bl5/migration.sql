-- SPEC-131 (BL-5, O-1): contadores aprobados en IdentificadorReportado.
-- ADITIVA: dos columnas con default. El BACKFILL corre DENTRO de esta migración
-- (predicado aprobado único, spec 089/D-08: estado CLASIFICADO/CORREGIDO,
-- categoría ∉ {SPAM, OTRO}, no eliminado), así el flip de visibility.ts a leer
-- aprobados funciona desde el primer request tras el deploy — sin ventana de
-- contadores en cero.

ALTER TABLE "IdentificadorReportado" ADD COLUMN "reportesAprobados" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "IdentificadorReportado" ADD COLUMN "autenticadosAprobados" INTEGER NOT NULL DEFAULT 0;

-- Backfill: aprobados totales por identificador+plataforma
UPDATE "IdentificadorReportado" ir
SET "reportesAprobados" = sub.total
FROM (
    SELECT r."identificador", r."plataformaId", COUNT(*)::int AS total
    FROM "Reporte" r
    INNER JOIN "ClasificacionIA" c ON c."reporteId" = r.id
    WHERE r.estado IN ('CLASIFICADO', 'CORREGIDO')
      AND r.eliminado = false
      AND c.categoria NOT IN ('SPAM', 'OTRO')
    GROUP BY r."identificador", r."plataformaId"
) sub
WHERE ir."identificador" = sub."identificador"
  AND ir."plataformaId" = sub."plataformaId";

-- Backfill: autenticados aprobados (esAnonimo = false)
UPDATE "IdentificadorReportado" ir
SET "autenticadosAprobados" = sub.total
FROM (
    SELECT r."identificador", r."plataformaId", COUNT(*)::int AS total
    FROM "Reporte" r
    INNER JOIN "ClasificacionIA" c ON c."reporteId" = r.id
    WHERE r.estado IN ('CLASIFICADO', 'CORREGIDO')
      AND r.eliminado = false
      AND r."esAnonimo" = false
      AND c.categoria NOT IN ('SPAM', 'OTRO')
    GROUP BY r."identificador", r."plataformaId"
) sub
WHERE ir."identificador" = sub."identificador"
  AND ir."plataformaId" = sub."plataformaId";
