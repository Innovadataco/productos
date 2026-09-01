-- SPEC-344 (A-69 · C1): datos del colegio en el TokenRegistro.
-- Aditiva: dos columnas TEXT nullable. Los tokens vivos (todos PARENT) quedan
-- con NULL — coherente: solo aplican al flujo del colegio.
ALTER TABLE "TokenRegistro"
  ADD COLUMN "nombreColegio" TEXT,
  ADD COLUMN "nit" TEXT;
