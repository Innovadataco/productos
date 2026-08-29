-- SPEC-184 (002-PI-079): anti-abuso operativo + simulador de abusos.
-- ADITIVA: solo CREATE TABLE / CREATE INDEX / ALTER TYPE ADD VALUE. Sin DROP.

-- AlterEnum
ALTER TYPE "AccionAudit" ADD VALUE 'IP_BLOQUEADA';
ALTER TYPE "AccionAudit" ADD VALUE 'IP_DESBLOQUEADA';
ALTER TYPE "AccionAudit" ADD VALUE 'SIMULACION_ABUSO_INICIADA';
ALTER TYPE "AccionAudit" ADD VALUE 'SIMULACION_ABUSO_CANCELADA';
ALTER TYPE "AccionAudit" ADD VALUE 'SIMULACION_ABUSO_COMPLETADA';

-- CreateTable
CREATE TABLE "block_list" (
    "id" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "expiraEn" TIMESTAMP(3),
    "creadoPorId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "block_list_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simulacion_abuso_runs" (
    "id" TEXT NOT NULL,
    "escenario" TEXT NOT NULL,
    "totalReportes" INTEGER NOT NULL,
    "progreso" INTEGER NOT NULL DEFAULT 0,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "configJson" JSONB,
    "resultadosJson" JSONB,
    "creadoPorId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "simulacion_abuso_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "block_list_ipHash_key" ON "block_list"("ipHash");
CREATE INDEX "block_list_ipHash_idx" ON "block_list"("ipHash");
CREATE INDEX "simulacion_abuso_runs_estado_idx" ON "simulacion_abuso_runs"("estado");
CREATE INDEX "simulacion_abuso_runs_creadoPorId_idx" ON "simulacion_abuso_runs"("creadoPorId");

-- AddForeignKey
ALTER TABLE "block_list" ADD CONSTRAINT "block_list_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulacion_abuso_runs" ADD CONSTRAINT "simulacion_abuso_runs_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
