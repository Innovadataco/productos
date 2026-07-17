-- AlterTable
ALTER TABLE "Reporte" ADD COLUMN "fuenteConfianza" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "IdentificadorReportado" ADD COLUMN "scoreAnonimo" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "IdentificadorReportado" ADD COLUMN "scoreAutenticado" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "IdentificadorReportado" ADD COLUMN "scoreAjustado" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "FuenteReporte" (
    "id" TEXT NOT NULL,
    "reporteId" TEXT NOT NULL,
    "ipHash" TEXT,
    "fingerprintHash" TEXT,
    "cuentaDiasAntiguedad" INTEGER,
    "reportesPrevios" INTEGER NOT NULL DEFAULT 0,
    "reportesConfirmados" INTEGER NOT NULL DEFAULT 0,
    "reportesDescartados" INTEGER NOT NULL DEFAULT 0,
    "pesoAplicado" DOUBLE PRECISION NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FuenteReporte_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FuenteReporte_reporteId_key" ON "FuenteReporte"("reporteId");
CREATE INDEX "FuenteReporte_ipHash_idx" ON "FuenteReporte"("ipHash");
CREATE INDEX "FuenteReporte_fingerprintHash_idx" ON "FuenteReporte"("fingerprintHash");
CREATE INDEX "FuenteReporte_creadoEn_idx" ON "FuenteReporte"("creadoEn");

-- AddForeignKey
ALTER TABLE "FuenteReporte" ADD CONSTRAINT "FuenteReporte_reporteId_fkey" FOREIGN KEY ("reporteId") REFERENCES "Reporte"("id") ON DELETE CASCADE ON UPDATE CASCADE;
