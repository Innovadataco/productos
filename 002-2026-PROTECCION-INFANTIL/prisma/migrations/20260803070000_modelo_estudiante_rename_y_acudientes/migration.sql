-- SPEC-144: rename Alumno → Estudiante (100% @@map/@map, diff estructural vacío)
-- + campos aditivos en "Alumno" + tabla hija "AcudienteEstudiante" (D1).
-- Backfill idempotente por construcción: DEFAULT constante y NULLs, sin UPDATE.
-- Metadata-only en PostgreSQL 16: sin reescritura de tabla ni lock apreciable.

-- AlterTable
ALTER TABLE "Alumno" ADD COLUMN     "apellidos" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "documentoNumero" TEXT,
ADD COLUMN     "documentoTipo" TEXT;

-- CreateTable
CREATE TABLE "AcudienteEstudiante" (
    "id" TEXT NOT NULL,
    "estudianteId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "relacion" TEXT NOT NULL,
    "telefono" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcudienteEstudiante_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AcudienteEstudiante_estudianteId_idx" ON "AcudienteEstudiante"("estudianteId");

-- CreateIndex
CREATE UNIQUE INDEX "AcudienteEstudiante_estudianteId_orden_key" ON "AcudienteEstudiante"("estudianteId", "orden");

-- AddForeignKey
ALTER TABLE "AcudienteEstudiante" ADD CONSTRAINT "AcudienteEstudiante_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "Alumno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
