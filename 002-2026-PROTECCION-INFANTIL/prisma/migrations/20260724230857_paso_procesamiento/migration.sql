-- CreateTable
CREATE TABLE "pasos_procesamiento" (
    "id" TEXT NOT NULL,
    "reporteId" TEXT NOT NULL,
    "etapa" TEXT NOT NULL,
    "veredicto" TEXT,
    "detalle" JSONB,
    "latenciaMs" INTEGER,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pasos_procesamiento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pasos_procesamiento_reporteId_creadoEn_idx" ON "pasos_procesamiento"("reporteId", "creadoEn");

-- AddForeignKey
ALTER TABLE "pasos_procesamiento" ADD CONSTRAINT "pasos_procesamiento_reporteId_fkey" FOREIGN KEY ("reporteId") REFERENCES "Reporte"("id") ON DELETE CASCADE ON UPDATE CASCADE;
