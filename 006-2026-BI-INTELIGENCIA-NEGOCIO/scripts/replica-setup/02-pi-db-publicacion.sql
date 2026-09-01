-- ==========================================================================
-- 02-pi-db-publicacion.sql · Producto 006 · BI v2
-- Publicación lógica `bi_replica` en el Postgres de PI (pg_logical).
--
-- DÓNDE CORRE: en el Postgres de PI (pi-db · PUBLICADOR), DESPUÉS de
--   01-pi-db-crear-usuario-replica.sql. Lo ejecuta Jelkin con autorización.
--   Pre-requisito: wal_level=logical activo en pi-db (Fase A del 005, ya
--   verificado con SHOW wal_level el 2026-08-28).
--
-- ESTADO (verificado con CEO 2026-09-01): la publicación `bi_replica` YA
--   EXISTE en PI con las 23 tablas operativas. Este script es IDEMPOTENTE:
--   reconcilia — crea la publicación solo si falta y agrega solo las tablas
--   canónicas que falten. NUNCA quita tablas ni toca datos de PI.
--
-- PROHIBICIÓN PII (Ley 1581 · no negociable): Usuario, Password, Session y
--   TokenRecuperacion JAMÁS van en la publicación — datos de menores y
--   credenciales nunca llegan a BI. Este script FALLA EN VOZ ALTA (B2) si
--   detecta alguna dentro de la publicación.
--
-- REGLA DE GOBIERNO (AGENTS.md §7): agregar una tabla nueva a la publicación
--   exige pedirla por nombre y autorización de Jelkin. Las 23 tablas de abajo
--   son la lista canónica autorizada (D-20 del 005 · verificada 2026-08-28).
--
-- HALLAZGO CANDADO 15 del 005 (se conserva): modelos Prisma con @@map a
--   nombre snake_case en BD — la publicación usa el nombre REAL de tabla:
--     ClasificacionRubricaVoto → clasificacion_rubrica_votos  (en la lista)
--     SimulacionRun            → simulacion_runs              (no aplica)
--     SimulacionReporte        → simulacion_reportes          (no aplica)
--   Verificar futuros @@map con: grep '@@map' schema.prisma (en el repo PI).
-- ==========================================================================

DO $$
DECLARE
  tabla text;
  -- 23 tablas OPERATIVAS autorizadas · sin PII (Ley 1581)
  tablas_canonicas text[] := ARRAY[
    'Reporte',
    'ClasificacionIA',
    'clasificacion_rubrica_votos',  -- @@map · nombre real en BD
    'CorreccionAdmin',
    'EmbeddingReporte',
    'TransicionReporte',
    'SolicitudComite',
    'FuenteReporte',
    'Subscription',
    'BillingCycle',
    'Plan',
    'Tenant',
    'Colegio',
    'Curso',
    'Alumno',
    'IdentificadorAlumno',
    'AlertaColegio',
    'AlertaSuscripcion',
    'Plataforma',
    'Pais',
    'Departamento',
    'Ciudad',
    'AuditLog'
  ];
  -- Tablas con PII/credenciales · PROHIBIDAS en la publicación (Ley 1581).
  -- Verificado en fuente (schema.prisma de PI, 2026-09-01): existen "Usuario"
  -- y "TokenRecuperacion"; "Password"/"Session" no existen hoy pero quedan
  -- vetadas por si aparecen en el futuro.
  tablas_prohibidas text[] := ARRAY['Usuario', 'Password', 'Session', 'TokenRecuperacion'];
  tabla_pii text;
BEGIN
  -- 1. Crear la publicación SOLO si no existe (idempotente).
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'bi_replica') THEN
    EXECUTE 'CREATE PUBLICATION bi_replica FOR TABLE '
      || (SELECT string_agg(quote_ident(t), ', ') FROM unnest(tablas_canonicas) AS t);
    RAISE NOTICE '[02] Publicación bi_replica creada con % tablas', array_length(tablas_canonicas, 1);
  ELSE
    RAISE NOTICE '[02] Publicación bi_replica ya existe — reconciliando tablas';
  END IF;

  -- 2. Agregar SOLO las tablas canónicas que falten (nunca quita ninguna).
  FOREACH tabla IN ARRAY tablas_canonicas LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'bi_replica' AND tablename = tabla
    ) THEN
      EXECUTE format('ALTER PUBLICATION bi_replica ADD TABLE %I', tabla);
      RAISE NOTICE '[02] Tabla agregada a bi_replica: %', tabla;
    END IF;
  END LOOP;

  -- 3. GUARD PII (Ley 1581 · B2): falla EN VOZ ALTA si hay PII publicada.
  FOREACH tabla_pii IN ARRAY tablas_prohibidas LOOP
    IF EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'bi_replica' AND tablename = tabla_pii
    ) THEN
      RAISE EXCEPTION '[02] PII en publicación bi_replica: % — PROHIBIDO por Ley 1581. Retirarla con ALTER PUBLICATION bi_replica DROP TABLE % antes de continuar.', tabla_pii, tabla_pii;
    END IF;
  END LOOP;
END $$;

-- Verificación final.
SELECT pubname, puballtables FROM pg_publication WHERE pubname = 'bi_replica';
-- Esperado: bi_replica | f  (f = lista explícita de tablas · correcto)

SELECT tablename FROM pg_publication_tables WHERE pubname = 'bi_replica' ORDER BY tablename;
-- Esperado: 23 filas con los nombres de la lista canónica · SIN Usuario/Password/Session/TokenRecuperacion
