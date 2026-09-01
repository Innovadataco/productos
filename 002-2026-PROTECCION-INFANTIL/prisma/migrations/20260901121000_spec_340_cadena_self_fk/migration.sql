-- SPEC-340 (A-68 · hallazgo T002) · la cadena de reportes gana casa propia.
--
-- Antes la vinculación SOLO existía como EventoExpediente (exigía expediente).
-- Con el expediente ahora manual (botón del padre, §4 del brief), la cadena
-- vive en el propio reporte. ADITIVA.

ALTER TABLE "Reporte" ADD COLUMN IF NOT EXISTS "reportePrincipalId" TEXT;

ALTER TABLE "Reporte" DROP CONSTRAINT IF EXISTS "Reporte_reportePrincipalId_fkey";
ALTER TABLE "Reporte" ADD CONSTRAINT "Reporte_reportePrincipalId_fkey"
    FOREIGN KEY ("reportePrincipalId") REFERENCES "Reporte"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "Reporte_reportePrincipalId_idx" ON "Reporte"("reportePrincipalId");

-- Guarda: si un reporte aparece como evento en DOS expedientes, el backfill de
-- abajo elegiría uno al azar — mejor reventar y que decida un humano.
DO $$
DECLARE repetidos INTEGER;
BEGIN
    SELECT COUNT(*) INTO repetidos FROM (
        SELECT "reporteId" FROM "EventoExpediente"
        WHERE "reporteId" IS NOT NULL
        GROUP BY "reporteId" HAVING COUNT(DISTINCT "expedienteId") > 1
    ) x;
    IF repetidos > 0 THEN
        RAISE EXCEPTION 'SPEC-340 ABORTA: % reporte(s) aparecen en mas de un expediente; el backfill de la cadena seria ambiguo. Resolver a mano.', repetidos;
    END IF;
END $$;

-- Backfill: el principal de cada expediente = su evento con ordenSecuencial
-- minimo que tenga reporteId; los demas eventos del expediente apuntan a el.
WITH principal AS (
    SELECT DISTINCT ON (ee."expedienteId") ee."expedienteId", ee."reporteId"
    FROM "EventoExpediente" ee
    WHERE ee."reporteId" IS NOT NULL
    ORDER BY ee."expedienteId", ee."ordenSecuencial" ASC
)
UPDATE "Reporte" r
SET "reportePrincipalId" = p."reporteId"
FROM "EventoExpediente" ee
JOIN principal p ON p."expedienteId" = ee."expedienteId"
WHERE ee."reporteId" = r."id"
  AND r."id" <> p."reporteId"
  AND r."reportePrincipalId" IS NULL;
