-- fechaInicio del entregable (spec 015, FR-006).
--
-- ADITIVA: una columna nueva, NULLABLE, sin default forzado y sin backfill. Los
-- entregables existentes quedan con fechaInicio = NULL; el Gantt usa su
-- createdAt como inicio para no perderlos. No altera datos ni otras columnas.
ALTER TABLE "entregables" ADD COLUMN "fechaInicio" TIMESTAMP(3);
