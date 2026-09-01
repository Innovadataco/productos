-- SPEC-340 (A-68 §4) · ADITIVA: historial inmutable de informes del padre +
-- origen de creación del expediente.

ALTER TABLE "Expediente" ADD COLUMN IF NOT EXISTS "origenCreacion" TEXT NOT NULL DEFAULT 'AUTOMATICO';

CREATE TABLE IF NOT EXISTS "InformePadre" (
    "id"                 TEXT NOT NULL,
    "expedienteId"       TEXT NOT NULL,
    "numeroSecuencial"   INTEGER NOT NULL,
    "pdfHash"            TEXT NOT NULL,
    "codigoVerificacion" TEXT NOT NULL,
    "generadoEn"         TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generadoPorId"      TEXT NOT NULL,

    CONSTRAINT "InformePadre_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "InformePadre_pdfHash_key" ON "InformePadre"("pdfHash");
CREATE UNIQUE INDEX IF NOT EXISTS "InformePadre_expedienteId_numeroSecuencial_key" ON "InformePadre"("expedienteId", "numeroSecuencial");
CREATE INDEX IF NOT EXISTS "InformePadre_expedienteId_generadoEn_idx" ON "InformePadre"("expedienteId", "generadoEn" DESC);

ALTER TABLE "InformePadre" DROP CONSTRAINT IF EXISTS "InformePadre_expedienteId_fkey";
ALTER TABLE "InformePadre" ADD CONSTRAINT "InformePadre_expedienteId_fkey"
    FOREIGN KEY ("expedienteId") REFERENCES "Expediente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InformePadre" DROP CONSTRAINT IF EXISTS "InformePadre_generadoPorId_fkey";
ALTER TABLE "InformePadre" ADD CONSTRAINT "InformePadre_generadoPorId_fkey"
    FOREIGN KEY ("generadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
