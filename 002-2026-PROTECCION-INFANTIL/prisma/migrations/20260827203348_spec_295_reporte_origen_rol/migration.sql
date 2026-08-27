-- SPEC-295 (002-PI-196 · I-146): agrega columna `origenRol` a `reportes`.
-- Aditiva pura: NULL para todos los reportes existentes (anónimos históricos).
-- "PARENT" para nuevos reportes desde /dashboard/padre/reportar.
-- PostgreSQL 11+ ejecuta ADD COLUMN sin default en O(1) (metadata-only).

ALTER TABLE "reportes" ADD COLUMN "origenRol" TEXT;
