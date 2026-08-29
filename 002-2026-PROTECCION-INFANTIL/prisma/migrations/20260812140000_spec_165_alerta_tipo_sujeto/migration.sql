-- SPEC-165: extiende AlertaColegio a estudiante/profesor/acudiente.
-- Migración aditiva: nullable la FK histórica, nuevas columnas/relaciones/constraints,
-- backfill de tipoSujeto = 'ESTUDIANTE' para alertas previas.

-- Make existing student FK nullable (historical alerts remain valid)
ALTER TABLE "AlertaColegio" ALTER COLUMN "identificadorAlumnoId" DROP NOT NULL;

-- Add new columns
ALTER TABLE "AlertaColegio" ADD COLUMN "identificadorProfesorId" TEXT;
ALTER TABLE "AlertaColegio" ADD COLUMN "identificadorAcudienteId" TEXT;
ALTER TABLE "AlertaColegio" ADD COLUMN "tipoSujeto" TEXT NOT NULL DEFAULT 'ESTUDIANTE';

-- Backfill historical alerts as student alerts
UPDATE "AlertaColegio" SET "tipoSujeto" = 'ESTUDIANTE';

-- Add foreign keys to the new identifier tables
ALTER TABLE "AlertaColegio" ADD CONSTRAINT "AlertaColegio_identificadorProfesorId_fkey"
    FOREIGN KEY ("identificadorProfesorId") REFERENCES "IdentificadorProfesor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AlertaColegio" ADD CONSTRAINT "AlertaColegio_identificadorAcudienteId_fkey"
    FOREIGN KEY ("identificadorAcudienteId") REFERENCES "IdentificadorAcudiente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Unique constraints for professor and guardian subject types
CREATE UNIQUE INDEX "AlertaColegio_colegioId_reporteId_identificadorProfesorId_key"
    ON "AlertaColegio"("colegioId", "reporteId", "identificadorProfesorId");

CREATE UNIQUE INDEX "AlertaColegio_colegioId_reporteId_identificadorAcudienteId_key"
    ON "AlertaColegio"("colegioId", "reporteId", "identificadorAcudienteId");

-- Index for filtering by subject type
CREATE INDEX "AlertaColegio_tipoSujeto_idx" ON "AlertaColegio"("tipoSujeto");
