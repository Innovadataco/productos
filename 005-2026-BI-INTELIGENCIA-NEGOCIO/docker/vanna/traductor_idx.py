"""Traduce respuesta_llm {tabla_idx, columnas_idx, filtros, agregacion,
agrupacion, limite} a SQL usando nombres canónicos del catálogo.
Candado 3: idx fuera de rango eleva IdxFueraDeRango (voto inválido)."""
from __future__ import annotations

from typing import Any


class IdxFueraDeRango(ValueError):
    def __init__(self, campo: str, valor: int, maximo: int):
        super().__init__(f"idx_fuera_de_rango:{campo}={valor} max={maximo}")
        self.campo = campo
        self.valor = valor
        self.maximo = maximo


def _check_idx(campo: str, valor: int, maximo: int) -> None:
    if not isinstance(valor, int) or valor < 0 or valor > maximo:
        raise IdxFueraDeRango(campo, valor, maximo)


def construir_sql(respuesta: dict[str, Any], catalogo: dict[str, Any]) -> str:
    tablas = catalogo.get("tablas", [])
    if not tablas:
        raise IdxFueraDeRango("tabla_idx", -1, -1)

    tabla_idx = respuesta.get("tabla_idx")
    if tabla_idx is None:
        raise IdxFueraDeRango("tabla_idx", -1, len(tablas) - 1)
    _check_idx("tabla_idx", tabla_idx, len(tablas) - 1)

    tabla = tablas[tabla_idx]
    tabla_nombre = tabla["nombre_fuente"]
    cols = tabla.get("columnas", [])

    columnas_idx = respuesta.get("columnas_idx") or []
    if not isinstance(columnas_idx, list):
        raise IdxFueraDeRango("columnas_idx", -1, len(cols) - 1)

    columnas_nombres: list[str] = []
    for c_idx in columnas_idx:
        _check_idx("columna_idx", c_idx, len(cols) - 1)
        columnas_nombres.append(cols[c_idx]["nombre_fuente"])

    agregacion = respuesta.get("agregacion")
    if agregacion is not None and isinstance(agregacion, dict):
        fn = agregacion.get("fn", "COUNT")
        col_ag_idx = agregacion.get("columna_idx")
        if col_ag_idx is not None:
            _check_idx("agregacion_columna_idx", col_ag_idx, len(cols) - 1)
            ag_expr = f"{fn}({cols[col_ag_idx]['nombre_fuente']})"
        else:
            ag_expr = f"{fn}(*)"
        select_expr = ag_expr + " AS " + fn.lower() + "_total"
        select_extra = ", " + ", ".join(columnas_nombres) if columnas_nombres else ""
        select_clause = select_expr + select_extra
    else:
        if not columnas_nombres:
            raise IdxFueraDeRango("columnas_idx", -1, len(cols) - 1)
        select_clause = ", ".join(columnas_nombres)

    where_parts: list[str] = []
    for f in respuesta.get("filtros") or []:
        c_idx = f.get("columna_idx")
        _check_idx("filtro_columna_idx", c_idx, len(cols) - 1)
        col_nombre = cols[c_idx]["nombre_fuente"]
        op = f.get("operador", "=")
        valor = f.get("valor")
        if isinstance(valor, str):
            valor_sql = "'" + valor.replace("'", "''") + "'"
        elif valor is None:
            valor_sql = "NULL"
        elif isinstance(valor, (list, tuple)):
            partes = []
            for v in valor:
                partes.append(
                    "'" + str(v).replace("'", "''") + "'"
                    if isinstance(v, str)
                    else str(v)
                )
            valor_sql = "(" + ", ".join(partes) + ")"
        else:
            valor_sql = str(valor)
        where_parts.append(f"{col_nombre} {op} {valor_sql}")
    where_clause = " WHERE " + " AND ".join(where_parts) if where_parts else ""

    group_parts: list[str] = []
    for g_idx in respuesta.get("agrupacion") or []:
        _check_idx("agrupacion_columna_idx", g_idx, len(cols) - 1)
        group_parts.append(cols[g_idx]["nombre_fuente"])
    group_clause = " GROUP BY " + ", ".join(group_parts) if group_parts else ""

    limite = respuesta.get("limite", 100)
    if not isinstance(limite, int) or limite < 1 or limite > 1000:
        limite = 100

    return (
        f"SELECT {select_clause} FROM {tabla_nombre}{where_clause}{group_clause} LIMIT {limite}"
    )
