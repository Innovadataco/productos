-- SPEC-145: modelo "Profesor" mínimo + columna aditiva "Curso"."profesorTitularId"
-- + 3 valores aditivos en enum "AccionAudit" (ALTER TYPE ... ADD VALUE, PG16).
-- Migración 100% aditiva. I-49: el diff crudo de `migrate diff` traía los DROP
-- INDEX del drift (AlertaColegio_patronInstitucionalId_idx,
-- Ciudad_nombreNormalizado_trgm_idx, EmbeddingDataset_vector_idx,
-- EmbeddingReporte_vector_idx) y un RENAME INDEX por nombre truncado en
-- patrones_institucionales — NINGUNO se aplica aquí: esos índices viven solo en
-- la BD real y NO se tocan. Leído línea a línea antes de aplicar.
-- Cuidado ADD VALUE (ZEUS): los valores nuevos del enum NO se usan en esta
-- migración (el seed no los necesita).

-- AlterEnum
ALTER TYPE "AccionAudit" ADD VALUE 'COLEGIO_PROFESOR_CREADO';
ALTER TYPE "AccionAudit" ADD VALUE 'COLEGIO_PROFESOR_EDITADO';
ALTER TYPE "AccionAudit" ADD VALUE 'COLEGIO_PROFESOR_DESACTIVADO';

-- AlterTable
ALTER TABLE "Curso" ADD COLUMN     "profesorTitularId" TEXT;

-- CreateTable
CREATE TABLE "Profesor" (
    "id" TEXT NOT NULL,
    "colegioId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellidos" TEXT NOT NULL,
    "email" TEXT,
    "telefono" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'activo',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profesor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Profesor_colegioId_estado_idx" ON "Profesor"("colegioId", "estado");

-- AddForeignKey
ALTER TABLE "Curso" ADD CONSTRAINT "Curso_profesorTitularId_fkey" FOREIGN KEY ("profesorTitularId") REFERENCES "Profesor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Profesor" ADD CONSTRAINT "Profesor_colegioId_fkey" FOREIGN KEY ("colegioId") REFERENCES "Colegio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
