-- SPEC-320 (§2.1) · Unicidad del identificador por colegio, cruzando los tres sujetos.
-- Diseño ASIMÉTRICO (opción A del CEO): estudiante+profesor con red dura de BD por
-- colegio; acudiente se MANTIENE por-acudiente (excepción padre-de-dos-hijos, ver
-- schema). Todos: índice único PARCIAL (WHERE estado=activo) + NULLS NOT DISTINCT
-- (PG16) para que "sin plataforma" (plataformaId NULL) cuente como caso único.
-- Verificación de datos previa (dev): las 3 tablas de identificador = 0 filas, 0 huérfanos.

-- 1) Retirar los @@unique viejos (incluían el sujeto; la regla que importa nunca se escribió)
DROP INDEX "IdentificadorAcudiente_acudienteId_tipo_valor_plataformaId_key";
DROP INDEX "IdentificadorProfesor_profesorId_tipo_valor_plataformaId_key";
DROP INDEX "IdentificadorAlumno_alumnoId_valor_tipo_plataformaId_key";

-- 2) Denormalizar colegioId en IdentificadorAlumno (H1): nullable -> backfill -> NOT NULL,
--    para ser seguro sobre filas existentes (aunque hoy sean 0).
ALTER TABLE "IdentificadorAlumno" ADD COLUMN "colegioId" TEXT;
UPDATE "IdentificadorAlumno" i SET "colegioId" = a."colegioId" FROM "Alumno" a WHERE a.id = i."alumnoId";
ALTER TABLE "IdentificadorAlumno" ALTER COLUMN "colegioId" SET NOT NULL;

-- 3) Índice de tenant + FK
CREATE INDEX "IdentificadorAlumno_colegioId_estado_idx" ON "IdentificadorAlumno"("colegioId", "estado");
ALTER TABLE "IdentificadorAlumno" ADD CONSTRAINT "IdentificadorAlumno_colegioId_fkey" FOREIGN KEY ("colegioId") REFERENCES "Colegio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 4) Constraints duras nuevas (índices únicos parciales, NULLS NOT DISTINCT):
--    Estudiante y Profesor -> por colegio (red que pidió el CEO). Acudiente -> por acudiente.
CREATE UNIQUE INDEX "IdentificadorAlumno_colegio_ident_key" ON "IdentificadorAlumno" ("colegioId", "tipo", "valor", "plataformaId") NULLS NOT DISTINCT WHERE ("estado" = 'activo');
CREATE UNIQUE INDEX "IdentificadorProfesor_colegio_ident_key" ON "IdentificadorProfesor" ("colegioId", "tipo", "valor", "plataformaId") NULLS NOT DISTINCT WHERE ("estado" = 'activo');
CREATE UNIQUE INDEX "IdentificadorAcudiente_acudiente_ident_key" ON "IdentificadorAcudiente" ("acudienteId", "tipo", "valor", "plataformaId") NULLS NOT DISTINCT WHERE ("estado" = 'activo');
