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
-- personas, sin errores de proceso ni nota de baja libre.
-- SE QUEDAN publicadas (y en el suscriptor): ciudad/pais/otraPlataforma —
-- texto geográfico de respaldo (nombre de ciudad, no persona) del que DEPENDE
-- la MV mv_fact_reporte_diario; motivoBaja (enum administrativo);
-- operadorId (cuid interno del operario — autorizado por Jelkin el 2026-09-02
-- para la capacidad operativa, PR 006#295; la publicación lo envía desde esa
-- fecha, ver 02).
ALTER TABLE "Reporte"
    DROP COLUMN IF EXISTS "texto",
    DROP COLUMN IF EXISTS "textoOriginal",
    DROP COLUMN IF EXISTS "identificador",
    DROP COLUMN IF EXISTS "usuarioId",
    DROP COLUMN IF EXISTS "comiteId",
    DROP COLUMN IF EXISTS "eliminadoPorId",
    DROP COLUMN IF EXISTS "anonimizacionValidadaPorId",
    DROP COLUMN IF EXISTS "processingError",
    DROP COLUMN IF EXISTS "notaBaja";

-- Drift DDL de PI (pg_logical no replica DDL): el master agregó esta columna
-- tras el vuelco inicial del schema. Aditiva y tolerante (IF NOT EXISTS).
ALTER TABLE "Reporte" ADD COLUMN IF NOT EXISTS "reportePrincipalId" text;
-- Igual: operadorId llegó a la publicación el 2026-09-02 (PR 006#295); un
-- suscriptor creado del vuelco viejo puede no tenerla. Texto sin constraint:
-- el backfill inicial se hace por COPY y la columna es libre en PI.
ALTER TABLE "Reporte" ADD COLUMN IF NOT EXISTS "operadorId" text;

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

-- Hijo (menor): sin nombre ni documento NI usuarioId (FK al padre — no se
-- publica; el vínculo viaja por HijoPadre, que sí está completa).
ALTER TABLE "Hijo"
    DROP COLUMN IF EXISTS "nombre",
    DROP COLUMN IF EXISTS "apellidos",
    DROP COLUMN IF EXISTS "documentoTipo",
    DROP COLUMN IF EXISTS "documentoNumero",
    DROP COLUMN IF EXISTS "usuarioId";

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

-- ── Lotes A·B·C (2026-09-03): espejo de las 6 tablas nuevas de 02 ──────────
-- Pago: sin el comprobante (URL/mime/hash del cliente), sin textos libres
-- (motivos, notas, referencias) y sin FKs a personas ni código de referido.
-- OJO: comprobante* llegan NOT NULL del vuelco — este DROP es lo que permite
-- el backfill inicial por COPY (mismo problema NOT NULL de 2026-09-01).
ALTER TABLE "Pago"
    DROP COLUMN IF EXISTS "comprobanteAdjuntoUrl",
    DROP COLUMN IF EXISTS "comprobanteMimeType",
    DROP COLUMN IF EXISTS "comprobanteHashSha256",
    DROP COLUMN IF EXISTS "motivoRechazo",
    DROP COLUMN IF EXISTS "autorizadoPorAdminId",
    DROP COLUMN IF EXISTS "codigoReferidoUsado",
    DROP COLUMN IF EXISTS "motivoReembolso",
    DROP COLUMN IF EXISTS "referenciaReembolso",
    DROP COLUMN IF EXISTS "notasCliente";

-- pasos_procesamiento: sin el Json de detalle (puede arrastrar texto).
ALTER TABLE "pasos_procesamiento" DROP COLUMN IF EXISTS "detalle";
-- ReintentoReporte: sin el mensaje de error (texto libre).
ALTER TABLE "ReintentoReporte" DROP COLUMN IF EXISTS "error";
-- HealthProbe: sin el detalle libre del monitor.
ALTER TABLE "HealthProbe" DROP COLUMN IF EXISTS "detalle";
-- worker_logs: sin el contexto Json libre (el mensaje VarChar(500) ya está
-- garantizado sin PII por SPEC-193).
ALTER TABLE "worker_logs" DROP COLUMN IF EXISTS "contextoJson";
-- IncidenteInfra: sin detalle libre ni la marca de email interno.
ALTER TABLE "IncidenteInfra"
    DROP COLUMN IF EXISTS "detalle",
    DROP COLUMN IF EXISTS "ultimoEmailEn";

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
            ('Reporte','notaBaja'),
            ('Alumno','nombre'),('Alumno','apellidos'),('Alumno','documentoNumero'),
            ('IdentificadorAlumno','valor'),('IdentificadorAcudiente','valor'),
            ('IdentificadorProfesor','valor'),('IdentificadorHijo','valor'),
            ('IdentificadorContacto','valor'),
            ('Profesor','nombre'),('Profesor','numeroDocumento'),('Profesor','email'),
            ('AcudienteEstudiante','nombre'),('AcudienteEstudiante','email'),
            ('Hijo','nombre'),('Hijo','documentoNumero'),
            ('ContactoConfianza','nombre'),('IdentificadorReportado','identificador'),
            ('Suscripcion','contratoPDFUrl'),
            ('Pago','comprobanteAdjuntoUrl'),('Pago','notasCliente'),
            ('pasos_procesamiento','detalle'),('ReintentoReporte','error'),
            ('HealthProbe','detalle'),('worker_logs','contextoJson'),
            ('IncidenteInfra','detalle')
          )
    LOOP
        RAISE EXCEPTION '[06] Columna PII aún presente en el suscriptor: %.%', vetada.table_name, vetada.column_name;
    END LOOP;
    RAISE NOTICE '[06] Recorte PII del suscriptor completo — cero columnas vetadas presentes';
END $$;
