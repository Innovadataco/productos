-- SPEC-150: modelo "EstudianteObservacion" (observación especial del estudiante:
-- marca auditable con soft delete que CONSERVA el histórico, Ley 1581) + 2
-- valores aditivos en enum "AccionAudit" (ALTER TYPE ... ADD VALUE, PG16).
-- Migración 100% aditiva. I-49: el diff crudo de `migrate diff` traía los DROP
-- INDEX del drift (AlertaColegio_patronInstitucionalId_idx,
-- Ciudad_nombreNormalizado_trgm_idx, EmbeddingDataset_vector_idx,
-- EmbeddingReporte_vector_idx), un RENAME INDEX por nombre truncado en
-- patrones_institucionales y un CREATE EXTENSION "vector" (ya existe en la BD
-- real) — NINGUNO se aplica aquí: esos objetos viven solo en la BD real y NO se
-- tocan (mismo drift documentado en las migraciones 20260809060000_avisos_colegio
-- y 20260809120000_seguimiento_caso). Leído línea a línea antes de aplicar.
-- Cuidado ADD VALUE (ZEUS): los valores nuevos del enum NO se usan en esta
-- migración (el seed no los necesita).

-- AlterEnum
ALTER TYPE "AccionAudit" ADD VALUE 'COLEGIO_OBSERVACION_MARCADA';
ALTER TYPE "AccionAudit" ADD VALUE 'COLEGIO_OBSERVACION_DESMARCADA';

-- CreateTable
CREATE TABLE "EstudianteObservacion" (
    "id" TEXT NOT NULL,
    "estudianteId" TEXT NOT NULL,
    "colegioId" TEXT NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "motivo" TEXT,
    "creadaPorId" TEXT NOT NULL,
    "desactivadaEn" TIMESTAMP(3),
    "desactivadaPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EstudianteObservacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EstudianteObservacion_estudianteId_activa_idx" ON "EstudianteObservacion"("estudianteId", "activa");

-- AddForeignKey
ALTER TABLE "EstudianteObservacion" ADD CONSTRAINT "EstudianteObservacion_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "Alumno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
