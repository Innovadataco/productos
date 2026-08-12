-- SPEC-162: catálogo de materias configurable por colegio + vínculo
-- Curso × Materia × Profesor (CursoMateria). Migración 100% aditiva:
-- crea tablas nuevas, no modifica Curso ni Estudiante.
--
-- I-49: el diff crudo de `migrate diff` traía los DROP INDEX del drift
-- (AlertaColegio_patronInstitucionalId_idx, Ciudad_nombreNormalizado_trgm_idx,
-- EmbeddingDataset_vector_idx, EmbeddingReporte_vector_idx) y un RENAME INDEX
-- por nombre truncado en patrones_institucionales. Esos objetos viven solo en
-- la BD real como drift documentado en migraciones anteriores; NO se tocan aquí.

-- CreateTable
CREATE TABLE "Materia" (
    "id" TEXT NOT NULL,
    "colegioId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'activo',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Materia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CursoMateria" (
    "id" TEXT NOT NULL,
    "colegioId" TEXT NOT NULL,
    "cursoId" TEXT NOT NULL,
    "materiaId" TEXT NOT NULL,
    "profesorId" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'activo',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CursoMateria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Materia_colegioId_estado_idx" ON "Materia"("colegioId", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "Materia_colegioId_nombre_key" ON "Materia"("colegioId", "nombre");

-- CreateIndex
CREATE INDEX "CursoMateria_colegioId_estado_idx" ON "CursoMateria"("colegioId", "estado");

-- CreateIndex
CREATE INDEX "CursoMateria_cursoId_estado_idx" ON "CursoMateria"("cursoId", "estado");

-- CreateIndex
CREATE INDEX "CursoMateria_profesorId_idx" ON "CursoMateria"("profesorId");

-- CreateIndex
CREATE UNIQUE INDEX "CursoMateria_cursoId_materiaId_key" ON "CursoMateria"("cursoId", "materiaId");

-- AddForeignKey
ALTER TABLE "Materia" ADD CONSTRAINT "Materia_colegioId_fkey" FOREIGN KEY ("colegioId") REFERENCES "Colegio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursoMateria" ADD CONSTRAINT "CursoMateria_colegioId_fkey" FOREIGN KEY ("colegioId") REFERENCES "Colegio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursoMateria" ADD CONSTRAINT "CursoMateria_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "Curso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursoMateria" ADD CONSTRAINT "CursoMateria_materiaId_fkey" FOREIGN KEY ("materiaId") REFERENCES "Materia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursoMateria" ADD CONSTRAINT "CursoMateria_profesorId_fkey" FOREIGN KEY ("profesorId") REFERENCES "Profesor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed inicial de materias para colegios existentes (idempotente por unique).
INSERT INTO "Materia" ("id", "colegioId", "nombre", "estado", "creadoEn", "actualizadoEn")
SELECT gen_random_uuid(), c.id, m.nombre, 'activo', NOW(), NOW()
FROM "Colegio" c
CROSS JOIN (VALUES
  ('Matemáticas'),
  ('Español'),
  ('Inglés'),
  ('Ciencias Sociales'),
  ('Ciencias Naturales'),
  ('Física'),
  ('Química'),
  ('Biología'),
  ('Filosofía'),
  ('Religión'),
  ('Educación Artística'),
  ('Educación Física'),
  ('Tecnología e Informática'),
  ('Ética y Valores'),
  ('Música')
) AS m(nombre)
ON CONFLICT ("colegioId", "nombre") DO NOTHING;
