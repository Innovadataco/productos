-- CreateEnum
CREATE TYPE "TipoPeriodoServicio" AS ENUM ('MENSUAL', 'SEMESTRAL', 'ANUAL');

-- AlterEnum
ALTER TYPE "AccionAudit" ADD VALUE 'COLEGIO_CREADO';
ALTER TYPE "AccionAudit" ADD VALUE 'COLEGIO_ACTUALIZADO';
ALTER TYPE "AccionAudit" ADD VALUE 'COLEGIO_DESACTIVADO';
ALTER TYPE "AccionAudit" ADD VALUE 'COLEGIO_REACTIVADO';
ALTER TYPE "AccionAudit" ADD VALUE 'COLEGIO_PASSWORD_REGENERADA';
ALTER TYPE "AccionAudit" ADD VALUE 'COLEGIO_EMAIL_REENVIADO';

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN "colegioId" TEXT;

-- CreateTable
CREATE TABLE "Colegio" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "paisId" TEXT NOT NULL,
    "departamentoId" TEXT,
    "ciudadId" TEXT NOT NULL,
    "direccion" TEXT,
    "representanteLegalNombre" TEXT NOT NULL,
    "representanteLegalIdentificacion" TEXT NOT NULL,
    "representanteLegalEmail" TEXT NOT NULL,
    "representanteLegalTelefono" TEXT,
    "inicioServicio" TIMESTAMP(3) NOT NULL,
    "finServicio" TIMESTAMP(3),
    "tipoPeriodo" "TipoPeriodoServicio" NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'activo',
    "tenantId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Colegio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Colegio_tenantId_key" ON "Colegio"("tenantId");
CREATE INDEX "Colegio_paisId_idx" ON "Colegio"("paisId");
CREATE INDEX "Colegio_departamentoId_idx" ON "Colegio"("departamentoId");
CREATE INDEX "Colegio_ciudadId_idx" ON "Colegio"("ciudadId");
CREATE INDEX "Colegio_estado_idx" ON "Colegio"("estado");
CREATE UNIQUE INDEX "Usuario_colegioId_key" ON "Usuario"("colegioId");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_colegioId_fkey" FOREIGN KEY ("colegioId") REFERENCES "Colegio"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Colegio" ADD CONSTRAINT "Colegio_paisId_fkey" FOREIGN KEY ("paisId") REFERENCES "Pais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Colegio" ADD CONSTRAINT "Colegio_departamentoId_fkey" FOREIGN KEY ("departamentoId") REFERENCES "Departamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Colegio" ADD CONSTRAINT "Colegio_ciudadId_fkey" FOREIGN KEY ("ciudadId") REFERENCES "Ciudad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Colegio" ADD CONSTRAINT "Colegio_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
