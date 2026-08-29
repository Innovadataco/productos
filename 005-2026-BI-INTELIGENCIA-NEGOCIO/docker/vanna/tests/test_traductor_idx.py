"""SPEC-012 · candado 3 · IdxFueraDeRango."""
import pytest

from vanna.traductor_idx import IdxFueraDeRango, construir_sql

CATALOGO = {
    "tablas": [
        {
            "nombre_fuente": "bi_reporte_diario",
            "columnas": [
                {"nombre_fuente": "fecha", "tipo": "date"},
                {"nombre_fuente": "categoria", "tipo": "text"},
                {"nombre_fuente": "total", "tipo": "int"},
            ],
        },
        {
            "nombre_fuente": "bi_operativo",
            "columnas": [
                {"nombre_fuente": "worker", "tipo": "text"},
            ],
        },
    ]
}


def test_tabla_idx_fuera_de_rango_positivo():
    resp = {"tabla_idx": 99, "columnas_idx": [0], "limite": 5, "nota": ""}
    with pytest.raises(IdxFueraDeRango) as e:
        construir_sql(resp, CATALOGO)
    assert e.value.campo == "tabla_idx"
    assert e.value.valor == 99
    assert e.value.maximo == 1


def test_columna_idx_fuera_de_rango():
    resp = {"tabla_idx": 0, "columnas_idx": [0, 42], "limite": 5, "nota": ""}
    with pytest.raises(IdxFueraDeRango) as e:
        construir_sql(resp, CATALOGO)
    assert e.value.campo == "columna_idx"
    assert e.value.valor == 42
    assert e.value.maximo == 2


def test_tabla_idx_negativo_rechazado():
    resp = {"tabla_idx": -1, "columnas_idx": [0], "limite": 5, "nota": ""}
    with pytest.raises(IdxFueraDeRango):
        construir_sql(resp, CATALOGO)


def test_happy_path_devuelve_sql_con_nombres_canonicos():
    resp = {"tabla_idx": 0, "columnas_idx": [0, 1], "limite": 10, "nota": ""}
    sql = construir_sql(resp, CATALOGO)
    assert "FROM bi_reporte_diario" in sql
    assert "fecha" in sql
    assert "categoria" in sql
    assert "LIMIT 10" in sql


def test_agregacion_con_columna_idx_valida():
    resp = {
        "tabla_idx": 0,
        "columnas_idx": [1],
        "agregacion": {"fn": "COUNT", "columna_idx": 2},
        "agrupacion": [1],
        "limite": 5,
        "nota": "",
    }
    sql = construir_sql(resp, CATALOGO)
    assert "COUNT(total)" in sql
    assert "GROUP BY categoria" in sql


def test_filtro_con_valor_string_escapa_comillas():
    resp = {
        "tabla_idx": 0,
        "columnas_idx": [1],
        "filtros": [{"columna_idx": 1, "operador": "=", "valor": "O'Brien"}],
        "limite": 5,
        "nota": "",
    }
    sql = construir_sql(resp, CATALOGO)
    assert "'O''Brien'" in sql
