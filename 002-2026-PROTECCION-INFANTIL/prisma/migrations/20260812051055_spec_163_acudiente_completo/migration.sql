-- AlterEnum
ALTER TYPE "AccionAudit" ADD VALUE 'COLEGIO_ACUDIENTE_CREADO';
ALTER TYPE "AccionAudit" ADD VALUE 'COLEGIO_ACUDIENTE_EDITADO';
ALTER TYPE "AccionAudit" ADD VALUE 'COLEGIO_ACUDIENTE_DESACTIVADO';
ALTER TYPE "AccionAudit" ADD VALUE 'COLEGIO_ACUDIENTE_REACTIVADO';
ALTER TYPE "AccionAudit" ADD VALUE 'COLEGIO_IDENTIFICADOR_ACUDIENTE_CREADO';
ALTER TYPE "AccionAudit" ADD VALUE 'COLEGIO_IDENTIFICADOR_ACUDIENTE_EDITADO';
ALTER TYPE "AccionAudit" ADD VALUE 'COLEGIO_IDENTIFICADOR_ACUDIENTE_DESACTIVADO';
ALTER TYPE "AccionAudit" ADD VALUE 'COLEGIO_IDENTIFICADOR_ACUDIENTE_REACTIVADO';

-- AlterTable
ALTER TABLE "AcudienteEstudiante" ADD COLUMN     "estado" TEXT NOT NULL DEFAULT 'activo';

-- DropIndex
DROP INDEX "AcudienteEstudiante_estudianteId_idx";
DROP INDEX "AcudienteEstudiante_estudianteId_orden_key";

-- CreateIndex
CREATE UNIQUE INDEX "AcudienteEstudiante_estudianteId_orden_estado_key" ON "AcudienteEstudiante"("estudianteId", "orden", "estado");
CREATE INDEX "AcudienteEstudiante_estudianteId_estado_idx" ON "AcudienteEstudiante"("estudianteId", "estado");

-- CreateTable
CREATE TABLE "IdentificadorAcudiente" (
    "id" TEXT NOT NULL,
    "acudienteId" TEXT NOT NULL,
    "colegioId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    "plataformaId" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'activo',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdentificadorAcudiente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IdentificadorAcudiente_acudienteId_tipo_valor_plataformaId_key" ON "IdentificadorAcudiente"("acudienteId", "tipo", "valor", "plataformaId");
CREATE INDEX "IdentificadorAcudiente_colegioId_estado_idx" ON "IdentificadorAcudiente"("colegioId", "estado");
CREATE INDEX "IdentificadorAcudiente_acudienteId_estado_idx" ON "IdentificadorAcudiente"("acudienteId", "estado");
CREATE INDEX "IdentificadorAcudiente_valor_idx" ON "IdentificadorAcudiente"("valor");

-- AddForeignKey
ALTER TABLE "IdentificadorAcudiente" ADD CONSTRAINT "IdentificadorAcudiente_acudienteId_fkey" FOREIGN KEY ("acudienteId") REFERENCES "AcudienteEstudiante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "IdentificadorAcudiente" ADD CONSTRAINT "IdentificadorAcudiente_colegioId_fkey" FOREIGN KEY ("colegioId") REFERENCES "Colegio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "IdentificadorAcudiente" ADD CONSTRAINT "IdentificadorAcudiente_plataformaId_fkey" FOREIGN KEY ("plataformaId") REFERENCES "Plataforma"("id") ON DELETE SET NULL ON UPDATE CASCADE;
