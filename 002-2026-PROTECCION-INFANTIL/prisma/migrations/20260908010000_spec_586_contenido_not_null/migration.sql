-- SPEC-586 · Apriete de `contenidoId` a NOT NULL (cierre de SPEC-581, post-backfill).
--
-- El modelo de Prisma YA declara `contenidoId` requerido en Reporte y EventoExpediente
-- (el código nuevo siempre lo provee vía factory `crearReporteConTexto`); esta migración
-- alinea la BASE a ese contrato. Aplicar SOLO después de
-- `scripts/backfill-contenido-reporte.ts --confirm`: con cero NULLs el apriete es
-- instantáneo; si quedara alguna fila vieja sin migrar, falla en seco (a propósito).
--
-- Revierte la relajación deliberada de 20260907090000_spec_581_contenido_reporte, que
-- dejó la columna NULLABLE para permitir el backfill de filas existentes.

ALTER TABLE "Reporte" ALTER COLUMN "contenidoId" SET NOT NULL;
ALTER TABLE "EventoExpediente" ALTER COLUMN "contenidoId" SET NOT NULL;
