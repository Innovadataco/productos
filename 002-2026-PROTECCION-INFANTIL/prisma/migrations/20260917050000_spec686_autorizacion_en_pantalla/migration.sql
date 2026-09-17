-- SPEC-686 (I-420) · La autorización del profesional se ACEPTA EN PANTALLA (no en papel).
--
-- Mismo mecanismo que el consentimiento del padre, TABLA APARTE: el profesional es el
-- PRESTADOR, no el titular del dato — su firma no va en `audit_consentimientos`
-- (roles-titulares.ts). Se guarda QUÉ texto exacto aceptó (versión + SHA-256), CUÁNDO e IP.
-- La verificación pasa a apuntar a la ACEPTACIÓN; la anterioridad `aceptadoEn <= revisadoEn`
-- prueba que la autorización fue PREVIA a la consulta de antecedentes (Ley 1918/2018 · Decreto
-- 753/2019). onDelete de esa FK = RESTRICT: la aceptación NUNCA se purga antes que la
-- verificación que ampara (REPORTE-062).
--
-- Escrita A MANO (I-420): en este repo `migrate dev`/`migrate diff` arrastran drift ajeno
-- (timestamptz↔timestamp(3), etc.), así que van SOLO los statements de SPEC-686, con los
-- nombres EXACTOS que genera Prisma. 100% aditiva salvo un DROP NOT NULL no destructivo
-- (ensancha la columna; ninguna fila existente se toca ni se pierde).

-- 1) La verificación ya no exige un archivo: las nuevas se respaldan en la aceptación en
--    pantalla. Las filas viejas conservan su `autorizacionArchivoId`.
ALTER TABLE "VerificacionProfesional" ALTER COLUMN "autorizacionArchivoId" DROP NOT NULL;

-- 2) FK a la aceptación que respaldó la verificación (nullable: las filas viejas no tienen).
ALTER TABLE "VerificacionProfesional" ADD COLUMN "aceptacionAutorizacionId" TEXT;

-- 3) La tabla de aceptaciones (espejo de `audit_consentimientos`, destino aparte).
CREATE TABLE "aceptaciones_autorizacion_profesional" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "documentoHash" TEXT NOT NULL,
    "aceptadoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT NOT NULL,
    "userAgent" TEXT,
    "creadoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aceptaciones_autorizacion_profesional_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "aceptaciones_autorizacion_profesional_usuarioId_aceptadoEn_idx"
    ON "aceptaciones_autorizacion_profesional"("usuarioId", "aceptadoEn");
CREATE INDEX "aceptaciones_autorizacion_profesional_version_idx"
    ON "aceptaciones_autorizacion_profesional"("version");

-- 4) Índice del lookup por la aceptación (reverse relation + el chequeo del Restrict).
CREATE INDEX "VerificacionProfesional_aceptacionAutorizacionId_idx"
    ON "VerificacionProfesional"("aceptacionAutorizacionId");

-- 5) FKs. usuario→aceptación: Cascade (igual que audit_consentimientos). verificación→
--    aceptación: RESTRICT — no se puede borrar una aceptación mientras una verificación la
--    referencie (protege la prueba de anterioridad; el orden de purga lo fija Datos).
ALTER TABLE "aceptaciones_autorizacion_profesional"
    ADD CONSTRAINT "aceptaciones_autorizacion_profesional_usuarioId_fkey"
    FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VerificacionProfesional"
    ADD CONSTRAINT "VerificacionProfesional_aceptacionAutorizacionId_fkey"
    FOREIGN KEY ("aceptacionAutorizacionId") REFERENCES "aceptaciones_autorizacion_profesional"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
