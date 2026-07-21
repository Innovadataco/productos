-- CreateEnum
CREATE TYPE "EtiquetaRelacionAlumno" AS ENUM ('ALUMNO', 'MADRE', 'PADRE', 'PRIMO', 'TUTOR', 'OTRO');

-- AlterEnum
ALTER TYPE "AccionAudit" ADD VALUE 'COLEGIO_CURSO_CREADO';
ALTER TYPE "AccionAudit" ADD VALUE 'COLEGIO_CURSO_EDITADO';
ALTER TYPE "AccionAudit" ADD VALUE 'COLEGIO_CURSO_DESACTIVADO';
ALTER TYPE "AccionAudit" ADD VALUE 'COLEGIO_ALUMNO_CREADO';
ALTER TYPE "AccionAudit" ADD VALUE 'COLEGIO_ALUMNO_EDITADO';
ALTER TYPE "AccionAudit" ADD VALUE 'COLEGIO_ALUMNO_DESACTIVADO';
ALTER TYPE "AccionAudit" ADD VALUE 'COLEGIO_IDENTIFICADOR_CREADO';
ALTER TYPE "AccionAudit" ADD VALUE 'COLEGIO_IDENTIFICADOR_EDITADO';
ALTER TYPE "AccionAudit" ADD VALUE 'COLEGIO_IDENTIFICADOR_DESACTIVADO';

-- CreateTable
CREATE TABLE "Curso" (
    "id" TEXT NOT NULL,
    "colegioId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "grado" TEXT,
    "anioLectivo" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'activo',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Curso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alumno" (
    "id" TEXT NOT NULL,
    "cursoId" TEXT NOT NULL,
    "colegioId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'activo',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Alumno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdentificadorAlumno" (
    "id" TEXT NOT NULL,
    "alumnoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    "plataformaId" TEXT,
    "etiquetaRelacion" "EtiquetaRelacionAlumno" NOT NULL DEFAULT 'ALUMNO',
    "estado" TEXT NOT NULL DEFAULT 'activo',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdentificadorAlumno_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Curso_colegioId_nombre_grado_anioLectivo_key" ON "Curso"("colegioId", "nombre", "grado", "anioLectivo");

-- CreateIndex
CREATE INDEX "Curso_colegioId_estado_idx" ON "Curso"("colegioId", "estado");

-- CreateIndex
CREATE INDEX "Alumno_cursoId_estado_idx" ON "Alumno"("cursoId", "estado");

-- CreateIndex
CREATE INDEX "Alumno_colegioId_estado_idx" ON "Alumno"("colegioId", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "IdentificadorAlumno_alumnoId_valor_tipo_plataformaId_key" ON "IdentificadorAlumno"("alumnoId", "valor", "tipo", "plataformaId");

-- CreateIndex
CREATE INDEX "IdentificadorAlumno_alumnoId_estado_idx" ON "IdentificadorAlumno"("alumnoId", "estado");

-- AddForeignKey
ALTER TABLE "Curso" ADD CONSTRAINT "Curso_colegioId_fkey" FOREIGN KEY ("colegioId") REFERENCES "Colegio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Alumno" ADD CONSTRAINT "Alumno_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "Curso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Alumno" ADD CONSTRAINT "Alumno_colegioId_fkey" FOREIGN KEY ("colegioId") REFERENCES "Colegio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "IdentificadorAlumno" ADD CONSTRAINT "IdentificadorAlumno_alumnoId_fkey" FOREIGN KEY ("alumnoId") REFERENCES "Alumno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "IdentificadorAlumno" ADD CONSTRAINT "IdentificadorAlumno_plataformaId_fkey" FOREIGN KEY ("plataformaId") REFERENCES "Plataforma"("id") ON DELETE SET NULL ON UPDATE CASCADE;
