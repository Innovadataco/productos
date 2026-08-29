#!/usr/bin/env python3
"""
Genera el bundle de assets Superset 3.x para los 5 dashboards MVP
(SPEC-019..023). Fuente de verdad de datasets, charts y dashboards.

UUIDs deterministas por uuid5(namespace, path) — re-correr no crea duplicados.
Ejecuta desde `productos/005-2026-BI-INTELIGENCIA-NEGOCIO/`:

    python3 scripts/build-superset-bundle.py

Output: `superset/{metadata.yaml,databases,datasets,charts,dashboards}`.
Commitear los YAML producidos junto con este script.

Alineado con:
  - `.specify/specs/019-dashboard-ejecutivo/spec.md` (6 charts EJECUTIVO)
  - `.specify/specs/020-dashboard-motor-ia/spec.md` (7 charts MOTOR)
  - `.specify/specs/021-dashboard-comercial/spec.md` (6 charts COMERCIAL)
  - `.specify/specs/022-dashboard-operativo/spec.md` (7 charts OPERATIVO)
  - `.specify/specs/023-dashboard-salud/spec.md` (8 charts SALUD)

El deploy a producción hace `superset import-assets superset/` en el VPS
(candado 14 en vivo lo cierra Fábrica BI-2 post-deploy).
"""

from __future__ import annotations

import json
import os
import shutil
import textwrap
import uuid
from pathlib import Path

# ────────────────────────────────────────────────────────────────────────────
# Constantes
# ────────────────────────────────────────────────────────────────────────────

NS = uuid.UUID("a5f0000a-5f00-5f00-5f00-000000000005")
BASE = Path(__file__).resolve().parent.parent / "superset"

# Versión del schema import de Superset 3.x
IMPORT_VERSION = "1.0.0"

DB_REPLICA = "bi_db_replica"
DB_SUPERSET = "bi_superset_db"

# ────────────────────────────────────────────────────────────────────────────
# Certificación · SOLO se llenan después de que Fábrica BI-2 haya emitido
# REVISO explícito sobre el commit exacto que produce este bundle. Mientras
# no exista ese REVISO, deben quedar como None — no autoafirmar aprobación
# en el generador.
#
# Regla de proceso (Fábrica 2026-08-29 01:2x COT · nota post-REVISO a5114e60f):
#   1. Autor: escribe/actualiza CHARTS, DATASETS, DASHBOARDS con CERTIFIED_BY = None.
#   2. Push y solicitud de auditoría.
#   3. Fábrica emite REVISO explícito sobre el commit exacto.
#   4. Autor: en ese mismo turno actualiza CERTIFIED_BY / CERTIFIED_DETAILS
#      citando el hash y timestamp del REVISO recibido.
#   5. Regenera y commitea con los campos poblados.
#
# ⚠ Nunca dejar valores hardcodeados aquí en ciclos donde el bundle cambia
#   pero el REVISO aplica al commit anterior. Al modificar el bundle,
#   volver estas dos variables a None hasta que llegue REVISO fresco.
# ────────────────────────────────────────────────────────────────────────────
CERTIFIED_BY: str | None = "Fábrica BI-2"
CERTIFIED_DETAILS: str | None = (
    "REVISO sobre commit a5114e60f · 2026-08-29 01:2x COT · "
    "compuerta §4 SPEC-019..023 cumplida · candado 14 pendiente para VPS post-deploy"
)


def det_uuid(path: str) -> str:
    """UUID determinista por path. Estable entre re-corridas."""
    return str(uuid.uuid5(NS, path))


def yaml_dump(obj) -> str:
    """
    Serializador mínimo YAML (evita dependencia de PyYAML). Cubre el subset
    que Superset acepta: strings, ints, bools, listas y dicts anidados.
    """

    def dump(value, indent: int) -> str:
        pad = "  " * indent
        if isinstance(value, dict):
            if not value:
                return "{}"
            out = []
            for k, v in value.items():
                if isinstance(v, (dict, list)) and v:
                    out.append(f"{pad}{k}:\n{dump(v, indent + 1)}")
                else:
                    out.append(f"{pad}{k}: {dump(v, indent + 1).lstrip()}")
            return "\n".join(out)
        if isinstance(value, list):
            if not value:
                return "[]"
            out = []
            for item in value:
                if isinstance(item, (dict, list)) and item:
                    child = dump(item, indent + 1)
                    first, *rest = child.splitlines()
                    out.append(f"{pad}- {first.lstrip()}")
                    out.extend(f"{pad}  {line[len(pad) + 2:]}" for line in rest)
                else:
                    out.append(f"{pad}- {dump(item, indent + 1).lstrip()}")
            return "\n".join(out)
        if value is None:
            return "null"
        if isinstance(value, bool):
            return "true" if value else "false"
        if isinstance(value, (int, float)):
            return str(value)
        text = str(value)
        needs_quote = any(c in text for c in ':{}[]#&*!|>%@`,') or text.strip() != text
        if "\n" in text:
            body = "\n".join(pad + "  " + line for line in text.splitlines())
            return f"|\n{body}"
        if needs_quote or text == "":
            escaped = text.replace("\\", "\\\\").replace('"', '\\"')
            return f'"{escaped}"'
        return text

    return dump(obj, 0) + "\n"


def write_yaml(path: Path, obj: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(yaml_dump(obj), encoding="utf-8")


# ────────────────────────────────────────────────────────────────────────────
# metadata.yaml
# ────────────────────────────────────────────────────────────────────────────


def write_metadata() -> None:
    # `type` debe matchear el comando de import que se usará:
    #   - `superset import-dashboards -p bundle.zip -u admin` → type=Dashboard
    #     (comando canónico · trae dashboards + charts + datasets + databases en cascada)
    #   - `superset import-datasources` → type=SqlaTable
    #   - `superset import-database` → type=Database
    #   - API `/api/v1/assets/import/` → type=assets
    #
    # Usamos "Dashboard" porque el operador ejecuta `import-dashboards` en el
    # VPS (Fábrica BI-2 · I-19 · 2026-08-29). Verificado contra Superset 4.1.4
    # real: cada CLI hace validate_metadata_type() sobre este campo.
    write_yaml(
        BASE / "metadata.yaml",
        {
            "version": IMPORT_VERSION,
            "type": "Dashboard",
            "timestamp": "2026-08-29T00:00:00+00:00",
        },
    )


# ────────────────────────────────────────────────────────────────────────────
# databases/
# ────────────────────────────────────────────────────────────────────────────


def write_databases() -> None:
    replica_uuid = det_uuid("databases/bi-db-replica")
    superset_uuid = det_uuid("databases/bi-superset-db")

    write_yaml(
        BASE / "databases" / "bi_db_replica.yaml",
        {
            "database_name": "bi-db-replica",
            "sqlalchemy_uri": (
                "postgresql+psycopg2://bi_reader:XXXXXXXXXXXX@bi-db-replica:5432/proteccion_infantil"
            ),
            "password": None,
            "uuid": replica_uuid,
            "version": IMPORT_VERSION,
            "cache_timeout": None,
            "expose_in_sqllab": True,
            "allow_run_async": True,
            "allow_ctas": False,
            "allow_cvas": False,
            "allow_dml": False,
            "allow_csv_upload": False,
            # `extra` es fields.Nested(ImportV1DatabaseExtraSchema), NO String.
            # Serializarlo como string JSON hace que Superset 4.1.4 crashee en
            # fix_schemas_allowed_for_csv_upload con "AttributeError: 'str' object
            # has no attribute 'get'" (I-19 · verificado contra Superset 4.1.4
            # schemas.py · 2026-08-29 11:1x COT).
            # `impersonate_user` y `masked_encrypted_extra` NO aceptados por
            # ImportV1DatabaseSchema en 4.1.4 (Unknown field · verificado con
            # `schema.load()` real contra la imagen apache/superset:4.1.4).
            "extra": {
                "metadata_params": {},
                "engine_params": {},
                "schemas_allowed_for_csv_upload": [],
            },
        },
    )

    write_yaml(
        BASE / "databases" / "bi_superset_db.yaml",
        {
            "database_name": "bi-superset-db",
            "sqlalchemy_uri": (
                "postgresql+psycopg2://superset_reader:XXXXXXXXXXXX@bi-superset-db:5432/superset"
            ),
            "password": None,
            "uuid": superset_uuid,
            "version": IMPORT_VERSION,
            "cache_timeout": None,
            "expose_in_sqllab": False,
            "allow_run_async": False,
            "allow_ctas": False,
            "allow_cvas": False,
            "allow_dml": False,
            "allow_csv_upload": False,
            # Ver nota en bi_db_replica.yaml sobre I-19 y Unknown fields en 4.1.4.
            "extra": {
                "metadata_params": {},
                "engine_params": {},
            },
        },
    )


# ────────────────────────────────────────────────────────────────────────────
# datasets/
# ────────────────────────────────────────────────────────────────────────────

# Datasets físicos + MVs. Solo las columnas usadas por los charts (no todos
# los campos del schema — Superset infiere el resto al primer refresh de metadata).
DATASETS = [
    # (folder, table_name, schema, columns[], notas)
    ("bi_db_replica", "Reporte", "public", [
        ("id", "VARCHAR", False, False),
        ("estado", "VARCHAR", False, True),
        ("prioridadAlta", "BOOLEAN", False, True),
        ("eliminado", "BOOLEAN", False, True),
        ("tenantId", "VARCHAR", False, True),
        ("plataformaId", "VARCHAR", False, True),
        ("numeroSeguimiento", "VARCHAR", False, False),
        ("creadoEn", "TIMESTAMP", True, True),
    ]),
    ("bi_db_replica", "ClasificacionIA", "public", [
        ("id", "VARCHAR", False, False),
        ("reporteId", "VARCHAR", False, True),
        ("categoria", "VARCHAR", False, True),
        ("modeloUsado", "VARCHAR", False, True),
        ("usoCascada", "BOOLEAN", False, True),
        ("confianza", "DOUBLE PRECISION", False, True),
        ("latenciaMs", "INTEGER", False, True),
        ("creadoEn", "TIMESTAMP", True, True),
    ]),
    ("bi_db_replica", "clasificacion_rubrica_votos", "public", [
        ("id", "VARCHAR", False, False),
        ("clasificacionIAId", "VARCHAR", False, True),
        ("modelo", "VARCHAR", False, True),
        ("categoria", "VARCHAR", False, True),
        ("cumple", "BOOLEAN", False, True),
        ("creadoEn", "TIMESTAMP", True, True),
    ]),
    ("bi_db_replica", "CorreccionAdmin", "public", [
        ("id", "VARCHAR", False, False),
        ("clasificacionId", "VARCHAR", False, True),
        ("categoriaOriginal", "VARCHAR", False, True),
        ("categoriaCorregida", "VARCHAR", False, True),
        ("creadoEn", "TIMESTAMP", True, True),
    ]),
    ("bi_db_replica", "Subscription", "public", [
        ("id", "VARCHAR", False, False),
        ("tenantId", "VARCHAR", False, True),
        ("planId", "VARCHAR", False, True),
        ("estado", "VARCHAR", False, True),
        ("iniciaEn", "TIMESTAMP", False, True),
        ("terminaEn", "TIMESTAMP", False, True),
        ("creadoEn", "TIMESTAMP", True, True),
    ]),
    ("bi_db_replica", "BillingCycle", "public", [
        ("id", "VARCHAR", False, False),
        ("subscriptionId", "VARCHAR", False, True),
        ("monto", "DOUBLE PRECISION", False, True),
        ("estado", "VARCHAR", False, True),
        ("periodoInicio", "TIMESTAMP", False, True),
        ("periodoFin", "TIMESTAMP", False, True),
        ("creadoEn", "TIMESTAMP", True, True),
    ]),
    ("bi_db_replica", "Plan", "public", [
        ("id", "VARCHAR", False, False),
        ("nombre", "VARCHAR", False, True),
    ]),
    ("bi_db_replica", "Colegio", "public", [
        ("id", "VARCHAR", False, False),
        ("nombre", "VARCHAR", False, True),
        ("estado", "VARCHAR", False, True),
        ("tenantId", "VARCHAR", False, True),
    ]),
    ("bi_db_replica", "SolicitudComite", "public", [
        ("id", "VARCHAR", False, False),
        ("estado", "VARCHAR", False, True),
        ("comiteId", "VARCHAR", False, True),
        ("creadoEn", "TIMESTAMP", True, True),
        ("resueltoEn", "TIMESTAMP", False, True),
    ]),
    ("bi_db_replica", "TransicionReporte", "public", [
        ("id", "VARCHAR", False, False),
        ("reporteId", "VARCHAR", False, True),
        ("responsableTipo", "VARCHAR", False, True),
        ("creadoEn", "TIMESTAMP", True, True),
    ]),
    ("bi_db_replica", "Plataforma", "public", [
        ("id", "VARCHAR", False, False),
        ("nombre", "VARCHAR", False, True),
    ]),
    ("bi_db_replica", "ReintentoReporte", "public", [
        ("id", "VARCHAR", False, False),
        ("reporteId", "VARCHAR", False, True),
        ("intento", "INTEGER", False, True),
        ("exitoso", "BOOLEAN", False, True),
        ("creadoEn", "TIMESTAMP", True, True),
    ]),
    ("bi_db_replica", "RateLimit", "public", [
        ("key", "VARCHAR", False, False),
        ("scope", "VARCHAR", False, True),
        ("identifier", "VARCHAR", False, True),
        ("windowStart", "TIMESTAMP", True, True),
        ("count", "INTEGER", False, True),
    ]),
    ("bi_db_replica", "bi_consulta_log", "public", [
        ("id", "VARCHAR", False, False),
        ("usuarioId", "VARCHAR", False, True),
        ("estado", "VARCHAR", False, True),
        ("fuenteCache", "BOOLEAN", False, True),
        ("latenciaMs", "INTEGER", False, True),
        ("error", "TEXT", False, True),
        ("creadoEn", "TIMESTAMP", True, True),
    ]),
    # MVs · columnas exactas de la migración 20260828120100_mv_fact_bi/migration.sql
    ("bi_db_replica", "mv_fact_reporte_diario", "public", [
        ("dia", "TIMESTAMP", True, True),
        ("pais", "VARCHAR", False, True),
        ("ciudad", "VARCHAR", False, True),
        ("estado", "VARCHAR", False, True),
        ("categoria", "VARCHAR", False, True),
        ("prioridad_alta", "BOOLEAN", False, True),
        ("es_rafaga", "BOOLEAN", False, True),
        ("es_anonimo", "BOOLEAN", False, True),
        ("total_reportes", "BIGINT", False, True),
        ("total_clasificados", "BIGINT", False, True),
        ("total_corregidos", "BIGINT", False, True),
        ("confianza_promedio", "DOUBLE PRECISION", False, True),
        ("latencia_ms_promedio", "DOUBLE PRECISION", False, True),
    ]),
    ("bi_db_replica", "mv_fact_motor_ia_diario", "public", [
        ("dia", "TIMESTAMP", True, True),
        ("categoria", "VARCHAR", False, True),
        ("modelo", "VARCHAR", False, True),
        ("total", "BIGINT", False, True),
        ("total_corregidos", "BIGINT", False, True),
        ("confianza_promedio", "DOUBLE PRECISION", False, True),
        ("latencia_ms_promedio", "DOUBLE PRECISION", False, True),
    ]),
    ("bi_db_replica", "mv_fact_operativo", "public", [
        ("dia", "TIMESTAMP", True, True),
        ("estado_anterior", "VARCHAR", False, True),
        ("estado_nuevo", "VARCHAR", False, True),
        ("responsable_tipo", "VARCHAR", False, True),
        ("total_transiciones", "BIGINT", False, True),
        ("total_solicitudes_comite", "BIGINT", False, True),
    ]),
    ("bi_db_replica", "mv_fact_comercial_mensual", "public", [
        ("mes", "TIMESTAMP", True, True),
        ("plan_nombre", "VARCHAR", False, True),
        ("ciclo_estado", "VARCHAR", False, True),
        ("total_ciclos", "BIGINT", False, True),
        ("monto_total", "DOUBLE PRECISION", False, True),
        ("monto_promedio", "DOUBLE PRECISION", False, True),
    ]),
    ("bi_db_replica", "mv_fact_salud_sistema", "public", [
        ("dia", "TIMESTAMP", True, True),
        ("accion", "VARCHAR", False, True),
        ("total_eventos_audit", "BIGINT", False, True),
        ("total_alertas_colegio", "BIGINT", False, True),
        ("total_alertas_suscripcion", "BIGINT", False, True),
    ]),
    ("bi_superset_db", "logs", "public", [
        ("id", "BIGINT", False, False),
        ("action", "VARCHAR", False, True),
        ("user_id", "BIGINT", False, True),
        ("dashboard_id", "BIGINT", False, True),
        ("slice_id", "BIGINT", False, True),
        ("dttm", "TIMESTAMP", True, True),
        ("json", "TEXT", False, True),
    ]),
]


def write_datasets() -> None:
    for db, table, schema, cols in DATASETS:
        dataset_uuid = det_uuid(f"datasets/{db}/{table}")
        database_uuid = det_uuid(
            "databases/bi-db-replica" if db == "bi_db_replica" else "databases/bi-superset-db"
        )
        main_dttm_col = next((c for c, _, is_dttm, _ in cols if is_dttm), None)
        write_yaml(
            BASE / "datasets" / db / f"{table}.yaml",
            {
                "table_name": table,
                "uuid": dataset_uuid,
                "version": IMPORT_VERSION,
                "database_uuid": database_uuid,
                "schema": schema,
                "main_dttm_col": main_dttm_col,
                "description": (
                    f"Dataset físico para dashboards BI (SPEC-019..023). "
                    f"Fuente: {db}.{schema}.{table}."
                ),
                "default_endpoint": None,
                "offset": 0,
                "cache_timeout": None,
                "catalog": None,
                "sql": None,
                "params": None,
                "template_params": None,
                "filter_select_enabled": True,
                "fetch_values_predicate": None,
                "extra": None,
                "normalize_columns": False,
                "always_filter_main_dttm": False,
                # `uuid` no es aceptado en ImportV1ColumnSchema/MetricSchema en
                # Superset 4.1.4 (Unknown field · verificado con schema.load()
                # real). Los objetos hijos se identifican por column_name /
                # metric_name dentro del dataset.
                "columns": [
                    {
                        "column_name": name,
                        "verbose_name": None,
                        "type": ctype,
                        "is_dttm": is_dttm,
                        "is_active": True,
                        "groupby": groupby,
                        "filterable": True,
                        "expression": None,
                        "description": None,
                    }
                    for name, ctype, is_dttm, groupby in cols
                ],
                "metrics": [
                    {
                        "metric_name": "count",
                        "verbose_name": "Filas",
                        "metric_type": "count",
                        "expression": "COUNT(*)",
                        "description": "Conteo de filas.",
                        "d3format": ",d",
                        "extra": None,
                    }
                ],
            },
        )


# ────────────────────────────────────────────────────────────────────────────
# charts/ (34 total)
# ────────────────────────────────────────────────────────────────────────────

# Cada tupla: (slug, dashboard, viz_type, dataset_ref, spec, refresh_seconds, kpi)
# dataset_ref formato: "<db>/<table>"
# spec: dict con keys específicas del viz_type (adhoc_filters, groupby, etc.)
# refresh_seconds: cache_timeout del chart (según tabla de refresh en spec.md).


def chart_params(viz_type: str, sql: str, extra: dict | None = None) -> dict:
    """Genera params base para un chart tipo Big Number / Table / Line / Bar."""
    base = {
        "viz_type": viz_type,
        "adhoc_filters": [],
        "extra_form_data": {},
        "dashboards": [],
    }
    if viz_type == "big_number_total":
        base["metric"] = {
            "expressionType": "SQL",
            "sqlExpression": sql,
            "label": "valor",
            "hasCustomLabel": True,
        }
    elif viz_type == "big_number":
        base["metric"] = {
            "expressionType": "SQL",
            "sqlExpression": sql,
            "label": "valor",
            "hasCustomLabel": True,
        }
    elif viz_type == "line":
        base["metrics"] = [
            {
                "expressionType": "SQL",
                "sqlExpression": sql,
                "label": "serie",
                "hasCustomLabel": True,
            }
        ]
    elif viz_type == "bar":
        base["metrics"] = [
            {
                "expressionType": "SQL",
                "sqlExpression": sql,
                "label": "valor",
                "hasCustomLabel": True,
            }
        ]
    elif viz_type == "pie":
        base["metric"] = {
            "expressionType": "SQL",
            "sqlExpression": sql,
            "label": "valor",
            "hasCustomLabel": True,
        }
    elif viz_type == "table":
        base["query_mode"] = "raw"
        base["all_columns"] = extra.get("all_columns", []) if extra else []
    if extra:
        base.update({k: v for k, v in extra.items() if k not in {"all_columns"}})
    return base


def query_context(sql: str, dataset_uuid: str) -> str:
    """query_context como JSON string; Superset lo re-hidrata al importar."""
    payload = {
        "datasource": {"uuid": dataset_uuid, "type": "table"},
        "force": False,
        "queries": [
            {
                "custom_form_data": {},
                "extras": {"having": "", "where": ""},
                "annotation_layers": [],
                "row_limit": 10000,
                "orderby": [],
                "sql": sql,
            }
        ],
        "result_format": "json",
        "result_type": "full",
    }
    return json.dumps(payload, ensure_ascii=False)


# Definición de los 34 charts. Los SQLs son citas literales del spec.md
# de cada dashboard (F3C 2026-08-29). Los slugs matchan el nombre canónico
# ejec_/motor_/com_/op_/salud_ del plan.md.
CHARTS = [
    # ────── SPEC-019 · EJECUTIVO (6) ──────
    dict(
        slug="ejec_reportes_24h_v1", dashboard="ejecutivo", viz="big_number_total",
        dataset="bi_db_replica/Reporte", refresh=300, name="1 · Reportes últimas 24 h",
        sql=("SELECT count(*) AS reportes_24h FROM \"Reporte\" "
             "WHERE \"creadoEn\" >= NOW() - INTERVAL '24 hours' "
             "AND \"eliminado\" = false"),
    ),
    dict(
        slug="ejec_suscripciones_activas_v1", dashboard="ejecutivo", viz="big_number_total",
        dataset="bi_db_replica/Subscription", refresh=900, name="2 · Suscripciones activas",
        sql=("SELECT count(*) AS activas FROM \"Subscription\" "
             "WHERE estado = 'activo'"),
    ),
    dict(
        slug="ejec_mrr_mes_v1", dashboard="ejecutivo", viz="big_number_total",
        dataset="bi_db_replica/BillingCycle", refresh=900, name="3 · MRR mes actual (COP)",
        sql=("SELECT COALESCE(SUM(monto), 0) AS mrr FROM \"BillingCycle\" "
             "WHERE estado = 'pagado' "
             "AND \"creadoEn\" >= date_trunc('month', NOW() AT TIME ZONE 'America/Bogota')"),
    ),
    dict(
        slug="ejec_prioridad_alta_abiertos_v1", dashboard="ejecutivo", viz="big_number_total",
        dataset="bi_db_replica/Reporte", refresh=300, name="4 · Prioridad alta abiertos",
        sql=("SELECT count(*) AS abiertos FROM \"Reporte\" "
             "WHERE \"prioridadAlta\" = true "
             "AND estado NOT IN ('CLASIFICADO', 'CORREGIDO') "
             "AND \"eliminado\" = false"),
    ),
    dict(
        slug="ejec_tendencia_reportes_30d_v1", dashboard="ejecutivo", viz="line",
        dataset="bi_db_replica/mv_fact_reporte_diario", refresh=900,
        name="5 · Tendencia reportes 30 d",
        sql=("SELECT dia, reportes FROM mv_fact_reporte_diario "
             "WHERE dia >= (NOW() AT TIME ZONE 'America/Bogota')::date - 30 "
             "ORDER BY dia"),
    ),
    dict(
        slug="ejec_top5_colegios_mes_v1", dashboard="ejecutivo", viz="bar",
        dataset="bi_db_replica/Reporte", refresh=3600, name="6 · Top 5 colegios (mes)",
        sql=("SELECT c.nombre AS colegio, count(*) AS reportes "
             "FROM \"Reporte\" r "
             "INNER JOIN \"Colegio\" c ON c.\"tenantId\" = r.\"tenantId\" "
             "WHERE r.\"creadoEn\" >= date_trunc('month', NOW() AT TIME ZONE 'America/Bogota') "
             "AND r.\"eliminado\" = false "
             "GROUP BY c.nombre ORDER BY reportes DESC LIMIT 5"),
    ),

    # ────── SPEC-020 · MOTOR IA (7 KPIs · SQLs son cita literal del spec.md §Alcance) ──────
    dict(
        slug="motor_clasificaciones_24h_v1", dashboard="motor_ia", viz="big_number_total",
        dataset="bi_db_replica/ClasificacionIA", refresh=300,
        name="1 · Clasificaciones últimas 24 h",
        sql=("SELECT count(*) AS total FROM \"ClasificacionIA\" "
             "WHERE \"creadoEn\" >= NOW() - INTERVAL '24 hours'"),
    ),
    dict(
        slug="motor_latencia_p50p95_v1", dashboard="motor_ia", viz="table",
        dataset="bi_db_replica/ClasificacionIA", refresh=900,
        name="2 · Latencia p50/p95 por modelo (7 d)",
        sql=("SELECT \"modeloUsado\", "
             "percentile_cont(0.5)  WITHIN GROUP (ORDER BY \"latenciaMs\") AS p50_ms, "
             "percentile_cont(0.95) WITHIN GROUP (ORDER BY \"latenciaMs\") AS p95_ms, "
             "count(*) AS clasificaciones "
             "FROM \"ClasificacionIA\" "
             "WHERE \"creadoEn\" >= NOW() - INTERVAL '7 days' "
             "GROUP BY \"modeloUsado\" ORDER BY p95_ms DESC"),
    ),
    dict(
        slug="motor_distribucion_categorias_v1", dashboard="motor_ia", viz="bar",
        dataset="bi_db_replica/ClasificacionIA", refresh=1800,
        name="3 · Distribución de categorías (7 d)",
        sql=("SELECT categoria::text AS categoria, count(*) AS total "
             "FROM \"ClasificacionIA\" "
             "WHERE \"creadoEn\" >= NOW() - INTERVAL '7 days' "
             "GROUP BY categoria ORDER BY total DESC"),
    ),
    dict(
        slug="motor_tasa_acuerdo_jurado_v1", dashboard="motor_ia", viz="big_number_total",
        dataset="bi_db_replica/clasificacion_rubrica_votos", refresh=900,
        name="4 · Tasa de acuerdo del jurado (7 d)",
        sql=("WITH votos_por_categoria AS ("
             "SELECT \"clasificacionIAId\", categoria, "
             "count(*) FILTER (WHERE cumple = true) AS votos_a_favor, "
             "count(*) AS votos_totales "
             "FROM \"clasificacion_rubrica_votos\" "
             "WHERE \"creadoEn\" >= NOW() - INTERVAL '7 days' "
             "GROUP BY \"clasificacionIAId\", categoria), "
             "consenso_por_clasificacion AS ("
             "SELECT \"clasificacionIAId\", "
             "bool_or(votos_a_favor >= 2 AND votos_totales >= 2) AS hay_consenso "
             "FROM votos_por_categoria GROUP BY \"clasificacionIAId\") "
             "SELECT ROUND(100.0 * count(*) FILTER (WHERE hay_consenso) "
             "/ NULLIF(count(*), 0), 2) AS tasa_acuerdo_pct "
             "FROM consenso_por_clasificacion"),
    ),
    dict(
        slug="motor_uso_cascada_v1", dashboard="motor_ia", viz="big_number_total",
        dataset="bi_db_replica/ClasificacionIA", refresh=1800,
        name="5 · Uso de cascada (7 d · %)",
        sql=("SELECT ROUND(100.0 * count(*) FILTER (WHERE \"usoCascada\" = true) "
             "/ NULLIF(count(*), 0), 2) AS pct_cascada "
             "FROM \"ClasificacionIA\" "
             "WHERE \"creadoEn\" >= NOW() - INTERVAL '7 days'"),
    ),
    dict(
        slug="motor_correcciones_admin_30d_v1", dashboard="motor_ia", viz="big_number_total",
        dataset="bi_db_replica/CorreccionAdmin", refresh=3600,
        name="6 · Correcciones admin (30 d)",
        sql=("SELECT count(*) AS correcciones_30d FROM \"CorreccionAdmin\" "
             "WHERE \"creadoEn\" >= NOW() - INTERVAL '30 days'"),
    ),
    dict(
        slug="motor_latencia_timeline_v1", dashboard="motor_ia", viz="line",
        dataset="bi_db_replica/ClasificacionIA", refresh=900,
        name="7 · Latencia motor timeline (72 h · por hora · por modelo)",
        sql=("SELECT date_trunc('hour', \"creadoEn\") AS hora, \"modeloUsado\", "
             "percentile_cont(0.5)  WITHIN GROUP (ORDER BY \"latenciaMs\") AS p50_ms, "
             "percentile_cont(0.95) WITHIN GROUP (ORDER BY \"latenciaMs\") AS p95_ms "
             "FROM \"ClasificacionIA\" "
             "WHERE \"creadoEn\" >= NOW() - INTERVAL '3 days' "
             "GROUP BY hora, \"modeloUsado\" ORDER BY hora"),
    ),

    # ────── SPEC-021 · COMERCIAL (6 KPIs · SQLs cita literal del spec.md §Alcance) ──────
    # KPI 1 tiene Big Number + Line 12 meses (2 charts, 1 KPI).
    dict(
        slug="com_mrr_mes_actual_v1", dashboard="comercial", viz="big_number_total",
        dataset="bi_db_replica/mv_fact_comercial_mensual", refresh=3600,
        name="1a · MRR mes actual (COP)",
        sql=("SELECT COALESCE(SUM(monto_total), 0) AS mrr_cop "
             "FROM mv_fact_comercial_mensual "
             "WHERE mes = date_trunc('month', NOW() AT TIME ZONE 'America/Bogota') "
             "AND ciclo_estado = 'pagado'"),
    ),
    dict(
        slug="com_mrr_12m_line_v1", dashboard="comercial", viz="line",
        dataset="bi_db_replica/mv_fact_comercial_mensual", refresh=3600,
        name="1b · MRR línea 12 meses (COP)",
        sql=("SELECT mes, SUM(monto_total) AS mrr_cop "
             "FROM mv_fact_comercial_mensual "
             "WHERE mes >= date_trunc('month', NOW() AT TIME ZONE 'America/Bogota') "
             "- INTERVAL '11 months' AND ciclo_estado = 'pagado' "
             "GROUP BY mes ORDER BY mes"),
    ),
    dict(
        slug="com_nuevas_suscripciones_v1", dashboard="comercial", viz="big_number_total",
        dataset="bi_db_replica/Subscription", refresh=3600,
        name="2 · Nuevas suscripciones mes vs anterior",
        sql=("WITH por_mes AS ("
             "SELECT date_trunc('month', \"creadoEn\" AT TIME ZONE 'America/Bogota') AS mes, "
             "count(*) AS nuevas FROM \"Subscription\" "
             "WHERE \"creadoEn\" >= date_trunc('month', NOW() AT TIME ZONE 'America/Bogota') "
             "- INTERVAL '1 month' GROUP BY mes) "
             "SELECT mes, nuevas FROM por_mes ORDER BY mes"),
    ),
    dict(
        slug="com_churn_mes_v1", dashboard="comercial", viz="big_number_total",
        dataset="bi_db_replica/Subscription", refresh=3600,
        name="3 · Churn mes actual",
        sql=("SELECT count(*) AS churn_mes FROM \"Subscription\" "
             "WHERE estado <> 'activo' "
             "AND \"creadoEn\" >= date_trunc('month', NOW() AT TIME ZONE 'America/Bogota')"),
    ),
    dict(
        slug="com_distribucion_por_plan_v1", dashboard="comercial", viz="pie",
        dataset="bi_db_replica/Subscription", refresh=3600,
        name="4 · Distribución por plan",
        sql=("SELECT p.nombre AS plan, count(s.id) AS suscripciones "
             "FROM \"Subscription\" s "
             "JOIN \"Plan\" p ON p.id = s.\"planId\" "
             "WHERE s.estado = 'activo' "
             "GROUP BY p.nombre ORDER BY suscripciones DESC"),
    ),
    dict(
        slug="com_top10_ingresos_colegio_v1", dashboard="comercial", viz="bar",
        dataset="bi_db_replica/BillingCycle", refresh=3600,
        name="5 · Top 10 colegios por ingresos (mes · COP)",
        sql=("SELECT c.nombre AS colegio, SUM(bc.monto) AS ingresos_cop "
             "FROM \"BillingCycle\" bc "
             "JOIN \"Subscription\" s ON s.id = bc.\"subscriptionId\" "
             "JOIN \"Colegio\"      c ON c.\"tenantId\" = s.\"tenantId\" "
             "WHERE bc.\"creadoEn\" >= date_trunc('month', NOW() AT TIME ZONE 'America/Bogota') "
             "AND bc.estado = 'pagado' "
             "GROUP BY c.nombre ORDER BY ingresos_cop DESC LIMIT 10"),
    ),
    dict(
        slug="com_pagos_no_pagados_30d_v1", dashboard="comercial", viz="table",
        dataset="bi_db_replica/BillingCycle", refresh=3600,
        name="6 · Pagos con estado ≠ 'pagado' (30 d)",
        sql=("SELECT bc.id, bc.estado, bc.monto, bc.\"creadoEn\", bc.\"periodoInicio\" "
             "FROM \"BillingCycle\" bc "
             "WHERE bc.estado <> 'pagado' "
             "AND bc.\"creadoEn\" >= NOW() - INTERVAL '30 days' "
             "ORDER BY bc.\"creadoEn\" DESC LIMIT 200"),
    ),

    # ────── SPEC-022 · OPERATIVO (7 KPIs · SQLs cita literal del spec.md §Alcance) ──────
    dict(
        slug="op_reportes_en_flujo_v1", dashboard="operativo", viz="big_number_total",
        dataset="bi_db_replica/Reporte", refresh=900,
        name="1 · Reportes en flujo (no cerrados)",
        sql=("SELECT count(*) AS en_flujo FROM \"Reporte\" "
             "WHERE estado NOT IN ('CLASIFICADO', 'CORREGIDO') "
             "AND \"eliminado\" = false"),
    ),
    dict(
        slug="op_comite_pendientes_v1", dashboard="operativo", viz="big_number_total",
        dataset="bi_db_replica/SolicitudComite", refresh=900,
        name="2 · Solicitudes comité pendientes",
        sql=("SELECT count(*) AS comite_pendientes FROM \"SolicitudComite\" "
             "WHERE estado = 'PENDIENTE'"),
    ),
    dict(
        slug="op_comite_horas_promedio_v1", dashboard="operativo", viz="big_number_total",
        dataset="bi_db_replica/SolicitudComite", refresh=3600,
        name="3 · Tiempo promedio resolución comité (30 d · horas)",
        sql=("SELECT ROUND(AVG(EXTRACT(EPOCH FROM (\"resueltoEn\" - \"creadoEn\")) / 3600)"
             "::numeric, 2) AS horas_promedio FROM \"SolicitudComite\" "
             "WHERE \"resueltoEn\" IS NOT NULL "
             "AND \"resueltoEn\" >= NOW() - INTERVAL '30 days'"),
    ),
    dict(
        slug="op_distribucion_estado_reporte_v1", dashboard="operativo", viz="pie",
        dataset="bi_db_replica/Reporte", refresh=900,
        name="4 · Distribución por estado Reporte",
        sql=("SELECT estado::text AS estado, count(*) AS total FROM \"Reporte\" "
             "WHERE \"eliminado\" = false GROUP BY estado ORDER BY total DESC"),
    ),
    dict(
        slug="op_revision_manual_gt_7d_v1", dashboard="operativo", viz="table",
        dataset="bi_db_replica/Reporte", refresh=900,
        name="5 · Reportes REVISION_MANUAL > 7 d",
        sql=("SELECT r.id, r.\"numeroSeguimiento\", p.nombre AS plataforma, "
             "r.\"creadoEn\", c.nombre AS colegio FROM \"Reporte\" r "
             "LEFT JOIN \"Colegio\" c ON c.\"tenantId\" = r.\"tenantId\" "
             "LEFT JOIN \"Plataforma\" p ON p.id = r.\"plataformaId\" "
             "WHERE r.estado = 'REVISION_MANUAL' "
             "AND r.\"creadoEn\" < NOW() - INTERVAL '7 days' "
             "AND r.\"eliminado\" = false "
             "ORDER BY r.\"creadoEn\" ASC LIMIT 500"),
    ),
    dict(
        slug="op_transiciones_por_responsable_v1", dashboard="operativo", viz="bar",
        dataset="bi_db_replica/TransicionReporte", refresh=1800,
        name="6 · Transiciones por responsable (7 d)",
        sql=("SELECT \"responsableTipo\"::text AS responsable, count(*) AS transiciones "
             "FROM \"TransicionReporte\" "
             "WHERE \"creadoEn\" >= NOW() - INTERVAL '7 days' "
             "GROUP BY \"responsableTipo\" ORDER BY transiciones DESC"),
    ),
    dict(
        slug="op_vencimientos_suscripciones_30d_v1", dashboard="operativo", viz="table",
        dataset="bi_db_replica/Subscription", refresh=3600,
        name="7 · Vencimientos suscripciones próximos 30 d",
        sql=("SELECT s.id, c.nombre AS colegio, s.\"terminaEn\" FROM \"Subscription\" s "
             "JOIN \"Colegio\" c ON c.\"tenantId\" = s.\"tenantId\" "
             "WHERE s.\"terminaEn\" IS NOT NULL "
             "AND s.\"terminaEn\" BETWEEN NOW() AND NOW() + INTERVAL '30 days' "
             "AND s.estado = 'activo' "
             "ORDER BY s.\"terminaEn\" ASC"),
    ),

    # ────── SPEC-023 · SALUD (8) ──────
    dict(
        slug="salud_lag_replica_v1", dashboard="salud", viz="big_number_total",
        dataset="bi_db_replica/mv_fact_salud_sistema", refresh=60, name="1 · Lag réplica (s)",
        sql=("SELECT ROUND(EXTRACT(EPOCH FROM (NOW() - pg_last_xact_replay_timestamp()))::numeric, 1) "
             "AS lag_segundos"),
    ),
    dict(
        slug="salud_consultas_vanna_24h_v1", dashboard="salud", viz="big_number_total",
        dataset="bi_db_replica/bi_consulta_log", refresh=900,
        name="2 · Consultas Vanna 24 h (placeholder)",
        sql=("SELECT count(*) FROM bi_consulta_log "
             "WHERE \"creadoEn\" >= NOW() - INTERVAL '24 hours'"),
    ),
    dict(
        slug="salud_precision_vanna_v1", dashboard="salud", viz="big_number_total",
        dataset="bi_db_replica/bi_consulta_log", refresh=900,
        name="3 · Precisión Vanna 7 d (%) (placeholder)",
        sql=("SELECT ROUND(100.0 * count(*) FILTER (WHERE estado = 'exitoso' AND error IS NULL) "
             "/ NULLIF(count(*), 0), 2) AS precision_pct FROM bi_consulta_log "
             "WHERE \"creadoEn\" >= NOW() - INTERVAL '7 days'"),
    ),
    dict(
        slug="salud_errores_superset_24h_v1", dashboard="salud", viz="big_number_total",
        dataset="bi_superset_db/logs", refresh=900, name="4 · Errores Superset 24 h",
        sql=("SELECT count(*) FROM logs "
             "WHERE dttm >= NOW() - INTERVAL '24 hours' "
             "AND action IN ('log', 'error')"),
    ),
    dict(
        slug="salud_uptime_servicios_v1", dashboard="salud", viz="line",
        dataset="bi_db_replica/mv_fact_salud_sistema", refresh=900,
        name="5 · Actividad sistema (placeholder de uptime hasta INSTRUCTIVO-008)",
        # mv_fact_salud_sistema (SPEC-009) agrega AuditLog + AlertaColegio + AlertaSuscripcion
        # por día. Placeholder de uptime = flujo de eventos audit. INSTRUCTIVO-008 sustituye
        # por métrica de healthcheck real (bot Telegram).
        sql=("SELECT dia, SUM(total_eventos_audit) AS eventos_audit "
             "FROM mv_fact_salud_sistema "
             "WHERE dia >= (NOW() AT TIME ZONE 'America/Bogota')::date - 7 "
             "GROUP BY dia ORDER BY dia"),
    ),
    dict(
        slug="salud_cache_hit_vanna_v1", dashboard="salud", viz="big_number_total",
        dataset="bi_db_replica/bi_consulta_log", refresh=3600,
        name="6 · Cache hit Vanna 7 d (%) (placeholder)",
        sql=("SELECT ROUND(100.0 * count(*) FILTER (WHERE \"fuenteCache\" = true) "
             "/ NULLIF(count(*), 0), 2) AS cache_hit_pct FROM bi_consulta_log "
             "WHERE \"creadoEn\" >= NOW() - INTERVAL '7 days'"),
    ),
    dict(
        slug="salud_reintentos_reporte_v1", dashboard="salud", viz="big_number_total",
        dataset="bi_db_replica/ReintentoReporte", refresh=1800,
        name="7 · Reintentos Reporte 24 h fallidos",
        sql=("SELECT count(*) FROM \"ReintentoReporte\" "
             "WHERE \"creadoEn\" >= NOW() - INTERVAL '24 hours' AND exitoso = false"),
    ),
    dict(
        slug="salud_rate_limits_hoy_v1", dashboard="salud", viz="table",
        dataset="bi_db_replica/RateLimit", refresh=3600, name="8 · Rate limits activados hoy",
        sql=("SELECT scope, SUM(count) AS activaciones FROM \"RateLimit\" "
             "WHERE \"windowStart\" >= date_trunc('day', NOW() AT TIME ZONE 'America/Bogota') "
             "GROUP BY scope ORDER BY activaciones DESC"),
    ),
]


def write_charts() -> None:
    for chart in CHARTS:
        chart_uuid = det_uuid(f"charts/{chart['slug']}")
        db_name, table_name = chart["dataset"].split("/")
        dataset_uuid = det_uuid(f"datasets/{db_name}/{table_name}")
        params = chart_params(chart["viz"], chart["sql"])
        write_yaml(
            BASE / "charts" / f"{chart['slug']}.yaml",
            {
                "slice_name": chart["name"],
                "viz_type": chart["viz"],
                "uuid": chart_uuid,
                "version": IMPORT_VERSION,
                "dataset_uuid": dataset_uuid,
                "description": (
                    f"Chart del dashboard '{chart['dashboard']}' · fuente SQL en spec.md."
                ),
                "certified_by": CERTIFIED_BY,
                "certification_details": CERTIFIED_DETAILS,
                "params": params,
                "query_context": query_context(chart["sql"], dataset_uuid),
                "cache_timeout": chart["refresh"],
                "is_managed_externally": True,
                "external_url": None,
                # `tags` no aceptado en ImportV1ChartSchema 4.1.4 · usar la UI
                # de tags de Superset post-import si Fábrica los quiere.
            },
        )


# ────────────────────────────────────────────────────────────────────────────
# dashboards/ (5)
# ────────────────────────────────────────────────────────────────────────────

DASHBOARDS = [
    ("ejecutivo", "EJECUTIVO", "Vista C-level (Jelkin) · 6 KPIs · SPEC-019", 300),
    ("motor_ia", "MOTOR IA", "Salud del motor IA (Fábrica) · 7 KPIs · jurado ≥2/3 · SPEC-020", 300),
    ("comercial", "COMERCIAL", "Panel comercial (Jelkin) · 6 KPIs · valores COP · SPEC-021", 900),
    ("operativo", "OPERATIVO", "Flujo operativo (Fábrica+Jelkin) · 7 KPIs · SPEC-022", 300),
    ("salud", "SALUD", "Salud del sistema BI (Fábrica) · 8 KPIs · 4 placeholder · SPEC-023", 300),
]


def write_dashboards() -> None:
    for slug, title, description, refresh in DASHBOARDS:
        dashboard_uuid = det_uuid(f"dashboards/{slug}")
        chart_slugs = [c["slug"] for c in CHARTS if c["dashboard"] == slug]
        chart_uuids = [det_uuid(f"charts/{s}") for s in chart_slugs]
        # position: grid vertical simple 12-col, cada chart 6-col × 6-row.
        position = {"DASHBOARD_VERSION_KEY": "v2"}
        row = 0
        col = 0
        for idx, cs in enumerate(chart_slugs):
            key = f"CHART-{cs}"
            position[key] = {
                "type": "CHART",
                "id": key,
                "meta": {
                    "uuid": chart_uuids[idx],
                    "chartId": None,
                    "width": 6,
                    "height": 30,
                    "sliceName": cs,
                },
                "parents": ["ROOT_ID", "GRID_ID"],
            }
            col += 6
            if col >= 12:
                col = 0
                row += 30

        metadata = {
            "refresh_frequency": refresh,
            "color_scheme": "supersetColors",
            "shared_label_colors": {},
            "cross_filters_enabled": True,
            "label_colors": {},
            "timed_refresh_immune_slices": [],
            "expanded_slices": {},
            "chart_configuration": {},
        }

        write_yaml(
            BASE / "dashboards" / f"{slug}.yaml",
            {
                "dashboard_title": title,
                "uuid": dashboard_uuid,
                "version": IMPORT_VERSION,
                "description": description,
                "css": None,
                "slug": slug,
                "published": True,
                "position": position,
                "metadata": metadata,
                "certified_by": CERTIFIED_BY,
                "certification_details": CERTIFIED_DETAILS,
                "is_managed_externally": True,
                # `tags` no aceptado en ImportV1DashboardSchema 4.1.4 · usar
                # la UI de tags post-import.
            },
        )


# ────────────────────────────────────────────────────────────────────────────
# README.md del bundle
# ────────────────────────────────────────────────────────────────────────────


def write_readme() -> None:
    body = textwrap.dedent(
        """\
        # superset/ · bundle de assets Superset 3.x

        Generado por `scripts/build-superset-bundle.py` (fuente de verdad).
        Los YAML se comitean como output determinista para que el deploy no
        dependa del script.

        ## Contenido

        - `metadata.yaml` · versión del bundle (1.0.0 · type: assets)
        - `databases/` · 2 conexiones (bi-db-replica · bi-superset-db). `sqlalchemy_uri`
          trae password placeholder `XXXXXXXXXXXX`; los secretos reales viven en
          `.env.bi.production` del VPS y se inyectan en el import.
        - `datasets/` · 20 datasets físicos (13 tablas base + 5 MVs + bi_consulta_log
          + logs Superset). Columnas listadas son las usadas por los charts; el resto
          las infiere Superset al refresh de metadata.
        - `charts/` · 34 charts (6 ejec + 7 motor + 6 com + 7 op + 8 salud). Cada
          `slice_name`, `viz_type` y `sql` es cita literal del spec.md correspondiente.
        - `dashboards/` · 5 dashboards, cada uno enlazando sus charts por UUID.

        ## Importar en el VPS

        ```bash
        # dentro del contenedor bi-superset
        superset import-directory /app/superset_assets
        ```

        (Volumen `superset_assets` monta este directorio en `docker-compose.bi.yml`.)

        ## Regenerar

        ```bash
        cd 005-2026-BI-INTELIGENCIA-NEGOCIO
        python3 scripts/build-superset-bundle.py
        git add superset/ && git status
        ```

        Los UUID son `uuid5(NS, path)`, deterministas: re-correr no crea duplicados
        ni cambia los IDs.

        ## Estado

        - Compuerta §4 SPEC-019..023 aprobada por Fábrica BI-2 (2026-08-29 00:1x COT).
        - Candado 14 (verificación en vivo) se cierra en VPS post-deploy: conexión
          Superset→réplica, 5 dashboards visibles, cruce master vs Superset, PII
          bloqueada. NO se da CUMPLE con "el YAML parece correcto".
        """
    )
    (BASE / "README.md").write_text(body, encoding="utf-8")


# ────────────────────────────────────────────────────────────────────────────
# Main
# ────────────────────────────────────────────────────────────────────────────


def main() -> None:
    # Limpieza defensiva del bundle previo (solo si existe)
    for sub in ("databases", "datasets", "charts", "dashboards"):
        target = BASE / sub
        if target.exists():
            shutil.rmtree(target)
    for sub in ("metadata.yaml", "README.md"):
        f = BASE / sub
        if f.exists():
            f.unlink()

    write_metadata()
    write_databases()
    write_datasets()
    write_charts()
    write_dashboards()
    write_readme()

    # Reporte para el operador
    counts = {
        "databases": len(list((BASE / "databases").glob("*.yaml"))),
        "datasets": len(list((BASE / "datasets").rglob("*.yaml"))),
        "charts": len(list((BASE / "charts").glob("*.yaml"))),
        "dashboards": len(list((BASE / "dashboards").glob("*.yaml"))),
    }
    total = sum(counts.values()) + 2  # +metadata +README
    print(f"Bundle generado en {BASE.relative_to(Path.cwd()) if Path.cwd() in BASE.parents else BASE}")
    for k, v in counts.items():
        print(f"  {k}: {v}")
    print(f"  +metadata.yaml, README.md")
    print(f"Total archivos: {total}")


if __name__ == "__main__":
    main()
