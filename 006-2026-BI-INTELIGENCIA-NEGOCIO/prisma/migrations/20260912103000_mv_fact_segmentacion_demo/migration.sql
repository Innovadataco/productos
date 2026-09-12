-- Migración 2026-09-12 · Segmentación demo/real en las 5 mv_fact_*
-- Producto 006 · BI v2
--
-- Predicado canónico (CEO 12-09-2026): «no es trabajo real» = marca en
-- demo_marcado (entidad='Reporte') O reporteId presente en simulacion_reportes.
-- Sin este predicado los tableros muestran un negocio que no existe.
--
-- ADITIVO en grano: no cambia GROUP BY ni índices únicos — solo suma una
-- columna `total_demo` (conteo FILTER) por MV. Las consumidoras actuales
-- (pulso.ts, insights.ts) no se ven afectadas; la fase 2 usa los contadores.
--
-- IDEMPOTENTE (DROP IF EXISTS + CREATE + INDEX IF NOT EXISTS + REFRESH):
-- seguro que prisma migrate deploy la re-ejecute en cada deploy.
--
-- OJO: el nombre físico es demo_marcado (no DemoMarcado) — escribir el del
-- modelo revienta la lectura (lección de PI, meses en debug).

-- ── mv_fact_reporte_diario ─────────────────────────────────────────────────
DROP MATERIALIZED VIEW IF EXISTS mv_fact_reporte_diario;
CREATE MATERIALIZED VIEW mv_fact_reporte_diario AS
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
  count(*) FILTER (WHERE EXISTS (
      SELECT 1 FROM demo_marcado dm
      WHERE dm.entidad = 'Reporte' AND dm."entidadId" = r.id)
    OR EXISTS (
      SELECT 1 FROM simulacion_reportes sr
      WHERE sr."reporteId" = r.id))                    AS total_demo,
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
DROP MATERIALIZED VIEW IF EXISTS mv_fact_motor_ia_diario;
CREATE MATERIALIZED VIEW mv_fact_motor_ia_diario AS
SELECT
  date_trunc('day', c."creadoEn")                      AS dia,
  COALESCE(c.categoria::text, 'SIN_CLASIFICAR')        AS categoria,
  COALESCE(c."modeloUsado", 'desconocido')             AS modelo,
  count(*)                                             AS total,
  count(*) FILTER (WHERE EXISTS (
      SELECT 1 FROM demo_marcado dm
      WHERE dm.entidad = 'Reporte' AND dm."entidadId" = c."reporteId")
    OR EXISTS (
      SELECT 1 FROM simulacion_reportes sr
      WHERE sr."reporteId" = c."reporteId"))           AS total_demo,
  count(ca.id)                                         AS total_corregidos,
  avg(c."confianza")                                   AS confianza_promedio,
  avg(c."latenciaMs")                                  AS latencia_ms_promedio
FROM "ClasificacionIA" c
LEFT JOIN "CorreccionAdmin" ca ON ca."clasificacionId" = c.id
GROUP BY 1, 2, 3;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_fact_motor_ia_diario_uniq
  ON mv_fact_motor_ia_diario (dia, categoria, modelo);

-- ── mv_fact_operativo ──────────────────────────────────────────────────────
DROP MATERIALIZED VIEW IF EXISTS mv_fact_operativo;
CREATE MATERIALIZED VIEW mv_fact_operativo AS
SELECT
  date_trunc('day', t."creadoEn")                      AS dia,
  t."estadoAnterior"::text                             AS estado_anterior,
  t."estadoNuevo"::text                                AS estado_nuevo,
  t."responsableTipo"::text                            AS responsable_tipo,
  count(*)                                             AS total_transiciones,
  count(*) FILTER (WHERE EXISTS (
      SELECT 1 FROM demo_marcado dm
      WHERE dm.entidad = 'Reporte' AND dm."entidadId" = t."reporteId")
    OR EXISTS (
      SELECT 1 FROM simulacion_reportes sr
      WHERE sr."reporteId" = t."reporteId"))           AS total_demo
FROM "TransicionReporte" t
GROUP BY 1, 2, 3, 4;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_fact_operativo_uniq
  ON mv_fact_operativo (dia, estado_anterior, estado_nuevo, responsable_tipo);

-- ── mv_fact_alerta_diario ──────────────────────────────────────────────────
DROP MATERIALIZED VIEW IF EXISTS mv_fact_alerta_diario;
CREATE MATERIALIZED VIEW mv_fact_alerta_diario AS
SELECT
  date_trunc('day', a."creadoEn")         AS dia,
  COALESCE(a."tipoSujeto", 'desconocido') AS tipo_sujeto,
  COALESCE(a."estado", 'desconocido')     AS estado,
  count(*)                                AS total_alertas,
  count(*) FILTER (WHERE EXISTS (
      SELECT 1 FROM demo_marcado dm
      WHERE dm.entidad = 'Reporte' AND dm."entidadId" = a."reporteId")
    OR EXISTS (
      SELECT 1 FROM simulacion_reportes sr
      WHERE sr."reporteId" = a."reporteId")) AS total_demo
FROM "AlertaColegio" a
GROUP BY 1, 2, 3;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_fact_alerta_diario_uniq
  ON mv_fact_alerta_diario (dia, tipo_sujeto, estado);

-- ── mv_fact_geo_ciudad ─────────────────────────────────────────────────────
DROP MATERIALIZED VIEW IF EXISTS mv_fact_geo_ciudad;
CREATE MATERIALIZED VIEW mv_fact_geo_ciudad AS
SELECT
  c.id        AS ciudad_id,
  c.nombre    AS ciudad,
  p.nombre    AS pais,
  c.lat       AS lat,
  c.lng       AS lng,
  count(r.id) AS total_reportes_12m,
  count(r.id) FILTER (WHERE r.id IS NOT NULL AND (EXISTS (
      SELECT 1 FROM demo_marcado dm
      WHERE dm.entidad = 'Reporte' AND dm."entidadId" = r.id)
    OR EXISTS (
      SELECT 1 FROM simulacion_reportes sr
      WHERE sr."reporteId" = r.id)))      AS total_demo_12m
FROM "Ciudad" c
JOIN "Pais" p ON p.id = c."paisId"
LEFT JOIN "Reporte" r
  ON r."ciudadId" = c.id
 AND r."eliminado" = false
 AND r."creadoEn" >= now() - interval '12 months'
GROUP BY c.id, c.nombre, p.nombre, c.lat, c.lng;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_fact_geo_ciudad_uniq
  ON mv_fact_geo_ciudad (ciudad_id);

-- ─── REFRESH inicial + verificación ────────────────────────────────────────
REFRESH MATERIALIZED VIEW mv_fact_reporte_diario;
REFRESH MATERIALIZED VIEW mv_fact_motor_ia_diario;
REFRESH MATERIALIZED VIEW mv_fact_operativo;
REFRESH MATERIALIZED VIEW mv_fact_alerta_diario;
REFRESH MATERIALIZED VIEW mv_fact_geo_ciudad;

SELECT matviewname, ispopulated
FROM pg_matviews
WHERE schemaname = 'public' AND matviewname LIKE 'mv\_fact\_%'
ORDER BY matviewname;
-- Esperado: 5 filas · ispopulated = t

-- Desglose demo/real de control (debe cuadrar con el banner):
SELECT sum(total_reportes) AS reportes_total, sum(total_demo) AS reportes_demo
FROM mv_fact_reporte_diario;
