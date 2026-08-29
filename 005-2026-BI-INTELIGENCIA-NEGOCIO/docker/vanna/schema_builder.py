"""Construye prompt + schema JSON con enum cerrado + índices numéricos.
Candados 1 (enum cerrado), 3 (índices numéricos), 4 (slots deny-by-default)."""
from __future__ import annotations

from typing import Any

SYSTEM_ES = (
    "Eres un traductor NL→SQL estricto. Solo puedes usar las tablas y columnas "
    "listadas en el catálogo. Devuelves un objeto JSON con los slots "
    "{tabla_idx, columnas_idx, filtros, agregacion, agrupacion, limite, nota}. "
    "Cualquier tabla o columna fuera del catálogo es un error.\n"
    "Los slots métrica (agregacion), dimensión temporal (filtros con fecha), "
    "filtros y agrupación son CHECKS ATÓMICOS: si falta información "
    "para decidir uno, DÉJALO nulo y explica en `nota` qué falta. "
    "Nunca inventes columnas, tablas o filtros."
)


def _slot_schema(catalogo: dict[str, Any]) -> dict[str, Any]:
    """Construye el schema JSON con enum cerrado y additionalProperties:false."""
    tablas = catalogo.get("tablas", [])
    n = len(tablas)
    if n == 0:
        # No hay tablas · el schema fuerza rechazo
        tabla_idx_enum: dict[str, Any] = {"type": "null"}
    else:
        tabla_idx_enum = {"type": "integer", "minimum": 0, "maximum": n - 1}

    max_cols = max((len(t.get("columnas", [])) for t in tablas), default=0)
    if max_cols == 0:
        columnas_item = {"type": "null"}
    else:
        columnas_item = {"type": "integer", "minimum": 0, "maximum": max_cols - 1}

    filtro_schema = {
        "type": "object",
        "properties": {
            "columna_idx": {"type": "integer", "minimum": 0},
            "operador": {
                "type": "string",
                "enum": ["=", "!=", "<", ">", "<=", ">=", "LIKE", "IN"],
            },
            "valor": {},
        },
        "required": ["columna_idx", "operador"],
        "additionalProperties": False,
    }

    agregacion_schema = {
        "oneOf": [
            {"type": "null"},
            {
                "type": "object",
                "properties": {
                    "fn": {
                        "type": "string",
                        "enum": ["COUNT", "SUM", "AVG", "MIN", "MAX"],
                    },
                    "columna_idx": {"type": ["integer", "null"], "minimum": 0},
                },
                "required": ["fn"],
                "additionalProperties": False,
            },
        ]
    }

    return {
        "type": "object",
        "properties": {
            "tabla_idx": tabla_idx_enum,
            "columnas_idx": {"type": "array", "items": columnas_item},
            "filtros": {"oneOf": [{"type": "null"}, {"type": "array", "items": filtro_schema}]},
            "agregacion": agregacion_schema,
            "agrupacion": {
                "oneOf": [{"type": "null"}, {"type": "array", "items": columnas_item}]
            },
            "limite": {"type": "integer", "minimum": 1, "maximum": 1000},
            "nota": {"type": "string"},
        },
        "required": ["tabla_idx", "columnas_idx", "limite", "nota"],
        "additionalProperties": False,
    }


def construir_prompt_generacion(
    pregunta: str,
    catalogo: dict[str, Any],
    contexto: dict[str, Any] | None = None,
) -> tuple[str, dict[str, Any]]:
    """Devuelve (prompt, schema_respuesta_json).

    `catalogo`: {"tablas":[...], "metricas":[...opcional], "ejemplos":[...opcional]}
    """
    tablas = catalogo.get("tablas", [])
    lineas = []
    for i, t in enumerate(tablas):
        lineas.append(f"- Tabla {i}: {t.get('nombre_fuente', '?')}")
        for j, c in enumerate(t.get("columnas", [])):
            tipo = c.get("tipo", "?")
            lineas.append(f"    - Columna {j}: {c.get('nombre_fuente', '?')} ({tipo})")
    catalogo_txt = "\n".join(lineas) if lineas else "(sin tablas disponibles)"

    metricas = catalogo.get("metricas") or []
    metricas_txt = ""
    if metricas:
        m_lineas = ["\nMétricas pre-definidas del negocio (úsalas cuando la pregunta encaje):"]
        for m in metricas[:20]:
            m_lineas.append(
                f"- {m.get('nombre', '?')} ({m.get('categoria', 'general')}): "
                f"{m.get('nombre_legible', '')} · SQL: {m.get('formula_sql', '')[:120]}"
            )
        metricas_txt = "\n".join(m_lineas)

    ejemplos = catalogo.get("ejemplos") or []
    ejemplos_txt = ""
    if ejemplos:
        e_lineas = ["\nEjemplos NL→SQL humanos aprobados:"]
        for e in ejemplos[:6]:
            e_lineas.append(
                f"- Pregunta: \"{e.get('pregunta', '')[:120]}\"\n  SQL: {e.get('sql', '')[:200]}"
            )
        ejemplos_txt = "\n".join(e_lineas)

    ctx_txt = ""
    if contexto:
        pares = [f"{k}={v}" for k, v in contexto.items()]
        ctx_txt = "\nContexto: " + ", ".join(pares)

    prompt = (
        f"Catálogo:\n{catalogo_txt}"
        f"{metricas_txt}"
        f"{ejemplos_txt}\n\n"
        f"Pregunta del usuario: \"{pregunta}\"{ctx_txt}\n\n"
        "INSTRUCCIONES DECISIVAS:\n"
        "- Si la pregunta empieza por 'cuántos/cuántas/número de', usa agregacion={fn:'COUNT'} (con columna_idx=null para COUNT(*)).\n"
        "- Si la pregunta menciona 'hoy/semana/mes/año', agrega un filtro por columna temporal (creadoEn, fecha) con el operador y valor apropiado.\n"
        "- Si la pregunta empieza por 'top N', usa agregacion COUNT/SUM + agrupacion + limite=N.\n"
        "- Si una métrica pre-definida encaja exactamente, úsala referenciando su nombre en `nota` (por ejemplo: 'metrica:reportes_hoy').\n"
        "- Solo deja slots null cuando NO exista información en el catálogo para decidir. Nunca inventes columnas.\n"
        "- Devuelve SOLO el objeto JSON con los slots definidos."
    )
    return prompt, _slot_schema(catalogo)
