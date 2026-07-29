-- SPEC-110: Apelación del identificador reportado (migración ADITIVA).
-- Sin DROP ni ALTER destructivo. Los índices HNSW de embeddings (manuales) se conservan.

-- CreateEnum
CREATE TYPE "EstadoApelacion" AS ENUM ('RECIBIDA', 'EN_REVISION', 'ACEPTADA', 'RECHAZADA');

-- AlterEnum (valores nuevos, aditivo)
ALTER TYPE "AccionAudit" ADD VALUE 'APELACION_DOCUMENTO_ACCESO';
ALTER TYPE "AccionAudit" ADD VALUE 'APELACION_DOCUMENTO_PURGADO';
ALTER TYPE "AccionAudit" ADD VALUE 'APELACION_AVISO_PLAZO';

-- AlterTable (columna nueva, nullable)
ALTER TABLE "IdentificadorReportado" ADD COLUMN "ocultoPorComiteEn" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Apelacion" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "identificador" TEXT NOT NULL,
    "plataformaId" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "esRepresentante" BOOLEAN NOT NULL DEFAULT false,
    "acreditacion" TEXT,
    "estado" "EstadoApelacion" NOT NULL DEFAULT 'RECIBIDA',
    "comiteId" TEXT,
    "asignadoEn" TIMESTAMP(3),
    "plazoRespuestaEn" TIMESTAMP(3) NOT NULL,
    "decision" TEXT,
    "motivacionResolucion" TEXT,
    "quitoVisibilidad" BOOLEAN NOT NULL DEFAULT false,
    "resueltoPorId" TEXT,
    "resueltoEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Apelacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentoApelacion" (
    "id" TEXT NOT NULL,
    "apelacionId" TEXT NOT NULL,
    "nombreOriginal" TEXT NOT NULL,
    "rutaArchivo" TEXT NOT NULL,
    "hashSha256" TEXT NOT NULL,
    "tamanoBytes" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "eliminadoEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentoApelacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccesoDocumentoApelacion" (
    "id" TEXT NOT NULL,
    "documentoId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "accedidoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccesoDocumentoApelacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Apelacion_numero_key" ON "Apelacion"("numero");

-- CreateIndex
CREATE INDEX "Apelacion_usuarioId_idx" ON "Apelacion"("usuarioId");

-- CreateIndex
CREATE INDEX "Apelacion_estado_idx" ON "Apelacion"("estado");

-- CreateIndex
CREATE INDEX "Apelacion_identificador_plataformaId_idx" ON "Apelacion"("identificador", "plataformaId");

-- CreateIndex
CREATE INDEX "Apelacion_creadoEn_idx" ON "Apelacion"("creadoEn");

-- CreateIndex
CREATE INDEX "Apelacion_resueltoEn_idx" ON "Apelacion"("resueltoEn");

-- Unicidad de apelación ABIERTA por usuario + identificador + plataforma (FR-006):
-- índice parcial; permite re-apelar tras resolución (ACEPTADA/RECHAZADA).
CREATE UNIQUE INDEX "apelacion_abierta_unica" ON "Apelacion" ("usuarioId", "identificador", "plataformaId") WHERE "estado" IN ('RECIBIDA', 'EN_REVISION');

-- CreateIndex
CREATE INDEX "DocumentoApelacion_apelacionId_idx" ON "DocumentoApelacion"("apelacionId");

-- CreateIndex
CREATE INDEX "DocumentoApelacion_eliminadoEn_idx" ON "DocumentoApelacion"("eliminadoEn");

-- CreateIndex
CREATE INDEX "AccesoDocumentoApelacion_documentoId_idx" ON "AccesoDocumentoApelacion"("documentoId");

-- CreateIndex
CREATE INDEX "AccesoDocumentoApelacion_usuarioId_idx" ON "AccesoDocumentoApelacion"("usuarioId");

-- AddForeignKey
ALTER TABLE "Apelacion" ADD CONSTRAINT "Apelacion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Apelacion" ADD CONSTRAINT "Apelacion_plataformaId_fkey" FOREIGN KEY ("plataformaId") REFERENCES "Plataforma"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Apelacion" ADD CONSTRAINT "Apelacion_comiteId_fkey" FOREIGN KEY ("comiteId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Apelacion" ADD CONSTRAINT "Apelacion_resueltoPorId_fkey" FOREIGN KEY ("resueltoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentoApelacion" ADD CONSTRAINT "DocumentoApelacion_apelacionId_fkey" FOREIGN KEY ("apelacionId") REFERENCES "Apelacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccesoDocumentoApelacion" ADD CONSTRAINT "AccesoDocumentoApelacion_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "DocumentoApelacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccesoDocumentoApelacion" ADD CONSTRAINT "AccesoDocumentoApelacion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
