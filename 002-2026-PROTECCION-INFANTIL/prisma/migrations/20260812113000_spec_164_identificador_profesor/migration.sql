-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AccionAudit" ADD VALUE 'COLEGIO_IDENTIFICADOR_PROFESOR_CREADO';
ALTER TYPE "AccionAudit" ADD VALUE 'COLEGIO_IDENTIFICADOR_PROFESOR_EDITADO';
ALTER TYPE "AccionAudit" ADD VALUE 'COLEGIO_IDENTIFICADOR_PROFESOR_DESACTIVADO';
ALTER TYPE "AccionAudit" ADD VALUE 'COLEGIO_IDENTIFICADOR_PROFESOR_REACTIVADO';

-- CreateTable
CREATE TABLE "IdentificadorProfesor" (
    "id" TEXT NOT NULL,
    "profesorId" TEXT NOT NULL,
    "colegioId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    "plataformaId" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'activo',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdentificadorProfesor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IdentificadorProfesor_colegioId_estado_idx" ON "IdentificadorProfesor"("colegioId", "estado");

-- CreateIndex
CREATE INDEX "IdentificadorProfesor_profesorId_estado_idx" ON "IdentificadorProfesor"("profesorId", "estado");

-- CreateIndex
CREATE INDEX "IdentificadorProfesor_valor_idx" ON "IdentificadorProfesor"("valor");

-- CreateIndex
CREATE UNIQUE INDEX "IdentificadorProfesor_profesorId_tipo_valor_plataformaId_key" ON "IdentificadorProfesor"("profesorId", "tipo", "valor", "plataformaId");

-- AddForeignKey
ALTER TABLE "IdentificadorProfesor" ADD CONSTRAINT "IdentificadorProfesor_profesorId_fkey" FOREIGN KEY ("profesorId") REFERENCES "Profesor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentificadorProfesor" ADD CONSTRAINT "IdentificadorProfesor_colegioId_fkey" FOREIGN KEY ("colegioId") REFERENCES "Colegio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentificadorProfesor" ADD CONSTRAINT "IdentificadorProfesor_plataformaId_fkey" FOREIGN KEY ("plataformaId") REFERENCES "Plataforma"("id") ON DELETE SET NULL ON UPDATE CASCADE;

