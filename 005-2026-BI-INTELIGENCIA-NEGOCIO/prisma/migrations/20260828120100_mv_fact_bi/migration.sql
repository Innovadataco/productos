-- SPEC-009 · 5 vistas materializadas BI · F3C 2026-08-28
-- Fuente: tablas replicadas via pg_logical desde pi-db
-- Reglas:
--   * COALESCE en columnas NULLables usadas en UNIQUE INDEX (D-26)
--   * IF NOT EXISTS para idempotencia
--   * un UNIQUE INDEX por MV -> REFRESH CONCURRENTLY habilitado

-- Extension vector (idempotente · ya existe en bi-db-replica pgvector)
CREATE EXTENSION IF NOT EXISTS "vector";

-- ── mv_fact_reporte_diario ──────────────────────────────────────────────────
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
LEFT JOIN "ClasificacionIA" c   ON c."reporteId"  = r.id
LEFT JOIN "CorreccionAdmin" ca  ON ca."reporteId" = r.id
WHERE r."eliminado" = false
GROUP BY 1, 2, 3, 4, 5, 6, 7, 8;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_fact_reporte_diario_uniq
  ON mv_fact_reporte_diario (dia, pais, ciudad, estado, categoria, prioridad_alta, es_rafaga, es_anonimo);

-- ── mv_fact_motor_ia_diario ─────────────────────────────────────────────────
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
LEFT JOIN "CorreccionAdmin" ca ON ca."reporteId" = c."reporteId"
GROUP BY 1, 2, 3;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_fact_motor_ia_diario_uniq
  ON mv_fact_motor_ia_diario (dia, categoria, modelo);

-- ── mv_fact_operativo ───────────────────────────────────────────────────────
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

-- ── mv_fact_comercial_mensual ───────────────────────────────────────────────
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_fact_comercial_mensual AS
SELECT
  date_trunc('month', bc."periodoInicio")              AS mes,
  COALESCE(p.nombre, 'desconocido')                    AS plan_nombre,
  COALESCE(bc.estado, 'desconocido')                   AS ciclo_estado,
  count(*)                                             AS total_ciclos,
  sum(bc.monto)                                        AS monto_total,
  avg(bc.monto)                                        AS monto_promedio
FROM "BillingCycle" bc
LEFT JOIN "Subscription" s ON s."tenantId" = bc."tenantId"
LEFT JOIN "Plan" p         ON p.id = s."planId"
GROUP BY 1, 2, 3;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_fact_comercial_mensual_uniq
  ON mv_fact_comercial_mensual (mes, plan_nombre, ciclo_estado);

-- ── mv_fact_salud_sistema ───────────────────────────────────────────────────
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_fact_salud_sistema AS
SELECT
  date_trunc('day', al."creadoEn")                     AS dia,
  COALESCE(al.accion, 'desconocida')                   AS accion,
  count(*)                                             AS total_eventos_audit,
  count(ace.id)                                        AS total_alertas_colegio,
  count(ase.id)                                        AS total_alertas_suscripcion
FROM "AuditLog" al
LEFT JOIN "AlertaColegio"      ace ON date_trunc('day', ace."creadoEn") = date_trunc('day', al."creadoEn")
LEFT JOIN "AlertaSuscripcion"  ase ON date_trunc('day', ase."creadoEn") = date_trunc('day', al."creadoEn")
GROUP BY 1, 2;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_fact_salud_sistema_uniq
  ON mv_fact_salud_sistema (dia, accion);
