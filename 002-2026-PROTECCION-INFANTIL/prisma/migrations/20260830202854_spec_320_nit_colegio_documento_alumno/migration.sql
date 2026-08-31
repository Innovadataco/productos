-- SPEC-320 (§2.2-bis) · NIT del colegio (único global) + documento del alumno obligatorio.
--
-- POR QUÉ LOS PLACEHOLDERS (para quien lo lea en 2 semanas):
--   · Colegio.nit nace NOT NULL + UNIQUE global. En prod hay 2 filas de Colegio de
--     prueba → placeholder por-fila que GRITA 'MIG-NIT-'||id (único, no choca con el
--     UNIQUE). Sin truncate; el reset-piloto post-deploy las limpia.
--   · Alumno.documentoTipo/documentoNumero pasan a NOT NULL. En PROD hay 0 alumnos, así
--     que allá es un NOT NULL LIMPIO (el UPDATE de abajo es no-op). El UPDATE existe SOLO
--     para que la migración aplique también sobre las filas de prueba de dev/test (que sí
--     tienen alumnos con documento NULL); marca esas filas con 'MIG-ALU-'||id (gritan) y
--     tipoDocumento 'OTRO' (clave del catálogo). No deja residuo en prod.

-- ① NIT del colegio
ALTER TABLE "Colegio" ADD COLUMN "nit" TEXT;
UPDATE "Colegio" SET "nit" = 'MIG-NIT-' || id WHERE "nit" IS NULL;
ALTER TABLE "Colegio" ALTER COLUMN "nit" SET NOT NULL;
CREATE UNIQUE INDEX "Colegio_nit_key" ON "Colegio"("nit");

-- ② Documento del alumno obligatorio (tabla física "Alumno")
UPDATE "Alumno" SET
  "documentoTipo"   = COALESCE("documentoTipo", 'OTRO'),
  "documentoNumero" = COALESCE("documentoNumero", 'MIG-ALU-' || id)
WHERE "documentoTipo" IS NULL OR "documentoNumero" IS NULL;
ALTER TABLE "Alumno" ALTER COLUMN "documentoTipo" SET NOT NULL;
ALTER TABLE "Alumno" ALTER COLUMN "documentoNumero" SET NOT NULL;

-- Único por colegio: (colegioId, documentoTipo, documentoNumero) — parcial WHERE
-- estado='activo' (consistente con §2.1). Dato confiable para el cruce padre↔colegio.
CREATE UNIQUE INDEX "Alumno_colegio_documento_key" ON "Alumno" ("colegioId", "documentoTipo", "documentoNumero") WHERE ("estado" = 'activo');
