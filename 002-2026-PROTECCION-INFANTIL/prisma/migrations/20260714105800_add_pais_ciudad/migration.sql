-- CreateTable
CREATE TABLE "Pais" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "esActivo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ciudad" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "paisId" TEXT NOT NULL,
    "esActivo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ciudad_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Pais_codigo_key" ON "Pais"("codigo");
CREATE INDEX "Pais_codigo_idx" ON "Pais"("codigo");
CREATE INDEX "Pais_esActivo_idx" ON "Pais"("esActivo");
CREATE INDEX "Ciudad_paisId_idx" ON "Ciudad"("paisId");
CREATE INDEX "Ciudad_esActivo_idx" ON "Ciudad"("esActivo");

-- AddForeignKey
ALTER TABLE "Ciudad" ADD CONSTRAINT "Ciudad_paisId_fkey" FOREIGN KEY ("paisId") REFERENCES "Pais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Reporte" ADD COLUMN "paisId" TEXT;
ALTER TABLE "Reporte" ADD COLUMN "ciudadId" TEXT;
ALTER TABLE "Reporte" ADD COLUMN "otraPlataforma" TEXT;

-- AddForeignKey
ALTER TABLE "Reporte" ADD CONSTRAINT "Reporte_paisId_fkey" FOREIGN KEY ("paisId") REFERENCES "Pais"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Reporte" ADD CONSTRAINT "Reporte_ciudadId_fkey" FOREIGN KEY ("ciudadId") REFERENCES "Ciudad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Reporte_paisId_idx" ON "Reporte"("paisId");
CREATE INDEX "Reporte_ciudadId_idx" ON "Reporte"("ciudadId");