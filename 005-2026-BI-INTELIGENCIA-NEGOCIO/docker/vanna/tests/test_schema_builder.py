"""SPEC-012 · candados 1 (enum cerrado + additionalProperties:false) y 3 (índices)."""
from vanna.schema_builder import construir_prompt_generacion


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
                {"nombre_fuente": "eventos", "tipo": "int"},
            ],
        },
    ]
}


def _todos_los_objetos(schema):
    """Recorre schema recursivamente y devuelve cada dict."""
    if isinstance(schema, dict):
        yield schema
        for v in schema.values():
            yield from _todos_los_objetos(v)
    elif isinstance(schema, list):
        for v in schema:
            yield from _todos_los_objetos(v)


def test_additional_properties_false_en_cada_objeto():
    _, schema = construir_prompt_generacion("cuántos hoy", CATALOGO)
    objetos = [
        o for o in _todos_los_objetos(schema)
        if isinstance(o, dict) and o.get("type") == "object" and "properties" in o
    ]
    for o in objetos:
        assert o.get("additionalProperties") is False, f"falta additionalProperties:false en {o}"
    assert objetos, "debería haber al menos un objeto"


def test_tabla_idx_enum_cerrado_0_a_n_menos_1():
    _, schema = construir_prompt_generacion("cuántos hoy", CATALOGO)
    tabla = schema["properties"]["tabla_idx"]
    assert tabla["type"] == "integer"
    assert tabla["minimum"] == 0
    assert tabla["maximum"] == 1  # 2 tablas → 0..1


def test_prompt_incluye_indices_numericos():
    prompt, _ = construir_prompt_generacion("cuántos hoy", CATALOGO)
    assert "Tabla 0: bi_reporte_diario" in prompt
    assert "Columna 0: fecha" in prompt


def test_prompt_menciona_slots_atomicos_deny_by_default():
    prompt, _ = construir_prompt_generacion("cuántos hoy", CATALOGO)
    assert "nota" in prompt
