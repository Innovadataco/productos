-- CreateTable
CREATE TABLE "simulacion_runs" (
    "id" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "totalCasos" INTEGER NOT NULL DEFAULT 0,
    "progreso" INTEGER NOT NULL DEFAULT 0,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "fechaInicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaFin" TIMESTAMP(3),
    "metricasJson" JSONB,
    "casosJson" JSONB,
    "creadoPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "simulacion_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simulacion_reportes" (
    "id" TEXT NOT NULL,
    "simulacionRunId" TEXT NOT NULL,
    "reporteId" TEXT NOT NULL,
    "indice" INTEGER NOT NULL,
    "categoriaEsperada" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "simulacion_reportes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "simulacion_runs_estado_idx" ON "simulacion_runs"("estado");

-- CreateIndex
CREATE INDEX "simulacion_runs_creadoPorId_idx" ON "simulacion_runs"("creadoPorId");

-- CreateIndex
CREATE UNIQUE INDEX "simulacion_reportes_reporteId_key" ON "simulacion_reportes"("reporteId");

-- CreateIndex
CREATE INDEX "simulacion_reportes_simulacionRunId_idx" ON "simulacion_reportes"("simulacionRunId");

-- CreateIndex
CREATE INDEX "simulacion_reportes_indice_idx" ON "simulacion_reportes"("indice");

-- CreateIndex
CREATE INDEX "simulacion_reportes_reporteId_idx" ON "simulacion_reportes"("reporteId");

-- AddForeignKey
ALTER TABLE "simulacion_runs" ADD CONSTRAINT "simulacion_runs_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulacion_reportes" ADD CONSTRAINT "simulacion_reportes_simulacionRunId_fkey" FOREIGN KEY ("simulacionRunId") REFERENCES "simulacion_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
