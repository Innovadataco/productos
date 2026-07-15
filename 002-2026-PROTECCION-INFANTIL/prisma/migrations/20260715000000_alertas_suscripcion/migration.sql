-- CreateTable
CREATE TABLE "AlertaSuscripcion" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "identificador" TEXT NOT NULL,
    "plataformaId" TEXT NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "ultimoEmailEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertaSuscripcion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AlertaSuscripcion_usuarioId_idx" ON "AlertaSuscripcion"("usuarioId");

-- CreateIndex
CREATE INDEX "AlertaSuscripcion_identificador_plataformaId_idx" ON "AlertaSuscripcion"("identificador", "plataformaId");

-- CreateIndex
CREATE INDEX "AlertaSuscripcion_activa_idx" ON "AlertaSuscripcion"("activa");

-- AddForeignKey
ALTER TABLE "AlertaSuscripcion" ADD CONSTRAINT "AlertaSuscripcion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertaSuscripcion" ADD CONSTRAINT "AlertaSuscripcion_plataformaId_fkey" FOREIGN KEY ("plataformaId") REFERENCES "Plataforma"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

