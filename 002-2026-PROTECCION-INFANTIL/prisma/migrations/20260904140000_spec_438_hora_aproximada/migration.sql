-- SPEC-438 (I-305) — la hora del hecho: exacta o estimada, pero nunca inventada.
--
-- `false` por default es correcto para las filas existentes SOLO en el sentido
-- de que no afirma que sean estimadas. Los reportes ya creados cuya
-- `fechaIncidente` coincide con su creación llevan una hora fabricada y NO se
-- tocan acá: qué hacer con ellos es decisión del CEO (punto 4 del radicado), y
-- reescribir datos de un informe con valor probatorio no se hace en una
-- migración silenciosa.
ALTER TABLE "Reporte" ADD COLUMN "horaAproximada" BOOLEAN NOT NULL DEFAULT false;
