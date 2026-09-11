-- SPEC-610 · El pase de acceso externo cuelga del EXPEDIENTE, no del Reporte.
--
-- Modelo nuevo (D-123/SPEC-604): un pase abre el EXPEDIENTE completo del padre, no un
-- único Reporte. `CodigoAccesoContenido` deja de apuntar a `reporteId` y pasa a `expedienteId`.
-- El servicio/API que canjea y lee sobre el expediente los reescribe Dev 2 en el MISMO PR
-- (merge atómico): este esquema no puede quedar suelto en main sin su service.
--
-- Producción: `CodigoAccesoContenido` = 0 filas (el pase nunca se ejercitó en vivo —
-- LecturaReporte=0, /canjear-acceso sin cablear). El backfill y el DELETE de abajo son
-- no-op en prod y en CI (la BD de test la arma `migrate deploy` sin semilla).
--
-- OJO (corrección Dev 1): el backfill NO es «correcto para el caso general». `EventoExpediente`
-- es único por el PAR (expedienteId, reporteId), NO por reporteId: el MISMO reporte puede vivir
-- en DOS expedientes. Si un pase apunta a un reporteId así, el `UPDATE ... FROM` de abajo matchea
-- dos filas y Postgres elige una ARBITRARIAMENTE — el pase abriría el expediente de OTRO menor.
-- Por eso el paso 0 es un PRE-CHECK fail-loud que ABORTA ante ese cruce entre expedientes; nunca
-- adivina sobre datos de un menor. (El caso «mismo reporte, mismo expediente» ya lo impide el
-- único del par, así que el pre-check vigila SOLO el cruce entre expedientes distintos.)

-- 0) PRE-CHECK (fail-loud). Antes de tocar nada: si algún `reporteId` REFERENCIADO POR UN
--    PASE aparece en más de un expediente distinto, el backfill (paso 2) elegiría el destino
--    al azar y el pase podría abrir el expediente equivocado. Paramos y lo decimos. Se acota a
--    los reporteId que un pase referencia — son exactamente las filas que el UPDATE mutaría;
--    un reporte en dos expedientes SIN pase es un estado válido del modelo y no se toca.
DO $$
DECLARE
    ambiguos INTEGER;
BEGIN
    SELECT count(*) INTO ambiguos FROM (
        SELECT ee."reporteId"
          FROM "EventoExpediente" ee
         WHERE ee."reporteId" IN (
                   SELECT "reporteId" FROM "CodigoAccesoContenido" WHERE "reporteId" IS NOT NULL
               )
         GROUP BY ee."reporteId"
        HAVING count(DISTINCT ee."expedienteId") > 1
    ) t;
    IF ambiguos > 0 THEN
        RAISE EXCEPTION 'SPEC-610: % reporteId(s) con pase mapean a mas de un expediente distinto; el backfill elegiria el destino ARBITRARIAMENTE (el pase podria abrir el expediente de otro menor). Abortado (fail-loud): resolve la ambiguedad antes de migrar.', ambiguos;
    END IF;
END $$;

-- 1) Nueva FK como NULLABLE, para backfillear antes de exigirla.
ALTER TABLE "CodigoAccesoContenido" ADD COLUMN "expedienteId" TEXT;

-- 2) Backfill: cada pase apuntaba a un `reporteId`; su expediente destino es el que
--    CONTIENE ese reporte como evento (`EventoExpediente.reporteId` -> `expedienteId`).
UPDATE "CodigoAccesoContenido" cac
   SET "expedienteId" = ee."expedienteId"
  FROM "EventoExpediente" ee
 WHERE ee."reporteId" = cac."reporteId"
   AND cac."expedienteId" IS NULL;

-- 3) Un pase cuyo reporte no pertenece a ningún expediente ya no tiene destino en el
--    modelo nuevo (el pase es AL expediente). Es un token efímero (vigencia 30 min),
--    no dato durable: se descarta para poder exigir NOT NULL. En prod son 0 filas.
DELETE FROM "CodigoAccesoContenido" WHERE "expedienteId" IS NULL;

-- 4) Ahora obligatoria.
ALTER TABLE "CodigoAccesoContenido" ALTER COLUMN "expedienteId" SET NOT NULL;

-- 5) Retirar la vieja FK / índice / columna de `reporteId`.
ALTER TABLE "CodigoAccesoContenido" DROP CONSTRAINT "CodigoAccesoContenido_reporteId_fkey";
DROP INDEX "CodigoAccesoContenido_reporteId_idx";
ALTER TABLE "CodigoAccesoContenido" DROP COLUMN "reporteId";

-- 6) Nueva FK / índice de `expedienteId` (espeja `onDelete: Cascade` del schema; mismos
--    nombres que generaría Prisma -> sin drift en un `migrate diff` futuro).
CREATE INDEX "CodigoAccesoContenido_expedienteId_idx" ON "CodigoAccesoContenido"("expedienteId");
ALTER TABLE "CodigoAccesoContenido" ADD CONSTRAINT "CodigoAccesoContenido_expedienteId_fkey" FOREIGN KEY ("expedienteId") REFERENCES "Expediente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
