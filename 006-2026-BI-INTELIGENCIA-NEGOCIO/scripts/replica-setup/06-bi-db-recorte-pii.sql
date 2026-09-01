-- ==========================================================================
-- 06-bi-db-recorte-pii.sql · Producto 006 · BI v2 · 2026-09-01
--
-- Corre EN EL SUSCRIPTOR (bi-db), NUNCA en PI. Complemento obligatorio de la
-- publicación con column lists (02-pi-db-publicacion.sql): las columnas que la
-- publicación ya no envía se ELIMINAN FÍSICAMENTE de las tablas del suscriptor.
--
-- Por qué DROP COLUMN y no dejarlas en NULL:
--   1. El vuelco de schema trajo constraints NOT NULL de PI sobre esas
--      columnas → la copia inicial falla en bucle ("null value violates
--      not-null constraint") — verificado en vivo 2026-09-01.
--   2. Los datos PII ya replicados antes del recorte (nombres y documentos
--      de menores, nicks en claro) quedaban materializados en bi-db.
--      DROP COLUMN los borra de verdad (Ley 1581 — no basta anularlos).
--
-- Idempotente (DROP COLUMN IF EXISTS). La lista es el ESPEJO exacto de las
-- column lists de 02-pi-db-publicacion.sql: si el 02 cambia, este cambia.
-- ==========================================================================

-- Reporte: sin textos (evidencia), sin identificador del reportado, sin FKs a
-- personas, sin texto libre del reportante, sin errores de proceso.
ALTER TABLE "Reporte"
    DROP COLUMN IF EXISTS "texto",
    DROP COLUMN IF EXISTS "textoOriginal",
    DROP COLUMN IF EXISTS "identificador",
    DROP COLUMN IF EXISTS "usuarioId",
    DROP COLUMN IF EXISTS "operadorId",
    DROP COLUMN IF EXISTS "comiteId",
    DROP COLUMN IF EXISTS "eliminadoPorId",
    DROP COLUMN IF EXISTS "anonimizacionValidadaPorId",
    DROP COLUMN IF EXISTS "processingError",
    DROP COLUMN IF EXISTS "notaBaja",
    DROP COLUMN IF EXISTS "ciudad",
    DROP COLUMN IF EXISTS "pais",
    DROP COLUMN IF EXISTS "otraPlataforma";

-- Drift DDL de PI (pg_logical no replica DDL): el master agregó esta columna
-- tras el vuelco inicial del schema. Aditiva y tolerante (IF NOT EXISTS).
ALTER TABLE "Reporte" ADD COLUMN IF NOT EXISTS "reportePrincipalId" text;

-- Alumno (menor): sin nombre ni documento.
ALTER TABLE "Alumno"
    DROP COLUMN IF EXISTS "nombre",
    DROP COLUMN IF EXISTS "apellidos",
    DROP COLUMN IF EXISTS "documentoTipo",
    DROP COLUMN IF EXISTS "documentoNumero";

-- Identificadores: sin el valor (nick/teléfono) en claro — en NINGUNA.
ALTER TABLE "IdentificadorAlumno"     DROP COLUMN IF EXISTS "valor";
ALTER TABLE "IdentificadorAcudiente"  DROP COLUMN IF EXISTS "valor";
ALTER TABLE "IdentificadorProfesor"   DROP COLUMN IF EXISTS "valor";
ALTER TABLE "IdentificadorHijo"       DROP COLUMN IF EXISTS "valor";
ALTER TABLE "IdentificadorContacto"   DROP COLUMN IF EXISTS "valor";

-- Colegio: sin el representante legal (persona).
ALTER TABLE "Colegio"
    DROP COLUMN IF EXISTS "representanteLegalNombre",
    DROP COLUMN IF EXISTS "representanteLegalIdentificacion",
    DROP COLUMN IF EXISTS "representanteLegalEmail",
    DROP COLUMN IF EXISTS "representanteLegalTelefono";

-- AuditLog: sin IP, user-agent ni payloads de cambio.
ALTER TABLE "AuditLog"
    DROP COLUMN IF EXISTS "ipAddress",
    DROP COLUMN IF EXISTS "userAgent",
    DROP COLUMN IF EXISTS "valorAnterior",
    DROP COLUMN IF EXISTS "valorNuevo";

-- Profesor: sin identidad ni contacto.
ALTER TABLE "Profesor"
    DROP COLUMN IF EXISTS "nombre",
    DROP COLUMN IF EXISTS "apellidos",
    DROP COLUMN IF EXISTS "tipoDocumento",
    DROP COLUMN IF EXISTS "numeroDocumento",
    DROP COLUMN IF EXISTS "email",
    DROP COLUMN IF EXISTS "telefono";

-- AcudienteEstudiante: sin identidad ni contacto.
ALTER TABLE "AcudienteEstudiante"
    DROP COLUMN IF EXISTS "nombre",
    DROP COLUMN IF EXISTS "telefono",
    DROP COLUMN IF EXISTS "email";

-- Hijo (menor): sin nombre ni documento.
ALTER TABLE "Hijo"
    DROP COLUMN IF EXISTS "nombre",
    DROP COLUMN IF EXISTS "apellidos",
    DROP COLUMN IF EXISTS "documentoTipo",
    DROP COLUMN IF EXISTS "documentoNumero";

-- ContactoConfianza: sin nombre, nota ni etiqueta libre.
ALTER TABLE "ContactoConfianza"
    DROP COLUMN IF EXISTS "nombre",
    DROP COLUMN IF EXISTS "nota",
    DROP COLUMN IF EXISTS "etiqueta";

-- IdentificadorReportado (agregado público): sin el identificador en claro.
ALTER TABLE "IdentificadorReportado" DROP COLUMN IF EXISTS "identificador";

-- Suscripcion: sin contrato firmado, códigos de referido personales ni textos.
ALTER TABLE "Suscripcion"
    DROP COLUMN IF EXISTS "contratoPDFUrl",
    DROP COLUMN IF EXISTS "codigoReferidoPropio",
    DROP COLUMN IF EXISTS "codigoReferidoUsado",
    DROP COLUMN IF EXISTS "motivoCancelacion",
    DROP COLUMN IF EXISTS "referenciaPagoManual";

-- ── Verificación: en estas tablas no debe quedar NINGUNA columna vetada ──
DO $$
DECLARE
    vetada RECORD;
BEGIN
    FOR vetada IN
        SELECT c.table_name, c.column_name
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND (c.table_name, c.column_name) IN (
            ('Reporte','texto'),('Reporte','textoOriginal'),('Reporte','identificador'),
            ('Reporte','ciudad'),('Reporte','pais'),('Reporte','otraPlataforma'),
            ('Alumno','nombre'),('Alumno','apellidos'),('Alumno','documentoNumero'),
            ('IdentificadorAlumno','valor'),('IdentificadorAcudiente','valor'),
            ('IdentificadorProfesor','valor'),('IdentificadorHijo','valor'),
            ('IdentificadorContacto','valor'),
            ('Profesor','nombre'),('Profesor','numeroDocumento'),('Profesor','email'),
            ('AcudienteEstudiante','nombre'),('AcudienteEstudiante','email'),
            ('Hijo','nombre'),('Hijo','documentoNumero'),
            ('ContactoConfianza','nombre'),('IdentificadorReportado','identificador'),
            ('Suscripcion','contratoPDFUrl')
          )
    LOOP
        RAISE EXCEPTION '[06] Columna PII aún presente en el suscriptor: %.%', vetada.table_name, vetada.column_name;
    END LOOP;
    RAISE NOTICE '[06] Recorte PII del suscriptor completo — cero columnas vetadas presentes';
END $$;
