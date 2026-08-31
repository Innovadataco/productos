-- SPEC-323: un reporte entra UNA sola vez como evento de un expediente.
--
-- Del 3er reporte vinculado en adelante, la oferta reenvía como "reporte previo" el
-- reporte que ya era evento del expediente, y se insertaba otra vez. El guard vive en
-- el DAL (expediente-repository); este índice es la red de seguridad en la base.

-- 1) Limpieza de los duplicados que dejó el bug. Son artefactos puros: mismo
--    expediente, mismo reporte, texto vacío. Se conserva el de menor ordenSecuencial
--    (el original) y se borran las copias posteriores. Sin esto el índice no puede crearse.
DELETE FROM "EventoExpediente" copia
USING "EventoExpediente" original
WHERE copia."reporteId" IS NOT NULL
  AND copia."expedienteId" = original."expedienteId"
  AND copia."reporteId" = original."reporteId"
  AND copia."ordenSecuencial" > original."ordenSecuencial";

-- 2) El contador del expediente quedó inflado en los afectados. Se recalcula contra
--    los eventos reales, solo donde difiere (los expedientes sin eventos no se tocan).
UPDATE "Expediente" x
SET "numEventos" = c.total
FROM (
    SELECT "expedienteId", COUNT(*)::int AS total
    FROM "EventoExpediente"
    GROUP BY "expedienteId"
) c
WHERE c."expedienteId" = x.id
  AND x."numEventos" <> c.total;

-- 3) El índice. `reporteId` es nullable y Postgres admite varios NULL en un índice
--    único, así que el alta manual de eventos del padre (sin reporteId) no se ve afectada.
CREATE UNIQUE INDEX "EventoExpediente_expedienteId_reporteId_key"
    ON "EventoExpediente"("expedienteId", "reporteId");
