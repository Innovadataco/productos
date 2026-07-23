-- Spec 004 (I-006): clave natural única en los catálogos de licitaciones.
--
-- Sin esta restricción no es posible un seed idempotente por upsert, y la unicidad
-- quedaría a merced del orden de ejecución en vez de garantizarla la base
-- (research D-03). Se aplica sobre tablas vacías: índice instantáneo y sin riesgo
-- de violación.
--
-- Deliberadamente NO se añade unicidad a "AiModel": es configuración de usuario, y
-- dos entradas del mismo modelo con parámetros distintos es un uso legítimo.

CREATE UNIQUE INDEX "EntidadLicitacion_key_key" ON "EntidadLicitacion"("key");

CREATE UNIQUE INDEX "LicitacionStatus_key_key" ON "LicitacionStatus"("key");
