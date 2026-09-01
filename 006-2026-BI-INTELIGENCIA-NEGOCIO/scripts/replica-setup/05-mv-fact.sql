-- ==========================================================================
-- 05-mv-fact.sql · Producto 006 · BI v2
-- 5 vistas materializadas mv_fact_* sobre las tablas REPLICADAS de PI.
-- Port de la migración 20260828120100_mv_fact_bi del 005 (contenido idéntico),
-- convertida en SCRIPT OPERATIVO, no migración Prisma.
--
-- ⚠️ CUÁNDO CORRE: SOLO después de que la suscripción bi006_replica_sub esté
--   activa y la copia inicial completa (script 04: 23 tablas en 'r'/'s').
--   Las MVs referencian tablas replicadas de PI ("Reporte", "ClasificacionIA",
--   etc.) que en una BD vacía NO existen.
--
-- ⚠️ DÓNDE NO CORRE (T4 · regla dura):
--   * NUNCA en prisma/migrations — la CI migra su BD desde cero y vacía:
--     una migración con estas MVs rompería el pipeline (relation does not
--     exist). Las migraciones Prisma del 006 cubren SOLO las tablas propias
--     (bi_catalogo_* · bi_consulta_log · bi_cache_semantico).
--   * NUNCA en CI ni en el seed.
--
-- IDEMPOTENTE: CREATE ... IF NOT EXISTS en MVs e índices; los REFRESH final
-- siempre es seguro repetirlo.
--
-- Reglas heredadas del 005 (D-26):
--   * COALESCE en columnas NULLables usadas en UNIQUE INDEX.
--   * Un UNIQUE INDEX por MV → habilita REFRESH CONCURRENTLY.
--   * Los refrescos programados (Fase 2+) usan REFRESH ... CONCURRENTLY;
--     el REFRESH de este script es el inicial (simple, tabla vacía o recién
--     sincronizada).
-- ==========================================================================

-- ─── Pre-flight B2: las tablas replicadas de PI DEBEN existir ──────────────
-- Si falta alguna, falla EN VOZ ALTA con la lista — nunca adivinar en silencio.
DO $$
DECLARE
  tabla text;
  faltantes text[] := ARRAY[]::text[];
  -- Tablas referenciadas por las 5 MVs (fuente: publicación bi_replica)
  requeridas text[] := ARRAY[
    'Reporte', 'ClasificacionIA', 'CorreccionAdmin',
    'TransicionReporte', 'SolicitudComite',
    'BillingCycle', 'Subscription', 'Plan',
    'AuditLog', 'AlertaColegio', 'AlertaSuscripcion'
  ];
BEGIN
  FOREACH tabla IN ARRAY requeridas LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = tabla AND c.relkind = 'r'
    ) THEN
      faltantes := faltantes || tabla;
    END IF;
  END LOOP;

  IF array_length(faltantes, 1) IS NOT NULL THEN
    RAISE EXCEPTION '[05] Faltan tablas replicadas de PI en bi-db: % — la réplica no está activa o el paso B-2 no corrió. Ver INSTRUCTIVO-REPLICA-006.md (pasos B-2/B-3/B-4). NUNCA correr 05 en una BD vacía.', faltantes;
  END IF;

  RAISE NOTICE '[05] Pre-flight OK: % tablas replicadas presentes', array_length(requeridas, 1);
END $$;

-- ── mv_fact_reporte_diario ─────────────────────────────────────────────────
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_fact_reporte_diario AS
SELECT
  date_trunc('day', r."creadoEn")                      AS dia,
  r.pais                                               AS pais,
  r.ciudad                                             AS ciudad,
  r.estado::text                                       AS estado,
  COALESCE(c.categoria::text, 'SIN_CLASIFICAR')        AS categoria,
  r."prioridadAlta"                                    AS prioridad_alta,
  r."esRafaga"                                         AS es_rafaga,
  r."esAnonimo"                                        AS es_anonimo,
  count(*)                                             AS total_reportes,
  count(c.id)                                          AS total_clasificados,
  count(ca.id)                                         AS total_corregidos,
  avg(c."confianza")                                   AS confianza_promedio,
  avg(c."latenciaMs")                                  AS latencia_ms_promedio
FROM "Reporte" r
LEFT JOIN "ClasificacionIA" c   ON c."reporteId"       = r.id
LEFT JOIN "CorreccionAdmin" ca  ON ca."clasificacionId" = c.id
WHERE r."eliminado" = false
GROUP BY 1, 2, 3, 4, 5, 6, 7, 8;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_fact_reporte_diario_uniq
  ON mv_fact_reporte_diario (dia, pais, ciudad, estado, categoria, prioridad_alta, es_rafaga, es_anonimo);

-- ── mv_fact_motor_ia_diario ────────────────────────────────────────────────
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_fact_motor_ia_diario AS
SELECT
  date_trunc('day', c."creadoEn")                      AS dia,
  COALESCE(c.categoria::text, 'SIN_CLASIFICAR')        AS categoria,
  COALESCE(c."modeloUsado", 'desconocido')             AS modelo,
  count(*)                                             AS total,
  count(ca.id)                                         AS total_corregidos,
  avg(c."confianza")                                   AS confianza_promedio,
  avg(c."latenciaMs")                                  AS latencia_ms_promedio
FROM "ClasificacionIA" c
LEFT JOIN "CorreccionAdmin" ca ON ca."clasificacionId" = c.id
GROUP BY 1, 2, 3;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_fact_motor_ia_diario_uniq
  ON mv_fact_motor_ia_diario (dia, categoria, modelo);

-- ── mv_fact_operativo ──────────────────────────────────────────────────────
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_fact_operativo AS
SELECT
  date_trunc('day', t."creadoEn")                      AS dia,
  t."estadoAnterior"::text                             AS estado_anterior,
  t."estadoNuevo"::text                                AS estado_nuevo,
  t."responsableTipo"::text                            AS responsable_tipo,
  count(*)                                             AS total_transiciones,
  count(sc.id)                                         AS total_solicitudes_comite
FROM "TransicionReporte" t
LEFT JOIN "SolicitudComite" sc
  ON sc."reporteId" = t."reporteId"
 AND date_trunc('day', sc."creadoEn") = date_trunc('day', t."creadoEn")
GROUP BY 1, 2, 3, 4;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_fact_operativo_uniq
  ON mv_fact_operativo (dia, estado_anterior, estado_nuevo, responsable_tipo);

-- ── mv_fact_comercial_mensual ──────────────────────────────────────────────
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_fact_comercial_mensual AS
SELECT
  date_trunc('month', bc."periodoInicio")              AS mes,
  COALESCE(p.nombre, 'desconocido')                    AS plan_nombre,
  COALESCE(bc.estado, 'desconocido')                   AS ciclo_estado,
  count(*)                                             AS total_ciclos,
  sum(bc.monto)                                        AS monto_total,
  avg(bc.monto)                                        AS monto_promedio
FROM "BillingCycle" bc
LEFT JOIN "Subscription" s ON s.id  = bc."subscriptionId"
LEFT JOIN "Plan" p         ON p.id = s."planId"
GROUP BY 1, 2, 3;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_fact_comercial_mensual_uniq
  ON mv_fact_comercial_mensual (mes, plan_nombre, ciclo_estado);

-- ── mv_fact_salud_sistema ──────────────────────────────────────────────────
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_fact_salud_sistema AS
SELECT
  date_trunc('day', al."creadoEn")                     AS dia,
  COALESCE(al.accion::text, 'desconocida')             AS accion,
  count(*)                                             AS total_eventos_audit,
  count(ace.id)                                        AS total_alertas_colegio,
  count(ase.id)                                        AS total_alertas_suscripcion
FROM "AuditLog" al
LEFT JOIN "AlertaColegio"      ace ON date_trunc('day', ace."creadoEn") = date_trunc('day', al."creadoEn")
LEFT JOIN "AlertaSuscripcion"  ase ON date_trunc('day', ase."creadoEn") = date_trunc('day', al."creadoEn")
GROUP BY 1, 2;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_fact_salud_sistema_uniq
  ON mv_fact_salud_sistema (dia, accion);

-- ─── REFRESH inicial ───────────────────────────────────────────────────────
-- REFRESH simple (no CONCURRENTLY): las MVs acaban de crearse y el volumen es
-- el de la copia inicial. Los refrescos programados posteriores (Fase 2+)
-- DEBEN usar REFRESH MATERIALIZED VIEW CONCURRENTLY (habilitado por los
-- UNIQUE INDEX de arriba, D-26) para no bloquear lecturas.
REFRESH MATERIALIZED VIEW mv_fact_reporte_diario;
REFRESH MATERIALIZED VIEW mv_fact_motor_ia_diario;
REFRESH MATERIALIZED VIEW mv_fact_operativo;
REFRESH MATERIALIZED VIEW mv_fact_comercial_mensual;
REFRESH MATERIALIZED VIEW mv_fact_salud_sistema;

-- ─── Verificación ──────────────────────────────────────────────────────────
SELECT matviewname, ispopulated
FROM pg_matviews
WHERE schemaname = 'public' AND matviewname LIKE 'mv\_fact\_%'
ORDER BY matviewname;
-- Esperado: 5 filas · ispopulated = t

-- ==========================================================================
-- AMPLIACION V2 (2026-09-01 · SPEC-006 · catálogo BI ampliado): 2 MVs nuevas
-- sobre tablas de la publicación ampliada (40 tablas, 02-pi-db-publicacion).
--
-- ADITIVO (regla dura): las 5 mv_fact_* originales de arriba YA VIVEN EN
-- PRODUCCION — NUNCA re-crearlas ni re-refrescarlas desde este bloque (su
-- REFRESH inicial ya corrió; la rutina es scripts/refresh-mv.sh CONCURRENTLY).
-- Por eso este bloque trae su propio pre-flight, sus propios REFRESH inicial
-- y su propia verificación, y NO toca nada de lo anterior.
--
--   ⚠️ OPERACION: scripts/refresh-mv.sh tiene la lista de MVs quemada (5).
--      Para que el cron refresque estas 2 nuevas cada 15 min hay que
--      agregarlas al `for` de ese script (fuera del alcance de este SQL).
--      Hasta entonces: refresco manual con
--      REFRESH MATERIALIZED VIEW CONCURRENTLY mv_fact_alerta_diario; etc.
--
-- Mismo estilo idempotente (D-26): CREATE ... IF NOT EXISTS + un UNIQUE INDEX
-- por MV (habilita REFRESH CONCURRENTLY) + COALESCE en columnas NULLables del
-- índice. Seguro repetir el script completo: no-ops si ya existen.
-- ==========================================================================

-- ─── Pre-flight V2: tablas que referencian las 2 MVs nuevas ────────────────
-- AlertaColegio y Reporte ya las cubre el pre-flight original; Ciudad y Pais
-- no. Se validan las 4 para que este bloque sea autocontenido.
DO $$
DECLARE
  tabla text;
  faltantes text[] := ARRAY[]::text[];
  requeridas text[] := ARRAY['AlertaColegio', 'Reporte', 'Ciudad', 'Pais'];
BEGIN
  FOREACH tabla IN ARRAY requeridas LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = tabla AND c.relkind = 'r'
    ) THEN
      faltantes := faltantes || tabla;
    END IF;
  END LOOP;

  IF array_length(faltantes, 1) IS NOT NULL THEN
    RAISE EXCEPTION '[05·v2] Faltan tablas replicadas de PI en bi-db: % — la réplica ampliada (40 tablas) no está activa. Ver INSTRUCTIVO-REPLICA-006.md. NUNCA correr 05 en una BD vacía.', faltantes;
  END IF;

  RAISE NOTICE '[05·v2] Pre-flight OK: % tablas replicadas presentes', array_length(requeridas, 1);
END $$;

-- ── mv_fact_alerta_diario ──────────────────────────────────────────────────
-- Alertas de colegio por dia × tipo de sujeto × estado.
-- AlertaColegio (replicada completa): tipoSujeto/estado/prioridad son strings
-- planos (NO enums PG): ESTUDIANTE|PROFESOR|ACUDIENTE ·
-- nueva|vista|gestionada|escalada|cerrada. creadoEn es timestamptz.
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_fact_alerta_diario AS
SELECT
  date_trunc('day', a."creadoEn")         AS dia,
  COALESCE(a."tipoSujeto", 'desconocido') AS tipo_sujeto,
  COALESCE(a."estado", 'desconocido')     AS estado,
  count(*)                                AS total_alertas
FROM "AlertaColegio" a
GROUP BY 1, 2, 3;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_fact_alerta_diario_uniq
  ON mv_fact_alerta_diario (dia, tipo_sujeto, estado);

-- ── mv_fact_geo_ciudad ─────────────────────────────────────────────────────
-- Reportes de los ultimos 12 meses por ciudad del catalogo geografico
-- (join Reporte.ciudadId -> Ciudad). Puebla el mapa de /geografia.
-- Honestidad (candado 9): los reportes SIN ciudadId resuelta NO aparecen en
-- esta MV (la cobertura geo se mide aparte contra "Reporte" total); y lat/lng
-- pueden ser NULL si la ciudad no tiene coordenadas — el mapa las omite,
-- nunca inventa. LEFT JOIN: ciudades sin reportes salen con total 0.
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_fact_geo_ciudad AS
SELECT
  c.id        AS ciudad_id,
  c.nombre    AS ciudad,
  p.nombre    AS pais,
  c.lat       AS lat,
  c.lng       AS lng,
  count(r.id) AS total_reportes_12m
FROM "Ciudad" c
JOIN "Pais" p ON p.id = c."paisId"
LEFT JOIN "Reporte" r
  ON r."ciudadId" = c.id
 AND r."eliminado" = false
 AND r."creadoEn" >= now() - interval '12 months'
GROUP BY c.id, c.nombre, p.nombre, c.lat, c.lng;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_fact_geo_ciudad_uniq
  ON mv_fact_geo_ciudad (ciudad_id);

-- ─── REFRESH inicial de las 2 nuevas ───────────────────────────────────────
-- REFRESH simple (no CONCURRENTLY): recien creadas sobre la copia inicial.
-- Los refrescos de rutina DEBEN usar CONCURRENTLY (indices unicos de arriba).
REFRESH MATERIALIZED VIEW mv_fact_alerta_diario;
REFRESH MATERIALIZED VIEW mv_fact_geo_ciudad;

-- ─── Verificación de la ampliación ─────────────────────────────────────────
SELECT matviewname, ispopulated
FROM pg_matviews
WHERE schemaname = 'public' AND matviewname LIKE 'mv\_fact\_%'
ORDER BY matviewname;
-- Esperado: 7 filas (5 originales + mv_fact_alerta_diario + mv_fact_geo_ciudad)
-- · ispopulated = t
