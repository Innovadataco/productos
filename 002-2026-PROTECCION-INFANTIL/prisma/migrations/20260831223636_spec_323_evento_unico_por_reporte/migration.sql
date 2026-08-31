-- SPEC-323: un reporte entra UNA sola vez como evento de un expediente.
--
-- Del 3er reporte vinculado en adelante, la oferta reenvía como "reporte previo" el
-- reporte que ya era evento del expediente, y se insertaba otra vez. El guard vive en
-- el DAL (expediente-repository); este índice es la red de seguridad en la base.
--
-- Sin DELETE a propósito (decisión CEO 31-08-2026): producción no tiene duplicados, y
-- una migración destructiva que no necesitamos es riesgo sin beneficio. Si el índice
-- llegara a fallar por duplicados aparecidos después, que reviente el deploy y se mire
-- a mano — nunca borrar filas en silencio.

-- 1) El contador del expediente pudo quedar inflado. Se recalcula contra los eventos
--    reales, solo donde difiere. Idempotente y no destructivo (los expedientes sin
--    eventos no entran en el agrupado y quedan como están).
UPDATE "Expediente" x
SET "numEventos" = c.total
FROM (
    SELECT "expedienteId", COUNT(*)::int AS total
    FROM "EventoExpediente"
    GROUP BY "expedienteId"
) c
WHERE c."expedienteId" = x.id
  AND x."numEventos" <> c.total;

-- 2) El índice. `reporteId` es nullable y Postgres admite varios NULL en un índice
--    único, así que el alta manual de eventos del padre (sin reporteId) no se ve afectada.
CREATE UNIQUE INDEX "EventoExpediente_expedienteId_reporteId_key"
    ON "EventoExpediente"("expedienteId", "reporteId");
