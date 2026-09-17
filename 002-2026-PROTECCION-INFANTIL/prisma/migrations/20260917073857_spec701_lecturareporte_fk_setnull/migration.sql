-- SPEC-701 (I-421) · Conservación 20 años del rastro de lectura del relato.
--
-- LecturaReporte.reporteId / .eventoId: FK Cascade -> SetNull. Borrar el Reporte o el
-- EventoExpediente ya NO borra la fila de LecturaReporte: sobrevive con contenidoId +
-- hashContenido (ambos NOT NULL), que es el rastro real (por hash del contenido, no por
-- el vinculo al padre). Alinea reporte/evento con usuario/codigo, que ya eran SetNull.
--
-- Migracion A MANO (I-420): puro swap de CONSTRAINT (DROP + ADD ON DELETE SET NULL).
-- NO toca @@index([reporteId, creadoEn]) ni @@index([usuarioId]) -- indice y constraint
-- son objetos distintos y un cambio de onDelete no los altera. No toca datos. (D-121 Datos.)

ALTER TABLE "LecturaReporte" DROP CONSTRAINT "LecturaReporte_reporteId_fkey";
ALTER TABLE "LecturaReporte" ADD CONSTRAINT "LecturaReporte_reporteId_fkey" FOREIGN KEY ("reporteId") REFERENCES "Reporte"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LecturaReporte" DROP CONSTRAINT "LecturaReporte_eventoId_fkey";
ALTER TABLE "LecturaReporte" ADD CONSTRAINT "LecturaReporte_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "EventoExpediente"("id") ON DELETE SET NULL ON UPDATE CASCADE;
