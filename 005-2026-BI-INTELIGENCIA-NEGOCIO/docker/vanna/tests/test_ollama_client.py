"""SPEC-012 · candado 2 (temp0/seed42/format/keep_alive) verificados con respx."""
from __future__ import annotations

import json

import httpx
import pytest
import respx

from vanna.ollama_client import OllamaError, generar_estructurado


@pytest.mark.asyncio
@respx.mock
async def test_200_devuelve_data_y_metrics():
    payload = {
        "response": json.dumps({"tabla_idx": 0}),
        "total_duration": 1_500_000,
        "prompt_eval_count": 42,
        "eval_count": 7,
        "load_duration": 100_000,
    }
    route = respx.post("http://x/api/generate").mock(
        return_value=httpx.Response(200, json=payload)
    )
    r = await generar_estructurado(
        modelo="qwen2.5:14b", prompt="p", schema={"type": "object"}, base_url="http://x"
    )
    assert route.called
    assert r.data == {"tabla_idx": 0}
    assert r.metrics.prompt_tokens == 42
    assert r.metrics.response_tokens == 7


@pytest.mark.asyncio
@respx.mock
async def test_candado_2_temperature_seed_format_stream_keep_alive():
    """El body a Ollama debe llevar temperature=0, seed=42, format=schema,
    stream=false, keep_alive="24h"."""
    body_capturado = {}

    def side_effect(request: httpx.Request) -> httpx.Response:
        body_capturado.update(json.loads(request.content))
        return httpx.Response(200, json={"response": json.dumps({"x": 1})})

    respx.post("http://x/api/generate").mock(side_effect=side_effect)
    schema = {"type": "object", "additionalProperties": False}
    await generar_estructurado(
        modelo="qwen2.5:14b",
        prompt="p",
        schema=schema,
        base_url="http://x",
    )
    assert body_capturado["options"]["temperature"] == 0
    assert body_capturado["options"]["seed"] == 42
    assert body_capturado["format"] == schema
    assert body_capturado["stream"] is False
    assert body_capturado["keep_alive"] == "24h"


@pytest.mark.asyncio
@respx.mock
async def test_candado_2_keep_alive_configurable():
    body_capturado = {}

    def side_effect(request: httpx.Request) -> httpx.Response:
        body_capturado.update(json.loads(request.content))
        return httpx.Response(200, json={"response": json.dumps({"x": 1})})

    respx.post("http://x/api/generate").mock(side_effect=side_effect)
    await generar_estructurado(
        modelo="qwen2.5:14b",
        prompt="p",
        schema={"type": "object"},
        base_url="http://x",
        keep_alive_h=48,
    )
    assert body_capturado["keep_alive"] == "48h"


@pytest.mark.asyncio
@respx.mock
async def test_timeout_eleva_ollama_error():
    respx.post("http://x/api/generate").mock(
        side_effect=httpx.TimeoutException("boom")
    )
    with pytest.raises(OllamaError) as e:
        await generar_estructurado(
            modelo="m", prompt="p", schema={"type": "object"}, base_url="http://x"
        )
    assert "timeout" in str(e.value)


@pytest.mark.asyncio
@respx.mock
async def test_json_invalido_eleva_ollama_error():
    respx.post("http://x/api/generate").mock(
        return_value=httpx.Response(200, json={"response": "no-es-json{"})
    )
    with pytest.raises(OllamaError) as e:
        await generar_estructurado(
            modelo="m", prompt="p", schema={"type": "object"}, base_url="http://x"
        )
    assert "bad_json" in str(e.value)
