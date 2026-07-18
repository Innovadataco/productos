-- CreateEnum
CREATE TYPE "ResponsableTransicion" AS ENUM ('IA', 'WORKER', 'SISTEMA', 'OPERADOR', 'COMITE', 'ADMIN');

-- CreateTable
CREATE TABLE "TransicionReporte" (
    "id" TEXT NOT NULL,
    "reporteId" TEXT NOT NULL,
    "estadoAnterior" "EstadoReporte" NOT NULL,
    "estadoNuevo" "EstadoReporte" NOT NULL,
    "responsableTipo" "ResponsableTransicion" NOT NULL,
    "responsableId" TEXT,
    "motivo" TEXT,
    "metadatos" JSONB,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransicionReporte_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TransicionReporte_reporteId_idx" ON "TransicionReporte"("reporteId");

-- CreateIndex
CREATE INDEX "TransicionReporte_responsableTipo_idx" ON "TransicionReporte"("responsableTipo");

-- CreateIndex
CREATE INDEX "TransicionReporte_responsableId_idx" ON "TransicionReporte"("responsableId");

-- CreateIndex
CREATE INDEX "TransicionReporte_creadoEn_idx" ON "TransicionReporte"("creadoEn");

-- AddForeignKey
ALTER TABLE "TransicionReporte" ADD CONSTRAINT "TransicionReporte_reporteId_fkey" FOREIGN KEY ("reporteId") REFERENCES "Reporte"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransicionReporte" ADD CONSTRAINT "TransicionReporte_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
