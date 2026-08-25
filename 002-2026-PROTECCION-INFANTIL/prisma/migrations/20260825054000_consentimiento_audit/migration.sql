-- SPEC-241 (002-PI-144): extensión aditiva de Usuario + tabla AuditConsentimiento.
-- Migración 100% aditiva: solo ADD COLUMN / CREATE TABLE / CREATE INDEX / ADD FK.

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "consentimientoAceptadoEn" TIMESTAMP(3);
ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "consentimientoVersion" TEXT;
ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "consentimientoDocumentoHash" TEXT;
ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "consentimientoIP" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "audit_consentimientos" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "documentoTipo" TEXT NOT NULL,
    "documentoHash" TEXT NOT NULL,
    "aceptadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT NOT NULL,
    "userAgent" TEXT,
    "esRepresentanteLegal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "audit_consentimientos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "audit_consentimientos_usuarioId_aceptadoEn_idx" ON "audit_consentimientos"("usuarioId", "aceptadoEn");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "audit_consentimientos_version_idx" ON "audit_consentimientos"("version");

-- AddForeignKey
ALTER TABLE "audit_consentimientos" ADD CONSTRAINT "audit_consentimientos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
