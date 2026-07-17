-- AlterEnum
ALTER TYPE "AccionAudit" ADD VALUE 'EXPERIMENT_START';
ALTER TYPE "AccionAudit" ADD VALUE 'EXPERIMENT_COMPLETE';

-- AlterTable
ALTER TABLE "EvalRun" ADD COLUMN "nombre" TEXT;
ALTER TABLE "EvalRun" ADD COLUMN "notas" TEXT;
ALTER TABLE "EvalRun" ADD COLUMN "configSnapshot" JSONB;
ALTER TABLE "EvalRun" ADD COLUMN "progresoCasos" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "EvalRun" ADD COLUMN "progresoTotal" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "EvalResultado" (
    "id" TEXT NOT NULL,
    "experimentoId" TEXT NOT NULL,
    "casoEvalId" TEXT NOT NULL,
    "esperado" TEXT NOT NULL,
    "predicho" TEXT NOT NULL,
    "confianza" DOUBLE PRECISION NOT NULL,
    "estadoFinal" TEXT NOT NULL,
    "correcto" BOOLEAN NOT NULL,
    "latenciaMs" INTEGER NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvalResultado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EvalResultado_experimentoId_idx" ON "EvalResultado"("experimentoId");
CREATE INDEX "EvalResultado_casoEvalId_idx" ON "EvalResultado"("casoEvalId");
CREATE INDEX "EvalResultado_correcto_idx" ON "EvalResultado"("correcto");
CREATE INDEX "EvalResultado_esperado_idx" ON "EvalResultado"("esperado");

-- AddForeignKey
ALTER TABLE "EvalResultado" ADD CONSTRAINT "EvalResultado_experimentoId_fkey" FOREIGN KEY ("experimentoId") REFERENCES "EvalRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EvalResultado" ADD CONSTRAINT "EvalResultado_casoEvalId_fkey" FOREIGN KEY ("casoEvalId") REFERENCES "CasoEval"("id") ON DELETE CASCADE ON UPDATE CASCADE;
