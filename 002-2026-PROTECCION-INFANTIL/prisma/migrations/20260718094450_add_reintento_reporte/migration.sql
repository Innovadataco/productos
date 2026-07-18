-- DropIndex
DROP INDEX "EmbeddingDataset_vector_idx";

-- DropIndex
DROP INDEX "EmbeddingReporte_vector_idx";

-- CreateTable
CREATE TABLE "ReintentoReporte" (
    "id" TEXT NOT NULL,
    "reporteId" TEXT NOT NULL,
    "intento" INTEGER NOT NULL,
    "exitoso" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReintentoReporte_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReintentoReporte_reporteId_idx" ON "ReintentoReporte"("reporteId");

-- CreateIndex
CREATE INDEX "ReintentoReporte_creadoEn_idx" ON "ReintentoReporte"("creadoEn");

-- AddForeignKey
ALTER TABLE "ReintentoReporte" ADD CONSTRAINT "ReintentoReporte_reporteId_fkey" FOREIGN KEY ("reporteId") REFERENCES "Reporte"("id") ON DELETE CASCADE ON UPDATE CASCADE;
