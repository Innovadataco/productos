-- CreateTable
CREATE TABLE "TipoDocumento" (
    "id" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "categoria" TEXT NOT NULL DEFAULT 'persona',
    "esActiva" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TipoDocumento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TipoDocumento_clave_key" ON "TipoDocumento"("clave");

-- CreateIndex
CREATE INDEX "TipoDocumento_clave_idx" ON "TipoDocumento"("clave");

-- CreateIndex
CREATE INDEX "TipoDocumento_esActiva_idx" ON "TipoDocumento"("esActiva");

