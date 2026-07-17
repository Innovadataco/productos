-- CreateEnum
CREATE TYPE "CasoEvalFuente" AS ENUM ('SEMILLA', 'MANUAL_ADMIN', 'PRODUCCION_ANONIMIZADO');

-- CreateEnum
CREATE TYPE "EvalRunEstado" AS ENUM ('PENDIENTE', 'EN_PROGRESO', 'COMPLETADA', 'FALLIDA', 'CANCELADA');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AccionAudit" ADD VALUE 'EVAL_CASE_CREATE';
ALTER TYPE "AccionAudit" ADD VALUE 'EVAL_CASE_DISABLE';
ALTER TYPE "AccionAudit" ADD VALUE 'EVAL_RUN_CREATE';

-- DropIndex
DROP INDEX IF EXISTS "EmbeddingDataset_vector_idx";
DROP INDEX IF EXISTS "EmbeddingReporte_vector_idx";

-- CreateTable
CREATE TABLE "CasoEval" (
    "id" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "categoriaEsperada" TEXT NOT NULL,
    "secundariaEsperada" TEXT,
    "ruido" BOOLEAN NOT NULL DEFAULT false,
    "fuente" "CasoEvalFuente" NOT NULL DEFAULT 'SEMILLA',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fixtureVersion" INTEGER NOT NULL DEFAULT 1,
    "creadoPorId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CasoEval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvalRun" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'f7',
    "fixtureVersion" INTEGER NOT NULL,
    "estado" "EvalRunEstado" NOT NULL DEFAULT 'PENDIENTE',
    "iniciadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizadoEn" TIMESTAMP(3),
    "resultadoJson" JSONB,
    "error" TEXT,
    "creadoPorId" TEXT,

    CONSTRAINT "EvalRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CasoEval_categoriaEsperada_idx" ON "CasoEval"("categoriaEsperada");

-- CreateIndex
CREATE INDEX "CasoEval_fuente_idx" ON "CasoEval"("fuente");

-- CreateIndex
CREATE INDEX "CasoEval_activo_idx" ON "CasoEval"("activo");

-- CreateIndex
CREATE INDEX "CasoEval_fixtureVersion_idx" ON "CasoEval"("fixtureVersion");

-- CreateIndex
CREATE INDEX "EvalRun_estado_idx" ON "EvalRun"("estado");

-- CreateIndex
CREATE INDEX "EvalRun_fixtureVersion_idx" ON "EvalRun"("fixtureVersion");

-- CreateIndex
CREATE INDEX "EvalRun_creadoPorId_idx" ON "EvalRun"("creadoPorId");

-- AddForeignKey
ALTER TABLE "CasoEval" ADD CONSTRAINT "CasoEval_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvalRun" ADD CONSTRAINT "EvalRun_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Recreación idempotente de índices hnsw (Prisma no los gestiona)
CREATE INDEX IF NOT EXISTS "EmbeddingReporte_vector_idx" ON "EmbeddingReporte" USING hnsw (vector vector_cosine_ops);
CREATE INDEX IF NOT EXISTS "EmbeddingDataset_vector_idx" ON "EmbeddingDataset" USING hnsw (vector vector_cosine_ops);
