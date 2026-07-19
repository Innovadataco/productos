-- CreateTable
CREATE TABLE "IdentificadorContacto" (
    "id" TEXT NOT NULL,
    "contactoId" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    "tipo" TEXT,
    "plataformaId" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdentificadorContacto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IdentificadorContacto_valor_idx" ON "IdentificadorContacto"("valor");

-- CreateIndex
CREATE INDEX "IdentificadorContacto_contactoId_activo_idx" ON "IdentificadorContacto"("contactoId", "activo");

-- CreateIndex
CREATE INDEX "IdentificadorContacto_plataformaId_idx" ON "IdentificadorContacto"("plataformaId");

-- CreateIndex
CREATE UNIQUE INDEX "IdentificadorContacto_contactoId_valor_plataformaId_key" ON "IdentificadorContacto"("contactoId", "valor", "plataformaId");

-- MigrateData: cada contacto viejo se convierte en un contacto nuevo con un identificador
INSERT INTO "IdentificadorContacto" ("id", "contactoId", "valor", "tipo", "plataformaId", "activo", "creadoEn", "actualizadoEn")
SELECT gen_random_uuid()::text, "id", "identificador", NULL, "plataformaId", "activo", "creadoEn", "actualizadoEn"
FROM "ContactoConfianza";

-- DropForeignKey
ALTER TABLE "ContactoConfianza" DROP CONSTRAINT "ContactoConfianza_plataformaId_fkey";

-- DropIndex
DROP INDEX "ContactoConfianza_identificador_plataformaId_idx";

-- DropIndex
DROP INDEX "ContactoConfianza_usuarioId_identificador_plataformaId_key";

-- AlterTable
ALTER TABLE "ContactoConfianza" DROP COLUMN "identificador",
DROP COLUMN "plataformaId",
ADD COLUMN     "nota" TEXT;

-- CreateIndex
CREATE INDEX "ContactoConfianza_usuarioId_creadoEn_idx" ON "ContactoConfianza"("usuarioId", "creadoEn");

-- AddForeignKey
ALTER TABLE "IdentificadorContacto" ADD CONSTRAINT "IdentificadorContacto_contactoId_fkey" FOREIGN KEY ("contactoId") REFERENCES "ContactoConfianza"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentificadorContacto" ADD CONSTRAINT "IdentificadorContacto_plataformaId_fkey" FOREIGN KEY ("plataformaId") REFERENCES "Plataforma"("id") ON DELETE SET NULL ON UPDATE CASCADE;
