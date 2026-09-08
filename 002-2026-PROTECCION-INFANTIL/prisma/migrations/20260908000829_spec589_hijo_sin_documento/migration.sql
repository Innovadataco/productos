-- SPEC-589 (06-09-2026): el CEO ordenó quitar tipo y número de documento de la
-- ficha del hijo/familiar del padre. Se ELIMINAN las columnas (no solo se
-- ocultan). ÚNICA excepción a la regla de migraciones aditivas/no destructivas,
-- autorizada verbalmente por el dueño del dato (Jelkin, 06-09-2026): todos los
-- datos son de prueba del CEO y el borrado está autorizado por el dueño.
--
-- Seguridad para la réplica BI: la tabla Hijo se publica a bi_replica con lista
-- de columnas EXPLÍCITA (id,anioNacimiento,sexo,creadoEn,actualizadoEn,estado)
-- que NO incluía estas columnas, y ambas están en la lista de exclusión de
-- privacidad del BI — el DROP no rompe la réplica.
DROP INDEX IF EXISTS "Hijo_documentoTipo_documentoNumero_idx";
DROP INDEX IF EXISTS "Hijo_usuarioId_documentoTipo_documentoNumero_key";
ALTER TABLE "Hijo" DROP COLUMN "documentoNumero";
ALTER TABLE "Hijo" DROP COLUMN "documentoTipo";
