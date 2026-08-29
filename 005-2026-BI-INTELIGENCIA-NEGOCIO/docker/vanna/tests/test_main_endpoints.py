"""SPEC-012 · /generate y /health con FastAPI TestClient (mock del ollama)."""
from __future__ import annotations

from typing import Any

import httpx
import pytest
import respx
from fastapi.testclient import TestClient

from vanna import main as main_module
from vanna.ollama_client import OllamaMetrics, OllamaResultado

CATALOGO = {
    "tablas": [
        {"nombre_fuente": "bi_reporte_diario", "columnas": [
            {"nombre_fuente": "fecha", "tipo": "date"},
            {"nombre_fuente": "total", "tipo": "int"},
        ]}
    ]
}


@pytest.fixture()
def client() -> TestClient:
    return TestClient(main_module.app)


@pytest.mark.asyncio
async def test_generate_200_consenso(monkeypatch, client):
    async def fake_deliberar(**kwargs):
        from vanna.jurado import ResultadoJurado, VotoModelo
        return ResultadoJurado(
            consenso=True,
            sql_generado="SELECT total FROM bi_reporte_diario LIMIT 5",
            razon=None,
            votos_jurado=[
                VotoModelo(modelo="a", sql_canonico="s1", sql_crudo="sql", latencia_ms=100),
                VotoModelo(modelo="b", sql_canonico="s1", sql_crudo="sql", latencia_ms=110),
            ],
            grupo_dominante=["a", "b"],
            latencias={"a": 100, "b": 110},
        )

    monkeypatch.setattr(main_module, "deliberar", fake_deliberar)
    r = client.post(
        "/generate",
        json={"preguntaNL": "cuántos", "catalogo": CATALOGO},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["consenso"] is True
    assert body["sqlGenerado"].startswith("SELECT")


@pytest.mark.asyncio
async def test_generate_500_ollama_unreachable(monkeypatch, client):
    from vanna.ollama_client import OllamaError

    async def fake_deliberar(**kwargs):
        raise OllamaError("timeout:x")

    monkeypatch.setattr(main_module, "deliberar", fake_deliberar)
    r = client.post(
        "/generate",
        json={"preguntaNL": "cuántos", "catalogo": CATALOGO},
    )
    assert r.status_code == 500
    assert "ollama_unreachable" in str(r.json())


@pytest.mark.asyncio
@respx.mock
async def test_health_3_modelos_disponibles(monkeypatch, client):
    monkeypatch.setenv("LLM_MODELS_JURADO", "qwen2.5:14b,gemma2:27b,aya-expanse:32b")
    monkeypatch.setenv("OLLAMA_BASE_URL", "http://mock-ollama")
    respx.get("http://mock-ollama/api/tags").mock(
        return_value=httpx.Response(
            200,
            json={"models": [
                {"name": "qwen2.5:14b"},
                {"name": "gemma2:27b"},
                {"name": "aya-expanse:32b"},
                {"name": "llama3:8b"},
            ]},
        )
    )
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert set(body["modelosDisponibles"]) == {"qwen2.5:14b", "gemma2:27b", "aya-expanse:32b"}


@pytest.mark.asyncio
@respx.mock
async def test_health_ollama_down_ok_false(monkeypatch, client):
    monkeypatch.setenv("OLLAMA_BASE_URL", "http://mock-ollama")
    respx.get("http://mock-ollama/api/tags").mock(
        side_effect=httpx.ConnectError("boom")
    )
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is False
    assert body["modelosDisponibles"] == []
