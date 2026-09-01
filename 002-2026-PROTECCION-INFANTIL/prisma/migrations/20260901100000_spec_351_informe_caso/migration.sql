-- SPEC-351 (A-69 · C5) · el informe firmado del rector.
-- ADITIVA: columna nueva nullable en Colegio + tabla nueva InformeCaso.

-- 1. Escudo institucional (D1) — solo PNG/JPG, validado en el upload.
ALTER TABLE "Colegio" ADD COLUMN "escudoAssetKey" TEXT;

-- 2. Informe firmado del caso — INMUTABLE (sin update/delete en ninguna capa).
CREATE TABLE "InformeCaso" (
    "id"                  TEXT NOT NULL,
    "casoId"              TEXT NOT NULL,
    "numeroCorrelativo"   INTEGER NOT NULL,
    "anio"                INTEGER NOT NULL,
    "pdfHash"             TEXT NOT NULL,
    "codigoVerificacion"  TEXT NOT NULL,
    "firmadoPorNombre"    TEXT NOT NULL,
    "firmadoPorDocumento" TEXT NOT NULL,
    "firmadoPorId"        TEXT NOT NULL,
    "escudoAssetKey"      TEXT,
    "seccionesJson"       JSONB NOT NULL,
    "generadoEn"          TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InformeCaso_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "InformeCaso"
    ADD CONSTRAINT "InformeCaso_casoId_fkey"
    FOREIGN KEY ("casoId") REFERENCES "SeguimientoCaso"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InformeCaso"
    ADD CONSTRAINT "InformeCaso_firmadoPorId_fkey"
    FOREIGN KEY ("firmadoPorId") REFERENCES "Usuario"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "InformeCaso_pdfHash_key" ON "InformeCaso"("pdfHash");
CREATE UNIQUE INDEX "InformeCaso_codigoVerificacion_key" ON "InformeCaso"("codigoVerificacion");
CREATE UNIQUE INDEX "InformeCaso_casoId_anio_numeroCorrelativo_key"
    ON "InformeCaso"("casoId", "anio", "numeroCorrelativo");
CREATE INDEX "InformeCaso_casoId_generadoEn_idx" ON "InformeCaso"("casoId", "generadoEn" DESC);
