-- SPEC-436 (I-303 · I-304) — los documentos del profesional.
--
-- 1) La columna dejaba de decir la verdad: guardaba el identificador opaco del
--    archivo cifrado, no una dirección. Se renombra (RENAME conserva los datos;
--    no hay backfill que hacer).
ALTER TABLE "PerfilProfesional" RENAME COLUMN "autorizacionArchivoUrl" TO "autorizacionArchivoId";
ALTER TABLE "VerificacionProfesional" RENAME COLUMN "autorizacionArchivoUrl" TO "autorizacionArchivoId";

-- 2) Los documentos por requisito. `requisitoClave` es texto libre a propósito:
--    la lista vive en el parámetro `verificacion.requisitos`, así que un quinto
--    requisito no cuesta una migración.
CREATE TABLE "DocumentoProfesional" (
    "id" TEXT NOT NULL,
    "perfilProfesionalId" TEXT NOT NULL,
    "requisitoClave" TEXT NOT NULL,
    "archivoId" TEXT NOT NULL,
    "extension" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "subidoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentoProfesional_pkey" PRIMARY KEY ("id")
);

-- Uno por requisito: reemplazar actualiza la fila.
CREATE UNIQUE INDEX "DocumentoProfesional_perfilProfesionalId_requisitoClave_key"
    ON "DocumentoProfesional"("perfilProfesionalId", "requisitoClave");
CREATE INDEX "DocumentoProfesional_perfilProfesionalId_idx"
    ON "DocumentoProfesional"("perfilProfesionalId");

ALTER TABLE "DocumentoProfesional" ADD CONSTRAINT "DocumentoProfesional_perfilProfesionalId_fkey"
    FOREIGN KEY ("perfilProfesionalId") REFERENCES "PerfilProfesional"("id") ON DELETE CASCADE ON UPDATE CASCADE;
