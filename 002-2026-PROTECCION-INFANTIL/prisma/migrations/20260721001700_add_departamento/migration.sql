-- CreateTable
CREATE TABLE "Departamento" (
    "id" TEXT NOT NULL,
    "codigo" TEXT,
    "nombre" TEXT NOT NULL,
    "paisId" TEXT NOT NULL,
    "esActivo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Departamento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Departamento_codigo_key" ON "Departamento"("codigo");
CREATE UNIQUE INDEX "Departamento_nombre_paisId_key" ON "Departamento"("nombre", "paisId");
CREATE INDEX "Departamento_paisId_idx" ON "Departamento"("paisId");
CREATE INDEX "Departamento_esActivo_idx" ON "Departamento"("esActivo");

-- AlterTable
ALTER TABLE "Ciudad" ADD COLUMN "departamentoId" TEXT;

-- CreateIndex
CREATE INDEX "Ciudad_departamentoId_idx" ON "Ciudad"("departamentoId");

-- AddForeignKey
ALTER TABLE "Ciudad" ADD CONSTRAINT "Ciudad_departamentoId_fkey" FOREIGN KEY ("departamentoId") REFERENCES "Departamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Departamento" ADD CONSTRAINT "Departamento_paisId_fkey" FOREIGN KEY ("paisId") REFERENCES "Pais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
