-- SPEC-320 (§2.2) · Identidad del profesor OBLIGATORIA (tipo/número de documento,
-- año de nacimiento, sexo, email y teléfono). Estado final: NOT NULL sin default.
--
-- POR QUÉ ESTE UPDATE CON PLACEHOLDERS (condición CEO 2, para quien lo lea en 2 semanas):
-- al momento del deploy había 2 filas de Profesor de PRUEBA (Jelkin probando). Postgres
-- no admite agregar columnas NOT NULL sin default sobre una tabla con filas, así que se
-- rellenan con placeholders POR-FILA y ÚNICOS y recién ahí se pone NOT NULL. NO se hace
-- truncate (arrastraría AlertaColegio vía FK). Estas 2 filas son datos desechables: el
-- reset-piloto post-deploy se las lleva. Los profesores reales nacen con identidad
-- completa validada en la app; nunca pasan por acá.
--
-- Placeholders que GRITAN (condición CEO 1): nadie los confunde con datos reales y el
-- rector ve de inmediato que es relleno de migración. (sexo: 'OTRO' es el único valor no
-- informativo del set M|F|OTRO; documento y email ya marcan la fila como placeholder.)

-- 1) columnas nuevas nullable
ALTER TABLE "Profesor"
  ADD COLUMN "anioNacimiento"  INTEGER,
  ADD COLUMN "numeroDocumento" TEXT,
  ADD COLUMN "sexo"            TEXT,
  ADD COLUMN "tipoDocumento"   TEXT;

-- 2) placeholder por-fila y único (numeroDocumento='MIGR-'||id no choca con el UNIQUE);
--    email/telefono conservan lo que haya, o placeholder que grita si vienen vacíos.
UPDATE "Profesor" SET
  "numeroDocumento" = 'MIGR-' || id,
  "tipoDocumento"   = 'OTRO',
  "anioNacimiento"  = 0,
  "sexo"            = 'OTRO',
  "email"    = COALESCE(NULLIF("email", ''), 'migracion-' || id || '@placeholder.invalid'),
  "telefono" = COALESCE(NULLIF("telefono", ''), 'MIGR-000');

-- 3) ahora sí, NOT NULL en todo el bloque de identidad
ALTER TABLE "Profesor"
  ALTER COLUMN "anioNacimiento"  SET NOT NULL,
  ALTER COLUMN "numeroDocumento" SET NOT NULL,
  ALTER COLUMN "sexo"            SET NOT NULL,
  ALTER COLUMN "tipoDocumento"   SET NOT NULL,
  ALTER COLUMN "email"           SET NOT NULL,
  ALTER COLUMN "telefono"        SET NOT NULL;

-- 4) llave humana: tipo+número único por colegio
CREATE UNIQUE INDEX "Profesor_colegioId_tipoDocumento_numeroDocumento_key" ON "Profesor"("colegioId", "tipoDocumento", "numeroDocumento");
