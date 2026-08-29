"""SPEC-012 · jurado 2/3 · candados 4 y 5."""
from __future__ import annotations

from typing import Any

import pytest

from vanna.jurado import deliberar
from vanna.ollama_client import OllamaError, OllamaMetrics, OllamaResultado


CATALOGO = {
    "tablas": [
        {
            "nombre_fuente": "bi_reporte_diario",
            "columnas": [
                {"nombre_fuente": "fecha", "tipo": "date"},
                {"nombre_fuente": "total", "tipo": "int"},
            ],
        }
    ]
}


def _res_ok(data: dict[str, Any]) -> OllamaResultado:
    return OllamaResultado(data=data, raw_response="", metrics=OllamaMetrics(latencia_ms=1))


def _resp_simple(tabla=0, cols=(1,), lim=5, nota=""):
    return {
        "tabla_idx": tabla,
        "columnas_idx": list(cols),
        "filtros": [],
        "agregacion": None,
        "agrupacion": [],
        "limite": lim,
        "nota": nota,
    }


def _make_llamar(map_modelo_res):
    async def llamar(modelo, prompt, schema):
        res = map_modelo_res[modelo]
        if isinstance(res, Exception):
            raise res
        return res

    return llamar


@pytest.mark.asyncio
async def test_a_3_identicos_consenso():
    resp = _res_ok(_resp_simple())
    llamar = _make_llamar({"m1": resp, "m2": resp, "m3": resp})
    r = await deliberar("q", CATALOGO, modelos=["m1", "m2", "m3"], llamar_modelo=llamar)
    assert r.consenso is True
    assert r.sql_generado is not None


@pytest.mark.asyncio
async def test_b_2_iguales_1_distinto_consenso():
    llamar = _make_llamar({
        "m1": _res_ok(_resp_simple(cols=(1,))),
        "m2": _res_ok(_resp_simple(cols=(1,))),
        "m3": _res_ok(_resp_simple(cols=(0,))),
    })
    r = await deliberar("q", CATALOGO, modelos=["m1", "m2", "m3"], llamar_modelo=llamar)
    assert r.consenso is True
    assert set(r.grupo_dominante) == {"m1", "m2"}


@pytest.mark.asyncio
async def test_c_3_distintos_no_consenso():
    llamar = _make_llamar({
        "m1": _res_ok(_resp_simple(cols=(0,))),
        "m2": _res_ok(_resp_simple(cols=(1,))),
        "m3": _res_ok(_resp_simple(cols=(0, 1))),
    })
    r = await deliberar("q", CATALOGO, modelos=["m1", "m2", "m3"], llamar_modelo=llamar)
    assert r.consenso is False
    assert r.razon == "sin_consenso"


@pytest.mark.asyncio
async def test_d_1_error_2_iguales_consenso():
    llamar = _make_llamar({
        "m1": OllamaError("timeout:x"),
        "m2": _res_ok(_resp_simple()),
        "m3": _res_ok(_resp_simple()),
    })
    r = await deliberar("q", CATALOGO, modelos=["m1", "m2", "m3"], llamar_modelo=llamar)
    assert r.consenso is True


@pytest.mark.asyncio
async def test_e_2_errores_1_sql_no_consenso():
    llamar = _make_llamar({
        "m1": OllamaError("timeout:x"),
        "m2": OllamaError("http:x"),
        "m3": _res_ok(_resp_simple()),
    })
    r = await deliberar("q", CATALOGO, modelos=["m1", "m2", "m3"], llamar_modelo=llamar)
    assert r.consenso is False


@pytest.mark.asyncio
async def test_f_3_errores_sin_votos_validos():
    llamar = _make_llamar({
        "m1": OllamaError("x"),
        "m2": OllamaError("y"),
        "m3": OllamaError("z"),
    })
    r = await deliberar("q", CATALOGO, modelos=["m1", "m2", "m3"], llamar_modelo=llamar)
    assert r.consenso is False
    assert r.razon == "sin_votos_validos"


@pytest.mark.asyncio
async def test_g_2_semantica_equivalentes_consenso_post_canonica():
    """SQL con orden AND distinto → misma canónica → consenso."""
    r1 = _res_ok({
        "tabla_idx": 0, "columnas_idx": [1],
        "filtros": [
            {"columna_idx": 0, "operador": "=", "valor": "2026-01-01"},
            {"columna_idx": 1, "operador": ">", "valor": 5},
        ],
        "agregacion": None, "agrupacion": [], "limite": 10, "nota": "",
    })
    r2 = _res_ok({
        "tabla_idx": 0, "columnas_idx": [1],
        "filtros": [
            {"columna_idx": 1, "operador": ">", "valor": 5},
            {"columna_idx": 0, "operador": "=", "valor": "2026-01-01"},
        ],
        "agregacion": None, "agrupacion": [], "limite": 10, "nota": "",
    })
    llamar = _make_llamar({"m1": r1, "m2": r2, "m3": OllamaError("x")})
    r = await deliberar("q", CATALOGO, modelos=["m1", "m2", "m3"], llamar_modelo=llamar)
    assert r.consenso is True


@pytest.mark.asyncio
async def test_h_candado_4_checks_atomicos_incompletos_2_de_3():
    """≥2/3 devuelven agregacion=null + nota != "" → REVISION."""
    resp_incompleta = {
        "tabla_idx": 0, "columnas_idx": [1],
        "filtros": None,
        "agregacion": None,
        "agrupacion": None,
        "limite": 10,
        "nota": "falta métrica",
    }
    llamar = _make_llamar({
        "m1": _res_ok(resp_incompleta),
        "m2": _res_ok(resp_incompleta),
        "m3": _res_ok(_resp_simple()),
    })
    r = await deliberar("q", CATALOGO, modelos=["m1", "m2", "m3"], llamar_modelo=llamar)
    assert r.consenso is False
    assert r.razon == "checks_atomicos_incompletos"


@pytest.mark.asyncio
async def test_i_candado_4_solo_1_incompleto_no_bloquea():
    """Si solo 1/3 marca faltantes, el jurado sigue evaluando consenso normal."""
    resp_incompleta = {
        "tabla_idx": 0, "columnas_idx": [1],
        "filtros": None, "agregacion": None, "agrupacion": None,
        "limite": 10, "nota": "falta métrica",
    }
    llamar = _make_llamar({
        "m1": _res_ok(resp_incompleta),
        "m2": _res_ok(_resp_simple()),
        "m3": _res_ok(_resp_simple()),
    })
    r = await deliberar("q", CATALOGO, modelos=["m1", "m2", "m3"], llamar_modelo=llamar)
    assert r.consenso is True
