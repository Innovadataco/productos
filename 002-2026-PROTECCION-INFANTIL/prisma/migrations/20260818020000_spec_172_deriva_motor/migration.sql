-- SPEC-172 (Pilar D.5): snapshot semanal de la deriva del motor en producción.
-- ADITIVA: solo CREATE TABLE / CREATE INDEX / ALTER TYPE ADD VALUE. Sin DROP,
-- sin tocar índices existentes (I-53).

-- AlterEnum
ALTER TYPE "AccionAudit" ADD VALUE 'MOTOR_DERIVA_RECALCULO';

-- CreateTable
CREATE TABLE "DerivaMotorSnapshot" (
    "id" TEXT NOT NULL,
    "semanaInicio" TIMESTAMP(3) NOT NULL,
    "categoria" TEXT NOT NULL,
    "total" INTEGER NOT NULL,
    "correcciones" INTEGER NOT NULL,
    "tasaCorreccion" DOUBLE PRECISION NOT NULL,
    "accuracyBanco" DOUBLE PRECISION,
    "brechaPp" DOUBLE PRECISION,
    "alertada" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DerivaMotorSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DerivaMotorSnapshot_semanaInicio_categoria_key" ON "DerivaMotorSnapshot"("semanaInicio", "categoria");

-- CreateIndex
CREATE INDEX "DerivaMotorSnapshot_semanaInicio_idx" ON "DerivaMotorSnapshot"("semanaInicio");
