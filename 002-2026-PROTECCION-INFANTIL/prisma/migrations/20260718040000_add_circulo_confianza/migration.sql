-- AlterEnum
ALTER TYPE "AccionAudit" ADD VALUE 'CIRCULO_CONTACT_CREATE';
ALTER TYPE "AccionAudit" ADD VALUE 'CIRCULO_CONTACT_UPDATE';
ALTER TYPE "AccionAudit" ADD VALUE 'CIRCULO_CONTACT_DISABLE';

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN "notificacionesCirculo" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "ContactoConfianza" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "identificador" TEXT NOT NULL,
    "plataformaId" TEXT NOT NULL,
    "etiqueta" VARCHAR(100),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactoConfianza_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContactoConfianza_usuarioId_identificador_plataformaId_key" ON "ContactoConfianza"("usuarioId", "identificador", "plataformaId");

-- CreateIndex
CREATE INDEX "ContactoConfianza_usuarioId_activo_idx" ON "ContactoConfianza"("usuarioId", "activo");

-- CreateIndex
CREATE INDEX "ContactoConfianza_identificador_plataformaId_idx" ON "ContactoConfianza"("identificador", "plataformaId");

-- AddForeignKey
ALTER TABLE "ContactoConfianza" ADD CONSTRAINT "ContactoConfianza_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactoConfianza" ADD CONSTRAINT "ContactoConfianza_plataformaId_fkey" FOREIGN KEY ("plataformaId") REFERENCES "Plataforma"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
