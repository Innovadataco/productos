-- Dependencias fin→inicio del Gantt (spec 016, FR-003).
--
-- ADITIVA: dos columnas nuevas, NULLABLE, sin default y sin backfill. No altera
-- datos ni otras columnas. `dependeDe` guarda un id de item del Gantt
-- ("entregable:x" | "hito:y"); es polimórfico, así que no lleva FK — una
-- referencia colgada simplemente no genera conflicto (se ignora al detectar).
ALTER TABLE "entregables" ADD COLUMN "dependeDe" TEXT;
ALTER TABLE "hitos_proyecto" ADD COLUMN "dependeDe" TEXT;
